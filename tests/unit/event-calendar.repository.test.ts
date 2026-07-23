import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockJournalEventFindMany, mockJournalDailyEntryFindMany } = vi.hoisted(() => ({
  mockJournalEventFindMany: vi.fn(),
  mockJournalDailyEntryFindMany: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    journalEvent: { findMany: mockJournalEventFindMany },
    journalDailyEntry: { findMany: mockJournalDailyEntryFindMany }
  }
}));

import { listEventCalendarSourcesByDateRange } from "@/server/repositories/event-calendar.repository";

describe("event-calendar.repository", () => {
  beforeEach(() => {
    mockJournalEventFindMany.mockReset();
    mockJournalDailyEntryFindMany.mockReset();
  });

  it("只投影可见事件链和事件中心完整日志，保留 daySequence", async () => {
    mockJournalEventFindMany.mockResolvedValue([
      {
        id: "event-1",
        rootSessionId: "root-1",
        entryDate: new Date("2026-07-21T16:00:00.000Z"),
        daySequence: 2,
        status: "completed",
        startedAt: new Date("2026-07-22T01:00:00.000Z"),
        generationStartedAt: new Date("2026-07-22T01:10:00.000Z"),
        completedAt: new Date("2026-07-22T01:12:00.000Z"),
        updatedAt: new Date("2026-07-22T01:12:00.000Z"),
        rootSession: { activeBranchSessionId: "branch-1" },
        entry: {
          id: "entry-1",
          title: "把节奏放稳",
          content: "今天在一次具体的沟通里慢下来。",
          status: "saved",
          contentRevision: 2,
          savedRevision: 2,
          savedAt: new Date("2026-07-22T01:14:00.000Z"),
          updatedAt: new Date("2026-07-22T01:14:00.000Z")
        }
      },
      {
        id: "event-hidden",
        rootSessionId: "root-hidden",
        entryDate: new Date("2026-07-21T16:00:00.000Z"),
        daySequence: 1,
        status: "abandoned",
        startedAt: new Date("2026-07-22T00:00:00.000Z"),
        generationStartedAt: null,
        completedAt: null,
        updatedAt: new Date("2026-07-22T00:10:00.000Z"),
        rootSession: { activeBranchSessionId: null },
        entry: null
      }
    ]);
    mockJournalDailyEntryFindMany.mockResolvedValue([
      {
        id: "daily-1",
        entryDate: new Date("2026-07-21T16:00:00.000Z"),
        title: "今天的两件事",
        content: "两件事并排留下。",
        status: "saved",
        sourceEntryIds: ["entry-1", "entry-2"],
        sourceEventIds: ["event-1", "event-2"],
        sourceSignature: "v1|sources",
        sourceUpdatedAt: new Date("2026-07-22T01:14:00.000Z"),
        contentRevision: 1,
        savedRevision: 1,
        savedAt: new Date("2026-07-22T02:00:00.000Z"),
        updatedAt: new Date("2026-07-22T02:00:00.000Z")
      }
    ]);

    const result = await listEventCalendarSourcesByDateRange({
      userId: "user-1",
      startDate: "2026-07-22",
      endDate: "2026-07-22"
    });

    expect(mockJournalEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          status: { not: "abandoned" },
          entryDate: {
            gte: new Date("2026-07-21T16:00:00.000Z"),
            lt: new Date("2026-07-22T16:00:00.000Z")
          }
        })
      })
    );
    expect(result.events).toEqual([
      expect.objectContaining({
        eventId: "event-1",
        rootSessionId: "root-1",
        activeBranchSessionId: "branch-1",
        entryDate: "2026-07-22",
        daySequence: 2,
        status: "completed"
      })
    ]);
    expect(result.entries).toEqual([
      expect.objectContaining({
        entryId: "entry-1",
        eventId: "event-1",
        status: "saved",
        savedRevision: 2
      })
    ]);
    expect(result.dailyJournals).toEqual([
      expect.objectContaining({
        entryId: "daily-1",
        entryDate: "2026-07-22",
        status: "saved"
      })
    ]);
  });
});
