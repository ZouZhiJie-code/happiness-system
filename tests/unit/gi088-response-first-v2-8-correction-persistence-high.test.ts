import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { AIProvider } from "../../src/server/services/ai/ai-provider";
import {
  GI088_RESPONSE_FIRST_V28_HIGH_QUALITY_IDENTITY,
  GI088_RESPONSE_FIRST_V28_PATHS,
  buildGi088ResponseFirstV28ChainedContinueInput,
  createGi088ResponseFirstV28Plan,
  evaluateGi088ResponseFirstV28Review,
  runGi088ResponseFirstV28Phase
} from "../../scripts/run-gi088-response-first-v2-8-correction-persistence-high";
import {
  loadGi088ResponseFirstV22RubricV13Cases
} from "../../scripts/gi088-response-first-v2-2-rubric-v1-3-fixtures";

function noPersistenceOutput() {
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

function persistedCorrectionOutput() {
  const correctedMeaning = "用户澄清自己并没有真正接纳此前谈到的感受";
  return JSON.stringify({
    correctionPersistenceAudit: {
      decision: "persist",
      correctedMeaning: {
        summary: correctedMeaning,
        evidenceRefs: ["U3"]
      },
      supersededAssistantMessageRefs: ["A2"],
      statePlan: {
        task: { kind: "set_new" },
        understanding: { kind: "add" }
      }
    },
    semantic: {
      actionIntent: "acknowledge",
      taskChange: {
        kind: "set",
        continuity: "new",
        targetRef: null,
        summary: "沿用户纠正后的真实重点继续理解",
        evidenceRefs: ["U3"]
      },
      understandingChange: {
        kind: "add",
        summary: correctedMeaning,
        evidenceRefs: ["U3"]
      },
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

function diagnostics(content: string, latencyMs = 2_000) {
  return {
    finishReason: "stop" as const,
    reasoningPresent: false,
    reasoningLength: 0,
    reasoningTokens: null,
    latencyMs,
    tokenUsage: {
      promptTokens: 2_000,
      completionTokens: 300,
      totalTokens: 2_300
    },
    httpStatus: 200,
    responseModel: "deepseek-v4-pro",
    choiceCount: 1,
    contentType: "string" as const,
    contentLength: content.length,
    reasoningType: "missing" as const,
    headersLatencyMs: 200,
    firstTokenLatencyMs: null,
    bodyLatencyMs: latencyMs - 200,
    totalLatencyMs: latencyMs,
    timeoutStage: null,
    abortSource: null
  };
}

async function authorizeRemaining(input: {
  cwd: string;
  plan: Awaited<ReturnType<typeof createGi088ResponseFirstV28Plan>>;
  firstResult: Awaited<ReturnType<typeof runGi088ResponseFirstV28Phase>>["results"][number];
}) {
  const summary = evaluateGi088ResponseFirstV28Review({
    plan: input.plan,
    phase: "first_gate",
    results: [input.firstResult],
    decisions: [{
      caseId: "RPR-REAL-19-CORRECTION",
      verdict: "pass",
      note: "测试中模拟产品负责人通过首题"
    }]
  });
  expect(summary.continuationAllowed).toBe(true);
  const ledgerFile = path.join(
    input.cwd,
    GI088_RESPONSE_FIRST_V28_PATHS.privateLedger
  );
  const ledger = JSON.parse(await readFile(ledgerFile, "utf8")) as {
    productDecision: { first_gate: unknown };
  };
  ledger.productDecision.first_gate = summary;
  await writeFile(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`, {
    mode: 0o600
  });
}

describe("GI-088 response-first v2.8 correction-persistence High runner", () => {
  it("binds v2.7 evidence and declares the runtime-only CONTINUE request", async () => {
    const plan = await createGi088ResponseFirstV28Plan();
    expect(plan.identity).toBe(GI088_RESPONSE_FIRST_V28_HIGH_QUALITY_IDENTITY);
    expect(plan.phases.first_gate).toHaveLength(1);
    expect(plan.phases.remaining).toHaveLength(5);
    expect(plan.fixedFactors).toMatchObject({
      parentV27Identity:
        "2026-08-19.gi088-response-first-v2-7-thinking-disabled-audited-high-quality-v1",
      parentV27FirstGateResult: {
        httpStatus: 200,
        finishReason: "stop",
        contractValid: true,
        fullRoundLatencyMs: 5_188,
        budgetAuthorized: 6,
        budgetConsumed: 1,
        budgetNotRun: 5,
        productDecision: "pending"
      },
      thinking: "disabled",
      reasoningEffort: "omitted",
      maxTokens: 4_000,
      continuationFixtureStateUsage: "forbidden",
      continuationFixtureAssistantUsage: "forbidden",
      continuationLowHistoricalInputLimitation:
        "frozen_low_was_historically_generated_from_the_fixture_assistant_message"
    });
    expect(plan.changedFactor)
      .toBe("audit_first_explicit_correction_persistence_only");
    expect(plan.fixedFactors.parentV27EvidenceHashes).toEqual({
      startCardSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      receiptSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      privateLedgerSha256: expect.stringMatching(/^[a-f0-9]{64}$/u)
    });
    const continued = plan.phases.remaining.find(
      (item) => item.caseId === "RPR-REAL-19-CONTINUE"
    )!;
    expect(continued).toMatchObject({
      effectiveInputSource: "correction_post_state_chain",
      requestFingerprint: null
    });
    expect(plan.candidateIdentity.runtime.high.thinking).toBe("disabled");
    expect("reasoningEffort" in plan.candidateIdentity.runtime.high)
      .toBe(false);
  });

  it("replaces both the fixture state and historical A3 while preserving U4", async () => {
    const dataset = await loadGi088ResponseFirstV22RubricV13Cases();
    const correction = dataset.cases.find(
      (item) => item.caseId === "RPR-REAL-19-CORRECTION"
    )!;
    const continued = dataset.cases.find(
      (item) => item.caseId === "RPR-REAL-19-CONTINUE"
    )!;
    const postState = structuredClone(continued.turnInput.semanticState);
    postState.workingTask!.summary = "首题实际投影生成的主线";
    postState.understandings[0]!.summary = "首题实际投影生成的认识";
    postState.invalidatedItems = [];
    const historicalA3 = continued.turnInput.conversation.at(-2)!;
    const chained = buildGi088ResponseFirstV28ChainedContinueInput({
      correctionInput: correction.turnInput,
      continuationFixtureInput: continued.turnInput,
      correctionPostState: postState,
      actualAssistantBubble: "首题实际可见气泡"
    });
    expect(chained.turnInput.semanticState).toEqual(postState);
    expect(chained.turnInput.semanticState)
      .not.toEqual(continued.turnInput.semanticState);
    expect(chained.turnInput.conversation.at(-2)).toMatchObject({
      id: historicalA3.id,
      role: "assistant",
      content: "首题实际可见气泡"
    });
    expect(JSON.stringify(chained.turnInput))
      .not.toContain(historicalA3.content);
    expect(chained.turnInput.latestUserMessageId).toBe("U4");
    expect(chained.turnInput.conversation.at(-1))
      .toEqual(continued.turnInput.conversation.at(-1));
  });

  it("projects the first correction into a private post-state without changing runtime factors", async () => {
    const workspaceRoot = process.cwd();
    const plan = await createGi088ResponseFirstV28Plan(workspaceRoot);
    const cwd = await mkdtemp(path.join(os.tmpdir(), "gi088-v28-first-"));
    let observedThinking: string | undefined;
    let observedReasoningEffort: string | undefined;
    let observedMaxTokens: number | undefined;
    const provider: AIProvider = {
      name: "openai",
      complete: async (params) => {
        observedThinking = params.thinking;
        observedReasoningEffort = params.reasoningEffort;
        observedMaxTokens = params.maxTokens;
        const content = persistedCorrectionOutput();
        return {
          content,
          latencyMs: 2_000,
          provider: "openai",
          diagnostics: diagnostics(content)
        };
      }
    };
    const ledger = await runGi088ResponseFirstV28Phase({
      cwd,
      workspaceRoot,
      plan,
      provider,
      phase: "first_gate"
    });
    const first = ledger.results[0]!;
    expect(observedThinking).toBe("disabled");
    expect(observedReasoningEffort).toBeUndefined();
    expect(observedMaxTokens).toBe(4_000);
    expect(first.status).toBe("valid");
    expect(first.postState?.workingTask?.evidenceRefs).toContain("U3");
    expect(first.postState?.understandings.some(
      (item) => item.evidenceRefs.includes("U3")
    )).toBe(true);
    expect(first.firstGateSemanticObservation).toMatchObject({
      correctionDeclared: true,
      u3Grounded: true,
      supersededLatestAssistant: true,
      postStateTaskGrounded: true,
      postStateUnderstandingGrounded: true,
      visibleLowFrozen: true,
      highUnderstandingPresent: false,
      questionCount: 0
    });
    const receiptSource = await readFile(
      path.join(cwd, GI088_RESPONSE_FIRST_V28_PATHS.publicReceipt),
      "utf8"
    );
    expect(receiptSource).not.toContain("rawOutput");
    expect(receiptSource).not.toContain('"effectiveTurnInput":');
    expect(receiptSource).not.toContain('"postState":');
    expect((await stat(path.join(
      cwd,
      GI088_RESPONSE_FIRST_V28_PATHS.privateLedger
    ))).mode & 0o777).toBe(0o600);
    expect((await stat(path.join(
      cwd,
      GI088_RESPONSE_FIRST_V28_PATHS.privateFirstReviewHtml
    ))).mode & 0o777).toBe(0o600);
  });

  it("keeps a semantic miss reviewable instead of converting it to a contract failure", async () => {
    const workspaceRoot = process.cwd();
    const plan = await createGi088ResponseFirstV28Plan(workspaceRoot);
    const cwd = await mkdtemp(path.join(os.tmpdir(), "gi088-v28-semantic-"));
    const provider: AIProvider = {
      name: "openai",
      complete: async () => {
        const content = noPersistenceOutput();
        return {
          content,
          latencyMs: 2_000,
          provider: "openai",
          diagnostics: diagnostics(content)
        };
      }
    };
    const ledger = await runGi088ResponseFirstV28Phase({
      cwd,
      workspaceRoot,
      plan,
      provider,
      phase: "first_gate"
    });
    expect(ledger.results[0]).toMatchObject({
      status: "valid",
      validationIssues: [],
      firstGateSemanticObservation: {
        correctionDeclared: false,
        u3Grounded: false,
        postStateTaskGrounded: false,
        postStateUnderstandingGrounded: false
      }
    });
    expect(await stat(path.join(
      cwd,
      GI088_RESPONSE_FIRST_V28_PATHS.privateFirstReviewHtml
    ))).toBeDefined();
  });

  it("uses the first actual bubble and post-state in the CONTINUE High request", async () => {
    const workspaceRoot = process.cwd();
    const plan = await createGi088ResponseFirstV28Plan(workspaceRoot);
    const dataset = await loadGi088ResponseFirstV22RubricV13Cases();
    const continuationFixture = dataset.cases.find(
      (item) => item.caseId === "RPR-REAL-19-CONTINUE"
    )!;
    const historicalA3 = continuationFixture.turnInput.conversation.at(-2)!;
    const cwd = await mkdtemp(path.join(os.tmpdir(), "gi088-v28-chain-"));
    let continuedPrompt: string | null = null;
    const provider: AIProvider = {
      name: "openai",
      complete: async (params) => {
        const userPrompt = params.messages[1]?.content ?? "";
        const parsed = JSON.parse(userPrompt) as {
          compactContext: { latestUserMessageId: string };
        };
        const content = parsed.compactContext.latestUserMessageId === "U3"
          ? persistedCorrectionOutput()
          : noPersistenceOutput();
        if (parsed.compactContext.latestUserMessageId === "U4") {
          continuedPrompt = userPrompt;
        }
        return {
          content,
          latencyMs: 2_000,
          provider: "openai",
          diagnostics: diagnostics(content)
        };
      }
    };
    const firstLedger = await runGi088ResponseFirstV28Phase({
      cwd,
      workspaceRoot,
      plan,
      provider,
      phase: "first_gate"
    });
    const first = firstLedger.results[0]!;
    await authorizeRemaining({ cwd, plan, firstResult: first });
    const completeLedger = await runGi088ResponseFirstV28Phase({
      cwd,
      workspaceRoot,
      plan,
      provider,
      phase: "remaining"
    });
    const continued = completeLedger.results.find(
      (item) => item.caseId === "RPR-REAL-19-CONTINUE"
    )!;
    expect(continued.status).toBe("valid");
    expect(continued.inputCausality).toMatchObject({
      source: "correction_post_state_chain",
      fixtureSemanticStateIgnored: true,
      fixtureAssistantMessageReplaced: true,
      chainedFromCaseId: "RPR-REAL-19-CORRECTION",
      chainedFromResponseHash: first.responseHash,
      continuationLowHistoricalInputLimitation: true
    });
    expect(continued.effectiveTurnInput.semanticState).toEqual(first.postState);
    expect(continued.effectiveTurnInput.semanticState)
      .not.toEqual(continuationFixture.turnInput.semanticState);
    const actualA3 = continued.effectiveTurnInput.conversation.at(-2)!;
    expect(actualA3.id).toBe(historicalA3.id);
    expect(actualA3.content).not.toBe(historicalA3.content);
    expect(continued.effectiveTurnInput.latestUserMessageId).toBe("U4");
    expect(continuedPrompt).not.toBeNull();
    expect(continuedPrompt!).toContain(actualA3.content);
    expect(continuedPrompt!).not.toContain(historicalA3.content);
    const parsedPrompt = JSON.parse(continuedPrompt!) as {
      compactContext: {
        latestUserMessageId: string;
        currentTask: { summary: string; evidenceRefs: string[] } | null;
        keyUnderstandings: Array<{ summary: string; evidenceRefs: string[] }>;
        recentInvalidations: unknown[];
      };
    };
    expect(parsedPrompt.compactContext.latestUserMessageId).toBe("U4");
    expect(parsedPrompt.compactContext.currentTask).toMatchObject({
      summary: first.postState?.workingTask?.summary,
      evidenceRefs: first.postState?.workingTask?.evidenceRefs
    });
    expect(parsedPrompt.compactContext.keyUnderstandings[0]).toMatchObject({
      summary: first.postState?.understandings[0]?.summary,
      evidenceRefs: first.postState?.understandings[0]?.evidenceRefs
    });
    expect(parsedPrompt.compactContext.recentInvalidations).toEqual([]);
  });
});
