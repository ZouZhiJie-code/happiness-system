import { buildAnalysisMonthCoverage } from "@/features/analysis/month-coverage";
import { buildAnalysisMonthDimensions } from "@/features/analysis/month-dimensions";
import { buildAnalysisInsightsOverview } from "@/features/analysis/month-insights";
import type {
  AnalysisMonthRecord,
  AnalysisSavedDailyJournalSource,
  AnalysisSavedEntrySource
} from "@/features/analysis/types";
import type { DailyHappinessScoreRecord } from "@/features/happiness-score/types";

export { buildAnalysisScoreTrend } from "@/features/analysis/month-coverage";

export function aggregateAnalysisMonth(input: {
  month: string;
  entries: AnalysisSavedEntrySource[];
  dailyJournals: AnalysisSavedDailyJournalSource[];
  scoreRecords: DailyHappinessScoreRecord[];
  today: string;
}): Omit<AnalysisMonthRecord, "scoreRecords" | "editableDates" | "narrative"> {
  const {
    dailyCoverage,
    rhythmOverview,
    scoreOverview,
    scoreTrend
  } = buildAnalysisMonthCoverage(input);
  const { dimensionBreakdown, dimensions } = buildAnalysisMonthDimensions({
    month: input.month,
    entries: input.entries,
    factorAverages: scoreTrend.factorAverages
  });

  return {
    month: input.month,
    logOverview: {
      recordedDayCount: dailyCoverage.filter((day) => day.savedDimensionCount > 0).length,
      savedEntryCount: input.entries.length,
      dailyJournalSavedDayCount: input.dailyJournals.length
    },
    dailyCoverage,
    rhythmOverview,
    dimensionBreakdown,
    dimensions,
    insightsOverview: buildAnalysisInsightsOverview(dimensions, dailyCoverage),
    scoreOverview,
    scoreTrend
  };
}
