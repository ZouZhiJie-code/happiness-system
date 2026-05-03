import type { InterviewDimension, InterviewJournalPayload } from "@/types/interview";
import type { DailyHappinessScoreRecord } from "@/features/happiness-score/types";

export interface AnalysisLogOverview {
  recordedDayCount: number;
  savedEntryCount: number;
  dailyJournalSavedDayCount: number;
}

export interface AnalysisDailyCoverageDay {
  date: string;
  savedDimensionCount: number;
  savedDimensions: InterviewDimension[];
  hasDailyJournalSaved: boolean;
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

export interface AnalysisDimensionInsightCard {
  dimension: InterviewDimension;
  savedEntryCount: number;
  recordedDayCount: number;
  lastRecordedDate: string | null;
  topTags: AnalysisDimensionTagStat[];
  recentSignals: AnalysisDimensionSignalExcerpt[];
}

export interface AnalysisMonthRecord {
  month: string;
  logOverview: AnalysisLogOverview;
  dailyCoverage: AnalysisDailyCoverageDay[];
  dimensionBreakdown: AnalysisDimensionBreakdownItem[];
  dimensions: AnalysisDimensionInsightCard[];
  scoreRecords: DailyHappinessScoreRecord[];
  editableDates: string[];
}

export interface AnalysisSavedEntrySource {
  id: string;
  date: string;
  dimension: InterviewDimension;
  tags: string[];
  payload: InterviewJournalPayload | null;
  savedAt: string | null;
  updatedAt: string;
}

export interface AnalysisSavedDailyJournalSource {
  id: string;
  date: string;
}
