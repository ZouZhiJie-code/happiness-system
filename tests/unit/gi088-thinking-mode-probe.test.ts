import { createHash, randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import manifest from "../../artifacts/generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-empty-content-thinking-mode-probe-v1-manifest.json";
import { createBoard7bWorkingTaskV1InitialSemanticState } from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  acquireGi088ThinkingModeProbeLock,
  assertGi088ThinkingModeProbeExecutionAuthorization,
  assertGi088ThinkingModeProbeLedgerCanResume,
  createGi088ThinkingModeProbePublicPlan,
  isGi088ThinkingModeProbeExecutionRequested,
  parseGi088ThinkingModeProbeLedger,
  releaseGi088ThinkingModeProbeLock,
  type Gi088ThinkingModeProbeLedger
} from "../../scripts/run-gi088-thinking-mode-probe";
import { OpenAIProvider } from "../../src/server/services/ai/openai.provider";
import {
  GI088_THINKING_MODE_PROBE_ADAPTER_CONTRACT_VERSION,
  GI088_THINKING_MODE_PROBE_CALL_BUDGET,
  GI088_THINKING_MODE_PROBE_DECISION_RULE,
  GI088_THINKING_MODE_PROBE_DECISION_RULE_VERSION,
  GI088_THINKING_MODE_PROBE_LEDGER_SCHEMA_VERSION,
  GI088_THINKING_MODE_PROBE_PUBLIC_SUMMARY_CONTRACT,
  GI088_THINKING_MODE_PROBE_RUNTIME,
  GI088_THINKING_MODE_PROBE_SCHEDULE,
  GI088_THINKING_MODE_PROBE_VERSION,
  GI088_THINKING_MODE_SOURCE_PROBE_FINGERPRINT,
  createGi088ThinkingModeProbeCompletionParams,
  createGi088ThinkingModeProbePublicRequest,
  createGi088ThinkingModeProbePublicSummary,
  createGi088ThinkingModeProbeRequestHash,
  runGi088ThinkingModeProbeCall,
  type Gi088ThinkingModeProbeCase,
  type Gi088ThinkingModeProbePlan,
  type Gi088ThinkingModeProbeResult,
  type Gi088ThinkingModeProbeVariant
} from "../../src/server/services/evaluation/gi088/thinking-mode-probe";
import {
  GI088_EMPTY_CONTENT_SOURCE_CANDIDATE_FINGERPRINT,
  GI088_EMPTY_CONTENT_SOURCE_EVALUATION_VERSION,
  GI088_EMPTY_CONTENT_SOURCE_EXECUTION_FINGERPRINT,
  GI088_EMPTY_CONTENT_SOURCE_SNAPSHOT_SHA256
} from "../../src/server/services/evaluation/gi088/empty-content-probe";
import { AIProviderError, type AIProvider } from "../../src/server/services/ai/ai-provider";

const AUTHORIZATION_ID = "00000000-0000-4000-8000-000000000001";
const SOURCE_PATH = "/repo/artifacts/local-runtime/source.json";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function probeCase(caseId = "E1"): Gi088ThinkingModeProbeCase {
  return {
    caseId,
    contextClass: caseId === "E1" ? "cold_start" : "long_context",
    taskId: caseId === "E1" ? "A3" : "A1",
    branch: "high",
    turnId: `turn-${caseId}`,
    sourceCallId: `call-${caseId}`,
    sourceRequestHash: `source-${caseId}`,
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

function probePlan(): Gi088ThinkingModeProbePlan {
  return {
    probeVersion: GI088_THINKING_MODE_PROBE_VERSION,
    probeFingerprint: "thinking-probe-fingerprint",
    sourceProbeVersion:
      "2026-08-09.gi088-empty-content-response-format-probe-v1",
    sourceProbeFingerprint: GI088_THINKING_MODE_SOURCE_PROBE_FINGERPRINT,
    sourceSnapshotSha256: GI088_EMPTY_CONTENT_SOURCE_SNAPSHOT_SHA256,
    sourceEvaluationVersion: GI088_EMPTY_CONTENT_SOURCE_EVALUATION_VERSION,
    sourceCandidateFingerprint: GI088_EMPTY_CONTENT_SOURCE_CANDIDATE_FINGERPRINT,
    sourceExecutionFingerprint: GI088_EMPTY_CONTENT_SOURCE_EXECUTION_FINGERPRINT,
    effectiveCandidateFingerprint:
      GI088_EMPTY_CONTENT_SOURCE_CANDIDATE_FINGERPRINT,
    runtime: GI088_THINKING_MODE_PROBE_RUNTIME,
    authorizedCallBudget: GI088_THINKING_MODE_PROBE_CALL_BUDGET,
    automaticRetries: 0,
    fallbackCalls: 0,
    variants: ["high", "disabled"],
    cases: [probeCase("E1"), probeCase("E3")],
    schedule: GI088_THINKING_MODE_PROBE_SCHEDULE.map((item) => ({ ...item })),
    decisionRule: GI088_THINKING_MODE_PROBE_DECISION_RULE,
    decisionRuleVersion: GI088_THINKING_MODE_PROBE_DECISION_RULE_VERSION,
    adapterContractVersion: GI088_THINKING_MODE_PROBE_ADAPTER_CONTRACT_VERSION,
    ledgerSchemaVersion: GI088_THINKING_MODE_PROBE_LEDGER_SCHEMA_VERSION,
    publicSummaryContract: GI088_THINKING_MODE_PROBE_PUBLIC_SUMMARY_CONTRACT
  };
}

function result(
  plan: Gi088ThinkingModeProbePlan,
  caseId: "E1" | "E3",
  variant: Gi088ThinkingModeProbeVariant
): Gi088ThinkingModeProbeResult {
  const currentCase = plan.cases.find((item) => item.caseId === caseId)!;
  return {
    caseId,
    variant,
    sourceCallId: currentCase.sourceCallId,
    sourceRequestHash: currentCase.sourceRequestHash,
    probeRequestHash: createGi088ThinkingModeProbeRequestHash(
      currentCase,
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
  plan: Gi088ThinkingModeProbePlan,
  calls: Gi088ThinkingModeProbeLedger["calls"]
): Gi088ThinkingModeProbeLedger {
  return {
    schemaVersion: GI088_THINKING_MODE_PROBE_LEDGER_SCHEMA_VERSION,
    probeVersion: GI088_THINKING_MODE_PROBE_VERSION,
    probeFingerprint: plan.probeFingerprint,
    authorizationId: AUTHORIZATION_ID,
    authorizedCallBudget: GI088_THINKING_MODE_PROBE_CALL_BUDGET,
    sourcePath: SOURCE_PATH,
    sourceSnapshotSha256: GI088_EMPTY_CONTENT_SOURCE_SNAPSHOT_SHA256,
    createdAt: "2026-08-09T00:00:00.000Z",
    completedAt: null,
    calls
  };
}

describe("GI-088 Thinking mode causal probe", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("与冻结 manifest 对齐四次交错顺序、预算和裁决边界", () => {
    expect(GI088_THINKING_MODE_PROBE_VERSION).toBe(manifest.probeVersion);
    expect(GI088_THINKING_MODE_PROBE_CALL_BUDGET).toBe(4);
    expect(GI088_THINKING_MODE_PROBE_SCHEDULE).toEqual(manifest.callPlan);
    expect(GI088_THINKING_MODE_PROBE_DECISION_RULE).toEqual(
      manifest.decisionRule
    );
    expect(manifest.budget).toMatchObject({
      baseCalls: 4,
      technicalRetries: 0,
      qualityRetries: 0,
      fallbackCalls: 0,
      maximumCalls: 4
    });
    expect(manifest.priorProbe.fingerprint).toBe(
      GI088_THINKING_MODE_SOURCE_PROBE_FINGERPRINT
    );
  });

  it("两臂固定 JSON、默认 token、30 秒并在参数层省略 temperature", () => {
    const high = createGi088ThinkingModeProbeCompletionParams(
      probeCase(),
      "high"
    );
    const disabled = createGi088ThinkingModeProbeCompletionParams(
      probeCase(),
      "disabled"
    );
    expect(high).toMatchObject({
      responseFormat: "json_object",
      useProviderDefaultTemperature: true,
      useProviderDefaultMaxTokens: true,
      timeoutMs: 30_000,
      thinking: "enabled",
      reasoningEffort: "high"
    });
    expect(disabled).toMatchObject({
      responseFormat: "json_object",
      useProviderDefaultTemperature: true,
      useProviderDefaultMaxTokens: true,
      timeoutMs: 30_000,
      thinking: "disabled"
    });
    expect(high).not.toHaveProperty("temperature");
    expect(disabled).not.toHaveProperty("temperature");
    expect(disabled).not.toHaveProperty("reasoningEffort");
    const normalizedHigh = {
      ...high,
      thinking: "disabled" as const,
      reasoningEffort: undefined
    };
    expect(normalizedHigh).toEqual({ ...disabled, reasoningEffort: undefined });
  });

  it("实际 HTTP body 只改变 Thinking mode 字段并省略 temperature", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "{}" } }] }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIProvider({
      apiKey: "sk-deepseek",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com"
    });
    const currentCase = probeCase();
    await provider.complete(
      createGi088ThinkingModeProbeCompletionParams(currentCase, "high")
    );
    await provider.complete(
      createGi088ThinkingModeProbeCompletionParams(currentCase, "disabled")
    );
    const highBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const disabledBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    for (const body of [highBody, disabledBody]) {
      expect(body).not.toHaveProperty("temperature");
      expect(body).not.toHaveProperty("max_tokens");
      expect(body.response_format).toEqual({ type: "json_object" });
    }
    expect(highBody.thinking).toEqual({ type: "enabled" });
    expect(highBody.reasoning_effort).toBe("high");
    expect(disabledBody.thinking).toEqual({ type: "disabled" });
    expect(disabledBody).not.toHaveProperty("reasoning_effort");
    const normalizedHigh = {
      ...highBody,
      thinking: { type: "disabled" },
      reasoning_effort: undefined
    };
    expect(normalizedHigh).toEqual({
      ...disabledBody,
      reasoning_effort: undefined
    });
  });

  it("公开请求只保存完整标准化配置和 Prompt hash", () => {
    const publicRequest = createGi088ThinkingModeProbePublicRequest(
      probeCase(),
      "disabled"
    );
    const serialized = JSON.stringify(publicRequest);
    expect(publicRequest).toMatchObject({
      temperature: null,
      useProviderDefaultTemperature: true,
      maxTokens: null,
      useProviderDefaultMaxTokens: true,
      responseFormat: "json_object",
      thinking: "disabled",
      reasoningEffort: null,
      adapterContractVersion:
        GI088_THINKING_MODE_PROBE_ADAPTER_CONTRACT_VERSION
    });
    expect(serialized).not.toContain("SENSITIVE_SENTINEL_42");
    expect(serialized).not.toContain("messages\":");
  });

  it("默认零调用并要求精确四次独立授权", () => {
    expect(isGi088ThinkingModeProbeExecutionRequested(["node", "probe.ts"])).toBe(
      false
    );
    expect(
      isGi088ThinkingModeProbeExecutionRequested([
        "node",
        "probe.ts",
        "--execute"
      ])
    ).toBe(true);
    expect(() =>
      assertGi088ThinkingModeProbeExecutionAuthorization(
        "thinking-probe-fingerprint",
        {}
      )
    ).toThrow("GI088_THINKING_PROBE_SCOPE_NOT_AUTHORIZED");
    expect(
      assertGi088ThinkingModeProbeExecutionAuthorization(
        "thinking-probe-fingerprint",
        {
          GI088_MODEL_CALL_SCOPE: "empty_content_thinking_mode_probe",
          GI088_AUTHORIZED_THINKING_MODE_PROBE_FINGERPRINT:
            "thinking-probe-fingerprint",
          GI088_THINKING_MODE_PROBE_CONFIRMATION: "I_UNDERSTAND_4_CALLS",
          GI088_THINKING_MODE_PROBE_AUTHORIZED_BUDGET: "4",
          GI088_THINKING_MODE_PROBE_AUTHORIZATION_ID: AUTHORIZATION_ID
        }
      )
    ).toBe(AUTHORIZATION_ID);
    expect(createGi088ThinkingModeProbePublicPlan(probePlan())).toMatchObject({
      modelGenerationCalls: 0,
      executionAuthorized: false,
      automaticRetries: 0,
      fallbackCalls: 0
    });
  });

  it("每个调用只触发一次 Provider，不执行重试或 fallback", async () => {
    const complete = vi.fn(async () => {
      throw new AIProviderError(
        "Model returned empty content.",
        "EMPTY_CONTENT"
      );
    });
    const provider: AIProvider = { name: "fake", complete };
    const output = await runGi088ThinkingModeProbeCall({
      provider,
      probeCase: probeCase(),
      variant: "high"
    });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(output).toMatchObject({
      status: "technical_failure",
      errorCode: "EMPTY_CONTENT"
    });
  });

  it("账本固定交错顺序并在 reserved 状态阻止重复调用", () => {
    const plan = probePlan();
    const reserved = ledger(plan, [
      {
        key: "1:E1:high",
        order: 1,
        caseId: "E1",
        variant: "high",
        status: "reserved",
        reservedAt: "2026-08-09T00:01:00.000Z",
        completedAt: null,
        result: null
      }
    ]);
    const parsed = parseGi088ThinkingModeProbeLedger({
      value: reserved,
      plan,
      authorizationId: AUTHORIZATION_ID,
      sourcePath: SOURCE_PATH
    });
    expect(() => assertGi088ThinkingModeProbeLedgerCanResume(parsed)).toThrow(
      "GI088_THINKING_PROBE_CALL_OUTCOME_AMBIGUOUS"
    );
    const wrongOrder = ledger(plan, [
      {
        ...reserved.calls[0]!,
        key: "1:E1:disabled",
        variant: "disabled"
      }
    ]);
    expect(() =>
      parseGi088ThinkingModeProbeLedger({
        value: wrongOrder,
        plan,
        authorizationId: AUTHORIZATION_ID,
        sourcePath: SOURCE_PATH
      })
    ).toThrow("GI088_THINKING_PROBE_LEDGER_SCHEDULE_MISMATCH");
  });

  it("账本完成结果绑定精确请求哈希", () => {
    const plan = probePlan();
    const completed = ledger(plan, [
      {
        key: "1:E1:high",
        order: 1,
        caseId: "E1",
        variant: "high",
        status: "completed",
        reservedAt: "2026-08-09T00:01:00.000Z",
        completedAt: "2026-08-09T00:01:10.000Z",
        result: result(plan, "E1", "high")
      }
    ]);
    expect(() =>
      parseGi088ThinkingModeProbeLedger({
        value: completed,
        plan,
        authorizationId: AUTHORIZATION_ID,
        sourcePath: SOURCE_PATH
      })
    ).not.toThrow();
    completed.calls[0]!.result!.probeRequestHash = "replaced";
    expect(() =>
      parseGi088ThinkingModeProbeLedger({
        value: completed,
        plan,
        authorizationId: AUTHORIZATION_ID,
        sourcePath: SOURCE_PATH
      })
    ).toThrow("GI088_THINKING_PROBE_LEDGER_RESULT_LINEAGE_MISMATCH");
  });

  it("原子排他锁阻止并发，同一锁可在正常释放后重新获取", async () => {
    const testRoot = path.join(
      process.cwd(),
      "artifacts/local-runtime",
      `gi088-thinking-probe-lock-test-${randomUUID()}`
    );
    const lockPath = path.join(testRoot, "run.lock");
    try {
      const first = await acquireGi088ThinkingModeProbeLock(lockPath);
      await expect(
        acquireGi088ThinkingModeProbeLock(lockPath)
      ).rejects.toThrow("GI088_THINKING_PROBE_RUN_LOCKED");
      await releaseGi088ThinkingModeProbeLock(first, { retainFile: false });
      const second = await acquireGi088ThinkingModeProbeLock(lockPath);
      await releaseGi088ThinkingModeProbeLock(second, { retainFile: true });
      await expect(
        acquireGi088ThinkingModeProbeLock(lockPath)
      ).rejects.toThrow("GI088_THINKING_PROBE_RUN_LOCKED");
    } finally {
      await rm(testRoot, { recursive: true, force: true });
    }
  });

  it("公开摘要移除 raw、reasoning 正文并哈希 upstream request id", () => {
    const privateResult = result(probePlan(), "E1", "high");
    privateResult.rawFinalOutput = "SENSITIVE_SENTINEL_42";
    privateResult.errorCode = "ERROR:SENSITIVE_SENTINEL_42";
    privateResult.validationIssues = [
      "OUTPUT_EVIDENCE_REF_NOT_USER_MESSAGE:SENSITIVE_SENTINEL_42"
    ];
    privateResult.providerDiagnostics = {
      finishReason: "stop",
      reasoningPresent: true,
      reasoningLength: 999,
      reasoningTokens: 100,
      latencyMs: 10,
      tokenUsage: null,
      upstreamRequestId: "req-safe-123"
    };
    const summary = createGi088ThinkingModeProbePublicSummary(privateResult);
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain("SENSITIVE_SENTINEL_42");
    expect(serialized).not.toContain("req-safe-123");
    expect(serialized).not.toContain("rawFinalOutput");
    expect(serialized).not.toContain("reasoningContent");
    expect(serialized).toContain(sha256("req-safe-123"));
    expect(summary.validationIssues).toEqual([
      "OUTPUT_EVIDENCE_REF_NOT_USER_MESSAGE"
    ]);
  });
});
