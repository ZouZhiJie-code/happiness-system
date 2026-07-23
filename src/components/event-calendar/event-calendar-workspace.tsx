"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

import { CalendarDayShell } from "@/components/calendar/calendar-day-shell";
import {
  fetchEventCalendarDayRecord,
  fetchEventCalendarMonthRecord,
  fetchEventCalendarReadRoute,
  fetchEventCalendarWeekRecord,
  getCachedEventCalendarDayRecord,
  getCachedEventCalendarMonthRecord,
  getCachedEventCalendarWeekRecord,
  type EventCalendarReadRoute
} from "@/features/event-calendar/calendar-client";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import {
  buildCalendarHref,
  buildCalendarMonthGrid,
  formatCalendarDayLabel,
  formatCalendarUpdatedAt,
  formatCalendarWeekdayLabel,
  getCalendarMonthKey,
  isFutureCalendarDate,
  type CalendarMode,
  type CalendarMonthGridCell
} from "@/features/calendar/view-state";
import type {
  EventCalendarAction,
  EventCalendarDayRecord,
  EventCalendarEventRecord,
  EventCalendarMonthRecord,
  EventCalendarWeekRecord
} from "@/types/event-calendar";

const weekLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

type EventSurfaceTone = "empty" | "active" | "generating" | "draft" | "saved" | "mixed";

function getEventSurfaceTone(day: EventCalendarDayRecord): EventSurfaceTone {
  if (day.overallStatus === "empty") return "empty";
  if (day.overallStatus === "generating") return "generating";
  if (day.overallStatus === "in_progress") return "active";
  if (day.overallStatus === "draft") return "draft";
  if (day.overallStatus === "mixed") return "mixed";
  return "saved";
}

function getEventSurfaceClass(tone: EventSurfaceTone) {
  switch (tone) {
    case "active":
      return "border-[#e6c99c] bg-[#fff8eb]";
    case "generating":
      return "border-[#d8c2d5] bg-[#fff7fb]";
    case "draft":
      return "border-[#d7beca] bg-[#fff7fb]";
    case "saved":
      return "border-[#cad7c1] bg-[#f8fbf6]";
    case "mixed":
      return "border-[#dec0aa] bg-[#fff8f2]";
    default:
      return "border-[#dfcfbb] bg-[#fdf8f1]";
  }
}

function getEventStatusLabel(day: EventCalendarDayRecord) {
  switch (day.overallStatus) {
    case "in_progress":
      return "进行中";
    case "generating":
      return "整理中";
    case "draft":
      return "待保存";
    case "completed":
      return "已完成";
    case "mixed":
      return "多件记录";
    default:
      return "未记录";
  }
}

function getEventStatusBadgeClass(day: EventCalendarDayRecord) {
  switch (getEventSurfaceTone(day)) {
    case "active":
      return "border-[#e2c188] bg-[#fff3df] text-[#8d5a21]";
    case "generating":
    case "draft":
      return "border-[#d7beca] bg-[#fbf0f5] text-[#7c5568]";
    case "saved":
      return "border-[#bfd0b6] bg-[#edf5ea] text-[#45644a]";
    case "mixed":
      return "border-[#d5b095] bg-[#fbefe5] text-[#8e5638]";
    default:
      return "border-[#dbcab7] bg-[#f7efe4] text-[#7a6857]";
  }
}

function getEventRecordStateLabel(event: EventCalendarEventRecord) {
  switch (event.state) {
    case "active":
      return "继续访谈";
    case "generating":
      return "正在整理";
    case "draft":
      return "继续编辑";
    case "modified":
      return "保存修改";
    case "saved":
      return "查看日志";
    default:
      return "已结束";
  }
}

function buildEventInterviewHref(input: {
  rootSessionId: string;
  entryDate: string;
  panel?: "journal" | "daily-journal";
  eventEntryId?: string | null;
}) {
  const params = new URLSearchParams({
    mode: "event-centered",
    sessionId: input.rootSessionId,
    entryDate: input.entryDate
  });

  if (input.panel) params.set("panel", input.panel);
  if (input.eventEntryId) params.set("eventEntryId", input.eventEntryId);
  return `/interview?${params.toString()}`;
}

function buildEventStartHref(date: string) {
  return `/interview?mode=event-centered&entryDate=${date}`;
}

function buildEventDailyJournalHref(date: string) {
  return `/interview?mode=event-centered&entryDate=${date}&panel=daily-journal`;
}

export function buildEventDailyJournalResultHref(day: EventCalendarDayRecord) {
  const directEvent = day.dailyJournal.collection === "single_entry"
    ? day.events.find((event) => event.entryId === day.dailyJournal.directEntryId)
    : null;
  return directEvent
    ? getEventActionHref(directEvent)
    : buildEventDailyJournalHref(day.date);
}

function getEventActionHref(event: EventCalendarEventRecord) {
  const action = event.actions[0] as EventCalendarAction | undefined;

  if (!action || action === "view_generation_state") {
    return buildEventInterviewHref({
      rootSessionId: event.rootSessionId,
      entryDate: event.entryDate
    });
  }

  if (action === "continue_event" || action === "start_event") {
    return buildEventInterviewHref({
      rootSessionId: event.rootSessionId,
      entryDate: event.entryDate
    });
  }

  return buildEventInterviewHref({
    rootSessionId: event.rootSessionId,
    entryDate: event.entryDate,
    panel: "journal",
    eventEntryId: event.entryId
  });
}

function getEventHeadline(day: EventCalendarDayRecord, today: string) {
  if (day.events.length > 0) {
    const firstTitledEvent = day.events.find((event) => event.title)?.title;
    return firstTitledEvent ?? `${day.events.length} 件事留在这一天。`;
  }

  return isFutureCalendarDate(day.date, today) ? "这一天还没到。" : "这一天还空着。";
}

function getEventDaySummary(day: EventCalendarDayRecord) {
  if (day.events.length === 0) return "还没有事件记录。";

  const labels = [
    day.activeEventCount > 0 ? `${day.activeEventCount} 件待继续` : null,
    day.generatingEventCount > 0 ? `${day.generatingEventCount} 件整理中` : null,
    day.pendingSaveEntryCount > 0 ? `${day.pendingSaveEntryCount} 篇待保存` : null,
    day.savedEntryCount > 0 ? `${day.savedEntryCount} 篇已保存` : null
  ].filter(Boolean);

  return labels.join(" · ") || `${day.events.length} 件事已完成。`;
}

function EventSummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="calendar-summary-chip rounded-full px-2.5 py-1">
      <span className="text-[0.64rem] text-[#8a6b4b]">{label}</span>
      <span className="ml-1.5 tabular-nums text-[0.76rem] font-medium text-[#604529]">{value}</span>
    </span>
  );
}

function EventCalendarRecordLink({ event, compact = false }: { event: EventCalendarEventRecord; compact?: boolean }) {
  const href = getEventActionHref(event);
  const title = event.title?.trim() || `第 ${event.daySequence} 件事`;
  const status = getEventRecordStateLabel(event);

  return (
    <Link
      href={href}
      className={clsx(
        "group flex min-w-0 items-center gap-3 rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[rgba(255,250,242,0.74)] transition duration-200 hover:-translate-y-px hover:border-[#c9a982] hover:bg-[#fffaf2]",
        compact ? "px-2.5 py-2" : "px-3.5 py-3"
      )}
      aria-label={`第 ${event.daySequence} 件事：${title}，${status}`}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f0e2cf] text-[0.72rem] font-medium text-[#755334]">
        {event.daySequence}
      </span>
      <span className="min-w-0 flex-1">
        <span className={clsx("block truncate text-[#403024]", compact ? "text-[0.78rem]" : "text-[0.88rem]")}>{title}</span>
        {!compact && (event.displaySummary ?? event.summary) ? (
          <span className="mt-0.5 block line-clamp-2 text-[0.76rem] leading-5 text-[#765f49]">
            {event.displaySummary ?? event.summary}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-[0.72rem] text-[#8a6b4b] group-hover:text-[#604529]">{status}</span>
    </Link>
  );
}

function EventDailyJournalRow({ day }: { day: EventCalendarDayRecord }) {
  const dailyJournal = day.dailyJournal;

  if (dailyJournal.collection === "empty") return null;

  const label =
    dailyJournal.collection === "single_entry"
      ? "一篇已保存日志"
      : dailyJournal.freshness === "saved"
        ? "当日完整日志"
        : dailyJournal.freshness === "stale"
          ? "完整日志待更新"
          : "整理当天记录";
  const href = buildEventDailyJournalResultHref(day);

  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--line-soft)] pt-3">
      <div className="min-w-0">
        <p className="text-[0.78rem] font-medium text-[#403024]">{label}</p>
        <p className="mt-0.5 text-[0.72rem] text-[#8a6b4b]">已保存事件会按记录顺序保留。</p>
      </div>
      <Link href={href} className="calendar-action-secondary shrink-0 text-[0.76rem]">
        打开
      </Link>
    </div>
  );
}

function EventCalendarMonthGrid({
  cells,
  daysByDate,
  selectedDate,
  today,
  onSelectDate
}: {
  cells: CalendarMonthGridCell[];
  daysByDate: Map<string, EventCalendarDayRecord>;
  selectedDate: string;
  today: string;
  onSelectDate: (date: string) => void;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col gap-1.5 px-4 pb-1 pt-3 md:gap-2 md:px-5 md:pb-1.5 md:pt-4">
      <div className="grid shrink-0 grid-cols-7 px-1">
        {weekLabels.map((label) => (
          <p key={label} className="text-center text-[0.75rem] tracking-[0.01em] text-[#8a6b4b]">{label}</p>
        ))}
      </div>
      <div className="calendar-month-grid-sheet grid min-h-[calc(var(--calendar-month-cell-min-height)*6)] flex-1 grid-cols-7 overflow-hidden rounded-none [grid-auto-rows:minmax(var(--calendar-month-cell-min-height),1fr)]">
        {cells.map((cell) => {
          if (!cell.date || !cell.isCurrentMonth) {
            return <div key={cell.key} className="calendar-month-cell calendar-month-placeholder min-h-[var(--calendar-month-cell-min-height)]" />;
          }

          const day = daysByDate.get(cell.date);
          if (!day) {
            return <div key={cell.key} className="calendar-month-cell calendar-month-placeholder min-h-[var(--calendar-month-cell-min-height)] p-2.5"><span className="font-display text-[1.2rem] leading-none text-[#b59b80]">{cell.dayNumber}</span></div>;
          }

          const isFuture = isFutureCalendarDate(day.date, today);
          const hasRecords = day.events.length > 0;
          const label = hasRecords ? `${day.events.length} 件${day.savedEntryCount > 0 ? "已保存" : "记录"}` : isFuture ? "待到来" : "";

          return (
            <button
              key={cell.key}
              type="button"
              data-testid={`event-calendar-day-${day.date}`}
              data-status={day.overallStatus}
              data-selected={selectedDate === day.date ? "true" : "false"}
              aria-pressed={selectedDate === day.date}
              aria-current={today === day.date ? "date" : undefined}
              aria-label={`${formatCalendarDayLabel(day.date)}，${hasRecords ? `${day.events.length} 件事件` : isFuture ? "未来日期" : "未记录"}`}
              onClick={() => onSelectDate(day.date)}
              className={clsx(
                "calendar-day-button calendar-month-cell group relative flex min-h-[var(--calendar-month-cell-min-height)] flex-col px-2.5 py-2.5 text-left transition duration-200",
                getEventSurfaceClass(getEventSurfaceTone(day)),
                selectedDate === day.date && "ring-1 ring-inset ring-[#b88250]"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={clsx("font-display text-[1.18rem] leading-none text-[#312419]", today === day.date && "text-[#8c6034]")}>{cell.dayNumber}</span>
                {today === day.date ? <span aria-hidden="true" className="mt-1 size-1.5 rounded-full bg-[#a96f3d]" /> : null}
              </div>
              <div className="mt-auto flex min-h-5 items-center gap-1.5 pt-1.5">
                {label ? <span className={clsx("rounded-full px-2 py-1 text-[0.68rem] leading-none", hasRecords ? "bg-[#efe0ca] text-[#6a4728]" : "text-[#9e8974]")}>{label}</span> : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EventCalendarMonthDayPanel({ day, today, dayViewHref }: { day: EventCalendarDayRecord; today: string; dayViewHref: string }) {
  const isFuture = isFutureCalendarDate(day.date, today);
  const updatedAt = formatCalendarUpdatedAt(day.latestUpdatedAt);

  return (
    <section className="calendar-panel calendar-month-day-panel flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 p-0 shadow-none" data-testid="event-calendar-month-day-panel">
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.72rem] tracking-[0.02em] text-[#8a6b4b]">当天事件</p>
            <h2 className="mt-1.5 text-balance font-display text-[1.52rem] leading-none text-[#312419]">{formatCalendarDayLabel(day.date)}</h2>
          </div>
          <span className={clsx("shrink-0 rounded-full border px-3 py-1.5 text-[0.78rem]", getEventStatusBadgeClass(day))}>{getEventStatusLabel(day)}</span>
        </div>
      </div>
      <div className="border-y border-[rgba(153,119,86,0.16)] px-5 py-4">
        <div className="calendar-card-muted rounded-[18px] p-4">
          <p className="text-balance font-display text-[1.08rem] leading-tight text-[#312419]">{getEventHeadline(day, today)}</p>
          <p className="mt-2 text-pretty text-[0.86rem] leading-6 text-[#6a5440]">{getEventDaySummary(day)}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <EventSummaryChip label="事件" value={`${day.events.length} 件`} />
            <EventSummaryChip label="待继续" value={`${day.activeEventCount} 件`} />
            <EventSummaryChip label="已保存" value={`${day.savedEntryCount} 篇`} />
          </div>
          <p className="mt-3 text-[0.74rem] text-[#8a6b4b]">{updatedAt ? `最后更新：${updatedAt}` : isFuture ? "这一天还没有更新。" : "这一天还没有开始。"}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
        <p className="text-[0.76rem] text-[#8a6b4b]">按记录顺序</p>
        {day.events.length > 0 ? (
          <div className="calendar-pane-scroll panel-scroll mt-3 h-full space-y-2 pr-1" data-testid="event-calendar-month-day-events">
            {day.events.map((event) => <EventCalendarRecordLink key={event.eventId} event={event} />)}
            <EventDailyJournalRow day={day} />
          </div>
        ) : (
          <div className="calendar-card-muted mt-3 rounded-[18px] px-4 py-4 text-[0.9rem] leading-7 text-[#755d47]">
            {isFuture ? "未来日期先保留。" : "从一件事开始，之后会按顺序留在这里。"}
          </div>
        )}
      </div>
      <div className="border-t border-[rgba(153,119,86,0.2)] px-5 pb-3 pt-3">
        {day.events.length > 0 ? (
          <Link href={dayViewHref} className="calendar-action-primary inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-[0.88rem] font-medium">查看当天</Link>
        ) : isFuture ? (
          <span aria-disabled="true" className="calendar-action-disabled inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-[0.88rem]">未来日期暂不开始记录</span>
        ) : (
          <Link href={buildEventStartHref(day.date)} className="calendar-action-primary inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-[0.88rem] font-medium">从一件事开始</Link>
        )}
      </div>
    </section>
  );
}

function EventCalendarLoadState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="flex min-h-[18rem] flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-[1.35rem] text-[#312419]">{message}</p>
      {retry ? <button type="button" onClick={retry} className="calendar-chip mt-4 rounded-full px-4 py-2 text-[0.88rem] text-[#604529]">重新加载</button> : null}
    </div>
  );
}

export function EventCalendarMonthShell({ anchorDate }: { anchorDate: string }) {
  const router = useRouter();
  const today = getTodayEntryDate();
  const [selectedDate, setSelectedDate] = useState(anchorDate);
  const [month, setMonth] = useState(anchorDate.slice(0, 7));
  const [record, setRecord] = useState<EventCalendarMonthRecord | null>(() => getCachedEventCalendarMonthRecord(anchorDate));
  const [isLoading, setIsLoading] = useState(() => !getCachedEventCalendarMonthRecord(anchorDate));
  const [error, setError] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    setSelectedDate(anchorDate);
    setMonth(anchorDate.slice(0, 7));
  }, [anchorDate]);

  useEffect(() => {
    let cancelled = false;
    const cached = refreshNonce ? null : getCachedEventCalendarMonthRecord(`${month}-01`);
    if (cached) {
      setRecord(cached);
      setIsLoading(false);
      setError(false);
    } else {
      setIsLoading(true);
      setError(false);
    }

    void fetchEventCalendarMonthRecord(month, { force: refreshNonce > 0 })
      .then((next) => {
        if (!cancelled) setRecord(next);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [month, refreshNonce]);

  const monthGrid = useMemo(() => buildCalendarMonthGrid(month), [month]);
  const daysByDate = useMemo(() => new Map((record?.days ?? []).map((day) => [day.date, day])), [record]);
  const selectedDay = daysByDate.get(selectedDate) ?? {
    date: selectedDate,
    overallStatus: "empty" as const,
    events: [],
    dailyJournal: { collection: "empty" as const, freshness: "none" as const, entryId: null, title: null, sourceEntryCount: 0, pendingSaveEntryIds: [], pendingSave: false, updateBlockedByPendingSave: false, directEntryId: null, actions: [] },
    activeEventCount: 0,
    generatingEventCount: 0,
    pendingSaveEntryCount: 0,
    savedEntryCount: 0,
    primaryAction: null,
    latestUpdatedAt: null
  } satisfies EventCalendarDayRecord;

  function selectDate(date: string) {
    setSelectedDate(date);
    const nextMonth = getCalendarMonthKey(date);
    if (nextMonth !== month) setMonth(nextMonth);
    router.replace(buildCalendarHref({ view: "month", date, calendarMode: "event_centered" }), { scroll: false });
  }

  return (
    <section className="calendar-workspace calendar-shell calendar-shell--month h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 [--calendar-month-cell-min-height:4.35rem] sm:[--calendar-month-cell-min-height:5rem] lg:[--calendar-month-cell-min-height:5.95rem]" data-testid="event-calendar-month-workspace" aria-busy={isLoading ? "true" : "false"}>
      <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col">
        <div className="min-h-0 h-full flex-1 overflow-x-hidden overflow-y-auto lg:overflow-hidden">
          <div className="grid min-h-0 h-full grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-1 xl:grid-cols-[minmax(0,1fr)_25.5rem]">
            <div className="calendar-pane calendar-panel calendar-month-primary-pane flex min-h-0 flex-col rounded-none p-0">
              {error ? <EventCalendarLoadState message="本月事件暂时没打开。" retry={() => setRefreshNonce((value) => value + 1)} /> : isLoading ? <EventCalendarLoadState message="正在读取本月事件。" /> : <div className="calendar-pane-scroll panel-scroll flex min-h-0 flex-1 flex-col"><EventCalendarMonthGrid cells={monthGrid} daysByDate={daysByDate} selectedDate={selectedDate} today={today} onSelectDate={selectDate} /></div>}
            </div>
            <aside className="calendar-pane calendar-month-secondary-pane min-h-0 lg:h-full">
              {error ? <EventCalendarLoadState message="当天事件暂时不可用。" retry={() => setRefreshNonce((value) => value + 1)} /> : isLoading ? <EventCalendarLoadState message="正在准备当天事件。" /> : <EventCalendarMonthDayPanel day={selectedDay} today={today} dayViewHref={buildCalendarHref({ view: "day", date: selectedDay.date, calendarMode: "event_centered" })} />}
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}

function EventCalendarWeekBoard({ days, today }: { days: EventCalendarDayRecord[]; today: string }) {
  return (
    <div className="overflow-x-auto overflow-y-hidden pb-1">
      <div className="grid min-w-[980px] grid-cols-7 gap-2.5" data-testid="event-calendar-week-board">
        {days.map((day) => {
          const firstEvents = day.events.slice(0, 2);
          const href = day.events[0] ? getEventActionHref(day.events[0]) : buildCalendarHref({ view: "day", date: day.date, calendarMode: "event_centered" });
          return (
            <article key={day.date} data-testid={`event-calendar-week-day-${day.date}`} className={clsx("ui-card flex min-h-[13.75rem] flex-col p-3.5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md", getEventSurfaceClass(getEventSurfaceTone(day)))}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2"><h3 className={clsx("font-display text-[1.12rem] leading-none text-[#312419]", today === day.date && "text-[#8c6034]")}>{formatCalendarWeekdayLabel(day.date)}</h3>{today === day.date ? <span aria-hidden="true" className="size-2 rounded-full bg-[#a96f3d]" /> : null}</div>
                <span className={clsx("rounded-full border px-2.5 py-1 text-[0.75rem]", getEventStatusBadgeClass(day))}>{getEventStatusLabel(day)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5"><EventSummaryChip label="事件" value={`${day.events.length} 件`} /><EventSummaryChip label="已保存" value={`${day.savedEntryCount} 篇`} /></div>
              <div className="mt-3 min-h-[4rem] space-y-1.5">
                {firstEvents.map((event) => <EventCalendarRecordLink key={event.eventId} event={event} compact />)}
                {day.events.length > firstEvents.length ? <p className="text-[0.74rem] text-[#8a6b4b]">还有 {day.events.length - firstEvents.length} 件事</p> : null}
                {day.events.length === 0 ? <p className="text-[0.8rem] leading-6 text-[#6a5440]">{isFutureCalendarDate(day.date, today) ? "未来日期先保留。" : "这一天还空着。"}</p> : null}
              </div>
              <div className="mt-auto pt-3"><Link href={href} className="calendar-action-primary inline-flex w-full items-center justify-center rounded-full px-3 py-2 text-[0.78rem] font-medium">{day.events[0] ? getEventRecordStateLabel(day.events[0]) : "查看当天"}</Link></div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function EventCalendarWeekShell({ anchorDate }: { anchorDate: string }) {
  const today = getTodayEntryDate();
  const [record, setRecord] = useState<EventCalendarWeekRecord | null>(() => getCachedEventCalendarWeekRecord(anchorDate));
  const [isLoading, setIsLoading] = useState(() => !getCachedEventCalendarWeekRecord(anchorDate));
  const [error, setError] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const cached = refreshNonce ? null : getCachedEventCalendarWeekRecord(anchorDate);
    if (cached) {
      setRecord(cached);
      setIsLoading(false);
      setError(false);
    } else {
      setIsLoading(true);
      setError(false);
    }
    void fetchEventCalendarWeekRecord(anchorDate, { force: refreshNonce > 0 })
      .then((next) => { if (!cancelled) setRecord(next); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [anchorDate, refreshNonce]);

  const recordedDays = (record?.days ?? []).filter((day) => day.events.length > 0).length;
  const eventCount = (record?.days ?? []).reduce((total, day) => total + day.events.length, 0) ?? 0;
  return (
    <section className="calendar-workspace calendar-shell rounded-none border-x-0 border-t-0 px-2 py-2 md:px-2.5 md:py-2.5" data-testid="event-calendar-week-workspace" aria-busy={isLoading ? "true" : "false"}>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col"><div className="calendar-pane-scroll panel-scroll min-h-0 flex-1 space-y-3 p-2 md:p-2.5">
        {error ? <EventCalendarLoadState message="本周事件暂时没打开。" retry={() => setRefreshNonce((value) => value + 1)} /> : isLoading ? <EventCalendarLoadState message="正在读取本周事件。" /> : <>
          <div className="px-1" data-testid="event-calendar-week-summary"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-pretty text-[0.96rem] leading-7 text-[#654f3a]">本周有 {recordedDays} 天留下事件，共 {eventCount} 件。</p><p className="mt-1.5 text-[0.84rem] leading-6 text-[#8a6b4b]">事件会按当天记录顺序展开。</p></div><span className="calendar-summary-chip rounded-full px-4 py-2 text-[0.85rem] text-[#6c553f]">{record?.weekStartDate} 到 {record?.weekEndDate}</span></div><hr className="ui-hairline mt-3" /></div>
          <EventCalendarWeekBoard days={record?.days ?? []} today={today} />
        </>}
      </div></div>
    </section>
  );
}

export function EventCalendarDayShell({ date }: { date: string }) {
  const today = getTodayEntryDate();
  const [record, setRecord] = useState<EventCalendarDayRecord | null>(() => getCachedEventCalendarDayRecord(date));
  const [isLoading, setIsLoading] = useState(() => !getCachedEventCalendarDayRecord(date));
  const [error, setError] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const cached = refreshNonce ? null : getCachedEventCalendarDayRecord(date);
    if (cached) {
      setRecord(cached);
      setIsLoading(false);
      setError(false);
    } else {
      setIsLoading(true);
      setError(false);
    }
    void fetchEventCalendarDayRecord(date, { force: refreshNonce > 0 })
      .then((next) => { if (!cancelled) setRecord(next); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [date, refreshNonce]);

  return (
    <section className="calendar-workspace calendar-shell rounded-none border-x-0 border-t-0 px-2 py-2 md:px-2.5 md:py-2.5" data-testid="event-calendar-day-workspace" aria-busy={isLoading ? "true" : "false"}>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col"><div className="calendar-pane-scroll panel-scroll min-h-0 h-full p-2 md:p-2.5">
        {error ? <EventCalendarLoadState message="当天事件暂时没打开。" retry={() => setRefreshNonce((value) => value + 1)} /> : isLoading || !record ? <EventCalendarLoadState message="正在读取当天事件。" /> : <EventCalendarDayContent day={record} today={today} />}
      </div></div>
    </section>
  );
}

function EventCalendarDayContent({ day, today }: { day: EventCalendarDayRecord; today: string }) {
  const isFuture = isFutureCalendarDate(day.date, today);
  return (
    <section className="calendar-panel overflow-hidden rounded-[var(--radius-card)] p-0 shadow-none" data-testid="event-calendar-day-content">
      <div className="px-4 py-4 md:px-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[0.72rem] tracking-[0.02em] text-[#8a6b4b]">事件记录</p><h2 className="mt-1.5 font-display text-[1.48rem] leading-none text-[#312419]">{formatCalendarDayLabel(day.date)}</h2><p className="mt-2 text-[0.84rem] leading-6 text-[#654f3a]">{getEventDaySummary(day)}</p></div><span className={clsx("rounded-full border px-3 py-1.5 text-[0.78rem]", getEventStatusBadgeClass(day))}>{getEventStatusLabel(day)}</span></div><div className="mt-3 flex flex-wrap gap-1.5"><EventSummaryChip label="事件" value={`${day.events.length} 件`} /><EventSummaryChip label="待继续" value={`${day.activeEventCount} 件`} /><EventSummaryChip label="待保存" value={`${day.pendingSaveEntryCount} 篇`} /><EventSummaryChip label="已保存" value={`${day.savedEntryCount} 篇`} /></div></div>
      <hr className="ui-hairline" />
      <div className="divide-y divide-[var(--line-soft)]">
        {day.events.length > 0 ? day.events.map((event) => <div key={event.eventId} className="px-4 py-3.5 md:px-5"><EventCalendarRecordLink event={event} /></div>) : <div className="px-4 py-7 text-center text-[0.9rem] leading-7 text-[#755d47]">{isFuture ? "未来日期先保留。" : "这一天还没有事件记录。"}</div>}
      </div>
      {day.events.length > 0 ? <div className="px-4 pb-4 md:px-5"><EventDailyJournalRow day={day} /></div> : null}
      <div className="border-t border-[var(--line-soft)] px-4 py-3 md:px-5">{day.events.length === 0 && !isFuture ? <Link href={buildEventStartHref(day.date)} className="calendar-action-primary inline-flex items-center justify-center rounded-full px-4 py-2 text-[0.82rem]">从一件事开始</Link> : <Link href={buildCalendarHref({ view: "month", date: day.date, calendarMode: "event_centered" })} className="calendar-action-secondary text-[0.8rem]">回到月历</Link>}</div>
    </section>
  );
}

function CalendarDualDayShell({ date }: { date: string }) {
  const eventHref = buildCalendarHref({ view: "day", date, calendarMode: "event_centered", readTarget: "event_centered" });
  const legacyHref = buildCalendarHref({ view: "day", date, calendarMode: "legacy", readTarget: "legacy" });
  return (
    <section className="calendar-workspace calendar-shell rounded-none border-x-0 border-t-0 px-2 py-2 md:px-2.5 md:py-2.5" data-testid="calendar-dual-day-workspace">
      <div className="flex min-h-0 flex-1 items-center justify-center p-3"><section className="calendar-panel w-full max-w-3xl rounded-[var(--radius-card)] p-5 md:p-6"><p className="text-[0.74rem] tracking-[0.02em] text-[#8a6b4b]">历史记录</p><h2 className="mt-2 font-display text-[1.55rem] leading-none text-[#312419]">这一天有两类记录</h2><p className="mt-3 max-w-xl text-[0.9rem] leading-7 text-[#654f3a]">事件记录和历史五维记录分别保留各自的阅读方式。请选择要查看的一类。</p><div className="mt-6 grid gap-3 md:grid-cols-2"><Link href={eventHref} className="ui-card block border-[#dec4a3] bg-[#fff8ed] p-4 transition hover:-translate-y-0.5 hover:shadow-md"><p className="text-[0.74rem] text-[#8a6b4b]">事件记录</p><p className="mt-2 font-display text-[1.12rem] text-[#312419]">按事件顺序查看</p><p className="mt-2 text-[0.8rem] leading-6 text-[#755d47]">打开当日的事件、事件日志与完整日志入口。</p></Link><Link href={legacyHref} className="ui-card block border-[#d8d0c3] bg-[#fdfaf5] p-4 transition hover:-translate-y-0.5 hover:shadow-md"><p className="text-[0.74rem] text-[#8a6b4b]">历史五维记录</p><p className="mt-2 font-display text-[1.12rem] text-[#312419]">沿用原有阅读方式</p><p className="mt-2 text-[0.8rem] leading-6 text-[#755d47]">打开当日的五维状态与原有日志入口。</p></Link></div></section></div>
    </section>
  );
}

function CalendarReadRouteLoading() {
  return <section className="calendar-workspace calendar-shell flex min-h-0 flex-1 items-center justify-center rounded-none border-x-0 border-t-0"><p className="text-[0.88rem] text-[#8a6b4b]">正在定位当天记录。</p></section>;
}

export function CalendarDayReadRouteShell({ date, readTarget }: { date: string; readTarget: CalendarMode | null }) {
  const [route, setRoute] = useState<EventCalendarReadRoute | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRoute(null);
    setError(false);
    void fetchEventCalendarReadRoute(date)
      .then((result) => { if (!cancelled) setRoute(result.route); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [date]);

  if (error) {
    return <section className="calendar-workspace calendar-shell flex min-h-0 flex-1 items-center justify-center rounded-none border-x-0 border-t-0"><p className="text-[0.88rem] text-[#8a6b4b]">当天记录暂时无法定位，请稍后重试。</p></section>;
  }

  if (!route) return <CalendarReadRouteLoading />;
  if (route === "event_centered") return <EventCalendarDayShell key={`event-${date}`} date={date} />;
  if (route === "legacy" || route === "empty") return <CalendarDayShell key={`legacy-${date}`} />;

  if (readTarget === "event_centered") return <EventCalendarDayShell key={`dual-event-${date}`} date={date} />;
  if (readTarget === "legacy") return <CalendarDayShell key={`dual-legacy-${date}`} />;
  return <CalendarDualDayShell date={date} />;
}
