import { describe, expect, it } from "vitest";

import {
  createGi088CompleteResponseFirstV11ProductionIdentity,
  createGi088CompleteResponseFirstV11ProductionInput,
  projectGi088CompleteResponseFirstV11ProductionVisible,
  validateGi088CompleteResponseFirstV11ProductionResult
} from "../../evals/event-centered-generative/gi088-complete-response-first-v1-1-production-contract/candidate";
import { loadGi088CompleteResponseFirstCases } from "../../scripts/gi088-complete-response-first-fixtures";
import type { EventCenteredGenerativeGenerationResult } from "../../src/server/services/interview/event-centered-ai.service";

function validResult(): EventCenteredGenerativeGenerationResult {
  return {
    turn: {
      understanding: {
        eventBoundary: "current_event",
        coreEventIdentifiable: true,
        answerStatus: "partly_answered",
        factDeltas: [],
        correctionOrBoundary: null,
        tentativeInterpretation: null,
        eventOptions: []
      },
      semanticPlan: {
        action: "ask",
        activeAngle: "thought",
        outcomeAssessment: {
          state: "needs_more",
          origin: null,
          basis: "仍有一个尚未回答的新层次",
          supportEvidenceRefs: [],
          missingUnderstanding: "没有明确输赢时是否仍会比较"
        },
        evidenceRefs: [],
        insightKind: null,
        selectedTargetId: "historical_current_question",
        expectedUnderstandingDelta: "区分事件触发与日常比较",
        tentativeInterpretation: null,
        stopReason: null,
        cognitiveAction: "differentiate",
        progressAssessment: "no_increment",
        microgoalDelta: null,
        realizationContract: {
          responseCore: "沿纠正后的比较重点继续",
          summaryAnchors: []
        }
      },
      visibleTurn: {
        thinkingSummary: "你已经把那份矛盾说清楚了，我们可以沿着仍然在意比较的部分继续。",
        responseKind: "question",
        question: "平时没有明确输赢时，你也会默默衡量自己和别人吗？",
        insight: null,
        honestLimit: null
      },
      decision: {
        turnAction: "ask",
        cognitiveAction: "differentiate",
        selectedTarget: "historical_current_question",
        evidenceRefs: [],
        microgoalDelta: null,
        expectedValue: null,
        stopReason: null,
        outcomeCandidate: null
      },
      reply: {
        naturalUnderstanding: "你已经把那份矛盾说清楚了，我们可以沿着仍然在意比较的部分继续。",
        question: "平时没有明确输赢时，你也会默默衡量自己和别人吗？"
      }
    },
    semanticArtifact: null,
    outputOrigin: "llm",
    attempts: [{
      stage: "question",
      attempt: 1,
      provider: "openai",
      success: true,
      latencyMs: 2_500,
      tokenUsage: { promptTokens: 2_000, completionTokens: 300, totalTokens: 2_300 },
      errorCode: null,
      responseText: "{}"
    }],
    promptLineage: [],
    validationIssues: [],
    qualityDiagnostics: [],
    strategyVersion:
      "2026-08-20.gi088-complete-response-first-v1-1-production-contract-v1",
    angleCardVersion: "test",
    fewShotVersion: "test",
    fewShotIds: [],
    architecture: "one_call"
  };
}

describe("GI-088 完整回应 v1.1 生产合同适配", () => {
  it("把十六条消息转换为当前问题、最新原文和最多八轮完整历史", async () => {
    const dataset = await loadGi088CompleteResponseFirstCases();
    const item = dataset.cases.find((candidate) => candidate.caseId === "RPR-REAL-21")!;
    const input = createGi088CompleteResponseFirstV11ProductionInput(item);

    expect(item.turnInput.conversation).toHaveLength(16);
    expect(input.rawText).toBe(item.turnInput.conversation.at(-1)?.content);
    expect(input.currentQuestion).toContain("具体是一种什么感觉");
    expect(input.recentTurns).toHaveLength(7);
    expect(input.recentTurns[0]?.user).toContain("为什么别人后面都不会主动来找我");
    expect(input.recentTurns.at(-1)?.assistantQuestion).toContain("怎么解读这种差别");
    expect(input.completeResponseFirst).toBe(true);
    expect(input.maxTokens).toBe(1_280);
    expect(input.maxAttempts).toBe(1);
    expect(input.timeoutMs).toBe(45_000);
  });

  it("把承接和一个主问题投影成单个完整气泡", async () => {
    const dataset = await loadGi088CompleteResponseFirstCases();
    const item = dataset.cases.find((candidate) => candidate.caseId === "RPR-REAL-19")!;
    const result = validResult();

    expect(projectGi088CompleteResponseFirstV11ProductionVisible(result)).toBe(
      "你已经把那份矛盾说清楚了，我们可以沿着仍然在意比较的部分继续。\n\n" +
      "平时没有明确输赢时，你也会默默衡量自己和别人吗？"
    );
    expect(validateGi088CompleteResponseFirstV11ProductionResult({ item, result }))
      .toEqual([]);
  });

  it("把明确停止后继续提问列为严重程序门", async () => {
    const dataset = await loadGi088CompleteResponseFirstCases();
    const item = dataset.cases.find((candidate) => candidate.caseId === "RPR-CF-03")!;

    expect(validateGi088CompleteResponseFirstV11ProductionResult({
      item,
      result: validResult()
    })).toContain("EXPLICIT_STOP_STILL_ASKED");
  });

  it("冻结语义父版本、生产策略版本与单次快速运行条件", () => {
    expect(createGi088CompleteResponseFirstV11ProductionIdentity()).toMatchObject({
      parentSemanticVersion:
        "2026-08-19.gi088-complete-response-first-v1-1-new-information-target",
      productionStrategyVersion:
        "2026-08-20.gi088-complete-response-first-v1-1-production-contract-v1",
      runtime: {
        model: "deepseek-v4-pro",
        temperature: 0.2,
        maxTokens: 1_280,
        maxAttempts: 1,
        timeoutMs: 45_000,
        thinking: "disabled",
        reasoningEffort: null,
        callsPerCase: 1,
        recentTurnLimit: 8
      }
    });
  });
});
