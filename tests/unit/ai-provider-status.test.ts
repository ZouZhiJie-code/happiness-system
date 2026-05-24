import { afterEach, describe, expect, it, vi } from "vitest";

import { getAIProviderStatus } from "@/server/services/ai";

const ENV_KEYS = [
  "AI_PROVIDER",
  "VOLCENGINE_ARK_API_KEY",
  "ARK_API_KEY",
  "VOLCENGINE_ARK_MODEL",
  "ARK_MODEL",
  "VOLCENGINE_ARK_ENDPOINT_ID",
  "ARK_ENDPOINT_ID",
  "VOLCENGINE_ARK_BASE_URL",
  "ARK_BASE_URL"
] as const;

const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

describe("getAIProviderStatus", () => {
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

  it("flags placeholder-shaped production values as config invalid", () => {
    vi.stubEnv("AI_PROVIDER", "volcengine-ark");
    vi.stubEnv("VOLCENGINE_ARK_API_KEY", "$VOLCENGINE_ARK_API_KEY\\n");
    vi.stubEnv("VOLCENGINE_ARK_ENDPOINT_ID", "ep-20260524-realish");
    vi.stubEnv("VOLCENGINE_ARK_BASE_URL", "$VOLCENGINE_ARK_BASE_URL\\n");

    const status = getAIProviderStatus();

    expect(status).toMatchObject({
      available: false,
      state: "config_invalid",
      code: "PLACEHOLDER_API_KEY",
      issues: ["PLACEHOLDER_API_KEY", "PLACEHOLDER_BASE_URL"]
    });
  });

  it("treats endpoint id fallback plus a normal base url as ready", () => {
    vi.stubEnv("AI_PROVIDER", "volcengine-ark");
    vi.stubEnv("VOLCENGINE_ARK_API_KEY", "ark-live-key");
    vi.stubEnv("VOLCENGINE_ARK_ENDPOINT_ID", "ep-20260524-realish");
    vi.stubEnv("VOLCENGINE_ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3");

    const status = getAIProviderStatus();

    expect(status).toMatchObject({
      available: true,
      state: "ready",
      code: "READY",
      issues: [],
      configSummary: {
        hasApiKey: true,
        hasModel: true,
        hasBaseUrl: true,
        modelSource: "VOLCENGINE_ARK_ENDPOINT_ID",
        baseUrlHost: "ark.cn-beijing.volces.com"
      }
    });
  });
});
