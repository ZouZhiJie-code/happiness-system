"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type {
  AnalysisDailyCoverageDay,
  AnalysisDimensionInsightCard,
  AnalysisMonthRecord
} from "@/features/analysis/types";
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

const sectionTabs: Array<{ key: AnalysisSectionKey; label: string; description: string }> = [
  { key: "overview", label: "总览", description: "这个月先看什么" },
  { key: "score", label: "评分", description: "先看走势，再补今天和昨天" },
  { key: "rhythm", label: "节奏", description: "看清这个月密与空的分布" },
  { key: "insights", label: "五维", description: "找到本月最值得继续的一条线" }
];

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
    description: "今天做的事是否和我在乎的方向有关"
  },
  {
    requestKey: "health",
    recordKey: "healthScore",
    label: "健康",
    description: "身体、睡眠和精力是否被照顾到"
  },
  {
    requestKey: "virtue",
    recordKey: "virtueScore",
    label: "德行",
    description: "我是否做出了自己认可的选择"
  },
  {
    requestKey: "autonomy",
    recordKey: "autonomyScore",
    label: "自主",
    description: "我是否保有选择感和掌控感"
  },
  {
    requestKey: "interest",
    recordKey: "interestScore",
    label: "兴趣",
    description: "有没有被好奇、喜欢或投入感点亮"
  },
  {
    requestKey: "skill",
    recordKey: "skillScore",
    label: "技能",
    description: "有没有练到能力或看见进步"
  },
  {
    requestKey: "relationship",
    recordKey: "relationshipScore",
    label: "关系",
    description: "是否感到连接、支持或被理解"
  },
  {
    requestKey: "livingCondition",
    recordKey: "livingConditionScore",
    label: "生活条件",
    description: "环境、秩序和现实条件是否托住了我"
  }
];

type ScoreFormState = Partial<Record<HappinessScoreRequestKey, number>>;

interface DateSpan {
  startDate: string;
  endDate: string;
  length: number;
}

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
    throw new Error("HAPPINESS_SCORE_SAVE_FAILED");
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

function resolveTrendPointLabel(date: string, value: number) {
  return `${formatScoreDateLabel(date)} ${value.toFixed(1)}分`;
}

function getActiveDays(record: AnalysisMonthRecord) {
  return record.dailyCoverage.filter((day) => day.savedDimensionCount > 0 || day.hasDailyJournalSaved);
}

function getHighestDensityDay(record: AnalysisMonthRecord) {
  return record.dailyCoverage.reduce<AnalysisDailyCoverageDay | null>((best, day) => {
    if (day.savedDimensionCount <= 0) {
      return best;
    }

    if (!best || day.savedDimensionCount > best.savedDimensionCount || (day.savedDimensionCount === best.savedDimensionCount && day.date > best.date)) {
      return day;
    }

    return best;
  }, null);
}

function getLatestActiveDay(record: AnalysisMonthRecord) {
  return [...getActiveDays(record)].sort((left, right) => right.date.localeCompare(left.date))[0] ?? null;
}

function buildLongestSpan(days: AnalysisDailyCoverageDay[], predicate: (day: AnalysisDailyCoverageDay) => boolean): DateSpan | null {
  let best: DateSpan | null = null;
  let currentStart: string | null = null;
  let currentEnd: string | null = null;
  let currentLength = 0;

  for (const day of days) {
    if (predicate(day)) {
      currentStart ??= day.date;
      currentEnd = day.date;
      currentLength += 1;
      continue;
    }

    if (currentStart && currentEnd) {
      if (!best || currentLength > best.length) {
        best = {
          startDate: currentStart,
          endDate: currentEnd,
          length: currentLength
        };
      }
    }

    currentStart = null;
    currentEnd = null;
    currentLength = 0;
  }

  if (currentStart && currentEnd && (!best || currentLength > best.length)) {
    best = {
      startDate: currentStart,
      endDate: currentEnd,
      length: currentLength
    };
  }

  return best;
}

function formatSpanLabel(span: DateSpan | null) {
  if (!span) {
    return "暂无";
  }

  if (span.length === 1) {
    return `${formatAnalysisDateLabel(span.startDate)}，1天`;
  }

  return `${formatAnalysisDateLabel(span.startDate)} - ${formatAnalysisDateLabel(span.endDate)}，${span.length}天`;
}

function buildOverviewNarrative(record: AnalysisMonthRecord) {
  const featuredDimension = getFeaturedDimension(record);
  const hottestDay = getHighestDensityDay(record);

  if (record.logOverview.savedEntryCount === 0 && record.scoreOverview.scoredDayCount === 0) {
    return "这个月还没有开始留下分析材料。先补今天评分，或从一个维度开始记录。";
  }

  if (record.logOverview.savedEntryCount === 0) {
    return `这个月已经有 ${record.scoreOverview.scoredDayCount} 天评分轨迹，但还没有形成可回看的文字线索。`;
  }

  if (!featuredDimension) {
    return `这个月已经留下 ${record.logOverview.savedEntryCount} 篇记录，可以先顺着热力图找到更密的那几天继续看。`;
  }

  const featuredLabel = getInterviewDimensionMeta(featuredDimension.dimension).label;
  const hottestDayLabel = hottestDay ? formatAnalysisDateLabel(hottestDay.date) : "最近几次记录";

  return `${featuredLabel}是这个月最清晰的一条主线，${featuredDimension.recordedDayCount}天留下记录；从${hottestDayLabel}往回看，最容易看见这个月真正成形的内容。`;
}

function getFeaturedDimension(record: AnalysisMonthRecord) {
  return [...record.dimensions]
    .filter((dimension) => dimension.savedEntryCount > 0)
    .sort((left, right) => {
      if (right.savedEntryCount !== left.savedEntryCount) {
        return right.savedEntryCount - left.savedEntryCount;
      }

      if (right.recordedDayCount !== left.recordedDayCount) {
        return right.recordedDayCount - left.recordedDayCount;
      }

      return (right.lastRecordedDate ?? "").localeCompare(left.lastRecordedDate ?? "");
    })[0] ?? null;
}

function buildDimensionSummary(dimension: AnalysisDimensionInsightCard) {
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
      ? "inline-flex items-center justify-center rounded-full border border-[rgba(98,66,31,0.18)] bg-[#5f3e1f] px-3.5 py-2 text-[0.8rem] text-[#fffaf1] transition hover:bg-[#4f3319]"
      : "inline-flex items-center justify-center rounded-full border border-[rgba(150,105,61,0.12)] bg-[rgba(255,252,246,0.78)] px-3 py-1.5 text-[0.78rem] text-[#65472a] transition hover:bg-[rgba(255,252,246,0.94)]";

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

function SectionAnchorNav({
  currentSection,
  onChange,
  record
}: {
  currentSection: AnalysisSectionKey;
  onChange: (section: AnalysisSectionKey) => void;
  record: AnalysisMonthRecord | null;
}) {
  const todayHasScore = record ? record.scoreRecords.some((s) => s.date === record.editableDates[0]) : null;
  const activeDayCount = record ? getActiveDays(record).length : null;
  const featured = record ? getFeaturedDimension(record) : null;

  function getChip(key: AnalysisSectionKey) {
    if (!record) return null;

    if (key === "score") {
      if (record.editableDates.length === 0) return null;
      return todayHasScore
        ? { text: "已评", dotClass: "bg-[#5a7a56]" }
        : { text: "今天未评", dotClass: "bg-[#b87a3a]" };
    }

    if (key === "rhythm") {
      return activeDayCount !== null ? { text: `${activeDayCount}天`, dotClass: null } : null;
    }

    if (key === "insights") {
      return featured
        ? { text: getInterviewDimensionMeta(featured.dimension).label, dotClass: null }
        : null;
    }

    return null;
  }

  return (
    <nav
      className="sticky top-[calc(var(--site-header-viewport-offset)+0.75rem)] z-20 rounded-[20px] border border-[rgba(150,105,61,0.1)] bg-[rgba(248,233,204,0.92)] px-2 py-2 backdrop-blur-sm"
      data-testid="analysis-section-nav"
      aria-label="分析页内导航"
    >
      <div className="flex flex-wrap items-center gap-2">
        {sectionTabs.map((tab) => {
          const active = tab.key === currentSection;
          const chip = getChip(tab.key);

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-[0.8rem] transition ${
                active
                  ? "bg-[#6f4a26] text-[#fffaf1] shadow-sm"
                  : "bg-[rgba(255,252,246,0.78)] text-[#6b533d] hover:bg-[rgba(255,251,244,0.96)]"
              }`}
              aria-pressed={active}
            >
              {tab.label}
              {chip ? (
                <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.68rem] ${
                  active ? "bg-[rgba(255,250,241,0.2)] text-[rgba(255,250,241,0.88)]" : "bg-[rgba(111,74,38,0.08)] text-[#8b6c4d]"
                }`}>
                  {chip.dotClass ? <span className={`size-1.5 rounded-full ${chip.dotClass}`} /> : null}
                  {chip.text}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function SummaryHero({ record, month }: { record: AnalysisMonthRecord | null; month: string }) {
  const featured = record ? getFeaturedDimension(record) : null;
  const hottestDay = record ? getHighestDensityDay(record) : null;
  const todayEditableDate = record?.editableDates[0] ?? null;
  const activeDayCount = record ? getActiveDays(record).length : 0;
  const longestStreak = record ? buildLongestSpan(record.dailyCoverage, (day) => day.savedDimensionCount > 0 || day.hasDailyJournalSaved) : null;
  const todayHasScore = record ? record.scoreRecords.some((s) => s.date === record.editableDates[0]) : false;

  return (
    <div data-testid="analysis-month-hero">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-[1.8rem] leading-none text-[#2f2419] md:text-[2.2rem]">
          {formatAnalysisMonthLabel(month)}
        </h1>
        <p className="max-w-[38rem] text-pretty text-[0.9rem] leading-7 text-[#6a533c]">
          {record
            ? buildOverviewNarrative(record)
            : "加载中..."}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3" data-testid="analysis-status-board">
        <article className="rounded-[22px] border border-[rgba(150,105,61,0.12)] bg-[linear-gradient(135deg,rgba(255,249,239,0.92),rgba(243,228,199,0.78))] px-4 py-4">
          <p className="text-[0.72rem] font-medium uppercase tracking-wide text-[#8b6c4d]">评分状态</p>
          <p className="mt-2 font-mono text-[1.2rem] tabular-nums leading-none text-[#302114]">
            {record ? `已评 ${record.scoreOverview.scoredDayCount} 天` : "—"}
          </p>
          <p className="mt-1 font-mono text-[0.78rem] tabular-nums text-[#6f5339]">
            {record ? `月均 ${formatScoreAverage(record.scoreOverview.monthAverageScore)}` : ""}
          </p>
          <p className="mt-2 text-[0.82rem] leading-6 text-[#72583f]">
            {todayEditableDate
              ? todayHasScore
                ? "今天已评分。"
                : "今天还没评分。"
              : "本月只读。"}
          </p>
          <div className="mt-3">
            {todayEditableDate && !todayHasScore ? (
              <ActionLink href={buildAnalysisHref({ month, section: "score" })} label="去补评分" variant="primary" />
            ) : (
              <ActionLink href={buildAnalysisHref({ month, section: "score" })} label="查看走势" />
            )}
          </div>
        </article>

        <article className="rounded-[22px] border border-[rgba(150,105,61,0.12)] bg-[linear-gradient(135deg,rgba(255,249,239,0.88),rgba(240,225,198,0.72))] px-4 py-4">
          <p className="text-[0.72rem] font-medium uppercase tracking-wide text-[#8b6c4d]">记录节奏</p>
          <p className="mt-2 font-mono text-[1.2rem] tabular-nums leading-none text-[#302114]">
            {record ? `${activeDayCount} 天有记录` : "—"}
          </p>
          <p className="mt-1 font-mono text-[0.78rem] tabular-nums text-[#6f5339]">
            {longestStreak ? `最长连续 ${longestStreak.length} 天` : "尚无连续"}
          </p>
          <p className="mt-2 text-[0.82rem] leading-6 text-[#72583f]">
            {hottestDay ? `最密：${formatAnalysisDateLabel(hottestDay.date)}，${hottestDay.savedDimensionCount} 维` : "还没有明显高点。"}
          </p>
          <div className="mt-3">
            {hottestDay ? (
              <ActionLink href={buildCalendarHref({ view: "day", date: hottestDay.date })} label="查看最密日" variant="primary" />
            ) : (
              <ActionLink href={buildAnalysisHref({ month, section: "rhythm" })} label="查看分布" />
            )}
          </div>
        </article>

        <article className="rounded-[22px] border border-[rgba(150,105,61,0.12)] bg-[linear-gradient(135deg,rgba(255,249,239,0.88),rgba(237,220,193,0.72))] px-4 py-4">
          <p className="text-[0.72rem] font-medium uppercase tracking-wide text-[#8b6c4d]">主线维度</p>
          <p className="mt-2 font-mono text-[1.2rem] tabular-nums leading-none text-[#302114]">
            {featured ? `${getInterviewDimensionMeta(featured.dimension).label} · ${featured.savedEntryCount} 篇` : "尚未形成"}
          </p>
          <p className="mt-1 font-mono text-[0.78rem] tabular-nums text-[#6f5339]">
            {featured ? `覆盖 ${featured.recordedDayCount} 天` : ""}
          </p>
          <p className="mt-2 text-[0.82rem] leading-6 text-[#72583f]">
            {featured
              ? `最近：${formatAnalysisDateLabel(featured.lastRecordedDate)}`
              : "先留下一条可回看的记录。"}
          </p>
          <div className="mt-3">
            {featured ? (
              <ActionLink
                href={buildInterviewHref({ dimension: featured.dimension, entryDate: featured.lastRecordedDate })}
                label={`回到${getInterviewDimensionMeta(featured.dimension).label}`}
                variant="primary"
              />
            ) : (
              <ActionLink href="/interview?dimension=joy" label="开始记录" variant="primary" />
            )}
          </div>
        </article>
      </div>
    </div>
  );
}

function OverviewCards({ record }: { record: AnalysisMonthRecord }) {
  const featured = getFeaturedDimension(record);
  const hottestDay = getHighestDensityDay(record);
  const items = [
    {
      id: "recorded-days",
      label: "有记录天数",
      value: `${record.logOverview.recordedDayCount}`,
      detail: "至少有一篇已保存维度日志的天数",
      action: hottestDay ? { href: buildCalendarHref({ view: "day", date: hottestDay.date }), label: "查看最密的一天" } : null
    },
    {
      id: "score-days",
      label: "已评分天数",
      value: `${record.scoreOverview.scoredDayCount}`,
      detail: "幸福 8 要素留下刻度的天数",
      action: { href: buildAnalysisHref({ month: record.month, section: "score" }), label: "回到评分走势" }
    },
    {
      id: "daily-journals",
      label: "整合日志完成天数",
      value: `${record.logOverview.dailyJournalSavedDayCount}`,
      detail: "当天整合日志已经正式保存的天数",
      action: null
    },
    {
      id: "featured-dimension",
      label: "主线维度",
      value: featured ? getInterviewDimensionMeta(featured.dimension).label : "暂无",
      detail: featured ? `${featured.recordedDayCount} 天留下记录` : "这个月还没有形成稳定主线",
      action: featured
        ? {
            href: buildInterviewHref({ dimension: featured.dimension, entryDate: featured.lastRecordedDate }),
            label: `回到${getInterviewDimensionMeta(featured.dimension).label}`
          }
        : null
    }
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="analysis-overview-cards">
      {items.map((item) => (
        <article key={item.id} className="rounded-[20px] border border-[rgba(150,105,61,0.12)] bg-[rgba(255,249,239,0.44)] px-4 py-4">
          <p className="text-[0.76rem] text-[#8a6b4b]">{item.label}</p>
          <p className="mt-2 font-display text-[1.9rem] leading-none text-[#302114]">{item.value}</p>
          <p className="mt-2 text-pretty text-[0.82rem] leading-6 text-[#7a624b]">{item.detail}</p>
          {item.action ? (
            <div className="mt-3">
              <ActionLink href={item.action.href} label={item.action.label} />
            </div>
          ) : null}
        </article>
      ))}
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
  compact = false
}: {
  days: AnalysisMonthRecord["scoreTrend"]["days"];
  getValue: (day: AnalysisMonthRecord["scoreTrend"]["days"][number]) => number | null;
  ariaLabel: string;
  emptyText: string;
  testId: string;
  stroke?: string;
  compact?: boolean;
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
          {scoredPoints.map((point) => (
            <circle
              key={point.date}
              cx={point.x}
              cy={point.y}
              r={compact ? "2.6" : "4.5"}
              fill="#fffaf1"
              stroke={stroke}
              strokeWidth={compact ? "1.8" : "2.5"}
              aria-label={compact ? undefined : resolveTrendPointLabel(point.date, point.value)}
            />
          ))}
        </svg>
      )}
    </div>
  );
}

function HappinessScoreTrendPanel({ record }: { record: AnalysisMonthRecord }) {
  const [selectedFactor, setSelectedFactor] = useState<HappinessScoreRequestKey>("meaning");
  const selectedItem = happinessScoreItems.find((item) => item.requestKey === selectedFactor) ?? happinessScoreItems[0];
  const selectedAverage = record.scoreTrend.factorAverages[selectedFactor];

  return (
    <div className="rounded-[22px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.34)] p-4" data-testid="happiness-score-trend-panel">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="archive-label">趋势</p>
          <h3 className="mt-2 font-display text-[1.45rem] leading-none text-[#302114]">评分走势</h3>
          <p className="mt-2 text-[0.84rem] leading-6 text-[#765d45]">先看总分起伏，再扫一眼 8 项里哪些长期偏高、哪些经常掉下来。</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right">
          <div className="rounded-[14px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.76)] px-3 py-2">
            <p className="text-[0.72rem] text-[#8a6b4b]">已评分</p>
            <p className="mt-1 font-mono text-[1rem] tabular-nums text-[#4b3727]">{record.scoreOverview.scoredDayCount} 天</p>
          </div>
          <div className="rounded-[14px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.76)] px-3 py-2">
            <p className="text-[0.72rem] text-[#8a6b4b]">月均总分</p>
            <p className="mt-1 font-mono text-[1rem] tabular-nums text-[#4b3727]">{formatScoreAverage(record.scoreOverview.monthAverageScore)}</p>
          </div>
        </div>
      </div>

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
        />
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-end justify-between gap-2">
          <div>
            <p className="text-[0.86rem] text-[#3a2c1f]">8 项快扫</p>
            <p className="text-[0.76rem] text-[#8a6b4b]">先扫一遍月均，再点开想细看的那一项。</p>
          </div>
          <p className="font-mono text-[0.76rem] tabular-nums text-[#8a6b4b]">{selectedItem.label}月均 {formatScoreAverage(selectedAverage)}</p>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4" data-testid="score-factor-grid">
          {happinessScoreItems.map((item) => {
            const active = item.requestKey === selectedFactor;
            const average = record.scoreTrend.factorAverages[item.requestKey];

            return (
              <button
                key={item.requestKey}
                type="button"
                onClick={() => setSelectedFactor(item.requestKey)}
                className={`rounded-[18px] border px-3 py-3 text-left transition ${
                  active
                    ? "border-[rgba(111,74,38,0.26)] border-l-[3px] border-l-[#6f4a26] bg-[rgba(243,228,199,0.72)] shadow-sm"
                    : "border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.78)] hover:border-[rgba(150,105,61,0.14)] hover:bg-[rgba(248,237,216,0.62)]"
                }`}
                aria-pressed={active}
                data-testid={`score-factor-button-${item.requestKey}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[0.84rem] text-[#3a2c1f]">{item.label}</span>
                  <span className="font-mono text-[0.78rem] tabular-nums text-[#6f5339]">{formatScoreAverage(average)}</span>
                </div>
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
            <p className="text-[0.76rem] text-[#8a6b4b]">{selectedItem.description}</p>
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
  const [selectedDate, setSelectedDate] = useState(record.editableDates[0] ?? null);
  const [scores, setScores] = useState<ScoreFormState>(() => (record.editableDates[0] ? buildScoreFormState(record, record.editableDates[0]) : {}));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    const nextDate = selectedDate && record.editableDates.includes(selectedDate) ? selectedDate : record.editableDates[0] ?? null;

    setSelectedDate(nextDate);
    setScores(nextDate ? buildScoreFormState(record, nextDate) : {});
    setSaveError(false);
  }, [record, selectedDate]);

  if (record.editableDates.length === 0 || !selectedDate) {
    return (
      <div className="space-y-3" data-testid="happiness-score-panel">
        <HappinessScoreTrendPanel record={record} />
        <div className="rounded-[20px] border border-dashed border-[rgba(150,105,61,0.18)] bg-[rgba(255,249,239,0.32)] px-4 py-5 text-[0.9rem] leading-7 text-[#7a624b]" data-testid="happiness-score-readonly">
          这个月份的评分只能查看，不能修改。评分录入只开放今天和昨天。
        </div>
      </div>
    );
  }

  const canSave = isCompleteScoreForm(scores) && !isSaving;

  async function handleSave() {
    if (!selectedDate || !isCompleteScoreForm(scores)) {
      return;
    }

    setIsSaving(true);
    setSaveError(false);

    try {
      await saveHappinessScore(selectedDate, scores);
      onSaved();
    } catch {
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-3" data-testid="happiness-score-panel">
      <HappinessScoreTrendPanel record={record} />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.68fr)_minmax(0,1.32fr)]">
        <aside className="rounded-[20px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.56)] p-4">
          <p className="archive-label">补录入口</p>
          <h3 className="mt-3 text-balance font-display text-[1.55rem] leading-none text-[#302114]">先把刻度补齐，再回来看这个月</h3>
          <p className="mt-3 text-pretty text-[0.88rem] leading-7 text-[#72583f]">这里不是写总结，只记录当天状态。补完 8 项后保存，趋势会立即刷新。</p>

          {record.editableDates.length > 1 ? (
            <div className="mt-4 flex rounded-full border border-[rgba(150,105,61,0.12)] bg-[rgba(255,249,239,0.62)] p-1" data-testid="happiness-score-date-switch">
              {record.editableDates.map((date) => (
                <button
                  key={date}
                  type="button"
                  onClick={() => {
                    setSelectedDate(date);
                    setScores(buildScoreFormState(record, date));
                    setSaveError(false);
                  }}
                  className={`flex-1 rounded-full px-3 py-2 text-[0.8rem] transition ${
                    selectedDate === date ? "bg-[#6f4a26] text-[#fffaf1] shadow-sm" : "text-[#7a6048] hover:bg-[rgba(255,252,246,0.84)]"
                  }`}
                  aria-pressed={selectedDate === date}
                >
                  {resolveScoreDateShortcut(date, record.editableDates)}
                </button>
              ))}
            </div>
          ) : null}

          <p className="mt-3 font-mono text-[0.76rem] tabular-nums text-[#8a6b4b]">当前日期：{formatScoreDateLabel(selectedDate)}</p>
        </aside>

        <div className="rounded-[20px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.82)] p-3.5">
          <div className="space-y-2.5">
            {happinessScoreItems.map((item) => {
              const value = scores[item.requestKey];
              const sliderValue = value ?? 5;

              return (
                <label key={item.requestKey} className="grid gap-3 rounded-[16px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,249,239,0.42)] px-3.5 py-3 md:grid-cols-[8rem_minmax(0,1fr)_3.5rem] md:items-center">
                  <span className="min-w-0">
                    <span className="block text-[0.9rem] text-[#3a2c1f]">{item.label}</span>
                    <span className="mt-1 block text-[0.72rem] leading-5 text-[#8a6b4b]">{item.description}</span>
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={sliderValue}
                    onChange={(event) => {
                      setScores((current) => ({
                        ...current,
                        [item.requestKey]: Number(event.target.value)
                      }));
                      setSaveError(false);
                    }}
                    className="h-2 w-full cursor-pointer accent-[#7b4d22]"
                    aria-label={`${item.label}评分`}
                  />
                  <span className="justify-self-start rounded-full border border-[rgba(150,105,61,0.12)] bg-[rgba(255,252,246,0.78)] px-3 py-1.5 font-mono text-[0.82rem] tabular-nums text-[#4b3727] md:justify-self-end">
                    {value ?? "未填"}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[0.78rem] leading-6 text-[#80634a]">{canSave ? "8 项已填完，可以保存。" : "8 项全部填完后才能保存。"}</p>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="rounded-full border border-[rgba(98,66,31,0.18)] bg-[#5f3e1f] px-4 py-2 text-[0.84rem] text-[#fffaf1] transition hover:bg-[#4f3319] disabled:cursor-not-allowed disabled:border-[rgba(150,105,61,0.1)] disabled:bg-[rgba(188,163,130,0.44)] disabled:text-[#8c735b]"
            >
              {isSaving ? "保存中" : "保存评分"}
            </button>
          </div>
          {saveError ? (
            <p className="mt-3 rounded-[14px] border border-[rgba(151,74,44,0.18)] bg-[rgba(255,241,232,0.62)] px-3 py-2 text-[0.82rem] text-[#8a3f25]" role="alert">
              评分保存失败，请稍后再试。
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CoverageHeatmap({ record }: { record: AnalysisMonthRecord }) {
  const todayEntryDate = getTodayEntryDate();
  const observedCoverageDays =
    record.month === todayEntryDate.slice(0, 7) ? record.dailyCoverage.filter((day) => day.date <= todayEntryDate) : record.dailyCoverage;
  const daysByDate = useMemo(() => new Map(record.dailyCoverage.map((day) => [day.date, day])), [record.dailyCoverage]);
  const cells = buildCalendarMonthGrid(record.month);
  const highestDensityDay = getHighestDensityDay(record);
  const latestActiveDay = getLatestActiveDay(record);
  const recordingStreak = buildLongestSpan(record.dailyCoverage, (day) => day.savedDimensionCount > 0 || day.hasDailyJournalSaved);
  const quietStreak = buildLongestSpan(observedCoverageDays, (day) => day.savedDimensionCount === 0 && !day.hasDailyJournalSaved);
  const [selectedDate, setSelectedDate] = useState<string>(highestDensityDay?.date ?? latestActiveDay?.date ?? record.dailyCoverage[0]?.date ?? `${record.month}-01`);

  useEffect(() => {
    const fallbackDate = highestDensityDay?.date ?? latestActiveDay?.date ?? record.dailyCoverage[0]?.date ?? `${record.month}-01`;

    setSelectedDate((current) => (current && daysByDate.has(current) ? current : fallbackDate));
  }, [daysByDate, highestDensityDay, latestActiveDay, record.dailyCoverage, record.month]);

  const selectedCoverage = daysByDate.get(selectedDate) ?? null;
  const selectedDimensions = selectedCoverage?.savedDimensions ?? [];
  const isFutureSelectedDate = selectedDate > todayEntryDate;

  return (
    <div data-testid="analysis-rhythm-board">
      <div className="rounded-[20px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.4)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="archive-label">记录热力</p>
            <p className="mt-2 text-[0.9rem] leading-7 text-[#72583f]">先看本月哪里更密，哪里更空，再顺着具体日期回到当天。</p>
          </div>
          <div className="flex items-center gap-2 text-[0.74rem] text-[#7a624b]">
            <span>少</span>
            <span className="size-3 rounded-[4px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.78)]" />
            <span className="size-3 rounded-[4px] border border-[rgba(150,105,61,0.08)] bg-[rgba(219,200,170,0.72)]" />
            <span className="size-3 rounded-[4px] border border-[rgba(150,105,61,0.08)] bg-[rgba(193,152,97,0.72)]" />
            <span className="size-3 rounded-[4px] border border-[rgba(150,105,61,0.08)] bg-[rgba(111,74,38,0.82)]" />
            <span>多</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2" data-testid="analysis-heatmap-grid">
          {cells.map((cell) => {
            if (!cell.isCurrentMonth || !cell.date) {
              return <div key={cell.key} className="h-[4.4rem] rounded-[16px] border border-dashed border-[rgba(150,105,61,0.06)] bg-[rgba(255,249,239,0.18)]" aria-hidden="true" />;
            }

            const coverage = daysByDate.get(cell.date);
            const intensity = coverage ? Math.min(coverage.savedDimensionCount, 5) : 0;
            const isSelected = selectedDate === cell.date;
            const heatClasses = [
              "bg-[rgba(255,252,246,0.86)]",
              "bg-[rgba(240,225,198,0.82)]",
              "bg-[rgba(220,191,150,0.84)]",
              "bg-[rgba(191,148,89,0.82)]",
              "bg-[rgba(128,83,43,0.86)]",
              "bg-[rgba(95,60,28,0.9)]"
            ];

            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => setSelectedDate(cell.date ?? selectedDate)}
                className={`group flex h-[4.4rem] flex-col rounded-[16px] border px-2.5 py-2 text-left transition hover:-translate-y-[1px] ${
                  isSelected
                    ? "border-[rgba(111,74,38,0.28)] ring-2 ring-[rgba(111,74,38,0.12)]"
                    : "border-[rgba(150,105,61,0.1)]"
                } ${heatClasses[intensity]}`}
                data-testid={`analysis-heatmap-day-${cell.date}`}
                title={coverage ? `${cell.date}，${coverage.savedDimensionCount} 个已保存维度` : `${cell.date}，无记录`}
                aria-pressed={isSelected}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[0.72rem] tabular-nums text-[#8e6a46]">{cell.dayNumber}</span>
                  {coverage?.hasDailyJournalSaved ? (
                    <span className="size-2.5 rounded-full border border-[rgba(169,111,61,0.24)] bg-[rgba(169,111,61,0.92)]" aria-label="当天整合日志已保存" />
                  ) : null}
                </div>
                <div className="mt-auto">
                  <p className="font-mono text-[0.74rem] tabular-nums text-[#4b3a2b]">{coverage ? `${coverage.savedDimensionCount}维` : "无"}</p>
                  <div
                    className="mt-1 flex flex-wrap gap-1"
                    aria-label={
                      coverage ? `涉及维度 ${coverage.savedDimensions.map((dimension) => getInterviewDimensionMeta(dimension).label).join("、")}` : "暂无维度"
                    }
                  >
                    {(coverage?.savedDimensions.slice(0, 5) ?? []).map((dimension) => {
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
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-[16px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,249,239,0.36)] px-3 py-2.5" data-testid="analysis-rhythm-summary-bar">
        <div className="text-center">
          <p className="text-[0.7rem] text-[#8b6c4d]">最高密度</p>
          <p className="mt-1 font-mono text-[0.82rem] tabular-nums text-[#3a2c1f]">{highestDensityDay ? `${formatAnalysisDateLabel(highestDensityDay.date)} · ${highestDensityDay.savedDimensionCount}维` : "暂无"}</p>
        </div>
        <div className="border-x border-[rgba(150,105,61,0.1)] text-center">
          <p className="text-[0.7rem] text-[#8b6c4d]">最长连续</p>
          <p className="mt-1 font-mono text-[0.82rem] tabular-nums text-[#3a2c1f]">{recordingStreak ? `${recordingStreak.length} 天` : "暂无"}</p>
        </div>
        <div className="text-center">
          <p className="text-[0.7rem] text-[#8b6c4d]">最长空档</p>
          <p className="mt-1 font-mono text-[0.82rem] tabular-nums text-[#3a2c1f]">{quietStreak ? `${quietStreak.length} 天` : "暂无"}</p>
        </div>
      </div>

      <aside className="mt-3 max-w-[36rem]">
        <div className="rounded-[20px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.42)] p-4">
          <p className="archive-label">当天追踪</p>
          <h3 className="mt-2 font-display text-[1.35rem] leading-none text-[#302114]">{formatAnalysisDateLabel(selectedDate, "暂无")}</h3>

          {selectedCoverage && selectedCoverage.savedDimensionCount > 0 ? (
            <>
              <p className="mt-3 text-[0.88rem] leading-7 text-[#72583f]">
                {isFutureSelectedDate
                  ? `这一天有 ${selectedCoverage.savedDimensionCount} 个维度，但未来日期不开放继续访谈入口。`
                  : `这一天一共留下 ${selectedCoverage.savedDimensionCount} 个维度，先回到当天，再决定继续哪一条。`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedDimensions.map((dimension) => {
                  const visualMeta = getCalendarDimensionVisualMeta(dimension);

                  return (
                    <span
                      key={dimension}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.76rem] ${visualMeta.softBadgeClass}`}
                    >
                      <span aria-hidden="true">{visualMeta.monthLabel}</span>
                      <span>{getInterviewDimensionMeta(dimension).label}</span>
                    </span>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <ActionLink href={buildCalendarHref({ view: "day", date: selectedDate })} label="查看当天" variant="primary" />
                {!isFutureSelectedDate ? (
                  <ActionLink href={buildInterviewHref({ dimension: selectedDimensions[0] ?? "joy", entryDate: selectedDate })} label="继续当天记录" />
                ) : null}
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-[0.88rem] leading-7 text-[#72583f]">
                {isFutureSelectedDate
                  ? "这一天还没到来。你可以先查看当天，但未来日期暂不开放开始记录。"
                  : "这一天目前还是空的。你可以直接去当天看看，或者从一个维度开始留下第一条记录。"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <ActionLink href={buildCalendarHref({ view: "day", date: selectedDate })} label="查看当天" variant="primary" />
                {!isFutureSelectedDate ? (
                  <ActionLink href={buildInterviewHref({ dimension: "joy", entryDate: selectedDate })} label="开始这一天的记录" />
                ) : null}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function DimensionInsights({ record }: { record: AnalysisMonthRecord }) {
  const sortedDimensions = [...record.dimensions].sort((left, right) => {
    if (right.savedEntryCount !== left.savedEntryCount) {
      return right.savedEntryCount - left.savedEntryCount;
    }

    if (right.recordedDayCount !== left.recordedDayCount) {
      return right.recordedDayCount - left.recordedDayCount;
    }

    return (right.lastRecordedDate ?? "").localeCompare(left.lastRecordedDate ?? "");
  });
  const featured = sortedDimensions.find((dimension) => dimension.savedEntryCount > 0) ?? null;
  const emerging = sortedDimensions.filter((dimension) => featured && dimension.dimension !== featured.dimension && dimension.savedEntryCount > 0);
  const quiet = interviewDimensions
    .map((dimension) => record.dimensions.find((item) => item.dimension === dimension))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((dimension) => dimension.savedEntryCount === 0);

  if (!featured) {
    return (
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]" data-testid="analysis-dimension-cards">
        <article className="rounded-[22px] border border-dashed border-[rgba(150,105,61,0.16)] bg-[rgba(255,249,239,0.34)] p-4" data-testid="analysis-dimension-empty-state">
          <p className="archive-label">五维洞察</p>
          <h3 className="mt-2 font-display text-[1.45rem] leading-none text-[#302114]">这个月还没有形成文字线索</h3>
          <p className="mt-3 text-[0.9rem] leading-7 text-[#72583f]">
            {record.scoreOverview.scoredDayCount > 0
              ? "这个月已经有评分轨迹，但还没有已保存的维度日志，所以这里不会伪造主线维度。"
              : "这个月还没有已保存记录，先从一个维度开始，之后这里才会慢慢长出主线。"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <ActionLink href="/interview?dimension=joy" label="开始一条记录" variant="primary" />
            <ActionLink href={buildAnalysisHref({ month: record.month, section: "score" })} label="先去补评分" />
          </div>
        </article>

        <article className="rounded-[22px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.42)] p-4">
          <p className="archive-label">安静维度</p>
          <div className="mt-3 grid gap-2">
            {quiet.map((item) => (
              <div key={item.dimension} className="rounded-[18px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.8)] px-3 py-3">
                <div className="flex items-center gap-2.5">
                  <span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-[0.72rem] font-medium ${getCalendarDimensionVisualMeta(item.dimension).softBadgeClass}`}>
                    {getCalendarDimensionVisualMeta(item.dimension).monthLabel}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.88rem] text-[#3a2c1f]">{getInterviewDimensionMeta(item.dimension).label}</p>
                    <p className="text-[0.74rem] text-[#876b51]">本月还没有留下记录</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]" data-testid="analysis-dimension-cards">
      <article className="rounded-[22px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.42)] p-4" data-testid={`analysis-dimension-featured-${featured.dimension}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="archive-label">主线维度</p>
            <h3 className="mt-2 font-display text-[1.45rem] leading-none text-[#302114]">{getInterviewDimensionMeta(featured.dimension).label}</h3>
          </div>
          <span className={`inline-flex size-10 items-center justify-center rounded-full border text-[0.85rem] font-medium ${getCalendarDimensionVisualMeta(featured.dimension).softBadgeClass}`}>
            {getCalendarDimensionVisualMeta(featured.dimension).monthLabel}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[16px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.8)] px-3.5 py-3">
            <p className="text-[0.74rem] text-[#8b6c4d]">已保存</p>
            <p className="mt-1 font-mono text-[0.9rem] tabular-nums text-[#4b3727]">{featured.savedEntryCount} 篇</p>
          </div>
          <div className="rounded-[16px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.8)] px-3.5 py-3">
            <p className="text-[0.74rem] text-[#8b6c4d]">覆盖天数</p>
            <p className="mt-1 font-mono text-[0.9rem] tabular-nums text-[#4b3727]">{featured.recordedDayCount} 天</p>
          </div>
          <div className="rounded-[16px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.8)] px-3.5 py-3">
            <p className="text-[0.74rem] text-[#8b6c4d]">最近记录</p>
            <p className="mt-1 font-mono text-[0.9rem] tabular-nums text-[#4b3727]">{formatAnalysisDateLabel(featured.lastRecordedDate)}</p>
          </div>
        </div>
        {featured.topTags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-[0.72rem] text-[#8b6c4d]">高频线索</span>
            {featured.topTags.slice(0, 3).map((tag) => (
              <span key={tag.tag} className="rounded-full border border-[rgba(150,105,61,0.12)] bg-[rgba(255,252,246,0.82)] px-2.5 py-1 text-[0.76rem] text-[#5a4230]">
                {tag.tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-4 rounded-[18px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.8)] px-4 py-4">
          <p className="text-[0.76rem] text-[#8b6c4d]">主线说明</p>
          <p className="mt-2 text-[0.92rem] leading-7 text-[#4a3928]">{buildDimensionSummary(featured)}</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <ActionLink
              href={buildInterviewHref({ dimension: featured.dimension, entryDate: featured.lastRecordedDate })}
              label={`回到${getInterviewDimensionMeta(featured.dimension).label}`}
              variant="primary"
            />
            {featured.lastRecordedDate ? <ActionLink href={buildCalendarHref({ view: "day", date: featured.lastRecordedDate })} label="查看最近那天" /> : null}
          </div>
        </div>
      </article>

      <div className="space-y-3">
        <div className="rounded-[22px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.42)] p-4">
          <p className="archive-label">正在浮现</p>
          <div className="mt-3 grid gap-2">
            {emerging.length > 0 ? (
              emerging.map((item) => (
                <div key={item.dimension} className="rounded-[18px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.8)] px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-[0.72rem] font-medium ${getCalendarDimensionVisualMeta(item.dimension).softBadgeClass}`}>
                      {getCalendarDimensionVisualMeta(item.dimension).monthLabel}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.88rem] text-[#3a2c1f]">{getInterviewDimensionMeta(item.dimension).label}</p>
                      <p className="text-[0.74rem] text-[#876b51]">{item.savedEntryCount} 篇，最近 {formatAnalysisDateLabel(item.lastRecordedDate)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[0.8rem] leading-6 text-[#72583f]">{buildDimensionSummary(item)}</p>
                  {item.topTags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.topTags.slice(0, 3).map((tag) => (
                        <span key={tag.tag} className="rounded-full border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.76)] px-2 py-0.5 text-[0.7rem] text-[#6f5339]">
                          {tag.tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="rounded-[18px] border border-dashed border-[rgba(150,105,61,0.14)] bg-[rgba(255,252,246,0.76)] px-3 py-3 text-[0.84rem] leading-6 text-[#72583f]">
                这个月目前只有一条更清晰的主线，其余维度还没有明显浮现。
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[22px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.42)] p-4">
          <p className="archive-label">安静维度</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {quiet.map((item) => (
              <div key={item.dimension} className="rounded-[18px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.8)] px-3 py-3">
                <div className="flex items-center gap-2.5">
                  <span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-[0.72rem] font-medium ${getCalendarDimensionVisualMeta(item.dimension).softBadgeClass}`}>
                    {getCalendarDimensionVisualMeta(item.dimension).monthLabel}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.88rem] text-[#3a2c1f]">{getInterviewDimensionMeta(item.dimension).label}</p>
                    <p className="text-[0.74rem] text-[#876b51]">本月还没有留下记录</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
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

  function navigateSection(section: AnalysisSectionKey) {
    const href = buildAnalysisHref({ month: normalizedSearch.month, section });

    setActiveSection(section);
    router.replace(href, { scroll: false });
  }

  return (
    <section className="page-shell min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 md:px-8 md:py-8 xl:px-10" data-testid="analysis-workspace">
      <div className="relative z-10">
        <SummaryHero record={record} month={normalizedSearch.month} />

        <div className="mt-5">
          <SectionAnchorNav currentSection={activeSection} onChange={navigateSection} record={record} />
        </div>

        <div className="mt-5 paper-sheet rounded-[28px] px-5 py-5 md:px-6 md:py-6">
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
                <OverviewCards record={record} />
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
                <HappinessScorePanel record={record} onSaved={() => setRefreshNonce((value) => value + 1)} />
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
