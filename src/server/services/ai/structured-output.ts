import type { AIRequestStage } from "@prisma/client";
import type { ZodType, ZodTypeDef } from "zod";

import {
  getAIProviderFailureCode,
  type AIChatMessage,
  type AICompletionTokenUsage,
  type AIProvider
} from "@/server/services/ai/ai-provider";

export interface StructuredOutputAttempt {
  stage: AIRequestStage;
  attempt?: number;
  provider: string;
  success: boolean;
  latencyMs: number | null;
  tokenUsage?: AICompletionTokenUsage | null;
  errorCode: string | null;
  errorMessage?: string | null;
  responseText?: string | null;
}

interface StructuredOutputOptions<T> {
  provider: AIProvider | null;
  stage: AIRequestStage;
  schema: ZodType<T, ZodTypeDef, unknown>;
  messages: AIChatMessage[];
  temperature?: number;
  maxTokens?: number;
  maxAttempts?: number;
  timeoutMs?: number;
  responseFormat?: "json_object";
  thinking?: "enabled" | "disabled";
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
  if (firstBrace >= 0) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = firstBrace; index < content.length; index += 1) {
      const character = content[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\" && inString) {
        escaped = true;
        continue;
      }
      if (character === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (character === "{") depth += 1;
      if (character === "}") depth -= 1;
      if (depth === 0) return content.slice(firstBrace, index + 1).trim();
    }
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
  responseFormat,
  thinking,
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
        responseFormat,
        thinking,
        signal
      });
      let json: unknown;
      try {
        json = parseStructuredJson(result.content);
      } catch (error) {
        await onAttempt?.({
          stage,
          attempt: attempt + 1,
          provider: result.provider,
          success: false,
          latencyMs: result.latencyMs,
          tokenUsage: result.tokenUsage ?? null,
          errorCode: "INVALID_JSON",
          errorMessage: error instanceof Error
            ? error.message.slice(0, 500)
            : "Unknown JSON parse error",
          responseText: result.content
        });
        continue;
      }
      const parsed = schema.safeParse(json);

      if (!parsed.success) {
        await onAttempt?.({
          stage,
          attempt: attempt + 1,
          provider: result.provider,
          success: false,
          latencyMs: result.latencyMs,
          tokenUsage: result.tokenUsage ?? null,
          errorCode: "INVALID_SCHEMA",
          errorMessage: parsed.error.issues
            .slice(0, 8)
            .map((issue) => `${issue.path.join(".") || "root"}:${issue.code}`)
            .join(";"),
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
        tokenUsage: result.tokenUsage ?? null,
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
        errorCode: getAIProviderFailureCode(error),
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown provider error"
      });
    }
  }

  return null;
}
