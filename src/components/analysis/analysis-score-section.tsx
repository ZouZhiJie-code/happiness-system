"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { AnalysisDailyCoverageDay, AnalysisMonthRecord } from "@/features/analysis/types";
import { buildCalendarHref } from "@/features/calendar/view-state";
import { getInterviewDimensionMeta } from "@/features/interview/dimensions";
import type { HappinessScoreRequestKey } from "@/features/happiness-score/types";
import { Divider } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  ANALYSIS_CHIP_CLASS,
  formatScoreAverage,
  formatScoreDateLabel,
  happinessScoreItems
} from "./analysis-shared";

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

function resolveTrendPointLabel(date: string, value: number) {
  return `${formatScoreDateLabel(date)} ${value.toFixed(1)}分`;
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
      className={compact ? "" : "rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-paper/80 p-3.5 min-h-[17rem]"}
      data-testid={testId}
    >
      {scoredPoints.length === 0 ? (
        <div
          className={cn(
            "flex items-center justify-center px-4 text-center text-[0.82rem] leading-6 text-[#7a624b]",
            compact ? "min-h-[2.75rem]" : "min-h-[14.5rem]"
          )}
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
  const hasDailyJournalPreview = Boolean(
    coverage &&
      coverage.hasDailyJournalSaved &&
      (coverage.journalTitle || coverage.contentPreview)
  );
  const hasPendingDimensionLogs = Boolean(
    coverage &&
      coverage.savedEntryCount > 0 &&
      !coverage.hasDailyJournalSaved
  );
  const hasSavedDailyJournalWithoutPreview = Boolean(
    coverage &&
      coverage.hasDailyJournalSaved &&
      !coverage.journalTitle &&
      !coverage.contentPreview
  );

  return (
    <div className="ui-card mt-3 px-4 py-3" data-testid="score-trend-detail-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="archive-label">这一天</p>
          <p className="mt-1 font-display text-[1.15rem] leading-none text-[#302114]">{formatScoreDateLabel(date)}</p>
        </div>
        <div className="flex items-center gap-2">
          {averageLabel ? (
            <span className={ANALYSIS_CHIP_CLASS}>
              当天均分 <span className="ml-1 font-mono tabular-nums text-[#4b3727]">{averageLabel}</span>
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className={cn(ANALYSIS_CHIP_CLASS, "hover:bg-sand/60")}
            aria-label="关闭当日详情"
          >
            收起
          </button>
        </div>
      </div>
      {hasDailyJournalPreview ? (
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
      ) : hasPendingDimensionLogs ? (
        <div className="mt-2.5 text-[0.8rem] leading-6 text-[#7a624b]">
          这一天已有 {coverage?.savedEntryCount} 条维度记录，但还没有整合成完整日志。
          <Link
            href={buildCalendarHref({ date, view: "day" })}
            className="ml-1 text-[#6f4a26] underline-offset-2 hover:underline"
          >
            去日历看这一天 →
          </Link>
        </div>
      ) : hasSavedDailyJournalWithoutPreview ? (
        <div className="mt-2.5 text-[0.8rem] leading-6 text-[#7a624b]">
          这一天已经有完整日志了。
          <Link
            href={buildCalendarHref({ date, view: "day" })}
            className="ml-1 text-[#6f4a26] underline-offset-2 hover:underline"
          >
            去日历看这一天 →
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
  const scoreTrendSignature = useMemo(
    () =>
      [
        record.month,
        record.scoreOverview.scoredDayCount,
        record.scoreOverview.latestScoredDate ?? "",
        ...happinessScoreItems.map((item) => record.scoreTrend.factorAverages[item.requestKey] ?? "null")
      ].join("|"),
    [record]
  );
  const [selectedFactor, setSelectedFactor] = useState<HappinessScoreRequestKey>(defaultFactor);
  const [inspectedDate, setInspectedDate] = useState<string | null>(null);
  const previousScoreTrendSignature = useRef(scoreTrendSignature);
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
    if (previousScoreTrendSignature.current === scoreTrendSignature) {
      return;
    }

    previousScoreTrendSignature.current = scoreTrendSignature;
    setSelectedFactor(defaultFactor);
  }, [defaultFactor, scoreTrendSignature]);

  useEffect(() => {
    setInspectedDate(null);
  }, [record.month]);

  return (
    <div data-testid="happiness-score-trend-panel">
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
          <div className={ANALYSIS_CHIP_CLASS}>
            <span className="text-[#8a6b4b]">已评分 </span>
            <span className="ml-1 font-mono text-[0.82rem] tabular-nums text-[#4b3727]">{record.scoreOverview.scoredDayCount} 天</span>
          </div>
          <div className={ANALYSIS_CHIP_CLASS}>
            <span className="text-[#8a6b4b]">月均总分 </span>
            <span className="ml-1 font-mono text-[0.82rem] tabular-nums text-[#4b3727]">{formatScoreAverage(record.scoreOverview.monthAverageScore)}</span>
          </div>
        </div>
      </div>

      {trendHighlightState.note ? (
        <p className="ui-quote mt-4 text-[0.78rem] leading-6" data-testid="score-trend-sample-note">
          {trendHighlightState.note}
        </p>
      ) : null}

      {trendHighlightState.highlights.length > 0 ? (
        <div className="mt-4 grid gap-x-6 lg:grid-cols-3">
          {trendHighlightState.highlights.map((highlight) => (
            <div key={highlight.label} className="border-t border-[var(--line-soft)] py-3 lg:border-t-0 lg:first:border-t-0">
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

      <Divider className="mt-5" />

      <div className="mt-5">
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

      <div className="mt-6">
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
                  "ui-card ui-card--interactive px-3 py-3 text-left",
                  active && "border-[var(--line-strong)] bg-sand/60"
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

      <div className="mt-6">
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

export function HappinessScorePanel({ record, onSaved }: { record: AnalysisMonthRecord; onSaved: () => void }) {
  void onSaved;
  return (
    <div data-testid="happiness-score-panel">
      <HappinessScoreTrendPanel record={record} />
    </div>
  );
}
