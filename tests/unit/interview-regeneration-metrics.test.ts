import { describe, expect, it } from "vitest";

import {
  aggregateInterviewRegenerationMetrics,
  type InterviewRegenerationMetricItem
} from "@/features/ai-quality/regeneration-metrics";

function metricItem(overrides: Partial<InterviewRegenerationMetricItem> = {}): InterviewRegenerationMetricItem {
  return {
    intent: "simplify",
    status: "completed",
    latencyMs: 1_000,
    answeredAt: new Date("2026-07-20T10:00:00.000Z"),
    replacedAt: null,
    switchedBackAt: null,
    downvotedAt: null,
    abandonedAt: null,
    usedFallback: false,
    dimension: "joy",
    questionTarget: "event_anchor",
    ...overrides
  };
}

describe("访谈重新生成质量指标", () => {
  it("只把获得回答且未出现后续负向行为的版本计为修复成功", () => {
    const metrics = aggregateInterviewRegenerationMetrics({
      periodStart: new Date("2026-07-01T00:00:00.000Z"),
      periodEnd: new Date("2026-08-01T00:00:00.000Z"),
      items: [
        metricItem(),
        metricItem({ intent: "concretize", replacedAt: new Date("2026-07-20T10:01:00.000Z") }),
        metricItem({ intent: "deepen", switchedBackAt: new Date("2026-07-20T10:01:00.000Z") }),
        metricItem({ intent: "lighten", downvotedAt: new Date("2026-07-20T10:01:00.000Z") }),
        metricItem({ intent: "change_angle", abandonedAt: new Date("2026-07-20T10:01:00.000Z") }),
        metricItem({ answeredAt: null }),
        metricItem({ status: "failed", answeredAt: null, latencyMs: null })
      ]
    });

    expect(metrics.total).toBe(7);
    expect(metrics.completed).toBe(6);
    expect(metrics.successCount).toBe(1);
    expect(metrics.successRate).toBeCloseTo(1 / 6);
    expect(metrics.adoptionRate).toBeCloseTo(5 / 6);
    expect(metrics.failureRate).toBeCloseTo(1 / 7);
    expect(metrics.fallbackRate).toBe(0);
    expect(metrics.dimensions.find((item) => item.key === "joy")?.total).toBe(7);
    expect(metrics.questionTargets).toEqual([
      expect.objectContaining({ key: "event_anchor", total: 7 })
    ]);
  });

  it("按意图拆分使用量、成功率并计算等待时间", () => {
    const metrics = aggregateInterviewRegenerationMetrics({
      periodStart: new Date("2026-07-01T00:00:00.000Z"),
      periodEnd: new Date("2026-08-01T00:00:00.000Z"),
      items: [
        metricItem({ intent: "simplify", latencyMs: 100 }),
        metricItem({ intent: "simplify", latencyMs: 200, answeredAt: null }),
        metricItem({ intent: "concretize", latencyMs: 300 }),
        metricItem({ intent: "change_angle", latencyMs: 400 }),
        metricItem({ intent: "deepen", latencyMs: 500 }),
        metricItem({ intent: "lighten", latencyMs: 600, usedFallback: true })
      ]
    });

    expect(metrics.averageLatencyMs).toBe(350);
    expect(metrics.p95LatencyMs).toBe(600);
    expect(metrics.fallbackRate).toBeCloseTo(1 / 6);
    expect(metrics.intents.find((item) => item.intent === "simplify")).toMatchObject({
      total: 2,
      completed: 2,
      successCount: 1,
      successRate: 0.5
    });
    expect(metrics.intents).toHaveLength(5);
  });
});
