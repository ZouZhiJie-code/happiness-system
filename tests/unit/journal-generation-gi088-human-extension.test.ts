import { rm } from "node:fs/promises";

import {
  GI088_HUMAN_EXTENSION_CASES,
  GI088_HUMAN_EXTENSION_EXCLUDED_CASE_IDS
} from "../../scripts/journal-generation-eval/gi088-human-extension-contract";
import {
  createGi088MockCalibrationProvider,
  Gi088CalibrationProviderError
} from "../../scripts/journal-generation-eval/gi088-calibration-provider";
import type {
  Gi088CalibrationProviderRequest,
  Gi088CalibrationProviderResult
} from "../../scripts/journal-generation-eval/gi088-calibration-contract";
import {
  loadCommittedGi088ExtensionRecordRound,
  runGi088HumanExtensionRecords
} from "../../scripts/journal-generation-eval/run-gi088-human-extension-records";
import {
  assessGi088ExtensionRecordReviewAdmission
} from "../../scripts/journal-generation-eval/gi088-human-extension-record-admission";
import {
  inspectGi088ExtensionRecordReviewAdmissionFileModes,
  loadCommittedGi088ExtensionRecordReviewAdmission,
  runGi088HumanExtensionRecordReviewAdmission
} from "../../scripts/journal-generation-eval/run-gi088-human-extension-record-review-admission";
import { createJournalExtensionFixture } from "./journal-evaluation-extension-fixture";

const cleanupDirectories: string[] = [];

function validRecordResponse(request: Gi088CalibrationProviderRequest): Gi088CalibrationProviderResult {
  const ref = request.sourceRefs[0];
  const text = request.sourceTextByRef[ref] ?? "这件事值得记录";
  return {
    content: JSON.stringify({
      title: { text: [...text].slice(0, 12).join(""), sourceRefs: [ref] },
      occurredAtText: null,
      blocks: [{ kind: "event", text, sourceRefs: [ref] }]
    }),
    latencyMs: 10,
    provider: "mock",
    finishReason: "stop",
    tokenUsage: {
      promptTokens: 100,
      completionTokens: 40,
      totalTokens: 140,
      promptCacheHitTokens: 0,
      promptCacheMissTokens: 100
    },
    upstreamRequestId: `mock-${request.callFingerprint.slice(0, 8)}`,
    reasoningPresent: false,
    reasoningTokens: 0,
    responseModel: "deepseek-v4-flash"
  };
}

afterEach(async () => {
  await Promise.all(cleanupDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe("GI-088 剩余六条真人轨迹扩展", () => {
  it("精确选择六条剩余轨迹，并排除三条已完成案例", async () => {
    expect(GI088_HUMAN_EXTENSION_CASES.map((item) => item.caseId)).toEqual([
      "private:sg-gi088-v6-single-focus:A1:high",
      "private:sg-gi088-v7-continuity-baseline:A1:high",
      "private:sg-gi088-v7-continuity-baseline:A2:high",
      "private:sg-gi088-v7r2-ark-flash:A1:high",
      "private:sg-gi088-v7r2-ark-flash:A2:high",
      "private:sg-gi088-v7r4-pro:A1:high"
    ]);
    expect(new Set(GI088_HUMAN_EXTENSION_CASES.map((item) => item.caseId)).size).toBe(6);
    expect(GI088_HUMAN_EXTENSION_EXCLUDED_CASE_IDS).toEqual([
      "private:sg-gi088-v6-single-focus:A2:high",
      "private:sg-gi088-v7r4-pro:A2:high",
      "private:sg-gi088-v8-question-decision-pro:A1:high"
    ]);
    const result = await runGi088HumanExtensionRecords({
      mode: "dry-run",
      confirmPrivateReplay: false,
      confirmScopeFingerprint: null,
      maxCalls: 12,
      maxCallsExplicit: false,
      runId: null
    });
    if (!result.plan) throw new Error("dry-run plan unavailable");
    expect(result.plan.model_calls_executed).toBe(0);
    expect(result.plan.selected_cases).toHaveLength(6);
    expect(result.plan.nominal_model_calls).toBe(6);
    expect(result.plan.max_model_calls).toBe(12);
  });

  it("模拟 Provider 用 6 次调用完成六张记录卡，并可从原始响应独立复核", async () => {
    const fixture = await createJournalExtensionFixture();
    cleanupDirectories.push(fixture.recordResult.outputDirectory);
    const result = fixture.recordResult;
    expect(result.package.run).toMatchObject({
      actual_model_calls: 6,
      technical_retries: 0,
      quality_retries: 0,
      completed_cases: 6,
      admitted_cases: 6
    });
    expect(result.package.cases).toHaveLength(6);
    expect(result.package.cases.every((item) =>
      item.candidate.trace.attempts.every((attempt) => attempt.stage === "record_card")
    )).toBe(true);
    const loaded = await loadCommittedGi088ExtensionRecordRound(
      result.outputDirectory,
      { allowMock: true }
    );
    expect(loaded.package.execution_fingerprint).toBe(result.package.execution_fingerprint);
    expect(loaded.ledger.filter((event) => event.event === "call_reserved")).toHaveLength(6);
    cleanupDirectories.pop();
    await fixture.cleanup();
  });

  it("仅块数量超限时，将无损整理后的记录卡开放给真人确认", async () => {
    const fixture = await createJournalExtensionFixture();
    cleanupDirectories.push(fixture.recordResult.outputDirectory);
    const recordCase = structuredClone(fixture.recordResult.package.cases[0]);
    recordCase.candidate.program_check = {
      admitted: false,
      failures: [{
        code: "RECORD_CARD_SCHEMA_INVALID:blocks:too_big",
        message: "结构块数量超限",
        refs: [recordCase.case_id],
        severity: "P0"
      }],
      checks: [
        {
          check: "strict_json_and_record_structure",
          passed: false,
          issues: ["RECORD_CARD_SCHEMA_INVALID:blocks:too_big"]
        },
        {
          check: "source_refs_numbers_quotes_and_time",
          passed: true,
          issues: ["RECORD_CARD_SCHEMA_INVALID:blocks:too_big"]
        },
        {
          check: "model_thinking_and_finish_reason",
          passed: true,
          issues: ["RECORD_CARD_SCHEMA_INVALID:blocks:too_big"]
        },
        {
          check: "invalidated_understanding_excluded",
          passed: true,
          issues: ["RECORD_CARD_SCHEMA_INVALID:blocks:too_big"]
        }
      ]
    };
    const admission = assessGi088ExtensionRecordReviewAdmission(recordCase);
    expect(admission.reviewReady).toBe(true);
    expect(admission.normalized).toBe(true);
    expect(admission.normalizationFingerprint).toHaveLength(64);

    recordCase.candidate.program_check.failures[0].code = "RECORD_CARD_UNVERIFIED_NUMBER";
    expect(assessGi088ExtensionRecordReviewAdmission(recordCase).reviewReady).toBe(false);
    cleanupDirectories.pop();
    await fixture.cleanup();
  });

  it("零调用评审准入续包重验父包，并封存六条可评记录卡", async () => {
    const fixture = await createJournalExtensionFixture({ withRecordConfirmations: false });
    cleanupDirectories.push(fixture.recordResult.outputDirectory);
    const baseOptions = {
      mode: "dry-run" as const,
      confirmPrivateReplay: false,
      confirmScopeFingerprint: null,
      confirmParentExecutionFingerprint: null,
      parentDirectory: fixture.recordResult.outputDirectory,
      outputId: null,
      allowMockParent: true
    };
    const inspected = await runGi088HumanExtensionRecordReviewAdmission(baseOptions);
    if (!inspected.plan) throw new Error("admission inspection unavailable");
    expect(inspected.plan.model_calls_executed).toBe(0);
    expect(inspected.plan.model_calls_maximum).toBe(0);
    expect(inspected.plan.selected_cases).toHaveLength(6);

    const executed = await runGi088HumanExtensionRecordReviewAdmission({
      ...baseOptions,
      mode: "execute",
      confirmPrivateReplay: true,
      confirmScopeFingerprint: inspected.plan.scope_fingerprint,
      confirmParentExecutionFingerprint: inspected.plan.parent_execution_fingerprint,
      outputId: `gi088-record-admission-test-${Date.now()}`
    });
    if (!executed.outputWritten || !executed.outputDirectory) {
      throw new Error("admission package unavailable");
    }
    cleanupDirectories.push(executed.outputDirectory);
    expect(executed.package.model_calls).toEqual({ actual: 0, maximum: 0 });
    expect(executed.package.cases).toHaveLength(6);
    expect(executed.package.cases.every((item) => item.review_ready)).toBe(true);
    expect(executed.package.parent.execution_fingerprint)
      .toBe(fixture.recordResult.package.execution_fingerprint);

    const loaded = await loadCommittedGi088ExtensionRecordReviewAdmission(
      executed.outputDirectory,
      process.cwd(),
      { allowMockParent: true }
    );
    expect(loaded.package.execution_fingerprint).toBe(executed.executionFingerprint);
    expect(loaded.manifest.model_calls).toEqual({ actual: 0, maximum: 0 });
    const modes = await inspectGi088ExtensionRecordReviewAdmissionFileModes(
      executed.outputDirectory
    );
    expect(modes.directory).toBe(0o700);
    expect(modes.files).toEqual([0o600, 0o600, 0o600, 0o600]);
  });

  it("技术失败最多重试一次，质量失败保持首个结果且不触发重写", async () => {
    let firstTechnical = true;
    const retryProvider = createGi088MockCalibrationProvider(async (request) => {
      if (firstTechnical) {
        firstTechnical = false;
        throw new Gi088CalibrationProviderError("TIMEOUT", true, 20);
      }
      return validRecordResponse(request);
    });
    const retryResult = await runGi088HumanExtensionRecords({
      mode: "mock",
      confirmPrivateReplay: false,
      confirmScopeFingerprint: null,
      maxCalls: 12,
      maxCallsExplicit: true,
      runId: `gi088-human-extension-record-cards-mock-retry-${Date.now()}`
    }, process.env, { createMockProvider: () => retryProvider });
    if (!retryResult.package || !retryResult.outputDirectory) {
      throw new Error("retry result unavailable");
    }
    cleanupDirectories.push(retryResult.outputDirectory);
    expect(retryResult.package.run.actual_model_calls).toBe(7);
    expect(retryResult.package.run.technical_retries).toBe(1);
    expect(retryResult.package.run.quality_retries).toBe(0);

    let firstQuality = true;
    const qualityProvider = createGi088MockCalibrationProvider(async (request) => {
      if (firstQuality) {
        firstQuality = false;
        return { ...validRecordResponse(request), content: "not-json" };
      }
      return validRecordResponse(request);
    });
    const qualityResult = await runGi088HumanExtensionRecords({
      mode: "mock",
      confirmPrivateReplay: false,
      confirmScopeFingerprint: null,
      maxCalls: 12,
      maxCallsExplicit: true,
      runId: `gi088-human-extension-record-cards-mock-quality-${Date.now()}`
    }, process.env, { createMockProvider: () => qualityProvider });
    if (!qualityResult.package || !qualityResult.outputDirectory) {
      throw new Error("quality result unavailable");
    }
    cleanupDirectories.push(qualityResult.outputDirectory);
    expect(qualityResult.package.run.actual_model_calls).toBe(6);
    expect(qualityResult.package.run.quality_retries).toBe(0);
    expect(qualityResult.package.cases[0].candidate.program_check.admitted).toBe(false);
    expect(qualityResult.package.raw_responses).toHaveLength(6);
  });
});
