import { chmod, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertLocalJournalEvaluationEnvironment,
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest
} from "@/app/admin/journal-evaluation/private-loader";
import {
  GI088_PRO_CONTRACT_DEVELOPMENT_PRIVATE_REPORT_PATH,
  GI088_PRO_CONTRACT_DEVELOPMENT_REVIEW_SOURCE_PATH,
  GI088_PRO_CONTRACT_DEVELOPMENT_STAGE,
  GI088_PRO_CONTRACT_EXPERIMENT_VERSION,
  GI088_PRO_CONTRACT_HIDDEN_PRIVATE_REPORT_PATH,
  GI088_PRO_CONTRACT_HIDDEN_REVIEW_SOURCE_PATH,
  GI088_PRO_CONTRACT_HIDDEN_STAGE,
  GI088_PRO_CONTRACT_PRIVATE_ROOT,
  computeGi088ProContractReviewSourceFingerprint,
  gi088ProContractSha256,
  gi088ProContractStableJson,
  type Gi088ProContractBlindCandidate,
  type Gi088ProContractDevelopmentReviewSourceV1,
  type Gi088ProContractGroup,
  type Gi088ProContractHiddenReviewSourceV1,
  type Gi088ProContractReviewMessage,
  type Gi088ProContractSealedGroupIdentity,
  type Gi088ProContractTechnicalSummary
} from "@/server/services/evaluation/gi088/pro-contract-review-contract";

export { isLocalJournalEvaluationEnabled, isLocalJournalEvaluationRequest };

export const GI088_PRO_CONTRACT_REVIEW_TOOL_VERSION =
  "2026-08-12.gi088-pro-contract-review-workbench-v1" as const;

export type Gi088ProContractReviewVerdict =
  | "ready_to_use"
  | "minor_issue"
  | "quality_failure";

export type Gi088ProContractReviewFailureCategory =
  | "reasks_answered_content"
  | "working_task_drift"
  | "unsupported_third_party_inference"
  | "low_information_gain"
  | "answer_burden"
  | "contract_or_data";

export type Gi088ProContractCandidateDecision = {
  verdict: Gi088ProContractReviewVerdict;
  failureCategory: Gi088ProContractReviewFailureCategory | null;
  reason: string;
  singleCaseBlocker: boolean;
};

export type Gi088ProContractPublicCandidate = {
  available: boolean;
  messages: Gi088ProContractReviewMessage[];
  understanding: string | null;
  response: string;
  contentHash: string;
};

export type Gi088ProContractPublicCard = {
  publicId: string;
  label: string;
  attempt: 1 | 2;
  workingTask: string;
  messages: Gi088ProContractReviewMessage[];
  conversationDiffers: boolean;
  left: Gi088ProContractPublicCandidate;
  right: Gi088ProContractPublicCandidate | null;
  contentHash: string;
};

export type Gi088ProContractDevelopmentDecisionV1 = {
  publicId: string;
  left: Gi088ProContractCandidateDecision;
  right: Gi088ProContractCandidateDecision;
  preferredSide: "left" | "right";
  reviewer: "product_owner";
  updatedAt: string;
};

export type Gi088ProContractHiddenDecisionV1 = {
  publicId: string;
  candidate: Gi088ProContractCandidateDecision;
  reviewer: "product_owner";
  updatedAt: string;
};

export type Gi088ProContractDevelopmentGroupResult = {
  group: Gi088ProContractGroup;
  identity: Gi088ProContractSealedGroupIdentity;
  directUseCount: number;
  minorIssueCount: number;
  qualityFailureCount: number;
  singleCaseBlockerCount: number;
  pairedWinCount: number;
  pairedLossCount: number;
  humanGatePassed: boolean;
  technicalGatePassed: boolean;
  overallGatePassed: boolean;
  technical: Gi088ProContractTechnicalSummary;
};

export type Gi088ProContractDevelopmentReceiptV1 = {
  schemaVersion: "1.0";
  toolVersion: typeof GI088_PRO_CONTRACT_REVIEW_TOOL_VERSION;
  stage: typeof GI088_PRO_CONTRACT_DEVELOPMENT_STAGE;
  status: "sealed";
  experimentVersion: typeof GI088_PRO_CONTRACT_EXPERIMENT_VERSION;
  runnerReportFingerprint: string;
  runnerReportSha256: string;
  sourceFingerprint: string;
  sourceFileSha256: string;
  toolSourceSha256: string;
  bundleSha256: string;
  decisionsSha256: string;
  receiptSha256: string;
  reviewCount: 16;
  responseCount: 32;
  groupResults: [
    Gi088ProContractDevelopmentGroupResult,
    Gi088ProContractDevelopmentGroupResult
  ];
  winningGroup: Gi088ProContractGroup | null;
  gate: {
    passed: boolean;
    requiredDirectUseMinimum: 12;
    allowedMinorIssueMaximum: 4;
    allowedQualityFailureMaximum: 0;
    allowedSingleCaseBlockerMaximum: 0;
    practicalEquivalenceTolerance: 0.1;
    equivalentTiePreference: "compact";
  };
  reviewer: "product_owner";
  finalizedAt: string;
  modelCalls: 0;
  databaseWrites: 0;
  externalUploads: 0;
  telemetryEvents: 0;
};

export type Gi088ProContractHiddenReceiptV1 = {
  schemaVersion: "1.0";
  toolVersion: typeof GI088_PRO_CONTRACT_REVIEW_TOOL_VERSION;
  stage: typeof GI088_PRO_CONTRACT_HIDDEN_STAGE;
  status: "sealed";
  experimentVersion: typeof GI088_PRO_CONTRACT_EXPERIMENT_VERSION;
  runnerReportFingerprint: string;
  runnerReportSha256: string;
  developmentReceiptSha256: string;
  sourceFingerprint: string;
  sourceFileSha256: string;
  toolSourceSha256: string;
  bundleSha256: string;
  decisionsSha256: string;
  spentCasesSha256: string;
  receiptSha256: string;
  reviewCount: 32;
  directUseCount: number;
  minorIssueCount: number;
  qualityFailureCount: number;
  singleCaseBlockerCount: number;
  bothAttemptsPassedCount: number;
  winningGroup: Gi088ProContractGroup;
  winningIdentity: Gi088ProContractSealedGroupIdentity;
  technical: Gi088ProContractHiddenReviewSourceV1["technicalSummary"];
  gate: {
    passed: boolean;
    requiredDirectUseMinimum: 30;
    allowedMinorIssueMaximum: 2;
    allowedQualityFailureMaximum: 0;
    allowedSingleCaseBlockerMaximum: 0;
    requiredBothAttemptsPassed: 16;
    requiredTechnicalValidMinimum: 28;
  };
  reviewer: "product_owner";
  finalizedAt: string;
  modelCalls: 0;
  databaseWrites: 0;
  externalUploads: 0;
  telemetryEvents: 0;
};

export type Gi088ProContractDevelopmentBundleV1 = {
  schemaVersion: "1.0";
  toolVersion: typeof GI088_PRO_CONTRACT_REVIEW_TOOL_VERSION;
  stage: typeof GI088_PRO_CONTRACT_DEVELOPMENT_STAGE;
  sourceFileSha256: string;
  sourceFingerprint: string;
  toolSourceSha256: string;
  bundleSha256: string;
  cards: Gi088ProContractPublicCard[];
  decisions: Gi088ProContractDevelopmentDecisionV1[];
  receipt: Gi088ProContractDevelopmentReceiptV1 | null;
};

export type Gi088ProContractHiddenBundleV1 = {
  schemaVersion: "1.0";
  toolVersion: typeof GI088_PRO_CONTRACT_REVIEW_TOOL_VERSION;
  stage: typeof GI088_PRO_CONTRACT_HIDDEN_STAGE;
  sourceFileSha256: string;
  sourceFingerprint: string;
  toolSourceSha256: string;
  bundleSha256: string;
  cards: Gi088ProContractPublicCard[];
  decisions: Gi088ProContractHiddenDecisionV1[];
  receipt: Gi088ProContractHiddenReceiptV1 | null;
};

const DEVELOPMENT_CASE_IDS = [
  "GI088-V8R3-D01",
  "GI088-V8R3-D05",
  "GI088-V8R3-D08",
  "GI088-V8R3-D12",
  "GI088-V8R3-D25",
  "GI088-V8R3-D26",
  "GI088-V8R3-D27",
  "GI088-V8R3-D28"
] as const;
const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const FAILURE_CATEGORIES = new Set<Gi088ProContractReviewFailureCategory>([
  "reasks_answered_content",
  "working_task_drift",
  "unsupported_third_party_inference",
  "low_information_gain",
  "answer_burden",
  "contract_or_data"
]);

const TOOL_SOURCE_PATHS = [
  "scripts/run-gi088-pro-contract-review.ts",
  "src/app/admin/journal-evaluation/adaptive-recovery/pro-contract-review/page.tsx",
  "src/app/admin/journal-evaluation/pro-contract-review-loader.ts",
  "src/components/journal-evaluation/pro-contract-review-workbench.tsx",
  "src/server/services/evaluation/gi088/pro-contract-review-contract.ts",
  "src/app/api/local/gi088-v8r3/pro-contract-development-paired/session/route.ts",
  "src/app/api/local/gi088-v8r3/pro-contract-development-paired/draft/route.ts",
  "src/app/api/local/gi088-v8r3/pro-contract-development-paired/finalize/route.ts",
  "src/app/api/local/gi088-v8r3/pro-contract-hidden-admission/session/route.ts",
  "src/app/api/local/gi088-v8r3/pro-contract-hidden-admission/draft/route.ts",
  "src/app/api/local/gi088-v8r3/pro-contract-hidden-admission/finalize/route.ts"
] as const;

function isHash(value: unknown): value is string {
  return typeof value === "string" && HASH_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertDevelopmentReportReviewAllowed(
  report: unknown,
  source: Gi088ProContractDevelopmentReviewSourceV1
) {
  if (!isRecord(report) || report.reportFingerprint !== source.runnerReportFingerprint) {
    throw new Error("GI088_PRO_CONTRACT_DEVELOPMENT_REPORT_IDENTITY_MISMATCH");
  }
  const decision = report.decision;
  if (
    !isRecord(decision) ||
    decision.status !== "awaiting_human_development_review" ||
    !Array.isArray(decision.technicallyEligibleGroups) ||
    decision.technicallyEligibleGroups.length < 1 ||
    decision.technicallyEligibleGroups.some((group) =>
      group !== "full" && group !== "compact"
    )
  ) {
    throw new Error("GI088_PRO_CONTRACT_DEVELOPMENT_HUMAN_REVIEW_NOT_ALLOWED");
  }
}

function assertHiddenReportReviewAllowed(
  report: unknown,
  source: Gi088ProContractHiddenReviewSourceV1
) {
  if (
    !isRecord(report) ||
    report.reportFingerprint !== source.runnerReportFingerprint ||
    report.winner !== source.sealedReveal.winner.group
  ) throw new Error("GI088_PRO_CONTRACT_HIDDEN_REPORT_IDENTITY_MISMATCH");
  const decision = report.decision;
  if (
    !isRecord(decision) ||
    decision.status !== "awaiting_human_hidden_review"
  ) throw new Error("GI088_PRO_CONTRACT_HIDDEN_HUMAN_REVIEW_NOT_ALLOWED");
}

function validMessages(messages: unknown): messages is Gi088ProContractReviewMessage[] {
  return Array.isArray(messages) && messages.length > 0 && messages.every((message) =>
    message &&
    typeof message === "object" &&
    ["user", "assistant"].includes((message as { role?: string }).role ?? "") &&
    typeof (message as { content?: unknown }).content === "string" &&
    ((message as { content: string }).content.trim().length > 0)
  );
}

function receiptHashMatches(receipt: { receiptSha256: string }) {
  const payload = Object.fromEntries(
    Object.entries(receipt).filter(([key]) => key !== "receiptSha256")
  );
  return isHash(receipt.receiptSha256) &&
    receipt.receiptSha256 === gi088ProContractSha256(
      gi088ProContractStableJson(payload)
    );
}

function assertPrivateFile(metadata: Awaited<ReturnType<typeof stat>>, code: string) {
  if (!metadata.isFile() || (Number(metadata.mode) & 0o077) !== 0) throw new Error(code);
}

async function readPrivateJson<T>(path: string, code: string): Promise<{
  value: T;
  sha256: string;
}> {
  assertPrivateFile(await stat(path), code);
  const raw = await readFile(path);
  return { value: JSON.parse(raw.toString("utf8")) as T, sha256: gi088ProContractSha256(raw) };
}

async function readOptionalJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

async function atomicWrite(path: string, value: unknown, privateRoot: string) {
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  const temporaryPath = resolve(
    privateRoot,
    `.${path.split("/").at(-1)}.${process.pid}.${Date.now()}.tmp`
  );
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
}

async function computeToolSourceSha256() {
  const entries = await Promise.all(TOOL_SOURCE_PATHS.map(async (path) => ({
    path,
    sha256: gi088ProContractSha256(await readFile(resolve(process.cwd(), path)))
  })));
  return gi088ProContractSha256(gi088ProContractStableJson(entries));
}

function validateCandidate(candidate: Gi088ProContractBlindCandidate) {
  if (
    !candidate ||
    typeof candidate.blindId !== "string" ||
    candidate.blindId.trim().length === 0 ||
    typeof candidate.available !== "boolean" ||
    !isHash(candidate.requestHash) ||
    !isHash(candidate.contentHash) ||
    !validMessages(candidate.messages) ||
    typeof candidate.visible?.response !== "string" ||
    (candidate.visible.understanding !== null &&
      typeof candidate.visible.understanding !== "string") ||
    (candidate.available && candidate.visible.response.trim().length === 0)
  ) {
    throw new Error("GI088_PRO_CONTRACT_REVIEW_CANDIDATE_INVALID");
  }
}

function validateTechnicalSummary(
  summary: Gi088ProContractTechnicalSummary | Gi088ProContractHiddenReviewSourceV1["technicalSummary"],
  expectedCount: 64 | 32
) {
  if (
    !summary ||
    summary.resultCount !== expectedCount ||
    !["full", "compact"].includes(summary.group) ||
    !Number.isInteger(summary.providerCallCount) || summary.providerCallCount < 0 ||
    !Number.isInteger(summary.firstValidCount) ||
    !Number.isInteger(summary.blockedByPriorFailureCount) || summary.blockedByPriorFailureCount < 0 ||
    !Number.isInteger(summary.categorizedFailureCount) || summary.categorizedFailureCount < 0 ||
    !Number.isInteger(summary.latencySampleCount) || summary.latencySampleCount < 0 ||
    !Number.isInteger(summary.tokenUsageSampleCount) || summary.tokenUsageSampleCount < 0 ||
    !Number.isInteger(summary.totalTokens) || summary.totalTokens < 0 ||
    [
      summary.projectionAmbiguityCount,
      summary.stateInvariantFailureCount,
      summary.duplicateCommitCount,
      summary.statePollutionCount
    ].some((value) => !Number.isInteger(value) || value < 0) ||
    summary.firstValidCount < 0 ||
    summary.firstValidCount > expectedCount
  ) {
    throw new Error("GI088_PRO_CONTRACT_TECHNICAL_SUMMARY_INVALID");
  }
}

function validateDevelopmentSource(source: Gi088ProContractDevelopmentReviewSourceV1) {
  if (
    source.schemaVersion !== "1.0" ||
    source.experimentVersion !== GI088_PRO_CONTRACT_EXPERIMENT_VERSION ||
    source.stage !== GI088_PRO_CONTRACT_DEVELOPMENT_STAGE ||
    !isHash(source.runnerReportFingerprint) ||
    !isHash(source.runnerReportSha256) ||
    !isHash(source.sourceFingerprint) ||
    source.cards?.length !== 16 ||
    source.sourceFingerprint !== computeGi088ProContractReviewSourceFingerprint(source)
  ) throw new Error("GI088_PRO_CONTRACT_DEVELOPMENT_SOURCE_INVALID");
  const cardIds = new Set<string>();
  const caseAttempts = new Map<string, Set<number>>();
  const candidateKeys = new Set<string>();
  for (const card of source.cards) {
    validateCandidate(card.left);
    validateCandidate(card.right);
    if (
      cardIds.has(card.cardId) ||
      !DEVELOPMENT_CASE_IDS.includes(card.caseId as typeof DEVELOPMENT_CASE_IDS[number]) ||
      ![1, 2].includes(card.attempt) ||
      card.checkpointIndex < 0 ||
      card.workingTask.trim().length === 0 ||
      !validMessages(card.messages) ||
      !isHash(card.sourceFingerprint) ||
      card.left.blindId === card.right.blindId
    ) throw new Error("GI088_PRO_CONTRACT_DEVELOPMENT_CARD_INVALID");
    cardIds.add(card.cardId);
    const attempts = caseAttempts.get(card.caseId) ?? new Set<number>();
    attempts.add(card.attempt);
    caseAttempts.set(card.caseId, attempts);
    candidateKeys.add(`${card.cardId}:${card.left.blindId}`);
    candidateKeys.add(`${card.cardId}:${card.right.blindId}`);
  }
  if (
    caseAttempts.size !== 8 ||
    [...caseAttempts.values()].some((attempts) =>
      attempts.size !== 2 || !attempts.has(1) || !attempts.has(2)
    ) ||
    source.sealedReveal.candidates.length !== 32
  ) throw new Error("GI088_PRO_CONTRACT_DEVELOPMENT_MATRIX_INVALID");
  const revealKeys = new Set<string>();
  for (const reveal of source.sealedReveal.candidates) {
    const key = `${reveal.cardId}:${reveal.blindId}`;
    if (!candidateKeys.has(key) || revealKeys.has(key)) {
      throw new Error("GI088_PRO_CONTRACT_DEVELOPMENT_REVEAL_INVALID");
    }
    revealKeys.add(key);
  }
  if (
    revealKeys.size !== candidateKeys.size ||
    source.cards.some((card) => {
      const groups = source.sealedReveal.candidates
        .filter((item) => item.cardId === card.cardId)
        .map((item) => item.group);
      return groups.length !== 2 || new Set(groups).size !== 2;
    })
  ) throw new Error("GI088_PRO_CONTRACT_DEVELOPMENT_REVEAL_INVALID");
  source.technicalSummaries.forEach((summary) => validateTechnicalSummary(summary, 64));
  if (new Set(source.technicalSummaries.map((item) => item.group)).size !== 2) {
    throw new Error("GI088_PRO_CONTRACT_TECHNICAL_SUMMARY_INVALID");
  }
}

function validateHiddenSource(source: Gi088ProContractHiddenReviewSourceV1) {
  if (
    source.schemaVersion !== "1.0" ||
    source.experimentVersion !== GI088_PRO_CONTRACT_EXPERIMENT_VERSION ||
    source.stage !== GI088_PRO_CONTRACT_HIDDEN_STAGE ||
    !isHash(source.runnerReportFingerprint) ||
    !isHash(source.runnerReportSha256) ||
    !isHash(source.developmentReceiptSha256) ||
    !isHash(source.sourceFingerprint) ||
    source.cards?.length !== 32 ||
    source.sourceFingerprint !== computeGi088ProContractReviewSourceFingerprint(source)
  ) throw new Error("GI088_PRO_CONTRACT_HIDDEN_SOURCE_INVALID");
  const cardIds = new Set<string>();
  const checkpointAttempts = new Map<string, Set<number>>();
  for (const card of source.cards) {
    validateCandidate(card.candidate);
    if (
      cardIds.has(card.cardId) ||
      ![1, 2].includes(card.attempt) ||
      card.checkpointIndex < 0 ||
      card.workingTask.trim().length === 0 ||
      !validMessages(card.messages) ||
      !isHash(card.sourceFingerprint)
    ) throw new Error("GI088_PRO_CONTRACT_HIDDEN_CARD_INVALID");
    cardIds.add(card.cardId);
    const checkpointIdentity = `${card.caseId}:${card.checkpointIndex}`;
    const attempts = checkpointAttempts.get(checkpointIdentity) ?? new Set<number>();
    attempts.add(card.attempt);
    checkpointAttempts.set(checkpointIdentity, attempts);
  }
  if (
    checkpointAttempts.size !== 16 ||
    [...checkpointAttempts.values()].some((attempts) =>
      attempts.size !== 2 || !attempts.has(1) || !attempts.has(2)
    )
  ) throw new Error("GI088_PRO_CONTRACT_HIDDEN_MATRIX_INVALID");
  validateTechnicalSummary(source.technicalSummary, 32);
  if (source.technicalSummary.group !== source.sealedReveal.winner.group) {
    throw new Error("GI088_PRO_CONTRACT_HIDDEN_WINNER_MISMATCH");
  }
}

function validateDecision(
  decision: Gi088ProContractCandidateDecision,
  available: boolean
): Gi088ProContractCandidateDecision {
  const reason = decision.reason.trim();
  if (!available) {
    if (
      decision.verdict !== "quality_failure" ||
      decision.failureCategory !== "contract_or_data" ||
      reason.length < 8 ||
      reason.length > 300
    ) throw new Error("GI088_PRO_CONTRACT_UNAVAILABLE_DECISION_INVALID");
    return { ...decision, reason };
  }
  if (decision.verdict === "ready_to_use") {
    if (decision.failureCategory !== null || decision.singleCaseBlocker || reason) {
      throw new Error("GI088_PRO_CONTRACT_READY_DECISION_INVALID");
    }
    return { ...decision, reason: "" };
  }
  if (
    !FAILURE_CATEGORIES.has(decision.failureCategory as Gi088ProContractReviewFailureCategory) ||
    reason.length < 8 ||
    reason.length > 300 ||
    (decision.verdict !== "quality_failure" && decision.singleCaseBlocker)
  ) throw new Error("GI088_PRO_CONTRACT_DECISION_INVALID");
  return { ...decision, reason };
}

function publicCandidate(candidate: Gi088ProContractBlindCandidate): Gi088ProContractPublicCandidate {
  return {
    available: candidate.available,
    messages: candidate.messages,
    understanding: candidate.visible.understanding,
    response: candidate.visible.response,
    contentHash: candidate.contentHash
  };
}

function stablePublicId(sourceFingerprint: string, cardId: string) {
  return gi088ProContractSha256(`${sourceFingerprint}:${cardId}`).slice(0, 20);
}

function technicalGate(
  summary: Gi088ProContractTechnicalSummary | Gi088ProContractHiddenReviewSourceV1["technicalSummary"],
  minimumValid: number
) {
  return summary.firstValidCount >= minimumValid &&
    summary.projectionAmbiguityCount === 0 &&
    summary.stateInvariantFailureCount === 0 &&
    summary.duplicateCommitCount === 0 &&
    summary.statePollutionCount === 0 &&
    summary.categorizedFailureCount === summary.resultCount - summary.firstValidCount &&
    summary.latencySampleCount === summary.providerCallCount &&
    summary.tokenUsageSampleCount === summary.providerCallCount &&
    summary.latency.p50Ms !== null && summary.latency.p50Ms <= 20_000 &&
    summary.latency.p90Ms !== null && summary.latency.p90Ms <= 40_000 &&
    summary.latency.maxMs !== null && summary.latency.maxMs <= 60_000;
}

function groupFor(
  source: Gi088ProContractDevelopmentReviewSourceV1,
  cardId: string,
  blindId: string
) {
  const reveal = source.sealedReveal.candidates.find(
    (item) => item.cardId === cardId && item.blindId === blindId
  );
  if (!reveal) throw new Error("GI088_PRO_CONTRACT_REVEAL_KEY_MISSING");
  return reveal.group;
}

function toolSource(input?: string) {
  return input ? async () => input : computeToolSourceSha256;
}

export function createGi088ProContractDevelopmentReviewService(input?: {
  sourcePath?: string;
  runnerReportPath?: string;
  privateRoot?: string;
  toolSourceSha256?: string;
  now?: () => string;
}) {
  const sourcePath = input?.sourcePath ?? GI088_PRO_CONTRACT_DEVELOPMENT_REVIEW_SOURCE_PATH;
  const runnerReportPath = input?.runnerReportPath ?? GI088_PRO_CONTRACT_DEVELOPMENT_PRIVATE_REPORT_PATH;
  const privateRoot = input?.privateRoot ?? resolve(GI088_PRO_CONTRACT_PRIVATE_ROOT, "development-review");
  const decisionsPath = resolve(privateRoot, "decisions.json");
  const receiptPath = resolve(privateRoot, "receipt.json");
  const now = input?.now ?? (() => new Date().toISOString());
  const sourceSha = toolSource(input?.toolSourceSha256);

  async function material() {
    assertLocalJournalEvaluationEnvironment();
    const loaded = await readPrivateJson<Gi088ProContractDevelopmentReviewSourceV1>(
      sourcePath,
      "GI088_PRO_CONTRACT_DEVELOPMENT_SOURCE_FILE_INVALID"
    );
    validateDevelopmentSource(loaded.value);
    const report = await readPrivateJson<unknown>(
      runnerReportPath,
      "GI088_PRO_CONTRACT_DEVELOPMENT_REPORT_FILE_INVALID"
    );
    if (report.sha256 !== loaded.value.runnerReportSha256) {
      throw new Error("GI088_PRO_CONTRACT_DEVELOPMENT_REPORT_SHA_MISMATCH");
    }
    assertDevelopmentReportReviewAllowed(report.value, loaded.value);
    const ordered = [...loaded.value.cards].sort((left, right) =>
      gi088ProContractSha256(`${loaded.value.sourceFingerprint}:${left.cardId}`)
        .localeCompare(gi088ProContractSha256(`${loaded.value.sourceFingerprint}:${right.cardId}`))
    );
    const cards = ordered.map((card, index) => {
      const candidates = [card.left, card.right].sort((left, right) =>
        gi088ProContractSha256(`${loaded.value.sourceFingerprint}:${card.cardId}:${left.blindId}`)
          .localeCompare(gi088ProContractSha256(`${loaded.value.sourceFingerprint}:${card.cardId}:${right.blindId}`))
      );
      const content = {
        workingTask: card.workingTask,
        messages: card.messages,
        left: candidates[0]!.contentHash,
        right: candidates[1]!.contentHash
      };
      return {
        publicId: stablePublicId(loaded.value.sourceFingerprint, card.cardId),
        label: `开发配对 ${String(index + 1).padStart(2, "0")}`,
        attempt: card.attempt,
        workingTask: card.workingTask,
        messages: card.messages,
        conversationDiffers:
          gi088ProContractStableJson(candidates[0]!.messages) !==
          gi088ProContractStableJson(candidates[1]!.messages),
        left: publicCandidate(candidates[0]!),
        right: publicCandidate(candidates[1]!),
        contentHash: gi088ProContractSha256(gi088ProContractStableJson(content)),
        privateCardId: card.cardId,
        privateCaseId: card.caseId,
        leftBlindId: candidates[0]!.blindId,
        rightBlindId: candidates[1]!.blindId
      };
    });
    return { source: loaded.value, sourceFileSha256: loaded.sha256, cards };
  }

  async function readDecisions(current: Awaited<ReturnType<typeof material>>) {
    const saved = await readOptionalJson<Gi088ProContractDevelopmentDecisionV1[]>(decisionsPath, []);
    const cardMap = new Map(current.cards.map((card) => [card.publicId, card]));
    if (
      !Array.isArray(saved) ||
      new Set(saved.map((item) => item.publicId)).size !== saved.length ||
      saved.some((item) => {
        const card = cardMap.get(item.publicId);
        if (!card || item.reviewer !== "product_owner" || !["left", "right"].includes(item.preferredSide)) return true;
        try {
          validateDecision(item.left, card.left.available);
          validateDecision(item.right, card.right!.available);
          return false;
        } catch {
          return true;
        }
      })
    ) throw new Error("GI088_PRO_CONTRACT_DEVELOPMENT_DECISIONS_INVALID");
    return saved;
  }

  async function bundleData() {
    const current = await material();
    const toolSourceSha256 = await sourceSha();
    const publicCards: Gi088ProContractPublicCard[] = current.cards.map((card) => ({
      publicId: card.publicId,
      label: card.label,
      attempt: card.attempt,
      workingTask: card.workingTask,
      messages: card.messages,
      conversationDiffers: card.conversationDiffers,
      left: card.left,
      right: card.right,
      contentHash: card.contentHash
    }));
    const bundleSha256 = gi088ProContractSha256(gi088ProContractStableJson({
      sourceFileSha256: current.sourceFileSha256,
      sourceFingerprint: current.source.sourceFingerprint,
      toolSourceSha256,
      cards: publicCards
    }));
    return { current, publicCards, toolSourceSha256, bundleSha256 };
  }

  async function load(): Promise<Gi088ProContractDevelopmentBundleV1> {
    const { current, publicCards, toolSourceSha256, bundleSha256 } = await bundleData();
    const decisions = await readDecisions(current);
    const receipt = await readOptionalJson<Gi088ProContractDevelopmentReceiptV1 | null>(receiptPath, null);
    if (receipt && (
      receipt.stage !== GI088_PRO_CONTRACT_DEVELOPMENT_STAGE ||
      receipt.sourceFileSha256 !== current.sourceFileSha256 ||
      receipt.sourceFingerprint !== current.source.sourceFingerprint ||
      receipt.toolSourceSha256 !== toolSourceSha256 ||
      receipt.bundleSha256 !== bundleSha256 ||
      !receiptHashMatches(receipt)
    )) throw new Error("GI088_PRO_CONTRACT_DEVELOPMENT_RECEIPT_SOURCE_MISMATCH");
    return {
      schemaVersion: "1.0",
      toolVersion: GI088_PRO_CONTRACT_REVIEW_TOOL_VERSION,
      stage: GI088_PRO_CONTRACT_DEVELOPMENT_STAGE,
      sourceFileSha256: current.sourceFileSha256,
      sourceFingerprint: current.source.sourceFingerprint,
      toolSourceSha256,
      bundleSha256,
      cards: publicCards,
      decisions,
      receipt
    };
  }

  async function saveDecision(inputDecision: {
    publicId: string;
    left: Gi088ProContractCandidateDecision;
    right: Gi088ProContractCandidateDecision;
    preferredSide: "left" | "right";
  }) {
    const { current } = await bundleData();
    if (await readOptionalJson(receiptPath, null)) {
      throw new Error("GI088_PRO_CONTRACT_DEVELOPMENT_RECEIPT_IMMUTABLE");
    }
    const card = current.cards.find((item) => item.publicId === inputDecision.publicId);
    if (!card) throw new Error("GI088_PRO_CONTRACT_DEVELOPMENT_CARD_NOT_FOUND");
    if (!["left", "right"].includes(inputDecision.preferredSide)) {
      throw new Error("GI088_PRO_CONTRACT_PAIR_PREFERENCE_REQUIRED");
    }
    const next: Gi088ProContractDevelopmentDecisionV1 = {
      publicId: card.publicId,
      left: validateDecision(inputDecision.left, card.left.available),
      right: validateDecision(inputDecision.right, card.right!.available),
      preferredSide: inputDecision.preferredSide,
      reviewer: "product_owner",
      updatedAt: now()
    };
    const saved = await readDecisions(current);
    const updated = [
      ...saved.filter((item) => item.publicId !== card.publicId),
      next
    ].sort((left, right) =>
      current.cards.findIndex((item) => item.publicId === left.publicId) -
      current.cards.findIndex((item) => item.publicId === right.publicId)
    );
    await atomicWrite(decisionsPath, updated, privateRoot);
    return load();
  }

  async function finalize(): Promise<Gi088ProContractDevelopmentReceiptV1> {
    const existing = await readOptionalJson<Gi088ProContractDevelopmentReceiptV1 | null>(receiptPath, null);
    if (existing) {
      await load();
      return existing;
    }
    const { current, toolSourceSha256, bundleSha256 } = await bundleData();
    const decisions = await readDecisions(current);
    if (decisions.length !== 16) throw new Error("GI088_PRO_CONTRACT_DEVELOPMENT_REVIEW_INCOMPLETE");
    const results = new Map<Gi088ProContractGroup, {
      verdicts: Gi088ProContractReviewVerdict[];
      blockers: boolean[];
      wins: number;
    }>([
      ["full", { verdicts: [], blockers: [], wins: 0 }],
      ["compact", { verdicts: [], blockers: [], wins: 0 }]
    ]);
    for (const decision of decisions) {
      const card = current.cards.find((item) => item.publicId === decision.publicId)!;
      for (const side of ["left", "right"] as const) {
        const group = groupFor(current.source, card.privateCardId, card[`${side}BlindId`]);
        const result = results.get(group)!;
        result.verdicts.push(decision[side].verdict);
        result.blockers.push(decision[side].singleCaseBlocker);
        if (decision.preferredSide === side) result.wins += 1;
      }
    }
    const groupResults = (["full", "compact"] as const).map((group) => {
      const result = results.get(group)!;
      const technical = current.source.technicalSummaries.find((item) => item.group === group)!;
      const identity = current.source.sealedReveal.identities.find((item) => item.group === group)!;
      const directUseCount = result.verdicts.filter((item) => item === "ready_to_use").length;
      const minorIssueCount = result.verdicts.filter((item) => item === "minor_issue").length;
      const qualityFailureCount = result.verdicts.filter((item) => item === "quality_failure").length;
      const singleCaseBlockerCount = result.blockers.filter(Boolean).length;
      const humanGatePassed = directUseCount >= 12 && minorIssueCount <= 4 && qualityFailureCount === 0 && singleCaseBlockerCount === 0;
      const technicalGatePassed = technicalGate(technical, 55);
      return {
        group,
        identity,
        directUseCount,
        minorIssueCount,
        qualityFailureCount,
        singleCaseBlockerCount,
        pairedWinCount: result.wins,
        pairedLossCount: 16 - result.wins,
        humanGatePassed,
        technicalGatePassed,
        overallGatePassed: humanGatePassed && technicalGatePassed,
        technical
      } satisfies Gi088ProContractDevelopmentGroupResult;
    }) as [Gi088ProContractDevelopmentGroupResult, Gi088ProContractDevelopmentGroupResult];
    const full = groupResults.find((item) => item.group === "full")!;
    const compact = groupResults.find((item) => item.group === "compact")!;
    let winningGroup: Gi088ProContractGroup | null = null;
    if (full.overallGatePassed !== compact.overallGatePassed) {
      winningGroup = full.overallGatePassed ? "full" : "compact";
    } else if (full.overallGatePassed && compact.overallGatePassed) {
      const compactEquivalent =
        compact.directUseCount >= full.directUseCount &&
        compact.pairedWinCount >= compact.pairedLossCount &&
        compact.technical.firstValidCount >= full.technical.firstValidCount * 0.9 &&
        compact.technical.latency.p90Ms !== null &&
        full.technical.latency.p90Ms !== null &&
        compact.technical.latency.p90Ms <= full.technical.latency.p90Ms * 1.1 &&
        compact.technical.totalTokens <= full.technical.totalTokens * 1.1 &&
        compact.technical.projectionAmbiguityCount === 0 &&
        compact.technical.stateInvariantFailureCount === 0 &&
        compact.technical.duplicateCommitCount === 0 &&
        compact.technical.statePollutionCount === 0;
      winningGroup = compactEquivalent ? "compact" : "full";
    }
    const decisionsSha256 = gi088ProContractSha256(gi088ProContractStableJson(decisions));
    const receiptPayload = {
      schemaVersion: "1.0",
      toolVersion: GI088_PRO_CONTRACT_REVIEW_TOOL_VERSION,
      stage: GI088_PRO_CONTRACT_DEVELOPMENT_STAGE,
      status: "sealed",
      experimentVersion: GI088_PRO_CONTRACT_EXPERIMENT_VERSION,
      runnerReportFingerprint: current.source.runnerReportFingerprint,
      runnerReportSha256: current.source.runnerReportSha256,
      sourceFingerprint: current.source.sourceFingerprint,
      sourceFileSha256: current.sourceFileSha256,
      toolSourceSha256,
      bundleSha256,
      decisionsSha256,
      reviewCount: 16,
      responseCount: 32,
      groupResults,
      winningGroup,
      gate: {
        passed: winningGroup !== null,
        requiredDirectUseMinimum: 12,
        allowedMinorIssueMaximum: 4,
        allowedQualityFailureMaximum: 0,
        allowedSingleCaseBlockerMaximum: 0,
        practicalEquivalenceTolerance: 0.1,
        equivalentTiePreference: "compact"
      },
      reviewer: "product_owner",
      finalizedAt: now(),
      modelCalls: 0,
      databaseWrites: 0,
      externalUploads: 0,
      telemetryEvents: 0
    } as const;
    const receipt = {
      ...receiptPayload,
      receiptSha256: gi088ProContractSha256(gi088ProContractStableJson(receiptPayload))
    } satisfies Gi088ProContractDevelopmentReceiptV1;
    await atomicWrite(receiptPath, receipt, privateRoot);
    return receipt;
  }

  return { load, saveDecision, finalize };
}

export function createGi088ProContractHiddenReviewService(input?: {
  sourcePath?: string;
  runnerReportPath?: string;
  developmentReceiptPath?: string;
  privateRoot?: string;
  toolSourceSha256?: string;
  now?: () => string;
}) {
  const sourcePath = input?.sourcePath ?? GI088_PRO_CONTRACT_HIDDEN_REVIEW_SOURCE_PATH;
  const runnerReportPath = input?.runnerReportPath ?? GI088_PRO_CONTRACT_HIDDEN_PRIVATE_REPORT_PATH;
  const developmentReceiptPath = input?.developmentReceiptPath ?? resolve(GI088_PRO_CONTRACT_PRIVATE_ROOT, "development-review/receipt.json");
  const privateRoot = input?.privateRoot ?? resolve(GI088_PRO_CONTRACT_PRIVATE_ROOT, "hidden-review");
  const decisionsPath = resolve(privateRoot, "decisions.json");
  const receiptPath = resolve(privateRoot, "receipt.json");
  const spentCasesPath = resolve(privateRoot, "spent-hidden-cases.json");
  const now = input?.now ?? (() => new Date().toISOString());
  const sourceSha = toolSource(input?.toolSourceSha256);

  async function material() {
    assertLocalJournalEvaluationEnvironment();
    const loaded = await readPrivateJson<Gi088ProContractHiddenReviewSourceV1>(sourcePath, "GI088_PRO_CONTRACT_HIDDEN_SOURCE_FILE_INVALID");
    validateHiddenSource(loaded.value);
    const [report, developmentReceipt] = await Promise.all([
      readPrivateJson<unknown>(runnerReportPath, "GI088_PRO_CONTRACT_HIDDEN_REPORT_FILE_INVALID"),
      readPrivateJson<Gi088ProContractDevelopmentReceiptV1>(developmentReceiptPath, "GI088_PRO_CONTRACT_DEVELOPMENT_RECEIPT_FILE_INVALID")
    ]);
    if (report.sha256 !== loaded.value.runnerReportSha256) throw new Error("GI088_PRO_CONTRACT_HIDDEN_REPORT_SHA_MISMATCH");
    assertHiddenReportReviewAllowed(report.value, loaded.value);
    if (
      developmentReceipt.sha256 !== loaded.value.developmentReceiptSha256 ||
      developmentReceipt.value.winningGroup !== loaded.value.sealedReveal.winner.group ||
      !developmentReceipt.value.gate.passed
    ) throw new Error("GI088_PRO_CONTRACT_HIDDEN_DEVELOPMENT_RECEIPT_MISMATCH");
    const ordered = [...loaded.value.cards].sort((left, right) =>
      gi088ProContractSha256(`${loaded.value.sourceFingerprint}:${left.cardId}`)
        .localeCompare(gi088ProContractSha256(`${loaded.value.sourceFingerprint}:${right.cardId}`))
    );
    const cards = ordered.map((card, index) => ({
      publicId: stablePublicId(loaded.value.sourceFingerprint, card.cardId),
      label: `隐藏准入 ${String(index + 1).padStart(2, "0")}`,
      attempt: card.attempt,
      workingTask: card.workingTask,
      messages: card.messages,
      conversationDiffers: false,
      left: publicCandidate(card.candidate),
      right: null,
      contentHash: gi088ProContractSha256(gi088ProContractStableJson({
        workingTask: card.workingTask,
        messages: card.messages,
        candidate: card.candidate.contentHash
      })),
      privateCardId: card.cardId,
      privateCaseId: card.caseId,
      privateCheckpointIndex: card.checkpointIndex
    }));
    return { source: loaded.value, sourceFileSha256: loaded.sha256, cards };
  }

  async function readDecisions(current: Awaited<ReturnType<typeof material>>) {
    const saved = await readOptionalJson<Gi088ProContractHiddenDecisionV1[]>(decisionsPath, []);
    const cardMap = new Map(current.cards.map((card) => [card.publicId, card]));
    if (
      !Array.isArray(saved) ||
      new Set(saved.map((item) => item.publicId)).size !== saved.length ||
      saved.some((item) => {
        const card = cardMap.get(item.publicId);
        if (!card || item.reviewer !== "product_owner") return true;
        try { validateDecision(item.candidate, card.left.available); return false; } catch { return true; }
      })
    ) throw new Error("GI088_PRO_CONTRACT_HIDDEN_DECISIONS_INVALID");
    return saved;
  }

  async function bundleData() {
    const current = await material();
    const toolSourceSha256 = await sourceSha();
    const publicCards: Gi088ProContractPublicCard[] = current.cards.map((card) => ({
      publicId: card.publicId,
      label: card.label,
      attempt: card.attempt,
      workingTask: card.workingTask,
      messages: card.messages,
      conversationDiffers: card.conversationDiffers,
      left: card.left,
      right: card.right,
      contentHash: card.contentHash
    }));
    const bundleSha256 = gi088ProContractSha256(gi088ProContractStableJson({
      sourceFileSha256: current.sourceFileSha256,
      sourceFingerprint: current.source.sourceFingerprint,
      toolSourceSha256,
      cards: publicCards
    }));
    return { current, publicCards, toolSourceSha256, bundleSha256 };
  }

  async function load(): Promise<Gi088ProContractHiddenBundleV1> {
    const { current, publicCards, toolSourceSha256, bundleSha256 } = await bundleData();
    const decisions = await readDecisions(current);
    const receipt = await readOptionalJson<Gi088ProContractHiddenReceiptV1 | null>(receiptPath, null);
    if (receipt && (
      receipt.stage !== GI088_PRO_CONTRACT_HIDDEN_STAGE ||
      receipt.sourceFileSha256 !== current.sourceFileSha256 ||
      receipt.sourceFingerprint !== current.source.sourceFingerprint ||
      receipt.toolSourceSha256 !== toolSourceSha256 ||
      receipt.bundleSha256 !== bundleSha256 ||
      !receiptHashMatches(receipt)
    )) throw new Error("GI088_PRO_CONTRACT_HIDDEN_RECEIPT_SOURCE_MISMATCH");
    return {
      schemaVersion: "1.0",
      toolVersion: GI088_PRO_CONTRACT_REVIEW_TOOL_VERSION,
      stage: GI088_PRO_CONTRACT_HIDDEN_STAGE,
      sourceFileSha256: current.sourceFileSha256,
      sourceFingerprint: current.source.sourceFingerprint,
      toolSourceSha256,
      bundleSha256,
      cards: publicCards,
      decisions,
      receipt
    };
  }

  async function saveDecision(inputDecision: {
    publicId: string;
    candidate: Gi088ProContractCandidateDecision;
  }) {
    const { current } = await bundleData();
    if (await readOptionalJson(receiptPath, null)) throw new Error("GI088_PRO_CONTRACT_HIDDEN_RECEIPT_IMMUTABLE");
    const card = current.cards.find((item) => item.publicId === inputDecision.publicId);
    if (!card) throw new Error("GI088_PRO_CONTRACT_HIDDEN_CARD_NOT_FOUND");
    const next: Gi088ProContractHiddenDecisionV1 = {
      publicId: card.publicId,
      candidate: validateDecision(inputDecision.candidate, card.left.available),
      reviewer: "product_owner",
      updatedAt: now()
    };
    const saved = await readDecisions(current);
    const updated = [...saved.filter((item) => item.publicId !== card.publicId), next]
      .sort((left, right) =>
        current.cards.findIndex((item) => item.publicId === left.publicId) -
        current.cards.findIndex((item) => item.publicId === right.publicId)
      );
    await atomicWrite(decisionsPath, updated, privateRoot);
    return load();
  }

  async function finalize(): Promise<Gi088ProContractHiddenReceiptV1> {
    const existing = await readOptionalJson<Gi088ProContractHiddenReceiptV1 | null>(receiptPath, null);
    if (existing) {
      await load();
      return existing;
    }
    const { current, toolSourceSha256, bundleSha256 } = await bundleData();
    const decisions = await readDecisions(current);
    if (decisions.length !== 32) throw new Error("GI088_PRO_CONTRACT_HIDDEN_REVIEW_INCOMPLETE");
    const directUseCount = decisions.filter((item) => item.candidate.verdict === "ready_to_use").length;
    const minorIssueCount = decisions.filter((item) => item.candidate.verdict === "minor_issue").length;
    const qualityFailureCount = decisions.filter((item) => item.candidate.verdict === "quality_failure").length;
    const singleCaseBlockerCount = decisions.filter((item) => item.candidate.singleCaseBlocker).length;
    const decisionsByCheckpoint = new Map<string, Gi088ProContractHiddenDecisionV1[]>();
    for (const decision of decisions) {
      const card = current.cards.find((item) => item.publicId === decision.publicId)!;
      const checkpointIdentity = `${card.privateCaseId}:${card.privateCheckpointIndex}`;
      const items = decisionsByCheckpoint.get(checkpointIdentity) ?? [];
      items.push(decision);
      decisionsByCheckpoint.set(checkpointIdentity, items);
    }
    const bothAttemptsPassedCount = [...decisionsByCheckpoint.values()].filter(
      (items) => items.length === 2 && items.every((item) => item.candidate.verdict !== "quality_failure")
    ).length;
    const gatePassed =
      directUseCount >= 30 && minorIssueCount <= 2 && qualityFailureCount === 0 &&
      singleCaseBlockerCount === 0 && bothAttemptsPassedCount === 16 &&
      technicalGate(current.source.technicalSummary, 28);
    const spentCases = {
      schemaVersion: "1.0",
      sourceFingerprint: current.source.sourceFingerprint,
      status: "spent_by_product_owner_review",
      cases: [...new Set(current.cards.map((item) => item.privateCaseId))].sort(),
      finalizedAt: now()
    } as const;
    const spentCasesSha256 = gi088ProContractSha256(gi088ProContractStableJson(spentCases));
    const decisionsSha256 = gi088ProContractSha256(gi088ProContractStableJson(decisions));
    const receiptPayload = {
      schemaVersion: "1.0",
      toolVersion: GI088_PRO_CONTRACT_REVIEW_TOOL_VERSION,
      stage: GI088_PRO_CONTRACT_HIDDEN_STAGE,
      status: "sealed",
      experimentVersion: GI088_PRO_CONTRACT_EXPERIMENT_VERSION,
      runnerReportFingerprint: current.source.runnerReportFingerprint,
      runnerReportSha256: current.source.runnerReportSha256,
      developmentReceiptSha256: current.source.developmentReceiptSha256,
      sourceFingerprint: current.source.sourceFingerprint,
      sourceFileSha256: current.sourceFileSha256,
      toolSourceSha256,
      bundleSha256,
      decisionsSha256,
      spentCasesSha256,
      reviewCount: 32,
      directUseCount,
      minorIssueCount,
      qualityFailureCount,
      singleCaseBlockerCount,
      bothAttemptsPassedCount,
      winningGroup: current.source.sealedReveal.winner.group,
      winningIdentity: current.source.sealedReveal.winner,
      technical: current.source.technicalSummary,
      gate: {
        passed: gatePassed,
        requiredDirectUseMinimum: 30,
        allowedMinorIssueMaximum: 2,
        allowedQualityFailureMaximum: 0,
        allowedSingleCaseBlockerMaximum: 0,
        requiredBothAttemptsPassed: 16,
        requiredTechnicalValidMinimum: 28
      },
      reviewer: "product_owner",
      finalizedAt: spentCases.finalizedAt,
      modelCalls: 0,
      databaseWrites: 0,
      externalUploads: 0,
      telemetryEvents: 0
    } as const;
    const receipt = {
      ...receiptPayload,
      receiptSha256: gi088ProContractSha256(gi088ProContractStableJson(receiptPayload))
    } satisfies Gi088ProContractHiddenReceiptV1;
    await atomicWrite(spentCasesPath, spentCases, privateRoot);
    await atomicWrite(receiptPath, receipt, privateRoot);
    return receipt;
  }

  return { load, saveDecision, finalize };
}

const developmentService = createGi088ProContractDevelopmentReviewService();
const hiddenService = createGi088ProContractHiddenReviewService();

export const loadGi088ProContractDevelopmentReview = () => developmentService.load();
export const saveGi088ProContractDevelopmentDecision = (
  input: Parameters<typeof developmentService.saveDecision>[0]
) => developmentService.saveDecision(input);
export const finalizeGi088ProContractDevelopmentReview = () => developmentService.finalize();

export const loadGi088ProContractHiddenReview = () => hiddenService.load();
export const saveGi088ProContractHiddenDecision = (
  input: Parameters<typeof hiddenService.saveDecision>[0]
) => hiddenService.saveDecision(input);
export const finalizeGi088ProContractHiddenReview = () => hiddenService.finalize();

export function gi088ProContractDevelopmentReviewPrivateRoot() {
  return resolve(GI088_PRO_CONTRACT_PRIVATE_ROOT, "development-review");
}

export function gi088ProContractHiddenReviewPrivateRoot() {
  return resolve(GI088_PRO_CONTRACT_PRIVATE_ROOT, "hidden-review");
}
