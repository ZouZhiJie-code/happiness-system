export type InterviewDimension = "joy";
export type InterviewSessionStatus = "active" | "completed" | "abandoned";
export type InputMode = "text" | "voice";
export type InterviewRole = "user" | "assistant" | "system";
export type JoyEntrySource = "ai_draft_direct" | "ai_draft_edited";
export type JoyInterviewStage =
  | "collect_event"
  | "probe_reason"
  | "probe_pattern"
  | "wrap_up"
  | "finalize";

export interface InterviewMessage {
  id: string;
  role: InterviewRole;
  inputMode?: InputMode;
  content: string;
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
  source: JoyEntrySource;
}

export interface InterviewSessionRecord {
  id: string;
  dimension: InterviewDimension;
  status: InterviewSessionStatus;
  stage: JoyInterviewStage;
  turnCount: number;
  lastAssistantQuestion: string;
  draftSummary: string | null;
  messages: InterviewMessage[];
  snapshot: JoySnapshot;
  startedAt: string;
  completedAt: string | null;
  finalEntry: JoyEntryDraft | null;
}
