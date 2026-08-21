import { describe, expect, it } from "vitest";

import { createInitialEventCenteredDialogueState } from "@/features/interview/event-centered/dialogue-state";
import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_VERSION,
  alignEventCenteredCompleteResponseFirstV12Policy,
  buildEventCenteredCompleteResponseFirstV12Messages,
  eventCenteredCompleteResponseFirstV12OutputSchema,
  projectEventCenteredCompleteResponseFirstV12Turn,
  validateEventCenteredCompleteResponseFirstV12Output,
  type EventCenteredCompleteResponseFirstV12Input,
  type EventCenteredCompleteResponseFirstV12Output
} from "@/features/interview/event-centered/complete-response-first-v1-2";

function generationInput(
  overrides: Partial<EventCenteredCompleteResponseFirstV12Input> = {}
): EventCenteredCompleteResponseFirstV12Input {
  return {
    rawText: "其实我还是很在意比较，继续和我深挖一下。",
    phase: "deep_companionship",
    activeAngle: "thought",
    currentQuestion: null,
    currentQuestionTarget: null,
    correctionRequested: false,
    correctionTargetAssistantMessageId: null,
    facts: [],
    recentTurns: [{
      user: "其实我还是很在意比较。",
      assistantUnderstanding: "",
      assistantQuestion: null,
      assistantResponse: "我明白了，你仍然很在意比较。",
      assistantMessageId: "assistant-1"
    }],
    microgoal: null,
    ...overrides
  };
}

function askingOutput(): EventCenteredCompleteResponseFirstV12Output {
  return {
    response: "这次可以往比较发生之前看一步。还没看到结果时，你会不会已经开始衡量自己？",
    interaction: {
      kind: "ask",
      question: "还没看到结果时，你会不会已经开始衡量自己？"
    },
    facts: [{
      statement: "用户仍然在意比较",
      quote: "还是很在意比较",
      kind: "stated_interpretation"
    }],
    correction: {
      kind: "none",
      supersededAssistantMessageId: null
    }
  };
}

describe("event-centered complete response first v1.2", () => {
  it("严格限制最小结构中的提问与纠正关系", () => {
    expect(eventCenteredCompleteResponseFirstV12OutputSchema.safeParse(
      askingOutput()
    ).success).toBe(true);
    expect(eventCenteredCompleteResponseFirstV12OutputSchema.safeParse({
      ...askingOutput(),
      interaction: { kind: "respond", question: "还要继续吗？" }
    }).success).toBe(false);
    expect(eventCenteredCompleteResponseFirstV12OutputSchema.safeParse({
      ...askingOutput(),
      correction: { kind: "correction", supersededAssistantMessageId: null }
    }).success).toBe(false);
  });

  it("只校验可确定的正文、问题、事实来源和纠正来源", () => {
    const valid = validateEventCenteredCompleteResponseFirstV12Output({
      generationInput: generationInput(),
      output: askingOutput()
    });
    expect(valid).toEqual([]);

    const invalid = validateEventCenteredCompleteResponseFirstV12Output({
      generationInput: generationInput({
        rawText: "今天先到这里。",
        correctionRequested: true
      }),
      output: askingOutput()
    });
    expect(invalid).toEqual(expect.arrayContaining([
      "EXPLICIT_STOP_MUST_BE_HONORED",
      "FACT_QUOTE_NOT_IN_CURRENT_USER_TURN",
      "EXPLICIT_CORRECTION_MUST_BE_RECORDED"
    ]));
  });

  it("Prompt 提供最近完整可见回应，同时只要求最小 JSON", () => {
    const messages = buildEventCenteredCompleteResponseFirstV12Messages(
      generationInput()
    );
    const serialized = messages.map((message) => message.content).join("\n");
    expect(serialized).toContain("本轮唯一一条用户可见回应");
    expect(serialized).toContain("我明白了，你仍然很在意比较。");
    expect(serialized).toContain('"response"');
    expect(serialized).toContain('"interaction"');
    expect(serialized).not.toContain('"semanticPlan"');
    expect(serialized).not.toContain('"outcomeAssessment"');
  });

  it("把最小输出映射为事实、纠正和单一问题状态", () => {
    const turn = projectEventCenteredCompleteResponseFirstV12Turn({
      generationInput: generationInput(),
      output: askingOutput()
    });
    expect(turn.decision.turnAction).toBe("ask");
    expect(turn.reply.question).toBe(askingOutput().interaction.question);
    expect(turn.understanding.factDeltas).toEqual([expect.objectContaining({
      quote: "还是很在意比较",
      stance: "affirmed"
    })]);
    expect(turn.decision.selectedTarget).toMatch(/^complete-response-v1-2:/u);
  });

  it("模型选择提问时覆盖旧检查点，并让保存状态与实际问题一致", () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "event_recording";
    const turn = projectEventCenteredCompleteResponseFirstV12Turn({
      generationInput: generationInput({
        phase: "event_recording",
        activeAngle: null
      }),
      output: askingOutput()
    });
    const policy = alignEventCenteredCompleteResponseFirstV12Policy({
      state,
      action: "reply",
      turn,
      output: askingOutput(),
      basePolicy: {
        nextState: {
          ...structuredClone(state),
          phase: "checkpoint_one"
        },
        directive: {
          responseKind: "checkpoint",
          questionSpec: null,
          checkpoint: { kind: "first", outcome: null },
          angleOutcome: null,
          exactResponse: "这件事已经先记下来了。"
        },
        angleOutcome: null,
        preserveCurrentQuestion: false
      }
    });

    expect(policy.directive.checkpoint).toBeNull();
    expect(policy.directive.exactResponse).toBe(askingOutput().interaction.question);
    expect(policy.nextState.currentQuestion?.target).toBe(turn.decision.selectedTarget);
    expect(policy.nextState.strategyVersion).toBe(
      EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_VERSION
    );
  });
});
