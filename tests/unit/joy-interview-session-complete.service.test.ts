import type { InterviewSessionRecord } from "@/types/interview";

const {
  completeJoyInterviewSessionRecord,
  findJoyInterviewSessionById,
  pauseJoyInterviewSessionRecord,
  reopenJoyInterviewSessionRecord,
  resumeCurrentInterviewEvent,
  startNextInterviewEvent
} = vi.hoisted(() => ({
  completeJoyInterviewSessionRecord: vi.fn(),
  findJoyInterviewSessionById: vi.fn(),
  pauseJoyInterviewSessionRecord: vi.fn(),
  reopenJoyInterviewSessionRecord: vi.fn(),
  resumeCurrentInterviewEvent: vi.fn(),
  startNextInterviewEvent: vi.fn()
}));

vi.mock("@/server/repositories/joy-interview.repository", () => ({
  appendJoyInterviewTurn: vi.fn(),
  completeJoyInterviewSessionRecord,
  createJoyInterviewSession: vi.fn(),
  findJoyInterviewSessionById,
  markJoyEntrySaved: vi.fn(),
  pauseJoyInterviewSessionRecord,
  reopenJoyInterviewSessionRecord,
  resumeCurrentInterviewEvent,
  saveJoyInterviewDraft: vi.fn(),
  startNextInterviewEvent
}));

vi.mock("@/server/services/interview/joy-interview-ai.service", () => ({
  extractJoySnapshotWithAI: vi.fn(),
  generateJoyAssistantTurn: vi.fn(),
  streamJoyAssistantTurn: vi.fn(),
  generateJoyDraftWithAI: vi.fn()
}));

vi.mock("@/features/joy-interview/server/joy-interview-engine", () => ({
  buildAssistantQuestion: vi.fn(),
  getInactiveSessionMessage: vi.fn(),
  getNextStage: vi.fn(),
  getOpeningQuestion: vi.fn()
}));

import { completeJoyInterviewSession } from "@/server/services/interview/joy-interview.service";

function buildSession(overrides: Partial<InterviewSessionRecord> = {}): InterviewSessionRecord {
  return {
    userId: "user-1",
    id: "session-1",
    dimension: "joy",
    status: "active",
    stage: "probe_reason",
    activeEventId: "event-1",
    draftGenerationUnlocked: false,
    turnCount: 2,
    lastAssistantQuestion: "这件事为什么会让你这么开心？",
    draftSummary: null,
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
    events: [
      {
        id: "event-1",
        sequence: 1,
        status: "active",
        stage: "probe_reason",
        explorationRound: 1,
        coveredLenses: ["event_detail", "importance_reason"],
        roundCoveredLenses: ["event_detail", "importance_reason"],
        roundMeaningfulReplyCount: 2,
        totalMeaningfulReplyCount: 2,
        startMessageSequence: 0,
        snapshot: {
          event: "今天和家人一起吃饭聊天",
          feeling: "轻松踏实",
          whyItMattered: "因为我最近很久没有这种轻松感了",
          happinessType: "关系型开心",
          selfPattern: null,
          confidence: 0.9,
          missingSlots: []
        },
        draftSummary: null,
        startedAt: "2026-04-21T00:00:00.000Z",
        completedAt: null
      }
    ],
    pendingDecision: null,
    startedAt: "2026-04-21T00:00:00.000Z",
    entryDate: "2026-04-21",
    pausedAt: null,
    completedAt: null,
    journalEntry: null,
    ...overrides
  };
}

describe("completeJoyInterviewSession", () => {
  beforeEach(() => {
    completeJoyInterviewSessionRecord.mockReset();
    findJoyInterviewSessionById.mockReset();
    pauseJoyInterviewSessionRecord.mockReset();
    reopenJoyInterviewSessionRecord.mockReset();
  });

  it("throws when the session does not exist", async () => {
    findJoyInterviewSessionById.mockResolvedValue(null);

    await expect(completeJoyInterviewSession("user-1", "missing")).rejects.toThrow("SESSION_NOT_FOUND");
  });

  it("returns completed sessions as-is without completing again", async () => {
    const session = buildSession({
      status: "completed",
      completedAt: "2026-04-21T00:08:00.000Z"
    });
    findJoyInterviewSessionById.mockResolvedValue(session);

    await expect(completeJoyInterviewSession("user-1", session.id)).resolves.toEqual({ session });
    expect(completeJoyInterviewSessionRecord).not.toHaveBeenCalled();
  });

  it("marks active sessions as completed while preserving their stage", async () => {
    const activeSession = buildSession();
    const completedSession = buildSession({
      status: "completed",
      completedAt: "2026-04-21T00:08:00.000Z"
    });
    findJoyInterviewSessionById.mockResolvedValue(activeSession);
    completeJoyInterviewSessionRecord.mockResolvedValue(completedSession);

    await expect(completeJoyInterviewSession("user-1", activeSession.id)).resolves.toEqual({ session: completedSession });
    expect(completeJoyInterviewSessionRecord).toHaveBeenCalledWith(activeSession.id);
  });
});
