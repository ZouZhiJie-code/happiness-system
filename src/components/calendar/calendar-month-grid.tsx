"use client";

import React from "react";
import clsx from "clsx";

import { buildCalendarMonthCellPreview } from "@/features/calendar/month-view";
import {
  getCalendarMonthDaySurfaceClass,
  getCalendarMonthDimensionPillClass
} from "@/features/calendar/presentation";
import type { CalendarDayRecord } from "@/features/calendar/types";
import { formatCalendarDayLabel, type CalendarMonthGridCell } from "@/features/calendar/view-state";

const weekLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function CalendarMonthGrid({
  cells,
  daysByDate,
  selectedDate,
  today,
  onSelectDate
}: {
  cells: CalendarMonthGridCell[];
  daysByDate: Map<string, CalendarDayRecord>;
  selectedDate: string;
  today: string;
  onSelectDate: (date: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-2 px-1">
        {weekLabels.map((label) => (
          <p key={label} className="text-center text-[0.72rem] tracking-[0.18em] text-[#8f6a46]">
            {label}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2" data-testid="calendar-month-grid">
        {cells.map((cell) => {
          if (!cell.date || !cell.isCurrentMonth) {
            return (
              <div
                key={cell.key}
                data-testid={`calendar-placeholder-${cell.key}`}
                className="min-h-[8.6rem] rounded-[24px] border border-dashed border-[rgba(154,116,75,0.1)] bg-[rgba(255,251,245,0.24)]"
              />
            );
          }

          const day = daysByDate.get(cell.date);

          if (!day) {
            return (
              <div
                key={cell.key}
                className={clsx(
                  "min-h-[8.6rem] rounded-[24px] border border-[rgba(154,116,75,0.12)] bg-[rgba(255,251,245,0.56)] p-3"
                )}
              >
                <span className="font-display text-[1.35rem] leading-none text-[#99806a]">{cell.dayNumber}</span>
              </div>
            );
          }

          const previewState = buildCalendarMonthCellPreview(day);

          return (
            <button
              key={cell.key}
              type="button"
              data-testid={`calendar-day-${day.date}`}
              data-status={day.overallStatus}
              data-recorded={previewState.hasRecords ? "true" : "false"}
              data-selected={selectedDate === day.date ? "true" : "false"}
              data-today={today === day.date ? "true" : "false"}
              aria-pressed={selectedDate === day.date}
              aria-label={`${formatCalendarDayLabel(day.date)}${today === day.date ? "，今天" : ""}，${previewState.statusLabel}，${previewState.preview}`}
              onClick={() => onSelectDate(day.date)}
              className={clsx(
                "group relative flex min-h-[8.6rem] flex-col rounded-[26px] border p-3 text-left shadow-[0_16px_28px_rgba(122,83,43,0.08)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(122,83,43,0.12)]",
                getCalendarMonthDaySurfaceClass(day.overallStatus, previewState.hasRecords),
                selectedDate === day.date &&
                  "ring-2 ring-[rgba(129,82,39,0.34)] ring-offset-2 ring-offset-[rgba(245,229,202,0.72)] shadow-[0_18px_34px_rgba(122,83,43,0.16)]",
                today === day.date && "before:absolute before:right-3 before:top-3 before:h-2 before:w-2 before:rounded-full before:bg-[#8f5b2c] before:content-['']"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-display text-[1.35rem] leading-none text-[#271d16]">{Number(day.date.slice(-2))}</span>
                {today === day.date ? (
                  <span className="rounded-full border border-[rgba(143,91,44,0.18)] bg-[rgba(255,249,239,0.82)] px-2 py-1 text-[0.63rem] tracking-[0.18em] text-[#8d6138]">
                    今天
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="rounded-full border border-[rgba(150,101,55,0.16)] bg-[rgba(255,250,243,0.88)] px-2.5 py-1 text-[0.68rem] text-[#6b4b30]">
                  {previewState.statusLabel}
                </span>
              </div>

              <p className="mt-3 line-clamp-2 min-h-[2.6rem] text-[0.84rem] leading-5 text-[#5e4b3b]">{previewState.preview}</p>

              <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                {previewState.dimensionPills.map((dimension) => (
                  <span
                    key={`${day.date}-${dimension.dimension}`}
                    className={clsx(
                      "rounded-full border px-2 py-1 text-[0.68rem] leading-none",
                      getCalendarMonthDimensionPillClass(dimension.tone)
                    )}
                  >
                    {dimension.label}
                  </span>
                ))}
                {previewState.extraDimensionCount > 0 ? (
                  <span className="rounded-full border border-[rgba(153,115,75,0.14)] bg-[rgba(255,251,245,0.82)] px-2 py-1 text-[0.68rem] leading-none text-[#8b7057]">
                    +{previewState.extraDimensionCount}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
