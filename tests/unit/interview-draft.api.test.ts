const { mockGenerateInterviewDraft, mockSaveGeneratedJournalEntry } = vi.hoisted(() => ({
  mockGenerateInterviewDraft: vi.fn(),
  mockSaveGeneratedJournalEntry: vi.fn()
}));

const { mockRequireCurrentUserFromRequest } = vi.hoisted(() => ({
  mockRequireCurrentUserFromRequest: vi.fn()
}));

vi.mock("@/server/services/interview/interview.service", () => ({
  DraftGenerationError: class DraftGenerationError extends Error {
    code: string;
    retryable: boolean;

    constructor(code: string, retryable = false) {
      super(code);
      this.code = code;
      this.retryable = retryable;
    }
  },
  generateInterviewDraft: mockGenerateInterviewDraft,
  saveGeneratedJournalEntry: mockSaveGeneratedJournalEntry
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest: mockRequireCurrentUserFromRequest
}));

import { POST as generateDraftRoute } from "@/app/api/interview/session/draft/generate/route";
import { POST as saveDraftRoute } from "@/app/api/interview/session/draft/save/route";
import { DraftGenerationError } from "@/server/services/interview/interview.service";

function buildDraftResponse() {
  return {
    draftEntry: {
      id: "entry-1",
      title: "被稳稳接住",
      content: "今天和家人一起吃饭聊天。",
      event: "今天和家人一起吃饭聊天",
      feeling: "轻松踏实",
      whyItMattered: "被家人的陪伴接住了",
      happinessType: "关系型开心",
      selfPattern: "只要慢下来相处，我就更容易恢复状态",
      tags: ["关系型开心"],
      eventBlocks: [],
      payload: {
        kind: "joy",
        joyMoment: "今天和家人一起吃饭聊天",
        joySource: "被家人的陪伴接住了",
        stateShift: "从紧绷变得轻松踏实",
        meaningNeed: null,
        manualClue: "只要慢下来相处，我就更容易恢复状态",
        directionSignal: null,
        valueImpact: null,
        durability: null,
        tags: ["关系型开心"],
        confidence: 0.9,
        missingSlots: []
      },
      source: "ai_draft_direct",
      status: "draft",
      linkedSessionIds: ["session-1"],
      updatedAt: "2026-05-17T00:00:00.000Z",
      savedAt: null
    },
    session: {
      id: "session-1",
      dimension: "joy",
      status: "active",
      stage: "wrap_up",
      activeEventId: "event-1",
      draftGenerationUnlocked: true,
      turnCount: 3,
      lastAssistantQuestion: "要不要现在整理成日志？",
      draftSummary: "被家人的陪伴接住了",
      messages: [],
      snapshot: {
        event: "今天和家人一起吃饭聊天",
        feeling: "轻松踏实",
        whyItMattered: "被家人的陪伴接住了",
        happinessType: "关系型开心",
        selfPattern: "只要慢下来相处，我就更容易恢复状态",
        confidence: 0.9,
        missingSlots: []
      },
      snapshotData: {
        kind: "joy",
        joyMoment: "今天和家人一起吃饭聊天",
        joySource: "被家人的陪伴接住了",
        stateShift: "从紧绷变得轻松踏实",
        meaningNeed: null,
        manualClue: "只要慢下来相处，我就更容易恢复状态",
        directionSignal: null,
        valueImpact: null,
        durability: null,
        tags: ["关系型开心"],
        confidence: 0.9,
        missingSlots: []
      },
      events: [],
      pendingDecision: null,
      entryDate: "2026-05-17",
      startedAt: "2026-05-17T00:00:00.000Z",
      pausedAt: null,
      completedAt: null,
      journalEntry: null
    }
  };
}

describe("interview draft api auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCurrentUserFromRequest.mockResolvedValue({
      id: "user-1",
      username: "daily_light_01"
    });
  });

  it("passes the authenticated user into draft generation", async () => {
    mockGenerateInterviewDraft.mockResolvedValue(buildDraftResponse());

    const response = await generateDraftRoute(
      new Request("http://localhost/api/interview/session/draft/generate", {
        method: "POST",
        body: JSON.stringify({ sessionIds: ["session-1"] })
      })
    );

    expect(response.status).toBe(200);
    expect(mockGenerateInterviewDraft).toHaveBeenCalledWith("user-1", ["session-1"]);
  });

  it("returns a stable error when draft generation is not ready yet", async () => {
    mockGenerateInterviewDraft.mockRejectedValue(new DraftGenerationError("DRAFT_GENERATE_NOT_READY", false));

    const response = await generateDraftRoute(
      new Request("http://localhost/api/interview/session/draft/generate", {
        method: "POST",
        body: JSON.stringify({ sessionIds: ["session-1"] })
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "DRAFT_GENERATE_NOT_READY",
      retryable: false,
      message: "当前材料还不够生成日志，请先补充当前片段或换一个片段。"
    });
  });

  it("passes the authenticated user into draft save", async () => {
    mockSaveGeneratedJournalEntry.mockResolvedValue(buildDraftResponse());

    const response = await saveDraftRoute(
      new Request("http://localhost/api/interview/session/draft/save", {
        method: "POST",
        body: JSON.stringify({ sessionId: "session-1" })
      })
    );

    expect(response.status).toBe(200);
    expect(mockSaveGeneratedJournalEntry).toHaveBeenCalledWith("user-1", "session-1");
  });
});
