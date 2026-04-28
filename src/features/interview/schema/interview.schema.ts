import { z } from "zod";

const interviewDimensionSchema = z.enum(["joy", "fulfillment", "reflection", "improvement", "gratitude"]);
const assistantDepthSchema = z.enum(["event", "feeling", "reason", "clue", "pattern"]);
const assistantTurnPhaseSchema = z.enum(["opening", "digging", "closing", "choice"]);
const interviewEventStatusSchema = z.enum(["active", "ready_for_choice", "completed"]);
const interviewLensSchema = z.enum(["event_detail", "felt_experience", "importance_reason", "meaning_pattern", "self_pattern"]);
const interviewStageSchema = z.string().min(1);

const joySnapshotSchema = z.object({
  event: z.string().nullable(),
  feeling: z.string().nullable(),
  whyItMattered: z.string().nullable(),
  happinessType: z.string().nullable(),
  selfPattern: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  missingSlots: z.array(z.string())
});

const joySnapshotDataSchema = z.object({
  kind: z.literal("joy"),
  moment: z.string().nullable(),
  feeling: z.string().nullable(),
  joyType: z.string().nullable(),
  meaningSource: z.string().nullable(),
  selfPattern: z.string().nullable(),
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
  feeling: z.string().nullable(),
  improvementType: z.string().nullable(),
  frictionPoint: z.string().nullable(),
  nextAttempt: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  missingSlots: z.array(z.string())
});

const gratitudeSnapshotDataSchema = z.object({
  kind: z.literal("gratitude"),
  moment: z.string().nullable(),
  feeling: z.string().nullable(),
  gratitudeType: z.string().nullable(),
  gratitudeReason: z.string().nullable(),
  relationshipSignal: z.string().nullable(),
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
  moment: z.string().nullable(),
  feeling: z.string().nullable(),
  joyType: z.string().nullable(),
  meaningSource: z.string().nullable(),
  selfPattern: z.string().nullable(),
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
  feeling: z.string().nullable(),
  improvementType: z.string().nullable(),
  frictionPoint: z.string().nullable(),
  nextAttempt: z.string().nullable(),
  tags: z.array(z.string())
});

const gratitudeJournalPayloadSchema = z.object({
  kind: z.literal("gratitude"),
  moment: z.string().nullable(),
  feeling: z.string().nullable(),
  gratitudeType: z.string().nullable(),
  gratitudeReason: z.string().nullable(),
  relationshipSignal: z.string().nullable(),
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
  stateUpdate: z.object({
    turnPhase: assistantTurnPhaseSchema,
    shouldEndDimension: z.boolean(),
    offerChoice: z.boolean(),
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
  selfPattern: z.string().nullable()
});

const journalDraftSchema = z.object({
  title: z.string(),
  content: z.string(),
  event: z.string().nullable(),
  feeling: z.string().nullable(),
  whyItMattered: z.string().nullable(),
  happinessType: z.string().nullable(),
  selfPattern: z.string().nullable(),
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
  savedAt: z.string().nullable()
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

const pendingDecisionSchema = z.object({
  kind: z.literal("event_complete"),
  eventId: z.string(),
  eventSequence: z.number().int().nonnegative(),
  actions: z.array(z.enum(["continue_current_event", "next_event", "generate_draft"])).min(1)
});

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
  startedAt: z.string(),
  pausedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  journalEntry: journalEntrySchema.nullable()
});

export const startInterviewRequestSchema = z.object({
  dimension: interviewDimensionSchema
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
    userMessage: z.string().min(1).max(1200),
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
  title: z.string().max(80),
  content: z.string().max(3000)
});

export const updateJournalEntryResponseSchema = journalEntrySchema;

export const settingsFormSchema = z.object({
  memoryEnabled: z.boolean(),
  transcriptAutoFallbackEnabled: z.boolean()
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
