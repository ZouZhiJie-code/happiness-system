import { afterEach, describe, expect, it, vi } from "vitest";

import { AnthropicProvider } from "@/server/services/ai/anthropic.provider";

function createAnthropicEventStream(chunks: string[]) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    }
  });
}

describe("AnthropicProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("supports chat completions through the messages api", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: "你好，Anthropic" }]
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

    const provider = new AnthropicProvider({
      apiKey: "sk-ant",
      model: "claude-sonnet-4-5",
      baseUrl: "https://api.anthropic.com",
      anthropicVersion: "2023-06-01"
    });

    const completion = await provider.complete({
      messages: [
        { role: "system", content: "你是一个中文助手" },
        { role: "user", content: "你好" }
      ],
      maxTokens: 64
    });

    expect(completion.content).toBe("你好，Anthropic");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.anthropic.com/v1/messages");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        "x-api-key": "sk-ant",
        "anthropic-version": "2023-06-01"
      })
    });
  });

  it("streams text deltas from anthropic sse events", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        createAnthropicEventStream([
          "event: content_block_delta\n",
          'data: {"delta":{"type":"text_delta","text":"你"}}\n\n',
          "event: content_block_delta\n",
          'data: {"delta":{"type":"text_delta","text":"好"}}\n\n',
          "event: message_stop\n",
          "data: {}\n\n"
        ]),
        {
          status: 200,
          headers: {
            "content-type": "text/event-stream"
          }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new AnthropicProvider({
      apiKey: "sk-ant",
      model: "claude-sonnet-4-5",
      baseUrl: "https://api.anthropic.com",
      anthropicVersion: "2023-06-01"
    });

    const chunks: string[] = [];
    for await (const chunk of provider.stream({
      messages: [{ role: "user", content: "你好" }]
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["你", "好"]);
  });

  it("rejects embedding requests because anthropic embeddings are unsupported", async () => {
    const provider = new AnthropicProvider({
      apiKey: "sk-ant",
      model: "claude-sonnet-4-5",
      baseUrl: "https://api.anthropic.com",
      anthropicVersion: "2023-06-01"
    });

    await expect(provider.embed({ input: "not supported" })).rejects.toMatchObject({
      code: "UNSUPPORTED_CAPABILITY"
    });
  });
});
