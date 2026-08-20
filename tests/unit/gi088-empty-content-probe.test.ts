import { describe, expect, it, vi } from "vitest";

import manifest from "../../artifacts/generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-empty-content-response-format-probe-v1-manifest.json";
import { createBoard7bWorkingTaskV1InitialSemanticState } from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  assertGi088EmptyContentProbeExecutionAuthorization,
  assertGi088EmptyContentProbeLedgerCanResume,
  assertGi088EmptyContentProbeRuntime,
  createGi088EmptyContentProbePublicPlan,
  isGi088EmptyContentProbeDirectRun,
  isGi088EmptyContentProbeExecutionRequested,
  parseGi088EmptyContentProbeLedger,
  type ProbeLedger
} from "../../scripts/run-gi088-empty-content-probe";
import {
  GI088_EMPTY_CONTENT_PROBE_CALL_BUDGET,
  GI088_EMPTY_CONTENT_PROBE_CASES,
  GI088_EMPTY_CONTENT_PROBE_RUNTIME,
  GI088_EMPTY_CONTENT_PROBE_VERSION,
  GI088_EMPTY_CONTENT_SOURCE_CANDIDATE_FINGERPRINT,
  GI088_EMPTY_CONTENT_SOURCE_EVALUATION_VERSION,
  GI088_EMPTY_CONTENT_SOURCE_EXECUTION_FINGERPRINT,
  GI088_EMPTY_CONTENT_SOURCE_SNAPSHOT_SHA256,
  createGi088EmptyContentProbeCompletionParams,
  createGi088EmptyContentProbePublicSummary,
  createGi088EmptyContentProbeRequestHash,
  runGi088EmptyContentProbeCall,
  type Gi088EmptyContentProbeCase,
  type Gi088EmptyContentProbePlan,
  type Gi088EmptyContentProbeResult
} from "../../src/server/services/evaluation/gi088/empty-content-probe";
import {
  AIProviderError,
  type AIProvider
} from "../../src/server/services/ai/ai-provider";

function probeCase(): Gi088EmptyContentProbeCase {
  return {
    caseId: "TEST",
    contextClass: "synthetic",
    taskId: "A1",
    branch: "high",
    turnId: "turn-test",
    sourceCallId: "call-test",
    sourceRequestHash: "source-hash",
    turnInput: {
      mode: "accompany_chat",
      conversation: [
        { id: "A0", role: "assistant", content: "此刻你想聊点什么？" },
        { id: "U1", role: "user", content: "SENSITIVE_SENTINEL_42" }
      ],
      latestUserMessageId: "U1",
      semanticState: createBoard7bWorkingTaskV1InitialSemanticState()
    }
  };
}

function probePlan(): Gi088EmptyContentProbePlan {
  const turnInput = probeCase().turnInput;
  return {
    probeVersion: GI088_EMPTY_CONTENT_PROBE_VERSION,
    probeFingerprint: "probe-fingerprint",
    sourceSnapshotSha256: GI088_EMPTY_CONTENT_SOURCE_SNAPSHOT_SHA256,
    sourceEvaluationVersion: GI088_EMPTY_CONTENT_SOURCE_EVALUATION_VERSION,
    sourceCandidateFingerprint: GI088_EMPTY_CONTENT_SOURCE_CANDIDATE_FINGERPRINT,
    sourceExecutionFingerprint: GI088_EMPTY_CONTENT_SOURCE_EXECUTION_FINGERPRINT,
    effectiveCandidateFingerprint:
      GI088_EMPTY_CONTENT_SOURCE_CANDIDATE_FINGERPRINT,
    runtime: GI088_EMPTY_CONTENT_PROBE_RUNTIME,
    authorizedCallBudget: GI088_EMPTY_CONTENT_PROBE_CALL_BUDGET,
    automaticRetries: 0,
    variants: ["json_object", "text_json"],
    cases: GI088_EMPTY_CONTENT_PROBE_CASES.map((item) => ({
      caseId: item.caseId,
      contextClass: item.contextClass,
      taskId: item.taskId,
      branch: item.branch,
      turnId: item.turnId,
      sourceCallId: item.sourceCallId,
      sourceRequestHash: item.sourceRequestHash,
      turnInput
    }))
  };
}

function completedResult(
  plan: Gi088EmptyContentProbePlan,
  caseIndex = 0,
  variantIndex = 0
): Gi088EmptyContentProbeResult {
  const probeCase = plan.cases[caseIndex]!;
  const variant = plan.variants[variantIndex]!;
  return {
    caseId: probeCase.caseId,
    variant,
    sourceCallId: probeCase.sourceCallId,
    sourceRequestHash: probeCase.sourceRequestHash,
    probeRequestHash: createGi088EmptyContentProbeRequestHash(
      probeCase,
      variant
    ),
    requestHashVerified: true,
    status: "technical_failure",
    errorCode: "EMPTY_CONTENT",
    responseHash: null,
    rawFinalOutput: null,
    validationIssues: [],
    latencyMs: 10,
    tokenUsage: null,
    providerDiagnostics: null
  };
}

function ledger(
  plan: Gi088EmptyContentProbePlan,
  calls: ProbeLedger["calls"]
): ProbeLedger {
  return {
    schemaVersion: "1.0",
    probeVersion: GI088_EMPTY_CONTENT_PROBE_VERSION,
    probeFingerprint: plan.probeFingerprint,
    authorizationId: "00000000-0000-4000-8000-000000000001",
    authorizedCallBudget: GI088_EMPTY_CONTENT_PROBE_CALL_BUDGET,
    sourcePath: "/repo/artifacts/local-runtime/source.json",
    sourceSnapshotSha256: GI088_EMPTY_CONTENT_SOURCE_SNAPSHOT_SHA256,
    createdAt: "2026-08-09T00:00:00.000Z",
    completedAt: null,
    calls
  };
}

describe("GI-088 empty-content response-format probe", () => {
  it("冻结三个代表请求与六次零重试预算", () => {
    expect(GI088_EMPTY_CONTENT_PROBE_CASES.map((item) => item.caseId)).toEqual([
      "E1",
      "E2",
      "E3"
    ]);
    expect(GI088_EMPTY_CONTENT_PROBE_CALL_BUDGET).toBe(6);
    expect(new Set(GI088_EMPTY_CONTENT_PROBE_CASES.map((item) => item.sourceRequestHash)).size).toBe(3);
    expect(manifest.source).toEqual({
      evaluationVersion: GI088_EMPTY_CONTENT_SOURCE_EVALUATION_VERSION,
      snapshotSha256: GI088_EMPTY_CONTENT_SOURCE_SNAPSHOT_SHA256,
      candidateFingerprint: GI088_EMPTY_CONTENT_SOURCE_CANDIDATE_FINGERPRINT,
      executionFingerprint: GI088_EMPTY_CONTENT_SOURCE_EXECUTION_FINGERPRINT
    });
    expect(manifest.budget).toMatchObject({
      baseCalls: 6,
      technicalRetries: 0,
      qualityRetries: 0,
      fallbackCalls: 0,
      maximumCalls: 6
    });
  });

  it("默认保持零调用并要求完整的独立执行授权", () => {
    expect(
      isGi088EmptyContentProbeDirectRun({})
    ).toBe(true);
    expect(isGi088EmptyContentProbeDirectRun({ VITEST: "true" })).toBe(false);
    expect(
      isGi088EmptyContentProbeExecutionRequested(["node", "probe.ts"])
    ).toBe(false);
    expect(
      isGi088EmptyContentProbeExecutionRequested([
        "node",
        "probe.ts",
        "--execute"
      ])
    ).toBe(true);
    expect(() =>
      assertGi088EmptyContentProbeExecutionAuthorization("probe-fingerprint", {})
    ).toThrow("GI088_EMPTY_PROBE_SCOPE_NOT_AUTHORIZED");
    expect(
      assertGi088EmptyContentProbeExecutionAuthorization("probe-fingerprint", {
        GI088_MODEL_CALL_SCOPE: "empty_content_probe",
        GI088_AUTHORIZED_EMPTY_CONTENT_PROBE_FINGERPRINT: "probe-fingerprint",
        GI088_EMPTY_CONTENT_PROBE_CONFIRMATION: "I_UNDERSTAND_6_CALLS",
        GI088_EMPTY_CONTENT_PROBE_AUTHORIZED_BUDGET: "6",
        GI088_EMPTY_CONTENT_PROBE_AUTHORIZATION_ID:
          "00000000-0000-4000-8000-000000000001"
      })
    ).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("冻结 Provider、模型与主机，并把运行事实写入公开零调用计划", () => {
    expect(GI088_EMPTY_CONTENT_PROBE_RUNTIME).toEqual({
      provider: "openai",
      model: "deepseek-v4-flash",
      baseUrlHost: "api.deepseek.com"
    });
    expect(manifest.runtime).toEqual(GI088_EMPTY_CONTENT_PROBE_RUNTIME);
    expect(() =>
      assertGi088EmptyContentProbeRuntime(GI088_EMPTY_CONTENT_PROBE_RUNTIME)
    ).not.toThrow();
    expect(() =>
      assertGi088EmptyContentProbeRuntime({
        provider: "openai",
        model: "deepseek-v4-flash",
        baseUrlHost: "example.com"
      } as never)
    ).toThrow("GI088_EMPTY_PROBE_RUNTIME_MISMATCH");
    const publicPlan = createGi088EmptyContentProbePublicPlan(probePlan());
    expect(publicPlan).toMatchObject({
      runtime: GI088_EMPTY_CONTENT_PROBE_RUNTIME,
      modelGenerationCalls: 0,
      executionAuthorized: false
    });
    expect(JSON.stringify(publicPlan)).not.toContain("SENSITIVE_SENTINEL_42");
  });

  it("配对请求只改变 response_format", () => {
    const withJsonMode = createGi088EmptyContentProbeCompletionParams(
      probeCase(),
      "json_object"
    );
    const withTextJson = createGi088EmptyContentProbeCompletionParams(
      probeCase(),
      "text_json"
    );
    expect(withJsonMode.responseFormat).toBe("json_object");
    expect(withTextJson.responseFormat).toBeUndefined();
    expect({ ...withJsonMode, responseFormat: undefined }).toEqual(withTextJson);
    expect(withJsonMode.thinking).toBe("enabled");
    expect(withJsonMode.reasoningEffort).toBe("high");
    expect(withJsonMode.useProviderDefaultMaxTokens).toBe(true);
  });

  it("技术失败只保存安全诊断并保留零重试语义", async () => {
    const complete = vi.fn(async () => {
      throw new AIProviderError("Model returned empty content.", "EMPTY_CONTENT", undefined, {
        finishReason: "stop",
        reasoningPresent: true,
        reasoningLength: 30,
        reasoningTokens: 12,
        latencyMs: 10,
        tokenUsage: { completionTokens: 12 },
        contentType: "null",
        contentLength: 0,
        reasoningType: "string",
        totalLatencyMs: 10
      });
    });
    const provider: AIProvider = { name: "fake", complete };
    const result = await runGi088EmptyContentProbeCall({
      provider,
      probeCase: probeCase(),
      variant: "json_object"
    });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: "technical_failure",
      errorCode: "EMPTY_CONTENT",
      rawFinalOutput: null,
      providerDiagnostics: {
        finishReason: "stop",
        contentType: "null",
        contentLength: 0
      }
    });
  });

  it("先落预留账本；崩溃后阻止重跑同一次调用", () => {
    const plan = probePlan();
    const reserved = ledger(plan, [
      {
        key: "E1:json_object",
        caseId: "E1",
        variant: "json_object",
        status: "reserved",
        reservedAt: "2026-08-09T00:01:00.000Z",
        completedAt: null,
        result: null
      }
    ]);
    const parsed = parseGi088EmptyContentProbeLedger({
      value: reserved,
      plan,
      authorizationId: reserved.authorizationId,
      sourcePath: reserved.sourcePath
    });
    expect(() =>
      assertGi088EmptyContentProbeLedgerCanResume(parsed)
    ).toThrow("GI088_EMPTY_PROBE_CALL_OUTCOME_AMBIGUOUS");

    const completed = ledger(plan, [
      {
        ...reserved.calls[0]!,
        status: "completed",
        completedAt: "2026-08-09T00:01:10.000Z",
        result: completedResult(plan)
      }
    ]);
    expect(() =>
      assertGi088EmptyContentProbeLedgerCanResume(
        parseGi088EmptyContentProbeLedger({
          value: completed,
          plan,
          authorizationId: completed.authorizationId,
          sourcePath: completed.sourcePath
        })
      )
    ).not.toThrow();
  });

  it("拒绝越界、乱序或被替换的账本血缘", () => {
    const plan = probePlan();
    const repeated = {
      key: "E1:json_object",
      caseId: "E1",
      variant: "json_object" as const,
      status: "reserved" as const,
      reservedAt: "2026-08-09T00:01:00.000Z",
      completedAt: null,
      result: null
    };
    const duplicated = ledger(plan, [repeated, repeated]);
    expect(() =>
      parseGi088EmptyContentProbeLedger({
        value: duplicated,
        plan,
        authorizationId: duplicated.authorizationId,
        sourcePath: duplicated.sourcePath
      })
    ).toThrow("GI088_EMPTY_PROBE_LEDGER_SCHEDULE_MISMATCH");

    const overBudget = ledger(plan, Array.from({ length: 7 }, () => repeated));
    expect(() =>
      parseGi088EmptyContentProbeLedger({
        value: overBudget,
        plan,
        authorizationId: overBudget.authorizationId,
        sourcePath: overBudget.sourcePath
      })
    ).toThrow("GI088_EMPTY_PROBE_LEDGER_BUDGET_MISMATCH");

    const wrongResult = completedResult(plan);
    wrongResult.sourceRequestHash = "replaced-request-hash";
    const replaced = ledger(plan, [
      {
        ...repeated,
        status: "completed",
        completedAt: "2026-08-09T00:01:10.000Z",
        result: wrongResult
      }
    ]);
    expect(() =>
      parseGi088EmptyContentProbeLedger({
        value: replaced,
        plan,
        authorizationId: replaced.authorizationId,
        sourcePath: replaced.sourcePath
      })
    ).toThrow("GI088_EMPTY_PROBE_LEDGER_RESULT_LINEAGE_MISMATCH");
  });

  it("脱敏汇总排除原文、Prompt 与 raw output", async () => {
    const provider: AIProvider = {
      name: "fake",
      complete: async () => ({
        content: "SENSITIVE_SENTINEL_42 invalid-json",
        latencyMs: 5,
        provider: "fake",
        diagnostics: null
      })
    };
    const result = await runGi088EmptyContentProbeCall({
      provider,
      probeCase: probeCase(),
      variant: "text_json"
    });
    expect(result.status).toBe("protected_failure");
    expect(result.rawFinalOutput).toContain("SENSITIVE_SENTINEL_42");
    const serialized = JSON.stringify(
      createGi088EmptyContentProbePublicSummary(result)
    );
    expect(serialized).not.toContain("SENSITIVE_SENTINEL_42");
    expect(serialized).not.toContain("conversation");
    expect(serialized).not.toContain("rawFinalOutput");
  });

  it("公开摘要清除校验引用、错误文本和隐藏 reasoning 正文", () => {
    const result = completedResult(probePlan());
    result.errorCode = "ERROR:SENSITIVE_SENTINEL_42";
    result.validationIssues = [
      "OUTPUT_EVIDENCE_REF_NOT_USER_MESSAGE:SENSITIVE_SENTINEL_42"
    ];
    result.providerDiagnostics = {
      finishReason: "stop",
      reasoningPresent: true,
      reasoningLength: 999,
      reasoningTokens: null,
      latencyMs: null,
      tokenUsage: null,
      reasoningType: "string"
    };
    const summary = createGi088EmptyContentProbePublicSummary(result);
    expect(summary.errorCode).toBe("PROVIDER_ERROR");
    expect(summary.validationIssues).toEqual([
      "OUTPUT_EVIDENCE_REF_NOT_USER_MESSAGE"
    ]);
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain("SENSITIVE_SENTINEL_42");
    expect(serialized).not.toContain("rawFinalOutput");
    expect(serialized).not.toContain("reasoningContent");
  });
});
