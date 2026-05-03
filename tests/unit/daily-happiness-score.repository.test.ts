const {
  mockDailyHappinessScoreFindMany,
  mockDailyHappinessScoreFindUnique,
  mockDailyHappinessScoreUpsert,
  mockUserUpsert
} = vi.hoisted(() => ({
  mockDailyHappinessScoreFindMany: vi.fn(),
  mockDailyHappinessScoreFindUnique: vi.fn(),
  mockDailyHappinessScoreUpsert: vi.fn(),
  mockUserUpsert: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    user: {
      upsert: mockUserUpsert
    },
    dailyHappinessScore: {
      findMany: mockDailyHappinessScoreFindMany,
      findUnique: mockDailyHappinessScoreFindUnique,
      upsert: mockDailyHappinessScoreUpsert
    }
  }
}));

import {
  findDailyHappinessScoreByDate,
  listDailyHappinessScoresByDateRange,
  mapDailyHappinessScore,
  upsertDailyHappinessScore
} from "@/server/repositories/daily-happiness-score.repository";

describe("daily happiness score repository", () => {
  beforeEach(() => {
    mockUserUpsert.mockReset();
    mockDailyHappinessScoreFindMany.mockReset();
    mockDailyHappinessScoreFindUnique.mockReset();
    mockDailyHappinessScoreUpsert.mockReset();
  });

  it("maps a prisma entry into a daily happiness score record", () => {
    expect(
      mapDailyHappinessScore({
        id: "score-1",
        date: new Date("2026-05-02T16:00:00.000Z"),
        meaningScore: 8,
        healthScore: 7,
        virtueScore: 9,
        autonomyScore: 6,
        interestScore: 8,
        skillScore: 7,
        relationshipScore: 9,
        livingConditionScore: 6,
        createdAt: new Date("2026-05-03T01:00:00.000Z"),
        updatedAt: new Date("2026-05-03T02:00:00.000Z")
      })
    ).toEqual({
      id: "score-1",
      date: "2026-05-03",
      meaningScore: 8,
      healthScore: 7,
      virtueScore: 9,
      autonomyScore: 6,
      interestScore: 8,
      skillScore: 7,
      relationshipScore: 9,
      livingConditionScore: 6,
      createdAt: "2026-05-03T01:00:00.000Z",
      updatedAt: "2026-05-03T02:00:00.000Z"
    });
  });

  it("finds a score by date through the userId_date unique key", async () => {
    mockDailyHappinessScoreFindUnique.mockResolvedValue({
      id: "score-1",
      date: new Date("2026-05-02T16:00:00.000Z"),
      meaningScore: 8,
      healthScore: 7,
      virtueScore: 9,
      autonomyScore: 6,
      interestScore: 8,
      skillScore: 7,
      relationshipScore: 9,
      livingConditionScore: 6,
      createdAt: new Date("2026-05-03T01:00:00.000Z"),
      updatedAt: new Date("2026-05-03T02:00:00.000Z")
    });

    const result = await findDailyHappinessScoreByDate("2026-05-03");

    expect(mockDailyHappinessScoreFindUnique).toHaveBeenCalledWith({
      where: {
        userId_date: {
          userId: "local-demo-user",
          date: new Date("2026-05-02T16:00:00.000Z")
        }
      }
    });
    expect(result?.date).toBe("2026-05-03");
  });

  it("lists scores by an inclusive date range", async () => {
    mockDailyHappinessScoreFindMany.mockResolvedValue([
      {
        id: "score-1",
        date: new Date("2026-05-01T16:00:00.000Z"),
        meaningScore: 8,
        healthScore: 7,
        virtueScore: 9,
        autonomyScore: 6,
        interestScore: 8,
        skillScore: 7,
        relationshipScore: 9,
        livingConditionScore: 6,
        createdAt: new Date("2026-05-02T01:00:00.000Z"),
        updatedAt: new Date("2026-05-02T02:00:00.000Z")
      }
    ]);

    const result = await listDailyHappinessScoresByDateRange({
      startDate: "2026-05-01",
      endDate: "2026-05-31"
    });

    expect(mockDailyHappinessScoreFindMany).toHaveBeenCalledWith({
      where: {
        userId: "local-demo-user",
        date: {
          gte: new Date("2026-04-30T16:00:00.000Z"),
          lte: new Date("2026-05-30T16:00:00.000Z")
        }
      },
      orderBy: {
        date: "asc"
      }
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.date).toBe("2026-05-02");
  });

  it("upserts a score using explicit integer fields", async () => {
    mockDailyHappinessScoreUpsert.mockResolvedValue({
      id: "score-2",
      date: new Date("2026-05-03T16:00:00.000Z"),
      meaningScore: 9,
      healthScore: 8,
      virtueScore: 8,
      autonomyScore: 7,
      interestScore: 9,
      skillScore: 8,
      relationshipScore: 9,
      livingConditionScore: 7,
      createdAt: new Date("2026-05-04T01:00:00.000Z"),
      updatedAt: new Date("2026-05-04T02:00:00.000Z")
    });

    const result = await upsertDailyHappinessScore({
      date: "2026-05-04",
      meaningScore: 9,
      healthScore: 8,
      virtueScore: 8,
      autonomyScore: 7,
      interestScore: 9,
      skillScore: 8,
      relationshipScore: 9,
      livingConditionScore: 7
    });

    expect(mockDailyHappinessScoreUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_date: {
            userId: "local-demo-user",
            date: new Date("2026-05-03T16:00:00.000Z")
          }
        },
        update: expect.objectContaining({
          meaningScore: 9,
          relationshipScore: 9
        }),
        create: expect.objectContaining({
          userId: "local-demo-user",
          skillScore: 8,
          livingConditionScore: 7
        })
      })
    );
    expect(mockUserUpsert).toHaveBeenCalledWith({
      where: { id: "local-demo-user" },
      update: {},
      create: { id: "local-demo-user" }
    });
    expect(result?.date).toBe("2026-05-04");
  });
});
