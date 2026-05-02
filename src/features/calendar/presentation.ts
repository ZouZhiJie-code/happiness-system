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
    badgeClass: "border-[#dbcab7] bg-[#f7efe4] text-[#7a6857]",
    surfaceClass: "border-[#dfcfbb] bg-[#fdf8f1]",
    markerClass: "border-[#cab69f] bg-[#fdf8f1]",
    emphasisClass: "text-[#7a6857]"
  },
  in_progress: {
    badgeClass: "border-[#e2c188] bg-[#fff3df] text-[#8d5a21]",
    surfaceClass: "border-[#e6c99c] bg-[#fff8eb]",
    markerClass: "border-[#ce9849] bg-[#e4b05f]",
    emphasisClass: "text-[#8a5d17]"
  },
  draft: {
    badgeClass: "border-[#d7beca] bg-[#fbf0f5] text-[#7c5568]",
    surfaceClass: "border-[#e0c9d3] bg-[#fff7fb]",
    markerClass: "border-[#b9879f] bg-[#c999b0]",
    emphasisClass: "text-[#7c5568]"
  },
  completed: {
    badgeClass: "border-[#bfd0b6] bg-[#edf5ea] text-[#45644a]",
    surfaceClass: "border-[#cad7c1] bg-[#f8fbf6]",
    markerClass: "border-[#68866a] bg-[#84a081]",
    emphasisClass: "text-[#45644a]"
  },
  mixed: {
    badgeClass: "border-[#d5b095] bg-[#fbefe5] text-[#8e5638]",
    surfaceClass: "border-[#dec0aa] bg-[#fff8f2]",
    markerClass: "border-[#b47656] bg-[#cb8d6d]",
    emphasisClass: "text-[#8e5638]"
  }
};

const calendarDimensionVisualMetaMap: Record<CalendarDimensionStatus["dimension"], CalendarDimensionVisualMeta> = {
  joy: {
    shortLabel: "开心",
    softBadgeClass: "border-[#edc3aa] bg-[#fff1e5] text-[#99522a]",
    solidBadgeClass: "border-[#d68a5a] bg-[#d68a5a] text-[#fff9f3]",
    dotClass: "bg-[#d68a5a]"
  },
  fulfillment: {
    shortLabel: "充实",
    softBadgeClass: "border-[#c3d6c8] bg-[#f0f7f0] text-[#48644f]",
    solidBadgeClass: "border-[#74927a] bg-[#74927a] text-[#f8fff8]",
    dotClass: "bg-[#74927a]"
  },
  reflection: {
    shortLabel: "思考",
    softBadgeClass: "border-[#d8c2d5] bg-[#fbf0f7] text-[#76566f]",
    solidBadgeClass: "border-[#a17a97] bg-[#a17a97] text-[#fff8fd]",
    dotClass: "bg-[#a17a97]"
  },
  improvement: {
    shortLabel: "改进",
    softBadgeClass: "border-[#c7d8bf] bg-[#f3f8ef] text-[#4f6948]",
    solidBadgeClass: "border-[#7d9771] bg-[#7d9771] text-[#fbfff8]",
    dotClass: "bg-[#7d9771]"
  },
  gratitude: {
    shortLabel: "感谢",
    softBadgeClass: "border-[#e2c3c9] bg-[#fdf1f2] text-[#8b5860]",
    solidBadgeClass: "border-[#b8848d] bg-[#b8848d] text-[#fff9fb]",
    dotClass: "bg-[#b8848d]"
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
      return "opacity-100 ring-1 ring-inset ring-[#d7beca]";
    case "completed":
      return "opacity-100 ring-1 ring-inset ring-[#bfd0b6]";
    case "mixed":
      return "opacity-100 ring-1 ring-inset ring-[#d5b095]";
    default:
      return "opacity-65";
  }
}

export function getCalendarWeekDaySurfaceClass(status: CalendarDayStatus) {
  return getCalendarStatusVisualMeta(status).surfaceClass;
}
