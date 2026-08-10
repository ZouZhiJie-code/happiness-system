import { createHash, randomUUID } from "node:crypto";
import { open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { loadEnvConfig } from "@next/env";

import type { AIProvider } from "../src/server/services/ai/ai-provider";
import { getAIProviderFailureCode } from "../src/server/services/ai/ai-provider";
import { readVolcengineArkConfig } from "../src/server/services/ai/provider-config";
import { createRuntimeAIProvider } from "../src/server/services/ai/runtime-provider-factory";
import { completeStructuredOutput, type StructuredOutputAttempt } from "../src/server/services/ai/structured-output";
import {
  assessEventJournalDraftGrounding,
  buildEventJournalPrompt,
  buildSafeEventJournalFallback,
  EVENT_JOURNAL_PROMPT_VERSION,
  eventJournalDraftSchema
} from "../src/server/services/interview/journal-event-entry.service";
import type { JournalEventEntrySourceSnapshot } from "../src/types/journal-event-entry";

const outputDirectory = resolve(
  process.cwd(),
  "artifacts/generative-interview-board7/2026-08-02"
);
const scopePath = resolve(outputDirectory, "board7-event-journal-mvp-probe-scope.json");
const approvalPath = resolve(outputDirectory, "board7-event-journal-mvp-probe-approval.json");
const budgetPath = resolve(outputDirectory, "board7-event-journal-mvp-probe-budget.json");
const budgetLockPath = `${budgetPath}.lock`;
const resultPath = resolve(outputDirectory, "board7-event-journal-mvp-probe-result.json");
const reportPath = resolve(outputDirectory, "board7-event-journal-mvp-probe-report.md");

type ProbeScope = {
  probeVersion: "board7-event-journal-mvp-probe-v1";
  promptVersion: string;
  model: "deepseek-v4-flash";
  temperature: 0.2;
  maxTokens: 1500;
  timeoutMs: 12000;
  thinking: "disabled";
  nominalRuns: 1;
  technicalAttemptLimit: 2;
  sourceSnapshot: JournalEventEntrySourceSnapshot;
};

type ProbeApproval = {
  approvalType: "board7_event_journal_mvp_probe_run";
  approvalVersion: "board7-event-journal-mvp-probe-approval-v1";
  decision: "approved";
  approvedBy: "product_owner";
  approvedAt: string;
  confirmationText: string;
  scopeFingerprint: string;
  model: "deepseek-v4-flash";
  nominalRuns: 1;
  technicalAttemptLimit: 2;
};

type ProbeRequest = {
  requestId: string;
  attempt: number;
  status: "reserved" | "completed" | "failed";
  reservedAt: string;
  settledAt: string | null;
  latencyMs: number | null;
  tokenUsage: Record<string, number> | null;
  errorCode: string | null;
};

type ProbeBudget = {
  ledgerVersion: "board7-event-journal-mvp-probe-budget-v1";
  scopeFingerprint: string;
  status: "approved" | "running" | "completed" | "aborted";
  model: "deepseek-v4-flash";
  nominalRunLimit: 1;
  technicalAttemptLimit: 2;
  nominalRunsConsumed: number;
  technicalAttemptsConsumed: number;
  requests: ProbeRequest[];
  outcome: "pass" | "technical_failed" | "quality_fallback" | "aborted" | null;
  updatedAt: string;
};

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeJson(path: string, value: unknown) {
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

async function writeText(path: string, value: string) {
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, value, "utf8");
  await rename(temporaryPath, path);
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function withBudgetLock<T>(operation: () => Promise<T>) {
  const lock = await open(budgetLockPath, "wx").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EEXIST") throw new Error("EVENT_JOURNAL_PROBE_BUDGET_LOCKED");
    throw error;
  });
  try {
    return await operation();
  } finally {
    await lock.close();
    await unlink(budgetLockPath).catch(() => undefined);
  }
}

async function mutateBudget(mutate: (budget: ProbeBudget) => ProbeBudget) {
  return withBudgetLock(async () => {
    const budget = await readJson<ProbeBudget>(budgetPath);
    const next = mutate(budget);
    await writeJson(budgetPath, next);
    return next;
  });
}

function validateArtifacts(scope: ProbeScope, approval: ProbeApproval, budget: ProbeBudget) {
  const scopeFingerprint = fingerprint(scope);
  if (
    scope.probeVersion !== "board7-event-journal-mvp-probe-v1" ||
    scope.promptVersion !== EVENT_JOURNAL_PROMPT_VERSION ||
    scope.model !== "deepseek-v4-flash" ||
    scope.temperature !== 0.2 ||
    scope.maxTokens !== 1500 ||
    scope.timeoutMs !== 12000 ||
    scope.thinking !== "disabled" ||
    scope.nominalRuns !== 1 ||
    scope.technicalAttemptLimit !== 2
  ) throw new Error("EVENT_JOURNAL_PROBE_SCOPE_INVALID");
  if (
    approval.approvalType !== "board7_event_journal_mvp_probe_run" ||
    approval.approvalVersion !== "board7-event-journal-mvp-probe-approval-v1" ||
    approval.decision !== "approved" ||
    approval.approvedBy !== "product_owner" ||
    !Number.isFinite(Date.parse(approval.approvedAt)) ||
    approval.confirmationText.trim().length < 8 ||
    approval.scopeFingerprint !== scopeFingerprint ||
    approval.model !== scope.model ||
    approval.nominalRuns !== 1 ||
    approval.technicalAttemptLimit !== 2
  ) throw new Error("EVENT_JOURNAL_PROBE_APPROVAL_INVALID");
  if (
    budget.ledgerVersion !== "board7-event-journal-mvp-probe-budget-v1" ||
    budget.scopeFingerprint !== scopeFingerprint ||
    budget.status !== "approved" ||
    budget.model !== scope.model ||
    budget.nominalRunLimit !== 1 ||
    budget.technicalAttemptLimit !== 2 ||
    budget.nominalRunsConsumed !== 0 ||
    budget.technicalAttemptsConsumed !== 0 ||
    budget.requests.length !== 0 ||
    budget.outcome !== null
  ) throw new Error("EVENT_JOURNAL_PROBE_BUDGET_INVALID_OR_CONSUMED");
  return scopeFingerprint;
}

function frozenProvider(scope: ProbeScope) {
  const config = readVolcengineArkConfig();
  if (config.issues.length > 0 || !config.apiKey || !config.model) {
    throw new Error(`EVENT_JOURNAL_PROBE_PROVIDER_INVALID:${config.issues.join(",")}`);
  }
  if (config.model !== scope.model) {
    throw new Error(`EVENT_JOURNAL_PROBE_MODEL_MISMATCH:${config.model}`);
  }
  return createRuntimeAIProvider({
    capability: "chat",
    apiKey: config.apiKey,
    config: {
      provider: "volcengine_ark",
      config:
        config.modelSource === "VOLCENGINE_ARK_ENDPOINT_ID" ||
        config.modelSource === "ARK_ENDPOINT_ID"
          ? { endpointId: config.model, baseUrl: config.baseUrl }
          : { modelId: config.model, baseUrl: config.baseUrl }
    },
    timeoutMs: scope.timeoutMs
  });
}

function budgetedProvider(provider: AIProvider, scope: ProbeScope): AIProvider {
  return {
    name: provider.name,
    complete: async (params) => {
      const requestId = randomUUID();
      const reservedAt = new Date().toISOString();
      const budget = await mutateBudget((current) => {
        if (
          current.status !== "running" ||
          current.technicalAttemptsConsumed >= scope.technicalAttemptLimit
        ) throw new Error("EVENT_JOURNAL_PROBE_REQUEST_BUDGET_EXHAUSTED");
        const attempt = current.technicalAttemptsConsumed + 1;
        return {
          ...current,
          technicalAttemptsConsumed: attempt,
          requests: [
            ...current.requests,
            {
              requestId,
              attempt,
              status: "reserved",
              reservedAt,
              settledAt: null,
              latencyMs: null,
              tokenUsage: null,
              errorCode: null
            }
          ],
          updatedAt: reservedAt
        };
      });
      const attempt = budget.technicalAttemptsConsumed;
      try {
        const result = await provider.complete(params);
        await mutateBudget((current) => ({
          ...current,
          requests: current.requests.map((request) => request.requestId === requestId
            ? {
                ...request,
                status: "completed",
                settledAt: new Date().toISOString(),
                latencyMs: result.latencyMs,
                tokenUsage: result.tokenUsage
                  ? Object.fromEntries(
                      Object.entries(result.tokenUsage).filter((entry): entry is [string, number] =>
                        typeof entry[1] === "number"
                      )
                    )
                  : null
              }
            : request),
          updatedAt: new Date().toISOString()
        }));
        return result;
      } catch (error) {
        await mutateBudget((current) => ({
          ...current,
          requests: current.requests.map((request) => request.requestId === requestId
            ? {
                ...request,
                status: "failed",
                settledAt: new Date().toISOString(),
                errorCode: getAIProviderFailureCode(error)
              }
            : request),
          updatedAt: new Date().toISOString()
        }));
        throw error;
      } finally {
        if (attempt > scope.technicalAttemptLimit) {
          throw new Error("EVENT_JOURNAL_PROBE_REQUEST_BUDGET_EXHAUSTED");
        }
      }
    }
  };
}

function report(result: Record<string, unknown>) {
  const finalDraft = result.finalDraft as { title?: string; content?: string } | null;
  return [
    "# 板块 7｜事件日志真实模型单探针",
    "",
    `- 结果：${result.outcome}`,
    `- 模型：${result.model}`,
    `- Prompt：${result.promptVersion}`,
    `- 技术尝试：${result.technicalAttempts}`,
    `- AI 草稿结构：${result.technicalComplete ? "通过" : "失败"}`,
    `- AI 草稿来源门：${result.candidateGroundingAccepted ? "通过" : "未通过，已采用安全基础版本"}`,
    `- 最终可见日志来源门：${result.finalGroundingAccepted ? "通过" : "失败"}`,
    "",
    "## 最终用户可见日志",
    "",
    `### ${finalDraft?.title ?? "未生成"}`,
    "",
    finalDraft?.content ?? "未生成",
    "",
    "## 固定边界",
    "",
    "- 使用合成冻结来源，不连接数据库。",
    "- 使用线上同一 Prompt 构造与来源质量门。",
    "- 本次授权只消费一个名义场景，技术尝试最多两次。",
    "- Production 配置与数据保持原状。",
    ""
  ].join("\n");
}

async function main() {
  loadEnvConfig(process.cwd());
  const [scope, approval, initialBudget] = await Promise.all([
    readJson<ProbeScope>(scopePath),
    readJson<ProbeApproval>(approvalPath),
    readJson<ProbeBudget>(budgetPath)
  ]);
  const scopeFingerprint = validateArtifacts(scope, approval, initialBudget);
  await mutateBudget((current) => ({
    ...current,
    status: "running",
    nominalRunsConsumed: 1,
    updatedAt: new Date().toISOString()
  }));

  try {
    const provider = budgetedProvider(frozenProvider(scope), scope);
    const attempts: StructuredOutputAttempt[] = [];
    const envelope = buildEventJournalPrompt(scope.sourceSnapshot);
    const startedAt = Date.now();
    const candidate = await completeStructuredOutput({
      provider,
      stage: "generate",
      schema: eventJournalDraftSchema,
      messages: envelope.messages,
      temperature: scope.temperature,
      maxTokens: scope.maxTokens,
      maxAttempts: scope.technicalAttemptLimit,
      timeoutMs: scope.timeoutMs,
      responseFormat: "json_object",
      thinking: scope.thinking,
      onAttempt: (attempt) => {
        attempts.push(attempt);
      }
    });
    const candidateGrounding = candidate
      ? assessEventJournalDraftGrounding(scope.sourceSnapshot, candidate)
      : { accepted: false, issues: ["technical_output_unavailable"] };
    const fallback = buildSafeEventJournalFallback(scope.sourceSnapshot);
    const finalDraft = candidate && candidateGrounding.accepted ? candidate : fallback;
    const finalGrounding = finalDraft
      ? assessEventJournalDraftGrounding(scope.sourceSnapshot, finalDraft)
      : { accepted: false, issues: ["final_output_unavailable"] };
    const outcome: ProbeBudget["outcome"] = !candidate
      ? "technical_failed"
      : candidateGrounding.accepted
        ? "pass"
        : "quality_fallback";
    const result = {
      probeVersion: scope.probeVersion,
      scopeFingerprint,
      approvalPath,
      budgetPath,
      model: scope.model,
      promptVersion: EVENT_JOURNAL_PROMPT_VERSION,
      runtime: {
        temperature: scope.temperature,
        maxTokens: scope.maxTokens,
        timeoutMs: scope.timeoutMs,
        thinking: scope.thinking
      },
      outcome,
      technicalComplete: Boolean(candidate),
      technicalAttempts: attempts.length,
      latencyMs: Date.now() - startedAt,
      attempts,
      candidate,
      candidateGroundingAccepted: candidateGrounding.accepted,
      candidateGroundingIssues: candidateGrounding.issues,
      finalOrigin: candidate && candidateGrounding.accepted ? "llm" : "fallback",
      finalDraft,
      finalGroundingAccepted: finalGrounding.accepted,
      finalGroundingIssues: finalGrounding.issues,
      generatedAt: new Date().toISOString()
    };
    await Promise.all([
      writeJson(resultPath, result),
      writeText(reportPath, report(result))
    ]);
    await mutateBudget((current) => ({
      ...current,
      status: "completed",
      outcome,
      updatedAt: new Date().toISOString()
    }));
    process.stdout.write(`${JSON.stringify({
      outcome,
      technicalAttempts: attempts.length,
      candidateGroundingAccepted: candidateGrounding.accepted,
      finalOrigin: result.finalOrigin,
      finalGroundingAccepted: finalGrounding.accepted,
      resultPath,
      reportPath
    }, null, 2)}\n`);
  } catch (error) {
    await mutateBudget((current) => ({
      ...current,
      status: "aborted",
      outcome: "aborted",
      updatedAt: new Date().toISOString()
    })).catch(() => undefined);
    throw error;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
