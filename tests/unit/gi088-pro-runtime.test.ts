import { describe, expect, it } from "vitest";

import {
  GI088_CONFIGS,
  GI088_DEEPSEEK_PRO_RUNTIME_POLICY,
  GI088_TIMEOUT_POLICY
} from "../../src/server/services/evaluation/gi088/candidate";
import {
  Gi088ProRuntimeConfigurationError,
  resolveGi088ProRuntimeConfig
} from "../../src/server/services/evaluation/gi088/pro-runtime";

describe("GI-088 v7r4 DeepSeek Pro runtime", () => {
  it("固定官方地址、V4 Pro、Thinking high 与 JSON 输出", () => {
    expect(GI088_DEEPSEEK_PRO_RUNTIME_POLICY).toMatchObject({
      baseUrl: "https://api.deepseek.com",
      baseUrlHost: "api.deepseek.com",
      model: "deepseek-v4-pro",
      thinking: "enabled",
      reasoningEffort: "high",
      responseFormat: "json_object"
    });
    expect(GI088_CONFIGS.high).toMatchObject({
      baseUrlHost: "api.deepseek.com",
      model: "deepseek-v4-pro",
      thinking: "enabled",
      reasoningEffort: "high",
      responseFormat: "json_object",
      activeInEvaluation: true
    });
  });

  it("采用 15 秒响应头、45 秒正文空闲与 60 秒总上限", () => {
    expect(GI088_TIMEOUT_POLICY).toMatchObject({
      headersTimeoutMs: 15_000,
      bodyIdleTimeoutMs: 45_000,
      hardTimeoutMs: 60_000
    });
  });

  it("只从 DEEPSEEK_API_KEY 读取密钥并返回安全摘要", () => {
    const resolved = resolveGi088ProRuntimeConfig({
      NODE_ENV: "test",
      DEEPSEEK_API_KEY: "secret-test-key"
    });
    expect(resolved.apiKey).toBe("secret-test-key");
    expect(resolved.summary).toEqual({
      provider: "openai",
      transport: "openai_compatible_rest",
      baseUrlHost: "api.deepseek.com",
      model: "deepseek-v4-pro"
    });
    expect(JSON.stringify(resolved.summary)).not.toContain("secret-test-key");
  });

  it("缺少密钥或偏离官方地址时在调用前停止", () => {
    expect(() => resolveGi088ProRuntimeConfig({ NODE_ENV: "test" })).toThrow(
      new Gi088ProRuntimeConfigurationError(
        "GI088_DEEPSEEK_API_KEY_MISSING"
      )
    );
    expect(() =>
      resolveGi088ProRuntimeConfig({
        NODE_ENV: "test",
        DEEPSEEK_API_KEY: "secret-test-key",
        DEEPSEEK_BASE_URL: "https://example.com"
      })
    ).toThrow(
      new Gi088ProRuntimeConfigurationError(
        "GI088_DEEPSEEK_BASE_URL_MISMATCH"
      )
    );
  });
});
