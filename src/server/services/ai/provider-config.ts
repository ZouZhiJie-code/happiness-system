const DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

export type AIProviderStatusState = "ready" | "disabled" | "unsupported" | "config_invalid";

export type AIProviderStatusCode =
  | "READY"
  | "PROVIDER_DISABLED"
  | "UNKNOWN_PROVIDER"
  | "MISSING_API_KEY"
  | "MISSING_MODEL"
  | "PLACEHOLDER_API_KEY"
  | "PLACEHOLDER_MODEL"
  | "PLACEHOLDER_BASE_URL"
  | "INVALID_BASE_URL";

export interface AIProviderConfigSummary {
  hasApiKey: boolean;
  hasModel: boolean;
  hasBaseUrl: boolean;
  modelSource: "VOLCENGINE_ARK_MODEL" | "ARK_MODEL" | "VOLCENGINE_ARK_ENDPOINT_ID" | "ARK_ENDPOINT_ID" | null;
  baseUrlHost: string | null;
}

export interface AIProviderStatus {
  provider: string;
  available: boolean;
  state: AIProviderStatusState;
  code: AIProviderStatusCode;
  issues: AIProviderStatusCode[];
  configSummary: AIProviderConfigSummary;
}

export interface VolcengineArkConfig {
  apiKey: string | null;
  model: string | null;
  baseUrl: string;
  modelSource: AIProviderConfigSummary["modelSource"];
  issues: AIProviderStatusCode[];
  baseUrlHost: string | null;
}

function trimEnvValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/^['"]|['"]$/g, "") : null;
}

function looksLikePlaceholder(value: string | null) {
  if (!value) {
    return false;
  }

  return /^\$[A-Z0-9_]+(?:\\n)?$/u.test(value);
}

function parseBaseUrlHost(value: string | null) {
  if (!value || looksLikePlaceholder(value)) {
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

export function readVolcengineArkConfig(env: NodeJS.ProcessEnv = process.env): VolcengineArkConfig {
  const apiKey = trimEnvValue(env.VOLCENGINE_ARK_API_KEY) ?? trimEnvValue(env.ARK_API_KEY);
  const modelCandidates = [
    ["VOLCENGINE_ARK_MODEL", trimEnvValue(env.VOLCENGINE_ARK_MODEL)],
    ["ARK_MODEL", trimEnvValue(env.ARK_MODEL)],
    ["VOLCENGINE_ARK_ENDPOINT_ID", trimEnvValue(env.VOLCENGINE_ARK_ENDPOINT_ID)],
    ["ARK_ENDPOINT_ID", trimEnvValue(env.ARK_ENDPOINT_ID)]
  ] as const;
  const modelEntry = modelCandidates.find(([, value]) => Boolean(value)) ?? null;
  const model = modelEntry?.[1] ?? null;
  const modelSource = modelEntry?.[0] ?? null;
  const baseUrl = trimEnvValue(env.VOLCENGINE_ARK_BASE_URL) ?? trimEnvValue(env.ARK_BASE_URL) ?? DEFAULT_BASE_URL;

  const issues: AIProviderStatusCode[] = [];

  if (!apiKey) {
    issues.push("MISSING_API_KEY");
  } else if (looksLikePlaceholder(apiKey)) {
    issues.push("PLACEHOLDER_API_KEY");
  }

  if (!model) {
    issues.push("MISSING_MODEL");
  } else if (looksLikePlaceholder(model)) {
    issues.push("PLACEHOLDER_MODEL");
  }

  const baseUrlHost = parseBaseUrlHost(baseUrl);
  if (looksLikePlaceholder(baseUrl)) {
    issues.push("PLACEHOLDER_BASE_URL");
  } else if (!baseUrlHost) {
    issues.push("INVALID_BASE_URL");
  }

  return {
    apiKey,
    model,
    baseUrl,
    modelSource,
    issues,
    baseUrlHost
  };
}

export function getAIProviderStatus(env: NodeJS.ProcessEnv = process.env): AIProviderStatus {
  const provider = (trimEnvValue(env.AI_PROVIDER) ?? "volcengine-ark").toLowerCase();

  if (provider === "disabled") {
    return {
      provider,
      available: false,
      state: "disabled",
      code: "PROVIDER_DISABLED",
      issues: ["PROVIDER_DISABLED"],
      configSummary: {
        hasApiKey: false,
        hasModel: false,
        hasBaseUrl: false,
        modelSource: null,
        baseUrlHost: null
      }
    };
  }

  if (provider !== "volcengine-ark" && provider !== "ark") {
    return {
      provider,
      available: false,
      state: "unsupported",
      code: "UNKNOWN_PROVIDER",
      issues: ["UNKNOWN_PROVIDER"],
      configSummary: {
        hasApiKey: false,
        hasModel: false,
        hasBaseUrl: false,
        modelSource: null,
        baseUrlHost: null
      }
    };
  }

  const config = readVolcengineArkConfig(env);

  return {
    provider,
    available: config.issues.length === 0,
    state: config.issues.length === 0 ? "ready" : "config_invalid",
    code: config.issues[0] ?? "READY",
    issues: config.issues,
    configSummary: {
      hasApiKey: Boolean(config.apiKey),
      hasModel: Boolean(config.model),
      hasBaseUrl: Boolean(config.baseUrl),
      modelSource: config.modelSource,
      baseUrlHost: config.baseUrlHost
    }
  };
}

export function formatAIProviderUnavailableCode(prefix: string, status: AIProviderStatus = getAIProviderStatus()) {
  return `${prefix}_${status.code}`;
}

export { DEFAULT_BASE_URL };
