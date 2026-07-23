import { describe, expect, it } from "vitest";

import {
  EVENT_CENTERED_FIRST_CHECKPOINT_UNDERSTANDING,
  EVENT_CENTERED_CONTINUE_WITH_BOUNDARY_ACKNOWLEDGEMENT,
  createSafeEventCenteredPayload,
  getEventCenteredFirstCheckpointFactAcknowledgement,
  isEventCenteredContinueWithinBoundaryExpression,
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
    expect(resolveEventCenteredNaturalUnderstanding({
      rawText: "今天开会时我说明了延期风险。",
      directive: { questionSpec: null, checkpoint: { kind: "first", outcome: null } },
      naturalUnderstanding: "模型草稿"
    })).toBe(EVENT_CENTERED_FIRST_CHECKPOINT_UNDERSTANDING);
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

    expect(safePayload.naturalUnderstanding).toBe("好，我们只停在你愿意说的部分。");
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
