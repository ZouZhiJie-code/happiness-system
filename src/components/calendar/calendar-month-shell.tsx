"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CalendarMonthDayPanel } from "@/components/calendar/calendar-month-day-panel";
import { CalendarMonthGrid } from "@/components/calendar/calendar-month-grid";
import { CalendarMonthGridSkeleton } from "@/components/calendar/calendar-workspace-fallback";
import { useCalendarEntryLoadingNotice } from "@/components/calendar/use-calendar-entry-loading-notice";
import { getCalendarErrorLabel } from "@/features/calendar/accessibility";
import { fetchCalendarMonthRecord, getCachedCalendarMonthRecord } from "@/features/calendar/calendar-client";
import { interviewDimensions } from "@/features/interview/dimensions";
import type { CalendarDayRecord, CalendarMonthRecord } from "@/features/calendar/types";
import {
  buildCalendarHref,
  buildCalendarMonthGrid,
  getCalendarMonthKey,
  normalizeCalendarSearchParams
} from "@/features/calendar/view-state";
import { getTodayEntryDate } from "@/features/interview/entry-date";

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

function CalendarMonthErrorPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="flex h-full min-h-[16rem] flex-col items-center justify-center px-5 py-6 text-center"
      data-testid="calendar-month-secondary-error"
    >
      <p className="font-display text-[1.32rem] text-[#312419]">当天检查暂时不可用。</p>
      <p className="mt-2 text-[0.86rem] leading-6 text-[#755d47]">右侧检查会在本月记录恢复后继续更新。</p>
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

function CalendarMonthPrimaryErrorPane({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-1 pt-3 md:px-5 md:pb-1.5 md:pt-4" data-testid="calendar-month-primary-error">
      <div className="grid shrink-0 grid-cols-7 px-1">
        {["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((label) => (
          <p key={label} className="text-center text-[0.75rem] tracking-[0.01em] text-[#8a6b4b]">
            {label}
          </p>
        ))}
      </div>

      <div className="mt-3.5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-[rgba(153,119,86,0.24)] bg-[rgba(255,249,240,0.78)]">
        <div
          className="flex min-h-[16rem] flex-1 flex-col items-center justify-center px-6 py-6 text-center"
          role="alert"
          data-testid="calendar-month-primary-error-alert"
        >
          <p className="font-display text-[1.45rem] text-[#312419]">本月记录暂时没打开。</p>
          <p className="mt-2 text-[0.86rem] leading-6 text-[#755d47]">月历骨架先保留在这里，重新加载后会回到当天检查。</p>
          <button
            type="button"
            onClick={onRetry}
            className="calendar-chip mt-4 rounded-full px-4 py-2 text-[0.88rem] text-[#604529]"
          >
            重新加载
          </button>
        </div>
      </div>
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
  const [monthRecord, setMonthRecord] = useState<CalendarMonthRecord | null>(() => getCachedCalendarMonthRecord(currentDate));
  const [isLoading, setIsLoading] = useState(() => !getCachedCalendarMonthRecord(currentDate));
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useCalendarEntryLoadingNotice(isLoading);

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
    const force = refreshNonce > 0;
    const cachedRecord = force ? null : getCachedCalendarMonthRecord(currentDate);

    if (cachedRecord) {
      setMonthRecord(cachedRecord);
      setError(null);
      setIsLoading(false);
    } else {
      setIsLoading(true);
      setError(null);
      setMonthRecord(null);
    }

    void fetchCalendarMonthRecord(monthKey, { force })
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
  }, [currentDate, monthKey, refreshNonce]);

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
                <CalendarMonthPrimaryErrorPane onRetry={retryMonthQuery} />
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
