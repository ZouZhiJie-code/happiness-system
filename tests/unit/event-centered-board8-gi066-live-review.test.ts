import { describe, expect, it } from "vitest";

import {
  BOARD8_GI066_LIVE_REVIEW,
  canOpenBoard8Gi066LiveReview,
  summarizeBoard8Gi066Reviews
} from "@/features/interview/event-centered/board8-gi066-live-review";

describe("GI-066 人工评审工作台", () => {
  it("只在本机、显式授权和 GI-066 隔离库同时成立时开放", () => {
    const valid = {
      nodeEnv: "development",
      host: "127.0.0.1:3010",
      reviewEnabled: "I_UNDERSTAND",
      databaseUrl: "postgresql://local/happiness_board8_preview_20260804_gi066_fix_manual"
    };
    expect(canOpenBoard8Gi066LiveReview(valid)).toBe(true);
    expect(canOpenBoard8Gi066LiveReview({ ...valid, host: "dailylight.chat" })).toBe(false);
    expect(canOpenBoard8Gi066LiveReview({ ...valid, nodeEnv: "production" })).toBe(false);
    expect(canOpenBoard8Gi066LiveReview({
      ...valid,
      databaseUrl: "postgresql://local/test/production"
    })).toBe(false);
  });

  it("执行四条单角度轨迹并采用 3 通过、最多 1 条件通过、零失败的 Go 门", () => {
    expect(BOARD8_GI066_LIVE_REVIEW.cases).toHaveLength(4);
    expect(summarizeBoard8Gi066Reviews({
      a: { verdict: "pass" },
      b: { verdict: "pass" },
      c: { verdict: "pass" },
      d: { verdict: "conditional_pass" }
    }).recommendation).toBe("go");
    expect(summarizeBoard8Gi066Reviews({
      a: { verdict: "pass" },
      b: { verdict: "pass" },
      c: { verdict: "pass" },
      d: { verdict: "fail" }
    }).recommendation).toBe("no_go");
  });
});
