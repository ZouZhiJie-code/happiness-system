"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Card, Surface } from "@/components/ui";
import type { CalendarDayRecord } from "@/features/calendar/types";
import { getInterviewDimensionMeta, interviewDimensions } from "@/features/interview/dimensions";
import type { InterviewDimension } from "@/types/interview";

const dimensionGuidance: Record<InterviewDimension, string> = {
  joy: "记下今天被点亮、放松或会心一笑的片刻。",
  fulfillment: "留下今天投入、推进和完成过的证据。",
  reflection: "梳理一个让你停下来重新判断的瞬间。",
  improvement: "看看下一次可以轻轻调整哪一步。",
  gratitude: "记住关系里被理解、支持或照顾的时刻。"
};

function getDimensionState(day: CalendarDayRecord | null, dimension: InterviewDimension) {
  const current = day?.dimensions.find((item) => item.dimension === dimension);

  if (current?.hasSavedEntry) return "已完成";
  if (current?.hasDraftEntry) return "待确认";
  if (current?.hasActiveSession) return "可继续";
  return "开始记录";
}

export function InterviewDimensionPicker({
  entryDate,
  showEventCenteredEntry = false
}: {
  entryDate: string;
  showEventCenteredEntry?: boolean;
}) {
  const [day, setDay] = useState<CalendarDayRecord | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetch(`/api/calendar/day?date=${entryDate}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: CalendarDayRecord | null) => {
        if (!cancelled) setDay(payload);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [entryDate]);

  return (
    <Surface className="min-h-0 flex-1 rounded-none border-x-0 border-t-0 px-6 py-10 md:px-10 lg:px-14">
      <div className="mx-auto w-full max-w-6xl">
        <p className="font-mono text-[0.7rem] tracking-[0.22em] text-[var(--text-faint)]">今天想从哪里开始</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl leading-tight text-ink md:text-5xl">
          选一个最贴近此刻的方向
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-base leading-8 text-[var(--text-dim)]">
          每个方向都会从一个具体片段开始。选得大致贴近就可以，进入访谈后仍能随时切换。
        </p>

        {showEventCenteredEntry ? (
          <Link
            href={`/interview?${new URLSearchParams({ mode: "event-centered", entryDate }).toString()}`}
            className="group mt-7 flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--paper-soft)] px-5 py-4 transition hover:border-[var(--line-strong)] hover:bg-[var(--header-surface-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)] sm:flex-row sm:items-center sm:justify-between"
            aria-label="直接开始"
          >
            <span>
              <span className="block font-display text-xl text-ink">直接开始</span>
              <span className="mt-1 block text-sm leading-6 text-[var(--text-dim)]">
                从一件具体的事里，理清当时的判断和依据。
              </span>
            </span>
            <span className="shrink-0 text-xs font-medium tracking-[0.08em] text-ember transition group-hover:text-ink">
              开始复盘 →
            </span>
          </Link>
        ) : null}

        <div className={`${showEventCenteredEntry ? "mt-5" : "mt-8"} grid gap-4 md:grid-cols-2 xl:grid-cols-5`}>
          {interviewDimensions.map((dimension) => {
            const meta = getInterviewDimensionMeta(dimension);
            const state = getDimensionState(day, dimension);
            const params = new URLSearchParams({ dimension, entryDate });

            return (
              <Card
                as={Link}
                interactive
                key={dimension}
                href={`/interview?${params.toString()}`}
                className="group flex min-h-52 flex-col justify-between p-5"
                aria-label={`${meta.navLabel}，${state}`}
              >
                <div>
                  <p className="font-display text-3xl text-ink">{meta.navLabel}</p>
                  <p className="mt-4 text-sm leading-7 text-[var(--text-dim)]">{dimensionGuidance[dimension]}</p>
                </div>
                <p className="mt-6 text-xs font-medium tracking-[0.08em] text-ember transition group-hover:text-ink">
                  {state} →
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </Surface>
  );
}
