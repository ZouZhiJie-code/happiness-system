"use client";

import React from "react";
import clsx from "clsx";

import { buildCalendarDateButtonAccessibleName } from "@/features/calendar/accessibility";
import { buildCalendarMonthCellPreview } from "@/features/calendar/month-view";
import {
  getCalendarDimensionVisualMeta,
  getCalendarMonthDaySurfaceClass,
  getCalendarMonthDimensionPillClass,
  getCalendarStatusVisualMeta
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
    <div className="space-y-2.5">
      <div className="grid grid-cols-7 gap-1.5 px-0.5">
        {weekLabels.map((label) => (
          <p key={label} className="text-center text-[0.69rem] tracking-[0.01em] text-[#8a6b4b]">
            {label}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5" data-testid="calendar-month-grid">
        {cells.map((cell) => {
          if (!cell.date || !cell.isCurrentMonth) {
            return (
              <div
                key={cell.key}
                data-testid={`calendar-placeholder-${cell.key}`}
                className="calendar-card-muted h-[var(--calendar-month-cell-min-height)] rounded-[20px]"
              />
            );
          }

          const day = daysByDate.get(cell.date);

          if (!day) {
            return (
              <div
                key={cell.key}
                className="calendar-card-muted h-[var(--calendar-month-cell-min-height)] rounded-[20px] p-2.5"
              >
                <span className="font-display text-[1.2rem] leading-none text-[#b59b80]">{cell.dayNumber}</span>
              </div>
            );
          }

          const previewState = buildCalendarMonthCellPreview(day, today);
          const statusVisualMeta = getCalendarStatusVisualMeta(day.overallStatus);

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
                "calendar-day-button group relative flex h-[var(--calendar-month-cell-min-height)] flex-col rounded-[20px] border px-2.5 py-2.5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md",
                getCalendarMonthDaySurfaceClass(day.overallStatus, previewState.hasRecords, previewState.isFutureEmpty),
                selectedDate === day.date &&
                  "ring-2 ring-[rgba(169,111,61,0.24)] ring-offset-2 ring-offset-[#f4ead8] shadow-md",
                previewState.isFutureEmpty && "hover:shadow-none"
              )}
            >
              <span
                aria-hidden="true"
                className={clsx(
                  "absolute inset-x-2.5 top-2 h-1 rounded-full opacity-90",
                  statusVisualMeta.markerClass,
                  !previewState.hasRecords && !previewState.isFutureEmpty && "opacity-55",
                  previewState.isFutureEmpty && "opacity-30"
                )}
              />
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={clsx(
                      "font-display text-[1.18rem] leading-none text-[#312419]",
                      today === day.date && "text-[#8c6034]",
                      previewState.isFutureEmpty && "text-[#8a7157]"
                    )}
                  >
                    {Number(day.date.slice(-2))}
                  </span>
                  {today === day.date ? (
                    <span
                      aria-hidden="true"
                      className="mt-0.5 size-2 rounded-full bg-[#a96f3d] shadow-[0_0_0_4px_rgba(169,111,61,0.12)]"
                    />
                  ) : null}
                </div>
                {previewState.visibleStateLabel ? (
                  <span className={clsx("pt-0.5 text-[0.64rem] font-medium", statusVisualMeta.emphasisClass)}>
                    {previewState.visibleStateLabel}
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className={clsx(
                      "mt-0.5 size-2.5 shrink-0 rounded-full border",
                      statusVisualMeta.markerClass,
                      !previewState.hasRecords && !previewState.isFutureEmpty && "opacity-60",
                      previewState.isFutureEmpty && "opacity-20"
                    )}
                  />
                )}
              </div>

              <div className="mt-4 flex-1" aria-hidden="true" />

              {previewState.hasDailyJournal ? (
                <span
                  aria-hidden="true"
                  className="absolute right-2.5 bottom-2.5 size-1.5 rounded-full bg-[#604529] shadow-[0_0_0_3px_rgba(96,69,41,0.12)]"
                />
              ) : null}

              <div className="mt-auto flex flex-nowrap items-center gap-1 overflow-hidden pt-1">
                {previewState.dimensionPills.map((dimension) => {
                  const visualMeta = getCalendarDimensionVisualMeta(dimension.dimension);

                  return (
                    <span
                      key={`${day.date}-${dimension.dimension}`}
                      data-dimension={dimension.dimension}
                      className={clsx(
                        "inline-flex min-w-[1.2rem] items-center justify-center rounded-[7px] border px-1 py-0.5 text-[0.62rem] font-semibold leading-none",
                        visualMeta.softBadgeClass,
                        getCalendarMonthDimensionPillClass(dimension.tone)
                      )}
                    >
                      {dimension.token}
                    </span>
                  );
                })}
                {previewState.extraDimensionCount > 0 ? (
                  <span className="text-[0.68rem] leading-none text-[#8a6b4b]">
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
