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
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

function extractText(payload: ResponsesPayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
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
    this.baseUrl = (config.baseUrl ?? "https://ark.cn-beijing.volces.com/api/v3").replace(/\/$/u, "");
    this.timeoutMs = config.timeoutMs ?? 20_000;
  }

  async complete({ messages, timeoutMs, signal }: AICompletionParams) {
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
          input: messages.map((message) => ({
            role: message.role,
            content: [{ type: "input_text", text: message.content }]
          }))
        }),
        cache: "no-store",
        signal: abortScope.signal
      });

      if (!response.ok) {
        throw new AIProviderError((await response.text()) || "Ark Responses request failed.", "UPSTREAM_HTTP_ERROR", response.status);
      }

      const content = extractText((await response.json()) as ResponsesPayload);
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
