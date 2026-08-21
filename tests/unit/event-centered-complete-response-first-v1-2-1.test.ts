import { describe, expect, it } from "vitest";

import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_1_PROMPT_VERSION,
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_1_RUNTIME,
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_1_STRATEGY,
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_1_VERSION,
  buildEventCenteredCompleteResponseFirstV121Messages,
  eventCenteredCompleteResponseFirstV121OutputSchema
} from "@/features/interview/event-centered/complete-response-first-v1-2-1";
import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_PROMPT_VERSION,
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_RUNTIME,
  buildEventCenteredCompleteResponseFirstV12Messages
} from "@/features/interview/event-centered/complete-response-first-v1-2";

const input = {
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

describe("complete response first v1.2.1", () => {
  it("只关闭 Provider JSON 模式，其余运行参数与 Prompt 保持 v1.2", () => {
    expect(EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_1_STRATEGY)
      .toBe("complete_response_v1_2_1");
    expect(EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_1_VERSION)
      .toBe("2026-08-20.gi088-complete-response-first-v1-2-1-json-mode-off");
    expect(EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_1_PROMPT_VERSION)
      .toBe(EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_PROMPT_VERSION);
    expect(EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_1_RUNTIME).toEqual({
      ...EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_RUNTIME,
      responseFormat: null
    });
    expect(buildEventCenteredCompleteResponseFirstV121Messages(input))
      .toEqual(buildEventCenteredCompleteResponseFirstV12Messages(input));
  });

  it("继续使用 v1.2 的严格最小结构", () => {
    expect(eventCenteredCompleteResponseFirstV121OutputSchema.safeParse({
      response: "好，我们沿着你刚才说的继续往下看。",
      interaction: { kind: "respond", question: null },
      facts: [],
      correction: { kind: "none", supersededAssistantMessageId: null }
    }).success).toBe(true);
  });
});
