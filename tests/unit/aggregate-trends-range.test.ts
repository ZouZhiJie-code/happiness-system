import { aggregateAnalysisTrendsRange } from "@/features/analysis/aggregate-trends-range";

describe("aggregateAnalysisTrendsRange", () => {
  it("aggregates score trend and log coverage for a short custom range", () => {
    const result = aggregateAnalysisTrendsRange({
      preset: "custom",
      startDate: "2026-06-01",
      endDate: "2026-06-03",
      entries: [
        {
          id: "entry-1",
          date: "2026-06-02",
          dimension: "joy",
          title: "清醒地开始",
          content: "那天早上比平时早醒半小时，没有急着看手机。",
          tags: [],
          payload: null,
          savedAt: "2026-06-02T01:00:00.000Z",
          updatedAt: "2026-06-02T02:00:00.000Z"
        }
      ],
      dailyJournals: [],
      scoreRecords: [
        {
          id: "score-1",
          date: "2026-06-02",
          meaningScore: 8,
          healthScore: 7,
          virtueScore: 9,
          autonomyScore: 6,
          interestScore: 8,
          skillScore: 7,
          relationshipScore: 9,
          livingConditionScore: 6,
          createdAt: "2026-06-02T01:00:00.000Z",
          updatedAt: "2026-06-02T02:00:00.000Z"
        }
      ]
    });

    expect(result.preset).toBe("custom");
    expect(result.startDate).toBe("2026-06-01");
    expect(result.endDate).toBe("2026-06-03");
    expect(result.logOverview.recordedDayCount).toBe(1);
    expect(result.scoreOverview.scoredDayCount).toBe(1);
    expect(result.scoreOverview.monthAverageScore).toBe(7.5);
    expect(result.scoreTrend.days).toEqual([
      { date: "2026-06-01", hasScore: false, averageScore: null, scores: expect.any(Object) },
      { date: "2026-06-02", hasScore: true, averageScore: 7.5, scores: expect.any(Object) },
      { date: "2026-06-03", hasScore: false, averageScore: null, scores: expect.any(Object) }
    ]);
    expect(result.dailyCoverage.find((day) => day.date === "2026-06-02")?.savedDimensionCount).toBe(1);
  });
});
