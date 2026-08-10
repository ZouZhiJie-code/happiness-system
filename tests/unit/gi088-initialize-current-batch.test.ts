import { describe, expect, it } from "vitest";

import {
  assertGi088ZeroModelInitializeReadback,
  resolveGi088InitializeDatabaseUrl
} from "../../scripts/initialize-gi088-current-batch";
import {
  createGi088EffectiveCandidateFingerprint,
  createGi088ExecutionFingerprint
} from "@/server/services/evaluation/gi088/candidate";
import { Gi088MemoryFoundationStore } from "@/server/services/evaluation/gi088/foundation-memory-store";
import { Gi088EvaluationFoundationService } from "@/server/services/evaluation/gi088/foundation-service";

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

async function validInitializeReadback() {
  const store = new Gi088MemoryFoundationStore();
  const executionFingerprint = createGi088ExecutionFingerprint();
  const candidateFingerprint = createGi088EffectiveCandidateFingerprint();
  const service = new Gi088EvaluationFoundationService({
    store,
    getProvider: async () => {
      throw new Error("GI088_INITIALIZE_TEST_MODEL_CALL_FORBIDDEN");
    },
    authorizeModelCall: () => {
      throw new Error("GI088_INITIALIZE_TEST_MODEL_CALL_FORBIDDEN");
    }
  });
  const created = await service.createRun({
    ownerUserId: "owner-initialize-readback",
    clientOperationId: "initialize-readback"
  });
  const session = await service.getSession({
    ownerUserId: "owner-initialize-readback",
    runId: created.runId
  });
  return {
    session,
    callCount: (await store.listCalls(created.runId)).length,
    expectedRunId: created.runId,
    expectedExecutionFingerprint: executionFingerprint,
    expectedCandidateFingerprint: candidateFingerprint
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

  it("只接受当前不可变指纹的 0/12 Thinking high run", async () => {
    const readback = await validInitializeReadback();

    expect(() =>
      assertGi088ZeroModelInitializeReadback(readback)
    ).not.toThrow();
  });

  it.each([
    [
      "旧 execution fingerprint",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.session.evaluation.executionFingerprint = "0".repeat(64);
      }
    ],
    [
      "旧 candidate fingerprint",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.session.evaluation.candidateFingerprint = "1".repeat(64);
      }
    ],
    [
      "任务总数漂移",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.session.batch.totalTasks = 11;
      }
    ],
    [
      "非 high_only",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.session.evaluation.mode = "paired";
      }
    ],
    [
      "初始化已有调用",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.callCount = 1;
      }
    ]
  ])("拒绝%s的初始化回读", async (_label, mutate) => {
    const readback = await validInitializeReadback();
    mutate(readback);

    expect(() => assertGi088ZeroModelInitializeReadback(readback)).toThrow(
      "GI088_INITIALIZE_ZERO_MODEL_READBACK_MISMATCH"
    );
  });
});
