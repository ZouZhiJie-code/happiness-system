"use client";

import React from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CalendarDayView } from "@/components/calendar/calendar-day-view";
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
          setError("暂时没能加载这一天的记录，请稍后重试。");
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
    <section className="calendar-workspace page-shell rounded-[40px] px-3 py-3 md:px-4 md:py-4" data-testid="calendar-day-workspace">
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {error ? (
          <div
            className="calendar-pane paper-sheet flex min-h-0 flex-1 flex-col items-center justify-center rounded-[28px] p-6 text-center"
            data-testid="calendar-day-primary-pane"
          >
            <p className="font-display text-[1.45rem] text-[#2a2017]">这一天的记录暂时没打开</p>
            <p className="mt-3 text-pretty text-[0.95rem] leading-7 text-[#5d4d3f]">{error}</p>
            <button
              type="button"
              onClick={() => setRefreshNonce((value) => value + 1)}
              className="mt-4 rounded-full border border-[rgba(152,105,61,0.18)] bg-[rgba(255,249,240,0.82)] px-4 py-2 text-[0.88rem] text-[#62462d]"
            >
              重新加载
            </button>
          </div>
        ) : isLoading ? (
          <div className="calendar-pane paper-sheet min-h-0 flex-1 animate-pulse rounded-[30px]" data-testid="calendar-day-primary-pane" />
        ) : dayRecord ? (
          <div
            className="calendar-pane paper-panel min-h-0 flex-1 overflow-hidden rounded-[30px] p-3 md:p-4"
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
