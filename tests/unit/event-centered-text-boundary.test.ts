import { describe, expect, it } from "vitest";

import type { EventCenteredUnderstandingDecision } from "@/features/interview/event-centered/ai-contract";
import {
  enforceEventCenteredTextBoundaryDecision,
  isEventCenteredTextBoundaryExpression
} from "@/server/services/interview/event-centered-ai.service";

function decision(
  overrides: Partial<EventCenteredUnderstandingDecision> = {}
): EventCenteredUnderstandingDecision {
  return {
    eventBoundary: "current_event",
    coreEventIdentifiable: true,
    answerSignal: "answered",
    facts: [],
    angleEvidence: [],
    outcomeCandidate: null,
    unsupportedHypothesis: null,
    adviceRequest: null,
    correctionTargetHint: null,
    boundaryReason: null,
    ...overrides
  };
}

describe("event-centered textual boundary", () => {
  it.each([
    "没有。",
    "不知道。",
    "想不起来。",
    "说不清。",
    "都不贴切。",
    "没法再具体。",
    "不想答。",
    "我想停下来。",
    "不继续聊这个。",
    "先收在这里。",
    "暂时不想说。"
  ])("treats %s as a direct stop boundary", (rawText) => {
    expect(isEventCenteredTextBoundaryExpression(rawText)).toBe(true);

    const result = enforceEventCenteredTextBoundaryDecision({ rawText, decision: decision() });

    expect(result.answerSignal).toBe("declined");
    expect(result.outcomeCandidate).toBeNull();
    expect(result.unsupportedHypothesis).toBeNull();
  });

  it("stores a concrete denial as a trusted denied fact before closing", () => {
    const result = enforceEventCenteredTextBoundaryDecision({
      rawText: "我没有生气。",
      decision: decision()
    });

    expect(result.answerSignal).toBe("declined");
    expect(result.facts).toContainEqual({
      statement: "我没有生气。",
      scope: "current_event",
      stance: "denied",
      kind: "inner_experience",
      quote: "我没有生气。"
    });
  });

  it("keeps correction ahead of the textual boundary rule", () => {
    const result = enforceEventCenteredTextBoundaryDecision({
      rawText: "不是生气，是委屈。",
      decision: decision({ answerSignal: "correction" })
    });

    expect(result.answerSignal).toBe("correction");
  });

  it("keeps question repair language outside the stop rule", () => {
    expect(isEventCenteredTextBoundaryExpression("这个问题看不懂，能简单点吗？")).toBe(false);
  });
});
