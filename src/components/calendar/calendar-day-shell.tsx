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
      className="calendar-workspace calendar-shell rounded-none border-x-0 border-t-0 px-2 py-2 md:px-2.5 md:py-2.5"
      data-testid="calendar-day-workspace"
      aria-busy={isLoading ? "true" : "false"}
    >
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {error ? (
          <div
            className="calendar-pane calendar-card flex min-h-0 flex-1 flex-col items-center justify-center rounded-none p-6 text-center"
            data-testid="calendar-day-primary-pane"
            role="alert"
          >
            <p className="font-display text-[1.45rem] text-[#312419]">{error}</p>
            <button
              type="button"
              onClick={() => setRefreshNonce((value) => value + 1)}
              className="calendar-chip mt-4 rounded-full px-4 py-2 text-[0.88rem] text-[#604529]"
            >
              重新加载
            </button>
          </div>
        ) : isLoading ? (
          <div className="calendar-pane calendar-card min-h-0 flex-1 rounded-none p-4 md:p-5" data-testid="calendar-day-primary-pane">
            <p role="status" aria-live="polite" className="text-[0.84rem] text-[#8a6b4b]">
              {getCalendarLoadingLabel("day")}
            </p>
            <div className="mt-4 space-y-4" aria-hidden="true">
              <div className="h-24 animate-pulse rounded-[22px] bg-[rgba(224,204,174,0.56)]" />
              <div className="space-y-2.5">
                {Array.from({ length: 5 }, (_, index) => (
                  <div key={index} className="h-[4.8rem] animate-pulse rounded-[18px] bg-[rgba(224,204,174,0.56)]" />
                ))}
              </div>
            </div>
          </div>
        ) : dayRecord ? (
          <div
            className="calendar-pane calendar-panel min-h-0 flex-1 overflow-hidden rounded-none p-2 md:p-2.5"
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
