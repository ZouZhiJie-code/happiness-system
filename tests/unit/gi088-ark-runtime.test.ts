import { describe, expect, it } from "vitest";

import {
  Gi088ArkRuntimeConfigurationError,
  resolveGi088ArkRuntimeConfig
} from "../../src/server/services/evaluation/gi088/ark-runtime";

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
        provider: "openai",
        transport: "openai_compatible_rest",
        baseUrlHost: "ark.cn-beijing.volces.com",
        model: "deepseek-v4-flash-ga-260731"
      }
    });
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
