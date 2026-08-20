import { getEventCenteredProductScope } from "@/features/interview/event-centered-release";
import { getAIProvider } from "@/server/services/ai";
import type { AIProvider } from "@/server/services/ai/ai-provider";
import { readDeepSeekConfig } from "@/server/services/ai/provider-config";
import { createRuntimeAIProvider } from "@/server/services/ai/runtime-provider-factory";

export const EVENT_CENTERED_GENERATIVE_MODEL_ENV =
  "EVENT_CENTERED_GENERATIVE_MODEL" as const;
export const EVENT_CENTERED_CANDIDATE_PROVIDER = "openai" as const;
export const EVENT_CENTERED_CANDIDATE_MODEL = "deepseek-v4-flash" as const;
export const EVENT_CENTERED_COMPLETE_RESPONSE_MODEL = "deepseek-v4-pro" as const;
export const EVENT_CENTERED_CANDIDATE_BASE_URL = "https://api.deepseek.com" as const;
export const EVENT_CENTERED_CANDIDATE_BASE_URL_HOST = "api.deepseek.com" as const;

export type EventCenteredCandidateConfigurationCode =
  | "EVENT_CENTERED_CANDIDATE_PROVIDER_MISMATCH"
  | "EVENT_CENTERED_CANDIDATE_API_KEY_MISSING"
  | "EVENT_CENTERED_CANDIDATE_MODEL_MISMATCH"
  | "EVENT_CENTERED_CANDIDATE_BASE_URL_MISMATCH";

export type EventCenteredCandidateProviderSummary = {
  provider: typeof EVENT_CENTERED_CANDIDATE_PROVIDER;
  model:
    | typeof EVENT_CENTERED_CANDIDATE_MODEL
    | typeof EVENT_CENTERED_COMPLETE_RESPONSE_MODEL;
  baseUrlHost: typeof EVENT_CENTERED_CANDIDATE_BASE_URL_HOST;
};

export class EventCenteredCandidateConfigurationError extends Error {
  readonly category = "configuration" as const;

  constructor(readonly code: EventCenteredCandidateConfigurationCode) {
    super(code);
    this.name = "EventCenteredCandidateConfigurationError";
  }
}

export function readEventCenteredGenerativeModel(
  env: NodeJS.ProcessEnv = process.env
) {
  const value = env[EVENT_CENTERED_GENERATIVE_MODEL_ENV]?.trim();
  return value ? value.replace(/^['"]|['"]$/g, "") : null;
}

/** 历史兼容导出；GI-065 候选只接受官方 DeepSeek，因此不再映射 Ark 模型。 */
export function resolveEventCenteredProviderModel(model: string, provider: string) {
  return provider === EVENT_CENTERED_CANDIDATE_PROVIDER ? model : model;
}

function normalizedProvider(env: NodeJS.ProcessEnv) {
  return env.AI_PROVIDER?.trim().replace(/^['"]|['"]$/g, "").toLowerCase() ?? "openai";
}

function completeResponseV16Requested(env: NodeJS.ProcessEnv) {
  return env.INTERVIEW_EVENT_CENTERED_STRATEGY?.trim().toLowerCase() ===
    "complete_response_v1_6";
}

function completeResponseV18Requested(env: NodeJS.ProcessEnv) {
  return env.INTERVIEW_EVENT_CENTERED_STRATEGY?.trim().toLowerCase() ===
    "complete_response_v1_8";
}

function completeResponseProRequested(env: NodeJS.ProcessEnv) {
  return completeResponseV16Requested(env) || completeResponseV18Requested(env);
}

function expectedEventCenteredModel(env: NodeJS.ProcessEnv) {
  return completeResponseProRequested(env)
    ? EVENT_CENTERED_COMPLETE_RESPONSE_MODEL
    : EVENT_CENTERED_CANDIDATE_MODEL;
}

function candidateRequested(env: NodeJS.ProcessEnv) {
  return getEventCenteredProductScope({
    INTERVIEW_EVENT_CENTERED_SCOPE: env.INTERVIEW_EVENT_CENTERED_SCOPE
  }) === "thought_only" || completeResponseProRequested(env) ||
    readEventCenteredGenerativeModel(env) !== null;
}

export function resolveEventCenteredCandidateProviderConfig(
  env: NodeJS.ProcessEnv = process.env
) {
  const provider = normalizedProvider(env);
  if (provider !== EVENT_CENTERED_CANDIDATE_PROVIDER) {
    throw new EventCenteredCandidateConfigurationError(
      "EVENT_CENTERED_CANDIDATE_PROVIDER_MISMATCH"
    );
  }

  const config = readDeepSeekConfig(env);
  if (!config.apiKey || config.issues.includes("MISSING_API_KEY") || config.issues.includes("PLACEHOLDER_API_KEY")) {
    throw new EventCenteredCandidateConfigurationError(
      "EVENT_CENTERED_CANDIDATE_API_KEY_MISSING"
    );
  }

  const expectedModel = expectedEventCenteredModel(env);
  const model = readEventCenteredGenerativeModel(env) ?? config.model;
  if (model !== expectedModel) {
    throw new EventCenteredCandidateConfigurationError(
      "EVENT_CENTERED_CANDIDATE_MODEL_MISMATCH"
    );
  }

  if (
    config.baseUrlHost?.toLowerCase() !== EVENT_CENTERED_CANDIDATE_BASE_URL_HOST ||
    new URL(config.baseUrl).protocol !== "https:"
  ) {
    throw new EventCenteredCandidateConfigurationError(
      "EVENT_CENTERED_CANDIDATE_BASE_URL_MISMATCH"
    );
  }

  return {
    apiKey: config.apiKey,
    runtimeConfig: {
      provider: EVENT_CENTERED_CANDIDATE_PROVIDER,
      config: {
        model: expectedModel,
        baseUrl: EVENT_CENTERED_CANDIDATE_BASE_URL
      }
    } as const,
    summary: {
      provider: EVENT_CENTERED_CANDIDATE_PROVIDER,
      model: expectedModel,
      baseUrlHost: EVENT_CENTERED_CANDIDATE_BASE_URL_HOST
    } satisfies EventCenteredCandidateProviderSummary
  };
}

type EventCenteredProviderDependencies = {
  env?: NodeJS.ProcessEnv;
  getFallbackProvider?: typeof getAIProvider;
  createProvider?: typeof createRuntimeAIProvider;
  /** 历史测试/调用兼容；GI-065 候选不再读取共享运行配置。 */
  resolveConfig?: unknown;
};

/**
 * GI-065 候选使用独立事实源，避免继承共享聊天配置中的旧 Ark。
 * 未启用候选时继续沿用历史通用 Provider，保证旧四角度数据可读取与回放。
 */
export async function getEventCenteredAIProvider(
  dependencies: EventCenteredProviderDependencies = {}
): Promise<AIProvider | null> {
  const env = dependencies.env ?? process.env;
  if (!candidateRequested(env)) {
    return (dependencies.getFallbackProvider ?? getAIProvider)("chat");
  }

  const resolved = resolveEventCenteredCandidateProviderConfig(env);
  return (dependencies.createProvider ?? createRuntimeAIProvider)({
    capability: "chat",
    apiKey: resolved.apiKey,
    config: resolved.runtimeConfig
  });
}

/** Preview 和部署前共用的真实最小调用。返回值只包含非敏感配置与耗时。 */
export async function preflightEventCenteredCandidateProvider(input: {
  env?: NodeJS.ProcessEnv;
  createProvider?: typeof createRuntimeAIProvider;
} = {}) {
  const env = input.env ?? process.env;
  const resolved = resolveEventCenteredCandidateProviderConfig(env);
  const provider = (input.createProvider ?? createRuntimeAIProvider)({
    capability: "chat",
    apiKey: resolved.apiKey,
    config: resolved.runtimeConfig,
    timeoutMs: 15_000
  });
  const result = await provider.complete({
    messages: [
      { role: "system", content: "你是连通性检查。" },
      { role: "user", content: "只回复 OK" }
    ],
    temperature: 0,
    maxTokens: 8,
    thinking: "disabled",
    timeoutMs: 15_000
  });
  return {
    ...resolved.summary,
    latencyMs: result.latencyMs,
    reachable: Boolean(result.content.trim())
  };
}
