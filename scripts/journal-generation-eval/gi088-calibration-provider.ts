import {
  AIProviderError,
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  type AICompletionTokenUsage
} from "@/server/services/ai/ai-provider";
import { OpenAIProvider } from "@/server/services/ai/openai.provider";

import {
  GI088_JOURNAL_CALIBRATION_RUNTIME,
  type Gi088CalibrationProvider,
  type Gi088CalibrationProviderRequest,
  type Gi088CalibrationProviderResult,
  type Gi088JournalCalibrationModel
} from "./gi088-calibration-contract";

export class Gi088CalibrationProviderError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    readonly latencyMs: number,
    readonly tokenUsage: AICompletionTokenUsage | null = null,
    readonly finishReason: string | null = null,
    readonly upstreamRequestId: string | null = null,
    readonly cause?: unknown
  ) {
    super(code);
    this.name = "Gi088CalibrationProviderError";
  }
}

function retryableProviderFailure(
  error: unknown,
  code: string,
  finishReason: string | null
) {
  if (error instanceof AIProviderError) {
    if (error.code === "CANCELED") return false;
    if (error.code === "UPSTREAM_HTTP_ERROR") {
      return error.status === 408 || error.status === 429 ||
        (typeof error.status === "number" && error.status >= 500);
    }
  }
  if (["EMPTY_CONTENT", "EMPTY_RESPONSE", "EMPTY_STREAM"].includes(code)) {
    return finishReason === null || finishReason === "stop";
  }
  return [
    "TIMEOUT",
    "REQUEST_FAILED",
  ].includes(code);
}

function providerError(error: unknown) {
  if (error instanceof Gi088CalibrationProviderError) return error;
  const diagnostics = getAIProviderDiagnostics(error);
  const rawCode = getAIProviderFailureCode(error);
  const finishReason = diagnostics?.finishReason ?? null;
  const code = ["EMPTY_CONTENT", "EMPTY_RESPONSE", "EMPTY_STREAM"].includes(rawCode)
    ? finishReason === "length"
      ? "INCOMPLETE_RESPONSE"
      : finishReason === "content_filter"
        ? "CONTENT_FILTERED"
        : rawCode
    : rawCode;
  return new Gi088CalibrationProviderError(
    code,
    retryableProviderFailure(error, rawCode, finishReason),
    diagnostics?.totalLatencyMs ?? diagnostics?.latencyMs ?? 0,
    diagnostics?.tokenUsage ?? null,
    finishReason,
    diagnostics?.upstreamRequestId ?? null,
    error
  );
}

export interface Gi088OpenAICompatibleProviderOptions {
  apiKey: string;
  baseUrl?: string;
}

export function createGi088OpenAICompatibleCalibrationProvider(
  options: Gi088OpenAICompatibleProviderOptions
): Gi088CalibrationProvider {
  const providers = new Map<Gi088JournalCalibrationModel["model"], OpenAIProvider>();
  const getProvider = (model: Gi088JournalCalibrationModel["model"]) => {
    const current = providers.get(model);
    if (current) return current;
    const created = new OpenAIProvider({
      apiKey: options.apiKey,
      model,
      baseUrl: options.baseUrl ?? GI088_JOURNAL_CALIBRATION_RUNTIME.baseUrl,
      timeoutMs: GI088_JOURNAL_CALIBRATION_RUNTIME.hardTimeoutMs
    });
    providers.set(model, created);
    return created;
  };

  return {
    kind: "real",
    name: "deepseek_official_openai_compatible",
    async complete(request) {
      try {
        const result = await getProvider(request.model.model).complete({
          messages: request.messages,
          temperature: request.runtime.temperature,
          useProviderDefaultMaxTokens: true,
          headersTimeoutMs: request.runtime.headersTimeoutMs,
          bodyIdleTimeoutMs: request.runtime.bodyIdleTimeoutMs,
          hardTimeoutMs: request.runtime.hardTimeoutMs,
          responseFormat: request.runtime.responseFormat,
          thinking: request.runtime.thinking
        });
        const diagnostics = result.diagnostics;
        if (!result.content.trim()) {
          const finishReason = diagnostics?.finishReason ?? null;
          const errorCode = finishReason === "length"
            ? "INCOMPLETE_RESPONSE"
            : finishReason === "content_filter"
              ? "CONTENT_FILTERED"
              : "EMPTY_RESPONSE";
          throw new Gi088CalibrationProviderError(
            errorCode,
            finishReason === null || finishReason === "stop",
            result.latencyMs,
            result.tokenUsage ?? null,
            finishReason,
            diagnostics?.upstreamRequestId ?? null
          );
        }
        return {
          content: result.content,
          latencyMs: result.latencyMs,
          provider: result.provider,
          finishReason: diagnostics?.finishReason ?? null,
          tokenUsage: result.tokenUsage ?? null,
          upstreamRequestId: diagnostics?.upstreamRequestId ?? null,
          reasoningPresent: diagnostics?.reasoningPresent ?? null,
          reasoningTokens: diagnostics?.reasoningTokens ?? null,
          responseModel: diagnostics?.responseModel ?? null
        };
      } catch (error) {
        throw providerError(error);
      }
    }
  };
}

export type Gi088MockProviderHandler = (
  request: Gi088CalibrationProviderRequest
) => Gi088CalibrationProviderResult | Promise<Gi088CalibrationProviderResult>;

function conciseGroundedTitle(value: string) {
  const normalized = value.replace(/\s+/gu, " ").trim();
  return [...(normalized || "这件事")].slice(0, 12).join("");
}

function firstSource(request: Gi088CalibrationProviderRequest) {
  for (const ref of request.sourceRefs) {
    const text = request.sourceTextByRef[ref]?.trim();
    if (text) return { ref, text };
  }
  return { ref: request.sourceRefs[0] ?? "source:missing", text: "这件事" };
}

function defaultMockResult(
  request: Gi088CalibrationProviderRequest
): Gi088CalibrationProviderResult {
  let content: string;
  if (request.stage === "record_card") {
    const source = firstSource(request);
    content = JSON.stringify({
      title: {
        text: conciseGroundedTitle(source.text),
        sourceRefs: [source.ref]
      },
      occurredAtText: null,
      blocks: [{ kind: "event", text: source.text, sourceRefs: [source.ref] }]
    });
  } else {
    const recordId = request.sourceRecordIds[0] ?? "record:missing";
    content = JSON.stringify({
      paragraphs: [{
        text: request.sourceRecordTextById[recordId] ?? "这件事",
        sourceRecordIds: [recordId]
      }]
    });
  }
  return {
    content,
    latencyMs: 8,
    provider: "mock",
    finishReason: "stop",
    tokenUsage: {
      promptTokens: 100,
      completionTokens: 40,
      totalTokens: 140,
      promptCacheHitTokens: 20,
      promptCacheMissTokens: 80
    },
    upstreamRequestId: `mock-${request.callFingerprint.slice(0, 16)}`,
    reasoningPresent: false,
    reasoningTokens: 0,
    responseModel: request.model.model
  };
}

export function createGi088MockCalibrationProvider(
  handler: Gi088MockProviderHandler = defaultMockResult
) {
  const calls: Gi088CalibrationProviderRequest[] = [];
  const provider: Gi088CalibrationProvider & {
    calls: Gi088CalibrationProviderRequest[];
  } = {
    kind: "mock",
    name: "gi088_journal_calibration_mock",
    calls,
    async complete(request) {
      calls.push(structuredClone(request));
      return handler(request);
    }
  };
  return provider;
}
