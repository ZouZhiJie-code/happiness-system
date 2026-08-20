import { AIProviderError } from "@/server/services/ai/ai-provider";
import { OpenAIProvider } from "@/server/services/ai/openai.provider";
import {
  GI088_DEEPSEEK_PRO_RUNTIME_POLICY,
  GI088_TIMEOUT_POLICY
} from "@/server/services/evaluation/gi088/candidate";

export type Gi088ProRuntimeConfigurationCode =
  | "GI088_DEEPSEEK_API_KEY_MISSING"
  | "GI088_DEEPSEEK_BASE_URL_MISMATCH";

export class Gi088ProRuntimeConfigurationError extends AIProviderError {
  readonly category = "configuration" as const;

  constructor(code: Gi088ProRuntimeConfigurationCode) {
    super(code, code);
    this.name = "Gi088ProRuntimeConfigurationError";
  }
}

function trimEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/^['"]|['"]$/g, "") : null;
}

export function resolveGi088ProRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
) {
  const apiKey = trimEnv(env[GI088_DEEPSEEK_PRO_RUNTIME_POLICY.apiKeyEnv]);
  if (!apiKey) {
    throw new Gi088ProRuntimeConfigurationError(
      "GI088_DEEPSEEK_API_KEY_MISSING"
    );
  }
  const configuredBaseUrl =
    trimEnv(env.DEEPSEEK_BASE_URL) ??
    GI088_DEEPSEEK_PRO_RUNTIME_POLICY.baseUrl;
  let normalizedBaseUrl: string;
  try {
    normalizedBaseUrl = new URL(configuredBaseUrl)
      .toString()
      .replace(/\/$/u, "");
  } catch {
    throw new Gi088ProRuntimeConfigurationError(
      "GI088_DEEPSEEK_BASE_URL_MISMATCH"
    );
  }
  if (normalizedBaseUrl !== GI088_DEEPSEEK_PRO_RUNTIME_POLICY.baseUrl) {
    throw new Gi088ProRuntimeConfigurationError(
      "GI088_DEEPSEEK_BASE_URL_MISMATCH"
    );
  }
  return {
    apiKey,
    baseUrl: normalizedBaseUrl,
    model: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.model,
    summary: {
      provider: "openai" as const,
      transport: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.transport,
      baseUrlHost: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.baseUrlHost,
      model: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.model
    }
  };
}

export function createGi088ProProvider(env: NodeJS.ProcessEnv = process.env) {
  const resolved = resolveGi088ProRuntimeConfig(env);
  return new OpenAIProvider({
    apiKey: resolved.apiKey,
    baseUrl: resolved.baseUrl,
    model: resolved.model,
    timeoutMs: GI088_TIMEOUT_POLICY.hardTimeoutMs
  });
}
