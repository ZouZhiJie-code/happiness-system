import { describe, expect, it } from "vitest";

import {
  createGi088CompleteResponseFirstV15Identity,
  observeGi088CompleteResponseFirstV15Result,
  validateGi088CompleteResponseFirstV15Result
} from "../../evals/event-centered-generative/gi088-complete-response-first-v1-5-semantic-layer-coverage/candidate";
import { loadGi088CompleteResponseFirstCases } from "../../scripts/gi088-complete-response-first-fixtures";
import type { EventCenteredGenerativeGenerationResult } from "@/server/services/interview/event-centered-ai.service";

function result(response: string): EventCenteredGenerativeGenerationResult {
  return {
    turn: {} as EventCenteredGenerativeGenerationResult["turn"],
    semanticArtifact: null,
    outputOrigin: "llm",
    attempts: [{
      stage: "question",
      attempt: 1,
      provider: "test",
      success: true,
      latencyMs: 2_000,
      errorCode: null,
      responseText: response
    }],
    promptLineage: [],
    validationIssues: [],
    qualityDiagnostics: [],
    strategyVersion:
      "2026-08-20.gi088-complete-response-first-v1-5-semantic-layer-coverage",
    angleCardVersion: "test",
    fewShotVersion: "test",
    fewShotIds: [],
    architecture: "one_call",
    completeResponseText: response,
    completeResponseEnvelope: {
      response,
      interaction: { kind: "ask", question: "你现在还想弄清什么？" },
      facts: [],
      correction: { kind: "none", supersededAssistantMessageId: null }
    }
  };
}

describe("GI-088 complete response first v1.5 candidate", () => {
  it("身份只改变语义层覆盖", () => {
    const identity = createGi088CompleteResponseFirstV15Identity();
    expect(identity.version).toBe(
      "2026-08-20.gi088-complete-response-first-v1-5-semantic-layer-coverage"
    );
    expect(identity.changedFactor).toBe(
      "semantic_layer_coverage_before_new_information_target"
    );
    expect(identity.runtime).toMatchObject({
      model: "deepseek-v4-pro",
      thinking: "disabled",
      maxTokens: 1_280,
      callsPerCase: 1
    });
  });

  it("继承单气泡正文和问号观察边界", async () => {
    const item = (await loadGi088CompleteResponseFirstCases()).cases[0]!;
    const response =
      "我接住你现在想继续聊。你想先说关系里的期待？还是下一步怎么做？";
    const output = result(response);
    expect(validateGi088CompleteResponseFirstV15Result({ item, result: output }))
      .toEqual([]);
    expect(observeGi088CompleteResponseFirstV15Result({ item, result: output }))
      .toMatchObject({
        questionMarkCount: 2,
        visibleCharacterCount: [...response].length
      });
  });
});
