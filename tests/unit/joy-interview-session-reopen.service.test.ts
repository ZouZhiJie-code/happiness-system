import type { InterviewSessionRecord } from "@/types/interview";

const { completeJoyInterviewSessionRecord, findJoyInterviewSessionById, reopenJoyInterviewSessionRecord } = vi.hoisted(() => ({
  completeJoyInterviewSessionRecord: vi.fn(),
  findJoyInterviewSessionById: vi.fn(),
  reopenJoyInterviewSessionRecord: vi.fn()
}));

vi.mock("@/server/repositories/joy-interview.repository", () => ({
  appendJoyInterviewTurn: vi.fn(),
  completeJoyInterviewSessionRecord,
  createJoyInterviewSession: vi.fn(),
  findJoyInterviewSessionById,
  markJoyEntrySaved: vi.fn(),
  reopenJoyInterviewSessionRecord,
  saveJoyInterviewDraft: vi.fn()
}));

vi.mock("@/server/services/interview/joy-interview-ai.service", () => ({
  extractJoySnapshotWithAI: vi.fn(),
  generateJoyAssistantMessage: vi.fn(),
  generateJoyDraftWithAI: vi.fn(),
  streamJoyAssistantMessage: vi.fn()
}));

vi.mock("@/features/joy-interview/server/joy-interview-engine", () => ({
  getCompletedRestartMessage: vi.fn(),
  getNextStage: vi.fn(),
  getOpeningQuestion: vi.fn()
}));

import { reopenJoyInterviewSession } from "@/server/services/interview/joy-interview.service";

function buildSession(overrides: Partial<InterviewSessionRecord> = {}): InterviewSessionRecord {
  return {
    id: "session-1",
    dimension: "joy",
    status: "completed",
    stage: "finalize",
    turnCount: 4,
    lastAssistantQuestion: "现在要不要帮你整理成日志？",
    draftSummary: "因为我被接住了",
    messages: [],
    snapshot: {
      event: "今天和家人一起吃饭聊天",
      feeling: "轻松踏实",
      whyItMattered: "因为我最近很久没有这种轻松感了",
      happinessType: "关系型开心",
      selfPattern: null,
      confidence: 0.9,
      missingSlots: []
    },
    startedAt: "2026-04-21T00:00:00.000Z",
    completedAt: "2026-04-21T00:08:00.000Z",
    journalEntry: {
      id: "entry-1",
      title: "今天的开心：和家人一起吃饭聊天",
      content: "今天让我开心的事情是：今天和家人一起吃饭聊天。",
      event: "今天和家人一起吃饭聊天",
      feeling: "轻松踏实",
      whyItMattered: "因为我最近很久没有这种轻松感了",
      happinessType: "关系型开心",
      selfPattern: null,
      tags: ["关系型开心", "轻松踏实"],
      source: "ai_draft_direct",
      status: "saved",
      linkedSessionIds: ["session-1"],
      updatedAt: "2026-04-21T00:08:00.000Z",
      savedAt: "2026-04-21T00:08:00.000Z"
    },
    ...overrides
  };
}

describe("reopenJoyInterviewSession", () => {
  beforeEach(() => {
    completeJoyInterviewSessionRecord.mockReset();
    findJoyInterviewSessionById.mockReset();
    reopenJoyInterviewSessionRecord.mockReset();
  });

  it("throws when the session does not exist", async () => {
    findJoyInterviewSessionById.mockResolvedValue(null);

    await expect(reopenJoyInterviewSession("missing")).rejects.toThrow("SESSION_NOT_FOUND");
  });

  it("returns an active session without reopening it again", async () => {
    const session = buildSession({ status: "active", stage: "wrap_up", completedAt: null });
    findJoyInterviewSessionById.mockResolvedValue(session);

    await expect(reopenJoyInterviewSession(session.id)).resolves.toEqual({ session });
    expect(reopenJoyInterviewSessionRecord).not.toHaveBeenCalled();
  });

  it("reopens a completed session that already has a journal entry", async () => {
    const completedSession = buildSession();
    const reopenedSession = buildSession({
      status: "active",
      stage: "wrap_up",
      completedAt: null
    });
    findJoyInterviewSessionById.mockResolvedValue(completedSession);
    reopenJoyInterviewSessionRecord.mockResolvedValue(reopenedSession);

    await expect(reopenJoyInterviewSession(completedSession.id)).resolves.toEqual({ session: reopenedSession });
    expect(reopenJoyInterviewSessionRecord).toHaveBeenCalledWith(completedSession.id);
  });

  it("reopens completed sessions even when no journal entry exists yet", async () => {
    const completedSession = buildSession({ journalEntry: null });
    const reopenedSession = buildSession({
      journalEntry: null,
      status: "active",
      stage: "wrap_up",
      completedAt: null
    });
    findJoyInterviewSessionById.mockResolvedValue(completedSession);
    reopenJoyInterviewSessionRecord.mockResolvedValue(reopenedSession);

    await expect(reopenJoyInterviewSession("session-1")).resolves.toEqual({ session: reopenedSession });
    expect(reopenJoyInterviewSessionRecord).toHaveBeenCalledWith("session-1");
  });
});
