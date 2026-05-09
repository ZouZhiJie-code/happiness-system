import { vi, describe, it, expect, beforeEach } from "vitest";

// ─── Mocks (vi.hoisted) ──────────────────────────────────────────────────

const {
  mockFindAllMemoryFacts,
  mockListCalendarSourcesByDateRange,
  mockListAnalysisSourcesByDateRange,
  mockListDailyHappinessScoresByDateRange
} = vi.hoisted(() => ({
  mockFindAllMemoryFacts: vi.fn(),
  mockListCalendarSourcesByDateRange: vi.fn(),
  mockListAnalysisSourcesByDateRange: vi.fn(),
  mockListDailyHappinessScoresByDateRange: vi.fn()
}));

vi.mock("@/server/repositories/memory.repository", () => ({
  findAllMemoryFacts: mockFindAllMemoryFacts
}));
vi.mock("@/server/repositories/calendar.repository", () => ({
  listCalendarSourcesByDateRange: mockListCalendarSourcesByDateRange
}));
vi.mock("@/server/repositories/analysis.repository", () => ({
  listAnalysisSourcesByDateRange: mockListAnalysisSourcesByDateRange
}));
vi.mock("@/server/repositories/daily-happiness-score.repository", () => ({
  listDailyHappinessScoresByDateRange: mockListDailyHappinessScoresByDateRange
}));

// ─── Import after mocks ──────────────────────────────────────────────────

import { gatherPortraitData } from "@/server/services/portrait/portrait-data.service";

describe("portrait-data.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindAllMemoryFacts.mockResolvedValue([]);
    mockListCalendarSourcesByDateRange.mockResolvedValue({
      sessions: [],
      entries: [],
      dailyJournals: []
    });
    mockListAnalysisSourcesByDateRange.mockResolvedValue({
      entries: [],
      dailyJournals: []
    });
    mockListDailyHappinessScoresByDateRange.mockResolvedValue([]);
  });

  it("returns aggregated data with correct structure", async () => {
    const result = await gatherPortraitData("test-user");

    expect(result).toHaveProperty("facts");
    expect(result).toHaveProperty("calendarSummary");
    expect(result).toHaveProperty("analysisSummary");
    expect(result).toHaveProperty("scoreTrend");
    expect(result).toHaveProperty("interviewMeta");
  });

  it("computes calendar dimension frequency from sessions", async () => {
    mockListCalendarSourcesByDateRange.mockResolvedValue({
      sessions: [
        { id: "s1", dimension: "joy", status: "completed", date: "2026-05-01" },
        { id: "s2", dimension: "joy", status: "completed", date: "2026-05-02" },
        { id: "s3", dimension: "reflection", status: "completed", date: "2026-05-03" }
      ],
      entries: [],
      dailyJournals: []
    });

    const result = await gatherPortraitData("test-user");

    expect(result.calendarSummary.dimensionFrequency.joy).toBe(2);
    expect(result.calendarSummary.dimensionFrequency.reflection).toBe(1);
    expect(result.calendarSummary.totalRecordDays).toBe(3);
  });

  it("computes interview meta from sessions", async () => {
    mockListCalendarSourcesByDateRange.mockResolvedValue({
      sessions: [
        { id: "s1", dimension: "joy", status: "completed", date: "2026-05-01", startedAt: "2026-05-01T00:00:00.000Z" },
        { id: "s2", dimension: "fulfillment", status: "completed", date: "2026-05-02", startedAt: "2026-05-02T00:00:00.000Z" }
      ],
      entries: [],
      dailyJournals: []
    });

    const result = await gatherPortraitData("test-user");

    expect(result.interviewMeta.totalSessions).toBe(2);
    expect(result.interviewMeta.dimensionCoverage).toContain("joy");
    expect(result.interviewMeta.dimensionCoverage).toContain("fulfillment");
  });

  it("computes score trend from happiness scores", async () => {
    mockListDailyHappinessScoresByDateRange.mockResolvedValue([
      {
        date: "2026-05-01",
        meaningScore: 7,
        healthScore: 6,
        virtueScore: 5,
        autonomyScore: 8,
        interestScore: 7,
        skillScore: 6,
        relationshipScore: 7,
        livingConditionScore: 6
      },
      {
        date: "2026-05-02",
        meaningScore: 8,
        healthScore: 7,
        virtueScore: 6,
        autonomyScore: 7,
        interestScore: 8,
        skillScore: 7,
        relationshipScore: 8,
        livingConditionScore: 7
      }
    ]);

    const result = await gatherPortraitData("test-user");

    expect(result.scoreTrend.days).toBe(2);
    expect(result.scoreTrend.latest).toBeDefined();
    expect(result.scoreTrend.trend).toBeDefined();
  });
});
