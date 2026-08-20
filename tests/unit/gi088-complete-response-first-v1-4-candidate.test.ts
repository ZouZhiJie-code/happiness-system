import { describe, expect, it } from "vitest";

import {
  createGi088CompleteResponseFirstV14Identity,
  observeGi088CompleteResponseFirstV14Result,
  validateGi088CompleteResponseFirstV14Result
} from "../../evals/event-centered-generative/gi088-complete-response-first-v1-4-grounded-intent-owner/candidate";
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
      "2026-08-20.gi088-complete-response-first-v1-4-grounded-intent-owner",
    angleCardVersion: "test",
    fewShotVersion: "test",
    fewShotIds: [],
    architecture: "one_call",
    completeResponseText: response,
    completeResponseEnvelope: {
      response,
      interaction: {
        kind: "ask",
        question: "你现在最希望先弄清什么？是自己的感受，还是下一步怎么做？"
      },
      facts: [],
      correction: { kind: "none", supersededAssistantMessageId: null }
    }
  };
}

describe("GI-088 complete response first v1.4 candidate", () => {
  it("只改变输出前的意图与依据检查方法", () => {
    const identity = createGi088CompleteResponseFirstV14Identity();
    expect(identity.version).toBe(
      "2026-08-20.gi088-complete-response-first-v1-4-grounded-intent-owner"
    );
    expect(identity.changedFactor).toBe(
      "intent_known_new_target_evidence_preflight_before_output"
    );
    expect(identity.runtime).toMatchObject({
      model: "deepseek-v4-pro",
      thinking: "disabled",
      maxTokens: 1_280,
      callsPerCase: 1
    });
  });

  it("多个问号只作观察并保留完整可见正文", async () => {
    const item = (await loadGi088CompleteResponseFirstCases()).cases[0]!;
    const response =
      "我先接住你现在的困扰。你更想先弄清哪一部分？是自己的感受，还是下一步怎么做？";
    const output = result(response);
    expect(validateGi088CompleteResponseFirstV14Result({ item, result: output }))
      .toEqual([]);
    expect(observeGi088CompleteResponseFirstV14Result({ item, result: output }))
      .toMatchObject({
        questionMarkCount: 2,
        visibleCharacterCount: [...response].length
      });
  });
});
