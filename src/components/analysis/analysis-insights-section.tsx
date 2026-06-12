"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { AnalysisDimensionEvidenceExcerpt, AnalysisDimensionInsightCard, AnalysisMonthRecord } from "@/features/analysis/types";
import { getCalendarDimensionVisualMeta } from "@/features/calendar/presentation";
import { buildCalendarHref } from "@/features/calendar/view-state";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import { getInterviewDimensionMeta, interviewDimensions } from "@/features/interview/dimensions";
import type { InterviewDimension } from "@/types/interview";
import { Card, Divider } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  ActionLink,
  buildDimensionSummary,
  buildInterviewHref,
  formatScoreDateLabel
} from "./analysis-shared";

function buildDimensionDrillHref(record: AnalysisMonthRecord, dimension: AnalysisDimensionInsightCard) {
  if (dimension.lastRecordedDate) {
    return buildInterviewHref({
      dimension: dimension.dimension,
      entryDate: dimension.lastRecordedDate,
      panel: "journal"
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

function buildDimensionIndexTheme(dimension: AnalysisDimensionInsightCard) {
  if (dimension.savedEntryCount === 0) {
    return null;
  }

  const leadTitle = dimension.evidence.find((item) => item.title)?.title;

  if (leadTitle) {
    return leadTitle;
  }

  if (dimension.topTags[0]?.tag) {
    return dimension.topTags[0].tag;
  }

  return dimension.evidence[0]?.summary ?? null;
}

function buildDimensionCountLabel(dimension: AnalysisDimensionInsightCard) {
  if (dimension.savedEntryCount === 0) {
    return "本月还没有记录";
  }

  if (dimension.recordedDayCount > 0) {
    return `${dimension.recordedDayCount} 天有记录`;
  }

  return `${dimension.savedEntryCount} 条记录`;
}

function resolveInitialExpandedDimension(dimensions: AnalysisDimensionInsightCard[]) {
  const recordedDimensions = dimensions.filter((item) => item.savedEntryCount > 0);

  if (recordedDimensions.length !== 1) {
    return null;
  }

  const onlyDimension = recordedDimensions[0];

  if (onlyDimension.savedEntryCount <= 2) {
    return onlyDimension.dimension;
  }

  return null;
}

function DimensionEvidencePreview({
  evidence,
  record,
  dimension
}: {
  evidence: AnalysisDimensionEvidenceExcerpt;
  record: AnalysisMonthRecord;
  dimension: AnalysisDimensionInsightCard;
}) {
  const displayTitle = evidence.title ?? evidence.summary;

  return (
    <div
      className="mt-3 border-t border-[var(--line-soft)] pt-3"
      data-testid={`analysis-evidence-preview-${evidence.entryId}`}
    >
      <p className="text-[0.84rem] text-[#3a2c1f]">{displayTitle}</p>
      {evidence.excerpt ? (
        <p className="mt-2 text-[0.82rem] leading-6 text-[#4a3928]">{evidence.excerpt}</p>
      ) : evidence.detail ? (
        <p className="mt-2 text-[0.82rem] leading-6 text-[#4a3928]">{evidence.detail}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-3">
        <ActionLink href={buildCalendarHref({ view: "day", date: evidence.date })} label="在日历中打开" variant="secondary" />
        <ActionLink
          href={buildInterviewHref({
            dimension: dimension.dimension,
            entryDate: evidence.date,
            panel: "journal"
          })}
          label="看完整日志"
          variant="secondary"
        />
        {dimension.savedEntryCount > 0 ? (
          <Link
            href={buildDimensionDrillHref(record, dimension)}
            className="inline-flex items-center text-[0.76rem] text-[#6f4a26] underline-offset-2 hover:underline"
          >
            继续这条线
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function DimensionInsights({ record }: { record: AnalysisMonthRecord }) {
  const orderedDimensions = interviewDimensions
    .map((dimension) => record.dimensions.find((item) => item.dimension === dimension))
    .filter((item): item is AnalysisDimensionInsightCard => Boolean(item));
  const [expandedDimension, setExpandedDimension] = useState<InterviewDimension | null>(() =>
    resolveInitialExpandedDimension(orderedDimensions)
  );
  const [activeEvidenceId, setActiveEvidenceId] = useState<string | null>(null);

  useEffect(() => {
    setExpandedDimension(resolveInitialExpandedDimension(orderedDimensions));
    setActiveEvidenceId(null);
  }, [record.month]);

  const toggleDimension = (dimensionKey: InterviewDimension) => {
    setExpandedDimension((current) => {
      if (current === dimensionKey) {
        setActiveEvidenceId(null);
        return null;
      }

      setActiveEvidenceId(null);
      return dimensionKey;
    });
  };

  const toggleEvidence = (entryId: string) => {
    setActiveEvidenceId((current) => (current === entryId ? null : entryId));
  };

  return (
    <div data-testid="analysis-dimension-cards">
      <p className="text-[0.84rem] leading-6 text-[#72583f]">
        {Number(record.month.slice(5, 7))} 月共 {record.logOverview.recordedDayCount} 天有记录 · {record.logOverview.savedEntryCount} 条已保存日志
      </p>

      <Card className="mt-4 overflow-hidden p-0">
        {orderedDimensions.map((dimension, index) => {
          const isExpanded = expandedDimension === dimension.dimension;
          const indexTheme = buildDimensionIndexTheme(dimension);
          const activeEvidence =
            dimension.evidence.find((item) => item.entryId === activeEvidenceId) ?? null;

          return (
            <div key={dimension.dimension} data-testid={`analysis-dimension-row-${dimension.dimension}`}>
              {index > 0 ? <Divider /> : null}
              <button
                type="button"
                aria-expanded={isExpanded}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-paper/60",
                  isExpanded && "bg-sand/30"
                )}
                onClick={() => toggleDimension(dimension.dimension)}
              >
                <span
                  className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full border text-[0.72rem] font-medium ${getCalendarDimensionVisualMeta(dimension.dimension).softBadgeClass}`}
                >
                  {getCalendarDimensionVisualMeta(dimension.dimension).monthLabel}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-[0.9rem] text-[#3a2c1f]">{getInterviewDimensionMeta(dimension.dimension).label}</span>
                    {indexTheme ? (
                      <span className="truncate text-[0.82rem] text-[#72583f]">{indexTheme}</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[0.72rem] text-[#8b6c4d]">{buildDimensionCountLabel(dimension)}</span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-[0.72rem] text-[#8b6c4d]">
                  {isExpanded ? "▼" : "▶"}
                </span>
              </button>

              {isExpanded ? (
                <div className="px-4 pb-4" data-testid={`analysis-dimension-panel-${dimension.dimension}`}>
                  {dimension.savedEntryCount > 0 ? (
                    <>
                      <p className="text-[0.86rem] leading-6 text-[#4a3928]">
                        {buildDimensionSummary(dimension, record.narrative)}
                      </p>

                      {dimension.evidence.length > 0 ? (
                        <div className="mt-4">
                          <p className="text-[0.72rem] text-[#8b6c4d]">代表片段</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {dimension.evidence.map((evidence) => {
                              const isActive = activeEvidenceId === evidence.entryId;

                              return (
                                <button
                                  key={evidence.entryId}
                                  type="button"
                                  aria-pressed={isActive}
                                  data-testid={`analysis-evidence-chip-${evidence.entryId}`}
                                  className={cn(
                                    "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.72rem] transition",
                                    isActive
                                      ? "border-[var(--line-strong)] bg-sand/50 text-[#3a2c1f]"
                                      : "border-[var(--line-soft)] bg-paper/80 text-[#6f5339] hover:bg-paper"
                                  )}
                                  onClick={() => toggleEvidence(evidence.entryId)}
                                >
                                  {formatScoreDateLabel(evidence.date)}
                                </button>
                              );
                            })}
                          </div>

                          {activeEvidence ? (
                            <DimensionEvidencePreview evidence={activeEvidence} record={record} dimension={dimension} />
                          ) : (
                            <p className="mt-3 text-[0.74rem] leading-5 text-[#8b6c4d]">点日期查看这一天的正文摘录。</p>
                          )}
                        </div>
                      ) : (
                        <p className="ui-quote mt-3 text-[0.74rem] leading-5">这条线已有记录，但还没有足够清晰的片段摘要。</p>
                      )}
                    </>
                  ) : (
                    <div>
                      <p className="text-[0.84rem] leading-6 text-[#72583f]">{dimension.nextQuestion}</p>
                      <div className="mt-3">
                        <ActionLink href={buildDimensionDrillHref(record, dimension)} label="去记录" variant="primary" />
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
