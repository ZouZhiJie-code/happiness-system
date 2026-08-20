import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { AIProvider } from "../../src/server/services/ai/ai-provider";
import {
  GI088_RESPONSE_FIRST_V26_HIGH_QUALITY_IDENTITY,
  GI088_RESPONSE_FIRST_V26_PATHS,
  createGi088ResponseFirstV26Plan,
  evaluateGi088ResponseFirstV26Review,
  runGi088ResponseFirstV26Phase,
  type Gi088ResponseFirstV26CallResult
} from "../../scripts/run-gi088-response-first-v2-6-low-effort-audited-high";

function highOutput(orphanUnderstanding = false, withQuestion = false) {
  const question = "这份矛盾对你理解自己意味着什么？";
  return JSON.stringify({
    semantic: {
      actionIntent: withQuestion ? "ask" : "acknowledge",
      taskChange: orphanUnderstanding
        ? { kind: "unchanged" }
        : {
            kind: "set",
            continuity: "new",
            targetRef: null,
            summary: "理解用户在比较中的矛盾感受",
            evidenceRefs: ["U3"]
          },
      understandingChange: {
        kind: "add",
        summary: "用户仍然在意与他人的比较",
        evidenceRefs: ["U3"]
      },
      nextResponse: withQuestion
        ? {
            decision: "ask",
            answerFocus: "用户怎样理解这份矛盾",
            informationGoal: "了解用户赋予这份矛盾的意义",
            expectedUnderstandingChange: "形成用户自我理解的新认识",
            evidenceRefs: ["U3"],
            questions: [question]
          }
        : {
            decision: "none",
            answerFocus: null,
            informationGoal: null,
            expectedUnderstandingChange: null,
            evidenceRefs: [],
            questions: []
          },
      burdenAndControlChange: { kind: "unchanged" },
      relationshipExplanations: []
    },
    visibleAppend: { correctableUnderstanding: null },
    informationGainAudit: {
      candidates: withQuestion
        ? [{ question, existingAnswer: null, worthAsking: true }]
        : []
    }
  });
}

function diagnostics(
  content: string,
  latencyMs = 20_000,
  finishReason: "stop" | "length" = "stop"
) {
  return {
    finishReason,
    reasoningPresent: true,
    reasoningLength: 1_000,
    reasoningTokens: 700,
    latencyMs,
    tokenUsage: {
      promptTokens: 1_800,
      completionTokens: 1_100,
      totalTokens: 2_900
    },
    httpStatus: 200,
    responseModel: "deepseek-v4-pro",
    choiceCount: 1,
    contentType: "string" as const,
    contentLength: content.length,
    reasoningType: "string" as const,
    headersLatencyMs: 300,
    firstTokenLatencyMs: null,
    bodyLatencyMs: latencyMs - 300,
    totalLatencyMs: latencyMs,
    timeoutStage: null,
    abortSource: null
  };
}

describe("GI-088 response-first v2.6 low-effort audited High runner", () => {
  it("binds one first case, five remaining cases, and the 4 plus 2 task states", async () => {
    const plan = await createGi088ResponseFirstV26Plan();
    expect(plan.identity).toBe(GI088_RESPONSE_FIRST_V26_HIGH_QUALITY_IDENTITY);
    expect(plan.phases.first_gate).toHaveLength(1);
    expect(plan.phases.remaining).toHaveLength(5);
    expect(plan.dataset.initialWorkingTask.null).toHaveLength(4);
    expect(plan.dataset.initialWorkingTask.existing).toEqual([
      "RPR-REAL-19-CONTINUE",
      "RPR-LC-21"
    ]);
    expect(plan.fixedFactors).toMatchObject({
      parentV25Identity:
        "2026-08-19.gi088-response-first-v2-5-question-self-answer-high-quality-v1",
      parentV25FirstGateTechnicalResult: {
        httpStatus: 200,
        responseLength: 0,
        timeoutStage: "hard_total",
        budgetAuthorized: 6,
        budgetConsumed: 1,
        budgetNotRun: 5
      },
      reasoningEffort: "low",
      maxTokens: 4_000,
      concurrency: 1,
      retries: 0,
      recovery: 0,
      fallback: 0,
      programValidation:
        "v25_state_source_and_deterministic_audit_mapping_unchanged"
    });
    expect(plan.fixedFactors.parentV25EvidenceHashes).toEqual({
      startCardSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      receiptSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      privateLedgerSha256: expect.stringMatching(/^[a-f0-9]{64}$/u)
    });
    expect(plan.candidateIdentity.runtime.high.reasoningEffort).toBe("low");
    expect(plan.candidateIdentity.runtime.high.maxTokens).toBe(4_000);
    expect(plan.changedFactor)
      .toBe("high_reasoning_effort_high_to_low_only");
    expect(plan.gate.firstGateProductContinuation).toBe("pass_only");
    expect(plan.budget).toMatchObject({
      authorized: 6,
      firstGate: 1,
      remaining: 5
    });
  });

  it("runs only the first case and keeps all conversation bodies private", async () => {
    const workspaceRoot = process.cwd();
    const plan = await createGi088ResponseFirstV26Plan(workspaceRoot);
    const temp = await mkdtemp(path.join(os.tmpdir(), "gi088-v26-first-"));
    let calls = 0;
    let observedReasoningEffort: string | undefined;
    let observedMaxTokens: number | undefined;
    const provider: AIProvider = {
      name: "openai",
      complete: async (params) => {
        calls += 1;
        observedReasoningEffort = params.reasoningEffort;
        observedMaxTokens = params.maxTokens;
        const content = highOutput(false, true);
        return {
          content,
          latencyMs: 20_000,
          provider: "openai",
          diagnostics: diagnostics(content)
        };
      }
    };
    const ledger = await runGi088ResponseFirstV26Phase({
      cwd: temp,
      workspaceRoot,
      plan,
      provider,
      phase: "first_gate"
    });
    expect(calls).toBe(1);
    expect(observedReasoningEffort).toBe("low");
    expect(observedMaxTokens).toBe(4_000);
    expect(ledger.startedCaseIds).toEqual(["RPR-REAL-19-CORRECTION"]);
    expect(ledger.results).toHaveLength(1);
    expect(ledger.results[0]?.status).toBe("valid");
    const receiptSource = await readFile(
      path.join(temp, GI088_RESPONSE_FIRST_V26_PATHS.publicReceipt),
      "utf8"
    );
    expect(receiptSource).not.toContain("rawOutput");
    expect(receiptSource).not.toContain("parsedHigh");
    expect(receiptSource).not.toContain("这份矛盾对你理解自己意味着什么");
    expect(receiptSource).not.toContain("用户怎样理解这份矛盾");
    const receipt = JSON.parse(receiptSource) as {
      budget: Record<string, number>;
      results: Array<{ questionObservation: Record<string, unknown> | null }>;
      privateBoundary: { parentV25TimeoutEvidence: string };
    };
    expect(receipt.budget).toMatchObject({
      authorized: 6,
      consumed: 1,
      completed: 1,
      notRun: 5,
      retries: 0,
      recovery: 0,
      fallback: 0
    });
    expect(receipt.results[0]?.questionObservation).toMatchObject({
      structuredQuestionCount: 1,
      candidateCount: 1,
      answeredCandidateCount: 0,
      openCandidateCount: 1,
      worthAskingCandidateCount: 1,
      selectedQuestionCount: 1
    });
    expect(receipt.results[0]?.questionObservation?.answerFocusHash)
      .toMatch(/^[a-f0-9]{64}$/u);
    expect(receipt.privateBoundary.parentV25TimeoutEvidence)
      .toBe(
        "private_ledger_frozen_input_hash_with_public_status_counts_and_hashes_only"
      );
  });

  it("stops the first gate on the unchanged program contract failure", async () => {
    const workspaceRoot = process.cwd();
    const plan = await createGi088ResponseFirstV26Plan(workspaceRoot);
    const temp = await mkdtemp(path.join(os.tmpdir(), "gi088-v26-contract-"));
    let calls = 0;
    const provider: AIProvider = {
      name: "openai",
      complete: async () => {
        calls += 1;
        const content = highOutput(true);
        return {
          content,
          latencyMs: 20_000,
          provider: "openai",
          diagnostics: diagnostics(content)
        };
      }
    };
    const ledger = await runGi088ResponseFirstV26Phase({
      cwd: temp,
      workspaceRoot,
      plan,
      provider,
      phase: "first_gate"
    });
    expect(calls).toBe(1);
    expect(ledger.results[0]?.status).toBe("contract_failure");
    expect(ledger.results[0]?.validationIssues)
      .toContain("NULL_WORKING_TASK_UNDERSTANDING_DELTA_MUST_BE_NULL");
  });

  it("records a 4000-token length finish as token-ceiling inconclusive", async () => {
    const workspaceRoot = process.cwd();
    const plan = await createGi088ResponseFirstV26Plan(workspaceRoot);
    const temp = await mkdtemp(path.join(os.tmpdir(), "gi088-v26-length-"));
    const provider: AIProvider = {
      name: "openai",
      complete: async () => {
        const content = highOutput();
        return {
          content,
          latencyMs: 20_000,
          provider: "openai",
          diagnostics: diagnostics(content, 20_000, "length")
        };
      }
    };
    const ledger = await runGi088ResponseFirstV26Phase({
      cwd: temp,
      workspaceRoot,
      plan,
      provider,
      phase: "first_gate"
    });
    expect(ledger.results[0]).toMatchObject({
      status: "contract_failure",
      errorCode: "GI088_RESPONSE_FIRST_V26_TOKEN_CEILING_INCONCLUSIVE"
    });
    expect(ledger.results[0]?.validationIssues)
      .toContain("HIGH_FINISH_REASON_INVALID:length");
  });

  it("stops after a product minor because the first case is a hard gate", async () => {
    const plan = await createGi088ResponseFirstV26Plan();
    const result = {
      phase: "first_gate",
      caseId: "RPR-REAL-19-CORRECTION",
      status: "valid",
      fullRound60sHardPassed: true,
      fullRoundLatencyMs: 40_000
    } as Gi088ResponseFirstV26CallResult;
    const summary = evaluateGi088ResponseFirstV26Review({
      plan,
      phase: "first_gate",
      results: [result],
      decisions: [{
        caseId: "RPR-REAL-19-CORRECTION",
        verdict: "minor",
        note: "硬案例 minor 不进入其余五题"
      }]
    });
    expect(summary.continuationAllowed).toBe(false);
    expect(summary.gatePassed).toBe(false);
    expect(summary.hardCasesPass).toBe(false);
  });

  it("keeps the remaining five behind the product first-case decision", async () => {
    const workspaceRoot = process.cwd();
    const plan = await createGi088ResponseFirstV26Plan(workspaceRoot);
    const temp = await mkdtemp(path.join(os.tmpdir(), "gi088-v26-gate-"));
    const provider: AIProvider = {
      name: "openai",
      complete: async () => {
        throw new Error("must not call");
      }
    };
    await expect(runGi088ResponseFirstV26Phase({
      cwd: temp,
      workspaceRoot,
      plan,
      provider,
      phase: "remaining"
    })).rejects.toThrow(
      "GI088_RESPONSE_FIRST_V26_REMAINING_REQUIRES_PRODUCT_FIRST_PASS"
    );
  });
});
