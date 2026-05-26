const {
  mockGetPublishedAIRuntimeConfigRecord
} = vi.hoisted(() => ({
  mockGetPublishedAIRuntimeConfigRecord: vi.fn()
}));

vi.mock("@/server/repositories/admin-ai-runtime.repository", () => ({
  getPublishedAIRuntimeConfigRecord: mockGetPublishedAIRuntimeConfigRecord
}));

import { afterEach, describe, expect, it, vi } from "vitest";

import { encryptAIRuntimeApiKey } from "@/server/services/admin-ai-runtime/admin-ai-runtime-crypto";
import { resolveAIRuntimeConfig } from "@/server/services/ai/runtime-config-resolver";

describe("ai runtime config resolver", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("prefers published database config when it decrypts and validates", async () => {
    vi.stubEnv("AI_RUNTIME_CONFIG_SECRET", Buffer.alloc(32, 5).toString("base64"));
    const encrypted = encryptAIRuntimeApiKey("sk-openai");
    mockGetPublishedAIRuntimeConfigRecord.mockResolvedValue({
      id: "published-chat-1",
      capability: "chat",
      provider: "openai",
      enabled: true,
      apiKeyCiphertext: encrypted.ciphertext,
      configJson: {
        model: "gpt-5",
        baseUrl: "https://api.openai.com/v1"
      }
    });

    const result = await resolveAIRuntimeConfig("chat");

    expect(result).toMatchObject({
      source: "database",
      provider: "openai",
      publishedConfigId: "published-chat-1",
      fallbackReason: null
    });
  });

  it("falls back to env when no published database config exists", async () => {
    mockGetPublishedAIRuntimeConfigRecord.mockResolvedValue(null);
    vi.stubEnv("VOLCENGINE_ARK_API_KEY", "ark-key");
    vi.stubEnv("VOLCENGINE_ARK_MODEL", "deepseek-v3-2-251201");
    vi.stubEnv("VOLCENGINE_ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3");

    const result = await resolveAIRuntimeConfig("chat");

    expect(result).toMatchObject({
      source: "environment",
      provider: "volcengine_ark"
    });
  });

  it("falls back to env when the published database config is disabled or cannot decrypt", async () => {
    vi.stubEnv("VOLCENGINE_ARK_API_KEY", "ark-key");
    vi.stubEnv("VOLCENGINE_ARK_MODEL", "deepseek-v3-2-251201");
    vi.stubEnv("VOLCENGINE_ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3");
    mockGetPublishedAIRuntimeConfigRecord
      .mockResolvedValueOnce({
        id: "published-chat-disabled",
        capability: "chat",
        provider: "openai",
        enabled: false,
        apiKeyCiphertext: "ciphertext",
        configJson: {
          model: "gpt-5",
          baseUrl: "https://api.openai.com/v1"
        }
      })
      .mockResolvedValueOnce({
        id: "published-chat-bad-cipher",
        capability: "chat",
        provider: "openai",
        enabled: true,
        apiKeyCiphertext: "invalid-ciphertext",
        configJson: {
          model: "gpt-5",
          baseUrl: "https://api.openai.com/v1"
        }
      });

    const disabledResult = await resolveAIRuntimeConfig("chat");
    const decryptFailedResult = await resolveAIRuntimeConfig("chat");

    expect(disabledResult).toMatchObject({
      source: "environment",
      fallbackReason: "DATABASE_CONFIG_DISABLED"
    });
    expect(decryptFailedResult).toMatchObject({
      source: "environment",
      fallbackReason: "DATABASE_CONFIG_UNAVAILABLE"
    });
  });
});
