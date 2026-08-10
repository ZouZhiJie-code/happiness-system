import { describe, expect, it } from "vitest";

import { eventCenteredGenerativeTurnSchema } from "@/features/interview/event-centered/ai-contract";
import { createInitialEventCenteredDialogueState } from "@/features/interview/event-centered/dialogue-state";
import {
  applyGenerativeEventCenteredTurnPolicy,
  createGenerativeEventCenteredPayload,
  hasEventCenteredUnableAnswerSignal,
  isEventCenteredPureUnableAnswer,
  toEventCenteredUnderstandingDecision
} from "@/features/interview/event-centered/generative-turn-policy";

function askingTurn() {
  return eventCenteredGenerativeTurnSchema.parse({
    understanding: {
      eventBoundary: "current_event",
      coreEventIdentifiable: true,
      answerStatus: "answered",
      factDeltas: [],
      correctionOrBoundary: null,
      tentativeInterpretation: null,
      eventOptions: []
    },
    semanticPlan: {
      action: "ask",
      activeAngle: "feeling",
      outcomeAssessment: {
        state: "needs_more",
        origin: null,
        basis: "两种感受同时出现，仍需要区分各自发生的时刻",
        supportEvidenceRefs: ["fact-1"],
        missingUnderstanding: "至少说清哪一种感受先出现"
      },
      evidenceRefs: ["fact-1"],
      insightKind: null,
      selectedTargetId: "紧张与期待的具体区别",
      expectedUnderstandingDelta: "区分两种同时出现的感受",
      tentativeInterpretation: null,
      stopReason: null,
      cognitiveAction: "differentiate",
      microgoalDelta: null,
      realizationContract: {
        responseCore: "紧张和期待哪一种先冒出来",
        summaryAnchors: ["紧张和期待"]
      }
    },
    visibleTurn: {
      thinkingSummary: "你同时提到紧张和期待，我想继续区分它们各自出现的时刻。",
      responseKind: "question",
      question: "听到名字时，紧张和期待哪一种先冒出来？",
      insight: null,
      honestLimit: null
    }
  });
}

describe("event-centered generative state adapter", () => {
  it("事件和个人反应已在原话中同时出现时，生成式策略进入第一检查点", () => {
    const turn = askingTurn();
    turn.understanding.factDeltas = [{
      statement: "今天在跟狗玩的时候被狗咬了一口，有点委屈，也担心以后还会出血。",
      scope: "current_event",
      stance: "unknown",
      kind: "inner_experience",
      quote: "今天在跟狗玩的时候被狗咬了一口，有点委屈，也担心以后还会出血。"
    }];

    const result = applyGenerativeEventCenteredTurnPolicy({
      state: createInitialEventCenteredDialogueState(),
      action: "reply",
      rawText: "今天在跟狗玩的时候被狗咬了一口，有点委屈，也担心以后还会出血。",
      turn
    });

    expect(result.nextState.phase).toBe("checkpoint_one");
    expect(result.nextState.reflectionReady).toBe(true);
    expect(result.directive.checkpoint).toEqual({ kind: "first", outcome: null });
  });

  it("引导问题按语义计划保存唯一目标", () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "checkpoint_one";
    const turn = askingTurn();

    const result = applyGenerativeEventCenteredTurnPolicy({
      state,
      action: "select_exploration_angle",
      selectedAngle: "feeling",
      rawText: "",
      turn
    });

    expect(result.nextState).toMatchObject({
      strategyMode: "generative",
      phase: "guided_reflection",
      activeAngle: "feeling",
      currentQuestion: {
        opportunityNumber: 1,
        target: "紧张与期待的具体区别",
        cognitiveAction: "differentiate"
      },
      currentQuestionIntent: {
        targetId: "紧张与期待的具体区别",
        semanticGoal: "区分两种同时出现的感受",
        minimumAnswerScope: "至少说清哪一种感受先出现"
      }
    });
    expect(result.directive.exactResponse).toBe(
      "听到名字时，紧张和期待哪一种先冒出来？"
    );
  });

  it("只有完整回答关闭当前目标，部分回答和说不清仍保持开放", () => {
    const applyAnswerStatus = (
      answerStatus: ReturnType<typeof askingTurn>["understanding"]["answerStatus"]
    ) => {
      const state = createInitialEventCenteredDialogueState();
      state.phase = "guided_reflection";
      state.activeAngle = "feeling";
      state.currentQuestion = {
        opportunityNumber: 1,
        angle: "feeling",
        target: "紧张与期待的具体区别",
        surfaceLevel: "open_anchor",
        repairCount: 0,
        assistantMessageId: "assistant-1",
        cognitiveAction: "differentiate"
      };
      const turn = askingTurn();
      turn.understanding.answerStatus = answerStatus;
      turn.understanding.factDeltas = [{
        statement: "紧张先出现",
        scope: "current_event",
        stance: "affirmed",
        kind: "inner_experience",
        quote: "紧张先出现"
      }];

      return applyGenerativeEventCenteredTurnPolicy({
        state,
        action: "reply",
        rawText: "紧张先出现，但后面的区别我还说不清。",
        turn
      }).nextState.angleRuns.feeling!;
    };

    expect(applyAnswerStatus("answered").answeredTargets).toContain(
      "紧张与期待的具体区别"
    );
    expect(applyAnswerStatus("partly_answered").answeredTargets).not.toContain(
      "紧张与期待的具体区别"
    );
    expect(applyAnswerStatus("unknown").deniedTargets).not.toContain(
      "紧张与期待的具体区别"
    );
    expect(applyAnswerStatus("declined").deniedTargets).toContain(
      "紧张与期待的具体区别"
    );
  });

  it("纯说不清只触发一次同目标具体入口，并保留正式问题计数", () => {
    expect(isEventCenteredPureUnableAnswer("我暂时说不清。")).toBe(true);
    expect(isEventCenteredPureUnableAnswer("我还是想不到。")).toBe(true);
    expect(isEventCenteredPureUnableAnswer("我说不清，但胸口会发紧。")).toBe(false);
    expect(isEventCenteredPureUnableAnswer("我不想再回答。")).toBe(false);
    expect(hasEventCenteredUnableAnswerSignal(
      "松下来是终于不用改了；空的那部分我还说不清。"
    )).toBe(true);
    expect(hasEventCenteredUnableAnswerSignal(
      "空的那部分我说不清，也不想继续回答。"
    )).toBe(false);

    const state = createInitialEventCenteredDialogueState();
    state.phase = "guided_reflection";
    state.activeAngle = "feeling";
    state.angleRuns.feeling = {
      status: "active",
      questionOpportunityCount: 2,
      currentOutcomeId: null,
      answeredTargets: [],
      askedTargets: ["紧张与期待的具体区别"],
      deniedTargets: []
    };
    state.currentQuestion = {
      opportunityNumber: 2,
      angle: "feeling",
      target: "紧张与期待的具体区别",
      surfaceLevel: "simplified",
      repairCount: 1,
      assistantMessageId: "assistant-2",
      cognitiveAction: "differentiate"
    };
    state.currentQuestionIntent = {
      targetId: "紧张与期待的具体区别",
      semanticGoal: "区分两种同时出现的感受",
      minimumAnswerScope: "至少说清一个具体时刻的身体反应"
    };
    const turn = askingTurn();
    turn.understanding.answerStatus = "unknown";
    turn.decision.selectedTarget = "紧张与期待的具体区别";
    turn.decision.cognitiveAction = "anchor_specific";
    turn.reply.question = "听到名字的那一刻，你身体最先有什么反应？";

    const result = applyGenerativeEventCenteredTurnPolicy({
      state,
      action: "reply",
      rawText: "紧张是听到名字时先冒出来的，期待后面才有；身体那部分我还说不清。",
      turn
    });

    expect(result.directive).toMatchObject({
      responseKind: "repair",
      exactResponse: "只说一个具体瞬间就好：当时心里或身体最先有什么反应？",
      questionSpec: {
        angle: "feeling",
        target: "紧张与期待的具体区别",
        opportunityNumber: 2,
        surfaceLevel: "concrete_anchor",
        repairCount: 2,
        cognitiveAction: "anchor_specific"
      }
    });
    expect(result.nextState.angleRuns.feeling?.questionOpportunityCount).toBe(2);
    expect(result.nextState.currentQuestion?.repairCount).toBe(2);
    expect(result.nextState.currentQuestionIntent).toEqual(state.currentQuestionIntent);
    expect(result.localDeterministicRepairApplied).toBe(true);

    const refused = applyGenerativeEventCenteredTurnPolicy({
      state,
      action: "reply",
      rawText: "身体那部分我还是说不清，我也不想继续回答了。",
      turn
    });
    expect(refused.nextState.phase).toBe("checkpoint_two");
    expect(refused.nextState.angleRuns.feeling?.deniedTargets).toContain(
      "紧张与期待的具体区别"
    );
  });

  it("模型过早给出 honest_limit 时，第一次说不清仍进入一次受控具体问法", () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "guided_reflection";
    state.activeAngle = "feeling";
    state.angleRuns.feeling = {
      status: "active",
      questionOpportunityCount: 1,
      currentOutcomeId: null,
      answeredTargets: [],
      askedTargets: ["direct_experience"],
      deniedTargets: []
    };
    state.currentQuestion = {
      opportunityNumber: 1,
      angle: "feeling",
      target: "direct_experience",
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: "assistant-1",
      cognitiveAction: "anchor_specific"
    };
    const turn = askingTurn();
    turn.understanding.answerStatus = "unknown";
    turn.decision.turnAction = "honest_limit";
    turn.reply.question = null;
    turn.visibleTurn.honestLimit = "这一段先停在这里。";

    const repaired = applyGenerativeEventCenteredTurnPolicy({
      state,
      action: "reply",
      rawText: "我一时说不清，脑子里只有事情被打乱的感觉。",
      facts: [{
        id: "fact-event",
        eventId: "event-1",
        createdBranchSessionId: "branch-1",
        createdByRevisionId: null,
        pathAnchorMessageId: "user-1",
        statement: "临时改期的消息打乱了安排",
        scope: "current_event",
        stance: "affirmed",
        kind: "event_detail",
        origin: "user_expression",
        createdAt: "2026-08-03T00:00:00.000Z",
        evidence: []
      }],
      turn
    });

    expect(repaired.directive).toMatchObject({
      responseKind: "repair",
      questionSpec: {
        angle: "feeling",
        target: "direct_experience",
        surfaceLevel: "concrete_anchor",
        repairCount: 1
      }
    });
    expect(repaired.localDeterministicRepairApplied).toBe(true);
    expect(repaired.directive.exactResponse).toContain("最先感觉到什么");
    expect(createGenerativeEventCenteredPayload({ turn, policy: repaired }).naturalResponse)
      .toBe(repaired.directive.exactResponse);

    const closed = applyGenerativeEventCenteredTurnPolicy({
      state: repaired.nextState,
      action: "reply",
      rawText: "还是说不清。",
      turn
    });
    expect(closed.nextState.phase).toBe("checkpoint_two");
    expect(closed.nextState.angleRuns.feeling?.status).toBe("closed");
  });


  it("具体入口后再次说不清时诚实收束，深入微目标计数保持原值", () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "deep_companionship";
    state.activeAngle = "feeling";
    state.lastCompletedAngle = "feeling";
    state.currentMicrogoal = {
      id: "microgoal:feeling:紧张与期待的具体区别",
      angle: "feeling",
      statement: "区分两种同时出现的感受",
      questionCount: 2,
      answerCount: 0,
      status: "active",
      evidenceRefs: []
    };
    state.currentQuestion = {
      opportunityNumber: 2,
      angle: "feeling",
      target: "紧张与期待的具体区别",
      surfaceLevel: "concrete_anchor",
      repairCount: 1,
      assistantMessageId: "assistant-2",
      cognitiveAction: "anchor_specific"
    };
    const turn = askingTurn();
    turn.understanding.answerStatus = "unknown";
    turn.decision.selectedTarget = "紧张与期待的具体区别";
    turn.decision.cognitiveAction = "anchor_specific";
    turn.reply.question = "当时手上最先有什么动作？";

    const result = applyGenerativeEventCenteredTurnPolicy({
      state,
      action: "reply",
      rawText: "我还是分不清。",
      turn
    });

    expect(result.nextState.phase).toBe("checkpoint_two");
    expect(result.nextState.currentQuestion).toBeNull();
    expect(result.nextState.currentMicrogoal).toMatchObject({
      questionCount: 2,
      status: "closed"
    });
    expect(result.directive.responseKind).toBe("checkpoint");
  });

  it("用户主动换问法继续走原入口，不进入自动说不清修复", () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "guided_reflection";
    state.activeAngle = "feeling";
    state.currentQuestion = {
      opportunityNumber: 1,
      angle: "feeling",
      target: "紧张与期待的具体区别",
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: "assistant-1",
      cognitiveAction: "differentiate"
    };
    const turn = askingTurn();
    turn.understanding.answerStatus = "unknown";
    turn.decision.cognitiveAction = "anchor_specific";
    turn.reply.question = "听到名字的那一刻，你身体最先有什么反应？";

    const result = applyGenerativeEventCenteredTurnPolicy({
      state,
      action: "regenerate_response",
      rawText: "我暂时说不清。",
      turn
    });

    expect(result.directive.responseKind).toBe("question");
    expect(result.directive.questionSpec?.surfaceLevel).toBe("open_anchor");
  });

  it("完成动作把阶段性认识交给检查点和成果", () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "guided_reflection";
    state.activeAngle = "feeling";
    state.currentQuestion = {
      opportunityNumber: 1,
      angle: "feeling",
      target: "紧张与期待的具体区别",
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: "assistant-1",
      cognitiveAction: "differentiate"
    };
    state.currentQuestionIntent = {
      targetId: "紧张与期待的具体区别",
      semanticGoal: "区分两种同时出现的感受",
      minimumAnswerScope: "至少说清哪一种感受先出现"
    };
    const turn = eventCenteredGenerativeTurnSchema.parse({
      understanding: {
        ...askingTurn().understanding,
        factDeltas: [
          {
            statement: "活动已经结束",
            scope: "current_event",
            stance: "affirmed",
            kind: "event_detail",
            quote: "活动已经结束"
          }
        ]
      },
      semanticPlan: {
        action: "complete",
        activeAngle: "feeling",
        outcomeAssessment: {
          state: "ready",
          origin: "user_articulated",
          basis: "用户已经区分紧张与期待",
          supportEvidenceRefs: ["new:1"],
          missingUnderstanding: null
        },
        evidenceRefs: ["new:1"],
        insightKind: "distinction",
        selectedTargetId: null,
        expectedUnderstandingDelta: "紧张里还夹着一份期待，两种感受已经能够区分",
        tentativeInterpretation: null,
        stopReason: "阶段性认识已经形成",
        cognitiveAction: null,
        microgoalDelta: null,
        realizationContract: {
          responseCore: "紧张和期待现在已经能够分开看见",
          summaryAnchors: ["活动已经结束"]
        }
      },
      visibleTurn: {
        thinkingSummary: null,
        responseKind: "completion",
        question: null,
        insight: "原先混在一起的紧张和期待，现在已经能够分开看见。",
        honestLimit: null
      }
    });

    const result = applyGenerativeEventCenteredTurnPolicy({
      state,
      action: "reply",
      rawText: "活动已经结束。",
      turn
    });
    const payload = createGenerativeEventCenteredPayload({ turn, policy: result });

    expect(result.nextState.phase).toBe("checkpoint_two");
    expect(result.nextState.currentQuestion).toBeNull();
    expect(result.nextState.currentQuestionIntent).toBeNull();
    expect(result.angleOutcome?.statement).toBe(turn.visibleTurn.insight);
    expect(payload).toMatchObject({
      naturalUnderstanding: "",
      naturalResponse: "",
      checkpoint: { kind: "second" },
      presentation: "hidden"
    });
  });

  it("深入聊聊暂停时保存微目标并展示本段认识", () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "deep_companionship";
    state.activeAngle = "relationship";
    state.lastCompletedAngle = "relationship";
    state.currentMicrogoal = {
      id: "microgoal:relationship:care_autonomy",
      angle: "relationship",
      statement: "理解关心和自主同时出现的张力",
      questionCount: 2,
      answerCount: 1,
      status: "active",
      evidenceRefs: ["fact-1"]
    };
    state.currentQuestion = {
      opportunityNumber: 2,
      angle: "relationship",
      target: "care_autonomy",
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: "assistant-2",
      cognitiveAction: "surface_tension"
    };
    state.currentQuestionIntent = {
      targetId: "care_autonomy",
      semanticGoal: "理解关心和自主同时出现的张力",
      minimumAnswerScope: "至少说清两边为何都重要"
    };
    const turn = eventCenteredGenerativeTurnSchema.parse({
      understanding: {
        ...askingTurn().understanding,
        factDeltas: []
      },
      semanticPlan: {
        action: "pause",
        activeAngle: "relationship",
        outcomeAssessment: {
          state: "ready",
          origin: "user_articulated",
          basis: "关心和自主两边都重要已经由用户明确表达",
          supportEvidenceRefs: ["fact-1"],
          missingUnderstanding: null
        },
        evidenceRefs: ["fact-1"],
        insightKind: "tension",
        selectedTargetId: null,
        expectedUnderstandingDelta: "关心与自主同时重要，关心需要保留询问空间",
        tentativeInterpretation: null,
        stopReason: "当前张力已有清楚进展",
        cognitiveAction: null,
        microgoalDelta: {
          operation: "complete",
          statement: "理解关心和自主同时出现的张力",
          supportEvidenceRefs: ["fact-1"]
        },
        realizationContract: {
          responseCore: "关心保留询问和自己决定的空间",
          summaryAnchors: ["被照顾和自己作主"]
        }
      },
      visibleTurn: {
        thinkingSummary: null,
        responseKind: "pause",
        question: null,
        insight: "你珍惜对方的关心，也需要关心保留询问和自己决定的空间。",
        honestLimit: null
      }
    });

    const result = applyGenerativeEventCenteredTurnPolicy({
      state,
      action: "reply",
      rawText: "两边都重要。",
      turn
    });

    expect(result.nextState.phase).toBe("checkpoint_two");
    expect(result.nextState.currentQuestionIntent).toBeNull();
    expect(result.nextState.currentMicrogoal?.status).toBe("completed");
    expect(result.nextState.angleRuns.relationship?.answeredTargets).toContain(
      "care_autonomy"
    );
    expect(result.directive.exactResponse).toBe(turn.visibleTurn.insight);
  });

  it("纠正先撤回旧成果和待确认理解，再按新计划继续", () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "guided_reflection";
    state.activeAngle = "relationship";
    state.pendingUnderstandingClaimId = "claim-1";
    state.angleRuns.relationship = {
      status: "completed",
      questionOpportunityCount: 1,
      currentOutcomeId: "outcome-1",
      answeredTargets: [],
      askedTargets: ["expected_participation"],
      deniedTargets: []
    };
    state.currentQuestion = {
      opportunityNumber: 1,
      angle: "relationship",
      target: "expected_participation",
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: "assistant-1",
      cognitiveAction: "test_understanding"
    };
    state.currentQuestionIntent = {
      targetId: "expected_participation",
      semanticGoal: "理解用户对参与这件事的期待",
      minimumAnswerScope: "至少说清介意的具体环节"
    };
    const turn = askingTurn();
    turn.understanding.answerStatus = "correction";
    turn.understanding.correctionOrBoundary = {
      kind: "correction",
      reason: "用户撤回了先前的关系理解"
    };
    turn.semanticPlan.activeAngle = "relationship";
    turn.semanticPlan.selectedTargetId = "corrected_relationship_focus";
    turn.decision.selectedTarget = "corrected_relationship_focus";

    const result = applyGenerativeEventCenteredTurnPolicy({
      state,
      action: "correct_understanding",
      rawText: "刚才理解错了，我介意的是没有提前告诉我。",
      turn
    });
    const decision = toEventCenteredUnderstandingDecision({
      turn,
      rawText: "刚才理解错了，我介意的是没有提前告诉我。",
      facts: []
    });

    expect(result.nextState.pendingUnderstandingClaimId).toBeNull();
    expect(result.nextState.currentQuestionIntent).toMatchObject({
      targetId: "corrected_relationship_focus"
    });
    expect(result.nextState.angleRuns.relationship).toMatchObject({
      status: "active",
      currentOutcomeId: null,
      deniedTargets: ["expected_participation"]
    });
    expect(decision.correctionTargetHint).toBe("用户撤回了先前的关系理解");
    expect(decision.boundaryReason).toBeNull();
  });

  it("模型过早诚实收束时，第一次说不清优先给出具体入口", () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "guided_reflection";
    state.activeAngle = "thought";
    state.currentQuestion = {
      opportunityNumber: 2,
      angle: "thought",
      target: "judgment_evidence",
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: "assistant-2",
      cognitiveAction: "clarify_user_term"
    };
    state.currentQuestionIntent = {
      targetId: "judgment_evidence",
      semanticGoal: "理解这次判断依据是什么",
      minimumAnswerScope: "至少说出一条具体依据"
    };
    const turn = eventCenteredGenerativeTurnSchema.parse({
      understanding: {
        ...askingTurn().understanding,
        answerStatus: "unknown"
      },
      semanticPlan: {
        action: "honest_limit",
        activeAngle: "thought",
        outcomeAssessment: {
          state: "limited",
          origin: null,
          basis: "当前只能确认用户在意结果",
          supportEvidenceRefs: [],
          missingUnderstanding: null
        },
        evidenceRefs: [],
        insightKind: "scope_only",
        selectedTargetId: null,
        expectedUnderstandingDelta: null,
        tentativeInterpretation: null,
        stopReason: "当前材料有限",
        cognitiveAction: null,
        microgoalDelta: null,
        realizationContract: {
          responseCore: "保留到目前能确认的范围",
          summaryAnchors: ["在意结果"]
        }
      },
      visibleTurn: {
        thinkingSummary: null,
        responseKind: "honest_limit",
        question: null,
        insight: null,
        honestLimit: "这一段先保留到目前能确认的范围。"
      }
    });

    const result = applyGenerativeEventCenteredTurnPolicy({
      state,
      action: "reply",
      rawText: "我暂时说不清。",
      turn
    });

    expect(result.nextState.phase).toBe("guided_reflection");
    expect(result.nextState.currentQuestion).toMatchObject({
      target: "judgment_evidence",
      surfaceLevel: "concrete_anchor"
    });
    expect(result.nextState.currentQuestionIntent).toMatchObject({
      targetId: "judgment_evidence"
    });
    expect(result.angleOutcome).toBeNull();
    expect(result.directive.responseKind).toBe("repair");
    expect(result.localDeterministicRepairApplied).toBe(true);
  });
});
