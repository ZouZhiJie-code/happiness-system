const { mockJoyEntryFindMany, mockDailyJournalFindMany } = vi.hoisted(() => ({
  mockJoyEntryFindMany: vi.fn(),
  mockDailyJournalFindMany: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    joyEntry: {
      findMany: mockJoyEntryFindMany
    },
    dailyJournalEntry: {
      findMany: mockDailyJournalFindMany
    }
  }
}));

import { listAnalysisSourcesByDateRange } from "@/server/repositories/analysis.repository";

describe("analysis.repository", () => {
  beforeEach(() => {
    mockJoyEntryFindMany.mockReset();
    mockDailyJournalFindMany.mockReset();
  });

  it("maps saved journal and daily journal sources for analysis", async () => {
    mockJoyEntryFindMany.mockResolvedValue([
      {
        id: "entry-joy",
        date: new Date("2026-05-01T16:00:00.000Z"),
        tags: ["关系型开心"],
        payload: {
          kind: "joy",
          joyMoment: "晚饭时被接住",
          joySource: "被家人的陪伴接住了",
          stateShift: "从紧绷变松",
          meaningNeed: "连接感",
          manualClue: "慢下来相处时，我会恢复能量",
          delightSignature: null,
          directionSignal: null,
          valueImpact: null,
          durability: null,
          tags: ["关系型开心"]
        },
        savedAt: new Date("2026-05-02T12:00:00.000Z"),
        updatedAt: new Date("2026-05-02T11:30:00.000Z"),
        session: {
          dimension: "joy"
        }
      },
      {
        id: "entry-invalid",
        date: new Date("2026-05-02T16:00:00.000Z"),
        tags: [],
        payload: null,
        savedAt: null,
        updatedAt: new Date("2026-05-03T11:30:00.000Z"),
        session: null
      }
    ]);
    mockDailyJournalFindMany.mockResolvedValue([
      {
        id: "daily-journal-saved",
        date: new Date("2026-05-03T16:00:00.000Z"),
        sourceSignature: "entry-joy:2026-05-02T11:30:00.000Z"
      }
    ]);

    const result = await listAnalysisSourcesByDateRange({
      startDate: "2026-05-02",
      endDate: "2026-05-04"
    });

    expect(mockJoyEntryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "local-demo-user",
          status: "saved",
          date: {
            gte: new Date("2026-05-01T16:00:00.000Z"),
            lt: new Date("2026-05-04T16:00:00.000Z")
          }
        })
      })
    );
    expect(mockDailyJournalFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "local-demo-user",
          status: "saved",
          date: {
            gte: new Date("2026-05-01T16:00:00.000Z"),
            lt: new Date("2026-05-04T16:00:00.000Z")
          }
        })
      })
    );
    expect(result.entries).toEqual([
      {
        id: "entry-joy",
        date: "2026-05-02",
        dimension: "joy",
        tags: ["关系型开心"],
        payload: {
          kind: "joy",
          joyMoment: "晚饭时被接住",
          joySource: "被家人的陪伴接住了",
          stateShift: "从紧绷变松",
          meaningNeed: "连接感",
          manualClue: "慢下来相处时，我会恢复能量",
          delightSignature: null,
          directionSignal: null,
          valueImpact: null,
          durability: null,
          tags: ["关系型开心"]
        },
        savedAt: "2026-05-02T12:00:00.000Z",
        updatedAt: "2026-05-02T11:30:00.000Z"
      }
    ]);
    expect(result.dailyJournals).toEqual([
      {
        id: "daily-journal-saved",
        date: "2026-05-04",
        sourceSignature: "entry-joy:2026-05-02T11:30:00.000Z",
        title: null,
        content: null
      }
    ]);
  });
});
