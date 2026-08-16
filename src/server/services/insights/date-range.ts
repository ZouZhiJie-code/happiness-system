import {
  formatEntryDate,
  getTodayEntryDate,
  parseEntryDateInput
} from "@/features/interview/entry-date";
import type { InsightsDateRange, InsightsRangePreset } from "@/types/insights";

export const MAX_INSIGHTS_RANGE_DAYS = 93;
const DAY_MS = 24 * 60 * 60 * 1000;

export class InsightsRangeError extends Error {
  constructor(public readonly code: "INVALID_INSIGHTS_RANGE") {
    super(code);
  }
}
function assertDate(value: string) {
  try {
    parseEntryDateInput(value);
  } catch {
    throw new InsightsRangeError("INVALID_INSIGHTS_RANGE");
  }
}

function dateValue(value: string) {
  assertDate(value);
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!, 12);
}

export function addInsightsDays(value: string, offset: number) {
  const next = new Date(dateValue(value) + offset * DAY_MS);
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(
    next.getUTCDate()
  ).padStart(2, "0")}`;
}

export function enumerateInsightsDates(startDate: string, endDate: string) {
  const dates: string[] = [];
  for (let current = startDate; current <= endDate; current = addInsightsDays(current, 1)) {
    dates.push(current);
  }
  return dates;
}

function monthRange(anchorDate: string) {
  const [year, month] = anchorDate.split("-").map(Number);
  const endDay = new Date(Date.UTC(year!, month!, 0, 12)).getUTCDate();
  return {
    startDate: `${year}-${String(month).padStart(2, "0")}-01`,
    endDate: `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`
  };
}

function weekRange(anchorDate: string) {
  const anchor = new Date(dateValue(anchorDate));
  const mondayOffset = (anchor.getUTCDay() + 6) % 7;
  const startDate = addInsightsDays(anchorDate, -mondayOffset);
  return { startDate, endDate: addInsightsDays(startDate, 6) };
}

export function resolveInsightsDateRange(
  input: {
    preset?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  },
  now = new Date()
): InsightsDateRange {
  const preset: InsightsRangePreset = input.preset === "week" || input.preset === "custom"
    ? input.preset
    : input.preset === "month" || !input.preset
      ? "month"
      : (() => { throw new InsightsRangeError("INVALID_INSIGHTS_RANGE"); })();
  const today = getTodayEntryDate(now);
  const resolved = preset === "week"
    ? weekRange(today)
    : preset === "month"
      ? monthRange(today)
      : {
          startDate: input.startDate ?? "",
          endDate: input.endDate ?? ""
        };

  assertDate(resolved.startDate);
  assertDate(resolved.endDate);
  const dayCount = Math.floor((dateValue(resolved.endDate) - dateValue(resolved.startDate)) / DAY_MS) + 1;
  if (dayCount < 1 || dayCount > MAX_INSIGHTS_RANGE_DAYS) {
    throw new InsightsRangeError("INVALID_INSIGHTS_RANGE");
  }

  return {
    preset,
    ...resolved,
    timeZone: "Asia/Shanghai",
    weekStartsOn: "monday"
  };
}

export function resolveRecentInsightsMonths(now = new Date(), count = 6) {
  const today = getTodayEntryDate(now);
  const [year, month] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year!, month! - 1 - (count - index - 1), 1, 12));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export function monthEnd(month: string) {
  return monthRange(`${month}-01`).endDate;
}

export function normalizeEntryDate(value: Date) {
  return formatEntryDate(value);
}
