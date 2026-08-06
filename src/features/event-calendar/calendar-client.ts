"use client";

import { dedupedRequest } from "@/features/shared/client-request-cache";
import type {
  EventCalendarDayRecord,
  EventCalendarMonthRecord,
  EventCalendarWeekRecord
} from "@/types/event-calendar";

export type EventCalendarReadRoute = "empty" | "legacy" | "event_centered" | "dual";

export interface EventCalendarReadRouteResult {
  date: string;
  route: EventCalendarReadRoute;
}

type EventCalendarCachedRecord = EventCalendarDayRecord | EventCalendarWeekRecord | EventCalendarMonthRecord;

const cache = new Map<string, EventCalendarCachedRecord>();

function buildCacheKey(view: "day" | "week" | "month", date: string) {
  return view === "month" ? `month:${date.slice(0, 7)}` : `${view}:${date}`;
}

function getCachedRecord<T extends EventCalendarCachedRecord>(view: "day" | "week" | "month", date: string) {
  return (cache.get(buildCacheKey(view, date)) as T | undefined) ?? null;
}

function saveCachedRecord(view: "day" | "week" | "month", date: string, record: EventCalendarCachedRecord) {
  cache.set(buildCacheKey(view, date), record);
}

async function requestEventCalendar<T>(key: string, url: string, options?: { force?: boolean }) {
  return dedupedRequest(
    key,
    async () => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("EVENT_CALENDAR_QUERY_FAILED");
      }
      return (await response.json()) as T;
    },
    { force: options?.force }
  );
}

export function getCachedEventCalendarDayRecord(date: string) {
  return getCachedRecord<EventCalendarDayRecord>("day", date);
}

export function getCachedEventCalendarWeekRecord(date: string) {
  return getCachedRecord<EventCalendarWeekRecord>("week", date);
}

export function getCachedEventCalendarMonthRecord(date: string) {
  return getCachedRecord<EventCalendarMonthRecord>("month", date);
}

export async function fetchEventCalendarDayRecord(date: string, options?: { force?: boolean }) {
  if (!options?.force) {
    const cached = getCachedEventCalendarDayRecord(date);
    if (cached) return cached;
  }

  const record = await requestEventCalendar<EventCalendarDayRecord>(
    `event-calendar-day:${date}`,
    `/api/event-calendar/day?date=${date}`,
    options
  );
  saveCachedRecord("day", date, record);
  return record;
}

export async function fetchEventCalendarWeekRecord(date: string, options?: { force?: boolean }) {
  if (!options?.force) {
    const cached = getCachedEventCalendarWeekRecord(date);
    if (cached) return cached;
  }

  const record = await requestEventCalendar<EventCalendarWeekRecord>(
    `event-calendar-week:${date}`,
    `/api/event-calendar/week?date=${date}`,
    options
  );
  saveCachedRecord("week", date, record);
  return record;
}

export async function fetchEventCalendarMonthRecord(month: string, options?: { force?: boolean }) {
  const anchorDate = `${month}-01`;
  if (!options?.force) {
    const cached = getCachedEventCalendarMonthRecord(anchorDate);
    if (cached) return cached;
  }

  const record = await requestEventCalendar<EventCalendarMonthRecord>(
    `event-calendar-month:${month}`,
    `/api/event-calendar/month?month=${month}`,
    options
  );
  saveCachedRecord("month", anchorDate, record);
  return record;
}

export async function fetchEventCalendarReadRoute(date: string, options?: { force?: boolean }) {
  return requestEventCalendar<EventCalendarReadRouteResult>(
    `calendar-read-route:${date}`,
    `/api/calendar/read-route?date=${date}`,
    options
  );
}

export function clearEventCalendarRecordCache() {
  cache.clear();
}
