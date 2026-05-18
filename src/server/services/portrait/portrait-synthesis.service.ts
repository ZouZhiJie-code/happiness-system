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

// ─── Exports ─────────────────────────────────────────────────────────────

export { findLatestPortraitSnapshot as getPortraitSnapshot };

function buildFallbackPortrait(data: Awaited<ReturnType<typeof gatherPortraitData>>) {
  const topTags = new Map<string, number>();
  for (const fact of data.facts) {
    for (const tag of fact.topicTags) {
      topTags.set(tag, (topTags.get(tag) ?? 0) + 1);
    }
  }

  const topTagText = [...topTags.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([tag]) => `「${tag}」`)
    .join("、");

  const coveredDimensions = [...new Set(data.facts.map((fact) => fact.dimension))]
    .map((dimension) => DIMENSION_LABELS[dimension])
    .join("、");

  const summaryParts = [
    `目前已经从 ${data.facts.length} 条认知里看见一些稳定线索。`,
    coveredDimensions ? `这些线索主要分布在${coveredDimensions}维度。` : "",
    topTagText ? `反复出现的主题包括${topTagText}。` : "",
    "后续访谈继续积累后，画像会变得更细。"
  ].filter(Boolean);

  const dimensionInsights = {} as Record<InterviewDimension, string>;

  for (const dimension of ALL_DIMENSIONS) {
    const facts = data.facts.filter((fact) => fact.dimension === dimension);
    const latest = [...facts].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0];
    dimensionInsights[dimension] = latest
      ? latest.summary
      : "这个维度还没有形成足够稳定的认知线索。";
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
  const provider = getAIProvider();
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
  for (let i = 0; i < ALL_DIMENSIONS.length; i++) {
    if (!insightResults[i]) {
      logger.warn(`[portrait-synthesis] Insight fallback for ${ALL_DIMENSIONS[i]}`);
      dimensionInsights[ALL_DIMENSIONS[i]] = "该维度洞察暂不可用，请稍后重试。";
    } else {
      dimensionInsights[ALL_DIMENSIONS[i]] = insightResults[i]!.insight;
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
