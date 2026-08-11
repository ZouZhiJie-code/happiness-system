import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createGi088V8r3InitialGoldenRevisionDraft,
  GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS,
  type Gi088GoldenReplacement
} from "@/features/interview/event-centered/gi088-golden-revision-workbench";
import {
  createGi088V8r3GoldenRevisionBundle,
  createGi088V8r3GoldenRevisionRepository,
  readGi088V8r3GoldenRevisionParent
} from "@/server/services/evaluation/gi088/golden-revision-service";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const bytes = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

function parentGolden() {
  const round = (
    roundId: "golden-a" | "golden-b",
    targets: readonly string[],
    reviewedAt: string
  ) => {
    const generated = Array.from(
      { length: 20 - targets.length },
      (_, index) => hash(`${roundId}:retained:${index}`).slice(0, 20)
    );
    return {
      roundId,
      items: [...targets, ...generated].map((sampleId, index) => ({
        sampleId,
        sourcePartition: "golden_calibration" as const,
        contentFingerprint: hash(`${roundId}:content:${index}`),
        checkpoints: [
          {
            visibleConversation: [
              { role: "user", content: `${roundId} 原始材料 ${index}` }
            ],
            candidateVisibleOutput: {
              action: "synthesize",
              understanding: null,
              response: `${roundId} 原始回应 ${index}`
            },
            safeTrace: { contractValid: true }
          }
        ],
        humanReview: {
          pass: true,
          blocker: false,
          primaryFailureCategory: "none",
          reviewerId: "product_owner_gi088_v8r3r1",
          source: "product_owner" as const,
          reviewedAt
        }
      }))
    };
  };
  return {
    version: "2026-08-11.gi088-v8r3-judge-golden-v2" as const,
    rounds: [
      round(
        "golden-a",
        GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenA,
        "2026-08-11T10:00:00.000Z"
      ),
      round(
        "golden-b",
        GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenB,
        "2026-08-11T11:00:00.000Z"
      )
    ] as const
  };
}

function replacements(
  targets: readonly string[],
  offset: number
): Gi088GoldenReplacement[] {
  return targets.map((replacesSampleId, index) => {
    const itemIndex = index + offset;
    const checkpoints = [
      {
        visibleConversation: [
          { role: "user" as const, content: `新上下文 ${itemIndex}` },
          { role: "assistant" as const, content: `新问题 ${itemIndex}` },
          { role: "user" as const, content: `新回答 ${itemIndex}` }
        ],
        candidateVisibleOutput: {
          action: "synthesize",
          understanding: `新理解 ${itemIndex}`,
          response: `新回应 ${itemIndex}`
        },
        safeTrace: { contractValid: true }
      }
    ];
    return {
      replacesSampleId,
      item: {
        sampleId: hash(`replacement:${itemIndex}`).slice(0, 20),
        sourcePartition: "golden_calibration",
        contentFingerprint: hash(JSON.stringify({ checkpoints })),
        workingTask: `新共同任务 ${itemIndex}`,
        checkpoints
      }
    };
  });
}

async function parentFiles(root: string) {
  const golden = parentGolden();
  const goldenText = bytes(golden);
  const goldenPath = join(root, "judge-golden-v2.json");
  const receiptPath = join(root, "review-receipt-v1.json");
  await writeFile(goldenPath, goldenText, { mode: 0o600 });
  await writeFile(
    receiptPath,
    bytes({
      version: "2026-08-11.gi088-v8r3-review-receipt-v1",
      bundleFingerprint: "a".repeat(64),
      outputSha256: { golden: hash(goldenText) }
    }),
    { mode: 0o600 }
  );
  return { goldenPath, receiptPath, golden };
}

describe("GI-088 v8r3 Golden 修订服务", () => {
  it("用父收据锁定原始 Golden，任一字节漂移立即拒绝", async () => {
    const root = await mkdtemp(join(tmpdir(), "gi088-golden-parent-"));
    const paths = await parentFiles(root);
    const parent = await readGi088V8r3GoldenRevisionParent(paths);
    expect(parent.goldenSha256).toMatch(/^[a-f0-9]{64}$/u);
    await writeFile(paths.goldenPath, `${bytes(paths.golden)}\n`, { mode: 0o600 });
    await expect(readGi088V8r3GoldenRevisionParent(paths)).rejects.toThrow(
      "GI088_GOLDEN_REVISION_PARENT_RECEIPT_INVALID"
    );
  });

  it("只替换指定 8 条，并让原 32 条逐对象保持不变", async () => {
    const parentRoot = await mkdtemp(join(tmpdir(), "gi088-golden-parent-"));
    const outputRoot = await mkdtemp(join(tmpdir(), "gi088-golden-revision-"));
    const paths = await parentFiles(parentRoot);
    const parent = await readGi088V8r3GoldenRevisionParent(paths);
    const goldenA = replacements(
      GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenA,
      1
    );
    const goldenB = replacements(
      GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenB,
      10
    );
    const bundle = createGi088V8r3GoldenRevisionBundle({
      parent,
      goldenA,
      goldenB,
      seed: "stable",
      toolSourceSha256: "b".repeat(64)
    });
    const repository = createGi088V8r3GoldenRevisionRepository({
      root: outputRoot,
      bundle,
      parentGolden: parent.golden
    });
    const draft = createGi088V8r3InitialGoldenRevisionDraft(
      bundle,
      "2026-08-11T12:00:00.000Z"
    );
    const direct = {
      verdict: "direct_use" as const,
      category: "none" as const,
      blocker: false,
      reason: ""
    };
    for (const id of bundle.order.goldenA) {
      draft.entries[id] = {
        ...direct,
        reviewedAt: "2026-08-11T12:30:00.000Z"
      };
    }
    for (const id of bundle.order.goldenB) {
      draft.entries[id] = {
        ...direct,
        reviewedAt: "2026-08-11T13:30:00.000Z"
      };
    }
    const receipt = await repository.finalize(
      draft,
      "2026-08-11T14:00:00.000Z"
    );
    expect(receipt.completeness).toEqual({
      retained: "32/32",
      replaced: "8/8",
      goldenAReplaced: "3/3",
      goldenBReplaced: "5/5"
    });
    const effectiveFile = JSON.parse(
      await readFile(join(outputRoot, "judge-golden-effective-v1.json"), "utf8")
    );
    const originalItems = parent.golden.rounds.flatMap((round) => round.items);
    const effectiveItems = effectiveFile.golden.rounds.flatMap(
      (round: { items: unknown[] }) => round.items
    );
    const targets = new Set<string>([
      ...GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenA,
      ...GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenB
    ]);
    const retainedOriginal = originalItems.filter(
      (item) => !targets.has(item.sampleId)
    );
    expect(retainedOriginal).toHaveLength(32);
    for (const item of retainedOriginal) {
      expect(
        effectiveItems.find(
          (effective: { sampleId: string }) => effective.sampleId === item.sampleId
        )
      ).toEqual(item);
    }
    const replacementIds = new Set(
      [...goldenA, ...goldenB].map((entry) => entry.item.sampleId)
    );
    expect(
      effectiveItems.filter((item: { sampleId: string }) =>
        replacementIds.has(item.sampleId)
      )
    ).toHaveLength(8);
    const parentAfter = await readFile(paths.goldenPath, "utf8");
    expect(hash(parentAfter)).toBe(parent.goldenSha256);
    const receiptBytes = await readFile(
      join(outputRoot, "golden-revision-receipt-v1.json"),
      "utf8"
    );
    expect(receiptBytes).not.toContain("新上下文");
    await expect(repository.saveDraft(draft)).rejects.toThrow(
      "GI088_GOLDEN_REVISION_ALREADY_FINALIZED"
    );
    await expect(repository.finalize(draft)).rejects.toThrow(
      "GI088_GOLDEN_REVISION_ALREADY_FINALIZED"
    );
  });

  it("拒绝替换目标缺失、重复或私有目录越界", async () => {
    const parentRoot = await mkdtemp(join(tmpdir(), "gi088-golden-parent-"));
    const parent = await readGi088V8r3GoldenRevisionParent(
      await parentFiles(parentRoot)
    );
    const goldenA = replacements(
      GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenA,
      1
    );
    const goldenB = replacements(
      GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenB,
      10
    );
    expect(() =>
      createGi088V8r3GoldenRevisionBundle({
        parent,
        goldenA: goldenA.slice(1),
        goldenB,
        seed: "stable",
        toolSourceSha256: "b".repeat(64)
      })
    ).toThrow("GI088_GOLDEN_REVISION_REPLACEMENT_SET_INVALID");
    const bundle = createGi088V8r3GoldenRevisionBundle({
      parent,
      goldenA,
      goldenB,
      seed: "stable",
      toolSourceSha256: "b".repeat(64)
    });
    expect(() =>
      createGi088V8r3GoldenRevisionRepository({
        root: parentRoot,
        bundle,
        parentGolden: parent.golden,
        fileNames: { draft: "../escape.json" }
      })
    ).toThrow("GI088_GOLDEN_REVISION_PATH_OUTSIDE_PRIVATE_ROOT");
  });
});
