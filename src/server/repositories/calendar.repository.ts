import { prisma } from "@/server/db/prisma";
import { formatEntryDate, getEntryDateRangeBounds, parseEntryDateInput } from "@/features/interview/entry-date";
import type { CalendarDailyJournalSource, CalendarEntrySource, CalendarSessionSource } from "@/features/calendar/types";

const DEMO_USER_ID = "local-demo-user";

interface ListCalendarSourcesByDateRangeInput {
  startDate: string;
  endDate: string;
}

function resolveSessionUpdatedAt(session: {
  completedAt: Date | null;
  pausedAt: Date | null;
  startedAt: Date;
  messages?: Array<{ createdAt: Date }>;
}) {
  const lastMessageAt = session.messages?.[0]?.createdAt ?? null;
  const latestTimestamp = Math.max(
    session.startedAt.getTime(),
    session.pausedAt?.getTime() ?? 0,
    session.completedAt?.getTime() ?? 0,
    lastMessageAt?.getTime() ?? 0
  );

  return new Date(latestTimestamp).toISOString();
}

export async function listCalendarSourcesByDateRange(input: ListCalendarSourcesByDateRangeInput) {
  const { startAt, endExclusive } = getEntryDateRangeBounds(input.startDate, input.endDate);

  const [sessions, entries, dailyJournals] = await Promise.all([
    prisma.interviewSession.findMany({
      where: {
        userId: DEMO_USER_ID,
        entryDate: {
          gte: startAt,
          lt: endExclusive
        }
      },
      select: {
        id: true,
        dimension: true,
        entryDate: true,
        status: true,
        startedAt: true,
        completedAt: true,
        pausedAt: true,
        draftSummary: true,
        finalEntryId: true,
        messages: {
          orderBy: {
            sequence: "desc"
          },
          take: 1,
          select: {
            createdAt: true
          }
        }
      }
    }),
    prisma.joyEntry.findMany({
      where: {
        userId: DEMO_USER_ID,
        date: {
          gte: startAt,
          lt: endExclusive
        }
      },
      select: {
        id: true,
        sessionId: true,
        date: true,
        status: true,
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
    }),
    (prisma as any).dailyJournalEntry?.findMany?.({
      where: {
        userId: DEMO_USER_ID,
        date: {
          gte: startAt,
          lt: endExclusive
        }
      },
      select: {
        id: true,
        date: true,
        status: true,
        title: true,
        updatedAt: true,
        savedAt: true,
        sourceEntryIds: true,
        sourceSignature: true
      }
    }) ?? Promise.resolve([])
  ]);

  const calendarSessions: CalendarSessionSource[] = sessions
    .filter((session) => session.status !== "abandoned")
    .map((session) => ({
      kind: "session",
      id: session.id,
      dimension: session.dimension,
      date: formatEntryDate(session.entryDate ?? session.startedAt),
      status: session.status,
      updatedAt: resolveSessionUpdatedAt(session),
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
      pausedAt: session.pausedAt?.toISOString() ?? null,
      draftSummary: session.draftSummary,
      journalEntryId: session.finalEntryId
    }));

  const calendarEntries: CalendarEntrySource[] = entries.flatMap((entry) => {
    if (!entry.session?.dimension) {
      return [];
    }

    return [
      {
        kind: "entry" as const,
        id: entry.id,
        sessionId: entry.sessionId,
        dimension: entry.session.dimension,
        date: formatEntryDate(entry.date),
        status: entry.status,
        title: entry.title,
        content: entry.content,
        updatedAt: entry.updatedAt.toISOString(),
        savedAt: entry.savedAt?.toISOString() ?? null
      }
    ];
  });

  const calendarDailyJournals: CalendarDailyJournalSource[] = dailyJournals.map((entry: any) => ({
    kind: "daily_journal" as const,
    id: entry.id,
    date: formatEntryDate(entry.date),
    status: entry.status,
    title: entry.title,
    updatedAt: entry.updatedAt.toISOString(),
    savedAt: entry.savedAt?.toISOString() ?? null,
    sourceEntryIds: entry.sourceEntryIds ?? [],
    sourceSignature: entry.sourceSignature
  }));

  return {
    sessions: calendarSessions,
    entries: calendarEntries,
    dailyJournals: calendarDailyJournals
  };
}

export async function listCalendarSourcesByDate(date: string) {
  return listCalendarSourcesByDateRange({
    startDate: date,
    endDate: date
  });
}
