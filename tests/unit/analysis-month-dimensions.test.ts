import { buildAnalysisMonthDimensions } from "@/features/analysis/month-dimensions";
import type { AnalysisSavedEntrySource } from "@/features/analysis/types";
import type { HappinessScoreRequestKey } from "@/features/happiness-score/types";

const entries: AnalysisSavedEntrySource[] = [
  {
    id: "joy-early",
    date: "2026-05-02",
    dimension: "joy",
    title: "一起吃晚饭",
    content: "和家人一起吃晚饭时，我从绷着慢慢松了下来。",
    tags: ["关系型开心"],
    payload: {
      kind: "joy",
      joyMoment: "和家人一起吃晚饭",
      joySource: "被家人的陪伴接住了",
      stateShift: "从绷着到松下来",
      meaningNeed: "连接感",
      manualClue: "慢下来相处时，我会恢复能量",
      delightSignature: null,
      directionSignal: null,
      valueImpact: null,
      durability: null,
      tags: ["关系型开心"]
    },
    savedAt: "2026-05-02T13:00:00.000Z",
    updatedAt: "2026-05-02T12:00:00.000Z"
  },
  {
    id: "joy-late",
    date: "2026-05-20",
    dimension: "joy",
    title: "散步时松下来",
    content: "一起散步时，那种不用解释的陪伴让我轻松下来。",
    tags: ["关系型开心", "轻松踏实"],
    payload: {
      kind: "joy",
      joyMoment: "和家人一起散步",
      joySource: "不用解释也能放松的陪伴",
      stateShift: "重新变得轻松",
      meaningNeed: "陪伴",
      manualClue: null,
      delightSignature: "没负担的陪伴会把我带回轻松里",
      directionSignal: null,
      valueImpact: null,
      durability: null,
      tags: ["关系型开心", "轻松踏实"]
    },
    savedAt: "2026-05-20T13:00:00.000Z",
    updatedAt: "2026-05-20T12:00:00.000Z"
  }
];

const factorAverages: Record<HappinessScoreRequestKey, number | null> = {
  meaning: null,
  health: null,
  virtue: null,
  autonomy: null,
  interest: 8,
  skill: null,
  relationship: 9,
  livingCondition: null
};

describe("analysis month dimensions", () => {
  it("keeps dimension evidence, ordering, confidence, and score-link semantics together", () => {
    const result = buildAnalysisMonthDimensions({
      month: "2026-05",
      entries,
      factorAverages
    });

    expect(result.dimensionBreakdown.find((item) => item.dimension === "joy")).toEqual({
      dimension: "joy",
      savedEntryCount: 2,
      recordedDayCount: 2
    });
    expect(result.dimensions.find((item) => item.dimension === "joy")).toMatchObject({
      savedEntryCount: 2,
      recordedDayCount: 2,
      lastRecordedDate: "2026-05-20",
      confidence: "medium",
      continuity: "intermittent",
      momentum: "starting",
      representativeDates: ["2026-05-20", "2026-05-02"],
      relatedScoreFactors: ["interest", "relationship"],
      scoreLink: {
        average: 8.5,
        status: "supporting",
        summary: "热爱、人际在评分里也不低，这条线不只是写出来了，分数里也能看见。"
      }
    });
    expect(result.dimensions.find((item) => item.dimension === "joy")?.topTags).toEqual([
      { tag: "关系型开心", count: 2 },
      { tag: "轻松踏实", count: 1 }
    ]);
    expect(result.dimensions.find((item) => item.dimension === "joy")?.recentSignals[0]).toEqual({
      entryId: "joy-late",
      date: "2026-05-20",
      primarySignal: "不用解释也能放松的陪伴",
      secondarySignal: "没负担的陪伴会把我带回轻松里"
    });
    expect(result.dimensions.find((item) => item.dimension === "joy")?.evidence[0]).toMatchObject({
      entryId: "joy-late",
      date: "2026-05-20",
      title: "散步时松下来",
      summary: "不用解释也能放松的陪伴"
    });
  });
});
