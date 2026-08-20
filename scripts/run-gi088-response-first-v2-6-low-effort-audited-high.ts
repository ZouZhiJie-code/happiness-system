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
  GI088_RESPONSE_FIRST_V26_RUNTIME,
  createGi088ResponseFirstV26HighUserPrompt,
  createGi088ResponseFirstV26Identity,
  getGi088ResponseFirstV26HighSystemPrompt,
  observeGi088ResponseFirstV26HighOutput,
  parseGi088ResponseFirstV26HighOutput,
  projectGi088ResponseFirstV26VisibleAppend,
  validateGi088ResponseFirstV26HighOutput,
  type Gi088ResponseFirstV26HighOutput
} from "../evals/event-centered-generative/gi088-response-first-v2-6-low-effort-audited-high/candidate";
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

export const GI088_RESPONSE_FIRST_V26_HIGH_QUALITY_IDENTITY =
  "2026-08-19.gi088-response-first-v2-6-low-effort-audited-high-quality-v1" as const;
export const GI088_RESPONSE_FIRST_V26_STANDARD_SHA256 =
  "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60" as const;
export const GI088_RESPONSE_FIRST_V26_FIRST_CASE_ID =
  "RPR-REAL-19-CORRECTION" as const satisfies Gi088ResponseFirstV22RubricV13CaseId;
export const GI088_RESPONSE_FIRST_V26_REMAINING_CASE_IDS = [
  "RPR-REAL-06",
  "RPR-REAL-19-CONTINUE",
  "RPR-REAL-22",
  "RPR-REAL-13",
  "RPR-LC-21"
] as const satisfies readonly Gi088ResponseFirstV22RubricV13CaseId[];

type Phase = "first_gate" | "remaining";

const PRIVATE_ROOT =
  `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-6/low-effort-audited-high-quality-v1`;

export const GI088_RESPONSE_FIRST_V26_PATHS = {
  privateLedger: `${PRIVATE_ROOT}/ledger.json`,
  privateFirstCodexReview: `${PRIVATE_ROOT}/first-codex-review.json`,
  privateFirstProductReview: `${PRIVATE_ROOT}/first-product-review.json`,
  privateFirstReviewHtml: `${PRIVATE_ROOT}/first-review.html`,
  privateRemainingCodexReview: `${PRIVATE_ROOT}/remaining-codex-review.json`,
  privateRemainingProductReview: `${PRIVATE_ROOT}/remaining-product-review.json`,
  privateRemainingReviewHtml: `${PRIVATE_ROOT}/remaining-review.html`,
  publicStartCard:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-6-low-effort-audited-high-quality-v1-start-card.json`,
  publicReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-6-low-effort-audited-high-quality-v1-receipt.json`,
  publicHandoff:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-6-low-effort-audited-high-quality-v1-handoff.md`,
  frozenLowPrivateLedger:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-2/low-full-quality-v2/ledger.json`,
  frozenLowPublicReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-2-low-full-quality-v2-receipt.json`,
  parentV25StartCard:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-5-question-self-answer-high-quality-v1-start-card.json`,
  parentV25Receipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-5-question-self-answer-high-quality-v1-receipt.json`,
  parentV25PrivateLedger:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-5/question-self-answer-high-quality-v1/ledger.json`
} as const;

const RUNNER_FILE =
  "scripts/run-gi088-response-first-v2-6-low-effort-audited-high.ts";
const FILES = {
  standard: "docs/ai-evaluation-standard.md",
  plan:
    "docs/plans/2026-08-19-gi088-response-first-v2-6-low-effort-audited-high.md",
  candidate:
    "evals/event-centered-generative/gi088-response-first-v2-6-low-effort-audited-high/candidate.ts",
  parentCandidate:
    "evals/event-centered-generative/gi088-response-first-v2-5-question-self-answer/candidate.ts",
  fixtures: "scripts/gi088-response-first-v2-2-rubric-v1-3-fixtures.ts",
  frozenLowReceipt: GI088_RESPONSE_FIRST_V26_PATHS.frozenLowPublicReceipt,
  parentV25StartCard: GI088_RESPONSE_FIRST_V26_PATHS.parentV25StartCard,
  parentV25Receipt: GI088_RESPONSE_FIRST_V26_PATHS.parentV25Receipt,
  parentV25PrivateLedger: GI088_RESPONSE_FIRST_V26_PATHS.parentV25PrivateLedger,
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

export type Gi088ResponseFirstV26CallResult = {
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
  parsedHigh: Gi088ResponseFirstV26HighOutput | null;
  validationIssues: string[];
  errorCode: string | null;
  highLatencyMs: number;
  fullRoundLatencyMs: number;
  fullRound45sTargetPassed: boolean;
  fullRound60sHardPassed: boolean;
  questionObservation: ReturnType<
    typeof observeGi088ResponseFirstV26HighOutput
  > | null;
  diagnostics: ReturnType<typeof sanitizeAIProviderDiagnostics>;
};

export type Gi088ResponseFirstV26ReviewDecision = {
  caseId: Gi088ResponseFirstV22RubricV13CaseId;
  verdict: "pass" | "minor" | "fail";
  note: string;
};

type HighPlan = Awaited<ReturnType<typeof createGi088ResponseFirstV26Plan>>;
type ReviewSummary = ReturnType<typeof evaluateGi088ResponseFirstV26Review>;
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
  results: Gi088ResponseFirstV26CallResult[];
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
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V26_PATHS.frozenLowPrivateLedger), "utf8"),
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V26_PATHS.frozenLowPublicReceipt), "utf8")
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
    "GI088_RESPONSE_FIRST_V26_FROZEN_LOW_GATE_INVALID"
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
      `GI088_RESPONSE_FIRST_V26_FROZEN_LOW_INVALID:${item.caseId}`
    );
    return {
      caseId: item.caseId,
      rawOutput: item.rawOutput,
      responseHash: item.responseHash,
      totalLatencyMs: item.totalLatencyMs
    } satisfies FrozenLowResult;
  });
  assert(results.length === 6, "GI088_RESPONSE_FIRST_V26_FROZEN_LOW_INCOMPLETE");
  return {
    identity: privateLedger.identity,
    planFingerprint: privateLedger.planFingerprint,
    candidateFingerprint: publicReceipt.candidateFingerprint,
    receiptSha256: sha(publicSource),
    results
  };
}

async function loadParentV25(cwd: string) {
  const [startSource, receiptSource, privateLedgerSource] = await Promise.all([
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V26_PATHS.parentV25StartCard), "utf8"),
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V26_PATHS.parentV25Receipt), "utf8"),
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V26_PATHS.parentV25PrivateLedger), "utf8")
  ]);
  const start = JSON.parse(startSource) as {
    identity: string;
    planFingerprint: string;
    candidateIdentity: {
      candidateFingerprint: string;
      runtime: {
        high: {
          reasoningEffort: string;
          maxTokens: number;
          hardTimeoutMs: number;
        };
      };
    };
  };
  const receipt = JSON.parse(receiptSource) as {
    identity: string;
    planFingerprint: string;
    candidateFingerprint: string;
    status: string;
    budget: {
      authorized: number;
      consumed: number;
      completed: number;
      notRun: number;
      firstGateConsumed: number;
      remainingConsumed: number;
      retries: number;
      recovery: number;
      fallback: number;
    };
    results: Array<{
      caseId: string;
      status: string;
      responseHash: string | null;
      responseLength: number;
      errorCode: string | null;
      highLatencyMs: number;
      fullRound60sHardPassed: boolean;
      httpStatus: number | null;
      finishReason: string | null;
      validationIssues: string[];
    }>;
  };
  const privateLedger = JSON.parse(privateLedgerSource) as {
    identity: string;
    planFingerprint: string;
    startedCaseIds: string[];
    results: Array<{
      caseId: string;
      status: string;
      responseHash: string | null;
      responseLength: number;
      rawOutput: string | null;
      errorCode: string | null;
      diagnostics: {
        httpStatus: number | null;
        totalLatencyMs: number | null;
        timeoutStage: string | null;
        abortSource: string | null;
      } | null;
    }>;
  };
  const first = receipt.results[0];
  const privateFirst = privateLedger.results[0];
  assert(
    start.identity ===
      "2026-08-19.gi088-response-first-v2-5-question-self-answer-high-quality-v1" &&
      receipt.identity === start.identity &&
      privateLedger.identity === start.identity &&
      receipt.planFingerprint === start.planFingerprint &&
      privateLedger.planFingerprint === start.planFingerprint &&
      receipt.candidateFingerprint ===
        start.candidateIdentity.candidateFingerprint &&
      start.candidateIdentity.runtime.high.reasoningEffort === "high" &&
      start.candidateIdentity.runtime.high.maxTokens === 4_000 &&
      start.candidateIdentity.runtime.high.hardTimeoutMs === 60_000 &&
      receipt.status === "first_gate_technical_contract_or_speed_no_go" &&
      receipt.budget.authorized === 6 &&
      receipt.budget.consumed === 1 &&
      receipt.budget.completed === 1 &&
      receipt.budget.notRun === 5 &&
      receipt.budget.firstGateConsumed === 1 &&
      receipt.budget.remainingConsumed === 0 &&
      receipt.budget.retries === 0 &&
      receipt.budget.recovery === 0 &&
      receipt.budget.fallback === 0 &&
      receipt.results.length === 1 &&
      privateLedger.startedCaseIds.length === 1 &&
      privateLedger.startedCaseIds[0] === GI088_RESPONSE_FIRST_V26_FIRST_CASE_ID &&
      privateLedger.results.length === 1 &&
      first?.caseId === GI088_RESPONSE_FIRST_V26_FIRST_CASE_ID &&
      first.status === "technical_failure" &&
      first.responseHash === null &&
      first.responseLength === 0 &&
      first.errorCode === "TIMEOUT" &&
      first.httpStatus === 200 &&
      first.highLatencyMs >= 60_000 &&
      first.fullRound60sHardPassed === false &&
      first.finishReason === null &&
      first.validationIssues.length === 0 &&
      privateFirst?.caseId === first.caseId &&
      privateFirst.status === first.status &&
      privateFirst.responseHash === null &&
      privateFirst.responseLength === 0 &&
      privateFirst.rawOutput === null &&
      privateFirst.errorCode === "TIMEOUT" &&
      privateFirst.diagnostics?.httpStatus === 200 &&
      privateFirst.diagnostics.totalLatencyMs === first.highLatencyMs &&
      privateFirst.diagnostics.timeoutStage === "hard_total" &&
      privateFirst.diagnostics.abortSource === "deadline",
    "GI088_RESPONSE_FIRST_V26_PARENT_V25_INVALID"
  );
  return {
    identity: start.identity,
    planFingerprint: start.planFingerprint,
    candidateFingerprint: start.candidateIdentity.candidateFingerprint,
    startCardSha256: sha(startSource),
    receiptSha256: sha(receiptSource),
    privateLedgerSha256: sha(privateLedgerSource),
    firstGateTechnicalResult: {
      httpStatus: first.httpStatus,
      responseLength: first.responseLength,
      timeoutStage: privateFirst.diagnostics.timeoutStage,
      budgetAuthorized: receipt.budget.authorized,
      budgetConsumed: receipt.budget.consumed,
      budgetNotRun: receipt.budget.notRun
    }
  };
}

function requestForCase(input: {
  item: Gi088ResponseFirstV22RubricV13Case;
  frozenLow: string;
}): AICompletionParams {
  const runtime = GI088_RESPONSE_FIRST_V26_RUNTIME.high;
  return {
    messages: [
      { role: "system", content: getGi088ResponseFirstV26HighSystemPrompt() },
      {
        role: "user",
        content: createGi088ResponseFirstV26HighUserPrompt({
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

export async function createGi088ResponseFirstV26Plan(cwd = process.cwd()) {
  const standardSha256 = await fileSha(cwd, FILES.standard);
  assert(standardSha256 === GI088_RESPONSE_FIRST_V26_STANDARD_SHA256, "STANDARD_SHA256_MISMATCH");
  const [dataset, frozenLow, parentV25] = await Promise.all([
    loadGi088ResponseFirstV22RubricV13Cases(cwd),
    loadFrozenLow(cwd),
    loadParentV25(cwd)
  ]);
  const candidateIdentity = createGi088ResponseFirstV26Identity();
  assert(
    candidateIdentity.parentCandidateFingerprint ===
      parentV25.candidateFingerprint &&
      candidateIdentity.frozenLowCandidateFingerprint ===
        frozenLow.candidateFingerprint &&
      candidateIdentity.changedFactor ===
        "high_reasoning_effort_high_to_low_only" &&
      candidateIdentity.runtime.high.reasoningEffort === "low" &&
      candidateIdentity.runtime.high.maxTokens === 4_000 &&
      candidateIdentity.runtime.high.hardTimeoutMs === 60_000 &&
      candidateIdentity.highSystemPromptFingerprint ===
        candidateIdentity.parentHighSystemPromptFingerprint,
    "GI088_RESPONSE_FIRST_V26_LINEAGE_INVALID"
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
    assert(item && low, `GI088_RESPONSE_FIRST_V26_CASE_BINDING_MISSING:${caseId}`);
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
  const firstGate = bindCases("first_gate", [GI088_RESPONSE_FIRST_V26_FIRST_CASE_ID]);
  const remaining = bindCases("remaining", GI088_RESPONSE_FIRST_V26_REMAINING_CASE_IDS);
  const allEntries = [...firstGate, ...remaining];
  const nullWorkingTaskCount = allEntries.filter(
    (item) => item.initialWorkingTask === "null"
  ).length;
  const existingWorkingTaskCount = allEntries.filter(
    (item) => item.initialWorkingTask === "existing"
  ).length;
  assert(
    nullWorkingTaskCount === 4 && existingWorkingTaskCount === 2,
    `GI088_RESPONSE_FIRST_V26_STATE_CLASSIFICATION_INVALID:null=${nullWorkingTaskCount}:existing=${existingWorkingTaskCount}:total=${allEntries.length}`
  );
  const core = {
    schemaVersion: "1.0",
    identity: GI088_RESPONSE_FIRST_V26_HIGH_QUALITY_IDENTITY,
    status: "ready_authorized_waiting_first_gate",
    productDecision:
      "whether_low_reasoning_effort_completes_the_audited_high_within_60_seconds_and_remains_semantically_reviewable",
    changedFactor: "high_reasoning_effort_high_to_low_only",
    fixedFactors: {
      frozenLowRunIdentity: frozenLow.identity,
      frozenLowPlanFingerprint: frozenLow.planFingerprint,
      frozenLowCandidateFingerprint: frozenLow.candidateFingerprint,
      parentV25Identity: parentV25.identity,
      parentV25PlanFingerprint: parentV25.planFingerprint,
      parentV25CandidateFingerprint: parentV25.candidateFingerprint,
      parentV25EvidenceHashes: {
        startCardSha256: parentV25.startCardSha256,
        receiptSha256: parentV25.receiptSha256,
        privateLedgerSha256: parentV25.privateLedgerSha256
      },
      parentV25FirstGateTechnicalResult: {
        httpStatus: parentV25.firstGateTechnicalResult.httpStatus,
        responseLength: parentV25.firstGateTechnicalResult.responseLength,
        timeoutStage: parentV25.firstGateTechnicalResult.timeoutStage,
        budgetAuthorized: parentV25.firstGateTechnicalResult.budgetAuthorized,
        budgetConsumed: parentV25.firstGateTechnicalResult.budgetConsumed,
        budgetNotRun: parentV25.firstGateTechnicalResult.budgetNotRun
      },
      model: GI088_RESPONSE_FIRST_V26_RUNTIME.model,
      thinking: GI088_RESPONSE_FIRST_V26_RUNTIME.high.thinking,
      reasoningEffort: GI088_RESPONSE_FIRST_V26_RUNTIME.high.reasoningEffort,
      maxTokens: GI088_RESPONSE_FIRST_V26_RUNTIME.high.maxTokens,
      datasetInput: "byte_identical_to_v22_rubric_v1_3",
      outputStructure:
        "v25_semantic_visible_and_structured_information_gain_audit_unchanged",
      programValidation:
        "v25_state_source_and_deterministic_audit_mapping_unchanged",
      inheritedQuestionAudit: "v25_question_self_answer_audit_unchanged",
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
      firstGateProductContinuation: "pass_only",
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
      "codex_question_existing_answer_mapping",
      "codex_provisional_judgment",
      "product_owner_final_judgment"
    ],
    stopPoint:
      "one_first_case_then_require_product_owner_pass_before_remaining_five"
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
    await readFile(path.join(cwd, GI088_RESPONSE_FIRST_V26_PATHS.publicStartCard), "utf8")
  ) as HighPlan;
  assert(plan.identity === GI088_RESPONSE_FIRST_V26_HIGH_QUALITY_IDENTITY, "GI088_RESPONSE_FIRST_V26_START_CARD_IDENTITY_MISMATCH");
  assert(await fileSha(cwd, FILES.standard) === GI088_RESPONSE_FIRST_V26_STANDARD_SHA256, "STANDARD_SHA256_MISMATCH");
  const immutableKeys = [
    "candidate",
    "parentCandidate",
    "fixtures",
    "frozenLowReceipt",
    "parentV25StartCard",
    "parentV25Receipt",
    "parentV25PrivateLedger",
    "provider",
    "providerContract",
    "runner"
  ] as const;
  for (const key of immutableKeys) {
    assert(
      await fileSha(cwd, FILES[key]) === plan.inputHashes[`${key}Sha256`],
      `GI088_RESPONSE_FIRST_V26_INPUT_DRIFT:${key}`
    );
  }
  const [dataset, frozenLow, parentV25] = await Promise.all([
    loadGi088ResponseFirstV22RubricV13Cases(cwd),
    loadFrozenLow(cwd),
    loadParentV25(cwd)
  ]);
  assert(
    dataset.datasetFingerprint === plan.dataset.fingerprint &&
      frozenLow.planFingerprint === plan.fixedFactors.frozenLowPlanFingerprint &&
      parentV25.planFingerprint === plan.fixedFactors.parentV25PlanFingerprint,
    "GI088_RESPONSE_FIRST_V26_SOURCE_DRIFT"
  );
  return plan;
}

async function readLedger(cwd: string, plan: HighPlan) {
  const file = path.join(cwd, GI088_RESPONSE_FIRST_V26_PATHS.privateLedger);
  const ledger = await readFile(file, "utf8")
    .then((source) => JSON.parse(source) as PrivateLedger)
    .catch(() => emptyLedger(plan));
  assert(
    ledger.identity === plan.identity &&
      ledger.planFingerprint === plan.planFingerprint,
    "GI088_RESPONSE_FIRST_V26_LEDGER_IDENTITY_MISMATCH"
  );
  return ledger;
}

function phaseResults(ledger: PrivateLedger, phase: Phase) {
  return ledger.results.filter((item) => item.phase === phase);
}

function sanitizePublicResult(result: Gi088ResponseFirstV26CallResult) {
  const understanding = result.parsedHigh?.visibleAppend.correctableUnderstanding;
  const questions = result.parsedHigh?.semantic.nextResponse.decision === "ask"
    ? result.parsedHigh.semantic.nextResponse.questions
    : [];
  const observation = result.questionObservation;
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
    questionObservation: observation
      ? {
          structuredQuestionCount:
            observation.questionObservation.structuredQuestionCount,
          punctuationQuestionCount:
            observation.questionObservation.punctuationQuestionCount,
          answerFocusHash: observation.questionObservation.answerFocus
            ? sha(observation.questionObservation.answerFocus)
            : null,
          candidateCount: observation.candidateCount,
          answeredCandidateCount: observation.answeredCandidateCount,
          openCandidateCount: observation.openCandidateCount,
          worthAskingCandidateCount: observation.worthAskingCandidateCount,
          selectedQuestionCount: observation.selectedQuestionCount
        }
      : null,
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
      ? "v26_offline_quality_gate_passed_by_product_owner"
      : "v26_offline_quality_gate_failed_by_product_owner";
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
      ? "first_gate_pass_waiting_remaining"
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
    path.join(cwd, GI088_RESPONSE_FIRST_V26_PATHS.privateLedger),
    ledger,
    true
  );
  await writeJsonAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V26_PATHS.publicReceipt),
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
        firstGateConsumed: ledger.startedCaseIds.includes(GI088_RESPONSE_FIRST_V26_FIRST_CASE_ID) ? 1 : 0,
        remainingConsumed: ledger.startedCaseIds.filter((caseId) =>
          GI088_RESPONSE_FIRST_V26_REMAINING_CASE_IDS.includes(
            caseId as (typeof GI088_RESPONSE_FIRST_V26_REMAINING_CASE_IDS)[number]
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
        parentV25TimeoutEvidence:
          "private_ledger_frozen_input_hash_with_public_status_counts_and_hashes_only",
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
    `GI088_RESPONSE_FIRST_V26_REQUEST_DRIFT:${input.entry.caseId}`
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
      const parsedHigh = parseGi088ResponseFirstV26HighOutput(completion.content);
      const validationIssues = validateGi088ResponseFirstV26HighOutput({
        turnInput: input.item.turnInput,
        frozenLow: input.low.rawOutput,
        high: parsedHigh
      });
      if (diagnostics?.responseModel !== GI088_RESPONSE_FIRST_V26_RUNTIME.model) {
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
        errorCode: status === "valid"
          ? null
          : diagnostics?.finishReason === "length"
            ? "GI088_RESPONSE_FIRST_V26_TOKEN_CEILING_INCONCLUSIVE"
            : "GI088_RESPONSE_FIRST_V26_CONTRACT_INVALID",
        highLatencyMs,
        fullRoundLatencyMs,
        fullRound45sTargetPassed: fullRoundLatencyMs <= 45_000,
        fullRound60sHardPassed: fullRoundLatencyMs <= 60_000,
        questionObservation: observeGi088ResponseFirstV26HighOutput(parsedHigh),
        diagnostics
      } satisfies Gi088ResponseFirstV26CallResult;
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
        errorCode: diagnostics?.finishReason === "length"
          ? "GI088_RESPONSE_FIRST_V26_TOKEN_CEILING_INCONCLUSIVE"
          : "GI088_RESPONSE_FIRST_V26_PARSE_FAILED",
        highLatencyMs,
        fullRoundLatencyMs,
        fullRound45sTargetPassed: fullRoundLatencyMs <= 45_000,
        fullRound60sHardPassed: fullRoundLatencyMs <= 60_000,
        questionObservation: null,
        diagnostics
      } satisfies Gi088ResponseFirstV26CallResult;
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
    } satisfies Gi088ResponseFirstV26CallResult;
  }
}

export async function runGi088ResponseFirstV26Phase(input: {
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
    "GI088_RESPONSE_FIRST_V26_STARTED_CALL_REQUIRES_AUDIT"
  );
  assert(existing.length === 0, `GI088_RESPONSE_FIRST_V26_PARTIAL_PHASE_REQUIRES_AUDIT:${input.phase}`);
  if (input.phase === "remaining") {
    assert(
      ledger.productDecision.first_gate?.continuationAllowed === true,
      "GI088_RESPONSE_FIRST_V26_REMAINING_REQUIRES_PRODUCT_FIRST_PASS"
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
    assert(item && low, `GI088_RESPONSE_FIRST_V26_CASE_LOST:${entry.caseId}`);
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

export function evaluateGi088ResponseFirstV26Review(input: {
  plan: HighPlan;
  phase: Phase;
  results: Gi088ResponseFirstV26CallResult[];
  decisions: Gi088ResponseFirstV26ReviewDecision[];
  firstGateResults?: Gi088ResponseFirstV26CallResult[];
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
    allCallsValid && completeReview && counts.pass === 1;
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
      ? `v26_${input.phase}_quality_gate_passed`
      : `v26_${input.phase}_quality_gate_failed`,
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
  results: Gi088ResponseFirstV26CallResult[];
  decisions: Gi088ResponseFirstV26ReviewDecision[];
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
      ? projectGi088ResponseFirstV26VisibleAppend({ frozenLow: low.rawOutput, high: result.parsedHigh })
      : null;
    const understanding = delivery?.highUnderstanding
      ? `<p>${escapeHtml(delivery.highUnderstanding.text)}</p><p>依据：${delivery.highUnderstanding.evidenceRefs.map(escapeHtml).join("、")}</p>`
      : "<p>无追加理解</p>";
    const questions = delivery?.questions.length
      ? `<ol>${delivery.questions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ol>`
      : "<p>无问题</p>";
    const tokenUsage = result.diagnostics?.tokenUsage;
    const technical = [
      result.status,
      `High ${result.highLatencyMs}ms`,
      `两段 ${result.fullRoundLatencyMs}ms`,
      `finishReason=${result.diagnostics?.finishReason ?? "missing"}`,
      `completion=${tokenUsage?.completionTokens ?? "missing"}/${GI088_RESPONSE_FIRST_V26_RUNTIME.high.maxTokens}`,
      `reasoning=${result.diagnostics?.reasoningTokens ?? "missing"}`,
      result.validationIssues.join("；") || "来源与合同有效"
    ].join(" · ");
    return `<article class="card"><p>${result.caseId}</p><h2>${escapeHtml(item.title)}</h2><section><h3>1. 完整相关原文</h3>${transcript}</section><section><h3>2. 冻结 Low</h3><p>${escapeHtml(low.rawOutput)}</p></section><section><h3>3. High 实际原始输出</h3><pre>${escapeHtml(result.rawOutput ?? "")}</pre></section><section><h3>4. 同气泡可见追加</h3>${understanding}${questions}</section><section><h3>5. 技术事实</h3><p>${escapeHtml(technical)}</p></section><section><h3>6. Codex 逐问对照与初评</h3><p><strong>${review?.verdict ?? "待评"}</strong>　${escapeHtml(review?.note ?? "")}</p></section></article>`;
  }).join("\n");
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GI-088 v2.6 ${input.phase}</title><style>:root{font-family:ui-sans-serif,system-ui;background:#f4f1ea;color:#211f1b}body{margin:0}.wrap{max-width:960px;margin:auto;padding:36px 20px 110px}.card{background:#fffdf8;border:1px solid #d8d1c4;border-radius:20px;padding:22px;margin:18px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f1e8;padding:12px;border-radius:12px}section{border-top:1px solid #e7e0d4;padding-top:12px;margin-top:16px}</style></head><body><main class="wrap"><h1>v2.6 ${input.phase}</h1><p>完整原文 → Low → High → 技术事实 → Codex 逐问对照与初评。</p>${cards}</main></body></html>`;
  const relative = input.phase === "first_gate"
    ? GI088_RESPONSE_FIRST_V26_PATHS.privateFirstReviewHtml
    : GI088_RESPONSE_FIRST_V26_PATHS.privateRemainingReviewHtml;
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
    decisions: Gi088ResponseFirstV26ReviewDecision[];
  };
  assert(
    review.identity === plan.identity &&
      review.planFingerprint === plan.planFingerprint &&
      review.phase === phase &&
      review.reviewerRole === reviewerRole,
    "GI088_RESPONSE_FIRST_V26_REVIEW_IDENTITY_MISMATCH"
  );
  return review;
}

async function prepare(cwd: string) {
  const file = path.join(cwd, GI088_RESPONSE_FIRST_V26_PATHS.publicStartCard);
  if (await pathExists(file)) return readFrozenPlan(cwd);
  const plan = await createGi088ResponseFirstV26Plan(cwd);
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
    assert(response.ok, `GI088_RESPONSE_FIRST_V26_MODEL_LIST_HTTP_${response.status}`);
    const payload = JSON.parse(source) as { data?: Array<{ id?: unknown }> };
    const modelIds = (payload.data ?? []).flatMap((item) =>
      typeof item.id === "string" ? [item.id] : []
    );
    assert(modelIds.includes(GI088_RESPONSE_FIRST_V26_RUNTIME.model), "GI088_RESPONSE_FIRST_V26_TARGET_MODEL_UNAVAILABLE");
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
  assert(apiKey, "GI088_RESPONSE_FIRST_V26_DEEPSEEK_API_KEY_MISSING");
  const ledger = await readLedger(cwd, plan);
  if (!ledger.preflight) {
    ledger.preflight = await checkTargetModel(apiKey);
    await saveLedger(cwd, plan, ledger);
  }
  return new OpenAIProvider({
    apiKey,
    model: GI088_RESPONSE_FIRST_V26_RUNTIME.model,
    baseUrl: "https://api.deepseek.com",
    timeoutMs: GI088_RESPONSE_FIRST_V26_RUNTIME.high.hardTimeoutMs
  });
}

async function executePhase(cwd: string, phase: Phase) {
  const plan = await prepare(cwd);
  const provider = await providerForExecution(cwd, plan);
  const ledger = await runGi088ResponseFirstV26Phase({
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
    publicReceipt: GI088_RESPONSE_FIRST_V26_PATHS.publicReceipt
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
  assert(results.length === plan.phases[phase].length, `GI088_RESPONSE_FIRST_V26_RESULTS_INCOMPLETE:${phase}`);
  const relative = phase === "first_gate"
    ? reviewerRole === "codex"
      ? GI088_RESPONSE_FIRST_V26_PATHS.privateFirstCodexReview
      : GI088_RESPONSE_FIRST_V26_PATHS.privateFirstProductReview
    : reviewerRole === "codex"
      ? GI088_RESPONSE_FIRST_V26_PATHS.privateRemainingCodexReview
      : GI088_RESPONSE_FIRST_V26_PATHS.privateRemainingProductReview;
  const review = await readReview(path.join(cwd, relative), plan, phase, reviewerRole);
  const summary = evaluateGi088ResponseFirstV26Review({
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
  const command = process.env.GI088_RESPONSE_FIRST_V26_COMMAND ??
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
    publicStartCard: GI088_RESPONSE_FIRST_V26_PATHS.publicStartCard
  }, null, 2)}\n`);
}

if (
  process.env.VITEST !== "true" &&
  (process.env.GI088_RESPONSE_FIRST_V26_COMMAND ||
    (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(RUNNER_FILE)))
) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
