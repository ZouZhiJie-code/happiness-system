/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
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
    interviewSession: delegate(),
    journalEvent: delegate(),
    interviewUserTurn: delegate(),
    interviewMessage: delegate(),
    interviewEvent: delegate(),
    interviewBranchCheckpoint: delegate(),
    journalEventFact: delegate(),
    journalEventFactEvidence: delegate(),
    journalEventUnderstandingClaim: delegate(),
    aIGenerationTrace: delegate()
  };
  mockPrisma.$transaction = vi.fn(async (callback: (database: typeof mockPrisma) => unknown) =>
    callback(mockPrisma)
  );
  return { mockPrisma };
});

vi.mock("@/server/db/prisma", () => ({ prisma: mockPrisma }));

import {
  commitEventCenteredTurnUnderstanding,
  confirmPendingUnderstandingClaim,
  getEffectiveJournalEventFacts,
  resumeEventCenteredTurnUnderstanding
} from "@/server/repositories/journal-event-understanding.repository";

const now = new Date("2026-07-22T08:00:00.000Z");

function activeEvent() {
  return {
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
  };
}

function activeBranch() {
  return {
    id: "branch-1",
    userId: "user-1",
    mode: "event_centered",
    status: "active",
    rootSessionId: "root-1",
    activeEventId: "branch-state-1",
    stage: "collect_event",
    turnCount: 0,
    lastAssistantQuestion: "发生了什么？",
    draftSummary: null
  };
}

function message(input: {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  sequence: number;
  userTurnId?: string | null;
}) {
  return {
    ...input,
    userTurnId: input.userTurnId ?? null,
    createdAt: new Date(now.getTime() + input.sequence * 1000)
  };
}

function installSingleBranchPath(messages: ReturnType<typeof message>[]) {
  mockPrisma.journalEvent.findUnique.mockResolvedValue(activeEvent());
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
    return activeBranch();
  });
}

describe("journal event facts and understanding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (callback: (database: typeof mockPrisma) => unknown) => callback(mockPrisma)
    );
  });

  it("projects facts through the active branch message path and excludes replaced siblings", async () => {
    const rootMessages = [
      message({ id: "root-opening", sessionId: "root-1", role: "assistant", sequence: 0 }),
      message({ id: "root-replaced", sessionId: "root-1", role: "assistant", sequence: 2 })
    ];
    const branchMessages = [
      message({ id: "branch-version", sessionId: "branch-1", role: "assistant", sequence: 1 })
    ];
    mockPrisma.journalEvent.findUnique.mockResolvedValue(activeEvent());
    mockPrisma.interviewSession.findUnique.mockImplementation(async ({ where, select }: any) => {
      if (!select?.messages) return activeBranch();
      if (where.id === "branch-1") {
        return {
          id: "branch-1",
          rootSessionId: "root-1",
          parentSessionId: "root-1",
          forkMessageSequence: 1,
          messages: branchMessages
        };
      }
      return {
        id: "root-1",
        rootSessionId: "root-1",
        parentSessionId: null,
        forkMessageSequence: null,
        messages: rootMessages
      };
    });
    mockPrisma.journalEventFact.findMany.mockImplementation(async ({ where }: any) => {
      expect(where.pathAnchorMessageId.in).toEqual(["root-opening", "branch-version"]);
      return [
        {
          id: "fact-1",
          eventId: "event-1",
          createdBranchSessionId: "branch-1",
          pathAnchorMessageId: "branch-version",
          statement: "用户选择了当前回复路径",
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          origin: "user_expression",
          createdAt: now,
          evidence: []
        }
      ];
    });

    const facts = await getEffectiveJournalEventFacts("event-1", "branch-1");

    expect(facts.map((fact) => fact.id)).toEqual(["fact-1"]);
  });

  it("turns the current assistant hypothesis into one sourced fact on a forward turn", async () => {
    const pathMessages = [
      message({ id: "assistant-1", sessionId: "branch-1", role: "assistant", sequence: 0 }),
      message({
        id: "user-message-1",
        sessionId: "branch-1",
        role: "user",
        sequence: 1,
        userTurnId: "turn-1"
      })
    ];
    installSingleBranchPath(pathMessages);
    mockPrisma.interviewUserTurn.findUnique.mockResolvedValue({
      id: "turn-1",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "processing",
      messages: [{ id: "user-message-1" }]
    });
    const claim = {
      id: "claim-1",
      eventId: "event-1",
      statement: "这件事可能让用户感到被认真对待",
      scope: "current_event",
      stance: "affirmed",
      kind: "inner_experience",
      confirmedFactId: null,
      confirmedByTurnId: null,
      confirmedAt: null
    };
    mockPrisma.journalEventUnderstandingClaim.findUnique.mockResolvedValue(claim);
    mockPrisma.journalEventFact.create.mockResolvedValue({ id: "generated-fact" });
    mockPrisma.journalEventUnderstandingClaim.updateMany.mockImplementation(async ({ data }: any) => {
      claim.confirmedFactId = data.confirmedFactId;
      claim.confirmedByTurnId = data.confirmedByTurnId;
      claim.confirmedAt = data.confirmedAt;
      return { count: 1 };
    });

    const result = await confirmPendingUnderstandingClaim("turn-1", "branch-1");

    expect(result).toMatchObject({ kind: "confirmed", claimId: "claim-1" });
    expect(mockPrisma.journalEventFact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: "event-1",
        origin: "implicit_confirmation",
        pathAnchorMessageId: "user-message-1",
        evidence: {
          create: expect.objectContaining({
            sourceTurnId: "turn-1",
            contextMessageId: "assistant-1",
            role: "implicit_confirmation"
          })
        }
      })
    });
  });

  it("commits facts, visible reply, claim, trace, branch cache and checkpoint together", async () => {
    const pathMessages = [
      message({ id: "assistant-opening", sessionId: "branch-1", role: "assistant", sequence: 0 }),
      message({
        id: "user-message-1",
        sessionId: "branch-1",
        role: "user",
        sequence: 1,
        userTurnId: "turn-1"
      })
    ];
    installSingleBranchPath(pathMessages);
    mockPrisma.interviewUserTurn.findUnique.mockResolvedValue({
      id: "turn-1",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "processing",
      messages: [{ id: "user-message-1", sequence: 1 }]
    });
    mockPrisma.interviewUserTurn.findMany.mockResolvedValue([
      {
        id: "turn-1",
        journalEventId: "event-1",
        rawText: "今天开会时，同事认真听完了我的想法。",
        messages: [{ id: "user-message-1" }]
      }
    ]);
    mockPrisma.journalEventFact.findMany.mockResolvedValue([]);
    mockPrisma.journalEventFact.create.mockResolvedValue({ id: "fact-1" });
    mockPrisma.journalEventFactEvidence.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.aIGenerationTrace.create.mockResolvedValue({ id: "trace-1" });
    mockPrisma.interviewMessage.create.mockResolvedValue({ id: "assistant-1" });
    mockPrisma.journalEventUnderstandingClaim.create.mockResolvedValue({ id: "claim-1" });
    mockPrisma.interviewEvent.findFirst.mockResolvedValue({
      id: "branch-state-1",
      sessionId: "branch-1",
      sequence: 1,
      status: "active",
      stage: "collect_event",
      snapshotData: null,
      progressData: null,
      missingSlots: [],
      startedAt: now,
      completedAt: null
    });
    mockPrisma.interviewEvent.update.mockResolvedValue({ id: "branch-state-1" });
    mockPrisma.interviewSession.update.mockResolvedValue(activeBranch());
    mockPrisma.interviewBranchCheckpoint.create.mockResolvedValue({ id: "checkpoint-1" });
    mockPrisma.interviewUserTurn.update.mockResolvedValue({ id: "turn-1", status: "completed" });

    const result = await commitEventCenteredTurnUnderstanding({
      userId: "user-1",
      eventId: "event-1",
      activeBranchSessionId: "branch-1",
      branchStateId: "branch-state-1",
      userTurnId: "turn-1",
      assistantMessage: {
        id: "assistant-1",
        content: "我听见同事认真听完了你的想法。那一刻你最明显的感受是什么？"
      },
      facts: [
        {
          operation: "create",
          statement: "同事在会议中认真听完了用户的想法",
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          origin: "user_expression",
          pathAnchorMessageId: "user-message-1",
          evidence: [
            {
              sourceTurnId: "turn-1",
              pathAnchorMessageId: "user-message-1",
              role: "direct_expression",
              quote: "同事认真听完了我的想法"
            }
          ]
        }
      ],
      pendingClaim: {
        statement: "这件事可能让用户感到被认真对待",
        scope: "current_event",
        stance: "affirmed",
        kind: "inner_experience"
      },
      focusSummary: "同事的倾听及其带来的感受",
      trace: {
        id: "trace-1",
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
    });

    expect(result).toMatchObject({
      kind: "committed",
      assistantMessageId: "assistant-1",
      generationTraceId: "trace-1"
    });
    expect(mockPrisma.aIGenerationTrace.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ journalEventId: "event-1", triggerMessageId: "user-message-1" })
    });
    expect(mockPrisma.interviewEvent.update).toHaveBeenCalledWith({
      where: { id: "branch-state-1" },
      data: {
        snapshotData: expect.objectContaining({
          kind: "event_centered",
          schemaVersion: 3,
          lastProcessedTurnId: "turn-1",
          pendingUnderstandingClaimId: expect.any(String)
        })
      }
    });
    expect(mockPrisma.interviewUserTurn.update).toHaveBeenCalledWith({
      where: { id: "turn-1" },
      data: expect.objectContaining({ status: "completed" })
    });
  });

  it("rejects an inconsistent AI hypothesis before starting the commit transaction", async () => {
    await expect(
      commitEventCenteredTurnUnderstanding({
        userId: "user-1",
        eventId: "event-1",
        activeBranchSessionId: "branch-1",
        branchStateId: "branch-state-1",
        userTurnId: "turn-1",
        assistantMessage: { content: "一条回复" },
        facts: [],
        pendingClaim: {
          statement: "推测一",
          scope: "current_event",
          stance: "affirmed",
          kind: "inner_experience"
        },
        focusSummary: "处理焦点",
        trace: {
          outputOrigin: "llm",
          contextSnapshot: {},
          finalOutput: {},
          pipelineDecisions: []
        },
        checks: {
          eventBoundaryPassed: true,
          factsHaveUserSource: true,
          visibleUnderstandingMatchesClaim: false,
          unsupportedClaimCount: 1
        }
      })
    ).rejects.toThrow("EVENT_UNDERSTANDING_CHECK_FAILED");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("resumes the same reliable turn without creating another original message", async () => {
    const pathMessages = [
      message({ id: "assistant-1", sessionId: "branch-1", role: "assistant", sequence: 0 }),
      message({
        id: "user-message-1",
        sessionId: "branch-1",
        role: "user",
        sequence: 1,
        userTurnId: "turn-1"
      })
    ];
    installSingleBranchPath(pathMessages);
    mockPrisma.interviewUserTurn.findUnique.mockResolvedValue({
      id: "turn-1",
      sessionId: "branch-1",
      clientTurnId: "client-turn-1",
      journalEventId: "event-1",
      status: "failed",
      attemptCount: 1,
      rawText: "完整保留的原话",
      session: { userId: "user-1", mode: "event_centered" },
      journalEvent: { id: "event-1", status: "active" }
    });
    mockPrisma.interviewUserTurn.update.mockResolvedValue({
      id: "turn-1",
      status: "processing",
      attemptCount: 2,
      rawText: "完整保留的原话"
    });

    const resumed = await resumeEventCenteredTurnUnderstanding({
      userId: "user-1",
      activeBranchSessionId: "branch-1",
      clientTurnId: "client-turn-1"
    });

    expect(resumed).toMatchObject({
      id: "turn-1",
      status: "processing",
      attemptCount: 2,
      rawText: "完整保留的原话"
    });
    expect(mockPrisma.interviewUserTurn.update).toHaveBeenCalledWith({
      where: { id: "turn-1" },
      data: {
        status: "processing",
        attemptCount: { increment: 1 },
        errorCode: null,
        completedAt: null
      }
    });
    expect(mockPrisma.interviewMessage.create).not.toHaveBeenCalled();
  });

  it("returns the committed result when a retry arrives after the event is completed", async () => {
    const completedEvent = activeEvent();
    completedEvent.status = "completed";
    completedEvent.rootSession.status = "completed";
    const completedBranch = activeBranch();
    completedBranch.status = "completed";
    mockPrisma.journalEvent.findUnique.mockResolvedValue(completedEvent);
    mockPrisma.interviewSession.findUnique.mockImplementation(async ({ select }: any) => {
      if (select?.messages) {
        return {
          id: "branch-1",
          rootSessionId: "root-1",
          parentSessionId: null,
          forkMessageSequence: null,
          messages: [
            message({
              id: "user-message-1",
              sessionId: "branch-1",
              role: "user",
              sequence: 1,
              userTurnId: "turn-1"
            }),
            message({
              id: "assistant-1",
              sessionId: "branch-1",
              role: "assistant",
              sequence: 2,
              userTurnId: "turn-1"
            })
          ]
        };
      }
      return completedBranch;
    });
    mockPrisma.interviewUserTurn.findUnique.mockResolvedValue({
      id: "turn-1",
      sessionId: "branch-1",
      journalEventId: "event-1",
      status: "completed",
      messages: [{ id: "user-message-1", sequence: 1 }]
    });
    mockPrisma.interviewMessage.findFirst.mockResolvedValue({
      id: "assistant-1",
      generationTraceId: "trace-1"
    });
    mockPrisma.journalEventFact.findMany.mockResolvedValue([{ id: "fact-1" }]);
    mockPrisma.journalEventUnderstandingClaim.findUnique.mockResolvedValue({ id: "claim-1" });

    const result = await commitEventCenteredTurnUnderstanding({
      userId: "user-1",
      eventId: "event-1",
      activeBranchSessionId: "branch-1",
      branchStateId: "branch-state-1",
      userTurnId: "turn-1",
      assistantMessage: { content: "已保存的回复" },
      facts: [],
      pendingClaim: null,
      focusSummary: "已完成",
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
        unsupportedClaimCount: 0
      }
    });

    expect(result).toEqual({
      kind: "existing",
      eventId: "event-1",
      activeBranchSessionId: "branch-1",
      userTurnId: "turn-1",
      assistantMessageId: "assistant-1",
      generationTraceId: "trace-1",
      factIds: ["fact-1"],
      pendingUnderstandingClaimId: "claim-1"
    });
    expect(mockPrisma.aIGenerationTrace.create).not.toHaveBeenCalled();
    expect(mockPrisma.journalEventFact.create).not.toHaveBeenCalled();
  });
});
