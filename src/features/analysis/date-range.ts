import {
  formatEntryDate,
  getTodayEntryDate,
  isEntryDateString,
  parseEntryDateInput
} from "@/features/interview/entry-date";

export const ANALYSIS_RANGE_PRESETS = ["week", "month", "custom"] as const;
export type AnalysisRangePreset = (typeof ANALYSIS_RANGE_PRESETS)[number];

export const MAX_ANALYSIS_RANGE_DAYS = 93;

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export function isValidAnalysisMonthKey(month: string) {
  if (!MONTH_PATTERN.test(month)) {
    return false;
  }

  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return false;
  }

  const parsedMonth = new Date(Date.UTC(year, monthNumber - 1, 1));
  const formattedMonth = `${parsedMonth.getUTCFullYear()}-${String(parsedMonth.getUTCMonth() + 1).padStart(2, "0")}`;

  return formattedMonth === month;
}

export function addEntryDays(date: string, offset: number) {
  const nextDate = parseEntryDateInput(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + offset);
  return formatEntryDate(nextDate);
}

export function buildEntryDateRange(startDate: string, endDate: string) {
  if (!isEntryDateString(startDate) || !isEntryDateString(endDate) || startDate > endDate) {
    throw new Error("INVALID_DATE_RANGE");
  }

  const dates: string[] = [];
  let current = startDate;

  while (current <= endDate) {
    dates.push(current);

    if (dates.length > MAX_ANALYSIS_RANGE_DAYS) {
      throw new Error("ANALYSIS_RANGE_TOO_LONG");
    }

    current = addEntryDays(current, 1);
  }

  return dates;
}

function parseCalendarDateKey(date: string) {
  const [year, monthNumber, dayNumber] = date.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, dayNumber));
}

function formatCalendarDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function getWeekDateRange(anchorDate: string) {
  const current = parseCalendarDateKey(anchorDate);
  const dayOfWeek = current.getUTCDay();
  const startOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  current.setUTCDate(current.getUTCDate() + startOffset);
  const startDate = formatCalendarDateKey(current);

  return {
    startDate,
    endDate: addEntryDays(startDate, 6)
  };
}

export function getMonthDateRangeForAnalysis(month: string, today = getTodayEntryDate()) {
  if (!isValidAnalysisMonthKey(month)) {
    throw new Error("INVALID_ANALYSIS_MONTH");
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const startDate = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, "0")}`;
  const endDate = month === today.slice(0, 7) ? today : monthEnd;

  return { startDate, endDate };
}

export function shiftWeekDateRange(startDate: string, offsetWeeks: number) {
  const shiftedStart = addEntryDays(startDate, offsetWeeks * 7);

  return {
    startDate: shiftedStart,
    endDate: addEntryDays(shiftedStart, 6)
  };
}

export function formatAnalysisDateRangeLabel(startDate: string, endDate: string) {
  if (startDate === endDate) {
    return startDate;
  }

  return `${startDate} — ${endDate}`;
}

export function normalizeAnalysisRangePreset(value: string | null | undefined): AnalysisRangePreset {
  if (value && ANALYSIS_RANGE_PRESETS.includes(value as AnalysisRangePreset)) {
    return value as AnalysisRangePreset;
  }

  return "month";
}
