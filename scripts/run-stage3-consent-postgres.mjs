#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DATABASE_NAME = "daily_light_e2e_validation_20260819";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const SCHEMA_PATTERN = /^daily_light_stage3_consent_[a-f0-9]{12,24}$/u;
const INTEGRATION_ACK = "I_UNDERSTAND";
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
  if (env.NODE_ENV === "production") fail("STAGE3_CONSENT_PRODUCTION_FORBIDDEN");
  if (env.VERCEL_ENV?.trim() || env.NEXT_PUBLIC_VERCEL_ENV?.trim()) {
    fail("STAGE3_CONSENT_VERCEL_FORBIDDEN");
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
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (
    (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") ||
    !LOOPBACK_HOSTS.has(parsed.hostname) ||
    databaseName !== DATABASE_NAME
  ) {
    fail(`${label}_DEDICATED_LOOPBACK_REQUIRED`);
  }
  return parsed;
}

function resolveSchemaName() {
  const requested = process.env.DAILY_LIGHT_STAGE3_SCHEMA?.trim();
  const schema = requested ?? `daily_light_stage3_consent_${randomBytes(8).toString("hex")}`;
  if (!SCHEMA_PATTERN.test(schema)) fail("STAGE3_CONSENT_SCHEMA_INVALID");
  return schema;
}

function withRuntimeParameters(source, schema, applicationName) {
  const next = new URL(source);
  next.searchParams.set("schema", schema);
  next.searchParams.set("application_name", applicationName);
  return next.toString();
}

function withoutTargetSchema(source) {
  const next = new URL(source);
  next.searchParams.set("schema", "public");
  next.searchParams.set("application_name", "stage3_consent_admin");
  return next.toString();
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

async function captureCommand(command, args) {
  const child = spawn(command, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  const [code] = await once(child, "exit");
  if (code !== 0) fail(`${command.toUpperCase()}_FAILED`);
  return Buffer.concat([...stdout, ...stderr]).toString("utf8");
}

async function assertNoConcurrentProductTests() {
  const output = await captureCommand("ps", ["-axo", "pid=,ppid=,command="]);
  const patterns = [
    /(?:^|\s)next(?:\.js)?\s+dev(?:\s|$)/u,
    /(?:^|\s)playwright(?:\s+test|\/cli\.js\s+test)(?:\s|$)/u,
    /run-playwright-e2e\.mjs/u
  ];
  const conflicts = output.split("\n").flatMap((line) => {
    const match = /^\s*(\d+)\s+(\d+)\s+(.+)$/u.exec(line);
    if (!match) return [];
    const pid = Number(match[1]);
    const parentPid = Number(match[2]);
    const command = match[3];
    if (pid === process.pid || pid === process.ppid || parentPid === process.pid) return [];
    return patterns.some((pattern) => pattern.test(command)) ? [pid] : [];
  });
  if (conflicts.length > 0) fail("STAGE3_CONSENT_CONCURRENT_PRODUCT_TEST_DETECTED");
}

async function prepareIsolatedMigrationBundle() {
  const directory = await mkdtemp(resolve(tmpdir(), "daily-light-stage3-consent-prisma-"));
  const sourceSchema = resolve(ROOT, "prisma/schema.prisma");
  const sourceMigrations = resolve(ROOT, "prisma/migrations");
  const targetSchema = resolve(directory, "schema.prisma");
  const targetMigrations = resolve(directory, "migrations");
  await Promise.all([
    cp(sourceSchema, targetSchema),
    cp(sourceMigrations, targetMigrations, { recursive: true })
  ]);

  const pgvectorMigration = resolve(
    targetMigrations,
    "20260518113000_harden_pgvector_setup/migration.sql"
  );
  const migrationSql = await readFile(pgvectorMigration, "utf8");
  const qualifiedSql = migrationSql.replace(
    'ADD COLUMN IF NOT EXISTS "embedding" vector(2048)',
    'ADD COLUMN IF NOT EXISTS "embedding" public.vector(2048)'
  );
  if (qualifiedSql === migrationSql) fail("STAGE3_CONSENT_PGVECTOR_MIGRATION_SHAPE_CHANGED");
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
    fail("STAGE3_CONSENT_PGVECTOR_PUBLIC_REQUIRED");
  }
}

async function countSchema(database, schema) {
  const rows = await database.$queryRawUnsafe(
    'SELECT COUNT(*)::int AS "count" FROM pg_namespace WHERE nspname = $1',
    schema
  );
  return Array.isArray(rows) ? rows[0]?.count ?? -1 : -1;
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
      });
    }
    if (violations.length > 0) {
      throw new Error(`STAGE3_CONSENT_MODEL_CALL_DETECTED:${violations.slice(0, 12).join(",")}`);
    }
    process.stdout.write(`${JSON.stringify({
      event: "stage3_consent_zero_model_verified",
      aiRequestLogCount: requestLogCount,
      traceCount: traces.length
    })}\n`);
  } finally {
    await database.$disconnect();
  }
}

function sanitizeError(error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  return message.replace(/postgres(?:ql)?:\/\/[^\s]+/giu, "[REDACTED_DATABASE_URL]");
}

async function main() {
  assertRunnerEnvironment(process.env);
  await assertNoConcurrentProductTests();

  const baseDatabase = parseBaseDatabaseUrl(
    "DAILY_LIGHT_STAGE3_DATABASE_URL",
    process.env.DAILY_LIGHT_STAGE3_DATABASE_URL
  );
  const baseDirect = parseBaseDatabaseUrl(
    "DAILY_LIGHT_STAGE3_DIRECT_URL",
    process.env.DAILY_LIGHT_STAGE3_DIRECT_URL ?? process.env.DAILY_LIGHT_STAGE3_DATABASE_URL
  );
  const schema = resolveSchemaName();
  const runId = schema.replace("daily_light_stage3_consent_", "");
  const applicationName = `stage3_consent_it_${runId}`;
  const databaseUrl = withRuntimeParameters(baseDatabase, schema, applicationName);
  const directUrl = withRuntimeParameters(baseDirect, schema, applicationName);
  const admin = new PrismaClient({
    datasources: { db: { url: withoutTargetSchema(baseDirect) } }
  });
  const childEnv = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    DIRECT_URL: directUrl,
    DAILY_LIGHT_STAGE3_TEST_DATABASE_URL: databaseUrl,
    DAILY_LIGHT_STAGE3_APPLICATION_NAME: applicationName,
    DAILY_LIGHT_STAGE3_CONSENT_POSTGRES_INTEGRATION: INTEGRATION_ACK,
    GI088_EVALUATION_ENABLED: "false",
    DEEPSEEK_API_KEY: "",
    VOLCENGINE_ARK_API_KEY: "",
    ARK_API_KEY: "",
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    EVENT_CENTERED_GENERATIVE_MODEL: ""
  };
  let schemaCreated = false;
  let migrationBundle = null;
  let primaryError = null;

  try {
    await admin.$connect();
    await assertPublicPgvector(admin);
    if (await countSchema(admin, schema) !== 0) fail("STAGE3_CONSENT_SCHEMA_ALREADY_EXISTS");

    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    process.stdout.write(`${JSON.stringify({
      event: "stage3_consent_schema_created",
      database: DATABASE_NAME,
      schema
    })}\n`);

    const prismaCli = resolve(ROOT, "node_modules/prisma/build/index.js");
    const vitestCli = resolve(ROOT, "node_modules/vitest/vitest.mjs");
    for (const cli of [prismaCli, vitestCli]) {
      if (!existsSync(cli)) fail("STAGE3_CONSENT_DEPENDENCIES_NOT_INSTALLED");
    }

    migrationBundle = await prepareIsolatedMigrationBundle();
    await runCommand(
      process.execPath,
      [prismaCli, "migrate", "deploy", "--schema", migrationBundle.schema],
      { env: childEnv, label: "STAGE3_CONSENT_MIGRATE" }
    );
    await runCommand(
      process.execPath,
      [
        vitestCli,
        "run",
        "tests/integration/ai-feedback-consent-postgres.test.ts",
        "--reporter=verbose"
      ],
      { env: childEnv, label: "STAGE3_CONSENT_VITEST" }
    );
  } catch (error) {
    primaryError = error;
  } finally {
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
        if (!SCHEMA_PATTERN.test(schema)) fail("STAGE3_CONSENT_CLEANUP_SCHEMA_INVALID");
        await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
        const residualCount = await countSchema(admin, schema);
        if (residualCount !== 0) fail("STAGE3_CONSENT_SCHEMA_CLEANUP_INCOMPLETE");
        process.stdout.write(`${JSON.stringify({
          event: "stage3_consent_schema_dropped",
          schema,
          residualCount
        })}\n`);
      } catch (error) {
        primaryError ??= error;
      }
    }
    await admin.$disconnect();
  }

  if (!primaryError && terminationSignal) {
    primaryError = new Error(`STAGE3_CONSENT_INTERRUPTED_${terminationSignal}`);
  }
  if (primaryError) throw primaryError;
}

main().catch((error) => {
  process.stderr.write(`${sanitizeError(error)}\n`);
  process.exit(1);
});
