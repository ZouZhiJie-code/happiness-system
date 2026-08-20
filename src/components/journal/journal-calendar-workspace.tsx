"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useCalendarChromeOptional } from "@/components/calendar/calendar-chrome-context";
import { ActionButton, Card, Divider, SectionHeading, Surface, actionButtonClass } from "@/components/ui";
import {
  fetchEventCalendarMonthRecord,
  fetchEventCalendarWeekRecord,
  getCachedEventCalendarMonthRecord,
  getCachedEventCalendarWeekRecord
} from "@/features/event-calendar/calendar-client";
import {
  buildCalendarHref,
  buildCalendarMonthGrid,
  formatCalendarDayLabel,
  formatCalendarWeekdayLabel,
  isFutureCalendarDate
} from "@/features/calendar/view-state";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import type {
  EventCalendarDailyFreshness,
  EventCalendarDayRecord,
  EventCalendarMonthRecord,
  EventCalendarWeekRecord
} from "@/types/event-calendar";

function buildEmptyDay(date: string): EventCalendarDayRecord {
  return {
    date,
    overallStatus: "empty",
    events: [],
    dailyJournal: {
      collection: "empty",
      freshness: "none",
      entryId: null,
      title: null,
      sourceEntryCount: 0,
      pendingSaveEntryIds: [],
      pendingSave: false,
      updateBlockedByPendingSave: false,
      directEntryId: null,
      actions: []
    },
    activeEventCount: 0,
    generatingEventCount: 0,
    pendingSaveEntryCount: 0,
    savedEntryCount: 0,
    primaryAction: null,
    latestUpdatedAt: null
  };
}

function dailyStatusLabel(freshness: EventCalendarDailyFreshness, recordCount: number) {
  if (freshness === "stale") return "需更新";
  if (freshness === "saved") return "已保存";
  if (freshness === "draft" || freshness === "modified") return "草稿";
  return recordCount > 0 ? "未生成" : "空白";
}

function dailyStatusClass(freshness: EventCalendarDailyFreshness) {
  if (freshness === "saved") return "bg-[var(--moss-soft)] text-[var(--text-main)]";
  return "bg-[var(--amber-soft)] text-[var(--text-dim)]";
}

function JournalCalendarLoadState({
  message,
  onRetry
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-72 flex-1 flex-col items-center justify-center px-6 text-center">
      <p role={onRetry ? "alert" : "status"} className="text-sm text-[var(--text-dim)]">{message}</p>
      {onRetry ? (
        <ActionButton type="button" variant="secondary" className="mt-4" onClick={onRetry}>
          重新加载
        </ActionButton>
      ) : null}
    </div>
  );
}

function MonthDayPanel({ day, today }: { day: EventCalendarDayRecord; today: string }) {
  const future = isFutureCalendarDate(day.date, today);
  return (
    <div className="h-full min-h-0 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
      <SectionHeading
        title={formatCalendarDayLabel(day.date)}
        hint={`${day.events.length} 条记录`}
        description={future ? "这一天还没到" : day.events.length > 0 ? "按记录时间排列" : "这一天还没有记录"}
      />

      <Card className="mt-5 p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--text-faint)]">今日日记</p>
            <h3 className="mt-2 text-base font-semibold leading-6 text-[var(--text-main)]">
              {day.dailyJournal.title?.trim() || (day.events.length > 0 ? "等待整理" : "等待记录")}
            </h3>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${dailyStatusClass(day.dailyJournal.freshness)}`}>
            {dailyStatusLabel(day.dailyJournal.freshness, day.events.length)}
          </span>
        </div>

        {day.events.length > 0 ? (
          <div className="mt-4">
            <Divider />
            <ul className="divide-y divide-[var(--line-soft)]">
              {day.events.slice(0, 3).map((record) => (
                <li key={record.eventId} className="py-3 first:pt-4 last:pb-0">
                  <p className="text-sm font-medium text-[var(--text-main)]">
                    {record.title?.trim() || `第 ${record.daySequence} 条记录`}
                  </p>
                  {record.summary ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-dim)]">{record.summary}</p> : null}
                </li>
              ))}
            </ul>
            {day.events.length > 3 ? <p className="mt-3 text-xs text-[var(--text-faint)]">还有 {day.events.length - 3} 条记录</p> : null}
          </div>
        ) : null}

        <Link href={buildCalendarHref({ view: "day", date: day.date })} className={actionButtonClass("primary", "mt-5 w-full")}>
          查看当天
        </Link>
      </Card>
    </div>
  );
}

export function JournalMonthWorkspace({ anchorDate }: { anchorDate: string }) {
  const router = useRouter();
  const calendarChrome = useCalendarChromeOptional();
  const finishCalendarEntryLoading = calendarChrome?.finishCalendarEntryLoading;
  const [selectedDate, setSelectedDate] = useState(anchorDate);
  const month = anchorDate.slice(0, 7);
  const [record, setRecord] = useState<EventCalendarMonthRecord | null>(() =>
    getCachedEventCalendarMonthRecord(anchorDate)
  );
  const [loading, setLoading] = useState(() => !getCachedEventCalendarMonthRecord(anchorDate));
  const [error, setError] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const today = getTodayEntryDate();

  useEffect(() => setSelectedDate(anchorDate), [anchorDate]);

  useEffect(() => {
    let cancelled = false;
    const cached = refreshNonce ? null : getCachedEventCalendarMonthRecord(anchorDate);
    if (cached) {
      setRecord(cached);
      setLoading(false);
      setError(false);
    } else {
      setLoading(true);
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
        if (!cancelled) {
          setLoading(false);
          finishCalendarEntryLoading?.();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [anchorDate, finishCalendarEntryLoading, month, refreshNonce]);

  const cells = useMemo(() => buildCalendarMonthGrid(month), [month]);
  const daysByDate = useMemo(() => new Map((record?.days ?? []).map((day) => [day.date, day])), [record]);
  const selectedDay = daysByDate.get(selectedDate) ?? buildEmptyDay(selectedDate);

  function selectDate(date: string) {
    setSelectedDate(date);
    router.replace(buildCalendarHref({ view: "month", date }), { scroll: false });
  }

  return (
    <Surface
      tone="calendar"
      className="calendar-workspace calendar-shell--month h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0"
      data-testid="journal-month-workspace"
      aria-busy={loading ? "true" : "false"}
    >
      <div className="relative z-10 grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-1 lg:overflow-hidden">
        <section className="min-h-0 px-3 py-4 md:px-5 md:py-5 lg:overflow-y-auto" aria-label="月度记录">
          {error ? (
            <JournalCalendarLoadState message="本月记录暂时没打开。" onRetry={() => setRefreshNonce((value) => value + 1)} />
          ) : loading && !record ? (
            <JournalCalendarLoadState message="正在读取本月记录。" />
          ) : (
            <Card className="overflow-hidden rounded-[var(--radius-card)] p-0">
              <div className="grid grid-cols-7 border-b border-[var(--line-soft)] text-center text-xs text-[var(--text-faint)]">
                {["一", "二", "三", "四", "五", "六", "日"].map((label) => <span key={label} className="py-2">{label}</span>)}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((cell) => {
                  if (!cell.date || cell.dayNumber === null) {
                    return <span key={cell.key} aria-hidden="true" className="min-h-20 border-b border-r border-[var(--line-soft)] md:min-h-24" />;
                  }
                  const day = daysByDate.get(cell.date) ?? buildEmptyDay(cell.date);
                  const selected = cell.date === selectedDate;
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      onClick={() => selectDate(cell.date!)}
                      aria-label={`${cell.date}，${day.events.length} 条记录，今日日记${dailyStatusLabel(day.dailyJournal.freshness, day.events.length)}`}
                      aria-pressed={selected}
                      className={`min-h-20 border-b border-r border-[var(--line-soft)] p-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--paper-deep)] md:min-h-24 ${selected ? "bg-[var(--amber-soft)]" : "bg-transparent hover:bg-[var(--header-surface)]"}`}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-main)]">
                        {cell.dayNumber}
                        {cell.date === today ? <span aria-label="今天" className="size-1.5 rounded-full bg-[var(--paper-deep)]" /> : null}
                      </span>
                      {day.events.length > 0 ? <span className="mt-2 block text-xs text-[var(--text-dim)]">{day.events.length} 条</span> : null}
                      {day.dailyJournal.freshness !== "none" ? (
                        <span className="mt-1 block truncate text-[0.68rem] text-[var(--text-faint)]">日记{dailyStatusLabel(day.dailyJournal.freshness, day.events.length)}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}
        </section>
        <aside className="min-h-0 border-t border-[var(--line-soft)] lg:border-l lg:border-t-0" aria-label="当天记录预览">
          <MonthDayPanel day={selectedDay} today={today} />
        </aside>
      </div>
    </Surface>
  );
}

export function JournalWeekWorkspace({ anchorDate }: { anchorDate: string }) {
  const calendarChrome = useCalendarChromeOptional();
  const finishCalendarEntryLoading = calendarChrome?.finishCalendarEntryLoading;
  const [record, setRecord] = useState<EventCalendarWeekRecord | null>(() =>
    getCachedEventCalendarWeekRecord(anchorDate)
  );
  const [loading, setLoading] = useState(() => !getCachedEventCalendarWeekRecord(anchorDate));
  const [error, setError] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const today = getTodayEntryDate();

  useEffect(() => {
    let cancelled = false;
    const cached = refreshNonce ? null : getCachedEventCalendarWeekRecord(anchorDate);
    if (cached) {
      setRecord(cached);
      setLoading(false);
      setError(false);
    } else {
      setLoading(true);
      setError(false);
    }
    void fetchEventCalendarWeekRecord(anchorDate, { force: refreshNonce > 0 })
      .then((next) => {
        if (!cancelled) setRecord(next);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          finishCalendarEntryLoading?.();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [anchorDate, finishCalendarEntryLoading, refreshNonce]);

  const days = record?.days ?? [];
  const recordedDayCount = days.filter((day) => day.events.length > 0).length;
  const recordCount = days.reduce((total, day) => total + day.events.length, 0);
  const savedDiaryCount = days.filter((day) => day.dailyJournal.freshness === "saved").length;
  const staleDiaryCount = days.filter((day) => day.dailyJournal.freshness === "stale").length;
  const draftDiaryCount = days.filter((day) => day.dailyJournal.freshness === "draft" || day.dailyJournal.freshness === "modified").length;

  return (
    <Surface
      tone="calendar"
      className="calendar-workspace h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0"
      data-testid="journal-week-workspace"
      aria-busy={loading ? "true" : "false"}
    >
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6 lg:px-8 lg:py-7">
        {error ? (
          <JournalCalendarLoadState message="本周记录暂时没打开。" onRetry={() => setRefreshNonce((value) => value + 1)} />
        ) : loading && !record ? (
          <JournalCalendarLoadState message="正在读取本周记录。" />
        ) : (
          <>
            <SectionHeading
              title="本周记录"
              hint={`${recordedDayCount} 天 · ${recordCount} 条`}
              description={`今日日记：已保存 ${savedDiaryCount} 天 · 需更新 ${staleDiaryCount} 天 · 草稿 ${draftDiaryCount} 天`}
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7" data-testid="journal-week-board">
              {days.map((day) => (
                <Card as="article" key={day.date} className="flex min-h-60 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-[var(--text-main)]">
                      {formatCalendarWeekdayLabel(day.date)}
                      {day.date === today ? <span className="sr-only">，今天</span> : null}
                    </h3>
                    <span className={`rounded-full px-2 py-1 text-[0.68rem] ${dailyStatusClass(day.dailyJournal.freshness)}`}>
                      {dailyStatusLabel(day.dailyJournal.freshness, day.events.length)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[var(--text-faint)]">{day.events.length} 条记录</p>
                  <div className="mt-4">
                    <Divider />
                    {day.events.length > 0 ? (
                      <ul className="divide-y divide-[var(--line-soft)]">
                        {day.events.slice(0, 2).map((event) => (
                          <li key={event.eventId} className="py-3 text-sm leading-6 text-[var(--text-dim)] first:pt-4">
                            {event.title?.trim() || `第 ${event.daySequence} 条记录`}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="pt-4 text-sm leading-6 text-[var(--text-dim)]">{isFutureCalendarDate(day.date, today) ? "这一天还没到" : "这一天还没有记录"}</p>
                    )}
                  </div>
                  <Link href={buildCalendarHref({ view: "day", date: day.date })} className={actionButtonClass("secondary", "mt-auto w-full")}>
                    查看当天
                  </Link>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </Surface>
  );
}
