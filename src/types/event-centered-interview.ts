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

export interface ReserveEventCenteredTurnResult {
  kind: "reserved" | "existing";
  eventId: string;
  rootSessionId: string;
  activeBranchSessionId: string;
  branchStateId: string;
  userMessageId: string;
  turn: EventCenteredTurnConfirmation;
}
