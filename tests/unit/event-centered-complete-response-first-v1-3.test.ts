import { describe, expect, it } from "vitest";

import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_3_RUNTIME,
  buildEventCenteredCompleteResponseFirstV13Messages,
  createEventCenteredCompleteResponseFirstV13Envelope,
  extractEventCenteredCompleteResponseFirstV13Question,
  validateEventCenteredCompleteResponseFirstV13Output
} from "@/features/interview/event-centered/complete-response-first-v1-3";

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

describe("complete response first v1.3", () => {
  it("只输出纯文本，固定快速运行参数", () => {
    expect(EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_3_RUNTIME).toMatchObject({
      maxTokens: 1_280,
      maxAttempts: 1,
      timeoutMs: 45_000,
      temperature: 0.2,
      thinking: "disabled",
      responseFormat: null
    });
    const prompt = buildEventCenteredCompleteResponseFirstV13Messages(baseInput)
      .map((message) => message.content)
      .join("\n");
    expect(prompt).toContain("只输出最终中文回应");
    expect(prompt).toContain("真正尚未回答的新层");
    expect(prompt).not.toContain('"response":"一至两个');
  });

  it("从一个问题的完整回应中确定性提取问题", () => {
    const response = "你已经把比较这件事说清楚了。没有具体结果时，你也会默默衡量自己吗？";
    expect(extractEventCenteredCompleteResponseFirstV13Question(response))
      .toBe("没有具体结果时，你也会默默衡量自己吗？");
    expect(createEventCenteredCompleteResponseFirstV13Envelope({
      generationInput: baseInput,
      response
    }).interaction).toEqual({
      kind: "ask",
      question: "没有具体结果时，你也会默默衡量自己吗？"
    });
    expect(validateEventCenteredCompleteResponseFirstV13Output({
      generationInput: baseInput,
      response
    })).toEqual([]);
  });

  it("明确停止时拒绝继续提问", () => {
    const generationInput = {
      ...baseInput,
      rawText: "今天我不想继续聊了，就先到这里吧。"
    };
    expect(validateEventCenteredCompleteResponseFirstV13Output({
      generationInput,
      response: "好，今天先到这里。你还想再补充一点吗？"
    })).toContain("EXPLICIT_STOP_STILL_OPEN");
    expect(createEventCenteredCompleteResponseFirstV13Envelope({
      generationInput,
      response: "好，今天先到这里。"
    }).interaction).toEqual({ kind: "stop", question: null });
  });
});
