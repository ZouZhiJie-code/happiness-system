export type InterviewDimension = "joy" | "fulfillment" | "reflection" | "improvement" | "gratitude";
export type InterviewSessionStatus = "active" | "paused" | "completed" | "abandoned";
export type InterviewEventStatus = "active" | "ready_for_choice" | "completed";
export type InputMode = "text" | "voice";
export type InterviewRole = "user" | "assistant" | "system";
export type JoyEntrySource = "ai_draft_direct" | "ai_draft_edited";
export type JoyEntryStatus = "draft" | "saved";
export type AssistantDepth = "event" | "feeling" | "reason" | "clue" | "pattern";
export type InterviewLens =
  | "event_detail"
  | "felt_experience"
  | "importance_reason"
  | "meaning_pattern"
  | "self_pattern";
export type AssistantTurnPhase = "opening" | "digging" | "closing" | "choice";
export type JoyInterviewStage =
  | "collect_event"
  | "probe_reason"
  | "probe_pattern"
  | "wrap_up"
  | "finalize";
export type PendingDecisionAction = "continue_current_event" | "next_event" | "generate_draft";

export interface AssistantTurnPayload {
  insight: string;
  thinkingSummary: string;
  analysis: string;
  question: string;
  stateUpdate: {
    turnPhase: AssistantTurnPhase;
    shouldEndDimension: boolean;
    offerChoice: boolean;
    choiceReason: string;
  };
  meta: {
    depthReached: AssistantDepth[];
  };
}

export interface InterviewMessage {
  id: string;
  role: InterviewRole;
  inputMode?: InputMode;
  content: string;
  assistantPayload?: AssistantTurnPayload | null;
  sequence: number;
  createdAt: string;
}

export interface JoySnapshot {
  event: string | null;
  feeling: string | null;
  whyItMattered: string | null;
  happinessType: string | null;
  selfPattern: string | null;
  confidence: number;
  missingSlots: string[];
}

export interface JoyEntryDraft {
  title: string;
  content: string;
  event: string | null;
  feeling: string | null;
  whyItMattered: string | null;
  happinessType: string | null;
  selfPattern: string | null;
  tags: string[];
  eventBlocks: JoyEventBlock[];
  source: JoyEntrySource;
}

export interface JoyEventBlock {
  eventId: string;
  sequence: number;
  explorationRound: number;
  event: string | null;
  feeling: string | null;
  whyItMattered: string | null;
  happinessType: string | null;
  selfPattern: string | null;
}

export interface JournalEntryRecord extends JoyEntryDraft {
  id: string;
  status: JoyEntryStatus;
  linkedSessionIds: string[];
  updatedAt: string;
  savedAt: string | null;
}

export interface InterviewEventRecord {
  id: string;
  sequence: number;
  status: InterviewEventStatus;
  stage: JoyInterviewStage;
  explorationRound: number;
  coveredLenses: InterviewLens[];
  roundCoveredLenses: InterviewLens[];
  roundMeaningfulReplyCount: number;
  totalMeaningfulReplyCount: number;
  startMessageSequence: number;
  snapshot: JoySnapshot;
  draftSummary: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface PendingDecisionRecord {
  kind: "event_complete";
  eventId: string;
  eventSequence: number;
  actions: PendingDecisionAction[];
}

export interface InterviewSessionRecord {
  id: string;
  dimension: InterviewDimension;
  status: InterviewSessionStatus;
  stage: JoyInterviewStage;
  activeEventId: string | null;
  draftGenerationUnlocked: boolean;
  turnCount: number;
  lastAssistantQuestion: string;
  draftSummary: string | null;
  messages: InterviewMessage[];
  snapshot: JoySnapshot;
  events: InterviewEventRecord[];
  pendingDecision: PendingDecisionRecord | null;
  startedAt: string;
  pausedAt: string | null;
  completedAt: string | null;
  journalEntry: JournalEntryRecord | null;
}
