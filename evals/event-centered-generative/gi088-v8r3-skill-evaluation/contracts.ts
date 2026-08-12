import { z } from "zod";

export const GI088_V8R3_EVALUATION_DATASET_VERSION =
  "2026-08-11.gi088-v8r3-skill-evaluation-v2" as const;
export const GI088_V8R3_FORMAL_EVALUATION_VERSION =
  "2026-08-11.gi088-human-eval-v8r3-skill-ark-flash" as const;
export const GI088_V8R3_RUNNER_VERSION =
  "2026-08-11.gi088-v8r3-skill-runner-v7" as const;
export const GI088_V8R3_LEGACY_RUNNER_VERSION =
  "2026-08-11.gi088-v8r3-skill-runner-v6" as const;

export const GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MAX_RETRIES_PER_CHECKPOINT =
  3 as const;
export const GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_RECOVERY_CALLS_MAXIMUM =
  100 as const;
export const GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_CALLS_MAXIMUM = 196 as const;

export const GI088_V8R3_EXPECTED_CASE_COUNTS = {
  deterministicRegression: 24,
  developmentSingleTurn: 24,
  developmentTrajectory: 4,
  hiddenSingleTurn: 8,
  hiddenTrajectory: 4
} as const;

export const GI088_V8R3_HARD_GATES = {
  hiddenResultCount: 24,
  hiddenAcceptableMinimum: 22,
  hiddenMinorIssueMaximum: 2,
  hiddenQualityFailureMaximum: 0,
  hiddenSingleCaseBlockerMaximum: 0,
  firstValidRateMinimum: 0.85,
  automaticRecoveryMaximum: 2,
  manualRecoveryMaximum: 0,
  finalFailureMaximum: 0,
  finalProtectionMaximum: 0,
  duplicateMessageMaximum: 0,
  pendingTurnMaximum: 0,
  latencyP50MaximumMs: 20_000,
  latencyP90MaximumMs: 40_000,
  latencyMaximumMs: 60_000,
  judgePassFailAgreementMinimum: 0.9,
  judgeBlockerMissMaximum: 0,
  judgeFailureCategoryAgreementMinimum: 0.8,
  judgeRequiredConsecutiveRounds: 2,
  judgeGoldenSamplesPerRound: 20
} as const;

export const gi088V8r3QuestionValueClassificationSchema = z.enum([
  "advances_working_task",
  "reasks_answered_content",
  "working_task_drift",
  "unsupported_third_party_inference",
  "low_information_gain",
  "uncertain"
]);

export type Gi088V8r3QuestionValueClassification = z.infer<
  typeof gi088V8r3QuestionValueClassificationSchema
>;

const messageSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(8_000)
  })
  .strict();

const checkpointExpectationSchema = z
  .object({
    afterUserMessageId: z.string().trim().min(1).max(120),
    allowedActions: z
      .array(z.enum(["acknowledge", "ask", "synthesize", "pause"]))
      .min(1),
    expectedValueClassification:
      gi088V8r3QuestionValueClassificationSchema,
    requiredEvidenceMessageIds: z.array(z.string().trim().min(1)).min(1),
    forbiddenBehaviors: z
      .array(
        z.enum([
          "reask_answered_content",
          "drift_from_working_task",
          "unsupported_third_party_motive",
          "forced_pause_without_stop",
          "question_without_understanding_gain",
          "multiple_independent_answer_targets",
          "hidden_reasoning_visible"
        ])
      )
      .min(1)
  })
  .strict();

export const gi088V8r3EvaluationCaseSchema = z
  .object({
    id: z.string().regex(/^GI088-V8R3-(R|D|H)\d{2}$/u),
    datasetVersion: z.literal(GI088_V8R3_EVALUATION_DATASET_VERSION),
    partition: z.enum([
      "deterministic_regression",
      "development",
      "hidden_admission"
    ]),
    kind: z.enum(["single_turn", "trajectory"]),
    source: z.enum([
      "frozen_product_boundary",
      "observed_preview_feedback",
      "synthetic_development",
      "fresh_hidden"
    ]),
    title: z.string().trim().min(1).max(120),
    workingTask: z.string().trim().min(1).max(500),
    messages: z.array(messageSchema).min(2).max(40),
    checkpoints: z.array(checkpointExpectationSchema).min(1).max(8)
  })
  .strict()
  .superRefine((value, context) => {
    const messageIds = new Set(value.messages.map((message) => message.id));
    const userMessageIds = new Set(
      value.messages
        .filter((message) => message.role === "user")
        .map((message) => message.id)
    );
    for (const checkpoint of value.checkpoints) {
      if (!userMessageIds.has(checkpoint.afterUserMessageId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `checkpoint ${checkpoint.afterUserMessageId} must reference a user message`
        });
      }
      for (const evidenceId of checkpoint.requiredEvidenceMessageIds) {
        if (!messageIds.has(evidenceId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `evidence ${evidenceId} is missing from the conversation`
          });
        }
      }
    }
    const expectedCheckpointCount = value.kind === "trajectory" ? 2 : 1;
    if (value.checkpoints.length < expectedCheckpointCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${value.kind} requires at least ${expectedCheckpointCount} checkpoint(s)`
      });
    }
  });

export type Gi088V8r3EvaluationCase = z.infer<
  typeof gi088V8r3EvaluationCaseSchema
>;

export const gi088V8r3TrialResultSchema = z
  .object({
    caseId: z.string().regex(/^GI088-V8R3-(R|D|H)\d{2}$/u),
    attempt: z.union([z.literal(1), z.literal(2)]),
    outcome: z.enum(["pass", "fail", "uncertain"]),
    quality: z.enum(["direct_use", "minor_issue", "quality_failure"]),
    singleCaseBlocker: z.boolean(),
    primaryFailureCategory: z
      .enum([
        "none",
        "reask_answered_content",
        "working_task_drift",
        "unsupported_third_party_inference",
        "low_information_gain",
        "answer_burden",
        "contract_or_data"
      ])
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.outcome === "pass" &&
      (value.quality === "quality_failure" || value.singleCaseBlocker)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "passing outcomes cannot be quality failures or blockers"
      });
    }
    if (
      value.quality === "direct_use" &&
      (value.outcome !== "pass" || value.primaryFailureCategory !== "none")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "direct-use results require a clean passing outcome"
      });
    }
    if (
      value.quality === "minor_issue" &&
      (value.outcome !== "pass" || value.primaryFailureCategory === "none")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minor issues require a passing outcome and issue category"
      });
    }
    if (
      value.outcome !== "pass" &&
      (value.quality !== "quality_failure" ||
        value.primaryFailureCategory === "none")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "non-passing outcomes require a categorized quality failure"
      });
    }
    if (value.singleCaseBlocker && value.outcome !== "fail") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "single-case blockers require a failed outcome"
      });
    }
  });

export type Gi088V8r3TrialResult = z.infer<
  typeof gi088V8r3TrialResultSchema
>;

export const gi088V8r3HumanReviewerSchema = z
  .object({
    reviewerId: z.string().trim().min(1).max(160),
    source: z.enum(["product_owner", "trained_human_reviewer"]),
    reviewedAt: z.string().datetime({ offset: true })
  })
  .strict();

export const gi088V8r3HumanAdjudicationFileSchema = z
  .object({
    version: z.literal("2026-08-11.gi088-v8r3-human-adjudication-v2"),
    candidateOfflineRunFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    candidateEvidenceFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    datasetFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    items: z
      .array(
        z
          .object({
            reviewId: z.string().regex(/^[a-f0-9]{20}$/u),
            reviewItemFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
            reviewer: gi088V8r3HumanReviewerSchema,
            result: z
              .object({
                outcome: z.enum(["pass", "fail", "uncertain"]),
                quality: z.enum([
                  "direct_use",
                  "minor_issue",
                  "quality_failure"
                ]),
                singleCaseBlocker: z.boolean(),
                primaryFailureCategory: z.enum([
                  "none",
                  "reask_answered_content",
                  "working_task_drift",
                  "unsupported_third_party_inference",
                  "low_information_gain",
                  "answer_burden",
                  "contract_or_data"
                ])
              })
              .strict()
          })
          .strict()
      )
      .length(80)
  })
  .strict();

export type Gi088V8r3HumanAdjudicationFile = z.infer<
  typeof gi088V8r3HumanAdjudicationFileSchema
>;

export const gi088V8r3BadCaseCategorySchema = z.enum([
  "skill_core_principle",
  "micro_case_reask",
  "micro_case_working_task_drift",
  "micro_case_third_party_inference",
  "program_hard_boundary",
  "evaluation_only",
  "rubric_or_data_bug"
]);

export type Gi088V8r3BadCaseCategory = z.infer<
  typeof gi088V8r3BadCaseCategorySchema
>;

export type Gi088V8r3JudgeGoldenItem = {
  sampleId: string;
  humanPass: boolean;
  judgePass: boolean;
  humanBlocker: boolean;
  judgeBlocker: boolean;
  humanFailureCategory: string;
  judgeFailureCategory: string;
};

export type Gi088V8r3JudgeCalibrationRound = {
  roundId: string;
  items: Gi088V8r3JudgeGoldenItem[];
};
