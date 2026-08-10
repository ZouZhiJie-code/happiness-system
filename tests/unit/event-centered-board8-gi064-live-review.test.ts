import {
  BOARD8_GI064_LIVE_REVIEW,
  canOpenBoard8Gi064LiveReview,
  summarizeBoard8Gi064Reviews
} from "@/features/interview/event-centered/board8-gi064-live-review";

describe("Board8 GI-064 本机人工实聊门", () => {
  const localInput = {
    nodeEnv: "development",
    host: "127.0.0.1:3010",
    databaseUrl: "postgresql://reviewer@127.0.0.1:5432/happiness_board8_preview_20260803_gi059_local",
    reviewEnabled: "I_UNDERSTAND"
  };

  it("绑定当前候选血缘，并仅对隔离库的本机页面开放", () => {
    expect(BOARD8_GI064_LIVE_REVIEW).toMatchObject({
      candidateId: "gi064-local-live-preview-v1-candidate-5-62",
      strategyVersion: "5.62.0",
      semanticArtifactVersion: "event-centered-semantic-plan.v14",
      routePath: "/preview/board8-gi064-review"
    });
    expect(canOpenBoard8Gi064LiveReview(localInput)).toBe(true);
    expect(canOpenBoard8Gi064LiveReview({ ...localInput, host: "preview.example.com" })).toBe(false);
    expect(canOpenBoard8Gi064LiveReview({
      ...localInput,
      forwardedHost: "preview-proxy.internal",
    })).toBe(false);
  });

  it("继续沿用六条通过、最多两条条件通过、零失败的人工门", () => {
    const reviews = Object.fromEntries(
      BOARD8_GI064_LIVE_REVIEW.cases.map((item, index) => [
        item.id,
        { verdict: index < 6 ? "pass" as const : "conditional_pass" as const }
      ])
    );
    expect(summarizeBoard8Gi064Reviews(reviews).recommendation).toBe("go");
  });
});
