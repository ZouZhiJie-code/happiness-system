"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CalendarWeekBoard } from "@/components/calendar/calendar-week-board";
import { buildCalendarWeekStats } from "@/features/calendar/week-stats";
import type { CalendarWeekRecord } from "@/features/calendar/types";
import { buildCalendarWeekOverviewState } from "@/features/calendar/week-view";
import { normalizeCalendarSearchParams } from "@/features/calendar/view-state";
import { getTodayEntryDate } from "@/features/interview/entry-date";

async function fetchCalendarWeek(date: string) {
  const response = await fetch(`/api/calendar/week?date=${date}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("CALENDAR_WEEK_QUERY_FAILED");
  }

  return (await response.json()) as CalendarWeekRecord;
}

export function CalendarWeekShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = getTodayEntryDate();
  const normalizedSearch = normalizeCalendarSearchParams({
    view: searchParams.get("view"),
    date: searchParams.get("date"),
    today
  });
  const currentDate = normalizedSearch.date;
  const [weekRecord, setWeekRecord] = useState<CalendarWeekRecord | null>(null);
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

    void fetchCalendarWeek(currentDate)
      .then((record) => {
        if (!cancelled) {
          setWeekRecord(record);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("暂时没能加载这一周的记录，请稍后重试。");
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

  const weekStats = useMemo(() => (weekRecord ? buildCalendarWeekStats(weekRecord) : null), [weekRecord]);
  const weekOverview = useMemo(
    () => (weekRecord && weekStats ? buildCalendarWeekOverviewState(weekRecord, weekStats.summary) : null),
    [weekRecord, weekStats]
  );

  return (
    <section className="calendar-workspace page-shell rounded-[40px] px-3 py-3 md:px-4 md:py-4" data-testid="calendar-week-workspace">
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div
          className="calendar-pane paper-panel flex min-h-0 flex-1 flex-col rounded-[30px] p-3 md:p-4"
          data-testid="calendar-week-primary-pane"
        >
          {error ? (
            <div className="paper-sheet flex min-h-0 flex-1 flex-col items-center justify-center rounded-[28px] p-6 text-center">
              <p className="font-display text-[1.45rem] text-[#2a2017]">这一周的记录暂时没打开</p>
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
            <div className="calendar-pane-scroll panel-scroll min-h-0 flex-1 space-y-3 pr-1">
              <div className="h-28 animate-pulse rounded-[28px] bg-[rgba(255,250,242,0.72)]" />
              <div className="h-[20rem] animate-pulse rounded-[28px] bg-[rgba(255,250,242,0.72)]" />
            </div>
          ) : (
            <div className="calendar-pane-scroll panel-scroll min-h-0 flex-1 space-y-3 pr-1">
              <div
                className="paper-sheet rounded-[28px] px-4 py-4 md:px-5"
                data-testid="calendar-week-summary"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-[42rem]">
                    <p className="archive-label">WEEK SNAPSHOT</p>
                    <p className="mt-2 text-pretty text-[1rem] leading-7 text-[#453325]">
                      {weekOverview?.summary ?? "正在整理这一周的记录概况。"}
                    </p>
                    <p className="mt-2 text-[0.86rem] leading-6 text-[#7b5f45]">{weekOverview?.focusHint ?? "正在整理下一步。"}</p>
                  </div>
                  <div className="rounded-[22px] border border-[rgba(172,126,80,0.18)] bg-[rgba(255,249,239,0.82)] px-4 py-3 text-[0.88rem] text-[#5b4b3e]">
                    <p className="text-[0.72rem] tracking-[0.18em] text-[#9a744d]">周范围</p>
                    <p className="mt-1">{weekOverview?.rangeLabel ?? "正在加载"}</p>
                  </div>
                </div>
              </div>

              {weekStats?.recordedDayCount === 0 ? (
                <div className="rounded-[24px] border border-dashed border-[rgba(168,124,69,0.18)] bg-[rgba(255,250,242,0.72)] px-4 py-3 text-[0.9rem] leading-7 text-[#705742]">
                  这一周还没有留下记录，可以先从今天开始，再回来看一周节奏。
                </div>
              ) : null}

              <CalendarWeekBoard days={weekRecord?.days ?? []} today={today} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
