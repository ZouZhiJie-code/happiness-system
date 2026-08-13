import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { loadEnvConfig } from "@next/env";

import { GI088_V8R3_DEVELOPMENT_CASES } from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/development-fixtures";
import { parseGi088V8r3PrivateHiddenFile } from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/hidden-fixtures";
import {
  GI088_PRO_CONTRACT_DEVELOPMENT_CALLS_MAXIMUM,
  GI088_PRO_CONTRACT_HIDDEN_CALLS_MAXIMUM,
  GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION,
  GI088_PRO_CONTRACT_TOTAL_CALLS_MAXIMUM,
  createGi088ProContractDevelopmentSchedule,
  createGi088ProContractDiagnosticFingerprint,
  createGi088ProContractGroupDefinition,
  type Gi088ProContractGroup,
  type Gi088ProContractToolSourceFingerprint
} from "../evals/event-centered-generative/gi088-pro-contract-projection-ab/contracts";
import {
  assertGi088ProContractArtifactTargetsAvailable,
  acquireGi088ProContractExecutionReservation,
  executeGi088ProContractDevelopment,
  executeGi088ProContractHidden,
  readGi088ProContractPrivateReport,
  writeGi088ProContractDevelopmentArtifacts,
  writeGi088ProContractHiddenArtifacts,
  type Gi088ProContractDevelopmentReport
} from "../evals/event-centered-generative/gi088-pro-contract-projection-ab/runner";
import { createGi088CanonicalV2StateAdapter } from "../evals/event-centered-generative/gi088-pro-contract-projection-ab/state-adapter";
import {
  createGi088FingerprintBundle
} from "../src/server/services/evaluation/gi088/candidate";
import { createGi088ProProvider, resolveGi088ProRuntimeConfig } from "../src/server/services/evaluation/gi088/pro-runtime";
import { GI088_PRO_CONTRACT_PRIVATE_ROOT } from "../src/server/services/evaluation/gi088/pro-contract-review-contract";
import {
  GI088_PRO_CONTRACT_DEVELOPMENT_PRIVATE_REPORT_PATH,
  GI088_PRO_CONTRACT_DEVELOPMENT_REVIEW_SOURCE_PATH,
  GI088_PRO_CONTRACT_HIDDEN_PRIVATE_REPORT_PATH,
  GI088_PRO_CONTRACT_HIDDEN_REVIEW_SOURCE_PATH,
  gi088ProContractSha256,
  gi088ProContractStableJson
} from "../src/server/services/evaluation/gi088/pro-contract-review-contract";

const AUTHORIZATION_ENV = "GI088_PRO_CONTRACT_MODEL_CALLS";
const AUTHORIZATION_VALUE = "I_UNDERSTAND_MODEL_CALLS";
const SCOPE_ENV = "GI088_PRO_CONTRACT_MODEL_CALL_SCOPE";
const BUDGET_ENV = "GI088_PRO_CONTRACT_AUTHORIZED_CALL_BUDGET";
const DEVELOPMENT_EXECUTION_LOCK_PATH = resolve(
  GI088_PRO_CONTRACT_PRIVATE_ROOT,
  "development-execution.lock"
);
const HIDDEN_EXECUTION_LOCK_PATH = resolve(
  GI088_PRO_CONTRACT_PRIVATE_ROOT,
  "hidden-execution.lock"
);

const GI088_PRO_CONTRACT_TOOL_SOURCE_PATHS = [
  "evals/event-centered-generative/gi088-pro-contract-projection-ab/contracts.ts",
  "evals/event-centered-generative/gi088-pro-contract-projection-ab/runner.ts",
  "evals/event-centered-generative/gi088-pro-contract-projection-ab/state-adapter.ts",
  "scripts/run-gi088-pro-contract-projection-ab.ts",
  "src/server/services/evaluation/gi088/canonical-interview-state-v2.ts",
  "src/server/services/evaluation/gi088/pro-contract-review-contract.ts"
] as const;

export const GI088_PRO_CONTRACT_FROZEN_HIDDEN_PATH = resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-11-gi088-v8r3-offline/private-hidden-admission.json"
);

type Mode = "plan" | "development" | "hidden";

function argumentValue(name: string) {
  const inline = process.argv.find((item) => item.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1) || null;
  const index = process.argv.indexOf(name);
  const next = index >= 0 ? process.argv[index + 1] : null;
  return next && !next.startsWith("--") ? next : null;
}

function mode(): Mode {
  const value = argumentValue("--mode") ?? "plan";
  if (value === "plan" || value === "development" || value === "hidden") {
    return value;
  }
  throw new Error("GI088_PRO_CONTRACT_MODE_INVALID");
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export async function createGi088ProContractToolSourceFingerprint(
  workspaceRoot = process.cwd()
): Promise<Gi088ProContractToolSourceFingerprint> {
  const files = await Promise.all(GI088_PRO_CONTRACT_TOOL_SOURCE_PATHS.map(
    async (path) => ({
      path,
      sha256: sha256(await readFile(resolve(workspaceRoot, path)))
    })
  ));
  return {
    version: "2026-08-12.gi088-pro-contract-tool-source-v1",
    fileCount: 6,
    aggregateSha256: sha256(gi088ProContractStableJson(files)),
    files
  };
}

function fingerprintBundle() {
  const bundle = createGi088FingerprintBundle();
  return {
    candidateFingerprint: bundle.candidateFingerprint,
    datasetFingerprint: bundle.datasetFingerprint,
    runnerFingerprint: bundle.runnerFingerprint,
    experienceFingerprint: bundle.experienceFingerprint,
    executionFingerprint: bundle.executionFingerprint
  };
}

export function validateGi088ProContractEnvironment(
  env: NodeJS.ProcessEnv = process.env
) {
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
    throw new Error("GI088_PRO_CONTRACT_PRODUCTION_FORBIDDEN");
  }
  const resolved = resolveGi088ProRuntimeConfig(env);
  if (
    resolved.baseUrl !== "https://api.deepseek.com" ||
    resolved.model !== "deepseek-v4-pro" ||
    resolved.summary.transport !== "openai_compatible_rest" ||
    resolved.summary.baseUrlHost !== "api.deepseek.com"
  ) throw new Error("GI088_PRO_CONTRACT_PROVIDER_IDENTITY_MISMATCH");
  return resolved;
}

export function assertGi088ProContractAuthorization(
  requestedMode: Exclude<Mode, "plan">,
  env: NodeJS.ProcessEnv = process.env
) {
  const expectedBudget = requestedMode === "development"
    ? GI088_PRO_CONTRACT_DEVELOPMENT_CALLS_MAXIMUM
    : GI088_PRO_CONTRACT_HIDDEN_CALLS_MAXIMUM;
  if (
    env[AUTHORIZATION_ENV]?.trim() !== AUTHORIZATION_VALUE ||
    env[SCOPE_ENV]?.trim() !== requestedMode ||
    env[BUDGET_ENV]?.trim() !== String(expectedBudget)
  ) throw new Error("GI088_PRO_CONTRACT_MODEL_CALL_AUTHORIZATION_REQUIRED");
}

function resolvePrivatePath(value: string | null, code: string) {
  if (!value) throw new Error(code);
  const path = resolve(process.cwd(), value);
  const rel = relative(GI088_PRO_CONTRACT_PRIVATE_ROOT, path);
  if (rel.startsWith("..") || rel.startsWith("/") || !path.endsWith(".json")) {
    throw new Error("GI088_PRO_CONTRACT_PATH_OUTSIDE_PRIVATE_ROOT");
  }
  return path;
}

export function resolveGi088ProContractFrozenHiddenPath(value: string | null) {
  if (!value) throw new Error("GI088_PRO_CONTRACT_HIDDEN_FILE_REQUIRED");
  const path = resolve(process.cwd(), value);
  if (path !== GI088_PRO_CONTRACT_FROZEN_HIDDEN_PATH) {
    throw new Error("GI088_PRO_CONTRACT_HIDDEN_FILE_PATH_NOT_FROZEN");
  }
  return path;
}

async function readPrivateFile(path: string, allowedRoot = GI088_PRO_CONTRACT_PRIVATE_ROOT) {
  const [root, actual, metadata] = await Promise.all([
    realpath(allowedRoot),
    realpath(path),
    stat(path)
  ]);
  const rel = relative(root, actual);
  if (
    rel.startsWith("..") ||
    rel.startsWith("/") ||
    !metadata.isFile() ||
    (metadata.mode & 0o077) !== 0
  ) throw new Error("GI088_PRO_CONTRACT_PRIVATE_INPUT_INVALID");
  const bytes = await readFile(actual);
  return { path: actual, bytes, json: JSON.parse(bytes.toString("utf8")) as unknown };
}

type DevelopmentReceipt = {
  schemaVersion: "1.0";
  stage: "pro-contract-development-paired";
  status: "sealed";
  experimentVersion: typeof GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION;
  runnerReportFingerprint: string;
  runnerReportSha256: string;
  receiptSha256: string;
  winningGroup: Gi088ProContractGroup | null;
  gate: { passed: boolean };
};

export function validateGi088ProContractDevelopmentReceipt(input: {
  receipt: unknown;
  developmentReport: Gi088ProContractDevelopmentReport;
  developmentReportBytes: Buffer;
  winner: Gi088ProContractGroup;
}) {
  const receipt = input.receipt as Partial<DevelopmentReceipt> | null;
  if (!receipt || typeof receipt !== "object") {
    throw new Error("GI088_PRO_CONTRACT_DEVELOPMENT_RECEIPT_INVALID");
  }
  const { receiptSha256, ...payload } = receipt;
  if (
    receipt.schemaVersion !== "1.0" ||
    receipt.stage !== "pro-contract-development-paired" ||
    receipt.status !== "sealed" ||
    receipt.experimentVersion !== GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION ||
    receipt.runnerReportFingerprint !== input.developmentReport.reportFingerprint ||
    receipt.runnerReportSha256 !== sha256(input.developmentReportBytes) ||
    input.developmentReport.decision.status !== "awaiting_human_development_review" ||
    !input.developmentReport.decision.technicallyEligibleGroups.includes(input.winner) ||
    receipt.gate?.passed !== true ||
    receipt.winningGroup !== input.winner ||
    typeof receiptSha256 !== "string" ||
    receiptSha256 !== gi088ProContractSha256(gi088ProContractStableJson(payload))
  ) throw new Error("GI088_PRO_CONTRACT_DEVELOPMENT_RECEIPT_INTEGRITY_INVALID");
  return receipt as DevelopmentReceipt;
}

async function dryRun() {
  const fingerprints = fingerprintBundle();
  const toolSourceFingerprint = await createGi088ProContractToolSourceFingerprint();
  const schedule = createGi088ProContractDevelopmentSchedule(
    GI088_V8R3_DEVELOPMENT_CASES
  );
  process.stdout.write(`${JSON.stringify({
    experimentVersion: GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION,
    groups: (["full", "compact"] as const).map(createGi088ProContractGroupDefinition),
    dataset: {
      developmentCases: 28,
      developmentCheckpoints: 32,
      perGroupResults: 64,
      hiddenRead: false
    },
    scheduleFingerprint: schedule.scheduleFingerprint,
    concurrency: 2,
    budgets: {
      developmentMaximum: GI088_PRO_CONTRACT_DEVELOPMENT_CALLS_MAXIMUM,
      hiddenMaximum: GI088_PRO_CONTRACT_HIDDEN_CALLS_MAXIMUM,
      totalMaximum: GI088_PRO_CONTRACT_TOTAL_CALLS_MAXIMUM
    },
    retries: 0,
    recoveries: 0,
    judgeCalls: 0,
    previewDeployments: 0,
    productionChanges: 0,
    externalModelCalls: 0,
    diagnosticFingerprint: createGi088ProContractDiagnosticFingerprint({
      cases: GI088_V8R3_DEVELOPMENT_CASES,
      globalFingerprintBundle: fingerprints,
      toolSourceFingerprint
    }),
    toolSourceFingerprint: {
      fileCount: toolSourceFingerprint.fileCount,
      aggregateSha256: toolSourceFingerprint.aggregateSha256
    },
    globalRuntimeFingerprints: fingerprints
  }, null, 2)}\n`);
}

async function runDevelopment() {
  assertGi088ProContractAuthorization("development");
  validateGi088ProContractEnvironment();
  const before = fingerprintBundle();
  const toolSourceFingerprint = await createGi088ProContractToolSourceFingerprint();
  await assertGi088ProContractArtifactTargetsAvailable([
    GI088_PRO_CONTRACT_DEVELOPMENT_PRIVATE_REPORT_PATH,
    GI088_PRO_CONTRACT_DEVELOPMENT_REVIEW_SOURCE_PATH
  ]);
  await acquireGi088ProContractExecutionReservation({
    lockPath: DEVELOPMENT_EXECUTION_LOCK_PATH,
    stage: "development",
    targetPaths: [
      GI088_PRO_CONTRACT_DEVELOPMENT_PRIVATE_REPORT_PATH,
      GI088_PRO_CONTRACT_DEVELOPMENT_REVIEW_SOURCE_PATH
    ]
  });
  const report = await executeGi088ProContractDevelopment({
    cases: GI088_V8R3_DEVELOPMENT_CASES,
    provider: createGi088ProProvider(),
    adapter: createGi088CanonicalV2StateAdapter(),
    globalFingerprintBundleBefore: before,
    readGlobalFingerprintBundleAfter: fingerprintBundle,
    toolSourceFingerprint
  });
  const artifacts = await writeGi088ProContractDevelopmentArtifacts({ report });
  process.stdout.write(`${JSON.stringify({
    experimentVersion: report.experimentVersion,
    reportFingerprint: report.reportFingerprint,
    providerCalls: report.budget.providerCalls,
    technicalSummaries: report.technicalSummaries,
    technicalGates: report.technicalGates,
    decision: report.decision,
    reportPath: artifacts.reportPath,
    reviewSourcePath: artifacts.reviewSourcePath
  }, null, 2)}\n`);
}

async function runHidden() {
  assertGi088ProContractAuthorization("hidden");
  validateGi088ProContractEnvironment();
  const winner = argumentValue("--winner");
  if (winner !== "full" && winner !== "compact") {
    throw new Error("GI088_PRO_CONTRACT_HIDDEN_WINNER_REQUIRED");
  }
  const developmentPath = resolvePrivatePath(
    argumentValue("--development-report"),
    "GI088_PRO_CONTRACT_DEVELOPMENT_REPORT_REQUIRED"
  );
  const receiptPath = resolvePrivatePath(
    argumentValue("--development-receipt"),
    "GI088_PRO_CONTRACT_DEVELOPMENT_RECEIPT_REQUIRED"
  );
  const frozenHiddenPath = resolveGi088ProContractFrozenHiddenPath(argumentValue("--hidden-file"));
  const [developmentUnknown, developmentFile, receipt, hidden] = await Promise.all([
    readGi088ProContractPrivateReport(developmentPath),
    readPrivateFile(developmentPath),
    readPrivateFile(receiptPath),
    readPrivateFile(frozenHiddenPath, resolve(frozenHiddenPath, ".."))
  ]);
  if (developmentUnknown.partition !== "development") {
    throw new Error("GI088_PRO_CONTRACT_DEVELOPMENT_REPORT_INVALID");
  }
  const development = developmentUnknown as Gi088ProContractDevelopmentReport;
  validateGi088ProContractDevelopmentReceipt({
    receipt: receipt.json,
    developmentReport: development,
    developmentReportBytes: developmentFile.bytes,
    winner
  });
  const cases = parseGi088V8r3PrivateHiddenFile(hidden.json);
  await assertGi088ProContractArtifactTargetsAvailable([
    GI088_PRO_CONTRACT_HIDDEN_PRIVATE_REPORT_PATH,
    GI088_PRO_CONTRACT_HIDDEN_REVIEW_SOURCE_PATH
  ]);
  await acquireGi088ProContractExecutionReservation({
    lockPath: HIDDEN_EXECUTION_LOCK_PATH,
    stage: "hidden",
    targetPaths: [
      GI088_PRO_CONTRACT_HIDDEN_PRIVATE_REPORT_PATH,
      GI088_PRO_CONTRACT_HIDDEN_REVIEW_SOURCE_PATH
    ]
  });
  const report = await executeGi088ProContractHidden({
    cases,
    hiddenFileSha256: sha256(hidden.bytes),
    winner: winner as Gi088ProContractGroup,
    developmentReportFingerprint: development.reportFingerprint,
    developmentReceiptSha256: sha256(receipt.bytes),
    developmentProviderCalls: development.budget.providerCalls,
    toolSourceFingerprint: await createGi088ProContractToolSourceFingerprint(),
    provider: createGi088ProProvider(),
    adapter: createGi088CanonicalV2StateAdapter()
  });
  const artifacts = await writeGi088ProContractHiddenArtifacts({ report, cases });
  process.stdout.write(`${JSON.stringify({
    experimentVersion: report.experimentVersion,
    reportFingerprint: report.reportFingerprint,
    winner: report.winner,
    hiddenProviderCalls: report.budget.hiddenProviderCalls,
    totalProviderCalls: report.budget.totalProviderCalls,
    technicalSummary: report.technicalSummary,
    technicalGate: report.technicalGate,
    decision: report.decision,
    reportPath: artifacts.reportPath,
    reviewSourcePath: artifacts.reviewSourcePath
  }, null, 2)}\n`);
}

async function main() {
  loadEnvConfig(process.cwd());
  const requested = mode();
  if (!process.argv.includes("--execute") || requested === "plan") {
    await dryRun();
    return;
  }
  if (requested === "development") await runDevelopment();
  else await runHidden();
}

if (process.argv.includes("--run")) await main();
