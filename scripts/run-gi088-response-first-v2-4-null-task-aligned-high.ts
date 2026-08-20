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
  GI088_RESPONSE_FIRST_V24_RUNTIME,
  createGi088ResponseFirstV24HighUserPrompt,
  createGi088ResponseFirstV24Identity,
  getGi088ResponseFirstV24HighSystemPrompt,
  observeGi088ResponseFirstV24Questions,
  parseGi088ResponseFirstV24HighOutput,
  projectGi088ResponseFirstV24VisibleDelivery,
  validateGi088ResponseFirstV24HighAndProjection,
  type Gi088ResponseFirstV24HighOutput
} from "../evals/event-centered-generative/gi088-response-first-v2-4/candidate";
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

export const GI088_RESPONSE_FIRST_V24_HIGH_QUALITY_IDENTITY =
  "2026-08-17.gi088-response-first-v2-4-null-task-aligned-high-quality-v1" as const;
export const GI088_RESPONSE_FIRST_V24_STANDARD_SHA256 =
  "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60" as const;
export const GI088_RESPONSE_FIRST_V24_FIRST_CASE_ID =
  "RPR-REAL-19-CORRECTION" as const satisfies Gi088ResponseFirstV22RubricV13CaseId;
export const GI088_RESPONSE_FIRST_V24_REMAINING_CASE_IDS = [
  "RPR-REAL-06",
  "RPR-REAL-19-CONTINUE",
  "RPR-REAL-22",
  "RPR-REAL-13",
  "RPR-LC-21"
] as const satisfies readonly Gi088ResponseFirstV22RubricV13CaseId[];

type Phase = "first_gate" | "remaining";

const PRIVATE_ROOT =
  `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-4/null-task-aligned-high-quality-v1`;

export const GI088_RESPONSE_FIRST_V24_PATHS = {
  privateLedger: `${PRIVATE_ROOT}/ledger.json`,
  privateFirstCodexReview: `${PRIVATE_ROOT}/first-codex-review.json`,
  privateFirstProductReview: `${PRIVATE_ROOT}/first-product-review.json`,
  privateFirstReviewHtml: `${PRIVATE_ROOT}/first-review.html`,
  privateRemainingCodexReview: `${PRIVATE_ROOT}/remaining-codex-review.json`,
  privateRemainingProductReview: `${PRIVATE_ROOT}/remaining-product-review.json`,
  privateRemainingReviewHtml: `${PRIVATE_ROOT}/remaining-review.html`,
  publicStartCard:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-4-null-task-aligned-high-quality-v1-start-card.json`,
  publicReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-4-null-task-aligned-high-quality-v1-receipt.json`,
  publicHandoff:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-4-null-task-aligned-high-quality-v1-handoff.md`,
  frozenLowPrivateLedger:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-2/low-full-quality-v2/ledger.json`,
  frozenLowPublicReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-2-low-full-quality-v2-receipt.json`,
  parentProbeStartCard:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-3-high-token-4000-probe-v1-start-card.json`,
  parentProbeReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-3-high-token-4000-probe-v1-receipt.json`
} as const;

const RUNNER_FILE =
  "scripts/run-gi088-response-first-v2-4-null-task-aligned-high.ts";
const FILES = {
  standard: "docs/ai-evaluation-standard.md",
  plan:
    "docs/plans/2026-08-17-gi088-response-first-v2-2-review-go-continuation.md",
  candidate:
    "evals/event-centered-generative/gi088-response-first-v2-4/candidate.ts",
  parentCandidate:
    "evals/event-centered-generative/gi088-response-first-v2-3-token-4000/candidate.ts",
  fixtures: "scripts/gi088-response-first-v2-2-rubric-v1-3-fixtures.ts",
  frozenLowReceipt: GI088_RESPONSE_FIRST_V24_PATHS.frozenLowPublicReceipt,
  parentProbeStartCard: GI088_RESPONSE_FIRST_V24_PATHS.parentProbeStartCard,
  parentProbeReceipt: GI088_RESPONSE_FIRST_V24_PATHS.parentProbeReceipt,
  provider: "src/server/services/ai/openai.provider.ts",
  providerContract: "src/server/services/ai/ai-provider.ts",
  runner: RUNNER_FILE
} as const;

type FrozenLowResult = {
  caseId: Gi088ResponseFirstV22RubricV13CaseId;
  rawOutput: string;
  responseHash: string;
  totalLatencyMs: number;
};

export type Gi088ResponseFirstV24CallResult = {
  phase: Phase;
  order: number;
  caseId: Gi088ResponseFirstV22RubricV13CaseId;
  status: "valid" | "contract_failure" | "technical_failure";
  startedAt: string;
  completedAt: string;
  requestFingerprint: string;
  frozenLowHash: string;
  frozenLowLatencyMs: number;
  responseHash: string | null;
  responseLength: number;
  rawOutput: string | null;
  parsedHigh: Gi088ResponseFirstV24HighOutput | null;
  validationIssues: string[];
  errorCode: string | null;
  highLatencyMs: number;
  fullRoundLatencyMs: number;
  fullRound45sTargetPassed: boolean;
  fullRound60sHardPassed: boolean;
  questionObservation: ReturnType<
    typeof observeGi088ResponseFirstV24Questions
  > | null;
  diagnostics: ReturnType<typeof sanitizeAIProviderDiagnostics>;
};

export type Gi088ResponseFirstV24ReviewDecision = {
  caseId: Gi088ResponseFirstV22RubricV13CaseId;
  verdict: "pass" | "minor" | "fail";
  note: string;
};

type HighPlan = Awaited<ReturnType<typeof createGi088ResponseFirstV24Plan>>;
type ReviewSummary = ReturnType<typeof evaluateGi088ResponseFirstV24Review>;
type PrivateLedger = {
  identity: string;
  planFingerprint: string;
  preflight: {
    checkedAt: string;
    httpStatus: number;
    targetModelAvailable: boolean;
    modelListHash: string;
  } | null;
  startedCaseIds: Gi088ResponseFirstV22RubricV13CaseId[];
  results: Gi088ResponseFirstV24CallResult[];
  codexDecision: Record<Phase, ReviewSummary | null>;
  productDecision: Record<Phase, ReviewSummary | null>;
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

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

async function loadFrozenLow(cwd: string) {
  const [privateSource, publicSource] = await Promise.all([
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V24_PATHS.frozenLowPrivateLedger), "utf8"),
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V24_PATHS.frozenLowPublicReceipt), "utf8")
  ]);
  const privateLedger = JSON.parse(privateSource) as {
    identity: string;
    planFingerprint: string;
    results: Array<{
      caseId: Gi088ResponseFirstV22RubricV13CaseId;
      rawOutput: string | null;
      responseHash: string | null;
      totalLatencyMs: number | null;
      status: string;
    }>;
    productDecision: { gatePassed?: boolean } | null;
  };
  const publicReceipt = JSON.parse(publicSource) as {
    identity: string;
    planFingerprint: string;
    candidateFingerprint: string;
    status: string;
    productDecision: { gatePassed?: boolean } | null;
    results: Array<{
      caseId: Gi088ResponseFirstV22RubricV13CaseId;
      responseHash: string | null;
    }>;
  };
  assert(
    privateLedger.identity ===
      "2026-08-17.gi088-response-first-v2-2-low-full-quality-v2" &&
      publicReceipt.identity === privateLedger.identity &&
      publicReceipt.planFingerprint === privateLedger.planFingerprint &&
      privateLedger.productDecision?.gatePassed === true &&
      publicReceipt.productDecision?.gatePassed === true &&
      publicReceipt.status === "low_quality_gate_passed_by_product_owner",
    "GI088_RESPONSE_FIRST_V24_FROZEN_LOW_GATE_INVALID"
  );
  const publicByCase = new Map(
    publicReceipt.results.map((item) => [item.caseId, item])
  );
  const results = privateLedger.results.map((item) => {
    assert(
      item.status === "valid" &&
        typeof item.rawOutput === "string" &&
        typeof item.responseHash === "string" &&
        typeof item.totalLatencyMs === "number" &&
        sha(item.rawOutput) === item.responseHash &&
        publicByCase.get(item.caseId)?.responseHash === item.responseHash,
      `GI088_RESPONSE_FIRST_V24_FROZEN_LOW_INVALID:${item.caseId}`
    );
    return {
      caseId: item.caseId,
      rawOutput: item.rawOutput,
      responseHash: item.responseHash,
      totalLatencyMs: item.totalLatencyMs
    } satisfies FrozenLowResult;
  });
  assert(results.length === 6, "GI088_RESPONSE_FIRST_V24_FROZEN_LOW_INCOMPLETE");
  return {
    identity: privateLedger.identity,
    planFingerprint: privateLedger.planFingerprint,
    candidateFingerprint: publicReceipt.candidateFingerprint,
    receiptSha256: sha(publicSource),
    results
  };
}

async function loadParentProbe(cwd: string) {
  const [startSource, receiptSource] = await Promise.all([
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V24_PATHS.parentProbeStartCard), "utf8"),
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V24_PATHS.parentProbeReceipt), "utf8")
  ]);
  const start = JSON.parse(startSource) as {
    identity: string;
    planFingerprint: string;
    candidateIdentity: { candidateFingerprint: string };
  };
  const receipt = JSON.parse(receiptSource) as {
    identity: string;
    planFingerprint: string;
    budget: { consumed: number };
    result: {
      caseId: string;
      status: string;
      finishReason: string | null;
      reasoningTokens: number | null;
      tokenUsage: { completionTokens?: number } | null;
      validationIssues: string[];
    } | null;
  };
  assert(
    start.identity ===
      "2026-08-17.gi088-response-first-v2-3-high-token-4000-probe-v1" &&
      receipt.identity === start.identity &&
      receipt.planFingerprint === start.planFingerprint &&
      receipt.budget.consumed === 1 &&
      receipt.result?.caseId === GI088_RESPONSE_FIRST_V24_FIRST_CASE_ID &&
      receipt.result.status === "contract_failure" &&
      receipt.result.finishReason === "stop" &&
      receipt.result.tokenUsage?.completionTokens === 2_072 &&
      receipt.result.reasoningTokens === 1_898 &&
      receipt.result.validationIssues.includes(
        "NULL_WORKING_TASK_UNDERSTANDING_DELTA_MUST_BE_NULL"
      ),
    "GI088_RESPONSE_FIRST_V24_PARENT_PROBE_INVALID"
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
  const runtime = GI088_RESPONSE_FIRST_V24_RUNTIME.high;
  return {
    messages: [
      { role: "system", content: getGi088ResponseFirstV24HighSystemPrompt() },
      {
        role: "user",
        content: createGi088ResponseFirstV24HighUserPrompt({
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

export async function createGi088ResponseFirstV24Plan(cwd = process.cwd()) {
  const standardSha256 = await fileSha(cwd, FILES.standard);
  assert(standardSha256 === GI088_RESPONSE_FIRST_V24_STANDARD_SHA256, "STANDARD_SHA256_MISMATCH");
  const [dataset, frozenLow, parentProbe] = await Promise.all([
    loadGi088ResponseFirstV22RubricV13Cases(cwd),
    loadFrozenLow(cwd),
    loadParentProbe(cwd)
  ]);
  const candidateIdentity = createGi088ResponseFirstV24Identity();
  assert(
    candidateIdentity.parentCandidateFingerprint ===
      parentProbe.candidateFingerprint &&
      candidateIdentity.frozenLowCandidateFingerprint ===
        frozenLow.candidateFingerprint,
    "GI088_RESPONSE_FIRST_V24_LINEAGE_INVALID"
  );
  const inputHashes = Object.fromEntries(
    await Promise.all(
      Object.entries(FILES).map(async ([key, relativePath]) => [
        `${key}Sha256`,
        await fileSha(cwd, relativePath)
      ])
    )
  ) as Record<string, string>;
  const lowByCase = new Map(frozenLow.results.map((item) => [item.caseId, item]));
  const bindCases = (
    phase: Phase,
    caseIds: readonly Gi088ResponseFirstV22RubricV13CaseId[]
  ) => caseIds.map((caseId, index) => {
    const item = dataset.cases.find((candidate) => candidate.caseId === caseId);
    const low = lowByCase.get(caseId);
    assert(item && low, `GI088_RESPONSE_FIRST_V24_CASE_BINDING_MISSING:${caseId}`);
    return {
      phase,
      order: index + 1,
      caseId,
      sourceCaseId: item.sourceCaseId,
      sourceFingerprint: item.sourceFingerprint,
      hardGate: item.hardGate,
      initialWorkingTask: item.turnInput.semanticState.workingTask
        ? "existing" as const
        : "null" as const,
      frozenLowHash: low.responseHash,
      frozenLowLatencyMs: low.totalLatencyMs,
      requestFingerprint: sha(requestForCase({ item, frozenLow: low.rawOutput }))
    };
  });
  const firstGate = bindCases("first_gate", [GI088_RESPONSE_FIRST_V24_FIRST_CASE_ID]);
  const remaining = bindCases("remaining", GI088_RESPONSE_FIRST_V24_REMAINING_CASE_IDS);
  const allEntries = [...firstGate, ...remaining];
  const nullWorkingTaskCount = allEntries.filter(
    (item) => item.initialWorkingTask === "null"
  ).length;
  const existingWorkingTaskCount = allEntries.filter(
    (item) => item.initialWorkingTask === "existing"
  ).length;
  assert(
    nullWorkingTaskCount === 4 && existingWorkingTaskCount === 2,
    `GI088_RESPONSE_FIRST_V24_STATE_CLASSIFICATION_INVALID:null=${nullWorkingTaskCount}:existing=${existingWorkingTaskCount}:total=${allEntries.length}`
  );
  const core = {
    schemaVersion: "1.0",
    identity: GI088_RESPONSE_FIRST_V24_HIGH_QUALITY_IDENTITY,
    status: "ready_authorized_waiting_first_gate",
    productDecision:
      "whether_null_task_submission_alignment_preserves_high_quality_and_satisfies_the_existing_state_contract",
    changedFactor: "null_working_task_submission_alignment_only",
    fixedFactors: {
      frozenLowRunIdentity: frozenLow.identity,
      frozenLowPlanFingerprint: frozenLow.planFingerprint,
      frozenLowCandidateFingerprint: frozenLow.candidateFingerprint,
      parentProbeIdentity: parentProbe.identity,
      parentProbePlanFingerprint: parentProbe.planFingerprint,
      parentProbeCandidateFingerprint: parentProbe.candidateFingerprint,
      parentProbeProductDecision: {
        internalUnderstanding: "pass",
        emptyVisibleAppend: "minor",
        completeChain: "no_go_state_contract"
      },
      model: GI088_RESPONSE_FIRST_V24_RUNTIME.model,
      thinking: GI088_RESPONSE_FIRST_V24_RUNTIME.high.thinking,
      reasoningEffort: GI088_RESPONSE_FIRST_V24_RUNTIME.high.reasoningEffort,
      maxTokens: GI088_RESPONSE_FIRST_V24_RUNTIME.high.maxTokens,
      datasetInput: "byte_identical_to_v22_rubric_v1_3",
      outputStructure: "byte_identical_to_v23_token_4000_parent",
      programValidation: "unchanged_strict_state_contract",
      nullWorkingTaskContractIssue:
        "NULL_WORKING_TASK_UNDERSTANDING_DELTA_MUST_BE_NULL",
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
      caseCount: 6,
      initialWorkingTask: {
        null: allEntries.filter((item) => item.initialWorkingTask === "null")
          .map((item) => item.caseId),
        existing: allEntries.filter((item) => item.initialWorkingTask === "existing")
          .map((item) => item.caseId)
      }
    },
    phases: { first_gate: firstGate, remaining },
    inputHashes,
    budget: {
      authorized: 6,
      firstGate: 1,
      remaining: 5,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    gate: {
      sourceReferences: "current_branch_valid_user_messages_only",
      frozenLowMustRemainByteIdentical: true,
      questions: "zero_or_one_to_three_with_one_answer_focus",
      firstGateProductContinuation: "pass_or_minor",
      hardCasesMustPass: 5,
      softCasesMaximumMinor: 1,
      fullRoundMedianTargetMs: 45_000,
      fullRoundSingleHardMs: 60_000,
      semanticAuthority: "product_owner"
    },
    reviewOrder: [
      "complete_relevant_user_and_assistant_context",
      "frozen_low_actual_output",
      "actual_high_raw_output_and_visible_projection",
      "technical_status_latency_tokens_and_source_validation",
      "codex_provisional_judgment",
      "product_owner_final_judgment"
    ],
    stopPoint:
      "one_first_case_then_wait_product_owner_pass_or_minor_before_remaining_five"
  } as const;
  return { ...core, planFingerprint: sha(core) };
}

function emptyLedger(plan: HighPlan): PrivateLedger {
  return {
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    preflight: null,
    startedCaseIds: [],
    results: [],
    codexDecision: { first_gate: null, remaining: null },
    productDecision: { first_gate: null, remaining: null }
  };
}

async function readFrozenPlan(cwd: string) {
  const plan = JSON.parse(
    await readFile(path.join(cwd, GI088_RESPONSE_FIRST_V24_PATHS.publicStartCard), "utf8")
  ) as HighPlan;
  assert(plan.identity === GI088_RESPONSE_FIRST_V24_HIGH_QUALITY_IDENTITY, "GI088_RESPONSE_FIRST_V24_START_CARD_IDENTITY_MISMATCH");
  assert(await fileSha(cwd, FILES.standard) === GI088_RESPONSE_FIRST_V24_STANDARD_SHA256, "STANDARD_SHA256_MISMATCH");
  const immutableKeys = [
    "candidate",
    "parentCandidate",
    "fixtures",
    "frozenLowReceipt",
    "parentProbeStartCard",
    "parentProbeReceipt",
    "provider",
    "providerContract",
    "runner"
  ] as const;
  for (const key of immutableKeys) {
    assert(
      await fileSha(cwd, FILES[key]) === plan.inputHashes[`${key}Sha256`],
      `GI088_RESPONSE_FIRST_V24_INPUT_DRIFT:${key}`
    );
  }
  const [dataset, frozenLow, parentProbe] = await Promise.all([
    loadGi088ResponseFirstV22RubricV13Cases(cwd),
    loadFrozenLow(cwd),
    loadParentProbe(cwd)
  ]);
  assert(
    dataset.datasetFingerprint === plan.dataset.fingerprint &&
      frozenLow.planFingerprint === plan.fixedFactors.frozenLowPlanFingerprint &&
      parentProbe.planFingerprint === plan.fixedFactors.parentProbePlanFingerprint,
    "GI088_RESPONSE_FIRST_V24_SOURCE_DRIFT"
  );
  return plan;
}

async function readLedger(cwd: string, plan: HighPlan) {
  const file = path.join(cwd, GI088_RESPONSE_FIRST_V24_PATHS.privateLedger);
  const ledger = await readFile(file, "utf8")
    .then((source) => JSON.parse(source) as PrivateLedger)
    .catch(() => emptyLedger(plan));
  assert(
    ledger.identity === plan.identity &&
      ledger.planFingerprint === plan.planFingerprint,
    "GI088_RESPONSE_FIRST_V24_LEDGER_IDENTITY_MISMATCH"
  );
  return ledger;
}

function phaseResults(ledger: PrivateLedger, phase: Phase) {
  return ledger.results.filter((item) => item.phase === phase);
}

function sanitizePublicResult(result: Gi088ResponseFirstV24CallResult) {
  const understanding = result.parsedHigh?.visibleAppend.correctableUnderstanding;
  const questions = result.parsedHigh?.semantic.nextResponse.decision === "ask"
    ? result.parsedHigh.semantic.nextResponse.questions
    : [];
  return {
    phase: result.phase,
    order: result.order,
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
    fullRound45sTargetPassed: result.fullRound45sTargetPassed,
    fullRound60sHardPassed: result.fullRound60sHardPassed,
    understandingPresent: Boolean(understanding),
    understandingEvidenceRefCount: understanding?.evidenceRefs.length ?? 0,
    understandingTextHash: understanding ? sha(understanding.text) : null,
    questionCount: questions.length,
    questionTextHashes: questions.map(sha),
    questionObservation: result.questionObservation,
    finishReason: result.diagnostics?.finishReason ?? null,
    reasoningTokens: result.diagnostics?.reasoningTokens ?? null,
    tokenUsage: result.diagnostics?.tokenUsage ?? null,
    responseModel: result.diagnostics?.responseModel ?? null,
    httpStatus: result.diagnostics?.httpStatus ?? null
  };
}

function receiptStatus(plan: HighPlan, ledger: PrivateLedger) {
  if (ledger.productDecision.remaining) {
    return ledger.productDecision.remaining.gatePassed
      ? "v24_offline_quality_gate_passed_by_product_owner"
      : "v24_offline_quality_gate_failed_by_product_owner";
  }
  if (phaseResults(ledger, "remaining").length > 0) {
    return phaseResults(ledger, "remaining").length === plan.phases.remaining.length
      ? ledger.codexDecision.remaining
        ? "waiting_product_owner_remaining_review"
        : "remaining_complete_waiting_codex_review"
      : "remaining_stopped_by_technical_contract_or_speed_gate";
  }
  if (ledger.productDecision.first_gate) {
    return ledger.productDecision.first_gate.continuationAllowed
      ? "first_gate_pass_or_minor_waiting_remaining"
      : "first_gate_failed_by_product_owner";
  }
  if (phaseResults(ledger, "first_gate").length === 1) {
    const result = phaseResults(ledger, "first_gate")[0]!;
    if (result.status !== "valid" || !result.fullRound60sHardPassed) {
      return "first_gate_technical_contract_or_speed_no_go";
    }
    return ledger.codexDecision.first_gate
      ? "waiting_product_owner_first_review"
      : "first_gate_complete_waiting_codex_review";
  }
  return ledger.startedCaseIds.length > 0
    ? "call_started_budget_consumed_requires_audit"
    : "ready_authorized_waiting_first_gate";
}

async function saveLedger(cwd: string, plan: HighPlan, ledger: PrivateLedger) {
  await writeJsonAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V24_PATHS.privateLedger),
    ledger,
    true
  );
  await writeJsonAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V24_PATHS.publicReceipt),
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
        consumed: ledger.startedCaseIds.length,
        completed: ledger.results.length,
        notRun: 6 - ledger.startedCaseIds.length,
        firstGateConsumed: ledger.startedCaseIds.includes(GI088_RESPONSE_FIRST_V24_FIRST_CASE_ID) ? 1 : 0,
        remainingConsumed: ledger.startedCaseIds.filter((caseId) =>
          GI088_RESPONSE_FIRST_V24_REMAINING_CASE_IDS.includes(
            caseId as (typeof GI088_RESPONSE_FIRST_V24_REMAINING_CASE_IDS)[number]
          )
        ).length,
        retries: 0,
        recovery: 0,
        fallback: 0
      },
      codexDecision: ledger.codexDecision,
      productDecision: ledger.productDecision,
      results: ledger.results.map(sanitizePublicResult),
      releaseBoundary: {
        pageIntegration: "not_run",
        commit: "not_run",
        push: "not_run",
        deployment: "not_run",
        preview: "not_run",
        production: "event_centered_baseline"
      },
      privateBoundary: {
        publicReceiptContainsUserLowOrHighBody: false,
        rawInputsLowHighAndReviews: "git_ignored_private_directory",
        reviewPresentationOrder: plan.reviewOrder
      }
    }
  );
  return ledger;
}

async function runCall(input: {
  phase: Phase;
  entry: HighPlan["phases"][Phase][number];
  item: Gi088ResponseFirstV22RubricV13Case;
  low: FrozenLowResult;
  provider: AIProvider;
}) {
  const request = requestForCase({ item: input.item, frozenLow: input.low.rawOutput });
  assert(
    sha(request) === input.entry.requestFingerprint &&
      sha(input.low.rawOutput) === input.entry.frozenLowHash,
    `GI088_RESPONSE_FIRST_V24_REQUEST_DRIFT:${input.entry.caseId}`
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
      const parsedHigh = parseGi088ResponseFirstV24HighOutput(completion.content);
      const validationIssues = validateGi088ResponseFirstV24HighAndProjection({
        turnInput: input.item.turnInput,
        frozenLow: input.low.rawOutput,
        high: parsedHigh
      });
      if (diagnostics?.responseModel !== GI088_RESPONSE_FIRST_V24_RUNTIME.model) {
        validationIssues.push(`RESPONSE_MODEL_MISMATCH:${diagnostics?.responseModel ?? "missing"}`);
      }
      if (diagnostics?.httpStatus !== 200) {
        validationIssues.push(`HIGH_HTTP_STATUS_INVALID:${diagnostics?.httpStatus ?? "missing"}`);
      }
      if (diagnostics?.finishReason !== "stop") {
        validationIssues.push(`HIGH_FINISH_REASON_INVALID:${diagnostics?.finishReason ?? "missing"}`);
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
        frozenLowHash: input.entry.frozenLowHash,
        frozenLowLatencyMs: input.low.totalLatencyMs,
        responseHash: sha(completion.content),
        responseLength: completion.content.length,
        rawOutput: completion.content,
        parsedHigh,
        validationIssues: [...new Set(validationIssues)],
        errorCode: status === "valid" ? null : "GI088_RESPONSE_FIRST_V24_CONTRACT_INVALID",
        highLatencyMs,
        fullRoundLatencyMs,
        fullRound45sTargetPassed: fullRoundLatencyMs <= 45_000,
        fullRound60sHardPassed: fullRoundLatencyMs <= 60_000,
        questionObservation: observeGi088ResponseFirstV24Questions(parsedHigh),
        diagnostics
      } satisfies Gi088ResponseFirstV24CallResult;
    } catch (error) {
      return {
        phase: input.phase,
        order: input.entry.order,
        caseId: input.entry.caseId,
        status: "contract_failure" as const,
        startedAt,
        completedAt: new Date().toISOString(),
        requestFingerprint: input.entry.requestFingerprint,
        frozenLowHash: input.entry.frozenLowHash,
        frozenLowLatencyMs: input.low.totalLatencyMs,
        responseHash: sha(completion.content),
        responseLength: completion.content.length,
        rawOutput: completion.content,
        parsedHigh: null,
        validationIssues: [error instanceof Error ? error.message : "HIGH_PARSE_FAILED"],
        errorCode: "GI088_RESPONSE_FIRST_V24_PARSE_FAILED",
        highLatencyMs,
        fullRoundLatencyMs,
        fullRound45sTargetPassed: fullRoundLatencyMs <= 45_000,
        fullRound60sHardPassed: fullRoundLatencyMs <= 60_000,
        questionObservation: null,
        diagnostics
      } satisfies Gi088ResponseFirstV24CallResult;
    }
  } catch (error) {
    const diagnostics = sanitizeAIProviderDiagnostics(getAIProviderDiagnostics(error));
    const highLatencyMs = diagnostics?.totalLatencyMs ?? Math.max(0, Date.now() - startedMs);
    const fullRoundLatencyMs = input.low.totalLatencyMs + highLatencyMs;
    return {
      phase: input.phase,
      order: input.entry.order,
      caseId: input.entry.caseId,
      status: "technical_failure" as const,
      startedAt,
      completedAt: new Date().toISOString(),
      requestFingerprint: input.entry.requestFingerprint,
      frozenLowHash: input.entry.frozenLowHash,
      frozenLowLatencyMs: input.low.totalLatencyMs,
      responseHash: null,
      responseLength: 0,
      rawOutput: null,
      parsedHigh: null,
      validationIssues: [],
      errorCode: getAIProviderFailureCode(error),
      highLatencyMs,
      fullRoundLatencyMs,
      fullRound45sTargetPassed: fullRoundLatencyMs <= 45_000,
      fullRound60sHardPassed: fullRoundLatencyMs <= 60_000,
      questionObservation: null,
      diagnostics
    } satisfies Gi088ResponseFirstV24CallResult;
  }
}

export async function runGi088ResponseFirstV24Phase(input: {
  cwd?: string;
  workspaceRoot?: string;
  plan: HighPlan;
  provider: AIProvider;
  phase: Phase;
}) {
  const cwd = input.cwd ?? process.cwd();
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const ledger = await readLedger(cwd, input.plan);
  const existing = phaseResults(ledger, input.phase);
  if (existing.length === input.plan.phases[input.phase].length) {
    return saveLedger(cwd, input.plan, ledger);
  }
  assert(
    ledger.startedCaseIds.length === ledger.results.length,
    "GI088_RESPONSE_FIRST_V24_STARTED_CALL_REQUIRES_AUDIT"
  );
  assert(existing.length === 0, `GI088_RESPONSE_FIRST_V24_PARTIAL_PHASE_REQUIRES_AUDIT:${input.phase}`);
  if (input.phase === "remaining") {
    assert(
      ledger.productDecision.first_gate?.continuationAllowed === true,
      "GI088_RESPONSE_FIRST_V24_REMAINING_REQUIRES_PRODUCT_FIRST_PASS_OR_MINOR"
    );
  }
  const [dataset, frozenLow] = await Promise.all([
    loadGi088ResponseFirstV22RubricV13Cases(workspaceRoot),
    loadFrozenLow(workspaceRoot)
  ]);
  const lowByCase = new Map(frozenLow.results.map((item) => [item.caseId, item]));
  for (const entry of input.plan.phases[input.phase]) {
    const item = dataset.cases.find((candidate) => candidate.caseId === entry.caseId);
    const low = lowByCase.get(entry.caseId);
    assert(item && low, `GI088_RESPONSE_FIRST_V24_CASE_LOST:${entry.caseId}`);
    ledger.startedCaseIds.push(entry.caseId);
    await saveLedger(cwd, input.plan, ledger);
    const result = await runCall({
      phase: input.phase,
      entry,
      item,
      low,
      provider: input.provider
    });
    ledger.results.push(result);
    await saveLedger(cwd, input.plan, ledger);
    if (result.status !== "valid" || !result.fullRound60sHardPassed) break;
  }
  return saveLedger(cwd, input.plan, ledger);
}

export function evaluateGi088ResponseFirstV24Review(input: {
  plan: HighPlan;
  phase: Phase;
  results: Gi088ResponseFirstV24CallResult[];
  decisions: Gi088ResponseFirstV24ReviewDecision[];
  firstGateResults?: Gi088ResponseFirstV24CallResult[];
  firstGateReview?: {
    allCallsValid: boolean;
    completeReview: boolean;
    counts: { pass: number; minor: number; fail: number };
  } | null;
}) {
  const entries = input.plan.phases[input.phase];
  const expectedIds = new Set(entries.map((item) => item.caseId));
  const byCase = new Map(input.decisions.map((item) => [item.caseId, item]));
  const completeReview = input.decisions.length === entries.length &&
    byCase.size === entries.length &&
    input.decisions.every((item) => expectedIds.has(item.caseId));
  const allCallsValid = input.results.length === entries.length &&
    input.results.every((item) => item.status === "valid" && item.fullRound60sHardPassed);
  const counts = {
    pass: input.decisions.filter((item) => item.verdict === "pass").length,
    minor: input.decisions.filter((item) => item.verdict === "minor").length,
    fail: input.decisions.filter((item) => item.verdict === "fail").length
  };
  const continuationAllowed = input.phase === "first_gate" &&
    allCallsValid && completeReview && counts.fail === 0 && counts.pass + counts.minor === 1;
  const allResults = input.phase === "remaining"
    ? [...(input.firstGateResults ?? []), ...input.results]
    : input.results;
  const medianFullRoundLatencyMs = median(allResults.map((item) => item.fullRoundLatencyMs));
  const medianTargetPassed = medianFullRoundLatencyMs !== null &&
    medianFullRoundLatencyMs <= 45_000;
  const hardCasesPass = entries
    .filter((item) => item.hardGate)
    .every((item) => byCase.get(item.caseId)?.verdict === "pass");
  const softMinorCount = entries
    .filter((item) => !item.hardGate)
    .filter((item) => byCase.get(item.caseId)?.verdict === "minor").length;
  const softFail = entries
    .filter((item) => !item.hardGate)
    .some((item) => byCase.get(item.caseId)?.verdict === "fail");
  const overallHardCasesPass = input.phase === "first_gate"
    ? hardCasesPass
    : hardCasesPass &&
      input.firstGateReview?.allCallsValid === true &&
      input.firstGateReview.completeReview === true &&
      input.firstGateReview.counts.pass === 1;
  const phaseQualityPassed = input.phase === "first_gate"
    ? continuationAllowed
    : allCallsValid && completeReview && overallHardCasesPass &&
      !softFail && softMinorCount <= 1 && medianTargetPassed;
  return {
    phase: input.phase,
    status: phaseQualityPassed
      ? `v24_${input.phase}_quality_gate_passed`
      : `v24_${input.phase}_quality_gate_failed`,
    gatePassed: phaseQualityPassed,
    continuationAllowed,
    allCallsValid,
    completeReview,
    hardCasesPass,
    overallHardCasesPass,
    softMinorCount,
    medianFullRoundLatencyMs,
    medianTargetPassed,
    counts
  };
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
  workspaceRoot: string;
  plan: HighPlan;
  phase: Phase;
  results: Gi088ResponseFirstV24CallResult[];
  decisions: Gi088ResponseFirstV24ReviewDecision[];
}) {
  const [dataset, frozenLow] = await Promise.all([
    loadGi088ResponseFirstV22RubricV13Cases(input.workspaceRoot),
    loadFrozenLow(input.workspaceRoot)
  ]);
  const lowByCase = new Map(frozenLow.results.map((item) => [item.caseId, item]));
  const reviewByCase = new Map(input.decisions.map((item) => [item.caseId, item]));
  const cards = input.results.map((result) => {
    const item = dataset.cases.find((candidate) => candidate.caseId === result.caseId)!;
    const low = lowByCase.get(result.caseId)!;
    const review = reviewByCase.get(result.caseId);
    const transcript = item.turnInput.conversation.map((message) =>
      `<p><strong>${message.role === "user" ? "用户" : "AI"} ${escapeHtml(message.id)}</strong>：${escapeHtml(message.content)}</p>`
    ).join("\n");
    const delivery = result.parsedHigh
      ? projectGi088ResponseFirstV24VisibleDelivery({ frozenLow: low.rawOutput, high: result.parsedHigh })
      : null;
    const understanding = delivery?.highUnderstanding
      ? `<p>${escapeHtml(delivery.highUnderstanding.text)}</p><p>依据：${delivery.highUnderstanding.evidenceRefs.map(escapeHtml).join("、")}</p>`
      : "<p>无追加理解</p>";
    const questions = delivery?.questions.length
      ? `<ol>${delivery.questions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ol>`
      : "<p>无问题</p>";
    return `<article class="card"><p>${result.caseId}</p><h2>${escapeHtml(item.title)}</h2><section><h3>1. 完整相关原文</h3>${transcript}</section><section><h3>2. 冻结 Low</h3><p>${escapeHtml(low.rawOutput)}</p></section><section><h3>3. High 实际原始输出</h3><pre>${escapeHtml(result.rawOutput ?? "")}</pre></section><section><h3>4. 同气泡可见追加</h3>${understanding}${questions}</section><section><h3>5. 技术事实</h3><p>${result.status} · High ${result.highLatencyMs}ms · 两段 ${result.fullRoundLatencyMs}ms · ${escapeHtml(result.validationIssues.join("；") || "来源与合同有效")}</p></section><section><h3>6. Codex 初评</h3><p><strong>${review?.verdict ?? "待评"}</strong>　${escapeHtml(review?.note ?? "")}</p></section></article>`;
  }).join("\n");
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GI-088 v2.4 ${input.phase}</title><style>:root{font-family:ui-sans-serif,system-ui;background:#f4f1ea;color:#211f1b}body{margin:0}.wrap{max-width:960px;margin:auto;padding:36px 20px 110px}.card{background:#fffdf8;border:1px solid #d8d1c4;border-radius:20px;padding:22px;margin:18px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f1e8;padding:12px;border-radius:12px}section{border-top:1px solid #e7e0d4;padding-top:12px;margin-top:16px}</style></head><body><main class="wrap"><h1>v2.4 ${input.phase}</h1><p>完整原文 → Low → High → 技术事实 → Codex 初评。</p>${cards}</main></body></html>`;
  const relative = input.phase === "first_gate"
    ? GI088_RESPONSE_FIRST_V24_PATHS.privateFirstReviewHtml
    : GI088_RESPONSE_FIRST_V24_PATHS.privateRemainingReviewHtml;
  const file = path.join(input.cwd, relative);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, html, { mode: 0o600 });
  await chmod(file, 0o600);
  return relative;
}

async function readReview(
  file: string,
  plan: HighPlan,
  phase: Phase,
  reviewerRole: "codex" | "product_owner"
) {
  const review = JSON.parse(await readFile(file, "utf8")) as {
    identity: string;
    planFingerprint: string;
    phase: Phase;
    reviewerRole: "codex" | "product_owner";
    decisions: Gi088ResponseFirstV24ReviewDecision[];
  };
  assert(
    review.identity === plan.identity &&
      review.planFingerprint === plan.planFingerprint &&
      review.phase === phase &&
      review.reviewerRole === reviewerRole,
    "GI088_RESPONSE_FIRST_V24_REVIEW_IDENTITY_MISMATCH"
  );
  return review;
}

async function prepare(cwd: string) {
  const file = path.join(cwd, GI088_RESPONSE_FIRST_V24_PATHS.publicStartCard);
  if (await pathExists(file)) return readFrozenPlan(cwd);
  const plan = await createGi088ResponseFirstV24Plan(cwd);
  await writeJsonAtomic(file, plan);
  await saveLedger(cwd, plan, emptyLedger(plan));
  return plan;
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
    assert(response.ok, `GI088_RESPONSE_FIRST_V24_MODEL_LIST_HTTP_${response.status}`);
    const payload = JSON.parse(source) as { data?: Array<{ id?: unknown }> };
    const modelIds = (payload.data ?? []).flatMap((item) =>
      typeof item.id === "string" ? [item.id] : []
    );
    assert(modelIds.includes(GI088_RESPONSE_FIRST_V24_RUNTIME.model), "GI088_RESPONSE_FIRST_V24_TARGET_MODEL_UNAVAILABLE");
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

async function providerForExecution(cwd: string, plan: HighPlan) {
  loadEnvConfig(cwd, true);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  assert(apiKey, "GI088_RESPONSE_FIRST_V24_DEEPSEEK_API_KEY_MISSING");
  const ledger = await readLedger(cwd, plan);
  if (!ledger.preflight) {
    ledger.preflight = await checkTargetModel(apiKey);
    await saveLedger(cwd, plan, ledger);
  }
  return new OpenAIProvider({
    apiKey,
    model: GI088_RESPONSE_FIRST_V24_RUNTIME.model,
    baseUrl: "https://api.deepseek.com",
    timeoutMs: GI088_RESPONSE_FIRST_V24_RUNTIME.high.hardTimeoutMs
  });
}

async function executePhase(cwd: string, phase: Phase) {
  const plan = await prepare(cwd);
  const provider = await providerForExecution(cwd, plan);
  const ledger = await runGi088ResponseFirstV24Phase({
    cwd,
    workspaceRoot: cwd,
    plan,
    provider,
    phase
  });
  process.stdout.write(`${JSON.stringify({
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    phase,
    status: receiptStatus(plan, ledger),
    callsConsumed: ledger.startedCaseIds.length,
    callsCompleted: ledger.results.length,
    publicReceipt: GI088_RESPONSE_FIRST_V24_PATHS.publicReceipt
  }, null, 2)}\n`);
}

async function finalizeReview(
  cwd: string,
  phase: Phase,
  reviewerRole: "codex" | "product_owner"
) {
  const plan = await readFrozenPlan(cwd);
  const ledger = await readLedger(cwd, plan);
  const results = phaseResults(ledger, phase);
  assert(results.length === plan.phases[phase].length, `GI088_RESPONSE_FIRST_V24_RESULTS_INCOMPLETE:${phase}`);
  const relative = phase === "first_gate"
    ? reviewerRole === "codex"
      ? GI088_RESPONSE_FIRST_V24_PATHS.privateFirstCodexReview
      : GI088_RESPONSE_FIRST_V24_PATHS.privateFirstProductReview
    : reviewerRole === "codex"
      ? GI088_RESPONSE_FIRST_V24_PATHS.privateRemainingCodexReview
      : GI088_RESPONSE_FIRST_V24_PATHS.privateRemainingProductReview;
  const review = await readReview(path.join(cwd, relative), plan, phase, reviewerRole);
  const summary = evaluateGi088ResponseFirstV24Review({
    plan,
    phase,
    results,
    decisions: review.decisions,
    firstGateResults: phaseResults(ledger, "first_gate"),
    firstGateReview:
      ledger[reviewerRole === "codex" ? "codexDecision" : "productDecision"]
        .first_gate
  });
  ledger[reviewerRole === "codex" ? "codexDecision" : "productDecision"][phase] = summary;
  if (reviewerRole === "codex") {
    await writeReviewHtml({
      cwd,
      workspaceRoot: cwd,
      plan,
      phase,
      results,
      decisions: review.decisions
    });
  }
  await saveLedger(cwd, plan, ledger);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

async function main() {
  const cwd = process.cwd();
  const command = process.env.GI088_RESPONSE_FIRST_V24_COMMAND ??
    process.argv[2] ?? "--prepare";
  if (command === "--execute-first") return executePhase(cwd, "first_gate");
  if (command === "--finalize-first-codex") return finalizeReview(cwd, "first_gate", "codex");
  if (command === "--finalize-first-product") return finalizeReview(cwd, "first_gate", "product_owner");
  if (command === "--execute-remaining") return executePhase(cwd, "remaining");
  if (command === "--finalize-remaining-codex") return finalizeReview(cwd, "remaining", "codex");
  if (command === "--finalize-remaining-product") return finalizeReview(cwd, "remaining", "product_owner");
  const plan = await prepare(cwd);
  process.stdout.write(`${JSON.stringify({
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    status: plan.status,
    budget: plan.budget,
    initialWorkingTask: plan.dataset.initialWorkingTask,
    publicStartCard: GI088_RESPONSE_FIRST_V24_PATHS.publicStartCard
  }, null, 2)}\n`);
}

if (
  process.env.VITEST !== "true" &&
  (process.env.GI088_RESPONSE_FIRST_V24_COMMAND ||
    (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(RUNNER_FILE)))
) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
