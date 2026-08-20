import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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
    generateEventCenteredCompleteResponseV16AI: mocks.generate
  };
});

import type {
  AICompletionParams,
  AIProvider
} from "../../src/server/services/ai/ai-provider";
import type {
  EventCenteredGenerativeGenerationInput,
  EventCenteredGenerativeGenerationResult
} from "../../src/server/services/interview/event-centered-ai.service";
import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_PATHS,
  createGi088CompleteResponseFirstV16FreshStabilityPlan,
  prepareGi088CompleteResponseFirstV16FreshStabilityReplay,
  runGi088CompleteResponseFirstV16FreshStabilityReplay,
  shouldRunGi088CompleteResponseFirstV16FreshStabilityCli
} from "../../scripts/run-gi088-complete-response-first-v1-6-fresh-stability-replay";

const FILES = [
  "docs/ai-evaluation-standard.md",
  "docs/plans/2026-08-20-gi088-complete-response-first-v1-6-fresh-stability-replay.md",
  "scripts/gi088-complete-response-first-v1-6-fresh-stability-fixtures.ts",
  "scripts/run-gi088-complete-response-first-v1-6-fresh-stability-replay.ts",
  "evals/event-centered-generative/gi088-complete-response-first-v1-6-contrastive-coverage/candidate.ts",
  "src/features/interview/event-centered/complete-response-first-v1-6.ts",
  "evals/event-centered-generative/gi088-complete-response-first-v1-6-background-facts/candidate.ts",
  "src/features/interview/event-centered/complete-response-background-facts-v1.ts",
  "src/server/services/ai/openai.provider.ts",
  "src/server/services/ai/ai-provider.ts",
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/.private/real-problem-regression-v1.2/regression-cases.json",
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/real-problem-regression-v1.2-receipt.json",
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/complete-response-first-v1-6-contrastive-coverage-quality-v1-receipt.json",
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/complete-response-first-v1-6-background-facts-quality-v1-receipt.json"
] as const;

async function isolatedWorkspace() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "gi088-v16-fresh-"));
  for (const relative of FILES) {
    const source = path.join(process.cwd(), relative);
    const target = path.join(cwd, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await readFile(source));
  }
  return cwd;
}

function visibleResult(response: string): EventCenteredGenerativeGenerationResult {
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
        action: "pause",
        activeAngle: "feeling",
        outcomeAssessment: {
          state: "needs_more",
          origin: null,
          basis: "先接住当前表达",
          supportEvidenceRefs: [],
          missingUnderstanding: null
        },
        evidenceRefs: [],
        insightKind: null,
        selectedTargetId: null,
        expectedUnderstandingDelta: null,
        tentativeInterpretation: null,
        stopReason: null,
        cognitiveAction: null,
        progressAssessment: "no_increment",
        microgoalDelta: null,
        realizationContract: {
          responseCore: "自然承接",
          summaryAnchors: []
        }
      },
      visibleTurn: {
        thinkingSummary: response,
        responseKind: "pause",
        question: null,
        insight: null,
        honestLimit: null
      },
      decision: {
        turnAction: "pause",
        cognitiveAction: null,
        selectedTarget: null,
        evidenceRefs: [],
        microgoalDelta: null,
        expectedValue: null,
        stopReason: null,
        outcomeCandidate: null
      },
      reply: { naturalUnderstanding: response, question: null }
    },
    semanticArtifact: null,
    outputOrigin: "llm",
    attempts: [{
      stage: "question",
      attempt: 1,
      provider: "openai",
      success: true,
      latencyMs: 2_000,
      tokenUsage: { promptTokens: 800, completionTokens: 40, totalTokens: 840 },
      errorCode: null,
      responseText: response
    }],
    promptLineage: [],
    validationIssues: [],
    qualityDiagnostics: [],
    strategyVersion:
      "2026-08-20.gi088-complete-response-first-v1-6-contrastive-coverage",
    angleCardVersion: "test",
    fewShotVersion: "test",
    fewShotIds: [],
    architecture: "one_call",
    completeResponseText: response,
    completeResponseEnvelope: {
      response,
      interaction: { kind: "respond", question: null },
      facts: [],
      correction: { kind: "none", supersededAssistantMessageId: null }
    }
  };
}

function provider(): AIProvider {
  return {
    name: "openai",
    complete: vi.fn(async (request: AICompletionParams) => {
      let content = "visible-provider-output";
      if (request.maxTokens === 1_600) {
        const payload = JSON.parse(request.messages[1]!.content) as {
          pendingUserMessageIds: string[];
        };
        content = JSON.stringify({
          processedUserMessageIds: payload.pendingUserMessageIds,
          factDeltas: [],
          corrections: []
        });
      }
      return {
        content,
        latencyMs: 2_000,
        provider: "openai",
        tokenUsage: { promptTokens: 800, completionTokens: 40, totalTokens: 840 },
        diagnostics: {
          finishReason: "stop" as const,
          reasoningPresent: false,
          reasoningLength: 0,
          reasoningTokens: null,
          latencyMs: 2_000,
          tokenUsage: { promptTokens: 800, completionTokens: 40, totalTokens: 840 },
          httpStatus: 200,
          responseModel: "deepseek-v4-pro",
          totalLatencyMs: 2_000
        }
      };
    })
  };
}

describe("GI-088 v1.6 新案例稳定性复验运行器", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generate.mockImplementation(async (
      input: EventCenteredGenerativeGenerationInput
    ) => {
      await input.provider!.complete({
        messages: [{ role: "user", content: "private" }],
        temperature: 0.2,
        maxTokens: 1_280,
        timeoutMs: 45_000,
        thinking: "disabled"
      });
      return visibleResult("我接住你现在说的这一层，我们可以沿着它慢慢看。 ");
    });
  });

  it("冻结两个候选、八题和十六次预算", async () => {
    const plan = await createGi088CompleteResponseFirstV16FreshStabilityPlan();

    expect(plan.cases).toHaveLength(8);
    expect(plan.budget).toEqual({ authorized: 16, visible: 8, background: 8 });
    expect(plan.runtime).toMatchObject({
      visible: { maxTokens: 1_280, thinking: "disabled" },
      background: { maxTokens: 1_600, thinking: "disabled" },
      concurrency: 1,
      retries: 0,
      recovery: 0,
      fallback: 0
    });
    expect(plan.inputHashes).toHaveProperty("sourcePrivateSha256");
    expect(plan.inputHashes).toHaveProperty("parentVisibleReceiptSha256");
    expect(plan.inputHashes).toHaveProperty("parentBackgroundReceiptSha256");
  });

  it("在隔离目录完成八次可见与八次后台调用，并保持公开回执脱敏", async () => {
    const cwd = await isolatedWorkspace();
    const plan = await prepareGi088CompleteResponseFirstV16FreshStabilityReplay(cwd);
    const mock = provider();
    const ledger = await runGi088CompleteResponseFirstV16FreshStabilityReplay({
      cwd,
      plan,
      provider: mock
    });

    expect(ledger.results).toHaveLength(8);
    expect(ledger.reservations).toHaveLength(16);
    expect(ledger.reservations.every((item) => item.status === "completed")).toBe(true);
    expect(ledger.results.every((item) =>
      item.visible.status === "technical_valid" &&
      item.background?.status === "technical_valid"
    )).toBe(true);
    expect(mock.complete).toHaveBeenCalledTimes(16);

    const publicSource = await readFile(path.join(
      cwd,
      GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_PATHS.publicReceipt
    ), "utf8");
    expect(publicSource).not.toContain("我接住你现在说的这一层");
    const privateStat = await stat(path.join(
      cwd,
      GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_PATHS.privateReview
    ));
    expect(privateStat.mode & 0o777).toBe(0o600);
  });

  it("测试环境不会误触发命令行模型调用", () => {
    expect(shouldRunGi088CompleteResponseFirstV16FreshStabilityCli({
      argv: ["node", "unrelated.ts"],
      env: { VITEST: "true" }
    })).toBe(false);
  });
});
