import { buildEntryDateRange } from "@/features/analysis/date-range";
import type { AnalysisRangePreset } from "@/features/analysis/date-range";
import type { AnalysisMonthRecord, AnalysisTrendsRangeRecord } from "@/features/analysis/types";
import { happinessScoreKeyPairs } from "@/features/happiness-score/types";

function roundScoreAverage(value: number) {
  return Math.round(value * 10) / 10;
}

export function projectAnalysisTrendsRangeFromMonth(
  record: AnalysisMonthRecord,
  input: {
    preset: AnalysisRangePreset;
    startDate: string;
    endDate: string;
  }
): AnalysisTrendsRangeRecord {
  const dateSet = new Set(buildEntryDateRange(input.startDate, input.endDate));
  const dailyCoverage = record.dailyCoverage.filter((day) => dateSet.has(day.date));
  const scoreTrendDays = record.scoreTrend.days.filter((day) => dateSet.has(day.date));
  const scoredDays = scoreTrendDays.filter((day) => day.hasScore);
  const factorAverages = Object.fromEntries(
    happinessScoreKeyPairs.map((item) => {
      const values = scoredDays
        .map((day) => day.scores[item.requestKey])
        .filter((value): value is number => typeof value === "number");

      if (values.length === 0) {
        return [item.requestKey, null];
      }

      return [item.requestKey, roundScoreAverage(values.reduce((sum, value) => sum + value, 0) / values.length)];
    })
  ) as AnalysisTrendsRangeRecord["scoreTrend"]["factorAverages"];

  const monthAverageScore =
    scoredDays.length > 0
      ? roundScoreAverage(scoredDays.reduce((sum, day) => sum + (day.averageScore ?? 0), 0) / scoredDays.length)
      : null;

  return {
    preset: input.preset,
    startDate: input.startDate,
    endDate: input.endDate,
    logOverview: {
      recordedDayCount: dailyCoverage.filter((day) => day.savedDimensionCount > 0).length,
      savedEntryCount: dailyCoverage.reduce((sum, day) => sum + day.savedEntryCount, 0),
      dailyJournalSavedDayCount: dailyCoverage.filter((day) => day.hasDailyJournalSaved).length
    },
    dailyCoverage,
    scoreOverview: {
      scoredDayCount: scoredDays.length,
      monthAverageScore,
      latestScoredDate: scoredDays.at(-1)?.date ?? null
    },
    scoreTrend: {
      days: scoreTrendDays,
      factorAverages
    }
  };
}
