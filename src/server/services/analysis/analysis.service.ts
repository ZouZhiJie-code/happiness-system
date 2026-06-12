import { aggregateAnalysisMonth } from "@/features/analysis/aggregate-month";
import { aggregateAnalysisTrendsRange } from "@/features/analysis/aggregate-trends-range";
import {
  buildEntryDateRange,
  getMonthDateRangeForAnalysis,
  getWeekDateRange,
  isValidAnalysisMonthKey,
  normalizeAnalysisRangePreset,
  type AnalysisRangePreset
} from "@/features/analysis/date-range";
import { generateMonthNarrative } from "@/features/analysis/narrative-service";
import type { AnalysisMonthRecord, AnalysisTrendsRangeRecord } from "@/features/analysis/types";
import { getTodayEntryDate, isEntryDateString } from "@/features/interview/entry-date";
import { listAnalysisSourcesByDateRange } from "@/server/repositories/analysis.repository";
import { listDailyHappinessScoresByDateRange } from "@/server/repositories/daily-happiness-score.repository";
import { getPreviousEntryDate } from "@/server/services/happiness-score/happiness-score.service";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export class AnalysisQueryError extends Error {
  constructor(
    readonly code: "INVALID_ANALYSIS_MONTH" | "INVALID_ANALYSIS_RANGE" | "ANALYSIS_QUERY_FAILED",
    message?: string,
    readonly cause?: unknown
  ) {
    super(message ?? code);
    this.name = "AnalysisQueryError";
  }
}

function assertAnalysisMonth(month: string) {
  if (!MONTH_PATTERN.test(month)) {
    throw new AnalysisQueryError("INVALID_ANALYSIS_MONTH");
  }

  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new AnalysisQueryError("INVALID_ANALYSIS_MONTH");
  }

  const parsedMonth = new Date(Date.UTC(year, monthNumber - 1, 1));
  const formattedMonth = `${parsedMonth.getUTCFullYear()}-${String(parsedMonth.getUTCMonth() + 1).padStart(2, "0")}`;

  if (formattedMonth !== month) {
    throw new AnalysisQueryError("INVALID_ANALYSIS_MONTH");
  }
}

function getMonthDateRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(daysInMonth).padStart(2, "0")}`
  };
}

function getEditableDatesForAnalysisMonth(month: string, today = getTodayEntryDate()) {
  if (month !== today.slice(0, 7)) {
    return [];
  }

  return [today, getPreviousEntryDate(today)];
}

function getScoreRangesForAnalysisMonth(month: string, today = getTodayEntryDate()) {
  const ranges = [getMonthDateRange(month)];
  const editableDates = getEditableDatesForAnalysisMonth(month, today);
  const yesterday = editableDates[1];

  if (yesterday && yesterday.slice(0, 7) !== month) {
    ranges.push({
      startDate: yesterday,
      endDate: yesterday
    });
  }

  return { ranges, editableDates };
}

function resolveAnalysisTrendsDateRange(input: {
  preset: AnalysisRangePreset;
  month?: string;
  startDate?: string;
  endDate?: string;
  today?: string;
}) {
  const today = input.today ?? getTodayEntryDate();
  const preset = input.preset;

  if (preset === "week") {
    if (
      input.startDate &&
      input.endDate &&
      isEntryDateString(input.startDate) &&
      isEntryDateString(input.endDate) &&
      input.startDate <= input.endDate
    ) {
      return {
        startDate: input.startDate,
        endDate: input.endDate
      };
    }

    const anchorDate = input.endDate && isEntryDateString(input.endDate) ? input.endDate : today;
    return getWeekDateRange(anchorDate);
  }

  if (preset === "month") {
    const month = input.month && isValidAnalysisMonthKey(input.month) ? input.month : today.slice(0, 7);
    return getMonthDateRangeForAnalysis(month, today);
  }

  if (!input.startDate || !input.endDate || !isEntryDateString(input.startDate) || !isEntryDateString(input.endDate)) {
    throw new AnalysisQueryError("INVALID_ANALYSIS_RANGE");
  }

  if (input.startDate > input.endDate) {
    throw new AnalysisQueryError("INVALID_ANALYSIS_RANGE");
  }

  try {
    buildEntryDateRange(input.startDate, input.endDate);
  } catch {
    throw new AnalysisQueryError("INVALID_ANALYSIS_RANGE");
  }

  return {
    startDate: input.startDate,
    endDate: input.endDate
  };
}

export async function getAnalysisTrendsRange(
  userId: string,
  input: {
    preset?: string | null;
    month?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }
): Promise<AnalysisTrendsRangeRecord> {
  const preset = normalizeAnalysisRangePreset(input.preset);
  const today = getTodayEntryDate();

  try {
    const { startDate, endDate } = resolveAnalysisTrendsDateRange({
      preset,
      month: input.month ?? undefined,
      startDate: input.startDate ?? undefined,
      endDate: input.endDate ?? undefined,
      today
    });

    const [sources, scoreRecords] = await Promise.all([
      listAnalysisSourcesByDateRange({ userId, startDate, endDate }),
      listDailyHappinessScoresByDateRange(userId, { startDate, endDate })
    ]);

    return aggregateAnalysisTrendsRange({
      preset,
      startDate,
      endDate,
      entries: sources.entries,
      dailyJournals: sources.dailyJournals,
      scoreRecords
    });
  } catch (error) {
    if (error instanceof AnalysisQueryError) {
      throw error;
    }

    throw new AnalysisQueryError("ANALYSIS_QUERY_FAILED", undefined, error);
  }
}

export async function getAnalysisMonth(userId: string, month: string): Promise<AnalysisMonthRecord> {
  assertAnalysisMonth(month);
  const today = getTodayEntryDate();
  const { ranges, editableDates } = getScoreRangesForAnalysisMonth(month, today);

  try {
    const [sources, ...scoreRecordGroups] = await Promise.all([
      listAnalysisSourcesByDateRange({ userId, ...getMonthDateRange(month) }),
      ...ranges.map((range) => listDailyHappinessScoresByDateRange(userId, range))
    ]);
    const scoreRecords = [...new Map(scoreRecordGroups.flat().map((record) => [record.date, record])).values()];

    const aggregated = aggregateAnalysisMonth({
        month,
        entries: sources.entries,
        dailyJournals: sources.dailyJournals,
        scoreRecords,
        today
      });

    return {
      ...aggregated,
      scoreRecords,
      editableDates,
      narrative: generateMonthNarrative(aggregated)
    };
  } catch (error) {
    if (error instanceof AnalysisQueryError) {
      throw error;
    }

    throw new AnalysisQueryError("ANALYSIS_QUERY_FAILED", undefined, error);
  }
}
