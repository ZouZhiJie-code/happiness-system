import { getEntryDateRangeBounds } from "@/features/interview/entry-date";
import { buildJournalDailySourceSignature } from "@/features/journal-daily/source-signature";
import { prisma } from "@/server/db/prisma";
import { getJournalPeriodReportViewForRange } from "@/server/repositories/journal-period-report.repository";
import { normalizeEntryDate } from "@/server/services/insights/date-range";
import type { JournalDailyEntryStatus } from "@/types/journal-daily-entry";
import type { InsightsJournalDisplayStatus } from "@/types/insights";
import type { JournalPeriodKind } from "@/types/journal-period-report";

export interface InsightsRangeRecordRow {
  id: string;
  entryDate: string;
  title: string;
}

export interface InsightsRangeDailyJournalRow {
  id: string;
  entryDate: string;
  title: string;
  status: InsightsJournalDisplayStatus;
}

export interface InsightsRangePeriodReportRow {
  id: string;
  kind: JournalPeriodKind;
  startDate: string;
  endDate: string;
  title: string;
  status: InsightsJournalDisplayStatus;
}

export interface InsightsRangeRows {
  records: InsightsRangeRecordRow[];
  dailyJournals: InsightsRangeDailyJournalRow[];
  periodReports: InsightsRangePeriodReportRow[];
}

export interface InsightsSelfRows {
  firstRecord: InsightsRangeRecordRow | null;
  recentRecords: InsightsRangeRecordRow[];
  completedRecordCount: number;
  recordedDates: string[];
  recentMonthRecords: InsightsRangeRecordRow[];
  recentMonthDailyJournals: InsightsRangeDailyJournalRow[];
}

function recordWhere(userId: string, startAt?: Date, endExclusive?: Date) {
  return {
    event: {
      userId,
      status: { not: "abandoned" as const },
      ...(startAt && endExclusive ? { entryDate: { gte: startAt, lt: endExclusive } } : {})
    }
  };
}

function mapRecord(entry: {
  id: string;
  title: string;
  event: { entryDate: Date };
}): InsightsRangeRecordRow {
  return {
    id: entry.id,
    entryDate: normalizeEntryDate(entry.event.entryDate),
    title: entry.title
  };
}

function mapDailyJournal(entry: {
  id: string;
  entryDate: Date;
  title: string;
  status: JournalDailyEntryStatus;
  sourceSignature?: string;
  displayStatus?: InsightsJournalDisplayStatus;
}): InsightsRangeDailyJournalRow {
  return {
    id: entry.id,
    entryDate: normalizeEntryDate(entry.entryDate),
    title: entry.title,
    status: entry.displayStatus ?? (entry.status === "saved" ? "saved" : "draft")
  };
}

export async function listInsightsRangeRows(input: {
  userId: string;
  startDate: string;
  endDate: string;
}): Promise<InsightsRangeRows> {
  const { startAt, endExclusive } = getEntryDateRangeBounds(input.startDate, input.endDate);
  const [records, dailyJournals, periodReports, dailyGenerations] = await Promise.all([
    prisma.journalEventEntry.findMany({
      where: recordWhere(input.userId, startAt, endExclusive),
      select: {
        id: true,
        title: true,
        contentRevision: true,
        event: { select: { entryDate: true, daySequence: true } }
      },
      orderBy: [{ event: { entryDate: "asc" } }, { createdAt: "asc" }]
    }),
    prisma.journalDailyEntry.findMany({
      where: { userId: input.userId, entryDate: { gte: startAt, lt: endExclusive } },
      select: {
        id: true,
        entryDate: true,
        title: true,
        status: true,
        sourceSignature: true
      },
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }]
    }),
    prisma.journalPeriodReport.findMany({
      where: {
        userId: input.userId,
        periodStart: { lt: endExclusive },
        periodEnd: { gte: startAt }
      },
      select: {
        id: true,
        periodKind: true,
        periodStart: true,
        periodEnd: true,
        title: true,
        status: true
      },
      orderBy: [{ periodStart: "desc" }, { updatedAt: "desc" }]
    }),
    prisma.journalDailyEntryGeneration.findMany({
      where: { userId: input.userId, entryDate: { gte: startAt, lt: endExclusive } },
      select: { entryDate: true, status: true, kind: true, createdAt: true, id: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    })
  ]);

  const periodProjections = await Promise.all(periodReports.map(async (report) => ({
    key: `${report.periodKind}:${normalizeEntryDate(report.periodStart)}`,
    view: await getJournalPeriodReportViewForRange(input.userId, {
      kind: report.periodKind,
      startDate: normalizeEntryDate(report.periodStart),
      endDate: normalizeEntryDate(report.periodEnd)
    })
  })));

  const signaturesByDate = new Map<string, Array<{
    entryId: string;
    daySequence: number;
    contentRevision: number;
  }>>();
  records.forEach((record) => {
    const date = normalizeEntryDate(record.event.entryDate);
    signaturesByDate.set(date, [
      ...(signaturesByDate.get(date) ?? []),
      {
        entryId: record.id,
        daySequence: record.event.daySequence,
        contentRevision: record.contentRevision
      }
    ]);
  });
  const latestGenerationByDate = new Map<string, (typeof dailyGenerations)[number]>();
  dailyGenerations.forEach((generation) => {
    const date = normalizeEntryDate(generation.entryDate);
    if (!latestGenerationByDate.has(date)) latestGenerationByDate.set(date, generation);
  });
  const periodProjectionByKey = new Map(periodProjections.map((projection) => [projection.key, projection.view] as const));

  return {
    records: records.map(mapRecord),
    dailyJournals: dailyJournals.map((journal) => {
      const date = normalizeEntryDate(journal.entryDate);
      const latestGeneration = latestGenerationByDate.get(date);
      const currentSignature = buildJournalDailySourceSignature(signaturesByDate.get(date) ?? []);
      const displayStatus: InsightsJournalDisplayStatus = latestGeneration?.status === "processing"
        ? "generating"
        : latestGeneration?.status === "failed" && latestGeneration.kind === "update"
          ? "update_failed"
          : journal.sourceSignature !== currentSignature
            ? "stale"
            : journal.status === "saved"
              ? "saved"
              : "draft";
      return mapDailyJournal({ ...journal, displayStatus });
    }),
    periodReports: periodReports.map((report) => {
      const startDate = normalizeEntryDate(report.periodStart);
      const projectedStatus = periodProjectionByKey.get(`${report.periodKind}:${startDate}`)?.displayStatus;
      const status: InsightsJournalDisplayStatus = projectedStatus === "generating"
        || projectedStatus === "update_failed"
        || projectedStatus === "stale"
        || projectedStatus === "saved"
        || projectedStatus === "draft"
        ? projectedStatus
        : report.status === "saved"
          ? "saved"
          : "draft";
      return {
        id: report.id,
        kind: report.periodKind,
        startDate,
        endDate: normalizeEntryDate(report.periodEnd),
        title: report.title,
        status
      };
    })
  };
}

export async function readInsightsSelfRows(input: {
  userId: string;
  recentMonthsStartDate: string;
  recentMonthsEndDate: string;
  recentLimit?: number;
}): Promise<InsightsSelfRows> {
  const { startAt, endExclusive } = getEntryDateRangeBounds(
    input.recentMonthsStartDate,
    input.recentMonthsEndDate
  );
  const where = recordWhere(input.userId);
  const recentWhere = recordWhere(input.userId, startAt, endExclusive);
  const [firstRecord, recentRecords, completedRecordCount, recordedDates, recentMonthRecords, recentMonthDailyJournals] = await Promise.all([
    prisma.journalEventEntry.findFirst({
      where,
      select: { id: true, title: true, event: { select: { entryDate: true } } },
      orderBy: [{ event: { entryDate: "asc" } }, { createdAt: "asc" }]
    }),
    prisma.journalEventEntry.findMany({
      where,
      select: { id: true, title: true, event: { select: { entryDate: true } } },
      orderBy: [{ event: { entryDate: "desc" } }, { updatedAt: "desc" }],
      take: input.recentLimit ?? 6
    }),
    prisma.journalEventEntry.count({ where }),
    prisma.journalEvent.findMany({
      where: {
        userId: input.userId,
        status: { not: "abandoned" },
        entry: { isNot: null }
      },
      select: { entryDate: true },
      distinct: ["entryDate"],
      orderBy: { entryDate: "asc" }
    }),
    prisma.journalEventEntry.findMany({
      where: recentWhere,
      select: { id: true, title: true, event: { select: { entryDate: true } } },
      orderBy: [{ event: { entryDate: "asc" } }, { createdAt: "asc" }]
    }),
    prisma.journalDailyEntry.findMany({
      where: { userId: input.userId, entryDate: { gte: startAt, lt: endExclusive } },
      select: { id: true, entryDate: true, title: true, status: true },
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }]
    })
  ]);

  return {
    firstRecord: firstRecord ? mapRecord(firstRecord) : null,
    recentRecords: recentRecords.map(mapRecord),
    completedRecordCount,
    recordedDates: recordedDates.map((entry) => normalizeEntryDate(entry.entryDate)),
    recentMonthRecords: recentMonthRecords.map(mapRecord),
    recentMonthDailyJournals: recentMonthDailyJournals.map(mapDailyJournal)
  };
}
