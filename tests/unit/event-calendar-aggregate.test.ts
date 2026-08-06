import {
  aggregateEventCalendarDay,
  aggregateEventCalendarMonth,
  aggregateEventCalendarWeek
} from "@/features/event-calendar/aggregate-event-calendar";
import { buildJournalDailySourceSignature } from "@/features/journal-daily/source-signature";
import type {
  EventCalendarDailyJournalSource,
  EventCalendarEventEntrySource,
  EventCalendarEventSource
} from "@/types/event-calendar";

function buildEvent(overrides: Partial<EventCalendarEventSource> = {}): EventCalendarEventSource {
  return {
    kind: "event",
    eventId: "event-1",
    rootSessionId: "root-1",
    activeBranchSessionId: "branch-1",
    entryDate: "2026-07-22",
    daySequence: 1,
    status: "active",
    startedAt: "2026-07-22T09:00:00.000Z",
    generationStartedAt: null,
    completedAt: null,
    updatedAt: "2026-07-22T10:00:00.000Z",
    ...overrides
  };
}

function buildEntry(overrides: Partial<EventCalendarEventEntrySource> = {}): EventCalendarEventEntrySource {
  return {
    kind: "event_entry",
    entryId: "entry-1",
    eventId: "event-1",
    entryDate: "2026-07-22",
    daySequence: 1,
    status: "saved",
    title: "把节奏放稳",
    content: "今天在一次具体的沟通里，发现自己慢下来以后能更清楚地表达。",
    contentRevision: 1,
    savedRevision: 1,
    savedAt: "2026-07-22T11:00:00.000Z",
    updatedAt: "2026-07-22T11:00:00.000Z",
    ...overrides
  };
}

function buildDailyJournal(
  overrides: Partial<EventCalendarDailyJournalSource> = {}
): EventCalendarDailyJournalSource {
  return {
    kind: "daily_journal",
    entryId: "daily-1",
    entryDate: "2026-07-22",
    status: "saved",
    title: "今天的两件事",
    content: "今天留下了两件值得回看的事。",
    sourceEntryIds: ["entry-1", "entry-2"],
    sourceEventIds: ["event-1", "event-2"],
    sourceSignature: buildJournalDailySourceSignature([
      { eventId: "event-1", entryId: "entry-1", daySequence: 1, savedRevision: 1 },
      { eventId: "event-2", entryId: "entry-2", daySequence: 2, savedRevision: 1 }
    ]),
    contentRevision: 1,
    savedRevision: 1,
    savedAt: "2026-07-22T14:00:00.000Z",
    updatedAt: "2026-07-22T14:00:00.000Z",
    ...overrides
  };
}

describe("aggregateEventCalendarDay", () => {
  it("为空白日期保留开始记录动作，不创建虚假的事件卡片", () => {
    const result = aggregateEventCalendarDay({
      date: "2026-07-22",
      events: [],
      entries: []
    });

    expect(result.overallStatus).toBe("empty");
    expect(result.events).toEqual([]);
    expect(result.dailyJournal.collection).toBe("empty");
    expect(result.primaryAction).toBe("start_event");
  });

  it("按 daySequence 展示活动事件，并把继续记录作为主动作", () => {
    const result = aggregateEventCalendarDay({
      date: "2026-07-22",
      events: [
        buildEvent({ eventId: "event-2", rootSessionId: "root-2", daySequence: 2 }),
        buildEvent({ eventId: "event-1", rootSessionId: "root-1", daySequence: 1 })
      ],
      entries: []
    });

    expect(result.events.map((event) => event.eventId)).toEqual(["event-1", "event-2"]);
    expect(result.overallStatus).toBe("in_progress");
    expect(result.activeEventCount).toBe(2);
    expect(result.primaryAction).toBe("continue_event");
  });

  it("为生成中的事件保留回到生成与失败恢复现场的直达动作", () => {
    const result = aggregateEventCalendarDay({
      date: "2026-07-22",
      events: [
        buildEvent({
          status: "generating",
          generationStartedAt: "2026-07-22T10:00:00.000Z"
        })
      ],
      entries: []
    });

    expect(result.overallStatus).toBe("generating");
    expect(result.events[0]?.actions).toEqual(["view_generation_state"]);
    expect(result.primaryAction).toBe("view_generation_state");
  });

  it("把已完成事件的草稿或修改日志标记为待保存", () => {
    const result = aggregateEventCalendarDay({
      date: "2026-07-22",
      events: [buildEvent({ status: "completed", completedAt: "2026-07-22T10:00:00.000Z" })],
      entries: [buildEntry({ status: "modified", savedRevision: 1, contentRevision: 2 })]
    });

    expect(result.events[0]?.state).toBe("modified");
    expect(result.overallStatus).toBe("draft");
    expect(result.pendingSaveEntryCount).toBe(1);
    expect(result.dailyJournal.pendingSave).toBe(true);
    expect(result.primaryAction).toBe("continue_event_entry_editing");
  });

  it("一篇有效已保存日志直接指向该事件日志", () => {
    const result = aggregateEventCalendarDay({
      date: "2026-07-22",
      events: [buildEvent({ status: "completed", completedAt: "2026-07-22T10:00:00.000Z" })],
      entries: [buildEntry()]
    });

    expect(result.overallStatus).toBe("completed");
    expect(result.savedEntryCount).toBe(1);
    expect(result.dailyJournal.collection).toBe("single_entry");
    expect(result.dailyJournal.directEntryId).toBe("entry-1");
    expect(result.primaryAction).toBe("view_event_entry");
  });

  it("多篇保存来源发生变化时标记需更新，并在存在待保存日志时阻塞更新", () => {
    const events = [
      buildEvent({ status: "completed", completedAt: "2026-07-22T10:00:00.000Z" }),
      buildEvent({
        eventId: "event-2",
        rootSessionId: "root-2",
        daySequence: 2,
        status: "completed",
        completedAt: "2026-07-22T12:00:00.000Z"
      }),
      buildEvent({
        eventId: "event-3",
        rootSessionId: "root-3",
        daySequence: 3,
        status: "completed",
        completedAt: "2026-07-22T13:00:00.000Z"
      })
    ];
    const savedEntries = [
      buildEntry(),
      buildEntry({ eventId: "event-2", entryId: "entry-2", daySequence: 2, contentRevision: 2, savedRevision: 2 })
    ];
    const result = aggregateEventCalendarDay({
      date: "2026-07-22",
      events,
      entries: [
        ...savedEntries,
        buildEntry({
          eventId: "event-3",
          entryId: "entry-3",
          daySequence: 3,
          status: "draft",
          savedRevision: null,
          savedAt: null
        })
      ],
      dailyJournals: [buildDailyJournal()]
    });

    expect(result.dailyJournal.collection).toBe("multiple_entries");
    expect(result.dailyJournal.freshness).toBe("stale");
    expect(result.dailyJournal.pendingSaveEntryIds).toEqual(["entry-3"]);
    expect(result.dailyJournal.updateBlockedByPendingSave).toBe(true);
    expect(result.dailyJournal.actions).toEqual([]);
  });

  it("来源过期且没有待保存日志时提供更新完整日志动作", () => {
    const result = aggregateEventCalendarDay({
      date: "2026-07-22",
      events: [
        buildEvent({ status: "completed", completedAt: "2026-07-22T10:00:00.000Z" }),
        buildEvent({
          eventId: "event-2",
          rootSessionId: "root-2",
          daySequence: 2,
          status: "completed",
          completedAt: "2026-07-22T12:00:00.000Z"
        })
      ],
      entries: [
        buildEntry(),
        buildEntry({ eventId: "event-2", entryId: "entry-2", daySequence: 2, contentRevision: 2, savedRevision: 2 })
      ],
      dailyJournals: [buildDailyJournal()]
    });

    expect(result.dailyJournal.freshness).toBe("stale");
    expect(result.dailyJournal.actions).toEqual(["update_daily_journal"]);
  });
});

describe("aggregateEventCalendarWeek / aggregateEventCalendarMonth", () => {
  it("在周和月读取中复用同一日级投影", () => {
    const sources = {
      events: [
        buildEvent({
          entryDate: "2026-07-21",
          status: "completed",
          completedAt: "2026-07-21T10:00:00.000Z"
        })
      ],
      entries: [buildEntry({ entryDate: "2026-07-21" })]
    };
    const week = aggregateEventCalendarWeek({ anchorDate: "2026-07-22", ...sources });
    const month = aggregateEventCalendarMonth({ month: "2026-07", ...sources });

    expect(week.days).toHaveLength(7);
    expect(week.weekStartDate).toBe("2026-07-20");
    expect(week.days.find((day) => day.date === "2026-07-21")?.overallStatus).toBe("completed");
    expect(month.days).toHaveLength(31);
    expect(month.days.find((day) => day.date === "2026-07-21")?.dailyJournal.collection).toBe("single_entry");
  });
});
