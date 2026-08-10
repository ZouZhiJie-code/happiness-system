import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenAIProvider } from "@/server/services/ai/openai.provider";
import { takeAIReasoningOnlyContinuation } from "@/server/services/ai/ai-provider";

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
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("supports chat completions and embeddings", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "你好，OpenAI" } }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 4,
              total_tokens: 14,
              prompt_cache_hit_tokens: 6,
              prompt_cache_miss_tokens: 4
            }
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
    expect(completion.tokenUsage).toEqual({
      promptTokens: 10,
      completionTokens: 4,
      totalTokens: 14,
      promptCacheHitTokens: 6,
      promptCacheMissTokens: 4
    });
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

  it("uses DeepSeek's thinking control for official API calls", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "预检通过" } }]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "允许思考" } }]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          createSSEStream(['data: {"choices":[{"delta":{"content":"好"}}]}\n\n', "data: [DONE]\n\n"]),
          { status: 200, headers: { "content-type": "text/event-stream" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIProvider({
      apiKey: "sk-deepseek",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com"
    });

    await provider.complete({ messages: [{ role: "user", content: "预检" }] });
    await provider.complete({
      messages: [{ role: "user", content: "需要推理" }],
      thinking: "enabled",
      reasoningEffort: "high"
    });
    const chunks: string[] = [];
    for await (const chunk of provider.stream({
      messages: [{ role: "user", content: "流式预检" }],
      thinking: "enabled",
      reasoningEffort: "high"
    })) {
      chunks.push(chunk);
    }

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      temperature: 0.2,
      thinking: { type: "disabled" }
    });
    const thinkingCompletionBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(thinkingCompletionBody).toMatchObject({
      thinking: { type: "enabled" },
      reasoning_effort: "high"
    });
    expect(Object.hasOwn(thinkingCompletionBody, "temperature")).toBe(false);
    const thinkingStreamBody = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    expect(thinkingStreamBody).toMatchObject({
      stream: true,
      thinking: { type: "enabled" },
      reasoning_effort: "high"
    });
    expect(Object.hasOwn(thinkingStreamBody, "temperature")).toBe(false);
    expect(chunks).toEqual(["好"]);
  });

  it("lets DeepSeek apply its provider output limit when requested", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "完整回答" } }] }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIProvider({
      apiKey: "sk-deepseek",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com"
    });

    await provider.complete({
      messages: [{ role: "user", content: "充分回答" }],
      thinking: "enabled",
      reasoningEffort: "high",
      useProviderDefaultMaxTokens: true
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).not.toHaveProperty("max_tokens");
  });

  it("sends the supported DeepSeek thinking contract to Volcengine Ark", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "deepseek-v4-flash-ga-260731",
          choices: [
            {
              finish_reason: "stop",
              message: {
                content: '{"ok":true}',
                reasoning_content: "hidden reasoning"
              }
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIProvider({
      apiKey: "ark-test-key",
      model: "deepseek-v4-flash-ga-260731",
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3"
    });

    await provider.complete({
      messages: [{ role: "user", content: "返回 JSON" }],
      responseFormat: "json_object",
      thinking: "enabled",
      reasoningEffort: "high",
      useProviderDefaultTemperature: true,
      useProviderDefaultMaxTokens: true
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      model: "deepseek-v4-flash-ga-260731",
      response_format: { type: "json_object" },
      thinking: { type: "enabled" },
      reasoning_effort: "high"
    });
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("max_tokens");
  });

  it("lets the provider apply its default temperature only when explicitly requested", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "完整回答" } }] }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIProvider({
      apiKey: "sk-deepseek",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com"
    });

    await provider.complete({
      messages: [{ role: "user", content: "使用供应商默认温度" }],
      thinking: "disabled",
      useProviderDefaultTemperature: true
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).not.toHaveProperty("temperature");
    await expect(
      provider.complete({
        messages: [{ role: "user", content: "冲突配置" }],
        thinking: "disabled",
        temperature: 0.2,
        useProviderDefaultTemperature: true
      })
    ).rejects.toMatchObject({ code: "INVALID_TEMPERATURE_CONFIG" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects conflicting application and provider max-token settings", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIProvider({
      apiKey: "sk-deepseek",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com"
    });

    await expect(
      provider.complete({
        messages: [{ role: "user", content: "配置预检" }],
        maxTokens: 1600,
        useProviderDefaultMaxTokens: true
      })
    ).rejects.toMatchObject({ code: "INVALID_MAX_TOKENS_CONFIG" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects DeepSeek reasoning effort while thinking is disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIProvider({
      apiKey: "sk-deepseek",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com"
    });

    await expect(
      provider.complete({
        messages: [{ role: "user", content: "配置预检" }],
        thinking: "disabled",
        reasoningEffort: "high"
      })
    ).rejects.toMatchObject({ code: "INVALID_THINKING_CONFIG" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the DeepSeek-only field out of standard OpenAI requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "你好" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIProvider({
      apiKey: "sk-openai",
      model: "gpt-5",
      baseUrl: "https://api.openai.com/v1"
    });

    await provider.complete({
      messages: [{ role: "user", content: "你好" }],
      thinking: "enabled",
      reasoningEffort: "high"
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).not.toHaveProperty("thinking");
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("records only safe DeepSeek diagnostics for a valid response", async () => {
    const hiddenReasoning = "PRIVATE_REASONING_SENTINEL";
    const hiddenHeader = "PRIVATE_HEADER_SENTINEL";
    const visibleContent = '{"ok":true}';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "deepseek-v4-flash",
          choices: [
            {
              finish_reason: "stop",
              message: {
                content: visibleContent,
                reasoning_content: hiddenReasoning
              }
            },
            { message: { content: "unused" } }
          ],
          usage: {
            prompt_tokens: 20,
            completion_tokens: 35,
            total_tokens: 55,
            completion_tokens_details: { reasoning_tokens: 24 }
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "x-request-id": "req-safe-123",
            "x-private-debug": hiddenHeader
          }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIProvider({
      apiKey: "sk-deepseek",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com"
    });

    const completion = await provider.complete({
      messages: [{ role: "user", content: "诊断" }],
      thinking: "enabled",
      reasoningEffort: "high",
      responseFormat: "json_object"
    });

    expect(completion.diagnostics).toMatchObject({
      finishReason: "stop",
      reasoningPresent: true,
      reasoningLength: hiddenReasoning.length,
      reasoningTokens: 24,
      upstreamRequestId: "req-safe-123",
      httpStatus: 200,
      responseModel: "deepseek-v4-flash",
      choiceCount: 2,
      contentType: "string",
      contentLength: visibleContent.length,
      reasoningType: "string",
      timeoutStage: null,
      abortSource: null,
      tokenUsage: {
        promptTokens: 20,
        completionTokens: 35,
        totalTokens: 55
      }
    });
    expect(completion.diagnostics?.headersLatencyMs).toBeTypeOf("number");
    expect(completion.diagnostics?.bodyLatencyMs).toBeTypeOf("number");
    expect(completion.diagnostics?.totalLatencyMs).toBeTypeOf("number");
    expect(completion.latencyMs).toBe(completion.diagnostics?.totalLatencyMs);
    const serializedDiagnostics = JSON.stringify(completion.diagnostics);
    expect(serializedDiagnostics).not.toContain(visibleContent);
    expect(serializedDiagnostics).not.toContain(hiddenReasoning);
    expect(serializedDiagnostics).not.toContain(hiddenHeader);
    expect(JSON.stringify(completion)).not.toContain(hiddenReasoning);
  });

  it("preserves safe diagnostics when DeepSeek returns empty content", async () => {
    const hiddenReasoning = "PRIVATE_EMPTY_REASONING_SENTINEL";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "length",
              message: { content: "", reasoning_content: hiddenReasoning }
            }
          ],
          usage: {
            prompt_tokens: 700,
            completion_tokens: 1600,
            total_tokens: 2300,
            completion_tokens_details: { reasoning_tokens: 1600 }
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIProvider({
      apiKey: "sk-deepseek",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com"
    });

    const error = await provider
      .complete({
        messages: [{ role: "user", content: "诊断" }],
        thinking: "enabled",
        reasoningEffort: "high",
        responseFormat: "json_object",
        maxTokens: 1600
      })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: "EMPTY_CONTENT",
      diagnostics: {
        finishReason: "length",
        reasoningPresent: true,
        reasoningLength: hiddenReasoning.length,
        reasoningTokens: 1600,
        tokenUsage: {
          promptTokens: 700,
          completionTokens: 1600,
          totalTokens: 2300
        }
      }
    });
    expect(JSON.stringify(error)).not.toContain(hiddenReasoning);
  });

  it("distinguishes a stopped empty DeepSeek response from token truncation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: { content: "", reasoning_content: "" }
            }
          ],
          usage: { prompt_tokens: 12, completion_tokens: 0, total_tokens: 12 }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIProvider({
      apiKey: "sk-deepseek",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com"
    });

    const error = await provider
      .complete({ messages: [{ role: "user", content: "诊断" }] })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: "EMPTY_CONTENT",
      diagnostics: {
        finishReason: "stop",
        reasoningPresent: false,
        reasoningLength: 0,
        reasoningTokens: null
      }
    });
  });

  it("bounds unknown DeepSeek diagnostic values", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "vendor_specific",
              message: { content: "ok", reasoning_content: null }
            }
          ],
          usage: {
            prompt_tokens: -1,
            completion_tokens: Number.NaN,
            total_tokens: 4.5,
            completion_tokens_details: { reasoning_tokens: -3 }
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIProvider({
      apiKey: "sk-deepseek",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com"
    });

    const completion = await provider.complete({
      messages: [{ role: "user", content: "诊断" }]
    });

    expect(completion.tokenUsage).toBeNull();
    expect(completion.diagnostics).toMatchObject({
      finishReason: "unknown",
      reasoningPresent: false,
      reasoningLength: 0,
      reasoningTokens: null,
      tokenUsage: null
    });
  });

  it.each([
    {
      label: "null",
      content: null,
      expectedType: "null",
      expectedLength: null,
      expectedContent: null,
      expectedError: "EMPTY_CONTENT"
    },
    {
      label: "string",
      content: "可见正文",
      expectedType: "string",
      expectedLength: 4,
      expectedContent: "可见正文",
      expectedError: null
    },
    {
      label: "array",
      content: [{ text: "可见" }, { text: "正文" }],
      expectedType: "array",
      expectedLength: 4,
      expectedContent: "可见正文",
      expectedError: null
    },
    {
      label: "object",
      content: { text: "未支持的顶层对象" },
      expectedType: "object",
      expectedLength: null,
      expectedContent: null,
      expectedError: "EMPTY_CONTENT"
    }
  ])("records the safe content shape for $label content", async ({
    content,
    expectedType,
    expectedLength,
    expectedContent,
    expectedError
  }) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "deepseek-v4-flash",
          choices: [{ finish_reason: "stop", message: { content } }]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "x-request-id": "req-shape"
          }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIProvider({
      apiKey: "sk-deepseek",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com"
    });

    const outcome = await provider
      .complete({ messages: [{ role: "user", content: "诊断响应形态" }] })
      .then((completion) => ({ completion, error: null }))
      .catch((error: unknown) => ({ completion: null, error }));
    const diagnostics = outcome.completion?.diagnostics ??
      (outcome.error as { diagnostics?: unknown } | null)?.diagnostics;

    if (expectedError) {
      expect(outcome.error).toMatchObject({ code: expectedError });
    } else {
      expect(outcome.error).toBeNull();
      expect(outcome.completion?.content).toBe(expectedContent);
    }
    expect(diagnostics).toMatchObject({
      upstreamRequestId: "req-shape",
      contentType: expectedType,
      contentLength: expectedLength,
      reasoningType: "missing"
    });
  });

  it("identifies a response-header deadline", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        const rejectAbort = () => reject(new DOMException("timed out", "AbortError"));
        if (signal?.aborted) rejectAbort();
        else signal?.addEventListener("abort", rejectAbort, { once: true });
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIProvider({
      apiKey: "sk-deepseek",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com"
    });

    const pending = provider
      .complete({
        messages: [{ role: "user", content: "等待响应头" }],
        headersTimeoutMs: 10,
        bodyIdleTimeoutMs: 100,
        hardTimeoutMs: 100
      })
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(11);

    await expect(pending).resolves.toMatchObject({
      code: "TIMEOUT",
      diagnostics: {
        abortSource: "deadline",
        timeoutStage: "headers",
        httpStatus: null,
        headersLatencyMs: null,
        bodyLatencyMs: null,
        totalLatencyMs: 10
      }
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("identifies an idle response body after headers arrive", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          start() {
            // Keep the body open without producing a chunk.
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "x-request-id": "req-body-idle"
          }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIProvider({
      apiKey: "sk-deepseek",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com"
    });

    const pending = provider
      .complete({
        messages: [{ role: "user", content: "等待正文" }],
        headersTimeoutMs: 100,
        bodyIdleTimeoutMs: 10,
        hardTimeoutMs: 100
      })
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(11);

    await expect(pending).resolves.toMatchObject({
      code: "TIMEOUT",
      diagnostics: {
        abortSource: "deadline",
        timeoutStage: "body",
        upstreamRequestId: "req-body-idle",
        httpStatus: 200,
        bodyLatencyMs: 10,
        totalLatencyMs: 10
      }
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resets the body idle deadline when response chunks keep arriving", async () => {
    vi.useFakeTimers();
    const encoder = new TextEncoder();
    const responseJson = JSON.stringify({
      model: "deepseek-v4-flash",
      choices: [{ message: { content: "持续返回" } }]
    });
    const splitAt = Math.floor(responseJson.length / 2);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(responseJson.slice(0, splitAt)));
            setTimeout(() => {
              controller.enqueue(encoder.encode(responseJson.slice(splitAt)));
            }, 8);
            setTimeout(() => controller.close(), 16);
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIProvider({
      apiKey: "sk-deepseek",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com"
    });

    const pending = provider.complete({
      messages: [{ role: "user", content: "等待持续正文" }],
      headersTimeoutMs: 100,
      bodyIdleTimeoutMs: 10,
      hardTimeoutMs: 100
    });
    await vi.advanceTimersByTimeAsync(17);

    await expect(pending).resolves.toMatchObject({
      content: "持续返回",
      diagnostics: {
        timeoutStage: null,
        abortSource: null,
        contentType: "string",
        contentLength: 4,
        bodyLatencyMs: 16,
        totalLatencyMs: 16
      }
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps timeoutMs as the legacy hard total deadline", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          start() {
            // Headers arrive, then the response remains open past the legacy limit.
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIProvider({
      apiKey: "sk-deepseek",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com"
    });

    const pending = provider
      .complete({
        messages: [{ role: "user", content: "沿用旧总截止" }],
        timeoutMs: 10
      })
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(11);

    await expect(pending).resolves.toMatchObject({
      code: "TIMEOUT",
      diagnostics: {
        abortSource: "deadline",
        timeoutStage: "hard_total",
        totalLatencyMs: 10
      }
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("identifies the hard total deadline independently of body idle", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          start() {
            // Keep the body open so the hard total deadline wins.
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIProvider({
      apiKey: "sk-deepseek",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com"
    });

    const pending = provider
      .complete({
        messages: [{ role: "user", content: "等待总时长门" }],
        headersTimeoutMs: 100,
        bodyIdleTimeoutMs: 100,
        hardTimeoutMs: 10
      })
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(11);

    await expect(pending).resolves.toMatchObject({
      code: "TIMEOUT",
      diagnostics: {
        abortSource: "deadline",
        timeoutStage: "hard_total",
        httpStatus: 200,
        bodyLatencyMs: 10,
        totalLatencyMs: 10
      }
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("forwards caller cancellation to the upstream request", async () => {
    vi.useFakeTimers();
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
      headersTimeoutMs: 100,
      bodyIdleTimeoutMs: 100,
      hardTimeoutMs: 100,
      signal: controller.signal
    });

    controller.abort();

    await expect(completion).rejects.toMatchObject({
      code: "CANCELED",
      diagnostics: {
        abortSource: "caller",
        timeoutStage: null
      }
    });
    expect(upstreamSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(101);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses a one-shot DeepSeek beta Prefix continuation without serializing hidden reasoning", async () => {
    const hiddenReasoning = "PRIVATE_REASONING_SENTINEL_7R1";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          model: "deepseek-v4-flash",
          choices: [{
            finish_reason: "stop",
            message: { content: "", reasoning_content: hiddenReasoning }
          }],
          usage: {
            completion_tokens: 40,
            completion_tokens_details: { reasoning_tokens: 40 }
          }
        }), { status: 200, headers: { "content-type": "application/json" } })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          model: "deepseek-v4-flash",
          choices: [{
            finish_reason: "stop",
            message: { content: '"ok":true}', reasoning_content: null }
          }],
          usage: { completion_tokens: 4 }
        }), { status: 200, headers: { "content-type": "application/json" } })
      );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIProvider({
      apiKey: "sk-deepseek",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com"
    });
    let firstError: unknown;
    try {
      await provider.complete({
        messages: [{ role: "user", content: "只输出 JSON" }],
        thinking: "enabled",
        reasoningEffort: "high",
        responseFormat: "json_object",
        useProviderDefaultMaxTokens: true,
        hardTimeoutMs: 60_000,
        reasoningOnlyContinuation: {
          mode: "deepseek_chat_prefix_beta",
          visiblePrefix: "{",
          sharedHardTimeoutMs: 60_000
        }
      });
    } catch (error) {
      firstError = error;
    }
    expect(firstError).toMatchObject({
      code: "EMPTY_CONTENT",
      diagnostics: {
        finishReason: "stop",
        reasoningPresent: true,
        reasoningLength: hiddenReasoning.length,
        contentLength: 0
      }
    });
    expect(JSON.stringify(firstError)).not.toContain(hiddenReasoning);
    const continuation = takeAIReasoningOnlyContinuation(firstError);
    expect(continuation?.kind).toBe("deepseek_chat_prefix_beta");
    expect(JSON.stringify(continuation)).not.toContain(hiddenReasoning);
    await expect(continuation!.consume()).resolves.toMatchObject({
      content: '{"ok":true}',
      provider: "openai"
    });
    await expect(continuation!.consume()).rejects.toMatchObject({
      code: "REASONING_CONTINUATION_ALREADY_CONSUMED"
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![0]).toBe(
      "https://api.deepseek.com/beta/chat/completions"
    );
    const prefixBody = JSON.parse(String(fetchMock.mock.calls[1]![1]?.body));
    expect(prefixBody).toMatchObject({
      model: "deepseek-v4-flash",
      response_format: { type: "json_object" },
      thinking: { type: "enabled" },
      reasoning_effort: "high"
    });
    expect(prefixBody.messages.at(-1)).toEqual({
      role: "assistant",
      content: "{",
      reasoning_content: hiddenReasoning,
      prefix: true
    });
  });

  it("does not start Prefix after the shared 60 second deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T00:00:00.000Z"));
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{
          finish_reason: "stop",
          message: { content: "", reasoning_content: "hidden" }
        }]
      }), { status: 200, headers: { "content-type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIProvider({
      apiKey: "sk-deepseek",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com"
    });
    const firstError = await provider.complete({
      messages: [{ role: "user", content: "只输出 JSON" }],
      thinking: "enabled",
      reasoningEffort: "high",
      responseFormat: "json_object",
      hardTimeoutMs: 60_000,
      reasoningOnlyContinuation: {
        mode: "deepseek_chat_prefix_beta",
        visiblePrefix: "{",
        sharedHardTimeoutMs: 60_000
      }
    }).catch((error: unknown) => error);
    const continuation = takeAIReasoningOnlyContinuation(firstError);
    vi.setSystemTime(new Date("2026-08-10T00:01:00.001Z"));
    await expect(continuation!.consume()).rejects.toMatchObject({
      code: "TIMEOUT",
      diagnostics: {
        timeoutStage: "hard_total",
        abortSource: "deadline"
      }
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
