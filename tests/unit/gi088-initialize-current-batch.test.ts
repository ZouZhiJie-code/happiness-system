import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import {
  assertGi088ZeroModelInitializeReadback,
  createGi088InitializeClientOperationId,
  isGi088InitializeDirectRun,
  resolveGi088InitializeDatabaseUrl
} from "../../scripts/initialize-gi088-current-batch";
import {
  createGi088EffectiveCandidateFingerprint,
  createGi088ExecutionFingerprint
} from "@/server/services/evaluation/gi088/candidate";
import { Gi088MemoryFoundationStore } from "@/server/services/evaluation/gi088/foundation-memory-store";
import { Gi088EvaluationFoundationService } from "@/server/services/evaluation/gi088/foundation-service";
import type { Gi088V8r3OfflineEvaluationEvidence } from "@/server/services/evaluation/gi088/types";

const OFFLINE_EVIDENCE: Gi088V8r3OfflineEvaluationEvidence = {
  candidateOfflineRunFingerprint: "a".repeat(64),
  candidateEvidenceFingerprint: "b".repeat(64),
  admissionFingerprint: null,
  automaticRecoveryCount: 1
};

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    VERCEL_ENV: "preview",
    DATABASE_URL:
      "postgresql://preview:test@pool.preview.example/dailylight_preview?schema=gi088_app_preview",
    DIRECT_URL:
      "postgresql://preview:test@direct.preview.example/dailylight_preview?schema=gi088_app_preview",
    EVALUATION_DATABASE_URL:
      "postgresql://preview:test@pool.preview.example/dailylight_preview?schema=gi088_evaluation_v0",
    EVALUATION_DATABASE_URL_UNPOOLED:
      "postgresql://preview:test@direct.preview.example/dailylight_preview?schema=gi088_evaluation_v0",
    EVALUATION_POSTGRES_HOST: "pool.preview.example",
    EVALUATION_PGHOST_UNPOOLED: "direct.preview.example",
    EVALUATION_POSTGRES_DATABASE: "dailylight_preview",
    GI088_EVALUATION_DATABASE_SCHEMA: "gi088_evaluation_v0",
    GI088_V8R3_CANDIDATE_OFFLINE_RUN_FINGERPRINT:
      OFFLINE_EVIDENCE.candidateOfflineRunFingerprint,
    GI088_V8R3_CANDIDATE_EVIDENCE_FINGERPRINT:
      OFFLINE_EVIDENCE.candidateEvidenceFingerprint,
    GI088_V8R3_OFFLINE_AUTOMATIC_RECOVERY_COUNT: String(
      OFFLINE_EVIDENCE.automaticRecoveryCount
    )
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
    },
    offlineEvaluationEvidence: OFFLINE_EVIDENCE
  });
  const created = await service.createRun({
    ownerUserId: "owner-initialize-readback",
    clientOperationId:
      createGi088InitializeClientOperationId(executionFingerprint)
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
    expectedCandidateFingerprint: candidateFingerprint,
    expectedOfflineEvaluationEvidence: OFFLINE_EVIDENCE
  };
}

describe("GI-088 v8r3 zero-model initialize database guard", () => {
  it("让 operation ID 随 execution fingerprint 变化并保持同指纹稳定", () => {
    const firstFingerprint = "a".repeat(64);
    const secondFingerprint = "b".repeat(64);
    const firstId = createGi088InitializeClientOperationId(firstFingerprint);

    expect(firstId).toBe(
      createGi088InitializeClientOperationId(firstFingerprint)
    );
    expect(firstId).not.toBe(
      createGi088InitializeClientOperationId(secondFingerprint)
    );
    expect(firstId).toContain(firstFingerprint);
    expect(firstId.length).toBeLessThanOrEqual(160);
    expect(() =>
      createGi088InitializeClientOperationId("invalid-fingerprint")
    ).toThrow("GI088_INITIALIZE_EXECUTION_FINGERPRINT_INVALID");
  });

  it("同一 execution fingerprint 的初始化 operation 稳定重放同一 run", async () => {
    const store = new Gi088MemoryFoundationStore();
    const executionFingerprint = createGi088ExecutionFingerprint();
    const clientOperationId =
      createGi088InitializeClientOperationId(executionFingerprint);
    const service = new Gi088EvaluationFoundationService({
      store,
      getProvider: async () => {
        throw new Error("GI088_INITIALIZE_TEST_MODEL_CALL_FORBIDDEN");
      },
      authorizeModelCall: () => {
        throw new Error("GI088_INITIALIZE_TEST_MODEL_CALL_FORBIDDEN");
      },
      offlineEvaluationEvidence: OFFLINE_EVIDENCE
    });

    const first = await service.createRun({
      ownerUserId: "owner-initialize-idempotency",
      clientOperationId
    });
    const replay = await service.createRun({
      ownerUserId: "owner-initialize-idempotency",
      clientOperationId:
        createGi088InitializeClientOperationId(executionFingerprint)
    });

    expect(first.created).toBe(true);
    expect(replay.created).toBe(false);
    expect(replay.runId).toBe(first.runId);
    expect((await store.listRuns({
      ownerUserId: "owner-initialize-idempotency"
    }))).toHaveLength(1);
  });

  it("识别普通 Node、vite-node argv 与实际 package runner", () => {
    const scriptPath = resolve(
      process.cwd(),
      "scripts/initialize-gi088-current-batch.ts"
    );
    const scriptUrl = pathToFileURL(scriptPath).href;

    expect(
      isGi088InitializeDirectRun([process.execPath, scriptPath], scriptUrl)
    ).toBe(true);
    expect(
      isGi088InitializeDirectRun(
        [
          process.execPath,
          resolve(process.cwd(), "node_modules/vite-node/vite-node.mjs"),
          scriptPath
        ],
        scriptUrl
      )
    ).toBe(true);
    expect(
      isGi088InitializeDirectRun(
        [process.execPath, "vite-node", "--gi088-initialize-direct-run"],
        scriptUrl
      )
    ).toBe(true);
    expect(
      isGi088InitializeDirectRun(
        [process.execPath, "vite-node", "tests/unit/example.test.ts"],
        scriptUrl
      )
    ).toBe(false);

    const result = spawnSync(
      "npm",
      ["run", "-s", "eval:gi088:initialize-current"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_ENV: "test",
          VERCEL_ENV: "preview",
          GI088_INITIALIZE_CONFIRMATION: ""
        }
      }
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("GI088_INITIALIZE_CONFIRMATION_REQUIRED");
    expect(result.stdout.trim()).toBe("");
  }, 20_000);

  it("只接受同一 Preview 物理库中的 app/evaluation 隔离 schema", () => {
    const source = validEnvironment();
    const result = resolveGi088InitializeDatabaseUrl(source);

    expect(new URL(result).searchParams.get("schema")).toBe(
      "gi088_evaluation_v0"
    );
    expect(new URL(result).hostname).toBe("direct.preview.example");
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
      "缺失 app 迁移数据库身份",
      { DIRECT_URL: "" },
      "GI088_INITIALIZE_APP_DATABASE_CONFIG_MISSING"
    ],
    [
      "缺失 evaluation runtime 数据库身份",
      { EVALUATION_DATABASE_URL: "" },
      "GI088_EVALUATION_DATABASE_URL_MISSING"
    ],
    [
      "缺失 evaluation migration 数据库身份",
      { EVALUATION_DATABASE_URL_UNPOOLED: "" },
      "GI088_INITIALIZE_DATABASE_CONFIG_MISSING"
    ],
    [
      "evaluation schema 错误",
      {
        EVALUATION_DATABASE_URL_UNPOOLED:
          "postgresql://preview:test@direct.preview.example/dailylight_preview?schema=public"
      },
      "GI088_INITIALIZE_DATABASE_SCHEMA_MISMATCH"
    ],
    [
      "evaluation runtime schema 错误",
      {
        EVALUATION_DATABASE_URL:
          "postgresql://preview:test@pool.preview.example/dailylight_preview?schema=public"
      },
      "GI088_EVALUATION_DATABASE_SCHEMA_MISMATCH"
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
      "app migration 使用 pooled host",
      {
        DIRECT_URL:
          "postgresql://preview:test@pool.preview.example/dailylight_preview?schema=gi088_app_preview"
      },
      "GI088_PREVIEW_APP_DIRECT_DATABASE_IDENTITY_MISMATCH"
    ],
    [
      "evaluation migration 使用 pooled host",
      {
        EVALUATION_DATABASE_URL_UNPOOLED:
          "postgresql://preview:test@pool.preview.example/dailylight_preview?schema=gi088_evaluation_v0"
      },
      "GI088_EVALUATION_DATABASE_UNPOOLED_IDENTITY_MISMATCH"
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

  it("只接受当前不可变指纹的 0/6 Thinking high run", async () => {
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
      "Skill version 漂移",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.session.evaluation.skillVersion = "stale-skill";
      }
    ],
    [
      "Skill SHA 漂移",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.session.evaluation.skillSha256 = "2".repeat(64);
      }
    ],
    [
      "dataset fingerprint 漂移",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.session.evaluation.datasetFingerprint = "3".repeat(64);
      }
    ],
    [
      "behavior manifest 漂移",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.session.evaluation.behaviorManifestSha256 = "4".repeat(64);
      }
    ],
    [
      "behavior manifest version 漂移",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.session.evaluation.behaviorManifestVersion = "stale-manifest";
      }
    ],
    [
      "runner fingerprint 漂移",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.session.evaluation.runnerFingerprint = "5".repeat(64);
      }
    ],
    [
      "experience fingerprint 漂移",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.session.evaluation.experienceFingerprint = "6".repeat(64);
      }
    ],
    [
      "model transport 漂移",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.session.evaluation.modelIdentity!.transport = "unknown";
      }
    ],
    [
      "model endpoint 漂移",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.session.evaluation.modelIdentity!.endpoint = "/wrong";
      }
    ],
    [
      "伪造一致的旧 execution bundle",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.expectedExecutionFingerprint = "7".repeat(64);
        input.session.evaluation.executionFingerprint = "7".repeat(64);
      }
    ],
    [
      "任务总数漂移",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.session.batch.totalTasks = 5;
      }
    ],
    [
      "离线候选恢复计数漂移",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.session.batch.offlineEvaluationEvidence!.automaticRecoveryCount = 2;
      }
    ],
    [
      "离线候选证据指纹漂移",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.session.batch.offlineEvaluationEvidence!
          .candidateEvidenceFingerprint = "8".repeat(64);
      }
    ],
    [
      "自适应恢复调用上限漂移",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.session.batch.adaptiveRecoveryDiagnostics!
          .maximumAutomaticProviderCallsPerCycle = 2;
      }
    ],
    [
      "任务角色漂移",
      (input: Awaited<ReturnType<typeof validInitializeReadback>>) => {
        input.session.tasks[4]!.evaluationRole = "scored_trajectory";
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
