"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CalendarWeekBoard } from "@/components/calendar/calendar-week-board";
import { getCalendarErrorLabel, getCalendarLoadingLabel } from "@/features/calendar/accessibility";
import { buildCalendarWeekStats } from "@/features/calendar/week-stats";
import type { CalendarWeekRecord } from "@/features/calendar/types";
import { buildCalendarWeekOverviewState } from "@/features/calendar/week-view";
import { normalizeCalendarSearchParams } from "@/features/calendar/view-state";
import { getTodayEntryDate } from "@/features/interview/entry-date";

async function fetchCalendarWeek(date: string) {
  const response = await fetch(`/api/calendar/week?date=${date}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("CALENDAR_WEEK_QUERY_FAILED");
  }

  return (await response.json()) as CalendarWeekRecord;
}

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
  const [weekRecord, setWeekRecord] = useState<CalendarWeekRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    const currentHref = `/calendar?view=${searchParams.get("view") ?? ""}&date=${searchParams.get("date") ?? ""}`;
    if (currentHref !== normalizedSearch.href) {
      router.replace(normalizedSearch.href, { scroll: false });
    }
  }, [normalizedSearch.href, router, searchParams]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchCalendarWeek(currentDate)
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
      className="calendar-workspace calendar-shell rounded-[32px] px-3 py-3 md:px-4 md:py-4"
      data-testid="calendar-week-workspace"
      aria-busy={isLoading ? "true" : "false"}
    >
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div
          className="calendar-pane calendar-panel flex min-h-0 flex-1 flex-col rounded-[28px] p-3 md:p-4"
          data-testid="calendar-week-primary-pane"
        >
          {error ? (
            <div className="calendar-card flex min-h-0 flex-1 flex-col items-center justify-center rounded-[24px] p-6 text-center" role="alert">
              <p className="font-display text-[1.45rem] text-[#17212b]">{error}</p>
              <button
                type="button"
                onClick={() => setRefreshNonce((value) => value + 1)}
                className="calendar-chip mt-4 rounded-full px-4 py-2 text-[0.88rem] text-[#20364a]"
              >
                重新加载
              </button>
            </div>
          ) : isLoading ? (
            <div className="calendar-pane-scroll panel-scroll min-h-0 flex-1 space-y-3 pr-1">
              <p role="status" aria-live="polite" className="text-[0.84rem] text-[#64748b]">
                {getCalendarLoadingLabel("week")}
              </p>
              <div className="calendar-card h-28 animate-pulse rounded-[24px]" aria-hidden="true" />
              <div className="calendar-card h-[20rem] animate-pulse rounded-[24px]" aria-hidden="true" />
            </div>
          ) : (
            <div className="calendar-pane-scroll panel-scroll min-h-0 flex-1 space-y-3 pr-1">
              <div
                className="calendar-card rounded-[24px] px-4 py-4 md:px-5"
                data-testid="calendar-week-summary"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-[42rem]">
                    <p className="mt-2 text-pretty text-[1rem] leading-7 text-[#334155]">
                      {weekOverview?.summary ?? "本周还没有记录。"}
                    </p>
                    <p className="mt-2 text-[0.86rem] leading-6 text-[#64748b]">{weekOverview?.focusHint ?? "先从今天开始。"}</p>
                  </div>
                  <div className="calendar-summary-chip rounded-[20px] px-4 py-3 text-[0.88rem] text-[#475569]">
                    <p className="text-[0.72rem] text-[#64748b]">周范围</p>
                    <p className="mt-1">{weekOverview?.rangeLabel ?? "正在加载"}</p>
                  </div>
                </div>
              </div>

              {weekStats?.recordedDayCount === 0 ? (
                <div className="calendar-card-muted rounded-[22px] px-4 py-3 text-[0.9rem] leading-7 text-[#516174]">
                  本周还没有记录。
                </div>
              ) : null}

              <CalendarWeekBoard days={weekRecord?.days ?? []} today={today} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
