"use client";

import React from "react";
import clsx from "clsx";

import type { CalendarDayRecord, CalendarDayStatus, CalendarDimensionStatus } from "@/features/calendar/types";

const statusClassMap: Record<CalendarDayStatus, string> = {
  empty: "border-[rgba(157,118,78,0.14)] bg-[rgba(255,250,242,0.78)]",
  in_progress: "border-[rgba(192,136,82,0.32)] bg-[linear-gradient(180deg,rgba(255,244,225,0.96),rgba(243,220,183,0.94))]",
  draft: "border-[rgba(184,126,73,0.34)] bg-[linear-gradient(180deg,rgba(255,240,214,0.98),rgba(235,209,171,0.96))]",
  completed: "border-[rgba(153,102,53,0.38)] bg-[linear-gradient(180deg,rgba(236,205,166,0.98),rgba(210,172,121,0.96))]",
  mixed: "border-[rgba(162,108,60,0.38)] bg-[linear-gradient(180deg,rgba(246,229,203,0.98),rgba(224,189,142,0.94))]"
};

const markerClassMap: Record<CalendarDimensionStatus["status"], string> = {
  empty: "border-[rgba(153,115,75,0.18)] bg-transparent",
  in_progress: "border-[rgba(191,136,79,0.32)] bg-[rgba(207,158,104,0.36)]",
  draft: "border-[rgba(179,120,67,0.42)] bg-[rgba(204,149,92,0.58)]",
  completed: "border-[rgba(139,89,41,0.52)] bg-[rgba(165,108,57,0.9)]",
  mixed: "border-[rgba(130,83,38,0.56)] bg-[linear-gradient(180deg,rgba(195,144,92,0.94),rgba(155,104,54,0.92))]"
};

export function CalendarDayCell({
  day,
  isSelected,
  isToday,
  onSelect
}: {
  day: CalendarDayRecord;
  isSelected: boolean;
  isToday: boolean;
  onSelect: (date: string) => void;
}) {
  const preview = day.primaryTitle ?? day.primarySummary ?? null;

  return (
    <button
      type="button"
      data-testid={`calendar-day-${day.date}`}
      aria-pressed={isSelected}
      aria-label={`${day.date}${isToday ? "，今天" : ""}`}
      onClick={() => onSelect(day.date)}
      className={clsx(
        "group relative flex min-h-[7.8rem] flex-col rounded-[26px] border p-3 text-left shadow-[0_16px_28px_rgba(122,83,43,0.08)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(122,83,43,0.12)]",
        statusClassMap[day.overallStatus],
        isSelected && "ring-2 ring-[rgba(129,82,39,0.34)] ring-offset-2 ring-offset-[rgba(245,229,202,0.72)]",
        isToday && "before:absolute before:right-3 before:top-3 before:h-2 before:w-2 before:rounded-full before:bg-[#8f5b2c] before:content-['']"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-display text-[1.35rem] leading-none text-[#271d16]">{Number(day.date.slice(-2))}</span>
        {isToday ? (
          <span className="rounded-full border border-[rgba(143,91,44,0.2)] bg-[rgba(255,249,239,0.82)] px-2 py-1 text-[0.63rem] tracking-[0.18em] text-[#8d6138]">
            今天
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {day.dimensions.map((dimension) => (
          <span
            key={`${day.date}-${dimension.dimension}`}
            title={`${dimension.dimension}: ${dimension.status}`}
            className={clsx("h-2.5 w-2.5 rounded-full border", markerClassMap[dimension.status])}
          />
        ))}
      </div>

      <p className="mt-3 line-clamp-2 text-[0.82rem] leading-5 text-[#5e4b3b]">
        {preview ?? "这一天还没有开始记录。"}
      </p>
    </button>
  );
}
