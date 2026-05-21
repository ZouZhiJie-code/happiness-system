import { describe, expect, it, vi, beforeEach } from "vitest";

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

const { mockRecordAnalyticsEvent } = vi.hoisted(() => ({
  mockRecordAnalyticsEvent: vi.fn()
}));

const { extractJoySnapshotWithAI, generateJoyAssistantTurn, streamJoyAssistantTurn, generateJoyDraftWithAI } = vi.hoisted(() => ({
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
  hasJoyStableClosure: (snapshot: JoySnapshot) => Boolean(snapshot.delightSignature ?? snapshot.manualClue ?? snapshot.selfPattern),
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
  resumeCurrentInterviewEvent,
  saveJoyInterviewDraft,
  startNextInterviewEvent
}));

vi.mock("@/server/repositories/admin-analytics.repository", () => ({
  recordAnalyticsEvent: mockRecordAnalyticsEvent
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
  prepareJoyInterviewResponse,
  streamJoyInterviewResponse
} from "@/server/services/interview/joy-interview.service";

const reflectionSnapshot: JoySnapshot = {
  event: "今天看完一个项目复盘",
  feeling: "警醒",
  whyItMattered: "我意识到自己以前太容易把忙碌当成进展",
  happinessType: "判断校准型",
  selfPattern: null,
  confidence: 0.74,
  missingSlots: ["viewpointShift"]
};

function buildSession(overrides: Partial<InterviewSessionRecord> = {}): InterviewSessionRecord {
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

describe("repair protocol response flow", () => {
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
    retrieveRelevantMemories.mockReset();
    buildAssistantQuestion.mockReset();
    getInactiveSessionMessage.mockReset();
    getNextStage.mockReset();
    getOpeningQuestion.mockReset();
    retrieveRelevantMemories.mockResolvedValue({
      memories: [],
      formattedContext: null
    });
  });

  it("returns a deterministic repair turn without calling AI generation", async () => {
    findJoyInterviewSessionById.mockResolvedValue(buildSession());

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "这个问题看不懂，换一个",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected active response with assistant turn.");
    }

    expect(generateJoyAssistantTurn).not.toHaveBeenCalled();
    expect(streamJoyAssistantTurn).not.toHaveBeenCalled();
    expect(extractJoySnapshotWithAI).not.toHaveBeenCalled();
    expect(result.nextTurnCount).toBe(2);
    expect(result.nextEventTurnCount).toBe(2);
    expect(result.roundMeaningfulReplyCount).toBe(0);
    expect(result.nextProgressData).toBeNull();
    expect(result.assistantTurn.question).toBe(
      "以后再遇到类似情况，你会先看哪个更具体的反应或信号，提醒自己别只看“看起来合适”？"
    );
    expect(result.assistantTurn.questionSpec).toEqual({
      target: "judgment_clue",
      stageIntent: "repair",
      surfaceLevel: "concrete_anchor",
      anchorText: "今天看完一个项目复盘",
      repairCount: 1
    });
  });

  it("sends deterministic summary/question chunks in stream repair mode without model streaming", async () => {
    findJoyInterviewSessionById.mockResolvedValue(buildSession());
    appendJoyInterviewTurn.mockResolvedValue(
      buildSession({
        lastAssistantQuestion: "以后再遇到类似情况，你会先看哪个更具体的反应或信号，提醒自己别只看“看起来合适”？"
      })
    );

    const phases: string[] = [];
    const deltas: Array<{ target: string; text: string }> = [];

    const result = await streamJoyInterviewResponse(
      {
        userId: "user-1",
        action: "reply",
        sessionId: "session-ready",
        userMessage: "太抽象了，说简单点",
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

    expect(streamJoyAssistantTurn).not.toHaveBeenCalled();
    expect(generateJoyAssistantTurn).not.toHaveBeenCalled();
    expect(phases).toEqual(["summary", "question"]);
    expect(deltas.some((delta) => delta.target === "summary")).toBe(true);
    expect(deltas.filter((delta) => delta.target === "question").map((delta) => delta.text).join("")).toBe(
      "以后再遇到类似情况，你会先看哪个更具体的反应或信号，提醒自己别只看“看起来合适”？"
    );
    expect(result.assistantTurn?.questionSpec?.repairCount).toBe(1);
  });

  it("escalates the third repair into a low-pressure choice", async () => {
    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        messages: [
          {
            id: "assistant-1",
            role: "assistant",
            content: "以后再遇到类似情况，你会先看哪个更具体的反应或信号，提醒自己别只看“看起来合适”？",
            assistantPayload: {
              insight: "",
              thinkingSummary: "我把问题再往具体一点收。",
              analysis: "repair 2",
              question: "以后再遇到类似情况，你会先看哪个更具体的反应或信号，提醒自己别只看“看起来合适”？",
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
                depthReached: ["event", "reason"]
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
      userMessage: "还是太抽象，换一个",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected active response with assistant turn.");
    }

    expect(generateJoyAssistantTurn).not.toHaveBeenCalled();
    expect(result.nextEventStatus).toBe("ready_for_choice");
    expect(result.nextProgressData).toEqual({
      kind: "boundary_insufficient",
      reason: "我先不继续换问法了。你可以只补一句关键内容，也可以换个片段，或者先整理当前版本。"
    });
    expect(result.assistantTurn.stateUpdate.choiceKind).toBe("boundary_insufficient");
    expect(result.assistantTurn.stateUpdate.offerChoice).toBe(true);
  });
});
