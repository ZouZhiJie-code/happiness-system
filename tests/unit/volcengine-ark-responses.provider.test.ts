import { afterEach, describe, expect, it, vi } from "vitest";

import { AIProviderError } from "@/server/services/ai/ai-provider";
import { VolcengineArkResponsesProvider } from "@/server/services/ai/volcengine-ark-responses.provider";

describe("VolcengineArkResponsesProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects an invalid base URL before sending a request", () => {
    expect(
      () =>
        new VolcengineArkResponsesProvider({
          apiKey: "test-key",
          endpointId: "ep-judge",
          baseUrl: "file:///tmp/ark"
        })
    ).toThrowError(AIProviderError);

    try {
      new VolcengineArkResponsesProvider({
        apiKey: "test-key",
        endpointId: "ep-judge",
        baseUrl: "file:///tmp/ark"
      });
    } catch (error) {
      expect(error).toMatchObject({ code: "INVALID_BASE_URL" });
    }
  });

  it("passes maxTokens as max_output_tokens and reads only output text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "reasoning",
              content: [{ type: "reasoning_text", text: "内部推理" }]
            },
            {
              type: "message",
              content: [{ type: "output_text", text: "最终评审结果" }]
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new VolcengineArkResponsesProvider({
      apiKey: "test-key",
      endpointId: "ep-judge",
      baseUrl: "https://ark.example.com/api/v3///"
    });
    const result = await provider.complete({
      messages: [{ role: "user", content: "评审这段回答" }],
      maxTokens: 1234
    });

    expect(result).toMatchObject({
      content: "最终评审结果",
      provider: "volcengine-ark-responses"
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://ark.example.com/api/v3/responses");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: "ep-judge",
      max_output_tokens: 1234
    });
  });

  it("reports incomplete max_output_tokens responses as output truncation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "incomplete",
            incomplete_details: { reason: "max_output_tokens" },
            output_text: "未完成的局部结果"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    const provider = new VolcengineArkResponsesProvider({ apiKey: "test-key", endpointId: "ep-judge" });

    await expect(
      provider.complete({ messages: [{ role: "user", content: "测试" }] })
    ).rejects.toMatchObject({
      code: "OUTPUT_TRUNCATED",
      message: "Ark Responses output reached the token limit before completion."
    });
  });

  it("keeps other incomplete responses diagnosable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "incomplete",
            incomplete_details: { reason: "content_filter" }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    const provider = new VolcengineArkResponsesProvider({ apiKey: "test-key", endpointId: "ep-judge" });

    await expect(
      provider.complete({ messages: [{ role: "user", content: "测试" }] })
    ).rejects.toMatchObject({ code: "OUTPUT_INCOMPLETE" });
  });

  it("classifies rate limiting without exposing the upstream error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"error":{"message":"sensitive upstream detail"}}', {
          status: 429,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const provider = new VolcengineArkResponsesProvider({ apiKey: "test-key", endpointId: "ep-judge" });

    await expect(
      provider.complete({ messages: [{ role: "user", content: "测试" }] })
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
      message: "Ark Responses request failed."
    });
  });

  it("classifies server errors as service unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"error":{"message":"sensitive service detail"}}', {
          status: 503,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const provider = new VolcengineArkResponsesProvider({ apiKey: "test-key", endpointId: "ep-judge" });

    await expect(
      provider.complete({ messages: [{ role: "user", content: "测试" }] })
    ).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      status: 503,
      message: "Ark Responses request failed."
    });
  });

  it("keeps other HTTP failures in the upstream error category", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"error":{"message":"sensitive request detail"}}', {
          status: 400,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const provider = new VolcengineArkResponsesProvider({ apiKey: "test-key", endpointId: "ep-judge" });

    await expect(
      provider.complete({ messages: [{ role: "user", content: "测试" }] })
    ).rejects.toMatchObject({
      code: "UPSTREAM_HTTP_ERROR",
      status: 400,
      message: "Ark Responses request failed."
    });
  });

  it("keeps a stable 4xx provider code without exposing other error fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "InvalidParameter.Bad-Request",
              message: "sensitive request detail",
              request_payload: "private content"
            }
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" }
          }
        )
      )
    );

    const provider = new VolcengineArkResponsesProvider({ apiKey: "test-key", endpointId: "ep-judge" });

    await expect(
      provider.complete({ messages: [{ role: "user", content: "测试" }] })
    ).rejects.toMatchObject({
      code: "INVALIDPARAMETER.BAD-REQUEST",
      status: 400,
      message: "Ark Responses request failed."
    });
  });

  it.each([
    ["code containing whitespace", "BAD CODE"],
    ["code containing markup", "<script>"],
    ["overlong code", "A".repeat(81)],
    ["non-string code", 400]
  ])("falls back safely for an invalid 4xx %s", async (_label, invalidCode) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: invalidCode,
              message: "sensitive request detail"
            }
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" }
          }
        )
      )
    );

    const provider = new VolcengineArkResponsesProvider({ apiKey: "test-key", endpointId: "ep-judge" });

    await expect(
      provider.complete({ messages: [{ role: "user", content: "测试" }] })
    ).rejects.toMatchObject({
      code: "UPSTREAM_HTTP_ERROR",
      status: 400,
      message: "Ark Responses request failed."
    });
  });

  it("returns a safe error for malformed response JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private malformed response", { status: 200 })));

    const provider = new VolcengineArkResponsesProvider({ apiKey: "test-key", endpointId: "ep-judge" });

    await expect(
      provider.complete({ messages: [{ role: "user", content: "测试" }] })
    ).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      message: "Ark Responses returned an invalid response."
    });
  });
});
