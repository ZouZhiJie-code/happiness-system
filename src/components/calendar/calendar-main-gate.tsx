"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";

import { useCalendarChromeOptional } from "@/components/calendar/calendar-chrome-context";
import { CalendarWorkspaceFallback } from "@/components/calendar/calendar-workspace-fallback";
import { normalizeCalendarView } from "@/features/calendar/view-state";

export function CalendarMainGate({ children }: { children: ReactNode }) {
  const calendarChrome = useCalendarChromeOptional();
  const searchParams = useSearchParams();
  const isEnteringCalendar = calendarChrome?.isEnteringCalendar ?? false;
  const isEntryLoadingToastVisible = calendarChrome?.isEntryLoadingToastVisible ?? false;
  const showEntryOverlay = isEnteringCalendar || isEntryLoadingToastVisible;
  const requestedView = normalizeCalendarView(searchParams.get("view") ?? searchParams.get("scope"));
  // 进入日历前沿用导航当前视图；这样首屏骨架与即将打开的日报/周报/月报保持一致。
  const fallbackView = calendarChrome?.optimisticView ?? calendarChrome?.activeView ?? requestedView;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        className={showEntryOverlay ? "hidden" : "flex min-h-0 flex-1 flex-col"}
        aria-hidden={showEntryOverlay || undefined}
      >
        {children}
      </div>
      {showEntryOverlay ? (
        <div
          className="absolute inset-0 z-[1] flex min-h-0 flex-1 flex-col"
          data-testid="calendar-main-gate-overlay"
        >
          <CalendarWorkspaceFallback view={fallbackView} />
        </div>
      ) : null}
    </div>
  );
}
