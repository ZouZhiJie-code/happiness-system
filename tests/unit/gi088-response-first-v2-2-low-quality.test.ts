import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { AIProvider } from "../../src/server/services/ai/ai-provider";
import {
  GI088_RESPONSE_FIRST_V22_LOW_PATHS,
  createGi088ResponseFirstV22LowPlan,
  evaluateGi088ResponseFirstV22LowReview,
  runGi088ResponseFirstV22LowPhase,
  type Gi088ResponseFirstV22LowCallResult
} from "../../scripts/run-gi088-response-first-v2-2-low-quality";

function diagnostics(output: string, latencyMs = 5_000) {
  return {
    finishReason: "stop" as const,
    reasoningPresent: true,
    reasoningLength: 40,
    reasoningTokens: 20,
    latencyMs,
    tokenUsage: {
      promptTokens: 200,
      completionTokens: 60,
      totalTokens: 260
    },
    httpStatus: 200,
    responseModel: "deepseek-v4-pro",
    choiceCount: 1,
    contentType: "string" as const,
    contentLength: output.length,
    reasoningType: "string" as const,
    headersLatencyMs: 200,
    firstTokenLatencyMs: 2_000,
    bodyLatencyMs: latencyMs - 200,
    totalLatencyMs: latencyMs,
    timeoutStage: null,
    abortSource: null
  };
}

describe("GI-088 response-first v2.2 Low runner", () => {
  it("binds the frozen standard, exact parent dataset and 3 plus 6 books", async () => {
    const plan = await createGi088ResponseFirstV22LowPlan();
    expect(plan.inputHashes.standardSha256)
      .toBe("08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60");
    expect(plan.candidateIdentity.version)
      .toBe("2026-08-17.gi088-response-first-v2-2-factual-low");
    expect(plan.phases.checkpoint).toHaveLength(3);
    expect(plan.phases.full).toHaveLength(6);
    expect(plan.runtime.maxTokens).toBe(1_280);
    expect(plan.gate.checkpoint.medianTargetMs).toBe(6_000);
    expect(plan.gate.checkpoint.singleTargetMs).toBe(15_000);
    expect(plan.budget.totalAuthorized).toBe(9);
  });

  it("runs the checkpoint serially and keeps model bodies private", async () => {
    const workspaceRoot = process.cwd();
    const plan = await createGi088ResponseFirstV22LowPlan(workspaceRoot);
    const temp = await mkdtemp(path.join(os.tmpdir(), "gi088-v22-low-"));
    const outputs = [
      "你刚刚修正了前面的理解，我按你现在说的内容来接着听。",
      "好，我们沿着你修正后的重点继续。",
      "你说在外面会轻松一些，回家以后会烦躁，这份差异很清楚。"
    ];
    const receivedMaxTokens: number[] = [];
    let call = 0;
    const provider: AIProvider = {
      name: "openai",
      complete: async () => {
        throw new Error("unused");
      },
      stream: async function* (params) {
        receivedMaxTokens.push(params.maxTokens ?? 0);
        const output = outputs[call++]!;
        params.onStreamDiagnostics?.(diagnostics(output));
        yield output;
      }
    };
    const ledger = await runGi088ResponseFirstV22LowPhase({
      cwd: temp,
      workspaceRoot,
      phase: "checkpoint",
      plan,
      provider
    });
    expect(ledger.checkpointResults).toHaveLength(3);
    expect(receivedMaxTokens).toEqual([1_280, 1_280, 1_280]);
    const receipt = await readFile(
      path.join(temp, GI088_RESPONSE_FIRST_V22_LOW_PATHS.publicReceipt),
      "utf8"
    );
    expect(receipt).not.toContain(outputs[0]!);
    expect(receipt).not.toContain("rawOutput");
  });

  it("requires 3 passes, a six-second median and every call within fifteen seconds", async () => {
    const plan = await createGi088ResponseFirstV22LowPlan();
    const results = plan.phases.checkpoint.map((item, index) => ({
      phase: "checkpoint" as const,
      order: item.order,
      caseId: item.caseId,
      status: "valid" as const,
      target15sPassed: true,
      hard45sPassed: true,
      totalLatencyMs: 5_000 + index * 500
    })) as unknown as Gi088ResponseFirstV22LowCallResult[];
    const decisions = plan.phases.checkpoint.map((item) => ({
      caseId: item.caseId,
      verdict: "pass" as const,
      note: ""
    }));
    expect(evaluateGi088ResponseFirstV22LowReview({
      phase: "checkpoint",
      plan,
      results,
      decisions
    }).gatePassed).toBe(true);

    results[1]!.totalLatencyMs = 6_001;
    results[2]!.totalLatencyMs = 6_500;
    expect(evaluateGi088ResponseFirstV22LowReview({
      phase: "checkpoint",
      plan,
      results,
      decisions
    }).gatePassed).toBe(false);

    results[1]!.totalLatencyMs = 5_500;
    results[2]!.totalLatencyMs = 6_000;
    results[2]!.target15sPassed = false;
    expect(evaluateGi088ResponseFirstV22LowReview({
      phase: "checkpoint",
      plan,
      results,
      decisions
    }).gatePassed).toBe(false);
  });
});
