import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { AIProvider } from "../../src/server/services/ai/ai-provider";
import {
  GI088_RESPONSE_FIRST_V24_HIGH_QUALITY_IDENTITY,
  GI088_RESPONSE_FIRST_V24_PATHS,
  createGi088ResponseFirstV24Plan,
  evaluateGi088ResponseFirstV24Review,
  runGi088ResponseFirstV24Phase,
  type Gi088ResponseFirstV24CallResult
} from "../../scripts/run-gi088-response-first-v2-4-null-task-aligned-high";

function highOutput(orphanUnderstanding = false) {
  return JSON.stringify({
    semantic: {
      actionIntent: "acknowledge",
      taskChange: orphanUnderstanding
        ? { kind: "unchanged" }
        : {
            kind: "set",
            continuity: "new",
            targetRef: null,
            summary: "理解用户在比较中的矛盾感受",
            evidenceRefs: ["U3"]
          },
      understandingChange: {
        kind: "add",
        summary: "用户仍然在意与他人的比较",
        evidenceRefs: ["U3"]
      },
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
    visibleAppend: { correctableUnderstanding: null }
  });
}

function diagnostics(content: string, latencyMs = 20_000) {
  return {
    finishReason: "stop" as const,
    reasoningPresent: true,
    reasoningLength: 1_000,
    reasoningTokens: 700,
    latencyMs,
    tokenUsage: {
      promptTokens: 1_800,
      completionTokens: 1_100,
      totalTokens: 2_900
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

describe("GI-088 response-first v2.4 High runner", () => {
  it("binds one first case, five remaining cases, and the 4 plus 2 task states", async () => {
    const plan = await createGi088ResponseFirstV24Plan();
    expect(plan.identity).toBe(GI088_RESPONSE_FIRST_V24_HIGH_QUALITY_IDENTITY);
    expect(plan.phases.first_gate).toHaveLength(1);
    expect(plan.phases.remaining).toHaveLength(5);
    expect(plan.dataset.initialWorkingTask.null).toHaveLength(4);
    expect(plan.dataset.initialWorkingTask.existing).toEqual([
      "RPR-REAL-19-CONTINUE",
      "RPR-LC-21"
    ]);
    expect(plan.fixedFactors).toMatchObject({
      maxTokens: 4_000,
      concurrency: 1,
      retries: 0,
      recovery: 0,
      fallback: 0,
      programValidation: "unchanged_strict_state_contract"
    });
    expect(plan.budget).toMatchObject({
      authorized: 6,
      firstGate: 1,
      remaining: 5
    });
  });

  it("runs only the first case and keeps all conversation bodies private", async () => {
    const workspaceRoot = process.cwd();
    const plan = await createGi088ResponseFirstV24Plan(workspaceRoot);
    const temp = await mkdtemp(path.join(os.tmpdir(), "gi088-v24-first-"));
    let calls = 0;
    const provider: AIProvider = {
      name: "openai",
      complete: async () => {
        calls += 1;
        const content = highOutput();
        return {
          content,
          latencyMs: 20_000,
          provider: "openai",
          diagnostics: diagnostics(content)
        };
      }
    };
    const ledger = await runGi088ResponseFirstV24Phase({
      cwd: temp,
      workspaceRoot,
      plan,
      provider,
      phase: "first_gate"
    });
    expect(calls).toBe(1);
    expect(ledger.startedCaseIds).toEqual(["RPR-REAL-19-CORRECTION"]);
    expect(ledger.results).toHaveLength(1);
    expect(ledger.results[0]?.status).toBe("valid");
    const receiptSource = await readFile(
      path.join(temp, GI088_RESPONSE_FIRST_V24_PATHS.publicReceipt),
      "utf8"
    );
    expect(receiptSource).not.toContain("rawOutput");
    expect(receiptSource).not.toContain("parsedHigh");
    expect(JSON.parse(receiptSource).budget).toMatchObject({
      authorized: 6,
      consumed: 1,
      completed: 1,
      notRun: 5,
      retries: 0,
      recovery: 0,
      fallback: 0
    });
  });

  it("stops the first gate on the unchanged program contract failure", async () => {
    const workspaceRoot = process.cwd();
    const plan = await createGi088ResponseFirstV24Plan(workspaceRoot);
    const temp = await mkdtemp(path.join(os.tmpdir(), "gi088-v24-contract-"));
    let calls = 0;
    const provider: AIProvider = {
      name: "openai",
      complete: async () => {
        calls += 1;
        const content = highOutput(true);
        return {
          content,
          latencyMs: 20_000,
          provider: "openai",
          diagnostics: diagnostics(content)
        };
      }
    };
    const ledger = await runGi088ResponseFirstV24Phase({
      cwd: temp,
      workspaceRoot,
      plan,
      provider,
      phase: "first_gate"
    });
    expect(calls).toBe(1);
    expect(ledger.results[0]?.status).toBe("contract_failure");
    expect(ledger.results[0]?.validationIssues)
      .toContain("NULL_WORKING_TASK_UNDERSTANDING_DELTA_MUST_BE_NULL");
  });

  it("accepts a product minor for continuation but keeps the final hard-case bar visible", async () => {
    const plan = await createGi088ResponseFirstV24Plan();
    const result = {
      phase: "first_gate",
      caseId: "RPR-REAL-19-CORRECTION",
      status: "valid",
      fullRound60sHardPassed: true,
      fullRoundLatencyMs: 40_000
    } as Gi088ResponseFirstV24CallResult;
    const summary = evaluateGi088ResponseFirstV24Review({
      plan,
      phase: "first_gate",
      results: [result],
      decisions: [{
        caseId: "RPR-REAL-19-CORRECTION",
        verdict: "minor",
        note: "允许继续验证其余五题"
      }]
    });
    expect(summary.continuationAllowed).toBe(true);
    expect(summary.gatePassed).toBe(true);
    expect(summary.hardCasesPass).toBe(false);
  });

  it("keeps the remaining five behind the product first-case decision", async () => {
    const workspaceRoot = process.cwd();
    const plan = await createGi088ResponseFirstV24Plan(workspaceRoot);
    const temp = await mkdtemp(path.join(os.tmpdir(), "gi088-v24-gate-"));
    const provider: AIProvider = {
      name: "openai",
      complete: async () => {
        throw new Error("must not call");
      }
    };
    await expect(runGi088ResponseFirstV24Phase({
      cwd: temp,
      workspaceRoot,
      plan,
      provider,
      phase: "remaining"
    })).rejects.toThrow(
      "GI088_RESPONSE_FIRST_V24_REMAINING_REQUIRES_PRODUCT_FIRST_PASS_OR_MINOR"
    );
  });
});
