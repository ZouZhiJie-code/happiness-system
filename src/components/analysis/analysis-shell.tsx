"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { AnalysisMonthRecord } from "@/features/analysis/types";
import {
  buildAnalysisHref,
  formatAnalysisMonthLabel,
  getTodayAnalysisMonth,
  normalizeAnalysisSearchParams,
  type AnalysisSectionKey
} from "@/features/analysis/view-state";
import { buildCalendarMonthGrid } from "@/features/calendar/view-state";
import { getCalendarDimensionVisualMeta } from "@/features/calendar/presentation";
import { getInterviewDimensionMeta, interviewDimensions } from "@/features/interview/dimensions";
import {
  happinessScoreKeyPairs,
  type DailyHappinessScoreKey,
  type HappinessScoreRequestKey
} from "@/features/happiness-score/types";
import type { InterviewDimension } from "@/types/interview";

const sectionTabs: Array<{ key: AnalysisSectionKey; label: string; description: string }> = [
  { key: "score", label: "评分", description: "幸福 8 要素与月内走势" },
  { key: "rhythm", label: "热力", description: "本月记录密度与分布" },
  { key: "insights", label: "五维洞察", description: "五个维度的结构化线索" }
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

type AnalysisViewData = AnalysisMonthRecord & {
  usesDemoData: boolean;
};

const seedCoverageDays = [2, 5, 8, 13, 16, 19, 22, 25, 28];

const seedDimensionSignals: Record<InterviewDimension, {
  title: string;
  primary: string;
  secondary: string;
}> = {
  joy: {
    title: "把松动感留住",
    primary: "和朋友把卡住的问题聊开了",
    secondary: "轻松感明显回来了"
  },
  fulfillment: {
    title: "推进有了着落",
    primary: "把拖了几天的任务正式收尾",
    secondary: "今天算数的结果终于落地"
  },
  reflection: {
    title: "判断有了新角度",
    primary: "聊天后重新看见了自己的偏好",
    secondary: "原来的判断方式被校准了一点"
  },
  improvement: {
    title: "节奏往前挪了一步",
    primary: "下次先把表达放慢一点",
    secondary: "可控的小动作已经很清楚"
  },
  gratitude: {
    title: "被稳稳接住",
    primary: "有人及时帮我把事情理顺了",
    secondary: "被回应的方式很具体"
  }
};

const demoHeatmapCoverage: Record<number, number> = {
  2: 1,
  5: 2,
  8: 3,
  13: 4,
  16: 2,
  19: 5,
  22: 3,
  25: 4,
  28: 2
};

function buildDemoMonthRecord(record: AnalysisMonthRecord): AnalysisViewData {
  const usesDemoData = record.logOverview.savedEntryCount === 0 && record.scoreOverview.scoredDayCount === 0;
  const primaryDate = `${record.month}-28`;
  const secondaryDate = `${record.month}-19`;

  if (!usesDemoData) {
    return {
      ...record,
      usesDemoData
    };
  }

  return {
    ...record,
    usesDemoData,
    logOverview: {
      recordedDayCount: 9,
      savedEntryCount: 18,
      dailyJournalSavedDayCount: 4
    },
    dailyCoverage: record.dailyCoverage.map((day) => {
      const dayNumber = Number(day.date.split("-")[2]);
      const savedDimensionCount = demoHeatmapCoverage[dayNumber] ?? (seedCoverageDays.includes(dayNumber) ? 1 : 0);

      return {
        ...day,
        savedDimensionCount,
        savedDimensions: savedDimensionCount > 0
          ? interviewDimensions.slice(0, savedDimensionCount)
          : [],
        hasDailyJournalSaved: seedCoverageDays.includes(dayNumber) && dayNumber % 2 === 1
      };
    }),
    dimensionBreakdown: interviewDimensions.map((dimension, index) => ({
      dimension,
      savedEntryCount: [4, 3, 4, 2, 5][index],
      recordedDayCount: [3, 2, 4, 2, 4][index]
    })),
    dimensions: interviewDimensions.map((dimension) => ({
      dimension,
      savedEntryCount: dimension === "gratitude" ? 5 : dimension === "joy" ? 4 : dimension === "reflection" ? 4 : dimension === "fulfillment" ? 3 : 2,
      recordedDayCount: dimension === "gratitude" ? 4 : dimension === "joy" ? 3 : dimension === "reflection" ? 3 : dimension === "fulfillment" ? 2 : 2,
      lastRecordedDate: primaryDate,
      topTags: [
        { tag: "样板记录", count: 3 },
        { tag: "空态填充", count: 2 },
        { tag: "便于展示", count: 2 }
      ].slice(0, dimension === "improvement" ? 2 : 3),
      recentSignals: [
        {
          entryId: `demo-${dimension}-1`,
          date: primaryDate,
          primarySignal: seedDimensionSignals[dimension].primary,
          secondarySignal: seedDimensionSignals[dimension].secondary
        },
        {
          entryId: `demo-${dimension}-2`,
          date: secondaryDate,
          primarySignal: seedDimensionSignals[dimension].title,
          secondarySignal: "这是一条用于展示结构的样板线索"
        }
      ]
    })),
    scoreOverview: {
      scoredDayCount: 9,
      monthAverageScore: 7.4,
      latestScoredDate: primaryDate
    },
    scoreRecords: record.scoreRecords,
    scoreTrend: {
      days: record.scoreTrend.days.map((day, index) => ({
        ...day,
        averageScore: seedCoverageDays.includes(index + 1) ? 6.8 + ((index % 4) * 0.3) : null,
        hasScore: seedCoverageDays.includes(index + 1),
        scores: seedCoverageDays.includes(index + 1)
          ? {
              meaning: 8,
              health: 7,
              virtue: 8,
              autonomy: 7,
              interest: 8,
              skill: 7,
              relationship: 8,
              livingCondition: 7
            }
          : day.scores
      })),
      factorAverages: {
        meaning: 8,
        health: 7,
        virtue: 8,
        autonomy: 7,
        interest: 8,
        skill: 7,
        relationship: 8,
        livingCondition: 7
      }
    },
    editableDates: record.editableDates
  };
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

function AnalysisSection({
  index,
  title,
  description,
  eyebrow = "分析段落",
  testId,
  children
}: {
  index: string;
  title: string;
  description: string;
  eyebrow?: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[rgba(150,105,61,0.12)] pt-5 first:border-t-0 first:pt-0" data-testid={testId}>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[0.82rem] text-[#9a6b3d]">{index}</span>
        <p className="archive-label">{eyebrow}</p>
      </div>
      <div className="mt-3 min-w-0">
        <h2 className="text-balance font-display text-[1.65rem] leading-[0.98] text-[#2f2419] md:text-[1.88rem]">{title}</h2>
        <p className="mt-2 max-w-[46rem] text-pretty text-[0.94rem] leading-7 text-[#6f5a44]">{description}</p>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SectionTabs({
  currentSection,
  onChange
}: {
  currentSection: AnalysisSectionKey;
  onChange: (section: AnalysisSectionKey) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-[20px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.5)] p-2">
      {sectionTabs.map((tab) => {
        const active = tab.key === currentSection;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`min-w-[7.2rem] rounded-[16px] px-4 py-3 text-left transition ${
              active
                ? "bg-[#6f4a26] text-[#fffaf1] shadow-sm"
                : "bg-[rgba(255,252,246,0.84)] text-[#6b533d] hover:bg-[rgba(255,251,244,0.96)]"
            }`}
            aria-pressed={active}
          >
            <span className="block text-[0.88rem] font-medium">{tab.label}</span>
            <span className={`mt-1 block text-[0.7rem] leading-5 ${active ? "text-[#f7ead4]" : "text-[#8d7157]"}`}>
              {tab.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function OverviewCards({ record }: { record: AnalysisViewData }) {
  const items = [
    {
      id: "recorded-days",
      label: "有记录天数",
      value: `${record.logOverview.recordedDayCount}`,
      detail: "至少有一篇已保存维度日志的天数"
    },
    {
      id: "saved-entries",
      label: "已保存记录",
      value: `${record.logOverview.savedEntryCount}`,
      detail: "这个月沉淀下来的维度日志总篇数"
    },
    {
      id: "daily-journals",
      label: "整合日志完成天数",
      value: `${record.logOverview.dailyJournalSavedDayCount}`,
      detail: "当天整合日志已经正式保存的天数"
    }
  ];

  return (
    <div className="grid gap-2.5 sm:grid-cols-3" data-testid="analysis-overview-cards">
      {items.map((item) => (
        <article key={item.id} className="rounded-[18px] border border-[rgba(150,105,61,0.12)] bg-[rgba(255,249,239,0.48)] px-4 py-4">
          <p className="text-[0.78rem] text-[#8a6b4b]">{item.label}</p>
          <p className="mt-2 font-display text-[2rem] leading-none tabular-nums text-[#302114]">{item.value}</p>
          <p className="mt-2 text-pretty text-[0.82rem] leading-6 text-[#7a624b]">{item.detail}</p>
        </article>
      ))}
    </div>
  );
}

function CoverageHeatmap({ record }: { record: AnalysisViewData }) {
  const daysByDate = useMemo(() => new Map(record.dailyCoverage.map((day) => [day.date, day])), [record.dailyCoverage]);
  const cells = buildCalendarMonthGrid(record.month);
  const highestDensityDay = record.dailyCoverage.reduce<AnalysisViewData["dailyCoverage"][number] | null>((best, day) => {
    if (day.savedDimensionCount <= 0) {
      return best;
    }

    return day.savedDimensionCount > (best?.savedDimensionCount ?? -1) ? day : best;
  }, null);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(15rem,0.6fr)]" data-testid="analysis-rhythm-board">
      <div className="rounded-[20px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.4)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="archive-label">记录热力</p>
            <p className="mt-2 text-[0.9rem] leading-7 text-[#72583f]">本月每天有多少维度落成，热度越深代表沉淀越多。</p>
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
              return <div key={cell.key} className="h-[4.25rem] rounded-[16px] border border-dashed border-[rgba(150,105,61,0.06)] bg-[rgba(255,249,239,0.18)]" aria-hidden="true" />;
            }

            const coverage = daysByDate.get(cell.date);
            const intensity = coverage ? Math.min(coverage.savedDimensionCount, 5) : 0;
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
                className={`group flex h-[4.25rem] flex-col rounded-[16px] border border-[rgba(150,105,61,0.1)] px-2.5 py-2 text-left transition hover:-translate-y-[1px] ${heatClasses[intensity]}`}
                data-testid={`analysis-heatmap-day-${cell.date}`}
                title={coverage ? `${cell.date}，${coverage.savedDimensionCount} 个已保存维度` : `${cell.date}，无记录`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[0.72rem] tabular-nums text-[#8e6a46]">{cell.dayNumber}</span>
                  {coverage?.hasDailyJournalSaved ? (
                    <span className="size-2.5 rounded-full border border-[rgba(169,111,61,0.24)] bg-[rgba(169,111,61,0.92)]" aria-label="当天整合日志已保存" />
                  ) : null}
                </div>
                <div className="mt-auto">
                  <p className="font-mono text-[0.74rem] tabular-nums text-[#4b3a2b]">
                    {coverage ? `${coverage.savedDimensionCount}维` : "无"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1" aria-label={coverage ? `涉及维度 ${coverage.savedDimensions.map((dimension) => getInterviewDimensionMeta(dimension).label).join("、")}` : "暂无维度"}>
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

      <aside className="rounded-[20px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.4)] p-4">
        <p className="archive-label">本月摘要</p>
        <div className="mt-3 space-y-2.5">
          <StatRow label="有记录天数" value={`${record.logOverview.recordedDayCount}`} />
          <StatRow label="已保存记录" value={`${record.logOverview.savedEntryCount}`} />
          <StatRow label="整合日志完成" value={`${record.logOverview.dailyJournalSavedDayCount}`} />
          <StatRow label="最高密度日" value={highestDensityDay?.date ?? "暂无"} />
        </div>

        <div className="mt-4 rounded-[18px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.8)] px-3 py-3">
          <p className="text-[0.76rem] text-[#8b6c4d]">说明</p>
          <p className="mt-1 text-[0.85rem] leading-6 text-[#72583f]">
            这里是分析热力，不是记录页的入口集合。你可以顺着它找出哪些日子沉淀得更密，再切到日志或日历继续看。
          </p>
        </div>
      </aside>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[15px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.76)] px-3.5 py-3">
      <p className="text-[0.84rem] text-[#3a2c1f]">{label}</p>
      <p className="font-mono text-[0.84rem] tabular-nums text-[#4b3727]">{value}</p>
    </div>
  );
}

function formatAnalysisDateLabel(date: string | null) {
  if (!date) {
    return "本月还没有记录";
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

function ScoreLineChart({
  days,
  getValue,
  ariaLabel,
  emptyText,
  testId
}: {
  days: AnalysisMonthRecord["scoreTrend"]["days"];
  getValue: (day: AnalysisMonthRecord["scoreTrend"]["days"][number]) => number | null;
  ariaLabel: string;
  emptyText: string;
  testId: string;
}) {
  const width = 680;
  const height = 260;
  const margin = {
    top: 20,
    right: 26,
    bottom: 34,
    left: 42
  };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const yTicks = [10, 7, 4, 1];
  const xLabelIndexes = [...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])];
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
    <div className="min-h-[17rem] rounded-[18px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.82)] p-3.5" data-testid={testId}>
      {scoredPoints.length === 0 ? (
        <div className="flex min-h-[14.5rem] items-center justify-center rounded-[14px] border border-dashed border-[rgba(150,105,61,0.16)] bg-[rgba(255,249,239,0.36)] px-4 text-center text-[0.86rem] leading-7 text-[#7a624b]" data-testid={`${testId}-empty`}>
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
            <path key={index} data-testid={`${testId}-segment`} d={path} fill="none" stroke="#6f4a26" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          ))}
          {scoredPoints.map((point) => (
            <circle key={point.date} cx={point.x} cy={point.y} r="4.5" fill="#fffaf1" stroke="#6f4a26" strokeWidth="2.5" aria-label={resolveTrendPointLabel(point.date, point.value)} />
          ))}
        </svg>
      )}
    </div>
  );
}

function HappinessScoreTrendPanel({ record }: { record: AnalysisViewData }) {
  const [selectedFactor, setSelectedFactor] = useState<HappinessScoreRequestKey>("meaning");
  const selectedItem = happinessScoreItems.find((item) => item.requestKey === selectedFactor) ?? happinessScoreItems[0];
  const selectedAverage = record.scoreTrend.factorAverages[selectedFactor];

  return (
    <div className="rounded-[20px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.34)] p-3.5" data-testid="happiness-score-trend-panel">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="archive-label">趋势</p>
          <h3 className="mt-2 font-display text-[1.45rem] leading-none text-[#302114]">评分走势</h3>
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

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div>
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

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[0.86rem] text-[#3a2c1f]">单项走势</p>
              <p className="font-mono text-[0.76rem] tabular-nums text-[#8a6b4b]">{selectedItem.label}月均 {formatScoreAverage(selectedAverage)}</p>
            </div>
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-[rgba(150,105,61,0.12)] bg-[rgba(255,249,239,0.62)] p-1" data-testid="score-factor-switch" aria-label="切换幸福评分要素">
              {happinessScoreItems.map((item) => (
                <button
                  key={item.requestKey}
                  type="button"
                  onClick={() => setSelectedFactor(item.requestKey)}
                  className={`shrink-0 rounded-full px-2.5 py-1.5 text-[0.76rem] transition ${
                    selectedFactor === item.requestKey
                      ? "bg-[#6f4a26] text-[#fffaf1] shadow-sm"
                      : "text-[#7a6048] hover:bg-[rgba(255,252,246,0.84)]"
                  }`}
                  aria-pressed={selectedFactor === item.requestKey}
                  data-testid={`score-factor-button-${item.requestKey}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
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
    </div>
  );
}

function HappinessScorePanel({ record, onSaved }: { record: AnalysisViewData; onSaved: () => void }) {
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
          <p className="archive-label">日评分</p>
          <h3 className="mt-3 text-balance font-display text-[1.55rem] leading-none text-[#302114]">8 个要素，先给今天一个刻度</h3>
          <p className="mt-3 text-pretty text-[0.88rem] leading-7 text-[#72583f]">这里不是写总结，只记录当天状态。填完 8 项后保存，页面会立即刷新到最新分数。</p>

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

function DimensionInsights({ record }: { record: AnalysisViewData }) {
  const sortedDimensions = [...record.dimensions].sort((left, right) => {
    if (right.savedEntryCount !== left.savedEntryCount) {
      return right.savedEntryCount - left.savedEntryCount;
    }

    if (right.recordedDayCount !== left.recordedDayCount) {
      return right.recordedDayCount - left.recordedDayCount;
    }

    return interviewDimensions.indexOf(left.dimension) - interviewDimensions.indexOf(right.dimension);
  });

  const hasDimensionEntries = sortedDimensions.some((dimension) => dimension.savedEntryCount > 0);
  const featured = hasDimensionEntries ? sortedDimensions[0] : null;
  const supporting = hasDimensionEntries ? sortedDimensions.slice(1) : [];

  const buildFeaturedSummary = (dimension: AnalysisViewData["dimensions"][number]) => {
    if (record.usesDemoData) {
      return `${seedDimensionSignals[dimension.dimension].title}。${seedDimensionSignals[dimension.dimension].primary}`;
    }

    const recentSignal = dimension.recentSignals[0];

    if (recentSignal?.secondarySignal) {
      return `${recentSignal.primarySignal}。${recentSignal.secondarySignal}`;
    }

    if (recentSignal?.primarySignal) {
      return recentSignal.primarySignal;
    }

    if (dimension.topTags.length > 0) {
      return `这个月更常出现的线索是：${dimension.topTags.map((item) => item.tag).join("、")}。`;
    }

    return "这个维度本月还没有形成可展示的线索。";
  };

  const buildSupportingSummary = (dimension: AnalysisViewData["dimensions"][number]) => {
    if (dimension.savedEntryCount === 0) {
      return "这个维度本月还没有留下记录。";
    }

    if (record.usesDemoData) {
      return seedDimensionSignals[dimension.dimension].secondary;
    }

    const recentSignal = dimension.recentSignals[0];

    if (recentSignal?.primarySignal) {
      return recentSignal.primarySignal;
    }

    if (dimension.topTags.length > 0) {
      return `高频线索：${dimension.topTags.map((item) => item.tag).join("、")}。`;
    }

    return "这个维度本月有记录，但还没有形成可展示的线索。";
  };

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]" data-testid="analysis-dimension-cards">
      {featured ? (
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
            <StatRow label="已保存" value={`${featured.savedEntryCount} 篇`} />
            <StatRow label="覆盖天数" value={`${featured.recordedDayCount} 天`} />
            <StatRow label="最近记录" value={formatAnalysisDateLabel(featured.lastRecordedDate)} />
          </div>
          <div className="mt-4 rounded-[18px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.8)] px-4 py-4">
            <p className="text-[0.76rem] text-[#8b6c4d]">主线说明</p>
            <p className="mt-2 text-[0.92rem] leading-7 text-[#4a3928]">{buildFeaturedSummary(featured)}</p>
          </div>
        </article>
      ) : (
        <article className="rounded-[22px] border border-dashed border-[rgba(150,105,61,0.16)] bg-[rgba(255,249,239,0.34)] p-4" data-testid="analysis-dimension-empty-state">
          <p className="archive-label">五维洞察</p>
          <h3 className="mt-2 font-display text-[1.45rem] leading-none text-[#302114]">本月还没有维度记录</h3>
          <p className="mt-3 text-[0.9rem] leading-7 text-[#72583f]">
            这个月份目前只有评分，没有已保存的维度日志，所以这里不生成主线维度，也不推断任何结构化洞察。
          </p>
        </article>
      ) : null}

      <div className="space-y-3">
        <div className="rounded-[22px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.42)] p-4">
          <p className="archive-label">其余维度</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(supporting.length > 0 ? supporting : interviewDimensions.map((dimension) => ({
              dimension,
              savedEntryCount: 0,
              recordedDayCount: 0,
              lastRecordedDate: null,
              topTags: [],
              recentSignals: []
            }))).map((item) => (
              <div key={item.dimension} className="rounded-[18px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.8)] px-3 py-3">
                <div className="flex items-center gap-2.5">
                  <span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-[0.72rem] font-medium ${getCalendarDimensionVisualMeta(item.dimension).softBadgeClass}`}>
                    {getCalendarDimensionVisualMeta(item.dimension).monthLabel}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.88rem] text-[#3a2c1f]">{getInterviewDimensionMeta(item.dimension).label}</p>
                    <p className="text-[0.74rem] text-[#876b51]">{item.savedEntryCount > 0 ? `${item.savedEntryCount} 篇` : "待记录"}</p>
                  </div>
                </div>
                <p className="mt-2 text-[0.8rem] leading-6 text-[#72583f]">
                  {buildSupportingSummary(item)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.42)] p-4">
          <p className="archive-label">本月提示</p>
          <p className="mt-2 text-[0.9rem] leading-7 text-[#72583f]">五维洞察现在更像一个轻量指引板，不再把五张卡片排成依赖偶数栅格的样子。每张卡都能单独看，主线维度会被放大，其余维度按紧凑列表展开。</p>
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

function DemoDataNotice() {
  return (
    <div
      className="rounded-[18px] border border-[rgba(150,105,61,0.12)] bg-[rgba(255,249,239,0.5)] px-4 py-3 text-[0.86rem] leading-6 text-[#72583f]"
      data-testid="analysis-demo-data-notice"
    >
      当前月份还没有真实分析数据，页面先填入一组示意数据用于展示版式；保存评分和真实记录仍以实际数据为准。
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
  const [record, setRecord] = useState<AnalysisViewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetchError, setHasFetchError] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [activeSection, setActiveSection] = useState<AnalysisSectionKey>(normalizedSearch.section);
  const pendingSectionRef = useRef<AnalysisSectionKey | null>(null);

  useEffect(() => {
    if (normalizedSearch.shouldReplace) {
      router.replace(normalizedSearch.href, { scroll: false });
    }
  }, [normalizedSearch.href, normalizedSearch.shouldReplace, router]);

  useEffect(() => {
    if (pendingSectionRef.current) {
      if (normalizedSearch.section === pendingSectionRef.current) {
        pendingSectionRef.current = null;
      } else {
        return;
      }
    }

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
          setRecord(buildDemoMonthRecord(nextRecord));
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

    pendingSectionRef.current = section;
    setActiveSection(section);

    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", href);
    }

    router.replace(href, { scroll: false });
  }

  const analysisRecord = record;

  return (
    <section className="page-shell min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 md:px-8 md:py-8 xl:px-10" data-testid="analysis-workspace">
      <div className="relative z-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-[46rem]">
            <p className="archive-label">月度归档</p>
            <p className="mt-3 text-pretty text-[0.98rem] leading-8 text-[#6f5a44]">
              {formatAnalysisMonthLabel(normalizedSearch.month)}先看本月的评分、热力和五维线索，再决定去哪里继续看。
            </p>
          </div>
          <div className="min-w-[18rem]">
            <SectionTabs currentSection={activeSection} onChange={navigateSection} />
          </div>
        </div>

        <div className="mt-6 paper-sheet rounded-[28px] px-5 py-5 md:px-6 md:py-6">
          <div className="flex min-h-0 flex-col gap-5">
            {analysisRecord?.usesDemoData ? <DemoDataNotice /> : null}

            {activeSection === "score" ? (
              <AnalysisSection
                index="01"
                eyebrow="评分入口"
                title="幸福 8 要素评分"
                description="把记录页里比较分散的日评分收拢到这里，先看走势，再录入今天和昨天。"
                testId="analysis-score-placeholder"
              >
                {hasFetchError ? (
                  <AnalysisEmptyBanner title="幸福评分暂时没打开" body="稍后再试，或者刷新页面重新拉取这个月的数据。" />
                ) : isLoading || !analysisRecord ? (
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,0.68fr)_minmax(0,1.32fr)]" aria-hidden="true">
                    <div className="h-48 rounded-[20px] bg-[rgba(244,232,208,0.5)]" />
                    <div className="h-80 rounded-[20px] bg-[rgba(244,232,208,0.5)]" />
                  </div>
                ) : (
                  <HappinessScorePanel record={analysisRecord} onSaved={() => setRefreshNonce((value) => value + 1)} />
                )}
              </AnalysisSection>
            ) : null}

            {activeSection === "rhythm" ? (
              <AnalysisSection
                index="02"
                eyebrow="本月热力"
                title="记录热力图"
                description="用一个热力图看出这个月哪几天真正有内容，哪些天只是轻轻经过。"
                testId="analysis-coverage-placeholder"
              >
                {hasFetchError ? (
                  <AnalysisEmptyBanner title="记录热力暂时没打开" body="重新加载后再看本月的热度分布。" />
                ) : isLoading || !analysisRecord ? (
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(15rem,0.6fr)]" aria-hidden="true">
                    <div className="h-[26rem] rounded-[20px] bg-[rgba(244,232,208,0.5)]" />
                    <div className="h-[26rem] rounded-[20px] bg-[rgba(244,232,208,0.5)]" />
                  </div>
                ) : (
                  <CoverageHeatmap record={analysisRecord} />
                )}
              </AnalysisSection>
            ) : null}

            {activeSection === "insights" ? (
              <AnalysisSection
                index="03"
                eyebrow="五维线索"
                title="五维洞察"
                description="五张卡不再按偶数栅格硬排，主线维度会被放大，其余维度用更紧凑的方式展开。"
                testId="analysis-dimensions-placeholder"
              >
                {hasFetchError ? (
                  <AnalysisEmptyBanner title="五维洞察暂时没打开" body="重新加载后再看这个月的维度线索。" />
                ) : isLoading || !analysisRecord ? (
                  <div className="grid gap-2.5 xl:grid-cols-2" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, index) => (
                      <div key={index} className="h-48 rounded-[20px] bg-[rgba(244,232,208,0.5)]" />
                    ))}
                  </div>
                ) : (
                  <DimensionInsights record={analysisRecord} />
                )}
              </AnalysisSection>
            ) : null}

            {analysisRecord ? (
              <AnalysisSection
                index="04"
                eyebrow="月度摘要"
                title="本月概览"
                description="不再把它做成记录页同款的重复概览，而是只保留当前月的摘要与可见变化。"
                testId="analysis-overview-placeholder"
              >
                {hasFetchError ? <AnalysisEmptyBanner title="月度摘要暂时没打开" body="重新加载后再看这个月的摘要。" /> : <OverviewCards record={analysisRecord} />}
              </AnalysisSection>
            ) : null}

            {analysisRecord ? (
              <AnalysisSection
                index="05"
                eyebrow="月度补充"
                title="记录快照"
                description="这里保留少量补充视角，避免整页只有一个主图，同时不给记录页重复内容。"
                testId="analysis-compact-snapshot"
              >
                <div className="grid gap-3 lg:grid-cols-3">
                  <div className="rounded-[18px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.42)] px-4 py-4">
                    <p className="text-[0.76rem] text-[#8b6c4d]">最近完成日</p>
                    <p className="mt-2 font-display text-[1.3rem] text-[#302114]">{formatAnalysisDateLabel(analysisRecord.scoreOverview.latestScoredDate)}</p>
                  </div>
                  <div className="rounded-[18px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.42)] px-4 py-4">
                    <p className="text-[0.76rem] text-[#8b6c4d]">评分月均</p>
                    <p className="mt-2 font-display text-[1.3rem] text-[#302114]">{formatScoreAverage(analysisRecord.scoreOverview.monthAverageScore)}</p>
                  </div>
                  <div className="rounded-[18px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.42)] px-4 py-4">
                    <p className="text-[0.76rem] text-[#8b6c4d]">当前分区</p>
                    <p className="mt-2 font-display text-[1.3rem] text-[#302114]">{sectionTabs.find((tab) => tab.key === activeSection)?.label}</p>
                  </div>
                </div>
              </AnalysisSection>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
