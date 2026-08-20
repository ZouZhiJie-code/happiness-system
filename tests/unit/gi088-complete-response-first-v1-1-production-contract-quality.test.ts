import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generate: vi.fn()
}));

vi.mock("../../src/server/services/interview/event-centered-ai.service", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/server/services/interview/event-centered-ai.service")
  >("../../src/server/services/interview/event-centered-ai.service");
  return {
    ...actual,
    generateEventCenteredTurnOnceAI: mocks.generate
  };
});

import type { AIProvider } from "../../src/server/services/ai/ai-provider";
import type {
  EventCenteredGenerativeGenerationInput,
  EventCenteredGenerativeGenerationResult
} from "../../src/server/services/interview/event-centered-ai.service";
import {
  createGi088CompleteResponseFirstV11ProductionQualityPlan,
  runGi088CompleteResponseFirstV11ProductionCase,
  shouldRunGi088CompleteResponseFirstV11ProductionQualityCli
} from "../../scripts/run-gi088-complete-response-first-v1-1-production-contract-quality";
import { loadGi088CompleteResponseFirstCases } from "../../scripts/gi088-complete-response-first-fixtures";

function askResult(): EventCenteredGenerativeGenerationResult {
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
          missingUnderstanding: "一个具体而未回答的入口"
        },
        evidenceRefs: [],
        insightKind: null,
        selectedTargetId: "historical_current_question",
        expectedUnderstandingDelta: "形成一个新的具体认识",
        tentativeInterpretation: null,
        stopReason: null,
        cognitiveAction: "differentiate",
        progressAssessment: "no_increment",
        microgoalDelta: null,
        realizationContract: {
          responseCore: "沿当前重点继续",
          summaryAnchors: []
        }
      },
      visibleTurn: {
        thinkingSummary: "这件事里还有一个具体部分值得继续看看。",
        responseKind: "question",
        question: "当时最先让你停住的是哪一个具体环节？",
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
        naturalUnderstanding: "这件事里还有一个具体部分值得继续看看。",
        question: "当时最先让你停住的是哪一个具体环节？"
      }
    },
    semanticArtifact: null,
    outputOrigin: "llm",
    attempts: [{
      stage: "question",
      attempt: 1,
      provider: "openai",
      success: true,
      latencyMs: 2_400,
      tokenUsage: { promptTokens: 2_100, completionTokens: 210, totalTokens: 2_310 },
      errorCode: null,
      responseText: "{\"visibleTurn\":{}}"
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

function provider(): AIProvider {
  return {
    name: "openai",
    complete: vi.fn(async () => ({
      content: "{}",
      latencyMs: 2_400,
      provider: "openai",
      tokenUsage: { promptTokens: 2_100, completionTokens: 210, totalTokens: 2_310 },
      diagnostics: {
        finishReason: "stop" as const,
        reasoningPresent: false,
        reasoningLength: 0,
        reasoningTokens: null,
        latencyMs: 2_400,
        tokenUsage: { promptTokens: 2_100, completionTokens: 210, totalTokens: 2_310 },
        httpStatus: 200,
        responseModel: "deepseek-v4-pro",
        totalLatencyMs: 2_400
      }
    }))
  };
}

describe("GI-088 完整回应 v1.1 生产合同运行器", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generate.mockImplementation(async (
      input: EventCenteredGenerativeGenerationInput
    ) => {
      await input.provider!.complete({
        messages: [{ role: "user", content: "private" }],
        temperature: 0.2,
        maxTokens: 1_280,
        maxAttempts: undefined,
        timeoutMs: 45_000,
        responseFormat: "json_object",
        thinking: "disabled"
      } as never);
      return askResult();
    });
  });

  it("冻结父证据、八题、单次模型和生产请求条件", async () => {
    const plan = await createGi088CompleteResponseFirstV11ProductionQualityPlan();

    expect(plan.identity).toBe(
      "2026-08-20.gi088-complete-response-first-v1-1-production-contract-quality-v1"
    );
    expect(plan.cases).toHaveLength(8);
    expect(plan.parentEvidence.technicalCases).toBe(8);
    expect(plan.runtime).toMatchObject({
      model: "deepseek-v4-pro",
      temperature: 0.2,
      maxTokens: 1_280,
      maxAttempts: 1,
      timeoutMs: 45_000,
      thinking: "disabled",
      reasoningEffort: null,
      callsPerCase: 1,
      retries: 0,
      recovery: 0,
      fallback: 0
    });
    expect(plan.inputHashes).toHaveProperty("productionCandidateSha256");
    expect(plan.inputHashes).toHaveProperty("aiServiceSha256");
    expect(plan.inputHashes).toHaveProperty("parentReceiptSha256");
  });

  it("只调用一次生产生成函数，并记录关闭思考和1280 Token", async () => {
    const [plan, dataset] = await Promise.all([
      createGi088CompleteResponseFirstV11ProductionQualityPlan(),
      loadGi088CompleteResponseFirstCases()
    ]);
    const item = dataset.cases[0]!;
    const entry = plan.cases[0]!;
    const result = await runGi088CompleteResponseFirstV11ProductionCase({
      entry,
      item,
      provider: provider()
    });

    expect(mocks.generate).toHaveBeenCalledOnce();
    expect(result.status).toBe("technical_valid");
    expect(result.technicalGatePassed).toBe(true);
    expect(result.requestContract).toEqual({
      temperature: 0.2,
      maxTokens: 1_280,
      timeoutMs: 45_000,
      responseFormat: "json_object",
      thinking: "disabled",
      reasoningEffortPresent: false
    });
    expect(result.actualVisibleOutput).toContain("值得继续看看");
    expect(result.actualVisibleOutput).toContain("具体环节");
  });

  it("明确停止场景仍提问时立即标记严重程序门", async () => {
    const [plan, dataset] = await Promise.all([
      createGi088CompleteResponseFirstV11ProductionQualityPlan(),
      loadGi088CompleteResponseFirstCases()
    ]);
    const item = dataset.cases.find((candidate) => candidate.caseId === "RPR-CF-03")!;
    const entry = plan.cases.find((candidate) => candidate.caseId === item.caseId)!;
    const result = await runGi088CompleteResponseFirstV11ProductionCase({
      entry,
      item,
      provider: provider()
    });

    expect(result.status).toBe("program_gate_failure");
    expect(result.severeProgramGateFailed).toBe(true);
    expect(result.validationIssues).toContain("EXPLICIT_STOP_STILL_ASKED");
  });

  it("测试环境不会误触发命令行模型调用", () => {
    expect(shouldRunGi088CompleteResponseFirstV11ProductionQualityCli({
      argv: ["node", "unrelated.ts"],
      env: { VITEST: "true" }
    })).toBe(false);
  });
});
