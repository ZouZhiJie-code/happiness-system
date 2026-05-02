"use client";

import React from "react";
import Link from "next/link";
import clsx from "clsx";

import { buildCalendarActionAccessibleName } from "@/features/calendar/accessibility";
import { buildCalendarWeekCardState } from "@/features/calendar/week-view";
import {
  getCalendarDimensionVisualMeta,
  getCalendarStatusBadgeClass,
  getCalendarWeekDaySurfaceClass
} from "@/features/calendar/presentation";
import type { CalendarDayRecord } from "@/features/calendar/types";
import { formatCalendarWeekdayLabel } from "@/features/calendar/view-state";

function SummaryPill({ text }: { text: string }) {
  return (
    <span className="calendar-summary-chip rounded-full px-2.5 py-1 text-[0.72rem] leading-none text-[#516174]">
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
          const dateLabel = formatCalendarWeekdayLabel(day.date);

          return (
            <article
              key={day.date}
              data-testid={`calendar-week-day-${day.date}`}
              data-status={day.overallStatus}
              className={clsx(
                "calendar-card flex min-h-[18rem] flex-col rounded-[24px] border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md",
                getCalendarWeekDaySurfaceClass(day.overallStatus)
              )}
              aria-label={`${dateLabel}，${cardState.statusLabel}，主动作：${cardState.action.label}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-[1.28rem] leading-none text-[#17212b]">{dateLabel}</h3>
                  {today === day.date ? (
                    <span className="calendar-chip mt-2 inline-flex rounded-full px-2 py-1 text-[0.63rem] text-[#20364a]">
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

              {cardState.touchedDimensions.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {cardState.touchedDimensions.map((dimension) => {
                    const visualMeta = getCalendarDimensionVisualMeta(dimension);

                    return (
                      <span
                        key={`${day.date}-${dimension}`}
                        data-dimension={dimension}
                        className={clsx("calendar-dimension-badge", visualMeta.softBadgeClass)}
                      >
                        {visualMeta.shortLabel}
                      </span>
                    );
                  })}
                </div>
              ) : null}

              <p className="mt-4 min-h-[5.2rem] text-pretty text-[0.9rem] leading-7 text-[#475569]">{cardState.headline}</p>

              <div className="mt-auto pt-4">
                <Link
                  href={cardState.action.href}
                  data-action-tone={cardState.action.isDirectAction ? "primary" : "secondary"}
                  aria-label={buildCalendarActionAccessibleName({
                    dateLabel,
                    statusLabel: cardState.statusLabel,
                    title: day.primaryTitle ?? day.primarySummary ?? cardState.headline,
                    actionLabel: cardState.action.label
                  })}
                  className={clsx(
                    "inline-flex w-full items-center justify-center rounded-full px-3.5 py-2.5 text-[0.84rem] font-medium transition duration-200",
                    cardState.action.isDirectAction ? "calendar-action-primary" : "calendar-chip text-[#20364a]"
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
