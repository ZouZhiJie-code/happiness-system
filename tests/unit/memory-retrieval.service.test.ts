import type { InterviewDimension, JoySnapshot } from "@/types/interview";

// ─── Mocks (vi.hoisted) ──────────────────────────────────────────────────

const { mockGetAIProvider } = vi.hoisted(() => ({
  mockGetAIProvider: vi.fn()
}));

const { mockFindSimilarMemoryFacts } = vi.hoisted(() => ({
  mockFindSimilarMemoryFacts: vi.fn()
}));

const { mockFindMemoryFactsByDimension, mockFindAllMemoryFacts } = vi.hoisted(() => ({
  mockFindMemoryFactsByDimension: vi.fn(),
  mockFindAllMemoryFacts: vi.fn()
}));

const { mockPrismaUserSettingsFindUnique } = vi.hoisted(() => ({
  mockPrismaUserSettingsFindUnique: vi.fn()
}));

vi.mock("@/server/services/ai", () => ({
  getAIProvider: mockGetAIProvider
}));

vi.mock("@/lib/vector", () => ({
  findSimilarMemoryFacts: mockFindSimilarMemoryFacts,
  formatVectorForPg: vi.fn((arr: number[]) => `[${arr.join(",")}]`),
  setMemoryFactEmbedding: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    userSettings: { findUnique: mockPrismaUserSettingsFindUnique }
  }
}));

vi.mock("@/server/repositories/memory.repository", () => ({
  findMemoryFactsByDimension: mockFindMemoryFactsByDimension,
  findAllMemoryFacts: mockFindAllMemoryFacts
}));

// ─── Import after mocks ──────────────────────────────────────────────────

import {
  retrieveRelevantMemories,
  formatMemoryContext,
  type RetrievedMemory
} from "@/server/services/memory/memory-retrieval.service";

// ─── Test Data ───────────────────────────────────────────────────────────

const USER_ID = "test-user-1";

function buildSnapshot(overrides?: Partial<JoySnapshot>): JoySnapshot {
  return {
    event: null,
    feeling: null,
    whyItMattered: null,
    happinessType: null,
    selfPattern: null,
    confidence: 0.8,
    missingSlots: [],
    ...overrides
  };
}

function buildMemoryFact(overrides?: Partial<RetrievedMemory>): RetrievedMemory {
  return {
    id: "mem-1",
    userId: USER_ID,
    dimension: "joy",
    kind: "pattern",
    topicTags: ["运动", "独处"],
    summary: "用户喜欢在公园跑步时获得平静感",
    sourceType: "ai_extracted",
    confidence: 0.8,
    evidenceEntryIds: [],
    evidenceSessionIds: [],
    similarity: 0.85,
    ...overrides
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("memory-retrieval.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAIProvider.mockReturnValue({
      name: "test-provider",
      embed: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] })
    });
    mockPrismaUserSettingsFindUnique.mockResolvedValue({ memoryEnabled: true });
    mockFindMemoryFactsByDimension.mockResolvedValue([]);
    mockFindAllMemoryFacts.mockResolvedValue([]);
  });

  describe("retrieveRelevantMemories", () => {
    it("returns empty when memory is disabled", async () => {
      mockPrismaUserSettingsFindUnique.mockResolvedValue({ memoryEnabled: false });

      const result = await retrieveRelevantMemories({
        userId: USER_ID,
        dimension: "joy",
        snapshot: buildSnapshot({ event: "在公园散步" })
      });

      expect(result.memories).toEqual([]);
      expect(result.formattedContext).toBeNull();
    });

    it("returns empty when provider has no embed method", async () => {
      mockGetAIProvider.mockReturnValue({
        name: "test-provider",
        complete: vi.fn()
        // no embed
      });

      const result = await retrieveRelevantMemories({
        userId: USER_ID,
        dimension: "joy",
        snapshot: buildSnapshot({ event: "在公园散步" })
      });

      expect(result.memories).toEqual([]);
      expect(result.formattedContext).toBeNull();
    });

    it("embeds context and queries similar memories", async () => {
      const mockEmbed = vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] });
      mockGetAIProvider.mockReturnValue({
        name: "test-provider",
        embed: mockEmbed
      });

      const memFact = buildMemoryFact();
      mockFindSimilarMemoryFacts.mockResolvedValue([memFact]);

      const result = await retrieveRelevantMemories({
        userId: USER_ID,
        dimension: "joy",
        snapshot: buildSnapshot({
          event: "在公园散步",
          feeling: "平静"
        }),
        currentEventText: "今天独自去了公园跑步"
      });

      expect(mockEmbed).toHaveBeenCalledWith({
        input: expect.stringContaining("在公园散步")
      });
      expect(mockGetAIProvider).toHaveBeenCalledWith("embedding");
      expect(mockFindSimilarMemoryFacts).toHaveBeenCalledWith(
        USER_ID,
        [0.1, 0.2, 0.3],
        expect.objectContaining({
          dimensions: ["joy"],
          limit: expect.any(Number)
        })
      );
      expect(result.memories).toHaveLength(1);
      expect(result.formattedContext).toBeTruthy();
    });

    it("builds query text from snapshot fields", async () => {
      const mockEmbed = vi.fn().mockResolvedValue({ embeddings: [[0.1]] });
      mockGetAIProvider.mockReturnValue({
        name: "test-provider",
        embed: mockEmbed
      });
      mockFindSimilarMemoryFacts.mockResolvedValue([]);

      await retrieveRelevantMemories({
        userId: USER_ID,
        dimension: "fulfillment",
        snapshot: buildSnapshot({
          event: "完成项目报告",
          feeling: "踏实",
          whyItMattered: "证明了自己的能力",
          selfPattern: "追求成就感"
        }),
        currentEventText: "今天加班把报告写完了"
      });

      const embedInput = mockEmbed.mock.calls[0][0].input as string;
      expect(embedInput).toContain("完成项目报告");
      expect(embedInput).toContain("踏实");
      expect(embedInput).toContain("证明了自己的能力");
      expect(embedInput).toContain("今天加班把报告写完了");
    });

    it("limits results by count and minSimilarity", async () => {
      const mockEmbed = vi.fn().mockResolvedValue({ embeddings: [[0.1]] });
      mockGetAIProvider.mockReturnValue({
        name: "test-provider",
        embed: mockEmbed
      });
      mockFindSimilarMemoryFacts.mockResolvedValue([]);

      await retrieveRelevantMemories({
        userId: USER_ID,
        dimension: "joy",
        snapshot: buildSnapshot(),
        maxResults: 3,
        minSimilarity: 0.5
      });

      expect(mockFindSimilarMemoryFacts).toHaveBeenCalledWith(
        USER_ID,
        [0.1],
        expect.objectContaining({
          limit: 3,
          minSimilarity: 0.5
        })
      );
    });

    it("does not throw on embed failure, returns empty", async () => {
      mockGetAIProvider.mockReturnValue({
        name: "test-provider",
        embed: vi.fn().mockRejectedValue(new Error("embed failed"))
      });

      const result = await retrieveRelevantMemories({
        userId: USER_ID,
        dimension: "joy",
        snapshot: buildSnapshot({ event: "散步" })
      });

      expect(result.memories).toEqual([]);
      expect(result.formattedContext).toBeNull();
    });

    it("falls back to keyword retrieval by dimension when embedding fails", async () => {
      mockGetAIProvider.mockReturnValue({
        name: "test-provider",
        embed: vi.fn().mockRejectedValue(new Error("embed failed"))
      });

      const fallbackFact = {
        id: "fallback-1",
        userId: USER_ID,
        dimension: "joy",
        kind: "pattern",
        topicTags: ["散步"],
        summary: "散步后心情变好",
        sourceType: "ai_extracted",
        confidence: 0.9,
        evidenceEntryIds: [],
        evidenceSessionIds: []
      };
      mockFindMemoryFactsByDimension.mockResolvedValue([fallbackFact]);

      const result = await retrieveRelevantMemories({
        userId: USER_ID,
        dimension: "joy",
        snapshot: buildSnapshot({ event: "散步" }),
        maxResults: 5
      });

      expect(mockFindMemoryFactsByDimension).toHaveBeenCalledWith("joy", USER_ID);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].summary).toBe("散步后心情变好");
      expect(result.formattedContext).toBeTruthy();
    });

    it("falls back to all-dimension retrieval when crossDimension is true and embedding fails", async () => {
      mockGetAIProvider.mockReturnValue({
        name: "test-provider",
        embed: vi.fn().mockRejectedValue(new Error("embed failed"))
      });

      mockFindAllMemoryFacts.mockResolvedValue([
        { id: "f1", userId: USER_ID, dimension: "joy", kind: "p", topicTags: [], summary: "s1", sourceType: "ai_extracted", confidence: 0.8, evidenceEntryIds: [], evidenceSessionIds: [] },
        { id: "f2", userId: USER_ID, dimension: "gratitude", kind: "p", topicTags: [], summary: "s2", sourceType: "ai_extracted", confidence: 0.7, evidenceEntryIds: [], evidenceSessionIds: [] }
      ]);

      const result = await retrieveRelevantMemories({
        userId: USER_ID,
        dimension: "joy",
        snapshot: buildSnapshot(),
        crossDimension: true
      });

      expect(mockFindAllMemoryFacts).toHaveBeenCalledWith(USER_ID);
      expect(result.memories).toHaveLength(2);
    });

    it("does not throw on vector query failure, falls back to keyword retrieval", async () => {
      mockGetAIProvider.mockReturnValue({
        name: "test-provider",
        embed: vi.fn().mockResolvedValue({ embeddings: [[0.1]] })
      });
      mockFindSimilarMemoryFacts.mockRejectedValue(new Error("query failed"));
      mockFindMemoryFactsByDimension.mockResolvedValue([]);

      const result = await retrieveRelevantMemories({
        userId: USER_ID,
        dimension: "joy",
        snapshot: buildSnapshot({ event: "散步" })
      });

      expect(mockFindMemoryFactsByDimension).toHaveBeenCalledWith("joy", USER_ID);
      expect(result.memories).toEqual([]);
    });

    it("falls back to keyword retrieval when vector search throws", async () => {
      mockGetAIProvider.mockReturnValue({
        name: "test-provider",
        embed: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] })
      });
      mockFindSimilarMemoryFacts.mockRejectedValue(new Error("vector index missing"));
      mockFindMemoryFactsByDimension.mockResolvedValue([
        buildMemoryFact({ id: "fallback-memory", similarity: 0.4 })
      ]);

      const result = await retrieveRelevantMemories({
        userId: USER_ID,
        dimension: "joy",
        snapshot: buildSnapshot({ event: "公园散步" })
      });

      expect(result.memories).toHaveLength(1);
      expect(result.memories[0]?.id).toBe("fallback-memory");
      expect(mockFindMemoryFactsByDimension).toHaveBeenCalledWith("joy", USER_ID);
    });

    it("respects cross-dimension option", async () => {
      mockGetAIProvider.mockReturnValue({
        name: "test-provider",
        embed: vi.fn().mockResolvedValue({ embeddings: [[0.1]] })
      });
      mockFindSimilarMemoryFacts.mockResolvedValue([]);

      await retrieveRelevantMemories({
        userId: USER_ID,
        dimension: "joy",
        snapshot: buildSnapshot(),
        crossDimension: true
      });

      expect(mockFindSimilarMemoryFacts).toHaveBeenCalledWith(
        USER_ID,
        [0.1],
        expect.objectContaining({
          dimensions: undefined
        })
      );
    });
  });

  describe("formatMemoryContext", () => {
    it("returns null for empty memories", () => {
      expect(formatMemoryContext([])).toBeNull();
    });

    it("formats memories into readable context block", () => {
      const memories: RetrievedMemory[] = [
        buildMemoryFact({
          id: "m1",
          summary: "用户喜欢在公园跑步时获得平静感",
          kind: "pattern",
          topicTags: ["运动", "独处"],
          confidence: 0.8,
          similarity: 0.9
        }),
        buildMemoryFact({
          id: "m2",
          summary: "周末烘焙让用户感到放松和满足",
          kind: "source",
          topicTags: ["烘焙", "放松"],
          confidence: 0.7,
          similarity: 0.75
        })
      ];

      const result = formatMemoryContext(memories);

      expect(result).toContain("用户画像");
      expect(result).toContain("用户喜欢在公园跑步时获得平静感");
      expect(result).toContain("周末烘焙让用户感到放松和满足");
      expect(result).toContain("运动");
      expect(result).toContain("烘焙");
    });

    it("groups memories by dimension", () => {
      const memories: RetrievedMemory[] = [
        buildMemoryFact({
          id: "m1",
          dimension: "joy",
          summary: "跑步带来平静"
        }),
        buildMemoryFact({
          id: "m2",
          dimension: "fulfillment",
          summary: "完成报告有成就感"
        })
      ];

      const result = formatMemoryContext(memories);

      expect(result).toContain("开心");
      expect(result).toContain("充实");
    });
  });
});
