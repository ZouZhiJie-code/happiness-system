import React from "react";
import { render, screen } from "@testing-library/react";

const { mockRequireAdminPage } = vi.hoisted(() => ({
  mockRequireAdminPage: vi.fn()
}));

const {
  mockGetAdminAIRuntimeStatus,
  mockGetAIRuntimeDraft,
  mockGetAIRuntimeHistory
} = vi.hoisted(() => ({
  mockGetAdminAIRuntimeStatus: vi.fn(),
  mockGetAIRuntimeDraft: vi.fn(),
  mockGetAIRuntimeHistory: vi.fn()
}));

vi.mock("@/server/services/auth/admin-access", () => ({
  requireAdminPage: mockRequireAdminPage
}));

vi.mock("@/server/services/admin-ai-runtime/admin-ai-runtime.service", () => ({
  getAdminAIRuntimeStatus: mockGetAdminAIRuntimeStatus,
  getAIRuntimeDraft: mockGetAIRuntimeDraft,
  getAIRuntimeHistory: mockGetAIRuntimeHistory
}));

import AdminAIRuntimePage from "@/app/settings/ai-runtime/page";

describe("admin ai runtime page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminPage.mockResolvedValue({
      id: "user-1",
      username: "admin_user"
    });
    mockGetAdminAIRuntimeStatus.mockResolvedValue({
      capabilities: [
        {
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
            id: "published-chat-2",
            capability: "chat",
            provider: "openai",
            status: "published",
            enabled: true,
            displayName: "OpenAI Chat",
            apiKeyConfigured: true,
            apiKeyMask: "sk-o...enai",
            config: {
              model: "gpt-5",
              baseUrl: "https://api.openai.com/v1"
            },
            configChecksum: "checksum-chat-2",
            version: 2,
            createdBy: "admin_user",
            publishedBy: "admin_user",
            publishedAt: "2026-05-25T14:30:00.000Z",
            archivedAt: null,
            rollbackFromId: null,
            createdAt: "2026-05-25T14:20:00.000Z",
            updatedAt: "2026-05-25T14:30:00.000Z",
            probes: []
          },
          latestProbe: null
        },
        {
          capability: "embedding",
          provider: "volcengine_ark",
          available: true,
          state: "ready",
          source: "environment",
          code: "READY",
          issues: [],
          fallbackReason: null,
          configSummary: {
            hasApiKey: true,
            hasModel: true,
            hasBaseUrl: true,
            modelSource: "VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID",
            modelOrEndpoint: "ep-embedding",
            baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
            baseUrlHost: "ark.cn-beijing.volces.com"
          },
          publishedConfig: null,
          latestProbe: null
        }
      ]
    });
    mockGetAIRuntimeDraft.mockResolvedValue({
      id: "draft-chat-1",
      capability: "chat",
      provider: "openai",
      status: "draft",
      enabled: true,
      displayName: "OpenAI Chat",
      apiKeyConfigured: true,
      apiKeyMask: "sk-o...enai",
      config: {
        model: "gpt-5",
        baseUrl: "https://api.openai.com/v1"
      },
      probes: []
    });
    mockGetAIRuntimeHistory.mockResolvedValue([
      {
        id: "published-chat-1",
        capability: "chat",
        provider: "volcengine_ark",
        status: "archived",
        enabled: true,
        displayName: "Ark Chat",
        config: {
          modelId: "deepseek-v3-2-251201",
          baseUrl: "https://ark.cn-beijing.volces.com/api/v3"
        },
        version: 1,
        publishedBy: "admin_user",
        publishedAt: "2026-05-25T14:30:00.000Z",
        probes: []
      }
    ]);
  });

  it("renders status cards, draft form, and history for admins", async () => {
    render(await AdminAIRuntimePage());

    expect(screen.getByRole("heading", { name: "AI 运行配置中心" })).toBeInTheDocument();
    expect(screen.getAllByText("聊天能力").length).toBeGreaterThan(0);
    expect(screen.getAllByText("向量嵌入能力").length).toBeGreaterThan(0);
    expect(screen.getByText("当前使用数据库配置")).toBeInTheDocument();
    expect(screen.getAllByText("最近一次发布时间（北京时间）").length).toBeGreaterThan(0);
    expect(screen.getAllByText("发布时间（北京时间）").length).toBeGreaterThan(0);
    expect(screen.getByText("gpt-5")).toBeInTheDocument();
    expect(screen.getByText("https://api.openai.com/v1")).toBeInTheDocument();
    expect(screen.getAllByText("2026-05-25 22:30").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "保存草稿" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "执行连通性测试" })).toBeInTheDocument();
    expect(screen.getAllByText("历史版本").length).toBeGreaterThan(0);
    expect(screen.getByText("发布后，从下一次 AI 请求开始生效")).toBeInTheDocument();
  });
});
