const {
  MockAdminAuthorizationError,
  mockRequireAdminRequest
} = vi.hoisted(() => ({
  MockAdminAuthorizationError: class AdminAuthorizationError extends Error {},
  mockRequireAdminRequest: vi.fn()
}));

const {
  mockGetAdminAIRuntimeStatus,
  mockGetAIRuntimeDraft,
  mockGetAIRuntimeHistory,
  mockProbeAIRuntimeDraft,
  mockPublishAIRuntimeDraft,
  mockRollbackAIRuntimeConfig,
  mockSaveAIRuntimeDraft
} = vi.hoisted(() => ({
  mockGetAdminAIRuntimeStatus: vi.fn(),
  mockGetAIRuntimeDraft: vi.fn(),
  mockGetAIRuntimeHistory: vi.fn(),
  mockProbeAIRuntimeDraft: vi.fn(),
  mockPublishAIRuntimeDraft: vi.fn(),
  mockRollbackAIRuntimeConfig: vi.fn(),
  mockSaveAIRuntimeDraft: vi.fn()
}));

vi.mock("@/server/services/auth/admin-access", () => ({
  AdminAuthorizationError: MockAdminAuthorizationError,
  requireAdminRequest: mockRequireAdminRequest
}));

vi.mock("@/server/services/admin-ai-runtime/admin-ai-runtime.service", () => ({
  AdminAIRuntimeServiceError: class AdminAIRuntimeServiceError extends Error {
    code: string;

    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
  getAdminAIRuntimeStatus: mockGetAdminAIRuntimeStatus,
  getAIRuntimeDraft: mockGetAIRuntimeDraft,
  getAIRuntimeHistory: mockGetAIRuntimeHistory,
  probeAIRuntimeDraft: mockProbeAIRuntimeDraft,
  publishAIRuntimeDraft: mockPublishAIRuntimeDraft,
  rollbackAIRuntimeConfig: mockRollbackAIRuntimeConfig,
  saveAIRuntimeDraft: mockSaveAIRuntimeDraft
}));

import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getStatusRoute } from "@/app/api/admin/ai-runtime/status/route";
import { GET as getDraftRoute, PUT as putDraftRoute } from "@/app/api/admin/ai-runtime/[capability]/draft/route";
import { GET as getHistoryRoute } from "@/app/api/admin/ai-runtime/[capability]/history/route";
import { POST as postProbeRoute } from "@/app/api/admin/ai-runtime/[capability]/probe/route";
import { POST as postPublishRoute } from "@/app/api/admin/ai-runtime/[capability]/publish/route";
import { POST as postRollbackRoute } from "@/app/api/admin/ai-runtime/[capability]/rollback/route";

describe("admin ai runtime api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminRequest.mockResolvedValue({
      id: "user-1",
      username: "admin_user"
    });
  });

  it("allows admins to read status, draft, and history", async () => {
    mockGetAdminAIRuntimeStatus.mockResolvedValue({ capabilities: [] });
    mockGetAIRuntimeDraft.mockResolvedValue({ id: "draft-chat-1" });
    mockGetAIRuntimeHistory.mockResolvedValue([{ id: "published-chat-1" }]);

    const statusResponse = await getStatusRoute(new Request("http://localhost/api/admin/ai-runtime/status"));
    const draftResponse = await getDraftRoute(
      new Request("http://localhost/api/admin/ai-runtime/chat/draft"),
      { params: Promise.resolve({ capability: "chat" }) }
    );
    const historyResponse = await getHistoryRoute(
      new Request("http://localhost/api/admin/ai-runtime/chat/history"),
      { params: Promise.resolve({ capability: "chat" }) }
    );

    expect(statusResponse.status).toBe(200);
    expect(draftResponse.status).toBe(200);
    expect(historyResponse.status).toBe(200);
  });

  it("allows admins to save drafts and roll back history", async () => {
    mockSaveAIRuntimeDraft.mockResolvedValue({ id: "draft-chat-1" });
    mockProbeAIRuntimeDraft.mockResolvedValue({ id: "probe-chat-1" });
    mockRollbackAIRuntimeConfig.mockResolvedValue({ id: "published-chat-2" });

    const saveResponse = await putDraftRoute(
      new Request("http://localhost/api/admin/ai-runtime/chat/draft", {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          provider: "openai",
          enabled: true,
          displayName: "OpenAI Chat",
          apiKey: "sk-openai",
          config: {
            model: "gpt-5",
            baseUrl: "https://api.openai.com/v1"
          }
        })
      }),
      { params: Promise.resolve({ capability: "chat" }) }
    );
    const probeResponse = await postProbeRoute(
      new Request("http://localhost/api/admin/ai-runtime/chat/probe", {
        method: "POST"
      }),
      { params: Promise.resolve({ capability: "chat" }) }
    );
    const rollbackResponse = await postRollbackRoute(
      new Request("http://localhost/api/admin/ai-runtime/chat/rollback", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          rollbackFromId: "history-1"
        })
      }),
      { params: Promise.resolve({ capability: "chat" }) }
    );

    expect(saveResponse.status).toBe(200);
    expect(probeResponse.status).toBe(200);
    expect(rollbackResponse.status).toBe(200);
  });

  it("returns explicit validation errors for invalid provider and missing runtime secret", async () => {
    mockSaveAIRuntimeDraft.mockRejectedValueOnce({ code: "INVALID_AI_RUNTIME_PROVIDER" });
    mockPublishAIRuntimeDraft.mockRejectedValueOnce({ code: "AI_RUNTIME_SECRET_NOT_CONFIGURED" });

    const invalidProviderResponse = await putDraftRoute(
      new Request("http://localhost/api/admin/ai-runtime/chat/draft", {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          provider: "bad-provider"
        })
      }),
      { params: Promise.resolve({ capability: "chat" }) }
    );
    const missingSecretResponse = await postPublishRoute(
      new Request("http://localhost/api/admin/ai-runtime/chat/publish", {
        method: "POST"
      }),
      { params: Promise.resolve({ capability: "chat" }) }
    );

    expect(invalidProviderResponse.status).toBe(400);
    await expect(invalidProviderResponse.json()).resolves.toEqual({ error: "INVALID_AI_RUNTIME_PROVIDER" });
    expect(missingSecretResponse.status).toBe(503);
    await expect(missingSecretResponse.json()).resolves.toEqual({ error: "AI_RUNTIME_SECRET_NOT_CONFIGURED" });
  });

  it("blocks publish when the service reports missing or outdated probes", async () => {
    mockPublishAIRuntimeDraft
      .mockRejectedValueOnce({ code: "AI_RUNTIME_PUBLISH_BLOCKED" })
      .mockRejectedValueOnce({ code: "AI_RUNTIME_PROBE_OUTDATED" });

    const blockedResponse = await postPublishRoute(
      new Request("http://localhost/api/admin/ai-runtime/chat/publish", {
        method: "POST"
      }),
      { params: Promise.resolve({ capability: "chat" }) }
    );
    const outdatedResponse = await postPublishRoute(
      new Request("http://localhost/api/admin/ai-runtime/chat/publish", {
        method: "POST"
      }),
      { params: Promise.resolve({ capability: "chat" }) }
    );

    expect(blockedResponse.status).toBe(409);
    await expect(blockedResponse.json()).resolves.toEqual({ error: "AI_RUNTIME_PUBLISH_BLOCKED" });
    expect(outdatedResponse.status).toBe(409);
    await expect(outdatedResponse.json()).resolves.toEqual({ error: "AI_RUNTIME_PROBE_OUTDATED" });
  });

  it("returns 403 for authenticated non-admin callers", async () => {
    mockRequireAdminRequest.mockRejectedValue(new MockAdminAuthorizationError("ADMIN_FORBIDDEN"));

    const response = await getStatusRoute(new Request("http://localhost/api/admin/ai-runtime/status"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "ADMIN_FORBIDDEN" });
  });

  it("returns 401 when authentication is missing", async () => {
    mockRequireAdminRequest.mockRejectedValue(new Error("AUTHENTICATION_REQUIRED"));

    const response = await getDraftRoute(
      new Request("http://localhost/api/admin/ai-runtime/chat/draft"),
      { params: Promise.resolve({ capability: "chat" }) }
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "AUTHENTICATION_REQUIRED" });
  });
});
