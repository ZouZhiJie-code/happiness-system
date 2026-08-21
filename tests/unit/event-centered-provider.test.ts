import { describe, expect, it, vi } from "vitest";

import type { AIProvider } from "@/server/services/ai/ai-provider";
import {
  getEventCenteredAIProvider,
  readEventCenteredGenerativeModel,
  resolveEventCenteredProviderModel
} from "@/server/services/ai/event-centered-provider";

const provider = (name: string): AIProvider => ({
  name,
  complete: vi.fn()
});

describe("event-centered AI provider", () => {
  it("环境变量为空时沿用通用 chat provider", async () => {
    const fallback = provider("shared-chat");
    const getFallbackProvider = vi.fn(async () => fallback);
    const resolveConfig = vi.fn();
    const createProvider = vi.fn();

    const result = await getEventCenteredAIProvider({
      env: { NODE_ENV: "test" },
      getFallbackProvider,
      resolveConfig,
      createProvider
    });

    expect(result).toBe(fallback);
    expect(getFallbackProvider).toHaveBeenCalledWith("chat");
    expect(resolveConfig).not.toHaveBeenCalled();
    expect(createProvider).not.toHaveBeenCalled();
  });

  it("显式候选固定使用 DeepSeek 官方凭据、地址和模型", async () => {
    const isolated = provider("isolated-event-centered");
    const createProvider = vi.fn(() => isolated);
    const getFallbackProvider = vi.fn();
    const resolveConfig = vi.fn();

    const result = await getEventCenteredAIProvider({
      env: {
        NODE_ENV: "test",
        INTERVIEW_EVENT_CENTERED_SCOPE: "thought_only",
        AI_PROVIDER: "openai",
        DEEPSEEK_API_KEY: "official-secret",
        DEEPSEEK_BASE_URL: "https://api.deepseek.com",
        DEEPSEEK_MODEL: "deepseek-v4-flash",
        EVENT_CENTERED_GENERATIVE_MODEL: "deepseek-v4-flash"
      },
      getFallbackProvider,
      resolveConfig,
      createProvider
    });

    expect(result).toBe(isolated);
    expect(getFallbackProvider).not.toHaveBeenCalled();
    expect(createProvider).toHaveBeenCalledWith({
      capability: "chat",
      apiKey: "official-secret",
      config: {
        provider: "openai",
        config: {
          model: "deepseek-v4-flash",
          baseUrl: "https://api.deepseek.com"
        }
      }
    });
  });

  it("显式候选缺少官方凭据时抛出配置阻断，避免静默改用旧模型", async () => {
    const getFallbackProvider = vi.fn();
    const createProvider = vi.fn();
    await expect(getEventCenteredAIProvider({
      env: {
        NODE_ENV: "test",
        EVENT_CENTERED_GENERATIVE_MODEL: "deepseek-v4-flash"
      },
      getFallbackProvider,
      resolveConfig: vi.fn(async () => null),
      createProvider
    })).rejects.toMatchObject({ code: "EVENT_CENTERED_CANDIDATE_API_KEY_MISSING" });
    expect(getFallbackProvider).not.toHaveBeenCalled();
    expect(createProvider).not.toHaveBeenCalled();
  });

  it("完整回应 v1.6 使用离线评测一致的 DeepSeek V4 Pro", async () => {
    const isolated = provider("complete-response-v1-6");
    const createProvider = vi.fn(() => isolated);

    const result = await getEventCenteredAIProvider({
      env: {
        NODE_ENV: "test",
        INTERVIEW_EVENT_CENTERED_STRATEGY: "complete_response_v1_6",
        AI_PROVIDER: "openai",
        DEEPSEEK_API_KEY: "official-secret",
        DEEPSEEK_BASE_URL: "https://api.deepseek.com",
        DEEPSEEK_MODEL: "deepseek-v4-pro",
        EVENT_CENTERED_GENERATIVE_MODEL: "deepseek-v4-pro"
      },
      getFallbackProvider: vi.fn(),
      createProvider
    });

    expect(result).toBe(isolated);
    expect(createProvider).toHaveBeenCalledWith({
      capability: "chat",
      apiKey: "official-secret",
      config: {
        provider: "openai",
        config: {
          model: "deepseek-v4-pro",
          baseUrl: "https://api.deepseek.com"
        }
      }
    });
  });

  it("完整回应 v1.6 拒绝退回历史 Flash 模型", async () => {
    await expect(getEventCenteredAIProvider({
      env: {
        NODE_ENV: "test",
        INTERVIEW_EVENT_CENTERED_STRATEGY: "complete_response_v1_6",
        AI_PROVIDER: "openai",
        DEEPSEEK_API_KEY: "official-secret",
        DEEPSEEK_BASE_URL: "https://api.deepseek.com",
        DEEPSEEK_MODEL: "deepseek-v4-pro",
        EVENT_CENTERED_GENERATIVE_MODEL: "deepseek-v4-flash"
      },
      getFallbackProvider: vi.fn(),
      createProvider: vi.fn()
    })).rejects.toMatchObject({ code: "EVENT_CENTERED_CANDIDATE_MODEL_MISMATCH" });
  });

  it("完整回应 v1.8 继续使用离线一致的 DeepSeek V4 Pro", async () => {
    const isolated = provider("complete-response-v1-8");
    const createProvider = vi.fn(() => isolated);

    const result = await getEventCenteredAIProvider({
      env: {
        NODE_ENV: "test",
        INTERVIEW_EVENT_CENTERED_STRATEGY: "complete_response_v1_8",
        AI_PROVIDER: "openai",
        DEEPSEEK_API_KEY: "official-secret",
        DEEPSEEK_BASE_URL: "https://api.deepseek.com",
        DEEPSEEK_MODEL: "deepseek-v4-pro",
        EVENT_CENTERED_GENERATIVE_MODEL: "deepseek-v4-pro"
      },
      getFallbackProvider: vi.fn(),
      createProvider
    });

    expect(result).toBe(isolated);
    expect(createProvider).toHaveBeenCalledWith({
      capability: "chat",
      apiKey: "official-secret",
      config: {
        provider: "openai",
        config: {
          model: "deepseek-v4-pro",
          baseUrl: "https://api.deepseek.com"
        }
      }
    });
  });

  it("完整回应 v1.9 继续使用离线一致的 DeepSeek V4 Pro", async () => {
    const isolated = provider("complete-response-v1-9");
    const createProvider = vi.fn(() => isolated);

    const result = await getEventCenteredAIProvider({
      env: {
        NODE_ENV: "test",
        INTERVIEW_EVENT_CENTERED_STRATEGY: "complete_response_v1_9",
        AI_PROVIDER: "openai",
        DEEPSEEK_API_KEY: "official-secret",
        DEEPSEEK_BASE_URL: "https://api.deepseek.com",
        DEEPSEEK_MODEL: "deepseek-v4-pro",
        EVENT_CENTERED_GENERATIVE_MODEL: "deepseek-v4-pro"
      },
      getFallbackProvider: vi.fn(),
      createProvider
    });

    expect(result).toBe(isolated);
    expect(createProvider).toHaveBeenCalledWith({
      capability: "chat",
      apiKey: "official-secret",
      config: {
        provider: "openai",
        config: {
          model: "deepseek-v4-pro",
          baseUrl: "https://api.deepseek.com"
        }
      }
    });
  });

  it("清理模型配置两侧空白和引号", () => {
    expect(readEventCenteredGenerativeModel({
      NODE_ENV: "test",
      EVENT_CENTERED_GENERATIVE_MODEL: '  "deepseek-v4-flash"  '
    })).toBe("deepseek-v4-flash");
  });

  it("候选模型名在所有兼容适配器中保持原值", () => {
    expect(resolveEventCenteredProviderModel("deepseek-v4-flash", "volcengine_ark"))
      .toBe("deepseek-v4-flash");
    expect(resolveEventCenteredProviderModel("deepseek-v4-flash-260425", "volcengine_ark"))
      .toBe("deepseek-v4-flash-260425");
    expect(resolveEventCenteredProviderModel("deepseek-v4-flash", "openai"))
      .toBe("deepseek-v4-flash");
  });
});
