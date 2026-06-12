import Link from "next/link";
import React from "react";

import type {
  AnalysisDailyCoverageDay,
  AnalysisDateSpan,
  AnalysisDimensionInsightCard,
  AnalysisMonthRecord
} from "@/features/analysis/types";
import { getTodayAnalysisMonth } from "@/features/analysis/view-state";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import { getInterviewDimensionMeta, interviewDimensions } from "@/features/interview/dimensions";
import { happinessScorePresentationItems } from "@/features/happiness-score/presentation";
import type { HappinessScoreRequestKey } from "@/features/happiness-score/types";
import { actionButtonClass } from "@/components/ui";

export const happinessScoreItems: {
  requestKey: HappinessScoreRequestKey;
  label: string;
  description: string;
}[] = happinessScorePresentationItems.map((item) => ({
  requestKey: item.requestKey,
  label: item.label,
  description: item.hint
}));

/** 行内小标签：chip 不算容器层（见 docs/design/ui-conventions.md） */
export const ANALYSIS_CHIP_CLASS =
  "inline-flex items-center rounded-full border border-[var(--line-soft)] bg-paper/70 px-2.5 py-1 text-[0.72rem] text-[#7a6048]";

export function buildInterviewHref(input: {
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

export function buildDailyJournalHref(date: string) {
  const params = new URLSearchParams({
    dimension: "joy",
    entryDate: date,
    mode: "daily-journal"
  });

  return `/interview?${params.toString()}`;
}

export function formatAnalysisDateLabel(date: string | null, fallback = "暂无") {
  if (!date) {
    return fallback;
  }

  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

export function formatScoreDateLabel(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

export function formatScoreAverage(value: number | null) {
  return typeof value === "number" ? value.toFixed(1) : "暂无";
}

export function findCoverageDay(record: AnalysisMonthRecord, date: string | null) {
  if (!date) {
    return null;
  }

  return record.dailyCoverage.find((day) => day.date === date) ?? null;
}

export function formatSpanLabel(span: AnalysisDateSpan | null) {
  if (!span) {
    return "暂无";
  }

  if (span.length === 1) {
    return `${formatAnalysisDateLabel(span.startDate)}，1天`;
  }

  return `${formatAnalysisDateLabel(span.startDate)} - ${formatAnalysisDateLabel(span.endDate)}，${span.length}天`;
}

export function isFutureAnalysisMonth(month: string, todayMonth = getTodayAnalysisMonth()) {
  return month > todayMonth;
}

export function buildRhythmNarrative(record: AnalysisMonthRecord, todayEntryDate = getTodayEntryDate()) {
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

export function compareDimensionInsights(left: AnalysisDimensionInsightCard, right: AnalysisDimensionInsightCard) {
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

export function getFeaturedDimension(record: AnalysisMonthRecord) {
  if (record.insightsOverview.featuredDimension) {
    return record.dimensions.find((dimension) => dimension.dimension === record.insightsOverview.featuredDimension) ?? null;
  }

  return [...record.dimensions]
    .filter((dimension) => dimension.savedEntryCount > 0)
    .sort(compareDimensionInsights)[0] ?? null;
}

export function buildDimensionSummary(
  dimension: AnalysisDimensionInsightCard,
  narrative: AnalysisMonthRecord["narrative"]
) {
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

export function getDimensionConfidenceLabel(dimension: AnalysisDimensionInsightCard) {
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

export function getDimensionMomentumLabel(dimension: AnalysisDimensionInsightCard) {
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

export function getDimensionContinuityLabel(dimension: AnalysisDimensionInsightCard) {
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

export function getDimensionLabel(dimension: AnalysisDimensionInsightCard["dimension"]) {
  return getInterviewDimensionMeta(dimension).label;
}

export type { AnalysisDailyCoverageDay };

export function ActionLink({
  href,
  label,
  variant = "secondary"
}: {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link href={href} className={actionButtonClass(variant === "primary" ? "primary" : "ghost", "px-3.5 py-2 text-[0.8rem] font-medium")}>
      {label}
    </Link>
  );
}

export function AnalysisSection({
  title,
  testId,
  children
}: {
  title: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0" data-testid={testId}>
      <h2 className="text-balance font-display text-[1.56rem] leading-[0.98] text-[#2f2419] md:text-[1.82rem]">{title}</h2>
      <div className="mt-5">{children}</div>
    </div>
  );
}

export function AnalysisEmptyBanner({ title, body }: { title: string; body: string }) {
  return (
    <div className="ui-card border-dashed px-4 py-5">
      <p className="font-display text-[1.15rem] leading-none text-[#302114]">{title}</p>
      <p className="mt-2 text-[0.9rem] leading-7 text-[#72583f]">{body}</p>
    </div>
  );
}

export function SectionSkeleton({ blocks = 2 }: { blocks?: number }) {
  return (
    <div className="grid gap-3" aria-hidden="true">
      {Array.from({ length: blocks }, (_, index) => (
        <div key={index} className="h-36 rounded-[var(--radius-card)] bg-sand/50" />
      ))}
    </div>
  );
}
