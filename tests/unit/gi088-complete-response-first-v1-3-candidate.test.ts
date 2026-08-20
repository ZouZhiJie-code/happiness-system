import { describe, expect, it } from "vitest";

import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_3_RUNTIME,
  createGi088CompleteResponseFirstV13Identity,
  validateGi088CompleteResponseFirstV13Result
} from "../../evals/event-centered-generative/gi088-complete-response-first-v1-3-visible-text-owner/candidate";
import {
  loadGi088CompleteResponseFirstCases
} from "../../scripts/gi088-complete-response-first-fixtures";

describe("GI-088 complete-response-first v1.3 candidate", () => {
  it("身份把首个调用固定为纯文本完整回应", () => {
    const identity = createGi088CompleteResponseFirstV13Identity();
    expect(identity.changedFactor).toBe(
      "visible_call_structured_json_to_plain_text"
    );
    expect(GI088_COMPLETE_RESPONSE_FIRST_V1_3_RUNTIME).toMatchObject({
      model: "deepseek-v4-pro",
      maxTokens: 1_280,
      thinking: "disabled",
      responseFormat: null,
      callsPerCase: 1
    });
  });

  it("接受原样纯文本并拒绝模型内部词", async () => {
    const item = (await loadGi088CompleteResponseFirstCases()).cases[0]!;
    const response = "讲解的难处已经很清楚了。你最想先理清切入角度，还是展开思路？";
    const baseResult = {
      turn: {} as never,
      semanticArtifact: null,
      outputOrigin: "llm" as const,
      attempts: [{
        stage: "question" as const,
        provider: "test",
        success: true,
        latencyMs: 10,
        errorCode: null,
        responseText: response
      }],
      promptLineage: [],
      validationIssues: [],
      qualityDiagnostics: [],
      strategyVersion:
        "2026-08-20.gi088-complete-response-first-v1-3-visible-text-owner",
      angleCardVersion: "test",
      fewShotVersion: "test",
      fewShotIds: [],
      architecture: "one_call" as const,
      completeResponseText: response,
      completeResponseEnvelope: {
        response,
        interaction: {
          kind: "ask" as const,
          question: "你最想先理清切入角度，还是展开思路？"
        },
        facts: [],
        correction: {
          kind: "none" as const,
          supersededAssistantMessageId: null
        }
      }
    };
    expect(validateGi088CompleteResponseFirstV13Result({ item, result: baseResult }))
      .toEqual([]);
    expect(validateGi088CompleteResponseFirstV13Result({
      item,
      result: {
        ...baseResult,
        attempts: [{ ...baseResult.attempts[0]!, responseText: "workingTask 已更新。" }],
        completeResponseText: "workingTask 已更新。"
      }
    })).toContain("VISIBLE_RESPONSE_INTERNAL_LANGUAGE_LEAK");
  });
});
