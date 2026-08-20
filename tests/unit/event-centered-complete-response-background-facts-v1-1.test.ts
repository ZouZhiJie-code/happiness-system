import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  alignEventCenteredBackgroundFactsQuoteToSource,
  alignEventCenteredCompleteResponseBackgroundFactsV11Output,
  validateEventCenteredCompleteResponseBackgroundFactsV11Output
} from "../../src/features/interview/event-centered/complete-response-background-facts-v1-1";
import type { EventCenteredCompleteResponseBackgroundFactsV1Input } from "../../src/features/interview/event-centered/complete-response-background-facts-v1";

const generationInput: EventCenteredCompleteResponseBackgroundFactsV1Input = {
  conversation: [
    {
      id: "U5",
      role: "user",
      content:
        "其实也没有吧，反正我就是也没有对别人有太多的期待，只不过是我跟我的小狗相处的是最舒服的，因为不管干啥，我的小狗都要跟着我一起，我睡床上它就睡我的底下。"
    },
    { id: "A5", role: "assistant", content: "我听见了。" }
  ],
  pendingUserMessageIds: ["U5"],
  effectiveFacts: [],
  currentVisibleAssistantMessageId: "A5",
  explicitCorrectionTargetAssistantMessageId: null
};

describe("完整回应后台事实 v1.1 来源标点对齐", () => {
  it("把标点变化恢复成用户原文中的真实连续片段", () => {
    const aligned = alignEventCenteredBackgroundFactsQuoteToSource({
      source: generationInput.conversation[0]!.content,
      quote:
        "其实也没有吧，反正我就是也没有对别人有太多的期待，只不过是我跟我的小狗相处的是最舒服的，因为不管干啥，我的小狗都要跟着我一起。"
    });

    expect(aligned).toBe(
      "其实也没有吧，反正我就是也没有对别人有太多的期待，只不过是我跟我的小狗相处的是最舒服的，因为不管干啥，我的小狗都要跟着我一起"
    );
    expect(generationInput.conversation[0]!.content.includes(aligned!)).toBe(true);
  });

  it("任何汉字、数字或字母变化仍然拒绝", () => {
    expect(alignEventCenteredBackgroundFactsQuoteToSource({
      source: "我很喜欢我的小狗。",
      quote: "我很讨厌我的小狗。"
    })).toBeNull();
  });

  it("多处相同短句无法唯一定位时拒绝", () => {
    expect(alignEventCenteredBackgroundFactsQuoteToSource({
      source: "我很难受，我很难受。",
      quote: "我很难受!"
    })).toBeNull();
  });

  it("对齐后的输出通过原有逐字来源合同", () => {
    const raw = {
      processedUserMessageIds: ["U5"],
      factDeltas: [{
        sourceUserMessageId: "U5",
        statement: "用户没有对别人抱太多期待。",
        quote: "其实也没有吧。反正我就是也没有对别人有太多的期待。",
        scope: "cross_event_pattern" as const,
        stance: "affirmed" as const,
        kind: "stated_interpretation" as const
      }],
      corrections: []
    };
    const aligned = alignEventCenteredCompleteResponseBackgroundFactsV11Output({
      generationInput,
      output: raw
    });

    expect(aligned.alignedQuoteCount).toBe(1);
    expect(generationInput.conversation[0]!.content).toContain(
      aligned.output.factDeltas[0]!.quote
    );
    expect(validateEventCenteredCompleteResponseBackgroundFactsV11Output({
      generationInput,
      output: aligned.output
    })).toEqual([]);
  });

  it("能确定性重放新案例复验中已确认的标点失败", async () => {
    const ledger = JSON.parse(await readFile(
      "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/.private/complete-response-first-v1-6-fresh-stability-replay-v1/ledger.json",
      "utf8"
    )) as {
      results: Array<{
        caseId: string;
        background: {
          generationInput: EventCenteredCompleteResponseBackgroundFactsV1Input;
          parsedOutput: Parameters<
            typeof alignEventCenteredCompleteResponseBackgroundFactsV11Output
          >[0]["output"];
        } | null;
      }>;
    };
    const failed = ledger.results.find((item) => item.caseId === "RPR-REAL-20")!;
    const aligned = alignEventCenteredCompleteResponseBackgroundFactsV11Output({
      generationInput: failed.background!.generationInput,
      output: failed.background!.parsedOutput
    });

    expect(aligned.alignedQuoteCount).toBe(1);
    expect(validateEventCenteredCompleteResponseBackgroundFactsV11Output({
      generationInput: failed.background!.generationInput,
      output: aligned.output
    })).toEqual([]);
  });
});
