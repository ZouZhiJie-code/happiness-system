import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GI088_JOURNAL_CALIBRATION_MODELS,
  GI088_JOURNAL_CALIBRATION_RUNTIME,
  type Gi088CalibrationProvider,
  type Gi088CalibrationProviderRequest
} from "../../scripts/journal-generation-eval/gi088-calibration-contract";
import { Gi088CalibrationProviderError } from "../../scripts/journal-generation-eval/gi088-calibration-provider";
import {
  assertNoPriorRealContinuation,
  createGi088AuditedContinuationProvider,
  parseGi088DailyContinuationArgs
} from "../../scripts/journal-generation-eval/run-gi088-daily-continuation";

function request(input: {
  sequence: number;
  stage?: "record_card" | "daily_journal";
}): Gi088CalibrationProviderRequest {
  return {
    callFingerprint: `call-${input.sequence}`,
    caseId: "case-1",
    candidateId: "candidate-1",
    stage: input.stage ?? "daily_journal",
    attempt: input.sequence === 2 ? 2 : 1,
    model: GI088_JOURNAL_CALIBRATION_MODELS[0],
    messages: [{ role: "user", content: "input" }],
    promptHash: "a".repeat(64),
    sourceRefs: ["message:m1"],
    sourceTextByRef: { "message:m1": "input" },
    sourceRecordIds: ["record-1"],
    sourceRecordTextById: { "record-1": "input" },
    runtime: GI088_JOURNAL_CALIBRATION_RUNTIME
  };
}

describe("GI-088 今日日记独立续跑 CLI", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((path) =>
        rm(path, { recursive: true, force: true })
      )
    );
  });

  it("默认只检查，真实执行必须同时确认私有回放、范围、父指纹和六次上限", () => {
    expect(parseGi088DailyContinuationArgs([])).toMatchObject({
      mode: "dry-run",
      confirmPrivateReplay: false,
      maxAdditionalCalls: 6,
      maxAdditionalCallsExplicit: false
    });
    expect(() => parseGi088DailyContinuationArgs(["--execute-real"]))
      .toThrow(/PRIVATE_REPLAY_CONFIRMATION_REQUIRED/u);
    expect(() => parseGi088DailyContinuationArgs([
      "--execute-real",
      "--confirm-private-replay",
      "--confirm-scope", "scope",
      "--confirm-parent-execution", "parent"
    ])).toThrow(/MAX_CALLS_CONFIRMATION_REQUIRED/u);

    expect(parseGi088DailyContinuationArgs([
      "--execute-real",
      "--confirm-private-replay",
      "--confirm-scope=scope",
      "--confirm-parent-execution=parent",
      "--max-additional-calls=6",
      "--continuation-id=daily-completion-test"
    ])).toMatchObject({
      mode: "real",
      confirmPrivateReplay: true,
      confirmScopeFingerprint: "scope",
      confirmParentExecutionFingerprint: "parent",
      maxAdditionalCalls: 6,
      continuationId: "daily-completion-test"
    });
  });

  it("每次调用先落 reservation，再记录结果；请求范围固定为目标的日记阶段", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "gi088-daily-continuation-"));
    temporaryDirectories.push(directory);
    const ledgerPath = resolve(directory, "attempt-ledger.ndjson");
    const complete = vi.fn(async (providerRequest: Gi088CalibrationProviderRequest) => ({
      content: JSON.stringify({ paragraphs: [{
        text: "正文",
        sourceRecordIds: providerRequest.sourceRecordIds
      }] }),
      latencyMs: 8,
      provider: "mock-audited",
      finishReason: "stop",
      tokenUsage: null,
      upstreamRequestId: "request-1",
      reasoningPresent: false,
      responseModel: providerRequest.model.model
    }));
    const rawProvider: Gi088CalibrationProvider = {
      kind: "mock",
      name: "mock-audited",
      complete
    };
    const preCallGuard = vi.fn().mockResolvedValue(undefined);
    const audited = createGi088AuditedContinuationProvider({
      provider: rawProvider,
      ledgerPath,
      parentCalls: 9,
      targets: [{
        case_id: "case-1",
        candidate_id: "candidate-1",
        candidate_execution_fingerprint: "b".repeat(64),
        record_raw_sha256: "c".repeat(64)
      }],
      now: () => new Date("2026-08-11T00:00:00.000Z"),
      preCallGuard
    });

    await audited.provider.complete(request({ sequence: 1 }));
    const events = (await readFile(ledgerPath, "utf8")).trim().split("\n").map(
      (line) => JSON.parse(line) as Record<string, unknown>
    );
    expect(events.map((event) => event.event)).toEqual([
      "call_reserved",
      "call_completed"
    ]);
    expect(events[0]).toMatchObject({
      sequence: 1,
      stage: "daily_journal",
      cumulative_call_number: 10
    });
    expect(events[1]).toMatchObject({
      sequence: 1,
      finish_reason: "stop",
      response_model: "deepseek-v4-flash"
    });
    expect(preCallGuard).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(1);

    await expect(audited.provider.complete(request({
      sequence: 2,
      stage: "record_card"
    }))).rejects.toThrow(/PROVIDER_SCOPE_VIOLATION/u);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("父运行已有九次调用时，增量第七次会在发送前被预算门拦截", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "gi088-daily-budget-"));
    temporaryDirectories.push(directory);
    const provider: Gi088CalibrationProvider = {
      kind: "mock",
      name: "budget-mock",
      async complete(providerRequest) {
        return {
          content: "{}",
          latencyMs: 1,
          provider: "budget-mock",
          responseModel: providerRequest.model.model
        };
      }
    };
    const audited = createGi088AuditedContinuationProvider({
      provider,
      ledgerPath: resolve(directory, "attempt-ledger.ndjson"),
      parentCalls: 9,
      targets: [{
        case_id: "case-1",
        candidate_id: "candidate-1",
        candidate_execution_fingerprint: "b".repeat(64),
        record_raw_sha256: "c".repeat(64)
      }],
      now: () => new Date("2026-08-11T00:00:00.000Z"),
      preCallGuard: async () => undefined
    });

    for (let sequence = 1; sequence <= 6; sequence += 1) {
      await audited.provider.complete(request({ sequence }));
    }
    await expect(audited.provider.complete(request({ sequence: 7 })))
      .rejects.toThrow(/CALL_BUDGET_EXCEEDED/u);
    expect(audited.observedCalls()).toBe(6);
  });

  it("同一父运行出现过真实续跑账本后，禁止通过新目录重复获得预算", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "gi088-daily-history-"));
    temporaryDirectories.push(root);
    const prior = resolve(root, "first-real-run");
    await mkdir(prior);
    await writeFile(resolve(prior, "continuation-run.lock.json"), JSON.stringify({
      status: "failed",
      mode: "real",
      parent_execution_fingerprint: "p".repeat(64),
      observed_additional_model_calls: 1
    }));
    await expect(assertNoPriorRealContinuation(root, "p".repeat(64)))
      .rejects.toThrow(/PRIOR_REAL_RUN_EXISTS/u);
    await expect(assertNoPriorRealContinuation(root, "q".repeat(64)))
      .resolves.toBeUndefined();
  });

  it("上游 409 在续跑中按质量终止处理，不获得技术重试资格", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "gi088-daily-409-"));
    temporaryDirectories.push(directory);
    const provider: Gi088CalibrationProvider = {
      kind: "mock",
      name: "conflict-mock",
      async complete() {
        throw new Gi088CalibrationProviderError(
          "UPSTREAM_HTTP_ERROR",
          true,
          5,
          null,
          null,
          null,
          { status: 409 }
        );
      }
    };
    const audited = createGi088AuditedContinuationProvider({
      provider,
      ledgerPath: resolve(directory, "attempt-ledger.ndjson"),
      parentCalls: 9,
      targets: [{
        case_id: "case-1",
        candidate_id: "candidate-1",
        candidate_execution_fingerprint: "b".repeat(64),
        record_raw_sha256: "c".repeat(64)
      }],
      now: () => new Date("2026-08-11T00:00:00.000Z"),
      preCallGuard: async () => undefined
    });
    await expect(audited.provider.complete(request({ sequence: 1 }))).rejects.toMatchObject({
      code: "UPSTREAM_HTTP_ERROR",
      retryable: false
    });
  });
});
