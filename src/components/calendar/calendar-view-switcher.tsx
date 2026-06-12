"use client";

import { SlidingSegmentedControl } from "@/components/ui";

import type { CalendarView } from "@/features/calendar/view-state";

const CALENDAR_VIEW_ITEMS: Array<{ value: CalendarView; label: string; ariaLabel: string }> = [
  { value: "month", label: "月", ariaLabel: "切换到月视图" },
  { value: "week", label: "周", ariaLabel: "切换到周视图" },
  { value: "day", label: "日", ariaLabel: "切换到日视图" }
];

export function CalendarViewSwitcher({
  currentView,
  onSelectView
}: {
  currentView: CalendarView;
  onSelectView: (view: CalendarView) => void;
}) {
  return (
    <SlidingSegmentedControl
      variant="calendar"
      ariaLabel="切换日历视图"
      value={currentView}
      onChange={onSelectView}
      items={CALENDAR_VIEW_ITEMS.map((item) => ({
        value: item.value,
        label: item.label,
        ariaLabel: item.ariaLabel,
        buttonProps: {
          "aria-current": currentView === item.value ? ("page" as const) : undefined,
          className: "calendar-segmented-item"
        }
      }))}
      className="calendar-segmented"
    />
  );
}
