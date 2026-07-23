import { z } from "zod";

import { JOURNAL_EVENT_ANGLES } from "@/types/journal-event-angle-outcome";
import type { EventCenteredAssistantPayload } from "@/types/event-centered-dialogue";

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

export function validateEventCenteredEvidenceQuotes(
  decision: EventCenteredUnderstandingDecision,
  rawText: string
) {
  return decision.facts.every((fact) => rawText.includes(fact.quote)) &&
    (decision.eventOptions ?? []).every((option) => rawText.includes(option.sourceText));
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
