import { buildPeriodCacheKey, type AnalysisPeriodState } from "@/features/analysis/period-state";
import type { AnalysisMonthRecord, AnalysisTrendsRangeRecord } from "@/features/analysis/types";

const monthCache = new Map<string, AnalysisMonthRecord>();
const rangeCache = new Map<string, AnalysisTrendsRangeRecord>();

export function buildAnalysisMonthCacheKey(month: string) {
  return `month:${month}`;
}

export function buildAnalysisRangeCacheKey(period: AnalysisPeriodState) {
  return `range:${buildPeriodCacheKey(period)}`;
}

export function hasCachedAnalysisMonthRecord(month: string) {
  return monthCache.has(buildAnalysisMonthCacheKey(month));
}

export function getCachedAnalysisMonthRecord(month: string) {
  return monthCache.get(buildAnalysisMonthCacheKey(month)) ?? null;
}

export function saveAnalysisMonthRecord(month: string, record: AnalysisMonthRecord) {
  monthCache.set(buildAnalysisMonthCacheKey(month), record);
}

export function hasCachedAnalysisTrendsRange(period: AnalysisPeriodState) {
  return rangeCache.has(buildAnalysisRangeCacheKey(period));
}

export function getCachedAnalysisTrendsRange(period: AnalysisPeriodState) {
  return rangeCache.get(buildAnalysisRangeCacheKey(period)) ?? null;
}

export function saveAnalysisTrendsRange(period: AnalysisPeriodState, record: AnalysisTrendsRangeRecord) {
  rangeCache.set(buildAnalysisRangeCacheKey(period), record);
}

export function clearAllAnalysisRecordCache() {
  monthCache.clear();
  rangeCache.clear();
}
