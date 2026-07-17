import {
  buildAnalysisMonthCoverage,
  buildAnalysisScoreTrend
} from "@/features/analysis/month-coverage";
import type {
  AnalysisSavedDailyJournalSource,
  AnalysisSavedEntrySource
} from "@/features/analysis/types";
import type { DailyHappinessScoreRecord } from "@/features/happiness-score/types";

const entries: AnalysisSavedEntrySource[] = [
  {
    id: "entry-joy-1",
    date: "2026-05-02",
    dimension: "joy",
    title: "晚饭后的轻松",
    content: "晚饭后和家人散步，我慢慢松了下来。",
    tags: ["陪伴"],
    payload: null,
    savedAt: "2026-05-02T13:00:00.000Z",
    updatedAt: "2026-05-02T12:00:00.000Z"
  }
];

const dailyJournals: AnalysisSavedDailyJournalSource[] = [
  {
    id: "daily-1",
    date: "2026-05-02",
    sourceSignature: "outdated-signature",
    title: "五月二日",
    content: "当天日志"
  }
];

const scoreRecords: DailyHappinessScoreRecord[] = [
  {
    id: "score-in-month",
    date: "2026-05-02",
    meaningScore: 8,
    healthScore: 7,
    virtueScore: 8,
    autonomyScore: 7,
    interestScore: 8,
    skillScore: 7,
    relationshipScore: 8,
    livingConditionScore: 7,
    createdAt: "2026-05-02T01:00:00.000Z",
    updatedAt: "2026-05-02T02:00:00.000Z"
  },
  {
    id: "score-outside-month",
    date: "2026-06-01",
    meaningScore: 10,
    healthScore: 10,
    virtueScore: 10,
    autonomyScore: 10,
    interestScore: 10,
    skillScore: 10,
    relationshipScore: 10,
    livingConditionScore: 10,
    createdAt: "2026-06-01T01:00:00.000Z",
    updatedAt: "2026-06-01T02:00:00.000Z"
  }
];

describe("analysis month coverage", () => {
  it("keeps coverage, stale journal, score filtering, and rhythm semantics together", () => {
    const result = buildAnalysisMonthCoverage({
      month: "2026-05",
      entries,
      dailyJournals,
      scoreRecords,
      today: "2026-05-03"
    });

    expect(result.dailyCoverage).toHaveLength(31);
    expect(result.dailyCoverage.find((day) => day.date === "2026-05-02")).toMatchObject({
      savedEntryCount: 1,
      savedDimensionCount: 1,
      savedDimensions: ["joy"],
      hasDailyJournalSaved: true,
      hasStaleDailyJournal: true,
      hasScore: true,
      averageScore: 7.5,
      journalTitle: "五月二日",
      contentPreview: "当天日志"
    });
    expect(result.scoreOverview).toEqual({
      scoredDayCount: 1,
      monthAverageScore: 7.5,
      latestScoredDate: "2026-05-02"
    });
    expect(result.rhythmOverview).toMatchObject({
      activeObservedDayCount: 1,
      scoreOnlyDayCount: 0,
      pendingDailyJournalCount: 1,
      latestActiveDate: "2026-05-02",
      latestPendingDailyJournalDate: "2026-05-02"
    });
  });

  it("preserves invalid month errors at the score trend boundary", () => {
    expect(() => buildAnalysisScoreTrend({ month: "invalid", scoreRecords: [] })).toThrow("INVALID_MONTH");
  });
});
