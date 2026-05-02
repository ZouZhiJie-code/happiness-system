"use client";

import React from "react";
import Link from "next/link";
import clsx from "clsx";

import { buildCalendarDimensionDetailItems } from "@/features/calendar/interview-link";
import {
  calendarDayStatusLabelMap,
  getCalendarDimensionVisualMeta,
  getCalendarStatusBadgeClass
} from "@/features/calendar/presentation";
import type { CalendarDayRecord } from "@/features/calendar/types";
import { formatCalendarDayLabel, formatCalendarUpdatedAt, isFutureCalendarDate } from "@/features/calendar/view-state";

export function CalendarDayDetail({
  day,
  today,
  dayViewHref
}: {
  day: CalendarDayRecord;
  today: string;
  dayViewHref?: string;
}) {
  const detailItems = buildCalendarDimensionDetailItems(day, today);
  const isFuture = isFutureCalendarDate(day.date, today);
  const updatedAtLabel = formatCalendarUpdatedAt(day.latestUpdatedAt);

  return (
    <section className="calendar-card h-full rounded-[28px] p-5 md:p-6" data-testid="calendar-day-detail">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="mt-2 text-balance font-display text-[1.9rem] leading-none text-[#312419]">{formatCalendarDayLabel(day.date)}</h2>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {dayViewHref ? (
            <Link
              href={dayViewHref}
              className="calendar-chip rounded-full px-3.5 py-2 text-[0.82rem] text-[#604529]"
            >
              查看当天
            </Link>
          ) : null}
          <span className={clsx("rounded-full border px-3 py-1.5 text-[0.78rem]", getCalendarStatusBadgeClass(day.overallStatus))}>
            {calendarDayStatusLabelMap[day.overallStatus]}
          </span>
        </div>
      </div>

      <div className="calendar-card-muted mt-5 rounded-[22px] p-4">
        <p className="text-[0.76rem] text-[#8a6b4b]">标题 / 摘要</p>
        <p className="mt-2 text-balance font-display text-[1.24rem] leading-tight text-[#312419]">
          {day.primaryTitle ?? "这一天还没有形成标题。"}
        </p>
        <p className="mt-2 text-pretty text-[0.92rem] leading-7 text-[#6a5440]">
          {day.primarySummary ?? (isFuture ? "未来日期暂不支持开始记录。" : "还没有记录内容，可以先从一个维度开始。")}
        </p>
        <p className="mt-3 text-[0.78rem] text-[#8a6b4b]">
          {updatedAtLabel ? `最后更新：${updatedAtLabel}` : "最后更新：暂无"}
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {detailItems.map((item) => {
          const visualMeta = getCalendarDimensionVisualMeta(item.dimension);

          return (
            <div
              key={`${day.date}-${item.dimension}`}
              data-dimension={item.dimension}
              className="calendar-card-muted rounded-[22px] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={clsx("calendar-dimension-badge", visualMeta.softBadgeClass)}>{visualMeta.shortLabel}</span>
                  <p className="mt-3 font-display text-[1.1rem] leading-none text-[#312419]">
                    {calendarDayStatusLabelMap[item.status]}
                  </p>
                </div>
                <span className={clsx("rounded-full border px-2.5 py-1 text-[0.72rem]", getCalendarStatusBadgeClass(item.status))}>
                  {calendarDayStatusLabelMap[item.status]}
                </span>
              </div>

              {item.title ? <p className="mt-3 text-[0.92rem] font-medium text-[#403024]">{item.title}</p> : null}
              {item.summary ? <p className="mt-1 text-pretty text-[0.88rem] leading-6 text-[#6a5440]">{item.summary}</p> : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {item.actions.map((action) =>
                  action.href ? (
                    <Link
                      key={action.id}
                      href={action.href}
                      className="calendar-action-primary rounded-full px-3.5 py-2 text-[0.82rem]"
                    >
                      {action.dimensionLabel} · {action.label}
                    </Link>
                  ) : (
                    <span
                      key={action.id}
                      className="calendar-action-disabled rounded-full px-3.5 py-2 text-[0.82rem]"
                    >
                      {action.dimensionLabel} · {action.disabledReason ?? action.label}
                    </span>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
