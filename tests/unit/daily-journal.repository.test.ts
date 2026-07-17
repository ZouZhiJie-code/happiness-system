const { mockDailyJournalFindUnique, mockDailyJournalUpdate, mockJoyEntryFindMany } = vi.hoisted(() => ({
  mockDailyJournalFindUnique: vi.fn(),
  mockDailyJournalUpdate: vi.fn(),
  mockJoyEntryFindMany: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    dailyJournalEntry: {
      findUnique: mockDailyJournalFindUnique,
      update: mockDailyJournalUpdate
    },
    joyEntry: {
      findMany: mockJoyEntryFindMany
    }
  }
}));

import {
  findDailyJournalByDate,
  listSavedJournalEntriesForDailyJournal,
  markDailyJournalSaved
} from "@/server/repositories/daily-journal.repository";

describe("daily-journal.repository", () => {
  beforeEach(() => {
    mockJoyEntryFindMany.mockReset();
    mockDailyJournalFindUnique.mockReset();
    mockDailyJournalUpdate.mockReset();
  });

  it("keeps only the latest saved entry per dimension for a daily journal", async () => {
    mockJoyEntryFindMany.mockResolvedValue([
      {
        id: "entry-joy-old",
        sessionId: "session-joy-old",
        date: new Date("2026-05-02T00:00:00.000Z"),
        title: "旧开心",
        content: "旧内容",
        updatedAt: new Date("2026-05-02T03:00:00.000Z"),
        savedAt: new Date("2026-05-02T03:00:00.000Z"),
        session: {
          dimension: "joy"
        }
      },
      {
        id: "entry-joy-new",
        sessionId: "session-joy-new",
        date: new Date("2026-05-02T00:00:00.000Z"),
        title: "新开心",
        content: "新内容",
        updatedAt: new Date("2026-05-02T04:00:00.000Z"),
        savedAt: new Date("2026-05-02T04:00:00.000Z"),
        session: {
          dimension: "joy"
        }
      },
      {
        id: "entry-gratitude",
        sessionId: "session-gratitude",
        date: new Date("2026-05-02T00:00:00.000Z"),
        title: "感谢",
        content: "感谢内容",
        updatedAt: new Date("2026-05-02T05:00:00.000Z"),
        savedAt: new Date("2026-05-02T05:00:00.000Z"),
        session: {
          dimension: "gratitude"
        }
      }
    ]);

    const result = await listSavedJournalEntriesForDailyJournal("user-1", "2026-05-02");

    expect(result).toEqual([
      {
        id: "entry-joy-new",
        sessionId: "session-joy-new",
        dimension: "joy",
        date: "2026-05-02",
        title: "新开心",
        content: "新内容",
        updatedAt: "2026-05-02T04:00:00.000Z",
        savedAt: "2026-05-02T04:00:00.000Z"
      },
      {
        id: "entry-gratitude",
        sessionId: "session-gratitude",
        dimension: "gratitude",
        date: "2026-05-02",
        title: "感谢",
        content: "感谢内容",
        updatedAt: "2026-05-02T05:00:00.000Z",
        savedAt: "2026-05-02T05:00:00.000Z"
      }
    ]);
  });

  it("queries a full Shanghai day window instead of matching one exact timestamp", async () => {
    mockJoyEntryFindMany.mockResolvedValue([]);

    await listSavedJournalEntriesForDailyJournal("user-1", "2026-05-01");

    expect(mockJoyEntryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          status: "saved",
          date: {
            gte: new Date("2026-04-30T16:00:00.000Z"),
            lt: new Date("2026-05-01T16:00:00.000Z")
          }
        })
      })
    );
  });

  it("derives modified for an autosaved edit while keeping the journal saved", async () => {
    mockDailyJournalFindUnique.mockResolvedValue({
      id: "daily-1",
      date: new Date("2026-05-01T00:00:00.000Z"),
      title: "修改后的标题",
      content: "修改后的正文",
      status: "saved",
      sourceEntryIds: ["entry-1"],
      sourceSessionIds: ["session-1"],
      sourceSignature: "signature",
      sourceUpdatedAt: new Date("2026-05-01T01:00:00.000Z"),
      updatedAt: new Date("2026-05-01T03:00:00.000Z"),
      savedAt: new Date("2026-05-01T02:00:00.000Z")
    });

    const result = await findDailyJournalByDate("user-1", "2026-05-01");

    expect(result).toMatchObject({ status: "saved", confirmationState: "modified" });
  });

  it("refreshes the confirmation timestamp when a modified journal is confirmed again", async () => {
    mockDailyJournalUpdate.mockImplementation(async ({ data }: { data: { savedAt: Date; updatedAt: Date } }) => ({
      id: "daily-1",
      date: new Date("2026-05-01T00:00:00.000Z"),
      title: "修改后的标题",
      content: "修改后的正文",
      status: "saved",
      sourceEntryIds: ["entry-1"],
      sourceSessionIds: ["session-1"],
      sourceSignature: "signature",
      sourceUpdatedAt: new Date("2026-05-01T01:00:00.000Z"),
      updatedAt: data.updatedAt,
      savedAt: data.savedAt
    }));

    const result = await markDailyJournalSaved("daily-1");

    expect(result).toMatchObject({ status: "saved", confirmationState: "confirmed" });
    expect(mockDailyJournalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          savedAt: expect.any(Date),
          updatedAt: expect.any(Date)
        })
      })
    );
  });
});
