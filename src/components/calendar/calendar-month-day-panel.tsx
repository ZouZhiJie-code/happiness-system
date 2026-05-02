"use client";

import React from "react";
import Link from "next/link";
import clsx from "clsx";

import { buildCalendarActionAccessibleName } from "@/features/calendar/accessibility";
import { buildCalendarMonthPanelState } from "@/features/calendar/month-view";
import { getCalendarDimensionVisualMeta, getCalendarStatusBadgeClass } from "@/features/calendar/presentation";
import type { CalendarDayRecord } from "@/features/calendar/types";
import { formatCalendarDayLabel } from "@/features/calendar/view-state";

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="calendar-summary-chip rounded-full px-3 py-1.5">
      <span className="text-[0.68rem] text-[#8a6b4b]">{label}</span>
      <span className="ml-2 tabular-nums text-[0.8rem] font-medium text-[#604529]">{value}</span>
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
      className="calendar-card flex h-full min-h-0 flex-col rounded-[28px] p-5 md:p-6"
      data-testid="calendar-month-day-panel"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="mt-2 text-balance font-display text-[1.8rem] leading-none text-[#312419]">
            {formatCalendarDayLabel(day.date)}
          </h2>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {day.date === today ? (
            <span className="calendar-chip rounded-full px-3 py-1.5 text-[0.72rem] text-[#604529]">
              今天
            </span>
          ) : null}
          <span className={clsx("rounded-full border px-3 py-1.5 text-[0.78rem]", getCalendarStatusBadgeClass(day.overallStatus))}>
            {panelState.statusLabel}
          </span>
        </div>
      </div>

      <div className="calendar-card-muted mt-5 rounded-[22px] p-4">
        <p className="text-[0.76rem] text-[#8a6b4b]">今天情况</p>
        <p className="mt-2 text-balance font-display text-[1.18rem] leading-tight text-[#312419]">{panelState.headline}</p>
        <p className="mt-2 text-pretty text-[0.92rem] leading-7 text-[#6a5440]">{panelState.description}</p>
        <p className="mt-3 text-[0.78rem] text-[#8a6b4b]">
          {panelState.updatedAtLabel ? `最后更新：${panelState.updatedAtLabel}` : "最后更新：暂无"}
        </p>
      </div>

      <div className="mt-5">
        <p className="text-[0.76rem] text-[#8a6b4b]">记录概况</p>
        <div className="mt-3 flex flex-wrap gap-2" data-testid="calendar-month-day-panel-summary">
          <SummaryChip label="进行中" value={`${day.activeCount}项`} />
          <SummaryChip label="草稿" value={`${day.draftCount}项`} />
          <SummaryChip label="已完成" value={`${day.savedCount}项`} />
        </div>
      </div>

      <div className="mt-5 min-h-0 flex-1">
        <p className="text-[0.76rem] text-[#8a6b4b]">涉及维度</p>
        {panelState.dimensionItems.length > 0 ? (
          <div className="mt-3 space-y-3" data-testid="calendar-month-day-panel-dimensions">
            {panelState.dimensionItems.map((item) => {
              const visualMeta = getCalendarDimensionVisualMeta(item.dimension);

              return (
                <div
                  key={`${day.date}-${item.dimension}`}
                  data-dimension={item.dimension}
                  className="calendar-card-muted rounded-[20px] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-3">
                      <span className={clsx("calendar-dimension-badge", visualMeta.softBadgeClass)}>{visualMeta.shortLabel}</span>
                      <p className="font-display text-[1.04rem] leading-none text-[#312419]">{item.statusLabel}</p>
                    </div>
                    <span className={clsx("rounded-full border px-2.5 py-1 text-[0.72rem]", getCalendarStatusBadgeClass(item.status))}>
                      {item.statusLabel}
                    </span>
                  </div>

                  {item.title ? <p className="mt-3 text-[0.92rem] font-medium text-[#403024]">{item.title}</p> : null}
                  {item.summary ? <p className="mt-1 text-pretty text-[0.88rem] leading-6 text-[#6a5440]">{item.summary}</p> : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="calendar-card-muted mt-3 rounded-[22px] px-4 py-4 text-[0.9rem] leading-7 text-[#755d47]"
            data-testid="calendar-month-day-panel-empty"
          >
            {panelState.isFuture ? "未来日期先保留。" : "还没有记录，先看当天。"}
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-[rgba(153,119,86,0.2)] pt-4">
        <Link
          href={dayViewHref}
          data-action-tone="primary"
          aria-label={buildCalendarActionAccessibleName({
            dateLabel: formatCalendarDayLabel(day.date),
            actionLabel: "查看当天"
          })}
          className="calendar-action-primary inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-[0.92rem] font-medium"
        >
          查看当天
        </Link>
      </div>
    </section>
  );
}
