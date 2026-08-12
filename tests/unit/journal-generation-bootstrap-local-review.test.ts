import type {
  BootstrapLocalReviewDatabase,
  BootstrapLocalReviewDependencies
} from "../../scripts/journal-generation-eval/bootstrap-local-review";
import {
  BootstrapLocalReviewError,
  parseBootstrapLocalReviewArgs,
  runBootstrapLocalReview
} from "../../scripts/journal-generation-eval/bootstrap-local-review";
import type { JournalDailyEvalIsolationEnv } from "../../scripts/journal-generation-eval/isolation-guard";

function localEnvironment(): JournalDailyEvalIsolationEnv & { ACCEPTANCE_ADMIN_PASSWORD: string } {
  return {
    NODE_ENV: "test",
    VERCEL_ENV: "",
    NEXT_PUBLIC_VERCEL_ENV: "",
    JOURNAL_DAILY_EVAL_BASE_URL: "http://127.0.0.1:3000",
    DATABASE_URL: "postgresql://local@127.0.0.1:5432/happiness_system_codex?schema=journal_daily_eval",
    DIRECT_URL: "postgresql://local@localhost:5432/happiness_system_codex?schema=journal_daily_eval",
    JOURNAL_DAILY_EVAL_DATA_DIR: "artifacts/journal-generation-evaluation/.private/formal/bootstrap-test",
    ACCEPTANCE_ADMIN_PASSWORD: "PRIVATE_LOCAL_PASSWORD"
  };
}

function createMockDependencies(options: { tables?: string[] } = {}) {
  const database: BootstrapLocalReviewDatabase = {
    connect: vi.fn().mockResolvedValue(undefined),
    listRequiredTables: vi.fn().mockResolvedValue(
      options.tables ?? ["_prisma_migrations", "User", "UserSettings"]
    ),
    upsertAcceptanceAdmin: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined)
  };
  const dependencies: BootstrapLocalReviewDependencies = {
    assertPrivateIgnore: vi.fn().mockResolvedValue({
      probe_ignored: true,
      tracked_private_file_count: 0
    }),
    createDatabase: vi.fn().mockResolvedValue(database),
    hashPassword: vi.fn().mockResolvedValue("salt:derived-hash"),
    now: vi.fn().mockReturnValue(new Date("2026-08-10T00:00:00.000Z"))
  };
  return { database, dependencies };
}

describe("bootstrap local journal review", () => {
  it("默认 inspect 只复用隔离检查，保持 0 连接与 0 写入", async () => {
    const { database, dependencies } = createMockDependencies();

    const summary = await runBootstrapLocalReview({
      env: localEnvironment(),
      dependencies
    });

    expect(summary).toMatchObject({
      status: "inspect_only",
      mode: "inspect",
      database_connection_performed: false,
      database_write_count: 0,
      migration_performed: false,
      account: {
        username: "acceptance_admin",
        user_upserted: false,
        settings_upserted: false
      }
    });
    expect(dependencies.assertPrivateIgnore).toHaveBeenCalledTimes(1);
    expect(dependencies.createDatabase).not.toHaveBeenCalled();
    expect(database.connect).not.toHaveBeenCalled();
  });

  it("execute 缺少精确 schema 确认时拒绝连接", async () => {
    const { dependencies } = createMockDependencies();

    await expect(runBootstrapLocalReview({
      argv: ["--execute"],
      env: localEnvironment(),
      dependencies
    })).rejects.toMatchObject({
      code: "BOOTSTRAP_LOCAL_SCHEMA_CONFIRMATION_REQUIRED"
    });
    expect(dependencies.createDatabase).not.toHaveBeenCalled();
  });

  it("只有 execute 加精确确认才检查表并最小 upsert 用户和 settings", async () => {
    const { database, dependencies } = createMockDependencies();

    const summary = await runBootstrapLocalReview({
      argv: ["--execute", "--confirm-local-schema=journal_daily_eval"],
      env: localEnvironment(),
      dependencies
    });

    expect(database.connect).toHaveBeenCalledTimes(1);
    expect(database.listRequiredTables).toHaveBeenCalledTimes(1);
    expect(database.upsertAcceptanceAdmin).toHaveBeenCalledWith({
      username: "acceptance_admin",
      passwordHash: "salt:derived-hash",
      now: new Date("2026-08-10T00:00:00.000Z")
    });
    expect(database.disconnect).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({
      status: "local_review_ready",
      database_connection_performed: true,
      database_write_count: 2,
      migration_performed: false,
      fixture_write_count: 0,
      account: {
        username: "acceptance_admin",
        user_upserted: true,
        settings_upserted: true
      }
    });
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain("PRIVATE_LOCAL_PASSWORD");
    expect(serialized).not.toContain("postgresql://");
  });

  it("迁移表或核心表缺失时停止 upsert 并断开连接", async () => {
    const { database, dependencies } = createMockDependencies({
      tables: ["_prisma_migrations", "User"]
    });

    await expect(runBootstrapLocalReview({
      argv: ["--execute", "--confirm-local-schema=journal_daily_eval"],
      env: localEnvironment(),
      dependencies
    })).rejects.toMatchObject({
      code: "BOOTSTRAP_REQUIRED_TABLES_MISSING"
    });
    expect(database.upsertAcceptanceAdmin).not.toHaveBeenCalled();
    expect(database.disconnect).toHaveBeenCalledTimes(1);
  });

  it("解析器拒绝冲突模式、未知参数与 inspect 确认参数", async () => {
    expect(() => parseBootstrapLocalReviewArgs(["--inspect", "--execute"]))
      .toThrowError(BootstrapLocalReviewError);
    expect(() => parseBootstrapLocalReviewArgs(["--unknown"]))
      .toThrowError(/未知参数/u);

    const { dependencies } = createMockDependencies();
    await expect(runBootstrapLocalReview({
      argv: ["--inspect", "--confirm-local-schema=journal_daily_eval"],
      env: localEnvironment(),
      dependencies
    })).rejects.toMatchObject({
      code: "BOOTSTRAP_CONFIRMATION_WITHOUT_EXECUTE"
    });
  });

  it("远程环境在创建数据库客户端前由 isolation-guard 硬拒绝", async () => {
    const { dependencies } = createMockDependencies();
    const env = localEnvironment();
    env.DATABASE_URL = "postgresql://remote@ep-example.neon.tech/happiness_system_codex?schema=journal_daily_eval";

    await expect(runBootstrapLocalReview({
      argv: ["--execute", "--confirm-local-schema=journal_daily_eval"],
      env,
      dependencies
    })).rejects.toMatchObject({
      code: "DATABASE_URL_HOST_FORBIDDEN"
    });
    expect(dependencies.assertPrivateIgnore).not.toHaveBeenCalled();
    expect(dependencies.createDatabase).not.toHaveBeenCalled();
  });
});
