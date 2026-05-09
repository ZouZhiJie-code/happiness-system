import type { InterviewDimension, MemoryFact, MemorySourceType, PortraitSnapshot } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { setMemoryFactEmbedding } from "@/lib/vector";

const DEMO_USER_ID = "local-demo-user";

// ─── ORM Operations (画像页面用，不涉及 embedding) ─────────────────────────

export async function createMemoryFact(data: {
  userId?: string;
  dimension: InterviewDimension;
  kind: string;
  topicTags: string[];
  summary: string;
  sourceType: MemorySourceType;
  confidence: number;
  evidenceEntryIds?: string[];
  evidenceSessionIds?: string[];
}): Promise<MemoryFact> {
  return prisma.memoryFact.create({
    data: {
      userId: data.userId ?? DEMO_USER_ID,
      dimension: data.dimension,
      kind: data.kind,
      topicTags: data.topicTags,
      summary: data.summary,
      sourceType: data.sourceType,
      confidence: data.confidence,
      evidenceEntryIds: data.evidenceEntryIds ?? [],
      evidenceSessionIds: data.evidenceSessionIds ?? []
    }
  });
}

export async function createManyMemoryFacts(
  facts: Array<{
    userId?: string;
    dimension: InterviewDimension;
    kind: string;
    topicTags: string[];
    summary: string;
    sourceType: MemorySourceType;
    confidence: number;
    evidenceEntryIds?: string[];
    evidenceSessionIds?: string[];
  }>
): Promise<number> {
  const result = await prisma.memoryFact.createMany({
    data: facts.map((f) => ({
      userId: f.userId ?? DEMO_USER_ID,
      dimension: f.dimension,
      kind: f.kind,
      topicTags: f.topicTags,
      summary: f.summary,
      sourceType: f.sourceType,
      confidence: f.confidence,
      evidenceEntryIds: f.evidenceEntryIds ?? [],
      evidenceSessionIds: f.evidenceSessionIds ?? []
    }))
  });
  return result.count;
}

export async function findAllMemoryFacts(userId?: string): Promise<MemoryFact[]> {
  return prisma.memoryFact.findMany({
    where: {
      userId: userId ?? DEMO_USER_ID,
      deletedAt: null
    },
    orderBy: { confidence: "desc" }
  });
}

export async function findMemoryFactsByDimension(
  dimension: InterviewDimension,
  userId?: string
): Promise<MemoryFact[]> {
  return prisma.memoryFact.findMany({
    where: {
      userId: userId ?? DEMO_USER_ID,
      dimension,
      deletedAt: null
    },
    orderBy: { confidence: "desc" }
  });
}

export async function findMemoryFactById(id: string): Promise<MemoryFact | null> {
  return prisma.memoryFact.findUnique({ where: { id } });
}

export async function updateMemoryFact(
  id: string,
  data: {
    summary?: string;
    topicTags?: string[];
    confidence?: number;
    evidenceSessionIds?: string[];
  }
): Promise<MemoryFact> {
  return prisma.memoryFact.update({
    where: { id },
    data
  });
}

export async function softDeleteMemoryFact(id: string): Promise<void> {
  await prisma.memoryFact.update({
    where: { id },
    data: { deletedAt: new Date() }
  });
}

export async function deleteMemoryFact(id: string): Promise<void> {
  await prisma.memoryFact.delete({ where: { id } });
}

/**
 * Update the lastUsedAt timestamp for a set of memory facts.
 */
export async function touchMemoryFacts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.memoryFact.updateMany({
    where: { id: { in: ids } },
    data: { lastUsedAt: new Date() }
  });
}

// ─── Dedup (文本相似度) ──────────────────────────────────────────────────

/**
 * Find an existing memory fact with similar summary text in the same dimension.
 * Uses simple keyword overlap for dedup (not vector search).
 */
export async function findSimilarBySummary(
  summary: string,
  dimension: InterviewDimension,
  userId?: string
): Promise<MemoryFact | null> {
  const candidates = await prisma.memoryFact.findMany({
    where: {
      userId: userId ?? DEMO_USER_ID,
      dimension,
      deletedAt: null
    }
  });

  const summaryKeywords = extractKeywords(summary);

  let bestMatch: MemoryFact | null = null;
  let bestOverlap = 0;

  for (const candidate of candidates) {
    const candidateKeywords = extractKeywords(candidate.summary);
    const overlap = keywordOverlap(summaryKeywords, candidateKeywords);

    if (overlap > 0.6 && overlap > bestOverlap) {
      bestMatch = candidate;
      bestOverlap = overlap;
    }
  }

  return bestMatch;
}

function extractKeywords(text: string): Set<string> {
  // Split on Chinese and English word boundaries, filter short tokens
  const tokens = text
    .replace(/[，。、；：！？（）""''【】《》\s]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  return new Set(tokens);
}

function keywordOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  return intersection / Math.min(a.size, b.size);
}

// ─── Re-export vector operations ─────────────────────────────────────────

export { setMemoryFactEmbedding };

// ─── Portrait Snapshot Operations ─────────────────────────────────────────

export async function findLatestPortraitSnapshot(userId?: string): Promise<PortraitSnapshot | null> {
  return prisma.portraitSnapshot.findFirst({
    where: { userId: userId ?? DEMO_USER_ID },
    orderBy: { generatedAt: "desc" }
  });
}

export async function createPortraitSnapshot(data: {
  userId?: string;
  summary: string;
  dimensionInsights: Record<string, string>;
  factCount: number;
  dataRangeMonths?: number;
}): Promise<PortraitSnapshot> {
  const uid = data.userId ?? DEMO_USER_ID;
  return prisma.$transaction(async (tx) => {
    await tx.portraitSnapshot.deleteMany({ where: { userId: uid } });
    return tx.portraitSnapshot.create({
      data: {
        userId: uid,
        summary: data.summary,
        dimensionInsights: data.dimensionInsights,
        factCount: data.factCount,
        dataRangeMonths: data.dataRangeMonths ?? 3
      }
    });
  });
}
