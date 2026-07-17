import {
  AIProviderError,
  createTimedAbortScope,
  isAbortError,
  type AICompletionParams,
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

  constructor(config: OpenAIProviderConfig) {
    this.apiKey = assertConfiguredString(config.apiKey, "MISSING_API_KEY", "Missing OpenAI API key.");
    this.model = assertConfiguredString(config.model, "MISSING_MODEL", "Missing OpenAI model.");
    this.baseUrl = assertValidBaseUrl(config.baseUrl);
    this.timeoutMs = config.timeoutMs ?? Number(process.env.AI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  }

  async complete({ messages, temperature = 0.2, maxTokens = 600, timeoutMs, signal }: AICompletionParams) {
    const startedAt = Date.now();
    const abortScope = createTimedAbortScope(signal, timeoutMs ?? this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature,
          max_tokens: maxTokens
        }),
        cache: "no-store",
        signal: abortScope.signal
      });
      const latencyMs = Date.now() - startedAt;

      if (!response.ok) {
        const errorText = await response.text();

        throw new AIProviderError(errorText || "AI request failed.", "UPSTREAM_HTTP_ERROR", response.status);
      }

      const payload = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: unknown;
          };
        }>;
      };
      const content = extractMessageContent(payload.choices?.[0]?.message?.content);

      if (!content) {
        throw new AIProviderError("Model returned empty content.", "EMPTY_CONTENT");
      }

      return {
        content,
        latencyMs,
        provider: this.name
      };
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }

      if (isAbortError(error)) {
        if (abortScope.wasCanceled()) {
          throw new AIProviderError("AI request canceled.", "CANCELED");
        }
        throw new AIProviderError("AI request timed out.", "TIMEOUT");
      }

      throw new AIProviderError(error instanceof Error ? error.message : "Unknown AI provider error.", "REQUEST_FAILED");
    } finally {
      abortScope.cleanup();
    }
  }

  async *stream({ messages, temperature = 0.2, maxTokens = 180, timeoutMs, signal }: AICompletionParams): AsyncIterable<string> {
    const abortScope = createTimedAbortScope(signal, timeoutMs ?? this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true
        }),
        cache: "no-store",
        signal: abortScope.signal
      });

      if (!response.ok) {
        const errorText = await response.text();

        throw new AIProviderError(errorText || "AI request failed.", "UPSTREAM_HTTP_ERROR", response.status);
      }

      if (!response.body) {
        throw new AIProviderError("Streaming response body is empty.", "EMPTY_STREAM");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          buffer += decoder.decode();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const data = event
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .join("");

          if (!data) {
            continue;
          }

          if (data === "[DONE]") {
            return;
          }

          const payload = JSON.parse(data) as {
            choices?: Array<{
              delta?: {
                content?: unknown;
              };
              message?: {
                content?: unknown;
              };
            }>;
          };
          const content =
            extractMessageContent(payload.choices?.[0]?.delta?.content) ||
            extractMessageContent(payload.choices?.[0]?.message?.content);

          if (content) {
            yield content;
          }
        }
      }

      if (!buffer.trim()) {
        return;
      }

      for (const line of buffer.split(/\r?\n/)) {
        if (!line.startsWith("data:")) {
          continue;
        }

        const data = line.slice(5).trim();

        if (!data || data === "[DONE]") {
          continue;
        }

        const payload = JSON.parse(data) as {
          choices?: Array<{
            delta?: {
              content?: unknown;
            };
            message?: {
              content?: unknown;
            };
          }>;
        };
        const content =
          extractMessageContent(payload.choices?.[0]?.delta?.content) ||
          extractMessageContent(payload.choices?.[0]?.message?.content);

        if (content) {
          yield content;
        }
      }
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }

      if (isAbortError(error)) {
        if (abortScope.wasCanceled()) {
          throw new AIProviderError("AI request canceled.", "CANCELED");
        }
        throw new AIProviderError("AI request timed out.", "TIMEOUT");
      }

      throw new AIProviderError(error instanceof Error ? error.message : "Unknown AI provider error.", "REQUEST_FAILED");
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
