import {
  buildMonthDates,
  compareDateDesc,
  roundScoreAverage
} from "@/features/analysis/month-aggregation-utils";
import type {
  AnalysisDimensionBreakdownItem,
  AnalysisDimensionInsightCard,
  AnalysisSavedEntrySource
} from "@/features/analysis/types";
import type { HappinessScoreRequestKey } from "@/features/happiness-score/types";
import { getInterviewDimensionMeta, interviewDimensions } from "@/features/interview/dimensions";
import type { InterviewDimension } from "@/types/interview";

const dimensionRelatedScoreFactorMap: Record<InterviewDimension, HappinessScoreRequestKey[]> = {
  joy: ["interest", "relationship"],
  fulfillment: ["meaning", "skill", "virtue"],
  reflection: ["autonomy", "meaning"],
  improvement: ["skill", "autonomy", "virtue"],
  gratitude: ["relationship", "livingCondition"]
};

const scoreFactorLabelMap: Record<HappinessScoreRequestKey, string> = {
  meaning: "意义",
  health: "健康",
  virtue: "美德",
  autonomy: "意志",
  interest: "热爱",
  skill: "擅长",
  relationship: "人际",
  livingCondition: "经济"
};

function buildDimensionBreakdown(entries: AnalysisSavedEntrySource[]): AnalysisDimensionBreakdownItem[] {
  return interviewDimensions.map<AnalysisDimensionBreakdownItem>((dimension: InterviewDimension) => {
    const dimensionEntries = entries.filter((entry) => entry.dimension === dimension);
    const recordedDates = new Set(dimensionEntries.map((entry) => entry.date));

    return {
      dimension,
      savedEntryCount: dimensionEntries.length,
      recordedDayCount: recordedDates.size
    };
  });
}

function normalizeSignalValue(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function resolveEntryTags(entry: AnalysisSavedEntrySource) {
  const candidateTags = Array.isArray(entry.payload?.tags) && entry.payload.tags.length > 0 ? entry.payload.tags : entry.tags;

  return [...new Set(candidateTags.map((tag) => tag.trim()).filter(Boolean))];
}

function resolveDimensionSignals(entry: AnalysisSavedEntrySource) {
  const payload = entry.payload;

  if (!payload || payload.kind !== entry.dimension) {
    return null;
  }

  if (payload.kind === "joy") {
    return {
      primarySignal: normalizeSignalValue(payload.joySource),
      secondarySignal: normalizeSignalValue(payload.manualClue) ?? normalizeSignalValue(payload.delightSignature)
    };
  }

  if (payload.kind === "fulfillment") {
    return {
      primarySignal: normalizeSignalValue(payload.progressEvidence),
      secondarySignal: normalizeSignalValue(payload.valueSignal)
    };
  }

  if (payload.kind === "reflection") {
    return {
      primarySignal: normalizeSignalValue(payload.insight),
      secondarySignal: normalizeSignalValue(payload.viewpointShift)
    };
  }

  if (payload.kind === "improvement") {
    return {
      primarySignal: normalizeSignalValue(payload.controllableFactor) ?? normalizeSignalValue(payload.nextAttempt),
      secondarySignal: normalizeSignalValue(payload.frictionPoint) ?? normalizeSignalValue(payload.repeatCondition)
    };
  }

  return {
    primarySignal: normalizeSignalValue(payload.kindAction) ?? normalizeSignalValue(payload.seenNeed),
    secondarySignal: normalizeSignalValue(payload.relationshipSignal) ?? normalizeSignalValue(payload.gratitudeReason)
  };
}

function getDayNumber(date: string) {
  return Number(date.slice(-2));
}

function buildUniqueDateList(entries: AnalysisSavedEntrySource[]) {
  return [...new Set(entries.map((entry) => entry.date))].sort((left, right) => left.localeCompare(right));
}

function buildRecordedSpan(dates: string[]) {
  if (dates.length === 0) {
    return 0;
  }

  let longest = 1;
  let current = 1;

  for (let index = 1; index < dates.length; index += 1) {
    const previousDate = new Date(`${dates[index - 1]}T00:00:00.000Z`);
    const currentDate = new Date(`${dates[index]}T00:00:00.000Z`);
    const dayDistance = Math.round((currentDate.getTime() - previousDate.getTime()) / 86400000);

    if (dayDistance === 1) {
      current += 1;
      longest = Math.max(longest, current);
      continue;
    }

    current = 1;
  }

  return longest;
}

function buildDateDimensionMap(entries: AnalysisSavedEntrySource[]) {
  return entries.reduce((stats, entry) => {
    const current = stats.get(entry.date);

    if (current) {
      current.add(entry.dimension);
    } else {
      stats.set(entry.date, new Set([entry.dimension]));
    }

    return stats;
  }, new Map<string, Set<InterviewDimension>>());
}

function buildTopTags(entries: AnalysisSavedEntrySource[]) {
  return [...entries.reduce((stats, entry) => {
    for (const tag of resolveEntryTags(entry)) {
      const current = stats.get(tag);

      if (!current) {
        stats.set(tag, {
          tag,
          count: 1,
          latestDate: entry.date
        });
        continue;
      }

      current.count += 1;
      if (entry.date > current.latestDate) {
        current.latestDate = entry.date;
      }
    }

    return stats;
  }, new Map<string, { tag: string; count: number; latestDate: string }>()).values()]
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      const dateDiff = compareDateDesc(left.latestDate, right.latestDate);

      if (dateDiff !== 0) {
        return dateDiff;
      }

      return left.tag.localeCompare(right.tag, "zh-Hans-CN");
    })
    .slice(0, 3)
    .map(({ tag, count }) => ({ tag, count }));
}

function buildRecentSignals(entries: AnalysisSavedEntrySource[]) {
  return entries
    .map((entry) => {
      const signals = resolveDimensionSignals(entry);

      if (!signals?.primarySignal && !signals?.secondarySignal) {
        return null;
      }

      return {
        entryId: entry.id,
        date: entry.date,
        primarySignal: signals.primarySignal ?? signals.secondarySignal ?? "",
        secondarySignal: signals.primarySignal ? signals.secondarySignal : null,
        savedAt: entry.savedAt,
        updatedAt: entry.updatedAt
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => {
      const dateDiff = compareDateDesc(left.date, right.date);

      if (dateDiff !== 0) {
        return dateDiff;
      }

      const savedAtDiff = compareDateDesc(left.savedAt, right.savedAt);

      if (savedAtDiff !== 0) {
        return savedAtDiff;
      }

      const updatedAtDiff = compareDateDesc(left.updatedAt, right.updatedAt);

      if (updatedAtDiff !== 0) {
        return updatedAtDiff;
      }

      return right.entryId.localeCompare(left.entryId, "en");
    })
    .slice(0, 3)
    .map(({ entryId, date, primarySignal, secondarySignal }) => ({
      entryId,
      date,
      primarySignal,
      secondarySignal
    }));
}

function buildConfidence(input: {
  savedEntryCount: number;
  recordedDayCount: number;
  evidenceCount: number;
}) {
  if (input.recordedDayCount >= 3 || input.savedEntryCount >= 4 || input.evidenceCount >= 3) {
    return "high" as const;
  }

  if (input.recordedDayCount >= 2 || input.savedEntryCount >= 2 || input.evidenceCount >= 2) {
    return "medium" as const;
  }

  return "low" as const;
}

function buildContinuity(recordedDates: string[]) {
  if (recordedDates.length === 0) {
    return "none" as const;
  }

  if (recordedDates.length === 1) {
    return "single" as const;
  }

  return buildRecordedSpan(recordedDates) >= 2 || recordedDates.length >= 3
    ? ("sustained" as const)
    : ("intermittent" as const);
}

function buildMomentum(month: string, recordedDates: string[]) {
  if (recordedDates.length === 0) {
    return "quiet" as const;
  }

  if (recordedDates.length === 1) {
    return "starting" as const;
  }

  const halfPoint = Math.ceil(buildMonthDates(month).length / 2);
  const firstHalfCount = recordedDates.filter((date) => getDayNumber(date) <= halfPoint).length;
  const secondHalfCount = recordedDates.length - firstHalfCount;

  if (secondHalfCount > firstHalfCount) {
    return "rising" as const;
  }

  return buildRecordedSpan(recordedDates) >= 2 || recordedDates.length >= 3
    ? ("steady" as const)
    : ("starting" as const);
}

function buildTurningPointDate(entries: AnalysisSavedEntrySource[]) {
  if (entries.length === 0) {
    return null;
  }

  const countsByDate = entries.reduce((stats, entry) => {
    const current = stats.get(entry.date);

    if (current) {
      current.count += 1;
    } else {
      stats.set(entry.date, {
        date: entry.date,
        count: 1
      });
    }

    return stats;
  }, new Map<string, { date: string; count: number }>());

  return [...countsByDate.values()].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return compareDateDesc(left.date, right.date);
  })[0]?.date ?? null;
}

function buildRelatedDimensions(
  dimension: InterviewDimension,
  recordedDates: string[],
  dateDimensionMap: Map<string, Set<InterviewDimension>>
) {
  return [...recordedDates.reduce((stats, date) => {
    const relatedDimensions = dateDimensionMap.get(date);

    if (!relatedDimensions) {
      return stats;
    }

    for (const candidate of relatedDimensions) {
      if (candidate === dimension) {
        continue;
      }

      stats.set(candidate, (stats.get(candidate) ?? 0) + 1);
    }

    return stats;
  }, new Map<InterviewDimension, number>()).entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return interviewDimensions.indexOf(left[0]) - interviewDimensions.indexOf(right[0]);
    })
    .slice(0, 2)
    .map(([candidate]) => candidate);
}

function shortenInsightText(value: string | null, maxLength = 28) {
  if (!value) {
    return null;
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

const BODY_EXCERPT_MAX_LENGTH = 180;

function normalizeExcerptSource(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

function buildBodyExcerpt(content: string | null | undefined, fallback?: string | null) {
  const source = normalizeExcerptSource(content) || normalizeExcerptSource(fallback);

  if (!source) {
    return "";
  }

  return source.length > BODY_EXCERPT_MAX_LENGTH
    ? `${source.slice(0, BODY_EXCERPT_MAX_LENGTH)}…`
    : source;
}

function formatScoreFactorLabels(factors: HappinessScoreRequestKey[]) {
  return factors.map((factor) => scoreFactorLabelMap[factor]);
}

function buildDimensionScoreLink(input: {
  dimension: InterviewDimension;
  savedEntryCount: number;
  relatedScoreFactors: HappinessScoreRequestKey[];
  factorAverages: Record<HappinessScoreRequestKey, number | null>;
}) {
  const values = input.relatedScoreFactors
    .map((factor) => input.factorAverages[factor])
    .filter((value): value is number => typeof value === "number");
  const labels = formatScoreFactorLabels(input.relatedScoreFactors);

  if (values.length === 0) {
    return {
      average: null,
      status: "unknown" as const,
      summary: "评分里暂时还看不出这条线。"
    };
  }

  const average = roundScoreAverage(values.reduce((sum, value) => sum + value, 0) / values.length);
  const joinedLabels = labels.join("、");

  if (input.savedEntryCount === 0) {
    return average >= 7
      ? {
          average,
          status: "missing" as const,
          summary: `${joinedLabels}在评分里并不低，但这条线还没写成具体记录。`
        }
      : {
          average,
          status: "lagging" as const,
          summary: `${joinedLabels}在评分里也偏弱，这条线还没有真正展开。`
        };
  }

  if (average >= 7) {
    return {
      average,
      status: "supporting" as const,
      summary: `${joinedLabels}在评分里也不低，这条线不只是写出来了，分数里也能看见。`
    };
  }

  if (average <= 6) {
    return {
      average,
      status: "lagging" as const,
      summary: `记录里已经有这条线了，但${joinedLabels}在评分里还没有被稳稳托住。`
    };
  }

  return {
    average,
    status: "unknown" as const,
    summary: `${joinedLabels}在评分里有一点呼应，但还没到特别稳定的时候。`
  };
}

function buildDimensionThesis(input: {
  dimension: InterviewDimension;
  recentSignals: ReturnType<typeof buildRecentSignals>;
  topTags: ReturnType<typeof buildTopTags>;
  savedEntryCount: number;
}) {
  if (input.savedEntryCount === 0) {
    return "这个月这条线还没有形成能回看的材料。";
  }

  const lead = shortenInsightText(input.recentSignals[0]?.primarySignal ?? null, 26);
  const tags = input.topTags.map((tag) => tag.tag).slice(0, 2);

  if (lead) {
    if (input.dimension === "joy") {
      return `这个月让你开心的，多半和${lead}有关。`;
    }

    if (input.dimension === "fulfillment") {
      return `这个月让你觉得今天没白过的，常常是${lead}。`;
    }

    if (input.dimension === "reflection") {
      return `这个月你反复想到的一点，是${lead}。`;
    }

    if (input.dimension === "improvement") {
      return `这个月你最想做点调整的，多半是${lead}。`;
    }

    return `这个月最让你记得的一份回应，多半是${lead}。`;
  }

  if (tags.length > 0) {
    return `这个月的${getInterviewDimensionMeta(input.dimension).label}记录，多半围绕${tags.join("、")}这类事。`;
  }

  return `这个月的${getInterviewDimensionMeta(input.dimension).label}线索已经有了起点，但还没有完全说清楚。`;
}

function buildNextQuestion(dimension: InterviewDimension, hasEntries: boolean) {
  if (!hasEntries) {
    if (dimension === "joy") {
      return "最近有没有一件让你觉得开心或放松的小事？";
    }

    if (dimension === "fulfillment") {
      return "最近有没有一件事，让你觉得今天不算白过？";
    }

    if (dimension === "reflection") {
      return "最近有没有一个片段，让你对自己或事情的看法变了一点？";
    }

    if (dimension === "improvement") {
      return "最近有没有一个时刻，让你觉得下次想做得更稳一点？";
    }

    return "最近有没有一个被照顾到、被理解到的瞬间？";
  }

  if (dimension === "joy") {
    return "这类开心只是偶尔出现，还是已经开始重复出现了？";
  }

  if (dimension === "fulfillment") {
    return "这种充实感更像一次完成，还是慢慢累出来的？";
  }

  if (dimension === "reflection") {
    return "这条判断线索，只在一件事里出现，还是已经开始反复冒出来？";
  }

  if (dimension === "improvement") {
    return "你想调整的这个点，最近是不是已经在反复出现？";
  }

  return "这类被回应的感觉，是一次例外，还是这段关系里常有的经验？";
}

function buildDimensionInsights(input: {
  month: string;
  entries: AnalysisSavedEntrySource[];
  factorAverages: Record<HappinessScoreRequestKey, number | null>;
}) {
  const dateDimensionMap = buildDateDimensionMap(input.entries);

  return interviewDimensions.map<AnalysisDimensionInsightCard>((dimension) => {
    const dimensionEntries = input.entries.filter((entry) => entry.dimension === dimension);
    const recordedDates = buildUniqueDateList(dimensionEntries);
    const lastRecordedDate = [...recordedDates].sort((left, right) => compareDateDesc(left, right))[0] ?? null;
    const topTags = buildTopTags(dimensionEntries);
    const recentSignals = buildRecentSignals(dimensionEntries);
    const sortedEntries = [...dimensionEntries].sort((left, right) => {
      const dateDiff = compareDateDesc(left.date, right.date);

      if (dateDiff !== 0) {
        return dateDiff;
      }

      return compareDateDesc(left.savedAt ?? left.updatedAt, right.savedAt ?? right.updatedAt);
    });
    const evidence = sortedEntries.slice(0, 3).map((entry) => {
      const signals = resolveDimensionSignals(entry);
      const primary = signals ? normalizeSignalValue(signals.primarySignal) : null;
      const secondary = signals ? normalizeSignalValue(signals.secondarySignal) : null;

      return {
        entryId: entry.id,
        date: entry.date,
        title: entry.title,
        summary: primary ?? entry.title,
        detail: secondary,
        excerpt: buildBodyExcerpt(entry.content, primary ? `${primary}。${secondary ?? ""}` : entry.title)
      };
    });

    return {
      dimension,
      savedEntryCount: dimensionEntries.length,
      recordedDayCount: recordedDates.length,
      lastRecordedDate,
      thesis: buildDimensionThesis({
        dimension,
        recentSignals,
        topTags,
        savedEntryCount: dimensionEntries.length
      }),
      confidence: buildConfidence({
        savedEntryCount: dimensionEntries.length,
        recordedDayCount: recordedDates.length,
        evidenceCount: evidence.length
      }),
      momentum: buildMomentum(input.month, recordedDates),
      continuity: buildContinuity(recordedDates),
      turningPointDate: buildTurningPointDate(dimensionEntries),
      representativeDates: [...recordedDates].sort((left, right) => compareDateDesc(left, right)).slice(0, 3),
      relatedScoreFactors: dimensionRelatedScoreFactorMap[dimension],
      relatedDimensions: buildRelatedDimensions(dimension, recordedDates, dateDimensionMap),
      scoreLink: buildDimensionScoreLink({
        dimension,
        savedEntryCount: dimensionEntries.length,
        relatedScoreFactors: dimensionRelatedScoreFactorMap[dimension],
        factorAverages: input.factorAverages
      }),
      nextQuestion: buildNextQuestion(dimension, dimensionEntries.length > 0),
      topTags,
      recentSignals,
      evidence
    };
  });
}

export function buildAnalysisMonthDimensions(input: {
  month: string;
  entries: AnalysisSavedEntrySource[];
  factorAverages: Record<HappinessScoreRequestKey, number | null>;
}) {
  return {
    dimensionBreakdown: buildDimensionBreakdown(input.entries),
    dimensions: buildDimensionInsights(input)
  };
}
