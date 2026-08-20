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
  GI088_RESPONSE_FIRST_V23_RUNTIME,
  createGi088ResponseFirstV23HighUserPrompt,
  createGi088ResponseFirstV23Identity,
  getGi088ResponseFirstV23HighSystemPrompt,
  observeGi088ResponseFirstV23Questions,
  parseGi088ResponseFirstV23HighOutput,
  projectGi088ResponseFirstV23VisibleDelivery,
  validateGi088ResponseFirstV23HighAndProjection,
  type Gi088ResponseFirstV23HighOutput
} from "../evals/event-centered-generative/gi088-response-first-v2-3/candidate";
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

export const GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_IDENTITY =
  "2026-08-17.gi088-response-first-v2-3-high-quality-v1" as const;
export const GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_STANDARD_SHA256 =
  "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60" as const;

export const GI088_RESPONSE_FIRST_V23_HIGH_CHECKPOINT_CASE_IDS = [
  "RPR-REAL-19-CORRECTION",
  "RPR-REAL-19-CONTINUE",
  "RPR-REAL-13"
] as const satisfies readonly Gi088ResponseFirstV22RubricV13CaseId[];

type Phase = "checkpoint" | "full";

const PRIVATE_ROOT =
  `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-3/high-quality-v1`;

export const GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_PATHS = {
  privateLedger: `${PRIVATE_ROOT}/ledger.json`,
  privateCheckpointCodexReview: `${PRIVATE_ROOT}/checkpoint-codex-review.json`,
  privateCheckpointProductReview: `${PRIVATE_ROOT}/checkpoint-product-review.json`,
  privateCheckpointReviewHtml: `${PRIVATE_ROOT}/checkpoint-review.html`,
  privateFullCodexReview: `${PRIVATE_ROOT}/full-codex-review.json`,
  privateFullProductReview: `${PRIVATE_ROOT}/full-product-review.json`,
  privateFullReviewHtml: `${PRIVATE_ROOT}/full-review.html`,
  publicStartCard:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-3-high-quality-v1-start-card.json`,
  publicReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-3-high-quality-v1-receipt.json`,
  publicHandoff:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-3-high-quality-v1-handoff.md`,
  frozenLowPrivateLedger:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-2/low-full-quality-v2/ledger.json`,
  frozenLowPublicReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-2-low-full-quality-v2-receipt.json`
} as const;

const RUNNER_FILE =
  "scripts/run-gi088-response-first-v2-3-high-quality.ts";
const FILES = {
  standard: "docs/ai-evaluation-standard.md",
  plan:
    "docs/plans/2026-08-17-gi088-response-first-v2-2-review-go-continuation.md",
  candidate:
    "evals/event-centered-generative/gi088-response-first-v2-3/candidate.ts",
  parentCandidate:
    "evals/event-centered-generative/gi088-response-first-v2-2/candidate.ts",
  fixtures: "scripts/gi088-response-first-v2-2-rubric-v1-3-fixtures.ts",
  frozenLowReceipt:
    GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_PATHS.frozenLowPublicReceipt,
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

export type Gi088ResponseFirstV23HighCallResult = {
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
  parsedHigh: Gi088ResponseFirstV23HighOutput | null;
  validationIssues: string[];
  errorCode: string | null;
  highLatencyMs: number | null;
  fullRoundLatencyMs: number | null;
  fullRound45sTargetPassed: boolean;
  fullRound60sHardPassed: boolean;
  questionObservation: ReturnType<
    typeof observeGi088ResponseFirstV23Questions
  > | null;
  diagnostics: ReturnType<typeof sanitizeAIProviderDiagnostics>;
};

export type Gi088ResponseFirstV23HighReviewDecision = {
  caseId: Gi088ResponseFirstV22RubricV13CaseId;
  verdict: "pass" | "minor" | "fail";
  note: string;
};

type HighPlan = Awaited<ReturnType<typeof createGi088ResponseFirstV23HighPlan>>;
type ReviewSummary = ReturnType<typeof evaluateGi088ResponseFirstV23HighReview>;
type PrivateLedger = {
  identity: string;
  planFingerprint: string;
  preflight: {
    checkedAt: string;
    httpStatus: number;
    targetModelAvailable: boolean;
    modelListHash: string;
  } | null;
  results: Gi088ResponseFirstV23HighCallResult[];
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
    readFile(
      path.join(cwd, GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_PATHS.frozenLowPrivateLedger),
      "utf8"
    ),
    readFile(
      path.join(cwd, GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_PATHS.frozenLowPublicReceipt),
      "utf8"
    )
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
    productDecision: { gatePassed?: boolean; counts?: unknown } | null;
  };
  const publicReceipt = JSON.parse(publicSource) as {
    identity: string;
    planFingerprint: string;
    candidateFingerprint: string;
    status: string;
    productDecision: { gatePassed?: boolean; counts?: unknown } | null;
    results: Array<{
      caseId: Gi088ResponseFirstV22RubricV13CaseId;
      responseHash: string | null;
    }>;
  };
  assert(
    privateLedger.identity ===
      "2026-08-17.gi088-response-first-v2-2-low-full-quality-v2" &&
      publicReceipt.identity === privateLedger.identity,
    "GI088_RESPONSE_FIRST_V23_FROZEN_LOW_IDENTITY_INVALID"
  );
  assert(
    publicReceipt.planFingerprint === privateLedger.planFingerprint,
    "GI088_RESPONSE_FIRST_V23_FROZEN_LOW_PLAN_INVALID"
  );
  assert(
    privateLedger.productDecision?.gatePassed === true &&
      publicReceipt.productDecision?.gatePassed === true &&
      publicReceipt.status === "low_quality_gate_passed_by_product_owner",
    "GI088_RESPONSE_FIRST_V23_FROZEN_LOW_PRODUCT_GATE_NOT_PASSED"
  );
  assert(
    privateLedger.results.length === 6 && publicReceipt.results.length === 6,
    "GI088_RESPONSE_FIRST_V23_FROZEN_LOW_RESULTS_INCOMPLETE"
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
      `GI088_RESPONSE_FIRST_V23_FROZEN_LOW_RESULT_INVALID:${item.caseId}`
    );
    return {
      caseId: item.caseId,
      rawOutput: item.rawOutput,
      responseHash: item.responseHash,
      totalLatencyMs: item.totalLatencyMs
    } satisfies FrozenLowResult;
  });
  return {
    identity: privateLedger.identity,
    planFingerprint: privateLedger.planFingerprint,
    candidateFingerprint: publicReceipt.candidateFingerprint,
    productDecision: publicReceipt.productDecision,
    receiptSha256: sha(publicSource),
    results
  };
}

function requestForCase(input: {
  item: Gi088ResponseFirstV22RubricV13Case;
  frozenLow: string;
}): AICompletionParams {
  const runtime = GI088_RESPONSE_FIRST_V23_RUNTIME.high;
  return {
    messages: [
      {
        role: "system",
        content: getGi088ResponseFirstV23HighSystemPrompt()
      },
      {
        role: "user",
        content: createGi088ResponseFirstV23HighUserPrompt({
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

export async function createGi088ResponseFirstV23HighPlan(
  cwd = process.cwd()
) {
  const standardSha256 = await fileSha(cwd, FILES.standard);
  assert(
    standardSha256 === GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_STANDARD_SHA256,
    "STANDARD_SHA256_MISMATCH"
  );
  const [dataset, frozenLow] = await Promise.all([
    loadGi088ResponseFirstV22RubricV13Cases(cwd),
    loadFrozenLow(cwd)
  ]);
  const candidateIdentity = createGi088ResponseFirstV23Identity();
  assert(
    candidateIdentity.frozenLowCandidateFingerprint ===
      frozenLow.candidateFingerprint,
    "GI088_RESPONSE_FIRST_V23_LOW_CANDIDATE_DRIFT"
  );
  const inputHashes = Object.fromEntries(
    await Promise.all(
      Object.entries(FILES).map(async ([key, relativePath]) => [
        `${key}Sha256`,
        await fileSha(cwd, relativePath)
      ])
    )
  ) as Record<string, string>;
  const lowByCase = new Map(
    frozenLow.results.map((item) => [item.caseId, item])
  );
  const bindCases = (
    phase: Phase,
    caseIds: readonly Gi088ResponseFirstV22RubricV13CaseId[]
  ) => caseIds.map((caseId, index) => {
    const item = dataset.cases.find((candidate) => candidate.caseId === caseId);
    const low = lowByCase.get(caseId);
    assert(item && low, `GI088_RESPONSE_FIRST_V23_CASE_BINDING_MISSING:${caseId}`);
    return {
      phase,
      order: index + 1,
      caseId,
      sourceCaseId: item.sourceCaseId,
      sourceFingerprint: item.sourceFingerprint,
      hardGate: item.hardGate,
      frozenLowHash: low.responseHash,
      frozenLowLatencyMs: low.totalLatencyMs,
      requestFingerprint: sha(requestForCase({ item, frozenLow: low.rawOutput }))
    };
  });
  const core = {
    schemaVersion: "1.0",
    identity: GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_IDENTITY,
    status: "ready_authorized_waiting_checkpoint",
    productDecision:
      "whether_grounded_high_adds_a_faithful_correctable_understanding_and_one_shared_answer_focus_without_changing_frozen_low",
    changedFactor: "grounded_correctable_high_visible_append_only",
    fixedFactors: {
      frozenLowRunIdentity: frozenLow.identity,
      frozenLowPlanFingerprint: frozenLow.planFingerprint,
      frozenLowCandidateFingerprint: frozenLow.candidateFingerprint,
      frozenLowProductDecision: frozenLow.productDecision,
      model: GI088_RESPONSE_FIRST_V23_RUNTIME.model,
      thinking: GI088_RESPONSE_FIRST_V23_RUNTIME.high.thinking,
      reasoningEffort: GI088_RESPONSE_FIRST_V23_RUNTIME.high.reasoningEffort,
      maxTokens: GI088_RESPONSE_FIRST_V23_RUNTIME.high.maxTokens,
      questionStrategy: "information_gain_B",
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
      caseCount: dataset.cases.length
    },
    phases: {
      checkpoint: bindCases(
        "checkpoint",
        GI088_RESPONSE_FIRST_V23_HIGH_CHECKPOINT_CASE_IDS
      ),
      full: bindCases(
        "full",
        dataset.cases.map((item) => item.caseId)
      )
    },
    inputHashes,
    budget: {
      authorized: 9,
      checkpoint: 3,
      full: 6,
      retries: 0,
      recovery: 0,
      fallback: 0,
      continuationOfflineBudgetAuthorized: 15,
      continuationOfflineBudgetAlreadyConsumedByLow: 6
    },
    gate: {
      sourceReferences: "current_branch_user_messages_only",
      frozenLowMustRemainByteIdentical: true,
      questions: "zero_or_one_to_three_with_one_answer_focus",
      questionPunctuation: "observation_only",
      checkpointProductQuality: "3_pass_0_minor_0_fail",
      fullHardCasesMustPass: 5,
      fullSoftCasesMaximumMinor: 1,
      fullRoundMedianTargetMs: 45_000,
      fullRoundSingleHardMs: 60_000,
      semanticAuthority: "product_owner"
    },
    reviewOrder: [
      "complete_relevant_user_and_assistant_context",
      "frozen_low_actual_output",
      "actual_high_raw_output_and_visible_projection",
      "technical_status_latency_and_source_validation",
      "codex_provisional_judgment",
      "product_owner_final_judgment"
    ],
    stopPoint:
      "checkpoint_three_then_wait_product_owner_before_full_six_or_integration"
  } as const;
  return { ...core, planFingerprint: sha(core) };
}

function emptyLedger(plan: HighPlan): PrivateLedger {
  return {
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    preflight: null,
    results: [],
    codexDecision: { checkpoint: null, full: null },
    productDecision: { checkpoint: null, full: null }
  };
}

async function readFrozenPlan(cwd: string) {
  const file = path.join(
    cwd,
    GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_PATHS.publicStartCard
  );
  const plan = JSON.parse(await readFile(file, "utf8")) as HighPlan;
  assert(
    plan.identity === GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_IDENTITY,
    "GI088_RESPONSE_FIRST_V23_START_CARD_IDENTITY_MISMATCH"
  );
  assert(
    await fileSha(cwd, FILES.standard) ===
      GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_STANDARD_SHA256,
    "STANDARD_SHA256_MISMATCH"
  );
  const immutableKeys = [
    "candidate",
    "parentCandidate",
    "fixtures",
    "frozenLowReceipt",
    "provider",
    "providerContract",
    "runner"
  ] as const;
  for (const key of immutableKeys) {
    assert(
      await fileSha(cwd, FILES[key]) === plan.inputHashes[`${key}Sha256`],
      `GI088_RESPONSE_FIRST_V23_FROZEN_PLAN_INPUT_DRIFT:${key}`
    );
  }
  const [dataset, frozenLow] = await Promise.all([
    loadGi088ResponseFirstV22RubricV13Cases(cwd),
    loadFrozenLow(cwd)
  ]);
  assert(
    dataset.datasetFingerprint === plan.dataset.fingerprint &&
      frozenLow.planFingerprint === plan.fixedFactors.frozenLowPlanFingerprint &&
      frozenLow.candidateFingerprint ===
        plan.fixedFactors.frozenLowCandidateFingerprint,
    "GI088_RESPONSE_FIRST_V23_FROZEN_PLAN_SOURCE_DRIFT"
  );
  return plan;
}

async function readLedger(cwd: string, plan: HighPlan) {
  const file = path.join(
    cwd,
    GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_PATHS.privateLedger
  );
  const ledger = await readFile(file, "utf8")
    .then((source) => JSON.parse(source) as PrivateLedger)
    .catch(() => emptyLedger(plan));
  assert(
    ledger.identity === plan.identity &&
      ledger.planFingerprint === plan.planFingerprint,
    "GI088_RESPONSE_FIRST_V23_LEDGER_IDENTITY_MISMATCH"
  );
  return ledger;
}

function phaseResults(ledger: PrivateLedger, phase: Phase) {
  return ledger.results.filter((item) => item.phase === phase);
}

function sanitizePublicResult(result: Gi088ResponseFirstV23HighCallResult) {
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
  if (ledger.productDecision.full) {
    return ledger.productDecision.full.gatePassed
      ? "high_full_quality_gate_passed_by_product_owner"
      : "high_full_quality_gate_failed_by_product_owner";
  }
  if (phaseResults(ledger, "full").length > 0) {
    return phaseResults(ledger, "full").length === plan.phases.full.length
      ? ledger.codexDecision.full
        ? "waiting_product_owner_full_review"
        : "full_complete_waiting_codex_review"
      : "full_running";
  }
  if (ledger.productDecision.checkpoint) {
    return ledger.productDecision.checkpoint.gatePassed
      ? "checkpoint_gate_passed_waiting_full"
      : "checkpoint_gate_failed_by_product_owner";
  }
  if (phaseResults(ledger, "checkpoint").length === plan.phases.checkpoint.length) {
    return ledger.codexDecision.checkpoint
      ? "waiting_product_owner_checkpoint_review"
      : "checkpoint_complete_waiting_codex_review";
  }
  return phaseResults(ledger, "checkpoint").length > 0
    ? "checkpoint_running"
    : "ready_authorized_waiting_checkpoint";
}

async function saveLedger(cwd: string, plan: HighPlan, ledger: PrivateLedger) {
  await writeJsonAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_PATHS.privateLedger),
    ledger,
    true
  );
  await writeJsonAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_PATHS.publicReceipt),
    {
      schemaVersion: "1.0",
      identity: plan.identity,
      planFingerprint: plan.planFingerprint,
      candidateFingerprint: plan.candidateIdentity.candidateFingerprint,
      datasetFingerprint: plan.dataset.fingerprint,
      frozenLowRunIdentity: plan.fixedFactors.frozenLowRunIdentity,
      frozenLowPlanFingerprint: plan.fixedFactors.frozenLowPlanFingerprint,
      frozenLowCandidateFingerprint:
        plan.fixedFactors.frozenLowCandidateFingerprint,
      status: receiptStatus(plan, ledger),
      preflight: ledger.preflight,
      budget: {
        authorized: 9,
        consumed: ledger.results.length,
        notRun: 9 - ledger.results.length,
        checkpointConsumed: phaseResults(ledger, "checkpoint").length,
        fullConsumed: phaseResults(ledger, "full").length,
        retries: 0,
        recovery: 0,
        fallback: 0
      },
      codexDecision: ledger.codexDecision,
      productDecision: ledger.productDecision,
      results: ledger.results.map(sanitizePublicResult),
      privateBoundary: {
        rawInputsLowHighAndReviews: "git_ignored_private_directory",
        publicReceiptContainsUserLowOrHighBody: false,
        reviewPresentationOrder: plan.reviewOrder
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
      `GI088_RESPONSE_FIRST_V23_MODEL_LIST_HTTP_${response.status}`
    );
    const payload = JSON.parse(source) as { data?: Array<{ id?: unknown }> };
    const modelIds = (payload.data ?? []).flatMap((item) =>
      typeof item.id === "string" ? [item.id] : []
    );
    assert(
      modelIds.includes(GI088_RESPONSE_FIRST_V23_RUNTIME.model),
      "GI088_RESPONSE_FIRST_V23_TARGET_MODEL_UNAVAILABLE"
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
  phase: Phase;
  entry: HighPlan["phases"][Phase][number];
  item: Gi088ResponseFirstV22RubricV13Case;
  low: FrozenLowResult;
  provider: AIProvider;
}) {
  const request = requestForCase({
    item: input.item,
    frozenLow: input.low.rawOutput
  });
  assert(
    sha(request) === input.entry.requestFingerprint &&
      sha(input.low.rawOutput) === input.entry.frozenLowHash,
    `GI088_RESPONSE_FIRST_V23_REQUEST_DRIFT:${input.phase}:${input.entry.caseId}`
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
      const parsedHigh = parseGi088ResponseFirstV23HighOutput(completion.content);
      const validationIssues = validateGi088ResponseFirstV23HighAndProjection({
        turnInput: input.item.turnInput,
        frozenLow: input.low.rawOutput,
        high: parsedHigh
      });
      if (
        diagnostics?.responseModel &&
        diagnostics.responseModel !== GI088_RESPONSE_FIRST_V23_RUNTIME.model
      ) {
        validationIssues.push(
          `RESPONSE_MODEL_MISMATCH:${diagnostics.responseModel}`
        );
      }
      if (diagnostics?.finishReason === "length") {
        validationIssues.push("HIGH_OUTPUT_TRUNCATED_BY_TOKEN_LIMIT");
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
        errorCode: status === "valid"
          ? null
          : "GI088_RESPONSE_FIRST_V23_CONTRACT_INVALID",
        highLatencyMs,
        fullRoundLatencyMs,
        fullRound45sTargetPassed: status === "valid" && fullRoundLatencyMs <= 45_000,
        fullRound60sHardPassed: status === "valid" && fullRoundLatencyMs <= 60_000,
        questionObservation: observeGi088ResponseFirstV23Questions(parsedHigh),
        diagnostics
      } satisfies Gi088ResponseFirstV23HighCallResult;
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
        validationIssues: [
          error instanceof Error ? error.message : "HIGH_PARSE_FAILED"
        ],
        errorCode: "GI088_RESPONSE_FIRST_V23_PARSE_FAILED",
        highLatencyMs,
        fullRoundLatencyMs,
        fullRound45sTargetPassed: false,
        fullRound60sHardPassed: false,
        questionObservation: null,
        diagnostics
      } satisfies Gi088ResponseFirstV23HighCallResult;
    }
  } catch (error) {
    const diagnostics = sanitizeAIProviderDiagnostics(
      getAIProviderDiagnostics(error)
    );
    const highLatencyMs = diagnostics?.totalLatencyMs ??
      Math.max(0, Date.now() - startedMs);
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
      fullRoundLatencyMs: input.low.totalLatencyMs + highLatencyMs,
      fullRound45sTargetPassed: false,
      fullRound60sHardPassed: false,
      questionObservation: null,
      diagnostics
    } satisfies Gi088ResponseFirstV23HighCallResult;
  }
}

export async function runGi088ResponseFirstV23HighPhase(input: {
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
    existing.length === 0,
    `GI088_RESPONSE_FIRST_V23_PARTIAL_PHASE_REQUIRES_AUDIT:${input.phase}`
  );
  if (input.phase === "full") {
    assert(
      ledger.productDecision.checkpoint?.gatePassed === true,
      "GI088_RESPONSE_FIRST_V23_FULL_REQUIRES_PRODUCT_CHECKPOINT_GO"
    );
  }
  const [dataset, frozenLow] = await Promise.all([
    loadGi088ResponseFirstV22RubricV13Cases(workspaceRoot),
    loadFrozenLow(workspaceRoot)
  ]);
  const lowByCase = new Map(
    frozenLow.results.map((item) => [item.caseId, item])
  );
  for (const entry of input.plan.phases[input.phase]) {
    const item = dataset.cases.find((candidate) => candidate.caseId === entry.caseId);
    const low = lowByCase.get(entry.caseId);
    assert(item && low, `GI088_RESPONSE_FIRST_V23_CASE_LOST:${entry.caseId}`);
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

export function evaluateGi088ResponseFirstV23HighReview(input: {
  plan: HighPlan;
  phase: Phase;
  results: Gi088ResponseFirstV23HighCallResult[];
  decisions: Gi088ResponseFirstV23HighReviewDecision[];
}) {
  const entries = input.plan.phases[input.phase];
  const expectedIds = new Set(entries.map((item) => item.caseId));
  const byCase = new Map(input.decisions.map((item) => [item.caseId, item]));
  const completeReview = input.decisions.length === entries.length &&
    byCase.size === entries.length &&
    input.decisions.every((item) => expectedIds.has(item.caseId));
  const allCallsValid = input.results.length === entries.length &&
    input.results.every(
      (item) => item.status === "valid" && item.fullRound60sHardPassed
    );
  const latencies = input.results.flatMap((item) =>
    item.fullRoundLatencyMs === null ? [] : [item.fullRoundLatencyMs]
  );
  const medianFullRoundLatencyMs = median(latencies);
  const medianTargetPassed = medianFullRoundLatencyMs !== null &&
    medianFullRoundLatencyMs <= 45_000;
  const checkpointContentPassed = input.phase === "checkpoint" &&
    entries.every((item) => byCase.get(item.caseId)?.verdict === "pass");
  const hardCaseIds = input.plan.phases.full
    .filter((item) => item.hardGate)
    .map((item) => item.caseId);
  const softCaseIds = input.plan.phases.full
    .filter((item) => !item.hardGate)
    .map((item) => item.caseId);
  const hardPassed = input.phase === "checkpoint"
    ? checkpointContentPassed
    : hardCaseIds.every((caseId) => byCase.get(caseId)?.verdict === "pass");
  const softMinorCount = input.phase === "full"
    ? softCaseIds.filter((caseId) => byCase.get(caseId)?.verdict === "minor").length
    : 0;
  const softFailed = input.phase === "full" &&
    softCaseIds.some((caseId) => byCase.get(caseId)?.verdict === "fail");
  const contentPassed = input.phase === "checkpoint"
    ? checkpointContentPassed
    : hardPassed && !softFailed && softMinorCount <= 1;
  const gatePassed = allCallsValid && completeReview && contentPassed &&
    medianTargetPassed;
  return {
    phase: input.phase,
    status: gatePassed
      ? `high_${input.phase}_quality_gate_passed`
      : `high_${input.phase}_quality_gate_failed`,
    gatePassed,
    allCallsValid,
    completeReview,
    contentPassed,
    hardPassed,
    softMinorCount,
    medianFullRoundLatencyMs,
    medianTargetPassed,
    counts: {
      pass: input.decisions.filter((item) => item.verdict === "pass").length,
      minor: input.decisions.filter((item) => item.verdict === "minor").length,
      fail: input.decisions.filter((item) => item.verdict === "fail").length
    }
  };
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
    decisions: Gi088ResponseFirstV23HighReviewDecision[];
  };
  assert(
    review.identity === plan.identity &&
      review.planFingerprint === plan.planFingerprint &&
      review.phase === phase &&
      review.reviewerRole === reviewerRole,
    "GI088_RESPONSE_FIRST_V23_REVIEW_IDENTITY_MISMATCH"
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

async function writeReviewHtml(input: {
  cwd: string;
  workspaceRoot: string;
  plan: HighPlan;
  phase: Phase;
  results: Gi088ResponseFirstV23HighCallResult[];
  decisions: Gi088ResponseFirstV23HighReviewDecision[];
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
      ? projectGi088ResponseFirstV23VisibleDelivery({
          frozenLow: low.rawOutput,
          high: result.parsedHigh
        })
      : null;
    const questions = delivery?.questions.length
      ? `<ol>${delivery.questions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ol>`
      : "<p>无问题</p>";
    const understanding = delivery?.highUnderstanding
      ? `<p>${escapeHtml(delivery.highUnderstanding.text)}</p><p>依据：${delivery.highUnderstanding.evidenceRefs.map(escapeHtml).join("、")}</p>`
      : "<p>无追加理解</p>";
    return `<article class="card"><p class="eyebrow">${result.caseId}</p><h2>${escapeHtml(item.title)}</h2><section><h3>1. 完整相关原文</h3>${transcript}</section><section><h3>2. 冻结 Low</h3><p class="answer">${escapeHtml(low.rawOutput)}</p></section><section><h3>3. High 实际原始输出</h3><pre>${escapeHtml(result.rawOutput ?? "")}</pre></section><section><h3>4. 同气泡可见追加</h3>${understanding}${questions}</section><section><h3>5. 技术事实</h3><p>${result.status} · High ${result.highLatencyMs ?? "-"}ms · 两段 ${result.fullRoundLatencyMs ?? "-"}ms · ${escapeHtml(result.validationIssues.join("；") || "来源与合同有效")}</p></section><section><h3>6. Codex 初评</h3><p><strong>${review?.verdict ?? "待评"}</strong>　${escapeHtml(review?.note ?? "")}</p></section></article>`;
  }).join("\n");
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GI-088 v2.3 High ${input.phase}</title><style>:root{font-family:ui-sans-serif,system-ui;background:#f4f1ea;color:#211f1b}body{margin:0}.wrap{max-width:960px;margin:auto;padding:36px 20px 110px}.card{background:#fffdf8;border:1px solid #d8d1c4;border-radius:20px;padding:22px;margin:18px 0}.eyebrow{color:#71695d;font-size:13px}.answer{font-size:18px;line-height:1.8}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f1e8;padding:12px;border-radius:12px}section{border-top:1px solid #e7e0d4;padding-top:12px;margin-top:16px}</style></head><body><main class="wrap"><h1>v2.3 High ${input.phase}</h1><p>按完整原文、冻结 Low、High 原始输出、可见追加、技术事实和 Codex 初评依次阅读。</p>${cards}</main></body></html>`;
  const relative = input.phase === "checkpoint"
    ? GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_PATHS.privateCheckpointReviewHtml
    : GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_PATHS.privateFullReviewHtml;
  const file = path.join(input.cwd, relative);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, html, { mode: 0o600 });
  await chmod(file, 0o600);
  return relative;
}

async function prepare(cwd: string) {
  const startFile = path.join(
    cwd,
    GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_PATHS.publicStartCard
  );
  if (await pathExists(startFile)) return readFrozenPlan(cwd);
  const plan = await createGi088ResponseFirstV23HighPlan(cwd);
  await writeJsonAtomic(startFile, plan);
  return plan;
}

async function providerForExecution(cwd: string, plan: HighPlan) {
  loadEnvConfig(cwd, true);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  assert(apiKey, "GI088_RESPONSE_FIRST_V23_DEEPSEEK_API_KEY_MISSING");
  const ledger = await readLedger(cwd, plan);
  if (!ledger.preflight) {
    ledger.preflight = await checkTargetModel(apiKey);
    await saveLedger(cwd, plan, ledger);
  }
  return new OpenAIProvider({
    apiKey,
    model: GI088_RESPONSE_FIRST_V23_RUNTIME.model,
    baseUrl: "https://api.deepseek.com",
    timeoutMs: GI088_RESPONSE_FIRST_V23_RUNTIME.high.hardTimeoutMs
  });
}

async function executePhase(cwd: string, phase: Phase) {
  const plan = await prepare(cwd);
  const provider = await providerForExecution(cwd, plan);
  const ledger = await runGi088ResponseFirstV23HighPhase({
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
    calls: ledger.results.length,
    phaseCalls: phaseResults(ledger, phase).length,
    publicReceipt: GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_PATHS.publicReceipt
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
  assert(
    results.length === plan.phases[phase].length,
    `GI088_RESPONSE_FIRST_V23_RESULTS_INCOMPLETE:${phase}`
  );
  const relative = phase === "checkpoint"
    ? reviewerRole === "codex"
      ? GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_PATHS.privateCheckpointCodexReview
      : GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_PATHS.privateCheckpointProductReview
    : reviewerRole === "codex"
      ? GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_PATHS.privateFullCodexReview
      : GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_PATHS.privateFullProductReview;
  const review = await readReview(
    path.join(cwd, relative),
    plan,
    phase,
    reviewerRole
  );
  const summary = evaluateGi088ResponseFirstV23HighReview({
    plan,
    phase,
    results,
    decisions: review.decisions
  });
  ledger[reviewerRole === "codex" ? "codexDecision" : "productDecision"][phase] =
    summary;
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
  const command = process.env.GI088_RESPONSE_FIRST_V23_HIGH_COMMAND ??
    process.argv[2] ?? "--prepare";
  if (command === "--execute-checkpoint") {
    return executePhase(cwd, "checkpoint");
  }
  if (command === "--finalize-checkpoint-codex") {
    return finalizeReview(cwd, "checkpoint", "codex");
  }
  if (command === "--finalize-checkpoint-product") {
    return finalizeReview(cwd, "checkpoint", "product_owner");
  }
  if (command === "--execute-full") return executePhase(cwd, "full");
  if (command === "--finalize-full-codex") {
    return finalizeReview(cwd, "full", "codex");
  }
  if (command === "--finalize-full-product") {
    return finalizeReview(cwd, "full", "product_owner");
  }
  const plan = await prepare(cwd);
  process.stdout.write(`${JSON.stringify({
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    status: plan.status,
    budget: plan.budget,
    publicStartCard:
      GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_PATHS.publicStartCard
  }, null, 2)}\n`);
}

if (
  process.env.VITEST !== "true" &&
  (process.env.GI088_RESPONSE_FIRST_V23_HIGH_COMMAND ||
    (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(RUNNER_FILE)))
) {
  void main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
