"use client";

import {
  getCachedCalendarDayRecord,
  getCachedCalendarMonthRecord,
  getCachedCalendarWeekRecord,
  getCalendarRecordCache,
  saveCalendarRecordCache
} from "@/features/calendar/calendar-record-cache";
import type { CalendarDayRecord, CalendarMonthRecord, CalendarWeekRecord } from "@/features/calendar/types";
import type { CalendarView } from "@/features/calendar/view-state";
import { dedupedRequest } from "@/features/shared/client-request-cache";

export function getCachedCalendarRecord(view: CalendarView, date: string) {
  return getCalendarRecordCache(view, date);
}

export { getCachedCalendarDayRecord, getCachedCalendarMonthRecord, getCachedCalendarWeekRecord };

export async function fetchCalendarMonthRecord(month: string, options?: { force?: boolean }) {
  if (!options?.force) {
    const cached = getCachedCalendarMonthRecord(`${month}-01`);

    if (cached) {
      return cached;
    }
  }

  const record = await dedupedRequest(
    `calendar-month:${month}`,
    async () => {
      const response = await fetch(`/api/calendar/month?month=${month}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("CALENDAR_MONTH_QUERY_FAILED");
      }

      return (await response.json()) as CalendarMonthRecord;
    },
    { force: options?.force }
  );

  saveCalendarRecordCache("month", `${month}-01`, record);

  return record;
}

export async function fetchCalendarWeekRecord(date: string, options?: { force?: boolean }) {
  if (!options?.force) {
    const cached = getCachedCalendarWeekRecord(date);

    if (cached) {
      return cached;
    }
  }

  const record = await dedupedRequest(
    `calendar-week:${date}`,
    async () => {
      const response = await fetch(`/api/calendar/week?date=${date}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("CALENDAR_WEEK_QUERY_FAILED");
      }

      return (await response.json()) as CalendarWeekRecord;
    },
    { force: options?.force }
  );

  saveCalendarRecordCache("week", date, record);

  return record;
}

export async function fetchCalendarDayRecord(date: string, options?: { force?: boolean }) {
  if (!options?.force) {
    const cached = getCachedCalendarDayRecord(date);

    if (cached) {
      return cached;
    }
  }

  const record = await dedupedRequest(
    `calendar-day:${date}`,
    async () => {
      const response = await fetch(`/api/calendar/day?date=${date}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("CALENDAR_DAY_QUERY_FAILED");
      }

      return (await response.json()) as CalendarDayRecord;
    },
    { force: options?.force }
  );

  saveCalendarRecordCache("day", date, record);

  return record;
}

export function prefetchCalendarView(view: CalendarView, date: string) {
  const task =
    view === "month"
      ? fetchCalendarMonthRecord(date.slice(0, 7))
      : view === "week"
        ? fetchCalendarWeekRecord(date)
        : fetchCalendarDayRecord(date);

  void task.catch(() => {});
}
