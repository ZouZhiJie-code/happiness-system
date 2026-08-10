import { Prisma } from "@prisma/client";

import { buildJournalDailySourceSignature } from "@/features/journal-daily/source-signature";
import { MAX_JOURNAL_TITLE_LENGTH } from "@/features/interview/journal-title";
import { prisma } from "@/server/db/prisma";
import { formatEntryDate, getEntryDateRangeBounds, parseEntryDateInput } from "@/features/interview/entry-date";
import type {
  CommitJournalDailyEntryDraftInput,
  JournalDailyEntryRecord,
  JournalDailyEntrySourceSnapshot,
  JournalDailyJournalView,
  JournalDailySourceEntry,
  SaveJournalDailyEntryInput,
  UpdateJournalDailyEntryInput
} from "@/types/journal-daily-entry";

type SourceDatabaseClient = Pick<Prisma.TransactionClient, "journalEventEntry">;
type StoredJournalDailyEntry = Prisma.JournalDailyEntryGetPayload<Record<never, never>>;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function fromJsonValue<T>(value: Prisma.JsonValue): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function serializeDate(value: Date | null) {
  return value?.toISOString() ?? null;
}

function assertEntryContent(title: string, content: string) {
  const normalizedTitle = title.trim();

  if (!normalizedTitle || [...normalizedTitle].length > MAX_JOURNAL_TITLE_LENGTH || !content.trim()) {
    throw new Error("JOURNAL_DAILY_ENTRY_INVALID");
  }
}

function assertContentRevision(value: number, code = "JOURNAL_DAILY_ENTRY_VERSION_INVALID") {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(code);
  }
}

function mapJournalDailyEntry(entry: StoredJournalDailyEntry | null): JournalDailyEntryRecord | null {
  if (!entry) {
    return null;
  }

  return {
    id: entry.id,
    entryDate: formatEntryDate(entry.entryDate),
    title: entry.title,
    content: entry.content,
    status: entry.status,
    sourceEntryIds: entry.sourceEntryIds,
    sourceEventIds: entry.sourceEventIds,
    sourceSignature: entry.sourceSignature,
    sourceSnapshot: fromJsonValue<JournalDailyEntrySourceSnapshot>(entry.sourceSnapshot),
    sourceUpdatedAt: serializeDate(entry.sourceUpdatedAt),
    contentRevision: entry.contentRevision,
    savedRevision: entry.savedRevision,
    editedAt: serializeDate(entry.editedAt),
    savedAt: serializeDate(entry.savedAt),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

function buildSourceSnapshot(entryDate: string, sources: JournalDailySourceEntry[]): JournalDailyEntrySourceSnapshot {
  return {
    schemaVersion: 1,
    entryDate,
    sources
  };
}

function getSourceSignature(sources: JournalDailySourceEntry[]) {
  return buildJournalDailySourceSignature(sources);
}

function getLatestSavedAt(sources: JournalDailySourceEntry[]) {
  const latest = sources.reduce<string | null>((current, source) => {
    if (!current || source.savedAt > current) {
      return source.savedAt;
    }

    return current;
  }, null);

  return latest ? new Date(latest) : null;
}

async function listSavedJournalEventEntriesForDailyJournalWithClient(
  database: SourceDatabaseClient,
  userId: string,
  entryDate: string
): Promise<JournalDailySourceEntry[]> {
  const { startAt, endExclusive } = getEntryDateRangeBounds(entryDate);
  const entries = await database.journalEventEntry.findMany({
    where: {
      status: "saved",
      savedRevision: { not: null },
      savedAt: { not: null },
      event: {
        userId,
        status: "completed",
        entryDate: {
          gte: startAt,
          lt: endExclusive
        }
      }
    },
    select: {
      id: true,
      title: true,
      content: true,
      contentRevision: true,
      savedRevision: true,
      savedAt: true,
      event: {
        select: {
          id: true,
          entryDate: true,
          daySequence: true
        }
      }
    },
    orderBy: [
      { event: { daySequence: "asc" } },
      { id: "asc" }
    ]
  });

  return entries.flatMap((entry) => {
    if (
      entry.savedRevision === null ||
      entry.savedRevision !== entry.contentRevision ||
      !entry.savedAt
    ) {
      return [];
    }

    return [{
      eventId: entry.event.id,
      entryId: entry.id,
      entryDate: formatEntryDate(entry.event.entryDate),
      daySequence: entry.event.daySequence,
      title: entry.title,
      content: entry.content,
      savedRevision: entry.savedRevision,
      savedAt: entry.savedAt.toISOString()
    }];
  });
}

async function listPendingJournalEventEntryIdsForDateWithClient(
  database: SourceDatabaseClient,
  userId: string,
  entryDate: string
) {
  const { startAt, endExclusive } = getEntryDateRangeBounds(entryDate);
  const entries = await database.journalEventEntry.findMany({
    where: {
      status: { in: ["draft", "modified"] },
      event: {
        userId,
        status: "completed",
        entryDate: {
          gte: startAt,
          lt: endExclusive
        }
      }
    },
    select: { id: true },
    orderBy: { id: "asc" }
  });

  return entries.map((entry) => entry.id);
}

async function findJournalDailyEntryByDateWithClient(
  database: Pick<Prisma.TransactionClient, "journalDailyEntry">,
  userId: string,
  entryDate: string
) {
  return database.journalDailyEntry.findUnique({
    where: {
      userId_entryDate: {
        userId,
        entryDate: parseEntryDateInput(entryDate)
      }
    }
  });
}

async function findJournalDailyEntryForUserWithClient(
  database: Pick<Prisma.TransactionClient, "journalDailyEntry">,
  userId: string,
  entryId: string
) {
  return database.journalDailyEntry.findFirst({
    where: { id: entryId, userId }
  });
}

export async function listSavedJournalEventEntriesForDailyJournal(userId: string, entryDate: string) {
  return listSavedJournalEventEntriesForDailyJournalWithClient(prisma, userId, entryDate);
}

export async function getJournalDailyEntry(userId: string, entryDate: string) {
  const entry = await findJournalDailyEntryByDateWithClient(prisma, userId, entryDate);
  return mapJournalDailyEntry(entry);
}

export async function getJournalDailyJournalView(
  userId: string,
  entryDate: string
): Promise<JournalDailyJournalView> {
  const [entry, savedSources, pendingSaveEntryIds] = await Promise.all([
    findJournalDailyEntryByDateWithClient(prisma, userId, entryDate),
    listSavedJournalEventEntriesForDailyJournalWithClient(prisma, userId, entryDate),
    listPendingJournalEventEntryIdsForDateWithClient(prisma, userId, entryDate)
  ]);
  const sourceSignature = getSourceSignature(savedSources);
  const collection =
    savedSources.length === 0
      ? { kind: "empty" as const }
      : savedSources.length === 1
        ? { kind: "single_entry" as const, entryId: savedSources[0]!.entryId }
        : { kind: "multiple_entries" as const };
  const mappedEntry = mapJournalDailyEntry(entry);
  const freshness = !mappedEntry
    ? "none"
    : mappedEntry.sourceSignature === sourceSignature
      ? mappedEntry.status
      : "stale";

  return {
    entryDate,
    savedSources,
    pendingSaveEntryIds,
    sourceSignature,
    collection,
    entry: mappedEntry,
    freshness,
    updateBlockedByPendingSource: collection.kind === "multiple_entries" && pendingSaveEntryIds.length > 0
  };
}

export async function commitJournalDailyEntryDraft(
  input: CommitJournalDailyEntryDraftInput
): Promise<JournalDailyEntryRecord> {
  assertEntryContent(input.title, input.content);
  if (!input.expectedSourceSignature.trim()) {
    throw new Error("JOURNAL_DAILY_SOURCE_SIGNATURE_INVALID");
  }
  if (input.expectedContentRevision !== null) {
    assertContentRevision(input.expectedContentRevision);
  }

  return prisma.$transaction(async (database) => {
    const [savedSources, pendingSaveEntryIds] = await Promise.all([
      listSavedJournalEventEntriesForDailyJournalWithClient(
        database,
        input.userId,
        input.entryDate
      ),
      listPendingJournalEventEntryIdsForDateWithClient(database, input.userId, input.entryDate)
    ]);
    const currentSignature = getSourceSignature(savedSources);

    if (savedSources.length < 2) {
      throw new Error("JOURNAL_DAILY_SOURCE_INSUFFICIENT");
    }
    if (pendingSaveEntryIds.length > 0) {
      throw new Error("JOURNAL_DAILY_PENDING_EVENT_ENTRY");
    }
    if (currentSignature !== input.expectedSourceSignature) {
      throw new Error("JOURNAL_DAILY_SOURCE_CHANGED");
    }

    const existing = await findJournalDailyEntryByDateWithClient(
      database,
      input.userId,
      input.entryDate
    );
    if (existing) {
      if (input.expectedContentRevision !== existing.contentRevision) {
        throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
      }
      if (existing.status === "modified" && !input.replaceManualEditsConfirmed) {
        throw new Error("JOURNAL_DAILY_MANUAL_EDITS_CONFIRMATION_REQUIRED");
      }
    } else if (input.expectedContentRevision !== null) {
      throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
    }

    const sourceSnapshot = buildSourceSnapshot(input.entryDate, savedSources);
    const nextContentRevision = (existing?.contentRevision ?? 0) + 1;
    const data = {
      title: input.title.trim(),
      content: input.content.trim(),
      status: "draft" as const,
      sourceEntryIds: savedSources.map((source) => source.entryId),
      sourceEventIds: savedSources.map((source) => source.eventId),
      sourceSignature: currentSignature,
      sourceSnapshot: toJsonValue(sourceSnapshot),
      sourceUpdatedAt: getLatestSavedAt(savedSources),
      contentRevision: nextContentRevision,
      savedRevision: null,
      editedAt: null,
      savedAt: null
    };
    let entry: StoredJournalDailyEntry | null;
    if (existing) {
      const update = await database.journalDailyEntry.updateMany({
        where: {
          id: existing.id,
          userId: input.userId,
          contentRevision: existing.contentRevision
        },
        data
      });
      if (update.count !== 1) {
        throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
      }
      entry = await findJournalDailyEntryForUserWithClient(database, input.userId, existing.id);
    } else {
      entry = await database.journalDailyEntry.create({
        data: {
          userId: input.userId,
          entryDate: parseEntryDateInput(input.entryDate),
          ...data
        }
      });
    }

    const mapped = mapJournalDailyEntry(entry);
    if (!mapped) {
      throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
    }

    return mapped;
  });
}

export async function updateJournalDailyEntry(
  input: UpdateJournalDailyEntryInput
): Promise<JournalDailyEntryRecord> {
  assertEntryContent(input.title, input.content);
  assertContentRevision(input.expectedContentRevision);

  return prisma.$transaction(async (database) => {
    const existing = await findJournalDailyEntryForUserWithClient(database, input.userId, input.entryId);
    if (!existing) {
      throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
    }
    if (existing.contentRevision !== input.expectedContentRevision) {
      throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
    }

    const savedSources = await listSavedJournalEventEntriesForDailyJournalWithClient(
      database,
      input.userId,
      formatEntryDate(existing.entryDate)
    );
    if (savedSources.length < 2) {
      throw new Error("JOURNAL_DAILY_ENTRY_READ_ONLY");
    }
    if (getSourceSignature(savedSources) !== existing.sourceSignature) {
      throw new Error("JOURNAL_DAILY_SOURCE_CHANGED");
    }

    const update = await database.journalDailyEntry.updateMany({
      where: {
          id: existing.id,
          userId: input.userId,
          contentRevision: existing.contentRevision
      },
      data: {
        title: input.title.trim(),
        content: input.content.trim(),
        status: existing.status === "draft" ? "draft" : "modified",
        contentRevision: { increment: 1 },
        editedAt: new Date()
      }
    });
    if (update.count !== 1) {
      throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
    }

    const updated = await findJournalDailyEntryForUserWithClient(database, input.userId, input.entryId);
    const mapped = mapJournalDailyEntry(updated);
    if (!mapped) {
      throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
    }

    return mapped;
  });
}

export async function saveJournalDailyEntry(
  input: SaveJournalDailyEntryInput
): Promise<JournalDailyEntryRecord> {
  assertContentRevision(input.expectedContentRevision);

  return prisma.$transaction(async (database) => {
    const existing = await findJournalDailyEntryForUserWithClient(database, input.userId, input.entryId);
    if (!existing) {
      throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
    }
    if (existing.contentRevision !== input.expectedContentRevision) {
      throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
    }

    const savedSources = await listSavedJournalEventEntriesForDailyJournalWithClient(
      database,
      input.userId,
      formatEntryDate(existing.entryDate)
    );
    if (savedSources.length < 2 || getSourceSignature(savedSources) !== existing.sourceSignature) {
      throw new Error("JOURNAL_DAILY_SOURCE_CHANGED");
    }

    const now = new Date();
    const update = await database.journalDailyEntry.updateMany({
      where: {
        id: existing.id,
        userId: input.userId,
        contentRevision: input.expectedContentRevision
      },
      data: {
        status: "saved",
        savedRevision: input.expectedContentRevision,
        savedAt: now,
        updatedAt: now
      }
    });
    if (update.count !== 1) {
      throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
    }

    const saved = await findJournalDailyEntryForUserWithClient(database, input.userId, input.entryId);
    const mapped = mapJournalDailyEntry(saved);
    if (!mapped) {
      throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
    }

    return mapped;
  });
}
