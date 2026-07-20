import {
  interviewSessionSchema,
  respondInterviewRequestSchema
} from "@/features/interview/schema/interview.schema";

describe("UserTurn request schema", () => {
  it("maps legacy userMessage to rawText without changing the original expression", () => {
    const result = respondInterviewRequestSchema.parse({
      action: "reply",
      sessionId: "session-1",
      userMessage: "  我其实不太确定。\n但先这样说。  ",
      inputMode: "text"
    });

    expect(result).toMatchObject({
      action: "reply",
      rawText: "  我其实不太确定。\n但先这样说。  ",
      userMessage: "  我其实不太确定。\n但先这样说。  "
    });
  });

  it("accepts short, ambiguous, negative, and correction expressions as turns", () => {
    for (const rawText of ["嗯", "不确定", "没有", "刚才说错了"]) {
      expect(
        respondInterviewRequestSchema.safeParse({
          action: "reply",
          sessionId: "session-1",
          clientTurnId: `turn-${rawText}`,
          baseMessageSequence: 2,
          rawText,
          inputMode: "text"
        }).success
      ).toBe(true);
    }
  });

  it("counts Unicode code points for the 1200-character boundary", () => {
    expect(
      respondInterviewRequestSchema.safeParse({
        action: "reply",
        sessionId: "session-1",
        rawText: "🙂".repeat(1200),
        inputMode: "text"
      }).success
    ).toBe(true);

    expect(
      respondInterviewRequestSchema.safeParse({
        action: "reply",
        sessionId: "session-1",
        rawText: "🙂".repeat(1201),
        inputMode: "text"
      }).success
    ).toBe(false);
  });

  it("accepts structured actions and resume_turn identities", () => {
    expect(
      respondInterviewRequestSchema.parse({
        action: "next_event",
        sessionId: "session-1",
        clientTurnId: "turn-action",
        baseMessageSequence: 5
      })
    ).toEqual({
      action: "next_event",
      sessionId: "session-1",
      clientTurnId: "turn-action",
      baseMessageSequence: 5
    });

    expect(
      respondInterviewRequestSchema.parse({
        action: "resume_turn",
        sessionId: "session-1",
        clientTurnId: "turn-action"
      })
    ).toEqual({
      action: "resume_turn",
      sessionId: "session-1",
      clientTurnId: "turn-action"
    });
  });

  it("exposes an unresolved UserTurn in the session response", () => {
    const parsed = interviewSessionSchema.parse({
      id: "session-1",
      dimension: "joy",
      status: "active",
      stage: "collect_event",
      activeEventId: null,
      draftGenerationUnlocked: false,
      turnCount: 0,
      lastAssistantQuestion: "",
      draftSummary: null,
      messages: [],
      snapshot: {
        event: null,
        feeling: null,
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        confidence: 0,
        missingSlots: []
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
        confidence: 0,
        missingSlots: []
      },
      events: [],
      pendingDecision: null,
      pendingUserTurn: {
        id: "turn-1",
        clientTurnId: "client-turn-1",
        sessionId: "session-1",
        activeEventId: null,
        action: "reply",
        rawText: "我想继续说这一段",
        inputMode: "text",
        baseMessageSequence: 0,
        status: "failed",
        attemptCount: 1,
        errorCode: "UPSTREAM_ERROR",
        createdAt: "2026-07-20T00:00:00.000Z",
        updatedAt: "2026-07-20T00:01:00.000Z",
        completedAt: null
      },
      entryDate: "2026-07-20",
      startedAt: "2026-07-20T00:00:00.000Z",
      pausedAt: null,
      completedAt: null,
      journalEntry: null
    });

    expect(parsed.pendingUserTurn).toMatchObject({
      id: "turn-1",
      status: "failed",
      rawText: "我想继续说这一段"
    });
  });
});
