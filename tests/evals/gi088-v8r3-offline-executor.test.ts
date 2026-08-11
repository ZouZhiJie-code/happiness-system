import { describe, expect, it } from "vitest";

import { GI088_V8R3_DEVELOPMENT_CASES } from "../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/development-fixtures";
import {
  GI088_V8R3_FORMAL_CALL_BUDGET,
  GI088_V8R3_ALLOWED_HISTORICAL_CANDIDATE_VERSION,
  GI088_V8R3_HISTORICAL_BASELINE_VERSION,
  buildGi088V8r3BadCasePacket,
  buildGi088V8r3BlindComparisonPacket,
  buildGi088V8r3HumanAdjudicationPacket,
  createGi088V8r3ArkProviderIdentity,
  createGi088V8r3CandidateCompletionParams,
  createGi088V8r3CandidateRequestHashPayload,
  createGi088V8r3OfflineTurnInput,
  createGi088V8r3HistoricalBaselineEvidenceFingerprint,
  createGi088V8r3HistoricalBaselineModelIdentity,
  createGi088V8r3HistoricalBaselineRecordFingerprint,
  createGi088V8r3JudgeCompletionParams,
  createGi088V8r3JudgeContentFingerprint,
  createGi088V8r3OfflineExecutionPlan,
  createGi088V8r3ProProviderIdentity,
  evaluateGi088V8r3CandidateOperationalGates,
  executeGi088V8r3Admission,
  executeGi088V8r3BadCaseArchive,
  executeGi088V8r3CandidateEvaluation,
  executeGi088V8r3JudgeCalibration,
  executeGi088V8r3JudgeDevelopmentPrescreen,
  parseGi088V8r3CandidateExecutionReport,
  parseGi088V8r3AdmissionReport,
  parseGi088V8r3HistoricalBaselineReport,
  parseGi088V8r3JudgePrescreenReport,
  parseGi088V8r3JudgeGoldenFile,
  runGi088V8r3DeterministicRegression,
  validateGi088V8r3CandidateOutput,
  type Gi088V8r3JudgeGoldenFile
} from "../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/offline-executor";
import { GI088_V8R3_DETERMINISTIC_REGRESSION_CASES } from "../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/regression-fixtures";
import { GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES } from "./fixtures/gi088-v8r3-test-hidden-fixtures";
import { createGi088V8r3DatasetFingerprint } from "../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/runner";
import {
  AIProviderError,
  type AICompletionResult,
  AICompletionParams,
  type AIProvider
} from "@/server/services/ai/ai-provider";
import { createGi088FingerprintBundle } from "@/server/services/evaluation/gi088/candidate";

const PRIVATE_HIDDEN_FILE_SHA256 = "f".repeat(64);
const TEST_DATASET_FINGERPRINT = createGi088V8r3DatasetFingerprint({
  deterministicRegression: GI088_V8R3_DETERMINISTIC_REGRESSION_CASES,
  development: GI088_V8R3_DEVELOPMENT_CASES,
  hiddenAdmission: GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES
});

function candidateInput(provider: AIProvider) {
  return {
    provider,
    providerIdentity: createGi088V8r3ArkProviderIdentity(),
    deterministicRegression: GI088_V8R3_DETERMINISTIC_REGRESSION_CASES,
    developmentCases: GI088_V8R3_DEVELOPMENT_CASES,
    hiddenAdmissionCases: GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES,
    privateHiddenFileSha256: PRIVATE_HIDDEN_FILE_SHA256,
    concurrency: 1,
    runId: "test-run",
    now: () => new Date("2026-08-11T00:00:00.000Z")
  } as const;
}

function technicalFailureProvider(seen: AICompletionParams[] = []): AIProvider {
  return {
    name: "openai",
    async complete(params) {
      seen.push(params);
      throw new AIProviderError("TEST_TIMEOUT", "TIMEOUT");
    }
  };
}

function validCandidateResult(params: AICompletionParams): AICompletionResult {
  const modelInput = JSON.parse(params.messages.at(-1)!.content) as {
    latestUserMessageId: string;
    semanticContext: {
      workingTask: { ref: string; summary: string };
    };
  };
  const stopRequested = params.messages.some((message) =>
    message.content.includes('"finalAction":"stop_follow_up"')
  );
  const action = stopRequested ? "pause" : "ask";
  return {
    content: JSON.stringify({
      semantic: {
        stage: "explore_clarify",
        action,
        workingTask: {
          continuity: "continue",
          targetRef: modelInput.semanticContext.workingTask.ref,
          summary: modelInput.semanticContext.workingTask.summary,
          evidenceRefs: [modelInput.latestUserMessageId]
        },
        understandingChange: { kind: "none" },
        invalidatedRefs: [],
        returnableTaskDelta: { preserveRefs: [], add: [] },
        nextInquiry: stopRequested
          ? null
          : {
              answerTarget: "补充一个推进当前共同任务的具体线索",
              taskEffect: "用新线索更新当前共同任务",
              evidenceRefs: [modelInput.latestUserMessageId]
            },
        answerOpportunity: stopRequested ? null : "new",
        burdenSignalChange: { kind: "unchanged" },
        pauseReason: stopRequested ? "用户明确要求停止当前访谈" : null
      },
      visible: {
        understanding: "我会继续围绕你刚才确认的重点。",
        response: stopRequested
          ? "好，我们先停在这里。"
          : "你愿意补充一个最能帮助我们弄清当前问题的具体线索吗？"
      }
    }),
    latencyMs: 321,
    provider: "openai",
    tokenUsage: { promptTokens: 10, completionTokens: 3, totalTokens: 13 },
    diagnostics: {
      finishReason: "stop",
      reasoningPresent: true,
      reasoningLength: 123,
      reasoningTokens: 7,
      latencyMs: 321,
      tokenUsage: { promptTokens: 10, completionTokens: 3, totalTokens: 13 },
      upstreamRequestId: "raw-provider-request-id",
      httpStatus: 200,
      responseModel: "test-model",
      choiceCount: 1,
      contentType: "object",
      contentLength: 2,
      reasoningType: "string",
      headersLatencyMs: 20,
      bodyLatencyMs: 301,
      totalLatencyMs: 321,
      timeoutStage: null,
      abortSource: null
    }
  };
}

function validCandidateProvider(seen: AICompletionParams[] = []): AIProvider {
  return {
    name: "openai",
    async complete(params) {
      seen.push(params);
      return validCandidateResult(params);
    }
  };
}

function passingJudgeProvider(seen: AICompletionParams[] = []): AIProvider {
  return {
    name: "openai",
    async complete(params) {
      seen.push(params);
      return {
        content: JSON.stringify({
          pass: true,
          blocker: false,
          primaryFailureCategory: "none",
          rationale: "可见回应服务当前共同任务"
        }),
        latencyMs: 100,
        provider: "openai"
      };
    }
  };
}

function goldenFile(prefix = "golden"): Gi088V8r3JudgeGoldenFile {
  return {
    version: "2026-08-11.gi088-v8r3-judge-golden-v2",
    rounds: ["a", "b"].map((round) => ({
      roundId: `${prefix}-${round}`,
      items: Array.from({ length: 20 }, (_, index) => {
        const checkpoints = [
          {
            visibleConversation: [
              {
                role: "user" as const,
                content: `我想把第 ${prefix}-${round}-${index + 1} 件事想清楚。`
              },
              {
                role: "assistant" as const,
                content: "你想先确认最关键的条件。"
              },
              {
                role: "user" as const,
                content: `这是第 ${index + 1} 条补充。`
              }
            ],
            candidateVisibleOutput: {
              action: "synthesize" as const,
              understanding: "当前条件已经足够形成一条认识。",
              response: "先把已经确认的条件保留下来。"
            },
            safeTrace: {
              latencyMs: 10_000,
              automaticRecoveryCount: 0,
              contractValid: true,
              technicalFailure: false
            }
          }
        ];
        return {
          sampleId: `${prefix}-${round}-${index + 1}`,
          sourcePartition: "golden_calibration" as const,
          contentFingerprint: createGi088V8r3JudgeContentFingerprint({
            checkpoints
          }),
          checkpoints,
          humanReview: {
            pass: true,
            blocker: false,
            primaryFailureCategory: "none" as const,
            reviewerId: `reviewer-${round}`,
            source: "trained_human_reviewer" as const,
            reviewedAt: `2026-08-1${round === "a" ? "0" : "1"}T00:00:00.000Z`
          }
        };
      })
    })) as Gi088V8r3JudgeGoldenFile["rounds"]
  };
}

function historicalBaseline(
  candidate: Awaited<ReturnType<typeof executeGi088V8r3CandidateEvaluation>>
) {
  const records = candidate.records.map((record) => {
    if (record.partition === "deterministic_regression") {
      throw new Error("unexpected deterministic candidate record");
    }
    const fingerprintPayload = {
      caseId: record.caseId,
      partition: record.partition,
      attempt: record.attempt,
      visibleOutput: {
        understanding: "v8r2 对当前信息的可见理解",
        response: "v8r2 DeepSeek Pro 的独立可见输出"
      }
    };
    return {
      ...fingerprintPayload,
      sourceEvidenceFingerprint:
        createGi088V8r3HistoricalBaselineRecordFingerprint(fingerprintPayload)
    };
  });
  const fingerprintPayload = {
    version: GI088_V8R3_HISTORICAL_BASELINE_VERSION,
    historicalCandidateVersion:
      GI088_V8R3_ALLOWED_HISTORICAL_CANDIDATE_VERSION,
    modelIdentity: createGi088V8r3HistoricalBaselineModelIdentity(),
    alignedDatasetFingerprint: candidate.datasetFingerprint,
    evidenceSource: "independent_visible_output_capture" as const,
    records
  };
  return {
    ...fingerprintPayload,
    baselineEvidenceFingerprint:
      createGi088V8r3HistoricalBaselineEvidenceFingerprint(fingerprintPayload)
  };
}

describe("GI-088 v8r3 formal offline executor", () => {
  it("declares 96 checkpoint calls, global recovery 2, and a 194-call formal ceiling", () => {
    const plan = createGi088V8r3OfflineExecutionPlan();
    expect(plan.externalModelCalls).toBe(0);
    expect(plan.callBudget).toEqual({
      deterministicRegressionCalls: 0,
      candidateDevelopmentInitialCalls: 64,
      candidateHiddenInitialCalls: 32,
      candidateInitialCalls: 96,
      candidateAutomaticRecoveryCallsMaximum: 2,
      candidateCallsMaximum: 98,
      judgeCalibrationCalls: 40,
      judgeDevelopmentPrescreenCallsMaximum: 56,
      judgeHiddenCallsMaximum: 0,
      judgeCallsMaximum: 96,
      completeFormalFlowCallsMaximum: 194
    });
    expect(plan.candidate.developmentResults).toBe(56);
    expect(plan.candidate.hiddenResults).toBe(24);
    expect(plan.judge.hiddenAutomaticJudgement).toBe("forbidden");
  });

  it("calls three real program validators for each of 24 zero-model cases", () => {
    const regression = runGi088V8r3DeterministicRegression(
      GI088_V8R3_DETERMINISTIC_REGRESSION_CASES
    );
    expect(regression).toMatchObject({
      caseCount: 24,
      modelGenerationCalls: 0,
      validatorAssertionCount: 72,
      passed: true,
      failures: []
    });
  });

  it("locks Ark Flash to Thinking high, json_object, provider max tokens, and 60s", () => {
    const params = createGi088V8r3CandidateCompletionParams({
      evaluationCase: GI088_V8R3_DEVELOPMENT_CASES[0],
      checkpointIndex: 0,
      recovery: false
    });
    expect(params).toMatchObject({
      useProviderDefaultMaxTokens: true,
      timeoutMs: 60_000,
      headersTimeoutMs: 60_000,
      bodyIdleTimeoutMs: 60_000,
      hardTimeoutMs: 60_000,
      responseFormat: "json_object",
      thinking: "enabled",
      reasoningEffort: "high"
    });
    expect(params.maxTokens).toBeUndefined();
    const initialHashPayload = createGi088V8r3CandidateRequestHashPayload({
      evaluationCase: GI088_V8R3_DEVELOPMENT_CASES[0]!,
      checkpointIndex: 0,
      attempt: 1,
      kind: "initial"
    });
    expect(initialHashPayload.transport).toBe("openai_compatible_rest");
    expect(initialHashPayload).toMatchObject({
      recoveryTrigger: null,
      recoveryInstructionVersion: null
    });
    const schemaRecoveryHashPayload =
      createGi088V8r3CandidateRequestHashPayload({
        evaluationCase: GI088_V8R3_DEVELOPMENT_CASES[0]!,
        checkpointIndex: 0,
        attempt: 2,
        kind: "automatic_recovery",
        recoveryTrigger: "OUTPUT_SCHEMA_INVALID"
      });
    expect(schemaRecoveryHashPayload).toMatchObject({
      recoveryTrigger: "OUTPUT_SCHEMA_INVALID",
      recoveryInstructionVersion:
        "2026-08-11.gi088-output-schema-correction-v1"
    });
  });

  it("executes every trajectory checkpoint sequentially and caps technical recovery globally", async () => {
    const seen: AICompletionParams[] = [];
    const report = await executeGi088V8r3CandidateEvaluation({
      ...candidateInput(technicalFailureProvider(seen)),
      automaticRecoveryMaximum: 2
    });
    expect(report.records).toHaveLength(80);
    expect(report.budget).toEqual({
      authorizedMaximum: 98,
      initialCalls: 96,
      automaticRecoveryCalls: 2,
      totalCalls: 98
    });
    expect(seen).toHaveLength(98);
    expect(
      report.records
        .filter((record) => record.kind === "trajectory")
        .every(
          (record) =>
            record.checkpoints.length === 2 &&
            record.checkpoints.every(
              (checkpoint, index) => checkpoint.checkpointIndex === index
            )
        )
    ).toBe(true);
    expect(report.operationalLedger.eligibleSubmissionCount).toBe(96);
    expect(report.operationalLedger.automaticRecoveryAttemptCount).toBe(2);
    expect(seen[1]?.messages.some((message) =>
      message.role === "system" && message.content.includes("共享时限")
    )).toBe(true);
    expect(evaluateGi088V8r3CandidateOperationalGates(report).passed).toBe(false);
    await expect(
      executeGi088V8r3CandidateEvaluation({
        ...candidateInput(technicalFailureProvider()),
        automaticRecoveryMaximum: 3
      })
    ).rejects.toThrow(/AUTOMATIC_RECOVERY_MAXIMUM_INVALID/u);
  });

  it("uses Foundation parity parsing and trigger-specific schema/semantic corrections", async () => {
    const seen: AICompletionParams[] = [];
    let callIndex = 0;
    const provider: AIProvider = {
      name: "openai",
      async complete(params) {
        seen.push(params);
        const index = callIndex;
        callIndex += 1;
        if (index === 0) {
          return {
            ...validCandidateResult(params),
            content: '{"semantic":{"action":42}}'
          };
        }
        if (index === 2) {
          const result = validCandidateResult(params);
          const output = JSON.parse(result.content) as {
            semantic: { nextInquiry: unknown };
          };
          output.semantic.nextInquiry = null;
          return { ...result, content: JSON.stringify(output) };
        }
        return validCandidateResult(params);
      }
    };
    const report = await executeGi088V8r3CandidateEvaluation({
      ...candidateInput(provider),
      automaticRecoveryMaximum: 2
    });
    const recoveredCheckpoints = report.records.flatMap((record) =>
      record.checkpoints.filter(
        (checkpoint) => checkpoint.automaticRecoveryCount === 1
      )
    );

    expect(report.budget.automaticRecoveryCalls).toBe(2);
    expect(recoveredCheckpoints).toHaveLength(2);
    expect(recoveredCheckpoints[0]?.calls[0]?.validationIssues).toContain(
      "OUTPUT_SCHEMA_INVALID:semantic.action:invalid_type"
    );
    expect(recoveredCheckpoints[0]?.calls[0]?.validationIssues).toSatisfy(
      (issues: string[]) =>
        issues.length <= 12 &&
        issues.every((issue) =>
          /^OUTPUT_SCHEMA_INVALID:(?:\$|[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*){0,11}):[a-z_]+$/u.test(
            issue
          )
        )
    );
    expect(recoveredCheckpoints[1]?.calls[0]?.validationIssues).toContain(
      "ASK_NEXT_INQUIRY_REQUIRED"
    );
    expect(recoveredCheckpoints.every(
      (checkpoint) => checkpoint.status === "valid"
    )).toBe(true);
    expect(seen[1]?.messages.some((message) =>
      message.role === "system" && message.content.includes("结构化 JSON 合同")
    )).toBe(true);
    expect(seen[3]?.messages.some((message) =>
      message.role === "system" && message.content.includes("当前语义合同")
    )).toBe(true);
  });

  it("keeps ASK/NON_ASK question counts observational and reserves state correction", () => {
    const evaluationCase = GI088_V8R3_DEVELOPMENT_CASES[0]!;
    const params = createGi088V8r3CandidateCompletionParams({
      evaluationCase,
      checkpointIndex: 0,
      recovery: false
    });
    const turnInput = createGi088V8r3OfflineTurnInput(evaluationCase, 0);
    const askResult = validCandidateResult(params);
    const askOutput = JSON.parse(askResult.content) as {
      semantic: {
        action: string;
        understandingChange: unknown;
        nextInquiry: unknown;
        answerOpportunity: unknown;
        pauseReason: unknown;
      };
      visible: { understanding: string | null; response: string };
    };
    askOutput.visible.response = "这份卡住是什么感受？更接近害怕做错吗？";
    expect(validateGi088V8r3CandidateOutput({
      content: JSON.stringify(askOutput),
      turnInput,
      controlDecisionFinalAction: "none"
    })).toMatchObject({ validationIssues: [], recoveryTrigger: null });

    askOutput.semantic.action = "acknowledge";
    askOutput.semantic.nextInquiry = null;
    askOutput.semantic.answerOpportunity = null;
    askOutput.semantic.pauseReason = null;
    askOutput.visible.understanding = null;
    askOutput.visible.response = "先把当前线索放在这里，可以吗？";
    expect(validateGi088V8r3CandidateOutput({
      content: JSON.stringify(askOutput),
      turnInput,
      controlDecisionFinalAction: "none"
    })).toMatchObject({ validationIssues: [], recoveryTrigger: null });

    turnInput.semanticState.understandings = Array.from(
      { length: 100 },
      (_, index) => ({
        stateId: `state-existing-${index}`,
        summary: `已有认识 ${index}`,
        evidenceRefs: [turnInput.latestUserMessageId]
      })
    );
    askOutput.semantic.action = "synthesize";
    askOutput.semantic.understandingChange = {
      kind: "add",
      summary: "新增认识会使确定性状态超过合同容量",
      evidenceRefs: [turnInput.latestUserMessageId]
    };
    askOutput.visible.response = "先保留这条新形成的认识。";
    expect(validateGi088V8r3CandidateOutput({
      content: JSON.stringify(askOutput),
      turnInput,
      controlDecisionFinalAction: "none"
    })).toEqual({
      output: null,
      validationIssues: ["STATE_TRANSITION_INVALID"],
      recoveryTrigger: "STATE_TRANSITION_INVALID"
    });

    const stateCorrection = createGi088V8r3CandidateCompletionParams({
      evaluationCase,
      checkpointIndex: 0,
      recovery: true,
      recoveryTrigger: "STATE_TRANSITION_INVALID"
    });
    expect(stateCorrection.messages.some((message) =>
      message.role === "system" && message.content.includes("语义状态越界")
    )).toBe(true);
  });

  it("records only sanitized candidate evidence and attested Ark identity", async () => {
    const report = await executeGi088V8r3CandidateEvaluation({
      ...candidateInput(validCandidateProvider()),
      automaticRecoveryMaximum: 0
    });
    expect(report.runtime).toMatchObject(createGi088V8r3ArkProviderIdentity());
    expect(report.behaviorFingerprintBundle).toEqual(
      createGi088FingerprintBundle()
    );
    expect(report.candidateFingerprint).toBe(
      report.behaviorFingerprintBundle.candidateFingerprint
    );
    expect(report.offlineRunFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(report.privateInputs).toMatchObject({
      hiddenFileSha256: PRIVATE_HIDDEN_FILE_SHA256,
      hiddenAggregateCommitment: expect.stringMatching(/^[a-f0-9]{64}$/u)
    });
    expect(report).not.toHaveProperty("executionFingerprint");
    expect(report).not.toHaveProperty("sourceFingerprints");
    expect([
      ...new Set(
        report.records.flatMap((record) =>
          record.calls.flatMap((call) => call.validationIssues)
        )
      )
    ]).toEqual([]);
    expect(report.operationalLedger.firstValidRate).toBe(1);
    expect(evaluateGi088V8r3CandidateOperationalGates(report).passed).toBe(true);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("raw-provider-request-id");
    expect(serialized).not.toContain("我想把");
    expect(serialized).not.toContain("reasoningContent");
    expect(report.privacy.hiddenReasoningBody).toBe("excluded");

    const tampered = structuredClone(report);
    tampered.operationalLedger.firstValidCount = 0;
    expect(() => parseGi088V8r3CandidateExecutionReport(tampered)).toThrow(
      /OPERATIONAL_LEDGER_MISMATCH/u
    );

    const wrongPrivateInput = structuredClone(report);
    wrongPrivateInput.privateInputs.hiddenFileSha256 = "e".repeat(64);
    expect(() =>
      parseGi088V8r3CandidateExecutionReport(wrongPrivateInput)
    ).toThrow(/OFFLINE_RUN_FINGERPRINT_MISMATCH/u);

    const wrongGlobalBundle = structuredClone(report);
    wrongGlobalBundle.behaviorFingerprintBundle.runnerFingerprint =
      "d".repeat(64);
    expect(() =>
      parseGi088V8r3CandidateExecutionReport(wrongGlobalBundle)
    ).toThrow(/BEHAVIOR_FINGERPRINT_BUNDLE_MISMATCH/u);

    const transportOmittedRequestHash = structuredClone(report);
    transportOmittedRequestHash.records[0]!.checkpoints[0]!.calls[0]!.requestHash =
      "a".repeat(64);
    expect(() =>
      parseGi088V8r3CandidateExecutionReport(transportOmittedRequestHash)
    ).toThrow(/CANDIDATE_REQUEST_HASH_MISMATCH/u);
  });

  it("builds Judge requests from all visible checkpoints and rejects hidden sources", () => {
    const checkpoints = goldenFile().rounds[0]!.items[0]!.checkpoints;
    const params = createGi088V8r3JudgeCompletionParams({
      sourcePartition: "development",
      checkpoints
    });
    const visibleInput = params.messages[1]!.content;
    expect(visibleInput).toContain("visibleConversation");
    expect(visibleInput).toContain("candidateVisibleOutput");
    expect(visibleInput).toContain("safeTrace");
    expect(visibleInput).not.toContain("humanReview");
    expect(visibleInput).not.toContain("deepseek-v4");
    expect(() =>
      createGi088V8r3JudgeCompletionParams({
        sourcePartition: "hidden_admission",
        checkpoints
      })
    ).toThrow(/HIDDEN_SOURCE_FORBIDDEN_FOR_JUDGE/u);
  });

  it("requires two content-distinct 20-item human Golden rounds", async () => {
    expect(() =>
      parseGi088V8r3JudgeGoldenFile(
        undefined,
        GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES
      )
    ).toThrow();
    const golden = parseGi088V8r3JudgeGoldenFile(
      goldenFile(),
      GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES
    );
    const seen: AICompletionParams[] = [];
    const calibration = await executeGi088V8r3JudgeCalibration({
      provider: passingJudgeProvider(seen),
      providerIdentity: createGi088V8r3ProProviderIdentity(),
      goldenFile: golden,
      hiddenCases: GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES,
      datasetFingerprint: TEST_DATASET_FINGERPRINT,
      concurrency: 4,
      now: () => new Date("2026-08-11T00:00:00.000Z")
    });
    expect(seen).toHaveLength(40);
    expect(calibration.runtime).toMatchObject(
      createGi088V8r3ProProviderIdentity()
    );
    expect(calibration.promotedToDevelopmentPrescreen).toBe(true);

    const reused = structuredClone(goldenFile("reuse"));
    reused.rounds[1]!.items[0]!.sampleId = "fresh-id";
    reused.rounds[1]!.items[0]!.checkpoints = structuredClone(
      reused.rounds[0]!.items[0]!.checkpoints
    );
    reused.rounds[1]!.items[0]!.contentFingerprint =
      reused.rounds[0]!.items[0]!.contentFingerprint;
    expect(() =>
      parseGi088V8r3JudgeGoldenFile(
        reused,
        GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES
      )
    ).toThrow(
      /GOLDEN_CONTENT_REUSED/u
    );

    const overlappingRounds = structuredClone(goldenFile("overlap"));
    for (const item of overlappingRounds.rounds[1]!.items) {
      item.humanReview.reviewedAt = "2026-08-10T00:00:00.000Z";
    }
    expect(() =>
      parseGi088V8r3JudgeGoldenFile(
        overlappingRounds,
        GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES
      )
    ).toThrow(/GOLDEN_ROUNDS_NOT_CONSECUTIVE/u);
  });

  it("blocks development prescreen before promotion", async () => {
    const candidate = await executeGi088V8r3CandidateEvaluation({
      ...candidateInput(validCandidateProvider()),
      automaticRecoveryMaximum: 0
    });
    const calibration = await executeGi088V8r3JudgeCalibration({
      provider: passingJudgeProvider(),
      providerIdentity: createGi088V8r3ProProviderIdentity(),
      goldenFile: goldenFile(),
      hiddenCases: GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES,
      datasetFingerprint: TEST_DATASET_FINGERPRINT,
      concurrency: 4
    });
    await expect(
      executeGi088V8r3JudgeDevelopmentPrescreen({
        provider: passingJudgeProvider(),
        providerIdentity: createGi088V8r3ProProviderIdentity(),
        candidateReport: candidate,
        calibrationReport: {
          ...calibration,
          promotedToDevelopmentPrescreen: false
        },
        developmentCases: GI088_V8R3_DEVELOPMENT_CASES
      })
    ).rejects.toThrow(/JUDGE_NOT_PROMOTED/u);
  });

  it("never sends hidden records to automatic Judge", async () => {
    const candidate = await executeGi088V8r3CandidateEvaluation({
      ...candidateInput(validCandidateProvider()),
      automaticRecoveryMaximum: 0
    });
    const calibration = await executeGi088V8r3JudgeCalibration({
      provider: passingJudgeProvider(),
      providerIdentity: createGi088V8r3ProProviderIdentity(),
      goldenFile: goldenFile("hidden-guard"),
      hiddenCases: GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES,
      datasetFingerprint: TEST_DATASET_FINGERPRINT,
      concurrency: 4
    });
    const seen: AICompletionParams[] = [];
    const prescreen = await executeGi088V8r3JudgeDevelopmentPrescreen({
      provider: passingJudgeProvider(seen),
      providerIdentity: createGi088V8r3ProProviderIdentity(),
      candidateReport: candidate,
      calibrationReport: calibration,
      developmentCases: GI088_V8R3_DEVELOPMENT_CASES,
      concurrency: 4
    });
    expect(seen).toHaveLength(56);
    expect(
      seen.every(
        (params) =>
          JSON.parse(params.messages[1]!.content).sourcePartition ===
          "development"
      )
    ).toBe(true);
    expect(prescreen.excludedHiddenRecordCount).toBe(24);
    expect(prescreen.budget.totalCalls).toBe(56);
  });

  it("creates a complete blind human packet and executes terminal admission gates", async () => {
    const candidate = await executeGi088V8r3CandidateEvaluation({
      ...candidateInput(validCandidateProvider()),
      automaticRecoveryMaximum: 0
    });
    const packet = buildGi088V8r3HumanAdjudicationPacket({
      candidateReport: candidate,
      cases: [
        ...GI088_V8R3_DEVELOPMENT_CASES,
        ...GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES
      ],
      seed: candidate.offlineRunFingerprint
    });
    expect(packet.publicPacket.items).toHaveLength(80);
    expect(packet.publicPacket.modelIdentityVisibleToReviewer).toBe(false);
    expect(packet.publicPacket.items[0]).toMatchObject({
      workingTask: expect.any(String),
      checkpoints: expect.any(Array)
    });
    expect(JSON.stringify(packet.publicPacket)).not.toContain("deepseek-v4");
    expect(JSON.stringify(packet.publicPacket)).not.toContain(
      "raw-provider-request-id"
    );

    const adjudicationFile = {
      version: "2026-08-11.gi088-v8r3-human-adjudication-v2" as const,
      candidateOfflineRunFingerprint: candidate.offlineRunFingerprint,
      candidateEvidenceFingerprint: candidate.evidenceFingerprint,
      datasetFingerprint: candidate.datasetFingerprint,
      items: packet.sealedKey.items.map((item) => ({
        reviewId: item.reviewId,
        reviewItemFingerprint: item.reviewItemFingerprint,
        reviewer: {
          reviewerId: "product-owner",
          source: "product_owner" as const,
          reviewedAt: "2026-08-11T12:00:00.000Z"
        },
        result: {
          outcome: "pass" as const,
          quality: "direct_use" as const,
          singleCaseBlocker: false,
          primaryFailureCategory: "none" as const
        }
      }))
    };
    const calibration = await executeGi088V8r3JudgeCalibration({
      provider: passingJudgeProvider(),
      providerIdentity: createGi088V8r3ProProviderIdentity(),
      goldenFile: goldenFile("admission"),
      hiddenCases: GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES,
      datasetFingerprint: candidate.datasetFingerprint,
      concurrency: 4,
      now: () => new Date("2026-08-11T11:00:00.000Z")
    });
    const prescreen = await executeGi088V8r3JudgeDevelopmentPrescreen({
      provider: passingJudgeProvider(),
      providerIdentity: createGi088V8r3ProProviderIdentity(),
      candidateReport: candidate,
      calibrationReport: calibration,
      developmentCases: GI088_V8R3_DEVELOPMENT_CASES,
      concurrency: 4,
      now: () => new Date("2026-08-11T11:30:00.000Z")
    });
    const admission = executeGi088V8r3Admission({
      candidateReport: candidate,
      adjudicationFile,
      calibrationReport: calibration,
      prescreenReport: prescreen,
      deterministicRegression: GI088_V8R3_DETERMINISTIC_REGRESSION_CASES,
      developmentCases: GI088_V8R3_DEVELOPMENT_CASES,
      hiddenAdmissionCases: GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES,
      now: () => new Date("2026-08-11T12:01:00.000Z")
    });
    expect(admission).toMatchObject({
      passed: true,
      evidenceBindings: {
        candidateOfflineRunFingerprint: candidate.offlineRunFingerprint,
        adjudicationEvidenceFingerprint: expect.stringMatching(
          /^[a-f0-9]{64}$/u
        ),
        judgeCalibrationFingerprint: calibration.calibrationFingerprint,
        judgePrescreenFingerprint: prescreen.prescreenFingerprint,
        datasetFingerprint: candidate.datasetFingerprint
      },
      modelIdentityBindings: {
        candidate: createGi088V8r3ArkProviderIdentity(),
        judgeCalibration: createGi088V8r3ProProviderIdentity(),
        judgePrescreen: createGi088V8r3ProProviderIdentity()
      },
      deterministic: { passed: true, validatorAssertionCount: 72 },
      passSquared: {
        development: { passed: true, passCount: 28 },
        hidden: { passed: true, passCount: 12 }
      },
      gates: {
        quality: { passed: true },
        reliability: { passed: true },
        latency: { passed: true }
      },
      humanEvidence: { reviewCount: 80, reviewerCount: 1 }
    });
    expect(parseGi088V8r3AdmissionReport(admission)).toEqual(admission);
    const tamperedAdmission = structuredClone(admission);
    tamperedAdmission.evidenceBindings.judgePrescreenFingerprint =
      "b".repeat(64);
    expect(() => parseGi088V8r3AdmissionReport(tamperedAdmission)).toThrow(
      /ADMISSION_FINGERPRINT_MISMATCH/u
    );
    const staleAdjudication = structuredClone(adjudicationFile);
    staleAdjudication.items[0]!.reviewer.reviewedAt =
      "2026-08-10T23:59:59.000Z";
    expect(() =>
      executeGi088V8r3Admission({
        candidateReport: candidate,
        adjudicationFile: staleAdjudication,
        calibrationReport: calibration,
        prescreenReport: prescreen,
        deterministicRegression: GI088_V8R3_DETERMINISTIC_REGRESSION_CASES,
        developmentCases: GI088_V8R3_DEVELOPMENT_CASES,
        hiddenAdmissionCases: GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES,
        now: () => new Date("2026-08-11T12:01:00.000Z")
      })
    ).toThrow(/ADJUDICATION_REVIEW_TIME_INVALID/u);

    expect(() =>
      executeGi088V8r3Admission({
        candidateReport: candidate,
        adjudicationFile,
        calibrationReport: undefined as never,
        prescreenReport: prescreen,
        deterministicRegression: GI088_V8R3_DETERMINISTIC_REGRESSION_CASES,
        developmentCases: GI088_V8R3_DEVELOPMENT_CASES,
        hiddenAdmissionCases: GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES
      })
    ).toThrow(/JUDGE_NOT_PROMOTED/u);

    const tamperedPrescreen = structuredClone(prescreen);
    tamperedPrescreen.datasetFingerprint = "e".repeat(64);
    expect(() =>
      parseGi088V8r3JudgePrescreenReport(tamperedPrescreen, {
        candidateReport: candidate,
        calibrationReport: calibration
      })
    ).toThrow(/PRESCREEN_BINDING_MISMATCH/u);
  });

  it("accepts only an independently bound v8r2 DeepSeek Pro baseline for human A/B", async () => {
    const candidate = await executeGi088V8r3CandidateEvaluation({
      ...candidateInput(validCandidateProvider()),
      automaticRecoveryMaximum: 0
    });
    const baseline = historicalBaseline(candidate);
    expect(parseGi088V8r3HistoricalBaselineReport(baseline)).toEqual(baseline);
    const packet = buildGi088V8r3BlindComparisonPacket({
      candidateReport: candidate,
      baselineReport: baseline,
      seed: candidate.offlineRunFingerprint
    });
    expect(packet.publicPacket).toMatchObject({
      reviewChannel: "human_blind_comparison",
      automaticJudgeEligible: false,
      hiddenAutomaticJudgement: "forbidden",
      modelIdentityVisibleToReviewer: false
    });
    expect(packet.publicPacket.pairs).toHaveLength(80);
    expect(packet.sealedKey).toMatchObject({
      historicalCandidateVersion:
        GI088_V8R3_ALLOWED_HISTORICAL_CANDIDATE_VERSION,
      baselineEvidenceFingerprint: baseline.baselineEvidenceFingerprint,
      baselineModelIdentity: createGi088V8r3HistoricalBaselineModelIdentity()
    });
    expect(JSON.stringify(packet.publicPacket)).not.toContain("deepseek-v4-pro");

    const wrongModel = structuredClone(baseline);
    (wrongModel.modelIdentity as { model: string }).model =
      "deepseek-v4-flash-ga-260731";
    expect(() => parseGi088V8r3HistoricalBaselineReport(wrongModel)).toThrow(
      /HISTORICAL_BASELINE_MODEL_IDENTITY_INVALID/u
    );
  });

  it("creates and closes a visible-only Bad Case archive with human categories", async () => {
    const candidate = await executeGi088V8r3CandidateEvaluation({
      ...candidateInput(validCandidateProvider()),
      automaticRecoveryMaximum: 0
    });
    const humanPacket = buildGi088V8r3HumanAdjudicationPacket({
      candidateReport: candidate,
      cases: [
        ...GI088_V8R3_DEVELOPMENT_CASES,
        ...GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES
      ],
      seed: candidate.offlineRunFingerprint
    });
    const adjudicationFile = {
      version: "2026-08-11.gi088-v8r3-human-adjudication-v2" as const,
      candidateOfflineRunFingerprint: candidate.offlineRunFingerprint,
      candidateEvidenceFingerprint: candidate.evidenceFingerprint,
      datasetFingerprint: candidate.datasetFingerprint,
      items: humanPacket.sealedKey.items.map((item, index) => ({
        reviewId: item.reviewId,
        reviewItemFingerprint: item.reviewItemFingerprint,
        reviewer: {
          reviewerId: "product-owner",
          source: "product_owner" as const,
          reviewedAt: "2026-08-11T12:00:00.000Z"
        },
        result:
          index === 0
            ? {
                outcome: "pass" as const,
                quality: "minor_issue" as const,
                singleCaseBlocker: false,
                primaryFailureCategory: "low_information_gain" as const
              }
            : {
                outcome: "pass" as const,
                quality: "direct_use" as const,
                singleCaseBlocker: false,
                primaryFailureCategory: "none" as const
              }
      }))
    };
    const packet = buildGi088V8r3BadCasePacket({
      candidateReport: candidate,
      adjudicationFile,
      cases: [
        ...GI088_V8R3_DEVELOPMENT_CASES,
        ...GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES
      ]
    });
    expect(packet.publicPacket.items).toHaveLength(1);
    expect(packet.publicPacket.items[0]).toMatchObject({
      visibleEvidence: expect.any(Array),
      humanLabel: {
        quality: "minor_issue",
        primaryFailureCategory: "low_information_gain"
      }
    });
    expect(packet.publicPacket.items[0]).not.toHaveProperty("requestHash");
    const archiveFile = {
      ...packet.archiveTemplate,
      items: packet.archiveTemplate.items.map((item) => ({
        badCaseId: item.badCaseId,
        badCaseEvidenceFingerprint: item.badCaseEvidenceFingerprint,
        category: "skill_core_principle" as const,
        archivedBy: {
          reviewerId: "product-owner",
          source: "product_owner" as const,
          reviewedAt: "2026-08-11T12:30:00.000Z"
        },
        rationale: "问题价值判断需要进入 Skill 核心原则。"
      }))
    };
    const archive = executeGi088V8r3BadCaseArchive({
      badCasePacket: packet.publicPacket,
      archiveFile,
      now: () => new Date("2026-08-11T12:31:00.000Z")
    });
    expect(archive.archivedItems).toHaveLength(1);
    expect(archive.archivedItems[0]!.classification.category).toBe(
      "skill_core_principle"
    );
    expect(archive.archiveFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    const serialized = JSON.stringify(archive);
    expect(serialized).not.toContain("requestHash");
    expect(serialized).not.toContain("raw-provider-request-id");
  });

  it("rejects a provider whose reported adapter identity is unverified", async () => {
    const provider = validCandidateProvider();
    await expect(
      executeGi088V8r3CandidateEvaluation({
        ...candidateInput(provider),
        providerIdentity: {
          ...createGi088V8r3ArkProviderIdentity(),
          model: "unexpected-model"
        }
      })
    ).rejects.toThrow(/PROVIDER_IDENTITY_MISMATCH/u);
  });

  it("keeps the complete formal ceiling below the excluded 200-call scale", () => {
    expect(GI088_V8R3_FORMAL_CALL_BUDGET.completeFormalFlowCallsMaximum).toBe(
      194
    );
    expect(GI088_V8R3_FORMAL_CALL_BUDGET.completeFormalFlowCallsMaximum).toBeLessThan(
      200
    );
  });
});
