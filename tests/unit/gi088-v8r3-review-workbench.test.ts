import {
  GI088_V8R3_REVIEW_TOOL_VERSION,
  canOpenGi088V8r3ReviewWorkbench,
  createGi088V8r3InitialReviewDraft,
  mapGi088CandidateReviewResult,
  reviewEntryIsComplete,
  summarizeGi088V8r3ReviewDraft,
  validateGi088V8r3FinalReview
} from "@/features/interview/event-centered/gi088-review-workbench";

const fingerprint = "a".repeat(64);

function bundle() {
  const checkpoint = {
    visibleConversation: [
      { role: "user" as const, content: "我想理清一件事。" },
      { role: "assistant" as const, content: "你想先从哪里开始？" }
    ],
    candidateVisibleOutput: {
      action: "ask",
      understanding: "你想理清当前困扰。",
      response: "最近一次发生在什么时候？"
    },
    safeTrace: {
      latencyMs: 1200,
      automaticRecoveryCount: 0,
      contractValid: true,
      technicalFailure: false
    }
  };
  const candidateItems = Array.from({ length: 80 }, (_, index) => ({
    reviewId: index.toString(16).padStart(20, "0"),
    reviewItemFingerprint: `${(index % 10).toString()}`.repeat(64),
    workingTask: "理清当前困扰",
    checkpoints: [{ ...checkpoint, checkpointIndex: 0 }]
  }));
  const goldenRound = (roundId: "golden-a" | "golden-b", offset: number) => ({
    roundId,
    items: Array.from({ length: 20 }, (_, index) => ({
      sampleId: `${roundId}-${index + 1}`,
      sourcePartition: "golden_calibration" as const,
      contentFingerprint: `${((index + offset) % 10).toString()}`.repeat(64),
      checkpoints: [checkpoint]
    }))
  });
  return {
    version: "2026-08-11.gi088-v8r3-review-bundle-v1" as const,
    toolVersion: GI088_V8R3_REVIEW_TOOL_VERSION,
    toolSourceSha256: "e".repeat(64),
    candidateOfflineRunFingerprint: fingerprint,
    candidateEvidenceFingerprint: "b".repeat(64),
    datasetFingerprint: "c".repeat(64),
    candidateItems,
    goldenRounds: [goldenRound("golden-a", 2), goldenRound("golden-b", 4)] as const,
    order: {
      candidate: candidateItems.map((item) => item.reviewId),
      goldenA: Array.from({ length: 20 }, (_, index) => `golden-a-${index + 1}`),
      goldenB: Array.from({ length: 20 }, (_, index) => `golden-b-${index + 1}`)
    },
    bundleFingerprint: "d".repeat(64)
  };
}

describe("GI-088 v8r3 本机裁决工作台", () => {
  it("只允许显式开启、令牌匹配的本机开发入口", () => {
    const input = {
      nodeEnv: "development",
      host: "127.0.0.1:3048",
      forwardedHost: null,
      vercelEnv: undefined,
      mode: "I_UNDERSTAND_LOCAL_PRIVATE_REVIEW",
      configuredToken: "secret-token",
      providedToken: "secret-token"
    };
    expect(canOpenGi088V8r3ReviewWorkbench(input)).toBe(true);
    expect(canOpenGi088V8r3ReviewWorkbench({ ...input, host: "review.example.com" })).toBe(false);
    expect(canOpenGi088V8r3ReviewWorkbench({ ...input, vercelEnv: "preview" })).toBe(false);
    expect(canOpenGi088V8r3ReviewWorkbench({ ...input, nodeEnv: "production" })).toBe(false);
    expect(canOpenGi088V8r3ReviewWorkbench({ ...input, providedToken: "wrong" })).toBe(false);
  });

  it("建立 80/20/20 的固定三阶段草稿", () => {
    const draft = createGi088V8r3InitialReviewDraft(bundle());
    expect(draft.currentStage).toBe("candidate");
    expect(draft.currentItemId).toBe("00000000000000000000");
    expect(summarizeGi088V8r3ReviewDraft(draft, bundle())).toEqual({
      candidate: { completed: 0, total: 80 },
      goldenA: { completed: 0, total: 20 },
      goldenB: { completed: 0, total: 20 }
    });
  });

  it("把四种页面裁决映射为冻结候选合同", () => {
    expect(mapGi088CandidateReviewResult({ verdict: "direct_use", category: "none", blocker: false, reason: "" })).toEqual({
      outcome: "pass",
      quality: "direct_use",
      singleCaseBlocker: false,
      primaryFailureCategory: "none"
    });
    expect(mapGi088CandidateReviewResult({ verdict: "minor_issue", category: "answer_burden", blocker: false, reason: "提问稍微偏重，需要再轻一点。" })).toMatchObject({
      outcome: "pass",
      quality: "minor_issue",
      primaryFailureCategory: "answer_burden"
    });
    expect(mapGi088CandidateReviewResult({ verdict: "quality_failure", category: "working_task_drift", blocker: true, reason: "已经离开用户当前想理清的重点。" })).toMatchObject({
      outcome: "fail",
      quality: "quality_failure",
      singleCaseBlocker: true
    });
    expect(mapGi088CandidateReviewResult({ verdict: "uncertain", category: "contract_or_data", blocker: false, reason: "材料不足，暂时无法形成稳定判断。" })).toMatchObject({
      outcome: "uncertain",
      quality: "quality_failure"
    });
  });

  it("问题结果要求原因和 8 至 300 字理由", () => {
    expect(reviewEntryIsComplete({ verdict: "direct_use", category: "none", blocker: false, reason: "", reviewedAt: new Date().toISOString() }, "candidate")).toBe(true);
    expect(reviewEntryIsComplete({ verdict: "minor_issue", category: "none", blocker: false, reason: "太短", reviewedAt: new Date().toISOString() }, "candidate")).toBe(false);
    expect(reviewEntryIsComplete({ verdict: "minor_issue", category: "low_information_gain", blocker: false, reason: "这轮问题带来的认识增量比较有限。", reviewedAt: new Date().toISOString() }, "candidate")).toBe(true);
    expect(reviewEntryIsComplete({ verdict: "uncertain", category: "low_information_gain", blocker: false, reason: "目前还需要更多材料才能判断这一条。", reviewedAt: new Date().toISOString() }, "golden_a")).toBe(false);
  });

  it("只在 80/20/20 全部完成且 Golden 无不确定时允许封存", () => {
    const inputBundle = bundle();
    const draft = createGi088V8r3InitialReviewDraft(inputBundle);
    const now = "2026-08-11T00:00:00.000Z";
    for (const id of inputBundle.order.candidate) {
      draft.entries[id] = { verdict: "direct_use", category: "none", blocker: false, reason: "", reviewedAt: now };
    }
    for (const id of inputBundle.order.goldenA) {
      draft.entries[id] = { verdict: "direct_use", category: "none", blocker: false, reason: "", reviewedAt: "2026-08-11T01:00:00.000Z" };
    }
    for (const id of inputBundle.order.goldenB) {
      draft.entries[id] = { verdict: "direct_use", category: "none", blocker: false, reason: "", reviewedAt: "2026-08-11T02:00:00.000Z" };
    }
    expect(validateGi088V8r3FinalReview(draft, inputBundle)).toEqual({ ok: true, issues: [] });
    draft.entries[inputBundle.order.goldenA[0]!] = { verdict: "uncertain", category: "contract_or_data", blocker: false, reason: "当前证据仍然不足，需要再复核一次。", reviewedAt: now };
    expect(validateGi088V8r3FinalReview(draft, inputBundle).ok).toBe(false);
  });
});
