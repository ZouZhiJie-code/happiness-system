import {
  BOARD8_GI059_LIVE_REVIEW,
  canOpenBoard8Gi059LiveReview,
  summarizeBoard8Gi059Reviews
} from "@/features/interview/event-centered/board8-gi059-live-review";

describe("Board8 GI-059 本机人工实聊门", () => {
  const localInput = {
    nodeEnv: "development",
    host: "127.0.0.1:3010",
    databaseUrl: "postgresql://reviewer@127.0.0.1:5432/happiness_board8_preview_20260803_gi059_local",
    reviewEnabled: "I_UNDERSTAND"
  };

  it("只对本机显式启用的 GI-059 隔离数据库开放", () => {
    expect(canOpenBoard8Gi059LiveReview(localInput)).toBe(true);
    expect(canOpenBoard8Gi059LiveReview({ ...localInput, host: "preview.example.com" })).toBe(false);
    expect(canOpenBoard8Gi059LiveReview({ ...localInput, nodeEnv: "production" })).toBe(false);
    expect(canOpenBoard8Gi059LiveReview({ ...localInput, reviewEnabled: undefined })).toBe(false);
    expect(canOpenBoard8Gi059LiveReview({
      ...localInput,
      databaseUrl: "postgresql://reviewer@127.0.0.1:5432/happiness"
    })).toBe(false);
  });

  it("八条轨迹固定为四条真实事件与四条风控角色卡", () => {
    expect(BOARD8_GI059_LIVE_REVIEW.cases).toHaveLength(8);
    expect(BOARD8_GI059_LIVE_REVIEW.cases.filter((item) => item.material === "产品负责人真实事件")).toHaveLength(4);
    expect(BOARD8_GI059_LIVE_REVIEW.cases.filter((item) => item.material === "风控角色卡")).toHaveLength(4);
    expect(BOARD8_GI059_LIVE_REVIEW.cases.filter((item) => item.depth === "深聊")).toHaveLength(4);
  });

  it("沿用六条通过、最多两条条件通过且零失败的人工门", () => {
    const sixPassTwoConditional = Object.fromEntries(
      BOARD8_GI059_LIVE_REVIEW.cases.map((item, index) => [
        item.id,
        { verdict: index < 6 ? "pass" as const : "conditional_pass" as const }
      ])
    );
    expect(summarizeBoard8Gi059Reviews(sixPassTwoConditional).recommendation).toBe("go");
    expect(summarizeBoard8Gi059Reviews({
      ...sixPassTwoConditional,
      [BOARD8_GI059_LIVE_REVIEW.cases[0]!.id]: { verdict: "fail" }
    }).recommendation).toBe("no_go");
  });
});
