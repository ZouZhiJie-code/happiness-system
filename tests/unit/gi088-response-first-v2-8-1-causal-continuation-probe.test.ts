import { readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import type {
  AICompletionParams,
  AIProvider,
  AIProviderDiagnostics
} from "@/server/services/ai/ai-provider";
import {
  GI088_RESPONSE_FIRST_V281_CASE_ID,
  GI088_RESPONSE_FIRST_V281_IDENTITY,
  GI088_RESPONSE_FIRST_V281_PARENT_CASE_ID,
  GI088_RESPONSE_FIRST_V281_PATHS,
  buildGi088ResponseFirstV281CausalTurnInput,
  createGi088ResponseFirstV281Plan,
  gi088ResponseFirstV281Sha,
  loadGi088ResponseFirstV281ParentEvidence,
  runGi088ResponseFirstV281Probe,
  shouldRunGi088ResponseFirstV281Cli,
  validateGi088ResponseFirstV281ParentProductReview,
  validateGi088ResponseFirstV281ProductReview,
  type Gi088ResponseFirstV281ParentProductReview,
  type Gi088ResponseFirstV281ProductReview
} from "../../scripts/run-gi088-response-first-v2-8-1-causal-continuation-probe";

const freshLow = "你还是很在意和别人的比较，也看见了自己前后说法里的矛盾。";

function highOutput() {
  return JSON.stringify({
    correctionPersistenceAudit: {
      decision: "none",
      correctedMeaning: null,
      supersededAssistantMessageRefs: [],
      statePlan: null
    },
    semantic: {
      actionIntent: "acknowledge",
      taskChange: { kind: "unchanged" },
      understandingChange: { kind: "none" },
      nextResponse: {
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
    informationGainAudit: { candidates: [] }
  });
}

function diagnostics(input: {
  content: string;
  latencyMs: number;
  reasoningPresent: boolean;
}): AIProviderDiagnostics {
  return {
    finishReason: "stop",
    reasoningPresent: input.reasoningPresent,
    reasoningLength: input.reasoningPresent ? 10 : 0,
    reasoningTokens: input.reasoningPresent ? 10 : null,
    latencyMs: input.latencyMs,
    tokenUsage: {
      promptTokens: 2_000,
      completionTokens: 200,
      totalTokens: 2_200
    },
    upstreamRequestId: null,
    httpStatus: 200,
    responseModel: "deepseek-v4-pro",
    choiceCount: 1,
    contentType: "string",
    contentLength: input.content.length,
    reasoningType: input.reasoningPresent ? "string" : "missing",
    headersLatencyMs: 100,
    firstTokenLatencyMs: 500,
    bodyLatencyMs: input.latencyMs - 100,
    totalLatencyMs: input.latencyMs,
    timeoutStage: null,
    abortSource: null
  };
}

function parentReview(input: {
  identity: string;
  planFingerprint: string;
  responseHash: string;
  postStateHash: string;
  verdict?: "pass" | "minor" | "fail";
}): Gi088ResponseFirstV281ParentProductReview {
  return {
    identity: input.identity,
    planFingerprint: input.planFingerprint,
    phase: "first_gate",
    reviewerRole: "product_owner",
    evidenceBinding: {
      caseId: GI088_RESPONSE_FIRST_V281_PARENT_CASE_ID,
      responseHash: input.responseHash,
      postStateHash: input.postStateHash
    },
    decisions: [{
      caseId: GI088_RESPONSE_FIRST_V281_PARENT_CASE_ID,
      verdict: input.verdict ?? "pass",
      note: "已依据首题完整原文确认。"
    }]
  };
}

function provider(input?: { lowLatencyMs?: number; lowText?: string }) {
  const calls: AICompletionParams[] = [];
  const lowText = input?.lowText ?? freshLow;
  const highText = highOutput();
  const result: AIProvider = {
    name: "openai",
    stream: async function* (params) {
      calls.push(params);
      params.onStreamDiagnostics?.(diagnostics({
        content: lowText,
        latencyMs: input?.lowLatencyMs ?? 2_000,
        reasoningPresent: true
      }));
      yield lowText;
    },
    complete: async (params) => {
      calls.push(params);
      return {
        content: highText,
        latencyMs: 3_000,
        provider: "openai",
        diagnostics: diagnostics({
          content: highText,
          latencyMs: 3_000,
          reasoningPresent: false
        })
      };
    }
  };
  return { result, calls };
}

describe("GI-088 response-first v2.8.1 causal continuation probe", () => {
  it("detects the vite-node package command while staying inert under Vitest imports", () => {
    expect(shouldRunGi088ResponseFirstV281Cli({
      argv: ["node", "/node_modules/vite-node/vite-node.mjs"],
      env: {
        GI088_RESPONSE_FIRST_V281_COMMAND: "--prepare"
      }
    })).toBe(true);
    expect(shouldRunGi088ResponseFirstV281Cli({
      argv: ["node", "/node_modules/vitest/vitest.mjs"],
      env: {
        VITEST: "true",
        GI088_RESPONSE_FIRST_V281_COMMAND: "--prepare"
      }
    })).toBe(false);
  });

  it("recomputes the parent plan and post-state before constructing the actual A3 plus U4 turn", async () => {
    const parent = await loadGi088ResponseFirstV281ParentEvidence();
    const plan = await createGi088ResponseFirstV281Plan();
    const { planFingerprint, ...core } = plan;
    expect(gi088ResponseFirstV281Sha(core)).toBe(planFingerprint);
    expect(plan.identity).toBe(GI088_RESPONSE_FIRST_V281_IDENTITY);
    expect(plan.candidates.highCandidateFingerprint)
      .toBe(plan.parentV28.candidateFingerprint);
    expect(plan.budget).toMatchObject({ authorized: 2, low: 1, high: 1 });
    expect(plan.retiredScope).toEqual({
      originalV28RemainingFive: "retired_not_run",
      otherFourCasesAfterProbe: "not_run"
    });

    const causal = buildGi088ResponseFirstV281CausalTurnInput(parent);
    const historicalA3 = parent.continuationFixtureInput.conversation.at(-2)!;
    expect(causal.turnInput.semanticState).toEqual(parent.postState);
    expect(gi088ResponseFirstV281Sha(causal.turnInput.semanticState))
      .toBe(parent.postStateHash);
    expect(causal.actualAssistant.content).toBe(parent.actualAssistantBubble);
    expect(causal.actualAssistant.content).not.toBe(historicalA3.content);
    expect(causal.turnInput.latestUserMessageId).toBe("U4");
    expect(causal.turnInput.conversation.at(-1))
      .toEqual(parent.continuationFixtureInput.conversation.at(-1));
  });

  it("allows only a hash-bound parent pass or minor review", async () => {
    const parent = await loadGi088ResponseFirstV281ParentEvidence();
    for (const verdict of ["pass", "minor", "fail"] as const) {
      const review = parentReview({ ...parent, verdict });
      expect(validateGi088ResponseFirstV281ParentProductReview({
        review,
        parent
      }).allowed).toBe(verdict !== "fail");
    }
    const changed = parentReview(parent);
    changed.evidenceBinding.postStateHash = "0".repeat(64);
    expect(() => validateGi088ResponseFirstV281ParentProductReview({
      review: changed,
      parent
    })).toThrow("GI088_RESPONSE_FIRST_V281_PARENT_PRODUCT_REVIEW_INVALID");
  });

  it("calls a new causal Low and feeds only that result into unchanged v2.8 High", async () => {
    const workspaceRoot = process.cwd();
    const parent = await loadGi088ResponseFirstV281ParentEvidence(workspaceRoot);
    const plan = await createGi088ResponseFirstV281Plan(workspaceRoot);
    const cwd = await mkdtemp(path.join(os.tmpdir(), "gi088-v281-happy-"));
    const mock = provider();
    const ledger = await runGi088ResponseFirstV281Probe({
      cwd,
      workspaceRoot,
      plan,
      provider: mock.result,
      parentProductReview: parentReview(parent)
    });

    expect(ledger.callsStarted).toEqual(["low", "high"]);
    expect(ledger.low).toMatchObject({
      status: "valid",
      responseHash: gi088ResponseFirstV281Sha(freshLow),
      target15sPassed: true,
      hard45sPassed: true
    });
    expect(ledger.high).toMatchObject({
      status: "valid",
      frozenLowHash: ledger.low?.responseHash,
      fullRoundLatencyMs: 5_000,
      fullRound45sTargetPassed: true,
      fullRound60sHardPassed: true
    });
    expect(mock.calls).toHaveLength(2);
    expect(mock.calls[0]).toMatchObject({
      maxTokens: 1_280,
      thinking: "enabled",
      reasoningEffort: "low"
    });
    expect(mock.calls[1]).toMatchObject({
      maxTokens: 4_000,
      thinking: "disabled"
    });
    expect("reasoningEffort" in mock.calls[1]!).toBe(false);
    const historicalA3 = parent.continuationFixtureInput.conversation.at(-2)!;
    const lowPrompt = mock.calls[0]!.messages[1]!.content;
    const highPrompt = mock.calls[1]!.messages[1]!.content;
    expect(lowPrompt).toContain(parent.actualAssistantBubble);
    expect(lowPrompt).not.toContain(historicalA3.content);
    expect(highPrompt).toContain(freshLow);
    expect(highPrompt).toContain(parent.actualAssistantBubble);
    expect(highPrompt).not.toContain(historicalA3.content);

    const receiptSource = await readFile(
      path.join(cwd, GI088_RESPONSE_FIRST_V281_PATHS.publicReceipt),
      "utf8"
    );
    expect(receiptSource).not.toContain(freshLow);
    expect(receiptSource).not.toContain("rawOutput");
    expect(receiptSource).not.toContain('"effectiveTurnInput":');
    expect(receiptSource).toContain('"historicalContinuationLowUsedByHigh": false');
    expect((await stat(path.join(
      cwd,
      GI088_RESPONSE_FIRST_V281_PATHS.privateLedger
    ))).mode & 0o777).toBe(0o600);
    expect((await stat(path.join(
      cwd,
      GI088_RESPONSE_FIRST_V281_PATHS.privateReviewHtml
    ))).mode & 0o777).toBe(0o600);
  });

  it("stops after one Low call when the 15 second Low gate fails", async () => {
    const workspaceRoot = process.cwd();
    const parent = await loadGi088ResponseFirstV281ParentEvidence(workspaceRoot);
    const plan = await createGi088ResponseFirstV281Plan(workspaceRoot);
    const cwd = await mkdtemp(path.join(os.tmpdir(), "gi088-v281-low-stop-"));
    const mock = provider({ lowLatencyMs: 15_001 });
    const ledger = await runGi088ResponseFirstV281Probe({
      cwd,
      workspaceRoot,
      plan,
      provider: mock.result,
      parentProductReview: parentReview(parent)
    });
    expect(mock.calls).toHaveLength(1);
    expect(ledger.callsStarted).toEqual(["low"]);
    expect(ledger.low).toMatchObject({
      status: "valid",
      target15sPassed: false,
      hard45sPassed: true
    });
    expect(ledger.high).toBeNull();
    const receipt = JSON.parse(await readFile(
      path.join(cwd, GI088_RESPONSE_FIRST_V281_PATHS.publicReceipt),
      "utf8"
    ));
    expect(receipt).toMatchObject({
      status: "v281_low_speed_no_go",
      budget: { authorized: 2, consumed: 1, completed: 1, notRun: 1 }
    });
    await expect(runGi088ResponseFirstV281Probe({
      cwd,
      workspaceRoot,
      plan,
      provider: mock.result,
      parentProductReview: parentReview(parent)
    })).rejects.toThrow("GI088_RESPONSE_FIRST_V281_PARTIAL_RUN_NO_RECOVERY");
    expect(mock.calls).toHaveLength(1);
  });

  it("requires a second product review bound to every causal result hash", async () => {
    const workspaceRoot = process.cwd();
    const parent = await loadGi088ResponseFirstV281ParentEvidence(workspaceRoot);
    const plan = await createGi088ResponseFirstV281Plan(workspaceRoot);
    const cwd = await mkdtemp(path.join(os.tmpdir(), "gi088-v281-review-"));
    const mock = provider();
    const ledger = await runGi088ResponseFirstV281Probe({
      cwd,
      workspaceRoot,
      plan,
      provider: mock.result,
      parentProductReview: parentReview(parent)
    });
    const review: Gi088ResponseFirstV281ProductReview = {
      identity: GI088_RESPONSE_FIRST_V281_IDENTITY,
      planFingerprint: plan.planFingerprint,
      reviewerRole: "product_owner",
      evidenceBinding: {
        parentResponseHash: plan.parentV28.responseHash,
        parentPostStateHash: plan.parentV28.postStateHash,
        effectiveTurnInputHash: ledger.effectiveTurnInputHash!,
        lowResponseHash: ledger.low!.responseHash!,
        highResponseHash: ledger.high!.responseHash!,
        continuationPostStateHash:
          gi088ResponseFirstV281Sha(ledger.high!.continuationPostState)
      },
      verdict: "minor",
      note: "自然推进通过，保留一处轻微表达问题。"
    };
    expect(validateGi088ResponseFirstV281ProductReview({
      review,
      plan,
      ledger
    })).toMatchObject({
      verdict: "minor",
      technicalGatePassed: true,
      gatePassed: true
    });
    review.evidenceBinding.lowResponseHash = "f".repeat(64);
    expect(() => validateGi088ResponseFirstV281ProductReview({
      review,
      plan,
      ledger
    })).toThrow("GI088_RESPONSE_FIRST_V281_PRODUCT_REVIEW_INVALID");
    expect(GI088_RESPONSE_FIRST_V281_CASE_ID).toBe("RPR-REAL-19-CONTINUE");
  });
});
