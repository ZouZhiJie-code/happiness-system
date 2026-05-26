import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetPublishedAIRuntimeConfigRecord } = vi.hoisted(() => ({
  mockGetPublishedAIRuntimeConfigRecord: vi.fn()
}));

vi.mock("@/server/repositories/admin-ai-runtime.repository", () => ({
  getPublishedAIRuntimeConfigRecord: mockGetPublishedAIRuntimeConfigRecord
}));

import { getAIProviderStatus } from "@/server/services/ai";
import { encryptAIRuntimeApiKey } from "@/server/services/admin-ai-runtime/admin-ai-runtime-crypto";

const ENV_KEYS = [
  "AI_PROVIDER",
  "VOLCENGINE_ARK_API_KEY",
  "ARK_API_KEY",
  "VOLCENGINE_ARK_MODEL",
  "ARK_MODEL",
  "VOLCENGINE_ARK_ENDPOINT_ID",
  "ARK_ENDPOINT_ID",
  "VOLCENGINE_ARK_BASE_URL",
  "ARK_BASE_URL",
  "VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID"
] as const;

const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

describe("getAIProviderStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPublishedAIRuntimeConfigRecord.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();

    for (const key of ENV_KEYS) {
      const original = ORIGINAL_ENV[key];

      if (typeof original === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  });

  it("flags placeholder-shaped production values as config invalid", async () => {
    vi.stubEnv("AI_PROVIDER", "volcengine-ark");
    vi.stubEnv("VOLCENGINE_ARK_API_KEY", "$VOLCENGINE_ARK_API_KEY\\n");
    vi.stubEnv("VOLCENGINE_ARK_ENDPOINT_ID", "ep-20260524-realish");
    vi.stubEnv("VOLCENGINE_ARK_BASE_URL", "$VOLCENGINE_ARK_BASE_URL\\n");

    const status = await getAIProviderStatus("chat");

    expect(status).toMatchObject({
      available: false,
      state: "config_invalid",
      code: "PLACEHOLDER_API_KEY",
      issues: ["PLACEHOLDER_API_KEY", "PLACEHOLDER_BASE_URL"],
      source: null
    });
  });

  it("treats endpoint id fallback plus a normal base url as ready for chat", async () => {
    vi.stubEnv("AI_PROVIDER", "volcengine-ark");
    vi.stubEnv("VOLCENGINE_ARK_API_KEY", "ark-live-key");
    vi.stubEnv("VOLCENGINE_ARK_ENDPOINT_ID", "ep-20260524-realish");
    vi.stubEnv("VOLCENGINE_ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3");

    const status = await getAIProviderStatus("chat");

    expect(status).toMatchObject({
      available: true,
      state: "ready",
      code: "READY",
      source: "environment",
      issues: [],
      configSummary: {
        hasApiKey: true,
        hasModel: true,
        hasBaseUrl: true,
        modelSource: "VOLCENGINE_ARK_ENDPOINT_ID",
        modelOrEndpoint: "ep-20260524-realish",
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
        baseUrlHost: "ark.cn-beijing.volces.com"
      }
    });
  });

  it("requires a dedicated embedding endpoint when checking embedding capability", async () => {
    vi.stubEnv("VOLCENGINE_ARK_API_KEY", "ark-live-key");
    vi.stubEnv("VOLCENGINE_ARK_MODEL", "deepseek-v3-2-251201");
    vi.stubEnv("VOLCENGINE_ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3");
    delete process.env.VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID;

    const status = await getAIProviderStatus("embedding");

    expect(status).toMatchObject({
      available: false,
      state: "config_invalid",
      code: "MISSING_EMBEDDING_ENDPOINT_ID",
      issues: ["MISSING_EMBEDDING_ENDPOINT_ID"]
    });
  });

  it("uses a published database embedding endpoint without requiring the legacy env endpoint", async () => {
    vi.stubEnv("AI_RUNTIME_CONFIG_SECRET", Buffer.alloc(32, 15).toString("base64"));
    delete process.env.VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID;
    const encrypted = encryptAIRuntimeApiKey("ark-db-key");

    mockGetPublishedAIRuntimeConfigRecord.mockImplementation(async (capability: string) =>
      capability === "embedding"
        ? {
            id: "published-embedding-1",
            capability: "embedding",
            provider: "volcengine_ark",
            enabled: true,
            apiKeyCiphertext: encrypted.ciphertext,
            apiKeyMask: encrypted.mask,
            configJson: {
              embeddingEndpointId: "ep-db-embedding",
              baseUrl: "https://ark.cn-beijing.volces.com/api/v3"
            }
          }
        : null
    );

    const status = await getAIProviderStatus("embedding");

    expect(status).toMatchObject({
      available: true,
      state: "ready",
      code: "READY",
      source: "database",
      issues: [],
      configSummary: {
        hasApiKey: true,
        hasModel: true,
        hasBaseUrl: true,
        modelSource: "VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID",
        modelOrEndpoint: "ep-db-embedding",
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
        baseUrlHost: "ark.cn-beijing.volces.com"
      }
    });
  });
});
