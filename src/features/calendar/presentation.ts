import type { CalendarDayStatus, CalendarDimensionStatus } from "@/features/calendar/types";

export type CalendarMonthDimensionPillTone = "empty" | "active" | "draft" | "completed" | "mixed";

export interface CalendarStatusVisualMeta {
  badgeClass: string;
  surfaceClass: string;
  markerClass: string;
  emphasisClass: string;
}

export interface CalendarDimensionVisualMeta {
  shortLabel: string;
  softBadgeClass: string;
  solidBadgeClass: string;
  dotClass: string;
}

export const calendarDayStatusLabelMap: Record<CalendarDayStatus, string> = {
  empty: "未记录",
  in_progress: "进行中",
  draft: "有草稿",
  completed: "已完成",
  mixed: "混合状态"
};

const calendarStatusVisualMetaMap: Record<CalendarDayStatus, CalendarStatusVisualMeta> = {
  empty: {
    badgeClass: "border-[#d8dee6] bg-[#f5f7fa] text-[#667085]",
    surfaceClass: "border-[#dce3ea] bg-[#fcfcfd]",
    markerClass: "border-[#cbd5e1] bg-[#fcfcfd]",
    emphasisClass: "text-[#667085]"
  },
  in_progress: {
    badgeClass: "border-[#e5c27f] bg-[#fff5e4] text-[#8a5d17]",
    surfaceClass: "border-[#ead1a4] bg-[#fffaf1]",
    markerClass: "border-[#d6a44f] bg-[#f0bf63]",
    emphasisClass: "text-[#8a5d17]"
  },
  draft: {
    badgeClass: "border-[#b7cbe0] bg-[#eef4fb] text-[#365f86]",
    surfaceClass: "border-[#caddf0] bg-[#f7fbff]",
    markerClass: "border-[#6d98c3] bg-[#8bb2d8]",
    emphasisClass: "text-[#365f86]"
  },
  completed: {
    badgeClass: "border-[#a8ccb5] bg-[#ecf7ef] text-[#2f6845]",
    surfaceClass: "border-[#bed9c4] bg-[#f7fcf8]",
    markerClass: "border-[#4d8b63] bg-[#67a478]",
    emphasisClass: "text-[#2f6845]"
  },
  mixed: {
    badgeClass: "border-[#d6b091] bg-[#fbf0e7] text-[#8f4f2d]",
    surfaceClass: "border-[#e1c4ae] bg-[#fff9f5]",
    markerClass: "border-[#b7754d] bg-[#cd8b61]",
    emphasisClass: "text-[#8f4f2d]"
  }
};

const calendarDimensionVisualMetaMap: Record<CalendarDimensionStatus["dimension"], CalendarDimensionVisualMeta> = {
  joy: {
    shortLabel: "开心",
    softBadgeClass: "border-[#f0c2ab] bg-[#fff1e8] text-[#9b4e22]",
    solidBadgeClass: "border-[#e98a59] bg-[#e98a59] text-[#fff8f4]",
    dotClass: "bg-[#e98a59]"
  },
  fulfillment: {
    shortLabel: "充实",
    softBadgeClass: "border-[#b7d5d3] bg-[#eef8f7] text-[#256b68]",
    solidBadgeClass: "border-[#429b95] bg-[#429b95] text-[#f5fffe]",
    dotClass: "bg-[#429b95]"
  },
  reflection: {
    shortLabel: "思考",
    softBadgeClass: "border-[#c8c8ee] bg-[#f2f1ff] text-[#5257a1]",
    solidBadgeClass: "border-[#7377c8] bg-[#7377c8] text-[#f7f8ff]",
    dotClass: "bg-[#7377c8]"
  },
  improvement: {
    shortLabel: "改进",
    softBadgeClass: "border-[#bdd9c4] bg-[#f0faf2] text-[#2f6c43]",
    solidBadgeClass: "border-[#5b9a71] bg-[#5b9a71] text-[#f6fff8]",
    dotClass: "bg-[#5b9a71]"
  },
  gratitude: {
    shortLabel: "感谢",
    softBadgeClass: "border-[#e4bfd1] bg-[#fdf0f6] text-[#8e496d]",
    solidBadgeClass: "border-[#c06c97] bg-[#c06c97] text-[#fff8fc]",
    dotClass: "bg-[#c06c97]"
  }
};

export function getCalendarStatusVisualMeta(status: CalendarDayStatus) {
  return calendarStatusVisualMetaMap[status];
}

export function getCalendarDimensionVisualMeta(dimension: CalendarDimensionStatus["dimension"]) {
  return calendarDimensionVisualMetaMap[dimension];
}

export function getCalendarStatusBadgeClass(status: CalendarDayStatus) {
  return getCalendarStatusVisualMeta(status).badgeClass;
}

export function getCalendarDaySurfaceClass(status: CalendarDayStatus) {
  return getCalendarStatusVisualMeta(status).surfaceClass;
}

export function getCalendarDimensionMarkerClass(status: CalendarDimensionStatus["status"]) {
  return getCalendarStatusVisualMeta(status).markerClass;
}

export function getCalendarMonthDaySurfaceClass(status: CalendarDayStatus, hasRecords: boolean) {
  if (!hasRecords || status === "empty") {
    return calendarStatusVisualMetaMap.empty.surfaceClass;
  }

  return getCalendarStatusVisualMeta(status).surfaceClass;
}

export function getCalendarMonthDimensionPillClass(tone: CalendarMonthDimensionPillTone) {
  switch (tone) {
    case "active":
      return "opacity-100";
    case "draft":
      return "opacity-100 ring-1 ring-inset ring-[#b7cbe0]";
    case "completed":
      return "opacity-100 ring-1 ring-inset ring-[#a8ccb5]";
    case "mixed":
      return "opacity-100 ring-1 ring-inset ring-[#d6b091]";
    default:
      return "opacity-65";
  }
}

export function getCalendarWeekDaySurfaceClass(status: CalendarDayStatus) {
  return getCalendarStatusVisualMeta(status).surfaceClass;
}
