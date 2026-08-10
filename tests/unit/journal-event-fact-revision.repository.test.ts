/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, state } = vi.hoisted(() => {
  const delegate = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn()
  });
  const mockPrisma: Record<string, any> = {
    interviewSession: delegate(),
    journalEvent: delegate(),
    interviewUserTurn: delegate(),
    interviewMessage: delegate(),
    interviewEvent: delegate(),
    interviewBranchCheckpoint: delegate(),
    journalEventFact: delegate(),
    journalEventFactEvidence: delegate(),
    journalEventFactRevision: delegate(),
    journalEventFactRevisionTarget: delegate(),
    journalEventAngleOutcome: delegate(),
    journalEventAngleOutcomeRepair: delegate(),
    journalEventUnderstandingClaim: delegate(),
    aIGenerationTrace: delegate()
  };
  mockPrisma.$transaction = vi.fn(async (callback: (database: typeof mockPrisma) => unknown) =>
    callback(mockPrisma)
  );
  return {
    mockPrisma,
    state: {
      facts: [] as any[],
      revisions: [] as any[],
      branchSnapshot: {} as Record<string, unknown>,
      sourceTurn: null as any,
      claim: null as any
    }
  };
});

vi.mock("@/server/db/prisma", () => ({ prisma: mockPrisma }));

import { commitEventCenteredTurnUnderstanding } from "@/server/repositories/journal-event-understanding.repository";
import {
  applyJournalEventFactRevision,
  assertEventCenteredForwardOperationAllowed,
  getEffectiveJournalEventFactProjection,
  rejectPendingUnderstandingClaim,
  resolvePendingJournalEventFactClarification,
  setPendingJournalEventFactClarification
} from "@/server/repositories/journal-event-fact-revision.repository";

const now = new Date("2026-07-22T10:00:00.000Z");

function message(
  id: string,
  role: "user" | "assistant",
  sequence: number,
  userTurnId: string | null = null
) {
  return {
    id,
    sessionId: "branch-1",
    userTurnId,
    role,
    sequence,
    createdAt: new Date(now.getTime() + sequence * 1000)
  };
}

function fact(id: string, pathAnchorMessageId = "user-source") {
  return {
    id,
    eventId: "event-1",
    createdBranchSessionId: "branch-1",
    pathAnchorMessageId,
    createdByRevisionId: null as string | null,
    statement: `事实 ${id}`,
    scope: "current_event",
    stance: "affirmed",
    kind: "event_detail",
    origin: "user_expression",
    createdAt: now,
    evidence: [] as any[]
  };
}

function installRoute(messages: ReturnType<typeof message>[]) {
  mockPrisma.journalEvent.findUnique.mockResolvedValue({
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
  });
  mockPrisma.interviewSession.findUnique.mockImplementation(async ({ select }: any) => {
    if (select?.messages) {
      return {
        id: "branch-1",
        rootSessionId: "root-1",
        parentSessionId: null,
        forkMessageSequence: null,
        messages
      };
    }
    return {
      id: "branch-1",
      userId: "user-1",
      mode: "event_centered",
      status: "active",
      rootSessionId: "root-1",
      activeEventId: "branch-state-1",
      stage: "collect_event",
      turnCount: 1,
      lastAssistantQuestion: "当时发生了什么？",
      draftSummary: null
    };
  });
  mockPrisma.journalEventFact.findMany.mockImplementation(async () => state.facts);
  mockPrisma.journalEventFactRevision.findMany.mockImplementation(async () => state.revisions);
  mockPrisma.journalEventFactRevision.findUnique.mockImplementation(
    async ({ where }: any) =>
      state.revisions.find((revision) => revision.sourceTurnId === where.sourceTurnId) ?? null
  );
  mockPrisma.interviewEvent.findUnique.mockImplementation(async () => ({
    id: "branch-state-1",
    sessionId: "branch-1",
    sequence: 1,
    status: "active",
    stage: "collect_event",
    snapshotData: state.branchSnapshot,
    progressData: null,
    missingSlots: [],
    startedAt: now,
    completedAt: null
  }));
  mockPrisma.interviewEvent.update.mockImplementation(async ({ data }: any) => {
    state.branchSnapshot = data.snapshotData;
    return { id: "branch-state-1" };
  });
  mockPrisma.interviewUserTurn.findUnique.mockImplementation(async () => state.sourceTurn);
  mockPrisma.interviewUserTurn.findMany.mockImplementation(async () =>
    state.sourceTurn
      ? [
          {
            id: state.sourceTurn.id,
            journalEventId: state.sourceTurn.journalEventId,
            rawText: state.sourceTurn.rawText,
            messages: state.sourceTurn.messages.map((item: any) => ({ id: item.id }))
          }
        ]
      : []
  );
  mockPrisma.aIGenerationTrace.create.mockResolvedValue({ id: "trace-created" });
  mockPrisma.journalEventFactRevision.create.mockImplementation(async ({ data }: any) => {
    state.revisions.push({ ...data, createdAt: now, targets: [], createdFacts: [] });
    return data;
  });
  mockPrisma.journalEventFactRevisionTarget.createMany.mockImplementation(
    async ({ data }: any) => {
      const rows = Array.isArray(data) ? data : [data];
      for (const row of rows) {
        const revision = state.revisions.find((item) => item.id === row.revisionId);
        revision?.targets.push({ ...row, createdAt: now });
      }
      return { count: rows.length };
    }
  );
  mockPrisma.journalEventFact.create.mockImplementation(async ({ data }: any) => {
    const created = { ...data, createdAt: now, evidence: [] };
    state.facts.push(created);
    const revision = state.revisions.find((item) => item.id === data.createdByRevisionId);
    revision?.createdFacts.push({ id: data.id });
    return created;
  });
  mockPrisma.journalEventFactEvidence.createMany.mockResolvedValue({ count: 1 });
  mockPrisma.interviewBranchCheckpoint.upsert.mockResolvedValue({ id: "checkpoint-1" });
  mockPrisma.journalEventUnderstandingClaim.findUnique.mockImplementation(async () => state.claim);
  mockPrisma.journalEventUnderstandingClaim.updateMany.mockImplementation(
    async ({ data }: any) => {
      if (!state.claim || state.claim.status !== "pending") return { count: 0 };
      state.claim = { ...state.claim, ...data };
      const revision = state.revisions.find(
        (item) => item.id === data.rejectedByRevisionId
      );
      if (revision) revision.rejectedClaim = { id: state.claim.id };
      return { count: 1 };
    }
  );
}

function installBranchTree(
  sessions: Record<
    string,
    {
      id: string;
      rootSessionId: string | null;
      parentSessionId: string | null;
      forkMessageSequence: number | null;
      messages: ReturnType<typeof message>[];
    }
  >,
  getActiveBranchId: () => string
) {
  mockPrisma.journalEvent.findUnique.mockImplementation(async () => ({
    id: "event-1",
    userId: "user-1",
    rootSessionId: "root-1",
    status: "active",
    rootSession: {
      id: "root-1",
      mode: "event_centered",
      status: "active",
      activeBranchSessionId: getActiveBranchId()
    }
  }));
  mockPrisma.interviewSession.findUnique.mockImplementation(async ({ where, select }: any) => {
    const session = sessions[where.id];
    if (!session) return null;
    if (select?.messages) return session;
    return {
      id: session.id,
      userId: "user-1",
      mode: "event_centered",
      status: "active",
      rootSessionId: session.rootSessionId,
      activeEventId: `branch-state-${session.id}`,
      stage: "collect_event",
      turnCount: 1,
      lastAssistantQuestion: null,
      draftSummary: null
    };
  });
  mockPrisma.journalEventFact.findMany.mockImplementation(async ({ where }: any) => {
    const messageIds = new Set(where.pathAnchorMessageId.in);
    return state.facts.filter((item) => messageIds.has(item.pathAnchorMessageId));
  });
  mockPrisma.journalEventFactRevision.findMany.mockImplementation(async ({ where }: any) => {
    const messageIds = new Set(where.pathAnchorMessageId.in);
    return state.revisions.filter((item) => messageIds.has(item.pathAnchorMessageId));
  });
  mockPrisma.interviewEvent.findUnique.mockResolvedValue({ snapshotData: {} });
}

function revisionInput() {
  return {
    userId: "user-1",
    eventId: "event-1",
    activeBranchSessionId: "branch-1",
    branchStateId: "branch-state-1",
    sourceTurnId: "turn-correction",
    pathAnchorMessageId: "user-correction",
    contextMessageId: "assistant-question",
    quote: "其实是周三",
    baseMessageSequence: 2,
    targets: [
      { factId: "fact-1", relation: "supersede" as const },
      { factId: "fact-2", relation: "supersede" as const }
    ],
    resultFacts: [
      {
        statement: "事情发生在周三",
        scope: "current_event" as const,
        stance: "affirmed" as const,
        kind: "event_detail" as const,
        origin: "user_expression" as const,
        pathAnchorMessageId: "user-correction",
        evidence: [
          {
            sourceTurnId: "turn-correction",
            contextMessageId: "assistant-question",
            pathAnchorMessageId: "user-correction",
            role: "direct_expression" as const,
            quote: "其实是周三"
          }
        ]
      }
    ],
    trace: {
      id: "trace-revision",
      outputOrigin: "llm" as const,
      contextSnapshot: {},
      finalOutput: {},
      pipelineDecisions: []
    }
  };
}

describe("journal event fact revisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.facts = [];
    state.revisions = [];
    state.branchSnapshot = {};
    state.sourceTurn = null;
    state.claim = null;
    mockPrisma.$transaction.mockImplementation(
      async (callback: (database: typeof mockPrisma) => unknown) => callback(mockPrisma)
    );
    mockPrisma.journalEventAngleOutcome.findMany.mockResolvedValue([]);
    mockPrisma.journalEventAngleOutcomeRepair.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.journalEventAngleOutcomeRepair.findFirst.mockResolvedValue(null);
  });

  it("projects invalidation and the latest exploration-focus decision independently", async () => {
    installRoute([
      message("assistant-opening", "assistant", 0),
      message("user-source", "user", 1, "turn-source"),
      message("assistant-question", "assistant", 2),
      message("user-correction", "user", 3, "turn-correction")
    ]);
    state.facts = [fact("fact-1"), fact("fact-2")];
    state.revisions = [
      {
        id: "revision-1",
        eventId: "event-1",
        branchSessionId: "branch-1",
        sourceTurnId: "turn-r1",
        pathAnchorMessageId: "user-correction",
        decisionTraceId: "trace-1",
        createdAt: new Date(now.getTime() + 4000),
        targets: [
          { targetFactId: "fact-1", relation: "supersede" },
          { targetFactId: "fact-2", relation: "deprioritize" }
        ]
      }
    ];

    const deprioritized = await getEffectiveJournalEventFactProjection("event-1", "branch-1");
    expect(deprioritized.effectiveFactIds).toEqual(["fact-2"]);
    expect(deprioritized.invalidatedFactIds).toEqual(["fact-1"]);
    expect(deprioritized.deprioritizedFactIds).toEqual(["fact-2"]);
    expect(deprioritized.explorationFactIds).toEqual([]);

    state.revisions.push({
      id: "revision-2",
      eventId: "event-1",
      branchSessionId: "branch-1",
      sourceTurnId: "turn-r2",
      pathAnchorMessageId: "user-correction",
      decisionTraceId: "trace-2",
      createdAt: new Date(now.getTime() + 5000),
      targets: [{ targetFactId: "fact-2", relation: "restore_focus" }]
    });
    const restored = await getEffectiveJournalEventFactProjection("event-1", "branch-1");
    expect(restored.deprioritizedFactIds).toEqual([]);
    expect(restored.explorationFactIds).toEqual(["fact-2"]);
  });

  it("keeps fact revisions on their branch and restores the sibling projection after switching versions", async () => {
    let activeBranchId = "branch-a";
    installBranchTree(
      {
        "root-1": {
          id: "root-1",
          rootSessionId: "root-1",
          parentSessionId: null,
          forkMessageSequence: null,
          messages: [
            message("root-opening", "assistant", 0),
            message("root-source", "user", 1, "turn-source")
          ]
        },
        "branch-a": {
          id: "branch-a",
          rootSessionId: "root-1",
          parentSessionId: "root-1",
          forkMessageSequence: 2,
          messages: [message("branch-a-correction", "user", 2, "turn-correction-a")]
        },
        "branch-b": {
          id: "branch-b",
          rootSessionId: "root-1",
          parentSessionId: "root-1",
          forkMessageSequence: 2,
          messages: [message("branch-b-reply", "user", 2, "turn-reply-b")]
        }
      },
      () => activeBranchId
    );
    state.facts = [fact("fact-shared", "root-source")];
    state.revisions = [
      {
        id: "revision-a",
        eventId: "event-1",
        branchSessionId: "branch-a",
        sourceTurnId: "turn-correction-a",
        pathAnchorMessageId: "branch-a-correction",
        decisionTraceId: "trace-a",
        createdAt: new Date(now.getTime() + 3000),
        targets: [{ targetFactId: "fact-shared", relation: "withdraw" }]
      }
    ];

    const branchA = await getEffectiveJournalEventFactProjection("event-1", "branch-a");
    expect(branchA.effectiveFactIds).toEqual([]);
    expect(branchA.invalidatedFactIds).toEqual(["fact-shared"]);

    activeBranchId = "branch-b";
    const branchB = await getEffectiveJournalEventFactProjection("event-1", "branch-b");
    expect(branchB.effectiveFactIds).toEqual(["fact-shared"]);
    expect(branchB.invalidatedFactIds).toEqual([]);
  });

  it("excludes old later facts and revisions when a historical correction forks before them", async () => {
    installBranchTree(
      {
        "root-1": {
          id: "root-1",
          rootSessionId: "root-1",
          parentSessionId: null,
          forkMessageSequence: null,
          messages: [
            message("root-opening", "assistant", 0),
            message("root-source", "user", 1, "turn-source"),
            message("root-question", "assistant", 2),
            message("old-correction", "user", 3, "turn-old-correction"),
            message("old-later-fact", "user", 4, "turn-old-later")
          ]
        },
        "branch-new": {
          id: "branch-new",
          rootSessionId: "root-1",
          parentSessionId: "root-1",
          forkMessageSequence: 3,
          messages: [message("new-correction", "user", 3, "turn-new-correction")]
        }
      },
      () => "branch-new"
    );
    state.facts = [
      fact("fact-shared", "root-source"),
      fact("fact-old-later", "old-later-fact")
    ];
    state.revisions = [
      {
        id: "revision-old-path",
        eventId: "event-1",
        branchSessionId: "root-1",
        sourceTurnId: "turn-old-correction",
        pathAnchorMessageId: "old-correction",
        decisionTraceId: "trace-old-path",
        createdAt: new Date(now.getTime() + 4000),
        targets: [{ targetFactId: "fact-shared", relation: "withdraw" }]
      }
    ];

    const projection = await getEffectiveJournalEventFactProjection("event-1", "branch-new");

    expect(projection.effectiveFactIds).toEqual(["fact-shared"]);
    expect(projection.invalidatedFactIds).toEqual([]);
    expect(projection.facts.map((item) => item.id)).not.toContain("fact-old-later");
  });

  it("keeps compatible supplemental facts together", async () => {
    installRoute([
      message("assistant-opening", "assistant", 0),
      message("user-source", "user", 1, "turn-source"),
      message("user-correction", "user", 2, "turn-correction")
    ]);
    state.facts = [fact("fact-1"), fact("fact-3", "user-correction")];
    state.revisions = [
      {
        id: "revision-supplement",
        eventId: "event-1",
        branchSessionId: "branch-1",
        sourceTurnId: "turn-correction",
        pathAnchorMessageId: "user-correction",
        decisionTraceId: "trace-supplement",
        createdAt: new Date(now.getTime() + 3000),
        targets: [{ targetFactId: "fact-1", relation: "supplement" }]
      }
    ];

    const projection = await getEffectiveJournalEventFactProjection("event-1", "branch-1");

    expect(projection.effectiveFactIds).toEqual(["fact-1", "fact-3"]);
    expect(projection.invalidatedFactIds).toEqual([]);
  });

  it("applies multiple targets and result facts as one revision batch", async () => {
    installRoute([
      message("assistant-opening", "assistant", 0),
      message("user-source", "user", 1, "turn-source"),
      message("assistant-question", "assistant", 2),
      message("user-correction", "user", 3, "turn-correction")
    ]);
    state.facts = [fact("fact-1"), fact("fact-2")];
    state.sourceTurn = {
      id: "turn-correction",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "processing",
      baseMessageSequence: 2,
      rawText: "其实是周三，而且我当时有点失落，不是之前说的时间。",
      messages: [{ id: "user-correction", sequence: 3 }]
    };

    const input = revisionInput();
    const result = await applyJournalEventFactRevision({
      ...input,
      resultFacts: [
        ...input.resultFacts,
        {
          statement: "用户当时有点失落",
          scope: "current_event",
          stance: "affirmed",
          kind: "inner_experience",
          origin: "user_expression",
          pathAnchorMessageId: "user-correction",
          evidence: [
            {
              sourceTurnId: "turn-correction",
              contextMessageId: "assistant-question",
              pathAnchorMessageId: "user-correction",
              role: "direct_expression",
              quote: "有点失落"
            }
          ]
        }
      ]
    });

    expect(result.kind).toBe("applied");
    expect(result.invalidatedFactIds).toEqual(["fact-1", "fact-2"]);
    expect(result.createdFactIds).toHaveLength(2);
    expect(result.effectiveFactIds).toEqual(result.createdFactIds);
    expect(
      state.facts
        .filter((item) => result.createdFactIds.includes(item.id))
        .map((item) => item.statement)
    ).toEqual(["事情发生在周三", "用户当时有点失落"]);
    expect(mockPrisma.journalEventFactRevision.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.journalEventFactRevisionTarget.createMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.aIGenerationTrace.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        artifactId: result.revisionId,
        triggerMessageId: "user-correction",
        journalEventId: "event-1"
      })
    });
    expect(state.branchSnapshot).toMatchObject({
      lastFactRevisionId: result.revisionId,
      invalidatedFactIds: ["fact-1", "fact-2"]
    });
  });

  it("replaces an affirmed fact with a sourced denied fact", async () => {
    installRoute([
      message("assistant-opening", "assistant", 0),
      message("user-source", "user", 1, "turn-source"),
      message("assistant-question", "assistant", 2),
      message("user-correction", "user", 3, "turn-correction")
    ]);
    state.facts = [fact("fact-1")];
    state.sourceTurn = {
      id: "turn-correction",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "processing",
      baseMessageSequence: 2,
      rawText: "我没有生气。",
      messages: [{ id: "user-correction", sequence: 3 }]
    };

    const result = await applyJournalEventFactRevision({
      ...revisionInput(),
      quote: "没有生气",
      targets: [{ factId: "fact-1", relation: "negate" }],
      resultFacts: [
        {
          statement: "用户没有生气",
          scope: "current_event",
          stance: "denied",
          kind: "inner_experience",
          origin: "user_expression",
          pathAnchorMessageId: "user-correction",
          evidence: [
            {
              sourceTurnId: "turn-correction",
              contextMessageId: "assistant-question",
              pathAnchorMessageId: "user-correction",
              role: "direct_expression",
              quote: "没有生气"
            }
          ]
        }
      ]
    });

    expect(result.invalidatedFactIds).toEqual(["fact-1"]);
    expect(state.facts.find((item) => result.createdFactIds.includes(item.id))).toMatchObject({
      stance: "denied",
      statement: "用户没有生气"
    });
  });

  it("withdraws a fact with all of its evidence without creating an opposite conclusion", async () => {
    installRoute([
      message("assistant-opening", "assistant", 0),
      message("user-source", "user", 1, "turn-source"),
      message("assistant-question", "assistant", 2),
      message("user-correction", "user", 3, "turn-correction")
    ]);
    const withdrawnFact = fact("fact-1");
    withdrawnFact.evidence = [
      {
        id: "evidence-1",
        factId: "fact-1",
        sourceTurnId: "turn-source",
        contextMessageId: null,
        pathAnchorMessageId: "user-source",
        role: "direct_expression",
        quote: "原始说法",
        createdAt: now
      },
      {
        id: "evidence-2",
        factId: "fact-1",
        sourceTurnId: "turn-source-repeat",
        contextMessageId: null,
        pathAnchorMessageId: "user-source",
        role: "repeated_support",
        quote: "再次支持",
        createdAt: new Date(now.getTime() + 1000)
      }
    ];
    state.facts = [withdrawnFact];
    state.sourceTurn = {
      id: "turn-correction",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "processing",
      baseMessageSequence: 2,
      rawText: "刚才那句别算。",
      messages: [{ id: "user-correction", sequence: 3 }]
    };

    const result = await applyJournalEventFactRevision({
      ...revisionInput(),
      quote: "别算",
      targets: [{ factId: "fact-1", relation: "withdraw" as const }],
      resultFacts: []
    });

    expect(result.createdFactIds).toEqual([]);
    expect(result.invalidatedFactIds).toEqual(["fact-1"]);
    expect(result.effectiveFactIds).toEqual([]);
    expect(state.facts).toHaveLength(1);
    expect(state.facts[0].evidence).toHaveLength(2);
  });

  it("creates a new fact id when the user returns to an earlier statement", async () => {
    installRoute([
      message("assistant-opening", "assistant", 0),
      message("user-original", "user", 1, "turn-original"),
      message("assistant-question-1", "assistant", 2),
      message("user-correction-1", "user", 3, "turn-correction-1"),
      message("assistant-question-2", "assistant", 4),
      message("user-correction-2", "user", 5, "turn-correction-2")
    ]);
    const original = fact("fact-original", "user-original");
    original.statement = "事情发生在周一";
    const replacement = fact("fact-replacement", "user-correction-1");
    replacement.statement = "事情发生在周二";
    replacement.createdByRevisionId = "revision-1";
    state.facts = [original, replacement];
    state.revisions = [
      {
        id: "revision-1",
        eventId: "event-1",
        branchSessionId: "branch-1",
        sourceTurnId: "turn-correction-1",
        pathAnchorMessageId: "user-correction-1",
        decisionTraceId: "trace-1",
        createdAt: new Date(now.getTime() + 3000),
        targets: [{ targetFactId: "fact-original", relation: "supersede" }],
        createdFacts: [{ id: "fact-replacement" }],
        rejectedClaim: null
      }
    ];
    state.sourceTurn = {
      id: "turn-correction-2",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "processing",
      baseMessageSequence: 4,
      rawText: "我重新想了想，还是周一。",
      messages: [{ id: "user-correction-2", sequence: 5 }]
    };

    const result = await applyJournalEventFactRevision({
      ...revisionInput(),
      sourceTurnId: "turn-correction-2",
      pathAnchorMessageId: "user-correction-2",
      contextMessageId: "assistant-question-2",
      quote: "还是周一",
      baseMessageSequence: 4,
      targets: [{ factId: "fact-replacement", relation: "supersede" }],
      resultFacts: [
        {
          statement: "事情发生在周一",
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          origin: "user_expression",
          pathAnchorMessageId: "user-correction-2",
          evidence: [
            {
              sourceTurnId: "turn-correction-2",
              contextMessageId: "assistant-question-2",
              pathAnchorMessageId: "user-correction-2",
              role: "direct_expression",
              quote: "还是周一"
            }
          ]
        }
      ]
    });

    expect(result.createdFactIds).toHaveLength(1);
    expect(result.createdFactIds[0]).not.toBe("fact-original");
    expect(result.effectiveFactIds).toEqual(result.createdFactIds);
    expect(
      state.facts.find((item) => item.id === result.createdFactIds[0])
    ).toMatchObject({ statement: "事情发生在周一" });
    expect(state.facts.find((item) => item.id === "fact-original")).toBe(original);
  });

  it("returns the existing batch when the same source turn is replayed", async () => {
    installRoute([
      message("assistant-opening", "assistant", 0),
      message("user-source", "user", 1, "turn-source"),
      message("assistant-question", "assistant", 2),
      message("user-correction", "user", 3, "turn-correction")
    ]);
    state.facts = [fact("fact-1")];
    state.sourceTurn = {
      id: "turn-correction",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "processing",
      baseMessageSequence: 2,
      rawText: "刚才那句别算。",
      messages: [{ id: "user-correction", sequence: 3 }]
    };
    const input = {
      ...revisionInput(),
      quote: "别算",
      targets: [{ factId: "fact-1", relation: "withdraw" as const }],
      resultFacts: []
    };

    const first = await applyJournalEventFactRevision(input);
    const result = await applyJournalEventFactRevision(input);

    expect(result).toMatchObject({
      kind: "existing",
      revisionId: first.revisionId,
      decisionTraceId: first.decisionTraceId
    });
    expect(mockPrisma.aIGenerationTrace.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.journalEventFactRevision.create).toHaveBeenCalledTimes(1);
  });

  it("rejects an idempotent replay from a different event owner", async () => {
    installRoute([
      message("assistant-opening", "assistant", 0),
      message("user-source", "user", 1, "turn-source"),
      message("assistant-question", "assistant", 2),
      message("user-correction", "user", 3, "turn-correction")
    ]);
    state.facts = [fact("fact-1")];
    state.sourceTurn = {
      id: "turn-correction",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "processing",
      baseMessageSequence: 2,
      rawText: "刚才那句别算。",
      messages: [{ id: "user-correction", sequence: 3 }]
    };
    const input = {
      ...revisionInput(),
      quote: "别算",
      targets: [{ factId: "fact-1", relation: "withdraw" as const }],
      resultFacts: []
    };
    await applyJournalEventFactRevision(input);

    await expect(
      applyJournalEventFactRevision({ ...input, userId: "user-2" })
    ).rejects.toThrow("EVENT_STATE_CHANGED");
  });

  it("rejects a replay whose semantic revision payload changed", async () => {
    installRoute([
      message("assistant-opening", "assistant", 0),
      message("user-source", "user", 1, "turn-source"),
      message("assistant-question", "assistant", 2),
      message("user-correction", "user", 3, "turn-correction")
    ]);
    state.facts = [fact("fact-1")];
    state.sourceTurn = {
      id: "turn-correction",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "processing",
      baseMessageSequence: 2,
      rawText: "刚才那句别算。",
      messages: [{ id: "user-correction", sequence: 3 }]
    };
    const input = {
      ...revisionInput(),
      quote: "别算",
      targets: [{ factId: "fact-1", relation: "withdraw" as const }],
      resultFacts: []
    };
    await applyJournalEventFactRevision(input);

    await expect(
      applyJournalEventFactRevision({ ...input, quote: "刚才那句" })
    ).rejects.toThrow("EVENT_FACT_REVISION_IDEMPOTENCY_CONFLICT");
  });

  it("converges a concurrent source-turn race to the winning revision", async () => {
    installRoute([
      message("assistant-opening", "assistant", 0),
      message("user-source", "user", 1, "turn-source"),
      message("assistant-question", "assistant", 2),
      message("user-correction", "user", 3, "turn-correction")
    ]);
    state.facts = [fact("fact-1")];
    state.sourceTurn = {
      id: "turn-correction",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "processing",
      baseMessageSequence: 2,
      rawText: "刚才那句别算。",
      messages: [{ id: "user-correction", sequence: 3 }]
    };
    const input = {
      ...revisionInput(),
      quote: "别算",
      targets: [{ factId: "fact-1", relation: "withdraw" as const }],
      resultFacts: []
    };
    const winner = await applyJournalEventFactRevision(input);
    mockPrisma.$transaction.mockRejectedValueOnce({ code: "P2002" });

    const result = await applyJournalEventFactRevision(input);

    expect(result).toMatchObject({
      kind: "existing",
      revisionId: winner.revisionId,
      decisionTraceId: winner.decisionTraceId
    });
  });

  it("rejects an ineffective target without writing a partial revision", async () => {
    installRoute([
      message("assistant-opening", "assistant", 0),
      message("assistant-question", "assistant", 2),
      message("user-correction", "user", 3, "turn-correction")
    ]);
    state.sourceTurn = {
      id: "turn-correction",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "processing",
      baseMessageSequence: 2,
      rawText: "刚才那句别算。",
      messages: [{ id: "user-correction", sequence: 3 }]
    };

    await expect(
      applyJournalEventFactRevision({
        ...revisionInput(),
        quote: "别算",
        targets: [{ factId: "missing-fact", relation: "withdraw" }],
        resultFacts: []
      })
    ).rejects.toThrow("EVENT_FACT_REVISION_TARGET_NOT_EFFECTIVE");
    expect(mockPrisma.journalEventFactRevision.create).not.toHaveBeenCalled();
    expect(mockPrisma.aIGenerationTrace.create).not.toHaveBeenCalled();
  });

  it.each([
    ["generating", "active"],
    ["completed", "completed"],
    ["abandoned", "abandoned"]
  ] as const)("closes revision writes while the event is %s", async (eventStatus, sessionStatus) => {
    installRoute([
      message("assistant-opening", "assistant", 0),
      message("user-source", "user", 1, "turn-source"),
      message("assistant-question", "assistant", 2),
      message("user-correction", "user", 3, "turn-correction")
    ]);
    state.facts = [fact("fact-1"), fact("fact-2")];
    mockPrisma.journalEvent.findUnique.mockResolvedValue({
      id: "event-1",
      userId: "user-1",
      rootSessionId: "root-1",
      status: eventStatus,
      rootSession: {
        id: "root-1",
        mode: "event_centered",
        status: sessionStatus,
        activeBranchSessionId: "branch-1"
      }
    });

    await expect(applyJournalEventFactRevision(revisionInput())).rejects.toThrow(
      "EVENT_STATE_CHANGED"
    );
    expect(mockPrisma.journalEventFactRevision.create).not.toHaveBeenCalled();
  });

  it("rejects the current pending claim through an immutable revision", async () => {
    installRoute([
      message("assistant-opening", "assistant", 0),
      message("user-source", "user", 1, "turn-source"),
      message("assistant-question", "assistant", 2),
      message("user-correction", "user", 3, "turn-correction")
    ]);
    state.facts = [fact("fact-1")];
    state.sourceTurn = {
      id: "turn-correction",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "processing",
      baseMessageSequence: 2,
      rawText: "我没有觉得被忽视。",
      messages: [{ id: "user-correction", sequence: 3 }]
    };
    state.claim = {
      id: "claim-1",
      eventId: "event-1",
      assistantMessageId: "assistant-question",
      status: "pending"
    };

    const result = await rejectPendingUnderstandingClaim({
      userId: "user-1",
      eventId: "event-1",
      activeBranchSessionId: "branch-1",
      branchStateId: "branch-state-1",
      sourceTurnId: "turn-correction",
      pathAnchorMessageId: "user-correction",
      contextMessageId: "assistant-question",
      quote: "没有觉得被忽视",
      baseMessageSequence: 2,
      claimId: "claim-1",
      trace: {
        id: "trace-reject",
        outputOrigin: "llm",
        contextSnapshot: {},
        finalOutput: {},
        pipelineDecisions: []
      }
    });

    expect(result.rejectedClaimId).toBe("claim-1");
    expect(state.claim).toMatchObject({
      status: "rejected",
      rejectedByTurnId: "turn-correction"
    });
    expect(state.branchSnapshot.pendingUnderstandingClaimId).toBeNull();
  });

  it("keeps a correction response sourced and prevents a new unsupported claim", async () => {
    installRoute([
      message("assistant-question", "assistant", 0),
      message("user-correction", "user", 1, "turn-correction")
    ]);
    state.sourceTurn = {
      id: "turn-correction",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "processing",
      baseMessageSequence: 0,
      rawText: "这里需要纠正。",
      messages: [{ id: "user-correction", sequence: 1 }]
    };
    state.revisions = [
      {
        id: "revision-correction",
        eventId: "event-1",
        branchSessionId: "branch-1",
        sourceTurnId: "turn-correction",
        pathAnchorMessageId: "user-correction",
        decisionTraceId: "trace-revision",
        createdAt: now,
        targets: [],
        createdFacts: [],
        rejectedClaim: null
      }
    ];

    await expect(
      commitEventCenteredTurnUnderstanding({
        userId: "user-1",
        eventId: "event-1",
        activeBranchSessionId: "branch-1",
        branchStateId: "branch-state-1",
        userTurnId: "turn-correction",
        assistantMessage: { content: "我已经按你的纠正更新了理解。" },
        facts: [],
        pendingClaim: {
          statement: "也许还有另一层原因",
          scope: "current_event",
          stance: "affirmed",
          kind: "stated_interpretation"
        },
        focusSummary: "按纠正后的事实继续",
        trace: {
          outputOrigin: "llm",
          contextSnapshot: {},
          finalOutput: {},
          pipelineDecisions: []
        },
        checks: {
          eventBoundaryPassed: true,
          factsHaveUserSource: true,
          visibleUnderstandingMatchesClaim: true,
          unsupportedClaimCount: 1
        }
      })
    ).rejects.toThrow("EVENT_CORRECTION_DERIVATION_NOT_ALLOWED");
    expect(mockPrisma.aIGenerationTrace.create).not.toHaveBeenCalled();
  });

  it("persists ambiguous clarification and blocks only forward-result operations", async () => {
    installRoute([
      message("assistant-opening", "assistant", 0),
      message("user-source", "user", 1, "turn-source"),
      message("assistant-question", "assistant", 2),
      message("user-correction", "user", 3, "turn-correction")
    ]);
    state.facts = [fact("fact-1"), fact("fact-2")];
    state.sourceTurn = {
      id: "turn-correction",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "processing",
      baseMessageSequence: 2,
      rawText: "刚才那句不对。",
      messages: [{ id: "user-correction", sequence: 3 }]
    };

    const pending = await setPendingJournalEventFactClarification({
      userId: "user-1",
      eventId: "event-1",
      activeBranchSessionId: "branch-1",
      branchStateId: "branch-state-1",
      sourceTurnId: "turn-correction",
      pathAnchorMessageId: "user-correction",
      baseMessageSequence: 2,
      kind: "ambiguous_target",
      candidateTargetFactIds: ["fact-1", "fact-2"],
      candidateFactDrafts: [],
      clarificationMessage: {
        id: "assistant-clarification",
        content: "你想纠正的是刚才哪一句？"
      },
      trace: {
        id: "trace-clarification",
        outputOrigin: "llm",
        contextSnapshot: {},
        finalOutput: {},
        pipelineDecisions: []
      }
    });

    expect(pending.kind).toBe("ambiguous_target");
    expect(mockPrisma.aIGenerationTrace.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.interviewMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "assistant-clarification",
        content: "你想纠正的是刚才哪一句？"
      })
    });
    expect(mockPrisma.interviewEvent.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.interviewUserTurn.update).toHaveBeenCalledWith({
      where: { id: "turn-correction" },
      data: expect.objectContaining({ status: "completed" })
    });
    expect(mockPrisma.interviewBranchCheckpoint.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { messageId: "assistant-clarification" }
      })
    );
    for (const operation of [
      "select_exploration_angle",
      "continue_exploration",
      "generate_event_journal"
    ] as const) {
      await expect(
        assertEventCenteredForwardOperationAllowed({
          eventId: "event-1",
          activeBranchSessionId: "branch-1",
          operation
        })
      ).rejects.toThrow("EVENT_FACT_CLARIFICATION_REQUIRED");
    }
    for (const operation of ["content_reply", "exit_event"] as const) {
      await expect(assertEventCenteredForwardOperationAllowed({
        eventId: "event-1",
        activeBranchSessionId: "branch-1",
        operation
      })).resolves.toBeUndefined();
    }
  });

  it("只把当前回复路径尚未解决的角度修复作为向前门禁", async () => {
    installRoute([
      message("assistant-opening", "assistant", 0),
      message("user-source", "user", 1, "turn-source"),
      message("user-correction", "user", 2, "turn-correction"),
      message("assistant-version-a2", "assistant", 3, "turn-correction")
    ]);
    mockPrisma.journalEventAngleOutcomeRepair.findFirst.mockResolvedValueOnce({
      id: "repair-pending-on-a2"
    });

    await expect(
      assertEventCenteredForwardOperationAllowed({
        eventId: "event-1",
        activeBranchSessionId: "branch-1",
        operation: "generate_event_journal"
      })
    ).rejects.toThrow("EVENT_ANGLE_OUTCOME_REPAIR_REQUIRED");

    expect(mockPrisma.journalEventAngleOutcomeRepair.findFirst).toHaveBeenCalledWith({
      where: {
        eventId: "event-1",
        pathAnchorMessageId: {
          in: [
            "assistant-opening",
            "user-source",
            "user-correction",
            "assistant-version-a2"
          ]
        },
        resolutions: {
          none: {
            resolvedMessageId: {
              in: [
                "assistant-opening",
                "user-source",
                "user-correction",
                "assistant-version-a2"
              ]
            }
          }
        }
      },
      select: { id: true }
    });
  });

  it("keeps the prior clarification when a second conflict tries to overwrite it", async () => {
    installRoute([
      message("assistant-opening", "assistant", 0),
      message("user-source", "user", 1, "turn-source"),
      message("user-correction", "user", 2, "turn-correction")
    ]);
    state.facts = [fact("fact-1"), fact("fact-2")];
    state.branchSnapshot = {
      pendingFactRevisionClarification: {
        kind: "ambiguous_target",
        sourceTurnId: "turn-previous",
        candidateTargetFactIds: ["fact-1", "fact-2"],
        candidateFactDrafts: [],
        clarificationMessageId: "assistant-previous-clarification"
      }
    };

    await expect(
      setPendingJournalEventFactClarification({
        userId: "user-1",
        eventId: "event-1",
        activeBranchSessionId: "branch-1",
        branchStateId: "branch-state-1",
        sourceTurnId: "turn-correction",
        pathAnchorMessageId: "user-correction",
        baseMessageSequence: 1,
        kind: "hard_conflict",
        candidateTargetFactIds: ["fact-1"],
        candidateFactDrafts: [
          {
            statement: "另一份候选事实",
            scope: "current_event",
            stance: "affirmed",
            kind: "event_detail"
          }
        ],
        clarificationMessage: {
          id: "assistant-new-clarification",
          content: "需要再确认一次。"
        },
        trace: {
          outputOrigin: "llm",
          contextSnapshot: {},
          finalOutput: {},
          pipelineDecisions: []
        }
      })
    ).rejects.toThrow("EVENT_FACT_CLARIFICATION_ALREADY_PENDING");
    expect(mockPrisma.interviewMessage.create).not.toHaveBeenCalled();
    expect(state.branchSnapshot).toMatchObject({
      pendingFactRevisionClarification: {
        sourceTurnId: "turn-previous",
        clarificationMessageId: "assistant-previous-clarification"
      }
    });
  });

  it("does not expose a clarification message when the atomic clarification write fails", async () => {
    installRoute([
      message("assistant-opening", "assistant", 0),
      message("user-source", "user", 1, "turn-source"),
      message("user-correction", "user", 2, "turn-correction")
    ]);
    state.facts = [fact("fact-1"), fact("fact-2")];
    state.sourceTurn = {
      id: "turn-correction",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "processing",
      baseMessageSequence: 1,
      rawText: "刚才那句不对。",
      messages: [{ id: "user-correction", sequence: 2 }]
    };
    mockPrisma.interviewMessage.create.mockRejectedValueOnce(new Error("MESSAGE_WRITE_FAILED"));

    await expect(
      setPendingJournalEventFactClarification({
        userId: "user-1",
        eventId: "event-1",
        activeBranchSessionId: "branch-1",
        branchStateId: "branch-state-1",
        sourceTurnId: "turn-correction",
        pathAnchorMessageId: "user-correction",
        baseMessageSequence: 1,
        kind: "ambiguous_target",
        candidateTargetFactIds: ["fact-1", "fact-2"],
        candidateFactDrafts: [],
        clarificationMessage: {
          id: "assistant-clarification",
          content: "你想纠正的是哪一句？"
        },
        trace: {
          outputOrigin: "llm",
          contextSnapshot: {},
          finalOutput: {},
          pipelineDecisions: []
        }
      })
    ).rejects.toThrow("MESSAGE_WRITE_FAILED");
    expect(mockPrisma.interviewEvent.update).not.toHaveBeenCalled();
    expect(mockPrisma.interviewUserTurn.update).not.toHaveBeenCalled();
    expect(mockPrisma.interviewBranchCheckpoint.upsert).not.toHaveBeenCalled();
  });

  it("keeps the conflict gate when the answer points to a different AI question", async () => {
    installRoute([
      message("user-source", "user", 0, "turn-source"),
      message("assistant-clarification", "assistant", 1),
      message("assistant-other", "assistant", 2),
      message("user-answer", "user", 3, "turn-answer")
    ]);
    state.facts = [fact("fact-1", "user-source")];
    state.branchSnapshot = {
      pendingFactRevisionClarification: {
        kind: "hard_conflict",
        sourceTurnId: "turn-conflict",
        candidateTargetFactIds: ["fact-1"],
        candidateFactDrafts: [
          {
            statement: "候选事实",
            scope: "current_event",
            stance: "affirmed",
            kind: "event_detail"
          }
        ],
        clarificationMessageId: "assistant-clarification"
      }
    };
    state.sourceTurn = {
      id: "turn-answer",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "processing",
      baseMessageSequence: 2,
      rawText: "刚才那句别算。",
      messages: [{ id: "user-answer", sequence: 3 }]
    };

    await expect(
      resolvePendingJournalEventFactClarification({
        clarificationResolution: "apply_revision",
        ...revisionInput(),
        sourceTurnId: "turn-answer",
        pathAnchorMessageId: "user-answer",
        contextMessageId: "assistant-other",
        quote: "别算",
        baseMessageSequence: 2,
        targets: [{ factId: "fact-1", relation: "withdraw" }],
        resultFacts: []
      })
    ).rejects.toThrow("EVENT_FACT_CLARIFICATION_CONTEXT_INVALID");
    expect(mockPrisma.journalEventFactRevision.create).not.toHaveBeenCalled();
    expect(state.branchSnapshot.pendingFactRevisionClarification).toBeTruthy();
  });

  it("keeps the conflict gate when a clarification adds a fact without handling a candidate", async () => {
    installRoute([
      message("user-source", "user", 0, "turn-source"),
      message("assistant-clarification", "assistant", 1),
      message("user-answer", "user", 2, "turn-answer")
    ]);
    state.facts = [fact("fact-1", "user-source")];
    state.branchSnapshot = {
      pendingFactRevisionClarification: {
        kind: "hard_conflict",
        sourceTurnId: "turn-source",
        candidateTargetFactIds: ["fact-1"],
        candidateFactDrafts: [
          {
            statement: "事情发生在周四",
            scope: "current_event",
            stance: "affirmed",
            kind: "event_detail"
          }
        ],
        clarificationMessageId: "assistant-clarification"
      }
    };
    state.sourceTurn = {
      id: "turn-answer",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "processing",
      baseMessageSequence: 1,
      rawText: "其实是周三。",
      messages: [{ id: "user-answer", sequence: 2 }]
    };

    await expect(
      resolvePendingJournalEventFactClarification({
        clarificationResolution: "apply_revision",
        ...revisionInput(),
        sourceTurnId: "turn-answer",
        pathAnchorMessageId: "user-answer",
        contextMessageId: "assistant-clarification",
        quote: "其实是周三",
        baseMessageSequence: 1,
        targets: [],
        resultFacts: [
          {
            statement: "事情发生在周三",
            scope: "current_event",
            stance: "affirmed",
            kind: "event_detail",
            origin: "user_expression",
            pathAnchorMessageId: "user-answer",
            evidence: [
              {
                sourceTurnId: "turn-answer",
                contextMessageId: "assistant-clarification",
                pathAnchorMessageId: "user-answer",
                role: "direct_expression",
                quote: "其实是周三"
              }
            ]
          }
        ]
      })
    ).rejects.toThrow("EVENT_FACT_CLARIFICATION_RESOLUTION_INVALID");
    expect(mockPrisma.journalEventFactRevision.create).not.toHaveBeenCalled();
    expect(state.branchSnapshot.pendingFactRevisionClarification).toBeTruthy();
  });

  it("requires every disputed fact to be withdrawn before resolving as unknown", async () => {
    installRoute([
      message("user-source", "user", 0, "turn-source"),
      message("assistant-clarification", "assistant", 1),
      message("user-answer", "user", 2, "turn-answer")
    ]);
    state.facts = [fact("fact-1", "user-source"), fact("fact-2", "user-source")];
    state.branchSnapshot = {
      pendingFactRevisionClarification: {
        kind: "hard_conflict",
        sourceTurnId: "turn-conflict",
        candidateTargetFactIds: ["fact-1", "fact-2"],
        candidateFactDrafts: [
          {
            statement: "候选事实",
            scope: "current_event",
            stance: "affirmed",
            kind: "event_detail"
          }
        ],
        clarificationMessageId: "assistant-clarification"
      }
    };
    state.sourceTurn = {
      id: "turn-answer",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "processing",
      baseMessageSequence: 1,
      rawText: "我记不清了。",
      messages: [{ id: "user-answer", sequence: 2 }]
    };

    await expect(
      resolvePendingJournalEventFactClarification({
        clarificationResolution: "withdraw_as_unknown",
        ...revisionInput(),
        sourceTurnId: "turn-answer",
        pathAnchorMessageId: "user-answer",
        contextMessageId: "assistant-clarification",
        quote: "记不清",
        baseMessageSequence: 1,
        targets: [{ factId: "fact-1", relation: "withdraw" }],
        resultFacts: [
          {
            statement: "用户记不清争议信息",
            scope: "current_event",
            stance: "unknown",
            kind: "boundary_answer",
            origin: "user_expression",
            pathAnchorMessageId: "user-answer",
            evidence: [
              {
                sourceTurnId: "turn-answer",
                contextMessageId: "assistant-clarification",
                pathAnchorMessageId: "user-answer",
                role: "direct_expression",
                quote: "记不清"
              }
            ]
          }
        ]
      })
    ).rejects.toThrow("EVENT_FACT_CLARIFICATION_UNKNOWN_INVALID");
    expect(mockPrisma.journalEventFactRevision.create).not.toHaveBeenCalled();
    expect(state.branchSnapshot.pendingFactRevisionClarification).toBeTruthy();
  });

  it("resolves an unknown answer by withdrawing disputed facts and clearing the gate", async () => {
    installRoute([
      message("assistant-opening", "assistant", 0),
      message("user-source", "user", 1, "turn-source"),
      message("assistant-clarification", "assistant", 2),
      message("user-answer", "user", 3, "turn-answer")
    ]);
    state.facts = [fact("fact-1")];
    state.branchSnapshot = {
      pendingFactRevisionClarification: {
        kind: "hard_conflict",
        sourceTurnId: "turn-conflict",
        candidateTargetFactIds: ["fact-1"],
        candidateFactDrafts: [
          {
            statement: "事情发生在周四",
            scope: "current_event",
            stance: "affirmed",
            kind: "event_detail"
          }
        ],
        clarificationMessageId: "assistant-clarification"
      }
    };
    state.sourceTurn = {
      id: "turn-answer",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "processing",
      baseMessageSequence: 2,
      rawText: "我记不清了。",
      messages: [{ id: "user-answer", sequence: 3 }]
    };

    const result = await resolvePendingJournalEventFactClarification({
      clarificationResolution: "withdraw_as_unknown",
      userId: "user-1",
      eventId: "event-1",
      activeBranchSessionId: "branch-1",
      branchStateId: "branch-state-1",
      sourceTurnId: "turn-answer",
      pathAnchorMessageId: "user-answer",
      contextMessageId: "assistant-clarification",
      quote: "记不清",
      baseMessageSequence: 2,
      targets: [{ factId: "fact-1", relation: "withdraw" }],
      resultFacts: [
        {
          statement: "用户记不清事件发生的准确时间",
          scope: "current_event",
          stance: "unknown",
          kind: "boundary_answer",
          origin: "user_expression",
          pathAnchorMessageId: "user-answer",
          evidence: [
            {
              sourceTurnId: "turn-answer",
              contextMessageId: "assistant-clarification",
              pathAnchorMessageId: "user-answer",
              role: "direct_expression",
              quote: "记不清"
            }
          ]
        }
      ],
      trace: {
        id: "trace-resolve",
        outputOrigin: "llm",
        contextSnapshot: {},
        finalOutput: {},
        pipelineDecisions: []
      }
    });

    expect(result.invalidatedFactIds).toEqual(["fact-1"]);
    expect(result.createdFactIds).toHaveLength(1);
    expect(mockPrisma.journalEventFactRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clarificationSourceTurnId: "turn-conflict" })
      })
    );
    expect(state.branchSnapshot.pendingFactRevisionClarification).toBeNull();
  });
});
