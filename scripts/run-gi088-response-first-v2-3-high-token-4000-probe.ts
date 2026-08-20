import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  GI088_RESPONSE_FIRST_V23_TOKEN_4000_RUNTIME,
  createGi088ResponseFirstV23Token4000HighUserPrompt,
  createGi088ResponseFirstV23Token4000Identity,
  getGi088ResponseFirstV23Token4000HighSystemPrompt,
  observeGi088ResponseFirstV23Token4000Questions,
  parseGi088ResponseFirstV23Token4000HighOutput,
  validateGi088ResponseFirstV23Token4000HighAndProjection,
  type Gi088ResponseFirstV23Token4000HighOutput
} from "../evals/event-centered-generative/gi088-response-first-v2-3-token-4000/candidate";
import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAIProviderDiagnostics,
  type AICompletionParams,
  type AIProvider
} from "../src/server/services/ai/ai-provider";
import { OpenAIProvider } from "../src/server/services/ai/openai.provider";
import {
  GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT,
  loadGi088ResponseFirstV22RubricV13Cases,
  type Gi088ResponseFirstV22RubricV13Case,
  type Gi088ResponseFirstV22RubricV13CaseId
} from "./gi088-response-first-v2-2-rubric-v1-3-fixtures";

export const GI088_RESPONSE_FIRST_V23_TOKEN_4000_PROBE_IDENTITY =
  "2026-08-17.gi088-response-first-v2-3-high-token-4000-probe-v1" as const;
export const GI088_RESPONSE_FIRST_V23_TOKEN_4000_STANDARD_SHA256 =
  "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60" as const;
export const GI088_RESPONSE_FIRST_V23_TOKEN_4000_CASE_ID =
  "RPR-REAL-19-CORRECTION" as const satisfies Gi088ResponseFirstV22RubricV13CaseId;

const PRIVATE_ROOT =
  `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-3/high-token-4000-probe-v1`;

export const GI088_RESPONSE_FIRST_V23_TOKEN_4000_PATHS = {
  privateLedger: `${PRIVATE_ROOT}/ledger.json`,
  publicStartCard:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-3-high-token-4000-probe-v1-start-card.json`,
  publicReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-3-high-token-4000-probe-v1-receipt.json`,
  frozenLowPrivateLedger:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-2/low-full-quality-v2/ledger.json`,
  frozenLowPublicReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-2-low-full-quality-v2-receipt.json`,
  parentHighStartCard:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-3-high-quality-v1-start-card.json`,
  parentHighReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-3-high-quality-v1-receipt.json`
} as const;

const RUNNER_FILE =
  "scripts/run-gi088-response-first-v2-3-high-token-4000-probe.ts";
const FILES = {
  standard: "docs/ai-evaluation-standard.md",
  plan:
    "docs/plans/2026-08-17-gi088-response-first-v2-2-review-go-continuation.md",
  candidate:
    "evals/event-centered-generative/gi088-response-first-v2-3-token-4000/candidate.ts",
  parentCandidate:
    "evals/event-centered-generative/gi088-response-first-v2-3/candidate.ts",
  fixtures: "scripts/gi088-response-first-v2-2-rubric-v1-3-fixtures.ts",
  frozenLowReceipt:
    GI088_RESPONSE_FIRST_V23_TOKEN_4000_PATHS.frozenLowPublicReceipt,
  parentHighStartCard:
    GI088_RESPONSE_FIRST_V23_TOKEN_4000_PATHS.parentHighStartCard,
  parentHighReceipt:
    GI088_RESPONSE_FIRST_V23_TOKEN_4000_PATHS.parentHighReceipt,
  provider: "src/server/services/ai/openai.provider.ts",
  providerContract: "src/server/services/ai/ai-provider.ts",
  runner: RUNNER_FILE
} as const;

type FrozenLow = {
  rawOutput: string;
  responseHash: string;
  totalLatencyMs: number;
  planFingerprint: string;
  candidateFingerprint: string;
};

export type Gi088ResponseFirstV23Token4000ProbeResult = {
  caseId: typeof GI088_RESPONSE_FIRST_V23_TOKEN_4000_CASE_ID;
  status: "valid" | "contract_failure" | "technical_failure";
  startedAt: string;
  completedAt: string;
  requestFingerprint: string;
  frozenLowHash: string;
  frozenLowLatencyMs: number;
  responseHash: string | null;
  responseLength: number;
  rawOutput: string | null;
  parsedHigh: Gi088ResponseFirstV23Token4000HighOutput | null;
  validationIssues: string[];
  errorCode: string | null;
  highLatencyMs: number;
  fullRoundLatencyMs: number;
  fullRound45sTargetObserved: boolean;
  fullRound60sHardObserved: boolean;
  diagnostics: ReturnType<typeof sanitizeAIProviderDiagnostics>;
};

type ProbePlan = Awaited<ReturnType<typeof createGi088ResponseFirstV23Token4000Plan>>;
type PrivateLedger = {
  identity: string;
  planFingerprint: string;
  status: "prepared" | "call_started" | "complete";
  preflight: {
    checkedAt: string;
    httpStatus: number;
    targetModelAvailable: boolean;
    modelListHash: string;
  } | null;
  callBudgetConsumed: 0 | 1;
  result: Gi088ResponseFirstV23Token4000ProbeResult | null;
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

async function pathExists(file: string) {
  return stat(file).then(() => true).catch(() => false);
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

async function loadFrozenLow(cwd: string): Promise<FrozenLow> {
  const [privateSource, publicSource] = await Promise.all([
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V23_TOKEN_4000_PATHS.frozenLowPrivateLedger), "utf8"),
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V23_TOKEN_4000_PATHS.frozenLowPublicReceipt), "utf8")
  ]);
  const privateLedger = JSON.parse(privateSource) as {
    identity: string;
    planFingerprint: string;
    productDecision: { gatePassed?: boolean } | null;
    results: Array<{
      caseId: string;
      status: string;
      rawOutput: string | null;
      responseHash: string | null;
      totalLatencyMs: number | null;
    }>;
  };
  const publicReceipt = JSON.parse(publicSource) as {
    identity: string;
    planFingerprint: string;
    candidateFingerprint: string;
    status: string;
    productDecision: { gatePassed?: boolean } | null;
  };
  assert(
    privateLedger.identity === "2026-08-17.gi088-response-first-v2-2-low-full-quality-v2" &&
      publicReceipt.identity === privateLedger.identity &&
      publicReceipt.planFingerprint === privateLedger.planFingerprint &&
      privateLedger.productDecision?.gatePassed === true &&
      publicReceipt.productDecision?.gatePassed === true,
    "GI088_RESPONSE_FIRST_V23_TOKEN_4000_FROZEN_LOW_GATE_INVALID"
  );
  const result = privateLedger.results.find(
    (item) => item.caseId === GI088_RESPONSE_FIRST_V23_TOKEN_4000_CASE_ID
  );
  assert(
    result?.status === "valid" &&
      typeof result.rawOutput === "string" &&
      typeof result.responseHash === "string" &&
      typeof result.totalLatencyMs === "number" &&
      sha(result.rawOutput) === result.responseHash,
    "GI088_RESPONSE_FIRST_V23_TOKEN_4000_FROZEN_LOW_RESULT_INVALID"
  );
  return {
    rawOutput: result.rawOutput,
    responseHash: result.responseHash,
    totalLatencyMs: result.totalLatencyMs,
    planFingerprint: privateLedger.planFingerprint,
    candidateFingerprint: publicReceipt.candidateFingerprint
  };
}

async function loadParentFailure(cwd: string) {
  const [startSource, receiptSource] = await Promise.all([
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V23_TOKEN_4000_PATHS.parentHighStartCard), "utf8"),
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V23_TOKEN_4000_PATHS.parentHighReceipt), "utf8")
  ]);
  const start = JSON.parse(startSource) as {
    identity: string;
    planFingerprint: string;
    fixedFactors: { maxTokens: number };
    candidateIdentity: { candidateFingerprint: string };
  };
  const receipt = JSON.parse(receiptSource) as {
    identity: string;
    planFingerprint: string;
    status: string;
    results: Array<{
      caseId: string;
      status: string;
      finishReason: string | null;
      tokenUsage: { completionTokens?: number } | null;
      reasoningTokens: number | null;
      responseLength: number;
    }>;
  };
  const result = receipt.results[0];
  assert(
    start.identity === "2026-08-17.gi088-response-first-v2-3-high-quality-v1" &&
      receipt.identity === start.identity &&
      receipt.planFingerprint === start.planFingerprint &&
      start.fixedFactors.maxTokens === 2_000 &&
      receipt.status === "stopped_by_checkpoint_technical_or_contract_gate" &&
      result?.caseId === GI088_RESPONSE_FIRST_V23_TOKEN_4000_CASE_ID &&
      result.status === "contract_failure" &&
      result.finishReason === "length" &&
      result.tokenUsage?.completionTokens === 2_000 &&
      result.reasoningTokens === 1_985 &&
      result.responseLength === 42,
    "GI088_RESPONSE_FIRST_V23_TOKEN_4000_PARENT_FAILURE_INVALID"
  );
  return {
    identity: start.identity,
    planFingerprint: start.planFingerprint,
    candidateFingerprint: start.candidateIdentity.candidateFingerprint,
    startCardSha256: sha(startSource),
    receiptSha256: sha(receiptSource)
  };
}

function requestForCase(input: {
  item: Gi088ResponseFirstV22RubricV13Case;
  frozenLow: string;
}): AICompletionParams {
  const runtime = GI088_RESPONSE_FIRST_V23_TOKEN_4000_RUNTIME.high;
  return {
    messages: [
      {
        role: "system",
        content: getGi088ResponseFirstV23Token4000HighSystemPrompt()
      },
      {
        role: "user",
        content: createGi088ResponseFirstV23Token4000HighUserPrompt({
          turnInput: input.item.turnInput,
          frozenLow: input.frozenLow
        })
      }
    ],
    maxTokens: runtime.maxTokens,
    headersTimeoutMs: runtime.headersTimeoutMs,
    bodyIdleTimeoutMs: runtime.bodyIdleTimeoutMs,
    hardTimeoutMs: runtime.hardTimeoutMs,
    timeoutMs: runtime.hardTimeoutMs,
    responseFormat: runtime.responseFormat,
    thinking: runtime.thinking,
    reasoningEffort: runtime.reasoningEffort
  };
}

export async function createGi088ResponseFirstV23Token4000Plan(
  cwd = process.cwd()
) {
  const standardSha256 = await fileSha(cwd, FILES.standard);
  assert(
    standardSha256 === GI088_RESPONSE_FIRST_V23_TOKEN_4000_STANDARD_SHA256,
    "STANDARD_SHA256_MISMATCH"
  );
  const [dataset, frozenLow, parentFailure] = await Promise.all([
    loadGi088ResponseFirstV22RubricV13Cases(cwd),
    loadFrozenLow(cwd),
    loadParentFailure(cwd)
  ]);
  const item = dataset.cases.find(
    (candidate) => candidate.caseId === GI088_RESPONSE_FIRST_V23_TOKEN_4000_CASE_ID
  );
  assert(item, "GI088_RESPONSE_FIRST_V23_TOKEN_4000_CASE_MISSING");
  const candidateIdentity = createGi088ResponseFirstV23Token4000Identity();
  assert(
    candidateIdentity.parentCandidateFingerprint ===
      parentFailure.candidateFingerprint &&
      candidateIdentity.frozenLowCandidateFingerprint ===
        frozenLow.candidateFingerprint,
    "GI088_RESPONSE_FIRST_V23_TOKEN_4000_CANDIDATE_LINEAGE_INVALID"
  );
  const inputHashes = Object.fromEntries(
    await Promise.all(
      Object.entries(FILES).map(async ([key, relativePath]) => [
        `${key}Sha256`,
        await fileSha(cwd, relativePath)
      ])
    )
  ) as Record<string, string>;
  const request = requestForCase({ item, frozenLow: frozenLow.rawOutput });
  const core = {
    schemaVersion: "1.0",
    identity: GI088_RESPONSE_FIRST_V23_TOKEN_4000_PROBE_IDENTITY,
    status: "ready_authorized_waiting_single_probe",
    productDecision: "whether_4000_tokens_deliver_complete_grounded_high_output_for_the_same_first_case",
    changedFactor: "high_max_tokens_2000_to_4000_only",
    fixedFactors: {
      model: GI088_RESPONSE_FIRST_V23_TOKEN_4000_RUNTIME.model,
      thinking: GI088_RESPONSE_FIRST_V23_TOKEN_4000_RUNTIME.high.thinking,
      reasoningEffort:
        GI088_RESPONSE_FIRST_V23_TOKEN_4000_RUNTIME.high.reasoningEffort,
      promptAndContract: "byte_identical_to_v23_parent",
      datasetFingerprint: dataset.datasetFingerprint,
      frozenLowPlanFingerprint: frozenLow.planFingerprint,
      frozenLowCandidateFingerprint: frozenLow.candidateFingerprint,
      frozenLowHash: frozenLow.responseHash,
      frozenLowLatencyMs: frozenLow.totalLatencyMs,
      parentHighIdentity: parentFailure.identity,
      parentHighPlanFingerprint: parentFailure.planFingerprint,
      parentHighCandidateFingerprint: parentFailure.candidateFingerprint,
      oldMaxTokens: 2_000,
      newMaxTokens: 4_000,
      concurrency: 1,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    candidateIdentity,
    dataset: {
      version: dataset.datasetVersion,
      fingerprint: dataset.datasetFingerprint,
      privacyLevel: "private_sensitive",
      caseId: item.caseId,
      sourceFingerprint: item.sourceFingerprint
    },
    requestFingerprint: sha(request),
    inputHashes,
    budget: {
      authorized: 1,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    gate: {
      httpStatus: 200,
      responseModel: GI088_RESPONSE_FIRST_V23_TOKEN_4000_RUNTIME.model,
      finishReason: "stop",
      jsonAndSourceContract: "valid",
      fullRoundTargetMs: 45_000,
      fullRoundHardMs: 60_000,
      semanticAuthority: "product_owner_after_complete_raw_output"
    },
    reviewOrder: [
      "complete_relevant_user_and_assistant_context",
      "frozen_low_actual_output",
      "actual_high_raw_output_and_visible_projection",
      "technical_status_latency_and_source_validation",
      "codex_provisional_judgment",
      "product_owner_final_judgment"
    ],
    stopPoint: "one_same_case_call_then_stop_whether_valid_or_failed"
  } as const;
  return { ...core, planFingerprint: sha(core) };
}

function emptyLedger(plan: ProbePlan): PrivateLedger {
  return {
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    status: "prepared",
    preflight: null,
    callBudgetConsumed: 0,
    result: null
  };
}

async function readFrozenPlan(cwd: string) {
  const plan = JSON.parse(
    await readFile(
      path.join(cwd, GI088_RESPONSE_FIRST_V23_TOKEN_4000_PATHS.publicStartCard),
      "utf8"
    )
  ) as ProbePlan;
  assert(
    plan.identity === GI088_RESPONSE_FIRST_V23_TOKEN_4000_PROBE_IDENTITY &&
      await fileSha(cwd, FILES.standard) ===
        GI088_RESPONSE_FIRST_V23_TOKEN_4000_STANDARD_SHA256,
    "GI088_RESPONSE_FIRST_V23_TOKEN_4000_FROZEN_PLAN_INVALID"
  );
  const immutableKeys = [
    "candidate",
    "parentCandidate",
    "fixtures",
    "frozenLowReceipt",
    "parentHighStartCard",
    "parentHighReceipt",
    "provider",
    "providerContract",
    "runner"
  ] as const;
  for (const key of immutableKeys) {
    assert(
      await fileSha(cwd, FILES[key]) === plan.inputHashes[`${key}Sha256`],
      `GI088_RESPONSE_FIRST_V23_TOKEN_4000_INPUT_DRIFT:${key}`
    );
  }
  return plan;
}

async function readLedger(cwd: string, plan: ProbePlan) {
  const file = path.join(cwd, GI088_RESPONSE_FIRST_V23_TOKEN_4000_PATHS.privateLedger);
  const ledger = await readFile(file, "utf8")
    .then((source) => JSON.parse(source) as PrivateLedger)
    .catch(() => emptyLedger(plan));
  assert(
    ledger.identity === plan.identity &&
      ledger.planFingerprint === plan.planFingerprint,
    "GI088_RESPONSE_FIRST_V23_TOKEN_4000_LEDGER_IDENTITY_INVALID"
  );
  return ledger;
}

function publicResult(result: Gi088ResponseFirstV23Token4000ProbeResult | null) {
  if (!result) return null;
  const understanding = result.parsedHigh?.visibleAppend.correctableUnderstanding;
  const questions = result.parsedHigh?.semantic.nextResponse.decision === "ask"
    ? result.parsedHigh.semantic.nextResponse.questions
    : [];
  return {
    caseId: result.caseId,
    status: result.status,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    requestFingerprint: result.requestFingerprint,
    frozenLowHash: result.frozenLowHash,
    frozenLowLatencyMs: result.frozenLowLatencyMs,
    responseHash: result.responseHash,
    responseLength: result.responseLength,
    validationIssues: result.validationIssues,
    errorCode: result.errorCode,
    highLatencyMs: result.highLatencyMs,
    fullRoundLatencyMs: result.fullRoundLatencyMs,
    fullRound45sTargetObserved: result.fullRound45sTargetObserved,
    fullRound60sHardObserved: result.fullRound60sHardObserved,
    understandingPresent: Boolean(understanding),
    understandingEvidenceRefCount: understanding?.evidenceRefs.length ?? 0,
    understandingTextHash: understanding ? sha(understanding.text) : null,
    questionCount: questions.length,
    questionTextHashes: questions.map(sha),
    questionObservation: result.parsedHigh
      ? observeGi088ResponseFirstV23Token4000Questions(result.parsedHigh)
      : null,
    finishReason: result.diagnostics?.finishReason ?? null,
    reasoningTokens: result.diagnostics?.reasoningTokens ?? null,
    tokenUsage: result.diagnostics?.tokenUsage ?? null,
    responseModel: result.diagnostics?.responseModel ?? null,
    httpStatus: result.diagnostics?.httpStatus ?? null
  };
}

async function saveLedger(cwd: string, plan: ProbePlan, ledger: PrivateLedger) {
  await writeJsonAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V23_TOKEN_4000_PATHS.privateLedger),
    ledger,
    true
  );
  const status = ledger.result
    ? ledger.result.status === "valid"
      ? "complete_valid_waiting_raw_output_review"
      : "complete_failed_stop"
    : ledger.status === "call_started"
      ? "call_started_budget_consumed"
      : "ready_authorized_waiting_single_probe";
  await writeJsonAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V23_TOKEN_4000_PATHS.publicReceipt),
    {
      schemaVersion: "1.0",
      identity: plan.identity,
      planFingerprint: plan.planFingerprint,
      candidateFingerprint: plan.candidateIdentity.candidateFingerprint,
      datasetFingerprint: plan.dataset.fingerprint,
      parentHighPlanFingerprint: plan.fixedFactors.parentHighPlanFingerprint,
      status,
      preflight: ledger.preflight,
      budget: {
        authorized: 1,
        consumed: ledger.callBudgetConsumed,
        notRun: 1 - ledger.callBudgetConsumed,
        retries: 0,
        recovery: 0,
        fallback: 0
      },
      result: publicResult(ledger.result),
      semanticQuality: ledger.result?.status === "valid"
        ? "waiting_codex_and_product_owner_raw_output_review"
        : "not_evaluated",
      privateBoundary: {
        publicReceiptContainsUserLowOrHighBody: false,
        rawInputsLowAndHighOutput: "git_ignored_private_ledger",
        reviewOrder: plan.reviewOrder
      }
    }
  );
  return ledger;
}

async function runCall(input: {
  plan: ProbePlan;
  item: Gi088ResponseFirstV22RubricV13Case;
  low: FrozenLow;
  provider: AIProvider;
}) {
  const request = requestForCase({ item: input.item, frozenLow: input.low.rawOutput });
  assert(
    sha(request) === input.plan.requestFingerprint,
    "GI088_RESPONSE_FIRST_V23_TOKEN_4000_REQUEST_DRIFT"
  );
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  try {
    const completion = await input.provider.complete(request);
    const diagnostics = sanitizeAIProviderDiagnostics(completion.diagnostics);
    const highLatencyMs = diagnostics?.totalLatencyMs ?? completion.latencyMs ??
      Math.max(0, Date.now() - startedMs);
    const fullRoundLatencyMs = input.low.totalLatencyMs + highLatencyMs;
    try {
      const parsedHigh = parseGi088ResponseFirstV23Token4000HighOutput(
        completion.content
      );
      const validationIssues =
        validateGi088ResponseFirstV23Token4000HighAndProjection({
          turnInput: input.item.turnInput,
          frozenLow: input.low.rawOutput,
          high: parsedHigh
        });
      if (
        diagnostics?.responseModel &&
        diagnostics.responseModel !== GI088_RESPONSE_FIRST_V23_TOKEN_4000_RUNTIME.model
      ) {
        validationIssues.push(`RESPONSE_MODEL_MISMATCH:${diagnostics.responseModel}`);
      }
      if (diagnostics?.finishReason !== "stop") {
        validationIssues.push(
          `HIGH_FINISH_REASON_INVALID:${diagnostics?.finishReason ?? "missing"}`
        );
      }
      const status = validationIssues.length === 0
        ? "valid" as const
        : "contract_failure" as const;
      return {
        caseId: GI088_RESPONSE_FIRST_V23_TOKEN_4000_CASE_ID,
        status,
        startedAt,
        completedAt: new Date().toISOString(),
        requestFingerprint: input.plan.requestFingerprint,
        frozenLowHash: input.low.responseHash,
        frozenLowLatencyMs: input.low.totalLatencyMs,
        responseHash: sha(completion.content),
        responseLength: completion.content.length,
        rawOutput: completion.content,
        parsedHigh,
        validationIssues: [...new Set(validationIssues)],
        errorCode: status === "valid" ? null : "GI088_RESPONSE_FIRST_V23_TOKEN_4000_CONTRACT_INVALID",
        highLatencyMs,
        fullRoundLatencyMs,
        fullRound45sTargetObserved: fullRoundLatencyMs <= 45_000,
        fullRound60sHardObserved: fullRoundLatencyMs <= 60_000,
        diagnostics
      } satisfies Gi088ResponseFirstV23Token4000ProbeResult;
    } catch (error) {
      return {
        caseId: GI088_RESPONSE_FIRST_V23_TOKEN_4000_CASE_ID,
        status: "contract_failure" as const,
        startedAt,
        completedAt: new Date().toISOString(),
        requestFingerprint: input.plan.requestFingerprint,
        frozenLowHash: input.low.responseHash,
        frozenLowLatencyMs: input.low.totalLatencyMs,
        responseHash: sha(completion.content),
        responseLength: completion.content.length,
        rawOutput: completion.content,
        parsedHigh: null,
        validationIssues: [
          error instanceof Error ? error.message : "HIGH_PARSE_FAILED"
        ],
        errorCode: "GI088_RESPONSE_FIRST_V23_TOKEN_4000_PARSE_FAILED",
        highLatencyMs,
        fullRoundLatencyMs,
        fullRound45sTargetObserved: fullRoundLatencyMs <= 45_000,
        fullRound60sHardObserved: fullRoundLatencyMs <= 60_000,
        diagnostics
      } satisfies Gi088ResponseFirstV23Token4000ProbeResult;
    }
  } catch (error) {
    const diagnostics = sanitizeAIProviderDiagnostics(getAIProviderDiagnostics(error));
    const highLatencyMs = diagnostics?.totalLatencyMs ??
      Math.max(0, Date.now() - startedMs);
    const fullRoundLatencyMs = input.low.totalLatencyMs + highLatencyMs;
    return {
      caseId: GI088_RESPONSE_FIRST_V23_TOKEN_4000_CASE_ID,
      status: "technical_failure" as const,
      startedAt,
      completedAt: new Date().toISOString(),
      requestFingerprint: input.plan.requestFingerprint,
      frozenLowHash: input.low.responseHash,
      frozenLowLatencyMs: input.low.totalLatencyMs,
      responseHash: null,
      responseLength: 0,
      rawOutput: null,
      parsedHigh: null,
      validationIssues: [],
      errorCode: getAIProviderFailureCode(error),
      highLatencyMs,
      fullRoundLatencyMs,
      fullRound45sTargetObserved: fullRoundLatencyMs <= 45_000,
      fullRound60sHardObserved: fullRoundLatencyMs <= 60_000,
      diagnostics
    } satisfies Gi088ResponseFirstV23Token4000ProbeResult;
  }
}

export async function runGi088ResponseFirstV23Token4000Probe(input: {
  cwd?: string;
  workspaceRoot?: string;
  plan: ProbePlan;
  provider: AIProvider;
}) {
  const cwd = input.cwd ?? process.cwd();
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const ledger = await readLedger(cwd, input.plan);
  if (ledger.result) return saveLedger(cwd, input.plan, ledger);
  assert(
    ledger.callBudgetConsumed === 0,
    "GI088_RESPONSE_FIRST_V23_TOKEN_4000_STARTED_REQUIRES_AUDIT"
  );
  const [dataset, low] = await Promise.all([
    loadGi088ResponseFirstV22RubricV13Cases(workspaceRoot),
    loadFrozenLow(workspaceRoot)
  ]);
  const item = dataset.cases.find(
    (candidate) => candidate.caseId === GI088_RESPONSE_FIRST_V23_TOKEN_4000_CASE_ID
  );
  assert(item, "GI088_RESPONSE_FIRST_V23_TOKEN_4000_CASE_LOST");
  ledger.status = "call_started";
  ledger.callBudgetConsumed = 1;
  await saveLedger(cwd, input.plan, ledger);
  ledger.result = await runCall({ plan: input.plan, item, low, provider: input.provider });
  ledger.status = "complete";
  return saveLedger(cwd, input.plan, ledger);
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
    assert(response.ok, `GI088_RESPONSE_FIRST_V23_TOKEN_4000_MODEL_LIST_HTTP_${response.status}`);
    const payload = JSON.parse(source) as { data?: Array<{ id?: unknown }> };
    const modelIds = (payload.data ?? []).flatMap((item) =>
      typeof item.id === "string" ? [item.id] : []
    );
    assert(
      modelIds.includes(GI088_RESPONSE_FIRST_V23_TOKEN_4000_RUNTIME.model),
      "GI088_RESPONSE_FIRST_V23_TOKEN_4000_TARGET_MODEL_UNAVAILABLE"
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

async function prepare(cwd: string) {
  const file = path.join(cwd, GI088_RESPONSE_FIRST_V23_TOKEN_4000_PATHS.publicStartCard);
  if (await pathExists(file)) return readFrozenPlan(cwd);
  const plan = await createGi088ResponseFirstV23Token4000Plan(cwd);
  await writeJsonAtomic(file, plan);
  await saveLedger(cwd, plan, emptyLedger(plan));
  return plan;
}

async function execute(cwd: string) {
  const plan = await prepare(cwd);
  loadEnvConfig(cwd, true);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  assert(apiKey, "GI088_RESPONSE_FIRST_V23_TOKEN_4000_DEEPSEEK_API_KEY_MISSING");
  const ledger = await readLedger(cwd, plan);
  if (!ledger.preflight) {
    ledger.preflight = await checkTargetModel(apiKey);
    await saveLedger(cwd, plan, ledger);
  }
  const provider = new OpenAIProvider({
    apiKey,
    model: GI088_RESPONSE_FIRST_V23_TOKEN_4000_RUNTIME.model,
    baseUrl: "https://api.deepseek.com",
    timeoutMs: GI088_RESPONSE_FIRST_V23_TOKEN_4000_RUNTIME.high.hardTimeoutMs
  });
  const completed = await runGi088ResponseFirstV23Token4000Probe({
    cwd,
    workspaceRoot: cwd,
    plan,
    provider
  });
  process.stdout.write(`${JSON.stringify({
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    status: completed.result?.status ?? completed.status,
    calls: completed.callBudgetConsumed,
    publicReceipt: GI088_RESPONSE_FIRST_V23_TOKEN_4000_PATHS.publicReceipt
  }, null, 2)}\n`);
}

async function main() {
  const cwd = process.cwd();
  const command = process.env.GI088_RESPONSE_FIRST_V23_TOKEN_4000_COMMAND ??
    process.argv[2] ?? "--prepare";
  if (command === "--execute") return execute(cwd);
  const plan = await prepare(cwd);
  process.stdout.write(`${JSON.stringify({
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    status: plan.status,
    budget: plan.budget,
    publicStartCard: GI088_RESPONSE_FIRST_V23_TOKEN_4000_PATHS.publicStartCard
  }, null, 2)}\n`);
}

if (
  process.env.VITEST !== "true" &&
  (process.env.GI088_RESPONSE_FIRST_V23_TOKEN_4000_COMMAND ||
    (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(RUNNER_FILE)))
) {
  void main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
