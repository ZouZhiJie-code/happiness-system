import { InterviewDimension } from "@prisma/client";
import { prisma } from "@/server/db/prisma";

/**
 * Format a number array as a PostgreSQL vector literal string.
 * Example: [0.1, 0.2, 0.3] → "[0.1,0.2,0.3]"
 */
export function formatVectorForPg(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export interface MemoryFactWithSimilarity {
  id: string;
  userId: string;
  dimension: InterviewDimension;
  kind: string;
  topicTags: string[];
  summary: string;
  sourceType: string;
  confidence: number;
  evidenceEntryIds: string[];
  evidenceSessionIds: string[];
  similarity: number;
}

/**
 * Find memory facts similar to a query embedding using cosine distance.
 * Requires the pgvector extension plus the embedding column/index provisioned by migration.
 * Callers must tolerate query failure and fall back when vector search is unavailable.
 */
export async function findSimilarMemoryFacts(
  userId: string,
  queryEmbedding: number[],
  options?: {
    dimensions?: InterviewDimension[];
    limit?: number;
    minSimilarity?: number;
  }
): Promise<MemoryFactWithSimilarity[]> {
  const vectorStr = formatVectorForPg(queryEmbedding);
  const limit = options?.limit ?? 10;
  const minSimilarity = options?.minSimilarity ?? 0.3;

  if (options?.dimensions && options.dimensions.length > 0) {
    const dimensionPlaceholders = options.dimensions.map((_, i) => `$${i + 4}::"InterviewDimension"`).join(", ");
    const query = `
      SELECT id, "userId", dimension, kind, "topicTags", summary, "sourceType",
             confidence, "evidenceEntryIds", "evidenceSessionIds",
             1 - (embedding <=> $1::vector) AS similarity
      FROM "MemoryFact"
      WHERE "userId" = $2
        AND "deletedAt" IS NULL
        AND embedding IS NOT NULL
        AND dimension IN (${dimensionPlaceholders})
        AND 1 - (embedding <=> $1::vector) >= $3
      ORDER BY embedding <=> $1::vector ASC
      LIMIT ${limit}
    `;
    return prisma.$queryRawUnsafe<MemoryFactWithSimilarity[]>(
      query,
      vectorStr,
      userId,
      minSimilarity,
      ...options.dimensions
    );
  }

  return prisma.$queryRaw<MemoryFactWithSimilarity[]>`
    SELECT id, "userId", dimension, kind, "topicTags", summary, "sourceType",
           confidence, "evidenceEntryIds", "evidenceSessionIds",
           1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM "MemoryFact"
    WHERE "userId" = ${userId}
      AND "deletedAt" IS NULL
      AND embedding IS NOT NULL
      AND 1 - (embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
    ORDER BY embedding <=> ${vectorStr}::vector ASC
    LIMIT ${limit}
  `;
}

/**
 * Set the embedding vector for a memory fact.
 */
export async function setMemoryFactEmbedding(id: string, embedding: number[]): Promise<void> {
  const vectorStr = formatVectorForPg(embedding);
  await prisma.$executeRaw`
    UPDATE "MemoryFact"
    SET embedding = ${vectorStr}::vector, "updatedAt" = NOW()
    WHERE id = ${id}
  `;
}
