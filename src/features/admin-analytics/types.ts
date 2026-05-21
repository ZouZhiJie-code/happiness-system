import type { InterviewDimension } from "@/types/interview";

export interface AdminAnalyticsRange {
  startDate: string;
  endDate: string;
}

export interface AdminAnalyticsOverviewRecord {
  range: AdminAnalyticsRange;
  northStar: {
    name: "MRU-7";
    value: number;
  };
  overview: {
    savedJournalUsers: number;
    savedJournalCount: number;
    savedDailyJournalUsers: number;
    savedDailyJournalCount: number;
    happinessScoreUsers: number;
    happinessScoreCount: number;
  };
  ai: {
    successRate: number;
    p50LatencyMs: number | null;
    p95LatencyMs: number | null;
  };
}

export interface AdminAnalyticsFunnelRecord {
  mainFunnel: Array<{
    key:
      | "register"
      | "login"
      | "privatePageView"
      | "sessionStart"
      | "firstReply"
      | "draftGenerated"
      | "journalSaved";
    count: number;
  }>;
  secondaryFunnel: Array<{
    key: "dailyJournalGenerated" | "dailyJournalSaved";
    count: number;
  }>;
  qualitySignals: {
    pausedCount: number;
    reopenedCount: number;
    boundaryInsufficientCount: number;
    dimensionRedirectCount: number;
  };
}

export interface AdminAnalyticsRetentionRecord {
  d1ReturnToRecordRate: number;
  d7ReturnToRecordRate: number;
  d30ReturnToRecordRate: number;
  d7RepeatSaveRate: number;
  d30RepeatSaveRate: number;
}

export interface AdminAnalyticsQualityRecord {
  dimensionSaveBreakdown: Array<{
    dimension: InterviewDimension;
    savedEntryCount: number;
  }>;
  draftEditRate: number;
  boundaryInsufficientRate: number;
  staleRate: number;
  ai: {
    successRate: number;
    p50LatencyMs: number | null;
    p95LatencyMs: number | null;
    errorCodeBreakdown: Array<{
      errorCode: string;
      count: number;
    }>;
  };
}
