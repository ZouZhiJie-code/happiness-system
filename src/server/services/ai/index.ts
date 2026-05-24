import { logger } from "@/server/lib/logger";
import { AIProviderError, type AIProvider } from "@/server/services/ai/ai-provider";
import {
  formatAIProviderUnavailableCode,
  getAIProviderStatus,
  type AIProviderStatus
} from "@/server/services/ai/provider-config";
import { VolcengineArkProvider } from "@/server/services/ai/volcengine-ark.provider";

let hasLoggedProviderReady = false;
let lastLoggedProviderUnavailableCode: string | null = null;

function logUnavailableProvider(status: AIProviderStatus, error?: unknown) {
  if (lastLoggedProviderUnavailableCode === status.code) {
    return;
  }

  logger.warn(
    {
      err: error,
      provider: status.provider,
      state: status.state,
      code: status.code,
      issues: status.issues,
      configSummary: status.configSummary
    },
    "AI provider unavailable, fallback logic will be used."
  );
  lastLoggedProviderUnavailableCode = status.code;
}

export function getAIProvider(): AIProvider | null {
  const status = getAIProviderStatus();

  if (!status.available) {
    logUnavailableProvider(status);
    return null;
  }

  if (status.provider === "volcengine-ark" || status.provider === "ark") {
    try {
      const aiProvider = new VolcengineArkProvider();

      if (!hasLoggedProviderReady) {
        logger.info(
          {
            provider: aiProvider.name,
            modelConfigured: status.configSummary.hasModel,
            modelSource: status.configSummary.modelSource,
            baseUrlHost: status.configSummary.baseUrlHost
          },
          "AI provider initialized successfully."
        );
        hasLoggedProviderReady = true;
      }
      lastLoggedProviderUnavailableCode = null;

      return aiProvider;
    } catch (error) {
      logUnavailableProvider(
        {
          ...status,
          available: false,
          state: "config_invalid",
          code:
            error instanceof AIProviderError && error.code === "INVALID_BASE_URL"
              ? "INVALID_BASE_URL"
              : error instanceof AIProviderError && error.code === "INVALID_API_KEY"
                ? "PLACEHOLDER_API_KEY"
                : error instanceof AIProviderError && error.code === "INVALID_MODEL"
                  ? "PLACEHOLDER_MODEL"
                  : status.code,
          issues:
            error instanceof AIProviderError && error.code === "INVALID_BASE_URL"
              ? ["INVALID_BASE_URL"]
              : error instanceof AIProviderError && error.code === "INVALID_API_KEY"
                ? ["PLACEHOLDER_API_KEY"]
                : error instanceof AIProviderError && error.code === "INVALID_MODEL"
                  ? ["PLACEHOLDER_MODEL"]
                  : status.issues
        },
        error
      );

      return null;
    }
  }

  logUnavailableProvider(status);
  return null;
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

export async function probeAIProvider() {
  const status = getAIProviderStatus();

  if (!status.available) {
    return {
      ok: false,
      attempted: false,
      provider: status.provider,
      code: status.code,
      status: null,
      latencyMs: null
    };
  }

  const provider = getAIProvider();

  if (!provider) {
    const currentStatus = getAIProviderStatus();

    return {
      ok: false,
      attempted: false,
      provider: currentStatus.provider,
      code: currentStatus.code,
      status: null,
      latencyMs: null
    };
  }

  try {
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

export { formatAIProviderUnavailableCode, getAIProviderStatus };
