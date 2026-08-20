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
  GI088_RESPONSE_FIRST_V29_RUNTIME,
  createGi088ResponseFirstV29HighUserPrompt,
  createGi088ResponseFirstV29Identity,
  getGi088ResponseFirstV29HighSystemPrompt,
  observeGi088ResponseFirstV29HighOutput,
  parseGi088ResponseFirstV29HighOutput,
  projectGi088ResponseFirstV29CompatibilityHigh,
  projectGi088ResponseFirstV29VisibleAppend,
  validateGi088ResponseFirstV29HighOutput,
  type Gi088ResponseFirstV29ProjectedHighOutput,
  type Gi088ResponseFirstV29RawHighOutput
} from "../evals/event-centered-generative/gi088-response-first-v2-9-separated-open-gap-high/candidate";
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
  GI088_RESPONSE_FIRST_V29_CORRECTION_CASE_ID,
  GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_IDENTITY,
  GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS,
  projectGi088ResponseFirstV29CorrectionPostState
} from "./run-gi088-response-first-v2-9-correction-gate";
import {
  GI088_RESPONSE_FIRST_V22_RUBRIC_V13_DATASET_VERSION,
  GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT,
  loadGi088ResponseFirstV22RubricV13Cases
} from "./gi088-response-first-v2-2-rubric-v1-3-fixtures";

export const GI088_RESPONSE_FIRST_V29_CONTINUATION_IDENTITY =
  "2026-08-19.gi088-response-first-v2-9-causal-continuation-gate-v1" as const;
export const GI088_RESPONSE_FIRST_V29_CONTINUATION_CASE_ID =
  "RPR-REAL-19-CONTINUE" as const;
export const GI088_RESPONSE_FIRST_V29_CONTINUATION_STANDARD_SHA256 =
  "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60" as const;

const PRIVATE_ROOT =
  `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-9/causal-continuation-gate-v1`;

export const GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS = {
  publicStartCard:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-9-causal-continuation-gate-v1-start-card.json`,
  publicReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-9-causal-continuation-gate-v1-receipt.json`,
  privateLedger: `${PRIVATE_ROOT}/ledger.json`,
  privateReviewHtml: `${PRIVATE_ROOT}/review.html`,
  privateProductReviewTemplate: `${PRIVATE_ROOT}/product-owner-review.template.json`,
  privateProductReview: `${PRIVATE_ROOT}/product-owner-review.json`,
  parentStartCard: GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.publicStartCard,
  parentReceipt: GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.publicReceipt,
  parentPrivateLedger: GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.privateLedger,
  parentProductReview: GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.privateProductReview
} as const;

const RUNNER_FILE =
  "scripts/run-gi088-response-first-v2-9-causal-continuation-gate.ts";
const FILES = {
  standard: "docs/ai-evaluation-standard.md",
  executionPlan:
    "docs/plans/2026-08-19-gi088-response-first-v2-9-causal-continuation-gate.md",
  methodPlan:
    "docs/plans/2026-08-19-gi088-response-first-v2-9-separated-open-gap-high.md",
  lowCandidate:
    "evals/event-centered-generative/gi088-response-first-v2-2/candidate.ts",
  highCandidate:
    "evals/event-centered-generative/gi088-response-first-v2-9-separated-open-gap-high/candidate.ts",
  baseProjection:
    "evals/event-centered-generative/gi088-response-first-v2/candidate.ts",
  semanticStateMerge: "src/server/services/evaluation/gi088/semantic-delta.ts",
  fixtures: "scripts/gi088-response-first-v2-2-rubric-v1-3-fixtures.ts",
  correctionRunner: "scripts/run-gi088-response-first-v2-9-correction-gate.ts",
  provider: "src/server/services/ai/openai.provider.ts",
  providerContract: "src/server/services/ai/ai-provider.ts",
  runner: RUNNER_FILE
} as const;

type Verdict = "pass" | "minor" | "fail";
type Stage = "low" | "high";
type SafeDiagnostics = ReturnType<typeof sanitizeAIProviderDiagnostics>;

export type Gi088ResponseFirstV29ContinuationLowResult = {
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

export type Gi088ResponseFirstV29ContinuationHighResult = {
  stage: "high";
  status: "valid" | "contract_failure" | "technical_failure";
  startedAt: string;
  completedAt: string;
  requestFingerprint: string;
  frozenLowHash: string;
  responseHash: string | null;
  responseLength: number;
  rawOutput: string | null;
  parsedRaw: Gi088ResponseFirstV29RawHighOutput | null;
  projectedHigh: Gi088ResponseFirstV29ProjectedHighOutput | null;
  visibleDelivery: ReturnType<typeof projectGi088ResponseFirstV29VisibleAppend> | null;
  continuationPostState: Board7bWorkingTaskV1SemanticState | null;
  observation: ReturnType<typeof observeGi088ResponseFirstV29HighOutput> | null;
  validationIssues: string[];
  errorCode: string | null;
  latencyMs: number;
  fullRoundLatencyMs: number;
  fullRound45sTargetPassed: boolean;
  fullRound60sHardPassed: boolean;
  diagnostics: SafeDiagnostics;
};

export type Gi088ResponseFirstV29ContinuationProductReview = {
  identity: typeof GI088_RESPONSE_FIRST_V29_CONTINUATION_IDENTITY;
  planFingerprint: string;
  reviewerRole: "product_owner";
  evidenceBinding: {
    parentResponseHash: string;
    parentPostStateHash: string;
    effectiveTurnInputHash: string;
    lowResponseHash: string;
    highResponseHash: string;
    projectedHighHash: string;
    visibleDeliveryHash: string;
    continuationPostStateHash: string;
  };
  verdict: Verdict;
  note: string;
};

type ParentEvidence = {
  identity: typeof GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_IDENTITY;
  planFingerprint: string;
  candidateFingerprint: string;
  startCardSha256: string;
  receiptSha256: string;
  privateLedgerSha256: string;
  productReviewSha256: string;
  productReviewHash: string;
  productVerdict: "pass" | "minor";
  responseHash: string;
  postStateHash: string;
  visibleDeliveryHash: string;
  rawResultFingerprint: string;
  correctionInput: Board7bWorkingTaskV1TurnInput;
  continuationFixtureInput: Board7bWorkingTaskV1TurnInput;
  rawHigh: Gi088ResponseFirstV29RawHighOutput;
  projectedHigh: Gi088ResponseFirstV29ProjectedHighOutput;
  postState: Board7bWorkingTaskV1SemanticState;
  actualVisibleBubble: string;
};

type ContinuationPlan = Awaited<
  ReturnType<typeof createGi088ResponseFirstV29ContinuationPlan>
>;

export type Gi088ResponseFirstV29ContinuationPrivateLedger = {
  identity: typeof GI088_RESPONSE_FIRST_V29_CONTINUATION_IDENTITY;
  planFingerprint: string;
  callsStarted: Stage[];
  parentGate: {
    verdict: "pass" | "minor";
    reviewHash: string;
    responseHash: string;
    postStateHash: string;
  } | null;
  effectiveTurnInput: Board7bWorkingTaskV1TurnInput | null;
  effectiveTurnInputHash: string | null;
  replacedFixtureAssistantHash: string | null;
  actualAssistantHash: string | null;
  low: Gi088ResponseFirstV29ContinuationLowResult | null;
  high: Gi088ResponseFirstV29ContinuationHighResult | null;
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

function sameStrings(left: readonly string[], right: readonly string[]) {
  return left.length === right.length &&
    left.every((item, index) => item === right[index]);
}

export function gi088ResponseFirstV29ContinuationSha(value: unknown) {
  return createHash("sha256")
    .update(
      typeof value === "string" || Buffer.isBuffer(value)
        ? value
        : JSON.stringify(canonicalize(value))
    )
    .digest("hex");
}

async function fileSha(cwd: string, relativePath: string) {
  return gi088ResponseFirstV29ContinuationSha(
    await readFile(path.join(cwd, relativePath))
  );
}

async function pathExists(file: string) {
  return stat(file).then(() => true).catch(() => false);
}

async function writeAtomic(file: string, content: string, privateFile = false) {
  await mkdir(path.dirname(file), {
    recursive: true,
    mode: privateFile ? 0o700 : 0o755
  });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, content, { mode: privateFile ? 0o600 : 0o644 });
  await rename(temporary, file);
  if (privateFile) await chmod(file, 0o600);
}

async function writeJsonAtomic(file: string, value: unknown, privateFile = false) {
  await writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`, privateFile);
}

function renderVisibleBubble(
  delivery: ReturnType<typeof projectGi088ResponseFirstV29VisibleAppend>
) {
  return [
    delivery.lowText,
    delivery.highUnderstanding?.text ?? null,
    ...delivery.questions
  ].filter((item): item is string => Boolean(item)).join("\n\n");
}

export async function loadGi088ResponseFirstV29ContinuationParentEvidence(
  cwd = process.cwd()
): Promise<ParentEvidence> {
  const [startSource, receiptSource, ledgerSource, reviewSource, dataset] =
    await Promise.all([
      readFile(path.join(cwd, GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS.parentStartCard), "utf8"),
      readFile(path.join(cwd, GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS.parentReceipt), "utf8"),
      readFile(path.join(cwd, GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS.parentPrivateLedger), "utf8"),
      readFile(path.join(cwd, GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS.parentProductReview), "utf8"),
      loadGi088ResponseFirstV22RubricV13Cases(cwd)
    ]);
  const start = JSON.parse(startSource) as Record<string, unknown> & {
    identity: string;
    planFingerprint: string;
    candidateIdentity: { candidateFingerprint: string };
  };
  const { planFingerprint, ...startCore } = start;
  const receipt = JSON.parse(receiptSource) as {
    identity: string;
    planFingerprint: string;
    candidateFingerprint: string;
    status: string;
    budget: { consumed: number; completed: number };
    result: {
      caseId: string;
      status: string;
      responseHash: string | null;
      frozenLowHash: string;
      postStateHash: string | null;
      validationIssueCount: number;
    } | null;
    productDecision: {
      verdict: Verdict;
      noteHash: string;
      reviewHash: string;
    } | null;
  };
  const ledger = JSON.parse(ledgerSource) as {
    identity: string;
    planFingerprint: string;
    callStarted: boolean;
    turnInput: Board7bWorkingTaskV1TurnInput | null;
    frozenLow: { rawOutput: string; responseHash: string } | null;
    result: {
      caseId: string;
      status: string;
      responseHash: string | null;
      rawOutput: string | null;
      projectedHigh: Gi088ResponseFirstV29ProjectedHighOutput | null;
      postState: Board7bWorkingTaskV1SemanticState | null;
      visibleDelivery: ReturnType<typeof projectGi088ResponseFirstV29VisibleAppend> | null;
      validationIssues: string[];
    } | null;
    productDecision: {
      verdict: Verdict;
      noteHash: string;
      reviewHash: string;
    } | null;
  };
  const review = JSON.parse(reviewSource) as {
    identity: string;
    planFingerprint: string;
    reviewerRole: string;
    evidenceBinding: {
      caseId: string;
      turnInputHash: string;
      frozenLowHash: string;
      responseHash: string;
      projectedHighHash: string;
      visibleDeliveryHash: string;
      postStateHash: string;
    };
    verdict: Verdict;
    note: string;
  };
  const candidate = createGi088ResponseFirstV29Identity();
  const result = ledger.result;
  assert(
    start.identity === GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_IDENTITY &&
      gi088ResponseFirstV29ContinuationSha(startCore) === planFingerprint &&
      start.candidateIdentity.candidateFingerprint === candidate.candidateFingerprint &&
      receipt.identity === start.identity &&
      ledger.identity === start.identity &&
      review.identity === start.identity &&
      receipt.planFingerprint === planFingerprint &&
      ledger.planFingerprint === planFingerprint &&
      review.planFingerprint === planFingerprint &&
      receipt.candidateFingerprint === candidate.candidateFingerprint &&
      receipt.status === "v29_correction_gate_product_pass_or_minor" &&
      receipt.budget.consumed === 1 &&
      receipt.budget.completed === 1 &&
      ledger.callStarted === true &&
      result?.caseId === GI088_RESPONSE_FIRST_V29_CORRECTION_CASE_ID &&
      result.status === "valid" &&
      result.validationIssues.length === 0 &&
      typeof result.rawOutput === "string" &&
      typeof result.responseHash === "string" &&
      result.projectedHigh !== null &&
      result.postState !== null &&
      result.visibleDelivery !== null &&
      ledger.turnInput !== null &&
      ledger.frozenLow !== null &&
      gi088ResponseFirstV29ContinuationSha(result.rawOutput) === result.responseHash &&
      receipt.result?.caseId === result.caseId &&
      receipt.result.status === result.status &&
      receipt.result.responseHash === result.responseHash &&
      receipt.result.frozenLowHash === ledger.frozenLow.responseHash &&
      receipt.result.validationIssueCount === 0 &&
      review.reviewerRole === "product_owner" &&
      review.evidenceBinding.caseId === result.caseId &&
      review.evidenceBinding.turnInputHash ===
        gi088ResponseFirstV29ContinuationSha(ledger.turnInput) &&
      review.evidenceBinding.frozenLowHash === ledger.frozenLow.responseHash &&
      review.evidenceBinding.responseHash === result.responseHash &&
      (review.verdict === "pass" || review.verdict === "minor") &&
      review.note.trim().length > 0 &&
      ledger.productDecision?.verdict === review.verdict &&
      receipt.productDecision?.verdict === review.verdict &&
      ledger.productDecision.reviewHash ===
        gi088ResponseFirstV29ContinuationSha(review) &&
      receipt.productDecision.reviewHash === ledger.productDecision.reviewHash &&
      ledger.productDecision.noteHash ===
        gi088ResponseFirstV29ContinuationSha(review.note),
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_PARENT_EVIDENCE_INVALID"
  );
  const rawHigh = parseGi088ResponseFirstV29HighOutput(result.rawOutput);
  const projectedHigh = projectGi088ResponseFirstV29CompatibilityHigh({
    turnInput: ledger.turnInput,
    raw: rawHigh
  });
  const issues = validateGi088ResponseFirstV29HighOutput({
    turnInput: ledger.turnInput,
    frozenLow: ledger.frozenLow.rawOutput,
    raw: rawHigh,
    projected: projectedHigh
  });
  assert(
    issues.length === 0 &&
      gi088ResponseFirstV29ContinuationSha(projectedHigh) ===
        review.evidenceBinding.projectedHighHash &&
      gi088ResponseFirstV29ContinuationSha(result.projectedHigh) ===
        review.evidenceBinding.projectedHighHash,
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_PARENT_RAW_REPLAY_INVALID"
  );
  const postState = projectGi088ResponseFirstV29CorrectionPostState({
    turnInput: ledger.turnInput,
    frozenLow: ledger.frozenLow.rawOutput,
    projectedHigh
  });
  const visibleDelivery = projectGi088ResponseFirstV29VisibleAppend({
    frozenLow: ledger.frozenLow.rawOutput,
    high: projectedHigh
  });
  const postStateHash = gi088ResponseFirstV29ContinuationSha(postState);
  const visibleDeliveryHash = gi088ResponseFirstV29ContinuationSha(visibleDelivery);
  assert(
    postStateHash === review.evidenceBinding.postStateHash &&
      postStateHash === receipt.result.postStateHash &&
      postStateHash === gi088ResponseFirstV29ContinuationSha(result.postState) &&
      visibleDeliveryHash === review.evidenceBinding.visibleDeliveryHash &&
      visibleDeliveryHash ===
        gi088ResponseFirstV29ContinuationSha(result.visibleDelivery) &&
      postState.workingTask === null,
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_PARENT_PROJECTION_REPLAY_INVALID"
  );
  const correction = dataset.cases.find(
    (item) => item.caseId === GI088_RESPONSE_FIRST_V29_CORRECTION_CASE_ID
  );
  const continuation = dataset.cases.find(
    (item) => item.caseId === GI088_RESPONSE_FIRST_V29_CONTINUATION_CASE_ID
  );
  assert(
    correction && continuation &&
      gi088ResponseFirstV29ContinuationSha(correction.turnInput) ===
        gi088ResponseFirstV29ContinuationSha(ledger.turnInput),
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_PARENT_DATASET_INVALID"
  );
  return {
    identity: GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_IDENTITY,
    planFingerprint,
    candidateFingerprint: candidate.candidateFingerprint,
    startCardSha256: gi088ResponseFirstV29ContinuationSha(startSource),
    receiptSha256: gi088ResponseFirstV29ContinuationSha(receiptSource),
    privateLedgerSha256: gi088ResponseFirstV29ContinuationSha(ledgerSource),
    productReviewSha256: gi088ResponseFirstV29ContinuationSha(reviewSource),
    productReviewHash: ledger.productDecision.reviewHash,
    productVerdict: review.verdict,
    responseHash: result.responseHash,
    postStateHash,
    visibleDeliveryHash,
    rawResultFingerprint: gi088ResponseFirstV29ContinuationSha({
      responseHash: result.responseHash,
      postStateHash,
      visibleDeliveryHash,
      productReviewHash: ledger.productDecision.reviewHash
    }),
    correctionInput: correction.turnInput,
    continuationFixtureInput: continuation.turnInput,
    rawHigh,
    projectedHigh,
    postState,
    actualVisibleBubble: renderVisibleBubble(visibleDelivery)
  };
}

export function buildGi088ResponseFirstV29ContinuationTurnInput(
  parent: ParentEvidence
) {
  const fixtureAssistant = parent.continuationFixtureInput.conversation.at(-2);
  const continuationUser = parent.continuationFixtureInput.conversation.at(-1);
  assert(
    gi088ResponseFirstV29ContinuationSha(
      parent.continuationFixtureInput.conversation.slice(0, -2)
    ) === gi088ResponseFirstV29ContinuationSha(parent.correctionInput.conversation) &&
      fixtureAssistant?.role === "assistant" &&
      continuationUser?.role === "user" &&
      continuationUser.id === parent.continuationFixtureInput.latestUserMessageId,
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_FIXTURE_SHAPE_INVALID"
  );
  const turnInput: Board7bWorkingTaskV1TurnInput = {
    mode: parent.continuationFixtureInput.mode,
    conversation: [
      ...structuredClone(parent.correctionInput.conversation),
      { ...fixtureAssistant, content: parent.actualVisibleBubble },
      structuredClone(continuationUser)
    ],
    latestUserMessageId: continuationUser.id,
    semanticState: structuredClone(parent.postState)
  };
  assert(
    fixtureAssistant.content !== parent.actualVisibleBubble &&
      turnInput.latestUserMessageId === "U4" &&
      gi088ResponseFirstV29ContinuationSha(turnInput.semanticState) ===
        parent.postStateHash &&
      parent.postState.workingTask === null &&
      gi088ResponseFirstV29ContinuationSha(turnInput.semanticState) !==
        gi088ResponseFirstV29ContinuationSha(
          parent.continuationFixtureInput.semanticState
        ),
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_CAUSAL_INPUT_INVALID"
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
  const runtime = GI088_RESPONSE_FIRST_V29_RUNTIME.high;
  return {
    messages: [
      { role: "system", content: getGi088ResponseFirstV29HighSystemPrompt() },
      {
        role: "user",
        content: createGi088ResponseFirstV29HighUserPrompt({
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

export async function createGi088ResponseFirstV29ContinuationPlan(
  cwd = process.cwd()
) {
  assert(
    await fileSha(cwd, FILES.standard) ===
      GI088_RESPONSE_FIRST_V29_CONTINUATION_STANDARD_SHA256,
    "STANDARD_SHA256_MISMATCH"
  );
  const [parent, inputHashes, dataset] = await Promise.all([
    loadGi088ResponseFirstV29ContinuationParentEvidence(cwd),
    Object.fromEntries(
      await Promise.all(
        Object.entries(FILES).map(async ([key, relativePath]) => [
          `${key}Sha256`,
          await fileSha(cwd, relativePath)
        ])
      )
    ) as Promise<Record<string, string>>,
    loadGi088ResponseFirstV22RubricV13Cases(cwd)
  ]);
  const continuation = dataset.cases.find(
    (item) => item.caseId === GI088_RESPONSE_FIRST_V29_CONTINUATION_CASE_ID
  );
  assert(
    continuation &&
      dataset.datasetVersion ===
        GI088_RESPONSE_FIRST_V22_RUBRIC_V13_DATASET_VERSION,
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_DATASET_INVALID"
  );
  const causal = buildGi088ResponseFirstV29ContinuationTurnInput(parent);
  const lowIdentity = createGi088ResponseFirstV22Identity();
  const highIdentity = createGi088ResponseFirstV29Identity();
  const core = {
    schemaVersion: "1.0",
    identity: GI088_RESPONSE_FIRST_V29_CONTINUATION_IDENTITY,
    status: "ready_to_run_causal_low_then_high",
    productDecision:
      "whether_v29_uses_the_saved_correction_to_advance_without_reasking_an_answered_example",
    changedFactor:
      "run_the_same_v29_high_after_a_real_v22_low_on_the_actual_parent_visible_bubble_and_reprojected_parent_state",
    candidates: {
      lowVersion: lowIdentity.version,
      lowCandidateFingerprint: lowIdentity.candidateFingerprint,
      highVersion: highIdentity.version,
      highCandidateFingerprint: highIdentity.candidateFingerprint
    },
    dataset: {
      version: dataset.datasetVersion,
      fingerprint: dataset.datasetFingerprint,
      caseId: continuation.caseId,
      sourceFingerprint: continuation.sourceFingerprint,
      fixtureTurnInputHash:
        gi088ResponseFirstV29ContinuationSha(continuation.turnInput)
    },
    parentCorrectionGate: {
      identity: parent.identity,
      planFingerprint: parent.planFingerprint,
      candidateFingerprint: parent.candidateFingerprint,
      startCardSha256: parent.startCardSha256,
      receiptSha256: parent.receiptSha256,
      privateLedgerSha256: parent.privateLedgerSha256,
      productReviewSha256: parent.productReviewSha256,
      productReviewHash: parent.productReviewHash,
      productVerdict: parent.productVerdict,
      responseHash: parent.responseHash,
      postStateHash: parent.postStateHash,
      visibleDeliveryHash: parent.visibleDeliveryHash,
      rawResultFingerprint: parent.rawResultFingerprint,
      rawOutputReparsedAndValidated: true,
      postStateReprojected: true,
      visibleDeliveryReprojected: true
    },
    causalInput: {
      effectiveTurnInputHash:
        gi088ResponseFirstV29ContinuationSha(causal.turnInput),
      actualAssistantHash:
        gi088ResponseFirstV29ContinuationSha(causal.actualAssistant),
      replacedFixtureAssistantHash:
        gi088ResponseFirstV29ContinuationSha(causal.replacedFixtureAssistant),
      parentPostStateHash: parent.postStateHash,
      actualSemanticStateHash:
        gi088ResponseFirstV29ContinuationSha(causal.turnInput.semanticState),
      historicalFixtureSemanticStateHash:
        gi088ResponseFirstV29ContinuationSha(
          parent.continuationFixtureInput.semanticState
        ),
      actualStateDiffersFromHistoricalFixture: true,
      latestUserMessageId: causal.turnInput.latestUserMessageId,
      fixtureAssistantBodyExcluded: true,
      fixtureSemanticStateExcluded: true,
      lowSource: "new_v22_model_call_from_effective_causal_input"
    },
    runtime: {
      provider: GI088_RESPONSE_FIRST_V29_RUNTIME.provider,
      model: GI088_RESPONSE_FIRST_V29_RUNTIME.model,
      low: GI088_RESPONSE_FIRST_V22_RUNTIME.low,
      high: GI088_RESPONSE_FIRST_V29_RUNTIME.high,
      concurrency: 1,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    budget: {
      authorized: 2,
      low: 1,
      high: 1,
      remainingFamilyBudgetNotRun: 4,
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
      providerHttp200: true,
      finishReasonStop: true,
      lowThinking: "enabled",
      highThinking: "disabled",
      lowTokenLimit: 1_280,
      highTokenLimit: 4_000,
      productReviewRequiredAfterRun: true
    },
    privacy: {
      level: "private_sensitive",
      publicBodies: false,
      privateMode: "0600"
    },
    releaseBoundary: {
      pageIntegration: "not_run",
      preview: "not_run",
      commit: "not_run",
      push: "not_run",
      deployment: "not_run",
      production: "event_centered_baseline"
    },
    inputHashes,
    stopPoint: "after_two_calls_wait_hash_bound_product_review"
  } as const;
  return {
    ...core,
    planFingerprint: gi088ResponseFirstV29ContinuationSha(core)
  };
}

function emptyLedger(
  plan: ContinuationPlan
): Gi088ResponseFirstV29ContinuationPrivateLedger {
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

async function readLedger(cwd: string, plan: ContinuationPlan) {
  const file = path.join(
    cwd,
    GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS.privateLedger
  );
  if (!(await pathExists(file))) return emptyLedger(plan);
  const ledger = JSON.parse(
    await readFile(file, "utf8")
  ) as Gi088ResponseFirstV29ContinuationPrivateLedger;
  assert(
    ledger.identity === plan.identity &&
      ledger.planFingerprint === plan.planFingerprint,
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_LEDGER_IDENTITY_MISMATCH"
  );
  return ledger;
}

function issueSummary(issues: readonly string[]) {
  const codes = [...new Set(issues.map((issue) =>
    issue.match(/^[A-Z0-9_]+/u)?.[0] ?? "OUTPUT_CONTRACT_INVALID"
  ))];
  return {
    validationIssueCount: issues.length,
    validationIssueCodes: codes,
    validationIssuesHash: gi088ResponseFirstV29ContinuationSha(issues)
  };
}

function publicStage(
  result:
    | Gi088ResponseFirstV29ContinuationLowResult
    | Gi088ResponseFirstV29ContinuationHighResult
    | null
) {
  if (!result) return null;
  const common = {
    stage: result.stage,
    status: result.status,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    requestFingerprint: result.requestFingerprint,
    responseHash: result.responseHash,
    responseLength: result.responseLength,
    ...issueSummary(result.validationIssues),
    errorCode: result.errorCode,
    latencyMs: result.latencyMs,
    finishReason: result.diagnostics?.finishReason ?? null,
    httpStatus: result.diagnostics?.httpStatus ?? null,
    responseModel: result.diagnostics?.responseModel ?? null,
    reasoningPresent: result.diagnostics?.reasoningPresent ?? null,
    reasoningTokens: result.diagnostics?.reasoningTokens ?? null,
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
        visibleDeliveryHash: result.visibleDelivery
          ? gi088ResponseFirstV29ContinuationSha(result.visibleDelivery)
          : null,
        continuationPostStateHash: result.continuationPostState
          ? gi088ResponseFirstV29ContinuationSha(result.continuationPostState)
          : null,
        observation: result.observation,
        fullRoundLatencyMs: result.fullRoundLatencyMs,
        fullRound45sTargetPassed: result.fullRound45sTargetPassed,
        fullRound60sHardPassed: result.fullRound60sHardPassed
      };
}

function receiptStatus(
  ledger: Gi088ResponseFirstV29ContinuationPrivateLedger
) {
  if (ledger.productDecision) {
    return ledger.productDecision.gatePassed
      ? "v29_continuation_passed_by_product_owner"
      : "v29_continuation_failed_by_product_owner";
  }
  if (ledger.high) {
    if (ledger.high.status !== "valid" || !ledger.high.fullRound60sHardPassed) {
      return "v29_continuation_high_or_hard_time_no_go";
    }
    if (!ledger.high.fullRound45sTargetPassed) {
      return "v29_continuation_full_round_target_no_go_waiting_product_review";
    }
    return "v29_continuation_complete_waiting_product_review";
  }
  if (ledger.low) {
    if (ledger.low.status !== "valid" || !ledger.low.hard45sPassed) {
      return "v29_continuation_low_contract_or_hard_time_no_go";
    }
    if (!ledger.low.target15sPassed) {
      return "v29_continuation_low_target_no_go";
    }
  }
  if (ledger.callsStarted.length > (ledger.low ? 1 : 0) + (ledger.high ? 1 : 0)) {
    return "v29_continuation_started_call_requires_audit";
  }
  return ledger.parentGate
    ? "v29_continuation_parent_pass_ready"
    : "v29_continuation_ready";
}

async function saveLedger(
  cwd: string,
  plan: ContinuationPlan,
  ledger: Gi088ResponseFirstV29ContinuationPrivateLedger
) {
  await writeJsonAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS.privateLedger),
    ledger,
    true
  );
  await writeJsonAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS.publicReceipt),
    {
      schemaVersion: "1.0",
      identity: plan.identity,
      planFingerprint: plan.planFingerprint,
      candidateVersion: plan.candidates.highVersion,
      candidateFingerprint: plan.candidates.highCandidateFingerprint,
      status: receiptStatus(ledger),
      budget: {
        authorized: 2,
        consumed: ledger.callsStarted.length,
        completed: (ledger.low ? 1 : 0) + (ledger.high ? 1 : 0),
        notRun: 2 - ledger.callsStarted.length,
        remainingFamilyNotRun: 4,
        retries: 0,
        recovery: 0,
        fallback: 0
      },
      parentGate: ledger.parentGate,
      causalInput: {
        effectiveTurnInputHash: ledger.effectiveTurnInputHash,
        replacedFixtureAssistantHash: ledger.replacedFixtureAssistantHash,
        actualAssistantHash: ledger.actualAssistantHash,
        parentResponseHash: plan.parentCorrectionGate.responseHash,
        parentPostStateHash: plan.parentCorrectionGate.postStateHash,
        actualSemanticStateHash: plan.causalInput.actualSemanticStateHash,
        historicalFixtureSemanticStateHash:
          plan.causalInput.historicalFixtureSemanticStateHash,
        actualStateDiffersFromHistoricalFixture:
          plan.causalInput.actualStateDiffersFromHistoricalFixture,
        actualVisibleAndReprojectedStateUsed: ledger.effectiveTurnInput !== null,
        latestUserMessageId: ledger.effectiveTurnInput?.latestUserMessageId ?? null
      },
      low: publicStage(ledger.low),
      high: publicStage(ledger.high),
      productDecision: ledger.productDecision,
      releaseBoundary: plan.releaseBoundary,
      privacy: {
        publicReceiptContainsBodies: false,
        privateLedgerAndReview: "git_ignored_mode_0600"
      }
    }
  );
  return ledger;
}

function pushProviderIssues(input: {
  stage: Stage;
  diagnostics: SafeDiagnostics;
  maxTokens: number;
  expectedReasoning: boolean;
  issues: string[];
}) {
  const label = input.stage.toUpperCase();
  const diagnostics = input.diagnostics;
  if (diagnostics?.httpStatus !== 200) {
    input.issues.push(
      `${label}_HTTP_STATUS_INVALID:${diagnostics?.httpStatus ?? "missing"}`
    );
  }
  if (diagnostics?.finishReason !== "stop") {
    input.issues.push(
      `${label}_FINISH_REASON_INVALID:${diagnostics?.finishReason ?? "missing"}`
    );
  }
  if (diagnostics?.responseModel !== GI088_RESPONSE_FIRST_V29_RUNTIME.model) {
    input.issues.push(
      `${label}_RESPONSE_MODEL_INVALID:${diagnostics?.responseModel ?? "missing"}`
    );
  }
  if (diagnostics?.reasoningPresent !== input.expectedReasoning) {
    input.issues.push(
      `${label}_REASONING_PRESENT_INVALID:${diagnostics?.reasoningPresent ?? "missing"}`
    );
  }
  if (input.expectedReasoning) {
    if (
      typeof diagnostics?.reasoningTokens !== "number" ||
      diagnostics.reasoningTokens <= 0
    ) {
      input.issues.push(
        `${label}_REASONING_TOKENS_INVALID:${diagnostics?.reasoningTokens ?? "missing"}`
      );
    }
  } else if (
    diagnostics?.reasoningTokens !== null &&
    diagnostics?.reasoningTokens !== 0
  ) {
    input.issues.push(
      `${label}_REASONING_TOKENS_INVALID:${diagnostics?.reasoningTokens ?? "missing"}`
    );
  }
  const completionTokens = diagnostics?.tokenUsage?.completionTokens;
  if (typeof completionTokens !== "number") {
    input.issues.push(`${label}_TOKEN_USAGE_MISSING`);
  } else if (completionTokens > input.maxTokens) {
    input.issues.push(
      `${label}_TOKEN_LIMIT_EXCEEDED:${completionTokens}/${input.maxTokens}`
    );
  }
}

async function runLow(
  provider: AIProvider,
  turnInput: Board7bWorkingTaskV1TurnInput
): Promise<Gi088ResponseFirstV29ContinuationLowResult> {
  const request = lowRequest(turnInput);
  assert(
    request.maxTokens === 1_280 &&
      request.thinking === "enabled" &&
      request.reasoningEffort === "low" &&
      request.hardTimeoutMs === 45_000,
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_LOW_RUNTIME_DRIFT"
  );
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let rawOutput = "";
  let diagnostics: AIProviderDiagnostics | null = null;
  try {
    assert(
      provider.stream,
      "GI088_RESPONSE_FIRST_V29_CONTINUATION_LOW_STREAM_UNAVAILABLE"
    );
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
      pushProviderIssues({
        stage: "low",
        diagnostics: safe,
        maxTokens: 1_280,
        expectedReasoning: true,
        issues
      });
      if (latencyMs > 45_000) {
        issues.push(`LOW_HARD_TIMEOUT_EXCEEDED:${latencyMs}`);
      }
      const uniqueIssues = [...new Set(issues)];
      const status = uniqueIssues.length === 0
        ? "valid" as const
        : "contract_failure" as const;
      return {
        stage: "low",
        status,
        startedAt,
        completedAt: new Date().toISOString(),
        requestFingerprint: gi088ResponseFirstV29ContinuationSha(request),
        responseHash: gi088ResponseFirstV29ContinuationSha(rawOutput),
        responseLength: rawOutput.length,
        rawOutput,
        validationIssues: uniqueIssues,
        errorCode: status === "valid"
          ? null
          : safe?.finishReason === "length"
            ? "GI088_RESPONSE_FIRST_V29_CONTINUATION_LOW_TOKEN_LIMIT"
            : "GI088_RESPONSE_FIRST_V29_CONTINUATION_LOW_CONTRACT_INVALID",
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
        requestFingerprint: gi088ResponseFirstV29ContinuationSha(request),
        responseHash: rawOutput
          ? gi088ResponseFirstV29ContinuationSha(rawOutput)
          : null,
        responseLength: rawOutput.length,
        rawOutput: rawOutput || null,
        validationIssues: [
          error instanceof Error ? error.message : "LOW_PARSE_FAILED"
        ],
        errorCode: "GI088_RESPONSE_FIRST_V29_CONTINUATION_LOW_PARSE_FAILED",
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
      requestFingerprint: gi088ResponseFirstV29ContinuationSha(request),
      responseHash: rawOutput
        ? gi088ResponseFirstV29ContinuationSha(rawOutput)
        : null,
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
  low: Gi088ResponseFirstV29ContinuationLowResult;
}): Promise<Gi088ResponseFirstV29ContinuationHighResult> {
  assert(
    input.low.status === "valid" &&
      input.low.rawOutput &&
      input.low.responseHash,
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_HIGH_REQUIRES_VALID_LOW"
  );
  const request = highRequest({
    turnInput: input.turnInput,
    lowText: input.low.rawOutput
  });
  assert(
    request.maxTokens === 4_000 &&
      request.thinking === "disabled" &&
      !("reasoningEffort" in request) &&
      request.hardTimeoutMs === 60_000 &&
      request.messages[1]?.content.includes(input.low.rawOutput),
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_HIGH_RUNTIME_OR_LOW_BINDING_INVALID"
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
      const parsedRaw = parseGi088ResponseFirstV29HighOutput(completion.content);
      const projectedHigh = projectGi088ResponseFirstV29CompatibilityHigh({
        turnInput: input.turnInput,
        raw: parsedRaw
      });
      const issues = validateGi088ResponseFirstV29HighOutput({
        turnInput: input.turnInput,
        frozenLow: input.low.rawOutput,
        raw: parsedRaw,
        projected: projectedHigh
      });
      let continuationPostState: Board7bWorkingTaskV1SemanticState | null = null;
      try {
        continuationPostState = projectGi088ResponseFirstV29CorrectionPostState({
          turnInput: input.turnInput,
          frozenLow: input.low.rawOutput,
          projectedHigh
        });
      } catch (error) {
        issues.push(
          `POST_STATE_PROJECTION_FAILED:${error instanceof Error ? error.message : "unknown"}`
        );
      }
      const visibleDelivery = projectGi088ResponseFirstV29VisibleAppend({
        frozenLow: input.low.rawOutput,
        high: projectedHigh
      });
      const coverage = parsedRaw.turnDecision.coverageGate;
      const isOpenCoverage =
        coverage?.coverage === "partial" || coverage?.coverage === "open";
      if (input.turnInput.semanticState.workingTask !== null) {
        issues.push("CONTINUATION_PARENT_WORKING_TASK_MUST_BE_NULL");
      }
      if (!isOpenCoverage) {
        issues.push("CONTINUATION_COVERAGE_MUST_BE_PARTIAL_OR_OPEN");
      }
      if (parsedRaw.turnDecision.openTaskChange.kind !== "set_new") {
        issues.push("CONTINUATION_OPEN_TASK_CHANGE_MUST_SET_NEW");
      }
      if (!continuationPostState?.workingTask) {
        issues.push("CONTINUATION_POST_STATE_WORKING_TASK_REQUIRED");
      } else if (isOpenCoverage) {
        if (continuationPostState.workingTask.summary !== coverage.remainingGap) {
          issues.push("CONTINUATION_TASK_SUMMARY_MUST_EQUAL_REMAINING_GAP");
        }
        if (!sameStrings(
          continuationPostState.workingTask.evidenceRefs,
          coverage.evidenceRefs
        )) {
          issues.push("CONTINUATION_TASK_EVIDENCE_MUST_EQUAL_COVERAGE_EVIDENCE");
        }
      }
      if (visibleDelivery.lowText !== input.low.rawOutput) {
        issues.push("HIGH_VISIBLE_LOW_MUST_STAY_FROZEN");
      }
      pushProviderIssues({
        stage: "high",
        diagnostics: safe,
        maxTokens: 4_000,
        expectedReasoning: false,
        issues
      });
      if (fullRoundLatencyMs > 60_000) {
        issues.push(`FULL_ROUND_HARD_TIMEOUT_EXCEEDED:${fullRoundLatencyMs}`);
      }
      const uniqueIssues = [...new Set(issues)];
      const status = uniqueIssues.length === 0
        ? "valid" as const
        : "contract_failure" as const;
      return {
        stage: "high",
        status,
        startedAt,
        completedAt: new Date().toISOString(),
        requestFingerprint: gi088ResponseFirstV29ContinuationSha(request),
        frozenLowHash: input.low.responseHash,
        responseHash: gi088ResponseFirstV29ContinuationSha(completion.content),
        responseLength: completion.content.length,
        rawOutput: completion.content,
        parsedRaw,
        projectedHigh,
        visibleDelivery,
        continuationPostState,
        observation: observeGi088ResponseFirstV29HighOutput(parsedRaw),
        validationIssues: uniqueIssues,
        errorCode: status === "valid"
          ? null
          : safe?.finishReason === "length"
            ? "GI088_RESPONSE_FIRST_V29_CONTINUATION_HIGH_TOKEN_LIMIT"
            : "GI088_RESPONSE_FIRST_V29_CONTINUATION_HIGH_CONTRACT_INVALID",
        latencyMs,
        fullRoundLatencyMs,
        fullRound45sTargetPassed:
          status === "valid" && fullRoundLatencyMs <= 45_000,
        fullRound60sHardPassed:
          status === "valid" && fullRoundLatencyMs <= 60_000,
        diagnostics: safe
      };
    } catch (error) {
      return {
        stage: "high",
        status: "contract_failure",
        startedAt,
        completedAt: new Date().toISOString(),
        requestFingerprint: gi088ResponseFirstV29ContinuationSha(request),
        frozenLowHash: input.low.responseHash,
        responseHash: gi088ResponseFirstV29ContinuationSha(completion.content),
        responseLength: completion.content.length,
        rawOutput: completion.content,
        parsedRaw: null,
        projectedHigh: null,
        visibleDelivery: null,
        continuationPostState: null,
        observation: null,
        validationIssues: [
          error instanceof Error ? error.message : "HIGH_PARSE_FAILED"
        ],
        errorCode: safe?.finishReason === "length"
          ? "GI088_RESPONSE_FIRST_V29_CONTINUATION_HIGH_TOKEN_LIMIT"
          : "GI088_RESPONSE_FIRST_V29_CONTINUATION_HIGH_PARSE_FAILED",
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
    const fullRoundLatencyMs = input.low.latencyMs + latencyMs;
    return {
      stage: "high",
      status: "technical_failure",
      startedAt,
      completedAt: new Date().toISOString(),
      requestFingerprint: gi088ResponseFirstV29ContinuationSha(request),
      frozenLowHash: input.low.responseHash,
      responseHash: null,
      responseLength: 0,
      rawOutput: null,
      parsedRaw: null,
      projectedHigh: null,
      visibleDelivery: null,
      continuationPostState: null,
      observation: null,
      validationIssues: [],
      errorCode: getAIProviderFailureCode(error),
      latencyMs,
      fullRoundLatencyMs,
      fullRound45sTargetPassed: false,
      fullRound60sHardPassed: false,
      diagnostics: safe
    };
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function writeReviewArtifacts(
  cwd: string,
  plan: ContinuationPlan,
  ledger: Gi088ResponseFirstV29ContinuationPrivateLedger
) {
  const low = ledger.low;
  const high = ledger.high;
  assert(
    ledger.effectiveTurnInput &&
      ledger.effectiveTurnInputHash &&
      low?.rawOutput &&
      low.responseHash &&
      high?.rawOutput &&
      high.responseHash &&
      high.continuationPostState,
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_REVIEW_EVIDENCE_MISSING"
  );
  const postStateHash = gi088ResponseFirstV29ContinuationSha(
    high.continuationPostState
  );
  assert(
    high.projectedHigh && high.visibleDelivery,
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_REVIEW_PROJECTION_MISSING"
  );
  const projectedHighHash = gi088ResponseFirstV29ContinuationSha(
    high.projectedHigh
  );
  const visibleDeliveryHash = gi088ResponseFirstV29ContinuationSha(
    high.visibleDelivery
  );
  const transcript = ledger.effectiveTurnInput.conversation.map((message) =>
    `<h3>${escapeHtml(message.id)} · ${escapeHtml(message.role)}</h3><pre>${escapeHtml(message.content)}</pre>`
  ).join("");
  const html = `<!doctype html><meta charset="utf-8"><title>GI-088 v2.9 causal continuation gate</title><style>body{font:16px/1.6 system-ui;max-width:980px;margin:32px auto;padding:0 20px}pre{white-space:pre-wrap;background:#f5f5f5;padding:16px;border-radius:8px}</style><h1>GI-088 v2.9 纠正后继续</h1><h2>完整有效上下文</h2>${transcript}<h2>Low 实际输出</h2><pre>${escapeHtml(low.rawOutput)}</pre><h2>High 原始输出</h2><pre>${escapeHtml(high.rawOutput)}</pre><h2>High 兼容投影</h2><pre>${escapeHtml(JSON.stringify(high.projectedHigh, null, 2))}</pre><h2>用户最终可见结果</h2><pre>${escapeHtml(high.visibleDelivery ? renderVisibleBubble(high.visibleDelivery) : low.rawOutput)}</pre><h2>继续后的状态</h2><pre>${escapeHtml(JSON.stringify(high.continuationPostState, null, 2))}</pre><h2>技术指标</h2><pre>${escapeHtml(JSON.stringify({ low: publicStage(low), high: publicStage(high) }, null, 2))}</pre>`;
  await writeAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS.privateReviewHtml),
    html,
    true
  );
  await writeJsonAtomic(
    path.join(
      cwd,
      GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS.privateProductReviewTemplate
    ),
    {
      identity: plan.identity,
      planFingerprint: plan.planFingerprint,
      reviewerRole: "product_owner",
      evidenceBinding: {
        parentResponseHash: plan.parentCorrectionGate.responseHash,
        parentPostStateHash: plan.parentCorrectionGate.postStateHash,
        effectiveTurnInputHash: ledger.effectiveTurnInputHash,
        lowResponseHash: low.responseHash,
        highResponseHash: high.responseHash,
        projectedHighHash,
        visibleDeliveryHash,
        continuationPostStateHash: postStateHash
      },
      verdict: "fail",
      note: "复制为 product-owner-review.json，并基于完整原文填写 pass、minor 或 fail。"
    } satisfies Gi088ResponseFirstV29ContinuationProductReview,
    true
  );
}

function assertParentMatchesPlan(
  parent: ParentEvidence,
  plan: ContinuationPlan
) {
  assert(
    parent.planFingerprint === plan.parentCorrectionGate.planFingerprint &&
      parent.startCardSha256 === plan.parentCorrectionGate.startCardSha256 &&
      parent.receiptSha256 === plan.parentCorrectionGate.receiptSha256 &&
      parent.privateLedgerSha256 ===
        plan.parentCorrectionGate.privateLedgerSha256 &&
      parent.productReviewSha256 ===
        plan.parentCorrectionGate.productReviewSha256 &&
      parent.productReviewHash === plan.parentCorrectionGate.productReviewHash &&
      parent.responseHash === plan.parentCorrectionGate.responseHash &&
      parent.postStateHash === plan.parentCorrectionGate.postStateHash &&
      parent.rawResultFingerprint ===
        plan.parentCorrectionGate.rawResultFingerprint &&
      parent.postState.workingTask === null &&
      (parent.productVerdict === "pass" || parent.productVerdict === "minor"),
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_PARENT_EVIDENCE_DRIFT"
  );
}

export async function runGi088ResponseFirstV29ContinuationGate(input: {
  cwd?: string;
  workspaceRoot?: string;
  plan: ContinuationPlan;
  provider: AIProvider;
}) {
  const cwd = input.cwd ?? process.cwd();
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const parent = await loadGi088ResponseFirstV29ContinuationParentEvidence(
    workspaceRoot
  );
  assertParentMatchesPlan(parent, input.plan);
  const ledger = await readLedger(cwd, input.plan);
  assert(
    ledger.callsStarted.length === (ledger.low ? 1 : 0) + (ledger.high ? 1 : 0),
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_STARTED_CALL_REQUIRES_AUDIT"
  );
  if (ledger.high) return saveLedger(cwd, input.plan, ledger);
  assert(
    ledger.callsStarted.length === 0 && ledger.low === null,
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_PARTIAL_RUN_NO_RECOVERY"
  );
  const causal = buildGi088ResponseFirstV29ContinuationTurnInput(parent);
  assert(
    gi088ResponseFirstV29ContinuationSha(causal.turnInput) ===
      input.plan.causalInput.effectiveTurnInputHash &&
      gi088ResponseFirstV29ContinuationSha(causal.actualAssistant) ===
        input.plan.causalInput.actualAssistantHash &&
      gi088ResponseFirstV29ContinuationSha(causal.replacedFixtureAssistant) ===
        input.plan.causalInput.replacedFixtureAssistantHash,
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_CAUSAL_INPUT_DRIFT"
  );
  const lowPrompt = lowRequest(causal.turnInput).messages[1]?.content ?? "";
  assert(
    lowPrompt.includes(causal.actualAssistant.content) &&
      !lowPrompt.includes(causal.replacedFixtureAssistant.content) &&
      causal.turnInput.latestUserMessageId === "U4",
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_LOW_CAUSAL_PROMPT_INVALID"
  );
  ledger.parentGate = {
    verdict: parent.productVerdict,
    reviewHash: parent.productReviewHash,
    responseHash: parent.responseHash,
    postStateHash: parent.postStateHash
  };
  ledger.effectiveTurnInput = causal.turnInput;
  ledger.effectiveTurnInputHash =
    gi088ResponseFirstV29ContinuationSha(causal.turnInput);
  ledger.replacedFixtureAssistantHash =
    gi088ResponseFirstV29ContinuationSha(causal.replacedFixtureAssistant);
  ledger.actualAssistantHash =
    gi088ResponseFirstV29ContinuationSha(causal.actualAssistant);

  ledger.callsStarted.push("low");
  await saveLedger(cwd, input.plan, ledger);
  ledger.low = await runLow(input.provider, causal.turnInput);
  await saveLedger(cwd, input.plan, ledger);
  if (
    ledger.low.status !== "valid" ||
    !ledger.low.target15sPassed ||
    !ledger.low.hard45sPassed
  ) {
    return saveLedger(cwd, input.plan, ledger);
  }

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

export function validateGi088ResponseFirstV29ContinuationProductReview(input: {
  review: Gi088ResponseFirstV29ContinuationProductReview;
  plan: ContinuationPlan;
  ledger: Gi088ResponseFirstV29ContinuationPrivateLedger;
}) {
  const low = input.ledger.low;
  const high = input.ledger.high;
  assert(
    low?.responseHash &&
      high?.responseHash &&
      high.projectedHigh &&
      high.visibleDelivery &&
      high.continuationPostState &&
      input.ledger.effectiveTurnInputHash &&
      input.review.identity === input.plan.identity &&
      input.review.planFingerprint === input.plan.planFingerprint &&
      input.review.reviewerRole === "product_owner" &&
      input.review.evidenceBinding.parentResponseHash ===
        input.plan.parentCorrectionGate.responseHash &&
      input.review.evidenceBinding.parentPostStateHash ===
        input.plan.parentCorrectionGate.postStateHash &&
      input.review.evidenceBinding.effectiveTurnInputHash ===
        input.ledger.effectiveTurnInputHash &&
      input.review.evidenceBinding.lowResponseHash === low.responseHash &&
      input.review.evidenceBinding.highResponseHash === high.responseHash &&
      input.review.evidenceBinding.projectedHighHash ===
        gi088ResponseFirstV29ContinuationSha(high.projectedHigh) &&
      input.review.evidenceBinding.visibleDeliveryHash ===
        gi088ResponseFirstV29ContinuationSha(high.visibleDelivery) &&
      input.review.evidenceBinding.continuationPostStateHash ===
        gi088ResponseFirstV29ContinuationSha(high.continuationPostState) &&
      (input.review.verdict === "pass" ||
        input.review.verdict === "minor" ||
        input.review.verdict === "fail") &&
      input.review.note.trim().length > 0,
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_PRODUCT_REVIEW_INVALID"
  );
  const technicalGatePassed =
    low.status === "valid" &&
    low.target15sPassed &&
    low.hard45sPassed &&
    high.status === "valid" &&
    high.fullRound45sTargetPassed &&
    high.fullRound60sHardPassed;
  return {
    verdict: input.review.verdict,
    noteHash: gi088ResponseFirstV29ContinuationSha(input.review.note),
    technicalGatePassed,
    gatePassed:
      technicalGatePassed &&
      (input.review.verdict === "pass" || input.review.verdict === "minor"),
    reviewHash: gi088ResponseFirstV29ContinuationSha(input.review)
  };
}

async function readFrozenPlan(cwd: string) {
  const plan = JSON.parse(
    await readFile(
      path.join(cwd, GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS.publicStartCard),
      "utf8"
    )
  ) as ContinuationPlan;
  const { planFingerprint, ...core } = plan;
  assert(
    plan.identity === GI088_RESPONSE_FIRST_V29_CONTINUATION_IDENTITY &&
      gi088ResponseFirstV29ContinuationSha(core) === planFingerprint,
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_START_CARD_INVALID"
  );
  assert(
    await fileSha(cwd, FILES.standard) ===
      GI088_RESPONSE_FIRST_V29_CONTINUATION_STANDARD_SHA256,
    "STANDARD_SHA256_MISMATCH"
  );
  for (const [key, relativePath] of Object.entries(FILES)) {
    assert(
      await fileSha(cwd, relativePath) ===
        plan.inputHashes[`${key}Sha256`],
      `GI088_RESPONSE_FIRST_V29_CONTINUATION_INPUT_DRIFT:${key}`
    );
  }
  return plan;
}

export async function prepareGi088ResponseFirstV29ContinuationGate(
  cwd = process.cwd()
) {
  const file = path.join(
    cwd,
    GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS.publicStartCard
  );
  if (await pathExists(file)) return readFrozenPlan(cwd);
  const plan = await createGi088ResponseFirstV29ContinuationPlan(cwd);
  await writeJsonAtomic(file, plan);
  await saveLedger(cwd, plan, emptyLedger(plan));
  return plan;
}

export async function finalizeGi088ResponseFirstV29ContinuationProductReview(
  cwd = process.cwd()
) {
  const plan = await readFrozenPlan(cwd);
  const ledger = await readLedger(cwd, plan);
  const review = JSON.parse(
    await readFile(
      path.join(cwd, GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS.privateProductReview),
      "utf8"
    )
  ) as Gi088ResponseFirstV29ContinuationProductReview;
  ledger.productDecision =
    validateGi088ResponseFirstV29ContinuationProductReview({
      review,
      plan,
      ledger
    });
  return saveLedger(cwd, plan, ledger);
}

async function execute(cwd: string) {
  const plan = await prepareGi088ResponseFirstV29ContinuationGate(cwd);
  const parent = await loadGi088ResponseFirstV29ContinuationParentEvidence(cwd);
  assertParentMatchesPlan(parent, plan);
  loadEnvConfig(cwd, true);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  assert(
    apiKey,
    "GI088_RESPONSE_FIRST_V29_CONTINUATION_DEEPSEEK_API_KEY_MISSING"
  );
  const provider = new OpenAIProvider({
    apiKey,
    model: GI088_RESPONSE_FIRST_V29_RUNTIME.model,
    baseUrl: "https://api.deepseek.com",
    timeoutMs: GI088_RESPONSE_FIRST_V29_RUNTIME.high.hardTimeoutMs
  });
  const ledger = await runGi088ResponseFirstV29ContinuationGate({
    cwd,
    workspaceRoot: cwd,
    plan,
    provider
  });
  process.stdout.write(`${JSON.stringify({
    identity: plan.identity,
    status: receiptStatus(ledger),
    consumed: ledger.callsStarted.length,
    completed: (ledger.low ? 1 : 0) + (ledger.high ? 1 : 0),
    publicReceipt: GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS.publicReceipt,
    privateReview: ledger.high?.rawOutput
      ? GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS.privateReviewHtml
      : null
  }, null, 2)}\n`);
}

async function main() {
  const cwd = process.cwd();
  const command =
    process.env.GI088_RESPONSE_FIRST_V29_CONTINUATION_GATE_COMMAND ?? "prepare";
  if (command === "execute") return execute(cwd);
  if (command === "finalize") {
    const ledger = await finalizeGi088ResponseFirstV29ContinuationProductReview(cwd);
    process.stdout.write(`${JSON.stringify(ledger.productDecision, null, 2)}\n`);
    return;
  }
  const plan = await prepareGi088ResponseFirstV29ContinuationGate(cwd);
  process.stdout.write(`${JSON.stringify({
    identity: plan.identity,
    status: plan.status,
    budget: plan.budget,
    parentResponseHash: plan.parentCorrectionGate.responseHash,
    parentPostStateHash: plan.parentCorrectionGate.postStateHash,
    publicStartCard: GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS.publicStartCard
  }, null, 2)}\n`);
}

export function shouldRunGi088ResponseFirstV29ContinuationCli(input: {
  argv?: string[];
  env?: Partial<NodeJS.ProcessEnv>;
} = {}) {
  const argv = input.argv ?? process.argv;
  const env = input.env ?? process.env;
  return env.VITEST !== "true" && Boolean(
    env.GI088_RESPONSE_FIRST_V29_CONTINUATION_GATE_COMMAND ||
      argv.some((item) => path.resolve(item) === path.resolve(RUNNER_FILE))
  );
}

if (shouldRunGi088ResponseFirstV29ContinuationCli()) {
  void main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
