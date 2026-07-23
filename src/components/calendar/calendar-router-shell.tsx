"use client";

import React from "react";
import { useSearchParams } from "next/navigation";

import { useCalendarChrome } from "@/components/calendar/calendar-chrome-context";
import { CalendarMonthShell } from "@/components/calendar/calendar-month-shell";
import { CalendarWeekShell } from "@/components/calendar/calendar-week-shell";
import {
  CalendarDayReadRouteShell,
  EventCalendarMonthShell,
  EventCalendarWeekShell
} from "@/components/event-calendar/event-calendar-workspace";
import { normalizeCalendarMode, normalizeCalendarSearchParams } from "@/features/calendar/view-state";
import { getTodayEntryDate } from "@/features/interview/entry-date";

export function CalendarRouterShell() {
  const searchParams = useSearchParams();
  const { activeView } = useCalendarChrome();
  const normalizedSearch = normalizeCalendarSearchParams({
    view: searchParams.get("view"),
    date: searchParams.get("date"),
    today: getTodayEntryDate()
  });
  const calendarMode = normalizeCalendarMode(searchParams.get("calendarMode"));
  const readTarget = searchParams.get("readTarget") === "event_centered"
    ? "event_centered"
    : searchParams.get("readTarget") === "legacy"
      ? "legacy"
      : null;

  if (activeView === "day") {
    return <CalendarDayReadRouteShell key={`day-${normalizedSearch.date}-${readTarget ?? "locator"}`} date={normalizedSearch.date} readTarget={readTarget} />;
  }

  if (calendarMode === "event_centered") {
    if (activeView === "week") {
      return <EventCalendarWeekShell key={`event-week-${normalizedSearch.date}`} anchorDate={normalizedSearch.date} />;
    }

    return <EventCalendarMonthShell key={`event-month-${normalizedSearch.date}`} anchorDate={normalizedSearch.date} />;
  }

  if (activeView === "week") {
    return <CalendarWeekShell key={`week-${searchParams.get("date") ?? ""}`} />;
  }

  return <CalendarMonthShell key={`month-${searchParams.get("date") ?? ""}`} />;
}
