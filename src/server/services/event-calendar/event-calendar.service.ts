import {
  aggregateEventCalendarDay,
  aggregateEventCalendarMonth,
  aggregateEventCalendarWeek
} from "@/features/event-calendar/aggregate-event-calendar";
import { getTodayEntryDate, isEntryDateString, parseEntryDateInput } from "@/features/interview/entry-date";
import {
  listEventCalendarSourcesByDate,
  listEventCalendarSourcesByDateRange
} from "@/server/repositories/event-calendar.repository";
import type {
  EventCalendarAction,
  EventCalendarDayRecord,
  EventCalendarMonthRecord,
  EventCalendarWeekRecord
} from "@/types/event-calendar";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export class EventCalendarQueryError extends Error {
  constructor(
    readonly code: "INVALID_CALENDAR_DATE" | "INVALID_CALENDAR_MONTH" | "EVENT_CALENDAR_QUERY_FAILED",
    message?: string,
    readonly cause?: unknown
  ) {
    super(message ?? code);
    this.name = "EventCalendarQueryError";
  }
}

function assertCalendarDate(date: string) {
  if (!isEntryDateString(date)) {
    throw new EventCalendarQueryError("INVALID_CALENDAR_DATE");
  }

  try {
    parseEntryDateInput(date);
  } catch {
    throw new EventCalendarQueryError("INVALID_CALENDAR_DATE");
  }
}

function assertCalendarMonth(month: string) {
  if (!MONTH_PATTERN.test(month)) {
    throw new EventCalendarQueryError("INVALID_CALENDAR_MONTH");
  }

  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new EventCalendarQueryError("INVALID_CALENDAR_MONTH");
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
  current.setUTCDate(current.getUTCDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek));
  const startDate = formatDateKey(current);

  return { startDate, endDate: addDays(startDate, 6) };
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

function sanitizeFutureActions(actions: EventCalendarAction[]) {
  return actions.filter((action) => action !== "start_event" && action !== "continue_event");
}

function sanitizeFutureDayRecord(day: EventCalendarDayRecord, today: string): EventCalendarDayRecord {
  if (!isFutureEntryDate(day.date, today)) {
    return day;
  }

  const events = day.events.map((event) => ({
    ...event,
    actions: sanitizeFutureActions(event.actions)
  }));
  const primaryAction = day.primaryAction && sanitizeFutureActions([day.primaryAction])[0]
    ? day.primaryAction
    : null;

  return { ...day, events, primaryAction };
}

function sanitizeDay(day: EventCalendarDayRecord, today = getTodayEntryDate()) {
  return sanitizeFutureDayRecord(day, today);
}

function sanitizeWeek(week: EventCalendarWeekRecord, today = getTodayEntryDate()) {
  return { ...week, days: week.days.map((day) => sanitizeFutureDayRecord(day, today)) };
}

function sanitizeMonth(month: EventCalendarMonthRecord, today = getTodayEntryDate()) {
  return { ...month, days: month.days.map((day) => sanitizeFutureDayRecord(day, today)) };
}

export async function getEventCalendarDay(userId: string, date: string): Promise<EventCalendarDayRecord> {
  assertCalendarDate(date);

  try {
    const sources = await listEventCalendarSourcesByDate(userId, date);
    return sanitizeDay(aggregateEventCalendarDay({ date, ...sources }));
  } catch (error) {
    if (error instanceof EventCalendarQueryError) throw error;
    throw new EventCalendarQueryError("EVENT_CALENDAR_QUERY_FAILED", undefined, error);
  }
}

export async function getEventCalendarWeek(userId: string, date: string): Promise<EventCalendarWeekRecord> {
  assertCalendarDate(date);
  const range = getWeekDateRange(date);

  try {
    const sources = await listEventCalendarSourcesByDateRange({ userId, ...range });
    return sanitizeWeek(aggregateEventCalendarWeek({ anchorDate: date, ...sources }));
  } catch (error) {
    if (error instanceof EventCalendarQueryError) throw error;
    throw new EventCalendarQueryError("EVENT_CALENDAR_QUERY_FAILED", undefined, error);
  }
}

export async function getEventCalendarMonth(userId: string, month: string): Promise<EventCalendarMonthRecord> {
  assertCalendarMonth(month);
  const range = getMonthDateRange(month);

  try {
    const sources = await listEventCalendarSourcesByDateRange({ userId, ...range });
    return sanitizeMonth(aggregateEventCalendarMonth({ month, ...sources }));
  } catch (error) {
    if (error instanceof EventCalendarQueryError) throw error;
    throw new EventCalendarQueryError("EVENT_CALENDAR_QUERY_FAILED", undefined, error);
  }
}
