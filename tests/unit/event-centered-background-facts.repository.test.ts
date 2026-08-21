/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EVENT_CENTERED_BACKGROUND_FACTS_TASK_CODES,
  createEventCenteredBackgroundFactsTaskContext,
  withEventCenteredBackgroundFactsGenerationInput
} from "@/features/interview/event-centered/background-facts-task";

const { mockPrisma, mocks } = vi.hoisted(() => {
  const delegate = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  });
  const mockPrisma: Record<string, any> = {
    aIGenerationTrace: delegate(),
    interviewEvent: delegate(),
    interviewUserTurn: delegate(),
    journalEventFact: delegate(),
    journalEventFactEvidence: delegate(),
    journalEventFactRevision: delegate(),
    journalEventFactRevisionTarget: delegate(),
    journalEventUnderstandingClaim: delegate()
  };
  mockPrisma.$transaction = vi.fn(async (callback: (database: typeof mockPrisma) => unknown) =>
    callback(mockPrisma)
  );
  return {
    mockPrisma,
    mocks: {
      route: vi.fn(),
      projectionForPath: vi.fn(),
      projection: vi.fn(),
      repairs: vi.fn()
    }
  };
});
vi.mock("@/server/db/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/repositories/journal-event-fact-revision.repository", () => ({
  getEventCenteredRouteWithClient: mocks.route,
  getEffectiveJournalEventFactProjectionForPathWithClient: mocks.projectionForPath,
  getEffectiveJournalEventFactProjectionWithClient: mocks.projection
}));
vi.mock("@/server/repositories/journal-event-angle-repair.repository", () => ({
  enqueueJournalEventAngleRepairsWithClient: mocks.repairs
}));

import {
  applyEventCenteredBackgroundFactsResult,
  claimNextEventCenteredBackgroundFactsTask
} from "@/server/repositories/event-centered-background-facts.repository";

const now = new Date("2026-08-20T08:00:00.000Z");

function pathMessage(input: {
  id: string;
  role: "user" | "assistant";
  sequence: number;
  userTurnId?: string | null;
}) {
  return {
    ...input,
    sessionId: "branch-1",
    userTurnId: input.userTurnId ?? null,
    createdAt: new Date(now.getTime() + input.sequence * 1000)
  };
}

function route(messages: ReturnType<typeof pathMessage>[]) {
  return {
    event: {
      id: "event-1",
      userId: "user-1",
      rootSessionId: "root-1",
      status: "active",
      rootSession: {
        id: "root-1",
        mode: "event_centered",
        status: "active",
        activeBranchSessionId: "branch-1"
      }
    },
    branch: {
      id: "branch-1",
      userId: "user-1",
      mode: "event_centered",
      status: "active",
      rootSessionId: "root-1",
      activeEventId: "state-1",
      stage: "collect_event",
      turnCount: 1,
      lastAssistantQuestion: null,
      draftSummary: null
    },
    path: { rootSessionId: "root-1", messages }
  };
}

function projection(facts: any[] = []) {
  return {
    facts,
    effectiveFactIds: facts.map((fact) => fact.id),
    invalidatedFactIds: [],
    deprioritizedFactIds: [],
    explorationFactIds: facts.map((fact) => fact.id),
    pendingClarification: null
  };
}

function fact(input: Record<string, unknown> = {}) {
  return {
    id: "fact-old",
    eventId: "event-1",
    createdBranchSessionId: "branch-1",
    pathAnchorMessageId: "U0",
    createdByRevisionId: null,
    statement: "用户已经不在意与他人比较",
    scope: "current_event",
    stance: "affirmed",
    kind: "stated_interpretation",
    origin: "user_expression",
    createdAt: now.toISOString(),
    evidence: [{
      id: "evidence-old",
      factId: "fact-old",
      sourceTurnId: "turn-0",
      contextMessageId: null,
      pathAnchorMessageId: "U0",
      role: "direct_expression",
      quote: "已经比较接纳了",
      createdAt: now.toISOString()
    }],
    ...input
  };
}

function taskContext(input: {
  conversation: Array<{ id: string; role: "user" | "assistant"; content: string }>;
  generationInput: {
    conversation: Array<{ id: string; role: "user" | "assistant"; content: string }>;
    pendingUserMessageIds: string[];
    effectiveFacts: Array<{ id: string; statement: string; sourceUserMessageId: string | null }>;
    currentVisibleAssistantMessageId: string;
    explicitCorrectionTargetAssistantMessageId: string | null;
  };
  sourceUserMessageId?: string;
  assistantMessageId?: string;
}) {
  const context = createEventCenteredBackgroundFactsTaskContext({
    branchStateId: "state-1",
    sourceTurnId: "turn-1",
    sourceUserMessageId: input.sourceUserMessageId ?? "U1",
    currentVisibleAssistantMessageId: input.assistantMessageId ?? "A1",
    conversation: input.conversation,
    explicitCorrectionTargetAssistantMessageId:
      input.generationInput.explicitCorrectionTargetAssistantMessageId
  });
  return withEventCenteredBackgroundFactsGenerationInput({
    context,
    generationInput: input.generationInput,
    preparedAt: now.toISOString()
  });
}

function trace(input: {
  contextSnapshot: unknown;
  output: unknown;
}) {
  return {
    id: "background-1",
    sessionId: "branch-1",
    journalEventId: "event-1",
    contextSnapshot: input.contextSnapshot,
    finalOutput: { output: input.output },
    pipelineDecisions: []
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(
    async (callback: (database: typeof mockPrisma) => unknown) => callback(mockPrisma)
  );
  mockPrisma.aIGenerationTrace.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.interviewEvent.findUnique.mockResolvedValue({
    id: "state-1",
    sessionId: "branch-1",
    snapshotData: { kind: "event_centered", schemaVersion: 4 }
  });
  mockPrisma.interviewEvent.update.mockResolvedValue({ id: "state-1" });
  mockPrisma.journalEventFactEvidence.createMany.mockResolvedValue({ count: 1 });
  mockPrisma.journalEventFactRevisionTarget.createMany.mockResolvedValue({ count: 1 });
  mockPrisma.journalEventFactRevision.findUnique.mockResolvedValue(null);
  mockPrisma.journalEventUnderstandingClaim.findMany.mockResolvedValue([]);
  mockPrisma.journalEventUnderstandingClaim.updateMany.mockResolvedValue({ count: 1 });
  mocks.repairs.mockResolvedValue({
    repairIds: [],
    affectedOutcomeIds: [],
    repairPendingAngles: []
  });
});

describe("event centered background facts repository", () => {
  it("按队列顺序领取未开始任务，并在调用前写入 started", async () => {
    const conversation = [
      { id: "U1", role: "user" as const, content: "今天开会时有点紧张。" },
      { id: "A1", role: "assistant" as const, content: "听起来你有些紧张。" }
    ];
    const context = createEventCenteredBackgroundFactsTaskContext({
      branchStateId: "state-1",
      sourceTurnId: "turn-1",
      sourceUserMessageId: "U1",
      currentVisibleAssistantMessageId: "A1",
      conversation,
      explicitCorrectionTargetAssistantMessageId: null
    });
    mockPrisma.aIGenerationTrace.findMany.mockResolvedValue([{
      id: "background-1",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "pending",
      errorCode: null,
      contextSnapshot: context,
      updatedAt: now
    }]);

    const result = await claimNextEventCenteredBackgroundFactsTask({
      userId: "user-1",
      sessionId: "branch-1",
      now
    });

    expect(result).toMatchObject({ kind: "started", traceId: "background-1" });
    expect(mockPrisma.aIGenerationTrace.updateMany).toHaveBeenCalledWith({
      where: { id: "background-1", status: "pending", errorCode: null },
      data: { errorCode: EVENT_CENTERED_BACKGROUND_FACTS_TASK_CODES.started }
    });
  });

  it("把事实与逐字来源写入同一事件，并在完成后关闭任务", async () => {
    const messages = [
      pathMessage({ id: "U1", role: "user", sequence: 1, userTurnId: "turn-1" }),
      pathMessage({ id: "A1", role: "assistant", sequence: 2, userTurnId: "turn-1" })
    ];
    const conversation = [
      { id: "U1", role: "user" as const, content: "今天开会时我有点紧张。" },
      { id: "A1", role: "assistant" as const, content: "听起来这次开会让你有些紧张。" }
    ];
    const generationInput = {
      conversation,
      pendingUserMessageIds: ["U1"],
      effectiveFacts: [],
      currentVisibleAssistantMessageId: "A1",
      explicitCorrectionTargetAssistantMessageId: null
    };
    const output = {
      processedUserMessageIds: ["U1"],
      factDeltas: [{
        sourceUserMessageId: "U1",
        statement: "用户在今天的会议中感到紧张",
        quote: "有点紧张",
        scope: "current_event" as const,
        stance: "affirmed" as const,
        kind: "inner_experience" as const
      }],
      corrections: []
    };
    mockPrisma.aIGenerationTrace.findUnique.mockResolvedValue(trace({
      contextSnapshot: taskContext({ conversation, generationInput }),
      output
    }));
    mocks.route.mockResolvedValue(route(messages));
    mocks.projectionForPath.mockResolvedValue(projection());
    mocks.projection.mockResolvedValue(projection([fact({
      id: "fact-new",
      statement: output.factDeltas[0].statement,
      kind: "inner_experience",
      pathAnchorMessageId: "U1"
    })]));
    mockPrisma.interviewUserTurn.findMany.mockResolvedValue([{
      id: "turn-1",
      sessionId: "branch-1",
      journalEventId: "event-1",
      rawText: "今天开会时我有点紧张。"
    }]);
    mockPrisma.journalEventFact.create.mockImplementation(async ({ data }: any) => data);

    const result = await applyEventCenteredBackgroundFactsResult({
      traceId: "background-1",
      userId: "user-1"
    });

    expect(result).toMatchObject({ kind: "applied", revisionId: null });
    expect(mockPrisma.journalEventFact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: "event-1",
        pathAnchorMessageId: "U1",
        statement: "用户在今天的会议中感到紧张",
        origin: "user_expression"
      })
    });
    expect(mockPrisma.journalEventFactEvidence.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        sourceTurnId: "turn-1",
        pathAnchorMessageId: "U1",
        quote: "有点紧张"
      })],
      skipDuplicates: true
    });
    expect(mockPrisma.aIGenerationTrace.update).toHaveBeenCalledWith({
      where: { id: "background-1" },
      data: expect.objectContaining({ status: "completed", errorCode: null })
    });
  });

  it("纠正会使旧事实失效，并撤回被点名的待确认理解", async () => {
    const messages = [
      pathMessage({ id: "U0", role: "user", sequence: 1, userTurnId: "turn-0" }),
      pathMessage({ id: "A0", role: "assistant", sequence: 2, userTurnId: "turn-0" }),
      pathMessage({ id: "U1", role: "user", sequence: 3, userTurnId: "turn-1" }),
      pathMessage({ id: "A1", role: "assistant", sequence: 4, userTurnId: "turn-1" })
    ];
    const conversation = [
      { id: "U0", role: "user" as const, content: "我现在已经比较接纳了。" },
      { id: "A0", role: "assistant" as const, content: "你已经接纳了这件事。" },
      { id: "U1", role: "user" as const, content: "其实我还是很在意比较，刚才是假装没感觉。" },
      { id: "A1", role: "assistant" as const, content: "原来你其实仍然很在意比较。" }
    ];
    const generationInput = {
      conversation,
      pendingUserMessageIds: ["U1"],
      effectiveFacts: [{
        id: "fact-old",
        statement: "用户已经不在意与他人比较",
        sourceUserMessageId: "U0"
      }],
      currentVisibleAssistantMessageId: "A1",
      explicitCorrectionTargetAssistantMessageId: "A0"
    };
    const output = {
      processedUserMessageIds: ["U1"],
      factDeltas: [{
        sourceUserMessageId: "U1",
        statement: "用户其实仍然很在意与他人比较",
        quote: "还是很在意比较",
        scope: "cross_event_pattern" as const,
        stance: "affirmed" as const,
        kind: "stated_interpretation" as const
      }],
      corrections: [{
        sourceUserMessageId: "U1",
        quote: "刚才是假装没感觉",
        targets: [{ ref: "fact-old", relation: "supersede" as const }],
        supersededAssistantMessageIds: ["A0"]
      }]
    };
    mockPrisma.aIGenerationTrace.findUnique.mockResolvedValue(trace({
      contextSnapshot: taskContext({ conversation, generationInput }),
      output
    }));
    mocks.route.mockResolvedValue(route(messages));
    mocks.projectionForPath.mockResolvedValue(projection([fact()]));
    mocks.projection.mockResolvedValue({
      ...projection([fact({
        id: "fact-new",
        statement: output.factDeltas[0].statement,
        scope: "background",
        pathAnchorMessageId: "U1"
      })]),
      invalidatedFactIds: ["fact-old"]
    });
    mockPrisma.interviewUserTurn.findMany.mockResolvedValue([{
      id: "turn-1",
      sessionId: "branch-1",
      journalEventId: "event-1",
      rawText: "其实我还是很在意比较，刚才是假装没感觉。"
    }]);
    mockPrisma.journalEventUnderstandingClaim.findMany.mockResolvedValue([{
      id: "claim-old"
    }]);

    const result = await applyEventCenteredBackgroundFactsResult({
      traceId: "background-1",
      userId: "user-1"
    });

    expect(result).toMatchObject({
      kind: "applied",
      rejectedClaimId: "claim-old"
    });
    expect(mockPrisma.journalEventFactRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: "event-1",
        sourceTurnId: "turn-1",
        contextMessageId: "A0",
        decisionTraceId: "background-1"
      })
    });
    expect(mockPrisma.journalEventFactRevisionTarget.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        targetFactId: "fact-old",
        relation: "supersede"
      })]
    });
    expect(mockPrisma.journalEventUnderstandingClaim.updateMany).toHaveBeenCalledWith({
      where: { id: "claim-old", status: "pending" },
      data: expect.objectContaining({
        status: "rejected",
        rejectedByTurnId: "turn-1"
      })
    });
  });
});
