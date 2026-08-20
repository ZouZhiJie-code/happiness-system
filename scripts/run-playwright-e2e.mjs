#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const SCHEMA_PATTERN = /^daily_light_e2e_[a-z0-9_]{6,44}$/u;
const ZERO_MODEL_ACK = "I_UNDERSTAND";
const SERVER_READY_TIMEOUT_MS = 90_000;
const activeChildren = new Set();
let terminationSignal = null;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    terminationSignal ??= signal;
    for (const child of activeChildren) {
      if (child.exitCode === null) child.kill("SIGTERM");
    }
  });
}

function fail(code) {
  throw new Error(code);
}

function assertRunnerEnvironment(env) {
  if (env.NODE_ENV === "production") fail("DAILY_LIGHT_E2E_PRODUCTION_FORBIDDEN");
  if (env.VERCEL_ENV?.trim() || env.NEXT_PUBLIC_VERCEL_ENV?.trim()) {
    fail("DAILY_LIGHT_E2E_VERCEL_FORBIDDEN");
  }
}

function parseBaseDatabaseUrl(label, value) {
  if (!value?.trim()) fail(`${label}_REQUIRED`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${label}_INVALID`);
  }
  if (
    (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") ||
    !LOOPBACK_HOSTS.has(parsed.hostname) ||
    !decodeURIComponent(parsed.pathname.replace(/^\/+/, ""))
  ) {
    fail(`${label}_LOOPBACK_POSTGRES_REQUIRED`);
  }
  return parsed;
}

function buildSchemaName() {
  const timestamp = Date.now().toString(36);
  const suffix = randomBytes(5).toString("hex");
  const schema = `daily_light_e2e_${timestamp}_${suffix}`;
  if (!SCHEMA_PATTERN.test(schema)) fail("DAILY_LIGHT_E2E_SCHEMA_INVALID");
  return schema;
}

function withSchema(source, schema) {
  const next = new URL(source);
  next.searchParams.set("schema", schema);
  return next.toString();
}

function withoutSchema(source) {
  const next = new URL(source);
  next.searchParams.set("schema", "public");
  return next.toString();
}

async function reserveLoopbackPort() {
  const server = net.createServer();
  server.unref();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") fail("DAILY_LIGHT_E2E_PORT_RESOLUTION_FAILED");
  const { port } = address;
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  return port;
}

async function runCommand(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env: options.env ?? process.env,
    stdio: "inherit"
  });
  activeChildren.add(child);
  let code;
  let signal;
  try {
    [code, signal] = await once(child, "exit");
  } finally {
    activeChildren.delete(child);
  }
  if (code !== 0) {
    const error = new Error(`${options.label ?? command}_FAILED`);
    error.exitCode = code;
    error.signal = signal;
    throw error;
  }
}

async function prepareIsolatedMigrationBundle() {
  const directory = await mkdtemp(resolve(tmpdir(), "daily-light-e2e-prisma-"));
  const sourceSchema = resolve(ROOT, "prisma/schema.prisma");
  const sourceMigrations = resolve(ROOT, "prisma/migrations");
  const targetSchema = resolve(directory, "schema.prisma");
  const targetMigrations = resolve(directory, "migrations");
  await Promise.all([
    cp(sourceSchema, targetSchema),
    cp(sourceMigrations, targetMigrations, { recursive: true })
  ]);

  // Prisma deliberately narrows search_path to the requested temporary schema.
  // pgvector is installed once per database in `public`, so the historical
  // migration's unqualified `vector(2048)` cannot resolve inside an isolated
  // schema. Patch only the ephemeral migration copy; the repository migration
  // and its Production checksum stay byte-for-byte unchanged.
  const pgvectorMigration = resolve(
    targetMigrations,
    "20260518113000_harden_pgvector_setup/migration.sql"
  );
  const migrationSql = await readFile(pgvectorMigration, "utf8");
  const qualifiedSql = migrationSql.replace(
    'ADD COLUMN IF NOT EXISTS "embedding" vector(2048)',
    'ADD COLUMN IF NOT EXISTS "embedding" public.vector(2048)'
  );
  if (qualifiedSql === migrationSql) fail("DAILY_LIGHT_E2E_PGVECTOR_MIGRATION_SHAPE_CHANGED");
  await writeFile(pgvectorMigration, qualifiedSql, { mode: 0o600 });
  return { directory, schema: targetSchema };
}

async function assertPublicPgvector(database) {
  const rows = await database.$queryRawUnsafe(`
    SELECT namespace.nspname AS "schema"
    FROM pg_extension AS extension
    JOIN pg_namespace AS namespace ON namespace.oid = extension.extnamespace
    WHERE extension.extname = 'vector'
  `);
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.schema !== "public") {
    fail("DAILY_LIGHT_E2E_PGVECTOR_PUBLIC_REQUIRED");
  }
}

async function waitForServer(baseURL, child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < SERVER_READY_TIMEOUT_MS) {
    if (child.exitCode !== null) fail("DAILY_LIGHT_E2E_SERVER_EXITED_EARLY");
    try {
      const response = await fetch(`${baseURL}/login`, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // The local Next server is still compiling.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  fail("DAILY_LIGHT_E2E_SERVER_READY_TIMEOUT");
}

async function stopServer(child) {
  if (!child) return;
  if (child.exitCode !== null) {
    activeChildren.delete(child);
    return;
  }
  child.kill("SIGTERM");
  const exited = once(child, "exit").then(() => true);
  const graceful = await Promise.race([
    exited,
    new Promise((resolveDelay) => setTimeout(() => resolveDelay(false), 10_000))
  ]);
  if (!graceful && child.exitCode === null) {
    child.kill("SIGKILL");
    await once(child, "exit").catch(() => {});
  }
  activeChildren.delete(child);
}

function walkJson(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, visit);
    return;
  }
  if (!value || typeof value !== "object") return;
  visit(value);
  for (const nested of Object.values(value)) walkJson(nested, visit);
}

async function assertZeroModelEvidence(databaseUrl) {
  const database = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const [requestLogCount, traces] = await Promise.all([
      database.aIRequestLog.count(),
      database.aIGenerationTrace.findMany({
        select: {
          id: true,
          outputOrigin: true,
          contextSnapshot: true,
          pipelineDecisions: true
        }
      })
    ]);
    const violations = [];
    if (requestLogCount !== 0) violations.push(`AIRequestLog=${requestLogCount}`);

    for (const trace of traces) {
      if (trace.outputOrigin === "llm") violations.push(`${trace.id}:outputOrigin=llm`);
      walkJson([trace.contextSnapshot, trace.pipelineDecisions], (record) => {
        if (typeof record.providerAttemptCount === "number" && record.providerAttemptCount !== 0) {
          violations.push(`${trace.id}:providerAttemptCount=${record.providerAttemptCount}`);
        }
        if (record.actualModelCallExecuted === true) {
          violations.push(`${trace.id}:actualModelCallExecuted=true`);
        }
        if (Array.isArray(record.attempts)) {
          for (const attempt of record.attempts) {
            if (
              attempt &&
              typeof attempt === "object" &&
              "provider" in attempt &&
              attempt.provider !== "disabled"
            ) {
              violations.push(`${trace.id}:provider=${String(attempt.provider)}`);
            }
          }
        }
      });
    }

    if (violations.length > 0) {
      throw new Error(`DAILY_LIGHT_E2E_MODEL_CALL_DETECTED:${violations.slice(0, 12).join(",")}`);
    }
    process.stdout.write(`${JSON.stringify({
      event: "daily_light_e2e_zero_model_verified",
      aiRequestLogCount: requestLogCount,
      traceCount: traces.length
    })}\n`);
  } finally {
    await database.$disconnect();
  }
}

async function main() {
  assertRunnerEnvironment(process.env);
  const baseDatabase = parseBaseDatabaseUrl(
    "DAILY_LIGHT_E2E_DATABASE_URL",
    process.env.DAILY_LIGHT_E2E_DATABASE_URL
  );
  const baseDirect = parseBaseDatabaseUrl(
    "DAILY_LIGHT_E2E_DIRECT_URL",
    process.env.DAILY_LIGHT_E2E_DIRECT_URL ?? process.env.DAILY_LIGHT_E2E_DATABASE_URL
  );
  const databaseName = decodeURIComponent(baseDatabase.pathname.replace(/^\/+/, ""));
  const directDatabaseName = decodeURIComponent(baseDirect.pathname.replace(/^\/+/, ""));
  if (databaseName !== directDatabaseName) fail("DAILY_LIGHT_E2E_DATABASE_TARGET_MISMATCH");

  const schema = buildSchemaName();
  const databaseUrl = withSchema(baseDatabase, schema);
  const directUrl = withSchema(baseDirect, schema);
  const admin = new PrismaClient({
    datasources: { db: { url: withoutSchema(baseDirect) } }
  });
  const port = await reserveLoopbackPort();
  const baseURL = `http://127.0.0.1:${port}`;
  const childEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: directUrl,
    DAILY_LIGHT_E2E_BASE_URL: baseURL,
    DAILY_LIGHT_E2E_ZERO_MODEL: ZERO_MODEL_ACK,
    INTERVIEW_EVENT_CENTERED_MODE: "event_centered",
    INTERVIEW_EVENT_CENTERED_STRATEGY: "baseline",
    INTERVIEW_EVENT_CENTERED_SCOPE: "all_angles",
    GI088_EVALUATION_ENABLED: "false",
    ACCEPTANCE_ADMIN_USERNAME: "acceptance_admin",
    ADMIN_USERNAMES: "acceptance_admin",
    NEXT_TELEMETRY_DISABLED: "1",
    AI_AGENT: "",
    CODEX_CI: "",
    CODEX_SANDBOX: "",
    CODEX_THREAD_ID: "",
    TZ: "Asia/Shanghai",
    DEEPSEEK_API_KEY: "",
    VOLCENGINE_ARK_API_KEY: "",
    ARK_API_KEY: "",
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    EVENT_CENTERED_GENERATIVE_MODEL: ""
  };
  let schemaCreated = false;
  let server = null;
  let migrationBundle = null;
  let primaryError = null;

  try {
    await admin.$connect();
    await assertPublicPgvector(admin);
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    process.stdout.write(`${JSON.stringify({
      event: "daily_light_e2e_schema_created",
      database: databaseName,
      schema,
      baseURL
    })}\n`);

    const prismaCli = resolve(ROOT, "node_modules/prisma/build/index.js");
    const nextCli = resolve(ROOT, "node_modules/next/dist/bin/next");
    const playwrightCli = resolve(ROOT, "node_modules/@playwright/test/cli.js");
    for (const cli of [prismaCli, nextCli, playwrightCli]) {
      if (!existsSync(cli)) fail("DAILY_LIGHT_E2E_DEPENDENCIES_NOT_INSTALLED");
    }

    migrationBundle = await prepareIsolatedMigrationBundle();
    await runCommand(process.execPath, [prismaCli, "migrate", "deploy", "--schema", migrationBundle.schema], {
      env: childEnv,
      label: "DAILY_LIGHT_E2E_MIGRATE"
    });
    server = spawn(process.execPath, [nextCli, "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: ROOT,
      env: childEnv,
      stdio: "inherit"
    });
    activeChildren.add(server);
    await waitForServer(baseURL, server);
    await runCommand(process.execPath, [playwrightCli, "test", ...process.argv.slice(2)], {
      env: childEnv,
      label: "DAILY_LIGHT_E2E_PLAYWRIGHT"
    });
  } catch (error) {
    primaryError = error;
  } finally {
    await stopServer(server);
    if (migrationBundle) {
      try {
        await rm(migrationBundle.directory, { recursive: true, force: true });
      } catch (error) {
        primaryError ??= error;
      }
    }
    if (schemaCreated) {
      try {
        await assertZeroModelEvidence(databaseUrl);
      } catch (error) {
        primaryError ??= error;
      }
      try {
        if (!SCHEMA_PATTERN.test(schema)) fail("DAILY_LIGHT_E2E_CLEANUP_SCHEMA_INVALID");
        await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
        process.stdout.write(`${JSON.stringify({ event: "daily_light_e2e_schema_dropped", schema })}\n`);
      } catch (error) {
        primaryError ??= error;
      }
    }
    await admin.$disconnect();
  }

  if (!primaryError && terminationSignal) {
    primaryError = new Error(`DAILY_LIGHT_E2E_INTERRUPTED_${terminationSignal}`);
  }
  if (primaryError) throw primaryError;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
