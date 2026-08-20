import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { AIProvider } from "../../src/server/services/ai/ai-provider";
import {
  GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_IDENTITY,
  GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_PATHS,
  createGi088ResponseFirstV22LowFullV2Plan,
  evaluateGi088ResponseFirstV22LowFullV2Review,
  runGi088ResponseFirstV22LowFullV2,
  writeGi088ResponseFirstV22LowFullV2ReviewHtml,
  type Gi088ResponseFirstV22LowFullV2CallResult
} from "../../scripts/run-gi088-response-first-v2-2-low-full-quality-v2";

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

describe("GI-088 response-first v2.2 Low full quality v2", () => {
  it("keeps the v2.2 candidate and binds a new six-case rubric identity", async () => {
    const plan = await createGi088ResponseFirstV22LowFullV2Plan();
    expect(plan.identity).toBe(GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_IDENTITY);
    expect(plan.candidateIdentity.version)
      .toBe("2026-08-17.gi088-response-first-v2-2-factual-low");
    expect(plan.dataset.version)
      .toBe("2026-08-17.gi088-response-first-six-real-checkpoints-v1-3-product-owner-rubric");
    expect(plan.dataset.modelInputsChangedFromParent).toBe(false);
    expect(plan.dataset.evaluationMetadataChangedFromParent).toBe(true);
    expect(plan.cases).toHaveLength(6);
    expect(plan.budget.authorized).toBe(6);
    expect(plan.runtime.maxTokens).toBe(1_280);
    expect(plan.runtime.retries).toBe(0);
    expect(plan.reviewOrder).toEqual([
      "complete_relevant_user_and_assistant_context",
      "actual_low_output",
      "technical_status_and_latency",
      "codex_provisional_judgment",
      "product_owner_final_judgment"
    ]);
  });

  it("runs six calls serially and keeps model bodies out of the public receipt", async () => {
    const workspaceRoot = process.cwd();
    const plan = await createGi088ResponseFirstV22LowFullV2Plan(workspaceRoot);
    const temp = await mkdtemp(path.join(os.tmpdir(), "gi088-v22-low-full-v2-"));
    const outputs = plan.cases.map(
      (item) => `这是 ${item.caseId} 的自然事实承接。`
    );
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
    const ledger = await runGi088ResponseFirstV22LowFullV2({
      cwd: temp,
      workspaceRoot,
      plan,
      provider
    });
    expect(ledger.results).toHaveLength(6);
    expect(receivedMaxTokens).toEqual([1_280, 1_280, 1_280, 1_280, 1_280, 1_280]);
    const receipt = await readFile(
      path.join(temp, GI088_RESPONSE_FIRST_V22_LOW_FULL_V2_PATHS.publicReceipt),
      "utf8"
    );
    expect(receipt).not.toContain(outputs[0]!);
    expect(receipt).not.toContain("rawOutput");
    expect(JSON.parse(receipt).budget).toMatchObject({
      authorized: 6,
      consumed: 6,
      notRun: 0
    });

    const codexDecisions = plan.cases.map((item) => ({
      caseId: item.caseId,
      verdict: "pass" as const,
      note: "初评通过"
    }));
    const reviewFile = await writeGi088ResponseFirstV22LowFullV2ReviewHtml({
      cwd: temp,
      workspaceRoot,
      plan,
      results: ledger.results,
      codexDecisions
    });
    const review = await readFile(reviewFile, "utf8");
    const contextIndex = review.indexOf("1. 完整相关原文");
    const outputIndex = review.indexOf(outputs[0]!);
    const technicalIndex = review.indexOf("3. 技术事实");
    const codexIndex = review.indexOf("4. Codex 初评");
    expect(contextIndex).toBeGreaterThan(-1);
    expect(contextIndex).toBeLessThan(outputIndex);
    expect(outputIndex).toBeLessThan(technicalIndex);
    expect(technicalIndex).toBeLessThan(codexIndex);
    expect((await stat(reviewFile)).mode & 0o777).toBe(0o600);
  });

  it("keeps Codex provisional and lets the product-owner review determine the semantic gate", async () => {
    const plan = await createGi088ResponseFirstV22LowFullV2Plan();
    const results = plan.cases.map((item, index) => ({
      order: item.order,
      caseId: item.caseId,
      status: "valid" as const,
      target15sPassed: true,
      hard45sPassed: true,
      totalLatencyMs: 4_000 + index * 200
    })) as unknown as Gi088ResponseFirstV22LowFullV2CallResult[];
    const productDecisions = plan.cases.map((item) => ({
      caseId: item.caseId,
      verdict: "pass" as const,
      note: ""
    }));
    const codexDecisions = productDecisions.map((item, index) => ({
      ...item,
      verdict: index === 0 ? "fail" as const : "pass" as const
    }));
    expect(evaluateGi088ResponseFirstV22LowFullV2Review({
      plan,
      results,
      decisions: codexDecisions
    }).gatePassed).toBe(false);
    expect(evaluateGi088ResponseFirstV22LowFullV2Review({
      plan,
      results,
      decisions: productDecisions
    }).gatePassed).toBe(true);
  });
});
