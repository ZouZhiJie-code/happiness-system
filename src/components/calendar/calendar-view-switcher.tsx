"use client";

import React from "react";
import Link from "next/link";
import clsx from "clsx";

import type { CalendarView } from "@/features/calendar/view-state";

export function CalendarViewSwitcher({
  currentView,
  currentDate
}: {
  currentView: Extract<CalendarView, "month" | "week">;
  currentDate: string;
}) {
  const items = [
    {
      view: "month" as const,
      label: "月视图"
    },
    {
      view: "week" as const,
      label: "周视图"
    }
  ];

  return (
    <nav
      aria-label="切换日历视图"
      className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[rgba(152,105,61,0.18)] bg-[rgba(255,249,240,0.82)] p-1"
    >
      {items.map((item) => (
        <Link
          key={item.view}
          href={`/calendar?view=${item.view}&date=${currentDate}`}
          className={clsx(
            "rounded-full px-3.5 py-2 text-[0.82rem] text-[#62462d] transition duration-200 hover:-translate-y-0.5",
            currentView === item.view && "bg-[linear-gradient(180deg,#ead2ad,#ddb884)] text-[#352519]"
          )}
          aria-current={currentView === item.view ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
