import { buildCalendarCompactCopy, truncateCalendarCopy } from "@/features/calendar/compact-copy";
import { getInterviewDimensionMeta } from "@/features/interview/dimensions";
import {
  calendarDayStatusLabelMap,
  getCalendarDimensionVisualMeta,
  type CalendarMonthDimensionPillTone
} from "@/features/calendar/presentation";
import type { CalendarDayRecord, CalendarDimensionStatus } from "@/features/calendar/types";
import { formatCalendarUpdatedAt, isFutureCalendarDate } from "@/features/calendar/view-state";

export interface CalendarMonthCellDimensionPill {
  dimension: CalendarDimensionStatus["dimension"];
  token: string;
  tone: CalendarMonthDimensionPillTone;
}

export interface CalendarMonthCellPreview {
  statusLabel: string | null;
  visibleStateLabel: string | null;
  dailyJournalLabel: string | null;
  hasDailyJournal: boolean;
  dimensionPills: CalendarMonthCellDimensionPill[];
  ariaDimensionLabels: string[];
  extraDimensionCount: number;
  hasRecords: boolean;
  isFutureEmpty: boolean;
}

export interface CalendarMonthPanelDimensionItem {
  dimension: CalendarDimensionStatus["dimension"];
  label: string;
  status: CalendarDimensionStatus["status"];
  statusLabel: string;
  preview: string;
}

export interface CalendarMonthPanelState {
  statusLabel: string | null;
  headline: string;
  description: string;
  updatedAtLabel: string | null;
  dailyJournalLabel: string;
  pendingLabel: string;
  pendingHint: string | null;
  dimensionItems: CalendarMonthPanelDimensionItem[];
  isFuture: boolean;
  isFutureEmpty: boolean;
  shouldShowDimensionItems: boolean;
  emptyMessage: string;
}

function getDimensionPillTone(status: CalendarDimensionStatus["status"]): CalendarMonthDimensionPillTone {
  switch (status) {
    case "completed":
      return "completed";
    case "draft":
      return "draft";
    case "in_progress":
      return "active";
    case "mixed":
      return "mixed";
    default:
      return "empty";
  }
}

function isFutureEmptyDay(day: CalendarDayRecord, today: string) {
  return day.overallStatus === "empty" && isFutureCalendarDate(day.date, today);
}

function getMonthVisibleStateLabel(day: CalendarDayRecord, savedDimensionCount: number, futureEmpty: boolean) {
  if (futureEmpty) {
    return null;
  }

  if (savedDimensionCount >= 5) {
    return "已完成";
  }

  if (savedDimensionCount > 0) {
    return null;
  }

  if (day.overallStatus === "draft") {
    return "草稿";
  }

  return null;
}

function getDimensionPreviewFallback(dimension: CalendarDimensionStatus) {
  switch (dimension.status) {
    case "in_progress":
      return "还在访谈里。";
    case "draft":
      return "已有草稿。";
    case "completed":
      return "已经成稿。";
    case "mixed":
      return "先按主动作。";
    default:
      return `${getInterviewDimensionMeta(dimension.dimension).label}还没有记录。`;
  }
}

function getDailyJournalLabel(day: CalendarDayRecord) {
  switch (day.dailyJournal?.state ?? "none") {
    case "saved":
      return "当天日志已保存";
    case "draft":
      return "当天日志草稿";
    case "stale":
      return "当天日志来源已更新";
    default:
      return null;
  }
}

function getDailyJournalPanelLabel(day: CalendarDayRecord) {
  switch (day.dailyJournal?.state ?? "none") {
    case "saved":
      return "已保存";
    case "draft":
      return "草稿";
    case "stale":
      return "需更新";
    default:
      return day.savedCount > 0 ? "可汇总" : "未生成";
  }
}

function getPendingLabel(day: CalendarDayRecord) {
  const pendingCount = day.activeCount + day.draftCount;

  return pendingCount > 0 ? `${pendingCount}项` : "暂无";
}

function getPendingHint(day: CalendarDayRecord) {
  const pendingCount = day.activeCount + day.draftCount;

  if (pendingCount <= 0) {
    return null;
  }

  return `有 ${pendingCount} 项还可以回到当天继续。`;
}

function getPanelDescription(day: CalendarDayRecord, today: string) {
  if (isFutureEmptyDay(day, today)) {
    return "这一天还没到，到了当天再记录。";
  }

  if (day.primarySummary) {
    return day.primarySummary;
  }

  if (day.primaryTitle) {
    return "已有主线，直接看当天。";
  }

  if (isFutureCalendarDate(day.date, today)) {
    return "未来日期暂不支持开始记录。";
  }

  return "进入当天后，可以从任一维开始。";
}

export function buildCalendarMonthCellPreview(day: CalendarDayRecord, today: string): CalendarMonthCellPreview {
  const touchedDimensions = day.dimensions.filter((dimension) => dimension.status !== "empty");
  const savedDimensions = day.dimensions.filter((dimension) => dimension.hasSavedEntry);
  const futureEmpty = isFutureEmptyDay(day, today);
  const visibleStateLabel = getMonthVisibleStateLabel(day, savedDimensions.length, futureEmpty);

  return {
    statusLabel: futureEmpty ? null : calendarDayStatusLabelMap[day.overallStatus],
    visibleStateLabel,
    dailyJournalLabel: getDailyJournalLabel(day),
    hasDailyJournal: (day.dailyJournal?.state ?? "none") !== "none",
    dimensionPills: visibleStateLabel === "已完成"
      ? []
      : savedDimensions.slice(0, 4).map((dimension) => ({
      dimension: dimension.dimension,
      token: getCalendarDimensionVisualMeta(dimension.dimension).monthLabel,
      tone: "completed"
    })),
    ariaDimensionLabels: touchedDimensions.map((dimension) => getCalendarDimensionVisualMeta(dimension.dimension).shortLabel),
    extraDimensionCount: 0,
    hasRecords: day.overallStatus !== "empty",
    isFutureEmpty: futureEmpty
  };
}

export function buildCalendarMonthPanelState(day: CalendarDayRecord, today: string): CalendarMonthPanelState {
  const futureEmpty = isFutureEmptyDay(day, today);
  const emptyPast = !futureEmpty && day.overallStatus === "empty";
  const dimensionItems = day.dimensions.map<CalendarMonthPanelDimensionItem>((dimension) => ({
    dimension: dimension.dimension,
    label: getInterviewDimensionMeta(dimension.dimension).label,
    status: dimension.status,
    statusLabel: calendarDayStatusLabelMap[dimension.status],
    preview: buildCalendarCompactCopy(
      [dimension.title, dimension.summary],
      getDimensionPreviewFallback(dimension),
      34
    )
  }));

  return {
    statusLabel: futureEmpty ? null : calendarDayStatusLabelMap[day.overallStatus],
    headline: futureEmpty
      ? "这一天还没到。"
      : truncateCalendarCopy(day.primaryTitle ?? day.primarySummary ?? "这一天还空着。", 22),
    description: truncateCalendarCopy(getPanelDescription(day, today), 42),
    updatedAtLabel: formatCalendarUpdatedAt(day.latestUpdatedAt),
    dailyJournalLabel: getDailyJournalPanelLabel(day),
    pendingLabel: getPendingLabel(day),
    pendingHint: getPendingHint(day),
    dimensionItems,
    isFuture: isFutureCalendarDate(day.date, today),
    isFutureEmpty: futureEmpty,
    shouldShowDimensionItems: !futureEmpty && !emptyPast,
    emptyMessage: futureEmpty ? "未来日期先保留。" : "五维都还没开始，进入当天后可以从任一维开始。"
  };
}
