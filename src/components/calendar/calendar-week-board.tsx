"use client";

import React from "react";
import Link from "next/link";
import clsx from "clsx";

import { getInterviewDimensionMeta } from "@/features/interview/dimensions";
import {
  calendarDayStatusLabelMap,
  getCalendarDaySurfaceClass,
  getCalendarDimensionMarkerClass,
  getCalendarStatusBadgeClass
} from "@/features/calendar/presentation";
import type { CalendarDayRecord } from "@/features/calendar/types";
import { formatCalendarUpdatedAt, formatCalendarWeekdayLabel } from "@/features/calendar/view-state";

function buildDimensionText(day: CalendarDayRecord, mode: "completed" | "draft") {
  const matched = day.dimensions.filter((dimension) =>
    mode === "completed" ? dimension.hasSavedEntry : dimension.hasDraftEntry
  );

  if (matched.length === 0) {
    return mode === "completed" ? "无已完成维度" : "无草稿维度";
  }

  return matched.map((dimension) => getInterviewDimensionMeta(dimension.dimension).label).join(" / ");
}

export function CalendarWeekBoard({
  days,
  today
}: {
  days: CalendarDayRecord[];
  today: string;
}) {
  return (
    <div className="space-y-3" data-testid="calendar-week-board">
      {days.map((day) => {
        const updatedAtLabel = formatCalendarUpdatedAt(day.latestUpdatedAt);

        return (
          <Link
            key={day.date}
            href={`/calendar?view=day&date=${day.date}`}
            className={clsx(
              "group block rounded-[28px] border p-4 shadow-[0_16px_28px_rgba(122,83,43,0.08)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(122,83,43,0.12)]",
              getCalendarDaySurfaceClass(day.overallStatus)
            )}
            data-testid={`calendar-week-day-${day.date}`}
            aria-label={`${formatCalendarWeekdayLabel(day.date)}，${calendarDayStatusLabelMap[day.overallStatus]}`}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-[1.35rem] leading-none text-[#2b2018]">
                    {formatCalendarWeekdayLabel(day.date)}
                  </h3>
                  {today === day.date ? (
                    <span className="rounded-full border border-[rgba(143,91,44,0.2)] bg-[rgba(255,249,239,0.82)] px-2 py-1 text-[0.63rem] tracking-[0.18em] text-[#8d6138]">
                      今天
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  {day.dimensions.map((dimension) => (
                    <span
                      key={`${day.date}-${dimension.dimension}`}
                      className={clsx("size-2.5 rounded-full border", getCalendarDimensionMarkerClass(dimension.status))}
                      title={`${getInterviewDimensionMeta(dimension.dimension).label}: ${calendarDayStatusLabelMap[dimension.status]}`}
                    />
                  ))}
                </div>
              </div>

              <span
                className={clsx(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[0.78rem] tabular-nums",
                  getCalendarStatusBadgeClass(day.overallStatus)
                )}
              >
                {calendarDayStatusLabelMap[day.overallStatus]}
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
              <div>
                <p className="text-[0.74rem] tracking-[0.16em] text-[#8f6a46]">已完成维度</p>
                <p className="mt-1 text-pretty text-[0.92rem] leading-6 text-[#4f3d30]">{buildDimensionText(day, "completed")}</p>
              </div>
              <div>
                <p className="text-[0.74rem] tracking-[0.16em] text-[#8f6a46]">草稿维度</p>
                <p className="mt-1 text-pretty text-[0.92rem] leading-6 text-[#4f3d30]">{buildDimensionText(day, "draft")}</p>
              </div>
              <div className="md:text-right">
                <p className="text-[0.74rem] tracking-[0.16em] text-[#8f6a46]">最后更新</p>
                <p className="mt-1 text-[0.92rem] leading-6 text-[#4f3d30]">{updatedAtLabel ?? "暂无"}</p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
