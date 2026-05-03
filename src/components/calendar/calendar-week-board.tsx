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
    <span className="calendar-summary-chip rounded-full px-2 py-1 text-[0.68rem] leading-none text-[#755d47]">
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
      <div className="grid min-w-[980px] grid-cols-7 gap-2.5" data-testid="calendar-week-board">
        {days.map((day) => {
          const cardState = buildCalendarWeekCardState(day, today);
          const dateLabel = formatCalendarWeekdayLabel(day.date);
          const dailyJournalLabel =
            day.dailyJournal?.state === "saved"
              ? "当天日志已保存"
              : day.dailyJournal?.state === "draft"
                ? "当天日志草稿"
                : day.dailyJournal?.state === "stale"
                  ? "当天日志来源已更新"
                  : null;

          return (
            <article
              key={day.date}
              data-testid={`calendar-week-day-${day.date}`}
              data-status={day.overallStatus}
              aria-current={today === day.date ? "date" : undefined}
              className={clsx(
                "calendar-card flex min-h-[13.75rem] flex-col rounded-[22px] border p-3.5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md",
                getCalendarWeekDaySurfaceClass(day.overallStatus)
              )}
              aria-label={`${dateLabel}，${cardState.statusLabel}${dailyJournalLabel ? `，${dailyJournalLabel}` : ""}，主动作：${cardState.action.label}`}
            >
              <div className="flex min-h-[2.8rem] items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={clsx("font-display text-[1.12rem] leading-none text-[#312419]", today === day.date && "text-[#8c6034]")}>
                      {dateLabel}
                    </h3>
                    {today === day.date ? <span aria-hidden="true" className="size-2 rounded-full bg-[#a96f3d]" /> : null}
                  </div>
                </div>

                <span
                  className={clsx(
                    "shrink-0 rounded-full border px-2.5 py-1 text-[0.74rem] tabular-nums",
                    getCalendarStatusBadgeClass(day.overallStatus)
                  )}
                >
                  {cardState.statusLabel}
                </span>
                {dailyJournalLabel ? (
                  <span
                    aria-hidden="true"
                    className="mt-1 size-1.5 shrink-0 rounded-full bg-[#604529] shadow-[0_0_0_3px_rgba(96,69,41,0.12)]"
                  />
                ) : null}
              </div>

              <div className="mt-3 flex min-h-[2.25rem] flex-wrap content-start gap-1.5">
                <SummaryPill text={cardState.completedCountLabel} />
                <SummaryPill text={cardState.draftCountLabel} />
                <SummaryPill text={cardState.activeCountLabel} />
              </div>

              {cardState.touchedDimensions.length > 0 ? (
                <div className="mt-3 flex min-h-[2rem] flex-wrap content-start gap-1.5">
                  {cardState.touchedDimensions.map((dimension) => {
                    const visualMeta = getCalendarDimensionVisualMeta(dimension);

                    return (
                      <span
                        key={`${day.date}-${dimension}`}
                        data-dimension={dimension}
                        className={clsx("calendar-dimension-badge", visualMeta.softBadgeClass)}
                        aria-label={visualMeta.shortLabel}
                        title={visualMeta.shortLabel}
                      >
                        {visualMeta.monthLabel}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 min-h-[2rem]" aria-hidden="true" />
              )}

              <p className="mt-3 min-h-[3.5rem] text-pretty text-[0.82rem] leading-6 text-[#6a5440]">{cardState.headline}</p>

              <div className="mt-auto pt-3">
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
                    "inline-flex w-full items-center justify-center rounded-full px-3 py-2 text-[0.78rem] font-medium transition duration-200",
                    cardState.action.isDirectAction ? "calendar-action-primary" : "calendar-chip text-[#604529]"
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
