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
    journalEventFactRevision: delegate(),
    journalEventUnderstandingClaim: delegate(),
    journalEventAngleOutcome: delegate(),
    journalEventAngleOutcomeFact: delegate(),
    journalEventAngleOutcomeRepair: delegate(),
    journalEventAngleOutcomeRepairResolution: delegate(),
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
  getEventCenteredUnderstandingCommitFingerprint,
  getEffectiveJournalEventFacts,
  resumeEventCenteredTurnUnderstanding
} from "@/server/repositories/journal-event-understanding.repository";
import type { CommitEventCenteredTurnUnderstandingInput } from "@/types/journal-event-understanding";

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
    mockPrisma.journalEventFactRevision.findMany.mockResolvedValue([]);
    mockPrisma.journalEventAngleOutcome.findMany.mockResolvedValue([]);
    mockPrisma.journalEventAngleOutcomeRepair.findMany.mockResolvedValue([]);
    mockPrisma.journalEventAngleOutcomeRepairResolution.findMany.mockResolvedValue([]);
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

  it("never confirms a claim after the claim has been rejected", async () => {
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
    mockPrisma.journalEventUnderstandingClaim.findUnique.mockResolvedValue({
      id: "claim-1",
      eventId: "event-1",
      assistantMessageId: "assistant-1",
      statement: "这件事可能让用户感到被忽视",
      scope: "current_event",
      stance: "affirmed",
      kind: "inner_experience",
      status: "rejected",
      confirmedFactId: null,
      confirmedByTurnId: null,
      confirmedAt: null,
      rejectedByRevisionId: "revision-1",
      rejectedByTurnId: "turn-correction",
      rejectedAt: now
    });

    const result = await confirmPendingUnderstandingClaim("turn-1", "branch-1");

    expect(result).toEqual({ kind: "no_eligible_claim", claimId: null, factId: null });
    expect(mockPrisma.journalEventFact.create).not.toHaveBeenCalled();
    expect(mockPrisma.journalEventUnderstandingClaim.updateMany).not.toHaveBeenCalled();
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
          schemaVersion: 4,
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

  it("resumes only the correction response after its fact revision was already committed", async () => {
    const pathMessages = [
      message({ id: "assistant-question", sessionId: "branch-1", role: "assistant", sequence: 0 }),
      message({
        id: "user-correction",
        sessionId: "branch-1",
        role: "user",
        sequence: 1,
        userTurnId: "turn-correction"
      })
    ];
    installSingleBranchPath(pathMessages);
    let turnStatus: "failed" | "processing" | "completed" = "failed";
    mockPrisma.interviewUserTurn.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.sessionId_clientTurnId) {
        return {
          id: "turn-correction",
          sessionId: "branch-1",
          clientTurnId: "client-correction",
          journalEventId: "event-1",
          status: turnStatus,
          attemptCount: 1,
          rawText: "其实是周三。",
          session: { userId: "user-1", mode: "event_centered" },
          journalEvent: { id: "event-1", status: "active" }
        };
      }
      return {
        id: "turn-correction",
        sessionId: "branch-1",
        journalEventId: "event-1",
        status: turnStatus,
        messages: [{ id: "user-correction", sequence: 1 }]
      };
    });
    mockPrisma.interviewUserTurn.update.mockImplementation(async ({ data }: any) => {
      turnStatus = data.status;
      return {
        id: "turn-correction",
        status: turnStatus,
        attemptCount: turnStatus === "processing" ? 2 : 1,
        rawText: "其实是周三。"
      };
    });
    mockPrisma.journalEventFactRevision.findUnique.mockResolvedValue({ id: "revision-1" });
    mockPrisma.journalEventFact.findMany.mockResolvedValue([
      {
        id: "fact-invalidated",
        eventId: "event-1",
        createdBranchSessionId: "branch-1",
        pathAnchorMessageId: "assistant-question",
        createdByRevisionId: null,
        statement: "已经被纠正的旧理解",
        scope: "current_event",
        stance: "affirmed",
        kind: "stated_interpretation",
        origin: "implicit_confirmation",
        createdAt: now,
        evidence: []
      }
    ]);
    mockPrisma.journalEventFactRevision.findMany.mockResolvedValue([
      {
        id: "revision-1",
        eventId: "event-1",
        branchSessionId: "branch-1",
        sourceTurnId: "turn-correction",
        pathAnchorMessageId: "user-correction",
        createdAt: now,
        targets: [{ targetFactId: "fact-invalidated", relation: "supersede" }]
      }
    ]);
    mockPrisma.aIGenerationTrace.create.mockResolvedValue({ id: "trace-response" });
    mockPrisma.interviewMessage.create.mockResolvedValue({ id: "assistant-correction" });
    mockPrisma.interviewEvent.findFirst.mockResolvedValue({
      id: "branch-state-1",
      sessionId: "branch-1",
      sequence: 1,
      status: "active",
      stage: "collect_event",
      snapshotData: { lastFactRevisionId: "revision-1" },
      progressData: null,
      missingSlots: [],
      startedAt: now,
      completedAt: null
    });
    mockPrisma.interviewEvent.update.mockResolvedValue({ id: "branch-state-1" });
    mockPrisma.interviewSession.update.mockResolvedValue(activeBranch());
    mockPrisma.interviewBranchCheckpoint.create.mockResolvedValue({ id: "checkpoint-response" });

    const resumed = await resumeEventCenteredTurnUnderstanding({
      userId: "user-1",
      activeBranchSessionId: "branch-1",
      clientTurnId: "client-correction"
    });
    expect(resumed).toMatchObject({ id: "turn-correction", status: "processing", attemptCount: 2 });

    const result = await commitEventCenteredTurnUnderstanding({
      userId: "user-1",
      eventId: "event-1",
      activeBranchSessionId: "branch-1",
      branchStateId: "branch-state-1",
      userTurnId: "turn-correction",
      assistantMessage: {
        id: "assistant-correction",
        content: "我已经按你刚才的纠正更新了理解。"
      },
      facts: [],
      pendingClaim: null,
      focusSummary: "按已经生效的纠正继续",
      trace: {
        id: "trace-response",
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

    expect(result).toMatchObject({
      kind: "committed",
      assistantMessageId: "assistant-correction",
      factIds: [],
      pendingUnderstandingClaimId: null
    });
    expect(mockPrisma.journalEventFactRevision.findUnique).toHaveBeenCalledWith({
      where: { sourceTurnId: "turn-correction" },
      select: { id: true }
    });
    expect(mockPrisma.journalEventAngleOutcomeRepair.findMany).toHaveBeenCalledWith({
      where: {
        eventId: "event-1",
        pathAnchorMessageId: {
          in: ["assistant-question", "user-correction"]
        },
        resolutions: {
          none: {
            resolvedMessageId: {
              in: ["assistant-question", "user-correction"]
            }
          }
        }
      },
      select: { id: true }
    });
    expect(mockPrisma.journalEventFactRevision.create).not.toHaveBeenCalled();
    expect(mockPrisma.journalEventFact.create).not.toHaveBeenCalled();
    expect(mockPrisma.journalEventUnderstandingClaim.create).not.toHaveBeenCalled();
    expect(mockPrisma.interviewMessage.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.aIGenerationTrace.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contextSnapshot: expect.objectContaining({ effectiveFactIds: [] })
      })
    });
    expect(mockPrisma.interviewEvent.update).toHaveBeenCalledWith({
      where: { id: "branch-state-1" },
      data: {
        snapshotData: expect.objectContaining({
          lastFactRevisionId: "revision-1",
          lastProcessedTurnId: "turn-correction"
        })
      }
    });
    expect(turnStatus).toBe("completed");
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
      backgroundFactsTaskTraceId: null,
      factIds: ["fact-1"],
      pendingUnderstandingClaimId: "claim-1",
      angleOutcomeIds: [],
      reopenedAngles: []
    });
    expect(mockPrisma.aIGenerationTrace.create).not.toHaveBeenCalled();
    expect(mockPrisma.journalEventFact.create).not.toHaveBeenCalled();
  });

  it("把修复集合和成果依赖的不同排列归一为同一幂等语义", () => {
    const base: CommitEventCenteredTurnUnderstandingInput = {
      userId: "user-1",
      eventId: "event-1",
      activeBranchSessionId: "branch-1",
      branchStateId: "branch-state-1",
      userTurnId: "turn-1",
      assistantMessage: { content: "已经按最新事实修复角度结果。" },
      facts: [],
      pendingClaim: null,
      focusSummary: "修复受影响的角度成果",
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
      },
      angleRepairResolutions: [
        { repairId: "repair-2", decision: "reopen" },
        {
          repairId: "repair-1",
          decision: "replace",
          outcome: {
            kind: "insight",
            statement: "我在关系里期待被认真回应",
            dependencies: [
              { factId: "fact-context", role: "context" },
              { factId: "fact-support", role: "support" }
            ]
          }
        }
      ]
    };
    const reordered: CommitEventCenteredTurnUnderstandingInput = {
      ...base,
      angleRepairResolutions: [
        {
          repairId: "repair-1",
          decision: "replace",
          outcome: {
            kind: "insight",
            statement: "我在关系里期待被认真回应",
            dependencies: [
              { factId: "fact-support", role: "support" },
              { factId: "fact-context", role: "context" }
            ]
          }
        },
        { repairId: "repair-2", decision: "reopen" }
      ]
    };

    expect(getEventCenteredUnderstandingCommitFingerprint(reordered)).toBe(
      getEventCenteredUnderstandingCommitFingerprint(base)
    );
    expect(
      getEventCenteredUnderstandingCommitFingerprint({
        ...reordered,
        angleRepairResolutions: [
          {
            ...reordered.angleRepairResolutions![0],
            decision: "replace",
            outcome: {
              kind: "insight",
              statement: "  我在关系里期待被认真回应  ",
              dependencies: [
                { factId: "fact-support", role: "support" },
                { factId: "fact-context", role: "context" }
              ]
            }
          },
          { repairId: "repair-2", decision: "reopen" }
        ]
      })
    ).toBe(getEventCenteredUnderstandingCommitFingerprint(base));

    const sourcedInput: CommitEventCenteredTurnUnderstandingInput = {
      ...base,
      angleRepairResolutions: [],
      facts: [
        {
          operation: "create",
          statement: "用户当时有些失落",
          scope: "current_event",
          stance: "affirmed",
          kind: "inner_experience",
          origin: "user_expression",
          pathAnchorMessageId: "user-message-1",
          evidence: []
        }
      ],
      pendingClaim: {
        statement: "这份失落也许来自期待落空",
        scope: "current_event",
        stance: "affirmed",
        kind: "stated_interpretation"
      }
    };
    expect(
      getEventCenteredUnderstandingCommitFingerprint({
        ...sourcedInput,
        facts: [
          {
            operation: "create",
            statement: "  用户当时有些失落  ",
            scope: "current_event",
            stance: "affirmed",
            kind: "inner_experience",
            origin: "user_expression",
            pathAnchorMessageId: "user-message-1",
            evidence: []
          }
        ],
        pendingClaim: {
          ...sourcedInput.pendingClaim!,
          statement: "  这份失落也许来自期待落空  "
        }
      })
    ).toBe(getEventCenteredUnderstandingCommitFingerprint(sourcedInput));

    const directOutcomeInput: CommitEventCenteredTurnUnderstandingInput = {
      ...base,
      angleRepairResolutions: [],
      angleOutcome: {
        angle: "feeling",
        kind: "insight",
        statement: "用户在这件事里感到失落",
        dependencies: [{ factId: "fact-support", role: "support" }]
      }
    };
    expect(
      getEventCenteredUnderstandingCommitFingerprint({
        ...directOutcomeInput,
        angleOutcome: {
          ...directOutcomeInput.angleOutcome!,
          statement: "  用户在这件事里感到失落  "
        }
      })
    ).toBe(getEventCenteredUnderstandingCommitFingerprint(directOutcomeInput));
    expect(
      getEventCenteredUnderstandingCommitFingerprint({
        ...reordered,
        focusSummary: "另一份语义"
      })
    ).not.toBe(getEventCenteredUnderstandingCommitFingerprint(base));
  });

  it("并发重复提交遇到唯一约束时读取赢家结果，并拒绝语义不同的重放", async () => {
    const input = {
      userId: "user-1",
      eventId: "event-1",
      activeBranchSessionId: "branch-1",
      branchStateId: "branch-state-1",
      userTurnId: "turn-1",
      assistantMessage: { content: "我看见你在这件事里松了一口气。" },
      facts: [],
      pendingClaim: null,
      focusSummary: "已经看见当下感受",
      trace: {
        outputOrigin: "llm" as const,
        contextSnapshot: {},
        finalOutput: {},
        pipelineDecisions: []
      },
      checks: {
        eventBoundaryPassed: true,
        factsHaveUserSource: true,
        visibleUnderstandingMatchesClaim: true,
        unsupportedClaimCount: 0
      },
      angleOutcome: {
        angle: "feeling" as const,
        kind: "insight" as const,
        statement: "这件事让我松了一口气",
        dependencies: [{ factId: "fact-1", role: "support" as const }]
      }
    };
    const requestFingerprint = getEventCenteredUnderstandingCommitFingerprint(input);
    mockPrisma.$transaction.mockRejectedValueOnce(
      Object.assign(new Error("unique"), { code: "P2002" })
    );
    mockPrisma.interviewMessage.findFirst.mockResolvedValue({
      id: "assistant-winner",
      generationTraceId: "trace-winner",
      generationTrace: {
        pipelineDecisions: [
          {
            kind: "event_centered_understanding_commit",
            requestFingerprint
          }
        ]
      }
    });
    mockPrisma.journalEventFact.findMany.mockResolvedValue([]);
    mockPrisma.journalEventUnderstandingClaim.findUnique.mockResolvedValue(null);
    mockPrisma.journalEventAngleOutcome.findMany.mockResolvedValue([
      { id: "outcome-winner" }
    ]);

    await expect(commitEventCenteredTurnUnderstanding(input)).resolves.toMatchObject({
      kind: "existing",
      assistantMessageId: "assistant-winner",
      angleOutcomeIds: ["outcome-winner"]
    });

    mockPrisma.$transaction.mockRejectedValueOnce(
      Object.assign(new Error("unique"), { code: "P2002" })
    );
    await expect(
      commitEventCenteredTurnUnderstanding({
        ...input,
        assistantMessage: { content: "另一份互相冲突的回复" }
      })
    ).rejects.toThrow("EVENT_TURN_IDEMPOTENCY_CONFLICT");
  });
});
