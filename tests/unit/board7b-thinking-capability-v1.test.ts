import { describe, expect, it } from "vitest";

import historicalAuthorizationTemplate from "../../artifacts/generative-interview-board7/2026-08-07-board7b-thinking-capability-v1/board7b-thinking-capability-v1-authorization-template.json";
import historicalManifest from "../../artifacts/generative-interview-board7/2026-08-07-board7b-thinking-capability-v1/board7b-thinking-capability-v1-manifest.json";
import {
  BOARD7B_THINKING_CAPABILITY_V1_RUNTIME_BASE,
  board7bThinkingCapabilityV1RuntimeForArm,
  loadBoard7bThinkingCapabilityV1Prepared
} from "../../evals/event-centered-generative/board7b-thinking-capability-v1/board7b-thinking-capability-v1";
import type {
  AICompletionParams,
  AIProvider
} from "../../src/server/services/ai/ai-provider";
import {
  computeBoard7bThinkingCapabilityV1Fingerprints,
  executeBoard7bThinkingCapabilityV1Call,
  inspectBoard7bThinkingCapabilityV1,
  renderBoard7bThinkingCapabilityV1TransparentReview
} from "../../scripts/run-board7b-thinking-capability-v1";

function pauseOutput(latestUserMessageId: string) {
  return JSON.stringify({
    semantic: {
      stage: "engage_focus",
      action: "pause",
      focus: null,
      understandingDelta: null,
      invalidatedRefs: [],
      archivedRefs: [],
      importantBranchDelta: { preserveRefs: [], add: [] },
      openPart: null,
      answerOpportunity: null,
      burdenSignal: {
        summary: "测试输出保持暂停",
        evidenceRefs: [latestUserMessageId]
      },
      pauseReason: "测试输出保持暂停"
    },
    visible: {
      understanding: null,
      response: "先停在这里。"
    }
  });
}

describe("GI-086 Thinking 能力校准", () => {
  it("保留历史零调用指纹并精确识别当前执行闭包漂移", async () => {
    await expect(inspectBoard7bThinkingCapabilityV1()).rejects.toThrow(
      "BOARD7B_THINKING_CAPABILITY_V1_EXECUTION_FINGERPRINT_MISMATCH"
    );
    const current = await computeBoard7bThinkingCapabilityV1Fingerprints();

    expect(current.candidateFingerprint).toBe(
      "fe2b306cb8172523b0b64f72bf1d41107d798d9f25e8eda0710f9260c96deb4d"
    );
    expect(current.sourceCandidateFingerprint).toBe(
      "fdc347aa9f952881dbf8c436cbd83302aec12358e446b01c210c57ee21f71f88"
    );
    expect(current.preparedCalls).toHaveLength(8);
    expect(current.executionFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(current.executionFingerprint).not.toBe(
      historicalManifest.executionFingerprint
    );
    expect(historicalAuthorizationTemplate.authorizedModelCallBudget).toBe(0);
    expect(historicalManifest.executionFingerprint).toBe(
      "f958b16c629a29fee3137e5cc82a37e47aafba6f7781198f7ccbfbdbe05dafc4"
    );
    expect(historicalManifest.probe.modelCalls).toBe(0);
  });

  it("绑定 GI-085 原资产并生成四组同期配对请求", async () => {
    const prepared = await loadBoard7bThinkingCapabilityV1Prepared();

    expect(prepared.sourceCandidateFingerprint).toBe(
      "fdc347aa9f952881dbf8c436cbd83302aec12358e446b01c210c57ee21f71f88"
    );
    expect(prepared.preparedCalls).toHaveLength(8);
    expect(new Set(prepared.preparedCalls.map((item) => item.pairId))).toEqual(
      new Set(["P1", "P2", "P3", "P4"])
    );
    expect(
      prepared.preparedCalls.filter((item) => item.role === "problem_probe")
    ).toHaveLength(4);
    expect(
      prepared.preparedCalls.filter((item) => item.role === "guard_control")
    ).toHaveLength(4);
    expect(
      prepared.preparedCalls
        .filter((item) => item.callNumber % 2 === 1)
        .map((item) => item.arm)
    ).toEqual([
      "thinking_disabled",
      "thinking_high",
      "thinking_disabled",
      "thinking_high"
    ]);
    for (const pairId of ["P1", "P2", "P3", "P4"]) {
      const pair = prepared.preparedCalls.filter(
        (item) => item.pairId === pairId
      );
      expect(pair.map((item) => item.arm).sort()).toEqual([
        "thinking_disabled",
        "thinking_high"
      ]);
      expect(new Set(pair.map((item) => item.userPrompt))).toHaveLength(1);
      expect(new Set(pair.map((item) => item.requestHash))).toHaveLength(2);
    }
  });

  it("只为 Thinking high 配置显式 reasoning effort", () => {
    expect(board7bThinkingCapabilityV1RuntimeForArm("thinking_disabled")).toEqual({
      ...BOARD7B_THINKING_CAPABILITY_V1_RUNTIME_BASE,
      thinking: "disabled",
      reasoningEffort: null,
      effectiveTemperature: 0.2
    });
    expect(board7bThinkingCapabilityV1RuntimeForArm("thinking_high")).toEqual({
      ...BOARD7B_THINKING_CAPABILITY_V1_RUNTIME_BASE,
      thinking: "enabled",
      reasoningEffort: "high",
      effectiveTemperature: null
    });
  });

  it("假 Provider 严格收到八次单请求且不接收隐藏推理", async () => {
    const prepared = await loadBoard7bThinkingCapabilityV1Prepared();
    const received: AICompletionParams[] = [];
    let nextOutput = "";
    const provider: AIProvider = {
      name: "fake",
      async complete(params) {
        received.push(params);
        return {
          content: nextOutput,
          latencyMs: 12,
          provider: "fake",
          tokenUsage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 }
        };
      }
    };
    const records = [];
    for (const preparedCall of prepared.preparedCalls) {
      nextOutput = pauseOutput(preparedCall.turnInput.latestUserMessageId);
      records.push(
        await executeBoard7bThinkingCapabilityV1Call({
          preparedCall,
          provider,
          systemPrompt: prepared.sourceAssets.systemPrompt
        })
      );
    }

    expect(received).toHaveLength(8);
    expect(received.map((item) => item.thinking)).toEqual([
      "disabled",
      "enabled",
      "enabled",
      "disabled",
      "disabled",
      "enabled",
      "enabled",
      "disabled"
    ]);
    expect(received.map((item) => item.reasoningEffort ?? null)).toEqual([
      null,
      "high",
      "high",
      null,
      null,
      "high",
      "high",
      null
    ]);
    expect(JSON.stringify(records)).not.toContain("reasoning_content");

    const review = renderBoard7bThinkingCapabilityV1TransparentReview({
      runFingerprint: "a".repeat(64),
      calls: records,
      preparedCalls: prepared.preparedCalls
    });
    expect(review).toContain("Thinking high");
    expect(review).toContain("Thinking 关闭");
    expect(review).not.toContain("reasoning_content");
  });

  it("请求指纹被篡改时在 Provider 调用前终止", async () => {
    const prepared = await loadBoard7bThinkingCapabilityV1Prepared();
    let calls = 0;
    const provider: AIProvider = {
      name: "fake",
      async complete() {
        calls += 1;
        throw new Error("should not call");
      }
    };
    const preparedCall = {
      ...prepared.preparedCalls[0]!,
      requestHash: "0".repeat(64)
    };

    await expect(
      executeBoard7bThinkingCapabilityV1Call({
        preparedCall,
        provider,
        systemPrompt: prepared.sourceAssets.systemPrompt
      })
    ).rejects.toThrow("BOARD7B_THINKING_CAPABILITY_V1_REQUEST_MISMATCH");
    expect(calls).toBe(0);
  });
});
