const { mockInterviewSessionFindMany, mockJoyEntryFindMany, mockDailyJournalFindMany } = vi.hoisted(() => ({
  mockInterviewSessionFindMany: vi.fn(),
  mockJoyEntryFindMany: vi.fn(),
  mockDailyJournalFindMany: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    interviewSession: {
      findMany: mockInterviewSessionFindMany
    },
    joyEntry: {
      findMany: mockJoyEntryFindMany
    },
    dailyJournalEntry: {
      findMany: mockDailyJournalFindMany
    }
  }
}));

import { listCalendarSourcesByDateRange } from "@/server/repositories/calendar.repository";

describe("calendar.repository", () => {
  beforeEach(() => {
    mockInterviewSessionFindMany.mockReset();
    mockJoyEntryFindMany.mockReset();
    mockDailyJournalFindMany.mockReset();
  });

  it("maps sessions and entries into calendar sources", async () => {
    mockInterviewSessionFindMany.mockResolvedValue([
      {
        id: "session-active",
        dimension: "joy",
        entryDate: new Date("2026-05-01T16:00:00.000Z"),
        status: "active",
        startedAt: new Date("2026-05-02T01:00:00.000Z"),
        completedAt: null,
        pausedAt: null,
        draftSummary: "今天这段开心已经有点成形了。",
        finalEntryId: null,
        messages: [
          {
            createdAt: new Date("2026-05-02T04:00:00.000Z")
          }
        ]
      },
      {
        id: "session-abandoned",
        dimension: "reflection",
        entryDate: new Date("2026-05-01T16:00:00.000Z"),
        status: "abandoned",
        startedAt: new Date("2026-05-02T01:00:00.000Z"),
        completedAt: null,
        pausedAt: null,
        draftSummary: null,
        finalEntryId: null,
        messages: []
      }
    ]);
    mockDailyJournalFindMany.mockResolvedValue([]);

    mockJoyEntryFindMany.mockResolvedValue([
      {
        id: "entry-draft",
        sessionId: "session-active",
        date: new Date("2026-05-01T16:00:00.000Z"),
        status: "draft",
        title: "被稳稳接住",
        content: "今天和家人一起吃饭聊天，整个人慢慢放松下来。",
        updatedAt: new Date("2026-05-02T02:00:00.000Z"),
        savedAt: null,
        session: {
          dimension: "joy"
        }
      },
      {
        id: "entry-invalid",
        sessionId: "missing-session",
        date: new Date("2026-05-01T16:00:00.000Z"),
        status: "saved",
        title: "不该进入结果",
        content: "这条数据缺少维度关联。",
        updatedAt: new Date("2026-05-02T02:00:00.000Z"),
        savedAt: new Date("2026-05-02T03:00:00.000Z"),
        session: null
      }
    ]);

    const result = await listCalendarSourcesByDateRange({
      userId: "user-1",
      startDate: "2026-05-02",
      endDate: "2026-05-02"
    });

    expect(mockInterviewSessionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          entryDate: {
            gte: new Date("2026-05-01T16:00:00.000Z"),
            lt: new Date("2026-05-02T16:00:00.000Z")
          }
        })
      })
    );
    expect(mockJoyEntryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          date: {
            gte: new Date("2026-05-01T16:00:00.000Z"),
            lt: new Date("2026-05-02T16:00:00.000Z")
          }
        })
      })
    );
    expect(result.sessions).toEqual([
      {
        kind: "session",
        id: "session-active",
        dimension: "joy",
        date: "2026-05-02",
        status: "active",
        updatedAt: "2026-05-02T04:00:00.000Z",
        startedAt: "2026-05-02T01:00:00.000Z",
        completedAt: null,
        pausedAt: null,
        draftSummary: "今天这段开心已经有点成形了。",
        journalEntryId: null
      }
    ]);
    expect(result.entries).toEqual([
      {
        kind: "entry",
        id: "entry-draft",
        sessionId: "session-active",
        dimension: "joy",
        date: "2026-05-02",
        status: "draft",
        title: "被稳稳接住",
        content: "今天和家人一起吃饭聊天，整个人慢慢放松下来。",
        updatedAt: "2026-05-02T02:00:00.000Z",
        savedAt: null
      }
    ]);
  });

  it("falls back to startedAt when a legacy session has no entryDate", async () => {
    mockInterviewSessionFindMany.mockResolvedValue([
      {
        id: "session-legacy",
        dimension: "reflection",
        entryDate: null,
        status: "paused",
        startedAt: new Date("2026-05-02T09:00:00.000Z"),
        completedAt: null,
        pausedAt: new Date("2026-05-02T10:00:00.000Z"),
        draftSummary: "这条旧会话还没有 entryDate。",
        finalEntryId: null,
        messages: []
      }
    ]);
    mockJoyEntryFindMany.mockResolvedValue([]);
    mockDailyJournalFindMany.mockResolvedValue([]);

    const result = await listCalendarSourcesByDateRange({
      userId: "user-1",
      startDate: "2026-05-02",
      endDate: "2026-05-02"
    });

    expect(result.sessions).toEqual([
      {
        kind: "session",
        id: "session-legacy",
        dimension: "reflection",
        date: "2026-05-02",
        status: "paused",
        updatedAt: "2026-05-02T10:00:00.000Z",
        startedAt: "2026-05-02T09:00:00.000Z",
        completedAt: null,
        pausedAt: "2026-05-02T10:00:00.000Z",
        draftSummary: "这条旧会话还没有 entryDate。",
        journalEntryId: null
      }
    ]);
  });
});
