import type { InterviewDimension, JoyEntryDraft, InterviewSessionRecord } from "@/types/interview";

// ─── Mocks (vi.hoisted) ──────────────────────────────────────────────────

const { mockCompleteStructuredOutput, mockGetAIProvider } = vi.hoisted(() => ({
  mockCompleteStructuredOutput: vi.fn(),
  mockGetAIProvider: vi.fn()
}));

const { mockCreateMemoryFact, mockFindSimilarBySummary, mockSetMemoryFactEmbedding, mockUpdateMemoryFact } = vi.hoisted(() => ({
  mockCreateMemoryFact: vi.fn(),
  mockFindSimilarBySummary: vi.fn(),
  mockSetMemoryFactEmbedding: vi.fn(),
  mockUpdateMemoryFact: vi.fn()
}));

const { mockPrismaUserSettingsFindUnique } = vi.hoisted(() => ({
  mockPrismaUserSettingsFindUnique: vi.fn()
}));

vi.mock("@/server/services/ai/structured-output", () => ({
  completeStructuredOutput: mockCompleteStructuredOutput
}));

vi.mock("@/server/services/ai", () => ({
  getAIProvider: mockGetAIProvider
}));

vi.mock("@/server/repositories/memory.repository", () => ({
  createMemoryFact: mockCreateMemoryFact,
  findSimilarBySummary: mockFindSimilarBySummary,
  setMemoryFactEmbedding: mockSetMemoryFactEmbedding,
  updateMemoryFact: mockUpdateMemoryFact
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    userSettings: { findUnique: mockPrismaUserSettingsFindUnique }
  }
}));

// ─── Import after mocks ──────────────────────────────────────────────────

import { extractMemoriesFromSession } from "@/server/services/memory/memory-extraction.service";

// ─── Test Data ───────────────────────────────────────────────────────────

const USER_ID = "test-user-1";
const SESSION_ID = "session-1";
const ENTRY_ID = "entry-1";

function buildSession(overrides?: Partial<InterviewSessionRecord>): InterviewSessionRecord {
  return {
    id: SESSION_ID,
    userId: USER_ID,
    dimension: "joy" as InterviewDimension,
    status: "completed",
    stage: "finalize",
    activeEventId: null,
    turnCount: 5,
    entryDate: new Date(),
    startedAt: new Date(),
    pausedAt: null,
    completedAt: new Date(),
    lastAssistantQuestion: null,
    draftSummary: null,
    finalEntryId: ENTRY_ID,
    events: [
      {
        id: "evt-1",
        sessionId: SESSION_ID,
        sequence: 1,
        status: "completed",
        stage: "finalize",
        explorationRound: 1,
        coveredLenses: [],
        roundCoveredLenses: [],
        roundMeaningfulReplyCount: 3,
        totalMeaningfulReplyCount: 3,
        startMessageSequence: 0,
        event: "独自在公园散步",
        feeling: "平静、放松",
        whyItMattered: "难得的独处时光让我充电",
        happinessType: "delight",
        selfPattern: "独处时恢复能量最快",
        snapshotData: null,
        progressData: null,
        confidence: 0.9,
        missingSlots: [],
        draftSummary: null,
        startedAt: new Date(),
        completedAt: new Date()
      }
    ],
    messages: [],
    snapshots: [],
    aiRequestLogs: [],
    joyEntry: null,
    activeEvent: null,
    ...overrides
  } as unknown as InterviewSessionRecord;
}

function buildDraft(): JoyEntryDraft {
  return {
    title: "今天的开心",
    content: "今天独自在公园散步，感到平静和放松。独处的时光让我恢复了能量。",
    event: "独自在公园散步",
    feeling: "平静、放松",
    whyItMattered: "难得的独处时光让我充电",
    happinessType: "delight",
    selfPattern: "独处时恢复能量最快",
    tags: ["独处", "放松"],
    eventBlocks: [],
    source: "ai_draft_direct"
  };
}

const MOCK_EMBEDDING = Array(2048).fill(0.1);

// ─── Tests ───────────────────────────────────────────────────────────────

describe("extractMemoriesFromSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockPrismaUserSettingsFindUnique.mockResolvedValue({ memoryEnabled: true });
    mockGetAIProvider.mockReturnValue({ name: "mock", embed: vi.fn().mockResolvedValue({ embeddings: [MOCK_EMBEDDING] }) });
    mockFindSimilarBySummary.mockResolvedValue(null);
    mockCreateMemoryFact.mockImplementation(async (data) => ({
      id: "mem-1",
      userId: data.userId,
      dimension: data.dimension,
      kind: data.kind,
      topicTags: data.topicTags,
      summary: data.summary,
      sourceType: data.sourceType,
      confidence: data.confidence,
      evidenceEntryIds: data.evidenceEntryIds,
      evidenceSessionIds: data.evidenceSessionIds,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    mockSetMemoryFactEmbedding.mockResolvedValue(undefined);
    mockUpdateMemoryFact.mockResolvedValue({ id: "existing-mem-1" });
  });

  it("creates memory facts when AI returns valid extraction", async () => {
    mockCompleteStructuredOutput.mockResolvedValue({
      memories: [
        { kind: "preference", summary: "独处时幸福感显著提升", topicTags: ["独处", "能量恢复"] }
      ]
    });

    await extractMemoriesFromSession({
      userId: USER_ID,
      sessionId: SESSION_ID,
      session: buildSession(),
      draftEntry: buildDraft()
    });

    expect(mockGetAIProvider).toHaveBeenCalledWith("embedding");
    expect(mockCreateMemoryFact).toHaveBeenCalledTimes(1);
    expect(mockCreateMemoryFact).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        dimension: "joy",
        kind: "preference",
        summary: "独处时幸福感显著提升",
        topicTags: ["独处", "能量恢复"],
        sourceType: "ai_extracted"
      })
    );
  });

  it("generates embedding for each created memory", async () => {
    mockCompleteStructuredOutput.mockResolvedValue({
      memories: [
        { kind: "preference", summary: "独处时幸福感显著提升", topicTags: ["独处"] }
      ]
    });

    await extractMemoriesFromSession({
      userId: USER_ID,
      sessionId: SESSION_ID,
      session: buildSession(),
      draftEntry: buildDraft()
    });

    expect(mockGetAIProvider).toHaveBeenCalledWith("embedding");
    expect(mockSetMemoryFactEmbedding).toHaveBeenCalledTimes(1);
  });

  it("does nothing when memoryEnabled is false", async () => {
    mockPrismaUserSettingsFindUnique.mockResolvedValue({ memoryEnabled: false });

    await extractMemoriesFromSession({
      userId: USER_ID,
      sessionId: SESSION_ID,
      session: buildSession(),
      draftEntry: buildDraft()
    });

    expect(mockCompleteStructuredOutput).not.toHaveBeenCalled();
    expect(mockCreateMemoryFact).not.toHaveBeenCalled();
  });

  it("does nothing when AI returns null", async () => {
    mockCompleteStructuredOutput.mockResolvedValue(null);

    await extractMemoriesFromSession({
      userId: USER_ID,
      sessionId: SESSION_ID,
      session: buildSession(),
      draftEntry: buildDraft()
    });

    expect(mockCreateMemoryFact).not.toHaveBeenCalled();
  });

  it("does nothing when AI returns empty memories", async () => {
    mockCompleteStructuredOutput.mockResolvedValue({ memories: [] });

    await extractMemoriesFromSession({
      userId: USER_ID,
      sessionId: SESSION_ID,
      session: buildSession(),
      draftEntry: buildDraft()
    });

    expect(mockCreateMemoryFact).not.toHaveBeenCalled();
  });

  it("merges with existing similar memory instead of creating new", async () => {
    mockCompleteStructuredOutput.mockResolvedValue({
      memories: [
        { kind: "preference", summary: "独处时幸福感提升", topicTags: ["独处"] }
      ]
    });
    mockFindSimilarBySummary.mockResolvedValue({
      id: "existing-mem-1",
      userId: USER_ID,
      dimension: "joy",
      summary: "独处时幸福感提升",
      confidence: 0.5,
      evidenceEntryIds: ["old-entry"],
      evidenceSessionIds: ["old-session"]
    });

    await extractMemoriesFromSession({
      userId: USER_ID,
      sessionId: SESSION_ID,
      session: buildSession(),
      draftEntry: buildDraft()
    });

    // Should NOT create new memory
    expect(mockCreateMemoryFact).not.toHaveBeenCalled();
    // Should update existing memory
    expect(mockUpdateMemoryFact).toHaveBeenCalledTimes(1);
    // Should update existing memory's embedding
    expect(mockSetMemoryFactEmbedding).toHaveBeenCalledTimes(1);
  });

  it("updates confidence and evidenceSessionIds when merging with existing memory", async () => {
    mockCompleteStructuredOutput.mockResolvedValue({
      memories: [
        { kind: "preference", summary: "独处时幸福感提升", topicTags: ["独处"] }
      ]
    });
    mockFindSimilarBySummary.mockResolvedValue({
      id: "existing-mem-1",
      userId: USER_ID,
      dimension: "joy",
      summary: "独处时幸福感提升",
      confidence: 0.5,
      evidenceEntryIds: ["old-entry"],
      evidenceSessionIds: ["old-session"]
    });

    await extractMemoriesFromSession({
      userId: USER_ID,
      sessionId: SESSION_ID,
      session: buildSession(),
      draftEntry: buildDraft()
    });

    expect(mockUpdateMemoryFact).toHaveBeenCalledWith(
      "existing-mem-1",
      expect.objectContaining({
        confidence: expect.any(Number),
        evidenceSessionIds: expect.arrayContaining([SESSION_ID])
      })
    );
    const updateCall = mockUpdateMemoryFact.mock.calls[0][1];
    expect(updateCall.confidence).toBeGreaterThan(0.5);
  });

  it("uses existing record summary for embedding when merging", async () => {
    mockCompleteStructuredOutput.mockResolvedValue({
      memories: [
        { kind: "preference", summary: "独处让人充电", topicTags: ["独处"] },
        { kind: "pattern", summary: "新的独立模式", topicTags: ["新"] }
      ]
    });

    // First memory merges (different summary from AI), second is new
    mockFindSimilarBySummary
      .mockResolvedValueOnce({
        id: "existing-mem-1",
        userId: USER_ID,
        dimension: "joy",
        summary: "独处时幸福感提升",  // existing DB summary differs from AI summary
        confidence: 0.5,
        evidenceEntryIds: [],
        evidenceSessionIds: ["old-session"]
      })
      .mockResolvedValueOnce(null);

    mockCreateMemoryFact.mockResolvedValue({ id: "new-mem-2" });
    mockGetAIProvider.mockReturnValue({
      name: "mock",
      embed: vi.fn().mockResolvedValue({
        embeddings: [Array(2048).fill(0.2), Array(2048).fill(0.3)]
      })
    });

    await extractMemoriesFromSession({
      userId: USER_ID,
      sessionId: SESSION_ID,
      session: buildSession(),
      draftEntry: buildDraft()
    });

    // Embedding should be generated using existing DB summary for merged record,
    // and AI summary for the new record
    expect(mockSetMemoryFactEmbedding).toHaveBeenCalledTimes(2);
  });

  it("does not throw when embedding generation fails", async () => {
    mockCompleteStructuredOutput.mockResolvedValue({
      memories: [
        { kind: "preference", summary: "独处时幸福感提升", topicTags: ["独处"] }
      ]
    });
    mockCreateMemoryFact.mockResolvedValue({ id: "mem-1" });
    const mockProvider = {
      name: "mock",
      embed: vi.fn().mockRejectedValue(new Error("embedding failed"))
    };
    mockGetAIProvider.mockReturnValue(mockProvider);

    // Should not throw
    await expect(
      extractMemoriesFromSession({
        userId: USER_ID,
        sessionId: SESSION_ID,
        session: buildSession(),
        draftEntry: buildDraft()
      })
    ).resolves.toBeUndefined();
  });

  it("passes evidenceEntryIds and evidenceSessionIds", async () => {
    mockCompleteStructuredOutput.mockResolvedValue({
      memories: [
        { kind: "pattern", summary: "完成工作后感到充实", topicTags: ["工作"] }
      ]
    });

    await extractMemoriesFromSession({
      userId: USER_ID,
      sessionId: SESSION_ID,
      session: buildSession(),
      draftEntry: buildDraft()
    });

    expect(mockCreateMemoryFact).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceEntryIds: [ENTRY_ID],
        evidenceSessionIds: [SESSION_ID]
      })
    );
  });

  it("sets confidence based on number of events", async () => {
    mockCompleteStructuredOutput.mockResolvedValue({
      memories: [
        { kind: "trait", summary: "在自然环境中恢复能量最快", topicTags: ["自然"] }
      ]
    });

    await extractMemoriesFromSession({
      userId: USER_ID,
      sessionId: SESSION_ID,
      session: buildSession(),
      draftEntry: buildDraft()
    });

    expect(mockCreateMemoryFact).toHaveBeenCalledWith(
      expect.objectContaining({
        confidence: expect.any(Number)
      })
    );
    const call = mockCreateMemoryFact.mock.calls[0][0];
    expect(call.confidence).toBeGreaterThan(0);
    expect(call.confidence).toBeLessThanOrEqual(1);
  });
});
