import {
  AIProviderError,
  type AICompletionParams,
  type AIEmbeddingParams,
  type AIEmbeddingResult,
  type AIProvider
} from "@/server/services/ai/ai-provider";
import { DEFAULT_BASE_URL, readVolcengineArkConfig } from "@/server/services/ai/provider-config";

const DEFAULT_TIMEOUT_MS = 20_000;

export interface VolcengineArkProviderConfig {
  apiKey: string;
  modelId?: string;
  endpointId?: string;
  embeddingEndpointId?: string;
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

function parseUpstreamErrorMessage(raw: string) {
  try {
    const parsed = JSON.parse(raw) as {
      error?: {
        code?: string;
        message?: string;
      };
    };

    return {
      code: parsed.error?.code ?? null,
      message: parsed.error?.message ?? null
    };
  } catch {
    return {
      code: null,
      message: raw
    };
  }
}

function supportsOnlyMultimodalEmbeddings(raw: string) {
  const upstream = parseUpstreamErrorMessage(raw);
  const message = `${upstream.code ?? ""} ${upstream.message ?? ""}`.toLowerCase();

  return message.includes("does not support this api");
}

function looksLikePlaceholder(value: string | null | undefined) {
  return Boolean(value && /^\$[A-Z0-9_]+(?:\\n)?$/u.test(value));
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
    throw new AIProviderError("Volcengine Ark base URL is invalid.", "INVALID_BASE_URL");
  }
}

export class VolcengineArkProvider implements AIProvider {
  readonly name = "volcengine-ark";

  private readonly apiKey: string;
  private readonly model: string | null;
  private readonly embeddingEndpointId: string | null;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config?: VolcengineArkProviderConfig) {
    if (config) {
      const apiKey = config.apiKey?.trim();

      if (!apiKey) {
        throw new AIProviderError("Missing Volcengine Ark API key.", "MISSING_API_KEY");
      }

      if (looksLikePlaceholder(apiKey)) {
        throw new AIProviderError("Volcengine Ark API key still looks like an env placeholder.", "INVALID_API_KEY");
      }

      this.apiKey = apiKey;
      this.model = config.modelId?.trim() || config.endpointId?.trim() || null;
      this.embeddingEndpointId = config.embeddingEndpointId?.trim() || null;
      this.baseUrl = assertValidBaseUrl(config.baseUrl);
      this.timeoutMs = config.timeoutMs ?? Number(process.env.AI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
      return;
    }

    const envConfig = readVolcengineArkConfig();

    if (envConfig.issues.includes("MISSING_API_KEY")) {
      throw new AIProviderError("Missing Volcengine Ark API key.", "MISSING_API_KEY");
    }

    if (envConfig.issues.includes("PLACEHOLDER_API_KEY")) {
      throw new AIProviderError("Volcengine Ark API key still looks like an env placeholder.", "INVALID_API_KEY");
    }

    if (envConfig.issues.includes("MISSING_MODEL")) {
      throw new AIProviderError("Missing Volcengine Ark model.", "MISSING_MODEL");
    }

    if (envConfig.issues.includes("PLACEHOLDER_MODEL")) {
      throw new AIProviderError("Volcengine Ark model still looks like an env placeholder.", "INVALID_MODEL");
    }

    if (envConfig.issues.includes("PLACEHOLDER_BASE_URL") || envConfig.issues.includes("INVALID_BASE_URL")) {
      throw new AIProviderError("Volcengine Ark base URL is invalid.", "INVALID_BASE_URL");
    }

    this.apiKey = envConfig.apiKey!;
    this.model = envConfig.model!;
    this.embeddingEndpointId = process.env.VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID?.trim() || null;
    this.baseUrl = envConfig.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  }

  async complete({ messages, temperature = 0.2, maxTokens = 600, timeoutMs }: AICompletionParams) {
    if (!this.model) {
      throw new AIProviderError("Missing Volcengine Ark model.", "MISSING_MODEL");
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? this.timeoutMs);

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
        signal: controller.signal
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

      if (error instanceof Error && error.name === "AbortError") {
        throw new AIProviderError("AI request timed out.", "TIMEOUT");
      }

      throw new AIProviderError(error instanceof Error ? error.message : "Unknown AI provider error.", "REQUEST_FAILED");
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async *stream({ messages, temperature = 0.2, maxTokens = 180, timeoutMs }: AICompletionParams): AsyncIterable<string> {
    if (!this.model) {
      throw new AIProviderError("Missing Volcengine Ark model.", "MISSING_MODEL");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? this.timeoutMs);

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
        signal: controller.signal
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

      if (error instanceof Error && error.name === "AbortError") {
        throw new AIProviderError("AI request timed out.", "TIMEOUT");
      }

      throw new AIProviderError(error instanceof Error ? error.message : "Unknown AI provider error.", "REQUEST_FAILED");
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async embed({ input }: AIEmbeddingParams): Promise<AIEmbeddingResult> {
    if (!this.embeddingEndpointId) {
      throw new AIProviderError("Missing Volcengine Ark embedding endpoint id.", "MISSING_EMBEDDING_ENDPOINT_ID");
    }

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
          model: this.embeddingEndpointId,
          input: Array.isArray(input) ? input : [input],
          encoding_format: "float"
        }),
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();

        if (supportsOnlyMultimodalEmbeddings(errorText)) {
          return this.embedWithMultimodalInput(input);
        }

        throw new AIProviderError(errorText || "Embedding request failed.", "UPSTREAM_HTTP_ERROR", response.status);
      }

      const payload = (await response.json()) as {
        data?: Array<{ embedding?: number[] }> | { embedding?: number[] };
        usage?: { total_tokens?: number };
      };

      const embeddings = Array.isArray(payload.data)
        ? payload.data.map((item) => item.embedding).filter((value): value is number[] => Array.isArray(value))
        : Array.isArray(payload.data?.embedding)
          ? [payload.data.embedding]
          : [];

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

      if (error instanceof Error && error.name === "AbortError") {
        throw new AIProviderError("Embedding request timed out.", "TIMEOUT");
      }

      throw new AIProviderError(error instanceof Error ? error.message : "Unknown embedding error.", "REQUEST_FAILED");
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async embedWithMultimodalInput(input: string | string[]): Promise<AIEmbeddingResult> {
    const values = Array.isArray(input) ? input : [input];
    const embeddings: number[][] = [];
    let totalTokens = 0;

    for (const value of values) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}/embeddings/multimodal`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: this.embeddingEndpointId,
            input: [
              {
                type: "text",
                text: value
              }
            ]
          }),
          cache: "no-store",
          signal: controller.signal
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new AIProviderError(errorText || "Embedding request failed.", "UPSTREAM_HTTP_ERROR", response.status);
        }

        const payload = (await response.json()) as {
          data?: { embedding?: number[] } | Array<{ embedding?: number[] }>;
          usage?: { total_tokens?: number };
        };
        const vector = Array.isArray(payload.data)
          ? payload.data.find((item) => Array.isArray(item.embedding))?.embedding
          : payload.data?.embedding;

        if (!Array.isArray(vector) || vector.length === 0) {
          throw new AIProviderError("Embedding model returned empty results.", "EMPTY_EMBEDDINGS");
        }

        embeddings.push(vector);
        totalTokens += payload.usage?.total_tokens ?? 0;
      } catch (error) {
        if (error instanceof AIProviderError) {
          throw error;
        }

        if (error instanceof Error && error.name === "AbortError") {
          throw new AIProviderError("Embedding request timed out.", "TIMEOUT");
        }

        throw new AIProviderError(error instanceof Error ? error.message : "Unknown embedding error.", "REQUEST_FAILED");
      } finally {
        clearTimeout(timeoutId);
      }
    }

    return {
      embeddings,
      tokenCount: totalTokens || undefined
    };
  }
}
