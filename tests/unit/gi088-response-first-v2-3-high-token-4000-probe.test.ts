import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { AIProvider } from "../../src/server/services/ai/ai-provider";
import {
  GI088_RESPONSE_FIRST_V23_TOKEN_4000_PATHS,
  createGi088ResponseFirstV23Token4000Plan,
  runGi088ResponseFirstV23Token4000Probe
} from "../../scripts/run-gi088-response-first-v2-3-high-token-4000-probe";

function validHighOutput() {
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
    visibleAppend: { correctableUnderstanding: null }
  });
}

function diagnostics(content: string, finishReason: "stop" | "length") {
  return {
    finishReason,
    reasoningPresent: true,
    reasoningLength: 120,
    reasoningTokens: 1_985,
    latencyMs: 20_000,
    tokenUsage: {
      promptTokens: 1_873,
      completionTokens: finishReason === "stop" ? 2_400 : 4_000,
      totalTokens: finishReason === "stop" ? 4_273 : 5_873
    },
    httpStatus: 200,
    responseModel: "deepseek-v4-pro",
    choiceCount: 1,
    contentType: "string" as const,
    contentLength: content.length,
    reasoningType: "string" as const,
    headersLatencyMs: 300,
    firstTokenLatencyMs: null,
    bodyLatencyMs: 19_700,
    totalLatencyMs: 20_000,
    timeoutStage: null,
    abortSource: null
  };
}

describe("GI-088 response-first v2.3 High 4000 Token probe", () => {
  it("binds the parent failure and authorizes exactly one call", async () => {
    const plan = await createGi088ResponseFirstV23Token4000Plan();
    expect(plan.fixedFactors).toMatchObject({
      oldMaxTokens: 2_000,
      newMaxTokens: 4_000,
      retries: 0,
      recovery: 0,
      fallback: 0
    });
    expect(plan.budget.authorized).toBe(1);
    expect(plan.dataset.caseId).toBe("RPR-REAL-19-CORRECTION");
  });

  it("stores the full body privately and emits a redacted valid receipt", async () => {
    const plan = await createGi088ResponseFirstV23Token4000Plan();
    const temp = await mkdtemp(path.join(os.tmpdir(), "gi088-v23-token-4000-"));
    const content = validHighOutput();
    let calls = 0;
    const provider: AIProvider = {
      name: "openai",
      complete: async (request) => {
        calls += 1;
        expect(request.maxTokens).toBe(4_000);
        return {
          content,
          latencyMs: 20_000,
          provider: "openai",
          diagnostics: diagnostics(content, "stop")
        };
      }
    };
    const ledger = await runGi088ResponseFirstV23Token4000Probe({
      cwd: temp,
      workspaceRoot: process.cwd(),
      plan,
      provider
    });
    expect(calls).toBe(1);
    expect(ledger.result?.status).toBe("valid");
    const receipt = await readFile(
      path.join(temp, GI088_RESPONSE_FIRST_V23_TOKEN_4000_PATHS.publicReceipt),
      "utf8"
    );
    expect(receipt).not.toContain(content);
    expect(JSON.parse(receipt)).toMatchObject({
      budget: { authorized: 1, consumed: 1, notRun: 0 },
      result: { status: "valid", finishReason: "stop" }
    });
  });

  it("records a length finish as a stopped contract failure", async () => {
    const plan = await createGi088ResponseFirstV23Token4000Plan();
    const temp = await mkdtemp(path.join(os.tmpdir(), "gi088-v23-token-4000-length-"));
    const content = validHighOutput();
    const provider: AIProvider = {
      name: "openai",
      complete: async () => ({
        content,
        latencyMs: 20_000,
        provider: "openai",
        diagnostics: diagnostics(content, "length")
      })
    };
    const ledger = await runGi088ResponseFirstV23Token4000Probe({
      cwd: temp,
      workspaceRoot: process.cwd(),
      plan,
      provider
    });
    expect(ledger.result).toMatchObject({
      status: "contract_failure",
      validationIssues: ["HIGH_FINISH_REASON_INVALID:length"]
    });
  });
});
