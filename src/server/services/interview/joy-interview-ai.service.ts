import type { AIRequestStage } from "@prisma/client";

import { getInterviewDimensionConfig } from "@/features/interview/server/dimension-config";
import {
  buildAssistantQuestion,
  createDraft,
  extractJoySignals,
  mergeJoySignals,
  type JoySignalFields
} from "@/features/joy-interview/server/joy-interview-engine";
import { assistantTurnPayloadSchema } from "@/features/joy-interview/schema/joy-interview.schema";
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
import type { AIChatMessage, AIProvider } from "@/server/services/ai/ai-provider";
import { AIProviderError } from "@/server/services/ai/ai-provider";
import { completeStructuredOutput } from "@/server/services/ai/structured-output";
import type {
  AssistantDepth,
  AssistantTurnPayload,
  InterviewDimension,
  InterviewEventRecord,
  InterviewSessionRecord,
  JoyEntryDraft,
  JoyEventBlock,
  JoyInterviewStage,
  JoySnapshot
} from "@/types/interview";

const ASSISTANT_INSIGHT_MARKER = "<<INSIGHT>>";
const ASSISTANT_QUESTION_MARKER = "<<QUESTION>>";
const assistantMarkers = [
  { marker: ASSISTANT_INSIGHT_MARKER, target: "insight" as const },
  { marker: ASSISTANT_QUESTION_MARKER, target: "question" as const }
];

type AssistantStreamingTarget = "insight" | "question";

export interface AssistantReplySegments {
  insight: string;
  question: string;
}

interface AssistantTurnGenerationInput {
  dimension: InterviewDimension;
  sessionId: string;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  events: InterviewSessionRecord["events"];
  activeEvent: InterviewEventRecord;
  userMessage: string | null;
  messages: InterviewSessionRecord["messages"];
  nextTurnCount: number;
  nextEventTurnCount: number;
  previousDepthReached: AssistantDepth[];
  nextDepthReached: AssistantDepth[];
  coveredLenses: InterviewEventRecord["coveredLenses"];
  roundCoveredLenses: InterviewEventRecord["roundCoveredLenses"];
  isMeaningfulReply: boolean;
  action: "reply" | "continue_current_event";
}

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

async function logAttempt(
  sessionId: string,
  attempt: {
    stage: AIRequestStage;
    provider: string;
    success: boolean;
    latencyMs: number | null;
    errorCode: string | null;
  }
) {
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
  action: "reply" | "continue_current_event";
  snapshot: JoySnapshot;
  stage: JoyInterviewStage;
}) {
  if (input.action === "continue_current_event") {
    return "";
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
  action: "reply" | "continue_current_event";
}): AssistantTurnPayload {
  const question = buildAssistantQuestion(input.dimension, input.stage, input.snapshot);

  return {
    insight: createFallbackInsight({
      action: input.action,
      snapshot: input.snapshot,
      stage: input.stage
    }),
    analysis: "用户已说：已有片段但仍需继续澄清；下一步问：当前阶段对应的未覆盖层次",
    question,
    stateUpdate: {
      turnPhase: input.stage === "collect_event" ? "opening" : "digging",
      shouldEndDimension: false,
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

function buildAssistantAnalysis(input: AssistantTurnGenerationInput) {
  if (input.action === "continue_current_event") {
    return "用户刚刚选择继续深挖当前事件；下一步问：换一个角度继续追问。";
  }

  if (!input.isMeaningfulReply) {
    return "用户这轮信息较少；下一步问：继续用当前阶段问题把事件抓稳。";
  }

  if (input.stage === "collect_event") {
    return "用户已补充新的开心片段；下一步问：把那个具体画面继续说清。";
  }

  if (input.stage === "probe_reason") {
    return "用户已补充事件细节；下一步问：继续确认这件事为什么重要。";
  }

  return "用户已继续补充当前事件；下一步问：推进当前阶段尚未覆盖的层次。";
}

function createAssistantTurnFromSegments(input: AssistantTurnGenerationInput, segments: AssistantReplySegments) {
  return normalizeAssistantTurnPayload({
    insight: trimToLength(segments.insight, 120),
    analysis: buildAssistantAnalysis(input),
    question: trimToLength(segments.question, 160),
    stateUpdate: {
      turnPhase: input.stage === "collect_event" ? "opening" : "digging",
      shouldEndDimension: false,
      offerChoice: false,
      choiceReason: ""
    },
    meta: {
      depthReached: input.nextDepthReached
    }
  });
}

function getQuestionMessages(input: AssistantTurnGenerationInput) {
  return buildJoyQuestionMessages({
    dimension: input.dimension,
    stage: input.stage,
    userMessage: input.userMessage,
    snapshot: input.snapshot,
    events: input.events,
    activeEvent: input.activeEvent,
    messages: input.messages,
    nextTurnCount: input.nextTurnCount,
    nextEventTurnCount: input.nextEventTurnCount,
    previousDepthReached: input.previousDepthReached,
    nextDepthReached: input.nextDepthReached,
    coveredLenses: input.coveredLenses,
    roundCoveredLenses: input.roundCoveredLenses,
    isMeaningfulReply: input.isMeaningfulReply,
    action: input.action
  });
}

function getTrailingMarkerPrefixLength(buffer: string) {
  const candidates = assistantMarkers.map(({ marker }) => marker);

  return candidates.reduce((maxLength, marker) => {
    const limit = Math.min(marker.length - 1, buffer.length);

    for (let length = limit; length > maxLength; length -= 1) {
      if (marker.startsWith(buffer.slice(-length))) {
        return length;
      }
    }

    return maxLength;
  }, 0);
}

function findNextAssistantMarker(buffer: string) {
  let selected:
    | {
        index: number;
        marker: string;
        target: AssistantStreamingTarget;
      }
    | null = null;

  for (const candidate of assistantMarkers) {
    const index = buffer.indexOf(candidate.marker);

    if (index < 0) {
      continue;
    }

    if (!selected || index < selected.index) {
      selected = {
        index,
        marker: candidate.marker,
        target: candidate.target
      };
    }
  }

  return selected;
}

export function createAssistantReplySegmentParser(
  onDelta?: (delta: { target: AssistantStreamingTarget; text: string }) => Promise<void> | void
) {
  let buffer = "";
  let rawText = "";
  let currentTarget: AssistantStreamingTarget | null = null;
  let sawMarker = false;
  const segments: AssistantReplySegments = {
    insight: "",
    question: ""
  };

  async function emit(target: AssistantStreamingTarget, text: string) {
    if (!text) {
      return;
    }

    segments[target] += text;
    await onDelta?.({ target, text });
  }

  async function push(chunk: string) {
    if (!chunk) {
      return;
    }

    rawText += chunk;
    buffer += chunk;

    while (buffer) {
      if (!currentTarget) {
        const nextMarker = findNextAssistantMarker(buffer);

        if (!nextMarker) {
          const trailingPrefixLength = getTrailingMarkerPrefixLength(buffer);
          buffer = trailingPrefixLength ? buffer.slice(-trailingPrefixLength) : "";
          return;
        }

        sawMarker = true;
        buffer = buffer.slice(nextMarker.index + nextMarker.marker.length);
        currentTarget = nextMarker.target;
        continue;
      }

      if (currentTarget === "insight") {
        const questionIndex = buffer.indexOf(ASSISTANT_QUESTION_MARKER);

        if (questionIndex >= 0) {
          await emit("insight", buffer.slice(0, questionIndex));
          buffer = buffer.slice(questionIndex + ASSISTANT_QUESTION_MARKER.length);
          currentTarget = "question";
          sawMarker = true;
          continue;
        }

        const trailingPrefixLength = getTrailingMarkerPrefixLength(buffer);
        const safeText = trailingPrefixLength ? buffer.slice(0, -trailingPrefixLength) : buffer;
        buffer = trailingPrefixLength ? buffer.slice(-trailingPrefixLength) : "";
        await emit("insight", safeText);
        return;
      }

      await emit("question", buffer);
      buffer = "";
    }
  }

  async function finish() {
    if (!sawMarker) {
      await emit("question", rawText);
      rawText = "";
      buffer = "";
    } else if (buffer) {
      if (currentTarget) {
        await emit(currentTarget, buffer);
      }

      buffer = "";
    }

    return {
      insight: trimToLength(segments.insight, 120),
      question: trimToLength(segments.question, 160)
    } satisfies AssistantReplySegments;
  }

  return {
    push,
    finish
  };
}

async function runAssistantQuestionAttempt(input: {
  provider: AIProvider;
  sessionId: string;
  messages: AIChatMessage[];
  stream: boolean;
  onDelta?: (delta: { target: AssistantStreamingTarget; text: string }) => Promise<void> | void;
}) {
  const parser = createAssistantReplySegmentParser(input.onDelta);
  const startedAt = Date.now();

  if (input.stream) {
    for await (const chunk of input.provider.stream!({
      messages: input.messages,
      temperature: 0.45,
      maxTokens: 500
    })) {
      await parser.push(chunk);
    }
  } else {
    const result = await input.provider.complete({
      messages: input.messages,
      temperature: 0.45,
      maxTokens: 500
    });

    await parser.push(result.content);
  }

  const segments = await parser.finish();
  const hasMeaningfulOutput = Boolean(segments.insight || segments.question);

  if (!hasMeaningfulOutput) {
    await logAttempt(input.sessionId, {
      stage: "generate",
      provider: input.provider.name,
      success: false,
      latencyMs: Date.now() - startedAt,
      errorCode: "QUESTION_EMPTY_OUTPUT"
    });

    return null;
  }

  await logAttempt(input.sessionId, {
    stage: "generate",
    provider: input.provider.name,
    success: true,
    latencyMs: Date.now() - startedAt,
    errorCode: null
  });

  return segments;
}

async function requestAssistantReplySegments(
  input: AssistantTurnGenerationInput,
  onDelta?: (delta: { target: AssistantStreamingTarget; text: string }) => Promise<void> | void
) {
  const provider = getAIProvider();

  if (!provider) {
    await logAttempt(input.sessionId, {
      stage: "generate",
      provider: "disabled",
      success: false,
      latencyMs: null,
      errorCode: "QUESTION_PROVIDER_NOT_CONFIGURED"
    });

    return null;
  }

  const messages = getQuestionMessages(input);
  const attempts: boolean[] = onDelta && provider.stream ? [true, false] : [false];

  for (const useStream of attempts) {
    try {
      const result = await runAssistantQuestionAttempt({
        provider,
        sessionId: input.sessionId,
        messages,
        stream: useStream,
        onDelta
      });

      if (result) {
        return result;
      }
    } catch (error) {
      await logAttempt(input.sessionId, {
        stage: "generate",
        provider: provider.name,
        success: false,
        latencyMs: null,
        errorCode:
          error instanceof AIProviderError ? `QUESTION_${error.code}` : error instanceof Error ? `QUESTION_${error.name}` : "QUESTION_UNKNOWN_ERROR"
      });
    }
  }

  return null;
}

export async function generateJoyAssistantTurn(input: AssistantTurnGenerationInput) {
  const fallbackTurn = createFallbackAssistantTurn({
    dimension: input.dimension,
    stage: input.stage,
    snapshot: input.snapshot,
    nextDepthReached: input.nextDepthReached,
    action: input.action
  });

  const segments = await requestAssistantReplySegments(input);

  if (!segments) {
    logger.warn({ sessionId: input.sessionId }, "AI assistant turn unavailable, fallback turn will be used.");
    return fallbackTurn;
  }

  return createAssistantTurnFromSegments(input, segments);
}

export async function streamJoyAssistantTurn(
  input: AssistantTurnGenerationInput,
  callbacks: {
    onDelta: (delta: { target: AssistantStreamingTarget; text: string }) => Promise<void> | void;
  }
) {
  const fallbackTurn = createFallbackAssistantTurn({
    dimension: input.dimension,
    stage: input.stage,
    snapshot: input.snapshot,
    nextDepthReached: input.nextDepthReached,
    action: input.action
  });

  const segments = await requestAssistantReplySegments(input, callbacks.onDelta);

  if (!segments) {
    logger.warn({ sessionId: input.sessionId }, "AI assistant turn unavailable, fallback turn will be used.");
    return fallbackTurn;
  }

  return createAssistantTurnFromSegments(input, segments);
}

function buildEventBlocks(events: InterviewEventRecord[]): JoyEventBlock[] {
  return events.map((event) => ({
    eventId: event.id,
    sequence: event.sequence,
    explorationRound: event.explorationRound,
    event: sanitizeNullableString(event.snapshot.event),
    feeling: sanitizeNullableString(event.snapshot.feeling),
    whyItMattered: sanitizeNullableString(event.snapshot.whyItMattered),
    happinessType: sanitizeNullableString(event.snapshot.happinessType),
    selfPattern: sanitizeNullableString(event.snapshot.selfPattern)
  }));
}

function getActiveSessionEvent(session: InterviewSessionRecord) {
  return (
    session.events.find((event) => event.id === session.activeEventId) ??
    session.events[session.events.length - 1]
  );
}

function getDraftSourceEvents(session: InterviewSessionRecord) {
  const candidates = session.events.filter((event) =>
    Boolean(
      event.snapshot.event ||
        event.snapshot.feeling ||
        event.snapshot.whyItMattered ||
        event.snapshot.happinessType ||
        event.snapshot.selfPattern
    )
  );

  const fallbackEvent = getActiveSessionEvent(session);

  return candidates.length ? candidates : fallbackEvent ? [fallbackEvent] : [];
}

function buildFallbackDraft(session: InterviewSessionRecord, sourceEvents: InterviewEventRecord[]): JoyEntryDraft {
  if (sourceEvents.length <= 1) {
    return {
      ...createDraft(session.dimension, sourceEvents[0]?.snapshot ?? session.snapshot),
      eventBlocks: buildEventBlocks(sourceEvents)
    };
  }

  const config = getInterviewDimensionConfig(session.dimension);
  const content = sourceEvents
    .slice(0, 3)
    .map((event, index) => {
      const intro = index === 0 ? "今天先有一件事让我很想记住" : index === 1 ? "后来还有一件事让我继续开心" : "另外还有一个片段";
      const eventText = sanitizeNullableString(event.snapshot.event) ?? "一段让我记住的片段";
      const reasonText = sanitizeNullableString(event.snapshot.whyItMattered);
      const feelingText = sanitizeNullableString(event.snapshot.feeling);
      const tail = reasonText
        ? `它之所以重要，是因为${reasonText.replace(/^因为/, "")}。`
        : feelingText
          ? `当时我的感受是${feelingText}。`
          : "";

      return `${intro}：${eventText}。${tail}`;
    })
    .join("\n");

  return {
    title: `${config.draftTitlePrefix}：今天的几个瞬间`.slice(0, 20),
    content,
    event: null,
    feeling: null,
    whyItMattered: null,
    happinessType: null,
    selfPattern: null,
    tags: Array.from(
      new Set(
        sourceEvents.flatMap((event) => [event.snapshot.happinessType, event.snapshot.feeling].filter(Boolean) as string[])
      )
    ).slice(0, 5),
    eventBlocks: buildEventBlocks(sourceEvents),
    source: "ai_draft_direct"
  };
}

function normalizeDraftResult(
  draft: Omit<JoyDraftResult, "eventBlocks"> & { eventBlocks?: JoyEventBlock[] },
  fallbackEventBlocks: JoyEventBlock[]
): JoyEntryDraft {
  return {
    title: draft.title.trim(),
    content: draft.content.trim(),
    event: sanitizeNullableString(draft.event),
    feeling: sanitizeNullableString(draft.feeling),
    whyItMattered: sanitizeNullableString(draft.whyItMattered),
    happinessType: sanitizeNullableString(draft.happinessType),
    selfPattern: sanitizeNullableString(draft.selfPattern),
    tags: Array.from(new Set(draft.tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 5),
    eventBlocks: draft.eventBlocks?.length ? draft.eventBlocks : fallbackEventBlocks,
    source: "ai_draft_direct"
  };
}

export async function generateJoyDraftWithAI(session: InterviewSessionRecord) {
  const sourceEvents = getDraftSourceEvents(session);
  const fallbackDraft = buildFallbackDraft(session, sourceEvents);
  const fallbackEventBlocks = buildEventBlocks(sourceEvents);
  const provider = getAIProvider();
  const aiResult = await completeStructuredOutput({
    provider,
    stage: "generate",
    schema: joyDraftResultSchema,
    messages: buildJoyDraftMessages({
      dimension: session.dimension,
      events: sourceEvents,
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

  return normalizeDraftResult(aiResult, fallbackEventBlocks);
}
