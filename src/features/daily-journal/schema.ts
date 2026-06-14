import { z } from "zod";

import { ENTRY_DATE_REGEX, parseEntryDateInput } from "@/features/interview/entry-date";
import { MAX_JOURNAL_TITLE_LENGTH } from "@/features/interview/journal-title";

export const MAX_DAILY_JOURNAL_CONTENT_LENGTH = 6000;

const entryDateStringSchema = z.string().regex(ENTRY_DATE_REGEX).refine((value) => {
  try {
    parseEntryDateInput(value);
    return true;
  } catch {
    return false;
  }
}, "Invalid entry date");

export const dailyJournalEntrySchema = z.object({
  id: z.string(),
  date: entryDateStringSchema,
  title: z.string().max(MAX_JOURNAL_TITLE_LENGTH),
  content: z.string().max(MAX_DAILY_JOURNAL_CONTENT_LENGTH),
  status: z.enum(["draft", "saved"]),
  sourceEntryIds: z.array(z.string()),
  sourceSessionIds: z.array(z.string()),
  sourceSignature: z.string(),
  sourceUpdatedAt: z.string().nullable(),
  updatedAt: z.string(),
  savedAt: z.string().nullable()
});

export const dailyJournalSourceSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  dimension: z.enum(["joy", "fulfillment", "reflection", "improvement", "gratitude"]),
  title: z.string(),
  updatedAt: z.string(),
  savedAt: z.string().nullable()
});

export const getDailyJournalResponseSchema = z.object({
  dailyJournal: dailyJournalEntrySchema.nullable(),
  availableSourceCount: z.number().int().nonnegative(),
  draftSourceCount: z.number().int().nonnegative().default(0),
  sources: z.array(dailyJournalSourceSchema),
  state: z.enum(["none", "draft", "saved", "stale"])
});

export const todayJournalDimensionCardSchema = z.object({
  dimension: z.enum(["joy", "fulfillment", "reflection", "improvement", "gratitude"]),
  status: z.enum(["none", "talking", "journaled"]),
  hasNewSinceJournal: z.boolean(),
  title: z.string().nullable(),
  content: z.string().nullable(),
  sessionId: z.string().nullable(),
  entryId: z.string().nullable()
});

export const getTodayJournalBoardResponseSchema = z.object({
  date: entryDateStringSchema,
  dimensions: z.array(todayJournalDimensionCardSchema),
  dailyJournal: z.object({
    state: z.enum(["none", "draft", "saved", "stale"]),
    id: z.string().nullable(),
    savedCount: z.number().int().nonnegative()
  })
});

export const generateDailyJournalRequestSchema = z.object({
  date: entryDateStringSchema
});

export const generateDailyJournalResponseSchema = z.object({
  dailyJournal: dailyJournalEntrySchema,
  availableSourceCount: z.number().int().positive(),
  sources: z.array(dailyJournalSourceSchema),
  state: z.enum(["draft", "saved", "stale"])
});

export const saveAllDailyJournalRequestSchema = z.object({
  date: entryDateStringSchema
});

export const saveAllDailyJournalResponseSchema = z.object({
  dailyJournal: dailyJournalEntrySchema,
  promotedDimensions: z.array(z.enum(["joy", "fulfillment", "reflection", "improvement", "gratitude"])),
  availableSourceCount: z.number().int().nonnegative(),
  sources: z.array(dailyJournalSourceSchema),
  state: z.enum(["draft", "saved", "stale"])
});

export const updateDailyJournalRequestSchema = z.object({
  title: z.string().min(1).max(MAX_JOURNAL_TITLE_LENGTH),
  content: z.string().min(1).max(MAX_DAILY_JOURNAL_CONTENT_LENGTH)
});

export const updateDailyJournalResponseSchema = z.object({
  dailyJournal: dailyJournalEntrySchema
});

export const saveDailyJournalResponseSchema = z.object({
  dailyJournal: dailyJournalEntrySchema
});

export type DailyJournalEntryPayload = z.infer<typeof dailyJournalEntrySchema>;
export type DailyJournalSourcePayload = z.infer<typeof dailyJournalSourceSchema>;
export type TodayJournalBoardPayload = z.infer<typeof getTodayJournalBoardResponseSchema>;
export type TodayJournalDimensionCardPayload = z.infer<typeof todayJournalDimensionCardSchema>;
