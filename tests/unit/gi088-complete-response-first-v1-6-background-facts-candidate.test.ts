import { describe, expect, it } from "vitest";

import {
  createGi088CompleteResponseFirstV16BackgroundFactsInput,
  validateGi088CompleteResponseFirstV16BackgroundFactsOutput
} from "../../evals/event-centered-generative/gi088-complete-response-first-v1-6-background-facts/candidate";
import { loadGi088CompleteResponseFirstCases } from "../../scripts/gi088-complete-response-first-fixtures";
import type {
  EventCenteredCompleteResponseBackgroundFactsV1Input,
  EventCenteredCompleteResponseBackgroundFactsV1Output
} from "../../src/features/interview/event-centered/complete-response-background-facts-v1";

describe("GI-088 v1.6 后台事实候选", () => {
  it("把完整用户消息按顺序列为待整理来源，当前可见回复只承担助手来源", async () => {
    const dataset = await loadGi088CompleteResponseFirstCases();
    const item = dataset.cases[0]!;
    const input = createGi088CompleteResponseFirstV16BackgroundFactsInput({
      item,
      actualVisibleOutput: "我已经接住你这次说的内容。"
    });

    expect(input.pendingUserMessageIds).toEqual(["U1", "U2"]);
    expect(input.conversation.at(-1)).toEqual({
      id: "V16:RPR-REAL-01",
      role: "assistant",
      content: "我已经接住你这次说的内容。"
    });
    expect(input.effectiveFacts).toEqual([]);
  });

  it("接受逐字用户事实和对较早新事实的纠正", () => {
    const input: EventCenteredCompleteResponseBackgroundFactsV1Input = {
      conversation: [
        { id: "U1", role: "user", content: "我原来以为自己已经接纳了。" },
        { id: "A1", role: "assistant", content: "听起来你已经接纳了。" },
        { id: "U2", role: "user", content: "其实我还是很在意，刚才说接纳是表面的。" },
        { id: "A2", role: "assistant", content: "我会按你的纠正继续。" }
      ],
      pendingUserMessageIds: ["U1", "U2"],
      effectiveFacts: [],
      currentVisibleAssistantMessageId: "A2",
      explicitCorrectionTargetAssistantMessageId: null
    };
    const output: EventCenteredCompleteResponseBackgroundFactsV1Output = {
      processedUserMessageIds: ["U1", "U2"],
      factDeltas: [
        {
          sourceUserMessageId: "U1",
          statement: "用户原先表示已经接纳",
          quote: "我原来以为自己已经接纳了",
          scope: "current_event",
          stance: "affirmed",
          kind: "stated_interpretation"
        },
        {
          sourceUserMessageId: "U2",
          statement: "用户澄清自己仍然在意，接纳只是表面说法",
          quote: "其实我还是很在意，刚才说接纳是表面的",
          scope: "current_event",
          stance: "affirmed",
          kind: "stated_interpretation"
        }
      ],
      corrections: [{
        sourceUserMessageId: "U2",
        quote: "刚才说接纳是表面的",
        targets: [{ ref: "new:1", relation: "supersede" }],
        supersededAssistantMessageIds: ["A1"]
      }]
    };

    expect(validateGi088CompleteResponseFirstV16BackgroundFactsOutput({
      generationInput: input,
      output
    })).toEqual([]);
  });

  it("拒绝非用户来源、伪造逐字依据和倒序纠正", () => {
    const input: EventCenteredCompleteResponseBackgroundFactsV1Input = {
      conversation: [
        { id: "U1", role: "user", content: "今天有点累。" },
        { id: "A1", role: "assistant", content: "先休息一下也可以。" },
        { id: "U2", role: "user", content: "我想继续聊。" },
        { id: "A2", role: "assistant", content: "好。" }
      ],
      pendingUserMessageIds: ["U1", "U2"],
      effectiveFacts: [],
      currentVisibleAssistantMessageId: "A2",
      explicitCorrectionTargetAssistantMessageId: null
    };
    const output: EventCenteredCompleteResponseBackgroundFactsV1Output = {
      processedUserMessageIds: ["U2", "U1"],
      factDeltas: [{
        sourceUserMessageId: "A1",
        statement: "用户想休息",
        quote: "先休息一下",
        scope: "current_event",
        stance: "affirmed",
        kind: "stated_preference"
      }],
      corrections: [{
        sourceUserMessageId: "U1",
        quote: "今天有点累",
        targets: [{ ref: "new:1", relation: "supersede" }],
        supersededAssistantMessageIds: ["A1"]
      }]
    };

    expect(validateGi088CompleteResponseFirstV16BackgroundFactsOutput({
      generationInput: input,
      output
    })).toEqual(expect.arrayContaining([
      "PROCESSED_USER_MESSAGES_MUST_MATCH_PENDING_IN_ORDER",
      "FACT_SOURCE_MUST_BE_PENDING_USER_MESSAGE",
      "CORRECTION_TARGET_MUST_PRECEDE_SOURCE",
      "CORRECTION_ASSISTANT_SOURCE_INVALID"
    ]));
  });

  it("显式纠正动作必须记录对应助手来源", () => {
    const input: EventCenteredCompleteResponseBackgroundFactsV1Input = {
      conversation: [
        { id: "A1", role: "assistant", content: "你已经不在意了。" },
        { id: "U1", role: "user", content: "我纠正一下，我还是很在意。" },
        { id: "A2", role: "assistant", content: "好。" }
      ],
      pendingUserMessageIds: ["U1"],
      effectiveFacts: [],
      currentVisibleAssistantMessageId: "A2",
      explicitCorrectionTargetAssistantMessageId: "A1"
    };
    const output: EventCenteredCompleteResponseBackgroundFactsV1Output = {
      processedUserMessageIds: ["U1"],
      factDeltas: [],
      corrections: []
    };

    expect(validateGi088CompleteResponseFirstV16BackgroundFactsOutput({
      generationInput: input,
      output
    })).toContain("EXPLICIT_CORRECTION_TARGET_MUST_BE_RECORDED");
  });
});
