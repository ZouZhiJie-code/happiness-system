import { AIProviderError, type AICompletionParams, type AIProvider } from "@/server/services/ai/ai-provider";

const DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_TIMEOUT_MS = 20_000;

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

export class VolcengineArkProvider implements AIProvider {
  readonly name = "volcengine-ark";

  private readonly apiKey: string;
  private readonly endpointId: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor() {
    const apiKey = process.env.VOLCENGINE_ARK_API_KEY ?? process.env.ARK_API_KEY;
    const endpointId = process.env.VOLCENGINE_ARK_ENDPOINT_ID ?? process.env.ARK_ENDPOINT_ID;

    if (!apiKey) {
      throw new AIProviderError("Missing Volcengine Ark API key.", "MISSING_API_KEY");
    }

    if (!endpointId) {
      throw new AIProviderError("Missing Volcengine Ark endpoint id.", "MISSING_ENDPOINT_ID");
    }

    this.apiKey = apiKey;
    this.endpointId = endpointId;
    this.baseUrl = process.env.VOLCENGINE_ARK_BASE_URL ?? process.env.ARK_BASE_URL ?? DEFAULT_BASE_URL;
    this.timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  }

  async complete({ messages, temperature = 0.2, maxTokens = 600, timeoutMs }: AICompletionParams) {
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
          model: this.endpointId,
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
          model: this.endpointId,
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

          if (!data) continue;
          if (data === "[DONE]") return;

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

      if (buffer.trim()) {
        for (const line of buffer.split(/\r?\n/)) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;

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
}
