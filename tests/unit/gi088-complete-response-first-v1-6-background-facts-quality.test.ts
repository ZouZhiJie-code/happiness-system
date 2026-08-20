import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import type {
  AICompletionParams,
  AIProvider,
  AIProviderFinishReason
} from "../../src/server/services/ai/ai-provider";
import {
  createGi088CompleteResponseFirstV16BackgroundFactsQualityPlan,
  runGi088CompleteResponseFirstV16BackgroundFactsCase,
  shouldRunGi088CompleteResponseFirstV16BackgroundFactsQualityCli
} from "../../scripts/run-gi088-complete-response-first-v1-6-background-facts-quality";
import { loadGi088CompleteResponseFirstCases } from "../../scripts/gi088-complete-response-first-fixtures";

const PARENT_LEDGER =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/.private/complete-response-first-v1-6-contrastive-coverage-quality-v1/ledger.json";

async function parentVisibleOutput(caseId: string) {
  const ledger = JSON.parse(await readFile(PARENT_LEDGER, "utf8")) as {
    results: Array<{ caseId: string; actualVisibleOutput: string }>;
  };
  return ledger.results.find((item) => item.caseId === caseId)!.actualVisibleOutput;
}

function provider(input: {
  createContent: (request: AICompletionParams) => string;
  finishReason?: AIProviderFinishReason;
}) : AIProvider {
  return {
    name: "openai",
    complete: vi.fn(async (request) => {
      const content = input.createContent(request);
      const finishReason = input.finishReason ?? "stop";
      return {
        content,
        latencyMs: 2_400,
        provider: "openai",
        tokenUsage: { promptTokens: 900, completionTokens: 160, totalTokens: 1_060 },
        diagnostics: {
          finishReason,
          reasoningPresent: false,
          reasoningLength: 0,
          reasoningTokens: null,
          latencyMs: 2_400,
          tokenUsage: { promptTokens: 900, completionTokens: 160, totalTokens: 1_060 },
          httpStatus: 200,
          responseModel: "deepseek-v4-pro",
          contentLength: content.length,
          totalLatencyMs: 2_400
        }
      };
    })
  };
}

function validContent(request: AICompletionParams) {
  const payload = JSON.parse(request.messages[1]!.content) as {
    pendingUserMessageIds: string[];
  };
  return JSON.stringify({
    processedUserMessageIds: payload.pendingUserMessageIds,
    factDeltas: [],
    corrections: []
  });
}

describe("GI-088 v1.6 后台事实运行器", () => {
  it("冻结父可见证据、八题和独立后台调用条件", async () => {
    const plan = await createGi088CompleteResponseFirstV16BackgroundFactsQualityPlan();

    expect(plan.identity).toBe(
      "2026-08-20.gi088-complete-response-first-v1-6-background-facts-quality-v1"
    );
    expect(plan.cases).toHaveLength(8);
    expect(plan.parentEvidence).toMatchObject({
      identity:
        "2026-08-20.gi088-complete-response-first-v1-6-contrastive-coverage-quality-v1",
      technicalCases: 8,
      contractValidCases: 8,
      visibleProductVerdict: "pending"
    });
    expect(plan.runtime).toMatchObject({
      model: "deepseek-v4-pro",
      temperature: 0.2,
      maxTokens: 1_600,
      timeoutMs: 20_000,
      thinking: "disabled",
      reasoningEffort: null,
      responseFormat: "json_object",
      maxAttempts: 1,
      retries: 0,
      recovery: 0,
      fallback: 0
    });
    expect(plan.inputHashes).toHaveProperty("backgroundCandidateSha256");
    expect(plan.inputHashes).toHaveProperty("backgroundContractSha256");
    expect(plan.inputHashes).toHaveProperty("parentPrivateLedgerSha256");
  });

  it("使用实际可见回复作为助手来源，并以一次关闭思考的 JSON 调用完成整理", async () => {
    const [plan, dataset] = await Promise.all([
      createGi088CompleteResponseFirstV16BackgroundFactsQualityPlan(),
      loadGi088CompleteResponseFirstCases()
    ]);
    const item = dataset.cases[0]!;
    const entry = plan.cases[0]!;
    const visibleOutput = await parentVisibleOutput(item.caseId);
    const mock = provider({ createContent: validContent });
    const result = await runGi088CompleteResponseFirstV16BackgroundFactsCase({
      entry,
      item,
      parentVisibleOutput: visibleOutput,
      provider: mock
    });

    expect(mock.complete).toHaveBeenCalledOnce();
    expect(result.status).toBe("technical_valid");
    expect(result.technicalGatePassed).toBe(true);
    expect(result.parentVisibleOutput).toBe(visibleOutput);
    expect(result.generationInput.conversation.at(-1)).toMatchObject({
      role: "assistant",
      content: visibleOutput
    });
    expect(result.requestContract).toEqual({
      temperature: 0.2,
      maxTokens: 1_600,
      timeoutMs: 20_000,
      responseFormat: "json_object",
      thinking: "disabled",
      reasoningEffortPresent: false
    });
  });

  it("伪造的逐字依据触发严重来源门", async () => {
    const [plan, dataset] = await Promise.all([
      createGi088CompleteResponseFirstV16BackgroundFactsQualityPlan(),
      loadGi088CompleteResponseFirstCases()
    ]);
    const item = dataset.cases[0]!;
    const entry = plan.cases[0]!;
    const mock = provider({
      createContent: (request) => {
        const payload = JSON.parse(request.messages[1]!.content) as {
          pendingUserMessageIds: string[];
        };
        return JSON.stringify({
          processedUserMessageIds: payload.pendingUserMessageIds,
          factDeltas: [{
            sourceUserMessageId: payload.pendingUserMessageIds[0],
            statement: "一条无依据的事实",
            quote: "原文中不存在的逐字内容",
            scope: "current_event",
            stance: "affirmed",
            kind: "event_detail"
          }],
          corrections: []
        });
      }
    });
    const result = await runGi088CompleteResponseFirstV16BackgroundFactsCase({
      entry,
      item,
      parentVisibleOutput: await parentVisibleOutput(item.caseId),
      provider: mock
    });

    expect(result.status).toBe("program_gate_failure");
    expect(result.severeProgramGateFailed).toBe(true);
    expect(result.validationIssues).toContain("FACT_QUOTE_NOT_IN_SOURCE_USER_MESSAGE");
  });

  it("达到 Token 上限时单列为技术不确定", async () => {
    const [plan, dataset] = await Promise.all([
      createGi088CompleteResponseFirstV16BackgroundFactsQualityPlan(),
      loadGi088CompleteResponseFirstCases()
    ]);
    const item = dataset.cases[0]!;
    const result = await runGi088CompleteResponseFirstV16BackgroundFactsCase({
      entry: plan.cases[0]!,
      item,
      parentVisibleOutput: await parentVisibleOutput(item.caseId),
      provider: provider({ createContent: validContent, finishReason: "length" })
    });

    expect(result.status).toBe("technical_failure");
    expect(result.errorCode).toBe("TOKEN_CEILING_INCONCLUSIVE");
    expect(result.technicalChecks.finishLength).toBe(true);
  });

  it("测试环境不会误触发模型调用", () => {
    expect(shouldRunGi088CompleteResponseFirstV16BackgroundFactsQualityCli({
      argv: ["node", "unrelated.ts"],
      env: { VITEST: "true" }
    })).toBe(false);
  });
});
