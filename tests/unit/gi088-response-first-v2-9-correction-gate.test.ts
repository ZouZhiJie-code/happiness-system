import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import type {
  AICompletionParams,
  AIProvider,
  AIProviderDiagnostics
} from "@/server/services/ai/ai-provider";
import {
  GI088_RESPONSE_FIRST_V29_CORRECTION_CASE_ID,
  GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_IDENTITY,
  GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS,
  createGi088ResponseFirstV29CorrectionGatePlan,
  executeGi088ResponseFirstV29CorrectionGate,
  gi088ResponseFirstV29CorrectionGateSha,
  runGi088ResponseFirstV29CorrectionCall
} from "../../scripts/run-gi088-response-first-v2-9-correction-gate";
import {
  loadGi088ResponseFirstV22RubricV13Cases
} from "../../scripts/gi088-response-first-v2-2-rubric-v1-3-fixtures";

const WORKSPACE_ROOT = process.cwd();
const FROZEN_LOW =
  "你仍然在意比较，也意识到自己前后的表达并不一致。";

const temporaryRoots: string[] = [];

afterAll(async () => {
  await Promise.all(
    temporaryRoots.map((root) => rm(root, { recursive: true, force: true }))
  );
});

function validCorrectionOutput() {
  return JSON.stringify({
    turnDecision: {
      coverageGate: null,
      understandingChange: {
        kind: "add",
        sourceMode: "correction",
        summary:
          "用户仍然很在意与他人的比较，先前所说的接纳是自相矛盾的表面说法。",
        evidenceRefs: ["U3"],
        supersededAssistantMessageRefs: ["A2"]
      },
      openTaskChange: { kind: "none" },
      questions: [],
      correctableUnderstanding: null,
      burdenAndControlChange: { kind: "unchanged" },
      relationshipExplanations: []
    }
  });
}

function diagnostics(input: {
  content: string;
  latencyMs?: number;
  finishReason?: AIProviderDiagnostics["finishReason"];
  responseModel?: string;
  httpStatus?: number;
  reasoningPresent?: boolean;
  reasoningTokens?: number | null;
}): AIProviderDiagnostics {
  const latencyMs = input.latencyMs ?? 3_000;
  const reasoningPresent = input.reasoningPresent ?? false;
  return {
    finishReason: input.finishReason ?? "stop",
    reasoningPresent,
    reasoningLength: reasoningPresent ? 12 : 0,
    reasoningTokens: input.reasoningTokens ?? null,
    latencyMs,
    tokenUsage: {
      promptTokens: 2_000,
      completionTokens: 180,
      totalTokens: 2_180
    },
    upstreamRequestId: null,
    httpStatus: input.httpStatus ?? 200,
    responseModel: input.responseModel ?? "deepseek-v4-pro",
    choiceCount: 1,
    contentType: "string",
    contentLength: input.content.length,
    reasoningType: reasoningPresent ? "string" : "missing",
    headersLatencyMs: 100,
    firstTokenLatencyMs: 400,
    bodyLatencyMs: Math.max(0, latencyMs - 100),
    totalLatencyMs: latencyMs,
    timeoutStage: null,
    abortSource: null
  };
}

function provider(input?: {
  content?: string;
  latencyMs?: number;
  finishReason?: AIProviderDiagnostics["finishReason"];
  responseModel?: string;
  httpStatus?: number;
  reasoningPresent?: boolean;
  reasoningTokens?: number | null;
}) {
  const calls: AICompletionParams[] = [];
  const content = input?.content ?? validCorrectionOutput();
  const result: AIProvider = {
    name: "openai",
    stream: async function* () {
      throw new Error("STREAM_NOT_EXPECTED");
    },
    complete: async (params) => {
      calls.push(params);
      return {
        content,
        latencyMs: input?.latencyMs ?? 3_000,
        provider: "openai",
        diagnostics: diagnostics({
          content,
          latencyMs: input?.latencyMs,
          finishReason: input?.finishReason,
          responseModel: input?.responseModel,
          httpStatus: input?.httpStatus,
          reasoningPresent: input?.reasoningPresent,
          reasoningTokens: input?.reasoningTokens
        })
      };
    }
  };
  return { result, calls };
}

async function correctionTurnInput() {
  const dataset = await loadGi088ResponseFirstV22RubricV13Cases(
    WORKSPACE_ROOT
  );
  const item = dataset.cases.find(
    (candidate) => candidate.caseId === GI088_RESPONSE_FIRST_V29_CORRECTION_CASE_ID
  );
  if (!item) throw new Error("CORRECTION_CASE_MISSING_IN_TEST");
  return item.turnInput;
}

function frozenLow() {
  return {
    rawOutput: FROZEN_LOW,
    responseHash: gi088ResponseFirstV29CorrectionGateSha(FROZEN_LOW),
    totalLatencyMs: 3_341,
    planFingerprint: "1".repeat(64),
    candidateFingerprint: "2".repeat(64),
    receiptSha256: "3".repeat(64),
    ledgerSha256: "4".repeat(64)
  };
}

async function makeIsolatedWorkspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), "gi088-v29-gate-"));
  temporaryRoots.push(root);
  for (const directory of ["docs", "evals", "scripts", "src"]) {
    await symlink(
      path.join(WORKSPACE_ROOT, directory),
      path.join(root, directory),
      "dir"
    );
  }
  const artifactParent = path.join(
    root,
    "artifacts/generative-interview-board6"
  );
  await mkdir(artifactParent, { recursive: true });
  await cp(
    path.join(
      WORKSPACE_ROOT,
      "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1"
    ),
    path.join(artifactParent, "2026-08-13-gi088-dual-track-v1"),
    { recursive: true }
  );
  const generatedRoot = path.join(
    root,
    "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1"
  );
  await Promise.all([
    rm(
      path.join(
        generatedRoot,
        "response-first-v2-9-correction-gate-v1-start-card.json"
      ),
      { force: true }
    ),
    rm(
      path.join(
        generatedRoot,
        "response-first-v2-9-correction-gate-v1-receipt.json"
      ),
      { force: true }
    ),
    rm(
      path.join(
        generatedRoot,
        ".private/response-first-v2-9/correction-gate-v1"
      ),
      { recursive: true, force: true }
    )
  ]);
  return root;
}

describe("GI-088 response-first v2.9 correction gate runner", () => {
  it("freezes the one-call identity, v1.3 dataset, and the product-owned v2.8.1 fail", async () => {
    const plan = await createGi088ResponseFirstV29CorrectionGatePlan(
      WORKSPACE_ROOT
    );
    const { planFingerprint, ...core } = plan;

    expect(plan.identity)
      .toBe(GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_IDENTITY);
    expect(gi088ResponseFirstV29CorrectionGateSha(core))
      .toBe(planFingerprint);
    expect(plan.dataset).toMatchObject({
      version:
        "2026-08-17.gi088-response-first-six-real-checkpoints-v1-3-product-owner-rubric",
      caseId: GI088_RESPONSE_FIRST_V29_CORRECTION_CASE_ID
    });
    expect(plan.budget).toEqual({
      currentIdentityAuthorized: 1,
      remainingFamilyBudgetNotRun: 6,
      retries: 0,
      recovery: 0,
      fallback: 0
    });
    expect(plan.parentV281).toMatchObject({
      identity:
        "2026-08-19.gi088-response-first-v2-8-1-causal-continuation-probe-v1",
      productVerdict: "fail",
      highResponseHash:
        "b973db6a30d7ce9b4628717444c986df6c037bf66e43b635af51288f22eb813a"
    });
    expect(plan.parentV281.receiptSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(plan.parentV281.stageLedgerSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(plan.parentV281.productReviewSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(plan.runtime).toMatchObject({
      model: "deepseek-v4-pro",
      high: { thinking: "disabled", maxTokens: 4_000 },
      concurrency: 1,
      retries: 0,
      recovery: 0,
      fallback: 0
    });
  });

  it("persists the correction as understanding while keeping task and visible High empty", async () => {
    const mock = provider();
    const result = await runGi088ResponseFirstV29CorrectionCall({
      provider: mock.result,
      turnInput: await correctionTurnInput(),
      frozenLow: frozenLow()
    });

    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]).toMatchObject({
      maxTokens: 4_000,
      thinking: "disabled",
      responseFormat: "json_object",
      hardTimeoutMs: 60_000
    });
    expect("reasoningEffort" in mock.calls[0]!).toBe(false);
    expect(result).toMatchObject({
      status: "valid",
      errorCode: null,
      highLatencyMs: 3_000,
      observedFullRoundLatencyMs: 6_341,
      observed45sTargetPassed: true,
      observed60sHardPassed: true,
      validationIssues: [],
      observation: {
        coverageGatePresent: false,
        understandingKind: "add",
        understandingSourceMode: "correction",
        openTaskChangeKind: "none",
        questionCount: 0,
        correctableUnderstandingPresent: false
      }
    });
    expect(result.postState?.workingTask).toBeNull();
    expect(result.postState?.understandings).toHaveLength(1);
    expect(result.postState?.understandings[0]).toMatchObject({
      evidenceRefs: ["U3"]
    });
    expect(result.visibleDelivery).toEqual({
      lowText: FROZEN_LOW,
      highUnderstanding: null,
      questions: [],
      completion: "high_complete"
    });
  });

  it("blocks a correction that incorrectly creates an open task", async () => {
    const invalidStateOutput = JSON.stringify({
      turnDecision: {
        coverageGate: {
          checkedUserMessageRefs: ["U1", "U2", "U3"],
          targetGap: "用户为什么仍然在意比较",
          coverage: "open",
          existingAnswer: null,
          remainingGap: "用户在意比较的原因",
          expectedGain: "了解比较背后的原因",
          evidenceRefs: ["U3"]
        },
        understandingChange: {
          kind: "add",
          sourceMode: "correction",
          summary: "用户仍然在意比较。",
          evidenceRefs: ["U3"],
          supersededAssistantMessageRefs: ["A2"]
        },
        openTaskChange: { kind: "set_new" },
        questions: [],
        correctableUnderstanding: null,
        burdenAndControlChange: { kind: "unchanged" },
        relationshipExplanations: []
      }
    });
    const mock = provider({ content: invalidStateOutput });
    const result = await runGi088ResponseFirstV29CorrectionCall({
      provider: mock.result,
      turnInput: await correctionTurnInput(),
      frozenLow: frozenLow()
    });

    expect(result.status).toBe("contract_failure");
    expect(result.errorCode).toBe("GI088_RESPONSE_FIRST_V29_CONTRACT_INVALID");
    expect(result.validationIssues)
      .toContain("CORRECTION_GATE_OPEN_TASK_MUST_REMAIN_NULL");
    expect(result.postState?.workingTask).not.toBeNull();
  });

  it("separates length, model, and disabled-thinking diagnostic failures from transport success", async () => {
    const mock = provider({
      finishReason: "length",
      responseModel: "unexpected-model",
      reasoningPresent: true,
      reasoningTokens: 9
    });
    const result = await runGi088ResponseFirstV29CorrectionCall({
      provider: mock.result,
      turnInput: await correctionTurnInput(),
      frozenLow: frozenLow()
    });

    expect(result.status).toBe("contract_failure");
    expect(result.errorCode)
      .toBe("GI088_RESPONSE_FIRST_V29_TOKEN_CEILING_INCONCLUSIVE");
    expect(result.validationIssues).toEqual(expect.arrayContaining([
      "HIGH_FINISH_REASON_INVALID:length",
      "HIGH_RESPONSE_MODEL_INVALID:unexpected-model",
      "HIGH_REASONING_PRESENT_INVALID:true",
      "HIGH_REASONING_TOKENS_INVALID:9"
    ]));
    expect(result.responseHash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("publishes hashes and metrics only while keeping the full review files at 0600", async () => {
    const isolatedRoot = await makeIsolatedWorkspace();
    const mock = provider();
    const ledger = await executeGi088ResponseFirstV29CorrectionGate({
      cwd: isolatedRoot,
      provider: mock.result
    });

    expect(ledger.result?.status).toBe("valid");
    expect(mock.calls).toHaveLength(1);

    const receiptFile = path.join(
      isolatedRoot,
      GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.publicReceipt
    );
    const receiptSource = await readFile(receiptFile, "utf8");
    expect(receiptSource).not.toContain('"rawOutput"');
    expect(receiptSource).not.toContain('"turnInput"');
    expect(receiptSource).toContain('"publicReceiptContainsBodies": false');

    for (const relative of [
      GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.privateLedger,
      GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.privateReviewHtml,
      GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.privateProductReviewTemplate
    ]) {
      expect((await stat(path.join(isolatedRoot, relative))).mode & 0o777)
        .toBe(0o600);
    }

    const privateSource = await readFile(
      path.join(
        isolatedRoot,
        GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.privateLedger
      ),
      "utf8"
    );
    const privateLedger = JSON.parse(privateSource) as {
      turnInput: {
        conversation: Array<{ content: string }>;
      };
      frozenLow: { rawOutput: string };
      result: { rawOutput: string };
    };
    for (const body of [
      ...privateLedger.turnInput.conversation.map((message) => message.content),
      privateLedger.frozenLow.rawOutput,
      privateLedger.result.rawOutput
    ]) {
      expect(body.length).toBeGreaterThan(0);
      expect(receiptSource).not.toContain(body);
    }
    expect(privateSource).toContain("用户仍然很在意与他人的比较");
  });
});
