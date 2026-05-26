import type { AIRuntimeCapability, AIRuntimePersistedConfig } from "@/features/admin-ai-runtime/types";
import { AIProviderError, type AIProvider } from "@/server/services/ai/ai-provider";
import { AnthropicProvider } from "@/server/services/ai/anthropic.provider";
import { OpenAIProvider } from "@/server/services/ai/openai.provider";
import { VolcengineArkProvider } from "@/server/services/ai/volcengine-ark.provider";

export interface RuntimeProviderFactoryInput {
  capability: AIRuntimeCapability;
  apiKey: string;
  config: AIRuntimePersistedConfig;
  timeoutMs?: number;
}

export function createRuntimeAIProvider(input: RuntimeProviderFactoryInput): AIProvider {
  if (input.config.provider === "openai") {
    return new OpenAIProvider({
      apiKey: input.apiKey,
      model: input.config.config.model,
      baseUrl: input.config.config.baseUrl,
      timeoutMs: input.timeoutMs
    });
  }

  if (input.config.provider === "anthropic") {
    if (input.capability !== "chat") {
      throw new AIProviderError("Anthropic embeddings are not supported.", "UNSUPPORTED_CAPABILITY");
    }

    return new AnthropicProvider({
      apiKey: input.apiKey,
      model: input.config.config.model,
      baseUrl: input.config.config.baseUrl,
      anthropicVersion: input.config.config.anthropicVersion,
      timeoutMs: input.timeoutMs
    });
  }

  if (input.capability === "chat") {
    return new VolcengineArkProvider({
      apiKey: input.apiKey,
      modelId: "modelId" in input.config.config ? input.config.config.modelId : undefined,
      endpointId: "endpointId" in input.config.config ? input.config.config.endpointId : undefined,
      baseUrl: input.config.config.baseUrl,
      timeoutMs: input.timeoutMs
    });
  }

  return new VolcengineArkProvider({
    apiKey: input.apiKey,
    embeddingEndpointId:
      "embeddingEndpointId" in input.config.config ? input.config.config.embeddingEndpointId : undefined,
    baseUrl: input.config.config.baseUrl,
    timeoutMs: input.timeoutMs
  });
}
