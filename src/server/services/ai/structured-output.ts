import type { AIRequestStage } from "@prisma/client";
import type { ZodSchema } from "zod";

import { AIProviderError, type AIChatMessage, type AIProvider } from "@/server/services/ai/ai-provider";

export interface StructuredOutputAttempt {
  stage: AIRequestStage;
  provider: string;
  success: boolean;
  latencyMs: number | null;
  errorCode: string | null;
}

interface StructuredOutputOptions<T> {
  provider: AIProvider | null;
  stage: AIRequestStage;
  schema: ZodSchema<T>;
  messages: AIChatMessage[];
  temperature?: number;
  maxTokens?: number;
  maxAttempts?: number;
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
  onAttempt
}: StructuredOutputOptions<T>) {
  if (!provider) {
    await onAttempt?.({
      stage,
      provider: "disabled",
      success: false,
      latencyMs: null,
      errorCode: "PROVIDER_NOT_CONFIGURED"
    });

    return null;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const result = await provider.complete({
        messages,
        temperature,
        maxTokens
      });
      const parsed = schema.safeParse(parseStructuredJson(result.content));

      if (!parsed.success) {
        await onAttempt?.({
          stage,
          provider: result.provider,
          success: false,
          latencyMs: result.latencyMs,
          errorCode: "INVALID_SCHEMA"
        });
        continue;
      }

      await onAttempt?.({
        stage,
        provider: result.provider,
        success: true,
        latencyMs: result.latencyMs,
        errorCode: null
      });

      return parsed.data;
    } catch (error) {
      await onAttempt?.({
        stage,
        provider: provider.name,
        success: false,
        latencyMs: null,
        errorCode:
          error instanceof AIProviderError ? error.code : error instanceof Error ? error.name : "UNKNOWN_ERROR"
      });
    }
  }

  return null;
}
