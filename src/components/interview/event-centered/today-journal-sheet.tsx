"use client";

import { forwardRef, useCallback, useEffect, useMemo, useState } from "react";

import { ActionButton, Divider } from "@/components/ui";
import {
  fetchEventCalendarDayRecord,
  clearEventCalendarRecordCache
} from "@/features/event-calendar/calendar-client";
import {
  JournalSheet,
  JournalSheetSkeleton
} from "@/components/interview/event-centered/journal-sheet";
import type {
  EventCalendarDayRecord,
  EventCalendarEventRecord
} from "@/types/event-calendar";

function statusLabel(event: EventCalendarEventRecord) {
  if (event.state === "active") return "待继续";
  if (event.state === "generating") return "整理中";
  if (event.state === "draft" || event.state === "modified") return "待保存";
  if (event.state === "saved") return "已保存";
  return "已完成";
}

function actionLabel(event: EventCalendarEventRecord) {
  if (event.state === "active") return "继续记录";
  if (event.state === "generating") return "查看进度";
  if (event.state === "draft" || event.state === "modified") return "继续编辑";
  if (event.state === "saved") return "查看日志";
  return "查看事件";
}

function summaryValue(day: EventCalendarDayRecord, kind: "continue" | "complete" | "daily") {
  if (kind === "continue") {
    return String(day.activeEventCount + day.generatingEventCount + day.pendingSaveEntryCount);
  }
  if (kind === "complete") return String(day.savedEntryCount);
  if (day.dailyJournal.collection === "empty") return "未形成";
  if (day.dailyJournal.collection === "single_entry") return "单篇";
  if (day.dailyJournal.freshness === "stale") return "需更新";
  if (day.dailyJournal.freshness === "saved") return "已保存";
  if (day.dailyJournal.freshness === "modified") return "待保存";
  return "可整理";
}

function TodaySummary({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[0.68rem] text-[var(--text-faint)]">{label}</p>
      <p className="mt-0.5 text-sm font-medium tabular-nums text-ink">{value}</p>
    </div>
  );
}

function EventRow({
  event,
  onOpen
}: {
  event: EventCalendarEventRecord;
  onOpen: (event: EventCalendarEventRecord) => void;
}) {
  const title = event.title?.trim() || `第 ${event.daySequence} 件事`;
  const excerpt = event.displaySummary ?? event.summary;

  return (
    <article className="grid min-w-0 grid-cols-[1.65rem_minmax(0,1fr)] gap-x-3 border-t border-[var(--line-soft)] py-4 first:border-t-0">
      <span className="mt-0.5 flex size-6 items-center justify-center rounded-full bg-[var(--paper-soft)] text-[0.7rem] font-medium tabular-nums text-[var(--text-dim)]">
        {event.daySequence}
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium text-ink">{title}</h3>
            <p className="mt-1 text-[0.7rem] text-[var(--text-faint)]">{statusLabel(event)}</p>
          </div>
          <ActionButton
            type="button"
            variant={event.state === "draft" || event.state === "modified" ? "primary" : "ghost"}
            className="shrink-0"
            onClick={() => onOpen(event)}
          >
            {actionLabel(event)}
          </ActionButton>
        </div>
        {excerpt ? (
          <p className="mt-2 line-clamp-3 break-words text-[0.78rem] leading-6 text-[var(--text-dim)]">
            {excerpt}
          </p>
        ) : (
          <p className="mt-2 text-[0.75rem] leading-5 text-[var(--text-faint)]">
            内容会在这件事形成日志后显示。
          </p>
        )}
      </div>
    </article>
  );
}

export const TodayJournalSheet = forwardRef<HTMLElement, {
  entryDate: string;
  onClose: () => void;
  onSelectEvent: (rootSessionId: string) => void;
  onOpenEventJournal: (input: { rootSessionId: string; entryId: string | null }) => void;
  onOpenDailyJournal: () => void;
  onStartEvent: () => void;
}>(({
  entryDate,
  onClose,
  onSelectEvent,
  onOpenEventJournal,
  onOpenDailyJournal,
  onStartEvent
}, ref) => {
  const [day, setDay] = useState<EventCalendarDayRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDay = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      clearEventCalendarRecordCache();
      setDay(await fetchEventCalendarDayRecord(entryDate, { force: true }));
    } catch {
      setError("今天的事件列表暂时没有加载完成。已有记录仍保留，可以稍后重试。");
    } finally {
      setLoading(false);
    }
  }, [entryDate]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  const sortedEvents = useMemo(
    () => [...(day?.events ?? [])].sort((left, right) => left.daySequence - right.daySequence),
    [day?.events]
  );

  const handleOpenEvent = useCallback((event: EventCalendarEventRecord) => {
    if (
      event.state === "active" ||
      event.state === "generating" ||
      !event.entryId
    ) {
      onSelectEvent(event.rootSessionId);
      return;
    }
    onOpenEventJournal({
      rootSessionId: event.rootSessionId,
      entryId: event.entryId
    });
  }, [onOpenEventJournal, onSelectEvent]);

  const openDailyResult = useCallback(() => {
    if (!day) return;
    if (day.dailyJournal.collection === "single_entry") {
      const directEvent = day.events.find(
        (event) => event.entryId === day.dailyJournal.directEntryId
      );
      if (directEvent) {
        onOpenEventJournal({
          rootSessionId: directEvent.rootSessionId,
          entryId: directEvent.entryId
        });
        return;
      }
    }
    onOpenDailyJournal();
  }, [day, onOpenDailyJournal, onOpenEventJournal]);

  const dailyActionLabel = !day || day.dailyJournal.collection === "empty"
    ? "等待已保存日志"
    : day.dailyJournal.collection === "single_entry"
      ? "查看事件日志"
      : day.dailyJournal.freshness === "stale"
        ? "更新完整日志"
        : day.dailyJournal.entryId
          ? "查看完整日志"
          : "生成完整日志";

  return (
    <JournalSheet
      ref={ref}
      id="event-centered-today-panel"
      ariaLabel="今日日志"
      eyebrow={`今日日志 · ${entryDate}`}
      statusLabel={day ? `${day.events.length} 件事` : undefined}
      onClose={onClose}
      footer={day && day.events.length > 0 ? (
        <ActionButton
          type="button"
          variant="primary"
          className="w-full justify-center"
          disabled={day.dailyJournal.collection === "empty"}
          onClick={openDailyResult}
        >
          {dailyActionLabel}
        </ActionButton>
      ) : undefined}
    >
      {loading ? <JournalSheetSkeleton lineCount={9} label="正在打开今日日志" /> : null}

      {!loading && error ? (
        <div role="alert" className="border-l-2 border-[#b7795d] py-1 pl-3">
          <p className="text-sm font-medium text-ink">暂时无法读取今日日志</p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">{error}</p>
          <ActionButton type="button" variant="secondary" className="mt-3" onClick={() => void loadDay()}>
            重新加载
          </ActionButton>
        </div>
      ) : null}

      {!loading && !error && day ? (
        <>
          <div className="grid grid-cols-3 gap-3 py-1" aria-label="今日日志概况">
            <TodaySummary label="待继续" value={summaryValue(day, "continue")} />
            <TodaySummary label="已完成" value={summaryValue(day, "complete")} />
            <TodaySummary label="完整日志" value={summaryValue(day, "daily")} />
          </div>
          <Divider className="my-4" />

          {sortedEvents.length > 0 ? (
            <div aria-label="当天事件列表">
              {sortedEvents.map((event) => (
                <EventRow key={event.eventId} event={event} onOpen={handleOpenEvent} />
              ))}
            </div>
          ) : (
            <div className="flex min-h-60 flex-col justify-center py-6">
              <p className="font-display text-lg text-ink">今天还没有留下事件</p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">
                从一件此刻最想记住的事开始，表达后它会出现在这里。
              </p>
              <ActionButton
                type="button"
                variant="primary"
                className="mt-4 self-start"
                onClick={onStartEvent}
              >
                记下一件事
              </ActionButton>
            </div>
          )}

          {day.dailyJournal.pendingSave ? (
            <p className="mt-4 border-l-2 border-[var(--paper-deep)] py-1 pl-3 text-xs leading-5 text-[var(--text-dim)]">
              先保存待确认的事件日志，再把当天内容整理到一起。
            </p>
          ) : null}
        </>
      ) : null}
    </JournalSheet>
  );
});

TodayJournalSheet.displayName = "TodayJournalSheet";
