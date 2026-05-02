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
  label: string;
  tone: CalendarMonthDimensionPillTone;
}

export interface CalendarMonthCellPreview {
  preview: string | null;
  compactPreview: string | null;
  statusLabel: string | null;
  dimensionPills: CalendarMonthCellDimensionPill[];
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
  dimensionItems: CalendarMonthPanelDimensionItem[];
  isFuture: boolean;
  isFutureEmpty: boolean;
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

function getMonthPreviewText(day: CalendarDayRecord) {
  if (day.primaryTitle) {
    return day.primaryTitle;
  }

  if (day.primarySummary) {
    return day.primarySummary;
  }

  return "还没有记录。";
}

function isFutureEmptyDay(day: CalendarDayRecord, today: string) {
  return day.overallStatus === "empty" && isFutureCalendarDate(day.date, today);
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

  return "还没有记录，先看当天。";
}

export function buildCalendarMonthCellPreview(day: CalendarDayRecord, today: string): CalendarMonthCellPreview {
  const touchedDimensions = day.dimensions.filter((dimension) => dimension.status !== "empty");
  const futureEmpty = isFutureEmptyDay(day, today);

  return {
    preview: futureEmpty ? null : getMonthPreviewText(day),
    compactPreview: futureEmpty ? null : buildCalendarCompactCopy([day.primaryTitle, day.primarySummary], "还没有记录。", 18),
    statusLabel: futureEmpty ? null : calendarDayStatusLabelMap[day.overallStatus],
    dimensionPills: touchedDimensions.slice(0, 2).map((dimension) => ({
      dimension: dimension.dimension,
      label: getCalendarDimensionVisualMeta(dimension.dimension).shortLabel,
      tone: getDimensionPillTone(dimension.status)
    })),
    extraDimensionCount: Math.max(touchedDimensions.length - 2, 0),
    hasRecords: day.overallStatus !== "empty",
    isFutureEmpty: futureEmpty
  };
}

export function buildCalendarMonthPanelState(day: CalendarDayRecord, today: string): CalendarMonthPanelState {
  const futureEmpty = isFutureEmptyDay(day, today);
  const dimensionItems = day.dimensions
    .filter((dimension) => dimension.status !== "empty")
    .map<CalendarMonthPanelDimensionItem>((dimension) => ({
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
    headline: futureEmpty ? "未来日期先保留。" : truncateCalendarCopy(day.primaryTitle ?? "还没有标题。", 22),
    description: truncateCalendarCopy(getPanelDescription(day, today), 42),
    updatedAtLabel: formatCalendarUpdatedAt(day.latestUpdatedAt),
    dimensionItems,
    isFuture: isFutureCalendarDate(day.date, today),
    isFutureEmpty: futureEmpty,
    emptyMessage: futureEmpty ? "未来日期先保留。" : "还没有记录，先看当天。"
  };
}
