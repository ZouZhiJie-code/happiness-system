import type { AIRuntimeCapability } from "@/features/admin-ai-runtime/types";
import { logger } from "@/server/lib/logger";
import { AIProviderError, type AIProvider } from "@/server/services/ai/ai-provider";
import { readVolcengineArkConfig } from "@/server/services/ai/provider-config";
import { resolveAIRuntimeConfig, type AIRuntimeResolution } from "@/server/services/ai/runtime-config-resolver";
import { createRuntimeAIProvider } from "@/server/services/ai/runtime-provider-factory";

export type AIProviderStatusState = "ready" | "config_invalid";

export type AIProviderStatusCode =
  | "READY"
  | "PROVIDER_NOT_CONFIGURED"
  | "MISSING_API_KEY"
  | "MISSING_MODEL"
  | "MISSING_EMBEDDING_ENDPOINT_ID"
  | "PLACEHOLDER_API_KEY"
  | "PLACEHOLDER_MODEL"
  | "PLACEHOLDER_BASE_URL"
  | "INVALID_BASE_URL"
  | "DATABASE_CONFIG_DISABLED"
  | "DATABASE_CONFIG_UNAVAILABLE"
  | "UNKNOWN_ERROR";

export interface AIProviderConfigSummary {
  hasApiKey: boolean;
  hasModel: boolean;
  hasBaseUrl: boolean;
  modelSource: string | null;
  modelOrEndpoint: string | null;
  baseUrl: string | null;
  baseUrlHost: string | null;
}

export interface AIProviderStatus {
  capability: AIRuntimeCapability;
  provider: string;
  available: boolean;
  state: AIProviderStatusState;
  source: "database" | "environment" | null;
  code: AIProviderStatusCode;
  issues: AIProviderStatusCode[];
  fallbackReason: string | null;
  configSummary: AIProviderConfigSummary;
}

const hasLoggedProviderReady = new Set<string>();
const lastLoggedProviderUnavailableCode = new Map<string, string | null>();

function parseBaseUrlHost(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.host || null;
  } catch {
    return null;
  }
}

function buildConfigSummary(resolution: AIRuntimeResolution): AIProviderConfigSummary {
  const config = resolution.config.config;
  const baseUrl = config.baseUrl;

  if (resolution.provider === "volcengine_ark" && resolution.capability === "chat") {
    if ("endpointId" in config && config.endpointId) {
      return {
        hasApiKey: true,
        hasModel: true,
        hasBaseUrl: true,
        modelSource: "VOLCENGINE_ARK_ENDPOINT_ID",
        modelOrEndpoint: config.endpointId,
        baseUrl,
        baseUrlHost: parseBaseUrlHost(baseUrl)
      };
    }

    return {
      hasApiKey: true,
      hasModel: true,
      hasBaseUrl: true,
      modelSource: "VOLCENGINE_ARK_MODEL",
      modelOrEndpoint: "modelId" in config ? config.modelId ?? null : null,
      baseUrl,
      baseUrlHost: parseBaseUrlHost(baseUrl)
    };
  }

  if (resolution.provider === "volcengine_ark" && resolution.capability === "embedding") {
    return {
      hasApiKey: true,
      hasModel: true,
      hasBaseUrl: true,
      modelSource: "VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID",
      modelOrEndpoint: "embeddingEndpointId" in config ? config.embeddingEndpointId : null,
      baseUrl,
      baseUrlHost: parseBaseUrlHost(baseUrl)
    };
  }

  return {
    hasApiKey: true,
    hasModel: "model" in config || "anthropicVersion" in config,
    hasBaseUrl: Boolean(baseUrl),
    modelSource: resolution.source === "database" ? "DATABASE_CONFIG" : null,
    modelOrEndpoint: "model" in config ? config.model : null,
    baseUrl,
    baseUrlHost: parseBaseUrlHost(baseUrl)
  };
}

function buildReadyStatus(resolution: AIRuntimeResolution): AIProviderStatus {
  return {
    capability: resolution.capability,
    provider: resolution.provider,
    available: true,
    state: "ready",
    source: resolution.source,
    code: "READY",
    issues: [],
    fallbackReason: resolution.fallbackReason,
    configSummary: buildConfigSummary(resolution)
  };
}

function buildUnavailableStatus(capability: AIRuntimeCapability): AIProviderStatus {
  const config = readVolcengineArkConfig();
  const issues = [...config.issues] as AIProviderStatusCode[];

  if (capability === "embedding" && !process.env.VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID?.trim()) {
    issues.push("MISSING_EMBEDDING_ENDPOINT_ID");
  }

  const normalizedIssues = issues as AIProviderStatusCode[];

  return {
    capability,
    provider: "volcengine_ark",
    available: false,
    state: "config_invalid",
    source: null,
    code: normalizedIssues[0] ?? "PROVIDER_NOT_CONFIGURED",
    issues: normalizedIssues.length > 0 ? normalizedIssues : ["PROVIDER_NOT_CONFIGURED"],
    fallbackReason: null,
    configSummary: {
      hasApiKey: Boolean(config.apiKey),
      hasModel:
        capability === "embedding"
          ? Boolean(process.env.VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID?.trim())
          : Boolean(config.model),
      hasBaseUrl: Boolean(config.baseUrl),
      modelSource:
        capability === "embedding"
          ? process.env.VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID?.trim()
            ? "VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID"
            : null
          : config.modelSource,
      modelOrEndpoint:
        capability === "embedding"
          ? process.env.VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID?.trim() ?? null
          : config.model,
      baseUrl: config.baseUrl,
      baseUrlHost: config.baseUrlHost
    }
  };
}

function logUnavailableProvider(status: AIProviderStatus, error?: unknown) {
  const key = status.capability;

  if (lastLoggedProviderUnavailableCode.get(key) === status.code) {
    return;
  }

  logger.warn(
    {
      err: error,
      capability: status.capability,
      provider: status.provider,
      source: status.source,
      state: status.state,
      code: status.code,
      issues: status.issues,
      fallbackReason: status.fallbackReason,
      configSummary: status.configSummary
    },
    "AI provider unavailable, fallback logic will be used."
  );
  lastLoggedProviderUnavailableCode.set(key, status.code);
}

export async function getAIProviderStatus(capability: AIRuntimeCapability): Promise<AIProviderStatus> {
  const resolution = await resolveAIRuntimeConfig(capability);

  if (!resolution) {
    return buildUnavailableStatus(capability);
  }

  return buildReadyStatus(resolution);
}

export async function getAIProvider(capability: AIRuntimeCapability): Promise<AIProvider | null> {
  const resolution = await resolveAIRuntimeConfig(capability);

  if (!resolution) {
    const status = buildUnavailableStatus(capability);
    logUnavailableProvider(status);
    return null;
  }

  const status = buildReadyStatus(resolution);

  try {
    const provider = createRuntimeAIProvider({
      capability,
      apiKey: resolution.apiKey,
      config: resolution.config
    });
    const logKey = `${capability}:${provider.name}:${status.source}`;

    if (!hasLoggedProviderReady.has(logKey)) {
      logger.info(
        {
          capability,
          provider: provider.name,
          source: status.source,
          fallbackReason: status.fallbackReason,
          configSummary: status.configSummary
        },
        "AI provider initialized successfully."
      );
      hasLoggedProviderReady.add(logKey);
    }

    lastLoggedProviderUnavailableCode.set(capability, null);
    return provider;
  } catch (error) {
    logUnavailableProvider(
      {
        ...status,
        available: false,
        state: "config_invalid",
        source: null,
        code:
          error instanceof AIProviderError && error.code === "INVALID_BASE_URL"
            ? "INVALID_BASE_URL"
            : error instanceof AIProviderError && error.code === "MISSING_MODEL"
              ? "MISSING_MODEL"
              : error instanceof AIProviderError && error.code === "MISSING_EMBEDDING_ENDPOINT_ID"
                ? "MISSING_EMBEDDING_ENDPOINT_ID"
                : "UNKNOWN_ERROR",
        issues: [
          error instanceof AIProviderError && error.code === "INVALID_BASE_URL"
            ? "INVALID_BASE_URL"
            : error instanceof AIProviderError && error.code === "MISSING_MODEL"
              ? "MISSING_MODEL"
              : error instanceof AIProviderError && error.code === "MISSING_EMBEDDING_ENDPOINT_ID"
                ? "MISSING_EMBEDDING_ENDPOINT_ID"
                : "UNKNOWN_ERROR"
        ]
      },
      error
    );

    return null;
  }
}

function parseUpstreamProviderErrorCode(message: string) {
  try {
    const payload = JSON.parse(message) as {
      error?: {
        code?: string;
      };
    };

    return payload.error?.code ? String(payload.error.code).toUpperCase() : null;
  } catch {
    return null;
  }
}

export async function probeAIProvider(capability: AIRuntimeCapability) {
  const provider = await getAIProvider(capability);
  const status = await getAIProviderStatus(capability);

  if (!provider) {
    return {
      ok: false,
      attempted: false,
      provider: status.provider,
      code: status.code,
      status: null,
      latencyMs: null
    };
  }

  try {
    const startedAt = Date.now();

    if (capability === "chat") {
      const result = await provider.complete({
        messages: [{ role: "user", content: "ping" }],
        temperature: 0,
        maxTokens: 8,
        timeoutMs: 10_000
      });

      return {
        ok: true,
        attempted: true,
        provider: provider.name,
        code: "READY",
        status: 200,
        latencyMs: result.latencyMs
      };
    }

    if (!provider.embed) {
      return {
        ok: false,
        attempted: true,
        provider: provider.name,
        code: "MISSING_EMBEDDING_ENDPOINT_ID",
        status: null,
        latencyMs: null
      };
    }

    await provider.embed({ input: "ping" });

    return {
      ok: true,
      attempted: true,
      provider: provider.name,
      code: "READY",
      status: 200,
      latencyMs: Date.now() - startedAt
    };
  } catch (error) {
    const upstreamCode =
      error instanceof AIProviderError && error.code === "UPSTREAM_HTTP_ERROR" && error.message
        ? parseUpstreamProviderErrorCode(error.message)
        : null;

    return {
      ok: false,
      attempted: true,
      provider: provider.name,
      code: upstreamCode ?? (error instanceof AIProviderError ? error.code : "UNKNOWN_ERROR"),
      status: error instanceof AIProviderError ? error.status ?? null : null,
      latencyMs: null
    };
  }
}

export function formatAIProviderUnavailableCode(prefix: string, status: Pick<AIProviderStatus, "code">) {
  return `${prefix}_${status.code}`;
}
