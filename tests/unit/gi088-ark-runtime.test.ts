import { describe, expect, it } from "vitest";

import {
  Gi088ArkRuntimeConfigurationError,
  resolveGi088ArkRuntimeConfig
} from "../../src/server/services/evaluation/gi088/ark-runtime";
import {
  GI088_CONFIGS,
  GI088_MODEL_CALL_IDENTITY,
  GI088_TIMEOUT_POLICY
} from "../../src/server/services/evaluation/gi088/candidate";
import {
  GI088_MODEL_REQUEST_IDENTITY,
  createGi088ModelRequestHash
} from "../../src/server/services/evaluation/gi088/request-identity";

describe("GI-088 v7r2 Ark runtime", () => {
  it("只读取专用 Ark 凭证并冻结 REST 地址与模型", () => {
    const result = resolveGi088ArkRuntimeConfig({
      NODE_ENV: "test",
      VOLCENGINE_ARK_API_KEY: " ark-secret ",
      VOLCENGINE_ARK_BASE_URL: "https://ark.cn-beijing.volces.com/api/v3"
    } as NodeJS.ProcessEnv);

    expect(result).toEqual({
      apiKey: "ark-secret",
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
      model: "deepseek-v4-flash-ga-260731",
      summary: {
        provider: "volcengine_ark",
        transport: "openai_compatible_rest",
        baseUrlHost: "ark.cn-beijing.volces.com",
        endpoint: "/chat/completions",
        model: "deepseek-v4-flash-ga-260731",
        payloadContractVersion: "2026-08-11.gi088-ark-openai-json-v1"
      }
    });
  });

  it("v8r3 固定 Thinking high、provider default token 与 60 秒单调用窗口", () => {
    expect(GI088_CONFIGS.high).toMatchObject({
      provider: "volcengine_ark",
      baseUrlHost: "ark.cn-beijing.volces.com",
      model: "deepseek-v4-flash-ga-260731",
      thinking: "enabled",
      reasoningEffort: "high",
      responseFormat: "json_object",
      maxTokensPolicy: "provider_default"
    });
    expect(GI088_MODEL_CALL_IDENTITY).toEqual({
      provider: "volcengine_ark",
      baseUrlHost: "ark.cn-beijing.volces.com",
      endpoint: "/chat/completions",
      model: "deepseek-v4-flash-ga-260731",
      payloadContractVersion: "2026-08-11.gi088-ark-openai-json-v1"
    });
    expect(GI088_MODEL_REQUEST_IDENTITY).toEqual({
      ...GI088_MODEL_CALL_IDENTITY,
      transport: "openai_compatible_rest"
    });
    expect(GI088_TIMEOUT_POLICY).toMatchObject({
      headersTimeoutMs: 60_000,
      bodyIdleTimeoutMs: 60_000,
      hardTimeoutMs: 60_000
    });
    expect(createGi088ModelRequestHash({
      messages: [{ role: "user", content: "REQUEST_HASH_GOLDEN" }],
      thinking: "enabled",
      reasoningEffort: "high",
      responseFormat: "json_object",
      useProviderDefaultMaxTokens: true,
      headersTimeoutMs: 60_000,
      bodyIdleTimeoutMs: 60_000,
      hardTimeoutMs: 60_000
    })).toBe(
      "fa176bf0ec8b4d03f162ccefd42d5be648a37908211a452613eeb52916a93fed"
    );
  });

  it("缺少专用凭证时在创建 Provider 前停止", () => {
    expect(() => resolveGi088ArkRuntimeConfig({ NODE_ENV: "test" }))
      .toThrowError(
        new Gi088ArkRuntimeConfigurationError("GI088_ARK_API_KEY_MISSING")
      );
  });

  it("地址偏离冻结的北京 Ark REST 入口时停止", () => {
    expect(() => resolveGi088ArkRuntimeConfig({
      NODE_ENV: "test",
      VOLCENGINE_ARK_API_KEY: "ark-secret",
      VOLCENGINE_ARK_BASE_URL: "https://api.deepseek.com"
    } as NodeJS.ProcessEnv)).toThrowError(
      new Gi088ArkRuntimeConfigurationError("GI088_ARK_BASE_URL_MISMATCH")
    );
  });
});
