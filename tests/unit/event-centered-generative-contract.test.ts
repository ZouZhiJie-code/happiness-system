import { describe, expect, it } from "vitest";

import {
  eventCenteredGenerativePlanSchema,
  eventCenteredLockedGenerativeVisibleSchema,
  eventCenteredProviderGenerativeTurnSchema,
  eventCenteredGenerativeTurnSchema,
  eventCenteredTwoStageGenerativePlanSchema,
  eventCenteredTwoStageV4GenerativePlanSchema,
  partitionEventCenteredGenerativeValidationIssues,
  validateEventCenteredGenerativeTurn
} from "@/features/interview/event-centered/ai-contract";

function completionData() {
  return {
    understanding: {
      eventBoundary: "current_event",
      coreEventIdentifiable: true,
      answerStatus: "answered",
      factDeltas: [
        {
          statement: "演出已经结束",
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: "演出已经结束"
        },
        {
          statement: "卸妆后才松开牙关",
          scope: "current_event",
          stance: "affirmed",
          kind: "inner_experience",
          quote: "卸妆后才松开牙关"
        }
      ],
      correctionOrBoundary: null,
      tentativeInterpretation: null,
      eventOptions: []
    },
    semanticPlan: {
      action: "complete",
      activeAngle: "feeling",
      outcomeAssessment: {
        state: "ready",
        origin: "user_articulated",
        basis: "用户已经把事件结束与身体松开之间的时间差说清",
        supportEvidenceRefs: ["new:1", "new:2"],
        missingUnderstanding: null
      },
      evidenceRefs: ["new:1", "new:2"],
      insightKind: "connection",
      selectedTargetId: null,
      expectedUnderstandingDelta: "外在的结束先发生，身体随后才离开那场演出",
      tentativeInterpretation: null,
      stopReason: "已形成身体结束晚于事件结束的认识",
      cognitiveAction: null,
      microgoalDelta: null,
      realizationContract: {
        responseCore: "演出已经结束，卸妆后才松开牙关",
        summaryAnchors: ["演出已经结束", "松开牙关"]
      }
    },
    visibleTurn: {
      thinkingSummary: null,
      responseKind: "completion",
      question: null,
      insight: "演出已经结束，卸妆后才松开牙关。",
      honestLimit: null
    }
  };
}

function askData() {
  return {
    understanding: {
      eventBoundary: "current_event",
      coreEventIdentifiable: true,
      answerStatus: "answered",
      factDeltas: [
        {
          statement: "评审接受了提案",
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: "评审接受了提案"
        },
        {
          statement: "用户因一处格式错误否定整体",
          scope: "current_event",
          stance: "affirmed",
          kind: "stated_interpretation",
          quote: "一处格式错了，我就觉得整份都不行"
        }
      ],
      correctionOrBoundary: null,
      tentativeInterpretation: null,
      eventOptions: []
    },
    semanticPlan: {
      action: "ask",
      activeAngle: "thought",
      outcomeAssessment: {
        state: "needs_more",
        origin: null,
        basis: "整体否定背后的判断标准仍未说清",
        supportEvidenceRefs: ["new:1", "new:2"],
        missingUnderstanding: "局部错误为什么足以代表整体失败"
      },
      evidenceRefs: ["new:1", "new:2"],
      insightKind: null,
      selectedTargetId: "局部错误代表整体失败的判断规则",
      expectedUnderstandingDelta: "理解一处错误为什么足以否定整体成果",
      tentativeInterpretation: null,
      stopReason: null,
      cognitiveAction: "connect_clues",
      microgoalDelta: null,
      realizationContract: {
        responseCore: "格式错误为什么足以让你觉得整份提案都不行",
        summaryAnchors: ["评审接受了提案"]
      }
    },
    visibleTurn: {
      thinkingSummary: "评审已经接受提案，你仍让一处格式错误代表了整份成果；我想继续确认这个错误在你的判断里代表了什么。",
      responseKind: "question",
      question: "那处格式错误为什么足以让你觉得整份提案都不行？",
      insight: null,
      honestLimit: null
    }
  };
}

function anchorParaphraseData(thinkingSummary: string) {
  const input = askData();
  input.understanding.factDeltas = [
    {
      statement: "手还在抖",
      scope: "current_event",
      stance: "affirmed",
      kind: "inner_experience",
      quote: "手还在抖"
    },
    {
      statement: "肩膀也一直耸着",
      scope: "current_event",
      stance: "affirmed",
      kind: "inner_experience",
      quote: "肩膀也一直耸着"
    },
    {
      statement: "喝完水才松下来",
      scope: "current_event",
      stance: "affirmed",
      kind: "inner_experience",
      quote: "喝完水才松下来"
    }
  ];
  input.semanticPlan.evidenceRefs = ["new:1", "new:2", "new:3"];
  input.semanticPlan.outcomeAssessment.supportEvidenceRefs = ["new:1", "new:2", "new:3"];
  input.semanticPlan.realizationContract.summaryAnchors = [
    "手还在抖",
    "肩膀也一直耸着",
    "喝完水才松下来"
  ];
  input.semanticPlan.realizationContract.responseCore = "手抖和肩膀紧绷哪一个最后松开";
  input.visibleTurn.thinkingSummary = thinkingSummary;
  input.visibleTurn.question = "手抖和肩膀紧绷，哪一个最后松开？";
  return eventCenteredGenerativeTurnSchema.parse(input);
}

function validate(
  turn = eventCenteredGenerativeTurnSchema.parse(completionData()),
  overrides: Record<string, unknown> = {}
) {
  return validateEventCenteredGenerativeTurn({
    turn,
    rawText: "演出已经结束，卸妆后才松开牙关。",
    phase: "guided_reflection",
    angle: "feeling",
    existingFactIds: [],
    answeredTargets: [],
    deniedTargets: [],
    guidedQuestionOpportunityCount: 0,
    microgoalQuestionCount: 0,
    ...overrides
  });
}

function semanticSkeletonUnderstanding() {
  const { tentativeInterpretation: _omitted, ...understanding } =
    completionData().understanding;
  void _omitted;
  return understanding;
}

function validV4ReadyPlan() {
  return {
    understanding: semanticSkeletonUnderstanding(),
    decision: {
      state: "ready" as const,
      origin: "ai_synthesized" as const
    },
    semanticFrame: {
      units: [
        { id: "u1" as const, role: "event" as const, evidenceRefs: ["new:1"] },
        { id: "u2" as const, role: "experience" as const, evidenceRefs: ["new:2"] }
      ],
      relation: {
        type: "sequence" as const,
        fromUnitId: "u1" as const,
        toUnitId: "u2" as const
      }
    },
    questionIntent: null,
    limitReason: null
  };
}

describe("event-centered generative hard contract", () => {
  it("v4 第一段只接受五个顶层字段和无文案语义单元", () => {
    const valid = validV4ReadyPlan();
    expect(eventCenteredTwoStageV4GenerativePlanSchema.safeParse(valid).success)
      .toBe(true);
    expect(eventCenteredTwoStageV4GenerativePlanSchema.safeParse({
      ...valid,
      understandingCard: { statement: "提前生成的理解句", evidenceRefs: ["new:1"] }
    }).success).toBe(false);
    const withUnitStatement = structuredClone(valid);
    Object.assign(withUnitStatement.semanticFrame.units[0]!, {
      statement: "提前生成的用户文案"
    });
    expect(eventCenteredTwoStageV4GenerativePlanSchema.safeParse(withUnitStatement).success)
      .toBe(false);
  });

  it("ready 必须保留成果归属，其他状态的成果归属固定为空", () => {
    const ready = validV4ReadyPlan();
    expect(eventCenteredTwoStageV4GenerativePlanSchema.safeParse({
      ...ready,
      decision: { state: "ready", origin: null }
    }).success).toBe(false);
    expect(eventCenteredTwoStageV4GenerativePlanSchema.safeParse({
      ...ready,
      decision: { state: "ready", origin: "user_articulated" }
    }).success).toBe(true);

    const needsMore = {
      ...ready,
      decision: { state: "needs_more", origin: "user_articulated" },
      questionIntent: {
        gap: "补清身体真正松开的变化时刻",
        answerSource: {
          kind: "change_moment",
          evidenceRefs: ["new:2"],
          anchorQuote: "卸妆后才松开牙关"
        }
      }
    };
    expect(eventCenteredTwoStageV4GenerativePlanSchema.safeParse(needsMore).success)
      .toBe(false);
  });

  it("AI 综合要求关系与关系两侧的不同证据", () => {
    const ready = validV4ReadyPlan();
    const oneSided = {
      ...ready,
      semanticFrame: {
        ...ready.semanticFrame,
        units: ready.semanticFrame.units.map((unit) => ({
          ...unit,
          evidenceRefs: ["new:1"]
        }))
      }
    };
    expect(eventCenteredTwoStageV4GenerativePlanSchema.safeParse(oneSided).success)
      .toBe(false);
  });

  it("v4 语义关系要求有效端点，并收紧 change_effect 方向", () => {
    const ready = validV4ReadyPlan();
    const missingRelation = {
      ...ready,
      semanticFrame: { ...ready.semanticFrame, relation: null }
    };
    expect(eventCenteredTwoStageV4GenerativePlanSchema.safeParse(missingRelation).success)
      .toBe(false);

    const wrongChangeEffect = {
      ...ready,
      semanticFrame: {
        ...ready.semanticFrame,
        relation: { ...ready.semanticFrame.relation, type: "change_effect" }
      }
    };
    expect(eventCenteredTwoStageV4GenerativePlanSchema.safeParse(wrongChangeEffect).success)
      .toBe(true);

    const validChangeEffect = {
      ...ready,
      semanticFrame: {
        units: [
          { id: "u1", role: "change", evidenceRefs: ["new:1"] },
          { id: "u2", role: "result", evidenceRefs: ["new:2"] }
        ],
        relation: { type: "change_effect", fromUnitId: "u1", toUnitId: "u2" }
      }
    };
    expect(eventCenteredTwoStageV4GenerativePlanSchema.safeParse(validChangeEffect).success)
      .toBe(true);

    const modelVocabularyChangeEffect = {
      ...ready,
      semanticFrame: {
        units: [
          { id: "u1", role: "event", evidenceRefs: ["new:1"] },
          { id: "u2", role: "result", evidenceRefs: ["new:2"] }
        ],
        relation: { type: "change_effect", fromUnitId: "u1", toUnitId: "u2" }
      }
    };
    const normalizedModelVocabulary = eventCenteredTwoStageV4GenerativePlanSchema.safeParse(
      modelVocabularyChangeEffect
    );
    expect(normalizedModelVocabulary.success).toBe(true);
    if (normalizedModelVocabulary.success) {
      expect(normalizedModelVocabulary.data.semanticFrame?.units[0]?.role).toBe("change");
    }

    const missingEndpoint = {
      ...ready,
      semanticFrame: {
        ...ready.semanticFrame,
        relation: { ...ready.semanticFrame.relation, toUnitId: "u3" }
      }
    };
    expect(eventCenteredTwoStageV4GenerativePlanSchema.safeParse(missingEndpoint).success)
      .toBe(false);
  });

  it("v4 提问意图只保存内部缺口和可追溯来源形态", () => {
    const validAsk = {
      understanding: semanticSkeletonUnderstanding(),
      decision: { state: "needs_more", origin: null },
      semanticFrame: {
        units: [{ id: "u1", role: "event", evidenceRefs: ["new:1"] }],
        relation: null
      },
      questionIntent: {
        gap: "补清身体真正松开的变化时刻",
        answerSource: {
          kind: "change_moment",
          evidenceRefs: ["new:2"],
          anchorQuote: "卸妆后才松开牙关"
        }
      },
      limitReason: null
    };
    expect(eventCenteredTwoStageV4GenerativePlanSchema.safeParse(validAsk).success)
      .toBe(true);
    expect(eventCenteredTwoStageV4GenerativePlanSchema.safeParse({
      ...validAsk,
      questionIntent: { ...validAsk.questionIntent, gap: "你当时看到了什么？" }
    }).success).toBe(false);
    expect(eventCenteredTwoStageV4GenerativePlanSchema.safeParse({
      ...validAsk,
      questionIntent: { ...validAsk.questionIntent, gap: "回想当时发生的变化" }
    }).success).toBe(false);
    expect(eventCenteredTwoStageV4GenerativePlanSchema.safeParse({
      ...validAsk,
      limitReason: { kind: "no_safe_question", evidenceRefs: [] }
    }).success).toBe(false);
  });

  it("统一协议保留旧 decision/reply 兼容投影", () => {
    const parsed = eventCenteredGenerativeTurnSchema.parse(completionData());

    expect(parsed.semanticPlan).toMatchObject({
      action: "complete",
      insightKind: "connection"
    });
    expect(parsed.decision).toMatchObject({
      turnAction: "complete",
      outcomeCandidate: {
        statement: "演出已经结束，卸妆后才松开牙关。"
      }
    });
    expect(parsed.visibleTurn.thinkingSummary).toBeNull();
    expect(parsed.reply.naturalUnderstanding).toBe("");
  });

  it.each([
    ["relationship_interaction", "event_detail"],
    ["offer", "event_detail"],
    ["feeling", "inner_experience"],
    ["reaction", "inner_experience"],
    ["judgment", "stated_interpretation"],
    ["expectation", "stated_preference"]
  ])("协议边界把事实类型同义值 %s 归一为 %s", (sourceKind, expectedKind) => {
    const input = structuredClone(completionData());
    input.understanding.factDeltas[0]!.kind = sourceKind;

    const parsed = eventCenteredGenerativeTurnSchema.parse(input);

    expect(parsed.understanding.factDeltas[0]?.kind).toBe(expectedKind);
  });

  it.each([
    ["current_event | background", "current_event"],
    ["single", "current_event"],
    ["背景", "background"]
  ])("协议把事实范围同义值 %s 归一为 %s", (sourceScope, expectedScope) => {
    const input = structuredClone(completionData());
    input.understanding.factDeltas[0]!.scope = sourceScope;

    const parsed = eventCenteredGenerativeTurnSchema.parse(input);

    expect(parsed.understanding.factDeltas[0]?.scope).toBe(expectedScope);
  });

  it.each([
    ["positive", "affirmed"],
    ["negative", "affirmed"],
    ["neutral", "affirmed"],
    ["denied", "denied"],
    ["uncertain", "unknown"],
    ["unclear", "unknown"],
    ["不确定", "unknown"]
  ])("协议把事实立场同义值 %s 归一为 %s", (sourceStance, expectedStance) => {
    const input = structuredClone(completionData());
    input.understanding.factDeltas[0]!.stance = sourceStance;

    const parsed = eventCenteredGenerativeTurnSchema.parse(input);

    expect(parsed.understanding.factDeltas[0]?.stance).toBe(expectedStance);
  });

  it.each([
    ["still_missing", "needs_more"],
    ["missing", "needs_more"],
    ["outcome_ready", "ready"],
    ["user_articulated", "ready"],
    ["ai_synthesized", "ready"],
    ["insufficient", "limited"]
  ])("Provider 成果状态同义值 %s 会归一为 %s", (sourceState, expectedState) => {
    const input = structuredClone(
      sourceState === "still_missing" || sourceState === "missing"
        ? askData()
        : completionData()
    );
    Reflect.deleteProperty(input.semanticPlan, "realizationContract");
    Reflect.deleteProperty(input.semanticPlan, "microgoalDelta");
    input.semanticPlan.outcomeAssessment.state = sourceState;

    const parsed = eventCenteredProviderGenerativeTurnSchema.parse(input);

    expect(parsed.semanticPlan.outcomeAssessment?.state).toBe(expectedState);
  });

  it("旧格式输入仍可迁移到统一协议", () => {
    const canonical = eventCenteredGenerativeTurnSchema.parse(completionData());
    const migrated = eventCenteredGenerativeTurnSchema.parse({
      understanding: canonical.understanding,
      decision: canonical.decision,
      reply: canonical.reply
    });

    expect(migrated.semanticPlan.action).toBe("complete");
    expect(migrated.visibleTurn.responseKind).toBe("completion");
    expect(migrated.visibleTurn.insight).toBe(canonical.decision.outcomeCandidate?.statement);
    expect(migrated.visibleTurn.thinkingSummary).toBeNull();
    expect(migrated.reply.naturalUnderstanding).toBe(
      canonical.decision.outcomeCandidate?.statement
    );
  });

  it("提问轮必须有思路摘要，停止轮固定为空", () => {
    const asking = eventCenteredGenerativeTurnSchema.parse(askData());
    asking.visibleTurn.thinkingSummary = null;
    const askingResult = validate(asking, {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "thought"
    });
    const completing = eventCenteredGenerativeTurnSchema.parse(completionData());

    expect(askingResult.issues).toContain("ask_requires_thinking_summary");
    expect(completing.visibleTurn.thinkingSummary).toBeNull();
    expect(validate(completing).issues).not.toContain("stop_action_must_not_have_thinking_summary");
  });

  it("新协议必须显式提供用户可见表达契约", () => {
    const input = structuredClone(completionData());
    Reflect.deleteProperty(input.semanticPlan, "realizationContract");

    expect(eventCenteredGenerativeTurnSchema.safeParse(input).success).toBe(false);
  });

  it("一次调用 Provider 无需生成系统兼容字段", () => {
    const input = structuredClone(completionData());
    Reflect.deleteProperty(input.semanticPlan, "realizationContract");
    Reflect.deleteProperty(input.semanticPlan, "microgoalDelta");

    const parsed = eventCenteredProviderGenerativeTurnSchema.parse(input);

    expect(parsed.semanticPlan).not.toHaveProperty("realizationContract");
    expect(parsed.semanticPlan).not.toHaveProperty("microgoalDelta");
  });

  it("一次调用 Provider 的新回合动作列表不再包含 test_understanding", () => {
    const input = structuredClone(askData());
    Reflect.deleteProperty(input.semanticPlan, "realizationContract");
    Reflect.deleteProperty(input.semanticPlan, "microgoalDelta");
    input.semanticPlan.cognitiveAction = "test_understanding";

    expect(eventCenteredProviderGenerativeTurnSchema.safeParse(input).success).toBe(false);
  });

  it("系统派生的成果与微目标兼容字段最多保留六条证据", () => {
    const input = structuredClone(completionData());
    input.semanticPlan.evidenceRefs = Array.from({ length: 8 }, (_, index) => `fact-${index + 1}`);

    const parsed = eventCenteredGenerativeTurnSchema.parse(input);

    expect(parsed.decision.outcomeCandidate?.supportEvidenceRefs).toHaveLength(6);
  });

  it("摘要锚点至少两个字，单字代词不能绕过语义绑定", () => {
    const input = structuredClone(completionData());
    input.semanticPlan.realizationContract.summaryAnchors = ["我"];
    const turn = eventCenteredGenerativeTurnSchema.parse(input);

    expect(validate(turn).issues).toContain("summary_anchor_required");
  });

  it("语义计划会丢弃额外的无效短锚点，并保留可用证据", () => {
    const input = structuredClone(completionData());
    input.semanticPlan.realizationContract.summaryAnchors = [
      "演出已经结束",
      "我",
      " 。 ",
      "松开牙关"
    ];

    const parsed = eventCenteredGenerativePlanSchema.parse({
      understanding: input.understanding,
      semanticPlan: input.semanticPlan
    });

    expect(parsed.semanticPlan.realizationContract.summaryAnchors).toEqual([
      "演出已经结束",
      "松开牙关"
    ]);
  });

  it("标点不计入摘要锚点的有效长度", () => {
    const input = structuredClone(completionData());
    input.semanticPlan.realizationContract.summaryAnchors = ["演。"];
    const turn = eventCenteredGenerativeTurnSchema.parse(input);

    expect(validate(turn).issues).toContain("summary_anchor_required");
  });

  it("摘要自然改写时保留任一连续两字证据片段即可通过绑定", () => {
    const turn = anchorParaphraseData("手抖、肩膀紧绷，喝完水才放松。");
    const result = validate(turn, {
      rawText: "手还在抖，肩膀也一直耸着，喝完水才松下来。"
    });

    expect(result.issues).not.toContain("thinking_summary_must_cover_frozen_anchor");
  });

  it("与当前理解方向无关的摘要报告方向错配", () => {
    const turn = anchorParaphraseData("今天的天气很好，适合出去散步。");
    const result = validate(turn, {
      rawText: "手还在抖，肩膀也一直耸着，喝完水才松下来。"
    });

    expect(result.issues).toContain("thinking_summary_direction_mismatch");
  });

  it("摘要引用真实事实但转向其他主题时单独报告方向错配", () => {
    const turn = eventCenteredGenerativeTurnSchema.parse(askData());
    turn.visibleTurn.thinkingSummary =
      "评审接受了提案，这一事实关系到当天会议究竟开了多久。";
    const result = validate(turn, {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。"
    });

    expect(result.issues).not.toContain("thinking_summary_requires_traceable_fact_anchor");
    expect(result.issues).toContain("thinking_summary_direction_mismatch");
  });

  it("T-ASK 摘要使用另一条可追溯事实且保持目标方向时通过两项检查", () => {
    const turn = eventCenteredGenerativeTurnSchema.parse(askData());
    turn.understanding.factDeltas = [{
      statement: "用户认为开头太绕导致整份提案不专业，因为它在开头",
      scope: "current_event",
      stance: "affirmed",
      kind: "stated_interpretation",
      quote: "因为它就在开头。数据和结论他都说可以，可我一看到开头那句，还是觉得后面做得再好也救不回来。"
    }];
    turn.semanticPlan.evidenceRefs = ["new:1"];
    turn.semanticPlan.outcomeAssessment!.supportEvidenceRefs = ["new:1"];
    turn.semanticPlan.expectedUnderstandingDelta =
      "说清开头太绕具体破坏了哪条专业判断标准，以及为何代表整体专业性";
    turn.semanticPlan.realizationContract.responseCore =
      "开头太绕具体破坏了哪条专业判断标准";
    turn.semanticPlan.realizationContract.summaryAnchors = ["数据和结论他都说可以"];
    turn.visibleTurn.thinkingSummary =
      "你提到开头位置是关键，但‘太绕’具体破坏了哪条专业标准，还需要你再说说。";
    turn.visibleTurn.question =
      "开头太绕，具体破坏了哪条专业判断标准，让你觉得整份提案都不专业？";
    const result = validate(turn, {
      rawText: "因为它就在开头。数据和结论他都说可以，可我一看到开头那句，还是觉得后面做得再好也救不回来。"
    });

    expect(result.issues).not.toContain("thinking_summary_requires_traceable_fact_anchor");
    expect(result.issues).not.toContain("thinking_summary_direction_mismatch");
  });

  it("已问历史不关闭部分回答的当前目标", () => {
    const turn = eventCenteredGenerativeTurnSchema.parse(askData());
    turn.understanding.answerStatus = "partly_answered";
    const result = validate(turn, {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "thought",
      currentQuestionText: "那处格式错误具体是什么？",
      currentQuestionTarget: turn.semanticPlan.selectedTargetId,
      askedTargets: [turn.semanticPlan.selectedTargetId],
      answeredTargets: []
    });

    expect(result.issues).not.toContain("selected_target_already_closed");
    expect(result.issues).not.toContain("repeated_question");
  });

  it("已回答目标关闭后不能通过换问法重新打开", () => {
    const turn = eventCenteredGenerativeTurnSchema.parse(askData());
    turn.understanding.answerStatus = "partly_answered";
    const result = validate(turn, {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "thought",
      currentQuestionText: "那处格式错误具体是什么？",
      currentQuestionTarget: turn.semanticPlan.selectedTargetId,
      answeredTargets: [turn.semanticPlan.selectedTargetId]
    });

    expect(result.issues).toContain("selected_target_already_closed");
  });

  it("answered 只记录上一问状态，问停与成果来源由语义结果决定", () => {
    const asking = eventCenteredGenerativeTurnSchema.parse(askData());
    const askingResult = validate(asking, {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "thought",
      currentQuestionTarget: asking.semanticPlan.selectedTargetId
    });
    const completing = eventCenteredGenerativeTurnSchema.parse(completionData());
    const completingResult = validate(completing, {
      currentQuestionTarget: "body_change"
    });

    expect(askingResult.issues).not.toContain("answered_current_target_requires_stop");
    expect(completingResult.issues).not.toContain("answered_current_target_requires_stop");

    completing.semanticPlan.outcomeAssessment!.origin = "ai_synthesized";
    completing.semanticPlan.tentativeInterpretation = {
      statement: completing.visibleTurn.insight!,
      supportEvidenceRefs: ["new:1", "new:2"]
    };
    const synthesizedResult = validate(completing, {
      currentQuestionTarget: "body_change"
    });
    expect(synthesizedResult.issues).not.toContain(
      "answered_current_target_requires_stop"
    );
  });

  it("部分回答允许用更具体的缺口继续提问", () => {
    const turn = eventCenteredGenerativeTurnSchema.parse(askData());
    turn.understanding.answerStatus = "partly_answered";
    turn.semanticPlan.selectedTargetId = "新增的更深动机";
    const result = validate(turn, {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "thought",
      currentQuestionTarget: "单个错误代表整体失败的判断标准"
    });

    expect(result.issues).not.toContain("partly_answered_must_not_claim_user_articulated_outcome");
  });

  it("partly_answered 同样不替代成果来源判断", () => {
    const aiSynthesizedInput = eventCenteredGenerativeTurnSchema.parse(completionData());
    aiSynthesizedInput.understanding.answerStatus = "partly_answered";
    aiSynthesizedInput.semanticPlan.outcomeAssessment!.origin = "ai_synthesized";
    aiSynthesizedInput.semanticPlan.tentativeInterpretation = {
      statement: aiSynthesizedInput.visibleTurn.insight!,
      supportEvidenceRefs: ["new:1", "new:2"]
    };
    const aiSynthesized = validate(
      aiSynthesizedInput,
      { currentQuestionTarget: "body_change" }
    );
    const userArticulatedInput = eventCenteredGenerativeTurnSchema.parse(completionData());
    userArticulatedInput.understanding.answerStatus = "partly_answered";
    const userArticulated = validate(
      userArticulatedInput,
      { currentQuestionTarget: "body_change" }
    );

    expect(aiSynthesized.issues).not.toContain(
      "partly_answered_must_not_claim_user_articulated_outcome"
    );
    expect(userArticulated.issues).not.toContain(
      "partly_answered_must_not_claim_user_articulated_outcome"
    );
  });

  it("归一化后完全相同的问题会被硬拦截", () => {
    const turn = eventCenteredGenerativeTurnSchema.parse(askData());
    const result = validate(turn, {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "thought",
      currentQuestionText: "那处格式错误，为什么足以让你觉得整份提案都不行？",
      currentQuestionTarget: "另一个旧目标"
    });

    expect(result.issues).toContain("repeated_question");
  });

  it("同一目标下近乎逐字相同的问题会被硬拦截", () => {
    const turn = eventCenteredGenerativeTurnSchema.parse(askData());
    const result = validate(turn, {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "thought",
      currentQuestionText: "那处格式错误为什么会足以让你觉得整份提案都不行？",
      currentQuestionTarget: turn.semanticPlan.selectedTargetId
    });

    expect(result.issues).toContain("repeated_question");
  });

  it("用户明确拒绝的语义方向继续受到硬保护", () => {
    const turn = eventCenteredGenerativeTurnSchema.parse(askData());
    const result = validate(turn, {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "thought",
      deniedTargets: [turn.semanticPlan.selectedTargetId]
    });

    expect(result.issues).toContain("selected_target_already_closed");
  });

  it("纠正后的提问思路必须明确采纳纠正", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(askData());
    input.understanding.answerStatus = "correction";
    input.understanding.correctionOrBoundary = {
      kind: "correction",
      reason: "用户纠正了对介意点的理解"
    };
    input.understanding.factDeltas = [{
      statement: "用户介意的是未被提前告知",
      scope: "current_event",
      stance: "affirmed",
      kind: "stated_interpretation",
      quote: "我介意的是未被提前告知"
    }];
    input.semanticPlan.evidenceRefs = ["new:1"];
    input.semanticPlan.outcomeAssessment!.supportEvidenceRefs = ["new:1"];
    input.semanticPlan.realizationContract.summaryAnchors = ["未被提前告知"];
    input.visibleTurn.thinkingSummary = "你介意的是未被提前告知，这一点关系到你对合作边界的判断。";
    const turn = eventCenteredGenerativeTurnSchema.parse(input);
    const rawText = "你刚才理解错了，我介意的是未被提前告知。";

    expect(validate(turn, {
      rawText,
      angle: "thought",
      correctionDetected: true
    }).issues).toContain("thinking_summary_must_acknowledge_correction");

    turn.visibleTurn.thinkingSummary =
      "刚才的理解需要改掉：你介意的是未被提前告知，这一点关系到你对合作边界的判断。";
    expect(validate(turn, {
      rawText,
      angle: "thought",
      correctionDetected: true
    }).issues).not.toContain("thinking_summary_must_acknowledge_correction");
  });

  it("动作播报、空泛价值和思路问题重复感进入质量诊断", () => {
    const input = askData();
    input.visibleTurn.thinkingSummary =
      "评审接受了提案，这一点很重要；我接下来想继续确认这个问题。";
    const result = validate(eventCenteredGenerativeTurnSchema.parse(input), {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "thought"
    });
    const partitioned = partitionEventCenteredGenerativeValidationIssues(result.issues);

    expect(partitioned.qualityDiagnostics).toContain(
      "thinking_summary_describes_next_action"
    );
    expect(partitioned.qualityDiagnostics).toContain(
      "thinking_summary_value_is_generic"
    );
    expect(partitioned.hardIssues).not.toContain(
      "thinking_summary_describes_next_action"
    );
  });

  it("主意思遗漏并存范围并写成排他关系时进入质量评审", () => {
    const input = completionData();
    input.semanticPlan.activeAngle = "relationship";
    input.semanticPlan.insightKind = "distinction";
    input.semanticPlan.expectedUnderstandingDelta =
      "帮拿快递本身可以接受，真正介意的是未经询问就替自己答应";
    input.semanticPlan.realizationContract = {
      responseCore: "帮拿快递本身可以接受，介意的是未经询问就替自己答应",
      summaryAnchors: ["帮拿快递本身可以接受", "没有先问就替我答应"]
    };
    input.understanding.factDeltas = [
      {
        statement: "帮拿快递本身可以接受",
        scope: "current_event",
        stance: "affirmed",
        kind: "stated_preference",
        quote: "帮拿快递本身可以接受"
      },
      {
        statement: "室友没有先问就替用户答应",
        scope: "current_event",
        stance: "affirmed",
        kind: "event_detail",
        quote: "没有先问就替我答应"
      }
    ];
    input.visibleTurn.insight = "你介意的不是帮拿快递，而是她没有先问就替你答应。";
    const result = validate(eventCenteredGenerativeTurnSchema.parse(input), {
      rawText: "帮拿快递本身可以接受，我介意的是她没有先问就替我答应。",
      angle: "relationship"
    });
    const partitioned = partitionEventCenteredGenerativeValidationIssues(result.issues);

    expect(partitioned.qualityDiagnostics).toContain(
      "visible_turn_must_not_erase_coexisting_evidence"
    );
    expect(partitioned.hardIssues).not.toContain(
      "visible_turn_must_not_erase_coexisting_evidence"
    );
  });

  it("四类动作只允许对应的用户可见回应", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(askData());
    input.visibleTurn.responseKind = "completion";
    input.visibleTurn.question = null;
    input.visibleTurn.insight = "这里出现了一条未经动作允许的阶段性认识。";
    const turn = eventCenteredGenerativeTurnSchema.parse(input);

    expect(validate(turn, {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "thought"
    }).issues).toContain("ask_visible_turn_shape_mismatch");
  });

  it("用户边界和三问上限阻止继续提问", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(askData());
    input.understanding.answerStatus = "declined";
    input.understanding.correctionOrBoundary = {
      kind: "boundary",
      reason: "用户要求停止"
    };
    const turn = eventCenteredGenerativeTurnSchema.parse(input);
    const result = validate(turn, {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "thought",
      boundaryDetected: true,
      guidedQuestionOpportunityCount: 3
    });

    expect(result.issues).toContain("user_boundary_must_stop_questioning");
    expect(result.issues).toContain("guided_question_limit_reached");
  });

  it("拦截抽象分析问题和用户可见的内部流程话", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(askData());
    input.semanticPlan.selectedTargetId = "这些经历意味着什么";
    input.semanticPlan.realizationContract.responseCore = "这些经历对你意味着什么";
    input.visibleTurn.question = "这些经历对你意味着什么？";
    input.visibleTurn.thinkingSummary = "我理解这是身体对压力的延迟反应，似乎还有别的原因；当前目标已经有证据，我会继续推进。";
    const result = validate(eventCenteredGenerativeTurnSchema.parse(input), {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "thought"
    });

    expect(result.issues).toContain("question_uses_abstract_analysis_language");
    expect(result.issues).toContain("visible_turn_exposes_internal_process");
    expect(result.issues).toContain("thinking_summary_adds_unsupported_interpretation");
    expect(result.issues).toContain(
      "thinking_summary_tentative_requires_structured_hypothesis"
    );
  });

  it("关系深聊拦截缺少具体落点的大问题", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(askData());
    input.semanticPlan.activeAngle = "relationship";
    input.semanticPlan.selectedTargetId = "relationship_boundary_feeling";
    input.semanticPlan.realizationContract.responseCore = "这些安排怎样改变你对关系边界的感受";
    input.visibleTurn.question = "这些安排怎样改变你对关系边界的感受？";
    const result = validate(eventCenteredGenerativeTurnSchema.parse(input), {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "relationship",
      phase: "deep_companionship"
    });

    expect(result.issues).toContain("relationship_question_is_too_abstract_to_answer");
  });

  it("提问不预先声称成果类型，完成和暂停必须标明已形成的成果类型", () => {
    const asking = eventCenteredGenerativeTurnSchema.parse(askData());
    asking.semanticPlan.insightKind = "meaning";
    expect(validate(eventCenteredGenerativeTurnSchema.parse(asking), {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "thought"
    }).issues).toContain("ask_must_not_claim_insight_kind");

    const completing = eventCenteredGenerativeTurnSchema.parse(completionData());
    completing.semanticPlan.insightKind = null;
    expect(validate(eventCenteredGenerativeTurnSchema.parse(completing)).issues).toContain(
      "insight_action_requires_insight_kind"
    );
  });

  it("事实摘录和证据编号必须可追溯", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(askData());
    input.semanticPlan.evidenceRefs = ["missing", "new:2"];
    const turn = eventCenteredGenerativeTurnSchema.parse(input);
    const result = validate(turn, {
      rawText: "原话并未包含模型填写的摘录。",
      angle: "thought"
    });

    expect(result.issues).toContain("fact_quote_not_in_current_turn");
    expect(result.issues).toContain("decision:unknown_evidence:missing");
  });

  it("新版本不再用确认式问题承载试探解释", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(askData());
    input.semanticPlan.cognitiveAction = "test_understanding";
    input.semanticPlan.tentativeInterpretation = {
      statement: "你可能把局部失误当成了整体能力的证明。",
      supportEvidenceRefs: ["new:1", "missing"]
    };
    const turn = eventCenteredGenerativeTurnSchema.parse(input);
    const result = validate(turn, {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "thought"
    });

    expect(result.issues).toContain("hypothesis:unknown_evidence:missing");
    expect(result.issues).toContain("tentative_interpretation_requires_insight_stop");
    expect(result.issues).toContain("test_understanding_is_legacy_only");
  });

  it("AI 直接综合理解时至少引用两条证据，用户可见回应可以使用自然确定句", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(completionData());
    input.semanticPlan.outcomeAssessment!.origin = "ai_synthesized";
    input.semanticPlan.tentativeInterpretation = {
      statement: "演出先结束，身体到卸妆后才结束那份紧绷。",
      supportEvidenceRefs: ["new:1", "new:2"]
    };
    input.visibleTurn.insight = "演出先结束，身体到卸妆后才结束那份紧绷。";
    input.semanticPlan.realizationContract.responseCore = "演出先结束身体到卸妆后才结束紧绷";
    const valid = validate(eventCenteredGenerativeTurnSchema.parse(input));
    expect(valid.issues).not.toContain("ai_synthesized_outcome_requires_two_evidence_refs");
    expect(valid.issues).not.toContain("visible_insight_must_preserve_tentative_interpretation");

    input.semanticPlan.outcomeAssessment!.supportEvidenceRefs = ["new:1"];
    expect(validate(eventCenteredGenerativeTurnSchema.parse(input)).issues).toContain(
      "ai_synthesized_outcome_requires_two_evidence_refs"
    );
  });

  it("AI 综合阻断重复引用和指向同一内容的伪双证据", () => {
    const duplicatedRefs = eventCenteredGenerativeTurnSchema.parse(completionData());
    duplicatedRefs.semanticPlan.outcomeAssessment!.origin = "ai_synthesized";
    duplicatedRefs.semanticPlan.outcomeAssessment!.supportEvidenceRefs = [
      "new:1",
      "new:1"
    ];
    duplicatedRefs.semanticPlan.evidenceRefs = ["new:1", "new:1"];
    duplicatedRefs.semanticPlan.tentativeInterpretation = {
      statement: "演出先结束，身体随后才松开。",
      supportEvidenceRefs: ["new:1", "new:1"]
    };

    const duplicatedRefResult = validate(duplicatedRefs);
    expect(duplicatedRefResult.issues).toContain(
      "outcome_assessment_duplicate_evidence_refs"
    );
    expect(duplicatedRefResult.issues).toContain("decision_duplicate_evidence_refs");
    expect(duplicatedRefResult.issues).toContain(
      "tentative_interpretation_duplicate_evidence_refs"
    );
    expect(duplicatedRefResult.issues).toContain(
      "ai_synthesized_outcome_requires_two_evidence_refs"
    );

    const duplicatedStatements = eventCenteredGenerativeTurnSchema.parse(completionData());
    duplicatedStatements.understanding.factDeltas[1]!.statement = "演出已经结束";
    duplicatedStatements.semanticPlan.outcomeAssessment!.origin = "ai_synthesized";
    duplicatedStatements.semanticPlan.tentativeInterpretation = {
      statement: "演出先结束，身体随后才松开。",
      supportEvidenceRefs: ["new:1", "new:2"]
    };

    expect(validate(duplicatedStatements).issues).toContain(
      "ai_synthesized_outcome_requires_distinct_evidence"
    );
  });

  it("第三次正式问题后仍允许一次同目标 concrete_anchor 修复", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(askData());
    input.understanding.answerStatus = "unknown";
    input.semanticPlan.cognitiveAction = "anchor_specific";
    const target = input.semanticPlan.selectedTargetId;

    const allowed = validate(input, {
      currentQuestionTarget: target,
      guidedQuestionOpportunityCount: 3,
      allowQuestionLimitRepair: true
    });
    expect(allowed.issues).not.toContain("guided_question_limit_reached");

    const exhausted = validate(input, {
      currentQuestionTarget: target,
      guidedQuestionOpportunityCount: 3,
      allowQuestionLimitRepair: false
    });
    expect(exhausted.issues).toContain("guided_question_limit_reached");

    input.semanticPlan.microgoalDelta = {
      operation: "continue",
      statement: "沿同一目标回到具体时刻",
      supportEvidenceRefs: input.semanticPlan.evidenceRefs
    };
    const deepAllowed = validate(input, {
      phase: "deep_companionship",
      currentQuestionTarget: target,
      microgoalQuestionCount: 3,
      allowQuestionLimitRepair: true
    });
    expect(deepAllowed.issues).not.toContain("microgoal_question_limit_reached");
  });

  it("感受角度允许身体信号就地自然化，新增未表达关系仍阻断用户成果", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(completionData());
    input.understanding.factDeltas = [
      {
        statement: "手一直发抖",
        scope: "current_event",
        stance: "affirmed",
        kind: "inner_experience",
        quote: "手一直发抖"
      },
      {
        statement: "肩膀一直绷着",
        scope: "current_event",
        stance: "affirmed",
        kind: "inner_experience",
        quote: "肩膀一直绷着"
      }
    ];
    input.semanticPlan.expectedUnderstandingDelta =
      "手抖和肩膀绷紧表现出当时很紧张";
    input.semanticPlan.realizationContract.responseCore =
      "手一直发抖肩膀一直绷着当时很紧张";
    input.semanticPlan.realizationContract.summaryAnchors = [
      "手一直发抖",
      "肩膀一直绷着"
    ];
    input.visibleTurn.insight = "手一直发抖、肩膀一直绷着，当时很紧张。";

    const naturalized = validate(input, {
      rawText: "手一直发抖，肩膀一直绷着。",
      angle: "feeling"
    });
    expect(naturalized.issues).not.toContain(
      "user_articulated_origin_adds_unstated_relation"
    );

    input.semanticPlan.realizationContract.responseCore =
      "手一直发抖是因为害怕失败";
    input.visibleTurn.insight = "手一直发抖，是因为害怕失败。";
    const unsupportedCause = validate(input, {
      rawText: "手一直发抖，肩膀一直绷着。",
      angle: "feeling"
    });
    expect(unsupportedCause.issues).toContain(
      "user_articulated_origin_adds_unstated_relation"
    );
  });

  it("用户明确表达事件对体验的作用时，允许有限关系别名自然改写", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(completionData());
    input.understanding.factDeltas = [
      {
        statement: "他的反应放大了我的怨气和愤怒",
        scope: "current_event",
        stance: "affirmed",
        kind: "stated_interpretation",
        quote: "他的反应放大了我的怨气和愤怒"
      }
    ];
    input.semanticPlan.evidenceRefs = ["new:1"];
    input.semanticPlan.outcomeAssessment!.supportEvidenceRefs = ["new:1"];
    input.semanticPlan.realizationContract.responseCore =
      "他的反应让你的愤怒变得更强烈";
    input.semanticPlan.realizationContract.summaryAnchors = ["他的反应"];
    input.visibleTurn.insight = "他的反应让你的愤怒变得更强烈。";

    const result = validate(input, {
      rawText: "他的反应放大了我的怨气和愤怒。"
    });
    expect(result.issues).not.toContain(
      "user_articulated_origin_adds_unstated_relation"
    );
  });

  it("用户明确呈现取舍时，允许用并存语义自然整理两侧", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(completionData());
    input.understanding.factDeltas = [{
      statement: "愿意继续用这个办法",
      scope: "current_event",
      stance: "affirmed",
      kind: "event_detail",
      quote: "我愿意继续用这个办法"
    }, {
      statement: "需要给重要的人留紧急联系的方式",
      scope: "current_event",
      stance: "affirmed",
      kind: "stated_preference",
      quote: "但需要给重要的人留一个紧急联系的方式"
    }];
    input.semanticPlan.evidenceRefs = ["new:1", "new:2"];
    input.semanticPlan.outcomeAssessment!.supportEvidenceRefs = ["new:1", "new:2"];
    input.semanticPlan.realizationContract.responseCore =
      "愿意继续用这个办法，同时需要给重要的人保留紧急联系的方式";
    input.semanticPlan.realizationContract.summaryAnchors = ["继续用这个办法"];
    input.visibleTurn.insight =
      "你愿意继续用这个办法，同时需要给重要的人保留紧急联系的方式。";

    const result = validate(input, {
      rawText: "我愿意继续用这个办法，但需要给重要的人留一个紧急联系的方式。",
      angle: "action"
    });
    expect(result.issues).not.toContain(
      "user_articulated_origin_adds_unstated_relation"
    );
  });

  it("用户成果的空泛收益与判断加强进入质量诊断", () => {
    const input = completionData();
    input.understanding.factDeltas[0]!.statement = "选择这趟车有依据";
    input.understanding.factDeltas[0]!.quote = "选择这趟车有依据";
    input.understanding.factDeltas[1]!.statement = "坏结果不等于坏决定";
    input.understanding.factDeltas[1]!.quote = "坏结果不等于坏决定";
    input.semanticPlan.realizationContract.summaryAnchors = [
      "选择这趟车有依据",
      "坏结果不等于坏决定"
    ];
    input.semanticPlan.realizationContract.responseCore =
      "当时的选择是合理的这让你能更准确地评估自己";
    input.visibleTurn.insight =
      "当时的选择是合理的，这让你能更准确地评估自己。";
    const result = validate(eventCenteredGenerativeTurnSchema.parse(input), {
      rawText: "选择这趟车有依据，坏结果不等于坏决定。",
      existingFactStatements: []
    });
    const partitioned = partitionEventCenteredGenerativeValidationIssues(result.issues);

    expect(partitioned.qualityDiagnostics).toContain(
      "user_articulated_outcome_strengthens_judgment"
    );
    expect(partitioned.qualityDiagnostics).toContain(
      "user_articulated_outcome_adds_generic_benefit"
    );
  });

  it("提问思路层不能提前植入动机，原因问题必须带具体锚点", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(askData());
    input.visibleTurn.thinkingSummary =
      "你其实是在保护自己的专业形象，我想顺着这个动机继续看。";
    input.semanticPlan.realizationContract.responseCore = "为什么会这样";
    input.visibleTurn.question = "为什么会这样？";
    const result = validate(input, {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "thought"
    });
    const partitioned = partitionEventCenteredGenerativeValidationIssues(result.issues);

    expect(partitioned.qualityDiagnostics).toContain(
      "thinking_summary_introduces_unconfirmed_motive"
    );
    expect(partitioned.qualityDiagnostics).toContain(
      "reason_question_requires_concrete_anchor"
    );
  });

  it("AI 综合的人格、长期模式和他人动机属于单例阻断", () => {
    const personalityInput = eventCenteredGenerativeTurnSchema.parse(completionData());
    personalityInput.semanticPlan.outcomeAssessment!.origin = "ai_synthesized";
    personalityInput.semanticPlan.tentativeInterpretation = {
      statement: "这说明你一直以来都有回避型人格。",
      supportEvidenceRefs: ["new:1", "new:2"]
    };
    personalityInput.semanticPlan.realizationContract.responseCore =
      "这说明你一直以来都有回避型人格";
    personalityInput.visibleTurn.insight = "这说明你一直以来都有回避型人格。";
    expect(validate(personalityInput).issues)
      .toContain("ai_synthesized_outcome_overreaches_personality_or_long_term");

    const motiveInput = eventCenteredGenerativeTurnSchema.parse(completionData());
    motiveInput.semanticPlan.activeAngle = "relationship";
    motiveInput.semanticPlan.outcomeAssessment!.origin = "ai_synthesized";
    motiveInput.semanticPlan.tentativeInterpretation = {
      statement: "同事故意想让你退出讨论。",
      supportEvidenceRefs: ["new:1", "new:2"]
    };
    motiveInput.semanticPlan.realizationContract.responseCore =
      "同事故意想让你退出讨论";
    motiveInput.visibleTurn.insight = "同事故意想让你退出讨论。";
    expect(validate(motiveInput, {
      angle: "relationship"
    }).issues).toContain("ai_synthesized_outcome_asserts_other_person_motive");
  });

  it("诚实收束只能说明当前范围", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(completionData());
    input.semanticPlan.action = "honest_limit";
    input.semanticPlan.outcomeAssessment = {
      state: "limited",
      origin: null,
      basis: "当前材料只能确认事件已经结束",
      supportEvidenceRefs: ["new:1"],
      missingUnderstanding: null
    };
    input.semanticPlan.insightKind = "connection";
    input.semanticPlan.evidenceRefs = [];
    input.semanticPlan.stopReason = "材料有限";
    input.visibleTurn = {
      thinkingSummary: null,
      responseKind: "honest_limit",
      question: null,
      insight: null,
      honestLimit: "更多原因暂时还不清楚。"
    };
    const turn = eventCenteredGenerativeTurnSchema.parse(input);

    expect(validate(turn).issues).toContain("honest_limit_requires_scope_only");
  });

  it("完成或暂停的认识至少引用一个有效锚点", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(completionData());
    input.semanticPlan.action = "pause";
    input.semanticPlan.evidenceRefs = [];
    input.semanticPlan.stopReason = "当前微目标已经形成进展";
    input.semanticPlan.microgoalDelta = {
      operation: "complete",
      statement: "区分事件结束和身体结束",
      supportEvidenceRefs: []
    };
    input.visibleTurn.responseKind = "pause";
    expect(validate(input, { phase: "deep_companionship" }).issues).toContain(
      "insight_requires_evidence"
    );
  });

  it("深聊回答具体锚点后可以直接形成当前证据关系", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(completionData());
    input.understanding.factDeltas = input.understanding.factDeltas.map((fact) => ({
      ...fact,
      kind: "event_detail"
    }));
    input.semanticPlan.action = "pause";
    input.semanticPlan.stopReason = "当前微目标已经形成进展";
    input.semanticPlan.microgoalDelta = {
      operation: "complete",
      statement: "区分事件结束和身体结束",
      supportEvidenceRefs: ["new:1", "new:2"]
    };
    input.visibleTurn.responseKind = "pause";
    expect(validate(input, {
      phase: "deep_companionship",
      currentQuestionCognitiveAction: "anchor_specific"
    }).issues).not.toContain("deep_anchor_evidence_requires_cognitive_advance");
    expect(validate(input, {
      phase: "guided_reflection",
      currentQuestionCognitiveAction: "anchor_specific"
    }).issues).not.toContain("deep_anchor_evidence_requires_cognitive_advance");
  });

  it("深聊尚未完成一轮有效问答时禁止直接形成成果", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(completionData());
    input.semanticPlan.action = "pause";
    input.semanticPlan.progressAssessment = "user_new_understanding";
    input.semanticPlan.stopReason = "已经形成新的区分";
    input.visibleTurn.responseKind = "pause";

    const result = validate(input, {
      phase: "deep_companionship",
      deepQuestionAnswerCount: 0,
      currentQuestionTarget: null,
      priorAngleOutcomeStatement: "进入深聊前只看见了紧张"
    });

    expect(result.issues).toContain("deep_outcome_requires_completed_question_answer");
  });

  it("深聊完成一轮有效问答并形成新增认识后允许暂停", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(completionData());
    input.semanticPlan.action = "pause";
    input.semanticPlan.progressAssessment = "user_new_understanding";
    input.semanticPlan.stopReason = "已经形成新的区分";
    input.visibleTurn.responseKind = "pause";

    const result = validate(input, {
      phase: "deep_companionship",
      deepQuestionAnswerCount: 0,
      currentQuestionTarget: "body_release_change",
      priorAngleOutcomeStatement: "进入深聊前只看见了紧张"
    });

    expect(result.issues).not.toContain("deep_outcome_requires_completed_question_answer");
    expect(result.issues).not.toContain("deep_pause_requires_substantive_progress");
  });

  it("深聊只有新增事实或复述时继续保持开放", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(completionData());
    input.semanticPlan.action = "pause";
    input.semanticPlan.progressAssessment = "no_increment";
    input.semanticPlan.stopReason = "暂时停止";
    input.visibleTurn.responseKind = "pause";

    const result = validate(input, {
      phase: "deep_companionship",
      deepQuestionAnswerCount: 1,
      currentQuestionTarget: "body_release_change",
      priorAngleOutcomeStatement: "进入深聊前只看见了紧张"
    });

    expect(result.issues).toContain("deep_pause_requires_substantive_progress");
  });

  it("深聊结果重复进入深聊前成果时无法冒充认识增量", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(completionData());
    input.semanticPlan.action = "pause";
    input.semanticPlan.progressAssessment = "user_new_understanding";
    input.semanticPlan.stopReason = "已经形成新的区分";
    input.visibleTurn.responseKind = "pause";

    const result = validate(input, {
      phase: "deep_companionship",
      deepQuestionAnswerCount: 1,
      currentQuestionTarget: "body_release_change",
      priorAngleOutcomeStatement: input.visibleTurn.insight
    });

    expect(result.issues).toContain("deep_outcome_repeats_prior_angle_outcome");
  });

  it("AI 综合形成新关系时只展示新增关系，不再次展示旧成果", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(completionData());
    input.semanticPlan.action = "pause";
    input.semanticPlan.progressAssessment = "ai_new_relation";
    input.semanticPlan.outcomeAssessment!.origin = "ai_synthesized";
    input.semanticPlan.stopReason = "两条证据形成新的关系";
    input.visibleTurn.responseKind = "pause";
    input.visibleTurn.insight = "进入深聊前只看见了紧张；现在还能看见身体放松晚于事件结束。";

    const result = validate(input, {
      phase: "deep_companionship",
      deepQuestionAnswerCount: 1,
      currentQuestionTarget: "body_release_change",
      priorAngleOutcomeStatement: "进入深聊前只看见了紧张"
    });

    expect(result.issues).toContain("deep_ai_synthesis_restates_prior_outcome");
  });

  it("行动未来计划与关系他人动机继续作为产品硬边界", () => {
    const actionInput = eventCenteredGenerativeTurnSchema.parse(askData());
    actionInput.semanticPlan.activeAngle = "action";
    actionInput.semanticPlan.selectedTargetId = "下一次行动计划";
    actionInput.visibleTurn.question = "下次你准备怎么做？";
    const actionResult = validate(eventCenteredGenerativeTurnSchema.parse(actionInput), {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "action"
    });
    expect(actionResult.issues).toContain("action_mvp_excludes_future_planning");

    const relationshipInput = eventCenteredGenerativeTurnSchema.parse(completionData());
    relationshipInput.semanticPlan.activeAngle = "relationship";
    relationshipInput.visibleTurn.insight = "这说明他故意想用这件事控制你。";
    const relationshipResult = validate(
      eventCenteredGenerativeTurnSchema.parse(relationshipInput),
      { angle: "relationship" }
    );
    expect(relationshipResult.issues).toContain("relationship_must_not_assert_other_motive");
  });

  it("语义计划角度必须与当前活动角度一致", () => {
    const turn = eventCenteredGenerativeTurnSchema.parse(askData());
    const result = validate(turn, {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "relationship"
    });

    expect(result.issues).toContain("semantic_plan_angle_mismatch");
  });

  it("最终问题偏离短回应核心时进入质量诊断", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(askData());
    input.visibleTurn.question = "这件事发生时，你的肩膀哪里最紧？";
    const turn = eventCenteredGenerativeTurnSchema.parse(input);
    const result = validate(turn, {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "thought"
    });

    const partitioned = partitionEventCenteredGenerativeValidationIssues(result.issues);
    expect(partitioned.hardIssues).not.toContain(
      "visible_response_must_preserve_response_core"
    );
    expect(partitioned.qualityDiagnostics).toContain(
      "visible_response_must_preserve_response_core"
    );
  });

  it("停止类主回应必须是陈述句", () => {
    const input = completionData();
    input.semanticPlan.realizationContract.responseCore = "接下来怎样判断自己";
    input.visibleTurn.insight = "接下来怎样判断自己。";
    const result = validate(eventCenteredGenerativeTurnSchema.parse(input));

    expect(result.issues).toContain("insight_must_be_declarative");
  });

  it("陈述句内部包含‘怎么用’时仍按成果陈述处理", () => {
    const input = completionData();
    input.semanticPlan.realizationContract.responseCore =
      "支持和控制的区别在于最后谁来决定钱怎么用";
    input.visibleTurn.insight =
      "支持和控制的区别在于最后谁来决定钱怎么用。";
    const result = validate(eventCenteredGenerativeTurnSchema.parse(input), {
      rawText: "支持和控制的区别在于最后谁来决定钱怎么用。"
    });

    expect(result.issues).not.toContain("insight_must_be_declarative");
  });

  it("成果不能只把内部认识分类写给用户", () => {
    const input = completionData();
    input.semanticPlan.realizationContract.responseCore = "这两件事形成关系张力";
    input.visibleTurn.insight = "这两件事形成关系张力。";
    const result = validate(eventCenteredGenerativeTurnSchema.parse(input));

    expect(result.issues).toContain("insight_uses_label_instead_of_understanding");
  });

  it("成果中的明确内部综合层级作为客观硬错误阻断", () => {
    const input = completionData();
    input.semanticPlan.realizationContract.responseCore =
      "送来的帮助回应了事情层关系层仍缺少关注";
    input.visibleTurn.insight =
      "送来的帮助回应了事情层，关系层仍缺少关注。";
    const turn = eventCenteredGenerativeTurnSchema.parse(input);
    const result = validate(turn);
    const partitioned = partitionEventCenteredGenerativeValidationIssues(result.issues);

    expect(result.issues).toContain("visible_turn_uses_internal_synthesis_labels");
    expect(partitioned.hardIssues).toContain(
      "visible_turn_uses_internal_synthesis_labels"
    );
    expect(partitioned.qualityDiagnostics).not.toContain(
      "visible_turn_uses_internal_synthesis_labels"
    );
  });

  it("思路层以明确残句结束时作为客观硬错误阻断", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(askData());
    input.visibleTurn.thinkingSummary = "评审接受了提案，这一点在你看来";
    const result = validate(input, {
      rawText: "评审接受了提案，但一处格式错了，我就觉得整份都不行。",
      angle: "thought"
    });
    const partitioned = partitionEventCenteredGenerativeValidationIssues(result.issues);

    expect(partitioned.hardIssues).toContain("thinking_summary_is_incomplete_sentence");
    expect(partitioned.qualityDiagnostics).not.toContain(
      "thinking_summary_is_incomplete_sentence"
    );
  });

  it("思路层不能在说明提问理由时再次复述主问题目标", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(askData());
    input.semanticPlan.realizationContract.responseCore =
      "连续三晚先处理工作消息，你真正责怪自己的是哪一步";
    input.visibleTurn.thinkingSummary =
      "你连续三晚想打开课程，但每次都先处理工作消息。我想继续确认，你真正责怪自己的是哪一步。";
    input.visibleTurn.question =
      "连续三晚先处理工作消息，你真正责怪自己的是哪一步？";
    const result = validate(eventCenteredGenerativeTurnSchema.parse(input), {
      rawText: "连续三晚想打开课程，但每次都先处理工作消息。",
      angle: "thought"
    });

    expect(result.issues).toContain(
      "thinking_summary_must_not_repeat_question_target"
    );
  });

  it("思路已经给出正式问题答案时形成动作内容硬冲突", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(askData());
    input.understanding.answerStatus = "partly_answered";
    input.semanticPlan.outcomeAssessment!.missingUnderstanding =
      "结果确认与身体放松之间的先后关系";
    input.semanticPlan.expectedUnderstandingDelta =
      "理解结果确认与身体放松之间的先后关系";
    input.visibleTurn.thinkingSummary =
      "结果确认和身体放松之间似乎有一个先后顺序。";
    input.visibleTurn.question =
      "结果确认和身体放松之间，是先后发生还是有其他关系？";
    input.semanticPlan.realizationContract.responseCore =
      "结果确认和身体放松之间是什么关系";
    const result = validate(input, {
      rawText: "结果出来时身体还绷着，摘下夹子后才松开。",
      angle: "thought"
    });
    const partitioned = partitionEventCenteredGenerativeValidationIssues(result.issues);

    expect(partitioned.hardIssues).toContain(
      "ask_summary_already_answers_question"
    );
  });

  it("问题只再次询问已有可观察事实时形成动作内容硬冲突", () => {
    const input = eventCenteredGenerativeTurnSchema.parse(askData());
    input.understanding.answerStatus = "partly_answered";
    input.understanding.factDeltas = [
      {
        statement: "整理看板越来越清楚",
        scope: "current_event",
        stance: "affirmed",
        kind: "event_detail",
        quote: "看板越排越清楚"
      },
      {
        statement: "客户投诉一直压在最下面，到下班都没点开",
        scope: "current_event",
        stance: "affirmed",
        kind: "event_detail",
        quote: "投诉一直压在最下面，到下班都没点开"
      }
    ];
    input.semanticPlan.evidenceRefs = ["new:1", "new:2"];
    input.semanticPlan.outcomeAssessment!.supportEvidenceRefs = ["new:1", "new:2"];
    input.semanticPlan.outcomeAssessment!.missingUnderstanding =
      "整理带来的清晰与投诉未处理之间的关系";
    input.semanticPlan.expectedUnderstandingDelta =
      "连接整理带来的清晰与投诉未处理之间的关系";
    input.visibleTurn.thinkingSummary =
      "看板越来越清楚，投诉仍然留在最下面。这一点关系到清晰和实际推进是否一致。";
    input.visibleTurn.question = "那条投诉现在是什么状态？";
    input.semanticPlan.realizationContract.responseCore =
      "那条投诉现在是什么状态";
    const result = validate(input, {
      rawText: "看板越排越清楚，投诉一直压在最下面，到下班都没点开。",
      angle: "thought"
    });
    const partitioned = partitionEventCenteredGenerativeValidationIssues(result.issues);

    expect(partitioned.hardIssues).toContain(
      "ask_question_only_requests_known_fact"
    );
  });

  it.each(["outputShape", "responseContract", "result", "data"])(
    "兼容模型多余的 %s 外层包装并只保留正式结构",
    (wrapperKey) => {
      const parsed = eventCenteredGenerativeTurnSchema.parse({
        [wrapperKey]: completionData()
      });

      expect(parsed.semanticPlan.action).toBe("complete");
      expect(parsed.visibleTurn.responseKind).toBe("completion");
      expect(parsed).not.toHaveProperty(wrapperKey);
    }
  );

  it("回应核心允许插入自然连接表达并保持全部字符顺序", () => {
    const input = completionData();
    input.semanticPlan.realizationContract.responseCore = "身体紧绷持续到喝水后才放松";
    input.visibleTurn.insight =
      "汇报结束后身体紧绷并未立即消失，而是持续到喝水后才放松，形成了时间连接。";
    const result = validate(eventCenteredGenerativeTurnSchema.parse(input));

    expect(result.issues).not.toContain("visible_response_must_preserve_response_core");
  });

  it.each([
    ["否定持续", "身体紧绷没有持续到喝水后才放松。"],
    ["否定结果", "身体紧绷持续到喝水后才没有放松。"],
    ["状态顺序反转", "身体放松持续到喝水后才紧绷。"],
    ["遗漏核心字符", "身体紧绷一直到喝水后才放松。"]
  ])("回应核心在%s时失败", (_name, insight) => {
    const input = completionData();
    input.semanticPlan.realizationContract.responseCore = "身体紧绷持续到喝水后才放松";
    input.visibleTurn.insight = insight;
    const result = validate(eventCenteredGenerativeTurnSchema.parse(input));

    expect(result.issues).toContain("visible_response_must_preserve_response_core");
  });

  it("两段第一段只接受 understanding、decision 与 meaningCard", () => {
    const complete = completionData();
    const { tentativeInterpretation: _legacyInterpretation, ...understanding } =
      complete.understanding;
    void _legacyInterpretation;
    const parsed = eventCenteredTwoStageGenerativePlanSchema.parse({
      understanding,
      decision: {
        state: "ready",
        origin: "user_articulated",
        basis: "用户已经把事件结束与身体松开之间的时间差说清",
        missingUnderstanding: null,
        selectedTargetId: null,
        cognitiveAction: null,
        insightKind: "connection"
      },
      meaningCard: {
        main: {
          statement: "演出已经结束，身体到卸妆后才松开牙关",
          evidenceRefs: ["new:1", "new:2"]
        },
        necessaryScope: []
      }
    });

    expect(parsed.decision).toMatchObject({
      state: "ready",
      origin: "user_articulated"
    });
    expect(parsed.meaningCard.main?.evidenceRefs).toEqual(["new:1", "new:2"]);
    expect(parsed).not.toHaveProperty("semanticPlan");
    expect(parsed).not.toHaveProperty("visibleTurn");
    expect(eventCenteredTwoStageGenerativePlanSchema.safeParse({
      understanding,
      semanticPlan: complete.semanticPlan
    }).success).toBe(false);
  });

  it("两段第一段拒绝成果状态与来源互相冲突", () => {
    const complete = completionData();
    const { tentativeInterpretation: _legacyInterpretation, ...understanding } =
      complete.understanding;
    void _legacyInterpretation;
    expect(() => eventCenteredTwoStageGenerativePlanSchema.parse({
      understanding,
      decision: {
        state: "needs_more",
        origin: "ai_synthesized",
        basis: "仍缺一项只能由用户补充的认识",
        missingUnderstanding: "身体为什么晚于事件结束才放松",
        selectedTargetId: "body_release_delay",
        cognitiveAction: "trace_change",
        insightKind: null
      },
      meaningCard: {
        main: {
          statement: "事件已经结束，身体仍维持紧绷",
          evidenceRefs: ["new:1", "new:2"]
        },
        necessaryScope: []
      }
    })).toThrow();
  });

  it("两段第二段只接受统一回应，并支持显式无法表达", () => {
    const success = eventCenteredLockedGenerativeVisibleSchema.parse({
      thinkingSummary: null,
      response: "演出先结束，身体到卸妆后才松开牙关。",
      cannotExpressReason: null
    });
    const failure = eventCenteredLockedGenerativeVisibleSchema.parse({
      thinkingSummary: null,
      response: null,
      cannotExpressReason: "现有限制下无法保留完整语义"
    });

    expect(success).toEqual({
      thinkingSummary: null,
      response: "演出先结束，身体到卸妆后才松开牙关。",
      cannotExpressReason: null
    });
    expect(failure).toEqual({
      thinkingSummary: null,
      response: null,
      cannotExpressReason: "现有限制下无法保留完整语义"
    });
    expect(() => eventCenteredLockedGenerativeVisibleSchema.parse({
      thinkingSummary: null,
      response: "演出先结束，身体到卸妆后才松开牙关。",
      cannotExpressReason: "同时声明失败"
    })).toThrow();
    expect(() => eventCenteredLockedGenerativeVisibleSchema.parse({
      thinkingSummary: null,
      response: null,
      cannotExpressReason: null
    })).toThrow();
  });

  it("提问表达只交付思路与统一回应", () => {
    expect(eventCenteredLockedGenerativeVisibleSchema.parse({
      thinkingSummary: "‘先发照片’改变了你的选择，仍缺的是它具体帮你确认了什么。",
      response: "拆机前先看到照片，会让你多确认哪一件事？",
      cannotExpressReason: null
    })).toEqual({
      thinkingSummary: "‘先发照片’改变了你的选择，仍缺的是它具体帮你确认了什么。",
      response: "拆机前先看到照片，会让你多确认哪一件事？",
      cannotExpressReason: null
    });
  });

  it("封存的 expressible 回应只取有效内容并忽略冗余成功标签", () => {
    expect(eventCenteredLockedGenerativeVisibleSchema.parse({
      status: "expressible",
      thinkingSummary: null,
      question: null,
      insight: "手碰到池壁那一下，你摘下泳镜，才发现自己在笑，肩膀也松了，那一刻就是松快。",
      honestLimit: null
    })).toEqual({
      thinkingSummary: null,
      response: "手碰到池壁那一下，你摘下泳镜，才发现自己在笑，肩膀也松了，那一刻就是松快。",
      cannotExpressReason: null
    });
  });
});
