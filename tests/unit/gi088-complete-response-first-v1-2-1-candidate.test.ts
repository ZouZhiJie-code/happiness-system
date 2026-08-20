import { describe, expect, it } from "vitest";

import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_2_1_RUNTIME,
  createGi088CompleteResponseFirstV121Identity,
  validateGi088CompleteResponseFirstV121Result
} from "../../evals/event-centered-generative/gi088-complete-response-first-v1-2-1-json-mode-off/candidate";
import {
  loadGi088CompleteResponseFirstCases
} from "../../scripts/gi088-complete-response-first-fixtures";

describe("GI-088 complete-response-first v1.2.1 candidate", () => {
  it("身份只记录关闭 Provider JSON 模式", () => {
    const identity = createGi088CompleteResponseFirstV121Identity();
    expect(identity.version).toBe(
      "2026-08-20.gi088-complete-response-first-v1-2-1-json-mode-off"
    );
    expect(identity.changedFactor).toBe(
      "provider_response_format_json_object_to_omitted"
    );
    expect(GI088_COMPLETE_RESPONSE_FIRST_V1_2_1_RUNTIME).toMatchObject({
      maxTokens: 1_280,
      maxAttempts: 1,
      timeoutMs: 45_000,
      thinking: "disabled",
      responseFormat: null
    });
  });

  it("接受同一最小结构的新策略版本", async () => {
    const item = (await loadGi088CompleteResponseFirstCases()).cases[0]!;
    const response = "你已经把卡点说得很具体了。你更想先理清从哪里切入，还是怎样把思路讲清楚？";
    const result = {
      turn: {} as never,
      semanticArtifact: null,
      outputOrigin: "llm" as const,
      attempts: [{
        stage: "question" as const,
        provider: "test",
        success: true,
        latencyMs: 10,
        errorCode: null
      }],
      promptLineage: [],
      validationIssues: [],
      qualityDiagnostics: [],
      strategyVersion:
        "2026-08-20.gi088-complete-response-first-v1-2-1-json-mode-off",
      angleCardVersion: "test",
      fewShotVersion: "test",
      fewShotIds: [],
      architecture: "one_call" as const,
      completeResponseText: response,
      completeResponseEnvelope: {
        response,
        interaction: {
          kind: "ask" as const,
          question: "你更想先理清从哪里切入，还是怎样把思路讲清楚？"
        },
        facts: [],
        correction: {
          kind: "none" as const,
          supersededAssistantMessageId: null
        }
      }
    };

    expect(validateGi088CompleteResponseFirstV121Result({ item, result }))
      .not.toContain("PRODUCTION_STRATEGY_VERSION_MISMATCH");
  });
});
