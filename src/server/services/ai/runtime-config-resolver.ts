import type { AIRuntimeCapability, AIRuntimePersistedConfig, AIRuntimeProvider } from "@/features/admin-ai-runtime/types";
import { getAIRuntimePersistedConfigSchema } from "@/features/admin-ai-runtime/schema";
import { getPublishedAIRuntimeConfigRecord } from "@/server/repositories/admin-ai-runtime.repository";
import { AdminAIRuntimeCryptoError, decryptAIRuntimeApiKey } from "@/server/services/admin-ai-runtime/admin-ai-runtime-crypto";
import { readVolcengineArkConfig } from "@/server/services/ai/provider-config";

export type AIRuntimeFallbackReason =
  | "DATABASE_CONFIG_DISABLED"
  | "DATABASE_CONFIG_UNAVAILABLE"
  | null;

export interface AIRuntimeResolution {
  capability: AIRuntimeCapability;
  source: "database" | "environment";
  provider: AIRuntimeProvider;
  config: AIRuntimePersistedConfig;
  apiKey: string;
  publishedConfigId: string | null;
  fallbackReason: AIRuntimeFallbackReason;
}

function parseDatabaseConfig(capability: AIRuntimeCapability, provider: string, configJson: unknown) {
  return getAIRuntimePersistedConfigSchema(capability).parse({
    provider,
    config: configJson
  }) as AIRuntimePersistedConfig;
}

function buildEnvironmentFallback(
  capability: AIRuntimeCapability,
  fallbackReason: AIRuntimeFallbackReason
): AIRuntimeResolution | null {
  const config = readVolcengineArkConfig();

  if (config.issues.length > 0 || !config.apiKey || !config.baseUrl) {
    return null;
  }

  if (capability === "chat") {
    if (!config.model) {
      return null;
    }

    const persistedConfig: AIRuntimePersistedConfig = {
      provider: "volcengine_ark",
      config:
        config.modelSource === "VOLCENGINE_ARK_ENDPOINT_ID" || config.modelSource === "ARK_ENDPOINT_ID"
          ? {
              endpointId: config.model,
              baseUrl: config.baseUrl
            }
          : {
              modelId: config.model,
              baseUrl: config.baseUrl
            }
    };

    return {
      capability,
      source: "environment",
      provider: "volcengine_ark",
      config: persistedConfig,
      apiKey: config.apiKey,
      publishedConfigId: null,
      fallbackReason
    };
  }

  const embeddingEndpointId = process.env.VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID?.trim();

  if (!embeddingEndpointId) {
    return null;
  }

  return {
    capability,
    source: "environment",
    provider: "volcengine_ark",
    config: {
      provider: "volcengine_ark",
      config: {
        embeddingEndpointId,
        baseUrl: config.baseUrl
      }
    },
    apiKey: config.apiKey,
    publishedConfigId: null,
    fallbackReason
  };
}

type PublishedAIRuntimeConfig = Awaited<ReturnType<typeof getPublishedAIRuntimeConfigRecord>>;

export async function resolveAIRuntimeConfig(
  capability: AIRuntimeCapability,
  options?: { publishedConfig: PublishedAIRuntimeConfig }
): Promise<AIRuntimeResolution | null> {
  const publishedConfig = options ? options.publishedConfig : await getPublishedAIRuntimeConfigRecord(capability);

  if (!publishedConfig) {
    return buildEnvironmentFallback(capability, null);
  }

  if (!publishedConfig.enabled) {
    return buildEnvironmentFallback(capability, "DATABASE_CONFIG_DISABLED");
  }

  try {
    if (!publishedConfig.apiKeyCiphertext) {
      throw new AdminAIRuntimeCryptoError("AI_RUNTIME_DECRYPT_FAILED");
    }

    const apiKey = decryptAIRuntimeApiKey(publishedConfig.apiKeyCiphertext);
    const config = parseDatabaseConfig(capability, publishedConfig.provider, publishedConfig.configJson);

    return {
      capability,
      source: "database",
      provider: config.provider,
      config,
      apiKey,
      publishedConfigId: publishedConfig.id,
      fallbackReason: null
    };
  } catch {
    return buildEnvironmentFallback(capability, "DATABASE_CONFIG_UNAVAILABLE");
  }
}
