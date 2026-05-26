import { afterEach, describe, expect, it, vi } from "vitest";

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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();

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

  it("accepts explicit runtime config without reading env defaults", () => {
    const provider = new VolcengineArkProvider({
      apiKey: "test-key",
      modelId: "deepseek-r1-250528",
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3"
    });

    expect(provider.name).toBe("volcengine-ark");
  });

  it("uses the configured embedding endpoint id for embeddings", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ embedding: [0.1, 0.2] }],
          usage: { total_tokens: 9 }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new VolcengineArkProvider({
      apiKey: "test-key",
      modelId: "deepseek-r1-250528",
      embeddingEndpointId: "ep-embedding",
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3"
    });

    const result = await provider.embed({
      input: "需要 embedding 的文本"
    });

    expect(result).toEqual({
      embeddings: [[0.1, 0.2]],
      tokenCount: 9
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://ark.cn-beijing.volces.com/api/v3/embeddings");
  });

  it("falls back to multimodal embeddings when the endpoint only supports the multimodal api", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "InvalidParameter",
              message: "The requested model does not support this api."
            }
          }),
          {
            status: 400,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              embedding: [0.3, 0.4]
            },
            usage: { total_tokens: 12 }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new VolcengineArkProvider({
      apiKey: "test-key",
      embeddingEndpointId: "ep-embedding",
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3"
    });

    const result = await provider.embed({
      input: "需要 embedding 的文本"
    });

    expect(result).toEqual({
      embeddings: [[0.3, 0.4]],
      tokenCount: 12
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://ark.cn-beijing.volces.com/api/v3/embeddings/multimodal");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      model: "ep-embedding",
      input: [
        {
          type: "text",
          text: "需要 embedding 的文本"
        }
      ]
    });
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
