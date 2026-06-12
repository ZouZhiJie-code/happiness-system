import type { InterviewDimension, InterviewJournalPayload } from "@/types/interview";
import type { DailyHappinessScoreRecord, HappinessScoreRequestKey } from "@/features/happiness-score/types";

export type { DailyHappinessScoreRecord };

export interface AnalysisMonthInput {
  month: string;
  journals: InterviewJournalPayload[];
  scoreRecords: DailyHappinessScoreRecord[];
  editableDates: string[];
}

export interface AnalysisLogOverview {
  recordedDayCount: number;
  savedEntryCount: number;
  dailyJournalSavedDayCount: number;
}

export interface AnalysisDailyCoverageDay {
  date: string;
  savedEntryCount: number;
  savedDimensionCount: number;
  savedDimensions: InterviewDimension[];
  hasDailyJournalSaved: boolean;
  hasStaleDailyJournal: boolean;
  hasScore: boolean;
  averageScore: number | null;
  journalTitle: string | null;
  contentPreview: string | null;
}

export interface AnalysisDimensionBreakdownItem {
  dimension: InterviewDimension;
  savedEntryCount: number;
  recordedDayCount: number;
}

export interface AnalysisDimensionTagStat {
  tag: string;
  count: number;
}

export interface AnalysisDimensionSignalExcerpt {
  entryId: string;
  date: string;
  primarySignal: string;
  secondarySignal: string | null;
}

export interface AnalysisDimensionEvidenceExcerpt {
  entryId: string;
  date: string;
  title: string | null;
  summary: string;
  detail: string | null;
  excerpt: string;
}

export type AnalysisDimensionInsightConfidence = "low" | "medium" | "high";
export type AnalysisDimensionInsightMomentum = "starting" | "rising" | "steady" | "quiet";
export type AnalysisDimensionInsightContinuity = "none" | "single" | "intermittent" | "sustained";
export type AnalysisDimensionScoreStatus = "unknown" | "supporting" | "lagging" | "missing";

export interface AnalysisDimensionScoreLink {
  average: number | null;
  status: AnalysisDimensionScoreStatus;
  summary: string | null;
}

export interface AnalysisDimensionInsightCard {
  dimension: InterviewDimension;
  savedEntryCount: number;
  recordedDayCount: number;
  lastRecordedDate: string | null;
  thesis: string | null;
  confidence: AnalysisDimensionInsightConfidence;
  momentum: AnalysisDimensionInsightMomentum;
  continuity: AnalysisDimensionInsightContinuity;
  turningPointDate: string | null;
  representativeDates: string[];
  relatedScoreFactors: HappinessScoreRequestKey[];
  relatedDimensions: InterviewDimension[];
  scoreLink: AnalysisDimensionScoreLink;
  nextQuestion: string | null;
  topTags: AnalysisDimensionTagStat[];
  recentSignals: AnalysisDimensionSignalExcerpt[];
  evidence: AnalysisDimensionEvidenceExcerpt[];
}

export interface AnalysisDimensionRelationship {
  type: "pairing" | "followup" | "gap" | "score";
  title: string;
  detail: string;
  dimensions: InterviewDimension[];
  anchorDate: string | null;
}

export interface AnalysisInsightsOverview {
  headline: string;
  summary: string;
  watchpoint: string | null;
  featuredDimension: InterviewDimension | null;
  quietDimensions: InterviewDimension[];
  links: AnalysisDimensionRelationship[];
}

export interface AnalysisScoreOverview {
  scoredDayCount: number;
  monthAverageScore: number | null;
  latestScoredDate: string | null;
}

export interface AnalysisScoreTrendDay {
  date: string;
  averageScore: number | null;
  scores: Record<HappinessScoreRequestKey, number | null>;
  hasScore: boolean;
}

export interface AnalysisScoreTrend {
  days: AnalysisScoreTrendDay[];
  factorAverages: Record<HappinessScoreRequestKey, number | null>;
}

export interface AnalysisDateSpan {
  startDate: string;
  endDate: string;
  length: number;
}

export interface AnalysisRhythmOverview {
  activeObservedDayCount: number;
  scoreOnlyDayCount: number;
  pendingDailyJournalCount: number;
  longestStreak: AnalysisDateSpan | null;
  longestGap: AnalysisDateSpan | null;
  latestActiveDate: string | null;
  latestScoreOnlyDate: string | null;
  latestPendingDailyJournalDate: string | null;
}

export interface AnalysisTrendsRangeRecord {
  preset: "week" | "month" | "custom";
  startDate: string;
  endDate: string;
  logOverview: AnalysisLogOverview;
  dailyCoverage: AnalysisDailyCoverageDay[];
  scoreOverview: AnalysisScoreOverview;
  scoreTrend: AnalysisScoreTrend;
}

export interface AnalysisMonthRecord {
  month: string;
  logOverview: AnalysisLogOverview;
  dailyCoverage: AnalysisDailyCoverageDay[];
  rhythmOverview: AnalysisRhythmOverview;
  dimensionBreakdown: AnalysisDimensionBreakdownItem[];
  dimensions: AnalysisDimensionInsightCard[];
  insightsOverview: AnalysisInsightsOverview;
  scoreOverview: AnalysisScoreOverview;
  scoreTrend: AnalysisScoreTrend;
  scoreRecords: DailyHappinessScoreRecord[];
  editableDates: string[];
  narrative: AnalysisNarrative | null;
}

/* ── AI Narrative types ── */

export type AnalysisInsightCardType = "trend" | "correlation" | "anomaly" | "pattern" | "profile" | "loop";

export interface AnalysisInsightCardItem {
  type: AnalysisInsightCardType;
  title: string;
  evidence: string;
  linkedDates: string[];
}

export interface AnalysisNarrative {
  overviewNarrative: string;
  dimensionTheses: Record<string, string>;
  insightCards: AnalysisInsightCardItem[];
}

export interface AnalysisSavedEntrySource {
  id: string;
  date: string;
  dimension: InterviewDimension;
  title: string;
  content: string;
  tags: string[];
  payload: InterviewJournalPayload | null;
  savedAt: string | null;
  updatedAt: string;
}

export interface AnalysisSavedDailyJournalSource {
  id: string;
  date: string;
  sourceSignature: string;
  title: string | null;
  content: string | null;
}
