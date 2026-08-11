import { createHash } from "node:crypto";
import { mkdir, open, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { GI088_V8R3_DEVELOPMENT_CASES } from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/development-fixtures";
import {
  parseGi088V8r3PrivateHiddenFile
} from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/hidden-fixtures";
import {
  GI088_V8R3_FORMAL_CALL_BUDGET,
  buildGi088V8r3BadCasePacket,
  buildGi088V8r3BlindComparisonPacket,
  buildGi088V8r3HumanAdjudicationPacket,
  createGi088V8r3ArkProviderIdentity,
  createGi088V8r3OfflineExecutionPlan,
  createGi088V8r3ProProviderIdentity,
  executeGi088V8r3Admission,
  executeGi088V8r3BadCaseArchive,
  executeGi088V8r3CandidateEvaluation,
  executeGi088V8r3JudgeCalibration,
  executeGi088V8r3JudgeDevelopmentPrescreen,
  parseGi088V8r3AdmissionReport,
  parseGi088V8r3CandidateExecutionReport,
  parseGi088V8r3HistoricalBaselineReport,
  parseGi088V8r3JudgeCalibrationReport,
  parseGi088V8r3JudgePrescreenReport,
  parseGi088V8r3JudgeGoldenFile
} from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/offline-executor";
import { GI088_V8R3_DETERMINISTIC_REGRESSION_CASES } from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/regression-fixtures";
import {
  createGi088V8r3CaseSetCommitment,
  createGi088V8r3DatasetFingerprint,
  validateGi088V8r3DatasetPartitions
} from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/runner";
import {
  createGi088ArkProvider,
  resolveGi088ArkRuntimeConfig
} from "../src/server/services/evaluation/gi088/ark-runtime";
import {
  createGi088ProProvider,
  resolveGi088ProRuntimeConfig
} from "../src/server/services/evaluation/gi088/pro-runtime";

const OUTPUT_ROOT = path.resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-11-gi088-v8r3-offline"
);
const EXECUTION_CONFIRMATION = "I_UNDERSTAND_MODEL_CALLS";

type Mode =
  | "plan"
  | "candidate"
  | "judge-calibration"
  | "judge-prescreen"
  | "human-adjudication"
  | "bad-case"
  | "bad-case-archive"
  | "admission";

function argumentValue(name: string) {
  const inline = process.argv.find((item) => item.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1) || null;
  const index = process.argv.indexOf(name);
  const next = index >= 0 ? process.argv[index + 1] : null;
  return next && !next.startsWith("--") ? next : null;
}

function readMode(): Mode {
  const value = argumentValue("--mode") ?? "plan";
  if (
    value === "plan" ||
    value === "candidate" ||
    value === "judge-calibration" ||
    value === "judge-prescreen" ||
    value === "human-adjudication" ||
    value === "bad-case" ||
    value === "bad-case-archive" ||
    value === "admission"
  ) {
    return value;
  }
  throw new Error("GI088_V8R3_OFFLINE_MODE_INVALID");
}

function requiredPathArgument(name: string) {
  const value = argumentValue(name);
  if (!value) {
    throw new Error(
      `${name.replace(/^--/u, "").replaceAll("-", "_").toUpperCase()}_REQUIRED`
    );
  }
  return path.resolve(process.cwd(), value);
}

function assertWithinPrivateRoot(filePath: string) {
  const relative = path.relative(OUTPUT_ROOT, filePath);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    path.extname(filePath) !== ".json"
  ) {
    throw new Error("GI088_V8R3_PATH_OUTSIDE_PRIVATE_ROOT");
  }
}

function resolveOutputPath(name = "--output") {
  const outputPath = requiredPathArgument(name);
  assertWithinPrivateRoot(outputPath);
  return outputPath;
}

async function resolvePrivateInputPath(name: string) {
  const inputPath = requiredPathArgument(name);
  assertWithinPrivateRoot(inputPath);
  const [resolvedRoot, resolvedInput, metadata] = await Promise.all([
    realpath(OUTPUT_ROOT),
    realpath(inputPath),
    stat(inputPath)
  ]);
  const relative = path.relative(resolvedRoot, resolvedInput);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("GI088_V8R3_PRIVATE_INPUT_SYMLINK_ESCAPE");
  }
  if ((metadata.mode & 0o077) !== 0) {
    throw new Error("GI088_V8R3_PRIVATE_INPUT_PERMISSIONS_TOO_OPEN");
  }
  return resolvedInput;
}

function sidecarPath(outputPath: string, suffix: string) {
  return outputPath.replace(/\.json$/u, `.${suffix}.json`);
}

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

async function writeJsonExclusive(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const [resolvedRoot, resolvedParent, parentMetadata] = await Promise.all([
    realpath(OUTPUT_ROOT),
    realpath(path.dirname(filePath)),
    stat(path.dirname(filePath))
  ]);
  const parentRelative = path.relative(resolvedRoot, resolvedParent);
  if (
    parentRelative.startsWith("..") ||
    path.isAbsolute(parentRelative) ||
    (parentMetadata.mode & 0o077) !== 0
  ) {
    throw new Error("GI088_V8R3_OUTPUT_PARENT_NOT_PRIVATE");
  }
  const handle = await open(filePath, "wx", 0o600).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`GI088_V8R3_OUTPUT_ALREADY_EXISTS:${filePath}`);
    }
    throw error;
  });
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  } finally {
    await handle.close();
  }
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function loadPrivateHiddenDataset() {
  const hiddenPath = await resolvePrivateInputPath("--hidden-file");
  const raw = await readFile(hiddenPath);
  const cases = parseGi088V8r3PrivateHiddenFile(
    JSON.parse(raw.toString("utf8"))
  );
  return {
    cases,
    fileSha256: sha256(raw),
    aggregateCommitment: createGi088V8r3CaseSetCommitment(cases)
  };
}

function assertNonProduction() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    throw new Error("GI088_V8R3_OFFLINE_PRODUCTION_FORBIDDEN");
  }
}

function assertModelExecutionGate(input: {
  mode: "candidate" | "judge-calibration" | "judge-prescreen";
  authorizedBudget: number;
}) {
  loadEnvConfig(process.cwd());
  assertNonProduction();
  if (!process.argv.includes("--execute")) {
    throw new Error("GI088_V8R3_EXECUTE_FLAG_REQUIRED");
  }
  if (
    process.env.GI088_V8R3_OFFLINE_MODEL_CALLS !== EXECUTION_CONFIRMATION ||
    process.env.GI088_V8R3_MODEL_CALL_SCOPE !== input.mode ||
    process.env.GI088_V8R3_AUTHORIZED_CALL_BUDGET !==
      String(input.authorizedBudget)
  ) {
    throw new Error("GI088_V8R3_OFFLINE_MODEL_CALL_GATE_MISMATCH");
  }
}

function printDryRun(mode: Mode) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ...createGi088V8r3OfflineExecutionPlan(),
        requestedMode: mode,
        executeFlagPresent: process.argv.includes("--execute"),
        hiddenFileRequired: mode !== "plan",
        humanOnlyMode:
          mode === "human-adjudication" ||
          mode === "bad-case" ||
          mode === "bad-case-archive" ||
          mode === "admission"
      },
      null,
      2
    )}\n`
  );
}

function validateFormalDataset(
  hiddenCases: Awaited<ReturnType<typeof loadPrivateHiddenDataset>>["cases"]
) {
  validateGi088V8r3DatasetPartitions({
    deterministicRegression: GI088_V8R3_DETERMINISTIC_REGRESSION_CASES,
    development: GI088_V8R3_DEVELOPMENT_CASES,
    hiddenAdmission: hiddenCases
  });
}

function assertCandidateMatchesDataset(
  candidate: ReturnType<typeof parseGi088V8r3CandidateExecutionReport>,
  hiddenDataset: Awaited<ReturnType<typeof loadPrivateHiddenDataset>>
) {
  const expectedFingerprint = createGi088V8r3DatasetFingerprint({
    deterministicRegression: GI088_V8R3_DETERMINISTIC_REGRESSION_CASES,
    development: GI088_V8R3_DEVELOPMENT_CASES,
    hiddenAdmission: hiddenDataset.cases
  });
  if (
    candidate.datasetFingerprint !== expectedFingerprint ||
    candidate.privateInputs.hiddenFileSha256 !== hiddenDataset.fileSha256 ||
    candidate.privateInputs.hiddenAggregateCommitment !==
      hiddenDataset.aggregateCommitment
  ) {
    throw new Error("GI088_V8R3_CANDIDATE_DATASET_FINGERPRINT_MISMATCH");
  }
  const developmentRecordCount = candidate.records.filter(
    (record) => record.partition === "development"
  ).length;
  const hiddenRecordCount = candidate.records.filter(
    (record) => record.partition === "hidden_admission"
  ).length;
  if (developmentRecordCount !== 56 || hiddenRecordCount !== 24) {
    throw new Error("GI088_V8R3_CANDIDATE_REPORT_CARDINALITY_MISMATCH");
  }
}

async function runCandidate() {
  assertModelExecutionGate({
    mode: "candidate",
    authorizedBudget: GI088_V8R3_FORMAL_CALL_BUDGET.candidateCallsMaximum
  });
  const outputPath = resolveOutputPath();
  const hiddenDataset = await loadPrivateHiddenDataset();
  validateFormalDataset(hiddenDataset.cases);
  const baselinePath = argumentValue("--baseline-report");
  const baseline = baselinePath
    ? parseGi088V8r3HistoricalBaselineReport(
        await readJson(await resolvePrivateInputPath("--baseline-report"))
      )
    : null;
  const expectedDatasetFingerprint = createGi088V8r3DatasetFingerprint({
    deterministicRegression: GI088_V8R3_DETERMINISTIC_REGRESSION_CASES,
    development: GI088_V8R3_DEVELOPMENT_CASES,
    hiddenAdmission: hiddenDataset.cases
  });
  if (
    baseline &&
    baseline.alignedDatasetFingerprint !== expectedDatasetFingerprint
  ) {
    throw new Error("GI088_V8R3_HISTORICAL_BASELINE_DATASET_MISMATCH");
  }
  const resolvedRuntime = resolveGi088ArkRuntimeConfig(process.env);
  const identity = createGi088V8r3ArkProviderIdentity();
  if (
    resolvedRuntime.summary.baseUrlHost !== identity.baseUrlHost ||
    resolvedRuntime.summary.model !== identity.model ||
    resolvedRuntime.summary.endpoint !== identity.endpoint
  ) {
    throw new Error("GI088_V8R3_ARK_RUNTIME_ATTESTATION_MISMATCH");
  }
  const report = await executeGi088V8r3CandidateEvaluation({
    provider: createGi088ArkProvider(process.env),
    providerIdentity: identity,
    deterministicRegression: GI088_V8R3_DETERMINISTIC_REGRESSION_CASES,
    developmentCases: GI088_V8R3_DEVELOPMENT_CASES,
    hiddenAdmissionCases: hiddenDataset.cases,
    privateHiddenFileSha256: hiddenDataset.fileSha256,
    automaticRecoveryMaximum:
      GI088_V8R3_FORMAL_CALL_BUDGET.candidateAutomaticRecoveryCallsMaximum,
    concurrency: 2
  });
  if (
    report.budget.initialCalls !==
      GI088_V8R3_FORMAL_CALL_BUDGET.candidateInitialCalls ||
    report.budget.totalCalls >
      GI088_V8R3_FORMAL_CALL_BUDGET.candidateCallsMaximum
  ) {
    throw new Error("GI088_V8R3_CANDIDATE_FORMAL_BUDGET_MISMATCH");
  }
  await writeJsonExclusive(outputPath, report);
  if (baseline) {
    const blind = buildGi088V8r3BlindComparisonPacket({
      candidateReport: report,
      baselineReport: baseline,
      seed: report.offlineRunFingerprint
    });
    await writeJsonExclusive(
      sidecarPath(outputPath, "blind-pairs"),
      blind.publicPacket
    );
    await writeJsonExclusive(
      sidecarPath(outputPath, "blind-key"),
      blind.sealedKey
    );
  }
  process.stdout.write(
    `${JSON.stringify({
      status: "candidate_complete",
      outputPath,
      initialCalls: report.budget.initialCalls,
      automaticRecoveryCalls: report.budget.automaticRecoveryCalls,
      totalCalls: report.budget.totalCalls,
      resultCounts: { development: 56, hidden: 24 },
      checkpointInitialCalls: { development: 64, hidden: 32 }
    })}\n`
  );
}

async function runJudgeCalibration() {
  assertModelExecutionGate({
    mode: "judge-calibration",
    authorizedBudget: GI088_V8R3_FORMAL_CALL_BUDGET.judgeCalibrationCalls
  });
  const outputPath = resolveOutputPath();
  const hiddenDataset = await loadPrivateHiddenDataset();
  validateFormalDataset(hiddenDataset.cases);
  const golden = parseGi088V8r3JudgeGoldenFile(
    await readJson(await resolvePrivateInputPath("--golden-file")),
    hiddenDataset.cases
  );
  const resolvedRuntime = resolveGi088ProRuntimeConfig(process.env);
  const identity = createGi088V8r3ProProviderIdentity();
  if (
    resolvedRuntime.summary.baseUrlHost !== identity.baseUrlHost ||
    resolvedRuntime.summary.model !== identity.model
  ) {
    throw new Error("GI088_V8R3_PRO_RUNTIME_ATTESTATION_MISMATCH");
  }
  const report = await executeGi088V8r3JudgeCalibration({
    provider: createGi088ProProvider(process.env),
    providerIdentity: identity,
    goldenFile: golden,
    hiddenCases: hiddenDataset.cases,
    datasetFingerprint: createGi088V8r3DatasetFingerprint({
      deterministicRegression: GI088_V8R3_DETERMINISTIC_REGRESSION_CASES,
      development: GI088_V8R3_DEVELOPMENT_CASES,
      hiddenAdmission: hiddenDataset.cases
    }),
    concurrency: 2
  });
  await writeJsonExclusive(outputPath, report);
  process.stdout.write(
    `${JSON.stringify({
      status: "judge_calibration_complete",
      outputPath,
      totalCalls: report.budget.totalCalls,
      promoted: report.promotedToDevelopmentPrescreen,
      runtime: report.runtime
    })}\n`
  );
}

async function runJudgePrescreen() {
  assertModelExecutionGate({
    mode: "judge-prescreen",
    authorizedBudget:
      GI088_V8R3_FORMAL_CALL_BUDGET.judgeDevelopmentPrescreenCallsMaximum
  });
  const outputPath = resolveOutputPath();
  const hiddenDataset = await loadPrivateHiddenDataset();
  validateFormalDataset(hiddenDataset.cases);
  const candidate = parseGi088V8r3CandidateExecutionReport(
    await readJson(await resolvePrivateInputPath("--candidate-report"))
  );
  assertCandidateMatchesDataset(candidate, hiddenDataset);
  const calibration = parseGi088V8r3JudgeCalibrationReport(
    await readJson(await resolvePrivateInputPath("--calibration-report"))
  );
  const resolvedRuntime = resolveGi088ProRuntimeConfig(process.env);
  const identity = createGi088V8r3ProProviderIdentity();
  if (
    resolvedRuntime.summary.baseUrlHost !== identity.baseUrlHost ||
    resolvedRuntime.summary.model !== identity.model
  ) {
    throw new Error("GI088_V8R3_PRO_RUNTIME_ATTESTATION_MISMATCH");
  }
  const report = await executeGi088V8r3JudgeDevelopmentPrescreen({
    provider: createGi088ProProvider(process.env),
    providerIdentity: identity,
    candidateReport: candidate,
    calibrationReport: calibration,
    developmentCases: GI088_V8R3_DEVELOPMENT_CASES,
    concurrency: 2
  });
  if (
    report.budget.totalCalls >
    GI088_V8R3_FORMAL_CALL_BUDGET.judgeDevelopmentPrescreenCallsMaximum
  ) {
    throw new Error("GI088_V8R3_JUDGE_PRESCREEN_BUDGET_EXCEEDED");
  }
  parseGi088V8r3JudgePrescreenReport(report, {
    candidateReport: candidate,
    calibrationReport: calibration
  });
  await writeJsonExclusive(outputPath, report);
  process.stdout.write(
    `${JSON.stringify({
      status: "judge_prescreen_complete",
      outputPath,
      totalCalls: report.budget.totalCalls,
      hiddenCalls: 0,
      excludedHiddenRecords: report.excludedHiddenRecordCount,
      runtime: report.runtime
    })}\n`
  );
}

async function runHumanAdjudication() {
  assertNonProduction();
  const outputPath = resolveOutputPath();
  const hiddenDataset = await loadPrivateHiddenDataset();
  validateFormalDataset(hiddenDataset.cases);
  const candidate = parseGi088V8r3CandidateExecutionReport(
    await readJson(await resolvePrivateInputPath("--candidate-report"))
  );
  assertCandidateMatchesDataset(candidate, hiddenDataset);
  const packet = buildGi088V8r3HumanAdjudicationPacket({
    candidateReport: candidate,
    cases: [...GI088_V8R3_DEVELOPMENT_CASES, ...hiddenDataset.cases],
    seed: candidate.offlineRunFingerprint
  });
  await writeJsonExclusive(outputPath, packet.publicPacket);
  await writeJsonExclusive(sidecarPath(outputPath, "sealed-key"), packet.sealedKey);
  await writeJsonExclusive(
    sidecarPath(outputPath, "adjudication-template"),
    packet.adjudicationTemplate
  );
  process.stdout.write(
    `${JSON.stringify({
      status: "human_adjudication_packet_complete",
      outputPath,
      reviewItems: packet.publicPacket.items.length,
      externalModelCalls: 0
    })}\n`
  );
}

async function runAdmission() {
  assertNonProduction();
  const outputPath = resolveOutputPath();
  const hiddenDataset = await loadPrivateHiddenDataset();
  validateFormalDataset(hiddenDataset.cases);
  const candidate = parseGi088V8r3CandidateExecutionReport(
    await readJson(await resolvePrivateInputPath("--candidate-report"))
  );
  assertCandidateMatchesDataset(candidate, hiddenDataset);
  const adjudication = await readJson(
    await resolvePrivateInputPath("--adjudication-file")
  );
  const calibration = parseGi088V8r3JudgeCalibrationReport(
    await readJson(await resolvePrivateInputPath("--calibration-report"))
  );
  const prescreen = parseGi088V8r3JudgePrescreenReport(
    await readJson(await resolvePrivateInputPath("--prescreen-report")),
    { candidateReport: candidate, calibrationReport: calibration }
  );
  const report = parseGi088V8r3AdmissionReport(
    executeGi088V8r3Admission({
      candidateReport: candidate,
      adjudicationFile: adjudication as Parameters<
        typeof executeGi088V8r3Admission
      >[0]["adjudicationFile"],
      calibrationReport: calibration,
      prescreenReport: prescreen,
      deterministicRegression: GI088_V8R3_DETERMINISTIC_REGRESSION_CASES,
      developmentCases: GI088_V8R3_DEVELOPMENT_CASES,
      hiddenAdmissionCases: hiddenDataset.cases
    })
  );
  await writeJsonExclusive(outputPath, report);
  process.stdout.write(
    `${JSON.stringify({
      status: "admission_complete",
      outputPath,
      passed: report.passed,
      passSquared: report.passSquared,
      gates: {
        quality: report.gates.quality.passed,
        reliability: report.gates.reliability.passed,
        latency: report.gates.latency.passed
      },
      externalModelCalls: 0
    })}\n`
  );
}

async function loadBadCaseInputs() {
  const hiddenDataset = await loadPrivateHiddenDataset();
  validateFormalDataset(hiddenDataset.cases);
  const candidate = parseGi088V8r3CandidateExecutionReport(
    await readJson(await resolvePrivateInputPath("--candidate-report"))
  );
  assertCandidateMatchesDataset(candidate, hiddenDataset);
  const adjudication = await readJson(
    await resolvePrivateInputPath("--adjudication-file")
  );
  return {
    candidate,
    adjudication: adjudication as Parameters<
      typeof buildGi088V8r3BadCasePacket
    >[0]["adjudicationFile"],
    cases: [...GI088_V8R3_DEVELOPMENT_CASES, ...hiddenDataset.cases]
  };
}

async function runBadCase() {
  assertNonProduction();
  const outputPath = resolveOutputPath();
  const input = await loadBadCaseInputs();
  const packet = buildGi088V8r3BadCasePacket({
    candidateReport: input.candidate,
    adjudicationFile: input.adjudication,
    cases: input.cases
  });
  await writeJsonExclusive(outputPath, packet.publicPacket);
  await writeJsonExclusive(
    sidecarPath(outputPath, "archive-template"),
    packet.archiveTemplate
  );
  process.stdout.write(
    `${JSON.stringify({
      status: "bad_case_packet_complete",
      outputPath,
      badCaseCount: packet.publicPacket.items.length,
      externalModelCalls: 0
    })}\n`
  );
}

async function runBadCaseArchive() {
  assertNonProduction();
  const outputPath = resolveOutputPath();
  const input = await loadBadCaseInputs();
  const packet = buildGi088V8r3BadCasePacket({
    candidateReport: input.candidate,
    adjudicationFile: input.adjudication,
    cases: input.cases
  });
  const archive = await readJson(
    await resolvePrivateInputPath("--bad-case-archive-file")
  );
  const report = executeGi088V8r3BadCaseArchive({
    badCasePacket: packet.publicPacket,
    archiveFile: archive as Parameters<
      typeof executeGi088V8r3BadCaseArchive
    >[0]["archiveFile"]
  });
  await writeJsonExclusive(outputPath, report);
  process.stdout.write(
    `${JSON.stringify({
      status: "bad_case_archive_complete",
      outputPath,
      archivedBadCaseCount: report.archivedItems.length,
      externalModelCalls: 0
    })}\n`
  );
}

async function main() {
  const mode = readMode();
  if (mode === "plan" || !process.argv.includes("--execute")) {
    printDryRun(mode);
    return;
  }
  if (mode === "candidate") return runCandidate();
  if (mode === "judge-calibration") return runJudgeCalibration();
  if (mode === "judge-prescreen") return runJudgePrescreen();
  if (mode === "human-adjudication") return runHumanAdjudication();
  if (mode === "bad-case") return runBadCase();
  if (mode === "bad-case-archive") return runBadCaseArchive();
  return runAdmission();
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
