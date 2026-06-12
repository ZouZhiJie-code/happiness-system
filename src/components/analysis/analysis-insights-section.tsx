"use client";

import Link from "next/link";

import type { AnalysisDimensionInsightCard, AnalysisMonthRecord } from "@/features/analysis/types";
import { buildAnalysisHref } from "@/features/analysis/view-state";
import { getCalendarDimensionVisualMeta } from "@/features/calendar/presentation";
import { buildCalendarHref } from "@/features/calendar/view-state";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import { getInterviewDimensionMeta, interviewDimensions } from "@/features/interview/dimensions";
import { Card, Divider } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  ANALYSIS_CHIP_CLASS,
  ActionLink,
  buildDailyJournalHref,
  buildDimensionSummary,
  buildInterviewHref,
  findCoverageDay,
  formatAnalysisDateLabel,
  formatScoreDateLabel,
  getDimensionConfidenceLabel,
  getDimensionContinuityLabel,
  getDimensionMomentumLabel,
  getFeaturedDimension,
  happinessScoreItems
} from "./analysis-shared";

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

export function DimensionInsights({ record }: { record: AnalysisMonthRecord }) {
  const featured = getFeaturedDimension(record);
  const orderedDimensions = interviewDimensions
    .map((dimension) => record.dimensions.find((item) => item.dimension === dimension))
    .filter((item): item is AnalysisDimensionInsightCard => Boolean(item));
  const actionItems = buildInsightActionItems(record, featured);

  if (!featured) {
    return (
      <div data-testid="analysis-dimension-cards">
        <div data-testid="analysis-dimension-empty-state">
          <p className="archive-label">五维线索</p>
          <h3 className="mt-2 font-display text-[1.45rem] leading-none text-[#302114]">这个月还没有形成文字线索</h3>
          <p className="mt-3 text-[0.9rem] leading-7 text-[#72583f]">
            {record.scoreOverview.scoredDayCount > 0
              ? "这个月已经有评分起伏，但还没有足够的已保存记录把五维线索说清楚。"
              : "这个月还没有已保存记录，先从一个维度开始，之后这里才会慢慢长出线索。"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <ActionLink href="/interview?dimension=joy" label="开始一条记录" variant="primary" />
            <ActionLink href={buildAnalysisHref({ month: record.month, section: "trends" })} label="先去补评分" />
          </div>
        </div>

        <Divider className="my-5" />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {orderedDimensions.map((dimension) => (
            <Card as="article" key={dimension.dimension} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full border text-[0.72rem] font-medium ${getCalendarDimensionVisualMeta(dimension.dimension).softBadgeClass}`}>
                    {getCalendarDimensionVisualMeta(dimension.dimension).monthLabel}
                  </span>
                  <p className="text-[0.9rem] text-[#3a2c1f]">{getInterviewDimensionMeta(dimension.dimension).label}</p>
                </div>
                <span className={ANALYSIS_CHIP_CLASS}>还没展开</span>
              </div>
              <p className="mt-3 text-[0.82rem] leading-6 text-[#72583f]">{dimension.nextQuestion}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="analysis-dimension-cards">
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="archive-label">本月判断</p>
          <span className={ANALYSIS_CHIP_CLASS}>主线：{getInterviewDimensionMeta(featured.dimension).label}</span>
        </div>
        <h3 className="mt-3 font-display text-[1.42rem] leading-none text-[#302114]">{record.insightsOverview.headline}</h3>
        <p className="mt-3 max-w-[48rem] text-pretty text-[0.9rem] leading-7 text-[#72583f]">{record.insightsOverview.summary}</p>
        {record.insightsOverview.watchpoint ? (
          <p className="ui-quote mt-3 text-[0.82rem] leading-6">还值得留意的是：{record.insightsOverview.watchpoint}</p>
        ) : null}
      </div>

      <Divider className="my-5" />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {orderedDimensions.map((dimension) => {
          const isFeatured = dimension.dimension === featured.dimension;
          const relatedScoreFactors = formatRelatedScoreFactorLabels(dimension);
          const scoreSummary = getDimensionScoreSummary(dimension);

          return (
            <Card
              as="article"
              key={dimension.dimension}
              data-testid={isFeatured ? `analysis-dimension-featured-${dimension.dimension}` : undefined}
              className={cn("p-4", isFeatured && "border-[var(--line-strong)] bg-sand/40")}
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
                <span className={ANALYSIS_CHIP_CLASS}>
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
                <div className="ui-quote mt-3">
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
                <p className="ui-quote mt-3 text-[0.74rem] leading-5">这条线还在起笔，先不用急着下结论。</p>
              )}

              <div className="mt-3 space-y-2">
                {relatedScoreFactors.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {relatedScoreFactors.map((label) => (
                      <span key={label} className="inline-flex items-center rounded-full border border-[var(--line-soft)] bg-paper/80 px-2 py-0.5 text-[0.68rem] text-[#6f5339]">
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
            </Card>
          );
        })}
      </div>

      <Divider className="my-5" />

      <div className="grid gap-x-8 gap-y-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <section>
          <p className="archive-label">维度之间</p>
          <h3 className="mt-2 font-display text-[1.3rem] leading-none text-[#302114]">别只看哪条写得多，也看它和谁连在一起，和评分怎么接上</h3>
          {record.insightsOverview.links.length > 0 ? (
            <div className="mt-4">
              {record.insightsOverview.links.map((link, index) => (
                <div key={`${link.type}-${index}`} className="border-t border-[var(--line-soft)] py-3 first:border-t-0 first:pt-0">
                  <p className="text-[0.74rem] text-[#8b6c4d]">{link.title}</p>
                  <p className="mt-1 text-[0.84rem] leading-6 text-[#4a3928]">{link.detail}</p>
                  {link.anchorDate ? (
                    <div className="mt-2 -ml-1.5">
                      <ActionLink href={buildCalendarHref({ view: "day", date: link.anchorDate })} label="回到那一天" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="ui-quote mt-4 text-[0.84rem] leading-6">
              这个月的材料还不够多，先把五条线各自写清楚，关系层才会慢慢出现。
            </p>
          )}
        </section>

        <section>
          <p className="archive-label">下一步</p>
          <h3 className="mt-2 font-display text-[1.3rem] leading-none text-[#302114]">先做哪一步，最容易把这个月看清楚</h3>
          <div className="mt-4">
            {actionItems.map((action) => (
              <div key={action.title} className="border-t border-[var(--line-soft)] py-3 first:border-t-0 first:pt-0">
                <p className="text-[0.86rem] text-[#3a2c1f]">{action.title}</p>
                <p className="mt-1 text-[0.8rem] leading-6 text-[#72583f]">{action.body}</p>
                <div className="mt-2.5">
                  <ActionLink href={action.href} label={action.label} variant="primary" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
