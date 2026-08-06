import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  createGenerativeMvpBaselineRecoveryLedger,
  createGenerativeMvpBaselineRecoveryScope,
  GENERATIVE_MVP_BASELINE_RECOVERY_CASE_FINGERPRINT,
  GENERATIVE_MVP_BASELINE_RECOVERY_CASES,
  GENERATIVE_MVP_BASELINE_RECOVERY_RUNTIME_CONFIG,
  GENERATIVE_MVP_BASELINE_RECOVERY_SCOPE_FINGERPRINT,
  GENERATIVE_MVP_BASELINE_RECOVERY_VERSION,
  reserveGenerativeMvpBaselineRecoveryRequest,
  validateGenerativeMvpBaselineRecoveryApproval,
  type GenerativeMvpBaselineRecoveryLedger
} from "../src/features/interview/event-centered/generative-mvp-baseline-recovery";
import { runGenerativeBaselineCase } from "../src/features/interview/event-centered/generative-evaluation-runtime";
import type { AIProvider } from "../src/server/services/ai/ai-provider";
import {
  getEventCenteredAIProvider,
  readEventCenteredGenerativeModel
} from "../src/server/services/ai/event-centered-provider";

const artifactDirectory = resolve(
  process.cwd(),
  "artifacts/generative-interview-board7/2026-08-02"
);
const approvalPath = resolve(
  artifactDirectory,
  "board7-mvp-baseline-recovery-v1-approval.json"
);
const checkpointPath = resolve(
  artifactDirectory,
  "board7-mvp-baseline-recovery-v1.checkpoint.json"
);
const resultPath = resolve(
  artifactDirectory,
  "board7-mvp-baseline-recovery-v1.json"
);
const reportPath = resolve(
  artifactDirectory,
  "board7-mvp-baseline-recovery-v1-report.md"
);

type RecoveryRun = Awaited<ReturnType<typeof runGenerativeBaselineCase>>;
type RecoveryCheckpoint = {
  evaluation: "board7_mvp_baseline_recovery";
  datasetVersion: typeof GENERATIVE_MVP_BASELINE_RECOVERY_VERSION;
  caseFingerprint: string;
  scopeFingerprint: string;
  model: string;
  status: "running" | "completed" | "aborted";
  startedAt: string;
  completedAt: string | null;
  ledger: GenerativeMvpBaselineRecoveryLedger;
  results: RecoveryRun[];
  error: string | null;
};

async function writeAtomic(path: string, value: string) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, value, "utf8");
  await rename(temporaryPath, path);
}

async function writeJson(path: string, value: unknown) {
  await writeAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function readCheckpoint(): Promise<RecoveryCheckpoint | null> {
  try {
    return await readJson<RecoveryCheckpoint>(checkpointPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function assertCheckpoint(checkpoint: RecoveryCheckpoint) {
  if (
    checkpoint.evaluation !== "board7_mvp_baseline_recovery" ||
    checkpoint.datasetVersion !== GENERATIVE_MVP_BASELINE_RECOVERY_VERSION ||
    checkpoint.caseFingerprint !== GENERATIVE_MVP_BASELINE_RECOVERY_CASE_FINGERPRINT ||
    checkpoint.scopeFingerprint !== GENERATIVE_MVP_BASELINE_RECOVERY_SCOPE_FINGERPRINT ||
    checkpoint.model !== GENERATIVE_MVP_BASELINE_RECOVERY_RUNTIME_CONFIG.model ||
    checkpoint.ledger.scopeFingerprint !== GENERATIVE_MVP_BASELINE_RECOVERY_SCOPE_FINGERPRINT
  ) {
    throw new Error("GENERATIVE_MVP_BASELINE_RECOVERY_CHECKPOINT_MISMATCH");
  }
}

function formatReport(checkpoint: RecoveryCheckpoint) {
  const complete = checkpoint.results.filter((item) => item.technicalComplete).length;
  const lines = [
    "# 板块 7｜MVP baseline 降级恢复探针",
    "",
    `- 数据集：${checkpoint.datasetVersion}`,
    `- 模型：${checkpoint.model}`,
    `- 技术完整：${complete}/2`,
    `- 生成请求：${checkpoint.ledger.requests.length}/8`,
    `- 运行状态：${checkpoint.status}`,
    ""
  ];
  for (const item of checkpoint.results) {
    lines.push(
      `## ${item.caseId}`,
      "",
      `- 技术完整：${item.technicalComplete ? "是" : "否"}`,
      `- 最终动作：${item.finalAction ?? "无"}`,
      `- 用户可见回应：${item.visibleResponse ?? "无"}`,
      `- 运行错误：${item.runtimeError ?? "无"}`,
      `- 请求尝试：${item.attempts.length}`,
      ""
    );
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function resolveStage(messages: Parameters<AIProvider["complete"]>[0]["messages"]) {
  const system = messages[0]?.content ?? "";
  if (system.includes("事件中心访谈的证据判断")) return "understanding" as const;
  if (system.includes("把已经确定的访谈策略写成")) return "response" as const;
  throw new Error("GENERATIVE_MVP_BASELINE_RECOVERY_STAGE_UNKNOWN");
}

async function main() {
  loadEnvConfig(process.cwd());
  if (process.argv.includes("--describe")) {
    process.stdout.write(`${JSON.stringify(createGenerativeMvpBaselineRecoveryScope(), null, 2)}\n`);
    return;
  }

  validateGenerativeMvpBaselineRecoveryApproval(await readJson<unknown>(approvalPath));
  const configuredModel = readEventCenteredGenerativeModel();
  if (configuredModel !== GENERATIVE_MVP_BASELINE_RECOVERY_RUNTIME_CONFIG.model) {
    throw new Error("GENERATIVE_MVP_BASELINE_RECOVERY_MODEL_MISMATCH");
  }
  const provider = await getEventCenteredAIProvider();
  if (!provider) throw new Error("GENERATIVE_MVP_BASELINE_RECOVERY_PROVIDER_UNAVAILABLE");

  let checkpoint = await readCheckpoint() ?? {
    evaluation: "board7_mvp_baseline_recovery" as const,
    datasetVersion: GENERATIVE_MVP_BASELINE_RECOVERY_VERSION,
    caseFingerprint: GENERATIVE_MVP_BASELINE_RECOVERY_CASE_FINGERPRINT,
    scopeFingerprint: GENERATIVE_MVP_BASELINE_RECOVERY_SCOPE_FINGERPRINT,
    model: configuredModel,
    status: "running" as const,
    startedAt: new Date().toISOString(),
    completedAt: null,
    ledger: createGenerativeMvpBaselineRecoveryLedger(),
    results: [],
    error: null
  };
  assertCheckpoint(checkpoint);
  if (checkpoint.status !== "running") {
    throw new Error("GENERATIVE_MVP_BASELINE_RECOVERY_ALREADY_TERMINAL");
  }

  const persist = async () => writeJson(checkpointPath, checkpoint);
  const trackedProvider = (caseId: string): AIProvider => ({
    name: `${provider.name}:board7-mvp-baseline-recovery`,
    async complete(params) {
      const stage = resolveStage(params.messages);
      const attemptIndex = checkpoint.ledger.requests.filter((item) =>
        item.caseId === caseId && item.stage === stage
      ).length + 1;
      checkpoint.ledger = reserveGenerativeMvpBaselineRecoveryRequest(
        checkpoint.ledger,
        { caseId, stage, attemptIndex: attemptIndex as 1 | 2 }
      );
      await persist();
      return provider.complete(params);
    }
  });

  try {
    for (const evaluationCase of GENERATIVE_MVP_BASELINE_RECOVERY_CASES) {
      if (checkpoint.results.some((item) => item.caseId === evaluationCase.caseId)) continue;
      const result = await runGenerativeBaselineCase({
        evaluationCase,
        provider: trackedProvider(evaluationCase.caseId)
      });
      checkpoint.results.push(result);
      await persist();
    }
    checkpoint = {
      ...checkpoint,
      status: "completed",
      completedAt: new Date().toISOString(),
      ledger: { ...checkpoint.ledger, status: "completed" }
    };
    await writeJson(checkpointPath, checkpoint);
    await writeJson(resultPath, {
      ...checkpoint,
      gate: checkpoint.results.every((item) => item.technicalComplete)
        ? "pending_codex_review"
        : "technical_failed"
    });
    await writeAtomic(reportPath, formatReport(checkpoint));
  } catch (error) {
    checkpoint = {
      ...checkpoint,
      status: "aborted",
      completedAt: new Date().toISOString(),
      ledger: { ...checkpoint.ledger, status: "aborted" },
      error: error instanceof Error ? error.message : "UNKNOWN_ERROR"
    };
    await writeJson(checkpointPath, checkpoint);
    throw error;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "UNKNOWN_ERROR"}\n`);
  process.exitCode = 1;
});
