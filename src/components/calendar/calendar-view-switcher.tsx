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
      label: "月"
    },
    {
      view: "week" as const,
      label: "周"
    },
    {
      view: "day" as const,
      label: "日"
    }
  ];

  return (
    <nav
      aria-label="切换日历视图"
      className="inline-flex items-center rounded-full border border-[rgba(146,104,64,0.16)] bg-[rgba(255,248,238,0.82)] p-1"
    >
      {items.map((item) => (
        <button
          key={item.view}
          type="button"
          onClick={() => onSelectView(item.view)}
          className={clsx(
            "rounded-full px-3 py-1.5 text-[0.76rem] font-medium text-[#6d5337] transition duration-200 hover:bg-[rgba(166,114,61,0.12)]",
            currentView === item.view && "bg-[rgba(166,114,61,0.18)] text-[#3f2e20]"
          )}
          aria-current={currentView === item.view ? "page" : undefined}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
