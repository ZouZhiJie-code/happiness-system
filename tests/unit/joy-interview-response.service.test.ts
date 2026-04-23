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

const { buildAssistantQuestion, getInactiveSessionMessage, getNextStage, getOpeningQuestion } = vi.hoisted(() => ({
  buildAssistantQuestion: vi.fn(),
  getInactiveSessionMessage: vi.fn(),
  getNextStage: vi.fn(),
  getOpeningQuestion: vi.fn()
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
  getInactiveSessionMessage,
  getNextStage,
  getOpeningQuestion
}));

import { prepareJoyInterviewResponse, streamJoyInterviewResponse } from "@/server/services/interview/joy-interview.service";

const baseSnapshot: JoySnapshot = {
  event: "今天和朋友聊了很久",
  feeling: "温暖被理解",
  whyItMattered: "因为我感觉自己被接住了",
  happinessType: "关系型开心",
  selfPattern: null,
  confidence: 0.9,
  missingSlots: []
};

function buildSession(overrides: Partial<InterviewSessionRecord> = {}): InterviewSessionRecord {
  return {
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
          insight: "这份开心像是来自连接感。",
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
      insight: "这段经历为什么重要，已经慢慢清楚起来了。",
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
    expect(result.assistantTurn.stateUpdate.shouldEndDimension).toBe(false);
    expect(result.assistantTurn.stateUpdate.choiceReason).toContain("完整复盘");
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
      insight: "我们换个角度，把这段经历再看清一点。",
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
    expect(result.assistantTurn.insight).toBe("");
    expect(result.assistantTurn.stateUpdate.offerChoice).toBe(false);
    expect(result.assistantTurn.stateUpdate.turnPhase).toBe("digging");
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
      insight: "你已经说清楚，这更像是一种让自己重新活过来的方式。",
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
      insight: "从交到更多朋友这件事里，已经能看到你行动上的变化。",
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
        target: "insight",
        text: "这份开心像是来自连接感。"
      });
      await onDelta({
        target: "question",
        text: "你觉得自己在关系里最在乎什么？"
      });

      return {
        insight: "这份开心像是来自连接感。",
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

    expect(phases).toEqual(["thinking", "insight", "question"]);
    expect(deltas).toEqual([
      {
        target: "insight",
        text: "这份开心像是来自连接感。"
      },
      {
        target: "question",
        text: "你觉得自己在关系里最在乎什么？"
      }
    ]);
    expect(streamJoyAssistantTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "reply",
        stage: "probe_pattern"
      }),
      expect.any(Object)
    );
    expect(appendJoyInterviewTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        nextTurnCount: 4,
        assistantTurn: expect.objectContaining({
          insight: "这份开心像是来自连接感。",
          question: "你觉得自己在关系里最在乎什么？"
        })
      })
    );
    expect(result.assistantTurn?.question).toBe("你觉得自己在关系里最在乎什么？");
  });
});
