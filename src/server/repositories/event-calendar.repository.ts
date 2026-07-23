import { formatEntryDate, getEntryDateRangeBounds } from "@/features/interview/entry-date";
import { prisma } from "@/server/db/prisma";
import type {
  EventCalendarDailyJournalSource,
  EventCalendarEventSource,
  EventCalendarSourceCollection
} from "@/types/event-calendar";

interface ListEventCalendarSourcesByDateRangeInput {
  userId: string;
  startDate: string;
  endDate: string;
}

/**
 * Reads only the event-centred outcome chain.  The five-dimension calendar
 * keeps its existing repository and never receives these sources.
 */
export async function listEventCalendarSourcesByDateRange(
  input: ListEventCalendarSourcesByDateRangeInput
): Promise<EventCalendarSourceCollection> {
  const { startAt, endExclusive } = getEntryDateRangeBounds(input.startDate, input.endDate);

  const [events, dailyJournals] = await Promise.all([
    prisma.journalEvent.findMany({
      where: {
        userId: input.userId,
        status: { not: "abandoned" },
        entryDate: {
          gte: startAt,
          lt: endExclusive
        }
      },
      select: {
        id: true,
        rootSessionId: true,
        entryDate: true,
        daySequence: true,
        status: true,
        startedAt: true,
        generationStartedAt: true,
        completedAt: true,
        updatedAt: true,
        rootSession: {
          select: {
            activeBranchSessionId: true
          }
        },
        entry: {
          select: {
            id: true,
            title: true,
            content: true,
            status: true,
            contentRevision: true,
            savedRevision: true,
            savedAt: true,
            updatedAt: true
          }
        }
      },
      orderBy: [
        { entryDate: "asc" },
        { daySequence: "asc" },
        { id: "asc" }
      ]
    }),
    prisma.journalDailyEntry.findMany({
      where: {
        userId: input.userId,
        entryDate: {
          gte: startAt,
          lt: endExclusive
        }
      },
      select: {
        id: true,
        entryDate: true,
        title: true,
        content: true,
        status: true,
        sourceEntryIds: true,
        sourceEventIds: true,
        sourceSignature: true,
        sourceUpdatedAt: true,
        contentRevision: true,
        savedRevision: true,
        savedAt: true,
        updatedAt: true
      },
      orderBy: { entryDate: "asc" }
    })
  ]);

  const eventSources: EventCalendarEventSource[] = events.flatMap((event) => {
    if (event.status === "abandoned") {
      return [];
    }

    return [{
      kind: "event" as const,
      eventId: event.id,
      rootSessionId: event.rootSessionId,
      activeBranchSessionId: event.rootSession.activeBranchSessionId,
      entryDate: formatEntryDate(event.entryDate),
      daySequence: event.daySequence,
      status: event.status,
      startedAt: event.startedAt.toISOString(),
      generationStartedAt: event.generationStartedAt?.toISOString() ?? null,
      completedAt: event.completedAt?.toISOString() ?? null,
      updatedAt: event.updatedAt.toISOString()
    }];
  });

  const entrySources = events.flatMap((event) =>
    event.entry
      ? [{
          kind: "event_entry" as const,
          entryId: event.entry.id,
          eventId: event.id,
          entryDate: formatEntryDate(event.entryDate),
          daySequence: event.daySequence,
          status: event.entry.status,
          title: event.entry.title,
          content: event.entry.content,
          contentRevision: event.entry.contentRevision,
          savedRevision: event.entry.savedRevision,
          savedAt: event.entry.savedAt?.toISOString() ?? null,
          updatedAt: event.entry.updatedAt.toISOString()
        }]
      : []
  );

  const dailyJournalSources: EventCalendarDailyJournalSource[] = dailyJournals.map((entry) => ({
    kind: "daily_journal",
    entryId: entry.id,
    entryDate: formatEntryDate(entry.entryDate),
    title: entry.title,
    content: entry.content,
    status: entry.status,
    sourceEntryIds: entry.sourceEntryIds,
    sourceEventIds: entry.sourceEventIds,
    sourceSignature: entry.sourceSignature,
    contentRevision: entry.contentRevision,
    savedRevision: entry.savedRevision,
    savedAt: entry.savedAt?.toISOString() ?? null,
    updatedAt: entry.updatedAt.toISOString()
  }));

  return {
    events: eventSources,
    entries: entrySources,
    dailyJournals: dailyJournalSources
  };
}

export function listEventCalendarSourcesByDate(userId: string, date: string) {
  return listEventCalendarSourcesByDateRange({
    userId,
    startDate: date,
    endDate: date
  });
}
