const { mockJoyEntryFindMany } = vi.hoisted(() => ({
  mockJoyEntryFindMany: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    joyEntry: {
      findMany: mockJoyEntryFindMany
    }
  }
}));

import { listSavedJournalEntriesForDailyJournal } from "@/server/repositories/daily-journal.repository";

describe("daily-journal.repository", () => {
  beforeEach(() => {
    mockJoyEntryFindMany.mockReset();
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

    const result = await listSavedJournalEntriesForDailyJournal("2026-05-02");

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

    await listSavedJournalEntriesForDailyJournal("2026-05-01");

    expect(mockJoyEntryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "local-demo-user",
          status: "saved",
          date: {
            gte: new Date("2026-04-30T16:00:00.000Z"),
            lt: new Date("2026-05-01T16:00:00.000Z")
          }
        })
      })
    );
  });
});
