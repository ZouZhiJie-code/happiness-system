import type { AIRequestStage } from "@prisma/client";

import {
  buildAssistantQuestion,
  createDraft,
  extractJoySignals,
  mergeJoySignals,
  type JoySignalFields
} from "@/features/joy-interview/server/joy-interview-engine";
import {
  joyDraftResultSchema,
  joyExtractResultSchema,
  type JoyDraftResult
} from "@/features/joy-interview/schema/joy-ai.schema";
import {
  buildJoyDraftMessages,
  buildJoyExtractMessages,
  buildJoyQuestionMessages
} from "@/features/joy-interview/prompts/joy-prompts";
import { createAIRequestLog } from "@/server/repositories/joy-interview.repository";
import { logger } from "@/server/lib/logger";
import { getAIProvider } from "@/server/services/ai";
import { AIProviderError } from "@/server/services/ai/ai-provider";
import { completeStructuredOutput } from "@/server/services/ai/structured-output";
import type {
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

export async function generateJoyAssistantMessage(input: {
  dimension: InterviewDimension;
  sessionId: string;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  userMessage: string;
  messages: InterviewSessionRecord["messages"];
}) {
  const fallbackQuestion = buildAssistantQuestion(input.dimension, input.stage, input.snapshot);
  const provider = getAIProvider();
  const messages = buildJoyQuestionMessages({
    dimension: input.dimension,
    stage: input.stage,
    userMessage: input.userMessage,
    snapshot: input.snapshot,
    messages: input.messages
  });

  if (!provider) {
    await logAttempt(input.sessionId, {
      stage: "generate",
      provider: "disabled",
      success: false,
      latencyMs: null,
      errorCode: "QUESTION_PROVIDER_NOT_CONFIGURED"
    });

    return fallbackQuestion;
  }

  try {
    const result = await provider.complete({
      messages,
      temperature: 0.45,
      maxTokens: 180
    });
    const content = normalizeAssistantQuestion(result.content);

    await logAttempt(input.sessionId, {
      stage: "generate",
      provider: result.provider,
      success: true,
      latencyMs: result.latencyMs,
      errorCode: null
    });

    return content || fallbackQuestion;
  } catch (error) {
    await logAttempt(input.sessionId, {
      stage: "generate",
      provider: provider.name,
      success: false,
      latencyMs: null,
      errorCode:
        error instanceof AIProviderError
          ? `QUESTION_${error.code}`
          : error instanceof Error
            ? `QUESTION_${error.name}`
            : "QUESTION_UNKNOWN_ERROR"
    });

    return fallbackQuestion;
  }
}

function normalizeAssistantQuestion(content: string) {
  return content
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/^question\s*[:：]\s*/i, "")
    .trim();
}

export async function streamJoyAssistantMessage(input: {
  dimension: InterviewDimension;
  sessionId: string;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  userMessage: string;
  messages: InterviewSessionRecord["messages"];
}) {
  const fallbackQuestion = buildAssistantQuestion(input.dimension, input.stage, input.snapshot);
  const provider = getAIProvider();
  const messages = buildJoyQuestionMessages({
    dimension: input.dimension,
    stage: input.stage,
    userMessage: input.userMessage,
    snapshot: input.snapshot,
    messages: input.messages
  });

  if (!provider || !provider.stream) {
    const content = await generateJoyAssistantMessage(input);

    return {
      provider: provider?.name ?? "disabled",
      usedFallback: true,
      stream: (async function* () {
        yield content;
      })(),
      fallbackQuestion
    };
  }

  return {
    provider: provider.name,
    usedFallback: false,
    stream: provider.stream({
      messages,
      temperature: 0.45,
      maxTokens: 180
    }),
    fallbackQuestion
  };
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
