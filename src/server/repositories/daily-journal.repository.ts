import { prisma } from "@/server/db/prisma";
import { buildDailyJournalSourceSignature } from "@/features/daily-journal/source-signature";
import { formatEntryDate, parseEntryDateInput } from "@/features/interview/entry-date";
import type { DailyJournalEntryRecord, InterviewDimension } from "@/types/interview";

const DEMO_USER_ID = "local-demo-user";

export interface DailyJournalSourceEntry {
  id: string;
  sessionId: string;
  dimension: InterviewDimension;
  date: string;
  title: string;
  content: string;
  updatedAt: string;
  savedAt: string | null;
}

function mapDailyJournalEntry(entry: any): DailyJournalEntryRecord | null {
  if (!entry) {
    return null;
  }

  return {
    id: entry.id,
    date: formatEntryDate(entry.date),
    title: entry.title,
    content: entry.content,
    status: entry.status,
    sourceEntryIds: entry.sourceEntryIds ?? [],
    sourceSessionIds: entry.sourceSessionIds ?? [],
    sourceSignature: entry.sourceSignature,
    sourceUpdatedAt: entry.sourceUpdatedAt?.toISOString() ?? null,
    updatedAt: entry.updatedAt.toISOString(),
    savedAt: entry.savedAt?.toISOString() ?? null
  };
}

function mapSourceEntry(entry: any): DailyJournalSourceEntry | null {
  if (!entry.session?.dimension) {
    return null;
  }

  return {
    id: entry.id,
    sessionId: entry.sessionId,
    dimension: entry.session.dimension,
    date: formatEntryDate(entry.date),
    title: entry.title,
    content: entry.content,
    updatedAt: entry.updatedAt.toISOString(),
    savedAt: entry.savedAt?.toISOString() ?? null
  };
}

export function buildDailyJournalSourceMetadata(sourceEntries: DailyJournalSourceEntry[]) {
  const sortedSources = [...sourceEntries].sort((left, right) => {
    const dimensionOrder: Record<InterviewDimension, number> = {
      joy: 0,
      fulfillment: 1,
      reflection: 2,
      improvement: 3,
      gratitude: 4
    };
    const dimensionDiff = dimensionOrder[left.dimension] - dimensionOrder[right.dimension];

    if (dimensionDiff !== 0) {
      return dimensionDiff;
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
  const latestUpdatedAt =
    [...sortedSources]
      .map((source) => source.updatedAt)
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

  return {
    sourceEntryIds: sortedSources.map((source) => source.id),
    sourceSessionIds: sortedSources.map((source) => source.sessionId),
    sourceSignature: buildDailyJournalSourceSignature(sortedSources),
    sourceUpdatedAt: latestUpdatedAt ? new Date(latestUpdatedAt) : null
  };
}

export async function listSavedJournalEntriesForDailyJournal(date: string) {
  const dateValue = parseEntryDateInput(date);
  const entries = await prisma.joyEntry.findMany({
    where: {
      userId: DEMO_USER_ID,
      date: dateValue,
      status: "saved"
    },
    select: {
      id: true,
      sessionId: true,
      date: true,
      title: true,
      content: true,
      updatedAt: true,
      savedAt: true,
      session: {
        select: {
          dimension: true
        }
      }
    }
  });

  return entries.flatMap((entry) => {
    const mapped = mapSourceEntry(entry);
    return mapped ? [mapped] : [];
  });
}

export async function findDailyJournalByDate(date: string) {
  const database = prisma as any;
  const entry = await database.dailyJournalEntry?.findUnique?.({
    where: {
      userId_date: {
        userId: DEMO_USER_ID,
        date: parseEntryDateInput(date)
      }
    }
  });

  return mapDailyJournalEntry(entry);
}

export async function upsertDailyJournalDraft(input: {
  date: string;
  title: string;
  content: string;
  sourceEntries: DailyJournalSourceEntry[];
}) {
  const database = prisma as any;
  const dateValue = parseEntryDateInput(input.date);
  const sourceMetadata = buildDailyJournalSourceMetadata(input.sourceEntries);

  const entry = await database.dailyJournalEntry.upsert({
    where: {
      userId_date: {
        userId: DEMO_USER_ID,
        date: dateValue
      }
    },
    update: {
      title: input.title,
      content: input.content,
      status: "draft",
      sourceEntryIds: sourceMetadata.sourceEntryIds,
      sourceSessionIds: sourceMetadata.sourceSessionIds,
      sourceSignature: sourceMetadata.sourceSignature,
      sourceUpdatedAt: sourceMetadata.sourceUpdatedAt,
      savedAt: null
    },
    create: {
      userId: DEMO_USER_ID,
      date: dateValue,
      title: input.title,
      content: input.content,
      status: "draft",
      sourceEntryIds: sourceMetadata.sourceEntryIds,
      sourceSessionIds: sourceMetadata.sourceSessionIds,
      sourceSignature: sourceMetadata.sourceSignature,
      sourceUpdatedAt: sourceMetadata.sourceUpdatedAt
    }
  });

  return mapDailyJournalEntry(entry);
}

export async function updateDailyJournalDraft(input: {
  entryId: string;
  title: string;
  content: string;
}) {
  const database = prisma as any;
  const entry = await database.dailyJournalEntry.update({
    where: {
      id: input.entryId
    },
    data: {
      title: input.title,
      content: input.content,
      status: "draft",
      savedAt: null
    }
  });

  return mapDailyJournalEntry(entry);
}

export async function markDailyJournalSaved(entryId: string) {
  const database = prisma as any;
  const savedAt = new Date();
  const entry = await database.dailyJournalEntry.update({
    where: {
      id: entryId
    },
    data: {
      status: "saved",
      savedAt
    }
  });

  return mapDailyJournalEntry(entry);
}
