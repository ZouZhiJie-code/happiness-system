import { z } from "zod";

import { ENTRY_DATE_REGEX, parseEntryDateInput } from "@/features/interview/entry-date";

const entryDateStringSchema = z.string().regex(ENTRY_DATE_REGEX).refine((value) => {
  try {
    parseEntryDateInput(value);
    return true;
  } catch {
    return false;
  }
}, "Invalid entry date");

export const happinessScoreValueSchema = z.number().int().min(1).max(10);

export const happinessScoreRequestScoresSchema = z.object({
  meaning: happinessScoreValueSchema,
  health: happinessScoreValueSchema,
  virtue: happinessScoreValueSchema,
  autonomy: happinessScoreValueSchema,
  interest: happinessScoreValueSchema,
  skill: happinessScoreValueSchema,
  relationship: happinessScoreValueSchema,
  livingCondition: happinessScoreValueSchema
});

export const dailyHappinessScoreSaveRequestSchema = z.object({
  date: entryDateStringSchema,
  scores: happinessScoreRequestScoresSchema
});

export const dailyHappinessScoreInputSchema = z.object({
  date: entryDateStringSchema,
  meaningScore: happinessScoreValueSchema,
  healthScore: happinessScoreValueSchema,
  virtueScore: happinessScoreValueSchema,
  autonomyScore: happinessScoreValueSchema,
  interestScore: happinessScoreValueSchema,
  skillScore: happinessScoreValueSchema,
  relationshipScore: happinessScoreValueSchema,
  livingConditionScore: happinessScoreValueSchema
});

export const dailyHappinessScoreSchema = dailyHappinessScoreInputSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type DailyHappinessScoreInputPayload = z.infer<typeof dailyHappinessScoreInputSchema>;
export type DailyHappinessScorePayload = z.infer<typeof dailyHappinessScoreSchema>;
export type DailyHappinessScoreSaveRequestPayload = z.infer<typeof dailyHappinessScoreSaveRequestSchema>;
