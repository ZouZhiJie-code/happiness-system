import { describe, expect, it } from "vitest";

import {
  createGi088CompleteResponseFirstV12ProductionIdentity,
  createGi088CompleteResponseFirstV12ProductionInput,
  projectGi088CompleteResponseFirstV12ProductionVisible,
  validateGi088CompleteResponseFirstV12ProductionResult
} from "../../evals/event-centered-generative/gi088-complete-response-first-v1-2-production-contract/candidate";
import {
  loadGi088CompleteResponseFirstCases
} from "../../scripts/gi088-complete-response-first-fixtures";

describe("GI-088 complete response first v1.2 production contract", () => {
  it("把完整历史适配为最近八轮，并保留助手消息来源与完整正文", async () => {
    const item = (await loadGi088CompleteResponseFirstCases()).cases
      .find((candidate) => candidate.caseId === "RPR-REAL-19");
    expect(item).toBeTruthy();
    const input = createGi088CompleteResponseFirstV12ProductionInput(item!);
    expect(input.completeResponseFirst).toBe(true);
    expect(input.recentTurns.length).toBeGreaterThan(0);
    expect(input.recentTurns.at(-1)).toEqual(expect.objectContaining({
      assistantMessageId: expect.any(String),
      assistantResponse: expect.any(String)
    }));
  });

  it("要求最小结构、原样正文和 v1.2 身份全部一致", async () => {
    const item = (await loadGi088CompleteResponseFirstCases()).cases[0]!;
    const response = "可以先把最卡住的地方缩小一点。你现在最难确定的是讲解角度，还是展开顺序？";
    const envelope = {
      response,
      interaction: {
        kind: "ask" as const,
        question: "你现在最难确定的是讲解角度，还是展开顺序？"
      },
      facts: [{
        statement: "用户最困扰的是怎样讲解",
        quote: "最让我困扰的就是怎么讲解",
        kind: "stated_interpretation" as const
      }],
      correction: {
        kind: "none" as const,
        supersededAssistantMessageId: null
      }
    };
    const result = {
      turn: {} as never,
      semanticArtifact: null,
      outputOrigin: "llm" as const,
      attempts: [{
        stage: "question" as const,
        provider: "test",
        success: true,
        latencyMs: 1,
        errorCode: null
      }],
      promptLineage: [],
      validationIssues: [],
      qualityDiagnostics: [],
      strategyVersion:
        "2026-08-20.gi088-complete-response-first-v1-2-minimal-envelope",
      angleCardVersion: "v",
      fewShotVersion: "v",
      fewShotIds: [],
      architecture: "one_call" as const,
      completeResponseText: response,
      completeResponseEnvelope: envelope
    };
    expect(projectGi088CompleteResponseFirstV12ProductionVisible(result)).toBe(response);
    expect(validateGi088CompleteResponseFirstV12ProductionResult({ item, result }))
      .toEqual([]);
    expect(createGi088CompleteResponseFirstV12ProductionIdentity())
      .toMatchObject({
        productionStrategyVersion:
          "2026-08-20.gi088-complete-response-first-v1-2-minimal-envelope"
      });
  });
});
