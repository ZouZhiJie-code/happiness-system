import { buildDailyJournalSourceSignature } from "@/features/daily-journal/source-signature";
import { pickLatestDailyJournalSourcesByDimension } from "@/features/daily-journal/source-selection";
import {
  buildMonthDates,
  compareDateDesc,
  roundScoreAverage
} from "@/features/analysis/month-aggregation-utils";
import type {
  AnalysisDateSpan,
  AnalysisDailyCoverageDay,
  AnalysisRhythmOverview,
  AnalysisSavedDailyJournalSource,
  AnalysisSavedEntrySource,
  AnalysisScoreOverview,
  AnalysisScoreTrend
} from "@/features/analysis/types";
import {
  happinessScoreKeyPairs,
  type DailyHappinessScoreRecord
} from "@/features/happiness-score/types";
import { interviewDimensions } from "@/features/interview/dimensions";

function buildContentPreview(content: string, maxLines = 3, maxLength = 120) {
  const lines = content.split("\n").filter((line) => line.trim().length > 0).slice(0, maxLines);
  const joined = lines.join(" ");
  return joined.length > maxLength ? joined.slice(0, maxLength) + "…" : joined;
}

function buildScoreAverage(record: DailyHappinessScoreRecord) {
  const total = happinessScoreKeyPairs.reduce((sum, item) => sum + record[item.recordKey], 0);
  return roundScoreAverage(total / happinessScoreKeyPairs.length);
}

function buildDailyCoverage(input: {
  month: string;
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

  return buildMonthDates(input.month).map((date) => {
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

function isPendingDailyJournalDay(day: AnalysisDailyCoverageDay) {
  return day.hasStaleDailyJournal || (day.savedDimensionCount > 0 && !day.hasDailyJournalSaved);
}

function buildEmptyScoreMap() {
  return Object.fromEntries(happinessScoreKeyPairs.map((item) => [item.requestKey, null])) as Record<
    (typeof happinessScoreKeyPairs)[number]["requestKey"],
    number | null
  >;
}

function getObservedCoverageDays(input: {
  month: string;
  dailyCoverage: AnalysisDailyCoverageDay[];
  today: string;
}) {
  if (input.month > input.today.slice(0, 7)) {
    return [];
  }

  if (input.month !== input.today.slice(0, 7)) {
    return input.dailyCoverage;
  }

  return input.dailyCoverage.filter((day) => day.date <= input.today);
}

function isActiveCoverageDay(day: AnalysisDailyCoverageDay) {
  return day.savedDimensionCount > 0 || day.hasDailyJournalSaved;
}

function findLatestDate(days: AnalysisDailyCoverageDay[], predicate: (day: AnalysisDailyCoverageDay) => boolean) {
  return days
    .filter(predicate)
    .sort((left, right) => compareDateDesc(left.date, right.date))[0]?.date ?? null;
}

function buildLongestSpan(days: AnalysisDailyCoverageDay[], predicate: (day: AnalysisDailyCoverageDay) => boolean): AnalysisDateSpan | null {
  let best: AnalysisDateSpan | null = null;
  let currentStart: string | null = null;
  let currentEnd: string | null = null;
  let currentLength = 0;

  for (const day of days) {
    if (predicate(day)) {
      currentStart ??= day.date;
      currentEnd = day.date;
      currentLength += 1;
      continue;
    }

    if (currentStart && currentEnd && (!best || currentLength > best.length)) {
      best = {
        startDate: currentStart,
        endDate: currentEnd,
        length: currentLength
      };
    }

    currentStart = null;
    currentEnd = null;
    currentLength = 0;
  }

  if (currentStart && currentEnd && (!best || currentLength > best.length)) {
    best = {
      startDate: currentStart,
      endDate: currentEnd,
      length: currentLength
    };
  }

  return best;
}

function buildRhythmOverview(input: {
  month: string;
  dailyCoverage: AnalysisDailyCoverageDay[];
  today: string;
}): AnalysisRhythmOverview {
  const observedCoverageDays = getObservedCoverageDays(input);
  const activeObservedDays = observedCoverageDays.filter(isActiveCoverageDay);
  const scoreOnlyDays = observedCoverageDays.filter(
    (day) => day.hasScore && day.savedDimensionCount === 0 && !day.hasDailyJournalSaved
  );
  const pendingDailyJournalDays = observedCoverageDays.filter(isPendingDailyJournalDay);

  return {
    activeObservedDayCount: activeObservedDays.length,
    scoreOnlyDayCount: scoreOnlyDays.length,
    pendingDailyJournalCount: pendingDailyJournalDays.length,
    longestStreak: buildLongestSpan(observedCoverageDays, isActiveCoverageDay),
    longestGap: buildLongestSpan(
      observedCoverageDays,
      (day) => day.savedDimensionCount === 0 && !day.hasDailyJournalSaved && !day.hasScore
    ),
    latestActiveDate: findLatestDate(observedCoverageDays, isActiveCoverageDay),
    latestScoreOnlyDate: findLatestDate(
      observedCoverageDays,
      (day) => day.hasScore && day.savedDimensionCount === 0 && !day.hasDailyJournalSaved
    ),
    latestPendingDailyJournalDate: findLatestDate(observedCoverageDays, isPendingDailyJournalDay)
  };
}

export function buildAnalysisScoreTrend(input: {
  month: string;
  scoreRecords: DailyHappinessScoreRecord[];
}): {
  scoreOverview: AnalysisScoreOverview;
  scoreTrend: AnalysisScoreTrend;
} {
  const monthDates = buildMonthDates(input.month);
  const dateSet = new Set(monthDates);
  const recordsByDate = new Map(
    input.scoreRecords.filter((record) => dateSet.has(record.date)).map((record) => [record.date, record])
  );

  const days = monthDates.map((date) => {
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
      ) as Record<(typeof happinessScoreKeyPairs)[number]["requestKey"], number>,
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
      ? roundScoreAverage(
          scoredDays.reduce((sum, day) => sum + (day.averageScore ?? 0), 0) / scoredDays.length
        )
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

export function buildAnalysisMonthCoverage(input: {
  month: string;
  entries: AnalysisSavedEntrySource[];
  dailyJournals: AnalysisSavedDailyJournalSource[];
  scoreRecords: DailyHappinessScoreRecord[];
  today: string;
}) {
  const dailyCoverage = buildDailyCoverage(input);
  const { scoreOverview, scoreTrend } = buildAnalysisScoreTrend(input);

  return {
    dailyCoverage,
    rhythmOverview: buildRhythmOverview({
      month: input.month,
      dailyCoverage,
      today: input.today
    }),
    scoreOverview,
    scoreTrend
  };
}
