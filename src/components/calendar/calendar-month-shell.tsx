"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CalendarDayDetail } from "@/components/calendar/calendar-day-detail";
import { CalendarMonthGrid } from "@/components/calendar/calendar-month-grid";
import { CalendarViewSwitcher } from "@/components/calendar/calendar-view-switcher";
import { buildCalendarMonthStats } from "@/features/calendar/month-stats";
import type { CalendarMonthRecord } from "@/features/calendar/types";
import {
  buildCalendarHref,
  buildCalendarMonthGrid,
  formatCalendarMonthLabel,
  getCalendarMonthKey,
  normalizeCalendarSearchParams,
  shiftCalendarMonth
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

function MonthStatCard({
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
  const selectedDay = monthRecord?.days.find((day) => day.date === currentDate) ?? null;
  const monthStats = monthRecord ? buildCalendarMonthStats(monthRecord) : null;

  function handleSelectDate(date: string) {
    router.replace(buildCalendarHref({ view: "month", date }), { scroll: false });
  }

  function handleShiftMonth(offset: number) {
    router.replace(
      buildCalendarHref({
        view: "month",
        date: shiftCalendarMonth(currentDate, offset)
      }),
      { scroll: false }
    );
  }

  function handleBackToday() {
    router.replace(
      buildCalendarHref({
        view: "month",
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
            <p className="archive-label">CALENDAR VIEW</p>
            <h1 className="mt-2 text-balance font-display text-[2.55rem] leading-none text-[#2d2014] md:text-[3rem]">
              {formatCalendarMonthLabel(currentDate)}
            </h1>
            <p className="mt-3 max-w-[36rem] text-pretty text-[0.98rem] leading-7 text-[#5d4a3a]">
              先看这个月的分布，再点开某一天，决定是继续访谈、继续编辑，还是回到那天重新开始。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CalendarViewSwitcher currentView="month" currentDate={currentDate} />
            <button
              type="button"
              onClick={() => handleShiftMonth(-1)}
              className="rounded-full border border-[rgba(152,105,61,0.18)] bg-[rgba(255,249,240,0.82)] px-4 py-2 text-[0.88rem] text-[#62462d] transition duration-300 hover:-translate-y-0.5"
            >
              上月
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
              onClick={() => handleShiftMonth(1)}
              className="rounded-full border border-[rgba(152,105,61,0.18)] bg-[rgba(255,249,240,0.82)] px-4 py-2 text-[0.88rem] text-[#62462d] transition duration-300 hover:-translate-y-0.5"
            >
              下月
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MonthStatCard label="有记录的天数" value={monthStats?.recordedDayCount ?? 0} hint="这个月里，有至少一条记录落下来的天数。" />
          <MonthStatCard label="已完成日志" value={monthStats?.completedDayCount ?? 0} hint="至少有一个维度正式保存为日志的天数。" />
          <MonthStatCard label="待继续的天数" value={monthStats?.followUpDayCount ?? 0} hint="还有访谈或草稿没完全收束的天数。" />
          <MonthStatCard label="覆盖维度" value={monthStats?.dimensionCoverageCount ?? 0} hint="这个月里，五个维度里已经触达过的数量。" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.8fr)]">
          <div className="paper-panel rounded-[34px] p-4 md:p-5">
            {error ? (
              <div className="paper-sheet rounded-[28px] p-6 text-center">
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
              <>
                {monthStats?.recordedDayCount === 0 ? (
                  <div className="mb-4 rounded-[24px] border border-dashed border-[rgba(168,124,69,0.18)] bg-[rgba(255,250,242,0.72)] px-4 py-3 text-[0.9rem] leading-7 text-[#705742]">
                    这个月还没有开始记录，可以先点开某一天，从一个维度开始写起。
                  </div>
                ) : null}
                <CalendarMonthGrid
                  cells={monthGrid}
                  daysByDate={daysByDate}
                  selectedDate={currentDate}
                  today={today}
                  onSelectDate={handleSelectDate}
                />
              </>
            )}

            {isLoading ? (
              <div className="mt-4 grid gap-2 md:hidden">
                <div className="h-24 animate-pulse rounded-[24px] bg-[rgba(255,250,242,0.72)]" />
              </div>
            ) : selectedDay ? (
              <div className="mt-4 xl:hidden">
                <CalendarDayDetail day={selectedDay} today={today} />
              </div>
            ) : null}
          </div>

          <div className="hidden xl:block">
            {isLoading ? (
              <div className="paper-sheet h-full min-h-[30rem] animate-pulse rounded-[32px]" />
            ) : selectedDay ? (
              <CalendarDayDetail day={selectedDay} today={today} />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
