import { beforeEach, describe, expect, it } from "vitest";

import {
  buildAnalysisMonthCacheKey,
  buildAnalysisRangeCacheKey,
  clearAllAnalysisRecordCache,
  getCachedAnalysisMonthRecord,
  getCachedAnalysisTrendsRange,
  hasCachedAnalysisMonthRecord,
  hasCachedAnalysisTrendsRange,
  saveAnalysisMonthRecord,
  saveAnalysisTrendsRange
} from "@/features/analysis/analysis-record-cache";
import type { AnalysisPeriodState } from "@/features/analysis/period-state";
import type { AnalysisMonthRecord, AnalysisTrendsRangeRecord } from "@/features/analysis/types";

const monthRecord = {
  month: "2026-05"
} as AnalysisMonthRecord;

const rangeRecord = {
  preset: "month",
  month: "2026-05",
  startDate: "2026-05-01",
  endDate: "2026-05-31"
} as unknown as AnalysisTrendsRangeRecord;

const period: AnalysisPeriodState = {
  preset: "month",
  month: "2026-05",
  startDate: "2026-05-01",
  endDate: "2026-05-31"
};

describe("analysis-record-cache", () => {
  beforeEach(() => {
    clearAllAnalysisRecordCache();
  });

  it("builds stable cache keys", () => {
    expect(buildAnalysisMonthCacheKey("2026-05")).toBe("month:2026-05");
    expect(buildAnalysisRangeCacheKey(period)).toBe("range:month:2026-05:2026-05-01:2026-05-31");
  });

  it("saves and reads month and range records", () => {
    saveAnalysisMonthRecord("2026-05", monthRecord);
    saveAnalysisTrendsRange(period, rangeRecord);

    expect(hasCachedAnalysisMonthRecord("2026-05")).toBe(true);
    expect(getCachedAnalysisMonthRecord("2026-05")).toEqual(monthRecord);
    expect(hasCachedAnalysisTrendsRange(period)).toBe(true);
    expect(getCachedAnalysisTrendsRange(period)).toEqual(rangeRecord);
  });
});
