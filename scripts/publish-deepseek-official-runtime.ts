import { getAIRuntimeDraft, probeAIRuntimeDraft, publishAIRuntimeDraft, saveAIRuntimeDraft } from "../src/server/services/admin-ai-runtime/admin-ai-runtime.service";
import { getAIProviderStatus } from "../src/server/services/ai";

const confirmation = process.env.ALLOW_DEEPSEEK_OFFICIAL_RUNTIME_PUBLISH;
const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-flash";
const baseUrl = process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com";
const actorUsername = process.env.AI_RUNTIME_PUBLISH_ACTOR?.trim() || "product_owner";

if (confirmation !== "I_UNDERSTAND") {
  throw new Error("设置 ALLOW_DEEPSEEK_OFFICIAL_RUNTIME_PUBLISH=I_UNDERSTAND 后才能发布官方运行配置。");
}

if (!apiKey || !apiKey.startsWith("sk-")) {
  throw new Error("DEEPSEEK_API_KEY 缺失或格式无效。");
}

const parsedBaseUrl = new URL(baseUrl);
if (parsedBaseUrl.protocol !== "https:" || parsedBaseUrl.hostname.toLowerCase() !== "api.deepseek.com") {
  throw new Error("DEEPSEEK_BASE_URL 必须指向 https://api.deepseek.com。");
}

const draft = await saveAIRuntimeDraft({
  capability: "chat",
  actorUsername,
  input: {
    provider: "openai",
    enabled: true,
    displayName: "DeepSeek 官方 API · deepseek-v4-flash",
    apiKey,
    config: {
      model,
      baseUrl
    }
  }
});
const probe = await probeAIRuntimeDraft({
  capability: "chat",
  actorUsername
});
const published = await publishAIRuntimeDraft({
  capability: "chat",
  actorUsername
});
const status = await getAIProviderStatus("chat");

console.log(JSON.stringify({
  action: "deepseek_official_runtime_published",
  draftId: draft.id,
  probe: {
    id: probe.id,
    success: probe.success,
    httpStatus: probe.httpStatus,
    errorCode: probe.errorCode,
    latencyMs: probe.latencyMs
  },
  published: {
    id: published.id,
    provider: published.provider,
    version: published.version,
    publishedAt: published.publishedAt?.toISOString() ?? null
  },
  activeStatus: {
    available: status.available,
    provider: status.provider,
    source: status.source,
    baseUrlHost: status.configSummary.baseUrlHost,
    model: status.configSummary.modelOrEndpoint
  }
}));
