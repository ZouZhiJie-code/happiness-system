import { createHash } from "node:crypto";

import {
  GI088_V8R3_EVALUATION_DATASET_VERSION,
  GI088_V8R3_EXPECTED_CASE_COUNTS,
  GI088_V8R3_HARD_GATES,
  GI088_V8R3_RUNNER_VERSION,
  gi088V8r3BadCaseCategorySchema,
  gi088V8r3EvaluationCaseSchema,
  gi088V8r3TrialResultSchema,
  type Gi088V8r3BadCaseCategory,
  type Gi088V8r3EvaluationCase,
  type Gi088V8r3JudgeCalibrationRound,
  type Gi088V8r3TrialResult
} from "./contracts";

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizedCaseContent(evaluationCase: Gi088V8r3EvaluationCase) {
  const parsed = gi088V8r3EvaluationCaseSchema.parse(evaluationCase);
  const messageIndex = new Map(
    parsed.messages.map((message, index) => [message.id, index])
  );
  const normalizeText = (value: string) =>
    value.normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/[\p{P}\p{S}\s]+/gu, "");
  return {
    kind: parsed.kind,
    title: normalizeText(parsed.title),
    workingTask: normalizeText(parsed.workingTask),
    messages: parsed.messages.map((message) => ({
      role: message.role,
      content: normalizeText(message.content)
    })),
    checkpoints: parsed.checkpoints.map((checkpoint) => ({
      afterMessageIndex: messageIndex.get(checkpoint.afterUserMessageId),
      allowedActions: [...checkpoint.allowedActions].sort(),
      expectedValueClassification: checkpoint.expectedValueClassification,
      requiredEvidenceMessageIndexes: checkpoint.requiredEvidenceMessageIds
        .map((id) => messageIndex.get(id))
        .sort((left, right) => (left ?? -1) - (right ?? -1)),
      forbiddenBehaviors: [...checkpoint.forbiddenBehaviors].sort()
    }))
  };
}

export function createGi088V8r3CaseContentFingerprint(
  evaluationCase: Gi088V8r3EvaluationCase
) {
  return sha256(JSON.stringify(normalizedCaseContent(evaluationCase)));
}

export function createGi088V8r3CaseFingerprint(
  evaluationCase: Gi088V8r3EvaluationCase
) {
  return sha256(JSON.stringify(gi088V8r3EvaluationCaseSchema.parse(evaluationCase)));
}

function createSortedCaseCommitments(
  cases: readonly Gi088V8r3EvaluationCase[]
) {
  return cases
    .map((evaluationCase) => ({
      id: evaluationCase.id,
      fingerprint: createGi088V8r3CaseFingerprint(evaluationCase)
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function createGi088V8r3CaseSetCommitment(
  cases: readonly Gi088V8r3EvaluationCase[]
) {
  return sha256(
    JSON.stringify({
      version: "2026-08-11.gi088-v8r3-case-set-commitment-v1",
      caseCount: cases.length,
      cases: createSortedCaseCommitments(cases)
    })
  );
}

export function createGi088V8r3DatasetFingerprint(input: {
  deterministicRegression: readonly Gi088V8r3EvaluationCase[];
  development: readonly Gi088V8r3EvaluationCase[];
  hiddenAdmission: readonly Gi088V8r3EvaluationCase[];
}) {
  const validated = validateGi088V8r3DatasetPartitions(input);
  return sha256(
    JSON.stringify({
      datasetVersion: GI088_V8R3_EVALUATION_DATASET_VERSION,
      counts: validated.counts,
      sortedCaseCommitments: {
        deterministicRegression: createSortedCaseCommitments(
          input.deterministicRegression
        ),
        development: createSortedCaseCommitments(input.development)
      },
      privateHiddenAggregateCommitment: createGi088V8r3CaseSetCommitment(
        input.hiddenAdmission
      )
    })
  );
}

export function validateGi088V8r3DatasetPartitions(input: {
  deterministicRegression: readonly Gi088V8r3EvaluationCase[];
  development: readonly Gi088V8r3EvaluationCase[];
  hiddenAdmission: readonly Gi088V8r3EvaluationCase[];
}) {
  const parsed = {
    deterministicRegression: input.deterministicRegression.map((item) =>
      gi088V8r3EvaluationCaseSchema.parse(item)
    ),
    development: input.development.map((item) =>
      gi088V8r3EvaluationCaseSchema.parse(item)
    ),
    hiddenAdmission: input.hiddenAdmission.map((item) =>
      gi088V8r3EvaluationCaseSchema.parse(item)
    )
  };
  const expectedPartitions = [
    [parsed.deterministicRegression, "deterministic_regression"],
    [parsed.development, "development"],
    [parsed.hiddenAdmission, "hidden_admission"]
  ] as const;
  for (const [cases, expectedPartition] of expectedPartitions) {
    if (cases.some((item) => item.partition !== expectedPartition)) {
      throw new Error(`dataset contains an item outside ${expectedPartition}`);
    }
  }

  const allowedSources = {
    deterministic_regression: new Set([
      "frozen_product_boundary",
      "observed_preview_feedback"
    ]),
    development: new Set([
      "synthetic_development",
      "observed_preview_feedback"
    ]),
    hidden_admission: new Set(["fresh_hidden"])
  } as const;
  for (const evaluationCase of [
    ...parsed.deterministicRegression,
    ...parsed.development,
    ...parsed.hiddenAdmission
  ]) {
    if (!allowedSources[evaluationCase.partition].has(evaluationCase.source as never)) {
      throw new Error(
        `dataset source ${evaluationCase.source} is invalid for ${evaluationCase.partition}`
      );
    }
  }

  const developmentSingleTurn = parsed.development.filter(
    (item) => item.kind === "single_turn"
  );
  const developmentTrajectory = parsed.development.filter(
    (item) => item.kind === "trajectory"
  );
  const hiddenSingleTurn = parsed.hiddenAdmission.filter(
    (item) => item.kind === "single_turn"
  );
  const hiddenTrajectory = parsed.hiddenAdmission.filter(
    (item) => item.kind === "trajectory"
  );
  const actualCounts = {
    deterministicRegression: parsed.deterministicRegression.length,
    developmentSingleTurn: developmentSingleTurn.length,
    developmentTrajectory: developmentTrajectory.length,
    hiddenSingleTurn: hiddenSingleTurn.length,
    hiddenTrajectory: hiddenTrajectory.length
  };
  for (const [key, expected] of Object.entries(
    GI088_V8R3_EXPECTED_CASE_COUNTS
  )) {
    if (actualCounts[key as keyof typeof actualCounts] !== expected) {
      throw new Error(
        `${key} expected ${expected}, received ${actualCounts[key as keyof typeof actualCounts]}`
      );
    }
  }

  const allCases = [
    ...parsed.deterministicRegression,
    ...parsed.development,
    ...parsed.hiddenAdmission
  ];
  const ids = new Set<string>();
  const fingerprints = new Map<string, string>();
  for (const evaluationCase of allCases) {
    if (ids.has(evaluationCase.id)) {
      throw new Error(`duplicate case id: ${evaluationCase.id}`);
    }
    ids.add(evaluationCase.id);
    const fingerprint = createGi088V8r3CaseContentFingerprint(evaluationCase);
    const existing = fingerprints.get(fingerprint);
    if (existing) {
      throw new Error(
        `partition leakage: ${existing} and ${evaluationCase.id} share content`
      );
    }
    fingerprints.set(fingerprint, evaluationCase.id);
  }
  return {
    version: GI088_V8R3_EVALUATION_DATASET_VERSION,
    counts: actualCounts,
    totalCaseCount: allCases.length,
    uniqueCaseCount: ids.size,
    uniqueContentFingerprintCount: fingerprints.size
  };
}

export function getGi088V8r3ConversationAtCheckpoint(
  evaluationCase: Gi088V8r3EvaluationCase,
  checkpointIndex: number
) {
  const checkpoint = evaluationCase.checkpoints[checkpointIndex];
  if (!checkpoint) throw new Error("checkpoint does not exist");
  const messageIndex = evaluationCase.messages.findIndex(
    (message) => message.id === checkpoint.afterUserMessageId
  );
  if (messageIndex < 0) throw new Error("checkpoint message does not exist");
  return evaluationCase.messages.slice(0, messageIndex + 1);
}

export type Gi088V8r3PairedOutcome =
  | "pass"
  | "stable_failure"
  | "unstable_failure"
  | "uncertain";

export function summarizeGi088V8r3PassSquared(input: {
  cases: readonly Gi088V8r3EvaluationCase[];
  results: readonly Gi088V8r3TrialResult[];
}) {
  const parsedResults = input.results.map((result) =>
    gi088V8r3TrialResultSchema.parse(result)
  );
  const knownIds = new Set(input.cases.map((item) => item.id));
  const resultsByCase = new Map<string, Gi088V8r3TrialResult[]>();
  for (const result of parsedResults) {
    if (!knownIds.has(result.caseId)) {
      throw new Error(`result references unknown case ${result.caseId}`);
    }
    if (result.singleCaseBlocker && result.outcome === "pass") {
      throw new Error(`blocker result cannot pass: ${result.caseId}`);
    }
    const entries = resultsByCase.get(result.caseId) ?? [];
    entries.push(result);
    resultsByCase.set(result.caseId, entries);
  }

  const cases = input.cases.map((evaluationCase) => {
    const results = resultsByCase.get(evaluationCase.id) ?? [];
    const expectedAttempts =
      evaluationCase.partition === "deterministic_regression" ? [1] : [1, 2];
    const attempts = results.map((result) => result.attempt).sort();
    if (
      attempts.length !== expectedAttempts.length ||
      attempts.some((attempt, index) => attempt !== expectedAttempts[index])
    ) {
      throw new Error(
        `${evaluationCase.id} requires attempts ${expectedAttempts.join(",")}`
      );
    }
    let outcome: Gi088V8r3PairedOutcome;
    if (results.some((result) => result.outcome === "uncertain")) {
      outcome = "uncertain";
    } else if (results.every((result) => result.outcome === "pass")) {
      outcome = "pass";
    } else if (
      results.some((result) => result.outcome === "pass") &&
      results.some((result) => result.outcome === "fail")
    ) {
      outcome = "unstable_failure";
    } else {
      outcome = "stable_failure";
    }
    return {
      caseId: evaluationCase.id,
      attempts: results,
      outcome
    };
  });
  return {
    runnerVersion: GI088_V8R3_RUNNER_VERSION,
    cases,
    passCount: cases.filter((item) => item.outcome === "pass").length,
    stableFailureCount: cases.filter(
      (item) => item.outcome === "stable_failure"
    ).length,
    unstableFailureCount: cases.filter(
      (item) => item.outcome === "unstable_failure"
    ).length,
    uncertainCount: cases.filter((item) => item.outcome === "uncertain").length
  };
}

export function evaluateGi088V8r3HiddenQualityGate(input: {
  cases: readonly Gi088V8r3EvaluationCase[];
  results: readonly Gi088V8r3TrialResult[];
}) {
  const cases = input.cases.map((evaluationCase) => {
    const parsedCase = gi088V8r3EvaluationCaseSchema.parse(evaluationCase);
    if (parsedCase.partition !== "hidden_admission") {
      throw new Error("hidden quality gate accepts hidden admission cases only");
    }
    return parsedCase;
  });
  if (
    cases.length !==
    GI088_V8R3_EXPECTED_CASE_COUNTS.hiddenSingleTurn +
      GI088_V8R3_EXPECTED_CASE_COUNTS.hiddenTrajectory
  ) {
    throw new Error("hidden gate requires exactly 12 hidden cases");
  }
  const results = input.results;
  const parsed = results.map((result) =>
    gi088V8r3TrialResultSchema.parse(result)
  );
  if (parsed.length !== GI088_V8R3_HARD_GATES.hiddenResultCount) {
    throw new Error(
      `hidden gate requires ${GI088_V8R3_HARD_GATES.hiddenResultCount} results`
    );
  }
  const directUseCount = parsed.filter(
    (result) => result.quality === "direct_use"
  ).length;
  const minorIssueCount = parsed.filter(
    (result) => result.quality === "minor_issue"
  ).length;
  const qualityFailureCount = parsed.filter(
    (result) => result.quality === "quality_failure"
  ).length;
  const singleCaseBlockerCount = parsed.filter(
    (result) => result.singleCaseBlocker
  ).length;
  const paired = summarizeGi088V8r3PassSquared({ cases, results: parsed });
  const passed =
    paired.passCount === cases.length &&
    directUseCount >= GI088_V8R3_HARD_GATES.hiddenAcceptableMinimum &&
    minorIssueCount <= GI088_V8R3_HARD_GATES.hiddenMinorIssueMaximum &&
    qualityFailureCount <=
      GI088_V8R3_HARD_GATES.hiddenQualityFailureMaximum &&
    singleCaseBlockerCount <=
      GI088_V8R3_HARD_GATES.hiddenSingleCaseBlockerMaximum;
  return {
    passed,
    directUseCount,
    minorIssueCount,
    qualityFailureCount,
    singleCaseBlockerCount,
    passSquared: {
      passCount: paired.passCount,
      stableFailureCount: paired.stableFailureCount,
      unstableFailureCount: paired.unstableFailureCount,
      uncertainCount: paired.uncertainCount
    }
  };
}

export type Gi088V8r3ReliabilityEvidence = {
  firstValidRate: number;
  automaticRecoveryCount: number;
  manualRecoveryCount: number;
  finalFailureCount: number;
  finalProtectionCount: number;
  duplicateMessageCount: number;
  pendingTurnCount: number;
};

export function evaluateGi088V8r3ReliabilityGate(
  evidence: Gi088V8r3ReliabilityEvidence
) {
  const checks = {
    firstValidRate:
      evidence.firstValidRate >= GI088_V8R3_HARD_GATES.firstValidRateMinimum,
    automaticRecovery:
      evidence.automaticRecoveryCount <=
      GI088_V8R3_HARD_GATES.automaticRecoveryMaximum,
    manualRecovery:
      evidence.manualRecoveryCount <=
      GI088_V8R3_HARD_GATES.manualRecoveryMaximum,
    finalFailure:
      evidence.finalFailureCount <=
      GI088_V8R3_HARD_GATES.finalFailureMaximum,
    finalProtection:
      evidence.finalProtectionCount <=
      GI088_V8R3_HARD_GATES.finalProtectionMaximum,
    duplicateMessage:
      evidence.duplicateMessageCount <=
      GI088_V8R3_HARD_GATES.duplicateMessageMaximum,
    pendingTurn:
      evidence.pendingTurnCount <= GI088_V8R3_HARD_GATES.pendingTurnMaximum
  };
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    evidence
  };
}

function percentile(sorted: readonly number[], value: number) {
  if (sorted.length === 0) throw new Error("latency evidence is empty");
  const index = Math.max(0, Math.ceil(sorted.length * value) - 1);
  return sorted[index]!;
}

export function evaluateGi088V8r3LatencyGate(input: {
  latenciesMs: readonly number[];
  expectedSampleCount: number;
}) {
  const { latenciesMs, expectedSampleCount } = input;
  if (
    !Number.isInteger(expectedSampleCount) ||
    expectedSampleCount <= 0 ||
    latenciesMs.some((latency) => !Number.isFinite(latency) || latency < 0)
  ) {
    throw new Error("latency evidence contract is invalid");
  }
  const evidenceComplete = latenciesMs.length === expectedSampleCount;
  if (!evidenceComplete) {
    return {
      passed: false,
      checks: {
        evidenceComplete: false,
        p50: false,
        p90: false,
        maximum: false
      },
      evidence: {
        sampleCount: latenciesMs.length,
        expectedSampleCount,
        p50Ms: null,
        p90Ms: null,
        maximumMs: null
      }
    };
  }
  const sorted = [...latenciesMs].sort((left, right) => left - right);
  const evidence = {
    sampleCount: latenciesMs.length,
    expectedSampleCount,
    p50Ms: percentile(sorted, 0.5),
    p90Ms: percentile(sorted, 0.9),
    maximumMs: sorted.at(-1)!
  };
  const checks = {
    evidenceComplete: true,
    p50: evidence.p50Ms <= GI088_V8R3_HARD_GATES.latencyP50MaximumMs,
    p90: evidence.p90Ms <= GI088_V8R3_HARD_GATES.latencyP90MaximumMs,
    maximum:
      evidence.maximumMs <= GI088_V8R3_HARD_GATES.latencyMaximumMs
  };
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    evidence
  };
}

export function evaluateGi088V8r3IndependentAdmissionGates(input: {
  hiddenCases: readonly Gi088V8r3EvaluationCase[];
  hiddenResults: readonly Gi088V8r3TrialResult[];
  reliability: Gi088V8r3ReliabilityEvidence;
  latenciesMs: readonly number[];
  eligibleLatencySampleCount: number;
}) {
  const quality = evaluateGi088V8r3HiddenQualityGate({
    cases: input.hiddenCases,
    results: input.hiddenResults
  });
  const reliability = evaluateGi088V8r3ReliabilityGate(input.reliability);
  const latency = evaluateGi088V8r3LatencyGate({
    latenciesMs: input.latenciesMs,
    expectedSampleCount: input.eligibleLatencySampleCount
  });
  return {
    passed: quality.passed && reliability.passed && latency.passed,
    quality,
    reliability,
    latency
  };
}

function judgeRoundMetrics(round: Gi088V8r3JudgeCalibrationRound) {
  if (
    round.items.length !== GI088_V8R3_HARD_GATES.judgeGoldenSamplesPerRound
  ) {
    throw new Error(
      `${round.roundId} requires ${GI088_V8R3_HARD_GATES.judgeGoldenSamplesPerRound} Golden samples`
    );
  }
  const sampleIds = new Set(round.items.map((item) => item.sampleId));
  if (sampleIds.size !== round.items.length) {
    throw new Error(`${round.roundId} contains duplicate samples`);
  }
  const passFailAgreement =
    round.items.filter((item) => item.humanPass === item.judgePass).length /
    round.items.length;
  const blockerMissCount = round.items.filter(
    (item) => item.humanBlocker && !item.judgeBlocker
  ).length;
  const humanFailures = round.items.filter((item) => !item.humanPass);
  const failureCategoryAgreement =
    humanFailures.length === 0
      ? 1
      : humanFailures.filter(
          (item) =>
            item.humanFailureCategory === item.judgeFailureCategory
        ).length / humanFailures.length;
  const passed =
    passFailAgreement >=
      GI088_V8R3_HARD_GATES.judgePassFailAgreementMinimum &&
    blockerMissCount <= GI088_V8R3_HARD_GATES.judgeBlockerMissMaximum &&
    failureCategoryAgreement >=
      GI088_V8R3_HARD_GATES.judgeFailureCategoryAgreementMinimum;
  return {
    roundId: round.roundId,
    passed,
    passFailAgreement,
    blockerMissCount,
    failureCategoryAgreement,
    sampleIds
  };
}

export function evaluateGi088V8r3JudgeCalibration(
  rounds: readonly Gi088V8r3JudgeCalibrationRound[]
) {
  if (
    rounds.length < GI088_V8R3_HARD_GATES.judgeRequiredConsecutiveRounds
  ) {
    throw new Error("Judge calibration requires two consecutive rounds");
  }
  const selectedRounds = rounds.slice(
    -GI088_V8R3_HARD_GATES.judgeRequiredConsecutiveRounds
  );
  const metrics = selectedRounds.map(judgeRoundMetrics);
  const seenSamples = new Set<string>();
  for (const metric of metrics) {
    for (const sampleId of metric.sampleIds) {
      if (seenSamples.has(sampleId)) {
        throw new Error(`Golden sample reused across rounds: ${sampleId}`);
      }
      seenSamples.add(sampleId);
    }
  }
  return {
    promotedToDevelopmentPrescreen: metrics.every((round) => round.passed),
    rounds: metrics.map((round) => ({
      roundId: round.roundId,
      passed: round.passed,
      passFailAgreement: round.passFailAgreement,
      blockerMissCount: round.blockerMissCount,
      failureCategoryAgreement: round.failureCategoryAgreement
    }))
  };
}

export function createGi088V8r3BlindPair(input: {
  caseId: string;
  seed: string;
  candidateVersion: string;
  baselineVersion: string;
}) {
  const candidateFirst = Number.parseInt(
    sha256(`${input.seed}:${input.caseId}`).slice(0, 2),
    16
  ) % 2 === 0;
  return {
    caseId: input.caseId,
    a: candidateFirst ? input.candidateVersion : input.baselineVersion,
    b: candidateFirst ? input.baselineVersion : input.candidateVersion
  };
}

export type Gi088V8r3BadCaseFailure = {
  caseId: string;
  attempt: 1 | 2;
  artifactRef: string;
};

export type Gi088V8r3BadCaseAssignment = {
  caseId: string;
  attempt: 1 | 2;
  category: Gi088V8r3BadCaseCategory;
  productReviewer: string;
  rationale: string;
};

export function buildGi088V8r3BadCaseArchive(input: {
  failures: readonly Gi088V8r3BadCaseFailure[];
  assignments: readonly Gi088V8r3BadCaseAssignment[];
  reviewedAt: string;
}) {
  const key = (item: { caseId: string; attempt: number }) =>
    `${item.caseId}:${item.attempt}`;
  const assignments = new Map<string, Gi088V8r3BadCaseAssignment>();
  for (const assignment of input.assignments) {
    gi088V8r3BadCaseCategorySchema.parse(assignment.category);
    if (!assignment.productReviewer.trim() || !assignment.rationale.trim()) {
      throw new Error(`bad-case assignment requires reviewer and rationale`);
    }
    const assignmentKey = key(assignment);
    if (assignments.has(assignmentKey)) {
      throw new Error(`duplicate bad-case assignment: ${assignmentKey}`);
    }
    assignments.set(assignmentKey, assignment);
  }
  const entries = input.failures.map((failure) => {
    const assignmentKey = key(failure);
    const assignment = assignments.get(assignmentKey);
    if (!assignment) {
      throw new Error(`missing product adjudication: ${assignmentKey}`);
    }
    assignments.delete(assignmentKey);
    return {
      ...failure,
      category: assignment.category,
      productReviewer: assignment.productReviewer.trim(),
      rationale: assignment.rationale.trim()
    };
  });
  if (assignments.size > 0) {
    throw new Error(
      `assignment does not match a failure: ${assignments.keys().next().value}`
    );
  }
  return {
    version: "2026-08-11.gi088-v8r3-bad-case-archive-v1" as const,
    reviewedAt: input.reviewedAt,
    entries
  };
}
