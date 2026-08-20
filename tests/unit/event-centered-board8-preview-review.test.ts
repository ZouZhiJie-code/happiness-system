import {
  BOARD8_GI058_PREVIEW_REVIEW,
  canOpenBoard8Gi058PreviewReview,
  summarizeBoard8PreviewReview
} from "@/features/interview/event-centered/board8-preview-review";

describe("Board8 GI-058 本机人工评审门", () => {
  const localReviewInput = {
    nodeEnv: "development",
    host: "localhost:3000",
    databaseUrl: "postgresql://reviewer@127.0.0.1:5432/happiness_board8_preview_20260803_gi058_local",
    reviewEnabled: "I_UNDERSTAND"
  };

  it("只对显式启用的本机隔离 Preview 开放", () => {
    expect(canOpenBoard8Gi058PreviewReview(localReviewInput)).toBe(true);
    expect(canOpenBoard8Gi058PreviewReview({ ...localReviewInput, host: "preview.example.com" })).toBe(false);
    expect(canOpenBoard8Gi058PreviewReview({ ...localReviewInput, forwardedHost: "preview.example.com" })).toBe(false);
    expect(canOpenBoard8Gi058PreviewReview({ ...localReviewInput, nodeEnv: "production" })).toBe(false);
    expect(canOpenBoard8Gi058PreviewReview({ ...localReviewInput, reviewEnabled: undefined })).toBe(false);
    expect(canOpenBoard8Gi058PreviewReview({
      ...localReviewInput,
      databaseUrl: "postgresql://reviewer@127.0.0.1:5432/happiness"
    })).toBe(false);
  });

  it("按冻结人工体验门给出 Go / No-Go 建议", () => {
    const allPass = Object.fromEntries(
      BOARD8_GI058_PREVIEW_REVIEW.cases.map((item) => [item.id, { verdict: "pass" as const }])
    );
    expect(summarizeBoard8PreviewReview(allPass)).toMatchObject({
      completedCount: 8,
      passCount: 8,
      conditionalPassCount: 0,
      failCount: 0,
      recommendation: "go"
    });

    const oneFailure = {
      ...allPass,
      [BOARD8_GI058_PREVIEW_REVIEW.cases[0]!.id]: { verdict: "fail" as const }
    };
    expect(summarizeBoard8PreviewReview(oneFailure).recommendation).toBe("no_go");

    const incomplete = {
      [BOARD8_GI058_PREVIEW_REVIEW.cases[0]!.id]: { verdict: "pass" as const }
    };
    expect(summarizeBoard8PreviewReview(incomplete).recommendation).toBe("pending");
  });
});
