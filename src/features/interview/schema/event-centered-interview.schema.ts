import { z } from "zod";

import { ENTRY_DATE_REGEX, parseEntryDateInput } from "@/features/interview/entry-date";
import { INTERVIEW_REPLY_MAX_LENGTH } from "@/features/interview/interview-issue";
import {
  countInterviewReplyCharacters,
  normalizeInterviewUserTurnText
} from "@/features/interview/user-turn";

const entryDateSchema = z.string().regex(ENTRY_DATE_REGEX).refine((value) => {
  try {
    parseEntryDateInput(value);
    return true;
  } catch {
    return false;
  }
}, "Invalid entry date");

const journalEventSchema = z.object({
  id: z.string(),
  entryDate: entryDateSchema,
  daySequence: z.number().int().positive(),
  status: z.enum(["active", "generating", "completed", "abandoned"]),
  startedAt: z.string(),
  generationStartedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  abandonedAt: z.string().nullable()
});

export const eventCenteredSessionIdentitySchema = z.object({
  mode: z.literal("event_centered"),
  rootSessionId: z.string(),
  activeBranchSessionId: z.string(),
  eventId: z.string().nullable(),
  branchStateId: z.string().nullable(),
  entryDate: entryDateSchema,
  conversationSchemaVersion: z.number().int().min(3),
  sessionStatus: z.enum(["active", "completed", "abandoned"]),
  eventStatus: z.enum(["active", "generating", "completed", "abandoned"]).nullable(),
  latestMessageSequence: z.number().int().min(-1),
  journalEvent: journalEventSchema.nullable()
});

export const startEventCenteredSessionRequestSchema = z.object({
  entryDate: entryDateSchema
});

export const reserveEventCenteredTurnRequestSchema = z.object({
  rootSessionId: z.string().min(1),
  clientTurnId: z.string().min(1),
  rawText: z.string(),
  inputMode: z.enum(["text", "voice"]).default("text"),
  baseMessageSequence: z.number().int().min(-1),
  baseBranchSessionId: z.string().min(1)
}).superRefine((value, context) => {
  if (!normalizeInterviewUserTurnText(value.rawText)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["rawText"], message: "Message is required" });
  }
  if (countInterviewReplyCharacters(value.rawText) > INTERVIEW_REPLY_MAX_LENGTH) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["rawText"], message: "Message is too long" });
  }
});

export const eventCenteredTurnConfirmationSchema = z.object({
  kind: z.enum(["reserved", "existing"]),
  eventId: z.string(),
  rootSessionId: z.string(),
  activeBranchSessionId: z.string(),
  branchStateId: z.string(),
  userMessageId: z.string(),
  turn: z.object({
    id: z.string(),
    clientTurnId: z.string(),
    sessionId: z.string(),
    rawText: z.string(),
    inputMode: z.enum(["text", "voice"]),
    baseMessageSequence: z.number().int().min(-1),
    status: z.enum(["processing", "completed", "failed", "canceled"]),
    createdAt: z.string()
  })
});
