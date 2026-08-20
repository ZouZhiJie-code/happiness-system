import type { InterviewDimension } from "@/types/interview";
import type { CurrentProductFunnelStep } from "@/features/admin-analytics/metrics";

export interface AdminAnalyticsRange {
  startDate: string;
  endDate: string;
}

export interface AdminAnalyticsOverviewRecord {
  contractVersion: 2;
  range: AdminAnalyticsRange;
  northStar: {
    name: "MRU-7";
    value: number;
  };
  currentOverview: {
    savedEventCardUsers: number;
    savedEventCardCount: number;
    savedDailyJournalUsers: number;
    savedDailyJournalCount: number;
  };
  overview: {
    savedJournalUsers: number;
    savedJournalCount: number;
    savedDailyJournalUsers: number;
    savedDailyJournalCount: number;
    happinessScoreUsers: number;
    happinessScoreCount: number;
  };
  legacyOverview: {
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

type AdminAnalyticsLegacyMainFunnel = Array<{
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

type AdminAnalyticsLegacySecondaryFunnel = Array<{
  key: "dailyJournalGenerated" | "dailyJournalSaved";
  count: number;
}>;

type AdminAnalyticsLegacyQualitySignals = {
  pausedCount: number;
  reopenedCount: number;
  boundaryInsufficientCount: number;
  dimensionRedirectCount: number;
};

export interface AdminAnalyticsFunnelRecord {
  contractVersion: 2;
  currentProductFunnel: Array<{
    key: CurrentProductFunnelStep;
    count: number;
  }>;
  legacyFunnel: {
    mainFunnel: AdminAnalyticsLegacyMainFunnel;
    secondaryFunnel: AdminAnalyticsLegacySecondaryFunnel;
    qualitySignals: AdminAnalyticsLegacyQualitySignals;
  };
  /** Compatibility aliases retained for one contract cycle. */
  mainFunnel: AdminAnalyticsLegacyMainFunnel;
  secondaryFunnel: AdminAnalyticsLegacySecondaryFunnel;
  qualitySignals: AdminAnalyticsLegacyQualitySignals;
}

export interface AdminAnalyticsRetentionRecord {
  contractVersion: 2;
  timezone: "Asia/Shanghai";
  cohort: {
    anchor: "first_event_journal_saved";
    userCount: number;
  };
  retention: {
    d1ReturnToRecordRate: number;
    d7ReturnToRecordRate: number;
    d30ReturnToRecordRate: number;
    d7RepeatSaveRate: number;
    d30RepeatSaveRate: number;
  };
  eligibility: {
    d1EligibleUsers: number;
    d7EligibleUsers: number;
    d30EligibleUsers: number;
  };
  /** Compatibility aliases retained for one contract cycle. */
  d1ReturnToRecordRate: number;
  d7ReturnToRecordRate: number;
  d30ReturnToRecordRate: number;
  d7RepeatSaveRate: number;
  d30RepeatSaveRate: number;
}

interface AdminAnalyticsAIQuality {
  successRate: number;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  errorCodeBreakdown: Array<{
    errorCode: string;
    count: number;
  }>;
}

interface AdminAnalyticsLatencySignal {
  sampleCount: number;
  p50Ms: number | null;
  p95Ms: number | null;
}

export interface AdminAnalyticsQualityRecord {
  contractVersion: 2;
  qualitySignals: {
    fallbackRate: number;
    abnormalExitRate: number;
    resumeSuccessRate: number;
    staleRate: number;
    firstVisibleLatency: AdminAnalyticsLatencySignal;
    fullInteractionLatency: AdminAnalyticsLatencySignal;
    counts: {
      completedResponses: number;
      fallbackTurns: number;
      startedSessions: number;
      abandonedSessions: number;
      resumeStarted: number;
      resumeCompleted: number;
      resumeFailed: number;
    };
  };
  legacyQuality: {
    dimensionSaveBreakdown: Array<{
      dimension: InterviewDimension;
      savedEntryCount: number;
    }>;
    draftEditRate: number;
    boundaryInsufficientRate: number;
    ai: AdminAnalyticsAIQuality;
  };
  /** Compatibility aliases retained for one contract cycle. */
  dimensionSaveBreakdown: Array<{
    dimension: InterviewDimension;
    savedEntryCount: number;
  }>;
  draftEditRate: number;
  boundaryInsufficientRate: number;
  staleRate: number;
  ai: AdminAnalyticsAIQuality;
}
