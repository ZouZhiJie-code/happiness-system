"use client";

import React from "react";
import { useSearchParams } from "next/navigation";

import { useCalendarChrome } from "@/components/calendar/calendar-chrome-context";
import { JournalDayWorkspace } from "@/components/journal/journal-day-workspace";
import { JournalPeriodReportContainer } from "@/components/journal/journal-period-report-container";
import { JournalWorkspaceFrame } from "@/components/journal/journal-workspace-frame";
import { normalizeCalendarSearchParams } from "@/features/calendar/view-state";
import { getTodayEntryDate } from "@/features/interview/entry-date";

export function CalendarRouterShell() {
  const searchParams = useSearchParams();
  const { activeView } = useCalendarChrome();
  const normalizedSearch = normalizeCalendarSearchParams({
    view: searchParams.get("view"),
    scope: searchParams.get("scope"),
    date: searchParams.get("date"),
    today: getTodayEntryDate()
  });
  return (
    <JournalWorkspaceFrame activeView={activeView} date={normalizedSearch.date}>
      {activeView === "day" ? (
        <JournalDayWorkspace key={`journal-day-${normalizedSearch.date}`} entryDate={normalizedSearch.date} />
      ) : activeView === "week" ? (
        <JournalPeriodReportContainer key={`journal-week-${normalizedSearch.date}`} kind="week" anchorDate={normalizedSearch.date} />
      ) : (
        <JournalPeriodReportContainer key={`journal-month-${normalizedSearch.date}`} kind="month" anchorDate={normalizedSearch.date} />
      )}
    </JournalWorkspaceFrame>
  );
}
