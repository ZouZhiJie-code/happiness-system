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
  preview: string;
  statusLabel: string;
  dimensionPills: CalendarMonthCellDimensionPill[];
  extraDimensionCount: number;
  hasRecords: boolean;
}

export interface CalendarMonthPanelDimensionItem {
  dimension: CalendarDimensionStatus["dimension"];
  label: string;
  status: CalendarDimensionStatus["status"];
  statusLabel: string;
  title: string | null;
  summary: string | null;
}

export interface CalendarMonthPanelState {
  statusLabel: string;
  headline: string;
  description: string;
  updatedAtLabel: string | null;
  dimensionItems: CalendarMonthPanelDimensionItem[];
  isFuture: boolean;
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

function getPanelDescription(day: CalendarDayRecord, today: string) {
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

export function buildCalendarMonthCellPreview(day: CalendarDayRecord): CalendarMonthCellPreview {
  const touchedDimensions = day.dimensions.filter((dimension) => dimension.status !== "empty");

  return {
    preview: getMonthPreviewText(day),
    statusLabel: calendarDayStatusLabelMap[day.overallStatus],
    dimensionPills: touchedDimensions.slice(0, 3).map((dimension) => ({
      dimension: dimension.dimension,
      label: getCalendarDimensionVisualMeta(dimension.dimension).shortLabel,
      tone: getDimensionPillTone(dimension.status)
    })),
    extraDimensionCount: Math.max(touchedDimensions.length - 3, 0),
    hasRecords: day.overallStatus !== "empty"
  };
}

export function buildCalendarMonthPanelState(day: CalendarDayRecord, today: string): CalendarMonthPanelState {
  const dimensionItems = day.dimensions
    .filter((dimension) => dimension.status !== "empty")
    .map<CalendarMonthPanelDimensionItem>((dimension) => ({
      dimension: dimension.dimension,
      label: getInterviewDimensionMeta(dimension.dimension).label,
      status: dimension.status,
      statusLabel: calendarDayStatusLabelMap[dimension.status],
      title: dimension.title,
      summary: dimension.summary
    }));

  return {
    statusLabel: calendarDayStatusLabelMap[day.overallStatus],
    headline: day.primaryTitle ?? "还没有标题。",
    description: getPanelDescription(day, today),
    updatedAtLabel: formatCalendarUpdatedAt(day.latestUpdatedAt),
    dimensionItems,
    isFuture: isFutureCalendarDate(day.date, today)
  };
}
