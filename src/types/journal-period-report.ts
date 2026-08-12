export type JournalPeriodKind = "week" | "month";

export type JournalPeriodReportStatus = "draft" | "saved" | "modified";
export type JournalPeriodReportRevisionKind = "generated" | "updated" | "user_saved";
export type JournalPeriodReportGenerationKind = "generate" | "update";
export type JournalPeriodReportGenerationStatus =
  | "processing"
  | "completed"
  | "failed"
  | "canceled";

/** A concrete, readable source used by a weekly or monthly report. */
export type JournalPeriodMaterialKind = "daily_report" | "weekly_report" | "event_card";

export interface JournalPeriodRange {
  kind: JournalPeriodKind;
  /** Inclusive, Asia/Shanghai calendar date. */
  startDate: string;
  /** Inclusive, Asia/Shanghai calendar date. */
  endDate: string;
}

export interface JournalPeriodMaterial {
  /** Stable cross-layer source id, e.g. `daily:<id>` or `event:<id>`. */
  sourceId: string;
  kind: JournalPeriodMaterialKind;
  title: string;
  content: string;
  contentRevision: number;
  updatedAt: string;
  /** The source's own period or event date, always in Asia/Shanghai. */
  startDate: string;
  endDate: string;
  /** Event cards represented by this source; used to prevent cross-layer duplication. */
  sourceEventIds: string[];
  /** Direct inputs of an upstream report, retained for provenance and review. */
  upstreamSourceIds: string[];
}

export interface JournalPeriodParagraph {
  text: string;
  sourceIds: string[];
}

export interface JournalPeriodParagraphDocument {
  schemaVersion: 1;
  paragraphs: JournalPeriodParagraph[];
}

export interface JournalPeriodSourceSnapshot {
  schemaVersion: 1;
  period: JournalPeriodRange;
  sources: JournalPeriodMaterial[];
}

export interface JournalPeriodReportRecord {
  id: string;
  period: JournalPeriodRange;
  title: string;
  content: string;
  paragraphs: JournalPeriodParagraphDocument;
  status: JournalPeriodReportStatus;
  sourceIds: string[];
  sourceSignature: string;
  sourceSnapshot: JournalPeriodSourceSnapshot;
  sourceUpdatedAt: string | null;
  contentRevision: number;
  savedRevision: number | null;
  lastGenerationErrorCode: string | null;
  editedAt: string | null;
  savedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalPeriodReportRevisionRecord {
  id: string;
  reportId: string;
  kind: JournalPeriodReportRevisionKind;
  title: string;
  content: string;
  paragraphs: JournalPeriodParagraphDocument;
  sourceSignature: string;
  sourceSnapshot: JournalPeriodSourceSnapshot;
  contentRevision: number;
  createdAt: string;
}

export interface JournalPeriodReportGenerationRecord {
  id: string;
  period: JournalPeriodRange;
  reportId: string | null;
  clientOperationId: string;
  kind: JournalPeriodReportGenerationKind;
  status: JournalPeriodReportGenerationStatus;
  expectedSourceSignature: string;
  expectedContentRevision: number | null;
  resultRevisionId: string | null;
  attemptCount: number;
  errorCode: string | null;
  startedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type JournalPeriodReportFreshness = "none" | JournalPeriodReportStatus | "stale";

export type JournalPeriodReportDisplayStatus =
  | "empty"
  | "ungenerated"
  | "generating"
  | "draft"
  | "saved"
  | "stale"
  | "update_failed";

export type JournalPeriodPrimaryAction =
  | { kind: "none"; label: "暂无可汇总内容" }
  | { kind: "generate"; label: string }
  | { kind: "update"; label: string }
  | { kind: "retry"; label: string }
  | { kind: "view"; label: string };

export interface JournalPeriodReportStatistics {
  materialCount: number;
  dailyReportCount: number;
  weeklyReportCount: number;
  eventCardCount: number;
  coveredDayCount: number;
}

/** Shared read contract consumed by the report canvas for both week and month. */
export interface JournalPeriodReportView {
  period: JournalPeriodRange;
  materials: JournalPeriodMaterial[];
  sourceSignature: string;
  report: JournalPeriodReportRecord | null;
  freshness: JournalPeriodReportFreshness;
  displayStatus: JournalPeriodReportDisplayStatus;
  latestGeneration: JournalPeriodReportGenerationRecord | null;
  statistics: JournalPeriodReportStatistics;
  primaryAction: JournalPeriodPrimaryAction;
}

export interface CommitJournalPeriodReportInput {
  userId: string;
  period: JournalPeriodRange;
  expectedSourceSignature: string;
  expectedContentRevision: number | null;
  title: string;
  content: string;
  paragraphs?: JournalPeriodParagraphDocument;
  generationId?: string | null;
  revisionKind?: Extract<JournalPeriodReportRevisionKind, "generated" | "updated">;
}

export interface UpdateJournalPeriodReportInput {
  userId: string;
  reportId: string;
  expectedContentRevision: number;
  title: string;
  content: string;
  paragraphs?: JournalPeriodParagraphDocument;
}

export interface SaveJournalPeriodReportInput {
  userId: string;
  reportId: string;
  expectedContentRevision: number;
}

export interface ReserveJournalPeriodReportGenerationInput {
  userId: string;
  period: JournalPeriodRange;
  clientOperationId: string;
  kind: JournalPeriodReportGenerationKind;
  expectedSourceSignature: string;
  expectedContentRevision: number | null;
}

export interface SettleJournalPeriodReportGenerationInput {
  userId: string;
  generationId: string;
  errorCode: string;
}
