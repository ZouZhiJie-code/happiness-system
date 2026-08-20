import { z } from "zod";

import { ENTRY_DATE_REGEX, parseEntryDateInput } from "@/features/interview/entry-date";
import { INTERVIEW_REPLY_MAX_LENGTH } from "@/features/interview/interview-issue";
import {
  countInterviewReplyCharacters,
  normalizeInterviewUserTurnText
} from "@/features/interview/user-turn";
import {
  EVENT_CENTERED_DIALOGUE_PHASES,
  EVENT_CENTERED_QUESTION_SURFACES,
  EVENT_CENTERED_RESPONSE_KINDS
} from "@/types/event-centered-dialogue";
import { JOURNAL_EVENT_ANGLES } from "@/types/journal-event-angle-outcome";

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
  recordMode: z.enum(["capture", "chat"]).nullable().optional().default(null),
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
  entryDate: entryDateSchema,
  recordMode: z.enum(["capture", "chat"]),
  clientOperationId: z.string().trim().min(1).max(120)
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

const eventCenteredQuestionSpecSchema = z.object({
  phase: z.enum(EVENT_CENTERED_DIALOGUE_PHASES),
  angle: z.enum(JOURNAL_EVENT_ANGLES).nullable(),
  target: z.string(),
  opportunityNumber: z.number().int().min(1).max(3).nullable(),
  surfaceLevel: z.enum(EVENT_CENTERED_QUESTION_SURFACES),
  anchorText: z.string().nullable(),
  repairCount: z.number().int().min(0).max(3)
});

const eventCenteredAssistantPayloadSchema = z.object({
  naturalUnderstanding: z.string(),
  naturalResponse: z.string(),
  responseKind: z.enum(EVENT_CENTERED_RESPONSE_KINDS),
  questionSpec: eventCenteredQuestionSpecSchema.nullable(),
  checkpoint: z.object({
    kind: z.enum(["first", "second"]),
    outcome: z.string().nullable()
  }).nullable(),
  angleOutcome: z.object({
    angle: z.enum(JOURNAL_EVENT_ANGLES),
    kind: z.enum(["insight", "honest_limit"]),
    statement: z.string()
  }).nullable()
});

const eventCenteredVisibleOutcomeSchema = z.object({
  angle: z.enum(JOURNAL_EVENT_ANGLES),
  kind: z.enum(["insight", "honest_limit"]),
  statement: z.string()
});

export const eventCenteredWorkspaceSessionSchema = eventCenteredSessionIdentitySchema.extend({
  messages: z.array(z.object({
    id: z.string(),
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
    rawText: z.string(),
    sequence: z.number().int(),
    userTurnId: z.string().nullable(),
    clientTurnId: z.string().nullable().default(null),
    generationTraceId: z.string().nullable().optional(),
    assistantPayload: eventCenteredAssistantPayloadSchema.nullable(),
    responseVersion: z.object({
      groupId: z.string(),
      version: z.number().int().positive(),
      versionCount: z.number().int().positive(),
      canRegenerate: z.boolean(),
      canSwitch: z.boolean(),
      versions: z.array(z.object({
        messageId: z.string(),
        branchSessionId: z.string(),
        version: z.number().int().positive(),
        active: z.boolean()
      }))
    }).nullable(),
    createdAt: z.string()
  })).default([]),
  dialogue: z.object({
    productScope: z.enum(["all_angles", "thought_only"]).optional(),
    phase: z.enum(EVENT_CENTERED_DIALOGUE_PHASES),
    activeAngle: z.enum(JOURNAL_EVENT_ANGLES).nullable(),
    questionOpportunityCount: z.number().int().min(0).max(3),
    focusOptions: z.array(z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      sourceText: z.string().min(1)
    })).max(2).default([]),
    completedAngles: z.array(z.enum(JOURNAL_EVENT_ANGLES)),
    availableAngles: z.array(z.enum(JOURNAL_EVENT_ANGLES)),
    closedAngles: z.array(z.enum(JOURNAL_EVENT_ANGLES)).default([]),
    reopenedAngles: z.array(z.enum(JOURNAL_EVENT_ANGLES)),
    outcomes: z.array(eventCenteredVisibleOutcomeSchema),
    checkpoint: z.object({
      kind: z.enum(["first", "second"]),
      outcome: z.string().nullable()
    }).nullable(),
    allowedActions: z.array(z.enum([
      "reply",
      "select_current_event",
      "select_exploration_angle",
      "continue_exploration",
      "correct_understanding",
      "regenerate_response",
      "switch_response_version",
      "resume_turn",
      "exit_event",
      "generate_event_journal"
    ])),
    progress: z.array(z.object({
      id: z.enum(["record", "reflect", "deepen"]),
      label: z.enum(["轻量记录", "引导复盘", "深入探索"]),
      status: z.enum(["current", "upcoming", "complete"]),
      percent: z.number().min(0).max(100),
      detail: z.string()
    }))
  }).default({
    phase: "event_recording",
    activeAngle: null,
    questionOpportunityCount: 0,
    focusOptions: [],
    completedAngles: [],
    availableAngles: [...JOURNAL_EVENT_ANGLES],
    closedAngles: [],
    reopenedAngles: [],
    outcomes: [],
    checkpoint: null,
    allowedActions: ["reply"],
    progress: [
      { id: "record", label: "轻量记录", status: "current", percent: 0, detail: "辨认这件事" },
      { id: "reflect", label: "引导复盘", status: "upcoming", percent: 0, detail: "选择角度理解" },
      { id: "deepen", label: "深入探索", status: "upcoming", percent: 0, detail: "继续陪伴或收束" }
    ]
  }),
  recovery: z.object({
    pendingTurn: eventCenteredTurnConfirmationSchema.shape.turn.extend({
      errorCode: z.string().nullable(),
      attemptCount: z.number().int().positive()
    }).nullable()
  }).default({ pendingTurn: null }),
  journal: z.object({
    status: z.enum(["not_generated", "generating", "draft", "saved"]),
    entryId: z.string().nullable(),
    eventStatus: z.enum(["active", "generating", "completed", "abandoned"]).nullable()
  }).default({ status: "not_generated", entryId: null, eventStatus: null })
});

export const eventCenteredRespondRequestSchema = z.object({
  action: z.enum([
    "reply",
    "select_current_event",
    "select_exploration_angle",
    "continue_exploration",
    "correct_understanding",
    "regenerate_response",
    "switch_response_version",
    "resume_turn",
    "exit_event"
  ]),
  rootSessionId: z.string().min(1),
  clientTurnId: z.string().min(1),
  baseBranchSessionId: z.string().min(1).optional(),
  baseMessageSequence: z.number().int().min(-1).optional(),
  rawText: z.string().optional(),
  inputMode: z.enum(["text", "voice"]).default("text"),
  targetMessageId: z.string().min(1).optional(),
  targetBranchSessionId: z.string().min(1).optional(),
  angle: z.enum(JOURNAL_EVENT_ANGLES).optional(),
  optionId: z.string().min(1).optional(),
  regenerationIntent: z.enum([
    "simplify",
    "concretize",
    "change_angle",
    "deepen",
    "lighten"
  ]).optional()
}).superRefine((value, context) => {
  if (value.action !== "resume_turn" && (
    !value.baseBranchSessionId || value.baseMessageSequence === undefined
  )) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["baseMessageSequence"], message: "Version is required" });
  }
  if (value.action === "reply" || value.action === "correct_understanding") {
    const rawText = value.rawText ?? "";
    if (!normalizeInterviewUserTurnText(rawText)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["rawText"], message: "Message is required" });
    }
    if (countInterviewReplyCharacters(rawText) > INTERVIEW_REPLY_MAX_LENGTH) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["rawText"], message: "Message is too long" });
    }
  }
  if (value.action === "select_exploration_angle" && !value.angle) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["angle"], message: "Angle is required" });
  }
  if (value.action === "select_current_event" && !value.optionId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["optionId"], message: "Event option is required" });
  }
  if (value.action === "regenerate_response" && (!value.targetMessageId || !value.regenerationIntent)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["targetMessageId"], message: "Regeneration target is required" });
  }
  if (value.action === "switch_response_version" && !value.targetBranchSessionId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["targetBranchSessionId"], message: "Response branch is required" });
  }
});
