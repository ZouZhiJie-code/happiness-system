import { z } from "zod";

import type {
  JournalPeriodMaterial,
  JournalPeriodParagraph,
  JournalPeriodRange,
  JournalPeriodReportRecord,
  JournalPeriodReportRevisionRecord
} from "@/types/journal-period-report";

export const journalPeriodParagraphSchema = z
  .object({ text: z.string(), sourceIds: z.array(z.string()) })
  .strict();

export const journalPeriodGenerateRequestSchema = z
  .object({
    kind: z.enum(["week", "month"]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    task: z.enum(["generate", "update"]).optional(),
    clientOperationId: z.string().trim().min(1).max(160).optional(),
    expectedSourceSignature: z.string().trim().min(1).optional(),
    expectedContentRevision: z.number().int().positive().nullable().optional()
  })
  .strict();

export const journalPeriodAutosaveRequestSchema = z
  .object({
    expectedContentRevision: z.number().int().positive(),
    title: z.string().trim().min(1).max(16),
    content: z.string().trim().min(1),
    paragraphs: z
      .object({ schemaVersion: z.literal(1), paragraphs: z.array(journalPeriodParagraphSchema).min(1) })
      .strict()
      .optional()
  })
  .strict();

export const journalPeriodSaveRequestSchema = z
  .object({ expectedContentRevision: z.number().int().positive() })
  .strict();

export type JournalPeriodGenerationTask = "generate" | "update";

export interface JournalPeriodUpdatePlan {
  requiredSourceIds: string[];
  newSourceIds: string[];
  changedSourceIds: string[];
  intentionalDeletionSourceIds: string[];
  preservedParagraphs: JournalPeriodParagraph[];
}

export interface JournalPeriodGenerationCommand {
  userId: string;
  period: JournalPeriodRange;
  clientOperationId?: string | null;
  expectedSourceSignature?: string | null;
  expectedContentRevision?: number | null;
}

export interface JournalPeriodGenerationResult {
  task: JournalPeriodGenerationTask;
  title: string;
  paragraphs: JournalPeriodParagraph[];
  sourceSignature: string;
  generationId: string;
  report: JournalPeriodReportRecord;
}

export interface JournalPeriodGenerationView {
  period: JournalPeriodRange;
  materials: JournalPeriodMaterial[];
  sourceSignature: string;
  report: JournalPeriodReportRecord | null;
}

export interface JournalPeriodGenerationStore {
  read(input: { userId: string; period: JournalPeriodRange }): Promise<JournalPeriodGenerationView>;
  readLatestSavedRevision(input: {
    userId: string;
    reportId: string;
  }): Promise<JournalPeriodReportRevisionRecord | null>;
  reserve(input: {
    userId: string;
    period: JournalPeriodRange;
    clientOperationId: string;
    task: JournalPeriodGenerationTask;
    expectedSourceSignature: string;
    expectedContentRevision: number | null;
  }): Promise<{
    id: string;
    reportId: string | null;
    status: "processing" | "completed" | "failed" | "canceled";
    errorCode: string | null;
  }>;
  commit(input: {
    userId: string;
    period: JournalPeriodRange;
    expectedSourceSignature: string;
    expectedContentRevision: number | null;
    title: string;
    content: string;
    paragraphs: JournalPeriodParagraph[];
    generationId: string;
    revisionKind: "generated" | "updated";
  }): Promise<JournalPeriodReportRecord>;
  fail(input: { userId: string; generationId: string; errorCode: string }): Promise<void>;
}

export interface JournalPeriodWriterInput {
  task: JournalPeriodGenerationTask;
  period: JournalPeriodRange;
  title: string;
  materials: JournalPeriodMaterial[];
  currentReport: JournalPeriodReportRecord | null;
  savedRevision: JournalPeriodReportRevisionRecord | null;
  updatePlan: JournalPeriodUpdatePlan | null;
}

export interface JournalPeriodWriter {
  write(input: JournalPeriodWriterInput): Promise<{ paragraphs: JournalPeriodParagraph[] }>;
}

export interface JournalPeriodGenerationDependencies {
  store: JournalPeriodGenerationStore;
  writer: JournalPeriodWriter;
}
