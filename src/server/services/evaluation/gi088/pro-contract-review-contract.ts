import { createHash } from "node:crypto";
import { resolve } from "node:path";

export const GI088_PRO_CONTRACT_EXPERIMENT_VERSION =
  "2026-08-12.gi088-pro-contract-projection-paired-v1" as const;

export const GI088_PRO_CONTRACT_DEVELOPMENT_STAGE =
  "pro-contract-development-paired" as const;
export const GI088_PRO_CONTRACT_HIDDEN_STAGE =
  "pro-contract-hidden-admission" as const;

export type Gi088ProContractReviewStage =
  | typeof GI088_PRO_CONTRACT_DEVELOPMENT_STAGE
  | typeof GI088_PRO_CONTRACT_HIDDEN_STAGE;

export type Gi088ProContractGroup = "full" | "compact";

export type Gi088ProContractReviewMessage = {
  role: "user" | "assistant";
  content: string;
};

export type Gi088ProContractReviewVisibleOutput = {
  understanding: string | null;
  response: string;
};

export type Gi088ProContractBlindCandidate = {
  blindId: string;
  available: boolean;
  messages: Gi088ProContractReviewMessage[];
  visible: Gi088ProContractReviewVisibleOutput;
  requestHash: string;
  contentHash: string;
};

export type Gi088ProContractDevelopmentReviewCard = {
  cardId: string;
  caseId: string;
  checkpointIndex: number;
  attempt: 1 | 2;
  workingTask: string;
  messages: Gi088ProContractReviewMessage[];
  sourceFingerprint: string;
  left: Gi088ProContractBlindCandidate;
  right: Gi088ProContractBlindCandidate;
};

export type Gi088ProContractTechnicalSummary = {
  group: Gi088ProContractGroup;
  resultCount: 64;
  providerCallCount: number;
  programOwnedStopCount?: number;
  firstValidCount: number;
  blockedByPriorFailureCount: number;
  categorizedFailureCount: number;
  projectionAmbiguityCount: number;
  stateInvariantFailureCount: number;
  duplicateCommitCount: number;
  statePollutionCount: number;
  latency: {
    p50Ms: number | null;
    p90Ms: number | null;
    maxMs: number | null;
  };
  latencySampleCount: number;
  tokenUsageSampleCount: number;
  totalTokens: number;
};

export type Gi088ProContractSealedGroupIdentity = {
  group: Gi088ProContractGroup;
  provider: string;
  baseUrlHost: string;
  endpoint: string;
  model: string;
  thinking: "high";
  responseFormat: "json_object";
  contractVersion: string;
  projectionPolicyVersion: string | null;
};

export type Gi088ProContractDevelopmentReviewSourceV1 = {
  schemaVersion: "1.0";
  experimentVersion: typeof GI088_PRO_CONTRACT_EXPERIMENT_VERSION;
  stage: typeof GI088_PRO_CONTRACT_DEVELOPMENT_STAGE;
  runnerReportFingerprint: string;
  runnerReportSha256: string;
  sourceFingerprint: string;
  cards: Gi088ProContractDevelopmentReviewCard[];
  technicalSummaries: [
    Gi088ProContractTechnicalSummary,
    Gi088ProContractTechnicalSummary
  ];
  sealedReveal: {
    candidates: Array<{
      cardId: string;
      blindId: string;
      group: Gi088ProContractGroup;
    }>;
    identities: [
      Gi088ProContractSealedGroupIdentity,
      Gi088ProContractSealedGroupIdentity
    ];
  };
};

export type Gi088ProContractHiddenReviewCard = {
  cardId: string;
  caseId: string;
  checkpointIndex: number;
  attempt: 1 | 2;
  workingTask: string;
  messages: Gi088ProContractReviewMessage[];
  sourceFingerprint: string;
  candidate: Gi088ProContractBlindCandidate;
};

export type Gi088ProContractHiddenReviewSourceV1 = {
  schemaVersion: "1.0";
  experimentVersion: typeof GI088_PRO_CONTRACT_EXPERIMENT_VERSION;
  stage: typeof GI088_PRO_CONTRACT_HIDDEN_STAGE;
  runnerReportFingerprint: string;
  runnerReportSha256: string;
  developmentReceiptSha256: string;
  sourceFingerprint: string;
  cards: Gi088ProContractHiddenReviewCard[];
  technicalSummary: Omit<Gi088ProContractTechnicalSummary, "resultCount"> & {
    resultCount: 32;
  };
  sealedReveal: {
    winner: Gi088ProContractSealedGroupIdentity;
  };
};

export const GI088_PRO_CONTRACT_PRIVATE_ROOT = resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-12-gi088-pro-contract-projection-ab"
);
export const GI088_PRO_CONTRACT_DEVELOPMENT_REVIEW_SOURCE_PATH = resolve(
  GI088_PRO_CONTRACT_PRIVATE_ROOT,
  "development-review-source.json"
);
export const GI088_PRO_CONTRACT_DEVELOPMENT_PRIVATE_REPORT_PATH = resolve(
  GI088_PRO_CONTRACT_PRIVATE_ROOT,
  "development-private-report.json"
);
export const GI088_PRO_CONTRACT_HIDDEN_REVIEW_SOURCE_PATH = resolve(
  GI088_PRO_CONTRACT_PRIVATE_ROOT,
  "hidden-review-source.json"
);
export const GI088_PRO_CONTRACT_HIDDEN_PRIVATE_REPORT_PATH = resolve(
  GI088_PRO_CONTRACT_PRIVATE_ROOT,
  "hidden-private-report.json"
);

export function gi088ProContractStableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => item === undefined || typeof item === "function" ||
      typeof item === "symbol" ? "null" : gi088ProContractStableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined && typeof item !== "function" &&
        typeof item !== "symbol")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${gi088ProContractStableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function gi088ProContractSha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function computeGi088ProContractReviewSourceFingerprint(
  source: Gi088ProContractDevelopmentReviewSourceV1 | Gi088ProContractHiddenReviewSourceV1
): string {
  const payload = Object.fromEntries(
    Object.entries(source).filter(([key]) => key !== "sourceFingerprint")
  );
  return gi088ProContractSha256(gi088ProContractStableJson(payload));
}
