"use client";

import React from "react";
import { useSearchParams } from "next/navigation";

import { CalendarDayShell } from "@/components/calendar/calendar-day-shell";
import { CalendarMonthShell } from "@/components/calendar/calendar-month-shell";
import { CalendarWeekShell } from "@/components/calendar/calendar-week-shell";
import { normalizeCalendarView } from "@/features/calendar/view-state";

export function CalendarRouterShell() {
  const searchParams = useSearchParams();
  const view = normalizeCalendarView(searchParams.get("view"));

  if (view === "week") {
    return <CalendarWeekShell />;
  }

  if (view === "day") {
    return <CalendarDayShell />;
  }

  return <CalendarMonthShell />;
}
