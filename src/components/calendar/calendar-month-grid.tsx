"use client";

import React from "react";
import clsx from "clsx";

import { CalendarDayCell } from "@/components/calendar/calendar-day-cell";
import type { CalendarDayRecord } from "@/features/calendar/types";
import type { CalendarMonthGridCell } from "@/features/calendar/view-state";

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
                className="min-h-[7.8rem] rounded-[24px] border border-dashed border-[rgba(154,116,75,0.12)] bg-[rgba(255,251,245,0.34)]"
              />
            );
          }

          const day = daysByDate.get(cell.date);

          if (!day) {
            return (
              <div
                key={cell.key}
                className={clsx(
                  "min-h-[7.8rem] rounded-[24px] border border-[rgba(154,116,75,0.12)] bg-[rgba(255,251,245,0.56)] p-3"
                )}
              >
                <span className="font-display text-[1.35rem] leading-none text-[#99806a]">{cell.dayNumber}</span>
              </div>
            );
          }

          return (
            <CalendarDayCell
              key={cell.key}
              day={day}
              isSelected={selectedDate === day.date}
              isToday={today === day.date}
              onSelect={onSelectDate}
            />
          );
        })}
      </div>
    </div>
  );
}
