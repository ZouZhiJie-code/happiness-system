import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createGi088V8r3ReviewBundle,
  createGi088V8r3ReviewRepository
} from "@/server/services/evaluation/gi088/review-workbench-service";
import {
  createGi088V8r3InitialReviewDraft,
  type Gi088GoldenReviewItem,
  type Gi088ReviewEntry
} from "@/features/interview/event-centered/gi088-review-workbench";

const sha = (value: string) => value.repeat(64).slice(0, 64);
const checkpoint = {
  visibleConversation: [
    { role: "user" as const, content: "我想理清这件事。" },
    { role: "assistant" as const, content: "你想先从哪一部分开始？" }
  ],
  candidateVisibleOutput: {
    action: "ask",
    understanding: "你想理清当前困扰。",
    response: "最近一次是什么时候？"
  },
  safeTrace: {
    latencyMs: 1200,
    automaticRecoveryCount: 0,
    contractValid: true,
    technicalFailure: false
  }
};

function inputs() {
  const candidateItems = Array.from({ length: 80 }, (_, index) => ({
    reviewId: index.toString(16).padStart(20, "0"),
    reviewItemFingerprint: sha(`${index % 10}`),
    workingTask: `共同任务 ${index + 1}`,
    checkpoints: [{ ...checkpoint, checkpointIndex: 0 }]
  }));
  const golden = (prefix: string, offset: number): Gi088GoldenReviewItem[] =>
    Array.from({ length: 20 }, (_, index) => ({
      sampleId: `${prefix}-${index + 1}`,
      sourcePartition: "golden_calibration",
      contentFingerprint: sha(`${(index + offset) % 10}`),
      checkpoints: [checkpoint]
    }));
  return {
    candidatePacket: {
      packetVersion: "2026-08-11.gi088-v8r3-human-adjudication-packet-v2",
      candidateOfflineRunFingerprint: sha("a"),
      candidateEvidenceFingerprint: sha("b"),
      datasetFingerprint: sha("c"),
      items: candidateItems
    },
    goldenA: golden("golden-a", 2),
    goldenB: golden("golden-b", 4)
  };
}

describe("GI-088 v8r3 本机裁决服务", () => {
  it("用稳定种子生成 80/20/20 盲序包", () => {
    const first = createGi088V8r3ReviewBundle({ ...inputs(), seed: "stable", toolSourceSha256: sha("e") });
    const second = createGi088V8r3ReviewBundle({ ...inputs(), seed: "stable", toolSourceSha256: sha("e") });
    expect(first.order).toEqual(second.order);
    expect(first.bundleFingerprint).toBe(second.bundleFingerprint);
    expect(first.order.candidate).toHaveLength(80);
    expect(first.order.goldenA).toHaveLength(20);
    expect(first.order.goldenB).toHaveLength(20);
  });

  it("原子保存草稿，并拒绝包指纹漂移", async () => {
    const root = await mkdtemp(join(tmpdir(), "gi088-review-"));
    const bundle = createGi088V8r3ReviewBundle({ ...inputs(), seed: "stable", toolSourceSha256: sha("e") });
    const repository = createGi088V8r3ReviewRepository({ root, bundle });
    const draft = createGi088V8r3InitialReviewDraft(bundle, "2026-08-11T00:00:00.000Z");
    await repository.saveDraft(draft);
    expect((await repository.readDraft())?.bundleFingerprint).toBe(bundle.bundleFingerprint);
    await expect(
      repository.saveDraft({ ...draft, bundleFingerprint: sha("f") })
    ).rejects.toThrow("GI088_REVIEW_BUNDLE_FINGERPRINT_MISMATCH");
  });

  it("完成后生成候选、Golden、理由和只含摘要的收据", async () => {
    const root = await mkdtemp(join(tmpdir(), "gi088-review-"));
    const bundle = createGi088V8r3ReviewBundle({ ...inputs(), seed: "stable", toolSourceSha256: sha("e") });
    const repository = createGi088V8r3ReviewRepository({ root, bundle });
    const draft = createGi088V8r3InitialReviewDraft(bundle, "2026-08-11T00:00:00.000Z");
    const direct: Gi088ReviewEntry = {
      verdict: "direct_use",
      category: "none",
      blocker: false,
      reason: "",
      reviewedAt: "2026-08-11T00:01:00.000Z"
    };
    for (const id of bundle.order.candidate) draft.entries[id] = direct;
    for (const id of bundle.order.goldenA) {
      draft.entries[id] = { ...direct, reviewedAt: "2026-08-11T01:00:00.000Z" };
    }
    for (const id of bundle.order.goldenB) {
      draft.entries[id] = { ...direct, reviewedAt: "2026-08-11T02:00:00.000Z" };
    }
    const receipt = await repository.finalize(draft);
    expect(receipt.completeness).toEqual({ candidate: "80/80", goldenA: "20/20", goldenB: "20/20" });
    expect(receipt.outputSha256).toEqual({
      adjudication: expect.stringMatching(/^[a-f0-9]{64}$/u),
      golden: expect.stringMatching(/^[a-f0-9]{64}$/u),
      reasons: expect.stringMatching(/^[a-f0-9]{64}$/u)
    });
    const golden = JSON.parse(await readFile(join(root, "judge-golden-v2.json"), "utf8"));
    expect(golden.rounds).toHaveLength(2);
    expect(golden.rounds[0].items).toHaveLength(20);
    const receiptFile = await readFile(join(root, "review-receipt-v1.json"), "utf8");
    expect(receiptFile).not.toContain("我想理清这件事");
  });

  it("拒绝私有根目录之外的文件落点", async () => {
    const root = await mkdtemp(join(tmpdir(), "gi088-review-"));
    const bundle = createGi088V8r3ReviewBundle({ ...inputs(), seed: "stable", toolSourceSha256: sha("e") });
    expect(() =>
      createGi088V8r3ReviewRepository({
        root,
        bundle,
        fileNames: { draft: "../escape.json" }
      })
    ).toThrow("GI088_REVIEW_PATH_OUTSIDE_PRIVATE_ROOT");
    await writeFile(join(root, "unchanged"), "ok");
  });
});
