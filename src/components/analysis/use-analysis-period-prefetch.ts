"use client";

import { useEffect } from "react";

import { fetchAnalysisMonthRecord } from "@/features/analysis/month-client";
import {
  buildAnalysisPeriodStateFromShift,
  type AnalysisPeriodState
} from "@/features/analysis/period-state";
import { fetchAnalysisTrendsRange } from "@/features/analysis/range-client";
import { shiftAnalysisTrendsRange } from "@/features/analysis/view-state";

export function prefetchAnalysisPeriod(period: AnalysisPeriodState) {
  void fetchAnalysisMonthRecord(period.month);
  void fetchAnalysisTrendsRange({
    preset: period.preset,
    month: period.month,
    startDate: period.preset !== "month" ? period.startDate : undefined,
    endDate: period.preset !== "month" ? period.endDate : undefined
  });
}

export function prefetchAnalysisPeriodByOffset(period: AnalysisPeriodState, offset: -1 | 1) {
  const shifted = shiftAnalysisTrendsRange({
    preset: period.preset,
    month: period.month,
    startDate: period.startDate,
    endDate: period.endDate,
    offset
  });

  prefetchAnalysisPeriod(buildAnalysisPeriodStateFromShift(shifted));
}

export function prefetchAdjacentAnalysisPeriods(period: AnalysisPeriodState) {
  for (const offset of [-1, 1] as const) {
    const shifted = shiftAnalysisTrendsRange({
      preset: period.preset,
      month: period.month,
      startDate: period.startDate,
      endDate: period.endDate,
      offset
    });

    prefetchAnalysisPeriod(buildAnalysisPeriodStateFromShift(shifted));
  }
}

export function useAnalysisPeriodPrefetch(period: AnalysisPeriodState, enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    prefetchAdjacentAnalysisPeriods(period);
  }, [enabled, period.endDate, period.month, period.preset, period.startDate]);
}
