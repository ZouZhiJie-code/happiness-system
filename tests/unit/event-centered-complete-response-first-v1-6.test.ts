import { describe, expect, it } from "vitest";

import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_6_RUNTIME,
  buildEventCenteredCompleteResponseFirstV16Messages
} from "@/features/interview/event-centered/complete-response-first-v1-6";

const baseInput = {
  rawText: "我有很大的落差，也觉得自己不被重视。",
  phase: "deep_companionship" as const,
  activeAngle: "relationship" as const,
  currentQuestion: "你当时是什么感觉？",
  currentQuestionTarget: "historical_current_question",
  correctionRequested: false,
  correctionTargetAssistantMessageId: null,
  facts: [],
  recentTurns: [],
  microgoal: null
};

describe("complete response first v1.6", () => {
  it("只增加跨场景的同层错误与跨层正确对比", () => {
    expect(EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_6_RUNTIME).toMatchObject({
      maxTokens: 1_280,
      maxAttempts: 1,
      timeoutMs: 45_000,
      temperature: 0.2,
      thinking: "disabled",
      responseFormat: null
    });
    const prompt = buildEventCenteredCompleteResponseFirstV16Messages(baseInput)
      .map((message) => message.content)
      .join("\n");
    expect(prompt).toContain("对比例子一");
    expect(prompt).toContain("最强烈的是委屈还是焦虑");
    expect(prompt).toContain("进入尚未回答的影响层");
    expect(prompt).toContain("进入尚未回答的期待层");
    expect(prompt).toContain("不能照抄人物、事件、选项或问法");
  });
});
