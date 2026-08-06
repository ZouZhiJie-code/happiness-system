import { z } from "zod";

import {
  EVENT_CENTERED_DIALOGUE_PHASES,
  EVENT_CENTERED_QUESTION_SURFACES,
  EVENT_CENTERED_RESPONSE_KINDS,
  type EventCenteredAllowedAction,
  type EventCenteredAssistantPayload,
  type EventCenteredCheckpoint,
  type EventCenteredCurrentQuestionIntent,
  type EventCenteredDialogueState,
  type EventCenteredProgressItem
} from "@/types/event-centered-dialogue";
import { JOURNAL_EVENT_ANGLES } from "@/types/journal-event-angle-outcome";
import { EVENT_CENTERED_COGNITIVE_ACTIONS } from "@/features/interview/event-centered/generative-strategy";
import {
  isEventCenteredThoughtOnlyScope
} from "@/features/interview/event-centered-release";
import {
  THOUGHT_DIRECTIONS,
  THOUGHT_PROBE_OPERATIONS,
  THOUGHT_TARGET_STATUSES,
  createInitialThoughtProtocol
} from "@/features/interview/event-centered/thought-judgment-map";

const angleSchema = z.enum(JOURNAL_EVENT_ANGLES);

const angleRunStateSchema = z.object({
  status: z.enum(["available", "active", "completed", "reopened", "closed"]),
  questionOpportunityCount: z.number().int().min(0).max(3),
  // 历史快照可能包含该字段；MVP 已停止为新会话写入。
  lowPressureAnchorUsed: z.boolean().optional(),
  currentOutcomeId: z.string().nullable(),
  answeredTargets: z.array(z.string()).default([]),
  askedTargets: z.array(z.string()).default([]),
  deniedTargets: z.array(z.string()).default([])
}).strict();

export const eventCenteredQuestionStateSchema = z.object({
  opportunityNumber: z.number().int().min(1).max(3),
  angle: angleSchema.nullable(),
  target: z.string().trim().min(1),
  surfaceLevel: z.enum(EVENT_CENTERED_QUESTION_SURFACES),
  repairCount: z.number().int().min(0).max(3),
  assistantMessageId: z.string().nullable(),
  cognitiveAction: z.enum(EVENT_CENTERED_COGNITIVE_ACTIONS).nullable().optional()
}).strict();

export const eventCenteredCurrentQuestionIntentSchema = z.object({
  targetId: z.string().trim().min(1),
  semanticGoal: z.string().trim().min(1),
  minimumAnswerScope: z.string().trim().min(1).nullable()
}).strict();

const thoughtDirectionSchema = z.enum(THOUGHT_DIRECTIONS);
const thoughtSignatureSchema = z.object({
  direction: thoughtDirectionSchema,
  operation: z.enum(THOUGHT_PROBE_OPERATIONS),
  coreConditionKey: z.string().trim().min(1).max(160),
  expectedRelation: z.string().trim().min(1).max(160)
}).strict();
const thoughtQuestionPlanSchema = z.object({
  action: z.enum(["ask", "transition", "stop", "fail"]),
  direction: thoughtDirectionSchema.nullable(),
  operation: z.enum(THOUGHT_PROBE_OPERATIONS).nullable(),
  signature: thoughtSignatureSchema.nullable(),
  sourceRefs: z.array(z.string().trim().min(1)).max(12),
  knownAnswerRefs: z.array(z.string().trim().min(1)).max(12),
  expectedDelta: z.string().trim().min(1).max(240).nullable(),
  summaryJob: z.string().trim().min(1).max(280).nullable(),
  questionJob: z.string().trim().min(1).max(280).nullable(),
  routeReason: z.string().trim().min(1).max(160),
  planHash: z.string().trim().min(1).max(160)
}).strict();
const thoughtTargetSchema = z.object({
  status: z.enum(THOUGHT_TARGET_STATUSES),
  sourceRefs: z.array(z.string().trim().min(1)).max(24),
  relationKey: z.string().trim().min(1).max(240).nullable(),
  updatedAtTurnId: z.string().trim().min(1).max(160).nullable()
}).strict();
const thoughtProtocolSchema = z.object({
  version: z.literal(2),
  targets: z.object(Object.fromEntries(
    THOUGHT_DIRECTIONS.map((direction) => [direction, thoughtTargetSchema])
  ) as Record<(typeof THOUGHT_DIRECTIONS)[number], typeof thoughtTargetSchema>).strict(),
  currentDirection: thoughtDirectionSchema.nullable(),
  directionBaselineRefs: z.array(z.string().trim().min(1)).max(24),
  directionQuestionCount: z.number().int().min(0).max(3),
  currentPlan: thoughtQuestionPlanSchema.nullable(),
  validQuestionSignatures: z.array(thoughtSignatureSchema).max(80),
  resolvedDemands: z.array(z.object({
    demandKey: z.string().trim().min(1).max(360),
    direction: thoughtDirectionSchema,
    status: z.enum(["answered", "denied", "premise_rejected"]),
    sourceRefs: z.array(z.string().trim().min(1)).max(24),
    resolvedAtTurnId: z.string().trim().min(1).max(160)
  }).strict()).max(80),
  explainReasonUsedDirections: z.array(thoughtDirectionSchema).max(7),
  lowPressureRetryUsedDirections: z.array(thoughtDirectionSchema).max(7),
  insightIncrements: z.array(z.object({
    kind: z.enum(["user_new_relation", "ai_safe_relation", "correction_update"]),
    direction: thoughtDirectionSchema,
    sourceRefs: z.array(z.string().trim().min(1)).max(12),
    relationKey: z.string().trim().min(1).max(240),
    outcomeId: z.string().trim().min(1).max(160).nullable()
  }).strict()).max(80),
  openExplorationCount: z.number().int().min(0).max(2),
  invalidatedSourceRefs: z.array(z.string().trim().min(1)).max(80),
  invalidatedRelationKeys: z.array(z.string().trim().min(1)).max(80),
  invalidatedOutcomeIds: z.array(z.string().trim().min(1)).max(80),
  routeSignals: z.object({
    dualEvidence: z.boolean(),
    competingGoals: z.boolean(),
    explicitRuleOrAssumption: z.boolean(),
    newEvidenceOrUncertainty: z.boolean(),
    sourceRefs: z.array(z.string().trim().min(1)).max(24),
    conditionKeys: z.array(z.string().trim().min(1).max(160)).max(12)
  }).strict()
}).strict();

export const eventCenteredDialogueStateSchema = z.object({
  kind: z.literal("event_centered"),
  schemaVersion: z.literal(4),
  phase: z.enum(EVENT_CENTERED_DIALOGUE_PHASES),
  /** 第一检查点只在事件和个人反应都已具备时开放角度选择。 */
  reflectionReady: z.boolean().default(false),
  activeAngle: angleSchema.nullable(),
  lastCompletedAngle: angleSchema.nullable(),
  lightAnchorOpportunityCount: z.number().int().min(0).max(1),
  angleRuns: z.object({
    feeling: angleRunStateSchema.optional(),
    thought: angleRunStateSchema.optional(),
    relationship: angleRunStateSchema.optional(),
    action: angleRunStateSchema.optional()
  }).strict(),
  currentQuestion: eventCenteredQuestionStateSchema.nullable(),
  currentQuestionIntent: eventCenteredCurrentQuestionIntentSchema.nullable().default(null),
  focusOptions: z.array(z.object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    sourceText: z.string().trim().min(1)
  }).strict()).max(2).default([]),
  focusSummary: z.string(),
  pendingUnderstandingClaimId: z.string().nullable(),
  pendingAngleOutcomeRepairIds: z.array(z.string()),
  repairPendingAngles: z.array(angleSchema),
  lastProcessedTurnId: z.string().nullable(),
  strategyMode: z.enum(["baseline", "generative"]).default("baseline"),
  strategyVersion: z.string().nullable().default(null),
  currentMicrogoal: z.object({
    id: z.string().trim().min(1),
    angle: angleSchema,
    statement: z.string().trim().min(1),
    questionCount: z.number().int().min(0).max(3),
    answerCount: z.number().int().min(0).max(3).default(0),
    status: z.enum(["active", "completed", "closed"]),
    evidenceRefs: z.array(z.string())
  }).strict().nullable().default(null),
  thoughtProtocol: thoughtProtocolSchema.nullable().default(null),
  protocolDiagnostics: z.array(z.string().trim().min(1).max(160)).max(24).default([])
}).strict();

const questionSpecSchema = z.object({
  phase: z.enum(EVENT_CENTERED_DIALOGUE_PHASES),
  angle: angleSchema.nullable(),
  target: z.string().trim().min(1),
  opportunityNumber: z.number().int().min(1).max(3).nullable(),
  surfaceLevel: z.enum(EVENT_CENTERED_QUESTION_SURFACES),
  anchorText: z.string().nullable(),
  repairCount: z.number().int().min(0).max(3),
  cognitiveAction: z.enum(EVENT_CENTERED_COGNITIVE_ACTIONS).nullable().optional()
}).strict();

const checkpointSchema = z.object({
  kind: z.enum(["first", "second"]),
  outcome: z.string().nullable()
}).strict();

const visibleAngleOutcomeSchema = z.object({
  angle: angleSchema,
  kind: z.enum(["insight", "honest_limit"]),
  statement: z.string().trim().min(1)
}).strict();

export const eventCenteredAssistantPayloadSchema = z.object({
  naturalUnderstanding: z.string(),
  naturalResponse: z.string(),
  responseKind: z.enum(EVENT_CENTERED_RESPONSE_KINDS),
  questionSpec: questionSpecSchema.nullable(),
  checkpoint: checkpointSchema.nullable(),
  angleOutcome: visibleAngleOutcomeSchema.nullable(),
  presentation: z.enum(["visible", "hidden"]).default("visible")
}).strict();

export function createInitialEventCenteredDialogueState(): EventCenteredDialogueState {
  return {
    kind: "event_centered",
    schemaVersion: 4,
    phase: "event_recording",
    reflectionReady: false,
    activeAngle: null,
    lastCompletedAngle: null,
    lightAnchorOpportunityCount: 0,
    angleRuns: Object.fromEntries(
      JOURNAL_EVENT_ANGLES.map((angle) => [
        angle,
        {
          status: "available" as const,
          questionOpportunityCount: 0,
          currentOutcomeId: null,
          answeredTargets: [],
          askedTargets: [],
          deniedTargets: []
        }
      ])
    ),
    currentQuestion: null,
    currentQuestionIntent: null,
    focusOptions: [],
    focusSummary: "",
    pendingUnderstandingClaimId: null,
    pendingAngleOutcomeRepairIds: [],
    repairPendingAngles: [],
    lastProcessedTurnId: null,
    strategyMode: "baseline",
    strategyVersion: null,
    currentMicrogoal: null,
    thoughtProtocol: isEventCenteredThoughtOnlyScope()
      ? createInitialThoughtProtocol()
      : null,
    protocolDiagnostics: []
  };
}

export function parseEventCenteredDialogueState(value: unknown): EventCenteredDialogueState {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  // T1-03 stores fact clarification state beside the dialogue fields. Select only
  // the fields owned by this protocol so those independent guards stay intact.
  const candidate = Object.fromEntries([
    "kind",
    "schemaVersion",
    "phase",
    "reflectionReady",
    "activeAngle",
    "lastCompletedAngle",
    "lightAnchorOpportunityCount",
    "angleRuns",
    "currentQuestion",
    "currentQuestionIntent",
    "focusOptions",
    "focusSummary",
    "pendingUnderstandingClaimId",
    "pendingAngleOutcomeRepairIds",
    "repairPendingAngles",
    "lastProcessedTurnId",
    "strategyMode",
    "strategyVersion",
    "currentMicrogoal",
    "thoughtProtocol",
    "protocolDiagnostics"
  ].filter((key) => key in source).map((key) => [key, source[key]]));
  const normalizedFromV3 = candidate.schemaVersion === 3;
  if (normalizedFromV3) candidate.schemaVersion = 4;
  if (!("thoughtProtocol" in candidate)) {
    candidate.thoughtProtocol = isEventCenteredThoughtOnlyScope()
      ? createInitialThoughtProtocol()
      : null;
  }
  candidate.protocolDiagnostics = [
    ...(Array.isArray(candidate.protocolDiagnostics) ? candidate.protocolDiagnostics : []),
    ...(normalizedFromV3 ? ["dialogue_snapshot_v3_normalized_to_v4"] : [])
  ];
  const angleRuns = candidate.angleRuns && typeof candidate.angleRuns === "object" && !Array.isArray(candidate.angleRuns)
    ? candidate.angleRuns as Record<string, unknown>
    : null;
  let clampedLegacyQuestionCount = false;
  if (angleRuns) {
    for (const run of Object.values(angleRuns)) {
      if (!run || typeof run !== "object" || Array.isArray(run)) continue;
      const mutableRun = run as Record<string, unknown>;
      if (typeof mutableRun.questionOpportunityCount === "number" && mutableRun.questionOpportunityCount > 3) {
        mutableRun.questionOpportunityCount = 3;
        clampedLegacyQuestionCount = true;
      }
    }
  }
  const question = candidate.currentQuestion && typeof candidate.currentQuestion === "object" && !Array.isArray(candidate.currentQuestion)
    ? candidate.currentQuestion as Record<string, unknown>
    : null;
  if (question && typeof question.opportunityNumber === "number" && question.opportunityNumber > 3) {
    question.opportunityNumber = 3;
    clampedLegacyQuestionCount = true;
  }
  const protocol = candidate.thoughtProtocol && typeof candidate.thoughtProtocol === "object" && !Array.isArray(candidate.thoughtProtocol)
    ? candidate.thoughtProtocol as Record<string, unknown>
    : null;
  if (protocol?.version === 1) {
    protocol.version = 2;
    protocol.resolvedDemands = [];
    candidate.protocolDiagnostics = [
      ...(candidate.protocolDiagnostics as string[]),
      "thought_protocol_v1_normalized_to_v2"
    ];
  }
  if (protocol && typeof protocol.directionQuestionCount === "number" && protocol.directionQuestionCount > 3) {
    protocol.directionQuestionCount = 3;
    clampedLegacyQuestionCount = true;
  }
  if (clampedLegacyQuestionCount) {
    candidate.protocolDiagnostics = [
      ...(candidate.protocolDiagnostics as string[]),
      "legacy_question_count_clamped"
    ];
  }
  // 历史快照的第一检查点在 GI-055 前默认已经展示角度卡。恢复时继续
  // 保持原会话可操作；新的会话只会在门槛满足后写入该字段。
  if (!("reflectionReady" in candidate) && candidate.phase === "checkpoint_one") {
    candidate.reflectionReady = true;
  }
  let parsed = eventCenteredDialogueStateSchema.safeParse(candidate);
  if (!parsed.success && isEventCenteredThoughtOnlyScope()) {
    candidate.thoughtProtocol = createInitialThoughtProtocol();
    candidate.protocolDiagnostics = [
      ...(Array.isArray(candidate.protocolDiagnostics) ? candidate.protocolDiagnostics : []),
      "thought_protocol_invalid_reinitialized"
    ];
    parsed = eventCenteredDialogueStateSchema.safeParse(candidate);
  }
  if (!parsed.success) {
    let recovered = createInitialEventCenteredDialogueState();
    for (const [key, value] of Object.entries(candidate)) {
      if (key === "kind" || key === "schemaVersion" || key === "protocolDiagnostics") continue;
      const trial = eventCenteredDialogueStateSchema.safeParse({
        ...recovered,
        [key]: value
      });
      if (trial.success) recovered = trial.data;
    }
    recovered.protocolDiagnostics = [
      ...new Set([
        ...recovered.protocolDiagnostics,
        "dialogue_snapshot_partial_recovery"
      ])
    ].slice(-24);
    return recovered;
  }
  if (
    !parsed.data.currentQuestion ||
    parsed.data.currentQuestionIntent?.targetId !== parsed.data.currentQuestion.target
  ) {
    parsed.data.currentQuestionIntent = null;
  }
  return parsed.data;
}

export function validateEventCenteredDialogueStateForCommit(value: unknown) {
  return eventCenteredDialogueStateSchema.parse(value);
}

export function getEventCenteredCurrentQuestionIntent(
  state: EventCenteredDialogueState
): EventCenteredCurrentQuestionIntent | null {
  if (
    !state.currentQuestion ||
    state.currentQuestionIntent?.targetId !== state.currentQuestion.target
  ) {
    return null;
  }
  return state.currentQuestionIntent;
}

export function serializeEventCenteredAssistantPayload(payload: EventCenteredAssistantPayload) {
  return JSON.stringify(eventCenteredAssistantPayloadSchema.parse(payload));
}

export function parseEventCenteredAssistantPayload(content: string) {
  try {
    const parsed = eventCenteredAssistantPayloadSchema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function getEventCenteredCheckpoint(
  state: EventCenteredDialogueState,
  firstOutcome: string | null = null
): EventCenteredCheckpoint | null {
  if (isEventCenteredThoughtOnlyScope()) return null;
  if (state.phase === "checkpoint_one") return { kind: "first", outcome: firstOutcome };
  if (state.phase === "checkpoint_two") return { kind: "second", outcome: firstOutcome };
  return null;
}

export function getEventCenteredAllowedActions(input: {
  state: EventCenteredDialogueState;
  eventStatus: "active" | "generating" | "completed" | "abandoned" | null;
  hasPendingTurn: boolean;
}): EventCenteredAllowedAction[] {
  if (input.eventStatus === null) {
    return input.hasPendingTurn ? ["resume_turn"] : ["reply"];
  }
  if (input.eventStatus === "generating" || input.eventStatus === "completed" || input.eventStatus === "abandoned") {
    return [];
  }
  if (input.hasPendingTurn) return ["resume_turn", "exit_event"];

  const actions: EventCenteredAllowedAction[] = [
    "correct_understanding",
    "regenerate_response",
    "switch_response_version",
    "exit_event"
  ];
  const thoughtOnly = isEventCenteredThoughtOnlyScope();
  if (!(input.state.phase === "checkpoint_one" && input.state.reflectionReady)) {
    actions.unshift("reply");
  }
  if (input.state.phase === "event_focus_clarification") actions.push("select_current_event");
  if (!thoughtOnly && (
    input.state.phase === "checkpoint_two" ||
    (input.state.phase === "checkpoint_one" && input.state.reflectionReady)
  )) {
    actions.push("select_exploration_angle");
  }
  if (input.state.phase === "checkpoint_two" || input.state.phase === "deep_companionship") {
    if (!thoughtOnly) actions.push("continue_exploration");
  }
  if (
    input.state.phase === "checkpoint_two" ||
    (input.state.phase === "deep_companionship" && input.state.currentQuestion === null)
  ) {
    actions.push("generate_event_journal");
  }
  if (
    thoughtOnly &&
    input.state.reflectionReady &&
    input.state.phase !== "event_recording" &&
    input.state.phase !== "event_focus_clarification" &&
    !actions.includes("generate_event_journal")
  ) {
    actions.push("generate_event_journal");
  }
  return actions;
}

export function getEventCenteredProgress(state: EventCenteredDialogueState): EventCenteredProgressItem[] {
  const rank = state.phase === "event_recording" || state.phase === "event_focus_clarification"
    ? 0
    : state.phase === "checkpoint_one" || state.phase === "guided_reflection"
      ? 1
      : 2;
  const percents = rank === 0
    ? [state.lastProcessedTurnId ? 55 : 0, 0, 0]
    : rank === 1
      ? [100, state.phase === "checkpoint_one" ? 0 : 55, 0]
      : [100, 100, state.phase === "checkpoint_two" ? 0 : 45];
  const items: Array<Pick<EventCenteredProgressItem, "id" | "label" | "detail">> = [
    { id: "record", label: "轻量记录", detail: "辨认这件事" },
    { id: "reflect", label: "引导复盘", detail: "选择角度理解" },
    { id: "deepen", label: "深入探索", detail: "继续陪伴或收束" }
  ];

  return items.map((item, index) => ({
    ...item,
    status: index < rank ? "complete" : index === rank ? "current" : "upcoming",
    percent: percents[index] ?? 0
  }));
}
