import { describe, expect, it } from "vitest";

import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_9_RUNTIME,
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_9_STRATEGY,
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_9_VERSION,
  buildEventCenteredCompleteResponseFirstV19Messages,
  classifyEventCenteredCompleteResponseFirstV19Control,
  createEventCenteredCompleteResponseFirstV19Envelope,
  validateEventCenteredCompleteResponseFirstV19Output
} from "@/features/interview/event-centered/complete-response-first-v1-9";
import { EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_8_RUNTIME } from "@/features/interview/event-centered/complete-response-first-v1-8";

const baseInput = {
  rawText: "这个方向我现在也不想回答，换个方向继续聊。",
  phase: "event_recording" as const,
  activeAngle: null,
  currentQuestion: "如果当时他换一种问法，你希望他怎么说？",
  currentQuestionTarget: "prior-expectation-question",
  microgoal: null,
  facts: [],
  recentTurns: [{
    user: "继续和我聊聊，帮我再往下挖一层。",
    assistantMessageId: "assistant-1",
    assistantUnderstanding: "",
    assistantQuestion: "如果当时他换一种问法，你希望他怎么说？",
    assistantResponse: "如果当时他换一种问法，你希望他怎么说？"
  }],
  correctionRequested: false,
  correctionTargetAssistantMessageId: null
};

describe("complete response first v1.9", () => {
  it("keeps the v1.8 runtime and uses an independent strategy identity", () => {
    expect(EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_9_STRATEGY)
      .toBe("complete_response_v1_9");
    expect(EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_9_VERSION)
      .toContain("local-boundary-continue-priority");
    expect(EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_9_RUNTIME)
      .toBe(EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_8_RUNTIME);
  });

  it("distinguishes a local answer boundary from a global stop", () => {
    expect(classifyEventCenteredCompleteResponseFirstV19Control(
      "这个方向我现在也不想回答，换个方向继续聊。"
    )).toBe("local_boundary_continue");
    expect(classifyEventCenteredCompleteResponseFirstV19Control(
      "这个问题先不答，我们接着聊点别的。"
    )).toBe("local_boundary_continue");
    expect(classifyEventCenteredCompleteResponseFirstV19Control(
      "今天我不想继续聊了，就先到这里吧。"
    )).toBe("global_stop");
  });

  it("provides the deterministic control scope to the model", () => {
    const [system, user] = buildEventCenteredCompleteResponseFirstV19Messages(baseInput);
    expect(system.content).toContain("explicitControl=local_boundary_continue");
    expect(system.content).toContain("放下当前问题");
    expect(JSON.parse(user.content).explicitControl)
      .toBe("local_boundary_continue");
  });

  it("keeps a redirected question open instead of coercing it to stop", () => {
    const response = "好，我们放下刚才那个方向。你更在意这次公开质疑对之后合作的影响吗？";
    const envelope = createEventCenteredCompleteResponseFirstV19Envelope({
      generationInput: baseInput,
      response
    });
    expect(envelope.interaction).toEqual({
      kind: "ask",
      question: "你更在意这次公开质疑对之后合作的影响吗？"
    });
    expect(validateEventCenteredCompleteResponseFirstV19Output({
      generationInput: baseInput,
      response
    })).toEqual([]);
  });

  it("keeps a real stop closed", () => {
    const generationInput = {
      ...baseInput,
      rawText: "今天我不想继续聊了，就先到这里吧。"
    };
    expect(createEventCenteredCompleteResponseFirstV19Envelope({
      generationInput,
      response: "好，今天先到这里。"
    }).interaction.kind).toBe("stop");
    expect(validateEventCenteredCompleteResponseFirstV19Output({
      generationInput,
      response: "好，今天先到这里。要不要再说一句？"
    })).toContain("EXPLICIT_GLOBAL_STOP_STILL_OPEN");
  });
});
