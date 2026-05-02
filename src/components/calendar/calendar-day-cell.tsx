"use client";

import React from "react";
import clsx from "clsx";

import { getCalendarDaySurfaceClass, getCalendarDimensionMarkerClass } from "@/features/calendar/presentation";
import type { CalendarDayRecord } from "@/features/calendar/types";

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
        getCalendarDaySurfaceClass(day.overallStatus),
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
            className={clsx("size-2.5 rounded-full border", getCalendarDimensionMarkerClass(dimension.status))}
          />
        ))}
      </div>

      <p className="mt-3 line-clamp-2 text-[0.82rem] leading-5 text-[#5e4b3b]">
        {preview ?? "这一天还没有开始记录。"}
      </p>
    </button>
  );
}
