import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { AIProvider } from "../../src/server/services/ai/ai-provider";
import {
  GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_IDENTITY,
  GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_PATHS,
  createGi088ResponseFirstV23HighPlan,
  evaluateGi088ResponseFirstV23HighReview,
  runGi088ResponseFirstV23HighPhase,
  type Gi088ResponseFirstV23HighCallResult
} from "../../scripts/run-gi088-response-first-v2-3-high-quality";

function highOutput(label: string) {
  return JSON.stringify({
    semantic: {
      actionIntent: "acknowledge",
      taskChange: { kind: "unchanged" },
      understandingChange: { kind: "none" },
      nextResponse: {
        decision: "none",
        answerFocus: null,
        informationGoal: null,
        expectedUnderstandingChange: null,
        evidenceRefs: [],
        questions: []
      },
      burdenAndControlChange: { kind: "unchanged" },
      relationshipExplanations: []
    },
    visibleAppend: { correctableUnderstanding: null },
    _testLabel: label
  }).replace(`,"_testLabel":"${label}"`, "");
}

function diagnostics(content: string, latencyMs = 8_000) {
  return {
    finishReason: "stop" as const,
    reasoningPresent: true,
    reasoningLength: 120,
    reasoningTokens: 70,
    latencyMs,
    tokenUsage: {
      promptTokens: 800,
      completionTokens: 180,
      totalTokens: 980
    },
    httpStatus: 200,
    responseModel: "deepseek-v4-pro",
    choiceCount: 1,
    contentType: "string" as const,
    contentLength: content.length,
    reasoningType: "string" as const,
    headersLatencyMs: 300,
    firstTokenLatencyMs: null,
    bodyLatencyMs: latencyMs - 300,
    totalLatencyMs: latencyMs,
    timeoutStage: null,
    abortSource: null
  };
}

describe("GI-088 response-first v2.3 High quality runner", () => {
  it("binds the frozen Low Go result and a 3 plus 6 High budget", async () => {
    const plan = await createGi088ResponseFirstV23HighPlan();
    expect(plan.identity).toBe(GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_IDENTITY);
    expect(plan.fixedFactors.frozenLowProductDecision)
      .toMatchObject({ gatePassed: true });
    expect(plan.phases.checkpoint).toHaveLength(3);
    expect(plan.phases.full).toHaveLength(6);
    expect(plan.budget).toMatchObject({
      authorized: 9,
      checkpoint: 3,
      full: 6,
      retries: 0,
      recovery: 0,
      fallback: 0
    });
    expect(plan.fixedFactors.reasoningEffort).toBe("high");
    expect(plan.fixedFactors.maxTokens).toBe(2_000);
    expect(plan.gate.questionPunctuation).toBe("observation_only");
  });

  it("runs the checkpoint serially and keeps all bodies private", async () => {
    const workspaceRoot = process.cwd();
    const plan = await createGi088ResponseFirstV23HighPlan(workspaceRoot);
    const temp = await mkdtemp(path.join(os.tmpdir(), "gi088-v23-high-"));
    let call = 0;
    const provider: AIProvider = {
      name: "openai",
      complete: async () => {
        const content = highOutput(`call-${++call}`);
        return {
          content,
          latencyMs: 8_000,
          provider: "openai",
          diagnostics: diagnostics(content)
        };
      }
    };
    const ledger = await runGi088ResponseFirstV23HighPhase({
      cwd: temp,
      workspaceRoot,
      plan,
      provider,
      phase: "checkpoint"
    });
    expect(call).toBe(3);
    expect(ledger.results).toHaveLength(3);
    expect(ledger.results.every((item) => item.status === "valid")).toBe(true);
    const receipt = await readFile(
      path.join(temp, GI088_RESPONSE_FIRST_V23_HIGH_QUALITY_PATHS.publicReceipt),
      "utf8"
    );
    expect(receipt).not.toContain("rawOutput");
    expect(receipt).not.toContain("parsedHigh");
    expect(JSON.parse(receipt).budget).toMatchObject({
      authorized: 9,
      consumed: 3,
      notRun: 6,
      checkpointConsumed: 3,
      fullConsumed: 0
    });
  });

  it("uses the product-owner decisions for the checkpoint semantic gate", async () => {
    const plan = await createGi088ResponseFirstV23HighPlan();
    const results = plan.phases.checkpoint.map((item) => ({
      phase: "checkpoint" as const,
      caseId: item.caseId,
      status: "valid" as const,
      fullRound60sHardPassed: true,
      fullRoundLatencyMs: 20_000
    })) as Gi088ResponseFirstV23HighCallResult[];
    const product = plan.phases.checkpoint.map((item) => ({
      caseId: item.caseId,
      verdict: "pass" as const,
      note: "产品裁决通过"
    }));
    const codex = product.map((item, index) => ({
      ...item,
      verdict: index === 0 ? "fail" as const : "pass" as const
    }));
    expect(evaluateGi088ResponseFirstV23HighReview({
      plan,
      phase: "checkpoint",
      results,
      decisions: codex
    }).gatePassed).toBe(false);
    expect(evaluateGi088ResponseFirstV23HighReview({
      plan,
      phase: "checkpoint",
      results,
      decisions: product
    }).gatePassed).toBe(true);
  });

  it("keeps the full six behind the product checkpoint gate", async () => {
    const workspaceRoot = process.cwd();
    const plan = await createGi088ResponseFirstV23HighPlan(workspaceRoot);
    const temp = await mkdtemp(path.join(os.tmpdir(), "gi088-v23-full-gate-"));
    const provider: AIProvider = {
      name: "openai",
      complete: async () => {
        throw new Error("must not call");
      }
    };
    await expect(runGi088ResponseFirstV23HighPhase({
      cwd: temp,
      workspaceRoot,
      plan,
      provider,
      phase: "full"
    })).rejects.toThrow(
      "GI088_RESPONSE_FIRST_V23_FULL_REQUIRES_PRODUCT_CHECKPOINT_GO"
    );
  });
});
