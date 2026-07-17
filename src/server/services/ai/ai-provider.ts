export type AIMessageRole = "system" | "user" | "assistant";

export interface AIChatMessage {
  role: AIMessageRole;
  content: string;
}

export interface AICompletionParams {
  messages: AIChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface AICompletionResult {
  content: string;
  latencyMs: number;
  provider: string;
}

export interface AIEmbeddingParams {
  input: string | string[];
}

export interface AIEmbeddingResult {
  embeddings: number[][];
  tokenCount?: number;
}

export interface AIProvider {
  readonly name: string;
  complete(params: AICompletionParams): Promise<AICompletionResult>;
  stream?(params: AICompletionParams): AsyncIterable<string>;
  embed?(params: AIEmbeddingParams): Promise<AIEmbeddingResult>;
}

export function createTimedAbortScope(externalSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(externalSignal?.reason);

  if (externalSignal?.aborted) {
    abortFromCaller();
  } else {
    externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    wasCanceled: () => Boolean(externalSignal?.aborted) && !timedOut,
    cleanup: () => {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", abortFromCaller);
    }
  };
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

export function isAbortError(error: unknown) {
  return Boolean(error && typeof error === "object" && "name" in error && error.name === "AbortError");
}

export function getAIProviderFailureCode(error: unknown) {
  if (!(error instanceof AIProviderError)) {
    return error instanceof Error ? error.name : "UNKNOWN_ERROR";
  }

  if (error.code !== "UPSTREAM_HTTP_ERROR") {
    return error.code;
  }

  try {
    const payload = JSON.parse(error.message) as {
      error?: {
        code?: string;
      };
    };

    return payload.error?.code ? String(payload.error.code).toUpperCase() : error.code;
  } catch {
    return error.code;
  }
}
