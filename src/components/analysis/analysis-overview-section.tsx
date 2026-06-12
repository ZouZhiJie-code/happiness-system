"use client";

import type { AnalysisInsightCardItem, AnalysisMonthRecord } from "@/features/analysis/types";
import { buildAnalysisHref, formatAnalysisMonthLabel, getTodayAnalysisMonth } from "@/features/analysis/view-state";
import { buildCalendarHref } from "@/features/calendar/view-state";
import { getInterviewDimensionMeta } from "@/features/interview/dimensions";
import { Card, Divider } from "@/components/ui";
import {
  ANALYSIS_CHIP_CLASS,
  ActionLink,
  buildDailyJournalHref,
  buildRhythmNarrative,
  findCoverageDay,
  formatAnalysisDateLabel,
  formatScoreAverage,
  getFeaturedDimension,
  isFutureAnalysisMonth
} from "./analysis-shared";

interface OverviewAction {
  title: string;
  body: string;
  href: string;
  label: string;
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

function shouldPreferNarrativeOverview(record: AnalysisMonthRecord) {
  if (!record.narrative?.overviewNarrative?.trim()) {
    return false;
  }

  if (isFutureAnalysisMonth(record.month) && record.logOverview.savedEntryCount === 0 && record.scoreOverview.scoredDayCount === 0) {
    return false;
  }

  if (record.logOverview.savedEntryCount === 0) {
    return false;
  }

  if (record.rhythmOverview.latestPendingDailyJournalDate || record.rhythmOverview.latestScoreOnlyDate) {
    return false;
  }

  return true;
}

function getOverviewNarrativeCopy(record: AnalysisMonthRecord) {
  return shouldPreferNarrativeOverview(record)
    ? record.narrative!.overviewNarrative
    : buildOverviewNarrative(record);
}

export function getScoreConfidenceCopy(record: AnalysisMonthRecord) {
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
  const pendingDailyJournalDay = findCoverageDay(record, record.rhythmOverview.latestPendingDailyJournalDate);
  const scoreOnlyDay = findCoverageDay(record, record.rhythmOverview.latestScoreOnlyDate);
  const latestActiveDay = findCoverageDay(record, record.rhythmOverview.latestActiveDate);

  if (isFutureAnalysisMonth(record.month) && record.logOverview.savedEntryCount === 0 && record.scoreOverview.scoredDayCount === 0) {
    return {
      title: "这个月还没开始",
      body: "未来月份先不做开始记录的引导。回到当前月份，再看今天正在累积的评分和日志。",
      href: buildAnalysisHref({ month: getTodayAnalysisMonth(), section: "trends" }),
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
    href: buildAnalysisHref({ month: record.month, section: "trends" }),
    label: "查看走势"
  };
}

export function SummaryHero({ record, month }: { record: AnalysisMonthRecord | null; month: string }) {
  const featured = record ? getFeaturedDimension(record) : null;
  const activeDayCount = record?.rhythmOverview.activeObservedDayCount ?? 0;
  const longestStreak = record?.rhythmOverview.longestStreak ?? null;
  const pendingDailyJournalCount = record?.rhythmOverview.pendingDailyJournalCount ?? 0;
  const scoreOnlyDayCount = record?.rhythmOverview.scoreOnlyDayCount ?? 0;
  const scoreConfidence = record ? getScoreConfidenceCopy(record) : null;
  const nextAction = record ? buildOverviewNextAction(record) : null;
  const featuredSignal = featured?.recentSignals[0] ?? null;
  const featuredLabel = featured ? getInterviewDimensionMeta(featured.dimension).label : null;

  const statusItems = [
    {
      label: "评分刻度",
      value: record
        ? `已评 ${record.scoreOverview.scoredDayCount} 天，月均 ${formatScoreAverage(record.scoreOverview.monthAverageScore)}`
        : "—",
      detail: scoreConfidence?.detail ?? "评分材料加载中。",
      href: buildAnalysisHref({ month, section: "trends" }),
      linkLabel: "查看评分"
    },
    {
      label: "记录节奏",
      value: record
        ? pendingDailyJournalCount > 0
          ? `${pendingDailyJournalCount} 天待整合`
          : scoreOnlyDayCount > 0
            ? `${scoreOnlyDayCount} 天待成文`
            : longestStreak
              ? `${longestStreak.length} 天连续`
              : `${activeDayCount} 天有材料`
        : "—",
      detail: record ? buildRhythmNarrative(record) : "还没有明显的记录节奏。",
      href: buildAnalysisHref({ month, section: "trends" }),
      linkLabel: "查看节奏"
    },
    {
      label: "五维线索",
      value: featured ? `${featuredLabel} · ${featured.savedEntryCount} 篇` : "尚未形成",
      detail: featuredSignal
        ? `${formatAnalysisDateLabel(featuredSignal.date)}：${featuredSignal.primarySignal}`
        : "还没有足够的维度信号可展示。",
      href: buildAnalysisHref({ month, section: "dimensions" }),
      linkLabel: "查看五维"
    }
  ];

  return (
    <div data-testid="analysis-month-hero">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.32fr)_minmax(18rem,0.68fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="archive-label">月度判断</p>
            {scoreConfidence ? <span className={ANALYSIS_CHIP_CLASS}>{scoreConfidence.label}</span> : null}
          </div>
          <h1 className="mt-3 font-display text-[1.95rem] leading-none text-[#2f2419] md:text-[2.45rem]">
            {formatAnalysisMonthLabel(month)}
          </h1>
          <p className="mt-3 max-w-[48rem] text-pretty text-[0.95rem] leading-7 text-[#5f4b36]">
            {record ? getOverviewNarrativeCopy(record) : "加载中..."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={ANALYSIS_CHIP_CLASS}>{record ? `${activeDayCount} 天有材料` : "材料加载中"}</span>
            <span className={ANALYSIS_CHIP_CLASS}>
              {pendingDailyJournalCount > 0
                ? `${pendingDailyJournalCount} 天待整合`
                : scoreOnlyDayCount > 0
                  ? `${scoreOnlyDayCount} 天待成文`
                  : "节奏已收住"}
            </span>
            <span className={ANALYSIS_CHIP_CLASS}>
              {longestStreak ? `最长连续 ${longestStreak.length} 天` : "连续节奏未形成"}
            </span>
          </div>
        </div>

        <Card as="aside" className="p-4" data-testid="analysis-next-action">
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
        </Card>
      </div>

      <Divider className="mt-6" />

      <div className="grid gap-x-6 md:grid-cols-3" data-testid="analysis-status-board">
        {statusItems.map((item) => (
          <article key={item.label} className="border-t border-[var(--line-soft)] py-3.5 first:border-t-0 md:border-t-0">
            <p className="text-[0.76rem] text-[#8b6c4d]">{item.label}</p>
            <p className="mt-2 font-mono text-[0.95rem] tabular-nums text-[#302114]">{item.value}</p>
            <p className="mt-2 text-[0.8rem] leading-6 text-[#72583f]">{item.detail}</p>
            <div className="mt-2 -ml-1.5">
              <ActionLink href={item.href} label={item.linkLabel} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function NarrativeInsightCard({ card }: { card: AnalysisInsightCardItem }) {
  return (
    <article className="ui-quote py-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className={ANALYSIS_CHIP_CLASS}>{card.type}</span>
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

export function OverviewAnchorCTA({ record }: { record: AnalysisMonthRecord }) {
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

  return <p className="text-[0.78rem] leading-6 text-[#8b6c4d]">{parts.join(" · ")}</p>;
}
