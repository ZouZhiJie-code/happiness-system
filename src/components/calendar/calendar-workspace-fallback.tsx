"use client";

import { getCalendarLoadingLabel } from "@/features/calendar/accessibility";
import type { CalendarView } from "@/features/calendar/view-state";

export function CalendarMonthGridSkeleton() {
  return (
    <div className="min-h-0 flex-1 px-4 pb-1 pt-3 md:px-5 md:pb-1.5 md:pt-4">
      <p role="status" aria-live="polite" className="text-[0.84rem] text-[#8a6b4b]">
        {getCalendarLoadingLabel("month")}
      </p>
      <div className="mt-3.5 space-y-2.5" aria-hidden="true">
        <div className="h-8 animate-pulse rounded-[18px] bg-[rgba(224,204,174,0.56)]" />
        <div className="calendar-month-grid-sheet grid min-h-[calc(var(--calendar-month-cell-min-height)*6)] grid-cols-7 overflow-hidden rounded-none [grid-auto-rows:minmax(var(--calendar-month-cell-min-height),1fr)]">
          {Array.from({ length: 42 }, (_, index) => (
            <div
              key={index}
              className="calendar-month-cell min-h-[var(--calendar-month-cell-min-height)] animate-pulse bg-[rgba(224,204,174,0.42)]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CalendarWeekWorkspaceSkeleton() {
  return (
    <div className="calendar-pane-scroll panel-scroll min-h-0 flex-1 space-y-3 pr-1 p-2 md:p-2.5">
      <p role="status" aria-live="polite" className="text-[0.84rem] text-[#8a6b4b]">
        {getCalendarLoadingLabel("week")}
      </p>
      <div className="ui-card h-28 animate-pulse" aria-hidden="true" />
      <div className="ui-card h-[20rem] animate-pulse" aria-hidden="true" />
    </div>
  );
}

function CalendarDayWorkspaceSkeleton() {
  return (
    <div className="min-h-0 flex-1 p-4 md:p-5">
      <p role="status" aria-live="polite" className="text-[0.84rem] text-[#8a6b4b]">
        {getCalendarLoadingLabel("day")}
      </p>
      <div className="mt-4 space-y-4" aria-hidden="true">
        <div className="ui-card h-24 animate-pulse" />
        <div className="space-y-2.5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-[4.8rem] animate-pulse rounded-[var(--radius-control)] bg-[var(--amber-soft)]" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function CalendarWorkspaceFallback({ view = "month" }: { view?: CalendarView }) {
  if (view === "week") {
    return (
      <section
        className="calendar-workspace calendar-shell rounded-none border-x-0 border-t-0 px-2 py-2 md:px-2.5 md:py-2.5"
        data-testid="calendar-week-workspace-fallback"
        aria-busy="true"
      >
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <CalendarWeekWorkspaceSkeleton />
        </div>
      </section>
    );
  }

  if (view === "day") {
    return (
      <section
        className="calendar-workspace calendar-shell rounded-none border-x-0 border-t-0 px-2 py-2 md:px-2.5 md:py-2.5"
        data-testid="calendar-day-workspace-fallback"
        aria-busy="true"
      >
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <CalendarDayWorkspaceSkeleton />
        </div>
      </section>
    );
  }

  return (
    <section
      className="calendar-workspace calendar-shell calendar-shell--month h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 [--calendar-month-cell-min-height:4.35rem] sm:[--calendar-month-cell-min-height:5rem] lg:[--calendar-month-cell-min-height:5.95rem]"
      data-testid="calendar-month-workspace-fallback"
      aria-busy="true"
    >
      <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col">
        <div className="min-h-0 h-full flex-1 overflow-x-hidden overflow-y-auto lg:overflow-hidden">
          <div className="grid min-h-0 h-full grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-1 xl:grid-cols-[minmax(0,1fr)_25.5rem]">
            <div className="calendar-pane calendar-panel calendar-month-primary-pane flex min-h-0 flex-col rounded-none p-0">
              <CalendarMonthGridSkeleton />
            </div>
            <aside className="calendar-pane calendar-month-secondary-pane min-h-0 lg:h-full">
              <div className="calendar-panel h-full min-h-0 rounded-none border-0 p-5 shadow-none md:p-6">
                <div className="space-y-4" aria-hidden="true">
                  <div className="h-8 animate-pulse rounded-[18px] bg-[rgba(224,204,174,0.56)]" />
                  <div className="h-32 animate-pulse rounded-[22px] bg-[rgba(224,204,174,0.56)]" />
                  <div className="h-48 animate-pulse rounded-[22px] bg-[rgba(224,204,174,0.56)]" />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
