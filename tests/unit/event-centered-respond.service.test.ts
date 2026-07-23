import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInitialEventCenteredDialogueState } from "@/features/interview/event-centered/dialogue-state";
import type { ReserveEventCenteredTurnResult } from "@/types/event-centered-interview";

const mocks = vi.hoisted(() => ({
  getWorkspaceData: vi.fn(),
  reserveAction: vi.fn(),
  reserveTurn: vi.fn(),
  abandon: vi.fn(),
  angleProjection: vi.fn(),
  factProjection: vi.fn(),
  assertForward: vi.fn(),
  applyRevision: vi.fn(),
  resolveClarification: vi.fn(),
  setClarification: vi.fn(),
  rejectClaim: vi.fn(),
  commit: vi.fn(),
  confirm: vi.fn(),
  markFailed: vi.fn(),
  resume: vi.fn(),
  understand: vi.fn(),
  realize: vi.fn(),
  bareAngleChange: vi.fn(),
  qualityGate: vi.fn(),
  createSafePayload: vi.fn(),
  assertWriteAllowed: vi.fn(),
  regenerateVersion: vi.fn(),
  selectVersion: vi.fn(),
  generateJournal: vi.fn()
}));

vi.mock("@/features/interview/event-centered-release", () => ({
  assertEventCenteredWriteAllowed: mocks.assertWriteAllowed
}));

vi.mock("@/server/repositories/event-centered-interview.repository", () => ({
  abandonJournalEvent: mocks.abandon,
  getEventCenteredInterviewWorkspaceData: mocks.getWorkspaceData,
  getEventCenteredSessionIdentity: vi.fn(),
  reserveEventCenteredUserAction: mocks.reserveAction,
  reserveEventCenteredUserTurn: mocks.reserveTurn,
  startEventCenteredInterviewSession: vi.fn()
}));

vi.mock("@/server/repositories/journal-event-angle-outcome.repository", () => ({
  getEffectiveJournalEventAngleProjection: mocks.angleProjection
}));

vi.mock("@/server/repositories/journal-event-fact-revision.repository", () => ({
  applyJournalEventFactRevision: mocks.applyRevision,
  assertEventCenteredForwardOperationAllowed: mocks.assertForward,
  getEffectiveJournalEventFactProjection: mocks.factProjection,
  rejectPendingUnderstandingClaim: mocks.rejectClaim,
  resolvePendingJournalEventFactClarification: mocks.resolveClarification,
  setPendingJournalEventFactClarification: mocks.setClarification
}));

vi.mock("@/server/repositories/journal-event-understanding.repository", () => ({
  commitEventCenteredTurnUnderstanding: mocks.commit,
  confirmPendingUnderstandingClaim: mocks.confirm,
  getEffectiveJournalEventFacts: vi.fn(),
  markEventCenteredTurnUnderstandingFailed: mocks.markFailed,
  resumeEventCenteredTurnUnderstanding: mocks.resume
}));

vi.mock("@/server/services/interview/event-centered-ai.service", () => ({
  isBareEventCenteredAngleChange: mocks.bareAngleChange,
  realizeEventCenteredTurnAI: mocks.realize,
  responseKindAllowsUnsupportedHypothesis: vi.fn(() => false),
  understandEventCenteredTurnAI: mocks.understand
}));

vi.mock("@/features/interview/event-centered/turn-quality", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/interview/event-centered/turn-quality")>();
  return {
    ...actual,
    runEventCenteredTurnQualityGate: mocks.qualityGate,
    createSafeEventCenteredPayload: mocks.createSafePayload,
    isEventCenteredContinueWithinBoundaryExpression: vi.fn(() => false)
  };
});

vi.mock("@/server/services/interview/event-centered-response-version.service", () => ({
  regenerateEventCenteredResponseVersion: mocks.regenerateVersion,
  selectEventCenteredResponseVersion: mocks.selectVersion
}));

vi.mock("@/server/services/journal-event/event-journal.service", () => ({
  generateEventJournal: mocks.generateJournal
}));

import {
  getEventCenteredInterviewWorkspace,
  respondEventCenteredInterview
} from "@/server/services/interview/event-centered-interview.service";

const now = "2026-07-22T12:00:00.000Z";

function identity() {
  return {
    mode: "event_centered" as const,
    rootSessionId: "root-1",
    activeBranchSessionId: "branch-1",
    eventId: "event-1",
    branchStateId: "state-1",
    entryDate: "2026-07-22",
    conversationSchemaVersion: 3,
    sessionStatus: "active" as const,
    eventStatus: "active" as const,
    latestMessageSequence: 1,
    journalEvent: {
      id: "event-1",
      entryDate: "2026-07-22",
      daySequence: 1,
      status: "active" as const,
      startedAt: now,
      generationStartedAt: null,
      completedAt: null,
      abandonedAt: null
    }
  };
}

function workspaceData(overrides: Record<string, unknown> = {}) {
  return {
    identity: identity(),
    snapshotData: createInitialEventCenteredDialogueState(),
    messages: [
      {
        id: "opening-1",
        branchSessionId: "branch-1",
        role: "assistant" as const,
        content: "先从这件事开始吧。刚刚发生了什么？",
        rawText: null,
        sequence: 0,
        userTurnId: null,
        responseGroupId: null,
        responseVersion: null,
        createdAt: now
      }
    ],
    responseVersions: [],
    pendingTurn: null,
    journalEntry: null,
    journalGeneration: null,
    ...overrides
  };
}

function reservation(overrides: Record<string, unknown> = {}) {
  return {
    kind: "reserved" as const,
    eventId: "event-1",
    rootSessionId: "root-1",
    activeBranchSessionId: "branch-1",
    branchStateId: "state-1",
    userMessageId: "user-message-1",
    turn: {
      id: "turn-1",
      clientTurnId: "client-1",
      sessionId: "branch-1",
      rawText: "今天开会时我主动说明了延期风险。",
      inputMode: "text" as const,
      baseMessageSequence: 1,
      status: "processing" as const,
      createdAt: now
    },
    ...overrides
  };
}

function factProjection(facts: unknown[] = []) {
  return {
    facts,
    effectiveFactIds: [],
    invalidatedFactIds: [],
    deprioritizedFactIds: [],
    explorationFactIds: [],
    pendingClarification: null
  };
}

function angleProjection() {
  return {
    outcomesByAngle: {},
    completedAngles: [],
    availableAngles: ["feeling", "thought", "relationship", "action"],
    invalidatedOutcomeIds: [],
    deprioritizedOutcomeIds: [],
    logEligibleOutcomeIds: [],
    repairPendingAngles: [],
    reopenedAngles: [],
    repairs: []
  };
}

function clearDecision(overrides: Record<string, unknown> = {}) {
  return {
    eventBoundary: "current_event" as const,
    coreEventIdentifiable: true,
    answerSignal: "answered" as const,
    facts: [{
      statement: "用户在会上主动说明了延期风险",
      scope: "current_event" as const,
      stance: "affirmed" as const,
      kind: "event_detail" as const,
      quote: "主动说明了延期风险"
    }],
    angleEvidence: [],
    outcomeCandidate: null,
    unsupportedHypothesis: null,
    adviceRequest: null,
    correctionTargetHint: null,
    boundaryReason: null,
    ...overrides
  };
}

function assistantPayload(overrides: Record<string, unknown> = {}) {
  return {
    naturalUnderstanding: "你在会上主动说明了延期风险。",
    naturalResponse: "这件事的核心经过已经记下来了。你可以选择一个角度继续看看。",
    responseKind: "checkpoint" as const,
    questionSpec: null,
    checkpoint: { kind: "first" as const, outcome: null },
    angleOutcome: null,
    ...overrides
  };
}

function replyRequest(overrides: Record<string, unknown> = {}) {
  return {
    action: "reply" as const,
    rootSessionId: "root-1",
    clientTurnId: "client-1",
    baseBranchSessionId: "branch-1",
    baseMessageSequence: 1,
    rawText: "今天开会时我主动说明了延期风险。",
    inputMode: "text" as const,
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getWorkspaceData.mockResolvedValue(workspaceData());
  mocks.reserveAction.mockResolvedValue(reservation());
  mocks.angleProjection.mockResolvedValue(angleProjection());
  mocks.factProjection.mockResolvedValue(factProjection());
  mocks.assertForward.mockResolvedValue(undefined);
  mocks.confirm.mockResolvedValue({ kind: "no_eligible_claim", claimId: null, factId: null });
  mocks.commit.mockResolvedValue({ kind: "committed" });
  mocks.understand.mockResolvedValue({
    decision: clearDecision(),
    outputOrigin: "llm",
    attempts: [],
    promptLineage: []
  });
  mocks.realize.mockResolvedValue({
    payload: assistantPayload(),
    outputOrigin: "llm",
    attempts: [],
    promptLineage: []
  });
  mocks.bareAngleChange.mockImplementation((text: string) => text.trim() === "换个角度");
  mocks.qualityGate.mockReturnValue({ passed: true, reasonCodes: [] });
  mocks.createSafePayload.mockImplementation(({ payload }: { payload: unknown }) => payload);
  mocks.regenerateVersion.mockResolvedValue({
    eventId: "event-1",
    rootSessionId: "root-1",
    activeBranchSessionId: "branch-2",
    responseGroupId: "response-group-1",
    responseVersion: 2,
    assistantPayload: assistantPayload({
      naturalUnderstanding: "我会保留刚才的关注点，把问题说得更直白。",
      naturalResponse: "简单说，你当时最确定的一点是什么？",
      responseKind: "repair",
      questionSpec: {
        phase: "guided_reflection",
        angle: "thought",
        target: "immediate_thought",
        opportunityNumber: 2,
        surfaceLevel: "simplified",
        anchorText: null,
        repairCount: 1
      },
      checkpoint: null
    })
  });
  mocks.selectVersion.mockResolvedValue({
    eventId: "event-1",
    rootSessionId: "root-1",
    activeBranchSessionId: "branch-2",
    assistantMessageId: "assistant-2"
  });
});

describe("event-centered respond service", () => {
  it("先可靠回调 turn，再进入 AI 理解并提交第一检查点", async () => {
    const order: string[] = [];
    mocks.reserveAction.mockImplementation(async () => reservation());
    mocks.understand.mockImplementation(async () => {
      order.push("understand");
      return {
        decision: clearDecision(),
        outputOrigin: "llm",
        attempts: [],
        promptLineage: []
      };
    });

    await respondEventCenteredInterview("user-1", replyRequest(), {
      onTurn: () => {
        order.push("turn");
      }
    });

    expect(order.slice(0, 2)).toEqual(["turn", "understand"]);
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.commit.mock.calls[0]?.[0]).toMatchObject({
      userTurnId: "turn-1",
      snapshotData: { phase: "checkpoint_one" },
      checks: { unsupportedClaimCount: 0 }
    });
  });

  it("安全红线命中后以安全收束内容提交和展示", async () => {
    const safePayload = assistantPayload({
      naturalUnderstanding: "我先按你已经明确表达的内容来理解。",
      naturalResponse: "我先接住你刚才说的这一段。"
    });
    mocks.realize.mockResolvedValue({
      payload: assistantPayload({
        naturalUnderstanding: "你已经出现病理性自恋。",
        naturalResponse: "现在就把对方的隐私发到网上。"
      }),
      outputOrigin: "llm",
      attempts: [],
      promptLineage: []
    });
    mocks.qualityGate.mockReturnValue({
      passed: false,
      safetyBlockers: [
        "psychological_diagnosis",
        "harmful_coercive_advice"
      ],
      qualityIssues: []
    });
    mocks.createSafePayload.mockReturnValue(safePayload);
    const deltas: Array<[string, string]> = [];

    await respondEventCenteredInterview("user-1", replyRequest(), {
      onDelta: (target, value) => {
        deltas.push([target, value]);
      }
    });

    expect(mocks.createSafePayload).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        naturalUnderstanding: "你已经出现病理性自恋。"
      })
    }));
    expect(deltas).toEqual([
      ["summary", safePayload.naturalUnderstanding],
      ["response", safePayload.naturalResponse]
    ]);
    expect(mocks.commit.mock.calls[0]?.[0].assistantMessage.content).toContain(
      safePayload.naturalResponse
    );
  });

  it("选择探索角度只改变策略状态，不把角度按钮文案写成事实", async () => {
    const checkpoint = createInitialEventCenteredDialogueState();
    checkpoint.phase = "checkpoint_one";
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: checkpoint }));
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: { ...reservation().turn, rawText: "" }
    }));

    await respondEventCenteredInterview("user-1", replyRequest({
      action: "select_exploration_angle",
      angle: "feeling",
      rawText: undefined
    }));

    expect(mocks.reserveAction).toHaveBeenCalledWith(expect.objectContaining({
      action: "select_exploration_angle",
      eventOperationData: expect.objectContaining({ angle: "feeling" })
    }));
    expect(mocks.commit.mock.calls[0]?.[0].facts).toEqual([]);
    expect(mocks.commit.mock.calls[0]?.[0].snapshotData.activeAngle).toBe("feeling");
  });

  it("双事件选择只采用服务端保存的候选原话，不信任客户端传来的自由文本", async () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "event_focus_clarification";
    state.focusOptions = [
      { id: "focus-1", label: "下午会议被取消", sourceText: "下午会议被取消" },
      { id: "focus-2", label: "晚上和朋友发生误会", sourceText: "晚上和朋友发生误会" }
    ];
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: state }));
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: { ...reservation().turn, rawText: "晚上和朋友发生误会" }
    }));

    await respondEventCenteredInterview("user-1", replyRequest({
      action: "select_current_event",
      optionId: "focus-2",
      rawText: "我想改成第三件事"
    }));

    expect(mocks.reserveAction).toHaveBeenCalledWith(expect.objectContaining({
      action: "select_current_event",
      rawText: "晚上和朋友发生误会",
      eventOperationData: expect.objectContaining({ optionId: "focus-2" })
    }));
    expect(mocks.commit.mock.calls[0]?.[0].facts).toMatchObject([
      { statement: "晚上和朋友发生误会" }
    ]);
  });

  it("裸换角度维持当前问题，不写事实且不确认待确认推测", async () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "guided_reflection";
    state.activeAngle = "thought";
    state.angleRuns.thought!.status = "active";
    state.angleRuns.thought!.questionOpportunityCount = 1;
    state.currentQuestion = {
      opportunityNumber: 1,
      angle: "thought",
      target: "immediate_thought",
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: "assistant-question-1"
    };
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: state }));
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: { ...reservation().turn, rawText: "换个角度" }
    }));
    mocks.understand.mockResolvedValue({
      decision: clearDecision({
        facts: clearDecision().facts,
        unsupportedHypothesis: {
          statement: "这是一条待确认推测",
          scope: "current_event",
          stance: "affirmed",
          kind: "stated_interpretation"
        }
      }),
      outputOrigin: "llm",
      attempts: [],
      promptLineage: []
    });

    await respondEventCenteredInterview("user-1", replyRequest({ rawText: "换个角度" }));

    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.commit.mock.calls[0]?.[0]).toMatchObject({ facts: [], pendingClaim: null });
    expect(mocks.commit.mock.calls[0]?.[0].snapshotData.currentQuestion).toMatchObject({
      target: "immediate_thought",
      opportunityNumber: 1
    });
  });

  it("另一独立事件留在原话，不确认当前事件推测也不写入事实", async () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "guided_reflection";
    state.activeAngle = "feeling";
    state.angleRuns.feeling!.status = "active";
    state.angleRuns.feeling!.questionOpportunityCount = 1;
    state.currentQuestion = {
      opportunityNumber: 1,
      angle: "feeling",
      target: "direct_experience",
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: "assistant-question-1"
    };
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: state }));
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: { ...reservation().turn, rawText: "这件先不说，我还想讲另一件事。" }
    }));
    mocks.understand.mockResolvedValue({
      decision: clearDecision({
        eventBoundary: "another_event",
        coreEventIdentifiable: false,
        facts: clearDecision().facts,
        outcomeCandidate: null
      }),
      outputOrigin: "llm",
      attempts: [],
      promptLineage: []
    });

    await respondEventCenteredInterview("user-1", replyRequest({
      rawText: "这件先不说，我还想讲另一件事。"
    }));

    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.commit.mock.calls[0]?.[0].facts).toEqual([]);
    expect(mocks.commit.mock.calls[0]?.[0].snapshotData.currentQuestion).toMatchObject({
      target: "direct_experience",
      opportunityNumber: 1
    });
  });

  it("纠正优先执行事实修订，不隐式确认上一轮推测", async () => {
    const oldFact = {
      id: "fact-1",
      eventId: "event-1",
      createdBranchSessionId: "branch-1",
      pathAnchorMessageId: "old-message",
      createdByRevisionId: null,
      statement: "延期是两周",
      scope: "current_event",
      stance: "affirmed",
      kind: "event_detail",
      origin: "user_expression",
      createdAt: now,
      evidence: []
    };
    mocks.factProjection.mockResolvedValue(factProjection([oldFact]));
    mocks.understand.mockResolvedValue({
      decision: clearDecision({
        answerSignal: "correction",
        correctionTargetHint: "延期是两周",
        facts: [{
          statement: "延期是一周",
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: "是一周"
        }]
      }),
      outputOrigin: "llm",
      attempts: [],
      promptLineage: []
    });
    mocks.applyRevision.mockResolvedValue({ kind: "applied", revisionId: "revision-1" });

    await respondEventCenteredInterview("user-1", replyRequest({
      action: "correct_understanding",
      rawText: "我纠正一下，是一周。"
    }));

    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.applyRevision).toHaveBeenCalledOnce();
    expect(mocks.commit.mock.calls[0]?.[0].facts).toEqual([]);
    expect(mocks.commit.mock.calls[0]?.[0].pendingClaim).toBeNull();
  });

  it("AI 失败后标记同一 turn 为 failed，resume 继续使用该 turn", async () => {
    mocks.understand.mockRejectedValueOnce(new Error("AI_TEMPORARY_FAILURE"));
    await expect(
      respondEventCenteredInterview("user-1", replyRequest())
    ).rejects.toThrow("AI_TEMPORARY_FAILURE");

    expect(mocks.markFailed).toHaveBeenCalledWith("turn-1", "AI_TEMPORARY_FAILURE");

    const pending = {
      ...reservation().turn,
      status: "failed" as const,
      action: "reply" as const,
      baseBranchSessionId: "branch-1",
      eventOperationData: null,
      errorCode: "AI_TEMPORARY_FAILURE",
      attemptCount: 1
    };
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({
      pendingTurn: pending,
      messages: [
        ...workspaceData().messages,
        {
          id: "user-message-1",
          branchSessionId: "branch-1",
          role: "user",
          content: pending.rawText,
          rawText: pending.rawText,
          sequence: 1,
          userTurnId: "turn-1",
          responseGroupId: null,
          responseVersion: null,
          createdAt: now
        }
      ]
    }));

    await respondEventCenteredInterview("user-1", {
      action: "resume_turn",
      rootSessionId: "root-1",
      clientTurnId: "client-1"
    });

    expect(mocks.resume).toHaveBeenCalledWith(expect.objectContaining({
      clientTurnId: "client-1"
    }));
    expect(mocks.commit.mock.calls.at(-1)?.[0].userTurnId).toBe("turn-1");
    expect(mocks.reserveAction).toHaveBeenCalledTimes(1);
  });

  it("退出事件完成可靠动作并进入 abandon，不触发 AI", async () => {
    await respondEventCenteredInterview("user-1", replyRequest({
      action: "exit_event",
      rawText: "先退出"
    }));

    expect(mocks.abandon).toHaveBeenCalledWith("user-1", "event-1", "turn-1");
    expect(mocks.understand).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("普通记录阶段保持生成动作关闭并返回完整日志状态", async () => {
    const workspace = await getEventCenteredInterviewWorkspace("user-1", "root-1");

    expect(workspace?.dialogue.allowedActions).not.toContain("generate_event_journal");
    expect(workspace?.journal).toEqual({
      status: "not_generated",
      entryId: null,
      generationId: null,
      errorCode: null,
      retryable: false,
      eventStatus: "active"
    });
  });

  it("生成事件日志动作完成可靠确认并调用成果服务", async () => {
    const turns: ReserveEventCenteredTurnResult[] = [];
    mocks.generateJournal.mockImplementation(async (
      _input: unknown,
      options: {
        onReserved?: (
          generation: Record<string, unknown>,
          reservedNow: boolean
        ) => Promise<void> | void;
      }
    ) => {
      await options.onReserved?.({
        id: "generation-1",
        eventId: "event-1",
        branchSessionId: "branch-1",
        userTurnId: "turn-journal-1",
        clientOperationId: "client-journal-1",
        baseMessageSequence: 1,
        status: "processing",
        startedAt: now
      }, true);
      return {
        kind: "processing",
        entry: null,
        generationId: "generation-1",
        outputOrigin: null,
        usedFallback: false
      };
    });

    await respondEventCenteredInterview("user-1", replyRequest({
      action: "generate_event_journal",
      clientTurnId: "client-journal-1"
    }), {
      onTurn: (turn) => {
        turns.push(turn);
      }
    });

    expect(mocks.generateJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        eventId: "event-1",
        activeBranchSessionId: "branch-1",
        clientOperationId: "client-journal-1",
        baseMessageSequence: 1
      }),
      expect.objectContaining({
        onReserved: expect.any(Function)
      })
    );
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({
      kind: "reserved",
      turn: {
        id: "turn-journal-1",
        clientTurnId: "client-journal-1",
        status: "processing"
      }
    });
    expect(mocks.reserveAction).not.toHaveBeenCalled();
    expect(mocks.understand).not.toHaveBeenCalled();
  });

  it("统一接口生成问题新版本并返回最新工作台", async () => {
    const deltas: Array<[string, string]> = [];
    const result = await respondEventCenteredInterview("user-1", replyRequest({
      action: "regenerate_response",
      targetMessageId: "assistant-question-1",
      regenerationIntent: "simplify"
    }), {
      onDelta: (target, value) => {
        deltas.push([target, value]);
      }
    });

    expect(mocks.regenerateVersion).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      rootSessionId: "root-1",
      targetMessageId: "assistant-question-1",
      intent: "simplify",
      baseBranchSessionId: "branch-1",
      baseMessageSequence: 1
    }));
    expect(deltas).toEqual([
      ["summary", "我会保留刚才的关注点，把问题说得更直白。"],
      ["response", "简单说，你当时最确定的一点是什么？"]
    ]);
    expect(result.assistantPayload?.responseKind).toBe("repair");
    expect(mocks.reserveAction).not.toHaveBeenCalled();
  });

  it("统一接口切换已有回复版本并保持事件身份", async () => {
    const result = await respondEventCenteredInterview("user-1", replyRequest({
      action: "switch_response_version",
      targetBranchSessionId: "branch-2",
      targetMessageId: "assistant-2"
    }));

    expect(mocks.selectVersion).toHaveBeenCalledWith({
      userId: "user-1",
      rootSessionId: "root-1",
      targetBranchSessionId: "branch-2",
      baseBranchSessionId: "branch-1",
      targetMessageId: "assistant-2"
    });
    expect(result.workspace?.eventId).toBe("event-1");
    expect(mocks.reserveAction).not.toHaveBeenCalled();
  });
});
