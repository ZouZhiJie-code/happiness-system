import { z } from "zod";

import {
  interviewAnsweredTargetSchema,
  interviewControlIntentSchema,
  interviewDialogueActSchema,
  turnDecisionV1Schema
} from "@/features/interview/intent/intent-v1";

const questionTargetSchema = z.enum([
  "event_anchor",
  "prior_assumption",
  "reaction_evidence",
  "insight_evidence",
  "judgment_clue"
]);

const questionSubTargetSchema = z.enum([
  "kind_action",
  "seen_need",
  "gratitude_reason",
  "relationship_signal"
]);

const questionSpecSchema = z
  .object({
    target: questionTargetSchema,
    subTarget: questionSubTargetSchema.nullable().optional(),
    hypothesisKey: z.enum(["seen_need", "gratitude_reason", "relationship_signal"]).nullable().optional(),
    stageIntent: z.enum(["advance", "resume", "repair"]).default("advance"),
    surfaceLevel: z.enum(["default", "simplified", "concrete_anchor"]).default("default"),
    anchorText: z.string().nullable().optional(),
    repairCount: z.number().int().nonnegative().default(0)
  })
  .strict();

const expectedAssessmentSchema = z
  .object({
    primaryControl: interviewControlIntentSchema,
    controlSignalsInclude: z.array(interviewControlIntentSchema).default([]),
    dialogueActsInclude: z.array(interviewDialogueActSchema).default([]),
    contentPresence: z.enum(["none", "possible", "clear"]),
    evidenceIncludes: z.array(z.string().min(1)).default([]),
    explicitAbsence: z.boolean().default(false),
    answeredTarget: interviewAnsweredTargetSchema.nullable().optional(),
    referenceTarget: z.enum([
      "current_question",
      "previous_interpretation",
      "current_event",
      "session",
      "journal",
      "dimension",
      "quoted_event",
      "unclear"
    ]),
    frustration: z.enum(["none", "mild", "strong"]),
    reasonCodesInclude: z.array(z.string().min(1)).default([])
  })
  .strict();

const expectedDecisionSchema = turnDecisionV1Schema
  .pick({
    runExtraction: true,
    advanceTurn: true,
    advanceRound: true,
    stopFollowUp: true,
    nextAction: true,
    nextQuestionStyle: true
  })
  .partial()
  .strict();

const modelAssessmentOverridesSchema = z
  .object({
    answeredTarget: interviewAnsweredTargetSchema.nullable().optional()
  })
  .strict();

const recoveryExpectationSchema = z
  .object({
    reuseAssessment: z.literal(true),
    preserveRawText: z.literal(true),
    preserveDecision: z.literal(true)
  })
  .strict();

export const interviewIntentEvalCaseSchema = z
  .object({
    id: z.string().regex(/^INT-EVAL-\d{3}$/u),
    caseVersion: z.string().min(1),
    caseSet: z.enum(["development", "validation", "blind"]),
    evaluationLevel: z.enum(["intent_policy", "persistence_contract", "service_flow", "end_to_end"]),
    source: z.enum(["product_requirement", "historical_badcase", "manual_acceptance", "anonymized_trace", "synthetic_variant"]),
    severity: z.enum(["P0", "P1", "P2"]),
    category: z.enum([
      "explicit_control",
      "mixed_content_control",
      "contextual_short_answer",
      "quote_report_correction",
      "pressure_feedback",
      "recovery"
    ]),
    semanticFamily: z.string().min(1),
    dimension: z.enum(["common", "joy", "fulfillment", "reflection", "improvement", "gratitude"]),
    context: z
      .object({
        lastAssistantQuestion: z.string().min(1),
        questionSpec: questionSpecSchema
      })
      .strict(),
    userText: z.string().min(1),
    productExpectation: z
      .object({
        understanding: z.string().min(1),
        action: z.string().min(1),
        nextStep: z.string().min(1),
        riskBehaviors: z.array(z.string().min(1)).min(1)
      })
      .strict(),
    expectedAssessment: expectedAssessmentSchema,
    modelAssessmentOverrides: modelAssessmentOverridesSchema.optional(),
    expectedDecision: expectedDecisionSchema,
    recoveryExpectation: recoveryExpectationSchema.optional(),
    tags: z.array(z.string().min(1)).min(1)
  })
  .strict();

export const interviewIntentEvalDatasetSchema = z
  .object({
    datasetId: z.string().min(1),
    version: z.string().min(1),
    status: z.enum(["draft", "active", "archived"]),
    updatedAt: z.string().date(),
    factSource: z.literal("docs/interview-intent-evaluation-source-of-truth.md"),
    cases: z.array(interviewIntentEvalCaseSchema).min(1)
  })
  .strict()
  .superRefine((dataset, context) => {
    const seenIds = new Set<string>();
    for (const [index, item] of dataset.cases.entries()) {
      if (seenIds.has(item.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate case id: ${item.id}`,
          path: ["cases", index, "id"]
        });
      }
      seenIds.add(item.id);

      if (item.evaluationLevel === "persistence_contract" && !item.recoveryExpectation) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "persistence_contract requires recoveryExpectation",
          path: ["cases", index, "recoveryExpectation"]
        });
      }
    }
  });

export const interviewIntentEvalVariantSetSchema = z
  .object({
    variantSetId: z.string().min(1),
    version: z.string().min(1),
    updatedAt: z.string().date(),
    familyAssignments: z
      .object({
        development: z.array(z.string().regex(/^INT-EVAL-\d{3}$/u)).length(24),
        validation: z.array(z.string().regex(/^INT-EVAL-\d{3}$/u)).length(8),
        candidateArchive: z.array(z.string().regex(/^INT-EVAL-\d{3}$/u)).length(8)
      })
      .strict(),
    variants: z
      .array(
        z
          .object({
            id: z.string().regex(/^INT-EVAL-\d{3}$/u),
            baseCaseId: z.string().regex(/^INT-EVAL-\d{3}$/u),
            userText: z.string().min(1),
            understanding: z.string().min(1),
            evidenceIncludes: z.array(z.string().min(1)).default([]),
            tags: z.array(z.string().min(1)).default([])
          })
          .strict()
      )
      .length(80)
  })
  .strict()
  .superRefine((variantSet, context) => {
    const assignments = [
      ...variantSet.familyAssignments.development,
      ...variantSet.familyAssignments.validation,
      ...variantSet.familyAssignments.candidateArchive
    ];
    const uniqueAssignments = new Set(assignments);
    if (uniqueAssignments.size !== 40) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "family assignments must contain 40 unique base cases",
        path: ["familyAssignments"]
      });
    }

    const seenVariantIds = new Set<string>();
    const variantsPerBase = new Map<string, number>();
    for (const [index, variant] of variantSet.variants.entries()) {
      if (seenVariantIds.has(variant.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate variant id: ${variant.id}`,
          path: ["variants", index, "id"]
        });
      }
      seenVariantIds.add(variant.id);
      variantsPerBase.set(variant.baseCaseId, (variantsPerBase.get(variant.baseCaseId) ?? 0) + 1);
    }

    for (const baseCaseId of uniqueAssignments) {
      if (variantsPerBase.get(baseCaseId) !== 2) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${baseCaseId} must have exactly two variants`,
          path: ["variants"]
        });
      }
    }
  });

export const interviewIntentBlindDatasetSchema = interviewIntentEvalDatasetSchema.superRefine(
  (dataset, context) => {
    if (dataset.cases.length !== 24) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "blind dataset must contain exactly 24 cases",
        path: ["cases"]
      });
    }

    for (const [index, item] of dataset.cases.entries()) {
      if (item.caseSet !== "blind") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "sealed cases must use the blind caseSet",
          path: ["cases", index, "caseSet"]
        });
      }
    }
  }
);

export type InterviewIntentEvalCase = z.infer<typeof interviewIntentEvalCaseSchema>;
export type InterviewIntentEvalDataset = z.infer<typeof interviewIntentEvalDatasetSchema>;
export type InterviewIntentEvalVariantSet = z.infer<typeof interviewIntentEvalVariantSetSchema>;
