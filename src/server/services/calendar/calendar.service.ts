import {
  aggregateCalendarDay,
  aggregateCalendarMonth,
  aggregateCalendarWeek
} from "@/features/calendar/aggregate-calendar";
import { getTodayEntryDate, isEntryDateString } from "@/features/interview/entry-date";
import { listCalendarSourcesByDate, listCalendarSourcesByDateRange } from "@/server/repositories/calendar.repository";
import type {
  CalendarAction,
  CalendarDayRecord,
  CalendarDimensionStatus,
  CalendarMonthRecord,
  CalendarWeekRecord
} from "@/features/calendar/types";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export class CalendarQueryError extends Error {
  constructor(
    readonly code: "INVALID_CALENDAR_DATE" | "INVALID_CALENDAR_MONTH" | "CALENDAR_QUERY_FAILED",
    message?: string,
    readonly cause?: unknown
  ) {
    super(message ?? code);
    this.name = "CalendarQueryError";
  }
}

function assertCalendarDate(date: string) {
  if (!isEntryDateString(date)) {
    throw new CalendarQueryError("INVALID_CALENDAR_DATE");
  }
}

function assertCalendarMonth(month: string) {
  if (!MONTH_PATTERN.test(month)) {
    throw new CalendarQueryError("INVALID_CALENDAR_MONTH");
  }

  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new CalendarQueryError("INVALID_CALENDAR_MONTH");
  }
}

function parseDateKey(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDays(date: string, offset: number) {
  const nextDate = parseDateKey(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + offset);
  return formatDateKey(nextDate);
}

function getWeekDateRange(date: string) {
  const current = parseDateKey(date);
  const dayOfWeek = current.getUTCDay();
  const startOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  current.setUTCDate(current.getUTCDate() + startOffset);
  const startDate = formatDateKey(current);

  return {
    startDate,
    endDate: addDays(startDate, 6)
  };
}

function getMonthDateRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(daysInMonth).padStart(2, "0")}`
  };
}

function isFutureEntryDate(date: string, today: string) {
  return date > today;
}

function sanitizeFutureActions(actions: CalendarAction[]) {
  return actions.filter((action) => action !== "start_interview" && action !== "continue_interview");
}

function sanitizeFutureDimensionStatus(dimension: CalendarDimensionStatus): CalendarDimensionStatus {
  return {
    ...dimension,
    actions: sanitizeFutureActions(dimension.actions)
  };
}

function resolvePrimaryDimensionForDay(day: CalendarDayRecord) {
  const { primaryAction } = day;

  if (!primaryAction) {
    return null;
  }

  return day.dimensions.find((dimension) => dimension.actions.includes(primaryAction));
}

function sanitizeFutureDayRecord(day: CalendarDayRecord, today: string): CalendarDayRecord {
  if (!isFutureEntryDate(day.date, today)) {
    return day;
  }

  const dimensions = day.dimensions.map(sanitizeFutureDimensionStatus);
  const sourcePrimaryDimension = resolvePrimaryDimensionForDay(day);
  const primaryDimension = sourcePrimaryDimension
    ? dimensions.find((dimension) => dimension.dimension === sourcePrimaryDimension.dimension)
    : null;
  const primaryAction = primaryDimension?.actions.find(Boolean) ?? null;

  return {
    ...day,
    dimensions,
    primaryAction
  };
}

function sanitizeCalendarDay(day: CalendarDayRecord, today = getTodayEntryDate()) {
  return sanitizeFutureDayRecord(day, today);
}

function sanitizeCalendarWeek(week: CalendarWeekRecord, today = getTodayEntryDate()) {
  return {
    ...week,
    days: week.days.map((day) => sanitizeFutureDayRecord(day, today))
  };
}

function sanitizeCalendarMonth(month: CalendarMonthRecord, today = getTodayEntryDate()) {
  return {
    ...month,
    days: month.days.map((day) => sanitizeFutureDayRecord(day, today))
  };
}

export async function getCalendarDay(userId: string, date: string): Promise<CalendarDayRecord> {
  assertCalendarDate(date);

  try {
    const sources = await listCalendarSourcesByDate(userId, date);

    return sanitizeCalendarDay(
      aggregateCalendarDay({
        date,
        sessions: sources.sessions,
        entries: sources.entries,
        dailyJournals: sources.dailyJournals
      })
    );
  } catch (error) {
    if (error instanceof CalendarQueryError) {
      throw error;
    }

    throw new CalendarQueryError("CALENDAR_QUERY_FAILED", undefined, error);
  }
}

export async function getCalendarWeek(userId: string, date: string): Promise<CalendarWeekRecord> {
  assertCalendarDate(date);
  const range = getWeekDateRange(date);

  try {
    const sources = await listCalendarSourcesByDateRange({ userId, ...range });

    return sanitizeCalendarWeek(
      aggregateCalendarWeek({
        anchorDate: date,
        sessions: sources.sessions,
        entries: sources.entries,
        dailyJournals: sources.dailyJournals
      })
    );
  } catch (error) {
    if (error instanceof CalendarQueryError) {
      throw error;
    }

    throw new CalendarQueryError("CALENDAR_QUERY_FAILED", undefined, error);
  }
}

export async function getCalendarMonth(userId: string, month: string): Promise<CalendarMonthRecord> {
  assertCalendarMonth(month);
  const range = getMonthDateRange(month);

  try {
    const sources = await listCalendarSourcesByDateRange({ userId, ...range });

    return sanitizeCalendarMonth(
      aggregateCalendarMonth({
        month,
        sessions: sources.sessions,
        entries: sources.entries,
        dailyJournals: sources.dailyJournals
      })
    );
  } catch (error) {
    if (error instanceof CalendarQueryError) {
      throw error;
    }

    throw new CalendarQueryError("CALENDAR_QUERY_FAILED", undefined, error);
  }
}
