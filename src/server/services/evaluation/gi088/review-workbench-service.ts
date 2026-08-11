import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, resolve, sep } from "node:path";

import {
  GI088_V8R3_REVIEW_TOOL_VERSION,
  mapGi088CandidateReviewResult,
  validateGi088V8r3FinalReview,
  type Gi088CandidateReviewItem,
  type Gi088GoldenReviewItem,
  type Gi088ReviewBundleV1,
  type Gi088ReviewDraftV1,
  type Gi088ReviewStage
} from "@/features/interview/event-centered/gi088-review-workbench";

export type Gi088CandidateReviewPacket = {
  packetVersion: string;
  candidateOfflineRunFingerprint: string;
  candidateEvidenceFingerprint: string;
  datasetFingerprint: string;
  items: Gi088CandidateReviewItem[];
};

export type Gi088ReviewReceiptV1 = {
  version: "2026-08-11.gi088-v8r3-review-receipt-v1";
  toolVersion: typeof GI088_V8R3_REVIEW_TOOL_VERSION;
  toolSourceSha256: string;
  bundleFingerprint: string;
  finalizedAt: string;
  completeness: {
    candidate: "80/80";
    goldenA: "20/20";
    goldenB: "20/20";
  };
  outputSha256: {
    adjudication: string;
    golden: string;
    reasons: string;
  };
};

const DEFAULT_FILES = {
  draft: "review-draft-v1.json",
  adjudication: "human-adjudication-v2.json",
  golden: "judge-golden-v2.json",
  reasons: "review-reasons-v1.json",
  receipt: "review-receipt-v1.json"
} as const;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function jsonBytes(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeAtomic(path: string, contents: string) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, contents, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, path);
}

function stableOrder(ids: string[], seed: string, scope: string) {
  return [...ids].sort((left, right) =>
    sha256(`${seed}:${scope}:${left}`).localeCompare(
      sha256(`${seed}:${scope}:${right}`)
    )
  );
}

function assertFingerprint(value: string, code: string) {
  if (!/^[a-f0-9]{64}$/u.test(value)) throw new Error(code);
}

function assertReviewBundleShape(bundle: Gi088ReviewBundleV1) {
  if (
    bundle.candidateItems.length !== 80 ||
    bundle.goldenRounds.length !== 2 ||
    bundle.goldenRounds[0]?.roundId !== "golden-a" ||
    bundle.goldenRounds[0].items.length !== 20 ||
    bundle.goldenRounds[1]?.roundId !== "golden-b" ||
    bundle.goldenRounds[1].items.length !== 20
  ) {
    throw new Error("GI088_REVIEW_BUNDLE_CARDINALITY_INVALID");
  }
  assertFingerprint(
    bundle.candidateOfflineRunFingerprint,
    "GI088_REVIEW_CANDIDATE_RUN_FINGERPRINT_INVALID"
  );
  assertFingerprint(
    bundle.candidateEvidenceFingerprint,
    "GI088_REVIEW_CANDIDATE_EVIDENCE_FINGERPRINT_INVALID"
  );
  assertFingerprint(
    bundle.datasetFingerprint,
    "GI088_REVIEW_DATASET_FINGERPRINT_INVALID"
  );
  assertFingerprint(
    bundle.toolSourceSha256,
    "GI088_REVIEW_TOOL_SOURCE_SHA_INVALID"
  );
}

export function createGi088V8r3ReviewBundle(input: {
  candidatePacket: Gi088CandidateReviewPacket;
  goldenA: Gi088GoldenReviewItem[];
  goldenB: Gi088GoldenReviewItem[];
  seed: string;
  toolSourceSha256: string;
}): Gi088ReviewBundleV1 {
  if (
    input.candidatePacket.items.length !== 80 ||
    input.goldenA.length !== 20 ||
    input.goldenB.length !== 20
  ) {
    throw new Error("GI088_REVIEW_BUNDLE_CARDINALITY_INVALID");
  }
  const payload = {
    version: "2026-08-11.gi088-v8r3-review-bundle-v1" as const,
    toolVersion: GI088_V8R3_REVIEW_TOOL_VERSION,
    toolSourceSha256: input.toolSourceSha256,
    candidateOfflineRunFingerprint:
      input.candidatePacket.candidateOfflineRunFingerprint,
    candidateEvidenceFingerprint:
      input.candidatePacket.candidateEvidenceFingerprint,
    datasetFingerprint: input.candidatePacket.datasetFingerprint,
    candidateItems: input.candidatePacket.items,
    goldenRounds: [
      { roundId: "golden-a" as const, items: input.goldenA },
      { roundId: "golden-b" as const, items: input.goldenB }
    ],
    order: {
      candidate: stableOrder(
        input.candidatePacket.items.map((item) => item.reviewId),
        input.seed,
        "candidate"
      ),
      goldenA: stableOrder(
        input.goldenA.map((item) => item.sampleId),
        input.seed,
        "golden-a"
      ),
      goldenB: stableOrder(
        input.goldenB.map((item) => item.sampleId),
        input.seed,
        "golden-b"
      )
    }
  };
  const bundle: Gi088ReviewBundleV1 = {
    ...payload,
    bundleFingerprint: sha256(JSON.stringify(payload))
  };
  assertReviewBundleShape(bundle);
  return bundle;
}

function resolvePrivateFile(root: string, name: string) {
  if (name !== basename(name) || name.includes("..") || name.includes("/") || name.includes("\\")) {
    throw new Error("GI088_REVIEW_PATH_OUTSIDE_PRIVATE_ROOT");
  }
  const absoluteRoot = resolve(root);
  const path = resolve(absoluteRoot, name);
  if (!path.startsWith(`${absoluteRoot}${sep}`)) {
    throw new Error("GI088_REVIEW_PATH_OUTSIDE_PRIVATE_ROOT");
  }
  return path;
}

function stageForId(bundle: Gi088ReviewBundleV1, id: string): Gi088ReviewStage {
  if (bundle.order.candidate.includes(id)) return "candidate";
  if (bundle.order.goldenA.includes(id)) return "golden_a";
  if (bundle.order.goldenB.includes(id)) return "golden_b";
  throw new Error(`GI088_REVIEW_ITEM_UNKNOWN:${id}`);
}

function assertDraftShape(
  value: Gi088ReviewDraftV1,
  bundle: Gi088ReviewBundleV1
) {
  if (
    !value ||
    value.version !== "2026-08-11.gi088-v8r3-review-draft-v1" ||
    value.toolVersion !== GI088_V8R3_REVIEW_TOOL_VERSION ||
    !["candidate", "golden_a", "golden_b"].includes(value.currentStage) ||
    Number.isNaN(Date.parse(value.createdAt)) ||
    Number.isNaN(Date.parse(value.savedAt)) ||
    !value.entries ||
    typeof value.entries !== "object" ||
    Array.isArray(value.entries)
  ) {
    throw new Error("GI088_REVIEW_DRAFT_INVALID");
  }
  const allowedIds = new Set([
    ...bundle.order.candidate,
    ...bundle.order.goldenA,
    ...bundle.order.goldenB
  ]);
  if (!allowedIds.has(value.currentItemId)) {
    throw new Error("GI088_REVIEW_CURRENT_ITEM_INVALID");
  }
  for (const [id, entry] of Object.entries(value.entries)) {
    if (
      !allowedIds.has(id) ||
      !entry ||
      ![
        "direct_use",
        "minor_issue",
        "quality_failure",
        "uncertain"
      ].includes(entry.verdict) ||
      ![
        "none",
        "reask_answered_content",
        "working_task_drift",
        "unsupported_third_party_inference",
        "low_information_gain",
        "answer_burden",
        "contract_or_data"
      ].includes(entry.category) ||
      typeof entry.blocker !== "boolean" ||
      typeof entry.reason !== "string" ||
      Array.from(entry.reason).length > 300 ||
      Number.isNaN(Date.parse(entry.reviewedAt))
    ) {
      throw new Error(`GI088_REVIEW_ENTRY_INVALID:${id}`);
    }
  }
}

function goldenLookup(bundle: Gi088ReviewBundleV1) {
  return new Map(
    bundle.goldenRounds.flatMap((round) =>
      round.items.map((item) => [item.sampleId, item] as const)
    )
  );
}

export function createGi088V8r3ReviewRepository(input: {
  root: string;
  bundle: Gi088ReviewBundleV1;
  fileNames?: Partial<Record<keyof typeof DEFAULT_FILES, string>>;
}) {
  assertReviewBundleShape(input.bundle);
  const names = { ...DEFAULT_FILES, ...input.fileNames };
  const paths = Object.fromEntries(
    Object.entries(names).map(([key, name]) => [
      key,
      resolvePrivateFile(input.root, name)
    ])
  ) as Record<keyof typeof DEFAULT_FILES, string>;

  async function saveDraft(draft: Gi088ReviewDraftV1) {
    assertDraftShape(draft, input.bundle);
    if (draft.bundleFingerprint !== input.bundle.bundleFingerprint) {
      throw new Error("GI088_REVIEW_BUNDLE_FINGERPRINT_MISMATCH");
    }
    stageForId(input.bundle, draft.currentItemId);
    await writeAtomic(paths.draft, jsonBytes(draft));
  }

  async function readDraft(): Promise<Gi088ReviewDraftV1 | null> {
    try {
      const parsed = JSON.parse(await readFile(paths.draft, "utf8")) as Gi088ReviewDraftV1;
      if (parsed.bundleFingerprint !== input.bundle.bundleFingerprint) {
        throw new Error("GI088_REVIEW_BUNDLE_FINGERPRINT_MISMATCH");
      }
      assertDraftShape(parsed, input.bundle);
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async function finalize(
    draft: Gi088ReviewDraftV1,
    now = new Date().toISOString()
  ): Promise<Gi088ReviewReceiptV1> {
    const validation = validateGi088V8r3FinalReview(draft, input.bundle);
    if (!validation.ok) {
      throw new Error(`GI088_REVIEW_INCOMPLETE:${validation.issues[0]}`);
    }
    const candidateById = new Map(
      input.bundle.candidateItems.map((item) => [item.reviewId, item] as const)
    );
    const goldenById = goldenLookup(input.bundle);
    const adjudication = {
      version: "2026-08-11.gi088-v8r3-human-adjudication-v2" as const,
      candidateOfflineRunFingerprint:
        input.bundle.candidateOfflineRunFingerprint,
      candidateEvidenceFingerprint: input.bundle.candidateEvidenceFingerprint,
      datasetFingerprint: input.bundle.datasetFingerprint,
      items: input.bundle.order.candidate.map((reviewId) => {
        const item = candidateById.get(reviewId);
        const entry = draft.entries[reviewId];
        if (!item || !entry) throw new Error("GI088_REVIEW_ENTRY_MISSING");
        return {
          reviewId,
          reviewItemFingerprint: item.reviewItemFingerprint,
          reviewer: {
            reviewerId: "product_owner_gi088_v8r3r1",
            source: "product_owner" as const,
            reviewedAt: entry.reviewedAt
          },
          result: mapGi088CandidateReviewResult(entry)
        };
      })
    };
    const buildGoldenRound = (
      roundId: "golden-a" | "golden-b",
      ids: string[]
    ) => ({
      roundId,
      items: ids.map((sampleId) => {
        const item = goldenById.get(sampleId);
        const entry = draft.entries[sampleId];
        if (!item || !entry) throw new Error("GI088_REVIEW_ENTRY_MISSING");
        return {
          sampleId: item.sampleId,
          sourcePartition: item.sourcePartition,
          contentFingerprint: item.contentFingerprint,
          checkpoints: item.checkpoints,
          humanReview: {
            pass: entry.verdict === "direct_use" || entry.verdict === "minor_issue",
            blocker: entry.verdict === "quality_failure" && entry.blocker,
            primaryFailureCategory: entry.category,
            reviewerId: "product_owner_gi088_v8r3r1",
            source: "product_owner" as const,
            reviewedAt: entry.reviewedAt
          }
        };
      })
    });
    const golden = {
      version: "2026-08-11.gi088-v8r3-judge-golden-v2" as const,
      rounds: [
        buildGoldenRound("golden-a", input.bundle.order.goldenA),
        buildGoldenRound("golden-b", input.bundle.order.goldenB)
      ]
    };
    const reasons = {
      version: "2026-08-11.gi088-v8r3-review-reasons-v1" as const,
      bundleFingerprint: input.bundle.bundleFingerprint,
      reviewerSource: "product_owner" as const,
      items: Object.entries(draft.entries).map(([itemId, entry]) => ({
        itemId,
        stage: stageForId(input.bundle, itemId),
        verdict: entry.verdict,
        category: entry.category,
        blocker: entry.blocker,
        reason: entry.reason,
        reviewedAt: entry.reviewedAt
      }))
    };
    const adjudicationBytes = jsonBytes(adjudication);
    const goldenBytes = jsonBytes(golden);
    const reasonsBytes = jsonBytes(reasons);
    await writeAtomic(paths.adjudication, adjudicationBytes);
    await writeAtomic(paths.golden, goldenBytes);
    await writeAtomic(paths.reasons, reasonsBytes);
    const receipt: Gi088ReviewReceiptV1 = {
      version: "2026-08-11.gi088-v8r3-review-receipt-v1",
      toolVersion: GI088_V8R3_REVIEW_TOOL_VERSION,
      toolSourceSha256: input.bundle.toolSourceSha256,
      bundleFingerprint: input.bundle.bundleFingerprint,
      finalizedAt: now,
      completeness: {
        candidate: "80/80",
        goldenA: "20/20",
        goldenB: "20/20"
      },
      outputSha256: {
        adjudication: sha256(adjudicationBytes),
        golden: sha256(goldenBytes),
        reasons: sha256(reasonsBytes)
      }
    };
    await writeAtomic(paths.receipt, jsonBytes(receipt));
    return receipt;
  }

  return { paths, saveDraft, readDraft, finalize };
}

export async function readGi088CandidateReviewPacket(path: string) {
  const value = JSON.parse(await readFile(path, "utf8")) as Gi088CandidateReviewPacket;
  if (
    value.packetVersion !==
      "2026-08-11.gi088-v8r3-human-adjudication-packet-v2" ||
    value.items.length !== 80
  ) {
    throw new Error("GI088_REVIEW_CANDIDATE_PACKET_INVALID");
  }
  return value;
}
