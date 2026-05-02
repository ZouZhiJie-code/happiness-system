"use client";

import React from "react";
import clsx from "clsx";

import type { CalendarView } from "@/features/calendar/view-state";

export function CalendarViewSwitcher({
  currentView,
  onSelectView
}: {
  currentView: CalendarView;
  onSelectView: (view: CalendarView) => void;
}) {
  const items = [
    {
      view: "month" as const,
      label: "月",
      ariaLabel: "切换到月视图"
    },
    {
      view: "week" as const,
      label: "周",
      ariaLabel: "切换到周视图"
    },
    {
      view: "day" as const,
      label: "日",
      ariaLabel: "切换到日视图"
    }
  ];

  return (
    <nav
      aria-label="切换日历视图"
      className="calendar-segmented inline-flex items-center rounded-full p-1"
    >
      {items.map((item) => (
        <button
          key={item.view}
          type="button"
          onClick={() => onSelectView(item.view)}
          data-active={currentView === item.view ? "true" : "false"}
          className={clsx(
            "calendar-segmented-item rounded-full px-3 py-1.5 text-[0.76rem] font-medium"
          )}
          aria-current={currentView === item.view ? "page" : undefined}
          aria-label={item.ariaLabel}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
