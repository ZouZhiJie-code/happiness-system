import { z } from "zod";

import {
  interviewAnsweredTargetSchema,
  interviewOperationRequestSchema,
  type IntentAssessmentV1
} from "@/features/interview/intent/intent-v1";
import type {
  AssistantQuestionSpec,
  InterviewDimension,
  JoySnapshot
} from "@/types/interview";

export const LEGACY_TRUSTED_UNDERSTANDING_VERSION = "trusted-understanding-v1" as const;
export const TRUSTED_UNDERSTANDING_VERSION = "trusted-understanding-v2" as const;
export const TURN_UNDERSTANDING_RESULT_VERSION = "turn-understanding-v2" as const;

export const materialStatusSchema = z.enum([
  "explicit_confirmed",
  "contextual_confirmed",
  "pending_inference",
  "retracted"
]);
export const answerStateSchema = z.enum([
  "answered",
  "explicit_absence",
  "recall_unavailable",
  "uncertain",
  "declined",
  "unaddressed"
]);
export const eventRelationSchema = z.enum([
  "current_detail",
  "linked_scene",
  "candidate_event",
  "incidental"
]);
export const eventRelationshipSchema = z.enum([
  "cause",
  "consequence",
  "contrast",
  "example"
]);
export const materialKindSchema = z.enum([
  "event",
  "person",
  "feeling",
  "reason",
  "judgment",
  "action",
  "correction"
]);
export const materialUpdateActionSchema = z.enum([
  "add",
  "refine",
  "replace",
  "retract",
  "confirm",
  "keep"
]);
const dimensionSchema = z.enum([
  "joy",
  "fulfillment",
  "reflection",
  "improvement",
  "gratitude"
]);

export const contentUnderstandingUnitCandidateSchema = z
  .object({
    kind: materialKindSchema,
    text: z.string().min(1).max(240),
    evidenceText: z.string().min(1).max(320).nullable(),
    fields: z.array(z.string().min(1).max(48)).max(12).default([]),
    materialStatus: z.enum([
      "explicit_confirmed",
      "contextual_confirmed",
      "pending_inference"
    ]),
    eventRelation: eventRelationSchema,
    relationship: eventRelationshipSchema.nullable().default(null),
    candidateDimension: dimensionSchema.nullable().default(null),
    historyRelation: z
      .enum([
        "new",
        "supplement",
        "explicit_replace",
        "explicit_retract",
        "ambiguous_conflict",
        "confirm_pending"
      ])
      .optional(),
    relatedMaterialIds: z.array(z.string().min(1)).max(24).optional()
  })
  .strict();

const targetResponseCandidateSchema = z
  .object({
    target: interviewAnsweredTargetSchema,
    state: answerStateSchema,
    evidenceText: z.string().min(1).max(500),
    materialIndexes: z.array(z.number().int().nonnegative()).max(10).default([])
  })
  .strict();

export const contentUnderstandingCandidateSchema = z
  .object({
    units: z.array(contentUnderstandingUnitCandidateSchema).max(10).default([]),
    answerState: answerStateSchema.default("unaddressed"),
    answeredTarget: interviewAnsweredTargetSchema.nullable().default(null),
    targetResponses: z.array(targetResponseCandidateSchema).max(12).optional(),
    candidateDimensions: z.array(dimensionSchema).max(5).default([])
  })
  .strict();

const trustedMaterialSchema = z
  .object({
    id: z.string().min(1),
    kind: materialKindSchema,
    text: z.string().min(1).max(240),
    evidenceText: z.string().min(1).max(500).nullable(),
    evidenceStart: z.number().int().nonnegative().nullable().default(null),
    evidenceEnd: z.number().int().positive().nullable().default(null),
    fields: z.array(z.string().min(1).max(48)).max(12),
    status: materialStatusSchema,
    eventRelation: eventRelationSchema,
    relationship: eventRelationshipSchema.nullable(),
    candidateDimension: dimensionSchema.nullable(),
    sourceTurnId: z.string().min(1),
    sourceMessageSequence: z.number().int().nonnegative(),
    supersedes: z.array(z.string().min(1)).max(24),
    relatedMaterialIds: z.array(z.string().min(1)).max(24).default([]),
    updatedByTurnId: z.string().min(1)
  })
  .strict();

const targetStateRecordSchema = z
  .object({
    target: interviewAnsweredTargetSchema,
    state: answerStateSchema,
    evidenceText: z.string().max(500).nullable(),
    sourceTurnId: z.string().min(1),
    attempts: z.number().int().positive(),
    history: z.array(z.object({
      state: answerStateSchema,
      evidenceText: z.string().max(500).nullable(),
      sourceTurnId: z.string().min(1)
    }).strict()).max(24).default([])
  })
  .strict();

const materialUpdateSchema = z
  .object({
    action: materialUpdateActionSchema,
    materialId: z.string().min(1).nullable(),
    fields: z.array(z.string().min(1).max(48)).max(12),
    previousMaterialIds: z.array(z.string().min(1)).max(24)
  })
  .strict();

const targetResponseSchema = z
  .object({
    target: interviewAnsweredTargetSchema,
    state: answerStateSchema,
    evidenceText: z.string().min(1).max(500),
    evidenceStart: z.number().int().nonnegative(),
    evidenceEnd: z.number().int().positive(),
    materialIds: z.array(z.string().min(1)).max(24)
  })
  .strict();

const understandingConflictSchema = z
  .object({
    id: z.string().min(1),
    kind: z.literal("ambiguous_conflict"),
    activeMaterialIds: z.array(z.string().min(1)).min(1).max(24),
    candidateMaterialId: z.string().min(1),
    evidenceText: z.string().min(1).max(500),
    status: z.enum(["awaiting_confirmation", "resolved", "dismissed"]),
    resolvedByTurnId: z.string().min(1).nullable()
  })
  .strict();

const unresolvedSegmentSchema = z
  .object({
    text: z.string().min(1).max(500),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    reason: z.enum(["incomplete", "ambiguous", "provider_unavailable", "unsupported_evidence"])
  })
  .strict();

const understandingRiskSchema = z
  .object({
    code: z.enum([
      "incomplete_expression",
      "ambiguous_target",
      "ambiguous_conflict",
      "provider_unavailable",
      "unsupported_evidence"
    ]),
    evidenceText: z.string().max(500).nullable(),
    detail: z.string().min(1).max(240)
  })
  .strict();

const candidateEventSchema = z
  .object({
    id: z.string().min(1),
    summary: z.string().min(1).max(240),
    evidenceText: z.string().min(1).max(500).nullable(),
    sourceTurnId: z.string().min(1),
    candidateDimension: dimensionSchema.nullable(),
    revisited: z.boolean()
  })
  .strict();

const lastTurnUnderstandingSchema = z
  .object({
    turnId: z.string().min(1),
    answerState: answerStateSchema,
    answeredTarget: interviewAnsweredTargetSchema.nullable(),
    targetResponses: z.array(targetResponseSchema).max(12).default([]),
    operationRequests: z.array(interviewOperationRequestSchema).max(16).default([]),
    updates: z.array(materialUpdateSchema).max(40),
    conflicts: z.array(understandingConflictSchema).max(12).default([]),
    unresolvedSegments: z.array(unresolvedSegmentSchema).max(12).default([]),
    risks: z.array(understandingRiskSchema).max(12).default([]),
    journalMaterialsChanged: z.boolean().default(false)
  })
  .strict();

export const trustedUnderstandingStateSchema = z
  .object({
    version: z.union([
      z.literal(LEGACY_TRUSTED_UNDERSTANDING_VERSION),
      z.literal(TRUSTED_UNDERSTANDING_VERSION)
    ]),
    eventId: z.string().min(1),
    dimension: dimensionSchema,
    materials: z.array(trustedMaterialSchema).max(240),
    targetStates: z.record(z.string(), targetStateRecordSchema),
    candidateEvents: z.array(candidateEventSchema).max(24),
    candidateDimensions: z.array(dimensionSchema).max(5),
    conflicts: z.array(understandingConflictSchema).max(48).default([]),
    appliedTurnIds: z.array(z.string().min(1)).max(240).default([]),
    lastAppliedMessageSequence: z.number().int().min(-1).default(-1),
    risks: z.array(understandingRiskSchema).max(48).default([]),
    lastTurn: lastTurnUnderstandingSchema.nullable()
  })
  .strict();

const turnMaterialUnitSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum([
      "event",
      "person",
      "feeling",
      "reason",
      "judgment",
      "action",
      "next_attempt",
      "correction"
    ]),
    text: z.string().min(1).max(240),
    evidenceText: z.string().min(1).max(500).nullable(),
    evidenceStart: z.number().int().nonnegative().nullable(),
    evidenceEnd: z.number().int().positive().nullable(),
    fields: z.array(z.string().min(1).max(48)).max(12),
    trustStatus: z.enum([
      "explicit_confirmed",
      "contextual_confirmed",
      "pending_confirmation",
      "retracted"
    ]),
    eventRelation: eventRelationSchema,
    relationship: eventRelationshipSchema.nullable(),
    candidateDimension: dimensionSchema.nullable(),
    relatedMaterialIds: z.array(z.string().min(1)).max(24)
  })
  .strict();

export const turnUnderstandingResultV2Schema = z
  .object({
    version: z.literal(TURN_UNDERSTANDING_RESULT_VERSION),
    turnId: z.string().min(1),
    eventId: z.string().min(1),
    dimension: dimensionSchema,
    sourceMessageSequence: z.number().int().nonnegative(),
    operationRequests: z.array(interviewOperationRequestSchema).max(16),
    materialUnits: z.array(turnMaterialUnitSchema).max(40),
    targetResponses: z.array(targetResponseSchema).max(12),
    updateRecords: z.array(materialUpdateSchema).max(40),
    conflicts: z.array(understandingConflictSchema).max(12),
    candidateEvents: z.array(candidateEventSchema).max(24),
    candidateDimensions: z.array(dimensionSchema).max(5),
    unresolvedSegments: z.array(unresolvedSegmentSchema).max(12),
    risks: z.array(understandingRiskSchema).max(12),
    journalMaterialsChanged: z.boolean().default(false)
  })
  .strict();

export type MaterialStatus = z.infer<typeof materialStatusSchema>;
export type AnswerState = z.infer<typeof answerStateSchema>;
export type EventRelation = z.infer<typeof eventRelationSchema>;
export type MaterialUpdateAction = z.infer<typeof materialUpdateActionSchema>;
export type ContentUnderstandingCandidate = z.infer<typeof contentUnderstandingCandidateSchema>;
export type TrustedUnderstandingState = z.infer<typeof trustedUnderstandingStateSchema>;
export type TrustedMaterial = z.infer<typeof trustedMaterialSchema>;
export type TrustedMaterialUpdate = z.infer<typeof materialUpdateSchema>;
export type TargetResponse = z.infer<typeof targetResponseSchema>;
export type UnderstandingConflict = z.infer<typeof understandingConflictSchema>;
export type TurnUnderstandingResultV2 = z.infer<typeof turnUnderstandingResultV2Schema>;

export type ContentUnderstandingMode = "legacy" | "shadow" | "enforce";

export function getContentUnderstandingMode(): ContentUnderstandingMode {
  const value = process.env.INTERVIEW_CONTENT_UNDERSTANDING_MODE?.trim().toLowerCase();
  return value === "shadow" || value === "enforce" ? value : "legacy";
}

export function isTurnUnderstandingV2Enabled(userId?: string | null) {
  const selectedVersion = process.env.INTERVIEW_UNDERSTANDING_VERSION?.trim();
  if (selectedVersion === "2") return true;
  if (selectedVersion === "1") {
    const selectedUsers = new Set(
      (process.env.INTERVIEW_UNDERSTANDING_V2_USER_IDS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    );
    return Boolean(userId && selectedUsers.has(userId));
  }
  const selectedUsers = new Set(
    (process.env.INTERVIEW_UNDERSTANDING_V2_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  return Boolean(userId && selectedUsers.has(userId));
}

export function parseTrustedUnderstandingState(value: unknown) {
  const parsed = trustedUnderstandingStateSchema.safeParse(value);
  return parsed.success
    ? {
        ...parsed.data,
        version: TRUSTED_UNDERSTANDING_VERSION
      } satisfies TrustedUnderstandingState
    : null;
}

export function parseTurnUnderstandingResult(value: unknown) {
  const parsed = turnUnderstandingResultV2Schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function createEmptyTrustedUnderstandingState(input: {
  eventId: string;
  dimension: InterviewDimension;
}): TrustedUnderstandingState {
  return {
    version: TRUSTED_UNDERSTANDING_VERSION,
    eventId: input.eventId,
    dimension: input.dimension,
    materials: [],
    targetStates: {},
    candidateEvents: [],
    candidateDimensions: [],
    conflicts: [],
    appliedTurnIds: [],
    lastAppliedMessageSequence: -1,
    risks: [],
    lastTurn: null
  };
}

const RECALL_UNAVAILABLE_PATTERN =
  /(?:想不起来|记不起来|一时想不起|记不清|回忆不起来|脑子里没有画面)/u;

function normalizeText(value: string | null | undefined) {
  return value?.replace(/\s+/gu, " ").trim() ?? "";
}

function includesEvidence(rawText: string, evidenceText: string | null | undefined) {
  const raw = normalizeText(rawText);
  const evidence = normalizeText(evidenceText);
  return Boolean(evidence && (raw.includes(evidence) || raw.replace(/\s/gu, "").includes(evidence.replace(/\s/gu, ""))));
}

function findEvidenceRange(rawText: string, evidenceText: string | null | undefined) {
  const evidence = normalizeText(evidenceText);
  if (!evidence) return null;
  const directStart = rawText.indexOf(evidence);
  if (directStart >= 0) {
    return { start: directStart, end: directStart + evidence.length };
  }
  const compactRaw = rawText.replace(/\s/gu, "");
  const compactEvidence = evidence.replace(/\s/gu, "");
  const compactStart = compactRaw.indexOf(compactEvidence);
  if (compactStart < 0) return null;
  let compactIndex = 0;
  let start = 0;
  while (start < rawText.length && compactIndex < compactStart) {
    if (!/\s/u.test(rawText[start] ?? "")) compactIndex += 1;
    start += 1;
  }
  let end = start;
  let matched = 0;
  while (end < rawText.length && matched < compactEvidence.length) {
    if (!/\s/u.test(rawText[end] ?? "")) matched += 1;
    end += 1;
  }
  return { start, end };
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function getQuestionTarget(questionSpec: AssistantQuestionSpec | null | undefined) {
  return questionSpec?.subTarget ?? questionSpec?.target ?? null;
}

function getMaterialFieldsForAnswerTarget(
  dimension: InterviewDimension,
  target: string | null
) {
  if (!target) return [];
  const directTargets: Record<string, string[]> = {
    kind_action: ["kindAction"],
    seen_need: ["seenNeed"],
    gratitude_reason: ["gratitudeReason"],
    relationship_signal: ["relationshipSignal"]
  };
  if (directTargets[target]) return directTargets[target];

  const byDimension: Record<
    InterviewDimension,
    Record<string, string[]>
  > = {
    joy: {
      event_anchor: ["joyMoment"],
      reaction_evidence: ["stateShift"],
      prior_assumption: ["joySource", "meaningNeed"],
      insight_evidence: ["joySource", "meaningNeed"],
      judgment_clue: ["manualClue", "delightSignature", "directionSignal"]
    },
    fulfillment: {
      event_anchor: ["experience"],
      reaction_evidence: ["feeling"],
      prior_assumption: ["progressEvidence"],
      insight_evidence: ["progressEvidence"],
      judgment_clue: ["valueSignal"]
    },
    reflection: {
      event_anchor: ["event"],
      reaction_evidence: ["feeling"],
      prior_assumption: ["whyItMattered"],
      insight_evidence: ["whyItMattered"],
      judgment_clue: ["selfPattern"]
    },
    improvement: {
      event_anchor: ["situation"],
      reaction_evidence: ["feeling", "stateAssessment"],
      prior_assumption: ["frictionPoint", "repeatCondition"],
      insight_evidence: ["frictionPoint", "repeatCondition"],
      judgment_clue: ["controllableFactor", "nextAttempt", "successSignal"]
    },
    gratitude: {
      event_anchor: ["gratitudeMoment", "kindAction"],
      reaction_evidence: ["innerEffect", "seenNeed"],
      prior_assumption: ["gratitudeReason"],
      insight_evidence: ["gratitudeReason"],
      judgment_clue: ["relationshipSignal"]
    }
  };

  return byDimension[dimension][target] ?? [];
}

export function deriveAnswerState(input: {
  rawText: string;
  intent: IntentAssessmentV1;
  candidate?: ContentUnderstandingCandidate | null;
}): AnswerState {
  if (input.intent.dialogueActs.includes("decline_answer")) return "declined";
  if (RECALL_UNAVAILABLE_PATTERN.test(input.rawText)) return "recall_unavailable";
  if (input.intent.content.explicitAbsence) return "explicit_absence";
  if (input.intent.dialogueActs.includes("express_uncertainty")) return "uncertain";
  if (input.candidate) return input.candidate.answerState;
  if (input.intent.content.presence === "clear") return "answered";
  return "unaddressed";
}

function getSnapshotFields(dimension: InterviewDimension, snapshot: JoySnapshot) {
  switch (dimension) {
    case "joy":
      return {
        joyMoment: snapshot.joyMoment ?? snapshot.event,
        joySource: snapshot.joySource ?? snapshot.whyItMattered,
        stateShift: snapshot.stateShift ?? snapshot.feeling,
        meaningNeed: snapshot.meaningNeed ?? null,
        manualClue: snapshot.manualClue ?? snapshot.selfPattern,
        delightSignature: snapshot.delightSignature ?? null,
        directionSignal: snapshot.directionSignal ?? snapshot.happinessType,
        valueImpact: snapshot.valueImpact ?? null,
        durability: snapshot.durability ?? null
      };
    case "fulfillment":
      return {
        experience: snapshot.event,
        feeling: snapshot.feeling,
        progressEvidence: snapshot.whyItMattered,
        fulfillmentType: snapshot.happinessType,
        valueSignal: snapshot.selfPattern
      };
    case "reflection":
      return {
        event: snapshot.event,
        feeling: snapshot.feeling,
        whyItMattered: snapshot.whyItMattered,
        happinessType: snapshot.happinessType,
        selfPattern: snapshot.selfPattern
      };
    case "improvement":
      return {
        situation: snapshot.event,
        improvementTrack: snapshot.improvementTrack ?? null,
        stateAssessment: snapshot.stateAssessment ?? null,
        feeling: snapshot.feeling,
        improvementType: snapshot.happinessType,
        frictionPoint: snapshot.frictionPoint ?? null,
        repeatCondition: snapshot.repeatCondition ?? null,
        controllableFactor: snapshot.controllableFactor ?? null,
        nextAttempt: snapshot.nextAttempt ?? snapshot.selfPattern,
        successSignal: snapshot.successSignal ?? null
      };
    case "gratitude":
      return {
        gratitudeMoment: snapshot.gratitudeMoment ?? snapshot.event,
        gratitudeTarget: snapshot.gratitudeTarget ?? null,
        kindAction: snapshot.kindAction ?? null,
        seenNeed: snapshot.seenNeed ?? null,
        innerEffect: snapshot.innerEffect ?? snapshot.feeling,
        gratitudeReason: snapshot.gratitudeReason ?? snapshot.whyItMattered,
        gratitudeType: snapshot.gratitudeType ?? snapshot.happinessType,
        relationshipSignal: snapshot.relationshipSignal ?? snapshot.selfPattern,
        reciprocityHint: snapshot.reciprocityHint ?? null
      };
  }
}

function inferMaterialKind(field: string): TrustedMaterial["kind"] {
  if (/(moment|experience|event|trigger|situation)/iu.test(field)) return "event";
  if (/(target|person)/iu.test(field)) return "person";
  if (/(feeling|shift|effect|stateAssessment)/iu.test(field)) return "feeling";
  if (/(attempt|factor|action|signal)/iu.test(field)) return "action";
  if (/(reason|source|need|evidence|friction|condition)/iu.test(field)) return "reason";
  return "judgment";
}

const MATERIAL_FIELD_ALIASES: Record<
  InterviewDimension,
  Record<string, string>
> = {
  joy: {
    event: "joyMoment",
    joyMoment: "joyMoment",
    feeling: "stateShift",
    stateShift: "stateShift",
    whyItMattered: "joySource",
    joySource: "joySource",
    selfPattern: "manualClue",
    manualClue: "manualClue",
    happinessType: "directionSignal",
    directionSignal: "directionSignal"
  },
  fulfillment: {
    event: "experience",
    experience: "experience",
    feeling: "feeling",
    whyItMattered: "progressEvidence",
    progressEvidence: "progressEvidence",
    happinessType: "fulfillmentType",
    fulfillmentType: "fulfillmentType",
    selfPattern: "valueSignal",
    valueSignal: "valueSignal"
  },
  reflection: {
    event: "event",
    trigger: "event",
    feeling: "feeling",
    whyItMattered: "whyItMattered",
    insight: "whyItMattered",
    happinessType: "happinessType",
    reflectionType: "happinessType",
    selfPattern: "selfPattern",
    viewpointShift: "selfPattern"
  },
  improvement: {
    event: "situation",
    situation: "situation",
    feeling: "feeling",
    happinessType: "improvementType",
    improvementType: "improvementType",
    selfPattern: "nextAttempt",
    nextAttempt: "nextAttempt"
  },
  gratitude: {
    event: "gratitudeMoment",
    moment: "gratitudeMoment",
    gratitudeMoment: "gratitudeMoment",
    feeling: "innerEffect",
    innerEffect: "innerEffect",
    whyItMattered: "gratitudeReason",
    gratitudeReason: "gratitudeReason",
    happinessType: "gratitudeType",
    gratitudeType: "gratitudeType",
    selfPattern: "relationshipSignal",
    relationshipSignal: "relationshipSignal"
  }
};

function normalizeMaterialFields(dimension: InterviewDimension, fields: string[]) {
  return unique(fields.map((field) => MATERIAL_FIELD_ALIASES[dimension][field] ?? field));
}

function deriveRemovedFields(input: {
  dimension: InterviewDimension;
  previousSnapshot: JoySnapshot;
  nextSnapshot: JoySnapshot;
}) {
  const previous = getSnapshotFields(input.dimension, input.previousSnapshot) as Record<string, unknown>;
  const next = getSnapshotFields(input.dimension, input.nextSnapshot) as Record<string, unknown>;
  return Object.keys(previous).filter(
    (field) =>
      previous[field] !== null &&
      previous[field] !== undefined &&
      previous[field] !== "" &&
      (next[field] === null || next[field] === undefined || next[field] === "")
  );
}

function deriveChangedUnits(input: {
  dimension: InterviewDimension;
  previousSnapshot: JoySnapshot;
  nextSnapshot: JoySnapshot;
  rawText: string;
  intentEvidenceText: string | null;
  contextualShortAnswer: boolean;
}) {
  const previous = getSnapshotFields(input.dimension, input.previousSnapshot) as Record<string, unknown>;
  const next = getSnapshotFields(input.dimension, input.nextSnapshot) as Record<string, unknown>;

  return Object.entries(next).flatMap(([field, value]) => {
    if (value == null || value === "" || value === previous[field]) return [];
    const text = typeof value === "string" ? value : String(value);
    const grounded = includesEvidence(input.rawText, text);
    const contextual = input.contextualShortAnswer;
    return [{
      kind: inferMaterialKind(field),
      text,
      evidenceText: grounded || contextual ? (input.intentEvidenceText ?? input.rawText) : null,
      fields: [field],
      status: grounded
        ? "explicit_confirmed" as const
        : contextual
          ? "contextual_confirmed" as const
          : "pending_inference" as const,
      eventRelation: "current_detail" as const,
      relationship: null,
      candidateDimension: null
    }];
  });
}

function normalizeCandidateUnit(input: {
  dimension: InterviewDimension;
  unit: ContentUnderstandingCandidate["units"][number];
  rawText: string;
  intent: IntentAssessmentV1;
}) {
  const grounded = includesEvidence(input.rawText, input.unit.evidenceText);
  const contextual = input.intent.reasonCodes.includes("contextual_short_answer");
  const status: MaterialStatus =
    input.unit.materialStatus === "pending_inference" || (!grounded && !contextual)
      ? "pending_inference"
      : contextual || input.unit.materialStatus === "contextual_confirmed"
        ? "contextual_confirmed"
        : "explicit_confirmed";

  const evidenceRange = grounded
    ? findEvidenceRange(input.rawText, input.unit.evidenceText)
    : contextual
      ? { start: 0, end: input.rawText.length }
      : null;

  return {
    ...input.unit,
    text: normalizeText(input.unit.text),
    evidenceText: grounded
      ? normalizeText(input.unit.evidenceText)
      : contextual
        ? normalizeText(input.rawText)
        : null,
    fields: normalizeMaterialFields(input.dimension, input.unit.fields),
    status,
    evidenceStart: evidenceRange?.start ?? null,
    evidenceEnd: evidenceRange?.end ?? null
  };
}

const AMBIGUOUS_CONFLICT_PATTERN =
  /(?:可能|也许|大概|好像|似乎|说不准|不完全|不一定|也不全是|未必|可能也不)/u;

function isAmbiguousConflictExpression(rawText: string) {
  return AMBIGUOUS_CONFLICT_PATTERN.test(rawText) &&
    !/(刚才说错了|前面说错了|我改一下|更准确地说|应该说|其实是|你理解错了|理解偏了|我收回)/u.test(rawText);
}

function normalizeAnswerTarget(
  target: z.infer<typeof interviewAnsweredTargetSchema>,
  questionSpec: AssistantQuestionSpec | null | undefined
) {
  return target === "current_question" ? getQuestionTarget(questionSpec) : target;
}

function buildTargetResponses(input: {
  rawText: string;
  intent: IntentAssessmentV1;
  candidate?: ContentUnderstandingCandidate | null;
  questionSpec?: AssistantQuestionSpec | null;
  userTurnId: string;
}) {
  const contextual = input.intent.reasonCodes.includes("contextual_short_answer");
  const candidateResponses = input.candidate?.targetResponses ?? [];
  const normalized: TargetResponse[] = [];

  for (const response of candidateResponses) {
    if (response.state === "unaddressed") continue;
    const target = normalizeAnswerTarget(response.target, input.questionSpec);
    if (!target) continue;
    const range = findEvidenceRange(input.rawText, response.evidenceText);
    if (!range && !contextual) continue;
    normalized.push({
      target,
      state: response.state,
      evidenceText: range ? response.evidenceText : input.rawText,
      evidenceStart: range?.start ?? 0,
      evidenceEnd: range?.end ?? input.rawText.length,
      materialIds: response.materialIndexes.map((index) => `${input.userTurnId}:${index}`)
    });
  }

  const fallbackState = deriveAnswerState({
    rawText: input.rawText,
    intent: input.intent,
    candidate: input.candidate
  });
  const fallbackTarget = normalizeAnswerTarget(
    input.candidate?.answeredTarget ?? input.intent.content.answeredTarget ?? "current_question",
    input.questionSpec
  );
  if (fallbackTarget && fallbackState !== "unaddressed" && !normalized.some((item) => item.target === fallbackTarget)) {
    const evidenceText = input.intent.content.evidenceText ?? normalizeText(input.rawText);
    const range = findEvidenceRange(input.rawText, evidenceText) ?? {
      start: 0,
      end: input.rawText.length
    };
    normalized.push({
      target: fallbackTarget,
      state: fallbackState,
      evidenceText: evidenceText || input.rawText,
      evidenceStart: range.start,
      evidenceEnd: range.end,
      materialIds: []
    });
  }

  const byTarget = new Map<string, TargetResponse>();
  for (const response of normalized.sort(
    (left, right) => left.evidenceStart - right.evidenceStart || left.evidenceEnd - right.evidenceEnd
  )) {
    byTarget.set(response.target, response);
  }
  return Array.from(byTarget.values());
}

function isActiveMaterial(material: TrustedMaterial) {
  return material.status !== "retracted";
}

function closeConflictsForRetractedMaterials(
  conflicts: UnderstandingConflict[],
  materialIds: ReadonlySet<string>,
  turnId: string
) {
  if (!materialIds.size) return conflicts;
  return conflicts.map((conflict) =>
    conflict.status === "awaiting_confirmation" &&
    (
      materialIds.has(conflict.candidateMaterialId) ||
      conflict.activeMaterialIds.some((id) => materialIds.has(id))
    )
      ? { ...conflict, status: "dismissed" as const, resolvedByTurnId: turnId }
      : conflict
  );
}

export function buildTrustedUnderstandingUpdate(input: {
  eventId: string;
  dimension: InterviewDimension;
  userTurnId: string;
  sourceMessageSequence: number;
  rawText: string;
  intent: IntentAssessmentV1;
  questionSpec?: AssistantQuestionSpec | null;
  previousSnapshot: JoySnapshot;
  nextSnapshot: JoySnapshot;
  previousState?: TrustedUnderstandingState | null;
  candidate?: ContentUnderstandingCandidate | null;
}) {
  const previous =
    input.previousState?.eventId === input.eventId && input.previousState.dimension === input.dimension
      ? input.previousState
      : createEmptyTrustedUnderstandingState({ eventId: input.eventId, dimension: input.dimension });
  if (previous.appliedTurnIds.includes(input.userTurnId) || previous.lastTurn?.turnId === input.userTurnId) {
    return {
      state: previous,
      turn: previous.lastTurn,
      result: null,
      activeMaterials: previous.materials.filter(
        (material) =>
          (material.status === "explicit_confirmed" || material.status === "contextual_confirmed") &&
          (material.eventRelation === "current_detail" || material.eventRelation === "linked_scene")
      )
    };
  }
  const targetResponses = buildTargetResponses({
    rawText: input.rawText,
    intent: input.intent,
    candidate: input.candidate,
    questionSpec: input.questionSpec,
    userTurnId: input.userTurnId
  });
  const primaryTargetResponse = targetResponses[0] ?? null;
  const answerState = primaryTargetResponse?.state ?? "unaddressed";
  const answeredTarget = primaryTargetResponse?.target ?? null;
  const targetStates = { ...previous.targetStates };

  for (const response of targetResponses) {
    const prior = targetStates[response.target];
    targetStates[response.target] = {
      target: response.target,
      state: response.state,
      evidenceText: response.evidenceText,
      sourceTurnId: input.userTurnId,
      attempts: prior?.state === response.state ? prior.attempts + 1 : 1,
      history: [
        ...(prior?.history ?? []),
        {
          state: response.state,
          evidenceText: response.evidenceText,
          sourceTurnId: input.userTurnId
        }
      ].slice(-24)
    };
  }

  const candidateUnits = input.candidate?.units.map((unit) =>
    normalizeCandidateUnit({
      dimension: input.dimension,
      unit,
      rawText: input.rawText,
      intent: input.intent
    })
  ) ?? [];
  const coveredFields = new Set(candidateUnits.flatMap((unit) => unit.fields));
  const fallbackUnits = deriveChangedUnits({
    dimension: input.dimension,
    previousSnapshot: input.previousSnapshot,
    nextSnapshot: input.nextSnapshot,
    rawText: input.rawText,
    intentEvidenceText: input.intent.content.evidenceText,
    contextualShortAnswer: input.intent.reasonCodes.includes("contextual_short_answer")
  })
    .filter((unit) => unit.fields.every((field) => !coveredFields.has(field)))
    .map((unit) => {
      const evidenceRange = findEvidenceRange(input.rawText, unit.evidenceText);
      return {
        ...unit,
        evidenceStart: evidenceRange?.start ?? null,
        evidenceEnd: evidenceRange?.end ?? null,
        historyRelation: "new" as const,
        relatedMaterialIds: []
      };
    });
  const units = [...candidateUnits, ...fallbackUnits];
  const correcting =
    input.intent.dialogueActs.includes("correct_previous") ||
    input.intent.dialogueActs.includes("deny_hypothesis");
  let materials = previous.materials.map((material) => ({ ...material }));
  const updates: TrustedMaterialUpdate[] = [];
  let conflicts = previous.conflicts.map((conflict) => ({ ...conflict }));
  const previousConflictsById = new Map(previous.conflicts.map((conflict) => [conflict.id, conflict]));
  const removedFields = correcting
    ? deriveRemovedFields({
        dimension: input.dimension,
        previousSnapshot: input.previousSnapshot,
        nextSnapshot: input.nextSnapshot
      })
    : [];
  if (removedFields.length) {
    const removedMaterials = materials.filter(
      (material) =>
        isActiveMaterial(material) &&
        material.fields.some((field) => removedFields.includes(field))
    );
    const removedMaterialIds = new Set(removedMaterials.map((material) => material.id));
    materials = materials.map((material) =>
      removedMaterialIds.has(material.id)
        ? { ...material, status: "retracted" as const, updatedByTurnId: input.userTurnId }
        : material
    );
    conflicts = closeConflictsForRetractedMaterials(
      conflicts,
      removedMaterialIds,
      input.userTurnId
    );
    for (const material of removedMaterials) {
      updates.push({
        action: "retract",
        materialId: null,
        fields: material.fields,
        previousMaterialIds: [material.id]
      });
    }
  }

  units.forEach((unit, index) => {
    if (!unit.text) return;
    const id = `${input.userTurnId}:${index}`;
    if (materials.some((material) => material.id === id)) return;
    const relatedIds = new Set(unit.relatedMaterialIds ?? []);
    const fieldOverlapping = materials.filter(
      (material) =>
        isActiveMaterial(material) &&
        material.fields.some((field) => unit.fields.includes(field)) &&
        material.eventRelation === unit.eventRelation
    );
    const explicitlyReferenced = fieldOverlapping.filter((material) =>
      includesEvidence(input.rawText, material.text)
    );
    const overlapping = relatedIds.size
      ? fieldOverlapping.filter((material) => relatedIds.has(material.id))
      : explicitlyReferenced.length
        ? explicitlyReferenced
        : fieldOverlapping;
    const pendingToConfirm = materials.filter(
      (material) =>
        material.status === "pending_inference" &&
        (relatedIds.has(material.id) || overlapping.some((item) => item.id === material.id))
    );
    if (unit.historyRelation === "confirm_pending" && pendingToConfirm.length) {
      const confirmedIds = new Set(pendingToConfirm.map((material) => material.id));
      const supersededIds = new Set(
        conflicts
          .filter(
            (conflict) =>
              conflict.status === "awaiting_confirmation" &&
              confirmedIds.has(conflict.candidateMaterialId)
          )
          .flatMap((conflict) => conflict.activeMaterialIds)
      );
      materials = materials.map((material) =>
        confirmedIds.has(material.id)
          ? {
              ...material,
              status: "explicit_confirmed" as const,
              supersedes: unique([...material.supersedes, ...supersededIds]),
              updatedByTurnId: input.userTurnId
            }
          : supersededIds.has(material.id)
            ? {
                ...material,
                status: "retracted" as const,
                updatedByTurnId: input.userTurnId
              }
          : material
      );
      conflicts = conflicts.map((conflict) =>
        confirmedIds.has(conflict.candidateMaterialId) && conflict.status === "awaiting_confirmation"
          ? { ...conflict, status: "resolved" as const, resolvedByTurnId: input.userTurnId }
          : conflict
      );
      for (const material of pendingToConfirm) {
        updates.push({
          action: "confirm",
          materialId: material.id,
          fields: material.fields,
          previousMaterialIds: [material.id, ...supersededIds]
        });
      }
      return;
    }

    if (unit.historyRelation === "explicit_retract" && overlapping.length) {
      const retractIds = new Set(overlapping.map((material) => material.id));
      materials = materials.map((material) =>
        retractIds.has(material.id)
          ? { ...material, status: "retracted" as const, updatedByTurnId: input.userTurnId }
          : material
      );
      conflicts = closeConflictsForRetractedMaterials(conflicts, retractIds, input.userTurnId);
      for (const material of overlapping) {
        updates.push({
          action: "retract",
          materialId: null,
          fields: material.fields,
          previousMaterialIds: [material.id]
        });
      }
      return;
    }

    const same = overlapping.find((material) => material.text === unit.text);
    const ambiguousConflict =
      overlapping.length > 0 &&
      !same &&
      !correcting &&
      (unit.historyRelation === "ambiguous_conflict" || isAmbiguousConflictExpression(input.rawText));
    const action: MaterialUpdateAction = same
      ? "keep"
      : overlapping.length
        ? correcting || unit.historyRelation === "explicit_replace"
          ? "replace"
          : "refine"
        : "add";

    if (action === "replace" && overlapping.length) {
      const overlapIds = new Set(overlapping.map((material) => material.id));
      materials = materials.map((material) =>
        overlapIds.has(material.id)
          ? { ...material, status: "retracted" as const, updatedByTurnId: input.userTurnId }
          : material
      );
      conflicts = closeConflictsForRetractedMaterials(conflicts, overlapIds, input.userTurnId);
    }

    if (action === "keep") {
      updates.push({
        action,
        materialId: same?.id ?? null,
        fields: unit.fields,
        previousMaterialIds: same ? [same.id] : []
      });
      return;
    }

    const material: TrustedMaterial = {
      id,
      kind: unit.kind,
      text: unit.text,
      evidenceText: unit.evidenceText,
      evidenceStart: unit.evidenceStart,
      evidenceEnd: unit.evidenceEnd,
      fields: unit.fields,
      status: ambiguousConflict ? "pending_inference" : unit.status,
      eventRelation: unit.eventRelation,
      relationship: unit.relationship,
      candidateDimension: unit.candidateDimension,
      sourceTurnId: input.userTurnId,
      sourceMessageSequence: input.sourceMessageSequence,
      supersedes: action === "replace" ? overlapping.map((item) => item.id) : [],
      relatedMaterialIds: unique([
        ...(unit.relatedMaterialIds ?? []),
        ...(ambiguousConflict ? overlapping.map((item) => item.id) : [])
      ]),
      updatedByTurnId: input.userTurnId
    };
    materials.push(material);
    updates.push({
      action,
      materialId: material.id,
      fields: material.fields,
      previousMaterialIds: overlapping.map((item) => item.id)
    });
    if (ambiguousConflict) {
      conflicts.push({
        id: `conflict:${input.userTurnId}:${index}`,
        kind: "ambiguous_conflict",
        activeMaterialIds: overlapping.map((item) => item.id),
        candidateMaterialId: material.id,
        evidenceText: unit.evidenceText ?? input.rawText,
        status: "awaiting_confirmation",
        resolvedByTurnId: null
      });
    }
  });

  if (correcting && units.length === 0) {
    const answeredTargetFields = getMaterialFieldsForAnswerTarget(input.dimension, answeredTarget);
    const pendingToRetract = materials.filter(
      (material) =>
        material.status === "pending_inference" &&
        (!answeredTarget ||
          answeredTargetFields.length === 0 ||
          material.fields.some((field) => answeredTargetFields.includes(field)))
    );
    const pendingIds = new Set(pendingToRetract.map((material) => material.id));
    materials = materials.map((material) =>
      pendingIds.has(material.id)
        ? { ...material, status: "retracted" as const, updatedByTurnId: input.userTurnId }
        : material
    );
    conflicts = closeConflictsForRetractedMaterials(conflicts, pendingIds, input.userTurnId);
    for (const material of pendingToRetract) {
      updates.push({
        action: "retract",
        materialId: null,
        fields: material.fields,
        previousMaterialIds: [material.id]
      });
    }
  }

  const newCandidateEvents = materials
    .filter(
      (material) =>
        material.sourceTurnId === input.userTurnId &&
        material.eventRelation === "candidate_event" &&
        material.status !== "pending_inference" &&
        material.status !== "retracted"
    )
    .map((material) => ({
      id: material.id,
      summary: material.text,
      evidenceText: material.evidenceText,
      sourceTurnId: material.sourceTurnId,
      candidateDimension: material.candidateDimension,
      revisited: false
    }));
  const activeCandidateMaterialIds = new Set(
    materials
      .filter(
        (material) =>
          material.eventRelation === "candidate_event" &&
          material.status !== "pending_inference" &&
          material.status !== "retracted"
      )
      .map((material) => material.id)
  );
  const candidateEvents = previous.candidateEvents.filter((event) => activeCandidateMaterialIds.has(event.id));
  for (const event of newCandidateEvents) {
    if (!candidateEvents.some((item) => item.id === event.id)) candidateEvents.push(event);
  }
  const candidateDimensions = unique(
    materials.flatMap((material) =>
      material.status !== "pending_inference" &&
      material.status !== "retracted" &&
      material.candidateDimension
        ? [material.candidateDimension]
        : []
    )
  );

  const unresolvedSegments = (() => {
    if (input.intent.reasonCodes.includes("incomplete_utterance")) {
      return [{
        text: input.rawText,
        start: 0,
        end: input.rawText.length,
        reason: "incomplete" as const
      }];
    }
    if (input.intent.origin === "fallback") {
      return [{
        text: input.intent.content.evidenceText ?? input.rawText,
        start: 0,
        end: input.rawText.length,
        reason: "provider_unavailable" as const
      }];
    }
    if (input.intent.content.presence === "clear" && units.length === 0) {
      return [{
        text: input.intent.content.evidenceText ?? input.rawText,
        start: 0,
        end: input.rawText.length,
        reason: "ambiguous" as const
      }];
    }
    return [];
  })();
  const turnConflicts = conflicts.filter((conflict) => {
    const previousConflict = previousConflictsById.get(conflict.id);
    return !previousConflict || JSON.stringify(previousConflict) !== JSON.stringify(conflict);
  });
  const openTurnConflicts = turnConflicts.filter(
    (conflict) => conflict.status === "awaiting_confirmation"
  );
  const risks = [
    ...(unresolvedSegments.length
      ? [{
          code: input.intent.origin === "fallback" ? "provider_unavailable" as const : "incomplete_expression" as const,
          evidenceText: input.rawText,
          detail: input.intent.origin === "fallback"
            ? "语义服务暂时不可用，本轮只保留能够直接确认的内容。"
            : "本轮表达仍有未能可靠归入材料的内容。"
        }]
      : []),
    ...(openTurnConflicts.length
      ? [{
          code: "ambiguous_conflict" as const,
          evidenceText: openTurnConflicts[0]?.evidenceText ?? input.rawText,
          detail: "新表达与已有理解存在含糊冲突，等待用户确认。"
        }]
      : [])
  ];

  let state: TrustedUnderstandingState = {
    ...previous,
    materials: materials.slice(-240),
    targetStates,
    candidateEvents: candidateEvents.slice(-24),
    candidateDimensions,
    conflicts: conflicts.slice(-48),
    appliedTurnIds: [...previous.appliedTurnIds, input.userTurnId].slice(-240),
    lastAppliedMessageSequence: input.sourceMessageSequence,
    risks: [...previous.risks, ...risks].slice(-48),
    lastTurn: {
      turnId: input.userTurnId,
      answerState,
      answeredTarget,
      targetResponses,
      operationRequests: input.intent.operationRequests ?? [],
      updates,
      conflicts: turnConflicts,
      unresolvedSegments,
      risks,
      journalMaterialsChanged: false
    }
  };
  const toJournalSignature = (value: TrustedUnderstandingState) =>
    buildEffectiveUnderstandingView(value, input.dimension).journalMaterials
      .map((material) => `${material.id}:${material.status}:${material.text}`)
      .sort()
      .join("|");
  const journalMaterialsChanged = toJournalSignature(previous) !== toJournalSignature(state);
  state = {
    ...state,
    lastTurn: state.lastTurn
      ? { ...state.lastTurn, journalMaterialsChanged }
      : null
  };

  const turnMaterials = state.materials.filter((material) => material.sourceTurnId === input.userTurnId);
  const result: TurnUnderstandingResultV2 = {
    version: TURN_UNDERSTANDING_RESULT_VERSION,
    turnId: input.userTurnId,
    eventId: input.eventId,
    dimension: input.dimension,
    sourceMessageSequence: input.sourceMessageSequence,
    operationRequests: input.intent.operationRequests ?? [],
    materialUnits: turnMaterials.map((material) => ({
      id: material.id,
      kind: material.kind,
      text: material.text,
      evidenceText: material.evidenceText,
      evidenceStart: material.evidenceStart,
      evidenceEnd: material.evidenceEnd,
      fields: material.fields,
      trustStatus:
        material.status === "pending_inference"
          ? "pending_confirmation"
          : material.status,
      eventRelation: material.eventRelation,
      relationship: material.relationship,
      candidateDimension: material.candidateDimension,
      relatedMaterialIds: material.relatedMaterialIds
    })),
    targetResponses,
    updateRecords: updates,
    conflicts: turnConflicts,
    candidateEvents: newCandidateEvents,
    candidateDimensions: unique(
      turnMaterials.flatMap((material) => material.candidateDimension ? [material.candidateDimension] : [])
    ),
    unresolvedSegments,
    risks,
    journalMaterialsChanged
  };

  return {
    state,
    turn: state.lastTurn,
    result,
    activeMaterials: state.materials.filter(
      (material) =>
        (material.status === "explicit_confirmed" || material.status === "contextual_confirmed") &&
        (material.eventRelation === "current_detail" || material.eventRelation === "linked_scene")
    )
  };
}

export function applyTurnUnderstandingResult(input: {
  previousState?: TrustedUnderstandingState | null;
  result: TurnUnderstandingResultV2;
}) {
  const previous =
    input.previousState?.eventId === input.result.eventId &&
    input.previousState.dimension === input.result.dimension
      ? input.previousState
      : createEmptyTrustedUnderstandingState({
          eventId: input.result.eventId,
          dimension: input.result.dimension
        });
  if (previous.appliedTurnIds.includes(input.result.turnId)) return previous;

  let materials = previous.materials.map((material) => ({ ...material }));
  let conflicts = previous.conflicts.map((conflict) => ({ ...conflict }));
  for (const update of input.result.updateRecords) {
    if (update.action === "replace" || update.action === "retract") {
      const previousIds = new Set(update.previousMaterialIds);
      materials = materials.map((material) =>
        previousIds.has(material.id)
          ? {
              ...material,
              status: "retracted" as const,
              updatedByTurnId: input.result.turnId
            }
          : material
      );
      conflicts = closeConflictsForRetractedMaterials(
        conflicts,
        previousIds,
        input.result.turnId
      );
    }
    if (update.action === "confirm" && update.materialId) {
      const supersededIds = new Set(
        update.previousMaterialIds.filter((id) => id !== update.materialId)
      );
      materials = materials.map((material) =>
        material.id === update.materialId
          ? {
              ...material,
              status: "explicit_confirmed" as const,
              supersedes: unique([...material.supersedes, ...supersededIds]),
              updatedByTurnId: input.result.turnId
            }
          : supersededIds.has(material.id)
            ? {
                ...material,
                status: "retracted" as const,
                updatedByTurnId: input.result.turnId
              }
          : material
      );
      conflicts = conflicts.map((conflict) =>
        conflict.candidateMaterialId === update.materialId &&
        conflict.status === "awaiting_confirmation"
          ? {
              ...conflict,
              status: "resolved" as const,
              resolvedByTurnId: input.result.turnId
            }
          : conflict
      );
    }
  }

  for (const unit of input.result.materialUnits) {
    if (materials.some((material) => material.id === unit.id)) continue;
    materials.push({
      id: unit.id,
      kind: unit.kind === "next_attempt" ? "action" : unit.kind,
      text: unit.text,
      evidenceText: unit.evidenceText,
      evidenceStart: unit.evidenceStart,
      evidenceEnd: unit.evidenceEnd,
      fields: unit.fields,
      status:
        unit.trustStatus === "pending_confirmation"
          ? "pending_inference"
          : unit.trustStatus,
      eventRelation: unit.eventRelation,
      relationship: unit.relationship,
      candidateDimension: unit.candidateDimension,
      sourceTurnId: input.result.turnId,
      sourceMessageSequence: input.result.sourceMessageSequence,
      supersedes: input.result.updateRecords
        .filter((update) => update.materialId === unit.id && update.action === "replace")
        .flatMap((update) => update.previousMaterialIds),
      relatedMaterialIds: unit.relatedMaterialIds,
      updatedByTurnId: input.result.turnId
    });
  }

  const targetStates = { ...previous.targetStates };
  for (const response of input.result.targetResponses) {
    const prior = targetStates[response.target];
    targetStates[response.target] = {
      target: response.target,
      state: response.state,
      evidenceText: response.evidenceText,
      sourceTurnId: input.result.turnId,
      attempts: prior?.state === response.state ? prior.attempts + 1 : 1,
      history: [
        ...(prior?.history ?? []),
        {
          state: response.state,
          evidenceText: response.evidenceText,
          sourceTurnId: input.result.turnId
        }
      ].slice(-24)
    };
  }

  const candidateEvents = [...previous.candidateEvents];
  for (const event of input.result.candidateEvents) {
    if (!candidateEvents.some((item) => item.id === event.id)) candidateEvents.push(event);
  }
  for (const conflict of input.result.conflicts) {
    const index = conflicts.findIndex((item) => item.id === conflict.id);
    if (index >= 0) conflicts[index] = conflict;
    else conflicts.push(conflict);
  }
  const activeCandidateMaterialIds = new Set(
    materials
      .filter(
        (material) =>
          material.eventRelation === "candidate_event" &&
          material.status !== "pending_inference" &&
          material.status !== "retracted"
      )
      .map((material) => material.id)
  );
  const effectiveCandidateEvents = candidateEvents.filter((event) => activeCandidateMaterialIds.has(event.id));
  const candidateDimensions = unique(
    materials.flatMap((material) =>
      material.status !== "pending_inference" &&
      material.status !== "retracted" &&
      material.candidateDimension
        ? [material.candidateDimension]
        : []
    )
  );
  const primary = input.result.targetResponses[0] ?? null;

  return {
    ...previous,
    version: TRUSTED_UNDERSTANDING_VERSION,
    materials: materials.slice(-240),
    targetStates,
    candidateEvents: effectiveCandidateEvents.slice(-24),
    candidateDimensions,
    conflicts: conflicts.slice(-48),
    appliedTurnIds: [...previous.appliedTurnIds, input.result.turnId].slice(-240),
    lastAppliedMessageSequence: input.result.sourceMessageSequence,
    risks: [...previous.risks, ...input.result.risks].slice(-48),
    lastTurn: {
      turnId: input.result.turnId,
      answerState: primary?.state ?? "unaddressed",
      answeredTarget: primary?.target ?? null,
      targetResponses: input.result.targetResponses,
      operationRequests: input.result.operationRequests,
      updates: input.result.updateRecords,
      conflicts: input.result.conflicts,
      unresolvedSegments: input.result.unresolvedSegments,
      risks: input.result.risks,
      journalMaterialsChanged: input.result.journalMaterialsChanged
    }
  } satisfies TrustedUnderstandingState;
}

export function buildEffectiveUnderstandingView(
  state: TrustedUnderstandingState | null | undefined,
  dimension?: InterviewDimension
) {
  const confirmed = (state?.materials ?? []).filter(
    (material) =>
      material.status === "explicit_confirmed" || material.status === "contextual_confirmed"
  );
  const progressMaterials = confirmed.filter(
    (material) =>
      material.eventRelation === "current_detail" || material.eventRelation === "linked_scene"
  );
  const journalMaterials = progressMaterials.filter(
    (material) =>
      material.eventRelation === "current_detail" ||
      (material.eventRelation === "linked_scene" &&
        Boolean(material.relationship) &&
        !(dimension && material.fields.some((field) => CORE_SCENE_FIELDS[dimension].has(field))))
  );
  const pendingMaterials = (state?.materials ?? []).filter(
    (material) => material.status === "pending_inference"
  );

  return {
    progressMaterials,
    questionMaterials: [...progressMaterials, ...pendingMaterials],
    journalMaterials,
    pendingMaterials,
    retractedMaterials: (state?.materials ?? []).filter(
      (material) => material.status === "retracted"
    ),
    targetStates: state?.targetStates ?? {},
    conflicts: state?.conflicts.filter((conflict) => conflict.status === "awaiting_confirmation") ?? [],
    candidateEvents: state?.candidateEvents ?? [],
    candidateDimensions: state?.candidateDimensions ?? [],
    operationRequests: state?.lastTurn?.operationRequests ?? [],
    risks: state?.risks ?? []
  };
}

const SNAPSHOT_FIELD_KEYS: Record<InterviewDimension, Record<string, string[]>> = {
  joy: {
    joyMoment: ["joyMoment", "event"],
    joySource: ["joySource", "whyItMattered"],
    stateShift: ["stateShift", "feeling"],
    meaningNeed: ["meaningNeed"],
    manualClue: ["manualClue", "selfPattern"],
    delightSignature: ["delightSignature"],
    directionSignal: ["directionSignal", "happinessType"],
    valueImpact: ["valueImpact"],
    durability: ["durability"]
  },
  fulfillment: {
    experience: ["event"],
    feeling: ["feeling"],
    progressEvidence: ["whyItMattered"],
    fulfillmentType: ["happinessType"],
    valueSignal: ["selfPattern"]
  },
  reflection: {
    event: ["event"],
    feeling: ["feeling"],
    whyItMattered: ["whyItMattered"],
    happinessType: ["happinessType"],
    selfPattern: ["selfPattern"]
  },
  improvement: {
    situation: ["event"],
    improvementTrack: ["improvementTrack"],
    stateAssessment: ["stateAssessment"],
    feeling: ["feeling"],
    improvementType: ["happinessType"],
    frictionPoint: ["frictionPoint", "whyItMattered"],
    repeatCondition: ["repeatCondition", "whyItMattered"],
    controllableFactor: ["controllableFactor"],
    nextAttempt: ["nextAttempt", "selfPattern"],
    successSignal: ["successSignal"]
  },
  gratitude: {
    gratitudeMoment: ["gratitudeMoment", "event"],
    gratitudeTarget: ["gratitudeTarget"],
    kindAction: ["kindAction"],
    seenNeed: ["seenNeed"],
    innerEffect: ["innerEffect", "feeling"],
    gratitudeReason: ["gratitudeReason", "whyItMattered"],
    gratitudeType: ["gratitudeType", "happinessType"],
    relationshipSignal: ["relationshipSignal", "selfPattern"],
    reciprocityHint: ["reciprocityHint"]
  }
};

export function projectSnapshotFromTrustedUnderstanding(input: {
  dimension: InterviewDimension;
  snapshot: JoySnapshot;
  state?: TrustedUnderstandingState | null;
}) {
  if (!input.state) return input.snapshot;
  const view = buildEffectiveUnderstandingView(input.state, input.dimension);
  const next = { ...input.snapshot } as Record<string, unknown>;
  const managedFields = unique(input.state.materials.flatMap((material) => material.fields));
  const activeByField = new Map<string, TrustedMaterial>();
  for (const material of [...view.progressMaterials].sort(
    (left, right) => left.sourceMessageSequence - right.sourceMessageSequence
  )) {
    if (
      material.eventRelation === "linked_scene" &&
      material.fields.some((field) => CORE_SCENE_FIELDS[input.dimension].has(field))
    ) {
      continue;
    }
    for (const field of material.fields) activeByField.set(field, material);
  }

  for (const field of managedFields) {
    const keys = SNAPSHOT_FIELD_KEYS[input.dimension][field] ?? [field];
    for (const key of keys) next[key] = null;
    const active = activeByField.get(field);
    if (!active) continue;
    for (const key of keys) next[key] = active.text;
  }
  if (input.dimension === "joy" && managedFields.some((field) => [
    "joyMoment",
    "joySource",
    "stateShift",
    "meaningNeed",
    "manualClue",
    "delightSignature"
  ].includes(field))) {
    next.psychProfile = undefined;
  }
  return next as unknown as JoySnapshot;
}

const CORE_SCENE_FIELDS: Record<InterviewDimension, ReadonlySet<string>> = {
  joy: new Set(["event", "joyMoment"]),
  fulfillment: new Set(["event", "experience"]),
  reflection: new Set(["event", "trigger"]),
  improvement: new Set(["event", "situation"]),
  gratitude: new Set(["event", "gratitudeMoment"])
};

export function filterExtractedEvidenceByUnderstanding<T extends object>(input: {
  dimension: InterviewDimension;
  evidence: T;
  candidate?: ContentUnderstandingCandidate | null;
  mode?: ContentUnderstandingMode;
}): T {
  if ((input.mode ?? getContentUnderstandingMode()) !== "enforce" || !input.candidate) {
    return input.evidence;
  }

  const blocked = new Set<string>();
  for (const unit of input.candidate.units) {
    const blocksAll =
      unit.materialStatus === "pending_inference" ||
      unit.eventRelation === "candidate_event" ||
      unit.eventRelation === "incidental";
    for (const field of unit.fields) {
      if (blocksAll || (unit.eventRelation === "linked_scene" && CORE_SCENE_FIELDS[input.dimension].has(field))) {
        blocked.add(field);
      }
    }
  }

  if (!blocked.size) return input.evidence;
  return Object.fromEntries(
    Object.entries(input.evidence).map(([key, value]) => [key, blocked.has(key) ? null : value])
  ) as T;
}

export function getTrustedTargetState(
  state: TrustedUnderstandingState | null | undefined,
  target: string | null | undefined
) {
  return target ? state?.targetStates[target] ?? null : null;
}

export function shouldMoveAwayFromTarget(
  state: TrustedUnderstandingState | null | undefined,
  target: string | null | undefined
) {
  const record = getTrustedTargetState(state, target);
  return Boolean(
    record &&
      (record.state === "explicit_absence" ||
        record.state === "declined" ||
        (record.state === "recall_unavailable" && record.attempts >= 2))
  );
}

export function shouldUseConcreteTargetQuestion(
  state: TrustedUnderstandingState | null | undefined,
  target: string | null | undefined
) {
  const record = getTrustedTargetState(state, target);
  return Boolean(
    record &&
      (record.state === "uncertain" ||
        (record.state === "recall_unavailable" && record.attempts === 1))
  );
}

export function buildTrustedCorrectionAcknowledgement(
  state: TrustedUnderstandingState | null | undefined
) {
  const lastTurn = state?.lastTurn;
  if (!lastTurn?.updates.some((update) => update.action === "replace" || update.action === "retract")) {
    return null;
  }
  const replacement = state?.materials.find(
    (material) =>
      material.sourceTurnId === lastTurn.turnId &&
      material.status !== "pending_inference" &&
      material.status !== "retracted" &&
      material.eventRelation === "current_detail"
  );
  return replacement
    ? `你刚刚把前面的理解修正为：${replacement.text}。`
    : "你刚刚修正了前面的理解，接下来会按这次说明继续。";
}
