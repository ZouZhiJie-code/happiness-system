import { buildAnalysisInsightsOverview } from "@/features/analysis/month-insights";
import type {
  AnalysisDailyCoverageDay,
  AnalysisDimensionInsightCard
} from "@/features/analysis/types";
import type { InterviewDimension } from "@/types/interview";

function buildDimensionCard(
  dimension: InterviewDimension,
  overrides: Partial<AnalysisDimensionInsightCard> = {}
): AnalysisDimensionInsightCard {
  return {
    dimension,
    savedEntryCount: 0,
    recordedDayCount: 0,
    lastRecordedDate: null,
    thesis: null,
    confidence: "low",
    momentum: "quiet",
    continuity: "none",
    turningPointDate: null,
    representativeDates: [],
    relatedScoreFactors: [],
    relatedDimensions: [],
    scoreLink: {
      average: null,
      status: "unknown",
      summary: "评分里暂时还看不出这条线。"
    },
    nextQuestion: null,
    topTags: [],
    recentSignals: [],
    evidence: [],
    ...overrides
  };
}

const dimensions: AnalysisDimensionInsightCard[] = [
  buildDimensionCard("joy", {
    savedEntryCount: 3,
    recordedDayCount: 3,
    lastRecordedDate: "2026-05-20",
    confidence: "high",
    momentum: "steady",
    continuity: "sustained",
    turningPointDate: "2026-05-20",
    relatedDimensions: ["reflection"],
    scoreLink: {
      average: 8.5,
      status: "supporting",
      summary: "热爱、人际在评分里也不低，这条线不只是写出来了，分数里也能看见。"
    }
  }),
  buildDimensionCard("fulfillment", {
    scoreLink: {
      average: 8,
      status: "missing",
      summary: "意义、擅长、美德在评分里并不低，但这条线还没写成具体记录。"
    }
  }),
  buildDimensionCard("reflection", {
    savedEntryCount: 2,
    recordedDayCount: 2,
    lastRecordedDate: "2026-05-20",
    confidence: "medium",
    momentum: "starting",
    continuity: "intermittent",
    turningPointDate: "2026-05-20",
    relatedDimensions: ["joy"]
  }),
  buildDimensionCard("improvement", {
    scoreLink: {
      average: 4,
      status: "lagging",
      summary: "擅长、意志、美德在评分里也偏弱，这条线还没有真正展开。"
    }
  }),
  buildDimensionCard("gratitude")
];

const dailyCoverage: AnalysisDailyCoverageDay[] = [
  {
    date: "2026-05-20",
    savedEntryCount: 2,
    savedDimensionCount: 2,
    savedDimensions: ["joy", "reflection"],
    hasDailyJournalSaved: true,
    hasStaleDailyJournal: false,
    hasScore: true,
    averageScore: 7.5,
    journalTitle: "五月二十日",
    contentPreview: "开心和思考在同一天留下了记录。"
  }
];

describe("analysis month insights", () => {
  it("keeps featured, related, quiet, and relationship-link semantics together", () => {
    const result = buildAnalysisInsightsOverview(dimensions, dailyCoverage);

    expect(result.headline).toBe("开心是主线，思考在旁边接上了它，改进还没真正展开。");
    expect(result.featuredDimension).toBe("joy");
    expect(result.quietDimensions).toEqual(["fulfillment", "improvement", "gratitude"]);
    expect(result.watchpoint).toBe("擅长、意志、美德在评分里也偏弱，这条线还没有真正展开。");
    expect(result.links.map((link) => link.type)).toEqual(["pairing", "followup", "score", "gap"]);
    expect(result.links[0]).toMatchObject({
      title: "常常会一起出现",
      dimensions: ["joy", "reflection"],
      anchorDate: "2026-05-20"
    });
  });
});
