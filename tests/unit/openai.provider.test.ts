import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenAIProvider } from "@/server/services/ai/openai.provider";

function createSSEStream(chunks: string[]) {
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

describe("OpenAIProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("supports chat completions and embeddings", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "你好，OpenAI" } }]
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ embedding: [0.1, 0.2, 0.3] }],
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

    const provider = new OpenAIProvider({
      apiKey: "sk-openai",
      model: "gpt-5",
      baseUrl: "https://api.openai.com/v1"
    });

    const completion = await provider.complete({
      messages: [{ role: "user", content: "你好" }],
      temperature: 0.1,
      maxTokens: 32
    });
    const embeddings = await provider.embed({
      input: "一段需要 embedding 的文本"
    });

    expect(completion.content).toBe("你好，OpenAI");
    expect(embeddings).toEqual({
      embeddings: [[0.1, 0.2, 0.3]],
      tokenCount: 12
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/chat/completions");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.openai.com/v1/embeddings");
  });

  it("streams chat completion deltas", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        createSSEStream([
          'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
          "data: [DONE]\n\n"
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

    const provider = new OpenAIProvider({
      apiKey: "sk-openai",
      model: "gpt-5",
      baseUrl: "https://api.openai.com/v1"
    });

    const chunks: string[] = [];
    for await (const chunk of provider.stream({
      messages: [{ role: "user", content: "你好" }]
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["你", "好"]);
  });

  it("forwards caller cancellation to the upstream request", async () => {
    let upstreamSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      upstreamSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        upstreamSignal?.addEventListener(
          "abort",
          () => reject(new DOMException("The request was canceled.", "AbortError")),
          { once: true }
        );
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIProvider({
      apiKey: "sk-openai",
      model: "gpt-5",
      baseUrl: "https://api.openai.com/v1"
    });
    const controller = new AbortController();
    const completion = provider.complete({
      messages: [{ role: "user", content: "你好" }],
      signal: controller.signal
    });

    controller.abort();

    await expect(completion).rejects.toMatchObject({ code: "CANCELED" });
    expect(upstreamSignal?.aborted).toBe(true);
  });
});
