"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { AnalysisDailyCoverageDay, AnalysisMonthRecord } from "@/features/analysis/types";
import { buildAnalysisHref } from "@/features/analysis/view-state";
import { getCalendarDimensionVisualMeta } from "@/features/calendar/presentation";
import { buildCalendarHref, buildCalendarMonthGrid } from "@/features/calendar/view-state";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import { getInterviewDimensionMeta } from "@/features/interview/dimensions";
import { Card, Divider } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  ANALYSIS_CHIP_CLASS,
  ActionLink,
  buildDailyJournalHref,
  buildInterviewHref,
  buildRhythmNarrative,
  findCoverageDay,
  formatAnalysisDateLabel,
  formatScoreAverage,
  formatSpanLabel
} from "./analysis-shared";

type RhythmDayState = "future" | "empty" | "score_only" | "log_only" | "stale" | "complete";

const rhythmWeekdays = ["一", "二", "三", "四", "五", "六", "日"] as const;

function getRhythmDayState(day: AnalysisDailyCoverageDay | null, todayEntryDate = getTodayEntryDate()): RhythmDayState {
  if (!day) {
    return "empty";
  }

  if (day.date > todayEntryDate) {
    return "future";
  }

  if (day.hasStaleDailyJournal) {
    return "stale";
  }

  if (day.hasDailyJournalSaved) {
    return "complete";
  }

  if (day.savedDimensionCount > 0) {
    return "log_only";
  }

  if (day.hasScore) {
    return "score_only";
  }

  return "empty";
}

function getRhythmPriorityDate(record: AnalysisMonthRecord, todayEntryDate = getTodayEntryDate()) {
  return (
    record.rhythmOverview.latestPendingDailyJournalDate ??
    record.rhythmOverview.latestScoreOnlyDate ??
    record.rhythmOverview.latestActiveDate ??
    (record.month === todayEntryDate.slice(0, 7) ? todayEntryDate : record.dailyCoverage.at(-1)?.date) ??
    `${record.month}-01`
  );
}

function getRhythmDensityLabel(day: AnalysisDailyCoverageDay | null, state: RhythmDayState) {
  if (!day) {
    return "空白";
  }

  if (state === "future") {
    return "待到来";
  }

  if (state === "score_only") {
    return typeof day.averageScore === "number" ? `${day.averageScore.toFixed(1)}分` : "已评分";
  }

  if (state === "empty") {
    return "空白";
  }

  if (day.savedDimensionCount >= 3) {
    return "3维+";
  }

  if (day.savedDimensionCount > 0) {
    return `${day.savedDimensionCount}维`;
  }

  return "暂无";
}

function getRhythmStatusLabel(state: RhythmDayState) {
  if (state === "future") return "未来";
  if (state === "score_only") return "只评未记";
  if (state === "log_only") return "待整合";
  if (state === "stale") return "待更新";
  if (state === "complete") return "已整合";
  return "空白";
}

/**
 * 热力日格的状态色阶：绿（已整合）/ 紫（待更新）/ 暖棕（待整合）/ 浅绿（只评分）。
 * 这组语义状态色与维度色一样属于既有视觉 token，集中在此处维护。
 */
function getRhythmSurfaceClass(state: RhythmDayState, density: number) {
  if (state === "future") {
    return "border-dashed border-[rgba(140,117,92,0.16)] bg-[rgba(255,252,246,0.54)]";
  }

  if (state === "score_only") {
    return "border-[rgba(88,120,88,0.18)] bg-[rgba(238,245,236,0.92)]";
  }

  if (state === "stale") {
    return density >= 3
      ? "border-[rgba(124,85,104,0.22)] bg-[rgba(226,210,221,0.94)]"
      : density === 2
        ? "border-[rgba(124,85,104,0.18)] bg-[rgba(239,227,236,0.94)]"
        : "border-[rgba(124,85,104,0.16)] bg-[rgba(247,240,245,0.96)]";
  }

  if (state === "complete") {
    return density >= 3
      ? "border-[rgba(69,100,74,0.22)] bg-[rgba(193,214,196,0.92)]"
      : density === 2
        ? "border-[rgba(69,100,74,0.18)] bg-[rgba(220,234,221,0.92)]"
        : "border-[rgba(69,100,74,0.16)] bg-[rgba(237,244,237,0.94)]";
  }

  if (state === "log_only") {
    return density >= 3
      ? "border-[rgba(111,74,38,0.22)] bg-[rgba(206,168,120,0.92)]"
      : density === 2
        ? "border-[rgba(111,74,38,0.18)] bg-[rgba(231,207,174,0.9)]"
        : "border-[rgba(111,74,38,0.16)] bg-[rgba(246,231,208,0.94)]";
  }

  return "border-[var(--line-soft)] bg-paper/85";
}

function getRhythmStateBadgeClass(state: RhythmDayState) {
  return state === "complete"
    ? "bg-[rgba(69,100,74,0.12)] text-[#45644a]"
    : state === "stale"
      ? "bg-[rgba(124,85,104,0.12)] text-[#7c5568]"
      : state === "log_only"
        ? "bg-[rgba(111,74,38,0.1)] text-[#7b532d]"
        : state === "score_only"
          ? "bg-[rgba(88,120,88,0.12)] text-[#567256]"
          : state === "future"
            ? "bg-[rgba(122,104,87,0.1)] text-[#7a6857]"
            : "bg-[rgba(150,105,61,0.08)] text-[#8b6c4d]";
}

export function CoverageHeatmap({ record }: { record: AnalysisMonthRecord }) {
  const todayEntryDate = getTodayEntryDate();
  const daysByDate = useMemo(() => new Map(record.dailyCoverage.map((day) => [day.date, day])), [record.dailyCoverage]);
  const cells = buildCalendarMonthGrid(record.month);
  const isFutureMonth = record.month > todayEntryDate.slice(0, 7);
  const latestPendingDay = findCoverageDay(record, record.rhythmOverview.latestPendingDailyJournalDate);
  const latestScoreOnlyDay = findCoverageDay(record, record.rhythmOverview.latestScoreOnlyDate);
  const [selectedDate, setSelectedDate] = useState<string>(getRhythmPriorityDate(record, todayEntryDate));

  useEffect(() => {
    const fallbackDate = getRhythmPriorityDate(record, todayEntryDate);

    setSelectedDate((current) => (current && daysByDate.has(current) ? current : fallbackDate));
  }, [daysByDate, record, todayEntryDate]);

  const selectedCoverage = daysByDate.get(selectedDate) ?? null;
  const selectedDimensions = selectedCoverage?.savedDimensions ?? [];
  const selectedState = getRhythmDayState(selectedCoverage, todayEntryDate);
  const selectedAverageScore = selectedCoverage?.averageScore ?? null;
  const rhythmSummaryItems = [
    {
      label: "最长连续",
      value: record.rhythmOverview.longestStreak ? `${record.rhythmOverview.longestStreak.length} 天` : "暂无",
      detail: record.rhythmOverview.longestStreak ? formatSpanLabel(record.rhythmOverview.longestStreak) : "还没有形成连续记录段。"
    },
    {
      label: "最长空档",
      value: record.rhythmOverview.longestGap ? `${record.rhythmOverview.longestGap.length} 天` : "暂无",
      detail: record.rhythmOverview.longestGap ? formatSpanLabel(record.rhythmOverview.longestGap) : "目前没有明确的连续空白段。"
    },
    {
      label: "待整合日",
      value: record.rhythmOverview.pendingDailyJournalCount > 0 ? `${record.rhythmOverview.pendingDailyJournalCount} 天` : "暂无",
      detail: latestPendingDay
        ? `最近 ${formatAnalysisDateLabel(latestPendingDay.date)}${latestPendingDay.hasStaleDailyJournal ? "（待更新）" : ""}`
        : "已保存材料都已经收成完整日志。"
    },
    {
      label: "待成文日",
      value: record.rhythmOverview.scoreOnlyDayCount > 0 ? `${record.rhythmOverview.scoreOnlyDayCount} 天` : "暂无",
      detail: latestScoreOnlyDay ? `最近 ${formatAnalysisDateLabel(latestScoreOnlyDay.date)}` : "目前没有只评分未成文的日期。"
    }
  ];

  return (
    <div data-testid="analysis-rhythm-board">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="archive-label">节奏判断</p>
          <h3 className="mt-2 font-display text-[1.35rem] leading-none text-[#302114]">
            {isFutureMonth ? "这个月先不做断档判断" : "先看哪里断，再看哪里该收住"}
          </h3>
          <p className="mt-3 max-w-[44rem] text-[0.9rem] leading-7 text-[#72583f]">{buildRhythmNarrative(record, todayEntryDate)}</p>
        </div>
        <div className="grid gap-2 text-[0.72rem] text-[#7a624b] sm:grid-cols-2">
          <span className={ANALYSIS_CHIP_CLASS}>状态：未来 / 空白 / 只评未记 / 待整合 / 待更新 / 已整合</span>
          <span className={ANALYSIS_CHIP_CLASS}>密度：1维 / 2维 / 3维+</span>
        </div>
      </div>

      <Divider className="my-5" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.16fr)_minmax(18.5rem,0.84fr)]">
        <div>
          <div className="mb-3">
            <p className="archive-label">记录热力</p>
            <p className="mt-2 text-[0.88rem] leading-7 text-[#72583f]">状态先于密度，再顺着具体日期回到当天处理最该补的那一步。</p>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-2">
            {rhythmWeekdays.map((label) => (
              <p key={label} className="px-1 text-center text-[0.7rem] text-[#8b6c4d]">
                {label}
              </p>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2" data-testid="analysis-heatmap-grid">
            {cells.map((cell) => {
              if (!cell.isCurrentMonth || !cell.date) {
                return (
                  <div
                    key={cell.key}
                    className="h-[5.4rem] rounded-[var(--radius-control)] border border-dashed border-[rgba(150,105,61,0.06)] bg-paper/20"
                    aria-hidden="true"
                  />
                );
              }

              const coverage = daysByDate.get(cell.date) ?? null;
              const state = getRhythmDayState(coverage, todayEntryDate);
              const density = Math.min(coverage?.savedDimensionCount ?? 0, 3);
              const isSelected = selectedDate === cell.date;

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setSelectedDate(cell.date ?? selectedDate)}
                  className={cn(
                    "group flex h-[5.4rem] flex-col rounded-[var(--radius-control)] border px-2.5 py-2 text-left transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8c6034]",
                    getRhythmSurfaceClass(state, density),
                    isSelected ? "border-[var(--line-strong)] ring-2 ring-[rgba(111,74,38,0.12)]" : null
                  )}
                  data-testid={`analysis-heatmap-day-${cell.date}`}
                  title={`${cell.date}，${getRhythmStatusLabel(state)}${coverage?.savedDimensionCount ? `，${coverage.savedDimensionCount} 个维度` : ""}${
                    coverage?.hasScore && typeof coverage.averageScore === "number" ? `，评分 ${coverage.averageScore.toFixed(1)}` : ""
                  }${coverage?.hasDailyJournalSaved ? "，日志已整合" : ""}`}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[0.72rem] tabular-nums text-[#8e6a46]">{cell.dayNumber}</span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.62rem]",
                        getRhythmStateBadgeClass(state)
                      )}
                    >
                      {state === "complete" ? "整" : state === "stale" ? "更" : state === "log_only" ? "待" : state === "score_only" ? "评" : state === "future" ? "未" : "空"}
                    </span>
                  </div>
                  <div className="mt-auto min-w-0">
                    <p className="font-mono text-[0.74rem] tabular-nums text-[#4b3a2b]">{getRhythmDensityLabel(coverage, state)}</p>
                    <p className="mt-1 truncate text-[0.68rem] text-[#72583f]">{getRhythmStatusLabel(state)}</p>
                    {(coverage?.savedDimensions.length ?? 0) > 0 ? (
                      <div
                        className="mt-1 flex flex-wrap gap-1"
                        aria-label={`涉及维度 ${coverage?.savedDimensions.map((dimension) => getInterviewDimensionMeta(dimension).label).join("、")}`}
                      >
                        {(coverage?.savedDimensions.slice(0, 3) ?? []).map((dimension) => {
                          const visualMeta = getCalendarDimensionVisualMeta(dimension);

                          return (
                            <span
                              key={dimension}
                              className={`inline-flex size-5 items-center justify-center rounded-full border text-[0.68rem] font-medium ${visualMeta.softBadgeClass}`}
                              title={getInterviewDimensionMeta(dimension).label}
                            >
                              {visualMeta.monthLabel}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-x-6 md:grid-cols-2" data-testid="analysis-rhythm-summary-bar">
            {rhythmSummaryItems.map((item) => (
              <div key={item.label} className="border-t border-[var(--line-soft)] py-3">
                <p className="text-[0.7rem] text-[#8b6c4d]">{item.label}</p>
                <p className="mt-1 font-mono text-[0.88rem] tabular-nums text-[#3a2c1f]">{item.value}</p>
                <p className="mt-2 text-[0.76rem] leading-6 text-[#72583f]">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <Card as="aside" className="self-start p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="archive-label">当天追踪</p>
            <span className={ANALYSIS_CHIP_CLASS}>{getRhythmStatusLabel(selectedState)}</span>
          </div>
          <h3 className="mt-2 font-display text-[1.35rem] leading-none text-[#302114]">{formatAnalysisDateLabel(selectedDate, "暂无")}</h3>
          {selectedCoverage?.hasScore ? (
            <p className="mt-2 font-mono text-[0.76rem] tabular-nums text-[#876b51]">当天评分：{formatScoreAverage(selectedAverageScore)}</p>
          ) : null}

          <p className="mt-3 text-[0.88rem] leading-7 text-[#72583f]">
            {selectedState === "future"
              ? "这一天还没到来。可以先查看当天，但未来日期不开放开始记录。"
              : selectedState === "score_only"
                ? "这一天已经有评分刻度，但还没有任何维度记录。先把这天写成一个具体片段。"
                : selectedState === "stale"
                  ? "这一天的完整日志已经落后于最新来源，建议重新整理一次，让当天总结重新对齐。"
                : selectedState === "log_only"
                  ? selectedCoverage && selectedCoverage.savedDimensionCount >= 2
                    ? `这一天已经留下 ${selectedCoverage.savedDimensionCount} 个维度，但还没收成完整日志。`
                    : "这一天已经有已保存记录，可以回到当天继续补足或整理。"
                  : selectedState === "complete"
                    ? "这一天已经整理成完整日志，可以回看正文，也可以回到当天继续细化某个维度。"
                    : "这一天目前还是空的。可以直接开始这一天的记录，或者先查看当天。"}
          </p>

          {selectedDimensions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedDimensions.map((dimension) => {
                const visualMeta = getCalendarDimensionVisualMeta(dimension);

                return (
                  <Link
                    key={dimension}
                    href={buildInterviewHref({ dimension, entryDate: selectedDate })}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.76rem] ${visualMeta.softBadgeClass}`}
                  >
                    <span aria-hidden="true">{visualMeta.monthLabel}</span>
                    <span>{getInterviewDimensionMeta(dimension).label}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}

          {selectedCoverage?.journalTitle || selectedCoverage?.contentPreview ? (
            <div className="ui-quote mt-4" data-testid="rhythm-day-journal-preview">
              {selectedCoverage.journalTitle ? (
                <p className="text-[0.84rem] leading-6 text-[#3a2c1f]">{selectedCoverage.journalTitle}</p>
              ) : null}
              {selectedCoverage.contentPreview ? (
                <p className="mt-1 text-pretty text-[0.76rem] leading-5 text-[#6f5339]">{selectedCoverage.contentPreview}</p>
              ) : null}
              <Link
                href={buildCalendarHref({ date: selectedDate, view: "day" })}
                className="mt-1.5 inline-flex text-[0.74rem] text-[#6f4a26] underline-offset-2 hover:underline"
              >
                查看完整日志 →
              </Link>
            </div>
          ) : selectedCoverage && !selectedCoverage.hasDailyJournalSaved && selectedCoverage.savedEntryCount > 0 ? (
            <p className="ui-quote mt-4 text-[0.76rem] leading-5" data-testid="rhythm-day-signal-preview">
              已有 {selectedCoverage.savedEntryCount} 条记录，但还没有整合成日志。
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2.5">
            {selectedState === "future" ? (
              <ActionLink href={buildCalendarHref({ view: "day", date: selectedDate })} label="查看当天" variant="primary" />
            ) : null}

            {selectedState === "empty" ? (
              <>
                <ActionLink href={buildInterviewHref({ dimension: "joy", entryDate: selectedDate })} label="开始这一天的记录" variant="primary" />
                <ActionLink href={buildCalendarHref({ view: "day", date: selectedDate })} label="查看当天" />
              </>
            ) : null}

            {selectedState === "score_only" ? (
              <>
                <ActionLink href={buildCalendarHref({ view: "day", date: selectedDate })} label="为这一天补一条记录" variant="primary" />
                <ActionLink href={buildAnalysisHref({ month: record.month, section: "trends" })} label="查看评分" />
              </>
            ) : null}

            {selectedState === "log_only" ? (
              <>
                <ActionLink href={buildCalendarHref({ view: "day", date: selectedDate })} label="查看当天" variant="primary" />
                {selectedCoverage && selectedCoverage.savedDimensionCount >= 2 ? (
                  <ActionLink href={buildDailyJournalHref(selectedDate)} label="整理完整日志" />
                ) : null}
              </>
            ) : null}

            {selectedState === "stale" ? (
              <>
                <ActionLink href={buildDailyJournalHref(selectedDate)} label="更新完整日志" variant="primary" />
                <ActionLink href={buildCalendarHref({ view: "day", date: selectedDate })} label="查看当天" />
              </>
            ) : null}

            {selectedState === "complete" ? (
              <>
                <ActionLink href={buildCalendarHref({ view: "day", date: selectedDate })} label="查看当天" variant="primary" />
                <ActionLink href={buildDailyJournalHref(selectedDate)} label="打开完整日志" />
              </>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
