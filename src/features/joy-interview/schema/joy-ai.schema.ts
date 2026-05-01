import { z } from "zod";

import { MAX_JOURNAL_TITLE_LENGTH } from "@/features/interview/journal-title";

const nullableString = z.union([z.string(), z.null()]);
const improvementTrackSchema = z.enum(["repeat_good", "avoid_bad"]);

export const joyExtractResultSchema = z
  .object({
    event: nullableString.optional(),
    feeling: nullableString.optional(),
    whyItMattered: nullableString.optional(),
    happinessType: nullableString.optional(),
    selfPattern: nullableString.optional(),
    joyMoment: nullableString.optional(),
    joySource: nullableString.optional(),
    stateShift: nullableString.optional(),
    meaningNeed: nullableString.optional(),
    manualClue: nullableString.optional(),
    delightSignature: nullableString.optional(),
    directionSignal: nullableString.optional(),
    valueImpact: nullableString.optional(),
    durability: nullableString.optional(),
    tags: z.array(z.string().min(1).max(24)).max(6).default([])
  })
  .strict();

export const fulfillmentExtractResultSchema = z
  .object({
    event: nullableString.optional(),
    feeling: nullableString.optional(),
    whyItMattered: nullableString.optional(),
    happinessType: nullableString.optional(),
    selfPattern: nullableString.optional(),
    tags: z.array(z.string().min(1).max(24)).max(6).default([])
  })
  .strict();

export const improvementExtractResultSchema = z
  .object({
    event: nullableString.optional(),
    situation: nullableString.optional(),
    feeling: nullableString.optional(),
    whyItMattered: nullableString.optional(),
    happinessType: nullableString.optional(),
    improvementType: nullableString.optional(),
    selfPattern: nullableString.optional(),
    improvementTrack: improvementTrackSchema.nullable().optional(),
    stateAssessment: nullableString.optional(),
    frictionPoint: nullableString.optional(),
    repeatCondition: nullableString.optional(),
    controllableFactor: nullableString.optional(),
    nextAttempt: nullableString.optional(),
    successSignal: nullableString.optional(),
    tags: z.array(z.string().min(1).max(24)).max(6).default([])
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.improvementTrack === "repeat_good" && value.frictionPoint) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["frictionPoint"],
        message: "repeat_good should use repeatCondition instead of forcing frictionPoint."
      });
    }

    if (value.improvementTrack === "avoid_bad" && value.repeatCondition) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["repeatCondition"],
        message: "avoid_bad should use frictionPoint instead of forcing repeatCondition."
      });
    }

    if (value.frictionPoint && /我很差|我不行|我太差|我没救|我就是不行/u.test(value.frictionPoint)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["frictionPoint"],
        message: "frictionPoint must be a concrete friction in the situation, not global self-blame."
      });
    }

    if (value.nextAttempt && /^(我要)?(变好|改进|努力|做好|更好|提升自己|加油)[。.!！]*$/u.test(value.nextAttempt.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nextAttempt"],
        message: "nextAttempt must be a concrete action."
      });
    }
  });

export const joyQuestionSchema = z
  .object({
    question: z.string().min(1).max(160)
  })
  .strict();

export const joyDraftResultSchema = z
  .object({
    title: z.string().min(1).max(MAX_JOURNAL_TITLE_LENGTH),
    content: z.string().min(1).max(3000),
    event: nullableString,
    feeling: nullableString,
    whyItMattered: nullableString,
    happinessType: nullableString,
    selfPattern: nullableString,
    joyMoment: nullableString.optional(),
    joySource: nullableString.optional(),
    stateShift: nullableString.optional(),
    meaningNeed: nullableString.optional(),
    manualClue: nullableString.optional(),
    delightSignature: nullableString.optional(),
    directionSignal: nullableString.optional(),
    valueImpact: nullableString.optional(),
    durability: nullableString.optional(),
    improvementTrack: z.enum(["repeat_good", "avoid_bad"]).nullable().optional(),
    stateAssessment: nullableString.optional(),
    frictionPoint: nullableString.optional(),
    repeatCondition: nullableString.optional(),
    controllableFactor: nullableString.optional(),
    nextAttempt: nullableString.optional(),
    successSignal: nullableString.optional(),
    tags: z.array(z.string().min(1).max(24)).max(6),
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
          selfPattern: nullableString,
          joyMoment: nullableString.optional(),
          joySource: nullableString.optional(),
          stateShift: nullableString.optional(),
          meaningNeed: nullableString.optional(),
          manualClue: nullableString.optional(),
          delightSignature: nullableString.optional(),
          directionSignal: nullableString.optional(),
          valueImpact: nullableString.optional(),
          durability: nullableString.optional(),
          improvementTrack: z.enum(["repeat_good", "avoid_bad"]).nullable().optional(),
          stateAssessment: nullableString.optional(),
          frictionPoint: nullableString.optional(),
          repeatCondition: nullableString.optional(),
          controllableFactor: nullableString.optional(),
          nextAttempt: nullableString.optional(),
          successSignal: nullableString.optional(),
          tags: z.array(z.string().min(1).max(24)).max(6).optional()
        })
      )
      .default([])
  })
  .strict();

export type JoyExtractResult = z.infer<typeof joyExtractResultSchema>;
export type FulfillmentExtractResult = z.infer<typeof fulfillmentExtractResultSchema>;
export type ImprovementExtractResult = z.infer<typeof improvementExtractResultSchema>;
export type JoyQuestionResult = z.infer<typeof joyQuestionSchema>;
export type JoyDraftResult = z.infer<typeof joyDraftResultSchema>;
