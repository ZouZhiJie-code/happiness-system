"use client";

import React from "react";
import Link from "next/link";
import clsx from "clsx";

import { buildCalendarMonthPanelState } from "@/features/calendar/month-view";
import { getCalendarStatusBadgeClass } from "@/features/calendar/presentation";
import type { CalendarDayRecord } from "@/features/calendar/types";
import { formatCalendarDayLabel } from "@/features/calendar/view-state";

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-[rgba(160,113,68,0.14)] bg-[rgba(255,251,245,0.86)] px-3 py-1.5">
      <span className="text-[0.68rem] text-[#8a6e51]">{label}</span>
      <span className="ml-2 tabular-nums text-[0.8rem] font-medium text-[#3d2d1f]">{value}</span>
    </div>
  );
}

export function CalendarMonthDayPanel({
  day,
  today,
  dayViewHref
}: {
  day: CalendarDayRecord;
  today: string;
  dayViewHref: string;
}) {
  const panelState = buildCalendarMonthPanelState(day, today);

  return (
    <section
      className="paper-sheet flex h-full min-h-0 flex-col rounded-[32px] p-5 md:p-6"
      data-testid="calendar-month-day-panel"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="archive-label">DAY CHECK</p>
          <h2 className="mt-2 text-balance font-display text-[1.85rem] leading-none text-[#2a2017]">
            {formatCalendarDayLabel(day.date)}
          </h2>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {day.date === today ? (
            <span className="rounded-full border border-[rgba(143,91,44,0.18)] bg-[rgba(255,248,239,0.88)] px-3 py-1.5 text-[0.72rem] tracking-[0.16em] text-[#8d6138]">
              今天
            </span>
          ) : null}
          <span className={clsx("rounded-full border px-3 py-1.5 text-[0.78rem]", getCalendarStatusBadgeClass(day.overallStatus))}>
            {panelState.statusLabel}
          </span>
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-[rgba(172,126,80,0.18)] bg-[rgba(255,249,239,0.78)] p-4">
        <p className="text-[0.76rem] tracking-[0.18em] text-[#9a744d]">这一天发生了什么</p>
        <p className="mt-2 text-balance font-display text-[1.24rem] leading-tight text-[#2a2017]">{panelState.headline}</p>
        <p className="mt-2 text-pretty text-[0.92rem] leading-7 text-[#5b4b3e]">{panelState.description}</p>
        <p className="mt-3 text-[0.78rem] text-[#8b7258]">
          {panelState.updatedAtLabel ? `最后更新：${panelState.updatedAtLabel}` : "最后更新：暂无"}
        </p>
      </div>

      <div className="mt-5">
        <p className="text-[0.76rem] tracking-[0.18em] text-[#9a744d]">记录概况</p>
        <div className="mt-3 flex flex-wrap gap-2" data-testid="calendar-month-day-panel-summary">
          <SummaryChip label="进行中" value={`${day.activeCount}项`} />
          <SummaryChip label="草稿" value={`${day.draftCount}项`} />
          <SummaryChip label="已完成" value={`${day.savedCount}项`} />
        </div>
      </div>

      <div className="mt-5 min-h-0 flex-1">
        <p className="text-[0.76rem] tracking-[0.18em] text-[#9a744d]">涉及维度</p>
        {panelState.dimensionItems.length > 0 ? (
          <div className="mt-3 space-y-3" data-testid="calendar-month-day-panel-dimensions">
            {panelState.dimensionItems.map((item) => (
              <div
                key={`${day.date}-${item.dimension}`}
                className="rounded-[22px] border border-[rgba(177,132,86,0.16)] bg-[linear-gradient(180deg,rgba(255,250,242,0.92),rgba(244,231,210,0.88))] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.76rem] tracking-[0.18em] text-[#956d45]">{item.label}</p>
                    <p className="mt-1 font-display text-[1.06rem] leading-none text-[#2b2018]">{item.statusLabel}</p>
                  </div>
                  <span className={clsx("rounded-full border px-2.5 py-1 text-[0.72rem]", getCalendarStatusBadgeClass(item.status))}>
                    {item.statusLabel}
                  </span>
                </div>

                {item.title ? <p className="mt-3 text-[0.92rem] font-medium text-[#3f2f22]">{item.title}</p> : null}
                {item.summary ? <p className="mt-1 text-pretty text-[0.88rem] leading-6 text-[#625142]">{item.summary}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <div
            className="mt-3 rounded-[22px] border border-dashed border-[rgba(168,124,69,0.18)] bg-[rgba(255,250,242,0.72)] px-4 py-4 text-[0.9rem] leading-7 text-[#705742]"
            data-testid="calendar-month-day-panel-empty"
          >
            {panelState.isFuture ? "这一天还没有进入记录阶段。先保留这格，之后再回来。" : "这一天还没有触达任何维度，可以先进入当天页看看从哪一维开始。"}
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-[rgba(172,126,80,0.14)] pt-4">
        <Link
          href={dayViewHref}
          className="inline-flex w-full items-center justify-center rounded-full border border-[rgba(150,101,55,0.18)] bg-[linear-gradient(180deg,#e7c08e,#d49f65)] px-4 py-3 text-[0.92rem] font-medium text-[#332417] shadow-[0_10px_22px_rgba(145,94,48,0.12)] transition duration-300 hover:-translate-y-0.5"
        >
          查看当天
        </Link>
      </div>
    </section>
  );
}
