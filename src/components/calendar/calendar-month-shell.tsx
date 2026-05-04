"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CalendarMonthDayPanel } from "@/components/calendar/calendar-month-day-panel";
import { CalendarMonthGrid } from "@/components/calendar/calendar-month-grid";
import { getCalendarErrorLabel, getCalendarLoadingLabel } from "@/features/calendar/accessibility";
import { interviewDimensions } from "@/features/interview/dimensions";
import type { CalendarDayRecord, CalendarMonthRecord } from "@/features/calendar/types";
import {
  buildCalendarHref,
  buildCalendarMonthGrid,
  getCalendarMonthKey,
  normalizeCalendarSearchParams
} from "@/features/calendar/view-state";
import { getTodayEntryDate } from "@/features/interview/entry-date";

async function fetchCalendarMonth(month: string) {
  const response = await fetch(`/api/calendar/month?month=${month}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("CALENDAR_MONTH_QUERY_FAILED");
  }

  return (await response.json()) as CalendarMonthRecord;
}

function buildEmptyCalendarDayRecord(date: string): CalendarDayRecord {
  return {
    date,
    overallStatus: "empty",
    dimensions: interviewDimensions.map((dimension) => ({
      dimension,
      status: "empty",
      title: null,
      summary: null,
      latestUpdatedAt: null,
      sessionId: null,
      journalEntryId: null,
      actions: [],
      hasActiveSession: false,
      hasDraftEntry: false,
      hasSavedEntry: false
    })),
    activeCount: 0,
    draftCount: 0,
    savedCount: 0,
    primaryTitle: null,
    primarySummary: null,
    latestUpdatedAt: null,
    primaryAction: null
  };
}

function CalendarMonthGridSkeleton() {
  return (
    <div className="min-h-0 flex-1 rounded-[24px] p-2">
      <p role="status" aria-live="polite" className="text-[0.84rem] text-[#8a6b4b]">
        {getCalendarLoadingLabel("month")}
      </p>
      <div className="mt-4 space-y-3" aria-hidden="true">
        <div className="h-8 animate-pulse rounded-[18px] bg-[rgba(224,204,174,0.56)]" />
        <div className="calendar-month-grid-sheet grid min-h-[calc(var(--calendar-month-cell-min-height)*6)] grid-cols-7 overflow-hidden rounded-[18px] [grid-auto-rows:minmax(var(--calendar-month-cell-min-height),1fr)]">
          {Array.from({ length: 42 }, (_, index) => (
            <div
              key={index}
              className="calendar-month-cell min-h-[var(--calendar-month-cell-min-height)] animate-pulse bg-[rgba(224,204,174,0.42)]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CalendarMonthErrorPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="calendar-card flex h-full min-h-[16rem] flex-col items-center justify-center rounded-[28px] p-6 text-center">
      <p className="font-display text-[1.32rem] text-[#312419]">当天检查暂时不可用。</p>
      <p className="mt-2 text-[0.86rem] leading-6 text-[#755d47]">请先重新加载本月记录。</p>
      <button
        type="button"
        onClick={onRetry}
        className="calendar-chip mt-4 rounded-full px-4 py-2 text-[0.88rem] text-[#604529]"
      >
        重新加载
      </button>
    </div>
  );
}

export function CalendarMonthShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = getTodayEntryDate();
  const normalizedSearch = normalizeCalendarSearchParams({
    view: searchParams.get("view"),
    date: searchParams.get("date"),
    today
  });
  const currentDate = normalizedSearch.date;
  const monthKey = getCalendarMonthKey(currentDate);
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [monthRecord, setMonthRecord] = useState<CalendarMonthRecord | null>(null);
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
    setSelectedDate(currentDate);
  }, [currentDate]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchCalendarMonth(monthKey)
      .then((record) => {
        if (cancelled) {
          return;
        }

        setMonthRecord(record);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setError(getCalendarErrorLabel("month"));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [monthKey, refreshNonce]);

  const monthGrid = useMemo(() => buildCalendarMonthGrid(monthKey), [monthKey]);
  const daysByDate = useMemo(
    () => new Map((monthRecord?.days ?? []).map((day) => [day.date, day])),
    [monthRecord]
  );
  const selectedDay = daysByDate.get(selectedDate) ?? buildEmptyCalendarDayRecord(selectedDate);

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    router.replace(buildCalendarHref({ view: "month", date }), { scroll: false });
  }

  function retryMonthQuery() {
    setRefreshNonce((value) => value + 1);
  }

  return (
    <section
      className="calendar-workspace calendar-shell rounded-none border-x-0 border-t-0 px-2 py-2 [--calendar-month-cell-min-height:4.35rem] sm:[--calendar-month-cell-min-height:5rem] md:px-2.5 md:py-2.5 lg:[--calendar-month-cell-min-height:5.95rem]"
      data-testid="calendar-month-workspace"
      aria-busy={isLoading ? "true" : "false"}
    >
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto lg:overflow-hidden">
          <div className="grid min-h-0 gap-2 lg:h-full lg:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)]">
            <div
              className="calendar-pane calendar-panel flex min-h-0 flex-col rounded-none p-2 md:p-2.5"
              data-testid="calendar-month-primary-pane"
            >
              {error ? (
                <div className="calendar-card flex min-h-0 flex-1 flex-col items-center justify-center rounded-[24px] p-6 text-center" role="alert">
                  <p className="font-display text-[1.45rem] text-[#312419]">{error}</p>
                  <button
                    type="button"
                    onClick={retryMonthQuery}
                    className="calendar-chip mt-4 rounded-full px-4 py-2 text-[0.88rem] text-[#604529]"
                  >
                    重新加载
                  </button>
                </div>
              ) : isLoading ? (
                <CalendarMonthGridSkeleton />
              ) : (
                <div className="calendar-pane-scroll panel-scroll flex min-h-0 flex-1 flex-col pr-1">
                  <CalendarMonthGrid
                    cells={monthGrid}
                    daysByDate={daysByDate}
                    selectedDate={selectedDate}
                    today={today}
                    onSelectDate={handleSelectDate}
                  />
                </div>
              )}
            </div>

            <aside className="calendar-pane min-h-0 lg:h-full" data-testid="calendar-month-secondary-pane">
              {error ? (
                <CalendarMonthErrorPanel onRetry={retryMonthQuery} />
              ) : isLoading ? (
                <div className="calendar-card h-full min-h-0 rounded-[28px] p-5 md:p-6">
                  <div className="space-y-4" aria-hidden="true">
                    <div className="h-8 animate-pulse rounded-[18px] bg-[rgba(224,204,174,0.56)]" />
                    <div className="h-32 animate-pulse rounded-[22px] bg-[rgba(224,204,174,0.56)]" />
                    <div className="h-48 animate-pulse rounded-[22px] bg-[rgba(224,204,174,0.56)]" />
                  </div>
                </div>
              ) : null}
              {!isLoading && !error ? (
                <div className="h-full min-h-0">
                  <CalendarMonthDayPanel
                    day={selectedDay}
                    today={today}
                    dayViewHref={buildCalendarHref({ view: "day", date: selectedDay.date })}
                  />
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
