export const GI088_V8R3_REVIEW_TOOL_VERSION =
  "2026-08-11.gi088-v8r3-review-workbench-v1" as const;

export type Gi088ReviewStage = "candidate" | "golden_a" | "golden_b";

export type Gi088ReviewFailureCategory =
  | "none"
  | "reask_answered_content"
  | "working_task_drift"
  | "unsupported_third_party_inference"
  | "low_information_gain"
  | "answer_burden"
  | "contract_or_data";

export type Gi088ReviewVerdict =
  | "direct_use"
  | "minor_issue"
  | "quality_failure"
  | "uncertain";

export type Gi088ReviewEntry = {
  verdict: Gi088ReviewVerdict;
  category: Gi088ReviewFailureCategory;
  blocker: boolean;
  reason: string;
  reviewedAt: string;
};

export type Gi088ReviewVisibleMessage = {
  role: "user" | "assistant";
  content: string;
};

export type Gi088ReviewCheckpoint = {
  checkpointIndex?: number;
  visibleConversation: Gi088ReviewVisibleMessage[];
  candidateVisibleOutput: {
    action: string;
    understanding: string | null;
    response: string;
  } | null;
  safeTrace: Record<string, unknown>;
};

export type Gi088CandidateReviewItem = {
  reviewId: string;
  reviewItemFingerprint: string;
  workingTask: string;
  checkpoints: Gi088ReviewCheckpoint[];
};

export type Gi088GoldenReviewItem = {
  sampleId: string;
  sourcePartition: "golden_calibration";
  contentFingerprint: string;
  workingTask?: string;
  checkpoints: Gi088ReviewCheckpoint[];
};

export type Gi088ReviewBundleV1 = {
  version: "2026-08-11.gi088-v8r3-review-bundle-v1";
  toolVersion: typeof GI088_V8R3_REVIEW_TOOL_VERSION;
  toolSourceSha256: string;
  candidateOfflineRunFingerprint: string;
  candidateEvidenceFingerprint: string;
  datasetFingerprint: string;
  candidateItems: Gi088CandidateReviewItem[];
  goldenRounds: readonly {
    roundId: "golden-a" | "golden-b";
    items: Gi088GoldenReviewItem[];
  }[];
  order: {
    candidate: string[];
    goldenA: string[];
    goldenB: string[];
  };
  bundleFingerprint: string;
};

export type Gi088ReviewDraftV1 = {
  version: "2026-08-11.gi088-v8r3-review-draft-v1";
  toolVersion: typeof GI088_V8R3_REVIEW_TOOL_VERSION;
  bundleFingerprint: string;
  currentStage: Gi088ReviewStage;
  currentItemId: string;
  entries: Record<string, Gi088ReviewEntry>;
  createdAt: string;
  savedAt: string;
};

type ReviewAccessInput = {
  nodeEnv: string | undefined;
  host: string | null;
  forwardedHost: string | null;
  vercelEnv: string | undefined;
  mode: string | undefined;
  configuredToken: string | undefined;
  providedToken: string | undefined;
};

const LOCAL_HOST_PATTERN = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?$/u;

export function canOpenGi088V8r3ReviewWorkbench(
  input: ReviewAccessInput
): boolean {
  if (
    input.nodeEnv === "production" ||
    input.vercelEnv !== undefined ||
    input.mode !== "I_UNDERSTAND_LOCAL_PRIVATE_REVIEW" ||
    !input.configuredToken ||
    input.providedToken !== input.configuredToken
  ) {
    return false;
  }
  const host = input.host?.trim().toLowerCase() ?? "";
  const forwardedHost = input.forwardedHost?.trim().toLowerCase() ?? "";
  return (
    LOCAL_HOST_PATTERN.test(host) &&
    (forwardedHost.length === 0 || LOCAL_HOST_PATTERN.test(forwardedHost))
  );
}

export function createGi088V8r3InitialReviewDraft(
  bundle: Gi088ReviewBundleV1,
  now = new Date().toISOString()
): Gi088ReviewDraftV1 {
  const firstItemId = bundle.order.candidate[0];
  if (!firstItemId) {
    throw new Error("GI088_REVIEW_CANDIDATE_QUEUE_EMPTY");
  }
  return {
    version: "2026-08-11.gi088-v8r3-review-draft-v1",
    toolVersion: GI088_V8R3_REVIEW_TOOL_VERSION,
    bundleFingerprint: bundle.bundleFingerprint,
    currentStage: "candidate",
    currentItemId: firstItemId,
    entries: {},
    createdAt: now,
    savedAt: now
  };
}

export function mapGi088CandidateReviewResult(entry: Pick<
  Gi088ReviewEntry,
  "verdict" | "category" | "blocker" | "reason"
>) {
  switch (entry.verdict) {
    case "direct_use":
      return {
        outcome: "pass" as const,
        quality: "direct_use" as const,
        singleCaseBlocker: false,
        primaryFailureCategory: "none" as const
      };
    case "minor_issue":
      return {
        outcome: "pass" as const,
        quality: "minor_issue" as const,
        singleCaseBlocker: false,
        primaryFailureCategory: entry.category
      };
    case "quality_failure":
      return {
        outcome: "fail" as const,
        quality: "quality_failure" as const,
        singleCaseBlocker: entry.blocker,
        primaryFailureCategory: entry.category
      };
    case "uncertain":
      return {
        outcome: "uncertain" as const,
        quality: "quality_failure" as const,
        singleCaseBlocker: false,
        primaryFailureCategory: entry.category
      };
  }
}

function visibleReasonLength(reason: string) {
  return Array.from(reason.trim()).length;
}

export function reviewEntryIsComplete(
  entry: Gi088ReviewEntry | undefined,
  stage: Gi088ReviewStage
): boolean {
  if (!entry || Number.isNaN(Date.parse(entry.reviewedAt))) {
    return false;
  }
  if (entry.verdict === "direct_use") {
    return entry.category === "none" && !entry.blocker;
  }
  if (stage !== "candidate" && entry.verdict === "uncertain") {
    return false;
  }
  const reasonLength = visibleReasonLength(entry.reason);
  return (
    entry.category !== "none" &&
    reasonLength >= 8 &&
    reasonLength <= 300 &&
    (!entry.blocker || entry.verdict === "quality_failure")
  );
}

export function summarizeGi088V8r3ReviewDraft(
  draft: Gi088ReviewDraftV1,
  bundle: Gi088ReviewBundleV1
) {
  const count = (ids: string[], stage: Gi088ReviewStage) =>
    ids.filter((id) => reviewEntryIsComplete(draft.entries[id], stage)).length;
  return {
    candidate: {
      completed: count(bundle.order.candidate, "candidate"),
      total: bundle.order.candidate.length
    },
    goldenA: {
      completed: count(bundle.order.goldenA, "golden_a"),
      total: bundle.order.goldenA.length
    },
    goldenB: {
      completed: count(bundle.order.goldenB, "golden_b"),
      total: bundle.order.goldenB.length
    }
  };
}

export function validateGi088V8r3FinalReview(
  draft: Gi088ReviewDraftV1,
  bundle: Gi088ReviewBundleV1
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (draft.bundleFingerprint !== bundle.bundleFingerprint) {
    issues.push("GI088_REVIEW_BUNDLE_FINGERPRINT_MISMATCH");
  }
  const stages: Array<[Gi088ReviewStage, string[], number]> = [
    ["candidate", bundle.order.candidate, 80],
    ["golden_a", bundle.order.goldenA, 20],
    ["golden_b", bundle.order.goldenB, 20]
  ];
  for (const [stage, ids, expected] of stages) {
    if (ids.length !== expected || new Set(ids).size !== expected) {
      issues.push(`GI088_REVIEW_${stage.toUpperCase()}_CARDINALITY_INVALID`);
      continue;
    }
    for (const id of ids) {
      if (!reviewEntryIsComplete(draft.entries[id], stage)) {
        issues.push(`GI088_REVIEW_ENTRY_INCOMPLETE:${stage}:${id}`);
      }
    }
  }
  const times = (ids: string[]) =>
    ids
      .map((id) => Date.parse(draft.entries[id]?.reviewedAt ?? ""))
      .filter((value) => Number.isFinite(value));
  const candidateTimes = times(bundle.order.candidate);
  const goldenATimes = times(bundle.order.goldenA);
  const goldenBTimes = times(bundle.order.goldenB);
  if (
    candidateTimes.length === 80 &&
    goldenATimes.length === 20 &&
    Math.max(...candidateTimes) > Math.min(...goldenATimes)
  ) {
    issues.push("GI088_REVIEW_GOLDEN_A_OPENED_BEFORE_CANDIDATE_COMPLETE");
  }
  if (
    goldenATimes.length === 20 &&
    goldenBTimes.length === 20 &&
    Math.max(...goldenATimes) >= Math.min(...goldenBTimes)
  ) {
    issues.push("GI088_REVIEW_GOLDEN_B_OPENED_BEFORE_GOLDEN_A_SEALED");
  }
  return { ok: issues.length === 0, issues };
}
