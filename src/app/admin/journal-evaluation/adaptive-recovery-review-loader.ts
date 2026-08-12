import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertLocalJournalEvaluationEnvironment,
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest
} from "@/app/admin/journal-evaluation/private-loader";
import type {
  Gi088EmptyRecoveryFailureCategory,
  Gi088EmptyRecoveryVerdict
} from "@/app/admin/journal-evaluation/empty-recovery-review-loader";

export { isLocalJournalEvaluationEnabled, isLocalJournalEvaluationRequest };

export const GI088_ADAPTIVE_RECOVERY_REVIEW_TOOL_VERSION =
  "2026-08-12.gi088-adaptive-recovery-review-v1" as const;
export const GI088_ADAPTIVE_RECOVERY_REVIEW_STAGE =
  "adaptive-recovery" as const;

const OFFLINE_ROOT = resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-11-gi088-v8r3-offline"
);
const SOURCE_PACKET_PATH = resolve(
  OFFLINE_ROOT,
  "candidate-adaptive-recovery-30-60-v8r3r3.adaptive-review.json"
);
const SOURCE_KEY_PATH = resolve(
  OFFLINE_ROOT,
  "candidate-adaptive-recovery-30-60-v8r3r3.adaptive-review-key.json"
);
const PRIVATE_ROOT = resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-12-gi088-v8r3r3-adaptive-recovery-review"
);

type ReviewMessage = { role: "user" | "assistant"; content: string };

type SourcePacketItem = {
  reviewIndex: number;
  reviewId: string;
  reviewItemFingerprint: string;
  workingTask: string;
  visibleConversation: ReviewMessage[];
  candidateVisibleOutput: {
    action: "ask" | "acknowledge" | "synthesize" | "pause";
    understanding: string | null;
    response: string;
  };
};

type SourcePacket = {
  packetVersion: "2026-08-12.gi088-v8r3r3-adaptive-recovery-review-packet-v1";
  packetFingerprint: string;
  candidateOfflineRunFingerprint: string;
  candidateEvidenceFingerprint: string;
  datasetFingerprint: string;
  reviewStatus: "pending" | "not_observed";
  modelIdentityVisibleToReviewer: false;
  recoveryMechanicsVisibleToReviewer: false;
  privacy: Record<string, string | boolean>;
  items: SourcePacketItem[];
};

type SourceKeyItem = {
  reviewId: string;
  reviewItemFingerprint: string;
  caseId: string;
  attempt: 1 | 2;
  partition: "development" | "hidden_admission";
  checkpointIndex: number;
  winnerRole: "high_correction" | "fast_formatter";
  accelerationTrigger: string | null;
  providerCallCount: number;
  submitToVisibleLatencyMs: number;
};

type SourceKey = {
  keyVersion: "2026-08-12.gi088-v8r3r3-adaptive-recovery-review-key-v1";
  keyFingerprint: string;
  candidateOfflineRunFingerprint: string;
  candidateEvidenceFingerprint: string;
  datasetFingerprint: string;
  items: SourceKeyItem[];
};

export type Gi088AdaptiveRecoveryReviewCard = {
  publicId: string;
  label: string;
  workingTask: string;
  messages: ReviewMessage[];
  candidate: {
    understanding: string | null;
    response: string;
  };
  contentSha256: string;
};

export type Gi088AdaptiveRecoveryDecisionV1 = {
  publicId: string;
  verdict: Gi088EmptyRecoveryVerdict;
  failureCategory: Gi088EmptyRecoveryFailureCategory | null;
  reason: string;
  singleCaseBlocker: boolean;
  reviewer: "product_owner";
  updatedAt: string;
};

export type Gi088AdaptiveRecoveryReceiptV1 = {
  schemaVersion: "1.0";
  toolVersion: typeof GI088_ADAPTIVE_RECOVERY_REVIEW_TOOL_VERSION;
  stage: typeof GI088_ADAPTIVE_RECOVERY_REVIEW_STAGE;
  status: "sealed";
  reviewCount: number;
  decisionCount: number;
  sourcePacketSha256: string;
  sourceKeySha256: string;
  toolSourceSha256: string;
  bundleSha256: string;
  decisionsSha256: string;
  candidateOfflineRunFingerprint: string;
  candidateEvidenceFingerprint: string;
  datasetFingerprint: string;
  verdicts: Record<Gi088EmptyRecoveryVerdict, number>;
  singleCaseBlockerCount: number;
  gate: {
    status: "passed" | "failed" | "not_observed";
    passed: boolean;
    qualityEvidenceObserved: boolean;
    requiredDirectUseRateMinimum: 0.8;
    allowedMinorIssueRateMaximum: 0.2;
    allowedQualityFailureMaximum: 0;
    allowedSingleCaseBlockerMaximum: 0;
  };
  revealedRecoveryDistribution: {
    highCorrectionWinnerCount: number;
    fastFormatterWinnerCount: number;
    hiddenAdmissionSampleCount: number;
    visibleLatencyP50Ms: number | null;
    visibleLatencyP90Ms: number | null;
    visibleLatencyMaxMs: number | null;
  };
  reviewer: "product_owner";
  finalizedAt: string;
  modelCalls: 0;
  databaseWrites: 0;
  externalUploads: 0;
};

export type Gi088AdaptiveRecoveryReviewBundleV1 = {
  schemaVersion: "1.0";
  toolVersion: typeof GI088_ADAPTIVE_RECOVERY_REVIEW_TOOL_VERSION;
  stage: typeof GI088_ADAPTIVE_RECOVERY_REVIEW_STAGE;
  sourcePacketSha256: string;
  toolSourceSha256: string;
  bundleSha256: string;
  cards: Gi088AdaptiveRecoveryReviewCard[];
  decisions: Gi088AdaptiveRecoveryDecisionV1[];
  receipt: Gi088AdaptiveRecoveryReceiptV1 | null;
};

type ReviewPaths = {
  privateRoot: string;
  decisionsPath: string;
  receiptPath: string;
};

const TOOL_SOURCE_PATHS = [
  "scripts/run-gi088-v8r3r3-adaptive-review.ts",
  "src/app/admin/journal-evaluation/adaptive-recovery/page.tsx",
  "src/app/admin/journal-evaluation/adaptive-recovery-review-loader.ts",
  "src/components/journal-evaluation/adaptive-recovery-review-workbench.tsx",
  "src/app/api/local/gi088-v8r3/adaptive-recovery-review/session/route.ts",
  "src/app/api/local/gi088-v8r3/adaptive-recovery-review/draft/route.ts",
  "src/app/api/local/gi088-v8r3/adaptive-recovery-review/finalize/route.ts"
] as const;

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function computeToolSourceSha256() {
  const entries = await Promise.all(TOOL_SOURCE_PATHS.map(async (path) => ({
    path,
    sha256: sha256(await readFile(resolve(process.cwd(), path)))
  })));
  return sha256(stableJson(entries));
}

async function assertPrivateFile(path: string) {
  const metadata = await stat(path);
  if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) {
    throw new Error("GI088_ADAPTIVE_RECOVERY_PRIVATE_FILE_INVALID");
  }
}

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function validHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function assertSourcePair(packet: unknown, key: unknown): asserts packet is SourcePacket {
  if (!packet || typeof packet !== "object" || !key || typeof key !== "object") {
    throw new Error("GI088_ADAPTIVE_RECOVERY_REVIEW_SOURCE_INVALID");
  }
  const source = packet as SourcePacket;
  const sealed = key as SourceKey;
  const { packetFingerprint, ...packetPayload } = source;
  const { keyFingerprint, ...keyPayload } = sealed;
  if (
    source.packetVersion !==
      "2026-08-12.gi088-v8r3r3-adaptive-recovery-review-packet-v1" ||
    sealed.keyVersion !==
      "2026-08-12.gi088-v8r3r3-adaptive-recovery-review-key-v1" ||
    !validHash(packetFingerprint) ||
    packetFingerprint !== sha256(JSON.stringify(packetPayload)) ||
    !validHash(keyFingerprint) ||
    keyFingerprint !== sha256(JSON.stringify(keyPayload)) ||
    !validHash(source.candidateOfflineRunFingerprint) ||
    !validHash(source.candidateEvidenceFingerprint) ||
    !validHash(source.datasetFingerprint) ||
    source.candidateOfflineRunFingerprint !== sealed.candidateOfflineRunFingerprint ||
    source.candidateEvidenceFingerprint !== sealed.candidateEvidenceFingerprint ||
    source.datasetFingerprint !== sealed.datasetFingerprint ||
    source.modelIdentityVisibleToReviewer !== false ||
    source.recoveryMechanicsVisibleToReviewer !== false ||
    !Array.isArray(source.items) ||
    !Array.isArray(sealed.items) ||
    source.items.length !== sealed.items.length ||
    source.items.length > 96 ||
    source.reviewStatus !== (source.items.length === 0 ? "not_observed" : "pending")
  ) {
    throw new Error("GI088_ADAPTIVE_RECOVERY_REVIEW_SOURCE_MISMATCH");
  }
  const keys = new Map(sealed.items.map((item) => [item.reviewId, item]));
  if (
    keys.size !== sealed.items.length ||
    new Set(source.items.map((item) => item.reviewId)).size !== source.items.length ||
    source.items.some((item, index) => {
      const sourceKey = keys.get(item.reviewId);
      const content = {
        workingTask: item.workingTask,
        visibleConversation: item.visibleConversation,
        candidateVisibleOutput: item.candidateVisibleOutput
      };
      return item.reviewIndex !== index + 1 ||
        !/^[a-f0-9]{20}$/u.test(item.reviewId) ||
        item.reviewItemFingerprint !== sha256(JSON.stringify(content)) ||
        sourceKey?.reviewItemFingerprint !== item.reviewItemFingerprint ||
        !["high_correction", "fast_formatter"].includes(sourceKey?.winnerRole ?? "") ||
        !Number.isFinite(sourceKey?.submitToVisibleLatencyMs);
    })
  ) {
    throw new Error("GI088_ADAPTIVE_RECOVERY_REVIEW_ITEM_MISMATCH");
  }
}

function validateDecision(input: {
  verdict: Gi088EmptyRecoveryVerdict;
  failureCategory: Gi088EmptyRecoveryFailureCategory | null;
  reason: string;
  singleCaseBlocker: boolean;
}) {
  const categories: Array<Gi088EmptyRecoveryFailureCategory> = [
    "reasks_answered_content",
    "working_task_drift",
    "unsupported_third_party_inference",
    "low_information_gain",
    "answer_burden",
    "contract_or_data"
  ];
  const reason = input.reason.trim();
  if (input.verdict === "ready_to_use") {
    if (input.failureCategory !== null || input.singleCaseBlocker) {
      throw new Error("GI088_ADAPTIVE_RECOVERY_READY_DECISION_INVALID");
    }
    return "";
  }
  if (
    !["minor_issue", "quality_failure"].includes(input.verdict) ||
    !input.failureCategory ||
    !categories.includes(input.failureCategory) ||
    reason.length < 8 ||
    reason.length > 300 ||
    (input.verdict !== "quality_failure" && input.singleCaseBlocker)
  ) {
    throw new Error("GI088_ADAPTIVE_RECOVERY_DECISION_INVALID");
  }
  return reason;
}

async function atomicWrite(path: string, value: unknown, paths: ReviewPaths) {
  await mkdir(paths.privateRoot, { recursive: true, mode: 0o700 });
  const temporaryPath = resolve(
    paths.privateRoot,
    `.${path.split("/").at(-1)}.${process.pid}.${Date.now()}.tmp`
  );
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
}

function percentile(values: number[], value: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * value) - 1)] ?? null;
}

export function createGi088AdaptiveRecoveryReviewService(input?: {
  packetPath?: string;
  keyPath?: string;
  privateRoot?: string;
  now?: () => string;
  toolSourceSha256?: string;
}) {
  const packetPath = input?.packetPath ?? SOURCE_PACKET_PATH;
  const keyPath = input?.keyPath ?? SOURCE_KEY_PATH;
  const privateRoot = input?.privateRoot ?? PRIVATE_ROOT;
  const paths: ReviewPaths = {
    privateRoot,
    decisionsPath: resolve(privateRoot, "decisions.json"),
    receiptPath: resolve(privateRoot, "receipt.json")
  };
  const now = input?.now ?? (() => new Date().toISOString());
  const toolSource = input?.toolSourceSha256
    ? async () => input.toolSourceSha256!
    : computeToolSourceSha256;

  async function source() {
    await Promise.all([assertPrivateFile(packetPath), assertPrivateFile(keyPath)]);
    const [packetRaw, keyRaw] = await Promise.all([
      readFile(packetPath),
      readFile(keyPath)
    ]);
    const packet = JSON.parse(packetRaw.toString("utf8")) as unknown;
    const key = JSON.parse(keyRaw.toString("utf8")) as unknown;
    assertSourcePair(packet, key);
    return {
      packet,
      key: key as SourceKey,
      packetSha256: sha256(packetRaw),
      keySha256: sha256(keyRaw)
    };
  }

  async function readDecisions() {
    try {
      const value = await readJson(paths.decisionsPath);
      if (!Array.isArray(value)) throw new Error("GI088_ADAPTIVE_RECOVERY_DECISIONS_INVALID");
      return value as Gi088AdaptiveRecoveryDecisionV1[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async function readReceipt() {
    try {
      return await readJson(paths.receiptPath) as Gi088AdaptiveRecoveryReceiptV1;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async function load(): Promise<Gi088AdaptiveRecoveryReviewBundleV1> {
    assertLocalJournalEvaluationEnvironment();
    const sources = await source();
    const cards = sources.packet.items.map((item) => ({
      publicId: item.reviewId,
      label: `恢复样本 ${String(item.reviewIndex).padStart(2, "0")}`,
      workingTask: item.workingTask,
      messages: item.visibleConversation,
      candidate: {
        understanding: item.candidateVisibleOutput.understanding,
        response: item.candidateVisibleOutput.response
      },
      contentSha256: item.reviewItemFingerprint
    }));
    const toolSourceSha256 = await toolSource();
    const bundleSha256 = sha256(stableJson({
      toolVersion: GI088_ADAPTIVE_RECOVERY_REVIEW_TOOL_VERSION,
      stage: GI088_ADAPTIVE_RECOVERY_REVIEW_STAGE,
      sourcePacketSha256: sources.packetSha256,
      sourceKeySha256: sources.keySha256,
      toolSourceSha256,
      candidateOfflineRunFingerprint:
        sources.packet.candidateOfflineRunFingerprint,
      candidateEvidenceFingerprint: sources.packet.candidateEvidenceFingerprint,
      datasetFingerprint: sources.packet.datasetFingerprint,
      cards
    }));
    const decisions = await readDecisions();
    const cardIds = new Set(cards.map((card) => card.publicId));
    if (
      new Set(decisions.map((decision) => decision.publicId)).size !== decisions.length ||
      decisions.some((decision) =>
        !cardIds.has(decision.publicId) ||
        decision.reviewer !== "product_owner" ||
        !Number.isFinite(Date.parse(decision.updatedAt))
      )
    ) {
      throw new Error("GI088_ADAPTIVE_RECOVERY_DECISIONS_INVALID");
    }
    decisions.forEach(validateDecision);
    const receipt = await readReceipt();
    const decisionsSha256 = sha256(stableJson(decisions));
    if (
      receipt &&
      (receipt.sourcePacketSha256 !== sources.packetSha256 ||
        receipt.sourceKeySha256 !== sources.keySha256 ||
        receipt.toolSourceSha256 !== toolSourceSha256 ||
        receipt.bundleSha256 !== bundleSha256 ||
        receipt.decisionsSha256 !== decisionsSha256)
    ) {
      throw new Error("GI088_ADAPTIVE_RECOVERY_RECEIPT_IMMUTABLE");
    }
    return {
      schemaVersion: "1.0",
      toolVersion: GI088_ADAPTIVE_RECOVERY_REVIEW_TOOL_VERSION,
      stage: GI088_ADAPTIVE_RECOVERY_REVIEW_STAGE,
      sourcePacketSha256: sources.packetSha256,
      toolSourceSha256,
      bundleSha256,
      cards,
      decisions,
      receipt
    };
  }

  async function saveDecision(inputDecision: {
    publicId: string;
    verdict: Gi088EmptyRecoveryVerdict;
    failureCategory: Gi088EmptyRecoveryFailureCategory | null;
    reason: string;
    singleCaseBlocker: boolean;
  }) {
    const review = await load();
    if (review.receipt) throw new Error("GI088_ADAPTIVE_RECOVERY_RECEIPT_IMMUTABLE");
    if (!review.cards.some((card) => card.publicId === inputDecision.publicId)) {
      throw new Error("GI088_ADAPTIVE_RECOVERY_CASE_NOT_FOUND");
    }
    const reason = validateDecision(inputDecision);
    const decision: Gi088AdaptiveRecoveryDecisionV1 = {
      ...inputDecision,
      reason,
      reviewer: "product_owner",
      updatedAt: now()
    };
    const decisions = review.decisions.filter(
      (item) => item.publicId !== decision.publicId
    );
    decisions.push(decision);
    decisions.sort((left, right) => left.publicId.localeCompare(right.publicId));
    await atomicWrite(paths.decisionsPath, decisions, paths);
    return { ...review, decisions };
  }

  async function finalize(): Promise<Gi088AdaptiveRecoveryReceiptV1> {
    const review = await load();
    if (review.decisions.length !== review.cards.length) {
      throw new Error("GI088_ADAPTIVE_RECOVERY_REVIEW_INCOMPLETE");
    }
    const sources = await source();
    const decisionsSha256 = sha256(stableJson(review.decisions));
    if (review.receipt) return review.receipt;
    const verdicts: Record<Gi088EmptyRecoveryVerdict, number> = {
      ready_to_use: 0,
      minor_issue: 0,
      quality_failure: 0
    };
    review.decisions.forEach((decision) => {
      validateDecision(decision);
      verdicts[decision.verdict] += 1;
    });
    const singleCaseBlockerCount = review.decisions.filter(
      (decision) => decision.singleCaseBlocker
    ).length;
    const observed = review.cards.length > 0;
    const directRate = observed
      ? verdicts.ready_to_use / review.cards.length
      : null;
    const minorRate = observed
      ? verdicts.minor_issue / review.cards.length
      : null;
    const passed = !observed || (
      (directRate ?? 0) >= 0.8 &&
      (minorRate ?? 1) <= 0.2 &&
      verdicts.quality_failure === 0 &&
      singleCaseBlockerCount === 0
    );
    const latencies = sources.key.items.map(
      (item) => item.submitToVisibleLatencyMs
    );
    const receipt: Gi088AdaptiveRecoveryReceiptV1 = {
      schemaVersion: "1.0",
      toolVersion: GI088_ADAPTIVE_RECOVERY_REVIEW_TOOL_VERSION,
      stage: GI088_ADAPTIVE_RECOVERY_REVIEW_STAGE,
      status: "sealed",
      reviewCount: review.cards.length,
      decisionCount: review.decisions.length,
      sourcePacketSha256: sources.packetSha256,
      sourceKeySha256: sources.keySha256,
      toolSourceSha256: review.toolSourceSha256,
      bundleSha256: review.bundleSha256,
      decisionsSha256,
      candidateOfflineRunFingerprint:
        sources.packet.candidateOfflineRunFingerprint,
      candidateEvidenceFingerprint: sources.packet.candidateEvidenceFingerprint,
      datasetFingerprint: sources.packet.datasetFingerprint,
      verdicts,
      singleCaseBlockerCount,
      gate: {
        status: observed ? (passed ? "passed" : "failed") : "not_observed",
        passed,
        qualityEvidenceObserved: observed,
        requiredDirectUseRateMinimum: 0.8,
        allowedMinorIssueRateMaximum: 0.2,
        allowedQualityFailureMaximum: 0,
        allowedSingleCaseBlockerMaximum: 0
      },
      revealedRecoveryDistribution: {
        highCorrectionWinnerCount: sources.key.items.filter(
          (item) => item.winnerRole === "high_correction"
        ).length,
        fastFormatterWinnerCount: sources.key.items.filter(
          (item) => item.winnerRole === "fast_formatter"
        ).length,
        hiddenAdmissionSampleCount: sources.key.items.filter(
          (item) => item.partition === "hidden_admission"
        ).length,
        visibleLatencyP50Ms: percentile(latencies, 0.5),
        visibleLatencyP90Ms: percentile(latencies, 0.9),
        visibleLatencyMaxMs:
          latencies.length > 0 ? Math.max(...latencies) : null
      },
      reviewer: "product_owner",
      finalizedAt: now(),
      modelCalls: 0,
      databaseWrites: 0,
      externalUploads: 0
    };
    await atomicWrite(paths.receiptPath, receipt, paths);
    return receipt;
  }

  return { load, saveDecision, finalize };
}

const service = createGi088AdaptiveRecoveryReviewService();

export const loadGi088AdaptiveRecoveryReview = service.load;
export const saveGi088AdaptiveRecoveryDecision = service.saveDecision;
export const finalizeGi088AdaptiveRecoveryReview = service.finalize;

export function gi088AdaptiveRecoveryReviewPrivateRoot() {
  return PRIVATE_ROOT;
}
