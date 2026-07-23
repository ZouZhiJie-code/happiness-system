import type { AIOutputOrigin } from "@prisma/client";

export type JournalDailyEntryStatus = "draft" | "saved" | "modified";

export type JournalDailyEntryGenerationKind = "daily_journal" | "self_insight";

export type JournalDailyEntryGenerationStatus =
  | "processing"
  | "completed"
  | "failed"
  | "canceled";

export interface JournalDailySourceEntry {
  eventId: string;
  entryId: string;
  entryDate: string;
  daySequence: number;
  title: string;
  content: string;
  savedRevision: number;
  savedAt: string;
}

export interface JournalDailyEntrySourceSnapshot {
  schemaVersion: 1;
  entryDate: string;
  sources: JournalDailySourceEntry[];
}

export interface JournalDailyEntryRecord {
  id: string;
  entryDate: string;
  title: string;
  content: string;
  status: JournalDailyEntryStatus;
  sourceEntryIds: string[];
  sourceEventIds: string[];
  sourceSignature: string;
  sourceSnapshot: JournalDailyEntrySourceSnapshot;
  sourceUpdatedAt: string | null;
  contentRevision: number;
  savedRevision: number | null;
  editedAt: string | null;
  savedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalDailyEntryGenerationRecord {
  id: string;
  entryDate: string;
  operationKind: JournalDailyEntryGenerationKind;
  clientOperationId: string;
  intendedEntryId: string;
  resultEntryId: string | null;
  traceId: string | null;
  status: JournalDailyEntryGenerationStatus;
  attemptCount: number;
  sourceSignature: string;
  sourceEntryIds: string[];
  sourceEventIds: string[];
  sourceSnapshot: JournalDailyEntrySourceSnapshot;
  baseContentRevision: number | null;
  replaceManualEditsConfirmed: boolean;
  errorCode: string | null;
  startedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReserveJournalDailyEntryGenerationInput {
  userId: string;
  entryDate: string;
  operationKind: JournalDailyEntryGenerationKind;
  clientOperationId: string;
  expectedSourceSignature: string;
  expectedContentRevision: number | null;
  replaceManualEditsConfirmed: boolean;
  requestId?: string | null;
}

export type ReserveJournalDailyEntryGenerationResult =
  | {
      kind: "entry";
      entry: JournalDailyEntryRecord;
      generation: JournalDailyEntryGenerationRecord;
    }
  | {
      kind: "generation";
      generation: JournalDailyEntryGenerationRecord;
      newlyReserved: boolean;
    };

export interface CompleteJournalDailyEntryGenerationInput {
  userId: string;
  generationId: string;
  sourceSignature: string;
  title: string;
  content: string;
  outputOrigin: AIOutputOrigin;
  pipelineDecisions?: Array<Record<string, unknown>>;
}

export interface JournalDailySelfInsight {
  text: string;
  sourceEventIds: string[];
  sharedEvidencePhrase: string;
  evidence: Array<{
    eventId: string;
    quote: string;
  }>;
}

export interface CompleteJournalDailySelfInsightGenerationInput {
  userId: string;
  generationId: string;
  sourceSignature: string;
  baseContentRevision: number;
  selfInsight: JournalDailySelfInsight | null;
  outputOrigin: AIOutputOrigin;
  pipelineDecisions?: Array<Record<string, unknown>>;
}

export type CompleteJournalDailySelfInsightGenerationResult =
  | {
      kind: "appended";
      entry: JournalDailyEntryRecord;
    }
  | {
      kind: "insufficient_evidence";
      entry: JournalDailyEntryRecord;
    };

export interface SettleJournalDailyEntryGenerationInput {
  userId: string;
  generationId: string;
  errorCode: string;
}

export type JournalDailySourceCollection =
  | { kind: "empty" }
  | { kind: "single_entry"; entryId: string }
  | { kind: "multiple_entries" };

export type JournalDailyEntryFreshness = "none" | JournalDailyEntryStatus | "stale";

export interface JournalDailyJournalView {
  entryDate: string;
  savedSources: JournalDailySourceEntry[];
  pendingSaveEntryIds: string[];
  sourceSignature: string;
  collection: JournalDailySourceCollection;
  entry: JournalDailyEntryRecord | null;
  generation: JournalDailyEntryGenerationRecord | null;
  freshness: JournalDailyEntryFreshness;
  updateBlockedByPendingSource: boolean;
}

export interface CommitJournalDailyEntryDraftInput {
  userId: string;
  entryDate: string;
  expectedSourceSignature: string;
  expectedContentRevision: number | null;
  replaceManualEditsConfirmed: boolean;
  title: string;
  content: string;
}

export interface UpdateJournalDailyEntryInput {
  userId: string;
  entryId: string;
  expectedContentRevision: number;
  title: string;
  content: string;
}

export interface SaveJournalDailyEntryInput {
  userId: string;
  entryId: string;
  expectedContentRevision: number;
}
