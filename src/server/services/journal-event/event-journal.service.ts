import type { AIOutputOrigin } from "@prisma/client";

import {
  composeEventJournalContent,
  buildEventJournalFallbackDraft,
  evaluateEventJournalDraft,
  normalizeEventJournalDraft
} from "@/features/journal-event/content";
import {
  EVENT_JOURNAL_PROMPT_KEY,
  EVENT_JOURNAL_PROMPT_VERSION,
  buildEventJournalPrompt
} from "@/features/journal-event/prompt";
import { eventJournalDraftSchema } from "@/features/journal-event/schema";
import {
  assertEventCenteredWriteAllowed,
  type EventCenteredReleaseMode
} from "@/features/interview/event-centered-release";
import { createPromptEnvelope } from "@/features/ai-quality/prompt-manifest";
import { logger } from "@/server/lib/logger";
import {
  appendGenerationTraceDecision,
  recordAIInvocation
} from "@/server/repositories/ai-quality.repository";
import { assertJournalDayMode } from "@/server/repositories/journal-day-mode.repository";
import {
  cancelJournalEventEntryGeneration,
  completeJournalEventEntryGeneration,
  failJournalEventEntryGeneration,
  getJournalEventEntryForUser,
  reserveJournalEventEntryGeneration,
  saveJournalEventEntry,
  updateJournalEventEntry
} from "@/server/repositories/journal-event-entry.repository";
import type { AIProvider } from "@/server/services/ai/ai-provider";
import { getAIProvider } from "@/server/services/ai";
import { completeStructuredOutput } from "@/server/services/ai/structured-output";
import { resolveOptimizedPromptEnvelope } from "@/server/services/ai-quality/prompt-optimization.service";
import type {
  EventJournalEntryView,
  EventJournalGenerationPhase,
  GenerateEventJournalInput,
  GenerateEventJournalResult,
  JournalEventEntryGenerationRecord,
  JournalEventEntryRecord
} from "@/types/journal-event-entry";

export type EventJournalServiceOptions = {
  provider?: AIProvider | null;
  releaseMode?: EventCenteredReleaseMode;
  signal?: AbortSignal;
  onPhase?: (phase: EventJournalGenerationPhase) => Promise<void> | void;
  onReserved?: (
    generation: JournalEventEntryGenerationRecord,
    reservedNow: boolean
  ) => Promise<void> | void;
};

function hasInjectedProvider(options: EventJournalServiceOptions) {
  return Object.prototype.hasOwnProperty.call(options, "provider");
}


async function emitPhase(
  options: EventJournalServiceOptions,
  phase: EventJournalGenerationPhase
) {
  await options.onPhase?.(phase);
}

async function appendTraceDecisionSafely(
  traceId: string | null,
  decision: Record<string, unknown>
) {
  if (!traceId) return;
  try {
    await appendGenerationTraceDecision(traceId, decision);
  } catch (error) {
    logger.warn(
      { err: error, traceId, decisionKind: decision.kind },
      "Event journal trace decision could not be appended."
    );
  }
}

async function settleFailedGeneration(
  generation: JournalEventEntryGenerationRecord,
  userId: string,
  errorCode: string
) {
  try {
    await failJournalEventEntryGeneration({
      userId,
      generationId: generation.id,
      errorCode
    });
  } catch (error) {
    logger.warn(
      { err: error, generationId: generation.id, errorCode },
      "Event journal generation could not be marked failed."
    );
  }
}

function toView(entry: JournalEventEntryRecord): EventJournalEntryView {
  return {
    entry: {
      id: entry.id,
      eventId: entry.eventId,
      title: entry.title,
      content: entry.content,
      status: entry.status,
      contentRevision: entry.contentRevision,
      savedRevision: entry.savedRevision,
      updatedAt: entry.updatedAt,
      savedAt: entry.savedAt
    }
  };
}

async function assertEntryWriteAllowed(
  entry: JournalEventEntryRecord,
  userId: string,
  releaseMode?: EventCenteredReleaseMode
) {
  assertEventCenteredWriteAllowed({ mode: releaseMode });
  await assertJournalDayMode({
    userId,
    entryDate: entry.entryDate.slice(0, 10),
    mode: "event_centered"
  });
}

export async function generateEventJournal(
  input: GenerateEventJournalInput,
  options: EventJournalServiceOptions = {}
): Promise<GenerateEventJournalResult> {
  assertEventCenteredWriteAllowed({ mode: options.releaseMode });
  options.signal?.throwIfAborted();
  await emitPhase(options, "journal_source");

  const reserved = await reserveJournalEventEntryGeneration({
    userId: input.userId,
    eventId: input.eventId,
    activeBranchSessionId: input.activeBranchSessionId,
    clientOperationId: input.clientOperationId,
    baseMessageSequence: input.baseMessageSequence,
    requestId: input.requestId
  });
  if (reserved.kind === "entry") {
    await emitPhase(options, "complete");
    return {
      kind: "entry",
      entry: reserved.entry,
      generationId: reserved.entry.generationId,
      outputOrigin: reserved.entry.generationOrigin,
      usedFallback: reserved.entry.generationOrigin === "fallback"
    };
  }

  const generation = reserved.generation;
  await options.onReserved?.(generation, reserved.reservedNow);
  if (generation.status !== "processing") {
    throw new Error(
      generation.errorCode ??
        (generation.status === "canceled"
          ? "EVENT_JOURNAL_GENERATION_CANCELED"
          : "EVENT_JOURNAL_OPERATION_FAILED")
    );
  }
  if (!reserved.reservedNow) {
    return {
      kind: "processing",
      entry: null,
      generationId: generation.id,
      outputOrigin: null,
      usedFallback: false
    };
  }

  try {
    options.signal?.throwIfAborted();
    await emitPhase(options, "journal_drafting");
    const provider = hasInjectedProvider(options)
      ? options.provider ?? null
      : await getAIProvider("chat");
    const envelope = await resolveOptimizedPromptEnvelope(
      createPromptEnvelope({
        promptKey: EVENT_JOURNAL_PROMPT_KEY,
        promptVersion: EVENT_JOURNAL_PROMPT_VERSION,
        messages: buildEventJournalPrompt(generation.sourceSnapshot)
      })
    );
    const aiDraft = await completeStructuredOutput({
      provider,
      providerUnavailableCode: "EVENT_JOURNAL_PROVIDER_UNAVAILABLE",
      stage: "generate",
      schema: eventJournalDraftSchema,
      messages: envelope.messages,
      temperature: 0.25,
      maxTokens: 1400,
      maxAttempts: 2,
      timeoutMs: 25_000,
      signal: options.signal,
      onAttempt: async (attempt) => {
        try {
          await recordAIInvocation({
            sessionId: generation.branchSessionId,
            traceId: generation.traceId,
            requestId: input.requestId,
            stage: attempt.stage,
            attempt: attempt.attempt ?? 1,
            provider: attempt.provider,
            envelope,
            responseText: attempt.responseText,
            params: {
              temperature: 0.25,
              maxTokens: 1400,
              timeoutMs: 25_000
            },
            success: attempt.success,
            latencyMs: attempt.latencyMs,
            errorCode: attempt.errorCode
          });
        } catch (error) {
          logger.warn(
            { err: error, generationId: generation.id },
            "Event journal invocation log could not be written."
          );
        }
      }
    });

    options.signal?.throwIfAborted();
    await emitPhase(options, "journal_checking");

    let selectedDraft = aiDraft
      ? normalizeEventJournalDraft(generation.sourceSnapshot, aiDraft)
      : null;
    const aiQuality = selectedDraft
      ? evaluateEventJournalDraft({
          snapshot: generation.sourceSnapshot,
          draft: selectedDraft
        })
      : null;
    let outputOrigin: AIOutputOrigin = "llm";
    let usedFallback = false;

    if (!selectedDraft || !aiQuality?.accepted) {
      const fallbackDraft = buildEventJournalFallbackDraft(generation.sourceSnapshot);
      const fallbackQuality = fallbackDraft
        ? evaluateEventJournalDraft({
            snapshot: generation.sourceSnapshot,
            draft: fallbackDraft
          })
        : null;
      await appendTraceDecisionSafely(generation.traceId, {
        kind: "event_journal_ai_quality_gate",
        accepted: Boolean(aiQuality?.accepted),
        issues: aiQuality?.issues ?? ["generation_unavailable"],
        fallbackAvailable: Boolean(fallbackDraft)
      });

      if (!fallbackDraft || !fallbackQuality?.accepted) {
        await appendTraceDecisionSafely(generation.traceId, {
          kind: "event_journal_fallback_quality_gate",
          accepted: false,
          issues: fallbackQuality?.issues ?? ["source_insufficient"]
        });
        await settleFailedGeneration(
          generation,
          input.userId,
          "EVENT_JOURNAL_QUALITY_CHECK_FAILED"
        );
        throw new Error("EVENT_JOURNAL_QUALITY_CHECK_FAILED");
      }

      selectedDraft = fallbackDraft;
      outputOrigin = "fallback";
      usedFallback = true;
      await appendTraceDecisionSafely(generation.traceId, {
        kind: "event_journal_fallback_quality_gate",
        accepted: true,
        issues: []
      });
    }

    const finalQuality = evaluateEventJournalDraft({
      snapshot: generation.sourceSnapshot,
      draft: selectedDraft
    });
    const entry = await completeJournalEventEntryGeneration({
      userId: input.userId,
      generationId: generation.id,
      sourceFingerprint: generation.sourceFingerprint,
      title: selectedDraft.title,
      content: composeEventJournalContent(selectedDraft),
      outputOrigin,
      qualityChecks: {
        sourceGrounded: finalQuality.sourceGrounded,
        basicQualityPassed: finalQuality.basicQualityPassed
      },
      pipelineDecisions: [
        {
          kind: "event_journal_content_strategy",
          eventNarrative: true,
          insightCount: selectedDraft.insights.length,
          usedFallback
        },
        {
          kind: "event_journal_final_quality_gate",
          accepted: finalQuality.accepted,
          issues: finalQuality.issues
        }
      ]
    });
    await emitPhase(options, "complete");
    return {
      kind: "entry",
      entry,
      generationId: generation.id,
      outputOrigin,
      usedFallback
    };
  } catch (error) {
    if (options.signal?.aborted) {
      try {
        await cancelJournalEventEntryGeneration({
          userId: input.userId,
          generationId: generation.id,
          errorCode: "REQUEST_CANCELED"
        });
      } catch (cancelError) {
        logger.warn(
          { err: cancelError, generationId: generation.id },
          "Canceled event journal generation could not be settled."
        );
      }
      throw error;
    }

    if (
      !(error instanceof Error) ||
      error.message !== "EVENT_JOURNAL_QUALITY_CHECK_FAILED"
    ) {
      await settleFailedGeneration(
        generation,
        input.userId,
        error instanceof Error && error.message.trim()
          ? error.message
          : "EVENT_JOURNAL_OPERATION_FAILED"
      );
    }
    throw error;
  }
}

export async function getEventJournalEntryView(input: {
  userId: string;
  entryId: string;
}): Promise<EventJournalEntryView> {
  const entry = await getJournalEventEntryForUser(input);
  if (!entry) throw new Error("EVENT_JOURNAL_ENTRY_NOT_FOUND");
  return toView(entry);
}

export async function updateEventJournalEntry(input: {
  userId: string;
  entryId: string;
  expectedContentRevision: number;
  title: string;
  content: string;
  releaseMode?: EventCenteredReleaseMode;
}): Promise<EventJournalEntryView> {
  const current = await getJournalEventEntryForUser({
    userId: input.userId,
    entryId: input.entryId
  });
  if (!current) throw new Error("EVENT_JOURNAL_ENTRY_NOT_FOUND");
  await assertEntryWriteAllowed(current, input.userId, input.releaseMode);
  return toView(
    await updateJournalEventEntry({
      userId: input.userId,
      entryId: input.entryId,
      expectedContentRevision: input.expectedContentRevision,
      title: input.title,
      content: input.content
    })
  );
}

export async function saveEventJournalEntry(input: {
  userId: string;
  entryId: string;
  expectedContentRevision: number;
  releaseMode?: EventCenteredReleaseMode;
}): Promise<EventJournalEntryView> {
  const current = await getJournalEventEntryForUser({
    userId: input.userId,
    entryId: input.entryId
  });
  if (!current) throw new Error("EVENT_JOURNAL_ENTRY_NOT_FOUND");
  await assertEntryWriteAllowed(current, input.userId, input.releaseMode);
  return toView(
    await saveJournalEventEntry({
      userId: input.userId,
      entryId: input.entryId,
      expectedContentRevision: input.expectedContentRevision
    })
  );
}

export async function cancelEventJournalGeneration(input: {
  userId: string;
  generationId: string;
  reason?: string | null;
  releaseMode?: EventCenteredReleaseMode;
}) {
  assertEventCenteredWriteAllowed({ mode: input.releaseMode });
  const generation = await cancelJournalEventEntryGeneration({
    userId: input.userId,
    generationId: input.generationId,
    errorCode: input.reason?.trim() || "REQUEST_CANCELED"
  });
  return {
    generation: {
      id: generation.id,
      eventId: generation.eventId,
      status: generation.status,
      errorCode: generation.errorCode,
      canceledAt: generation.canceledAt
    }
  };
}
