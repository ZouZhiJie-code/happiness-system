"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CalendarMonthDayPanel } from "@/components/calendar/calendar-month-day-panel";
import { CalendarMonthGrid } from "@/components/calendar/calendar-month-grid";
import { getCalendarErrorLabel, getCalendarLoadingLabel } from "@/features/calendar/accessibility";
import { buildCalendarMonthStats } from "@/features/calendar/month-stats";
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
  const monthStats = monthRecord ? buildCalendarMonthStats(monthRecord) : null;

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    router.replace(buildCalendarHref({ view: "month", date }), { scroll: false });
  }

  return (
    <section
      className="calendar-workspace calendar-shell rounded-[32px] px-3 py-3 md:px-4 md:py-4"
      data-testid="calendar-month-workspace"
      aria-busy={isLoading ? "true" : "false"}
    >
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="grid min-h-0 h-full min-w-[1100px] grid-cols-[minmax(0,1fr)_22rem] gap-4">
            <div
              className="calendar-pane calendar-panel flex min-h-0 flex-col rounded-[28px] p-3 md:p-4"
              data-testid="calendar-month-primary-pane"
            >
              {error ? (
                <div className="calendar-card flex min-h-0 flex-1 flex-col items-center justify-center rounded-[24px] p-6 text-center" role="alert">
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
                <div className="min-h-0 flex-1 rounded-[24px] p-2">
                  <p role="status" aria-live="polite" className="text-[0.84rem] text-[#64748b]">
                    {getCalendarLoadingLabel("month")}
                  </p>
                  <div className="mt-4 space-y-3" aria-hidden="true">
                    <div className="h-8 animate-pulse rounded-[18px] bg-[rgba(226,232,240,0.7)]" />
                    <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: 14 }, (_, index) => (
                        <div key={index} className="h-[8.6rem] animate-pulse rounded-[22px] bg-[rgba(226,232,240,0.7)]" />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="calendar-pane-scroll panel-scroll min-h-0 flex-1 pr-1">
                  {monthStats?.recordedDayCount === 0 ? (
                    <div className="calendar-card-muted mb-4 rounded-[22px] px-4 py-3 text-[0.9rem] leading-7 text-[#516174]">
                      本月还没有记录。
                    </div>
                  ) : null}
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

            <aside className="calendar-pane min-h-0" data-testid="calendar-month-secondary-pane">
              {isLoading ? (
                <div className="calendar-card h-full min-h-0 rounded-[28px] p-5 md:p-6">
                  <div className="space-y-4" aria-hidden="true">
                    <div className="h-8 animate-pulse rounded-[18px] bg-[rgba(226,232,240,0.7)]" />
                    <div className="h-32 animate-pulse rounded-[22px] bg-[rgba(226,232,240,0.7)]" />
                    <div className="h-48 animate-pulse rounded-[22px] bg-[rgba(226,232,240,0.7)]" />
                  </div>
                </div>
              ) : null}
              {!isLoading ? (
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
