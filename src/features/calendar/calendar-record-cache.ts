import type { CalendarDayRecord, CalendarMonthRecord, CalendarWeekRecord } from "@/features/calendar/types";
import type { CalendarView } from "@/features/calendar/view-state";

export type CalendarCachedRecord =
  | CalendarMonthRecord
  | CalendarWeekRecord
  | CalendarDayRecord;

const cache = new Map<string, CalendarCachedRecord>();
let activeMonthWindow: string | null = null;

export function buildCalendarRecordCacheKey(view: CalendarView, date: string) {
  switch (view) {
    case "month":
      return `month:${date.slice(0, 7)}`;
    case "week":
      return `week:${date}`;
    case "day":
      return `day:${date}`;
  }
}

export function touchCalendarRecordCacheWindow(date: string) {
  const month = date.slice(0, 7);

  if (activeMonthWindow === month) {
    return;
  }

  cache.clear();
  activeMonthWindow = month;
}

export function hasCalendarRecordCache(view: CalendarView, date: string) {
  return cache.has(buildCalendarRecordCacheKey(view, date));
}

export function getCalendarRecordCache(view: CalendarView, date: string) {
  return cache.get(buildCalendarRecordCacheKey(view, date)) ?? null;
}

export function saveCalendarRecordCache(view: CalendarView, date: string, record: CalendarCachedRecord) {
  touchCalendarRecordCacheWindow(date);
  cache.set(buildCalendarRecordCacheKey(view, date), record);
}

export function deleteCalendarRecordCache(view: CalendarView, date: string) {
  cache.delete(buildCalendarRecordCacheKey(view, date));
}

export function getCachedCalendarMonthRecord(date: string): CalendarMonthRecord | null {
  const cached = getCalendarRecordCache("month", date);
  return cached && "month" in cached ? cached : null;
}

export function getCachedCalendarWeekRecord(date: string): CalendarWeekRecord | null {
  const cached = getCalendarRecordCache("week", date);
  return cached && "weekStartDate" in cached ? cached : null;
}

export function getCachedCalendarDayRecord(date: string): CalendarDayRecord | null {
  const cached = getCalendarRecordCache("day", date);
  return cached && "date" in cached && !("month" in cached) && !("weekStartDate" in cached) ? cached : null;
}

export function clearAllCalendarRecordCache() {
  cache.clear();
  activeMonthWindow = null;
}
