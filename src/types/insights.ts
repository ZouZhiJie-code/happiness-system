import type { JournalPeriodKind } from "@/types/journal-period-report";

export type InsightsSection = "trends" | "portrait" | "memories";
export type InsightsRangePreset = "week" | "month" | "custom";
export type InsightsJournalDisplayStatus =
  | "generating"
  | "draft"
  | "saved"
  | "stale"
  | "update_failed";

export interface InsightsDateRange {
  preset: InsightsRangePreset;
  startDate: string;
  endDate: string;
  timeZone: "Asia/Shanghai";
  weekStartsOn: "monday";
}

export interface InsightsDailyJournalSummary {
  id: string;
  title: string;
  status: InsightsJournalDisplayStatus;
  href: string;
}

export interface InsightsDailyActivity {
  date: string;
  recordCount: number;
  journal: InsightsDailyJournalSummary | null;
}

export interface InsightsPeriodReportSummary {
  id: string;
  kind: JournalPeriodKind;
  startDate: string;
  endDate: string;
  title: string;
  status: InsightsJournalDisplayStatus;
  href: string;
}

export interface InsightsTrendsSummary {
  recordedDayCount: number;
  completedRecordCount: number;
  dailyJournalCount: number;
  weeklyJournalCount: number;
  monthlyJournalCount: number;
}

export interface InsightsTrendsView {
  range: InsightsDateRange;
  summary: InsightsTrendsSummary;
  dailyActivity: InsightsDailyActivity[];
  periodReports: InsightsPeriodReportSummary[];
  legacyDimensionRecordsIncluded: false;
  happinessScoresIncluded: false;
}

export interface InsightsRecentRecord {
  id: string;
  entryDate: string;
  title: string;
  href: string;
}

export interface InsightsMonthlyChange {
  month: string;
  recordCount: number;
  recordedDayCount: number;
  dailyJournalCount: number;
  href: string;
}

export interface InsightsSelfView {
  title: "记录中的我";
  firstRecordedDate: string | null;
  latestRecordedDate: string | null;
  recordedDayCount: number;
  completedRecordCount: number;
  recordingSpanDays: number;
  recentRecords: InsightsRecentRecord[];
  monthlyChanges: InsightsMonthlyChange[];
  memoryAvailability: "coming_soon";
  legacyDimensionRecordsIncluded: false;
}

export interface InsightsWorkspaceData {
  trends: InsightsTrendsView;
  self: InsightsSelfView;
}
