import type { InterviewDimension, MemoryFact } from "@prisma/client";

// ─── Mocks (vi.hoisted) ──────────────────────────────────────────────────

const {
  mockFindAllMemoryFacts,
  mockCreateMemoryFact,
  mockUpdateMemoryFact,
  mockSoftDeleteMemoryFact,
  mockFindMemoryFactById,
  mockSetMemoryFactEmbedding
} = vi.hoisted(() => ({
  mockFindAllMemoryFacts: vi.fn(),
  mockCreateMemoryFact: vi.fn(),
  mockUpdateMemoryFact: vi.fn(),
  mockSoftDeleteMemoryFact: vi.fn(),
  mockFindMemoryFactById: vi.fn(),
  mockSetMemoryFactEmbedding: vi.fn()
}));

const { mockGetAIProvider } = vi.hoisted(() => ({
  mockGetAIProvider: vi.fn()
}));

vi.mock("@/server/repositories/memory.repository", () => ({
  findAllMemoryFacts: mockFindAllMemoryFacts,
  createMemoryFact: mockCreateMemoryFact,
  updateMemoryFact: mockUpdateMemoryFact,
  softDeleteMemoryFact: mockSoftDeleteMemoryFact,
  findMemoryFactById: mockFindMemoryFactById,
  setMemoryFactEmbedding: mockSetMemoryFactEmbedding
}));

vi.mock("@/server/services/ai", () => ({
  getAIProvider: mockGetAIProvider
}));

// ─── Import after mocks ──────────────────────────────────────────────────

import {
  getAllProfiles,
  addProfileFact,
  updateProfileFact,
  deleteProfileFact
} from "@/server/services/memory/profile.service";

// ─── Test Data ───────────────────────────────────────────────────────────

const USER_ID = "test-user-1";

function buildFact(overrides?: Partial<MemoryFact>): MemoryFact {
  return {
    id: "mem-1",
    userId: USER_ID,
    dimension: "joy" as InterviewDimension,
    kind: "preference",
    topicTags: ["独处", "能量恢复"],
    summary: "独处时幸福感显著提升",
    sourceType: "ai_extracted",
    confidence: 0.7,
    evidenceEntryIds: ["entry-1"],
    evidenceSessionIds: ["session-1"],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastUsedAt: null,
    deletedAt: null,
    embedding: null,
    ...overrides
  } as MemoryFact;
}

const MOCK_EMBEDDING = Array(2048).fill(0.1);

// ─── Tests ───────────────────────────────────────────────────────────────

describe("profile.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAIProvider.mockReturnValue({
      name: "mock",
      embed: vi.fn().mockResolvedValue({ embeddings: [MOCK_EMBEDDING] })
    });
  });

  describe("getAllProfiles", () => {
    it("returns memories grouped by dimension", async () => {
      mockFindAllMemoryFacts.mockResolvedValue([
        buildFact({ id: "mem-1", dimension: "joy", summary: "独处时幸福感提升" }),
        buildFact({ id: "mem-2", dimension: "joy", summary: "清晨跑步让我清醒" }),
        buildFact({ id: "mem-3", dimension: "reflection", summary: "犹豫时会暂停" })
      ]);

      const result = await getAllProfiles(USER_ID);

      expect(result.joy).toHaveLength(2);
      expect(result.reflection).toHaveLength(1);
      expect(result.fulfillment).toHaveLength(0);
      expect(result.improvement).toHaveLength(0);
      expect(result.gratitude).toHaveLength(0);
    });

    it("returns empty groups when no memories exist", async () => {
      mockFindAllMemoryFacts.mockResolvedValue([]);

      const result = await getAllProfiles(USER_ID);

      expect(result.joy).toHaveLength(0);
      expect(result.fulfillment).toHaveLength(0);
      expect(result.reflection).toHaveLength(0);
      expect(result.improvement).toHaveLength(0);
      expect(result.gratitude).toHaveLength(0);
    });
  });

  describe("addProfileFact", () => {
    it("creates a new memory fact with sourceType user_added and confidence 1.0", async () => {
      mockCreateMemoryFact.mockResolvedValue(buildFact({ id: "new-mem", sourceType: "user_added", confidence: 1 }));

      const result = await addProfileFact({
        userId: USER_ID,
        dimension: "joy",
        summary: "我喜欢在雨天读书",
        topicTags: ["独处", "阅读"]
      });

      expect(mockCreateMemoryFact).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          dimension: "joy",
          summary: "我喜欢在雨天读书",
          topicTags: ["独处", "阅读"],
          sourceType: "user_added",
          confidence: 1.0
        })
      );
      expect(result.id).toBe("new-mem");
    });

    it("generates embedding for the new fact", async () => {
      mockCreateMemoryFact.mockResolvedValue(buildFact({ id: "new-mem" }));

      await addProfileFact({
        userId: USER_ID,
        dimension: "joy",
        summary: "我喜欢在雨天读书",
        topicTags: ["独处"]
      });

      expect(mockSetMemoryFactEmbedding).toHaveBeenCalledWith("new-mem", MOCK_EMBEDDING);
    });

    it("does not throw when embedding generation fails", async () => {
      mockCreateMemoryFact.mockResolvedValue(buildFact({ id: "new-mem" }));
      mockGetAIProvider.mockReturnValue({
        name: "mock",
        embed: vi.fn().mockRejectedValue(new Error("embedding failed"))
      });

      await expect(
        addProfileFact({
          userId: USER_ID,
          dimension: "joy",
          summary: "测试",
          topicTags: []
        })
      ).resolves.toBeDefined();
    });
  });

  describe("updateProfileFact", () => {
    it("updates summary and topicTags", async () => {
      mockFindMemoryFactById.mockResolvedValue(buildFact());
      mockUpdateMemoryFact.mockResolvedValue(buildFact({ summary: "更新后的摘要" }));

      const result = await updateProfileFact({
        id: "mem-1",
        userId: USER_ID,
        summary: "更新后的摘要",
        topicTags: ["新标签"]
      });

      expect(mockUpdateMemoryFact).toHaveBeenCalledWith("mem-1", {
        summary: "更新后的摘要",
        topicTags: ["新标签"]
      });
    });

    it("regenerates embedding after summary update", async () => {
      mockFindMemoryFactById.mockResolvedValue(buildFact());
      mockUpdateMemoryFact.mockResolvedValue(buildFact({ summary: "更新后的摘要" }));

      await updateProfileFact({
        id: "mem-1",
        userId: USER_ID,
        summary: "更新后的摘要",
        topicTags: ["新标签"]
      });

      // Wait for fire-and-forget embedding
      await new Promise((r) => setTimeout(r, 10));
      expect(mockSetMemoryFactEmbedding).toHaveBeenCalledWith("mem-1", MOCK_EMBEDDING);
    });

    it("does not throw when embedding regeneration fails", async () => {
      mockFindMemoryFactById.mockResolvedValue(buildFact());
      mockUpdateMemoryFact.mockResolvedValue(buildFact());
      mockGetAIProvider.mockReturnValue({
        name: "mock",
        embed: vi.fn().mockRejectedValue(new Error("embedding failed"))
      });

      await expect(
        updateProfileFact({ id: "mem-1", userId: USER_ID, summary: "test", topicTags: [] })
      ).resolves.toBeDefined();
    });

    it("throws when memory not found", async () => {
      mockFindMemoryFactById.mockResolvedValue(null);

      await expect(
        updateProfileFact({ id: "non-existent", userId: USER_ID, summary: "test", topicTags: [] })
      ).rejects.toThrow("MEMORY_NOT_FOUND");
    });

    it("throws when memory belongs to different user", async () => {
      mockFindMemoryFactById.mockResolvedValue(buildFact({ userId: "other-user" }));

      await expect(
        updateProfileFact({ id: "mem-1", userId: USER_ID, summary: "test", topicTags: [] })
      ).rejects.toThrow("MEMORY_NOT_FOUND");
    });
  });

  describe("deleteProfileFact", () => {
    it("soft-deletes a memory fact", async () => {
      mockFindMemoryFactById.mockResolvedValue(buildFact());

      await deleteProfileFact("mem-1", USER_ID);

      expect(mockSoftDeleteMemoryFact).toHaveBeenCalledWith("mem-1");
    });

    it("throws when memory not found", async () => {
      mockFindMemoryFactById.mockResolvedValue(null);

      await expect(deleteProfileFact("non-existent", USER_ID)).rejects.toThrow("MEMORY_NOT_FOUND");
    });

    it("throws when memory belongs to different user", async () => {
      mockFindMemoryFactById.mockResolvedValue(buildFact({ userId: "other-user" }));

      await expect(deleteProfileFact("mem-1", USER_ID)).rejects.toThrow("MEMORY_NOT_FOUND");
    });
  });
});
