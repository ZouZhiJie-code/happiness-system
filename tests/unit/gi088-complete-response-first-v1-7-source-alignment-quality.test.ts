import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn() }));

vi.mock("../../src/server/services/interview/event-centered-ai.service", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/server/services/interview/event-centered-ai.service")
  >("../../src/server/services/interview/event-centered-ai.service");
  return {
    ...actual,
    generateEventCenteredCompleteResponseV16AI: mocks.generate
  };
});

import type { AICompletionParams, AIProvider } from "../../src/server/services/ai/ai-provider";
import type {
  EventCenteredGenerativeGenerationInput,
  EventCenteredGenerativeGenerationResult
} from "../../src/server/services/interview/event-centered-ai.service";
import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_PATHS,
  createGi088CompleteResponseFirstV17SourceAlignmentPlan,
  prepareGi088CompleteResponseFirstV17SourceAlignment,
  runGi088CompleteResponseFirstV17SourceAlignmentQuality,
  shouldRunGi088CompleteResponseFirstV17SourceAlignmentCli
} from "../../scripts/run-gi088-complete-response-first-v1-7-source-alignment-quality";

const FILES = [
  "docs/ai-evaluation-standard.md",
  "docs/plans/2026-08-20-gi088-complete-response-first-v1-7-background-source-alignment.md",
  "scripts/gi088-complete-response-first-v1-6-fresh-stability-fixtures.ts",
  "scripts/run-gi088-complete-response-first-v1-7-source-alignment-quality.ts",
  "evals/event-centered-generative/gi088-complete-response-first-v1-6-contrastive-coverage/candidate.ts",
  "src/features/interview/event-centered/complete-response-first-v1-6.ts",
  "evals/event-centered-generative/gi088-complete-response-first-v1-7-background-source-alignment/candidate.ts",
  "src/features/interview/event-centered/complete-response-background-facts-v1-1.ts",
  "src/features/interview/event-centered/complete-response-background-facts-v1.ts",
  "src/server/services/ai/openai.provider.ts",
  "src/server/services/ai/ai-provider.ts",
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/.private/real-problem-regression-v1.2/regression-cases.json",
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/real-problem-regression-v1.2-receipt.json",
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/complete-response-first-v1-6-fresh-stability-replay-v1-start-card.json",
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/complete-response-first-v1-6-fresh-stability-replay-v1-receipt.json",
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/.private/complete-response-first-v1-6-fresh-stability-replay-v1/ledger.json"
] as const;

async function isolatedWorkspace() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "gi088-v17-source-"));
  for (const relative of FILES) {
    const target = path.join(cwd, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await readFile(path.join(process.cwd(), relative)));
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
          basis: "自然承接当前表达",
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
        realizationContract: { responseCore: response, summaryAnchors: [] }
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
      latencyMs: 1_500,
      tokenUsage: { promptTokens: 700, completionTokens: 30, totalTokens: 730 },
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
        latencyMs: 1_500,
        provider: "openai",
        tokenUsage: { promptTokens: 700, completionTokens: 30, totalTokens: 730 },
        diagnostics: {
          finishReason: "stop" as const,
          reasoningPresent: false,
          reasoningLength: 0,
          reasoningTokens: null,
          latencyMs: 1_500,
          tokenUsage: { promptTokens: 700, completionTokens: 30, totalTokens: 730 },
          httpStatus: 200,
          responseModel: "deepseek-v4-pro",
          totalLatencyMs: 1_500
        }
      };
    })
  };
}

describe("GI-088 v1.7 后台来源对齐运行器", () => {
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
      return visibleResult("好，我接住你现在说的内容，我们可以先停在这里。 ");
    });
  });

  it("冻结父失败、复用六条可见结果并授权十次调用", async () => {
    const plan = await createGi088CompleteResponseFirstV17SourceAlignmentPlan();

    expect(plan.parentEvidence).toMatchObject({
      consumed: 12,
      completed: 12,
      remainingNotRun: 4,
      reusedVisibleCases: 6
    });
    expect(plan.cases.filter((item) => item.visibleOrigin === "parent_reused")).toHaveLength(6);
    expect(plan.cases.filter((item) => item.visibleOrigin === "new_generated")
      .map((item) => item.caseId)).toEqual(["RPR-CF-02", "RPR-CF-05"]);
    expect(plan.budget).toEqual({ authorized: 10, visible: 2, background: 8 });
    expect(plan.changedFactor).toContain("punctuation_and_whitespace_only");
  });

  it("在隔离目录完成两条可见续跑和八条后台来源复验", async () => {
    const cwd = await isolatedWorkspace();
    const plan = await prepareGi088CompleteResponseFirstV17SourceAlignment(cwd);
    const mock = provider();
    const ledger = await runGi088CompleteResponseFirstV17SourceAlignmentQuality({
      cwd,
      plan,
      provider: mock
    });

    expect(ledger.visibleEvidence).toHaveLength(8);
    expect(ledger.visibleEvidence.filter((item) => item.origin === "parent_reused")).toHaveLength(6);
    expect(ledger.visibleEvidence.filter((item) => item.origin === "new_generated")).toHaveLength(2);
    expect(ledger.backgroundResults).toHaveLength(8);
    expect(ledger.backgroundResults.every((item) => item.status === "technical_valid")).toBe(true);
    expect(ledger.reservations).toHaveLength(10);
    expect(ledger.reservations.every((item) => item.status === "completed")).toBe(true);
    expect(mock.complete).toHaveBeenCalledTimes(10);

    const publicSource = await readFile(path.join(
      cwd,
      GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_PATHS.publicReceipt
    ), "utf8");
    expect(publicSource).not.toContain("我接住你现在说的内容");
    const privateStat = await stat(path.join(
      cwd,
      GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_PATHS.privateReview
    ));
    expect(privateStat.mode & 0o777).toBe(0o600);
  });

  it("测试环境不会误触发命令行模型调用", () => {
    expect(shouldRunGi088CompleteResponseFirstV17SourceAlignmentCli({
      argv: ["node", "unrelated.ts"],
      env: { VITEST: "true" }
    })).toBe(false);
  });
});
