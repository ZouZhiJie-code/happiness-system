import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GI088_JOURNAL_CALIBRATION_RUNTIME,
  type Gi088CalibrationProvider,
  type Gi088CalibrationProviderRequest
} from "../../scripts/journal-generation-eval/gi088-calibration-contract";
import { Gi088CalibrationProviderError } from "../../scripts/journal-generation-eval/gi088-calibration-provider";
import {
  loadGi088CalibrationSources,
  type LoadedGi088CalibrationCase
} from "../../scripts/journal-generation-eval/gi088-calibration-runner";
import { sha256File } from "../../scripts/journal-generation-eval/private-export-importer";
import {
  GI088_FLASH_DAILY_CONTEXT_V3_LOCKED_PARENT_ARTIFACTS,
  GI088_FLASH_DAILY_CONTEXT_V3_LOCKED_PARENT_TRANSITIVE_ARTIFACTS,
  GI088_FLASH_DAILY_CONTEXT_V3_RUNTIME,
  appendGi088FlashDailyContextV3Ledger,
  assessGi088FlashDailyContextV3Output,
  assertGi088FlashDailyContextV3LockedParentArtifacts,
  assertGi088FlashDailyContextV3LockedParentTransitiveArtifacts,
  assertGi088FlashDailyContextV3ParentSeal,
  assertGi088FlashDailyContextV3ProviderIdentity,
  assertGi088FlashDailyContextV3Runtime,
  buildGi088FlashDailyWritingMaterialV3,
  createGi088FlashDailyContextV3ExecutionFingerprint,
  gi088FlashDailyContextV3ProviderPreflightFingerprintPayload,
  loadGi088FlashDailyContextV3PriorZeroCallFailures,
  parseGi088FlashDailyContextV3Args,
  runGi088FlashDailyContextV3,
  selectGi088FlashDailyContextV3ParentReview,
  type Gi088FlashDailyContextV3ParentCommitManifest,
  type Gi088FlashDailyContextV3ParentRunLock
} from "../../scripts/journal-generation-eval/run-gi088-flash-daily-context-v3";
import type { Gi088FlashDailyRevisionPackage } from "../../scripts/journal-generation-eval/run-gi088-flash-daily-revision";
import {
  JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION,
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH
} from "../../src/server/services/journal-daily-entry/prompt";

function runId(label: string) {
  return `test-${label}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function goodResult(request: Gi088CalibrationProviderRequest) {
  const recordId = request.sourceRecordIds[0];
  return {
    content: JSON.stringify({
      paragraphs: [{ text: request.sourceRecordTextById[recordId], sourceRecordIds: [recordId] }]
    }),
    latencyMs: 12,
    provider: "mock-flash-v3",
    finishReason: "stop",
    tokenUsage: null,
    upstreamRequestId: `mock-${request.callFingerprint.slice(0, 8)}`,
    reasoningPresent: false,
    reasoningTokens: 0,
    responseModel: "deepseek-v4-flash"
  };
}

const EMPTY_REAL_ROUND_HISTORY = {
  loadPriorZeroCallFailures: async () => []
};

describe("GI-088 Flash 今日日记语境 v3 独立轮", () => {
  const written: string[] = [];

  afterEach(async () => {
    await Promise.all(written.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    ));
  });

  it("默认零调用检查，真实运行需要私有范围、父指纹与六次上限四项确认", () => {
    expect(parseGi088FlashDailyContextV3Args([])).toMatchObject({
      mode: "dry-run",
      maxCalls: 6,
      maxCallsExplicit: false
    });
    expect(() => parseGi088FlashDailyContextV3Args(["--execute-real"]))
      .toThrow(/PRIVATE_REPLAY_CONFIRMATION_REQUIRED/u);
    expect(() => parseGi088FlashDailyContextV3Args([
      "--execute-real", "--confirm-private-replay", "--confirm-scope=scope",
      "--confirm-parent-execution=parent"
    ])).toThrow(/MAX_CALLS_CONFIRMATION_REQUIRED/u);
    expect(parseGi088FlashDailyContextV3Args([
      "--execute-real", "--confirm-private-replay", "--confirm-scope=scope",
      "--confirm-parent-execution=parent", "--max-calls=6"
    ])).toMatchObject({ mode: "real", confirmPrivateReplay: true, maxCalls: 6 });
  });

  it("共享模型运行参数必须与 v3 冻结合同完全一致", () => {
    expect(() => assertGi088FlashDailyContextV3Runtime(
      GI088_FLASH_DAILY_CONTEXT_V3_RUNTIME
    )).not.toThrow();
    expect(() => assertGi088FlashDailyContextV3Runtime({
      ...GI088_FLASH_DAILY_CONTEXT_V3_RUNTIME,
      temperature: 0.8
    } as unknown as typeof GI088_FLASH_DAILY_CONTEXT_V3_RUNTIME))
      .toThrow(/RUNTIME_CONTRACT_MISMATCH/u);
    expect(() => assertGi088FlashDailyContextV3Runtime({
      ...GI088_FLASH_DAILY_CONTEXT_V3_RUNTIME,
      hardTimeoutMs: 59_999
    } as unknown as typeof GI088_FLASH_DAILY_CONTEXT_V3_RUNTIME))
      .toThrow(/RUNTIME_CONTRACT_MISMATCH/u);
  });

  it("锁定父轮四哈希，并校验 manifest 对 attempt ledger 与 run lock 的传递绑定", async () => {
    const parentRoot = resolve(
      process.cwd(),
      "artifacts/journal-generation-evaluation/.private/formal/rounds/flash-daily-prompt-v2-c747dc76"
    );
    const paths = {
      package: resolve(parentRoot, "round-package.json"),
      manifest: resolve(parentRoot, "commit-manifest.json"),
      runLock: resolve(parentRoot, "round-run.lock.json"),
      attemptLedger: resolve(parentRoot, "attempt-ledger.ndjson")
    };
    const [candidatePackage, manifest, runLock, packageSha, attemptLedgerSha, runLockSha] = await Promise.all([
      readFile(paths.package, "utf8").then((value) => JSON.parse(value) as Gi088FlashDailyRevisionPackage),
      readFile(paths.manifest, "utf8").then(
        (value) => JSON.parse(value) as Gi088FlashDailyContextV3ParentCommitManifest
      ),
      readFile(paths.runLock, "utf8").then(
        (value) => JSON.parse(value) as Gi088FlashDailyContextV3ParentRunLock
      ),
      sha256File(paths.package),
      sha256File(paths.attemptLedger),
      sha256File(paths.runLock)
    ]);
    const seal = { candidatePackage, manifest, runLock, packageSha, attemptLedgerSha, runLockSha };

    expect(() => assertGi088FlashDailyContextV3LockedParentArtifacts(
      GI088_FLASH_DAILY_CONTEXT_V3_LOCKED_PARENT_ARTIFACTS
    )).not.toThrow();
    expect(() => assertGi088FlashDailyContextV3LockedParentArtifacts({
      ...GI088_FLASH_DAILY_CONTEXT_V3_LOCKED_PARENT_ARTIFACTS,
      reviews_sha256: "0".repeat(64)
    })).toThrow(/LOCKED_PARENT_ARTIFACT_MISMATCH/u);
    expect(() => assertGi088FlashDailyContextV3LockedParentTransitiveArtifacts(
      GI088_FLASH_DAILY_CONTEXT_V3_LOCKED_PARENT_TRANSITIVE_ARTIFACTS
    )).not.toThrow();
    expect(() => assertGi088FlashDailyContextV3LockedParentTransitiveArtifacts({
      ...GI088_FLASH_DAILY_CONTEXT_V3_LOCKED_PARENT_TRANSITIVE_ARTIFACTS,
      run_lock_sha256: "0".repeat(64)
    })).toThrow(/LOCKED_PARENT_TRANSITIVE_ARTIFACT_MISMATCH/u);
    expect(() => assertGi088FlashDailyContextV3ParentSeal(seal)).not.toThrow();
    expect(() => assertGi088FlashDailyContextV3ParentSeal({
      ...seal,
      manifest: {
        ...manifest,
        child_artifacts: {
          ...manifest.child_artifacts,
          attempt_ledger_sha256: "0".repeat(64)
        }
      }
    })).toThrow(/PARENT_INVALID/u);
    expect(() => assertGi088FlashDailyContextV3ParentSeal({
      ...seal,
      runLock: { ...runLock, actual_model_calls: runLock.actual_model_calls + 1 }
    })).toThrow(/PARENT_INVALID/u);
    expect(() => assertGi088FlashDailyContextV3ParentSeal({
      ...seal,
      candidatePackage: {
        ...candidatePackage,
        prompt: { ...candidatePackage.prompt, version: "tampered-prompt" }
      }
    })).toThrow(/PARENT_INVALID/u);
    expect(() => assertGi088FlashDailyContextV3ParentSeal({
      ...seal,
      candidatePackage: {
        ...candidatePackage,
        cases: candidatePackage.cases.map((item, index) => index === 0
          ? {
              ...item,
              candidate: {
                ...item.candidate,
                program_check: { ...item.candidate.program_check, admitted: false }
              }
            }
          : item)
      }
    })).toThrow(/PARENT_INVALID/u);
    const semanticTampering: Gi088FlashDailyRevisionPackage[] = [
      {
        ...candidatePackage,
        prompt: { ...candidatePackage.prompt, system_prompt_sha256: "0".repeat(64) }
      },
      {
        ...candidatePackage,
        runtime: { ...candidatePackage.runtime, thinking: "enabled" }
      } as unknown as Gi088FlashDailyRevisionPackage,
      {
        ...candidatePackage,
        runtime: { ...candidatePackage.runtime, temperature: 0.8 }
      } as unknown as Gi088FlashDailyRevisionPackage,
      {
        ...candidatePackage,
        runtime: { ...candidatePackage.runtime, quality_retries: 1 }
      } as unknown as Gi088FlashDailyRevisionPackage,
      {
        ...candidatePackage,
        budget: { ...candidatePackage.budget, max_model_calls: 7 }
      } as unknown as Gi088FlashDailyRevisionPackage,
      {
        ...candidatePackage,
        run: { ...candidatePackage.run, quality_retries: 1 }
      } as unknown as Gi088FlashDailyRevisionPackage
    ];
    semanticTampering.forEach((tampered) => {
      expect(() => assertGi088FlashDailyContextV3ParentSeal({
        ...seal,
        candidatePackage: tampered
      })).toThrow(/PARENT_INVALID/u);
    });
  });

  it("Provider 预检指纹绑定模型清单和凭据来源，同时排除检查时间", () => {
    const base = {
      performed_at: "2026-08-11T00:00:00.000Z",
      required_model: "deepseek-v4-flash" as const,
      required_model_available: true as const,
      available_model_ids_sha256: "a".repeat(64),
      credential_source: "macos_keychain" as const
    };
    const first = gi088FlashDailyContextV3ProviderPreflightFingerprintPayload(base);
    const second = gi088FlashDailyContextV3ProviderPreflightFingerprintPayload({
      ...base,
      performed_at: "2026-08-11T01:00:00.000Z"
    });

    expect(first).toEqual(second);
    expect(first).toEqual({
      required_model: "deepseek-v4-flash",
      required_model_available: true,
      available_model_ids_sha256: "a".repeat(64),
      credential_source: "macos_keychain"
    });
    const fingerprint = createGi088FlashDailyContextV3ExecutionFingerprint({
      scopeFingerprint: "scope",
      actualCalls: 3,
      providerPreflight: base,
      cases: [],
      rawResponses: [],
      providerAdapter: "deepseek_official_openai_compatible"
    });
    expect(createGi088FlashDailyContextV3ExecutionFingerprint({
      scopeFingerprint: "scope",
      actualCalls: 3,
      providerPreflight: { ...base, performed_at: "2026-08-11T02:00:00.000Z" },
      cases: [],
      rawResponses: [],
      providerAdapter: "deepseek_official_openai_compatible"
    })).toBe(fingerprint);
    expect(createGi088FlashDailyContextV3ExecutionFingerprint({
      scopeFingerprint: "scope",
      actualCalls: 3,
      providerPreflight: { ...base, credential_source: "process_environment" },
      cases: [],
      rawResponses: [],
      providerAdapter: "deepseek_official_openai_compatible"
    })).not.toBe(fingerprint);
    expect(createGi088FlashDailyContextV3ExecutionFingerprint({
      scopeFingerprint: "scope",
      actualCalls: 3,
      providerPreflight: base,
      cases: [],
      rawResponses: [],
      providerAdapter: "unexpected-adapter"
    })).not.toBe(fingerprint);
  });

  it("Provider 身份必须与 mock 或 DeepSeek 官方真实适配器一致", () => {
    const complete = async (request: Gi088CalibrationProviderRequest) => goodResult(request);
    expect(() => assertGi088FlashDailyContextV3ProviderIdentity("mock", {
      kind: "mock",
      name: "mock-provider",
      complete
    })).not.toThrow();
    expect(() => assertGi088FlashDailyContextV3ProviderIdentity("real", {
      kind: "real",
      name: "deepseek_official_openai_compatible",
      complete
    })).not.toThrow();
    expect(() => assertGi088FlashDailyContextV3ProviderIdentity("real", {
      kind: "mock",
      name: "deepseek_official_openai_compatible",
      complete
    })).toThrow(/REAL_PROVIDER_IDENTITY_MISMATCH/u);
    expect(() => assertGi088FlashDailyContextV3ProviderIdentity("real", {
      kind: "real",
      name: "fake-real-provider",
      complete
    })).toThrow(/REAL_PROVIDER_IDENTITY_MISMATCH/u);
    expect(() => assertGi088FlashDailyContextV3ProviderIdentity("mock", {
      kind: "real",
      name: "deepseek_official_openai_compatible",
      complete
    })).toThrow(/MOCK_PROVIDER_IDENTITY_MISMATCH/u);
  });

  it("零调用失败可形成只读血缘，已有预约或完成轮会继续阻断", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "gi088-v3-history-"));
    written.push(root);
    const parentExecution = "parent-execution";
    const recoverableDirectory = resolve(root, "flash-daily-context-v3-zero-call");
    await mkdir(recoverableDirectory);
    await writeFile(resolve(recoverableDirectory, "round-run.lock.json"), JSON.stringify({
      round_id: "flash-daily-context-v3",
      status: "failed",
      mode: "real",
      parent_execution_fingerprint: parentExecution,
      observed_model_calls: 0
    }));
    const recoverable = await loadGi088FlashDailyContextV3PriorZeroCallFailures(
      root,
      parentExecution
    );
    expect(recoverable).toEqual([expect.objectContaining({
      run_id: "flash-daily-context-v3-zero-call",
      lock_sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      attempt_ledger_sha256: null
    })]);

    const reservedDirectory = resolve(root, "flash-daily-context-v3-reserved-call");
    await mkdir(reservedDirectory);
    await writeFile(resolve(reservedDirectory, "round-run.lock.json"), JSON.stringify({
      round_id: "flash-daily-context-v3",
      status: "failed",
      mode: "real",
      parent_execution_fingerprint: parentExecution,
      observed_model_calls: 0
    }));
    await writeFile(resolve(reservedDirectory, "attempt-ledger.ndjson"), `${JSON.stringify({
      event: "call_reserved",
      sequence: 1
    })}\n`);
    await expect(loadGi088FlashDailyContextV3PriorZeroCallFailures(root, parentExecution))
      .rejects.toThrow(/PRIOR_REAL_ROUND_EXISTS/u);
    await expect(loadGi088FlashDailyContextV3PriorZeroCallFailures(
      root,
      parentExecution,
      "flash-daily-context-v3-reserved-call"
    )).resolves.toEqual(recoverable);
  });

  it("runner 会在任何模型调用前拒绝与运行模式不一致的 Provider", async () => {
    const id = runId("provider-identity");
    const directory = resolve(
      process.cwd(),
      "artifacts/journal-generation-evaluation/.private/round3-mock",
      id
    );
    written.push(directory);
    const complete = vi.fn(async (request: Gi088CalibrationProviderRequest) => goodResult(request));
    await expect(runGi088FlashDailyContextV3({
      mode: "mock",
      confirmPrivateReplay: false,
      confirmScopeFingerprint: null,
      confirmParentExecutionFingerprint: null,
      maxCalls: 6,
      maxCallsExplicit: true,
      runId: id
    }, process.env, {
      ...EMPTY_REAL_ROUND_HISTORY,
      createMockProvider: () => ({
        kind: "real",
        name: "deepseek_official_openai_compatible",
        complete
      })
    })).rejects.toThrow(/MOCK_PROVIDER_IDENTITY_MISMATCH/u);
    expect(complete).not.toHaveBeenCalled();
    const lock = JSON.parse(await readFile(
      resolve(directory, "round-run.lock.json"),
      "utf8"
    )) as { status: string; observed_model_calls: number };
    expect(lock).toMatchObject({ status: "failed", observed_model_calls: 0 });
  });

  it("v2 对比裁决必须与总体裁决绑定同一案例、展示身份和评审人", () => {
    const review = {
      schema_version: "1.0",
      round_id: "flash-daily-prompt-v2",
      event_type: "round_decision",
      case_id: "case-1",
      presentation_id: "presentation-1",
      reviewer_id: "reviewer-1",
      reviewed_at: "2026-08-11T00:00:00.000Z"
    };
    const wrongComparison = {
      ...review,
      event_type: "comparison_decision",
      presentation_id: "presentation-other"
    };
    expect(() => selectGi088FlashDailyContextV3ParentReview({
      reviewEvents: [review, wrongComparison],
      caseId: "case-1"
    })).toThrow(/PARENT_COMPARISON_IDENTITY_MISMATCH/u);

    const comparison = {
      ...wrongComparison,
      presentation_id: review.presentation_id,
      reviewer_id: review.reviewer_id
    };
    expect(selectGi088FlashDailyContextV3ParentReview({
      reviewEvents: [review, wrongComparison, comparison],
      caseId: "case-1"
    })).toEqual({ review, comparison });
  });

  it("客观质量门拦截无效来源、遗漏、失效纠正复活和 Thinking 漂移", () => {
    const sourceRecord = {
      recordId: "record-1",
      eventId: "event-1",
      entryDate: "2026-08-11",
      daySequence: 1,
      title: "记录",
      content: "我最后选择先慢下来。",
      contentRevision: 1,
      updatedAt: "2026-08-11T12:00:00.000Z"
    };
    const assessed = assessGi088FlashDailyContextV3Output({
      content: JSON.stringify({
        paragraphs: [{ text: "我决定马上冲过去。", sourceRecordIds: ["unknown"] }]
      }),
      finishReason: "stop",
      responseModel: "deepseek-v4-flash",
      reasoningPresent: true,
      reasoningTokens: 0,
      sourceRecord,
      invalidatedPhrases: ["马上冲过去"]
    });
    expect(assessed.accepted).toBe(false);
    expect(assessed.issues).toEqual(expect.arrayContaining([
      expect.stringContaining("SOURCE_RECORD_ID_UNKNOWN"),
      expect.stringContaining("SOURCE_RECORD_UNCOVERED"),
      "DAILY_JOURNAL_INVALIDATED_CONTENT_RESURRECTED",
      "DAILY_JOURNAL_THINKING_NOT_DISABLED"
    ]));
  });

  it("问题语境只配对最近的 AI 问句与紧随其后的有效用户回答", () => {
    const source = {
      projection: {
        transcript: [
          { ref: "context:assistant:a1", role: "assistant", content: "较早的问题？", citable: false },
          { ref: "context:assistant:a2", role: "assistant", content: "前情说明。最近的问题？", citable: false },
          { ref: "message:u-direct", role: "user", content: "直接来源回答", citable: true },
          { ref: "context:assistant:a3", role: "assistant", content: "这条会被无效回答消耗？", citable: false },
          { ref: "message:u-ignored", role: "user", content: "不在当前卡来源中", citable: true },
          { ref: "message:u-insight", role: "user", content: "不能跨过上一条用户消息配对", citable: true },
          { ref: "context:assistant:a4", role: "assistant", content: "中间有问号？最后是陈述。", citable: false },
          { ref: "message:u-insight", role: "user", content: "陈述不形成问答语境", citable: true },
          { ref: "context:assistant:a5", role: "assistant", content: "前文说明。保留这一问？", citable: false },
          { ref: "context:system:s1", role: "system", content: "系统消息", citable: false },
          { ref: "message:u-insight", role: "user", content: "认识证据回答", citable: true },
          { ref: "context:assistant:a6", role: "assistant", content: "无人回答的问题？", citable: false }
        ],
        validUnderstandings: [{
          ref: "understanding:insight-1",
          stateId: "insight-1",
          summary: "当前有效认识",
          evidenceRefs: ["message:u-insight"]
        }],
        invalidations: [],
        corrections: []
      }
    } as unknown as LoadedGi088CalibrationCase;
    const material = buildGi088FlashDailyWritingMaterialV3({
      recordCard: {
        record_card_id: "record-1",
        event_id: "event-1",
        title: "记录",
        text: "事件正文",
        insight: "当前有效认识",
        source_refs: ["message:u-direct", "understanding:insight-1"]
      },
      source
    });

    expect(material.questionContext).toEqual([
      { answerSourceMessageId: "u-direct", question: "最近的问题？" },
      { answerSourceMessageId: "u-insight", question: "保留这一问？" }
    ]);
  });

  it("自然写作诊断单独记录，不会升级为 P0 拒绝", () => {
    const sourceRecord = {
      recordId: "record-1",
      eventId: "event-1",
      entryDate: "2026-08-11",
      daySequence: 1,
      title: "记录",
      content: "我今天把手头的事情整理清楚了。",
      contentRevision: 1,
      updatedAt: "2026-08-11T12:00:00.000Z",
      writingMaterial: {
        eventText: "我今天把手头的事情整理清楚了。",
        supportedInsights: [],
        questionContext: [],
        basedOnContentRevision: 1
      }
    };
    const assessed = assessGi088FlashDailyContextV3Output({
      content: JSON.stringify({
        paragraphs: [{ text: sourceRecord.content, sourceRecordIds: [sourceRecord.recordId] }]
      }),
      finishReason: "stop",
      responseModel: "deepseek-v4-flash",
      reasoningPresent: false,
      reasoningTokens: 0,
      sourceRecord
    });

    expect(assessed.accepted).toBe(true);
    expect(assessed.issues).toEqual([]);
    expect(assessed.diagnostics).toContain("SOURCE_RECORD_VERBATIM_COPY");
  });

  it("模拟回归只调用 Flash 的三条 daily_journal，正常总调用固定为三次", async () => {
    const id = runId("nominal");
    written.push(resolve(
      process.cwd(),
      "artifacts/journal-generation-evaluation/.private/round3-mock",
      id
    ));
    const calls: Gi088CalibrationProviderRequest[] = [];
    const provider: Gi088CalibrationProvider = {
      kind: "mock",
      name: "mock-flash-v3",
      async complete(request) {
        calls.push(request);
        return goodResult(request);
      }
    };
    const priorZeroCallFailures = [{
      run_id: "flash-daily-context-v3-prior-preflight-failure",
      lock_sha256: "a".repeat(64),
      attempt_ledger_sha256: null
    }];
    const result = await runGi088FlashDailyContextV3({
      mode: "mock",
      confirmPrivateReplay: false,
      confirmScopeFingerprint: null,
      confirmParentExecutionFingerprint: null,
      maxCalls: 6,
      maxCallsExplicit: true,
      runId: id
    }, process.env, {
      createMockProvider: () => provider,
      loadPriorZeroCallFailures: async () => priorZeroCallFailures
    });
    if ("plan" in result) throw new Error("expected mock result");
    expect(calls).toHaveLength(3);
    expect(calls.every((call) => call.stage === "daily_journal"
      && call.model.model === "deepseek-v4-flash"
      && call.runtime === GI088_JOURNAL_CALIBRATION_RUNTIME)).toBe(true);
    for (const call of calls) {
      const userMessage = call.messages.find((message) => message.role === "user");
      const input = JSON.parse(userMessage?.content ?? "{}") as {
        entryDate?: string;
        deterministicTitle?: string;
        currentRecords?: Array<{
          title?: string;
          eventId?: string;
          entryDate?: string;
          updatedAt?: string;
          contentRevision?: number;
          content?: string;
          writingMaterial?: {
            eventText?: string;
            supportedInsights?: string[];
            questionContext?: Array<{
              answerSourceMessageId?: string;
              question?: string;
            }>;
            basedOnContentRevision?: number;
          };
        }>;
      };
      const record = input.currentRecords?.[0];
      expect(input).not.toHaveProperty("entryDate");
      expect(input).not.toHaveProperty("deterministicTitle");
      for (const hiddenField of [
        "title",
        "eventId",
        "entryDate",
        "updatedAt",
        "contentRevision"
      ]) {
        expect(record).not.toHaveProperty(hiddenField);
      }
      expect(record?.writingMaterial).not.toHaveProperty("basedOnContentRevision");
      expect(record?.writingMaterial?.eventText?.length).toBeGreaterThan(0);
      expect(record?.writingMaterial?.supportedInsights?.length).toBeGreaterThan(0);
      expect(record?.writingMaterial?.questionContext?.length).toBeGreaterThan(0);
      expect(record?.writingMaterial?.questionContext?.every((item) =>
        Boolean(item.answerSourceMessageId && item.question)
      )).toBe(true);
      expect(record?.content).toBe(call.sourceRecordTextById[call.sourceRecordIds[0]]);
      expect(userMessage?.content).not.toContain('"transcript"');
    }
    expect(result.package.run).toMatchObject({
      actual_model_calls: 3,
      technical_retries: 0,
      quality_retries: 0,
      admitted_cases: 3
    });
    expect(result.package.prompt).toEqual({
      version: JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION,
      system_prompt_sha256: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH
    });
    expect(result.package.runtime).toMatchObject({
      provider: "openai_compatible_rest",
      base_url: "https://api.deepseek.com",
      headers_timeout_ms: 15_000,
      body_idle_timeout_ms: 45_000,
      hard_timeout_ms: 60_000,
      max_tokens_policy: "provider_default",
      provider_adapter: "mock-flash-v3"
    });
    expect(result.package.prior_zero_call_failures).toEqual(priorZeroCallFailures);
    const snapshotPaths = new Set(result.package.code_snapshot.map((item) => item.path));
    expect(snapshotPaths.has("prisma/schema.prisma")).toBe(true);
    expect(snapshotPaths.has("src/server/repositories/journal-event-entry.repository.ts")).toBe(true);
    expect(snapshotPaths.has("src/server/services/interview/journal-event-entry.service.ts")).toBe(true);
    expect(result.package.cases.every((item) => item.record_card_sha256.length === 64)).toBe(true);
    expect(result.package.cases.every((item) =>
      item.writing_material_sha256.length === 64
      && item.writing_material_revision_binding_sha256.length === 64
      && item.writing_material_based_on_content_revision === 1
      && item.writing_material_supported_insight_count > 0
      && item.writing_material_question_context_count > 0
      && !Object.prototype.hasOwnProperty.call(item, "writing_material")
      && item.parent_review.scores.fidelity_completeness >= 1
      && Array.isArray(item.parent_review.issue_tags)
      && Array.isArray(item.parent_review.note_additions)
      && typeof item.parent_review.comparison_verdict === "string"
      && typeof item.parent_review.comparison_note === "string"
    )).toBe(true);
    expect(result.package.cases.every((item) =>
      item.candidate.program_check.admitted
      && item.candidate.program_check.failures.length === 0
      && item.candidate.program_check.diagnostics.includes("SOURCE_RECORD_VERBATIM_COPY")
      && item.candidate.trace.reasoning_tokens === 0
    )).toBe(true);
    expect(Object.keys(result.package.parent.artifacts).sort()).toEqual([
      "manifest_sha256",
      "package_sha256",
      "review_drafts_sha256",
      "reviews_sha256"
    ]);
    expect(result.package.parent.transitive_artifacts).toEqual(
      GI088_FLASH_DAILY_CONTEXT_V3_LOCKED_PARENT_TRANSITIVE_ARTIFACTS
    );
    const ledgerEvents = (await readFile(
      resolve(result.outputDirectory, "attempt-ledger.ndjson"),
      "utf8"
    )).trim().split("\n").map((line) => JSON.parse(line) as {
      event: string;
      provider_adapter?: string;
    });
    expect(ledgerEvents).toHaveLength(6);
    expect(ledgerEvents.every((event) => event.provider_adapter === "mock-flash-v3")).toBe(true);
  });

  it("真实来源中的旧认识复活时，runCase 会通过失效语义摘要拦截", async () => {
    const id = runId("invalidation");
    written.push(resolve(
      process.cwd(),
      "artifacts/journal-generation-evaluation/.private/round3-mock",
      id
    ));
    const sources = await loadGi088CalibrationSources(process.cwd());
    const invalidatedByCase = new Map<string, string | null>(sources.map((source) => [
      source.selection.caseId,
      source.invalidatedUnderstandingSummaries[0] ?? null
    ]));
    expect([...invalidatedByCase.values()].filter(Boolean).length).toBeGreaterThanOrEqual(2);
    const provider: Gi088CalibrationProvider = {
      kind: "mock",
      name: "invalidation-mock",
      async complete(request) {
        const invalidated = invalidatedByCase.get(request.caseId);
        if (!invalidated) return goodResult(request);
        const recordId = request.sourceRecordIds[0];
        return {
          ...goodResult(request),
          content: JSON.stringify({
            paragraphs: [{ text: invalidated, sourceRecordIds: [recordId] }]
          })
        };
      }
    };
    const result = await runGi088FlashDailyContextV3({
      mode: "mock",
      confirmPrivateReplay: false,
      confirmScopeFingerprint: null,
      confirmParentExecutionFingerprint: null,
      maxCalls: 6,
      maxCallsExplicit: true,
      runId: id
    }, process.env, {
      ...EMPTY_REAL_ROUND_HISTORY,
      createMockProvider: () => provider
    });
    if ("plan" in result) throw new Error("expected mock result");

    for (const item of result.package.cases) {
      const invalidated = invalidatedByCase.get(item.case_id);
      expect(item.invalidated_understanding_summary_count).toBe(invalidated ? 1 : 0);
      expect(item.invalidated_understanding_summaries_sha256).toHaveLength(64);
      if (!invalidated) continue;
      expect(item.candidate.program_check.admitted).toBe(false);
      expect(item.candidate.program_check.failures).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "DAILY_JOURNAL_INVALIDATED_CONTENT_RESURRECTED" })
      ]));
    }
  });

  it("reasoningPresent 为 false 但 reasoning token 为正数时仍拦截 Thinking 漂移", async () => {
    const id = runId("reasoning-tokens");
    written.push(resolve(
      process.cwd(),
      "artifacts/journal-generation-evaluation/.private/round3-mock",
      id
    ));
    const provider: Gi088CalibrationProvider = {
      kind: "mock",
      name: "reasoning-token-mock",
      async complete(request) {
        return { ...goodResult(request), reasoningPresent: false, reasoningTokens: 9 };
      }
    };
    const result = await runGi088FlashDailyContextV3({
      mode: "mock",
      confirmPrivateReplay: false,
      confirmScopeFingerprint: null,
      confirmParentExecutionFingerprint: null,
      maxCalls: 6,
      maxCallsExplicit: true,
      runId: id
    }, process.env, {
      ...EMPTY_REAL_ROUND_HISTORY,
      createMockProvider: () => provider
    });
    if ("plan" in result) throw new Error("expected mock result");

    expect(result.package.run.actual_model_calls).toBe(3);
    expect(result.package.cases.every((item) =>
      !item.candidate.program_check.admitted
      && item.candidate.trace.reasoning_present === false
      && item.candidate.trace.reasoning_tokens === 9
      && item.candidate.program_check.failures.some(
        (failure) => failure.code === "DAILY_JOURNAL_THINKING_NOT_DISABLED"
      )
    )).toBe(true);
  });

  it("模型成功后的本地完成账本写入失败会终止整轮，且不会重试模型", async () => {
    const id = runId("ledger-failure");
    const directory = resolve(
      process.cwd(),
      "artifacts/journal-generation-evaluation/.private/round3-mock",
      id
    );
    written.push(directory);
    const complete = vi.fn(async (request: Gi088CalibrationProviderRequest) => goodResult(request));
    const appendLedger = vi.fn(async (path: string, value: unknown) => {
      if (typeof value === "object" && value !== null
        && "event" in value && value.event === "call_completed") {
        throw new Error("LOCAL_LEDGER_WRITE_FAILED");
      }
      await appendGi088FlashDailyContextV3Ledger(path, value);
    });

    await expect(runGi088FlashDailyContextV3({
      mode: "mock",
      confirmPrivateReplay: false,
      confirmScopeFingerprint: null,
      confirmParentExecutionFingerprint: null,
      maxCalls: 6,
      maxCallsExplicit: true,
      runId: id
    }, process.env, {
      ...EMPTY_REAL_ROUND_HISTORY,
      createMockProvider: () => ({ kind: "mock", name: "ledger-failure-mock", complete }),
      appendLedger
    })).rejects.toThrow(/LOCAL_LEDGER_WRITE_FAILED/u);

    expect(complete).toHaveBeenCalledTimes(1);
    const ledger = (await readFile(resolve(directory, "attempt-ledger.ndjson"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { event: string });
    expect(ledger.map((item) => item.event)).toEqual(["call_reserved"]);
    const lock = JSON.parse(await readFile(
      resolve(directory, "round-run.lock.json"),
      "utf8"
    )) as { status: string; observed_model_calls: number };
    expect(lock).toMatchObject({ status: "failed", observed_model_calls: 1 });
  });

  it("调用预约账本写入失败时保持零调用，并禁止触发模型", async () => {
    const id = runId("reservation-failure");
    const directory = resolve(
      process.cwd(),
      "artifacts/journal-generation-evaluation/.private/round3-mock",
      id
    );
    written.push(directory);
    const complete = vi.fn(async (request: Gi088CalibrationProviderRequest) => goodResult(request));

    await expect(runGi088FlashDailyContextV3({
      mode: "mock",
      confirmPrivateReplay: false,
      confirmScopeFingerprint: null,
      confirmParentExecutionFingerprint: null,
      maxCalls: 6,
      maxCallsExplicit: true,
      runId: id
    }, process.env, {
      ...EMPTY_REAL_ROUND_HISTORY,
      createMockProvider: () => ({ kind: "mock", name: "reservation-failure-mock", complete }),
      appendLedger: async () => {
        throw new Error("LOCAL_RESERVATION_WRITE_FAILED");
      }
    })).rejects.toThrow(/LOCAL_RESERVATION_WRITE_FAILED/u);

    expect(complete).not.toHaveBeenCalled();
    const lock = JSON.parse(await readFile(
      resolve(directory, "round-run.lock.json"),
      "utf8"
    )) as { status: string; observed_model_calls: number };
    expect(lock).toMatchObject({ status: "failed", observed_model_calls: 0 });
  });

  it("质量失败保留首个响应且不触发模型重写", async () => {
    const id = runId("quality");
    written.push(resolve(
      process.cwd(),
      "artifacts/journal-generation-evaluation/.private/round3-mock",
      id
    ));
    const complete = vi.fn(async () => ({
      content: "{invalid-json",
      latencyMs: 5,
      provider: "mock-flash-v3",
      finishReason: "stop",
      tokenUsage: null,
      reasoningPresent: false,
      responseModel: "deepseek-v4-flash"
    }));
    const result = await runGi088FlashDailyContextV3({
      mode: "mock",
      confirmPrivateReplay: false,
      confirmScopeFingerprint: null,
      confirmParentExecutionFingerprint: null,
      maxCalls: 6,
      maxCallsExplicit: true,
      runId: id
    }, process.env, {
      ...EMPTY_REAL_ROUND_HISTORY,
      createMockProvider: () => ({ kind: "mock", name: "quality-mock", complete })
    });
    if ("plan" in result) throw new Error("expected mock result");
    expect(complete).toHaveBeenCalledTimes(3);
    expect(result.package.run).toMatchObject({ actual_model_calls: 3, quality_retries: 0 });
    expect(result.package.cases.every((item) =>
      item.candidate.program_check.failures.some((failure) => failure.code === "DAILY_JOURNAL_JSON_INVALID")
    )).toBe(true);
  });

  it("每条技术失败最多重试一次，三条累计调用不会超过六次", async () => {
    const id = runId("retry");
    written.push(resolve(
      process.cwd(),
      "artifacts/journal-generation-evaluation/.private/round3-mock",
      id
    ));
    const attempts = new Map<string, number>();
    const complete = vi.fn(async (request: Gi088CalibrationProviderRequest) => {
      const count = (attempts.get(request.caseId) ?? 0) + 1;
      attempts.set(request.caseId, count);
      if (count === 1) throw new Gi088CalibrationProviderError("TIMEOUT", true, 60_000);
      return goodResult(request);
    });
    const result = await runGi088FlashDailyContextV3({
      mode: "mock",
      confirmPrivateReplay: false,
      confirmScopeFingerprint: null,
      confirmParentExecutionFingerprint: null,
      maxCalls: 6,
      maxCallsExplicit: true,
      runId: id
    }, process.env, {
      ...EMPTY_REAL_ROUND_HISTORY,
      createMockProvider: () => ({ kind: "mock", name: "retry-mock", complete })
    });
    if ("plan" in result) throw new Error("expected mock result");
    expect(complete).toHaveBeenCalledTimes(6);
    expect(result.package.run).toMatchObject({
      actual_model_calls: 6,
      technical_retries: 3,
      quality_retries: 0,
      admitted_cases: 3
    });
  });
});
