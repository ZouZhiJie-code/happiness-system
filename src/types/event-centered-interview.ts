export type JournalEventStatus = "active" | "generating" | "completed" | "abandoned";

export interface JournalEventIdentity {
  id: string;
  entryDate: string;
  daySequence: number;
  status: JournalEventStatus;
  startedAt: string;
  generationStartedAt: string | null;
  completedAt: string | null;
  abandonedAt: string | null;
}

export interface EventCenteredSessionIdentity {
  mode: "event_centered";
  rootSessionId: string;
  activeBranchSessionId: string;
  eventId: string | null;
  branchStateId: string | null;
  entryDate: string;
  conversationSchemaVersion: number;
  sessionStatus: "active" | "completed" | "abandoned";
  eventStatus: JournalEventStatus | null;
  latestMessageSequence: number;
  journalEvent: JournalEventIdentity | null;
}

export interface EventCenteredTurnConfirmation {
  id: string;
  clientTurnId: string;
  sessionId: string;
  rawText: string;
  inputMode: "text" | "voice";
  baseMessageSequence: number;
  status: "processing" | "completed" | "failed" | "canceled";
  createdAt: string;
}

export type EventCenteredUserAction =
  | "reply"
  | "correct_understanding"
  | "select_current_event"
  | "select_exploration_angle"
  | "continue_exploration"
  | "exit_event";

export type EventCenteredOperationData =
  | {
      kind: "select_current_event";
      optionId: string;
      displayText?: string;
    }
  | {
      kind: "select_exploration_angle";
      angle: "feeling" | "thought" | "relationship" | "action";
      displayText?: string;
    }
  | {
      kind: "continue_exploration";
      angle?: "feeling" | "thought" | "relationship" | "action";
      displayText?: string;
    }
  | {
      kind: "exit_event";
      reason?: string;
      displayText?: string;
    };

interface ReserveEventCenteredUserActionBase {
  userId: string;
  rootSessionId: string;
  clientTurnId: string;
  baseMessageSequence: number;
  baseBranchSessionId: string;
}

export type ReserveEventCenteredUserActionInput =
  | (ReserveEventCenteredUserActionBase & {
      action: "reply";
      rawText: string;
      inputMode: "text" | "voice";
      eventOperationData?: never;
    })
  | (ReserveEventCenteredUserActionBase & {
      action: "correct_understanding";
      rawText: string;
      inputMode: "text" | "voice";
      targetMessageId?: string;
      eventOperationData?: never;
    })
  | (ReserveEventCenteredUserActionBase & {
      action: "select_current_event";
      rawText?: string;
      inputMode?: "text" | "voice";
      eventOperationData: Extract<EventCenteredOperationData, { kind: "select_current_event" }>;
    })
  | (ReserveEventCenteredUserActionBase & {
      action: "select_exploration_angle";
      rawText?: string;
      inputMode?: "text" | "voice";
      eventOperationData: Extract<EventCenteredOperationData, { kind: "select_exploration_angle" }>;
    })
  | (ReserveEventCenteredUserActionBase & {
      action: "continue_exploration";
      rawText?: string;
      inputMode?: "text" | "voice";
      eventOperationData: Extract<EventCenteredOperationData, { kind: "continue_exploration" }>;
    })
  | (ReserveEventCenteredUserActionBase & {
      action: "exit_event";
      rawText?: string;
      inputMode?: "text" | "voice";
      eventOperationData: Extract<EventCenteredOperationData, { kind: "exit_event" }>;
    });

export interface EventCenteredWorkspaceMessageData {
  id: string;
  sessionId: string;
  branchSessionId: string;
  userTurnId: string | null;
  clientTurnId?: string | null;
  generationTraceId?: string | null;
  role: "user" | "assistant" | "system";
  inputMode: "text" | "voice" | null;
  content: string;
  rawText: string | null;
  sequence: number;
  responseGroupId: string | null;
  responseVersion: number | null;
  regenerationIntent: "simplify" | "concretize" | "change_angle" | "deepen" | "lighten" | null;
  regeneratedFromMessageId: string | null;
  createdAt: string;
}

export interface EventCenteredSessionTabRecord {
  rootSessionId: string;
  label: string;
  status: "active" | "completed" | "generating" | "abandoned";
}

export interface EventCenteredWorkspacePendingTurn extends EventCenteredTurnConfirmation {
  action: EventCenteredUserAction;
  activeEventId: string | null;
  baseBranchSessionId: string | null;
  targetMessageId: string | null;
  eventOperationData: EventCenteredOperationData | null;
  errorCode: string | null;
  attemptCount: number;
}

export interface EventCenteredWorkspaceJournalEntryData {
  id: string;
  status: "draft" | "saved" | "modified";
  generationVersion: number;
  contentRevision: number;
  savedRevision: number | null;
  updatedAt: string;
}

export interface EventCenteredInterviewWorkspaceData {
  identity: EventCenteredSessionIdentity;
  messages: EventCenteredWorkspaceMessageData[];
  /** All reply versions for a response group present on the active path. */
  responseVersions: EventCenteredWorkspaceMessageData[];
  snapshotData: unknown;
  pendingTurn: EventCenteredWorkspacePendingTurn | null;
  journalEntry: EventCenteredWorkspaceJournalEntryData | null;
}

export interface ReserveEventCenteredTurnResult {
  kind: "reserved" | "existing";
  eventId: string;
  rootSessionId: string;
  activeBranchSessionId: string;
  branchStateId: string;
  userMessageId: string;
  turn: EventCenteredTurnConfirmation;
}
