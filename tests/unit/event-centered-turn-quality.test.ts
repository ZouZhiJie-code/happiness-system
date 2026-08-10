import { describe, expect, it } from "vitest";

import {
  EVENT_CENTERED_FIRST_CHECKPOINT_UNDERSTANDING,
  EVENT_CENTERED_CONTINUE_WITH_BOUNDARY_ACKNOWLEDGEMENT,
  createSafeEventCenteredPayload,
  getEventCenteredFirstCheckpointFactAcknowledgement,
  getEventCenteredFirstCheckpointPresentation,
  getEventCenteredTextBoundaryUnderstanding,
  isEventCenteredContinueWithinBoundaryExpression,
  removeRepeatedEventCenteredQuestionAnchor,
  resolveEventCenteredNaturalUnderstanding,
  runEventCenteredTurnQualityGate
} from "@/features/interview/event-centered/turn-quality";
import type { EventCenteredAssistantPayload } from "@/types/event-centered-dialogue";

function payload(overrides: Partial<EventCenteredAssistantPayload> = {}): EventCenteredAssistantPayload {
  return {
    naturalUnderstanding: "你在临时变化发生时感到紧张。",
    naturalResponse: "当时哪个具体瞬间最让你紧张？",
    responseKind: "question",
    questionSpec: {
      phase: "guided_reflection",
      angle: "feeling",
      target: "specific_trigger",
      opportunityNumber: 1,
      surfaceLevel: "open_anchor",
      anchorText: null,
      repairCount: 0
    },
    checkpoint: null,
    angleOutcome: null,
    ...overrides
  };
}

describe("event-centered turn quality gate", () => {
  it("理解层已经承接事实锚点时，问题直接进入目标", () => {
    expect(removeRepeatedEventCenteredQuestionAnchor({
      naturalUnderstanding: "你说提前留出的半小时确实帮上了忙。",
      naturalResponse: "你提到“提前留出的半小时帮上了忙”。这次行动里，哪个具体条件最起作用？",
      anchorText: "提前留出的半小时帮上了忙"
    })).toBe("这次行动里，哪个具体条件最起作用？");

    expect(removeRepeatedEventCenteredQuestionAnchor({
      naturalUnderstanding: "我会保留刚才的关注点，把问题说得更具体。",
      naturalResponse: "你提到“提前留出的半小时帮上了忙”。这次行动里，哪个具体条件最起作用？",
      anchorText: "提前留出的半小时帮上了忙"
    })).toContain("你提到“提前留出的半小时帮上了忙”");

    expect(removeRepeatedEventCenteredQuestionAnchor({
      naturalUnderstanding: "你说团队突然改了交付时间后，你先缩小范围做出了可验证版本。",
      naturalResponse: "你提到“团队突然改了交付时间后，你先缩小范围做…”。当时哪项取舍最关键？",
      anchorText: "团队突然改了交付时间后，你先缩小范围做出了一个可以验证的版本"
    })).toBe("当时哪项取舍最关键？");
  });

  it("引用原话中的疑问词不会把单一关系问题误判为多目标", () => {
    expect(getEventCenteredTextBoundaryUnderstanding({
      rawText: "说不清。",
      currentQuestionText: "你提到“我不知道该怎么回应”。对方怎样回应时，你会更清楚自己在这段关系中的位置？",
      currentQuestionTarget: "relationship_position_or_boundary"
    })).toBe("你暂时还说不清自己在这段关系中的位置。");
  });

  it("换问法中的原话引用也不会干扰短边界承接", () => {
    expect(getEventCenteredTextBoundaryUnderstanding({
      rawText: "说不清。",
      currentQuestionText: "简单说，你提到“我不知道该怎么做”。这次行动里，哪个条件真正帮上了忙？",
      currentQuestionTarget: "action_condition_or_friction"
    })).toBe("你暂时还说不清哪个条件真正帮上了忙。");
  });

  it("passes one concrete evidence-bound question", () => {
    expect(runEventCenteredTurnQualityGate({
      payload: payload(),
      previousAssistantResponses: [],
      adviceRequested: false,
      pendingHypothesisStatement: null
    })).toEqual({ passed: true, safetyBlockers: [], qualityIssues: [] });
  });

  it("treats diagnosis and harmful coercion as safety blockers", () => {
    const result = runEventCenteredTurnQualityGate({
      payload: payload({
        naturalUnderstanding: "这说明你患有焦虑症。",
        naturalResponse: "你必须立刻停药，照我说的做。"
      }),
      previousAssistantResponses: [],
      adviceRequested: true,
      pendingHypothesisStatement: null
    });

    expect(result.safetyBlockers).toEqual([
      "psychological_diagnosis",
      "harmful_coercive_advice"
    ]);
    expect(result.passed).toBe(false);
  });

  it("将病理化、伤害性强制建议和跨账号隐私统一收束到安全通道", () => {
    const result = runEventCenteredTurnQualityGate({
      payload: payload({
        naturalUnderstanding: "你已经出现病理性自恋。",
        naturalResponse: "现在就把对方的隐私发到网上。"
      }),
      previousAssistantResponses: [],
      adviceRequested: false,
      pendingHypothesisStatement: null
    });

    expect(result).toMatchObject({
      passed: false,
      safetyBlockers: [
        "psychological_diagnosis",
        "harmful_coercive_advice"
      ]
    });

    const safePayload = createSafeEventCenteredPayload({
      payload: payload({
        naturalUnderstanding: "你已经出现病理性自恋。",
        naturalResponse: "现在就把对方的隐私发到网上。"
      }),
      exactResponse: "我先接住你刚才说的这一段。"
    });

    expect(runEventCenteredTurnQualityGate({
      payload: safePayload,
      previousAssistantResponses: [],
      adviceRequested: false,
      pendingHypothesisStatement: null
    })).toEqual({ passed: true, safetyBlockers: [], qualityIssues: [] });
  });

  it("keeps ordinary quality issues in the quality lane", () => {
    const result = runEventCenteredTurnQualityGate({
      payload: payload({
        naturalUnderstanding: "我会更新 snapshotData。",
        naturalResponse: "你可以试试先沟通？然后再退出？"
      }),
      previousAssistantResponses: [],
      adviceRequested: false,
      pendingHypothesisStatement: null
    });

    expect(result.safetyBlockers).toEqual([]);
    expect(result.qualityIssues).toEqual([
      "internal_structure_exposure",
      "unsolicited_advice",
      "multiple_question_targets"
    ]);
  });

  it("拒绝把追问藏进自然理解，或在同一回复中叠加多个问题", () => {
    const result = runEventCenteredTurnQualityGate({
      payload: payload({
        naturalUnderstanding: "你愿意先说说最难受的部分吗？",
        naturalResponse: "当时发生了什么？你后来又做了什么？"
      }),
      previousAssistantResponses: [],
      adviceRequested: false,
      pendingHypothesisStatement: null
    });

    expect(result.qualityIssues).toEqual([
      "natural_understanding_question",
      "multiple_question_targets"
    ]);
  });

  it("rejects exact repeated questions and invisible pending hypotheses", () => {
    const result = runEventCenteredTurnQualityGate({
      payload: payload(),
      previousAssistantResponses: ["当时哪个具体瞬间最让你紧张？"],
      adviceRequested: false,
      pendingHypothesisStatement: "你可能更在意提前被告知"
    });

    expect(result.qualityIssues).toEqual([
      "repeated_question",
      "unsupported_hypothesis_mismatch"
    ]);
  });

  it("keeps the first checkpoint to a deterministic recorded-event acknowledgement", () => {
    const result = runEventCenteredTurnQualityGate({
      payload: payload({
        naturalUnderstanding: "你终于松了一口气，也发现自己很在意被认可。",
        naturalResponse: "要不要从感受开始？",
        responseKind: "checkpoint",
        questionSpec: null,
        checkpoint: { kind: "first", outcome: null }
      }),
      previousAssistantResponses: [],
      adviceRequested: false,
      pendingHypothesisStatement: null
    });

    expect(result.qualityIssues).toEqual([
      "checkpoint_question_overreach",
      "first_checkpoint_overreach"
    ]);

    expect(runEventCenteredTurnQualityGate({
      payload: payload({
        naturalUnderstanding: EVENT_CENTERED_FIRST_CHECKPOINT_UNDERSTANDING,
        naturalResponse: "这件事已经先记下来了。你可以直接生成、继续补充，或选择一个角度继续看看。",
        responseKind: "checkpoint",
        questionSpec: null,
        checkpoint: { kind: "first", outcome: null }
      }),
      previousAssistantResponses: [],
      adviceRequested: false,
      pendingHypothesisStatement: null
    })).toEqual({ passed: true, safetyBlockers: [], qualityIssues: [] });
  });

  it("清晰事件的第一检查点用原话承接，理解层与已记下回应保持分工", () => {
    const presentation = getEventCenteredFirstCheckpointPresentation({
      rawText: "今天开会时我主动说明了延期风险。",
      decision: {
        answerSignal: "answered",
        facts: [{
          statement: "今天开会时主动说明了延期风险",
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: "主动说明了延期风险"
        }]
      }
    });

    expect(presentation).toMatchObject({
      kind: "evidence",
      understanding: "你刚刚说到：“今天开会时我主动说明了延期风险”。"
    });
    expect(presentation.understanding).not.toBe("这件事已经先记下来了。");
  });

  it("长原话在自然分句处用省略号收住，缺少分句时改用完整事实", () => {
    const segmented = getEventCenteredFirstCheckpointPresentation({
      rawText: "今天开会时我主动说明了延期风险，但讨论很快转到了下一项；后来我又单独补充了可能受影响的时间安排，也把还需要确认的地方列了出来，最后再和几个协作方逐一确认后续动作。",
      decision: {
        answerSignal: "answered",
        facts: [{
          statement: "今天开会时主动说明了延期风险",
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: "主动说明了延期风险"
        }]
      }
    });
    const factFallback = getEventCenteredFirstCheckpointPresentation({
      rawText: "今天的跨部门协作会议从需求范围排期资源接口依赖风险控制上线顺序验收条件一直讨论到后续复盘安排全部内容连续说了很久期间每个人还轮流补充了各自负责事项未来两周的具体推进计划",
      decision: {
        answerSignal: "answered",
        facts: [{
          statement: "今天参加了跨部门协作会议",
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: "跨部门协作会议"
        }]
      }
    });

    expect(segmented.understanding)
      .toBe("你刚刚说到：“今天开会时我主动说明了延期风险，但讨论很快转到了下一项；后来我又单独补充了可能受影响的时间安排，也把还需要确认的地方列了出来……”");
    expect(factFallback.understanding).toBe("你刚刚说到，今天参加了跨部门协作会议。");
  });

  it("第一检查点拒绝理解层与已记下回应重复", () => {
    const duplicated = payload({
      naturalUnderstanding: "这件事已经先记下来了。",
      naturalResponse: "这件事已经先记下来了。",
      responseKind: "checkpoint",
      questionSpec: null,
      checkpoint: { kind: "first", outcome: null }
    });
    const result = runEventCenteredTurnQualityGate({
      payload: duplicated,
      previousAssistantResponses: [],
      adviceRequested: false,
      pendingHypothesisStatement: null,
      firstCheckpointUnderstanding: duplicated.naturalUnderstanding
    });

    expect(result.qualityIssues).toContain("first_checkpoint_duplicate_layers");
  });

  it.each([
    "没有。",
    "不知道。",
    "想不起来。",
    "我也说不清。",
    "这些都不贴切。",
    "没法再具体了。",
    "暂时不想说。"
  ])(
    "锚点用尽后收到 %s 时理解层尊重边界且不追问",
    (rawText) => {
      const presentation = getEventCenteredFirstCheckpointPresentation({
        rawText,
        decision: {
          answerSignal: "declined",
          facts: [{
            statement: rawText,
            scope: "current_event",
            stance: rawText === "没有。" ? "denied" : "unknown",
            kind: "boundary_answer",
            quote: rawText
          }]
        }
      });
      const boundaryPayload = payload({
        naturalUnderstanding: presentation.understanding,
        naturalResponse: "这件事已经先记下来了。",
        responseKind: "checkpoint",
        questionSpec: null,
        checkpoint: { kind: "first", outcome: null }
      });

      expect(presentation.kind).toBe("boundary");
      const expectedUnderstanding = rawText === "这些都不贴切。"
        ? "你说这些说法都不贴切。"
        : rawText === "没法再具体了。"
          ? "你说这部分没法再具体了。"
          : "好，这部分先停在这里。";
      expect(presentation.understanding).toBe(expectedUnderstanding);
      expect(presentation.understanding).not.toContain("记下");
      expect(boundaryPayload.questionSpec).toBeNull();
      expect(runEventCenteredTurnQualityGate({
        payload: boundaryPayload,
        previousAssistantResponses: [],
        adviceRequested: false,
        pendingHypothesisStatement: null,
        firstCheckpointUnderstanding: presentation.understanding
      })).toMatchObject({ passed: true });
    }
  );

  it.each([
    ["没有。", "你说没有更具体的时刻了。"],
    ["想不起来。", "你暂时想不起更具体的时刻了。"],
    ["不知道。", "你暂时还说不清更具体的时刻。"],
    ["说不清。", "你暂时还说不清更具体的时刻。"]
  ])("短边界 %s 会带回唯一的具体时刻目标", (rawText, expected) => {
    const presentation = getEventCenteredFirstCheckpointPresentation({
      rawText,
      currentQuestionText: "你最想留下的是哪个具体时刻？",
      currentQuestionTarget: "light_event_anchor",
      decision: {
        answerSignal: "declined",
        facts: [{
          statement: rawText,
          scope: "current_event",
          stance: rawText === "没有。" ? "denied" : "unknown",
          kind: "boundary_answer",
          quote: rawText
        }]
      }
    });

    expect(presentation).toMatchObject({
      kind: "boundary",
      understanding: expected,
      safeFallback: expected
    });
  });

  it("第二检查点短回答也会明确它所回应的单一问题", () => {
    expect(resolveEventCenteredNaturalUnderstanding({
      rawText: "我还是说不清。",
      currentQuestionText: "当时最先出现的具体感受是什么？",
      currentQuestionTarget: "direct_experience",
      directive: {
        questionSpec: null,
        checkpoint: { kind: "second", outcome: null }
      },
      naturalUnderstanding: "好，这部分先停在这里。"
    })).toBe("你暂时还说不清当时的感受。");
  });

  it.each([
    [
      "relationship_position_or_boundary",
      "这次互动里，对方怎样回应时，你会更清楚自己在这段关系中的位置？",
      "你暂时还说不清自己在这段关系中的位置。"
    ],
    [
      "relationship_position_or_boundary",
      "这次互动里，对方怎样回应时，你会更确定这段关系是可靠的？",
      "你暂时还说不清什么回应会让这段关系显得可靠。"
    ],
    [
      "relationship_position_or_boundary",
      "这次互动里，双方怎样回应会让你感到有来有回？",
      "你暂时还说不清双方希望怎样有来有回。"
    ],
    [
      "relationship_position_or_boundary",
      "这段关系里，什么是你不能接受的边界？",
      "你暂时还说不清这段关系里什么不能接受。"
    ],
    [
      "action_condition_or_friction",
      "这次行动里，最难取舍的是哪一边？",
      "你暂时还说不清这次行动里最难取舍的两边。"
    ],
    [
      "action_condition_or_friction",
      "这次行动里，哪个条件真正帮上了忙？",
      "你暂时还说不清哪个条件真正帮上了忙。"
    ],
    [
      "action_condition_or_friction",
      "这次行动里，哪一步卡住了？",
      "你暂时还说不清这次行动具体卡在哪里。"
    ],
    [
      "action_condition_or_friction",
      "这次行动里，哪一小块可以调整？",
      "你暂时还说不清这次行动里哪一小块可以调整。"
    ]
  ])(
    "关系与行动问题会按公共焦点准确承接：%s / %s",
    (currentQuestionTarget, currentQuestionText, expected) => {
      expect(getEventCenteredTextBoundaryUnderstanding({
        rawText: "我还是说不清。",
        currentQuestionText,
        currentQuestionTarget
      })).toBe(expected);
    }
  );

  it.each([
    [
      "这段关系里，什么是你不能接受的边界？",
      "relationship_position_or_boundary",
      "你暂时不想再说这段关系里的边界。"
    ],
    [
      "这次行动里，哪一步卡住了？",
      "action_condition_or_friction",
      "你暂时不想再说这次行动里的阻力。"
    ]
  ])("短拒答会承接当前具体焦点：%s", (currentQuestionText, currentQuestionTarget, expected) => {
    expect(resolveEventCenteredNaturalUnderstanding({
      rawText: "暂时不想答。",
      currentQuestionText,
      currentQuestionTarget,
      directive: {
        questionSpec: null,
        checkpoint: { kind: "second", outcome: null }
      },
      naturalUnderstanding: "好，这部分先停在这里。"
    })).toBe(expected);
  });

  it.each([
    [null, "light_event_anchor"],
    ["当时发生了什么？你后来又做了什么？", "light_event_anchor"],
    ["你更接近难过还是生气？", "direct_experience"]
  ])("上下文不足或多目标问题使用通用边界：%s", (currentQuestionText, currentQuestionTarget) => {
    expect(getEventCenteredTextBoundaryUnderstanding({
      rawText: "不知道。",
      currentQuestionText,
      currentQuestionTarget
    })).toBeNull();
  });

  it.each([
    ["这些都不贴切。", "你说这些说法都不贴切。"],
    ["没法再具体了。", "你说这部分没法再具体了。"]
  ])("明确文本边界 %s 使用自然中文承接", (rawText, expected) => {
    expect(getEventCenteredTextBoundaryUnderstanding({
      rawText,
      currentQuestionText: "当时最先出现的具体感受是什么？",
      currentQuestionTarget: "direct_experience"
    })).toBe(expected);
  });

  it("第一检查点优先承接纠正，即使纠正原话包含否定词", () => {
    const presentation = getEventCenteredFirstCheckpointPresentation({
      rawText: "没有，我刚才说错了，延期是一周。",
      decision: {
        answerSignal: "correction",
        facts: [{
          statement: "延期是一周",
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: "延期是一周"
        }]
      }
    });

    expect(presentation).toMatchObject({
      kind: "correction",
      understanding: "我已按你的纠正更新：延期是一周。"
    });
  });

  it("第一检查点承接明确纠正，同时保持无追问", () => {
    const acknowledgement = getEventCenteredFirstCheckpointFactAcknowledgement({
      answerSignal: "correction",
      facts: [{
        statement: "延期是一周",
        scope: "current_event",
        stance: "affirmed",
        kind: "event_detail",
        quote: "是一周"
      }]
    });
    expect(acknowledgement).toMatchObject({
      kind: "correction",
      understanding: "我已按你的纠正更新：延期是一周。"
    });

    const correctionPayload = payload({
      naturalUnderstanding: acknowledgement!.understanding,
      naturalResponse: "这件事已经先记下来了。",
      responseKind: "checkpoint",
      questionSpec: null,
      checkpoint: { kind: "first", outcome: null }
    });
    expect(runEventCenteredTurnQualityGate({
      payload: correctionPayload,
      previousAssistantResponses: [],
      adviceRequested: false,
      pendingHypothesisStatement: null,
      firstCheckpointUnderstanding: acknowledgement!.understanding
    })).toEqual({ passed: true, safetyBlockers: [], qualityIssues: [] });
  });

  it("第一检查点承接明确否定，普通检查点仍使用固定短句", () => {
    const acknowledgement = getEventCenteredFirstCheckpointFactAcknowledgement({
      answerSignal: "declined",
      facts: [{
        statement: "我没有生气",
        scope: "current_event",
        stance: "denied",
        kind: "inner_experience",
        quote: "我没有生气"
      }]
    });
    expect(acknowledgement).toMatchObject({
      kind: "denial",
      understanding: "我已按你的原话记下：我没有生气。"
    });
    expect(resolveEventCenteredNaturalUnderstanding({
      rawText: "我没有生气。",
      directive: { questionSpec: null, checkpoint: { kind: "first", outcome: null } },
      naturalUnderstanding: "模型草稿",
      firstCheckpointUnderstanding: acknowledgement!.understanding
    })).toBe("我已按你的原话记下：我没有生气。");
    expect(getEventCenteredFirstCheckpointPresentation({
      rawText: "我没有生气。",
      decision: {
        answerSignal: "declined",
        facts: [{
          statement: "我没有生气",
          scope: "current_event",
          stance: "denied",
          kind: "inner_experience",
          quote: "我没有生气"
        }]
      }
    })).toMatchObject({
      kind: "denial",
      understanding: "我已按你的原话记下：我没有生气。"
    });
    expect(resolveEventCenteredNaturalUnderstanding({
      rawText: "今天开会时我说明了延期风险。",
      directive: { questionSpec: null, checkpoint: { kind: "first", outcome: null } },
      naturalUnderstanding: "模型草稿"
    })).toBe(EVENT_CENTERED_FIRST_CHECKPOINT_UNDERSTANDING);
  });

  it("模型误标否定且原话没有否定时，第一检查点继续使用普通承接", () => {
    expect(getEventCenteredFirstCheckpointPresentation({
      rawText: "我当时觉得他不尊重我，也有点生气。",
      decision: {
        answerSignal: "answered",
        facts: [{
          statement: "我当时觉得他不尊重我，也有点生气",
          scope: "current_event",
          stance: "denied",
          kind: "inner_experience",
          quote: "我当时觉得他不尊重我，也有点生气"
        }]
      }
    })).toMatchObject({
      kind: "evidence",
      understanding: expect.not.stringContaining("明确否定")
    });
  });

  it("纠正承接触发安全回退时仍保留纠正语义", () => {
    const safe = createSafeEventCenteredPayload({
      payload: payload({
        naturalUnderstanding: "我会更新内部结构。",
        naturalResponse: "要继续吗？",
        responseKind: "checkpoint",
        questionSpec: null,
        checkpoint: { kind: "first", outcome: null }
      }),
      exactResponse: "这件事已经先记下来了。",
      firstCheckpointUnderstanding: "我已按你的纠正更新这处。"
    });

    expect(safe).toMatchObject({
      naturalUnderstanding: "我已按你的纠正更新这处。",
      naturalResponse: "这件事已经先记下来了。",
      questionSpec: null,
      checkpoint: { kind: "first", outcome: null }
    });
  });

  it.each([
    "用户提到今天开会时主动说明了延期风险。",
    "用户从纸笺中选择了“想法”角度。",
    "来访者点击了“理解感受”。"
  ])("拦截第三人称后台观察口吻：%s", (naturalUnderstanding) => {
    const thirdPerson = payload({
      naturalUnderstanding,
      naturalResponse: "这件事已经先记下来了。",
      responseKind: "checkpoint",
      questionSpec: null,
      checkpoint: { kind: "first", outcome: null }
    });
    const result = runEventCenteredTurnQualityGate({
      payload: thirdPerson,
      previousAssistantResponses: [],
      adviceRequested: false,
      pendingHypothesisStatement: null,
      firstCheckpointUnderstanding: thirdPerson.naturalUnderstanding
    });

    expect(result.qualityIssues).toContain("third_person_observer_voice");
    const safe = createSafeEventCenteredPayload({
      payload: thirdPerson,
      exactResponse: "这件事已经先记下来了。",
      firstCheckpointUnderstanding: EVENT_CENTERED_FIRST_CHECKPOINT_UNDERSTANDING
    });
    expect(safe.naturalUnderstanding).toBe(EVENT_CENTERED_FIRST_CHECKPOINT_UNDERSTANDING);
    expect(safe.naturalUnderstanding).not.toMatch(/用户|来访者/u);
  });

  it("事件里谈到自己的用户时保留正常原话", () => {
    const result = runEventCenteredTurnQualityGate({
      payload: payload({
        naturalUnderstanding: "你刚刚说到：“我的用户选择了升级套餐”。"
      }),
      previousAssistantResponses: [],
      adviceRequested: false,
      pendingHypothesisStatement: null
    });

    expect(result.qualityIssues).not.toContain("third_person_observer_voice");
  });

  it("honest_limit 进入第二检查点时诚实收束，不把有限材料包装成线索", () => {
    const checkpoint = createSafeEventCenteredPayload({
      payload: payload({
        naturalUnderstanding: "你要不要继续看看？",
        naturalResponse: "要不要继续补充？还是直接生成？",
        responseKind: "checkpoint",
        questionSpec: null,
        checkpoint: { kind: "second", outcome: "目前能确认的内容还有限。" },
        angleOutcome: {
          angle: "feeling",
          kind: "honest_limit",
          statement: "目前能确认的内容还有限。"
        }
      }),
      exactResponse: "你可以继续深入，或先停在这里。"
    });

    expect(checkpoint.naturalUnderstanding).toBe("我先按你已经明确表达的内容来理解。");
    expect(checkpoint.naturalResponse).toBe("这部分还不急着说成一个结论，我们先停在这里。");
  });

  it("已有可信线索进入第二检查点时保留正向收束", () => {
    const checkpoint = createSafeEventCenteredPayload({
      payload: payload({
        naturalUnderstanding: "你要不要继续看看？",
        naturalResponse: "要不要继续补充？还是直接生成？",
        responseKind: "checkpoint",
        questionSpec: null,
        checkpoint: { kind: "second", outcome: "你已经看见自己很在意提前被告知。" },
        angleOutcome: {
          angle: "feeling",
          kind: "insight",
          statement: "你已经看见自己很在意提前被告知。"
        }
      }),
      exactResponse: "你可以继续深入，或先停在这里。"
    });

    expect(checkpoint.naturalResponse).toBe("你已经看见自己很在意提前被告知。");
  });

  it("安全草稿被清除后，承接用户愿意继续表达的边界并保留当前单一问题", () => {
    expect(isEventCenteredContinueWithinBoundaryExpression("我愿意继续说说，但请尊重我的边界。")).toBe(true);
    expect(isEventCenteredContinueWithinBoundaryExpression("我不想继续了。")).toBe(false);

    const safePayload = createSafeEventCenteredPayload({
      payload: payload({
        naturalUnderstanding: "这说明你有焦虑症。",
        naturalResponse: "你必须马上辞职。"
      }),
      exactResponse: "这份感受最先被哪个具体瞬间带出来？",
      acknowledgeBoundaryContinuation: true
    });

    expect(safePayload.naturalUnderstanding).toBe("好，我们只聊你愿意说的部分。");
    expect(safePayload.naturalResponse).toBe("这份感受最先被哪个具体瞬间带出来？");
    expect(safePayload.questionSpec).toEqual(payload().questionSpec);
    expect(safePayload.checkpoint).toBeNull();

    const stopped = createSafeEventCenteredPayload({
      payload: payload({
        responseKind: "checkpoint",
        questionSpec: null,
        checkpoint: { kind: "second", outcome: null }
      }),
      exactResponse: "这个角度先停在这里。",
      acknowledgeBoundaryContinuation: true
    });
    expect(stopped.naturalUnderstanding).toBe("我先按你已经明确表达的内容来理解。");
    expect(stopped.naturalResponse).toBe("这个角度先停在这里。");
  });

  it("普通成功生成也会先承接继续表达的边界，文本停止仍优先收束", () => {
    const directive = {
      questionSpec: payload().questionSpec,
      checkpoint: null
    };
    expect(resolveEventCenteredNaturalUnderstanding({
      rawText: "我愿意继续说说，但请尊重我的边界。",
      directive,
      naturalUnderstanding: "你正在慢慢说清这一刻。"
    })).toBe(EVENT_CENTERED_CONTINUE_WITH_BOUNDARY_ACKNOWLEDGEMENT);

    expect(resolveEventCenteredNaturalUnderstanding({
      rawText: "我不想继续了。",
      directive: { questionSpec: null, checkpoint: { kind: "second", outcome: null } },
      naturalUnderstanding: "我会先按你已经说出的内容收住。"
    })).toBe("我会先按你已经说出的内容收住。");
  });

  it("纸笺选择在模型越界时回退为单句承接", () => {
    const selection = createSafeEventCenteredPayload({
      payload: payload({
        naturalResponse: "你想先记哪一件？请从下面选择。",
        responseKind: "clarification",
        questionSpec: {
          ...payload().questionSpec!,
          phase: "event_focus_clarification",
          angle: null,
          target: "event_selection",
          opportunityNumber: null,
          surfaceLevel: "low_pressure_choice"
        }
      }),
      exactResponse: "你想先记录哪一件？"
    });

    expect(selection.naturalResponse).toBe("我先把你刚才提到的两件事都留在这里。");
  });
});
