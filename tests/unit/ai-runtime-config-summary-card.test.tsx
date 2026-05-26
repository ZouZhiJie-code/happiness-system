import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

import { AIRuntimeConfigSummaryCard } from "@/components/interview/ai-runtime-config-summary-card";

function buildStatusResponse() {
  return {
    capabilities: [
      {
        capability: "chat",
        provider: "openai",
        available: true,
        state: "published",
        source: "database",
        code: "OK",
        issues: [],
        fallbackReason: null,
        configSummary: {
          hasApiKey: true,
          hasModel: true,
          hasBaseUrl: true,
          modelSource: "published_config",
          modelOrEndpoint: "gpt-5.4",
          baseUrl: "https://api.openai.com/v1",
          baseUrlHost: "api.openai.com"
        },
        publishedConfig: {
          id: "chat-config-1",
          capability: "chat",
          provider: "openai",
          status: "published",
          enabled: true,
          displayName: "Chat Production",
          apiKeyConfigured: true,
          apiKeyMask: "sk-***abcd",
          config: null,
          configChecksum: "checksum-chat",
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
        latestProbe: null
      },
      {
        capability: "embedding",
        provider: "volcengine",
        available: true,
        state: "environment",
        source: "environment",
        code: "OK",
        issues: [],
        fallbackReason: null,
        configSummary: {
          hasApiKey: false,
          hasModel: true,
          hasBaseUrl: true,
          modelSource: "environment",
          modelOrEndpoint: "doubao-embedding-large",
          baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
          baseUrlHost: "ark.cn-beijing.volces.com"
        },
        publishedConfig: null,
        latestProbe: null
      }
    ]
  };
}

describe("AIRuntimeConfigSummaryCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("为管理员显示 chat 与 embedding 的当前配置摘要", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/admin/ai-runtime/status") {
        return new Response(JSON.stringify(buildStatusResponse()), { status: 200 });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    render(<AIRuntimeConfigSummaryCard />);

    expect(await screen.findByText("当前 AI 配置")).toBeInTheDocument();
    expect(screen.getByText("聊天")).toBeInTheDocument();
    expect(screen.getByText("向量")).toBeInTheDocument();
    expect(screen.getByText("gpt-5.4")).toBeInTheDocument();
    expect(screen.getByText("doubao-embedding-large")).toBeInTheDocument();
    expect(screen.getByText("api.openai.com")).toBeInTheDocument();
    expect(screen.getByText("ark.cn-beijing.volces.com")).toBeInTheDocument();
    expect(screen.getByText("sk-***abcd")).toBeInTheDocument();
    expect(screen.getByText("未配置")).toBeInTheDocument();
  });

  it("非管理员请求被服务端拒绝时静默不显示", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/admin/ai-runtime/status") {
        return new Response(JSON.stringify({ error: "ADMIN_FORBIDDEN" }), { status: 403 });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    render(<AIRuntimeConfigSummaryCard />);

    await waitFor(() => {
      expect(vi.mocked(global.fetch).mock.calls.some(([url]) => String(url) === "/api/admin/ai-runtime/status")).toBe(true);
    });
    expect(screen.queryByText("当前 AI 配置")).not.toBeInTheDocument();
  });

  it("管理员接口异常时静默不显示", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/admin/ai-runtime/status") {
        return new Response(JSON.stringify({ error: "ADMIN_AI_RUNTIME_FAILED" }), { status: 500 });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    render(<AIRuntimeConfigSummaryCard />);

    await waitFor(() => {
      expect(vi.mocked(global.fetch).mock.calls.some(([url]) => String(url) === "/api/admin/ai-runtime/status")).toBe(true);
    });
    expect(screen.queryByText("当前 AI 配置")).not.toBeInTheDocument();
  });
});
