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
    <div className="flex min-h-full flex-1 flex-col gap-1.5 px-4 pb-1 pt-3 md:gap-2 md:px-5 md:pb-1.5 md:pt-4">
      <div className="grid shrink-0 grid-cols-7 px-1">
        {weekLabels.map((label) => (
          <p key={label} className="text-center text-[0.75rem] tracking-[0.01em] text-[#8a6b4b]">
            {label}
          </p>
        ))}
      </div>

      <div
        className="calendar-month-grid-sheet grid min-h-[calc(var(--calendar-month-cell-min-height)*6)] flex-1 grid-cols-7 overflow-hidden rounded-none [grid-auto-rows:minmax(var(--calendar-month-cell-min-height),1fr)]"
        data-testid="calendar-month-grid"
      >
        {cells.map((cell) => {
          if (!cell.date || !cell.isCurrentMonth) {
            return (
              <div
                key={cell.key}
                data-testid={`calendar-placeholder-${cell.key}`}
                className="calendar-month-cell calendar-month-placeholder min-h-[var(--calendar-month-cell-min-height)]"
              />
            );
          }

          const day = daysByDate.get(cell.date);

          if (!day) {
            return (
              <div
                key={cell.key}
                className="calendar-month-cell calendar-month-placeholder min-h-[var(--calendar-month-cell-min-height)] p-2.5"
              >
                <span className="font-display text-[1.2rem] leading-none text-[#b59b80]">{cell.dayNumber}</span>
              </div>
            );
          }

          const previewState = buildCalendarMonthCellPreview(day, today);

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
              aria-current={today === day.date ? "date" : undefined}
              aria-label={buildCalendarDateButtonAccessibleName({
                dateLabel: formatCalendarDayLabel(day.date),
                statusLabel: previewState.statusLabel,
                isToday: today === day.date,
                isSelected: selectedDate === day.date,
                isFuture: previewState.isFutureEmpty,
                dimensionLabels: previewState.ariaDimensionLabels,
                extraDimensionCount: previewState.extraDimensionCount,
                dailyJournalLabel: previewState.dailyJournalLabel
              })}
              onClick={() => onSelectDate(day.date)}
              className={clsx(
                "calendar-day-button calendar-month-cell group relative flex min-h-[var(--calendar-month-cell-min-height)] flex-col px-2.5 py-2.5 text-left transition duration-200",
                getCalendarMonthDaySurfaceClass(day.overallStatus, previewState.hasRecords, previewState.isFutureEmpty)
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={clsx("font-display text-[1.18rem] leading-none text-[#312419]", today === day.date && "text-[#8c6034]")}>
                  {Number(day.date.slice(-2))}
                </span>
              </div>

              <div className="mt-4 flex-1" aria-hidden="true" />

              <div className="mt-auto flex flex-nowrap items-center gap-1.5 overflow-hidden pt-1.5">
                {previewState.visibleStateLabel ? (
                  <span
                    className={clsx(
                      "inline-flex h-5 min-w-[3.4rem] items-center justify-center rounded-[999px] px-2.5 text-[0.75rem] font-semibold leading-none tracking-[0.02em]",
                      "bg-[#eef6ec] text-[#45644a] shadow-[inset_0_1px_0_rgba(255,252,247,0.72),0_1px_1.5px_rgba(120,94,66,0.08)]"
                    )}
                  >
                    {previewState.visibleStateLabel}
                  </span>
                ) : (
                  <>
                    {previewState.dimensionPills.map((dimension) => {
                      const visualMeta = getCalendarDimensionVisualMeta(dimension.dimension);

                      return (
                        <span
                          key={`${day.date}-${dimension.dimension}`}
                          data-dimension={dimension.dimension}
                          className={clsx(
                            "inline-flex h-5 min-w-[1.45rem] items-center justify-center rounded-[999px] px-1.5 text-[0.75rem] font-semibold leading-none tracking-[0.01em]",
                            "shadow-[inset_0_1px_0_rgba(255,252,247,0.68),0_1px_1.5px_rgba(120,94,66,0.06)]",
                            visualMeta.softBadgeClass,
                            getCalendarMonthDimensionPillClass(dimension.tone)
                          )}
                        >
                          {dimension.token}
                        </span>
                      );
                    })}
                    {previewState.extraDimensionCount > 0 ? (
                      <span className="text-[0.75rem] leading-none text-[#8a6b4b]">
                        +{previewState.extraDimensionCount}
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
