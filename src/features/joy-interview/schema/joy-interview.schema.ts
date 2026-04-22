import { z } from "zod";

const interviewDimensionSchema = z.enum(["joy", "fulfillment", "reflection", "improvement", "gratitude"]);

const joySnapshotSchema = z.object({
  event: z.string().nullable(),
  feeling: z.string().nullable(),
  whyItMattered: z.string().nullable(),
  happinessType: z.string().nullable(),
  selfPattern: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  missingSlots: z.array(z.string())
});

const interviewMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  inputMode: z.enum(["text", "voice"]).optional(),
  content: z.string(),
  sequence: z.number().int().nonnegative(),
  createdAt: z.string()
});

const joyEntryDraftSchema = z.object({
  title: z.string(),
  content: z.string(),
  event: z.string().nullable(),
  feeling: z.string().nullable(),
  whyItMattered: z.string().nullable(),
  happinessType: z.string().nullable(),
  selfPattern: z.string().nullable(),
  tags: z.array(z.string()),
  source: z.enum(["ai_draft_direct", "ai_draft_edited"])
});

const journalEntrySchema = joyEntryDraftSchema.extend({
  id: z.string(),
  status: z.enum(["draft", "saved"]),
  linkedSessionIds: z.array(z.string()),
  updatedAt: z.string(),
  savedAt: z.string().nullable()
});

export const interviewSessionSchema = z.object({
  id: z.string(),
  dimension: interviewDimensionSchema,
  status: z.enum(["active", "completed", "abandoned"]),
  stage: z.enum(["collect_event", "probe_reason", "probe_pattern", "wrap_up", "finalize"]),
  turnCount: z.number().int().nonnegative(),
  lastAssistantQuestion: z.string(),
  draftSummary: z.string().nullable(),
  messages: z.array(interviewMessageSchema),
  snapshot: joySnapshotSchema,
  startedAt: z.string(),
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

export const respondInterviewRequestSchema = z.object({
  sessionId: z.string(),
  userMessage: z.string().min(1).max(1200),
  inputMode: z.enum(["text", "voice"]).default("text")
});

export const respondInterviewResponseSchema = z.object({
  assistantMessage: z.string(),
  sessionStatus: z.enum(["active", "completed", "abandoned"]),
  turnCount: z.number().int().nonnegative(),
  snapshot: joySnapshotSchema,
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

export const completeInterviewRequestSchema = z.object({
  sessionId: z.string()
});

export const completeInterviewResponseSchema = z.object({
  session: interviewSessionSchema
});

export const updateJoyEntryRequestSchema = joyEntryDraftSchema.extend({
  title: z.string().max(80),
  content: z.string().max(3000)
});

export const updateJoyEntryResponseSchema = journalEntrySchema;

export const settingsFormSchema = z.object({
  memoryEnabled: z.boolean(),
  transcriptAutoFallbackEnabled: z.boolean()
});

export type StartInterviewRequest = z.infer<typeof startInterviewRequestSchema>;
export type RespondInterviewRequest = z.infer<typeof respondInterviewRequestSchema>;
export type GenerateDraftRequest = z.infer<typeof generateDraftRequestSchema>;
export type SaveDraftRequest = z.infer<typeof saveDraftRequestSchema>;
export type ReopenInterviewRequest = z.infer<typeof reopenInterviewRequestSchema>;
export type CompleteInterviewRequest = z.infer<typeof completeInterviewRequestSchema>;
export type UpdateJoyEntryRequest = z.infer<typeof updateJoyEntryRequestSchema>;
export type SettingsFormValues = z.infer<typeof settingsFormSchema>;
