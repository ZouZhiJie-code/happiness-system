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
    return "这一天暂时还不会开始，先保留这个位置。";
  }

  switch (day.overallStatus) {
    case "in_progress":
      return "这一天还有访谈线索没收住，适合先继续补完整。";
    case "draft":
      return "这一天已经有草稿，适合先补成稳定版本。";
    case "completed":
      return "这一天已经有成稿，可以直接查看成果。";
    case "mixed":
      return "这一天同时有进行中、草稿或成稿线索，最值得先处理。";
    default:
      return "这一天还没有记录，可以从这里开始第一条。";
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
    return `先补完 ${draftCount} 条草稿，最容易把这周的记录往前推。`;
  }

  const activeCount = sumActiveCount(week);

  if (activeCount > 0) {
    return `这周还有 ${activeCount} 项进行中，优先继续还没收住的那几天。`;
  }

  const completedCount = week.days.reduce((total, day) => total + day.savedCount, 0);

  if (completedCount > 0) {
    return `这一周已经完成 ${completedCount} 条日志，可以先查看最完整的那一天。`;
  }

  return "这一周还没有留下记录，可以先从今天补第一条。";
}

export function buildCalendarWeekCardState(day: CalendarDayRecord, today: string): CalendarWeekCardState {
  return {
    date: day.date,
    statusLabel: calendarDayStatusLabelMap[day.overallStatus],
    headline: getWeekCardHeadline(day, today),
    completedCountLabel: `已完成 ${day.savedCount} 项`,
    draftCountLabel: `草稿 ${day.draftCount} 项`,
    activeCountLabel: `进行中 ${day.activeCount} 项`,
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
