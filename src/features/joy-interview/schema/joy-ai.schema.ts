import { z } from "zod";

const nullableString = z.union([z.string(), z.null()]);

export const joyExtractResultSchema = z
  .object({
    event: nullableString,
    feeling: nullableString,
    whyItMattered: nullableString,
    happinessType: nullableString,
    selfPattern: nullableString
  })
  .strict();

export const joyQuestionSchema = z
  .object({
    question: z.string().min(1).max(160)
  })
  .strict();

export const joyDraftResultSchema = z
  .object({
    title: z.string().min(1).max(80),
    content: z.string().min(1).max(3000),
    event: nullableString,
    feeling: nullableString,
    whyItMattered: nullableString,
    happinessType: nullableString,
    selfPattern: nullableString,
    tags: z.array(z.string().min(1).max(24)).max(5)
    ,
    eventBlocks: z
      .array(
        z.object({
          eventId: z.string(),
          sequence: z.number().int().nonnegative(),
          explorationRound: z.number().int().positive(),
          event: nullableString,
          feeling: nullableString,
          whyItMattered: nullableString,
          happinessType: nullableString,
          selfPattern: nullableString
        })
      )
      .default([])
  })
  .strict();

export type JoyExtractResult = z.infer<typeof joyExtractResultSchema>;
export type JoyQuestionResult = z.infer<typeof joyQuestionSchema>;
export type JoyDraftResult = z.infer<typeof joyDraftResultSchema>;
