import { describe, expect, it, vi } from "vitest";

import { createBoard7bWorkingTaskV1InitialSemanticState } from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  assertGi088ModelComparisonAuthorization,
  assertGi088ModelComparisonLedgerCanResume,
  createGi088ModelComparisonPublicPlan,
  isGi088ModelComparisonExecutionRequested,
  parseGi088ModelComparisonLedger,
  type Gi088ModelComparisonProbeLedger
} from "../../scripts/run-gi088-model-comparison-probe";
import {
  GI088_MODEL_COMPARISON_LEDGER_SCHEMA_VERSION,
  GI088_MODEL_COMPARISON_PROBE_CALL_BUDGET,
  GI088_MODEL_COMPARISON_PROBE_VERSION,
  GI088_MODEL_COMPARISON_PUBLIC_SUMMARY_CONTRACT,
  GI088_MODEL_COMPARISON_RUNTIME,
  GI088_MODEL_COMPARISON_SCHEDULE,
  createGi088ModelComparisonCompletionParams,
  createGi088ModelComparisonDecision,
  createGi088ModelComparisonPublicRequest,
  createGi088ModelComparisonPublicSummary,
  createGi088ModelComparisonRequestHash,
  runGi088ModelComparisonProbeCall,
  type Gi088ModelComparisonProbeCase,
  type Gi088ModelComparisonProbePlan,
  type Gi088ModelComparisonProbeResult
} from "../../src/server/services/evaluation/gi088/model-comparison-probe";
import {
  AIProviderError,
  type AIProvider
} from "../../src/server/services/ai/ai-provider";

const AUTHORIZATION_ID = "00000000-0000-4000-8000-000000000001";
const SOURCE_PATH = "/repo/artifacts/local-runtime/source.json";

function probeCase(caseId = "E1"): Gi088ModelComparisonProbeCase {
  return {
    caseId,
    contextClass: "synthetic",
    taskId: "A1",
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

function probePlan(): Gi088ModelComparisonProbePlan {
  return {
    probeVersion: GI088_MODEL_COMPARISON_PROBE_VERSION,
    probeFingerprint: "probe-fingerprint",
    sourceProbeVersion:
      "2026-08-09.gi088-empty-content-response-format-probe-v1",
    sourceProbeFingerprint:
      "7c0fbbb98bc9c3804a5614e90acd0ecb4b13f023e3b96ddf68820a241c6c9b65",
    sourceSnapshotSha256: "snapshot-sha",
    sourceEvaluationVersion: "2026-08-09.gi088-human-eval-v1",
    sourceCandidateFingerprint: "candidate-sha",
    sourceExecutionFingerprint: "execution-sha",
    runtime: GI088_MODEL_COMPARISON_RUNTIME,
    authorizedCallBudget: GI088_MODEL_COMPARISON_PROBE_CALL_BUDGET,
    cases: [probeCase("E1"), probeCase("E2"), probeCase("E3")],
    schedule: GI088_MODEL_COMPARISON_SCHEDULE.map((item) => ({ ...item })),
    ledgerSchemaVersion: GI088_MODEL_COMPARISON_LEDGER_SCHEMA_VERSION,
    publicSummaryContract: GI088_MODEL_COMPARISON_PUBLIC_SUMMARY_CONTRACT
  };
}

function result(
  variant: "flash" | "pro",
  status: Gi088ModelComparisonProbeResult["status"] = "valid",
  errorCode: string | null = null
): Gi088ModelComparisonProbeResult {
  const currentCase = probeCase("E1");
  return {
    order: variant === "flash" ? 1 : 2,
    caseId: "E1",
    contextClass: currentCase.contextClass,
    variant,
    requestedModel: GI088_MODEL_COMPARISON_RUNTIME.models[variant],
    sourceCallId: currentCase.sourceCallId,
    sourceRequestHash: currentCase.sourceRequestHash,
    probeRequestHash: createGi088ModelComparisonRequestHash({
      probeCase: currentCase,
      variant
    }),
    requestHashVerified: true,
    status,
    errorCode,
    responseHash: status === "valid" ? "response-sha" : null,
    validationIssues: [],
    latencyMs: 123,
    tokenUsage: null,
    providerDiagnostics: null
  };
}

function ledger(
  plan: Gi088ModelComparisonProbePlan,
  calls: Gi088ModelComparisonProbeLedger["calls"]
): Gi088ModelComparisonProbeLedger {
  return {
    schemaVersion: GI088_MODEL_COMPARISON_LEDGER_SCHEMA_VERSION,
    probeVersion: GI088_MODEL_COMPARISON_PROBE_VERSION,
    probeFingerprint: plan.probeFingerprint,
    authorizationId: AUTHORIZATION_ID,
    authorizedCallBudget: GI088_MODEL_COMPARISON_PROBE_CALL_BUDGET,
    sourcePath: SOURCE_PATH,
    sourceSnapshotSha256: plan.sourceSnapshotSha256,
    createdAt: "2026-08-10T00:00:00.000Z",
    completedAt: null,
    calls
  };
}

describe("GI-088 Flash / Pro model comparison probe", () => {
  it("冻结三组配对、六次调用和单变量模型切换", () => {
    expect(GI088_MODEL_COMPARISON_SCHEDULE).toHaveLength(6);
    expect(
      GI088_MODEL_COMPARISON_SCHEDULE.filter((item) => item.variant === "flash")
    ).toHaveLength(3);
    expect(
      GI088_MODEL_COMPARISON_SCHEDULE.filter((item) => item.variant === "pro")
    ).toHaveLength(3);
    const params = createGi088ModelComparisonCompletionParams(probeCase());
    expect(params).toMatchObject({
      useProviderDefaultTemperature: true,
      useProviderDefaultMaxTokens: true,
      headersTimeoutMs: 15_000,
      bodyIdleTimeoutMs: 45_000,
      hardTimeoutMs: 60_000,
      responseFormat: "json_object",
      thinking: "enabled",
      reasoningEffort: "high"
    });
    const flash = createGi088ModelComparisonPublicRequest({
      probeCase: probeCase(),
      variant: "flash"
    });
    const pro = createGi088ModelComparisonPublicRequest({
      probeCase: probeCase(),
      variant: "pro"
    });
    expect(flash.messagesHash).toBe(pro.messagesHash);
    expect(flash.requestHash).not.toBe(pro.requestHash);
    expect(flash.requestedModel).toBe("deepseek-v4-flash");
    expect(pro.requestedModel).toBe("deepseek-v4-pro");
  });

  it("默认零调用并要求精确六次授权", () => {
    expect(isGi088ModelComparisonExecutionRequested(["node", "probe.ts"])).toBe(
      false
    );
    expect(
      isGi088ModelComparisonExecutionRequested([
        "node",
        "probe.ts",
        "--execute"
      ])
    ).toBe(true);
    expect(() =>
      assertGi088ModelComparisonAuthorization("probe-fingerprint", {})
    ).toThrow("GI088_MODEL_COMPARISON_SCOPE_NOT_AUTHORIZED");
    expect(
      assertGi088ModelComparisonAuthorization("probe-fingerprint", {
        GI088_MODEL_CALL_SCOPE: "flash_pro_model_comparison_probe",
        GI088_AUTHORIZED_MODEL_COMPARISON_PROBE_FINGERPRINT:
          "probe-fingerprint",
        GI088_MODEL_COMPARISON_CONFIRMATION: "I_UNDERSTAND_6_CALLS",
        GI088_MODEL_COMPARISON_AUTHORIZED_BUDGET: "6",
        GI088_MODEL_COMPARISON_AUTHORIZATION_ID: AUTHORIZATION_ID
      })
    ).toBe(AUTHORIZATION_ID);
    expect(createGi088ModelComparisonPublicPlan(probePlan())).toMatchObject({
      modelGenerationCalls: 0,
      executionAuthorized: false,
      authorizedCallBudget: 6
    });
  });

  it("公开计划和结果排除用户原话、Prompt、可见正文与思考正文", () => {
    const publicPlan = createGi088ModelComparisonPublicPlan(probePlan());
    const publicResult = createGi088ModelComparisonPublicSummary({
      ...result("pro"),
      providerDiagnostics: {
        finishReason: "stop",
        reasoningPresent: true,
        reasoningLength: 20,
        reasoningTokens: 5,
        latencyMs: 10,
        tokenUsage: null,
        upstreamRequestId: "request-sensitive-id"
      }
    });
    const serialized = JSON.stringify({ publicPlan, publicResult });
    expect(serialized).not.toContain("SENSITIVE_SENTINEL_42");
    expect(serialized).not.toContain("request-sensitive-id");
    expect(serialized).not.toContain("rawFinalOutput");
  });

  it("每个计划项只调用一次 Provider", async () => {
    const complete = vi.fn(async () => {
      throw new AIProviderError("empty", "EMPTY_CONTENT");
    });
    const provider: AIProvider = { name: "fake", complete };
    const output = await runGi088ModelComparisonProbeCall({
      provider,
      order: 1,
      probeCase: probeCase(),
      variant: "flash"
    });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(output).toMatchObject({
      status: "technical_failure",
      errorCode: "EMPTY_CONTENT"
    });
  });

  it("reserved 账本阻止重复调用，完成结果绑定模型请求哈希", () => {
    const plan = probePlan();
    const reserved = ledger(plan, [
      {
        key: "1:E1:flash",
        order: 1,
        caseId: "E1",
        variant: "flash",
        status: "reserved",
        reservedAt: "2026-08-10T00:01:00.000Z",
        completedAt: null,
        result: null
      }
    ]);
    const parsed = parseGi088ModelComparisonLedger({
      value: reserved,
      plan,
      authorizationId: AUTHORIZATION_ID,
      sourcePath: SOURCE_PATH
    });
    expect(() => assertGi088ModelComparisonLedgerCanResume(parsed)).toThrow(
      "GI088_MODEL_COMPARISON_CALL_OUTCOME_AMBIGUOUS"
    );
    const complete = ledger(plan, [
      {
        ...reserved.calls[0]!,
        status: "completed",
        completedAt: "2026-08-10T00:01:10.000Z",
        result: result("flash")
      }
    ]);
    expect(() =>
      parseGi088ModelComparisonLedger({
        value: complete,
        plan,
        authorizationId: AUTHORIZATION_ID,
        sourcePath: SOURCE_PATH
      })
    ).not.toThrow();
    complete.calls[0]!.result!.probeRequestHash = "changed";
    expect(() =>
      parseGi088ModelComparisonLedger({
        value: complete,
        plan,
        authorizationId: AUTHORIZATION_ID,
        sourcePath: SOURCE_PATH
      })
    ).toThrow("GI088_MODEL_COMPARISON_LEDGER_RESULT_LINEAGE_MISMATCH");
  });

  it("决策口径区分 Pro 方向性支持和共享空正文风险", () => {
    const proValid = [result("pro"), result("pro"), result("pro")];
    const flashMixed = [
      result("flash"),
      result("flash"),
      result("flash", "technical_failure", "EMPTY_CONTENT")
    ];
    expect(
      createGi088ModelComparisonDecision([...flashMixed, ...proValid])
        .disposition
    ).toBe("directional_support_for_pro_candidate");
    expect(
      createGi088ModelComparisonDecision([
        ...flashMixed,
        result("pro"),
        result("pro"),
        result("pro", "technical_failure", "EMPTY_CONTENT")
      ]).disposition
    ).toBe("shared_empty_content_risk_pro_not_qualified");
  });
});
