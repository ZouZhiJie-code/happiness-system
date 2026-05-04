import {
  aggregateCalendarDay,
  aggregateCalendarDimension,
  aggregateCalendarMonth,
  aggregateCalendarWeek
} from "@/features/calendar/aggregate-calendar";
import type { CalendarDailyJournalSource, CalendarEntrySource, CalendarSessionSource } from "@/features/calendar/types";

function buildSession(overrides: Partial<CalendarSessionSource> = {}): CalendarSessionSource {
  return {
    kind: "session",
    id: "session-1",
    dimension: "joy",
    date: "2026-05-01",
    status: "active",
    messageCount: 2,
    updatedAt: "2026-05-01T10:00:00.000Z",
    startedAt: "2026-05-01T09:00:00.000Z",
    completedAt: null,
    pausedAt: null,
    draftSummary: "今天这段开心已经有点成形了。",
    journalEntryId: null,
    ...overrides
  };
}

function buildEntry(overrides: Partial<CalendarEntrySource> = {}): CalendarEntrySource {
  return {
    kind: "entry",
    id: "entry-1",
    sessionId: "session-1",
    dimension: "joy",
    date: "2026-05-01",
    status: "draft",
    title: "被稳稳接住",
    content: "今天和家人一起吃饭聊天，整个人慢慢放松下来。",
    updatedAt: "2026-05-01T11:00:00.000Z",
    savedAt: null,
    ...overrides
  };
}

function buildDailyJournal(overrides: Partial<CalendarDailyJournalSource> = {}): CalendarDailyJournalSource {
  return {
    kind: "daily_journal",
    id: "daily-1",
    date: "2026-05-01",
    status: "saved",
    title: "今天的记录",
    updatedAt: "2026-05-01T12:00:00.000Z",
    savedAt: "2026-05-01T12:00:00.000Z",
    sourceEntryIds: ["entry-1"],
    sourceSignature: "entry-1:2026-05-01T11:00:00.000Z",
    ...overrides
  };
}

describe("aggregateCalendarDimension", () => {
  it("marks a completed session without draft or saved entries as in progress", () => {
    const result = aggregateCalendarDimension({
      date: "2026-05-01",
      dimension: "joy",
      sessions: [buildSession({ status: "completed", completedAt: "2026-05-01T10:00:00.000Z" })],
      entries: []
    });

    expect(result.status).toBe("in_progress");
    expect(result.actions).toEqual(["continue_interview"]);
  });

  it("marks a saved entry plus active session as mixed", () => {
    const result = aggregateCalendarDimension({
      date: "2026-05-01",
      dimension: "joy",
      sessions: [buildSession()],
      entries: [buildEntry({ status: "saved", savedAt: "2026-05-01T11:00:00.000Z" })]
    });

    expect(result.status).toBe("mixed");
    expect(result.actions).toEqual(["continue_interview", "view_journal", "edit_saved_journal"]);
  });
});

describe("aggregateCalendarDay", () => {
  it("returns an empty day record when there are no sources", () => {
    const result = aggregateCalendarDay({
      date: "2026-05-01",
      sessions: [],
      entries: []
    });

    expect(result.overallStatus).toBe("empty");
    expect(result.dimensions).toHaveLength(5);
    expect(result.activeCount).toBe(0);
    expect(result.draftCount).toBe(0);
    expect(result.savedCount).toBe(0);
    expect(result.primaryAction).toBeNull();
  });

  it("promotes a single active dimension into an in-progress day", () => {
    const result = aggregateCalendarDay({
      date: "2026-05-01",
      sessions: [buildSession()],
      entries: []
    });

    expect(result.overallStatus).toBe("in_progress");
    expect(result.activeCount).toBe(1);
    expect(result.primaryAction).toBe("continue_interview");
  });

  it("keeps an opening-only session out of the in-progress state", () => {
    const result = aggregateCalendarDay({
      date: "2026-05-01",
      sessions: [buildSession({ messageCount: 1, draftSummary: null })],
      entries: []
    });

    expect(result.overallStatus).toBe("empty");
    expect(result.activeCount).toBe(0);
    expect(result.primaryAction).toBeNull();
  });

  it("promotes a single draft entry into a draft day", () => {
    const result = aggregateCalendarDay({
      date: "2026-05-01",
      sessions: [],
      entries: [buildEntry({ dimension: "reflection", title: "想法慢慢清楚" })]
    });

    expect(result.overallStatus).toBe("draft");
    expect(result.draftCount).toBe(1);
    expect(result.primaryTitle).toBe("想法慢慢清楚");
    expect(result.primaryAction).toBe("continue_editing");
  });

  it("promotes a single saved entry into a completed day", () => {
    const result = aggregateCalendarDay({
      date: "2026-05-01",
      sessions: [],
      entries: [buildEntry({ dimension: "gratitude", status: "saved", title: "被认真理解" })]
    });

    expect(result.overallStatus).toBe("completed");
    expect(result.savedCount).toBe(1);
    expect(result.primaryAction).toBe("view_journal");
  });

  it("adds daily journal status and marks it stale when saved sources changed", () => {
    const result = aggregateCalendarDay({
      date: "2026-05-01",
      sessions: [],
      entries: [buildEntry({ status: "saved", updatedAt: "2026-05-01T11:30:00.000Z" })],
      dailyJournals: [buildDailyJournal()]
    });

    expect(result.dailyJournal?.state).toBe("stale");
    expect(result.dailyJournal?.id).toBe("daily-1");
    expect(result.dailyJournal?.sourceEntryCount).toBe(1);
  });

  it("uses only the latest saved entry per dimension when checking daily journal staleness", () => {
    const result = aggregateCalendarDay({
      date: "2026-05-01",
      sessions: [],
      entries: [
        buildEntry({
          id: "entry-old",
          status: "saved",
          updatedAt: "2026-05-01T10:00:00.000Z"
        }),
        buildEntry({
          id: "entry-new",
          status: "saved",
          updatedAt: "2026-05-01T11:30:00.000Z"
        })
      ],
      dailyJournals: [
        buildDailyJournal({
          sourceEntryIds: ["entry-new"],
          sourceSignature: "entry-new:2026-05-01T11:30:00.000Z"
        })
      ]
    });

    expect(result.dailyJournal?.state).toBe("saved");
    expect(result.dailyJournal?.sourceEntryCount).toBe(1);
  });

  it("returns mixed when multiple dimensions carry different non-empty states", () => {
    const result = aggregateCalendarDay({
      date: "2026-05-01",
      sessions: [buildSession({ dimension: "fulfillment" })],
      entries: [
        buildEntry({ dimension: "joy", status: "saved", title: "和家人吃饭" }),
        buildEntry({ dimension: "improvement", status: "draft", title: "把节奏放稳" })
      ]
    });

    expect(result.overallStatus).toBe("mixed");
    expect(result.activeCount).toBe(1);
    expect(result.draftCount).toBe(1);
    expect(result.savedCount).toBe(1);
    expect(result.primaryAction).toBe("continue_interview");
  });
});

describe("aggregateCalendarWeek", () => {
  it("always returns 7 days and reuses day aggregation", () => {
    const result = aggregateCalendarWeek({
      anchorDate: "2026-05-07",
      sessions: [buildSession({ date: "2026-05-05" })],
      entries: [buildEntry({ date: "2026-05-07", status: "saved" })]
    });

    expect(result.days).toHaveLength(7);
    expect(result.weekStartDate).toBe("2026-05-04");
    expect(result.weekEndDate).toBe("2026-05-10");
    expect(result.days.find((day) => day.date === "2026-05-05")?.overallStatus).toBe("in_progress");
    expect(result.days.find((day) => day.date === "2026-05-07")?.overallStatus).toBe("completed");
  });
});

describe("aggregateCalendarMonth", () => {
  it("returns all real dates in the month and keeps daily results stable", () => {
    const result = aggregateCalendarMonth({
      month: "2026-02",
      sessions: [buildSession({ date: "2026-02-14", dimension: "gratitude" })],
      entries: [buildEntry({ date: "2026-02-20", dimension: "joy", status: "saved" })]
    });

    expect(result.days).toHaveLength(28);
    expect(result.days[0]?.date).toBe("2026-02-01");
    expect(result.days.at(-1)?.date).toBe("2026-02-28");
    expect(result.days.find((day) => day.date === "2026-02-14")?.overallStatus).toBe("in_progress");
    expect(result.days.find((day) => day.date === "2026-02-20")?.overallStatus).toBe("completed");
  });
});
