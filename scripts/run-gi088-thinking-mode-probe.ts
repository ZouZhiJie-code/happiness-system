import { randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  open,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
  type FileHandle
} from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  GI088_THINKING_MODE_PROBE_CALL_BUDGET,
  GI088_THINKING_MODE_PROBE_LEDGER_SCHEMA_VERSION,
  GI088_THINKING_MODE_PROBE_RUNTIME,
  GI088_THINKING_MODE_PROBE_VERSION,
  createGi088ThinkingModeProbePlan,
  createGi088ThinkingModeProbePublicRequest,
  createGi088ThinkingModeProbePublicSummary,
  createGi088ThinkingModeProbeRequestHash,
  runGi088ThinkingModeProbeCall,
  type Gi088ThinkingModeProbePlan,
  type Gi088ThinkingModeProbeResult,
  type Gi088ThinkingModeProbeVariant
} from "../src/server/services/evaluation/gi088/thinking-mode-probe";
import {
  resolveEventCenteredCandidateProviderConfig,
  type EventCenteredCandidateProviderSummary
} from "../src/server/services/ai/event-centered-provider";
import { createRuntimeAIProvider } from "../src/server/services/ai/runtime-provider-factory";
import { createGi088EmptyContentProbePublicCase } from "../src/server/services/evaluation/gi088/empty-content-probe";

const SOURCE_PATH = path.resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-readonly-db-snapshot.json"
);
const OUTPUT_ROOT = path.resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-09-gi088-human-eval-v1/empty-content-thinking-mode-probe"
);
const EXECUTE_FLAG = "--execute";
const REQUIRED_SCOPE = "empty_content_thinking_mode_probe";
const REQUIRED_CONFIRMATION = "I_UNDERSTAND_4_CALLS";

export type Gi088ThinkingModeLedgerCall = {
  key: string;
  order: number;
  caseId: string;
  variant: Gi088ThinkingModeProbeVariant;
  status: "reserved" | "completed";
  reservedAt: string;
  completedAt: string | null;
  result: Gi088ThinkingModeProbeResult | null;
};

export type Gi088ThinkingModeProbeLedger = {
  schemaVersion: typeof GI088_THINKING_MODE_PROBE_LEDGER_SCHEMA_VERSION;
  probeVersion: typeof GI088_THINKING_MODE_PROBE_VERSION;
  probeFingerprint: string;
  authorizationId: string;
  authorizedCallBudget: number;
  sourcePath: string;
  sourceSnapshotSha256: string;
  createdAt: string;
  completedAt: string | null;
  calls: Gi088ThinkingModeLedgerCall[];
};

export type Gi088ThinkingModeProbeLock = {
  path: string;
  handle: FileHandle;
};

function assertLocalRuntimePath(candidate: string) {
  const relative = path.relative(process.cwd(), candidate);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !relative.split(path.sep).includes("local-runtime")
  ) {
    throw new Error("GI088_THINKING_PROBE_LOCAL_RUNTIME_PATH_REQUIRED");
  }
}

function isFileSystemError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

export function isGi088ThinkingModeProbeExecutionRequested(
  argv: readonly string[] = process.argv
) {
  return argv.includes(EXECUTE_FLAG);
}

export function isGi088ThinkingModeProbeDirectRun(
  env: Readonly<Partial<NodeJS.ProcessEnv>> = process.env
) {
  return env.VITEST !== "true";
}

export function assertGi088ThinkingModeProbeExecutionAuthorization(
  probeFingerprint: string,
  env: Readonly<Partial<NodeJS.ProcessEnv>> = process.env
) {
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
    throw new Error("GI088_THINKING_PROBE_PRODUCTION_FORBIDDEN");
  }
  if (env.GI088_MODEL_CALL_SCOPE !== REQUIRED_SCOPE) {
    throw new Error("GI088_THINKING_PROBE_SCOPE_NOT_AUTHORIZED");
  }
  if (
    env.GI088_AUTHORIZED_THINKING_MODE_PROBE_FINGERPRINT !== probeFingerprint
  ) {
    throw new Error("GI088_THINKING_PROBE_FINGERPRINT_NOT_AUTHORIZED");
  }
  if (
    env.GI088_THINKING_MODE_PROBE_CONFIRMATION !== REQUIRED_CONFIRMATION
  ) {
    throw new Error("GI088_THINKING_PROBE_CONFIRMATION_REQUIRED");
  }
  if (
    env.GI088_THINKING_MODE_PROBE_AUTHORIZED_BUDGET !==
    String(GI088_THINKING_MODE_PROBE_CALL_BUDGET)
  ) {
    throw new Error("GI088_THINKING_PROBE_BUDGET_NOT_AUTHORIZED");
  }
  const authorizationId =
    env.GI088_THINKING_MODE_PROBE_AUTHORIZATION_ID?.trim() ?? "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      authorizationId
    )
  ) {
    throw new Error("GI088_THINKING_PROBE_AUTHORIZATION_ID_REQUIRED");
  }
  return authorizationId;
}

export function assertGi088ThinkingModeProbeRuntime(
  summary: EventCenteredCandidateProviderSummary
) {
  if (
    summary.provider !== GI088_THINKING_MODE_PROBE_RUNTIME.provider ||
    summary.model !== GI088_THINKING_MODE_PROBE_RUNTIME.model ||
    summary.baseUrlHost !== GI088_THINKING_MODE_PROBE_RUNTIME.baseUrlHost
  ) {
    throw new Error("GI088_THINKING_PROBE_RUNTIME_MISMATCH");
  }
}

async function ensurePrivateDirectory(directory: string) {
  assertLocalRuntimePath(directory);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
}

async function writePrivateJson(filePath: string, value: unknown) {
  assertLocalRuntimePath(filePath);
  await ensurePrivateDirectory(path.dirname(filePath));
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  await rename(temporaryPath, filePath);
  await chmod(filePath, 0o600);
}

export async function acquireGi088ThinkingModeProbeLock(
  lockPath: string
): Promise<Gi088ThinkingModeProbeLock> {
  assertLocalRuntimePath(lockPath);
  await ensurePrivateDirectory(path.dirname(lockPath));
  let handle: FileHandle;
  try {
    handle = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if (isFileSystemError(error) && error.code === "EEXIST") {
      throw new Error("GI088_THINKING_PROBE_RUN_LOCKED");
    }
    throw error;
  }
  try {
    await handle.writeFile(
      `${JSON.stringify({
        schemaVersion: "1.0",
        probeVersion: GI088_THINKING_MODE_PROBE_VERSION,
        acquiredAt: new Date().toISOString(),
        pid: process.pid
      })}\n`,
      "utf8"
    );
    await handle.sync();
    await chmod(lockPath, 0o600);
    return { path: lockPath, handle };
  } catch (error) {
    await handle.close().catch(() => undefined);
    await unlink(lockPath).catch(() => undefined);
    throw error;
  }
}

export async function releaseGi088ThinkingModeProbeLock(
  lock: Gi088ThinkingModeProbeLock,
  options: { retainFile: boolean }
) {
  await lock.handle.close().catch(() => undefined);
  if (!options.retainFile) {
    await unlink(lock.path).catch((error) => {
      if (!isFileSystemError(error) || error.code !== "ENOENT") throw error;
    });
  }
}

async function readLedger(filePath: string): Promise<unknown | null> {
  try {
    await stat(filePath);
  } catch (error) {
    if (isFileSystemError(error) && error.code === "ENOENT") return null;
    throw error;
  }
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function createSchedule(plan: Gi088ThinkingModeProbePlan) {
  return plan.schedule.map((scheduled) => {
    const probeCase = plan.cases.find(
      (candidate) => candidate.caseId === scheduled.caseId
    );
    if (!probeCase) {
      throw new Error(
        `GI088_THINKING_PROBE_SCHEDULE_CASE_NOT_FOUND:${scheduled.caseId}`
      );
    }
    return { ...scheduled, probeCase };
  });
}

export function createGi088ThinkingModeProbePublicPlan(
  plan: Gi088ThinkingModeProbePlan
) {
  const schedule = createSchedule(plan);
  return {
    probeVersion: plan.probeVersion,
    probeFingerprint: plan.probeFingerprint,
    sourceProbeVersion: plan.sourceProbeVersion,
    sourceProbeFingerprint: plan.sourceProbeFingerprint,
    sourceSnapshotSha256: plan.sourceSnapshotSha256,
    sourceEvaluationVersion: plan.sourceEvaluationVersion,
    sourceCandidateFingerprint: plan.sourceCandidateFingerprint,
    sourceExecutionFingerprint: plan.sourceExecutionFingerprint,
    effectiveCandidateFingerprint: plan.effectiveCandidateFingerprint,
    runtime: plan.runtime,
    authorizedCallBudget: plan.authorizedCallBudget,
    automaticRetries: plan.automaticRetries,
    fallbackCalls: plan.fallbackCalls,
    adapterContractVersion: plan.adapterContractVersion,
    decisionRuleVersion: plan.decisionRuleVersion,
    ledgerSchemaVersion: plan.ledgerSchemaVersion,
    publicSummaryContract: plan.publicSummaryContract,
    variants: plan.variants,
    cases: plan.cases.map(createGi088EmptyContentProbePublicCase),
    schedule: schedule.map((item) => ({
      order: item.order,
      ...createGi088ThinkingModeProbePublicRequest(
        item.probeCase,
        item.variant
      )
    })),
    decisionRule: plan.decisionRule,
    modelGenerationCalls: 0,
    executionAuthorized: false
  };
}

export function parseGi088ThinkingModeProbeLedger(input: {
  value: unknown;
  plan: Gi088ThinkingModeProbePlan;
  authorizationId: string;
  sourcePath: string;
}): Gi088ThinkingModeProbeLedger {
  const { value, plan, authorizationId, sourcePath } = input;
  if (!isRecord(value) || !Array.isArray(value.calls)) {
    throw new Error("GI088_THINKING_PROBE_LEDGER_INVALID");
  }
  if (
    value.schemaVersion !== GI088_THINKING_MODE_PROBE_LEDGER_SCHEMA_VERSION ||
    value.probeVersion !== plan.probeVersion ||
    value.probeFingerprint !== plan.probeFingerprint ||
    value.authorizationId !== authorizationId ||
    value.authorizedCallBudget !== plan.authorizedCallBudget ||
    value.sourcePath !== sourcePath ||
    value.sourceSnapshotSha256 !== plan.sourceSnapshotSha256 ||
    !isIsoTimestamp(value.createdAt) ||
    (value.completedAt !== null && !isIsoTimestamp(value.completedAt))
  ) {
    throw new Error("GI088_THINKING_PROBE_LEDGER_LINEAGE_MISMATCH");
  }
  const schedule = createSchedule(plan);
  if (
    schedule.length !== GI088_THINKING_MODE_PROBE_CALL_BUDGET ||
    value.calls.length > plan.authorizedCallBudget
  ) {
    throw new Error("GI088_THINKING_PROBE_LEDGER_BUDGET_MISMATCH");
  }
  for (const [index, unknownCall] of value.calls.entries()) {
    const scheduled = schedule[index];
    if (!scheduled || !isRecord(unknownCall)) {
      throw new Error("GI088_THINKING_PROBE_LEDGER_SCHEDULE_MISMATCH");
    }
    const expectedKey = `${scheduled.order}:${scheduled.caseId}:${scheduled.variant}`;
    if (
      unknownCall.key !== expectedKey ||
      unknownCall.order !== scheduled.order ||
      unknownCall.caseId !== scheduled.caseId ||
      unknownCall.variant !== scheduled.variant ||
      !isIsoTimestamp(unknownCall.reservedAt) ||
      (unknownCall.status !== "reserved" && unknownCall.status !== "completed")
    ) {
      throw new Error("GI088_THINKING_PROBE_LEDGER_SCHEDULE_MISMATCH");
    }
    if (unknownCall.status === "reserved") {
      if (unknownCall.completedAt !== null || unknownCall.result !== null) {
        throw new Error("GI088_THINKING_PROBE_LEDGER_RESERVATION_INVALID");
      }
      continue;
    }
    if (!isIsoTimestamp(unknownCall.completedAt) || !isRecord(unknownCall.result)) {
      throw new Error("GI088_THINKING_PROBE_LEDGER_COMPLETION_INVALID");
    }
    const result = unknownCall.result;
    if (
      result.caseId !== scheduled.caseId ||
      result.variant !== scheduled.variant ||
      result.sourceCallId !== scheduled.probeCase.sourceCallId ||
      result.sourceRequestHash !== scheduled.probeCase.sourceRequestHash ||
      result.probeRequestHash !==
        createGi088ThinkingModeProbeRequestHash(
          scheduled.probeCase,
          scheduled.variant
        ) ||
      result.requestHashVerified !== true
    ) {
      throw new Error("GI088_THINKING_PROBE_LEDGER_RESULT_LINEAGE_MISMATCH");
    }
  }
  if (
    value.completedAt !== null &&
    (value.calls.length !== plan.authorizedCallBudget ||
      value.calls.some(
        (call) => !isRecord(call) || call.status !== "completed"
      ))
  ) {
    throw new Error("GI088_THINKING_PROBE_LEDGER_COMPLETION_INVALID");
  }
  return value as Gi088ThinkingModeProbeLedger;
}

export function assertGi088ThinkingModeProbeLedgerCanResume(
  ledger: Gi088ThinkingModeProbeLedger
) {
  if (ledger.calls.some((call) => call.status === "reserved")) {
    throw new Error("GI088_THINKING_PROBE_CALL_OUTCOME_AMBIGUOUS");
  }
}

async function ledgerFileHasReservedCall(ledgerPath: string) {
  try {
    const value = await readLedger(ledgerPath);
    return (
      isRecord(value) &&
      Array.isArray(value.calls) &&
      value.calls.some(
        (call) => isRecord(call) && call.status === "reserved"
      )
    );
  } catch {
    return true;
  }
}

async function executeAuthorizedProbe(input: {
  plan: Gi088ThinkingModeProbePlan;
  authorizationId: string;
  ledgerPath: string;
  summaryPath: string;
}) {
  const { plan, authorizationId, ledgerPath, summaryPath } = input;
  const storedLedger = await readLedger(ledgerPath);
  let ledger: Gi088ThinkingModeProbeLedger;
  if (storedLedger) {
    ledger = parseGi088ThinkingModeProbeLedger({
      value: storedLedger,
      plan,
      authorizationId,
      sourcePath: SOURCE_PATH
    });
    assertGi088ThinkingModeProbeLedgerCanResume(ledger);
  } else {
    ledger = {
      schemaVersion: GI088_THINKING_MODE_PROBE_LEDGER_SCHEMA_VERSION,
      probeVersion: GI088_THINKING_MODE_PROBE_VERSION,
      probeFingerprint: plan.probeFingerprint,
      authorizationId,
      authorizedCallBudget: GI088_THINKING_MODE_PROBE_CALL_BUDGET,
      sourcePath: SOURCE_PATH,
      sourceSnapshotSha256: plan.sourceSnapshotSha256,
      createdAt: new Date().toISOString(),
      completedAt: null,
      calls: []
    };
    await writePrivateJson(ledgerPath, ledger);
  }
  const completedKeys = new Set(
    ledger.calls
      .filter((call) => call.status === "completed")
      .map((call) => call.key)
  );
  const schedule = createSchedule(plan);
  if (schedule.length !== GI088_THINKING_MODE_PROBE_CALL_BUDGET) {
    throw new Error("GI088_THINKING_PROBE_SCHEDULE_BUDGET_MISMATCH");
  }
  const pendingSchedule = schedule.filter(
    (item) =>
      !completedKeys.has(`${item.order}:${item.caseId}:${item.variant}`)
  );
  const provider = pendingSchedule.length
    ? (() => {
        loadEnvConfig(process.cwd());
        const resolved = resolveEventCenteredCandidateProviderConfig(process.env);
        assertGi088ThinkingModeProbeRuntime(resolved.summary);
        return createRuntimeAIProvider({
          capability: "chat",
          apiKey: resolved.apiKey,
          config: resolved.runtimeConfig,
          timeoutMs: 30_000
        });
      })()
    : null;

  for (const item of pendingSchedule) {
    const key = `${item.order}:${item.caseId}:${item.variant}`;
    if (ledger.calls.length >= ledger.authorizedCallBudget) {
      throw new Error("GI088_THINKING_PROBE_CALL_BUDGET_EXHAUSTED");
    }
    const call: Gi088ThinkingModeLedgerCall = {
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
    const result = await runGi088ThinkingModeProbeCall({
      provider: provider!,
      probeCase: item.probeCase,
      variant: item.variant
    });
    call.status = "completed";
    call.completedAt = new Date().toISOString();
    call.result = result;
    await writePrivateJson(ledgerPath, ledger);
    console.log(
      JSON.stringify({
        order: item.order,
        caseId: result.caseId,
        variant: result.variant,
        status: result.status,
        errorCode: result.errorCode,
        callsCompleted: ledger.calls.length,
        callBudget: ledger.authorizedCallBudget
      })
    );
  }
  ledger.completedAt = new Date().toISOString();
  await writePrivateJson(ledgerPath, ledger);
  const publicResults = ledger.calls
    .map((call) => call.result)
    .filter((result): result is Gi088ThinkingModeProbeResult => result !== null)
    .map(createGi088ThinkingModeProbePublicSummary);
  await writePrivateJson(summaryPath, {
    ...createGi088ThinkingModeProbePublicPlan(plan),
    authorizationId,
    executionAuthorized: true,
    modelGenerationCalls: ledger.calls.length,
    completedAt: ledger.completedAt,
    results: publicResults
  });
  console.log(
    JSON.stringify({
      probeVersion: plan.probeVersion,
      probeFingerprint: plan.probeFingerprint,
      status: "completed",
      modelGenerationCalls: ledger.calls.length,
      summaryPath
    })
  );
}

async function main() {
  assertLocalRuntimePath(SOURCE_PATH);
  assertLocalRuntimePath(OUTPUT_ROOT);
  const snapshotBytes = await readFile(SOURCE_PATH);
  const snapshot = JSON.parse(snapshotBytes.toString("utf8")) as unknown;
  const plan = createGi088ThinkingModeProbePlan({ snapshot, snapshotBytes });
  if (!isGi088ThinkingModeProbeExecutionRequested()) {
    console.log(
      JSON.stringify(createGi088ThinkingModeProbePublicPlan(plan), null, 2)
    );
    return;
  }
  const authorizationId = assertGi088ThinkingModeProbeExecutionAuthorization(
    plan.probeFingerprint
  );
  const runDirectory = path.join(OUTPUT_ROOT, authorizationId);
  const ledgerPath = path.join(runDirectory, "private-ledger.json");
  const summaryPath = path.join(runDirectory, "sanitized-summary.json");
  const lock = await acquireGi088ThinkingModeProbeLock(
    path.join(runDirectory, "run.lock")
  );
  let retainLock = false;
  try {
    await executeAuthorizedProbe({
      plan,
      authorizationId,
      ledgerPath,
      summaryPath
    });
  } catch (error) {
    retainLock = await ledgerFileHasReservedCall(ledgerPath);
    throw error;
  } finally {
    await releaseGi088ThinkingModeProbeLock(lock, {
      retainFile: retainLock
    });
  }
}

if (isGi088ThinkingModeProbeDirectRun()) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "GI088_THINKING_PROBE_UNKNOWN_ERROR"
    );
    process.exitCode = 1;
  });
}
