import { getInterviewDimensionMeta, interviewDimensions } from "@/features/interview/dimensions";
import { buildAnalysisMonthCoverage } from "@/features/analysis/month-coverage";
import { buildAnalysisMonthDimensions } from "@/features/analysis/month-dimensions";
import { compareDateDesc } from "@/features/analysis/month-aggregation-utils";
import type {
  AnalysisDailyCoverageDay,
  AnalysisDimensionRelationship,
  AnalysisDimensionInsightCard,
  AnalysisInsightsOverview,
  AnalysisMonthRecord,
  AnalysisSavedDailyJournalSource,
  AnalysisSavedEntrySource
} from "@/features/analysis/types";
import type { DailyHappinessScoreRecord } from "@/features/happiness-score/types";
import type { InterviewDimension } from "@/types/interview";

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

  return compareDateDesc(left.lastRecordedDate, right.lastRecordedDate);
}

function buildPairingLink(dailyCoverage: AnalysisDailyCoverageDay[]) {
  const pairCounts = dailyCoverage.reduce((stats, day) => {
    if (day.savedDimensions.length < 2) {
      return stats;
    }

    for (let leftIndex = 0; leftIndex < day.savedDimensions.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < day.savedDimensions.length; rightIndex += 1) {
        const pair = [day.savedDimensions[leftIndex], day.savedDimensions[rightIndex]].sort().join("|");
        const current = stats.get(pair);

        if (current) {
          current.count += 1;
          current.latestDate = day.date > current.latestDate ? day.date : current.latestDate;
        } else {
          stats.set(pair, {
            count: 1,
            latestDate: day.date
          });
        }
      }
    }

    return stats;
  }, new Map<string, { count: number; latestDate: string }>());

  const topPair = [...pairCounts.entries()].sort((left, right) => {
    if (right[1].count !== left[1].count) {
      return right[1].count - left[1].count;
    }

    return compareDateDesc(left[1].latestDate, right[1].latestDate);
  })[0];

  if (!topPair) {
    return null;
  }

  const [leftDimension, rightDimension] = topPair[0].split("|") as InterviewDimension[];
  const leftLabel = getInterviewDimensionMeta(leftDimension).label;
  const rightLabel = getInterviewDimensionMeta(rightDimension).label;

  return {
    type: "pairing",
    title: "常常会一起出现",
    detail:
      topPair[1].count > 1
        ? `这个月里，${leftLabel}和${rightLabel}有 ${topPair[1].count} 天一起出现。`
        : `${formatDateLabel(topPair[1].latestDate)}这一天，${leftLabel}和${rightLabel}一起冒了出来。`,
    dimensions: [leftDimension, rightDimension],
    anchorDate: topPair[1].latestDate
  } satisfies AnalysisDimensionRelationship;
}

function buildFollowupLink(dimensions: AnalysisDimensionInsightCard[]) {
  const featured = [...dimensions]
    .filter((item) => item.savedEntryCount > 0)
    .sort(compareDimensionInsights)[0];

  if (!featured) {
    return null;
  }

  const related = featured.relatedDimensions
    .map((dimension) => dimensions.find((item) => item.dimension === dimension))
    .filter((item): item is AnalysisDimensionInsightCard => item != null && item.savedEntryCount > 0)
    .sort(compareDimensionInsights)[0];

  if (!related) {
    return null;
  }

  return {
    type: "followup",
    title: "旁边一起在动的",
    detail: `顺着${getInterviewDimensionMeta(featured.dimension).label}往下看，最容易接上的，是${getInterviewDimensionMeta(related.dimension).label}这条线。`,
    dimensions: [featured.dimension, related.dimension],
    anchorDate: related.turningPointDate ?? related.lastRecordedDate
  } satisfies AnalysisDimensionRelationship;
}

function buildGapLink(dimensions: AnalysisDimensionInsightCard[]) {
  const quietDimensions = dimensions.filter((item) => item.savedEntryCount === 0).map((item) => item.dimension);

  if (quietDimensions.length === 0) {
    return null;
  }

  const labels = quietDimensions.slice(0, 2).map((dimension) => getInterviewDimensionMeta(dimension).label);
  const joinedLabels = labels.join("、");

  return {
    type: "gap",
    title: "还没怎么展开的",
    detail:
      quietDimensions.length === 1
        ? `${joinedLabels}这条线，这个月还没有留下已保存记录。`
        : `${joinedLabels}这几条线，这个月还没有留下已保存记录。`,
    dimensions: quietDimensions,
    anchorDate: null
  } satisfies AnalysisDimensionRelationship;
}

function rankQuietLaggingDimensions(dimensions: AnalysisDimensionInsightCard[]) {
  return dimensions
    .filter((item) => item.savedEntryCount === 0 && item.scoreLink.status === "lagging")
    .sort((left, right) => {
      const leftAverage = left.scoreLink.average ?? Number.POSITIVE_INFINITY;
      const rightAverage = right.scoreLink.average ?? Number.POSITIVE_INFINITY;

      if (leftAverage !== rightAverage) {
        return leftAverage - rightAverage;
      }

      return interviewDimensions.indexOf(left.dimension) - interviewDimensions.indexOf(right.dimension);
    });
}

function rankQuietMissingDimensions(dimensions: AnalysisDimensionInsightCard[]) {
  return dimensions
    .filter((item) => item.savedEntryCount === 0 && item.scoreLink.status === "missing")
    .sort((left, right) => interviewDimensions.indexOf(left.dimension) - interviewDimensions.indexOf(right.dimension));
}

function buildScoreLink(dimensions: AnalysisDimensionInsightCard[]) {
  const featured = [...dimensions]
    .filter((item) => item.savedEntryCount > 0)
    .sort(compareDimensionInsights)[0];

  if (!featured || !featured.scoreLink.summary) {
    return null;
  }

  const lowQuietDimension = rankQuietLaggingDimensions(dimensions)[0];

  if (featured.scoreLink.status === "supporting") {
    return {
      type: "score",
      title: "评分里也在呼应",
      detail: featured.scoreLink.summary,
      dimensions: [featured.dimension],
      anchorDate: featured.turningPointDate ?? featured.lastRecordedDate
    } satisfies AnalysisDimensionRelationship;
  }

  if (lowQuietDimension?.scoreLink.summary) {
    return {
      type: "score",
      title: "评分低点还没写出来",
      detail: lowQuietDimension.scoreLink.summary,
      dimensions: [lowQuietDimension.dimension],
      anchorDate: null
    } satisfies AnalysisDimensionRelationship;
  }

  if (featured.scoreLink.status === "lagging") {
    return {
      type: "score",
      title: "记录和评分还没完全接上",
      detail: featured.scoreLink.summary,
      dimensions: [featured.dimension],
      anchorDate: featured.turningPointDate ?? featured.lastRecordedDate
    } satisfies AnalysisDimensionRelationship;
  }

  return null;
}

function formatDateLabel(date: string | null) {
  if (!date) {
    return "这一天";
  }

  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
}

function buildInsightsHeadline(input: {
  featured: AnalysisDimensionInsightCard | null;
  related: AnalysisDimensionInsightCard | null;
  quietLagging: AnalysisDimensionInsightCard | null;
}) {
  if (!input.featured) {
    return "这个月先别急着下五维结论。";
  }

  const featuredLabel = getInterviewDimensionMeta(input.featured.dimension).label;

  if (input.related && input.quietLagging) {
    return `${featuredLabel}是主线，${getInterviewDimensionMeta(input.related.dimension).label}在旁边接上了它，${getInterviewDimensionMeta(input.quietLagging.dimension).label}还没真正展开。`;
  }

  if (input.related) {
    return `${featuredLabel}是这个月最清楚的一条线，${getInterviewDimensionMeta(input.related.dimension).label}也已经开始接上。`;
  }

  if (input.quietLagging) {
    return `${featuredLabel}已经写清楚了，但${getInterviewDimensionMeta(input.quietLagging.dimension).label}这条线还空着。`;
  }

  return `${featuredLabel}是这个月最清楚的一条线。`;
}

function isPendingDailyJournalDay(day: AnalysisDailyCoverageDay) {
  return day.hasStaleDailyJournal || (day.savedDimensionCount > 0 && !day.hasDailyJournalSaved);
}

function buildInsightsOverview(dimensions: AnalysisDimensionInsightCard[], dailyCoverage: AnalysisDailyCoverageDay[]) {
  const sortedDimensions = [...dimensions]
    .filter((item) => item.savedEntryCount > 0)
    .sort(compareDimensionInsights);
  const featured = sortedDimensions[0] ?? null;
  const quietDimensions = dimensions.filter((item) => item.savedEntryCount === 0).map((item) => item.dimension);
  const scoreOnlyDayCount = dailyCoverage.filter(
    (day) => day.hasScore && day.savedDimensionCount === 0 && !day.hasDailyJournalSaved
  ).length;
  const staleDailyJournalCount = dailyCoverage.filter((day) => day.hasStaleDailyJournal).length;
  const pendingDailyJournalCount = dailyCoverage.filter(isPendingDailyJournalDay).length;
  const links = [buildPairingLink(dailyCoverage), buildFollowupLink(dimensions), buildScoreLink(dimensions), buildGapLink(dimensions)].flatMap((item) =>
    item ? [item] : []
  );

  if (!featured) {
    return {
      headline: "这个月先别急着下五维结论。",
      summary: "这个月已经有了一些起伏，但还没有足够的文字材料把五维线索说清楚。",
      watchpoint:
        staleDailyJournalCount > 0
          ? `还有 ${staleDailyJournalCount} 天的完整日志已经过时，需要重新整理。`
          : scoreOnlyDayCount > 0
          ? `已经有 ${scoreOnlyDayCount} 天先留下了评分，但还没写成具体记录。`
          : null,
      featuredDimension: null,
      quietDimensions,
      links
    } satisfies AnalysisInsightsOverview;
  }

  const firstRelatedDimension = featured.relatedDimensions
    .map((dimension) => dimensions.find((item) => item.dimension === dimension))
    .filter((item): item is AnalysisDimensionInsightCard => item != null && item.savedEntryCount > 0)
    .sort(compareDimensionInsights)[0];
  const scoreSummary = featured.scoreLink.summary;
  const quietLaggingDimension = rankQuietLaggingDimensions(dimensions)[0] ?? null;
  const quietMissingDimension = rankQuietMissingDimensions(dimensions)[0] ?? null;
  const watchpoint = staleDailyJournalCount > 0
    ? `还有 ${staleDailyJournalCount} 天的完整日志已经过时，需要重新整理。`
    : pendingDailyJournalCount > 0
    ? `还有 ${pendingDailyJournalCount} 天已经有维度记录，但还没收成完整日志。`
    : quietLaggingDimension?.scoreLink.summary ??
      quietMissingDimension?.scoreLink.summary ??
      (scoreOnlyDayCount > 0 ? `还有 ${scoreOnlyDayCount} 天先留下了评分，但还没写成具体记录。` : null);

  return {
    headline: buildInsightsHeadline({
      featured,
      related: firstRelatedDimension ?? null,
      quietLagging: quietLaggingDimension ?? null
    }),
    summary: firstRelatedDimension
      ? quietLaggingDimension?.scoreLink.summary
        ? `这个月更成形的是${getInterviewDimensionMeta(featured.dimension).label}这条线，旁边陪着它一起动的，多半是${getInterviewDimensionMeta(firstRelatedDimension.dimension).label}。${quietLaggingDimension.scoreLink.summary}`
        : scoreSummary
          ? `这个月更成形的是${getInterviewDimensionMeta(featured.dimension).label}这条线，旁边陪着它一起动的，多半是${getInterviewDimensionMeta(firstRelatedDimension.dimension).label}。${scoreSummary}`
          : `这个月更成形的是${getInterviewDimensionMeta(featured.dimension).label}这条线，旁边陪着它一起动的，多半是${getInterviewDimensionMeta(firstRelatedDimension.dimension).label}。`
      : scoreSummary
        ? `这个月最成形的是${getInterviewDimensionMeta(featured.dimension).label}这条线。${scoreSummary}`
        : `这个月最成形的是${getInterviewDimensionMeta(featured.dimension).label}这条线，它已经不只是零散片段，开始变成一条能回看的月内线索。`,
    watchpoint,
    featuredDimension: featured.dimension,
    quietDimensions,
    links
  } satisfies AnalysisInsightsOverview;
}

export { buildAnalysisScoreTrend } from "@/features/analysis/month-coverage";

export function aggregateAnalysisMonth(input: {
  month: string;
  entries: AnalysisSavedEntrySource[];
  dailyJournals: AnalysisSavedDailyJournalSource[];
  scoreRecords: DailyHappinessScoreRecord[];
  today: string;
}): Omit<AnalysisMonthRecord, "scoreRecords" | "editableDates" | "narrative"> {
  const {
    dailyCoverage,
    rhythmOverview,
    scoreOverview,
    scoreTrend
  } = buildAnalysisMonthCoverage(input);
  const { dimensionBreakdown, dimensions } = buildAnalysisMonthDimensions({
    month: input.month,
    entries: input.entries,
    factorAverages: scoreTrend.factorAverages
  });

  return {
    month: input.month,
    logOverview: {
      recordedDayCount: dailyCoverage.filter((day) => day.savedDimensionCount > 0).length,
      savedEntryCount: input.entries.length,
      dailyJournalSavedDayCount: input.dailyJournals.length
    },
    dailyCoverage,
    rhythmOverview,
    dimensionBreakdown,
    dimensions,
    insightsOverview: buildInsightsOverview(dimensions, dailyCoverage),
    scoreOverview,
    scoreTrend
  };
}
