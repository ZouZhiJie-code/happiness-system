import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  applyGenerativeRepairProbeReviews,
  assertGenerativeEvaluationCliModeAvailable,
  assertGenerativeRepairProbeRecoveryVersionDelta,
  completeGenerativeRepairProbeTechnicalRecovery,
  createGenerativeDevelopmentEvaluationCase,
  createGenerativeDevelopmentRunFingerprint,
  createGenerativeDevelopmentRunFingerprintWithVersions,
  createGenerativeRepairProbeEnvelopeFingerprint,
  createGenerativeRepairProbeRecoveryEnvelope,
  createGenerativeRepairProbeRunEnvelope,
  EMPTY_GENERATIVE_MEANING_CARD_CANDIDATE_REVIEW,
  formatGenerativeRepairProbeConfirmationPackage,
  formatGenerativeRepairProbeRecoveryReport,
  formatGenerativeRepairProbeReviewPackage,
  GENERATIVE_MEANING_CARD_CANDIDATE_CASES,
  GENERATIVE_REPAIR_PROBE_BUDGET_VERSION,
  GENERATIVE_REPAIR_PROBE_CASES,
  GENERATIVE_REPAIR_PROBE_DATASET,
  GENERATIVE_REPAIR_PROBE_DATASET_VERSION,
  GENERATIVE_REPAIR_PROBE_EXPECTED_RESULTS,
  GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID,
  GENERATIVE_REPAIR_PROBE_RECOVERY_SEMANTIC_PROMPT_VERSION,
  GENERATIVE_REPAIR_PROBE_RECOVERY_VISIBLE_PROMPT_VERSION,
  GENERATIVE_REPAIR_PROBE_RECOVERY_SOURCE_ENVELOPE_FINGERPRINT,
  GENERATIVE_REPAIR_PROBE_RECOVERY_SOURCE_RESERVATION_ID,
  GENERATIVE_REPAIR_PROBE_SOURCE_SEMANTIC_PROMPT_VERSION,
  GENERATIVE_REPAIR_PROBE_VISIBLE_PROMPT_VERSION,
  currentGenerativeRepairProbeVersions,
  generativeRepairProbeRecoveryMeaningCardVersions,
  parseGenerativeRepairProbeBudgetLedger,
  parseGenerativeRepairProbeRecoveryEnvelope,
  parseGenerativeRepairProbeRecoverySourceEnvelope,
  reserveGenerativeRepairProbeRun,
  reserveGenerativeRepairProbeTechnicalRecovery,
  runGenerativeCatalogPreflight,
  summarizeGenerativeRepairProbeGate,
  type GenerativeMeaningCardCandidateReviewRecord,
  type GenerativeRepairProbeRun
} from "@/features/interview/event-centered/generative-evaluation-runner";
import {
  generativeSingleTurnEvaluationCases,
  generativeTrajectoryEvaluationCases
} from "@/features/interview/event-centered/generative-evaluation-catalog";
import {
  GENERATIVE_ARCHITECTURE_PROBE_CASES,
  GENERATIVE_MVP_SMOKE_CASES,
  GENERATIVE_QUALITY_CALIBRATION_CARDS
} from "@/features/interview/event-centered/generative-quality-calibration";
import { EMPTY_GENERATIVE_PRODUCT_REVIEW } from "@/features/interview/event-centered/generative-evaluation-runtime";

const stageMetrics = {
  latencyMs: 180,
  attempts: 1,
  tokenUsage: {
    promptTokens: 120,
    completionTokens: 30,
    totalTokens: 150,
    promptCacheHitTokens: 0,
    promptCacheMissTokens: 120
  },
  tokenUsageComplete: true,
  estimatedCost: null
};

function repairProbeRuns(): GenerativeRepairProbeRun[] {
  const currentPromptVersions = /^two_call:(.+)\+(.+)$/u.exec(
    currentGenerativeRepairProbeVersions().prompt
  );
  if (!currentPromptVersions) throw new Error("CURRENT_REPAIR_PROMPT_INVALID");
  const [, currentSemanticPromptVersion, currentVisiblePromptVersion] =
    currentPromptVersions;
  return GENERATIVE_REPAIR_PROBE_CASES.map((candidate) => {
    const ask = candidate.expectedSemanticState === "needs_more";
    const understandingCard = {
      statement: candidate.expectedMeaningCard.understandingMustCover.join("，"),
      evidenceRefs: [`${candidate.id}-fact-1`]
    };
    const questionIntent = ask ? {
      goal: candidate.expectedMeaningCard.questionGoalMustCover.join("，"),
      answerEntry: candidate.expectedMeaningCard.answerEntryMustCover.join("，"),
      evidenceRefs: [`${candidate.id}-fact-2`]
    } : null;
    const response = ask
      ? "你放大两张照片时，目光先停在哪一处，才让比较结束？"
      : "朋友接住了最慌乱的实际负担，也把向医生说明情况的主导权留在你手里。这个角度先停在这里。";
    const run = {
      runFingerprint: "",
      runId: `${candidate.id}-R1`,
      caseId: candidate.id,
      split: "work" as const,
      runIndex: 1,
      architecture: "two_call" as const,
      assistantPayload: null,
      visibleReplay: {
        thinkingSummary: ask ? "你已经完成选择，具体判断还需要回到放大比较时的画面。" : null,
        userResponse: response,
        responseKind: ask ? "question" as const : "angle_outcome" as const,
        transitionHint: null,
        angleChoices: [],
        availableActions: ["reply"],
        availableActionLabels: ["继续回复"]
      },
      visibleResponse: response,
      finalAction: candidate.expectedAction,
      expectedAction: candidate.expectedAction,
      expectedOutcomeOrigin: null,
      actualOutcomeOrigin: null,
      outcomeClass: ask ? "ask" as const : "unavailable" as const,
      expectedResultMismatch: false,
      sourceMisattribution: false,
      seriousBoundaryErrors: [],
      evidenceUsed: understandingCard.evidenceRefs,
      expectedQuestionValue: questionIntent?.goal ?? null,
      stopReason: ask ? null : "outcome_ready",
      latencyMs: 400,
      runtimeError: null,
      attempts: 2,
      attemptDetails: [],
      metrics: {
        ...stageMetrics,
        latencyMs: 400,
        attempts: 2,
        tokenUsage: {
          ...stageMetrics.tokenUsage,
          promptTokens: 240,
          completionTokens: 60,
          totalTokens: 300
        }
      },
      validationIssues: [],
      qualityDiagnostics: [],
      promptLineage: [{
        promptKey: "interview.event_centered.generative_semantic_plan",
        promptVersion: currentSemanticPromptVersion!,
        resolvedPromptHash: "a".repeat(64)
      }, {
        promptKey: "interview.event_centered.generative_visible_turn",
        promptVersion: currentVisiblePromptVersion!,
        resolvedPromptHash: "b".repeat(64)
      }],
      technicalComplete: true,
      productGateState: "blocked_pending_review" as const,
      versions: {
        strategy: "5.48.0",
        angleCard: "2.12.0",
        fewShot: "quality-patterns.2026-08-01.v27",
        examples: []
      },
      productReview: { ...EMPTY_GENERATIVE_PRODUCT_REVIEW },
      architectureStages: {
        semanticPlan: {
          action: candidate.expectedAction,
          outcomeState: candidate.expectedSemanticState,
          outcomeOrigin: null,
          meaningCard: null,
          understandingCard,
          questionIntent,
          limitReason: null,
          metrics: stageMetrics
        },
        visibleTurn: {
          thinkingSummary: ask ? "你已经完成选择，具体判断还需要回到放大比较时的画面。" : null,
          responseKind: ask ? "question" : "completion",
          response,
          metrics: stageMetrics
        },
        failedStage: null,
        failureCode: null
      },
      expectedSemanticState: candidate.expectedSemanticState,
      expectedMeaningCard: structuredClone(candidate.expectedMeaningCard),
      actualSemanticState: candidate.expectedSemanticState,
      meaningCard: null,
      understandingCard,
      questionIntent,
      limitReason: null,
      meaningCardReview: structuredClone(
        EMPTY_GENERATIVE_MEANING_CARD_CANDIDATE_REVIEW
      ),
      repairRule: candidate.repairRule,
      expectedVisiblePerspective: candidate.expectedVisiblePerspective
    } satisfies GenerativeRepairProbeRun;
    run.runFingerprint = createGenerativeDevelopmentRunFingerprint(run);
    return run;
  });
}

function realRepairProbeRunOne() {
  return parseGenerativeRepairProbeRecoverySourceEnvelope(JSON.parse(readFileSync(
    "artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-run-1.json",
    "utf8"
  )));
}

function realRepairProbeBudget() {
  return parseGenerativeRepairProbeBudgetLedger(JSON.parse(readFileSync(
    "artifacts/generative-interview-board7/2026-08-01/board7-provider-v31-repair-probe-budget.json",
    "utf8"
  )));
}

function realRepairProbeRecoveryOne() {
  return parseGenerativeRepairProbeRecoveryEnvelope(JSON.parse(readFileSync(
    "artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-recovery-1.json",
    "utf8"
  )));
}

function repairProbeBudgetBeforeRecovery() {
  const budget = realRepairProbeBudget();
  return {
    ...budget,
    entries: budget.entries.map((entry) => {
      const historicalEntry = structuredClone(entry);
      delete historicalEntry.recoveryAudit;
      return historicalEntry;
    })
  };
}

function recoveredRelationshipRun(
  technicalComplete = true
): GenerativeRepairProbeRun {
  const source = realRepairProbeRunOne().singleRuns.find(
    (run) => run.caseId === GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID
  )!;
  const response = technicalComplete
    ? "朋友接住了你最慌乱时的实际负担，也把向医生说明情况的主导权留给了你。这个角度就先停在这里。"
    : null;
  const run: GenerativeRepairProbeRun = {
    ...structuredClone(source),
    runFingerprint: "",
    visibleReplay: technicalComplete ? {
      thinkingSummary: null,
      userResponse: response!,
      responseKind: "angle_outcome",
      transitionHint: null,
      angleChoices: [],
      availableActions: ["reply"],
      availableActionLabels: ["继续回复"]
    } : null,
    visibleResponse: response,
    finalAction: technicalComplete ? "pause" : null,
    outcomeClass: "unavailable",
    evidenceUsed: technicalComplete ? ["new:1", "new:2"] : [],
    stopReason: technicalComplete ? "outcome_ready" : null,
    runtimeError: null,
    attempts: 2,
    attemptDetails: [],
    validationIssues: technicalComplete ? [] : ["TIMEOUT"],
    qualityDiagnostics: [],
    promptLineage: [{
      promptKey: "interview.event_centered.generative_semantic_plan",
      promptVersion: GENERATIVE_REPAIR_PROBE_RECOVERY_SEMANTIC_PROMPT_VERSION,
      resolvedPromptHash: "c".repeat(64)
    }, ...(technicalComplete ? [{
      promptKey: "interview.event_centered.generative_visible_turn" as const,
      promptVersion: GENERATIVE_REPAIR_PROBE_RECOVERY_VISIBLE_PROMPT_VERSION,
      resolvedPromptHash: "d".repeat(64)
    }] : [])],
    technicalComplete,
    productGateState: technicalComplete ? "blocked_pending_review" : "fail",
    architectureStages: {
      semanticPlan: {
        action: technicalComplete ? "pause" : null,
        outcomeState: technicalComplete ? "ready" : null,
        outcomeOrigin: null,
        meaningCard: null,
        understandingCard: technicalComplete ? {
          statement: "朋友接住了慌乱中的实际负担，同时把就诊说明的主导权留给你。",
          evidenceRefs: ["new:1", "new:2"]
        } : null,
        questionIntent: null,
        limitReason: null,
        metrics: stageMetrics
      },
      visibleTurn: {
        thinkingSummary: null,
        responseKind: technicalComplete ? "completion" : null,
        response,
        metrics: technicalComplete ? stageMetrics : {
          ...stageMetrics,
          attempts: 0,
          latencyMs: 0
        }
      },
      failedStage: technicalComplete ? null : "semantic_plan",
      failureCode: technicalComplete ? null : "TIMEOUT"
    },
    actualSemanticState: technicalComplete ? "ready" : null,
    understandingCard: technicalComplete ? {
      statement: "朋友接住了慌乱中的实际负担，同时把就诊说明的主导权留给你。",
      evidenceRefs: ["new:1", "new:2"]
    } : null,
    questionIntent: null,
    limitReason: null
  };
  run.runFingerprint = createGenerativeDevelopmentRunFingerprintWithVersions(
    run,
    generativeRepairProbeRecoveryMeaningCardVersions()
  );
  return run;
}

function passReviews(
  runs: readonly GenerativeRepairProbeRun[]
): GenerativeMeaningCardCandidateReviewRecord[] {
  return runs.map((run) => ({
    runId: run.runId,
    runFingerprint: run.runFingerprint,
    semanticCardVerdict: "pass",
    semanticCardReason: null,
    semanticCardEvidence: "状态和修复规则对应的语义结构完整。",
    visibleVerdict: "pass",
    visibleReason: null,
    visibleEvidence: "作答入口具体，停止回应保持 AI 面向用户的视角。",
    severeErrors: [],
    reviewedBy: "codex",
    reviewedAt: "2026-08-01T20:00:00.000Z"
  }));
}

describe("board 7 Provider v3.1 repair probe", () => {
  it("固定两个全新故事并与旧评测家族隔离", () => {
    const forbiddenFamilies = new Set([
      ...generativeSingleTurnEvaluationCases.map((item) => item.scenarioFamily),
      ...generativeTrajectoryEvaluationCases.map((item) => item.scenarioFamily),
      ...GENERATIVE_QUALITY_CALIBRATION_CARDS.map((item) => item.scenarioFamily),
      ...GENERATIVE_ARCHITECTURE_PROBE_CASES.map((item) => item.scenarioFamily),
      ...GENERATIVE_MVP_SMOKE_CASES.map((item) => item.scenarioFamily),
      ...GENERATIVE_MEANING_CARD_CANDIDATE_CASES.map((item) => item.scenarioFamily)
    ]);
    expect(GENERATIVE_REPAIR_PROBE_DATASET_VERSION).toBe(
      "2026-08-01.board7-provider-v31-repair-probe-v1"
    );
    expect(GENERATIVE_REPAIR_PROBE_CASES).toHaveLength(2);
    expect(new Set(GENERATIVE_REPAIR_PROBE_CASES.map((item) => item.repairRule)))
      .toEqual(new Set([
        "goal_abstract_answer_entry_concrete",
        "visible_second_person_or_neutral"
      ]));
    expect(GENERATIVE_REPAIR_PROBE_CASES.every((item) =>
      !forbiddenFamilies.has(item.scenarioFamily)
    )).toBe(true);
    expect(GENERATIVE_REPAIR_PROBE_DATASET.deduplication).toMatchObject({
      checkedBeforeAddition: true,
      matchedExistingStories: []
    });
    expect(runGenerativeCatalogPreflight().issues.some((issue) =>
      issue.startsWith("repair_probe_family_leak:")
    )).toBe(false);
  });

  it("隐藏判尺和新故事不会成为静态 Prompt 或 Few-shot", () => {
    const runtimePayload = JSON.stringify(
      createGenerativeDevelopmentEvaluationCase(GENERATIVE_REPAIR_PROBE_CASES[0]!)
    );
    expect(runtimePayload).not.toContain("repairRule");
    expect(runtimePayload).not.toContain("expectedVisiblePerspective");
    expect(runtimePayload).not.toContain("answerEntryMustCover");

    const promptSources = [
      readFileSync("src/server/services/interview/event-centered-ai.service.ts", "utf8"),
      readFileSync("src/features/interview/event-centered/generative-strategy.ts", "utf8")
    ].join("\n");
    expect(promptSources).not.toContain("V31-RP-T-ENTRY-01");
    expect(promptSources).not.toContain("阳台照片与照片日记封面");
    expect(promptSources).not.toContain("雨夜宠物医院与航空箱");
  });

  it("确认包冻结一次两例且不混入旧六例", () => {
    const confirmation = formatGenerativeRepairProbeConfirmationPackage();
    expect(confirmation).toContain("两个全新案例各运行一次");
    expect(confirmation).toContain("V31-RP-T-ENTRY-01");
    expect(confirmation).toContain("V31-RP-R-VOICE-01");
    expect(confirmation).toContain("src / tests / evals / artifacts / docs / scripts");
    expect(confirmation).not.toContain("V3-T-ASK-01");
    expect(confirmation).not.toContain("社区花园");
  });

  it("保留历史裁决能力，v4 生效后阻断新建 v3.1 运行包", () => {
    const pending = repairProbeRuns();
    expect(summarizeGenerativeRepairProbeGate(pending)).toMatchObject({
      expectedTotal: GENERATIVE_REPAIR_PROBE_EXPECTED_RESULTS,
      technicalComplete: 2,
      semanticCardsPresent: 2,
      decision: "pending_review"
    });
    const reviewed = applyGenerativeRepairProbeReviews(
      pending,
      passReviews(pending)
    );
    expect(summarizeGenerativeRepairProbeGate(reviewed)).toMatchObject({
      semanticPassed: 2,
      visiblePassed: 2,
      severeErrors: 0,
      decision: "pass"
    });
    expect(() => createGenerativeRepairProbeRunEnvelope({
      runs: reviewed,
      budgetReservationId: "repair-probe-1"
    })).toThrow("GENERATIVE_REPAIR_PROBE_HISTORICAL_READ_ONLY");
    const review = formatGenerativeRepairProbeReviewPackage(reviewed);
    expect(review).toContain("导入键：repairProbeRuns");
    expect(review).toContain(reviewed[0]!.runFingerprint);
  });

  it("v3.1 历史预算只读，新运行需要独立小门", () => {
    expect(() => reserveGenerativeRepairProbeRun({
      ledger: null,
      reservationId: "repair-probe-1",
      reservedAt: "2026-08-01T20:00:00.000Z"
    })).toThrow("GENERATIVE_REPAIR_PROBE_HISTORICAL_READ_ONLY");
    expect(realRepairProbeBudget().ledgerVersion).toBe(
      GENERATIVE_REPAIR_PROBE_BUDGET_VERSION
    );
  });

  it("从 run-1 顶层 wrapper 绑定原 reservation、案例指纹和 v69 指纹", () => {
    const raw = JSON.parse(readFileSync(
      "artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-run-1.json",
      "utf8"
    ));
    expect(raw.gate).toBeDefined();
    expect(raw.budget).toBeDefined();
    const source = parseGenerativeRepairProbeRecoverySourceEnvelope(raw);
    expect(source.budgetReservationId).toBe(
      GENERATIVE_REPAIR_PROBE_RECOVERY_SOURCE_RESERVATION_ID
    );
    expect(createGenerativeRepairProbeEnvelopeFingerprint(source)).toBe(
      GENERATIVE_REPAIR_PROBE_RECOVERY_SOURCE_ENVELOPE_FINGERPRINT
    );
    expect(source.singleRuns.map((run) => [run.caseId, run.technicalComplete]))
      .toEqual([
        ["V31-RP-T-ENTRY-01", true],
        [GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID, false]
      ]);
  });

  it("一次性恢复只允许 semantic Prompt 保持当前候选版本并变更 recovery 版本", () => {
    const { source, recovery } = assertGenerativeRepairProbeRecoveryVersionDelta();
    expect(source.prompt).toContain(
      GENERATIVE_REPAIR_PROBE_SOURCE_SEMANTIC_PROMPT_VERSION
    );
    expect(recovery.prompt).toContain(
      GENERATIVE_REPAIR_PROBE_RECOVERY_SEMANTIC_PROMPT_VERSION
    );
    expect(source.prompt).toContain(GENERATIVE_REPAIR_PROBE_VISIBLE_PROMPT_VERSION);
    expect(recovery.prompt).toContain(
      GENERATIVE_REPAIR_PROBE_RECOVERY_VISIBLE_PROMPT_VERSION
    );
    expect({ ...source, prompt: undefined }).toEqual({
      ...recovery,
      prompt: undefined
    });
    expect(currentGenerativeRepairProbeVersions()).toMatchObject({
      prompt:
        "two_call:2026-08-04.event-centered-thought-pilot-v85-gi066-fix+2026-08-04.event-centered-thought-pilot-v85-gi066-fix-visible",
      semanticArtifact: "event-centered-semantic-plan.v17"
    });
    expect(recovery.semanticArtifact).toBe("event-centered-semantic-plan.v3");
  });

  it("预算账本增加独立 recovery 审计并阻断第二次恢复", () => {
    const sourceEnvelope = realRepairProbeRunOne();
    const sourceBudget = realRepairProbeBudget();
    expect(sourceBudget.entries).toHaveLength(1);
    expect(sourceBudget.entries[0]?.recoveryAudit).toMatchObject({
      recoveryId: "5a486a15-8f20-40bb-be61-27eae67f4c49",
      sourceReservationId: sourceEnvelope.budgetReservationId,
      sourceFailedRunFingerprint: sourceEnvelope.singleRuns[1]?.runFingerprint,
      status: "completed",
      technicalComplete: false,
      attempts: 3,
      gateDecision: "stop",
      recoveredCaseIds: [GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID],
      preservedRunIds: ["V31-RP-T-ENTRY-01-R1"]
    });
    expect(() => reserveGenerativeRepairProbeTechnicalRecovery({
      ledger: sourceBudget,
      sourceEnvelope,
      reservationId: sourceEnvelope.budgetReservationId,
      recoveryId: "recovery-2",
      reservedAt: "2026-08-01T21:00:00.000Z"
    })).toThrow("GENERATIVE_REPAIR_PROBE_RECOVERY_NOT_ELIGIBLE");
  });

  it("永久解析 recovery-1 的 v70/v69 结果与 stop 审计", () => {
    const envelope = realRepairProbeRecoveryOne();
    const budget = realRepairProbeBudget();
    const gate = summarizeGenerativeRepairProbeGate(envelope.singleRuns);
    expect(envelope.candidateVersions.prompt).toBe(
      "two_call:2026-08-01.event-centered-generative-v70-understanding-card+2026-08-01.event-centered-generative-v69-visible"
    );
    expect(envelope.singleRuns[0]?.runFingerprint).toBe(
      "7e9656fc22f544eb2d08747f60fa8250eb86316c2e7f629100bf44f5d99a513b"
    );
    expect(envelope.singleRuns[1]).toMatchObject({
      runFingerprint: "456de6207a212e42c91811902af346704f2bdb0ca4ebad0959a926a393419758",
      technicalComplete: false,
      attempts: 3
    });
    expect(envelope.sourceEnvelope.singleRuns[1]?.attemptDetails.map(
      (attempt) => attempt.errorCode
    )).toEqual(["TIMEOUT", "INVALID_SCHEMA"]);
    expect(envelope.singleRuns[1]?.architectureStages).toMatchObject({
      failedStage: "visible_turn",
      failureCode: "INVALID_SCHEMA"
    });
    expect(budget.entries[0]?.recoveryAudit).toMatchObject({
      recoveryEnvelopeFingerprint:
        "c74872ec076267bbc0d30917d7aa6795008b3a32dd20983c4321ec91eea4e7c8",
      recoveredRunFingerprint:
        "456de6207a212e42c91811902af346704f2bdb0ca4ebad0959a926a393419758",
      gateDecision: "stop"
    });
    expect(gate).toMatchObject({
      semanticStateMismatches: 0,
      expectedResultMismatches: 0,
      failureReasons: ["technical:INVALID_SCHEMA"],
      decision: "stop",
      gateState: "fail"
    });
    const report = formatGenerativeRepairProbeRecoveryReport(envelope);
    expect(report).toContain(
      "v70-understanding-card+2026-08-01.event-centered-generative-v69-visible"
    );
    expect(report).toContain("系统动作偏差：0");
    expect(report).toContain("主要失败原因：technical:INVALID_SCHEMA");
    expect(report).not.toContain("ask_stop_timing");
  });

  it("恢复 envelope 原样保留想法案例与原失败 attempts，仅替换关系案例", () => {
    const sourceEnvelope = realRepairProbeRunOne();
    const envelope = parseGenerativeRepairProbeRecoveryEnvelope(
      createGenerativeRepairProbeRecoveryEnvelope({
        sourceEnvelope,
        recoveredRun: recoveredRelationshipRun(),
        recoveryId: "recovery-1",
        createdAt: "2026-08-01T21:02:00.000Z"
      })
    );
    expect(envelope.sourceEnvelope).toEqual(sourceEnvelope);
    expect(envelope.singleRuns[0]).toEqual(sourceEnvelope.singleRuns[0]);
    expect(envelope.singleRuns[0]?.runFingerprint).toBe(
      "7e9656fc22f544eb2d08747f60fa8250eb86316c2e7f629100bf44f5d99a513b"
    );
    expect(envelope.sourceEnvelope.singleRuns[1]?.attemptDetails).toHaveLength(2);
    expect(envelope.singleRuns[1]?.runFingerprint).not.toBe(
      sourceEnvelope.singleRuns[1]?.runFingerprint
    );
    expect(envelope.singleRuns[1]?.promptLineage[0]?.promptVersion).toBe(
      GENERATIVE_REPAIR_PROBE_RECOVERY_SEMANTIC_PROMPT_VERSION
    );
    expect(formatGenerativeRepairProbeRecoveryReport(envelope)).toContain(
      "原 attempts"
    );
  });

  it("恢复完成记录技术结果；恢复仍失败时门槛固定 stop", () => {
    const sourceEnvelope = realRepairProbeRunOne();
    const reserve = (recoveryId: string) =>
      reserveGenerativeRepairProbeTechnicalRecovery({
        ledger: repairProbeBudgetBeforeRecovery(),
        sourceEnvelope,
        reservationId: sourceEnvelope.budgetReservationId,
        recoveryId,
        reservedAt: "2026-08-01T21:00:00.000Z"
      });
    const completedEnvelope = createGenerativeRepairProbeRecoveryEnvelope({
      sourceEnvelope,
      recoveredRun: recoveredRelationshipRun(),
      recoveryId: "recovery-complete"
    });
    const completed = completeGenerativeRepairProbeTechnicalRecovery({
      ledger: reserve("recovery-complete"),
      reservationId: sourceEnvelope.budgetReservationId,
      recoveryId: "recovery-complete",
      completedAt: "2026-08-01T21:03:00.000Z",
      envelope: completedEnvelope
    });
    expect(completed.entries[0]?.recoveryAudit).toMatchObject({
      status: "completed",
      technicalComplete: true,
      attempts: 2,
      gateDecision: "pending_review"
    });

    const failedEnvelope = createGenerativeRepairProbeRecoveryEnvelope({
      sourceEnvelope,
      recoveredRun: recoveredRelationshipRun(false),
      recoveryId: "recovery-failed"
    });
    expect(summarizeGenerativeRepairProbeGate(failedEnvelope.singleRuns)).toMatchObject({
      semanticStateMismatches: 0,
      expectedResultMismatches: 0,
      failureReasons: ["technical:TIMEOUT"],
      decision: "stop",
      gateState: "fail"
    });
    const failed = completeGenerativeRepairProbeTechnicalRecovery({
      ledger: reserve("recovery-failed"),
      reservationId: sourceEnvelope.budgetReservationId,
      recoveryId: "recovery-failed",
      completedAt: "2026-08-01T21:04:00.000Z",
      envelope: failedEnvelope
    });
    expect(parseGenerativeRepairProbeBudgetLedger(failed).entries[0]?.recoveryAudit)
      .toMatchObject({
        status: "completed",
        technicalComplete: false,
        gateDecision: "stop"
      });
  });

  it("CLI 默认保持离线，repair probe 新运行必须显式确认", () => {
    expect(() => assertGenerativeEvaluationCliModeAvailable(
      "provider-v31-repair-probe-confirmation"
    )).not.toThrow();
    expect(() => assertGenerativeEvaluationCliModeAvailable(
      "provider-v31-repair-probe"
    )).not.toThrow();
    expect(() => assertGenerativeEvaluationCliModeAvailable(
      "provider-v31-repair-probe-recovery"
    )).not.toThrow();
    const script = readFileSync("scripts/run-event-centered-generative-eval.ts", "utf8");
    expect(script).toContain('const mode = argumentValue("--mode") ?? "rules"');
    expect(script).toContain('mode !== "provider-v31-repair-probe-confirmation"');
    expect(script).toContain('!(mode === "provider-v31-repair-probe" && existingRunsPath)');
    expect(script).toContain(
      '!(mode === "provider-v31-repair-probe-recovery" && recoveryExistingRunsPath)'
    );
    expect(script).toContain("--recovery-source-runs-json");
    expect(script).toContain("--recovery-reservation-id");
    expect(script).toContain("--recovery-report-only");
    expect(script).toContain("!recoveryReportOnly");
    expect(script).toContain("(reviewImport?.repairProbeRuns?.length ?? 0) > 0");
    expect(script).toContain("GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_IS_SYSTEM_SELECTED");
    expect(script).toContain("模型评测会产生调用成本。请显式追加 --confirm-model-run。");
  });
});
