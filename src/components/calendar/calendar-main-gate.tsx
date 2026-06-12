"use client";

import type { ReactNode } from "react";

import { useCalendarChromeOptional } from "@/components/calendar/calendar-chrome-context";
import { CalendarWorkspaceFallback } from "@/components/calendar/calendar-workspace-fallback";

export function CalendarMainGate({ children }: { children: ReactNode }) {
  const calendarChrome = useCalendarChromeOptional();
  const isEnteringCalendar = calendarChrome?.isEnteringCalendar ?? false;
  const isEntryLoadingToastVisible = calendarChrome?.isEntryLoadingToastVisible ?? false;
  const showEntryOverlay = isEnteringCalendar || isEntryLoadingToastVisible;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className={showEntryOverlay ? "hidden" : undefined} aria-hidden={showEntryOverlay || undefined}>
        {children}
      </div>
      {showEntryOverlay ? (
        <div
          className="absolute inset-0 z-[1] flex min-h-0 flex-1 flex-col"
          data-testid="calendar-main-gate-overlay"
        >
          <CalendarWorkspaceFallback view="month" />
        </div>
      ) : null}
    </div>
  );
}
