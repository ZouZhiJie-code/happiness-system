import type { AssistantTurnPayload, InterviewSessionRecord, JoySnapshot } from "@/types/interview";

const {
  appendJoyInterviewTurn,
  completeJoyInterviewSessionRecord,
  createJoyInterviewSession,
  findJoyInterviewSessionById,
  markJoyEntrySaved,
  pauseJoyInterviewSessionRecord,
  reopenJoyInterviewSessionRecord,
  resumeCurrentInterviewEvent,
  saveJoyInterviewDraft,
  startNextInterviewEvent
} = vi.hoisted(() => ({
  appendJoyInterviewTurn: vi.fn(),
  completeJoyInterviewSessionRecord: vi.fn(),
  createJoyInterviewSession: vi.fn(),
  findJoyInterviewSessionById: vi.fn(),
  markJoyEntrySaved: vi.fn(),
  pauseJoyInterviewSessionRecord: vi.fn(),
  reopenJoyInterviewSessionRecord: vi.fn(),
  resumeCurrentInterviewEvent: vi.fn(),
  saveJoyInterviewDraft: vi.fn(),
  startNextInterviewEvent: vi.fn()
}));

const { extractJoySnapshotWithAI, generateJoyAssistantTurn, streamJoyAssistantTurn, generateJoyDraftWithAI } = vi.hoisted(() => ({
  extractJoySnapshotWithAI: vi.fn(),
  generateJoyAssistantTurn: vi.fn(),
  streamJoyAssistantTurn: vi.fn(),
  generateJoyDraftWithAI: vi.fn()
}));

const {
  buildAssistantQuestion,
  getDelightSignature,
  getDirectionSignal,
  getInactiveSessionMessage,
  getNextStage,
  getOpeningQuestion,
  getJoyTrack,
  getJoyPositiveCoreDriver,
  getJoyReuseSafety,
  getJoyMoment,
  getJoySource,
  hasJoyStableClosure,
  getStateShift,
  getValueImpact,
  getMeaningNeed,
  getManualClue
} = vi.hoisted(() => ({
  buildAssistantQuestion: vi.fn(),
  getDelightSignature: (snapshot: JoySnapshot) => snapshot.delightSignature ?? null,
  getDirectionSignal: (snapshot: JoySnapshot) => snapshot.directionSignal ?? snapshot.happinessType ?? null,
  getInactiveSessionMessage: vi.fn(),
  getNextStage: vi.fn(),
  getOpeningQuestion: vi.fn(),
  getJoyTrack: (snapshot: JoySnapshot) => (snapshot.delightSignature ? "delight_track" : "meaning_track"),
  getJoyPositiveCoreDriver: (snapshot: JoySnapshot) => snapshot.joySource ?? snapshot.whyItMattered ?? null,
  getJoyReuseSafety: () => "safe",
  getJoyMoment: (snapshot: JoySnapshot) => snapshot.joyMoment ?? snapshot.event ?? null,
  getJoySource: (snapshot: JoySnapshot) => snapshot.joySource ?? snapshot.whyItMattered ?? null,
  hasJoyStableClosure: (snapshot: JoySnapshot) => Boolean(snapshot.delightSignature ?? snapshot.manualClue ?? snapshot.selfPattern),
  getStateShift: (snapshot: JoySnapshot) => snapshot.stateShift ?? snapshot.feeling ?? null,
  getValueImpact: (snapshot: JoySnapshot) => snapshot.valueImpact ?? null,
  getMeaningNeed: (snapshot: JoySnapshot) => snapshot.meaningNeed ?? null,
  getManualClue: (snapshot: JoySnapshot) => snapshot.manualClue ?? snapshot.selfPattern ?? null
}));

vi.mock("@/server/repositories/joy-interview.repository", () => ({
  appendJoyInterviewTurn,
  completeJoyInterviewSessionRecord,
  createJoyInterviewSession,
  findJoyInterviewSessionById,
  markJoyEntrySaved,
  pauseJoyInterviewSessionRecord,
  reopenJoyInterviewSessionRecord,
  resumeCurrentInterviewEvent,
  saveJoyInterviewDraft,
  startNextInterviewEvent
}));

vi.mock("@/server/services/interview/joy-interview-ai.service", () => ({
  extractJoySnapshotWithAI,
  generateJoyAssistantTurn,
  streamJoyAssistantTurn,
  generateJoyDraftWithAI
}));

vi.mock("@/features/joy-interview/server/joy-interview-engine", () => ({
  buildAssistantQuestion,
  getDelightSignature,
  getDirectionSignal,
  getInactiveSessionMessage,
  getNextStage,
  getOpeningQuestion,
  getJoyTrack,
  getJoyPositiveCoreDriver,
  getJoyReuseSafety,
  getJoyMoment,
  getJoySource,
  hasJoyStableClosure,
  getStateShift,
  getValueImpact,
  getMeaningNeed,
  getManualClue
}));

import {
  DraftGenerationError,
  generateJoyInterviewDraft,
  prepareJoyInterviewResponse,
  streamJoyInterviewResponse
} from "@/server/services/interview/joy-interview.service";

const baseSnapshot: JoySnapshot = {
  event: "今天和朋友聊了很久",
  feeling: "温暖被理解",
  whyItMattered: "因为我感觉自己被接住了",
  happinessType: "关系型开心",
  selfPattern: "只要和重要的人真正聊开，我就更容易进入好状态",
  joyMoment: "今天和朋友聊了很久",
  joySource: "被朋友真正接住的感觉",
  stateShift: "更被理解",
  meaningNeed: "我在乎被理解和连接",
  manualClue: "只要和重要的人真正聊开，我就更容易进入好状态",
  confidence: 0.9,
  missingSlots: []
};

function buildSession(overrides: Partial<InterviewSessionRecord> = {}): InterviewSessionRecord {
  return {
    userId: "user-1",
    id: "session-ready",
    dimension: "joy",
    status: "active",
    stage: "probe_pattern",
    activeEventId: "event-1",
    draftGenerationUnlocked: false,
    turnCount: 3,
    lastAssistantQuestion: "这份开心像是来自连接感。你觉得自己在关系里最在乎什么？",
    draftSummary: null,
    messages: [
      {
        id: "assistant-1",
        role: "assistant",
        content: "这份开心像是来自连接感。你觉得自己在关系里最在乎什么？",
        assistantPayload: {
          insight: "",
          thinkingSummary: "这份开心像是来自连接感。",
          analysis: "用户已说：和朋友深聊；下一步问：关系在乎点",
          question: "你觉得自己在关系里最在乎什么？",
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
        sequence: 0,
        createdAt: "2026-04-21T00:00:00.000Z"
      }
    ],
    snapshot: baseSnapshot,
    events: [
      {
        id: "event-1",
        sequence: 1,
        status: "active",
        stage: "probe_pattern",
        explorationRound: 1,
        coveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
        roundCoveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
        roundMeaningfulReplyCount: 3,
        totalMeaningfulReplyCount: 3,
        startMessageSequence: 0,
        snapshot: baseSnapshot,
        draftSummary: null,
        startedAt: "2026-04-21T00:00:00.000Z",
        completedAt: null
      }
    ],
    pendingDecision: null,
    startedAt: "2026-04-21T00:00:00.000Z",
    entryDate: "2026-04-21",
    pausedAt: null,
    completedAt: null,
    journalEntry: null,
    ...overrides
  };
}

describe("prepareJoyInterviewResponse", () => {
  beforeEach(() => {
    appendJoyInterviewTurn.mockReset();
    completeJoyInterviewSessionRecord.mockReset();
    createJoyInterviewSession.mockReset();
    findJoyInterviewSessionById.mockReset();
    markJoyEntrySaved.mockReset();
    pauseJoyInterviewSessionRecord.mockReset();
    reopenJoyInterviewSessionRecord.mockReset();
    resumeCurrentInterviewEvent.mockReset();
    saveJoyInterviewDraft.mockReset();
    startNextInterviewEvent.mockReset();
    extractJoySnapshotWithAI.mockReset();
    generateJoyAssistantTurn.mockReset();
    streamJoyAssistantTurn.mockReset();
    generateJoyDraftWithAI.mockReset();
    buildAssistantQuestion.mockReset();
    getInactiveSessionMessage.mockReset();
    getNextStage.mockReset();
    getOpeningQuestion.mockReset();
  });

  it("turns wrap-up completion into a choice card instead of another closing question", async () => {
    findJoyInterviewSessionById.mockResolvedValue(buildSession());
    extractJoySnapshotWithAI.mockResolvedValue(baseSnapshot);
    getNextStage.mockReturnValue("wrap_up");
    generateJoyAssistantTurn.mockResolvedValue({
      insight: "",
      thinkingSummary: "这段经历为什么重要，已经慢慢清楚起来了。",
      analysis: "用户已说：被接住；下一步问：收尾",
      question: "如果现在把这段开心整理成日志，你最想留下哪个点？",
      stateUpdate: {
        turnPhase: "closing",
        shouldEndDimension: true,
        offerChoice: false,
        choiceReason: ""
      },
      meta: {
        depthReached: ["event", "reason", "clue"]
      }
    } satisfies AssistantTurnPayload);

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "我想记住那种被朋友真正理解的感觉。",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with an assistant turn.");
    }

    expect(result.nextStage).toBe("wrap_up");
    expect(result.isReadyForDraft).toBe(true);
    expect(result.assistantTurn.question).toBe("");
    expect(result.assistantTurn.stateUpdate.turnPhase).toBe("choice");
    expect(result.assistantTurn.stateUpdate.offerChoice).toBe(true);
    expect(result.assistantTurn.stateUpdate.choiceKind).toBe("event_complete");
    expect(result.assistantTurn.stateUpdate.shouldEndDimension).toBe(false);
    expect(result.assistantTurn.stateUpdate.choiceReason).toContain("开心日志线索");
  });

  it.each(["先这样吧，直接生成日志就行。", "总结日志", "不重要，生成日志吧", "帮我整理日志"])(
    "offers a partial draft choice when joy core is clear and the user requests wrap-up: %s",
    async (userMessage) => {
      const partialSnapshot: JoySnapshot = {
        ...baseSnapshot,
        selfPattern: null,
        manualClue: null,
        confidence: 0.78,
        missingSlots: ["manualClue"]
      };

      findJoyInterviewSessionById.mockResolvedValue(
        buildSession({
          stage: "probe_pattern",
          snapshot: partialSnapshot,
          events: [
            {
              id: "event-1",
              sequence: 1,
              status: "active",
              stage: "probe_pattern",
              explorationRound: 1,
              coveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
              roundCoveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
              roundMeaningfulReplyCount: 3,
              totalMeaningfulReplyCount: 3,
              startMessageSequence: 0,
              snapshot: partialSnapshot,
              draftSummary: null,
              startedAt: "2026-04-21T00:00:00.000Z",
              completedAt: null
            }
          ]
        })
      );
      getNextStage.mockReturnValue("probe_pattern");

      const result = await prepareJoyInterviewResponse({
        userId: "user-1",
        action: "reply",
        sessionId: "session-ready",
        userMessage,
        inputMode: "text"
      });

      if ("assistantMessage" in result || !result.assistantTurn) {
        throw new Error("Expected an active interview response with an assistant turn.");
      }

      expect(result.nextStage).toBe("wrap_up");
      expect(result.isReadyForDraft).toBe(true);
      expect(result.nextProgressData).toEqual({
        kind: "event_complete",
        completionMode: "user_override_partial"
      });
      expect(result.assistantTurn.question).toBe("");
      expect(result.assistantTurn.stateUpdate.offerChoice).toBe(true);
      expect(result.assistantTurn.stateUpdate.choiceKind).toBe("event_complete");
      expect(result.assistantTurn.stateUpdate.choiceReason).toContain("当前版本日志");
      expect(extractJoySnapshotWithAI).not.toHaveBeenCalled();
    }
  );

  it("offers a complete fulfillment draft choice once progress evidence and worth standard are clear", async () => {
    const fulfillmentSnapshot: JoySnapshot = {
      event: "今天把一个拖了很久的任务推进完了",
      feeling: "踏实",
      whyItMattered: "原本卡住的部分终于收口了",
      happinessType: "推进完成型",
      selfPattern: "能把卡住的事情真正往前推进",
      confidence: 0.86,
      missingSlots: []
    };

    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        dimension: "fulfillment",
        stage: "probe_pattern",
        snapshot: {
          ...fulfillmentSnapshot,
          selfPattern: null
        },
        events: [
          {
            id: "event-1",
            sequence: 1,
            status: "active",
            stage: "probe_pattern",
            explorationRound: 1,
            coveredLenses: ["event_detail", "importance_reason"],
            roundCoveredLenses: ["event_detail", "importance_reason"],
            roundMeaningfulReplyCount: 2,
            totalMeaningfulReplyCount: 2,
            startMessageSequence: 0,
            snapshot: {
              ...fulfillmentSnapshot,
              selfPattern: null
            },
            draftSummary: null,
            startedAt: "2026-04-21T00:00:00.000Z",
            completedAt: null
          }
        ]
      })
    );
    extractJoySnapshotWithAI.mockResolvedValue(fulfillmentSnapshot);
    getNextStage.mockReturnValue("wrap_up");

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "对我来说，能把卡住的事情真正往前推进，才会觉得这一天算数。",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with an assistant turn.");
    }

    expect(result.nextStage).toBe("wrap_up");
    expect(result.nextEventStatus).toBe("ready_for_choice");
    expect(result.isReadyForDraft).toBe(true);
    expect(result.nextProgressData).toEqual({
      kind: "event_complete",
      completionMode: "complete"
    });
    expect(result.assistantTurn.question).toBe("");
    expect(result.assistantTurn.stateUpdate.offerChoice).toBe(true);
    expect(result.assistantTurn.stateUpdate.choiceKind).toBe("event_complete");
    expect(result.assistantTurn.stateUpdate.choiceReason).toContain("充实日志线索");
  });

  it("offers a partial fulfillment draft choice when progress evidence is clear and the user declines deeper worth-standard probing", async () => {
    const partialFulfillmentSnapshot: JoySnapshot = {
      event: "今天练了半小时口语",
      feeling: "踏实",
      whyItMattered: "我把前几天总卡住的发音顺过了一点",
      happinessType: "投入积累型",
      selfPattern: null,
      confidence: 0.74,
      missingSlots: ["valueSignal"]
    };

    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        dimension: "fulfillment",
        stage: "probe_pattern",
        snapshot: partialFulfillmentSnapshot,
        events: [
          {
            id: "event-1",
            sequence: 1,
            status: "active",
            stage: "probe_pattern",
            explorationRound: 1,
            coveredLenses: ["event_detail", "importance_reason"],
            roundCoveredLenses: ["event_detail", "importance_reason"],
            roundMeaningfulReplyCount: 2,
            totalMeaningfulReplyCount: 2,
            startMessageSequence: 0,
            snapshot: partialFulfillmentSnapshot,
            draftSummary: null,
            startedAt: "2026-04-21T00:00:00.000Z",
            completedAt: null
          }
        ]
      })
    );
    extractJoySnapshotWithAI.mockResolvedValue(partialFulfillmentSnapshot);
    getNextStage.mockReturnValue("wrap_up");

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "先这样吧，直接生成日志就行。",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with an assistant turn.");
    }

    expect(result.nextStage).toBe("wrap_up");
    expect(result.nextEventStatus).toBe("ready_for_choice");
    expect(result.isReadyForDraft).toBe(true);
    expect(result.nextProgressData).toEqual({
      kind: "event_complete",
      completionMode: "user_override_partial"
    });
    expect(result.assistantTurn.question).toBe("");
    expect(result.assistantTurn.stateUpdate.offerChoice).toBe(true);
    expect(result.assistantTurn.stateUpdate.choiceKind).toBe("event_complete");
    expect(result.assistantTurn.stateUpdate.choiceReason).toContain("不算白过");
    expect(result.assistantTurn.stateUpdate.choiceReason).toContain("值得感标准");
    expect(extractJoySnapshotWithAI).not.toHaveBeenCalled();
  });

  it("offers a partial reflection draft choice when trigger and insight are clear and the user asks to generate", async () => {
    const partialReflectionSnapshot: JoySnapshot = {
      event: "今天看完一个项目复盘",
      feeling: "警醒",
      whyItMattered: "我意识到自己以前太容易把忙碌当成进展",
      happinessType: "判断校准型",
      selfPattern: null,
      confidence: 0.74,
      missingSlots: ["viewpointShift"]
    };

    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        dimension: "reflection",
        stage: "probe_pattern",
        snapshot: partialReflectionSnapshot,
        events: [
          {
            id: "event-1",
            sequence: 1,
            status: "active",
            stage: "probe_pattern",
            explorationRound: 1,
            coveredLenses: ["event_detail", "importance_reason"],
            roundCoveredLenses: ["event_detail", "importance_reason"],
            roundMeaningfulReplyCount: 2,
            totalMeaningfulReplyCount: 2,
            startMessageSequence: 0,
            snapshot: partialReflectionSnapshot,
            draftSummary: null,
            startedAt: "2026-04-21T00:00:00.000Z",
            completedAt: null
          }
        ]
      })
    );
    getNextStage.mockReturnValue("wrap_up");

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "先这样吧，直接生成日志就行。",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with an assistant turn.");
    }

    expect(result.nextStage).toBe("wrap_up");
    expect(result.nextEventStatus).toBe("ready_for_choice");
    expect(result.isReadyForDraft).toBe(true);
    expect(result.nextProgressData).toEqual({
      kind: "event_complete",
      completionMode: "user_override_partial"
    });
    expect(result.assistantTurn.question).toBe("");
    expect(result.assistantTurn.stateUpdate.offerChoice).toBe(true);
    expect(result.assistantTurn.stateUpdate.choiceKind).toBe("event_complete");
    expect(result.assistantTurn.stateUpdate.choiceReason).toContain("当前版本日志");
    expect(result.assistantTurn.stateUpdate.choiceReason).toContain("判断线索");
    expect(extractJoySnapshotWithAI).not.toHaveBeenCalled();
  });

  it("offers a complete improvement draft choice once cause, controllable factor and next attempt are clear", async () => {
    const completeImprovementSnapshot: JoySnapshot = {
      event: "今天开会时对方问题还没说完我就开始解释",
      feeling: "有点急",
      whyItMattered: "对方问题还没说完我就开始解释",
      happinessType: "表达型改进",
      selfPattern: "下次先复述一遍问题，再开始回答",
      improvementTrack: "avoid_bad",
      stateAssessment: "这次有点急，回答前没有确认问题",
      frictionPoint: "对方问题还没说完我就开始解释",
      repeatCondition: null,
      controllableFactor: "回答前先复述或确认问题",
      nextAttempt: "下次先复述一遍问题，再开始回答",
      successSignal: "对方确认问题被理解，回答没有跑偏",
      confidence: 0.86,
      missingSlots: []
    };

    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        dimension: "improvement",
        stage: "probe_pattern",
        snapshot: {
          ...completeImprovementSnapshot,
          controllableFactor: null,
          nextAttempt: null
        },
        events: [
          {
            id: "event-1",
            sequence: 1,
            status: "active",
            stage: "probe_pattern",
            explorationRound: 1,
            coveredLenses: ["event_detail", "importance_reason"],
            roundCoveredLenses: ["event_detail", "importance_reason"],
            roundMeaningfulReplyCount: 2,
            totalMeaningfulReplyCount: 2,
            startMessageSequence: 0,
            snapshot: {
              ...completeImprovementSnapshot,
              controllableFactor: null,
              nextAttempt: null
            },
            draftSummary: null,
            startedAt: "2026-04-21T00:00:00.000Z",
            completedAt: null
          }
        ]
      })
    );
    extractJoySnapshotWithAI.mockResolvedValue(completeImprovementSnapshot);
    getNextStage.mockReturnValue("wrap_up");

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "下次我先复述一遍问题，再开始回答，这样确认没有跑偏。",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with an assistant turn.");
    }

    expect(result.nextStage).toBe("wrap_up");
    expect(result.nextEventStatus).toBe("ready_for_choice");
    expect(result.isReadyForDraft).toBe(true);
    expect(result.nextProgressData).toEqual({
      kind: "event_complete",
      completionMode: "complete"
    });
    expect(result.assistantTurn.question).toBe("");
    expect(result.assistantTurn.stateUpdate.offerChoice).toBe(true);
    expect(result.assistantTurn.stateUpdate.choiceKind).toBe("event_complete");
    expect(result.assistantTurn.stateUpdate.choiceReason).toContain("改进尝试线索");
  });

  it("rejects draft generation when the session is still in boundary_insufficient", async () => {
    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        dimension: "fulfillment",
        draftGenerationUnlocked: false,
        pendingDecision: {
          kind: "boundary_insufficient",
          eventId: "event-1",
          eventSequence: 1,
          reason: "我不再继续追问细节了。",
          actions: ["continue_current_event", "next_event", "pause_session"]
        }
      })
    );

    await expect(generateJoyInterviewDraft("user-1", ["session-ready"])).rejects.toMatchObject({
      code: "DRAFT_GENERATE_NOT_READY",
      retryable: false
    } satisfies Partial<DraftGenerationError>);
    expect(generateJoyDraftWithAI).not.toHaveBeenCalled();
    expect(saveJoyInterviewDraft).not.toHaveBeenCalled();
  });

  it("offers a partial improvement draft choice when cause is clear and the user asks to generate", async () => {
    const partialImprovementSnapshot: JoySnapshot = {
      event: "今天上午我先写了三条重点再开工",
      feeling: "很稳",
      whyItMattered: "先写三条重点后主线没有被消息带着跑",
      happinessType: "节奏型改进",
      selfPattern: null,
      improvementTrack: "repeat_good",
      stateAssessment: "这次有一个值得重复的好状态",
      frictionPoint: null,
      repeatCondition: "先写三条重点后主线没有被消息带着跑",
      controllableFactor: null,
      nextAttempt: null,
      confidence: 0.72,
      missingSlots: ["controllableFactor", "nextAttempt"]
    };

    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        dimension: "improvement",
        stage: "probe_pattern",
        snapshot: partialImprovementSnapshot,
        events: [
          {
            id: "event-1",
            sequence: 1,
            status: "active",
            stage: "probe_pattern",
            explorationRound: 1,
            coveredLenses: ["event_detail", "importance_reason"],
            roundCoveredLenses: ["event_detail", "importance_reason"],
            roundMeaningfulReplyCount: 2,
            totalMeaningfulReplyCount: 2,
            startMessageSequence: 0,
            snapshot: partialImprovementSnapshot,
            draftSummary: null,
            startedAt: "2026-04-21T00:00:00.000Z",
            completedAt: null
          }
        ]
      })
    );
    getNextStage.mockReturnValue("probe_pattern");

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "先这样吧，直接生成日志就行。",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with an assistant turn.");
    }

    expect(result.nextStage).toBe("wrap_up");
    expect(result.nextEventStatus).toBe("ready_for_choice");
    expect(result.nextProgressData).toEqual({
      kind: "event_complete",
      completionMode: "user_override_partial"
    });
    expect(result.assistantTurn.stateUpdate.choiceReason).toContain("改进情境和关键原因");
    expect(extractJoySnapshotWithAI).not.toHaveBeenCalled();
  });

  it("offers a partial improvement draft choice when the user stops with a concrete avoid-bad cause", async () => {
    const partialAvoidBadSnapshot: JoySnapshot = {
      event: "今天沟通有点急",
      feeling: "有点急",
      whyItMattered: "沟通时太急，没有听完整",
      happinessType: "沟通节奏",
      selfPattern: null,
      improvementTrack: "avoid_bad",
      stateAssessment: "沟通时有点急",
      frictionPoint: "沟通时太急，没有听完整",
      repeatCondition: null,
      controllableFactor: null,
      nextAttempt: null,
      confidence: 0.72,
      missingSlots: ["controllableFactor", "nextAttempt"]
    };

    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        dimension: "improvement",
        stage: "probe_pattern",
        snapshot: partialAvoidBadSnapshot,
        events: [
          {
            id: "event-1",
            sequence: 1,
            status: "active",
            stage: "probe_pattern",
            explorationRound: 1,
            coveredLenses: ["event_detail", "importance_reason"],
            roundCoveredLenses: ["event_detail", "importance_reason"],
            roundMeaningfulReplyCount: 2,
            totalMeaningfulReplyCount: 2,
            startMessageSequence: 0,
            snapshot: partialAvoidBadSnapshot,
            draftSummary: null,
            startedAt: "2026-04-21T00:00:00.000Z",
            completedAt: null
          }
        ]
      })
    );

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "今天沟通有点急，别追问了，直接整理。",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with an assistant turn.");
    }

    expect(result.nextStage).toBe("wrap_up");
    expect(result.nextEventStatus).toBe("ready_for_choice");
    expect(result.isReadyForDraft).toBe(true);
    expect(result.nextProgressData).toEqual({
      kind: "event_complete",
      completionMode: "user_override_partial"
    });
    expect(result.assistantTurn.question).toBe("");
    expect(result.assistantTurn.stateUpdate.offerChoice).toBe(true);
    expect(result.assistantTurn.stateUpdate.choiceKind).toBe("event_complete");
    expect(result.assistantTurn.stateUpdate.choiceReason).toContain("改进情境和关键原因");
    expect(result.nextSnapshot.nextAttempt).toBeNull();
    expect(extractJoySnapshotWithAI).not.toHaveBeenCalled();
  });

  it("keeps improvement in boundary_insufficient when the user stops before a cause exists", async () => {
    const insufficientImprovementSnapshot: JoySnapshot = {
      event: "今天很糟",
      feeling: null,
      whyItMattered: null,
      happinessType: null,
      selfPattern: null,
      improvementTrack: null,
      stateAssessment: null,
      frictionPoint: null,
      repeatCondition: null,
      controllableFactor: null,
      nextAttempt: null,
      confidence: 0.3,
      missingSlots: ["frictionPointOrRepeatCondition"]
    };

    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        dimension: "improvement",
        stage: "probe_reason",
        snapshot: insufficientImprovementSnapshot,
        events: [
          {
            id: "event-1",
            sequence: 1,
            status: "active",
            stage: "probe_reason",
            explorationRound: 1,
            coveredLenses: ["event_detail" as const],
            roundCoveredLenses: ["event_detail" as const],
            roundMeaningfulReplyCount: 1,
            totalMeaningfulReplyCount: 1,
            startMessageSequence: 0,
            snapshot: insufficientImprovementSnapshot,
            draftSummary: null,
            startedAt: "2026-04-21T00:00:00.000Z",
            completedAt: null
          }
        ]
      })
    );

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "别问了，不想聊了。",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with an assistant turn.");
    }

    expect(result.isReadyForDraft).toBe(false);
    expect(result.nextProgressData).toEqual({
      kind: "boundary_insufficient",
      reason: "我不再继续追问细节了。"
    });
    expect(result.assistantTurn.insight).toBe("你已经把现在的边界说清了，我先停在这里，不再继续追问细节。");
    expect(result.assistantTurn.stateUpdate.choiceKind).toBe("boundary_insufficient");
    expect(extractJoySnapshotWithAI).not.toHaveBeenCalled();
  });

  it("allows next_event from a boundary_insufficient choice when the action is offered", async () => {
    const insufficientImprovementSnapshot: JoySnapshot = {
      event: "今天很糟",
      feeling: null,
      whyItMattered: null,
      happinessType: null,
      selfPattern: null,
      improvementTrack: null,
      stateAssessment: null,
      frictionPoint: null,
      repeatCondition: null,
      controllableFactor: null,
      nextAttempt: null,
      confidence: 0.3,
      missingSlots: ["frictionPointOrRepeatCondition"]
    };

    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        dimension: "improvement",
        stage: "wrap_up",
        snapshot: insufficientImprovementSnapshot,
        activeEventId: "event-1",
        pendingDecision: {
          kind: "boundary_insufficient",
          eventId: "event-1",
          eventSequence: 1,
          reason: "我不再继续追问细节了。",
          actions: ["continue_current_event", "next_event", "pause_session"]
        },
        events: [
          {
            id: "event-1",
            sequence: 1,
            status: "ready_for_choice",
            stage: "wrap_up",
            explorationRound: 1,
            coveredLenses: ["event_detail" as const],
            roundCoveredLenses: ["event_detail" as const],
            roundMeaningfulReplyCount: 1,
            totalMeaningfulReplyCount: 1,
            startMessageSequence: 0,
            snapshot: insufficientImprovementSnapshot,
            draftSummary: null,
            startedAt: "2026-04-21T00:00:00.000Z",
            completedAt: null
          }
        ]
      })
    );

    const nextSession = buildSession({
      dimension: "improvement",
      stage: "collect_event",
      activeEventId: "event-2",
      lastAssistantQuestion: "今天有没有另一个让你觉得下次可以更好一点的具体时刻？先讲那个情境。",
      messages: [
        {
          id: "assistant-next",
          role: "assistant",
          content: "今天有没有另一个让你觉得下次可以更好一点的具体时刻？先讲那个情境。",
          assistantPayload: {
            insight: "",
            thinkingSummary: "",
            analysis: "",
            question: "今天有没有另一个让你觉得下次可以更好一点的具体时刻？先讲那个情境。",
            stateUpdate: {
              turnPhase: "opening",
              shouldEndDimension: false,
              offerChoice: false,
              choiceReason: ""
            },
            meta: {
              depthReached: ["event"]
            }
          },
          sequence: 1,
          createdAt: "2026-04-21T00:05:00.000Z"
        }
      ],
      events: [
        {
          id: "event-1",
          sequence: 1,
          status: "completed",
          stage: "wrap_up",
          explorationRound: 1,
          coveredLenses: ["event_detail" as const],
          roundCoveredLenses: ["event_detail" as const],
          roundMeaningfulReplyCount: 1,
          totalMeaningfulReplyCount: 1,
          startMessageSequence: 0,
          snapshot: insufficientImprovementSnapshot,
          draftSummary: null,
          startedAt: "2026-04-21T00:00:00.000Z",
          completedAt: "2026-04-21T00:04:00.000Z"
        },
        {
          id: "event-2",
          sequence: 2,
          status: "active",
          stage: "collect_event",
          explorationRound: 1,
          coveredLenses: [],
          roundCoveredLenses: [],
          roundMeaningfulReplyCount: 0,
          totalMeaningfulReplyCount: 0,
          startMessageSequence: 1,
          snapshot: {
            event: null,
            feeling: null,
            whyItMattered: null,
            happinessType: null,
            selfPattern: null,
            confidence: 0,
            missingSlots: ["event", "reason"]
          },
          draftSummary: null,
          startedAt: "2026-04-21T00:05:00.000Z",
          completedAt: null
        }
      ],
      pendingDecision: null
    });

    startNextInterviewEvent.mockResolvedValue(nextSession);

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "next_event",
      sessionId: "session-ready"
    });

    expect(startNextInterviewEvent).toHaveBeenCalledWith(
      "session-ready",
      "如果今天还有另一个你想复盘的改进情境，我们就聊那件事。那一刻发生了什么？"
    );
    expect(result).toMatchObject({
      assistantMessage: "今天有没有另一个让你觉得下次可以更好一点的具体时刻？先讲那个情境。",
      sessionStatus: "active"
    });
    expect(result.session.activeEventId).toBe("event-2");
    expect(result.session.pendingDecision).toBeNull();
  });

  it("returns a low-pressure boundary choice when the user requests a log before reflection has concrete insight", async () => {
    const insufficientReflectionSnapshot: JoySnapshot = {
      event: null,
      feeling: null,
      whyItMattered: null,
      happinessType: null,
      selfPattern: null,
      confidence: 0.2,
      missingSlots: ["trigger", "insight", "viewpointShift"]
    };

    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        dimension: "reflection",
        stage: "collect_event",
        snapshot: insufficientReflectionSnapshot,
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
            snapshot: insufficientReflectionSnapshot,
            draftSummary: null,
            startedAt: "2026-04-21T00:00:00.000Z",
            completedAt: null
          }
        ]
      })
    );

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "生成日志吧。",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with an assistant turn.");
    }

    expect(result.isReadyForDraft).toBe(false);
    expect(result.nextProgressData).toEqual({
      kind: "boundary_insufficient",
      reason: "我不再继续追问细节了。"
    });
    expect(result.assistantTurn.insight).toBe("你已经把现在的边界说清了，我先停在这里，不再继续追问细节。");
    expect(result.assistantTurn.stateUpdate.choiceKind).toBe("boundary_insufficient");
    expect(result.assistantTurn.question).toContain("这个片段最关键的一点");
    expect(extractJoySnapshotWithAI).not.toHaveBeenCalled();
  });

  it("does not keep probing when the user challenges the repeated follow-up", async () => {
    const partialFulfillmentSnapshot: JoySnapshot = {
      event: "今天练了半小时口语",
      feeling: "踏实",
      whyItMattered: "我把前几天总卡住的发音顺过了一点",
      happinessType: "投入积累型",
      selfPattern: null,
      confidence: 0.74,
      missingSlots: ["valueSignal"]
    };

    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        dimension: "fulfillment",
        stage: "probe_pattern",
        snapshot: partialFulfillmentSnapshot,
        events: [
          {
            id: "event-1",
            sequence: 1,
            status: "active",
            stage: "probe_pattern",
            explorationRound: 1,
            coveredLenses: ["event_detail", "importance_reason"],
            roundCoveredLenses: ["event_detail", "importance_reason"],
            roundMeaningfulReplyCount: 2,
            totalMeaningfulReplyCount: 2,
            startMessageSequence: 0,
            snapshot: partialFulfillmentSnapshot,
            draftSummary: null,
            startedAt: "2026-04-21T00:00:00.000Z",
            completedAt: null
          }
        ]
      })
    );

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "这追问有什么意义吗？你干嘛老纠结具体步骤。",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with an assistant turn.");
    }

    expect(result.nextProgressData).toEqual({
      kind: "event_complete",
      completionMode: "user_override_partial"
    });
    expect(result.assistantTurn.question).toBe("");
    expect(extractJoySnapshotWithAI).not.toHaveBeenCalled();
    expect(generateJoyAssistantTurn).not.toHaveBeenCalled();
  });

  it("returns a low-pressure boundary choice when the user stops before there is enough material", async () => {
    const insufficientSnapshot: JoySnapshot = {
      event: "今天有点累",
      feeling: null,
      whyItMattered: null,
      happinessType: null,
      selfPattern: null,
      confidence: 0.3,
      missingSlots: ["whyItMattered"]
    };

    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        dimension: "fulfillment",
        stage: "probe_reason",
        snapshot: insufficientSnapshot,
        events: [
          {
            id: "event-1",
            sequence: 1,
            status: "active",
            stage: "probe_reason",
            explorationRound: 1,
            coveredLenses: ["event_detail" as const],
            roundCoveredLenses: ["event_detail" as const],
            roundMeaningfulReplyCount: 1,
            totalMeaningfulReplyCount: 1,
            startMessageSequence: 0,
            snapshot: insufficientSnapshot,
            draftSummary: null,
            startedAt: "2026-04-21T00:00:00.000Z",
            completedAt: null
          }
        ]
      })
    );

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "别问了，先这样。",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with an assistant turn.");
    }

    expect(result.isReadyForDraft).toBe(false);
    expect(result.nextProgressData).toEqual({
      kind: "boundary_insufficient",
      reason: "我不再继续追问细节了。"
    });
    expect(result.assistantTurn.insight).toBe("你已经把现在的边界说清了，我先停在这里，不再继续追问细节。");
    expect(result.assistantTurn.stateUpdate.choiceKind).toBe("boundary_insufficient");
    expect(extractJoySnapshotWithAI).not.toHaveBeenCalled();
  });

  it("offers a redirect choice when joy stays empty after repeated no-joy replies", async () => {
    const emptyJoySnapshot: JoySnapshot = {
      event: null,
      feeling: null,
      whyItMattered: null,
      happinessType: null,
      selfPattern: null,
      joyMoment: null,
      joySource: null,
      stateShift: null,
      meaningNeed: null,
      manualClue: null,
      delightSignature: null,
      confidence: 0.2,
      missingSlots: ["joyMoment", "joySource", "stateShiftOrMeaningNeed", "manualClue"]
    };

    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        stage: "collect_event",
        snapshot: emptyJoySnapshot,
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
            totalMeaningfulReplyCount: 2,
            startMessageSequence: 0,
            snapshot: emptyJoySnapshot,
            draftSummary: null,
            startedAt: "2026-04-21T00:00:00.000Z",
            completedAt: null
          }
        ]
      })
    );
    getNextStage.mockReturnValue("collect_event");
    extractJoySnapshotWithAI.mockResolvedValue(emptyJoySnapshot);

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "没什么开心，想不到。",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with an assistant turn.");
    }

    expect(result.nextEventStatus).toBe("ready_for_choice");
    expect(result.nextProgressData).toEqual({
      kind: "dimension_redirect",
      targetDimension: "improvement",
      reason: "已经尝试降低门槛，但这一天仍然没有找到可信的开心片段，更适合转去复盘改进。"
    });
    expect(result.isReadyForDraft).toBe(false);
    expect(result.assistantTurn.stateUpdate.offerChoice).toBe(true);
    expect(result.assistantTurn.stateUpdate.choiceKind).toBe("dimension_redirect");
    expect(result.assistantTurn.stateUpdate.shouldEndDimension).toBe(true);
    expect(result.assistantTurn.stateUpdate.choiceReason).toContain("更适合转去复盘改进");
  });

  it("asks a real follow-up after continuing from a wrap-up choice instead of looping back to choice", async () => {
    const choiceSession = buildSession({
      stage: "wrap_up",
      draftGenerationUnlocked: true,
      lastAssistantQuestion: "",
      pendingDecision: {
        kind: "event_complete",
        eventId: "event-1",
        eventSequence: 1,
        actions: ["continue_current_event", "next_event", "generate_draft"]
      },
      events: [
        {
          id: "event-1",
          sequence: 1,
          status: "ready_for_choice",
          stage: "wrap_up",
          explorationRound: 1,
          coveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
          roundCoveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
          roundMeaningfulReplyCount: 3,
          totalMeaningfulReplyCount: 3,
          startMessageSequence: 0,
          snapshot: baseSnapshot,
          draftSummary: null,
          startedAt: "2026-04-21T00:00:00.000Z",
          completedAt: null
        }
      ],
      messages: [
        {
          id: "assistant-choice",
          role: "assistant",
          content: "这段经历为什么重要，已经慢慢清楚起来了。",
          assistantPayload: {
            insight: "这段经历为什么重要，已经慢慢清楚起来了。",
            thinkingSummary: "",
            analysis: "用户已说：关系里的被理解；下一步：由用户决定是否继续",
            question: "",
            stateUpdate: {
              turnPhase: "choice",
              shouldEndDimension: false,
              offerChoice: true,
              choiceReason: "当前信息已经足够，直接让用户决定继续聊还是现在整理。"
            },
            meta: {
              depthReached: ["event", "reason", "clue"]
            }
          },
          sequence: 0,
          createdAt: "2026-04-21T00:00:00.000Z"
        }
      ]
    });

    findJoyInterviewSessionById.mockResolvedValue(choiceSession);
    resumeCurrentInterviewEvent.mockResolvedValue(
      buildSession({
        stage: "probe_pattern",
        lastAssistantQuestion: "",
        events: [
          {
            id: "event-1",
            sequence: 1,
            status: "active",
            stage: "probe_pattern",
            explorationRound: 2,
            coveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
            roundCoveredLenses: [],
            roundMeaningfulReplyCount: 0,
            totalMeaningfulReplyCount: 3,
            startMessageSequence: 0,
            snapshot: baseSnapshot,
            draftSummary: null,
            startedAt: "2026-04-21T00:00:00.000Z",
            completedAt: null
          }
        ],
        pendingDecision: null
      })
    );
    generateJoyAssistantTurn.mockResolvedValue({
      insight: "",
      thinkingSummary: "我们已经碰到这段经历里你很在意的那层了，所以我想顺着它继续确认，它真正打动你的地方到底是什么。",
      analysis: "用户刚刚选择继续聊；下一步问：关系在乎点",
      question: "你觉得自己在关系里最在乎什么？",
      stateUpdate: {
        turnPhase: "digging",
        shouldEndDimension: false,
        offerChoice: false,
        choiceReason: ""
      },
      meta: {
        depthReached: ["event", "reason", "clue"]
      }
    } satisfies AssistantTurnPayload);

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "continue",
      sessionId: "session-ready"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with an assistant turn.");
    }

    expect(generateJoyAssistantTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "probe_pattern",
        action: "continue_current_event"
      })
    );
    expect(result.nextStage).toBe("probe_pattern");
    expect(result.assistantTurn.question).toBe("你觉得自己在关系里最在乎什么？");
    expect(result.assistantTurn.thinkingSummary).toBe(
      "这份开心的重点，不是表面上的片段，而是“被朋友真正接住的感觉”这种被接住的感觉，顺着这份开心真正有分量的地方，继续说清。"
    );
    expect(result.assistantTurn.insight).toBe("");
    expect(result.assistantTurn.stateUpdate.offerChoice).toBe(false);
    expect(result.assistantTurn.stateUpdate.turnPhase).toBe("digging");
  });

  it("reframes reflection continue prompts when the user has already said there was no concrete scene", async () => {
    const reflectionSnapshot: JoySnapshot = {
      event: "面临毕业-就业节点的选择",
      feeling: null,
      whyItMattered: "意识到‘看起来合适’是基于外部视角的评判，而‘真正想要的生活’需要基于亲身经历的内部视角来判断",
      happinessType: "判断校准型",
      selfPattern: "过去在所有事情上都依赖外部标准",
      confidence: 0.78,
      missingSlots: ["stateShiftOrMeaningNeed"]
    };

    const choiceSession = buildSession({
      dimension: "reflection",
      stage: "wrap_up",
      draftGenerationUnlocked: true,
      lastAssistantQuestion: "",
      snapshot: reflectionSnapshot,
      pendingDecision: {
        kind: "event_complete",
        eventId: "event-1",
        eventSequence: 1,
        actions: ["continue_current_event", "next_event", "generate_draft"]
      },
      events: [
        {
          id: "event-1",
          sequence: 1,
          status: "ready_for_choice",
          stage: "wrap_up",
          explorationRound: 1,
          coveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
          roundCoveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
          roundMeaningfulReplyCount: 6,
          totalMeaningfulReplyCount: 6,
          startMessageSequence: 0,
          snapshot: reflectionSnapshot,
          draftSummary: null,
          startedAt: "2026-05-04T06:43:00.000Z",
          completedAt: null
        }
      ],
      messages: [
        {
          id: "assistant-scene",
          role: "assistant",
          content: JSON.stringify({
            insight: "",
            thinkingSummary: "这次思考的核心，是区分了“看起来合适”的外部评判和“真正想要”的内部体验，这正在成为你判断未来方向的新依据。",
            analysis: "用户已继续补充当前事件；下一步问：推进当前阶段尚未覆盖的层次。",
            question: "今天有什么具体的经历或对话，让你第一次清晰地感受到这种“局外人”和“局内人”视角的差异？",
            stateUpdate: {
              turnPhase: "digging",
              shouldEndDimension: false,
              offerChoice: false,
              choiceKind: null,
              choiceReason: ""
            },
            meta: {
              depthReached: ["event", "reason"]
            }
          } satisfies AssistantTurnPayload),
          assistantPayload: {
            insight: "",
            thinkingSummary: "这次思考的核心，是区分了“看起来合适”的外部评判和“真正想要”的内部体验，这正在成为你判断未来方向的新依据。",
            analysis: "用户已继续补充当前事件；下一步问：推进当前阶段尚未覆盖的层次。",
            question: "今天有什么具体的经历或对话，让你第一次清晰地感受到这种“局外人”和“局内人”视角的差异？",
            stateUpdate: {
              turnPhase: "digging",
              shouldEndDimension: false,
              offerChoice: false,
              choiceKind: null,
              choiceReason: ""
            },
            meta: {
              depthReached: ["event", "reason"]
            }
          },
          sequence: 0,
          createdAt: "2026-05-04T06:46:14.409Z"
        },
        {
          id: "user-scene-denial",
          role: "user",
          content: "没有，是我今天自发的思考，因为我要选择就业方向了",
          sequence: 1,
          createdAt: "2026-05-04T06:46:51.436Z"
        },
        {
          id: "assistant-pattern",
          role: "assistant",
          content: JSON.stringify({
            insight: "",
            thinkingSummary: "这次判断校准的起点，是你在选择就业方向时，自发地意识到不能依赖外部视角的“看起来合适”，而要转向内部视角。",
            analysis: "用户已继续补充当前事件；下一步问：推进当前阶段尚未覆盖的层次。",
            question: "在“局外人”和“局内人”这个视角的区分上，你发现自己过去在判断什么事情时，最容易依赖“看起来合适”这个外部标准？",
            stateUpdate: {
              turnPhase: "digging",
              shouldEndDimension: false,
              offerChoice: false,
              choiceKind: null,
              choiceReason: ""
            },
            meta: {
              depthReached: ["event", "reason"]
            }
          } satisfies AssistantTurnPayload),
          assistantPayload: {
            insight: "",
            thinkingSummary: "这次判断校准的起点，是你在选择就业方向时，自发地意识到不能依赖外部视角的“看起来合适”，而要转向内部视角。",
            analysis: "用户已继续补充当前事件；下一步问：推进当前阶段尚未覆盖的层次。",
            question: "在“局外人”和“局内人”这个视角的区分上，你发现自己过去在判断什么事情时，最容易依赖“看起来合适”这个外部标准？",
            stateUpdate: {
              turnPhase: "digging",
              shouldEndDimension: false,
              offerChoice: false,
              choiceKind: null,
              choiceReason: ""
            },
            meta: {
              depthReached: ["event", "reason"]
            }
          },
          sequence: 2,
          createdAt: "2026-05-04T06:46:51.436Z"
        },
        {
          id: "user-generalized-answer",
          role: "user",
          content: "所有事情都是，因为我没有自我认知",
          sequence: 3,
          createdAt: "2026-05-04T06:47:42.826Z"
        },
        {
          id: "assistant-choice",
          role: "assistant",
          content: JSON.stringify({
            insight: "这一段已经聊到以后判断类似事情时可以带着的一条线索了，已经够写成一版日志。",
            thinkingSummary: "",
            analysis: "当前事件已形成可信的思考日志线索，下一步交给用户决定：继续深挖、切到下一件事，或直接生成日志。",
            question: "",
            stateUpdate: {
              turnPhase: "choice",
              shouldEndDimension: false,
              offerChoice: true,
              choiceKind: "event_complete",
              choiceReason: "当前事件已经形成一条可信的思考日志线索，交给用户决定下一步。"
            },
            meta: {
              depthReached: ["event", "reason", "pattern"]
            }
          } satisfies AssistantTurnPayload),
          assistantPayload: {
            insight: "这一段已经聊到以后判断类似事情时可以带着的一条线索了，已经够写成一版日志。",
            thinkingSummary: "",
            analysis: "当前事件已形成可信的思考日志线索，下一步交给用户决定：继续深挖、切到下一件事，或直接生成日志。",
            question: "",
            stateUpdate: {
              turnPhase: "choice",
              shouldEndDimension: false,
              offerChoice: true,
              choiceKind: "event_complete",
              choiceReason: "当前事件已经形成一条可信的思考日志线索，交给用户决定下一步。"
            },
            meta: {
              depthReached: ["event", "reason", "pattern"]
            }
          },
          sequence: 4,
          createdAt: "2026-05-04T06:47:42.826Z"
        }
      ]
    });

    findJoyInterviewSessionById.mockResolvedValue(choiceSession);
    resumeCurrentInterviewEvent.mockResolvedValue(
      buildSession({
        dimension: "reflection",
        stage: "probe_pattern",
        lastAssistantQuestion: "",
        snapshot: reflectionSnapshot,
        events: [
          {
            id: "event-1",
            sequence: 1,
            status: "active",
            stage: "probe_pattern",
            explorationRound: 2,
            coveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
            roundCoveredLenses: [],
            roundMeaningfulReplyCount: 0,
            totalMeaningfulReplyCount: 6,
            startMessageSequence: 0,
            snapshot: reflectionSnapshot,
            draftSummary: null,
            startedAt: "2026-05-04T06:43:00.000Z",
            completedAt: null
          }
        ],
        pendingDecision: null,
        messages: choiceSession.messages
      })
    );
    generateJoyAssistantTurn.mockResolvedValue({
      insight: "",
      thinkingSummary: "这次思考的核心，是区分了“看起来合适”的外部评判和“真正想要”的内部体验，这正在成为你判断未来方向的新依据。",
      analysis: "用户刚刚选择继续深挖当前事件；下一步问：换一个角度继续追问。",
      question: "今天有什么具体的经历或对话，让你第一次清晰地感受到这种“局外人”和“局内人”视角的差异？",
      stateUpdate: {
        turnPhase: "digging",
        shouldEndDimension: false,
        offerChoice: false,
        choiceReason: ""
      },
      meta: {
        depthReached: ["event", "reason", "pattern"]
      }
    } satisfies AssistantTurnPayload);

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "continue",
      sessionId: "session-ready"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with an assistant turn.");
    }

    expect(result.assistantTurn.question).toBe(
      "如果不是某段具体对话，那在“面临毕业-就业节点的选择”这件事里，哪一个具体顾虑、画面或念头，最先让你意识到不能只看“看起来合适”？"
    );
    expect(result.assistantTurn.question).not.toContain("具体的经历或对话");
    expect(result.assistantTurn.stateUpdate.offerChoice).toBe(false);
  });

  it("offers a complete choice again after one meaningful follow-up in a continued round", async () => {
    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        stage: "probe_pattern",
        turnCount: 3,
        lastAssistantQuestion: "如果顺着这段关系里的在乎继续往下说，你觉得最稳定的一条线索是什么？",
        events: [
          {
            id: "event-1",
            sequence: 1,
            status: "active",
            stage: "probe_pattern",
            explorationRound: 2,
            coveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
            roundCoveredLenses: [],
            roundMeaningfulReplyCount: 0,
            totalMeaningfulReplyCount: 3,
            startMessageSequence: 0,
            snapshot: baseSnapshot,
            draftSummary: null,
            startedAt: "2026-04-21T00:00:00.000Z",
            completedAt: null
          }
        ]
      })
    );
    extractJoySnapshotWithAI.mockResolvedValue(baseSnapshot);
    getNextStage.mockReturnValue("wrap_up");

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "我发现只要能真正把心里的话说出来，我就会很快放松下来。",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with a choice turn.");
    }

    expect(result.nextEventStatus).toBe("ready_for_choice");
    expect(result.nextProgressData).toEqual({
      kind: "event_complete",
      completionMode: "complete"
    });
    expect(result.assistantTurn.stateUpdate.choiceKind).toBe("event_complete");
    expect(result.assistantTurn.insight).toContain("已经够写成一版日志");
  });

  it("backfills a thinking summary when the model returns only a follow-up question on a new event", async () => {
    const nextEventOpeningQuestion = "如果今天还有另一件让你开心的事，我们就聊那一件。那个瞬间是什么？";
    const nextEventSnapshot: JoySnapshot = {
      event: "读罗永浩的书",
      feeling: "轻松踏实",
      whyItMattered: null,
      happinessType: null,
      selfPattern: null,
      confidence: 0.6,
      missingSlots: ["whyItMattered", "happinessTypeOrSelfPattern"]
    };

    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        activeEventId: "event-2",
        stage: "collect_event",
        turnCount: 3,
        lastAssistantQuestion: nextEventOpeningQuestion,
        messages: [
          {
            id: "assistant-next-event-opening",
            role: "assistant",
            content: nextEventOpeningQuestion,
            assistantPayload: {
              insight: "",
              thinkingSummary: "",
              analysis: "",
              question: nextEventOpeningQuestion,
              stateUpdate: {
                turnPhase: "opening",
                shouldEndDimension: false,
                offerChoice: false,
                choiceReason: ""
              },
              meta: {
                depthReached: []
              }
            },
            sequence: 0,
            createdAt: "2026-04-21T00:10:00.000Z"
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
        events: [
          {
            id: "event-1",
            sequence: 1,
            status: "completed",
            stage: "wrap_up",
            explorationRound: 2,
            coveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
            roundCoveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
            roundMeaningfulReplyCount: 2,
            totalMeaningfulReplyCount: 4,
            startMessageSequence: 0,
            snapshot: baseSnapshot,
            draftSummary: null,
            startedAt: "2026-04-21T00:00:00.000Z",
            completedAt: "2026-04-21T00:09:00.000Z"
          },
          {
            id: "event-2",
            sequence: 2,
            status: "active",
            stage: "collect_event",
            explorationRound: 1,
            coveredLenses: [],
            roundCoveredLenses: [],
            roundMeaningfulReplyCount: 0,
            totalMeaningfulReplyCount: 0,
            startMessageSequence: 1,
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
            startedAt: "2026-04-21T00:10:00.000Z",
            completedAt: null
          }
        ],
        pendingDecision: null
      })
    );
    extractJoySnapshotWithAI.mockResolvedValue(nextEventSnapshot);
    getNextStage.mockReturnValue("probe_reason");
    generateJoyAssistantTurn.mockResolvedValue({
      insight: "",
      thinkingSummary: "",
      analysis: "用户已补充新的开心片段；下一步问：继续确认为什么开心。",
      question: "当时是读到了什么，让你觉得开心？",
      stateUpdate: {
        turnPhase: "digging",
        shouldEndDimension: false,
        offerChoice: false,
        choiceReason: ""
      },
      meta: {
        depthReached: ["event", "feeling"]
      }
    } satisfies AssistantTurnPayload);

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "读罗永浩的书，语言幽默。",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with an assistant turn.");
    }

    expect(result.nextStage).toBe("probe_reason");
    expect(result.assistantTurn.thinkingSummary).toBe(
      "这份开心真正算数的地方，是把自己的状态重新找回来了，处理重点是分辨它为什么偏偏会在这里让人有感觉。"
    );
    expect(result.assistantTurn.insight).toBe("");
    expect(result.assistantTurn.question).toBe("当时是读到了什么，让你觉得开心？");
    expect(result.assistantTurn.stateUpdate.offerChoice).toBe(false);
  });

  it("keeps probing when wrap-up is reached before the choice threshold", async () => {
    const preWrapSnapshot: JoySnapshot = {
      ...baseSnapshot,
      happinessType: null,
      confidence: 0.7,
      missingSlots: ["happinessTypeOrSelfPattern"]
    };

    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        stage: "probe_reason",
        turnCount: 1,
        lastAssistantQuestion: "听起来这件事有分量。它为什么会让你这么开心？",
        snapshot: preWrapSnapshot,
        events: [
          {
            id: "event-1",
            sequence: 1,
            status: "active",
            stage: "probe_reason",
            explorationRound: 1,
            coveredLenses: ["event_detail", "importance_reason"],
            roundCoveredLenses: ["event_detail", "importance_reason"],
            roundMeaningfulReplyCount: 1,
            totalMeaningfulReplyCount: 1,
            startMessageSequence: 0,
            snapshot: preWrapSnapshot,
            draftSummary: null,
            startedAt: "2026-04-21T00:00:00.000Z",
            completedAt: null
          }
        ]
      })
    );
    extractJoySnapshotWithAI.mockResolvedValue(baseSnapshot);
    getNextStage.mockReturnValue("wrap_up");
    buildAssistantQuestion.mockReturnValue("如果再往里看一点，这份开心更像满足了你什么？");
    generateJoyAssistantTurn.mockResolvedValue({
      insight: "",
      thinkingSummary: "你已经说清楚，这更像是一种让自己重新活过来的方式。",
      analysis: "用户已说：运动能重启自己；下一步问：更深层的满足类型",
      question: "",
      stateUpdate: {
        turnPhase: "digging",
        shouldEndDimension: false,
        offerChoice: false,
        choiceReason: ""
      },
      meta: {
        depthReached: ["event", "reason", "clue"]
      }
    } satisfies AssistantTurnPayload);

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "当我感觉大脑疲惫的时候，我会想运动来让身体重新活跃起来。",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with an assistant turn.");
    }

    expect(generateJoyAssistantTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "probe_pattern"
      })
    );
    expect(buildAssistantQuestion).toHaveBeenCalledWith("joy", "probe_pattern", baseSnapshot);
    expect(result.nextStage).toBe("probe_pattern");
    expect(result.nextEventStatus).toBe("active");
    expect(result.assistantTurn.question).toBe("如果再往里看一点，这份开心更像满足了你什么？");
    expect(result.assistantTurn.stateUpdate.offerChoice).toBe(false);
  });

  it("falls back to a stage question when the model returns an empty follow-up", async () => {
    findJoyInterviewSessionById.mockResolvedValue(buildSession());
    extractJoySnapshotWithAI.mockResolvedValue({
      ...baseSnapshot,
      selfPattern: "我比以前更主动进入关系了"
    });
    getNextStage.mockReturnValue("probe_pattern");
    buildAssistantQuestion.mockReturnValue("当你开始主动走近别人时，你最明显感受到的变化是什么？");
    generateJoyAssistantTurn.mockResolvedValue({
      insight: "",
      thinkingSummary: "从交到更多朋友这件事里，已经能看到你行动上的变化。",
      analysis: "用户已说：交到更多朋友；下一步问：变化感受",
      question: "",
      stateUpdate: {
        turnPhase: "digging",
        shouldEndDimension: false,
        offerChoice: false,
        choiceReason: ""
      },
      meta: {
        depthReached: ["event", "reason", "clue"]
      }
    } satisfies AssistantTurnPayload);

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "因为我交了更多的朋友了。",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with an assistant turn.");
    }

    expect(result.assistantTurn.question).toBe("当你开始主动走近别人时，你最明显感受到的变化是什么？");
    expect(result.assistantTurn.stateUpdate.offerChoice).toBe(false);
  });

  it("rewrites paraphrase-only thinking summaries into theory-backed summaries", async () => {
    findJoyInterviewSessionById.mockResolvedValue(buildSession());
    extractJoySnapshotWithAI.mockResolvedValue(baseSnapshot);
    getNextStage.mockReturnValue("probe_pattern");
    buildAssistantQuestion.mockReturnValue("如果再往里看一点，这份关系里的连接感最明显落在什么地方？");
    generateJoyAssistantTurn.mockResolvedValue({
      insight: "",
      thinkingSummary: "今天和朋友聊了很久，因为我感觉自己被接住了。",
      analysis: "用户已说：和朋友深聊；下一步问：关系里的连接感",
      question: "如果再往里看一点，这份关系里的连接感最明显落在什么地方？",
      stateUpdate: {
        turnPhase: "digging",
        shouldEndDimension: false,
        offerChoice: false,
        choiceReason: ""
      },
      meta: {
        depthReached: ["event", "reason", "clue"]
      }
    } satisfies AssistantTurnPayload);

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "今天和朋友聊了很久，因为我感觉自己被接住了。",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with an assistant turn.");
    }

    expect(result.assistantTurn.thinkingSummary).not.toBe("今天和朋友聊了很久，因为我感觉自己被接住了。");
    expect(result.assistantTurn.thinkingSummary).toContain("被朋友真正接住的感觉");
    expect(result.assistantTurn.thinkingSummary).toContain("更稳定的在乎");
  });

  it("streams assistant deltas before persisting the finalized turn", async () => {
    findJoyInterviewSessionById.mockResolvedValue(buildSession());
    extractJoySnapshotWithAI.mockResolvedValue(baseSnapshot);
    getNextStage.mockReturnValue("probe_pattern");
    appendJoyInterviewTurn.mockResolvedValue(
      buildSession({
        turnCount: 4,
        stage: "probe_pattern",
        snapshot: baseSnapshot,
        lastAssistantQuestion: "你觉得自己在关系里最在乎什么？"
      })
    );
    streamJoyAssistantTurn.mockImplementation(async (_input, { onDelta }) => {
      await onDelta({
        target: "summary",
        text: "这份开心像是来自连接感。"
      });
      await onDelta({
        target: "question",
        text: "你觉得自己在关系里最在乎什么？"
      });

      return {
        insight: "",
        thinkingSummary: "这份开心像是来自连接感。",
        analysis: "用户已继续补充当前事件；下一步问：推进当前阶段尚未覆盖的层次。",
        question: "你觉得自己在关系里最在乎什么？",
        stateUpdate: {
          turnPhase: "digging",
          shouldEndDimension: false,
          offerChoice: false,
          choiceReason: ""
        },
        meta: {
          depthReached: ["event", "reason", "clue"]
        }
      } satisfies AssistantTurnPayload;
    });

    const phases: string[] = [];
    const deltas: Array<{ target: string; text: string }> = [];
    const result = await streamJoyInterviewResponse(
      {
        userId: "user-1",
        action: "reply",
        sessionId: "session-ready",
        userMessage: "我想记住那种被朋友真正理解的感觉。",
        inputMode: "text"
      },
      {
        onPhase: (phase) => {
          phases.push(phase);
        },
        onDelta: (delta) => {
          deltas.push(delta);
        }
      }
    );

    expect(phases).toEqual(["thinking", "summary", "question"]);
    expect(deltas).toEqual([
      {
        target: "summary",
        text: "这份开心像是来自连接感。"
      },
      {
        target: "question",
        text: "你觉得自己在关系里最在乎什么？"
      }
    ]);
    expect(streamJoyAssistantTurn).toHaveBeenCalled();
    expect(appendJoyInterviewTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        nextTurnCount: 4,
        assistantTurn: expect.objectContaining({
          thinkingSummary: "这份开心像是来自连接感。",
          question: "你觉得自己在关系里最在乎什么？"
        })
      })
    );
    expect(result.assistantMessage).toBe("这份开心像是来自连接感。\n你觉得自己在关系里最在乎什么？");
    expect(result.assistantTurn?.question).toBe("你觉得自己在关系里最在乎什么？");
  });

  it("preserves raw whitespace across streamed question deltas", async () => {
    findJoyInterviewSessionById.mockResolvedValue(buildSession());
    extractJoySnapshotWithAI.mockResolvedValue(baseSnapshot);
    getNextStage.mockReturnValue("probe_pattern");
    appendJoyInterviewTurn.mockResolvedValue(
      buildSession({
        turnCount: 4,
        stage: "probe_pattern",
        snapshot: baseSnapshot,
        lastAssistantQuestion: "What next?"
      })
    );
    streamJoyAssistantTurn.mockImplementation(async (_input, { onDelta }) => {
      await onDelta({
        target: "question",
        text: "What "
      });
      await onDelta({
        target: "question",
        text: "next?"
      });

      return {
        insight: "",
        thinkingSummary: "",
        analysis: "用户已继续补充当前事件；下一步问：推进当前阶段尚未覆盖的层次。",
        question: "What next?",
        stateUpdate: {
          turnPhase: "digging",
          shouldEndDimension: false,
          offerChoice: false,
          choiceReason: ""
        },
        meta: {
          depthReached: ["event", "reason", "clue"]
        }
      } satisfies AssistantTurnPayload;
    });

    const deltas: Array<{ target: string; text: string }> = [];
    await streamJoyInterviewResponse(
      {
        userId: "user-1",
        action: "reply",
        sessionId: "session-ready",
        userMessage: "I want to keep going.",
        inputMode: "text"
      },
      {
        onPhase: () => undefined,
        onDelta: (delta) => {
          deltas.push(delta);
        }
      }
    );

    const questionDeltas = deltas.filter((delta) => delta.target === "question");

    expect(questionDeltas).toEqual([
      {
        target: "question",
        text: "What "
      },
      {
        target: "question",
        text: "next?"
      }
    ]);
    expect(questionDeltas.map((delta) => delta.text).join("")).toBe("What next?");
  });

  it("normalizes invalid streamed thinking summaries before showing them to the user", async () => {
    findJoyInterviewSessionById.mockResolvedValue(buildSession());
    extractJoySnapshotWithAI.mockResolvedValue(baseSnapshot);
    getNextStage.mockReturnValue("probe_pattern");
    appendJoyInterviewTurn.mockResolvedValue(
      buildSession({
        turnCount: 4,
        stage: "probe_pattern",
        snapshot: baseSnapshot,
        lastAssistantQuestion: "你觉得自己在关系里最在乎什么？"
      })
    );
    streamJoyAssistantTurn.mockImplementation(async (_input, { onDelta }) => {
      await onDelta({
        target: "summary",
        text: "你提到和朋友聊了很久，我想知道这段关系里最让你在意的是什么？"
      });
      await onDelta({
        target: "question",
        text: "你觉得自己在关系里最在乎什么？"
      });

      return {
        insight: "",
        thinkingSummary: "你提到和朋友聊了很久，我想知道这段关系里最让你在意的是什么？",
        analysis: "用户已继续补充当前事件；下一步问：推进当前阶段尚未覆盖的层次。",
        question: "你觉得自己在关系里最在乎什么？",
        stateUpdate: {
          turnPhase: "digging",
          shouldEndDimension: false,
          offerChoice: false,
          choiceReason: ""
        },
        meta: {
          depthReached: ["event", "reason", "clue"]
        }
      } satisfies AssistantTurnPayload;
    });

    const deltas: Array<{ target: string; text: string }> = [];
    const result = await streamJoyInterviewResponse(
      {
        userId: "user-1",
        action: "reply",
        sessionId: "session-ready",
        userMessage: "我想记住那种被朋友真正理解的感觉。",
        inputMode: "text"
      },
      {
        onPhase: () => undefined,
        onDelta: (delta) => {
          deltas.push(delta);
        }
      }
    );

    const normalizedSummary = "这份开心的重点，不是表面上的片段，而是“被朋友真正接住的感觉”这种被接住的感觉，再把这份开心沉淀成更稳定的在乎、线索或方向感。";
    const summaryDeltas = deltas.filter((delta) => delta.target === "summary");
    const questionDeltas = deltas.filter((delta) => delta.target === "question");

    expect(summaryDeltas.length).toBeGreaterThan(1);
    expect(summaryDeltas.map((delta) => delta.text).join("")).toBe(normalizedSummary);
    expect(questionDeltas.map((delta) => delta.text).join("")).toBe("你觉得自己在关系里最在乎什么？");
    expect(result.assistantTurn?.thinkingSummary).toBe(normalizedSummary);
    expect(result.assistantMessage).toBe(`${normalizedSummary}\n你觉得自己在关系里最在乎什么？`);
    expect(result.assistantMessage).not.toContain("你提到");
    expect(result.assistantMessage).not.toContain("我想知道");
    expect(result.assistantMessage).not.toContain("？\n");
  });

  it("preserves whitespace when streaming an inactive-session message", async () => {
    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        status: "paused"
      })
    );
    getInactiveSessionMessage.mockReturnValue("foo \n\nbar baz");

    const deltas: Array<{ target: string; text: string }> = [];
    const result = await streamJoyInterviewResponse(
      {
        userId: "user-1",
        action: "reply",
        sessionId: "session-ready",
        userMessage: "继续补充",
        inputMode: "text"
      },
      {
        onPhase: () => undefined,
        onDelta: (delta) => {
          deltas.push(delta);
        }
      }
    );

    expect(deltas.map((delta) => delta.text).join("")).toBe("foo \n\nbar baz");
    expect(result.assistantMessage).toBe("foo \n\nbar baz");
  });

  it("keeps streaming the summary when continuing the current event from a choice card", async () => {
    const choiceSession = buildSession({
      stage: "wrap_up",
      draftGenerationUnlocked: true,
      lastAssistantQuestion: "",
      pendingDecision: {
        kind: "event_complete",
        eventId: "event-1",
        eventSequence: 1,
        actions: ["continue_current_event", "next_event", "generate_draft"]
      },
      events: [
        {
          id: "event-1",
          sequence: 1,
          status: "ready_for_choice",
          stage: "wrap_up",
          explorationRound: 1,
          coveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
          roundCoveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
          roundMeaningfulReplyCount: 3,
          totalMeaningfulReplyCount: 3,
          startMessageSequence: 0,
          snapshot: baseSnapshot,
          draftSummary: null,
          startedAt: "2026-04-21T00:00:00.000Z",
          completedAt: null
        }
      ],
      messages: [
        {
          id: "assistant-choice",
          role: "assistant",
          content: "这段经历为什么重要，已经慢慢清楚起来了。",
          assistantPayload: {
            insight: "这段经历为什么重要，已经慢慢清楚起来了。",
            thinkingSummary: "",
            analysis: "用户已说：关系里的被理解；下一步：由用户决定是否继续",
            question: "",
            stateUpdate: {
              turnPhase: "choice",
              shouldEndDimension: false,
              offerChoice: true,
              choiceReason: "当前信息已经足够，直接让用户决定继续聊还是现在整理。"
            },
            meta: {
              depthReached: ["event", "reason", "clue"]
            }
          },
          sequence: 0,
          createdAt: "2026-04-21T00:00:00.000Z"
        }
      ]
    });
    const continuedPayload: AssistantTurnPayload = {
      insight: "",
      thinkingSummary: "我们已经碰到这段经历里你很在意的那层了，所以我想顺着它继续确认，它真正打动你的地方到底是什么。",
      analysis: "用户刚刚选择继续聊；下一步问：关系在乎点",
      question: "你觉得自己在关系里最在乎什么？",
      stateUpdate: {
        turnPhase: "digging",
        shouldEndDimension: false,
        offerChoice: false,
        choiceReason: ""
      },
      meta: {
        depthReached: ["event", "reason", "clue"]
      }
    };

    findJoyInterviewSessionById.mockResolvedValue(choiceSession);
    resumeCurrentInterviewEvent.mockResolvedValue(
      buildSession({
        stage: "probe_pattern",
        lastAssistantQuestion: "",
        events: [
          {
            id: "event-1",
            sequence: 1,
            status: "active",
            stage: "probe_pattern",
            explorationRound: 2,
            coveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
            roundCoveredLenses: [],
            roundMeaningfulReplyCount: 0,
            totalMeaningfulReplyCount: 3,
            startMessageSequence: 0,
            snapshot: baseSnapshot,
            draftSummary: null,
            startedAt: "2026-04-21T00:00:00.000Z",
            completedAt: null
          }
        ],
        pendingDecision: null
      })
    );
    appendJoyInterviewTurn.mockResolvedValue(
      buildSession({
        stage: "probe_pattern",
        turnCount: 3,
        lastAssistantQuestion: continuedPayload.question
      })
    );
    streamJoyAssistantTurn.mockImplementation(async (_input, { onDelta }) => {
      await onDelta({
        target: "summary",
        text: continuedPayload.thinkingSummary
      });
      await onDelta({
        target: "question",
        text: continuedPayload.question
      });
      return continuedPayload;
    });

    const phases: string[] = [];
    const deltas: Array<{ target: string; text: string }> = [];
    const result = await streamJoyInterviewResponse(
      {
        userId: "user-1",
        action: "continue_current_event",
        sessionId: "session-ready"
      },
      {
        onPhase: (phase) => {
          phases.push(phase);
        },
        onDelta: (delta) => {
          deltas.push(delta);
        }
      }
    );

    expect(phases).toEqual(["thinking", "summary", "question"]);
    const normalizedContinuedSummary =
      "这份开心的重点，不是表面上的片段，而是“被朋友真正接住的感觉”这种被接住的感觉，顺着这份开心真正有分量的地方，继续说清。";
    const continuedSummaryDeltas = deltas.filter((delta) => delta.target === "summary");
    const continuedQuestionDeltas = deltas.filter((delta) => delta.target === "question");

    expect(continuedSummaryDeltas.length).toBeGreaterThan(1);
    expect(continuedSummaryDeltas.map((delta) => delta.text).join("")).toBe(normalizedContinuedSummary);
    expect(continuedQuestionDeltas.map((delta) => delta.text).join("")).toBe(continuedPayload.question);
    expect(result.assistantMessage).toBe(`${normalizedContinuedSummary}\n你觉得自己在关系里最在乎什么？`);
    expect(result.assistantTurn?.thinkingSummary).toBe(normalizedContinuedSummary);
    expect(result.assistantTurn?.insight).toBe("");
    expect(result.assistantTurn?.question).toBe(continuedPayload.question);
  });

  it("does not stream a repeated reflection scene question after continue_current_event", async () => {
    const reflectionSnapshot: JoySnapshot = {
      event: "面临毕业-就业节点的选择",
      feeling: null,
      whyItMattered: "意识到‘看起来合适’是基于外部视角的评判，而‘真正想要的生活’需要基于亲身经历的内部视角来判断",
      happinessType: "判断校准型",
      selfPattern: "过去在所有事情上都依赖外部标准",
      confidence: 0.78,
      missingSlots: ["stateShiftOrMeaningNeed"]
    };
    const repeatedQuestion = "今天有什么具体的经历或对话，让你第一次清晰地感受到这种“局外人”和“局内人”视角的差异？";
    const fallbackQuestion =
      "如果不是某段具体对话，那在“面临毕业-就业节点的选择”这件事里，哪一个具体顾虑、画面或念头，最先让你意识到不能只看“看起来合适”？";
    const choiceSession = buildSession({
      dimension: "reflection",
      stage: "wrap_up",
      draftGenerationUnlocked: true,
      lastAssistantQuestion: "",
      snapshot: reflectionSnapshot,
      pendingDecision: {
        kind: "event_complete",
        eventId: "event-1",
        eventSequence: 1,
        actions: ["continue_current_event", "next_event", "generate_draft"]
      },
      events: [
        {
          id: "event-1",
          sequence: 1,
          status: "ready_for_choice",
          stage: "wrap_up",
          explorationRound: 1,
          coveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
          roundCoveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
          roundMeaningfulReplyCount: 6,
          totalMeaningfulReplyCount: 6,
          startMessageSequence: 0,
          snapshot: reflectionSnapshot,
          draftSummary: null,
          startedAt: "2026-05-04T06:43:00.000Z",
          completedAt: null
        }
      ],
      messages: [
        {
          id: "assistant-scene",
          role: "assistant",
          content: JSON.stringify({
            insight: "",
            thinkingSummary: "这次思考的核心，是区分了“看起来合适”的外部评判和“真正想要”的内部体验，这正在成为你判断未来方向的新依据。",
            analysis: "用户已继续补充当前事件；下一步问：推进当前阶段尚未覆盖的层次。",
            question: repeatedQuestion,
            stateUpdate: {
              turnPhase: "digging",
              shouldEndDimension: false,
              offerChoice: false,
              choiceKind: null,
              choiceReason: ""
            },
            meta: {
              depthReached: ["event", "reason"]
            }
          } satisfies AssistantTurnPayload),
          assistantPayload: {
            insight: "",
            thinkingSummary: "这次思考的核心，是区分了“看起来合适”的外部评判和“真正想要”的内部体验，这正在成为你判断未来方向的新依据。",
            analysis: "用户已继续补充当前事件；下一步问：推进当前阶段尚未覆盖的层次。",
            question: repeatedQuestion,
            stateUpdate: {
              turnPhase: "digging",
              shouldEndDimension: false,
              offerChoice: false,
              choiceKind: null,
              choiceReason: ""
            },
            meta: {
              depthReached: ["event", "reason"]
            }
          },
          sequence: 0,
          createdAt: "2026-05-04T06:46:14.409Z"
        },
        {
          id: "user-scene-denial",
          role: "user",
          content: "没有，是我今天自发的思考，因为我要选择就业方向了",
          sequence: 1,
          createdAt: "2026-05-04T06:46:51.436Z"
        },
        {
          id: "assistant-choice",
          role: "assistant",
          content: JSON.stringify({
            insight: "这一段已经聊到以后判断类似事情时可以带着的一条线索了，已经够写成一版日志。",
            thinkingSummary: "",
            analysis: "当前事件已形成可信的思考日志线索，下一步交给用户决定：继续深挖、切到下一件事，或直接生成日志。",
            question: "",
            stateUpdate: {
              turnPhase: "choice",
              shouldEndDimension: false,
              offerChoice: true,
              choiceKind: "event_complete",
              choiceReason: "当前事件已经形成一条可信的思考日志线索，交给用户决定下一步。"
            },
            meta: {
              depthReached: ["event", "reason", "pattern"]
            }
          } satisfies AssistantTurnPayload),
          assistantPayload: {
            insight: "这一段已经聊到以后判断类似事情时可以带着的一条线索了，已经够写成一版日志。",
            thinkingSummary: "",
            analysis: "当前事件已形成可信的思考日志线索，下一步交给用户决定：继续深挖、切到下一件事，或直接生成日志。",
            question: "",
            stateUpdate: {
              turnPhase: "choice",
              shouldEndDimension: false,
              offerChoice: true,
              choiceKind: "event_complete",
              choiceReason: "当前事件已经形成一条可信的思考日志线索，交给用户决定下一步。"
            },
            meta: {
              depthReached: ["event", "reason", "pattern"]
            }
          },
          sequence: 2,
          createdAt: "2026-05-04T06:47:42.826Z"
        }
      ]
    });

    findJoyInterviewSessionById.mockResolvedValue(choiceSession);
    resumeCurrentInterviewEvent.mockResolvedValue(
      buildSession({
        dimension: "reflection",
        stage: "probe_pattern",
        lastAssistantQuestion: "",
        snapshot: reflectionSnapshot,
        events: [
          {
            id: "event-1",
            sequence: 1,
            status: "active",
            stage: "probe_pattern",
            explorationRound: 2,
            coveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
            roundCoveredLenses: [],
            roundMeaningfulReplyCount: 0,
            totalMeaningfulReplyCount: 6,
            startMessageSequence: 0,
            snapshot: reflectionSnapshot,
            draftSummary: null,
            startedAt: "2026-05-04T06:43:00.000Z",
            completedAt: null
          }
        ],
        pendingDecision: null,
        messages: choiceSession.messages
      })
    );
    appendJoyInterviewTurn.mockResolvedValue(
      buildSession({
        dimension: "reflection",
        stage: "probe_pattern",
        turnCount: 6,
        lastAssistantQuestion: fallbackQuestion,
        snapshot: reflectionSnapshot
      })
    );
    streamJoyAssistantTurn.mockImplementation(async (_input, { onDelta }) => {
      await onDelta({
        target: "summary",
        text: "这次思考的核心，是区分了“看起来合适”的外部评判和“真正想要”的内部体验，这正在成为你判断未来方向的新依据。"
      });
      await onDelta({
        target: "question",
        text: repeatedQuestion
      });
      return {
        insight: "",
        thinkingSummary: "这次思考的核心，是区分了“看起来合适”的外部评判和“真正想要”的内部体验，这正在成为你判断未来方向的新依据。",
        analysis: "用户刚刚选择继续深挖当前事件；下一步问：换一个角度继续追问。",
        question: repeatedQuestion,
        stateUpdate: {
          turnPhase: "digging",
          shouldEndDimension: false,
          offerChoice: false,
          choiceReason: ""
        },
        meta: {
          depthReached: ["event", "reason", "pattern"]
        }
      } satisfies AssistantTurnPayload;
    });

    const deltas: Array<{ target: string; text: string }> = [];
    const result = await streamJoyInterviewResponse(
      {
        userId: "user-1",
        action: "continue_current_event",
        sessionId: "session-ready"
      },
      {
        onPhase: () => undefined,
        onDelta: (delta) => {
          deltas.push(delta);
        }
      }
    );

    const streamedQuestion = deltas.filter((delta) => delta.target === "question").map((delta) => delta.text).join("");

    expect(streamedQuestion).toBe(fallbackQuestion);
    expect(streamedQuestion).not.toContain("具体的经历或对话");
    expect(result.assistantTurn?.question).toBe(fallbackQuestion);
  });

  it.each([
    {
      dimension: "joy" as const,
      snapshot: baseSnapshot,
      expectedSnippet: "被接住的感觉"
    },
    {
      dimension: "fulfillment" as const,
      snapshot: {
        ...baseSnapshot,
        event: "今天把拖了很久的方案收口了",
        joyMoment: "今天把拖了很久的方案收口了",
        whyItMattered: "卡住的部分终于推进完",
        joySource: "卡住的部分终于推进完",
        selfPattern: "把困难处真正收口才算数",
        manualClue: "把困难处真正收口才算数",
        feeling: "踏实",
        stateShift: "踏实"
      },
      expectedSnippet: "为什么对你算数"
    },
    {
      dimension: "reflection" as const,
      snapshot: {
        ...baseSnapshot,
        event: "今天会议里我突然发现自己一直怕提不同意见",
        whyItMattered: "不同意见不一定会破坏关系",
        selfPattern: "以后判断表达风险时要看对方是否在讨论事实"
      },
      expectedSnippet: "判断线索"
    },
    {
      dimension: "improvement" as const,
      snapshot: {
        ...baseSnapshot,
        event: "今天开会时我急着插话",
        selfPattern: null,
        manualClue: null,
        situation: "今天开会时我急着插话",
        improvementTrack: "avoid_bad" as const,
        frictionPoint: "还没听完就急着回应",
        controllableFactor: "先停一拍确认对方说完"
      },
      expectedSnippet: "可调整的小处"
    },
    {
      dimension: "gratitude" as const,
      snapshot: {
        ...baseSnapshot,
        event: "今天同事帮我理清优先级",
        gratitudeMoment: "今天同事帮我理清优先级",
        kindAction: "帮我先拆出最急的两件事",
        seenNeed: "我当时快被任务压住了",
        gratitudeReason: "我觉得不是一个人在扛",
        relationshipSignal: "先看见处境再帮忙"
      },
      expectedSnippet: "关系线索"
    }
  ])("normalizes and streams thinking summaries with %s dimension semantics", async ({ dimension, snapshot, expectedSnippet }) => {
    const session = buildSession({
      dimension,
      snapshot,
      events: [
        {
          ...buildSession().events[0],
          stage: "probe_pattern",
          snapshot
        }
      ]
    });

    findJoyInterviewSessionById.mockResolvedValue(session);
    extractJoySnapshotWithAI.mockResolvedValue(snapshot);
    getNextStage.mockReturnValue("probe_pattern");
    appendJoyInterviewTurn.mockResolvedValue(
      buildSession({
        dimension,
        snapshot,
        stage: "probe_pattern",
        lastAssistantQuestion: "这里最关键的那一层是什么？",
        events: [
          {
            ...buildSession().events[0],
            stage: "probe_pattern",
            snapshot
          }
        ]
      })
    );
    streamJoyAssistantTurn.mockImplementation(async (_input, { onDelta }) => {
      await onDelta({
        target: "summary",
        text: "你提到这件事，我想知道下一步要问哪里？"
      });
      await onDelta({
        target: "question",
        text: "这里最关键的那一层是什么？"
      });

      return {
        insight: "",
        thinkingSummary: "你提到这件事，我想知道下一步要问哪里？",
        analysis: "测试用非法思路层",
        question: "这里最关键的那一层是什么？",
        stateUpdate: {
          turnPhase: "digging",
          shouldEndDimension: false,
          offerChoice: false,
          choiceReason: ""
        },
        meta: {
          depthReached: ["event", "reason", "clue"]
        }
      } satisfies AssistantTurnPayload;
    });

    const deltas: Array<{ target: string; text: string }> = [];
    const result = await streamJoyInterviewResponse(
      {
        userId: "user-1",
        action: "reply",
        sessionId: "session-ready",
        userMessage: "我补充一点。",
        inputMode: "text"
      },
      {
        onPhase: () => undefined,
        onDelta: (delta) => {
          deltas.push(delta);
        }
      }
    );

    const streamedSummary = deltas
      .filter((delta) => delta.target === "summary")
      .map((delta) => delta.text)
      .join("");

    expect(deltas.filter((delta) => delta.target === "summary").length).toBeGreaterThan(1);
    expect(streamedSummary).toBe(result.assistantTurn?.thinkingSummary);
    expect(streamedSummary).toContain(expectedSnippet);
    expect(streamedSummary).not.toMatch(/你提到|我想知道|下一步|[?？]/u);
  });
});
