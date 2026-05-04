import { getInterviewDimensionMeta, interviewDimensions } from "@/features/interview/dimensions";
import { buildDailyJournalSourceSignature } from "@/features/daily-journal/source-signature";
import { pickLatestDailyJournalSourcesByDimension } from "@/features/daily-journal/source-selection";
import type {
  AnalysisDateSpan,
  AnalysisDailyCoverageDay,
  AnalysisDimensionBreakdownItem,
  AnalysisDimensionRelationship,
  AnalysisDimensionInsightCard,
  AnalysisInsightsOverview,
  AnalysisMonthRecord,
  AnalysisRhythmOverview,
  AnalysisScoreOverview,
  AnalysisScoreTrend,
  AnalysisSavedDailyJournalSource,
  AnalysisSavedEntrySource
} from "@/features/analysis/types";
import {
  happinessScoreKeyPairs,
  type DailyHappinessScoreRecord,
  type HappinessScoreRequestKey
} from "@/features/happiness-score/types";
import type { InterviewDimension } from "@/types/interview";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

const dimensionRelatedScoreFactorMap: Record<InterviewDimension, HappinessScoreRequestKey[]> = {
  joy: ["interest", "relationship"],
  fulfillment: ["meaning", "skill", "virtue"],
  reflection: ["autonomy", "meaning"],
  improvement: ["skill", "autonomy", "virtue"],
  gratitude: ["relationship", "livingCondition"]
};

const scoreFactorLabelMap: Record<HappinessScoreRequestKey, string> = {
  meaning: "意义感",
  health: "身体状态",
  virtue: "自我认可",
  autonomy: "自主感",
  interest: "投入感",
  skill: "成长感",
  relationship: "关系支持",
  livingCondition: "生活托住"
};

function parseMonthKey(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1));
}

function formatDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function buildMonthDates(month: string) {
  if (!MONTH_PATTERN.test(month)) {
    throw new Error("INVALID_MONTH");
  }

  const startDate = parseMonthKey(month);
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const currentDate = new Date(startDate);
    currentDate.setUTCDate(index + 1);
    return formatDateKey(currentDate);
  });
}

function buildDailyCoverage(input: {
  month: string;
  entries: AnalysisSavedEntrySource[];
  dailyJournals: AnalysisSavedDailyJournalSource[];
  scoreRecords: DailyHappinessScoreRecord[];
}): AnalysisDailyCoverageDay[] {
  const dailyJournalByDate = new Map(input.dailyJournals.map((entry) => [entry.date, entry]));
  const entriesByDate = input.entries.reduce((stats, entry) => {
    const current = stats.get(entry.date);

    if (current) {
      current.push(entry);
    } else {
      stats.set(entry.date, [entry]);
    }

    return stats;
  }, new Map<string, AnalysisSavedEntrySource[]>());
  const scoreRecordsByDate = new Map(input.scoreRecords.map((record) => [record.date, record]));

  return buildMonthDates(input.month).map((date) => {
    const dateEntries = entriesByDate.get(date) ?? [];
    const savedDimensions = interviewDimensions.filter((dimension) =>
      dateEntries.some((entry) => entry.dimension === dimension)
    );
    const scoreRecord = scoreRecordsByDate.get(date);
    const dailyJournal = dailyJournalByDate.get(date) ?? null;
    const currentSourceSignature = buildDailyJournalSourceSignature(
      pickLatestDailyJournalSourcesByDimension(dateEntries)
    );
    const hasDailyJournalSaved = Boolean(dailyJournal);
    const hasStaleDailyJournal = Boolean(dailyJournal && dailyJournal.sourceSignature !== currentSourceSignature);

    return {
      date,
      savedEntryCount: dateEntries.length,
      savedDimensionCount: savedDimensions.length,
      savedDimensions,
      hasDailyJournalSaved,
      hasStaleDailyJournal,
      hasScore: Boolean(scoreRecord),
      averageScore: scoreRecord ? buildScoreAverage(scoreRecord) : null
    };
  });
}

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

function compareDateDesc(left: string | null, right: string | null) {
  return right === left ? 0 : right && (!left || right > left) ? 1 : -1;
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
      return `这个月让你更容易亮起来的，多半和${lead}有关。`;
    }

    if (input.dimension === "fulfillment") {
      return `这个月让你觉得今天没白过的，常常是${lead}。`;
    }

    if (input.dimension === "reflection") {
      return `这个月反复冒出来的一条判断，是${lead}。`;
    }

    if (input.dimension === "improvement") {
      return `这个月你最常想调一调的，多半是${lead}。`;
    }

    return `这个月最容易被你记住的回应，多半是${lead}。`;
  }

  if (tags.length > 0) {
    return `这个月的${getInterviewDimensionMeta(input.dimension).label}线索，多半围着${tags.join("、")}这类片段在展开。`;
  }

  return `这个月的${getInterviewDimensionMeta(input.dimension).label}线索已经有了起点，但还没有完全说清楚。`;
}

function buildNextQuestion(dimension: InterviewDimension, hasEntries: boolean) {
  if (!hasEntries) {
    if (dimension === "joy") {
      return "最近有没有一个让你一下松下来，或者亮起来的片段？";
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
    const evidence = recentSignals.map((signal) => ({
      entryId: signal.entryId,
      date: signal.date,
      summary: signal.primarySignal,
      detail: signal.secondarySignal
    }));

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

function roundScoreAverage(value: number) {
  return Math.round(value * 10) / 10;
}

function buildScoreAverage(record: DailyHappinessScoreRecord) {
  const total = happinessScoreKeyPairs.reduce((sum, item) => sum + record[item.recordKey], 0);
  return roundScoreAverage(total / happinessScoreKeyPairs.length);
}

function buildEmptyScoreMap() {
  return Object.fromEntries(happinessScoreKeyPairs.map((item) => [item.requestKey, null])) as Record<
    (typeof happinessScoreKeyPairs)[number]["requestKey"],
    number | null
  >;
}

function getObservedCoverageDays(input: {
  month: string;
  dailyCoverage: AnalysisDailyCoverageDay[];
  today: string;
}) {
  if (input.month > input.today.slice(0, 7)) {
    return [];
  }

  if (input.month !== input.today.slice(0, 7)) {
    return input.dailyCoverage;
  }

  return input.dailyCoverage.filter((day) => day.date <= input.today);
}

function isActiveCoverageDay(day: AnalysisDailyCoverageDay) {
  return day.savedDimensionCount > 0 || day.hasDailyJournalSaved;
}

function findLatestDate(days: AnalysisDailyCoverageDay[], predicate: (day: AnalysisDailyCoverageDay) => boolean) {
  return days
    .filter(predicate)
    .sort((left, right) => compareDateDesc(left.date, right.date))[0]?.date ?? null;
}

function buildLongestSpan(days: AnalysisDailyCoverageDay[], predicate: (day: AnalysisDailyCoverageDay) => boolean): AnalysisDateSpan | null {
  let best: AnalysisDateSpan | null = null;
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

    if (currentStart && currentEnd && (!best || currentLength > best.length)) {
      best = {
        startDate: currentStart,
        endDate: currentEnd,
        length: currentLength
      };
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

function buildRhythmOverview(input: {
  month: string;
  dailyCoverage: AnalysisDailyCoverageDay[];
  today: string;
}): AnalysisRhythmOverview {
  const observedCoverageDays = getObservedCoverageDays(input);
  const activeObservedDays = observedCoverageDays.filter(isActiveCoverageDay);
  const scoreOnlyDays = observedCoverageDays.filter(
    (day) => day.hasScore && day.savedDimensionCount === 0 && !day.hasDailyJournalSaved
  );
  const pendingDailyJournalDays = observedCoverageDays.filter(isPendingDailyJournalDay);

  return {
    activeObservedDayCount: activeObservedDays.length,
    scoreOnlyDayCount: scoreOnlyDays.length,
    pendingDailyJournalCount: pendingDailyJournalDays.length,
    longestStreak: buildLongestSpan(observedCoverageDays, isActiveCoverageDay),
    longestGap: buildLongestSpan(
      observedCoverageDays,
      (day) => day.savedDimensionCount === 0 && !day.hasDailyJournalSaved && !day.hasScore
    ),
    latestActiveDate: findLatestDate(observedCoverageDays, isActiveCoverageDay),
    latestScoreOnlyDate: findLatestDate(
      observedCoverageDays,
      (day) => day.hasScore && day.savedDimensionCount === 0 && !day.hasDailyJournalSaved
    ),
    latestPendingDailyJournalDate: findLatestDate(observedCoverageDays, isPendingDailyJournalDay)
  };
}

export function buildAnalysisScoreTrend(input: {
  month: string;
  scoreRecords: DailyHappinessScoreRecord[];
}): {
  scoreOverview: AnalysisScoreOverview;
  scoreTrend: AnalysisScoreTrend;
} {
  const monthDates = buildMonthDates(input.month);
  const dateSet = new Set(monthDates);
  const recordsByDate = new Map(
    input.scoreRecords.filter((record) => dateSet.has(record.date)).map((record) => [record.date, record])
  );

  const days = monthDates.map((date) => {
    const record = recordsByDate.get(date);

    if (!record) {
      return {
        date,
        averageScore: null,
        scores: buildEmptyScoreMap(),
        hasScore: false
      };
    }

    return {
      date,
      averageScore: buildScoreAverage(record),
      scores: Object.fromEntries(
        happinessScoreKeyPairs.map((item) => [item.requestKey, record[item.recordKey]])
      ) as Record<(typeof happinessScoreKeyPairs)[number]["requestKey"], number>,
      hasScore: true
    };
  });

  const scoredDays = days.filter((day) => day.hasScore);
  const factorAverages = Object.fromEntries(
    happinessScoreKeyPairs.map((item) => {
      const values = scoredDays
        .map((day) => day.scores[item.requestKey])
        .filter((value): value is number => typeof value === "number");

      if (values.length === 0) {
        return [item.requestKey, null];
      }

      return [item.requestKey, roundScoreAverage(values.reduce((sum, value) => sum + value, 0) / values.length)];
    })
  ) as AnalysisScoreTrend["factorAverages"];

  const monthAverageScore =
    scoredDays.length > 0
      ? roundScoreAverage(
          scoredDays.reduce((sum, day) => sum + (day.averageScore ?? 0), 0) / scoredDays.length
        )
      : null;

  return {
    scoreOverview: {
      scoredDayCount: scoredDays.length,
      monthAverageScore,
      latestScoredDate: scoredDays.at(-1)?.date ?? null
    },
    scoreTrend: {
      days,
      factorAverages
    }
  };
}

export function aggregateAnalysisMonth(input: {
  month: string;
  entries: AnalysisSavedEntrySource[];
  dailyJournals: AnalysisSavedDailyJournalSource[];
  scoreRecords: DailyHappinessScoreRecord[];
  today: string;
}): Omit<AnalysisMonthRecord, "scoreRecords" | "editableDates"> {
  const dailyCoverage = buildDailyCoverage(input);
  const dimensionBreakdown = buildDimensionBreakdown(input.entries);
  const { scoreOverview, scoreTrend } = buildAnalysisScoreTrend({
    month: input.month,
    scoreRecords: input.scoreRecords
  });
  const dimensions = buildDimensionInsights({
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
    rhythmOverview: buildRhythmOverview({
      month: input.month,
      dailyCoverage,
      today: input.today
    }),
    dimensionBreakdown,
    dimensions,
    insightsOverview: buildInsightsOverview(dimensions, dailyCoverage),
    scoreOverview,
    scoreTrend
  };
}
