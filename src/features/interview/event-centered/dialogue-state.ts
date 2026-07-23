import { z } from "zod";

import {
  EVENT_CENTERED_DIALOGUE_PHASES,
  EVENT_CENTERED_QUESTION_SURFACES,
  EVENT_CENTERED_RESPONSE_KINDS,
  type EventCenteredAllowedAction,
  type EventCenteredAssistantPayload,
  type EventCenteredCheckpoint,
  type EventCenteredDialogueState,
  type EventCenteredProgressItem
} from "@/types/event-centered-dialogue";
import { JOURNAL_EVENT_ANGLES } from "@/types/journal-event-angle-outcome";

const angleSchema = z.enum(JOURNAL_EVENT_ANGLES);

const angleRunStateSchema = z.object({
  status: z.enum(["available", "active", "completed", "reopened"]),
  questionOpportunityCount: z.number().int().min(0).max(3),
  // 历史快照可能包含该字段；MVP 已停止为新会话写入。
  lowPressureAnchorUsed: z.boolean().optional(),
  currentOutcomeId: z.string().nullable(),
  answeredTargets: z.array(z.string()).default([]),
  askedTargets: z.array(z.string()).default([])
}).strict();

export const eventCenteredQuestionStateSchema = z.object({
  opportunityNumber: z.number().int().min(1).max(3),
  angle: angleSchema.nullable(),
  target: z.string().trim().min(1),
  surfaceLevel: z.enum(EVENT_CENTERED_QUESTION_SURFACES),
  repairCount: z.number().int().min(0).max(3),
  assistantMessageId: z.string().nullable()
}).strict();

export const eventCenteredDialogueStateSchema = z.object({
  kind: z.literal("event_centered"),
  schemaVersion: z.literal(3),
  phase: z.enum(EVENT_CENTERED_DIALOGUE_PHASES),
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
  focusOptions: z.array(z.object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    sourceText: z.string().trim().min(1)
  }).strict()).max(2).default([]),
  focusSummary: z.string(),
  pendingUnderstandingClaimId: z.string().nullable(),
  pendingAngleOutcomeRepairIds: z.array(z.string()),
  repairPendingAngles: z.array(angleSchema),
  lastProcessedTurnId: z.string().nullable()
}).strict();

const questionSpecSchema = z.object({
  phase: z.enum(EVENT_CENTERED_DIALOGUE_PHASES),
  angle: angleSchema.nullable(),
  target: z.string().trim().min(1),
  opportunityNumber: z.number().int().min(1).max(3).nullable(),
  surfaceLevel: z.enum(EVENT_CENTERED_QUESTION_SURFACES),
  anchorText: z.string().nullable(),
  repairCount: z.number().int().min(0).max(3)
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
  angleOutcome: visibleAngleOutcomeSchema.nullable()
}).strict();

export function createInitialEventCenteredDialogueState(): EventCenteredDialogueState {
  return {
    kind: "event_centered",
    schemaVersion: 3,
    phase: "event_recording",
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
          askedTargets: []
        }
      ])
    ),
    currentQuestion: null,
    focusOptions: [],
    focusSummary: "",
    pendingUnderstandingClaimId: null,
    pendingAngleOutcomeRepairIds: [],
    repairPendingAngles: [],
    lastProcessedTurnId: null
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
    "activeAngle",
    "lastCompletedAngle",
    "lightAnchorOpportunityCount",
    "angleRuns",
    "currentQuestion",
    "focusOptions",
    "focusSummary",
    "pendingUnderstandingClaimId",
    "pendingAngleOutcomeRepairIds",
    "repairPendingAngles",
    "lastProcessedTurnId"
  ].filter((key) => key in source).map((key) => [key, source[key]]));
  const parsed = eventCenteredDialogueStateSchema.safeParse(candidate);
  return parsed.success ? parsed.data : createInitialEventCenteredDialogueState();
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
    "reply",
    "correct_understanding",
    "regenerate_response",
    "switch_response_version",
    "exit_event"
  ];
  if (input.state.phase === "event_focus_clarification") actions.push("select_current_event");
  if (input.state.phase === "checkpoint_one" || input.state.phase === "checkpoint_two") {
    actions.push("select_exploration_angle");
  }
  if (input.state.phase === "checkpoint_two" || input.state.phase === "deep_companionship") {
    actions.push("continue_exploration");
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
