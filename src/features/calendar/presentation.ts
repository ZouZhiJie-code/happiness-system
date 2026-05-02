import type { CalendarDayStatus, CalendarDimensionStatus } from "@/features/calendar/types";

export type CalendarMonthDimensionPillTone = "empty" | "active" | "draft" | "completed" | "mixed";

export const calendarDayStatusLabelMap: Record<CalendarDayStatus, string> = {
  empty: "未记录",
  in_progress: "进行中",
  draft: "有草稿",
  completed: "已完成",
  mixed: "混合状态"
};

export function getCalendarStatusBadgeClass(status: CalendarDayStatus) {
  switch (status) {
    case "completed":
      return "border-[rgba(130,84,40,0.24)] bg-[rgba(201,160,110,0.28)] text-[#6b4727]";
    case "draft":
      return "border-[rgba(161,109,61,0.22)] bg-[rgba(224,186,138,0.24)] text-[#7a5230]";
    case "in_progress":
      return "border-[rgba(182,128,75,0.22)] bg-[rgba(241,219,183,0.36)] text-[#8a613a]";
    case "mixed":
      return "border-[rgba(145,94,48,0.22)] bg-[rgba(235,205,161,0.36)] text-[#704828]";
    default:
      return "border-[rgba(158,119,81,0.18)] bg-[rgba(255,250,241,0.72)] text-[#8b7057]";
  }
}

export function getCalendarDaySurfaceClass(status: CalendarDayStatus) {
  switch (status) {
    case "in_progress":
      return "border-[rgba(192,136,82,0.32)] bg-[linear-gradient(180deg,rgba(255,244,225,0.96),rgba(243,220,183,0.94))]";
    case "draft":
      return "border-[rgba(184,126,73,0.34)] bg-[linear-gradient(180deg,rgba(255,240,214,0.98),rgba(235,209,171,0.96))]";
    case "completed":
      return "border-[rgba(153,102,53,0.38)] bg-[linear-gradient(180deg,rgba(236,205,166,0.98),rgba(210,172,121,0.96))]";
    case "mixed":
      return "border-[rgba(162,108,60,0.38)] bg-[linear-gradient(180deg,rgba(246,229,203,0.98),rgba(224,189,142,0.94))]";
    default:
      return "border-[rgba(157,118,78,0.14)] bg-[rgba(255,250,242,0.78)]";
  }
}

export function getCalendarDimensionMarkerClass(status: CalendarDimensionStatus["status"]) {
  switch (status) {
    case "in_progress":
      return "border-[rgba(191,136,79,0.32)] bg-[rgba(207,158,104,0.36)]";
    case "draft":
      return "border-[rgba(179,120,67,0.42)] bg-[rgba(204,149,92,0.58)]";
    case "completed":
      return "border-[rgba(139,89,41,0.52)] bg-[rgba(165,108,57,0.9)]";
    case "mixed":
      return "border-[rgba(130,83,38,0.56)] bg-[linear-gradient(180deg,rgba(195,144,92,0.94),rgba(155,104,54,0.92))]";
    default:
      return "border-[rgba(153,115,75,0.18)] bg-transparent";
  }
}

export function getCalendarMonthDaySurfaceClass(status: CalendarDayStatus, hasRecords: boolean) {
  if (!hasRecords || status === "empty") {
    return "border-[rgba(157,118,78,0.12)] bg-[rgba(255,252,246,0.78)]";
  }

  switch (status) {
    case "in_progress":
      return "border-[rgba(192,136,82,0.32)] bg-[linear-gradient(180deg,rgba(255,247,232,0.98),rgba(245,225,191,0.92))]";
    case "draft":
      return "border-[rgba(184,126,73,0.34)] bg-[linear-gradient(180deg,rgba(255,243,220,0.98),rgba(239,214,176,0.94))]";
    case "completed":
      return "border-[rgba(153,102,53,0.38)] bg-[linear-gradient(180deg,rgba(242,218,183,0.98),rgba(220,183,130,0.94))]";
    case "mixed":
      return "border-[rgba(162,108,60,0.38)] bg-[linear-gradient(180deg,rgba(248,234,210,0.98),rgba(230,197,149,0.94))]";
    default:
      return "border-[rgba(157,118,78,0.12)] bg-[rgba(255,252,246,0.78)]";
  }
}

export function getCalendarMonthDimensionPillClass(tone: CalendarMonthDimensionPillTone) {
  switch (tone) {
    case "active":
      return "border-[rgba(191,136,79,0.22)] bg-[rgba(244,226,194,0.88)] text-[#855e37]";
    case "draft":
      return "border-[rgba(179,120,67,0.22)] bg-[rgba(239,217,184,0.92)] text-[#774f2d]";
    case "completed":
      return "border-[rgba(139,89,41,0.28)] bg-[rgba(227,192,146,0.94)] text-[#653f22]";
    case "mixed":
      return "border-[rgba(130,83,38,0.26)] bg-[rgba(233,206,164,0.94)] text-[#684225]";
    default:
      return "border-[rgba(153,115,75,0.14)] bg-[rgba(255,251,245,0.82)] text-[#8b7057]";
  }
}

export function getCalendarWeekDaySurfaceClass(status: CalendarDayStatus) {
  switch (status) {
    case "in_progress":
      return "border-[rgba(192,136,82,0.28)] bg-[linear-gradient(180deg,rgba(255,248,233,0.98),rgba(246,228,197,0.9))]";
    case "draft":
      return "border-[rgba(184,126,73,0.3)] bg-[linear-gradient(180deg,rgba(255,244,224,0.98),rgba(242,220,187,0.92))]";
    case "completed":
      return "border-[rgba(153,102,53,0.34)] bg-[linear-gradient(180deg,rgba(243,221,187,0.98),rgba(224,190,138,0.92))]";
    case "mixed":
      return "border-[rgba(162,108,60,0.34)] bg-[linear-gradient(180deg,rgba(249,236,214,0.98),rgba(233,202,156,0.92))]";
    default:
      return "border-[rgba(157,118,78,0.12)] bg-[rgba(255,252,246,0.82)]";
  }
}
