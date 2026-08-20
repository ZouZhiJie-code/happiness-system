import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  GI088_RESPONSE_FIRST_V22_RUNTIME,
  createGi088ResponseFirstV22Identity,
  createGi088ResponseFirstV22LowUserPrompt,
  getGi088ResponseFirstV22LowSystemPrompt,
  parseGi088ResponseFirstV22LowOutput,
  validateGi088ResponseFirstV22LowOutput
} from "../evals/event-centered-generative/gi088-response-first-v2-2/candidate";
import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAIProviderDiagnostics,
  type AICompletionParams,
  type AIProvider,
  type AIProviderDiagnostics
} from "../src/server/services/ai/ai-provider";
import { OpenAIProvider } from "../src/server/services/ai/openai.provider";
import {
  GI088_RESPONSE_FIRST_V22_ROOT,
  loadGi088ResponseFirstV22Cases,
  type Gi088ResponseFirstV22Case,
  type Gi088ResponseFirstV22CaseId
} from "./gi088-response-first-v2-2-fixtures";
import { shaGi088ResponseFirstV2Fixture } from "./gi088-response-first-v2-fixtures";

export const GI088_RESPONSE_FIRST_V22_LOW_QUALITY_IDENTITY =
  "2026-08-17.gi088-response-first-v2-2-low-quality-v1" as const;

export const GI088_RESPONSE_FIRST_V22_STANDARD_SHA256 =
  "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60" as const;

export const GI088_RESPONSE_FIRST_V22_CHECKPOINT_CASE_IDS = [
  "RPR-REAL-19-CORRECTION",
  "RPR-REAL-19-CONTINUE",
  "RPR-REAL-13"
] as const;

type LowPhase = "checkpoint" | "full";

const PRIVATE_ROOT =
  `${GI088_RESPONSE_FIRST_V22_ROOT}/.private/response-first-v2-2/low-quality-v1`;
const PRIVATE_LEDGER = `${PRIVATE_ROOT}/ledger.json`;
const PRIVATE_CHECKPOINT_REVIEW = `${PRIVATE_ROOT}/codex-checkpoint-review.json`;
const PRIVATE_FULL_REVIEW = `${PRIVATE_ROOT}/codex-full-review.json`;
const PRIVATE_PRODUCT_REVIEW = `${PRIVATE_ROOT}/product-owner-review.json`;
const PRIVATE_REVIEW_HTML = `${PRIVATE_ROOT}/review.html`;
const PUBLIC_START =
  `${GI088_RESPONSE_FIRST_V22_ROOT}/response-first-v2-2-low-quality-v1-start-card.json`;
const PUBLIC_RECEIPT =
  `${GI088_RESPONSE_FIRST_V22_ROOT}/response-first-v2-2-low-quality-v1-receipt.json`;
const PUBLIC_HANDOFF =
  `${GI088_RESPONSE_FIRST_V22_ROOT}/response-first-v2-2-low-quality-v1-handoff.md`;
const RUNNER_FILE = "scripts/run-gi088-response-first-v2-2-low-quality.ts";

const FILES = {
  standard: "docs/ai-evaluation-standard.md",
  plan: "docs/plans/2026-08-17-gi088-response-first-v2-2-v2-3-factual-low-grounded-high.md",
  candidate:
    "evals/event-centered-generative/gi088-response-first-v2-2/candidate.ts",
  parentCandidate:
    "evals/event-centered-generative/gi088-response-first-v2-1/candidate.ts",
  fixtures: "scripts/gi088-response-first-v2-2-fixtures.ts",
  parentFixtures: "scripts/gi088-response-first-v2-1-fixtures.ts",
  provider: "src/server/services/ai/openai.provider.ts",
  providerContract: "src/server/services/ai/ai-provider.ts",
  runner: RUNNER_FILE
} as const;

export type Gi088ResponseFirstV22LowCallResult = {
  phase: LowPhase;
  order: number;
  caseId: Gi088ResponseFirstV22CaseId;
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

export type Gi088ResponseFirstV22LowReviewDecision = {
  caseId: Gi088ResponseFirstV22CaseId;
  verdict: "pass" | "minor" | "fail";
  note: string;
};

type LowPlan = Awaited<ReturnType<typeof createGi088ResponseFirstV22LowPlan>>;

type PrivateLedger = {
  identity: string;
  planFingerprint: string;
  preflight: {
    checkedAt: string;
    httpStatus: number;
    targetModelAvailable: boolean;
    modelListHash: string;
  } | null;
  checkpointResults: Gi088ResponseFirstV22LowCallResult[];
  fullResults: Gi088ResponseFirstV22LowCallResult[];
  checkpointDecision: ReturnType<typeof evaluateGi088ResponseFirstV22LowReview> | null;
  fullCodexDecision: ReturnType<typeof evaluateGi088ResponseFirstV22LowReview> | null;
  productDecision: ReturnType<typeof evaluateGi088ResponseFirstV22LowReview> | null;
};

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
    .update(
      typeof value === "string" || Buffer.isBuffer(value)
        ? value
        : JSON.stringify(canonicalize(value))
    )
    .digest("hex");
}

async function fileSha(cwd: string, relativePath: string) {
  return sha(await readFile(path.join(cwd, relativePath)));
}

async function writeJsonAtomic(file: string, value: unknown, privateFile = false) {
  await mkdir(path.dirname(file), {
    recursive: true,
    mode: privateFile ? 0o700 : 0o755
  });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: privateFile ? 0o600 : 0o644
  });
  await rename(temporary, file);
  if (privateFile) await chmod(file, 0o600);
}

function requestForCase(item: Gi088ResponseFirstV22Case) {
  const runtime = GI088_RESPONSE_FIRST_V22_RUNTIME.low;
  return {
    messages: [
      {
        role: "system" as const,
        content: getGi088ResponseFirstV22LowSystemPrompt()
      },
      {
        role: "user" as const,
        content: createGi088ResponseFirstV22LowUserPrompt(item.turnInput)
      }
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

function planCases(
  phase: LowPhase,
  dataset: Awaited<ReturnType<typeof loadGi088ResponseFirstV22Cases>>
) {
  const selected = phase === "checkpoint"
    ? GI088_RESPONSE_FIRST_V22_CHECKPOINT_CASE_IDS.map((caseId) =>
        dataset.cases.find((item) => item.caseId === caseId)
      )
    : dataset.cases;
  return selected.map((item, index) => {
    assert(item, `GI088_RESPONSE_FIRST_V22_PLAN_CASE_MISSING:${phase}:${index}`);
    return {
      order: index + 1,
      caseId: item.caseId,
      sourceCaseId: item.sourceCaseId,
      sourceFingerprint: item.sourceFingerprint,
      hardGate: item.hardGate,
      requestFingerprint: sha(requestForCase(item))
    };
  });
}

export async function createGi088ResponseFirstV22LowPlan(
  cwd = process.cwd()
) {
  const standardSha256 = await fileSha(cwd, FILES.standard);
  assert(
    standardSha256 === GI088_RESPONSE_FIRST_V22_STANDARD_SHA256,
    "STANDARD_SHA256_MISMATCH"
  );
  const dataset = await loadGi088ResponseFirstV22Cases(cwd);
  const identity = createGi088ResponseFirstV22Identity();
  const inputHashes = Object.fromEntries(
    await Promise.all(
      Object.entries(FILES).map(async ([key, relativePath]) => [
        `${key}Sha256`,
        await fileSha(cwd, relativePath)
      ])
    )
  );
  const core = {
    schemaVersion: "1.0",
    identity: GI088_RESPONSE_FIRST_V22_LOW_QUALITY_IDENTITY,
    status: "ready_authorized_waiting_checkpoint",
    productDecision:
      "whether_low_v2_2_repairs_completeness_correction_timing_and_grounding_without_losing_speed",
    candidateIdentity: identity,
    dataset: {
      version: dataset.datasetVersion,
      fingerprint: dataset.datasetFingerprint,
      parentVersion: dataset.parentDatasetVersion,
      parentFingerprint: dataset.parentDatasetFingerprint,
      privacyLevel: "private_sensitive",
      caseCount: dataset.cases.length
    },
    phases: {
      checkpoint: planCases("checkpoint", dataset),
      full: planCases("full", dataset)
    },
    runtime: {
      provider: GI088_RESPONSE_FIRST_V22_RUNTIME.provider,
      baseUrlHost: GI088_RESPONSE_FIRST_V22_RUNTIME.baseUrlHost,
      model: GI088_RESPONSE_FIRST_V22_RUNTIME.model,
      ...GI088_RESPONSE_FIRST_V22_RUNTIME.low,
      concurrency: 1,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    inputHashes,
    budget: {
      checkpointAuthorized: 3,
      fullAuthorized: 6,
      totalAuthorized: 9,
      technicalReplacementCalls: 0,
      retries: 0,
      recovery: 0,
      fallback: 0,
      authorizationSource:
        "confirmed_response_first_v2_2_v2_3_factual_low_grounded_high_plan"
    },
    gate: {
      checkpoint: {
        technicalAndContractValid: "3/3",
        hard45s: "3/3",
        singleTargetMs: 15_000,
        medianTargetMs: 6_000,
        contentVerdict: "3_pass_0_minor_0_fail"
      },
      full: {
        technicalAndContractValid: "6/6",
        hard45s: "6/6",
        singleTargetMs: 15_000,
        medianTargetMs: 6_000,
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
      }
    },
    stopPoint:
      "v22_checkpoint_must_pass_contract_content_median6s_and_single15s_before_full_or_v23"
  } as const;
  return { ...core, planFingerprint: sha(core) };
}

function emptyLedger(plan: LowPlan): PrivateLedger {
  return {
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    preflight: null,
    checkpointResults: [],
    fullResults: [],
    checkpointDecision: null,
    fullCodexDecision: null,
    productDecision: null
  };
}

async function readLedger(cwd: string, plan: LowPlan) {
  const ledger = await readFile(path.join(cwd, PRIVATE_LEDGER), "utf8")
    .then((source) => JSON.parse(source) as PrivateLedger)
    .catch(() => emptyLedger(plan));
  assert(ledger.identity === plan.identity, "GI088_RESPONSE_FIRST_V22_LEDGER_IDENTITY_MISMATCH");
  assert(
    ledger.planFingerprint === plan.planFingerprint,
    "GI088_RESPONSE_FIRST_V22_LEDGER_PLAN_MISMATCH"
  );
  return ledger;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function sanitizePublicResult(result: Gi088ResponseFirstV22LowCallResult) {
  return {
    phase: result.phase,
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
    finishReason: result.diagnostics?.finishReason ?? null,
    reasoningTokens: result.diagnostics?.reasoningTokens ?? null,
    tokenUsage: result.diagnostics?.tokenUsage ?? null,
    responseModel: result.diagnostics?.responseModel ?? null,
    httpStatus: result.diagnostics?.httpStatus ?? null
  };
}

function phaseNotRun(plan: LowPlan, ledger: PrivateLedger, phase: LowPhase) {
  const results = phase === "checkpoint"
    ? ledger.checkpointResults
    : ledger.fullResults;
  const completed = new Set(results.map((item) => item.order));
  return plan.phases[phase]
    .filter((item) => !completed.has(item.order))
    .map((item) => ({
      phase,
      order: item.order,
      caseId: item.caseId,
      status: "not_run" as const
    }));
}

function receiptStatus(plan: LowPlan, ledger: PrivateLedger) {
  const checkpointNotRun = phaseNotRun(plan, ledger, "checkpoint");
  const fullNotRun = phaseNotRun(plan, ledger, "full");
  const checkpointFailure = ledger.checkpointResults.some(
    (item) => item.status !== "valid" || !item.hard45sPassed
  );
  const fullFailure = ledger.fullResults.some(
    (item) => item.status !== "valid" || !item.hard45sPassed
  );
  if (ledger.productDecision) {
    return ledger.productDecision.gatePassed
      ? "low_quality_gate_passed"
      : "low_quality_gate_failed_by_product_owner";
  }
  if (ledger.fullCodexDecision) {
    return ledger.fullCodexDecision.gatePassed
      ? "waiting_product_owner_review"
      : "low_quality_gate_failed_by_codex_review";
  }
  if (fullFailure) return "stopped_by_full_hard_gate";
  if (ledger.fullResults.length === plan.phases.full.length) {
    return "full_calls_complete_waiting_codex_review";
  }
  if (ledger.checkpointDecision?.gatePassed) {
    return fullNotRun.length === plan.phases.full.length
      ? "checkpoint_passed_ready_for_full"
      : "full_running";
  }
  if (checkpointFailure) return "stopped_by_checkpoint_hard_gate";
  if (checkpointNotRun.length === 0) {
    return "checkpoint_calls_complete_waiting_codex_review";
  }
  return ledger.checkpointResults.length > 0
    ? "checkpoint_running"
    : "ready_authorized_waiting_checkpoint";
}

async function saveLedger(cwd: string, plan: LowPlan, ledger: PrivateLedger) {
  await writeJsonAtomic(path.join(cwd, PRIVATE_LEDGER), ledger, true);
  const allResults = [
    ...ledger.checkpointResults,
    ...ledger.fullResults
  ];
  const checkpointLatencies = ledger.checkpointResults.flatMap((item) =>
    item.totalLatencyMs === null ? [] : [item.totalLatencyMs]
  );
  const fullLatencies = ledger.fullResults.flatMap((item) =>
    item.totalLatencyMs === null ? [] : [item.totalLatencyMs]
  );
  await writeJsonAtomic(path.join(cwd, PUBLIC_RECEIPT), {
    schemaVersion: "1.0",
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    candidateFingerprint: plan.candidateIdentity.candidateFingerprint,
    datasetFingerprint: plan.dataset.fingerprint,
    status: receiptStatus(plan, ledger),
    preflight: ledger.preflight,
    budget: {
      authorized: 9,
      consumed: allResults.length,
      notRun: 9 - allResults.length,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    phases: {
      checkpoint: {
        consumed: ledger.checkpointResults.length,
        notRun: phaseNotRun(plan, ledger, "checkpoint").length,
        medianLatencyMs: median(checkpointLatencies),
        decision: ledger.checkpointDecision,
        results: ledger.checkpointResults.map(sanitizePublicResult)
      },
      full: {
        consumed: ledger.fullResults.length,
        notRun: phaseNotRun(plan, ledger, "full").length,
        medianLatencyMs: median(fullLatencies),
        codexDecision: ledger.fullCodexDecision,
        productDecision: ledger.productDecision,
        results: ledger.fullResults.map(sanitizePublicResult)
      }
    },
    privateBoundary: {
      rawInputsOutputsAndReviews: "git_ignored_private_directory",
      publicReceiptContainsUserOrModelBody: false
    }
  });
  return ledger;
}

async function checkTargetModel(apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://api.deepseek.com/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: controller.signal
    });
    const source = await response.text();
    assert(response.ok, `GI088_RESPONSE_FIRST_V22_MODEL_LIST_HTTP_${response.status}`);
    const payload = JSON.parse(source) as { data?: Array<{ id?: unknown }> };
    const modelIds = (payload.data ?? []).flatMap((item) =>
      typeof item.id === "string" ? [item.id] : []
    );
    assert(
      modelIds.includes(GI088_RESPONSE_FIRST_V22_RUNTIME.model),
      "GI088_RESPONSE_FIRST_V22_TARGET_MODEL_UNAVAILABLE"
    );
    return {
      checkedAt: new Date().toISOString(),
      httpStatus: response.status,
      targetModelAvailable: true,
      modelListHash: sha(modelIds.sort())
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runCall(input: {
  phase: LowPhase;
  entry: LowPlan["phases"][LowPhase][number];
  item: Gi088ResponseFirstV22Case;
  provider: AIProvider;
}) {
  const request = requestForCase(input.item);
  assert(
    sha(request) === input.entry.requestFingerprint,
    `GI088_RESPONSE_FIRST_V22_LOW_REQUEST_DRIFT:${input.phase}:${input.entry.caseId}`
  );
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let rawOutput = "";
  let diagnostics: AIProviderDiagnostics | null = null;
  try {
    assert(input.provider.stream, "GI088_RESPONSE_FIRST_V22_LOW_STREAM_UNAVAILABLE");
    for await (const chunk of input.provider.stream({
      ...request,
      onStreamDiagnostics: (value) => {
        diagnostics = value;
      }
    })) {
      rawOutput += chunk;
    }
    const safeDiagnostics = sanitizeAIProviderDiagnostics(diagnostics);
    const totalLatencyMs = safeDiagnostics?.totalLatencyMs ??
      Math.max(0, Date.now() - startedMs);
    try {
      const output = parseGi088ResponseFirstV22LowOutput(rawOutput);
      const validationIssues = validateGi088ResponseFirstV22LowOutput(output);
      if (
        safeDiagnostics?.responseModel &&
        safeDiagnostics.responseModel !== GI088_RESPONSE_FIRST_V22_RUNTIME.model
      ) {
        validationIssues.push(
          `RESPONSE_MODEL_MISMATCH:${safeDiagnostics.responseModel}`
        );
      }
      if (safeDiagnostics?.finishReason === "length") {
        validationIssues.push("LOW_OUTPUT_TRUNCATED_BY_TOKEN_LIMIT");
      }
      const status = validationIssues.length === 0
        ? "valid" as const
        : "contract_failure" as const;
      return {
        phase: input.phase,
        order: input.entry.order,
        caseId: input.entry.caseId,
        status,
        startedAt,
        completedAt: new Date().toISOString(),
        requestFingerprint: input.entry.requestFingerprint,
        responseHash: sha(rawOutput),
        responseLength: rawOutput.length,
        rawOutput,
        validationIssues: [...new Set(validationIssues)],
        errorCode: status === "valid"
          ? null
          : "GI088_RESPONSE_FIRST_V22_LOW_CONTRACT_INVALID",
        headersLatencyMs: safeDiagnostics?.headersLatencyMs ?? null,
        firstTokenLatencyMs: safeDiagnostics?.firstTokenLatencyMs ?? null,
        bodyLatencyMs: safeDiagnostics?.bodyLatencyMs ?? null,
        totalLatencyMs,
        target15sPassed: status === "valid" && totalLatencyMs <= 15_000,
        hard45sPassed: status === "valid" && totalLatencyMs <= 45_000,
        diagnostics: safeDiagnostics
      } satisfies Gi088ResponseFirstV22LowCallResult;
    } catch (error) {
      return {
        phase: input.phase,
        order: input.entry.order,
        caseId: input.entry.caseId,
        status: "contract_failure" as const,
        startedAt,
        completedAt: new Date().toISOString(),
        requestFingerprint: input.entry.requestFingerprint,
        responseHash: rawOutput ? sha(rawOutput) : null,
        responseLength: rawOutput.length,
        rawOutput,
        validationIssues: [
          error instanceof Error ? error.message : "LOW_PARSE_FAILED"
        ],
        errorCode: "GI088_RESPONSE_FIRST_V22_LOW_PARSE_FAILED",
        headersLatencyMs: safeDiagnostics?.headersLatencyMs ?? null,
        firstTokenLatencyMs: safeDiagnostics?.firstTokenLatencyMs ?? null,
        bodyLatencyMs: safeDiagnostics?.bodyLatencyMs ?? null,
        totalLatencyMs,
        target15sPassed: false,
        hard45sPassed: false,
        diagnostics: safeDiagnostics
      } satisfies Gi088ResponseFirstV22LowCallResult;
    }
  } catch (error) {
    const safeDiagnostics = sanitizeAIProviderDiagnostics(
      diagnostics ?? getAIProviderDiagnostics(error)
    );
    return {
      phase: input.phase,
      order: input.entry.order,
      caseId: input.entry.caseId,
      status: "technical_failure" as const,
      startedAt,
      completedAt: new Date().toISOString(),
      requestFingerprint: input.entry.requestFingerprint,
      responseHash: rawOutput ? sha(rawOutput) : null,
      responseLength: rawOutput.length,
      rawOutput: rawOutput || null,
      validationIssues: [],
      errorCode: getAIProviderFailureCode(error),
      headersLatencyMs: safeDiagnostics?.headersLatencyMs ?? null,
      firstTokenLatencyMs: safeDiagnostics?.firstTokenLatencyMs ?? null,
      bodyLatencyMs: safeDiagnostics?.bodyLatencyMs ?? null,
      totalLatencyMs: safeDiagnostics?.totalLatencyMs ??
        Math.max(0, Date.now() - startedMs),
      target15sPassed: false,
      hard45sPassed: false,
      diagnostics: safeDiagnostics
    } satisfies Gi088ResponseFirstV22LowCallResult;
  }
}

export async function runGi088ResponseFirstV22LowPhase(input: {
  cwd?: string;
  workspaceRoot?: string;
  phase: LowPhase;
  plan: LowPlan;
  provider: AIProvider;
}) {
  const cwd = input.cwd ?? process.cwd();
  const ledger = await readLedger(cwd, input.plan);
  const existing = input.phase === "checkpoint"
    ? ledger.checkpointResults
    : ledger.fullResults;
  if (existing.length === input.plan.phases[input.phase].length) {
    return saveLedger(cwd, input.plan, ledger);
  }
  assert(
    existing.length === 0,
    `GI088_RESPONSE_FIRST_V22_PARTIAL_${input.phase.toUpperCase()}_REQUIRES_AUDIT`
  );
  if (input.phase === "full") {
    assert(
      ledger.checkpointDecision?.gatePassed,
      "GI088_RESPONSE_FIRST_V22_CHECKPOINT_NOT_PASSED"
    );
  }
  const dataset = await loadGi088ResponseFirstV22Cases(
    input.workspaceRoot ?? process.cwd()
  );
  for (const entry of input.plan.phases[input.phase]) {
    const item = dataset.cases.find(
      (candidate) => candidate.caseId === entry.caseId
    );
    assert(item, `GI088_RESPONSE_FIRST_V22_LOW_CASE_LOST:${entry.caseId}`);
    const result = await runCall({
      phase: input.phase,
      entry,
      item,
      provider: input.provider
    });
    if (input.phase === "checkpoint") ledger.checkpointResults.push(result);
    else ledger.fullResults.push(result);
    await saveLedger(cwd, input.plan, ledger);
    if (result.status !== "valid" || !result.hard45sPassed) break;
  }
  return saveLedger(cwd, input.plan, ledger);
}

export function evaluateGi088ResponseFirstV22LowReview(input: {
  phase: LowPhase;
  plan: LowPlan;
  results: Gi088ResponseFirstV22LowCallResult[];
  decisions: Gi088ResponseFirstV22LowReviewDecision[];
}) {
  const expected = input.plan.phases[input.phase];
  const expectedIds = new Set(expected.map((item) => item.caseId));
  const byCase = new Map(input.decisions.map((item) => [item.caseId, item]));
  const completeReview = input.decisions.length === expected.length &&
    byCase.size === expected.length &&
    input.decisions.every((item) => expectedIds.has(item.caseId));
  const allCallsValid = input.results.length === expected.length &&
    input.results.every(
      (item) => item.status === "valid" && item.target15sPassed && item.hard45sPassed
    );
  const latencies = input.results.flatMap((item) =>
    item.totalLatencyMs === null ? [] : [item.totalLatencyMs]
  );
  const medianLatencyMs = median(latencies);
  const medianTargetPassed = medianLatencyMs !== null && medianLatencyMs <= 6_000;
  const allDirectPassed = expected.every(
    (item) => byCase.get(item.caseId)?.verdict === "pass"
  );
  const hardIds = new Set(input.plan.gate.full.hardCases);
  const hardPassed = input.phase === "checkpoint"
    ? allDirectPassed
    : [...hardIds].every(
        (caseId) => byCase.get(caseId)?.verdict === "pass"
      );
  const softMinorCount = input.phase === "full"
    ? input.plan.gate.full.softCases.filter(
        (caseId) => byCase.get(caseId)?.verdict === "minor"
      ).length
    : 0;
  const softFailed = input.phase === "full" &&
    input.plan.gate.full.softCases.some(
      (caseId) => byCase.get(caseId)?.verdict === "fail"
    );
  const contentPassed = input.phase === "checkpoint"
    ? allDirectPassed
    : hardPassed && !softFailed && softMinorCount <= 1;
  const gatePassed = allCallsValid && completeReview && contentPassed &&
    medianTargetPassed;
  return {
    phase: input.phase,
    status: gatePassed
      ? `${input.phase}_quality_gate_passed`
      : `${input.phase}_quality_gate_failed`,
    gatePassed,
    allCallsValid,
    completeReview,
    contentPassed,
    hardPassed,
    softMinorCount,
    medianLatencyMs,
    medianTargetPassed,
    counts: {
      pass: input.decisions.filter((item) => item.verdict === "pass").length,
      minor: input.decisions.filter((item) => item.verdict === "minor").length,
      fail: input.decisions.filter((item) => item.verdict === "fail").length
    }
  };
}

async function readReview(file: string, plan: LowPlan) {
  const review = JSON.parse(await readFile(file, "utf8")) as {
    identity: string;
    planFingerprint: string;
    decisions: Gi088ResponseFirstV22LowReviewDecision[];
  };
  assert(review.identity === plan.identity, "GI088_RESPONSE_FIRST_V22_REVIEW_IDENTITY_MISMATCH");
  assert(
    review.planFingerprint === plan.planFingerprint,
    "GI088_RESPONSE_FIRST_V22_REVIEW_PLAN_MISMATCH"
  );
  return review;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function writeProductReviewHtml(input: {
  cwd: string;
  plan: LowPlan;
  results: Gi088ResponseFirstV22LowCallResult[];
}) {
  const dataset = await loadGi088ResponseFirstV22Cases(input.cwd);
  const cards = input.results.map((result) => {
    const item = dataset.cases.find(
      (candidate) => candidate.caseId === result.caseId
    )!;
    const transcript = item.turnInput.conversation
      .map((message) =>
        `<p><strong>${message.role === "user" ? "用户" : "AI"}</strong>：${escapeHtml(message.content)}</p>`
      )
      .join("\n");
    return `<article class="card" data-case-id="${result.caseId}"><p class="eyebrow">${result.caseId} · ${result.totalLatencyMs ?? "-"}ms</p><h2>${escapeHtml(item.title)}</h2><details><summary>查看完整上下文</summary>${transcript}</details><h3>Low 首段</h3><p class="answer">${escapeHtml(result.rawOutput ?? "")}</p><p class="rubric">期待：${escapeHtml(item.expectedBehavior)}</p><div class="choices"><button data-verdict="pass">通过</button><button data-verdict="minor">轻微问题</button><button data-verdict="fail">失败</button></div><textarea placeholder="评价原因"></textarea></article>`;
  }).join("\n");
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GI-088 回应优先 v2.1 · Low 六卡</title><style>:root{font-family:ui-sans-serif,system-ui;background:#f4f1ea;color:#211f1b}body{margin:0}.wrap{max-width:920px;margin:auto;padding:36px 20px 110px}.card{background:#fffdf8;border:1px solid #d8d1c4;border-radius:20px;padding:22px;margin:18px 0}.eyebrow,.rubric{color:#71695d;font-size:13px}.answer{font-size:18px;line-height:1.8}.choices{display:flex;gap:8px}.choices button,.copy{border:1px solid #867d70;border-radius:999px;background:transparent;padding:9px 15px}.choices button.selected{background:#27231e;color:#fff}textarea{box-sizing:border-box;width:100%;margin-top:10px;padding:10px}.copy{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#27231e;color:#fff}@media(prefers-color-scheme:dark){:root{background:#171612;color:#f5f0e5}.card{background:#24211b;border-color:#4b453a}}</style></head><body><main class="wrap"><h1>Low v2.1 首段六卡评审</h1><p>逐题判断承接质量。正文、上下文和评价只保存在本地私有边界。</p>${cards}</main><button class="copy">复制裁决 JSON</button><script>const seed=${JSON.stringify({ identity: input.plan.identity, planFingerprint: input.plan.planFingerprint })};const decisions={};document.querySelectorAll('.card').forEach(card=>{card.querySelectorAll('[data-verdict]').forEach(button=>button.addEventListener('click',()=>{card.querySelectorAll('[data-verdict]').forEach(item=>item.classList.remove('selected'));button.classList.add('selected');decisions[card.dataset.caseId]={caseId:card.dataset.caseId,verdict:button.dataset.verdict,note:card.querySelector('textarea').value}}));card.querySelector('textarea').addEventListener('input',()=>{if(decisions[card.dataset.caseId])decisions[card.dataset.caseId].note=card.querySelector('textarea').value})});document.querySelector('.copy').addEventListener('click',async()=>{const payload={...seed,reviewerRole:'product_owner',decisions:Object.values(decisions)};await navigator.clipboard.writeText(JSON.stringify(payload,null,2));document.querySelector('.copy').textContent='已复制 '+payload.decisions.length+'/6'});</script></body></html>`;
  const file = path.join(input.cwd, PRIVATE_REVIEW_HTML);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, html, { mode: 0o600 });
  await chmod(file, 0o600);
}

async function prepare(cwd: string) {
  const plan = await createGi088ResponseFirstV22LowPlan(cwd);
  await writeJsonAtomic(path.join(cwd, PUBLIC_START), plan);
  return plan;
}

async function providerForExecution(cwd: string, plan: LowPlan) {
  loadEnvConfig(cwd, true);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  assert(apiKey, "GI088_RESPONSE_FIRST_V22_DEEPSEEK_API_KEY_MISSING");
  const ledger = await readLedger(cwd, plan);
  if (!ledger.preflight) {
    ledger.preflight = await checkTargetModel(apiKey);
    await saveLedger(cwd, plan, ledger);
  }
  return new OpenAIProvider({
    apiKey,
    model: GI088_RESPONSE_FIRST_V22_RUNTIME.model,
    baseUrl: "https://api.deepseek.com",
    timeoutMs: GI088_RESPONSE_FIRST_V22_RUNTIME.low.hardTimeoutMs
  });
}

async function executePhase(cwd: string, phase: LowPhase) {
  const plan = await prepare(cwd);
  const provider = await providerForExecution(cwd, plan);
  const ledger = await runGi088ResponseFirstV22LowPhase({
    cwd,
    workspaceRoot: cwd,
    phase,
    plan,
    provider
  });
  process.stdout.write(`${JSON.stringify({
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    status: receiptStatus(plan, ledger),
    checkpointCalls: ledger.checkpointResults.length,
    fullCalls: ledger.fullResults.length,
    publicReceipt: PUBLIC_RECEIPT
  }, null, 2)}\n`);
}

async function finalizeCheckpoint(cwd: string) {
  const plan = await prepare(cwd);
  const ledger = await readLedger(cwd, plan);
  const review = await readReview(
    path.join(cwd, PRIVATE_CHECKPOINT_REVIEW),
    plan
  );
  ledger.checkpointDecision = evaluateGi088ResponseFirstV22LowReview({
    phase: "checkpoint",
    plan,
    results: ledger.checkpointResults,
    decisions: review.decisions
  });
  await saveLedger(cwd, plan, ledger);
  process.stdout.write(`${JSON.stringify(ledger.checkpointDecision, null, 2)}\n`);
}

async function finalizeFullCodex(cwd: string) {
  const plan = await prepare(cwd);
  const ledger = await readLedger(cwd, plan);
  const review = await readReview(path.join(cwd, PRIVATE_FULL_REVIEW), plan);
  ledger.fullCodexDecision = evaluateGi088ResponseFirstV22LowReview({
    phase: "full",
    plan,
    results: ledger.fullResults,
    decisions: review.decisions
  });
  await saveLedger(cwd, plan, ledger);
  if (ledger.fullCodexDecision.gatePassed) {
    await writeProductReviewHtml({
      cwd,
      plan,
      results: ledger.fullResults
    });
  }
  const lines = [
    "# GI-088 回应优先 v2.1｜Low 六题质量门",
    "",
    `- 身份：\`${plan.identity}\``,
    `- 状态：\`${receiptStatus(plan, ledger)}\``,
    `- 调用：检查点 \`${ledger.checkpointResults.length}/3\`，完整六题 \`${ledger.fullResults.length}/6\`；重试、恢复、降级均为 \`0\``,
    `- 完整六题中位耗时：\`${ledger.fullCodexDecision.medianLatencyMs ?? "-"}ms\``,
    `- Codex 初评：\`${ledger.fullCodexDecision.counts.pass} pass / ${ledger.fullCodexDecision.counts.minor} minor / ${ledger.fullCodexDecision.counts.fail} fail\``,
    `- 下一步：${ledger.fullCodexDecision.gatePassed ? "等待产品负责人完成私有六卡质量裁决" : "按停止门封存后续任务为 not_run"}`,
    "- 私有边界：用户正文、模型正文和评价原文保存在 Git 排除目录。"
  ];
  await writeFile(path.join(cwd, PUBLIC_HANDOFF), `${lines.join("\n")}\n`);
  process.stdout.write(`${JSON.stringify({
    ...ledger.fullCodexDecision,
    privateReview: ledger.fullCodexDecision.gatePassed
      ? PRIVATE_REVIEW_HTML
      : null
  }, null, 2)}\n`);
}

async function finalizeProduct(cwd: string) {
  const plan = await prepare(cwd);
  const ledger = await readLedger(cwd, plan);
  assert(
    ledger.fullCodexDecision?.gatePassed,
    "GI088_RESPONSE_FIRST_V22_FULL_CODEX_GATE_NOT_PASSED"
  );
  const review = await readReview(path.join(cwd, PRIVATE_PRODUCT_REVIEW), plan);
  ledger.productDecision = evaluateGi088ResponseFirstV22LowReview({
    phase: "full",
    plan,
    results: ledger.fullResults,
    decisions: review.decisions
  });
  await saveLedger(cwd, plan, ledger);
  process.stdout.write(`${JSON.stringify(ledger.productDecision, null, 2)}\n`);
}

async function main() {
  const cwd = process.cwd();
  const command = process.env.GI088_RESPONSE_FIRST_V22_LOW_COMMAND ??
    process.argv[2] ?? "--prepare";
  if (command === "--execute-checkpoint") {
    return executePhase(cwd, "checkpoint");
  }
  if (command === "--finalize-checkpoint") return finalizeCheckpoint(cwd);
  if (command === "--execute-full") return executePhase(cwd, "full");
  if (command === "--finalize-full-codex") return finalizeFullCodex(cwd);
  if (command === "--finalize-product") return finalizeProduct(cwd);
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
  (process.env.GI088_RESPONSE_FIRST_V22_LOW_COMMAND ||
    (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(RUNNER_FILE)))
) {
  void main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}

export const GI088_RESPONSE_FIRST_V22_LOW_PATHS = {
  privateLedger: PRIVATE_LEDGER,
  privateCheckpointReview: PRIVATE_CHECKPOINT_REVIEW,
  privateFullReview: PRIVATE_FULL_REVIEW,
  privateProductReview: PRIVATE_PRODUCT_REVIEW,
  privateReviewHtml: PRIVATE_REVIEW_HTML,
  publicStart: PUBLIC_START,
  publicReceipt: PUBLIC_RECEIPT,
  publicHandoff: PUBLIC_HANDOFF
} as const;

export const shaGi088ResponseFirstV22Evidence =
  shaGi088ResponseFirstV2Fixture;
