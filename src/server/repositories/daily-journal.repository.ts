import { prisma } from "@/server/db/prisma";
import { buildDailyJournalSourceSignature } from "@/features/daily-journal/source-signature";
import { pickLatestDailyJournalSourcesByDimension } from "@/features/daily-journal/source-selection";
import { formatEntryDate, getEntryDateRangeBounds, parseEntryDateInput } from "@/features/interview/entry-date";
import type { DailyJournalEntryRecord, InterviewDimension } from "@/types/interview";

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

type DailyJournalEntry = Awaited<ReturnType<typeof prisma.dailyJournalEntry.findUnique>>;
type SavedJoyEntryForDailyJournal = Awaited<ReturnType<typeof prisma.joyEntry.findMany>>[number];
type DailyJournalMappedEntry = NonNullable<DailyJournalEntry>;
type SavedJoyEntryForDailyJournalListItem = Pick<
  NonNullable<SavedJoyEntryForDailyJournal>,
  "id" | "sessionId" | "date" | "title" | "content" | "updatedAt" | "savedAt"
> & {
  session: {
    dimension: InterviewDimension;
  } | null;
};

function mapDailyJournalEntry(entry: DailyJournalMappedEntry | null): DailyJournalEntryRecord | null {
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

function mapSourceEntry(entry: SavedJoyEntryForDailyJournalListItem): DailyJournalSourceEntry | null {
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

export async function listSavedJournalEntriesForDailyJournal(userId: string, date: string) {
  const { startAt, endExclusive } = getEntryDateRangeBounds(date);
  const entries = await prisma.joyEntry.findMany({
    where: {
      userId,
      status: "saved",
      date: {
        gte: startAt,
        lt: endExclusive
      }
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

  return pickLatestDailyJournalSourcesByDimension(
    entries.flatMap((entry) => {
      const mapped = mapSourceEntry(entry);

      return mapped ? [mapped] : [];
    })
  );
}

export async function findDailyJournalByDate(userId: string, date: string) {
  const entry = await prisma.dailyJournalEntry.findUnique({
    where: {
      userId_date: {
        userId,
        date: parseEntryDateInput(date)
      }
    }
  });

  return mapDailyJournalEntry(entry);
}

export async function upsertDailyJournalDraft(input: {
  userId: string;
  date: string;
  title: string;
  content: string;
  sourceEntries: DailyJournalSourceEntry[];
}) {
  const dateValue = parseEntryDateInput(input.date);
  const sourceMetadata = buildDailyJournalSourceMetadata(input.sourceEntries);

  const entry = await prisma.dailyJournalEntry.upsert({
    where: {
      userId_date: {
        userId: input.userId,
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
      userId: input.userId,
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
  const entry = await prisma.dailyJournalEntry.update({
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
  const savedAt = new Date();
  const entry = await prisma.dailyJournalEntry.update({
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

export async function markDailyJournalSavedWithMeta(entryId: string) {
  const savedAt = new Date();
  const entry = await prisma.dailyJournalEntry.update({
    where: {
      id: entryId
    },
    data: {
      status: "saved",
      savedAt
    },
    select: {
      id: true,
      createdAt: true,
      userId: true,
      date: true,
      title: true,
      content: true,
      status: true,
      sourceEntryIds: true,
      sourceSessionIds: true,
      sourceSignature: true,
      sourceUpdatedAt: true,
      updatedAt: true,
      savedAt: true
    }
  });

  return {
    userId: entry.userId,
    dailyJournal: mapDailyJournalEntry(entry)
  };
}
