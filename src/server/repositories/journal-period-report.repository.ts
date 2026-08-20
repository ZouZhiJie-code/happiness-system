import { Prisma } from "@prisma/client";

import { MAX_JOURNAL_TITLE_LENGTH } from "@/features/interview/journal-title";
import {
  formatEntryDate,
  getEntryDateRangeBounds,
  parseEntryDateInput
} from "@/features/interview/entry-date";
import { prisma } from "@/server/db/prisma";
import type {
  CommitJournalPeriodReportInput,
  JournalPeriodMaterial,
  JournalPeriodParagraphDocument,
  JournalPeriodPrimaryAction,
  JournalPeriodRange,
  JournalPeriodReportFreshness,
  JournalPeriodReportGenerationRecord,
  JournalPeriodReportRecord,
  JournalPeriodReportRevisionRecord,
  JournalPeriodReportView,
  JournalPeriodSourceSnapshot,
  ReserveJournalPeriodReportGenerationInput,
  SaveJournalPeriodReportInput,
  SettleJournalPeriodReportGenerationInput,
  UpdateJournalPeriodReportInput
} from "@/types/journal-period-report";

type PeriodDatabaseClient = Pick<
  Prisma.TransactionClient,
  | "journalDailyEntry"
  | "dailyJournalEntry"
  | "journalEventEntry"
  | "journalPeriodReport"
  | "journalPeriodReportRevision"
  | "journalPeriodReportGeneration"
>;
type StoredReport = Prisma.JournalPeriodReportGetPayload<Record<never, never>>;
type StoredRevision = Prisma.JournalPeriodReportRevisionGetPayload<Record<never, never>>;
type StoredGeneration = Prisma.JournalPeriodReportGenerationGetPayload<Record<never, never>>;

const DAY_MS = 24 * 60 * 60 * 1000;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function fromJsonValue<T>(value: Prisma.JsonValue): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function serializeDate(value: Date | null) {
  return value?.toISOString() ?? null;
}

function assertNonEmpty(value: string, code: string) {
  if (!value.trim()) throw new Error(code);
}

function assertContentRevision(value: number, code = "JOURNAL_PERIOD_REPORT_VERSION_INVALID") {
  if (!Number.isInteger(value) || value < 1) throw new Error(code);
}

function assertContent(title: string, content: string) {
  if (!title.trim() || [...title.trim()].length > MAX_JOURNAL_TITLE_LENGTH || !content.trim()) {
    throw new Error("JOURNAL_PERIOD_REPORT_INVALID");
  }
}

function parseDateAtNoon(value: string) {
  parseEntryDateInput(value);
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!, 12));
}

function formatDateAtNoon(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(
    value.getUTCDate()
  ).padStart(2, "0")}`;
}

function addDays(value: string, offset: number) {
  return formatDateAtNoon(new Date(parseDateAtNoon(value).getTime() + offset * DAY_MS));
}

function enumerateDates(startDate: string, endDate: string) {
  const dates: string[] = [];
  for (let current = startDate; current <= endDate; current = addDays(current, 1)) {
    dates.push(current);
  }
  return dates;
}

/** Canonical period boundaries: Asia/Shanghai, Monday through Sunday for weeks. */
export function resolveJournalPeriodRange(
  kind: JournalPeriodRange["kind"],
  anchorDate: string
): JournalPeriodRange {
  const anchor = parseDateAtNoon(anchorDate);
  if (kind === "week") {
    const weekdayMondayZero = (anchor.getUTCDay() + 6) % 7;
    const startDate = formatDateAtNoon(new Date(anchor.getTime() - weekdayMondayZero * DAY_MS));
    return { kind, startDate, endDate: addDays(startDate, 6) };
  }
  const startDate = `${anchor.getUTCFullYear()}-${String(anchor.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const endDate = formatDateAtNoon(
    new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0, 12))
  );
  return { kind, startDate, endDate };
}

function assertRange(range: JournalPeriodRange) {
  const canonical = resolveJournalPeriodRange(range.kind, range.startDate);
  if (canonical.startDate !== range.startDate || canonical.endDate !== range.endDate) {
    throw new Error("JOURNAL_PERIOD_REPORT_INVALID_RANGE");
  }
}

export function buildJournalPeriodSourceSignature(
  period: JournalPeriodRange,
  materials: JournalPeriodMaterial[]
) {
  return [
    "v1",
    `period:${period.kind}:${period.startDate}:${period.endDate}`,
    ...[...materials]
      .sort(
        (left, right) =>
          left.startDate.localeCompare(right.startDate) ||
          left.endDate.localeCompare(right.endDate) ||
          left.kind.localeCompare(right.kind) ||
          left.sourceId.localeCompare(right.sourceId)
      )
      .map(
        (source) =>
          `${source.kind}:${source.sourceId}|revision:${source.contentRevision}|range:${source.startDate}:${source.endDate}|events:${[...source.sourceEventIds].sort().join(",")}`
      )
  ].join("|");
}

function normalizeSourceSnapshot(value: Prisma.JsonValue): JournalPeriodSourceSnapshot {
  const parsed = fromJsonValue<Partial<JournalPeriodSourceSnapshot>>(value);
  if (
    parsed.schemaVersion !== 1 ||
    !parsed.period ||
    (parsed.period.kind !== "week" && parsed.period.kind !== "month") ||
    !Array.isArray(parsed.sources)
  ) {
    throw new Error("JOURNAL_PERIOD_REPORT_SNAPSHOT_INVALID");
  }
  return parsed as JournalPeriodSourceSnapshot;
}

function buildParagraphDocument(content: string, sourceIds: string[]): JournalPeriodParagraphDocument {
  return {
    schemaVersion: 1,
    paragraphs: content
      .split(/\n\s*\n/u)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text) => ({ text, sourceIds: [...sourceIds] }))
  };
}

function normalizeParagraphDocument(
  value: JournalPeriodParagraphDocument | undefined,
  content: string,
  sourceIds: string[],
  options: { allowUnmappedParagraphs?: boolean; requireFullCoverage?: boolean } = {}
): JournalPeriodParagraphDocument {
  const document = value ?? buildParagraphDocument(content, sourceIds);
  const knownIds = new Set(sourceIds);
  if (document.schemaVersion !== 1 || document.paragraphs.length === 0) {
    throw new Error("JOURNAL_PERIOD_REPORT_PARAGRAPHS_INVALID");
  }
  const paragraphs = document.paragraphs.map((paragraph) => {
    const text = paragraph.text.trim();
    const refs = [...new Set(paragraph.sourceIds.map((id) => id.trim()).filter(Boolean))];
    if (!text || (!options.allowUnmappedParagraphs && refs.length === 0) || refs.some((id) => !knownIds.has(id))) {
      throw new Error("JOURNAL_PERIOD_REPORT_PARAGRAPHS_INVALID");
    }
    return { text, sourceIds: refs };
  });
  if (paragraphs.map((paragraph) => paragraph.text).join("\n\n") !== content.trim()) {
    throw new Error("JOURNAL_PERIOD_REPORT_PARAGRAPHS_CONTENT_MISMATCH");
  }
  if (options.requireFullCoverage !== false) {
    const covered = new Set(paragraphs.flatMap((paragraph) => paragraph.sourceIds));
    if (sourceIds.some((id) => !covered.has(id))) throw new Error("JOURNAL_PERIOD_REPORT_SOURCE_OMITTED");
  }
  return { schemaVersion: 1, paragraphs };
}

function normalizeStoredParagraphs(
  value: Prisma.JsonValue,
  content: string,
  sourceIds: string[]
): JournalPeriodParagraphDocument {
  try {
    return normalizeParagraphDocument(fromJsonValue<JournalPeriodParagraphDocument>(value), content, sourceIds, {
      allowUnmappedParagraphs: true,
      requireFullCoverage: false
    });
  } catch {
    return buildParagraphDocument(content, sourceIds);
  }
}

function mapReport(entry: StoredReport | null): JournalPeriodReportRecord | null {
  if (!entry) return null;
  const period: JournalPeriodRange = {
    kind: entry.periodKind,
    startDate: formatEntryDate(entry.periodStart),
    endDate: formatEntryDate(entry.periodEnd)
  };
  return {
    id: entry.id,
    period,
    title: entry.title,
    content: entry.content,
    paragraphs: normalizeStoredParagraphs(entry.paragraphs, entry.content, entry.sourceIds),
    status: entry.status,
    sourceIds: entry.sourceIds,
    sourceSignature: entry.sourceSignature,
    sourceSnapshot: normalizeSourceSnapshot(entry.sourceSnapshot),
    sourceUpdatedAt: serializeDate(entry.sourceUpdatedAt),
    contentRevision: entry.contentRevision,
    savedRevision: entry.savedRevision,
    lastGenerationErrorCode: entry.lastGenerationErrorCode,
    editedAt: serializeDate(entry.editedAt),
    savedAt: serializeDate(entry.savedAt),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

function mapRevision(revision: StoredRevision): JournalPeriodReportRevisionRecord {
  const snapshot = normalizeSourceSnapshot(revision.sourceSnapshot);
  return {
    id: revision.id,
    reportId: revision.reportId,
    kind: revision.kind,
    title: revision.title,
    content: revision.content,
    paragraphs: normalizeStoredParagraphs(
      revision.paragraphs,
      revision.content,
      snapshot.sources.map((source) => source.sourceId)
    ),
    sourceSignature: revision.sourceSignature,
    sourceSnapshot: snapshot,
    contentRevision: revision.contentRevision,
    createdAt: revision.createdAt.toISOString()
  };
}

function mapGeneration(generation: StoredGeneration | null): JournalPeriodReportGenerationRecord | null {
  if (!generation) return null;
  return {
    id: generation.id,
    period: {
      kind: generation.periodKind,
      startDate: formatEntryDate(generation.periodStart),
      endDate: generation.periodKind === "week"
        ? addDays(formatEntryDate(generation.periodStart), 6)
        : resolveJournalPeriodRange("month", formatEntryDate(generation.periodStart)).endDate
    },
    reportId: generation.reportId,
    clientOperationId: generation.clientOperationId,
    kind: generation.kind,
    status: generation.status,
    expectedSourceSignature: generation.expectedSourceSignature,
    expectedContentRevision: generation.expectedContentRevision,
    resultRevisionId: generation.resultRevisionId,
    attemptCount: generation.attemptCount,
    errorCode: generation.errorCode,
    startedAt: generation.startedAt.toISOString(),
    completedAt: serializeDate(generation.completedAt),
    failedAt: serializeDate(generation.failedAt),
    canceledAt: serializeDate(generation.canceledAt),
    createdAt: generation.createdAt.toISOString(),
    updatedAt: generation.updatedAt.toISOString()
  };
}

async function findReportByPeriodWithClient(
  database: Pick<Prisma.TransactionClient, "journalPeriodReport">,
  userId: string,
  period: JournalPeriodRange
) {
  return database.journalPeriodReport.findUnique({
    where: {
      userId_periodKind_periodStart: {
        userId,
        periodKind: period.kind,
        periodStart: parseEntryDateInput(period.startDate)
      }
    }
  });
}

async function findReportForUserWithClient(
  database: Pick<Prisma.TransactionClient, "journalPeriodReport">,
  userId: string,
  reportId: string
) {
  return database.journalPeriodReport.findFirst({ where: { id: reportId, userId } });
}

async function findLatestGenerationWithClient(
  database: Pick<Prisma.TransactionClient, "journalPeriodReportGeneration">,
  userId: string,
  period: JournalPeriodRange
) {
  return database.journalPeriodReportGeneration.findFirst({
    where: {
      userId,
      periodKind: period.kind,
      periodStart: parseEntryDateInput(period.startDate)
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

function materialFromEvent(entry: {
  id: string;
  title: string;
  content: string;
  contentRevision: number;
  updatedAt: Date;
  event: { id: string; entryDate: Date };
}): JournalPeriodMaterial {
  const eventDate = formatEntryDate(entry.event.entryDate);
  return {
    sourceId: `event:${entry.id}`,
    kind: "event_card",
    title: entry.title,
    content: entry.content,
    contentRevision: entry.contentRevision,
    updatedAt: entry.updatedAt.toISOString(),
    startDate: eventDate,
    endDate: eventDate,
    sourceEventIds: [entry.event.id],
    upstreamSourceIds: []
  };
}

function materialFromDaily(entry: {
  id: string;
  entryDate: Date;
  title: string;
  content: string;
  contentRevision: number;
  updatedAt: Date;
  sourceEventIds: string[];
  sourceEntryIds: string[];
}): JournalPeriodMaterial {
  const entryDate = formatEntryDate(entry.entryDate);
  return {
    sourceId: `daily:${entry.id}`,
    kind: "daily_report",
    title: entry.title,
    content: entry.content,
    contentRevision: entry.contentRevision,
    updatedAt: entry.updatedAt.toISOString(),
    startDate: entryDate,
    endDate: entryDate,
    sourceEventIds: [...new Set(entry.sourceEventIds)],
    upstreamSourceIds: entry.sourceEntryIds.map((id) => `event:${id}`)
  };
}

function materialFromLegacyDaily(entry: {
  id: string;
  date: Date;
  title: string;
  content: string;
  updatedAt: Date;
  sourceEntryIds: string[];
}): JournalPeriodMaterial {
  const entryDate = formatEntryDate(entry.date);
  return {
    sourceId: `legacy-daily:${entry.id}`,
    kind: "legacy_daily_report",
    title: entry.title,
    content: entry.content,
    contentRevision: Math.floor(entry.updatedAt.getTime() / 1000),
    updatedAt: entry.updatedAt.toISOString(),
    startDate: entryDate,
    endDate: entryDate,
    sourceEventIds: [],
    upstreamSourceIds: entry.sourceEntryIds.map((id) => `legacy-dimension:${id}`)
  };
}

function materialFromWeekly(entry: {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  title: string;
  content: string;
  contentRevision: number;
  updatedAt: Date;
  sourceSnapshot: Prisma.JsonValue;
}): JournalPeriodMaterial {
  const snapshot = normalizeSourceSnapshot(entry.sourceSnapshot);
  return {
    sourceId: `weekly:${entry.id}`,
    kind: "weekly_report",
    title: entry.title,
    content: entry.content,
    contentRevision: entry.contentRevision,
    updatedAt: entry.updatedAt.toISOString(),
    startDate: formatEntryDate(entry.periodStart),
    endDate: formatEntryDate(entry.periodEnd),
    sourceEventIds: [...new Set(snapshot.sources.flatMap((source) => source.sourceEventIds))],
    upstreamSourceIds: [...new Set(snapshot.sources.map((source) => source.sourceId))]
  };
}

function listDailySignature(sources: Array<{ id: string; contentRevision: number; event: { daySequence: number } }>) {
  return [
    "v2",
    ...[...sources]
      .sort((left, right) => left.event.daySequence - right.event.daySequence || left.id.localeCompare(right.id))
      .map((source) => `record:${source.id}|revision:${source.contentRevision}|seq:${source.event.daySequence}`)
  ].join("|");
}

async function listPeriodMaterialsWithClient(
  database: PeriodDatabaseClient,
  userId: string,
  period: JournalPeriodRange
): Promise<JournalPeriodMaterial[]> {
  const { startAt, endExclusive } = getEntryDateRangeBounds(period.startDate, period.endDate);
  const [dailyEntries, legacyDailyEntries, eventEntries] = await Promise.all([
    database.journalDailyEntry.findMany({
      where: { userId, status: "saved", entryDate: { gte: startAt, lt: endExclusive } },
      select: {
        id: true,
        entryDate: true,
        title: true,
        content: true,
        contentRevision: true,
        updatedAt: true,
        sourceEventIds: true,
        sourceEntryIds: true,
        sourceSignature: true
      },
      orderBy: [{ entryDate: "asc" }, { id: "asc" }]
    }),
    database.dailyJournalEntry.findMany({
      where: { userId, status: "saved", date: { gte: startAt, lt: endExclusive } },
      select: {
        id: true,
        date: true,
        title: true,
        content: true,
        updatedAt: true,
        sourceEntryIds: true
      },
      orderBy: [{ date: "asc" }, { id: "asc" }]
    }),
    database.journalEventEntry.findMany({
      where: {
        event: { userId, status: { not: "abandoned" }, entryDate: { gte: startAt, lt: endExclusive } }
      },
      select: {
        id: true,
        title: true,
        content: true,
        contentRevision: true,
        updatedAt: true,
        event: { select: { id: true, entryDate: true, daySequence: true } }
      },
      orderBy: [{ event: { entryDate: "asc" } }, { event: { daySequence: "asc" } }, { id: "asc" }]
    })
  ]);

  const eventsByDate = new Map<string, typeof eventEntries>();
  for (const eventEntry of eventEntries) {
    const date = formatEntryDate(eventEntry.event.entryDate);
    eventsByDate.set(date, [...(eventsByDate.get(date) ?? []), eventEntry]);
  }
  const validDailyByDate = new Map<string, (typeof dailyEntries)[number]>();
  for (const daily of dailyEntries) {
    const date = formatEntryDate(daily.entryDate);
    const sourceEvents = eventsByDate.get(date) ?? [];
    const currentSignature = listDailySignature(sourceEvents);
    if (sourceEvents.length > 0 && daily.sourceSignature === currentSignature) {
      validDailyByDate.set(date, daily);
    }
  }
  const legacyDailyByDate = new Map(
    legacyDailyEntries.map((entry) => [formatEntryDate(entry.date), entry] as const)
  );

  const weeklyMaterials: JournalPeriodMaterial[] = [];
  const datesCoveredByWeekly = new Set<string>();
  if (period.kind === "month") {
    const weeklyReports = await database.journalPeriodReport.findMany({
      where: {
        userId,
        periodKind: "week",
        status: "saved",
        periodStart: { gte: startAt },
        periodEnd: { lt: endExclusive }
      },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        title: true,
        content: true,
        contentRevision: true,
        updatedAt: true,
        sourceSnapshot: true,
        sourceSignature: true
      },
      orderBy: [{ periodStart: "asc" }, { id: "asc" }]
    });

    for (const weekly of weeklyReports) {
      const weeklyRange: JournalPeriodRange = {
        kind: "week",
        startDate: formatEntryDate(weekly.periodStart),
        endDate: formatEntryDate(weekly.periodEnd)
      };
      const currentWeeklySources = await listPeriodMaterialsWithClient(database, userId, weeklyRange);
      const currentWeeklySignature = buildJournalPeriodSourceSignature(weeklyRange, currentWeeklySources);
      if (weekly.sourceSignature !== currentWeeklySignature) continue;
      weeklyMaterials.push(materialFromWeekly(weekly));
      enumerateDates(weeklyRange.startDate, weeklyRange.endDate).forEach((date) => datesCoveredByWeekly.add(date));
    }
  }

  const result: JournalPeriodMaterial[] = [];
  const sourceIds = new Set<string>();
  const representedEventIds = new Set<string>();
  const add = (material: JournalPeriodMaterial) => {
    if (sourceIds.has(material.sourceId)) return;
    if (material.kind === "event_card" && material.sourceEventIds.some((id) => representedEventIds.has(id))) return;
    sourceIds.add(material.sourceId);
    material.sourceEventIds.forEach((id) => representedEventIds.add(id));
    result.push(material);
  };

  weeklyMaterials.forEach(add);
  for (const date of enumerateDates(period.startDate, period.endDate)) {
    if (datesCoveredByWeekly.has(date)) continue;
    const savedDaily = validDailyByDate.get(date);
    if (savedDaily) {
      add(materialFromDaily(savedDaily));
      continue;
    }
    const legacyDaily = legacyDailyByDate.get(date);
    if (legacyDaily) {
      add(materialFromLegacyDaily(legacyDaily));
      continue;
    }
    (eventsByDate.get(date) ?? []).forEach((eventEntry) => add(materialFromEvent(eventEntry)));
  }

  return result.sort(
    (left, right) =>
      left.startDate.localeCompare(right.startDate) ||
      left.endDate.localeCompare(right.endDate) ||
      left.kind.localeCompare(right.kind) ||
      left.sourceId.localeCompare(right.sourceId)
  );
}

function latestSourceUpdatedAt(materials: JournalPeriodMaterial[]) {
  const latest = materials.reduce<string | null>(
    (current, source) => (!current || source.updatedAt > current ? source.updatedAt : current),
    null
  );
  return latest ? new Date(latest) : null;
}

function buildSnapshot(period: JournalPeriodRange, sources: JournalPeriodMaterial[]): JournalPeriodSourceSnapshot {
  return { schemaVersion: 1, period, sources };
}

function buildStatistics(materials: JournalPeriodMaterial[]) {
  const dates = new Set(materials.flatMap((source) => enumerateDates(source.startDate, source.endDate)));
  return {
    materialCount: materials.length,
    dailyReportCount: materials.filter((source) =>
      source.kind === "daily_report" || source.kind === "legacy_daily_report"
    ).length,
    weeklyReportCount: materials.filter((source) => source.kind === "weekly_report").length,
    eventCardCount: materials.filter((source) => source.kind === "event_card").length,
    coveredDayCount: dates.size
  };
}

function primaryAction(input: {
  period: JournalPeriodRange;
  materials: JournalPeriodMaterial[];
  entry: JournalPeriodReportRecord | null;
  freshness: JournalPeriodReportFreshness;
  latest: JournalPeriodReportGenerationRecord | null;
}): JournalPeriodPrimaryAction {
  const reportName = input.period.kind === "week" ? "周报" : "月报";
  if (input.materials.length === 0) return { kind: "none", label: "暂无可汇总内容" };
  if (input.latest?.status === "failed") return { kind: "retry", label: `重试生成${reportName}` };
  if (!input.entry) return { kind: "generate", label: `生成${reportName}` };
  if (input.freshness === "stale") return { kind: "update", label: `更新${reportName}` };
  return { kind: "view", label: `查看${reportName}` };
}

function buildView(input: {
  period: JournalPeriodRange;
  materials: JournalPeriodMaterial[];
  report: StoredReport | null;
  generation: StoredGeneration | null;
}): JournalPeriodReportView {
  const report = mapReport(input.report);
  const latestGeneration = mapGeneration(input.generation);
  const sourceSignature = buildJournalPeriodSourceSignature(input.period, input.materials);
  const freshness: JournalPeriodReportFreshness = !report
    ? "none"
    : report.sourceSignature === sourceSignature
      ? report.status
      : "stale";
  const displayStatus = latestGeneration?.status === "processing"
    ? "generating"
    : latestGeneration?.status === "failed" && latestGeneration.kind === "update" && report
      ? "update_failed"
      : input.materials.length === 0 && !report
        ? "empty"
        : !report
          ? "ungenerated"
          : freshness === "stale"
            ? "stale"
            : report.status === "saved"
              ? "saved"
              : "draft";
  return {
    period: input.period,
    materials: input.materials,
    sourceSignature,
    report,
    freshness,
    displayStatus,
    latestGeneration,
    statistics: buildStatistics(input.materials),
    primaryAction: primaryAction({
      period: input.period,
      materials: input.materials,
      entry: report,
      freshness,
      latest: latestGeneration
    })
  };
}

async function readPeriodProjection(
  database: PeriodDatabaseClient,
  userId: string,
  period: JournalPeriodRange
) {
  const [report, materials, generation] = await Promise.all([
    findReportByPeriodWithClient(database, userId, period),
    listPeriodMaterialsWithClient(database, userId, period),
    findLatestGenerationWithClient(database, userId, period)
  ]);
  return buildView({ period, materials, report, generation });
}

export async function getJournalPeriodReportView(
  userId: string,
  kind: JournalPeriodRange["kind"],
  date: string
) {
  return readPeriodProjection(prisma, userId, resolveJournalPeriodRange(kind, date));
}

export async function getJournalPeriodReportViewForRange(userId: string, period: JournalPeriodRange) {
  assertRange(period);
  return readPeriodProjection(prisma, userId, period);
}

export async function getLatestSavedJournalPeriodReportRevision(userId: string, reportId: string) {
  const revision = await prisma.journalPeriodReportRevision.findFirst({
    where: { reportId, report: { userId }, kind: "user_saved" },
    orderBy: [{ contentRevision: "desc" }, { createdAt: "desc" }]
  });
  return revision ? mapRevision(revision) : null;
}

export async function reserveJournalPeriodReportGeneration(
  input: ReserveJournalPeriodReportGenerationInput
): Promise<JournalPeriodReportGenerationRecord> {
  assertRange(input.period);
  assertNonEmpty(input.clientOperationId, "JOURNAL_PERIOD_REPORT_OPERATION_ID_INVALID");
  assertNonEmpty(input.expectedSourceSignature, "JOURNAL_PERIOD_REPORT_SOURCE_SIGNATURE_INVALID");
  if (input.expectedContentRevision !== null) assertContentRevision(input.expectedContentRevision);

  const generation = await prisma.$transaction(async (database) => {
    const periodStart = parseEntryDateInput(input.period.startDate);
    const existingOperation = await database.journalPeriodReportGeneration.findUnique({
      where: {
        userId_periodKind_periodStart_clientOperationId: {
          userId: input.userId,
          periodKind: input.period.kind,
          periodStart,
          clientOperationId: input.clientOperationId
        }
      }
    });
    if (existingOperation) return existingOperation;
    const [report, materials] = await Promise.all([
      findReportByPeriodWithClient(database, input.userId, input.period),
      listPeriodMaterialsWithClient(database, input.userId, input.period)
    ]);
    if (materials.length === 0) throw new Error("JOURNAL_PERIOD_REPORT_SOURCE_INSUFFICIENT");
    if (buildJournalPeriodSourceSignature(input.period, materials) !== input.expectedSourceSignature) {
      throw new Error("JOURNAL_PERIOD_REPORT_SOURCE_CHANGED");
    }
    if ((report?.contentRevision ?? null) !== input.expectedContentRevision) {
      throw new Error("JOURNAL_PERIOD_REPORT_VERSION_CHANGED");
    }
    if (input.kind === "generate" && report) throw new Error("JOURNAL_PERIOD_REPORT_ALREADY_EXISTS");
    if (input.kind === "update" && !report) throw new Error("JOURNAL_PERIOD_REPORT_NOT_FOUND");
    return database.journalPeriodReportGeneration.create({
      data: {
        userId: input.userId,
        periodKind: input.period.kind,
        periodStart,
        reportId: report?.id ?? null,
        clientOperationId: input.clientOperationId,
        kind: input.kind,
        expectedSourceSignature: input.expectedSourceSignature,
        expectedContentRevision: input.expectedContentRevision,
        inputSnapshot: toJsonValue({
          schemaVersion: 1,
          period: input.period,
          sources: materials,
          currentReport: mapReport(report)
        })
      }
    });
  });
  return mapGeneration(generation)!;
}

export async function commitJournalPeriodReportDraft(
  input: CommitJournalPeriodReportInput
): Promise<JournalPeriodReportRecord> {
  assertRange(input.period);
  assertContent(input.title, input.content);
  assertNonEmpty(input.expectedSourceSignature, "JOURNAL_PERIOD_REPORT_SOURCE_SIGNATURE_INVALID");
  if (input.expectedContentRevision !== null) assertContentRevision(input.expectedContentRevision);

  return prisma.$transaction(async (database) => {
    const generation = input.generationId
      ? await database.journalPeriodReportGeneration.findFirst({
          where: { id: input.generationId, userId: input.userId }
        })
      : null;
    if (input.generationId && !generation) throw new Error("JOURNAL_PERIOD_REPORT_GENERATION_NOT_FOUND");
    if (generation && generation.status !== "processing") {
      if (generation.status === "completed" && generation.reportId) {
        const completed = await findReportForUserWithClient(database, input.userId, generation.reportId);
        const mapped = mapReport(completed);
        if (mapped) return mapped;
      }
      throw new Error("JOURNAL_PERIOD_REPORT_GENERATION_ALREADY_SETTLED");
    }
    if (
      generation &&
      (generation.expectedSourceSignature !== input.expectedSourceSignature ||
        generation.expectedContentRevision !== input.expectedContentRevision)
    ) {
      throw new Error("JOURNAL_PERIOD_REPORT_GENERATION_INPUT_CHANGED");
    }

    const [materials, existing] = await Promise.all([
      listPeriodMaterialsWithClient(database, input.userId, input.period),
      findReportByPeriodWithClient(database, input.userId, input.period)
    ]);
    if (materials.length === 0) throw new Error("JOURNAL_PERIOD_REPORT_SOURCE_INSUFFICIENT");
    const sourceSignature = buildJournalPeriodSourceSignature(input.period, materials);
    if (sourceSignature !== input.expectedSourceSignature) {
      throw new Error("JOURNAL_PERIOD_REPORT_SOURCE_CHANGED");
    }
    if ((existing?.contentRevision ?? null) !== input.expectedContentRevision) {
      throw new Error("JOURNAL_PERIOD_REPORT_VERSION_CHANGED");
    }

    const sourceIds = materials.map((source) => source.sourceId);
    const isUpdate = input.revisionKind === "updated" || generation?.kind === "update";
    const paragraphs = normalizeParagraphDocument(input.paragraphs, input.content, sourceIds, {
      allowUnmappedParagraphs: isUpdate
    });
    const sourceSnapshot = buildSnapshot(input.period, materials);
    const nextRevision = (existing?.contentRevision ?? 0) + 1;
    const hasSavedBase = existing?.savedRevision !== null && existing?.savedRevision !== undefined;
    const data = {
      periodEnd: parseEntryDateInput(input.period.endDate),
      title: input.title.trim(),
      content: input.content.trim(),
      paragraphs: toJsonValue(paragraphs),
      status: hasSavedBase ? ("modified" as const) : ("draft" as const),
      sourceIds,
      sourceSignature,
      sourceSnapshot: toJsonValue(sourceSnapshot),
      sourceUpdatedAt: latestSourceUpdatedAt(materials),
      contentRevision: nextRevision,
      savedRevision: existing?.savedRevision ?? null,
      lastGenerationErrorCode: null,
      editedAt: hasSavedBase ? new Date() : null,
      savedAt: existing?.savedAt ?? null
    };
    let report: StoredReport | null;
    if (existing) {
      const updated = await database.journalPeriodReport.updateMany({
        where: { id: existing.id, userId: input.userId, contentRevision: existing.contentRevision },
        data
      });
      if (updated.count !== 1) throw new Error("JOURNAL_PERIOD_REPORT_VERSION_CHANGED");
      report = await findReportForUserWithClient(database, input.userId, existing.id);
    } else {
      report = await database.journalPeriodReport.create({
        data: {
          userId: input.userId,
          periodKind: input.period.kind,
          periodStart: parseEntryDateInput(input.period.startDate),
          ...data
        }
      });
    }
    if (!report) throw new Error("JOURNAL_PERIOD_REPORT_NOT_FOUND");
    const revision = await database.journalPeriodReportRevision.create({
      data: {
        reportId: report.id,
        kind: input.revisionKind ?? (generation?.kind === "update" ? "updated" : "generated"),
        title: report.title,
        content: report.content,
        paragraphs: toJsonValue(report.paragraphs),
        sourceSignature: report.sourceSignature,
        sourceSnapshot: toJsonValue(report.sourceSnapshot),
        contentRevision: report.contentRevision
      }
    });
    if (generation) {
      const completedAt = new Date();
      await database.journalPeriodReportGeneration.update({
        where: { id: generation.id },
        data: {
          reportId: report.id,
          status: "completed",
          outputSnapshot: toJsonValue({
            schemaVersion: 1,
            title: report.title,
            content: report.content,
            paragraphs,
            sourceSignature
          }),
          resultRevisionId: revision.id,
          completedAt
        }
      });
    }
    return mapReport(report)!;
  });
}

export async function updateJournalPeriodReport(
  input: UpdateJournalPeriodReportInput
): Promise<JournalPeriodReportRecord> {
  assertContentRevision(input.expectedContentRevision);
  assertContent(input.title, input.content);
  return prisma.$transaction(async (database) => {
    const existing = await findReportForUserWithClient(database, input.userId, input.reportId);
    if (!existing) throw new Error("JOURNAL_PERIOD_REPORT_NOT_FOUND");
    if (existing.contentRevision !== input.expectedContentRevision) {
      throw new Error("JOURNAL_PERIOD_REPORT_VERSION_CHANGED");
    }
    const period: JournalPeriodRange = {
      kind: existing.periodKind,
      startDate: formatEntryDate(existing.periodStart),
      endDate: formatEntryDate(existing.periodEnd)
    };
    const materials = await listPeriodMaterialsWithClient(database, input.userId, period);
    const sourceSignature = buildJournalPeriodSourceSignature(period, materials);
    if (sourceSignature !== existing.sourceSignature) throw new Error("JOURNAL_PERIOD_REPORT_SOURCE_CHANGED");
    const sourceIds = materials.map((source) => source.sourceId);
    const previous = normalizeStoredParagraphs(existing.paragraphs, existing.content, existing.sourceIds);
    const paragraphs = input.paragraphs
      ? normalizeParagraphDocument(input.paragraphs, input.content, sourceIds, {
          allowUnmappedParagraphs: true,
          requireFullCoverage: false
        })
      : input.content.trim() === existing.content.trim()
        ? previous
        : reconcileManualParagraphs(previous, input.content, sourceIds);
    const nextRevision = existing.contentRevision + 1;
    const updated = await database.journalPeriodReport.updateMany({
      where: { id: existing.id, userId: input.userId, contentRevision: existing.contentRevision },
      data: {
        title: input.title.trim(),
        content: input.content.trim(),
        paragraphs: toJsonValue(paragraphs),
        status: existing.savedRevision === null ? "draft" : "modified",
        contentRevision: nextRevision,
        editedAt: new Date()
      }
    });
    if (updated.count !== 1) throw new Error("JOURNAL_PERIOD_REPORT_VERSION_CHANGED");
    const report = await findReportForUserWithClient(database, input.userId, existing.id);
    if (!report) throw new Error("JOURNAL_PERIOD_REPORT_NOT_FOUND");
    return mapReport(report)!;
  });
}

function paragraphTokens(value: string) {
  return new Set(value.replace(/\s+/gu, "").split(""));
}

function paragraphSimilarity(left: string, right: string) {
  const leftTokens = paragraphTokens(left);
  const rightTokens = paragraphTokens(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function reconcileManualParagraphs(
  existing: JournalPeriodParagraphDocument,
  content: string,
  sourceIds: string[]
): JournalPeriodParagraphDocument {
  const nextTexts = content.split(/\n\s*\n/u).map((text) => text.trim()).filter(Boolean);
  const remaining = new Set(existing.paragraphs.map((_, index) => index));
  const paragraphs = nextTexts.map((text, nextIndex) => {
    let matchedIndex = existing.paragraphs.findIndex(
      (paragraph, index) => remaining.has(index) && paragraph.text.trim() === text
    );
    if (matchedIndex < 0) {
      const ranked = [...remaining]
        .map((index) => ({
          index,
          score: paragraphSimilarity(existing.paragraphs[index]!.text, text),
          distance: Math.abs(index - nextIndex)
        }))
        .sort((left, right) => right.score - left.score || left.distance - right.distance);
      if (ranked[0] && (ranked[0].score >= 0.35 || nextTexts.length === existing.paragraphs.length)) {
        matchedIndex = ranked[0].index;
      }
    }
    if (matchedIndex >= 0) {
      remaining.delete(matchedIndex);
      return {
        text,
        sourceIds: existing.paragraphs[matchedIndex]!.sourceIds.filter((id) => sourceIds.includes(id))
      };
    }
    return { text, sourceIds: [] };
  });
  return { schemaVersion: 1, paragraphs };
}

export async function saveJournalPeriodReport(
  input: SaveJournalPeriodReportInput
): Promise<JournalPeriodReportRecord> {
  assertContentRevision(input.expectedContentRevision);
  return prisma.$transaction(async (database) => {
    const existing = await findReportForUserWithClient(database, input.userId, input.reportId);
    if (!existing) throw new Error("JOURNAL_PERIOD_REPORT_NOT_FOUND");
    if (existing.contentRevision !== input.expectedContentRevision) {
      throw new Error("JOURNAL_PERIOD_REPORT_VERSION_CHANGED");
    }
    if (existing.status === "saved" && existing.savedRevision === existing.contentRevision) {
      return mapReport(existing)!;
    }
    const period: JournalPeriodRange = {
      kind: existing.periodKind,
      startDate: formatEntryDate(existing.periodStart),
      endDate: formatEntryDate(existing.periodEnd)
    };
    const materials = await listPeriodMaterialsWithClient(database, input.userId, period);
    if (buildJournalPeriodSourceSignature(period, materials) !== existing.sourceSignature) {
      throw new Error("JOURNAL_PERIOD_REPORT_SOURCE_CHANGED");
    }
    const now = new Date();
    const saved = await database.journalPeriodReport.updateMany({
      where: { id: existing.id, userId: input.userId, contentRevision: existing.contentRevision },
      data: { status: "saved", savedRevision: existing.contentRevision, savedAt: now, lastGenerationErrorCode: null }
    });
    if (saved.count !== 1) throw new Error("JOURNAL_PERIOD_REPORT_VERSION_CHANGED");
    await database.journalPeriodReportRevision.create({
      data: {
        reportId: existing.id,
        kind: "user_saved",
        title: existing.title,
        content: existing.content,
        paragraphs: toJsonValue(existing.paragraphs),
        sourceSignature: existing.sourceSignature,
        sourceSnapshot: toJsonValue(existing.sourceSnapshot),
        contentRevision: existing.contentRevision
      }
    });
    const report = await findReportForUserWithClient(database, input.userId, existing.id);
    if (!report) throw new Error("JOURNAL_PERIOD_REPORT_NOT_FOUND");
    return mapReport(report)!;
  });
}

async function settleGeneration(
  input: SettleJournalPeriodReportGenerationInput,
  status: "failed" | "canceled"
) {
  assertNonEmpty(input.errorCode, "JOURNAL_PERIOD_REPORT_GENERATION_ERROR_INVALID");
  const generation = await prisma.$transaction(async (database) => {
    const existing = await database.journalPeriodReportGeneration.findFirst({
      where: { id: input.generationId, userId: input.userId }
    });
    if (!existing) throw new Error("JOURNAL_PERIOD_REPORT_GENERATION_NOT_FOUND");
    if (existing.status !== "processing") return existing;
    const now = new Date();
    const updated = await database.journalPeriodReportGeneration.update({
      where: { id: existing.id },
      data: status === "failed"
        ? { status, errorCode: input.errorCode, failedAt: now }
        : { status, errorCode: input.errorCode, canceledAt: now }
    });
    if (status === "failed" && existing.reportId) {
      await database.journalPeriodReport.updateMany({
        where: { id: existing.reportId, userId: input.userId },
        data: { lastGenerationErrorCode: input.errorCode }
      });
    }
    return updated;
  });
  return mapGeneration(generation)!;
}

export function failJournalPeriodReportGeneration(input: SettleJournalPeriodReportGenerationInput) {
  return settleGeneration(input, "failed");
}

export function cancelJournalPeriodReportGeneration(input: SettleJournalPeriodReportGenerationInput) {
  return settleGeneration(input, "canceled");
}

/** Exposed for deterministic generation and focused tests without leaking writer-only state to the UI. */
export async function getJournalPeriodReportGenerationView(userId: string, period: JournalPeriodRange) {
  return getJournalPeriodReportViewForRange(userId, period);
}
