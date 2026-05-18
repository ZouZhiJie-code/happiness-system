import { logger } from "@/server/lib/logger";
import { getAIProvider } from "@/server/services/ai";
import { completeStructuredOutput } from "@/server/services/ai/structured-output";
import {
  buildMemoryExtractionMessages,
  memoryExtractionResultSchema
} from "@/features/memory/prompts/memory-extraction.prompts";
import {
  createMemoryFact,
  findSimilarBySummary,
  setMemoryFactEmbedding,
  updateMemoryFact
} from "@/server/repositories/memory.repository";
import { prisma } from "@/server/db/prisma";
import type { InterviewEventRecord, InterviewSessionRecord, JoyEntryDraft, JoySnapshot } from "@/types/interview";

/**
 * Extract user patterns from a completed interview session and store as memory facts.
 *
 * This function is designed to be called fire-and-forget after draft generation.
 * It never throws — all errors are caught and logged.
 */
export async function extractMemoriesFromSession(input: {
  userId: string;
  sessionId: string;
  session: InterviewSessionRecord;
  draftEntry: JoyEntryDraft;
}): Promise<void> {
  const userId = input.userId;

  try {
    // 1. Check memoryEnabled
    const settings = await prisma.userSettings.findUnique({
      where: { userId }
    });

    if (!settings?.memoryEnabled) {
      return;
    }

    // 2. Build prompt and call AI
    const provider = getAIProvider();
    const messages = buildMemoryExtractionMessages({
      dimension: input.session.dimension,
      snapshot: input.session.events[0]?.snapshotData
        ? buildSnapshotFromEvent(input.session.events[0])
        : {
            event: null,
            feeling: null,
            whyItMattered: null,
            happinessType: null,
            selfPattern: null,
            confidence: 0,
            missingSlots: []
          },
      events: input.session.events,
      draftContent: input.draftEntry.content
    });

    const aiResult = await completeStructuredOutput({
      provider,
      stage: "generate",
      schema: memoryExtractionResultSchema,
      messages,
      temperature: 0.2,
      maxTokens: 800,
      maxAttempts: 1
    });

    if (!aiResult || aiResult.memories.length === 0) {
      return;
    }

    // 3. Process each extracted memory
    const idSummaryPairs: Array<{ id: string; summary: string }> = [];

    for (const memory of aiResult.memories) {
      const existing = await findSimilarBySummary(
        memory.summary,
        input.session.dimension,
        userId
      );

      if (existing) {
        // Merge: bump confidence and record new session as evidence
        const mergedConfidence = Math.min(existing.confidence + 0.05, 1.0);
        const mergedEvidence = existing.evidenceSessionIds.includes(input.session.id)
          ? existing.evidenceSessionIds
          : [...existing.evidenceSessionIds, input.session.id];

        await updateMemoryFact(existing.id, {
          confidence: mergedConfidence,
          evidenceSessionIds: mergedEvidence
        });

        idSummaryPairs.push({ id: existing.id, summary: existing.summary });
        logger.info(
          { memoryId: existing.id, summary: memory.summary },
          "memory merged with existing"
        );
      } else {
        // Create new
        const confidence = computeConfidence(input.session);
        const created = await createMemoryFact({
          userId,
          dimension: input.session.dimension,
          kind: memory.kind,
          topicTags: memory.topicTags,
          summary: memory.summary,
          sourceType: "ai_extracted",
          confidence,
          evidenceEntryIds: input.draftEntry ? [input.session.finalEntryId ?? input.session.id] : [],
          evidenceSessionIds: [input.session.id]
        });
        idSummaryPairs.push({ id: created.id, summary: memory.summary });
      }
    }

    // 4. Generate embeddings (batch) using actual stored summaries
    if (idSummaryPairs.length > 0) {
      await generateAndSetEmbeddings(
        idSummaryPairs.map((p) => p.id),
        idSummaryPairs.map((p) => p.summary),
        userId,
        provider as NonNullable<ReturnType<typeof getAIProvider>>
      );
    }

    logger.info(
      { sessionId: input.session.id, memoryCount: idSummaryPairs.length },
      "memory extraction completed"
    );
  } catch (error) {
    // Never throw — this is fire-and-forget
    logger.error(
      { err: error, sessionId: input.session.id },
      "memory extraction failed"
    );
  }
}

/**
 * Generate embeddings for memory facts and set them in the database.
 */
async function generateAndSetEmbeddings(
  memoryIds: string[],
  summaries: string[],
  userId: string,
  provider: NonNullable<ReturnType<typeof getAIProvider>>
): Promise<void> {
  try {
    if (!provider.embed) {
      logger.warn("embedding not available on provider, skipping");
      return;
    }

    const result = await provider.embed({ input: summaries });

    for (let i = 0; i < memoryIds.length && i < result.embeddings.length; i++) {
      await setMemoryFactEmbedding(memoryIds[i], result.embeddings[i]);
    }
  } catch (error) {
    logger.warn({ err: error, userId }, "embedding generation failed, memories saved without vectors");
  }
}

/**
 * Compute confidence score based on session depth.
 * More events and turns → higher confidence.
 */
function computeConfidence(session: InterviewSessionRecord): number {
  const eventCount = session.events.length;
  const turnCount = session.turnCount;

  // Base: 0.3, +0.1 per event (max 0.5), +0.02 per turn (max 0.2)
  const eventBonus = Math.min(eventCount * 0.1, 0.5);
  const turnBonus = Math.min(turnCount * 0.02, 0.2);

  return Math.min(0.3 + eventBonus + turnBonus, 1.0);
}

/**
 * Build a JoySnapshot from an InterviewEventRecord's raw fields.
 */
function buildSnapshotFromEvent(event: InterviewEventRecord): JoySnapshot {
  return {
    event: event.snapshot.event,
    feeling: event.snapshot.feeling,
    whyItMattered: event.snapshot.whyItMattered,
    happinessType: event.snapshot.happinessType,
    selfPattern: event.snapshot.selfPattern,
    confidence: event.snapshot.confidence,
    missingSlots: event.snapshot.missingSlots
  };
}
