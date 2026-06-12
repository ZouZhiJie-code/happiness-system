import { formatAnalysisDateRangeLabel, type AnalysisRangePreset } from "@/features/analysis/date-range";
import {
  formatAnalysisMonthLabel,
  resolveAnalysisTrendsRange,
  shiftAnalysisTrendsRange
} from "@/features/analysis/view-state";

export type AnalysisPeriodState = {
  preset: AnalysisRangePreset;
  month: string;
  startDate: string;
  endDate: string;
};

export function buildAnalysisPeriodState(input: {
  preset: AnalysisRangePreset;
  month: string;
  startDate?: string;
  endDate?: string;
  today?: string;
}): AnalysisPeriodState {
  const resolvedRange = resolveAnalysisTrendsRange({
    preset: input.preset,
    month: input.month,
    startDate: input.startDate,
    endDate: input.endDate,
    today: input.today
  });

  return {
    preset: input.preset,
    month: input.month,
    startDate: resolvedRange.startDate,
    endDate: resolvedRange.endDate
  };
}

export function buildAnalysisPeriodStateFromShift(
  shifted: ReturnType<typeof shiftAnalysisTrendsRange>
): AnalysisPeriodState {
  if (shifted.preset === "month") {
    return buildAnalysisPeriodState({
      preset: "month",
      month: shifted.month
    });
  }

  return {
    preset: shifted.preset,
    month: shifted.month,
    startDate: shifted.startDate,
    endDate: shifted.endDate
  };
}

export function periodStatesEqual(left: AnalysisPeriodState, right: AnalysisPeriodState) {
  return (
    left.preset === right.preset &&
    left.month === right.month &&
    left.startDate === right.startDate &&
    left.endDate === right.endDate
  );
}

export function resolvePeriodDisplayLabel(period: AnalysisPeriodState) {
  if (period.preset === "month") {
    return formatAnalysisMonthLabel(period.month);
  }

  return formatAnalysisDateRangeLabel(period.startDate, period.endDate);
}

export function resolvePeriodNavLabel(period: AnalysisPeriodState) {
  if (period.preset === "month") {
    return formatAnalysisMonthLabel(period.month);
  }

  if (period.preset === "week") {
    return "周";
  }

  return "区间";
}

export function buildPeriodCacheKey(period: AnalysisPeriodState) {
  return `${period.preset}:${period.month}:${period.startDate}:${period.endDate}`;
}
