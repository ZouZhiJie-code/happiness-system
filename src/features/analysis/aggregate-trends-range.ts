import { buildDailyJournalSourceSignature } from "@/features/daily-journal/source-signature";
import { pickLatestDailyJournalSourcesByDimension } from "@/features/daily-journal/source-selection";
import type {
  AnalysisDailyCoverageDay,
  AnalysisLogOverview,
  AnalysisSavedDailyJournalSource,
  AnalysisSavedEntrySource,
  AnalysisScoreOverview,
  AnalysisScoreTrend,
  AnalysisTrendsRangeRecord
} from "@/features/analysis/types";
import type { AnalysisRangePreset } from "@/features/analysis/date-range";
import { buildEntryDateRange } from "@/features/analysis/date-range";
import { interviewDimensions } from "@/features/interview/dimensions";
import {
  happinessScoreKeyPairs,
  type DailyHappinessScoreRecord,
  type HappinessScoreRequestKey
} from "@/features/happiness-score/types";

function roundScoreAverage(value: number) {
  return Math.round(value * 10) / 10;
}

function buildScoreAverage(record: DailyHappinessScoreRecord) {
  const total = happinessScoreKeyPairs.reduce((sum, item) => sum + record[item.recordKey], 0);
  return roundScoreAverage(total / happinessScoreKeyPairs.length);
}

function buildEmptyScoreMap() {
  return Object.fromEntries(happinessScoreKeyPairs.map((item) => [item.requestKey, null])) as Record<
    HappinessScoreRequestKey,
    number | null
  >;
}

function buildContentPreview(content: string, maxLines = 3, maxLength = 120) {
  const lines = content.split("\n").filter((line) => line.trim().length > 0).slice(0, maxLines);
  const joined = lines.join(" ");
  return joined.length > maxLength ? joined.slice(0, maxLength) + "…" : joined;
}

function buildDailyCoverageForDates(input: {
  dates: string[];
  entries: AnalysisSavedEntrySource[];
  dailyJournals: AnalysisSavedDailyJournalSource[];
  scoreRecords: DailyHappinessScoreRecord[];
}): AnalysisDailyCoverageDay[] {
  const dailyJournalByDate = new Map(input.dailyJournals.map((entry) => [entry.date, entry]));
  const entriesByDate = input.entries.reduce((stats, entry) => {
    const current = stats.get(entry.date);

    if (current) {
      current.push(entry);
    } else {
      stats.set(entry.date, [entry]);
    }

    return stats;
  }, new Map<string, AnalysisSavedEntrySource[]>());
  const scoreRecordsByDate = new Map(input.scoreRecords.map((record) => [record.date, record]));

  return input.dates.map((date) => {
    const dateEntries = entriesByDate.get(date) ?? [];
    const savedDimensions = interviewDimensions.filter((dimension) =>
      dateEntries.some((entry) => entry.dimension === dimension)
    );
    const scoreRecord = scoreRecordsByDate.get(date);
    const dailyJournal = dailyJournalByDate.get(date) ?? null;
    const currentSourceSignature = buildDailyJournalSourceSignature(
      pickLatestDailyJournalSourcesByDimension(dateEntries)
    );
    const hasDailyJournalSaved = Boolean(dailyJournal);
    const hasStaleDailyJournal = Boolean(dailyJournal && dailyJournal.sourceSignature !== currentSourceSignature);

    return {
      date,
      savedEntryCount: dateEntries.length,
      savedDimensionCount: savedDimensions.length,
      savedDimensions,
      hasDailyJournalSaved,
      hasStaleDailyJournal,
      hasScore: Boolean(scoreRecord),
      averageScore: scoreRecord ? buildScoreAverage(scoreRecord) : null,
      journalTitle: dailyJournal?.title ?? null,
      contentPreview: dailyJournal?.content ? buildContentPreview(dailyJournal.content) : null
    };
  });
}

function buildAnalysisScoreTrendForDates(input: {
  dates: string[];
  scoreRecords: DailyHappinessScoreRecord[];
}): {
  scoreOverview: AnalysisScoreOverview;
  scoreTrend: AnalysisScoreTrend;
} {
  const dateSet = new Set(input.dates);
  const recordsByDate = new Map(
    input.scoreRecords.filter((record) => dateSet.has(record.date)).map((record) => [record.date, record])
  );

  const days = input.dates.map((date) => {
    const record = recordsByDate.get(date);

    if (!record) {
      return {
        date,
        averageScore: null,
        scores: buildEmptyScoreMap(),
        hasScore: false
      };
    }

    return {
      date,
      averageScore: buildScoreAverage(record),
      scores: Object.fromEntries(
        happinessScoreKeyPairs.map((item) => [item.requestKey, record[item.recordKey]])
      ) as Record<HappinessScoreRequestKey, number>,
      hasScore: true
    };
  });

  const scoredDays = days.filter((day) => day.hasScore);
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
  ) as AnalysisScoreTrend["factorAverages"];

  const monthAverageScore =
    scoredDays.length > 0
      ? roundScoreAverage(scoredDays.reduce((sum, day) => sum + (day.averageScore ?? 0), 0) / scoredDays.length)
      : null;

  return {
    scoreOverview: {
      scoredDayCount: scoredDays.length,
      monthAverageScore,
      latestScoredDate: scoredDays.at(-1)?.date ?? null
    },
    scoreTrend: {
      days,
      factorAverages
    }
  };
}

export function aggregateAnalysisTrendsRange(input: {
  preset: AnalysisRangePreset;
  startDate: string;
  endDate: string;
  entries: AnalysisSavedEntrySource[];
  dailyJournals: AnalysisSavedDailyJournalSource[];
  scoreRecords: DailyHappinessScoreRecord[];
}): AnalysisTrendsRangeRecord {
  const dates = buildEntryDateRange(input.startDate, input.endDate);
  const dailyCoverage = buildDailyCoverageForDates({
    dates,
    entries: input.entries,
    dailyJournals: input.dailyJournals,
    scoreRecords: input.scoreRecords
  });
  const { scoreOverview, scoreTrend } = buildAnalysisScoreTrendForDates({
    dates,
    scoreRecords: input.scoreRecords
  });

  const logOverview: AnalysisLogOverview = {
    recordedDayCount: dailyCoverage.filter((day) => day.savedDimensionCount > 0).length,
    savedEntryCount: input.entries.length,
    dailyJournalSavedDayCount: input.dailyJournals.length
  };

  return {
    preset: input.preset,
    startDate: input.startDate,
    endDate: input.endDate,
    logOverview,
    dailyCoverage,
    scoreOverview,
    scoreTrend
  };
}
