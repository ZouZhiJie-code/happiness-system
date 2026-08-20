"use client";

import { getCalendarLoadingLabel } from "@/features/calendar/accessibility";
import type { CalendarView } from "@/features/calendar/view-state";
import { JournalArchiveWorkspaceFallback } from "@/components/journal/journal-archive-workspace-fallback";
import { JournalWorkspaceFrame } from "@/components/journal/journal-workspace-frame";
import { useSearchParams } from "next/navigation";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import { normalizeCalendarSearchParams } from "@/features/calendar/view-state";

/**
 * 保留旧导入路径，统一把日历进入态投影为新的日报/周报/月报归档工作区骨架。
 */
export function CalendarWorkspaceFallback({ view = "month" }: { view?: CalendarView }) {
  const searchParams = useSearchParams();
  const normalized = normalizeCalendarSearchParams({
    view,
    date: searchParams.get("date"),
    today: getTodayEntryDate()
  });
  return (
    <JournalWorkspaceFrame activeView={view} date={normalized.date}>
      <JournalArchiveWorkspaceFallback view={view} testId={`calendar-${view}-workspace-fallback`} />
    </JournalWorkspaceFrame>
  );
}

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
