import { describe, expect, it } from "vitest";

import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_4_RUNTIME,
  buildEventCenteredCompleteResponseFirstV14Messages,
  createEventCenteredCompleteResponseFirstV14Envelope,
  extractEventCenteredCompleteResponseFirstV14QuestionFocus,
  validateEventCenteredCompleteResponseFirstV14Output
} from "@/features/interview/event-centered/complete-response-first-v1-4";

const baseInput = {
  rawText: "继续和我聊聊吧，帮我深挖一下。",
  phase: "deep_companionship" as const,
  activeAngle: "thought" as const,
  currentQuestion: null,
  currentQuestionTarget: null,
  correctionRequested: false,
  correctionTargetAssistantMessageId: null,
  facts: [],
  recentTurns: [],
  microgoal: null
};

describe("complete response first v1.4", () => {
  it("生成前先做意图、覆盖、目标和依据检查", () => {
    expect(EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_4_RUNTIME).toMatchObject({
      maxTokens: 1_280,
      maxAttempts: 1,
      timeoutMs: 45_000,
      temperature: 0.2,
      thinking: "disabled",
      responseFormat: null
    });
    const prompt = buildEventCenteredCompleteResponseFirstV14Messages(baseInput)
      .map((message) => message.content)
      .join("\n");
    expect(prompt.indexOf("1. 意图")).toBeLessThan(prompt.indexOf("2. 已知"));
    expect(prompt.indexOf("2. 已知")).toBeLessThan(prompt.indexOf("3. 新目标"));
    expect(prompt.indexOf("3. 新目标")).toBeLessThan(prompt.indexOf("4. 依据"));
    expect(prompt.indexOf("4. 依据")).toBeLessThan(prompt.indexOf("5. 覆盖"));
    expect(prompt).toContain("第三方为什么这样做");
    expect(prompt).toContain("原文能够回答时删除并重选");
  });

  it("多个连续问句只记录观察并保存一个回答焦点片段", () => {
    const response =
      "这份落差确实很重。你现在最希望对方理解哪一部分？是你的努力，还是你需要被尊重的感觉？";
    expect(extractEventCenteredCompleteResponseFirstV14QuestionFocus(response))
      .toBe("你现在最希望对方理解哪一部分？是你的努力，还是你需要被尊重的感觉？");
    expect(createEventCenteredCompleteResponseFirstV14Envelope({
      generationInput: baseInput,
      response
    }).interaction).toEqual({
      kind: "ask",
      question: "你现在最希望对方理解哪一部分？是你的努力，还是你需要被尊重的感觉？"
    });
    expect(validateEventCenteredCompleteResponseFirstV14Output({
      generationInput: baseInput,
      response
    })).toEqual([]);
  });

  it("明确停止后仍然保持零问题硬边界", () => {
    const generationInput = {
      ...baseInput,
      rawText: "今天我不想继续聊了，就先到这里吧。"
    };
    expect(validateEventCenteredCompleteResponseFirstV14Output({
      generationInput,
      response: "好，今天先到这里。你还想补充一点吗？"
    })).toContain("EXPLICIT_STOP_STILL_OPEN");
    expect(createEventCenteredCompleteResponseFirstV14Envelope({
      generationInput,
      response: "好，今天就先到这里。"
    }).interaction).toEqual({ kind: "stop", question: null });
  });
});
