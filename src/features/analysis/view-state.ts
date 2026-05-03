import { getTodayEntryDate } from "@/features/interview/entry-date";

const ANALYSIS_MONTH_PATTERN = /^\d{4}-\d{2}$/;
const ANALYSIS_SECTION_KEYS = ["score", "rhythm", "insights"] as const;
export type AnalysisSectionKey = (typeof ANALYSIS_SECTION_KEYS)[number];

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

export function getTodayAnalysisMonth(today = getTodayEntryDate()) {
  return today.slice(0, 7);
}

export function normalizeAnalysisMonth(month: string | null | undefined, today = getTodayAnalysisMonth()) {
  if (!month || !isValidAnalysisMonth(month)) {
    return today;
  }

  return month;
}

export function normalizeAnalysisSection(section: string | null | undefined) {
  return ANALYSIS_SECTION_KEYS.includes(section as AnalysisSectionKey) ? (section as AnalysisSectionKey) : "score";
}

export function hasExplicitAnalysisSection(section: string | null | undefined): section is AnalysisSectionKey {
  return ANALYSIS_SECTION_KEYS.includes(section as AnalysisSectionKey);
}

export function buildAnalysisHref(input: { month: string; section?: AnalysisSectionKey }) {
  const section = input.section ?? "score";
  return `/analysis?month=${input.month}&section=${section}`;
}

export function normalizeAnalysisSearchParams(input: {
  month?: string | null;
  section?: string | null;
  today?: string;
}) {
  const today = input.today ?? getTodayAnalysisMonth();
  const shouldReplaceMonth = !input.month || !isValidAnalysisMonth(input.month);
  const month = normalizeAnalysisMonth(input.month, today);
  const section = normalizeAnalysisSection(input.section);
  const hasExplicitSection = hasExplicitAnalysisSection(input.section);

  return {
    month,
    section,
    hasExplicitSection,
    href: buildAnalysisHref({ month, section }),
    shouldReplace: shouldReplaceMonth
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
