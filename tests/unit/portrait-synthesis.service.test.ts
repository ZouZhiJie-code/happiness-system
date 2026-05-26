import type { InterviewDimension, MemoryFact } from "@prisma/client";

// ─── Mocks (vi.hoisted) ──────────────────────────────────────────────────

const { mockGatherPortraitData } = vi.hoisted(() => ({
  mockGatherPortraitData: vi.fn()
}));

const { mockGetAIProvider } = vi.hoisted(() => ({
  mockGetAIProvider: vi.fn()
}));

const { mockFindLatestPortraitSnapshot, mockCreatePortraitSnapshot } = vi.hoisted(() => ({
  mockFindLatestPortraitSnapshot: vi.fn(),
  mockCreatePortraitSnapshot: vi.fn()
}));

const { mockCompleteStructuredOutput } = vi.hoisted(() => ({
  mockCompleteStructuredOutput: vi.fn()
}));

vi.mock("@/server/services/portrait/portrait-data.service", () => ({
  gatherPortraitData: mockGatherPortraitData
}));

vi.mock("@/server/services/ai", () => ({
  getAIProvider: mockGetAIProvider
}));

vi.mock("@/server/repositories/memory.repository", () => ({
  findLatestPortraitSnapshot: mockFindLatestPortraitSnapshot,
  createPortraitSnapshot: mockCreatePortraitSnapshot
}));

vi.mock("@/server/services/ai/structured-output", () => ({
  completeStructuredOutput: mockCompleteStructuredOutput
}));

// ─── Import after mocks ──────────────────────────────────────────────────

import {
  getPortraitSnapshot,
  synthesizePortrait
} from "@/server/services/portrait/portrait-synthesis.service";

// ─── Test Data ───────────────────────────────────────────────────────────

const USER_ID = "test-user-1";

function buildFact(overrides?: Partial<MemoryFact>): MemoryFact {
  return {
    id: "mem-1",
    userId: USER_ID,
    dimension: "joy" as InterviewDimension,
    kind: "preference",
    topicTags: ["test"],
    summary: "test fact",
    sourceType: "ai_extracted",
    confidence: 0.8,
    evidenceEntryIds: [],
    evidenceSessionIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastUsedAt: null,
    deletedAt: null,
    embedding: null,
    ...overrides
  } as MemoryFact;
}

function buildPortraitData(factCount: number) {
  const facts = Array.from({ length: factCount }, (_, i) =>
    buildFact({ id: `mem-${i}`, summary: `fact ${i}` })
  );
  return {
    facts,
    calendarSummary: {
      dimensionFrequency: {
        joy: 2,
        fulfillment: 1,
        reflection: 1,
        improvement: 0,
        gratitude: 0
      } as Record<InterviewDimension, number>,
      totalRecordDays: 10,
      recentMonthRecordDays: 5
    },
    analysisSummary: {
      recentMonths: 3,
      totalSavedEntries: 8,
      dimensionBreakdown: {
        joy: 2,
        fulfillment: 2,
        reflection: 2,
        improvement: 1,
        gratitude: 1
      } as Record<InterviewDimension, number>
    },
    scoreTrend: {
      days: 7,
      average: { meaningScore: 7.5 },
      latest: { meaningScore: 8.0 },
      trend: "rising" as const
    },
    interviewMeta: {
      totalSessions: 5,
      dimensionCoverage: ["joy", "fulfillment", "reflection"] as InterviewDimension[],
      dateRange: { first: "2026-03-01", last: "2026-05-01" }
    }
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe("portrait-synthesis.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPortraitSnapshot", () => {
    it("returns cached snapshot when available", async () => {
      const cached = {
        id: "snap-1",
        userId: USER_ID,
        summary: "cached summary",
        dimensionInsights: { joy: "insight" },
        factCount: 5,
        dataRangeMonths: 3,
        generatedAt: new Date()
      };
      mockFindLatestPortraitSnapshot.mockResolvedValue(cached);

      const result = await getPortraitSnapshot(USER_ID);

      expect(result).toBe(cached);
      expect(mockFindLatestPortraitSnapshot).toHaveBeenCalledWith(USER_ID);
    });

    it("returns null when no cache exists", async () => {
      mockFindLatestPortraitSnapshot.mockResolvedValue(null);

      const result = await getPortraitSnapshot(USER_ID);

      expect(result).toBeNull();
    });
  });

  describe("synthesizePortrait", () => {
    beforeEach(() => {
      mockGetAIProvider.mockReturnValue({ name: "mock" });
      mockGatherPortraitData.mockResolvedValue(buildPortraitData(5));
    });

    it("returns null when fewer than 3 facts", async () => {
      mockGatherPortraitData.mockResolvedValue(buildPortraitData(2));

      const result = await synthesizePortrait(USER_ID);

      expect(result).toBeNull();
    });

    it("calls AI to generate summary and dimension insights and returns result", async () => {
      mockCompleteStructuredOutput
        .mockResolvedValueOnce({ summary: "cross-dimensional summary" })
        .mockResolvedValueOnce({ insight: "joy insight" })
        .mockResolvedValueOnce({ insight: "fulfillment insight" })
        .mockResolvedValueOnce({ insight: "reflection insight" })
        .mockResolvedValueOnce({ insight: "improvement insight" })
        .mockResolvedValueOnce({ insight: "gratitude insight" });

      const result = await synthesizePortrait(USER_ID);

      expect(result).not.toBeNull();
      expect(mockGetAIProvider).toHaveBeenCalledWith("chat");
      expect(result!.summary).toBe("cross-dimensional summary");
      expect(result!.dimensionInsights.joy).toBe("joy insight");
      expect(result!.dimensionInsights.fulfillment).toBe("fulfillment insight");
      expect(result!.dimensionInsights.reflection).toBe("reflection insight");
      expect(result!.dimensionInsights.improvement).toBe("improvement insight");
      expect(result!.dimensionInsights.gratitude).toBe("gratitude insight");
      expect(result!.factCount).toBe(5);
      // 1 summary call + 5 dimension calls = 6 total
      expect(mockCompleteStructuredOutput).toHaveBeenCalledTimes(6);
    });

    it("caches result to PortraitSnapshot", async () => {
      mockCompleteStructuredOutput
        .mockResolvedValueOnce({ summary: "summary text" })
        .mockResolvedValueOnce({ insight: "joy" })
        .mockResolvedValueOnce({ insight: "fulfillment" })
        .mockResolvedValueOnce({ insight: "reflection" })
        .mockResolvedValueOnce({ insight: "improvement" })
        .mockResolvedValueOnce({ insight: "gratitude" });
      mockCreatePortraitSnapshot.mockResolvedValue({ id: "snap-new" });

      await synthesizePortrait(USER_ID);

      expect(mockCreatePortraitSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          summary: "summary text",
          factCount: 5
        })
      );
    });

    it("uses readable deterministic insight when a dimension AI insight fails", async () => {
      mockCompleteStructuredOutput
        .mockResolvedValueOnce({ summary: "cross-dimensional summary" })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ insight: "fulfillment insight" })
        .mockResolvedValueOnce({ insight: "reflection insight" })
        .mockResolvedValueOnce({ insight: "improvement insight" })
        .mockResolvedValueOnce({ insight: "gratitude insight" });

      const result = await synthesizePortrait(USER_ID);

      expect(result).not.toBeNull();
      expect(result!.summary).toBe("cross-dimensional summary");
      expect(result!.dimensionInsights.joy).toContain("你在开心维度反复出现「test」这些线索");
      expect(result!.dimensionInsights.joy).not.toContain("暂不可用");
      expect(result!.dimensionInsights.fulfillment).toBe("fulfillment insight");
    });

    it("falls back and caches a deterministic portrait when AI fails", async () => {
      mockCompleteStructuredOutput.mockResolvedValue(null);

      const result = await synthesizePortrait(USER_ID);

      expect(result).not.toBeNull();
      expect(result!.summary).toContain("目前已经从 5 条认知里看见一些关于你的稳定线索");
      expect(result!.summary).toContain("一时状态和长期模式");
      expect(result!.dimensionInsights.joy).toContain("你在开心维度反复出现「test」这些线索");
      expect(result!.dimensionInsights.joy).toContain("最近较清晰的一条是：fact 0");
      expect(result!.factCount).toBe(5);
      expect(mockCreatePortraitSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          summary: expect.stringContaining("目前已经从 5 条认知里看见一些关于你的稳定线索"),
          factCount: 5
        })
      );
    });

    it("falls back when no AI provider is available", async () => {
      mockGetAIProvider.mockReturnValue(null);

      const result = await synthesizePortrait(USER_ID);

      expect(result).not.toBeNull();
      expect(mockGetAIProvider).toHaveBeenCalledWith("chat");
      expect(result!.summary).toContain("目前已经从 5 条认知里看见一些关于你的稳定线索");
      expect(result!.dimensionInsights.joy).not.toBe("fact 0");
      expect(result!.factCount).toBe(5);
      expect(mockCompleteStructuredOutput).not.toHaveBeenCalled();
      expect(mockCreatePortraitSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          factCount: 5
        })
      );
    });
  });
});
