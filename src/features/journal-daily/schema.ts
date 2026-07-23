import { z } from "zod";

import { MAX_JOURNAL_TITLE_LENGTH } from "@/features/interview/journal-title";

export const MAX_JOURNAL_DAILY_CONTENT_LENGTH = 30_000;
export const MAX_JOURNAL_DAILY_INSIGHT_LENGTH = 300;

const entryDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
const clientOperationIdSchema = z.string().trim().min(1).max(160);
const sourceSignatureSchema = z.string().trim().min(1).max(10_000);
const contentRevisionSchema = z.number().int().min(1);

export const generateJournalDailyEntryRequestSchema = z.object({
  entryDate: entryDateSchema,
  clientOperationId: clientOperationIdSchema,
  expectedSourceSignature: sourceSignatureSchema,
  expectedContentRevision: contentRevisionSchema.nullable(),
  replaceManualEditsConfirmed: z.boolean()
});

export const generateJournalDailySelfInsightRequestSchema = z.object({
  clientOperationId: clientOperationIdSchema,
  expectedSourceSignature: sourceSignatureSchema,
  expectedContentRevision: contentRevisionSchema
});

export const updateJournalDailyEntryRequestSchema = z.object({
  expectedContentRevision: contentRevisionSchema,
  title: z.string().trim().min(1).max(MAX_JOURNAL_TITLE_LENGTH),
  content: z.string().trim().min(1).max(MAX_JOURNAL_DAILY_CONTENT_LENGTH)
});

export const saveJournalDailyEntryRequestSchema = z.object({
  expectedContentRevision: contentRevisionSchema
});

export const cancelJournalDailyEntryGenerationRequestSchema = z.object({}).strict();

export const journalDailyInsightDraftSchema = z.object({
  title: z.string().trim().min(1).max(MAX_JOURNAL_TITLE_LENGTH),
  selfInsight: z
    .object({
      text: z.string().trim().min(1).max(MAX_JOURNAL_DAILY_INSIGHT_LENGTH),
      sourceEventIds: z.array(z.string().trim().min(1)).min(2),
      sharedEvidencePhrase: z
        .string()
        .trim()
        .max(30)
        .optional()
        .transform((value) => value ?? ""),
      evidence: z
        .array(
          z.object({
            eventId: z.string().trim().min(1),
            quote: z.string().trim().min(4).max(160)
          })
        )
        .max(8)
        .optional()
        .transform((value) => value ?? [])
    })
    .nullable()
});

export type JournalDailyInsightDraft = z.infer<
  typeof journalDailyInsightDraftSchema
>;
