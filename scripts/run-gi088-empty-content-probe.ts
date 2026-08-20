import { randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import {
  GI088_EMPTY_CONTENT_PROBE_CALL_BUDGET,
  GI088_EMPTY_CONTENT_PROBE_RUNTIME,
  GI088_EMPTY_CONTENT_PROBE_VERSION,
  createGi088EmptyContentProbePlan,
  createGi088EmptyContentProbePublicCase,
  createGi088EmptyContentProbePublicSummary,
  createGi088EmptyContentProbeRequestHash,
  runGi088EmptyContentProbeCall,
  type Gi088EmptyContentProbePlan,
  type Gi088EmptyContentProbeResult,
  type Gi088EmptyContentProbeVariant
} from "../src/server/services/evaluation/gi088/empty-content-probe";
import {
  resolveEventCenteredCandidateProviderConfig,
  type EventCenteredCandidateProviderSummary
} from "../src/server/services/ai/event-centered-provider";
import { createRuntimeAIProvider } from "../src/server/services/ai/runtime-provider-factory";

const SOURCE_PATH = path.resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-readonly-db-snapshot.json"
);
const OUTPUT_ROOT = path.resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-09-gi088-human-eval-v1/empty-content-response-format-probe"
);
const EXECUTE_FLAG = "--execute";
const REQUIRED_SCOPE = "empty_content_probe";
const REQUIRED_CONFIRMATION = "I_UNDERSTAND_6_CALLS";

export type LedgerCall = {
  key: string;
  caseId: string;
  variant: Gi088EmptyContentProbeVariant;
  status: "reserved" | "completed";
  reservedAt: string;
  completedAt: string | null;
  result: Gi088EmptyContentProbeResult | null;
};

export type ProbeLedger = {
  schemaVersion: "1.0";
  probeVersion: typeof GI088_EMPTY_CONTENT_PROBE_VERSION;
  probeFingerprint: string;
  authorizationId: string;
  authorizedCallBudget: number;
  sourcePath: string;
  sourceSnapshotSha256: string;
  createdAt: string;
  completedAt: string | null;
  calls: LedgerCall[];
};

function assertLocalRuntimePath(candidate: string) {
  const relative = path.relative(process.cwd(), candidate);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !relative.split(path.sep).includes("local-runtime")
  ) {
    throw new Error("GI088_EMPTY_PROBE_LOCAL_RUNTIME_PATH_REQUIRED");
  }
}

export function isGi088EmptyContentProbeExecutionRequested(
  argv: readonly string[] = process.argv
) {
  return argv.includes(EXECUTE_FLAG);
}

export function isGi088EmptyContentProbeDirectRun(
  env: Readonly<Partial<NodeJS.ProcessEnv>> = process.env
) {
  return env.VITEST !== "true";
}

export function assertGi088EmptyContentProbeExecutionAuthorization(
  probeFingerprint: string,
  env: Readonly<Partial<NodeJS.ProcessEnv>> = process.env
) {
  if (
    env.NODE_ENV === "production" ||
    env.VERCEL_ENV === "production"
  ) {
    throw new Error("GI088_EMPTY_PROBE_PRODUCTION_FORBIDDEN");
  }
  if (env.GI088_MODEL_CALL_SCOPE !== REQUIRED_SCOPE) {
    throw new Error("GI088_EMPTY_PROBE_SCOPE_NOT_AUTHORIZED");
  }
  if (
    env.GI088_AUTHORIZED_EMPTY_CONTENT_PROBE_FINGERPRINT !==
    probeFingerprint
  ) {
    throw new Error("GI088_EMPTY_PROBE_FINGERPRINT_NOT_AUTHORIZED");
  }
  if (
    env.GI088_EMPTY_CONTENT_PROBE_CONFIRMATION !==
    REQUIRED_CONFIRMATION
  ) {
    throw new Error("GI088_EMPTY_PROBE_CONFIRMATION_REQUIRED");
  }
  if (
    env.GI088_EMPTY_CONTENT_PROBE_AUTHORIZED_BUDGET !==
    String(GI088_EMPTY_CONTENT_PROBE_CALL_BUDGET)
  ) {
    throw new Error("GI088_EMPTY_PROBE_BUDGET_NOT_AUTHORIZED");
  }
  const authorizationId =
    env.GI088_EMPTY_CONTENT_PROBE_AUTHORIZATION_ID?.trim() ?? "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      authorizationId
    )
  ) {
    throw new Error("GI088_EMPTY_PROBE_AUTHORIZATION_ID_REQUIRED");
  }
  return authorizationId;
}

export function assertGi088EmptyContentProbeRuntime(
  summary: EventCenteredCandidateProviderSummary
) {
  if (
    summary.provider !== GI088_EMPTY_CONTENT_PROBE_RUNTIME.provider ||
    summary.model !== GI088_EMPTY_CONTENT_PROBE_RUNTIME.model ||
    summary.baseUrlHost !== GI088_EMPTY_CONTENT_PROBE_RUNTIME.baseUrlHost
  ) {
    throw new Error("GI088_EMPTY_PROBE_RUNTIME_MISMATCH");
  }
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

async function readLedger(filePath: string): Promise<unknown | null> {
  try {
    await stat(filePath);
  } catch {
    return null;
  }
  return JSON.parse(await readFile(filePath, "utf8")) as ProbeLedger;
}

export function createGi088EmptyContentProbePublicPlan(
  plan: ReturnType<typeof createGi088EmptyContentProbePlan>
) {
  return {
    probeVersion: plan.probeVersion,
    probeFingerprint: plan.probeFingerprint,
    sourceSnapshotSha256: plan.sourceSnapshotSha256,
    sourceEvaluationVersion: plan.sourceEvaluationVersion,
    sourceCandidateFingerprint: plan.sourceCandidateFingerprint,
    sourceExecutionFingerprint: plan.sourceExecutionFingerprint,
    effectiveCandidateFingerprint: plan.effectiveCandidateFingerprint,
    runtime: plan.runtime,
    authorizedCallBudget: plan.authorizedCallBudget,
    automaticRetries: plan.automaticRetries,
    variants: plan.variants,
    cases: plan.cases.map(createGi088EmptyContentProbePublicCase),
    modelGenerationCalls: 0,
    executionAuthorized: false
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function createSchedule(plan: Gi088EmptyContentProbePlan) {
  return plan.cases.flatMap((probeCase) =>
    plan.variants.map((variant) => ({ probeCase, variant }))
  );
}

export function parseGi088EmptyContentProbeLedger(input: {
  value: unknown;
  plan: Gi088EmptyContentProbePlan;
  authorizationId: string;
  sourcePath: string;
}): ProbeLedger {
  const { value, plan, authorizationId, sourcePath } = input;
  if (!isRecord(value) || !Array.isArray(value.calls)) {
    throw new Error("GI088_EMPTY_PROBE_LEDGER_INVALID");
  }
  if (
    value.schemaVersion !== "1.0" ||
    value.probeVersion !== plan.probeVersion ||
    value.probeFingerprint !== plan.probeFingerprint ||
    value.authorizationId !== authorizationId ||
    value.authorizedCallBudget !== plan.authorizedCallBudget ||
    value.sourcePath !== sourcePath ||
    value.sourceSnapshotSha256 !== plan.sourceSnapshotSha256 ||
    !isIsoTimestamp(value.createdAt) ||
    (value.completedAt !== null && !isIsoTimestamp(value.completedAt))
  ) {
    throw new Error("GI088_EMPTY_PROBE_LEDGER_LINEAGE_MISMATCH");
  }

  const schedule = createSchedule(plan);
  if (
    schedule.length !== GI088_EMPTY_CONTENT_PROBE_CALL_BUDGET ||
    value.calls.length > plan.authorizedCallBudget
  ) {
    throw new Error("GI088_EMPTY_PROBE_LEDGER_BUDGET_MISMATCH");
  }

  for (const [index, unknownCall] of value.calls.entries()) {
    const scheduled = schedule[index];
    if (!scheduled || !isRecord(unknownCall)) {
      throw new Error("GI088_EMPTY_PROBE_LEDGER_SCHEDULE_MISMATCH");
    }
    const expectedKey = `${scheduled.probeCase.caseId}:${scheduled.variant}`;
    if (
      unknownCall.key !== expectedKey ||
      unknownCall.caseId !== scheduled.probeCase.caseId ||
      unknownCall.variant !== scheduled.variant ||
      !isIsoTimestamp(unknownCall.reservedAt) ||
      (unknownCall.status !== "reserved" && unknownCall.status !== "completed")
    ) {
      throw new Error("GI088_EMPTY_PROBE_LEDGER_SCHEDULE_MISMATCH");
    }
    if (unknownCall.status === "reserved") {
      if (unknownCall.completedAt !== null || unknownCall.result !== null) {
        throw new Error("GI088_EMPTY_PROBE_LEDGER_RESERVATION_INVALID");
      }
      continue;
    }
    if (!isIsoTimestamp(unknownCall.completedAt) || !isRecord(unknownCall.result)) {
      throw new Error("GI088_EMPTY_PROBE_LEDGER_COMPLETION_INVALID");
    }
    const result = unknownCall.result;
    if (
      result.caseId !== scheduled.probeCase.caseId ||
      result.variant !== scheduled.variant ||
      result.sourceCallId !== scheduled.probeCase.sourceCallId ||
      result.sourceRequestHash !== scheduled.probeCase.sourceRequestHash ||
      result.probeRequestHash !==
        createGi088EmptyContentProbeRequestHash(
          scheduled.probeCase,
          scheduled.variant
        ) ||
      result.requestHashVerified !== true
    ) {
      throw new Error("GI088_EMPTY_PROBE_LEDGER_RESULT_LINEAGE_MISMATCH");
    }
  }

  if (
    value.completedAt !== null &&
    (value.calls.length !== plan.authorizedCallBudget ||
      value.calls.some(
        (call) => !isRecord(call) || call.status !== "completed"
      ))
  ) {
    throw new Error("GI088_EMPTY_PROBE_LEDGER_COMPLETION_INVALID");
  }
  return value as ProbeLedger;
}

export function assertGi088EmptyContentProbeLedgerCanResume(
  ledger: ProbeLedger
) {
  if (ledger.calls.some((call) => call.status === "reserved")) {
    throw new Error("GI088_EMPTY_PROBE_CALL_OUTCOME_AMBIGUOUS");
  }
}

async function main() {
  assertLocalRuntimePath(SOURCE_PATH);
  assertLocalRuntimePath(OUTPUT_ROOT);
  const snapshotBytes = await readFile(SOURCE_PATH);
  const snapshot = JSON.parse(snapshotBytes.toString("utf8")) as unknown;
  const plan = createGi088EmptyContentProbePlan({ snapshot, snapshotBytes });
  const execute = isGi088EmptyContentProbeExecutionRequested();

  if (!execute) {
    console.log(JSON.stringify(createGi088EmptyContentProbePublicPlan(plan), null, 2));
    return;
  }

  const authorizationId = assertGi088EmptyContentProbeExecutionAuthorization(
    plan.probeFingerprint
  );
  const runDirectory = path.join(OUTPUT_ROOT, authorizationId);
  const ledgerPath = path.join(runDirectory, "private-ledger.json");
  const summaryPath = path.join(runDirectory, "sanitized-summary.json");
  const storedLedger = await readLedger(ledgerPath);
  let ledger: ProbeLedger;
  if (storedLedger) {
    ledger = parseGi088EmptyContentProbeLedger({
      value: storedLedger,
      plan,
      authorizationId,
      sourcePath: SOURCE_PATH
    });
    assertGi088EmptyContentProbeLedgerCanResume(ledger);
  } else {
    ledger = {
      schemaVersion: "1.0",
      probeVersion: GI088_EMPTY_CONTENT_PROBE_VERSION,
      probeFingerprint: plan.probeFingerprint,
      authorizationId,
      authorizedCallBudget: GI088_EMPTY_CONTENT_PROBE_CALL_BUDGET,
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
  if (schedule.length !== GI088_EMPTY_CONTENT_PROBE_CALL_BUDGET) {
    throw new Error("GI088_EMPTY_PROBE_SCHEDULE_BUDGET_MISMATCH");
  }

  const pendingSchedule = schedule.filter(
    (item) => !completedKeys.has(`${item.probeCase.caseId}:${item.variant}`)
  );
  const provider = pendingSchedule.length
    ? (() => {
        const resolved = resolveEventCenteredCandidateProviderConfig(process.env);
        assertGi088EmptyContentProbeRuntime(resolved.summary);
        return createRuntimeAIProvider({
          capability: "chat",
          apiKey: resolved.apiKey,
          config: resolved.runtimeConfig,
          timeoutMs: 30_000
        });
      })()
    : null;

  for (const item of pendingSchedule) {
    const key = `${item.probeCase.caseId}:${item.variant}`;
    if (completedKeys.has(key)) continue;
    if (ledger.calls.length >= ledger.authorizedCallBudget) {
      throw new Error("GI088_EMPTY_PROBE_CALL_BUDGET_EXHAUSTED");
    }
    const call: LedgerCall = {
      key,
      caseId: item.probeCase.caseId,
      variant: item.variant,
      status: "reserved",
      reservedAt: new Date().toISOString(),
      completedAt: null,
      result: null
    };
    ledger.calls.push(call);
    await writePrivateJson(ledgerPath, ledger);

    const result = await runGi088EmptyContentProbeCall({
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
    .filter((result): result is Gi088EmptyContentProbeResult => result !== null)
    .map(createGi088EmptyContentProbePublicSummary);
  await writePrivateJson(summaryPath, {
    ...createGi088EmptyContentProbePublicPlan(plan),
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

if (isGi088EmptyContentProbeDirectRun()) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "GI088_EMPTY_PROBE_UNKNOWN_ERROR"
    );
    process.exitCode = 1;
  });
}
