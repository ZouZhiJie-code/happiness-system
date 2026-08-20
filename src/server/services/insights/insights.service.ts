import {
  listInsightsRangeRows,
  readInsightsSelfRows
} from "@/server/repositories/insights.repository";
import {
  enumerateInsightsDates,
  monthEnd,
  resolveInsightsDateRange,
  resolveRecentInsightsMonths
} from "@/server/services/insights/date-range";
import type {
  InsightsRangePreset,
  InsightsSelfView,
  InsightsTrendsView
} from "@/types/insights";

function journalHref(view: "day" | "week" | "month", date: string) {
  return `/calendar?view=${view}&date=${encodeURIComponent(date)}`;
}

export async function getInsightsTrends(
  userId: string,
  query: {
    preset?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  },
  now = new Date()
): Promise<InsightsTrendsView> {
  const range = resolveInsightsDateRange(query, now);
  const rows = await listInsightsRangeRows({
    userId,
    startDate: range.startDate,
    endDate: range.endDate
  });
  const recordsByDate = new Map<string, number>();
  rows.records.forEach((record) => {
    recordsByDate.set(record.entryDate, (recordsByDate.get(record.entryDate) ?? 0) + 1);
  });
  const dailyJournalByDate = new Map(rows.dailyJournals.map((journal) => [journal.entryDate, journal]));
  const dailyActivity = enumerateInsightsDates(range.startDate, range.endDate).map((date) => {
    const journal = dailyJournalByDate.get(date);
    return {
      date,
      recordCount: recordsByDate.get(date) ?? 0,
      journal: journal
        ? {
            id: journal.id,
            title: journal.title,
            status: journal.status,
            href: journalHref("day", date)
          }
        : null
    };
  });

  return {
    range,
    summary: {
      recordedDayCount: recordsByDate.size,
      completedRecordCount: rows.records.length,
      dailyJournalCount: rows.dailyJournals.length,
      weeklyJournalCount: rows.periodReports.filter((report) => report.kind === "week").length,
      monthlyJournalCount: rows.periodReports.filter((report) => report.kind === "month").length
    },
    dailyActivity,
    periodReports: rows.periodReports.map((report) => ({
      id: report.id,
      kind: report.kind,
      startDate: report.startDate,
      endDate: report.endDate,
      title: report.title,
      status: report.status,
      href: journalHref(report.kind, report.startDate)
    })),
    legacyDimensionRecordsIncluded: false,
    happinessScoresIncluded: false
  };
}

export async function getInsightsSelf(userId: string, now = new Date()): Promise<InsightsSelfView> {
  const months = resolveRecentInsightsMonths(now, 6);
  const firstMonth = months[0]!;
  const lastMonth = months.at(-1)!;
  const rows = await readInsightsSelfRows({
    userId,
    recentMonthsStartDate: `${firstMonth}-01`,
    recentMonthsEndDate: monthEnd(lastMonth),
    recentLimit: 6
  });
  const recordsByMonth = new Map<string, { count: number; dates: Set<string> }>();
  const journalsByMonth = new Map<string, number>();
  rows.recentMonthRecords.forEach((record) => {
    const month = record.entryDate.slice(0, 7);
    const current = recordsByMonth.get(month) ?? { count: 0, dates: new Set<string>() };
    current.count += 1;
    current.dates.add(record.entryDate);
    recordsByMonth.set(month, current);
  });
  rows.recentMonthDailyJournals.forEach((journal) => {
    const month = journal.entryDate.slice(0, 7);
    journalsByMonth.set(month, (journalsByMonth.get(month) ?? 0) + 1);
  });
  const firstDate = rows.firstRecord?.entryDate ?? null;
  const latestDate = rows.recentRecords[0]?.entryDate ?? null;
  const recordingSpanDays = firstDate && latestDate
    ? enumerateInsightsDates(firstDate, latestDate).length
    : 0;

  return {
    title: "记录中的我",
    firstRecordedDate: rows.firstRecord?.entryDate ?? null,
    latestRecordedDate: rows.recentRecords[0]?.entryDate ?? null,
    recordedDayCount: rows.recordedDates.length,
    completedRecordCount: rows.completedRecordCount,
    recordingSpanDays,
    recentRecords: rows.recentRecords.map((record) => ({
      id: record.id,
      entryDate: record.entryDate,
      title: record.title,
      href: journalHref("day", record.entryDate)
    })),
    monthlyChanges: months.map((month) => ({
      month,
      recordCount: recordsByMonth.get(month)?.count ?? 0,
      recordedDayCount: recordsByMonth.get(month)?.dates.size ?? 0,
      dailyJournalCount: journalsByMonth.get(month) ?? 0,
      href: journalHref("month", `${month}-01`)
    })),
    memoryAvailability: "coming_soon",
    legacyDimensionRecordsIncluded: false
  };
}

export function normalizeInsightsPreset(value: string | null | undefined): InsightsRangePreset {
  return value === "week" || value === "custom" ? value : "month";
}
