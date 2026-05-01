import {
  aggregateCalendarDay,
  aggregateCalendarMonth,
  aggregateCalendarWeek
} from "@/features/calendar/aggregate-calendar";
import { isEntryDateString } from "@/features/interview/entry-date";
import { listCalendarSourcesByDate, listCalendarSourcesByDateRange } from "@/server/repositories/calendar.repository";
import type { CalendarDayRecord, CalendarMonthRecord, CalendarWeekRecord } from "@/features/calendar/types";

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

export async function getCalendarDay(date: string): Promise<CalendarDayRecord> {
  assertCalendarDate(date);

  try {
    const sources = await listCalendarSourcesByDate(date);

    return aggregateCalendarDay({
      date,
      sessions: sources.sessions,
      entries: sources.entries
    });
  } catch (error) {
    if (error instanceof CalendarQueryError) {
      throw error;
    }

    throw new CalendarQueryError("CALENDAR_QUERY_FAILED", undefined, error);
  }
}

export async function getCalendarWeek(date: string): Promise<CalendarWeekRecord> {
  assertCalendarDate(date);
  const range = getWeekDateRange(date);

  try {
    const sources = await listCalendarSourcesByDateRange(range);

    return aggregateCalendarWeek({
      anchorDate: date,
      sessions: sources.sessions,
      entries: sources.entries
    });
  } catch (error) {
    if (error instanceof CalendarQueryError) {
      throw error;
    }

    throw new CalendarQueryError("CALENDAR_QUERY_FAILED", undefined, error);
  }
}

export async function getCalendarMonth(month: string): Promise<CalendarMonthRecord> {
  assertCalendarMonth(month);
  const range = getMonthDateRange(month);

  try {
    const sources = await listCalendarSourcesByDateRange(range);

    return aggregateCalendarMonth({
      month,
      sessions: sources.sessions,
      entries: sources.entries
    });
  } catch (error) {
    if (error instanceof CalendarQueryError) {
      throw error;
    }

    throw new CalendarQueryError("CALENDAR_QUERY_FAILED", undefined, error);
  }
}
