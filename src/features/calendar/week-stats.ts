import { getInterviewDimensionMeta } from "@/features/interview/dimensions";
import type { CalendarSourceDimension, CalendarWeekRecord } from "@/features/calendar/types";

export interface CalendarWeekDimensionCoverage {
  dimension: CalendarSourceDimension;
  label: string;
  touchedDayCount: number;
  completedDayCount: number;
  draftDayCount: number;
}

export interface CalendarWeekStats {
  recordedDayCount: number;
  draftCount: number;
  completedCount: number;
  dimensionCoverageCount: number;
  summary: string;
  dimensions: CalendarWeekDimensionCoverage[];
}

const dimensionOrder: CalendarSourceDimension[] = [
  "joy",
  "fulfillment",
  "reflection",
  "improvement",
  "gratitude"
];

export function buildCalendarWeekStats(week: CalendarWeekRecord): CalendarWeekStats {
  const dimensions = dimensionOrder.map<CalendarWeekDimensionCoverage>((dimension) => {
    const touchedDayCount = week.days.filter((day) =>
      day.dimensions.some((item) => item.dimension === dimension && item.status !== "empty")
    ).length;
    const completedDayCount = week.days.filter((day) =>
      day.dimensions.some((item) => item.dimension === dimension && item.hasSavedEntry)
    ).length;
    const draftDayCount = week.days.filter((day) =>
      day.dimensions.some((item) => item.dimension === dimension && item.hasDraftEntry)
    ).length;

    return {
      dimension,
      label: getInterviewDimensionMeta(dimension).label,
      touchedDayCount,
      completedDayCount,
      draftDayCount
    };
  });

  const recordedDayCount = week.days.filter((day) => day.overallStatus !== "empty").length;
  const draftCount = week.days.reduce((total, day) => total + day.draftCount, 0);
  const completedCount = week.days.reduce((total, day) => total + day.savedCount, 0);
  const dimensionCoverageCount = dimensions.filter((dimension) => dimension.touchedDayCount > 0).length;

  let summary = "这一周还没有开始记录，可以先从今天的一个维度补起。";

  if (recordedDayCount > 0) {
    summary = `这周有 ${recordedDayCount} 天留下记录，已经触达 ${dimensionCoverageCount} 个维度。`;

    if (draftCount > 0) {
      summary += ` 还有 ${draftCount} 条草稿值得继续补完。`;
    } else if (completedCount > 0) {
      summary += ` 已经正式完成 ${completedCount} 条日志。`;
    }
  }

  return {
    recordedDayCount,
    draftCount,
    completedCount,
    dimensionCoverageCount,
    summary,
    dimensions
  };
}
