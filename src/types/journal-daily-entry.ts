import type { AIOutputOrigin } from "@prisma/client";

export type JournalDailyEntryStatus = "draft" | "saved" | "modified";

export type JournalDailyEntryRevisionKind = "generated" | "updated" | "user_saved";
export type JournalDailyEntryGenerationKind = "generate" | "update";
export type JournalDailyEntryGenerationStatus =
  | "processing"
  | "completed"
  | "failed"
  | "canceled";

export type JournalRecordSourceMode = "capture" | "chat";

export interface JournalDailyParagraph {
  text: string;
  sourceRecordIds: string[];
}

export interface JournalDailyParagraphDocument {
  schemaVersion: 1;
  paragraphs: JournalDailyParagraph[];
}

export interface JournalDailySourceEntry {
  eventId: string;
  entryId: string;
  entryDate: string;
  daySequence: number;
  title: string;
  content: string;
  contentRevision: number;
  savedRevision: number | null;
  savedAt: string | null;
  updatedAt: string;
  recordedAt: string;
  occurredAt: string | null;
  sourceMode: JournalRecordSourceMode;
  recordCount: number;
  sourceMessageIds: string[];
}

/**
 * Writer-only structure derived from the current record-card revision.
 * It must stay outside JournalDailyJournalView and persisted daily snapshots.
 */
export interface JournalDailyWritingMaterial {
  eventText: string;
  supportedInsights: string[];
  questionContext: Array<{
    answerSourceMessageId: string;
    question: string;
  }>;
  basedOnContentRevision: number;
}

/**
 * Existing event-centred daily entries used schemaVersion 1.  The reader keeps
 * accepting it so the new journal page can preserve old candidate data while
 * all new writes use the record-card based schemaVersion 2 contract.
 */
export interface LegacyJournalDailyEntrySourceSnapshot {
  schemaVersion: 1;
  entryDate: string;
  sources: Array<{
    eventId: string;
    entryId: string;
    entryDate: string;
    daySequence: number;
    title: string;
    content: string;
    savedRevision: number;
    savedAt: string;
  }>;
}

export interface JournalDailyEntrySourceSnapshot {
  schemaVersion: 2;
  entryDate: string;
  sources: JournalDailySourceEntry[];
}

export type AnyJournalDailyEntrySourceSnapshot =
  | LegacyJournalDailyEntrySourceSnapshot
  | JournalDailyEntrySourceSnapshot;

export interface JournalDailyEntryRecord {
  id: string;
  entryDate: string;
  title: string;
  content: string;
  paragraphs: JournalDailyParagraphDocument;
  status: JournalDailyEntryStatus;
  sourceEntryIds: string[];
  sourceEventIds: string[];
  sourceSignature: string;
  sourceSnapshot: AnyJournalDailyEntrySourceSnapshot;
  sourceUpdatedAt: string | null;
  contentRevision: number;
  savedRevision: number | null;
  currentGenerationTraceId: string | null;
  lastGenerationErrorCode: string | null;
  editedAt: string | null;
  savedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalDailyEntryRevisionRecord {
  id: string;
  entryId: string;
  kind: JournalDailyEntryRevisionKind;
  title: string;
  content: string;
  paragraphs: JournalDailyParagraphDocument;
  sourceSignature: string;
  sourceSnapshot: AnyJournalDailyEntrySourceSnapshot;
  contentRevision: number;
  generationTraceId: string | null;
  createdAt: string;
}

export interface JournalDailyEntryGenerationRecord {
  id: string;
  entryDate: string;
  entryId: string | null;
  traceId: string | null;
  clientOperationId: string;
  kind: JournalDailyEntryGenerationKind;
  status: JournalDailyEntryGenerationStatus;
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

export type JournalDailySourceCollection =
  | { kind: "empty" }
  | { kind: "single_entry"; entryId: string }
  | { kind: "multiple_entries" };

export type JournalDailyEntryFreshness = "none" | JournalDailyEntryStatus | "stale";

export type JournalDailyDisplayStatus =
  | "ungenerated"
  | "generating"
  | "draft"
  | "saved"
  | "stale"
  | "update_failed";

export interface JournalDailyJournalView {
  entryDate: string;
  savedSources: JournalDailySourceEntry[];
  pendingSaveEntryIds: string[];
  sourceSignature: string;
  collection: JournalDailySourceCollection;
  entry: JournalDailyEntryRecord | null;
  freshness: JournalDailyEntryFreshness;
  displayStatus: JournalDailyDisplayStatus;
  latestGeneration: JournalDailyEntryGenerationRecord | null;
  updateBlockedByPendingSource: boolean;
}

export interface CommitJournalDailyEntryDraftInput {
  userId: string;
  entryDate: string;
  expectedSourceSignature: string;
  expectedContentRevision: number | null;
  /** @deprecated Record-card journals use optimistic versions instead. */
  replaceManualEditsConfirmed?: boolean;
  title: string;
  content: string;
  paragraphs?: JournalDailyParagraphDocument;
  generationTraceId?: string | null;
  generationId?: string | null;
  revisionKind?: Extract<JournalDailyEntryRevisionKind, "generated" | "updated">;
  outputOrigin?: AIOutputOrigin;
  pipelineDecisions?: Array<Record<string, unknown>>;
}

export interface UpdateJournalDailyEntryInput {
  userId: string;
  entryId: string;
  expectedContentRevision: number;
  title: string;
  content: string;
  paragraphs?: JournalDailyParagraphDocument;
}

export interface SaveJournalDailyEntryInput {
  userId: string;
  entryId: string;
  expectedContentRevision: number;
}

export interface ReserveJournalDailyEntryGenerationInput {
  userId: string;
  entryDate: string;
  clientOperationId: string;
  kind: JournalDailyEntryGenerationKind;
  expectedSourceSignature: string;
  expectedContentRevision: number | null;
  traceId?: string | null;
  requestId?: string | null;
}

export interface SettleJournalDailyEntryGenerationInput {
  userId: string;
  generationId: string;
  errorCode: string;
}
