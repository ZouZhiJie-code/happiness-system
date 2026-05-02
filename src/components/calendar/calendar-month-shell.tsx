"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CalendarMonthDayPanel } from "@/components/calendar/calendar-month-day-panel";
import { CalendarMonthGrid } from "@/components/calendar/calendar-month-grid";
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

        setError("暂时没能加载这个月的记录，请稍后重试。");
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
    <section className="calendar-workspace page-shell rounded-[40px] px-3 py-3 md:px-4 md:py-4" data-testid="calendar-month-workspace">
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="grid min-h-0 h-full min-w-[1100px] grid-cols-[minmax(0,1fr)_22rem] gap-4">
            <div
              className="calendar-pane paper-panel flex min-h-0 flex-col rounded-[30px] p-3 md:p-4"
              data-testid="calendar-month-primary-pane"
            >
              {error ? (
                <div className="paper-sheet flex min-h-0 flex-1 flex-col items-center justify-center rounded-[28px] p-6 text-center">
                  <p className="font-display text-[1.45rem] text-[#2a2017]">这个月的记录暂时没打开</p>
                  <p className="mt-3 text-pretty text-[0.95rem] leading-7 text-[#5d4d3f]">{error}</p>
                  <button
                    type="button"
                    onClick={() => setRefreshNonce((value) => value + 1)}
                    className="mt-4 rounded-full border border-[rgba(152,105,61,0.18)] bg-[rgba(255,249,240,0.82)] px-4 py-2 text-[0.88rem] text-[#62462d]"
                  >
                    重新加载
                  </button>
                </div>
              ) : (
                <div className="calendar-pane-scroll panel-scroll min-h-0 flex-1 pr-1">
                  {monthStats?.recordedDayCount === 0 ? (
                    <div className="mb-4 rounded-[24px] border border-dashed border-[rgba(168,124,69,0.18)] bg-[rgba(255,250,242,0.72)] px-4 py-3 text-[0.9rem] leading-7 text-[#705742]">
                      这个月还没有开始记录，可以先点开某一天，再进入当天页看看从哪一维开始。
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
              {isLoading ? <div className="paper-sheet h-full min-h-0 animate-pulse rounded-[30px]" /> : null}
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
