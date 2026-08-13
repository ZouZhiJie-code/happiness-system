const {
  mockTransaction,
  mockSessionFindUnique,
  mockTopTurnFindUnique,
  mockTopTurnUpdateMany,
  mockTxSessionFindUnique,
  mockTxTurnFindUnique,
  mockTxTurnFindFirst,
  mockTxTurnCreate,
  mockTxTurnUpdateMany,
  mockTxMessageFindFirst,
  mockTxMessageCreate
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockSessionFindUnique: vi.fn(),
  mockTopTurnFindUnique: vi.fn(),
  mockTopTurnUpdateMany: vi.fn(),
  mockTxSessionFindUnique: vi.fn(),
  mockTxTurnFindUnique: vi.fn(),
  mockTxTurnFindFirst: vi.fn(),
  mockTxTurnCreate: vi.fn(),
  mockTxTurnUpdateMany: vi.fn(),
  mockTxMessageFindFirst: vi.fn(),
  mockTxMessageCreate: vi.fn()
}));

const transactionClient = {
  interviewSession: {
    findUnique: mockTxSessionFindUnique
  },
  interviewUserTurn: {
    findUnique: mockTxTurnFindUnique,
    findFirst: mockTxTurnFindFirst,
    create: mockTxTurnCreate,
    updateMany: mockTxTurnUpdateMany
  },
  interviewMessage: {
    findFirst: mockTxMessageFindFirst,
    create: mockTxMessageCreate
  }
};

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    $transaction: mockTransaction,
    interviewSession: {
      findUnique: mockSessionFindUnique
    },
    interviewUserTurn: {
      findUnique: mockTopTurnFindUnique,
      updateMany: mockTopTurnUpdateMany
    }
  }
}));

import {
  persistInterviewUserTurnUnderstanding,
  persistInterviewUserTurnIntent,
  reserveInterviewUserTurn,
  resumeInterviewUserTurn
} from "@/server/repositories/joy-interview.repository";

const turnDate = new Date("2026-07-20T00:01:00.000Z");

function buildDatabaseTurn(
  overrides: Partial<{
    id: string;
    clientTurnId: string;
    status: "processing" | "completed" | "failed" | "canceled";
    attemptCount: number;
    errorCode: string | null;
    completedAt: Date | null;
  }> = {}
) {
  return {
    id: "turn-1",
    clientTurnId: "client-turn-1",
    sessionId: "session-1",
    activeEventId: "event-1",
    action: "reply" as const,
    rawText: "  原样保存这一句。\n",
    inputMode: "text" as const,
    baseMessageSequence: 0,
    status: "processing" as const,
    attemptCount: 1,
    errorCode: null,
    createdAt: turnDate,
    updatedAt: turnDate,
    completedAt: null,
    ...overrides
  };
}

function buildMappedSessionFixture(turn = buildDatabaseTurn()) {
  return {
    id: "session-1",
    userId: "user-1",
    dimension: "joy",
    status: "active",
    stage: "collect_event",
    activeEventId: "event-1",
    turnCount: 0,
    lastAssistantQuestion: "今天有什么让你开心的时刻？",
    draftSummary: null,
    finalEntryId: null,
    entryDate: new Date("2026-07-19T16:00:00.000Z"),
    startedAt: new Date("2026-07-20T00:00:00.000Z"),
    pausedAt: null,
    completedAt: null,
    activeEvent: {
      id: "event-1",
      progressData: null
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
        event: null,
        feeling: null,
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
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
          tags: []
        },
        understandingData: {
          version: "trusted-understanding-v2",
          eventId: "event-1",
          dimension: "joy",
          materials: [],
          targetStates: {},
          candidateEvents: [],
          candidateDimensions: [],
          conflicts: [],
          appliedTurnIds: [],
          lastAppliedMessageSequence: -1,
          risks: [],
          lastTurn: null
        },
        draftSummary: null,
        confidence: 0,
        missingSlots: [],
        startedAt: new Date("2026-07-20T00:00:00.000Z"),
        completedAt: null
      }
    ],
    messages: [
      {
        id: "assistant-opening",
        generationTraceId: null,
        userTurnId: null,
        userTurn: null,
        role: "assistant",
        inputMode: null,
        content: "今天有什么让你开心的时刻？",
        sequence: 0,
        createdAt: new Date("2026-07-20T00:00:00.000Z")
      },
      {
        id: "user-message-1",
        generationTraceId: null,
        userTurnId: turn.id,
        userTurn: {
          clientTurnId: turn.clientTurnId
        },
        role: "user",
        inputMode: "text",
        content: turn.rawText,
        sequence: 1,
        createdAt: turnDate
      }
    ],
    snapshots: [],
    userTurns: turn.status === "completed" ? [] : [turn],
    joyEntry: null
  };
}

describe("InterviewUserTurn repository lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(
      async (callback: (client: typeof transactionClient) => unknown) =>
        callback(transactionClient)
    );
    mockTxSessionFindUnique.mockImplementation(async (args: {
      select?: {
        messages?: unknown;
      };
    }) => {
      if (args.select?.messages) {
        return {
          id: "session-1",
          parentSessionId: null,
          forkMessageSequence: null,
          messages: [
            {
              id: "assistant-opening",
              generationTraceId: null,
              userTurnId: null,
              userTurn: null,
              role: "assistant",
              inputMode: null,
              content: "今天有什么让你开心的时刻？",
              sequence: 0,
              createdAt: new Date("2026-07-20T00:00:00.000Z")
            }
          ]
        };
      }

      return {
        id: "session-1",
        userId: "user-1"
      };
    });
    mockTxTurnFindUnique.mockResolvedValue(null);
    mockTxTurnFindFirst.mockResolvedValue(null);
    mockTxMessageFindFirst.mockResolvedValue({ sequence: 0 });
    mockTxMessageCreate.mockResolvedValue({ id: "user-message-1" });
  });

  it("reserves a turn and persists the exact raw text before processing", async () => {
    const storedTurn = buildDatabaseTurn();
    mockTxTurnCreate.mockImplementation(
      async ({ data }: { data: typeof storedTurn }) => ({
        ...storedTurn,
        ...data
      })
    );
    mockSessionFindUnique.mockResolvedValue(buildMappedSessionFixture(storedTurn));

    const result = await reserveInterviewUserTurn({
      userId: "user-1",
      sessionId: "session-1",
      activeEventId: "event-1",
      clientTurnId: "client-turn-1",
      action: "reply",
      rawText: "  原样保存这一句。\n",
      inputMode: "text",
      baseMessageSequence: 0
    });

    expect(result.kind).toBe("reserved");
    expect(mockTxTurnCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientTurnId: "client-turn-1",
        rawText: "  原样保存这一句。\n",
        baseMessageSequence: 0,
        status: "processing"
      })
    });
    expect(mockTxMessageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userTurnId: result.turn.id,
        content: "  原样保存这一句。\n",
        sequence: 1
      })
    });
    expect(result.session.pendingUserTurn).toMatchObject({
      id: "turn-1",
      status: "processing"
    });
    expect(result.session.events[0]?.understandingData).toBeDefined();
    expect(JSON.stringify(result.session)).not.toContain("understandingData");
  });

  it("returns a completed duplicate without creating another message", async () => {
    const completedTurn = {
      ...buildDatabaseTurn({
        status: "completed",
        completedAt: new Date("2026-07-20T00:02:00.000Z")
      }),
      messages: [{ id: "user-message-1" }]
    };
    mockTxTurnFindUnique.mockResolvedValue(completedTurn);
    mockSessionFindUnique.mockResolvedValue(
      buildMappedSessionFixture(
        buildDatabaseTurn({
          status: "completed",
          completedAt: new Date("2026-07-20T00:02:00.000Z")
        })
      )
    );

    const result = await reserveInterviewUserTurn({
      userId: "user-1",
      sessionId: "session-1",
      activeEventId: "event-1",
      clientTurnId: "client-turn-1",
      action: "reply",
      rawText: "  原样保存这一句。\n",
      inputMode: "text",
      baseMessageSequence: 0
    });

    expect(result.kind).toBe("completed");
    expect(result.userMessageId).toBe("user-message-1");
    expect(mockTxTurnCreate).not.toHaveBeenCalled();
    expect(mockTxMessageCreate).not.toHaveBeenCalled();
  });

  it("rejects a stale base sequence before persisting the turn", async () => {
    mockTxSessionFindUnique.mockImplementation(async (args: {
      select?: {
        messages?: unknown;
      };
    }) => {
      if (args.select?.messages) {
        return {
          id: "session-1",
          parentSessionId: null,
          forkMessageSequence: null,
          messages: [
            {
              id: "assistant-latest",
              generationTraceId: null,
              userTurnId: null,
              userTurn: null,
              role: "assistant",
              inputMode: null,
              content: "最新问题",
              sequence: 3,
              createdAt: new Date("2026-07-20T00:00:00.000Z")
            }
          ]
        };
      }

      return {
        id: "session-1",
        userId: "user-1"
      };
    });

    await expect(
      reserveInterviewUserTurn({
        userId: "user-1",
        sessionId: "session-1",
        activeEventId: "event-1",
        clientTurnId: "client-turn-stale",
        action: "reply",
        rawText: "基于旧问题的回答",
        inputMode: "text",
        baseMessageSequence: 1
      })
    ).rejects.toThrow("INTERVIEW_TURN_OUT_OF_DATE");

    expect(mockTxTurnCreate).not.toHaveBeenCalled();
    expect(mockTxMessageCreate).not.toHaveBeenCalled();
  });

  it("resumes a failed turn with the same identity and increments attempts", async () => {
    const failedTurn = {
      ...buildDatabaseTurn({
        status: "failed",
        errorCode: "UPSTREAM_ERROR"
      }),
      session: {
        userId: "user-1"
      },
      messages: [{ id: "user-message-1" }]
    };
    const resumedTurn = buildDatabaseTurn({
      status: "processing",
      attemptCount: 2
    });
    mockTxTurnFindUnique.mockResolvedValue(failedTurn);
    mockTxTurnUpdateMany.mockResolvedValue({ count: 1 });
    mockTxTurnFindUnique
      .mockResolvedValueOnce(failedTurn)
      .mockResolvedValueOnce(resumedTurn);
    mockSessionFindUnique.mockResolvedValue(buildMappedSessionFixture(resumedTurn));

    const result = await resumeInterviewUserTurn({
      userId: "user-1",
      sessionId: "session-1",
      clientTurnId: "client-turn-1"
    });

    expect(result.kind).toBe("reserved");
    expect(result.turn).toMatchObject({
      id: "turn-1",
      clientTurnId: "client-turn-1",
      attemptCount: 2,
      status: "processing",
      rawText: "  原样保存这一句。\n"
    });
    expect(mockTxTurnUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "turn-1",
        OR: [
          {
            status: {
              in: ["failed", "canceled"]
            }
          },
          {
            status: "processing",
            updatedAt: {
              lte: expect.any(Date)
            }
          }
        ]
      },
      data: {
        status: "processing",
        attemptCount: { increment: 1 },
        errorCode: null,
        completedAt: null
      }
    });
    expect(mockTxMessageCreate).not.toHaveBeenCalled();
  });

  it("allows only one concurrent resume to move a failed turn back to processing", async () => {
    const failedTurn = {
      ...buildDatabaseTurn({
        status: "failed",
        errorCode: "UPSTREAM_ERROR"
      }),
      session: {
        userId: "user-1"
      },
      messages: [{ id: "user-message-1" }]
    };
    mockTxTurnFindUnique.mockResolvedValue(failedTurn);
    mockTxTurnUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      resumeInterviewUserTurn({
        userId: "user-1",
        sessionId: "session-1",
        clientTurnId: "client-turn-1"
      })
    ).rejects.toThrow("INTERVIEW_TURN_IN_PROGRESS");

    expect(mockTxTurnUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("keeps a recent processing turn protected from duplicate resume", async () => {
    const processingTurn = {
      ...buildDatabaseTurn({
        status: "processing"
      }),
      updatedAt: new Date(),
      session: {
        userId: "user-1"
      },
      messages: [{ id: "user-message-1" }]
    };
    mockTxTurnFindUnique.mockResolvedValue(processingTurn);

    await expect(
      resumeInterviewUserTurn({
        userId: "user-1",
        sessionId: "session-1",
        clientTurnId: "client-turn-1"
      })
    ).rejects.toThrow("INTERVIEW_TURN_IN_PROGRESS");

    expect(mockTxTurnUpdateMany).not.toHaveBeenCalled();
  });

  it("reclaims a stale processing turn after an interrupted server request", async () => {
    const staleProcessingTurn = {
      ...buildDatabaseTurn({
        status: "processing"
      }),
      updatedAt: new Date(Date.now() - 120_000),
      session: {
        userId: "user-1"
      },
      messages: [{ id: "user-message-1" }]
    };
    const resumedTurn = {
      ...buildDatabaseTurn({
        status: "processing",
        attemptCount: 2
      }),
      updatedAt: new Date()
    };
    mockTxTurnFindUnique
      .mockResolvedValueOnce(staleProcessingTurn)
      .mockResolvedValueOnce(resumedTurn);
    mockTxTurnUpdateMany.mockResolvedValue({ count: 1 });
    mockSessionFindUnique.mockResolvedValue(buildMappedSessionFixture(resumedTurn));

    const result = await resumeInterviewUserTurn({
      userId: "user-1",
      sessionId: "session-1",
      clientTurnId: "client-turn-1"
    });

    expect(result.kind).toBe("reserved");
    expect(result.turn).toMatchObject({
      id: "turn-1",
      clientTurnId: "client-turn-1",
      attemptCount: 2,
      status: "processing"
    });
    expect(mockTxTurnUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "turn-1",
        OR: [
          {
            status: {
              in: ["failed", "canceled"]
            }
          },
          {
            status: "processing",
            updatedAt: {
              lte: expect.any(Date)
            }
          }
        ]
      },
      data: {
        status: "processing",
        attemptCount: { increment: 1 },
        errorCode: null,
        completedAt: null
      }
    });
  });

  it("persists an intent assessment only once", async () => {
    mockTopTurnFindUnique
      .mockResolvedValueOnce({
        intentAssessment: null,
        intentClassifierVersion: null,
        intentDecision: null,
        intentAssessedAt: null
      });
    mockTopTurnUpdateMany.mockResolvedValue({ count: 1 });

    const assessment = {
      version: "interview-intent-v1",
      primaryControl: "none"
    };
    const decision = {
      version: "interview-turn-policy-v1",
      runExtraction: true
    };
    const result = await persistInterviewUserTurnIntent({
      turnId: "turn-1",
      classifierVersion: "interview-intent-v1",
      assessment,
      decision
    });

    expect(mockTopTurnUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "turn-1",
        intentAssessedAt: null
      },
      data: expect.objectContaining({
        intentAssessment: assessment,
        intentClassifierVersion: "interview-intent-v1",
        intentDecision: decision,
        intentAssessedAt: expect.any(Date)
      })
    });
    expect(result).toMatchObject({
      intentAssessment: assessment,
      intentClassifierVersion: "interview-intent-v1",
      intentDecision: decision
    });
  });

  it("reuses an existing immutable intent assessment", async () => {
    const assessedAt = new Date("2026-07-20T00:03:00.000Z");
    const existing = {
      intentAssessment: { version: "interview-intent-v1" },
      intentClassifierVersion: "interview-intent-v1",
      intentDecision: { version: "interview-turn-policy-v1" },
      intentAssessedAt: assessedAt
    };
    mockTopTurnFindUnique.mockResolvedValue(existing);

    const result = await persistInterviewUserTurnIntent({
      turnId: "turn-1",
      classifierVersion: "interview-intent-v1",
      assessment: { version: "new" },
      decision: { version: "new" }
    });

    expect(result).toEqual(existing);
    expect(mockTopTurnUpdateMany).not.toHaveBeenCalled();
  });

  it("persists a turn understanding result only once for recovery", async () => {
    mockTopTurnFindUnique.mockResolvedValueOnce({
      understandingResult: null,
      understandingVersion: null,
      understoodAt: null
    });
    mockTopTurnUpdateMany.mockResolvedValue({ count: 1 });
    const result = {
      version: "turn-understanding-v2",
      turnId: "turn-1",
      materialUnits: []
    };

    const persisted = await persistInterviewUserTurnUnderstanding({
      turnId: "turn-1",
      version: "turn-understanding-v2",
      result
    });

    expect(mockTopTurnUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "turn-1",
        understoodAt: null
      },
      data: {
        understandingResult: result,
        understandingVersion: "turn-understanding-v2",
        understoodAt: expect.any(Date)
      }
    });
    expect(persisted).toMatchObject({
      understandingResult: result,
      understandingVersion: "turn-understanding-v2",
      understoodAt: expect.any(Date)
    });
  });

  it("reuses the persisted understanding result on the next attempt", async () => {
    const understoodAt = new Date("2026-07-20T00:04:00.000Z");
    const existing = {
      understandingResult: { version: "turn-understanding-v2", turnId: "turn-1" },
      understandingVersion: "turn-understanding-v2",
      understoodAt
    };
    mockTopTurnFindUnique.mockResolvedValue(existing);

    const result = await persistInterviewUserTurnUnderstanding({
      turnId: "turn-1",
      version: "turn-understanding-v2",
      result: { version: "replacement" }
    });

    expect(result).toEqual(existing);
    expect(mockTopTurnUpdateMany).not.toHaveBeenCalled();
  });
});
