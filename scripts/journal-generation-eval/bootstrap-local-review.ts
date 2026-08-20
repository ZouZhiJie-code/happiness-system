import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  assertJournalDailyEvalPrivateIgnore,
  JournalDailyEvalIsolationError,
  type JournalDailyEvalIsolationEnv,
  validateJournalDailyEvalIsolation
} from "./isolation-guard";

const scrypt = promisify(scryptCallback);
const REQUIRED_SCHEMA = "journal_daily_eval";
const ACCEPTANCE_USERNAME = "acceptance_admin";
const REQUIRED_TABLES = ["_prisma_migrations", "User", "UserSettings"] as const;

export type BootstrapLocalReviewMode = "inspect" | "execute";

export class BootstrapLocalReviewError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export interface BootstrapLocalReviewOptions {
  mode: BootstrapLocalReviewMode;
  confirmedSchema: string | null;
}

export interface BootstrapLocalReviewDatabase {
  connect(): Promise<void>;
  listRequiredTables(): Promise<string[]>;
  upsertAcceptanceAdmin(input: {
    username: typeof ACCEPTANCE_USERNAME;
    passwordHash: string;
    now: Date;
  }): Promise<void>;
  disconnect(): Promise<void>;
}

export interface BootstrapLocalReviewDependencies {
  assertPrivateIgnore(projectRoot: string): Promise<{
    probe_ignored: true;
    tracked_private_file_count: number;
  }>;
  createDatabase(databaseUrl: string): Promise<BootstrapLocalReviewDatabase>;
  hashPassword(password: string): Promise<string>;
  now(): Date;
}

export function parseBootstrapLocalReviewArgs(argv: string[]): BootstrapLocalReviewOptions {
  let mode: BootstrapLocalReviewMode = "inspect";
  let inspectSeen = false;
  let executeSeen = false;
  let confirmedSchema: string | null = null;

  for (const argument of argv) {
    if (argument === "--inspect") {
      inspectSeen = true;
      mode = "inspect";
      continue;
    }
    if (argument === "--execute") {
      executeSeen = true;
      mode = "execute";
      continue;
    }
    if (argument.startsWith("--confirm-local-schema=")) {
      confirmedSchema = argument.slice("--confirm-local-schema=".length);
      continue;
    }
    throw new BootstrapLocalReviewError(
      "BOOTSTRAP_ARGUMENT_UNKNOWN",
      `未知参数：${argument}`
    );
  }

  if (inspectSeen && executeSeen) {
    throw new BootstrapLocalReviewError(
      "BOOTSTRAP_MODE_CONFLICT",
      "--inspect 与 --execute 不能同时使用。"
    );
  }
  return { mode, confirmedSchema };
}

async function defaultHashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${Buffer.from(derivedKey as ArrayBuffer).toString("hex")}`;
}

async function createPrismaBootstrapDatabase(
  databaseUrl: string
): Promise<BootstrapLocalReviewDatabase> {
  const { PrismaClient } = await import("@prisma/client");
  const client = new PrismaClient({
    datasources: { db: { url: databaseUrl } }
  });

  return {
    async connect() {
      await client.$connect();
    },
    async listRequiredTables() {
      const rows = await client.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'journal_daily_eval'
          AND table_name IN ('_prisma_migrations', 'User', 'UserSettings')
      `;
      return rows.map((row) => row.table_name);
    },
    async upsertAcceptanceAdmin(input) {
      await client.$transaction(async (transaction) => {
        const user = await transaction.user.upsert({
          where: { username: input.username },
          create: {
            username: input.username,
            passwordHash: input.passwordHash,
            agreedToTermsAt: input.now,
            agreedToPrivacyAt: input.now,
            privacyPolicyVersion: "journal-daily-eval-local-v1"
          },
          update: {
            passwordHash: input.passwordHash,
            agreedToTermsAt: input.now,
            agreedToPrivacyAt: input.now,
            privacyPolicyVersion: "journal-daily-eval-local-v1"
          },
          select: { id: true }
        });
        await transaction.userSettings.upsert({
          where: { userId: user.id },
          create: { userId: user.id },
          update: {}
        });
      });
    },
    async disconnect() {
      await client.$disconnect();
    }
  };
}

const defaultDependencies: BootstrapLocalReviewDependencies = {
  assertPrivateIgnore: assertJournalDailyEvalPrivateIgnore,
  createDatabase: createPrismaBootstrapDatabase,
  hashPassword: defaultHashPassword,
  now: () => new Date()
};

function safeIsolationSummary(isolation: ReturnType<typeof validateJournalDailyEvalIsolation>) {
  return {
    base_url: isolation.base_url,
    database_host: isolation.database.hostname,
    database_name: isolation.database.database,
    schema: isolation.database.schema,
    direct_host: isolation.direct.hostname,
    private_data_area: "artifacts/journal-generation-evaluation/.private/formal",
    production_or_preview: false
  };
}

export async function runBootstrapLocalReview(input: {
  argv?: string[];
  env?: JournalDailyEvalIsolationEnv & { ACCEPTANCE_ADMIN_PASSWORD?: string };
  projectRoot?: string;
  dependencies?: Partial<BootstrapLocalReviewDependencies>;
}) {
  const argv = input.argv ?? [];
  const env = input.env ?? process.env;
  const projectRoot = input.projectRoot ?? process.cwd();
  const dependencies = { ...defaultDependencies, ...input.dependencies };
  const options = parseBootstrapLocalReviewArgs(argv);

  // 所有模式首先复用同一隔离守卫；任何远程、Preview 或错误 schema 都在此硬拒绝。
  const isolation = validateJournalDailyEvalIsolation(env, projectRoot);
  const privacy = await dependencies.assertPrivateIgnore(projectRoot);

  if (options.mode === "inspect") {
    if (options.confirmedSchema !== null) {
      throw new BootstrapLocalReviewError(
        "BOOTSTRAP_CONFIRMATION_WITHOUT_EXECUTE",
        "schema 确认参数只允许与 --execute 一起使用。"
      );
    }
    return {
      status: "inspect_only" as const,
      mode: "inspect" as const,
      isolation: safeIsolationSummary(isolation),
      private_gitignore_verified: privacy.probe_ignored,
      database_connection_performed: false,
      database_write_count: 0,
      migration_performed: false,
      account: {
        username: ACCEPTANCE_USERNAME,
        user_upserted: false,
        settings_upserted: false
      },
      next_step: `如需执行，使用 --execute --confirm-local-schema=${REQUIRED_SCHEMA}`
    };
  }

  if (options.confirmedSchema !== REQUIRED_SCHEMA) {
    throw new BootstrapLocalReviewError(
      "BOOTSTRAP_LOCAL_SCHEMA_CONFIRMATION_REQUIRED",
      `执行模式必须提供 --confirm-local-schema=${REQUIRED_SCHEMA}。`
    );
  }

  const database = await dependencies.createDatabase(env.DATABASE_URL as string);
  let connected = false;
  try {
    await database.connect();
    connected = true;
    const observedTables = new Set(await database.listRequiredTables());
    const missingTables = REQUIRED_TABLES.filter((tableName) => !observedTables.has(tableName));
    if (missingTables.length > 0) {
      throw new BootstrapLocalReviewError(
        "BOOTSTRAP_REQUIRED_TABLES_MISSING",
        `专用 schema 尚未完成迁移，缺少表：${missingTables.join(", ")}。请由 root 单独运行迁移。`
      );
    }

    const password = env.ACCEPTANCE_ADMIN_PASSWORD?.trim() || "Acceptance-Only-2026";
    const passwordHash = await dependencies.hashPassword(password);
    await database.upsertAcceptanceAdmin({
      username: ACCEPTANCE_USERNAME,
      passwordHash,
      now: dependencies.now()
    });

    return {
      status: "local_review_ready" as const,
      mode: "execute" as const,
      isolation: safeIsolationSummary(isolation),
      private_gitignore_verified: privacy.probe_ignored,
      database_connection_performed: true,
      required_tables_present: [...REQUIRED_TABLES],
      database_write_count: 2,
      migration_performed: false,
      account: {
        username: ACCEPTANCE_USERNAME,
        user_upserted: true,
        settings_upserted: true
      },
      fixture_write_count: 0
    };
  } finally {
    if (connected) {
      await database.disconnect();
    }
  }
}

async function main() {
  const summary = await runBootstrapLocalReview({ argv: process.argv.slice(2) });
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

const isCli = process.argv.some(
  (argument) => basename(argument) === basename(fileURLToPath(import.meta.url))
);
if (isCli) {
  main().catch((error: unknown) => {
    const code = error instanceof BootstrapLocalReviewError || error instanceof JournalDailyEvalIsolationError
      ? error.code
      : "BOOTSTRAP_LOCAL_REVIEW_FAILED";
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${code}: ${message}\n`);
    process.exitCode = 1;
  });
}
