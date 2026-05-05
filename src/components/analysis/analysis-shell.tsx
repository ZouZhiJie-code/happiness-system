"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type {
  AnalysisDateSpan,
  AnalysisDailyCoverageDay,
  AnalysisDimensionInsightCard,
  AnalysisInsightCardItem,
  AnalysisMonthRecord
} from "@/features/analysis/types";
import { notifyAnalysisToolbarRefresh } from "@/features/analysis/toolbar-refresh";
import {
  buildAnalysisHref,
  formatAnalysisMonthLabel,
  getTodayAnalysisMonth,
  normalizeAnalysisSearchParams,
  type AnalysisSectionKey
} from "@/features/analysis/view-state";
import { getCalendarDimensionVisualMeta } from "@/features/calendar/presentation";
import { buildCalendarHref, buildCalendarMonthGrid } from "@/features/calendar/view-state";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import { getInterviewDimensionMeta, interviewDimensions } from "@/features/interview/dimensions";
import {
  happinessScoreKeyPairs,
  type DailyHappinessScoreKey,
  type HappinessScoreRequestKey
} from "@/features/happiness-score/types";
import { cn } from "@/lib/utils";

const happinessScoreItems: {
  requestKey: HappinessScoreRequestKey;
  recordKey: DailyHappinessScoreKey;
  label: string;
  description: string;
}[] = [
  {
    requestKey: "meaning",
    recordKey: "meaningScore",
    label: "意义感",
    description: "今天做的事，有没有碰到我在乎的方向"
  },
  {
    requestKey: "health",
    recordKey: "healthScore",
    label: "身体状态",
    description: "身体、睡眠和精力，有没有被照顾到"
  },
  {
    requestKey: "virtue",
    recordKey: "virtueScore",
    label: "自我认可",
    description: "今天的选择，有没有让我自己觉得站得住"
  },
  {
    requestKey: "autonomy",
    recordKey: "autonomyScore",
    label: "自主感",
    description: "我有没有保住一点选择感和掌控感"
  },
  {
    requestKey: "interest",
    recordKey: "interestScore",
    label: "投入感",
    description: "今天有没有被好奇、喜欢或投入感点亮"
  },
  {
    requestKey: "skill",
    recordKey: "skillScore",
    label: "成长感",
    description: "有没有练到能力，或者看见一点进步"
  },
  {
    requestKey: "relationship",
    recordKey: "relationshipScore",
    label: "关系支持",
    description: "今天有没有感到连接、支持或被理解"
  },
  {
    requestKey: "livingCondition",
    recordKey: "livingConditionScore",
    label: "生活托住",
    description: "环境、秩序和现实条件，有没有把我托住"
  }
];

type ScoreFormState = Partial<Record<HappinessScoreRequestKey, number>>;
type ScoreSaveErrorCode =
  | "INVALID_HAPPINESS_SCORE_REQUEST"
  | "HAPPINESS_SCORE_EDIT_WINDOW_EXCEEDED"
  | "HAPPINESS_SCORE_SAVE_FAILED";

interface ScoreTrendHighlight {
  label: string;
  title: string;
  detail: string;
  context: string | null;
}

interface ScoreTrendHighlightsResult {
  highlights: ScoreTrendHighlight[];
  note: string | null;
}

interface OverviewAction {
  title: string;
  body: string;
  href: string;
  label: string;
}

type RhythmDayState = "future" | "empty" | "score_only" | "log_only" | "stale" | "complete";

const rhythmWeekdays = ["一", "二", "三", "四", "五", "六", "日"] as const;

async function fetchAnalysisMonth(month: string) {
  const response = await fetch(`/api/analysis/month?month=${month}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("ANALYSIS_MONTH_QUERY_FAILED");
  }

  return (await response.json()) as AnalysisMonthRecord;
}

async function saveHappinessScore(date: string, scores: Record<HappinessScoreRequestKey, number>) {
  const response = await fetch("/api/happiness-score", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      date,
      scores
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: ScoreSaveErrorCode } | null;
    throw new Error(payload?.error ?? "HAPPINESS_SCORE_SAVE_FAILED");
  }
}

function buildInterviewHref(input: {
  dimension: (typeof interviewDimensions)[number];
  entryDate?: string | null;
  panel?: "journal" | null;
}) {
  const params = new URLSearchParams({
    dimension: input.dimension
  });

  if (input.entryDate) {
    params.set("entryDate", input.entryDate);
  }

  if (input.panel) {
    params.set("panel", input.panel);
  }

  return `/interview?${params.toString()}`;
}

function buildDailyJournalHref(date: string) {
  const params = new URLSearchParams({
    dimension: "joy",
    entryDate: date,
    mode: "daily-journal"
  });

  return `/interview?${params.toString()}`;
}

function formatAnalysisDateLabel(date: string | null, fallback = "暂无") {
  if (!date) {
    return fallback;
  }

  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function formatScoreDateLabel(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function resolveScoreDateShortcut(date: string, editableDates: string[]) {
  if (date === editableDates[0]) {
    return "今天";
  }

  if (date === editableDates[1]) {
    return "昨天";
  }

  return formatScoreDateLabel(date);
}

function getScoreRecordByDate(record: AnalysisMonthRecord, date: string) {
  return record.scoreRecords.find((score) => score.date === date) ?? null;
}

function hasScoreRecordForDate(record: AnalysisMonthRecord, date: string) {
  return Boolean(getScoreRecordByDate(record, date));
}

function getPendingEditableScoreDates(record: AnalysisMonthRecord) {
  return record.editableDates.filter((date) => !hasScoreRecordForDate(record, date));
}

function getScoreCompletion(scores: ScoreFormState) {
  const filledCount = happinessScoreItems.filter((item) => typeof scores[item.requestKey] === "number").length;
  const nextUnfilledFactor = happinessScoreItems.find((item) => typeof scores[item.requestKey] !== "number")?.requestKey ?? null;

  return {
    filledCount,
    remainingCount: happinessScoreItems.length - filledCount,
    nextUnfilledFactor
  };
}

function resolvePreferredScoreFactor(scores: ScoreFormState) {
  return getScoreCompletion(scores).nextUnfilledFactor ?? happinessScoreItems[0]?.requestKey ?? "meaning";
}

function formatEditableScoreDateLabel(date: string, editableDates: string[]) {
  const shortcut = resolveScoreDateShortcut(date, editableDates);

  if (shortcut === "今天") {
    return `今天 · ${formatScoreDateLabel(date)}`;
  }

  if (shortcut === "昨天") {
    return editableDates[0]?.slice(0, 7) === date.slice(0, 7) ? `昨天 · ${formatScoreDateLabel(date)}` : `昨天补录 · ${formatScoreDateLabel(date)}`;
  }

  return formatScoreDateLabel(date);
}

function formatScoreLevelCopy(value: number | null) {
  if (typeof value !== "number") {
    return {
      label: "未填",
      detail: "先凭直觉给一个刻度，不需要追求特别精确。"
    };
  }

  if (value <= 3) {
    return {
      label: "偏低",
      detail: "这项今天明显比较弱，后面回看时很容易成为需要解释的低点。"
    };
  }

  if (value <= 7) {
    return {
      label: "中段",
      detail: "这项今天大致在中间，更适合结合别的线索一起看。"
    };
  }

  return {
    label: "偏高",
    detail: "这项今天相对被托住了，后面可以留意它是否稳定出现。"
  };
}

function buildScoreFormState(record: AnalysisMonthRecord, date: string): ScoreFormState {
  const existing = record.scoreRecords.find((score) => score.date === date);

  if (!existing) {
    return {};
  }

  return Object.fromEntries(happinessScoreKeyPairs.map((item) => [item.requestKey, existing[item.recordKey]])) as ScoreFormState;
}

function isCompleteScoreForm(scores: ScoreFormState): scores is Record<HappinessScoreRequestKey, number> {
  return happinessScoreItems.every((item) => {
    const value = scores[item.requestKey];
    return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10;
  });
}

function formatScoreAverage(value: number | null) {
  return typeof value === "number" ? value.toFixed(1) : "暂无";
}

function buildHighlightJournalContext(
  factorKey: HappinessScoreRequestKey,
  record: AnalysisMonthRecord
): string | null {
  const linked = record.dimensions
    .filter((dim) => dim.relatedScoreFactors.includes(factorKey) && dim.recordedDayCount > 0)
    .sort((left, right) => right.recordedDayCount - left.recordedDayCount)[0];

  if (!linked) {
    return null;
  }

  const dimensionLabel = getInterviewDimensionMeta(linked.dimension).label;
  const topTag = linked.topTags[0];

  if (topTag && topTag.count >= 2) {
    return `你在「${dimensionLabel}」维度记录 ${linked.recordedDayCount} 天，常出现「${topTag.tag}」`;
  }

  return `你在「${dimensionLabel}」维度记录 ${linked.recordedDayCount} 天`;
}

function getScoreTrendHighlights(record: AnalysisMonthRecord): ScoreTrendHighlightsResult {
  const factorStats = happinessScoreItems
    .map((item) => {
      const values = record.scoreTrend.days
        .map((day) => day.scores[item.requestKey])
        .filter((value): value is number => typeof value === "number");
      const average = record.scoreTrend.factorAverages[item.requestKey];

      if (typeof average !== "number" || values.length === 0) {
        return null;
      }

      const minimum = Math.min(...values);
      const maximum = Math.max(...values);

      return {
        item,
        average,
        minimum,
        maximum,
        spread: maximum - minimum,
        sampleCount: values.length
      };
    })
    .filter((stat): stat is NonNullable<typeof stat> => Boolean(stat));

  if (record.scoreOverview.scoredDayCount < 2 || factorStats.length < 2) {
    return {
      highlights: [],
      note: "评分样本还不足，先把这里当作刻度参考，以真实体感为准。"
    };
  }

  const highestAverage = Math.max(...factorStats.map((stat) => stat.average));
  const lowestAverage = Math.min(...factorStats.map((stat) => stat.average));
  const hasAverageSeparation = highestAverage > lowestAverage;
  const variableStats = factorStats.filter((stat) => stat.sampleCount > 1);
  const highestSpread = variableStats.length > 0 ? Math.max(...variableStats.map((stat) => stat.spread)) : 0;
  const lowestSpread = variableStats.length > 0 ? Math.min(...variableStats.map((stat) => stat.spread)) : 0;
  const hasSpreadSeparation = highestSpread > 0 && highestSpread > lowestSpread;

  if (!hasAverageSeparation && !hasSpreadSeparation) {
    return {
      highlights: [],
      note: "这个月的评分差异还不够明显，先看总分走势，单项排名只作轻参考。"
    };
  }

  const highlights: ScoreTrendHighlight[] = [];

  if (hasAverageSeparation) {
    const highest = [...factorStats].sort((left, right) => right.average - left.average)[0];
    const lowest = [...factorStats].sort((left, right) => left.average - right.average)[0];

    highlights.push(
      {
        label: "长期偏高",
        title: highest.item.label,
        detail: `月均 ${formatScoreAverage(highest.average)}`,
        context: buildHighlightJournalContext(highest.item.requestKey, record)
      },
      {
        label: "最常掉下来",
        title: lowest.item.label,
        detail: `月均 ${formatScoreAverage(lowest.average)}`,
        context: buildHighlightJournalContext(lowest.item.requestKey, record)
      }
    );
  }

  if (hasSpreadSeparation) {
    const mostVariable = [...variableStats].sort((left, right) => right.spread - left.spread)[0];

    highlights.push({
      label: "波动最大",
      title: mostVariable.item.label,
      detail: `${mostVariable.minimum} - ${mostVariable.maximum} 分`,
      context: buildHighlightJournalContext(mostVariable.item.requestKey, record)
    });
  }

  return {
    highlights,
    note: hasAverageSeparation ? null : "当前更适合把评分看成体感刻度，不急着读出稳定高低。"
  };
}

function resolveScoreSaveErrorCopy(errorCode: string | null) {
  if (errorCode === "HAPPINESS_SCORE_EDIT_WINDOW_EXCEEDED") {
    return "这个日期已经不在可编辑窗口里了，只能修改今天和昨天。";
  }

  if (errorCode === "INVALID_HAPPINESS_SCORE_REQUEST") {
    return "这次评分没有成功提交，先检查是不是还有未填项。";
  }

  return "评分保存失败，请稍后再试。";
}

function resolveTrendPointLabel(date: string, value: number) {
  return `${formatScoreDateLabel(date)} ${value.toFixed(1)}分`;
}

function getObservedCoverageDays(record: AnalysisMonthRecord) {
  const todayEntryDate = getTodayEntryDate();

  if (record.month !== todayEntryDate.slice(0, 7)) {
    return record.dailyCoverage;
  }

  return record.dailyCoverage.filter((day) => day.date <= todayEntryDate);
}

function getLatestDailyJournalDay(record: AnalysisMonthRecord) {
  return getObservedCoverageDays(record)
    .filter((day) => day.hasDailyJournalSaved && !day.hasStaleDailyJournal)
    .sort((left, right) => right.date.localeCompare(left.date))[0] ?? null;
}

function findCoverageDay(record: AnalysisMonthRecord, date: string | null) {
  if (!date) {
    return null;
  }

  return record.dailyCoverage.find((day) => day.date === date) ?? null;
}

function formatSpanLabel(span: AnalysisDateSpan | null) {
  if (!span) {
    return "暂无";
  }

  if (span.length === 1) {
    return `${formatAnalysisDateLabel(span.startDate)}，1天`;
  }

  return `${formatAnalysisDateLabel(span.startDate)} - ${formatAnalysisDateLabel(span.endDate)}，${span.length}天`;
}

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

function buildRhythmNarrative(record: AnalysisMonthRecord, todayEntryDate = getTodayEntryDate()) {
  if (record.month > todayEntryDate.slice(0, 7)) {
    return "这个月还没到来，先不把自然未来误读成断档。";
  }

  if (record.logOverview.savedEntryCount === 0 && record.scoreOverview.scoredDayCount === 0) {
    return "这个月还没有留下任何材料，节奏图先保持空白。";
  }

  if (record.rhythmOverview.pendingDailyJournalCount > 0) {
    return `这个月已经有 ${record.rhythmOverview.activeObservedDayCount} 天留下材料，其中 ${record.rhythmOverview.pendingDailyJournalCount} 天还需要整理或更新完整日志。`;
  }

  if (record.rhythmOverview.scoreOnlyDayCount > 0) {
    return `这个月有 ${record.rhythmOverview.scoreOnlyDayCount} 天先留下了评分，但还没写成具体记录。`;
  }

  if (record.rhythmOverview.longestStreak) {
    return `最稳的一段连续记录出现在 ${formatSpanLabel(record.rhythmOverview.longestStreak)}。`;
  }

  return `这个月一共留下了 ${record.rhythmOverview.activeObservedDayCount} 天材料，节奏还比较零散，可以顺着最近一次继续。`;
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

function isFutureAnalysisMonth(month: string, todayMonth = getTodayAnalysisMonth()) {
  return month > todayMonth;
}

function buildOverviewNarrative(record: AnalysisMonthRecord) {
  const latestPendingDay = findCoverageDay(record, record.rhythmOverview.latestPendingDailyJournalDate);
  const latestScoreOnlyDay = findCoverageDay(record, record.rhythmOverview.latestScoreOnlyDate);

  if (isFutureAnalysisMonth(record.month) && record.logOverview.savedEntryCount === 0 && record.scoreOverview.scoredDayCount === 0) {
    return "这个月还没到来，先不把未来月份当成空白断档。回到当前月份，更容易看到正在发生的记录和评分。";
  }

  if (record.logOverview.savedEntryCount === 0 && record.scoreOverview.scoredDayCount === 0) {
    return "这个月还没有开始留下分析材料。先补今天评分，或从一个维度开始记录。";
  }

  if (latestPendingDay) {
    return latestPendingDay.hasStaleDailyJournal
      ? `${formatAnalysisDateLabel(latestPendingDay.date)} 的完整日志已经落后于最新来源。这个月材料还在变化，节奏需要回到那一天重新收束。`
      : `${formatAnalysisDateLabel(latestPendingDay.date)} 还没收成完整日志。这个月已经有 ${record.rhythmOverview.activeObservedDayCount} 天留下材料，但节奏还停在半成品。`;
  }

  if (latestScoreOnlyDay) {
    return `${formatAnalysisDateLabel(latestScoreOnlyDay.date)} 只有评分，还没有写成具体片段。先把刻度补成记录，节奏才会真正成形。`;
  }

  if (record.logOverview.savedEntryCount === 0) {
    return `这个月已经有 ${record.scoreOverview.scoredDayCount} 天评分轨迹，但还没有形成可回看的文字线索。`;
  }

  return record.insightsOverview.summary;
}

function getScoreConfidenceCopy(record: AnalysisMonthRecord) {
  const scoredDayCount = record.scoreOverview.scoredDayCount;

  if (scoredDayCount === 0) {
    return {
      label: "暂无评分",
      detail: "还没有幸福 8 要素刻度，先不急着读月均。"
    };
  }

  if (scoredDayCount === 1) {
    return {
      label: "1天评分",
      detail: "先当作单日刻度，不把它放大成月度结论。"
    };
  }

  if (scoredDayCount < 4) {
    return {
      label: `${scoredDayCount}天评分`,
      detail: "样本还偏少，适合看方向感，不适合下重结论。"
    };
  }

  return {
    label: `基于${scoredDayCount}天`,
    detail: "评分材料已经能支撑月均和走势的初步判断。"
  };
}

function buildOverviewNextAction(record: AnalysisMonthRecord): OverviewAction {
  const pendingEditableDates = getPendingEditableScoreDates(record);
  const nextPendingEditableDate = pendingEditableDates[0] ?? null;
  const pendingDailyJournalDay = findCoverageDay(record, record.rhythmOverview.latestPendingDailyJournalDate);
  const scoreOnlyDay = findCoverageDay(record, record.rhythmOverview.latestScoreOnlyDate);
  const latestActiveDay = findCoverageDay(record, record.rhythmOverview.latestActiveDate);

  if (isFutureAnalysisMonth(record.month) && record.logOverview.savedEntryCount === 0 && record.scoreOverview.scoredDayCount === 0) {
    return {
      title: "这个月还没开始",
      body: "未来月份先不做开始记录的引导。回到当前月份，再看今天正在累积的评分和日志。",
      href: buildAnalysisHref({ month: getTodayAnalysisMonth(), section: "overview" }),
      label: "回到本月"
    };
  }

  if (record.logOverview.savedEntryCount === 0 && record.scoreOverview.scoredDayCount === 0) {
    return {
      title: "先留下今天的第一条记录",
      body: "总览还没有材料可读。先从一个维度开始，后面评分、节奏和五维主线才会慢慢长出来。",
      href: "/interview?dimension=joy",
      label: "开始记录"
    };
  }

  if (pendingDailyJournalDay) {
    return {
      title: `先收住${formatAnalysisDateLabel(pendingDailyJournalDay.date)}`,
      body:
        pendingDailyJournalDay.hasStaleDailyJournal
          ? `${formatAnalysisDateLabel(pendingDailyJournalDay.date)}的完整日志已经和最新来源不一致，先更新一次。`
          : pendingDailyJournalDay.savedDimensionCount >= 2
          ? `${formatAnalysisDateLabel(pendingDailyJournalDay.date)}已经有 ${pendingDailyJournalDay.savedDimensionCount} 个维度，但还没整理成完整日志。`
          : `${formatAnalysisDateLabel(pendingDailyJournalDay.date)}已经留下记录，但还没有收成当天完整日志。`,
      href: buildDailyJournalHref(pendingDailyJournalDay.date),
      label: pendingDailyJournalDay.hasStaleDailyJournal ? "更新完整日志" : "整理完整日志"
    };
  }

  if (scoreOnlyDay) {
    return {
      title: `把${formatAnalysisDateLabel(scoreOnlyDay.date)}写成记录`,
      body: `${formatAnalysisDateLabel(scoreOnlyDay.date)}已经有评分刻度，但还没有任何维度日志。先把那一天写成一个具体片段。`,
      href: buildCalendarHref({ view: "day", date: scoreOnlyDay.date }),
      label: "去补记录"
    };
  }

  if (nextPendingEditableDate) {
    const pendingLabel = resolveScoreDateShortcut(nextPendingEditableDate, record.editableDates);

    return {
      title: `先补${pendingLabel}评分`,
      body:
        pendingLabel === "今天"
          ? "文字线索已经存在，补上今天的幸福 8 要素刻度后，评分走势会更接近真实状态。"
          : "趋势已经能看，但昨天的刻度还没补齐。把这一天补上，月内走势会更连贯。",
      href: buildAnalysisHref({ month: record.month, section: "score" }),
      label: `补${pendingLabel}评分`
    };
  }

  if (latestActiveDay) {
    return {
      title: `回到${formatAnalysisDateLabel(latestActiveDay.date)}`,
      body: "这个月最近一次有材料的日期在这里，先回到当天，再决定要继续哪一条。",
      href: buildCalendarHref({ view: "day", date: latestActiveDay.date }),
      label: "查看当天"
    };
  }

  return {
    title: "查看评分走势",
    body: "这个月暂时只有评分材料，先看走势，再补一条文字记录。",
    href: buildAnalysisHref({ month: record.month, section: "score" }),
    label: "查看走势"
  };
}

function getFeaturedDimension(record: AnalysisMonthRecord) {
  if (record.insightsOverview.featuredDimension) {
    return record.dimensions.find((dimension) => dimension.dimension === record.insightsOverview.featuredDimension) ?? null;
  }

  return [...record.dimensions]
    .filter((dimension) => dimension.savedEntryCount > 0)
    .sort(compareDimensionInsights)[0] ?? null;
}

function buildDimensionSummary(dimension: AnalysisDimensionInsightCard, narrative: AnalysisMonthRecord["narrative"]) {
  const aiThesis = narrative?.dimensionTheses[dimension.dimension];

  if (aiThesis) {
    return aiThesis;
  }

  if (dimension.thesis) {
    return dimension.thesis;
  }

  const evidence = dimension.evidence[0];

  if (evidence?.detail) {
    return `${evidence.summary}。${evidence.detail}`;
  }

  if (evidence?.summary) {
    return evidence.summary;
  }

  const recent = dimension.recentSignals[0];

  if (recent?.secondarySignal) {
    return `${recent.primarySignal}。${recent.secondarySignal}`;
  }

  if (recent?.primarySignal) {
    return recent.primarySignal;
  }

  if (dimension.topTags.length > 0) {
    return `高频线索：${dimension.topTags.map((item) => item.tag).join("、")}。`;
  }

  return "这个维度本月还没有形成可展示的线索。";
}

function compareDimensionInsights(left: AnalysisDimensionInsightCard, right: AnalysisDimensionInsightCard) {
  const confidenceWeight = {
    low: 1,
    medium: 2,
    high: 3
  } as const;
  const continuityWeight = {
    none: 0,
    single: 1,
    intermittent: 2,
    sustained: 3
  } as const;
  const momentumWeight = {
    quiet: 0,
    starting: 1,
    rising: 2,
    steady: 2
  } as const;

  if (confidenceWeight[right.confidence] !== confidenceWeight[left.confidence]) {
    return confidenceWeight[right.confidence] - confidenceWeight[left.confidence];
  }

  if (continuityWeight[right.continuity] !== continuityWeight[left.continuity]) {
    return continuityWeight[right.continuity] - continuityWeight[left.continuity];
  }

  if (right.recordedDayCount !== left.recordedDayCount) {
    return right.recordedDayCount - left.recordedDayCount;
  }

  if (momentumWeight[right.momentum] !== momentumWeight[left.momentum]) {
    return momentumWeight[right.momentum] - momentumWeight[left.momentum];
  }

  if (right.savedEntryCount !== left.savedEntryCount) {
    return right.savedEntryCount - left.savedEntryCount;
  }

  return (right.lastRecordedDate ?? "").localeCompare(left.lastRecordedDate ?? "");
}

function getDimensionConfidenceLabel(dimension: AnalysisDimensionInsightCard) {
  if (dimension.savedEntryCount === 0) {
    return "还没展开";
  }

  if (dimension.confidence === "high") {
    return "比较稳定";
  }

  if (dimension.confidence === "medium") {
    return "已经成形";
  }

  return "刚起头";
}

function getDimensionMomentumLabel(dimension: AnalysisDimensionInsightCard) {
  if (dimension.savedEntryCount === 0) {
    return "这月还没落下来";
  }

  if (dimension.momentum === "steady") {
    return "这个月比较稳";
  }

  if (dimension.momentum === "rising") {
    return "后半月更明显";
  }

  if (dimension.momentum === "starting") {
    return "最近刚冒出来";
  }

  return "前面露过头";
}

function getDimensionContinuityLabel(dimension: AnalysisDimensionInsightCard) {
  if (dimension.savedEntryCount === 0 || dimension.continuity === "none") {
    return "暂无连续感";
  }

  if (dimension.continuity === "single") {
    return "先在一天里露出来";
  }

  if (dimension.continuity === "intermittent") {
    return "断断续续出现";
  }

  return "连续感更强";
}

function ActionLink({
  href,
  label,
  variant = "secondary"
}: {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const className =
    variant === "primary"
      ? "calendar-action-primary inline-flex items-center justify-center rounded-full px-3.5 py-2 text-[0.8rem] font-medium"
      : "calendar-action-secondary inline-flex items-center justify-center rounded-full px-1.5 py-1 text-[0.78rem] font-medium";

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

function AnalysisSection({
  index,
  title,
  description,
  eyebrow,
  testId,
  children
}: {
  index: string;
  title: string;
  description: string;
  eyebrow: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="border-t pt-6 first:border-t-0 first:pt-0 border-[rgba(150,105,61,0.12)]"
      data-testid={testId}
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-[0.82rem] text-[#9a6b3d]">{index}</span>
        <p className="archive-label">{eyebrow}</p>
      </div>
      <div className="mt-3 min-w-0">
        <h2 className="text-balance font-display text-[1.56rem] leading-[0.98] text-[#2f2419] md:text-[1.82rem]">{title}</h2>
        <p className="mt-2 max-w-[46rem] text-pretty text-[0.94rem] leading-7 text-[#6f5a44]">{description}</p>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SummaryHero({ record, month }: { record: AnalysisMonthRecord | null; month: string }) {
  const featured = record ? getFeaturedDimension(record) : null;
  const activeDayCount = record?.rhythmOverview.activeObservedDayCount ?? 0;
  const longestStreak = record?.rhythmOverview.longestStreak ?? null;
  const pendingDailyJournalCount = record?.rhythmOverview.pendingDailyJournalCount ?? 0;
  const scoreOnlyDayCount = record?.rhythmOverview.scoreOnlyDayCount ?? 0;
  const scoreConfidence = record ? getScoreConfidenceCopy(record) : null;
  const nextAction = record ? buildOverviewNextAction(record) : null;
  const featuredSignal = featured?.recentSignals[0] ?? null;
  const featuredLabel = featured ? getInterviewDimensionMeta(featured.dimension).label : null;

  return (
    <div data-testid="analysis-month-hero">
      <div className="rounded-[24px] border border-[rgba(150,105,61,0.12)] bg-[linear-gradient(135deg,rgba(255,249,239,0.9),rgba(238,219,187,0.72))] p-4 md:p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.32fr)_minmax(18rem,0.68fr)]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="archive-label">月度判断</p>
              {scoreConfidence ? (
                <span className="rounded-full border border-[rgba(150,105,61,0.12)] bg-[rgba(255,252,246,0.7)] px-2.5 py-1 text-[0.72rem] text-[#7a6048]">
                  {scoreConfidence.label}
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 font-display text-[1.95rem] leading-none text-[#2f2419] md:text-[2.45rem]">
              {formatAnalysisMonthLabel(month)}
            </h1>
            <p className="mt-3 max-w-[48rem] text-pretty text-[0.95rem] leading-7 text-[#5f4b36]">
              {record ? (record.narrative?.overviewNarrative || buildOverviewNarrative(record)) : "加载中..."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.72)] px-3 py-1.5 text-[0.76rem] text-[#6f5339]">
                {record ? `${activeDayCount} 天有材料` : "材料加载中"}
              </span>
              <span className="rounded-full border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.72)] px-3 py-1.5 text-[0.76rem] text-[#6f5339]">
                {pendingDailyJournalCount > 0 ? `${pendingDailyJournalCount} 天待整合` : scoreOnlyDayCount > 0 ? `${scoreOnlyDayCount} 天待成文` : "节奏已收住"}
              </span>
              <span className="rounded-full border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.72)] px-3 py-1.5 text-[0.76rem] text-[#6f5339]">
                {longestStreak ? `最长连续 ${longestStreak.length} 天` : "连续节奏未形成"}
              </span>
            </div>
          </div>

          <aside className="rounded-[20px] border border-[rgba(150,105,61,0.12)] bg-[rgba(255,252,246,0.72)] p-4" data-testid="analysis-next-action">
            <p className="archive-label">建议先看</p>
            <h2 className="mt-3 text-balance font-display text-[1.45rem] leading-none text-[#302114]">
              {nextAction?.title ?? "正在判断入口"}
            </h2>
            <p className="mt-3 text-pretty text-[0.86rem] leading-7 text-[#72583f]">
              {nextAction?.body ?? "等本月数据加载完，再给出最合适的下一步。"}
            </p>
            {nextAction ? (
              <div className="mt-4">
                <ActionLink href={nextAction.href} label={nextAction.label} variant="primary" />
              </div>
            ) : null}
          </aside>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3" data-testid="analysis-status-board">
          <article className="rounded-[18px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.58)] px-3.5 py-3.5">
            <p className="text-[0.76rem] text-[#8b6c4d]">评分刻度</p>
            <p className="mt-2 font-mono text-[0.95rem] tabular-nums text-[#302114]">
              {record ? `已评 ${record.scoreOverview.scoredDayCount} 天，月均 ${formatScoreAverage(record.scoreOverview.monthAverageScore)}` : "—"}
            </p>
            <p className="mt-2 text-[0.8rem] leading-6 text-[#72583f]">{scoreConfidence?.detail ?? "评分材料加载中。"}</p>
            <div className="mt-2">
              <ActionLink href={buildAnalysisHref({ month, section: "score" })} label="查看评分" />
            </div>
          </article>

          <article className="rounded-[18px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.58)] px-3.5 py-3.5">
            <p className="text-[0.76rem] text-[#8b6c4d]">记录节奏</p>
            <p className="mt-2 font-mono text-[0.95rem] tabular-nums text-[#302114]">
              {record
                ? pendingDailyJournalCount > 0
                  ? `${pendingDailyJournalCount} 天待整合`
                  : scoreOnlyDayCount > 0
                    ? `${scoreOnlyDayCount} 天待成文`
                    : longestStreak
                      ? `${longestStreak.length} 天连续`
                      : `${activeDayCount} 天有材料`
                : "—"}
            </p>
            <p className="mt-2 text-[0.8rem] leading-6 text-[#72583f]">
              {record ? buildRhythmNarrative(record) : "还没有明显的记录节奏。"}
            </p>
            <div className="mt-2">
              <ActionLink href={buildAnalysisHref({ month, section: "rhythm" })} label="查看节奏" />
            </div>
          </article>

          <article className="rounded-[18px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.58)] px-3.5 py-3.5">
            <p className="text-[0.76rem] text-[#8b6c4d]">五维线索</p>
            <p className="mt-2 font-mono text-[0.95rem] tabular-nums text-[#302114]">
              {featured ? `${featuredLabel} · ${featured.savedEntryCount} 篇` : "尚未形成"}
            </p>
            <p className="mt-2 text-[0.8rem] leading-6 text-[#72583f]">
              {featuredSignal
                ? `${formatAnalysisDateLabel(featuredSignal.date)}：${featuredSignal.primarySignal}`
                : "还没有足够的维度信号可展示。"}
            </p>
            <div className="mt-2">
              <ActionLink href={buildAnalysisHref({ month, section: "insights" })} label="查看五维" />
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

function AnalysisEmptyBanner({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[20px] border border-dashed border-[rgba(150,105,61,0.16)] bg-[rgba(255,249,239,0.34)] px-4 py-5">
      <p className="font-display text-[1.15rem] leading-none text-[#302114]">{title}</p>
      <p className="mt-2 text-[0.9rem] leading-7 text-[#72583f]">{body}</p>
    </div>
  );
}

function SectionSkeleton({ blocks = 2 }: { blocks?: number }) {
  return (
    <div className="grid gap-3" aria-hidden="true">
      {Array.from({ length: blocks }, (_, index) => (
        <div key={index} className="h-36 rounded-[20px] bg-[rgba(244,232,208,0.5)]" />
      ))}
    </div>
  );
}

function ScoreLineChart({
  days,
  getValue,
  ariaLabel,
  emptyText,
  testId,
  stroke = "#6f4a26",
  compact = false,
  onPointClick,
  selectedDate
}: {
  days: AnalysisMonthRecord["scoreTrend"]["days"];
  getValue: (day: AnalysisMonthRecord["scoreTrend"]["days"][number]) => number | null;
  ariaLabel: string;
  emptyText: string;
  testId: string;
  stroke?: string;
  compact?: boolean;
  onPointClick?: (date: string) => void;
  selectedDate?: string | null;
}) {
  const width = compact ? 160 : 680;
  const height = compact ? 60 : 260;
  const margin = compact
    ? {
        top: 8,
        right: 8,
        bottom: 8,
        left: 8
      }
    : {
        top: 20,
        right: 26,
        bottom: 34,
        left: 42
      };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const yTicks = compact ? [] : [10, 7, 4, 1];
  const xLabelIndexes = compact ? [] : [...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])];
  const scoredPoints = days
    .map((day, index) => {
      const value = getValue(day);

      if (typeof value !== "number") {
        return null;
      }

      const x = margin.left + (index / Math.max(days.length - 1, 1)) * plotWidth;
      const y = margin.top + ((10 - value) / 9) * plotHeight;

      return {
        date: day.date,
        value,
        x,
        y
      };
    })
    .filter((point): point is NonNullable<typeof point> => Boolean(point));

  const segments: string[] = [];
  let currentSegment: string[] = [];

  days.forEach((day, index) => {
    const value = getValue(day);

    if (typeof value !== "number") {
      if (currentSegment.length > 0) {
        segments.push(currentSegment.join(" "));
        currentSegment = [];
      }
      return;
    }

    const x = margin.left + (index / Math.max(days.length - 1, 1)) * plotWidth;
    const y = margin.top + ((10 - value) / 9) * plotHeight;
    currentSegment.push(`${currentSegment.length === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
  });

  if (currentSegment.length > 0) {
    segments.push(currentSegment.join(" "));
  }

  return (
    <div
      className={`rounded-[18px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.82)] ${
        compact ? "p-2" : "min-h-[17rem] p-3.5"
      }`}
      data-testid={testId}
    >
      {scoredPoints.length === 0 ? (
        <div
          className={`flex items-center justify-center rounded-[14px] border border-dashed border-[rgba(150,105,61,0.16)] bg-[rgba(255,249,239,0.36)] px-4 text-center text-[0.82rem] leading-6 text-[#7a624b] ${
            compact ? "min-h-[2.75rem]" : "min-h-[14.5rem]"
          }`}
          data-testid={`${testId}-empty`}
        >
          {emptyText}
        </div>
      ) : (
        <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible">
          {yTicks.map((tick) => {
            const y = margin.top + ((10 - tick) / 9) * plotHeight;

            return (
              <g key={tick}>
                <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="rgba(150,105,61,0.14)" strokeWidth="1" />
                <text x={margin.left - 12} y={y + 5} textAnchor="end" className="fill-[#8a6b4b] font-mono text-[13px] tabular-nums">
                  {tick}
                </text>
              </g>
            );
          })}
          {xLabelIndexes.map((index) => {
            const day = days[index];

            if (!day) {
              return null;
            }

            const x = margin.left + (index / Math.max(days.length - 1, 1)) * plotWidth;

            return (
              <text key={day.date} x={x} y={height - 8} textAnchor="middle" className="fill-[#8a6b4b] font-mono text-[13px] tabular-nums">
                {formatScoreDateLabel(day.date)}
              </text>
            );
          })}
          {segments.map((path, index) => (
            <path
              key={index}
              data-testid={`${testId}-segment`}
              d={path}
              fill="none"
              stroke={stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={compact ? "2.4" : "3"}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {scoredPoints.map((point) => {
            const isSelected = selectedDate === point.date;
            const isInteractive = !compact && typeof onPointClick === "function";
            return (
              <circle
                key={point.date}
                cx={point.x}
                cy={point.y}
                r={compact ? "2.6" : isSelected ? "6" : "4.5"}
                fill={isSelected ? stroke : "#fffaf1"}
                stroke={stroke}
                strokeWidth={compact ? "1.8" : "2.5"}
                aria-label={compact ? undefined : resolveTrendPointLabel(point.date, point.value)}
                onClick={isInteractive ? () => onPointClick!(point.date) : undefined}
                style={isInteractive ? { cursor: "pointer" } : undefined}
                data-testid={isInteractive ? `${testId}-point-${point.date}` : undefined}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}

function ScorePointDetailCard({
  date,
  coverage,
  trendDay,
  onClose
}: {
  date: string;
  coverage: AnalysisDailyCoverageDay | null;
  trendDay: AnalysisMonthRecord["scoreTrend"]["days"][number] | null;
  onClose: () => void;
}) {
  const averageLabel = trendDay && typeof trendDay.averageScore === "number"
    ? formatScoreAverage(trendDay.averageScore)
    : null;
  const hasJournal = Boolean(coverage && (coverage.journalTitle || coverage.contentPreview));

  return (
    <div
      className="mt-3 rounded-[18px] border border-[rgba(111,74,38,0.14)] bg-[rgba(255,252,246,0.9)] px-4 py-3 shadow-sm"
      data-testid="score-trend-detail-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="archive-label">这一天</p>
          <p className="mt-1 font-display text-[1.15rem] leading-none text-[#302114]">{formatScoreDateLabel(date)}</p>
        </div>
        <div className="flex items-center gap-2">
          {averageLabel ? (
            <span className="rounded-full border border-[rgba(150,105,61,0.12)] bg-[rgba(255,252,246,0.82)] px-3 py-1 text-[0.72rem] text-[#6f5339]">
              当天均分 <span className="font-mono tabular-nums text-[#4b3727]">{averageLabel}</span>
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[rgba(150,105,61,0.12)] bg-[rgba(255,252,246,0.82)] px-2.5 py-1 text-[0.72rem] text-[#7a624b] hover:bg-[rgba(248,237,216,0.82)]"
            aria-label="关闭当日详情"
          >
            收起
          </button>
        </div>
      </div>
      {hasJournal ? (
        <div className="mt-2.5">
          {coverage?.journalTitle ? (
            <p className="text-[0.9rem] leading-6 text-[#3a2c1f]">{coverage.journalTitle}</p>
          ) : null}
          {coverage?.contentPreview ? (
            <p className="mt-1 text-pretty text-[0.8rem] leading-6 text-[#6f5339]">{coverage.contentPreview}</p>
          ) : null}
          <Link
            href={buildCalendarHref({ date, view: "day" })}
            className="mt-2 inline-flex items-center gap-1 text-[0.78rem] text-[#6f4a26] underline-offset-2 hover:underline"
          >
            查看完整日志 →
          </Link>
        </div>
      ) : (
        <div className="mt-2.5 text-[0.8rem] leading-6 text-[#7a624b]">
          这一天还没有生成日志。
          <Link
            href={buildCalendarHref({ date, view: "day" })}
            className="ml-1 text-[#6f4a26] underline-offset-2 hover:underline"
          >
            去日历看这一天 →
          </Link>
        </div>
      )}
    </div>
  );
}

function HappinessScoreTrendPanel({ record }: { record: AnalysisMonthRecord }) {
  const defaultFactor = useMemo(() => {
    return (
      [...happinessScoreItems]
        .sort((left, right) => {
          const rightAverage = record.scoreTrend.factorAverages[right.requestKey] ?? Number.NEGATIVE_INFINITY;
          const leftAverage = record.scoreTrend.factorAverages[left.requestKey] ?? Number.NEGATIVE_INFINITY;
          return rightAverage - leftAverage;
        })[0]?.requestKey ?? "meaning"
    );
  }, [record]);
  const [selectedFactor, setSelectedFactor] = useState<HappinessScoreRequestKey>(defaultFactor);
  const [inspectedDate, setInspectedDate] = useState<string | null>(null);
  const trendHighlightState = useMemo(() => getScoreTrendHighlights(record), [record]);
  const selectedItem = happinessScoreItems.find((item) => item.requestKey === selectedFactor) ?? happinessScoreItems[0];
  const selectedAverage = record.scoreTrend.factorAverages[selectedFactor];
  const inspectedCoverage = useMemo(
    () => (inspectedDate ? record.dailyCoverage.find((day) => day.date === inspectedDate) ?? null : null),
    [inspectedDate, record.dailyCoverage]
  );
  const inspectedTrendDay = useMemo(
    () => (inspectedDate ? record.scoreTrend.days.find((day) => day.date === inspectedDate) ?? null : null),
    [inspectedDate, record.scoreTrend.days]
  );

  useEffect(() => {
    setSelectedFactor(defaultFactor);
  }, [defaultFactor]);

  useEffect(() => {
    setInspectedDate(null);
  }, [record.month]);

  return (
    <div className="rounded-[22px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.34)] p-4" data-testid="happiness-score-trend-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="archive-label">趋势</p>
          <h3 className="mt-2 font-display text-[1.45rem] leading-none text-[#302114]">评分走势</h3>
          <p className="mt-2 text-pretty text-[0.84rem] leading-6 text-[#765d45]">
            {trendHighlightState.highlights.length > 0
              ? "先看总分起伏，再抓住哪几项长期偏高、哪几项经常掉下来，不急着把一条分数读成结论。"
              : "先看总分起伏。样本或差异还不够时，这里的单项快扫只当参考，不把它读成稳定结论。"}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 text-right">
          <div className="rounded-full border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.82)] px-3 py-1.5">
            <span className="text-[0.72rem] text-[#8a6b4b]">已评分 </span>
            <span className="font-mono text-[0.82rem] tabular-nums text-[#4b3727]">{record.scoreOverview.scoredDayCount} 天</span>
          </div>
          <div className="rounded-full border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.82)] px-3 py-1.5">
            <span className="text-[0.72rem] text-[#8a6b4b]">月均总分 </span>
            <span className="font-mono text-[0.82rem] tabular-nums text-[#4b3727]">{formatScoreAverage(record.scoreOverview.monthAverageScore)}</span>
          </div>
        </div>
      </div>

      {trendHighlightState.note ? (
        <div
          className="mt-4 rounded-[16px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.74)] px-3.5 py-3 text-[0.76rem] leading-6 text-[#72583f]"
          data-testid="score-trend-sample-note"
        >
          {trendHighlightState.note}
        </div>
      ) : null}

      {trendHighlightState.highlights.length > 0 ? (
        <div className="mt-4 grid gap-2 lg:grid-cols-3">
          {trendHighlightState.highlights.map((highlight) => (
            <div
              key={highlight.label}
              className="rounded-[16px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.74)] px-3.5 py-3"
            >
              <p className="text-[0.72rem] text-[#8a6b4b]">{highlight.label}</p>
              <p className="mt-1 text-[0.95rem] text-[#34271c]">{highlight.title}</p>
              <p className="mt-1 font-mono text-[0.78rem] tabular-nums text-[#6f5339]">{highlight.detail}</p>
              {highlight.context ? (
                <p className="mt-1.5 text-[0.74rem] leading-5 text-[#7a624b]">{highlight.context}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[0.86rem] text-[#3a2c1f]">总分平均走势</p>
          <p className="font-mono text-[0.76rem] tabular-nums text-[#8a6b4b]">Y 轴 1-10</p>
        </div>
        <ScoreLineChart
          days={record.scoreTrend.days}
          getValue={(day) => day.averageScore}
          ariaLabel="本月每日 8 项平均分走势，未评分日期断线"
          emptyText="本月还没有可展示的评分走势。"
          testId="score-average-trend-chart"
          onPointClick={(date) => setInspectedDate((current) => (current === date ? null : date))}
          selectedDate={inspectedDate}
        />
      </div>

      {inspectedDate ? (
        <ScorePointDetailCard
          date={inspectedDate}
          coverage={inspectedCoverage}
          trendDay={inspectedTrendDay}
          onClose={() => setInspectedDate(null)}
        />
      ) : null}

      <div className="mt-4">
        <div className="mb-2 flex items-end justify-between gap-2">
          <div>
            <p className="text-[0.86rem] text-[#3a2c1f]">8 项快扫</p>
            <p className="text-[0.76rem] text-[#8a6b4b]">先扫一遍每一项的月均和起伏，再点开想细看的那一项。</p>
          </div>
          <p className="font-mono text-[0.76rem] tabular-nums text-[#8a6b4b]">{selectedItem.label}月均 {formatScoreAverage(selectedAverage)}</p>
        </div>
        <div className="grid gap-2 md:grid-cols-2" data-testid="score-factor-grid">
          {happinessScoreItems.map((item) => {
            const active = item.requestKey === selectedFactor;
            const average = record.scoreTrend.factorAverages[item.requestKey];

            return (
              <button
                key={item.requestKey}
                type="button"
                onClick={() => setSelectedFactor(item.requestKey)}
                className={cn(
                  "rounded-[18px] border px-3 py-3 text-left transition",
                  active
                    ? "border-[rgba(111,74,38,0.22)] bg-[rgba(243,228,199,0.72)] shadow-sm ring-1 ring-[rgba(111,74,38,0.12)]"
                    : "border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.78)] hover:border-[rgba(150,105,61,0.14)] hover:bg-[rgba(248,237,216,0.62)]"
                )}
                aria-pressed={active}
                data-testid={`score-factor-button-${item.requestKey}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[0.84rem] text-[#3a2c1f]">{item.label}</span>
                  <span className="font-mono text-[0.78rem] tabular-nums text-[#6f5339]">{formatScoreAverage(average)}</span>
                </div>
                <p className="mt-1 text-pretty text-[0.72rem] leading-5 text-[#8a6b4b]">{item.description}</p>
                <div className="mt-2">
                  <ScoreLineChart
                    days={record.scoreTrend.days}
                    getValue={(day) => day.scores[item.requestKey]}
                    ariaLabel={`${item.label}评分快扫`}
                    emptyText="暂无"
                    testId={`score-factor-sparkline-${item.requestKey}`}
                    stroke={active ? "#6f4a26" : "#9e7b57"}
                    compact
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[0.86rem] text-[#3a2c1f]">单项走势</p>
            <p className="text-pretty text-[0.76rem] leading-5 text-[#8a6b4b]">{selectedItem.description}</p>
          </div>
          <p className="font-mono text-[0.76rem] tabular-nums text-[#8a6b4b]">已选：{selectedItem.label}</p>
        </div>
        <ScoreLineChart
          days={record.scoreTrend.days}
          getValue={(day) => day.scores[selectedFactor]}
          ariaLabel={`本月${selectedItem.label}评分走势，未评分日期断线`}
          emptyText={`本月还没有${selectedItem.label}评分走势。`}
          testId="score-factor-trend-chart"
        />
      </div>
    </div>
  );
}

function HappinessScorePanel({ record, onSaved }: { record: AnalysisMonthRecord; onSaved: () => void }) {
  const initialEditableDate = getPendingEditableScoreDates(record)[0] ?? record.editableDates[0] ?? null;
  const initialScores = initialEditableDate ? buildScoreFormState(record, initialEditableDate) : {};
  const [selectedDate, setSelectedDate] = useState(initialEditableDate);
  const [scores, setScores] = useState<ScoreFormState>(initialScores);
  const [selectedFactor, setSelectedFactor] = useState<HappinessScoreRequestKey>(resolvePreferredScoreFactor(initialScores));
  const [isSaving, setIsSaving] = useState(false);
  const [saveErrorCode, setSaveErrorCode] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  useEffect(() => {
    const preferredDate = getPendingEditableScoreDates(record)[0] ?? record.editableDates[0] ?? null;
    const nextDate = selectedDate && record.editableDates.includes(selectedDate) ? selectedDate : preferredDate;
    const nextScores = nextDate ? buildScoreFormState(record, nextDate) : {};

    setSelectedDate(nextDate);
    setScores(nextScores);
    setSelectedFactor(resolvePreferredScoreFactor(nextScores));
    setSaveErrorCode(null);
    setSaveNotice((current) => (nextDate === selectedDate ? current : null));
  }, [record, selectedDate]);

  if (record.editableDates.length === 0 || !selectedDate) {
    return (
      <div className="space-y-3" data-testid="happiness-score-panel">
        <HappinessScoreTrendPanel record={record} />
        <div className="rounded-[20px] border border-dashed border-[rgba(150,105,61,0.18)] bg-[rgba(255,249,239,0.32)] px-4 py-5 text-[0.9rem] leading-7 text-[#7a624b]" data-testid="happiness-score-readonly">
          这个月份现在只能查看，不能修改。评分录入只开放今天和昨天，历史月份保留为只读回看。
        </div>
      </div>
    );
  }

  const pendingEditableDates = getPendingEditableScoreDates(record);
  const hasPendingEditableDates = pendingEditableDates.length > 0;
  const completion = getScoreCompletion(scores);
  const canSave = isCompleteScoreForm(scores) && !isSaving;
  const selectedDateHasSavedScore = hasScoreRecordForDate(record, selectedDate);
  const selectedDateShortcut = resolveScoreDateShortcut(selectedDate, record.editableDates);
  const selectedItem = happinessScoreItems.find((item) => item.requestKey === selectedFactor) ?? happinessScoreItems[0];
  const selectedValue = scores[selectedFactor] ?? null;
  const selectedLevelCopy = formatScoreLevelCopy(selectedValue);
  const nextSuggestedFactor = completion.nextUnfilledFactor
    ? happinessScoreItems.find((item) => item.requestKey === completion.nextUnfilledFactor) ?? null
    : null;
  const intakeTitle = hasPendingEditableDates
    ? pendingEditableDates.length > 1
      ? "先把今天和昨天补齐，再回来看这个月"
      : `${selectedDateShortcut}还没补评分`
    : "今天和昨天的刻度都在，可以按需要微调";
  const intakeDescription = hasPendingEditableDates
    ? "这里不是写总结，只记录当天状态。把 8 项刻度补齐以后，走势会立刻更接近真实状态。"
    : "如果你想微调今天或昨天的刻度，直接改动并保存就可以，趋势会随之刷新。";
  const pendingSummaryText =
    pendingEditableDates.length === 0
      ? "今天和昨天都已补齐"
      : pendingEditableDates.length === 1
        ? `${resolveScoreDateShortcut(pendingEditableDates[0], record.editableDates)}待补`
        : `${pendingEditableDates.length} 天待补`;
  const editor = (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,0.74fr)_minmax(0,1.26fr)]">
      <aside className="rounded-[20px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.56)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="archive-label">补录入口</p>
          <span className="rounded-full border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.76)] px-2.5 py-1 text-[0.72rem] text-[#7a624b]">
            {pendingSummaryText}
          </span>
        </div>
        <h3 className="mt-3 text-balance font-display text-[1.55rem] leading-none text-[#302114]">{intakeTitle}</h3>
        <p className="mt-3 text-pretty text-[0.88rem] leading-7 text-[#72583f]">{intakeDescription}</p>

        <div className="mt-4 grid gap-2" data-testid="happiness-score-date-switch">
          {record.editableDates.map((date) => {
            const active = selectedDate === date;
            const completed = hasScoreRecordForDate(record, date);

            return (
              <button
                key={date}
                type="button"
                onClick={() => {
                  setSelectedDate(date);
                  setSaveErrorCode(null);
                  setSaveNotice(null);
                }}
                className={cn(
                  "rounded-[16px] border px-3.5 py-3 text-left transition",
                  active
                    ? "border-[rgba(111,74,38,0.22)] bg-[rgba(243,228,199,0.78)] shadow-sm ring-1 ring-[rgba(111,74,38,0.12)]"
                    : "border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.82)] hover:border-[rgba(150,105,61,0.12)] hover:bg-[rgba(250,242,229,0.86)]"
                )}
                aria-pressed={active}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.86rem] text-[#3a2c1f]">{formatEditableScoreDateLabel(date, record.editableDates)}</p>
                    <p className="mt-1 text-[0.72rem] leading-5 text-[#8a6b4b]">{completed ? "这一天已经有完整刻度" : "这一天还没补录评分"}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[0.7rem]",
                      completed ? "bg-[rgba(85,111,74,0.12)] text-[#486346]" : "bg-[rgba(183,122,58,0.14)] text-[#8a5d17]"
                    )}
                  >
                    {completed ? "已补齐" : "待补录"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-[18px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.72)] px-3.5 py-3">
          <p className="text-[0.72rem] text-[#8a6b4b]">当前日期</p>
          <p className="mt-1 text-[0.95rem] text-[#34271c]">{formatEditableScoreDateLabel(selectedDate, record.editableDates)}</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[0.72rem] text-[#8a6b4b]">填写进度</p>
              <p className="mt-1 font-mono text-[1.1rem] tabular-nums text-[#4b3727]">{completion.filledCount}/8</p>
            </div>
            <p className="max-w-[11rem] text-right text-pretty text-[0.72rem] leading-5 text-[#7a624b]">
              {completion.remainingCount === 0 ? "8 项都在，可以直接保存。" : `还差 ${completion.remainingCount} 项，先把这一天的刻度补齐。`}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[0.8rem] text-[#5d4733]">8 项列表</p>
            <p className="font-mono text-[0.72rem] tabular-nums text-[#8a6b4b]">{completion.remainingCount} 项未填</p>
          </div>
          <div className="space-y-2.5">
            {happinessScoreItems.map((item) => {
              const active = item.requestKey === selectedFactor;
              const value = scores[item.requestKey];

              return (
                <button
                  key={item.requestKey}
                  type="button"
                  onClick={() => setSelectedFactor(item.requestKey)}
                  className={cn(
                    "w-full rounded-[16px] border px-3 py-3 text-left transition",
                    active
                      ? "border-[rgba(111,74,38,0.2)] bg-[rgba(243,228,199,0.68)] shadow-sm"
                      : "border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.78)] hover:border-[rgba(150,105,61,0.12)] hover:bg-[rgba(250,242,229,0.84)]"
                  )}
                  aria-pressed={active}
                  data-testid={`score-editor-factor-${item.requestKey}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[0.84rem] text-[#3a2c1f]">{item.label}</p>
                      <p className="mt-1 text-pretty text-[0.72rem] leading-5 text-[#8a6b4b]">{item.description}</p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 font-mono text-[0.74rem] tabular-nums",
                        typeof value === "number"
                          ? "bg-[rgba(111,74,38,0.1)] text-[#5f4328]"
                          : "bg-[rgba(150,105,61,0.1)] text-[#8a6b4b]"
                      )}
                    >
                      {typeof value === "number" ? value : "待填"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <div className="rounded-[20px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.84)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="archive-label">当前要素</p>
            <h3 className="mt-2 text-balance font-display text-[1.45rem] leading-none text-[#302114]">{selectedItem.label}</h3>
            <p className="mt-2 max-w-[42rem] text-pretty text-[0.84rem] leading-6 text-[#72583f]">{selectedItem.description}</p>
          </div>
          <div className="rounded-[16px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,249,239,0.44)] px-3.5 py-3">
            <p className="text-[0.72rem] text-[#8a6b4b]">{selectedLevelCopy.label}</p>
            <p className="mt-1 max-w-[14rem] text-pretty text-[0.76rem] leading-5 text-[#6f5339]">{selectedLevelCopy.detail}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-5 gap-2 sm:grid-cols-10">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => {
            const active = selectedValue === value;

            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setScores((current) => ({
                    ...current,
                    [selectedFactor]: value
                  }));
                  setSaveErrorCode(null);
                  setSaveNotice(null);
                }}
                className={cn(
                  "h-11 rounded-[14px] border font-mono text-[0.88rem] tabular-nums transition",
                  active
                    ? "border-[rgba(111,74,38,0.24)] bg-[#6f4a26] text-[#fffaf1] shadow-sm"
                    : "border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.86)] text-[#5f4328] hover:border-[rgba(111,74,38,0.18)] hover:bg-[rgba(243,228,199,0.68)]"
                )}
                aria-pressed={active}
                aria-label={`${selectedItem.label}${value}分`}
              >
                {value}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-[0.72rem] text-[#8a6b4b]">
          <span>低</span>
          <span className="text-center text-pretty">先凭直觉给刻度，不需要在这里写解释。</span>
          <span>高</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setScores((current) => {
                const next = { ...current };
                delete next[selectedFactor];
                return next;
              });
              setSaveErrorCode(null);
              setSaveNotice(null);
            }}
            disabled={typeof selectedValue !== "number"}
            className="rounded-full border border-[rgba(150,105,61,0.12)] bg-[rgba(255,252,246,0.86)] px-3 py-1.5 text-[0.76rem] text-[#6f5339] transition hover:bg-[rgba(250,242,229,0.84)] disabled:cursor-not-allowed disabled:text-[#ab937c]"
          >
            清空这一项
          </button>
          {nextSuggestedFactor ? (
            <button
              type="button"
              onClick={() => setSelectedFactor(nextSuggestedFactor.requestKey)}
              className="rounded-full border border-[rgba(150,105,61,0.12)] bg-[rgba(255,249,239,0.62)] px-3 py-1.5 text-[0.76rem] text-[#6f5339] transition hover:bg-[rgba(243,228,199,0.58)]"
            >
              去填下一项：{nextSuggestedFactor.label}
            </button>
          ) : null}
        </div>

        <div className="mt-5 rounded-[18px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,249,239,0.4)] px-3.5 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[0.72rem] text-[#8a6b4b]">保存的是哪一天</p>
              <p className="mt-1 text-[0.92rem] text-[#3a2c1f]">{formatEditableScoreDateLabel(selectedDate, record.editableDates)}</p>
            </div>
            <div className="text-right">
              <p className="text-[0.72rem] text-[#8a6b4b]">这一天当前状态</p>
              <p className="mt-1 text-[0.92rem] text-[#3a2c1f]">{selectedDateHasSavedScore ? "已有完整刻度，可继续调整" : "还没保存完整刻度"}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.78rem] leading-6 text-[#80634a]">
              {canSave ? "8 项已填完，可以保存。" : `还差 ${completion.remainingCount} 项，全部填完后才能保存。`}
            </p>
            {saveNotice ? (
              <p className="mt-2 text-[0.76rem] text-[#486346]" role="status">
                {saveNotice}
              </p>
            ) : null}
            {saveErrorCode ? (
              <p className="mt-2 rounded-[14px] border border-[rgba(151,74,44,0.18)] bg-[rgba(255,241,232,0.62)] px-3 py-2 text-[0.82rem] text-[#8a3f25]" role="alert">
                {resolveScoreSaveErrorCopy(saveErrorCode)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="rounded-full border border-[rgba(98,66,31,0.18)] bg-[#5f3e1f] px-4 py-2 text-[0.84rem] text-[#fffaf1] transition hover:bg-[#4f3319] disabled:cursor-not-allowed disabled:border-[rgba(150,105,61,0.1)] disabled:bg-[rgba(188,163,130,0.44)] disabled:text-[#8c735b]"
          >
            {isSaving ? "保存中" : "保存评分"}
          </button>
        </div>
      </div>
    </div>
  );

  async function handleSave() {
    if (!selectedDate || !isCompleteScoreForm(scores)) {
      return;
    }

    setIsSaving(true);
    setSaveErrorCode(null);

    try {
      await saveHappinessScore(selectedDate, scores);
      setSaveNotice(`${formatEditableScoreDateLabel(selectedDate, record.editableDates)}评分已保存`);
      onSaved();
    } catch (error) {
      setSaveErrorCode(error instanceof Error ? error.message : "HAPPINESS_SCORE_SAVE_FAILED");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-3" data-testid="happiness-score-panel">
      {hasPendingEditableDates ? editor : <HappinessScoreTrendPanel record={record} />}
      {hasPendingEditableDates ? <HappinessScoreTrendPanel record={record} /> : editor}
    </div>
  );
}

function CoverageHeatmap({ record }: { record: AnalysisMonthRecord }) {
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
    <div className="space-y-3" data-testid="analysis-rhythm-board">
      <div className="rounded-[20px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.4)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="archive-label">节奏判断</p>
            <h3 className="mt-2 font-display text-[1.35rem] leading-none text-[#302114]">
              {isFutureMonth ? "这个月先不做断档判断" : "先看哪里断，再看哪里该收住"}
            </h3>
            <p className="mt-3 max-w-[44rem] text-[0.9rem] leading-7 text-[#72583f]">{buildRhythmNarrative(record, todayEntryDate)}</p>
          </div>
          <div className="grid gap-2 text-[0.72rem] text-[#7a624b] sm:grid-cols-2">
            <div className="rounded-full border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.72)] px-3 py-1.5">状态：未来 / 空白 / 只评未记 / 待整合 / 待更新 / 已整合</div>
            <div className="rounded-full border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.72)] px-3 py-1.5">密度：1维 / 2维 / 3维+</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.16fr)_minmax(18.5rem,0.84fr)]">
        <div className="space-y-3">
          <div className="rounded-[20px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.42)] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="archive-label">记录热力</p>
                <p className="mt-2 text-[0.88rem] leading-7 text-[#72583f]">状态先于密度，再顺着具体日期回到当天处理最该补的那一步。</p>
              </div>
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
                      className="h-[5.4rem] rounded-[16px] border border-dashed border-[rgba(150,105,61,0.06)] bg-[rgba(255,249,239,0.18)]"
                      aria-hidden="true"
                    />
                  );
                }

                const coverage = daysByDate.get(cell.date) ?? null;
                const state = getRhythmDayState(coverage, todayEntryDate);
                const density = Math.min(coverage?.savedDimensionCount ?? 0, 3);
                const isSelected = selectedDate === cell.date;

                const surfaceClass =
                  state === "future"
                    ? "border-dashed border-[rgba(140,117,92,0.16)] bg-[rgba(255,252,246,0.54)]"
                    : state === "score_only"
                      ? "border-[rgba(88,120,88,0.18)] bg-[rgba(238,245,236,0.92)]"
                      : state === "stale"
                        ? density >= 3
                          ? "border-[rgba(124,85,104,0.22)] bg-[rgba(226,210,221,0.94)]"
                          : density === 2
                            ? "border-[rgba(124,85,104,0.18)] bg-[rgba(239,227,236,0.94)]"
                            : "border-[rgba(124,85,104,0.16)] bg-[rgba(247,240,245,0.96)]"
                      : state === "complete"
                        ? density >= 3
                          ? "border-[rgba(69,100,74,0.22)] bg-[rgba(193,214,196,0.92)]"
                          : density === 2
                            ? "border-[rgba(69,100,74,0.18)] bg-[rgba(220,234,221,0.92)]"
                            : "border-[rgba(69,100,74,0.16)] bg-[rgba(237,244,237,0.94)]"
                        : state === "log_only"
                          ? density >= 3
                            ? "border-[rgba(111,74,38,0.22)] bg-[rgba(206,168,120,0.92)]"
                            : density === 2
                              ? "border-[rgba(111,74,38,0.18)] bg-[rgba(231,207,174,0.9)]"
                              : "border-[rgba(111,74,38,0.16)] bg-[rgba(246,231,208,0.94)]"
                          : "border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.86)]";

                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => setSelectedDate(cell.date ?? selectedDate)}
                    className={cn(
                      "group flex h-[5.4rem] flex-col rounded-[16px] border px-2.5 py-2 text-left transition hover:-translate-y-[1px]",
                      surfaceClass,
                      isSelected ? "border-[rgba(111,74,38,0.28)] ring-2 ring-[rgba(111,74,38,0.12)]" : null
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
                          state === "complete"
                            ? "bg-[rgba(69,100,74,0.12)] text-[#45644a]"
                            : state === "stale"
                              ? "bg-[rgba(124,85,104,0.12)] text-[#7c5568]"
                            : state === "log_only"
                              ? "bg-[rgba(111,74,38,0.1)] text-[#7b532d]"
                              : state === "score_only"
                                ? "bg-[rgba(88,120,88,0.12)] text-[#567256]"
                                : state === "future"
                                  ? "bg-[rgba(122,104,87,0.1)] text-[#7a6857]"
                                  : "bg-[rgba(150,105,61,0.08)] text-[#8b6c4d]"
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
          </div>

          <div className="grid gap-2 md:grid-cols-2" data-testid="analysis-rhythm-summary-bar">
            {rhythmSummaryItems.map((item) => (
              <article key={item.label} className="rounded-[16px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,249,239,0.36)] px-3 py-3">
                <p className="text-[0.7rem] text-[#8b6c4d]">{item.label}</p>
                <p className="mt-1 font-mono text-[0.88rem] tabular-nums text-[#3a2c1f]">{item.value}</p>
                <p className="mt-2 text-[0.76rem] leading-6 text-[#72583f]">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="rounded-[20px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.42)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="archive-label">当天追踪</p>
            <span className="rounded-full border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.76)] px-2 py-1 text-[0.68rem] text-[#7a624b]">
              {getRhythmStatusLabel(selectedState)}
            </span>
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
            <div className="mt-3 rounded-[14px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.68)] px-3 py-2.5" data-testid="rhythm-day-journal-preview">
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
            <div className="mt-3 rounded-[14px] border border-dashed border-[rgba(150,105,61,0.12)] bg-[rgba(255,252,246,0.4)] px-3 py-2.5" data-testid="rhythm-day-signal-preview">
              <p className="text-[0.76rem] leading-5 text-[#7a624b]">
                已有 {selectedCoverage.savedEntryCount} 条记录，但还没有整合成日志。
              </p>
            </div>
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
                <ActionLink href={buildAnalysisHref({ month: record.month, section: "score" })} label="查看评分" />
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
        </aside>
      </div>
    </div>
  );
}

function buildDimensionDrillHref(record: AnalysisMonthRecord, dimension: AnalysisDimensionInsightCard) {
  if (dimension.lastRecordedDate) {
    return buildInterviewHref({
      dimension: dimension.dimension,
      entryDate: dimension.lastRecordedDate
    });
  }

  if (record.month === getTodayEntryDate().slice(0, 7)) {
    return buildInterviewHref({
      dimension: dimension.dimension
    });
  }

  return buildCalendarHref({
    view: "month",
    date: `${record.month}-01`
  });
}

function buildDimensionAnchorHref(record: AnalysisMonthRecord, dimension: AnalysisDimensionInsightCard) {
  const anchorDate = dimension.turningPointDate ?? dimension.lastRecordedDate;

  if (!anchorDate) {
    return buildCalendarHref({
      view: "month",
      date: `${record.month}-01`
    });
  }

  return buildCalendarHref({
    view: "day",
    date: anchorDate
  });
}

function formatRelatedScoreFactorLabels(dimension: AnalysisDimensionInsightCard) {
  return dimension.relatedScoreFactors
    .map((factor) => happinessScoreItems.find((item) => item.requestKey === factor)?.label)
    .filter((label): label is string => Boolean(label));
}

function getDimensionScoreSummary(dimension: AnalysisDimensionInsightCard) {
  return dimension.scoreLink.summary;
}

function buildInsightActionItems(record: AnalysisMonthRecord, featured: AnalysisDimensionInsightCard | null) {
  const pendingDailyJournalDay = findCoverageDay(record, record.rhythmOverview.latestPendingDailyJournalDate);
  const quietDimension = interviewDimensions
    .map((dimension) => record.dimensions.find((item) => item.dimension === dimension))
    .find((item) => item?.savedEntryCount === 0) ?? null;
  const actions: Array<{ title: string; body: string; href: string; label: string }> = [];

  if (featured) {
    actions.push({
      title: `继续看${getInterviewDimensionMeta(featured.dimension).label}`,
      body: featured.thesis ?? buildDimensionSummary(featured, record.narrative),
      href: buildDimensionDrillHref(record, featured),
      label: "继续这条线"
    });
    actions.push({
      title: `回到${formatAnalysisDateLabel(featured.turningPointDate ?? featured.lastRecordedDate)}`,
      body: "先回到这一天，再看这条线是怎么慢慢成形的。",
      href: buildDimensionAnchorHref(record, featured),
      label: "看那一天"
    });
  }

  if (pendingDailyJournalDay) {
    actions.push({
      title: `整理${formatAnalysisDateLabel(pendingDailyJournalDay.date)}`,
      body: pendingDailyJournalDay.hasStaleDailyJournal
        ? "这一天的完整日志已经落后于最新来源，建议重新整理一次。"
        : "这一天已经有了几个维度，但还没有收成完整日志。",
      href: buildDailyJournalHref(pendingDailyJournalDay.date),
      label: pendingDailyJournalDay.hasStaleDailyJournal ? "更新完整日志" : "整理完整日志"
    });
  }

  if (quietDimension) {
    actions.push({
      title: `补一补${getInterviewDimensionMeta(quietDimension.dimension).label}`,
      body:
        record.month === getTodayEntryDate().slice(0, 7)
          ? "如果你想把这个月看得更完整，可以从今天先补这一维。"
          : "如果你想把这个月看得更完整，可以先回到日历里挑一天补这一维。",
      href: buildDimensionDrillHref(record, quietDimension),
      label: record.month === getTodayEntryDate().slice(0, 7) ? "去补这一维" : "回到这个月"
    });
  }

  return actions.slice(0, 3);
}

function DimensionInsights({ record }: { record: AnalysisMonthRecord }) {
  const featured = getFeaturedDimension(record);
  const orderedDimensions = interviewDimensions
    .map((dimension) => record.dimensions.find((item) => item.dimension === dimension))
    .filter((item): item is AnalysisDimensionInsightCard => Boolean(item));
  const actionItems = buildInsightActionItems(record, featured);

  if (!featured) {
    return (
      <div className="space-y-3" data-testid="analysis-dimension-cards">
        <article className="rounded-[22px] border border-dashed border-[rgba(150,105,61,0.16)] bg-[rgba(255,249,239,0.34)] p-4" data-testid="analysis-dimension-empty-state">
          <p className="archive-label">五维线索</p>
          <h3 className="mt-2 font-display text-[1.45rem] leading-none text-[#302114]">这个月还没有形成文字线索</h3>
          <p className="mt-3 text-[0.9rem] leading-7 text-[#72583f]">
            {record.scoreOverview.scoredDayCount > 0
              ? "这个月已经有评分起伏，但还没有足够的已保存记录把五维线索说清楚。"
              : "这个月还没有已保存记录，先从一个维度开始，之后这里才会慢慢长出线索。"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <ActionLink href="/interview?dimension=joy" label="开始一条记录" variant="primary" />
            <ActionLink href={buildAnalysisHref({ month: record.month, section: "score" })} label="先去补评分" />
          </div>
        </article>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {orderedDimensions.map((dimension) => (
            <article
              key={dimension.dimension}
              className="rounded-[20px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.8)] p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full border text-[0.72rem] font-medium ${getCalendarDimensionVisualMeta(dimension.dimension).softBadgeClass}`}>
                    {getCalendarDimensionVisualMeta(dimension.dimension).monthLabel}
                  </span>
                  <p className="text-[0.9rem] text-[#3a2c1f]">{getInterviewDimensionMeta(dimension.dimension).label}</p>
                </div>
                <span className="rounded-full border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.72)] px-2 py-1 text-[0.68rem] text-[#7b6146]">
                  还没展开
                </span>
              </div>
              <p className="mt-3 text-[0.82rem] leading-6 text-[#72583f]">{dimension.nextQuestion}</p>
            </article>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="analysis-dimension-cards">
      <article className="rounded-[22px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.42)] p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="archive-label">本月判断</p>
          <span className="rounded-full border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.82)] px-2.5 py-1 text-[0.72rem] text-[#7a6048]">
            主线：{getInterviewDimensionMeta(featured.dimension).label}
          </span>
        </div>
        <h3 className="mt-3 font-display text-[1.42rem] leading-none text-[#302114]">{record.insightsOverview.headline}</h3>
        <p className="mt-3 max-w-[48rem] text-pretty text-[0.9rem] leading-7 text-[#72583f]">{record.insightsOverview.summary}</p>
        {record.insightsOverview.watchpoint ? (
          <p className="mt-3 rounded-[16px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.76)] px-3.5 py-3 text-[0.82rem] leading-6 text-[#72583f]">
            还值得留意的是：{record.insightsOverview.watchpoint}
          </p>
        ) : null}
      </article>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {orderedDimensions.map((dimension) => {
          const isFeatured = dimension.dimension === featured.dimension;
          const relatedScoreFactors = formatRelatedScoreFactorLabels(dimension);
          const scoreSummary = getDimensionScoreSummary(dimension);

          return (
            <article
              key={dimension.dimension}
              data-testid={isFeatured ? `analysis-dimension-featured-${dimension.dimension}` : undefined}
              className={cn(
                "rounded-[20px] border p-4 transition",
                isFeatured
                  ? "border-[rgba(111,74,38,0.22)] bg-[rgba(243,228,199,0.54)] ring-1 ring-[rgba(111,74,38,0.12)]"
                  : "border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.8)]"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full border text-[0.72rem] font-medium ${getCalendarDimensionVisualMeta(dimension.dimension).softBadgeClass}`}>
                    {getCalendarDimensionVisualMeta(dimension.dimension).monthLabel}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[0.92rem] text-[#3a2c1f]">{getInterviewDimensionMeta(dimension.dimension).label}</p>
                    <p className="text-[0.7rem] text-[#8b6c4d]">
                      {dimension.recordedDayCount > 0 ? `${dimension.recordedDayCount} 天有记录` : "本月还没有记录"}
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.72)] px-2 py-1 text-[0.68rem] text-[#7b6146]">
                  {isFeatured ? "这月更清楚" : getDimensionConfidenceLabel(dimension)}
                </span>
              </div>

              <p className="mt-3 min-h-[4.5rem] text-[0.84rem] leading-6 text-[#4a3928]">{buildDimensionSummary(dimension, record.narrative)}</p>

              <div className="mt-3 space-y-1.5 text-[0.72rem] leading-5 text-[#80634a]">
                <p>{getDimensionMomentumLabel(dimension)}</p>
                <p>{getDimensionContinuityLabel(dimension)}</p>
                <p>
                  {dimension.turningPointDate
                    ? `更像在 ${formatAnalysisDateLabel(dimension.turningPointDate)} 这天成形`
                    : "还没有明显的转折点"}
                </p>
              </div>

              {dimension.evidence.length > 0 ? (
                <div className="mt-3 rounded-[16px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,249,239,0.46)] px-3 py-3">
                  <p className="text-[0.7rem] text-[#8b6c4d]">代表片段</p>
                  <div className="mt-2 space-y-2">
                    {dimension.evidence.slice(0, 2).map((evidence) => (
                      <div key={evidence.entryId}>
                        <p className="text-[0.76rem] leading-5 text-[#4a3928]">{evidence.summary}</p>
                        {evidence.detail ? <p className="mt-0.5 text-[0.72rem] leading-5 text-[#7a624b]">{evidence.detail}</p> : null}
                        {evidence.date ? (
                          <Link
                            href={buildCalendarHref({ date: evidence.date, view: "day" })}
                            className="mt-1 inline-flex text-[0.7rem] text-[#6f4a26] underline-offset-2 hover:underline"
                          >
                            {formatScoreDateLabel(evidence.date)} →
                          </Link>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-[16px] border border-dashed border-[rgba(150,105,61,0.12)] bg-[rgba(255,249,239,0.34)] px-3 py-3 text-[0.74rem] leading-5 text-[#7a624b]">
                  这条线还在起笔，先不用急着下结论。
                </div>
              )}

              <div className="mt-3 space-y-2">
                {relatedScoreFactors.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {relatedScoreFactors.map((label) => (
                      <span key={label} className="rounded-full border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.8)] px-2 py-0.5 text-[0.68rem] text-[#6f5339]">
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
                {dimension.relatedDimensions.length > 0 ? (
                  <p className="text-[0.72rem] leading-5 text-[#7a624b]">
                    常一起动：{dimension.relatedDimensions.map((related) => getInterviewDimensionMeta(related).label).join("、")}
                  </p>
                ) : null}
                {scoreSummary ? (
                  <p className="text-[0.72rem] leading-5 text-[#7a624b]">评分里：{scoreSummary}</p>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <ActionLink
                  href={buildDimensionDrillHref(record, dimension)}
                  label={dimension.savedEntryCount > 0 ? "继续这条线" : "去补这一维"}
                  variant={isFeatured || dimension.savedEntryCount > 0 ? "primary" : "secondary"}
                />
                <ActionLink href={buildDimensionAnchorHref(record, dimension)} label={dimension.savedEntryCount > 0 ? "看那一天" : "回到这个月"} />
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <article className="rounded-[22px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.42)] p-4">
          <p className="archive-label">维度之间</p>
          <h3 className="mt-2 font-display text-[1.3rem] leading-none text-[#302114]">别只看哪条写得多，也看它和谁连在一起，和评分怎么接上</h3>
          {record.insightsOverview.links.length > 0 ? (
            <div className="mt-4 grid gap-2.5">
              {record.insightsOverview.links.map((link, index) => (
                <div key={`${link.type}-${index}`} className="rounded-[18px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.78)] px-3.5 py-3">
                  <p className="text-[0.74rem] text-[#8b6c4d]">{link.title}</p>
                  <p className="mt-1 text-[0.84rem] leading-6 text-[#4a3928]">{link.detail}</p>
                  {link.anchorDate ? (
                    <div className="mt-3">
                      <ActionLink href={buildCalendarHref({ view: "day", date: link.anchorDate })} label="回到那一天" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-[18px] border border-dashed border-[rgba(150,105,61,0.12)] bg-[rgba(255,252,246,0.76)] px-3.5 py-3 text-[0.84rem] leading-6 text-[#72583f]">
              这个月的材料还不够多，先把五条线各自写清楚，关系层才会慢慢出现。
            </p>
          )}
        </article>

        <article className="rounded-[22px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.42)] p-4">
          <p className="archive-label">下一步</p>
          <h3 className="mt-2 font-display text-[1.3rem] leading-none text-[#302114]">先做哪一步，最容易把这个月看清楚</h3>
          <div className="mt-4 grid gap-2.5">
            {actionItems.map((action) => (
              <div key={action.title} className="rounded-[18px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.78)] px-3.5 py-3">
                <p className="text-[0.86rem] text-[#3a2c1f]">{action.title}</p>
                <p className="mt-1 text-[0.8rem] leading-6 text-[#72583f]">{action.body}</p>
                <div className="mt-3">
                  <ActionLink href={action.href} label={action.label} variant="primary" />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}

function NarrativeInsightCard({
  card
}: {
  card: AnalysisInsightCardItem;
}) {
  return (
    <article className="rounded-[18px] border border-[rgba(150,105,61,0.12)] bg-[rgba(255,249,239,0.4)] p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[rgba(150,105,61,0.12)] bg-[rgba(255,252,246,0.78)] px-2.5 py-1 text-[0.7rem] text-[#7a6048]">
          {card.type}
        </span>
        <p className="text-[0.84rem] font-medium text-[#3a2c1f]">{card.title}</p>
      </div>
      <p className="mt-2 text-[0.82rem] leading-6 text-[#5f4b36]">{card.evidence}</p>
      {card.linkedDates.length > 0 ? (
        <p className="mt-2 text-[0.74rem] text-[#8b6c4d]">
          关联日期：{card.linkedDates.map((date) => formatAnalysisDateLabel(date)).join("、")}
        </p>
      ) : null}
    </article>
  );
}

function OverviewAnchorCTA({ record }: { record: AnalysisMonthRecord }) {
  const recordedDayCount = record.logOverview.recordedDayCount;
  const scoredDayCount = record.scoreOverview.scoredDayCount;
  const featuredLabel = record.insightsOverview.featuredDimension
    ? getInterviewDimensionMeta(record.insightsOverview.featuredDimension).label
    : null;
  const longestStreak = record.rhythmOverview.longestStreak?.length ?? 0;

  if (recordedDayCount === 0 && scoredDayCount === 0) {
    return null;
  }

  const parts = [
    `${recordedDayCount} 天记录`,
    `${scoredDayCount} 天评分`,
    featuredLabel ? `主线维度：${featuredLabel}` : null,
    longestStreak > 0 ? `最长连续 ${longestStreak} 天` : null
  ].filter((part): part is string => Boolean(part));

  return (
    <p className="text-[0.78rem] leading-6 text-[#8b6c4d]">{parts.join(" · ")}</p>
  );
}

export function AnalysisShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const todayMonth = getTodayAnalysisMonth();
  const normalizedSearch = normalizeAnalysisSearchParams({
    month: searchParams.get("month"),
    section: searchParams.get("section"),
    today: todayMonth
  });
  const [record, setRecord] = useState<AnalysisMonthRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetchError, setHasFetchError] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [activeSection, setActiveSection] = useState<AnalysisSectionKey>(normalizedSearch.section);

  useEffect(() => {
    if (normalizedSearch.shouldReplace) {
      router.replace(normalizedSearch.href, { scroll: false });
    }
  }, [normalizedSearch.href, normalizedSearch.shouldReplace, router]);

  useEffect(() => {
    setActiveSection(normalizedSearch.section);
  }, [normalizedSearch.section]);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setHasFetchError(false);
    setRecord(null);

    void fetchAnalysisMonth(normalizedSearch.month)
      .then((nextRecord) => {
        if (!cancelled) {
          setRecord(nextRecord);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasFetchError(true);
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
  }, [normalizedSearch.month, refreshNonce]);

  return (
    <section className="page-shell min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 md:px-8 md:py-8 xl:px-10" data-testid="analysis-workspace">
      <div className="relative z-10">
        <div className="paper-sheet rounded-[28px] px-5 py-5 md:px-6 md:py-6">
          {activeSection === "overview" && (
            <AnalysisSection
              index="01"
              eyebrow="总览"
              title="这个月先看什么"
              description="不把分析页做成一排指标卡，而是先给出这个月最值得继续看的入口。"
              testId="analysis-overview-placeholder"
            >
              {hasFetchError ? (
                <AnalysisEmptyBanner title="本月概览暂时没打开" body="稍后再试，或者刷新页面重新拉取这个月的数据。" />
              ) : isLoading || !record ? (
                <SectionSkeleton />
              ) : (
                <>
                  <SummaryHero record={record} month={normalizedSearch.month} />
                  {record.narrative?.insightCards && record.narrative.insightCards.length > 0 && (
                    <div className="mt-5">
                      {record.narrative.insightCards.map((card, i) => (
                        <NarrativeInsightCard key={i} card={card} />
                      ))}
                    </div>
                  )}
                  <div className="mt-4">
                    <OverviewAnchorCTA record={record} />
                  </div>
                </>
              )}
            </AnalysisSection>
          )}

          {activeSection === "score" && (
            <AnalysisSection
              index="02"
              eyebrow="评分入口"
              title="幸福 8 要素评分"
              description="先看走势，再补今天和昨天。评分在这里是刻度，不是结论。"
              testId="analysis-score-placeholder"
            >
              {hasFetchError ? (
                <AnalysisEmptyBanner title="幸福评分暂时没打开" body="稍后再试，或者刷新页面重新拉取这个月的数据。" />
              ) : isLoading || !record ? (
                <SectionSkeleton blocks={3} />
              ) : (
                <HappinessScorePanel
                  record={record}
                  onSaved={() => {
                    setRefreshNonce((value) => value + 1);
                    notifyAnalysisToolbarRefresh(normalizedSearch.month);
                  }}
                />
              )}
            </AnalysisSection>
          )}

          {activeSection === "rhythm" && (
            <AnalysisSection
              index="03"
              eyebrow="记录节奏"
              title="记录热力图"
              description="用热力图先看密度，再点进某一天，把分析页和当天记录重新接起来。"
              testId="analysis-coverage-placeholder"
            >
              {hasFetchError ? (
                <AnalysisEmptyBanner title="记录节奏暂时没打开" body="重新加载后再看本月的热力分布。" />
              ) : isLoading || !record ? (
                <SectionSkeleton blocks={2} />
              ) : (
                <CoverageHeatmap record={record} />
              )}
            </AnalysisSection>
          )}

          {activeSection === "insights" && (
            <AnalysisSection
              index="04"
              eyebrow="五维线索"
              title="五维洞察"
              description="先抓住本月更成形的一条线，其余维度再分成正在浮现和暂时安静。"
              testId="analysis-dimensions-placeholder"
            >
              {hasFetchError ? (
                <AnalysisEmptyBanner title="五维洞察暂时没打开" body="重新加载后再看这个月的维度线索。" />
              ) : isLoading || !record ? (
                <SectionSkeleton blocks={2} />
              ) : (
                <DimensionInsights record={record} />
              )}
            </AnalysisSection>
          )}
        </div>
      </div>
    </section>
  );
}
