import { z } from "zod";

import type { JournalDailyWritingMaterial } from "@/types/journal-daily-entry";

export const journalDailyParagraphSchema = z
  .object({
    text: z.string(),
    sourceRecordIds: z.array(z.string())
  })
  .strict();

export const journalDailyWriterOutputSchema = z
  .object({
    paragraphs: z.array(journalDailyParagraphSchema).min(1)
  })
  .strict();

export const journalDailyGenerationRequestSchema = z
  .object({
    entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    task: z.enum(["generate", "update"]).optional(),
    clientOperationId: z.string().trim().min(1).max(160).optional(),
    expectedSourceSignature: z.string().trim().min(1).optional(),
    expectedContentRevision: z.number().int().positive().nullable().optional()
  })
  .strict();

export const journalDailyAutosaveRequestSchema = z
  .object({
    expectedContentRevision: z.number().int().positive(),
    title: z.string().trim().min(1).max(16),
    content: z.string().trim().min(1),
    paragraphs: z
      .object({
        schemaVersion: z.literal(1),
        paragraphs: z.array(journalDailyParagraphSchema).min(1)
      })
      .strict()
      .optional()
  })
  .strict();

export const journalDailySaveRequestSchema = z
  .object({ expectedContentRevision: z.number().int().positive() })
  .strict();

export type JournalDailyParagraph = z.infer<typeof journalDailyParagraphSchema>;
export type JournalDailyWriterOutput = z.infer<typeof journalDailyWriterOutputSchema>;

export type JournalDailyGenerationTask = "generate" | "update";

export interface JournalDailySourceRecord {
  recordId: string;
  eventId: string;
  entryDate: string;
  daySequence: number;
  title: string;
  content: string;
  contentRevision: number;
  updatedAt: string;
  writingMaterial?: JournalDailyWritingMaterial;
}

export interface JournalDailyEntrySnapshot {
  id: string;
  entryDate: string;
  title: string;
  content: string;
  paragraphs: JournalDailyParagraph[];
  status: "draft" | "saved" | "modified";
  sourceRecordIds: string[];
  sourceVersions: Array<{ recordId: string; contentRevision: number | null }>;
  sourceSignature: string;
  contentRevision: number;
  savedRevision: number | null;
  currentGenerationTraceId: string | null;
  lastGenerationErrorCode: string | null;
}

export interface JournalDailySavedRevisionSnapshot {
  id: string;
  entryId: string;
  title: string;
  content: string;
  paragraphs: JournalDailyParagraph[];
  sourceVersions: Array<{ recordId: string; contentRevision: number | null }>;
  contentRevision: number;
}

export interface JournalDailyUpdatePlan {
  requiredSourceRecordIds: string[];
  newSourceRecordIds: string[];
  changedSourceRecordIds: string[];
  intentionalDeletionSourceRecordIds: string[];
  preservedParagraphs: JournalDailyParagraph[];
}

export interface JournalDailyGenerationView {
  entryDate: string;
  sourceRecords: JournalDailySourceRecord[];
  sourceSignature: string;
  entry: JournalDailyEntrySnapshot | null;
}

export interface JournalDailyWriterInput {
  task: JournalDailyGenerationTask;
  entryDate: string;
  title: string;
  sourceRecords: JournalDailySourceRecord[];
  currentEntry: JournalDailyEntrySnapshot | null;
  savedRevision: JournalDailySavedRevisionSnapshot | null;
  updatePlan: JournalDailyUpdatePlan | null;
}

export interface JournalDailyEntryWriter {
  outputOrigin?: "llm" | "deterministic" | "fallback";
  write(input: JournalDailyWriterInput): Promise<unknown>;
}

export interface CommitJournalDailyGenerationInput {
  userId: string;
  entryDate: string;
  task: JournalDailyGenerationTask;
  expectedSourceSignature: string;
  expectedContentRevision: number | null;
  title: string;
  content: string;
  paragraphs: JournalDailyParagraph[];
  generationTraceId: string | null;
  generationId: string;
  revisionKind: "generated" | "updated";
  outputOrigin: "llm" | "deterministic" | "fallback";
  pipelineDecisions: Array<Record<string, unknown>>;
}

export interface JournalDailyGenerationOperation {
  id: string;
  entryId: string | null;
  traceId: string | null;
  kind: JournalDailyGenerationTask;
  status: "processing" | "completed" | "failed" | "canceled";
  errorCode: string | null;
}

export interface JournalDailyGenerationStore {
  read(input: { userId: string; entryDate: string }): Promise<JournalDailyGenerationView>;
  readLatestSavedRevision(input: {
    userId: string;
    entryId: string;
  }): Promise<JournalDailySavedRevisionSnapshot | null>;
  reserve(input: {
    userId: string;
    entryDate: string;
    clientOperationId: string;
    task: JournalDailyGenerationTask;
    expectedSourceSignature: string;
    expectedContentRevision: number | null;
    requestId: string | null;
  }): Promise<JournalDailyGenerationOperation>;
  commit(input: CommitJournalDailyGenerationInput): Promise<JournalDailyEntrySnapshot>;
  fail(input: {
    userId: string;
    generationId: string;
    errorCode: string;
  }): Promise<void>;
}

export interface JournalDailyGenerationDependencies {
  store: JournalDailyGenerationStore;
  writer: JournalDailyEntryWriter;
}

export interface JournalDailyGenerationCommand {
  userId: string;
  entryDate: string;
  requestId?: string | null;
  clientOperationId?: string | null;
  expectedSourceSignature?: string | null;
  expectedContentRevision?: number | null;
}

export interface JournalDailyGenerationResult {
  task: JournalDailyGenerationTask;
  title: string;
  paragraphs: JournalDailyParagraph[];
  sourceSignature: string;
  generationTraceId: string | null;
  generationId: string;
  entry: JournalDailyEntrySnapshot;
}
