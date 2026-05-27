import type { AIRequestStage } from "@prisma/client";

import {
  buildDraftBrief,
  buildDraftWritingProfile,
  createFallbackDraft,
  runDraftQualityGate
} from "@/features/interview/server/draft-policies";
import { buildSemanticJournalTitle } from "@/features/interview/journal-title";
import {
  applyQuestionSurfaceProtocol,
  createQuestionSpec,
  inferQuestionSpecFromQuestion,
  resolveQuestionFromSpec
} from "@/features/joy-interview/server/question-protocol";
import {
  buildAssistantQuestion,
  extractJoySignals,
  getDelightSignature,
  getDirectionSignal,
  getDurability,
  getJoyMoment,
  getJoyPsychProfile,
  getJoySource,
  getJoyTags,
  getManualClue,
  getMeaningNeed,
  getStateShift,
  getValueImpact,
  isUsableJoyDelightSignature,
  mergeJoySignals,
  type JoySignalFields
} from "@/features/joy-interview/server/joy-interview-engine";
import { assistantTurnPayloadSchema } from "@/features/joy-interview/schema/joy-interview.schema";
import {
  fulfillmentExtractResultSchema,
  gratitudeExtractResultSchema,
  improvementExtractResultSchema,
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
  AssistantQuestionSpec,
  AssistantTurnPayload,
  InterviewDimension,
  InterviewEventRecord,
  InterviewSessionRecord,
  JoyEntryDraft,
  JoyEventBlock,
  JoyInterviewStage,
  JoySnapshot
} from "@/types/interview";

const ASSISTANT_SUMMARY_MARKER = "<<SUMMARY>>";
const ASSISTANT_LEGACY_INSIGHT_MARKER = "<<INSIGHT>>";
const ASSISTANT_QUESTION_MARKER = "<<QUESTION>>";
const assistantMarkers = [
  { marker: ASSISTANT_SUMMARY_MARKER, target: "summary" as const },
  { marker: ASSISTANT_LEGACY_INSIGHT_MARKER, target: "summary" as const },
  { marker: ASSISTANT_QUESTION_MARKER, target: "question" as const }
];

type AssistantStreamingTarget = "summary" | "question";
type DraftGenerationMode = "initial_generate" | "refresh_minor" | "refresh_major";

export interface AssistantReplySegments {
  thinkingSummary: string;
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
  questionSpec?: AssistantQuestionSpec | null;
  memoryContext?: string | null;
}

function sanitizeNullableString(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function trimTrailingPunctuation(value: string) {
  return value.replace(/[，。！？；：,.!?;:\s]+$/u, "").trim();
}

function normalizeGratitudeTarget(value: string | null | undefined) {
  const normalized = sanitizeNullableString(value);

  if (!normalized) {
    return null;
  }

  const directRoleMatch = normalized.match(/(她|他|对方|同事|朋友|家人|老师|伴侣)/u);

  if (directRoleMatch) {
    return directRoleMatch[1] ?? normalized;
  }

  return normalized.replace(/^(的是|是|那个|这位)/u, "").trim() || null;
}

function normalizeSeenNeed(value: string | null | undefined) {
  const normalized = sanitizeNullableString(value);

  if (!normalized) {
    return null;
  }

  const cleaned = trimTrailingPunctuation(
    normalized
      .replace(/^(这让我觉得|让我觉得|我觉得)/u, "")
      .replace(/^(自己|我自己)/u, "我")
      .trim()
  );

  const seenAndReliefMatch = cleaned.match(
    /^(我当时的[^，。！？!?]{0,60}?)(?:被看见了|被接住了|被理解了)[，,]?(不用硬撑着一边听一边记)$/u
  );

  if (seenAndReliefMatch) {
    return `${seenAndReliefMatch[1]}，以及${seenAndReliefMatch[2]}的难处`;
  }

  const needAndReliefMatch = cleaned.match(/^(我当时的[^，。！？!?]{0,60}?)[，,](不用硬撑着一边听一边记)$/u);

  if (needAndReliefMatch) {
    return `${needAndReliefMatch[1]}，以及${needAndReliefMatch[2]}的难处`;
  }

  return (
    cleaned
      .replace(/^(我当时的[^，。！？!?]{0,60}?)(?:被看见了|被接住了|被理解了)(?=[，。！？!?]|$)/u, "$1")
      .trim() || null
  );
}

function normalizeGratitudeKindAction(value: string | null | undefined) {
  const normalized = sanitizeNullableString(value);

  if (!normalized) {
    return null;
  }

  return (
    normalized
      .replace(/^(?:而是|不是|是真的|真的是)/u, "")
      .replace(/^她没有只说辛苦了[，,]?而是/u, "")
      .trim() || null
  );
}

function normalizeGratitudeReason(value: string | null | undefined) {
  const normalized = sanitizeNullableString(value);

  if (!normalized) {
    return null;
  }

  const cleaned =
    trimTrailingPunctuation(
      normalized
        .replace(/^(?:这让我觉得|让我觉得)/u, "")
        .replace(/^(?:觉得|感觉到?|感到)/u, "")
        .replace(/^(?:自己|我自己)/u, "我")
        .replace(/被看见了，被看见了/u, "被看见了")
        .trim()
    ) || null;

  if (!cleaned) {
    return null;
  }

  const seenAndReliefMatch = cleaned.match(
    /^(我当时的[^，。！？!?]{0,60}?)(?:被看见了|被接住了|被理解了)[，,]?(不用硬撑着一边听一边记)$/u
  );

  if (seenAndReliefMatch) {
    return `${seenAndReliefMatch[1]}，以及${seenAndReliefMatch[2]}的难处`;
  }

  const needAndReliefMatch = cleaned.match(/^(我当时的[^，。！？!?]{0,60}?)[，,](不用硬撑着一边听一边记)$/u);

  return needAndReliefMatch ? `${needAndReliefMatch[1]}，以及${needAndReliefMatch[2]}的难处` : cleaned;
}

function normalizeGratitudeDraftContent(content: string) {
  return content
    .replace(/而是她没有只说辛苦了当时/g, "而是她当时")
    .replace(/对方像是看见了自己当时的/g, "对方像是看见了我当时的")
    .replace(
      /对方像是看见了我当时的([^，。！？!?]{0,60})被看见了[，,]?不用硬撑着一边听一边记/g,
      "对方像是看见了我当时的$1，以及不用硬撑着一边听一边记的难处"
    )
    .replace(/对方像是看见了我当时的([^，。！？!?]{0,60})被看见了/g, "对方像是看见了我当时的$1")
    .replace(
      /对方像是看见了我当时的([^，。！？!?]{0,60})，?不用硬撑着一边听一边记/g,
      "对方像是看见了我当时的$1，以及不用硬撑着一边听一边记的难处"
    )
    .replace(/被看见了，不用硬撑着一边听一边记被看见了/g, "被看见了，不用硬撑着一边听一边记");
}

function hasGratitudeDraftCorruption(content: string) {
  return /而是她没有只说辛苦了当时|的是她没有只说辛苦了|对方像是看见了自己当时的|对方像是看见了我当时的[^，。！？!?]{0,60}被看见了|被看见了，不用硬撑着一边听一边记被看见了/u.test(
    content
  );
}

function hasCorruptedGratitudeFields(draft: JoyEntryDraft) {
  return Boolean(
    /的是她没有只说辛苦了/u.test(draft.gratitudeTarget ?? "") ||
      /自己当时的慌和虚弱被看见了/u.test(draft.seenNeed ?? "") ||
      /自己当时的慌和虚弱被看见了/u.test(draft.gratitudeReason ?? "") ||
      /她没有只说辛苦了/u.test(draft.content)
  );
}

function normalizeFulfillmentProgressEvidence(value: string | null | undefined) {
  const normalized = sanitizeNullableString(value);

  if (!normalized) {
    return null;
  }

  return (
    normalized
      .replace(/^(?:最有分量的是|真正有分量的是|关键是|最重要的是)[，,]?/u, "")
      .trim() || null
  );
}

function normalizeFulfillmentValueSignal(value: string | null | undefined) {
  const normalized = sanitizeNullableString(value);

  if (!normalized) {
    return null;
  }

  return normalized.replace(/^对我来说[，,]?/u, "").trim() || null;
}

function normalizeFulfillmentDraftContent(content: string) {
  return content
    .replace(/是最有分量的是/g, "是")
    .replace(/这件事真正有分量的地方，是最有分量的是/g, "这件事真正有分量的地方，是")
    .replace(/回头看，我也更知道，对我来说，对我来说，/g, "回头看，我也更知道，对我来说，")
    .replace(/对我来说，对我来说，/g, "对我来说，")
    .replace(/才会觉得这一天算数才会真正算数/g, "才会觉得这一天算数");
}

function trimToLength(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeContentUnit(value: string) {
  return value.replace(/\s+/g, "").replace(/[，。！？；：,.!?;:、“”"'（）()【】\[\]《》]/gu, "");
}

function dedupeDraftParagraphs(content: string) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const paragraph of paragraphs) {
    const normalized = normalizeContentUnit(paragraph);

    if (normalized.length >= 12 && seen.has(normalized)) {
      continue;
    }

    if (normalized.length >= 12) {
      seen.add(normalized);
    }

    const sentenceSeen = new Set<string>();
    const dedupedSentences = paragraph
      .split(/(?<=[。！？!?])/u)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .filter((sentence) => {
        const normalizedSentence = normalizeContentUnit(sentence);

        if (normalizedSentence.length < 12) {
          return true;
        }

        if (sentenceSeen.has(normalizedSentence)) {
          return false;
        }

        sentenceSeen.add(normalizedSentence);
        return true;
      })
      .join("");

    deduped.push(dedupedSentences || paragraph);
  }

  return deduped.join("\n\n").trim();
}

function normalizeDraftTitle(title: string, brief: ReturnType<typeof buildDraftBrief>) {
  return buildSemanticJournalTitle({
    dimension: brief.dimension,
    draftBrief: brief,
    aiTitle: title,
    fallbackTitle: brief.titleHint ?? brief.anchorScene ?? "今天记下的片刻"
  });
}

function cloneExistingDraft(entry: InterviewSessionRecord["journalEntry"]): JoyEntryDraft | null {
  if (!entry) {
    return null;
  }

  return {
    title: entry.title,
    content: entry.content,
    event: entry.event,
    feeling: entry.feeling,
    whyItMattered: entry.whyItMattered,
    happinessType: entry.happinessType,
    selfPattern: entry.selfPattern,
    joyMoment: entry.joyMoment,
    joySource: entry.joySource,
    stateShift: entry.stateShift,
    meaningNeed: entry.meaningNeed,
    manualClue: entry.manualClue,
    delightSignature: entry.delightSignature,
    directionSignal: entry.directionSignal,
    valueImpact: entry.valueImpact,
    durability: entry.durability,
    psychProfile: entry.psychProfile,
    improvementTrack: entry.improvementTrack,
    stateAssessment: entry.stateAssessment,
    frictionPoint: entry.frictionPoint,
    repeatCondition: entry.repeatCondition,
    controllableFactor: entry.controllableFactor,
    nextAttempt: entry.nextAttempt,
    successSignal: entry.successSignal,
    gratitudeMoment: entry.gratitudeMoment,
    gratitudeTarget: entry.gratitudeTarget,
    kindAction: entry.kindAction,
    seenNeed: entry.seenNeed,
    innerEffect: entry.innerEffect,
    gratitudeReason: entry.gratitudeReason,
    gratitudeType: entry.gratitudeType,
    relationshipSignal: entry.relationshipSignal,
    reciprocityHint: entry.reciprocityHint,
    tags: entry.tags,
    eventBlocks: entry.eventBlocks,
    source: entry.source
  };
}

function resolveDraftGenerationMode(session: InterviewSessionRecord, sourceEvents: InterviewEventRecord[]): DraftGenerationMode {
  const existingDraft = session.journalEntry;

  if (!existingDraft) {
    return "initial_generate";
  }

  const existingPrimaryEventId = existingDraft.eventBlocks[0]?.eventId ?? null;
  const nextPrimaryEventId = sourceEvents[0]?.id ?? null;
  const existingEventCount = existingDraft.eventBlocks.length;
  const nextEventCount = sourceEvents.length;
  const existingTrack = existingDraft.payload?.kind === "joy" ? existingDraft.payload.psychProfile?.track ?? null : null;
  const nextTrack = session.snapshot.psychProfile?.track ?? null;

  if (
    (existingPrimaryEventId && nextPrimaryEventId && existingPrimaryEventId !== nextPrimaryEventId) ||
    nextEventCount > existingEventCount ||
    (existingTrack && nextTrack && existingTrack !== nextTrack)
  ) {
    return "refresh_major";
  }

  return "refresh_minor";
}

function getDraftGenerationOptions(mode: DraftGenerationMode) {
  switch (mode) {
    case "initial_generate":
      return {
        timeoutMs: 12_000,
        maxAttempts: 1,
        maxTokens: 700,
        messageWindow: 8,
        eventWindow: 3
      };
    case "refresh_major":
      return {
        timeoutMs: 11_000,
        maxAttempts: 1,
        maxTokens: 640,
        messageWindow: 8,
        eventWindow: 3
      };
    case "refresh_minor":
      return {
        timeoutMs: 8_000,
        maxAttempts: 1,
        maxTokens: 520,
        messageWindow: 6,
        eventWindow: 2
      };
  }
}

function normalizeExtractedFields(fields: JoySignalFields): JoySignalFields {
  return {
    event: sanitizeNullableString(fields.event ?? fields.experience ?? fields.situation),
    feeling: sanitizeNullableString(fields.feeling),
    whyItMattered: sanitizeNullableString(fields.whyItMattered ?? fields.progressEvidence ?? fields.frictionPoint ?? fields.repeatCondition),
    happinessType: sanitizeNullableString(fields.happinessType ?? fields.fulfillmentType ?? fields.improvementType),
    selfPattern: sanitizeNullableString(fields.selfPattern ?? fields.valueSignal ?? fields.nextAttempt),
    joyMoment: sanitizeNullableString(fields.joyMoment),
    joySource: sanitizeNullableString(fields.joySource),
    stateShift: sanitizeNullableString(fields.stateShift),
    meaningNeed: sanitizeNullableString(fields.meaningNeed),
    manualClue: sanitizeNullableString(fields.manualClue),
    delightSignature: sanitizeNullableString(fields.delightSignature),
    directionSignal: sanitizeNullableString(fields.directionSignal),
    valueImpact: sanitizeNullableString(fields.valueImpact),
    durability: sanitizeNullableString(fields.durability),
    improvementTrack: fields.improvementTrack ?? null,
    stateAssessment: sanitizeNullableString(fields.stateAssessment),
    frictionPoint: sanitizeNullableString(fields.frictionPoint),
    repeatCondition: sanitizeNullableString(fields.repeatCondition),
    controllableFactor: sanitizeNullableString(fields.controllableFactor),
    nextAttempt: sanitizeNullableString(fields.nextAttempt),
    successSignal: sanitizeNullableString(fields.successSignal),
    gratitudeMoment: sanitizeNullableString(fields.gratitudeMoment ?? fields.event),
    gratitudeTarget: sanitizeNullableString(fields.gratitudeTarget),
    kindAction: sanitizeNullableString(fields.kindAction),
    seenNeed: sanitizeNullableString(fields.seenNeed),
    innerEffect: sanitizeNullableString(fields.innerEffect ?? fields.feeling),
    gratitudeReason: sanitizeNullableString(fields.gratitudeReason ?? fields.whyItMattered),
    gratitudeType: sanitizeNullableString(fields.gratitudeType ?? fields.happinessType),
    relationshipSignal: sanitizeNullableString(fields.relationshipSignal ?? fields.selfPattern),
    reciprocityHint: sanitizeNullableString(fields.reciprocityHint),
    tags: Array.from(new Set((fields.tags ?? []).map((tag) => tag.trim()).filter(Boolean))).slice(0, 6)
  };
}

function normalizeExtractedFieldsForSession(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  fields: JoySignalFields;
  existingSnapshot?: JoySnapshot | null;
  userMessage?: string;
}): JoySignalFields {
  const normalized = normalizeExtractedFields(input.fields);

  if (input.dimension === "gratitude") {
    const gratitudeNormalized: JoySignalFields = {
      ...normalized,
      gratitudeTarget: normalizeGratitudeTarget(normalized.gratitudeTarget),
      kindAction: normalizeGratitudeKindAction(normalized.kindAction),
      seenNeed: normalizeSeenNeed(normalized.seenNeed),
      gratitudeReason: normalizeGratitudeReason(normalized.gratitudeReason ?? normalized.whyItMattered),
      relationshipSignal: sanitizeNullableString(normalized.relationshipSignal),
      reciprocityHint: sanitizeNullableString(normalized.reciprocityHint),
      joyMoment: null,
      joySource: null,
      stateShift: null,
      meaningNeed: null,
      manualClue: null,
      delightSignature: null,
      directionSignal: null,
      valueImpact: null,
      durability: null
    };

    if (input.stage === "collect_event") {
      return {
        ...gratitudeNormalized,
        seenNeed: null,
        gratitudeReason: null,
        relationshipSignal: null,
        reciprocityHint: null
      };
    }

    if (input.stage === "probe_reason") {
      return {
        ...gratitudeNormalized,
        event: input.existingSnapshot?.event ? null : gratitudeNormalized.event,
        gratitudeMoment: input.existingSnapshot?.gratitudeMoment ? null : gratitudeNormalized.gratitudeMoment,
        relationshipSignal: null,
        reciprocityHint: null
      };
    }

    if (input.stage === "probe_pattern") {
      return {
        ...gratitudeNormalized,
        event: input.existingSnapshot?.event ? null : gratitudeNormalized.event,
        gratitudeMoment: input.existingSnapshot?.gratitudeMoment ? null : gratitudeNormalized.gratitudeMoment,
        kindAction: input.existingSnapshot?.kindAction ? null : gratitudeNormalized.kindAction,
        gratitudeTarget: input.existingSnapshot?.gratitudeTarget ? null : gratitudeNormalized.gratitudeTarget
      };
    }

    return gratitudeNormalized;
  }

  if (input.dimension === "improvement") {
    const improvementActionCue = /(?:下次|以后|再遇到|下一次|如果下次|我会|我想|可以先|准备先)/u.test(
      input.userMessage ?? ""
    );
    const improvementTrack = input.existingSnapshot?.improvementTrack ?? normalized.improvementTrack ?? null;
    const improvementNormalized: JoySignalFields = {
      ...normalized,
      whyItMattered: null,
      selfPattern: null,
      joyMoment: null,
      joySource: null,
      stateShift: null,
      meaningNeed: null,
      manualClue: null,
      delightSignature: null,
      directionSignal: null,
      valueImpact: null,
      durability: null
    };

    if (input.stage === "collect_event") {
      return {
        ...improvementNormalized,
        frictionPoint: null,
        repeatCondition: null,
        controllableFactor: null,
        nextAttempt: null,
        successSignal: null
      };
    }

    if (input.stage === "probe_reason") {
      const shouldKeepImprovementActionFields =
        improvementTrack === "avoid_bad" && improvementActionCue;

      return {
        ...improvementNormalized,
        event: input.existingSnapshot?.event ? null : improvementNormalized.event,
        controllableFactor: shouldKeepImprovementActionFields ? improvementNormalized.controllableFactor : null,
        nextAttempt: shouldKeepImprovementActionFields ? improvementNormalized.nextAttempt : null,
        successSignal: shouldKeepImprovementActionFields ? improvementNormalized.successSignal : null
      };
    }

    if (input.stage === "probe_pattern") {
      return {
        ...improvementNormalized,
        event: input.existingSnapshot?.event ? null : improvementNormalized.event,
        frictionPoint: input.existingSnapshot?.frictionPoint ? null : improvementNormalized.frictionPoint,
        repeatCondition: input.existingSnapshot?.repeatCondition ? null : improvementNormalized.repeatCondition
      };
    }

    return improvementNormalized;
  }

  if (input.dimension !== "fulfillment") {
    return normalized;
  }

  const fulfillmentNormalized: JoySignalFields = {
    ...normalized,
    whyItMattered: normalizeFulfillmentProgressEvidence(normalized.whyItMattered),
    selfPattern: normalizeFulfillmentValueSignal(normalized.selfPattern),
    joyMoment: null,
    joySource: null,
    stateShift: null,
    meaningNeed: null,
    manualClue: null,
    delightSignature: null,
    directionSignal: null,
    valueImpact: null,
    durability: null
  };

  if (input.stage === "collect_event") {
    return {
      ...fulfillmentNormalized,
      whyItMattered: null,
      selfPattern: null
    };
  }

  if (input.stage === "probe_reason") {
    return {
      ...fulfillmentNormalized,
      event: input.existingSnapshot?.event ? null : fulfillmentNormalized.event,
      selfPattern: null
    };
  }

  if (input.stage === "probe_pattern") {
    return {
      ...fulfillmentNormalized,
      event: input.existingSnapshot?.event ? null : fulfillmentNormalized.event,
      whyItMattered: input.existingSnapshot?.whyItMattered ? null : fulfillmentNormalized.whyItMattered
    };
  }

  return fulfillmentNormalized;
}

function getExtractResultSchema(dimension: InterviewDimension) {
  if (dimension === "improvement") {
    return improvementExtractResultSchema;
  }

  if (dimension === "gratitude") {
    return gratitudeExtractResultSchema;
  }

  return dimension === "fulfillment" || dimension === "reflection" ? fulfillmentExtractResultSchema : joyExtractResultSchema;
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
  const fallbackSnapshot = extractJoySignals(input.session.dimension, input.userMessage, input.session.snapshot, {
    allowClosureInference: false,
    allowOptionalSignalInference: false
  });
  const stageAwareFallbackSnapshot = mergeJoySignals(
    input.session.snapshot,
    normalizeExtractedFieldsForSession({
      dimension: input.session.dimension,
      stage: input.session.stage,
      fields: fallbackSnapshot,
      existingSnapshot: input.session.snapshot,
      userMessage: input.userMessage
    })
  );
  const provider = getAIProvider();
  const aiResult = await completeStructuredOutput({
    provider,
    stage: "extract",
    schema: getExtractResultSchema(input.session.dimension),
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

    return stageAwareFallbackSnapshot;
  }

  const aiSnapshot = mergeJoySignals(
    input.session.snapshot,
    normalizeExtractedFieldsForSession({
      dimension: input.session.dimension,
      stage: input.session.stage,
      fields: aiResult,
      existingSnapshot: input.session.snapshot,
      userMessage: input.userMessage
    })
  );

  // Keep AI extraction authoritative, but backfill holes with the conservative rule-based extractor
  // so real-world "对我来说……才算数" style fulfillment replies can still close the loop.
  return mergeJoySignals(aiSnapshot, {
    event: aiSnapshot.event ? null : stageAwareFallbackSnapshot.event,
    feeling: aiSnapshot.feeling ? null : stageAwareFallbackSnapshot.feeling,
    whyItMattered: aiSnapshot.whyItMattered ? null : stageAwareFallbackSnapshot.whyItMattered,
    happinessType: aiSnapshot.happinessType ? null : stageAwareFallbackSnapshot.happinessType,
    selfPattern: aiSnapshot.selfPattern ? null : stageAwareFallbackSnapshot.selfPattern,
    joyMoment: aiSnapshot.joyMoment ? null : stageAwareFallbackSnapshot.joyMoment,
    joySource: aiSnapshot.joySource ? null : stageAwareFallbackSnapshot.joySource,
    stateShift: aiSnapshot.stateShift ? null : stageAwareFallbackSnapshot.stateShift,
    meaningNeed: aiSnapshot.meaningNeed ? null : stageAwareFallbackSnapshot.meaningNeed,
    manualClue: aiSnapshot.manualClue ? null : stageAwareFallbackSnapshot.manualClue,
    delightSignature: aiSnapshot.delightSignature ? null : stageAwareFallbackSnapshot.delightSignature,
    directionSignal: aiSnapshot.directionSignal ? null : stageAwareFallbackSnapshot.directionSignal,
    valueImpact: aiSnapshot.valueImpact ? null : stageAwareFallbackSnapshot.valueImpact,
    durability: aiSnapshot.durability ? null : stageAwareFallbackSnapshot.durability,
    improvementTrack: aiSnapshot.improvementTrack ? null : stageAwareFallbackSnapshot.improvementTrack,
    stateAssessment: aiSnapshot.stateAssessment ? null : stageAwareFallbackSnapshot.stateAssessment,
    frictionPoint: aiSnapshot.frictionPoint ? null : stageAwareFallbackSnapshot.frictionPoint,
    repeatCondition: aiSnapshot.repeatCondition ? null : stageAwareFallbackSnapshot.repeatCondition,
    controllableFactor: aiSnapshot.controllableFactor ? null : stageAwareFallbackSnapshot.controllableFactor,
    nextAttempt: aiSnapshot.nextAttempt ? null : stageAwareFallbackSnapshot.nextAttempt,
    successSignal: aiSnapshot.successSignal ? null : stageAwareFallbackSnapshot.successSignal,
    gratitudeMoment: aiSnapshot.gratitudeMoment ? null : stageAwareFallbackSnapshot.gratitudeMoment,
    gratitudeTarget: aiSnapshot.gratitudeTarget ? null : stageAwareFallbackSnapshot.gratitudeTarget,
    kindAction: aiSnapshot.kindAction ? null : stageAwareFallbackSnapshot.kindAction,
    seenNeed: aiSnapshot.seenNeed ? null : stageAwareFallbackSnapshot.seenNeed,
    innerEffect: aiSnapshot.innerEffect ? null : stageAwareFallbackSnapshot.innerEffect,
    gratitudeReason: aiSnapshot.gratitudeReason ? null : stageAwareFallbackSnapshot.gratitudeReason,
    gratitudeType: aiSnapshot.gratitudeType ? null : stageAwareFallbackSnapshot.gratitudeType,
    relationshipSignal: aiSnapshot.relationshipSignal ? null : stageAwareFallbackSnapshot.relationshipSignal,
    reciprocityHint: aiSnapshot.reciprocityHint ? null : stageAwareFallbackSnapshot.reciprocityHint,
    tags: stageAwareFallbackSnapshot.tags
  });
}

function createFallbackAssistantTurn(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  nextDepthReached: AssistantDepth[];
  action: "reply" | "continue_current_event";
  questionSpec?: AssistantQuestionSpec | null;
}): AssistantTurnPayload {
  const fallbackSpec =
    input.questionSpec ??
    createQuestionSpec({
      dimension: input.dimension,
      stage: input.stage,
      snapshot: input.snapshot,
      stageIntent: input.action === "continue_current_event" ? "resume" : "advance",
      previousSpec: null
    });
  const surfaced = resolveQuestionFromSpec({
    dimension: input.dimension,
    stage: input.stage,
    snapshot: input.snapshot,
    spec: fallbackSpec
  });

  return {
    insight: "",
    thinkingSummary: "",
    analysis: "用户已说：已有片段但仍需继续澄清；下一步问：当前阶段对应的未覆盖层次",
    question: surfaced.question,
    questionSpec: surfaced.questionSpec,
    stateUpdate: {
      turnPhase: input.stage === "collect_event" ? "opening" : "digging",
      shouldEndDimension: false,
      offerChoice: false,
      choiceKind: null,
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
    thinkingSummary: trimToLength(payload.thinkingSummary ?? "", 180),
    analysis: trimToLength(payload.analysis ?? "", 240),
    question: trimToLength(payload.question ?? "", 160),
    questionSpec: payload.questionSpec ?? null,
    stateUpdate: {
      turnPhase: payload.stateUpdate?.turnPhase ?? "digging",
      shouldEndDimension: Boolean(payload.stateUpdate?.shouldEndDimension),
      offerChoice: Boolean(payload.stateUpdate?.offerChoice),
      choiceKind: payload.stateUpdate?.choiceKind ?? null,
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

  if (input.dimension === "joy") {
    if (input.stage === "collect_event") {
      return "用户已补充一个可能的开心片段；下一步问：把真正让他有感觉的点问具体。";
    }

    if (input.stage === "probe_reason") {
      return "用户已补充开心来源；下一步问：确认它带来的状态变化或触到的在乎。";
    }

    return "用户已继续补充当前事件；下一步问：沉淀出更稳定的个人线索。";
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
  const baseQuestionSpec =
    input.questionSpec ??
    inferQuestionSpecFromQuestion({
      dimension: input.dimension,
      stage: input.stage,
      snapshot: input.snapshot,
      question: segments.question
    });
  const surfaced = applyQuestionSurfaceProtocol({
    dimension: input.dimension,
    stage: input.stage,
    snapshot: input.snapshot,
    spec: baseQuestionSpec,
    candidateQuestion: segments.question
  });

  return normalizeAssistantTurnPayload({
    insight: "",
    thinkingSummary: trimToLength(segments.thinkingSummary, 180),
    analysis: buildAssistantAnalysis(input),
    question: trimToLength(surfaced.question, 160),
    questionSpec: surfaced.questionSpec,
    stateUpdate: {
      turnPhase: input.stage === "collect_event" ? "opening" : "digging",
      shouldEndDimension: false,
      offerChoice: false,
      choiceKind: null,
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
    action: input.action,
    questionSpec: input.questionSpec ?? null,
    memoryContext: input.memoryContext
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
    thinkingSummary: "",
    question: ""
  };

  async function emit(target: AssistantStreamingTarget, text: string) {
    if (!text) {
      return;
    }

    if (target === "summary") {
      segments.thinkingSummary += text;
    } else {
      segments.question += text;
    }

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

      if (currentTarget === "summary") {
        const questionIndex = buffer.indexOf(ASSISTANT_QUESTION_MARKER);

        if (questionIndex >= 0) {
          await emit("summary", buffer.slice(0, questionIndex));
          buffer = buffer.slice(questionIndex + ASSISTANT_QUESTION_MARKER.length);
          currentTarget = "question";
          sawMarker = true;
          continue;
        }

        const trailingPrefixLength = getTrailingMarkerPrefixLength(buffer);
        const safeText = trailingPrefixLength ? buffer.slice(0, -trailingPrefixLength) : buffer;
        buffer = trailingPrefixLength ? buffer.slice(-trailingPrefixLength) : "";
        await emit("summary", safeText);
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
      thinkingSummary: trimToLength(segments.thinkingSummary, 180),
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
  const hasMeaningfulOutput = Boolean(segments.thinkingSummary || segments.question);

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
    action: input.action,
    questionSpec: input.questionSpec
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
    action: input.action,
    questionSpec: input.questionSpec
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
    selfPattern: sanitizeNullableString(event.snapshot.selfPattern),
    joyMoment: sanitizeNullableString(getJoyMoment(event.snapshot)),
    joySource: sanitizeNullableString(getJoySource(event.snapshot)),
    stateShift: sanitizeNullableString(getStateShift(event.snapshot)),
    meaningNeed: sanitizeNullableString(getMeaningNeed(event.snapshot)),
    manualClue: sanitizeNullableString(getManualClue(event.snapshot)),
    delightSignature: sanitizeNullableString(getDelightSignature(event.snapshot)),
    directionSignal: sanitizeNullableString(getDirectionSignal(event.snapshot)),
    valueImpact: sanitizeNullableString(getValueImpact(event.snapshot)),
    durability: sanitizeNullableString(getDurability(event.snapshot)),
    psychProfile: getJoyPsychProfile(event.snapshot),
    improvementTrack: event.snapshot.improvementTrack ?? null,
    stateAssessment: sanitizeNullableString(event.snapshot.stateAssessment),
    frictionPoint: sanitizeNullableString(event.snapshot.frictionPoint ?? event.snapshot.whyItMattered),
    repeatCondition: sanitizeNullableString(event.snapshot.repeatCondition),
    controllableFactor: sanitizeNullableString(event.snapshot.controllableFactor),
    nextAttempt: sanitizeNullableString(event.snapshot.nextAttempt ?? event.snapshot.selfPattern),
    successSignal: sanitizeNullableString(event.snapshot.successSignal),
    gratitudeMoment: sanitizeNullableString(event.snapshot.gratitudeMoment ?? event.snapshot.event),
    gratitudeTarget: sanitizeNullableString(event.snapshot.gratitudeTarget),
    kindAction: sanitizeNullableString(event.snapshot.kindAction),
    seenNeed: sanitizeNullableString(event.snapshot.seenNeed),
    innerEffect: sanitizeNullableString(event.snapshot.innerEffect ?? event.snapshot.feeling),
    gratitudeReason: sanitizeNullableString(event.snapshot.gratitudeReason ?? event.snapshot.whyItMattered),
    gratitudeType: sanitizeNullableString(event.snapshot.gratitudeType ?? event.snapshot.happinessType),
    relationshipSignal: sanitizeNullableString(event.snapshot.relationshipSignal ?? event.snapshot.selfPattern),
    reciprocityHint: sanitizeNullableString(event.snapshot.reciprocityHint),
    tags: getJoyTags(event.snapshot)
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
      getJoyMoment(event.snapshot) ||
        getJoySource(event.snapshot) ||
        getStateShift(event.snapshot) ||
        getMeaningNeed(event.snapshot) ||
        getManualClue(event.snapshot) ||
        getDelightSignature(event.snapshot) ||
        event.snapshot.frictionPoint ||
        event.snapshot.repeatCondition ||
        event.snapshot.controllableFactor ||
        event.snapshot.nextAttempt ||
        event.snapshot.kindAction ||
        event.snapshot.seenNeed ||
        event.snapshot.gratitudeReason ||
        event.snapshot.relationshipSignal ||
        event.snapshot.event ||
        event.snapshot.whyItMattered
    )
  );

  const fallbackEvent = getActiveSessionEvent(session);

  return candidates.length ? candidates : fallbackEvent ? [fallbackEvent] : [];
}

function normalizeDraftResult(
  draft: Omit<JoyDraftResult, "eventBlocks"> & { eventBlocks?: JoyEventBlock[] },
  fallbackEventBlocks: JoyEventBlock[],
  brief: ReturnType<typeof buildDraftBrief>
): JoyEntryDraft {
  const closureTarget = brief.dimension === "joy" ? brief.closureTarget ?? "manual_clue" : null;
  const normalizedManualClue =
    brief.dimension !== "joy" || brief.completionMode === "user_override_partial" || closureTarget === "delight_signature"
      ? null
      : sanitizeNullableString(draft.manualClue) ?? sanitizeNullableString(brief.closingInsight);
  const normalizedDelightSignature =
    brief.dimension === "joy" && brief.completionMode === "complete" && closureTarget === "delight_signature"
      ? [draft.delightSignature, brief.closingInsight]
          .map((value) => sanitizeNullableString(value))
          .find((value) => isUsableJoyDelightSignature(value)) ?? null
      : null;
  const normalizedSelfPattern =
    brief.dimension === "joy"
      ? normalizedManualClue
      : brief.dimension === "improvement"
        ? brief.completionMode === "complete"
          ? sanitizeNullableString(draft.selfPattern) ??
            sanitizeNullableString(draft.nextAttempt) ??
            sanitizeNullableString(brief.nextAttempt) ??
            sanitizeNullableString(brief.closingInsight)
          : null
        : brief.dimension === "gratitude"
          ? brief.completionMode === "complete"
            ? sanitizeNullableString(draft.relationshipSignal) ??
              sanitizeNullableString(draft.selfPattern) ??
              sanitizeNullableString(brief.closingInsight)
            : null
      : brief.dimension === "fulfillment"
        ? normalizeFulfillmentValueSignal(draft.selfPattern) ??
          (brief.completionMode === "complete"
            ? normalizeFulfillmentValueSignal(brief.valueSignal) ?? normalizeFulfillmentValueSignal(brief.closingInsight)
            : null)
        : sanitizeNullableString(draft.selfPattern) ??
          (brief.completionMode === "complete"
            ? sanitizeNullableString(brief.valueSignal) ?? sanitizeNullableString(brief.closingInsight)
            : null);
  const joySnapshot = {
    event: sanitizeNullableString(draft.event) ?? sanitizeNullableString(brief.anchorScene),
    feeling: sanitizeNullableString(draft.feeling) ?? (brief.dimension === "joy" ? null : sanitizeNullableString(brief.stateOrNeed)),
    whyItMattered:
      brief.dimension === "fulfillment"
        ? normalizeFulfillmentProgressEvidence(draft.whyItMattered) ?? normalizeFulfillmentProgressEvidence(brief.emotionalCore)
        : sanitizeNullableString(draft.whyItMattered) ?? sanitizeNullableString(brief.emotionalCore),
    happinessType: sanitizeNullableString(draft.happinessType) ?? (brief.dimension === "joy" ? null : sanitizeNullableString(brief.directionSignal)),
    selfPattern: normalizedSelfPattern,
    joyMoment: brief.dimension === "joy" ? sanitizeNullableString(draft.joyMoment) ?? sanitizeNullableString(brief.anchorScene) : undefined,
    joySource: brief.dimension === "joy" ? sanitizeNullableString(draft.joySource) ?? sanitizeNullableString(brief.emotionalCore) : undefined,
    stateShift: brief.dimension === "joy" ? sanitizeNullableString(draft.stateShift) : undefined,
    meaningNeed: brief.dimension === "joy" ? sanitizeNullableString(draft.meaningNeed) : undefined,
    manualClue: normalizedManualClue,
    delightSignature: normalizedDelightSignature,
    directionSignal: brief.dimension === "joy" ? sanitizeNullableString(draft.directionSignal) : undefined,
    valueImpact: brief.dimension === "joy" ? sanitizeNullableString(draft.valueImpact) : undefined,
    durability: brief.dimension === "joy" ? sanitizeNullableString(draft.durability) : undefined,
    improvementTrack: brief.dimension === "improvement" ? draft.improvementTrack ?? brief.improvementTrack ?? null : undefined,
    stateAssessment: brief.dimension === "improvement" ? sanitizeNullableString(draft.stateAssessment) ?? sanitizeNullableString(brief.stateOrNeed) : undefined,
    frictionPoint: brief.dimension === "improvement" ? sanitizeNullableString(draft.frictionPoint) ?? sanitizeNullableString(brief.frictionPoint) : undefined,
    repeatCondition: brief.dimension === "improvement" ? sanitizeNullableString(draft.repeatCondition) ?? sanitizeNullableString(brief.repeatCondition) : undefined,
    controllableFactor: brief.dimension === "improvement" ? sanitizeNullableString(draft.controllableFactor) ?? sanitizeNullableString(brief.controllableFactor) : undefined,
    nextAttempt:
      brief.dimension === "improvement" && brief.completionMode === "complete"
        ? sanitizeNullableString(draft.nextAttempt) ?? sanitizeNullableString(brief.nextAttempt) ?? sanitizeNullableString(brief.closingInsight)
        : undefined,
    successSignal: brief.dimension === "improvement" ? sanitizeNullableString(draft.successSignal) ?? sanitizeNullableString(brief.successSignal) : undefined,
    gratitudeMoment:
      brief.dimension === "gratitude"
        ? sanitizeNullableString(draft.gratitudeMoment) ?? sanitizeNullableString(draft.event) ?? sanitizeNullableString(brief.anchorScene)
        : undefined,
    gratitudeTarget:
      brief.dimension === "gratitude"
        ? normalizeGratitudeTarget(draft.gratitudeTarget) ?? normalizeGratitudeTarget(brief.valueSignal)
        : undefined,
    kindAction:
      brief.dimension === "gratitude"
        ? normalizeGratitudeKindAction(draft.kindAction) ?? normalizeGratitudeKindAction(brief.emotionalCore)
        : undefined,
    seenNeed:
      brief.dimension === "gratitude" ? normalizeSeenNeed(draft.seenNeed) ?? normalizeSeenNeed(brief.stateOrNeed) : undefined,
    innerEffect:
      brief.dimension === "gratitude" ? sanitizeNullableString(draft.innerEffect) ?? sanitizeNullableString(draft.feeling) : undefined,
    gratitudeReason:
      brief.dimension === "gratitude"
        ? normalizeGratitudeReason(draft.gratitudeReason) ?? normalizeGratitudeReason(draft.whyItMattered)
        : undefined,
    gratitudeType:
      brief.dimension === "gratitude" ? sanitizeNullableString(draft.gratitudeType) ?? sanitizeNullableString(draft.happinessType) ?? sanitizeNullableString(brief.directionSignal) : undefined,
    relationshipSignal:
      brief.dimension === "gratitude" && brief.completionMode === "complete" ? normalizedSelfPattern : undefined,
    reciprocityHint:
      brief.dimension === "gratitude" ? sanitizeNullableString(draft.reciprocityHint) ?? sanitizeNullableString(brief.durabilitySignal) : undefined,
    tags: Array.from(
      new Set([...draft.tags.map((tag) => tag.trim()).filter(Boolean), ...brief.tags].filter(Boolean))
    ).slice(0, 6),
    confidence: 0,
    missingSlots: []
  } satisfies JoySnapshot;
  const normalizedTitle = normalizeDraftTitle(draft.title, brief);
  const normalizedContent = dedupeDraftParagraphs(
    brief.dimension === "fulfillment"
      ? normalizeFulfillmentDraftContent(draft.content)
      : brief.dimension === "gratitude"
        ? normalizeGratitudeDraftContent(draft.content)
        : draft.content
  );

  return {
    title: normalizedTitle,
    content: normalizedContent,
    event: joySnapshot.event,
    feeling: joySnapshot.feeling,
    whyItMattered: joySnapshot.whyItMattered,
    happinessType: joySnapshot.happinessType,
    selfPattern: joySnapshot.selfPattern,
    joyMoment: joySnapshot.joyMoment,
    joySource: joySnapshot.joySource,
    stateShift: joySnapshot.stateShift,
    meaningNeed: joySnapshot.meaningNeed,
    manualClue: joySnapshot.manualClue,
    delightSignature: joySnapshot.delightSignature,
    directionSignal: joySnapshot.directionSignal,
    valueImpact: joySnapshot.valueImpact,
    durability: joySnapshot.durability,
    psychProfile: brief.dimension === "joy" ? getJoyPsychProfile(joySnapshot) : undefined,
    improvementTrack: joySnapshot.improvementTrack,
    stateAssessment: joySnapshot.stateAssessment,
    frictionPoint: joySnapshot.frictionPoint,
    repeatCondition: joySnapshot.repeatCondition,
    controllableFactor: joySnapshot.controllableFactor,
    nextAttempt: joySnapshot.nextAttempt,
    successSignal: joySnapshot.successSignal,
    gratitudeMoment: joySnapshot.gratitudeMoment,
    gratitudeTarget: joySnapshot.gratitudeTarget,
    kindAction: joySnapshot.kindAction,
    seenNeed: joySnapshot.seenNeed,
    innerEffect: joySnapshot.innerEffect,
    gratitudeReason: joySnapshot.gratitudeReason,
    gratitudeType: joySnapshot.gratitudeType,
    relationshipSignal: joySnapshot.relationshipSignal,
    reciprocityHint: joySnapshot.reciprocityHint,
    tags: joySnapshot.tags ?? [],
    eventBlocks: draft.eventBlocks?.length ? draft.eventBlocks : fallbackEventBlocks,
    source: "ai_draft_direct"
  };
}

export async function generateJoyDraftWithAI(session: InterviewSessionRecord) {
  const sourceEvents = getDraftSourceEvents(session);
  const generationMode = resolveDraftGenerationMode(session, sourceEvents);
  const generationOptions = getDraftGenerationOptions(generationMode);
  const promptEvents = sourceEvents.slice(0, generationOptions.eventWindow);
  const promptMessages = session.messages.slice(-generationOptions.messageWindow);
  const fallbackEventBlocks = buildEventBlocks(sourceEvents);
  const draftBrief = buildDraftBrief({
    session,
    sourceEvents
  });
  const draftWritingProfile = buildDraftWritingProfile({
    brief: draftBrief
  });
  const fallbackDraft = createFallbackDraft({
    session,
    sourceEvents,
    eventBlocks: fallbackEventBlocks,
    brief: draftBrief,
    completionMode: draftBrief.completionMode
  });
  const provider = getAIProvider();
  const startedAt = Date.now();
  logger.info(
    {
      sessionId: session.id,
      generationMode,
      sourceEventCount: sourceEvents.length,
      hasExistingDraft: Boolean(session.journalEntry)
    },
    "Starting joy draft generation."
  );
  const aiResult = await completeStructuredOutput({
    provider,
    stage: "generate",
    schema: joyDraftResultSchema,
    messages: buildJoyDraftMessages({
      dimension: session.dimension,
      draftBrief,
      writingProfile: draftWritingProfile,
      events: promptEvents,
      messages: promptMessages,
      generationMode,
      existingDraft: session.journalEntry
        ? {
            title: session.journalEntry.title,
            content: session.journalEntry.content
          }
        : null
    }),
    temperature: 0.35,
    maxTokens: generationOptions.maxTokens,
    maxAttempts: generationOptions.maxAttempts,
    timeoutMs: generationOptions.timeoutMs,
    onAttempt: (attempt) =>
      logAttempt(session.id, {
        ...attempt,
        errorCode: attempt.errorCode ? `DRAFT_${attempt.errorCode}` : null
      })
  });

  if (!aiResult) {
    logger.warn(
      { sessionId: session.id, generationMode, elapsedMs: Date.now() - startedAt },
      "AI draft generation unavailable, fallback draft will be used."
    );

    return fallbackDraft;
  }

  const normalizedDraft = normalizeDraftResult(aiResult, fallbackEventBlocks, draftBrief);
  const qualityGate = runDraftQualityGate({
    brief: draftBrief,
    draft: normalizedDraft
  });

  if (
    !qualityGate.accepted ||
    (draftBrief.dimension === "gratitude" &&
      (hasGratitudeDraftCorruption(normalizedDraft.content) || hasCorruptedGratitudeFields(normalizedDraft)))
  ) {
    logger.warn(
      {
        sessionId: session.id,
        generationMode,
        issues: qualityGate.accepted ? [...qualityGate.issues, "gratitude_corrupted_draft"] : qualityGate.issues,
        elapsedMs: Date.now() - startedAt
      },
      "AI draft did not pass quality gate, fallback draft will be used."
    );

    return fallbackDraft;
  }

  logger.info(
    { sessionId: session.id, generationMode, elapsedMs: Date.now() - startedAt },
    "Joy draft generation completed."
  );

  return normalizedDraft;
}
