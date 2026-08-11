import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, resolve, sep } from "node:path";

import {
  GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS,
  GI088_V8R3_GOLDEN_REVISION_TOOL_VERSION,
  validateGi088V8r3GoldenRevision,
  type Gi088GoldenReplacement,
  type Gi088GoldenRevisionBundleV1,
  type Gi088GoldenRevisionDraftV1
} from "@/features/interview/event-centered/gi088-golden-revision-workbench";

type ParentGoldenItem = {
  sampleId: string;
  sourcePartition: "golden_calibration";
  contentFingerprint: string;
  checkpoints: unknown[];
  humanReview: {
    pass: boolean;
    blocker: boolean;
    primaryFailureCategory: string;
    reviewerId: string;
    source: "product_owner";
    reviewedAt: string;
  };
};

export type Gi088JudgeGoldenV2 = {
  version: "2026-08-11.gi088-v8r3-judge-golden-v2";
  rounds: readonly [
    { roundId: "golden-a"; items: ParentGoldenItem[] },
    { roundId: "golden-b"; items: ParentGoldenItem[] }
  ];
};

type ParentReceipt = {
  version: "2026-08-11.gi088-v8r3-review-receipt-v1";
  bundleFingerprint: string;
  outputSha256: { golden: string };
};

export type Gi088GoldenRevisionV1 = {
  version: "2026-08-11.gi088-v8r3-judge-golden-revision-v1";
  toolVersion: typeof GI088_V8R3_GOLDEN_REVISION_TOOL_VERSION;
  parent: Gi088GoldenRevisionBundleV1["parent"];
  rounds: readonly [
    {
      roundId: "golden-a";
      items: Array<{
        replacesSampleId: string;
        replacement: ParentGoldenItem;
      }>;
    },
    {
      roundId: "golden-b";
      items: Array<{
        replacesSampleId: string;
        replacement: ParentGoldenItem;
      }>;
    }
  ];
};

export type Gi088GoldenRevisionReceiptV1 = {
  version: "2026-08-11.gi088-v8r3-golden-revision-receipt-v1";
  toolVersion: typeof GI088_V8R3_GOLDEN_REVISION_TOOL_VERSION;
  toolSourceSha256: string;
  bundleFingerprint: string;
  parent: Gi088GoldenRevisionBundleV1["parent"];
  finalizedAt: string;
  completeness: {
    retained: "32/32";
    replaced: "8/8";
    goldenAReplaced: "3/3";
    goldenBReplaced: "5/5";
  };
  outputSha256: {
    revision: string;
    effectiveGolden: string;
    reasons: string;
  };
};

const DEFAULT_FILES = {
  draft: "golden-revision-draft-v1.json",
  revision: "judge-golden-revision-v1.json",
  effectiveGolden: "judge-golden-effective-v1.json",
  reasons: "golden-revision-reasons-v1.json",
  receipt: "golden-revision-receipt-v1.json"
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

function assertSha(value: string, code: string) {
  if (!/^[a-f0-9]{64}$/u.test(value)) throw new Error(code);
}

function sameMembers(actual: readonly string[], expected: readonly string[]) {
  return (
    actual.length === expected.length &&
    actual.every((value) => expected.includes(value))
  );
}

function assertParentGolden(value: unknown): asserts value is Gi088JudgeGoldenV2 {
  const golden = value as Gi088JudgeGoldenV2;
  if (
    golden?.version !== "2026-08-11.gi088-v8r3-judge-golden-v2" ||
    golden.rounds?.length !== 2 ||
    golden.rounds[0]?.roundId !== "golden-a" ||
    golden.rounds[0].items.length !== 20 ||
    golden.rounds[1]?.roundId !== "golden-b" ||
    golden.rounds[1].items.length !== 20
  ) {
    throw new Error("GI088_GOLDEN_REVISION_PARENT_GOLDEN_INVALID");
  }
  const allItems = golden.rounds.flatMap((round) => round.items);
  if (
    new Set(allItems.map((item) => item.sampleId)).size !== 40 ||
    new Set(allItems.map((item) => item.contentFingerprint)).size !== 40 ||
    allItems.some(
      (item) =>
        !/^[a-f0-9]{64}$/u.test(item.contentFingerprint) ||
        Number.isNaN(Date.parse(item.humanReview.reviewedAt))
    )
  ) {
    throw new Error("GI088_GOLDEN_REVISION_PARENT_GOLDEN_INVALID");
  }
  const aTimes = golden.rounds[0].items.map((item) =>
    Date.parse(item.humanReview.reviewedAt)
  );
  const bTimes = golden.rounds[1].items.map((item) =>
    Date.parse(item.humanReview.reviewedAt)
  );
  if (Math.max(...aTimes) >= Math.min(...bTimes)) {
    throw new Error("GI088_GOLDEN_REVISION_PARENT_ROUND_ORDER_INVALID");
  }
}

function assertReplacementShape(
  replacements: readonly Gi088GoldenReplacement[],
  expectedTargets: readonly string[]
) {
  if (
    !sameMembers(
      replacements.map((replacement) => replacement.replacesSampleId),
      expectedTargets
    ) ||
    new Set(replacements.map((replacement) => replacement.item.sampleId)).size !==
      replacements.length ||
    new Set(
      replacements.map((replacement) => replacement.item.contentFingerprint)
    ).size !== replacements.length
  ) {
    throw new Error("GI088_GOLDEN_REVISION_REPLACEMENT_SET_INVALID");
  }
  for (const replacement of replacements) {
    if (
      replacement.item.sourcePartition !== "golden_calibration" ||
      !/^[a-f0-9]{20}$/u.test(replacement.item.sampleId) ||
      !/^[a-f0-9]{64}$/u.test(replacement.item.contentFingerprint) ||
      replacement.item.checkpoints.length === 0
    ) {
      throw new Error("GI088_GOLDEN_REVISION_REPLACEMENT_INVALID");
    }
  }
}

function stableOrder(ids: string[], seed: string, scope: string) {
  return [...ids].sort((left, right) =>
    sha256(`${seed}:${scope}:${left}`).localeCompare(
      sha256(`${seed}:${scope}:${right}`)
    )
  );
}

export async function readGi088V8r3GoldenRevisionParent(input: {
  receiptPath: string;
  goldenPath: string;
}) {
  const [receiptBytes, goldenBytes] = await Promise.all([
    readFile(input.receiptPath, "utf8"),
    readFile(input.goldenPath, "utf8")
  ]);
  const receipt = JSON.parse(receiptBytes) as ParentReceipt;
  const golden = JSON.parse(goldenBytes) as unknown;
  assertParentGolden(golden);
  if (
    receipt.version !== "2026-08-11.gi088-v8r3-review-receipt-v1" ||
    !/^[a-f0-9]{64}$/u.test(receipt.bundleFingerprint) ||
    receipt.outputSha256?.golden !== sha256(goldenBytes)
  ) {
    throw new Error("GI088_GOLDEN_REVISION_PARENT_RECEIPT_INVALID");
  }
  return {
    receipt,
    golden,
    receiptSha256: sha256(receiptBytes),
    goldenSha256: sha256(goldenBytes)
  };
}

export function createGi088V8r3GoldenRevisionBundle(input: {
  parent: Awaited<ReturnType<typeof readGi088V8r3GoldenRevisionParent>>;
  goldenA: Gi088GoldenReplacement[];
  goldenB: Gi088GoldenReplacement[];
  seed: string;
  toolSourceSha256: string;
}): Gi088GoldenRevisionBundleV1 {
  assertSha(input.toolSourceSha256, "GI088_GOLDEN_REVISION_TOOL_SHA_INVALID");
  assertReplacementShape(
    input.goldenA,
    GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenA
  );
  assertReplacementShape(
    input.goldenB,
    GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenB
  );
  const parentIds = new Set(
    input.parent.golden.rounds.flatMap((round) =>
      round.items.map((item) => item.sampleId)
    )
  );
  const targets = [
    ...input.goldenA.map((replacement) => replacement.replacesSampleId),
    ...input.goldenB.map((replacement) => replacement.replacesSampleId)
  ];
  if (targets.some((id) => !parentIds.has(id))) {
    throw new Error("GI088_GOLDEN_REVISION_TARGET_NOT_IN_PARENT");
  }
  const newItems = [...input.goldenA, ...input.goldenB].map(
    (replacement) => replacement.item
  );
  if (
    newItems.some(
      (item) =>
        parentIds.has(item.sampleId) ||
        input.parent.golden.rounds.some((round) =>
          round.items.some(
            (parentItem) => parentItem.contentFingerprint === item.contentFingerprint
          )
        )
    )
  ) {
    throw new Error("GI088_GOLDEN_REVISION_REPLACEMENT_REUSED");
  }
  const payload = {
    version: "2026-08-11.gi088-v8r3-golden-revision-bundle-v1" as const,
    toolVersion: GI088_V8R3_GOLDEN_REVISION_TOOL_VERSION,
    toolSourceSha256: input.toolSourceSha256,
    parent: {
      receiptSha256: input.parent.receiptSha256,
      goldenSha256: input.parent.goldenSha256,
      bundleFingerprint: input.parent.receipt.bundleFingerprint
    },
    replacementRounds: [
      { roundId: "golden-a" as const, items: input.goldenA },
      { roundId: "golden-b" as const, items: input.goldenB }
    ] as const,
    order: {
      goldenA: stableOrder(
        input.goldenA.map((replacement) => replacement.item.sampleId),
        input.seed,
        "golden-a"
      ),
      goldenB: stableOrder(
        input.goldenB.map((replacement) => replacement.item.sampleId),
        input.seed,
        "golden-b"
      )
    }
  };
  return {
    ...payload,
    bundleFingerprint: sha256(JSON.stringify(payload))
  };
}

function resolvePrivateFile(root: string, name: string) {
  if (
    name !== basename(name) ||
    name.includes("..") ||
    name.includes("/") ||
    name.includes("\\")
  ) {
    throw new Error("GI088_GOLDEN_REVISION_PATH_OUTSIDE_PRIVATE_ROOT");
  }
  const absoluteRoot = resolve(root);
  const path = resolve(absoluteRoot, name);
  if (!path.startsWith(`${absoluteRoot}${sep}`)) {
    throw new Error("GI088_GOLDEN_REVISION_PATH_OUTSIDE_PRIVATE_ROOT");
  }
  return path;
}

function allowedItemIds(bundle: Gi088GoldenRevisionBundleV1) {
  return new Set([...bundle.order.goldenA, ...bundle.order.goldenB]);
}

function assertDraftShape(
  draft: Gi088GoldenRevisionDraftV1,
  bundle: Gi088GoldenRevisionBundleV1
) {
  const allowedIds = allowedItemIds(bundle);
  if (
    draft?.version !==
      "2026-08-11.gi088-v8r3-golden-revision-draft-v1" ||
    draft.toolVersion !== GI088_V8R3_GOLDEN_REVISION_TOOL_VERSION ||
    !["golden_a", "golden_b"].includes(draft.currentStage) ||
    !allowedIds.has(draft.currentItemId) ||
    Number.isNaN(Date.parse(draft.createdAt)) ||
    Number.isNaN(Date.parse(draft.savedAt)) ||
    !draft.entries ||
    Array.isArray(draft.entries)
  ) {
    throw new Error("GI088_GOLDEN_REVISION_DRAFT_INVALID");
  }
  for (const [id, entry] of Object.entries(draft.entries)) {
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
      throw new Error(`GI088_GOLDEN_REVISION_ENTRY_INVALID:${id}`);
    }
  }
}

function replacementLookup(bundle: Gi088GoldenRevisionBundleV1) {
  return new Map(
    bundle.replacementRounds.flatMap((round) =>
      round.items.map((replacement) => [replacement.item.sampleId, replacement])
    )
  );
}

function buildReviewedReplacement(
  replacement: Gi088GoldenReplacement,
  entry: Gi088GoldenRevisionDraftV1["entries"][string]
): ParentGoldenItem {
  return {
    sampleId: replacement.item.sampleId,
    sourcePartition: "golden_calibration",
    contentFingerprint: replacement.item.contentFingerprint,
    checkpoints: replacement.item.checkpoints,
    humanReview: {
      pass: entry.verdict === "direct_use" || entry.verdict === "minor_issue",
      blocker: entry.verdict === "quality_failure" && entry.blocker,
      primaryFailureCategory: entry.category,
      reviewerId: "product_owner_gi088_v8r3r1",
      source: "product_owner",
      reviewedAt: entry.reviewedAt
    }
  };
}

export function resolveGi088V8r3EffectiveGolden(input: {
  parentGolden: Gi088JudgeGoldenV2;
  revision: Gi088GoldenRevisionV1;
}) {
  assertParentGolden(input.parentGolden);
  const replacements = new Map(
    input.revision.rounds.flatMap((round) =>
      round.items.map((item) => [item.replacesSampleId, item.replacement] as const)
    )
  );
  const expectedTargets = [
    ...GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenA,
    ...GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenB
  ];
  if (!sameMembers([...replacements.keys()], expectedTargets)) {
    throw new Error("GI088_GOLDEN_REVISION_TARGET_SET_INVALID");
  }
  const effective = {
    version: "2026-08-11.gi088-v8r3-judge-golden-v2" as const,
    rounds: input.parentGolden.rounds.map((round) => ({
      roundId: round.roundId,
      items: round.items.map((item) => replacements.get(item.sampleId) ?? item)
    }))
  };
  if (
    effective.rounds[0].items.length !== 20 ||
    effective.rounds[1].items.length !== 20 ||
    new Set(effective.rounds.flatMap((round) => round.items.map((item) => item.sampleId)))
      .size !== 40
  ) {
    throw new Error("GI088_GOLDEN_REVISION_EFFECTIVE_SET_INVALID");
  }
  return effective;
}

export function createGi088V8r3GoldenRevisionRepository(input: {
  root: string;
  bundle: Gi088GoldenRevisionBundleV1;
  parentGolden: Gi088JudgeGoldenV2;
  fileNames?: Partial<Record<keyof typeof DEFAULT_FILES, string>>;
}) {
  const names = { ...DEFAULT_FILES, ...input.fileNames };
  const paths = Object.fromEntries(
    Object.entries(names).map(([key, name]) => [
      key,
      resolvePrivateFile(input.root, name)
    ])
  ) as Record<keyof typeof DEFAULT_FILES, string>;

  async function readReceipt(): Promise<Gi088GoldenRevisionReceiptV1 | null> {
    try {
      const receipt = JSON.parse(
        await readFile(paths.receipt, "utf8")
      ) as Gi088GoldenRevisionReceiptV1;
      if (
        receipt.version !==
          "2026-08-11.gi088-v8r3-golden-revision-receipt-v1" ||
        receipt.bundleFingerprint !== input.bundle.bundleFingerprint
      ) {
        throw new Error("GI088_GOLDEN_REVISION_RECEIPT_INVALID");
      }
      return receipt;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async function saveDraft(draft: Gi088GoldenRevisionDraftV1) {
    if (await readReceipt()) {
      throw new Error("GI088_GOLDEN_REVISION_ALREADY_FINALIZED");
    }
    assertDraftShape(draft, input.bundle);
    if (draft.bundleFingerprint !== input.bundle.bundleFingerprint) {
      throw new Error("GI088_GOLDEN_REVISION_BUNDLE_FINGERPRINT_MISMATCH");
    }
    await writeAtomic(paths.draft, jsonBytes(draft));
  }

  async function readDraft(): Promise<Gi088GoldenRevisionDraftV1 | null> {
    try {
      const draft = JSON.parse(
        await readFile(paths.draft, "utf8")
      ) as Gi088GoldenRevisionDraftV1;
      assertDraftShape(draft, input.bundle);
      if (draft.bundleFingerprint !== input.bundle.bundleFingerprint) {
        throw new Error("GI088_GOLDEN_REVISION_BUNDLE_FINGERPRINT_MISMATCH");
      }
      return draft;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async function finalize(
    draft: Gi088GoldenRevisionDraftV1,
    now = new Date().toISOString()
  ): Promise<Gi088GoldenRevisionReceiptV1> {
    if (await readReceipt()) {
      throw new Error("GI088_GOLDEN_REVISION_ALREADY_FINALIZED");
    }
    const validation = validateGi088V8r3GoldenRevision(draft, input.bundle);
    if (!validation.ok) {
      throw new Error(
        `GI088_GOLDEN_REVISION_INCOMPLETE:${validation.issues[0]}`
      );
    }
    const lookup = replacementLookup(input.bundle);
    const buildRound = <RoundId extends "golden-a" | "golden-b">(
      roundId: RoundId,
      ids: string[]
    ) => ({
      roundId,
      items: ids.map((sampleId) => {
        const replacement = lookup.get(sampleId);
        const entry = draft.entries[sampleId];
        if (!replacement || !entry) {
          throw new Error("GI088_GOLDEN_REVISION_ENTRY_MISSING");
        }
        return {
          replacesSampleId: replacement.replacesSampleId,
          replacement: buildReviewedReplacement(replacement, entry)
        };
      })
    });
    const revision: Gi088GoldenRevisionV1 = {
      version: "2026-08-11.gi088-v8r3-judge-golden-revision-v1",
      toolVersion: GI088_V8R3_GOLDEN_REVISION_TOOL_VERSION,
      parent: input.bundle.parent,
      rounds: [
        buildRound("golden-a", input.bundle.order.goldenA),
        buildRound("golden-b", input.bundle.order.goldenB)
      ]
    };
    const resolvedGolden = resolveGi088V8r3EffectiveGolden({
      parentGolden: input.parentGolden,
      revision
    });
    const effectiveGolden = {
      version: "2026-08-11.gi088-v8r3-judge-golden-effective-v1" as const,
      parent: input.bundle.parent,
      lineage: { retained: 32, replaced: 8 },
      golden: resolvedGolden
    };
    const reasons = {
      version: "2026-08-11.gi088-v8r3-golden-revision-reasons-v1" as const,
      bundleFingerprint: input.bundle.bundleFingerprint,
      reviewerSource: "product_owner" as const,
      items: [...input.bundle.order.goldenA, ...input.bundle.order.goldenB].map(
        (itemId) => {
          const replacement = lookup.get(itemId);
          const entry = draft.entries[itemId];
          if (!replacement || !entry) {
            throw new Error("GI088_GOLDEN_REVISION_ENTRY_MISSING");
          }
          return {
            itemId,
            replacesSampleId: replacement.replacesSampleId,
            stage: input.bundle.order.goldenA.includes(itemId)
              ? "golden_a"
              : "golden_b",
            verdict: entry.verdict,
            category: entry.category,
            blocker: entry.blocker,
            reason: entry.reason,
            reviewedAt: entry.reviewedAt
          };
        }
      )
    };
    const revisionBytes = jsonBytes(revision);
    const effectiveBytes = jsonBytes(effectiveGolden);
    const reasonsBytes = jsonBytes(reasons);
    await writeAtomic(paths.revision, revisionBytes);
    await writeAtomic(paths.effectiveGolden, effectiveBytes);
    await writeAtomic(paths.reasons, reasonsBytes);
    const receipt: Gi088GoldenRevisionReceiptV1 = {
      version: "2026-08-11.gi088-v8r3-golden-revision-receipt-v1",
      toolVersion: GI088_V8R3_GOLDEN_REVISION_TOOL_VERSION,
      toolSourceSha256: input.bundle.toolSourceSha256,
      bundleFingerprint: input.bundle.bundleFingerprint,
      parent: input.bundle.parent,
      finalizedAt: now,
      completeness: {
        retained: "32/32",
        replaced: "8/8",
        goldenAReplaced: "3/3",
        goldenBReplaced: "5/5"
      },
      outputSha256: {
        revision: sha256(revisionBytes),
        effectiveGolden: sha256(effectiveBytes),
        reasons: sha256(reasonsBytes)
      }
    };
    await writeAtomic(paths.receipt, jsonBytes(receipt));
    return receipt;
  }

  return { paths, saveDraft, readDraft, readReceipt, finalize };
}
