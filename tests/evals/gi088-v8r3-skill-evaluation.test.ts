import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  GI088_V8R3_DEVELOPMENT_CASES
} from "../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/development-fixtures";
import {
  GI088_V8R3_DETERMINISTIC_REGRESSION_CASES
} from "../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/regression-fixtures";
import {
  buildGi088V8r3BadCaseArchive,
  createGi088V8r3CaseSetCommitment,
  createGi088V8r3DatasetFingerprint,
  evaluateGi088V8r3HiddenQualityGate,
  evaluateGi088V8r3IndependentAdmissionGates,
  evaluateGi088V8r3JudgeCalibration,
  evaluateGi088V8r3LatencyGate,
  evaluateGi088V8r3ReliabilityGate,
  summarizeGi088V8r3PassSquared,
  validateGi088V8r3DatasetPartitions
} from "../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/runner";
import { GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES } from "./fixtures/gi088-v8r3-test-hidden-fixtures";
import type {
  Gi088V8r3EvaluationCase,
  Gi088V8r3JudgeCalibrationRound,
  Gi088V8r3TrialResult
} from "../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/contracts";

function result(
  caseId: Gi088V8r3TrialResult["caseId"],
  attempt: 1 | 2,
  override: Partial<Gi088V8r3TrialResult> = {}
): Gi088V8r3TrialResult {
  return {
    caseId,
    attempt,
    outcome: "pass",
    quality: "direct_use",
    singleCaseBlocker: false,
    primaryFailureCategory: "none",
    ...override
  };
}

function pairedResults(cases: readonly Gi088V8r3EvaluationCase[]) {
  return cases.flatMap((evaluationCase) => [
    result(evaluationCase.id, 1),
    result(evaluationCase.id, 2)
  ]);
}

function goldenRound(prefix: string): Gi088V8r3JudgeCalibrationRound {
  return {
    roundId: prefix,
    items: Array.from({ length: 20 }, (_, index) => {
      const humanPass = index < 15;
      return {
        sampleId: `${prefix}-${index + 1}`,
        humanPass,
        judgePass: index === 0 ? false : humanPass,
        humanBlocker: index === 19,
        judgeBlocker: index === 19,
        humanFailureCategory: humanPass ? "none" : "value",
        judgeFailureCategory: index === 15 ? "burden" : humanPass ? "none" : "value"
      };
    })
  };
}

describe("GI-088 v8r3 versioned evaluation assets", () => {
  it("locks the 24, 24+4, and 8+4 partitions with unique content", () => {
    expect(
      validateGi088V8r3DatasetPartitions({
        deterministicRegression:
          GI088_V8R3_DETERMINISTIC_REGRESSION_CASES,
        development: GI088_V8R3_DEVELOPMENT_CASES,
        hiddenAdmission: GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES
      })
    ).toEqual({
      version: "2026-08-11.gi088-v8r3-skill-evaluation-v2",
      counts: {
        deterministicRegression: 24,
        developmentSingleTurn: 24,
        developmentTrajectory: 4,
        hiddenSingleTurn: 8,
        hiddenTrajectory: 4
      },
      totalCaseCount: 64,
      uniqueCaseCount: 64,
      uniqueContentFingerprintCount: 64
    });
  });

  it("rejects content copied across development and hidden admission", () => {
    const copiedHiddenCase = {
      ...GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES[0],
      id: GI088_V8R3_DEVELOPMENT_CASES[0].id,
      partition: "development",
      source: "synthetic_development"
    } as Gi088V8r3EvaluationCase;
    expect(() =>
      validateGi088V8r3DatasetPartitions({
        deterministicRegression:
          GI088_V8R3_DETERMINISTIC_REGRESSION_CASES,
        development: [
          copiedHiddenCase,
          ...GI088_V8R3_DEVELOPMENT_CASES.slice(1)
        ],
        hiddenAdmission: GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES
      })
    ).toThrow(/partition leakage/u);
  });

  it("fingerprints sorted public cases and one private-hidden aggregate commitment", () => {
    const base = {
      deterministicRegression: GI088_V8R3_DETERMINISTIC_REGRESSION_CASES,
      development: GI088_V8R3_DEVELOPMENT_CASES,
      hiddenAdmission: GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES
    };
    const first = createGi088V8r3DatasetFingerprint(base);
    expect(
      createGi088V8r3DatasetFingerprint({
        deterministicRegression: [...base.deterministicRegression].reverse(),
        development: [...base.development].reverse(),
        hiddenAdmission: [...base.hiddenAdmission].reverse()
      })
    ).toBe(first);
    const changedCheckpoint = {
      ...GI088_V8R3_DEVELOPMENT_CASES[0],
      checkpoints: GI088_V8R3_DEVELOPMENT_CASES[0].checkpoints.map(
        (checkpoint, index) =>
          index === 0
            ? {
                ...checkpoint,
                expectedValueClassification: "uncertain" as const
              }
            : checkpoint
      )
    };
    expect(
      createGi088V8r3DatasetFingerprint({
        ...base,
        development: [
          changedCheckpoint,
          ...GI088_V8R3_DEVELOPMENT_CASES.slice(1)
        ]
      })
    ).not.toBe(first);

    const changedHidden = {
      ...GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES[0],
      messages: GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES[0].messages.map(
        (message, index) =>
          index === 0 ? { ...message, content: `${message.content} 新增线索。` } : message
      )
    };
    const changedHiddenCases = [
      changedHidden,
      ...GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES.slice(1)
    ];
    expect(createGi088V8r3CaseSetCommitment(changedHiddenCases)).not.toBe(
      createGi088V8r3CaseSetCommitment(base.hiddenAdmission)
    );
    expect(
      createGi088V8r3DatasetFingerprint({
        ...base,
        hiddenAdmission: changedHiddenCases
      })
    ).not.toBe(first);
  });

  it("keeps hidden fixtures out of the public runtime and evaluation entrypoints", () => {
    const runtimeSource = readFileSync(
      resolve(
        process.cwd(),
        "src/server/services/evaluation/gi088/v8r3-interview-skill.ts"
      ),
      "utf8"
    );
    const publicEvaluationEntry = readFileSync(
      resolve(
        process.cwd(),
        "evals/event-centered-generative/gi088-v8r3-skill-evaluation/index.ts"
      ),
      "utf8"
    );
    const publicHiddenContract = readFileSync(
      resolve(
        process.cwd(),
        "evals/event-centered-generative/gi088-v8r3-skill-evaluation/hidden-fixtures.ts"
      ),
      "utf8"
    );
    expect(runtimeSource).not.toContain("hidden-fixtures");
    expect(publicEvaluationEntry).not.toContain("hidden-fixtures");
    expect(publicHiddenContract).toContain(
      "GI088_V8R3_PRIVATE_HIDDEN_AGGREGATE_COMMITMENT"
    );
    expect(publicHiddenContract).not.toContain("GI088-V8R3-H01");
    expect(publicHiddenContract).not.toContain(
      "PRIVATE_HIDDEN_CASE_FINGERPRINTS"
    );
  });

  it("keeps observed feedback controls in regression or development only", () => {
    const observedIds = [
      ...GI088_V8R3_DETERMINISTIC_REGRESSION_CASES,
      ...GI088_V8R3_DEVELOPMENT_CASES
    ]
      .filter((evaluationCase) =>
        evaluationCase.source === "observed_preview_feedback"
      )
      .map((evaluationCase) => evaluationCase.id);
    expect(observedIds).toEqual(
      expect.arrayContaining([
        "GI088-V8R3-R01",
        "GI088-V8R3-R02",
        "GI088-V8R3-R03",
        "GI088-V8R3-R04",
        "GI088-V8R3-D01",
        "GI088-V8R3-D02"
      ])
    );
    expect(
      GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES.every(
        (evaluationCase) => evaluationCase.source === "fresh_hidden"
      )
    ).toBe(true);
  });

  it("requires two passing trials and labels a split result unstable", () => {
    const passing = pairedResults(GI088_V8R3_DEVELOPMENT_CASES);
    expect(
      summarizeGi088V8r3PassSquared({
        cases: GI088_V8R3_DEVELOPMENT_CASES,
        results: passing
      }).passCount
    ).toBe(28);

    const split = passing.map((item) =>
      item.caseId === GI088_V8R3_DEVELOPMENT_CASES[0].id && item.attempt === 2
        ? result(item.caseId, 2, {
            outcome: "fail",
            quality: "quality_failure",
            primaryFailureCategory: "low_information_gain"
          })
        : item
    );
    const summary = summarizeGi088V8r3PassSquared({
      cases: GI088_V8R3_DEVELOPMENT_CASES,
      results: split
    });
    expect(summary.passCount).toBe(27);
    expect(summary.unstableFailureCount).toBe(1);
    expect(() =>
      summarizeGi088V8r3PassSquared({
        cases: GI088_V8R3_DEVELOPMENT_CASES,
        results: passing.map((item, index) =>
          index === 0
            ? {
                ...item,
                outcome: "fail" as const,
                quality: "direct_use" as const
              }
            : item
        )
      })
    ).toThrow();
  });

  it("runs deterministic boundaries exactly once", () => {
    const once = GI088_V8R3_DETERMINISTIC_REGRESSION_CASES.map(
      (evaluationCase) => result(evaluationCase.id, 1)
    );
    expect(
      summarizeGi088V8r3PassSquared({
        cases: GI088_V8R3_DETERMINISTIC_REGRESSION_CASES,
        results: once
      }).passCount
    ).toBe(24);
    expect(() =>
      summarizeGi088V8r3PassSquared({
        cases: GI088_V8R3_DETERMINISTIC_REGRESSION_CASES,
        results: [
          ...once,
          result(GI088_V8R3_DETERMINISTIC_REGRESSION_CASES[0].id, 2)
        ]
      })
    ).toThrow(/requires attempts 1/u);
  });

  it("applies the hidden quality threshold without cross-gate compensation", () => {
    const hiddenResults = pairedResults(GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES).map(
      (item, index) =>
        index >= 22
          ? {
              ...item,
              quality: "minor_issue" as const,
              primaryFailureCategory: "low_information_gain" as const
            }
          : item
    );
    expect(evaluateGi088V8r3HiddenQualityGate({
      cases: GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES,
      results: hiddenResults
    })).toMatchObject({
      passed: true,
      directUseCount: 22,
      minorIssueCount: 2,
      qualityFailureCount: 0,
      singleCaseBlockerCount: 0
    });
    expect(
      evaluateGi088V8r3IndependentAdmissionGates({
        hiddenCases: GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES,
        hiddenResults,
        reliability: {
          firstValidRate: 0.84,
          automaticRecoveryCount: 0,
          manualRecoveryCount: 0,
          finalFailureCount: 0,
          finalProtectionCount: 0,
          duplicateMessageCount: 0,
          pendingTurnCount: 0
        },
        latenciesMs: [10_000, 15_000, 18_000],
        eligibleLatencySampleCount: 3
      }).passed
    ).toBe(false);
    expect(
      evaluateGi088V8r3HiddenQualityGate({
        cases: GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES,
        results: hiddenResults.map((item, index) =>
          index === 0
            ? {
                ...item,
                outcome: "fail" as const,
                quality: "quality_failure" as const,
                primaryFailureCategory: "working_task_drift" as const
              }
            : item
        )
      }
      ).passed
    ).toBe(false);
    expect(() =>
      evaluateGi088V8r3HiddenQualityGate({
        cases: GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES,
        results: [
          ...hiddenResults.slice(0, -1),
          { ...hiddenResults[0]!, attempt: 1 }
        ]
      })
    ).toThrow(/requires attempts/u);
  });

  it("fails reliability on any final failure and latency on any missing checkpoint sample", () => {
    expect(
      evaluateGi088V8r3ReliabilityGate({
        firstValidRate: 0.99,
        automaticRecoveryCount: 0,
        manualRecoveryCount: 0,
        finalFailureCount: 1,
        finalProtectionCount: 0,
        duplicateMessageCount: 0,
        pendingTurnCount: 0
      })
    ).toMatchObject({ passed: false, checks: { finalFailure: false } });
    expect(
      evaluateGi088V8r3LatencyGate({
        latenciesMs: [10_000, 12_000],
        expectedSampleCount: 3
      })
    ).toMatchObject({
      passed: false,
      checks: { evidenceComplete: false },
      evidence: { sampleCount: 2, expectedSampleCount: 3 }
    });
  });

  it("promotes Judge only after two fresh passing Golden rounds", () => {
    const first = goldenRound("golden-a");
    const second = goldenRound("golden-b");
    expect(
      evaluateGi088V8r3JudgeCalibration([first, second])
        .promotedToDevelopmentPrescreen
    ).toBe(true);
    expect(() =>
      evaluateGi088V8r3JudgeCalibration([
        first,
        { ...second, items: [...first.items] }
      ])
    ).toThrow(/reused across rounds/u);
    const blockerMiss = {
      ...second,
      items: second.items.map((item, index) =>
        index === 19 ? { ...item, judgeBlocker: false } : item
      )
    };
    expect(
      evaluateGi088V8r3JudgeCalibration([first, blockerMiss])
        .promotedToDevelopmentPrescreen
    ).toBe(false);
  });

  it("requires one explicit product assignment for every bad case", () => {
    const failures = [
      { caseId: "GI088-V8R3-D01", attempt: 1 as const, artifactRef: "run:a" },
      { caseId: "GI088-V8R3-D02", attempt: 2 as const, artifactRef: "run:b" }
    ];
    expect(() =>
      buildGi088V8r3BadCaseArchive({
        failures,
        assignments: [],
        reviewedAt: "2026-08-11T00:00:00.000Z"
      })
    ).toThrow(/missing product adjudication/u);
    expect(
      buildGi088V8r3BadCaseArchive({
        failures,
        assignments: [
          {
            caseId: "GI088-V8R3-D01",
            attempt: 1,
            category: "skill_core_principle",
            productReviewer: "product-owner",
            rationale: "核心问题价值条件未执行"
          },
          {
            caseId: "GI088-V8R3-D02",
            attempt: 2,
            category: "program_hard_boundary",
            productReviewer: "product-owner",
            rationale: "恢复链需要程序保护"
          }
        ],
        reviewedAt: "2026-08-11T00:00:00.000Z"
      }).entries
    ).toHaveLength(2);
  });
});
