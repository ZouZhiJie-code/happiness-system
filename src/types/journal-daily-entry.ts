export type JournalDailyEntryStatus = "draft" | "saved" | "modified";

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
