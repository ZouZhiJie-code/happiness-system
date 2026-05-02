"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CalendarViewSwitcher } from "@/components/calendar/calendar-view-switcher";
import { CalendarWeekBoard } from "@/components/calendar/calendar-week-board";
import { buildCalendarWeekStats } from "@/features/calendar/week-stats";
import type { CalendarWeekRecord } from "@/features/calendar/types";
import {
  buildCalendarHref,
  formatCalendarWeekLabel,
  normalizeCalendarSearchParams,
  shiftCalendarWeek
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

function WeekStatCard({
  label,
  value,
  hint
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="wood-dialog rounded-[28px] p-4">
      <p className="text-[0.72rem] tracking-[0.18em] text-[#8f6238]">{label}</p>
      <p className="mt-2 font-display text-[2rem] leading-none tabular-nums text-[#2b2018]">{value}</p>
      <p className="mt-2 text-pretty text-[0.82rem] leading-6 text-[#5e4b3c]">{hint}</p>
    </div>
  );
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

  function handleShiftWeek(offset: number) {
    router.replace(
      buildCalendarHref({
        view: "week",
        date: shiftCalendarWeek(currentDate, offset)
      }),
      { scroll: false }
    );
  }

  function handleBackToday() {
    router.replace(
      buildCalendarHref({
        view: "week",
        date: today
      }),
      { scroll: false }
    );
  }

  return (
    <section className="page-shell min-h-[calc(100vh-8.5rem)] rounded-[40px] px-4 py-4 md:px-6 md:py-5">
      <div className="relative z-10 space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="archive-label">WEEK BOARD</p>
            <h1 className="mt-2 text-balance font-display text-[2.55rem] leading-none text-[#2d2014] md:text-[3rem]">
              {formatCalendarWeekLabel(currentDate)}
            </h1>
            <p className="mt-3 max-w-[38rem] text-pretty text-[0.98rem] leading-7 text-[#5d4a3a]">
              这一屏只看 7 天的记录节奏。先判断哪几天已经成稿，哪几天还留着草稿，再决定点进哪一天继续补。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CalendarViewSwitcher currentView="week" currentDate={currentDate} />
            <button
              type="button"
              onClick={() => handleShiftWeek(-1)}
              className="rounded-full border border-[rgba(152,105,61,0.18)] bg-[rgba(255,249,240,0.82)] px-4 py-2 text-[0.88rem] text-[#62462d] transition duration-300 hover:-translate-y-0.5"
            >
              上周
            </button>
            <button
              type="button"
              onClick={handleBackToday}
              className="rounded-full border border-[rgba(152,105,61,0.18)] bg-[linear-gradient(180deg,#ead2ad,#ddb884)] px-4 py-2 text-[0.88rem] text-[#352519] transition duration-300 hover:-translate-y-0.5"
            >
              回到今天
            </button>
            <button
              type="button"
              onClick={() => handleShiftWeek(1)}
              className="rounded-full border border-[rgba(152,105,61,0.18)] bg-[rgba(255,249,240,0.82)] px-4 py-2 text-[0.88rem] text-[#62462d] transition duration-300 hover:-translate-y-0.5"
            >
              下周
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <WeekStatCard label="记录天数" value={weekStats?.recordedDayCount ?? 0} hint="这周里，至少有一条记录落下来的天数。" />
          <WeekStatCard label="草稿数" value={weekStats?.draftCount ?? 0} hint="还没有正式保存完成、但已经写出草稿的维度数量。" />
          <WeekStatCard label="已完成数" value={weekStats?.completedCount ?? 0} hint="已经正式保存为日志的维度数量。" />
          <WeekStatCard label="维度覆盖" value={weekStats?.dimensionCoverageCount ?? 0} hint="五个维度里，这周已经被触达过的数量。" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
          <div className="paper-panel rounded-[34px] p-4 md:p-5">
            {error ? (
              <div className="paper-sheet rounded-[28px] p-6 text-center">
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
              <div className="space-y-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="h-28 animate-pulse rounded-[28px] bg-[rgba(255,250,242,0.72)]" />
                ))}
              </div>
            ) : (
              <>
                {weekStats?.recordedDayCount === 0 ? (
                  <div className="mb-4 rounded-[24px] border border-dashed border-[rgba(168,124,69,0.18)] bg-[rgba(255,250,242,0.72)] px-4 py-3 text-[0.9rem] leading-7 text-[#705742]">
                    这一周还没有留下记录，可以先从今天开始，再回来看一周节奏。
                  </div>
                ) : null}
                <CalendarWeekBoard days={weekRecord?.days ?? []} today={today} />
              </>
            )}
          </div>

          <aside className="paper-sheet rounded-[32px] p-5 md:p-6">
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
          </aside>
        </div>
      </div>
    </section>
  );
}
