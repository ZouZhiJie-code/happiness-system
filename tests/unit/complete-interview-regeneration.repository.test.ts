import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  transactionClient,
  mockTransaction,
  mockGlobalSessionFindUnique,
  mockGlobalMessageFindMany,
  mockTransactionSessionFindUnique,
  mockTransactionSessionCreate,
  mockTransactionSessionUpdate,
  mockRegenerationFindUnique,
  mockRegenerationUpdate,
  mockTargetMessageFindUnique,
  mockMessageCount,
  mockMessageCreate,
  mockCheckpointFindUnique,
  mockCheckpointCreate,
  mockTraceUpdate,
  mockUserTurnUpdate,
  mockEventCreateMany,
  mockEventFindUnique,
  mockEventUpdate,
  mockCommitAngleResults,
  mockAngleResultTraceDecision,
  mockGetEventCenteredSessionIdentity,
  state
} = vi.hoisted(() => {
  const mockTransaction = vi.fn();
  const mockGlobalSessionFindUnique = vi.fn();
  const mockGlobalMessageFindMany = vi.fn();
  const mockTransactionSessionFindUnique = vi.fn();
  const mockTransactionSessionCreate = vi.fn();
  const mockTransactionSessionUpdate = vi.fn();
  const mockRegenerationFindUnique = vi.fn();
  const mockRegenerationUpdate = vi.fn();
  const mockTargetMessageFindUnique = vi.fn();
  const mockMessageCount = vi.fn();
  const mockMessageCreate = vi.fn();
  const mockCheckpointFindUnique = vi.fn();
  const mockCheckpointCreate = vi.fn();
  const mockTraceUpdate = vi.fn();
  const mockUserTurnUpdate = vi.fn();
  const mockEventCreateMany = vi.fn();
  const mockEventFindUnique = vi.fn();
  const mockEventUpdate = vi.fn();
  const mockCommitAngleResults = vi.fn();
  const mockAngleResultTraceDecision = vi.fn();
  const mockGetEventCenteredSessionIdentity = vi.fn();
  const transactionClient = {
    interviewSession: {
      findUnique: mockTransactionSessionFindUnique,
      create: mockTransactionSessionCreate,
      update: mockTransactionSessionUpdate
    },
    interviewEvent: {
      createMany: mockEventCreateMany,
      findUnique: mockEventFindUnique,
      update: mockEventUpdate
    },
    interviewMessage: {
      findUnique: mockTargetMessageFindUnique,
      count: mockMessageCount,
      create: mockMessageCreate
    },
    interviewBranchCheckpoint: {
      findUnique: mockCheckpointFindUnique,
      create: mockCheckpointCreate
    },
    aIGenerationTrace: {
      update: mockTraceUpdate
    },
    interviewUserTurn: {
      update: mockUserTurnUpdate
    },
    aIResponseRegeneration: {
      findUnique: mockRegenerationFindUnique,
      update: mockRegenerationUpdate
    }
  };
  const prismaMock = {
    $transaction: mockTransaction,
    interviewSession: {
      findUnique: mockGlobalSessionFindUnique,
      update: vi.fn()
    },
    interviewEvent: {
      create: vi.fn(),
      update: vi.fn()
    },
    interviewMessage: {
      findMany: mockGlobalMessageFindMany
    }
  };
  return {
    prismaMock,
    transactionClient,
    mockTransaction,
    mockGlobalSessionFindUnique,
    mockGlobalMessageFindMany,
    mockTransactionSessionFindUnique,
    mockTransactionSessionCreate,
    mockTransactionSessionUpdate,
    mockRegenerationFindUnique,
    mockRegenerationUpdate,
    mockTargetMessageFindUnique,
    mockMessageCount,
    mockMessageCreate,
    mockCheckpointFindUnique,
    mockCheckpointCreate,
    mockTraceUpdate,
    mockUserTurnUpdate,
    mockEventCreateMany,
    mockEventFindUnique,
    mockEventUpdate,
    mockCommitAngleResults,
    mockAngleResultTraceDecision,
    mockGetEventCenteredSessionIdentity,
    state: {
      order: [] as string[],
      mode: "dimension_legacy" as "dimension_legacy" | "event_centered",
      conversationSchemaVersion: 2,
      dimension: "joy" as "joy" | null,
      childSessionId: null as string | null,
      childBranchStateId: null as string | null,
      branchSnapshot: null as Record<string, unknown> | null
    }
  };
});

vi.mock("@/server/db/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/server/repositories/journal-event-angle-outcome.repository", () => ({
  angleResultTraceDecision: mockAngleResultTraceDecision,
  commitJournalEventAngleResultsWithClient: mockCommitAngleResults
}));

vi.mock("@/server/repositories/event-centered-interview.repository", () => ({
  getEventCenteredSessionIdentity: mockGetEventCenteredSessionIdentity
}));

import { completeInterviewRegeneration } from "@/server/repositories/joy-interview.repository";

const startedAt = new Date("2026-07-22T08:00:00.000Z");
const entryDate = new Date("2026-07-21T16:00:00.000Z");

function hydratedRootSession() {
  const event = {
    id: "event-root",
    sequence: 1,
    status: "active",
    stage: "collect_event",
    explorationRound: 1,
    coveredLenses: [],
    roundCoveredLenses: [],
    roundMeaningfulReplyCount: 0,
    totalMeaningfulReplyCount: 1,
    startMessageSequence: 0,
    event: null,
    feeling: null,
    whyItMattered: null,
    happinessType: null,
    selfPattern: null,
    snapshotData: { kind: "joy" },
    progressData: null,
    confidence: 0,
    missingSlots: ["event"],
    draftSummary: null,
    startedAt,
    completedAt: null
  };
  return {
    id: "root-1",
    userId: "user-1",
    mode: state.mode,
    dimension: state.dimension,
    conversationSchemaVersion: state.conversationSchemaVersion,
    rootSessionId: null,
    parentSessionId: null,
    forkMessageSequence: null,
    activeBranchSessionId: "root-1",
    status: "active",
    stage: "collect_event",
    activeEventId: event.id,
    turnCount: 1,
    lastAssistantQuestion: "原问题",
    draftSummary: null,
    finalEntryId: null,
    entryDate,
    startedAt,
    pausedAt: null,
    completedAt: null,
    activeEvent: { id: event.id, progressData: null },
    events: [event],
    messages: [],
    userTurns: [],
    snapshots: [
      {
        version: 0,
        event: null,
        feeling: null,
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        confidence: 0,
        missingSlots: ["event"]
      }
    ],
    joyEntry: null
  };
}

function installScenario(input: {
  mode: "dimension_legacy" | "event_centered";
  conversationSchemaVersion: number;
}) {
  state.mode = input.mode;
  state.conversationSchemaVersion = input.conversationSchemaVersion;
  state.dimension = input.mode === "event_centered" ? null : "joy";
  state.order = [];
  state.childSessionId = null;
  state.childBranchStateId = null;
  state.branchSnapshot = null;

  mockTransaction.mockImplementation(
    async (callback: (database: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient)
  );
  mockRegenerationFindUnique.mockResolvedValue({
    id: "regeneration-1",
    userTurnId: "turn-regenerate",
    generatedTraceId: "trace-regenerate",
    generatedMessageId: null,
    rootSessionId: "root-1",
    branchSessionId: "root-1",
    status: "processing"
  });
  mockTargetMessageFindUnique.mockResolvedValue({
    id: "assistant-target",
    sessionId: "root-1",
    responseGroupId: "response-group-1",
    sequence: 2
  });
  mockTransactionSessionFindUnique.mockImplementation(async (args: {
    include?: { journalEvent?: unknown };
  }) => {
    if (args.include?.journalEvent) {
      return {
        id: "root-1",
        userId: "user-1",
        mode: state.mode,
        dimension: state.dimension,
        conversationSchemaVersion: state.conversationSchemaVersion,
        activeBranchSessionId: "root-1",
        entryDate,
        startedAt,
        pausedAt: null,
        completedAt: null,
        journalEvent:
          state.mode === "event_centered" ? { id: "journal-event-1" } : null
      };
    }
    return {
      id: "root-1",
      userId: "user-1",
      mode: state.mode,
      dimension: state.dimension,
      conversationSchemaVersion: state.conversationSchemaVersion,
      stage: "collect_event",
      turnCount: 1,
      branchDepth: 0
    };
  });
  mockCheckpointFindUnique.mockResolvedValue({
    schemaVersion: 2,
    sessionState: {
      status: "active",
      stage: "collect_event",
      turnCount: 1,
      activeEventId: "branch-state-a1",
      draftSummary: null
    },
    eventsState: [
      {
        id: "branch-state-a1",
        sequence: 1,
        status: "active",
        stage: "collect_event",
        explorationRound: 1,
        coveredLenses: [],
        roundCoveredLenses: [],
        roundMeaningfulReplyCount: 0,
        totalMeaningfulReplyCount: 1,
        startMessageSequence: 0,
        event: null,
        feeling: null,
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        snapshotData: {
          kind: "event_centered",
          schemaVersion: 3,
          pendingAngleOutcomeRepairIds: ["repair-1"],
          repairPendingAngles: ["feeling"],
          reopenedAngles: [],
          lastAngleOutcomeIds: ["outcome-a1"]
        },
        progressData: null,
        confidence: 0,
        missingSlots: [],
        draftSummary: null,
        startedAt,
        completedAt: null
      }
    ]
  });
  mockMessageCount.mockResolvedValue(1);
  mockTransactionSessionCreate.mockImplementation(async (args: {
    data: { id: string };
  }) => {
    state.childSessionId = args.data.id;
    state.order.push("create_child");
    return { id: args.data.id };
  });
  mockEventCreateMany.mockImplementation(async (args: {
    data: Array<{ id: string; sessionId: string; snapshotData: Record<string, unknown> }>;
  }) => {
    const branchState = args.data[0];
    state.childBranchStateId = branchState?.id ?? null;
    state.branchSnapshot = branchState?.snapshotData ?? null;
    return { count: args.data.length };
  });
  mockEventFindUnique.mockImplementation(async (args: { where: { id: string } }) =>
    args.where.id === state.childBranchStateId
      ? {
          id: state.childBranchStateId,
          sessionId: state.childSessionId,
          snapshotData: state.branchSnapshot
        }
      : null
  );
  mockEventUpdate.mockImplementation(async (args: {
    where: { id: string };
    data: { snapshotData: Record<string, unknown> };
  }) => {
    if (args.where.id === state.childBranchStateId) {
      state.branchSnapshot = args.data.snapshotData;
    }
    return { id: args.where.id };
  });
  mockTraceUpdate.mockResolvedValue({ id: "trace-regenerate" });
  mockMessageCreate.mockResolvedValue({ id: "assistant-created" });
  mockCheckpointCreate.mockResolvedValue({ id: "checkpoint-created" });
  mockTransactionSessionUpdate.mockImplementation(async (args: {
    where: { id: string };
    data: { activeBranchSessionId?: string };
  }) => {
    if (args.where.id === "root-1" && args.data.activeBranchSessionId) {
      state.order.push("switch_active_branch");
    }
    return { id: args.where.id };
  });
  mockCommitAngleResults.mockImplementation(async () => {
    state.order.push("commit_angle_resolution");
    return {
      angleOutcomeIds: [],
      reopenedAngles: ["feeling"],
      resolutionFingerprint: "f".repeat(64)
    };
  });
  mockAngleResultTraceDecision.mockImplementation(
    (result: { angleOutcomeIds: string[]; reopenedAngles: string[] }) => ({
      kind: "journal_event_angle_outcome_commit",
      angleOutcomeIds: result.angleOutcomeIds,
      reopenedAngles: result.reopenedAngles,
      selectedAngle: null,
      repairDecisions: [{ repairId: "repair-1", decision: "reopen" }]
    })
  );
  mockGetEventCenteredSessionIdentity.mockImplementation(async () => ({
    mode: "event_centered",
    rootSessionId: "root-1",
    activeBranchSessionId: state.childSessionId,
    eventId: "journal-event-1",
    branchStateId: state.childBranchStateId,
    entryDate: "2026-07-22",
    conversationSchemaVersion: 3,
    sessionStatus: "active",
    eventStatus: "active",
    latestMessageSequence: 2,
    journalEvent: null
  }));
  mockUserTurnUpdate.mockResolvedValue({ id: "turn-regenerate" });
  mockRegenerationUpdate.mockResolvedValue({ id: "regeneration-1" });

  mockGlobalSessionFindUnique.mockImplementation(async (args: {
    include?: unknown;
    select?: { id?: unknown; messages?: unknown; mode?: unknown };
  }) => {
    if (args.select?.mode && !args.select.id) return { mode: state.mode };
    if (args.include) return hydratedRootSession();
    if (args.select?.messages) {
      return {
        id: "root-1",
        parentSessionId: null,
        forkMessageSequence: null,
        messages: []
      };
    }
    return {
      id: "root-1",
      userId: "user-1",
      rootSessionId: null,
      activeBranchSessionId: "root-1",
      mode: state.mode,
      conversationSchemaVersion: state.conversationSchemaVersion
    };
  });
  mockGlobalMessageFindMany.mockResolvedValue([]);
}

function completionInput() {
  return {
    userId: "user-1",
    sessionId: "root-1",
    regenerationId: "regeneration-1",
    userTurnId: "turn-regenerate",
    targetMessageId: "assistant-target",
    intent: "concretize" as const,
    assistantTurn: {
      insight: "",
      thinkingSummary: "把问题落到一个具体时刻。",
      analysis: "换成更具体的问法。",
      question: "当时最先发生的一个小细节是什么？",
      stateUpdate: {
        turnPhase: "digging" as const,
        shouldEndDimension: false,
        offerChoice: false,
        choiceReason: ""
      },
      meta: { depthReached: ["event" as const] }
    },
    candidates: [{ question: "当时最先发生的一个小细节是什么？" }],
    selectedCandidate: 0,
    checks: { passed: true },
    requestId: "request-1",
    outputOrigin: "llm" as const,
    latencyMs: 120,
    eventCenteredAngleRepairResolutions: [
      { repairId: "repair-1", decision: "reopen" as const }
    ]
  };
}

describe("completeInterviewRegeneration 聚焦契约", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("事件中心子分支继承根协议，并在切换活动分支后于同一事务提交修复结果", async () => {
    installScenario({ mode: "event_centered", conversationSchemaVersion: 3 });

    const result = await completeInterviewRegeneration(completionInput());

    expect(result.rootSessionId).toBe("root-1");
    expect(mockGetEventCenteredSessionIdentity).toHaveBeenCalledWith(
      "user-1",
      "root-1"
    );
    const childData = mockTransactionSessionCreate.mock.calls[0]?.[0]?.data;
    expect(childData).toMatchObject({
      mode: "event_centered",
      dimension: null,
      conversationSchemaVersion: 3,
      rootSessionId: "root-1",
      parentSessionId: "root-1"
    });
    const childSessionId = childData.id;
    const assistantMessageId = mockMessageCreate.mock.calls[0]?.[0]?.data.id;
    expect(mockTransactionSessionUpdate).toHaveBeenCalledWith({
      where: { id: "root-1" },
      data: { activeBranchSessionId: childSessionId }
    });
    expect(state.order).toEqual([
      "create_child",
      "switch_active_branch",
      "commit_angle_resolution"
    ]);
    expect(mockCommitAngleResults).toHaveBeenCalledWith(
      transactionClient,
      expect.objectContaining({
        userId: "user-1",
        eventId: "journal-event-1",
        activeBranchSessionId: childSessionId,
        sourceTurnId: "turn-regenerate",
        assistantMessageId,
        generationTraceId: "trace-regenerate",
        angleRepairResolutions: [
          { repairId: "repair-1", decision: "reopen" }
        ]
      })
    );

    const clonedSnapshot = mockEventCreateMany.mock.calls[0]?.[0]?.data[0]
      ?.snapshotData;
    expect(clonedSnapshot).toMatchObject({
      pendingAngleOutcomeRepairIds: ["repair-1"],
      repairPendingAngles: ["feeling"],
      reopenedAngles: [],
      lastAngleOutcomeIds: ["outcome-a1"]
    });
    expect(mockEventUpdate).toHaveBeenCalledWith({
      where: { id: state.childBranchStateId },
      data: {
        snapshotData: expect.objectContaining({
          pendingAngleOutcomeRepairIds: [],
          repairPendingAngles: [],
          reopenedAngles: ["feeling"],
          lastAngleOutcomeIds: []
        })
      }
    });
    const checkpointEventsState = mockCheckpointCreate.mock.calls[0]?.[0]?.data
      ?.eventsState as Array<{ id: string; snapshotData: Record<string, unknown> }>;
    expect(checkpointEventsState).toEqual([
      expect.objectContaining({
        id: state.childBranchStateId,
        snapshotData: expect.objectContaining({
          pendingAngleOutcomeRepairIds: [],
          repairPendingAngles: [],
          reopenedAngles: ["feeling"],
          lastAngleOutcomeIds: []
        })
      })
    ]);
    expect(mockTraceUpdate).toHaveBeenCalledTimes(2);
    expect(mockTraceUpdate.mock.calls[1]?.[0]?.data.pipelineDecisions).toEqual([
      expect.objectContaining({ kind: "intent_regeneration" }),
      expect.objectContaining({
        kind: "journal_event_angle_outcome_commit",
        reopenedAngles: ["feeling"],
        repairDecisions: [{ repairId: "repair-1", decision: "reopen" }]
      })
    ]);
  });

  it("历史 dimension_legacy 子分支继续继承旧协议且不提交事件角度修复", async () => {
    installScenario({ mode: "dimension_legacy", conversationSchemaVersion: 2 });

    const result = await completeInterviewRegeneration(completionInput());

    expect("id" in result).toBe(true);
    if (!("id" in result)) throw new Error("EXPECTED_LEGACY_SESSION");
    expect(result.id).toBe("root-1");
    expect(mockTransactionSessionCreate.mock.calls[0]?.[0]?.data).toMatchObject({
      mode: "dimension_legacy",
      dimension: "joy",
      conversationSchemaVersion: 2,
      rootSessionId: "root-1",
      parentSessionId: "root-1"
    });
    expect(state.order).toEqual(["create_child", "switch_active_branch"]);
    expect(mockCommitAngleResults).not.toHaveBeenCalled();
    expect(mockGetEventCenteredSessionIdentity).not.toHaveBeenCalled();
  });
});
