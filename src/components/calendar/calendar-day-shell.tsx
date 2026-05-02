"use client";

import React from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CalendarDayView } from "@/components/calendar/calendar-day-view";
import { getCalendarErrorLabel, getCalendarLoadingLabel } from "@/features/calendar/accessibility";
import type { CalendarDayRecord } from "@/features/calendar/types";
import { normalizeCalendarSearchParams } from "@/features/calendar/view-state";
import { getTodayEntryDate } from "@/features/interview/entry-date";

async function fetchCalendarDay(date: string) {
  const response = await fetch(`/api/calendar/day?date=${date}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("CALENDAR_DAY_QUERY_FAILED");
  }

  return (await response.json()) as CalendarDayRecord;
}

export function CalendarDayShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = getTodayEntryDate();
  const normalizedSearch = normalizeCalendarSearchParams({
    view: searchParams.get("view"),
    date: searchParams.get("date"),
    today
  });
  const currentDate = normalizedSearch.date;
  const [dayRecord, setDayRecord] = useState<CalendarDayRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    const currentHref = `/calendar?view=${searchParams.get("view") ?? ""}&date=${searchParams.get("date") ?? ""}`;
    if (currentHref !== normalizedSearch.href) {
      router.replace(normalizedSearch.href, { scroll: false });
    }
  }, [normalizedSearch.href, router, searchParams]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchCalendarDay(currentDate)
      .then((record) => {
        if (!cancelled) {
          setDayRecord(record);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(getCalendarErrorLabel("day"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentDate, refreshNonce]);

  return (
    <section
      className="calendar-workspace calendar-shell rounded-[32px] px-3 py-3 md:px-4 md:py-4"
      data-testid="calendar-day-workspace"
      aria-busy={isLoading ? "true" : "false"}
    >
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {error ? (
          <div
            className="calendar-pane calendar-card flex min-h-0 flex-1 flex-col items-center justify-center rounded-[24px] p-6 text-center"
            data-testid="calendar-day-primary-pane"
            role="alert"
          >
            <p className="font-display text-[1.45rem] text-[#17212b]">{error}</p>
            <button
              type="button"
              onClick={() => setRefreshNonce((value) => value + 1)}
              className="calendar-chip mt-4 rounded-full px-4 py-2 text-[0.88rem] text-[#20364a]"
            >
              重新加载
            </button>
          </div>
        ) : isLoading ? (
          <div className="calendar-pane calendar-card min-h-0 flex-1 rounded-[28px] p-5 md:p-6" data-testid="calendar-day-primary-pane">
            <p role="status" aria-live="polite" className="text-[0.84rem] text-[#64748b]">
              {getCalendarLoadingLabel("day")}
            </p>
            <div className="mt-4 space-y-4" aria-hidden="true">
              <div className="h-24 animate-pulse rounded-[22px] bg-[rgba(226,232,240,0.7)]" />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="h-56 animate-pulse rounded-[22px] bg-[rgba(226,232,240,0.7)]" />
                <div className="h-56 animate-pulse rounded-[22px] bg-[rgba(226,232,240,0.7)]" />
                <div className="h-56 animate-pulse rounded-[22px] bg-[rgba(226,232,240,0.7)]" />
              </div>
            </div>
          </div>
        ) : dayRecord ? (
          <div
            className="calendar-pane calendar-panel min-h-0 flex-1 overflow-hidden rounded-[28px] p-3 md:p-4"
            data-testid="calendar-day-primary-pane"
          >
            <div className="calendar-pane-scroll panel-scroll min-h-0 h-full pr-1">
              <CalendarDayView day={dayRecord} today={today} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
