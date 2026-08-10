export type AIMessageRole = "system" | "user" | "assistant";

export interface AIChatMessage {
  role: AIMessageRole;
  content: string;
}

export interface AICompletionParams {
  messages: AIChatMessage[];
  temperature?: number;
  useProviderDefaultTemperature?: true;
  maxTokens?: number;
  useProviderDefaultMaxTokens?: boolean;
  timeoutMs?: number;
  headersTimeoutMs?: number;
  bodyIdleTimeoutMs?: number;
  hardTimeoutMs?: number;
  responseFormat?: "json_object";
  thinking?: "enabled" | "disabled";
  reasoningEffort?: "low" | "high" | "max";
  reasoningOnlyContinuation?: {
    mode: "deepseek_chat_prefix_beta";
    visiblePrefix: "{";
    sharedHardTimeoutMs: number;
  };
  signal?: AbortSignal;
}

export interface AICompletionResult {
  content: string;
  latencyMs: number;
  provider: string;
  tokenUsage?: AICompletionTokenUsage | null;
  diagnostics?: AIProviderDiagnostics | null;
}

/**
 * 供应商返回的计费用量。字段保持可选，避免不提供 usage 的模型影响现有调用。
 */
export interface AICompletionTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  promptCacheHitTokens?: number;
  promptCacheMissTokens?: number;
}

export type AIProviderFinishReason =
  | "stop"
  | "length"
  | "content_filter"
  | "tool_calls"
  | "unknown"
  | null;

export type AIProviderValueType =
  | "missing"
  | "null"
  | "string"
  | "array"
  | "object"
  | "number"
  | "boolean"
  | "unknown";

export type AIProviderTimeoutStage = "headers" | "body" | "hard_total" | null;
export type AIProviderAbortSource = "deadline" | "caller" | null;

/**
 * 只保存可核查的供应商响应摘要。隐藏推理正文永远不进入该结构。
 */
export interface AIProviderDiagnostics {
  finishReason: AIProviderFinishReason;
  reasoningPresent: boolean | null;
  reasoningLength: number | null;
  reasoningTokens: number | null;
  latencyMs: number | null;
  tokenUsage: AICompletionTokenUsage | null;
  upstreamRequestId?: string | null;
  httpStatus?: number | null;
  responseModel?: string | null;
  choiceCount?: number | null;
  contentType?: AIProviderValueType | null;
  contentLength?: number | null;
  reasoningType?: AIProviderValueType | null;
  headersLatencyMs?: number | null;
  bodyLatencyMs?: number | null;
  totalLatencyMs?: number | null;
  timeoutStage?: AIProviderTimeoutStage;
  abortSource?: AIProviderAbortSource;
}

function readNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function readHttpStatus(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : null;
}

function readSafeDiagnosticString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u.test(trimmed) ? trimmed : null;
}

function readProviderValueType(value: unknown): AIProviderValueType | null {
  return value === "missing" ||
    value === "null" ||
    value === "string" ||
    value === "array" ||
    value === "object" ||
    value === "number" ||
    value === "boolean" ||
    value === "unknown"
    ? value
    : null;
}

export function sanitizeAICompletionTokenUsage(
  value: unknown
): AICompletionTokenUsage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const entries = {
    promptTokens: readNonNegativeInteger(source.promptTokens),
    completionTokens: readNonNegativeInteger(source.completionTokens),
    totalTokens: readNonNegativeInteger(source.totalTokens),
    promptCacheHitTokens: readNonNegativeInteger(source.promptCacheHitTokens),
    promptCacheMissTokens: readNonNegativeInteger(source.promptCacheMissTokens)
  };
  const result = Object.fromEntries(
    Object.entries(entries).filter(([, item]) => item !== null)
  ) as AICompletionTokenUsage;
  return Object.keys(result).length > 0 ? result : null;
}

export function sanitizeAIProviderDiagnostics(
  value: unknown
): AIProviderDiagnostics | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const finishReason: AIProviderFinishReason =
    source.finishReason === null
      ? null
      : source.finishReason === "stop" ||
          source.finishReason === "length" ||
          source.finishReason === "content_filter" ||
          source.finishReason === "tool_calls" ||
          source.finishReason === "unknown"
        ? source.finishReason
        : "unknown";
  const rawReasoningLength = readNonNegativeInteger(source.reasoningLength);
  const reasoningPresent =
    source.reasoningPresent === true && (rawReasoningLength ?? 0) > 0
      ? true
      : source.reasoningPresent === false
        ? false
        : null;
  const totalLatencyMs = readNonNegativeInteger(source.totalLatencyMs);
  const legacyLatencyMs = readNonNegativeInteger(source.latencyMs);
  return {
    finishReason,
    reasoningPresent,
    reasoningLength:
      reasoningPresent === true
        ? rawReasoningLength
        : reasoningPresent === false
          ? 0
          : null,
    reasoningTokens: readNonNegativeInteger(source.reasoningTokens),
    latencyMs: totalLatencyMs ?? legacyLatencyMs,
    tokenUsage: sanitizeAICompletionTokenUsage(source.tokenUsage),
    upstreamRequestId: readSafeDiagnosticString(source.upstreamRequestId),
    httpStatus: readHttpStatus(source.httpStatus),
    responseModel: readSafeDiagnosticString(source.responseModel),
    choiceCount: readNonNegativeInteger(source.choiceCount),
    contentType: readProviderValueType(source.contentType),
    contentLength: readNonNegativeInteger(source.contentLength),
    reasoningType: readProviderValueType(source.reasoningType),
    headersLatencyMs: readNonNegativeInteger(source.headersLatencyMs),
    bodyLatencyMs: readNonNegativeInteger(source.bodyLatencyMs),
    totalLatencyMs: totalLatencyMs ?? legacyLatencyMs,
    timeoutStage:
      source.timeoutStage === "headers" ||
      source.timeoutStage === "body" ||
      source.timeoutStage === "hard_total"
        ? source.timeoutStage
        : null,
    abortSource:
      source.abortSource === "deadline" || source.abortSource === "caller"
        ? source.abortSource
        : null
  };
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

export interface AIReasoningOnlyContinuation {
  readonly kind: "deepseek_chat_prefix_beta";
  consume(): Promise<AICompletionResult>;
  dispose(): void;
}

const reasoningOnlyContinuations = new WeakMap<
  AIProviderError,
  AIReasoningOnlyContinuation
>();

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
  readonly diagnostics?: AIProviderDiagnostics | null;

  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
    diagnostics?: AIProviderDiagnostics | null
  ) {
    super(message);
    this.name = "AIProviderError";
    if (diagnostics !== undefined) {
      this.diagnostics = sanitizeAIProviderDiagnostics(diagnostics);
    }
  }
}

export function attachAIReasoningOnlyContinuation(
  error: AIProviderError,
  continuation: AIReasoningOnlyContinuation
) {
  reasoningOnlyContinuations.set(error, continuation);
  return error;
}

export function takeAIReasoningOnlyContinuation(error: unknown) {
  if (!(error instanceof AIProviderError)) return null;
  const continuation = reasoningOnlyContinuations.get(error) ?? null;
  reasoningOnlyContinuations.delete(error);
  return continuation;
}

export function getAIProviderDiagnostics(error: unknown) {
  return error instanceof AIProviderError
    ? sanitizeAIProviderDiagnostics(error.diagnostics)
    : null;
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
