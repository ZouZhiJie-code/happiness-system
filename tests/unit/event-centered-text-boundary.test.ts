import { describe, expect, it } from "vitest";

import type { EventCenteredUnderstandingDecision } from "@/features/interview/event-centered/ai-contract";
import {
  enforceEventCenteredTextBoundaryDecision,
  isExplicitEventCenteredCorrection,
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

  it.each([
    "我纠正一下，是周二。",
    "不是生气，是委屈。",
    "不是，整理完我更不想点开它。看板越整齐，我越有事情已经在推进的感觉。",
    "你刚才理解错了，我在意的是等待。",
    "我还不能说是后悔。"
  ])("recognizes an explicit correction: %s", (rawText) => {
    expect(isExplicitEventCenteredCorrection(rawText)).toBe(true);
  });

  it.each([
    "不是。",
    "不是，不知道。",
    "不是，我不想继续聊了。"
  ])("keeps a bare denial or stop outside the correction path: %s", (rawText) => {
    expect(isExplicitEventCenteredCorrection(rawText)).toBe(false);
  });

  it("keeps an explicit stop after a bare denial as a hard boundary", () => {
    expect(isEventCenteredTextBoundaryExpression("不是，我不想继续聊了。")).toBe(true);
  });

  it.each([
    "我不是走错了，钥匙都拿出来了。",
    "我不是很在意路线，只是想多走一会儿。",
    "他不是负责人，会议还是照常开了。"
  ])("keeps narrative negation as content instead of a correction: %s", (rawText) => {
    expect(isExplicitEventCenteredCorrection(rawText)).toBe(false);
  });

  it("keeps question repair language outside the stop rule", () => {
    expect(isEventCenteredTextBoundaryExpression("这个问题看不懂，能简单点吗？")).toBe(false);
  });

  it.each([
    "先别继续问，我想停一下。",
    "这一段就到这里，不要再追问。",
    "我已经说够了；先停下吧。",
    "我现在确实说不清，也不想继续追问了。先停在这里吧。"
  ])("recognizes an explicit stop clause inside a combined sentence: %s", (rawText) => {
    expect(isEventCenteredTextBoundaryExpression(rawText)).toBe(true);
  });

  it("uses the latest explicit control when the user resumes after quoting a stop", () => {
    expect(
      isEventCenteredTextBoundaryExpression("他刚才说别再问了，但我还想继续聊自己的感受。")
    ).toBe(false);
  });

  it.each([
    "他一直没有回复，我当时很担心。",
    "我不知道他为什么这么做，但我当时很难受。",
    "他说不想继续合作，我听完有点失落。",
    "我没有生气，不过当时确实很紧张。"
  ])("keeps complete event content outside the short boundary rule: %s", (rawText) => {
    expect(isEventCenteredTextBoundaryExpression(rawText)).toBe(false);
  });
});
