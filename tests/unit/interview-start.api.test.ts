const { mockStartInterview, mockResponseParse } = vi.hoisted(() => ({
  mockStartInterview: vi.fn(),
  mockResponseParse: vi.fn((input: unknown) => input)
}));

const { mockRequireCurrentUserFromRequest } = vi.hoisted(() => ({
  mockRequireCurrentUserFromRequest: vi.fn()
}));

vi.mock("@/server/services/interview/interview.service", () => ({
  startInterview: mockStartInterview
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  isAuthenticationRequiredError: (error: unknown) =>
    error instanceof Error && error.message === "AUTHENTICATION_REQUIRED",
  requireCurrentUserFromRequest: mockRequireCurrentUserFromRequest
}));

vi.mock("@/features/interview/schema/interview.schema", async () => {
  const actual = await vi.importActual<typeof import("@/features/interview/schema/interview.schema")>(
    "@/features/interview/schema/interview.schema"
  );

  return {
    ...actual,
    startInterviewResponseSchema: {
      parse: mockResponseParse
    }
  };
});

import { POST as startInterviewRoute } from "@/app/api/interview/session/start/route";

function buildStartInterviewResponse() {
  return {
    sessionId: "session-1",
    openingQuestion: "今天有没有一个让你真心开心的瞬间？",
    session: {
      id: "session-1",
      dimension: "joy",
      status: "active",
      stage: "collect_event",
      activeEventId: "event-1",
      draftGenerationUnlocked: false,
      turnCount: 0,
      lastAssistantQuestion: "今天有没有一个让你真心开心的瞬间？",
      draftSummary: null,
      messages: [
        {
          id: "assistant-opening",
          role: "assistant",
          content: "今天有没有一个让你真心开心的瞬间？",
          sequence: 0,
          createdAt: "2026-04-20T16:00:00.000Z"
        }
      ],
      snapshot: {
        event: null,
        feeling: null,
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        confidence: 0.2,
        missingSlots: ["event", "whyItMattered", "happinessTypeOrSelfPattern"]
      },
      snapshotData: {
        kind: "joy",
        joyMoment: null,
        joySource: null,
        stateShift: null,
        meaningNeed: null,
        manualClue: null,
        directionSignal: null,
        valueImpact: null,
        durability: null,
        tags: [],
        confidence: 0.2,
        missingSlots: ["joyMoment", "joySource", "stateShift"]
      },
      events: [
        {
          id: "event-1",
          sequence: 1,
          status: "active",
          stage: "collect_event",
          explorationRound: 1,
          coveredLenses: [],
          roundCoveredLenses: [],
          roundMeaningfulReplyCount: 0,
          totalMeaningfulReplyCount: 0,
          startMessageSequence: 0,
          snapshot: {
            event: null,
            feeling: null,
            whyItMattered: null,
            happinessType: null,
            selfPattern: null,
            confidence: 0.2,
            missingSlots: ["event", "whyItMattered", "happinessTypeOrSelfPattern"]
          },
          draftSummary: null,
          startedAt: "2026-04-20T16:00:00.000Z",
          completedAt: null
        }
      ],
      pendingDecision: null,
      entryDate: "2026-04-21",
      startedAt: "2026-04-20T16:00:00.000Z",
      pausedAt: null,
      completedAt: null,
      journalEntry: null
    }
  };
}

describe("interview start api route", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockStartInterview.mockReset();
    mockResponseParse.mockClear();
    mockRequireCurrentUserFromRequest.mockReset();
    mockRequireCurrentUserFromRequest.mockResolvedValue({ id: "user-1", username: "daily_light_01" });
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("passes explicit entryDate into startInterview", async () => {
    mockStartInterview.mockResolvedValue(buildStartInterviewResponse());

    const response = await startInterviewRoute(
      new Request("http://localhost/api/interview/session/start", {
        method: "POST",
        body: JSON.stringify({
          dimension: "joy",
          entryDate: "2026-04-21"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(mockStartInterview).toHaveBeenCalledWith("user-1", "joy", "2026-04-21");
    expect(mockResponseParse).toHaveBeenCalledTimes(1);
  });

  it("rejects impossible entryDate values", async () => {
    const response = await startInterviewRoute(
      new Request("http://localhost/api/interview/session/start", {
        method: "POST",
        body: JSON.stringify({
          dimension: "joy",
          entryDate: "2026-02-30"
        })
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_START_REQUEST" });
    expect(mockStartInterview).not.toHaveBeenCalled();
  });

  it("returns 500 when the service fails", async () => {
    mockStartInterview.mockRejectedValue(new Error("db unavailable"));

    const response = await startInterviewRoute(
      new Request("http://localhost/api/interview/session/start", {
        method: "POST",
        body: JSON.stringify({
          dimension: "joy",
          entryDate: "2026-04-21"
        })
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "INTERVIEW_START_FAILED" });
  });

  it("returns 401 when authentication is required", async () => {
    mockRequireCurrentUserFromRequest.mockRejectedValueOnce(new Error("AUTHENTICATION_REQUIRED"));

    const response = await startInterviewRoute(
      new Request("http://localhost/api/interview/session/start", {
        method: "POST",
        body: JSON.stringify({
          dimension: "gratitude",
          entryDate: "2026-04-21"
        })
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "AUTHENTICATION_REQUIRED" });
    expect(mockStartInterview).not.toHaveBeenCalled();
  });
});
