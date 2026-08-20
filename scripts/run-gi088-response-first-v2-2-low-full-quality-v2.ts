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
  GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT,
  loadGi088ResponseFirstV22RubricV13Cases,
  type Gi088ResponseFirstV22RubricV13Case,
  type Gi088ResponseFirstV22RubricV13CaseId
} from "./gi088-response-first-v2-2-rubric-v1-3-fixtures";

export const GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_IDENTITY =
  "2026-08-17.gi088-response-first-v2-2-low-full-quality-v2" as const;
export const GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_STANDARD_SHA256 =
  "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60" as const;

const PRIVATE_ROOT =
  `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-2/low-full-quality-v2`;

export const GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_PATHS = {
  privateLedger: `${PRIVATE_ROOT}/ledger.json`,
  privateCodexReview: `${PRIVATE_ROOT}/codex-review.json`,
  privateProductReview: `${PRIVATE_ROOT}/product-owner-review.json`,
  privateReviewHtml: `${PRIVATE_ROOT}/review.html`,
  publicStartCard:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-2-low-full-quality-v2-start-card.json`,
  publicReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-2-low-full-quality-v2-receipt.json`,
  publicHandoff:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-2-low-full-quality-v2-handoff.md`
} as const;

const RUNNER_FILE =
  "scripts/run-gi088-response-first-v2-2-low-full-quality-v2.ts";
const FILES = {
  standard: "docs/ai-evaluation-standard.md",
  plan:
    "docs/plans/2026-08-17-gi088-response-first-v2-2-review-go-continuation.md",
  candidate:
    "evals/event-centered-generative/gi088-response-first-v2-2/candidate.ts",
  parentCandidate:
    "evals/event-centered-generative/gi088-response-first-v2-1/candidate.ts",
  fixtures: "scripts/gi088-response-first-v2-2-rubric-v1-3-fixtures.ts",
  parentFixtures: "scripts/gi088-response-first-v2-2-fixtures.ts",
  checkpointReview:
    "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-2-product-owner-checkpoint-review-v2.json",
  provider: "src/server/services/ai/openai.provider.ts",
  providerContract: "src/server/services/ai/ai-provider.ts",
  runner: RUNNER_FILE
} as const;

export type Gi088ResponseFirstV22LowFullV2CallResult = {
  order: number;
  caseId: Gi088ResponseFirstV22RubricV13CaseId;
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

export type Gi088ResponseFirstV22LowFullV2ReviewDecision = {
  caseId: Gi088ResponseFirstV22RubricV13CaseId;
  verdict: "pass" | "minor" | "fail";
  note: string;
};

type LowPlan = Awaited<ReturnType<typeof createGi088ResponseFirstV22LowFullV2Plan>>;
type ReviewSummary = ReturnType<typeof evaluateGi088ResponseFirstV22LowFullV2Review>;
type PrivateLedger = {
  identity: string;
  planFingerprint: string;
  preflight: {
    checkedAt: string;
    httpStatus: number;
    targetModelAvailable: boolean;
    modelListHash: string;
  } | null;
  results: Gi088ResponseFirstV22LowFullV2CallResult[];
  codexDecision: ReviewSummary | null;
  productDecision: ReviewSummary | null;
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

function requestForCase(item: Gi088ResponseFirstV22RubricV13Case) {
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

export async function createGi088ResponseFirstV22LowFullV2Plan(
  cwd = process.cwd()
) {
  const standardSha256 = await fileSha(cwd, FILES.standard);
  assert(
    standardSha256 === GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_STANDARD_SHA256,
    "STANDARD_SHA256_MISMATCH"
  );
  const dataset = await loadGi088ResponseFirstV22RubricV13Cases(cwd);
  const candidateIdentity = createGi088ResponseFirstV22Identity();
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
    identity: GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_IDENTITY,
    status: "ready_authorized_waiting_full_quality",
    productDecision:
      "whether_unchanged_v2_2_factual_low_passes_all_six_cases_under_the_latest_product_owner_rubric",
    historicalCheckpoint: {
      runIdentity: "2026-08-17.gi088-response-first-v2-2-low-quality-v1",
      productOwnerReview:
        "2026-08-17.gi088-response-first-v2-2-product-owner-checkpoint-review-v2",
      verdict: "3_pass_0_minor_0_fail",
      callsConsumed: 3
    },
    candidateIdentity,
    dataset: {
      version: dataset.datasetVersion,
      fingerprint: dataset.datasetFingerprint,
      parentVersion: dataset.parentDatasetVersion,
      parentFingerprint: dataset.parentDatasetFingerprint,
      privacyLevel: "private_sensitive",
      caseCount: dataset.cases.length,
      modelInputsChangedFromParent: false,
      evaluationMetadataChangedFromParent: true
    },
    cases,
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
      authorized: 6,
      technicalReplacementCalls: 0,
      retries: 0,
      recovery: 0,
      fallback: 0,
      continuationOfflineBudgetAuthorized: 15,
      authorizationSource:
        "confirmed_response_first_v2_2_review_go_continuation_plan"
    },
    reviewOrder: [
      "complete_relevant_user_and_assistant_context",
      "actual_low_output",
      "technical_status_and_latency",
      "codex_provisional_judgment",
      "product_owner_final_judgment"
    ],
    gate: {
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
      internalLeakCount: 0,
      semanticAuthority: "product_owner"
    },
    stopPoint:
      "wait_for_product_owner_low_six_card_decision_before_v23_or_integration"
  } as const;
  return { ...core, planFingerprint: sha(core) };
}

function emptyLedger(plan: LowPlan): PrivateLedger {
  return {
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    preflight: null,
    results: [],
    codexDecision: null,
    productDecision: null
  };
}

async function readLedger(cwd: string, plan: LowPlan) {
  const file = path.join(cwd, GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_PATHS.privateLedger);
  const ledger = await readFile(file, "utf8")
    .then((source) => JSON.parse(source) as PrivateLedger)
    .catch(() => emptyLedger(plan));
  assert(
    ledger.identity === plan.identity,
    "GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_LEDGER_IDENTITY_MISMATCH"
  );
  assert(
    ledger.planFingerprint === plan.planFingerprint,
    "GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_LEDGER_PLAN_MISMATCH"
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

function sanitizePublicResult(result: Gi088ResponseFirstV22LowFullV2CallResult) {
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
    finishReason: result.diagnostics?.finishReason ?? null,
    reasoningTokens: result.diagnostics?.reasoningTokens ?? null,
    tokenUsage: result.diagnostics?.tokenUsage ?? null,
    responseModel: result.diagnostics?.responseModel ?? null,
    httpStatus: result.diagnostics?.httpStatus ?? null
  };
}

function receiptStatus(plan: LowPlan, ledger: PrivateLedger) {
  if (ledger.productDecision) {
    return ledger.productDecision.gatePassed
      ? "low_quality_gate_passed_by_product_owner"
      : "low_quality_gate_failed_by_product_owner";
  }
  if (ledger.results.some((item) => item.status !== "valid" || !item.hard45sPassed)) {
    return "stopped_by_technical_or_contract_gate";
  }
  if (ledger.results.length === plan.cases.length) {
    return ledger.codexDecision
      ? "waiting_product_owner_review"
      : "full_calls_complete_waiting_codex_review";
  }
  return ledger.results.length > 0
    ? "full_quality_running"
    : "ready_authorized_waiting_full_quality";
}

async function saveLedger(cwd: string, plan: LowPlan, ledger: PrivateLedger) {
  await writeJsonAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_PATHS.privateLedger),
    ledger,
    true
  );
  const latencies = ledger.results.flatMap((item) =>
    item.totalLatencyMs === null ? [] : [item.totalLatencyMs]
  );
  await writeJsonAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_PATHS.publicReceipt),
    {
      schemaVersion: "1.0",
      identity: plan.identity,
      planFingerprint: plan.planFingerprint,
      candidateFingerprint: plan.candidateIdentity.candidateFingerprint,
      datasetFingerprint: plan.dataset.fingerprint,
      status: receiptStatus(plan, ledger),
      preflight: ledger.preflight,
      budget: {
        authorized: 6,
        consumed: ledger.results.length,
        notRun: 6 - ledger.results.length,
        retries: 0,
        recovery: 0,
        fallback: 0
      },
      medianLatencyMs: median(latencies),
      codexDecision: ledger.codexDecision,
      productDecision: ledger.productDecision,
      results: ledger.results.map(sanitizePublicResult),
      privateBoundary: {
        rawInputsOutputsAndReviews: "git_ignored_private_directory",
        reviewPresentationOrder: plan.reviewOrder,
        publicReceiptContainsUserOrModelBody: false
      }
    }
  );
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
    assert(
      response.ok,
      `GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_MODEL_LIST_HTTP_${response.status}`
    );
    const payload = JSON.parse(source) as { data?: Array<{ id?: unknown }> };
    const modelIds = (payload.data ?? []).flatMap((item) =>
      typeof item.id === "string" ? [item.id] : []
    );
    assert(
      modelIds.includes(GI088_RESPONSE_FIRST_V22_RUNTIME.model),
      "GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_TARGET_MODEL_UNAVAILABLE"
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
  entry: LowPlan["cases"][number];
  item: Gi088ResponseFirstV22RubricV13Case;
  provider: AIProvider;
}) {
  const request = requestForCase(input.item);
  assert(
    sha(request) === input.entry.requestFingerprint,
    `GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_REQUEST_DRIFT:${input.entry.caseId}`
  );
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let rawOutput = "";
  let diagnostics: AIProviderDiagnostics | null = null;
  try {
    assert(
      input.provider.stream,
      "GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_STREAM_UNAVAILABLE"
    );
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
          : "GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_CONTRACT_INVALID",
        headersLatencyMs: safeDiagnostics?.headersLatencyMs ?? null,
        firstTokenLatencyMs: safeDiagnostics?.firstTokenLatencyMs ?? null,
        bodyLatencyMs: safeDiagnostics?.bodyLatencyMs ?? null,
        totalLatencyMs,
        target15sPassed: status === "valid" && totalLatencyMs <= 15_000,
        hard45sPassed: status === "valid" && totalLatencyMs <= 45_000,
        diagnostics: safeDiagnostics
      } satisfies Gi088ResponseFirstV22LowFullV2CallResult;
    } catch (error) {
      return {
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
        errorCode: "GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_PARSE_FAILED",
        headersLatencyMs: safeDiagnostics?.headersLatencyMs ?? null,
        firstTokenLatencyMs: safeDiagnostics?.firstTokenLatencyMs ?? null,
        bodyLatencyMs: safeDiagnostics?.bodyLatencyMs ?? null,
        totalLatencyMs,
        target15sPassed: false,
        hard45sPassed: false,
        diagnostics: safeDiagnostics
      } satisfies Gi088ResponseFirstV22LowFullV2CallResult;
    }
  } catch (error) {
    const safeDiagnostics = sanitizeAIProviderDiagnostics(
      diagnostics ?? getAIProviderDiagnostics(error)
    );
    return {
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
    } satisfies Gi088ResponseFirstV22LowFullV2CallResult;
  }
}

export async function runGi088ResponseFirstV22LowFullV2(input: {
  cwd?: string;
  workspaceRoot?: string;
  plan: LowPlan;
  provider: AIProvider;
}) {
  const cwd = input.cwd ?? process.cwd();
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const ledger = await readLedger(cwd, input.plan);
  if (ledger.results.length === input.plan.cases.length) {
    return saveLedger(cwd, input.plan, ledger);
  }
  assert(
    ledger.results.length === 0,
    "GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_PARTIAL_RUN_REQUIRES_AUDIT"
  );
  const dataset = await loadGi088ResponseFirstV22RubricV13Cases(workspaceRoot);
  for (const entry of input.plan.cases) {
    const item = dataset.cases.find((candidate) => candidate.caseId === entry.caseId);
    assert(
      item,
      `GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_CASE_LOST:${entry.caseId}`
    );
    const result = await runCall({ entry, item, provider: input.provider });
    ledger.results.push(result);
    await saveLedger(cwd, input.plan, ledger);
    if (result.status !== "valid" || !result.hard45sPassed) break;
  }
  return saveLedger(cwd, input.plan, ledger);
}

export function evaluateGi088ResponseFirstV22LowFullV2Review(input: {
  plan: LowPlan;
  results: Gi088ResponseFirstV22LowFullV2CallResult[];
  decisions: Gi088ResponseFirstV22LowFullV2ReviewDecision[];
}) {
  const expectedIds = new Set(input.plan.cases.map((item) => item.caseId));
  const byCase = new Map(input.decisions.map((item) => [item.caseId, item]));
  const completeReview = input.decisions.length === input.plan.cases.length &&
    byCase.size === input.plan.cases.length &&
    input.decisions.every((item) => expectedIds.has(item.caseId));
  const allCallsValid = input.results.length === input.plan.cases.length &&
    input.results.every(
      (item) => item.status === "valid" && item.target15sPassed && item.hard45sPassed
    );
  const latencies = input.results.flatMap((item) =>
    item.totalLatencyMs === null ? [] : [item.totalLatencyMs]
  );
  const medianLatencyMs = median(latencies);
  const medianTargetPassed = medianLatencyMs !== null && medianLatencyMs <= 6_000;
  const hardPassed = input.plan.gate.hardCases.every(
    (caseId) => byCase.get(caseId)?.verdict === "pass"
  );
  const softMinorCount = input.plan.gate.softCases.filter(
    (caseId) => byCase.get(caseId)?.verdict === "minor"
  ).length;
  const softFailed = input.plan.gate.softCases.some(
    (caseId) => byCase.get(caseId)?.verdict === "fail"
  );
  const contentPassed = hardPassed && !softFailed && softMinorCount <= 1;
  const gatePassed = allCallsValid && completeReview && contentPassed &&
    medianTargetPassed;
  return {
    status: gatePassed ? "low_full_quality_gate_passed" : "low_full_quality_gate_failed",
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

async function readReview(file: string, plan: LowPlan, reviewerRole: string) {
  const review = JSON.parse(await readFile(file, "utf8")) as {
    identity: string;
    planFingerprint: string;
    reviewerRole: string;
    decisions: Gi088ResponseFirstV22LowFullV2ReviewDecision[];
  };
  assert(
    review.identity === plan.identity,
    "GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_REVIEW_IDENTITY_MISMATCH"
  );
  assert(
    review.planFingerprint === plan.planFingerprint,
    "GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_REVIEW_PLAN_MISMATCH"
  );
  assert(
    review.reviewerRole === reviewerRole,
    "GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_REVIEW_ROLE_MISMATCH"
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

export async function writeGi088ResponseFirstV22LowFullV2ReviewHtml(input: {
  cwd: string;
  workspaceRoot: string;
  plan: LowPlan;
  results: Gi088ResponseFirstV22LowFullV2CallResult[];
  codexDecisions: Gi088ResponseFirstV22LowFullV2ReviewDecision[];
}) {
  const dataset = await loadGi088ResponseFirstV22RubricV13Cases(
    input.workspaceRoot
  );
  const codexByCase = new Map(
    input.codexDecisions.map((item) => [item.caseId, item])
  );
  const cards = input.results.map((result) => {
    const item = dataset.cases.find((candidate) => candidate.caseId === result.caseId)!;
    const transcript = item.turnInput.conversation
      .map((message) =>
        `<p><strong>${message.role === "user" ? "用户" : "AI"}</strong>：${escapeHtml(message.content)}</p>`
      )
      .join("\n");
    const codex = codexByCase.get(result.caseId);
    return `<article class="card" data-case-id="${result.caseId}"><p class="eyebrow">${result.caseId}</p><h2>${escapeHtml(item.title)}</h2><section><h3>1. 完整相关原文</h3>${transcript}</section><section><h3>2. Low 实际输出</h3><p class="answer">${escapeHtml(result.rawOutput ?? "")}</p></section><section><h3>3. 技术事实</h3><p>${result.status} · ${result.totalLatencyMs ?? "-"}ms · finishReason=${result.diagnostics?.finishReason ?? "-"}</p></section><section><h3>4. Codex 初评</h3><p><strong>${codex?.verdict ?? "待评"}</strong>　${escapeHtml(codex?.note ?? "")}</p><details><summary>查看当前产品判尺</summary><p>${escapeHtml(item.expectedBehavior)}</p><ul>${item.prohibitedRisks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("")}</ul></details></section><section><h3>5. 产品负责人裁决</h3><div class="choices"><button data-verdict="pass">通过</button><button data-verdict="minor">轻微问题</button><button data-verdict="fail">失败</button></div><textarea placeholder="评价原因"></textarea></section></article>`;
  }).join("\n");
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GI-088 v2.2 Low 完整六题评审</title><style>:root{font-family:ui-sans-serif,system-ui;background:#f4f1ea;color:#211f1b}body{margin:0}.wrap{max-width:960px;margin:auto;padding:36px 20px 110px}.card{background:#fffdf8;border:1px solid #d8d1c4;border-radius:20px;padding:22px;margin:18px 0}.eyebrow{color:#71695d;font-size:13px}.answer{font-size:18px;line-height:1.8}.choices{display:flex;gap:8px}.choices button,.copy{border:1px solid #867d70;border-radius:999px;background:transparent;padding:9px 15px}.choices button.selected{background:#27231e;color:#fff}textarea{box-sizing:border-box;width:100%;margin-top:10px;padding:10px}.copy{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#27231e;color:#fff}section{border-top:1px solid #e7e0d4;padding-top:12px;margin-top:16px}@media(prefers-color-scheme:dark){:root{background:#171612;color:#f5f0e5}.card{background:#24211b;border-color:#4b453a}}</style></head><body><main class="wrap"><h1>v2.2 Low 完整六题</h1><p>每题依次阅读原文、实际输出、技术事实和 Codex 初评，再完成产品裁决。正文与评价只保存在本地私有边界。</p>${cards}</main><button class="copy">复制裁决 JSON</button><script>const seed=${JSON.stringify({ identity: input.plan.identity, planFingerprint: input.plan.planFingerprint })};const decisions={};document.querySelectorAll('.card').forEach(card=>{card.querySelectorAll('[data-verdict]').forEach(button=>button.addEventListener('click',()=>{card.querySelectorAll('[data-verdict]').forEach(item=>item.classList.remove('selected'));button.classList.add('selected');decisions[card.dataset.caseId]={caseId:card.dataset.caseId,verdict:button.dataset.verdict,note:card.querySelector('textarea').value}}));card.querySelector('textarea').addEventListener('input',()=>{if(decisions[card.dataset.caseId])decisions[card.dataset.caseId].note=card.querySelector('textarea').value})});document.querySelector('.copy').addEventListener('click',async()=>{const payload={...seed,reviewerRole:'product_owner',decisions:Object.values(decisions)};await navigator.clipboard.writeText(JSON.stringify(payload,null,2));document.querySelector('.copy').textContent='已复制 '+payload.decisions.length+'/6'});</script></body></html>`;
  const file = path.join(
    input.cwd,
    GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_PATHS.privateReviewHtml
  );
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, html, { mode: 0o600 });
  await chmod(file, 0o600);
  return file;
}

async function prepare(cwd: string) {
  const plan = await createGi088ResponseFirstV22LowFullV2Plan(cwd);
  await writeJsonAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_PATHS.publicStartCard),
    plan
  );
  return plan;
}

async function providerForExecution(cwd: string, plan: LowPlan) {
  loadEnvConfig(cwd, true);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  assert(apiKey, "GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_DEEPSEEK_API_KEY_MISSING");
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

async function execute(cwd: string) {
  const plan = await prepare(cwd);
  const provider = await providerForExecution(cwd, plan);
  const ledger = await runGi088ResponseFirstV22LowFullV2({
    cwd,
    workspaceRoot: cwd,
    plan,
    provider
  });
  process.stdout.write(`${JSON.stringify({
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    status: receiptStatus(plan, ledger),
    calls: ledger.results.length,
    publicReceipt: GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_PATHS.publicReceipt
  }, null, 2)}\n`);
}

async function finalizeCodex(cwd: string) {
  const plan = await prepare(cwd);
  const ledger = await readLedger(cwd, plan);
  assert(
    ledger.results.length === plan.cases.length,
    "GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_RESULTS_INCOMPLETE"
  );
  const review = await readReview(
    path.join(cwd, GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_PATHS.privateCodexReview),
    plan,
    "codex"
  );
  ledger.codexDecision = evaluateGi088ResponseFirstV22LowFullV2Review({
    plan,
    results: ledger.results,
    decisions: review.decisions
  });
  await writeGi088ResponseFirstV22LowFullV2ReviewHtml({
    cwd,
    workspaceRoot: cwd,
    plan,
    results: ledger.results,
    codexDecisions: review.decisions
  });
  await saveLedger(cwd, plan, ledger);
  const lines = [
    "# GI-088 回应优先 v2.2｜Low 完整六题",
    "",
    `- 身份：\`${plan.identity}\``,
    `- 状态：\`${receiptStatus(plan, ledger)}\``,
    `- 调用：\`${ledger.results.length}/6\`；重试、恢复、降级均为 \`0\``,
    `- 中位耗时：\`${ledger.codexDecision.medianLatencyMs ?? "-"}ms\``,
    `- Codex 初评：\`${ledger.codexDecision.counts.pass} pass / ${ledger.codexDecision.counts.minor} minor / ${ledger.codexDecision.counts.fail} fail\``,
    "- 下一步：先向产品负责人展示完整相关原文和实际输出，再等待最终质量裁决。",
    "- 私有边界：用户正文、模型正文和评价原文保存在 Git 排除目录。"
  ];
  await writeFile(
    path.join(cwd, GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_PATHS.publicHandoff),
    `${lines.join("\n")}\n`
  );
  process.stdout.write(`${JSON.stringify({
    ...ledger.codexDecision,
    privateReview: GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_PATHS.privateReviewHtml
  }, null, 2)}\n`);
}

async function finalizeProduct(cwd: string) {
  const plan = await prepare(cwd);
  const ledger = await readLedger(cwd, plan);
  assert(
    ledger.results.length === plan.cases.length,
    "GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_RESULTS_INCOMPLETE"
  );
  const review = await readReview(
    path.join(cwd, GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_PATHS.privateProductReview),
    plan,
    "product_owner"
  );
  ledger.productDecision = evaluateGi088ResponseFirstV22LowFullV2Review({
    plan,
    results: ledger.results,
    decisions: review.decisions
  });
  await saveLedger(cwd, plan, ledger);
  process.stdout.write(`${JSON.stringify(ledger.productDecision, null, 2)}\n`);
}

async function main() {
  const cwd = process.cwd();
  const command = process.env.GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_COMMAND ??
    process.argv[2] ?? "--prepare";
  if (command === "--execute") return execute(cwd);
  if (command === "--finalize-codex") return finalizeCodex(cwd);
  if (command === "--finalize-product") return finalizeProduct(cwd);
  const plan = await prepare(cwd);
  process.stdout.write(`${JSON.stringify({
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    status: plan.status,
    budget: plan.budget,
    publicStartCard: GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_PATHS.publicStartCard
  }, null, 2)}\n`);
}

if (
  process.env.VITEST !== "true" &&
  (process.env.GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_COMMAND ||
    (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(RUNNER_FILE)))
) {
  void main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
