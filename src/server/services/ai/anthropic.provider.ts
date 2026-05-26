import {
  AIProviderError,
  type AIChatMessage,
  type AICompletionParams,
  type AIEmbeddingParams,
  type AIProvider
} from "@/server/services/ai/ai-provider";

const DEFAULT_BASE_URL = "https://api.anthropic.com";
const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_TIMEOUT_MS = 20_000;

export interface AnthropicProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  anthropicVersion?: string;
  timeoutMs?: number;
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
    throw new AIProviderError("Anthropic base URL is invalid.", "INVALID_BASE_URL");
  }
}

function toAnthropicMessages(messages: AIChatMessage[]) {
  const system: string[] = [];
  const conversation = messages
    .filter((message) => {
      if (message.role === "system") {
        system.push(message.content);
        return false;
      }

      return true;
    })
    .map((message) => ({
      role: message.role,
      content: [
        {
          type: "text",
          text: message.content
        }
      ]
    }));

  return {
    system: system.join("\n\n").trim() || undefined,
    messages: conversation
  };
}

function extractTextBlocks(content: unknown) {
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }

      if ("type" in item && item.type === "text" && "text" in item && typeof item.text === "string") {
        return item.text;
      }

      return "";
    })
    .join("")
    .trim();
}

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";

  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly anthropicVersion: string;
  private readonly timeoutMs: number;

  constructor(config: AnthropicProviderConfig) {
    this.apiKey = assertConfiguredString(config.apiKey, "MISSING_API_KEY", "Missing Anthropic API key.");
    this.model = assertConfiguredString(config.model, "MISSING_MODEL", "Missing Anthropic model.");
    this.baseUrl = assertValidBaseUrl(config.baseUrl);
    this.anthropicVersion = assertConfiguredString(
      config.anthropicVersion ?? DEFAULT_ANTHROPIC_VERSION,
      "MISSING_ANTHROPIC_VERSION",
      "Missing Anthropic version header."
    );
    this.timeoutMs = config.timeoutMs ?? Number(process.env.AI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  }

  async complete({ messages, temperature = 0.2, maxTokens = 600, timeoutMs }: AICompletionParams) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? this.timeoutMs);
    const payload = toAnthropicMessages(messages);

    try {
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": this.anthropicVersion
        },
        body: JSON.stringify({
          model: this.model,
          system: payload.system,
          messages: payload.messages,
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

      const result = (await response.json()) as {
        content?: unknown;
      };
      const content = extractTextBlocks(result.content);

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? this.timeoutMs);
    const payload = toAnthropicMessages(messages);

    try {
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": this.anthropicVersion
        },
        body: JSON.stringify({
          model: this.model,
          system: payload.system,
          messages: payload.messages,
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

        for (const eventChunk of events) {
          const lines = eventChunk.split(/\r?\n/);
          const eventName = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() ?? "";
          const data = lines
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .join("");

          if (!data) {
            continue;
          }

          if (data === "[DONE]") {
            return;
          }

          if (eventName !== "content_block_delta") {
            continue;
          }

          const payload = JSON.parse(data) as {
            delta?: {
              text?: string;
            };
          };

          if (payload.delta?.text) {
            yield payload.delta.text;
          }
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

  async embed(params: AIEmbeddingParams): Promise<never> {
    void params;
    throw new AIProviderError("Anthropic embeddings are not supported.", "UNSUPPORTED_CAPABILITY");
  }
}

export { DEFAULT_ANTHROPIC_VERSION };
