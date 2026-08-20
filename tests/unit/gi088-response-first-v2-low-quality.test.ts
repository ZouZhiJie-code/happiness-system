import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { AIProvider } from "../../src/server/services/ai/ai-provider";
import {
  createGi088ResponseFirstV2LowPlan,
  evaluateGi088ResponseFirstV2LowReview,
  normalizeGi088ResponseFirstV2LowResult,
  runGi088ResponseFirstV2LowCalls
} from "../../scripts/run-gi088-response-first-v2-low-quality";

describe("GI-088 response-first v2 Low quality runner", () => {
  it("runs six streams serially and keeps bodies out of the public receipt", async () => {
    const cwd = process.cwd();
    const plan = await createGi088ResponseFirstV2LowPlan(cwd);
    const temp = await mkdtemp(path.join(os.tmpdir(), "gi088-v2-low-"));
    const outputs = [
      "被依赖和被喜欢的感觉，在它奔向你的那个瞬间一下就落到了实处。",
      "你指出的反转很关键：你仍然很在意比较，前面说的接纳并没有覆盖这份真实感受。",
      "好，我们就沿着这份仍然在意比较的真实感受继续往下走。",
      "一边接受奶奶的心意，一边又被推到解释工作的处境里，这份烦和累都很具体。",
      "遛狗时的开心和回家后的烦躁挨在一起，难怪你会更明显地觉得外面好玩。",
      "看到他和别人频繁联系、却很少联系你，那份落差很容易把对自己的怀疑一起带出来。"
    ];
    let call = 0;
    const provider: AIProvider = {
      name: "openai",
      complete: async () => {
        throw new Error("unused");
      },
      stream: async function* (params) {
        const output = outputs[call++]!;
        params.onStreamDiagnostics?.({
          finishReason: "stop",
          reasoningPresent: false,
          reasoningLength: 0,
          reasoningTokens: 0,
          latencyMs: 5_000,
          tokenUsage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
          httpStatus: 200,
          responseModel: "deepseek-v4-pro",
          choiceCount: 1,
          contentType: "string",
          contentLength: output.length,
          reasoningType: "missing",
          headersLatencyMs: 300,
          firstTokenLatencyMs: 2_000,
          bodyLatencyMs: 4_700,
          totalLatencyMs: 5_000,
          timeoutStage: null,
          abortSource: null
        });
        yield output;
      }
    };
    const execution = await runGi088ResponseFirstV2LowCalls({
      cwd: temp,
      workspaceRoot: cwd,
      plan,
      provider
    });
    expect(execution.consumedCalls).toBe(6);
    expect(execution.results.every((item) => item.status === "valid")).toBe(true);
    const publicReceipt = await readFile(
      path.join(
        temp,
        "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-low-quality-v1-receipt.json"
      ),
      "utf8"
    );
    expect(publicReceipt).not.toContain(outputs[0]!);
    expect(publicReceipt).not.toContain("rawOutput");
  });

  it("stops immediately when Low contains a question", async () => {
    const cwd = process.cwd();
    const plan = await createGi088ResponseFirstV2LowPlan(cwd);
    const temp = await mkdtemp(path.join(os.tmpdir(), "gi088-v2-low-stop-"));
    const provider: AIProvider = {
      name: "openai",
      complete: async () => {
        throw new Error("unused");
      },
      stream: async function* (params) {
        params.onStreamDiagnostics?.({
          finishReason: "stop",
          reasoningPresent: false,
          reasoningLength: 0,
          reasoningTokens: 0,
          latencyMs: 1_000,
          tokenUsage: null,
          httpStatus: 200,
          responseModel: "deepseek-v4-pro",
          choiceCount: 1,
          contentType: "string",
          contentLength: 8,
          reasoningType: "missing",
          headersLatencyMs: 100,
          firstTokenLatencyMs: 500,
          bodyLatencyMs: 900,
          totalLatencyMs: 1_000,
          timeoutStage: null,
          abortSource: null
        });
        yield "你最在意什么？";
      }
    };
    const execution = await runGi088ResponseFirstV2LowCalls({
      cwd: temp,
      workspaceRoot: cwd,
      plan,
      provider
    });
    expect(execution.consumedCalls).toBe(1);
    expect(execution.results[0]?.validationIssues)
      .toContain("LOW_ZERO_QUESTION_VIOLATION");
    expect(execution.notRun).toHaveLength(5);
  });

  it("applies hard-case and one-soft-minor review gates", async () => {
    const plan = await createGi088ResponseFirstV2LowPlan();
    const results = plan.cases.map((item) => ({
      order: item.order,
      caseId: item.caseId,
      status: "valid" as const,
      hard45sPassed: true
    })) as never;
    const decisions: Array<{
      caseId: (typeof plan.cases)[number]["caseId"];
      verdict: "pass" | "minor" | "fail";
      note: string;
    }> = plan.cases.map((item) => ({
      caseId: item.caseId,
      verdict: item.caseId === "RPR-REAL-06" ? "minor" as const : "pass" as const,
      note: ""
    }));
    expect(evaluateGi088ResponseFirstV2LowReview({ plan, results, decisions }).gatePassed)
      .toBe(true);
    decisions.find((item) => item.caseId === "RPR-REAL-19-CONTINUE")!.verdict = "fail";
    expect(evaluateGi088ResponseFirstV2LowReview({ plan, results, decisions }).gatePassed)
      .toBe(false);
  });

  it("treats a provider length finish as an incomplete Low response", () => {
    const normalized = normalizeGi088ResponseFirstV2LowResult({
      status: "valid",
      validationIssues: [],
      errorCode: null,
      target15sPassed: true,
      hard45sPassed: true,
      diagnostics: {
        finishReason: "length",
        reasoningPresent: true,
        reasoningLength: 10,
        reasoningTokens: 8,
        latencyMs: 100,
        tokenUsage: null
      }
    } as never);
    expect(normalized.status).toBe("contract_failure");
    expect(normalized.validationIssues)
      .toContain("LOW_OUTPUT_TRUNCATED_BY_TOKEN_LIMIT");
  });
});
