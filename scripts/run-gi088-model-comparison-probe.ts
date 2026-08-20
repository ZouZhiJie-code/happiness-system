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
  GI088_MODEL_COMPARISON_LEDGER_SCHEMA_VERSION,
  GI088_MODEL_COMPARISON_PROBE_CALL_BUDGET,
  GI088_MODEL_COMPARISON_PROBE_VERSION,
  GI088_MODEL_COMPARISON_RUNTIME,
  createGi088ModelComparisonDecision,
  createGi088ModelComparisonProbePlan,
  createGi088ModelComparisonPublicRequest,
  createGi088ModelComparisonPublicSummary,
  createGi088ModelComparisonRequestHash,
  runGi088ModelComparisonProbeCall,
  type Gi088ModelComparisonProbePlan,
  type Gi088ModelComparisonProbeResult,
  type Gi088ModelComparisonVariant
} from "../src/server/services/evaluation/gi088/model-comparison-probe";

const SOURCE_PATH = path.resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-readonly-db-snapshot.json"
);
const OUTPUT_ROOT = path.resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-10-gi088-human-eval-v7r1-visible-continuation/model-comparison-probe"
);
const EXECUTE_FLAG = "--execute";
const REQUIRED_SCOPE = "flash_pro_model_comparison_probe";
const REQUIRED_CONFIRMATION = "I_UNDERSTAND_6_CALLS";

export type Gi088ModelComparisonLedgerCall = {
  key: string;
  order: number;
  caseId: string;
  variant: Gi088ModelComparisonVariant;
  status: "reserved" | "completed";
  reservedAt: string;
  completedAt: string | null;
  result: Gi088ModelComparisonProbeResult | null;
};

export type Gi088ModelComparisonProbeLedger = {
  schemaVersion: typeof GI088_MODEL_COMPARISON_LEDGER_SCHEMA_VERSION;
  probeVersion: typeof GI088_MODEL_COMPARISON_PROBE_VERSION;
  probeFingerprint: string;
  authorizationId: string;
  authorizedCallBudget: number;
  sourcePath: string;
  sourceSnapshotSha256: string;
  createdAt: string;
  completedAt: string | null;
  calls: Gi088ModelComparisonLedgerCall[];
};

function assertLocalRuntimePath(candidate: string) {
  const relative = path.relative(process.cwd(), candidate);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !relative.split(path.sep).includes("local-runtime")
  ) {
    throw new Error("GI088_MODEL_COMPARISON_LOCAL_RUNTIME_PATH_REQUIRED");
  }
}

export function isGi088ModelComparisonExecutionRequested(
  argv: readonly string[] = process.argv
) {
  return argv.includes(EXECUTE_FLAG);
}

export function isGi088ModelComparisonDirectRun(
  env: Readonly<Partial<NodeJS.ProcessEnv>> = process.env
) {
  return env.VITEST !== "true";
}

export function assertGi088ModelComparisonAuthorization(
  probeFingerprint: string,
  env: Readonly<Partial<NodeJS.ProcessEnv>> = process.env
) {
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
    throw new Error("GI088_MODEL_COMPARISON_PRODUCTION_FORBIDDEN");
  }
  if (env.GI088_MODEL_CALL_SCOPE !== REQUIRED_SCOPE) {
    throw new Error("GI088_MODEL_COMPARISON_SCOPE_NOT_AUTHORIZED");
  }
  if (
    env.GI088_AUTHORIZED_MODEL_COMPARISON_PROBE_FINGERPRINT !==
    probeFingerprint
  ) {
    throw new Error("GI088_MODEL_COMPARISON_FINGERPRINT_NOT_AUTHORIZED");
  }
  if (env.GI088_MODEL_COMPARISON_CONFIRMATION !== REQUIRED_CONFIRMATION) {
    throw new Error("GI088_MODEL_COMPARISON_CONFIRMATION_REQUIRED");
  }
  if (
    env.GI088_MODEL_COMPARISON_AUTHORIZED_BUDGET !==
    String(GI088_MODEL_COMPARISON_PROBE_CALL_BUDGET)
  ) {
    throw new Error("GI088_MODEL_COMPARISON_BUDGET_NOT_AUTHORIZED");
  }
  const authorizationId =
    env.GI088_MODEL_COMPARISON_AUTHORIZATION_ID?.trim() ?? "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      authorizationId
    )
  ) {
    throw new Error("GI088_MODEL_COMPARISON_AUTHORIZATION_ID_REQUIRED");
  }
  return authorizationId;
}

async function writePrivateJson(filePath: string, value: unknown) {
  assertLocalRuntimePath(filePath);
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(filePath), 0o700);
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  await rename(temporaryPath, filePath);
  await chmod(filePath, 0o600);
}

async function readJsonIfPresent(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function createSchedule(plan: Gi088ModelComparisonProbePlan) {
  return plan.schedule.map((item) => {
    const probeCase = plan.cases.find(
      (candidate) => candidate.caseId === item.caseId
    );
    if (!probeCase) {
      throw new Error(`GI088_MODEL_COMPARISON_CASE_NOT_FOUND:${item.caseId}`);
    }
    return { ...item, probeCase };
  });
}

export function createGi088ModelComparisonPublicPlan(
  plan: Gi088ModelComparisonProbePlan
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
    cases: plan.cases.map(createGi088EmptyContentProbePublicCase),
    schedule: createSchedule(plan).map((item) => ({
      order: item.order,
      caseId: item.caseId,
      variant: item.variant,
      request: createGi088ModelComparisonPublicRequest({
        probeCase: item.probeCase,
        variant: item.variant
      })
    })),
    ledgerSchemaVersion: plan.ledgerSchemaVersion,
    publicSummaryContract: plan.publicSummaryContract,
    modelGenerationCalls: 0,
    executionAuthorized: false
  };
}

export function parseGi088ModelComparisonLedger(input: {
  value: unknown;
  plan: Gi088ModelComparisonProbePlan;
  authorizationId: string;
  sourcePath: string;
}): Gi088ModelComparisonProbeLedger {
  const { value, plan, authorizationId, sourcePath } = input;
  if (!isRecord(value) || !Array.isArray(value.calls)) {
    throw new Error("GI088_MODEL_COMPARISON_LEDGER_INVALID");
  }
  if (
    value.schemaVersion !== GI088_MODEL_COMPARISON_LEDGER_SCHEMA_VERSION ||
    value.probeVersion !== plan.probeVersion ||
    value.probeFingerprint !== plan.probeFingerprint ||
    value.authorizationId !== authorizationId ||
    value.authorizedCallBudget !== plan.authorizedCallBudget ||
    value.sourcePath !== sourcePath ||
    value.sourceSnapshotSha256 !== plan.sourceSnapshotSha256 ||
    !isIsoTimestamp(value.createdAt) ||
    (value.completedAt !== null && !isIsoTimestamp(value.completedAt))
  ) {
    throw new Error("GI088_MODEL_COMPARISON_LEDGER_LINEAGE_MISMATCH");
  }
  const schedule = createSchedule(plan);
  if (
    schedule.length !== GI088_MODEL_COMPARISON_PROBE_CALL_BUDGET ||
    value.calls.length > plan.authorizedCallBudget
  ) {
    throw new Error("GI088_MODEL_COMPARISON_LEDGER_BUDGET_MISMATCH");
  }
  for (const [index, unknownCall] of value.calls.entries()) {
    const expected = schedule[index];
    if (!expected || !isRecord(unknownCall)) {
      throw new Error("GI088_MODEL_COMPARISON_LEDGER_SCHEDULE_MISMATCH");
    }
    const expectedKey = `${expected.order}:${expected.caseId}:${expected.variant}`;
    if (
      unknownCall.key !== expectedKey ||
      unknownCall.order !== expected.order ||
      unknownCall.caseId !== expected.caseId ||
      unknownCall.variant !== expected.variant ||
      !isIsoTimestamp(unknownCall.reservedAt) ||
      (unknownCall.status !== "reserved" && unknownCall.status !== "completed")
    ) {
      throw new Error("GI088_MODEL_COMPARISON_LEDGER_SCHEDULE_MISMATCH");
    }
    if (unknownCall.status === "reserved") {
      if (unknownCall.completedAt !== null || unknownCall.result !== null) {
        throw new Error("GI088_MODEL_COMPARISON_LEDGER_RESERVATION_INVALID");
      }
      continue;
    }
    if (!isIsoTimestamp(unknownCall.completedAt) || !isRecord(unknownCall.result)) {
      throw new Error("GI088_MODEL_COMPARISON_LEDGER_COMPLETION_INVALID");
    }
    const result = unknownCall.result;
    if (
      result.order !== expected.order ||
      result.caseId !== expected.caseId ||
      result.variant !== expected.variant ||
      result.sourceCallId !== expected.probeCase.sourceCallId ||
      result.sourceRequestHash !== expected.probeCase.sourceRequestHash ||
      result.probeRequestHash !==
        createGi088ModelComparisonRequestHash({
          probeCase: expected.probeCase,
          variant: expected.variant
        }) ||
      result.requestHashVerified !== true
    ) {
      throw new Error("GI088_MODEL_COMPARISON_LEDGER_RESULT_LINEAGE_MISMATCH");
    }
  }
  return value as Gi088ModelComparisonProbeLedger;
}

export function assertGi088ModelComparisonLedgerCanResume(
  ledger: Gi088ModelComparisonProbeLedger
) {
  if (ledger.calls.some((call) => call.status === "reserved")) {
    throw new Error("GI088_MODEL_COMPARISON_CALL_OUTCOME_AMBIGUOUS");
  }
}

async function acquireRunLock(filePath: string) {
  assertLocalRuntimePath(filePath);
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  try {
    const handle = await open(filePath, "wx", 0o600);
    await handle.writeFile(`${process.pid}\n`, "utf8");
    return handle;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("GI088_MODEL_COMPARISON_RUN_LOCKED");
    }
    throw error;
  }
}

async function releaseRunLock(
  handle: FileHandle,
  filePath: string,
  retainFile: boolean
) {
  await handle.close();
  if (!retainFile) await unlink(filePath).catch(() => undefined);
}

async function executeAuthorizedProbe(input: {
  plan: Gi088ModelComparisonProbePlan;
  authorizationId: string;
  ledgerPath: string;
  summaryPath: string;
}) {
  const { plan, authorizationId, ledgerPath, summaryPath } = input;
  const stored = await readJsonIfPresent(ledgerPath);
  let ledger: Gi088ModelComparisonProbeLedger;
  if (stored) {
    ledger = parseGi088ModelComparisonLedger({
      value: stored,
      plan,
      authorizationId,
      sourcePath: SOURCE_PATH
    });
    assertGi088ModelComparisonLedgerCanResume(ledger);
  } else {
    ledger = {
      schemaVersion: GI088_MODEL_COMPARISON_LEDGER_SCHEMA_VERSION,
      probeVersion: GI088_MODEL_COMPARISON_PROBE_VERSION,
      probeFingerprint: plan.probeFingerprint,
      authorizationId,
      authorizedCallBudget: GI088_MODEL_COMPARISON_PROBE_CALL_BUDGET,
      sourcePath: SOURCE_PATH,
      sourceSnapshotSha256: plan.sourceSnapshotSha256,
      createdAt: new Date().toISOString(),
      completedAt: null,
      calls: []
    };
    await writePrivateJson(ledgerPath, ledger);
  }
  const schedule = createSchedule(plan);
  const completedKeys = new Set(
    ledger.calls
      .filter((call) => call.status === "completed")
      .map((call) => call.key)
  );
  const pending = schedule.filter(
    (item) =>
      !completedKeys.has(`${item.order}:${item.caseId}:${item.variant}`)
  );
  let providers: Record<Gi088ModelComparisonVariant, OpenAIProvider> | null = null;
  if (pending.length) {
    loadEnvConfig(process.cwd());
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) throw new Error("GI088_MODEL_COMPARISON_API_KEY_MISSING");
    providers = {
      flash: new OpenAIProvider({
        apiKey,
        model: GI088_MODEL_COMPARISON_RUNTIME.models.flash,
        baseUrl: GI088_MODEL_COMPARISON_RUNTIME.baseUrl
      }),
      pro: new OpenAIProvider({
        apiKey,
        model: GI088_MODEL_COMPARISON_RUNTIME.models.pro,
        baseUrl: GI088_MODEL_COMPARISON_RUNTIME.baseUrl
      })
    };
  }
  for (const item of pending) {
    if (ledger.calls.length >= ledger.authorizedCallBudget) {
      throw new Error("GI088_MODEL_COMPARISON_CALL_BUDGET_EXHAUSTED");
    }
    const key = `${item.order}:${item.caseId}:${item.variant}`;
    const call: Gi088ModelComparisonLedgerCall = {
      key,
      order: item.order,
      caseId: item.caseId,
      variant: item.variant,
      status: "reserved",
      reservedAt: new Date().toISOString(),
      completedAt: null,
      result: null
    };
    ledger.calls.push(call);
    await writePrivateJson(ledgerPath, ledger);
    const result = await runGi088ModelComparisonProbeCall({
      provider: providers![item.variant],
      order: item.order,
      probeCase: item.probeCase,
      variant: item.variant
    });
    call.status = "completed";
    call.completedAt = new Date().toISOString();
    call.result = result;
    await writePrivateJson(ledgerPath, ledger);
    process.stdout.write(`${JSON.stringify({
      order: result.order,
      caseId: result.caseId,
      variant: result.variant,
      status: result.status,
      errorCode: result.errorCode,
      callsCompleted: ledger.calls.length,
      callBudget: ledger.authorizedCallBudget
    })}\n`);
  }
  ledger.completedAt = new Date().toISOString();
  await writePrivateJson(ledgerPath, ledger);
  const results = ledger.calls
    .map((call) => call.result)
    .filter((result): result is Gi088ModelComparisonProbeResult => result !== null);
  const decision = createGi088ModelComparisonDecision(results);
  await writePrivateJson(summaryPath, {
    ...createGi088ModelComparisonPublicPlan(plan),
    authorizationId,
    executionAuthorized: true,
    modelGenerationCalls: ledger.calls.length,
    completedAt: ledger.completedAt,
    results: results.map(createGi088ModelComparisonPublicSummary),
    decision
  });
  process.stdout.write(`${JSON.stringify({
    probeVersion: plan.probeVersion,
    probeFingerprint: plan.probeFingerprint,
    status: "completed",
    modelGenerationCalls: ledger.calls.length,
    disposition: decision.disposition,
    summaryPath
  })}\n`);
}

async function main() {
  assertLocalRuntimePath(SOURCE_PATH);
  assertLocalRuntimePath(OUTPUT_ROOT);
  const snapshotBytes = await readFile(SOURCE_PATH);
  const snapshot = JSON.parse(snapshotBytes.toString("utf8")) as unknown;
  const plan = createGi088ModelComparisonProbePlan({ snapshot, snapshotBytes });
  if (!isGi088ModelComparisonExecutionRequested()) {
    process.stdout.write(
      `${JSON.stringify(createGi088ModelComparisonPublicPlan(plan), null, 2)}\n`
    );
    return;
  }
  const authorizationId = assertGi088ModelComparisonAuthorization(
    plan.probeFingerprint
  );
  const runDirectory = path.join(OUTPUT_ROOT, plan.probeFingerprint);
  const ledgerPath = path.join(runDirectory, "private-ledger.json");
  const summaryPath = path.join(runDirectory, "sanitized-summary.json");
  const lockPath = path.join(runDirectory, "run.lock");
  const lock = await acquireRunLock(lockPath);
  let retainLock = false;
  try {
    await executeAuthorizedProbe({
      plan,
      authorizationId,
      ledgerPath,
      summaryPath
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
    await releaseRunLock(lock, lockPath, retainLock);
  }
}

if (isGi088ModelComparisonDirectRun()) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "GI088_MODEL_COMPARISON_FAILED"}\n`
    );
    process.exitCode = 1;
  });
}
