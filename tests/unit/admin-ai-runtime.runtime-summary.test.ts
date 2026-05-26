import { describe, expect, it } from "vitest";

import { summarizeAIRuntimeStatus } from "@/features/admin-ai-runtime/runtime-summary";
import type { AIRuntimeStatusPayload } from "@/features/admin-ai-runtime/api";

function createStatus(overrides: Partial<AIRuntimeStatusPayload>): AIRuntimeStatusPayload {
  return {
    capability: "chat",
    provider: "openai",
    available: true,
    state: "ready",
    source: "database",
    code: "READY",
    issues: [],
    fallbackReason: null,
    configSummary: {
      hasApiKey: true,
      hasModel: true,
      hasBaseUrl: true,
      modelSource: "DATABASE_CONFIG",
      modelOrEndpoint: "gpt-5",
      baseUrl: "https://api.openai.com/v1",
      baseUrlHost: "api.openai.com"
    },
    publishedConfig: {
      id: "published-chat-1",
      capability: "chat",
      provider: "openai",
      status: "published",
      enabled: true,
      displayName: "OpenAI Chat",
      apiKeyConfigured: true,
      apiKeyMask: "sk...abcd",
      config: {
        model: "gpt-5",
        baseUrl: "https://api.openai.com/v1"
      },
      configChecksum: "checksum-1",
      version: 3,
      createdBy: "admin",
      publishedBy: "admin",
      publishedAt: "2026-05-26T02:00:00.000Z",
      archivedAt: null,
      rollbackFromId: null,
      createdAt: "2026-05-26T01:00:00.000Z",
      updatedAt: "2026-05-26T02:00:00.000Z",
      probes: []
    },
    latestProbe: null,
    ...overrides
  };
}

describe("admin ai runtime runtime summary", () => {
  it("summarizes database runtime config without exposing raw api keys", () => {
    const summary = summarizeAIRuntimeStatus(createStatus({}));

    expect(summary).toEqual(
      expect.objectContaining({
        capabilityLabel: "聊天",
        sourceLabel: "数据库配置",
        providerLabel: "OpenAI",
        statusLabel: "可用",
        modelOrEndpointLabel: "gpt-5",
        baseUrlHostLabel: "api.openai.com",
        apiKeyLabel: "sk...abcd",
        errorCode: null
      })
    );
    expect(JSON.stringify(summary)).not.toContain("sk-openai-secret");
  });

  it("keeps embedding missing endpoint visible as a configuration error", () => {
    const summary = summarizeAIRuntimeStatus(
      createStatus({
        capability: "embedding",
        provider: "volcengine_ark",
        available: false,
        state: "config_invalid",
        source: null,
        code: "MISSING_EMBEDDING_ENDPOINT_ID",
        issues: ["MISSING_EMBEDDING_ENDPOINT_ID"],
        configSummary: {
          hasApiKey: true,
          hasModel: false,
          hasBaseUrl: true,
          modelSource: null,
          modelOrEndpoint: null,
          baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
          baseUrlHost: "ark.cn-beijing.volces.com"
        },
        publishedConfig: null
      })
    );

    expect(summary).toEqual(
      expect.objectContaining({
        capabilityLabel: "向量",
        sourceLabel: "未接通",
        providerLabel: "Volcengine Ark",
        statusLabel: "待处理",
        modelOrEndpointLabel: "未配置",
        baseUrlHostLabel: "ark.cn-beijing.volces.com",
        apiKeyLabel: "已配置（环境变量）",
        errorCode: "MISSING_EMBEDDING_ENDPOINT_ID"
      })
    );
  });

  it("does not fall back to displaying the raw base url when the host is unavailable", () => {
    const summary = summarizeAIRuntimeStatus(
      createStatus({
        configSummary: {
          hasApiKey: true,
          hasModel: true,
          hasBaseUrl: true,
          modelSource: "DATABASE_CONFIG",
          modelOrEndpoint: "gpt-5",
          baseUrl: "https://token@example.com/v1?secret=value",
          baseUrlHost: null
        }
      })
    );

    expect(summary.baseUrlHostLabel).toBe("Host 不可识别");
    expect(JSON.stringify(summary)).not.toContain("token@example.com");
    expect(JSON.stringify(summary)).not.toContain("secret=value");
  });
});
