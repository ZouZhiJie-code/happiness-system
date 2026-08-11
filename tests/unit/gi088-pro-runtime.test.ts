import { describe, expect, it } from "vitest";

import {
  GI088_DEEPSEEK_PRO_RUNTIME_POLICY
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
