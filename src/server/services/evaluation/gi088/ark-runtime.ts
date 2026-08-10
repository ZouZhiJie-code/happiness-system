import { OpenAIProvider } from "@/server/services/ai/openai.provider";
import { AIProviderError } from "@/server/services/ai/ai-provider";
import {
  GI088_ARK_FLASH_RUNTIME_POLICY,
  GI088_V7R3_TIMEOUT_POLICY
} from "@/server/services/evaluation/gi088/candidate";

export type Gi088ArkRuntimeConfigurationCode =
  | "GI088_ARK_API_KEY_MISSING"
  | "GI088_ARK_BASE_URL_MISMATCH";

export class Gi088ArkRuntimeConfigurationError extends AIProviderError {
  readonly category = "configuration" as const;

  constructor(code: Gi088ArkRuntimeConfigurationCode) {
    super(code, code);
    this.name = "Gi088ArkRuntimeConfigurationError";
  }
}

function trimEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/^['"]|['"]$/g, "") : null;
}

export function resolveGi088ArkRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
) {
  const apiKey = trimEnv(env[GI088_ARK_FLASH_RUNTIME_POLICY.apiKeyEnv]);
  if (!apiKey) {
    throw new Gi088ArkRuntimeConfigurationError("GI088_ARK_API_KEY_MISSING");
  }

  const configuredBaseUrl =
    trimEnv(env.VOLCENGINE_ARK_BASE_URL) ??
    GI088_ARK_FLASH_RUNTIME_POLICY.baseUrl;
  let normalizedBaseUrl: string;
  try {
    const parsed = new URL(configuredBaseUrl);
    normalizedBaseUrl = parsed.toString().replace(/\/$/u, "");
  } catch {
    throw new Gi088ArkRuntimeConfigurationError(
      "GI088_ARK_BASE_URL_MISMATCH"
    );
  }
  if (normalizedBaseUrl !== GI088_ARK_FLASH_RUNTIME_POLICY.baseUrl) {
    throw new Gi088ArkRuntimeConfigurationError(
      "GI088_ARK_BASE_URL_MISMATCH"
    );
  }

  return {
    apiKey,
    baseUrl: normalizedBaseUrl,
    model: GI088_ARK_FLASH_RUNTIME_POLICY.model,
    summary: {
      provider: "openai" as const,
      transport: GI088_ARK_FLASH_RUNTIME_POLICY.transport,
      baseUrlHost: GI088_ARK_FLASH_RUNTIME_POLICY.baseUrlHost,
      model: GI088_ARK_FLASH_RUNTIME_POLICY.model
    }
  };
}

export function createGi088ArkProvider(
  env: NodeJS.ProcessEnv = process.env
) {
  const resolved = resolveGi088ArkRuntimeConfig(env);
  return new OpenAIProvider({
    apiKey: resolved.apiKey,
    baseUrl: resolved.baseUrl,
    model: resolved.model,
    timeoutMs: GI088_V7R3_TIMEOUT_POLICY.hardTimeoutMs
  });
}
