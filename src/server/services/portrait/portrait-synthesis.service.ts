import type { InterviewDimension, PortraitSnapshot } from "@prisma/client";
import { z } from "zod";

import { getAIProvider } from "@/server/services/ai";
import { completeStructuredOutput } from "@/server/services/ai/structured-output";
import { gatherPortraitData } from "@/server/services/portrait/portrait-data.service";
import {
  buildSummaryMessages,
  buildDimensionInsightMessages
} from "@/features/portrait/prompts/portrait-synthesis.prompts";
import {
  findLatestPortraitSnapshot,
  createPortraitSnapshot
} from "@/server/repositories/memory.repository";
import { logger } from "@/server/lib/logger";

// ─── Schemas ─────────────────────────────────────────────────────────────

const summarySchema = z.object({ summary: z.string() });
const insightSchema = z.object({ insight: z.string() });

// ─── Constants ───────────────────────────────────────────────────────────

const ALL_DIMENSIONS: InterviewDimension[] = [
  "joy",
  "fulfillment",
  "reflection",
  "improvement",
  "gratitude"
];

const MIN_FACTS = 3;
const DIMENSION_LABELS: Record<InterviewDimension, string> = {
  joy: "开心",
  fulfillment: "充实",
  reflection: "思考",
  improvement: "改进",
  gratitude: "感谢"
};

const DIMENSION_EMPTY_INSIGHTS: Record<InterviewDimension, string> = {
  joy: "这个维度还没有形成足够稳定的愉悦线索。",
  fulfillment: "这个维度还没有形成足够稳定的价值感线索。",
  reflection: "这个维度还没有形成足够稳定的反思线索。",
  improvement: "这个维度还没有形成足够稳定的改进线索。",
  gratitude: "这个维度还没有形成足够稳定的感谢线索。"
};

// ─── Exports ─────────────────────────────────────────────────────────────

export { findLatestPortraitSnapshot as getPortraitSnapshot };

function trimTrailingPunctuation(value: string) {
  return value.replace(/[，。！？；：,.!?;:\s]+$/u, "").trim();
}

function summarizeTags(tags: Map<string, number>) {
  return [...tags.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([tag]) => tag);
}

function buildDeterministicDimensionInsight(
  dimension: InterviewDimension,
  facts: Awaited<ReturnType<typeof gatherPortraitData>>["facts"]
) {
  if (facts.length === 0) {
    return DIMENSION_EMPTY_INSIGHTS[dimension];
  }

  const latest = [...facts].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0];
  const tagCounts = new Map<string, number>();
  for (const fact of facts) {
    for (const tag of fact.topicTags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const tagText = summarizeTags(tagCounts)
    .map((tag) => `「${tag}」`)
    .join("、");
  const pattern = trimTrailingPunctuation(latest.summary);

  return tagText
    ? `你在${DIMENSION_LABELS[dimension]}维度反复出现${tagText}这些线索；最近较清晰的一条是：${pattern}。`
    : `你在${DIMENSION_LABELS[dimension]}维度已经留下 ${facts.length} 条线索；最近较清晰的一条是：${pattern}。`;
}

function buildFallbackPortrait(data: Awaited<ReturnType<typeof gatherPortraitData>>) {
  const topTags = new Map<string, number>();
  for (const fact of data.facts) {
    for (const tag of fact.topicTags) {
      topTags.set(tag, (topTags.get(tag) ?? 0) + 1);
    }
  }

  const topTagText = summarizeTags(topTags)
    .map((tag) => `「${tag}」`)
    .join("、");

  const coveredDimensions = [...new Set(data.facts.map((fact) => fact.dimension))]
    .map((dimension) => DIMENSION_LABELS[dimension])
    .join("、");

  const summaryParts = [
    `目前已经从 ${data.facts.length} 条认知里看见一些关于你的稳定线索。`,
    coveredDimensions ? `它们主要分布在${coveredDimensions}维度，说明你已经开始从不同角度记录自己。` : "",
    topTagText ? `反复出现的主题包括${topTagText}，这些更适合作为后续访谈继续靠近的入口。` : "",
    "这份画像仍是初版，后续记录越多，它会越能区分一时状态和长期模式。"
  ].filter(Boolean);

  const dimensionInsights = {} as Record<InterviewDimension, string>;

  for (const dimension of ALL_DIMENSIONS) {
    const facts = data.facts.filter((fact) => fact.dimension === dimension);
    dimensionInsights[dimension] = buildDeterministicDimensionInsight(dimension, facts);
  }

  return {
    summary: summaryParts.join(""),
    dimensionInsights,
    factCount: data.facts.length
  };
}

async function cachePortraitSnapshot(input: {
  userId: string;
  summary: string;
  dimensionInsights: Record<InterviewDimension, string>;
  factCount: number;
}) {
  try {
    await createPortraitSnapshot(input);
  } catch (err) {
    logger.error({ err }, "[portrait-synthesis] Failed to cache snapshot");
  }
}

export async function synthesizePortrait(userId: string): Promise<{
  summary: string;
  dimensionInsights: Record<InterviewDimension, string>;
  factCount: number;
} | null> {
  // 1. Gather data
  const data = await gatherPortraitData(userId);
  if (data.facts.length < MIN_FACTS) {
    logger.warn(`[portrait-synthesis] Not enough facts: ${data.facts.length} < ${MIN_FACTS}`);
    return null;
  }

  // 2. Check AI provider after the data threshold so profile can still fall back.
  const provider = await getAIProvider("chat");
  if (!provider) {
    logger.warn("[portrait-synthesis] No AI provider available, using fallback portrait");
    const fallback = buildFallbackPortrait(data);
    await cachePortraitSnapshot({ userId, ...fallback });
    return fallback;
  }

  // 3. Generate cross-dimensional summary
  const summaryResult = await completeStructuredOutput({
    provider,
    stage: "portrait_synthesis",
    schema: summarySchema,
    messages: buildSummaryMessages(data),
    maxTokens: 300
  });

  if (!summaryResult) {
    logger.error("[portrait-synthesis] Failed to generate summary, using fallback portrait");
    const fallback = buildFallbackPortrait(data);
    await cachePortraitSnapshot({ userId, ...fallback });
    return fallback;
  }

  // 4. Generate per-dimension insights in parallel
  const insightResults = await Promise.all(
    ALL_DIMENSIONS.map((dim) =>
      completeStructuredOutput({
        provider,
        stage: "portrait_synthesis",
        schema: insightSchema,
        messages: buildDimensionInsightMessages(dim, data.facts, data),
        maxTokens: 150
      })
    )
  );

  // Collect insights, fallback on failure
  const dimensionInsights: Partial<Record<InterviewDimension, string>> = {};
  const fallbackInsights = buildFallbackPortrait(data).dimensionInsights;
  for (let i = 0; i < ALL_DIMENSIONS.length; i++) {
    const dimension = ALL_DIMENSIONS[i];
    const insight = insightResults[i]?.insight?.trim();
    if (!insight) {
      logger.warn(`[portrait-synthesis] Insight fallback for ${dimension}`);
      dimensionInsights[dimension] = fallbackInsights[dimension];
    } else {
      dimensionInsights[dimension] = insight;
    }
  }

  const result = {
    summary: summaryResult.summary,
    dimensionInsights: dimensionInsights as Record<InterviewDimension, string>,
    factCount: data.facts.length
  };

  // 5. Cache result
  await cachePortraitSnapshot({
    userId,
    summary: result.summary,
    dimensionInsights: result.dimensionInsights,
    factCount: result.factCount
  });

  return result;
}
