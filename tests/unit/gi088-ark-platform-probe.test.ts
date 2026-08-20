import { describe, expect, it, vi } from "vitest";

import { createBoard7bWorkingTaskV1InitialSemanticState } from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_ARK_PLATFORM_PROBE_CALL_BUDGET,
  GI088_ARK_PLATFORM_PROBE_RUNTIME,
  createGi088ArkPlatformCompletionParams,
  createGi088ArkPlatformDecision,
  createGi088ArkPlatformPublicRequest,
  createGi088ArkPlatformPublicSummary,
  runGi088ArkPlatformProbeCall,
  type Gi088ArkPlatformProbeResult
} from "../../src/server/services/evaluation/gi088/ark-platform-probe";
import type { Gi088EmptyContentProbeCase } from "../../src/server/services/evaluation/gi088/empty-content-probe";
import {
  AIProviderError,
  type AIProvider
} from "../../src/server/services/ai/ai-provider";

function probeCase(caseId = "E1"): Gi088EmptyContentProbeCase {
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
        { id: "U1", role: "user", content: "PRIVATE_USER_SENTINEL" }
      ],
      latestUserMessageId: "U1",
      semanticState: createBoard7bWorkingTaskV1InitialSemanticState()
    }
  };
}

function result(
  status: Gi088ArkPlatformProbeResult["status"] = "valid",
  errorCode: string | null = null
): Gi088ArkPlatformProbeResult {
  return {
    order: 1,
    caseId: "E1",
    contextClass: "synthetic",
    requestedModel: GI088_ARK_PLATFORM_PROBE_RUNTIME.model,
    sourceCallId: "call-E1",
    sourceRequestHash: "source-E1",
    probeRequestHash: "request-sha",
    requestHashVerified: true,
    status,
    errorCode,
    responseHash: status === "valid" ? "response-sha" : null,
    validationIssues: [],
    latencyMs: 100,
    tokenUsage: null,
    providerDiagnostics: null
  };
}

describe("GI-088 Volcengine Ark Flash platform probe", () => {
  it("冻结三条历史请求、Thinking high、JSON 和零恢复", () => {
    expect(GI088_ARK_PLATFORM_PROBE_CALL_BUDGET).toBe(3);
    expect(GI088_ARK_PLATFORM_PROBE_RUNTIME).toMatchObject({
      transport: "direct_rest_openai_compatible",
      model: "deepseek-v4-flash-ga-260731",
      thinking: "enabled",
      reasoningEffort: "high",
      responseFormat: "json_object",
      automaticRetries: 0,
      fallbackCalls: 0
    });
    expect(createGi088ArkPlatformCompletionParams(probeCase())).toMatchObject({
      useProviderDefaultTemperature: true,
      useProviderDefaultMaxTokens: true,
      headersTimeoutMs: 15_000,
      bodyIdleTimeoutMs: 45_000,
      hardTimeoutMs: 60_000,
      responseFormat: "json_object",
      thinking: "enabled",
      reasoningEffort: "high"
    });
    const publicRequest = createGi088ArkPlatformPublicRequest(probeCase());
    expect(publicRequest).toMatchObject({
      requestedModel: "deepseek-v4-flash-ga-260731",
      responseFormat: "json_object",
      thinking: "enabled",
      reasoningEffort: "high"
    });
    expect(JSON.stringify(publicRequest)).not.toContain(
      "PRIVATE_USER_SENTINEL"
    );
  });

  it("每条计划只调用一次 Provider", async () => {
    const complete = vi.fn(async () => {
      throw new AIProviderError("empty", "EMPTY_CONTENT");
    });
    const provider: AIProvider = { name: "fake", complete };
    const output = await runGi088ArkPlatformProbeCall({
      provider,
      order: 1,
      probeCase: probeCase()
    });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(output).toMatchObject({
      status: "technical_failure",
      errorCode: "EMPTY_CONTENT"
    });
  });

  it("公开结果排除用户原话、可见正文、隐藏思考和原始请求 ID", () => {
    const publicResult = createGi088ArkPlatformPublicSummary({
      ...result(),
      providerDiagnostics: {
        finishReason: "stop",
        reasoningPresent: true,
        reasoningLength: 20,
        reasoningTokens: 5,
        latencyMs: 100,
        tokenUsage: null,
        upstreamRequestId: "PRIVATE_REQUEST_ID"
      }
    });
    const serialized = JSON.stringify(publicResult);
    expect(serialized).not.toContain("PRIVATE_REQUEST_ID");
    expect(serialized).not.toContain("PRIVATE_USER_SENTINEL");
    expect(serialized).not.toContain("rawFinalOutput");
  });

  it("决策区分完整通过、空正文和其他技术失败", () => {
    expect(
      createGi088ArkPlatformDecision([result(), result(), result()])
        .disposition
    ).toBe("ark_flash_platform_candidate_supported");
    expect(
      createGi088ArkPlatformDecision([
        result(),
        result(),
        result("technical_failure", "EMPTY_CONTENT")
      ]).disposition
    ).toBe("ark_flash_shared_empty_content_risk");
    expect(
      createGi088ArkPlatformDecision([
        result(),
        result(),
        result("technical_failure", "TIMEOUT")
      ]).disposition
    ).toBe("ark_flash_platform_not_qualified");
  });
});
