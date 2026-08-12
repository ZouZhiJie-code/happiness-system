import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { GI088_V8R3_DEVELOPMENT_CASES } from "../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/development-fixtures";
import {
  GI088_RUNTIME_CONTRACT_DIAGNOSTIC_INITIAL_CALLS,
  GI088_RUNTIME_CONTRACT_DIAGNOSTIC_TOTAL_CALLS_MAXIMUM,
  GI088_RUNTIME_CONTRACT_FINAL_CASE_IDS,
  createGi088RuntimeContractCompletionParams,
  createGi088RuntimeContractGroupDefinition,
  createGi088RuntimeContractSchedule
} from "../../evals/event-centered-generative/gi088-runtime-contract-root-cause/contracts";
import {
  createGi088RuntimeContractPublicSummary,
  executeGi088RuntimeContractDiagnostic,
  readGi088RuntimeContractDiagnosticReport,
  writeGi088RuntimeContractDiagnosticArtifacts
} from "../../evals/event-centered-generative/gi088-runtime-contract-root-cause/runner";
import type {
  AICompletionParams,
  AICompletionResult,
  AIProvider
} from "@/server/services/ai/ai-provider";
import {
  assertGi088RuntimeContractDiagnosticAuthorization,
  validateGi088RuntimeContractDiagnosticEnvironment
} from "../../scripts/run-gi088-runtime-contract-root-cause";

const CASES = GI088_V8R3_DEVELOPMENT_CASES.slice(0, 24);
const FINGERPRINTS = {
  candidateFingerprint: "a".repeat(64),
  datasetFingerprint: "b".repeat(64),
  runnerFingerprint: "c".repeat(64),
  experienceFingerprint: "d".repeat(64),
  executionFingerprint: "e".repeat(64)
};

function modelInput(params: AICompletionParams) {
  return JSON.parse(params.messages.at(-1)!.content) as {
    latestUserMessageId: string;
    visibleConversation?: Array<{ id: string; role: "user" | "assistant" }>;
    semanticContext: {
      workingTask: { ref: string; summary: string; evidenceRefs?: string[] };
    };
  };
}

function safeDiagnostics(model: string, latencyMs = 321) {
  return {
    finishReason: "stop" as const,
    reasoningPresent: true,
    reasoningLength: 123,
    reasoningTokens: 7,
    latencyMs,
    tokenUsage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
    upstreamRequestId: "private-upstream-request-id",
    httpStatus: 200,
    responseModel: model,
    choiceCount: 1,
    contentType: "object" as const,
    contentLength: 300,
    reasoningType: "string" as const,
    headersLatencyMs: 20,
    bodyLatencyMs: latencyMs - 20,
    totalLatencyMs: latencyMs,
    timeoutStage: null,
    abortSource: null
  };
}

function fullResult(params: AICompletionParams): AICompletionResult {
  const input = modelInput(params);
  const evidenceRefs = [
    ...(input.semanticContext.workingTask.evidenceRefs ?? []),
    input.latestUserMessageId
  ].filter((value, index, values) => values.indexOf(value) === index);
  const content = JSON.stringify({
    semantic: {
      stage: "explore_clarify",
      action: "ask",
      workingTask: {
        continuity: "continue",
        targetRef: input.semanticContext.workingTask.ref,
        summary: input.semanticContext.workingTask.summary,
        evidenceRefs
      },
      understandingChange: { kind: "none" },
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: {
        answerTarget: "补充一个推进当前共同任务的具体线索",
        taskEffect: "用新线索更新当前共同任务",
        evidenceRefs: [input.latestUserMessageId]
      },
      answerOpportunity: "new",
      burdenSignalChange: { kind: "unchanged" },
      pauseReason: null
    },
    visible: {
      understanding: "我会继续围绕你刚才确认的重点。",
      response: "你愿意补充一个最能帮助我们弄清当前问题的具体线索吗？"
    }
  });
  return {
    content,
    latencyMs: 321,
    provider: "openai",
    tokenUsage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
    diagnostics: safeDiagnostics("test-full")
  };
}

function simplifiedResult(params: AICompletionParams): AICompletionResult {
  const input = modelInput(params);
  return {
    content: JSON.stringify({
      action: "ask",
      evidenceRefs: [
        ...(input.semanticContext.workingTask.evidenceRefs ?? []),
        input.latestUserMessageId
      ].filter((value, index, values) => values.indexOf(value) === index),
      answerTarget: "补充一个推进当前共同任务的具体线索",
      understanding: "我会继续围绕你刚才确认的重点。",
      response: "你愿意补充一个最能帮助我们弄清当前问题的具体线索吗？"
    }),
    latencyMs: 201,
    provider: "openai",
    diagnostics: safeDiagnostics("test-simplified", 201)
  };
}

function provider(
  result: "full" | "simplified" | "empty",
  seen: AICompletionParams[] = []
): AIProvider {
  return {
    name: "openai",
    async complete(params) {
      seen.push(params);
      if (result === "full") return fullResult(params);
      if (result === "simplified") return simplifiedResult(params);
      return {
        content: "",
        latencyMs: 111,
        provider: "openai",
        diagnostics: safeDiagnostics("test-empty", 111)
      };
    }
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GI-088 模型运行链与输出合同根因对照", () => {
  it("固定 24 个公开单轮案例并生成稳定的 96 次轮换调度", () => {
    const first = createGi088RuntimeContractSchedule(CASES);
    const second = createGi088RuntimeContractSchedule([...CASES].reverse());
    expect(first.schedule).toEqual(second.schedule);
    expect(first.schedule).toHaveLength(96);
    expect(first.scheduleFingerprint).toBe(second.scheduleFingerprint);
    expect(first.shuffledCaseIds).toHaveLength(24);
    expect(new Set(first.shuffledCaseIds)).toHaveLength(24);
    for (const caseId of first.shuffledCaseIds) {
      expect(first.schedule.filter((item) => item.caseId === caseId).map((item) => item.group))
        .toHaveLength(4);
      expect(new Set(first.schedule.filter((item) => item.caseId === caseId).map((item) => item.group)))
        .toEqual(new Set(["A", "B", "C", "D"]));
    }
    expect(GI088_RUNTIME_CONTRACT_FINAL_CASE_IDS).toEqual([
      "GI088-V8R3-D01", "GI088-V8R3-D05", "GI088-V8R3-D08", "GI088-V8R3-D10",
      "GI088-V8R3-D12", "GI088-V8R3-D15", "GI088-V8R3-D20", "GI088-V8R3-D23"
    ]);
  });

  it("四组严格保持统一调用边界并只改变目标运行因素", () => {
    const definitions = Object.fromEntries(
      (["A", "B", "C", "D", "E"] as const).map((group) => [
        group,
        createGi088RuntimeContractGroupDefinition(group)
      ])
    );
    expect(definitions.B.identity).toEqual({
      ...definitions.A.identity,
      outputContractVersion: "2026-08-12.gi088-simplified-diagnostic-output-v1"
    });
    expect(definitions.C.identity).toEqual({
      ...definitions.A.identity,
      thinking: "disabled",
      reasoningEffort: null
    });
    expect(definitions.D.identity.provider).toBe("deepseek_official");
    expect(definitions.D.identity.baseUrlHost).toBe("api.deepseek.com");
    expect(definitions.D.identity.model).toBe("deepseek-v4-flash");
    expect(definitions.E.identity.model).toBe("deepseek-v4-pro");
    expect(definitions.B.promptSha256).not.toBe(definitions.A.promptSha256);
    expect(definitions.C.promptSha256).toBe(definitions.A.promptSha256);
    expect(definitions.D.promptSha256).toBe(definitions.A.promptSha256);
    for (const group of ["A", "B", "C", "D", "E"] as const) {
      const params = createGi088RuntimeContractCompletionParams({
        group,
        evaluationCase: CASES[0]!
      });
      expect(params).toMatchObject({
        useProviderDefaultMaxTokens: true,
        responseFormat: "json_object",
        headersTimeoutMs: 60_000,
        bodyIdleTimeoutMs: 60_000,
        hardTimeoutMs: 60_000
      });
      expect(params.maxTokens).toBeUndefined();
    }
  });

  it("Provider 身份和 120 次预算授权在创建调用链前严格拒绝错误配置", () => {
    const valid = {
      NODE_ENV: "test",
      VOLCENGINE_ARK_API_KEY: "ark-test-key",
      VOLCENGINE_ARK_BASE_URL: "https://ark.cn-beijing.volces.com/api/v3",
      VOLCENGINE_ARK_MODEL: "deepseek-v4-flash-ga-260731",
      DEEPSEEK_API_KEY: "deepseek-test-key",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com"
    } as NodeJS.ProcessEnv;
    expect(validateGi088RuntimeContractDiagnosticEnvironment(valid)).toMatchObject({
      official: {
        baseUrl: "https://api.deepseek.com",
        baseUrlHost: "api.deepseek.com",
        endpoint: "/chat/completions"
      }
    });
    expect(() => validateGi088RuntimeContractDiagnosticEnvironment({
      ...valid,
      DEEPSEEK_BASE_URL: "https://example.com"
    })).toThrow("GI088_RUNTIME_CONTRACT_DEEPSEEK_IDENTITY_MISMATCH");
    expect(() => validateGi088RuntimeContractDiagnosticEnvironment({
      ...valid,
      NODE_ENV: "production"
    })).toThrow("GI088_RUNTIME_CONTRACT_DIAGNOSTIC_PRODUCTION_FORBIDDEN");
    expect(() => assertGi088RuntimeContractDiagnosticAuthorization({
      NODE_ENV: "test",
      GI088_ROOT_CAUSE_DIAGNOSTIC_MODEL_CALLS: "I_UNDERSTAND_MODEL_CALLS",
      GI088_ROOT_CAUSE_DIAGNOSTIC_CALL_BUDGET: "119"
    })).toThrow("GI088_RUNTIME_CONTRACT_DIAGNOSTIC_AUTHORIZATION_REQUIRED");
    expect(() => assertGi088RuntimeContractDiagnosticAuthorization({
      NODE_ENV: "test",
      GI088_ROOT_CAUSE_DIAGNOSTIC_MODEL_CALLS: "I_UNDERSTAND_MODEL_CALLS",
      GI088_ROOT_CAUSE_DIAGNOSTIC_CALL_BUDGET: "120"
    })).not.toThrow();
  });

  it("任一主组达到 20/24 后保持 96 次总量且不触发 Pro", async () => {
    const createE = vi.fn(() => provider("full"));
    const report = await executeGi088RuntimeContractDiagnostic({
      cases: CASES,
      providers: {
        A: provider("full"),
        B: provider("empty"),
        C: provider("empty"),
        D: provider("empty"),
        createE
      },
      globalFingerprintBundleBefore: FINGERPRINTS,
      readGlobalFingerprintBundleAfter: () => FINGERPRINTS,
      now: () => new Date("2026-08-12T12:00:00.000Z")
    });
    expect(report.budget.totalCalls).toBe(GI088_RUNTIME_CONTRACT_DIAGNOSTIC_INITIAL_CALLS);
    expect(report.records).toHaveLength(96);
    expect(report.decision.conditionalProTriggered).toBe(false);
    expect(report.decision.shortlistedGroups).toContain("A");
    expect(createE).not.toHaveBeenCalled();
    expect(report.budget).toMatchObject({ retries: 0, recoveries: 0, judgeCalls: 0 });
  });

  it("四个主组均未入围时才追加 24 次 Pro 且总量严格为 120", async () => {
    const eSeen: AICompletionParams[] = [];
    const createE = vi.fn(() => provider("full", eSeen));
    const report = await executeGi088RuntimeContractDiagnostic({
      cases: CASES,
      providers: {
        A: provider("empty"),
        B: provider("empty"),
        C: provider("empty"),
        D: provider("empty"),
        createE
      },
      globalFingerprintBundleBefore: FINGERPRINTS,
      readGlobalFingerprintBundleAfter: () => FINGERPRINTS,
      now: () => new Date("2026-08-12T12:00:00.000Z")
    });
    expect(report.decision.conditionalProTriggered).toBe(true);
    expect(report.records).toHaveLength(GI088_RUNTIME_CONTRACT_DIAGNOSTIC_TOTAL_CALLS_MAXIMUM);
    expect(report.budget.totalCalls).toBe(120);
    expect(createE).toHaveBeenCalledTimes(1);
    expect(eSeen).toHaveLength(24);
    expect(report.groups.find((item) => item.group === "E")?.callCount).toBe(24);
  });

  it("报告原子写入为 0600、禁止覆盖并从公开摘要移除逐条可见结果", async () => {
    const report = await executeGi088RuntimeContractDiagnostic({
      cases: CASES,
      providers: {
        A: provider("full"),
        B: provider("simplified"),
        C: provider("empty"),
        D: provider("empty"),
        createE: () => provider("full")
      },
      globalFingerprintBundleBefore: FINGERPRINTS,
      readGlobalFingerprintBundleAfter: () => FINGERPRINTS,
      now: () => new Date("2026-08-12T12:00:00.000Z")
    });
    const root = await mkdtemp(resolve(tmpdir(), "gi088-root-cause-"));
    const privatePath = resolve(root, "private.json");
    const publicPath = resolve(root, "public.json");
    await writeGi088RuntimeContractDiagnosticArtifacts({
      report,
      privateReportPath: privatePath,
      publicSummaryPath: publicPath
    });
    expect((await stat(privatePath)).mode & 0o077).toBe(0);
    expect((await stat(publicPath)).mode & 0o077).toBe(0);
    await expect(readGi088RuntimeContractDiagnosticReport(privatePath))
      .resolves.toMatchObject({ reportFingerprint: report.reportFingerprint });
    const publicSource = await readFile(publicPath, "utf8");
    expect(publicSource).not.toContain("candidateVisibleOutput");
    expect(publicSource).not.toContain("private-upstream-request-id");
    expect(publicSource).not.toContain("你愿意补充一个最能帮助");
    expect(createGi088RuntimeContractPublicSummary(report)).not.toHaveProperty("records");
    await expect(writeGi088RuntimeContractDiagnosticArtifacts({
      report,
      privateReportPath: privatePath,
      publicSummaryPath: publicPath
    })).rejects.toMatchObject({ code: "EEXIST" });
  });
});
