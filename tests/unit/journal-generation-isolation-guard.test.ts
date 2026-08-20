import {
  assertJournalDailyEvalPrivateIgnore,
  JournalDailyEvalIsolationError,
  type JournalDailyEvalIsolationEnv,
  validateJournalDailyEvalIsolation
} from "../../scripts/journal-generation-eval/isolation-guard";

function localEnv(overrides: Partial<JournalDailyEvalIsolationEnv> = {}): JournalDailyEvalIsolationEnv {
  return {
    NODE_ENV: "development",
    JOURNAL_DAILY_EVAL_BASE_URL: "http://127.0.0.1:3000",
    DATABASE_URL: "postgresql://local@127.0.0.1:5432/happiness_system_codex?schema=journal_daily_eval",
    DIRECT_URL: "postgresql://local@localhost:5432/happiness_system_codex?schema=journal_daily_eval",
    JOURNAL_DAILY_EVAL_DATA_DIR: "artifacts/journal-generation-evaluation/.private/formal/run-v1",
    ...overrides
  };
}

function expectIsolationCode(env: JournalDailyEvalIsolationEnv, expectedCode: string) {
  try {
    validateJournalDailyEvalIsolation(env);
    throw new Error("EXPECTED_ISOLATION_REJECTION");
  } catch (error) {
    expect(error).toBeInstanceOf(JournalDailyEvalIsolationError);
    expect((error as JournalDailyEvalIsolationError).code).toBe(expectedCode);
  }
}

describe("journal daily evaluation isolation guard", () => {
  it("只接受本机 happiness_system_codex 的 journal_daily_eval schema", () => {
    const result = validateJournalDailyEvalIsolation(localEnv());

    expect(result.base_url).toBe("http://127.0.0.1:3000");
    expect(result.database).toMatchObject({ hostname: "127.0.0.1", database: "happiness_system_codex", schema: "journal_daily_eval" });
    expect(result.direct).toMatchObject({ hostname: "localhost", database: "happiness_system_codex", schema: "journal_daily_eval" });
    expect(result.connection_performed).toBe(false);
    expect(result.data_directory).toContain("/artifacts/journal-generation-evaluation/.private/formal/");
  });

  it("拒绝继承远程 Neon DATABASE_URL", () => {
    expectIsolationCode(localEnv({
      DATABASE_URL: "postgresql://remote@ep-example.neon.tech/happiness_system_codex?schema=journal_daily_eval"
    }), "DATABASE_URL_HOST_FORBIDDEN");
  });

  it("拒绝远程 DIRECT_URL", () => {
    expectIsolationCode(localEnv({
      DIRECT_URL: "postgresql://remote@ep-example.neon.tech/happiness_system_codex?schema=journal_daily_eval"
    }), "DIRECT_URL_HOST_FORBIDDEN");
  });

  it("拒绝错误 database 与 schema", () => {
    expectIsolationCode(localEnv({
      DATABASE_URL: "postgresql://local@127.0.0.1:5432/other_database?schema=journal_daily_eval"
    }), "DATABASE_URL_DATABASE_FORBIDDEN");
    expectIsolationCode(localEnv({
      DIRECT_URL: "postgresql://local@127.0.0.1:5432/happiness_system_codex?schema=public"
    }), "DIRECT_URL_SCHEMA_FORBIDDEN");
  });

  it("拒绝 Vercel、Production 和非本地页面", () => {
    expectIsolationCode(localEnv({ VERCEL_ENV: "preview" }), "VERCEL_CONTEXT_FORBIDDEN");
    expectIsolationCode(localEnv({ NODE_ENV: "production" }), "PRODUCTION_CONTEXT_FORBIDDEN");
    expectIsolationCode(localEnv({ JOURNAL_DAILY_EVAL_BASE_URL: "https://dailylight.chat" }), "LOCAL_BASE_URL_PROTOCOL_FORBIDDEN");
  });

  it("拒绝把运行数据写到 .private/formal 以外", () => {
    expectIsolationCode(localEnv({ JOURNAL_DAILY_EVAL_DATA_DIR: "artifacts/journal-generation-evaluation/formal" }), "PRIVATE_DATA_AREA_FORBIDDEN");
  });

  it("验证仓库真实 .private 忽略规则与跟踪状态", async () => {
    await expect(assertJournalDailyEvalPrivateIgnore()).resolves.toMatchObject({
      probe_ignored: true,
      tracked_private_file_count: 0
    });
  });
});
