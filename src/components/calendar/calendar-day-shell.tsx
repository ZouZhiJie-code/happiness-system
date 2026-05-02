"use client";

import React from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CalendarDayView } from "@/components/calendar/calendar-day-view";
import type { CalendarDayRecord } from "@/features/calendar/types";
import {
  buildCalendarHref,
  formatCalendarDayLabel,
  normalizeCalendarSearchParams,
  shiftCalendarDay
} from "@/features/calendar/view-state";
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

  function handleShiftDay(offset: number) {
    router.replace(
      buildCalendarHref({
        view: "day",
        date: shiftCalendarDay(currentDate, offset)
      }),
      { scroll: false }
    );
  }

  return (
    <section className="page-shell min-h-[calc(100vh-8.5rem)] rounded-[40px] px-4 py-4 md:px-6 md:py-5">
      <div className="relative z-10 space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="archive-label">DAY PAGE</p>
            <h1 className="mt-2 text-balance font-display text-[2.55rem] leading-none text-[#2d2014] md:text-[3rem]">
              {formatCalendarDayLabel(currentDate)}
            </h1>
            <p className="mt-3 max-w-[36rem] text-pretty text-[0.98rem] leading-7 text-[#5d4a3a]">
              这里按五个维度组织这一天的记录状态，先看清哪里还在进行、哪里已经成稿，再决定进入哪条链路继续。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(buildCalendarHref({ view: "week", date: currentDate }))}
              className="rounded-full border border-[rgba(152,105,61,0.18)] bg-[rgba(255,249,240,0.82)] px-4 py-2 text-[0.88rem] text-[#62462d] transition duration-300 hover:-translate-y-0.5"
            >
              回到本周
            </button>
            <button
              type="button"
              onClick={() => router.push(buildCalendarHref({ view: "month", date: currentDate }))}
              className="rounded-full border border-[rgba(152,105,61,0.18)] bg-[rgba(255,249,240,0.82)] px-4 py-2 text-[0.88rem] text-[#62462d] transition duration-300 hover:-translate-y-0.5"
            >
              回到本月
            </button>
            <button
              type="button"
              onClick={() => handleShiftDay(-1)}
              className="rounded-full border border-[rgba(152,105,61,0.18)] bg-[rgba(255,249,240,0.82)] px-4 py-2 text-[0.88rem] text-[#62462d] transition duration-300 hover:-translate-y-0.5"
            >
              前一天
            </button>
            <button
              type="button"
              onClick={() => router.replace(buildCalendarHref({ view: "day", date: today }), { scroll: false })}
              className="rounded-full border border-[rgba(152,105,61,0.18)] bg-[linear-gradient(180deg,#ead2ad,#ddb884)] px-4 py-2 text-[0.88rem] text-[#352519] transition duration-300 hover:-translate-y-0.5"
            >
              回到今天
            </button>
            <button
              type="button"
              onClick={() => handleShiftDay(1)}
              className="rounded-full border border-[rgba(152,105,61,0.18)] bg-[rgba(255,249,240,0.82)] px-4 py-2 text-[0.88rem] text-[#62462d] transition duration-300 hover:-translate-y-0.5"
            >
              后一天
            </button>
          </div>
        </div>

        {error ? (
          <div className="paper-sheet rounded-[28px] p-6 text-center">
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
          <div className="paper-sheet min-h-[30rem] animate-pulse rounded-[32px]" />
        ) : dayRecord ? (
          <CalendarDayView day={dayRecord} today={today} />
        ) : null}
      </div>
    </section>
  );
}
