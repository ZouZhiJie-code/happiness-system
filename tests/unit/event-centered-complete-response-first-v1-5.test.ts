import { describe, expect, it } from "vitest";

import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_5_RUNTIME,
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_5_VERSION,
  buildEventCenteredCompleteResponseFirstV15Messages,
  createEventCenteredCompleteResponseFirstV15Envelope,
  validateEventCenteredCompleteResponseFirstV15Output
} from "@/features/interview/event-centered/complete-response-first-v1-5";

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

describe("complete response first v1.5", () => {
  it("只增加语义层覆盖方法并继承运行参数", () => {
    expect(EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_5_VERSION).toContain(
      "semantic-layer-coverage"
    );
    expect(EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_5_RUNTIME).toMatchObject({
      maxTokens: 1_280,
      maxAttempts: 1,
      timeoutMs: 45_000,
      temperature: 0.2,
      thinking: "disabled",
      responseFormat: null
    });
    const prompt = buildEventCenteredCompleteResponseFirstV15Messages(baseInput)
      .map((message) => message.content)
      .join("\n");
    expect(prompt.indexOf("1. 当前动作")).toBeLessThan(
      prompt.indexOf("3. 信息层覆盖")
    );
    expect(prompt.indexOf("3. 信息层覆盖")).toBeLessThan(
      prompt.indexOf("5. 新目标")
    );
    expect(prompt).toContain("感受与身体反应");
    expect(prompt).toContain("换成更细、近义、换时间措辞或二选一");
    expect(prompt).toContain("不能算新增信息");
  });

  it("保持问号观察和明确停止硬边界", () => {
    const response =
      "我接住你想继续往下聊。你现在更想弄清哪一层？是关系里的期待，还是接下来怎么做？";
    expect(validateEventCenteredCompleteResponseFirstV15Output({
      generationInput: baseInput,
      response
    })).toEqual([]);
    expect(createEventCenteredCompleteResponseFirstV15Envelope({
      generationInput: baseInput,
      response
    }).interaction.kind).toBe("ask");

    const stopInput = { ...baseInput, rawText: "今天先到这里，不继续聊了。" };
    expect(validateEventCenteredCompleteResponseFirstV15Output({
      generationInput: stopInput,
      response: "好，今天先到这里。你还想补充什么吗？"
    })).toContain("EXPLICIT_STOP_STILL_OPEN");
  });
});
