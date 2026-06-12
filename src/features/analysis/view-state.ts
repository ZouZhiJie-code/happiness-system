import {
  addEntryDays,
  buildEntryDateRange,
  formatAnalysisDateRangeLabel,
  getMonthDateRangeForAnalysis,
  getWeekDateRange,
  normalizeAnalysisRangePreset,
  shiftWeekDateRange,
  type AnalysisRangePreset
} from "@/features/analysis/date-range";
import { getTodayEntryDate, isEntryDateString } from "@/features/interview/entry-date";

const ANALYSIS_MONTH_PATTERN = /^\d{4}-\d{2}$/;
export const ANALYSIS_SECTION_KEYS = ["trends", "dimensions", "correlation", "review"] as const;
export type AnalysisSectionKey = (typeof ANALYSIS_SECTION_KEYS)[number];

const LEGACY_ANALYSIS_SECTION_MAP: Record<string, AnalysisSectionKey> = {
  overview: "trends",
  score: "trends",
  rhythm: "trends",
  insights: "dimensions"
};

function parseMonthKey(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1));
}

function formatMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isValidAnalysisMonth(month: string) {
  if (!ANALYSIS_MONTH_PATTERN.test(month)) {
    return false;
  }

  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return false;
  }

  return formatMonthKey(parseMonthKey(month)) === month;
}

function isCanonicalAnalysisSection(section: string | null | undefined): section is AnalysisSectionKey {
  return !!section && ANALYSIS_SECTION_KEYS.includes(section as AnalysisSectionKey);
}

export function getTodayAnalysisMonth(today = getTodayEntryDate()) {
  return today.slice(0, 7);
}

export function normalizeAnalysisMonth(month: string | null | undefined, today = getTodayAnalysisMonth()) {
  if (!month || !isValidAnalysisMonth(month)) {
    return today;
  }

  return month;
}

export function normalizeAnalysisSection(section: string | null | undefined): AnalysisSectionKey {
  if (isCanonicalAnalysisSection(section)) {
    return section;
  }

  if (section && section in LEGACY_ANALYSIS_SECTION_MAP) {
    return LEGACY_ANALYSIS_SECTION_MAP[section];
  }

  return "trends";
}

export function getAnalysisSectionElementId(section: AnalysisSectionKey) {
  return `analysis-${section}`;
}

export function resolveAnalysisTrendsRange(input: {
  preset?: AnalysisRangePreset;
  month: string;
  startDate?: string | null;
  endDate?: string | null;
  today?: string;
}) {
  const today = input.today ?? getTodayEntryDate();
  const preset = input.preset ?? "month";

  if (preset === "week") {
    if (
      input.startDate &&
      input.endDate &&
      isEntryDateString(input.startDate) &&
      isEntryDateString(input.endDate) &&
      input.startDate <= input.endDate
    ) {
      return {
        startDate: input.startDate,
        endDate: input.endDate
      };
    }

    return getWeekDateRange(today);
  }

  if (preset === "custom" && input.startDate && input.endDate && isEntryDateString(input.startDate) && isEntryDateString(input.endDate) && input.startDate <= input.endDate) {
    return {
      startDate: input.startDate,
      endDate: input.endDate
    };
  }

  return getMonthDateRangeForAnalysis(input.month, today);
}

export function buildAnalysisHref(input: {
  month: string;
  section?: AnalysisSectionKey;
  preset?: AnalysisRangePreset;
  startDate?: string;
  endDate?: string;
}) {
  const section = input.section ?? "trends";
  const preset = input.preset ?? "month";
  const params = new URLSearchParams({
    month: input.month,
    section
  });

  if (preset !== "month") {
    params.set("preset", preset);
  }

  if ((preset === "custom" || preset === "week") && input.startDate && input.endDate) {
    params.set("start", input.startDate);
    params.set("end", input.endDate);
  }

  return `/analysis?${params.toString()}`;
}

export function replaceAnalysisHistoryState(href: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.history.replaceState(null, "", href);
}

export function normalizeAnalysisSearchParams(input: {
  month?: string | null;
  section?: string | null;
  preset?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  /** @deprecated use todayEntryDate */
  today?: string;
  todayEntryDate?: string;
}) {
  const todayEntryDate = input.todayEntryDate ?? getTodayEntryDate();
  const todayMonth = input.today && /^\d{4}-\d{2}$/.test(input.today) ? input.today : getTodayAnalysisMonth(todayEntryDate);
  const shouldReplaceMonth = !input.month || !isValidAnalysisMonth(input.month);
  const shouldReplaceSection = !isCanonicalAnalysisSection(input.section);
  const month = normalizeAnalysisMonth(input.month, todayMonth);
  const section = normalizeAnalysisSection(input.section);
  const preset = normalizeAnalysisRangePreset(input.preset);
  const resolvedRange = resolveAnalysisTrendsRange({
    preset,
    month,
    startDate: input.startDate,
    endDate: input.endDate,
    today: todayEntryDate
  });
  const shouldReplacePreset = input.preset !== preset && input.preset != null;
  const shouldReplaceCustomRange =
    preset === "custom" &&
    (input.startDate !== resolvedRange.startDate ||
      input.endDate !== resolvedRange.endDate ||
      !input.startDate ||
      !input.endDate ||
      !isEntryDateString(input.startDate ?? "") ||
      !isEntryDateString(input.endDate ?? "") ||
      (input.startDate ?? "") > (input.endDate ?? ""));
  const shouldReplaceWeekRange =
    preset === "week" &&
    (input.startDate !== resolvedRange.startDate ||
      input.endDate !== resolvedRange.endDate ||
      !input.startDate ||
      !input.endDate);
  const href = buildAnalysisHref({
    month,
    section,
    preset,
    startDate: preset !== "month" ? resolvedRange.startDate : undefined,
    endDate: preset !== "month" ? resolvedRange.endDate : undefined
  });

  return {
    month,
    section,
    preset,
    startDate: resolvedRange.startDate,
    endDate: resolvedRange.endDate,
    rangeLabel: formatAnalysisDateRangeLabel(resolvedRange.startDate, resolvedRange.endDate),
    href,
    shouldReplace:
      shouldReplaceMonth ||
      shouldReplaceSection ||
      shouldReplacePreset ||
      shouldReplaceCustomRange ||
      shouldReplaceWeekRange ||
      input.section !== section ||
      (preset === "month" && input.preset != null && input.preset !== "month")
  };
}

export function shiftAnalysisTrendsRange(input: {
  preset: AnalysisRangePreset;
  month: string;
  startDate: string;
  endDate: string;
  offset: -1 | 1;
}) {
  if (input.preset === "month") {
    return {
      month: shiftAnalysisMonth(input.month, input.offset),
      preset: "month" as const
    };
  }

  if (input.preset === "week") {
    const nextRange = shiftWeekDateRange(input.startDate, input.offset);
    return {
      month: nextRange.startDate.slice(0, 7),
      preset: "week" as const,
      startDate: nextRange.startDate,
      endDate: nextRange.endDate
    };
  }

  const spanDays = buildEntryDateRange(input.startDate, input.endDate).length;
  const shiftedStart = addEntryDays(input.startDate, input.offset * spanDays);
  const shiftedEnd = addEntryDays(input.endDate, input.offset * spanDays);

  return {
    month: shiftedStart.slice(0, 7),
    preset: "custom" as const,
    startDate: shiftedStart,
    endDate: shiftedEnd
  };
}

export function shiftAnalysisMonth(month: string, offset: number) {
  const current = parseMonthKey(month);
  current.setUTCMonth(current.getUTCMonth() + offset);
  return formatMonthKey(current);
}

export function formatAnalysisMonthLabel(month: string) {
  const parsed = parseMonthKey(month);

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long"
  }).format(parsed);
}
