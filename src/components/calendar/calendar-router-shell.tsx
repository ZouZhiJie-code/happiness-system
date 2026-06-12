"use client";

import React from "react";
import { useSearchParams } from "next/navigation";

import { useCalendarChrome } from "@/components/calendar/calendar-chrome-context";
import { CalendarDayShell } from "@/components/calendar/calendar-day-shell";
import { CalendarMonthShell } from "@/components/calendar/calendar-month-shell";
import { CalendarWeekShell } from "@/components/calendar/calendar-week-shell";

export function CalendarRouterShell() {
  const searchParams = useSearchParams();
  const { activeView } = useCalendarChrome();

  if (activeView === "week") {
    return <CalendarWeekShell key={`week-${searchParams.get("date") ?? ""}`} />;
  }

  if (activeView === "day") {
    return <CalendarDayShell key={`day-${searchParams.get("date") ?? ""}`} />;
  }

  return <CalendarMonthShell key={`month-${searchParams.get("date") ?? ""}`} />;
}
