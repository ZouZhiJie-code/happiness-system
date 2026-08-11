import {
  createGi088V8r3InitialGoldenRevisionDraft,
  GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS,
  GI088_V8R3_GOLDEN_REVISION_TOOL_VERSION,
  gi088GoldenRevisionEntryIsComplete,
  summarizeGi088V8r3GoldenRevision,
  validateGi088V8r3GoldenRevision,
  type Gi088GoldenRevisionBundleV1
} from "@/features/interview/event-centered/gi088-golden-revision-workbench";

function bundle(): Gi088GoldenRevisionBundleV1 {
  const checkpoint = {
    visibleConversation: [
      { role: "user" as const, content: "我想理清这件事。" },
      { role: "assistant" as const, content: "你想先从哪里开始？" }
    ],
    candidateVisibleOutput: {
      action: "ask",
      understanding: "你想理清当前困扰。",
      response: "最近一次发生在什么时候？"
    },
    safeTrace: { contractValid: true }
  };
  const replacements = (targets: readonly string[], offset: number) =>
    targets.map((replacesSampleId, index) => ({
      replacesSampleId,
      item: {
        sampleId: (index + offset).toString(16).padStart(20, "0"),
        sourcePartition: "golden_calibration" as const,
        contentFingerprint: (index + offset).toString(16).repeat(64).slice(0, 64),
        workingTask: "理清当前困扰",
        checkpoints: [checkpoint]
      }
    }));
  const goldenA = replacements(GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenA, 1);
  const goldenB = replacements(GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenB, 5);
  return {
    version: "2026-08-11.gi088-v8r3-golden-revision-bundle-v1",
    toolVersion: GI088_V8R3_GOLDEN_REVISION_TOOL_VERSION,
    toolSourceSha256: "a".repeat(64),
    parent: {
      receiptSha256: "b".repeat(64),
      goldenSha256: "c".repeat(64),
      bundleFingerprint: "d".repeat(64)
    },
    replacementRounds: [
      { roundId: "golden-a", items: goldenA },
      { roundId: "golden-b", items: goldenB }
    ],
    order: {
      goldenA: goldenA.map((entry) => entry.item.sampleId),
      goldenB: goldenB.map((entry) => entry.item.sampleId)
    },
    bundleFingerprint: "e".repeat(64)
  };
}

describe("GI-088 v8r3 Golden 8 条替换裁决", () => {
  it("固定只替换 Golden A 3 条与 Golden B 5 条", () => {
    expect(GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenA).toHaveLength(3);
    expect(GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenB).toHaveLength(5);
    expect(
      new Set([
        ...GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenA,
        ...GI088_V8R3_GOLDEN_REPLACEMENT_TARGETS.goldenB
      ]).size
    ).toBe(8);
  });

  it("初始页面只出现 8 条替换素材，并明确沿用原 32 条", () => {
    const inputBundle = bundle();
    const draft = createGi088V8r3InitialGoldenRevisionDraft(inputBundle);
    expect(draft.currentStage).toBe("golden_a");
    expect(draft.currentItemId).toBe(inputBundle.order.goldenA[0]);
    expect(summarizeGi088V8r3GoldenRevision(draft, inputBundle)).toEqual({
      retained: 32,
      replacements: { completed: 0, total: 8 },
      goldenA: { completed: 0, total: 3 },
      goldenB: { completed: 0, total: 5 }
    });
  });

  it("Golden 问题项仍要求类别和 8 至 300 字理由，且不确定不能封存", () => {
    const now = "2026-08-11T12:00:00.000Z";
    expect(
      gi088GoldenRevisionEntryIsComplete({
        verdict: "direct_use",
        category: "none",
        blocker: false,
        reason: "",
        reviewedAt: now
      })
    ).toBe(true);
    expect(
      gi088GoldenRevisionEntryIsComplete({
        verdict: "minor_issue",
        category: "contract_or_data",
        blocker: false,
        reason: "上下文仍然不足，无法稳定判断这条回应。",
        reviewedAt: now
      })
    ).toBe(true);
    expect(
      gi088GoldenRevisionEntryIsComplete({
        verdict: "uncertain",
        category: "contract_or_data",
        blocker: false,
        reason: "上下文仍然不足，无法稳定判断这条回应。",
        reviewedAt: now
      })
    ).toBe(false);
  });

  it("只在 3 条 A 先完成、5 条 B 后完成时允许封存", () => {
    const inputBundle = bundle();
    const draft = createGi088V8r3InitialGoldenRevisionDraft(inputBundle);
    const direct = {
      verdict: "direct_use" as const,
      category: "none" as const,
      blocker: false,
      reason: ""
    };
    for (const id of inputBundle.order.goldenA) {
      draft.entries[id] = {
        ...direct,
        reviewedAt: "2026-08-11T12:00:00.000Z"
      };
    }
    for (const id of inputBundle.order.goldenB) {
      draft.entries[id] = {
        ...direct,
        reviewedAt: "2026-08-11T13:00:00.000Z"
      };
    }
    expect(validateGi088V8r3GoldenRevision(draft, inputBundle)).toEqual({
      ok: true,
      issues: []
    });
    draft.entries[inputBundle.order.goldenB[0]!]!.reviewedAt =
      "2026-08-11T11:00:00.000Z";
    expect(validateGi088V8r3GoldenRevision(draft, inputBundle).issues).toContain(
      "GI088_GOLDEN_REVISION_ROUND_ORDER_INVALID"
    );
  });
});
