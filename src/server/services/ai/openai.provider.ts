import {
  AIProviderError,
  attachAIReasoningOnlyContinuation,
  isAbortError,
  sanitizeAIProviderDiagnostics,
  type AICompletionParams,
  type AICompletionResult,
  type AICompletionTokenUsage,
  type AIProviderAbortSource,
  type AIProviderDiagnostics,
  type AIProviderFinishReason,
  type AIProviderTimeoutStage,
  type AIProviderValueType,
  type AIEmbeddingParams,
  type AIEmbeddingResult,
  type AIProvider
} from "@/server/services/ai/ai-provider";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_TIMEOUT_MS = 20_000;

export interface OpenAIProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
}

function extractMessageContent(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
          return item.text;
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

function readCompletionTokenUsage(value: unknown): AICompletionTokenUsage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const usage = value as Record<string, unknown>;
  const numeric = (candidate: unknown) => {
    return typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 0
      ? candidate
      : undefined;
  };
  const result: AICompletionTokenUsage = {
    promptTokens: numeric(usage.prompt_tokens),
    completionTokens: numeric(usage.completion_tokens),
    totalTokens: numeric(usage.total_tokens),
    promptCacheHitTokens: numeric(usage.prompt_cache_hit_tokens),
    promptCacheMissTokens: numeric(usage.prompt_cache_miss_tokens)
  };
  return Object.values(result).some((item) => item !== undefined) ? result : null;
}

function readFinishReason(value: unknown): AIProviderFinishReason {
  if (value === null) return null;
  return value === "stop" ||
    value === "length" ||
    value === "content_filter" ||
    value === "tool_calls"
    ? value
    : "unknown";
}

function readProviderValueType(value: unknown): AIProviderValueType {
  if (value === undefined) return "missing";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object") return "object";
  return "unknown";
}

function readUpstreamRequestId(response: Response | null) {
  if (!response) return null;
  return response.headers.get("x-request-id") ??
    response.headers.get("request-id") ??
    response.headers.get("x-ds-request-id");
}

function readCompletionDiagnostics(input: {
  response: Response | null;
  payloadObserved: boolean;
  responseModel: unknown;
  choiceCount: number | null;
  finishReason: unknown;
  contentValue: unknown;
  contentLength: number | null;
  reasoningContent: unknown;
  headersLatencyMs: number | null;
  firstTokenLatencyMs?: number | null;
  bodyLatencyMs: number | null;
  totalLatencyMs: number;
  usage: unknown;
  timeoutStage?: AIProviderTimeoutStage;
  abortSource?: AIProviderAbortSource;
}): AIProviderDiagnostics {
  const reasoningType = input.payloadObserved
    ? readProviderValueType(input.reasoningContent)
    : null;
  const reasoningLength = reasoningType === "string"
    ? (input.reasoningContent as string).length
    : reasoningType === "missing" || reasoningType === "null"
      ? 0
      : null;
  const reasoningPresent = reasoningType === "string"
    ? (reasoningLength ?? 0) > 0
    : reasoningType === "missing" || reasoningType === "null"
      ? false
      : null;
  const usage =
    input.usage && typeof input.usage === "object" && !Array.isArray(input.usage)
      ? (input.usage as Record<string, unknown>)
      : null;
  const completionDetails =
    usage?.completion_tokens_details &&
    typeof usage.completion_tokens_details === "object" &&
    !Array.isArray(usage.completion_tokens_details)
      ? (usage.completion_tokens_details as Record<string, unknown>)
      : null;
  const reasoningTokens = completionDetails?.reasoning_tokens;
  return {
    finishReason: input.payloadObserved ? readFinishReason(input.finishReason) : null,
    reasoningPresent: input.payloadObserved ? reasoningPresent : null,
    reasoningLength: input.payloadObserved ? reasoningLength : null,
    reasoningTokens:
      typeof reasoningTokens === "number" &&
      Number.isInteger(reasoningTokens) &&
      reasoningTokens >= 0
        ? reasoningTokens
        : null,
    latencyMs: input.totalLatencyMs,
    tokenUsage: readCompletionTokenUsage(input.usage),
    upstreamRequestId: readUpstreamRequestId(input.response),
    httpStatus: input.response?.status ?? null,
    responseModel: typeof input.responseModel === "string" ? input.responseModel : null,
    choiceCount: input.choiceCount,
    contentType: input.payloadObserved ? readProviderValueType(input.contentValue) : null,
    contentLength: input.payloadObserved ? input.contentLength : null,
    reasoningType,
    headersLatencyMs: input.headersLatencyMs,
    firstTokenLatencyMs: input.firstTokenLatencyMs ?? null,
    bodyLatencyMs: input.bodyLatencyMs,
    totalLatencyMs: input.totalLatencyMs,
    timeoutStage: input.timeoutStage ?? null,
    abortSource: input.abortSource ?? null
  };
}

function positiveTimeout(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.max(1, Math.floor(value))
    : fallback;
}

function createCompletionAbortScope(input: {
  externalSignal?: AbortSignal;
  headersTimeoutMs: number;
  bodyIdleTimeoutMs: number;
  hardTimeoutMs: number;
}) {
  const controller = new AbortController();
  let abortSource: AIProviderAbortSource = null;
  let timeoutStage: AIProviderTimeoutStage = null;
  let headersTimer: ReturnType<typeof setTimeout> | null = null;
  let bodyTimer: ReturnType<typeof setTimeout> | null = null;
  let hardTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = (timer: ReturnType<typeof setTimeout> | null) => {
    if (timer !== null) clearTimeout(timer);
  };
  const abort = (source: Exclude<AIProviderAbortSource, null>, stage: AIProviderTimeoutStage) => {
    if (controller.signal.aborted) return;
    abortSource = source;
    timeoutStage = stage;
    controller.abort(new DOMException(
      source === "caller" ? "The request was canceled." : "The request timed out.",
      "AbortError"
    ));
  };
  const abortFromCaller = () => abort("caller", null);
  const armBodyTimer = () => {
    clearTimer(bodyTimer);
    if (controller.signal.aborted) return;
    bodyTimer = setTimeout(() => abort("deadline", "body"), input.bodyIdleTimeoutMs);
  };

  if (input.externalSignal?.aborted) {
    abortFromCaller();
  } else {
    input.externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
    headersTimer = setTimeout(
      () => abort("deadline", "headers"),
      input.headersTimeoutMs
    );
    hardTimer = setTimeout(
      () => abort("deadline", "hard_total"),
      input.hardTimeoutMs
    );
  }

  return {
    signal: controller.signal,
    markHeadersReceived: () => {
      clearTimer(headersTimer);
      headersTimer = null;
      armBodyTimer();
    },
    markBodyProgress: armBodyTimer,
    markBodyComplete: () => {
      clearTimer(bodyTimer);
      bodyTimer = null;
    },
    abortSource: () => abortSource,
    timeoutStage: () => timeoutStage,
    cleanup: () => {
      clearTimer(headersTimer);
      clearTimer(bodyTimer);
      clearTimer(hardTimer);
      input.externalSignal?.removeEventListener("abort", abortFromCaller);
    }
  };
}

function abortError() {
  return new DOMException("The request was aborted.", "AbortError");
}

function readWithAbort<T>(operation: () => Promise<T>, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    let promise: Promise<T>;
    try {
      promise = operation();
    } catch (error) {
      cleanup();
      reject(error);
      return;
    }
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      }
    );
  });
}

async function readResponseBody(
  response: Response,
  abortScope: ReturnType<typeof createCompletionAbortScope>
) {
  if (!response.body) {
    abortScope.markBodyComplete();
    return "";
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = "";
  try {
    while (true) {
      const { done, value } = await readWithAbort(() => reader.read(), abortScope.signal);
      if (done) {
        body += decoder.decode();
        abortScope.markBodyComplete();
        return body;
      }
      if (value && value.byteLength > 0) {
        abortScope.markBodyProgress();
        body += decoder.decode(value, { stream: true });
      }
    }
  } catch (error) {
    if (abortScope.signal.aborted) {
      try {
        void reader.cancel().catch(() => undefined);
      } catch {
        // The upstream abort may already have released the reader lock.
      }
    }
    throw error;
  }
}

function assertConfiguredString(value: string | undefined, errorCode: string, errorMessage: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new AIProviderError(errorMessage, errorCode);
  }

  return trimmed;
}

function assertValidBaseUrl(value: string | undefined) {
  const baseUrl = value?.trim() || DEFAULT_BASE_URL;

  try {
    const parsed = new URL(baseUrl);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("invalid protocol");
    }

    return baseUrl;
  } catch {
    throw new AIProviderError("OpenAI base URL is invalid.", "INVALID_BASE_URL");
  }
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";

  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly isDeepSeekOfficialApi: boolean;
  private readonly supportsDeepSeekThinkingPayload: boolean;

  constructor(config: OpenAIProviderConfig) {
    this.apiKey = assertConfiguredString(config.apiKey, "MISSING_API_KEY", "Missing OpenAI API key.");
    this.model = assertConfiguredString(config.model, "MISSING_MODEL", "Missing OpenAI model.");
    this.baseUrl = assertValidBaseUrl(config.baseUrl);
    this.timeoutMs = config.timeoutMs ?? Number(process.env.AI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
    const baseUrlHost = new URL(this.baseUrl).hostname.toLowerCase();
    this.isDeepSeekOfficialApi = baseUrlHost === "api.deepseek.com";
    this.supportsDeepSeekThinkingPayload =
      this.isDeepSeekOfficialApi || baseUrlHost === "ark.cn-beijing.volces.com";
  }

  private buildThinkingPayload(
    thinking: AICompletionParams["thinking"],
    reasoningEffort: AICompletionParams["reasoningEffort"]
  ) {
    if (!this.supportsDeepSeekThinkingPayload) {
      return {};
    }

    const type = thinking ?? "disabled";
    if (reasoningEffort && type !== "enabled") {
      throw new AIProviderError(
        "Reasoning effort requires thinking mode to be enabled.",
        "INVALID_THINKING_CONFIG"
      );
    }

    return {
      thinking: {
        type
      },
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {})
    };
  }

  private buildTemperaturePayload(
    temperature: AICompletionParams["temperature"],
    thinking: AICompletionParams["thinking"],
    useProviderDefaultTemperature: AICompletionParams["useProviderDefaultTemperature"]
  ) {
    if (useProviderDefaultTemperature) {
      if (temperature !== undefined) {
        throw new AIProviderError(
          "Provider-default temperature cannot be combined with an application temperature value.",
          "INVALID_TEMPERATURE_CONFIG"
        );
      }
      return {};
    }

    if (
      this.supportsDeepSeekThinkingPayload &&
      thinking === "enabled" &&
      temperature === undefined
    ) {
      return {};
    }

    return { temperature: temperature ?? 0.2 };
  }

  private buildMaxTokensPayload(
    maxTokens: AICompletionParams["maxTokens"],
    useProviderDefaultMaxTokens: AICompletionParams["useProviderDefaultMaxTokens"]
  ) {
    if (useProviderDefaultMaxTokens) {
      if (maxTokens !== undefined) {
        throw new AIProviderError(
          "Provider-default max tokens cannot be combined with an application max token value.",
          "INVALID_MAX_TOKENS_CONFIG"
        );
      }
      return {};
    }

    return { max_tokens: maxTokens ?? 600 };
  }

  private async completeDeepSeekPrefix(input: {
    params: AICompletionParams;
    reasoningContent: string;
    visiblePrefix: "{";
    sharedDeadlineAt: number;
  }): Promise<AICompletionResult> {
    const remainingMs = input.sharedDeadlineAt - Date.now();
    if (remainingMs <= 0) {
      throw new AIProviderError(
        "Shared completion deadline was exhausted before prefix continuation.",
        "TIMEOUT",
        undefined,
        {
          finishReason: null,
          reasoningPresent: null,
          reasoningLength: null,
          reasoningTokens: null,
          latencyMs: 0,
          tokenUsage: null,
          totalLatencyMs: 0,
          timeoutStage: "hard_total",
          abortSource: "deadline"
        }
      );
    }
    const params = input.params;
    const startedAt = Date.now();
    const abortScope = createCompletionAbortScope({
      externalSignal: params.signal,
      headersTimeoutMs: Math.min(
        positiveTimeout(params.headersTimeoutMs, remainingMs),
        remainingMs
      ),
      bodyIdleTimeoutMs: Math.min(
        positiveTimeout(params.bodyIdleTimeoutMs, remainingMs),
        remainingMs
      ),
      hardTimeoutMs: remainingMs
    });
    let response: Response | null = null;
    let headersReceivedAt: number | null = null;
    let bodyCompletedAt: number | null = null;
    let payloadObserved = false;
    let responseModel: unknown;
    let choiceCount: number | null = null;
    let finishReason: unknown;
    let contentValue: unknown;
    let contentLength: number | null = null;
    let reasoningContent: unknown;
    let usage: unknown;
    const currentDiagnostics = () => {
      const completedAt = Date.now();
      return sanitizeAIProviderDiagnostics(readCompletionDiagnostics({
        response,
        payloadObserved,
        responseModel,
        choiceCount,
        finishReason,
        contentValue,
        contentLength,
        reasoningContent,
        headersLatencyMs:
          headersReceivedAt === null ? null : Math.max(0, headersReceivedAt - startedAt),
        bodyLatencyMs:
          headersReceivedAt === null
            ? null
            : Math.max(0, (bodyCompletedAt ?? completedAt) - headersReceivedAt),
        totalLatencyMs: Math.max(0, completedAt - startedAt),
        usage,
        timeoutStage: abortScope.timeoutStage(),
        abortSource: abortScope.abortSource()
      }))!;
    };

    try {
      response = await fetch(
        `${new URL(this.baseUrl).origin}/beta/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              ...params.messages,
              {
                role: "assistant",
                content: input.visiblePrefix,
                reasoning_content: input.reasoningContent,
                prefix: true
              }
            ],
            ...this.buildTemperaturePayload(
              params.temperature,
              params.thinking,
              params.useProviderDefaultTemperature
            ),
            ...this.buildMaxTokensPayload(
              params.maxTokens,
              params.useProviderDefaultMaxTokens
            ),
            ...(params.responseFormat === "json_object"
              ? { response_format: { type: "json_object" } }
              : {}),
            ...this.buildThinkingPayload(params.thinking, params.reasoningEffort)
          }),
          cache: "no-store",
          signal: abortScope.signal
        }
      );
      headersReceivedAt = Date.now();
      abortScope.markHeadersReceived();
      const bodyText = await readResponseBody(response, abortScope);
      bodyCompletedAt = Date.now();
      if (!response.ok) {
        throw new AIProviderError(
          bodyText || "AI prefix continuation failed.",
          "UPSTREAM_HTTP_ERROR",
          response.status,
          currentDiagnostics()
        );
      }
      let parsedPayload: unknown;
      try {
        parsedPayload = JSON.parse(bodyText);
      } catch (error) {
        throw new AIProviderError(
          error instanceof Error ? error.message : "AI response JSON is invalid.",
          "REQUEST_FAILED",
          undefined,
          currentDiagnostics()
        );
      }
      const payload = parsedPayload && typeof parsedPayload === "object" && !Array.isArray(parsedPayload)
        ? parsedPayload as {
            model?: unknown;
            choices?: Array<{
              finish_reason?: unknown;
              message?: { content?: unknown; reasoning_content?: unknown };
            }>;
            usage?: unknown;
          }
        : {};
      payloadObserved = true;
      responseModel = payload.model;
      choiceCount = Array.isArray(payload.choices) ? payload.choices.length : null;
      const choice = Array.isArray(payload.choices) ? payload.choices[0] : undefined;
      finishReason = choice?.finish_reason;
      contentValue = choice?.message?.content;
      reasoningContent = choice?.message?.reasoning_content;
      usage = payload.usage;
      const rawContent = extractMessageContent(contentValue);
      const contentType = readProviderValueType(contentValue);
      contentLength = contentType === "string" || contentType === "array"
        ? rawContent.length
        : null;
      const diagnostics = currentDiagnostics();
      if (!rawContent) {
        throw new AIProviderError(
          "Model returned empty content after prefix continuation.",
          "EMPTY_CONTENT",
          undefined,
          diagnostics
        );
      }
      let content = rawContent;
      try {
        JSON.parse(rawContent);
      } catch {
        const withPrefix = `${input.visiblePrefix}${rawContent}`;
        try {
          JSON.parse(withPrefix);
          content = withPrefix;
        } catch {
          content = rawContent;
        }
      }
      return {
        content,
        latencyMs: diagnostics.totalLatencyMs ?? diagnostics.latencyMs ?? 0,
        provider: this.name,
        tokenUsage: readCompletionTokenUsage(usage),
        diagnostics
      };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      const source = abortScope.abortSource();
      if (source === "caller") {
        throw new AIProviderError("AI request canceled.", "CANCELED", undefined, currentDiagnostics());
      }
      if (source === "deadline") {
        throw new AIProviderError("AI request timed out.", "TIMEOUT", undefined, currentDiagnostics());
      }
      throw new AIProviderError(
        error instanceof Error ? error.message : "Unknown AI provider error.",
        "REQUEST_FAILED",
        undefined,
        currentDiagnostics()
      );
    } finally {
      abortScope.cleanup();
    }
  }

  async runSyntheticDeepSeekPrefixProbe(input: {
    messages: AICompletionParams["messages"];
    reasoningContent: string;
    visiblePrefix?: "{";
    sharedHardTimeoutMs?: number;
  }) {
    if (!this.isDeepSeekOfficialApi || !input.reasoningContent.trim()) {
      throw new AIProviderError(
        "Synthetic prefix probe requires the official DeepSeek API and non-empty synthetic reasoning.",
        "PREFIX_PROBE_CONFIG_INVALID"
      );
    }
    const startedAt = Date.now();
    const sharedHardTimeoutMs = positiveTimeout(
      input.sharedHardTimeoutMs,
      60_000
    );
    return this.completeDeepSeekPrefix({
      params: {
        messages: input.messages,
        useProviderDefaultTemperature: true,
        useProviderDefaultMaxTokens: true,
        headersTimeoutMs: 15_000,
        bodyIdleTimeoutMs: 45_000,
        hardTimeoutMs: sharedHardTimeoutMs,
        responseFormat: "json_object",
        thinking: "enabled",
        reasoningEffort: "high"
      },
      reasoningContent: input.reasoningContent,
      visiblePrefix: input.visiblePrefix ?? "{",
      sharedDeadlineAt: startedAt + sharedHardTimeoutMs
    });
  }

  async complete({
    messages,
    temperature,
    useProviderDefaultTemperature,
    maxTokens,
    useProviderDefaultMaxTokens,
    timeoutMs,
    headersTimeoutMs,
    bodyIdleTimeoutMs,
    hardTimeoutMs,
    responseFormat,
    thinking,
    reasoningEffort,
    reasoningOnlyContinuation,
    signal
  }: AICompletionParams) {
    const originalParams: AICompletionParams = {
      messages,
      temperature,
      useProviderDefaultTemperature,
      maxTokens,
      useProviderDefaultMaxTokens,
      timeoutMs,
      headersTimeoutMs,
      bodyIdleTimeoutMs,
      hardTimeoutMs,
      responseFormat,
      thinking,
      reasoningEffort,
      reasoningOnlyContinuation,
      signal
    };
    const startedAt = Date.now();
    const legacyTimeoutMs = positiveTimeout(timeoutMs, this.timeoutMs);
    const effectiveHardTimeoutMs = positiveTimeout(hardTimeoutMs, legacyTimeoutMs);
    const abortScope = createCompletionAbortScope({
      externalSignal: signal,
      headersTimeoutMs: positiveTimeout(headersTimeoutMs, effectiveHardTimeoutMs),
      bodyIdleTimeoutMs: positiveTimeout(bodyIdleTimeoutMs, effectiveHardTimeoutMs),
      hardTimeoutMs: effectiveHardTimeoutMs
    });
    let response: Response | null = null;
    let headersReceivedAt: number | null = null;
    let bodyCompletedAt: number | null = null;
    let payloadObserved = false;
    let responseModel: unknown;
    let choiceCount: number | null = null;
    let finishReason: unknown;
    let contentValue: unknown;
    let contentLength: number | null = null;
    let reasoningContent: unknown;
    let usage: unknown;
    const currentDiagnostics = () => {
      const completedAt = Date.now();
      return sanitizeAIProviderDiagnostics(readCompletionDiagnostics({
        response,
        payloadObserved,
        responseModel,
        choiceCount,
        finishReason,
        contentValue,
        contentLength,
        reasoningContent,
        headersLatencyMs:
          headersReceivedAt === null ? null : Math.max(0, headersReceivedAt - startedAt),
        bodyLatencyMs:
          headersReceivedAt === null
            ? null
            : Math.max(0, (bodyCompletedAt ?? completedAt) - headersReceivedAt),
        totalLatencyMs: Math.max(0, completedAt - startedAt),
        usage,
        timeoutStage: abortScope.timeoutStage(),
        abortSource: abortScope.abortSource()
      }))!;
    };

    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          ...this.buildTemperaturePayload(
            temperature,
            thinking,
            useProviderDefaultTemperature
          ),
          ...this.buildMaxTokensPayload(maxTokens, useProviderDefaultMaxTokens),
          ...(responseFormat === "json_object"
            ? { response_format: { type: "json_object" } }
            : {}),
          ...this.buildThinkingPayload(thinking, reasoningEffort)
        }),
        cache: "no-store",
        signal: abortScope.signal
      });
      headersReceivedAt = Date.now();
      abortScope.markHeadersReceived();
      const bodyText = await readResponseBody(response, abortScope);
      bodyCompletedAt = Date.now();

      if (!response.ok) {
        throw new AIProviderError(
          bodyText || "AI request failed.",
          "UPSTREAM_HTTP_ERROR",
          response.status,
          currentDiagnostics()
        );
      }

      let parsedPayload: unknown;
      try {
        parsedPayload = JSON.parse(bodyText);
      } catch (error) {
        throw new AIProviderError(
          error instanceof Error ? error.message : "AI response JSON is invalid.",
          "REQUEST_FAILED",
          undefined,
          currentDiagnostics()
        );
      }
      const payload = parsedPayload && typeof parsedPayload === "object" && !Array.isArray(parsedPayload)
        ? parsedPayload as {
            model?: unknown;
            choices?: Array<{
              finish_reason?: unknown;
              message?: {
                content?: unknown;
                reasoning_content?: unknown;
              };
            }>;
            usage?: unknown;
          }
        : {};
      payloadObserved = true;
      responseModel = payload.model;
      choiceCount = Array.isArray(payload.choices) ? payload.choices.length : null;
      const choice = Array.isArray(payload.choices) ? payload.choices[0] : undefined;
      finishReason = choice?.finish_reason;
      contentValue = choice?.message?.content;
      reasoningContent = choice?.message?.reasoning_content;
      usage = payload.usage;
      const content = extractMessageContent(contentValue);
      const contentType = readProviderValueType(contentValue);
      contentLength = contentType === "string" || contentType === "array"
        ? content.length
        : null;
      const tokenUsage = readCompletionTokenUsage(usage);
      const diagnostics = currentDiagnostics();

      if (!content) {
        const providerError = new AIProviderError(
          "Model returned empty content.",
          "EMPTY_CONTENT",
          undefined,
          diagnostics
        );
        if (
          this.isDeepSeekOfficialApi &&
          reasoningOnlyContinuation?.mode === "deepseek_chat_prefix_beta" &&
          finishReason === "stop" &&
          typeof reasoningContent === "string" &&
          reasoningContent.length > 0 &&
          contentLength === 0
        ) {
          let hiddenReasoning: string | null = reasoningContent;
          let consumed = false;
          const sharedDeadlineAt =
            startedAt + positiveTimeout(
              reasoningOnlyContinuation.sharedHardTimeoutMs,
              effectiveHardTimeoutMs
            );
          throw attachAIReasoningOnlyContinuation(providerError, {
            kind: "deepseek_chat_prefix_beta",
            consume: async () => {
              if (consumed || hiddenReasoning === null) {
                throw new AIProviderError(
                  "Reasoning continuation was already consumed.",
                  "REASONING_CONTINUATION_ALREADY_CONSUMED"
                );
              }
              consumed = true;
              const transientReasoning = hiddenReasoning;
              hiddenReasoning = null;
              return this.completeDeepSeekPrefix({
                params: {
                  ...originalParams,
                  reasoningOnlyContinuation: undefined
                },
                reasoningContent: transientReasoning,
                visiblePrefix: reasoningOnlyContinuation.visiblePrefix,
                sharedDeadlineAt
              });
            },
            dispose: () => {
              consumed = true;
              hiddenReasoning = null;
            }
          });
        }
        throw providerError;
      }

      return {
        content,
        latencyMs: diagnostics.totalLatencyMs ?? diagnostics.latencyMs ?? 0,
        provider: this.name,
        tokenUsage,
        diagnostics
      };
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }

      const source = abortScope.abortSource();
      if (source === "caller") {
        throw new AIProviderError(
          "AI request canceled.",
          "CANCELED",
          undefined,
          currentDiagnostics()
        );
      }
      if (source === "deadline") {
        throw new AIProviderError(
          "AI request timed out.",
          "TIMEOUT",
          undefined,
          currentDiagnostics()
        );
      }
      if (isAbortError(error)) {
        throw new AIProviderError(
          "AI request was aborted upstream.",
          "REQUEST_FAILED",
          undefined,
          currentDiagnostics()
        );
      }

      throw new AIProviderError(
        error instanceof Error ? error.message : "Unknown AI provider error.",
        "REQUEST_FAILED",
        undefined,
        currentDiagnostics()
      );
    } finally {
      abortScope.cleanup();
    }
  }

  async *stream({
    messages,
    temperature,
    useProviderDefaultTemperature,
    maxTokens = 180,
    timeoutMs,
    headersTimeoutMs,
    bodyIdleTimeoutMs,
    hardTimeoutMs,
    thinking,
    reasoningEffort,
    onStreamDiagnostics,
    signal
  }: AICompletionParams): AsyncIterable<string> {
    const startedAt = Date.now();
    const legacyTimeoutMs = positiveTimeout(timeoutMs, this.timeoutMs);
    const effectiveHardTimeoutMs = positiveTimeout(hardTimeoutMs, legacyTimeoutMs);
    const abortScope = createCompletionAbortScope({
      externalSignal: signal,
      headersTimeoutMs: positiveTimeout(headersTimeoutMs, effectiveHardTimeoutMs),
      bodyIdleTimeoutMs: positiveTimeout(bodyIdleTimeoutMs, effectiveHardTimeoutMs),
      hardTimeoutMs: effectiveHardTimeoutMs
    });
    let response: Response | null = null;
    let headersReceivedAt: number | null = null;
    let firstTokenAt: number | null = null;
    let bodyCompletedAt: number | null = null;
    let responseModel: unknown;
    let finishReason: unknown = null;
    let usage: unknown;
    let contentLength = 0;
    let reasoningLength = 0;
    let payloadObserved = false;
    let diagnosticsReported = false;

    const currentDiagnostics = () => {
      const completedAt = Date.now();
      const base = readCompletionDiagnostics({
        response,
        payloadObserved,
        responseModel,
        choiceCount: payloadObserved ? 1 : null,
        finishReason,
        contentValue: payloadObserved ? "" : undefined,
        contentLength: payloadObserved ? contentLength : null,
        reasoningContent: reasoningLength > 0 ? "present" : undefined,
        headersLatencyMs:
          headersReceivedAt === null ? null : Math.max(0, headersReceivedAt - startedAt),
        firstTokenLatencyMs:
          firstTokenAt === null ? null : Math.max(0, firstTokenAt - startedAt),
        bodyLatencyMs:
          headersReceivedAt === null
            ? null
            : Math.max(0, (bodyCompletedAt ?? completedAt) - headersReceivedAt),
        totalLatencyMs: Math.max(0, completedAt - startedAt),
        usage,
        timeoutStage: abortScope.timeoutStage(),
        abortSource: abortScope.abortSource()
      });
      return sanitizeAIProviderDiagnostics({
        ...base,
        reasoningPresent: payloadObserved ? reasoningLength > 0 : null,
        reasoningLength: payloadObserved ? reasoningLength : null
      })!;
    };
    const reportDiagnostics = () => {
      if (diagnosticsReported) return currentDiagnostics();
      diagnosticsReported = true;
      const diagnostics = currentDiagnostics();
      try {
        onStreamDiagnostics?.(diagnostics);
      } catch {
        // Observability must never change the user-visible generation result.
      }
      return diagnostics;
    };

    const parsePayload = (data: string) => {
      const payload = JSON.parse(data) as {
        model?: unknown;
        choices?: Array<{
          finish_reason?: unknown;
          delta?: {
            content?: unknown;
            reasoning_content?: unknown;
          };
          message?: {
            content?: unknown;
            reasoning_content?: unknown;
          };
        }>;
        usage?: unknown;
      };
      payloadObserved = true;
      if (payload.model !== undefined) responseModel = payload.model;
      if (payload.usage !== undefined) usage = payload.usage;
      const choice = payload.choices?.[0];
      if (choice?.finish_reason !== undefined) finishReason = choice.finish_reason;
      const reasoning = extractMessageContent(
        choice?.delta?.reasoning_content ?? choice?.message?.reasoning_content
      );
      reasoningLength += reasoning.length;
      const content =
        extractMessageContent(choice?.delta?.content) ||
        extractMessageContent(choice?.message?.content);
      if (content) {
        if (firstTokenAt === null) firstTokenAt = Date.now();
        contentLength += content.length;
      }
      return content;
    };

    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          ...this.buildTemperaturePayload(
            temperature,
            thinking,
            useProviderDefaultTemperature
          ),
          max_tokens: maxTokens,
          stream: true,
          ...(onStreamDiagnostics
            ? { stream_options: { include_usage: true } }
            : {}),
          ...this.buildThinkingPayload(thinking, reasoningEffort)
        }),
        cache: "no-store",
        signal: abortScope.signal
      });
      headersReceivedAt = Date.now();
      abortScope.markHeadersReceived();

      if (!response.ok) {
        const errorText = await readResponseBody(response, abortScope);

        throw new AIProviderError(
          errorText || "AI request failed.",
          "UPSTREAM_HTTP_ERROR",
          response.status,
          reportDiagnostics()
        );
      }

      if (!response.body) {
        throw new AIProviderError("Streaming response body is empty.", "EMPTY_STREAM");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamDone = false;

      const processEvent = (event: string) => {
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("");
        if (!data) return { done: false, content: "" };
        if (data === "[DONE]") return { done: true, content: "" };
        return { done: false, content: parsePayload(data) };
      };

      while (true) {
        const { done, value } = await readWithAbort(
          () => reader.read(),
          abortScope.signal
        );

        if (done) {
          buffer += decoder.decode();
          break;
        }

        if (value && value.byteLength > 0) abortScope.markBodyProgress();
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const parsed = processEvent(event);
          if (parsed.content) yield parsed.content;
          if (parsed.done) {
            streamDone = true;
            break;
          }
        }
        if (streamDone) break;
      }

      if (!streamDone && buffer.trim()) {
        const parsed = processEvent(buffer);
        if (parsed.content) yield parsed.content;
      }
      bodyCompletedAt = Date.now();
      abortScope.markBodyComplete();
      if (contentLength === 0) {
        throw new AIProviderError(
          "Model returned an empty stream.",
          "EMPTY_STREAM",
          undefined,
          reportDiagnostics()
        );
      }
      reportDiagnostics();
    } catch (error) {
      if (error instanceof AIProviderError) {
        reportDiagnostics();
        throw error;
      }

      const source = abortScope.abortSource();
      if (source === "caller") {
        throw new AIProviderError(
          "AI request canceled.",
          "CANCELED",
          undefined,
          reportDiagnostics()
        );
      }
      if (source === "deadline") {
        throw new AIProviderError(
          "AI request timed out.",
          "TIMEOUT",
          undefined,
          reportDiagnostics()
        );
      }
      if (isAbortError(error)) {
        throw new AIProviderError(
          "AI request was aborted upstream.",
          "REQUEST_FAILED",
          undefined,
          reportDiagnostics()
        );
      }

      throw new AIProviderError(
        error instanceof Error ? error.message : "Unknown AI provider error.",
        "REQUEST_FAILED",
        undefined,
        reportDiagnostics()
      );
    } finally {
      abortScope.cleanup();
    }
  }

  async embed({ input }: AIEmbeddingParams): Promise<AIEmbeddingResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          input: Array.isArray(input) ? input : [input],
          encoding_format: "float"
        }),
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AIProviderError(errorText || "Embedding request failed.", "UPSTREAM_HTTP_ERROR", response.status);
      }

      const payload = (await response.json()) as {
        data?: Array<{ embedding?: number[] }>;
        usage?: { total_tokens?: number };
      };

      const embeddings = (payload.data ?? [])
        .map((item) => item.embedding)
        .filter((value): value is number[] => Array.isArray(value));

      if (embeddings.length === 0) {
        throw new AIProviderError("Embedding model returned empty results.", "EMPTY_EMBEDDINGS");
      }

      return {
        embeddings,
        tokenCount: payload.usage?.total_tokens
      };
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }

      if (isAbortError(error)) {
        throw new AIProviderError("Embedding request timed out.", "TIMEOUT");
      }

      throw new AIProviderError(error instanceof Error ? error.message : "Unknown embedding error.", "REQUEST_FAILED");
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
