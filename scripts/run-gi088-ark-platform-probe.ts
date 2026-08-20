import { randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile,
  type FileHandle
} from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { OpenAIProvider } from "../src/server/services/ai/openai.provider";
import { createGi088EmptyContentProbePublicCase } from "../src/server/services/evaluation/gi088/empty-content-probe";
import {
  GI088_ARK_PLATFORM_PROBE_CALL_BUDGET,
  GI088_ARK_PLATFORM_PROBE_LEDGER_SCHEMA_VERSION,
  GI088_ARK_PLATFORM_PROBE_RUNTIME,
  GI088_ARK_PLATFORM_PROBE_VERSION,
  createGi088ArkPlatformDecision,
  createGi088ArkPlatformProbePlan,
  createGi088ArkPlatformPublicRequest,
  createGi088ArkPlatformPublicSummary,
  runGi088ArkPlatformProbeCall,
  type Gi088ArkPlatformProbePlan,
  type Gi088ArkPlatformProbeResult
} from "../src/server/services/evaluation/gi088/ark-platform-probe";

const SOURCE_PATH = path.resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-readonly-db-snapshot.json"
);
const OUTPUT_ROOT = path.resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-10-gi088-human-eval-v7r1-visible-continuation/ark-platform-probe"
);
const PUBLIC_RESULT_PATH = path.resolve(
  process.cwd(),
  "artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-ark-flash-platform-probe-v1-result.json"
);
const EXECUTE_FLAG = "--execute";
const REQUIRED_SCOPE = "ark_flash_platform_probe";
const REQUIRED_CONFIRMATION = "I_UNDERSTAND_3_CALLS";

type LedgerCall = {
  order: number;
  caseId: string;
  status: "reserved" | "completed";
  reservedAt: string;
  completedAt: string | null;
  result: Gi088ArkPlatformProbeResult | null;
};

type ProbeLedger = {
  schemaVersion: typeof GI088_ARK_PLATFORM_PROBE_LEDGER_SCHEMA_VERSION;
  probeVersion: typeof GI088_ARK_PLATFORM_PROBE_VERSION;
  probeFingerprint: string;
  authorizationId: string;
  authorizedCallBudget: number;
  sourcePath: string;
  sourceSnapshotSha256: string;
  createdAt: string;
  completedAt: string | null;
  calls: LedgerCall[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertLocalRuntimePath(candidate: string) {
  const relative = path.relative(process.cwd(), candidate);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !relative.split(path.sep).includes("local-runtime")
  ) {
    throw new Error("GI088_ARK_PLATFORM_LOCAL_RUNTIME_PATH_REQUIRED");
  }
}

async function writeJson(filePath: string, value: unknown, mode: number) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode
  });
  await rename(temporaryPath, filePath);
  await chmod(filePath, mode);
}

async function writePrivateJson(filePath: string, value: unknown) {
  assertLocalRuntimePath(filePath);
  await chmod(path.dirname(filePath), 0o700).catch(() => undefined);
  await writeJson(filePath, value, 0o600);
}

async function readJsonIfPresent(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function createGi088ArkPlatformPublicPlan(
  plan: Gi088ArkPlatformProbePlan
) {
  return {
    probeVersion: plan.probeVersion,
    probeFingerprint: plan.probeFingerprint,
    sourceProbeVersion: plan.sourceProbeVersion,
    sourceProbeFingerprint: plan.sourceProbeFingerprint,
    sourceSnapshotSha256: plan.sourceSnapshotSha256,
    sourceEvaluationVersion: plan.sourceEvaluationVersion,
    sourceCandidateFingerprint: plan.sourceCandidateFingerprint,
    sourceExecutionFingerprint: plan.sourceExecutionFingerprint,
    runtime: plan.runtime,
    authorizedCallBudget: plan.authorizedCallBudget,
    cases: plan.cases.map((probeCase, index) => ({
      order: index + 1,
      ...createGi088EmptyContentProbePublicCase(probeCase),
      request: createGi088ArkPlatformPublicRequest(probeCase)
    })),
    ledgerSchemaVersion: plan.ledgerSchemaVersion,
    publicSummaryContract: plan.publicSummaryContract,
    modelGenerationCalls: 0,
    executionAuthorized: false
  };
}

export function assertGi088ArkPlatformAuthorization(
  probeFingerprint: string,
  env: Readonly<Partial<NodeJS.ProcessEnv>> = process.env
) {
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
    throw new Error("GI088_ARK_PLATFORM_PRODUCTION_FORBIDDEN");
  }
  if (env.GI088_MODEL_CALL_SCOPE !== REQUIRED_SCOPE) {
    throw new Error("GI088_ARK_PLATFORM_SCOPE_NOT_AUTHORIZED");
  }
  if (
    env.GI088_AUTHORIZED_ARK_PLATFORM_PROBE_FINGERPRINT !== probeFingerprint
  ) {
    throw new Error("GI088_ARK_PLATFORM_FINGERPRINT_NOT_AUTHORIZED");
  }
  if (env.GI088_ARK_PLATFORM_CONFIRMATION !== REQUIRED_CONFIRMATION) {
    throw new Error("GI088_ARK_PLATFORM_CONFIRMATION_REQUIRED");
  }
  if (
    env.GI088_ARK_PLATFORM_AUTHORIZED_BUDGET !==
    String(GI088_ARK_PLATFORM_PROBE_CALL_BUDGET)
  ) {
    throw new Error("GI088_ARK_PLATFORM_BUDGET_NOT_AUTHORIZED");
  }
  const authorizationId = env.GI088_ARK_PLATFORM_AUTHORIZATION_ID?.trim() ?? "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      authorizationId
    )
  ) {
    throw new Error("GI088_ARK_PLATFORM_AUTHORIZATION_ID_REQUIRED");
  }
  return authorizationId;
}

function parseLedger(input: {
  value: unknown;
  plan: Gi088ArkPlatformProbePlan;
  authorizationId: string;
}): ProbeLedger {
  const { value, plan, authorizationId } = input;
  if (!isRecord(value) || !Array.isArray(value.calls)) {
    throw new Error("GI088_ARK_PLATFORM_LEDGER_INVALID");
  }
  if (
    value.schemaVersion !== GI088_ARK_PLATFORM_PROBE_LEDGER_SCHEMA_VERSION ||
    value.probeVersion !== plan.probeVersion ||
    value.probeFingerprint !== plan.probeFingerprint ||
    value.authorizationId !== authorizationId ||
    value.authorizedCallBudget !== plan.authorizedCallBudget ||
    value.sourcePath !== SOURCE_PATH ||
    value.sourceSnapshotSha256 !== plan.sourceSnapshotSha256 ||
    value.calls.length > plan.authorizedCallBudget
  ) {
    throw new Error("GI088_ARK_PLATFORM_LEDGER_LINEAGE_MISMATCH");
  }
  for (const [index, item] of value.calls.entries()) {
    if (!isRecord(item)) throw new Error("GI088_ARK_PLATFORM_LEDGER_INVALID");
    const expected = plan.cases[index];
    if (
      !expected ||
      item.order !== index + 1 ||
      item.caseId !== expected.caseId ||
      (item.status !== "reserved" && item.status !== "completed")
    ) {
      throw new Error("GI088_ARK_PLATFORM_LEDGER_SCHEDULE_MISMATCH");
    }
    if (item.status === "reserved") {
      throw new Error("GI088_ARK_PLATFORM_CALL_OUTCOME_AMBIGUOUS");
    }
  }
  return value as ProbeLedger;
}

async function acquireLock(lockPath: string) {
  assertLocalRuntimePath(lockPath);
  await mkdir(path.dirname(lockPath), { recursive: true, mode: 0o700 });
  try {
    return await open(lockPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("GI088_ARK_PLATFORM_RUN_LOCKED");
    }
    throw error;
  }
}

async function releaseLock(
  lock: FileHandle,
  lockPath: string,
  retain: boolean
) {
  await lock.close();
  if (!retain) await unlink(lockPath).catch(() => undefined);
}

async function execute(input: {
  plan: Gi088ArkPlatformProbePlan;
  authorizationId: string;
  ledgerPath: string;
  privateSummaryPath: string;
}) {
  const stored = await readJsonIfPresent(input.ledgerPath);
  let ledger: ProbeLedger;
  if (stored) {
    ledger = parseLedger({
      value: stored,
      plan: input.plan,
      authorizationId: input.authorizationId
    });
  } else {
    ledger = {
      schemaVersion: GI088_ARK_PLATFORM_PROBE_LEDGER_SCHEMA_VERSION,
      probeVersion: GI088_ARK_PLATFORM_PROBE_VERSION,
      probeFingerprint: input.plan.probeFingerprint,
      authorizationId: input.authorizationId,
      authorizedCallBudget: input.plan.authorizedCallBudget,
      sourcePath: SOURCE_PATH,
      sourceSnapshotSha256: input.plan.sourceSnapshotSha256,
      createdAt: new Date().toISOString(),
      completedAt: null,
      calls: []
    };
    await writePrivateJson(input.ledgerPath, ledger);
  }
  loadEnvConfig(process.cwd());
  const apiKey =
    process.env.VOLCENGINE_ARK_API_KEY?.trim() ||
    process.env.ARK_API_KEY?.trim();
  if (!apiKey) throw new Error("GI088_ARK_PLATFORM_API_KEY_MISSING");
  const provider = new OpenAIProvider({
    apiKey,
    model: GI088_ARK_PLATFORM_PROBE_RUNTIME.model,
    baseUrl: GI088_ARK_PLATFORM_PROBE_RUNTIME.baseUrl
  });
  for (const [index, probeCase] of input.plan.cases.entries()) {
    if (ledger.calls[index]?.status === "completed") continue;
    if (ledger.calls.length >= input.plan.authorizedCallBudget) {
      throw new Error("GI088_ARK_PLATFORM_CALL_BUDGET_EXHAUSTED");
    }
    const call: LedgerCall = {
      order: index + 1,
      caseId: probeCase.caseId,
      status: "reserved",
      reservedAt: new Date().toISOString(),
      completedAt: null,
      result: null
    };
    ledger.calls.push(call);
    await writePrivateJson(input.ledgerPath, ledger);
    const result = await runGi088ArkPlatformProbeCall({
      provider,
      order: index + 1,
      probeCase
    });
    call.status = "completed";
    call.completedAt = new Date().toISOString();
    call.result = result;
    await writePrivateJson(input.ledgerPath, ledger);
    process.stdout.write(
      `${JSON.stringify({
        order: result.order,
        caseId: result.caseId,
        status: result.status,
        errorCode: result.errorCode,
        callsCompleted: ledger.calls.length,
        callBudget: ledger.authorizedCallBudget
      })}\n`
    );
  }
  ledger.completedAt = new Date().toISOString();
  await writePrivateJson(input.ledgerPath, ledger);
  const results = ledger.calls
    .map((call) => call.result)
    .filter((result): result is Gi088ArkPlatformProbeResult => result !== null);
  if (results.length !== GI088_ARK_PLATFORM_PROBE_CALL_BUDGET) {
    throw new Error("GI088_ARK_PLATFORM_RESULTS_INCOMPLETE");
  }
  const publicResult = {
    ...createGi088ArkPlatformPublicPlan(input.plan),
    executionAuthorized: true,
    modelGenerationCalls: results.length,
    completedAt: ledger.completedAt,
    results: results.map(createGi088ArkPlatformPublicSummary),
    decision: createGi088ArkPlatformDecision(results)
  };
  await writePrivateJson(input.privateSummaryPath, publicResult);
  await writeJson(PUBLIC_RESULT_PATH, publicResult, 0o644);
  process.stdout.write(
    `${JSON.stringify({
      probeVersion: input.plan.probeVersion,
      probeFingerprint: input.plan.probeFingerprint,
      status: "completed",
      modelGenerationCalls: results.length,
      disposition: publicResult.decision.disposition,
      publicResultPath: PUBLIC_RESULT_PATH
    })}\n`
  );
}

async function main() {
  assertLocalRuntimePath(SOURCE_PATH);
  assertLocalRuntimePath(OUTPUT_ROOT);
  const snapshotBytes = await readFile(SOURCE_PATH);
  const snapshot = JSON.parse(snapshotBytes.toString("utf8")) as unknown;
  const plan = createGi088ArkPlatformProbePlan({ snapshot, snapshotBytes });
  if (!process.argv.includes(EXECUTE_FLAG)) {
    process.stdout.write(
      `${JSON.stringify(createGi088ArkPlatformPublicPlan(plan), null, 2)}\n`
    );
    return;
  }
  const authorizationId = assertGi088ArkPlatformAuthorization(
    plan.probeFingerprint
  );
  const runDirectory = path.join(OUTPUT_ROOT, plan.probeFingerprint);
  const ledgerPath = path.join(runDirectory, "private-ledger.json");
  const privateSummaryPath = path.join(runDirectory, "sanitized-summary.json");
  const lockPath = path.join(runDirectory, "run.lock");
  const lock = await acquireLock(lockPath);
  let retainLock = false;
  try {
    await execute({
      plan,
      authorizationId,
      ledgerPath,
      privateSummaryPath
    });
  } catch (error) {
    const stored = await readJsonIfPresent(ledgerPath).catch(() => null);
    retainLock =
      isRecord(stored) &&
      Array.isArray(stored.calls) &&
      stored.calls.some(
        (call) => isRecord(call) && call.status === "reserved"
      );
    throw error;
  } finally {
    await releaseLock(lock, lockPath, retainLock);
  }
}

if (process.env.VITEST !== "true") {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "GI088_ARK_PLATFORM_FAILED"}\n`
    );
    process.exitCode = 1;
  });
}
