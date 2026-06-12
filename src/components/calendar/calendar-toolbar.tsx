"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CalendarViewSwitcher } from "@/components/calendar/calendar-view-switcher";
import { HeaderToolbarNavGroup } from "@/components/shared/header-toolbar-nav";
import { getCalendarErrorLabel, getCalendarLoadingLabel } from "@/features/calendar/accessibility";
import {
  fetchCalendarDayRecord,
  fetchCalendarMonthRecord,
  fetchCalendarWeekRecord,
  getCachedCalendarDayRecord,
  getCachedCalendarMonthRecord,
  getCachedCalendarWeekRecord,
  prefetchCalendarView
} from "@/features/calendar/calendar-client";
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

function ToolbarChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="calendar-summary-chip shrink-0 rounded-full px-2.5 py-1">
      <span className="text-[0.65rem] text-[#8b6c4d]">{label}</span>
      <span className="ml-1.5 tabular-nums text-[0.74rem] font-medium text-[#604529]">{value}</span>
    </div>
  );
}

function ToolbarDivider() {
  return (
    <span aria-hidden="true" className="shrink-0 select-none font-mono text-[1rem] font-semibold text-[rgba(101,67,34,0.58)]">
      ｜
    </span>
  );
}

function hasCachedToolbarRecord(view: ReturnType<typeof normalizeCalendarSearchParams>["view"], date: string) {
  switch (view) {
    case "month":
      return Boolean(getCachedCalendarMonthRecord(date));
    case "week":
      return Boolean(getCachedCalendarWeekRecord(date));
    case "day":
      return Boolean(getCachedCalendarDayRecord(date));
  }
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
  const [monthRecord, setMonthRecord] = useState<CalendarMonthRecord | null>(() =>
    normalizedSearch.view === "month" ? getCachedCalendarMonthRecord(normalizedSearch.date) : null
  );
  const [weekRecord, setWeekRecord] = useState<CalendarWeekRecord | null>(() =>
    normalizedSearch.view === "week" ? getCachedCalendarWeekRecord(normalizedSearch.date) : null
  );
  const [dayRecord, setDayRecord] = useState<CalendarDayRecord | null>(() =>
    normalizedSearch.view === "day" ? getCachedCalendarDayRecord(normalizedSearch.date) : null
  );
  const [hasFetchError, setHasFetchError] = useState(false);
  const [isLoading, setIsLoading] = useState(
    () => !hasCachedToolbarRecord(normalizedSearch.view, normalizedSearch.date)
  );

  useEffect(() => {
    const currentHref = `/calendar?view=${searchParams.get("view") ?? ""}&date=${searchParams.get("date") ?? ""}`;
    if (currentHref !== normalizedSearch.href) {
      router.replace(normalizedSearch.href, { scroll: false });
    }
  }, [normalizedSearch.href, router, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const scheduleIdle =
      window.requestIdleCallback ??
      ((callback: IdleRequestCallback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 1));
    const cancelIdle =
      window.cancelIdleCallback ??
      ((handle: number) => {
        window.clearTimeout(handle);
      });

    const idleHandle = scheduleIdle(() => {
      (["month", "week", "day"] as const).forEach((view) => {
        if (view !== normalizedSearch.view) {
          prefetchCalendarView(view, normalizedSearch.date);
        }
      });
    });

    return () => {
      cancelIdle(idleHandle);
    };
  }, [normalizedSearch.date, normalizedSearch.view]);

  useEffect(() => {
    let cancelled = false;
    const { view, date } = normalizedSearch;
    const cachedRecord =
      view === "month"
        ? getCachedCalendarMonthRecord(date)
        : view === "week"
          ? getCachedCalendarWeekRecord(date)
          : getCachedCalendarDayRecord(date);

    if (cachedRecord) {
      setHasFetchError(false);
      setIsLoading(false);

      if (view === "month") {
        setMonthRecord(cachedRecord as CalendarMonthRecord);
      } else if (view === "week") {
        setWeekRecord(cachedRecord as CalendarWeekRecord);
      } else {
        setDayRecord(cachedRecord as CalendarDayRecord);
      }
    } else {
      setIsLoading(true);
      setHasFetchError(false);
      setMonthRecord(null);
      setWeekRecord(null);
      setDayRecord(null);
    }

    const request =
      view === "month"
        ? fetchCalendarMonthRecord(date.slice(0, 7)).then((record) => {
            if (!cancelled) {
              setMonthRecord(record);
            }
          })
        : view === "week"
          ? fetchCalendarWeekRecord(date).then((record) => {
              if (!cancelled) {
                setWeekRecord(record);
              }
            })
          : fetchCalendarDayRecord(date).then((record) => {
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
      className="flex min-h-[var(--site-header-lane-min-height)] w-full items-center gap-1.5 overflow-hidden"
    >
      <HeaderToolbarNavGroup
        previousLabel={toolbarState.previousLabel}
        nextLabel={toolbarState.nextLabel}
        onPrevious={() => navigate({ date: toolbarState.previousDate })}
        onNext={() => navigate({ date: toolbarState.nextDate })}
      />

      <ToolbarDivider />

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

      <ToolbarDivider />

      <button
        type="button"
        onClick={() => navigate({ date: today })}
        className="calendar-chip shrink-0 rounded-full px-3 py-1 text-[0.74rem] font-medium text-[#5d4329] transition duration-200 hover:text-[#34271c]"
        aria-label="回到今天"
      >
        今天
      </button>

      <ToolbarDivider />

      <CalendarViewSwitcher
        currentView={normalizedSearch.view}
        currentDate={normalizedSearch.date}
        onSelectView={(view) => navigate({ view })}
      />

      <span className="sr-only" aria-live="polite">
        {isLoading ? getCalendarLoadingLabel("toolbar") : hasFetchError ? getCalendarErrorLabel("toolbar") : "摘要已更新。"}
      </span>
    </div>
  );
}
