import type { InterviewDimension, MemoryFact } from "@prisma/client";

import { logger } from "@/server/lib/logger";
import { getAIProvider } from "@/server/services/ai";
import {
  findAllMemoryFacts,
  createMemoryFact,
  updateMemoryFact,
  softDeleteMemoryFact,
  findMemoryFactById,
  setMemoryFactEmbedding
} from "@/server/repositories/memory.repository";

const DEMO_USER_ID = "local-demo-user";

const ALL_DIMENSIONS: InterviewDimension[] = ["joy", "fulfillment", "reflection", "improvement", "gratitude"];

export type ProfileGroupedResult = Record<InterviewDimension, MemoryFact[]>;

/**
 * Get all memory facts grouped by dimension.
 */
export async function getAllProfiles(userId?: string): Promise<ProfileGroupedResult> {
  const uid = userId || DEMO_USER_ID;
  const facts = await findAllMemoryFacts(uid);

  const grouped: ProfileGroupedResult = {} as ProfileGroupedResult;
  for (const dim of ALL_DIMENSIONS) {
    grouped[dim] = [];
  }
  for (const fact of facts) {
    if (grouped[fact.dimension]) {
      grouped[fact.dimension].push(fact);
    }
  }
  return grouped;
}

/**
 * Add a new memory fact from user input (sourceType: user_added, confidence: 1.0).
 * Generates embedding fire-and-forget.
 */
export async function addProfileFact(input: {
  userId?: string;
  dimension: InterviewDimension;
  summary: string;
  topicTags: string[];
}): Promise<MemoryFact> {
  const userId = input.userId || DEMO_USER_ID;

  const created = await createMemoryFact({
    userId,
    dimension: input.dimension,
    kind: "user_note",
    topicTags: input.topicTags,
    summary: input.summary,
    sourceType: "user_added",
    confidence: 1.0,
    evidenceEntryIds: [],
    evidenceSessionIds: []
  });

  // Fire-and-forget embedding generation
  void generateEmbeddingSafe(created.id, input.summary, userId);

  return created;
}

/**
 * Update a memory fact's summary and topicTags.
 * Verifies ownership before updating.
 */
export async function updateProfileFact(input: {
  id: string;
  userId?: string;
  summary: string;
  topicTags: string[];
}): Promise<MemoryFact> {
  const userId = input.userId || DEMO_USER_ID;

  const existing = await findMemoryFactById(input.id);
  if (!existing || existing.userId !== userId) {
    throw new ProfileError("MEMORY_NOT_FOUND");
  }

  return updateMemoryFact(input.id, {
    summary: input.summary,
    topicTags: input.topicTags
  });
}

/**
 * Soft-delete a memory fact.
 * Verifies ownership before deleting.
 */
export async function deleteProfileFact(id: string, userId?: string): Promise<void> {
  const uid = userId || DEMO_USER_ID;

  const existing = await findMemoryFactById(id);
  if (!existing || existing.userId !== uid) {
    throw new ProfileError("MEMORY_NOT_FOUND");
  }

  await softDeleteMemoryFact(id);
}

// ─── Internal helpers ─────────────────────────────────────────────────────

export class ProfileError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

async function generateEmbeddingSafe(memoryId: string, summary: string, userId: string): Promise<void> {
  try {
    const provider = getAIProvider();
    if (!provider?.embed) return;

    const result = await provider.embed({ input: summary });
    const embedding = result.embeddings[0];
    if (embedding && embedding.length > 0) {
      await setMemoryFactEmbedding(memoryId, embedding);
    }
  } catch (error) {
    logger.warn({ err: error, memoryId, userId }, "profile embedding generation failed");
  }
}
