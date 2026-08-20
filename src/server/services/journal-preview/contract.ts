import type {
  JournalDailyEntryRecord,
  JournalDailyJournalView,
  JournalDailyParagraphDocument
} from "@/types/journal-daily-entry";
import type { JournalEventEntryRecord } from "@/types/journal-event-entry";

export const JOURNAL_PREVIEW_MODE = "fixed-six-v1" as const;

export const JOURNAL_PREVIEW_CASES = [
  { id: "v6-a1", label: "v6 A1", editable: false },
  { id: "v7-a1", label: "v7 A1", editable: false },
  { id: "v7-a2", label: "v7 A2", editable: false },
  { id: "v7r2-a1", label: "v7r2 A1", editable: false },
  { id: "v7r2-a2", label: "v7r2 A2", editable: false },
  { id: "v7r4-a1", label: "v7r4 A1", editable: true }
] as const;

export type JournalPreviewCaseId = (typeof JOURNAL_PREVIEW_CASES)[number]["id"];

export interface JournalPreviewRequestContext {
  mode: typeof JOURNAL_PREVIEW_MODE;
  sessionId: string;
  caseId: JournalPreviewCaseId;
}

export interface JournalPreviewCaseSummary {
  caseId: JournalPreviewCaseId;
  label: string;
  entryDate: string;
  editable: boolean;
  eventEntryId: string;
  dailyEntryId: string;
  sourceSignature: string;
  contentRevision: number;
}

export interface JournalPreviewSessionView {
  mode: typeof JOURNAL_PREVIEW_MODE;
  sessionId: string;
  cases: JournalPreviewCaseSummary[];
  resetBehavior: "session_copy_auto_reset";
  modelCalls: 0;
}

export interface JournalPreviewDayView {
  view: JournalDailyJournalView;
  record: JournalEventEntryRecord;
  preview: {
    mode: typeof JOURNAL_PREVIEW_MODE;
    sessionId: string;
    caseId: JournalPreviewCaseId;
    editable: boolean;
    baselineSourceSignature: string;
    baselineRecordCardSha256: string;
    baselineDailySha256: string;
    modelCalls: 0;
  };
}

export interface JournalPreviewDailyGenerationResult {
  task: "generate" | "update";
  title: string;
  paragraphs: JournalDailyParagraphDocument["paragraphs"];
  sourceSignature: string;
  generationTraceId: string | null;
  generationId: string;
  entry: JournalDailyEntryRecord;
  preview: {
    mode: typeof JOURNAL_PREVIEW_MODE;
    sessionId: string;
    caseId: JournalPreviewCaseId;
    modelCalls: 0;
    resultKind: "sealed_baseline" | "fixed_update_sample";
  };
}
