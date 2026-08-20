import { describe, expect, it } from "vitest";

import { createBoard7bWorkingTaskV1InitialSemanticState } from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_ASSETS,
  GI088_COMPLETE_RESPONSE_FIRST_V1_RUNTIME,
  GI088_COMPLETE_RESPONSE_FIRST_V1_VERSION,
  createGi088CompleteResponseFirstV1Identity,
  createGi088CompleteResponseFirstV1ModelInput,
  createGi088CompleteResponseFirstV1UserPrompt,
  getGi088CompleteResponseFirstV1SystemPrompt,
  observeGi088CompleteResponseFirstV1Output,
  parseGi088CompleteResponseFirstV1Output,
  validateGi088CompleteResponseFirstV1Output
} from "../../evals/event-centered-generative/gi088-complete-response-first-v1/candidate";

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

describe("GI-088 complete-response-first v1 candidate", () => {
  it("binds the requested model, Thinking, Token, and timeout runtime", () => {
    expect(GI088_COMPLETE_RESPONSE_FIRST_V1_RUNTIME).toMatchObject({
      model: "deepseek-v4-pro",
      thinking: "disabled",
      temperature: 0.2,
      maxTokens: 1_280,
      headersTimeoutMs: 15_000,
      bodyIdleTimeoutMs: 45_000,
      hardTimeoutMs: 45_000
    });
    expect(GI088_COMPLETE_RESPONSE_FIRST_V1_RUNTIME).not.toHaveProperty(
      "reasoningEffort"
    );
    expect(GI088_COMPLETE_RESPONSE_FIRST_V1_RUNTIME).not.toHaveProperty(
      "responseFormat"
    );
  });

  it("defines one complete visible-response owner and the required dialogue method", () => {
    const prompt = getGi088CompleteResponseFirstV1SystemPrompt();

    expect(prompt).toContain("本轮唯一一条用户可见回应");
    expect(prompt).toContain("先识别用户最新一轮的主要意图");
    expect(prompt).toContain("检查助手已经问过什么、用户已经回答或纠正了什么");
    expect(prompt).toContain("选择一个对当前用户真正有价值的回答焦点");
    expect(prompt).toContain("上一条助手已经承接过该纠正时");
    expect(prompt).toContain("用户要求继续或深挖时，本轮要带来新进展");
    expect(prompt).toContain("回应中使用零个问题");
    expect(prompt).toContain("允许把用户原话自然转成");
    expect(prompt).toContain("可纠正方式表达");
    expect(prompt).toContain("只输出一条完整的自然中文正文");
    expect(GI088_COMPLETE_RESPONSE_FIRST_V1_ASSETS.outputContract).not.toContain(
      "JSON 对象"
    );
  });

  it("keeps the complete conversation and exposes semantic state as a read-only snapshot", () => {
    const modelInput = createGi088CompleteResponseFirstV1ModelInput(turnInput);

    expect(modelInput.conversation).toEqual(turnInput.conversation);
    expect(modelInput.conversation).toHaveLength(4);
    expect(modelInput.latestUserMessageId).toBe("U2");
    expect(Object.isFrozen(modelInput.readOnlySemanticState)).toBe(true);
    expect(Object.isFrozen(modelInput.readOnlySemanticState.understandings)).toBe(
      true
    );
    expect(modelInput).not.toHaveProperty("recentConversation");
    expect(JSON.parse(createGi088CompleteResponseFirstV1UserPrompt(turnInput)))
      .toEqual(modelInput);
  });

  it("parses one plain-text response and rejects an empty provider result", () => {
    expect(
      parseGi088CompleteResponseFirstV1Output(
        "  你已经把生气说清楚了。既然你想继续，我们可以从当时发生的具体事情往下看。  "
      )
    ).toBe(
      "你已经把生气说清楚了。既然你想继续，我们可以从当时发生的具体事情往下看。"
    );
    expect(() => parseGi088CompleteResponseFirstV1Output(" \n ")).toThrow(
      "GI088_COMPLETE_RESPONSE_FIRST_V1_OUTPUT_EMPTY"
    );
  });

  it("checks only deterministic body boundaries", () => {
    expect(
      validateGi088CompleteResponseFirstV1Output({
        turnInput,
        output: "你已经把纠正说清楚了，我们接着看这股生气具体指向什么。"
      })
    ).toEqual([]);
    expect(
      validateGi088CompleteResponseFirstV1Output({
        turnInput,
        output: '{"response":"我听见了。"}'
      })
    ).toContain("VISIBLE_RESPONSE_STRUCTURED_WRAPPER_LEAK");
    expect(
      validateGi088CompleteResponseFirstV1Output({
        turnInput,
        output: "```\n我听见了。\n```"
      })
    ).toContain("VISIBLE_RESPONSE_MARKDOWN_FENCE_LEAK");
    expect(
      validateGi088CompleteResponseFirstV1Output({
        turnInput,
        output: "我会更新 workingTask，再读取 evidenceRefs。"
      })
    ).toContain("VISIBLE_RESPONSE_INTERNAL_LANGUAGE_LEAK");
  });

  it("records question marks without turning their number into a validation gate", () => {
    const output = "你想从哪里接着说？先说当时发生的事吗？还是先说后来怎么变化的？";

    expect(
      validateGi088CompleteResponseFirstV1Output({ turnInput, output })
    ).toEqual([]);
    expect(observeGi088CompleteResponseFirstV1Output(output)).toMatchObject({
      paragraphCount: 1,
      questionMarkCount: 3
    });
  });

  it("creates a stable, independently identifiable candidate", () => {
    const first = createGi088CompleteResponseFirstV1Identity();
    const second = createGi088CompleteResponseFirstV1Identity();

    expect(first.version).toBe(GI088_COMPLETE_RESPONSE_FIRST_V1_VERSION);
    expect(first.candidateFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.systemPromptFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.candidateFingerprint).toBe(second.candidateFingerprint);
    expect(first.changedFactor).toBe(
      "single_complete_visible_response_owner_v1"
    );
  });
});
