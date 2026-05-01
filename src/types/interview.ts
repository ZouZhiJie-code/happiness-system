export type InterviewDimension = "joy" | "fulfillment" | "reflection" | "improvement" | "gratitude";
export type InterviewSessionStatus = "active" | "paused" | "completed" | "abandoned";
export type InterviewEventStatus = "active" | "ready_for_choice" | "completed";
export type InputMode = "text" | "voice";
export type InterviewRole = "user" | "assistant" | "system";
export type JoyEntrySource = "ai_draft_direct" | "ai_draft_edited";
export type JoyEntryStatus = "draft" | "saved";
export type DraftCompletionMode = "complete" | "user_override_partial";
export type DraftCompositionMode = "single_moment" | "stitched_moments";
export type DraftEmphasis = "delight" | "meaning" | "mixed";
export type JoyTrack = "meaning_track" | "delight_track";
export type ImprovementTrack = "repeat_good" | "avoid_bad";
export type JoyKind = "pure_delight" | "restoration" | "connection" | "value" | "direction" | "mixed";
export type JoySignalLevel = "none" | "hint" | "strong";
export type JoyNeedFamily =
  | "connection"
  | "autonomy"
  | "mastery"
  | "expression"
  | "growth"
  | "contribution"
  | "recognition"
  | "restoration"
  | "play";
export type JoyClosureTarget = "manual_clue" | "delight_signature";
export type DraftVoiceMode = "journal";
export type DraftNarrativeOrder = "scene_core_shift_close";
export type DraftClosingMode = "stable_clue" | "current_understanding";
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
export type PendingDecisionAction =
  | "continue_current_event"
  | "next_event"
  | "generate_draft"
  | "switch_dimension"
  | "pause_session";

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

export interface JoyPsychProfile {
  track: JoyTrack;
  kind: JoyKind;
  needFamily: JoyNeedFamily | null;
  directionLevel: JoySignalLevel;
  valueLevel: JoySignalLevel;
  durabilityLevel: JoySignalLevel;
  vitalityCue: string | null;
  confidence: number;
}

export interface JoySnapshot {
  event: string | null;
  feeling: string | null;
  whyItMattered: string | null;
  happinessType: string | null;
  selfPattern: string | null;
  joyMoment?: string | null;
  joySource?: string | null;
  stateShift?: string | null;
  meaningNeed?: string | null;
  manualClue?: string | null;
  delightSignature?: string | null;
  directionSignal?: string | null;
  valueImpact?: string | null;
  durability?: string | null;
  psychProfile?: JoyPsychProfile;
  tags?: string[];
  improvementTrack?: ImprovementTrack | null;
  stateAssessment?: string | null;
  frictionPoint?: string | null;
  repeatCondition?: string | null;
  controllableFactor?: string | null;
  nextAttempt?: string | null;
  successSignal?: string | null;
  gratitudeMoment?: string | null;
  gratitudeTarget?: string | null;
  kindAction?: string | null;
  seenNeed?: string | null;
  innerEffect?: string | null;
  gratitudeReason?: string | null;
  gratitudeType?: string | null;
  relationshipSignal?: string | null;
  reciprocityHint?: string | null;
  confidence: number;
  missingSlots: string[];
}

export interface JoySnapshotData {
  kind: "joy";
  joyMoment: string | null;
  joySource: string | null;
  stateShift: string | null;
  meaningNeed: string | null;
  manualClue: string | null;
  delightSignature?: string | null;
  directionSignal: string | null;
  valueImpact: string | null;
  durability: string | null;
  psychProfile?: JoyPsychProfile;
  tags: string[];
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
  improvementTrack: ImprovementTrack | null;
  stateAssessment: string | null;
  feeling: string | null;
  improvementType: string | null;
  frictionPoint: string | null;
  repeatCondition: string | null;
  controllableFactor: string | null;
  nextAttempt: string | null;
  successSignal: string | null;
  confidence: number;
  missingSlots: string[];
}

export interface GratitudeSnapshotData {
  kind: "gratitude";
  moment: string | null;
  gratitudeMoment: string | null;
  gratitudeTarget: string | null;
  kindAction: string | null;
  seenNeed: string | null;
  innerEffect: string | null;
  feeling: string | null;
  gratitudeType: string | null;
  gratitudeReason: string | null;
  relationshipSignal: string | null;
  reciprocityHint: string | null;
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

export interface DraftBrief {
  dimension: InterviewDimension;
  completionMode: DraftCompletionMode;
  compositionMode: DraftCompositionMode;
  emphasis: DraftEmphasis;
  anchorScene: string | null;
  emotionalCore: string | null;
  stateOrNeed: string | null;
  closingInsight: string | null;
  joyTrack?: JoyTrack;
  joyKind?: JoyKind;
  closureTarget?: JoyClosureTarget;
  improvementTrack?: ImprovementTrack | null;
  frictionPoint?: string | null;
  repeatCondition?: string | null;
  controllableFactor?: string | null;
  nextAttempt?: string | null;
  successSignal?: string | null;
  supportingMoments: string[];
  directionSignal: string | null;
  valueSignal: string | null;
  durabilitySignal: string | null;
  titleHint: string | null;
  tags: string[];
}

export interface DraftWritingProfile {
  voiceMode: DraftVoiceMode;
  narrativeOrder: DraftNarrativeOrder;
  closingMode: DraftClosingMode;
  toneBanSet: string[];
}

export interface JoyEntryDraft {
  title: string;
  content: string;
  event: string | null;
  feeling: string | null;
  whyItMattered: string | null;
  happinessType: string | null;
  selfPattern: string | null;
  joyMoment?: string | null;
  joySource?: string | null;
  stateShift?: string | null;
  meaningNeed?: string | null;
  manualClue?: string | null;
  delightSignature?: string | null;
  directionSignal?: string | null;
  valueImpact?: string | null;
  durability?: string | null;
  psychProfile?: JoyPsychProfile;
  improvementTrack?: ImprovementTrack | null;
  stateAssessment?: string | null;
  frictionPoint?: string | null;
  repeatCondition?: string | null;
  controllableFactor?: string | null;
  nextAttempt?: string | null;
  successSignal?: string | null;
  gratitudeMoment?: string | null;
  gratitudeTarget?: string | null;
  kindAction?: string | null;
  seenNeed?: string | null;
  innerEffect?: string | null;
  gratitudeReason?: string | null;
  gratitudeType?: string | null;
  relationshipSignal?: string | null;
  reciprocityHint?: string | null;
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
  joyMoment?: string | null;
  joySource?: string | null;
  stateShift?: string | null;
  meaningNeed?: string | null;
  manualClue?: string | null;
  delightSignature?: string | null;
  directionSignal?: string | null;
  valueImpact?: string | null;
  durability?: string | null;
  psychProfile?: JoyPsychProfile;
  improvementTrack?: ImprovementTrack | null;
  stateAssessment?: string | null;
  frictionPoint?: string | null;
  repeatCondition?: string | null;
  controllableFactor?: string | null;
  nextAttempt?: string | null;
  successSignal?: string | null;
  gratitudeMoment?: string | null;
  gratitudeTarget?: string | null;
  kindAction?: string | null;
  seenNeed?: string | null;
  innerEffect?: string | null;
  gratitudeReason?: string | null;
  gratitudeType?: string | null;
  relationshipSignal?: string | null;
  reciprocityHint?: string | null;
  tags?: string[];
}

export interface JoyJournalPayload {
  kind: "joy";
  joyMoment: string | null;
  joySource: string | null;
  stateShift: string | null;
  meaningNeed: string | null;
  manualClue: string | null;
  delightSignature?: string | null;
  directionSignal: string | null;
  valueImpact: string | null;
  durability: string | null;
  psychProfile?: JoyPsychProfile;
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
  improvementTrack: ImprovementTrack | null;
  stateAssessment: string | null;
  feeling: string | null;
  improvementType: string | null;
  frictionPoint: string | null;
  repeatCondition: string | null;
  controllableFactor: string | null;
  nextAttempt: string | null;
  successSignal: string | null;
  tags: string[];
}

export interface GratitudeJournalPayload {
  kind: "gratitude";
  moment: string | null;
  gratitudeMoment: string | null;
  gratitudeTarget: string | null;
  kindAction: string | null;
  seenNeed: string | null;
  innerEffect: string | null;
  feeling: string | null;
  gratitudeType: string | null;
  gratitudeReason: string | null;
  relationshipSignal: string | null;
  reciprocityHint: string | null;
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

export interface EventCompletePendingDecisionRecord {
  kind: "event_complete";
  eventId: string;
  eventSequence: number;
  completionMode?: DraftCompletionMode;
  actions: ReadonlyArray<Extract<PendingDecisionAction, "continue_current_event" | "next_event" | "generate_draft">>;
}

export interface DimensionRedirectPendingDecisionRecord {
  kind: "dimension_redirect";
  eventId: string;
  eventSequence: number;
  targetDimension: InterviewDimension;
  reason: string;
  actions: ReadonlyArray<Extract<PendingDecisionAction, "continue_current_event" | "switch_dimension">>;
}

export interface BoundaryInsufficientPendingDecisionRecord {
  kind: "boundary_insufficient";
  eventId: string;
  eventSequence: number;
  reason: string;
  actions: ReadonlyArray<Extract<PendingDecisionAction, "continue_current_event" | "next_event" | "pause_session">>;
}

export type PendingDecisionRecord =
  | EventCompletePendingDecisionRecord
  | DimensionRedirectPendingDecisionRecord
  | BoundaryInsufficientPendingDecisionRecord;

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
  entryDate: string;
  startedAt: string;
  pausedAt: string | null;
  completedAt: string | null;
  journalEntry: JournalEntryRecord | null;
}
