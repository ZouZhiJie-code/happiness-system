"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { AnalysisMonthRecord } from "@/features/analysis/types";
import {
  formatAnalysisMonthLabel,
  getTodayAnalysisMonth,
  normalizeAnalysisSearchParams
} from "@/features/analysis/view-state";
import { buildCalendarMonthGrid } from "@/features/calendar/view-state";
import { getCalendarDimensionVisualMeta } from "@/features/calendar/presentation";
import { getInterviewDimensionMeta } from "@/features/interview/dimensions";
import type {
  DailyHappinessScoreKey,
  HappinessScoreRequestKey
} from "@/features/happiness-score/types";

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
    <section
      className="border-t border-[rgba(150,105,61,0.12)] pt-5 first:border-t-0 first:pt-0"
      data-testid={testId}
    >
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

function OverviewSkeleton() {
  return (
    <div className="grid gap-2.5 sm:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="rounded-[18px] border border-[rgba(150,105,61,0.12)] bg-[rgba(255,249,239,0.44)] px-4 py-4"
        >
          <div className="h-2 w-16 rounded-full bg-[rgba(189,151,104,0.28)]" />
          <div className="mt-3 h-8 w-12 rounded-full bg-[rgba(189,151,104,0.4)]" />
          <div className="mt-3 h-2 w-[80%] rounded-full bg-[rgba(189,151,104,0.2)]" />
        </div>
      ))}
    </div>
  );
}

function OverviewCards({ record }: { record: AnalysisMonthRecord }) {
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
        <article
          key={item.id}
          className="rounded-[18px] border border-[rgba(150,105,61,0.12)] bg-[rgba(255,249,239,0.48)] px-4 py-4"
        >
          <p className="text-[0.78rem] text-[#8a6b4b]">{item.label}</p>
          <p className="mt-2 font-display text-[2rem] leading-none tabular-nums text-[#302114]">{item.value}</p>
          <p className="mt-2 text-pretty text-[0.82rem] leading-6 text-[#7a624b]">{item.detail}</p>
        </article>
      ))}
    </div>
  );
}

function CoverageSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)]" aria-hidden="true">
      <div className="rounded-[18px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.34)] p-3.5">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 14 }, (_, index) => (
            <div key={index} className="h-[4.1rem] rounded-[16px] bg-[rgba(244,232,208,0.56)]" />
          ))}
        </div>
      </div>
      <div className="rounded-[18px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.34)] p-3.5">
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-11 rounded-[14px] bg-[rgba(244,232,208,0.56)]" />
          ))}
        </div>
      </div>
    </div>
  );
}

function CoverageBoard({ record }: { record: AnalysisMonthRecord }) {
  const daysByDate = new Map(record.dailyCoverage.map((day) => [day.date, day]));
  const cells = buildCalendarMonthGrid(record.month);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)]" data-testid="analysis-coverage-board">
      <div className="rounded-[18px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.34)] p-3.5">
        <div className="grid grid-cols-7 gap-2" data-testid="analysis-coverage-grid">
          {cells.map((cell) => {
            if (!cell.isCurrentMonth || !cell.date) {
              return (
                <div
                  key={cell.key}
                  className="h-[4.1rem] rounded-[16px] border border-dashed border-[rgba(150,105,61,0.06)] bg-[rgba(255,249,239,0.18)]"
                  aria-hidden="true"
                />
              );
            }

            const coverage = daysByDate.get(cell.date);

            if (!coverage) {
              return null;
            }

            return (
              <div
                key={cell.key}
                className="flex h-[4.1rem] flex-col rounded-[16px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.82)] px-2.5 py-2"
                data-testid={`analysis-coverage-day-${coverage.date}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[0.72rem] tabular-nums text-[#8e6a46]">{cell.dayNumber}</span>
                  {coverage.hasDailyJournalSaved ? (
                    <span
                      className="size-2.5 rounded-full border border-[rgba(169,111,61,0.24)] bg-[rgba(169,111,61,0.92)]"
                      aria-label="当天整合日志已保存"
                      title="当天整合日志已保存"
                    />
                  ) : null}
                </div>
                <div className="mt-auto">
                  <p className="font-mono text-[0.74rem] tabular-nums text-[#4b3a2b]">
                    {coverage.savedDimensionCount > 0 ? `${coverage.savedDimensionCount}维` : "0维"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1" aria-label={`涉及维度 ${coverage.savedDimensions.map((dimension) => getInterviewDimensionMeta(dimension).label).join("、") || "无"}`}>
                    {coverage.savedDimensions.slice(0, 5).map((dimension) => {
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
              </div>
            );
          })}
        </div>
      </div>

      <aside className="rounded-[18px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.34)] p-3.5">
        <p className="archive-label">维度重心</p>
        <div className="mt-3 space-y-2" data-testid="analysis-dimension-breakdown">
          {record.dimensionBreakdown.map((item) => {
            const visualMeta = getCalendarDimensionVisualMeta(item.dimension);

            return (
              <div
                key={item.dimension}
                className="flex items-center justify-between gap-3 rounded-[15px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,252,246,0.76)] px-3.5 py-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-[0.74rem] font-medium ${visualMeta.softBadgeClass}`}>
                    {visualMeta.monthLabel}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.88rem] text-[#3a2c1f]">{getInterviewDimensionMeta(item.dimension).label}</p>
                    <p className="text-[0.75rem] text-[#876b51]">覆盖 {item.recordedDayCount} 天</p>
                  </div>
                </div>
                <p className="shrink-0 font-mono text-[0.84rem] tabular-nums text-[#604529]">{item.savedEntryCount} 篇</p>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function CoverageEmptyState() {
  return (
    <div
      className="rounded-[18px] border border-dashed border-[rgba(150,105,61,0.16)] bg-[rgba(255,249,239,0.28)] px-4 py-5 text-[0.9rem] leading-7 text-[#7a624b]"
      data-testid="analysis-coverage-empty"
    >
      本月还没有形成已保存记录。
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

function DimensionInsightsSkeleton() {
  return (
    <div className="grid gap-2.5 xl:grid-cols-2" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="rounded-[18px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,249,239,0.36)] px-4 py-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="h-7 w-24 rounded-full bg-[rgba(189,151,104,0.28)]" />
            <div className="h-2 w-20 rounded-full bg-[rgba(189,151,104,0.22)]" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }, (_, metricIndex) => (
              <div key={metricIndex} className="h-14 rounded-[14px] bg-[rgba(244,232,208,0.56)]" />
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            {Array.from({ length: 3 }, (_, tagIndex) => (
              <div key={tagIndex} className="h-7 w-16 rounded-full bg-[rgba(244,232,208,0.56)]" />
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {Array.from({ length: 2 }, (_, rowIndex) => (
              <div key={rowIndex} className="h-14 rounded-[14px] bg-[rgba(244,232,208,0.56)]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DimensionInsightCards({ record }: { record: AnalysisMonthRecord }) {
  return (
    <div className="grid gap-2.5 xl:grid-cols-2" data-testid="analysis-dimension-cards">
      {record.dimensions.map((item) => {
        const visualMeta = getCalendarDimensionVisualMeta(item.dimension);
        const dimensionMeta = getInterviewDimensionMeta(item.dimension);

        return (
          <article
            key={item.dimension}
            className="rounded-[18px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.82)] px-4 py-4"
            data-testid={`analysis-dimension-card-${item.dimension}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full border text-[0.74rem] font-medium ${visualMeta.softBadgeClass}`}>
                  {visualMeta.monthLabel}
                </span>
                <div className="min-w-0">
                  <p className="text-[0.94rem] text-[#3a2c1f]">{dimensionMeta.label}</p>
                  <p className="text-[0.76rem] text-[#876b51]">{formatAnalysisDateLabel(item.lastRecordedDate)}</p>
                </div>
              </div>
              <p className="text-[0.76rem] text-[#8b6c4d]">最近记录</p>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-[14px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,249,239,0.42)] px-3 py-2.5">
                <p className="text-[0.72rem] text-[#8b6c4d]">已保存</p>
                <p className="mt-1 font-mono text-[1.05rem] tabular-nums text-[#4b3727]">{item.savedEntryCount} 篇</p>
              </div>
              <div className="rounded-[14px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,249,239,0.42)] px-3 py-2.5">
                <p className="text-[0.72rem] text-[#8b6c4d]">覆盖天数</p>
                <p className="mt-1 font-mono text-[1.05rem] tabular-nums text-[#4b3727]">{item.recordedDayCount} 天</p>
              </div>
              <div className="rounded-[14px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,249,239,0.42)] px-3 py-2.5">
                <p className="text-[0.72rem] text-[#8b6c4d]">高频标签</p>
                <p className="mt-1 font-mono text-[1.05rem] tabular-nums text-[#4b3727]">{item.topTags.length} 个</p>
              </div>
            </div>

            <div className="mt-3">
              <p className="text-[0.76rem] text-[#8b6c4d]">高频标签</p>
              {item.topTags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.topTags.map((tag) => (
                    <span
                      key={tag.tag}
                      className="inline-flex items-center gap-1 rounded-full border border-[rgba(150,105,61,0.12)] bg-[rgba(255,249,239,0.7)] px-2.5 py-1 text-[0.74rem] text-[#5f4833]"
                    >
                      <span>{tag.tag}</span>
                      <span className="font-mono tabular-nums text-[#8b6c4d]">{tag.count}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[0.82rem] leading-6 text-[#866b53]">本月还没有稳定标签。</p>
              )}
            </div>

            <div className="mt-3">
              <p className="text-[0.76rem] text-[#8b6c4d]">最近线索</p>
              {item.recentSignals.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {item.recentSignals.map((signal) => (
                    <div
                      key={`${item.dimension}-${signal.entryId}`}
                      className="rounded-[14px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,249,239,0.38)] px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[0.82rem] text-[#4b3727]">{signal.primarySignal}</p>
                        <span className="shrink-0 font-mono text-[0.72rem] tabular-nums text-[#8b6c4d]">
                          {formatAnalysisDateLabel(signal.date)}
                        </span>
                      </div>
                      {signal.secondarySignal ? (
                        <p className="mt-1 text-[0.76rem] leading-6 text-[#7a624b]">{signal.secondarySignal}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[0.82rem] leading-6 text-[#866b53]">本月还没有可展示的结构化线索。</p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
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

  return Object.fromEntries(
    happinessScoreItems.map((item) => [item.requestKey, existing[item.recordKey]])
  ) as ScoreFormState;
}

function isCompleteScoreForm(scores: ScoreFormState): scores is Record<HappinessScoreRequestKey, number> {
  return happinessScoreItems.every((item) => {
    const value = scores[item.requestKey];
    return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10;
  });
}

function HappinessScorePanel({
  record,
  onSaved
}: {
  record: AnalysisMonthRecord;
  onSaved: () => void;
}) {
  const [selectedDate, setSelectedDate] = useState(record.editableDates[0] ?? null);
  const [scores, setScores] = useState<ScoreFormState>(() =>
    record.editableDates[0] ? buildScoreFormState(record, record.editableDates[0]) : {}
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    const nextDate = selectedDate && record.editableDates.includes(selectedDate)
      ? selectedDate
      : record.editableDates[0] ?? null;

    setSelectedDate(nextDate);
    setScores(nextDate ? buildScoreFormState(record, nextDate) : {});
    setSaveError(false);
  }, [record, selectedDate]);

  if (record.editableDates.length === 0 || !selectedDate) {
    return (
      <div
        className="rounded-[20px] border border-dashed border-[rgba(150,105,61,0.18)] bg-[rgba(255,249,239,0.32)] px-4 py-5 text-[0.9rem] leading-7 text-[#7a624b]"
        data-testid="happiness-score-readonly"
      >
        这个月份的评分只能查看，不能修改。评分录入只开放今天和昨天。
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
    <div className="grid gap-3 lg:grid-cols-[minmax(0,0.68fr)_minmax(0,1.32fr)]" data-testid="happiness-score-panel">
      <aside className="rounded-[20px] border border-[rgba(150,105,61,0.1)] bg-[linear-gradient(145deg,rgba(255,252,246,0.9),rgba(246,230,202,0.42))] p-4">
        <p className="archive-label">日评分</p>
        <h3 className="mt-3 font-display text-[1.55rem] leading-none text-[#302114]">8 个要素，先给今天一个刻度</h3>
        <p className="mt-3 text-pretty text-[0.88rem] leading-7 text-[#72583f]">
          这里不是写总结，只记录当天状态。填完 8 项后保存，页面会立即刷新到最新分数。
        </p>

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
                  selectedDate === date
                    ? "bg-[#6f4a26] text-[#fffaf1] shadow-[0_8px_18px_rgba(86,58,28,0.18)]"
                    : "text-[#7a6048] hover:bg-[rgba(255,252,246,0.84)]"
                }`}
                aria-pressed={selectedDate === date}
              >
                {resolveScoreDateShortcut(date, record.editableDates)}
              </button>
            ))}
          </div>
        ) : null}

        <p className="mt-3 font-mono text-[0.76rem] tabular-nums text-[#8a6b4b]">
          当前日期：{formatScoreDateLabel(selectedDate)}
        </p>
      </aside>

      <div className="rounded-[20px] border border-[rgba(150,105,61,0.1)] bg-[rgba(255,252,246,0.82)] p-3.5">
        <div className="space-y-2.5">
          {happinessScoreItems.map((item) => {
            const value = scores[item.requestKey];
            const sliderValue = value ?? 5;

            return (
              <label
                key={item.requestKey}
                className="grid gap-3 rounded-[16px] border border-[rgba(150,105,61,0.08)] bg-[rgba(255,249,239,0.42)] px-3.5 py-3 md:grid-cols-[8rem_minmax(0,1fr)_3.5rem] md:items-center"
              >
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
          <p className="text-[0.78rem] leading-6 text-[#80634a]">
            {canSave ? "8 项已填完，可以保存。" : "8 项全部填完后才能保存。"}
          </p>
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
  );
}

export function AnalysisShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const todayMonth = getTodayAnalysisMonth();
  const normalizedSearch = normalizeAnalysisSearchParams({
    month: searchParams.get("month"),
    today: todayMonth
  });
  const [record, setRecord] = useState<AnalysisMonthRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetchError, setHasFetchError] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    const currentHref = `/analysis?month=${searchParams.get("month") ?? ""}`;

    if (currentHref !== normalizedSearch.href) {
      router.replace(normalizedSearch.href, { scroll: false });
    }
  }, [normalizedSearch.href, router, searchParams]);

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
    <section
      className="page-shell min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 md:px-8 md:py-8 xl:px-10"
      data-testid="analysis-workspace"
    >
      <div className="relative z-10">
        <div className="max-w-[46rem]">
          <p className="archive-label">月度归档</p>
          <p className="mt-3 text-pretty text-[0.98rem] leading-8 text-[#6f5a44]">
            {formatAnalysisMonthLabel(normalizedSearch.month)}先看这个月已经沉淀下来的记录分布和五维线索，幸福评分趋势会在后续接入。
          </p>
        </div>

        <div className="mt-6 paper-sheet rounded-[28px] px-5 py-5 md:px-6 md:py-6">
          <div className="flex min-h-0 flex-col gap-5">
            <AnalysisSection
              index="01"
              eyebrow="月度概览"
              title="本月概览"
              description="先看这个月已经形成了多少条已保存记录，以及多少天真正沉淀了下来。"
              testId="analysis-overview-placeholder"
            >
              {hasFetchError ? (
                <div className="rounded-[18px] border border-[rgba(150,105,61,0.12)] bg-[rgba(255,249,239,0.34)] px-4 py-4 text-[0.9rem] leading-7 text-[#7a624b]" role="alert">
                  本月记录分析暂时没打开。
                  <button
                    type="button"
                    onClick={() => setRefreshNonce((value) => value + 1)}
                    className="ml-3 rounded-full border border-[rgba(171,118,64,0.18)] bg-[rgba(255,249,239,0.84)] px-3 py-1.5 text-[0.78rem] text-[#604529]"
                  >
                    重新加载
                  </button>
                </div>
              ) : isLoading || !record ? (
                <OverviewSkeleton />
              ) : (
                <OverviewCards record={record} />
              )}
            </AnalysisSection>
            <AnalysisSection
              index="02"
              eyebrow="按天分布"
              title="记录分布"
              description="确认哪些天形成了结果，哪些维度更常出现。这里先只看已保存记录，不混入进行中和草稿。"
              testId="analysis-coverage-placeholder"
            >
              {hasFetchError ? (
                <div className="rounded-[18px] border border-[rgba(150,105,61,0.12)] bg-[rgba(255,249,239,0.34)] px-4 py-4 text-[0.9rem] leading-7 text-[#7a624b]" role="alert">
                  记录分布暂时没打开。
                </div>
              ) : isLoading || !record ? (
                <CoverageSkeleton />
              ) : record.logOverview.savedEntryCount === 0 ? (
                <CoverageEmptyState />
              ) : (
                <CoverageBoard record={record} />
              )}
            </AnalysisSection>
            <AnalysisSection
              index="03"
              eyebrow="五维线索"
              title="五维洞察"
              description="把开心、充实、思考、改进和感谢的已保存线索收成五张只读卡，只看确定性聚合，不做 AI 二次总结。"
              testId="analysis-dimensions-placeholder"
            >
              {hasFetchError ? (
                <div className="rounded-[18px] border border-[rgba(150,105,61,0.12)] bg-[rgba(255,249,239,0.34)] px-4 py-4 text-[0.9rem] leading-7 text-[#7a624b]" role="alert">
                  五维洞察暂时没打开。
                </div>
              ) : isLoading || !record ? (
                <DimensionInsightsSkeleton />
              ) : (
                <DimensionInsightCards record={record} />
              )}
            </AnalysisSection>
            <AnalysisSection
              index="04"
              eyebrow="日评分"
              title="幸福 8 要素评分"
              description="这里是本页唯一可编辑模块。只填写今天和昨天的 1-10 分，旧月份保持只读。"
              testId="analysis-score-placeholder"
            >
              {hasFetchError ? (
                <div className="rounded-[18px] border border-[rgba(150,105,61,0.12)] bg-[rgba(255,249,239,0.34)] px-4 py-4 text-[0.9rem] leading-7 text-[#7a624b]" role="alert">
                  幸福评分暂时没打开。
                </div>
              ) : isLoading || !record ? (
                <div className="grid gap-3 lg:grid-cols-[minmax(0,0.68fr)_minmax(0,1.32fr)]" aria-hidden="true">
                  <div className="h-48 rounded-[20px] bg-[rgba(244,232,208,0.5)]" />
                  <div className="h-80 rounded-[20px] bg-[rgba(244,232,208,0.5)]" />
                </div>
              ) : (
                <HappinessScorePanel record={record} onSaved={() => setRefreshNonce((value) => value + 1)} />
              )}
            </AnalysisSection>
          </div>
        </div>
      </div>
    </section>
  );
}
