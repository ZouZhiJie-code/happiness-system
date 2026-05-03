import { interviewDimensions } from "@/features/interview/dimensions";
import type {
  AnalysisDailyCoverageDay,
  AnalysisDimensionBreakdownItem,
  AnalysisDimensionInsightCard,
  AnalysisMonthRecord,
  AnalysisScoreOverview,
  AnalysisScoreTrend,
  AnalysisSavedDailyJournalSource,
  AnalysisSavedEntrySource
} from "@/features/analysis/types";
import { happinessScoreKeyPairs, type DailyHappinessScoreRecord } from "@/features/happiness-score/types";
import type { InterviewDimension } from "@/types/interview";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

function parseMonthKey(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1));
}

function formatDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function buildMonthDates(month: string) {
  if (!MONTH_PATTERN.test(month)) {
    throw new Error("INVALID_MONTH");
  }

  const startDate = parseMonthKey(month);
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const currentDate = new Date(startDate);
    currentDate.setUTCDate(index + 1);
    return formatDateKey(currentDate);
  });
}

function buildDailyCoverage(input: {
  month: string;
  entries: AnalysisSavedEntrySource[];
  dailyJournals: AnalysisSavedDailyJournalSource[];
}): AnalysisDailyCoverageDay[] {
  const savedJournalDateSet = new Set(input.dailyJournals.map((entry) => entry.date));

  return buildMonthDates(input.month).map((date) => {
    const savedDimensions = interviewDimensions.filter((dimension) =>
      input.entries.some((entry) => entry.date === date && entry.dimension === dimension)
    );

    return {
      date,
      savedDimensionCount: savedDimensions.length,
      savedDimensions,
      hasDailyJournalSaved: savedJournalDateSet.has(date)
    };
  });
}

function buildDimensionBreakdown(entries: AnalysisSavedEntrySource[]): AnalysisDimensionBreakdownItem[] {
  return interviewDimensions.map<AnalysisDimensionBreakdownItem>((dimension: InterviewDimension) => {
    const dimensionEntries = entries.filter((entry) => entry.dimension === dimension);
    const recordedDates = new Set(dimensionEntries.map((entry) => entry.date));

    return {
      dimension,
      savedEntryCount: dimensionEntries.length,
      recordedDayCount: recordedDates.size
    };
  });
}

function normalizeSignalValue(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function resolveEntryTags(entry: AnalysisSavedEntrySource) {
  const candidateTags = Array.isArray(entry.payload?.tags) && entry.payload.tags.length > 0 ? entry.payload.tags : entry.tags;

  return [...new Set(candidateTags.map((tag) => tag.trim()).filter(Boolean))];
}

function resolveDimensionSignals(entry: AnalysisSavedEntrySource) {
  const payload = entry.payload;

  if (!payload || payload.kind !== entry.dimension) {
    return null;
  }

  if (payload.kind === "joy") {
    return {
      primarySignal: normalizeSignalValue(payload.joySource),
      secondarySignal: normalizeSignalValue(payload.manualClue) ?? normalizeSignalValue(payload.delightSignature)
    };
  }

  if (payload.kind === "fulfillment") {
    return {
      primarySignal: normalizeSignalValue(payload.progressEvidence),
      secondarySignal: normalizeSignalValue(payload.valueSignal)
    };
  }

  if (payload.kind === "reflection") {
    return {
      primarySignal: normalizeSignalValue(payload.insight),
      secondarySignal: normalizeSignalValue(payload.viewpointShift)
    };
  }

  if (payload.kind === "improvement") {
    return {
      primarySignal: normalizeSignalValue(payload.controllableFactor) ?? normalizeSignalValue(payload.nextAttempt),
      secondarySignal: normalizeSignalValue(payload.frictionPoint) ?? normalizeSignalValue(payload.repeatCondition)
    };
  }

  return {
    primarySignal: normalizeSignalValue(payload.kindAction) ?? normalizeSignalValue(payload.seenNeed),
    secondarySignal: normalizeSignalValue(payload.relationshipSignal) ?? normalizeSignalValue(payload.gratitudeReason)
  };
}

function compareDateDesc(left: string | null, right: string | null) {
  return right === left ? 0 : right && (!left || right > left) ? 1 : -1;
}

function buildDimensionInsights(entries: AnalysisSavedEntrySource[]): AnalysisDimensionInsightCard[] {
  return interviewDimensions.map<AnalysisDimensionInsightCard>((dimension) => {
    const dimensionEntries = entries.filter((entry) => entry.dimension === dimension);
    const recordedDates = new Set(dimensionEntries.map((entry) => entry.date));
    const lastRecordedDate =
      [...recordedDates].sort((left, right) => compareDateDesc(left, right))[0] ?? null;

    const topTags = [...dimensionEntries.reduce((stats, entry) => {
      for (const tag of resolveEntryTags(entry)) {
        const current = stats.get(tag);

        if (!current) {
          stats.set(tag, {
            tag,
            count: 1,
            latestDate: entry.date
          });
          continue;
        }

        current.count += 1;
        if (entry.date > current.latestDate) {
          current.latestDate = entry.date;
        }
      }

      return stats;
    }, new Map<string, { tag: string; count: number; latestDate: string }>()).values()]
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        const dateDiff = compareDateDesc(left.latestDate, right.latestDate);

        if (dateDiff !== 0) {
          return dateDiff;
        }

        return left.tag.localeCompare(right.tag, "zh-Hans-CN");
      })
      .slice(0, 3)
      .map(({ tag, count }) => ({ tag, count }));

    const recentSignals = dimensionEntries
      .map((entry) => {
        const signals = resolveDimensionSignals(entry);

        if (!signals?.primarySignal && !signals?.secondarySignal) {
          return null;
        }

        return {
          entryId: entry.id,
          date: entry.date,
          primarySignal: signals.primarySignal ?? signals.secondarySignal ?? "",
          secondarySignal: signals.primarySignal ? signals.secondarySignal : null,
          savedAt: entry.savedAt,
          updatedAt: entry.updatedAt
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((left, right) => {
        const dateDiff = compareDateDesc(left.date, right.date);

        if (dateDiff !== 0) {
          return dateDiff;
        }

        const savedAtDiff = compareDateDesc(left.savedAt, right.savedAt);

        if (savedAtDiff !== 0) {
          return savedAtDiff;
        }

        const updatedAtDiff = compareDateDesc(left.updatedAt, right.updatedAt);

        if (updatedAtDiff !== 0) {
          return updatedAtDiff;
        }

        return right.entryId.localeCompare(left.entryId, "en");
      })
      .slice(0, 3)
      .map(({ entryId, date, primarySignal, secondarySignal }) => ({
        entryId,
        date,
        primarySignal,
        secondarySignal
      }));

    return {
      dimension,
      savedEntryCount: dimensionEntries.length,
      recordedDayCount: recordedDates.size,
      lastRecordedDate,
      topTags,
      recentSignals
    };
  });
}

function roundScoreAverage(value: number) {
  return Math.round(value * 10) / 10;
}

function buildScoreAverage(record: DailyHappinessScoreRecord) {
  const total = happinessScoreKeyPairs.reduce((sum, item) => sum + record[item.recordKey], 0);
  return roundScoreAverage(total / happinessScoreKeyPairs.length);
}

function buildEmptyScoreMap() {
  return Object.fromEntries(happinessScoreKeyPairs.map((item) => [item.requestKey, null])) as Record<
    (typeof happinessScoreKeyPairs)[number]["requestKey"],
    number | null
  >;
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

export function aggregateAnalysisMonth(input: {
  month: string;
  entries: AnalysisSavedEntrySource[];
  dailyJournals: AnalysisSavedDailyJournalSource[];
}): Omit<AnalysisMonthRecord, "scoreOverview" | "scoreTrend" | "scoreRecords" | "editableDates"> {
  const dailyCoverage = buildDailyCoverage(input);
  const dimensionBreakdown = buildDimensionBreakdown(input.entries);
  const dimensions = buildDimensionInsights(input.entries);

  return {
    month: input.month,
    logOverview: {
      recordedDayCount: dailyCoverage.filter((day) => day.savedDimensionCount > 0).length,
      savedEntryCount: input.entries.length,
      dailyJournalSavedDayCount: input.dailyJournals.length
    },
    dailyCoverage,
    dimensionBreakdown,
    dimensions
  };
}
