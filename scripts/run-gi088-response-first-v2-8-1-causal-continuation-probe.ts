import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import type {
  Board7bWorkingTaskV1SemanticState,
  Board7bWorkingTaskV1TurnInput
} from "../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_RESPONSE_FIRST_V22_RUNTIME,
  createGi088ResponseFirstV22Identity,
  createGi088ResponseFirstV22LowUserPrompt,
  getGi088ResponseFirstV22LowSystemPrompt,
  parseGi088ResponseFirstV22LowOutput,
  validateGi088ResponseFirstV22LowOutput
} from "../evals/event-centered-generative/gi088-response-first-v2-2/candidate";
import {
  projectGi088ResponseFirstV2HighOutput,
  type Gi088ResponseFirstV2HighOutput
} from "../evals/event-centered-generative/gi088-response-first-v2/candidate";
import {
  GI088_RESPONSE_FIRST_V28_RUNTIME,
  createGi088ResponseFirstV28HighUserPrompt,
  createGi088ResponseFirstV28Identity,
  getGi088ResponseFirstV28HighSystemPrompt,
  parseGi088ResponseFirstV28HighOutput,
  projectGi088ResponseFirstV28VisibleAppend,
  validateGi088ResponseFirstV28HighOutput,
  type Gi088ResponseFirstV28HighOutput
} from "../evals/event-centered-generative/gi088-response-first-v2-8-correction-persistence-high/candidate";
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
  applyGi088SemanticDeltaValidatedResult,
  type Gi088SemanticDeltaOutput
} from "../src/server/services/evaluation/gi088/semantic-delta";
import {
  GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT,
  loadGi088ResponseFirstV22RubricV13Cases
} from "./gi088-response-first-v2-2-rubric-v1-3-fixtures";

export const GI088_RESPONSE_FIRST_V281_IDENTITY =
  "2026-08-19.gi088-response-first-v2-8-1-causal-continuation-probe-v1" as const;
export const GI088_RESPONSE_FIRST_V281_STANDARD_SHA256 =
  "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60" as const;
export const GI088_RESPONSE_FIRST_V281_PARENT_CASE_ID =
  "RPR-REAL-19-CORRECTION" as const;
export const GI088_RESPONSE_FIRST_V281_CASE_ID =
  "RPR-REAL-19-CONTINUE" as const;

const PRIVATE_ROOT =
  `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-8-1/causal-continuation-probe-v1`;

export const GI088_RESPONSE_FIRST_V281_PATHS = {
  publicStartCard:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-8-1-causal-continuation-probe-v1-start-card.json`,
  publicReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-8-1-causal-continuation-probe-v1-receipt.json`,
  privateLedger: `${PRIVATE_ROOT}/ledger.json`,
  privateReviewHtml: `${PRIVATE_ROOT}/review.html`,
  privateProductReview: `${PRIVATE_ROOT}/product-owner-review.json`,
  privateProductReviewTemplate: `${PRIVATE_ROOT}/product-owner-review.template.json`,
  parentStartCard:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-8-correction-persistence-high-quality-v1-start-card.json`,
  parentReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-8-correction-persistence-high-quality-v1-receipt.json`,
  parentPrivateLedger:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-8/correction-persistence-high-quality-v1/ledger.json`,
  parentProductReview:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-8/correction-persistence-high-quality-v1/first-product-review.json`,
  frozenLowReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-2-low-full-quality-v2-receipt.json`,
  frozenLowPrivateLedger:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-2/low-full-quality-v2/ledger.json`
} as const;

const RUNNER_FILE =
  "scripts/run-gi088-response-first-v2-8-1-causal-continuation-probe.ts";
const FILES = {
  standard: "docs/ai-evaluation-standard.md",
  plan:
    "docs/plans/2026-08-19-gi088-response-first-v2-8-1-causal-continuation-probe.md",
  lowCandidate:
    "evals/event-centered-generative/gi088-response-first-v2-2/candidate.ts",
  highCandidate:
    "evals/event-centered-generative/gi088-response-first-v2-8-correction-persistence-high/candidate.ts",
  baseProjection:
    "evals/event-centered-generative/gi088-response-first-v2/candidate.ts",
  semanticStateMerge: "src/server/services/evaluation/gi088/semantic-delta.ts",
  fixtures: "scripts/gi088-response-first-v2-2-rubric-v1-3-fixtures.ts",
  provider: "src/server/services/ai/openai.provider.ts",
  providerContract: "src/server/services/ai/ai-provider.ts",
  runner: RUNNER_FILE
} as const;

type Verdict = "pass" | "minor" | "fail";
type Stage = "low" | "high";

export type Gi088ResponseFirstV281ParentProductReview = {
  identity: string;
  planFingerprint: string;
  phase: "first_gate";
  reviewerRole: "product_owner";
  evidenceBinding: {
    caseId: typeof GI088_RESPONSE_FIRST_V281_PARENT_CASE_ID;
    responseHash: string;
    postStateHash: string;
  };
  decisions: Array<{
    caseId: typeof GI088_RESPONSE_FIRST_V281_PARENT_CASE_ID;
    verdict: Verdict;
    note: string;
  }>;
};

export type Gi088ResponseFirstV281ProductReview = {
  identity: typeof GI088_RESPONSE_FIRST_V281_IDENTITY;
  planFingerprint: string;
  reviewerRole: "product_owner";
  evidenceBinding: {
    parentResponseHash: string;
    parentPostStateHash: string;
    effectiveTurnInputHash: string;
    lowResponseHash: string;
    highResponseHash: string;
    continuationPostStateHash: string;
  };
  verdict: Verdict;
  note: string;
};

type SafeDiagnostics = ReturnType<typeof sanitizeAIProviderDiagnostics>;

export type Gi088ResponseFirstV281LowResult = {
  stage: "low";
  status: "valid" | "contract_failure" | "technical_failure";
  startedAt: string;
  completedAt: string;
  requestFingerprint: string;
  responseHash: string | null;
  responseLength: number;
  rawOutput: string | null;
  validationIssues: string[];
  errorCode: string | null;
  latencyMs: number;
  target15sPassed: boolean;
  hard45sPassed: boolean;
  diagnostics: SafeDiagnostics;
};

export type Gi088ResponseFirstV281HighResult = {
  stage: "high";
  status: "valid" | "contract_failure" | "technical_failure";
  startedAt: string;
  completedAt: string;
  requestFingerprint: string;
  frozenLowHash: string;
  responseHash: string | null;
  responseLength: number;
  rawOutput: string | null;
  parsedHigh: Gi088ResponseFirstV28HighOutput | null;
  continuationPostState: Board7bWorkingTaskV1SemanticState | null;
  validationIssues: string[];
  errorCode: string | null;
  latencyMs: number;
  fullRoundLatencyMs: number;
  fullRound45sTargetPassed: boolean;
  fullRound60sHardPassed: boolean;
  diagnostics: SafeDiagnostics;
};

type ParentEvidence = {
  identity: string;
  planFingerprint: string;
  candidateFingerprint: string;
  startCardSha256: string;
  receiptSha256: string;
  privateLedgerSha256: string;
  responseHash: string;
  postStateHash: string;
  rawResultFingerprint: string;
  correctionInput: Board7bWorkingTaskV1TurnInput;
  continuationFixtureInput: Board7bWorkingTaskV1TurnInput;
  parsedHigh: Gi088ResponseFirstV28HighOutput;
  postState: Board7bWorkingTaskV1SemanticState;
  actualAssistantBubble: string;
  correctionLowHash: string;
  historicalContinuationLowHash: string;
};

type ProbePlan = Awaited<ReturnType<typeof createGi088ResponseFirstV281Plan>>;
type PrivateLedger = {
  identity: typeof GI088_RESPONSE_FIRST_V281_IDENTITY;
  planFingerprint: string;
  callsStarted: Stage[];
  parentGate: {
    verdict: Verdict;
    reviewHash: string;
    responseHash: string;
    postStateHash: string;
  } | null;
  effectiveTurnInput: Board7bWorkingTaskV1TurnInput | null;
  effectiveTurnInputHash: string | null;
  replacedFixtureAssistantHash: string | null;
  actualAssistantHash: string | null;
  low: Gi088ResponseFirstV281LowResult | null;
  high: Gi088ResponseFirstV281HighResult | null;
  productDecision: {
    verdict: Verdict;
    noteHash: string;
    technicalGatePassed: boolean;
    gatePassed: boolean;
    reviewHash: string;
  } | null;
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

export function gi088ResponseFirstV281Sha(value: unknown) {
  return createHash("sha256")
    .update(
      typeof value === "string" || Buffer.isBuffer(value)
        ? value
        : JSON.stringify(canonicalize(value))
    )
    .digest("hex");
}

async function fileSha(cwd: string, relativePath: string) {
  return gi088ResponseFirstV281Sha(await readFile(path.join(cwd, relativePath)));
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
  return applyGi088SemanticDeltaValidatedResult({
    input: input.turnInput,
    output: { semantic, visible: projected.visible } satisfies Gi088SemanticDeltaOutput
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

async function loadFrozenLow(cwd: string) {
  const [receiptSource, ledgerSource] = await Promise.all([
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V281_PATHS.frozenLowReceipt), "utf8"),
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V281_PATHS.frozenLowPrivateLedger), "utf8")
  ]);
  const receipt = JSON.parse(receiptSource) as {
    identity: string;
    candidateFingerprint: string;
    productDecision: { gatePassed?: boolean } | null;
    results: Array<{ caseId: string; responseHash: string | null }>;
  };
  const ledger = JSON.parse(ledgerSource) as {
    identity: string;
    productDecision: { gatePassed?: boolean } | null;
    results: Array<{
      caseId: string;
      status: string;
      rawOutput: string | null;
      responseHash: string | null;
    }>;
  };
  assert(
    receipt.identity === "2026-08-17.gi088-response-first-v2-2-low-full-quality-v2" &&
      ledger.identity === receipt.identity &&
      receipt.productDecision?.gatePassed === true &&
      ledger.productDecision?.gatePassed === true &&
      receipt.candidateFingerprint === createGi088ResponseFirstV22Identity().candidateFingerprint,
    "GI088_RESPONSE_FIRST_V281_FROZEN_LOW_IDENTITY_INVALID"
  );
  const publicByCase = new Map(receipt.results.map((item) => [item.caseId, item]));
  const get = (caseId: string) => {
    const item = ledger.results.find((result) => result.caseId === caseId);
    assert(
      item?.status === "valid" &&
        typeof item.rawOutput === "string" &&
        typeof item.responseHash === "string" &&
        gi088ResponseFirstV281Sha(item.rawOutput) === item.responseHash &&
        publicByCase.get(caseId)?.responseHash === item.responseHash,
      `GI088_RESPONSE_FIRST_V281_FROZEN_LOW_INVALID:${caseId}`
    );
    return { rawOutput: item.rawOutput, responseHash: item.responseHash };
  };
  return {
    candidateFingerprint: receipt.candidateFingerprint,
    correction: get(GI088_RESPONSE_FIRST_V281_PARENT_CASE_ID),
    continuation: get(GI088_RESPONSE_FIRST_V281_CASE_ID)
  };
}

export async function loadGi088ResponseFirstV281ParentEvidence(
  cwd = process.cwd()
): Promise<ParentEvidence> {
  const [startSource, receiptSource, ledgerSource, dataset, frozenLow] =
    await Promise.all([
      readFile(path.join(cwd, GI088_RESPONSE_FIRST_V281_PATHS.parentStartCard), "utf8"),
      readFile(path.join(cwd, GI088_RESPONSE_FIRST_V281_PATHS.parentReceipt), "utf8"),
      readFile(path.join(cwd, GI088_RESPONSE_FIRST_V281_PATHS.parentPrivateLedger), "utf8"),
      loadGi088ResponseFirstV22RubricV13Cases(cwd),
      loadFrozenLow(cwd)
    ]);
  const start = JSON.parse(startSource) as Record<string, unknown> & {
    identity: string;
    planFingerprint: string;
    candidateIdentity: { candidateFingerprint: string };
  };
  const { planFingerprint: frozenPlanFingerprint, ...startCore } = start;
  const expectedHighIdentity = createGi088ResponseFirstV28Identity();
  assert(
    start.identity ===
      "2026-08-19.gi088-response-first-v2-8-correction-persistence-high-quality-v1" &&
      gi088ResponseFirstV281Sha(startCore) === frozenPlanFingerprint &&
      start.candidateIdentity.candidateFingerprint ===
        expectedHighIdentity.candidateFingerprint,
    "GI088_RESPONSE_FIRST_V281_PARENT_START_CARD_INVALID"
  );
  const receipt = JSON.parse(receiptSource) as {
    identity: string;
    planFingerprint: string;
    candidateFingerprint: string;
    budget: { consumed: number; remainingConsumed: number };
    results: Array<{
      caseId: string;
      status: string;
      responseHash: string | null;
      frozenLowHash: string;
      postStateHash: string | null;
      validationIssues: string[];
    }>;
  };
  const ledger = JSON.parse(ledgerSource) as {
    identity: string;
    planFingerprint: string;
    startedCaseIds: string[];
    results: Array<{
      caseId: string;
      status: string;
      responseHash: string | null;
      rawOutput: string | null;
      parsedHigh: unknown;
      postState: Board7bWorkingTaskV1SemanticState | null;
      validationIssues: string[];
    }>;
  };
  const publicFirst = receipt.results[0];
  const privateFirst = ledger.results[0];
  assert(
    receipt.identity === start.identity &&
      ledger.identity === start.identity &&
      receipt.planFingerprint === frozenPlanFingerprint &&
      ledger.planFingerprint === frozenPlanFingerprint &&
      receipt.candidateFingerprint === start.candidateIdentity.candidateFingerprint &&
      receipt.budget.consumed === 1 &&
      receipt.budget.remainingConsumed === 0 &&
      receipt.results.length === 1 &&
      ledger.startedCaseIds.length === 1 &&
      ledger.startedCaseIds[0] === GI088_RESPONSE_FIRST_V281_PARENT_CASE_ID &&
      ledger.results.length === 1 &&
      publicFirst?.caseId === GI088_RESPONSE_FIRST_V281_PARENT_CASE_ID &&
      privateFirst?.caseId === publicFirst.caseId &&
      publicFirst.status === "valid" &&
      privateFirst.status === "valid" &&
      publicFirst.validationIssues.length === 0 &&
      privateFirst.validationIssues.length === 0 &&
      typeof publicFirst.responseHash === "string" &&
      privateFirst.responseHash === publicFirst.responseHash &&
      typeof privateFirst.rawOutput === "string" &&
      gi088ResponseFirstV281Sha(privateFirst.rawOutput) === publicFirst.responseHash &&
      publicFirst.frozenLowHash === frozenLow.correction.responseHash,
    "GI088_RESPONSE_FIRST_V281_PARENT_RESULT_INVALID"
  );
  const correction = dataset.cases.find(
    (item) => item.caseId === GI088_RESPONSE_FIRST_V281_PARENT_CASE_ID
  );
  const continuation = dataset.cases.find(
    (item) => item.caseId === GI088_RESPONSE_FIRST_V281_CASE_ID
  );
  assert(correction && continuation, "GI088_RESPONSE_FIRST_V281_CASES_MISSING");
  const parsedHigh = parseGi088ResponseFirstV28HighOutput(privateFirst.rawOutput);
  const validationIssues = validateGi088ResponseFirstV28HighOutput({
    turnInput: correction.turnInput,
    frozenLow: frozenLow.correction.rawOutput,
    high: parsedHigh
  });
  assert(
    validationIssues.length === 0,
    `GI088_RESPONSE_FIRST_V281_PARENT_REVALIDATION_FAILED:${validationIssues.join("|")}`
  );
  const postState = projectPostState({
    turnInput: correction.turnInput,
    frozenLow: frozenLow.correction.rawOutput,
    high: parsedHigh
  });
  const postStateHash = gi088ResponseFirstV281Sha(postState);
  assert(
    publicFirst.postStateHash === postStateHash &&
      privateFirst.postState !== null &&
      gi088ResponseFirstV281Sha(privateFirst.postState) === postStateHash,
    "GI088_RESPONSE_FIRST_V281_PARENT_POST_STATE_REPLAY_MISMATCH"
  );
  const actualAssistantBubble = renderVisibleBubble({
    frozenLow: frozenLow.correction.rawOutput,
    high: parsedHigh
  });
  return {
    identity: start.identity,
    planFingerprint: frozenPlanFingerprint,
    candidateFingerprint: start.candidateIdentity.candidateFingerprint,
    startCardSha256: gi088ResponseFirstV281Sha(startSource),
    receiptSha256: gi088ResponseFirstV281Sha(receiptSource),
    privateLedgerSha256: gi088ResponseFirstV281Sha(ledgerSource),
    responseHash: publicFirst.responseHash,
    postStateHash,
    rawResultFingerprint: gi088ResponseFirstV281Sha({
      responseHash: publicFirst.responseHash,
      postStateHash,
      frozenLowHash: publicFirst.frozenLowHash
    }),
    correctionInput: correction.turnInput,
    continuationFixtureInput: continuation.turnInput,
    parsedHigh,
    postState,
    actualAssistantBubble,
    correctionLowHash: frozenLow.correction.responseHash,
    historicalContinuationLowHash: frozenLow.continuation.responseHash
  };
}

export function buildGi088ResponseFirstV281CausalTurnInput(
  parent: ParentEvidence
) {
  const fixtureAssistant = parent.continuationFixtureInput.conversation.at(-2);
  const continuationUser = parent.continuationFixtureInput.conversation.at(-1);
  assert(
    gi088ResponseFirstV281Sha(
      parent.continuationFixtureInput.conversation.slice(0, -2)
    ) === gi088ResponseFirstV281Sha(parent.correctionInput.conversation) &&
      fixtureAssistant?.role === "assistant" &&
      continuationUser?.role === "user" &&
      continuationUser.id === parent.continuationFixtureInput.latestUserMessageId,
    "GI088_RESPONSE_FIRST_V281_CONTINUE_FIXTURE_SHAPE_INVALID"
  );
  const turnInput: Board7bWorkingTaskV1TurnInput = {
    mode: parent.continuationFixtureInput.mode,
    conversation: [
      ...structuredClone(parent.correctionInput.conversation),
      { ...fixtureAssistant, content: parent.actualAssistantBubble },
      structuredClone(continuationUser)
    ],
    latestUserMessageId: continuationUser.id,
    semanticState: structuredClone(parent.postState)
  };
  assert(
    fixtureAssistant.content !== parent.actualAssistantBubble &&
      turnInput.latestUserMessageId === "U4" &&
      gi088ResponseFirstV281Sha(turnInput.semanticState) === parent.postStateHash,
    "GI088_RESPONSE_FIRST_V281_CAUSAL_INPUT_INVALID"
  );
  return {
    turnInput,
    replacedFixtureAssistant: fixtureAssistant,
    actualAssistant: turnInput.conversation.at(-2)!
  };
}

function lowRequest(turnInput: Board7bWorkingTaskV1TurnInput): AICompletionParams {
  const runtime = GI088_RESPONSE_FIRST_V22_RUNTIME.low;
  return {
    messages: [
      { role: "system", content: getGi088ResponseFirstV22LowSystemPrompt() },
      { role: "user", content: createGi088ResponseFirstV22LowUserPrompt(turnInput) }
    ],
    maxTokens: runtime.maxTokens,
    headersTimeoutMs: runtime.headersTimeoutMs,
    bodyIdleTimeoutMs: runtime.bodyIdleTimeoutMs,
    hardTimeoutMs: runtime.hardTimeoutMs,
    timeoutMs: runtime.hardTimeoutMs,
    thinking: runtime.thinking,
    reasoningEffort: runtime.reasoningEffort
  };
}

function highRequest(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  lowText: string;
}): AICompletionParams {
  const runtime = GI088_RESPONSE_FIRST_V28_RUNTIME.high;
  return {
    messages: [
      { role: "system", content: getGi088ResponseFirstV28HighSystemPrompt() },
      {
        role: "user",
        content: createGi088ResponseFirstV28HighUserPrompt({
          turnInput: input.turnInput,
          frozenLow: input.lowText
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

export async function createGi088ResponseFirstV281Plan(cwd = process.cwd()) {
  assert(
    await fileSha(cwd, FILES.standard) === GI088_RESPONSE_FIRST_V281_STANDARD_SHA256,
    "STANDARD_SHA256_MISMATCH"
  );
  const [parent, inputHashes] = await Promise.all([
    loadGi088ResponseFirstV281ParentEvidence(cwd),
    Object.fromEntries(
      await Promise.all(
        Object.entries(FILES).map(async ([key, relativePath]) => [
          `${key}Sha256`,
          await fileSha(cwd, relativePath)
        ])
      )
    ) as Promise<Record<string, string>>
  ]);
  const lowIdentity = createGi088ResponseFirstV22Identity();
  const highIdentity = createGi088ResponseFirstV28Identity();
  const causal = buildGi088ResponseFirstV281CausalTurnInput(parent);
  const core = {
    schemaVersion: "1.0",
    identity: GI088_RESPONSE_FIRST_V281_IDENTITY,
    status: "ready_waiting_parent_product_hash_bound_review",
    productDecision:
      "whether_a_fully_causal_low_then_high_continue_turn_uses_the_persisted_correction_naturally",
    changedFactor:
      "replace_historical_continue_low_with_current_low_generated_from_actual_parent_visible_and_replayed_post_state",
    candidates: {
      lowVersion: lowIdentity.version,
      lowCandidateFingerprint: lowIdentity.candidateFingerprint,
      highVersion: highIdentity.version,
      highCandidateFingerprint: highIdentity.candidateFingerprint,
      highUnchangedFromV28: true
    },
    parentV28: {
      identity: parent.identity,
      planFingerprint: parent.planFingerprint,
      candidateFingerprint: parent.candidateFingerprint,
      startCardSha256: parent.startCardSha256,
      receiptSnapshotSha256: parent.receiptSha256,
      privateLedgerSnapshotSha256: parent.privateLedgerSha256,
      responseHash: parent.responseHash,
      postStateHash: parent.postStateHash,
      rawResultFingerprint: parent.rawResultFingerprint,
      startCardPlanFingerprintRecomputed: true,
      rawOutputReparsedAndValidated: true,
      postStateReprojected: true,
      productReviewPath: GI088_RESPONSE_FIRST_V281_PATHS.parentProductReview,
      productReviewMustBindResponseAndPostStateHashes: true,
      allowedProductVerdicts: ["pass", "minor"]
    },
    causalInput: {
      caseId: GI088_RESPONSE_FIRST_V281_CASE_ID,
      parentCaseId: GI088_RESPONSE_FIRST_V281_PARENT_CASE_ID,
      effectiveTurnInputHash: gi088ResponseFirstV281Sha(causal.turnInput),
      actualAssistantHash: gi088ResponseFirstV281Sha(causal.actualAssistant),
      replacedFixtureAssistantHash:
        gi088ResponseFirstV281Sha(causal.replacedFixtureAssistant),
      parentPostStateHash: parent.postStateHash,
      latestUserMessageId: causal.turnInput.latestUserMessageId,
      fixtureAssistantBodyExcluded: true,
      fixtureSemanticStateExcluded: true,
      historicalContinuationLowHash: parent.historicalContinuationLowHash,
      lowSource: "new_v22_model_call_from_effective_causal_input"
    },
    runtime: {
      provider: GI088_RESPONSE_FIRST_V28_RUNTIME.provider,
      model: GI088_RESPONSE_FIRST_V28_RUNTIME.model,
      low: GI088_RESPONSE_FIRST_V22_RUNTIME.low,
      high: GI088_RESPONSE_FIRST_V28_RUNTIME.high,
      concurrency: 1,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    budget: {
      authorized: 2,
      low: 1,
      high: 1,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    gate: {
      parentProductVerdict: "pass_or_minor",
      lowTargetMs: 15_000,
      lowHardMs: 45_000,
      lowMustPassBeforeHigh: true,
      fullRoundTargetMs: 45_000,
      fullRoundHardMs: 60_000,
      secondProductGateRequired: true
    },
    retiredScope: {
      originalV28RemainingFive: "retired_not_run",
      otherFourCasesAfterProbe: "not_run"
    },
    privacy: {
      level: "private_sensitive",
      publicBodies: false,
      privateMode: "0600"
    },
    inputHashes,
    stopPoint:
      "wait_for_parent_hash_bound_product_review_then_run_two_calls_then_wait_for_probe_product_review"
  } as const;
  return { ...core, planFingerprint: gi088ResponseFirstV281Sha(core) };
}

export function validateGi088ResponseFirstV281ParentProductReview(input: {
  review: Gi088ResponseFirstV281ParentProductReview;
  parent: ParentEvidence;
}) {
  const decision = input.review.decisions[0];
  assert(
    input.review.identity === input.parent.identity &&
      input.review.planFingerprint === input.parent.planFingerprint &&
      input.review.phase === "first_gate" &&
      input.review.reviewerRole === "product_owner" &&
      input.review.evidenceBinding.caseId === GI088_RESPONSE_FIRST_V281_PARENT_CASE_ID &&
      input.review.evidenceBinding.responseHash === input.parent.responseHash &&
      input.review.evidenceBinding.postStateHash === input.parent.postStateHash &&
      input.review.decisions.length === 1 &&
      decision?.caseId === GI088_RESPONSE_FIRST_V281_PARENT_CASE_ID &&
      (decision.verdict === "pass" ||
        decision.verdict === "minor" ||
        decision.verdict === "fail") &&
      typeof decision.note === "string" &&
      decision.note.trim().length > 0,
    "GI088_RESPONSE_FIRST_V281_PARENT_PRODUCT_REVIEW_INVALID"
  );
  return {
    verdict: decision.verdict,
    allowed: decision.verdict === "pass" || decision.verdict === "minor",
    reviewHash: gi088ResponseFirstV281Sha(input.review)
  };
}

async function readParentProductReview(cwd: string) {
  const file = path.join(
    cwd,
    GI088_RESPONSE_FIRST_V281_PATHS.parentProductReview
  );
  assert(
    await pathExists(file),
    "GI088_RESPONSE_FIRST_V281_PARENT_PRODUCT_REVIEW_MISSING_BEFORE_PROVIDER"
  );
  return JSON.parse(
    await readFile(file, "utf8")
  ) as Gi088ResponseFirstV281ParentProductReview;
}

function emptyLedger(plan: ProbePlan): PrivateLedger {
  return {
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    callsStarted: [],
    parentGate: null,
    effectiveTurnInput: null,
    effectiveTurnInputHash: null,
    replacedFixtureAssistantHash: null,
    actualAssistantHash: null,
    low: null,
    high: null,
    productDecision: null
  };
}

async function readLedger(cwd: string, plan: ProbePlan) {
  const file = path.join(cwd, GI088_RESPONSE_FIRST_V281_PATHS.privateLedger);
  if (!(await pathExists(file))) return emptyLedger(plan);
  const ledger = JSON.parse(await readFile(file, "utf8")) as PrivateLedger;
  assert(
    ledger.identity === plan.identity &&
      ledger.planFingerprint === plan.planFingerprint,
    "GI088_RESPONSE_FIRST_V281_LEDGER_IDENTITY_MISMATCH"
  );
  return ledger;
}

function publicStage(result: Gi088ResponseFirstV281LowResult | Gi088ResponseFirstV281HighResult | null) {
  if (!result) return null;
  const common = {
    stage: result.stage,
    status: result.status,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    requestFingerprint: result.requestFingerprint,
    responseHash: result.responseHash,
    responseLength: result.responseLength,
    validationIssues: result.validationIssues,
    errorCode: result.errorCode,
    latencyMs: result.latencyMs,
    finishReason: result.diagnostics?.finishReason ?? null,
    httpStatus: result.diagnostics?.httpStatus ?? null,
    responseModel: result.diagnostics?.responseModel ?? null,
    tokenUsage: result.diagnostics?.tokenUsage ?? null
  };
  return result.stage === "low"
    ? {
        ...common,
        target15sPassed: result.target15sPassed,
        hard45sPassed: result.hard45sPassed
      }
    : {
        ...common,
        frozenLowHash: result.frozenLowHash,
        continuationPostStateHash: result.continuationPostState
          ? gi088ResponseFirstV281Sha(result.continuationPostState)
          : null,
        fullRoundLatencyMs: result.fullRoundLatencyMs,
        fullRound45sTargetPassed: result.fullRound45sTargetPassed,
        fullRound60sHardPassed: result.fullRound60sHardPassed,
        reasoningPresent: result.diagnostics?.reasoningPresent ?? null,
        reasoningTokens: result.diagnostics?.reasoningTokens ?? null
      };
}

function receiptStatus(ledger: PrivateLedger) {
  if (ledger.productDecision) {
    return ledger.productDecision.gatePassed
      ? "v281_causal_probe_passed_by_product_owner"
      : "v281_causal_probe_failed_by_product_owner";
  }
  if (ledger.high) {
    if (ledger.high.status !== "valid" || !ledger.high.fullRound60sHardPassed) {
      return "v281_high_or_full_round_no_go";
    }
    if (!ledger.high.fullRound45sTargetPassed) {
      return "v281_full_round_speed_no_go_waiting_product_review";
    }
    return "v281_probe_complete_waiting_product_review";
  }
  if (ledger.low) {
    if (ledger.low.status !== "valid" || !ledger.low.hard45sPassed) {
      return "v281_low_technical_or_contract_no_go";
    }
    if (!ledger.low.target15sPassed) return "v281_low_speed_no_go";
  }
  if (ledger.parentGate && !["pass", "minor"].includes(ledger.parentGate.verdict)) {
    return "v281_parent_product_review_blocked";
  }
  if (ledger.callsStarted.length > (ledger.low ? 1 : 0) + (ledger.high ? 1 : 0)) {
    return "v281_started_call_requires_audit";
  }
  return ledger.parentGate
    ? "v281_parent_gate_passed_ready_to_run"
    : "v281_waiting_parent_product_hash_bound_review";
}

async function saveLedger(cwd: string, plan: ProbePlan, ledger: PrivateLedger) {
  await writeJsonAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V281_PATHS.privateLedger),
    ledger,
    true
  );
  await writeJsonAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V281_PATHS.publicReceipt),
    {
      schemaVersion: "1.0",
      identity: plan.identity,
      planFingerprint: plan.planFingerprint,
      status: receiptStatus(ledger),
      budget: {
        authorized: 2,
        consumed: ledger.callsStarted.length,
        completed: (ledger.low ? 1 : 0) + (ledger.high ? 1 : 0),
        notRun: 2 - ledger.callsStarted.length,
        retries: 0,
        recovery: 0,
        fallback: 0
      },
      parentGate: ledger.parentGate,
      causalInput: {
        effectiveTurnInputHash: ledger.effectiveTurnInputHash,
        replacedFixtureAssistantHash: ledger.replacedFixtureAssistantHash,
        actualAssistantHash: ledger.actualAssistantHash,
        parentResponseHash: plan.parentV28.responseHash,
        parentPostStateHash: plan.parentV28.postStateHash,
        actualAssistantAndReplayedPostStateUsed: ledger.effectiveTurnInput !== null,
        u4Preserved: ledger.effectiveTurnInput?.latestUserMessageId === "U4",
        historicalContinuationLowUsedByHigh: false
      },
      low: publicStage(ledger.low),
      high: publicStage(ledger.high),
      productDecision: ledger.productDecision,
      retiredScope: plan.retiredScope,
      releaseBoundary: {
        pageIntegration: "not_run",
        commit: "not_run",
        push: "not_run",
        deployment: "not_run",
        preview: "not_run",
        production: "event_centered_baseline"
      },
      privacy: {
        publicReceiptContainsBodies: false,
        privateLedgerAndReview: "git_ignored_mode_0600"
      }
    }
  );
  return ledger;
}

async function runLow(
  provider: AIProvider,
  turnInput: Board7bWorkingTaskV1TurnInput
): Promise<Gi088ResponseFirstV281LowResult> {
  const request = lowRequest(turnInput);
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let rawOutput = "";
  let diagnostics: AIProviderDiagnostics | null = null;
  try {
    assert(provider.stream, "GI088_RESPONSE_FIRST_V281_LOW_STREAM_UNAVAILABLE");
    for await (const chunk of provider.stream({
      ...request,
      onStreamDiagnostics: (value) => {
        diagnostics = value;
      }
    })) {
      rawOutput += chunk;
    }
    const safe = sanitizeAIProviderDiagnostics(diagnostics);
    const latencyMs = safe?.totalLatencyMs ?? Math.max(0, Date.now() - startedMs);
    try {
      const text = parseGi088ResponseFirstV22LowOutput(rawOutput);
      const issues = validateGi088ResponseFirstV22LowOutput(text);
      if (safe?.httpStatus !== 200) issues.push(`LOW_HTTP_STATUS_INVALID:${safe?.httpStatus ?? "missing"}`);
      if (safe?.finishReason !== "stop") issues.push(`LOW_FINISH_REASON_INVALID:${safe?.finishReason ?? "missing"}`);
      if (safe?.responseModel !== GI088_RESPONSE_FIRST_V22_RUNTIME.model) {
        issues.push(`LOW_RESPONSE_MODEL_INVALID:${safe?.responseModel ?? "missing"}`);
      }
      const status = issues.length === 0 ? "valid" as const : "contract_failure" as const;
      return {
        stage: "low",
        status,
        startedAt,
        completedAt: new Date().toISOString(),
        requestFingerprint: gi088ResponseFirstV281Sha(request),
        responseHash: gi088ResponseFirstV281Sha(rawOutput),
        responseLength: rawOutput.length,
        rawOutput,
        validationIssues: [...new Set(issues)],
        errorCode: status === "valid" ? null : "GI088_RESPONSE_FIRST_V281_LOW_CONTRACT_INVALID",
        latencyMs,
        target15sPassed: status === "valid" && latencyMs <= 15_000,
        hard45sPassed: status === "valid" && latencyMs <= 45_000,
        diagnostics: safe
      };
    } catch (error) {
      return {
        stage: "low",
        status: "contract_failure",
        startedAt,
        completedAt: new Date().toISOString(),
        requestFingerprint: gi088ResponseFirstV281Sha(request),
        responseHash: rawOutput ? gi088ResponseFirstV281Sha(rawOutput) : null,
        responseLength: rawOutput.length,
        rawOutput: rawOutput || null,
        validationIssues: [error instanceof Error ? error.message : "LOW_PARSE_FAILED"],
        errorCode: "GI088_RESPONSE_FIRST_V281_LOW_PARSE_FAILED",
        latencyMs,
        target15sPassed: false,
        hard45sPassed: false,
        diagnostics: safe
      };
    }
  } catch (error) {
    const safe = sanitizeAIProviderDiagnostics(
      diagnostics ?? getAIProviderDiagnostics(error)
    );
    return {
      stage: "low",
      status: "technical_failure",
      startedAt,
      completedAt: new Date().toISOString(),
      requestFingerprint: gi088ResponseFirstV281Sha(request),
      responseHash: rawOutput ? gi088ResponseFirstV281Sha(rawOutput) : null,
      responseLength: rawOutput.length,
      rawOutput: rawOutput || null,
      validationIssues: [],
      errorCode: getAIProviderFailureCode(error),
      latencyMs: safe?.totalLatencyMs ?? Math.max(0, Date.now() - startedMs),
      target15sPassed: false,
      hard45sPassed: false,
      diagnostics: safe
    };
  }
}

async function runHigh(input: {
  provider: AIProvider;
  turnInput: Board7bWorkingTaskV1TurnInput;
  low: Gi088ResponseFirstV281LowResult;
}): Promise<Gi088ResponseFirstV281HighResult> {
  assert(input.low.status === "valid" && input.low.rawOutput && input.low.responseHash, "GI088_RESPONSE_FIRST_V281_HIGH_REQUIRES_VALID_LOW");
  const request = highRequest({ turnInput: input.turnInput, lowText: input.low.rawOutput });
  assert(
    request.messages[1]?.content.includes(input.low.rawOutput),
    "GI088_RESPONSE_FIRST_V281_HIGH_MISSING_CURRENT_LOW"
  );
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  try {
    const completion = await input.provider.complete(request);
    const safe = sanitizeAIProviderDiagnostics(completion.diagnostics);
    const latencyMs = safe?.totalLatencyMs ?? completion.latencyMs ??
      Math.max(0, Date.now() - startedMs);
    const fullRoundLatencyMs = input.low.latencyMs + latencyMs;
    try {
      const parsedHigh = parseGi088ResponseFirstV28HighOutput(completion.content);
      const issues = validateGi088ResponseFirstV28HighOutput({
        turnInput: input.turnInput,
        frozenLow: input.low.rawOutput,
        high: parsedHigh
      });
      let continuationPostState: Board7bWorkingTaskV1SemanticState | null = null;
      try {
        continuationPostState = projectPostState({
          turnInput: input.turnInput,
          frozenLow: input.low.rawOutput,
          high: parsedHigh
        });
      } catch (error) {
        issues.push(`POST_STATE_PROJECTION_FAILED:${error instanceof Error ? error.message : "unknown"}`);
      }
      if (safe?.httpStatus !== 200) issues.push(`HIGH_HTTP_STATUS_INVALID:${safe?.httpStatus ?? "missing"}`);
      if (safe?.finishReason !== "stop") issues.push(`HIGH_FINISH_REASON_INVALID:${safe?.finishReason ?? "missing"}`);
      if (safe?.responseModel !== GI088_RESPONSE_FIRST_V28_RUNTIME.model) {
        issues.push(`HIGH_RESPONSE_MODEL_INVALID:${safe?.responseModel ?? "missing"}`);
      }
      if (safe?.reasoningPresent !== false) issues.push(`HIGH_REASONING_PRESENT_INVALID:${safe?.reasoningPresent ?? "missing"}`);
      if (safe?.reasoningTokens !== null && safe?.reasoningTokens !== 0) {
        issues.push(`HIGH_REASONING_TOKENS_INVALID:${safe?.reasoningTokens}`);
      }
      const status = issues.length === 0 ? "valid" as const : "contract_failure" as const;
      return {
        stage: "high",
        status,
        startedAt,
        completedAt: new Date().toISOString(),
        requestFingerprint: gi088ResponseFirstV281Sha(request),
        frozenLowHash: input.low.responseHash,
        responseHash: gi088ResponseFirstV281Sha(completion.content),
        responseLength: completion.content.length,
        rawOutput: completion.content,
        parsedHigh,
        continuationPostState,
        validationIssues: [...new Set(issues)],
        errorCode: status === "valid" ? null : "GI088_RESPONSE_FIRST_V281_HIGH_CONTRACT_INVALID",
        latencyMs,
        fullRoundLatencyMs,
        fullRound45sTargetPassed: status === "valid" && fullRoundLatencyMs <= 45_000,
        fullRound60sHardPassed: status === "valid" && fullRoundLatencyMs <= 60_000,
        diagnostics: safe
      };
    } catch (error) {
      return {
        stage: "high",
        status: "contract_failure",
        startedAt,
        completedAt: new Date().toISOString(),
        requestFingerprint: gi088ResponseFirstV281Sha(request),
        frozenLowHash: input.low.responseHash,
        responseHash: gi088ResponseFirstV281Sha(completion.content),
        responseLength: completion.content.length,
        rawOutput: completion.content,
        parsedHigh: null,
        continuationPostState: null,
        validationIssues: [error instanceof Error ? error.message : "HIGH_PARSE_FAILED"],
        errorCode: "GI088_RESPONSE_FIRST_V281_HIGH_PARSE_FAILED",
        latencyMs,
        fullRoundLatencyMs,
        fullRound45sTargetPassed: false,
        fullRound60sHardPassed: false,
        diagnostics: safe
      };
    }
  } catch (error) {
    const safe = sanitizeAIProviderDiagnostics(getAIProviderDiagnostics(error));
    const latencyMs = safe?.totalLatencyMs ?? Math.max(0, Date.now() - startedMs);
    return {
      stage: "high",
      status: "technical_failure",
      startedAt,
      completedAt: new Date().toISOString(),
      requestFingerprint: gi088ResponseFirstV281Sha(request),
      frozenLowHash: input.low.responseHash,
      responseHash: null,
      responseLength: 0,
      rawOutput: null,
      parsedHigh: null,
      continuationPostState: null,
      validationIssues: [],
      errorCode: getAIProviderFailureCode(error),
      latencyMs,
      fullRoundLatencyMs: input.low.latencyMs + latencyMs,
      fullRound45sTargetPassed: false,
      fullRound60sHardPassed: false,
      diagnostics: safe
    };
  }
}

async function writeReviewArtifacts(cwd: string, plan: ProbePlan, ledger: PrivateLedger) {
  assert(ledger.effectiveTurnInput && ledger.low && ledger.high, "GI088_RESPONSE_FIRST_V281_REVIEW_INCOMPLETE");
  const transcript = ledger.effectiveTurnInput.conversation.map((message) =>
    `<p><strong>${message.role === "user" ? "用户" : "AI"} ${escapeHtml(message.id)}</strong>：${escapeHtml(message.content)}</p>`
  ).join("\n");
  const delivery = ledger.high.parsedHigh && ledger.low.rawOutput
    ? projectGi088ResponseFirstV28VisibleAppend({
        frozenLow: ledger.low.rawOutput,
        high: ledger.high.parsedHigh
      })
    : null;
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GI-088 v2.8.1 因果连续探针</title><style>:root{font-family:ui-sans-serif,system-ui;background:#f4f1ea;color:#211f1b}body{margin:0}.wrap{max-width:960px;margin:auto;padding:36px 20px 110px}.card{background:#fffdf8;border:1px solid #d8d1c4;border-radius:20px;padding:22px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f1e8;padding:12px;border-radius:12px}section{border-top:1px solid #e7e0d4;padding-top:12px;margin-top:16px}</style></head><body><main class="wrap"><h1>v2.8.1 真实连续回合因果探针</h1><article class="card"><section><h2>1. 完整相关原文</h2>${transcript}</section><section><h2>2. 本次实际 Low</h2><p>${escapeHtml(ledger.low.rawOutput ?? "")}</p></section><section><h2>3. 本次实际 High</h2><pre>${escapeHtml(ledger.high.rawOutput ?? "")}</pre></section><section><h2>4. 最终同气泡追加</h2><p>${escapeHtml(delivery?.highUnderstanding?.text ?? "无追加理解")}</p><ol>${(delivery?.questions ?? []).map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ol></section><section><h2>5. 技术事实</h2><p>Low ${ledger.low.latencyMs}ms；High ${ledger.high.latencyMs}ms；完整回合 ${ledger.high.fullRoundLatencyMs}ms；Low=${ledger.low.status}；High=${ledger.high.status}；校验=${escapeHtml(ledger.high.validationIssues.join("；") || "通过")}</p></section><section><h2>6. 产品负责人裁决</h2><p>待裁决。请核对是否重复纠正、是否沿纠正后的状态自然推进，以及本次 Low 与 High 是否共同服务 U4。</p></section></article></main></body></html>`;
  const reviewFile = path.join(cwd, GI088_RESPONSE_FIRST_V281_PATHS.privateReviewHtml);
  await mkdir(path.dirname(reviewFile), { recursive: true, mode: 0o700 });
  await writeFile(reviewFile, html, { mode: 0o600 });
  await chmod(reviewFile, 0o600);
  const template: Gi088ResponseFirstV281ProductReview = {
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    reviewerRole: "product_owner",
    evidenceBinding: {
      parentResponseHash: plan.parentV28.responseHash,
      parentPostStateHash: plan.parentV28.postStateHash,
      effectiveTurnInputHash: ledger.effectiveTurnInputHash!,
      lowResponseHash: ledger.low.responseHash!,
      highResponseHash: ledger.high.responseHash!,
      continuationPostStateHash: ledger.high.continuationPostState
        ? gi088ResponseFirstV281Sha(ledger.high.continuationPostState)
        : "pending"
    },
    verdict: "fail",
    note: "请复制为 product-owner-review.json，并依据完整原文填写 pass、minor 或 fail。"
  };
  await writeJsonAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V281_PATHS.privateProductReviewTemplate),
    template,
    true
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function runGi088ResponseFirstV281Probe(input: {
  cwd?: string;
  workspaceRoot?: string;
  plan: ProbePlan;
  provider: AIProvider;
  parentProductReview?: Gi088ResponseFirstV281ParentProductReview;
}) {
  const cwd = input.cwd ?? process.cwd();
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const parent = await loadGi088ResponseFirstV281ParentEvidence(workspaceRoot);
  assert(
    parent.responseHash === input.plan.parentV28.responseHash &&
      parent.postStateHash === input.plan.parentV28.postStateHash &&
      parent.rawResultFingerprint === input.plan.parentV28.rawResultFingerprint,
    "GI088_RESPONSE_FIRST_V281_PARENT_EVIDENCE_DRIFT"
  );
  const review = input.parentProductReview ??
    await readParentProductReview(workspaceRoot);
  const parentGate = validateGi088ResponseFirstV281ParentProductReview({ review, parent });
  assert(parentGate.allowed, "GI088_RESPONSE_FIRST_V281_PARENT_PRODUCT_REVIEW_BLOCKED");
  const ledger = await readLedger(cwd, input.plan);
  assert(
    ledger.callsStarted.length === (ledger.low ? 1 : 0) + (ledger.high ? 1 : 0),
    "GI088_RESPONSE_FIRST_V281_STARTED_CALL_REQUIRES_AUDIT"
  );
  if (ledger.high) return saveLedger(cwd, input.plan, ledger);
  assert(
    ledger.callsStarted.length === 0 && ledger.low === null,
    "GI088_RESPONSE_FIRST_V281_PARTIAL_RUN_NO_RECOVERY"
  );
  const causal = buildGi088ResponseFirstV281CausalTurnInput(parent);
  const lowPrompt = lowRequest(causal.turnInput).messages[1]?.content ?? "";
  assert(
    !lowPrompt.includes(causal.replacedFixtureAssistant.content) &&
      lowPrompt.includes(causal.actualAssistant.content) &&
      causal.turnInput.latestUserMessageId === "U4",
    "GI088_RESPONSE_FIRST_V281_LOW_CAUSAL_PROMPT_INVALID"
  );
  ledger.parentGate = {
    verdict: parentGate.verdict,
    reviewHash: parentGate.reviewHash,
    responseHash: parent.responseHash,
    postStateHash: parent.postStateHash
  };
  ledger.effectiveTurnInput = causal.turnInput;
  ledger.effectiveTurnInputHash = gi088ResponseFirstV281Sha(causal.turnInput);
  ledger.replacedFixtureAssistantHash =
    gi088ResponseFirstV281Sha(causal.replacedFixtureAssistant);
  ledger.actualAssistantHash = gi088ResponseFirstV281Sha(causal.actualAssistant);
  if (!ledger.low) {
    ledger.callsStarted.push("low");
    await saveLedger(cwd, input.plan, ledger);
    ledger.low = await runLow(input.provider, causal.turnInput);
    await saveLedger(cwd, input.plan, ledger);
  }
  if (
    ledger.low.status !== "valid" ||
    !ledger.low.target15sPassed ||
    !ledger.low.hard45sPassed
  ) return saveLedger(cwd, input.plan, ledger);
  ledger.callsStarted.push("high");
  await saveLedger(cwd, input.plan, ledger);
  ledger.high = await runHigh({
    provider: input.provider,
    turnInput: causal.turnInput,
    low: ledger.low
  });
  await saveLedger(cwd, input.plan, ledger);
  if (ledger.high.rawOutput && ledger.high.responseHash) {
    await writeReviewArtifacts(cwd, input.plan, ledger);
  }
  return saveLedger(cwd, input.plan, ledger);
}

export function validateGi088ResponseFirstV281ProductReview(input: {
  review: Gi088ResponseFirstV281ProductReview;
  plan: ProbePlan;
  ledger: PrivateLedger;
}) {
  const high = input.ledger.high;
  const low = input.ledger.low;
  assert(
    high?.responseHash &&
      high.continuationPostState &&
      low?.responseHash &&
      input.ledger.effectiveTurnInputHash &&
      input.review.identity === input.plan.identity &&
      input.review.planFingerprint === input.plan.planFingerprint &&
      input.review.reviewerRole === "product_owner" &&
      input.review.evidenceBinding.parentResponseHash === input.plan.parentV28.responseHash &&
      input.review.evidenceBinding.parentPostStateHash === input.plan.parentV28.postStateHash &&
      input.review.evidenceBinding.effectiveTurnInputHash === input.ledger.effectiveTurnInputHash &&
      input.review.evidenceBinding.lowResponseHash === low.responseHash &&
      input.review.evidenceBinding.highResponseHash === high.responseHash &&
      input.review.evidenceBinding.continuationPostStateHash ===
        gi088ResponseFirstV281Sha(high.continuationPostState) &&
      (input.review.verdict === "pass" ||
        input.review.verdict === "minor" ||
        input.review.verdict === "fail") &&
      input.review.note.trim().length > 0,
    "GI088_RESPONSE_FIRST_V281_PRODUCT_REVIEW_INVALID"
  );
  const technicalGatePassed =
    low.status === "valid" &&
    low.target15sPassed &&
    high.status === "valid" &&
    high.fullRound45sTargetPassed &&
    high.fullRound60sHardPassed;
  return {
    verdict: input.review.verdict,
    noteHash: gi088ResponseFirstV281Sha(input.review.note),
    technicalGatePassed,
    gatePassed:
      technicalGatePassed &&
      (input.review.verdict === "pass" || input.review.verdict === "minor"),
    reviewHash: gi088ResponseFirstV281Sha(input.review)
  };
}

async function readFrozenPlan(cwd: string) {
  const plan = JSON.parse(
    await readFile(
      path.join(cwd, GI088_RESPONSE_FIRST_V281_PATHS.publicStartCard),
      "utf8"
    )
  ) as ProbePlan;
  const { planFingerprint, ...core } = plan;
  assert(
    plan.identity === GI088_RESPONSE_FIRST_V281_IDENTITY &&
      gi088ResponseFirstV281Sha(core) === planFingerprint,
    "GI088_RESPONSE_FIRST_V281_START_CARD_FINGERPRINT_INVALID"
  );
  assert(
    await fileSha(cwd, FILES.standard) === GI088_RESPONSE_FIRST_V281_STANDARD_SHA256,
    "STANDARD_SHA256_MISMATCH"
  );
  for (const [key, relativePath] of Object.entries(FILES)) {
    assert(
      await fileSha(cwd, relativePath) ===
        plan.inputHashes[`${key}Sha256` as keyof typeof plan.inputHashes],
      `GI088_RESPONSE_FIRST_V281_INPUT_DRIFT:${key}`
    );
  }
  return plan;
}

async function prepare(cwd: string) {
  const file = path.join(cwd, GI088_RESPONSE_FIRST_V281_PATHS.publicStartCard);
  if (await pathExists(file)) return readFrozenPlan(cwd);
  const plan = await createGi088ResponseFirstV281Plan(cwd);
  await writeJsonAtomic(file, plan);
  await saveLedger(cwd, plan, emptyLedger(plan));
  return plan;
}

async function finalizeProduct(cwd: string) {
  const plan = await readFrozenPlan(cwd);
  const ledger = await readLedger(cwd, plan);
  const review = JSON.parse(
    await readFile(
      path.join(cwd, GI088_RESPONSE_FIRST_V281_PATHS.privateProductReview),
      "utf8"
    )
  ) as Gi088ResponseFirstV281ProductReview;
  ledger.productDecision = validateGi088ResponseFirstV281ProductReview({
    review,
    plan,
    ledger
  });
  await saveLedger(cwd, plan, ledger);
  process.stdout.write(`${JSON.stringify(ledger.productDecision, null, 2)}\n`);
}

async function execute(cwd: string) {
  const plan = await prepare(cwd);
  const parent = await loadGi088ResponseFirstV281ParentEvidence(cwd);
  const parentReview = await readParentProductReview(cwd);
  const gate = validateGi088ResponseFirstV281ParentProductReview({
    review: parentReview,
    parent
  });
  assert(gate.allowed, "GI088_RESPONSE_FIRST_V281_PARENT_PRODUCT_REVIEW_BLOCKED");
  loadEnvConfig(cwd, true);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  assert(apiKey, "GI088_RESPONSE_FIRST_V281_DEEPSEEK_API_KEY_MISSING");
  const provider = new OpenAIProvider({
    apiKey,
    model: GI088_RESPONSE_FIRST_V28_RUNTIME.model,
    baseUrl: "https://api.deepseek.com",
    timeoutMs: GI088_RESPONSE_FIRST_V28_RUNTIME.high.hardTimeoutMs
  });
  const ledger = await runGi088ResponseFirstV281Probe({
    cwd,
    workspaceRoot: cwd,
    plan,
    provider,
    parentProductReview: parentReview
  });
  process.stdout.write(`${JSON.stringify({
    identity: plan.identity,
    status: receiptStatus(ledger),
    consumed: ledger.callsStarted.length,
    completed: (ledger.low ? 1 : 0) + (ledger.high ? 1 : 0),
    publicReceipt: GI088_RESPONSE_FIRST_V281_PATHS.publicReceipt,
    privateReview: ledger.high?.rawOutput
      ? GI088_RESPONSE_FIRST_V281_PATHS.privateReviewHtml
      : null
  }, null, 2)}\n`);
}

async function main() {
  const cwd = process.cwd();
  const command = process.env.GI088_RESPONSE_FIRST_V281_COMMAND ??
    process.argv[2] ?? "--prepare";
  if (command === "--execute") return execute(cwd);
  if (command === "--finalize-product") return finalizeProduct(cwd);
  const plan = await prepare(cwd);
  process.stdout.write(`${JSON.stringify({
    identity: plan.identity,
    status: plan.status,
    budget: plan.budget,
    parentResponseHash: plan.parentV28.responseHash,
    parentPostStateHash: plan.parentV28.postStateHash,
    publicStartCard: GI088_RESPONSE_FIRST_V281_PATHS.publicStartCard
  }, null, 2)}\n`);
}

export function shouldRunGi088ResponseFirstV281Cli(input: {
  argv?: string[];
  env?: Partial<NodeJS.ProcessEnv>;
} = {}) {
  const argv = input.argv ?? process.argv;
  const env = input.env ?? process.env;
  return env.VITEST !== "true" && Boolean(
    env.GI088_RESPONSE_FIRST_V281_COMMAND ||
      argv.some((item) => path.resolve(item) === path.resolve(RUNNER_FILE))
  );
}

if (shouldRunGi088ResponseFirstV281Cli()) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
