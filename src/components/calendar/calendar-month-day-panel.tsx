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
    <div className="calendar-summary-chip rounded-full px-2.5 py-1">
      <span className="text-[0.64rem] text-[#8a6b4b]">{label}</span>
      <span className="ml-1.5 tabular-nums text-[0.76rem] font-medium text-[#604529]">{value}</span>
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
      className="calendar-card flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] p-4.5 md:p-5"
      data-testid="calendar-month-day-panel"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.72rem] tracking-[0.02em] text-[#8a6b4b]">当天检查</p>
          <h2 className="mt-1.5 text-balance font-display text-[1.52rem] leading-none text-[#312419]">
            {formatCalendarDayLabel(day.date)}
          </h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {day.date === today ? <span aria-hidden="true" className="size-2 rounded-full bg-[#a96f3d]" /> : null}
          {panelState.statusLabel ? (
            <span className={clsx("rounded-full border px-3 py-1.5 text-[0.78rem]", getCalendarStatusBadgeClass(day.overallStatus))}>
              {panelState.statusLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="calendar-card-muted mt-4 rounded-[22px] p-4">
        <p className="text-balance font-display text-[1.08rem] leading-tight text-[#312419]">{panelState.headline}</p>
        <p className="mt-2 line-clamp-2 text-pretty text-[0.86rem] leading-6 text-[#6a5440]">{panelState.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5" data-testid="calendar-month-day-panel-summary">
          <SummaryChip label="进行中" value={`${day.activeCount}项`} />
          <SummaryChip label="草稿" value={`${day.draftCount}项`} />
          <SummaryChip label="已完成" value={`${day.savedCount}项`} />
        </div>
        <p className="mt-3 text-[0.74rem] text-[#8a6b4b]">
          {panelState.updatedAtLabel ? `最后更新：${panelState.updatedAtLabel}` : panelState.isFuture ? "这一天还没有更新。" : "这一天还没有开始。"}
        </p>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.76rem] text-[#8a6b4b]">五维状态</p>
          {!panelState.isFutureEmpty ? <p className="text-[0.74rem] text-[#8a6b4b]">先锁定哪一维值得进当天</p> : null}
        </div>

        {panelState.isFutureEmpty ? (
          <div
            className="calendar-card-muted mt-3 rounded-[22px] px-4 py-4 text-[0.9rem] leading-7 text-[#755d47]"
            data-testid="calendar-month-day-panel-empty"
          >
            {panelState.emptyMessage}
          </div>
        ) : (
          <div className="calendar-pane-scroll panel-scroll mt-3 h-full space-y-2 pr-1" data-testid="calendar-month-day-panel-dimensions">
            {panelState.dimensionItems.map((item) => {
              const visualMeta = getCalendarDimensionVisualMeta(item.dimension);

              return (
                <div
                  key={`${day.date}-${item.dimension}`}
                  data-dimension={item.dimension}
                  className="calendar-card-muted rounded-[18px] px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={clsx("calendar-dimension-badge shrink-0", visualMeta.softBadgeClass)}
                      aria-label={visualMeta.shortLabel}
                      title={visualMeta.shortLabel}
                    >
                      {visualMeta.monthLabel}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-[0.84rem] leading-6 text-[#403024]">{item.preview}</p>
                    </div>
                    <span
                      className={clsx(
                        "shrink-0 rounded-full border px-2.5 py-1 text-[0.72rem]",
                        getCalendarStatusBadgeClass(item.status)
                      )}
                    >
                      {item.statusLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-[rgba(153,119,86,0.2)] pt-3.5">
        <Link
          href={dayViewHref}
          data-action-tone="primary"
          aria-label={buildCalendarActionAccessibleName({
            dateLabel: formatCalendarDayLabel(day.date),
            actionLabel: "查看当天"
          })}
          className="calendar-action-primary inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-[0.88rem] font-medium"
        >
          查看当天
        </Link>
      </div>
    </section>
  );
}
