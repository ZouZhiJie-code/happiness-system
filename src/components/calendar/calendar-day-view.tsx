"use client";

import React from "react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { buildCalendarActionAccessibleName } from "@/features/calendar/accessibility";
import { buildCalendarCompactCopy, truncateCalendarCopy } from "@/features/calendar/compact-copy";
import { buildCalendarDayViewCardItems } from "@/features/calendar/interview-link";
import { getInterviewDimensionMeta } from "@/features/interview/dimensions";
import {
  calendarDayStatusLabelMap,
  getCalendarDimensionVisualMeta,
  getCalendarStatusBadgeClass
} from "@/features/calendar/presentation";
import type { CalendarDayRecord, CalendarDayStatus } from "@/features/calendar/types";
import { formatCalendarDayLabel, formatCalendarUpdatedAt, isFutureCalendarDate } from "@/features/calendar/view-state";
import { cn } from "@/lib/utils";

function getDimensionFallbackSummary(status: CalendarDayStatus, isFuture: boolean) {
  if (isFuture && status === "empty") {
    return "未来日期先保留。";
  }

  switch (status) {
    case "in_progress":
      return "还在访谈里，先回到这条线。";
    case "draft":
      return "已经有草稿，适合补完。";
    case "completed":
      return "已经成稿，可以直接查看。";
    case "mixed":
      return "这维有多个状态，先走主动作。";
    default:
      return "还没开始，可以从这里进入。";
  }
}

function getDayOverviewSummary(day: CalendarDayRecord, today: string) {
  if (day.primarySummary) {
    return day.primarySummary;
  }

  if (isFutureCalendarDate(day.date, today)) {
    return "先看分布，到了当天再决定。";
  }

  if (day.overallStatus === "empty") {
    return "这一天还空着，先决定从哪一维开始。";
  }

  if (day.overallStatus === "mixed") {
    return "五维状态不同，先锁定最值得继续的那条。";
  }

  return "五维状态已经收在这里。";
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
      "calendar-action-primary inline-flex items-center justify-center rounded-full px-3.5 py-2 text-[0.8rem] whitespace-nowrap",
    tone === "secondary" && "calendar-action-secondary text-[0.78rem]"
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

function buildDailyJournalHref(day: CalendarDayRecord) {
  return `/interview?dimension=joy&entryDate=${day.date}&mode=daily-journal`;
}

function getDailyJournalViewLabel(day: CalendarDayRecord, today: string) {
  return day.date === today ? "查看今日汇总日志" : "查看当日汇总日志";
}

function getSavedDimensionLabels(day: CalendarDayRecord) {
  return day.dimensions
    .filter((dimension) => dimension.hasSavedEntry)
    .map((dimension) => getInterviewDimensionMeta(dimension.dimension).label);
}

function getDailyJournalDescription(day: CalendarDayRecord) {
  switch (day.dailyJournal?.state ?? "none") {
    case "saved":
      return "汇总日志已保存，可以直接查看。";
    case "draft":
      return "汇总日志已有草稿，可以继续编辑。";
    case "stale":
      return "维度日志有更新，可以查看后决定是否重新汇总。";
    default:
      return day.savedCount > 0 ? "已有维度日志，可进入访谈页汇总。" : "还没有可查看的汇总日志。";
  }
}

function buildWriteJournalHref(day: CalendarDayRecord) {
  if (isFutureCalendarDate(day.date)) {
    return null;
  }

  return `/interview?dimension=joy&entryDate=${day.date}`;
}

function DailyJournalPromptDialog({
  open,
  mode,
  date,
  today,
  savedDimensionLabels,
  writeJournalHref,
  dailyJournalHref,
  returnFocusRef,
  onClose
}: {
  open: boolean;
  mode: "empty" | "sources";
  date: string;
  today: string;
  savedDimensionLabels: string[];
  writeJournalHref: string | null;
  dailyJournalHref: string;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    dialogRef.current?.focus({ preventScroll: true });

    function getFocusableElements() {
      const dialog = dialogRef.current;

      if (!dialog) {
        return [];
      }

      return Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute("aria-hidden") && !element.hasAttribute("hidden"));
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements();

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus({ preventScroll: true });
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!event.shiftKey && activeElement === dialogRef.current) {
        event.preventDefault();
        firstElement.focus();
        return;
      }

      if (event.shiftKey && (activeElement === firstElement || activeElement === dialogRef.current)) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus({ preventScroll: true });
    };
  }, [open, returnFocusRef]);

  if (!open) {
    return null;
  }

  const isToday = date === today;
  const title = mode === "empty" ? (isToday ? "今天还没有日志" : "这天还没有日志") : "还没有汇总的日志";
  const description =
    mode === "empty"
      ? "可以先从一个维度写起，保存后再回到这里查看汇总。"
      : `${isToday ? "今日" : "当日"}已有 ${savedDimensionLabels.join("、")} 维度的日志。`;
  const primaryLabel = mode === "empty" ? "写日志" : "汇总日志";
  const primaryHref = mode === "empty" ? writeJournalHref : dailyJournalHref;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(32,24,17,0.42)] px-4 py-6 md:items-center">
      <button type="button" tabIndex={-1} aria-label="取消查看汇总日志" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-journal-prompt-title"
        tabIndex={-1}
        className="relative w-full max-w-md rounded-[var(--radius-shell)] border border-[var(--line-soft)] bg-[#fffaf2] p-5 shadow-xl"
      >
        <p className="text-[0.72rem] text-[#8a6b4b]">汇总当天日志</p>
        <h3 id="daily-journal-prompt-title" className="mt-2 text-balance font-display text-[1.38rem] text-[#312419]">
          {title}
        </h3>
        <p className="mt-3 text-pretty text-sm leading-7 text-[#604529]">{description}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="calendar-chip rounded-full px-4 py-1.5 text-sm text-[#6a5642] transition duration-200"
          >
            取消
          </button>
          {primaryHref ? (
            <Link
              href={primaryHref}
              className="calendar-action-primary inline-flex items-center justify-center rounded-full px-4 py-1.5 text-sm"
            >
              {primaryLabel}
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="calendar-action-disabled inline-flex items-center justify-center rounded-full px-4 py-1.5 text-sm"
            >
              {primaryLabel}
            </span>
          )}
        </div>
      </div>
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
    <div className="flex items-center justify-end">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="calendar-action-secondary text-[0.76rem]"
        aria-expanded={isOpen ? "true" : "false"}
        aria-label={buildCalendarActionAccessibleName({
          ...actionPrefix,
          actionLabel: "更多操作"
        })}
      >
        更多
      </button>

      {isOpen ? (
        <div className="ml-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
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
  const rowItems = buildCalendarDayViewCardItems(day, today);
  const [dailyJournalPromptMode, setDailyJournalPromptMode] = useState<"empty" | "sources" | null>(null);
  const dailyJournalPromptTriggerRef = useRef<HTMLButtonElement | null>(null);
  const updatedAtLabel = formatCalendarUpdatedAt(day.latestUpdatedAt);
  const overviewTitle = day.primaryTitle ? truncateCalendarCopy(day.primaryTitle, 26) : formatCalendarDayLabel(day.date);
  const overviewDateLabel = day.primaryTitle ? formatCalendarDayLabel(day.date) : "当天决策";
  const dailyJournalState = day.dailyJournal?.state ?? "none";
  const dailyJournalHref = buildDailyJournalHref(day);
  const dailyJournalViewLabel = getDailyJournalViewLabel(day, today);
  const savedDimensionLabels = getSavedDimensionLabels(day);
  const writeJournalHref = buildWriteJournalHref(day);
  const shouldLinkDailyJournal = dailyJournalState !== "none";

  return (
    <section className="ui-card overflow-hidden" data-testid="calendar-day-view">
      <div className="px-4 py-4 md:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-[42rem] min-w-0">
            <p className="text-[0.72rem] tracking-[0.02em] text-[#8a6b4b]">{overviewDateLabel}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <h2 className="text-balance font-display text-[1.38rem] leading-none text-[#312419]">{overviewTitle}</h2>
              <span className={cn("rounded-full border px-2.5 py-1 text-[0.74rem]", getCalendarStatusBadgeClass(day.overallStatus))}>
                {calendarDayStatusLabelMap[day.overallStatus]}
              </span>
            </div>
            <p className="mt-2 text-pretty text-[0.86rem] leading-6 text-[#6a5440]">
              {truncateCalendarCopy(getDayOverviewSummary(day, today), 52)}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <CalendarDayViewSummaryPill label="进行中" value={`${day.activeCount}项`} />
            <CalendarDayViewSummaryPill label="草稿" value={`${day.draftCount}项`} />
            <CalendarDayViewSummaryPill label="已完成" value={`${day.savedCount}项`} />
          </div>
        </div>
        <p className="mt-3 text-[0.74rem] text-[#8a6b4b]">{updatedAtLabel ? `最后更新：${updatedAtLabel}` : "最后更新：暂无"}</p>
        <hr className="ui-hairline mt-3.5" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.8rem] font-medium text-[#403024]">汇总当天日志</p>
            <p className="mt-0.5 text-[0.74rem] text-[#6a5440]">{getDailyJournalDescription(day)}</p>
          </div>
          {shouldLinkDailyJournal ? (
            <Link
              href={dailyJournalHref}
              className="calendar-action-primary inline-flex shrink-0 items-center justify-center rounded-full px-3.5 py-2 text-[0.78rem] whitespace-nowrap"
              aria-label={`${formatCalendarDayLabel(day.date)}，${dailyJournalViewLabel}`}
            >
              {dailyJournalViewLabel}
            </Link>
          ) : (
            <button
              ref={dailyJournalPromptTriggerRef}
              type="button"
              onClick={() => setDailyJournalPromptMode(savedDimensionLabels.length > 0 ? "sources" : "empty")}
              className="calendar-action-primary inline-flex shrink-0 items-center justify-center rounded-full px-3.5 py-2 text-[0.78rem] whitespace-nowrap"
              aria-label={`${formatCalendarDayLabel(day.date)}，${dailyJournalViewLabel}`}
            >
              {dailyJournalViewLabel}
            </button>
          )}
        </div>
      </div>

      <hr className="ui-hairline" />
      <div className="divide-y divide-[var(--line-soft)]">
        {rowItems.map((item) => {
          const isFuture = isFutureCalendarDate(day.date, today);
          const summary = buildCalendarCompactCopy(
            [item.summary, item.title],
            getDimensionFallbackSummary(item.status, isFuture),
            52
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
              className="px-4 py-3.5 md:px-5"
            >
              <div className="grid gap-3 xl:grid-cols-[8rem_minmax(0,1fr)_auto] xl:items-center">
                <div className="flex items-center gap-2.5">
                  <span className={cn("calendar-dimension-badge shrink-0", visualMeta.softBadgeClass)}>{visualMeta.monthLabel}</span>
                  <div className="min-w-0">
                    <p className="font-display text-[1rem] leading-none text-[#312419]">{meta.label}</p>
                    <p className="mt-1 text-[0.74rem] text-[#8a6b4b]">{calendarDayStatusLabelMap[item.status]}</p>
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="line-clamp-1 text-[0.9rem] leading-6 text-[#403024]">
                    {truncateCalendarCopy(item.title ?? `${meta.label}记录`, 22)}
                  </p>
                  <p className="mt-1 line-clamp-1 text-[0.8rem] leading-6 text-[#6a5440]">{summary}</p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 xl:flex-nowrap">
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
              </div>
            </article>
          );
        })}
      </div>
      <DailyJournalPromptDialog
        open={dailyJournalPromptMode !== null}
        mode={dailyJournalPromptMode ?? "empty"}
        date={day.date}
        today={today}
        savedDimensionLabels={savedDimensionLabels}
        writeJournalHref={writeJournalHref}
        dailyJournalHref={dailyJournalHref}
        returnFocusRef={dailyJournalPromptTriggerRef}
        onClose={() => setDailyJournalPromptMode(null)}
      />
    </section>
  );
}
