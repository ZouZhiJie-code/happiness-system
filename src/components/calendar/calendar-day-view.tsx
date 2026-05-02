"use client";

import React from "react";
import Link from "next/link";

import { buildCalendarDayViewCardItems } from "@/features/calendar/interview-link";
import { getInterviewDimensionMeta } from "@/features/interview/dimensions";
import { calendarDayStatusLabelMap, getCalendarStatusBadgeClass } from "@/features/calendar/presentation";
import type { CalendarDayRecord, CalendarDayStatus } from "@/features/calendar/types";
import { formatCalendarUpdatedAt, isFutureCalendarDate } from "@/features/calendar/view-state";
import { cn } from "@/lib/utils";

function getDimensionFallbackSummary(status: CalendarDayStatus, isFuture: boolean) {
  if (isFuture && status === "empty") {
    return "未来日期暂不支持开始记录。";
  }

  switch (status) {
    case "in_progress":
      return "这条还在访谈里，适合先继续补完整。";
    case "draft":
      return "这一维已经有草稿，可以先继续整理。";
    case "completed":
      return "这一维已经完成，可以直接查看当前成稿。";
    case "mixed":
      return "这一维同时有多种状态，先按主动作继续。";
    default:
      return "这一维还没有开始，可以从这里补第一条。";
  }
}

function getDayOverviewSummary(day: CalendarDayRecord, today: string) {
  if (day.primarySummary) {
    return day.primarySummary;
  }

  if (isFutureCalendarDate(day.date, today)) {
    return "可以先看看未来日期的分布，但还不能提前开始记录。";
  }

  if (day.overallStatus === "empty") {
    return "这一天还没有留下记录，可以直接从任一维度开始。";
  }

  if (day.overallStatus === "mixed") {
    return "这一天同时存在访谈、草稿和成稿线索，适合先判断哪一维最值得继续补。";
  }

  return "这里汇总了这一天五个维度的记录状态和下一步入口。";
}

function CalendarDayViewAction({
  href,
  label,
  disabled,
  tone = "primary"
}: {
  href: string | null;
  label: string;
  disabled: boolean;
  tone?: "primary" | "secondary";
}) {
  const className = cn(
    "transition duration-200",
    tone === "primary" &&
      "inline-flex w-full items-center justify-center rounded-full border px-3.5 py-2 text-[0.82rem] hover:-translate-y-0.5 border-[rgba(150,101,55,0.18)] bg-[linear-gradient(180deg,#e7c08e,#d49f65)] text-[#332417] shadow-[0_10px_22px_rgba(145,94,48,0.12)]",
    tone === "secondary" &&
      "text-[0.84rem] text-[#705239] underline decoration-[rgba(112,82,57,0.32)] underline-offset-4 hover:text-[#4f3621]"
  );

  if (!href || disabled) {
    return (
      <span
        className={cn(
          className,
          tone === "primary" &&
            "cursor-not-allowed border-dashed bg-[rgba(255,249,239,0.88)] text-[#8a6d52] shadow-none hover:translate-y-0",
          tone === "secondary" && "cursor-not-allowed text-[#9c8167] no-underline"
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

function CalendarDayViewSummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-[rgba(160,113,68,0.14)] bg-[rgba(255,251,245,0.84)] px-3 py-1.5">
      <span className="text-[0.68rem] text-[#8a6e51]">{label}</span>
      <span className="ml-2 tabular-nums text-[0.8rem] font-medium text-[#3d2d1f]">{value}</span>
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

  return (
    <section className="space-y-5" data-testid="calendar-day-view">
      <div className="paper-sheet rounded-[32px] p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-[42rem]">
            <p className="archive-label">DAY OVERVIEW</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="text-balance font-display text-[1.85rem] leading-none text-[#2a2017]">
                {day.primaryTitle ?? "这一天的记录总览"}
              </h2>
              <span
                className={cn("rounded-full border px-3 py-1.5 text-[0.78rem]", getCalendarStatusBadgeClass(day.overallStatus))}
              >
                {calendarDayStatusLabelMap[day.overallStatus]}
              </span>
            </div>
            <p className="mt-3 text-pretty text-[0.95rem] leading-7 text-[#5b4b3e]">{getDayOverviewSummary(day, today)}</p>
            <p className="mt-3 text-[0.8rem] text-[#8b7258]">{updatedAtLabel ? `最后更新：${updatedAtLabel}` : "最后更新：暂无"}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <CalendarDayViewSummaryPill label="进行中" value={`${day.activeCount}项`} />
            <CalendarDayViewSummaryPill label="草稿" value={`${day.draftCount}项`} />
            <CalendarDayViewSummaryPill label="已完成" value={`${day.savedCount}项`} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cardItems.map((item) => {
          const isFuture = isFutureCalendarDate(day.date, today);
          const summary = item.summary ?? getDimensionFallbackSummary(item.status, isFuture);
          const meta = getInterviewDimensionMeta(item.dimension);
          const primaryActionDisabled = !item.primaryAction.href;

          return (
            <article
              key={`${day.date}-${item.dimension}`}
              data-testid={`calendar-dimension-card-${item.dimension}`}
              className="paper-sheet flex min-h-[15.25rem] flex-col rounded-[30px] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.76rem] tracking-[0.18em] text-[#956d45]">{meta.label}</p>
                  <p className="mt-2 text-balance font-display text-[1.3rem] leading-tight text-[#2b2018]">
                    {item.title ?? `${meta.label}记录`}
                  </p>
                </div>
                <span
                  className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[0.78rem]", getCalendarStatusBadgeClass(item.status))}
                >
                  {calendarDayStatusLabelMap[item.status]}
                </span>
              </div>

              <p className="mt-4 line-clamp-3 text-pretty text-[0.9rem] leading-7 text-[#5f4d3f]">{summary}</p>

              <div className="mt-auto pt-5">
                <CalendarDayViewAction
                  href={item.primaryAction.href}
                  label={item.primaryAction.disabledReason ?? item.primaryAction.label}
                  disabled={primaryActionDisabled}
                />

                {item.secondaryActions.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                    {item.secondaryActions.map((action) => (
                      <CalendarDayViewAction
                        key={action.id}
                        href={action.href}
                        label={action.disabledReason ?? action.label}
                        disabled={!action.href}
                        tone="secondary"
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
