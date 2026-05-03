import type { InterviewDimension, InterviewSessionStatus, JoyEntryStatus } from "@/types/interview";

export type CalendarDayStatus = "empty" | "in_progress" | "draft" | "completed" | "mixed";
export type CalendarDailyJournalState = "none" | "draft" | "saved" | "stale";

export type CalendarAction =
  | "start_interview"
  | "continue_interview"
  | "continue_editing"
  | "view_journal"
  | "edit_saved_journal";

export type CalendarSourceDimension = InterviewDimension;

export interface CalendarSessionSource {
  kind: "session";
  id: string;
  dimension: CalendarSourceDimension;
  date: string;
  status: InterviewSessionStatus;
  updatedAt: string;
  startedAt: string;
  completedAt: string | null;
  pausedAt: string | null;
  draftSummary: string | null;
  journalEntryId: string | null;
}

export interface CalendarEntrySource {
  kind: "entry";
  id: string;
  sessionId: string;
  dimension: CalendarSourceDimension;
  date: string;
  status: JoyEntryStatus;
  title: string;
  content: string;
  updatedAt: string;
  savedAt: string | null;
}

export interface CalendarDailyJournalSource {
  kind: "daily_journal";
  id: string;
  date: string;
  status: "draft" | "saved";
  title: string;
  updatedAt: string;
  savedAt: string | null;
  sourceEntryIds: string[];
  sourceSignature: string;
}

export interface CalendarDailyJournalStatus {
  state: CalendarDailyJournalState;
  id: string | null;
  title: string | null;
  updatedAt: string | null;
  savedAt: string | null;
  sourceEntryCount: number;
}

export interface CalendarDimensionStatus {
  dimension: CalendarSourceDimension;
  status: CalendarDayStatus;
  title: string | null;
  summary: string | null;
  latestUpdatedAt: string | null;
  sessionId: string | null;
  journalEntryId: string | null;
  actions: CalendarAction[];
  hasActiveSession: boolean;
  hasDraftEntry: boolean;
  hasSavedEntry: boolean;
}

export interface CalendarDayRecord {
  date: string;
  overallStatus: CalendarDayStatus;
  dailyJournal?: CalendarDailyJournalStatus;
  dimensions: CalendarDimensionStatus[];
  activeCount: number;
  draftCount: number;
  savedCount: number;
  primaryTitle: string | null;
  primarySummary: string | null;
  latestUpdatedAt: string | null;
  primaryAction: CalendarAction | null;
}

export interface CalendarWeekRecord {
  anchorDate: string;
  weekStartDate: string;
  weekEndDate: string;
  days: CalendarDayRecord[];
}

export interface CalendarMonthRecord {
  month: string;
  days: CalendarDayRecord[];
}
