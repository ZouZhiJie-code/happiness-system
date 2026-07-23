import { describe, expect, it } from "vitest";

import type { EventCenteredUnderstandingDecision } from "@/features/interview/event-centered/ai-contract";
import {
  createInitialEventCenteredDialogueState,
  getEventCenteredAllowedActions,
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

function fact(id = "fact-1", statement = "开会时我主动说明了延期风险"): JournalEventFactRecord {
  return {
    id,
    eventId: "event-1",
    createdBranchSessionId: "branch-1",
    pathAnchorMessageId: "message-1",
    createdByRevisionId: null,
    statement,
    scope: "current_event",
    stance: "affirmed",
    kind: "event_detail",
    origin: "user_expression",
    createdAt: "2026-07-22T00:00:00.000Z",
    evidence: []
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
}) {
  return decideEventCenteredTurnPolicy({
    state: input.state ?? createInitialEventCenteredDialogueState(),
    action: input.action ?? "reply",
    rawText: input.rawText ?? "今天开会时我主动说明了延期风险。",
    selectedAngle: input.selectedAngle,
    regenerationIntent: input.regenerationIntent,
    currentQuestionText: input.currentQuestionText ?? null,
    facts: input.facts ?? [],
    understanding: input.decision ?? understanding(),
    bareAngleChange: input.bareAngleChange ?? false
  });
}

function checkpointState(): EventCenteredDialogueState {
  return {
    ...createInitialEventCenteredDialogueState(),
    phase: "checkpoint_one"
  };
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

  it("清晰事件零追问进入第一检查点", () => {
    const result = decide({
      decision: understanding({ coreEventIdentifiable: true })
    });

    expect(result.nextState.phase).toBe("checkpoint_one");
    expect(result.directive.responseKind).toBe("checkpoint");
    expect(result.directive.checkpoint).toEqual({ kind: "first", outcome: null });
    expect(result.directive.exactResponse).toBe("这件事已经先记下来了。");
    expect(result.nextState.lightAnchorOpportunityCount).toBe(0);
    expect(result.nextState.activeAngle).toBeNull();
    expect(result.nextState.currentQuestion).toBeNull();
    expect(Object.values(result.nextState.angleRuns).every((run) => run?.status === "available")).toBe(true);
  });

  it("模糊事件最多只补一个轻压力事实锚点", () => {
    const first = decide({
      decision: understanding({ coreEventIdentifiable: false, eventBoundary: "unclear" })
    });

    expect(first.nextState.phase).toBe("event_recording");
    expect(first.nextState.lightAnchorOpportunityCount).toBe(1);
    expect(first.directive.questionSpec?.target).toBe("light_event_anchor");

    const second = decide({
      state: first.nextState,
      rawText: "还是说不清。",
      decision: understanding({ coreEventIdentifiable: false, answerSignal: "unknown" })
    });

    expect(second.nextState.phase).toBe("checkpoint_one");
    expect(second.directive.questionSpec).toBeNull();
    expect(second.nextState.activeAngle).toBeNull();
    expect(second.nextState.currentQuestion).toBeNull();
    expect(Object.values(second.nextState.angleRuns).every((run) => run?.status === "available")).toBe(true);
  });

  it("双事件先进入一次聚焦选择，选择后进入第一检查点", () => {
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
      { id: "focus-2", label: "晚上和朋友发生误会", sourceText: "晚上又和朋友发生了误会" }
    ]);

    const selected = decide({
      state: focus.nextState,
      action: "select_current_event",
      rawText: "先记开会这件事。"
    });
    expect(selected.nextState.phase).toBe("checkpoint_one");
    expect(selected.nextState.focusOptions).toEqual([]);
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
    expect(result.directive.exactResponse).toBe("我判断事情是否处理得好时，更看重信息透明，而不只是表面顺利。");
    expect(result.nextState.angleRuns.thought?.questionOpportunityCount).toBe(0);
  });

  it.each([
    {
      angle: "feeling" as const,
      factStatement: "我更在意把话说完，对方却在我还没说完时打断了我。",
      outcome: "比起立刻回应，我更在意先把话完整说完。"
    },
    {
      angle: "relationship" as const,
      factStatement: "我希望先把话说完，对方却在中途打断我。",
      outcome: "比起立刻回应，我更在意先把话完整说完。"
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
    expect(result.directive.questionSpec?.target).toBe("direct_experience");
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

  it("文本无法继续时回到第二检查点，不生成低压力锚点或角度成果", () => {
    const result = decide({
      state: activeAngleState("feeling", 1),
      rawText: "不知道。",
      facts: [fact()],
      decision: understanding({ answerSignal: "unknown" })
    });

    expect(result.nextState.phase).toBe("checkpoint_two");
    expect(result.directive.questionSpec).toBeNull();
    expect(result.directive.angleOutcome).toBeNull();
    expect(result.angleOutcome).toBeNull();
    expect(result.nextState.angleRuns.feeling?.status).toBe("available");
    expect(result.nextState.angleRuns.feeling?.lowPressureAnchorUsed).toBe(false);
    expect(result.nextState.angleRuns.feeling?.questionOpportunityCount).toBe(1);
    expect(result.directive.exactResponse).toBe("这个角度先停在这里。");
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
    expect(result.nextState.angleRuns[angle]?.status).toBe("available");
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
    expect(result.directive.questionSpec?.target).toBe("specific_trigger");
    expect(result.directive.exactResponse).not.toContain("最先出现的具体感受");
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
      rawText: "他在我还没说完时打断了我。",
      facts: [fact("fact-feeling", "我当时觉得很委屈。")],
      decision: understanding({
        answerSignal: "answered",
        facts: [{
          statement: "他在我还没说完时打断了我。",
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: "还没说完时打断了我"
        }]
      })
    });

    expect(result.nextState.phase).toBe("guided_reflection");
    expect(result.directive.questionSpec?.target).toBe("care_need_boundary");
    expect(result.angleOutcome).toBeNull();
    expect(result.directive.angleOutcome).toBeNull();
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
    expect(result.nextState.angleRuns.feeling?.status).toBe("available");
  });

  it("事件记录阶段收到文本否定时直接进入第一检查点", () => {
    const result = decide({
      rawText: "没有。",
      decision: understanding({ coreEventIdentifiable: false, answerSignal: "unknown" })
    });

    expect(result.nextState.phase).toBe("checkpoint_one");
    expect(result.directive.questionSpec).toBeNull();
    expect(result.nextState.lightAnchorOpportunityCount).toBe(0);
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
  });

  it("轻量记录锚点的问题修复继续停留在事件记录阶段", () => {
    const anchor = decide({
      decision: understanding({ coreEventIdentifiable: false, eventBoundary: "unclear" })
    });
    const repaired = decide({
      state: anchor.nextState,
      action: "regenerate_response",
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
  });

  it("在两个检查点和深度陪伴开放生成事件日志动作", () => {
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
    const deepCompanionship = checkpointState();
    deepCompanionship.phase = "deep_companionship";
    const deepCompanionshipActions = getEventCenteredAllowedActions({
      state: deepCompanionship,
      eventStatus: "active",
      hasPendingTurn: false
    });

    expect(firstCheckpointActions).toContain("generate_event_journal");
    expect(secondCheckpointActions).toContain("generate_event_journal");
    expect(deepCompanionshipActions).toContain("generate_event_journal");
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
