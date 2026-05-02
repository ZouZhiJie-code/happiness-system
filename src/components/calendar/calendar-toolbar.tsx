"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CalendarViewSwitcher } from "@/components/calendar/calendar-view-switcher";
import { buildCalendarMonthStats } from "@/features/calendar/month-stats";
import {
  buildCalendarToolbarChips,
  buildCalendarToolbarFallbackChips,
  buildCalendarToolbarState
} from "@/features/calendar/toolbar";
import type { CalendarDayRecord, CalendarMonthRecord, CalendarWeekRecord } from "@/features/calendar/types";
import { buildCalendarWeekStats } from "@/features/calendar/week-stats";
import { buildCalendarHref, normalizeCalendarSearchParams } from "@/features/calendar/view-state";
import { getTodayEntryDate } from "@/features/interview/entry-date";

async function fetchCalendarMonth(month: string) {
  const response = await fetch(`/api/calendar/month?month=${month}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("CALENDAR_TOOLBAR_MONTH_QUERY_FAILED");
  }

  return (await response.json()) as CalendarMonthRecord;
}

async function fetchCalendarWeek(date: string) {
  const response = await fetch(`/api/calendar/week?date=${date}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("CALENDAR_TOOLBAR_WEEK_QUERY_FAILED");
  }

  return (await response.json()) as CalendarWeekRecord;
}

async function fetchCalendarDay(date: string) {
  const response = await fetch(`/api/calendar/day?date=${date}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("CALENDAR_TOOLBAR_DAY_QUERY_FAILED");
  }

  return (await response.json()) as CalendarDayRecord;
}

function ToolbarChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-[rgba(160,113,68,0.14)] bg-[rgba(255,251,245,0.82)] px-3 py-1.5">
      <span className="text-[0.68rem] text-[#8a6e51]">{label}</span>
      <span className="ml-2 tabular-nums text-[0.78rem] font-medium text-[#3d2d1f]">{value}</span>
    </div>
  );
}

export function CalendarToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = getTodayEntryDate();
  const normalizedSearch = normalizeCalendarSearchParams({
    view: searchParams.get("view"),
    date: searchParams.get("date"),
    today
  });
  const toolbarState = useMemo(
    () =>
      buildCalendarToolbarState({
        view: normalizedSearch.view,
        date: normalizedSearch.date
      }),
    [normalizedSearch.date, normalizedSearch.view]
  );
  const [monthRecord, setMonthRecord] = useState<CalendarMonthRecord | null>(null);
  const [weekRecord, setWeekRecord] = useState<CalendarWeekRecord | null>(null);
  const [dayRecord, setDayRecord] = useState<CalendarDayRecord | null>(null);
  const [hasFetchError, setHasFetchError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const currentHref = `/calendar?view=${searchParams.get("view") ?? ""}&date=${searchParams.get("date") ?? ""}`;
    if (currentHref !== normalizedSearch.href) {
      router.replace(normalizedSearch.href, { scroll: false });
    }
  }, [normalizedSearch.href, router, searchParams]);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setHasFetchError(false);
    setMonthRecord(null);
    setWeekRecord(null);
    setDayRecord(null);

    const request =
      normalizedSearch.view === "month"
        ? fetchCalendarMonth(normalizedSearch.date.slice(0, 7)).then((record) => {
            if (!cancelled) {
              setMonthRecord(record);
            }
          })
        : normalizedSearch.view === "week"
          ? fetchCalendarWeek(normalizedSearch.date).then((record) => {
              if (!cancelled) {
                setWeekRecord(record);
              }
            })
          : fetchCalendarDay(normalizedSearch.date).then((record) => {
              if (!cancelled) {
                setDayRecord(record);
              }
            });

    void request
      .catch(() => {
        if (!cancelled) {
          setHasFetchError(true);
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
  }, [normalizedSearch.date, normalizedSearch.view]);

  const chips = useMemo(() => {
    if (isLoading || hasFetchError) {
      return buildCalendarToolbarFallbackChips(normalizedSearch.view);
    }

    return buildCalendarToolbarChips({
      view: normalizedSearch.view,
      monthStats: monthRecord ? buildCalendarMonthStats(monthRecord) : null,
      weekStats: weekRecord ? buildCalendarWeekStats(weekRecord) : null,
      dayRecord
    });
  }, [dayRecord, hasFetchError, isLoading, monthRecord, normalizedSearch.view, weekRecord]);

  function navigate(input: { date?: string; view?: typeof normalizedSearch.view }) {
    router.replace(
      buildCalendarHref({
        view: input.view ?? normalizedSearch.view,
        date: input.date ?? normalizedSearch.date
      }),
      { scroll: false }
    );
  }

  return (
    <div
      data-testid="calendar-toolbar"
      className="flex w-full flex-col gap-2 rounded-[20px] border border-[rgba(136,92,50,0.14)] bg-[linear-gradient(180deg,rgba(252,246,236,0.88),rgba(244,230,204,0.9))] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.46),0_10px_22px_rgba(118,75,37,0.06)]"
    >
      <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate({ date: toolbarState.previousDate })}
            className="rounded-full border border-[rgba(160,113,68,0.14)] bg-[rgba(255,250,243,0.92)] px-2.5 py-1.5 text-[0.78rem] text-[#62462d] transition duration-200 hover:bg-[rgba(255,253,250,0.98)]"
            aria-label={toolbarState.previousLabel}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            onClick={() => navigate({ date: toolbarState.nextDate })}
            className="rounded-full border border-[rgba(160,113,68,0.14)] bg-[rgba(255,250,243,0.92)] px-2.5 py-1.5 text-[0.78rem] text-[#62462d] transition duration-200 hover:bg-[rgba(255,253,250,0.98)]"
            aria-label={toolbarState.nextLabel}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-balance text-[0.98rem] font-medium text-[#2f241b] md:text-[1.08rem]">
            {toolbarState.title}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate({ date: today })}
          className="shrink-0 rounded-full border border-[rgba(166,114,61,0.18)] bg-[rgba(255,248,239,0.88)] px-3 py-1.5 text-[0.76rem] font-medium text-[#644830] transition duration-200 hover:bg-[rgba(255,252,247,0.98)]"
        >
          今天
        </button>

        <CalendarViewSwitcher currentView={normalizedSearch.view} onSelectView={(view) => navigate({ view })} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <ToolbarChip key={chip.id} label={chip.label} value={chip.value} />
        ))}
        <span className="sr-only" aria-live="polite">
          摘要暂时不可用
        </span>
      </div>
    </div>
  );
}
