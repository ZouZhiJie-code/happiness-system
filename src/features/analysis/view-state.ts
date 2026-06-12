import { getTodayEntryDate } from "@/features/interview/entry-date";

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

export function buildAnalysisHref(input: { month: string; section?: AnalysisSectionKey }) {
  const section = input.section ?? "trends";
  return `/analysis?month=${input.month}&section=${section}`;
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
  today?: string;
}) {
  const today = input.today ?? getTodayAnalysisMonth();
  const shouldReplaceMonth = !input.month || !isValidAnalysisMonth(input.month);
  const shouldReplaceSection = !isCanonicalAnalysisSection(input.section);
  const month = normalizeAnalysisMonth(input.month, today);
  const section = normalizeAnalysisSection(input.section);
  const href = buildAnalysisHref({ month, section });

  return {
    month,
    section,
    href,
    shouldReplace: shouldReplaceMonth || shouldReplaceSection || input.section !== section
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
