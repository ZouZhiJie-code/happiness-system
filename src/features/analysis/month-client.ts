"use client";

import {
  getCachedAnalysisMonthRecord,
  saveAnalysisMonthRecord
} from "@/features/analysis/analysis-record-cache";
import { dedupedRequest } from "@/features/shared/client-request-cache";
import type { AnalysisMonthRecord } from "@/features/analysis/types";

export { getCachedAnalysisMonthRecord };

export async function fetchAnalysisMonthRecord(month: string, options?: { force?: boolean }) {
  if (!options?.force) {
    const cached = getCachedAnalysisMonthRecord(month);

    if (cached) {
      return cached;
    }
  }

  const record = await dedupedRequest(
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

  saveAnalysisMonthRecord(month, record);

  return record;
}
