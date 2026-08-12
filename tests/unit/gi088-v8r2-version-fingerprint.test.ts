import { describe, expect, it } from "vitest";

import {
  INTERVIEW_CONTROL_DECISION_VERSION,
  INTERVIEW_INTENT_CLASSIFIER_VERSION_V2
} from "../../src/features/interview/intent/control-decision-v2";
import {
  GI088_DATASET_MACHINE_GATE_V8R2,
  GI088_DATASET_MACHINE_GATE_V8R3,
  GI088_ADAPTIVE_RECOVERY_MACHINE_GATE_V8R3R3,
  GI088_ADAPTIVE_RECOVERY_POLICY,
  GI088_EVALUATION_ID,
  GI088_EVALUATION_VERSION,
  GI088_EVALUATION_VERSION_V8R1,
  GI088_GOVERNED_EVALUATION_VERSIONS,
  GI088_HISTORICAL_DATASET_FINGERPRINTS,
  GI088_SERVICE_VERSION,
  GI088_TASKS,
  GI088_TECHNICAL_CORRECTION_RECOVERY_POLICY,
  GI088_V8R3_OFFLINE_EVIDENCE_CONTRACT,
  GI088_V8R1_TASKS,
  GI088_V8R2_TASKS,
  createGi088DatasetFingerprint,
  createGi088EffectiveCandidateFingerprint,
  createGi088ExecutionFingerprint,
  createGi088ExperienceFingerprint,
  createGi088FingerprintBundle,
  createGi088RunnerFingerprint
} from "../../src/server/services/evaluation/gi088/candidate";
import {
  GI088_BEHAVIOR_FILE_SPECS,
  GI088_BEHAVIOR_MANIFEST,
  createGi088BehaviorManifest,
  type Gi088BehaviorManifest
} from "../../src/server/services/evaluation/gi088/behavior-manifest";
import { GI088_DETERMINISTIC_STATE_POLICY_VERSION } from "../../src/server/services/evaluation/gi088/deterministic-state";
import { GI088_QUESTION_DECISION_SKILL_VERSION } from "../../src/server/services/evaluation/gi088/question-decision";
import { GI088_SEMANTIC_DELTA_CONTRACT_VERSION } from "../../src/server/services/evaluation/gi088/semantic-delta";
import {
  GI088_V8R2_VERSION_MANIFEST,
  GI088_V8R3_VERSION_MANIFEST,
  GI088_V8R3R3_VERSION_MANIFEST,
  GI088_EVALUATION_ID_V8R1,
  GI088_SERVICE_VERSION_V8R1
} from "../../src/server/services/evaluation/gi088/version-manifest";

function replaceFileHash(
  manifest: Gi088BehaviorManifest,
  path: string
): Gi088BehaviorManifest {
  return {
    ...manifest,
    files: manifest.files.map((entry) => entry.path === path
      ? {
          ...entry,
          sha256: `${entry.sha256[0] === "a" ? "b" : "a"}${entry.sha256.slice(1)}`
        }
      : entry)
  };
}

describe("GI-088 v8r2 version, dataset and layered fingerprints", () => {
  it("固化第 4 节全部版本并保留 v8r1 身份", () => {
    expect(GI088_V8R2_VERSION_MANIFEST).toEqual({
      evaluationId: "gi088_human_eval_v8r2_foundation_hardening",
      evaluation: "2026-08-10.gi088-human-eval-v8r2-foundation-hardening",
      service: "2026-08-10.gi088-evaluation-foundation-service-v8r2",
      controlDecision: "2026-08-10.interview-control-decision-v2",
      intentClassifier: "2026-08-10.interview-intent-v2",
      deterministicState:
        "2026-08-10.gi088-deterministic-state-maintenance-v2.2",
      semanticDelta: "2026-08-10.gi088-semantic-delta-contract-v2.4",
      questionDecision:
        "2026-08-10.gi088-question-decision-skill-v1.1",
      sharedRecoveryDeadline:
        "2026-08-10.gi088-shared-recovery-deadline-v3",
      evaluationStore: "2026-08-10.gi088-evaluation-store-v2",
      metrics: "2026-08-10.gi088-evaluation-metrics-v1",
      programInterventionReview:
        "2026-08-10.gi088-program-intervention-review-v1",
      readonlyExport: "2026-08-10.gi088-readonly-export-v0.6",
      behaviorManifest: "2026-08-10.gi088-behavior-manifest-v1"
    });
    expect({
      id: GI088_EVALUATION_ID,
      evaluation: GI088_EVALUATION_VERSION,
      service: GI088_SERVICE_VERSION
    }).toEqual({
      id: GI088_V8R3R3_VERSION_MANIFEST.evaluationId,
      evaluation: GI088_V8R3R3_VERSION_MANIFEST.evaluation,
      service: GI088_V8R3R3_VERSION_MANIFEST.service
    });
    expect({
      id: GI088_EVALUATION_ID_V8R1,
      evaluation: GI088_EVALUATION_VERSION_V8R1,
      service: GI088_SERVICE_VERSION_V8R1
    }).toEqual({
      id: "gi088_human_eval_v8r1_final12",
      evaluation: "2026-08-10.gi088-human-eval-v8r1-final12",
      service: "2026-08-10.gi088-question-decision-service-v8r1"
    });
    expect(INTERVIEW_CONTROL_DECISION_VERSION).toBe(
      GI088_V8R2_VERSION_MANIFEST.controlDecision
    );
    expect(INTERVIEW_INTENT_CLASSIFIER_VERSION_V2).toBe(
      GI088_V8R2_VERSION_MANIFEST.intentClassifier
    );
    expect(GI088_DETERMINISTIC_STATE_POLICY_VERSION).toBe(
      GI088_V8R2_VERSION_MANIFEST.deterministicState
    );
    expect(GI088_SEMANTIC_DELTA_CONTRACT_VERSION).toBe(
      GI088_V8R2_VERSION_MANIFEST.semanticDelta
    );
    expect(GI088_QUESTION_DECISION_SKILL_VERSION).toBe(
      GI088_V8R2_VERSION_MANIFEST.questionDecision
    );
    expect(GI088_V8R3_VERSION_MANIFEST).not.toHaveProperty(
      "questionDecision"
    );
    expect(GI088_V8R3_VERSION_MANIFEST).toMatchObject({
      interviewSkill: "2026-08-11.gi088-interview-skill-v8r3",
      questionValueReview: "2026-08-11.gi088-question-value-review-v1",
      runtime: "2026-08-11.gi088-ark-flash-runtime-v2",
      payloadContract: "2026-08-11.gi088-ark-openai-json-v1"
    });
    expect(
      GI088_BEHAVIOR_FILE_SPECS.some(
        (spec) => spec.path.endsWith("/question-decision.ts")
      )
    ).toBe(false);
    expect(GI088_GOVERNED_EVALUATION_VERSIONS).toContain(
      GI088_EVALUATION_VERSION_V8R1
    );
    expect(GI088_GOVERNED_EVALUATION_VERSIONS).toContain(
      GI088_V8R2_VERSION_MANIFEST.evaluation
    );
  });

  it("冻结 v8r1 任务包并把 A1、A6、A9、A12 更新到 v8r2 口径", () => {
    expect(GI088_V8R1_TASKS).toHaveLength(12);
    expect(GI088_V8R2_TASKS).toHaveLength(12);
    expect(GI088_V8R1_TASKS[0].targetTriggerPrompt).not.toContain(
      "跟奶奶解释很累"
    );
    expect(GI088_V8R2_TASKS[0].targetTriggerPrompt).toContain("跟奶奶解释很累");
    expect(GI088_V8R2_TASKS[0].criterion).toContain("只有最后明确停止当前访谈时");
    expect(GI088_V8R2_TASKS[5].criterion).toContain("不自主暂停");
    expect(GI088_V8R2_TASKS[5].criterion).toContain("只有用户最后明确停止时");
    expect(GI088_V8R2_TASKS[8].criterion).toContain("必须继续提出一个");
    expect(GI088_V8R2_TASKS[8].criterion).toContain("明确停止前不得输出 pause");
    expect(GI088_V8R2_TASKS[11].instruction).toContain("至少完成八次用户提交");
    expect(GI088_DATASET_MACHINE_GATE_V8R2).toMatchObject({
      requiredTargetTriggerCount: 12,
      minimumDirectUseCount: 9,
      maximumMinorIssueCount: 3,
      minimumFirstVisibleSuccessRate: 0.9,
      maximumAutomaticRecoveryCount: 1,
      automaticRecoveryDeadlineMs: 90_000
    });
  });

  it("v8r3 当前任务冻结为 4 条计分轨迹与 2 条零模型兼容冒烟", () => {
    expect(GI088_TASKS).toHaveLength(6);
    expect(
      GI088_TASKS.filter((task) => task.evaluationRole === "scored_trajectory")
    ).toHaveLength(4);
    expect(
      GI088_TASKS.filter((task) => task.evaluationRole === "compatibility_smoke")
    ).toHaveLength(2);
    expect(GI088_TASKS[4].criterion).toContain("Provider 调用数保持 0");
    expect(GI088_TASKS[5].criterion).toContain("Provider 调用数保持 0");
    expect(GI088_DATASET_MACHINE_GATE_V8R3).toMatchObject({
      requiredScoredTrajectoryCount: 4,
      requiredCompatibilitySmokeCount: 2,
      requiredTargetTriggerCount: 4,
      totalTaskCount: 6,
      minimumFirstVisibleSuccessRate: 0.85,
      maximumAutomaticRecoveryCount: 2
    });
  });

  it("v8r3r3 以 30/60 用户结果门替换旧恢复总数门，并保留真实技术纠正", () => {
    expect(GI088_TECHNICAL_CORRECTION_RECOVERY_POLICY).toMatchObject({
      maximumAutomaticRetriesPerTurn: 1,
      maximumProviderCallsPerTurn: 2,
      sharedAutomaticChainDeadlineMs: 60_000
    });
    expect(Object.keys(
      GI088_TECHNICAL_CORRECTION_RECOVERY_POLICY.corrections
    )).not.toContain("ASK_QUESTION_COUNT_INVALID:2");
    expect(Object.values(
      GI088_TECHNICAL_CORRECTION_RECOVERY_POLICY.corrections
    ).every((item) => item.instruction.length > 20)).toBe(true);
    expect(GI088_V8R3_OFFLINE_EVIDENCE_CONTRACT).toMatchObject({
      optionalAdmissionBinding: "admissionFingerprint",
      recoveryEvidenceScope: "offline_and_preview_reported_independently",
      immutableAfterRunCreation: true
    });
    expect(GI088_ADAPTIVE_RECOVERY_POLICY).toMatchObject({
      accelerationAfterMs: 30_000,
      hardDeadlineMs: 60_000,
      maximumAutomaticProviderCallsPerCycle: 3,
      winnerPolicy: "first_fully_valid_output"
    });
    expect(GI088_ADAPTIVE_RECOVERY_MACHINE_GATE_V8R3R3).toMatchObject({
      requiredAutomaticFinalVisibleRate: 1,
      maximumVisibleLatencyP50Ms: 20_000,
      maximumVisibleLatencyP90Ms: 40_000,
      maximumVisibleLatencyMs: 60_000,
      firstVisibleSuccessRate: "diagnostic_only",
      recoveryCount: "diagnostic_only"
    });
  });

  it("历史数据集指纹读取不可变映射，不再使用当前任务反推", () => {
    for (const [version, fingerprint] of Object.entries(
      GI088_HISTORICAL_DATASET_FINGERPRINTS
    )) {
      expect(createGi088DatasetFingerprint(version)).toBe(fingerprint);
    }
    expect(createGi088DatasetFingerprint(GI088_EVALUATION_VERSION_V8R1)).toBe(
      "0ca2452690aa9e89b2414689bb7c96294a4fa9283359c01f3a45ca1c4b7478a7"
    );
    expect(() => createGi088DatasetFingerprint("unknown-version")).toThrow(
      "GI088_DATASET_VERSION_UNSUPPORTED:unknown-version"
    );
  });

  it("四层与 execution 指纹稳定生成且排除部署结果字段", () => {
    const bundle = createGi088FingerprintBundle();
    expect(bundle).toEqual({
      behaviorManifestVersion: GI088_V8R3R3_VERSION_MANIFEST.behaviorManifest,
      behaviorManifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      candidateFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      datasetFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      runnerFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      experienceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      executionFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u)
    });
    expect(bundle).not.toHaveProperty("commitSha");
    expect(bundle).not.toHaveProperty("buildId");
    expect(bundle).not.toHaveProperty("deploymentId");
  });

  it("行为文件变化传播到对应分层指纹和 execution", () => {
    const candidateChanged = replaceFileHash(
      GI088_BEHAVIOR_MANIFEST,
      "src/server/services/evaluation/gi088/v8r3-interview-skill.ts"
    );
    expect(createGi088EffectiveCandidateFingerprint(candidateChanged)).not.toBe(
      createGi088EffectiveCandidateFingerprint()
    );
    expect(createGi088RunnerFingerprint(candidateChanged)).toBe(
      createGi088RunnerFingerprint()
    );
    expect(createGi088ExperienceFingerprint(candidateChanged)).toBe(
      createGi088ExperienceFingerprint()
    );
    expect(createGi088ExecutionFingerprint(candidateChanged)).not.toBe(
      createGi088ExecutionFingerprint()
    );

    const experienceChanged = replaceFileHash(
      GI088_BEHAVIOR_MANIFEST,
      "src/features/interview/event-centered/gi088-evaluation-client.ts"
    );
    expect(createGi088ExperienceFingerprint(experienceChanged)).not.toBe(
      createGi088ExperienceFingerprint()
    );
    expect(createGi088EffectiveCandidateFingerprint(experienceChanged)).toBe(
      createGi088EffectiveCandidateFingerprint()
    );
    expect(createGi088ExecutionFingerprint(experienceChanged)).not.toBe(
      createGi088ExecutionFingerprint()
    );
  });

  it("v8r3 Skill、离线评测、兼容证据和帮我记链路进入对应分层", () => {
    const specs = new Map(
      GI088_BEHAVIOR_FILE_SPECS.map((spec) => [spec.path, [...spec.layers]])
    );
    expect(
      specs.get("skills/conduct-daily-light-thinking-interview/agents/openai.yaml")
    ).toEqual(["candidate"]);
    expect(
      specs.get(
        "evals/event-centered-generative/gi088-v8r3-skill-evaluation/contracts.ts"
      )
    ).toEqual(["dataset", "runner"]);
    expect(
      specs.get(
        "evals/event-centered-generative/gi088-v8r3-skill-evaluation/offline-executor.ts"
      )
    ).toEqual(["runner"]);
    expect(
      specs.get("scripts/run-gi088-v8r3-offline-evaluation.ts")
    ).toEqual(["runner"]);
    expect(
      specs.get("src/server/services/evaluation/gi088/compatibility-evidence.ts")
    ).toEqual(["runner"]);
    expect(
      specs.get("src/app/api/preview/gi088/compatibility-smoke/route.ts")
    ).toEqual(["runner", "experience"]);
    expect(
      specs.get("src/features/interview/event-centered/capture-mode.ts")
    ).toEqual(["runner", "experience"]);
    expect(
      specs.get("src/features/interview/event-centered/gi088-compatibility-receipt.ts")
    ).toEqual(["experience"]);
    expect(specs.get("prisma/schema.prisma")).toEqual(["experience"]);
    expect(
      specs.get("src/server/services/interview/event-centered-interview.service.ts")
    ).toEqual(["experience"]);

    const offlineRunnerChanged = replaceFileHash(
      GI088_BEHAVIOR_MANIFEST,
      "evals/event-centered-generative/gi088-v8r3-skill-evaluation/offline-executor.ts"
    );
    expect(createGi088RunnerFingerprint(offlineRunnerChanged)).not.toBe(
      createGi088RunnerFingerprint()
    );
    expect(createGi088DatasetFingerprint(undefined, offlineRunnerChanged)).toBe(
      createGi088DatasetFingerprint()
    );
    expect(createGi088ExecutionFingerprint(offlineRunnerChanged)).not.toBe(
      createGi088ExecutionFingerprint()
    );
  });

  it("未来行为文件可注入，缺失内容以明确错误失败", () => {
    const fileContents = Object.fromEntries(
      GI088_BEHAVIOR_FILE_SPECS.map((spec) => [spec.path, `source:${spec.path}`])
    );
    const futureSpec = {
      path: "src/server/services/evaluation/gi088/future-finalizer.ts",
      layers: ["runner"] as const
    };
    expect(() => createGi088BehaviorManifest({
      fileContents,
      additionalFileSpecs: [futureSpec]
    })).toThrow(`GI088_BEHAVIOR_FILE_MISSING:${futureSpec.path}`);

    const extended = createGi088BehaviorManifest({
      fileContents: {
        ...fileContents,
        [futureSpec.path]: "future finalizer source"
      },
      additionalFileSpecs: [futureSpec]
    });
    expect(extended.files).toContainEqual(expect.objectContaining({
      path: futureSpec.path,
      layers: ["runner"],
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/u)
    }));
  });
});
