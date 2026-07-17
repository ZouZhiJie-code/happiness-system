import { z } from "zod";

import { ENTRY_DATE_REGEX, parseEntryDateInput } from "@/features/interview/entry-date";
import { INTERVIEW_REPLY_MAX_LENGTH } from "@/features/interview/interview-issue";
import { MAX_JOURNAL_CONTENT_LENGTH, MAX_JOURNAL_TITLE_LENGTH } from "@/features/interview/journal-title";

const entryDateStringSchema = z.string().regex(ENTRY_DATE_REGEX).refine((value) => {
  try {
    parseEntryDateInput(value);
    return true;
  } catch {
    return false;
  }
}, "Invalid entry date");

const interviewDimensionSchema = z.enum(["joy", "fulfillment", "reflection", "improvement", "gratitude"]);
const draftCompletionModeSchema = z.enum(["complete", "user_override_partial"]);
const assistantDepthSchema = z.enum(["event", "feeling", "reason", "clue", "pattern"]);
const assistantQuestionTargetSchema = z.enum([
  "event_anchor",
  "prior_assumption",
  "reaction_evidence",
  "insight_evidence",
  "judgment_clue"
]);
const gratitudeQuestionSubTargetSchema = z.enum([
  "kind_action",
  "seen_need",
  "gratitude_reason",
  "relationship_signal"
]);
const inferenceHypothesisKeySchema = z.enum(["seen_need", "gratitude_reason", "relationship_signal"]);
const assistantQuestionStageIntentSchema = z.enum(["advance", "resume", "repair"]);
const assistantQuestionSurfaceLevelSchema = z.enum(["default", "simplified", "concrete_anchor"]);
const assistantTurnPhaseSchema = z.enum(["opening", "digging", "closing", "choice"]);
const assistantChoiceKindSchema = z.enum(["event_complete", "dimension_redirect", "boundary_insufficient"]);
const interviewEventStatusSchema = z.enum(["active", "ready_for_choice", "completed"]);
const interviewLensSchema = z.enum(["event_detail", "felt_experience", "importance_reason", "meaning_pattern", "self_pattern"]);
const interviewStageSchema = z.string().min(1);
const joyTrackSchema = z.enum(["meaning_track", "delight_track"]);
const improvementTrackSchema = z.enum(["repeat_good", "avoid_bad"]);
const joyKindSchema = z.enum(["pure_delight", "restoration", "connection", "value", "direction", "mixed"]);
const joySignalLevelSchema = z.enum(["none", "hint", "strong"]);
const joyNeedFamilySchema = z.enum([
  "connection",
  "autonomy",
  "mastery",
  "expression",
  "growth",
  "contribution",
  "recognition",
  "restoration",
  "play"
]);
const joyPsychProfileSchema = z.object({
  track: joyTrackSchema,
  kind: joyKindSchema,
  needFamily: joyNeedFamilySchema.nullable(),
  directionLevel: joySignalLevelSchema,
  valueLevel: joySignalLevelSchema,
  durabilityLevel: joySignalLevelSchema,
  vitalityCue: z.string().nullable(),
  confidence: z.number().min(0).max(1)
});

const inferenceEvidenceStateSchema = z.object({
  targets: z.record(z.string(), z.enum(["confirmed", "weak"])).default({}),
  deniedTargets: z.array(gratitudeQuestionSubTargetSchema).default([]),
  deniedHypotheses: z.array(inferenceHypothesisKeySchema).default([]),
  blockedTransitions: z.array(z.string()).default([])
});

const joySnapshotSchema = z.object({
  event: z.string().nullable(),
  feeling: z.string().nullable(),
  whyItMattered: z.string().nullable(),
  happinessType: z.string().nullable(),
  selfPattern: z.string().nullable(),
  joyMoment: z.string().nullable().optional(),
  joySource: z.string().nullable().optional(),
  stateShift: z.string().nullable().optional(),
  meaningNeed: z.string().nullable().optional(),
  manualClue: z.string().nullable().optional(),
  delightSignature: z.string().nullable().optional(),
  directionSignal: z.string().nullable().optional(),
  valueImpact: z.string().nullable().optional(),
  durability: z.string().nullable().optional(),
  psychProfile: joyPsychProfileSchema.optional(),
  tags: z.array(z.string()).optional(),
  evidenceState: inferenceEvidenceStateSchema.nullable().optional(),
  confidence: z.number().min(0).max(1),
  missingSlots: z.array(z.string())
});

const joySnapshotDataSchema = z.object({
  kind: z.literal("joy"),
  joyMoment: z.string().nullable(),
  joySource: z.string().nullable(),
  stateShift: z.string().nullable(),
  meaningNeed: z.string().nullable(),
  manualClue: z.string().nullable(),
  delightSignature: z.string().nullable().optional(),
  directionSignal: z.string().nullable(),
  valueImpact: z.string().nullable(),
  durability: z.string().nullable(),
  psychProfile: joyPsychProfileSchema.nullable().optional(),
  tags: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  missingSlots: z.array(z.string())
});

const fulfillmentSnapshotDataSchema = z.object({
  kind: z.literal("fulfillment"),
  experience: z.string().nullable(),
  feeling: z.string().nullable(),
  fulfillmentType: z.string().nullable(),
  progressEvidence: z.string().nullable(),
  valueSignal: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  missingSlots: z.array(z.string())
});

const reflectionSnapshotDataSchema = z.object({
  kind: z.literal("reflection"),
  trigger: z.string().nullable(),
  feeling: z.string().nullable(),
  reflectionType: z.string().nullable(),
  insight: z.string().nullable(),
  viewpointShift: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  missingSlots: z.array(z.string())
});

const improvementSnapshotDataSchema = z.object({
  kind: z.literal("improvement"),
  situation: z.string().nullable(),
  improvementTrack: improvementTrackSchema.nullable().default(null),
  stateAssessment: z.string().nullable().default(null),
  feeling: z.string().nullable(),
  improvementType: z.string().nullable(),
  frictionPoint: z.string().nullable(),
  repeatCondition: z.string().nullable().default(null),
  controllableFactor: z.string().nullable().default(null),
  nextAttempt: z.string().nullable(),
  successSignal: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1),
  missingSlots: z.array(z.string())
});

const gratitudeSnapshotDataSchema = z.object({
  kind: z.literal("gratitude"),
  moment: z.string().nullable(),
  gratitudeMoment: z.string().nullable().default(null),
  gratitudeTarget: z.string().nullable().default(null),
  kindAction: z.string().nullable().default(null),
  seenNeed: z.string().nullable().default(null),
  innerEffect: z.string().nullable().default(null),
  feeling: z.string().nullable(),
  gratitudeType: z.string().nullable(),
  gratitudeReason: z.string().nullable(),
  relationshipSignal: z.string().nullable(),
  reciprocityHint: z.string().nullable().default(null),
  evidenceState: inferenceEvidenceStateSchema.nullable().optional(),
  confidence: z.number().min(0).max(1),
  missingSlots: z.array(z.string())
});

export const interviewSnapshotDataSchema = z.discriminatedUnion("kind", [
  joySnapshotDataSchema,
  fulfillmentSnapshotDataSchema,
  reflectionSnapshotDataSchema,
  improvementSnapshotDataSchema,
  gratitudeSnapshotDataSchema
]);

const joyJournalPayloadSchema = z.object({
  kind: z.literal("joy"),
  joyMoment: z.string().nullable(),
  joySource: z.string().nullable(),
  stateShift: z.string().nullable(),
  meaningNeed: z.string().nullable(),
  manualClue: z.string().nullable(),
  delightSignature: z.string().nullable().optional(),
  directionSignal: z.string().nullable(),
  valueImpact: z.string().nullable(),
  durability: z.string().nullable(),
  psychProfile: joyPsychProfileSchema.nullable().optional(),
  tags: z.array(z.string())
});

const fulfillmentJournalPayloadSchema = z.object({
  kind: z.literal("fulfillment"),
  experience: z.string().nullable(),
  feeling: z.string().nullable(),
  fulfillmentType: z.string().nullable(),
  progressEvidence: z.string().nullable(),
  valueSignal: z.string().nullable(),
  tags: z.array(z.string())
});

const reflectionJournalPayloadSchema = z.object({
  kind: z.literal("reflection"),
  trigger: z.string().nullable(),
  feeling: z.string().nullable(),
  reflectionType: z.string().nullable(),
  insight: z.string().nullable(),
  viewpointShift: z.string().nullable(),
  tags: z.array(z.string())
});

const improvementJournalPayloadSchema = z.object({
  kind: z.literal("improvement"),
  situation: z.string().nullable(),
  improvementTrack: improvementTrackSchema.nullable().default(null),
  stateAssessment: z.string().nullable().default(null),
  feeling: z.string().nullable(),
  improvementType: z.string().nullable(),
  frictionPoint: z.string().nullable(),
  repeatCondition: z.string().nullable().default(null),
  controllableFactor: z.string().nullable().default(null),
  nextAttempt: z.string().nullable(),
  successSignal: z.string().nullable().default(null),
  tags: z.array(z.string())
});

const gratitudeJournalPayloadSchema = z.object({
  kind: z.literal("gratitude"),
  moment: z.string().nullable(),
  gratitudeMoment: z.string().nullable().default(null),
  gratitudeTarget: z.string().nullable().default(null),
  kindAction: z.string().nullable().default(null),
  seenNeed: z.string().nullable().default(null),
  innerEffect: z.string().nullable().default(null),
  feeling: z.string().nullable(),
  gratitudeType: z.string().nullable(),
  gratitudeReason: z.string().nullable(),
  relationshipSignal: z.string().nullable(),
  reciprocityHint: z.string().nullable().default(null),
  evidenceState: inferenceEvidenceStateSchema.nullable().optional(),
  tags: z.array(z.string())
});

export const interviewJournalPayloadSchema = z.discriminatedUnion("kind", [
  joyJournalPayloadSchema,
  fulfillmentJournalPayloadSchema,
  reflectionJournalPayloadSchema,
  improvementJournalPayloadSchema,
  gratitudeJournalPayloadSchema
]);

export const assistantTurnPayloadSchema = z.object({
  insight: z.string().max(120).default(""),
  thinkingSummary: z.string().max(180).default(""),
  analysis: z.string().max(240),
  question: z.string().max(160),
  questionSpec: z
    .object({
      target: assistantQuestionTargetSchema,
      subTarget: gratitudeQuestionSubTargetSchema.nullable().optional().default(null),
      hypothesisKey: inferenceHypothesisKeySchema.nullable().optional().default(null),
      stageIntent: assistantQuestionStageIntentSchema,
      surfaceLevel: assistantQuestionSurfaceLevelSchema,
      anchorText: z.string().nullable().optional().default(null),
      repairCount: z.number().int().nonnegative()
    })
    .nullable()
    .optional()
    .default(null),
  stateUpdate: z.object({
    turnPhase: assistantTurnPhaseSchema,
    shouldEndDimension: z.boolean(),
    offerChoice: z.boolean(),
    choiceKind: assistantChoiceKindSchema.nullable().optional().default(null),
    choiceReason: z.string().max(160)
  }),
  meta: z.object({
    depthReached: z.array(assistantDepthSchema).max(5)
  })
});

const interviewMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  inputMode: z.enum(["text", "voice"]).optional(),
  content: z.string(),
  assistantPayload: assistantTurnPayloadSchema.nullable().optional(),
  sequence: z.number().int().nonnegative(),
  createdAt: z.string()
});

const joyEventBlockSchema = z.object({
  eventId: z.string(),
  sequence: z.number().int().nonnegative(),
  explorationRound: z.number().int().positive(),
  event: z.string().nullable(),
  feeling: z.string().nullable(),
  whyItMattered: z.string().nullable(),
  happinessType: z.string().nullable(),
  selfPattern: z.string().nullable(),
  joyMoment: z.string().nullable().optional(),
  joySource: z.string().nullable().optional(),
  stateShift: z.string().nullable().optional(),
  meaningNeed: z.string().nullable().optional(),
  manualClue: z.string().nullable().optional(),
  delightSignature: z.string().nullable().optional(),
  directionSignal: z.string().nullable().optional(),
  valueImpact: z.string().nullable().optional(),
  durability: z.string().nullable().optional(),
  psychProfile: joyPsychProfileSchema.optional(),
  improvementTrack: improvementTrackSchema.nullable().optional(),
  stateAssessment: z.string().nullable().optional(),
  frictionPoint: z.string().nullable().optional(),
  repeatCondition: z.string().nullable().optional(),
  controllableFactor: z.string().nullable().optional(),
  nextAttempt: z.string().nullable().optional(),
  successSignal: z.string().nullable().optional(),
  tags: z.array(z.string()).optional()
});

const journalDraftSchema = z.object({
  title: z.string().max(MAX_JOURNAL_TITLE_LENGTH),
  content: z.string().max(MAX_JOURNAL_CONTENT_LENGTH),
  event: z.string().nullable(),
  feeling: z.string().nullable(),
  whyItMattered: z.string().nullable(),
  happinessType: z.string().nullable(),
  selfPattern: z.string().nullable(),
  joyMoment: z.string().nullable().optional(),
  joySource: z.string().nullable().optional(),
  stateShift: z.string().nullable().optional(),
  meaningNeed: z.string().nullable().optional(),
  manualClue: z.string().nullable().optional(),
  delightSignature: z.string().nullable().optional(),
  directionSignal: z.string().nullable().optional(),
  valueImpact: z.string().nullable().optional(),
  durability: z.string().nullable().optional(),
  psychProfile: joyPsychProfileSchema.optional(),
  improvementTrack: improvementTrackSchema.nullable().optional(),
  stateAssessment: z.string().nullable().optional(),
  frictionPoint: z.string().nullable().optional(),
  repeatCondition: z.string().nullable().optional(),
  controllableFactor: z.string().nullable().optional(),
  nextAttempt: z.string().nullable().optional(),
  successSignal: z.string().nullable().optional(),
  tags: z.array(z.string()),
  eventBlocks: z.array(joyEventBlockSchema),
  payload: interviewJournalPayloadSchema,
  source: z.enum(["ai_draft_direct", "ai_draft_edited"])
});

export const journalEntrySchema = journalDraftSchema.extend({
  id: z.string(),
  status: z.enum(["draft", "saved"]),
  linkedSessionIds: z.array(z.string()),
  updatedAt: z.string(),
  savedAt: z.string().nullable(),
  confirmationState: z.enum(["draft", "confirmed", "modified"])
});

const interviewEventSchema = z.object({
  id: z.string(),
  sequence: z.number().int().nonnegative(),
  status: interviewEventStatusSchema,
  stage: interviewStageSchema,
  explorationRound: z.number().int().positive(),
  coveredLenses: z.array(interviewLensSchema),
  roundCoveredLenses: z.array(interviewLensSchema),
  roundMeaningfulReplyCount: z.number().int().nonnegative(),
  totalMeaningfulReplyCount: z.number().int().nonnegative(),
  startMessageSequence: z.number().int().nonnegative(),
  snapshot: joySnapshotSchema,
  snapshotData: interviewSnapshotDataSchema,
  draftSummary: z.string().nullable(),
  startedAt: z.string(),
  completedAt: z.string().nullable()
});

const pendingDecisionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("event_complete"),
    eventId: z.string(),
    eventSequence: z.number().int().nonnegative(),
    completionMode: draftCompletionModeSchema.optional(),
    actions: z.array(z.enum(["continue_current_event", "next_event", "generate_draft"])).min(1)
  }),
  z.object({
    kind: z.literal("dimension_redirect"),
    eventId: z.string(),
    eventSequence: z.number().int().nonnegative(),
    targetDimension: interviewDimensionSchema,
    reason: z.string().min(1),
    actions: z.array(z.enum(["continue_current_event", "switch_dimension"])).min(1)
  }),
  z.object({
    kind: z.literal("boundary_insufficient"),
    eventId: z.string(),
    eventSequence: z.number().int().nonnegative(),
    reason: z.string().min(1),
    actions: z.array(z.enum(["continue_current_event", "next_event", "pause_session"])).min(1)
  })
]);

export const interviewSessionSchema = z.object({
  id: z.string(),
  dimension: interviewDimensionSchema,
  status: z.enum(["active", "paused", "completed", "abandoned"]),
  stage: interviewStageSchema,
  activeEventId: z.string().nullable(),
  draftGenerationUnlocked: z.boolean(),
  turnCount: z.number().int().nonnegative(),
  lastAssistantQuestion: z.string(),
  draftSummary: z.string().nullable(),
  messages: z.array(interviewMessageSchema),
  snapshot: joySnapshotSchema,
  snapshotData: interviewSnapshotDataSchema,
  events: z.array(interviewEventSchema),
  pendingDecision: pendingDecisionSchema.nullable(),
  entryDate: entryDateStringSchema,
  startedAt: z.string(),
  pausedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  journalEntry: journalEntrySchema.nullable()
});

export const startInterviewRequestSchema = z.object({
  dimension: interviewDimensionSchema,
  entryDate: entryDateStringSchema.optional()
});

export const startInterviewResponseSchema = z.object({
  sessionId: z.string(),
  openingQuestion: z.string(),
  session: interviewSessionSchema
});

export const respondInterviewRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reply"),
    sessionId: z.string(),
    userMessage: z.string().min(1).max(INTERVIEW_REPLY_MAX_LENGTH),
    inputMode: z.enum(["text", "voice"]).default("text")
  }),
  z.object({
    action: z.literal("continue"),
    sessionId: z.string()
  }),
  z.object({
    action: z.literal("continue_current_event"),
    sessionId: z.string()
  }),
  z.object({
    action: z.literal("next_event"),
    sessionId: z.string()
  })
]);

export const respondInterviewResponseSchema = z.object({
  assistantMessage: z.string(),
  assistantTurn: assistantTurnPayloadSchema.nullable(),
  sessionStatus: z.enum(["active", "paused", "completed", "abandoned"]),
  turnCount: z.number().int().nonnegative(),
  snapshot: joySnapshotSchema,
  snapshotData: interviewSnapshotDataSchema,
  isReadyForDraft: z.boolean(),
  session: interviewSessionSchema
});

export const generateDraftRequestSchema = z.object({
  sessionIds: z.array(z.string()).min(1).max(4)
});

export const generateDraftResponseSchema = z.object({
  draftEntry: journalEntrySchema,
  session: interviewSessionSchema
});

export const saveDraftRequestSchema = z.object({
  sessionId: z.string()
});

export const saveDraftResponseSchema = z.object({
  draftEntry: journalEntrySchema,
  session: interviewSessionSchema
});

export const reopenInterviewRequestSchema = z.object({
  sessionId: z.string()
});

export const reopenInterviewResponseSchema = z.object({
  session: interviewSessionSchema
});

export const pauseInterviewRequestSchema = z.object({
  sessionId: z.string()
});

export const pauseInterviewResponseSchema = z.object({
  session: interviewSessionSchema
});

export const completeInterviewRequestSchema = z.object({
  sessionId: z.string()
});

export const completeInterviewResponseSchema = z.object({
  session: interviewSessionSchema
});

export const updateJournalEntryRequestSchema = journalDraftSchema.extend({
  title: z.string().max(MAX_JOURNAL_TITLE_LENGTH),
  content: z.string().max(MAX_JOURNAL_CONTENT_LENGTH)
});

export const updateJournalEntryResponseSchema = journalEntrySchema;

export const updateJournalEntryContentRequestSchema = z.object({
  title: z.string().max(MAX_JOURNAL_TITLE_LENGTH).optional(),
  content: z.string().max(MAX_JOURNAL_CONTENT_LENGTH)
});

export const settingsFormSchema = z.object({
  memoryEnabled: z.boolean()
});

export const updateJoyEntryRequestSchema = updateJournalEntryRequestSchema;
export const updateJoyEntryResponseSchema = updateJournalEntryResponseSchema;

export type StartInterviewRequest = z.infer<typeof startInterviewRequestSchema>;
export type RespondInterviewRequest = z.infer<typeof respondInterviewRequestSchema>;
export type GenerateDraftRequest = z.infer<typeof generateDraftRequestSchema>;
export type SaveDraftRequest = z.infer<typeof saveDraftRequestSchema>;
export type ReopenInterviewRequest = z.infer<typeof reopenInterviewRequestSchema>;
export type PauseInterviewRequest = z.infer<typeof pauseInterviewRequestSchema>;
export type CompleteInterviewRequest = z.infer<typeof completeInterviewRequestSchema>;
export type UpdateJournalEntryRequest = z.infer<typeof updateJournalEntryRequestSchema>;
export type UpdateJoyEntryRequest = z.infer<typeof updateJoyEntryRequestSchema>;
export type SettingsFormValues = z.infer<typeof settingsFormSchema>;
