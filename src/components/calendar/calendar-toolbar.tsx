"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CalendarViewSwitcher } from "@/components/calendar/calendar-view-switcher";
import { getCalendarErrorLabel, getCalendarLoadingLabel } from "@/features/calendar/accessibility";
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
    <div className="calendar-summary-chip shrink-0 rounded-full px-2.5 py-1">
      <span className="text-[0.65rem] text-[#8b6c4d]">{label}</span>
      <span className="ml-1.5 tabular-nums text-[0.74rem] font-medium text-[#604529]">{value}</span>
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
      aria-busy={isLoading ? "true" : "false"}
      className="calendar-card flex min-h-[var(--site-header-lane-min-height)] w-full items-center gap-1.5 rounded-[20px] px-2.5 py-1.5 overflow-hidden"
    >
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => navigate({ date: toolbarState.previousDate })}
          className="calendar-chip rounded-full px-2.5 py-1 text-[0.76rem] text-[#7a5e44] transition duration-200 hover:text-[#5c4229]"
          aria-label={toolbarState.previousLabel}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          type="button"
          onClick={() => navigate({ date: toolbarState.nextDate })}
          className="calendar-chip rounded-full px-2.5 py-1 text-[0.76rem] text-[#7a5e44] transition duration-200 hover:text-[#5c4229]"
          aria-label={toolbarState.nextLabel}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <div className="min-w-0 flex-1 overflow-x-auto pb-0.5">
        <div className="flex min-w-max items-center gap-2">
          <p className="shrink-0 text-[0.95rem] font-medium text-[#34271c] md:text-[1rem]">
            {toolbarState.title}
          </p>

        {isLoading ? (
          <span className="shrink-0 text-[0.68rem] text-[#8a6b4b]" role="status" aria-live="polite">
            {getCalendarLoadingLabel("toolbar")}
          </span>
        ) : null}
        {hasFetchError ? (
          <span className="shrink-0 text-[0.68rem] text-[#8f5431]" role="alert">
            {getCalendarErrorLabel("toolbar")}
          </span>
        ) : null}
        {chips.map((chip) => (
          <ToolbarChip key={chip.id} label={chip.label} value={chip.value} />
        ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate({ date: today })}
        className="calendar-chip shrink-0 rounded-full px-3 py-1 text-[0.74rem] font-medium text-[#5d4329] transition duration-200 hover:text-[#34271c]"
        aria-label="回到今天"
      >
        今天
      </button>

      <CalendarViewSwitcher currentView={normalizedSearch.view} onSelectView={(view) => navigate({ view })} />

      <span className="sr-only" aria-live="polite">
        {isLoading ? getCalendarLoadingLabel("toolbar") : hasFetchError ? getCalendarErrorLabel("toolbar") : "摘要已更新。"}
      </span>
    </div>
  );
}
