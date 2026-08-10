import { describe, expect, it } from "vitest";

import type { EventCenteredUnderstandingDecision } from "@/features/interview/event-centered/ai-contract";
import {
  createInitialEventCenteredDialogueState,
  getEventCenteredAllowedActions,
  getEventCenteredCurrentQuestionIntent,
  parseEventCenteredDialogueState
} from "@/features/interview/event-centered/dialogue-state";
import { decideEventCenteredTurnPolicy } from "@/features/interview/event-centered/interview-policy";
import type { EventCenteredDialogueState } from "@/types/event-centered-dialogue";
import type { JournalEventAngle } from "@/types/journal-event-angle-outcome";
import type { JournalEventFactRecord } from "@/types/journal-event-understanding";

function understanding(
  overrides: Partial<EventCenteredUnderstandingDecision> = {}
): EventCenteredUnderstandingDecision {
  return {
    eventBoundary: "current_event",
    coreEventIdentifiable: true,
    answerSignal: "answered",
    facts: [],
    angleEvidence: [],
    outcomeCandidate: null,
    unsupportedHypothesis: null,
    adviceRequest: null,
    correctionTargetHint: null,
    boundaryReason: null,
    ...overrides
  };
}

function fact(
  id = "fact-1",
  statement = "开会时我主动说明了延期风险",
  kind: JournalEventFactRecord["kind"] = "event_detail"
): JournalEventFactRecord {
  return {
    id,
    eventId: "event-1",
    createdBranchSessionId: "branch-1",
    pathAnchorMessageId: "message-1",
    createdByRevisionId: null,
    statement,
    scope: "current_event",
    stance: "affirmed",
    kind,
    origin: "user_expression",
    createdAt: "2026-07-22T00:00:00.000Z",
    evidence: [{
      id: `${id}-evidence`,
      factId: id,
      sourceTurnId: "turn-1",
      contextMessageId: null,
      pathAnchorMessageId: "message-1",
      role: "direct_expression",
      quote: statement,
      createdAt: "2026-07-22T00:00:00.000Z"
    }]
  };
}

function decide(input: {
  state?: EventCenteredDialogueState;
  action?: Parameters<typeof decideEventCenteredTurnPolicy>[0]["action"];
  rawText?: string;
  selectedAngle?: JournalEventAngle;
  regenerationIntent?: Parameters<typeof decideEventCenteredTurnPolicy>[0]["regenerationIntent"];
  currentQuestionText?: string | null;
  facts?: JournalEventFactRecord[];
  decision?: EventCenteredUnderstandingDecision;
  bareAngleChange?: boolean;
  confirmedThisTurnFactId?: string | null;
}) {
  return decideEventCenteredTurnPolicy({
    state: input.state ?? createInitialEventCenteredDialogueState(),
    action: input.action ?? "reply",
    rawText: input.rawText ?? "今天开会时我主动说明了延期风险。",
    selectedAngle: input.selectedAngle,
    regenerationIntent: input.regenerationIntent,
    currentQuestionText: input.currentQuestionText ?? null,
    facts: input.facts ?? [],
    confirmedThisTurnFactId: input.confirmedThisTurnFactId,
    understanding: input.decision ?? understanding(),
    bareAngleChange: input.bareAngleChange ?? false
  });
}

function checkpointState(): EventCenteredDialogueState {
  return {
    ...createInitialEventCenteredDialogueState(),
    phase: "checkpoint_one",
    reflectionReady: true
  };
}

function understandingFact(
  kind: EventCenteredUnderstandingDecision["facts"][number]["kind"],
  statement: string
) {
  return { kind, statement, scope: "current_event" as const, stance: "affirmed" as const, quote: statement };
}

function activeAngleState(
  angle: JournalEventAngle,
  opportunityNumber = 1
): EventCenteredDialogueState {
  const state = createInitialEventCenteredDialogueState();
  state.phase = "guided_reflection";
  state.activeAngle = angle;
  state.angleRuns[angle] = {
    status: "active",
    questionOpportunityCount: opportunityNumber,
    lowPressureAnchorUsed: false,
    currentOutcomeId: null,
    answeredTargets: [],
    askedTargets: []
  };
  state.currentQuestion = {
    opportunityNumber,
    angle,
    target: angle === "feeling" ? "direct_experience" : `${angle}_first_target`,
    surfaceLevel: "open_anchor",
    repairCount: 0,
    assistantMessageId: "assistant-1"
  };
  return state;
}

describe("event-centered common interview policy", () => {
  it("模型降级到基线时，第一次说不清仍给一次具体入口，第二次关闭角度", () => {
    const first = decide({
      state: activeAngleState("feeling"),
      rawText: "我一时说不清，脑子里只有事情被打乱的感觉。",
      // 复现生成式语义校验失败后的 fallback：模型没有把文本标成 unknown。
      decision: understanding({ answerSignal: "answered" })
    });

    expect(first.directive.responseKind).toBe("repair");
    expect(first.localDeterministicRepairApplied).toBe(true);
    expect(first.nextState.currentQuestion).toMatchObject({
      angle: "feeling",
      surfaceLevel: "concrete_anchor",
      repairCount: 1
    });

    const second = decide({
      state: first.nextState,
      rawText: "还是说不清。",
      decision: understanding({ answerSignal: "answered" })
    });

    expect(second.nextState.phase).toBe("checkpoint_two");
    expect(second.nextState.angleRuns.feeling?.status).toBe("closed");
  });

  it("兼容旧快照，并只读取与当前目标一致的问题意图", () => {
    const legacy = activeAngleState("feeling");
    const restoredLegacy = parseEventCenteredDialogueState(legacy);
    expect(restoredLegacy.currentQuestionIntent).toBeNull();

    const matching = parseEventCenteredDialogueState({
      ...legacy,
      currentQuestionIntent: {
        targetId: "direct_experience",
        semanticGoal: "理解这次感受最先发生的变化",
        minimumAnswerScope: "至少说出一个具体变化"
      }
    });
    expect(getEventCenteredCurrentQuestionIntent(matching)).toEqual({
      targetId: "direct_experience",
      semanticGoal: "理解这次感受最先发生的变化",
      minimumAnswerScope: "至少说出一个具体变化"
    });

    const mismatching = parseEventCenteredDialogueState({
      ...legacy,
      currentQuestionIntent: {
        targetId: "another_target",
        semanticGoal: "这份意图已经属于另一个问题",
        minimumAnswerScope: null
      }
    });
    expect(mismatching.currentQuestion?.target).toBe("direct_experience");
    expect(mismatching.currentQuestionIntent).toBeNull();
    expect(getEventCenteredCurrentQuestionIntent(mismatching)).toBeNull();
  });

  it("新快照不再写入低压力锚点字段，历史快照仍可恢复", () => {
    const fresh = createInitialEventCenteredDialogueState();
    expect(fresh.angleRuns.feeling).not.toHaveProperty("lowPressureAnchorUsed");

    const restored = parseEventCenteredDialogueState({
      ...fresh,
      angleRuns: {
        ...fresh.angleRuns,
        feeling: {
          ...fresh.angleRuns.feeling,
          lowPressureAnchorUsed: true
        }
      }
    });
    expect(restored.angleRuns.feeling?.lowPressureAnchorUsed).toBe(true);
  });

  it("只有事件时继续追问个人感受", () => {
    const result = decide({
      decision: understanding({
        coreEventIdentifiable: true,
        facts: [understandingFact("event_detail", "今天开会时我主动说明了延期风险。")]
      })
    });

    expect(result.nextState.phase).toBe("event_recording");
    expect(result.directive.responseKind).toBe("question");
    expect(result.directive.questionSpec?.target).toBe("light_personal_reaction");
    expect(result.directive.exactResponse).toBe("这件事发生时，你心里最先冒出的感受是什么？");
    expect(result.nextState.reflectionReady).toBe(false);
    expect(result.nextState.activeAngle).toBeNull();
  });

  it("事件加个人反应后进入第一检查点，并开放角度选择", () => {
    const result = decide({
      decision: understanding({
        facts: [
          understandingFact("event_detail", "今天开会时我主动说明了延期风险。"),
          understandingFact("inner_experience", "我当时很紧张，也担心大家觉得我准备得不够。")
        ]
      })
    });

    expect(result.nextState.phase).toBe("checkpoint_one");
    expect(result.nextState.reflectionReady).toBe(true);
    expect(result.directive.checkpoint).toEqual({ kind: "first", outcome: null });
  });

  it("模型把事件和个人反应合并成一条事实时，仍按原话证据开放角度", () => {
    const result = decide({
      rawText: "今天在跟狗玩的时候被狗咬了一口，我有点委屈，也担心以后还会出血。",
      decision: understanding({
        facts: [understandingFact(
          "inner_experience",
          "今天在跟狗玩的时候被狗咬了一口，我有点委屈，也担心以后还会出血。"
        )]
      })
    });

    expect(result.nextState.phase).toBe("checkpoint_one");
    expect(result.nextState.reflectionReady).toBe(true);
    expect(result.directive.checkpoint).toEqual({ kind: "first", outcome: null });
  });

  it("事实状态被模型误标时，仍以用户原话判断事件和个人反应门槛", () => {
    const result = decide({
      rawText: "今天在跟狗玩的时候被狗咬了一口，我有点委屈，也担心以后还会出血。",
      decision: understanding({
        facts: [
          {
            ...understandingFact("event_detail", "今天在跟狗玩的时候被狗咬了一口"),
            stance: "unknown"
          },
          {
            ...understandingFact("inner_experience", "我有点委屈，也担心以后还会出血"),
            stance: "denied"
          }
        ]
      })
    });

    expect(result.nextState.phase).toBe("checkpoint_one");
    expect(result.nextState.reflectionReady).toBe(true);
  });

  it("具体互动动作即使模型合并事实也满足事件门槛", () => {
    const result = decide({
      rawText: "今天朋友当着别人的面笑我的衣服，我当时心里很堵，也有点烦。",
      decision: understanding({
        facts: [understandingFact(
          "inner_experience",
          "今天朋友当着别人的面笑我的衣服，我当时心里很堵，也有点烦。"
        )]
      })
    });

    expect(result.nextState.phase).toBe("checkpoint_one");
    expect(result.nextState.reflectionReady).toBe(true);
    expect(result.directive.checkpoint).toEqual({ kind: "first", outcome: null });
  });

  it("常见的堵和烦也算个人反应事实", () => {
    const result = decide({
      rawText: "今天朋友当着别人的面笑我的衣服，我心里很堵，也有点烦。",
      decision: understanding({
        facts: [understandingFact(
          "event_detail",
          "今天朋友当着别人的面笑我的衣服，我心里很堵，也有点烦。"
        )]
      })
    });

    expect(result.nextState.phase).toBe("checkpoint_one");
    expect(result.nextState.reflectionReady).toBe(true);
  });

  it("心里有点乱且暂时说不清具体感受时，已经满足个人反应门槛", () => {
    const result = decide({
      rawText: "今天收到一条临时改期的消息，我心里有点乱，也说不清具体是哪种感受。",
      decision: understanding({
        facts: [understandingFact(
          "event_detail",
          "今天收到一条临时改期的消息，我心里有点乱，也说不清具体是哪种感受。"
        )]
      })
    });

    expect(result.nextState.phase).toBe("checkpoint_one");
    expect(result.nextState.reflectionReady).toBe(true);
    expect(result.directive.checkpoint).toEqual({ kind: "first", outcome: null });
  });

  it("松了一口气与‘我也在想’组成个人反应时开放角度", () => {
    const result = decide({
      rawText: "今天我把一件拖了很久的事情做完了，心里松了一口气，也在想以后怎么判断什么值得优先。",
      decision: understanding({
        facts: [understandingFact(
          "event_detail",
          "今天我把一件拖了很久的事情做完了，心里松了一口气，也在想以后怎么判断什么值得优先。"
        )]
      })
    });

    expect(result.nextState.phase).toBe("checkpoint_one");
    expect(result.nextState.reflectionReady).toBe(true);
  });

  it.each([
    "今天我拒绝了一个临时加塞的请求。我有点内疚，也觉得时间安排终于被自己守住了。",
    "今天我把手机放到另一个房间，完成了原本一直拖着的报告。我有成就感，也觉得这样做不太方便。",
    "今天开会时我主动说明了风险。我当时松了一口气，也担心别人觉得我能力不够。"
  ])("入口能从用户原话识别已足够的事件与个人反应：%s", (rawText) => {
    const result = decide({
      rawText,
      decision: understanding({
        coreEventIdentifiable: false,
        facts: [understandingFact("inner_experience", rawText)]
      })
    });

    expect(result.nextState.phase).toBe("checkpoint_one");
    expect(result.nextState.reflectionReady).toBe(true);
    expect(result.directive.checkpoint).toEqual({ kind: "first", outcome: null });
  });

  it("整理材料这类行动事件也能直接进入角度选择", () => {
    const result = decide({
      rawText: "今天我提前把明天要用的材料整理好了，感觉轻松一些，但也担心临时变化会打乱安排。",
      decision: understanding({
        facts: [understandingFact(
          "event_detail",
          "今天我提前把明天要用的材料整理好了，感觉轻松一些，但也担心临时变化会打乱安排。"
        )]
      })
    });

    expect(result.nextState.phase).toBe("checkpoint_one");
    expect(result.nextState.reflectionReady).toBe(true);
  });

  it("只有个人感受时持续追问事件，不自动收束", () => {
    const first = decide({
      rawText: "我现在很委屈，也有点生气。",
      decision: understanding({
        coreEventIdentifiable: false,
        eventBoundary: "unclear",
        facts: [understandingFact("inner_experience", "我现在很委屈，也有点生气。")]
      })
    });

    expect(first.nextState.phase).toBe("event_recording");
    expect(first.nextState.lightAnchorOpportunityCount).toBe(1);
    expect(first.directive.questionSpec?.target).toBe("light_event_anchor");
    expect(first.directive.exactResponse).toBe("这份感受最早是在哪件具体事情里出现的？");

    const second = decide({
      state: first.nextState,
      rawText: "还是说不清。",
      decision: understanding({ coreEventIdentifiable: false, answerSignal: "unknown" })
    });

    expect(second.nextState.phase).toBe("event_recording");
    expect(second.directive.questionSpec?.target).toBe("light_event_anchor");
    expect(second.nextState.activeAngle).toBeNull();
    expect(second.nextState.reflectionReady).toBe(false);
  });

  it("双事件先进入一次聚焦选择，选择后继续补个人反应", () => {
    const focus = decide({
      rawText: "下午会议被临时取消，晚上又和朋友发生了误会。",
      decision: understanding({
        eventBoundary: "multiple_events",
        coreEventIdentifiable: false,
        eventOptions: [
          { label: "下午会议被临时取消", sourceText: "下午会议被临时取消" },
          { label: "晚上和朋友发生误会", sourceText: "晚上又和朋友发生了误会" }
        ]
      })
    });

    expect(focus.nextState.phase).toBe("event_focus_clarification");
    expect(focus.directive.responseKind).toBe("clarification");
    expect(focus.directive.questionSpec?.target).toBe("event_selection");
    expect(focus.directive.exactResponse).toBe("我先把你刚才提到的两件事都留在这里。");
    expect(focus.nextState.focusOptions).toEqual([
      { id: "focus-1", label: "下午会议被临时取消", sourceText: "下午会议被临时取消" },
      { id: "focus-2", label: "晚上又和朋友发生了误会", sourceText: "晚上又和朋友发生了误会" }
    ]);

    const selected = decide({
      state: focus.nextState,
      action: "select_current_event",
      rawText: "先记开会这件事。",
      decision: understanding({
        facts: [understandingFact("event_detail", "先记开会这件事。")]
      })
    });
    expect(selected.nextState.phase).toBe("event_recording");
    expect(selected.nextState.focusOptions).toEqual([]);
    expect(selected.directive.questionSpec?.target).toBe("light_personal_reaction");
  });

  it("从第二检查点继续深聊时保留当前角度和一个可回答的问题", () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "checkpoint_two";
    state.lastCompletedAngle = "relationship";
    state.angleRuns.relationship!.status = "completed";

    const result = decide({
      state,
      action: "continue_exploration",
      rawText: ""
    });

    expect(result.nextState).toMatchObject({
      phase: "deep_companionship",
      activeAngle: "relationship",
      currentQuestion: {
        angle: "relationship",
        target: "deep_open_point",
        surfaceLevel: "open_anchor"
      },
      angleRuns: {
        relationship: { status: "active" }
      }
    });
    expect(result.directive.questionSpec).toMatchObject({
      angle: "relationship",
      target: "deep_open_point"
    });
    expect(getEventCenteredAllowedActions({
      state: result.nextState,
      eventStatus: "active",
      hasPendingTurn: false
    })).toEqual(expect.arrayContaining(["reply", "continue_exploration"]));
    expect(getEventCenteredAllowedActions({
      state: result.nextState,
      eventStatus: "active",
      hasPendingTurn: false
    })).not.toContain("generate_event_journal");
  });

  it("模型把第一件事的两个分句误作两项时，按强分隔词恢复事件 A/B", () => {
    const rawText =
      "回家路上看到晚霞，我特意停下来拍了一张。 另外，午饭时朋友突然问我最近好不好，我愣了一下。";
    const focus = decide({
      rawText,
      decision: understanding({
        eventBoundary: "multiple_events",
        coreEventIdentifiable: false,
        eventOptions: [
          { label: "看到晚霞", sourceText: "回家路上看到晚霞" },
          { label: "停下来拍照", sourceText: "我特意停下来拍了一张" }
        ]
      })
    });

    expect(focus.nextState.focusOptions.map((option) => option.sourceText)).toEqual([
      "回家路上看到晚霞，我特意停下来拍了一张",
      "午饭时朋友突然问我最近好不好，我愣了一下"
    ]);
    expect(focus.directive.questionSpec?.surfaceLevel).toBe("low_pressure_choice");
  });

  it("无法可靠得到两项时不提交空纸笺，改用可回答的安全澄清", () => {
    const rawText = "项目和家庭两件事都挤在一起，我一时说不清先讲哪个。";
    const focus = decide({
      rawText,
      decision: understanding({
        eventBoundary: "multiple_events",
        coreEventIdentifiable: false,
        eventOptions: [
          { label: "下午会议", sourceText: rawText },
          { label: "晚上误会", sourceText: rawText }
        ]
      })
    });

    expect(focus.nextState.focusOptions).toEqual([]);
    expect(focus.directive.questionSpec).toMatchObject({
      target: "event_selection",
      surfaceLevel: "simplified"
    });
    expect(focus.directive.exactResponse).toContain("直接说");

    const clarified = decide({
      state: focus.nextState,
      rawText: "先记项目这件事。",
      decision: understanding({
        eventBoundary: "current_event",
        coreEventIdentifiable: true,
        facts: [understandingFact("event_detail", "先记项目这件事。")]
      })
    });
    expect(clarified.nextState.phase).toBe("event_recording");
    expect(clarified.directive.questionSpec?.target).toBe("light_personal_reaction");
  });

  it("中度复盘中出现另一件事时保持当前问题并隔离内容", () => {
    const state = activeAngleState("feeling", 1);
    const result = decide({
      state,
      rawText: "这件先不说，我还想讲另一件事。",
      currentQuestionText: "当时最先出现的感受是什么？",
      decision: understanding({
        eventBoundary: "another_event",
        coreEventIdentifiable: false,
        facts: [],
        outcomeCandidate: null
      })
    });

    expect(result.preserveCurrentQuestion).toBe(true);
    expect(result.nextState.currentQuestion).toEqual(state.currentQuestion);
    expect(result.directive.responseKind).toBe("boundary");
    expect(result.directive.exactResponse).toContain("留在原话");
    expect(result.directive.exactResponse).toContain("当时最先出现的感受是什么");
  });

  it.each([
    ["feeling", "direct_experience"],
    ["thought", "immediate_thought"],
    ["relationship", "relationship_interaction"],
    ["action", "action_goal"]
  ] as const)("%s 角度选择后给出该角度首问", (angle, target) => {
    const result = decide({
      state: checkpointState(),
      action: "select_exploration_angle",
      selectedAngle: angle,
      facts: [fact()],
      decision: understanding({ answerSignal: "unrelated" })
    });

    expect(result.nextState.phase).toBe("guided_reflection");
    expect(result.nextState.activeAngle).toBe(angle);
    expect(result.directive.questionSpec?.target).toBe(target);
    expect(result.nextState.angleRuns[angle]?.questionOpportunityCount).toBe(1);
  });

  it.each([
    ["feeling", "body_state"],
    ["thought", "default_expectation"],
    ["relationship", "relationship_low_pressure_anchor"],
    ["action", "action_low_pressure_anchor"]
  ] as const)("GI-057：%s 角度基础目标已覆盖时仍进入一个未回答的首问", (angle, target) => {
    const result = decide({
      state: checkpointState(),
      action: "select_exploration_angle",
      selectedAngle: angle,
      facts: angle === "feeling"
        ? [
            fact("feeling", "我因为对方打断我而很委屈", "inner_experience"),
            fact("trigger", "因为对方打断我", "event_detail")
          ]
        : angle === "thought"
          ? [
              fact("thought", "我当时觉得应该先把话说完", "stated_interpretation"),
              fact("basis", "因为对方在我没说完时就打断了我", "event_detail")
            ]
          : angle === "relationship"
            ? [
                fact("interaction", "对方在我没说完时打断了我", "event_detail"),
                fact("expectation", "我希望对方先听我说完", "stated_preference"),
                fact("boundary", "关系里我很在意平等地把话说完", "stated_preference")
              ]
            : [
                fact("goal", "我想要把这件事推进下去", "stated_preference"),
                fact("choice", "我最后选择先把风险说清楚", "event_detail"),
                fact("condition", "我担心时间不够", "stated_interpretation")
              ],
      decision: understanding({ answerSignal: "answered" })
    });

    expect(result.nextState.phase).toBe("guided_reflection");
    expect(result.directive.responseKind).toBe("question");
    expect(result.directive.questionSpec?.target).toBe(target);
    expect(result.directive.exactResponse).not.toContain("这个角度先停在这里");
  });

  it.each([
    ["feeling", "specific_trigger"],
    ["thought", "immediate_thought"],
    ["relationship", "relationship_expectation"],
    ["action", "action_goal"]
  ] as const)("GI-055：%s 卡片基于已有素材进入正常首问", (angle, target) => {
    const state = checkpointState();
    const eventFact = angle === "relationship"
      ? fact("event-relationship", "伴侣先说我叫小一点声，后来才安慰我。")
      : fact("event", "今天和狗玩时被咬了一口。 ");
    const personalFact = fact(
      "reaction",
      "我当时很委屈，也担心以后会不会被咬出血。",
      "inner_experience"
    );

    const result = decide({
      state,
      action: "select_exploration_angle",
      selectedAngle: angle,
      facts: [eventFact, personalFact],
      decision: understanding({ answerSignal: "answered" })
    });

    expect(result.nextState.phase).toBe("guided_reflection");
    expect(result.directive.questionSpec?.target).toBe(target);
    expect(result.directive.exactResponse).not.toContain("这个角度先停在这里");
  });

  it("已有事实支撑增量认识时允许零问形成角度成果", () => {
    const existing = fact("fact-1", "我主动说明延期风险，是因为比起显得顺利，我更在意信息透明");
    const result = decide({
      state: checkpointState(),
      action: "select_exploration_angle",
      selectedAngle: "thought",
      facts: [existing],
      decision: understanding({
        outcomeCandidate: {
          angle: "thought",
          kind: "insight",
          statement: "我判断事情是否处理得好时，更看重信息透明，而不只是表面顺利。",
          supportFactStatements: [existing.statement]
        }
      })
    });

    expect(result.nextState.phase, JSON.stringify(result, null, 2)).toBe("checkpoint_two");
    expect(result.angleOutcome).toMatchObject({
      angle: "thought",
      kind: "insight"
    });
    expect(result.directive.exactResponse).toBe("这次，我判断事情是否处理得好时，更看重信息透明，而不只是表面顺利。");
    expect(result.nextState.angleRuns.thought?.questionOpportunityCount).toBe(0);
  });

  it.each([
    {
      angle: "feeling" as const,
      factStatement: "我更在意把话说完，对方却在我还没说完时打断了我。",
      outcome: "这次比起立刻回应，我更在意先把话完整说完。"
    },
    {
      angle: "relationship" as const,
      factStatement: "我希望先把话说完，对方却在中途打断我。",
      outcome: "这次比起立刻回应，我更在意先把话完整说完。"
    }
  ])("%s 角度的零问成果直接进入主对话和第二检查点", ({ angle, factStatement, outcome }) => {
    const existing = fact("fact-1", factStatement);
    const result = decide({
      state: checkpointState(),
      action: "select_exploration_angle",
      selectedAngle: angle,
      facts: [existing],
      decision: understanding({
        outcomeCandidate: {
          angle,
          kind: "insight",
          statement: outcome,
          supportFactStatements: [existing.statement]
        }
      })
    });

    expect(result.nextState.phase).toBe("checkpoint_two");
    expect(result.directive.checkpoint).toEqual({ kind: "second", outcome });
    expect(result.directive.exactResponse).toBe(outcome);
    expect(result.directive.angleOutcome).toMatchObject({ angle, kind: "insight", statement: outcome });
  });

  it("准确复述已有事实不算零问成果", () => {
    const existing = fact("fact-1", "我在开会时主动说明了延期风险");
    const result = decide({
      state: checkpointState(),
      action: "select_exploration_angle",
      selectedAngle: "thought",
      facts: [existing],
      decision: understanding({
        outcomeCandidate: {
          angle: "thought",
          kind: "insight",
          statement: existing.statement,
          supportFactStatements: [existing.statement]
        }
      })
    });

    expect(result.nextState.phase).toBe("guided_reflection");
    expect(result.directive.responseKind).toBe("question");
    expect(result.angleOutcome).toBeNull();
  });

  it("EVB-FEE-084：泛化占位句不能被包装成零问成果", () => {
    const existing = fact("fact-1", "对方打断我时，我又烦躁又委屈。");
    const result = decide({
      state: checkpointState(),
      action: "select_exploration_angle",
      selectedAngle: "feeling",
      facts: [existing],
      decision: understanding({
        outcomeCandidate: {
          angle: "feeling",
          kind: "insight",
          statement: "从这段表达里已经能看到一条可以保留的线索。",
          supportFactStatements: [existing.statement]
        }
      })
    });

    expect(result.nextState.phase).toBe("guided_reflection");
    expect(result.directive.responseKind).toBe("question");
    expect(result.directive.questionSpec?.target).toBe("specific_trigger");
    expect(result.angleOutcome).toBeNull();
  });

  it("第三次回答机会后必须收束为可信线索或诚实边界", () => {
    const result = decide({
      state: activeAngleState("relationship", 3),
      rawText: "我还是说不清。",
      facts: [fact()],
      decision: understanding({ answerSignal: "unknown" })
    });

    expect(result.nextState.phase).toBe("checkpoint_two");
    expect(result.angleOutcome).toMatchObject({
      angle: "relationship",
      kind: "honest_limit"
    });
    expect(result.directive.exactResponse).toBe("这部分还不急着说成一个结论，我们先停在这里。");
    expect(result.nextState.angleRuns.relationship?.questionOpportunityCount).toBe(3);
  });

  it("感受角度达到诚实边界时先承认已确认的最小感受，仍保持 honest_limit 资格", () => {
    const result = decide({
      state: activeAngleState("feeling", 3),
      rawText: "目前我只能确定自己很害怕，其他的说不清。",
      facts: [fact("fact-event", "今天轮到我发言时突然忘词")],
      decision: understanding({
        answerSignal: "partly_answered",
        facts: [{
          statement: "我当时最明确的感受是害怕。",
          scope: "current_event",
          stance: "affirmed",
          kind: "inner_experience",
          quote: "只能确定自己很害怕"
        }]
      })
    });

    expect(result.nextState.phase).toBe("checkpoint_two");
    expect(result.angleOutcome).toMatchObject({
      angle: "feeling",
      kind: "honest_limit"
    });
    expect(result.directive.exactResponse).toBe(
      "目前最确定的是：我当时最明确的感受是害怕。更多部分暂时还说不清，我们先停在这里。"
    );
    expect(result.directive.angleOutcome?.kind).toBe("honest_limit");
  });

  it("诚实边界缺少角度内已确认事实时继续使用中性收束", () => {
    const result = decide({
      state: activeAngleState("thought", 3),
      rawText: "暂时还说不清。",
      facts: [fact("fact-event", "今天轮到我发言时突然忘词")],
      decision: understanding({ answerSignal: "partly_answered" })
    });

    expect(result.angleOutcome?.kind).toBe("honest_limit");
    expect(result.directive.exactResponse).toBe("这部分还不急着说成一个结论，我们先停在这里。");
  });

  it("行动角度达到诚实边界时承认已经说清的最小行动事实", () => {
    const result = decide({
      state: activeAngleState("action", 3),
      rawText: "我只确定自己先做了最小版本，别的还说不清。",
      facts: [fact("fact-event", "今天需要临时交出一个方案")],
      decision: understanding({
        answerSignal: "partly_answered",
        facts: [{
          statement: "我先做了最小版本。",
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: "先做了最小版本"
        }]
      })
    });

    expect(result.angleOutcome).toMatchObject({ angle: "action", kind: "honest_limit" });
    expect(result.directive.exactResponse).toBe(
      "目前最确定的是：我先做了最小版本。更多部分暂时还说不清，我们先停在这里。"
    );
  });

  it("本轮刚完成的隐式确认会立刻进入行动角度的诚实收束", () => {
    const confirmed = {
      ...fact("fact-implicit", "我先交了最重要的两页。"),
      origin: "implicit_confirmation" as const,
      evidence: [{
        ...fact("seed", "无关").evidence[0]!,
        factId: "fact-implicit",
        quote: null,
        role: "implicit_confirmation" as const
      }]
    };
    const result = decide({
      state: activeAngleState("action", 3),
      rawText: "剩下的我还说不清。",
      facts: [fact("fact-event", "今天需要临时交出一个方案"), confirmed],
      confirmedThisTurnFactId: "fact-implicit",
      decision: understanding({ answerSignal: "partly_answered" })
    });

    expect(result.directive.exactResponse).toBe(
      "目前最确定的是：我先交了最重要的两页。更多部分暂时还说不清，我们先停在这里。"
    );
  });

  it.each([
    {
      angle: "relationship" as const,
      rawText: "我们当时都沉默了一会儿，别的还说不清。",
      statement: "我们当时都沉默了一会儿。"
    },
    {
      angle: "action" as const,
      rawText: "我把精力放在最重要的两页，别的还说不清。",
      statement: "我把精力放在最重要的两页。"
    }
  ])("$angle 角度会承接当前轮的可观察事实", ({ angle, rawText, statement }) => {
    const result = decide({
      state: activeAngleState(angle, 3),
      rawText,
      facts: [fact("fact-event", "今天需要完成一项临时任务")],
      decision: understanding({
        answerSignal: "partly_answered",
        facts: [{
          statement,
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: statement
        }]
      })
    });

    expect(result.directive.exactResponse).toBe(
      `目前最确定的是：${statement}更多部分暂时还说不清，我们先停在这里。`
    );
  });

  it.each([
    {
      angle: "thought" as const,
      rawText: "我只确定当时觉得自己会搞砸。",
      statement: "我当时想到自己可能会搞砸。",
      kind: "stated_interpretation" as const
    },
    {
      angle: "relationship" as const,
      rawText: "我只确定他当时打断了我。",
      statement: "对方在我说到一半时打断了我。",
      kind: "event_detail" as const
    }
  ])("$angle 角度达到诚实边界时承认已经说清的最小事实", ({ angle, rawText, statement, kind }) => {
    const result = decide({
      state: activeAngleState(angle, 3),
      rawText,
      facts: [fact("fact-event", "今天在会上发生了一段对话")],
      decision: understanding({
        answerSignal: "partly_answered",
        facts: [{
          statement,
          scope: "current_event",
          stance: "affirmed",
          kind,
          quote: rawText
        }]
      })
    });

    expect(result.angleOutcome).toMatchObject({ angle, kind: "honest_limit" });
    expect(result.directive.exactResponse).toBe(
      `目前最确定的是：${statement}更多部分暂时还说不清，我们先停在这里。`
    );
  });

  it("第一次说不清只换一次具体问法，第二次说不清关闭当前角度", () => {
    const result = decide({
      state: activeAngleState("feeling", 1),
      rawText: "不知道。",
      facts: [fact()],
      decision: understanding({ answerSignal: "unknown" })
    });

    expect(result.nextState.phase).toBe("guided_reflection");
    expect(result.directive.responseKind).toBe("repair");
    expect(result.directive.questionSpec).toMatchObject({
      target: "direct_experience",
      surfaceLevel: "concrete_anchor",
      repairCount: 1
    });
    expect(result.directive.angleOutcome).toBeNull();
    expect(result.nextState.angleRuns.feeling?.status).toBe("active");
    expect(result.nextState.angleRuns.feeling?.lowPressureAnchorUsed).toBe(false);
    expect(result.nextState.angleRuns.feeling?.questionOpportunityCount).toBe(1);

    const closed = decide({
      state: result.nextState,
      rawText: "还是说不清。",
      facts: [fact()],
      decision: understanding({ answerSignal: "unknown" })
    });
    expect(closed.nextState.phase).toBe("checkpoint_two");
    expect(closed.nextState.angleRuns.feeling?.status).toBe("closed");
    expect(closed.directive.exactResponse).toBe("这个角度先停在这里。");
  });

  it("纠正理解后回到第二检查点时自然承接纠正，不表达为用户主动停止", () => {
    const state = activeAngleState("feeling", 1);
    state.angleRuns.feeling!.askedTargets = [
      "direct_experience",
      "specific_trigger",
      "experience_change",
      "mixed_feeling",
      "body_state",
      "care_need_boundary"
    ];
    const result = decide({
      state,
      rawText: "我没有生气。",
      facts: [fact("fact-event", "今天在会上忘词")],
      decision: understanding({ answerSignal: "correction" })
    });

    expect(result.nextState.phase).toBe("checkpoint_two");
    expect(result.directive.responseKind).toBe("checkpoint");
    expect(result.directive.questionSpec).toBeNull();
    expect(result.directive.angleOutcome).toBeNull();
    expect(result.directive.exactResponse).toBe("好，我们按这个更准确的理解继续。");
  });

  it.each([
    ["feeling", "我想停下来。"],
    ["thought", "不继续聊这个。"],
    ["relationship", "先收在这里。"],
    ["action", "暂时不想说。"]
  ] as const)("%s 角度收到 %s 时直接收束，不继续追问", (angle, rawText) => {
    const result = decide({
      state: activeAngleState(angle, 1),
      rawText,
      facts: [fact()],
      decision: understanding({ answerSignal: "declined" })
    });

    expect(result.nextState.phase).toBe("checkpoint_two");
    expect(result.directive.questionSpec).toBeNull();
    expect(result.angleOutcome).toBeNull();
    expect(result.nextState.angleRuns[angle]?.status).toBe("closed");
    expect(result.directive.exactResponse).toBe("这个角度先停在这里。");
  });

  it("有可追溯的部分回答后推进到下一个目标，避免重复问已答信息", () => {
    const state = activeAngleState("feeling", 1);
    state.angleRuns.feeling!.askedTargets = ["direct_experience"];
    const result = decide({
      state,
      rawText: "当时我先觉得很委屈。",
      facts: [fact()],
      decision: understanding({
        answerSignal: "partly_answered",
        facts: [{
          statement: "当时先觉得很委屈。",
          scope: "current_event",
          stance: "affirmed",
          kind: "inner_experience",
          quote: "先觉得很委屈"
        }]
      })
    });

    expect(result.nextState.angleRuns.feeling?.answeredTargets).toContain("direct_experience");
    expect(result.directive.checkpoint?.kind).toBe("second");
    expect(result.directive.questionSpec).toBeNull();
  });

  it("FEE-058：触发和感受已答后只新增一个在意或边界问题，不提前写成成果", () => {
    const state = activeAngleState("feeling", 2);
    state.currentQuestion = {
      ...state.currentQuestion!,
      target: "specific_trigger"
    };
    state.angleRuns.feeling!.answeredTargets = ["direct_experience"];
    state.angleRuns.feeling!.askedTargets = ["direct_experience", "specific_trigger"];
    const result = decide({
      state,
      rawText: "他在我还没说完时打断了我，我好像有点在意没能说完。",
      facts: [fact("fact-feeling", "我当时觉得很委屈。")],
      decision: understanding({
        answerSignal: "answered",
        facts: [{
          statement: "他在我还没说完时打断了我，我好像有点在意没能说完。",
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: "还没说完时打断了我，我好像有点在意没能说完"
        }]
      })
    });

    expect(result.nextState.phase).toBe("guided_reflection");
    expect(result.directive.questionSpec?.target).toBe("care_need_boundary");
    expect(result.angleOutcome).toBeNull();
    expect(result.directive.angleOutcome).toBeNull();
  });

  it.each([
    {
      target: "experience_change" as const,
      weakFact: "我的感受好像后来有点变化。"
    },
    {
      target: "mixed_feeling" as const,
      weakFact: "好像还有另一种感受，具体是什么说不上来。"
    },
    {
      target: "body_state" as const,
      weakFact: "身体好像也有点反应。"
    }
  ])("感受角度发现 $target 弱线索时只问对应单目标", ({ target, weakFact }) => {
    const direct = {
      ...fact("fact-direct", "我当时觉得很委屈。"),
      kind: "inner_experience" as const
    };
    const trigger = fact("fact-trigger", "因为同事突然打断了我，我才有这份感受。");
    const result = decide({
      state: checkpointState(),
      action: "select_exploration_angle",
      selectedAngle: "feeling",
      facts: [direct, trigger, fact("fact-weak", weakFact)],
      decision: understanding({ answerSignal: "unrelated" })
    });

    expect(result.nextState.phase).toBe("guided_reflection");
    expect(result.directive.questionSpec?.target).toBe(target);
    expect(result.directive.exactResponse.match(/[？?]/gu)).toHaveLength(1);
    expect(result.angleOutcome).toBeNull();
  });

  it.each([
    ["experience_change", "后来我慢慢平静下来了。"],
    ["mixed_feeling", "我当时既委屈又生气。"],
    ["body_state", "我当时胸口发紧，手心也出汗。"]
  ] as const)("感受角度已有 %s 明确答案时将其标记为覆盖，不重复追问", (target, statement) => {
    const result = decide({
      state: checkpointState(),
      action: "select_exploration_angle",
      selectedAngle: "feeling",
      facts: [
        { ...fact("fact-direct", "我当时觉得很委屈。"), kind: "inner_experience" },
        fact("fact-trigger", "因为同事突然打断了我，我才有这份感受。"),
        { ...fact(`fact-${target}`, statement), kind: "inner_experience" }
      ],
      decision: understanding({ answerSignal: "unrelated" })
    });

    expect(result.nextState.angleRuns.feeling?.answeredTargets).toContain(target);
    expect(result.directive.questionSpec?.target).not.toBe(target);
  });

  it("感受角度即使发现身体弱线索，仍优先补齐必经的直接体验", () => {
    const result = decide({
      state: checkpointState(),
      action: "select_exploration_angle",
      selectedAngle: "feeling",
      facts: [fact("fact-body-weak", "身体好像也有点反应。")],
      decision: understanding({ answerSignal: "unrelated" })
    });

    expect(result.directive.questionSpec?.target).toBe("direct_experience");
  });

  it("想法角度跳过用户已经自发说明的念头、依据和期待", () => {
    const result = decide({
      state: checkpointState(),
      action: "select_exploration_angle",
      selectedAngle: "thought",
      facts: [
        { ...fact("fact-thought", "我当时觉得这个方案风险太高，因为还没有验证数据。"), kind: "stated_interpretation" },
        { ...fact("fact-expectation", "我原本以为会先做小范围测试。"), kind: "stated_interpretation" }
      ],
      decision: understanding({ answerSignal: "unrelated" })
    });

    expect(result.nextState.angleRuns.thought?.answeredTargets).toEqual(
      expect.arrayContaining(["immediate_thought", "judgment_basis", "default_expectation"])
    );
    expect(["immediate_thought", "judgment_basis", "default_expectation"])
      .not.toContain(result.directive.questionSpec?.target);
  });

  it.each([
    {
      target: "default_expectation" as const,
      weakFact: "这似乎也和我原本的预想有关，但我还没说清原本预想是什么。"
    },
    {
      target: "evaluation_standard" as const,
      weakFact: "我好像还用了一个标准衡量它，但我还没说清那个标准。"
    },
    {
      target: "tradeoff_condition" as const,
      weakFact: "这里像是还有一个取舍，但我还没说清是哪两个方向。"
    }
  ])("想法角度发现 $target 弱线索时只问对应单目标", ({ target, weakFact }) => {
    const result = decide({
      state: checkpointState(),
      action: "select_exploration_angle",
      selectedAngle: "thought",
      facts: [
        {
          ...fact(
            "fact-thought",
            "我第一反应是这次可能会搞砸，因为会上已经连续返工两次。"
          ),
          kind: "stated_interpretation"
        },
        { ...fact("fact-weak", weakFact), kind: "stated_interpretation" }
      ],
      decision: understanding({ answerSignal: "unrelated" })
    });

    expect(result.nextState.phase).toBe("guided_reflection");
    expect(result.directive.questionSpec?.target).toBe(target);
    expect(result.directive.exactResponse.match(/[？?]/gu)).toHaveLength(1);
    expect(result.angleOutcome).toBeNull();
  });

  it.each([
    ["default_expectation", "我原先以为会先做小范围测试。"],
    ["evaluation_standard", "我的标准是信息足够透明才算做好。"],
    ["tradeoff_condition", "我宁愿推迟一天也不带着风险上线。"]
  ] as const)("想法角度已有 %s 明确答案时将其标记为覆盖，不重复追问", (target, statement) => {
    const result = decide({
      state: checkpointState(),
      action: "select_exploration_angle",
      selectedAngle: "thought",
      facts: [
        {
          ...fact(
            "fact-thought",
            "我第一反应是这次可能会搞砸，因为会上已经连续返工两次。"
          ),
          kind: "stated_interpretation"
        },
        { ...fact(`fact-${target}`, statement), kind: "stated_interpretation" }
      ],
      decision: understanding({ answerSignal: "unrelated" })
    });

    expect(result.nextState.angleRuns.thought?.answeredTargets).toContain(target);
    expect(result.directive.questionSpec?.target).not.toBe(target);
  });

  it("想法角度即使发现标准弱线索，仍优先补齐必经的当时念头", () => {
    const result = decide({
      state: checkpointState(),
      action: "select_exploration_angle",
      selectedAngle: "thought",
      facts: [
        {
          ...fact("fact-standard-weak", "我好像还用了一个标准衡量它，但我还没说清那个标准。"),
          kind: "event_detail"
        }
      ],
      decision: understanding({ answerSignal: "unrelated" })
    });

    expect(result.directive.questionSpec?.target).toBe("immediate_thought");
  });

  it("关系角度跳过已答互动和期待，继续询问位置或边界", () => {
    const result = decide({
      state: checkpointState(),
      action: "select_exploration_angle",
      selectedAngle: "relationship",
      facts: [
        fact("fact-interaction", "同事打断了我，说不用再解释。"),
        { ...fact("fact-expectation", "我希望他先听我说完再回应。"), kind: "stated_preference" }
      ],
      decision: understanding({ answerSignal: "unrelated" })
    });

    expect(result.nextState.angleRuns.relationship?.answeredTargets).toEqual(
      expect.arrayContaining(["relationship_interaction", "relationship_expectation"])
    );
    expect(result.directive.questionSpec?.target).toBe("relationship_position_or_boundary");
  });

  it("行动角度跳过已答目标和选择，只询问已经出现的具体阻力缺口", () => {
    const result = decide({
      state: checkpointState(),
      action: "select_exploration_angle",
      selectedAngle: "action",
      facts: [
        fact("fact-goal", "为了推进上线，我想要今天完成风险清单。"),
        fact("fact-choice", "我决定先补齐验证再提交。"),
        fact("fact-resistance", "推进时有个具体阻力，但我还没说清是什么。")
      ],
      decision: understanding({ answerSignal: "unrelated" })
    });

    expect(result.nextState.angleRuns.action?.answeredTargets).toEqual(
      expect.arrayContaining(["action_goal", "action_choice"])
    );
    expect(result.directive.questionSpec?.target).toBe("action_condition_or_friction");
    expect(result.directive.exactResponse).toContain("最具体的阻力是什么");
  });

  it("基础目标已问过但没有可追溯回答时回到检查点，避免重复或越级追问", () => {
    const state = activeAngleState("thought", 1);
    state.angleRuns.thought!.askedTargets = ["immediate_thought"];
    const result = decide({
      state,
      rawText: "我现在也说不出更多。",
      facts: [fact()],
      decision: understanding({ answerSignal: "partly_answered", facts: [] })
    });

    expect(result.nextState.phase).toBe("checkpoint_two");
    expect(result.directive.questionSpec).toBeNull();
    expect(result.angleOutcome).toBeNull();
  });

  it("当前没有新增价值时回到第二检查点，不把有限材料包装成成果", () => {
    const state = activeAngleState("feeling", 2);
    state.angleRuns.feeling!.answeredTargets = ["direct_experience", "specific_trigger"];
    state.angleRuns.feeling!.askedTargets = ["direct_experience", "specific_trigger"];

    const result = decide({
      state,
      rawText: "我现在也没有别的可补充了。",
      facts: [fact()],
      decision: understanding({ answerSignal: "declined" })
    });

    expect(result.nextState.phase).toBe("checkpoint_two");
    expect(result.angleOutcome).toBeNull();
    expect(result.directive.angleOutcome).toBeNull();
    expect(result.nextState.angleRuns.feeling?.status).toBe("closed");
  });

  it("事件记录阶段收到文本不确定时保留事件引导", () => {
    const result = decide({
      rawText: "没有。",
      decision: understanding({ coreEventIdentifiable: false, answerSignal: "unknown" })
    });

    expect(result.nextState.phase).toBe("event_recording");
    expect(result.directive.questionSpec?.target).toBe("light_event_anchor");
    expect(result.nextState.lightAnchorOpportunityCount).toBe(1);
  });

  it("EVB-PUB-074：自然语言换个角度时保留当前问题，等这一段结束后再选择方向", () => {
    const state = activeAngleState("action", 2);
    const result = decide({
      state,
      rawText: "能从别的角度说吗？",
      currentQuestionText: "为了推进这件事，你当时做了什么？",
      bareAngleChange: true,
      decision: understanding({ answerSignal: "unrelated" })
    });

    expect(result.preserveCurrentQuestion).toBe(true);
    expect(result.nextState.currentQuestion).toEqual(state.currentQuestion);
    expect(result.nextState.angleRuns.action?.questionOpportunityCount).toBe(2);
    expect(result.directive.exactResponse).toBe("我们先保留眼前这个问题。等这一段聊完后，你可以再选想看的方向。");
  });

  it("明确愿意继续且要求尊重边界时，保留当前问题和回答机会", () => {
    const state = activeAngleState("feeling", 1);
    const currentQuestionText = "当时最先出现的感受是什么？";
    const result = decide({
      state,
      rawText: "我愿意继续说说，但请尊重我的边界。",
      currentQuestionText,
      facts: [fact()],
      decision: understanding({
        facts: [{
          statement: "我愿意继续说说，但请尊重我的边界。",
          scope: "current_event",
          stance: "affirmed",
          kind: "inner_experience",
          quote: "我愿意继续说说，但请尊重我的边界。"
        }]
      })
    });

    expect(result.preserveCurrentQuestion).toBe(true);
    expect(result.nextState.phase).toBe("guided_reflection");
    expect(result.nextState.activeAngle).toBe("feeling");
    expect(result.nextState.currentQuestion).toEqual(state.currentQuestion);
    expect(result.nextState.angleRuns.feeling?.questionOpportunityCount).toBe(1);
    expect(result.angleOutcome).toBeNull();
    expect(result.directive.responseKind).toBe("boundary");
    expect(result.directive.exactResponse).toBe(currentQuestionText);
  });

  it("问题修复形成新的回答机会并保留当前目标", () => {
    const state = activeAngleState("feeling", 1);
    state.currentQuestionIntent = {
      targetId: state.currentQuestion!.target,
      semanticGoal: "理解当时最先出现的具体感受",
      minimumAnswerScope: "至少说出一种感受"
    };
    const result = decide({
      state,
      action: "regenerate_response",
      regenerationIntent: "simplify",
      currentQuestionText: "当时最先出现的感受是什么？",
      decision: understanding({ answerSignal: "unrelated" })
    });

    expect(result.directive.responseKind).toBe("repair");
    expect(result.nextState.currentQuestion?.target).toBe(state.currentQuestion?.target);
    expect(result.nextState.currentQuestion?.opportunityNumber).toBe(2);
    expect(result.nextState.currentQuestion?.repairCount).toBe(1);
    expect(result.nextState.angleRuns.feeling?.questionOpportunityCount).toBe(2);
    expect(result.nextState.currentQuestion?.surfaceLevel).toBe("simplified");
    expect(result.nextState.currentQuestionIntent).toEqual(state.currentQuestionIntent);
    expect(result.directive.exactResponse).toBe("当时你是什么感受？");
  });

  it.each([
    {
      angle: "feeling" as const,
      target: "specific_trigger",
      intent: "simplify" as const,
      statement: "同事说不用再解释时，我突然觉得很委屈。",
      expectedMeaning: "哪一刻",
      expectedAnchor: "不用再解释"
    },
    {
      angle: "thought" as const,
      target: "judgment_basis",
      intent: "simplify" as const,
      statement: "我当时担心这个方案风险太高。",
      expectedMeaning: "事实",
      expectedAnchor: "风险太高"
    },
    {
      angle: "relationship" as const,
      target: "relationship_expectation",
      intent: "concretize" as const,
      statement: "同事当场打断了我的说明。",
      expectedMeaning: "希望对方",
      expectedAnchor: "打断"
    },
    {
      angle: "action" as const,
      target: "action_condition_or_friction",
      intent: "concretize" as const,
      statement: "审批时间只剩半天。",
      expectedMeaning: "推进或卡住",
      expectedAnchor: "半天"
    }
  ])(
    "$angle 的 $intent 修复保留原目标、事实锚点和回答机会规则",
    ({ angle, target, intent, statement, expectedMeaning, expectedAnchor }) => {
      const state = activeAngleState(angle, 1);
      state.currentQuestion = {
        ...state.currentQuestion!,
        target
      };
      state.angleRuns[angle]!.askedTargets = [target];
      const result = decide({
        state,
        action: "regenerate_response",
        regenerationIntent: intent,
        currentQuestionText: "原来的问题表达比较抽象。",
        facts: [fact(`fact-${angle}`, statement)],
        decision: understanding({ answerSignal: "unrelated" })
      });

      expect(result.directive.responseKind).toBe("repair");
      expect(result.directive.questionSpec).toMatchObject({
        angle,
        target,
        opportunityNumber: 2,
        surfaceLevel: intent === "simplify" ? "simplified" : "concrete_anchor",
        repairCount: 1
      });
      expect(result.nextState.currentQuestion).toMatchObject({
        angle,
        target,
        opportunityNumber: 2,
        repairCount: 1
      });
      expect(result.nextState.angleRuns[angle]?.questionOpportunityCount).toBe(2);
      expect(result.directive.exactResponse).toContain(expectedMeaning);
      expect(result.directive.exactResponse).not.toContain(expectedAnchor);
      expect(result.directive.exactResponse.match(/[？?]/gu)).toHaveLength(1);
      expect(result.directive.exactResponse).not.toContain("你现在最确定的一点");
      expect(result.directive.exactResponse).not.toContain("最确定的那个时刻发生了什么");
    }
  );

  it("轻量记录锚点的问题修复继续停留在事件记录阶段", () => {
    const anchor = decide({
      rawText: "我现在有点难受。",
      decision: understanding({ coreEventIdentifiable: false, eventBoundary: "unclear" })
    });
    const repaired = decide({
      state: anchor.nextState,
      action: "regenerate_response",
      rawText: "",
      regenerationIntent: "simplify",
      currentQuestionText: anchor.directive.exactResponse,
      decision: understanding({ coreEventIdentifiable: false, answerSignal: "unrelated" })
    });

    expect(repaired.nextState.phase).toBe("event_recording");
    expect(repaired.nextState.activeAngle).toBeNull();
    expect(repaired.nextState.currentQuestion).toMatchObject({
      angle: null,
      target: "light_event_anchor"
    });
    expect(Object.keys(repaired.nextState.angleRuns)).not.toContain("null");
  });

  it("已用完三次回答机会时问题修复不再产生第四问", () => {
    const state = activeAngleState("feeling", 3);
    const result = decide({
      state,
      action: "regenerate_response",
      regenerationIntent: "simplify",
      currentQuestionText: "当时最先出现的感受是什么？",
      decision: understanding({ answerSignal: "unrelated" })
    });

    expect(result.nextState.phase).toBe("checkpoint_two");
    expect(result.directive.responseKind).toBe("checkpoint");
    expect(result.nextState.angleRuns.feeling?.questionOpportunityCount).toBe(3);
  });

  it("深度陪伴没有新增理解时只回应，不追加追问", () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "deep_companionship";
    state.lastCompletedAngle = "thought";

    const result = decide({
      state,
      rawText: "我只是想再说一句，今天真的挺累的。",
      decision: understanding({ answerSignal: "answered" })
    });

    expect(result.directive.responseKind).toBe("acknowledgement");
    expect(result.directive.questionSpec).toBeNull();
    expect(result.nextState.currentQuestion).toBeNull();
    expect(result.directive.angleOutcome).toBeNull();
    expect(result.angleOutcome).toBeNull();
    expect(result.nextState).toEqual(state);
    expect(result.directive.exactResponse).toBe("好，我听到了。");
    expect(result.directive.exactResponse).not.toMatch(/线索|并入|状态|事实/u);
  });

  it("深度陪伴收到停止边界时自然停下，不描述内部保留动作", () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "deep_companionship";
    state.lastCompletedAngle = "relationship";

    const result = decide({
      state,
      rawText: "先停在这里。",
      decision: understanding({ answerSignal: "declined" })
    });

    expect(result.directive.responseKind).toBe("acknowledgement");
    expect(result.directive.questionSpec).toBeNull();
    expect(result.directive.angleOutcome).toBeNull();
    expect(result.angleOutcome).toBeNull();
    expect(result.nextState).toEqual(state);
    expect(result.directive.exactResponse).toBe("好，我们先停在这里。");
    expect(result.directive.exactResponse).not.toMatch(/线索|并入|状态|事实/u);
  });

  it("引导复盘后和深聊停顿开放生成日志，第一检查点只进入角度选择", () => {
    const firstCheckpointActions = getEventCenteredAllowedActions({
      state: checkpointState(),
      eventStatus: "active",
      hasPendingTurn: false
    });
    const secondCheckpoint = checkpointState();
    secondCheckpoint.phase = "checkpoint_two";
    const secondCheckpointActions = getEventCenteredAllowedActions({
      state: secondCheckpoint,
      eventStatus: "active",
      hasPendingTurn: false
    });

    const deepPaused = checkpointState();
    deepPaused.phase = "deep_companionship";
    deepPaused.currentQuestion = null;
    const deepPausedActions = getEventCenteredAllowedActions({
      state: deepPaused,
      eventStatus: "active",
      hasPendingTurn: false
    });
    const deepAsking = checkpointState();
    deepAsking.phase = "deep_companionship";
    deepAsking.currentQuestion = {
      angle: "feeling",
      target: "感受变化",
      opportunityNumber: 1,
      surfaceLevel: "concrete_anchor",
      repairCount: 0,
      assistantMessageId: "message-deep-question"
    };
    const deepAskingActions = getEventCenteredAllowedActions({
      state: deepAsking,
      eventStatus: "active",
      hasPendingTurn: false
    });

    expect(firstCheckpointActions).not.toContain("generate_event_journal");
    expect(firstCheckpointActions).toContain("select_exploration_angle");
    expect(firstCheckpointActions).not.toContain("reply");
    expect(secondCheckpointActions).toContain("generate_event_journal");
    expect(deepPausedActions).toContain("generate_event_journal");
    expect(deepAskingActions).not.toContain("generate_event_journal");
  });

  it("解析含 T1-03 事实澄清字段的快照时保留现有对话状态", () => {
    const source = {
      ...createInitialEventCenteredDialogueState(),
      phase: "guided_reflection" as const,
      activeAngle: "thought" as const,
      pendingFactRevisionClarification: {
        kind: "hard_conflict",
        sourceTurnId: "turn-2",
        candidateTargetFactIds: ["fact-1"],
        candidateFactDrafts: [],
        clarificationMessageId: "message-2"
      }
    };

    const parsed = parseEventCenteredDialogueState(source);

    expect(parsed.phase).toBe("guided_reflection");
    expect(parsed.activeAngle).toBe("thought");
    expect(parsed.angleRuns.feeling?.status).toBe("available");
  });
});
