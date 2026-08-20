import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type {
  AICompletionParams,
  AIProvider,
  AIProviderDiagnostics
} from "@/server/services/ai/ai-provider";
import {
  GI088_COMPLETE_RESPONSE_FIRST_QUALITY_IDENTITY,
  GI088_COMPLETE_RESPONSE_FIRST_QUALITY_PATHS,
  assertGi088CompleteResponseFirstQualityFrozenPlan,
  createGi088CompleteResponseFirstQualityPlan,
  gi088CompleteResponseFirstQualityPublicCode,
  runGi088CompleteResponseFirstQualityStage,
  shouldRunGi088CompleteResponseFirstQualityCli
} from "../../scripts/run-gi088-complete-response-first-quality";

function diagnostics(input: {
  content: string;
  finishReason?: AIProviderDiagnostics["finishReason"];
  httpStatus?: number;
  responseModel?: string;
  totalLatencyMs?: number;
}): AIProviderDiagnostics {
  const totalLatencyMs = input.totalLatencyMs ?? 2_000;
  return {
    finishReason: input.finishReason ?? "stop",
    reasoningPresent: false,
    reasoningLength: 0,
    reasoningTokens: null,
    latencyMs: totalLatencyMs,
    tokenUsage: {
      promptTokens: 1_000,
      completionTokens: 80,
      totalTokens: 1_080
    },
    upstreamRequestId: null,
    httpStatus: input.httpStatus ?? 200,
    responseModel: input.responseModel ?? "deepseek-v4-pro",
    choiceCount: 1,
    contentType: "string",
    contentLength: input.content.length,
    reasoningType: "missing",
    headersLatencyMs: 100,
    firstTokenLatencyMs: 400,
    bodyLatencyMs: totalLatencyMs - 100,
    totalLatencyMs,
    timeoutStage: null,
    abortSource: null
  };
}

function provider(outputs: Array<{
  content: string;
  finishReason?: AIProviderDiagnostics["finishReason"];
  httpStatus?: number;
  responseModel?: string;
  totalLatencyMs?: number;
}>) {
  const calls: AICompletionParams[] = [];
  let index = 0;
  const result: AIProvider = {
    name: "openai",
    complete: async () => {
      throw new Error("COMPLETE_NOT_EXPECTED");
    },
    stream: async function* (params) {
      calls.push(params);
      const current = outputs[index++]!;
      params.onStreamDiagnostics?.(diagnostics(current));
      yield current.content;
    }
  };
  return { result, calls };
}

describe("GI-088 complete response first quality runner", () => {
  it("freezes the eight-call split, standard and plain-text candidate runtime", async () => {
    const plan = await createGi088CompleteResponseFirstQualityPlan();
    expect(plan).toMatchObject({
      identity: GI088_COMPLETE_RESPONSE_FIRST_QUALITY_IDENTITY,
      standardSha256:
        "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60",
      budget: {
        authorized: 8,
        development: 3,
        regression: 5,
        callsPerCase: 1,
        retries: 0,
        recovery: 0,
        fallback: 0
      },
      runtime: {
        model: "deepseek-v4-pro",
        maxTokens: 1_280,
        thinking: "disabled"
      }
    });
    expect(plan.cases.map((item) => item.split)).toEqual([
      "development", "development", "development",
      "regression", "regression", "regression", "regression", "regression"
    ]);
    expect(plan.cases.find((item) => item.caseId === "RPR-REAL-21")?.hardGate)
      .toBe(true);
    expect("responseFormat" in plan.runtime).toBe(false);
  });

  it("runs all development cases, observes questions, and keeps public evidence body-free", async () => {
    const workspaceRoot = process.cwd();
    const cwd = await mkdtemp(path.join(os.tmpdir(), "gi088-complete-quality-"));
    const plan = await createGi088CompleteResponseFirstQualityPlan(workspaceRoot);
    const first = "听起来这件事让你很在意。你最想先说哪部分？当时什么最触动你？";
    const mock = provider([
      { content: first },
      { content: "你已经说清楚这一天像有了新的开始，我们可以沿着真正新鲜的部分继续。" },
      { content: "你说的滋养，可以先从一次让你觉得放松的具体相处说起。" }
    ]);
    const ledger = await runGi088CompleteResponseFirstQualityStage({
      cwd,
      workspaceRoot,
      plan,
      split: "development",
      provider: mock.result
    });

    expect(mock.calls).toHaveLength(3);
    expect(ledger.results).toHaveLength(3);
    expect(ledger.results[0]).toMatchObject({
      status: "technical_valid",
      technicalGatePassed: true,
      observation: { questionMarkCount: 2 }
    });
    expect(mock.calls[0]).toMatchObject({
      maxTokens: 1_280,
      thinking: "disabled",
      temperature: 0.2,
      headersTimeoutMs: 15_000,
      hardTimeoutMs: 45_000
    });
    expect("responseFormat" in mock.calls[0]!).toBe(false);

    const publicSource = await readFile(
      path.join(cwd, GI088_COMPLETE_RESPONSE_FIRST_QUALITY_PATHS.publicReceipt),
      "utf8"
    );
    expect(publicSource).not.toContain(first);
    expect(publicSource).not.toContain("turnInput");
    expect(publicSource).not.toContain("rawOutput");
    expect(JSON.parse(publicSource).budget).toEqual({
      authorized: 8,
      consumed: 3,
      completed: 3,
      notRun: 5,
      retries: 0,
      recovery: 0,
      fallback: 0
    });

    const privateLedger = path.join(
      cwd,
      GI088_COMPLETE_RESPONSE_FIRST_QUALITY_PATHS.privateLedger
    );
    const privateReview = path.join(
      cwd,
      GI088_COMPLETE_RESPONSE_FIRST_QUALITY_PATHS.privateReview
    );
    expect((await stat(privateLedger)).mode & 0o777).toBe(0o600);
    expect((await stat(privateReview)).mode & 0o777).toBe(0o600);
    expect(await readFile(privateReview, "utf8")).toContain(first);
  });

  it("stops only after two consecutive technical failures", async () => {
    const workspaceRoot = process.cwd();
    const cwd = await mkdtemp(path.join(os.tmpdir(), "gi088-complete-stop-"));
    const plan = await createGi088CompleteResponseFirstQualityPlan(workspaceRoot);
    const mock = provider([
      { content: "第一条仍有正文。", finishReason: "length" },
      { content: "第二条仍有正文。", httpStatus: 502 },
      { content: "第三条不应运行。" }
    ]);
    const ledger = await runGi088CompleteResponseFirstQualityStage({
      cwd,
      workspaceRoot,
      plan,
      split: "development",
      provider: mock.result
    });
    expect(mock.calls).toHaveLength(2);
    expect(ledger.results[0]?.technicalChecks.finishLength).toBe(true);
    expect(ledger.results[0]?.errorCode)
      .toBe("GI088_COMPLETE_RESPONSE_FIRST_TOKEN_CEILING_INCONCLUSIVE");
    expect(ledger.stopReason).toContain("TWO_CONSECUTIVE_TECHNICAL_FAILURES");
  });

  it("records a started reservation before every provider call", async () => {
    const workspaceRoot = process.cwd();
    const cwd = await mkdtemp(path.join(os.tmpdir(), "gi088-complete-reserve-"));
    const plan = await createGi088CompleteResponseFirstQualityPlan(workspaceRoot);
    let callIndex = 0;
    const result: AIProvider = {
      name: "openai",
      complete: async () => {
        throw new Error("COMPLETE_NOT_EXPECTED");
      },
      stream: async function* (params) {
        const ledger = JSON.parse(await readFile(path.join(
          cwd,
          GI088_COMPLETE_RESPONSE_FIRST_QUALITY_PATHS.privateLedger
        ), "utf8"));
        expect(ledger.reservations).toHaveLength(callIndex + 1);
        expect(ledger.reservations[callIndex]).toMatchObject({ status: "started" });
        expect(ledger.results).toHaveLength(callIndex);
        const content = `这是第${callIndex + 1}条完整回应。`;
        callIndex += 1;
        params.onStreamDiagnostics?.(diagnostics({ content }));
        yield content;
      }
    };
    const ledger = await runGi088CompleteResponseFirstQualityStage({
      cwd,
      workspaceRoot,
      plan,
      split: "development",
      provider: result
    });
    expect(callIndex).toBe(3);
    expect(ledger.reservations.every((item) => item.status === "completed"))
      .toBe(true);
  });

  it("rejects an unresolved reservation because recovery is zero", async () => {
    const workspaceRoot = process.cwd();
    const cwd = await mkdtemp(path.join(os.tmpdir(), "gi088-complete-ambiguous-"));
    const plan = await createGi088CompleteResponseFirstQualityPlan(workspaceRoot);
    const ledgerFile = path.join(
      cwd,
      GI088_COMPLETE_RESPONSE_FIRST_QUALITY_PATHS.privateLedger
    );
    await mkdir(path.dirname(ledgerFile), { recursive: true });
    await writeFile(ledgerFile, JSON.stringify({
      schemaVersion: "1.0",
      identity: plan.identity,
      planFingerprint: plan.planFingerprint,
      reservations: [{
        order: 1,
        caseId: "RPR-REAL-01",
        split: "development",
        requestFingerprint: plan.cases[0]!.requestFingerprint,
        reservedAt: new Date().toISOString(),
        status: "started"
      }],
      results: [],
      stopReason: null
    }));
    const mock = provider([{ content: "不应再次调用。" }]);
    await expect(runGi088CompleteResponseFirstQualityStage({
      cwd,
      workspaceRoot,
      plan,
      split: "development",
      provider: mock.result
    })).rejects.toThrow("GI088_COMPLETE_RESPONSE_FIRST_UNRESOLVED_RESERVATION_NO_RECOVERY");
    expect(mock.calls).toHaveLength(0);
  });

  it("uses an exclusive run lock to prevent concurrent stage execution", async () => {
    const workspaceRoot = process.cwd();
    const cwd = await mkdtemp(path.join(os.tmpdir(), "gi088-complete-lock-"));
    const plan = await createGi088CompleteResponseFirstQualityPlan(workspaceRoot);
    let releaseFirst!: () => void;
    let markEntered!: () => void;
    const firstMayFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstEntered = new Promise<void>((resolve) => {
      markEntered = resolve;
    });
    let index = 0;
    const result: AIProvider = {
      name: "openai",
      complete: async () => {
        throw new Error("COMPLETE_NOT_EXPECTED");
      },
      stream: async function* (params) {
        const content = `锁测试第${index + 1}条回应。`;
        if (index === 0) {
          markEntered();
          await firstMayFinish;
        }
        index += 1;
        params.onStreamDiagnostics?.(diagnostics({ content }));
        yield content;
      }
    };
    const firstRun = runGi088CompleteResponseFirstQualityStage({
      cwd,
      workspaceRoot,
      plan,
      split: "development",
      provider: result
    });
    await firstEntered;
    await expect(runGi088CompleteResponseFirstQualityStage({
      cwd,
      workspaceRoot,
      plan,
      split: "development",
      provider: result
    })).rejects.toThrow("GI088_COMPLETE_RESPONSE_FIRST_RUN_LOCKED");
    releaseFirst();
    await firstRun;
    expect(index).toBe(3);
  });

  it("allows regression only after all development technical gates pass", async () => {
    const workspaceRoot = process.cwd();
    const cwd = await mkdtemp(path.join(os.tmpdir(), "gi088-complete-regression-"));
    const plan = await createGi088CompleteResponseFirstQualityPlan(workspaceRoot);
    const mock = provider(Array.from({ length: 8 }, (_, index) => ({
      content: `第${index + 1}条完整自然回应。`
    })));
    await expect(runGi088CompleteResponseFirstQualityStage({
      cwd,
      workspaceRoot,
      plan,
      split: "regression",
      provider: mock.result
    })).rejects.toThrow("GI088_COMPLETE_RESPONSE_FIRST_REGRESSION_REQUIRES_DEVELOPMENT_TECHNICAL_GATE");
    await runGi088CompleteResponseFirstQualityStage({
      cwd,
      workspaceRoot,
      plan,
      split: "development",
      provider: mock.result
    });
    const ledger = await runGi088CompleteResponseFirstQualityStage({
      cwd,
      workspaceRoot,
      plan,
      split: "regression",
      provider: mock.result
    });
    expect(mock.calls).toHaveLength(8);
    expect(ledger.results).toHaveLength(8);
    expect(ledger.reservations).toHaveLength(8);
  });

  it("binds execution to the exact current frozen plan and hashes unsafe public details", async () => {
    const current = await createGi088CompleteResponseFirstQualityPlan();
    expect(() => assertGi088CompleteResponseFirstQualityFrozenPlan({
      frozen: current,
      current
    })).not.toThrow();
    const drifted = JSON.parse(JSON.stringify(current));
    drifted.dataset.fingerprint = "drift";
    expect(() => assertGi088CompleteResponseFirstQualityFrozenPlan({
      frozen: drifted,
      current
    })).toThrow("GI088_COMPLETE_RESPONSE_FIRST_FROZEN_PLAN_DRIFT");
    expect(gi088CompleteResponseFirstQualityPublicCode("upstream body: 用户原文"))
      .toMatch(/^PRIVATE_DETAIL_SHA256:[a-f0-9]{64}$/u);
  });

  it("stops immediately on an internal-state leak", async () => {
    const workspaceRoot = process.cwd();
    const cwd = await mkdtemp(path.join(os.tmpdir(), "gi088-complete-leak-"));
    const plan = await createGi088CompleteResponseFirstQualityPlan(workspaceRoot);
    const mock = provider([
      { content: "readOnlySemanticState 里的内容说明用户很开心。" },
      { content: "不应运行。" }
    ]);
    const ledger = await runGi088CompleteResponseFirstQualityStage({
      cwd,
      workspaceRoot,
      plan,
      split: "development",
      provider: mock.result
    });
    expect(mock.calls).toHaveLength(1);
    expect(ledger.results[0]).toMatchObject({
      status: "program_gate_failure",
      severeProgramGateFailed: true,
      technicalChecks: { noInternalLeak: false }
    });
  });

  it("keeps the CLI inert under Vitest", () => {
    expect(shouldRunGi088CompleteResponseFirstQualityCli({
      argv: ["node", "scripts/run-gi088-complete-response-first-quality.ts"],
      env: { VITEST: "true" }
    })).toBe(false);
    expect(shouldRunGi088CompleteResponseFirstQualityCli({
      argv: ["node", "scripts/run-gi088-complete-response-first-quality.ts"],
      env: {}
    })).toBe(true);
  });
});
