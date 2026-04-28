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
export type InterviewStage = JoyInterviewStage;
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

export interface JoySnapshotData {
  kind: "joy";
  moment: string | null;
  feeling: string | null;
  joyType: string | null;
  meaningSource: string | null;
  selfPattern: string | null;
  confidence: number;
  missingSlots: string[];
}

export interface FulfillmentSnapshotData {
  kind: "fulfillment";
  experience: string | null;
  feeling: string | null;
  fulfillmentType: string | null;
  progressEvidence: string | null;
  valueSignal: string | null;
  confidence: number;
  missingSlots: string[];
}

export interface ReflectionSnapshotData {
  kind: "reflection";
  trigger: string | null;
  feeling: string | null;
  reflectionType: string | null;
  insight: string | null;
  viewpointShift: string | null;
  confidence: number;
  missingSlots: string[];
}

export interface ImprovementSnapshotData {
  kind: "improvement";
  situation: string | null;
  feeling: string | null;
  improvementType: string | null;
  frictionPoint: string | null;
  nextAttempt: string | null;
  confidence: number;
  missingSlots: string[];
}

export interface GratitudeSnapshotData {
  kind: "gratitude";
  moment: string | null;
  feeling: string | null;
  gratitudeType: string | null;
  gratitudeReason: string | null;
  relationshipSignal: string | null;
  confidence: number;
  missingSlots: string[];
}

export type InterviewSnapshotData =
  | JoySnapshotData
  | FulfillmentSnapshotData
  | ReflectionSnapshotData
  | ImprovementSnapshotData
  | GratitudeSnapshotData;

export interface DimensionRendererField {
  label: string;
  value: string;
}

export interface DimensionSummaryViewModel {
  fields: DimensionRendererField[];
}

export interface DimensionDraftViewModel {
  title: string;
  description: string;
  fields: DimensionRendererField[];
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

export interface JoyJournalPayload {
  kind: "joy";
  moment: string | null;
  feeling: string | null;
  joyType: string | null;
  meaningSource: string | null;
  selfPattern: string | null;
  tags: string[];
}

export interface FulfillmentJournalPayload {
  kind: "fulfillment";
  experience: string | null;
  feeling: string | null;
  fulfillmentType: string | null;
  progressEvidence: string | null;
  valueSignal: string | null;
  tags: string[];
}

export interface ReflectionJournalPayload {
  kind: "reflection";
  trigger: string | null;
  feeling: string | null;
  reflectionType: string | null;
  insight: string | null;
  viewpointShift: string | null;
  tags: string[];
}

export interface ImprovementJournalPayload {
  kind: "improvement";
  situation: string | null;
  feeling: string | null;
  improvementType: string | null;
  frictionPoint: string | null;
  nextAttempt: string | null;
  tags: string[];
}

export interface GratitudeJournalPayload {
  kind: "gratitude";
  moment: string | null;
  feeling: string | null;
  gratitudeType: string | null;
  gratitudeReason: string | null;
  relationshipSignal: string | null;
  tags: string[];
}

export type InterviewJournalPayload =
  | JoyJournalPayload
  | FulfillmentJournalPayload
  | ReflectionJournalPayload
  | ImprovementJournalPayload
  | GratitudeJournalPayload;

export interface JournalEntryRecord extends JoyEntryDraft {
  id: string;
  payload?: InterviewJournalPayload;
  status: JoyEntryStatus;
  linkedSessionIds: string[];
  updatedAt: string;
  savedAt: string | null;
}

export interface InterviewEventRecord {
  id: string;
  sequence: number;
  status: InterviewEventStatus;
  stage: InterviewStage;
  explorationRound: number;
  coveredLenses: InterviewLens[];
  roundCoveredLenses: InterviewLens[];
  roundMeaningfulReplyCount: number;
  totalMeaningfulReplyCount: number;
  startMessageSequence: number;
  snapshot: JoySnapshot;
  snapshotData?: InterviewSnapshotData;
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
  stage: InterviewStage;
  activeEventId: string | null;
  draftGenerationUnlocked: boolean;
  turnCount: number;
  lastAssistantQuestion: string;
  draftSummary: string | null;
  messages: InterviewMessage[];
  snapshot: JoySnapshot;
  snapshotData?: InterviewSnapshotData;
  events: InterviewEventRecord[];
  pendingDecision: PendingDecisionRecord | null;
  startedAt: string;
  pausedAt: string | null;
  completedAt: string | null;
  journalEntry: JournalEntryRecord | null;
}
