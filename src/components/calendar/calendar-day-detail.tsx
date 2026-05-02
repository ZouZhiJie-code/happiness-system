"use client";

import React from "react";
import Link from "next/link";
import clsx from "clsx";

import { buildCalendarDimensionDetailItems } from "@/features/calendar/interview-link";
import type { CalendarDayRecord, CalendarDayStatus } from "@/features/calendar/types";
import { formatCalendarDayLabel, formatCalendarUpdatedAt, isFutureCalendarDate } from "@/features/calendar/view-state";

const statusLabelMap: Record<CalendarDayStatus, string> = {
  empty: "未记录",
  in_progress: "进行中",
  draft: "有草稿",
  completed: "已完成",
  mixed: "混合状态"
};

function getStatusBadgeClass(status: CalendarDayStatus) {
  switch (status) {
    case "completed":
      return "border-[rgba(130,84,40,0.24)] bg-[rgba(201,160,110,0.28)] text-[#6b4727]";
    case "draft":
      return "border-[rgba(161,109,61,0.22)] bg-[rgba(224,186,138,0.24)] text-[#7a5230]";
    case "in_progress":
      return "border-[rgba(182,128,75,0.22)] bg-[rgba(241,219,183,0.36)] text-[#8a613a]";
    case "mixed":
      return "border-[rgba(145,94,48,0.22)] bg-[rgba(235,205,161,0.36)] text-[#704828]";
    default:
      return "border-[rgba(158,119,81,0.18)] bg-[rgba(255,250,241,0.72)] text-[#8b7057]";
  }
}

export function CalendarDayDetail({
  day,
  today
}: {
  day: CalendarDayRecord;
  today: string;
}) {
  const detailItems = buildCalendarDimensionDetailItems(day, today);
  const isFuture = isFutureCalendarDate(day.date, today);
  const updatedAtLabel = formatCalendarUpdatedAt(day.latestUpdatedAt);

  return (
    <section className="paper-sheet rounded-[32px] p-5 md:p-6" data-testid="calendar-day-detail">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="archive-label">DAY DETAIL</p>
          <h2 className="mt-2 font-display text-[1.9rem] leading-none text-[#2a2017]">{formatCalendarDayLabel(day.date)}</h2>
        </div>
        <span className={clsx("rounded-full border px-3 py-1.5 text-[0.78rem]", getStatusBadgeClass(day.overallStatus))}>
          {statusLabelMap[day.overallStatus]}
        </span>
      </div>

      <div className="mt-5 rounded-[24px] border border-[rgba(172,126,80,0.18)] bg-[rgba(255,249,239,0.78)] p-4">
        <p className="text-[0.76rem] tracking-[0.18em] text-[#9a744d]">标题 / 摘要</p>
        <p className="mt-2 font-display text-[1.24rem] leading-tight text-[#2a2017]">
          {day.primaryTitle ?? "这一天还没有形成标题。"}
        </p>
        <p className="mt-2 text-[0.92rem] leading-7 text-[#5b4b3e]">
          {day.primarySummary ?? (isFuture ? "未来日期暂不支持开始记录。" : "还没有记录内容，可以先从一个维度开始。")}
        </p>
        <p className="mt-3 text-[0.78rem] text-[#8b7258]">
          {updatedAtLabel ? `最后更新：${updatedAtLabel}` : "最后更新：暂无"}
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {detailItems.map((item) => (
          <div
            key={`${day.date}-${item.dimension}`}
            className="rounded-[24px] border border-[rgba(177,132,86,0.16)] bg-[linear-gradient(180deg,rgba(255,250,242,0.92),rgba(244,231,210,0.88))] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.76rem] tracking-[0.18em] text-[#956d45]">{item.dimensionLabel}</p>
                <p className="mt-1 font-display text-[1.1rem] leading-none text-[#2b2018]">{statusLabelMap[item.status]}</p>
              </div>
              <span className={clsx("rounded-full border px-2.5 py-1 text-[0.72rem]", getStatusBadgeClass(item.status))}>
                {statusLabelMap[item.status]}
              </span>
            </div>

            {item.title ? <p className="mt-3 text-[0.92rem] font-medium text-[#3f2f22]">{item.title}</p> : null}
            {item.summary ? <p className="mt-1 text-[0.88rem] leading-6 text-[#625142]">{item.summary}</p> : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {item.actions.map((action) =>
                action.href ? (
                  <Link
                    key={action.id}
                    href={action.href}
                    className="rounded-full border border-[rgba(150,101,55,0.18)] bg-[linear-gradient(180deg,#e7c08e,#d49f65)] px-3.5 py-2 text-[0.82rem] text-[#332417] shadow-[0_10px_22px_rgba(145,94,48,0.12)] transition duration-300 hover:-translate-y-0.5"
                  >
                    {action.dimensionLabel} · {action.label}
                  </Link>
                ) : (
                  <span
                    key={action.id}
                    className="rounded-full border border-dashed border-[rgba(150,101,55,0.18)] bg-[rgba(255,249,239,0.88)] px-3.5 py-2 text-[0.82rem] text-[#8a6d52]"
                  >
                    {action.dimensionLabel} · {action.disabledReason ?? action.label}
                  </span>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
