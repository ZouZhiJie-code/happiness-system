import { describe, expect, it } from "vitest";

import {
  GI088_RESPONSE_FIRST_V22_LOW_ASSETS,
  GI088_RESPONSE_FIRST_V22_RUNTIME,
  createGi088ResponseFirstV22HighModelInput,
  createGi088ResponseFirstV22Identity,
  createGi088ResponseFirstV22LowModelInput,
  getGi088ResponseFirstV22HighSystemPrompt,
  validateGi088ResponseFirstV22LowOutput
} from "../../evals/event-centered-generative/gi088-response-first-v2-2/candidate";
import {
  GI088_RESPONSE_FIRST_V21_RUNTIME,
  createGi088ResponseFirstV21HighModelInput,
  createGi088ResponseFirstV21Identity,
  createGi088ResponseFirstV21LowModelInput,
  getGi088ResponseFirstV21HighSystemPrompt
} from "../../evals/event-centered-generative/gi088-response-first-v2-1/candidate";
import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

function turnInput(): Board7bWorkingTaskV1TurnInput {
  return {
    mode: "accompany_chat",
    conversation: [
      { id: "U1", role: "user", content: "我在外面会轻松一些。" },
      { id: "A2", role: "assistant", content: "我听见这份差异了。" },
      { id: "U3", role: "user", content: "回家以后会烦躁。" }
    ],
    latestUserMessageId: "U3",
    semanticState: createBoard7bWorkingTaskV1InitialSemanticState()
  };
}

describe("GI-088 response-first v2.2 factual Low candidate", () => {
  it("creates a child identity while preserving every runtime setting", () => {
    const parent = createGi088ResponseFirstV21Identity();
    const identity = createGi088ResponseFirstV22Identity();
    expect(identity.version)
      .toBe("2026-08-17.gi088-response-first-v2-2-factual-low");
    expect(identity.parentVersion).toBe(parent.version);
    expect(identity.parentCandidateFingerprint).toBe(parent.candidateFingerprint);
    expect(identity.candidateFingerprint).not.toBe(parent.candidateFingerprint);
    expect(GI088_RESPONSE_FIRST_V22_RUNTIME)
      .toEqual(GI088_RESPONSE_FIRST_V21_RUNTIME);
  });

  it("keeps Low and High inputs byte-equivalent to v2.1", () => {
    const input = turnInput();
    expect(createGi088ResponseFirstV22LowModelInput(input))
      .toEqual(createGi088ResponseFirstV21LowModelInput(input));
    const highInput = { turnInput: input, frozenLow: "回家后会烦躁，这点已经记下了。" };
    expect(createGi088ResponseFirstV22HighModelInput(highInput))
      .toEqual(createGi088ResponseFirstV21HighModelInput(highInput));
    expect(getGi088ResponseFirstV22HighSystemPrompt("B"))
      .toBe(getGi088ResponseFirstV21HighSystemPrompt("B"));
  });

  it("removes Low inference permission and keeps the zero-question boundary", () => {
    expect(GI088_RESPONSE_FIRST_V22_LOW_ASSETS.skill)
      .toContain("只承接用户明确说出的事实与感受");
    expect(GI088_RESPONSE_FIRST_V22_LOW_ASSETS.skill)
      .toContain("不补充用户未说出的高层感受、张力、原因、动机、结论、诊断、具体体验或行为意图");
    expect(GI088_RESPONSE_FIRST_V22_LOW_ASSETS.skill)
      .not.toContain("最多补充一个可纠正");
    expect(validateGi088ResponseFirstV22LowOutput("你说回家以后会烦躁，这点已经记下了。"))
      .toEqual([]);
    expect(validateGi088ResponseFirstV22LowOutput("回家后最明显的变化是什么？"))
      .toContain("LOW_ZERO_QUESTION_VIOLATION");
  });
});
