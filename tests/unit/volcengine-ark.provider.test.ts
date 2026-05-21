import { afterEach, describe, expect, it } from "vitest";

import { AIProviderError } from "@/server/services/ai/ai-provider";
import { VolcengineArkProvider } from "@/server/services/ai/volcengine-ark.provider";

const ENV_KEYS = [
  "VOLCENGINE_ARK_API_KEY",
  "ARK_API_KEY",
  "VOLCENGINE_ARK_MODEL",
  "ARK_MODEL",
  "VOLCENGINE_ARK_ENDPOINT_ID",
  "ARK_ENDPOINT_ID",
  "VOLCENGINE_ARK_BASE_URL",
  "ARK_BASE_URL",
  "AI_TIMEOUT_MS"
] as const;

const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

describe("VolcengineArkProvider", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      const original = ORIGINAL_ENV[key];

      if (typeof original === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  });

  it("accepts the quick-start model variable from the Ark chat completions contract", () => {
    process.env.VOLCENGINE_ARK_API_KEY = "test-key";
    process.env.VOLCENGINE_ARK_MODEL = "deepseek-r1-250528";

    const provider = new VolcengineArkProvider();

    expect(provider.name).toBe("volcengine-ark");
  });

  it("keeps backward compatibility with endpoint id variables", () => {
    process.env.VOLCENGINE_ARK_API_KEY = "test-key";
    process.env.VOLCENGINE_ARK_ENDPOINT_ID = "ep-legacy-model";

    const provider = new VolcengineArkProvider();

    expect(provider.name).toBe("volcengine-ark");
  });

  it("throws a missing model error when neither model nor legacy endpoint id is configured", () => {
    process.env.VOLCENGINE_ARK_API_KEY = "test-key";
    delete process.env.VOLCENGINE_ARK_MODEL;
    delete process.env.ARK_MODEL;
    delete process.env.VOLCENGINE_ARK_ENDPOINT_ID;
    delete process.env.ARK_ENDPOINT_ID;

    expect(() => new VolcengineArkProvider()).toThrowError(AIProviderError);

    try {
      new VolcengineArkProvider();
    } catch (error) {
      expect(error).toBeInstanceOf(AIProviderError);
      expect((error as AIProviderError).code).toBe("MISSING_MODEL");
    }
  });
});
