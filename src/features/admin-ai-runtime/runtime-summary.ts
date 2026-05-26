import type { AIRuntimeStatusPayload } from "@/features/admin-ai-runtime/api";

export interface AIRuntimeDisplaySummary {
  capability: AIRuntimeStatusPayload["capability"];
  capabilityLabel: string;
  sourceLabel: string;
  providerLabel: string;
  statusLabel: string;
  modelOrEndpointLabel: string;
  baseUrlHostLabel: string;
  apiKeyLabel: string;
  errorCode: string | null;
}

function getProviderLabel(provider: string) {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
    case "volcengine_ark":
      return "Volcengine Ark";
    default:
      return provider || "未配置";
  }
}

function getSourceLabel(status: AIRuntimeStatusPayload) {
  if (status.source === "database") {
    return status.fallbackReason ? "数据库配置回退" : "数据库配置";
  }

  if (status.source === "environment") {
    return "环境变量";
  }

  return "未接通";
}

function getApiKeyLabel(status: AIRuntimeStatusPayload) {
  if (status.source === "database") {
    return status.publishedConfig?.apiKeyMask ?? (status.configSummary.hasApiKey ? "已配置" : "未配置");
  }

  if (status.configSummary.hasApiKey) {
    return "已配置（环境变量）";
  }

  return "未配置";
}

export function summarizeAIRuntimeStatus(status: AIRuntimeStatusPayload): AIRuntimeDisplaySummary {
  return {
    capability: status.capability,
    capabilityLabel: status.capability === "chat" ? "聊天" : "向量",
    sourceLabel: getSourceLabel(status),
    providerLabel: getProviderLabel(status.provider),
    statusLabel: status.available ? "可用" : "待处理",
    modelOrEndpointLabel: status.configSummary.modelOrEndpoint ?? "未配置",
    baseUrlHostLabel: status.configSummary.baseUrlHost ?? "Host 不可识别",
    apiKeyLabel: getApiKeyLabel(status),
    errorCode: status.available ? null : status.code
  };
}

export function summarizeAIRuntimeStatuses(statuses: AIRuntimeStatusPayload[]) {
  return statuses.map(summarizeAIRuntimeStatus);
}
