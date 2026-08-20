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
  GI088_RESPONSE_FIRST_V28_RUNTIME,
  createGi088ResponseFirstV28HighUserPrompt,
  createGi088ResponseFirstV28Identity,
  getGi088ResponseFirstV28HighSystemPrompt,
  observeGi088ResponseFirstV28CorrectionPersistenceAudit,
  observeGi088ResponseFirstV28InformationGainAudit,
  parseGi088ResponseFirstV28HighOutput,
  projectGi088ResponseFirstV28VisibleAppend,
  validateGi088ResponseFirstV28HighOutput,
  type Gi088ResponseFirstV28HighOutput
} from "../evals/event-centered-generative/gi088-response-first-v2-8-correction-persistence-high/candidate";
import {
  projectGi088ResponseFirstV2HighOutput,
  type Gi088ResponseFirstV2HighOutput
} from "../evals/event-centered-generative/gi088-response-first-v2/candidate";
import type {
  Board7bWorkingTaskV1SemanticState,
  Board7bWorkingTaskV1TurnInput
} from "../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAIProviderDiagnostics,
  type AICompletionParams,
  type AIProvider
} from "../src/server/services/ai/ai-provider";
import { OpenAIProvider } from "../src/server/services/ai/openai.provider";
import {
  applyGi088SemanticDeltaValidatedResult,
  type Gi088SemanticDeltaOutput
} from "../src/server/services/evaluation/gi088/semantic-delta";
import {
  GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT,
  loadGi088ResponseFirstV22RubricV13Cases,
  type Gi088ResponseFirstV22RubricV13Case,
  type Gi088ResponseFirstV22RubricV13CaseId
} from "./gi088-response-first-v2-2-rubric-v1-3-fixtures";

export const GI088_RESPONSE_FIRST_V28_HIGH_QUALITY_IDENTITY =
  "2026-08-19.gi088-response-first-v2-8-correction-persistence-high-quality-v1" as const;
export const GI088_RESPONSE_FIRST_V28_STANDARD_SHA256 =
  "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60" as const;
export const GI088_RESPONSE_FIRST_V28_FIRST_CASE_ID =
  "RPR-REAL-19-CORRECTION" as const satisfies Gi088ResponseFirstV22RubricV13CaseId;
export const GI088_RESPONSE_FIRST_V28_REMAINING_CASE_IDS = [
  "RPR-REAL-06",
  "RPR-REAL-19-CONTINUE",
  "RPR-REAL-22",
  "RPR-REAL-13",
  "RPR-LC-21"
] as const satisfies readonly Gi088ResponseFirstV22RubricV13CaseId[];

type Phase = "first_gate" | "remaining";

const PRIVATE_ROOT =
  `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-8/correction-persistence-high-quality-v1`;

export const GI088_RESPONSE_FIRST_V28_PATHS = {
  privateLedger: `${PRIVATE_ROOT}/ledger.json`,
  privateFirstCodexReview: `${PRIVATE_ROOT}/first-codex-review.json`,
  privateFirstProductReview: `${PRIVATE_ROOT}/first-product-review.json`,
  privateFirstReviewHtml: `${PRIVATE_ROOT}/first-review.html`,
  privateRemainingCodexReview: `${PRIVATE_ROOT}/remaining-codex-review.json`,
  privateRemainingProductReview: `${PRIVATE_ROOT}/remaining-product-review.json`,
  privateRemainingReviewHtml: `${PRIVATE_ROOT}/remaining-review.html`,
  publicStartCard:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-8-correction-persistence-high-quality-v1-start-card.json`,
  publicReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-8-correction-persistence-high-quality-v1-receipt.json`,
  publicHandoff:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-8-correction-persistence-high-quality-v1-handoff.md`,
  frozenLowPrivateLedger:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-2/low-full-quality-v2/ledger.json`,
  frozenLowPublicReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-2-low-full-quality-v2-receipt.json`,
  parentV27StartCard:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-7-thinking-disabled-audited-high-quality-v1-start-card.json`,
  parentV27Receipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-7-thinking-disabled-audited-high-quality-v1-receipt.json`,
  parentV27PrivateLedger:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-7/thinking-disabled-audited-high-quality-v1/ledger.json`
} as const;

const RUNNER_FILE =
  "scripts/run-gi088-response-first-v2-8-correction-persistence-high.ts";
const FILES = {
  standard: "docs/ai-evaluation-standard.md",
  plan:
    "docs/plans/2026-08-19-gi088-response-first-v2-8-correction-persistence-high.md",
  candidate:
    "evals/event-centered-generative/gi088-response-first-v2-8-correction-persistence-high/candidate.ts",
  parentCandidate:
    "evals/event-centered-generative/gi088-response-first-v2-7-thinking-disabled-audited-high/candidate.ts",
  fixtures: "scripts/gi088-response-first-v2-2-rubric-v1-3-fixtures.ts",
  frozenLowReceipt: GI088_RESPONSE_FIRST_V28_PATHS.frozenLowPublicReceipt,
  parentV27StartCard: GI088_RESPONSE_FIRST_V28_PATHS.parentV27StartCard,
  parentV27Receipt: GI088_RESPONSE_FIRST_V28_PATHS.parentV27Receipt,
  parentV27PrivateLedger: GI088_RESPONSE_FIRST_V28_PATHS.parentV27PrivateLedger,
  semanticProjection:
    "evals/event-centered-generative/gi088-response-first-v2/candidate.ts",
  semanticStateMerge: "src/server/services/evaluation/gi088/semantic-delta.ts",
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

type InputCausality = {
  source: "fixture" | "correction_post_state_chain";
  fixtureSemanticStateIgnored: boolean;
  fixtureAssistantMessageReplaced: boolean;
  chainedFromCaseId: typeof GI088_RESPONSE_FIRST_V28_FIRST_CASE_ID | null;
  chainedFromResponseHash: string | null;
  effectiveTurnInputHash: string;
  actualAssistantMessageHash: string | null;
  replacedFixtureAssistantMessageHash: string | null;
  continuationLowHistoricalInputLimitation: boolean;
};

export type Gi088ResponseFirstV28FirstGateSemanticObservation = {
  correctionDeclared: boolean;
  u3Grounded: boolean;
  supersededLatestAssistant: boolean;
  postStateTaskGrounded: boolean;
  postStateUnderstandingGrounded: boolean;
  visibleLowFrozen: boolean;
  highUnderstandingPresent: boolean;
  questionCount: number;
  correctedMeaningHash: string | null;
};

export type Gi088ResponseFirstV28CallResult = {
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
  parsedHigh: Gi088ResponseFirstV28HighOutput | null;
  effectiveTurnInput: Board7bWorkingTaskV1TurnInput;
  postState: Board7bWorkingTaskV1SemanticState | null;
  inputCausality: InputCausality;
  validationIssues: string[];
  errorCode: string | null;
  highLatencyMs: number;
  fullRoundLatencyMs: number;
  fullRound45sTargetPassed: boolean;
  fullRound60sHardPassed: boolean;
  informationGainObservation: ReturnType<
    typeof observeGi088ResponseFirstV28InformationGainAudit
  > | null;
  correctionPersistenceObservation: ReturnType<
    typeof observeGi088ResponseFirstV28CorrectionPersistenceAudit
  > | null;
  firstGateSemanticObservation:
    Gi088ResponseFirstV28FirstGateSemanticObservation | null;
  diagnostics: ReturnType<typeof sanitizeAIProviderDiagnostics>;
};

export type Gi088ResponseFirstV28ReviewDecision = {
  caseId: Gi088ResponseFirstV22RubricV13CaseId;
  verdict: "pass" | "minor" | "fail";
  note: string;
};

type HighPlan = Awaited<ReturnType<typeof createGi088ResponseFirstV28Plan>>;
type ReviewSummary = ReturnType<typeof evaluateGi088ResponseFirstV28Review>;
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
  results: Gi088ResponseFirstV28CallResult[];
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
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V28_PATHS.frozenLowPrivateLedger), "utf8"),
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V28_PATHS.frozenLowPublicReceipt), "utf8")
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
    "GI088_RESPONSE_FIRST_V28_FROZEN_LOW_GATE_INVALID"
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
      `GI088_RESPONSE_FIRST_V28_FROZEN_LOW_INVALID:${item.caseId}`
    );
    return {
      caseId: item.caseId,
      rawOutput: item.rawOutput,
      responseHash: item.responseHash,
      totalLatencyMs: item.totalLatencyMs
    } satisfies FrozenLowResult;
  });
  assert(results.length === 6, "GI088_RESPONSE_FIRST_V28_FROZEN_LOW_INCOMPLETE");
  return {
    identity: privateLedger.identity,
    planFingerprint: privateLedger.planFingerprint,
    candidateFingerprint: publicReceipt.candidateFingerprint,
    receiptSha256: sha(publicSource),
    results
  };
}

async function loadParentV27(cwd: string) {
  const [startSource, receiptSource, privateLedgerSource] = await Promise.all([
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V28_PATHS.parentV27StartCard), "utf8"),
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V28_PATHS.parentV27Receipt), "utf8"),
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V28_PATHS.parentV27PrivateLedger), "utf8")
  ]);
  const start = JSON.parse(startSource) as {
    identity: string;
    planFingerprint: string;
    candidateIdentity: {
      candidateFingerprint: string;
      runtime: {
        high: {
          thinking: string;
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
    productDecision: Record<Phase, unknown | null>;
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
      fullRoundLatencyMs: number;
      fullRound45sTargetPassed: boolean;
      fullRound60sHardPassed: boolean;
      httpStatus: number | null;
      finishReason: string | null;
      reasoningPresent: boolean | null;
      reasoningTokens: number | null;
      validationIssues: string[];
    }>;
  };
  const privateLedger = JSON.parse(privateLedgerSource) as {
    identity: string;
    planFingerprint: string;
    startedCaseIds: string[];
    productDecision: Record<Phase, unknown | null>;
    results: Array<{
      caseId: string;
      status: string;
      responseHash: string | null;
      responseLength: number;
      rawOutput: string | null;
      errorCode: string | null;
      fullRoundLatencyMs: number;
      fullRound45sTargetPassed: boolean;
      fullRound60sHardPassed: boolean;
      validationIssues: string[];
      diagnostics: {
        httpStatus: number | null;
        finishReason: string | null;
        totalLatencyMs: number | null;
        reasoningPresent: boolean;
        reasoningTokens: number | null;
        timeoutStage: string | null;
        abortSource: string | null;
      } | null;
    }>;
  };
  const first = receipt.results[0];
  const privateFirst = privateLedger.results[0];
  assert(
    start.identity ===
      "2026-08-19.gi088-response-first-v2-7-thinking-disabled-audited-high-quality-v1" &&
      receipt.identity === start.identity &&
      privateLedger.identity === start.identity &&
      receipt.planFingerprint === start.planFingerprint &&
      privateLedger.planFingerprint === start.planFingerprint &&
      receipt.candidateFingerprint ===
        start.candidateIdentity.candidateFingerprint &&
      start.candidateIdentity.runtime.high.thinking === "disabled" &&
      !("reasoningEffort" in start.candidateIdentity.runtime.high) &&
      start.candidateIdentity.runtime.high.maxTokens === 4_000 &&
      start.candidateIdentity.runtime.high.hardTimeoutMs === 60_000 &&
      receipt.status === "waiting_product_owner_first_review" &&
      receipt.productDecision.first_gate === null &&
      receipt.productDecision.remaining === null &&
      privateLedger.productDecision.first_gate === null &&
      privateLedger.productDecision.remaining === null &&
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
      privateLedger.startedCaseIds[0] === GI088_RESPONSE_FIRST_V28_FIRST_CASE_ID &&
      privateLedger.results.length === 1 &&
      first?.caseId === GI088_RESPONSE_FIRST_V28_FIRST_CASE_ID &&
      first.status === "valid" &&
      typeof first.responseHash === "string" &&
      first.responseLength > 0 &&
      first.errorCode === null &&
      first.httpStatus === 200 &&
      first.finishReason === "stop" &&
      first.highLatencyMs === 1_847 &&
      first.fullRoundLatencyMs === 5_188 &&
      first.fullRound45sTargetPassed === true &&
      first.fullRound60sHardPassed === true &&
      first.reasoningPresent === false &&
      first.reasoningTokens === null &&
      first.validationIssues.length === 0 &&
      privateFirst?.caseId === first.caseId &&
      privateFirst.status === first.status &&
      privateFirst.responseHash === first.responseHash &&
      privateFirst.responseLength === first.responseLength &&
      typeof privateFirst.rawOutput === "string" &&
      sha(privateFirst.rawOutput) === first.responseHash &&
      privateFirst.errorCode === null &&
      privateFirst.fullRoundLatencyMs === 5_188 &&
      privateFirst.fullRound45sTargetPassed === true &&
      privateFirst.fullRound60sHardPassed === true &&
      privateFirst.validationIssues.length === 0 &&
      privateFirst.diagnostics?.httpStatus === 200 &&
      privateFirst.diagnostics.finishReason === "stop" &&
      privateFirst.diagnostics.totalLatencyMs === 1_847 &&
      privateFirst.diagnostics.reasoningPresent === false &&
      privateFirst.diagnostics.reasoningTokens === null &&
      privateFirst.diagnostics.timeoutStage === null &&
      privateFirst.diagnostics.abortSource === null,
    "GI088_RESPONSE_FIRST_V28_PARENT_V27_INVALID"
  );
  return {
    identity: start.identity,
    planFingerprint: start.planFingerprint,
    candidateFingerprint: start.candidateIdentity.candidateFingerprint,
    startCardSha256: sha(startSource),
    receiptSha256: sha(receiptSource),
    privateLedgerSha256: sha(privateLedgerSource),
    firstGateResult: {
      httpStatus: first.httpStatus,
      finishReason: first.finishReason,
      contractValid: first.status === "valid" && first.validationIssues.length === 0,
      responseLength: first.responseLength,
      fullRoundLatencyMs: first.fullRoundLatencyMs,
      budgetAuthorized: receipt.budget.authorized,
      budgetConsumed: receipt.budget.consumed,
      budgetNotRun: receipt.budget.notRun,
      productDecision: "pending" as const
    }
  };
}

function parentHigh(
  high: Gi088ResponseFirstV28HighOutput
): Gi088ResponseFirstV2HighOutput {
  return { semantic: high.semantic };
}

function projectPostState(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
  high: Gi088ResponseFirstV28HighOutput;
}) {
  const projected = projectGi088ResponseFirstV2HighOutput({
    turnInput: input.turnInput,
    frozenLow: input.frozenLow,
    high: parentHigh(input.high)
  });
  const semantic = { ...projected.semantic };
  delete (semantic as Record<string, unknown>).relationshipClaims;
  delete (semantic as Record<string, unknown>).relationshipClaimUsage;
  const effectiveOutput = {
    semantic,
    visible: projected.visible
  } satisfies Gi088SemanticDeltaOutput;
  return applyGi088SemanticDeltaValidatedResult({
    input: input.turnInput,
    output: effectiveOutput
  });
}

function renderVisibleBubble(input: {
  frozenLow: string;
  high: Gi088ResponseFirstV28HighOutput;
}) {
  const delivery = projectGi088ResponseFirstV28VisibleAppend(input);
  return [
    delivery.lowText,
    delivery.highUnderstanding?.text ?? null,
    ...delivery.questions
  ].filter((item): item is string => Boolean(item)).join("\n\n");
}

export function buildGi088ResponseFirstV28ChainedContinueInput(input: {
  correctionInput: Board7bWorkingTaskV1TurnInput;
  continuationFixtureInput: Board7bWorkingTaskV1TurnInput;
  correctionPostState: Board7bWorkingTaskV1SemanticState;
  actualAssistantBubble: string;
}) {
  const fixtureAssistant = input.continuationFixtureInput.conversation.at(-2);
  const continuationUser = input.continuationFixtureInput.conversation.at(-1);
  assert(
    sha(input.continuationFixtureInput.conversation.slice(0, -2)) ===
      sha(input.correctionInput.conversation) &&
      fixtureAssistant?.role === "assistant" &&
      continuationUser?.role === "user" &&
      continuationUser.id === input.continuationFixtureInput.latestUserMessageId,
    "GI088_RESPONSE_FIRST_V28_CONTINUE_FIXTURE_SHAPE_INVALID"
  );
  const turnInput: Board7bWorkingTaskV1TurnInput = {
    mode: input.continuationFixtureInput.mode,
    conversation: [
      ...structuredClone(input.correctionInput.conversation),
      { ...fixtureAssistant, content: input.actualAssistantBubble },
      structuredClone(continuationUser)
    ],
    latestUserMessageId: continuationUser.id,
    semanticState: structuredClone(input.correctionPostState)
  };
  return {
    turnInput,
    replacedFixtureAssistantMessage: fixtureAssistant,
    actualAssistantMessage: turnInput.conversation.at(-2)!
  };
}

function requestForTurnInput(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
}): AICompletionParams {
  const runtime = GI088_RESPONSE_FIRST_V28_RUNTIME.high;
  return {
    messages: [
      { role: "system", content: getGi088ResponseFirstV28HighSystemPrompt() },
      {
        role: "user",
        content: createGi088ResponseFirstV28HighUserPrompt({
          turnInput: input.turnInput,
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
    thinking: runtime.thinking
  };
}

export async function createGi088ResponseFirstV28Plan(cwd = process.cwd()) {
  const standardSha256 = await fileSha(cwd, FILES.standard);
  assert(standardSha256 === GI088_RESPONSE_FIRST_V28_STANDARD_SHA256, "STANDARD_SHA256_MISMATCH");
  const [dataset, frozenLow, parentV27] = await Promise.all([
    loadGi088ResponseFirstV22RubricV13Cases(cwd),
    loadFrozenLow(cwd),
    loadParentV27(cwd)
  ]);
  const candidateIdentity = createGi088ResponseFirstV28Identity();
  assert(
    candidateIdentity.parentCandidateFingerprint ===
      parentV27.candidateFingerprint &&
      candidateIdentity.frozenLowCandidateFingerprint ===
        frozenLow.candidateFingerprint &&
      candidateIdentity.changedFactor ===
        "audit_first_explicit_correction_persistence_only" &&
      candidateIdentity.runtime.high.thinking === "disabled" &&
      !("reasoningEffort" in candidateIdentity.runtime.high) &&
      candidateIdentity.runtime.high.maxTokens === 4_000 &&
      candidateIdentity.runtime.high.hardTimeoutMs === 60_000 &&
      candidateIdentity.highSystemPromptFingerprint ===
        sha(JSON.stringify(getGi088ResponseFirstV28HighSystemPrompt())) &&
      candidateIdentity.highSystemPromptFingerprint !==
        candidateIdentity.parentHighSystemPromptFingerprint &&
      typeof candidateIdentity.correctionPersistenceAuditContractFingerprint ===
        "string",
    "GI088_RESPONSE_FIRST_V28_LINEAGE_INVALID"
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
    assert(item && low, `GI088_RESPONSE_FIRST_V28_CASE_BINDING_MISSING:${caseId}`);
    return {
      phase,
      order: index + 1,
      caseId,
      sourceCaseId: item.sourceCaseId,
      sourceFingerprint: item.sourceFingerprint,
      hardGate: item.hardGate,
      fixtureInitialWorkingTask: item.turnInput.semanticState.workingTask
        ? "existing" as const
        : "null" as const,
      effectiveInputSource: caseId === "RPR-REAL-19-CONTINUE"
        ? "correction_post_state_chain" as const
        : "fixture" as const,
      fixtureSemanticStateHash: sha(item.turnInput.semanticState),
      frozenLowHash: low.responseHash,
      frozenLowLatencyMs: low.totalLatencyMs,
      requestFingerprint: caseId === "RPR-REAL-19-CONTINUE"
        ? null
        : sha(requestForTurnInput({
            turnInput: item.turnInput,
            frozenLow: low.rawOutput
          })),
      requestRecipeFingerprint: sha({
        caseId,
        sourceFingerprint: item.sourceFingerprint,
        frozenLowHash: low.responseHash,
        effectiveInputSource: caseId === "RPR-REAL-19-CONTINUE"
          ? "correction_post_state_chain"
          : "fixture",
        continuationPolicy: caseId === "RPR-REAL-19-CONTINUE"
          ? "replace_fixture_assistant_with_actual_first_visible_bubble_and_use_first_post_state"
          : "fixture_turn_input"
      })
    };
  });
  const firstGate = bindCases("first_gate", [GI088_RESPONSE_FIRST_V28_FIRST_CASE_ID]);
  const remaining = bindCases("remaining", GI088_RESPONSE_FIRST_V28_REMAINING_CASE_IDS);
  const allEntries = [...firstGate, ...remaining];
  const nullWorkingTaskCount = allEntries.filter(
    (item) => item.fixtureInitialWorkingTask === "null"
  ).length;
  const existingWorkingTaskCount = allEntries.filter(
    (item) => item.fixtureInitialWorkingTask === "existing"
  ).length;
  assert(
    nullWorkingTaskCount === 4 && existingWorkingTaskCount === 2,
    `GI088_RESPONSE_FIRST_V28_STATE_CLASSIFICATION_INVALID:null=${nullWorkingTaskCount}:existing=${existingWorkingTaskCount}:total=${allEntries.length}`
  );
  const core = {
    schemaVersion: "1.0",
    identity: GI088_RESPONSE_FIRST_V28_HIGH_QUALITY_IDENTITY,
    status: "ready_authorized_waiting_first_gate",
    productDecision:
      "whether_a_correction_is_persisted_and_then_used_by_the_real_chained_continue_turn",
    changedFactor: "audit_first_explicit_correction_persistence_only",
    fixedFactors: {
      frozenLowRunIdentity: frozenLow.identity,
      frozenLowPlanFingerprint: frozenLow.planFingerprint,
      frozenLowCandidateFingerprint: frozenLow.candidateFingerprint,
      parentV27Identity: parentV27.identity,
      parentV27PlanFingerprint: parentV27.planFingerprint,
      parentV27CandidateFingerprint: parentV27.candidateFingerprint,
      parentV27EvidenceHashes: {
        startCardSha256: parentV27.startCardSha256,
        receiptSha256: parentV27.receiptSha256,
        privateLedgerSha256: parentV27.privateLedgerSha256
      },
      parentV27FirstGateResult: {
        httpStatus: parentV27.firstGateResult.httpStatus,
        finishReason: parentV27.firstGateResult.finishReason,
        contractValid: parentV27.firstGateResult.contractValid,
        responseLength: parentV27.firstGateResult.responseLength,
        fullRoundLatencyMs: parentV27.firstGateResult.fullRoundLatencyMs,
        budgetAuthorized: parentV27.firstGateResult.budgetAuthorized,
        budgetConsumed: parentV27.firstGateResult.budgetConsumed,
        budgetNotRun: parentV27.firstGateResult.budgetNotRun,
        productDecision: parentV27.firstGateResult.productDecision
      },
      model: GI088_RESPONSE_FIRST_V28_RUNTIME.model,
      thinking: GI088_RESPONSE_FIRST_V28_RUNTIME.high.thinking,
      reasoningEffort: "omitted",
      providerEffectiveTemperature: 0.2,
      maxTokens: GI088_RESPONSE_FIRST_V28_RUNTIME.high.maxTokens,
      datasetInput:
        "v22_user_messages_and_rubric_unchanged;_continue_a3_and_semantic_state_replaced_at_runtime",
      outputStructure:
        "v27_semantic_visible_and_information_gain_plus_correction_persistence_audit",
      programValidation:
        "v27_state_source_validation_plus_real_post_state_causal_chain",
      inheritedQuestionAudit: "v27_question_self_answer_audit_unchanged",
      continuationHighInput:
        "actual_first_visible_bubble_plus_actual_first_post_state_plus_fixture_u4",
      continuationFixtureStateUsage: "forbidden",
      continuationFixtureAssistantUsage: "forbidden",
      continuationLowHistoricalInputLimitation:
        "frozen_low_was_historically_generated_from_the_fixture_assistant_message",
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
        null: allEntries.filter((item) => item.fixtureInitialWorkingTask === "null")
          .map((item) => item.caseId),
        existing: allEntries.filter((item) => item.fixtureInitialWorkingTask === "existing")
          .map((item) => item.caseId)
      },
      continueEffectiveState: "runtime_from_first_gate_post_state"
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
      firstGateCorrectionPersistence:
        "persist_u3_into_working_task_and_understanding_post_state",
      firstGateVisibleBehavior:
        "frozen_low_only_with_null_high_understanding_and_zero_questions",
      continuationCausalInput:
        "actual_first_visible_bubble_plus_first_post_state_plus_fixture_u4",
      continuationFixtureStateAndAssistantForbidden: true,
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
    await readFile(path.join(cwd, GI088_RESPONSE_FIRST_V28_PATHS.publicStartCard), "utf8")
  ) as HighPlan;
  assert(plan.identity === GI088_RESPONSE_FIRST_V28_HIGH_QUALITY_IDENTITY, "GI088_RESPONSE_FIRST_V28_START_CARD_IDENTITY_MISMATCH");
  assert(await fileSha(cwd, FILES.standard) === GI088_RESPONSE_FIRST_V28_STANDARD_SHA256, "STANDARD_SHA256_MISMATCH");
  const immutableKeys = [
    "candidate",
    "parentCandidate",
    "fixtures",
    "frozenLowReceipt",
    "parentV27StartCard",
    "parentV27Receipt",
    "parentV27PrivateLedger",
    "semanticProjection",
    "semanticStateMerge",
    "provider",
    "providerContract",
    "runner"
  ] as const;
  for (const key of immutableKeys) {
    assert(
      await fileSha(cwd, FILES[key]) === plan.inputHashes[`${key}Sha256`],
      `GI088_RESPONSE_FIRST_V28_INPUT_DRIFT:${key}`
    );
  }
  const [dataset, frozenLow, parentV27] = await Promise.all([
    loadGi088ResponseFirstV22RubricV13Cases(cwd),
    loadFrozenLow(cwd),
    loadParentV27(cwd)
  ]);
  assert(
    dataset.datasetFingerprint === plan.dataset.fingerprint &&
      frozenLow.planFingerprint === plan.fixedFactors.frozenLowPlanFingerprint &&
      parentV27.planFingerprint === plan.fixedFactors.parentV27PlanFingerprint,
    "GI088_RESPONSE_FIRST_V28_SOURCE_DRIFT"
  );
  return plan;
}

async function readLedger(cwd: string, plan: HighPlan) {
  const file = path.join(cwd, GI088_RESPONSE_FIRST_V28_PATHS.privateLedger);
  const ledger = await readFile(file, "utf8")
    .then((source) => JSON.parse(source) as PrivateLedger)
    .catch(() => emptyLedger(plan));
  assert(
    ledger.identity === plan.identity &&
      ledger.planFingerprint === plan.planFingerprint,
    "GI088_RESPONSE_FIRST_V28_LEDGER_IDENTITY_MISMATCH"
  );
  return ledger;
}

function phaseResults(ledger: PrivateLedger, phase: Phase) {
  return ledger.results.filter((item) => item.phase === phase);
}

function sanitizePublicResult(result: Gi088ResponseFirstV28CallResult) {
  const understanding = result.parsedHigh?.visibleAppend.correctableUnderstanding;
  const questions = result.parsedHigh?.semantic.nextResponse.decision === "ask"
    ? result.parsedHigh.semantic.nextResponse.questions
    : [];
  const observation = result.informationGainObservation;
  const correctionAudit = result.parsedHigh?.correctionPersistenceAudit;
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
    inputCausality: result.inputCausality,
    postStateHash: result.postState ? sha(result.postState) : null,
    postStateWorkingTaskPresent: Boolean(result.postState?.workingTask),
    postStateUnderstandingCount: result.postState?.understandings.length ?? null,
    postStateInvalidatedItemCount:
      result.postState?.invalidatedItems.length ?? null,
    firstGateSemanticObservation: result.firstGateSemanticObservation,
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
    correctionPersistenceObservation: correctionAudit
      ? {
          decision: correctionAudit.decision,
          correctedMeaningEvidenceRefCount:
            correctionAudit.decision === "persist"
              ? correctionAudit.correctedMeaning.evidenceRefs.length
              : 0,
          correctedMeaningEvidenceRefsHash:
            correctionAudit.decision === "persist"
              ? sha(correctionAudit.correctedMeaning.evidenceRefs)
              : null,
          supersededAssistantMessageRefCount:
            correctionAudit.supersededAssistantMessageRefs.length,
          supersededAssistantMessageRefsHash:
            sha(correctionAudit.supersededAssistantMessageRefs),
          taskPlanKind:
            correctionAudit.decision === "persist"
              ? correctionAudit.statePlan.task.kind
              : null,
          understandingPlanKind:
            correctionAudit.decision === "persist"
              ? correctionAudit.statePlan.understanding.kind
              : null
        }
      : null,
    finishReason: result.diagnostics?.finishReason ?? null,
    reasoningPresent: result.diagnostics?.reasoningPresent ?? null,
    reasoningTokens: result.diagnostics?.reasoningTokens ?? null,
    tokenUsage: result.diagnostics?.tokenUsage ?? null,
    responseModel: result.diagnostics?.responseModel ?? null,
    httpStatus: result.diagnostics?.httpStatus ?? null
  };
}

function receiptStatus(plan: HighPlan, ledger: PrivateLedger) {
  if (ledger.productDecision.remaining) {
    return ledger.productDecision.remaining.gatePassed
      ? "v28_offline_quality_gate_passed_by_product_owner"
      : "v28_offline_quality_gate_failed_by_product_owner";
  }
  if (phaseResults(ledger, "remaining").length > 0) {
    return phaseResults(ledger, "remaining").length === plan.phases.remaining.length
      ? ledger.codexDecision.remaining
        ? "waiting_product_owner_remaining_review"
        : "remaining_complete_waiting_codex_review"
      : "remaining_stopped_by_technical_contract_or_speed_gate";
  }
  const firstGateResult = phaseResults(ledger, "first_gate")[0];
  if (firstGateResult) {
    if (
      firstGateResult.status === "technical_failure" ||
      !firstGateResult.fullRound60sHardPassed
    ) return "first_gate_technical_no_go";
    if (firstGateResult.status === "contract_failure")
      return "first_gate_contract_or_configuration_no_go";
    if (!firstGateResult.fullRound45sTargetPassed)
      return "first_gate_speed_no_go";
  }
  if (ledger.productDecision.first_gate) {
    return ledger.productDecision.first_gate.continuationAllowed
      ? "first_gate_pass_waiting_remaining"
      : "first_gate_failed_by_product_owner";
  }
  if (firstGateResult) {
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
    path.join(cwd, GI088_RESPONSE_FIRST_V28_PATHS.privateLedger),
    ledger,
    true
  );
  await writeJsonAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V28_PATHS.publicReceipt),
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
        firstGateConsumed: ledger.startedCaseIds.includes(GI088_RESPONSE_FIRST_V28_FIRST_CASE_ID) ? 1 : 0,
        remainingConsumed: ledger.startedCaseIds.filter((caseId) =>
          GI088_RESPONSE_FIRST_V28_REMAINING_CASE_IDS.includes(
            caseId as (typeof GI088_RESPONSE_FIRST_V28_REMAINING_CASE_IDS)[number]
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
        parentV27ResultEvidence:
          "private_ledger_frozen_input_hash_with_public_status_counts_and_hashes_only",
        continuationHighInput:
          "actual_first_visible_bubble_and_post_state_are_private;_public_receipt_has_hashes_only",
        reviewPresentationOrder: plan.reviewOrder
      }
    }
  );
  return ledger;
}

function fixtureCausality(
  turnInput: Board7bWorkingTaskV1TurnInput
): InputCausality {
  return {
    source: "fixture",
    fixtureSemanticStateIgnored: false,
    fixtureAssistantMessageReplaced: false,
    chainedFromCaseId: null,
    chainedFromResponseHash: null,
    effectiveTurnInputHash: sha(turnInput),
    actualAssistantMessageHash: null,
    replacedFixtureAssistantMessageHash: null,
    continuationLowHistoricalInputLimitation: false
  };
}

function resolveEffectiveTurnInput(input: {
  item: Gi088ResponseFirstV22RubricV13Case;
  datasetCases: Gi088ResponseFirstV22RubricV13Case[];
  frozenLowByCase: Map<
    Gi088ResponseFirstV22RubricV13CaseId,
    FrozenLowResult
  >;
  ledger: PrivateLedger;
}) {
  if (input.item.caseId !== "RPR-REAL-19-CONTINUE") {
    const turnInput = structuredClone(input.item.turnInput);
    return { turnInput, causality: fixtureCausality(turnInput) };
  }
  const correctionItem = input.datasetCases.find(
    (item) => item.caseId === GI088_RESPONSE_FIRST_V28_FIRST_CASE_ID
  );
  const correctionLow = input.frozenLowByCase.get(
    GI088_RESPONSE_FIRST_V28_FIRST_CASE_ID
  );
  const correctionResult = input.ledger.results.find(
    (result) => result.caseId === GI088_RESPONSE_FIRST_V28_FIRST_CASE_ID
  );
  assert(
    correctionItem &&
      correctionLow &&
      correctionResult?.status === "valid" &&
      correctionResult.parsedHigh &&
      correctionResult.postState &&
      correctionResult.responseHash,
    "GI088_RESPONSE_FIRST_V28_CONTINUE_REQUIRES_VALID_FIRST_POST_STATE"
  );
  const actualAssistantBubble = renderVisibleBubble({
    frozenLow: correctionLow.rawOutput,
    high: correctionResult.parsedHigh
  });
  const chained = buildGi088ResponseFirstV28ChainedContinueInput({
    correctionInput: correctionItem.turnInput,
    continuationFixtureInput: input.item.turnInput,
    correctionPostState: correctionResult.postState,
    actualAssistantBubble
  });
  return {
    turnInput: chained.turnInput,
    causality: {
      source: "correction_post_state_chain",
      fixtureSemanticStateIgnored: true,
      fixtureAssistantMessageReplaced: true,
      chainedFromCaseId: GI088_RESPONSE_FIRST_V28_FIRST_CASE_ID,
      chainedFromResponseHash: correctionResult.responseHash,
      effectiveTurnInputHash: sha(chained.turnInput),
      actualAssistantMessageHash: sha(chained.actualAssistantMessage),
      replacedFixtureAssistantMessageHash:
        sha(chained.replacedFixtureAssistantMessage),
      continuationLowHistoricalInputLimitation: true
    } satisfies InputCausality
  };
}

function observeFirstGateSemantics(input: {
  caseId: Gi088ResponseFirstV22RubricV13CaseId;
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
  high: Gi088ResponseFirstV28HighOutput;
  postState: Board7bWorkingTaskV1SemanticState | null;
}): Gi088ResponseFirstV28FirstGateSemanticObservation | null {
  if (input.caseId !== GI088_RESPONSE_FIRST_V28_FIRST_CASE_ID) return null;
  const audit = input.high.correctionPersistenceAudit;
  const latestAssistantId = input.turnInput.conversation
    .filter((message) => message.role === "assistant")
    .at(-1)?.id;
  const delivery = projectGi088ResponseFirstV28VisibleAppend({
    frozenLow: input.frozenLow,
    high: input.high
  });
  return {
    correctionDeclared: audit.decision === "persist",
    u3Grounded:
      audit.decision === "persist" &&
      audit.correctedMeaning.evidenceRefs.includes("U3"),
    supersededLatestAssistant:
      audit.decision === "persist" &&
      typeof latestAssistantId === "string" &&
      audit.supersededAssistantMessageRefs.includes(latestAssistantId),
    postStateTaskGrounded:
      input.postState?.workingTask?.evidenceRefs.includes("U3") ?? false,
    postStateUnderstandingGrounded:
      input.postState?.understandings.some((item) =>
        item.evidenceRefs.includes("U3")
      ) ?? false,
    visibleLowFrozen: delivery.lowText === input.frozenLow,
    highUnderstandingPresent: delivery.highUnderstanding !== null,
    questionCount: delivery.questions.length,
    correctedMeaningHash:
      audit.decision === "persist"
        ? sha(audit.correctedMeaning.summary)
        : null
  };
}

async function runCall(input: {
  phase: Phase;
  entry: HighPlan["phases"][Phase][number];
  item: Gi088ResponseFirstV22RubricV13Case;
  turnInput: Board7bWorkingTaskV1TurnInput;
  causality: InputCausality;
  low: FrozenLowResult;
  provider: AIProvider;
}) {
  const request = requestForTurnInput({
    turnInput: input.turnInput,
    frozenLow: input.low.rawOutput
  });
  const requestFingerprint = sha(request);
  assert(
    (input.entry.requestFingerprint === null ||
      requestFingerprint === input.entry.requestFingerprint) &&
      sha(input.low.rawOutput) === input.entry.frozenLowHash,
    `GI088_RESPONSE_FIRST_V28_REQUEST_DRIFT:${input.entry.caseId}`
  );
  if (input.item.caseId === "RPR-REAL-19-CONTINUE") {
    const fixtureAssistant = input.item.turnInput.conversation.at(-2);
    const actualAssistant = input.turnInput.conversation.at(-2);
    const userPrompt = request.messages[1]?.content ?? "";
    assert(
      input.causality.source === "correction_post_state_chain" &&
        input.causality.fixtureSemanticStateIgnored &&
        input.causality.fixtureAssistantMessageReplaced &&
        fixtureAssistant?.role === "assistant" &&
        actualAssistant?.role === "assistant" &&
        fixtureAssistant.content !== actualAssistant.content &&
        !userPrompt.includes(fixtureAssistant.content) &&
        userPrompt.includes(actualAssistant.content) &&
        input.turnInput.latestUserMessageId === "U4",
      "GI088_RESPONSE_FIRST_V28_CONTINUE_CAUSAL_INPUT_INVALID"
    );
  }
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  try {
    const completion = await input.provider.complete(request);
    const diagnostics = sanitizeAIProviderDiagnostics(completion.diagnostics);
    const highLatencyMs = diagnostics?.totalLatencyMs ?? completion.latencyMs ??
      Math.max(0, Date.now() - startedMs);
    const fullRoundLatencyMs = input.low.totalLatencyMs + highLatencyMs;
    try {
      const parsedHigh = parseGi088ResponseFirstV28HighOutput(completion.content);
      const validationIssues = validateGi088ResponseFirstV28HighOutput({
        turnInput: input.turnInput,
        frozenLow: input.low.rawOutput,
        high: parsedHigh
      });
      let postState: Board7bWorkingTaskV1SemanticState | null = null;
      try {
        postState = projectPostState({
          turnInput: input.turnInput,
          frozenLow: input.low.rawOutput,
          high: parsedHigh
        });
      } catch (error) {
        validationIssues.push(
          `POST_STATE_PROJECTION_FAILED:${
            error instanceof Error ? error.message : "unknown"
          }`
        );
      }
      const firstGateSemanticObservation = observeFirstGateSemantics({
        caseId: input.item.caseId,
        turnInput: input.turnInput,
        frozenLow: input.low.rawOutput,
        high: parsedHigh,
        postState
      });
      if (diagnostics?.responseModel !== GI088_RESPONSE_FIRST_V28_RUNTIME.model) {
        validationIssues.push(`RESPONSE_MODEL_MISMATCH:${diagnostics?.responseModel ?? "missing"}`);
      }
      if (diagnostics?.httpStatus !== 200) {
        validationIssues.push(`HIGH_HTTP_STATUS_INVALID:${diagnostics?.httpStatus ?? "missing"}`);
      }
      if (diagnostics?.finishReason !== "stop") {
        validationIssues.push(`HIGH_FINISH_REASON_INVALID:${diagnostics?.finishReason ?? "missing"}`);
      }
      if (diagnostics?.reasoningPresent !== false) {
        validationIssues.push(
          `HIGH_REASONING_PRESENT_INVALID:${diagnostics?.reasoningPresent ?? "missing"}`
        );
      }
      if (
        diagnostics?.reasoningTokens !== null &&
        diagnostics?.reasoningTokens !== 0
      ) {
        validationIssues.push(
          `HIGH_REASONING_TOKENS_INVALID:${diagnostics?.reasoningTokens ?? "missing"}`
        );
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
        requestFingerprint,
        frozenLowHash: input.entry.frozenLowHash,
        frozenLowLatencyMs: input.low.totalLatencyMs,
        responseHash: sha(completion.content),
        responseLength: completion.content.length,
        rawOutput: completion.content,
        parsedHigh,
        effectiveTurnInput: input.turnInput,
        postState,
        inputCausality: input.causality,
        validationIssues: [...new Set(validationIssues)],
        errorCode: status === "valid"
          ? null
          : diagnostics?.finishReason === "length"
            ? "GI088_RESPONSE_FIRST_V28_TOKEN_CEILING_INCONCLUSIVE"
            : validationIssues.some((issue) =>
                issue.startsWith("HIGH_REASONING_")
              )
              ? "GI088_RESPONSE_FIRST_V28_THINKING_DISABLED_CONFIGURATION_INVALID"
              : "GI088_RESPONSE_FIRST_V28_CONTRACT_INVALID",
        highLatencyMs,
        fullRoundLatencyMs,
        fullRound45sTargetPassed: fullRoundLatencyMs <= 45_000,
        fullRound60sHardPassed: fullRoundLatencyMs <= 60_000,
        informationGainObservation:
          observeGi088ResponseFirstV28InformationGainAudit(parsedHigh),
        correctionPersistenceObservation:
          observeGi088ResponseFirstV28CorrectionPersistenceAudit(parsedHigh),
        firstGateSemanticObservation,
        diagnostics
      } satisfies Gi088ResponseFirstV28CallResult;
    } catch (error) {
      return {
        phase: input.phase,
        order: input.entry.order,
        caseId: input.entry.caseId,
        status: "contract_failure" as const,
        startedAt,
        completedAt: new Date().toISOString(),
        requestFingerprint,
        frozenLowHash: input.entry.frozenLowHash,
        frozenLowLatencyMs: input.low.totalLatencyMs,
        responseHash: sha(completion.content),
        responseLength: completion.content.length,
        rawOutput: completion.content,
        parsedHigh: null,
        effectiveTurnInput: input.turnInput,
        postState: null,
        inputCausality: input.causality,
        validationIssues: [error instanceof Error ? error.message : "HIGH_PARSE_FAILED"],
        errorCode: diagnostics?.finishReason === "length"
          ? "GI088_RESPONSE_FIRST_V28_TOKEN_CEILING_INCONCLUSIVE"
          : "GI088_RESPONSE_FIRST_V28_PARSE_FAILED",
        highLatencyMs,
        fullRoundLatencyMs,
        fullRound45sTargetPassed: fullRoundLatencyMs <= 45_000,
        fullRound60sHardPassed: fullRoundLatencyMs <= 60_000,
        informationGainObservation: null,
        correctionPersistenceObservation: null,
        firstGateSemanticObservation: null,
        diagnostics
      } satisfies Gi088ResponseFirstV28CallResult;
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
      requestFingerprint,
      frozenLowHash: input.entry.frozenLowHash,
      frozenLowLatencyMs: input.low.totalLatencyMs,
      responseHash: null,
      responseLength: 0,
      rawOutput: null,
      parsedHigh: null,
      effectiveTurnInput: input.turnInput,
      postState: null,
      inputCausality: input.causality,
      validationIssues: [],
      errorCode: getAIProviderFailureCode(error),
      highLatencyMs,
      fullRoundLatencyMs,
      fullRound45sTargetPassed: fullRoundLatencyMs <= 45_000,
      fullRound60sHardPassed: fullRoundLatencyMs <= 60_000,
      informationGainObservation: null,
      correctionPersistenceObservation: null,
      firstGateSemanticObservation: null,
      diagnostics
    } satisfies Gi088ResponseFirstV28CallResult;
  }
}

export async function runGi088ResponseFirstV28Phase(input: {
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
    const saved = await saveLedger(cwd, input.plan, ledger);
    const reviewable = existing.filter(
      (result) => result.status === "valid" && result.rawOutput !== null
    );
    if (reviewable.length > 0) {
      await writeReviewHtml({
        cwd,
        workspaceRoot,
        plan: input.plan,
        phase: input.phase,
        results: reviewable,
        decisions: []
      });
    }
    return saved;
  }
  assert(
    ledger.startedCaseIds.length === ledger.results.length,
    "GI088_RESPONSE_FIRST_V28_STARTED_CALL_REQUIRES_AUDIT"
  );
  assert(existing.length === 0, `GI088_RESPONSE_FIRST_V28_PARTIAL_PHASE_REQUIRES_AUDIT:${input.phase}`);
  if (input.phase === "remaining") {
    assert(
      ledger.productDecision.first_gate?.continuationAllowed === true,
      "GI088_RESPONSE_FIRST_V28_REMAINING_REQUIRES_PRODUCT_FIRST_PASS"
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
    assert(item && low, `GI088_RESPONSE_FIRST_V28_CASE_LOST:${entry.caseId}`);
    const effective = resolveEffectiveTurnInput({
      item,
      datasetCases: dataset.cases,
      frozenLowByCase: lowByCase,
      ledger
    });
    ledger.startedCaseIds.push(entry.caseId);
    await saveLedger(cwd, input.plan, ledger);
    const result = await runCall({
      phase: input.phase,
      entry,
      item,
      turnInput: effective.turnInput,
      causality: effective.causality,
      low,
      provider: input.provider
    });
    ledger.results.push(result);
    await saveLedger(cwd, input.plan, ledger);
    if (result.status !== "valid" || !result.fullRound60sHardPassed) break;
  }
  const saved = await saveLedger(cwd, input.plan, ledger);
  const reviewable = phaseResults(ledger, input.phase).filter(
    (result) => result.status === "valid" && result.rawOutput !== null
  );
  if (reviewable.length > 0) {
    await writeReviewHtml({
      cwd,
      workspaceRoot,
      plan: input.plan,
      phase: input.phase,
      results: reviewable,
      decisions: []
    });
  }
  return saved;
}

export function evaluateGi088ResponseFirstV28Review(input: {
  plan: HighPlan;
  phase: Phase;
  results: Gi088ResponseFirstV28CallResult[];
  decisions: Gi088ResponseFirstV28ReviewDecision[];
  firstGateResults?: Gi088ResponseFirstV28CallResult[];
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
  const firstGateSpeedPassed = input.phase !== "first_gate" ||
    input.results.every((item) => item.fullRound45sTargetPassed);
  const counts = {
    pass: input.decisions.filter((item) => item.verdict === "pass").length,
    minor: input.decisions.filter((item) => item.verdict === "minor").length,
    fail: input.decisions.filter((item) => item.verdict === "fail").length
  };
  const continuationAllowed = input.phase === "first_gate" &&
    allCallsValid && firstGateSpeedPassed && completeReview && counts.pass === 1;
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
      ? `v28_${input.phase}_quality_gate_passed`
      : `v28_${input.phase}_quality_gate_failed`,
    gatePassed: phaseQualityPassed,
    continuationAllowed,
    allCallsValid,
    firstGateSpeedPassed,
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
  results: Gi088ResponseFirstV28CallResult[];
  decisions: Gi088ResponseFirstV28ReviewDecision[];
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
    const transcript = result.effectiveTurnInput.conversation.map((message) =>
      `<p><strong>${message.role === "user" ? "用户" : "AI"} ${escapeHtml(message.id)}</strong>：${escapeHtml(message.content)}</p>`
    ).join("\n");
    const delivery = result.parsedHigh
      ? projectGi088ResponseFirstV28VisibleAppend({ frozenLow: low.rawOutput, high: result.parsedHigh })
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
      `completion=${tokenUsage?.completionTokens ?? "missing"}/${GI088_RESPONSE_FIRST_V28_RUNTIME.high.maxTokens}`,
      `reasoning=${result.diagnostics?.reasoningTokens ?? "missing"}`,
      `input=${result.inputCausality.source}`,
      `postState=${result.postState ? sha(result.postState) : "missing"}`,
      result.validationIssues.join("；") || "来源与合同有效"
    ].join(" · ");
    return `<article class="card"><p>${result.caseId}</p><h2>${escapeHtml(item.title)}</h2><section><h3>1. 完整相关原文</h3>${transcript}</section><section><h3>2. 冻结 Low</h3><p>${escapeHtml(low.rawOutput)}</p></section><section><h3>3. High 实际原始输出</h3><pre>${escapeHtml(result.rawOutput ?? "")}</pre></section><section><h3>4. 同气泡可见追加</h3>${understanding}${questions}</section><section><h3>5. 技术事实</h3><p>${escapeHtml(technical)}</p></section><section><h3>6. Codex 逐问对照与初评</h3><p><strong>${review?.verdict ?? "待评"}</strong>　${escapeHtml(review?.note ?? "")}</p></section></article>`;
  }).join("\n");
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GI-088 v2.8 ${input.phase}</title><style>:root{font-family:ui-sans-serif,system-ui;background:#f4f1ea;color:#211f1b}body{margin:0}.wrap{max-width:960px;margin:auto;padding:36px 20px 110px}.card{background:#fffdf8;border:1px solid #d8d1c4;border-radius:20px;padding:22px;margin:18px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f1e8;padding:12px;border-radius:12px}section{border-top:1px solid #e7e0d4;padding-top:12px;margin-top:16px}</style></head><body><main class="wrap"><h1>v2.8 ${input.phase}</h1><p>完整原文 → Low → High → 技术事实 → Codex 逐问对照与初评。</p>${cards}</main></body></html>`;
  const relative = input.phase === "first_gate"
    ? GI088_RESPONSE_FIRST_V28_PATHS.privateFirstReviewHtml
    : GI088_RESPONSE_FIRST_V28_PATHS.privateRemainingReviewHtml;
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
    decisions: Gi088ResponseFirstV28ReviewDecision[];
  };
  assert(
    review.identity === plan.identity &&
      review.planFingerprint === plan.planFingerprint &&
      review.phase === phase &&
      review.reviewerRole === reviewerRole,
    "GI088_RESPONSE_FIRST_V28_REVIEW_IDENTITY_MISMATCH"
  );
  return review;
}

async function prepare(cwd: string) {
  const file = path.join(cwd, GI088_RESPONSE_FIRST_V28_PATHS.publicStartCard);
  if (await pathExists(file)) return readFrozenPlan(cwd);
  const plan = await createGi088ResponseFirstV28Plan(cwd);
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
    assert(response.ok, `GI088_RESPONSE_FIRST_V28_MODEL_LIST_HTTP_${response.status}`);
    const payload = JSON.parse(source) as { data?: Array<{ id?: unknown }> };
    const modelIds = (payload.data ?? []).flatMap((item) =>
      typeof item.id === "string" ? [item.id] : []
    );
    assert(modelIds.includes(GI088_RESPONSE_FIRST_V28_RUNTIME.model), "GI088_RESPONSE_FIRST_V28_TARGET_MODEL_UNAVAILABLE");
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
  assert(apiKey, "GI088_RESPONSE_FIRST_V28_DEEPSEEK_API_KEY_MISSING");
  const ledger = await readLedger(cwd, plan);
  if (!ledger.preflight) {
    ledger.preflight = await checkTargetModel(apiKey);
    await saveLedger(cwd, plan, ledger);
  }
  return new OpenAIProvider({
    apiKey,
    model: GI088_RESPONSE_FIRST_V28_RUNTIME.model,
    baseUrl: "https://api.deepseek.com",
    timeoutMs: GI088_RESPONSE_FIRST_V28_RUNTIME.high.hardTimeoutMs
  });
}

async function executePhase(cwd: string, phase: Phase) {
  const plan = await prepare(cwd);
  const provider = await providerForExecution(cwd, plan);
  const ledger = await runGi088ResponseFirstV28Phase({
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
    publicReceipt: GI088_RESPONSE_FIRST_V28_PATHS.publicReceipt
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
  assert(results.length === plan.phases[phase].length, `GI088_RESPONSE_FIRST_V28_RESULTS_INCOMPLETE:${phase}`);
  const relative = phase === "first_gate"
    ? reviewerRole === "codex"
      ? GI088_RESPONSE_FIRST_V28_PATHS.privateFirstCodexReview
      : GI088_RESPONSE_FIRST_V28_PATHS.privateFirstProductReview
    : reviewerRole === "codex"
      ? GI088_RESPONSE_FIRST_V28_PATHS.privateRemainingCodexReview
      : GI088_RESPONSE_FIRST_V28_PATHS.privateRemainingProductReview;
  const review = await readReview(path.join(cwd, relative), plan, phase, reviewerRole);
  const summary = evaluateGi088ResponseFirstV28Review({
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
  const command = process.env.GI088_RESPONSE_FIRST_V28_COMMAND ??
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
    publicStartCard: GI088_RESPONSE_FIRST_V28_PATHS.publicStartCard
  }, null, 2)}\n`);
}

if (
  process.env.VITEST !== "true" &&
  (process.env.GI088_RESPONSE_FIRST_V28_COMMAND ||
    (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(RUNNER_FILE)))
) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
