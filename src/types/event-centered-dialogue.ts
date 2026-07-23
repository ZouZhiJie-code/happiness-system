import type { JournalEventAngle } from "@/types/journal-event-angle-outcome";
import type {
  EventCenteredSessionIdentity,
  EventCenteredTurnConfirmation,
  JournalEventStatus
} from "@/types/event-centered-interview";

export const EVENT_CENTERED_DIALOGUE_PHASES = [
  "event_recording",
  "event_focus_clarification",
  "checkpoint_one",
  "guided_reflection",
  "checkpoint_two",
  "deep_companionship"
] as const;

export type EventCenteredDialoguePhase = (typeof EVENT_CENTERED_DIALOGUE_PHASES)[number];

export const EVENT_CENTERED_RESPONSE_KINDS = [
  "opening",
  "acknowledgement",
  "question",
  "clarification",
  "angle_outcome",
  "checkpoint",
  "boundary",
  "repair"
] as const;

export type EventCenteredResponseKind = (typeof EVENT_CENTERED_RESPONSE_KINDS)[number];

export const EVENT_CENTERED_QUESTION_SURFACES = [
  "open_anchor",
  "simplified",
  "concrete_anchor",
  "low_pressure_choice"
] as const;

export type EventCenteredQuestionSurface = (typeof EVENT_CENTERED_QUESTION_SURFACES)[number];

export type EventCenteredAngleRunStatus = "available" | "active" | "completed" | "reopened";

/** 两件并列事件时，供用户直接选择的低压力候选。sourceText 必须来自本轮原话。 */
export type EventCenteredFocusOption = {
  id: string;
  label: string;
  sourceText: string;
};

export type EventCenteredQuestionState = {
  opportunityNumber: number;
  angle: JournalEventAngle | null;
  target: string;
  surfaceLevel: EventCenteredQuestionSurface;
  repairCount: number;
  assistantMessageId: string | null;
};

export type EventCenteredAngleRunState = {
  status: EventCenteredAngleRunStatus;
  questionOpportunityCount: number;
  /**
   * V0.11 曾用于“否定后继续追问”的锚点计数。新会话不再写入，
   * 仅保留为历史快照的读取兼容字段。
   */
  lowPressureAnchorUsed?: boolean;
  currentOutcomeId: string | null;
  answeredTargets: string[];
  askedTargets: string[];
};

export type EventCenteredDialogueState = {
  kind: "event_centered";
  schemaVersion: 3;
  phase: EventCenteredDialoguePhase;
  activeAngle: JournalEventAngle | null;
  lastCompletedAngle: JournalEventAngle | null;
  lightAnchorOpportunityCount: number;
  angleRuns: Partial<Record<JournalEventAngle, EventCenteredAngleRunState>>;
  currentQuestion: EventCenteredQuestionState | null;
  focusOptions: EventCenteredFocusOption[];
  focusSummary: string;
  pendingUnderstandingClaimId: string | null;
  pendingAngleOutcomeRepairIds: string[];
  repairPendingAngles: JournalEventAngle[];
  lastProcessedTurnId: string | null;
};

export type EventCenteredQuestionSpec = {
  phase: EventCenteredDialoguePhase;
  angle: JournalEventAngle | null;
  target: string;
  opportunityNumber: number | null;
  surfaceLevel: EventCenteredQuestionSurface;
  anchorText: string | null;
  repairCount: number;
};

export type EventCenteredCheckpoint = {
  kind: "first" | "second";
  outcome: string | null;
};

export type EventCenteredVisibleAngleOutcome = {
  angle: JournalEventAngle;
  kind: "insight" | "honest_limit";
  statement: string;
};

export type EventCenteredAssistantPayload = {
  naturalUnderstanding: string;
  naturalResponse: string;
  responseKind: EventCenteredResponseKind;
  questionSpec: EventCenteredQuestionSpec | null;
  checkpoint: EventCenteredCheckpoint | null;
  angleOutcome: EventCenteredVisibleAngleOutcome | null;
};

export type EventCenteredResponseVersion = {
  groupId: string;
  version: number;
  versionCount: number;
  canRegenerate: boolean;
  canSwitch: boolean;
  versions: Array<{
    messageId: string;
    branchSessionId: string;
    version: number;
    active: boolean;
  }>;
};

export type EventCenteredWorkspaceMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  rawText: string;
  sequence: number;
  userTurnId: string | null;
  assistantPayload: EventCenteredAssistantPayload | null;
  responseVersion: EventCenteredResponseVersion | null;
  createdAt: string;
};

export type EventCenteredProgressItem = {
  id: "record" | "reflect" | "deepen";
  label: "轻量记录" | "引导复盘" | "深入探索";
  status: "current" | "upcoming" | "complete";
  percent: number;
  detail: string;
};

export type EventCenteredAllowedAction =
  | "reply"
  | "select_current_event"
  | "select_exploration_angle"
  | "continue_exploration"
  | "correct_understanding"
  | "regenerate_response"
  | "switch_response_version"
  | "resume_turn"
  | "exit_event"
  | "generate_event_journal";

export type EventCenteredWorkspaceSession = EventCenteredSessionIdentity & {
  messages: EventCenteredWorkspaceMessage[];
  dialogue: {
    phase: EventCenteredDialoguePhase;
    activeAngle: JournalEventAngle | null;
    questionOpportunityCount: number;
    focusOptions: EventCenteredFocusOption[];
    completedAngles: JournalEventAngle[];
    availableAngles: JournalEventAngle[];
    reopenedAngles: JournalEventAngle[];
    outcomes: EventCenteredVisibleAngleOutcome[];
    checkpoint: EventCenteredCheckpoint | null;
    allowedActions: EventCenteredAllowedAction[];
    progress: EventCenteredProgressItem[];
  };
  recovery: {
    pendingTurn: (EventCenteredTurnConfirmation & {
      errorCode: string | null;
      attemptCount: number;
    }) | null;
  };
  journal: {
    status: "not_generated" | "generating" | "draft" | "saved";
    entryId: string | null;
    eventStatus: JournalEventStatus | null;
  };
};

export type EventCenteredRespondAction =
  | "reply"
  | "select_current_event"
  | "select_exploration_angle"
  | "continue_exploration"
  | "correct_understanding"
  | "regenerate_response"
  | "switch_response_version"
  | "resume_turn"
  | "exit_event";

export type EventCenteredRespondRequest = {
  action: EventCenteredRespondAction;
  rootSessionId: string;
  clientTurnId: string;
  baseBranchSessionId?: string;
  baseMessageSequence?: number;
  rawText?: string;
  inputMode?: "text" | "voice";
  targetMessageId?: string;
  targetBranchSessionId?: string;
  angle?: JournalEventAngle;
  optionId?: string;
  regenerationIntent?: "simplify" | "concretize" | "change_angle" | "deepen" | "lighten";
};
