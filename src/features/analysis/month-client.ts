"use client";

import { dedupedRequest } from "@/features/shared/client-request-cache";
import type { AnalysisMonthRecord } from "@/features/analysis/types";

export async function fetchAnalysisMonthRecord(month: string, options?: { force?: boolean }) {
  return dedupedRequest(
    `analysis-month:${month}`,
    async () => {
      const response = await fetch(`/api/analysis/month?month=${month}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("ANALYSIS_MONTH_QUERY_FAILED");
      }

      return (await response.json()) as AnalysisMonthRecord;
    },
    { force: options?.force }
  );
}
