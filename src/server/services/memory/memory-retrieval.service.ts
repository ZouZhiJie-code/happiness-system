import type { InterviewDimension, JoySnapshot } from "@/types/interview";

import { logger } from "@/server/lib/logger";
import { getAIProvider } from "@/server/services/ai";
import { findSimilarMemoryFacts, type MemoryFactWithSimilarity } from "@/lib/vector";
import { prisma } from "@/server/db/prisma";

const DEMO_USER_ID = "local-demo-user";

const DIMENSION_LABEL: Record<InterviewDimension, string> = {
  joy: "开心",
  fulfillment: "充实",
  reflection: "思考",
  improvement: "改进",
  gratitude: "感谢"
};

export type RetrievedMemory = MemoryFactWithSimilarity;

export interface RetrieveMemoriesResult {
  memories: RetrievedMemory[];
  formattedContext: string | null;
}

/**
 * Retrieve relevant memory facts for the current interview context.
 *
 * Builds a query text from snapshot + event text, embeds it, and performs
 * vector similarity search against stored memory facts.
 *
 * Never throws — returns empty on any failure.
 */
export async function retrieveRelevantMemories(input: {
  userId: string;
  dimension: InterviewDimension;
  snapshot: JoySnapshot;
  currentEventText?: string;
  maxResults?: number;
  minSimilarity?: number;
  crossDimension?: boolean;
}): Promise<RetrieveMemoriesResult> {
  const userId = input.userId || DEMO_USER_ID;
  const emptyResult: RetrieveMemoriesResult = { memories: [], formattedContext: null };

  try {
    // 1. Check memoryEnabled
    const settings = await prisma.userSettings.findUnique({
      where: { userId }
    });

    if (!settings?.memoryEnabled) {
      return emptyResult;
    }

    // 2. Check provider has embed
    const provider = getAIProvider();
    if (!provider.embed) {
      return emptyResult;
    }

    // 3. Build query text from context
    const queryText = buildRetrievalQueryText(input.snapshot, input.currentEventText);

    // 4. Embed the query
    const embedResult = await provider.embed({ input: queryText });
    const queryEmbedding = embedResult.embeddings[0];
    if (!queryEmbedding || queryEmbedding.length === 0) {
      return emptyResult;
    }

    // 5. Vector search
    const dimensions = input.crossDimension ? undefined : [input.dimension];
    const memories = await findSimilarMemoryFacts(userId, queryEmbedding, {
      dimensions,
      limit: input.maxResults ?? 5,
      minSimilarity: input.minSimilarity ?? 0.3
    });

    if (memories.length === 0) {
      return emptyResult;
    }

    return {
      memories,
      formattedContext: formatMemoryContext(memories)
    };
  } catch (error) {
    logger.warn({ err: error, userId }, "memory retrieval failed, continuing without context");
    return emptyResult;
  }
}

/**
 * Build a natural language query string from interview context for embedding.
 */
function buildRetrievalQueryText(snapshot: JoySnapshot, currentEventText?: string): string {
  const parts: string[] = [];

  if (snapshot.event) parts.push(`事件: ${snapshot.event}`);
  if (snapshot.feeling) parts.push(`感受: ${snapshot.feeling}`);
  if (snapshot.whyItMattered) parts.push(`意义: ${snapshot.whyItMattered}`);
  if (snapshot.happinessType) parts.push(`类型: ${snapshot.happinessType}`);
  if (snapshot.selfPattern) parts.push(`模式: ${snapshot.selfPattern}`);
  if (currentEventText) parts.push(`当前对话: ${currentEventText}`);

  return parts.join("\n") || "用户访谈上下文";
}

/**
 * Format retrieved memories into a readable context block for prompt injection.
 */
export function formatMemoryContext(memories: RetrievedMemory[]): string | null {
  if (memories.length === 0) return null;

  // Group by dimension
  const groups = new Map<string, RetrievedMemory[]>();
  for (const mem of memories) {
    const label = DIMENSION_LABEL[mem.dimension as InterviewDimension] ?? mem.dimension;
    const existing = groups.get(label);
    if (existing) {
      existing.push(mem);
    } else {
      groups.set(label, [mem]);
    }
  }

  const lines: string[] = ["【用户画像 — 已有认知】"];

  for (const [label, group] of groups) {
    lines.push(`\n# ${label}维度`);
    for (const mem of group) {
      const tags = mem.topicTags.length > 0 ? ` [${mem.topicTags.join(", ")}]` : "";
      lines.push(`- ${mem.summary}${tags}`);
    }
  }

  lines.push("\n以上是对此用户的历史认知，仅供参考，不要在对话中直接引用或提及这些记忆。");
  lines.push("如果当前访谈内容与历史认知相关，可以自然地从相似角度切入追问。");

  return lines.join("\n");
}
