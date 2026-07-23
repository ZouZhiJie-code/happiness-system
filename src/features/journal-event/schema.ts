import { z } from "zod";

import { MAX_JOURNAL_TITLE_LENGTH } from "@/features/interview/journal-title";
import { MAX_EVENT_JOURNAL_CONTENT_LENGTH } from "@/types/journal-event-entry";

const nonBlankText = (maximum: number) =>
  z.string().max(maximum).refine((value) => Boolean(value.trim()), "Text must not be blank");

export const eventJournalDraftSchema = z.object({
  title: nonBlankText(40),
  eventNarrative: nonBlankText(MAX_EVENT_JOURNAL_CONTENT_LENGTH),
  insights: z.array(
    z.object({
      sourceOutcomeId: z.string().trim().min(1),
      text: nonBlankText(500)
    })
  ).max(4)
});

export const eventJournalEntryViewSchema = z.object({
  entry: z.object({
    id: z.string(),
    eventId: z.string(),
    title: z.string().min(1).max(MAX_JOURNAL_TITLE_LENGTH),
    content: z.string().min(1).max(MAX_EVENT_JOURNAL_CONTENT_LENGTH),
    status: z.enum(["draft", "saved", "modified"]),
    contentRevision: z.number().int().positive(),
    savedRevision: z.number().int().positive().nullable(),
    updatedAt: z.string(),
    savedAt: z.string().nullable()
  })
});

export const updateEventJournalEntryRequestSchema = z.object({
  expectedContentRevision: z.number().int().positive(),
  title: nonBlankText(MAX_JOURNAL_TITLE_LENGTH),
  content: nonBlankText(MAX_EVENT_JOURNAL_CONTENT_LENGTH)
});

export const saveEventJournalEntryRequestSchema = z.object({
  expectedContentRevision: z.number().int().positive()
});

export const cancelEventJournalGenerationRequestSchema = z.object({}).strict();
