"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CalendarWeekBoard } from "@/components/calendar/calendar-week-board";
import { buildCalendarWeekStats } from "@/features/calendar/week-stats";
import type { CalendarWeekRecord } from "@/features/calendar/types";
import {
  normalizeCalendarSearchParams
} from "@/features/calendar/view-state";
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

  return (
    <section className="calendar-workspace page-shell rounded-[40px] px-3 py-3 md:px-4 md:py-4" data-testid="calendar-week-workspace">
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1.1fr)_minmax(15rem,0.9fr)] gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)] xl:grid-rows-1 xl:gap-4">
          <div
            className="calendar-pane paper-panel flex min-h-0 flex-col rounded-[30px] p-3 md:p-4"
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
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="h-28 animate-pulse rounded-[28px] bg-[rgba(255,250,242,0.72)]" />
                ))}
              </div>
            ) : (
              <div className="calendar-pane-scroll panel-scroll min-h-0 flex-1 pr-1">
                {weekStats?.recordedDayCount === 0 ? (
                  <div className="mb-4 rounded-[24px] border border-dashed border-[rgba(168,124,69,0.18)] bg-[rgba(255,250,242,0.72)] px-4 py-3 text-[0.9rem] leading-7 text-[#705742]">
                    这一周还没有留下记录，可以先从今天开始，再回来看一周节奏。
                  </div>
                ) : null}
                <CalendarWeekBoard days={weekRecord?.days ?? []} today={today} />
              </div>
            )}
          </div>

          <aside
            className="calendar-pane paper-sheet flex min-h-0 flex-col rounded-[30px] p-4 md:p-5"
            data-testid="calendar-week-secondary-pane"
          >
            <div className="calendar-pane-scroll panel-scroll min-h-0 flex-1 pr-1">
              <p className="archive-label">WEEK SUMMARY</p>
              <h2 className="mt-2 text-balance font-display text-[1.9rem] leading-none text-[#2a2017]">这周记录概况</h2>
              <p className="mt-4 text-pretty text-[0.95rem] leading-7 text-[#5d4d3f]">
                {weekStats?.summary ?? "正在整理这一周的记录概况。"}
              </p>

              <div className="mt-5 rounded-[24px] border border-[rgba(172,126,80,0.18)] bg-[rgba(255,249,239,0.78)] p-4">
                <p className="text-[0.76rem] tracking-[0.18em] text-[#9a744d]">周范围</p>
                <p className="mt-2 text-[0.95rem] leading-7 text-[#5b4b3e]">
                  {weekRecord ? `${weekRecord.weekStartDate} 到 ${weekRecord.weekEndDate}` : "正在加载"}
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {(weekStats?.dimensions ?? []).map((dimension) => (
                  <div
                    key={dimension.dimension}
                    className="rounded-[22px] border border-[rgba(177,132,86,0.16)] bg-[rgba(255,250,242,0.9)] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-display text-[1.05rem] leading-none text-[#2b2018]">{dimension.label}</p>
                      <span className="text-[0.8rem] tabular-nums text-[#8b6e52]">{dimension.touchedDayCount} 天</span>
                    </div>
                    <p className="mt-2 text-pretty text-[0.86rem] leading-6 text-[#605041]">
                      已完成 {dimension.completedDayCount} 天，草稿 {dimension.draftDayCount} 天。
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
