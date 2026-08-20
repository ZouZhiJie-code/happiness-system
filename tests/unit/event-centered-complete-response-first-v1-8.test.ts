import { describe, expect, it } from "vitest";

import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_8_RUNTIME,
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_8_STRATEGY,
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_8_VERSION,
  buildEventCenteredCompleteResponseFirstV18Messages
} from "@/features/interview/event-centered/complete-response-first-v1-8";
import { EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_6_RUNTIME } from "@/features/interview/event-centered/complete-response-first-v1-6";

const baseInput = {
  rawText: "继续和我聊聊，帮我再往下挖一层。",
  phase: "deep_companionship" as const,
  activeAngle: "relationship" as const,
  currentQuestion: "你当时回应了吗，还是把情绪压下去了？",
  currentQuestionTarget: "prior-behavior-choice",
  microgoal: null,
  facts: [],
  recentTurns: [{
    user: "我当时主要是生气，因为他明知原因却公开质疑我。",
    assistantMessageId: "assistant-1",
    assistantUnderstanding: "",
    assistantQuestion: "你当时回应了吗，还是把情绪压下去了？",
    assistantResponse: "你当时回应了吗，还是把情绪压下去了？"
  }],
  correctionRequested: false,
  correctionTargetAssistantMessageId: null
};

describe("complete response first v1.8", () => {
  it("keeps the v1.6 runtime and uses an independent strategy identity", () => {
    expect(EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_8_STRATEGY)
      .toBe("complete_response_v1_8");
    expect(EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_8_VERSION)
      .toContain("explicit-progress-obligation");
    expect(EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_8_RUNTIME)
      .toBe(EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_6_RUNTIME);
  });

  it("turns an explicit deepen request into a non-reconfirmation obligation", () => {
    const [system, user] = buildEventCenteredCompleteResponseFirstV18Messages(baseInput);

    expect(system.content).toContain("上一问题本轮被跳过");
    expect(system.content).toContain("禁止重复、改写、缩窄上一问题");
    expect(system.content).toContain("直接执行，不再询问用户是否要做这件事");
    expect(system.content).toContain("找不到合格新层时");
    expect(user.content).toContain("继续和我聊聊");
    expect(user.content).toContain("你当时回应了吗");
  });

  it("executes an explicitly named discussion topic without reconfirming it", () => {
    const [system] = buildEventCenteredCompleteResponseFirstV18Messages({
      ...baseInput,
      rawText: "我想聊聊这两种相处为什么感受不同。",
      currentQuestion: null,
      currentQuestionTarget: null
    });

    expect(system.content).toContain("用户点名要聊某种差别时，直接探索");
    expect(system.content).toContain("不能先问用户是否要聊这个差别");
  });
});
