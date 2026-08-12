import { createHash } from "node:crypto";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createGi088EmptyRecoveryReviewService,
  GI088_EMPTY_RECOVERY_REVIEW_STAGE
} from "@/app/admin/journal-evaluation/empty-recovery-review-loader";
import { GI088_V8R3_DEVELOPMENT_CASES } from "../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/development-fixtures";
import { GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES } from "../evals/fixtures/gi088-v8r3-test-hidden-fixtures";

const FIXED_NOW = "2026-08-12T12:00:00.000Z";
const TOOL_SOURCE_SHA = "a".repeat(64);

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function createFixture() {
  const root = await mkdtemp(resolve(tmpdir(), "gi088-empty-recovery-"));
  const diagnosticPath = resolve(root, "diagnostic.json");
  const hiddenPath = resolve(root, "hidden.json");
  const hiddenRaw = JSON.stringify({ fixture: "private-hidden" });
  await writeFile(hiddenPath, hiddenRaw, { mode: 0o600 });

  const developmentCases = GI088_V8R3_DEVELOPMENT_CASES.slice(0, 8);
  const hiddenCases = [
    GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES[0],
    GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES[8]
  ];
  const sources = [...developmentCases, ...hiddenCases];
  const recoveredRecords = sources.map((evaluationCase, index) => {
    const checkpointIndex = index === 9 ? 1 : 0;
    const checkpoint = evaluationCase.checkpoints[checkpointIndex]!;
    const recoveryAttempt = index === 1 ? 2 : 1;
    return {
      caseId: evaluationCase.id,
      partition: evaluationCase.partition,
      attempt: index % 2 === 0 ? 1 : 2,
      checkpoints: [{
        checkpointIndex,
        afterUserMessageId: checkpoint.afterUserMessageId,
        visibleUnderstanding: `对当前共同任务形成了第 ${index + 1} 条可见理解。`,
        visibleResponse: `这是第 ${index + 1} 条恢复后可见回应。`,
        calls: [
          {
            kind: "initial",
            errorCode: "EMPTY_CONTENT",
            status: "failed",
            recoveryAttempt: 0
          },
          ...Array.from({ length: recoveryAttempt }, (_, attemptIndex) => ({
            kind: "automatic_recovery",
            errorCode: attemptIndex + 1 === recoveryAttempt ? null : "EMPTY_CONTENT",
            status: attemptIndex + 1 === recoveryAttempt ? "valid" : "failed",
            recoveryAttempt: attemptIndex + 1
          }))
        ]
      }]
    };
  });
  const fillerRecords = Array.from({ length: 70 }, (_, index) => ({
    caseId: developmentCases[index % developmentCases.length]!.id,
    partition: "development",
    attempt: index % 2 === 0 ? 1 : 2,
    checkpoints: []
  }));
  const report = {
    reportVersion: "2026-08-11.gi088-v8r3-offline-executor-v7",
    formalEvaluationVersion: "2026-08-11.gi088-human-eval-v8r3-skill-ark-flash",
    runtime: {
      provider: "volcengine_ark",
      model: "deepseek-v4-flash-ga-260731",
      thinking: "enabled",
      reasoningEffort: "high",
      responseFormat: "json_object",
      headersTimeoutMs: 60_000,
      bodyIdleTimeoutMs: 60_000,
      hardTimeoutMs: 60_000
    },
    emptyContentDiagnostics: {
      summary: {
        emptyContentInitialCount: 10,
        successAtAttempt1: 9,
        successAtAttempt2: 1,
        successAtAttempt3: 0,
        finalEmptyContentCount: 0
      }
    },
    privateInputs: { hiddenFileSha256: sha256(hiddenRaw) },
    records: [...recoveredRecords, ...fillerRecords]
  };
  const diagnosticRaw = JSON.stringify(report);
  await writeFile(diagnosticPath, diagnosticRaw, { mode: 0o600 });
  const privateRoot = resolve(root, "review");
  const service = createGi088EmptyRecoveryReviewService({
    privateRoot,
    now: () => FIXED_NOW,
    diagnosticPath,
    hiddenPath,
    expectedDiagnosticSha256: sha256(diagnosticRaw),
    developmentCases,
    parseHiddenCases: () => hiddenCases,
    toolSourceSha256: TOOL_SOURCE_SHA
  });
  return { root, privateRoot, service };
}

async function savePassingDecisions(
  service: Awaited<ReturnType<typeof createFixture>>["service"]
) {
  const review = await service.load();
  for (const [index, card] of review.cards.entries()) {
    const minor = index >= 8;
    await service.saveDecision({
      publicId: card.publicId,
      verdict: minor ? "minor_issue" : "ready_to_use",
      failureCategory: minor ? "low_information_gain" : null,
      reason: minor ? "方向成立，但这句话的信息增量略低。" : "",
      singleCaseBlocker: false
    });
  }
}

describe("GI-088 EMPTY_CONTENT 恢复结果本机裁决", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("JOURNAL_EVALUATION_LOCAL_ENABLED", "I_UNDERSTAND");
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://local@127.0.0.1:5432/happiness_system_codex?schema=journal_daily_eval"
    );
    vi.stubEnv("DIRECT_URL", process.env.DATABASE_URL!);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("固定读取恰好 10 份盲评材料，并跨刷新保持稳定顺序", async () => {
    const { service } = await createFixture();
    const first = await service.load();
    const second = await service.load();

    expect(first.stage).toBe(GI088_EMPTY_RECOVERY_REVIEW_STAGE);
    expect(first.cards).toHaveLength(10);
    expect(first.cards.map((card) => card.publicId)).toEqual(
      second.cards.map((card) => card.publicId)
    );
    expect(new Set(first.cards.map((card) => card.publicId))).toHaveLength(10);
    expect(first.toolSourceSha256).toBe(TOOL_SOURCE_SHA);
    const publicPayload = JSON.stringify(first.cards);
    expect(publicPayload).not.toMatch(/"caseId"|"partition"|"recoveryAttempt"|"model"/u);
  });

  it("强制问题类别与 8–300 字理由，并禁止非失败样本标阻断", async () => {
    const { service } = await createFixture();
    const [card] = (await service.load()).cards;

    await expect(service.saveDecision({
      publicId: card!.publicId,
      verdict: "minor_issue",
      failureCategory: null,
      reason: "太短",
      singleCaseBlocker: false
    })).rejects.toThrow("GI088_EMPTY_RECOVERY_REASON_REQUIRED");
    await expect(service.saveDecision({
      publicId: card!.publicId,
      verdict: "ready_to_use",
      failureCategory: null,
      reason: "",
      singleCaseBlocker: true
    })).rejects.toThrow("GI088_EMPTY_RECOVERY_READY_DECISION_INVALID");
  });

  it("以 8 优 2 轻微封存通过，并生成 0600 不可变收据", async () => {
    const { privateRoot, service } = await createFixture();
    await savePassingDecisions(service);
    const receipt = await service.finalize();
    const replay = await service.finalize();

    expect(replay).toEqual(receipt);
    expect(receipt.gate.passed).toBe(true);
    expect(receipt.verdicts).toEqual({
      ready_to_use: 8,
      minor_issue: 2,
      quality_failure: 0
    });
    expect(receipt.recoveryDistribution).toEqual({
      successAtAttempt1: 9,
      successAtAttempt2: 1,
      successAtAttempt3: 0,
      finalEmptyContentCount: 0
    });
    expect(receipt.toolSourceSha256).toBe(TOOL_SOURCE_SHA);
    expect((await stat(resolve(privateRoot, "decisions.json"))).mode & 0o777).toBe(0o600);
    expect((await stat(resolve(privateRoot, "receipt.json"))).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(resolve(privateRoot, "receipt.json"), "utf8"))).toEqual(receipt);
    await expect(service.saveDecision({
      publicId: (await service.load()).cards[0]!.publicId,
      verdict: "ready_to_use",
      failureCategory: null,
      reason: "",
      singleCaseBlocker: false
    })).rejects.toThrow("GI088_EMPTY_RECOVERY_RECEIPT_IMMUTABLE");
  });

  it("出现一份质量失败时明确留在板块 7", async () => {
    const { service } = await createFixture();
    const review = await service.load();
    for (const [index, card] of review.cards.entries()) {
      await service.saveDecision({
        publicId: card.publicId,
        verdict: index === 9 ? "quality_failure" : "ready_to_use",
        failureCategory: index === 9 ? "reasks_answered_content" : null,
        reason: index === 9 ? "这次回应重复索取了用户已经给出的答案。" : "",
        singleCaseBlocker: false
      });
    }
    expect((await service.finalize()).gate.passed).toBe(false);
  });

  it("来源摘要被改动时在展示前拒绝", async () => {
    const fixture = await createFixture();
    const badService = createGi088EmptyRecoveryReviewService({
      privateRoot: fixture.privateRoot,
      diagnosticPath: resolve(fixture.root, "diagnostic.json"),
      hiddenPath: resolve(fixture.root, "hidden.json"),
      expectedDiagnosticSha256: "f".repeat(64),
      developmentCases: GI088_V8R3_DEVELOPMENT_CASES.slice(0, 8),
      parseHiddenCases: () => [
        GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES[0],
        GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES[8]
      ],
      toolSourceSha256: TOOL_SOURCE_SHA
    });
    await expect(badService.load()).rejects.toThrow(
      "GI088_EMPTY_RECOVERY_DIAGNOSTIC_SHA_MISMATCH"
    );
  });
});
