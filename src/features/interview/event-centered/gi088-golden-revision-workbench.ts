import type {
  Gi088GoldenReviewItem,
  Gi088ReviewEntry
} from "@/features/interview/event-centered/gi088-review-workbench";

export const GI088_V8R3_GOLDEN_REVISION_TOOL_VERSION =
  "2026-08-11.gi088-v8r3-golden-revision-workbench-v1" as const;

export const GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS = {
  goldenA: [
    "ad32bd47c838f5b21c21",
    "71019b39a3c9df4438e0",
    "a2d65e0d286a53c2e930"
  ],
  goldenB: [
    "82a60aa011cf10f4d7f3",
    "6cf63c06acd9f3c506df",
    "0531ff06e571750e1433",
    "973716c2abdb150af397",
    "edff7a14bf7b283fb83d"
  ]
} as const;

export type Gi088GoldenRevisionStage = "golden_a" | "golden_b";

export type Gi088GoldenReplacement = {
  replacesSampleId: string;
  item: Gi088GoldenReviewItem;
};

export type Gi088GoldenRevisionBundleV1 = {
  version: "2026-08-11.gi088-v8r3-golden-revision-bundle-v1";
  toolVersion: typeof GI088_V8R3_GOLDEN_REVISION_TOOL_VERSION;
  toolSourceSha256: string;
  parent: {
    receiptSha256: string;
    goldenSha256: string;
    bundleFingerprint: string;
  };
  replacementRounds: readonly [
    {
      roundId: "golden-a";
      items: Gi088GoldenReplacement[];
    },
    {
      roundId: "golden-b";
      items: Gi088GoldenReplacement[];
    }
  ];
  order: {
    goldenA: string[];
    goldenB: string[];
  };
  bundleFingerprint: string;
};

export type Gi088GoldenRevisionDraftV1 = {
  version: "2026-08-11.gi088-v8r3-golden-revision-draft-v1";
  toolVersion: typeof GI088_V8R3_GOLDEN_REVISION_TOOL_VERSION;
  bundleFingerprint: string;
  currentStage: Gi088GoldenRevisionStage;
  currentItemId: string;
  entries: Record<string, Gi088ReviewEntry>;
  createdAt: string;
  savedAt: string;
};

export function createGi088V8r3InitialGoldenRevisionDraft(
  bundle: Gi088GoldenRevisionBundleV1,
  now = new Date().toISOString()
): Gi088GoldenRevisionDraftV1 {
  const firstItemId = bundle.order.goldenA[0];
  if (!firstItemId) throw new Error("GI088_GOLDEN_REVISION_QUEUE_EMPTY");
  return {
    version: "2026-08-11.gi088-v8r3-golden-revision-draft-v1",
    toolVersion: GI088_V8R3_GOLDEN_REVISION_TOOL_VERSION,
    bundleFingerprint: bundle.bundleFingerprint,
    currentStage: "golden_a",
    currentItemId: firstItemId,
    entries: {},
    createdAt: now,
    savedAt: now
  };
}

function visibleReasonLength(reason: string) {
  return Array.from(reason.trim()).length;
}

export function gi088GoldenRevisionEntryIsComplete(
  entry: Gi088ReviewEntry | undefined
): boolean {
  if (!entry || Number.isNaN(Date.parse(entry.reviewedAt))) return false;
  if (entry.verdict === "direct_use") {
    return entry.category === "none" && !entry.blocker;
  }
  if (entry.verdict === "uncertain") return false;
  const reasonLength = visibleReasonLength(entry.reason);
  return (
    entry.category !== "none" &&
    reasonLength >= 8 &&
    reasonLength <= 300 &&
    (!entry.blocker || entry.verdict === "quality_failure")
  );
}

export function summarizeGi088V8r3GoldenRevision(
  draft: Gi088GoldenRevisionDraftV1,
  bundle: Gi088GoldenRevisionBundleV1
) {
  const count = (ids: string[]) =>
    ids.filter((id) => gi088GoldenRevisionEntryIsComplete(draft.entries[id]))
      .length;
  return {
    retained: 32,
    replacements: {
      completed: count([...bundle.order.goldenA, ...bundle.order.goldenB]),
      total: 8
    },
    goldenA: { completed: count(bundle.order.goldenA), total: 3 },
    goldenB: { completed: count(bundle.order.goldenB), total: 5 }
  };
}

export function validateGi088V8r3GoldenRevision(
  draft: Gi088GoldenRevisionDraftV1,
  bundle: Gi088GoldenRevisionBundleV1
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (draft.bundleFingerprint !== bundle.bundleFingerprint) {
    issues.push("GI088_GOLDEN_REVISION_BUNDLE_FINGERPRINT_MISMATCH");
  }
  const stages: Array<[string, string[], number]> = [
    ["GOLDEN_A", bundle.order.goldenA, 3],
    ["GOLDEN_B", bundle.order.goldenB, 5]
  ];
  for (const [stage, ids, expected] of stages) {
    if (ids.length !== expected || new Set(ids).size !== expected) {
      issues.push(`GI088_GOLDEN_REVISION_${stage}_CARDINALITY_INVALID`);
      continue;
    }
    for (const id of ids) {
      if (!gi088GoldenRevisionEntryIsComplete(draft.entries[id])) {
        issues.push(`GI088_GOLDEN_REVISION_ENTRY_INCOMPLETE:${stage}:${id}`);
      }
    }
  }
  const allowed = new Set([...bundle.order.goldenA, ...bundle.order.goldenB]);
  for (const id of Object.keys(draft.entries)) {
    if (!allowed.has(id)) {
      issues.push(`GI088_GOLDEN_REVISION_ENTRY_UNKNOWN:${id}`);
    }
  }
  const aTimes = bundle.order.goldenA.map((id) =>
    Date.parse(draft.entries[id]?.reviewedAt ?? "")
  );
  const bTimes = bundle.order.goldenB.map((id) =>
    Date.parse(draft.entries[id]?.reviewedAt ?? "")
  );
  if (
    aTimes.every(Number.isFinite) &&
    bTimes.every(Number.isFinite) &&
    Math.max(...aTimes) >= Math.min(...bTimes)
  ) {
    issues.push("GI088_GOLDEN_REVISION_ROUND_ORDER_INVALID");
  }
  return { ok: issues.length === 0, issues };
}

export function replacementForGi088GoldenRevisionItem(
  bundle: Gi088GoldenRevisionBundleV1,
  sampleId: string
) {
  return bundle.replacementRounds
    .flatMap((round) => round.items)
    .find((replacement) => replacement.item.sampleId === sampleId);
}
