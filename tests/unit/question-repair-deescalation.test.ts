import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InterviewSessionRecord, JoySnapshot } from "@/types/interview";

const {
  appendJoyInterviewTurn,
  completeJoyInterviewSessionRecord,
  createJoyInterviewSession,
  findJoyInterviewSessionById,
  markJoyEntrySaved,
  pauseJoyInterviewSessionRecord,
  reopenJoyInterviewSessionRecord,
  reserveInterviewUserTurn,
  resumeInterviewUserTurn,
  markInterviewUserTurnFailed,
  cancelInterviewUserTurn,
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
  reserveInterviewUserTurn: vi.fn(),
  resumeInterviewUserTurn: vi.fn(),
  markInterviewUserTurnFailed: vi.fn(),
  cancelInterviewUserTurn: vi.fn(),
  resumeCurrentInterviewEvent: vi.fn(),
  saveJoyInterviewDraft: vi.fn(),
  startNextInterviewEvent: vi.fn()
}));

const { mockRecordAnalyticsEvent } = vi.hoisted(() => ({
  mockRecordAnalyticsEvent: vi.fn()
}));

const { createAIGenerationTrace, appendGenerationTraceDecision, cancelGenerationTrace, failGenerationTrace } =
  vi.hoisted(() => ({
    createAIGenerationTrace: vi.fn(),
    appendGenerationTraceDecision: vi.fn(),
    cancelGenerationTrace: vi.fn(),
    failGenerationTrace: vi.fn()
  }));

const { extractJoySnapshotWithAI, generateJoyAssistantTurn, streamJoyAssistantTurn, generateJoyDraftWithAI } =
  vi.hoisted(() => ({
    extractJoySnapshotWithAI: vi.fn(),
    generateJoyAssistantTurn: vi.fn(),
    streamJoyAssistantTurn: vi.fn(),
    generateJoyDraftWithAI: vi.fn()
  }));

const { retrieveRelevantMemories } = vi.hoisted(() => ({
  retrieveRelevantMemories: vi.fn()
}));

const {
  buildAssistantQuestion,
  hasCredibleFulfillmentProgressEvidence,
  hasCredibleFulfillmentValueSignal,
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
  getManualClue,
  resolveFulfillmentQuestionTarget
} = vi.hoisted(() => ({
  buildAssistantQuestion: vi.fn(),
  hasCredibleFulfillmentProgressEvidence: (snapshot: JoySnapshot, recentUserMessage?: string | null) =>
    Boolean(snapshot.whyItMattered || recentUserMessage?.match(/推进|完成|积累|帮到|达成|前进|收口/u)),
  hasCredibleFulfillmentValueSignal: (snapshot: JoySnapshot, recentUserMessage?: string | null) =>
    Boolean(snapshot.selfPattern || recentUserMessage?.match(/对我来说|什么样的努力|力气花得值|算数/u)),
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
  hasJoyStableClosure: (snapshot: JoySnapshot) =>
    Boolean(snapshot.delightSignature ?? snapshot.manualClue ?? snapshot.selfPattern),
  getStateShift: (snapshot: JoySnapshot) => snapshot.stateShift ?? snapshot.feeling ?? null,
  getValueImpact: (snapshot: JoySnapshot) => snapshot.valueImpact ?? null,
  getMeaningNeed: (snapshot: JoySnapshot) => snapshot.meaningNeed ?? null,
  getManualClue: (snapshot: JoySnapshot) => snapshot.manualClue ?? snapshot.selfPattern ?? null,
  resolveFulfillmentQuestionTarget: (input: { snapshot: JoySnapshot; recentUserMessage?: string | null }) => {
    if (!input.snapshot.event) return "event_detail";
    if (!(input.snapshot.whyItMattered || input.recentUserMessage?.match(/推进|完成|积累|帮到|达成|前进|收口/u))) {
      return "progress_evidence";
    }
    if (!(input.snapshot.selfPattern || input.recentUserMessage?.match(/对我来说|什么样的努力|力气花得值|算数/u))) {
      return "value_signal";
    }
    return null;
  }
}));

vi.mock("@/server/repositories/joy-interview.repository", () => ({
  appendJoyInterviewTurn,
  completeJoyInterviewSessionRecord,
  createJoyInterviewSession,
  findJoyInterviewSessionById,
  markJoyEntrySaved,
  pauseJoyInterviewSessionRecord,
  reopenJoyInterviewSessionRecord,
  reserveInterviewUserTurn,
  resumeInterviewUserTurn,
  markInterviewUserTurnFailed,
  cancelInterviewUserTurn,
  resumeCurrentInterviewEvent,
  saveJoyInterviewDraft,
  startNextInterviewEvent
}));

vi.mock("@/server/repositories/admin-analytics.repository", () => ({
  recordAnalyticsEvent: mockRecordAnalyticsEvent
}));

vi.mock("@/server/repositories/ai-quality.repository", () => ({
  createAIGenerationTrace,
  appendGenerationTraceDecision,
  cancelGenerationTrace,
  failGenerationTrace
}));

vi.mock("@/server/services/interview/joy-interview-ai.service", () => ({
  extractJoySnapshotWithAI,
  generateJoyAssistantTurn,
  streamJoyAssistantTurn,
  generateJoyDraftWithAI
}));

vi.mock("@/server/services/memory/memory-retrieval.service", () => ({
  retrieveRelevantMemories
}));

vi.mock("@/features/joy-interview/server/joy-interview-engine", () => ({
  buildAssistantQuestion,
  hasCredibleFulfillmentProgressEvidence,
  hasCredibleFulfillmentValueSignal,
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
  getManualClue,
  resolveFulfillmentQuestionTarget
}));

import {
  renderDeterministicRepairTurn
} from "@/features/joy-interview/server/question-protocol";
import { prepareJoyInterviewResponse } from "@/server/services/interview/joy-interview.service";

const reflectionSnapshot: JoySnapshot = {
  event: "今天看完一个项目复盘",
  feeling: "警醒",
  whyItMattered: "我意识到自己以前太容易把忙碌当成进展",
  happinessType: "判断校准型",
  selfPattern: null,
  confidence: 0.74,
  missingSlots: ["viewpointShift"]
};

const fulfillmentSnapshot: JoySnapshot = {
  event: "回顾过去问问大象的经历",
  feeling: "充实",
  whyItMattered: "我重新梳理之后，看见以前的积累没有白费",
  happinessType: "投入积累型",
  selfPattern: "记录下来，后面复盘时才能看到新的东西",
  confidence: 0.8,
  missingSlots: []
};

function buildReflectionSession(overrides: Partial<InterviewSessionRecord> = {}): InterviewSessionRecord {
  return {
    userId: "user-1",
    id: "session-ready",
    dimension: "reflection",
    status: "active",
    stage: "probe_pattern",
    activeEventId: "event-1",
    draftGenerationUnlocked: false,
    turnCount: 2,
    lastAssistantQuestion: "你现在多了一条什么判断依据？",
    draftSummary: null,
    messages: [
      {
        id: "assistant-1",
        role: "assistant",
        content: "你现在多了一条什么判断依据？",
        assistantPayload: {
          insight: "",
          thinkingSummary: "这次思考已经开始碰到你判断进展的方式了。",
          analysis: "用户已说：忙碌不等于进展；下一步问：判断依据",
          question: "你现在多了一条什么判断依据？",
          questionSpec: {
            target: "judgment_clue",
            stageIntent: "advance",
            surfaceLevel: "default",
            anchorText: "今天看完一个项目复盘",
            repairCount: 0
          },
          stateUpdate: {
            turnPhase: "digging",
            shouldEndDimension: false,
            offerChoice: false,
            choiceReason: ""
          },
          meta: {
            depthReached: ["event", "reason"]
          }
        },
        sequence: 0,
        createdAt: "2026-05-21T00:00:00.000Z"
      }
    ],
    snapshot: reflectionSnapshot,
    events: [
      {
        id: "event-1",
        sequence: 1,
        status: "active",
        stage: "probe_pattern",
        explorationRound: 2,
        coveredLenses: ["event_detail", "importance_reason"],
        roundCoveredLenses: [],
        roundMeaningfulReplyCount: 0,
        totalMeaningfulReplyCount: 2,
        startMessageSequence: 0,
        snapshot: reflectionSnapshot,
        draftSummary: null,
        startedAt: "2026-05-21T00:00:00.000Z",
        completedAt: null
      }
    ],
    pendingDecision: null,
    startedAt: "2026-05-21T00:00:00.000Z",
    entryDate: "2026-05-21",
    pausedAt: null,
    completedAt: null,
    journalEntry: null,
    ...overrides
  };
}

describe("question repair de-escalation", () => {
  beforeEach(() => {
    createAIGenerationTrace.mockReset();
    appendGenerationTraceDecision.mockReset();
    cancelGenerationTrace.mockReset();
    failGenerationTrace.mockReset();
    createAIGenerationTrace.mockResolvedValue({ id: "trace-1" });
    appendGenerationTraceDecision.mockResolvedValue(undefined);
    cancelGenerationTrace.mockResolvedValue(undefined);
    failGenerationTrace.mockResolvedValue(undefined);
    appendJoyInterviewTurn.mockReset();
    completeJoyInterviewSessionRecord.mockReset();
    createJoyInterviewSession.mockReset();
    findJoyInterviewSessionById.mockReset();
    markJoyEntrySaved.mockReset();
    pauseJoyInterviewSessionRecord.mockReset();
    reopenJoyInterviewSessionRecord.mockReset();
    reserveInterviewUserTurn.mockReset();
    resumeInterviewUserTurn.mockReset();
    markInterviewUserTurnFailed.mockReset();
    cancelInterviewUserTurn.mockReset();
    resumeCurrentInterviewEvent.mockReset();
    saveJoyInterviewDraft.mockReset();
    startNextInterviewEvent.mockReset();
    extractJoySnapshotWithAI.mockReset();
    generateJoyAssistantTurn.mockReset();
    streamJoyAssistantTurn.mockReset();
    generateJoyDraftWithAI.mockReset();
    retrieveRelevantMemories.mockReset();
    buildAssistantQuestion.mockReset();
    getInactiveSessionMessage.mockReset();
    getNextStage.mockReset();
    getOpeningQuestion.mockReset();
    retrieveRelevantMemories.mockResolvedValue({
      memories: [],
      formattedContext: null
    });
    reserveInterviewUserTurn.mockImplementation(
      async (input: {
        sessionId: string;
        clientTurnId: string;
        activeEventId: string | null;
        action: "reply" | "continue_current_event" | "next_event";
        rawText: string | null;
        inputMode?: "text" | "voice";
        baseMessageSequence?: number;
      }) => {
        const session = await findJoyInterviewSessionById(input.sessionId);
        const baseMessageSequence =
          input.baseMessageSequence ??
          Math.max(-1, ...session.messages.map((message: { sequence: number }) => message.sequence));

        return {
          kind: "reserved",
          turn: {
            id: "turn-test",
            clientTurnId: input.clientTurnId,
            sessionId: input.sessionId,
            activeEventId: input.activeEventId,
            action: input.action,
            rawText: input.rawText,
            inputMode: input.inputMode,
            baseMessageSequence,
            status: "processing",
            attemptCount: 1,
            errorCode: null,
            createdAt: "2026-05-21T00:00:00.000Z",
            updatedAt: "2026-05-21T00:00:00.000Z",
            completedAt: null
          },
          userMessageId: input.action === "reply" ? "user-turn-message" : null,
          session
        };
      }
    );
  });

  it("uses narrow strategy on the first repair", async () => {
    findJoyInterviewSessionById.mockResolvedValue(buildReflectionSession());

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "这个问题看不懂，说简单点",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected active response with assistant turn.");
    }

    expect(result.assistantTurn.question).toBe(
      "你提到“今天看完一个项目复盘”。这次经历让你修正了原来的哪个判断？"
    );
    expect(result.assistantTurn.questionSpec).toEqual({
      target: "judgment_clue",
      stageIntent: "repair",
      surfaceLevel: "simplified",
      anchorText: "今天看完一个项目复盘",
      repairCount: 1
    });
    expect(generateJoyAssistantTurn).not.toHaveBeenCalled();
  });

  it("uses example-first strategy on the second repair", async () => {
    findJoyInterviewSessionById.mockResolvedValue(
      buildReflectionSession({
        messages: [
          {
            id: "assistant-1",
            role: "assistant",
            content: "回到“今天看完一个项目复盘”这件事，你现在最想指出的关键一点是什么？",
            assistantPayload: {
              insight: "",
              thinkingSummary: "我先把问题收窄成一个更容易回答的点。",
              analysis: "repair 1",
              question: "回到“今天看完一个项目复盘”这件事，你现在最想指出的关键一点是什么？",
              questionSpec: {
                target: "judgment_clue",
                stageIntent: "repair",
                surfaceLevel: "simplified",
                anchorText: "今天看完一个项目复盘",
                repairCount: 1
              },
              stateUpdate: {
                turnPhase: "digging",
                shouldEndDimension: false,
                offerChoice: false,
                choiceReason: ""
              },
              meta: {
                depthReached: []
              }
            },
            sequence: 0,
            createdAt: "2026-05-21T00:01:00.000Z"
          }
        ]
      })
    );

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "还是不懂，换个问法",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected active response with assistant turn.");
    }

    expect(result.assistantTurn.question).toBe(
      "你提到“今天看完一个项目复盘”。不用先总结，只说一个最具体的例子，会是哪一下？"
    );
    expect(result.assistantTurn.questionSpec).toEqual({
      target: "judgment_clue",
      stageIntent: "repair",
      surfaceLevel: "concrete_anchor",
      anchorText: "今天看完一个项目复盘",
      repairCount: 2
    });
  });

  it("falls back to one sentence when narrow repair would repeat the same question", () => {
    const turn = renderDeterministicRepairTurn({
      dimension: "fulfillment",
      stage: "probe_pattern",
      snapshot: fulfillmentSnapshot,
      spec: {
        target: "judgment_clue",
        stageIntent: "repair",
        surfaceLevel: "simplified",
        anchorText: "回顾过去问问大象的经历",
        repairCount: 1
      },
      previousQuestion: "回到“回顾过去问问大象的经历”这件事，最让你觉得今天没白过的那一点是什么？",
      hadReflectionSceneDenial: false
    });

    expect(turn.question).toBe(
      "“回顾过去问问大象的经历”里，什么样的具体结果会让这份投入对你算数？"
    );
    expect(turn.questionSpec?.surfaceLevel).toBe("simplified");
  });

  it("escalates the third repair into a low-pressure choice", async () => {
    findJoyInterviewSessionById.mockResolvedValue(
      buildReflectionSession({
        messages: [
          {
            id: "assistant-1",
            role: "assistant",
            content: "回到“今天看完一个项目复盘”这件事，不用先总结，只说一个最具体的例子，会是哪一下？",
            assistantPayload: {
              insight: "",
              thinkingSummary: "我先不让你总结，只要举一个最具体的例子。",
              analysis: "repair 2",
              question: "回到“今天看完一个项目复盘”这件事，不用先总结，只说一个最具体的例子，会是哪一下？",
              questionSpec: {
                target: "judgment_clue",
                stageIntent: "repair",
                surfaceLevel: "concrete_anchor",
                anchorText: "今天看完一个项目复盘",
                repairCount: 2
              },
              stateUpdate: {
                turnPhase: "digging",
                shouldEndDimension: false,
                offerChoice: false,
                choiceReason: ""
              },
              meta: {
                depthReached: []
              }
            },
            sequence: 0,
            createdAt: "2026-05-21T00:02:00.000Z"
          }
        ]
      })
    );

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "还是太绕了，换一个",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected active response with assistant turn.");
    }

    expect(result.nextEventStatus).toBe("ready_for_choice");
    expect(result.nextProgressData).toEqual({
      kind: "boundary_insufficient",
      reason: "我先不继续换问法了。你可以只补一句关键内容，也可以换个片段，或者先整理当前版本。"
    });
    expect(result.assistantTurn.stateUpdate.choiceKind).toBe("boundary_insufficient");
    expect(result.assistantTurn.stateUpdate.offerChoice).toBe(true);
  });
});
