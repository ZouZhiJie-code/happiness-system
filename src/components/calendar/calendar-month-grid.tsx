"use client";

import React from "react";
import clsx from "clsx";

import { buildCalendarDateButtonAccessibleName } from "@/features/calendar/accessibility";
import { buildCalendarMonthCellPreview } from "@/features/calendar/month-view";
import {
  getCalendarDimensionVisualMeta,
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
          <p key={label} className="text-center text-[0.72rem] text-[#8a6b4b]">
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
                className="calendar-card-muted min-h-[8.6rem] rounded-[22px]"
              />
            );
          }

          const day = daysByDate.get(cell.date);

          if (!day) {
            return (
              <div
                key={cell.key}
                className="calendar-card-muted min-h-[8.6rem] rounded-[22px] p-3"
              >
                <span className="font-display text-[1.35rem] leading-none text-[#b59b80]">{cell.dayNumber}</span>
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
              aria-label={buildCalendarDateButtonAccessibleName({
                dateLabel: formatCalendarDayLabel(day.date),
                statusLabel: previewState.statusLabel,
                preview: previewState.preview,
                isToday: today === day.date,
                isSelected: selectedDate === day.date,
                dimensionLabels: previewState.dimensionPills.map((dimension) => dimension.label),
                extraDimensionCount: previewState.extraDimensionCount
              })}
              onClick={() => onSelectDate(day.date)}
              className={clsx(
                "calendar-day-button group relative flex min-h-[8.6rem] flex-col rounded-[24px] border p-3 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md",
                getCalendarMonthDaySurfaceClass(day.overallStatus, previewState.hasRecords),
                selectedDate === day.date &&
                  "ring-2 ring-[rgba(169,111,61,0.24)] ring-offset-2 ring-offset-[#f4ead8] shadow-md",
                today === day.date && "before:absolute before:right-3 before:top-3 before:size-2.5 before:rounded-full before:bg-[#a96f3d] before:content-['']"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-display text-[1.35rem] leading-none text-[#312419]">{Number(day.date.slice(-2))}</span>
                {today === day.date ? (
                  <span className="calendar-chip rounded-full px-2 py-1 text-[0.63rem] text-[#604529]">
                    今天
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className={clsx("rounded-full border px-2.5 py-1 text-[0.68rem]", "calendar-chip", previewState.hasRecords ? "" : "text-[#8a6b4b]")}>
                  {previewState.statusLabel}
                </span>
              </div>

              <p className="mt-3 line-clamp-2 min-h-[2.6rem] text-pretty text-[0.84rem] leading-5 text-[#6a5440]">
                {previewState.preview}
              </p>

              <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                {previewState.dimensionPills.map((dimension) => {
                  const visualMeta = getCalendarDimensionVisualMeta(dimension.dimension);

                  return (
                    <span
                      key={`${day.date}-${dimension.dimension}`}
                      data-dimension={dimension.dimension}
                      className={clsx(
                        "calendar-dimension-badge px-2 py-1 text-[0.68rem]",
                        visualMeta.softBadgeClass,
                        getCalendarMonthDimensionPillClass(dimension.tone)
                      )}
                    >
                      {dimension.label}
                    </span>
                  );
                })}
                {previewState.extraDimensionCount > 0 ? (
                  <span className="calendar-chip rounded-full px-2 py-1 text-[0.68rem] leading-none text-[#8a6b4b]">
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
