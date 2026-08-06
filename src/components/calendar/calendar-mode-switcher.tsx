"use client";

import { SlidingSegmentedControl } from "@/components/ui";
import type { CalendarMode } from "@/features/calendar/view-state";

const CALENDAR_MODE_ITEMS: Array<{ value: CalendarMode; label: string; ariaLabel: string }> = [
  { value: "event_centered", label: "事件", ariaLabel: "切换到事件记录" },
  { value: "legacy", label: "五维", ariaLabel: "切换到历史五维记录" }
];

/** 月、周的读模型切换。日视图由日期定位器决定，不出现手动切换。 */
export function CalendarModeSwitcher({
  currentMode,
  onSelectMode
}: {
  currentMode: CalendarMode;
  onSelectMode: (mode: CalendarMode) => void;
}) {
  return (
    <SlidingSegmentedControl
      variant="calendar"
      ariaLabel="切换日历记录类型"
      value={currentMode}
      onChange={onSelectMode}
      items={CALENDAR_MODE_ITEMS.map((item) => ({
        value: item.value,
        label: item.label,
        ariaLabel: item.ariaLabel,
        buttonProps: {
          "aria-current": currentMode === item.value ? ("page" as const) : undefined
        }
      }))}
    />
  );
}
