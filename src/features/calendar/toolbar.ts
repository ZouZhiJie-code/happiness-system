import type { CalendarMonthStats } from "@/features/calendar/month-stats";
import type { CalendarDayRecord } from "@/features/calendar/types";
import type { CalendarWeekStats } from "@/features/calendar/week-stats";
import {
  formatCalendarDayLabel,
  formatCalendarMonthLabel,
  formatCalendarWeekLabel,
  shiftCalendarDay,
  shiftCalendarMonth,
  shiftCalendarWeek,
  type CalendarView
} from "@/features/calendar/view-state";

export interface CalendarToolbarState {
  title: string;
  previousDate: string;
  nextDate: string;
  previousLabel: string;
  nextLabel: string;
}

export interface CalendarToolbarChip {
  id: string;
  label: string;
  value: string;
}

export function buildCalendarToolbarState(input: {
  view: CalendarView;
  date: string;
}): CalendarToolbarState {
  const { view, date } = input;

  if (view === "week") {
    return {
      title: formatCalendarWeekLabel(date),
      previousDate: shiftCalendarWeek(date, -1),
      nextDate: shiftCalendarWeek(date, 1),
      previousLabel: "上一周",
      nextLabel: "下一周"
    };
  }

  if (view === "day") {
    return {
      title: formatCalendarDayLabel(date),
      previousDate: shiftCalendarDay(date, -1),
      nextDate: shiftCalendarDay(date, 1),
      previousLabel: "前一天",
      nextLabel: "后一天"
    };
  }

  return {
    title: formatCalendarMonthLabel(date),
    previousDate: shiftCalendarMonth(date, -1),
    nextDate: shiftCalendarMonth(date, 1),
    previousLabel: "上个月",
    nextLabel: "下个月"
  };
}

export function buildCalendarToolbarFallbackChips(view: CalendarView): CalendarToolbarChip[] {
  if (view === "week") {
    return [
      { id: "recorded", label: "记录", value: "--" },
      { id: "draft", label: "草稿", value: "--" },
      { id: "completed", label: "完成", value: "--" }
    ];
  }

  if (view === "day") {
    return [
      { id: "active", label: "进行中", value: "--" },
      { id: "draft", label: "草稿", value: "--" },
      { id: "saved", label: "完成", value: "--" }
    ];
  }

  return [
    { id: "recorded", label: "记录", value: "--" },
    { id: "follow-up", label: "待继续", value: "--" },
    { id: "coverage", label: "覆盖", value: "--" }
  ];
}

export function buildCalendarToolbarChips(input: {
  view: CalendarView;
  monthStats?: CalendarMonthStats | null;
  weekStats?: CalendarWeekStats | null;
  dayRecord?: CalendarDayRecord | null;
}): CalendarToolbarChip[] {
  const { view, monthStats, weekStats, dayRecord } = input;

  if (view === "week") {
    return [
      {
        id: "recorded",
        label: "记录",
        value: weekStats ? `${weekStats.recordedDayCount}天` : "--"
      },
      {
        id: "draft",
        label: "草稿",
        value: weekStats ? `${weekStats.draftCount}条` : "--"
      },
      {
        id: "completed",
        label: "完成",
        value: weekStats ? `${weekStats.completedCount}条` : "--"
      }
    ];
  }

  if (view === "day") {
    return [
      {
        id: "active",
        label: "进行中",
        value: dayRecord ? `${dayRecord.activeCount}项` : "--"
      },
      {
        id: "draft",
        label: "草稿",
        value: dayRecord ? `${dayRecord.draftCount}项` : "--"
      },
      {
        id: "saved",
        label: "完成",
        value: dayRecord ? `${dayRecord.savedCount}项` : "--"
      }
    ];
  }

  return [
    {
      id: "recorded",
      label: "记录",
      value: monthStats ? `${monthStats.recordedDayCount}天` : "--"
    },
    {
      id: "follow-up",
      label: "待继续",
      value: monthStats ? `${monthStats.followUpDayCount}天` : "--"
    },
    {
      id: "coverage",
      label: "覆盖",
      value: monthStats ? `${monthStats.dimensionCoverageCount}维` : "--"
    }
  ];
}
