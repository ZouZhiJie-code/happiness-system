const {
  mockCreateRuntimeAIProvider
} = vi.hoisted(() => ({
  mockCreateRuntimeAIProvider: vi.fn()
}));

const {
  mockGetAIProviderStatus
} = vi.hoisted(() => ({
  mockGetAIProviderStatus: vi.fn()
}));

const {
  mockGetAIRuntimeConfigRecordById,
  mockGetAIRuntimeDraftRecord,
  mockGetAIRuntimeHistoryRecords,
  mockGetNextAIRuntimeVersion,
  mockGetPublishedAIRuntimeConfigRecord,
  mockPublishAIRuntimeConfigRecord,
  mockRecordAIRuntimeProbe,
  mockRollbackAIRuntimeConfigRecord,
  mockSaveAIRuntimeDraftRecord
} = vi.hoisted(() => ({
  mockGetAIRuntimeConfigRecordById: vi.fn(),
  mockGetAIRuntimeDraftRecord: vi.fn(),
  mockGetAIRuntimeHistoryRecords: vi.fn(),
  mockGetNextAIRuntimeVersion: vi.fn(),
  mockGetPublishedAIRuntimeConfigRecord: vi.fn(),
  mockPublishAIRuntimeConfigRecord: vi.fn(),
  mockRecordAIRuntimeProbe: vi.fn(),
  mockRollbackAIRuntimeConfigRecord: vi.fn(),
  mockSaveAIRuntimeDraftRecord: vi.fn()
}));

vi.mock("@/server/services/ai/runtime-provider-factory", () => ({
  createRuntimeAIProvider: mockCreateRuntimeAIProvider
}));

vi.mock("@/server/services/ai", () => ({
  getAIProviderStatus: mockGetAIProviderStatus
}));

vi.mock("@/server/repositories/admin-ai-runtime.repository", () => ({
  getAIRuntimeConfigRecordById: mockGetAIRuntimeConfigRecordById,
  getAIRuntimeDraftRecord: mockGetAIRuntimeDraftRecord,
  getAIRuntimeHistoryRecords: mockGetAIRuntimeHistoryRecords,
  getNextAIRuntimeVersion: mockGetNextAIRuntimeVersion,
  getPublishedAIRuntimeConfigRecord: mockGetPublishedAIRuntimeConfigRecord,
  publishAIRuntimeConfigRecord: mockPublishAIRuntimeConfigRecord,
  recordAIRuntimeProbe: mockRecordAIRuntimeProbe,
  rollbackAIRuntimeConfigRecord: mockRollbackAIRuntimeConfigRecord,
  saveAIRuntimeDraftRecord: mockSaveAIRuntimeDraftRecord
}));

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getAdminAIRuntimeStatus,
  getAIRuntimeHistory,
  probeAIRuntimeDraft,
  publishAIRuntimeDraft,
  rollbackAIRuntimeConfig,
  saveAIRuntimeDraft
} from "@/server/services/admin-ai-runtime/admin-ai-runtime.service";
import { encryptAIRuntimeApiKey } from "@/server/services/admin-ai-runtime/admin-ai-runtime-crypto";

describe("admin ai runtime service", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("saves a draft with encrypted api key and computed checksum", async () => {
    vi.stubEnv("AI_RUNTIME_CONFIG_SECRET", Buffer.alloc(32, 9).toString("base64"));
    mockGetAIRuntimeDraftRecord.mockResolvedValue(null);
    mockGetNextAIRuntimeVersion.mockResolvedValue(3);
    mockSaveAIRuntimeDraftRecord.mockResolvedValue({ id: "draft-chat-3" });

    const result = await saveAIRuntimeDraft({
      capability: "chat",
      actorUsername: "admin_user",
      input: {
        provider: "openai",
        enabled: true,
        displayName: "OpenAI Chat",
        apiKey: "sk-openai",
        config: {
          model: "gpt-5",
          baseUrl: "https://api.openai.com/v1"
        }
      }
    });

    expect(result).toEqual({ id: "draft-chat-3" });
    expect(mockSaveAIRuntimeDraftRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: "chat",
        version: 3,
        createdBy: "admin_user",
        apiKeyCiphertext: expect.any(String),
        apiKeyMask: expect.stringContaining("...")
      })
    );
  });

  it("blocks draft saves when AI_RUNTIME_CONFIG_SECRET is missing", async () => {
    await expect(
      saveAIRuntimeDraft({
        capability: "chat",
        actorUsername: "admin_user",
        input: {
          provider: "openai",
          enabled: true,
          displayName: "OpenAI Chat",
          apiKey: "sk-openai",
          config: {
            model: "gpt-5",
            baseUrl: "https://api.openai.com/v1"
          }
        }
      })
    ).rejects.toMatchObject({
      code: "AI_RUNTIME_SECRET_NOT_CONFIGURED"
    });
  });

  it("records a successful probe against the current draft checksum", async () => {
    vi.stubEnv("AI_RUNTIME_CONFIG_SECRET", Buffer.alloc(32, 11).toString("base64"));
    const encrypted = encryptAIRuntimeApiKey("sk-openai");
    mockGetAIRuntimeDraftRecord.mockResolvedValue({
      id: "draft-chat-3",
      capability: "chat",
      provider: "openai",
      enabled: true,
      displayName: "OpenAI Chat",
      apiKeyCiphertext: encrypted.ciphertext,
      apiKeyMask: encrypted.mask,
      configJson: {
        model: "gpt-5",
        baseUrl: "https://api.openai.com/v1"
      },
      configChecksum: "checksum-1",
      probes: []
    });
    mockCreateRuntimeAIProvider.mockReturnValue({
      name: "openai",
      complete: vi.fn().mockResolvedValue({
        content: "pong",
        latencyMs: 180,
        provider: "openai"
      })
    });
    mockRecordAIRuntimeProbe.mockResolvedValue({ id: "probe-1", success: true });

    const result = await probeAIRuntimeDraft({
      capability: "chat",
      actorUsername: "admin_user"
    });

    expect(result).toEqual({ id: "probe-1", success: true });
    expect(mockRecordAIRuntimeProbe).toHaveBeenCalledWith(
      expect.objectContaining({
        configId: "draft-chat-3",
        configChecksum: "checksum-1",
        success: true
      })
    );
  });

  it("blocks publish when the latest successful probe does not match the current checksum", async () => {
    vi.stubEnv("AI_RUNTIME_CONFIG_SECRET", Buffer.alloc(32, 12).toString("base64"));
    mockGetAIRuntimeDraftRecord.mockResolvedValue({
      id: "draft-chat-3",
      configChecksum: "checksum-new",
      probes: [
        {
          id: "probe-1",
          success: true,
          configChecksum: "checksum-old"
        }
      ]
    });

    await expect(
      publishAIRuntimeDraft({
        capability: "chat",
        actorUsername: "admin_user"
      })
    ).rejects.toMatchObject({
      code: "AI_RUNTIME_PROBE_OUTDATED"
    });
  });

  it("publishes and rolls back through repository operations", async () => {
    vi.stubEnv("AI_RUNTIME_CONFIG_SECRET", Buffer.alloc(32, 13).toString("base64"));
    mockGetAIRuntimeDraftRecord.mockResolvedValue({
      id: "draft-chat-3",
      configChecksum: "checksum-1",
      probes: [
        {
          id: "probe-1",
          success: true,
          configChecksum: "checksum-1"
        }
      ]
    });
    mockPublishAIRuntimeConfigRecord.mockResolvedValue({ id: "published-chat-3" });
    mockGetAIRuntimeConfigRecordById.mockResolvedValue({
      id: "history-1",
      capability: "chat",
      status: "archived"
    });
    mockGetNextAIRuntimeVersion.mockResolvedValue(4);
    mockRollbackAIRuntimeConfigRecord.mockResolvedValue({ id: "published-chat-4" });

    const published = await publishAIRuntimeDraft({
      capability: "chat",
      actorUsername: "admin_user"
    });
    const rolledBack = await rollbackAIRuntimeConfig({
      capability: "chat",
      actorUsername: "admin_user",
      rollbackFromId: "history-1"
    });

    expect(published).toEqual({ id: "published-chat-3" });
    expect(rolledBack).toEqual({ id: "published-chat-4" });
  });

  it("blocks publish when AI_RUNTIME_CONFIG_SECRET is missing", async () => {
    await expect(
      publishAIRuntimeDraft({
        capability: "chat",
        actorUsername: "admin_user"
      })
    ).rejects.toMatchObject({
      code: "AI_RUNTIME_SECRET_NOT_CONFIGURED"
    });
  });

  it("returns history rows from the repository", async () => {
    mockGetAIRuntimeHistoryRecords.mockResolvedValue([{ id: "published-chat-3" }]);

    const history = await getAIRuntimeHistory("chat");

    expect(history).toEqual([{ id: "published-chat-3" }]);
  });

  it("exposes current model/baseUrl summary and prefers the newest draft probe in status payload", async () => {
    mockGetAIProviderStatus
      .mockResolvedValueOnce({
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
        }
      })
      .mockResolvedValueOnce({
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
          modelOrEndpoint: "ep-embedding-live",
          baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
          baseUrlHost: "ark.cn-beijing.volces.com"
        }
      });
    mockGetPublishedAIRuntimeConfigRecord
      .mockResolvedValueOnce({
        id: "published-chat-1",
        probes: [{ id: "probe-published", createdAt: "2026-05-25T09:00:00.000Z" }]
      })
      .mockResolvedValueOnce(null);
    mockGetAIRuntimeDraftRecord
      .mockResolvedValueOnce({
        id: "draft-chat-1",
        probes: [{ id: "probe-draft", createdAt: "2026-05-25T10:00:00.000Z" }]
      })
      .mockResolvedValueOnce(null);

    const result = await getAdminAIRuntimeStatus();

    expect(result.capabilities[0]).toMatchObject({
      capability: "chat",
      configSummary: {
        modelOrEndpoint: "gpt-5",
        baseUrl: "https://api.openai.com/v1"
      },
      latestProbe: {
        id: "probe-draft"
      }
    });
  });
});
