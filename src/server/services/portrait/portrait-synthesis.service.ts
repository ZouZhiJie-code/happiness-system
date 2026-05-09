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

// ─── Exports ─────────────────────────────────────────────────────────────

export { findLatestPortraitSnapshot as getPortraitSnapshot };

export async function synthesizePortrait(userId?: string): Promise<{
  summary: string;
  dimensionInsights: Record<InterviewDimension, string>;
  factCount: number;
} | null> {
  // 1. Check AI provider
  const provider = getAIProvider();
  if (!provider) {
    logger.warn("[portrait-synthesis] No AI provider available");
    return null;
  }

  // 2. Gather data
  const data = await gatherPortraitData(userId);
  if (data.facts.length < MIN_FACTS) {
    logger.warn(`[portrait-synthesis] Not enough facts: ${data.facts.length} < ${MIN_FACTS}`);
    return null;
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
    logger.error("[portrait-synthesis] Failed to generate summary");
    return null;
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

  // Check if any dimension failed
  const dimensionInsights: Partial<Record<InterviewDimension, string>> = {};
  for (let i = 0; i < ALL_DIMENSIONS.length; i++) {
    if (!insightResults[i]) {
      logger.error(`[portrait-synthesis] Failed to generate insight for ${ALL_DIMENSIONS[i]}`);
      return null;
    }
    dimensionInsights[ALL_DIMENSIONS[i]] = insightResults[i]!.insight;
  }

  const result = {
    summary: summaryResult.summary,
    dimensionInsights: dimensionInsights as Record<InterviewDimension, string>,
    factCount: data.facts.length
  };

  // 5. Cache result
  try {
    await createPortraitSnapshot({
      userId,
      summary: result.summary,
      dimensionInsights: result.dimensionInsights,
      factCount: result.factCount
    });
  } catch (err) {
    logger.error("[portrait-synthesis] Failed to cache snapshot", err);
  }

  return result;
}
