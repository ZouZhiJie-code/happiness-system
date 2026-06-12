"use client";

import {
  getCachedAnalysisTrendsRange,
  saveAnalysisTrendsRange
} from "@/features/analysis/analysis-record-cache";
import type { AnalysisRangePreset } from "@/features/analysis/date-range";
import { buildAnalysisPeriodState } from "@/features/analysis/period-state";
import { dedupedRequest } from "@/features/shared/client-request-cache";
import type { AnalysisTrendsRangeRecord } from "@/features/analysis/types";

export { getCachedAnalysisTrendsRange };

export async function fetchAnalysisTrendsRange(input: {
  preset: AnalysisRangePreset;
  month: string;
  startDate?: string;
  endDate?: string;
  force?: boolean;
}) {
  const period = buildAnalysisPeriodState({
    preset: input.preset,
    month: input.month,
    startDate: input.startDate,
    endDate: input.endDate
  });

  if (!input.force) {
    const cached = getCachedAnalysisTrendsRange(period);

    if (cached) {
      return cached;
    }
  }

  const params = new URLSearchParams({
    preset: input.preset,
    month: input.month
  });

  if (input.startDate) {
    params.set("startDate", input.startDate);
  }

  if (input.endDate) {
    params.set("endDate", input.endDate);
  }

  const cacheKey = `analysis-range:${params.toString()}`;

  const record = await dedupedRequest(
    cacheKey,
    async () => {
      const response = await fetch(`/api/analysis/range?${params.toString()}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("ANALYSIS_RANGE_QUERY_FAILED");
      }

      const payload = (await response.json()) as AnalysisTrendsRangeRecord;

      if (!payload?.scoreTrend?.days || !Array.isArray(payload.scoreTrend.days)) {
        throw new Error("ANALYSIS_RANGE_INVALID_PAYLOAD");
      }

      return payload;
    },
    { force: input.force }
  );

  saveAnalysisTrendsRange(period, record);

  return record;
}
