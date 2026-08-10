import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  completeStructuredOutput: vi.fn(),
  getAIProvider: vi.fn(async () => ({ name: "event-focus-test-provider" }))
}));

vi.mock("@/server/services/ai", () => ({
  getAIProvider: mocks.getAIProvider
}));

vi.mock("@/server/services/ai/structured-output", () => ({
  completeStructuredOutput: mocks.completeStructuredOutput
}));

import { understandEventCenteredTurnAI } from "@/server/services/interview/event-centered-ai.service";
import { createInitialEventCenteredDialogueState } from "@/features/interview/event-centered/dialogue-state";
import { decideEventCenteredTurnPolicy } from "@/features/interview/event-centered/interview-policy";

function policyFor(
  rawText: string,
  understanding: Awaited<ReturnType<typeof understandEventCenteredTurnAI>>["decision"]
) {
  return decideEventCenteredTurnPolicy({
    state: createInitialEventCenteredDialogueState(),
    action: "reply",
    rawText,
    currentQuestionText: null,
    facts: [],
    understanding,
    bareAngleChange: false
  });
}

describe("event-centered AI understanding service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("评测可注入独立 provider，生产默认 provider 查找保持不变", async () => {
    const provider = {
      name: "injected-evaluation-provider",
      complete: vi.fn()
    };
    mocks.completeStructuredOutput.mockResolvedValue(null);

    await understandEventCenteredTurnAI({
      rawText: "今天开会时我主动说明了延期风险。",
      phase: "event_recording",
      activeAngle: null,
      currentQuestion: null,
      facts: [],
      allowUnsupportedHypothesis: false,
      provider
    });

    expect(mocks.getAIProvider).not.toHaveBeenCalled();
    expect(mocks.completeStructuredOutput).toHaveBeenCalledWith(
      expect.objectContaining({ provider })
    );
  });

  it("离线评测可单独提高理解输出预算、重试次数和超时", async () => {
    const provider = {
      name: "evaluation-understanding-provider",
      complete: vi.fn()
    };
    mocks.completeStructuredOutput.mockResolvedValue(null);

    await understandEventCenteredTurnAI({
      rawText: "早上找不到钥匙。另外，晚上坚持跑完了最后一公里。",
      phase: "event_recording",
      activeAngle: null,
      currentQuestion: null,
      facts: [],
      allowUnsupportedHypothesis: false,
      provider,
      maxTokens: 1600,
      maxAttempts: 3,
      timeoutMs: 18_000
    });

    expect(mocks.completeStructuredOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        provider,
        maxTokens: 1600,
        maxAttempts: 3,
        timeoutMs: 18_000
      })
    );
  });

  it("事件记录的确定性识别分别保留事件和个人反应来源", async () => {
    mocks.completeStructuredOutput.mockResolvedValue(null);
    const rawText = "今天我拒绝了一个临时加塞的请求。我有点内疚，也觉得时间安排终于被自己守住了。";

    const result = await understandEventCenteredTurnAI({
      rawText,
      phase: "event_recording",
      activeAngle: null,
      currentQuestion: null,
      facts: [],
      allowUnsupportedHypothesis: false,
      provider: null
    });

    expect(result.decision.coreEventIdentifiable).toBe(true);
    expect(result.decision.facts).toEqual([
      expect.objectContaining({
        kind: "event_detail",
        quote: rawText
      }),
      expect.objectContaining({
        kind: "inner_experience",
        statement: "我有点内疚，也觉得时间安排终于被自己守住了",
        quote: "我有点内疚，也觉得时间安排终于被自己守住了"
      })
    ]);
  });

  it("模型给出重叠选项时，fallback 仍按“另外”识别两个完整事件", async () => {
    const rawText =
      "回家路上看到晚霞，我特意停下来拍了一张。 另外，午饭时朋友突然问我最近好不好，我愣了一下。";
    mocks.completeStructuredOutput.mockResolvedValue({
      eventBoundary: "multiple_events",
      coreEventIdentifiable: false,
      answerSignal: "partly_answered",
      facts: [],
      angleEvidence: [],
      outcomeCandidate: null,
      unsupportedHypothesis: null,
      adviceRequest: null,
      eventOptions: [
        { label: "看到晚霞", sourceText: "回家路上看到晚霞" },
        { label: "停下来拍照", sourceText: "我特意停下来拍了一张" }
      ],
      correctionTargetHint: null,
      boundaryReason: "需要先选择一件事。"
    });

    const result = await understandEventCenteredTurnAI({
      rawText,
      phase: "event_recording",
      activeAngle: null,
      currentQuestion: null,
      facts: [],
      allowUnsupportedHypothesis: false
    });

    expect(result.decision.eventBoundary).toBe("multiple_events");
    expect(result.decision.eventOptions).toEqual([
      {
        label: "回家路上看到晚霞，我特意停下来拍了一张",
        sourceText: "回家路上看到晚霞，我特意停下来拍了一张"
      },
      {
        label: "午饭时朋友突然问我最近好不好，我愣了一下",
        sourceText: "午饭时朋友突然问我最近好不好，我愣了一下"
      }
    ]);
    expect(result.outputOrigin).toBe("llm");
  });

  it("模型已判定两件事但缺少可靠选项时，保留聚焦边界且不合并事实", async () => {
    const rawText = "今天发生的两段经历我都想说，一段和工作有关，一段和家里有关。";
    mocks.completeStructuredOutput.mockResolvedValue({
      eventBoundary: "multiple_events",
      coreEventIdentifiable: false,
      answerSignal: "partly_answered",
      facts: [{
        statement: rawText,
        scope: "current_event",
        stance: "affirmed",
        kind: "event_detail",
        quote: rawText
      }],
      angleEvidence: [],
      outcomeCandidate: null,
      unsupportedHypothesis: null,
      adviceRequest: null,
      eventOptions: [],
      correctionTargetHint: null,
      boundaryReason: "这里包含两件事。"
    });

    const result = await understandEventCenteredTurnAI({
      rawText,
      phase: "event_recording",
      activeAngle: null,
      currentQuestion: null,
      facts: [],
      allowUnsupportedHypothesis: false
    });

    expect(result.decision).toMatchObject({
      eventBoundary: "multiple_events",
      coreEventIdentifiable: false,
      answerSignal: "partly_answered",
      facts: [],
      eventOptions: []
    });
  });

  it("模型给出合法两项时，选择前仍清空事实和角度推断", async () => {
    const rawText =
      "下午会议被临时取消，我重新安排了后面的工作。另外，晚上和朋友发生误会，我回家后一直有点在意。";
    mocks.completeStructuredOutput.mockResolvedValue({
      eventBoundary: "multiple_events",
      coreEventIdentifiable: true,
      answerSignal: "answered",
      facts: [{
        statement: "下午会议被临时取消",
        scope: "current_event",
        stance: "affirmed",
        kind: "event_detail",
        quote: "下午会议被临时取消"
      }],
      angleEvidence: [{
        angle: "feeling",
        evidence: "一直有点在意",
        valueAddedInsightPossible: true
      }],
      outcomeCandidate: null,
      unsupportedHypothesis: {
        statement: "这可能说明用户很在意关系稳定",
        scope: "current_event",
        stance: "affirmed",
        kind: "stated_interpretation"
      },
      adviceRequest: null,
      eventOptions: [
        { label: "会议取消", sourceText: "下午会议被临时取消" },
        { label: "朋友误会", sourceText: "晚上和朋友发生误会" }
      ],
      correctionTargetHint: null,
      boundaryReason: "需要先选择一件。"
    });

    const result = await understandEventCenteredTurnAI({
      rawText,
      phase: "event_recording",
      activeAngle: null,
      currentQuestion: null,
      facts: [],
      allowUnsupportedHypothesis: true
    });

    expect(result.decision).toMatchObject({
      eventBoundary: "multiple_events",
      coreEventIdentifiable: false,
      facts: [],
      angleEvidence: [],
      outcomeCandidate: null,
      unsupportedHypothesis: null,
      eventOptions: [
        {
          label: "下午会议被临时取消",
          sourceText: "下午会议被临时取消，我重新安排了后面的工作"
        },
        {
          label: "晚上和朋友发生误会",
          sourceText: "晚上和朋友发生误会，我回家后一直有点在意"
        }
      ]
    });
  });

  it.each(["unknown", "declined"] as const)(
    "两件事已成立时把模型的 %s 规范为聚焦选择",
    async (answerSignal) => {
      const rawText =
        "客户临时改需求，我先沉默了一会儿才回复。另外，回家路上看到晚霞，我特意停下来拍了一张。";
      mocks.completeStructuredOutput.mockResolvedValue({
        eventBoundary: "multiple_events",
        coreEventIdentifiable: false,
        answerSignal,
        facts: [{
          statement: rawText,
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: rawText
        }],
        angleEvidence: [],
        outcomeCandidate: null,
        unsupportedHypothesis: null,
        adviceRequest: null,
        eventOptions: [
          { label: "客户改需求", sourceText: "客户临时改需求" },
          { label: "晚霞", sourceText: "回家路上看到晚霞" }
        ],
        correctionTargetHint: null,
        boundaryReason: "这里有两件事。"
      });

      const understanding = await understandEventCenteredTurnAI({
        rawText,
        phase: "event_recording",
        activeAngle: null,
        currentQuestion: null,
        facts: [],
        allowUnsupportedHypothesis: false
      });
      const policy = policyFor(rawText, understanding.decision);

      expect(understanding.decision).toMatchObject({
        eventBoundary: "multiple_events",
        answerSignal: "partly_answered",
        facts: [],
        eventOptions: [
          {
            sourceText: "客户临时改需求，我先沉默了一会儿才回复"
          },
          {
            sourceText: "回家路上看到晚霞，我特意停下来拍了一张"
          }
        ]
      });
      expect(policy.directive).toMatchObject({
        responseKind: "clarification",
        questionSpec: {
          target: "event_selection",
          surfaceLevel: "low_pressure_choice"
        },
        checkpoint: null
      });
      expect(policy.nextState.focusOptions).toHaveLength(2);
    }
  );

  it.each(["没有。", "不知道。", "不想选。"])(
    "独立边界“%s”保留退出边界，不伪造第一检查点",
    async (rawText) => {
      mocks.completeStructuredOutput.mockResolvedValue({
        eventBoundary: "multiple_events",
        coreEventIdentifiable: false,
        answerSignal: "unknown",
        facts: [],
        angleEvidence: [],
        outcomeCandidate: null,
        unsupportedHypothesis: null,
        adviceRequest: null,
        eventOptions: [],
        correctionTargetHint: null,
        boundaryReason: "模型误判为两件事。"
      });

      const understanding = await understandEventCenteredTurnAI({
        rawText,
        phase: "event_recording",
        activeAngle: null,
        currentQuestion: null,
        facts: [],
        allowUnsupportedHypothesis: false
      });
      const policy = policyFor(rawText, understanding.decision);

      expect(understanding.decision.answerSignal).toBe("declined");
      expect(understanding.decision.eventOptions).toEqual([]);
      expect(policy.directive).toMatchObject({
        responseKind: "acknowledgement",
        checkpoint: null
      });
      expect(policy.nextState.focusOptions).toEqual([]);
      expect(policy.nextState.currentQuestion).toBeNull();
    }
  );
});
