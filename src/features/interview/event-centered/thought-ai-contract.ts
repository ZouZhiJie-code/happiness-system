import { z } from "zod";

import {
  THOUGHT_CORRECTION_KINDS,
  THOUGHT_DIRECTIONS,
  THOUGHT_TARGET_STATUSES
} from "@/features/interview/event-centered/thought-judgment-map";

const sourceRefs = z.array(z.string().trim().min(1).max(160)).max(12)
  .superRefine((value, context) => {
    if (new Set(value).size !== value.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "source_refs_must_be_unique" });
    }
  });

const thoughtMapModelUpdateStrictSchema = z.object({
  eventBoundary: z.enum([
    "current_event",
    "background",
    "another_event",
    "multiple_events",
    "unclear"
  ]),
  answerStatus: z.enum([
    "complete",
    "partial",
    "denied",
    "unclear",
    "correction",
    "unrelated"
  ]),
  factDeltas: z.array(z.object({
    statement: z.string().trim().min(1).max(280),
    scope: z.enum(["current_event", "background"]),
    stance: z.enum(["affirmed", "denied", "unknown"]),
    kind: z.enum([
      "event_detail",
      "inner_experience",
      "stated_interpretation",
      "stated_preference",
      "boundary_answer"
    ]),
    quote: z.string().trim().min(1).max(280)
  }).strict()).max(12),
  targetUpdates: z.array(z.object({
    direction: z.enum(THOUGHT_DIRECTIONS),
    status: z.enum(THOUGHT_TARGET_STATUSES).refine(
      (status) => ["partial", "answered", "denied", "unclear"].includes(status),
      "model_target_status_not_writable"
    ).transform((status) => status as "partial" | "answered" | "denied" | "unclear"),
    sourceRefs,
    relationKey: z.string().trim().min(1).max(240).nullable()
  }).strict()).max(7),
  routeSignals: z.object({
    dualEvidence: z.boolean(),
    competingGoals: z.boolean(),
    explicitRuleOrAssumption: z.boolean(),
    newEvidenceOrUncertainty: z.boolean(),
    sourceRefs,
    conditionKeys: z.array(z.string().trim().min(1).max(160)).max(12)
  }).strict(),
  relationCandidate: z.object({
    origin: z.enum(["user_articulated", "ai_synthesized"]),
    direction: z.enum(THOUGHT_DIRECTIONS),
    relationKey: z.string().trim().min(1).max(240),
    sourceRefs: sourceRefs.refine((refs) => refs.length >= 2, "relation_requires_two_sources")
  }).strict().nullable(),
  correction: z.object({
    kind: z.enum(THOUGHT_CORRECTION_KINDS),
    invalidatedSourceRefs: sourceRefs,
    invalidatedRelationKeys: sourceRefs,
    invalidatedOutcomeIds: sourceRefs,
    affectedDirections: z.array(z.enum(THOUGHT_DIRECTIONS)).min(1).max(7)
  }).strict().nullable()
}).strict().superRefine((value, context) => {
  value.factDeltas.forEach((fact, index) => {
    if (!value.factDeltas[index] || !fact.quote) return;
    if (fact.statement.includes("？") || fact.statement.includes("?")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["factDeltas", index, "statement"],
        message: "fact_statement_must_not_be_question"
      });
    }
  });
  if (value.answerStatus === "correction" && !value.correction) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["correction"],
      message: "correction_status_requires_invalidation"
    });
  }
});

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringList(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return typeof value === "string" && value.trim() ? [value] : [];
}

function normalizeDirection(value: unknown) {
  return typeof value === "string" && (THOUGHT_DIRECTIONS as readonly string[]).includes(value)
    ? value
    : null;
}

/** DeepSeek 的 JSON mode 偶尔会把单项数组压成字符串，或使用已知语义别名。 */
export function normalizeThoughtMapProviderOutput(value: unknown) {
  const source = objectValue(value);
  if (!source) return value;
  const allowedTopLevelKeys = new Set([
    "eventBoundary",
    "answerStatus",
    "factDeltas",
    "targetUpdates",
    "routeSignals",
    "relationCandidate",
    "correction"
  ]);
  const forbiddenTopLevelFields = Object.fromEntries(
    Object.entries(source).filter(([key]) => !allowedTopLevelKeys.has(key))
  );
  const boundaryAliases: Record<string, string> = {
    current: "current_event",
    event: "current_event",
    当前事件: "current_event",
    背景: "background",
    其他事件: "another_event",
    多个事件: "multiple_events",
    不清楚: "unclear"
  };
  const answerAliases: Record<string, string> = {
    answered: "complete",
    complete_answer: "complete",
    partly_answered: "partial",
    unknown: "unclear",
    declined: "denied",
    corrected: "correction",
    irrelevant: "unrelated"
  };
  const kindAliases: Record<string, string> = {
    judgment: "stated_interpretation",
    decision: "stated_interpretation",
    thought: "stated_interpretation",
    interpretation: "stated_interpretation",
    subjective_judgment: "stated_interpretation",
    reason: "stated_interpretation",
    concern: "inner_experience",
    basis: "stated_interpretation",
    evidence: "event_detail",
    new_evidence: "event_detail",
    observation: "event_detail",
    observable_action: "event_detail",
    factual: "event_detail",
    event: "event_detail",
    feeling: "inner_experience",
    preference: "stated_preference",
    boundary: "boundary_answer"
  };
  const statusAliases: Record<string, string> = {
    complete: "answered",
    answered: "answered",
    partial: "partial",
    denied: "denied",
    declined: "denied",
    unknown: "unclear",
    unclear: "unclear"
  };
  const rawTargets = Array.isArray(source.targetUpdates)
    ? source.targetUpdates
    : objectValue(source.targetUpdates)
      ? Object.entries(objectValue(source.targetUpdates)!).map(([direction, target]) => ({
          direction,
          ...(objectValue(target) ?? {})
        }))
      : [];
  const targetUpdates = rawTargets.flatMap((target) => {
    const item = objectValue(target);
    const direction = normalizeDirection(item?.direction);
    if (!item || !direction) return [];
    const rawStatus = typeof item.status === "string" ? item.status : "partial";
    return [{
      direction,
      status: statusAliases[rawStatus] ?? rawStatus,
      sourceRefs: stringList(item.sourceRefs),
      relationKey: typeof item.relationKey === "string" ? item.relationKey : null
    }];
  });
  const rawRoute = objectValue(source.routeSignals) ?? {};
  const rawRelation = objectValue(source.relationCandidate);
  const relationDirection = normalizeDirection(rawRelation?.direction);
  const relationOrigin = rawRelation?.origin === "user_articulated" ||
    rawRelation?.origin === "ai_synthesized"
    ? rawRelation.origin
    : null;
  const relationCandidate = rawRelation && relationDirection && relationOrigin &&
    typeof rawRelation.relationKey === "string"
    ? {
        origin: relationOrigin,
        direction: relationDirection,
        relationKey: rawRelation.relationKey,
        sourceRefs: stringList(rawRelation.sourceRefs)
      }
    : null;
  const rawCorrection = objectValue(source.correction);
  return {
    ...forbiddenTopLevelFields,
    eventBoundary: typeof source.eventBoundary === "string"
      ? boundaryAliases[source.eventBoundary] ?? source.eventBoundary
      : "unclear",
    answerStatus: typeof source.answerStatus === "string"
      ? answerAliases[source.answerStatus] ?? source.answerStatus
      : "unrelated",
    factDeltas: (Array.isArray(source.factDeltas) ? source.factDeltas : []).flatMap((fact) => {
      const item = objectValue(fact);
      if (!item) return [];
      return [{
        statement: item.statement,
        scope: item.scope === "background" ? "background" : "current_event",
        stance: item.stance === "denied" || item.stance === "unknown"
          ? item.stance
          : "affirmed",
        kind: typeof item.kind === "string"
          ? kindAliases[item.kind] ?? (
              [
                "event_detail",
                "inner_experience",
                "stated_interpretation",
                "stated_preference",
                "boundary_answer"
              ].includes(item.kind)
                ? item.kind
                : "stated_interpretation"
            )
          : "event_detail",
        quote: item.quote
      }];
    }),
    targetUpdates,
    routeSignals: {
      dualEvidence: rawRoute.dualEvidence === true,
      competingGoals: rawRoute.competingGoals === true,
      explicitRuleOrAssumption: rawRoute.explicitRuleOrAssumption === true,
      newEvidenceOrUncertainty: rawRoute.newEvidenceOrUncertainty === true,
      sourceRefs: stringList(rawRoute.sourceRefs),
      conditionKeys: stringList(rawRoute.conditionKeys)
    },
    relationCandidate,
    correction: rawCorrection
      ? {
          kind: THOUGHT_CORRECTION_KINDS.includes(rawCorrection.kind as (typeof THOUGHT_CORRECTION_KINDS)[number])
            ? rawCorrection.kind
            : "fact_or_judgment",
          invalidatedSourceRefs: stringList(rawCorrection.invalidatedSourceRefs),
          invalidatedRelationKeys: stringList(rawCorrection.invalidatedRelationKeys),
          invalidatedOutcomeIds: stringList(rawCorrection.invalidatedOutcomeIds),
          affectedDirections: stringList(rawCorrection.affectedDirections)
            .map(normalizeDirection).filter(Boolean)
        }
      : null
  };
}

export const thoughtMapModelUpdateSchema = z.preprocess(
  normalizeThoughtMapProviderOutput,
  thoughtMapModelUpdateStrictSchema
);

export const thoughtQuestionExpressionSchema = z.object({
  thinkingSummary: z.string().trim().min(4).max(280),
  question: z.string().trim().min(4).max(280)
}).strict().superRefine((value, context) => {
  if (!/[？?]$/u.test(value.question)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["question"],
      message: "formal_question_requires_question_mark"
    });
  }
  if (/[？?]/u.test(value.thinkingSummary)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["thinkingSummary"],
      message: "thinking_summary_must_not_be_question"
    });
  }
});

export type ThoughtMapProviderOutput = z.infer<typeof thoughtMapModelUpdateSchema>;
export type ThoughtQuestionExpression = z.infer<typeof thoughtQuestionExpressionSchema>;
