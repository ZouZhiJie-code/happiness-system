import { describe, expect, it } from "vitest";

import { resolveGi088InitializeDatabaseUrl } from "../../scripts/initialize-gi088-current-batch";

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    VERCEL_ENV: "preview",
    DATABASE_URL:
      "postgresql://preview:test@pool.preview.example/dailylight_preview?schema=gi088_app_preview",
    EVALUATION_DATABASE_URL:
      "postgresql://preview:test@pool.preview.example/dailylight_preview?schema=gi088_evaluation_v0",
    EVALUATION_DATABASE_URL_UNPOOLED:
      "postgresql://preview:test@direct.preview.example/dailylight_preview?schema=gi088_evaluation_v0",
    EVALUATION_POSTGRES_HOST: "pool.preview.example",
    EVALUATION_PGHOST_UNPOOLED: "direct.preview.example",
    EVALUATION_POSTGRES_DATABASE: "dailylight_preview",
    GI088_EVALUATION_DATABASE_SCHEMA: "gi088_evaluation_v0"
  };
}

describe("GI-088 v8r2 zero-model initialize database guard", () => {
  it("只接受同一 Preview 物理库中的 app/evaluation 隔离 schema", () => {
    const source = validEnvironment();
    const result = resolveGi088InitializeDatabaseUrl(source);

    expect(new URL(result).searchParams.get("schema")).toBe(
      "gi088_evaluation_v0"
    );
    expect(source.EVALUATION_DATABASE_URL).toContain(
      "schema=gi088_evaluation_v0"
    );
  });

  it.each([
    [
      "Production target",
      { VERCEL_ENV: "production" },
      "GI088_INITIALIZE_PRODUCTION_FORBIDDEN"
    ],
    [
      "非 Preview target",
      { VERCEL_ENV: "development" },
      "GI088_INITIALIZE_PREVIEW_ONLY"
    ],
    [
      "缺失 app 数据库身份",
      { DATABASE_URL: "" },
      "GI088_INITIALIZE_APP_DATABASE_CONFIG_MISSING"
    ],
    [
      "evaluation schema 错误",
      {
        EVALUATION_DATABASE_URL:
          "postgresql://preview:test@pool.preview.example/dailylight_preview?schema=public"
      },
      "GI088_INITIALIZE_DATABASE_SCHEMA_MISMATCH"
    ],
    [
      "app schema 错误",
      {
        DATABASE_URL:
          "postgresql://preview:test@pool.preview.example/dailylight_preview?schema=public"
      },
      "GI088_PREVIEW_APP_DATABASE_SCHEMA_MISMATCH"
    ],
    [
      "evaluation host 错误",
      {
        EVALUATION_DATABASE_URL:
          "postgresql://preview:test@shared.example/dailylight_preview?schema=gi088_evaluation_v0"
      },
      "GI088_EVALUATION_DATABASE_IDENTITY_MISMATCH"
    ],
    [
      "app database 错误",
      {
        DATABASE_URL:
          "postgresql://preview:test@pool.preview.example/other_database?schema=gi088_app_preview"
      },
      "GI088_PREVIEW_APP_DATABASE_IDENTITY_MISMATCH"
    ],
    [
      "缺失共享库身份标识",
      {
        EVALUATION_POSTGRES_HOST: "",
        EVALUATION_PGHOST_UNPOOLED: "",
        EVALUATION_POSTGRES_DATABASE: ""
      },
      "GI088_EVALUATION_DATABASE_IDENTITY_MISSING"
    ]
  ])("拒绝%s", (_label, overrides, expectedCode) => {
    expect(() =>
      resolveGi088InitializeDatabaseUrl({
        ...validEnvironment(),
        ...overrides
      })
    ).toThrow(expectedCode);
  });
});
