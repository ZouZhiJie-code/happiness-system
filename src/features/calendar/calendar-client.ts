"use client";

import { dedupedRequest } from "@/features/shared/client-request-cache";
import type { CalendarDayRecord, CalendarMonthRecord, CalendarWeekRecord } from "@/features/calendar/types";

export async function fetchCalendarMonthRecord(month: string, options?: { force?: boolean }) {
  return dedupedRequest(
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
}

export async function fetchCalendarWeekRecord(date: string, options?: { force?: boolean }) {
  return dedupedRequest(
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
}

export async function fetchCalendarDayRecord(date: string, options?: { force?: boolean }) {
  return dedupedRequest(
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
}
