"use client";

import React from "react";
import clsx from "clsx";

import { buildCalendarDateButtonAccessibleName } from "@/features/calendar/accessibility";
import {
  calendarDayStatusLabelMap,
  getCalendarDaySurfaceClass,
  getCalendarDimensionMarkerClass,
  getCalendarDimensionVisualMeta
} from "@/features/calendar/presentation";
import type { CalendarDayRecord } from "@/features/calendar/types";
import { formatCalendarDayLabel } from "@/features/calendar/view-state";

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
      aria-label={buildCalendarDateButtonAccessibleName({
        dateLabel: formatCalendarDayLabel(day.date),
        statusLabel: calendarDayStatusLabelMap[day.overallStatus],
        preview: preview ?? "还没有记录。",
        isToday,
        isSelected,
        dimensionLabels: day.dimensions
          .filter((dimension) => dimension.status !== "empty")
          .slice(0, 3)
          .map((dimension) => getCalendarDimensionVisualMeta(dimension.dimension).shortLabel)
      })}
      onClick={() => onSelect(day.date)}
      className={clsx(
        "calendar-day-button calendar-card group relative flex min-h-[7.8rem] flex-col rounded-[24px] border p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-md",
        getCalendarDaySurfaceClass(day.overallStatus),
        isSelected && "ring-2 ring-[rgba(169,111,61,0.24)] ring-offset-2 ring-offset-[#f4ead8]",
        isToday && "before:absolute before:right-3 before:top-3 before:size-2.5 before:rounded-full before:bg-[#a96f3d] before:content-['']"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-display text-[1.35rem] leading-none text-[#312419]">{Number(day.date.slice(-2))}</span>
        {isToday ? (
          <span className="calendar-chip rounded-full px-2 py-1 text-[0.63rem] text-[#604529]">
            今天
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {day.dimensions.map((dimension) => (
          <span
            key={`${day.date}-${dimension.dimension}`}
            aria-hidden="true"
            className={clsx("size-2.5 rounded-full border", getCalendarDimensionMarkerClass(dimension.status))}
          />
        ))}
      </div>

      <p className="mt-3 line-clamp-2 text-pretty text-[0.82rem] leading-5 text-[#6a5440]">
        {preview ?? "这一天还没有开始记录。"}
      </p>
    </button>
  );
}
