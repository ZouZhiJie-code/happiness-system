import { formatEntryDate, getTodayEntryDate, isEntryDateString, parseEntryDateInput } from "@/features/interview/entry-date";

export type CalendarView = "month" | "week" | "day";

export interface CalendarMonthGridCell {
  key: string;
  date: string | null;
  dayNumber: number | null;
  isCurrentMonth: boolean;
}

export interface CalendarWeekRange {
  startDate: string;
  endDate: string;
}

function parseDateKey(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, monthNumber: number) {
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

export function normalizeCalendarView(view: string | null | undefined): CalendarView {
  if (view === "week" || view === "day" || view === "month") {
    return view;
  }

  return "month";
}

export function normalizeCalendarDate(date: string | null | undefined, today = getTodayEntryDate()) {
  if (!date || !isEntryDateString(date)) {
    return today;
  }

  try {
    parseEntryDateInput(date);
    return date;
  } catch {
    return today;
  }
}

export function getCalendarMonthKey(date: string) {
  return date.slice(0, 7);
}

export function buildCalendarHref(input: {
  date: string;
  view?: CalendarView;
}) {
  const view = normalizeCalendarView(input.view);
  return `/calendar?view=${view}&date=${input.date}`;
}

export function shiftCalendarMonth(date: string, offset: number) {
  const current = parseDateKey(date);
  const currentDay = current.getUTCDate();
  const targetYear = current.getUTCFullYear();
  const targetMonthIndex = current.getUTCMonth() + offset;
  const monthAnchor = new Date(Date.UTC(targetYear, targetMonthIndex, 1));
  const daysInTargetMonth = getDaysInMonth(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() + 1);
  monthAnchor.setUTCDate(Math.min(currentDay, daysInTargetMonth));
  return formatDateKey(monthAnchor);
}

export function shiftCalendarWeek(date: string, offset: number) {
  const current = parseDateKey(date);
  current.setUTCDate(current.getUTCDate() + offset * 7);
  return formatDateKey(current);
}

export function shiftCalendarDay(date: string, offset: number) {
  const current = parseDateKey(date);
  current.setUTCDate(current.getUTCDate() + offset);
  return formatDateKey(current);
}

export function getCalendarWeekRange(date: string): CalendarWeekRange {
  const current = parseDateKey(date);
  const dayOfWeek = current.getUTCDay();
  const startOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  current.setUTCDate(current.getUTCDate() + startOffset);
  const startDate = formatDateKey(current);

  return {
    startDate,
    endDate: shiftCalendarDay(startDate, 6)
  };
}

export function buildCalendarMonthGrid(month: string): CalendarMonthGridCell[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1));
  const firstDayOfWeek = firstDay.getUTCDay();
  const leadingEmptySlots = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const daysInMonth = getDaysInMonth(year, monthNumber);
  const totalVisibleSlots = 42;
  const cells: CalendarMonthGridCell[] = [];

  for (let index = 0; index < leadingEmptySlots; index += 1) {
    cells.push({
      key: `leading-${index}`,
      date: null,
      dayNumber: null,
      isCurrentMonth: false
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayText = String(day).padStart(2, "0");
    cells.push({
      key: `${month}-${dayText}`,
      date: `${month}-${dayText}`,
      dayNumber: day,
      isCurrentMonth: true
    });
  }

  while (cells.length < totalVisibleSlots) {
    const index = cells.length - (leadingEmptySlots + daysInMonth);
    cells.push({
      key: `trailing-${index}`,
      date: null,
      dayNumber: null,
      isCurrentMonth: false
    });
  }

  return cells;
}

export function isFutureCalendarDate(date: string, today = getTodayEntryDate()) {
  return date > today;
}

export function formatCalendarMonthLabel(date: string) {
  const parsed = parseDateKey(date);
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long"
  }).format(parsed);
}

export function formatCalendarWeekLabel(date: string) {
  const range = getCalendarWeekRange(date);
  const startDate = parseDateKey(range.startDate);
  const endDate = parseDateKey(range.endDate);
  const monthFormatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric"
  });
  const dayFormatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    day: "numeric"
  });

  if (range.startDate.slice(0, 7) === range.endDate.slice(0, 7)) {
    return `${monthFormatter.format(startDate)} - ${dayFormatter.format(endDate)}`;
  }

  return `${monthFormatter.format(startDate)} - ${monthFormatter.format(endDate)}`;
}

export function formatCalendarDayLabel(date: string) {
  const parsed = parseDateKey(date);
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(parsed);
}

export function formatCalendarUpdatedAt(updatedAt: string | null) {
  if (!updatedAt) {
    return null;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(updatedAt));
}

export function formatCalendarWeekdayLabel(date: string) {
  const parsed = parseDateKey(date);
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    weekday: "short"
  }).format(parsed);
}

export function normalizeCalendarSearchParams(input: {
  view?: string | null;
  date?: string | null;
  today?: string;
}) {
  const today = input.today ?? getTodayEntryDate();
  const view = normalizeCalendarView(input.view);
  const date = normalizeCalendarDate(input.date, today);

  return {
    view,
    date,
    href: buildCalendarHref({ view, date })
  };
}

export function formatTodayCalendarHref(today = getTodayEntryDate()) {
  return buildCalendarHref({
    view: "month",
    date: formatEntryDate(parseEntryDateInput(today))
  });
}
