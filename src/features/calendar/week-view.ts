import { buildCalendarPrimaryActionLink } from "@/features/calendar/interview-link";
import { calendarDayStatusLabelMap } from "@/features/calendar/presentation";
import type { CalendarDayRecord, CalendarWeekRecord } from "@/features/calendar/types";
import { buildCalendarHref, isFutureCalendarDate } from "@/features/calendar/view-state";

export interface CalendarWeekCardAction {
  label: string;
  href: string;
  isDirectAction: boolean;
}

export interface CalendarWeekCardState {
  date: string;
  statusLabel: string;
  headline: string;
  completedCountLabel: string;
  draftCountLabel: string;
  activeCountLabel: string;
  touchedDimensions: CalendarDayRecord["dimensions"][number]["dimension"][];
  action: CalendarWeekCardAction;
}

export interface CalendarWeekOverviewState {
  summary: string;
  focusHint: string;
  rangeLabel: string;
}

function getWeekCardHeadline(day: CalendarDayRecord, today: string) {
  if (day.primaryTitle) {
    return day.primaryTitle;
  }

  if (day.primarySummary) {
    return day.primarySummary;
  }

  if (isFutureCalendarDate(day.date, today)) {
    return "未来日期先保留。";
  }

  switch (day.overallStatus) {
    case "in_progress":
      return "还有线索没收住。";
    case "draft":
      return "已有草稿，适合补完。";
    case "completed":
      return "已有成稿，可直接查看。";
    case "mixed":
      return "状态混合，优先处理。";
    default:
      return "还没有记录。";
  }
}

function buildFallbackDayAction(day: CalendarDayRecord): CalendarWeekCardAction {
  return {
    label: "查看当天",
    href: buildCalendarHref({ view: "day", date: day.date }),
    isDirectAction: false
  };
}

function resolveWeekCardAction(day: CalendarDayRecord, today: string): CalendarWeekCardAction {
  const actionLink = buildCalendarPrimaryActionLink(day, today);

  if (!actionLink) {
    return buildFallbackDayAction(day);
  }

  return {
    label: actionLink.label,
    href: actionLink.href as string,
    isDirectAction: true
  };
}

function sumActiveCount(week: CalendarWeekRecord) {
  return week.days.reduce((total, day) => total + day.activeCount, 0);
}

function getWeekFocusHint(week: CalendarWeekRecord) {
  const draftCount = week.days.reduce((total, day) => total + day.draftCount, 0);

  if (draftCount > 0) {
    return `先补 ${draftCount} 条草稿。`;
  }

  const activeCount = sumActiveCount(week);

  if (activeCount > 0) {
    return `先继续 ${activeCount} 项进行中。`;
  }

  const completedCount = week.days.reduce((total, day) => total + day.savedCount, 0);

  if (completedCount > 0) {
    return `先看最完整的一天。`;
  }

  return "先从今天开始。";
}

export function buildCalendarWeekCardState(day: CalendarDayRecord, today: string): CalendarWeekCardState {
  return {
    date: day.date,
    statusLabel: calendarDayStatusLabelMap[day.overallStatus],
    headline: getWeekCardHeadline(day, today),
    completedCountLabel: `已完成 ${day.savedCount} 项`,
    draftCountLabel: `草稿 ${day.draftCount} 项`,
    activeCountLabel: `进行中 ${day.activeCount} 项`,
    touchedDimensions: day.dimensions.filter((dimension) => dimension.status !== "empty").slice(0, 3).map((dimension) => dimension.dimension),
    action: resolveWeekCardAction(day, today)
  };
}

export function buildCalendarWeekOverviewState(week: CalendarWeekRecord, summary: string): CalendarWeekOverviewState {
  return {
    summary,
    focusHint: getWeekFocusHint(week),
    rangeLabel: `${week.weekStartDate} 到 ${week.weekEndDate}`
  };
}
