import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  GI088_JOURNAL_CALIBRATION_CASES,
  GI088_JOURNAL_CALIBRATION_MODELS,
  GI088_JOURNAL_CALIBRATION_RUNTIME,
  GI088_JOURNAL_CALIBRATION_SCOPE_FINGERPRINT,
  sha256Text,
  type Gi088CalibrationProvider,
  type Gi088CalibrationProviderRequest
} from "../../scripts/journal-generation-eval/gi088-calibration-contract";
import {
  createGi088MockCalibrationProvider,
  createGi088OpenAICompatibleCalibrationProvider,
  Gi088CalibrationProviderError
} from "../../scripts/journal-generation-eval/gi088-calibration-provider";
import {
  loadGi088CalibrationSources,
  projectGi088CalibrationSource,
  runGi088DailyContinuation,
  runGi088JournalCalibration,
  type Gi088CalibrationCodeSnapshot,
  type LoadedGi088CalibrationCase
} from "../../scripts/journal-generation-eval/gi088-calibration-runner";
import {
  parseGi088CalibrationArgs,
  resolveGi088CalibrationCredential,
  runGi088CalibrationCli,
  validateGi088CalibrationModels
} from "../../scripts/journal-generation-eval/run-gi088-calibration";

const PROJECT_ROOT = process.cwd();
const PRIVATE_FORMAL_ROOT = resolve(
  PROJECT_ROOT,
  "artifacts/journal-generation-evaluation/.private/formal"
);
const CODE_SNAPSHOT: Gi088CalibrationCodeSnapshot = {
  git_head: "a".repeat(40),
  worktree_dirty: true,
  worktree_status_sha256: "b".repeat(64),
  files: []
};

function firstGroundedSource(request: Gi088CalibrationProviderRequest) {
  const ref = request.sourceRefs[0] ?? "message:missing";
  return { ref, text: request.sourceTextByRef[ref] ?? "这件事" };
}

function successfulMockResponse(request: Gi088CalibrationProviderRequest) {
  if (request.stage === "record_card") {
    const source = firstGroundedSource(request);
    return {
      content: JSON.stringify({
        title: {
          text: [...source.text.replace(/\s+/gu, "")].slice(0, 12).join("") || "这件事",
          sourceRefs: [source.ref]
        },
        occurredAtText: null,
        blocks: [{ kind: "event", text: source.text, sourceRefs: [source.ref] }]
      }),
      latencyMs: 9,
      provider: "mock",
      finishReason: "stop",
      tokenUsage: {
        promptTokens: 100,
        completionTokens: 40,
        totalTokens: 140,
        promptCacheHitTokens: 20,
        promptCacheMissTokens: 80
      },
      upstreamRequestId: `mock-${request.callFingerprint.slice(0, 12)}`,
      reasoningPresent: false,
      responseModel: request.model.model
    };
  }
  const recordId = request.sourceRecordIds[0] ?? "record:missing";
  return {
    content: JSON.stringify({
      paragraphs: [{
        text: request.sourceRecordTextById[recordId] ?? "这件事",
        sourceRecordIds: [recordId]
      }]
    }),
    latencyMs: 9,
    provider: "mock",
    finishReason: "stop",
    tokenUsage: {
      promptTokens: 100,
      completionTokens: 40,
      totalTokens: 140,
      promptCacheHitTokens: 20,
      promptCacheMissTokens: 80
    },
    upstreamRequestId: `mock-${request.callFingerprint.slice(0, 12)}`,
    reasoningPresent: false,
    responseModel: request.model.model
  };
}

function realKindMockProvider(): Gi088CalibrationProvider {
  return {
    kind: "real",
    name: "real-kind-mock",
    complete: async (request) => successfulMockResponse(request)
  };
}

async function historicalBlockLimitParent(sources: LoadedGi088CalibrationCase[]) {
  const provider = createGi088MockCalibrationProvider();
  const result = await runGi088JournalCalibration({
    mode: "mock",
    provider,
    sources,
    maxCalls: 24,
    generatedAt: "2026-08-10T00:00:00.000Z",
    codeSnapshot: CODE_SNAPSHOT
  });
  if (result.mode === "dry-run") throw new Error("unexpected dry run");
  const historicalPackage = structuredClone(result.package);
  const historicalIdentityMap = structuredClone(result.identityMap);
  const targets = new Set([
    `${historicalPackage.packets[1].case_id}:${historicalPackage.packets[1].candidates[0].candidate_id}`,
    `${historicalPackage.packets[1].case_id}:${historicalPackage.packets[1].candidates[1].candidate_id}`,
    `${historicalPackage.packets[2].case_id}:${historicalPackage.packets[2].candidates[0].candidate_id}`
  ]);
  const targetRecordResponses = new Map<string, { content: string; sha256: string }>();
  historicalPackage.packets.forEach((packet) => {
    packet.candidates.forEach((candidate) => {
      const key = `${packet.case_id}:${candidate.candidate_id}`;
      if (!targets.has(key)) return;
      const recordRaw = historicalPackage.raw_responses.find((response) =>
        response.case_id === packet.case_id
        && response.candidate_id === candidate.candidate_id
        && response.stage === "record_card"
      );
      if (!recordRaw) throw new Error("missing record response");
      const parsed = JSON.parse(recordRaw.content) as {
        title: { text: string; sourceRefs: string[] };
        occurredAtText: string | null;
        blocks: Array<{ kind: "event" | "insight"; text: string; sourceRefs: string[] }>;
      };
      const base = parsed.blocks[0];
      const labels = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
      const content = JSON.stringify({
        ...parsed,
        blocks: labels.map((label, index) => ({
          ...base,
          kind: index === labels.length - 1 ? "insight" : "event",
          text: `${base.text}（片段${label}）`
        }))
      });
      const sha256 = sha256Text(content);
      targetRecordResponses.set(key, { content, sha256 });
      const recordAttempt = candidate.trace.attempts.find((attempt) =>
        attempt.stage === "record_card"
      );
      if (!recordAttempt) throw new Error("missing record attempt");
      recordAttempt.raw_response_sha256 = sha256;
      candidate.record_cards = [];
      candidate.paragraphs = [];
      candidate.program_check = {
        admitted: false,
        metrics: {
          record_card_rule_rate: 0,
          daily_rule_rate: 0,
          source_mapping_rate: 0,
          technical_stage_completion_rate: 0.5,
          quality_retry_count: 0
        },
        failures: [{
          code: "RECORD_CARD_QUALITY_FAILED",
          message: "模型输出未通过确定性质量检查；该质量失败不会触发重试。",
          refs: ["RECORD_CARD_SCHEMA_INVALID:blocks:too_big"]
        }],
        checks: [
          {
            check: "record_card_source_and_schema_gate",
            passed: false,
            issues: ["RECORD_CARD_SCHEMA_INVALID:blocks:too_big"]
          },
          {
            check: "daily_journal_schema_source_and_coverage_gate",
            passed: false,
            issues: ["DAILY_JOURNAL_SKIPPED_RECORD_CARD_UNAVAILABLE"]
          },
          {
            check: "runtime_temperature_thinking_timeout",
            passed: true,
            issues: []
          },
          {
            check: "requested_and_response_model_match",
            passed: true,
            issues: []
          },
          {
            check: "source_hashes_frozen",
            passed: true,
            issues: []
          }
        ]
      };
      candidate.trace.attempts = [recordAttempt];
      candidate.trace.prompt_hashes.daily_journal = null;
      candidate.trace.output_origin.record_card = "unavailable";
      candidate.trace.output_origin.daily_journal = "unavailable";
      candidate.trace.raw_response_hashes = {
        record_card: sha256,
        daily_journal: null
      };
    });
  });
  historicalPackage.raw_responses = historicalPackage.raw_responses.flatMap((response) => {
    const key = `${response.case_id}:${response.candidate_id}`;
    if (!targets.has(key)) return [response];
    if (response.stage === "daily_journal") return [];
    const replacement = targetRecordResponses.get(key);
    if (!replacement) throw new Error("missing replacement record response");
    return [{ ...response, ...replacement }];
  });
  historicalPackage.run = {
    ...historicalPackage.run,
    actual_model_calls: 9,
    admitted_candidates: 3
  };
  return { historicalPackage, historicalIdentityMap, targets };
}

describe("GI-088 日记生成首轮校准 runner", () => {
  let sources: LoadedGi088CalibrationCase[];
  const temporaryDirectories: string[] = [];

  beforeAll(async () => {
    sources = await loadGi088CalibrationSources(PROJECT_ROOT);
  });

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true }))
    );
  });

  it("用真实私有索引固定三条轨迹，并保留 v7r4 的 revise 当前认识", () => {
    expect(sources).toHaveLength(3);
    expect(sources.map((source) => source.selection.caseId)).toEqual(
      GI088_JOURNAL_CALIBRATION_CASES.map((item) => item.caseId)
    );
    const revised = sources.find((source) => source.selection.sourceGroupId === "sg-gi088-v7r4-pro");
    expect(revised).toBeDefined();
    const reviseCorrection = revised!.projection.corrections.find(
      (correction) => correction.kind === "revise"
    );
    expect(reviseCorrection).toBeDefined();
    expect(reviseCorrection!.replacementSummary).toBeTruthy();
    expect(revised!.projection.invalidations).not.toContain(reviseCorrection!.targetRef);
    expect(revised!.projection.validUnderstandings).toContainEqual(
      expect.objectContaining({
        ref: reviseCorrection!.targetRef,
        summary: reviseCorrection!.replacementSummary
      })
    );
    expect(revised!.projection.transcript.some((message) =>
      message.role === "assistant" && !message.citable
    )).toBe(true);
  });

  it("拒绝无法回到用户原话的有效认识证据", async () => {
    const selection = GI088_JOURNAL_CALIBRATION_CASES[1];
    const raw = JSON.parse(
      await readFile(resolve(PROJECT_ROOT, selection.sourcePath), "utf8")
    ) as Record<string, unknown>;
    const batch = raw.batch as Record<string, unknown>;
    const task = (batch.tasks as Array<Record<string, unknown>>).find(
      (item) => item.taskId === selection.taskId
    )!;
    const branch = (task.branches as Record<string, Record<string, unknown>>)[selection.branch];
    const semanticState = branch.semanticState as Record<string, unknown>;
    const understandings = semanticState.understandings as Array<Record<string, unknown>>;
    understandings[0] = { ...understandings[0], evidenceRefs: ["missing-user-message"] };
    expect(() => projectGi088CalibrationSource({ selection, rawExport: raw })).toThrow(
      /GI088_JOURNAL_UNDERSTANDING_EVIDENCE_REF_INVALID/u
    );
  });

  it("完成 3 案例 × 2 模型 × 2 层模拟回归并冻结私有包", async () => {
    const provider = createGi088MockCalibrationProvider();
    const result = await runGi088JournalCalibration({
      mode: "mock",
      provider,
      sources,
      maxCalls: 24,
      generatedAt: "2026-08-10T00:00:00.000Z",
      codeSnapshot: CODE_SNAPSHOT
    });
    expect(result.mode).toBe("mock");
    if (result.mode === "dry-run") throw new Error("unexpected dry run");
    expect(result.package.run).toMatchObject({
      planned_model_calls: 12,
      actual_model_calls: 12,
      technical_retries: 0,
      completed_candidates: 6,
      admitted_candidates: 6
    });
    expect(result.package.packets).toHaveLength(3);
    expect(result.package.packets.every((packet) => packet.candidates.length === 2)).toBe(true);
    expect(result.package.raw_responses).toHaveLength(12);
    expect(result.identityMap.identities).toHaveLength(6);
    expect(new Set(provider.calls.map((call) => call.callFingerprint)).size).toBe(12);
    expect(result.package.provider_preflight).toBeNull();
  });

  it("技术超时只重试一次，并把失败 attempt 与成本分开留证", async () => {
    let first = true;
    const provider: Gi088CalibrationProvider = {
      kind: "mock",
      name: "one-timeout-then-success",
      async complete(request) {
        if (first) {
          first = false;
          throw new Gi088CalibrationProviderError("TIMEOUT", true, 60_000);
        }
        return successfulMockResponse(request);
      }
    };
    const result = await runGi088JournalCalibration({
      mode: "mock",
      provider,
      sources,
      maxCalls: 24,
      codeSnapshot: CODE_SNAPSHOT
    });
    if (result.mode === "dry-run") throw new Error("unexpected dry run");
    expect(result.package.run.actual_model_calls).toBe(13);
    expect(result.package.run.technical_retries).toBe(1);
    expect(result.package.raw_responses).toHaveLength(12);
    expect(result.package.packets[0].candidates[0].trace.attempts.slice(0, 2)).toEqual([
      expect.objectContaining({
        attempt: 1,
        outcome: "technical_failure",
        error_code: "TIMEOUT",
        retry_scheduled: true
      }),
      expect.objectContaining({ attempt: 2, outcome: "valid_response" })
    ]);
  });

  it("记录卡质量失败保留原响应、零质量重试，并跳过日记层", async () => {
    const provider = createGi088MockCalibrationProvider((request) => {
      if (request.stage === "daily_journal") {
        throw new Error("daily journal must be skipped");
      }
      return {
        ...successfulMockResponse(request),
        content: "{invalid-json"
      };
    });
    const result = await runGi088JournalCalibration({
      mode: "mock",
      provider,
      sources,
      maxCalls: 24,
      codeSnapshot: CODE_SNAPSHOT
    });
    if (result.mode === "dry-run") throw new Error("unexpected dry run");
    expect(result.package.run.actual_model_calls).toBe(6);
    expect(result.package.run.quality_retries).toBe(0);
    expect(result.package.raw_responses).toHaveLength(6);
    expect(provider.calls.every((call) => call.stage === "record_card")).toBe(true);
    expect(result.package.packets.flatMap((packet) => packet.candidates).every((candidate) =>
      candidate.record_cards.length === 0 &&
      candidate.paragraphs.length === 0 &&
      candidate.trace.output_origin.daily_journal === "unavailable" &&
      !candidate.program_check.admitted
    )).toBe(true);
  });

  it("完整跑批继续把超过八块视为严格失败，并跳过日记层", async () => {
    const provider = createGi088MockCalibrationProvider((request) => {
      if (request.stage === "daily_journal") return successfulMockResponse(request);
      const source = firstGroundedSource(request);
      const labels = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
      return {
        ...successfulMockResponse(request),
        content: JSON.stringify({
          title: { text: "完整记录", sourceRefs: [source.ref] },
          occurredAtText: null,
          blocks: Array.from({ length: 9 }, (_, index) => ({
            kind: index === 8 ? "insight" : "event",
            text: `${source.text}（片段${labels[index]}）`,
            sourceRefs: [source.ref]
          }))
        })
      };
    });
    const result = await runGi088JournalCalibration({
      mode: "mock",
      provider,
      sources,
      maxCalls: 24,
      codeSnapshot: CODE_SNAPSHOT
    });
    if (result.mode === "dry-run") throw new Error("unexpected dry run");
    expect(result.package.run.actual_model_calls).toBe(6);
    expect(result.package.run.quality_retries).toBe(0);
    expect(result.package.raw_responses).toHaveLength(6);
    expect(result.package.packets.flatMap((packet) => packet.candidates).every((candidate) =>
      candidate.record_cards.length === 0
      && candidate.paragraphs.length === 0
      && !candidate.program_check.admitted
      && candidate.program_check.failures.some((failure) =>
        failure.refs.includes("RECORD_CARD_SCHEMA_INVALID:blocks:too_big")
      )
      && candidate.program_check.checks.some((check) =>
        check.check === "daily_journal_schema_source_and_coverage_gate"
        && check.issues.includes("DAILY_JOURNAL_SKIPPED_RECORD_CARD_UNAVAILABLE")
      )
    )).toBe(true);
  });

  it("记录卡返回错误模型或隐藏推理时停止该候选的日记调用", async () => {
    for (const violation of ["model", "reasoning"] as const) {
      const provider = createGi088MockCalibrationProvider((request) => ({
        ...successfulMockResponse(request),
        ...(violation === "model"
          ? { responseModel: "unexpected-model" }
          : { reasoningPresent: true })
      }));
      const result = await runGi088JournalCalibration({
        mode: "mock",
        provider,
        sources,
        maxCalls: 24,
        codeSnapshot: CODE_SNAPSHOT
      });
      if (result.mode === "dry-run") throw new Error("unexpected dry run");
      expect(result.package.run.actual_model_calls).toBe(6);
      expect(provider.calls.every((call) => call.stage === "record_card")).toBe(true);
      expect(result.package.packets.flatMap((packet) => packet.candidates).every((candidate) =>
        candidate.paragraphs.length === 0 && !candidate.program_check.admitted
      )).toBe(true);
    }
  });

  it("续跑只补三个缺失日记，保留原记录卡失败、候选顺序和原包", async () => {
    const { historicalPackage, historicalIdentityMap, targets } =
      await historicalBlockLimitParent(sources);
    const originalSnapshot = structuredClone(historicalPackage);
    const provider = createGi088MockCalibrationProvider((request) => {
      if (request.stage !== "daily_journal") {
        throw new Error("continuation must not regenerate record cards");
      }
      return successfulMockResponse(request);
    });
    const result = await runGi088DailyContinuation({
      mode: "mock",
      originalPackage: historicalPackage,
      identityMap: historicalIdentityMap,
      provider,
      sources,
      maxAdditionalCalls: 6,
      generatedAt: "2026-08-11T00:00:00.000Z",
      codeSnapshot: CODE_SNAPSHOT,
      parentArtifacts: {
        package_sha256: "1".repeat(64),
        identity_sha256: "2".repeat(64),
        lock_sha256: "3".repeat(64)
      },
      continuationScopeFingerprint: "4".repeat(64)
    });
    expect(result.mode).toBe("mock");
    if (result.mode === "dry-run") throw new Error("unexpected dry run");
    expect(provider.calls).toHaveLength(3);
    expect(provider.calls.every((call) => call.stage === "daily_journal")).toBe(true);
    expect(result.package.run.mode).toBe("mock");
    expect(result.package.candidate_set_id).toBe(historicalPackage.candidate_set_id);
    expect(result.package.run.actual_model_calls).toBe(12);
    expect(result.package.raw_responses.slice(0, 9)).toEqual(historicalPackage.raw_responses);
    expect(historicalPackage).toEqual(originalSnapshot);
    result.package.packets.forEach((packet, packetIndex) => {
      packet.candidates.forEach((candidate, candidateIndex) => {
        const key = `${packet.case_id}:${candidate.candidate_id}`;
        if (!targets.has(key)) {
          expect(candidate).toEqual(
            historicalPackage.packets[packetIndex].candidates[candidateIndex]
          );
          return;
        }
        expect(candidate.record_cards).toHaveLength(1);
        expect(candidate.paragraphs.length).toBeGreaterThan(0);
        expect(candidate.program_check.admitted).toBe(false);
        expect(candidate.program_check.failures).toContainEqual(
          expect.objectContaining({
            code: "RECORD_CARD_QUALITY_FAILED",
            refs: ["RECORD_CARD_SCHEMA_INVALID:blocks:too_big"]
          })
        );
        expect(candidate.program_check.checks).toContainEqual(expect.objectContaining({
          check: "record_card_block_limit_continuation",
          passed: true
        }));
      });
    });
    expect(result.package.continuation).toMatchObject({
      parent_package_sha256: "1".repeat(64),
      parent_identity_sha256: "2".repeat(64),
      parent_lock_sha256: "3".repeat(64),
      continuation_scope_fingerprint: "4".repeat(64),
      additional_model_calls: 3
    });
  });

  it("续跑遇到块数以外的记录卡问题时零调用停止", async () => {
    const { historicalPackage, historicalIdentityMap } =
      await historicalBlockLimitParent(sources);
    const packet = historicalPackage.packets[1];
    const candidate = packet.candidates[0];
    const raw = historicalPackage.raw_responses.find((response) =>
      response.case_id === packet.case_id
      && response.candidate_id === candidate.candidate_id
      && response.stage === "record_card"
    )!;
    const parsed = JSON.parse(raw.content) as {
      title: { text: string; sourceRefs: string[] };
    };
    parsed.title.sourceRefs = ["message:unknown"];
    raw.content = JSON.stringify(parsed);
    raw.sha256 = sha256Text(raw.content);
    const attempt = candidate.trace.attempts[0];
    attempt.raw_response_sha256 = raw.sha256;
    candidate.trace.raw_response_hashes.record_card = raw.sha256;
    const provider = createGi088MockCalibrationProvider();
    await expect(runGi088DailyContinuation({
      mode: "dry-run",
      originalPackage: historicalPackage,
      identityMap: historicalIdentityMap,
      provider,
      sources
    })).rejects.toThrow("GI088_DAILY_CONTINUATION_RECORD_CARD_NOT_ELIGIBLE");
    expect(provider.calls).toHaveLength(0);
  });

  it("长度截断作为质量失败保留，且不触发重试", async () => {
    const provider = createGi088MockCalibrationProvider((request) => ({
      ...successfulMockResponse(request),
      finishReason: "length"
    }));
    const result = await runGi088JournalCalibration({
      mode: "mock",
      provider,
      sources,
      maxCalls: 24,
      codeSnapshot: CODE_SNAPSHOT
    });
    if (result.mode === "dry-run") throw new Error("unexpected dry run");
    expect(result.package.run.actual_model_calls).toBe(6);
    expect(provider.calls.every((call) => call.attempt === 1)).toBe(true);
    expect(result.package.raw_responses).toHaveLength(6);
    expect(result.package.packets.flatMap((packet) => packet.candidates).every((candidate) =>
      candidate.program_check.failures.some((item) =>
        item.refs.includes("RECORD_CARD_INCOMPLETE_RESPONSE")
      )
    )).toBe(true);
  });

  it("空内容遇到 length 或 content_filter 时直接停止且不标记技术重试", async () => {
    const originalFetch = globalThis.fetch;
    try {
      for (const finishReason of ["length", "content_filter"] as const) {
        globalThis.fetch = async () => new Response(JSON.stringify({
          model: "deepseek-v4-flash",
          choices: [{
            finish_reason: finishReason,
            message: { content: "" }
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 0,
            total_tokens: 10
          }
        }), { status: 200 });
        const provider = createGi088OpenAICompatibleCalibrationProvider({
          apiKey: "private-test-key"
        });
        const source = sources[0];
        const request: Gi088CalibrationProviderRequest = {
          callFingerprint: "c".repeat(64),
          caseId: source.selection.caseId,
          candidateId: "candidate-test",
          stage: "record_card",
          attempt: 1,
          model: GI088_JOURNAL_CALIBRATION_MODELS[0],
          messages: [{ role: "user", content: "test" }],
          promptHash: "d".repeat(64),
          sourceRefs: ["message:U1"],
          sourceTextByRef: { "message:U1": "test" },
          sourceRecordIds: [],
          sourceRecordTextById: {},
          runtime: GI088_JOURNAL_CALIBRATION_RUNTIME
        };
        await expect(provider.complete(request)).rejects.toMatchObject({
          code: finishReason === "length" ? "INCOMPLETE_RESPONSE" : "CONTENT_FILTERED",
          retryable: false,
          finishReason
        });
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("真实模式要求私有回放确认、精确 24 次预算和官方模型预检", async () => {
    expect(() => parseGi088CalibrationArgs(["--execute-real", "--max-calls", "24"]))
      .toThrow("GI088_JOURNAL_CALIBRATION_PRIVATE_REPLAY_CONFIRMATION_REQUIRED");
    expect(() => parseGi088CalibrationArgs([
      "--execute-real",
      "--confirm-private-replay",
      "--max-calls",
      "23"
    ])).toThrow("GI088_JOURNAL_CALIBRATION_REAL_MAX_CALLS_24_CONFIRMATION_REQUIRED");
    expect(() => parseGi088CalibrationArgs([
      "--execute-real",
      "--confirm-private-replay",
      "--max-calls",
      "24"
    ])).toThrow("GI088_JOURNAL_CALIBRATION_SCOPE_CONFIRMATION_REQUIRED");
    const mockOptions = parseGi088CalibrationArgs(["--execute-mock", "--max-calls", "24"]);
    expect(mockOptions.outputPath).toMatch(/mock-candidate-packets\.json$/u);
    expect(mockOptions.identityOutputPath).toMatch(/mock-candidate-identity-map\.json$/u);

    const credential = await resolveGi088CalibrationCredential(
      { NODE_ENV: "test" },
      async () => "private-key-from-keychain\n"
    );
    expect(credential).toEqual({
      apiKey: "private-key-from-keychain",
      source: "macos_keychain"
    });
    const preflight = await validateGi088CalibrationModels({
      apiKey: credential.apiKey,
      credentialSource: credential.source,
      performedAt: "2026-08-10T00:00:00.000Z",
      fetcher: async () => new Response(JSON.stringify({
        data: GI088_JOURNAL_CALIBRATION_MODELS.map((model) => ({ id: model.model }))
      }), { status: 200 })
    });
    expect(preflight).toMatchObject({
      required_models_available: true,
      credential_source: "macos_keychain"
    });
    expect(preflight.available_model_ids_sha256).toHaveLength(64);
  });

  it("模拟真实执行只写入 Git 忽略区，并留下完成锁与两份一致包", async () => {
    await mkdir(PRIVATE_FORMAL_ROOT, { recursive: true });
    const directory = await mkdtemp(resolve(PRIVATE_FORMAL_ROOT, "runner-test-"));
    temporaryDirectories.push(directory);
    const outputPath = resolve(directory, "candidate-packets.json");
    const identityOutputPath = resolve(directory, "candidate-identity-map.json");
    const options = parseGi088CalibrationArgs([
      "--execute-real",
      "--confirm-private-replay",
      "--confirm-scope",
      GI088_JOURNAL_CALIBRATION_SCOPE_FINGERPRINT,
      "--max-calls",
      "24",
      "--output",
      outputPath,
      "--identity-output",
      identityOutputPath
    ], PROJECT_ROOT);
    const result = await runGi088CalibrationCli(options, { NODE_ENV: "test" }, {
      resolveCredential: async () => ({
        apiKey: "private-test-key",
        source: "macos_keychain"
      }),
      validateModels: async () => ({
        endpoint: "https://api.deepseek.com/models",
        performed_at: "2026-08-10T00:00:00.000Z",
        required_models: GI088_JOURNAL_CALIBRATION_MODELS.map((model) => model.model),
        required_models_available: true,
        available_model_ids_sha256: sha256Text("available-models"),
        credential_source: "macos_keychain"
      }),
      createRealProvider: realKindMockProvider
    });
    if (!("package" in result) || !result.package) {
      throw new Error("unexpected dry run");
    }
    expect(result.package.run.actual_model_calls).toBe(12);
    const [candidateFile, identityFile, lockFile] = await Promise.all([
      readFile(outputPath, "utf8"),
      readFile(identityOutputPath, "utf8"),
      readFile(resolve(directory, "gi088-calibration-real-run.lock.json"), "utf8")
    ]);
    const candidatePackage = JSON.parse(candidateFile) as { execution_fingerprint: string };
    const identityMap = JSON.parse(identityFile) as { execution_fingerprint: string };
    expect(identityMap.execution_fingerprint).toBe(candidatePackage.execution_fingerprint);
    expect(JSON.parse(lockFile)).toMatchObject({
      status: "completed",
      execution_fingerprint: candidatePackage.execution_fingerprint,
      actual_model_calls: 12
    });
    await expect(runGi088CalibrationCli(options, { NODE_ENV: "test" }, {
      resolveCredential: async () => ({ apiKey: "unused", source: "macos_keychain" }),
      validateModels: async () => { throw new Error("must not preflight"); },
      createRealProvider: realKindMockProvider
    })).rejects.toThrow("GI088_JOURNAL_CALIBRATION_SUCCESS_PACKAGE_ALREADY_EXISTS");
  }, 30_000);

  it("冻结的 Provider 参数保持 Thinking off、0.2 和单次 60 秒", () => {
    expect(GI088_JOURNAL_CALIBRATION_RUNTIME).toMatchObject({
      temperature: 0.2,
      thinking: "disabled",
      hardTimeoutMs: 60_000,
      maxTechnicalRetriesPerStage: 1,
      qualityRetries: 0
    });
  });
});
