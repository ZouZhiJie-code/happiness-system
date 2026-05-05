import { getInterviewDimensionMeta } from "@/features/interview/dimensions";
import type { AnalysisMonthRecord, AnalysisNarrative } from "./types";

type AggregateBase = Omit<AnalysisMonthRecord, "scoreRecords" | "editableDates" | "narrative">;

/**
 * Generate narrative and insight cards for the given month's aggregated data.
 *
 * TODO: replace with AI service for richer, personalized summaries.
 * For now returns a deterministic placeholder so the rest of the pipeline
 * can treat `narrative` as always-present.
 */
export function generateMonthNarrative(base: AggregateBase): AnalysisNarrative {
  const { logOverview, scoreOverview, insightsOverview, dimensions } = base;

  const parts: string[] = [];

  parts.push(
    `本月共记录 ${logOverview.recordedDayCount} 天，保存 ${logOverview.savedEntryCount} 条访谈记录。`
  );

  if (scoreOverview.monthAverageScore !== null) {
    parts.push(
      `幸福评分覆盖 ${scoreOverview.scoredDayCount} 天，月均分 ${scoreOverview.monthAverageScore.toFixed(1)}。`
    );
  }

  if (insightsOverview.featuredDimension) {
    const label = getInterviewDimensionMeta(insightsOverview.featuredDimension).label;
    parts.push(
      `最活跃维度为「${label}」。`
    );
  }

  const dimensionTheses: Record<string, string> = {};
  for (const dim of dimensions) {
    if (dim.thesis) {
      dimensionTheses[dim.dimension] = dim.thesis;
    }
  }

  return {
    overviewNarrative: parts.join(""),
    dimensionTheses,
    insightCards: []
  };
}
