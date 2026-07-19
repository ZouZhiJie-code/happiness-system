import type { AIRequestStage } from "@prisma/client";
import type { ZodSchema } from "zod";

import { getAIProviderFailureCode, type AIChatMessage, type AIProvider } from "@/server/services/ai/ai-provider";

export interface StructuredOutputAttempt {
  stage: AIRequestStage;
  attempt?: number;
  provider: string;
  success: boolean;
  latencyMs: number | null;
  errorCode: string | null;
  responseText?: string | null;
}

interface StructuredOutputOptions<T> {
  provider: AIProvider | null;
  stage: AIRequestStage;
  schema: ZodSchema<T>;
  messages: AIChatMessage[];
  temperature?: number;
  maxTokens?: number;
  maxAttempts?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  providerUnavailableCode?: string;
  onAttempt?: (attempt: StructuredOutputAttempt) => Promise<void> | void;
}

function extractJsonCandidate(content: string) {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return content.slice(firstBrace, lastBrace + 1).trim();
  }

  return content.trim();
}

export function parseStructuredJson(content: string) {
  return JSON.parse(extractJsonCandidate(content));
}

export async function completeStructuredOutput<T>({
  provider,
  stage,
  schema,
  messages,
  temperature = 0.2,
  maxTokens = 600,
  maxAttempts = 2,
  timeoutMs,
  signal,
  providerUnavailableCode,
  onAttempt
}: StructuredOutputOptions<T>) {
  if (!provider) {
    await onAttempt?.({
      stage,
      attempt: 1,
      provider: "disabled",
      success: false,
      latencyMs: null,
      errorCode: providerUnavailableCode ?? "PROVIDER_NOT_CONFIGURED"
    });

    return null;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    signal?.throwIfAborted();

    try {
      const result = await provider.complete({
        messages,
        temperature,
        maxTokens,
        timeoutMs,
        signal
      });
      const parsed = schema.safeParse(parseStructuredJson(result.content));

      if (!parsed.success) {
        await onAttempt?.({
          stage,
          attempt: attempt + 1,
          provider: result.provider,
          success: false,
          latencyMs: result.latencyMs,
          errorCode: "INVALID_SCHEMA",
          responseText: result.content
        });
        continue;
      }

      await onAttempt?.({
        stage,
        attempt: attempt + 1,
        provider: result.provider,
        success: true,
        latencyMs: result.latencyMs,
        errorCode: null,
        responseText: result.content
      });

      return parsed.data;
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }

      await onAttempt?.({
        stage,
        attempt: attempt + 1,
        provider: provider.name,
        success: false,
        latencyMs: null,
        errorCode: getAIProviderFailureCode(error)
      });
    }
  }

  return null;
}
