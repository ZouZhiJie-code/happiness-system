import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { AIProvider } from "../../src/server/services/ai/ai-provider";
import {
  GI088_RESPONSE_FIRST_V21_LOW_PATHS,
  createGi088ResponseFirstV21LowPlan,
  evaluateGi088ResponseFirstV21LowReview,
  runGi088ResponseFirstV21LowPhase,
  type Gi088ResponseFirstV21LowCallResult
} from "../../scripts/run-gi088-response-first-v2-1-low-quality";

function diagnostics(input: {
  output: string;
  latencyMs?: number;
  finishReason?: "stop" | "length";
}) {
  const latencyMs = input.latencyMs ?? 5_000;
  return {
    finishReason: input.finishReason ?? "stop",
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
    contentLength: input.output.length,
    reasoningType: "string" as const,
    headersLatencyMs: 200,
    firstTokenLatencyMs: 2_000,
    bodyLatencyMs: latencyMs - 200,
    totalLatencyMs: latencyMs,
    timeoutStage: null,
    abortSource: null
  };
}

describe("GI-088 response-first v2.1 Low runner", () => {
  it("binds the current standard and the 3 plus 6 call books", async () => {
    const plan = await createGi088ResponseFirstV21LowPlan();
    expect(plan.inputHashes.standardSha256)
      .toBe("08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60");
    expect(plan.phases.checkpoint).toHaveLength(3);
    expect(plan.phases.full).toHaveLength(6);
    expect(plan.runtime.maxTokens).toBe(1_280);
    expect(plan.budget.totalAuthorized).toBe(9);
  });

  it("runs the three checkpoints serially and keeps bodies private", async () => {
    const cwd = process.cwd();
    const plan = await createGi088ResponseFirstV21LowPlan(cwd);
    const temp = await mkdtemp(path.join(os.tmpdir(), "gi088-v21-low-"));
    const outputs = [
      "你指出的修正确实改变了前面的理解，这份在意仍然很真实。",
      "好，我们就沿着修正后的重点继续。",
      "遛狗时的轻松和回家后的烦躁挨得很近，听起来这份反差可能更明显了。"
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
        params.onStreamDiagnostics?.(diagnostics({ output }));
        yield output;
      }
    };
    const ledger = await runGi088ResponseFirstV21LowPhase({
      cwd: temp,
      workspaceRoot: cwd,
      phase: "checkpoint",
      plan,
      provider
    });
    expect(ledger.checkpointResults).toHaveLength(3);
    expect(receivedMaxTokens).toEqual([1_280, 1_280, 1_280]);
    const publicReceipt = await readFile(
      path.join(temp, GI088_RESPONSE_FIRST_V21_LOW_PATHS.publicReceipt),
      "utf8"
    );
    expect(publicReceipt).not.toContain(outputs[0]!);
    expect(publicReceipt).not.toContain("rawOutput");
  });

  it("stops the checkpoint book when the provider reports length", async () => {
    const cwd = process.cwd();
    const plan = await createGi088ResponseFirstV21LowPlan(cwd);
    const temp = await mkdtemp(path.join(os.tmpdir(), "gi088-v21-length-"));
    const provider: AIProvider = {
      name: "openai",
      complete: async () => {
        throw new Error("unused");
      },
      stream: async function* (params) {
        const output = "这次回应还没有说完";
        params.onStreamDiagnostics?.(diagnostics({
          output,
          finishReason: "length"
        }));
        yield output;
      }
    };
    const ledger = await runGi088ResponseFirstV21LowPhase({
      cwd: temp,
      workspaceRoot: cwd,
      phase: "checkpoint",
      plan,
      provider
    });
    expect(ledger.checkpointResults).toHaveLength(1);
    expect(ledger.checkpointResults[0]?.status).toBe("contract_failure");
    expect(ledger.checkpointResults[0]?.validationIssues)
      .toContain("LOW_OUTPUT_TRUNCATED_BY_TOKEN_LIMIT");
  });

  it("requires every checkpoint to pass and applies the full median gate", async () => {
    const plan = await createGi088ResponseFirstV21LowPlan();
    const checkpointResults = plan.phases.checkpoint.map((item, index) => ({
      phase: "checkpoint" as const,
      order: item.order,
      caseId: item.caseId,
      status: "valid" as const,
      hard45sPassed: true,
      totalLatencyMs: 5_000 + index
    })) as unknown as Gi088ResponseFirstV21LowCallResult[];
    const checkpointDecisions = plan.phases.checkpoint.map((item) => ({
      caseId: item.caseId,
      verdict: "pass" as const,
      note: ""
    }));
    expect(evaluateGi088ResponseFirstV21LowReview({
      phase: "checkpoint",
      plan,
      results: checkpointResults,
      decisions: checkpointDecisions
    }).gatePassed).toBe(true);

    const fullResults = plan.phases.full.map((item, index) => ({
      phase: "full" as const,
      order: item.order,
      caseId: item.caseId,
      status: "valid" as const,
      hard45sPassed: true,
      totalLatencyMs: index < 3 ? 14_000 : 16_000
    })) as unknown as Gi088ResponseFirstV21LowCallResult[];
    const fullDecisions = plan.phases.full.map((item) => ({
      caseId: item.caseId,
      verdict: "pass" as const,
      note: ""
    }));
    const failedMedian = evaluateGi088ResponseFirstV21LowReview({
      phase: "full",
      plan,
      results: fullResults,
      decisions: fullDecisions
    });
    expect(failedMedian.medianLatencyMs).toBe(15_000);
    expect(failedMedian.gatePassed).toBe(true);

    fullResults[2]!.totalLatencyMs = 16_000;
    const overMedian = evaluateGi088ResponseFirstV21LowReview({
      phase: "full",
      plan,
      results: fullResults,
      decisions: fullDecisions
    });
    expect(overMedian.medianLatencyMs).toBe(16_000);
    expect(overMedian.gatePassed).toBe(false);
  });

  it("seals the failed checkpoint publicly without exposing private bodies", async () => {
    const receiptPath = path.join(
      process.cwd(),
      GI088_RESPONSE_FIRST_V21_LOW_PATHS.publicReceipt
    );
    const receiptSource = await readFile(receiptPath, "utf8");
    const receipt = JSON.parse(receiptSource) as {
      status: string;
      phases: { checkpoint: { decision: { gatePassed: boolean } } };
      privateBoundary: { publicReceiptContainsUserOrModelBody: boolean };
    };
    const fix = JSON.parse(
      await readFile(
        path.join(path.dirname(receiptPath), "response-first-v2-1-low-quality-v1-runner-fix.json"),
        "utf8"
      )
    ) as {
      correctedStatus: string;
      correctedPublicReceiptSha256: string;
      modelCallsAdded: number;
      historicalRunnerChanged: boolean;
    };

    expect(receipt.status).toBe("stopped_by_checkpoint_quality_gate");
    expect(receipt.phases.checkpoint.decision.gatePassed).toBe(false);
    expect(receipt.privateBoundary.publicReceiptContainsUserOrModelBody).toBe(false);
    expect(receiptSource).not.toContain("rawOutput");
    expect(fix).toMatchObject({
      correctedStatus: "stopped_by_checkpoint_quality_gate",
      correctedPublicReceiptSha256:
        "0c0343afee8438b883d9d26ff7926f0fd0d63a62af29a8216dc1604895c9ba89",
      modelCallsAdded: 0,
      historicalRunnerChanged: false
    });
  });
});
