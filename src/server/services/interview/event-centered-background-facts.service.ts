import { createPromptEnvelope } from "@/features/ai-quality/prompt-manifest";
import {
  EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_PROMPT_VERSION,
  EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_RUNTIME,
  buildEventCenteredCompleteResponseBackgroundFactsV11Messages,
  parseAndAlignEventCenteredCompleteResponseBackgroundFactsV11Output,
  validateEventCenteredCompleteResponseBackgroundFactsV11Output
} from "@/features/interview/event-centered/complete-response-background-facts-v1-1";
import { recordAIInvocation } from "@/server/repositories/ai-quality.repository";
import {
  applyEventCenteredBackgroundFactsResult,
  claimNextEventCenteredBackgroundFactsTask,
  failEventCenteredBackgroundFactsTask,
  prepareEventCenteredBackgroundFactsGenerationInput,
  saveEventCenteredBackgroundFactsResult
} from "@/server/repositories/event-centered-background-facts.repository";
import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAIProviderDiagnostics,
  type AIProvider
} from "@/server/services/ai/ai-provider";
import { OpenAIProvider } from "@/server/services/ai/openai.provider";

const OFFICIAL_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_DRAIN_LIMIT = 4;

function defaultBackgroundFactsProvider() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_API_KEY_MISSING");
  const configured = process.env.DEEPSEEK_BASE_URL?.trim() || OFFICIAL_DEEPSEEK_BASE_URL;
  let normalized: string;
  try {
    normalized = new URL(configured).toString().replace(/\/$/u, "");
  } catch {
    throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_BASE_URL_INVALID");
  }
  if (normalized !== OFFICIAL_DEEPSEEK_BASE_URL) {
    throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_BASE_URL_INVALID");
  }
  return new OpenAIProvider({
    apiKey,
    baseUrl: normalized,
    model: EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_RUNTIME.model,
    timeoutMs: EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_RUNTIME.timeoutMs
  });
}

function stableBackgroundFactsErrorCode(error: unknown) {
  if (error instanceof Error && /^[A-Z0-9_:,-]{1,500}$/u.test(error.message)) {
    return error.message.split(":", 1)[0]!.slice(0, 160);
  }
  const providerCode = getAIProviderFailureCode(error);
  if (providerCode && providerCode !== "UNKNOWN_ERROR") return providerCode;
  return "EVENT_CENTERED_BACKGROUND_FACTS_FAILED";
}

function isWriteAuthorityLoss(error: unknown) {
  return error instanceof Error &&
    error.message === "EVENT_CENTERED_BACKGROUND_FACTS_WRITE_AUTHORITY_LOST";
}

function validateCompletionDiagnostics(value: unknown) {
  const diagnostics = sanitizeAIProviderDiagnostics(value);
  if (diagnostics?.finishReason === "length") {
    throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_TOKEN_CEILING_INCONCLUSIVE");
  }
  if (
    diagnostics?.finishReason && diagnostics.finishReason !== "stop"
  ) {
    throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_FINISH_REASON_INVALID");
  }
  if (
    diagnostics?.reasoningPresent === true ||
    (diagnostics?.reasoningTokens ?? 0) > 0
  ) {
    throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_REASONING_MUST_BE_DISABLED");
  }
  if (
    diagnostics?.responseModel &&
    diagnostics.responseModel !==
      EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_RUNTIME.model
  ) {
    throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_MODEL_MISMATCH");
  }
  return diagnostics;
}

export type EventCenteredBackgroundFactsDrainResult = {
  processed: number;
  completed: number;
  failed: number;
  canceled: number;
  busy: boolean;
};

/**
 * 在可见回应提交后排空当前分支的后台事实任务。每条任务至多调用一次模型；
 * 已保存的结果只重放确定性写入，避免恢复过程再次消费模型。
 */
export async function drainEventCenteredBackgroundFactsQueue(
  input: {
    userId: string;
    sessionId: string;
    maxTasks?: number;
  },
  dependencies: {
    provider?: AIProvider;
    createProvider?: () => AIProvider;
  } = {}
): Promise<EventCenteredBackgroundFactsDrainResult> {
  const result: EventCenteredBackgroundFactsDrainResult = {
    processed: 0,
    completed: 0,
    failed: 0,
    canceled: 0,
    busy: false
  };
  let provider = dependencies.provider ?? null;
  const limit = Math.max(1, Math.min(input.maxTasks ?? DEFAULT_DRAIN_LIMIT, 16));
  for (let index = 0; index < limit; index += 1) {
    const claim = await claimNextEventCenteredBackgroundFactsTask({
      userId: input.userId,
      sessionId: input.sessionId
    });
    if (!claim) break;
    if (claim.kind === "busy") {
      result.busy = true;
      break;
    }
    result.processed += 1;
    let envelope: ReturnType<typeof createPromptEnvelope> | null = null;
    let responseText: string | null = null;
    let latencyMs: number | null = null;
    try {
      if (claim.kind === "started") {
        const prepared = await prepareEventCenteredBackgroundFactsGenerationInput({
          traceId: claim.traceId,
          userId: input.userId
        });
        envelope = createPromptEnvelope({
          promptKey: "interview.event_centered.complete_response_background_facts_v1",
          promptVersion:
            EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_PROMPT_VERSION,
          messages: buildEventCenteredCompleteResponseBackgroundFactsV11Messages(
            prepared.generationInput
          )
        });
        provider ??= dependencies.createProvider?.() ?? defaultBackgroundFactsProvider();
        const completion = await provider.complete({
          messages: envelope.messages,
          temperature:
            EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_RUNTIME.temperature,
          maxTokens:
            EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_RUNTIME.maxTokens,
          timeoutMs:
            EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_RUNTIME.timeoutMs,
          responseFormat: "json_object",
          thinking: "disabled"
        });
        responseText = completion.content;
        latencyMs = completion.latencyMs;
        const providerDiagnostics = validateCompletionDiagnostics(completion.diagnostics);
        const aligned = parseAndAlignEventCenteredCompleteResponseBackgroundFactsV11Output({
          generationInput: prepared.generationInput,
          content: completion.content
        });
        const output = aligned.output;
        const issues = validateEventCenteredCompleteResponseBackgroundFactsV11Output({
          generationInput: prepared.generationInput,
          output
        });
        if (issues.length > 0) {
          throw new Error(
            `EVENT_CENTERED_BACKGROUND_FACTS_CONTRACT_INVALID:${issues.join(",")}`
          );
        }
        const diagnostics = {
          ...(providerDiagnostics ?? {}),
          sourceAlignedQuoteCount: aligned.alignedQuoteCount
        };
        await saveEventCenteredBackgroundFactsResult({
          traceId: claim.traceId,
          userId: input.userId,
          responseContent: completion.content,
          output,
          diagnostics: diagnostics as unknown as Record<string, unknown> | null
        });
        await recordAIInvocation({
          sessionId: prepared.sessionId,
          traceId: claim.traceId,
          stage: "extract",
          attempt: 1,
          provider: completion.provider,
          model: diagnostics?.responseModel ??
            EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_RUNTIME.model,
          envelope,
          responseText: completion.content,
          params: {
            temperature:
              EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_RUNTIME.temperature,
            maxTokens:
              EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_RUNTIME.maxTokens,
            timeoutMs:
              EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_RUNTIME.timeoutMs,
            responseFormat: "json_object",
            thinking: "disabled"
          },
          tokenUsage: completion.tokenUsage as Record<string, unknown> | null | undefined,
          success: true,
          latencyMs: completion.latencyMs,
          errorCode: null
        }).catch(() => undefined);
      }
      const applied = await applyEventCenteredBackgroundFactsResult({
        traceId: claim.traceId,
        userId: input.userId
      });
      if (applied.kind === "applied") result.completed += 1;
    } catch (error) {
      const canceled = isWriteAuthorityLoss(error);
      const errorCode = stableBackgroundFactsErrorCode(error);
      await failEventCenteredBackgroundFactsTask({
        traceId: claim.traceId,
        userId: input.userId,
        errorCode,
        canceled
      });
      if (canceled) result.canceled += 1;
      else result.failed += 1;
      if (claim.kind === "started") {
        await recordAIInvocation({
          sessionId: claim.sessionId,
          traceId: claim.traceId,
          stage: "extract",
          attempt: 1,
          provider: provider?.name ?? "disabled",
          model: EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_RUNTIME.model,
          envelope,
          responseText,
          params: {
            temperature:
              EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_RUNTIME.temperature,
            maxTokens:
              EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_RUNTIME.maxTokens,
            timeoutMs:
              EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_RUNTIME.timeoutMs,
            responseFormat: "json_object",
            thinking: "disabled"
          },
          tokenUsage: null,
          success: false,
          latencyMs,
          errorCode
        }).catch(() => undefined);
      }
    }
  }
  return result;
}

export function getEventCenteredBackgroundFactsFailureDiagnostics(error: unknown) {
  return getAIProviderDiagnostics(error);
}
