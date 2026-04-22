import type { AIRequestStage } from "@prisma/client";

import { buildAssistantQuestion, createDraft, extractJoySignals, mergeJoySignals, type JoySignalFields } from "@/features/joy-interview/server/joy-interview-engine";
import { assistantTurnPayloadSchema } from "@/features/joy-interview/schema/joy-interview.schema";
import { joyDraftResultSchema, joyExtractResultSchema, type JoyDraftResult } from "@/features/joy-interview/schema/joy-ai.schema";
import { buildJoyDraftMessages, buildJoyExtractMessages, buildJoyQuestionMessages } from "@/features/joy-interview/prompts/joy-prompts";
import { createAIRequestLog } from "@/server/repositories/joy-interview.repository";
import { logger } from "@/server/lib/logger";
import { getAIProvider } from "@/server/services/ai";
import { completeStructuredOutput } from "@/server/services/ai/structured-output";
import type {
  AssistantDepth,
  AssistantTurnPayload,
  InterviewDimension,
  InterviewSessionRecord,
  JoyEntryDraft,
  JoyInterviewStage,
  JoySnapshot
} from "@/types/interview";

function sanitizeNullableString(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function trimToLength(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeExtractedFields(fields: JoySignalFields): JoySignalFields {
  return {
    event: sanitizeNullableString(fields.event),
    feeling: sanitizeNullableString(fields.feeling),
    whyItMattered: sanitizeNullableString(fields.whyItMattered),
    happinessType: sanitizeNullableString(fields.happinessType),
    selfPattern: sanitizeNullableString(fields.selfPattern)
  };
}

async function logAttempt(sessionId: string, attempt: {
  stage: AIRequestStage;
  provider: string;
  success: boolean;
  latencyMs: number | null;
  errorCode: string | null;
}) {
  await createAIRequestLog({
    sessionId,
    stage: attempt.stage,
    provider: attempt.provider,
    success: attempt.success,
    latencyMs: attempt.latencyMs,
    errorCode: attempt.errorCode
  });
}

export async function extractJoySnapshotWithAI(input: {
  session: InterviewSessionRecord;
  userMessage: string;
}): Promise<JoySnapshot> {
  const fallbackSnapshot = extractJoySignals(input.session.dimension, input.userMessage, input.session.snapshot);
  const provider = getAIProvider();
  const aiResult = await completeStructuredOutput({
    provider,
    stage: "extract",
    schema: joyExtractResultSchema,
    messages: buildJoyExtractMessages({
      dimension: input.session.dimension,
      stage: input.session.stage,
      turnCount: input.session.turnCount + 1,
      lastAssistantQuestion: input.session.lastAssistantQuestion,
      userMessage: input.userMessage,
      snapshot: input.session.snapshot,
      messages: input.session.messages
    }),
    temperature: 0.15,
    maxTokens: 500,
    onAttempt: (attempt) => logAttempt(input.session.id, attempt)
  });

  if (!aiResult) {
    logger.warn({ sessionId: input.session.id }, "AI extraction unavailable, fallback snapshot will be used.");

    return fallbackSnapshot;
  }

  return mergeJoySignals(input.session.snapshot, normalizeExtractedFields(aiResult));
}

function createFallbackInsight(input: {
  continueFromChoice: boolean;
  snapshot: JoySnapshot;
  stage: JoyInterviewStage;
}) {
  if (input.continueFromChoice) {
    return "我们换个角度，把这段经历再看清一点。";
  }

  if (!input.snapshot.event || input.stage === "collect_event") {
    return "先把那个具体片段抓稳，我们再往下走。";
  }

  if (!input.snapshot.whyItMattered || input.stage === "probe_reason") {
    return "这个片段已经有轮廓了，还差它为什么重要。";
  }

  if (!input.snapshot.happinessType && !input.snapshot.selfPattern) {
    return "你已经说到它的重要性了，接下来可以往更深的线索走。";
  }

  return "这段经历背后的线索已经开始清楚了。";
}

function createFallbackAssistantTurn(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  nextDepthReached: AssistantDepth[];
  continueFromChoice: boolean;
}): AssistantTurnPayload {
  const question = buildAssistantQuestion(input.dimension, input.stage, input.snapshot);

  return {
    insight: createFallbackInsight({
      continueFromChoice: input.continueFromChoice,
      snapshot: input.snapshot,
      stage: input.stage
    }),
    analysis: "用户已说：已有片段但仍需继续澄清；下一步问：当前阶段对应的未覆盖层次",
    question,
    stateUpdate: {
      turnPhase: input.stage === "wrap_up" ? "closing" : input.continueFromChoice ? "digging" : "digging",
      shouldEndDimension: input.stage === "wrap_up",
      offerChoice: false,
      choiceReason: ""
    },
    meta: {
      depthReached: input.nextDepthReached
    }
  };
}

function normalizeAssistantTurnPayload(payload: AssistantTurnPayload): AssistantTurnPayload {
  const parsed = assistantTurnPayloadSchema.safeParse(payload);

  if (parsed.success) {
    return {
      ...parsed.data,
      meta: {
        depthReached: parsed.data.meta.depthReached
      }
    };
  }

  return {
    insight: trimToLength(payload.insight ?? "", 120),
    analysis: trimToLength(payload.analysis ?? "", 240),
    question: trimToLength(payload.question ?? "", 160),
    stateUpdate: {
      turnPhase: payload.stateUpdate?.turnPhase ?? "digging",
      shouldEndDimension: Boolean(payload.stateUpdate?.shouldEndDimension),
      offerChoice: Boolean(payload.stateUpdate?.offerChoice),
      choiceReason: trimToLength(payload.stateUpdate?.choiceReason ?? "", 160)
    },
    meta: {
      depthReached: payload.meta?.depthReached ?? []
    }
  };
}

export async function generateJoyAssistantTurn(input: {
  dimension: InterviewDimension;
  sessionId: string;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  userMessage: string | null;
  messages: InterviewSessionRecord["messages"];
  nextTurnCount: number;
  previousDepthReached: AssistantDepth[];
  nextDepthReached: AssistantDepth[];
  recentQuestions: string[];
  consecutiveNoDepthGain: number;
  consecutiveInvalidReplies: number;
  isMeaningfulReply: boolean;
  continueFromChoice: boolean;
}) {
  const fallbackTurn = createFallbackAssistantTurn({
    dimension: input.dimension,
    stage: input.stage,
    snapshot: input.snapshot,
    nextDepthReached: input.nextDepthReached,
    continueFromChoice: input.continueFromChoice
  });
  const provider = getAIProvider();
  const messages = buildJoyQuestionMessages({
    dimension: input.dimension,
    stage: input.stage,
    userMessage: input.userMessage,
    snapshot: input.snapshot,
    messages: input.messages,
    nextTurnCount: input.nextTurnCount,
    previousDepthReached: input.previousDepthReached,
    nextDepthReached: input.nextDepthReached,
    recentQuestions: input.recentQuestions,
    consecutiveNoDepthGain: input.consecutiveNoDepthGain,
    consecutiveInvalidReplies: input.consecutiveInvalidReplies,
    isMeaningfulReply: input.isMeaningfulReply,
    continueFromChoice: input.continueFromChoice
  });
  const aiResult = await completeStructuredOutput({
    provider,
    stage: "generate",
    schema: assistantTurnPayloadSchema,
    messages,
    temperature: 0.45,
    maxTokens: 500,
    onAttempt: (attempt) =>
      logAttempt(input.sessionId, {
        ...attempt,
        errorCode: attempt.errorCode ? `QUESTION_${attempt.errorCode}` : null
      })
  });

  if (!aiResult) {
    logger.warn({ sessionId: input.sessionId }, "AI assistant turn unavailable, fallback turn will be used.");
    return fallbackTurn;
  }

  return normalizeAssistantTurnPayload(aiResult);
}

function normalizeDraftResult(draft: JoyDraftResult): JoyEntryDraft {
  return {
    title: draft.title.trim(),
    content: draft.content.trim(),
    event: sanitizeNullableString(draft.event),
    feeling: sanitizeNullableString(draft.feeling),
    whyItMattered: sanitizeNullableString(draft.whyItMattered),
    happinessType: sanitizeNullableString(draft.happinessType),
    selfPattern: sanitizeNullableString(draft.selfPattern),
    tags: Array.from(new Set(draft.tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 5),
    source: "ai_draft_direct"
  };
}

export async function generateJoyDraftWithAI(session: InterviewSessionRecord) {
  const fallbackDraft = createDraft(session.dimension, session.snapshot);
  const provider = getAIProvider();
  const aiResult = await completeStructuredOutput({
    provider,
    stage: "generate",
    schema: joyDraftResultSchema,
    messages: buildJoyDraftMessages({
      dimension: session.dimension,
      snapshot: session.snapshot,
      messages: session.messages
    }),
    temperature: 0.35,
    maxTokens: 700,
    onAttempt: (attempt) =>
      logAttempt(session.id, {
        ...attempt,
        errorCode: attempt.errorCode ? `DRAFT_${attempt.errorCode}` : null
      })
  });

  if (!aiResult) {
    logger.warn({ sessionId: session.id }, "AI draft generation unavailable, fallback draft will be used.");

    return fallbackDraft;
  }

  return normalizeDraftResult(aiResult);
}
