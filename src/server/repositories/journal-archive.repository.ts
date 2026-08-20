import { getEntryDateRangeBounds, formatEntryDate, parseEntryDateInput } from "@/features/interview/entry-date";
import { prisma } from "@/server/db/prisma";
import { getJournalDailyJournalView } from "@/server/repositories/journal-daily-entry.repository";
import {
  getJournalPeriodReportView,
  resolveJournalPeriodRange
} from "@/server/repositories/journal-period-report.repository";
import type {
  JournalArchiveIndexItem,
  JournalArchiveIndexView,
  JournalArchiveKind
} from "@/types/journal-archive";

const MAX_ARCHIVE_SCAN = 240;

type DayEvidence = {
  date: string;
  title: string | null;
  priority: number;
};

function monthBounds(date: string) {
  const monthStart = `${date.slice(0, 7)}-01`;
  const [year, month] = monthStart.split("-").map(Number);
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(
    new Date(Date.UTC(year!, month!, 0, 12)).getUTCDate()
  ).padStart(2, "0")}`;
  return getEntryDateRangeBounds(monthStart, monthEnd);
}

async function listDayEvidence(input: {
  userId: string;
  startAt?: Date;
  endExclusive?: Date;
  take?: number;
}) {
  const dateFilter = input.startAt && input.endExclusive
    ? { gte: input.startAt, lt: input.endExclusive }
    : undefined;
  const take = input.take ?? MAX_ARCHIVE_SCAN;
  const [eventCards, dailyEntries, legacyDailyEntries, legacyDimensionEntries] = await Promise.all([
    prisma.journalEventEntry.findMany({
      where: {
        event: {
          userId: input.userId,
          status: { not: "abandoned" },
          ...(dateFilter ? { entryDate: dateFilter } : {})
        }
      },
      select: { title: true, event: { select: { entryDate: true } } },
      orderBy: [{ event: { entryDate: "desc" } }, { updatedAt: "desc" }],
      take
    }),
    prisma.journalDailyEntry.findMany({
      where: { userId: input.userId, ...(dateFilter ? { entryDate: dateFilter } : {}) },
      select: { entryDate: true, title: true },
      orderBy: [{ entryDate: "desc" }, { updatedAt: "desc" }],
      take
    }),
    prisma.dailyJournalEntry.findMany({
      where: {
        userId: input.userId,
        status: "saved",
        ...(dateFilter ? { date: dateFilter } : {})
      },
      select: { date: true, title: true },
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
      take
    }),
    prisma.joyEntry.findMany({
      where: {
        userId: input.userId,
        status: "saved",
        ...(dateFilter ? { date: dateFilter } : {}),
        session: { mode: "dimension_legacy", dimension: { not: null } }
      },
      select: { date: true, title: true },
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
      take
    })
  ]);
  const evidence: DayEvidence[] = [];
  eventCards.forEach((entry) => evidence.push({
    date: formatEntryDate(entry.event.entryDate),
    title: entry.title,
    priority: 1
  }));
  legacyDimensionEntries.forEach((entry) => evidence.push({
    date: formatEntryDate(entry.date),
    title: entry.title,
    priority: 2
  }));
  legacyDailyEntries.forEach((entry) => evidence.push({
    date: formatEntryDate(entry.date),
    title: entry.title,
    priority: 3
  }));
  dailyEntries.forEach((entry) => evidence.push({
    date: formatEntryDate(entry.entryDate),
    title: entry.title,
    priority: 4
  }));
  return evidence;
}

function groupDayEvidence(evidence: DayEvidence[]) {
  const grouped = new Map<string, { count: number; title: string | null; priority: number }>();
  for (const item of evidence) {
    const current = grouped.get(item.date);
    grouped.set(item.date, {
      count: (current?.count ?? 0) + 1,
      title: !current || item.priority >= current.priority ? item.title : current.title,
      priority: Math.max(current?.priority ?? 0, item.priority)
    });
  }
  return grouped;
}

function retainSelected<T extends { startDate: string }>(
  items: T[],
  selectedStart: string,
  limit: number
) {
  const selected = items.find((item) => item.startDate === selectedStart);
  const limited = items.slice(0, limit);
  if (!selected || limited.some((item) => item.startDate === selectedStart)) return limited;
  return [...limited.slice(0, Math.max(0, limit - 1)), selected];
}

async function readDayArchive(userId: string, date: string, limit: number): Promise<JournalArchiveIndexView> {
  const recentEvidence = await listDayEvidence({ userId });
  const { startAt, endExclusive } = monthBounds(date);
  const monthEvidence = await listDayEvidence({ userId, startAt, endExclusive, take: 200 });
  const recent = groupDayEvidence(recentEvidence);
  const selectedEvidence = groupDayEvidence(monthEvidence).get(date);
  if (selectedEvidence && !recent.has(date)) recent.set(date, selectedEvidence);
  const dates = [...recent.keys()].sort((left, right) => right.localeCompare(left));
  const projected = await Promise.all(dates.slice(0, Math.max(limit + 1, 20)).map(async (entryDate) => {
    const view = await getJournalDailyJournalView(userId, entryDate);
    const evidence = recent.get(entryDate)!;
    return {
      key: entryDate,
      kind: "day" as const,
      startDate: entryDate,
      endDate: entryDate,
      title: view.entry?.title ?? evidence.title,
      recordCount: Math.max(view.savedSources.length + view.legacyHistory.length, evidence.count),
      displayStatus: view.displayStatus
    } satisfies JournalArchiveIndexItem;
  }));
  const items = retainSelected(projected, date, limit);
  return {
    kind: "day",
    selectedKey: date,
    items,
    monthDates: [...new Set(monthEvidence.map((item) => item.date))].sort()
  };
}

async function listPeriodCandidateDates(userId: string) {
  const [eventCards, dailyEntries, legacyDailyEntries] = await Promise.all([
    prisma.journalEventEntry.findMany({
      where: { event: { userId, status: { not: "abandoned" } } },
      select: { event: { select: { entryDate: true } } },
      orderBy: [{ event: { entryDate: "desc" } }, { updatedAt: "desc" }],
      take: MAX_ARCHIVE_SCAN
    }),
    prisma.journalDailyEntry.findMany({
      where: { userId, status: "saved" },
      select: { entryDate: true },
      orderBy: [{ entryDate: "desc" }, { updatedAt: "desc" }],
      take: MAX_ARCHIVE_SCAN
    }),
    prisma.dailyJournalEntry.findMany({
      where: { userId, status: "saved" },
      select: { date: true },
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
      take: MAX_ARCHIVE_SCAN
    })
  ]);
  return [
    ...eventCards.map((entry) => formatEntryDate(entry.event.entryDate)),
    ...dailyEntries.map((entry) => formatEntryDate(entry.entryDate)),
    ...legacyDailyEntries.map((entry) => formatEntryDate(entry.date))
  ];
}

async function readPeriodArchive(
  userId: string,
  kind: Extract<JournalArchiveKind, "week" | "month">,
  date: string,
  limit: number
): Promise<JournalArchiveIndexView> {
  const [candidateDates, reports] = await Promise.all([
    listPeriodCandidateDates(userId),
    prisma.journalPeriodReport.findMany({
      where: { userId, periodKind: kind },
      select: { periodStart: true },
      orderBy: [{ periodStart: "desc" }, { updatedAt: "desc" }],
      take: Math.max(limit * 2, 24)
    })
  ]);
  const selected = resolveJournalPeriodRange(kind, date);
  const starts = new Set<string>([
    selected.startDate,
    ...candidateDates.map((candidate) => resolveJournalPeriodRange(kind, candidate).startDate),
    ...reports.map((report) => formatEntryDate(report.periodStart))
  ]);
  const projected = await Promise.all([...starts]
    .sort((left, right) => right.localeCompare(left))
    .slice(0, Math.max(limit + 1, 20))
    .map(async (startDate) => {
      const view = await getJournalPeriodReportView(userId, kind, startDate);
      if (!view.report && view.materials.length === 0) return null;
      return {
        key: startDate,
        kind,
        startDate: view.period.startDate,
        endDate: view.period.endDate,
        title: view.report?.title ?? null,
        recordCount: view.materials.length,
        displayStatus: view.displayStatus
      } satisfies JournalArchiveIndexItem;
    }));
  const available = projected.filter(
    (item): item is Exclude<(typeof projected)[number], null> => item !== null
  );
  const items: JournalArchiveIndexItem[] = retainSelected(available, selected.startDate, limit);
  return { kind, selectedKey: selected.startDate, items, monthDates: [] };
}

export async function getJournalArchiveIndex(input: {
  userId: string;
  kind: JournalArchiveKind;
  date: string;
  limit?: number;
}): Promise<JournalArchiveIndexView> {
  parseEntryDateInput(input.date);
  const limit = Math.min(30, Math.max(1, input.limit ?? 12));
  if (input.kind === "day") return readDayArchive(input.userId, input.date, limit);
  return readPeriodArchive(input.userId, input.kind, input.date, limit);
}
