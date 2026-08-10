import { z } from "zod";

import { JOURNAL_EVENT_ANGLES } from "@/types/journal-event-angle-outcome";
import { inspectEventCenteredFocusOptions } from "@/features/interview/event-centered/event-focus-options";
import {
  EVENT_CENTERED_COGNITIVE_ACTIONS,
  EVENT_CENTERED_RUNTIME_COGNITIVE_ACTIONS,
  type EventCenteredCognitiveAction
} from "@/features/interview/event-centered/generative-strategy";
import {
  GENERATIVE_INSIGHT_KINDS,
  type GenerativeInsightKind
} from "@/features/interview/event-centered/generative-quality-calibration";
import type { EventCenteredAssistantPayload } from "@/types/event-centered-dialogue";
import type { EventCenteredDialoguePhase } from "@/types/event-centered-dialogue";
import type { JournalEventAngle } from "@/types/journal-event-angle-outcome";

const nullableTrimmedText = z.string().trim().min(1).nullable();

export const eventCenteredUnderstandingDecisionSchema = z.object({
  eventBoundary: z.enum([
    "current_event",
    "background",
    "another_event",
    "multiple_events",
    "unclear"
  ]),
  coreEventIdentifiable: z.boolean(),
  answerSignal: z.enum([
    "answered",
    "partly_answered",
    "unknown",
    "declined",
    "correction",
    "unrelated"
  ]),
  facts: z.array(z.object({
    statement: z.string().trim().min(1),
    scope: z.enum(["current_event", "background"]),
    stance: z.enum(["affirmed", "denied", "unknown"]),
    kind: z.enum([
      "event_detail",
      "inner_experience",
      "stated_interpretation",
      "stated_preference",
      "boundary_answer"
    ]),
    quote: z.string().trim().min(1)
  }).strict()).max(6),
  angleEvidence: z.array(z.object({
    angle: z.enum(JOURNAL_EVENT_ANGLES),
    evidence: z.string().trim().min(1),
    valueAddedInsightPossible: z.boolean()
  }).strict()).max(4),
  outcomeCandidate: z.object({
    angle: z.enum(JOURNAL_EVENT_ANGLES),
    kind: z.enum(["insight", "honest_limit"]),
    statement: z.string().trim().min(1),
    supportFactStatements: z.array(z.string().trim().min(1)).min(1)
  }).strict().nullable(),
  unsupportedHypothesis: z.object({
    statement: z.string().trim().min(1),
    scope: z.enum(["current_event", "background"]),
    stance: z.enum(["affirmed", "denied", "unknown"]),
    kind: z.enum([
      "event_detail",
      "inner_experience",
      "stated_interpretation",
      "stated_preference",
      "boundary_answer"
    ])
  }).strict().nullable(),
  adviceRequest: z.object({
    requested: z.literal(true),
    condition: nullableTrimmedText,
    options: z.array(z.object({
      text: z.string().trim().min(1),
      tradeoff: z.string().trim().min(1)
    }).strict()).max(3)
  }).strict().nullable(),
  eventOptions: z.array(z.object({
    label: z.string().trim().min(1).max(48),
    sourceText: z.string().trim().min(1).max(120)
  }).strict()).max(2).optional(),
  correctionTargetHint: nullableTrimmedText,
  boundaryReason: nullableTrimmedText
}).strict();

export const eventCenteredNaturalResponseSchema = z.object({
  naturalUnderstanding: z.string().trim().min(1),
  naturalResponse: z.string().trim().min(1),
  hypothesisStatement: nullableTrimmedText,
  outcomeStatement: nullableTrimmedText
}).strict();

export type EventCenteredUnderstandingDecision = z.infer<
  typeof eventCenteredUnderstandingDecisionSchema
>;
export type EventCenteredNaturalResponse = z.infer<
  typeof eventCenteredNaturalResponseSchema
>;

const generativeFactDeltaSchema = z.object({
  statement: z.string().trim().min(1),
  scope: z.enum(["current_event", "background"]),
  stance: z.enum(["affirmed", "denied", "unknown"]),
  kind: z.enum([
    "event_detail",
    "inner_experience",
    "stated_interpretation",
    "stated_preference",
    "boundary_answer"
  ]),
  quote: z.string().trim().min(1)
}).strict();

const generativeOutcomeCandidateSchema = z.object({
  angle: z.enum(JOURNAL_EVENT_ANGLES),
  statement: z.string().trim().min(8),
  supportEvidenceRefs: z.array(z.string().trim().min(1)).min(1).max(6)
}).strict();

export const EVENT_CENTERED_INSIGHT_KINDS = GENERATIVE_INSIGHT_KINDS;
export type EventCenteredInsightKind = GenerativeInsightKind;

const generativeTentativeInterpretationSchema = z.object({
  statement: z.string().trim().min(1),
  supportEvidenceRefs: z.array(z.string().trim().min(1)).min(2).max(6)
}).strict();

const generativeMicrogoalDeltaSchema = z.object({
  operation: z.enum(["start", "continue", "complete", "close"]),
  statement: nullableTrimmedText,
  supportEvidenceRefs: z.array(z.string().trim().min(1)).max(6)
}).strict();

export const eventCenteredRealizationContractSchema = z.object({
  responseCore: z.string().trim().min(4).max(64),
  summaryAnchors: z.array(z.string().trim().max(280)).max(3)
}).strict();

export const eventCenteredGenerativeUnderstandingSchema = z.object({
  eventBoundary: z.enum([
    "current_event",
    "background",
    "another_event",
    "multiple_events",
    "unclear"
  ]),
  coreEventIdentifiable: z.boolean(),
  answerStatus: z.enum([
    "answered",
    "partly_answered",
    "unknown",
    "declined",
    "correction",
    "unrelated"
  ]),
  factDeltas: z.array(generativeFactDeltaSchema).max(6),
  correctionOrBoundary: z.object({
    kind: z.enum(["correction", "boundary"]),
    reason: z.string().trim().min(1)
  }).strict().nullable(),
  tentativeInterpretation: generativeTentativeInterpretationSchema.nullable(),
  eventOptions: z.array(z.object({
    label: z.string().trim().min(1).max(48),
    sourceText: z.string().trim().min(1).max(120)
  }).strict()).max(2)
}).strict();

const eventCenteredGenerativeOutcomeAssessmentSchema = z.object({
  state: z.enum(["needs_more", "ready", "limited"]),
  origin: z.enum(["user_articulated", "ai_synthesized"]).nullable(),
  basis: z.string().trim().min(8).max(240),
  supportEvidenceRefs: z.array(z.string().trim().min(1)).max(8),
  missingUnderstanding: nullableTrimmedText
}).strict();

export const EVENT_CENTERED_DEEP_PROGRESS_ASSESSMENTS = [
  "user_new_understanding",
  "ai_new_relation",
  "correction_update",
  "no_increment",
  "not_applicable"
] as const;

export type EventCenteredDeepProgressAssessment =
  (typeof EVENT_CENTERED_DEEP_PROGRESS_ASSESSMENTS)[number];

export const eventCenteredSemanticPlanSchema = z.object({
  action: z.enum(["ask", "complete", "pause", "honest_limit"]),
  activeAngle: z.enum(JOURNAL_EVENT_ANGLES).nullable(),
  outcomeAssessment: eventCenteredGenerativeOutcomeAssessmentSchema.optional(),
  progressAssessment: z.enum(EVENT_CENTERED_DEEP_PROGRESS_ASSESSMENTS)
    .default("not_applicable"),
  evidenceRefs: z.array(z.string().trim().min(1)).max(8),
  insightKind: z.enum(EVENT_CENTERED_INSIGHT_KINDS).nullable(),
  selectedTargetId: nullableTrimmedText,
  expectedUnderstandingDelta: z.string().trim().min(8).max(280).nullable(),
  tentativeInterpretation: generativeTentativeInterpretationSchema.nullable(),
  stopReason: nullableTrimmedText,
  cognitiveAction: z.enum(EVENT_CENTERED_COGNITIVE_ACTIONS).nullable(),
  microgoalDelta: generativeMicrogoalDeltaSchema.nullable(),
  realizationContract: eventCenteredRealizationContractSchema
}).strict();

export const eventCenteredVisibleTurnSchema = z.object({
  thinkingSummary: z.string().trim().min(1).max(160).nullable(),
  responseKind: z.enum(["question", "completion", "pause", "honest_limit"]),
  question: z.string().trim().min(1).max(120).nullable(),
  insight: z.string().trim().min(8).max(280).nullable(),
  honestLimit: z.string().trim().min(1).max(240).nullable()
}).strict();

export const eventCenteredGenerativePlanSchema = z.preprocess(normalizeGenerativeArrays, z.object({
  understanding: eventCenteredGenerativeUnderstandingSchema,
  semanticPlan: eventCenteredSemanticPlanSchema
}).strict());

/**
 * Provider 输出里的 responseKind 只是冻结 action 的重复投影。这里兼容
 * 模型常见的 action 同名值；服务层会立即按 semanticPlan.action 派生
 * canonical 值，最终回合和 Trace 仍只保留正式枚举。
 */
export const eventCenteredGenerativeVisibleSchema = z.object({
  thinkingSummary: z.string().trim().min(1).max(160).nullable(),
  responseKind: z.enum([
    "question",
    "completion",
    "pause",
    "honest_limit",
    "ask",
    "complete",
    "insight"
  ]),
  question: z.string().trim().min(1).max(120).nullable(),
  insight: z.string().trim().min(8).max(280).nullable(),
  honestLimit: z.string().trim().min(1).max(240).nullable()
}).strict();

export const eventCenteredGenerativeThinkingSummarySchema = z.object({
  thinkingSummary: z.string().trim().min(1).max(160)
});

/**
 * 一次调用 Provider 只负责真正需要判断和呈现的字段。微目标变化与表达
 * 兼容契约由服务层根据动作、证据和最终可见回应补齐；完整协议继续用于
 * 状态、Trace、历史数据与下游编排。
 */
export const eventCenteredProviderSemanticPlanSchema = eventCenteredSemanticPlanSchema
  .omit({
    cognitiveAction: true,
    microgoalDelta: true,
    realizationContract: true
  })
  .extend({
    cognitiveAction: z.enum(EVENT_CENTERED_RUNTIME_COGNITIVE_ACTIONS).nullable()
  })
  .strip();

export const eventCenteredProviderGenerativeTurnSchema = z.preprocess(
  normalizeGenerativeArrays,
  z.object({
    understanding: eventCenteredGenerativeUnderstandingSchema,
    semanticPlan: eventCenteredProviderSemanticPlanSchema,
    visibleTurn: eventCenteredGenerativeVisibleSchema
  }).strip()
);

export type EventCenteredProviderGenerativeTurn = z.infer<
  typeof eventCenteredProviderGenerativeTurnSchema
>;

const eventCenteredMeaningCardItemSchema = z.object({
  statement: z.string().trim().min(4).max(280),
  evidenceRefs: z.array(z.string().trim().min(1)).min(1).max(6)
}).strict();

/**
 * 两段式内部交接的最小语义单元。main 只保存本轮新增的一个
 * 主意思；necessaryScope 只保存会限制、修正或补全主意思的并存内容。
 */
export const eventCenteredMeaningCardSchema = z.object({
  main: eventCenteredMeaningCardItemSchema.nullable(),
  necessaryScope: z.array(eventCenteredMeaningCardItemSchema).max(2)
}).strict();

export type EventCenteredMeaningCard = z.infer<typeof eventCenteredMeaningCardSchema>;

export const eventCenteredTwoStageDecisionSchema = z.object({
  state: z.enum(["needs_more", "ready", "limited"]),
  origin: z.enum(["user_articulated", "ai_synthesized"]).nullable(),
  basis: z.string().trim().min(8).max(240),
  missingUnderstanding: nullableTrimmedText,
  selectedTargetId: nullableTrimmedText,
  cognitiveAction: z.enum(EVENT_CENTERED_RUNTIME_COGNITIVE_ACTIONS).nullable(),
  insightKind: z.enum(EVENT_CENTERED_INSIGHT_KINDS).nullable()
}).strict();

const eventCenteredTwoStageUnderstandingSchema =
  eventCenteredGenerativeUnderstandingSchema
    .omit({ tentativeInterpretation: true })
    .strict();

/**
 * 两段式候选的第一段只输出理解更新、问停判断和理解小卡。
 * action、角度、完整证据集、可见回复核心和微目标变化都由系统派生。
 */
export const eventCenteredTwoStageGenerativePlanSchema = z.object({
  understanding: eventCenteredTwoStageUnderstandingSchema,
  decision: eventCenteredTwoStageDecisionSchema,
  meaningCard: eventCenteredMeaningCardSchema
}).strict().superRefine((value, context) => {
  const { decision, meaningCard } = value;
  const mainEvidenceCount = new Set(meaningCard.main?.evidenceRefs ?? []).size;
  const allEvidenceCount = new Set([
    ...(meaningCard.main?.evidenceRefs ?? []),
    ...meaningCard.necessaryScope.flatMap((item) => item.evidenceRefs)
  ]).size;

  if (decision.state === "ready") {
    if (decision.origin === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["decision", "origin"],
        message: "ready_requires_outcome_origin"
      });
    }
    if (!meaningCard.main) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meaningCard", "main"],
        message: "ready_requires_meaning_card_main"
      });
    }
    if (
      decision.missingUnderstanding ||
      decision.selectedTargetId ||
      decision.cognitiveAction
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["decision"],
        message: "ready_must_not_keep_question_fields"
      });
    }
    if (decision.insightKind === null || decision.insightKind === "scope_only") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["decision", "insightKind"],
        message: "ready_requires_insight_kind"
      });
    }
    if (decision.origin === "user_articulated" && mainEvidenceCount < 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meaningCard", "main", "evidenceRefs"],
        message: "user_articulated_requires_evidence"
      });
    }
    if (decision.origin === "ai_synthesized" && mainEvidenceCount < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meaningCard", "main", "evidenceRefs"],
        message: "ai_synthesized_requires_two_distinct_evidence_refs"
      });
    }
  }

  if (decision.state === "needs_more") {
    if (decision.origin !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["decision", "origin"],
        message: "needs_more_requires_null_origin"
      });
    }
    if (
      !decision.missingUnderstanding ||
      !decision.selectedTargetId ||
      !decision.cognitiveAction
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["decision"],
        message: "needs_more_requires_question_fields"
      });
    }
    if (decision.insightKind !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["decision", "insightKind"],
        message: "needs_more_requires_null_insight_kind"
      });
    }
    if (!meaningCard.main) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meaningCard", "main"],
        message: "needs_more_requires_meaning_card_main"
      });
    } else if (allEvidenceCount < 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meaningCard"],
        message: "needs_more_requires_current_evidence"
      });
    }
  }

  if (decision.state === "limited") {
    if (
      decision.origin !== null ||
      decision.missingUnderstanding ||
      decision.selectedTargetId ||
      decision.cognitiveAction
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["decision"],
        message: "limited_requires_closed_decision"
      });
    }
    if (decision.insightKind !== "scope_only") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["decision", "insightKind"],
        message: "limited_requires_scope_only"
      });
    }
  }

  if (!meaningCard.main && meaningCard.necessaryScope.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["meaningCard", "necessaryScope"],
      message: "necessary_scope_requires_meaning_card_main"
    });
  }
});

export type EventCenteredTwoStageProviderPlan = z.infer<
  typeof eventCenteredTwoStageGenerativePlanSchema
>;

const eventCenteredUnderstandingCardSchema = z.object({
  statement: z.string().trim().min(4).max(280),
  evidenceRefs: z.array(z.string().trim().min(1)).min(1).max(8)
}).strict();

const eventCenteredQuestionIntentSchema = z.object({
  goal: z.string().trim().min(4).max(280),
  answerEntry: z.string().trim().min(4).max(280),
  evidenceRefs: z.array(z.string().trim().min(1)).min(1).max(8)
}).strict();

/**
 * 两段式 v3 的 Provider 契约。成果来源、认识分类、目标编号和问法动作
 * 均由系统兼容层维护，模型只提交当前理解、提问意图或收束原因。
 */
export const eventCenteredTwoStageV3GenerativePlanSchema = z.object({
  understanding: eventCenteredTwoStageUnderstandingSchema,
  decision: z.object({
    state: z.enum(["needs_more", "ready", "limited"])
  }).strict(),
  understandingCard: eventCenteredUnderstandingCardSchema.nullable(),
  questionIntent: eventCenteredQuestionIntentSchema.nullable(),
  limitReason: nullableTrimmedText
}).strict().superRefine((value, context) => {
  if (value.decision.state === "ready") {
    if (!value.understandingCard) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["understandingCard"],
        message: "ready_requires_understanding_card"
      });
    }
    if (value.questionIntent || value.limitReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["decision"],
        message: "ready_requires_closed_output"
      });
    }
  }

  if (value.decision.state === "needs_more") {
    if (!value.understandingCard) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["understandingCard"],
        message: "needs_more_requires_understanding_card"
      });
    }
    if (!value.questionIntent) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["questionIntent"],
        message: "needs_more_requires_question_intent"
      });
    }
    if (value.limitReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["limitReason"],
        message: "needs_more_must_not_keep_limit_reason"
      });
    }
  }

  if (value.decision.state === "limited") {
    if (value.questionIntent) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["questionIntent"],
        message: "limited_must_not_keep_question_intent"
      });
    }
    if (!value.limitReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["limitReason"],
        message: "limited_requires_limit_reason"
      });
    }
  }
});

export type EventCenteredUnderstandingCard = z.infer<
  typeof eventCenteredUnderstandingCardSchema
>;
export type EventCenteredQuestionIntent = z.infer<
  typeof eventCenteredQuestionIntentSchema
>;
export type EventCenteredTwoStageV3ProviderPlan = z.infer<
  typeof eventCenteredTwoStageV3GenerativePlanSchema
>;

const eventCenteredSemanticEvidenceRefsSchema = z.array(
  z.string().trim().min(1)
).min(1).max(6).superRefine((value, context) => {
  if (new Set(value).size !== value.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "semantic_evidence_refs_must_be_unique"
    });
  }
});

export const eventCenteredSemanticUnitSchema = z.object({
  id: z.enum(["u1", "u2", "u3"]),
  role: z.enum([
    "event",
    "change",
    "result",
    "experience",
    "judgment",
    "reason",
    "meaning",
    "scope",
    "preference",
    "expectation"
  ]),
  evidenceRefs: eventCenteredSemanticEvidenceRefsSchema
}).strict();

export const eventCenteredSemanticRelationSchema = z.object({
  type: z.enum([
    "sequence",
    "contrast",
    "condition",
    "change_effect",
    "coexistence",
    "user_stated_reason"
  ]),
  fromUnitId: z.enum(["u1", "u2", "u3"]),
  toUnitId: z.enum(["u1", "u2", "u3"])
}).strict();

/**
 * v4 第一段只保存证据引用与关系，不保存任何待展示给用户的句子。
 * 一个单元只表达一种语义角色；关系端点必须指向本骨架里的不同单元。
 */
export const eventCenteredSemanticFrameSchema = z.object({
  units: z.array(eventCenteredSemanticUnitSchema).min(1).max(3),
  relation: eventCenteredSemanticRelationSchema.nullable()
}).strict().superRefine((value, context) => {
  const unitById = new Map(value.units.map((unit) => [unit.id, unit]));
  if (unitById.size !== value.units.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["units"],
      message: "semantic_unit_ids_must_be_unique"
    });
  }

  if (value.units.length === 1 && value.relation) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["relation"],
      message: "single_unit_requires_null_relation"
    });
  }
  if (value.units.length >= 2 && !value.relation) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["relation"],
      message: "multiple_units_require_relation"
    });
  }
  if (!value.relation) return;

  const fromUnit = unitById.get(value.relation.fromUnitId);
  const toUnit = unitById.get(value.relation.toUnitId);
  if (!fromUnit || !toUnit) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["relation"],
      message: "relation_endpoints_must_exist"
    });
    return;
  }
  if (fromUnit.id === toUnit.id) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["relation"],
      message: "relation_endpoints_must_differ"
    });
  }
    if (
      value.relation.type === "change_effect" &&
      (fromUnit.role !== "change" || toUnit.role !== "result")
    ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["relation"],
      message: "change_effect_requires_change_to_result"
    });
  }
  if (value.relation.type === "change_effect") {
    const relationEvidenceRefs = [
      ...fromUnit.evidenceRefs,
      ...toUnit.evidenceRefs
    ];
    if (new Set(relationEvidenceRefs).size < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["relation"],
        message: "change_effect_requires_two_sourced_units"
      });
    }
  }
});

const eventCenteredSemanticAnswerSourceSchema = z.object({
  kind: z.enum([
    "sensory_detail",
    "observable_action",
    "exact_words",
    "mental_image",
    "change_moment",
    "direct_comparison"
  ]),
  evidenceRefs: z.array(z.string().trim().min(1)).min(1).max(2)
    .superRefine((value, context) => {
      if (new Set(value).size !== value.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "answer_source_evidence_refs_must_be_unique"
        });
      }
    }),
  anchorQuote: z.string().trim().min(1).max(280)
}).strict();

export const eventCenteredSemanticQuestionIntentSchema = z.object({
  gap: z.string().trim().min(4).max(120).superRefine((value, context) => {
    if (/[?？]/u.test(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "question_gap_must_not_be_a_question"
      });
    }
    const containsBareSecondPerson = /你(?:们)?(?!的)/u.test(value);
    const containsQuestionLikeSecondPersonPhrase =
      /你(?:们)?的[^，。！？?]{0,80}(?:是什么|有哪些|在哪|哪里|怎么|如何|为何|为什么|哪一|哪个|多少)$/u.test(value);
    if (
      containsBareSecondPerson ||
      containsQuestionLikeSecondPersonPhrase ||
      /(?:是否|能否)/u.test(value)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "question_gap_must_not_narrate_second_person_action"
      });
    }
    if (
      /^(?:请|回想|想想|想一想|说说|说出|描述|告诉|看看|回答|补充)/u.test(value) ||
      /用户(?:回想|说说|说出|描述|告诉|回答|补充)/u.test(value)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "question_gap_must_remain_internal_phrase"
      });
    }
  }),
  answerSource: eventCenteredSemanticAnswerSourceSchema
}).strict();

export const eventCenteredSemanticLimitReasonSchema = z.object({
  kind: z.enum([
    "insufficient_evidence",
    "no_safe_question",
    "user_boundary"
  ]),
  evidenceRefs: z.array(z.string().trim().min(1)).max(3)
    .superRefine((value, context) => {
      if (new Set(value).size !== value.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "limit_reason_evidence_refs_must_be_unique"
        });
      }
    })
}).strict();

/**
 * 两段式 v4 Provider 契约。顶层只有理解、状态和三个语义骨架字段；
 * 第一段不能生成理解句、问题句或收束文案。
 */
export const eventCenteredTwoStageV4GenerativePlanSchema = z.preprocess(
  normalizeGenerativeV4Plan,
  z.object({
  understanding: eventCenteredTwoStageUnderstandingSchema,
  decision: z.object({
    state: z.enum(["needs_more", "ready", "limited"]),
    origin: z.enum(["user_articulated", "ai_synthesized"]).nullable(),
    progressAssessment: z.enum(EVENT_CENTERED_DEEP_PROGRESS_ASSESSMENTS)
      .default("not_applicable")
  }).strict(),
  semanticFrame: eventCenteredSemanticFrameSchema.nullable(),
  questionIntent: eventCenteredSemanticQuestionIntentSchema.nullable(),
  limitReason: eventCenteredSemanticLimitReasonSchema.nullable()
  }).strict().superRefine((value, context) => {
  if (value.decision.state === "ready") {
    if (!value.decision.origin) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["decision", "origin"],
        message: "ready_requires_outcome_origin"
      });
    }
    if (!value.semanticFrame) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["semanticFrame"],
        message: "ready_requires_semantic_frame"
      });
    }
    if (value.questionIntent || value.limitReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["decision"],
        message: "ready_requires_closed_output"
      });
    }
    if (value.decision.origin === "ai_synthesized") {
      const relationEvidenceRefs = value.semanticFrame?.relation
        ? value.semanticFrame.units
          .filter((unit) =>
            unit.id === value.semanticFrame?.relation?.fromUnitId ||
            unit.id === value.semanticFrame?.relation?.toUnitId
          )
          .flatMap((unit) => unit.evidenceRefs)
        : [];
      if (
        !value.semanticFrame?.relation ||
        new Set(relationEvidenceRefs).size < 2
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["semanticFrame", "relation"],
          message: "ai_synthesized_requires_relation_with_two_sided_evidence"
        });
      }
    }
  }

  if (value.decision.state === "needs_more") {
    if (value.decision.origin !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["decision", "origin"],
        message: "needs_more_requires_null_origin"
      });
    }
    if (!value.semanticFrame) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["semanticFrame"],
        message: "needs_more_requires_semantic_frame"
      });
    }
    if (!value.questionIntent) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["questionIntent"],
        message: "needs_more_requires_question_intent"
      });
    }
    if (value.limitReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["limitReason"],
        message: "needs_more_must_not_keep_limit_reason"
      });
    }
  }

  if (value.decision.state === "limited") {
    if (value.decision.origin !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["decision", "origin"],
        message: "limited_requires_null_origin"
      });
    }
    if (value.questionIntent) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["questionIntent"],
        message: "limited_must_not_keep_question_intent"
      });
    }
    if (!value.limitReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["limitReason"],
        message: "limited_requires_limit_reason"
      });
    }
  }
  })
);

export type EventCenteredSemanticFrame = z.infer<
  typeof eventCenteredSemanticFrameSchema
>;
export type EventCenteredSemanticQuestionIntent = z.infer<
  typeof eventCenteredSemanticQuestionIntentSchema
>;
export type EventCenteredSemanticLimitReason = z.infer<
  typeof eventCenteredSemanticLimitReasonSchema
>;
export type EventCenteredTwoStageV4ProviderPlan = z.infer<
  typeof eventCenteredTwoStageV4GenerativePlanSchema
>;

const eventCenteredLockedVisibleProviderSchema = z.object({
  thinkingSummary: z.string().trim().min(1).max(160).nullable().default(null),
  response: z.string().trim().min(1).max(280).nullable().default(null),
  cannotExpressReason: z.string().trim().min(4).max(240).nullable().default(null)
}).strip().superRefine((value, context) => {
  const hasResponse = Boolean(value.response);
  const hasFailure = Boolean(value.cannotExpressReason);
  if (hasResponse === hasFailure) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "visible_requires_response_xor_cannot_express_reason"
    });
  }
  if (hasFailure && value.thinkingSummary) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["thinkingSummary"],
      message: "cannot_express_requires_null_thinking_summary"
    });
  }
});

/**
 * 第二段只交付一个统一回应。preprocess 仅用于读取已经封存的旧回放：旧
 * status、question、insight 和 honestLimit 都会先归一化，再进入同一新协议。
 */
export const eventCenteredLockedGenerativeVisibleSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const legacy = value as Record<string, unknown>;
  const cannotExpressReason = typeof legacy.cannotExpressReason === "string"
    ? legacy.cannotExpressReason
    : legacy.status === "cannot_express" && typeof legacy.reason === "string"
      ? legacy.reason
      : null;
  const response = typeof legacy.response === "string"
    ? legacy.response
    : [legacy.question, legacy.insight, legacy.honestLimit]
      .find((item): item is string => typeof item === "string" && item.trim().length > 0) ?? null;
  return {
    thinkingSummary: typeof legacy.thinkingSummary === "string"
      ? legacy.thinkingSummary
      : null,
    response,
    cannotExpressReason
  };
}, eventCenteredLockedVisibleProviderSchema);

export type EventCenteredLockedGenerativeVisibleResult = z.infer<
  typeof eventCenteredLockedGenerativeVisibleSchema
>;

function insightKindFromLegacyDecision(decision: Record<string, unknown>) {
  if (decision.turnAction === "honest_limit") return "scope_only";
  if (decision.cognitiveAction === "differentiate") return "distinction";
  if (decision.cognitiveAction === "surface_tension") return "tension";
  if (decision.cognitiveAction === "open_possibility" || decision.cognitiveAction === "test_understanding") {
    return "meaning";
  }
  return "connection";
}

function responseKindForAction(action: unknown) {
  if (action === "ask") return "question";
  if (action === "complete") return "completion";
  if (action === "pause") return "pause";
  return "honest_limit";
}

function truncateGenerativeFragment(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return Array.from(value.trim().replace(/[。！!？?；;，,：:]+$/u, ""))
    .slice(0, maxLength)
    .join("")
    .trim();
}

function legacyResponseCore(value: unknown) {
  return truncateGenerativeFragment(value, 32);
}

/**
 * 旧协议没有单独保存 summary anchor。迁移时只从“旧理解句”和旧事实
 * 共同出现的片段中选锚点，避免把整句理解误当成用户原话。该逻辑只
 * 服务历史兼容；当前 Provider 无需输出 realizationContract，系统会
 * 根据语义计划与最终可见回应补齐，完整协议继续保留该兼容字段。
 */
function legacySummaryAnchor(input: {
  summary: unknown;
  understanding: Record<string, unknown> | null;
}) {
  if (typeof input.summary !== "string") return "";
  const normalizedSummary = normalizeGenerativeRealizationText(input.summary);
  const facts = Array.isArray(input.understanding?.factDeltas)
    ? input.understanding.factDeltas
    : [];
  const sources = facts.flatMap((fact) => {
    if (!fact || typeof fact !== "object" || Array.isArray(fact)) return [];
    const record = fact as Record<string, unknown>;
    return [record.quote, record.statement].filter((value): value is string =>
      typeof value === "string" && Boolean(value.trim())
    );
  });

  for (const source of sources) {
    const normalizedSource = normalizeGenerativeRealizationText(source);
    const sourceCharacters = Array.from(normalizedSource).slice(0, 120);
    const maximumLength = Math.min(32, sourceCharacters.length);
    for (let length = maximumLength; length >= 2; length -= 1) {
      for (let start = 0; start + length <= sourceCharacters.length; start += 1) {
        const candidate = sourceCharacters.slice(start, start + length).join("");
        if (normalizedSummary.includes(candidate)) return candidate;
      }
    }
  }

  return "";
}

function canonicalGenerativeFactKind(value: unknown) {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/gu, "_");
  const aliases: Record<string, string> = {
    event: "event_detail",
    detail: "event_detail",
    action: "event_detail",
    behavior: "event_detail",
    interaction: "event_detail",
    observable_interaction: "event_detail",
    relationship_interaction: "event_detail",
    event_action: "event_detail",
    concrete_action: "event_detail",
    observable_action: "event_detail",
    observable_activity: "event_detail",
    event_fact: "event_detail",
    "事件细节": "event_detail",
    "可观察互动": "event_detail",
    emotion: "inner_experience",
    feeling: "inner_experience",
    reaction: "inner_experience",
    emotional_reaction: "inner_experience",
    response: "inner_experience",
    physical_sensation: "inner_experience",
    body_signal: "inner_experience",
    bodily_state: "inner_experience",
    "感受": "inner_experience",
    "身体状态": "inner_experience",
    offer: "event_detail",
    user_offer: "event_detail",
    availability: "event_detail",
    interpretation: "stated_interpretation",
    judgment: "stated_interpretation",
    thought: "stated_interpretation",
    belief: "stated_interpretation",
    meaning: "stated_interpretation",
    "用户判断": "stated_interpretation",
    "用户理解": "stated_interpretation",
    preference: "stated_preference",
    need: "stated_preference",
    expectation: "stated_preference",
    boundary: "stated_preference",
    value: "stated_preference",
    priority: "stated_preference",
    "用户期待": "stated_preference",
    "用户边界": "stated_preference",
    refusal: "boundary_answer",
    declined: "boundary_answer",
    limit: "boundary_answer",
    "拒绝回答": "boundary_answer"
  };
  return aliases[normalized] ?? value;
}

function normalizedGenerativeEnumToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split(/\s*(?:\||\/|、|或)\s*/u)[0]
    .replace(/[\s-]+/gu, "_");
}

function canonicalGenerativeFactScope(value: unknown) {
  if (typeof value !== "string") return value;
  const normalized = normalizedGenerativeEnumToken(value);
  const aliases: Record<string, string> = {
    current: "current_event",
    event: "current_event",
    inner: "current_event",
    experience: "current_event",
    inner_event: "current_event",
    single: "current_event",
    specific: "current_event",
    single_event: "current_event",
    current_event: "current_event",
    "当前事件": "current_event",
    background: "background",
    other: "background",
    other_event: "background",
    "背景": "background",
    "其他经历": "background"
  };
  return aliases[normalized] ?? value;
}

function canonicalGenerativeFactStance(value: unknown) {
  if (typeof value !== "string") return value;
  const normalized = normalizedGenerativeEnumToken(value);
  const aliases: Record<string, string> = {
    confirmed: "affirmed",
    positive: "affirmed",
    negative: "affirmed",
    neutral: "affirmed",
    true: "affirmed",
    affirmed: "affirmed",
    mixed: "affirmed",
    yes: "affirmed",
    "是": "affirmed",
    "肯定": "affirmed",
    corrected: "affirmed",
    rejected: "denied",
    false: "denied",
    denied: "denied",
    no: "denied",
    "否": "denied",
    "否定": "denied",
    uncertain: "unknown",
    unclear: "unknown",
    unknown: "unknown",
    "不确定": "unknown",
    "不清楚": "unknown"
  };
  return aliases[normalized] ?? value;
}

function canonicalGenerativeOutcomeState(value: unknown) {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/gu, "_");
  const aliases: Record<string, string> = {
    still_missing: "needs_more",
    missing: "needs_more",
    outcome_ready: "ready",
    user_articulated: "ready",
    ai_synthesized: "ready",
    insufficient: "limited"
  };
  return aliases[normalized] ?? value;
}

function normalizeGenerativeSemanticFrame(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const frame = value as Record<string, unknown>;
  const units = Array.isArray(frame.units)
    ? frame.units.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return item;
      const unit = item as Record<string, unknown>;
      const roleAliases: Record<string, string> = {
        stated_preference: "preference",
        relationship_preference: "preference",
        relationship_expectation: "expectation",
        need: "meaning"
      };
      const role = typeof unit.role === "string"
        ? roleAliases[unit.role.trim().toLowerCase()] ?? unit.role
        : unit.role;
      return { ...unit, role };
    })
    : frame.units;
  const relation = frame.relation && typeof frame.relation === "object" && !Array.isArray(frame.relation)
    ? { ...(frame.relation as Record<string, unknown>) }
    : frame.relation;
  if (Array.isArray(units) && relation && typeof relation === "object") {
    const relationRecord = relation as Record<string, unknown>;
    if (relationRecord.type === "change_effect") {
      const fromUnit = units.find((item) =>
        item && typeof item === "object" && !Array.isArray(item) &&
        (item as Record<string, unknown>).id === relationRecord.fromUnitId
      );
      const toUnit = units.find((item) =>
        item && typeof item === "object" && !Array.isArray(item) &&
        (item as Record<string, unknown>).id === relationRecord.toUnitId
      );
      if (
        fromUnit && typeof fromUnit === "object" && !Array.isArray(fromUnit) &&
        toUnit && typeof toUnit === "object" && !Array.isArray(toUnit) &&
        ["event", "change"].includes(String((fromUnit as Record<string, unknown>).role)) &&
        ["result", "experience"].includes(String((toUnit as Record<string, unknown>).role))
      ) {
        if ((fromUnit as Record<string, unknown>).role === "event") {
          (fromUnit as Record<string, unknown>).role = "change";
        }
        if ((toUnit as Record<string, unknown>).role === "experience") {
          (toUnit as Record<string, unknown>).role = "result";
        }
      }
    }
  }
  return { ...frame, units, relation };
}

function normalizeGenerativeV4Plan(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const source = structuredClone(value) as Record<string, unknown>;
  const understanding = source.understanding && typeof source.understanding === "object" &&
    !Array.isArray(source.understanding)
    ? source.understanding as Record<string, unknown>
    : null;
  if (understanding && Array.isArray(understanding.factDeltas)) {
    understanding.factDeltas = understanding.factDeltas.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return item;
      const fact = item as Record<string, unknown>;
      return {
        ...fact,
        scope: canonicalGenerativeFactScope(fact.scope),
        kind: canonicalGenerativeFactKind(fact.kind),
        stance: canonicalGenerativeFactStance(fact.stance)
      };
    });
  }
  if (source.semanticFrame !== undefined) {
    source.semanticFrame = normalizeGenerativeSemanticFrame(source.semanticFrame);
  }
  return source;
}

function normalizeGenerativeArrays(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  let source = structuredClone(value) as Record<string, unknown>;
  if (!source.understanding && !source.semanticPlan && !source.visibleTurn) {
    for (const wrapperKey of ["outputShape", "responseContract", "result", "data"] as const) {
      const wrapped = source[wrapperKey];
      if (
        wrapped &&
        typeof wrapped === "object" &&
        !Array.isArray(wrapped) &&
        ("understanding" in wrapped || "semanticPlan" in wrapped || "visibleTurn" in wrapped)
      ) {
        source = structuredClone(wrapped) as Record<string, unknown>;
        break;
      }
    }
  }
  const hadCanonicalOutput = Boolean(source.semanticPlan && source.visibleTurn);
  const understanding = source.understanding && typeof source.understanding === "object"
    ? source.understanding as Record<string, unknown>
    : null;
  let decision = source.decision && typeof source.decision === "object"
    ? source.decision as Record<string, unknown>
    : null;
  let reply = source.reply && typeof source.reply === "object"
    ? source.reply as Record<string, unknown>
    : null;
  let semanticPlan = source.semanticPlan && typeof source.semanticPlan === "object"
    ? source.semanticPlan as Record<string, unknown>
    : null;
  let visibleTurn = source.visibleTurn && typeof source.visibleTurn === "object"
    ? source.visibleTurn as Record<string, unknown>
    : null;
  if (source.semanticFrame !== undefined) {
    source.semanticFrame = normalizeGenerativeSemanticFrame(source.semanticFrame);
  }
  if (understanding) {
    if (!Array.isArray(understanding.factDeltas)) understanding.factDeltas = [];
    understanding.factDeltas = (understanding.factDeltas as unknown[]).map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return item;
      const fact = item as Record<string, unknown>;
      return {
        ...fact,
        scope: canonicalGenerativeFactScope(fact.scope),
        kind: canonicalGenerativeFactKind(fact.kind),
        stance: canonicalGenerativeFactStance(fact.stance)
      };
    });
    if (
      understanding.unsupportedHypothesis &&
      typeof understanding.unsupportedHypothesis === "object" &&
      !Array.isArray(understanding.unsupportedHypothesis)
    ) {
      const hypothesis = understanding.unsupportedHypothesis as Record<string, unknown>;
      hypothesis.scope = canonicalGenerativeFactScope(hypothesis.scope);
      hypothesis.stance = canonicalGenerativeFactStance(hypothesis.stance);
    }
    if (!Array.isArray(understanding.eventOptions)) understanding.eventOptions = [];
    understanding.eventOptions = (understanding.eventOptions as unknown[]).map((item) => {
      if (typeof item === "string") return { label: item, sourceText: item };
      if (!item || typeof item !== "object" || Array.isArray(item)) return item;
      const option = item as Record<string, unknown>;
      const label = option.label ?? option.description ?? option.title ?? option.quote;
      const sourceText = option.sourceText ?? option.quote ?? option.description ?? label;
      return { ...option, label, sourceText };
    });
    if (understanding.correctionOrBoundary === undefined) understanding.correctionOrBoundary = null;
    if (understanding.tentativeInterpretation === undefined) understanding.tentativeInterpretation = null;
  }
  if (semanticPlan) {
    const outcomeAssessment = semanticPlan.outcomeAssessment;
    if (
      outcomeAssessment &&
      typeof outcomeAssessment === "object" &&
      !Array.isArray(outcomeAssessment)
    ) {
      const assessment = outcomeAssessment as Record<string, unknown>;
      assessment.state = canonicalGenerativeOutcomeState(assessment.state);
    }
  }
  if (!semanticPlan && decision) {
    const outcomeCandidate = decision.outcomeCandidate && typeof decision.outcomeCandidate === "object"
      ? decision.outcomeCandidate as Record<string, unknown>
      : null;
    const action = decision.turnAction;
    const mainResponse = action === "ask"
      ? reply?.question ?? decision.selectedTarget ?? "继续理解当前线索"
      : action === "complete"
        ? outcomeCandidate?.statement ?? reply?.naturalUnderstanding ?? "保留当前形成的认识"
        : reply?.naturalUnderstanding ?? "保留当前能够确认的范围";
    const responseCore = legacyResponseCore(mainResponse);
    const summaryAnchor = legacySummaryAnchor({
      summary: reply?.naturalUnderstanding,
      understanding
    });
    semanticPlan = {
      action,
      activeAngle: outcomeCandidate?.angle ?? null,
      outcomeAssessment: undefined,
      evidenceRefs: Array.isArray(decision.evidenceRefs) ? decision.evidenceRefs : [],
      insightKind: insightKindFromLegacyDecision(decision),
      selectedTargetId: decision.selectedTarget ?? null,
      expectedUnderstandingDelta: decision.expectedValue ?? (
        decision.turnAction === "complete"
          ? outcomeCandidate?.statement ?? reply?.naturalUnderstanding ?? null
          : decision.turnAction === "pause"
            ? reply?.naturalUnderstanding ?? null
            : null
      ),
      tentativeInterpretation: understanding?.tentativeInterpretation ?? null,
      stopReason: decision.stopReason ?? null,
      cognitiveAction: decision.cognitiveAction ?? null,
      microgoalDelta: decision.microgoalDelta ?? null,
      realizationContract: {
        responseCore,
        summaryAnchors: summaryAnchor ? [summaryAnchor] : []
      }
    };
    source.semanticPlan = semanticPlan;
  }
  if (!visibleTurn && reply && decision) {
    const action = decision.turnAction;
    const outcomeCandidate = decision.outcomeCandidate && typeof decision.outcomeCandidate === "object"
      ? decision.outcomeCandidate as Record<string, unknown>
      : null;
    visibleTurn = {
      thinkingSummary: action === "ask" ? reply.naturalUnderstanding : null,
      responseKind: responseKindForAction(action),
      question: action === "ask" ? reply.question ?? null : null,
      insight: action === "complete"
        ? outcomeCandidate?.statement ?? reply.naturalUnderstanding ?? null
        : action === "pause"
          ? reply.naturalUnderstanding ?? null
          : null,
      honestLimit: action === "honest_limit" ? reply.naturalUnderstanding ?? null : null
    };
    source.visibleTurn = visibleTurn;
  }
  const realizationContract = semanticPlan?.realizationContract &&
    typeof semanticPlan.realizationContract === "object" &&
    !Array.isArray(semanticPlan.realizationContract)
    ? semanticPlan.realizationContract as Record<string, unknown>
    : null;
  if (realizationContract && Array.isArray(realizationContract.summaryAnchors)) {
    const normalizedAnchors = (realizationContract.summaryAnchors as unknown[])
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => Array.from(normalizeGenerativeRealizationText(item)).length >= 2)
      .slice(0, 3);
    realizationContract.summaryAnchors = normalizedAnchors;
  }
  const normalizedOutcomeAssessment = semanticPlan?.outcomeAssessment &&
    typeof semanticPlan.outcomeAssessment === "object" &&
    !Array.isArray(semanticPlan.outcomeAssessment)
    ? semanticPlan.outcomeAssessment as Record<string, unknown>
    : null;
  if (normalizedOutcomeAssessment && normalizedOutcomeAssessment.origin === undefined) {
    normalizedOutcomeAssessment.origin = normalizedOutcomeAssessment.state === "ready"
      ? semanticPlan?.tentativeInterpretation
        ? "ai_synthesized"
        : "user_articulated"
      : null;
  }
  if (semanticPlan && visibleTurn) {
    if (!Array.isArray(semanticPlan.evidenceRefs)) semanticPlan.evidenceRefs = [];
    for (const key of [
      "activeAngle",
      "selectedTargetId",
      "expectedUnderstandingDelta",
      "tentativeInterpretation",
      "stopReason",
      "cognitiveAction",
      "microgoalDelta"
    ]) {
      if (semanticPlan[key] === undefined) semanticPlan[key] = null;
    }
    for (const key of ["question", "insight", "honestLimit"]) {
      if (visibleTurn[key] === undefined) visibleTurn[key] = null;
    }
    if (visibleTurn.thinkingSummary === undefined) {
      visibleTurn.thinkingSummary = semanticPlan.action === "ask"
        ? reply?.naturalUnderstanding ?? null
        : null;
    }
    if (understanding) {
      understanding.tentativeInterpretation = semanticPlan.tentativeInterpretation ?? null;
    }
    const action = semanticPlan.action;
    visibleTurn.responseKind = responseKindForAction(action);
    if (action !== "ask") visibleTurn.thinkingSummary = null;
    const activeAngle = semanticPlan.activeAngle;
    const insight = typeof visibleTurn.insight === "string" ? visibleTurn.insight : null;
    decision = {
      turnAction: action,
      cognitiveAction: semanticPlan.cognitiveAction,
      selectedTarget: semanticPlan.selectedTargetId,
      evidenceRefs: semanticPlan.evidenceRefs,
      microgoalDelta: semanticPlan.microgoalDelta,
      expectedValue: semanticPlan.expectedUnderstandingDelta,
      stopReason: semanticPlan.stopReason,
      outcomeCandidate: (action === "complete" || action === "pause") && activeAngle && insight
          ? {
            angle: activeAngle,
            statement: insight,
            supportEvidenceRefs: Array.isArray(semanticPlan.evidenceRefs)
              ? semanticPlan.evidenceRefs.slice(0, 6)
              : []
          }
        : null
    };
    reply = {
      naturalUnderstanding: action === "ask" && typeof visibleTurn.thinkingSummary === "string"
        ? visibleTurn.thinkingSummary
        : "",
      question: action === "ask" ? visibleTurn.question ?? null : null
    };
    source.decision = decision;
    source.reply = reply;
  }
  if (decision) {
    if (!Array.isArray(decision.evidenceRefs)) decision.evidenceRefs = [];
    for (const key of [
      "cognitiveAction",
      "selectedTarget",
      "microgoalDelta",
      "expectedValue",
      "stopReason",
      "outcomeCandidate"
    ]) {
      if (decision[key] === undefined) decision[key] = null;
    }
    const microgoal = decision.microgoalDelta && typeof decision.microgoalDelta === "object"
      ? decision.microgoalDelta as Record<string, unknown>
      : null;
    if (microgoal && !Array.isArray(microgoal.supportEvidenceRefs)) {
      microgoal.supportEvidenceRefs = [];
    }
  }
  if (reply && reply.question === undefined) reply.question = null;
  if (
    reply &&
    typeof reply.naturalUnderstanding === "string" &&
    typeof reply.question === "string" &&
    reply.naturalUnderstanding.includes(reply.question)
  ) {
    const withoutQuestion = reply.naturalUnderstanding
      .replace(reply.question, "")
      .trim()
      .replace(/[，,：:；;]+$/u, "")
      .trim();
    if (withoutQuestion) reply.naturalUnderstanding = withoutQuestion;
  }
  if (
    reply &&
    typeof reply.naturalUnderstanding === "string" &&
    typeof reply.question === "string" &&
    /[？?]/u.test(reply.naturalUnderstanding)
  ) {
    let normalizedSummary = reply.naturalUnderstanding;
    if (semanticPlan?.action === "ask" && /我想|想继续|想确认|想看看|接下来/u.test(
      normalizedSummary
    )) {
      normalizedSummary = normalizedSummary
        .replace(/。(?=我想|接下来)/gu, "；")
        .replace(/[？?]+/gu, "。")
        .replace(/。{2,}/gu, "。")
        .trim();
      reply.naturalUnderstanding = normalizedSummary;
      if (visibleTurn) visibleTurn.thinkingSummary = normalizedSummary;
    }
    const withoutTrailingQuestion = normalizedSummary
      .replace(/[，,][^，,\n]{1,100}[？?]\s*$/u, "")
      .trim();
    if (withoutTrailingQuestion) reply.naturalUnderstanding = withoutTrailingQuestion;
  }
  if (
    reply &&
    !hadCanonicalOutput &&
    (typeof reply.naturalUnderstanding !== "string" || !reply.naturalUnderstanding.trim()) &&
    decision?.outcomeCandidate &&
    typeof decision.outcomeCandidate === "object" &&
    typeof (decision.outcomeCandidate as Record<string, unknown>).statement === "string"
  ) {
    reply.naturalUnderstanding = (decision.outcomeCandidate as Record<string, unknown>).statement;
  }
  if (reply && typeof reply.naturalUnderstanding === "string") {
    reply.naturalUnderstanding = reply.naturalUnderstanding.replace(/用户/gu, "你");
    if (visibleTurn && semanticPlan?.action === "ask") {
      visibleTurn.thinkingSummary = reply.naturalUnderstanding;
    }
  }
  if (
    decision?.outcomeCandidate &&
    typeof decision.outcomeCandidate === "object" &&
    typeof (decision.outcomeCandidate as Record<string, unknown>).statement === "string"
  ) {
    const outcome = decision.outcomeCandidate as Record<string, unknown>;
    outcome.statement = (outcome.statement as string).replace(/用户/gu, "你");
  }
  return source;
}

export const eventCenteredGenerativeTurnSchema = z.preprocess(normalizeGenerativeArrays, z.object({
  understanding: eventCenteredGenerativeUnderstandingSchema,
  semanticPlan: eventCenteredSemanticPlanSchema,
  visibleTurn: eventCenteredVisibleTurnSchema,
  decision: z.object({
    turnAction: z.enum(["ask", "complete", "pause", "honest_limit"]),
    cognitiveAction: z.enum(EVENT_CENTERED_COGNITIVE_ACTIONS).nullable(),
    selectedTarget: nullableTrimmedText,
    evidenceRefs: z.array(z.string().trim().min(1)).max(8),
    microgoalDelta: generativeMicrogoalDeltaSchema.nullable(),
    expectedValue: nullableTrimmedText,
    stopReason: nullableTrimmedText,
    outcomeCandidate: generativeOutcomeCandidateSchema.nullable()
  }).strict(),
  reply: z.object({
    naturalUnderstanding: z.string().max(160),
    question: z.string().trim().min(1).max(120).nullable()
  }).strict()
}).strict());

export type EventCenteredGenerativeTurn = z.infer<
  typeof eventCenteredGenerativeTurnSchema
>;

export type EventCenteredGenerativeValidationInput = {
  turn: EventCenteredGenerativeTurn;
  rawText: string;
  phase: EventCenteredDialoguePhase;
  angle: JournalEventAngle | null;
  existingFactIds: string[];
  existingFactStatements?: string[];
  recentUserTexts?: string[];
  currentQuestionTarget?: string | null;
  /** 系统内部用于拦截清晰的字面重复，不进入 Provider 协议或持久化结构。 */
  currentQuestionText?: string | null;
  /** 最近实际展示过的问题；仅做归一化后的精确重复检查。 */
  recentQuestionTexts?: string[];
  currentQuestionCognitiveAction?: EventCenteredCognitiveAction | null;
  askedTargets?: string[];
  answeredTargets: string[];
  deniedTargets: string[];
  guidedQuestionOpportunityCount?: number;
  microgoalQuestionCount: number;
  deepQuestionAnswerCount?: number;
  priorAngleOutcomeStatement?: string | null;
  /** 同一目标首次降到 concrete_anchor 时，可额外使用一次且不计入正式三问。 */
  allowQuestionLimitRepair?: boolean;
  boundaryDetected?: boolean;
  correctionDetected?: boolean;
  multipleEventsDetected?: boolean;
  latestEmphasis?: string | null;
  requireOutcomeAssessment?: boolean;
};

export type EventCenteredGenerativeValidationResult = {
  passed: boolean;
  issues: string[];
};

/**
 * 这些问题需要结合完整上下文判断用户体验，不能作为运行时技术故障。
 * 运行时仍记录它们，供 Codex 初评、产品裁决与离线质量分析使用。
 */
const EVENT_CENTERED_GENERATIVE_QUALITY_DIAGNOSTICS = new Set([
  "visible_turn_must_address_user_naturally",
  "visible_understanding_must_address_user_naturally",
  "visible_response_must_preserve_response_core",
  "visible_insight_must_preserve_tentative_interpretation",
  "question_forces_binary_cause",
  "thinking_summary_must_not_offer_unfounded_options",
  "question_uses_abstract_analysis_language",
  "insight_uses_label_instead_of_understanding",
  "insight_must_be_declarative",
  "relationship_question_is_too_abstract_to_answer",
  "ask_thinking_summary_must_keep_target_open",
  "thinking_summary_uses_abstract_analysis_language",
  "thinking_summary_describes_next_action",
  "thinking_summary_value_is_generic",
  "visible_turn_must_not_erase_coexisting_evidence",
  "thinking_summary_introduces_unconfirmed_motive",
  "reason_question_requires_concrete_anchor",
  "user_articulated_outcome_adds_generic_benefit",
  "user_articulated_outcome_strengthens_judgment"
]);

export function partitionEventCenteredGenerativeValidationIssues(
  issues: readonly string[]
) {
  const hardIssues: string[] = [];
  const qualityDiagnostics: string[] = [];
  for (const issue of [...new Set(issues)]) {
    if (EVENT_CENTERED_GENERATIVE_QUALITY_DIAGNOSTICS.has(issue)) {
      qualityDiagnostics.push(issue);
    } else {
      hardIssues.push(issue);
    }
  }
  return { hardIssues, qualityDiagnostics };
}

/**
 * 事实、来源、纠正和停止边界属于运行时安全契约。命中后直接交给
 * baseline 收束，避免把高风险内容交给第二次自由生成继续扩大。
 */
export function isEventCenteredGenerativeImmediateFallbackIssue(issue: string) {
  const normalized = issue.trim().toLowerCase();
  return [
    "fact_quote_not_in_current_turn",
    "correction",
    "boundary",
    "stop",
    "source",
    "untraceable",
    "evidence_ref",
    "unsupported",
    "unknown_evidence",
    "user_articulated_origin_adds_unstated_relation",
    "relationship_must_not_assert_other_motive"
  ].some((marker) => normalized.includes(marker));
}

export type EventCenteredGenerativeSemanticPlanValidationInput = {
  understanding: EventCenteredGenerativeTurn["understanding"];
  semanticPlan: EventCenteredGenerativeTurn["semanticPlan"];
  rawText?: string;
  limitReasonKind?: EventCenteredSemanticLimitReason["kind"] | null;
  phase: EventCenteredDialoguePhase;
  angle: JournalEventAngle | null;
  existingFactIds: string[];
  existingFactStatements?: string[];
  currentQuestionTarget?: string | null;
  currentQuestionCognitiveAction?: EventCenteredCognitiveAction | null;
  askedTargets?: string[];
  answeredTargets: string[];
  deniedTargets: string[];
  guidedQuestionOpportunityCount?: number;
  microgoalQuestionCount: number;
  deepQuestionAnswerCount?: number;
  priorAngleOutcomeStatement?: string | null;
  allowQuestionLimitRepair?: boolean;
  boundaryDetected?: boolean;
  /** 由用户显式纠正入口或高置信文本规则确定，不交给模型自行猜测。 */
  correctionDetected?: boolean;
  requireOutcomeAssessment?: boolean;
};

function generativeEvidenceRefs(input: {
  existingFactIds: string[];
  understanding: EventCenteredGenerativeTurn["understanding"];
}) {
  return new Set([
    ...input.existingFactIds,
    ...input.understanding.factDeltas.map((_, index) => `new:${index + 1}`)
  ]);
}

function addUnknownRefs(issues: string[], refs: string[], allowed: Set<string>, prefix: string) {
  for (const ref of refs) {
    if (!allowed.has(ref)) issues.push(`${prefix}:unknown_evidence:${ref}`);
  }
}

function hasDuplicateEvidenceRefs(refs: readonly string[]) {
  return new Set(refs).size !== refs.length;
}

function normalizeGenerativeRealizationText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function normalizedGenerativeQuestion(value: string | null | undefined) {
  return normalizeGenerativeRealizationText(value);
}

function generativeQuestionEditDistance(left: string, right: string) {
  const leftChars = Array.from(left);
  const rightChars = Array.from(right);
  const previous = Array.from({ length: rightChars.length + 1 }, (_, index) => index);
  const current = new Array<number>(rightChars.length + 1);

  for (let leftIndex = 1; leftIndex <= leftChars.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= rightChars.length; rightIndex += 1) {
      const substitutionCost = leftChars[leftIndex - 1] === rightChars[rightIndex - 1]
        ? 0
        : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex]! + 1,
        current[rightIndex - 1]! + 1,
        previous[rightIndex - 1]! + substitutionCost
      );
    }
    for (let index = 0; index <= rightChars.length; index += 1) {
      previous[index] = current[index]!;
    }
  }

  return previous[rightChars.length]!;
}

function isNearVerbatimGenerativeQuestion(
  left: string | null | undefined,
  right: string | null | undefined
) {
  const normalizedLeft = normalizedGenerativeQuestion(left);
  const normalizedRight = normalizedGenerativeQuestion(right);
  const longestLength = Math.max(normalizedLeft.length, normalizedRight.length);
  const shortestLength = Math.min(normalizedLeft.length, normalizedRight.length);
  if (shortestLength < 8 || normalizedLeft === normalizedRight) return false;
  const maximumDistance = Math.max(2, Math.floor(longestLength * 0.12));
  return generativeQuestionEditDistance(normalizedLeft, normalizedRight) <= maximumDistance;
}

function hasVisibleThinkingSummaryDirection(input: {
  thinkingSummary: string;
  directionSources: Array<string | null | undefined>;
}) {
  return input.directionSources.some((source) => {
    const sourceLength = Array.from(normalizeGenerativeRealizationText(source)).length;
    return sourceLength >= 4 && sharesNormalizedGenerativeFragment(
      input.thinkingSummary,
      source,
      4
    );
  });
}

function acknowledgesVisibleCorrection(thinkingSummary: string) {
  return /(?:刚才|之前|前面).{0,12}(?:理解|判断|说法).{0,8}(?:需要改|不准确|不对|撤回)|(?:按|根据)你.{0,10}(?:纠正|更正|更准确)|你.{0,8}(?:纠正|更正)(?:了)?|(?:这里|现在)(?:应|要)?改成|我.{0,8}(?:理解错|听错|弄错)/u.test(
    thinkingSummary
  );
}

function includesNormalizedGenerativeText(
  source: string | null | undefined,
  frozenText: string,
  minimumLength = 1
) {
  const normalizedSource = normalizeGenerativeRealizationText(source);
  const normalizedFrozen = normalizeGenerativeRealizationText(frozenText);
  return normalizedFrozen.length >= minimumLength && normalizedSource.includes(normalizedFrozen);
}

function repeatsAskTargetAfterOpenIntent(
  thinkingSummary: string,
  responseCore: string
) {
  const normalizedSummary = normalizeGenerativeRealizationText(thinkingSummary);
  const openIntents = [
    "我想继续确认",
    "我想确认",
    "接下来想看看",
    "想继续确认",
    "想确认"
  ].map((item) => normalizeGenerativeRealizationText(item));
  let targetStart = -1;
  for (const marker of openIntents) {
    const markerIndex = normalizedSummary.lastIndexOf(marker);
    if (markerIndex >= 0) {
      targetStart = Math.max(targetStart, markerIndex + marker.length);
    }
  }
  if (targetStart < 0) return false;
  const repeatedTarget = normalizedSummary.slice(targetStart).replace(/^你/u, "");
  return includesNormalizedGenerativeText(responseCore, repeatedTarget, 6);
}

const OPEN_ASK_SUMMARY_PATTERN = /(?:还|仍然?|尚)(?:没|未|不|待)|暂时(?:没|不|未)|需要(?:再|继续)?(?:说清|分清|补清|确认|了解)|关系到|取决于|会影响|要看|想知道|值得(?:继续)?看/u;
const CLOSED_ASK_SUMMARY_PATTERN = /(?:已经|这里|这)(?:可以|能)?(?:看出|看见|说明|表明|确认)|(?:原因|关键|作用|区别|关系|标准|条件)(?:就是|是|在于)|(?:不同步|分开了|形成了|对应着)|(?:似乎|可能|像是)?有(?:一个|明显的)?(?:先后顺序|条件关系|区别|张力)/u;

/**
 * ask 的思路层只说明已知线索与提问价值。它若已经用完成性陈述给出
 * 当前缺口的答案，继续展示问题会形成客观动作冲突。
 */
function askThinkingSummaryAlreadyAnswersQuestion(
  turn: EventCenteredGenerativeTurn
) {
  if (turn.semanticPlan.action !== "ask") return false;
  const summary = turn.visibleTurn.thinkingSummary?.trim() ?? "";
  if (!summary || OPEN_ASK_SUMMARY_PATTERN.test(summary)) return false;
  return CLOSED_ASK_SUMMARY_PATTERN.test(summary);
}

function normalizedKnownFactQuestionCore(value: string) {
  return normalizeGenerativeRealizationText(value)
    .replace(/^(?:请问|那|那么|这时|当时)/u, "")
    .replace(/(?:吗|呢|吧|么)$/u, "")
    .replace(/(?:是什么状态|是什么情况|有什么状态|有什么结果|发生了什么|最后怎么样|最后怎样)$/u, "");
}

const RELATIONAL_UNDERSTANDING_PATTERN = /关系|连接|区别|先后|条件|作用|影响|为什么|判断|标准|取舍|意义|功能/u;
const KNOWN_STATE_QUESTION_PATTERN = /(?:是什么|处于什么|现在什么|最后什么|有没有|是否).{0,8}(?:状态|结果|变化|情况)|发生了什么|做了什么|最后(?:怎样|怎么样)/u;
const OBSERVABLE_STATE_EVIDENCE_PATTERN = /一直|仍然?|没有|没|未|已经|到.{0,10}(?:还|都|仍)|压在|停在|保持|结束|开始|开口|清楚/u;
const USER_ARTICULATED_RELATION_CLASSES = [
  // “但 / 阻力 / 既…也…”都明确表达两侧并存或取舍；可自然整理成“同时”，
  // 仍不得借此引入未表达的因果、目的、动机或价值判断。
  /先|随后|之后|之前|直到|才|同时|一边|一面|既[\s\S]{0,72}也|又[\s\S]{0,72}又|但|不过|可是|却|可那|阻力|取舍/u,
  /因为|所以|导致|使得|源于|来自|让.{0,8}(?:变|更|能|无法|开始|停止)|更(?:容易|难).{0,8}(?:开始|继续|处理|完成)/u,
  /只要|只有|如果|除非|每当|取决于/u,
  /等于|不等于|代表|意味着|说明|证明|才算|不算/u,
  /为了|用来|保护|避免|维持|恢复|替代|发挥.{0,4}作用/u,
  /在意|需要|边界|重要|期待|信任/u
] as const;
const EXPLICIT_EVENT_EXPERIENCE_RELATION_PATTERN = /(?:让我|令我|使我|使得我|导致我|让(?:我|你)的|令(?:我|你)的|使(?:我|你)的|放大|加重|强化|引发|激起|带来).{0,12}(?:情绪|感受|怨气|愤怒|难受|委屈|生气|难过|害怕|紧张|烦躁|不安|失望|失落)/u;
const COMMON_LOW_INFERENCE_FEELING_PATTERN = /紧张|放松|害怕|生气|难过|开心|疲惫/u;
const BODY_OR_BEHAVIOR_SIGNAL_PATTERN = /身体|手|肩|牙关|胸口|呼吸|心跳|发抖|颤|绷|攥|松开|躲|退|哭|笑|沉默|僵住/u;

/**
 * 运行时只拦截“成果加入了用户材料中完全不存在的关系类型”这一类高置信来源误判。
 * 更复杂的同义改写、隐含蕴含和关系强弱仍由人工质量门裁决，避免关键词规则接管语义判断。
 */
function userArticulatedAddsUnstatedRelation(input: {
  insight: string;
  responseCore: string;
  sourceText: string;
  angle: JournalEventAngle | null;
}) {
  const visibleText = `${input.responseCore}\n${input.insight}`;
  const normalizedVisible = normalizeGenerativeRealizationText(visibleText)
    .replace(/用户|你|我/gu, "");
  const normalizedSource = normalizeGenerativeRealizationText(input.sourceText)
    .replace(/用户|你|我/gu, "");
  if (normalizedSource.includes(normalizedVisible)) return false;

  // 用户明确说出“某件事让我产生/放大某种体验”时，允许标题、理解句和
  // 成果正文做自然换述。关系是否有来源仍由两侧原话共同决定。
  if (
    EXPLICIT_EVENT_EXPERIENCE_RELATION_PATTERN.test(visibleText) &&
    EXPLICIT_EVENT_EXPERIENCE_RELATION_PATTERN.test(input.sourceText)
  ) {
    return false;
  }

  const introducedRelations = USER_ARTICULATED_RELATION_CLASSES.filter((relationPattern) =>
    relationPattern.test(visibleText) && !relationPattern.test(input.sourceText)
  );
  const isAllowedFeelingNaturalization = input.angle === "feeling" &&
    COMMON_LOW_INFERENCE_FEELING_PATTERN.test(visibleText) &&
    BODY_OR_BEHAVIOR_SIGNAL_PATTERN.test(input.sourceText) &&
    introducedRelations.length === 0;
  if (isAllowedFeelingNaturalization) return false;
  return introducedRelations.length > 0;
}

/**
 * 这里只拦截高置信的事实回收：问题正文直接重复完整事实，或语义计划
 * 要求连接关系、可见问题却再次询问已有的可观察状态。更模糊的同义
 * 重复继续进入离线质量评审，避免运行时规则接管产品判断。
 */
function askQuestionOnlyRequestsKnownFact(input: {
  turn: EventCenteredGenerativeTurn;
  factStatements: string[];
}) {
  if (input.turn.semanticPlan.action !== "ask") return false;
  const question = input.turn.visibleTurn.question?.trim() ?? "";
  if (!question) return false;
  const questionCore = normalizedKnownFactQuestionCore(question);
  const normalizedFacts = input.factStatements
    .map((statement) => ({
      source: statement,
      normalized: normalizeGenerativeRealizationText(statement)
    }))
    .filter((fact) => fact.normalized.length >= 4);
  if (
    questionCore.length >= 6 &&
    normalizedFacts.some((fact) =>
      fact.normalized.includes(questionCore) || questionCore.includes(fact.normalized)
    )
  ) {
    return true;
  }

  const expectedDelta = input.turn.semanticPlan.expectedUnderstandingDelta ?? "";
  if (
    !RELATIONAL_UNDERSTANDING_PATTERN.test(expectedDelta) ||
    !KNOWN_STATE_QUESTION_PATTERN.test(question)
  ) {
    return false;
  }
  return normalizedFacts.some((fact) =>
    OBSERVABLE_STATE_EVIDENCE_PATTERN.test(fact.source) &&
    sharesNormalizedGenerativeFragment(question, fact.source, 2)
  );
}

export function isEventCenteredGenerativeAnchorTraceable(
  anchor: string,
  sources: Array<string | null | undefined>
) {
  return sources.some((source) => includesNormalizedGenerativeText(source, anchor, 2));
}

const INSERTED_NEGATION_BEFORE_CORE_FRAGMENT = /(?:不|没|未|无|非|别|没有|并非|从未).{0,2}$/u;
const MAX_RESPONSE_CORE_SINGLE_GAP = 24;
const MAX_RESPONSE_CORE_TOTAL_GAP = 48;

/**
 * responseCore 冻结的是语义骨架，不要求表达层逐字粘贴整句。精确包含
 * 仍是首选；兜底只允许全部字符保持原顺序，并限制插入跨度。对新连续
 * 片段前紧邻的显式否定做保守拦截，复杂隐含语义继续交给离线评测。
 */
function preservesNormalizedGenerativeResponseCore(
  source: string | null | undefined,
  frozenText: string,
  minimumLength = 4
) {
  const normalizedSource = Array.from(normalizeGenerativeRealizationText(source));
  const normalizedCore = Array.from(normalizeGenerativeRealizationText(frozenText));
  if (normalizedCore.length < minimumLength || normalizedSource.length < normalizedCore.length) {
    return false;
  }
  const sourceText = normalizedSource.join("");
  const coreText = normalizedCore.join("");
  if (sourceText.includes(coreText)) return true;

  for (let start = 0; start < normalizedSource.length; start += 1) {
    if (normalizedSource[start] !== normalizedCore[0]) continue;
    const positions = [start];
    let cursor = start + 1;
    let complete = true;
    for (let coreIndex = 1; coreIndex < normalizedCore.length; coreIndex += 1) {
      const next = normalizedSource.indexOf(normalizedCore[coreIndex]!, cursor);
      if (next < 0) {
        complete = false;
        break;
      }
      positions.push(next);
      cursor = next + 1;
    }
    if (!complete) continue;

    let totalInserted = 0;
    let drifted = false;
    for (let index = 1; index < positions.length; index += 1) {
      const gapLength = positions[index]! - positions[index - 1]! - 1;
      if (gapLength <= 0) continue;
      totalInserted += gapLength;
      if (
        gapLength > MAX_RESPONSE_CORE_SINGLE_GAP ||
        totalInserted > MAX_RESPONSE_CORE_TOTAL_GAP
      ) {
        drifted = true;
        break;
      }
      const inserted = normalizedSource
        .slice(positions[index - 1]! + 1, positions[index]!)
        .join("");
      if (INSERTED_NEGATION_BEFORE_CORE_FRAGMENT.test(inserted)) {
        drifted = true;
        break;
      }
    }
    if (!drifted) return true;
  }
  return false;
}

export function sharesNormalizedGenerativeFragment(
  left: string | null | undefined,
  right: string | null | undefined,
  minimumLength = 2
) {
  const normalizedLeft = Array.from(normalizeGenerativeRealizationText(left));
  const normalizedRight = normalizeGenerativeRealizationText(right);
  if (normalizedLeft.length < minimumLength || normalizedRight.length < minimumLength) {
    return false;
  }
  for (let start = 0; start + minimumLength <= normalizedLeft.length; start += 1) {
    const fragment = normalizedLeft.slice(start, start + minimumLength).join("");
    if (normalizedRight.includes(fragment)) return true;
  }
  return false;
}

function normalizedBigrams(value: string | null | undefined) {
  const characters = Array.from(normalizeGenerativeRealizationText(value));
  const grams = new Set<string>();
  for (let index = 0; index + 1 < characters.length; index += 1) {
    grams.add(`${characters[index]}${characters[index + 1]}`);
  }
  return grams;
}

function isSubstantiallySameGenerativeMeaning(
  left: string | null | undefined,
  right: string | null | undefined
) {
  const normalizedLeft = normalizeGenerativeRealizationText(left);
  const normalizedRight = normalizeGenerativeRealizationText(right);
  if (normalizedLeft.length < 6 || normalizedRight.length < 6) return false;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
    return true;
  }
  const leftBigrams = normalizedBigrams(left);
  const rightBigrams = normalizedBigrams(right);
  const intersection = [...leftBigrams].filter((gram) => rightBigrams.has(gram)).length;
  const union = new Set([...leftBigrams, ...rightBigrams]).size;
  return union > 0 && intersection / union >= 0.72;
}

function repeatsUserExpression(
  summary: string,
  sources: Array<string | null | undefined>
) {
  if (/^(?:你提到|你说|刚才你说|从你说的)/u.test(summary.trim())) return true;
  const summaryClauses = summary
    .split(/[，,。！？!?；;\n]+/u)
    .map((clause) => clause.trim())
    .filter((clause) => normalizeGenerativeRealizationText(clause).length >= 6);
  return sources.some((source) => {
    if (isSubstantiallySameGenerativeMeaning(summary, source)) return true;
    const sourceClauses = (source ?? "")
      .split(/[，,。！？!?；;\n]+/u)
      .map((clause) => clause.trim())
      .filter((clause) => normalizeGenerativeRealizationText(clause).length >= 6);
    return summaryClauses.some((summaryClause) =>
      sourceClauses.some((sourceClause) =>
        isSubstantiallySameGenerativeMeaning(summaryClause, sourceClause)
      )
    );
  });
}

function containsUnquotedFirstPerson(value: string) {
  const withoutQuotedText = value
    .replace(/“[^”]*”/gu, "")
    .replace(/"[^"]*"/gu, "")
    .replace(/‘[^’]*’/gu, "")
    .replace(/'[^']*'/gu, "");
  return /(?:^|[，。！？；：\s])我(?:的|当时|现在|觉得|感觉|希望|想|认为|判断|担心|害怕|需要|很|有点|不想|更)/u.test(
    withoutQuotedText
  );
}

/**
 * 语义计划生成后即可客观判断的硬约束。双调用在生成用户可见表达前
 * 使用它早停；完整回合校验复用同一结果，避免阶段和微目标规则漂移。
 */
export function validateEventCenteredGenerativeSemanticPlan(
  input: EventCenteredGenerativeSemanticPlanValidationInput
): EventCenteredGenerativeValidationResult {
  const issues: string[] = [];
  const plan = input.semanticPlan;
  const understanding = input.understanding;
  const isDeep = input.phase === "deep_companionship" || input.phase === "checkpoint_two";
  const evidenceRefs = generativeEvidenceRefs({
    existingFactIds: input.existingFactIds,
    understanding
  });
  const evidenceStatementsByRef = new Map<string, string>([
    ...input.existingFactIds.map((id, index) => [
      id,
      input.existingFactStatements?.[index] ?? ""
    ] as const),
    ...understanding.factDeltas.map((fact, index) => [
      `new:${index + 1}`,
      fact.statement
    ] as const)
  ]);
  const outcomeAssessment = plan.outcomeAssessment;
  const deepProgressContractEnabled = input.deepQuestionAnswerCount !== undefined ||
    Boolean(input.priorAngleOutcomeStatement);
  const currentTurnAnswersDeepQuestion = Boolean(
    isDeep && deepProgressContractEnabled &&
    input.currentQuestionTarget &&
    (
      understanding.answerStatus === "answered" ||
      understanding.answerStatus === "correction" ||
      (
        understanding.answerStatus === "partly_answered" &&
        understanding.factDeltas.length > 0
      )
    )
  );
  const effectiveDeepAnswerCount = Math.min(
    3,
    (input.deepQuestionAnswerCount ?? 0) + (currentTurnAnswersDeepQuestion ? 1 : 0)
  );
  // 只拦截“用户已回答且证据可追溯，却被模型归为材料不足”的组合。
  // 拒答、纠正、跨事件和真正未知回答不会进入这个条件。
  const answeredTurnHasTraceableEvidence = Boolean(
    input.rawText?.trim() &&
    understanding.answerStatus === "answered" &&
    input.limitReasonKind === "insufficient_evidence" &&
    (
      understanding.factDeltas.some((fact) =>
        fact.quote.trim() && input.rawText!.includes(fact.quote)
      ) ||
      (input.existingFactStatements ?? []).some((statement) =>
        sharesNormalizedGenerativeFragment(input.rawText, statement, 4)
      )
    )
  );
  const isQuestionLimitRepair = Boolean(
    input.allowQuestionLimitRepair &&
    input.currentQuestionTarget &&
    plan.action === "ask" &&
    plan.selectedTargetId === input.currentQuestionTarget &&
    plan.cognitiveAction === "anchor_specific"
  );

  if (input.requireOutcomeAssessment && !outcomeAssessment) {
    issues.push("outcome_assessment_required");
  }
  if (hasDuplicateEvidenceRefs(plan.evidenceRefs)) {
    issues.push("decision_duplicate_evidence_refs");
  }
  if (outcomeAssessment) {
    if (hasDuplicateEvidenceRefs(outcomeAssessment.supportEvidenceRefs)) {
      issues.push("outcome_assessment_duplicate_evidence_refs");
    }
    addUnknownRefs(
      issues,
      outcomeAssessment.supportEvidenceRefs,
      evidenceRefs,
      "outcome_assessment"
    );
    if (outcomeAssessment.state === "needs_more") {
      if (plan.action !== "ask") issues.push("needs_more_requires_ask");
      if (outcomeAssessment.origin !== null) {
        issues.push("unfinished_outcome_must_not_claim_origin");
      }
      if (!outcomeAssessment.missingUnderstanding) {
        issues.push("needs_more_requires_missing_understanding");
      }
    }
    if (outcomeAssessment.state === "ready") {
      if (plan.action !== (isDeep ? "pause" : "complete")) {
        issues.push("ready_outcome_requires_stop_action");
      }
      if (outcomeAssessment.supportEvidenceRefs.length === 0) {
        issues.push("ready_outcome_requires_evidence");
      }
      if (!outcomeAssessment.origin) {
        issues.push("ready_outcome_requires_origin");
      }
      if (
        outcomeAssessment.origin === "ai_synthesized" &&
        new Set(outcomeAssessment.supportEvidenceRefs).size < 2
      ) {
        issues.push("ai_synthesized_outcome_requires_two_evidence_refs");
      }
      if (outcomeAssessment.origin === "ai_synthesized") {
        const supportStatements = outcomeAssessment.supportEvidenceRefs
          .map((ref) => evidenceStatementsByRef.get(ref) ?? "")
          .filter(Boolean)
          .map(normalizeGenerativeRealizationText);
        if (
          supportStatements.length === outcomeAssessment.supportEvidenceRefs.length &&
          new Set(supportStatements).size < 2
        ) {
          issues.push("ai_synthesized_outcome_requires_distinct_evidence");
        }
      }
      if (outcomeAssessment.missingUnderstanding) {
        issues.push("ready_outcome_must_not_keep_missing_understanding");
      }
    }
    if (outcomeAssessment.state === "limited") {
      if (answeredTurnHasTraceableEvidence) {
        issues.push("answered_turn_must_not_claim_insufficient_evidence");
      }
      if (plan.action !== "honest_limit") issues.push("limited_outcome_requires_honest_limit");
      if (outcomeAssessment.origin !== null) {
        issues.push("limited_outcome_must_not_claim_origin");
      }
      if (outcomeAssessment.missingUnderstanding) {
        issues.push("limited_outcome_must_not_keep_missing_understanding");
      }
    }
  }

  if (plan.activeAngle && input.angle && plan.activeAngle !== input.angle) {
    issues.push("semantic_plan_angle_mismatch");
  }
  if (plan.insightKind === "scope_only" && plan.action !== "honest_limit") {
    issues.push("scope_only_requires_honest_limit");
  }
  if (plan.action === "ask" && plan.insightKind !== null) {
    issues.push("ask_must_not_claim_insight_kind");
  }
  if (
    (plan.action === "complete" || plan.action === "pause") &&
    plan.insightKind === null
  ) {
    issues.push("insight_action_requires_insight_kind");
  }
  if (plan.action === "honest_limit" && plan.insightKind !== "scope_only") {
    issues.push("honest_limit_requires_scope_only");
  }
  if (
    (plan.action === "complete" || plan.action === "pause") &&
    plan.evidenceRefs.length === 0
  ) {
    issues.push("insight_requires_evidence");
  }
  if (plan.action !== "ask" && plan.selectedTargetId) {
    issues.push("stop_action_must_not_keep_question_target");
  }
  if (
    (plan.action === "complete" || plan.action === "pause") &&
    !plan.expectedUnderstandingDelta
  ) {
    issues.push("insight_action_requires_understanding_delta");
  }
  if (plan.action === "honest_limit" && plan.expectedUnderstandingDelta) {
    issues.push("honest_limit_must_not_claim_understanding_delta");
  }

  if (plan.action === "ask") {
    if (!plan.cognitiveAction) issues.push("ask_requires_cognitive_action");
    if (!plan.selectedTargetId) issues.push("ask_requires_target");
    if (!plan.expectedUnderstandingDelta) issues.push("ask_requires_expected_value");
    if (plan.evidenceRefs.length === 0) issues.push("ask_requires_evidence");
    if (plan.stopReason) issues.push("ask_must_not_have_stop_reason");
    if (understanding.answerStatus === "declined") {
      issues.push("user_boundary_must_stop_questioning");
    }
  } else {
    if (plan.cognitiveAction) issues.push("non_ask_must_not_have_cognitive_action");
    if (!plan.stopReason) issues.push("stop_action_requires_reason");
  }

  if (plan.cognitiveAction === "open_possibility" && !isDeep) {
    issues.push("open_possibility_requires_deep_mode");
  }
  if (plan.action === "pause" && !isDeep) {
    issues.push("pause_requires_deep_mode");
  }
  if (plan.action === "complete" && isDeep) {
    issues.push("deep_mode_uses_pause_not_complete");
  }
  if (
    isDeep && deepProgressContractEnabled &&
    effectiveDeepAnswerCount === 0 &&
    (plan.action === "pause" || outcomeAssessment?.state === "ready")
  ) {
    issues.push("deep_outcome_requires_completed_question_answer");
  }
  if (
    isDeep && deepProgressContractEnabled &&
    plan.action === "pause" &&
    !["user_new_understanding", "ai_new_relation", "correction_update"].includes(
      plan.progressAssessment
    )
  ) {
    issues.push("deep_pause_requires_substantive_progress");
  }
  if (
    isDeep &&
    plan.action === "ask" &&
    !["no_increment", "correction_update"].includes(plan.progressAssessment)
  ) {
    issues.push("deep_ask_must_keep_progress_open");
  }
  if (!isDeep && plan.progressAssessment !== "not_applicable") {
    issues.push("guided_turn_progress_must_be_not_applicable");
  }
  if (
    deepProgressContractEnabled &&
    plan.progressAssessment === "ai_new_relation" &&
    outcomeAssessment?.origin !== "ai_synthesized"
  ) {
    issues.push("ai_new_relation_requires_ai_synthesized_origin");
  }
  if (
    deepProgressContractEnabled &&
    plan.progressAssessment === "user_new_understanding" &&
    outcomeAssessment?.origin !== "user_articulated"
  ) {
    issues.push("user_new_understanding_requires_user_articulated_origin");
  }
  if (
    deepProgressContractEnabled &&
    plan.progressAssessment === "correction_update" &&
    understanding.answerStatus !== "correction"
  ) {
    issues.push("correction_progress_requires_correction");
  }
  if (
    plan.selectedTargetId &&
    (
      input.answeredTargets.includes(plan.selectedTargetId) ||
      input.deniedTargets.includes(plan.selectedTargetId)
    )
  ) {
    issues.push("selected_target_already_closed");
  }
  if (
    isDeep &&
    input.microgoalQuestionCount >= 3 &&
    plan.action === "ask" &&
    !isQuestionLimitRepair
  ) {
    issues.push("microgoal_question_limit_reached");
  }
  if (
    !isDeep &&
    (input.guidedQuestionOpportunityCount ?? 0) >= 3 &&
    plan.action === "ask" &&
    !isQuestionLimitRepair
  ) {
    issues.push("guided_question_limit_reached");
  }

  const microgoalOperation = plan.microgoalDelta?.operation ?? null;
  if (plan.action === "ask" && ["complete", "close"].includes(microgoalOperation ?? "")) {
    issues.push("closed_microgoal_must_not_ask");
  }
  if (isDeep && plan.action === "ask") {
    if (!microgoalOperation) {
      issues.push("deep_question_requires_microgoal_delta");
    } else if (!["start", "continue"].includes(microgoalOperation)) {
      issues.push("deep_ask_requires_open_microgoal_delta");
    }
  }
  if (
    isDeep &&
    plan.action === "pause" &&
    !["complete", "close"].includes(microgoalOperation ?? "")
  ) {
    issues.push("deep_pause_requires_microgoal_resolution");
  }
  if (input.boundaryDetected && plan.action === "ask") {
    issues.push("deterministic_boundary_must_stop_questioning");
  }
  if (
    input.boundaryDetected &&
    understanding.correctionOrBoundary?.kind !== "boundary"
  ) {
    issues.push("deterministic_boundary_must_be_recorded");
  }
  if (
    understanding.correctionOrBoundary?.kind === "boundary" &&
    plan.action === "ask"
  ) {
    issues.push("recorded_boundary_must_stop_questioning");
  }
  if (input.correctionDetected && understanding.answerStatus !== "correction") {
    issues.push("deterministic_correction_must_take_priority");
  }
  if (
    input.correctionDetected &&
    understanding.correctionOrBoundary?.kind !== "correction"
  ) {
    issues.push("deterministic_correction_must_be_recorded");
  }
  if (
    understanding.correctionOrBoundary?.kind === "correction" &&
    understanding.answerStatus !== "correction"
  ) {
    issues.push("recorded_correction_requires_correction_status");
  }

  const hypothesis = plan.tentativeInterpretation;
  if (hypothesis) {
    if (hasDuplicateEvidenceRefs(hypothesis.supportEvidenceRefs)) {
      issues.push("tentative_interpretation_duplicate_evidence_refs");
    }
    addUnknownRefs(issues, hypothesis.supportEvidenceRefs, evidenceRefs, "hypothesis");
    if (plan.action !== "complete" && plan.action !== "pause") {
      issues.push("tentative_interpretation_requires_insight_stop");
    }
    if (outcomeAssessment?.origin !== "ai_synthesized") {
      issues.push("tentative_interpretation_requires_ai_synthesized_origin");
    }
  }
  if (outcomeAssessment?.origin === "ai_synthesized" && !hypothesis) {
    issues.push("ai_synthesized_outcome_requires_tentative_interpretation");
  }
  if (outcomeAssessment?.origin === "user_articulated" && hypothesis) {
    issues.push("user_articulated_outcome_must_not_be_tentative");
  }
  if (plan.cognitiveAction === "test_understanding") {
    issues.push("test_understanding_is_legacy_only");
  }

  addUnknownRefs(issues, plan.evidenceRefs, evidenceRefs, "decision");
  return { passed: issues.length === 0, issues: [...new Set(issues)] };
}

/**
 * 只执行能够客观判定的硬约束。自然度、泛化感和认识价值继续交给
 * 板块 6 的离线评测与 Preview，避免运行时规则重新接管访谈策略。
 */
export function validateEventCenteredGenerativeTurn(
  input: EventCenteredGenerativeValidationInput
): EventCenteredGenerativeValidationResult {
  const issues: string[] = [];
  const { turn } = input;
  const evidenceRefs = generativeEvidenceRefs({
    existingFactIds: input.existingFactIds,
    understanding: turn.understanding
  });
  const questionCount = (turn.reply.question?.match(/[？?]/gu) ?? []).length;
  const visible = turn.visibleTurn;
  const semanticPlanValidation = validateEventCenteredGenerativeSemanticPlan({
    understanding: turn.understanding,
    semanticPlan: turn.semanticPlan,
    phase: input.phase,
    angle: input.angle,
    existingFactIds: input.existingFactIds,
    existingFactStatements: input.existingFactStatements,
    currentQuestionTarget: input.currentQuestionTarget,
    currentQuestionCognitiveAction: input.currentQuestionCognitiveAction,
    askedTargets: input.askedTargets,
    answeredTargets: input.answeredTargets,
    deniedTargets: input.deniedTargets,
    guidedQuestionOpportunityCount: input.guidedQuestionOpportunityCount,
    microgoalQuestionCount: input.microgoalQuestionCount,
    deepQuestionAnswerCount: input.deepQuestionAnswerCount,
    priorAngleOutcomeStatement: input.priorAngleOutcomeStatement,
    allowQuestionLimitRepair: input.allowQuestionLimitRepair,
    boundaryDetected: input.boundaryDetected,
    correctionDetected: input.correctionDetected,
    requireOutcomeAssessment: input.requireOutcomeAssessment
  });
  issues.push(...semanticPlanValidation.issues);

  if (turn.semanticPlan.action === "ask") {
    if (!visible.thinkingSummary?.trim()) issues.push("ask_requires_thinking_summary");
    if (!turn.reply.naturalUnderstanding.trim()) {
      issues.push("ask_reply_requires_natural_understanding");
    }
  } else {
    if (visible.thinkingSummary !== null) {
      issues.push("stop_action_must_not_have_thinking_summary");
    }
    if (turn.reply.naturalUnderstanding !== "") {
      issues.push("stop_action_natural_understanding_must_be_empty");
    }
  }
  if (
    visible.thinkingSummary &&
    repeatsUserExpression(visible.thinkingSummary, [
      input.rawText,
      ...(input.existingFactStatements ?? []),
      ...(input.recentUserTexts ?? []),
      ...turn.understanding.factDeltas.flatMap((fact) => [fact.quote, fact.statement])
    ])
  ) {
    issues.push("thinking_summary_repeats_user_expression");
  }
  if (/^(?:你提到|你说|刚才你说|从你说的)/u.test(visible.question?.trim() ?? "")) {
    issues.push("question_repeats_user_expression_lead");
  }
  if (
    [
      visible.thinkingSummary,
      visible.question,
      visible.insight,
      visible.honestLimit
    ].some((value) => value ? containsUnquotedFirstPerson(value) : false)
  ) {
    issues.push("visible_turn_uses_unquoted_user_first_person");
  }
  if (
    turn.semanticPlan.action === "pause" &&
    input.priorAngleOutcomeStatement &&
    isSubstantiallySameGenerativeMeaning(
      visible.insight,
      input.priorAngleOutcomeStatement
    )
  ) {
    issues.push("deep_outcome_repeats_prior_angle_outcome");
  }
  if (
    turn.semanticPlan.action === "pause" &&
    turn.semanticPlan.outcomeAssessment?.origin === "ai_synthesized" &&
    input.priorAngleOutcomeStatement &&
    visible.insight &&
    repeatsUserExpression(visible.insight, [input.priorAngleOutcomeStatement])
  ) {
    issues.push("deep_ai_synthesis_restates_prior_outcome");
  }
  if (turn.semanticPlan.action === "ask" && visible.question) {
    const normalizedQuestion = normalizedGenerativeQuestion(visible.question);
    const priorQuestionTexts = [
      input.currentQuestionText,
      ...(input.recentQuestionTexts ?? [])
    ].filter((question): question is string => Boolean(question?.trim()));
    const repeatsPriorQuestionExactly = normalizedQuestion.length > 0 &&
      priorQuestionTexts.some((question) =>
        normalizedGenerativeQuestion(question) === normalizedQuestion
      );
    const nearlyRepeatsCurrentTarget = Boolean(
      turn.semanticPlan.selectedTargetId &&
      input.currentQuestionTarget &&
      turn.semanticPlan.selectedTargetId === input.currentQuestionTarget &&
      input.currentQuestionText &&
      isNearVerbatimGenerativeQuestion(visible.question, input.currentQuestionText)
    );
    if (repeatsPriorQuestionExactly || nearlyRepeatsCurrentTarget) {
      issues.push("repeated_question");
    }
  }
  if (askThinkingSummaryAlreadyAnswersQuestion(turn)) {
    issues.push("ask_summary_already_answers_question");
  }
  if (askQuestionOnlyRequestsKnownFact({
    turn,
    factStatements: [
      ...(input.existingFactStatements ?? []),
      ...turn.understanding.factDeltas.map((fact) => fact.statement)
    ]
  })) {
    issues.push("ask_question_only_requests_known_fact");
  }
  if (turn.semanticPlan.action !== turn.decision.turnAction) {
    issues.push("semantic_plan_action_mismatch");
  }
  if (turn.semanticPlan.action === "ask") {
    if (
      visible.responseKind !== "question" ||
      !visible.question ||
      visible.insight ||
      visible.honestLimit
    ) {
      issues.push("ask_visible_turn_shape_mismatch");
    }
  } else if (turn.semanticPlan.action === "complete") {
    if (
      visible.responseKind !== "completion" ||
      !visible.insight ||
      visible.question ||
      visible.honestLimit
    ) {
      issues.push("complete_visible_turn_shape_mismatch");
    }
  } else if (turn.semanticPlan.action === "pause") {
    if (
      visible.responseKind !== "pause" ||
      !visible.insight ||
      visible.question ||
      visible.honestLimit
    ) {
      issues.push("pause_visible_turn_shape_mismatch");
    }
  } else if (
    visible.responseKind !== "honest_limit" ||
    !visible.honestLimit ||
    visible.question ||
    visible.insight
  ) {
    issues.push("honest_limit_visible_turn_shape_mismatch");
  }
  if (/用户/u.test([
    visible.thinkingSummary,
    visible.question,
    visible.insight,
    visible.honestLimit
  ].filter(Boolean).join("\n"))) {
    issues.push("visible_turn_must_address_user_naturally");
  }

  const realizationContract = turn.semanticPlan.realizationContract;
  if (realizationContract.summaryAnchors.length === 0) {
    issues.push("summary_anchor_required");
  }
  const visibleMainResponse = turn.semanticPlan.action === "ask"
    ? visible.question
    : turn.semanticPlan.action === "complete" || turn.semanticPlan.action === "pause"
      ? visible.insight
      : visible.honestLimit;
  if (!preservesNormalizedGenerativeResponseCore(
    visibleMainResponse,
    realizationContract.responseCore,
    4
  )) {
    issues.push("visible_response_must_preserve_response_core");
  }
  if (
    visible.thinkingSummary &&
    includesNormalizedGenerativeText(
      visible.thinkingSummary,
      realizationContract.responseCore,
      8
    )
  ) issues.push("thinking_summary_must_not_repeat_main_response");
  if (
    turn.semanticPlan.action === "ask" &&
    repeatsAskTargetAfterOpenIntent(
      visible.thinkingSummary ?? "",
      realizationContract.responseCore
    )
  ) {
    issues.push("thinking_summary_must_not_repeat_question_target");
  }
  const anchorSources = [
    input.rawText,
    ...(input.existingFactStatements ?? []),
    ...(input.recentUserTexts ?? []),
    ...turn.understanding.factDeltas.map((fact) => fact.statement)
  ];
  for (const anchor of realizationContract.summaryAnchors) {
    if (normalizeGenerativeRealizationText(anchor).length < 2) {
      issues.push("summary_anchor_too_short");
    }
    if (!isEventCenteredGenerativeAnchorTraceable(anchor, anchorSources)) {
      issues.push(`summary_anchor_not_traceable:${anchor}`);
    }
  }
  if (turn.semanticPlan.action === "ask" && visible.thinkingSummary) {
    if (!hasVisibleThinkingSummaryDirection({
      thinkingSummary: visible.thinkingSummary,
      directionSources: [
        turn.semanticPlan.expectedUnderstandingDelta,
        realizationContract.responseCore,
        visible.question
      ]
    })) {
      issues.push("thinking_summary_direction_mismatch");
    }
  }
  for (const fact of turn.understanding.factDeltas) {
    if (!input.rawText.includes(fact.quote)) issues.push("fact_quote_not_in_current_turn");
  }

  if (turn.understanding.eventBoundary === "multiple_events") {
    if (!inspectEventCenteredFocusOptions({
      rawText: input.rawText,
      options: turn.understanding.eventOptions
    }).passed) {
      issues.push("invalid_event_focus_options");
    }
    if (turn.understanding.factDeltas.length > 0) issues.push("multiple_events_must_not_write_facts");
  }

  if (turn.reply.naturalUnderstanding && /[？?]/u.test(turn.reply.naturalUnderstanding)) {
    issues.push("understanding_contains_question");
  }
  if ((turn.reply.naturalUnderstanding.match(/[。！!\n]/gu) ?? []).length > 2) {
    issues.push("thinking_summary_must_be_one_or_two_sentences");
  }
  if (turn.decision.turnAction === "ask") {
    if (!turn.reply.question || questionCount !== 1) issues.push("ask_requires_single_question");
  } else {
    if (turn.reply.question) issues.push("non_ask_must_not_have_question");
  }
  if (input.correctionDetected && turn.understanding.answerStatus !== "correction") {
    issues.push("deterministic_correction_must_take_priority");
  }
  if (
    input.correctionDetected &&
    turn.understanding.correctionOrBoundary?.kind !== "correction"
  ) {
    issues.push("deterministic_correction_must_be_recorded");
  }
  if (
    turn.understanding.correctionOrBoundary?.kind === "correction" &&
    turn.understanding.answerStatus !== "correction"
  ) {
    issues.push("recorded_correction_requires_correction_status");
  }
  if (
    input.correctionDetected &&
    turn.semanticPlan.action === "ask" &&
    visible.thinkingSummary &&
    !acknowledgesVisibleCorrection(visible.thinkingSummary)
  ) {
    issues.push("thinking_summary_must_acknowledge_correction");
  }
  if (input.multipleEventsDetected && turn.understanding.eventBoundary !== "multiple_events") {
    issues.push("deterministic_multiple_events_must_clarify_focus");
  }
  if (!input.multipleEventsDetected && turn.understanding.eventBoundary === "multiple_events") {
    issues.push("spurious_multiple_events_must_stay_in_current_event");
  }

  if (turn.decision.outcomeCandidate) {
    addUnknownRefs(
      issues,
      turn.decision.outcomeCandidate.supportEvidenceRefs,
      evidenceRefs,
      "outcome"
    );
    if (!input.angle || turn.decision.outcomeCandidate.angle !== input.angle) {
      issues.push("outcome_angle_mismatch");
    }
  }
  if (
    (turn.decision.turnAction === "complete" || turn.decision.turnAction === "pause") &&
    input.angle &&
    !turn.decision.outcomeCandidate
  ) {
    issues.push("angle_insight_stop_requires_outcome");
  }
  if (turn.decision.turnAction === "honest_limit" && turn.decision.outcomeCandidate) {
    issues.push("honest_limit_must_not_be_outcome");
  }

  const hypothesis = turn.semanticPlan.tentativeInterpretation;
  if (hypothesis) {
    if (!sharesNormalizedGenerativeFragment(turn.visibleTurn.insight, hypothesis.statement, 6)) {
      issues.push("visible_insight_must_preserve_tentative_interpretation");
    }
  }

  if (input.angle === "action" && /下次|以后(?:要|可以|准备)|下一步|计划|尝试|成功信号/u.test(
    `${turn.decision.selectedTarget ?? ""}\n${turn.reply.question ?? ""}`
  )) {
    issues.push("action_mvp_excludes_future_planning");
  }
  if (input.angle === "relationship" && /(?:对方|他|她)(?:其实|故意|一定|就是).{0,24}(?:想|认为|觉得|针对|控制|操纵)/u.test(
    [
      turn.reply.naturalUnderstanding,
      turn.reply.question,
      turn.visibleTurn.insight,
      turn.visibleTurn.honestLimit
    ].filter(Boolean).join("\n")
  )) {
    issues.push("relationship_must_not_assert_other_motive");
  }
  const outcomeOrigin = turn.semanticPlan.outcomeAssessment?.origin ?? null;
  const visibleInsight = turn.visibleTurn.insight ?? "";
  if (
    outcomeOrigin === "ai_synthesized" &&
    /人格|创伤|依恋|原生家庭|长期模式|一直以来|习惯性|你(?:本质上|其实就是|就是个)/u.test(
      visibleInsight
    )
  ) {
    issues.push("ai_synthesized_outcome_overreaches_personality_or_long_term");
  }
  if (
    outcomeOrigin === "ai_synthesized" &&
    /(?:他|她|对方|同事|家人|朋友)(?:其实|就是|故意|一定|之所以|是为了).{0,28}(?:想|认为|觉得|控制|针对|操纵|证明|让)/u.test(
      visibleInsight
    )
  ) {
    issues.push("ai_synthesized_outcome_asserts_other_person_motive");
  }
  if (outcomeOrigin === "user_articulated") {
    const userEvidenceText = [
      input.rawText,
      ...(turn.understanding.answerStatus === "correction" && input.currentQuestionText
        ? [input.currentQuestionText]
        : []),
      ...(input.existingFactStatements ?? []),
      ...(input.recentUserTexts ?? []),
      ...turn.understanding.factDeltas.map((fact) => fact.statement)
    ].join("\n");
    if (userArticulatedAddsUnstatedRelation({
      insight: visibleInsight,
      responseCore: turn.semanticPlan.realizationContract.responseCore,
      sourceText: userEvidenceText,
      angle: input.angle
    })) {
      issues.push("user_articulated_origin_adds_unstated_relation");
    }
    if (/让你(?:能|可以)|帮助你|使你(?:能|可以)|因此.{0,10}(?:更|能)|更准确地|更清楚地|更好地|这个区分.{0,10}(?:重要|有助)/u.test(
      visibleInsight
    )) {
      issues.push("user_articulated_outcome_adds_generic_benefit");
    }
    if (
      /合理|正确|没有错|做得对|不该|应该/u.test(visibleInsight) &&
      !/合理|正确|没有错|做得对|不该|应该/u.test(userEvidenceText)
    ) {
      issues.push("user_articulated_outcome_strengthens_judgment");
    }
  }
  if (/用户/u.test(turn.reply.naturalUnderstanding)) {
    issues.push("visible_understanding_must_address_user_naturally");
  }
  if (
    turn.decision.cognitiveAction === "test_understanding" &&
    /还是|或者|或是/u.test(turn.reply.question ?? "")
  ) {
    issues.push("tentative_interpretation_question_must_confirm_one_possibility");
  }
  if (/是因为.{1,48}还是因为/u.test(turn.reply.question ?? "")) {
    issues.push("question_forces_binary_cause");
  }
  if (
    turn.semanticPlan.action === "ask" &&
    !turn.semanticPlan.tentativeInterpretation &&
    /是.{1,48}还是/u.test(turn.visibleTurn.thinkingSummary ?? "")
  ) {
    issues.push("thinking_summary_must_not_offer_unfounded_options");
  }
  if (
    turn.decision.turnAction === "ask" &&
    /意味着什么|说明了什么|有什么意义|如何看待|怎么看待|处于什么位置|处在什么位置|进入.{0,8}判断|默认标准是什么|背后的.{0,8}标准是什么|怎样的判断规则|(?:感受|空|难受|轻松).{0,8}回应.{0,4}什么/u.test(
      `${turn.decision.selectedTarget ?? ""}\n${turn.reply.question ?? ""}`
    )
  ) {
    issues.push("question_uses_abstract_analysis_language");
  }
  if (
    (turn.semanticPlan.action === "complete" || turn.semanticPlan.action === "pause") &&
    /(?:形成|存在)(?:了|一种|这段|关系中的)?.{0,8}(?:张力|连接)|(?:关系|变化|区别|连接).{0,8}(?:已经)?说清|判断依据不同|这个区分本身很重要/u.test(
      turn.visibleTurn.insight ?? ""
    )
  ) {
    issues.push("insight_uses_label_instead_of_understanding");
  }
  if (/事情层|关系层|结果层|过程层|事实层|意义层/u.test([
    turn.visibleTurn.thinkingSummary,
    turn.visibleTurn.question,
    turn.visibleTurn.insight,
    turn.visibleTurn.honestLimit
  ].filter(Boolean).join("\n"))) {
    issues.push("visible_turn_uses_internal_synthesis_labels");
  }
  if (
    (turn.semanticPlan.action === "complete" || turn.semanticPlan.action === "pause") &&
    (/[？?]/u.test(turn.visibleTurn.insight ?? "") ||
      /^(?:(?:接下来|然后|现在|那|这).{0,8})?(?:什么|怎样|怎么|哪(?:一|个|些|里|儿)?)/u.test(
        (turn.visibleTurn.insight ?? "").trim()
      ))
  ) {
    issues.push("insight_must_be_declarative");
  }
  if (
    input.angle === "relationship" &&
    turn.decision.turnAction === "ask" &&
    /怎样(?:影响|改变).{0,24}(?:感受|信任|边界)|对.{0,18}(?:关系|关心|信任|边界).{0,8}(?:感受|看法)/u.test(
      turn.reply.question ?? ""
    )
  ) {
    issues.push("relationship_question_is_too_abstract_to_answer");
  }
  if (
    turn.semanticPlan.action === "ask" &&
    !turn.semanticPlan.tentativeInterpretation &&
    /(?:我理解)?这是.{0,24}(?:反应|模式|证明|机制)|说明了?|表明|反映(?:出)?/u.test(
      turn.visibleTurn.thinkingSummary ?? ""
    )
  ) {
    issues.push("thinking_summary_adds_unsupported_interpretation");
  }
  if (
    turn.semanticPlan.action === "ask" &&
    /你(?:其实|之所以|是在|想通过)|这(?:是在|是为了)|(?:为了|用来)(?:保护|避免)|真正需要的是/u.test(
      turn.visibleTurn.thinkingSummary ?? ""
    )
  ) {
    issues.push("thinking_summary_introduces_unconfirmed_motive");
  }
  if (
    turn.semanticPlan.action === "ask" &&
    /为什么|原因|什么让你|怎么会/u.test(turn.visibleTurn.question ?? "")
  ) {
    const question = turn.visibleTurn.question ?? "";
    const concreteSources = [
      input.rawText,
      ...(input.existingFactStatements ?? []),
      ...(input.recentUserTexts ?? [])
    ];
    if (!concreteSources.some((source) =>
      sharesNormalizedGenerativeFragment(question, source, 2)
    )) {
      issues.push("reason_question_requires_concrete_anchor");
    }
  }
  if (
    !turn.semanticPlan.tentativeInterpretation &&
    turn.semanticPlan.cognitiveAction !== "open_possibility" &&
    /似乎|可能|像是/u.test(turn.visibleTurn.thinkingSummary ?? "")
  ) {
    issues.push("thinking_summary_tentative_requires_structured_hypothesis");
  }
  const openIntentMatch = /我想|想继续|想确认|想看看|我会继续|接下来/gu;
  const closedTargetMatch = /这里能看见|已经看见|已经清楚|可以看见/gu;
  const lastMatchIndex = (value: string, pattern: RegExp) => {
    let lastIndex = -1;
    for (const match of value.matchAll(pattern)) lastIndex = match.index;
    return lastIndex;
  };
  const visibleThinkingSummary = turn.visibleTurn.thinkingSummary ?? "";
  const openIntentIndex = lastMatchIndex(visibleThinkingSummary, openIntentMatch);
  const closedTargetIndex = lastMatchIndex(visibleThinkingSummary, closedTargetMatch);
  if (
    turn.semanticPlan.action === "ask" &&
    closedTargetIndex >= 0 &&
    closedTargetIndex > openIntentIndex
  ) {
    issues.push("ask_thinking_summary_must_keep_target_open");
  }
  if (/认识增量|阶段性认识|完成这一轮|满足.{0,6}成果|当前目标|当前角度|继续推进|提问次数|有证据|材料.{0,4}(?:足够|清晰|完整)|事实罗列|收束|环节都已清楚|给出这个认识|把.{0,8}认识交还|认识已经|取舍认识|暂停|主回应|综合结论|消化这个认识|直接给出/u.test(
    [
      turn.visibleTurn.thinkingSummary,
      turn.visibleTurn.question,
      turn.visibleTurn.insight,
      turn.visibleTurn.honestLimit
    ].filter(Boolean).join("\n")
  )) {
    issues.push("visible_turn_exposes_internal_process");
  }
  if (
    turn.semanticPlan.action === "ask" &&
    /这.{0,8}意味着什么/u.test(visibleThinkingSummary)
  ) {
    issues.push("thinking_summary_uses_abstract_analysis_language");
  }
  if (/(?:在你看来|我想确认|我想继续确认|接下来想看看)$/u.test(
    visibleThinkingSummary.trim()
  )) {
    issues.push("thinking_summary_is_incomplete_sentence");
  }
  if (
    turn.semanticPlan.action === "ask" &&
    /(?:我想|想继续|想确认|想看看|我会继续|接下来|下一步).{0,24}(?:问|确认|厘清|看看|追|了解|聚焦|处理)/u.test(
      visibleThinkingSummary
    )
  ) {
    issues.push("thinking_summary_describes_next_action");
  }
  if (
    turn.semanticPlan.action === "ask" &&
    /(?:这一点|这个信息|这条线索|这里)(?:很重要|值得继续|值得关注|和当前话题有关|还有继续了解的价值)(?:[，,。！!；;]|$)/u.test(
      visibleThinkingSummary.trim()
    )
  ) {
    issues.push("thinking_summary_value_is_generic");
  }
  if (/不是.{1,40}而是/u.test([
    turn.visibleTurn.thinkingSummary,
    turn.visibleTurn.question,
    turn.visibleTurn.insight
  ].filter(Boolean).join("\n"))) {
    issues.push("visible_turn_must_not_erase_coexisting_evidence");
  }

  return { passed: issues.length === 0, issues: [...new Set(issues)] };
}

export function isEventCenteredCognitiveAction(
  value: string | null
): value is EventCenteredCognitiveAction {
  return EVENT_CENTERED_COGNITIVE_ACTIONS.some((action) => action === value);
}

export function validateEventCenteredEvidenceQuotes(
  decision: EventCenteredUnderstandingDecision,
  rawText: string
) {
  const factsAreGrounded = decision.facts.every((fact) => rawText.includes(fact.quote));
  if (!factsAreGrounded) return false;
  if (decision.eventBoundary === "multiple_events") {
    return inspectEventCenteredFocusOptions({
      rawText,
      options: decision.eventOptions ?? []
    }).passed;
  }
  return (decision.eventOptions ?? []).every((option) => rawText.includes(option.sourceText));
}

export function validateEventCenteredHypothesisAlignment(input: {
  decision: EventCenteredUnderstandingDecision;
  response: EventCenteredNaturalResponse;
}) {
  const expected = input.decision.unsupportedHypothesis?.statement ?? null;
  return expected === input.response.hypothesisStatement;
}

export function validateEventCenteredOutcomeAlignment(input: {
  decision: EventCenteredUnderstandingDecision;
  response: EventCenteredNaturalResponse;
}) {
  const expected = input.decision.outcomeCandidate?.statement ?? null;
  return expected === input.response.outcomeStatement;
}

/**
 * 用户可见的理解层负责承接，提问只由自然回应和对应的纸笺动作承担。
 * 这层校验放在结构化输出之后，避免模型把第二个问题藏进理解层。
 */
export function validateEventCenteredResponsePresentation(input: {
  response: EventCenteredNaturalResponse;
  directive: Pick<EventCenteredAssistantPayload, "responseKind" | "questionSpec" | "checkpoint">;
}) {
  const understandingHasQuestion = /[？?]/u.test(input.response.naturalUnderstanding);
  const responseQuestionCount = (input.response.naturalResponse.match(/[？?]/gu) ?? []).length;
  const isPaperSelection = input.directive.responseKind === "clarification" &&
    input.directive.questionSpec?.surfaceLevel === "low_pressure_choice";
  const selectionActionInBody = /(请选择|选(?:择|哪|一件)|点击|继续补充|直接生成)/u.test(
    input.response.naturalResponse
  );

  if (understandingHasQuestion || responseQuestionCount > 1) return false;
  if (input.directive.checkpoint && responseQuestionCount > 0) return false;
  if (isPaperSelection && (responseQuestionCount > 0 || selectionActionInBody)) return false;
  return true;
}
