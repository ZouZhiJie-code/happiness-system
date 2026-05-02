"use client";

import React from "react";
import Link from "next/link";
import { useState } from "react";

import { buildCalendarActionAccessibleName } from "@/features/calendar/accessibility";
import { buildCalendarCompactCopy, truncateCalendarCopy } from "@/features/calendar/compact-copy";
import { buildCalendarDayViewCardItems } from "@/features/calendar/interview-link";
import { getInterviewDimensionMeta } from "@/features/interview/dimensions";
import {
  calendarDayStatusLabelMap,
  getCalendarDaySurfaceClass,
  getCalendarDimensionVisualMeta,
  getCalendarStatusBadgeClass
} from "@/features/calendar/presentation";
import type { CalendarDayRecord, CalendarDayStatus } from "@/features/calendar/types";
import { formatCalendarDayLabel, formatCalendarUpdatedAt, isFutureCalendarDate } from "@/features/calendar/view-state";
import { cn } from "@/lib/utils";

function getDimensionFallbackSummary(status: CalendarDayStatus, isFuture: boolean) {
  if (isFuture && status === "empty") {
    return "未来日期暂不支持开始记录。";
  }

  switch (status) {
    case "in_progress":
      return "还在访谈里，优先继续。";
    case "draft":
      return "已有草稿，优先补完。";
    case "completed":
      return "已经成稿，可直接查看。";
    case "mixed":
      return "状态混合，先按主动作。";
    default:
      return "还没开始，可从这里记录。";
  }
}

function getDayOverviewSummary(day: CalendarDayRecord, today: string) {
  if (day.primarySummary) {
    return day.primarySummary;
  }

  if (isFutureCalendarDate(day.date, today)) {
    return "未来日期先看分布。";
  }

  if (day.overallStatus === "empty") {
    return "还没有记录。";
  }

  if (day.overallStatus === "mixed") {
    return "先选最值得继续的一维。";
  }

  return "五维状态都在这里。";
}

function CalendarDayViewAction({
  href,
  label,
  disabled,
  tone = "primary",
  ariaLabel
}: {
  href: string | null;
  label: string;
  disabled: boolean;
  tone?: "primary" | "secondary";
  ariaLabel?: string;
}) {
  const className = cn(
    "transition duration-200",
    tone === "primary" &&
      "calendar-action-primary inline-flex w-full items-center justify-center rounded-full px-3.5 py-2 text-[0.82rem]",
    tone === "secondary" &&
      "calendar-action-secondary text-[0.84rem]"
  );

  if (!href || disabled) {
    return (
      <span
        data-action-tone={tone === "primary" ? "disabled-primary" : "disabled-secondary"}
        aria-label={ariaLabel}
        aria-disabled="true"
        className={cn(
          className,
          "calendar-action-disabled",
          tone === "primary" && "hover:translate-y-0",
          tone === "secondary" && "no-underline"
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <Link href={href} className={className} data-action-tone={tone} aria-label={ariaLabel}>
      {label}
    </Link>
  );
}

function CalendarDayViewSummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="calendar-summary-chip rounded-full px-2.5 py-1">
      <span className="text-[0.64rem] text-[#8a6b4b]">{label}</span>
      <span className="ml-1.5 tabular-nums text-[0.76rem] font-medium text-[#604529]">{value}</span>
    </div>
  );
}

function CalendarDayViewSecondaryActions({
  actions,
  actionPrefix
}: {
  actions: ReturnType<typeof buildCalendarDayViewCardItems>[number]["secondaryActions"];
  actionPrefix: {
    dimensionLabel: string;
    statusLabel: string;
    title: string | null;
  };
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="calendar-action-secondary text-[0.78rem]"
        aria-expanded={isOpen ? "true" : "false"}
        aria-label={buildCalendarActionAccessibleName({
          ...actionPrefix,
          actionLabel: "更多操作"
        })}
      >
        更多操作
      </button>

      {isOpen ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
          {actions.map((action) => (
            <CalendarDayViewAction
              key={action.id}
              href={action.href}
              label={action.disabledReason ?? action.label}
              disabled={!action.href}
              tone="secondary"
              ariaLabel={buildCalendarActionAccessibleName({
                ...actionPrefix,
                actionLabel: action.disabledReason ?? action.label
              })}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CalendarDayView({
  day,
  today
}: {
  day: CalendarDayRecord;
  today: string;
}) {
  const cardItems = buildCalendarDayViewCardItems(day, today);
  const updatedAtLabel = formatCalendarUpdatedAt(day.latestUpdatedAt);
  const overviewTitle = day.primaryTitle ? truncateCalendarCopy(day.primaryTitle, 24) : formatCalendarDayLabel(day.date);
  const overviewDateLabel = day.primaryTitle ? formatCalendarDayLabel(day.date) : "当天记录";

  return (
    <section className="space-y-3.5" data-testid="calendar-day-view">
      <div className="calendar-card rounded-[26px] p-4 md:p-4.5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-[42rem] min-w-0">
            <p className="text-[0.72rem] tracking-[0.02em] text-[#8a6b4b]">{overviewDateLabel}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <h2 className="text-balance font-display text-[1.4rem] leading-none text-[#312419]">
                {overviewTitle}
              </h2>
              <span
                className={cn("rounded-full border px-2.5 py-1 text-[0.74rem]", getCalendarStatusBadgeClass(day.overallStatus))}
              >
                {calendarDayStatusLabelMap[day.overallStatus]}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-pretty text-[0.88rem] leading-6 text-[#6a5440]">
              {truncateCalendarCopy(getDayOverviewSummary(day, today), 42)}
            </p>
            <p className="mt-2 text-[0.74rem] text-[#8a6b4b]">{updatedAtLabel ? `最后更新：${updatedAtLabel}` : "最后更新：暂无"}</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <CalendarDayViewSummaryPill label="进行中" value={`${day.activeCount}项`} />
            <CalendarDayViewSummaryPill label="草稿" value={`${day.draftCount}项`} />
            <CalendarDayViewSummaryPill label="已完成" value={`${day.savedCount}项`} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {cardItems.map((item) => {
          const isFuture = isFutureCalendarDate(day.date, today);
          const summary = buildCalendarCompactCopy(
            [item.summary, item.title],
            getDimensionFallbackSummary(item.status, isFuture),
            36
          );
          const meta = getInterviewDimensionMeta(item.dimension);
          const visualMeta = getCalendarDimensionVisualMeta(item.dimension);
          const primaryActionDisabled = !item.primaryAction.href;
          const actionPrefix = {
            dimensionLabel: item.dimensionLabel,
            statusLabel: calendarDayStatusLabelMap[item.status],
            title: item.title
          };

          return (
            <article
              key={`${day.date}-${item.dimension}`}
              data-testid={`calendar-dimension-card-${item.dimension}`}
              data-dimension={item.dimension}
              data-status={item.status}
              className={cn(
                "calendar-card flex min-h-[var(--calendar-day-card-min-height)] flex-col rounded-[24px] p-4",
                getCalendarDaySurfaceClass(item.status)
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className={cn("calendar-dimension-badge", visualMeta.softBadgeClass)}>{visualMeta.shortLabel}</span>
                  <p className="mt-2.5 line-clamp-2 text-balance font-display text-[1.02rem] leading-tight text-[#312419]">
                    {truncateCalendarCopy(item.title ?? `${meta.label}记录`, 18)}
                  </p>
                </div>
                <span
                  className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[0.72rem]", getCalendarStatusBadgeClass(item.status))}
                >
                  {calendarDayStatusLabelMap[item.status]}
                </span>
              </div>

              <p className="mt-3 line-clamp-2 text-pretty text-[0.82rem] leading-6 text-[#6a5440]">{summary}</p>

              <div className="mt-auto pt-4">
                <CalendarDayViewAction
                  href={item.primaryAction.href}
                  label={item.primaryAction.disabledReason ?? item.primaryAction.label}
                  disabled={primaryActionDisabled}
                  ariaLabel={buildCalendarActionAccessibleName({
                    ...actionPrefix,
                    actionLabel: item.primaryAction.disabledReason ?? item.primaryAction.label
                  })}
                />

                <CalendarDayViewSecondaryActions actions={item.secondaryActions} actionPrefix={actionPrefix} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
