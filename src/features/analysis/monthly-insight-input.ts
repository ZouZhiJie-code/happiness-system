import type {
  AnalysisNarrative,
  AnalysisScoreTrend
} from "@/features/analysis/types";
import type {
  JournalPeriodMaterial,
  JournalPeriodMaterialKind
} from "@/types/journal-period-report";

export type MonthlyInsightEligibilityReason =
  | "recorded_days_below_3"
  | "saved_outcomes_below_3";

export interface MonthlyInsightCandidateSource {
  sourceId: string;
  kind: JournalPeriodMaterialKind;
  title: string;
  excerpt: string;
  startDate: string;
  endDate: string;
}

export interface MonthlyInsightCandidateScoreDay {
  date: string;
  averageScore: number;
}

export interface MonthlyInsightCandidateInput {
  schemaVersion: 1;
  month: string;
  /** Current event-centered materials carry no frozen five-dimension label. */
  dimensionLabels: string[];
  eligibility: {
    eligible: boolean;
    recordedDayCount: number;
    savedOutcomeCount: number;
    reason: MonthlyInsightEligibilityReason | null;
  };
  sources: MonthlyInsightCandidateSource[];
  scoreTrend: {
    scoredDayCount: number;
    monthAverageScore: number | null;
    days: MonthlyInsightCandidateScoreDay[];
  };
}

export interface BuildMonthlyInsightCandidateInputOptions {
  month: string;
  materials: JournalPeriodMaterial[];
  scoreTrend: AnalysisScoreTrend;
}

const MONTH_PATTERN = /^\d{4}-\d{2}$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const MAX_EXCERPT_LENGTH = 320;

function parseDate(date: string): Date {
  if (!DATE_PATTERN.test(date)) {
    throw new Error(`MONTHLY_INSIGHT_INVALID_DATE:${date}`);
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`MONTHLY_INSIGHT_INVALID_DATE:${date}`);
  }
  return parsed;
}

function datesBetween(startDate: string, endDate: string): string[] {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (start.getTime() > end.getTime()) {
    throw new Error(`MONTHLY_INSIGHT_INVALID_RANGE:${startDate}:${endDate}`);
  }

  const dates: string[] = [];
  for (
    let timestamp = start.getTime();
    timestamp <= end.getTime();
    timestamp += 24 * 60 * 60 * 1000
  ) {
    dates.push(new Date(timestamp).toISOString().slice(0, 10));
  }
  return dates;
}

function normalizeExcerpt(content: string): string {
  return content.replace(/\s+/gu, " ").trim().slice(0, MAX_EXCERPT_LENGTH);
}

export function buildMonthlyInsightCandidateInput({
  month,
  materials,
  scoreTrend
}: BuildMonthlyInsightCandidateInputOptions): MonthlyInsightCandidateInput {
  if (!MONTH_PATTERN.test(month)) {
    throw new Error(`MONTHLY_INSIGHT_INVALID_MONTH:${month}`);
  }

  const coveredDates = new Set<string>();
  const sources = materials.map((material) => {
    const dates = datesBetween(material.startDate, material.endDate);
    if (dates.some((date) => !date.startsWith(`${month}-`))) {
      throw new Error(`MONTHLY_INSIGHT_SOURCE_OUTSIDE_MONTH:${material.sourceId}`);
    }
    dates.forEach((date) => coveredDates.add(date));

    return {
      sourceId: material.sourceId,
      kind: material.kind,
      title: material.title.trim().slice(0, 160),
      excerpt: normalizeExcerpt(material.content),
      startDate: material.startDate,
      endDate: material.endDate
    };
  });

  const scoredDays = scoreTrend.days
    .filter((day): day is typeof day & { averageScore: number } => (
      day.date.startsWith(`${month}-`) && day.averageScore !== null
    ))
    .map((day) => ({ date: day.date, averageScore: day.averageScore }));
  const monthAverageScore = scoredDays.length > 0
    ? scoredDays.reduce((sum, day) => sum + day.averageScore, 0) / scoredDays.length
    : null;
  const recordedDayCount = coveredDates.size;
  const savedOutcomeCount = sources.length;
  const reason: MonthlyInsightEligibilityReason | null = recordedDayCount < 3
    ? "recorded_days_below_3"
    : savedOutcomeCount < 3
      ? "saved_outcomes_below_3"
      : null;

  return {
    schemaVersion: 1,
    month,
    dimensionLabels: [],
    eligibility: {
      eligible: reason === null,
      recordedDayCount,
      savedOutcomeCount,
      reason
    },
    sources,
    scoreTrend: {
      scoredDayCount: scoredDays.length,
      monthAverageScore,
      days: scoredDays
    }
  };
}

export function deterministicInsufficientEvidenceNarrative(
  input: MonthlyInsightCandidateInput
): AnalysisNarrative {
  const { recordedDayCount, savedOutcomeCount } = input.eligibility;
  return {
    overviewNarrative: `本月目前有 ${recordedDayCount} 个记录日、${savedOutcomeCount} 条已保存成果，材料还不足以形成可靠的个性化洞察。`,
    dimensionTheses: {},
    insightCards: []
  };
}

export function listMonthlyInsightSupportedDates(
  input: MonthlyInsightCandidateInput
): Set<string> {
  return new Set(input.sources.flatMap((source) => datesBetween(source.startDate, source.endDate)));
}
