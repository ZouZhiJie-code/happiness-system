import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const REQUIRED_DATABASE_NAME = "happiness_system_codex";
const REQUIRED_SCHEMA = "journal_daily_eval";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

export type IsolationErrorCode =
  | "PRODUCTION_CONTEXT_FORBIDDEN"
  | "VERCEL_CONTEXT_FORBIDDEN"
  | "LOCAL_BASE_URL_MISSING"
  | "LOCAL_BASE_URL_INVALID"
  | "LOCAL_BASE_URL_PROTOCOL_FORBIDDEN"
  | "LOCAL_BASE_URL_HOST_FORBIDDEN"
  | "DATABASE_URL_MISSING"
  | "DATABASE_URL_INVALID"
  | "DATABASE_URL_PROTOCOL_FORBIDDEN"
  | "DATABASE_URL_HOST_FORBIDDEN"
  | "DATABASE_URL_DATABASE_FORBIDDEN"
  | "DATABASE_URL_SCHEMA_FORBIDDEN"
  | "DIRECT_URL_MISSING"
  | "DIRECT_URL_INVALID"
  | "DIRECT_URL_PROTOCOL_FORBIDDEN"
  | "DIRECT_URL_HOST_FORBIDDEN"
  | "DIRECT_URL_DATABASE_FORBIDDEN"
  | "DIRECT_URL_SCHEMA_FORBIDDEN"
  | "DATABASE_TARGET_MISMATCH"
  | "PRIVATE_DATA_AREA_FORBIDDEN"
  | "PRIVATE_GITIGNORE_INVALID"
  | "PRIVATE_PATH_NOT_IGNORED"
  | "PRIVATE_FILE_TRACKED";

export class JournalDailyEvalIsolationError extends Error {
  constructor(public readonly code: IsolationErrorCode, message: string) {
    super(message);
  }
}

export interface JournalDailyEvalIsolationEnv {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  NEXT_PUBLIC_VERCEL_ENV?: string;
  JOURNAL_DAILY_EVAL_BASE_URL?: string;
  JOURNAL_DAILY_EVAL_DATA_DIR?: string;
  DATABASE_URL?: string;
  DIRECT_URL?: string;
}

interface ValidatedDatabaseTarget {
  hostname: string;
  port: string;
  database: string;
  schema: string;
}

function fail(code: IsolationErrorCode, message: string): never {
  throw new JournalDailyEvalIsolationError(code, message);
}

function parseDatabaseTarget(label: "DATABASE_URL" | "DIRECT_URL", rawValue: string | undefined) {
  const prefix = label === "DATABASE_URL" ? "DATABASE_URL" : "DIRECT_URL";
  if (!rawValue?.trim()) {
    fail(`${prefix}_MISSING`, `${label} 必须在启动命令中显式覆盖。`);
  }
  let parsed: URL;
  try {
    parsed = new URL(rawValue);
  } catch {
    fail(`${prefix}_INVALID`, `${label} 不是有效的 PostgreSQL URL。`);
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    fail(`${prefix}_PROTOCOL_FORBIDDEN`, `${label} 必须使用 postgresql 协议。`);
  }
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    fail(`${prefix}_HOST_FORBIDDEN`, `${label} 只允许 localhost 或 127.0.0.1。`);
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (database !== REQUIRED_DATABASE_NAME) {
    fail(`${prefix}_DATABASE_FORBIDDEN`, `${label} 的 database 必须为 ${REQUIRED_DATABASE_NAME}。`);
  }
  const schema = parsed.searchParams.get("schema") ?? "";
  if (schema !== REQUIRED_SCHEMA) {
    fail(`${prefix}_SCHEMA_FORBIDDEN`, `${label} 的 schema 必须为 ${REQUIRED_SCHEMA}。`);
  }
  return {
    hostname: parsed.hostname,
    port: parsed.port || "5432",
    database,
    schema
  } satisfies ValidatedDatabaseTarget;
}

function isWithin(parentPath: string, childPath: string) {
  const childRelative = relative(parentPath, childPath);
  return childRelative.length > 0 && !childRelative.startsWith("..") && !isAbsolute(childRelative);
}

export function validateJournalDailyEvalIsolation(
  env: JournalDailyEvalIsolationEnv,
  projectRoot = process.cwd()
) {
  if (env.NODE_ENV === "production") {
    fail("PRODUCTION_CONTEXT_FORBIDDEN", "日志正式评测禁止在 production 环境运行。");
  }
  if (env.VERCEL_ENV?.trim() || env.NEXT_PUBLIC_VERCEL_ENV?.trim()) {
    fail("VERCEL_CONTEXT_FORBIDDEN", "日志正式评测禁止在任何 Vercel Preview/Production 上下文运行。");
  }

  if (!env.JOURNAL_DAILY_EVAL_BASE_URL?.trim()) {
    fail("LOCAL_BASE_URL_MISSING", "JOURNAL_DAILY_EVAL_BASE_URL 必须显式设置为本地地址。");
  }
  let baseUrl: URL;
  try {
    baseUrl = new URL(env.JOURNAL_DAILY_EVAL_BASE_URL);
  } catch {
    fail("LOCAL_BASE_URL_INVALID", "JOURNAL_DAILY_EVAL_BASE_URL 格式无效。");
  }
  if (baseUrl.protocol !== "http:") {
    fail("LOCAL_BASE_URL_PROTOCOL_FORBIDDEN", "本地正式评测只允许 http 协议。");
  }
  if (!LOOPBACK_HOSTS.has(baseUrl.hostname)) {
    fail("LOCAL_BASE_URL_HOST_FORBIDDEN", "本地正式评测页面只允许 localhost 或 127.0.0.1。");
  }

  const database = parseDatabaseTarget("DATABASE_URL", env.DATABASE_URL);
  const direct = parseDatabaseTarget("DIRECT_URL", env.DIRECT_URL);
  if (database.database !== direct.database || database.schema !== direct.schema) {
    fail("DATABASE_TARGET_MISMATCH", "DATABASE_URL 与 DIRECT_URL 必须指向同一 database 和 schema。");
  }

  const privateFormalRoot = resolve(
    projectRoot,
    "artifacts/journal-generation-evaluation/.private/formal"
  );
  const configuredDataDirectory = env.JOURNAL_DAILY_EVAL_DATA_DIR?.trim();
  const dataDirectory = configuredDataDirectory
    ? resolve(projectRoot, configuredDataDirectory)
    : privateFormalRoot;
  if (dataDirectory !== privateFormalRoot && !isWithin(privateFormalRoot, dataDirectory)) {
    fail("PRIVATE_DATA_AREA_FORBIDDEN", "评测运行数据必须位于 .private/formal/ 数据区内。");
  }

  return {
    base_url: baseUrl.origin,
    database,
    direct,
    data_directory: dataDirectory,
    private_formal_root: privateFormalRoot,
    connection_performed: false as const
  };
}

export async function assertJournalDailyEvalPrivateIgnore(projectRoot = process.cwd()) {
  const privateRoot = resolve(projectRoot, "artifacts/journal-generation-evaluation/.private");
  const gitignorePath = resolve(privateRoot, ".gitignore");
  let gitignore: string;
  try {
    gitignore = await readFile(gitignorePath, "utf8");
  } catch {
    fail("PRIVATE_GITIGNORE_INVALID", ".private/.gitignore 缺失或不可读。");
  }
  const rules = gitignore.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  if (!rules.includes("*") || !rules.includes("!.gitignore")) {
    fail("PRIVATE_GITIGNORE_INVALID", ".private/.gitignore 必须忽略全部内容并仅放行自身。");
  }

  const probeRelative = "artifacts/journal-generation-evaluation/.private/formal/__privacy_probe__.json";
  try {
    await execFileAsync("git", ["-C", projectRoot, "check-ignore", "--no-index", "--quiet", probeRelative]);
  } catch {
    fail("PRIVATE_PATH_NOT_IGNORED", ".private/formal 隐私探针未被 Git 忽略。");
  }

  const { stdout } = await execFileAsync("git", [
    "-C",
    projectRoot,
    "ls-files",
    "--",
    "artifacts/journal-generation-evaluation/.private"
  ]);
  const trackedPrivateFiles = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.endsWith("/.gitignore"));
  if (trackedPrivateFiles.length > 0) {
    fail("PRIVATE_FILE_TRACKED", ".private 下存在被 Git 跟踪的私密文件。");
  }

  return {
    gitignore_path: gitignorePath,
    probe_ignored: true as const,
    tracked_private_file_count: 0
  };
}
