import { describe, expect, it } from "vitest";

import { createBoard7bWorkingTaskV1InitialSemanticState } from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import { GI088_COMPLETE_RESPONSE_FIRST_V1_RUNTIME } from "../../evals/event-centered-generative/gi088-complete-response-first-v1/candidate";
import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_1_ASSETS,
  GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME,
  GI088_COMPLETE_RESPONSE_FIRST_V1_1_VERSION,
  createGi088CompleteResponseFirstV11Identity,
  createGi088CompleteResponseFirstV11ModelInput,
  createGi088CompleteResponseFirstV11UserPrompt,
  getGi088CompleteResponseFirstV11SystemPrompt,
  observeGi088CompleteResponseFirstV11Output,
  parseGi088CompleteResponseFirstV11Output,
  validateGi088CompleteResponseFirstV11Output
} from "../../evals/event-centered-generative/gi088-complete-response-first-v1-1/candidate";

const turnInput = {
  mode: "accompany_chat" as const,
  conversation: [
    {
      id: "A1",
      role: "assistant" as const,
      content: "你当时最直接的感受是什么？"
    },
    {
      id: "U1",
      role: "user" as const,
      content: "不是接纳，我当时其实是有点生气。"
    },
    {
      id: "A2",
      role: "assistant" as const,
      content: "明白了，是生气，不是接纳。"
    },
    {
      id: "U2",
      role: "user" as const,
      content: "对，继续深挖吧。"
    }
  ],
  latestUserMessageId: "U2",
  semanticState: createBoard7bWorkingTaskV1InitialSemanticState()
};

describe("GI-088 complete-response-first v1.1 candidate", () => {
  it("inherits the frozen v1 runtime without introducing a second factor", () => {
    expect(GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME).toBe(
      GI088_COMPLETE_RESPONSE_FIRST_V1_RUNTIME
    );
    expect(GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME).toMatchObject({
      model: "deepseek-v4-pro",
      thinking: "disabled",
      temperature: 0.2,
      maxTokens: 1_280,
      headersTimeoutMs: 15_000,
      bodyIdleTimeoutMs: 45_000,
      hardTimeoutMs: 45_000
    });
    expect(GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME).not.toHaveProperty(
      "reasoningEffort"
    );
    expect(GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME).not.toHaveProperty(
      "responseFormat"
    );
  });

  it("changes only the dialogue method and selects one unanswered information target", () => {
    const prompt = getGi088CompleteResponseFirstV11SystemPrompt();

    expect(GI088_COMPLETE_RESPONSE_FIRST_V1_1_ASSETS.basePrompt).toBe(
      "你负责 Daily Light【陪我聊】本轮唯一一条用户可见回应。请结合完整对话，直接给出一条自然、忠实、有内容的中文回应。回应要同时完成承接和本轮所需的推进；后台语义状态只供理解上下文，不需要输出或改写。"
    );
    expect(prompt).toContain("先在内部选择一个“本轮新增信息目标”");
    expect(prompt).toContain("完整原文尚未回答");
    expect(prompt).toContain("直接收束并完成用户要求");
    expect(prompt).toContain("给一个容易接住的继续入口");
    expect(prompt).toContain("本轮必须进入一个新的层次");
    expect(prompt).toContain("不要让用户确认刚刚已经明确说完的结论");
    expect(prompt).toContain("每轮最多表达一处可纠正的解释");
    expect(prompt).toContain("最多提出一个主问题");
    expect(prompt).toContain("不要列出用户已经回答过的具体选项");
    expect(prompt).toContain("写成一至两个短段落");
    expect(GI088_COMPLETE_RESPONSE_FIRST_V1_1_ASSETS.inputContract).toContain(
      "完整对话"
    );
    expect(GI088_COMPLETE_RESPONSE_FIRST_V1_1_ASSETS.outputContract).toContain(
      "只输出一条完整的自然中文正文"
    );
  });

  it("keeps the complete conversation and the same read-only semantic input", () => {
    const modelInput = createGi088CompleteResponseFirstV11ModelInput(turnInput);

    expect(modelInput.conversation).toEqual(turnInput.conversation);
    expect(modelInput.latestUserMessageId).toBe("U2");
    expect(Object.isFrozen(modelInput.readOnlySemanticState)).toBe(true);
    expect(
      JSON.parse(createGi088CompleteResponseFirstV11UserPrompt(turnInput))
    ).toEqual(modelInput);
  });

  it("keeps plain-text parsing and deterministic validation boundaries", () => {
    expect(
      parseGi088CompleteResponseFirstV11Output(
        "  你已经把生气说清楚了。那件事后来对你们的相处有什么影响？  "
      )
    ).toBe("你已经把生气说清楚了。那件事后来对你们的相处有什么影响？");
    expect(() => parseGi088CompleteResponseFirstV11Output(" \n ")).toThrow(
      "GI088_COMPLETE_RESPONSE_FIRST_V1_OUTPUT_EMPTY"
    );
    expect(
      validateGi088CompleteResponseFirstV11Output({
        turnInput,
        output: "你已经把生气说清楚了。那件事后来对你们的相处有什么影响？"
      })
    ).toEqual([]);
    expect(
      validateGi088CompleteResponseFirstV11Output({
        turnInput,
        output: '{"response":"我听见了。"}'
      })
    ).toContain("VISIBLE_RESPONSE_STRUCTURED_WRAPPER_LEAK");
    expect(
      validateGi088CompleteResponseFirstV11Output({
        turnInput,
        output: "我会读取 semanticState 和 evidenceRefs。"
      })
    ).toContain("VISIBLE_RESPONSE_INTERNAL_LANGUAGE_LEAK");
  });

  it("observes question marks without adding a semantic program gate", () => {
    const output = "你愿意说说后来发生了什么？还是想先停一停？";

    expect(
      validateGi088CompleteResponseFirstV11Output({ turnInput, output })
    ).toEqual([]);
    expect(observeGi088CompleteResponseFirstV11Output(output)).toMatchObject({
      paragraphCount: 1,
      questionMarkCount: 2
    });
  });

  it("creates a stable independent v1.1 identity for the single method change", () => {
    const first = createGi088CompleteResponseFirstV11Identity();
    const second = createGi088CompleteResponseFirstV11Identity();

    expect(first.version).toBe(GI088_COMPLETE_RESPONSE_FIRST_V1_1_VERSION);
    expect(first.version).toBe(
      "2026-08-19.gi088-complete-response-first-v1-1-new-information-target"
    );
    expect(first.candidateFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.systemPromptFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.candidateFingerprint).toBe(second.candidateFingerprint);
    expect(first.changedFactor).toBe(
      "select_one_unanswered_new_information_target_before_output"
    );
    expect(first.productRuntimeChanged).toBe(false);
    expect(first.modelCalls).toBe(0);
  });
});
