import { rm } from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GI088_JOURNAL_CALIBRATION_RUNTIME,
  type Gi088CalibrationProvider,
  type Gi088CalibrationProviderRequest
} from "../../scripts/journal-generation-eval/gi088-calibration-contract";
import { Gi088CalibrationProviderError } from "../../scripts/journal-generation-eval/gi088-calibration-provider";
import {
  JOURNAL_DAILY_WRITER_PROMPT_V2_VERSION,
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V2_HASH
} from "../../src/server/services/journal-daily-entry";
import {
  assessGi088FlashDailyRevisionOutput,
  parseGi088FlashDailyRevisionArgs,
  runGi088FlashDailyRevision
} from "../../scripts/journal-generation-eval/run-gi088-flash-daily-revision";

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
    provider: "mock-flash-v2",
    finishReason: "stop",
    tokenUsage: null,
    upstreamRequestId: `mock-${request.callFingerprint.slice(0, 8)}`,
    reasoningPresent: false,
    responseModel: "deepseek-v4-flash"
  };
}

describe("GI-088 Flash 今日日记二轮", () => {
  const written: string[] = [];

  afterEach(async () => {
    await Promise.all(written.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    ));
  });

  it("默认零调用检查，真实运行需要私有范围、父指纹与六次上限四项确认", () => {
    expect(parseGi088FlashDailyRevisionArgs([])).toMatchObject({
      mode: "dry-run",
      maxCalls: 6,
      maxCallsExplicit: false
    });
    expect(() => parseGi088FlashDailyRevisionArgs(["--execute-real"]))
      .toThrow(/PRIVATE_REPLAY_CONFIRMATION_REQUIRED/u);
    expect(() => parseGi088FlashDailyRevisionArgs([
      "--execute-real", "--confirm-private-replay", "--confirm-scope=scope",
      "--confirm-parent-execution=parent"
    ])).toThrow(/MAX_CALLS_CONFIRMATION_REQUIRED/u);
    expect(parseGi088FlashDailyRevisionArgs([
      "--execute-real", "--confirm-private-replay", "--confirm-scope=scope",
      "--confirm-parent-execution=parent", "--max-calls=6"
    ])).toMatchObject({ mode: "real", confirmPrivateReplay: true, maxCalls: 6 });
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
    const assessed = assessGi088FlashDailyRevisionOutput({
      content: JSON.stringify({
        paragraphs: [{ text: "我决定马上冲过去。", sourceRecordIds: ["unknown"] }]
      }),
      finishReason: "stop",
      responseModel: "deepseek-v4-flash",
      reasoningPresent: true,
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

  it("模拟回归只调用 Flash 的三条 daily_journal，正常总调用固定为三次", async () => {
    const id = runId("nominal");
    written.push(resolve(
      process.cwd(),
      "artifacts/journal-generation-evaluation/.private/round2-mock",
      id
    ));
    const calls: Gi088CalibrationProviderRequest[] = [];
    const provider: Gi088CalibrationProvider = {
      kind: "mock",
      name: "mock-flash-v2",
      async complete(request) {
        calls.push(request);
        return goodResult(request);
      }
    };
    const result = await runGi088FlashDailyRevision({
      mode: "mock",
      confirmPrivateReplay: false,
      confirmScopeFingerprint: null,
      confirmParentExecutionFingerprint: null,
      maxCalls: 6,
      maxCallsExplicit: true,
      runId: id
    }, process.env, { createMockProvider: () => provider });
    if ("plan" in result) throw new Error("expected mock result");
    expect(calls).toHaveLength(3);
    expect(calls.every((call) => call.stage === "daily_journal"
      && call.model.model === "deepseek-v4-flash"
      && call.runtime === GI088_JOURNAL_CALIBRATION_RUNTIME)).toBe(true);
    expect(calls.every((call) => {
      const userMessage = call.messages.find((message) => message.role === "user");
      return !userMessage?.content.includes("writingMaterial");
    })).toBe(true);
    expect(result.package.prompt).toEqual({
      version: JOURNAL_DAILY_WRITER_PROMPT_V2_VERSION,
      system_prompt_sha256: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V2_HASH
    });
    expect(result.package.run).toMatchObject({
      actual_model_calls: 3,
      technical_retries: 0,
      quality_retries: 0,
      admitted_cases: 3
    });
    expect(result.package.cases.every((item) => item.record_card_sha256.length === 64)).toBe(true);
  });

  it("质量失败保留首个响应且不触发模型重写", async () => {
    const id = runId("quality");
    written.push(resolve(
      process.cwd(),
      "artifacts/journal-generation-evaluation/.private/round2-mock",
      id
    ));
    const complete = vi.fn(async () => ({
      content: "{invalid-json",
      latencyMs: 5,
      provider: "mock-flash-v2",
      finishReason: "stop",
      tokenUsage: null,
      reasoningPresent: false,
      responseModel: "deepseek-v4-flash"
    }));
    const result = await runGi088FlashDailyRevision({
      mode: "mock",
      confirmPrivateReplay: false,
      confirmScopeFingerprint: null,
      confirmParentExecutionFingerprint: null,
      maxCalls: 6,
      maxCallsExplicit: true,
      runId: id
    }, process.env, {
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
      "artifacts/journal-generation-evaluation/.private/round2-mock",
      id
    ));
    const attempts = new Map<string, number>();
    const complete = vi.fn(async (request: Gi088CalibrationProviderRequest) => {
      const count = (attempts.get(request.caseId) ?? 0) + 1;
      attempts.set(request.caseId, count);
      if (count === 1) throw new Gi088CalibrationProviderError("TIMEOUT", true, 60_000);
      return goodResult(request);
    });
    const result = await runGi088FlashDailyRevision({
      mode: "mock",
      confirmPrivateReplay: false,
      confirmScopeFingerprint: null,
      confirmParentExecutionFingerprint: null,
      maxCalls: 6,
      maxCallsExplicit: true,
      runId: id
    }, process.env, {
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
