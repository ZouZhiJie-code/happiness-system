import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getAIRuntimeDraftSchema,
  getAIRuntimePersistedConfigSchema
} from "@/features/admin-ai-runtime/schema";
import {
  AdminAIRuntimeCryptoError,
  decryptAIRuntimeApiKey,
  encryptAIRuntimeApiKey
} from "@/server/services/admin-ai-runtime/admin-ai-runtime-crypto";

describe("admin ai runtime schema", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts openai chat drafts", () => {
    const parsed = getAIRuntimeDraftSchema("chat").parse({
      provider: "openai",
      enabled: true,
      displayName: "OpenAI Chat",
      apiKey: "sk-openai",
      config: {
        model: "gpt-5",
        baseUrl: "https://api.openai.com/v1"
      }
    });

    expect(parsed.provider).toBe("openai");
  });

  it("accepts openai embedding drafts", () => {
    const parsed = getAIRuntimeDraftSchema("embedding").parse({
      provider: "openai",
      enabled: true,
      displayName: "OpenAI Embeddings",
      apiKey: "sk-openai",
      config: {
        model: "text-embedding-3-large",
        baseUrl: "https://api.openai.com/v1"
      }
    });

    expect(parsed.provider).toBe("openai");
  });

  it("accepts anthropic chat drafts", () => {
    const parsed = getAIRuntimeDraftSchema("chat").parse({
      provider: "anthropic",
      enabled: true,
      displayName: "Anthropic Messages",
      apiKey: "sk-ant",
      config: {
        model: "claude-sonnet-4-5",
        baseUrl: "https://api.anthropic.com",
        anthropicVersion: "2023-06-01"
      }
    });

    expect(parsed.provider).toBe("anthropic");
  });

  it("rejects anthropic embedding drafts", () => {
    expect(() =>
      getAIRuntimeDraftSchema("embedding").parse({
        provider: "anthropic",
        enabled: true,
        displayName: "Anthropic Embeddings",
        apiKey: "sk-ant",
        config: {
          model: "not-supported",
          baseUrl: "https://api.anthropic.com"
        }
      })
    ).toThrow();
  });

  it("accepts volcengine ark chat drafts", () => {
    const parsed = getAIRuntimeDraftSchema("chat").parse({
      provider: "volcengine_ark",
      enabled: true,
      displayName: "Ark Chat",
      apiKey: "ark-key",
      config: {
        endpointId: "ep-123",
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3"
      }
    });

    expect(parsed.provider).toBe("volcengine_ark");
  });

  it("accepts volcengine ark embedding drafts", () => {
    const parsed = getAIRuntimeDraftSchema("embedding").parse({
      provider: "volcengine_ark",
      enabled: true,
      displayName: "Ark Embeddings",
      apiKey: "ark-key",
      config: {
        embeddingEndpointId: "ep-embedding",
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3"
      }
    });

    expect(parsed.provider).toBe("volcengine_ark");
  });

  it("accepts persisted configs without api key input", () => {
    const parsed = getAIRuntimePersistedConfigSchema("chat").parse({
      provider: "openai",
      config: {
        model: "gpt-5",
        baseUrl: "https://api.openai.com/v1"
      }
    });

    expect(parsed.provider).toBe("openai");
  });
});

describe("admin ai runtime crypto", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips encrypted api keys when the secret is configured", () => {
    vi.stubEnv("AI_RUNTIME_CONFIG_SECRET", Buffer.alloc(32, 7).toString("base64"));

    const encrypted = encryptAIRuntimeApiKey("sk-test-secret");

    expect(encrypted.ciphertext).not.toContain("sk-test-secret");
    expect(encrypted.mask).toContain("cret");
    expect(decryptAIRuntimeApiKey(encrypted.ciphertext)).toBe("sk-test-secret");
  });

  it("throws when AI_RUNTIME_CONFIG_SECRET is missing", () => {
    vi.stubEnv("AI_RUNTIME_CONFIG_SECRET", "");

    expect(() => encryptAIRuntimeApiKey("sk-missing-secret")).toThrow(AdminAIRuntimeCryptoError);

    try {
      encryptAIRuntimeApiKey("sk-missing-secret");
    } catch (error) {
      expect(error).toBeInstanceOf(AdminAIRuntimeCryptoError);
      expect((error as AdminAIRuntimeCryptoError).code).toBe("AI_RUNTIME_SECRET_NOT_CONFIGURED");
    }
  });
});
