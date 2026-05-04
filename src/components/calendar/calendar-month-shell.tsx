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
    <div className="min-h-0 flex-1 px-4 pb-1 pt-3 md:px-5 md:pb-1.5 md:pt-4">
      <p role="status" aria-live="polite" className="text-[0.84rem] text-[#8a6b4b]">
        {getCalendarLoadingLabel("month")}
      </p>
      <div className="mt-3.5 space-y-2.5" aria-hidden="true">
        <div className="h-8 animate-pulse rounded-[18px] bg-[rgba(224,204,174,0.56)]" />
        <div className="calendar-month-grid-sheet grid min-h-[calc(var(--calendar-month-cell-min-height)*6)] grid-cols-7 overflow-hidden rounded-none [grid-auto-rows:minmax(var(--calendar-month-cell-min-height),1fr)]">
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
      className="calendar-workspace calendar-shell calendar-shell--month h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 [--calendar-month-cell-min-height:4.35rem] sm:[--calendar-month-cell-min-height:5rem] lg:[--calendar-month-cell-min-height:5.95rem]"
      data-testid="calendar-month-workspace"
      aria-busy={isLoading ? "true" : "false"}
    >
      <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col">
        <div className="min-h-0 h-full flex-1 overflow-x-hidden overflow-y-auto lg:overflow-hidden">
          <div className="grid min-h-0 h-full grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-1 xl:grid-cols-[minmax(0,1fr)_25.5rem]">
            <div
              className="calendar-pane calendar-panel calendar-month-primary-pane flex min-h-0 flex-col rounded-none p-0"
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
                <div className="calendar-pane-scroll panel-scroll flex min-h-0 flex-1 flex-col">
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

            <aside
              className="calendar-pane calendar-month-secondary-pane min-h-0 lg:h-full"
              data-testid="calendar-month-secondary-pane"
            >
              {error ? (
                <CalendarMonthErrorPanel onRetry={retryMonthQuery} />
              ) : isLoading ? (
                <div className="calendar-panel h-full min-h-0 rounded-none border-0 p-5 shadow-none md:p-6">
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
