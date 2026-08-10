import {
  AIProviderError,
  createTimedAbortScope,
  isAbortError,
  type AICompletionParams,
  type AIProvider
} from "@/server/services/ai/ai-provider";

type ResponsesProviderConfig = {
  apiKey: string;
  endpointId: string;
  baseUrl?: string;
  timeoutMs?: number;
};

type ResponsesPayload = {
  status?: string;
  incomplete_details?: {
    reason?: string;
  };
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

const DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

function assertValidBaseUrl(value: string | undefined) {
  const baseUrl = (value?.trim() || DEFAULT_BASE_URL).replace(/\/+$/u, "");

  try {
    const parsed = new URL(baseUrl);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("invalid protocol");
    }

    return baseUrl;
  } catch {
    throw new AIProviderError("Ark Responses base URL is invalid.", "INVALID_BASE_URL");
  }
}

async function readStableUpstreamErrorCode(response: Response) {
  try {
    const payload = (await response.json()) as {
      error?: {
        code?: unknown;
      };
    };
    const code = payload.error?.code;

    return typeof code === "string" && /^[A-Za-z0-9_.-]{1,80}$/u.test(code) ? code.toUpperCase() : null;
  } catch {
    return null;
  }
}

function extractText(payload: ResponsesPayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  return (payload.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text ?? "")
    .join("")
    .trim();
}

export class VolcengineArkResponsesProvider implements AIProvider {
  readonly name = "volcengine-ark-responses";

  private readonly apiKey: string;
  private readonly endpointId: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ResponsesProviderConfig) {
    if (!config.apiKey.trim() || !config.endpointId.trim()) {
      throw new AIProviderError("Missing Ark Responses judge configuration.", "MISSING_JUDGE_CONFIG");
    }

    this.apiKey = config.apiKey.trim();
    this.endpointId = config.endpointId.trim();
    this.baseUrl = assertValidBaseUrl(config.baseUrl);
    this.timeoutMs = config.timeoutMs ?? 20_000;
  }

  async complete({ messages, maxTokens = 600, timeoutMs, signal }: AICompletionParams) {
    const startedAt = Date.now();
    const abortScope = createTimedAbortScope(signal, timeoutMs ?? this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.endpointId,
          stream: false,
          max_output_tokens: maxTokens,
          input: messages.map((message) => ({
            role: message.role,
            content: [{ type: "input_text", text: message.content }]
          }))
        }),
        cache: "no-store",
        signal: abortScope.signal
      });

      if (!response.ok) {
        const code =
          response.status === 429
            ? "RATE_LIMITED"
            : response.status >= 500
              ? "SERVICE_UNAVAILABLE"
              : response.status >= 400 && response.status < 500
                ? ((await readStableUpstreamErrorCode(response)) ?? "UPSTREAM_HTTP_ERROR")
                : "UPSTREAM_HTTP_ERROR";

        throw new AIProviderError("Ark Responses request failed.", code, response.status);
      }

      let payload: ResponsesPayload;

      try {
        payload = (await response.json()) as ResponsesPayload;
      } catch {
        throw new AIProviderError("Ark Responses returned an invalid response.", "INVALID_RESPONSE");
      }

      if (payload.status === "incomplete") {
        if (payload.incomplete_details?.reason === "max_output_tokens") {
          throw new AIProviderError("Ark Responses output reached the token limit before completion.", "OUTPUT_TRUNCATED");
        }

        throw new AIProviderError("Ark Responses returned an incomplete response.", "OUTPUT_INCOMPLETE");
      }

      const content = extractText(payload);
      if (!content) {
        throw new AIProviderError("Ark Responses returned empty content.", "EMPTY_CONTENT");
      }

      return { content, latencyMs: Date.now() - startedAt, provider: this.name };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if (isAbortError(error)) {
        throw new AIProviderError(
          abortScope.wasCanceled() ? "AI request canceled." : "AI request timed out.",
          abortScope.wasCanceled() ? "CANCELED" : "TIMEOUT"
        );
      }
      throw new AIProviderError(error instanceof Error ? error.message : "Unknown AI provider error.", "REQUEST_FAILED");
    } finally {
      abortScope.cleanup();
    }
  }
}
