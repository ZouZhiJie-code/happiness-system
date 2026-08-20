import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type {
  AICompletionParams,
  AIProvider,
  AIProviderDiagnostics
} from "@/server/services/ai/ai-provider";
import {
  GI088_RESPONSE_FIRST_V29_CONTINUATION_CASE_ID,
  GI088_RESPONSE_FIRST_V29_CONTINUATION_IDENTITY,
  GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS,
  buildGi088ResponseFirstV29ContinuationTurnInput,
  createGi088ResponseFirstV29ContinuationPlan,
  gi088ResponseFirstV29ContinuationSha,
  loadGi088ResponseFirstV29ContinuationParentEvidence,
  runGi088ResponseFirstV29ContinuationGate,
  shouldRunGi088ResponseFirstV29ContinuationCli,
  validateGi088ResponseFirstV29ContinuationProductReview,
  type Gi088ResponseFirstV29ContinuationProductReview
} from "../../scripts/run-gi088-response-first-v2-9-causal-continuation-gate";

const lowText = "好，我们就沿着你在意比较这件事继续深挖。";

function highOutput(noOp = false) {
  return JSON.stringify({
    turnDecision: {
      coverageGate: noOp ? null : {
        checkedUserMessageRefs: ["U1", "U2", "U3", "U4"],
        targetGap: "用户想继续深挖自己在比较中真正被触动的部分",
        coverage: "partial",
        existingAnswer: {
          summary: "用户已说明具体比较事件、愤慨以及自己仍在意比较",
          evidenceRefs: ["U1", "U2", "U3"]
        },
        remainingGap: "用户在与他人比较时真正害怕失去或需要证明的是什么",
        expectedGain: "理解比较为何会持续触发强烈感受",
        evidenceRefs: ["U1", "U2", "U3", "U4"]
      },
      understandingChange: { kind: "none" },
      openTaskChange: noOp ? { kind: "none" } : { kind: "set_new" },
      questions: noOp
        ? []
        : ["当你发现别人做得比你更好时，最刺痛你的到底是什么？"],
      correctableUnderstanding: null,
      burdenAndControlChange: { kind: "unchanged" },
      relationshipExplanations: []
    }
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
    reasoningLength: input.reasoningPresent ? 30 : 0,
    reasoningTokens: input.reasoningPresent ? 18 : null,
    latencyMs: input.latencyMs,
    tokenUsage: {
      promptTokens: 2_000,
      completionTokens: input.reasoningPresent ? 40 : 120,
      totalTokens: input.reasoningPresent ? 2_040 : 2_120
    },
    upstreamRequestId: null,
    httpStatus: 200,
    responseModel: "deepseek-v4-pro",
    choiceCount: 1,
    contentType: "string",
    contentLength: input.content.length,
    reasoningType: input.reasoningPresent ? "string" : "missing",
    headersLatencyMs: 100,
    firstTokenLatencyMs: input.reasoningPresent ? 800 : null,
    bodyLatencyMs: input.latencyMs - 100,
    totalLatencyMs: input.latencyMs,
    timeoutStage: null,
    abortSource: null
  };
}

function provider(input?: {
  lowLatencyMs?: number;
  lowReasoningPresent?: boolean;
  highNoOp?: boolean;
}) {
  const calls: AICompletionParams[] = [];
  const highText = highOutput(input?.highNoOp);
  const result: AIProvider = {
    name: "openai",
    stream: async function* (params) {
      calls.push(params);
      params.onStreamDiagnostics?.(diagnostics({
        content: lowText,
        latencyMs: input?.lowLatencyMs ?? 2_000,
        reasoningPresent: input?.lowReasoningPresent ?? true
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
  return { result, calls, highText };
}

describe("GI-088 response-first v2.9 causal continuation gate", () => {
  it("replays the product-approved parent and replaces fixture A3 with the actual visible bubble", async () => {
    const parent = await loadGi088ResponseFirstV29ContinuationParentEvidence();
    const plan = await createGi088ResponseFirstV29ContinuationPlan();
    const { planFingerprint, ...core } = plan;
    expect(gi088ResponseFirstV29ContinuationSha(core)).toBe(planFingerprint);
    expect(plan).toMatchObject({
      identity: GI088_RESPONSE_FIRST_V29_CONTINUATION_IDENTITY,
      budget: {
        authorized: 2,
        low: 1,
        high: 1,
        remainingFamilyBudgetNotRun: 4
      },
      parentCorrectionGate: {
        productVerdict: "pass",
        rawOutputReparsedAndValidated: true,
        postStateReprojected: true,
        visibleDeliveryReprojected: true
      }
    });
    const causal = buildGi088ResponseFirstV29ContinuationTurnInput(parent);
    const historicalA3 = parent.continuationFixtureInput.conversation.at(-2)!;
    expect(causal.turnInput.semanticState).toEqual(parent.postState);
    expect(gi088ResponseFirstV29ContinuationSha(causal.turnInput.semanticState))
      .not.toBe(gi088ResponseFirstV29ContinuationSha(
        parent.continuationFixtureInput.semanticState
      ));
    expect(plan.causalInput).toMatchObject({
      actualSemanticStateHash: parent.postStateHash,
      actualStateDiffersFromHistoricalFixture: true
    });
    expect(plan.causalInput.actualSemanticStateHash)
      .not.toBe(plan.causalInput.historicalFixtureSemanticStateHash);
    expect(causal.actualAssistant.content).toBe(parent.actualVisibleBubble);
    expect(causal.actualAssistant.content).not.toBe(historicalA3.content);
    expect(causal.turnInput.latestUserMessageId).toBe("U4");
    expect(GI088_RESPONSE_FIRST_V29_CONTINUATION_CASE_ID)
      .toBe("RPR-REAL-19-CONTINUE");
  });

  it("writes both calls before execution and feeds the fresh v2.2 Low only into v2.9 High", async () => {
    const workspaceRoot = process.cwd();
    const parent = await loadGi088ResponseFirstV29ContinuationParentEvidence(
      workspaceRoot
    );
    const plan = await createGi088ResponseFirstV29ContinuationPlan(workspaceRoot);
    const cwd = await mkdtemp(path.join(os.tmpdir(), "gi088-v29-continuation-"));
    const mock = provider();
    const ledger = await runGi088ResponseFirstV29ContinuationGate({
      cwd,
      workspaceRoot,
      plan,
      provider: mock.result
    });

    expect(ledger.callsStarted).toEqual(["low", "high"]);
    expect(ledger.low).toMatchObject({
      status: "valid",
      responseHash: gi088ResponseFirstV29ContinuationSha(lowText),
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
    expect(lowPrompt).toContain(parent.actualVisibleBubble);
    expect(lowPrompt).not.toContain(historicalA3.content);
    expect(highPrompt).toContain(parent.actualVisibleBubble);
    expect(highPrompt).toContain(lowText);
    expect(highPrompt).not.toContain(historicalA3.content);

    const receiptSource = await readFile(
      path.join(cwd, GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS.publicReceipt),
      "utf8"
    );
    expect(receiptSource).not.toContain(lowText);
    expect(receiptSource).not.toContain(mock.highText);
    expect(receiptSource).not.toContain("rawOutput");
    expect(receiptSource).not.toContain('"effectiveTurnInput":');
    expect((await stat(path.join(
      cwd,
      GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS.privateLedger
    ))).mode & 0o777).toBe(0o600);
    expect((await stat(path.join(
      cwd,
      GI088_RESPONSE_FIRST_V29_CONTINUATION_PATHS.privateReviewHtml
    ))).mode & 0o777).toBe(0o600);

    const review: Gi088ResponseFirstV29ContinuationProductReview = {
      identity: GI088_RESPONSE_FIRST_V29_CONTINUATION_IDENTITY,
      planFingerprint: plan.planFingerprint,
      reviewerRole: "product_owner",
      evidenceBinding: {
        parentResponseHash: plan.parentCorrectionGate.responseHash,
        parentPostStateHash: plan.parentCorrectionGate.postStateHash,
        effectiveTurnInputHash: ledger.effectiveTurnInputHash!,
        lowResponseHash: ledger.low!.responseHash!,
        highResponseHash: ledger.high!.responseHash!,
        projectedHighHash: gi088ResponseFirstV29ContinuationSha(
          ledger.high!.projectedHigh
        ),
        visibleDeliveryHash: gi088ResponseFirstV29ContinuationSha(
          ledger.high!.visibleDelivery
        ),
        continuationPostStateHash: gi088ResponseFirstV29ContinuationSha(
          ledger.high!.continuationPostState
        )
      },
      verdict: "pass",
      note: "已依据完整原文确认。"
    };
    expect(validateGi088ResponseFirstV29ContinuationProductReview({
      review,
      plan,
      ledger
    })).toMatchObject({
      verdict: "pass",
      technicalGatePassed: true,
      gatePassed: true
    });
    const lowResponseHash = review.evidenceBinding.lowResponseHash;
    const projectedHighHash = review.evidenceBinding.projectedHighHash;
    const visibleDeliveryHash = review.evidenceBinding.visibleDeliveryHash;
    review.evidenceBinding.lowResponseHash = "0".repeat(64);
    expect(() => validateGi088ResponseFirstV29ContinuationProductReview({
      review,
      plan,
      ledger
    })).toThrow("GI088_RESPONSE_FIRST_V29_CONTINUATION_PRODUCT_REVIEW_INVALID");
    review.evidenceBinding.lowResponseHash = lowResponseHash;
    review.evidenceBinding.projectedHighHash = "1".repeat(64);
    expect(() => validateGi088ResponseFirstV29ContinuationProductReview({
      review,
      plan,
      ledger
    })).toThrow("GI088_RESPONSE_FIRST_V29_CONTINUATION_PRODUCT_REVIEW_INVALID");
    review.evidenceBinding.projectedHighHash = projectedHighHash;
    review.evidenceBinding.visibleDeliveryHash = "2".repeat(64);
    expect(() => validateGi088ResponseFirstV29ContinuationProductReview({
      review,
      plan,
      ledger
    })).toThrow("GI088_RESPONSE_FIRST_V29_CONTINUATION_PRODUCT_REVIEW_INVALID");
    review.evidenceBinding.visibleDeliveryHash = visibleDeliveryHash;
  });

  it("marks a structurally valid no-op High as a continuation contract failure", async () => {
    const workspaceRoot = process.cwd();
    const plan = await createGi088ResponseFirstV29ContinuationPlan(workspaceRoot);
    const cwd = await mkdtemp(path.join(os.tmpdir(), "gi088-v29-no-op-"));
    const mock = provider({ highNoOp: true });
    const ledger = await runGi088ResponseFirstV29ContinuationGate({
      cwd,
      workspaceRoot,
      plan,
      provider: mock.result
    });
    expect(mock.calls).toHaveLength(2);
    expect(ledger.high).toMatchObject({
      status: "contract_failure"
    });
    expect(ledger.high?.validationIssues).toEqual(expect.arrayContaining([
      "CONTINUATION_COVERAGE_MUST_BE_PARTIAL_OR_OPEN",
      "CONTINUATION_OPEN_TASK_CHANGE_MUST_SET_NEW",
      "CONTINUATION_POST_STATE_WORKING_TASK_REQUIRED"
    ]));
  });

  it("stops High when Low misses the speed or Thinking gate", async () => {
    const workspaceRoot = process.cwd();
    const plan = await createGi088ResponseFirstV29ContinuationPlan(workspaceRoot);
    for (const [suffix, options] of [
      ["slow", { lowLatencyMs: 15_001 }],
      ["thinking", { lowReasoningPresent: false }]
    ] as const) {
      const cwd = await mkdtemp(path.join(os.tmpdir(), `gi088-v29-${suffix}-`));
      const mock = provider(options);
      const ledger = await runGi088ResponseFirstV29ContinuationGate({
        cwd,
        workspaceRoot,
        plan,
        provider: mock.result
      });
      expect(mock.calls).toHaveLength(1);
      expect(ledger.callsStarted).toEqual(["low"]);
      expect(ledger.high).toBeNull();
    }
  });

  it("recognizes the package command and stays inert in Vitest", () => {
    expect(shouldRunGi088ResponseFirstV29ContinuationCli({
      argv: ["node", "/node_modules/vite-node/vite-node.mjs"],
      env: { GI088_RESPONSE_FIRST_V29_CONTINUATION_GATE_COMMAND: "prepare" }
    })).toBe(true);
    expect(shouldRunGi088ResponseFirstV29ContinuationCli({
      argv: ["node", "/node_modules/vitest/vitest.mjs"],
      env: {
        VITEST: "true",
        GI088_RESPONSE_FIRST_V29_CONTINUATION_GATE_COMMAND: "prepare"
      }
    })).toBe(false);
  });
});
