import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  GI088_RESPONSE_FIRST_V2_RUNTIME,
  createGi088ResponseFirstV2Identity,
  createGi088ResponseFirstV2LowUserPrompt,
  getGi088ResponseFirstV2LowSystemPrompt,
  parseGi088ResponseFirstV2LowOutput,
  validateGi088ResponseFirstV2LowOutput
} from "../evals/event-centered-generative/gi088-response-first-v2/candidate";
import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAIProviderDiagnostics,
  type AIProvider,
  type AIProviderDiagnostics,
  type AICompletionParams
} from "../src/server/services/ai/ai-provider";
import { OpenAIProvider } from "../src/server/services/ai/openai.provider";
import {
  GI088_RESPONSE_FIRST_V2_ROOT,
  loadGi088ResponseFirstV2Cases,
  shaGi088ResponseFirstV2Fixture,
  type Gi088ResponseFirstV2Case,
  type Gi088ResponseFirstV2CaseId
} from "./gi088-response-first-v2-fixtures";

export const GI088_RESPONSE_FIRST_V2_LOW_QUALITY_IDENTITY =
  "2026-08-16.gi088-response-first-v2-low-quality-v1" as const;

const PRIVATE_ROOT =
  `${GI088_RESPONSE_FIRST_V2_ROOT}/.private/response-first-v2/low-quality-v1`;
const PRIVATE_LEDGER = `${PRIVATE_ROOT}/ledger.json`;
const PRIVATE_REVIEW = `${PRIVATE_ROOT}/codex-review.json`;
const PRIVATE_REVIEW_HTML = `${PRIVATE_ROOT}/review.html`;
const PUBLIC_START =
  `${GI088_RESPONSE_FIRST_V2_ROOT}/response-first-v2-low-quality-v1-start-card.json`;
const PUBLIC_RECEIPT =
  `${GI088_RESPONSE_FIRST_V2_ROOT}/response-first-v2-low-quality-v1-receipt.json`;
const PUBLIC_HANDOFF =
  `${GI088_RESPONSE_FIRST_V2_ROOT}/response-first-v2-low-quality-v1-handoff.md`;
const RUNNER_FILE = "scripts/run-gi088-response-first-v2-low-quality.ts";

const FILES = {
  standard: "docs/ai-evaluation-standard.md",
  candidate:
    "evals/event-centered-generative/gi088-response-first-v2/candidate.ts",
  fixtures: "scripts/gi088-response-first-v2-fixtures.ts",
  provider: "src/server/services/ai/openai.provider.ts",
  providerContract: "src/server/services/ai/ai-provider.ts",
  runner: RUNNER_FILE
} as const;

export type Gi088ResponseFirstV2LowCallResult = {
  order: number;
  caseId: Gi088ResponseFirstV2CaseId;
  status: "valid" | "contract_failure" | "technical_failure";
  startedAt: string;
  completedAt: string;
  requestFingerprint: string;
  responseHash: string | null;
  responseLength: number;
  rawOutput: string | null;
  validationIssues: string[];
  errorCode: string | null;
  headersLatencyMs: number | null;
  firstTokenLatencyMs: number | null;
  bodyLatencyMs: number | null;
  totalLatencyMs: number | null;
  target15sPassed: boolean;
  hard45sPassed: boolean;
  diagnostics: ReturnType<typeof sanitizeAIProviderDiagnostics>;
};

export type Gi088ResponseFirstV2LowReviewDecision = {
  caseId: Gi088ResponseFirstV2CaseId;
  verdict: "pass" | "minor" | "fail";
  note: string;
};

type LowPlan = Awaited<ReturnType<typeof createGi088ResponseFirstV2LowPlan>>;

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function sha(value: unknown) {
  return createHash("sha256")
    .update(typeof value === "string" || Buffer.isBuffer(value)
      ? value
      : JSON.stringify(canonicalize(value)))
    .digest("hex");
}

async function fileSha(cwd: string, relativePath: string) {
  return sha(await readFile(path.join(cwd, relativePath)));
}

async function writeJsonAtomic(file: string, value: unknown, privateFile = false) {
  await mkdir(path.dirname(file), { recursive: true, mode: privateFile ? 0o700 : 0o755 });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: privateFile ? 0o600 : 0o644
  });
  await rename(temporary, file);
  if (privateFile) await chmod(file, 0o600);
}

function requestForCase(item: Gi088ResponseFirstV2Case) {
  const runtime = GI088_RESPONSE_FIRST_V2_RUNTIME.low;
  return {
    messages: [
      { role: "system" as const, content: getGi088ResponseFirstV2LowSystemPrompt() },
      { role: "user" as const, content: createGi088ResponseFirstV2LowUserPrompt(item.turnInput) }
    ],
    maxTokens: runtime.maxTokens,
    headersTimeoutMs: runtime.headersTimeoutMs,
    bodyIdleTimeoutMs: runtime.bodyIdleTimeoutMs,
    hardTimeoutMs: runtime.hardTimeoutMs,
    timeoutMs: runtime.hardTimeoutMs,
    thinking: runtime.thinking,
    reasoningEffort: runtime.reasoningEffort
  } satisfies AICompletionParams;
}

export async function createGi088ResponseFirstV2LowPlan(cwd = process.cwd()) {
  const dataset = await loadGi088ResponseFirstV2Cases(cwd);
  const identity = createGi088ResponseFirstV2Identity();
  const inputHashes = Object.fromEntries(
    await Promise.all(
      Object.entries(FILES).map(async ([key, relativePath]) => [
        `${key}Sha256`,
        await fileSha(cwd, relativePath)
      ])
    )
  );
  const cases = dataset.cases.map((item, index) => ({
    order: index + 1,
    caseId: item.caseId,
    sourceCaseId: item.sourceCaseId,
    sourceFingerprint: item.sourceFingerprint,
    hardGate: item.hardGate,
    requestFingerprint: sha(requestForCase(item))
  }));
  const core = {
    schemaVersion: "1.0",
    identity: GI088_RESPONSE_FIRST_V2_LOW_QUALITY_IDENTITY,
    status: "ready_authorized_waiting_execution",
    productDecision: "whether_low_acknowledgement_meets_the_six_real_case_gate",
    candidateIdentity: identity,
    dataset: {
      version: dataset.datasetVersion,
      fingerprint: dataset.datasetFingerprint,
      privacyLevel: "private_sensitive",
      caseCount: dataset.cases.length
    },
    cases,
    runtime: {
      provider: GI088_RESPONSE_FIRST_V2_RUNTIME.provider,
      baseUrlHost: GI088_RESPONSE_FIRST_V2_RUNTIME.baseUrlHost,
      model: GI088_RESPONSE_FIRST_V2_RUNTIME.model,
      ...GI088_RESPONSE_FIRST_V2_RUNTIME.low,
      concurrency: 1,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    inputHashes,
    budget: {
      authorized: 6,
      consumedBeforeRun: 0,
      technicalReplacementCalls: 0,
      retries: 0,
      recovery: 0,
      fallback: 0,
      authorizationSource: "confirmed_response_first_v2_plan_standing_authorization"
    },
    gate: {
      technicalValid: "6/6",
      hard45s: "6/6",
      hardCases: [
        "RPR-REAL-19-CORRECTION",
        "RPR-REAL-19-CONTINUE",
        "RPR-REAL-22",
        "RPR-REAL-13",
        "RPR-LC-21"
      ],
      softCases: ["RPR-REAL-06"],
      allowedSoftMinorCount: 1,
      lowQuestionCount: 0,
      internalLeakCount: 0
    },
    stopPoint:
      "any_technical_contract_speed_or_hard_case_failure_stops_question_ab_and_product_integration"
  } as const;
  return { ...core, planFingerprint: sha(core) };
}

function sanitizePublicResult(result: Gi088ResponseFirstV2LowCallResult) {
  return {
    order: result.order,
    caseId: result.caseId,
    status: result.status,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    requestFingerprint: result.requestFingerprint,
    responseHash: result.responseHash,
    responseLength: result.responseLength,
    validationIssues: result.validationIssues,
    errorCode: result.errorCode,
    headersLatencyMs: result.headersLatencyMs,
    firstTokenLatencyMs: result.firstTokenLatencyMs,
    bodyLatencyMs: result.bodyLatencyMs,
    totalLatencyMs: result.totalLatencyMs,
    target15sPassed: result.target15sPassed,
    hard45sPassed: result.hard45sPassed,
    tokenUsage: result.diagnostics?.tokenUsage ?? null,
    responseModel: result.diagnostics?.responseModel ?? null,
    httpStatus: result.diagnostics?.httpStatus ?? null
  };
}

export function normalizeGi088ResponseFirstV2LowResult(
  result: Gi088ResponseFirstV2LowCallResult
) {
  if (result.diagnostics?.finishReason !== "length") return result;
  return {
    ...result,
    status: "contract_failure" as const,
    validationIssues: [
      ...new Set([
        ...result.validationIssues,
        "LOW_OUTPUT_TRUNCATED_BY_TOKEN_LIMIT"
      ])
    ],
    errorCode: "GI088_RESPONSE_FIRST_V2_LOW_OUTPUT_TRUNCATED",
    target15sPassed: false,
    hard45sPassed: false
  };
}

function notRun(plan: LowPlan, results: Gi088ResponseFirstV2LowCallResult[]) {
  const completed = new Set(results.map((item) => item.order));
  return plan.cases
    .filter((item) => !completed.has(item.order))
    .map((item) => ({ order: item.order, caseId: item.caseId, status: "not_run" as const }));
}

async function saveLedger(input: {
  cwd: string;
  plan: LowPlan;
  results: Gi088ResponseFirstV2LowCallResult[];
}) {
  const normalizedResults = input.results.map(
    normalizeGi088ResponseFirstV2LowResult
  );
  const remaining = notRun(input.plan, normalizedResults);
  const status = remaining.length === 0
    ? "calls_complete_waiting_content_review"
    : normalizedResults.at(-1)?.status === "valid"
      ? "running"
      : "stopped_by_hard_gate";
  const ledger = {
    identity: input.plan.identity,
    planFingerprint: input.plan.planFingerprint,
    status,
    consumedCalls: normalizedResults.length,
    results: normalizedResults,
    notRun: remaining
  };
  await writeJsonAtomic(path.join(input.cwd, PRIVATE_LEDGER), ledger, true);
  await writeJsonAtomic(path.join(input.cwd, PUBLIC_RECEIPT), {
    schemaVersion: "1.0",
    identity: input.plan.identity,
    planFingerprint: input.plan.planFingerprint,
    candidateFingerprint: input.plan.candidateIdentity.candidateFingerprint,
    datasetFingerprint: input.plan.dataset.fingerprint,
    status,
    budget: {
      authorized: 6,
      consumed: normalizedResults.length,
      notRun: remaining.length,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    counts: {
      valid: normalizedResults.filter((item) => item.status === "valid").length,
      contractFailure: normalizedResults.filter((item) => item.status === "contract_failure").length,
      technicalFailure: normalizedResults.filter((item) => item.status === "technical_failure").length,
      target15sPassed: normalizedResults.filter((item) => item.target15sPassed).length,
      hard45sPassed: normalizedResults.filter((item) => item.hard45sPassed).length
    },
    results: normalizedResults.map(sanitizePublicResult),
    notRun: remaining,
    privateBoundary: {
      rawInputsOutputsAndReview: "git_ignored_private_directory",
      publicReceiptContainsUserOrModelBody: false
    }
  });
  return ledger;
}

export async function runGi088ResponseFirstV2LowCalls(input: {
  cwd?: string;
  workspaceRoot?: string;
  plan: LowPlan;
  provider: AIProvider;
}) {
  const cwd = input.cwd ?? process.cwd();
  const dataset = await loadGi088ResponseFirstV2Cases(
    input.workspaceRoot ?? process.cwd()
  );
  const existing = await readFile(path.join(cwd, PRIVATE_LEDGER), "utf8")
    .then((source) => JSON.parse(source) as { results?: Gi088ResponseFirstV2LowCallResult[] })
    .catch(() => ({ results: [] }));
  const results = [...(existing.results ?? [])];
  for (const entry of input.plan.cases) {
    if (results.some((item) => item.order === entry.order)) continue;
    const item = dataset.cases.find((candidate) => candidate.caseId === entry.caseId);
    assert(item, `GI088_RESPONSE_FIRST_V2_LOW_CASE_LOST:${entry.caseId}`);
    const request = requestForCase(item);
    assert(sha(request) === entry.requestFingerprint, `GI088_RESPONSE_FIRST_V2_LOW_REQUEST_DRIFT:${entry.caseId}`);
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    let rawOutput = "";
    let diagnostics: AIProviderDiagnostics | null = null;
    let result: Gi088ResponseFirstV2LowCallResult;
    try {
      assert(input.provider.stream, "GI088_RESPONSE_FIRST_V2_LOW_STREAM_UNAVAILABLE");
      for await (const chunk of input.provider.stream({
        ...request,
        onStreamDiagnostics: (value) => {
          diagnostics = value;
        }
      })) {
        rawOutput += chunk;
      }
      const safeDiagnostics = sanitizeAIProviderDiagnostics(diagnostics);
      const totalLatencyMs = safeDiagnostics?.totalLatencyMs ?? Math.max(0, Date.now() - startedMs);
      try {
        const output = parseGi088ResponseFirstV2LowOutput(rawOutput);
        const validationIssues = validateGi088ResponseFirstV2LowOutput(output);
        if (
          safeDiagnostics?.responseModel &&
          safeDiagnostics.responseModel !== GI088_RESPONSE_FIRST_V2_RUNTIME.model
        ) {
          validationIssues.push(`RESPONSE_MODEL_MISMATCH:${safeDiagnostics.responseModel}`);
        }
        if (safeDiagnostics?.finishReason === "length") {
          validationIssues.push("LOW_OUTPUT_TRUNCATED_BY_TOKEN_LIMIT");
        }
        const status = validationIssues.length === 0 ? "valid" as const : "contract_failure" as const;
        result = {
          order: entry.order,
          caseId: entry.caseId,
          status,
          startedAt,
          completedAt: new Date().toISOString(),
          requestFingerprint: entry.requestFingerprint,
          responseHash: sha(rawOutput),
          responseLength: rawOutput.length,
          rawOutput,
          validationIssues: [...new Set(validationIssues)],
          errorCode: status === "valid" ? null : "GI088_RESPONSE_FIRST_V2_LOW_CONTRACT_INVALID",
          headersLatencyMs: safeDiagnostics?.headersLatencyMs ?? null,
          firstTokenLatencyMs: safeDiagnostics?.firstTokenLatencyMs ?? null,
          bodyLatencyMs: safeDiagnostics?.bodyLatencyMs ?? null,
          totalLatencyMs,
          target15sPassed: status === "valid" && totalLatencyMs <= 15_000,
          hard45sPassed: status === "valid" && totalLatencyMs <= 45_000,
          diagnostics: safeDiagnostics
        };
      } catch (error) {
        result = {
          order: entry.order,
          caseId: entry.caseId,
          status: "contract_failure",
          startedAt,
          completedAt: new Date().toISOString(),
          requestFingerprint: entry.requestFingerprint,
          responseHash: rawOutput ? sha(rawOutput) : null,
          responseLength: rawOutput.length,
          rawOutput,
          validationIssues: [error instanceof Error ? error.message : "LOW_PARSE_FAILED"],
          errorCode: "GI088_RESPONSE_FIRST_V2_LOW_PARSE_FAILED",
          headersLatencyMs: safeDiagnostics?.headersLatencyMs ?? null,
          firstTokenLatencyMs: safeDiagnostics?.firstTokenLatencyMs ?? null,
          bodyLatencyMs: safeDiagnostics?.bodyLatencyMs ?? null,
          totalLatencyMs,
          target15sPassed: false,
          hard45sPassed: false,
          diagnostics: safeDiagnostics
        };
      }
    } catch (error) {
      const safeDiagnostics = sanitizeAIProviderDiagnostics(
        diagnostics ?? getAIProviderDiagnostics(error)
      );
      result = {
        order: entry.order,
        caseId: entry.caseId,
        status: "technical_failure",
        startedAt,
        completedAt: new Date().toISOString(),
        requestFingerprint: entry.requestFingerprint,
        responseHash: rawOutput ? sha(rawOutput) : null,
        responseLength: rawOutput.length,
        rawOutput: rawOutput || null,
        validationIssues: [],
        errorCode: getAIProviderFailureCode(error),
        headersLatencyMs: safeDiagnostics?.headersLatencyMs ?? null,
        firstTokenLatencyMs: safeDiagnostics?.firstTokenLatencyMs ?? null,
        bodyLatencyMs: safeDiagnostics?.bodyLatencyMs ?? null,
        totalLatencyMs: safeDiagnostics?.totalLatencyMs ?? Math.max(0, Date.now() - startedMs),
        target15sPassed: false,
        hard45sPassed: false,
        diagnostics: safeDiagnostics
      };
    }
    results.push(result);
    await saveLedger({ cwd, plan: input.plan, results });
    if (result.status !== "valid" || !result.hard45sPassed) break;
  }
  return saveLedger({ cwd, plan: input.plan, results });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function writeReviewHtml(input: {
  cwd: string;
  plan: LowPlan;
  results: Gi088ResponseFirstV2LowCallResult[];
}) {
  const dataset = await loadGi088ResponseFirstV2Cases(input.cwd);
  const cards = input.results.map((result) => {
    const item = dataset.cases.find((candidate) => candidate.caseId === result.caseId)!;
    const transcript = item.turnInput.conversation
      .map((message) => `<p><strong>${message.role === "user" ? "用户" : "AI"}</strong>：${escapeHtml(message.content)}</p>`)
      .join("\n");
    return `<article class="card" data-case-id="${result.caseId}"><p class="eyebrow">${result.caseId} · ${result.totalLatencyMs ?? "-"}ms</p><h2>${escapeHtml(item.title)}</h2><details><summary>查看完整上下文</summary>${transcript}</details><h3>Low 首段</h3><p class="answer">${escapeHtml(result.rawOutput ?? "")}</p><p class="rubric">期待：${escapeHtml(item.expectedBehavior)}</p><div class="choices"><button data-verdict="pass">通过</button><button data-verdict="minor">轻微问题</button><button data-verdict="fail">失败</button></div><textarea placeholder="评价原因"></textarea></article>`;
  }).join("\n");
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GI-088 回应优先 v2 · Low 六卡</title><style>:root{font-family:ui-sans-serif,system-ui;background:#f4f1ea;color:#211f1b}body{margin:0}.wrap{max-width:920px;margin:auto;padding:36px 20px 110px}.card{background:#fffdf8;border:1px solid #d8d1c4;border-radius:20px;padding:22px;margin:18px 0}.eyebrow,.rubric{color:#71695d;font-size:13px}.answer{font-size:18px;line-height:1.8}.choices{display:flex;gap:8px}.choices button,.copy{border:1px solid #867d70;border-radius:999px;background:transparent;padding:9px 15px}.choices button.selected{background:#27231e;color:#fff}textarea{box-sizing:border-box;width:100%;margin-top:10px;padding:10px}.copy{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#27231e;color:#fff}@media(prefers-color-scheme:dark){:root{background:#171612;color:#f5f0e5}.card{background:#24211b;border-color:#4b453a}}</style></head><body><main class="wrap"><h1>Low 首段六卡评审</h1><p>逐题判断承接质量。正文、上下文和评价只保存在本地私有边界。</p>${cards}</main><button class="copy">复制裁决 JSON</button><script>const seed=${JSON.stringify({ identity: input.plan.identity, planFingerprint: input.plan.planFingerprint })};const decisions={};document.querySelectorAll('.card').forEach(card=>{card.querySelectorAll('[data-verdict]').forEach(button=>button.addEventListener('click',()=>{card.querySelectorAll('[data-verdict]').forEach(item=>item.classList.remove('selected'));button.classList.add('selected');decisions[card.dataset.caseId]={caseId:card.dataset.caseId,verdict:button.dataset.verdict,note:card.querySelector('textarea').value}}));card.querySelector('textarea').addEventListener('input',()=>{if(decisions[card.dataset.caseId])decisions[card.dataset.caseId].note=card.querySelector('textarea').value})});document.querySelector('.copy').addEventListener('click',async()=>{const payload={...seed,reviewerRole:'product_owner',decisions:Object.values(decisions)};await navigator.clipboard.writeText(JSON.stringify(payload,null,2));document.querySelector('.copy').textContent='已复制 '+payload.decisions.length+'/6'});</script></body></html>`;
  const file = path.join(input.cwd, PRIVATE_REVIEW_HTML);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, html, { mode: 0o600 });
  await chmod(file, 0o600);
}

export function evaluateGi088ResponseFirstV2LowReview(input: {
  plan: LowPlan;
  results: Gi088ResponseFirstV2LowCallResult[];
  decisions: Gi088ResponseFirstV2LowReviewDecision[];
}) {
  const byCase = new Map(input.decisions.map((item) => [item.caseId, item]));
  const allCallsValid = input.results.length === 6 && input.results.every(
    (item) => item.status === "valid" && item.hard45sPassed
  );
  const hardIds = new Set(input.plan.gate.hardCases);
  const hardPassed = [...hardIds].every((caseId) => byCase.get(caseId)?.verdict === "pass");
  const softMinorCount = input.plan.gate.softCases.filter(
    (caseId) => byCase.get(caseId)?.verdict === "minor"
  ).length;
  const softFailed = input.plan.gate.softCases.some(
    (caseId) => byCase.get(caseId)?.verdict === "fail"
  );
  const completeReview = input.decisions.length === 6 && byCase.size === 6;
  const gatePassed = allCallsValid && completeReview && hardPassed && !softFailed && softMinorCount <= 1;
  return {
    status: gatePassed ? "low_quality_gate_passed" : "low_quality_gate_failed",
    gatePassed,
    allCallsValid,
    completeReview,
    hardPassed,
    softMinorCount,
    counts: {
      pass: input.decisions.filter((item) => item.verdict === "pass").length,
      minor: input.decisions.filter((item) => item.verdict === "minor").length,
      fail: input.decisions.filter((item) => item.verdict === "fail").length
    }
  };
}

async function prepare(cwd: string) {
  const plan = await createGi088ResponseFirstV2LowPlan(cwd);
  await writeJsonAtomic(path.join(cwd, PUBLIC_START), plan);
  return plan;
}

async function execute(cwd: string) {
  const plan = await prepare(cwd);
  loadEnvConfig(cwd, true);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  assert(apiKey, "GI088_RESPONSE_FIRST_V2_DEEPSEEK_API_KEY_MISSING");
  const provider = new OpenAIProvider({
    apiKey,
    model: GI088_RESPONSE_FIRST_V2_RUNTIME.model,
    baseUrl: "https://api.deepseek.com",
    timeoutMs: GI088_RESPONSE_FIRST_V2_RUNTIME.low.hardTimeoutMs
  });
  const ledger = await runGi088ResponseFirstV2LowCalls({ cwd, plan, provider });
  await writeReviewHtml({ cwd, plan, results: ledger.results });
  process.stdout.write(`${JSON.stringify({
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    status: ledger.status,
    consumedCalls: ledger.consumedCalls,
    publicReceipt: PUBLIC_RECEIPT,
    privateReview: PRIVATE_REVIEW_HTML
  }, null, 2)}\n`);
}

async function finalize(cwd: string) {
  const plan = JSON.parse(await readFile(path.join(cwd, PUBLIC_START), "utf8")) as LowPlan;
  const ledger = JSON.parse(await readFile(path.join(cwd, PRIVATE_LEDGER), "utf8")) as {
    results: Gi088ResponseFirstV2LowCallResult[];
  };
  ledger.results = ledger.results.map(normalizeGi088ResponseFirstV2LowResult);
  await saveLedger({ cwd, plan, results: ledger.results });
  const review = JSON.parse(await readFile(path.join(cwd, PRIVATE_REVIEW), "utf8")) as {
    identity: string;
    planFingerprint: string;
    decisions: Gi088ResponseFirstV2LowReviewDecision[];
  };
  assert(review.identity === plan.identity, "GI088_RESPONSE_FIRST_V2_LOW_REVIEW_IDENTITY_MISMATCH");
  assert(review.planFingerprint === plan.planFingerprint, "GI088_RESPONSE_FIRST_V2_LOW_REVIEW_PLAN_MISMATCH");
  const decision = evaluateGi088ResponseFirstV2LowReview({
    plan,
    results: ledger.results,
    decisions: review.decisions
  });
  const publicReceipt = JSON.parse(await readFile(path.join(cwd, PUBLIC_RECEIPT), "utf8")) as Record<string, unknown>;
  await writeJsonAtomic(path.join(cwd, PUBLIC_RECEIPT), {
    ...publicReceipt,
    status: decision.status,
    qualityDecision: {
      reviewerRole: "codex_provisional_product_review",
      ...decision,
      decisions: review.decisions.map((item) => ({
        caseId: item.caseId,
        verdict: item.verdict,
        noteHash: shaGi088ResponseFirstV2Fixture(item.note)
      }))
    }
  });
  const lines = [
    "# GI-088 回应优先 v2｜Low 六题质量门",
    "",
    `- 身份：\`${plan.identity}\``,
    `- 状态：\`${decision.status}\``,
    `- 调用：\`${ledger.results.length}/6\`，重试、恢复、降级均为 \`0\``,
    `- 技术与 45 秒硬门：\`${decision.allCallsValid ? "6/6" : "未通过"}\``,
    `- 内容裁决：\`${decision.counts.pass} pass / ${decision.counts.minor} minor / ${decision.counts.fail} fail\``,
    `- 下一步：${decision.gatePassed ? "进入追问信息增量 A/B" : "按停止门封存后续任务为 not_run"}`,
    "- 私有边界：用户正文、模型正文和评价原文保存在 Git 排除目录。"
  ];
  await writeFile(path.join(cwd, PUBLIC_HANDOFF), `${lines.join("\n")}\n`);
  process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
}

async function main() {
  const cwd = process.cwd();
  const envCommand = process.env.GI088_RESPONSE_FIRST_V2_LOW_COMMAND;
  const command = envCommand ?? process.argv[2] ?? "--prepare";
  if (command === "execute" || command === "--execute") return execute(cwd);
  if (command === "finalize" || command === "--finalize") return finalize(cwd);
  const plan = await prepare(cwd);
  process.stdout.write(`${JSON.stringify({
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    status: plan.status,
    budget: plan.budget,
    publicStartCard: PUBLIC_START
  }, null, 2)}\n`);
}

if (
  process.env.VITEST !== "true" &&
  (process.env.GI088_RESPONSE_FIRST_V2_LOW_COMMAND ||
    (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(RUNNER_FILE)))
) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
