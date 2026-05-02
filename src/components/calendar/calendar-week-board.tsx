"use client";

import React from "react";
import Link from "next/link";
import clsx from "clsx";

import { buildCalendarWeekCardState } from "@/features/calendar/week-view";
import { getCalendarStatusBadgeClass, getCalendarWeekDaySurfaceClass } from "@/features/calendar/presentation";
import type { CalendarDayRecord } from "@/features/calendar/types";
import { formatCalendarWeekdayLabel } from "@/features/calendar/view-state";

function SummaryPill({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-[rgba(153,115,75,0.14)] bg-[rgba(255,251,245,0.84)] px-2.5 py-1 text-[0.72rem] leading-none text-[#6f5640]">
      {text}
    </span>
  );
}

export function CalendarWeekBoard({
  days,
  today
}: {
  days: CalendarDayRecord[];
  today: string;
}) {
  return (
    <div className="overflow-x-auto overflow-y-hidden pb-1">
      <div className="grid min-w-[1120px] grid-cols-7 gap-3" data-testid="calendar-week-board">
        {days.map((day) => {
          const cardState = buildCalendarWeekCardState(day, today);

          return (
            <article
              key={day.date}
              data-testid={`calendar-week-day-${day.date}`}
              data-status={day.overallStatus}
              className={clsx(
                "flex min-h-[18rem] flex-col rounded-[28px] border p-4 shadow-[0_16px_28px_rgba(122,83,43,0.08)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(122,83,43,0.12)]",
                getCalendarWeekDaySurfaceClass(day.overallStatus)
              )}
              aria-label={`${formatCalendarWeekdayLabel(day.date)}，${cardState.statusLabel}，主动作：${cardState.action.label}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-[1.28rem] leading-none text-[#2b2018]">{formatCalendarWeekdayLabel(day.date)}</h3>
                  {today === day.date ? (
                    <span className="mt-2 inline-flex rounded-full border border-[rgba(143,91,44,0.2)] bg-[rgba(255,249,239,0.82)] px-2 py-1 text-[0.63rem] tracking-[0.18em] text-[#8d6138]">
                      今天
                    </span>
                  ) : null}
                </div>

                <span
                  className={clsx(
                    "shrink-0 rounded-full border px-2.5 py-1 text-[0.74rem] tabular-nums",
                    getCalendarStatusBadgeClass(day.overallStatus)
                  )}
                >
                  {cardState.statusLabel}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                <SummaryPill text={cardState.completedCountLabel} />
                <SummaryPill text={cardState.draftCountLabel} />
                <SummaryPill text={cardState.activeCountLabel} />
              </div>

              <p className="mt-4 min-h-[5.2rem] text-pretty text-[0.9rem] leading-7 text-[#4f3d30]">{cardState.headline}</p>

              <div className="mt-auto pt-4">
                <Link
                  href={cardState.action.href}
                  className={clsx(
                    "inline-flex w-full items-center justify-center rounded-full border px-3.5 py-2.5 text-[0.84rem] font-medium transition duration-200 hover:-translate-y-0.5",
                    cardState.action.isDirectAction
                      ? "border-[rgba(150,101,55,0.18)] bg-[linear-gradient(180deg,#e7c08e,#d49f65)] text-[#332417] shadow-[0_10px_22px_rgba(145,94,48,0.12)]"
                      : "border-[rgba(150,101,55,0.16)] bg-[rgba(255,249,239,0.88)] text-[#62462d]"
                  )}
                >
                  {cardState.action.label}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
