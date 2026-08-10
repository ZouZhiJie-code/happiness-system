import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  BOARD7B_SEMANTIC_FRAME_V1_CANDIDATE_VERSION,
  BOARD7B_SEMANTIC_FRAME_V1_PACKAGE_DIRECTORY,
  BOARD7B_SEMANTIC_FRAME_V1_RUNTIME_CONFIG
} from "../evals/event-centered-generative/board7b-semantic-frame-v1/board7b-semantic-frame-v1";
import { inspectBoard7bSemanticFrameV1Regression } from "./run-board7b-semantic-frame-v1-regression";

const RESULT_FILE =
  "board7b-semantic-frame-v1-regression-result.json" as const;

type RegressionResult = {
  candidateVersion: string;
  candidateFingerprint: string;
  datasetFingerprint: string;
  requestSetFingerprint: string;
  evaluationPolicyFingerprint: string;
  executionFingerprint: string;
  runFingerprint: string;
  authorization: {
    authorizationId: string;
    authorizationDigest: string;
    status: string;
    authorizedCalls: number;
  };
  execution: {
    attemptedCalls: number;
    modelCalls: number;
    valid: number;
    protectedFailures: number;
    modelContractFailures: number;
    technicalFailures: number;
  };
  gate: {
    decision: string;
    knownDevelopmentRegression: string;
    freshRelationshipTransfer: string;
    counterfactual: string;
    validStructureAndSource: string;
    ordinaryQualityFailures: number;
    singleCaseBlocks: number;
  };
  localEvidenceRelativePath: string;
  production: string;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function assertEqual(label: string, actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(
      `BOARD7B_SEMANTIC_FRAME_V1_RESULT_MISMATCH:${label}`
    );
  }
}

async function verifyLocalEvidence(result: RegressionResult) {
  const rawPath = resolve(process.cwd(), result.localEvidenceRelativePath);
  let source: string;
  try {
    source = await readFile(rawPath, "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return "unavailable_in_this_workspace" as const;
    }
    throw error;
  }
  const raw = JSON.parse(source) as {
    candidateFingerprint: string;
    datasetFingerprint: string;
    requestSetFingerprint: string;
    evaluationPolicyFingerprint: string;
    executionFingerprint: string;
    runFingerprint: string;
    authorization: {
      authorizationId: string;
      authorizationDigest: string;
      consumptionRecordPath: string;
    };
    attempts: Array<{ callNumber: number; status: string }>;
    calls: Array<{
      callNumber: number;
      status: string;
      rawOutput: string | null;
      responseHash: string | null;
    }>;
  };
  for (const [label, actual, expected] of [
    ["candidateFingerprint", raw.candidateFingerprint, result.candidateFingerprint],
    ["datasetFingerprint", raw.datasetFingerprint, result.datasetFingerprint],
    ["requestSetFingerprint", raw.requestSetFingerprint, result.requestSetFingerprint],
    [
      "evaluationPolicyFingerprint",
      raw.evaluationPolicyFingerprint,
      result.evaluationPolicyFingerprint
    ],
    ["executionFingerprint", raw.executionFingerprint, result.executionFingerprint],
    ["runFingerprint", raw.runFingerprint, result.runFingerprint],
    [
      "authorizationId",
      raw.authorization.authorizationId,
      result.authorization.authorizationId
    ],
    [
      "authorizationDigest",
      raw.authorization.authorizationDigest,
      result.authorization.authorizationDigest
    ]
  ] as const) {
    assertEqual(label, actual, expected);
  }
  assertEqual("attemptCount", raw.attempts.length, result.execution.attemptedCalls);
  assertEqual("callCount", raw.calls.length, result.execution.modelCalls);
  const statuses = {
    valid: raw.calls.filter((call) => call.status === "valid").length,
    protectedFailures: raw.calls.filter(
      (call) => call.status === "protected_failure"
    ).length,
    modelContractFailures: raw.calls.filter(
      (call) => call.status === "model_contract_failure"
    ).length,
    technicalFailures: raw.calls.filter(
      (call) => call.status === "technical_failure"
    ).length
  };
  for (const [label, actual, expected] of [
    ["valid", statuses.valid, result.execution.valid],
    [
      "protectedFailures",
      statuses.protectedFailures,
      result.execution.protectedFailures
    ],
    [
      "modelContractFailures",
      statuses.modelContractFailures,
      result.execution.modelContractFailures
    ],
    [
      "technicalFailures",
      statuses.technicalFailures,
      result.execution.technicalFailures
    ]
  ] as const) {
    assertEqual(label, actual, expected);
  }
  for (const call of raw.calls) {
    if (call.rawOutput && call.responseHash) {
      assertEqual(
        `responseHash:${call.callNumber}`,
        sha256(call.rawOutput),
        call.responseHash
      );
    }
  }
  const runDirectory = dirname(rawPath);
  const [attemptFiles, resultFiles, consumptionSource] = await Promise.all([
    readdir(resolve(runDirectory, "attempts")),
    readdir(resolve(runDirectory, "results")),
    readFile(raw.authorization.consumptionRecordPath, "utf8")
  ]);
  assertEqual("attemptFileCount", attemptFiles.length, result.execution.modelCalls);
  assertEqual("resultFileCount", resultFiles.length, result.execution.modelCalls);
  const consumption = JSON.parse(consumptionSource) as {
    authorizationId: string;
    authorizationDigest: string;
    runFingerprint: string;
  };
  assertEqual(
    "consumedAuthorizationId",
    consumption.authorizationId,
    result.authorization.authorizationId
  );
  assertEqual(
    "consumedAuthorizationDigest",
    consumption.authorizationDigest,
    result.authorization.authorizationDigest
  );
  assertEqual(
    "consumedRunFingerprint",
    consumption.runFingerprint,
    result.runFingerprint
  );
  return "verified" as const;
}

async function main() {
  const inspected = await inspectBoard7bSemanticFrameV1Regression();
  const result = JSON.parse(
    await readFile(
      resolve(
        process.cwd(),
        BOARD7B_SEMANTIC_FRAME_V1_PACKAGE_DIRECTORY,
        RESULT_FILE
      ),
      "utf8"
    )
  ) as RegressionResult;
  for (const [label, actual, expected] of [
    ["candidateVersion", result.candidateVersion, BOARD7B_SEMANTIC_FRAME_V1_CANDIDATE_VERSION],
    ["candidateFingerprint", result.candidateFingerprint, inspected.candidateFingerprint],
    ["datasetFingerprint", result.datasetFingerprint, inspected.dataset.datasetFingerprint],
    ["requestSetFingerprint", result.requestSetFingerprint, inspected.requestSetFingerprint],
    [
      "evaluationPolicyFingerprint",
      result.evaluationPolicyFingerprint,
      inspected.evaluationPolicyFingerprint
    ],
    ["executionFingerprint", result.executionFingerprint, inspected.executionFingerprint]
  ] as const) {
    assertEqual(label, actual, expected);
  }
  const localEvidenceReadback = await verifyLocalEvidence(result);
  process.stdout.write(
    `${JSON.stringify(
      {
        candidateVersion: BOARD7B_SEMANTIC_FRAME_V1_CANDIDATE_VERSION,
        candidateFingerprint: result.candidateFingerprint,
        datasetVersion: inspected.dataset.datasetVersion,
        datasetFingerprint: result.datasetFingerprint,
        requestSetFingerprint: result.requestSetFingerprint,
        evaluationPolicyFingerprint: result.evaluationPolicyFingerprint,
        executionFingerprint: result.executionFingerprint,
        runFingerprint: result.runFingerprint,
        regressionCases: inspected.cases.length,
        authorization: result.authorization.status,
        authorizationId: result.authorization.authorizationId,
        runtimeConfig: BOARD7B_SEMANTIC_FRAME_V1_RUNTIME_CONFIG,
        execution: result.execution,
        gate: result.gate,
        localEvidenceReadback,
        production: result.production
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
