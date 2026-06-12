"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CalendarWeekBoard } from "@/components/calendar/calendar-week-board";
import { useCalendarEntryLoadingNotice } from "@/components/calendar/use-calendar-entry-loading-notice";
import { getCalendarErrorLabel, getCalendarLoadingLabel } from "@/features/calendar/accessibility";
import { fetchCalendarWeekRecord, getCachedCalendarWeekRecord } from "@/features/calendar/calendar-client";
import { buildCalendarWeekStats } from "@/features/calendar/week-stats";
import type { CalendarWeekRecord } from "@/features/calendar/types";
import { buildCalendarWeekOverviewState } from "@/features/calendar/week-view";
import { normalizeCalendarSearchParams } from "@/features/calendar/view-state";
import { getTodayEntryDate } from "@/features/interview/entry-date";

export function CalendarWeekShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = getTodayEntryDate();
  const normalizedSearch = normalizeCalendarSearchParams({
    view: searchParams.get("view"),
    date: searchParams.get("date"),
    today
  });
  const currentDate = normalizedSearch.date;
  const [weekRecord, setWeekRecord] = useState<CalendarWeekRecord | null>(() => getCachedCalendarWeekRecord(currentDate));
  const [isLoading, setIsLoading] = useState(() => !getCachedCalendarWeekRecord(currentDate));
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useCalendarEntryLoadingNotice(isLoading);

  useEffect(() => {
    const currentHref = `/calendar?view=${searchParams.get("view") ?? ""}&date=${searchParams.get("date") ?? ""}`;
    if (currentHref !== normalizedSearch.href) {
      router.replace(normalizedSearch.href, { scroll: false });
    }
  }, [normalizedSearch.href, router, searchParams]);

  useEffect(() => {
    let cancelled = false;
    const force = refreshNonce > 0;
    const cachedRecord = force ? null : getCachedCalendarWeekRecord(currentDate);

    if (cachedRecord) {
      setWeekRecord(cachedRecord);
      setError(null);
      setIsLoading(false);
    } else {
      setIsLoading(true);
      setError(null);
      setWeekRecord(null);
    }

    void fetchCalendarWeekRecord(currentDate, { force })
      .then((record) => {
        if (!cancelled) {
          setWeekRecord(record);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(getCalendarErrorLabel("week"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentDate, refreshNonce]);

  const weekStats = useMemo(() => (weekRecord ? buildCalendarWeekStats(weekRecord) : null), [weekRecord]);
  const weekOverview = useMemo(
    () => (weekRecord && weekStats ? buildCalendarWeekOverviewState(weekRecord, weekStats.summary) : null),
    [weekRecord, weekStats]
  );

  return (
    <section
      className="calendar-workspace calendar-shell rounded-none border-x-0 border-t-0 px-2 py-2 md:px-2.5 md:py-2.5"
      data-testid="calendar-week-workspace"
      aria-busy={isLoading ? "true" : "false"}
    >
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div
          className="flex min-h-0 flex-1 flex-col p-2 md:p-2.5"
          data-testid="calendar-week-primary-pane"
        >
          {error ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6 text-center" role="alert">
              <p className="font-display text-[1.45rem] text-[#312419]">{error}</p>
              <button
                type="button"
                onClick={() => setRefreshNonce((value) => value + 1)}
                className="calendar-chip mt-4 rounded-full px-4 py-2 text-[0.88rem] text-[#604529]"
              >
                重新加载
              </button>
            </div>
          ) : isLoading ? (
            <div className="calendar-pane-scroll panel-scroll min-h-0 flex-1 space-y-3 pr-1">
              <p role="status" aria-live="polite" className="text-[0.84rem] text-[#8a6b4b]">
                {getCalendarLoadingLabel("week")}
              </p>
              <div className="ui-card h-28 animate-pulse" aria-hidden="true" />
              <div className="ui-card h-[20rem] animate-pulse" aria-hidden="true" />
            </div>
          ) : (
            <div className="calendar-pane-scroll panel-scroll min-h-0 flex-1 space-y-3 pr-1">
              <div className="px-1" data-testid="calendar-week-summary">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-[42rem]">
                    <p className="mt-1 text-pretty text-[0.96rem] leading-7 text-[#654f3a]">
                      {weekOverview?.summary ?? "本周还没有记录。"}
                    </p>
                    <p className="mt-1.5 text-[0.84rem] leading-6 text-[#8a6b4b]">{weekOverview?.focusHint ?? "先从今天开始。"}</p>
                  </div>
                  <span className="calendar-summary-chip inline-flex items-baseline gap-2 rounded-full px-4 py-2 text-[0.85rem] text-[#6c553f]">
                    <span className="text-[0.7rem] text-[#8a6b4b]">周范围</span>
                    <span>{weekOverview?.rangeLabel ?? "正在加载"}</span>
                  </span>
                </div>
                <hr className="ui-hairline mt-3" />
              </div>

              {weekStats?.recordedDayCount === 0 ? (
                <p className="px-1 text-[0.9rem] leading-7 text-[var(--text-dim)]">本周还没有记录。</p>
              ) : null}

              <CalendarWeekBoard days={weekRecord?.days ?? []} today={today} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
