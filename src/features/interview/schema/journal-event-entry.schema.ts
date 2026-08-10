import { z } from "zod";

export const generateJournalEventEntryRequestSchema = z
  .object({
    rootSessionId: z.string().trim().min(1),
    baseBranchSessionId: z.string().trim().min(1),
    baseMessageSequence: z.number().int().nonnegative(),
    clientOperationId: z.string().trim().min(1)
  })
  .strict();

export const updateJournalEventEntryRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(16),
    content: z.string().trim().min(1).max(5000),
    expectedContentRevision: z.number().int().nonnegative()
  })
  .strict();

export const saveJournalEventEntryRequestSchema = z
  .object({
    expectedContentRevision: z.number().int().nonnegative()
  })
  .strict();

export type GenerateJournalEventEntryRequest = z.infer<
  typeof generateJournalEventEntryRequestSchema
>;

export type UpdateJournalEventEntryRequest = z.infer<
  typeof updateJournalEventEntryRequestSchema
>;

export type SaveJournalEventEntryRequest = z.infer<
  typeof saveJournalEventEntryRequestSchema
>;
