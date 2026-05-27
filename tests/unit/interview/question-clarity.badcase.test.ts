import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyQuestionSurfaceProtocol, createQuestionSpec, renderDeterministicRepairTurn } from "@/features/joy-interview/server/question-protocol";
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

import { prepareJoyInterviewResponse } from "@/server/services/interview/joy-interview.service";

const joySnapshot: JoySnapshot = {
  event: "收到扎根工程的赠礼，感觉这段学习真的开始了",
  feeling: "心很空旷，身体很松弛",
  whyItMattered: "它让我觉得这不是随便开始，而是被认真确认的一段学习",
  happinessType: "意义型开心",
  selfPattern: null,
  joyMoment: "收到扎根工程的赠礼",
  joySource: "礼物里的仪式感和被看见的确认感",
  stateShift: "从平常的紧绷变得空旷松弛",
  meaningNeed: "我在乎自己的开始被认真对待",
  manualClue: null,
  confidence: 0.82,
  missingSlots: []
};

const fulfillmentSnapshot: JoySnapshot = {
  event: "回顾过去问问大象的经历，重新梳理了自己的成长",
  feeling: "充实",
  whyItMattered: "我看见自己以前的积累没有白费，而且复盘后还能学到新东西",
  happinessType: "投入积累型",
  selfPattern: "把工作记录下来，后面复盘时才能看到新的东西",
  confidence: 0.8,
  missingSlots: []
};

const reflectionSnapshot: JoySnapshot = {
  event: "晚上总想刷视频逃避一下",
  feeling: "焦虑又畏难",
  whyItMattered: "我发现自己更像是在躲开主动思考下一步",
  happinessType: "判断校准型",
  selfPattern: null,
  confidence: 0.74,
  missingSlots: ["viewpointShift"]
};

const improvementSnapshot: JoySnapshot = {
  event: "早上吃完早餐回来之后就没有干什么事，也不知道怎么准备进一步优化面试",
  feeling: "无聊，没什么意思，没有兴奋感",
  whyItMattered: "我发现自己一没兴奋感就容易散掉",
  happinessType: null,
  selfPattern: null,
  frictionPoint: "早餐后不知道怎么准备进一步优化面试",
  repeatCondition: "早餐后没有明确起手动作时就容易空掉",
  confidence: 0.71,
  missingSlots: ["nextAttempt"]
};

const gratitudeSnapshot: JoySnapshot = {
  event: "邹邹中午陪我一起回来，还给了面试建议",
  feeling: "被接住了",
  whyItMattered: "有人真的看懂我在迷茫什么，不是在泛泛安慰",
  happinessType: null,
  selfPattern: null,
  gratitudeMoment: "中午陪我一起回来，还给了面试建议",
  kindAction: "陪我一起回来，还一针见血地分析了焦虑和迷茫",
  seenNeed: "需要有人陪着，也需要有人帮我理清面试焦虑",
  gratitudeReason: "他不是泛泛安慰，而是真的说到了点上",
  confidence: 0.78,
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
    lastAssistantQuestion: "抛开具体的颜色或材质不谈，什么样的内容或场景节奏，最容易把你带进这种空旷松弛的状态？",
    draftSummary: null,
    messages: [
      {
        id: "assistant-1",
        role: "assistant",
        content: "抛开具体的颜色或材质不谈，什么样的内容或场景节奏，最容易把你带进这种空旷松弛的状态？",
        assistantPayload: {
          insight: "",
          thinkingSummary: "这份开心里，仪式感和松弛感已经很明显了。",
          analysis: "用户已说：礼物很有仪式感；下一步问：可复现线索",
          question: "抛开具体的颜色或材质不谈，什么样的内容或场景节奏，最容易把你带进这种空旷松弛的状态？",
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
        createdAt: "2026-05-26T00:00:00.000Z"
      }
    ],
    snapshot: joySnapshot,
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
        snapshot: joySnapshot,
        draftSummary: null,
        startedAt: "2026-05-26T00:00:00.000Z",
        completedAt: null
      }
    ],
    pendingDecision: null,
    startedAt: "2026-05-26T00:00:00.000Z",
    entryDate: "2026-05-26",
    pausedAt: null,
    completedAt: null,
    journalEntry: null,
    ...overrides
  };
}

describe("question clarity badcase baseline", () => {
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
    mockRecordAnalyticsEvent.mockReset();
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

  it("flags fulfillment abstract value prompts that the current surface protocol still lets through", () => {
    const surfaced = applyQuestionSurfaceProtocol({
      dimension: "fulfillment",
      stage: "probe_pattern",
      snapshot: fulfillmentSnapshot,
      spec: createQuestionSpec({
        dimension: "fulfillment",
        stage: "probe_pattern",
        snapshot: fulfillmentSnapshot,
        stageIntent: "advance"
      }),
      candidateQuestion: "回头看“看到了自己的成长”这层进展，什么样的投入会让你觉得自己的力气花得值？"
    });

    expect(containsLeadingAbstractValuePhrasing(surfaced.question)).toBe(false);
  });

  it("flags reflection repair output that still repeats the same mental-object chase with shell-shift wording", () => {
    const turn = renderDeterministicRepairTurn({
      dimension: "reflection",
      stage: "probe_pattern",
      snapshot: reflectionSnapshot,
      spec: createQuestionSpec({
        dimension: "reflection",
        stage: "probe_pattern",
        snapshot: reflectionSnapshot,
        stageIntent: "repair",
        previousSpec: {
          target: "judgment_clue",
          stageIntent: "advance",
          surfaceLevel: "default",
          anchorText: "晚上总想刷视频逃避一下",
          repairCount: 0
        }
      }),
      previousQuestion: "当你意识到“无聊，不知道该干啥”时，心里会闪过什么念头或画面，才让你决定刷视频而不是做别的？",
      hadReflectionSceneDenial: false
    });

    expect(hasMultiActionQuestionShape(turn.question)).toBe(false);
    expect(isNearDuplicatePromptShiftFromSystemOutput(turn.question, "当你意识到“无聊，不知道该干啥”时，心里会闪过什么念头或画面，才让你决定刷视频而不是做别的？")).toBe(false);
  });

  it("blocks joy anchor drift into color or material details when the event core is meaning and ritual", () => {
    const surfaced = applyQuestionSurfaceProtocol({
      dimension: "joy",
      stage: "probe_pattern",
      snapshot: joySnapshot,
      spec: createQuestionSpec({
        dimension: "joy",
        stage: "probe_pattern",
        snapshot: joySnapshot,
        stageIntent: "advance"
      }),
      candidateQuestion: "这种视觉或质感上的美感，具体是哪种颜色、形状或材质，最容易让你感到那种空旷松弛？"
    });

    expect(surfaced.question).not.toMatch(/颜色|形状|材质/u);
  });

  it("rewrites reflection multi-action threshold questions into a single concrete ask", () => {
    const surfaced = applyQuestionSurfaceProtocol({
      dimension: "reflection",
      stage: "probe_pattern",
      snapshot: reflectionSnapshot,
      spec: createQuestionSpec({
        dimension: "reflection",
        stage: "probe_pattern",
        snapshot: reflectionSnapshot,
        stageIntent: "advance",
        target: "insight_evidence"
      }),
      candidateQuestion: "这种“不知道具体该干什么”的模糊感，具体在哪个瞬间让你觉得刷视频比想清楚下一步更值得？"
    });

    expect(surfaced.questionSpec.target).toBe("insight_evidence");
    expect(surfaced.question).not.toMatch(/更值得|想清楚下一步/u);
    expect(surfaced.question).toMatch(/具体|细节|哪/u);
  });

  it("de-escalates improvement repair after an explicit “I don't know” instead of repeating another action ask", () => {
    const turn = renderDeterministicRepairTurn({
      dimension: "improvement",
      stage: "probe_pattern",
      snapshot: improvementSnapshot,
      spec: createQuestionSpec({
        dimension: "improvement",
        stage: "probe_pattern",
        snapshot: improvementSnapshot,
        stageIntent: "repair",
        previousSpec: {
          target: "judgment_clue",
          stageIntent: "advance",
          surfaceLevel: "default",
          anchorText: "早上吃完早餐回来之后就没有干什么事，也不知道怎么准备进一步优化面试",
          repairCount: 0
        }
      }),
      previousQuestion: "如果下次在早餐后再次感到“无聊、没兴奋感”，你最先能调整的一个小动作会是什么？",
      hadReflectionSceneDenial: false
    });

    expect(turn.question).not.toMatch(/小动作|先试哪一步|下次再遇到类似情况/u);
    expect(turn.question).toMatch(/最值得先看住的那一点是什么/u);
  });

  it("keeps gratitude judgment-clue follow-ups on the concrete response instead of jumping to “最值得珍惜的是什么”", () => {
    const surfaced = applyQuestionSurfaceProtocol({
      dimension: "gratitude",
      stage: "probe_pattern",
      snapshot: gratitudeSnapshot,
      spec: createQuestionSpec({
        dimension: "gratitude",
        stage: "probe_pattern",
        snapshot: gratitudeSnapshot,
        stageIntent: "advance"
      }),
      candidateQuestion: "这种能一针见血地帮你破除迷茫的回应，让你觉得这份感谢里，最值得珍惜的是什么？"
    });

    expect(surfaced.question).toContain("回到“中午陪我一起回来，还给了面试建议”这件事");
    expect(surfaced.question).toMatch(/最打动你|最有分量|最算数/u);
    expect(surfaced.question).toMatch(/哪一点|那一点|哪个点/u);
    expect(hasMultiActionQuestionShape(surfaced.question)).toBe(false);
    expect(surfaced.question).not.toMatch(/最值得珍惜|这份感谢里/u);
  });

  it("routes an explicit boundary stop through the real response-preparation path into a choice turn instead of another follow-up question", async () => {
    findJoyInterviewSessionById.mockResolvedValue(
      buildSession({
        stage: "probe_pattern",
        events: [
          {
            ...buildSession().events[0],
            snapshot: joySnapshot,
            coveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
            roundCoveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
            roundMeaningfulReplyCount: 3,
            totalMeaningfulReplyCount: 3
          }
        ]
      })
    );

    const result = await prepareJoyInterviewResponse({
      userId: "user-1",
      action: "reply",
      sessionId: "session-ready",
      userMessage: "结束本轮访谈",
      inputMode: "text"
    });

    if ("assistantMessage" in result || !result.assistantTurn) {
      throw new Error("Expected an active interview response with an assistant turn.");
    }

    expect(result.assistantTurn.stateUpdate.choiceKind).toBe("event_complete");
    expect(result.assistantTurn.question).toBe("");
    expect(result.nextProgressData).toEqual({
      kind: "event_complete",
      completionMode: "user_override_partial"
    });
    expect(extractJoySnapshotWithAI).not.toHaveBeenCalled();
    expect(generateJoyAssistantTurn).not.toHaveBeenCalled();
  });
});

function containsLeadingAbstractValuePhrasing(question: string) {
  const normalized = normalizeQuestion(question);

  return /^(回头看[^。！？?]*?(投入|标准|线索|信号)|如果只留一句最算数的标准|什么样的投入会让你觉得自己的力气花得值|最值得珍惜的是什么|看哪个更具体的(?:反应|信号))/u.test(
    normalized
  );
}

function hasMultiActionQuestionShape(question: string) {
  const normalized = normalizeQuestion(question);

  return /(会先看.+提醒自己|哪个瞬间.+而不是|哪个瞬间.+比.+更|比较哪两个选项|闪过什么念头或画面.+才让你决定)/u.test(
    normalized
  );
}

function isNearDuplicatePromptShiftFromSystemOutput(nextQuestion: string, previousQuestion: string) {
  const next = normalizeQuestion(nextQuestion);
  const previous = normalizeQuestion(previousQuestion);

  if (!next || !previous) {
    return false;
  }

  if (next === previous || next.includes(previous) || previous.includes(next)) {
    return true;
  }

  return (
    isReflectionMentalObjectPrompt(next) &&
    isReflectionMentalObjectPrompt(previous) &&
    hasSharedReflectionPressurePattern(next, previous)
  );
}

function isReflectionMentalObjectPrompt(question: string) {
  return /(念头|画面|反应|信号|提醒自己|看起来合适|刷视频)/u.test(question);
}

function hasSharedReflectionPressurePattern(left: string, right: string) {
  const leftSignals = collectReflectionSignals(left);
  const rightSignals = collectReflectionSignals(right);

  return leftSignals.size >= 2 && [...leftSignals].filter((signal) => rightSignals.has(signal)).length >= 2;
}

function collectReflectionSignals(question: string) {
  const signals = new Set<string>();

  for (const token of ["念头", "画面", "反应", "信号", "提醒自己", "看起来合适", "刷视频"]) {
    if (question.includes(token)) {
      signals.add(token);
    }
  }

  return signals;
}

function normalizeQuestion(question: string) {
  return question.replace(/\s+/g, "").replace(/[，。！？；：,.!?“”"'（）()【】\[\]《》]/gu, "");
}
