"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useCalendarChrome } from "@/components/calendar/calendar-chrome-context";
import { CalendarModeSwitcher } from "@/components/calendar/calendar-mode-switcher";
import { CalendarViewSwitcher } from "@/components/calendar/calendar-view-switcher";
import { HeaderToolbarPeriodStepper } from "@/components/shared/header-toolbar-nav";
import {
  HeaderPeriodDisplay,
  HeaderSummaryChipRow,
  HeaderToolbarChipButton,
  HeaderToolbarDivider,
  HeaderToolbarStatus
} from "@/components/shared/header-toolbar-primitives";
import { getCalendarErrorLabel, getCalendarLoadingLabel } from "@/features/calendar/accessibility";
import {
  fetchCalendarDayRecord,
  fetchCalendarMonthRecord,
  fetchCalendarWeekRecord,
  getCachedCalendarDayRecord,
  getCachedCalendarMonthRecord,
  getCachedCalendarWeekRecord,
  prefetchCalendarAdjacentViews
} from "@/features/calendar/calendar-client";
import { buildCalendarMonthStats } from "@/features/calendar/month-stats";
import {
  buildCalendarToolbarChips,
  buildCalendarToolbarFallbackChips,
  buildCalendarToolbarState
} from "@/features/calendar/toolbar";
import type { CalendarDayRecord, CalendarMonthRecord, CalendarWeekRecord } from "@/features/calendar/types";
import { buildCalendarWeekStats } from "@/features/calendar/week-stats";
import {
  buildCalendarHref,
  normalizeCalendarMode,
  normalizeCalendarSearchParams,
  type CalendarMode
} from "@/features/calendar/view-state";
import { getTodayEntryDate } from "@/features/interview/entry-date";

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeView, beginCalendarViewChange } = useCalendarChrome();
  const isCalendarPage = pathname === "/calendar" || pathname.startsWith("/calendar/");
  const today = getTodayEntryDate();
  const normalizedSearch = normalizeCalendarSearchParams({
    view: searchParams.get("view"),
    date: searchParams.get("date"),
    today
  });
  const calendarView = normalizedSearch.view;
  const calendarDate = normalizedSearch.date;
  const requestedCalendarMode = searchParams.get("calendarMode");
  const calendarMode = normalizeCalendarMode(requestedCalendarMode);
  const isRouteLocatedDay = activeView === "day" && calendarMode === "event_centered";
  const isEventCalendarMode = calendarMode === "event_centered" && !isRouteLocatedDay;
  const readTarget = searchParams.get("readTarget") === "event_centered"
    ? "event_centered"
    : searchParams.get("readTarget") === "legacy"
      ? "legacy"
      : undefined;
  const toolbarState = useMemo(
    () =>
      buildCalendarToolbarState({
        view: activeView,
        date: normalizedSearch.date
      }),
    [activeView, normalizedSearch.date]
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
  const [isCompactToolbar, setIsCompactToolbar] = useState(false);
  const [isLoading, setIsLoading] = useState(
    () => !hasCachedToolbarRecord(normalizedSearch.view, normalizedSearch.date)
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncCompactToolbar = () => setIsCompactToolbar(mediaQuery.matches);
    syncCompactToolbar();
    mediaQuery.addEventListener("change", syncCompactToolbar);
    return () => mediaQuery.removeEventListener("change", syncCompactToolbar);
  }, []);

  useEffect(() => {
    if (!isCalendarPage) {
      return;
    }

    const currentHref = `/calendar?view=${searchParams.get("view") ?? ""}&date=${searchParams.get("date") ?? ""}${requestedCalendarMode ? `&calendarMode=${requestedCalendarMode}` : ""}${readTarget ? `&readTarget=${readTarget}` : ""}`;
    const normalizedHref = buildCalendarHref({
      view: normalizedSearch.view,
      date: normalizedSearch.date,
      calendarMode: requestedCalendarMode ? calendarMode : undefined,
      readTarget
    });
    if (currentHref !== normalizedHref) {
      router.replace(normalizedHref, { scroll: false });
    }
  }, [calendarMode, isCalendarPage, normalizedSearch.date, normalizedSearch.view, readTarget, requestedCalendarMode, router, searchParams]);

  useEffect(() => {
    if (isEventCalendarMode || isRouteLocatedDay) {
      return;
    }
    prefetchCalendarAdjacentViews(normalizedSearch.view, normalizedSearch.date);
  }, [isEventCalendarMode, isRouteLocatedDay, normalizedSearch.date, normalizedSearch.view]);

  useEffect(() => {
    let cancelled = false;

    if (isEventCalendarMode || isRouteLocatedDay) {
      setIsLoading(false);
      setHasFetchError(false);
      setMonthRecord(null);
      setWeekRecord(null);
      setDayRecord(null);
      return () => {
        cancelled = true;
      };
    }

    const view = calendarView;
    const date = calendarDate;
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
  }, [calendarDate, calendarView, isEventCalendarMode, isRouteLocatedDay]);

  const chips = useMemo(() => {
    if (isRouteLocatedDay) {
      return [
        { id: "date", label: "记录", value: "当天" },
        { id: "route", label: "阅读", value: "定位" },
        { id: "boundary", label: "模式", value: "分流" }
      ];
    }

    if (isEventCalendarMode) {
      return [
        { id: "model", label: "记录", value: "事件" },
        { id: "order", label: "排序", value: "当天" },
        { id: "route", label: "阅读", value: activeView === "day" ? "定位" : "当前" }
      ];
    }

    if (isLoading || hasFetchError) {
      return buildCalendarToolbarFallbackChips(activeView);
    }

    return buildCalendarToolbarChips({
      view: activeView,
      monthStats: monthRecord ? buildCalendarMonthStats(monthRecord) : null,
      weekStats: weekRecord ? buildCalendarWeekStats(weekRecord) : null,
      dayRecord
    });
  }, [activeView, dayRecord, hasFetchError, isEventCalendarMode, isLoading, isRouteLocatedDay, monthRecord, weekRecord]);

  function navigate(input: { date?: string; view?: typeof normalizedSearch.view; calendarMode?: CalendarMode }) {
    const nextView = input.view ?? normalizedSearch.view;
    const nextCalendarMode = input.calendarMode ?? (requestedCalendarMode ? calendarMode : undefined);

    if (input.view && input.view !== normalizedSearch.view) {
      beginCalendarViewChange(input.view);
    }

    router.replace(
      buildCalendarHref({
        view: nextView,
        date: input.date ?? normalizedSearch.date,
        calendarMode: nextCalendarMode
      }),
      { scroll: false }
    );
  }

  const periodLoadingLabel = isLoading ? getCalendarLoadingLabel("toolbar") : null;

  return (
    <div
      data-testid="calendar-toolbar"
      aria-busy={isLoading ? "true" : "false"}
      className="flex min-h-[var(--site-header-lane-min-height)] min-w-max items-center gap-1.5 overflow-visible lg:min-w-0 lg:w-full lg:overflow-hidden"
    >
      <div className="header-ws-template flex w-full min-w-0 items-center gap-1.5">
        <div className="header-ws-slot header-ws-slot--time order-1 shrink-0 md:order-none">
          <HeaderToolbarPeriodStepper
            testId="calendar-period-stepper"
            busy={isLoading}
            statusLabel={periodLoadingLabel}
            previousLabel={toolbarState.previousLabel}
            nextLabel={toolbarState.nextLabel}
            onPrevious={() => navigate({ date: toolbarState.previousDate })}
            onNext={() => navigate({ date: toolbarState.nextDate })}
          >
            <HeaderPeriodDisplay testId="calendar-period-display">{toolbarState.title}</HeaderPeriodDisplay>
          </HeaderToolbarPeriodStepper>
        </div>

        <HeaderToolbarDivider className="order-2 hidden lg:order-none lg:inline-flex" />

        <div className="header-ws-slot header-ws-slot--context header-ws-slot--context--chips order-7 shrink-0 md:order-none">
          {isCompactToolbar ? (
            <details className="group">
              <summary className="header-toolbar-chip-btn cursor-pointer list-none select-none marker:hidden">
                摘要
              </summary>
              <div className="mt-1.5 flex min-w-0 flex-col gap-1">
                {hasFetchError ? (
                  <HeaderToolbarStatus tone="error" role="alert">
                    {getCalendarErrorLabel("toolbar")}
                  </HeaderToolbarStatus>
                ) : null}
                <HeaderSummaryChipRow chips={chips} />
              </div>
            </details>
          ) : (
            <div className="flex min-w-0 flex-col gap-1">
              {hasFetchError ? (
                <HeaderToolbarStatus tone="error" role="alert">
                  {getCalendarErrorLabel("toolbar")}
                </HeaderToolbarStatus>
              ) : null}
              <HeaderSummaryChipRow chips={chips} />
            </div>
          )}
        </div>

        <HeaderToolbarDivider className="order-6 hidden lg:order-none lg:inline-flex" />

        <div className="header-ws-slot header-ws-slot--view order-3 shrink-0 md:order-none">
          <CalendarViewSwitcher
            currentView={activeView}
            currentDate={normalizedSearch.date}
            onSelectView={(view) => navigate({ view })}
            shouldPrefetch={!isEventCalendarMode && !isRouteLocatedDay}
          />
        </div>

        {activeView !== "day" ? (
          <>
            <HeaderToolbarDivider className="order-4 hidden lg:order-none lg:inline-flex" />
            <div className="header-ws-slot header-ws-slot--view order-4 shrink-0 md:order-none">
              <CalendarModeSwitcher currentMode={calendarMode} onSelectMode={(mode) => navigate({ calendarMode: mode })} />
            </div>
          </>
        ) : null}

        <HeaderToolbarDivider className="order-5 hidden lg:order-none lg:inline-flex" />

        <div className="header-ws-slot header-ws-slot--action order-6 shrink-0 md:order-none">
          <HeaderToolbarChipButton onClick={() => navigate({ date: today })} aria-label="回到今天">
            今天
          </HeaderToolbarChipButton>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {isLoading ? getCalendarLoadingLabel("toolbar") : hasFetchError ? getCalendarErrorLabel("toolbar") : "摘要已更新。"}
      </span>
    </div>
  );
}
