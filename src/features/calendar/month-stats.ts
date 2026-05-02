import type { CalendarMonthRecord } from "@/features/calendar/types";

export interface CalendarMonthStats {
  recordedDayCount: number;
  completedDayCount: number;
  followUpDayCount: number;
  dimensionCoverageCount: number;
}

export function buildCalendarMonthStats(month: CalendarMonthRecord): CalendarMonthStats {
  const dimensionCoverage = new Set<string>();

  month.days.forEach((day) => {
    day.dimensions.forEach((dimension) => {
      if (dimension.status !== "empty") {
        dimensionCoverage.add(dimension.dimension);
      }
    });
  });

  return {
    recordedDayCount: month.days.filter((day) => day.overallStatus !== "empty").length,
    completedDayCount: month.days.filter((day) => day.savedCount > 0).length,
    followUpDayCount: month.days.filter((day) => day.activeCount > 0 || day.draftCount > 0).length,
    dimensionCoverageCount: dimensionCoverage.size
  };
}
