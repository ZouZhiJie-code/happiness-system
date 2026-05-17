const { mockRespondToInterview, mockStreamInterviewResponse } = vi.hoisted(() => ({
  mockRespondToInterview: vi.fn(),
  mockStreamInterviewResponse: vi.fn()
}));

const { mockRequireCurrentUserFromRequest } = vi.hoisted(() => ({
  mockRequireCurrentUserFromRequest: vi.fn()
}));

vi.mock("@/server/services/interview/interview.service", () => ({
  respondToInterview: mockRespondToInterview,
  streamInterviewResponse: mockStreamInterviewResponse
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest: mockRequireCurrentUserFromRequest
}));

import { POST as respondRoute } from "@/app/api/interview/session/respond/route";
import { POST as respondStreamRoute } from "@/app/api/interview/session/respond/stream/route";

function buildRespondPayload() {
  return {
    assistantMessage: "我听见你了。",
    assistantTurn: {
      insight: "",
      thinkingSummary: "这段经历的重点已经更清楚了。",
      analysis: "用户已说：被接住；下一步：生成问题",
      question: "你最想把哪个点留下来？",
      stateUpdate: {
        turnPhase: "digging",
        shouldEndDimension: false,
        offerChoice: false,
        choiceReason: ""
      },
      meta: {
        depthReached: ["event", "reason", "clue"]
      }
    },
    sessionStatus: "active",
    turnCount: 4,
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
    isReadyForDraft: false,
    session: {
      id: "session-1",
      dimension: "joy",
      status: "active",
      stage: "probe_pattern",
      activeEventId: "event-1",
      draftGenerationUnlocked: false,
      turnCount: 4,
      lastAssistantQuestion: "你最想把哪个点留下来？",
      draftSummary: null,
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

describe("interview respond api auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCurrentUserFromRequest.mockResolvedValue({
      id: "user-1",
      username: "daily_light_01"
    });
  });

  it("passes the authenticated user into non-stream respond", async () => {
    mockRespondToInterview.mockResolvedValue(buildRespondPayload());

    const response = await respondRoute(
      new Request("http://localhost/api/interview/session/respond", {
        method: "POST",
        body: JSON.stringify({
          action: "reply",
          sessionId: "session-1",
          userMessage: "我想记住被接住的感觉。",
          inputMode: "text"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(mockRespondToInterview).toHaveBeenCalledWith({
      userId: "user-1",
      action: "reply",
      sessionId: "session-1",
      userMessage: "我想记住被接住的感觉。",
      inputMode: "text"
    });
  });

  it("passes the authenticated user into stream respond", async () => {
    mockStreamInterviewResponse.mockResolvedValue(buildRespondPayload());

    const response = await respondStreamRoute(
      new Request("http://localhost/api/interview/session/respond/stream", {
        method: "POST",
        body: JSON.stringify({
          action: "reply",
          sessionId: "session-1",
          userMessage: "我想记住被接住的感觉。",
          inputMode: "text"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(mockStreamInterviewResponse).toHaveBeenCalledWith(
      {
        userId: "user-1",
        action: "reply",
        sessionId: "session-1",
        userMessage: "我想记住被接住的感觉。",
        inputMode: "text"
      },
      expect.any(Object)
    );
  });
});
