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

const { mockRecordAnalyticsEvent } = vi.hoisted(() => ({
  mockRecordAnalyticsEvent: vi.fn()
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

vi.mock("@/server/repositories/admin-analytics.repository", () => ({
  recordAnalyticsEvent: mockRecordAnalyticsEvent
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

import { pauseJoyInterviewSession } from "@/server/services/interview/joy-interview.service";

function buildSession(overrides: Partial<InterviewSessionRecord> = {}): InterviewSessionRecord {
  return {
    userId: "user-1",
    id: "session-1",
    dimension: "joy",
    status: "active",
    stage: "wrap_up",
    activeEventId: "event-1",
    draftGenerationUnlocked: true,
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
    events: [
      {
        id: "event-1",
        sequence: 1,
        status: "ready_for_choice",
        stage: "wrap_up",
        explorationRound: 1,
        coveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
        roundCoveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
        roundMeaningfulReplyCount: 3,
        totalMeaningfulReplyCount: 3,
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
        draftSummary: "因为我被接住了",
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

describe("pauseJoyInterviewSession", () => {
  beforeEach(() => {
    completeJoyInterviewSessionRecord.mockReset();
    findJoyInterviewSessionById.mockReset();
    pauseJoyInterviewSessionRecord.mockReset();
    reopenJoyInterviewSessionRecord.mockReset();
    mockRecordAnalyticsEvent.mockReset();
  });

  it("throws when the session does not exist", async () => {
    findJoyInterviewSessionById.mockResolvedValue(null);

    await expect(pauseJoyInterviewSession("user-1", "missing")).rejects.toThrow("SESSION_NOT_FOUND");
  });

  it("returns paused sessions as-is without pausing again", async () => {
    const session = buildSession({
      status: "paused",
      pausedAt: "2026-04-21T00:08:00.000Z"
    });
    findJoyInterviewSessionById.mockResolvedValue(session);

    await expect(pauseJoyInterviewSession("user-1", session.id)).resolves.toEqual({ session });
    expect(pauseJoyInterviewSessionRecord).not.toHaveBeenCalled();
  });

  it("marks active sessions as paused", async () => {
    const activeSession = buildSession();
    const pausedSession = buildSession({
      status: "paused",
      pausedAt: "2026-04-21T00:08:00.000Z"
    });
    findJoyInterviewSessionById.mockResolvedValue(activeSession);
    pauseJoyInterviewSessionRecord.mockResolvedValue(pausedSession);

    await expect(pauseJoyInterviewSession("user-1", activeSession.id)).resolves.toEqual({ session: pausedSession });
    expect(pauseJoyInterviewSessionRecord).toHaveBeenCalledWith(activeSession.id);
    expect(mockRecordAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "interview_session_paused",
        userId: "user-1",
        sessionId: "session-1",
        dedupeKey: "interview_session_paused:session-1"
      })
    );
  });

  it("rejects completed sessions", async () => {
    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        status: "completed",
        completedAt: "2026-04-21T00:09:00.000Z"
      })
    );

    await expect(pauseJoyInterviewSession("user-1", "session-1")).rejects.toThrow("SESSION_ALREADY_COMPLETED");
    expect(pauseJoyInterviewSessionRecord).not.toHaveBeenCalled();
  });
});
