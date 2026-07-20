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
      rawText: "我想记住被接住的感觉。",
      inputMode: "text",
      requestId: expect.stringMatching(/^ir_/)
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
        rawText: "我想记住被接住的感觉。",
        inputMode: "text",
        requestId: expect.stringMatching(/^ir_/)
      },
      expect.objectContaining({
        onDelta: expect.any(Function),
        onPhase: expect.any(Function),
        onTurn: expect.any(Function)
      }),
      { signal: expect.any(AbortSignal) }
    );
  });

  it("passes the new UserTurn identity and base sequence into respond", async () => {
    mockRespondToInterview.mockResolvedValue(buildRespondPayload());

    const response = await respondRoute(
      new Request("http://localhost/api/interview/session/respond", {
        method: "POST",
        body: JSON.stringify({
          action: "reply",
          sessionId: "session-1",
          clientTurnId: "client-turn-1",
          baseMessageSequence: 4,
          rawText: "  原样保留这一句。  ",
          inputMode: "text"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(mockRespondToInterview).toHaveBeenCalledWith({
      userId: "user-1",
      action: "reply",
      sessionId: "session-1",
      clientTurnId: "client-turn-1",
      baseMessageSequence: 4,
      rawText: "  原样保留这一句。  ",
      userMessage: "  原样保留这一句。  ",
      inputMode: "text",
      requestId: expect.stringMatching(/^ir_/)
    });
  });

  it("passes resume_turn through with the existing client identity", async () => {
    mockRespondToInterview.mockResolvedValue(buildRespondPayload());

    const response = await respondRoute(
      new Request("http://localhost/api/interview/session/respond", {
        method: "POST",
        body: JSON.stringify({
          action: "resume_turn",
          sessionId: "session-1",
          clientTurnId: "client-turn-1"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(mockRespondToInterview).toHaveBeenCalledWith({
      userId: "user-1",
      action: "resume_turn",
      sessionId: "session-1",
      clientTurnId: "client-turn-1",
      requestId: expect.stringMatching(/^ir_/)
    });
  });

  it("rejects over-limit Unicode input before calling the service", async () => {
    const response = await respondRoute(
      new Request("http://localhost/api/interview/session/respond", {
        method: "POST",
        body: JSON.stringify({
          action: "reply",
          sessionId: "session-1",
          rawText: "🙂".repeat(1201),
          inputMode: "text"
        })
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "MESSAGE_TOO_LONG",
      issue: {
        code: "MESSAGE_TOO_LONG"
      }
    });
    expect(mockRespondToInterview).not.toHaveBeenCalled();
  });

  it("returns 409 when the submitted base sequence is stale", async () => {
    mockRespondToInterview.mockRejectedValueOnce(new Error("INTERVIEW_TURN_OUT_OF_DATE"));

    const response = await respondRoute(
      new Request("http://localhost/api/interview/session/respond", {
        method: "POST",
        body: JSON.stringify({
          action: "reply",
          sessionId: "session-1",
          clientTurnId: "client-turn-stale",
          baseMessageSequence: 1,
          rawText: "这一句基于旧问题。",
          inputMode: "text"
        })
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "INTERVIEW_TURN_OUT_OF_DATE",
      issue: {
        code: "INTERVIEW_TURN_OUT_OF_DATE"
      }
    });
  });

  it("includes the accepted turn identity in a streamed failure event", async () => {
    mockStreamInterviewResponse.mockImplementationOnce(
      async (
        _input: unknown,
        callbacks: {
          onTurn: (turn: {
            id: string;
            clientTurnId: string;
            status: "processing";
          }) => Promise<void> | void;
        }
      ) => {
        await callbacks.onTurn({
          id: "turn-accepted",
          clientTurnId: "client-turn-accepted",
          status: "processing"
        });
        throw new Error("ASSISTANT_STREAM_FAILED");
      }
    );

    const response = await respondStreamRoute(
      new Request("http://localhost/api/interview/session/respond/stream", {
        method: "POST",
        body: JSON.stringify({
          action: "reply",
          sessionId: "session-1",
          clientTurnId: "client-turn-accepted",
          baseMessageSequence: 2,
          rawText: "这条已经被服务端接收。",
          inputMode: "text"
        })
      })
    );

    const body = await response.text();
    expect(body).toContain("event: turn");
    expect(body).toContain('"id":"turn-accepted"');
    expect(body).toContain("event: error");
    expect(body).toContain('"turnId":"turn-accepted"');
    expect(body).toContain('"status":"failed"');
  });

  it("returns a structured error when stream auth fails before streaming starts", async () => {
    mockRequireCurrentUserFromRequest.mockRejectedValueOnce(new Error("AUTHENTICATION_REQUIRED"));

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

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "AUTHENTICATION_REQUIRED" });
    expect(mockStreamInterviewResponse).not.toHaveBeenCalled();
  });

  it("returns a structured error when non-stream auth fails", async () => {
    mockRequireCurrentUserFromRequest.mockRejectedValueOnce(new Error("AUTHENTICATION_REQUIRED"));

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

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "AUTHENTICATION_REQUIRED",
      issue: {
        code: "AUTHENTICATION_REQUIRED"
      }
    });
    expect(mockRespondToInterview).not.toHaveBeenCalled();
  });
});
