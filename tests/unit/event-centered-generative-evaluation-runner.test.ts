import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  applyGenerativeProductReviews,
  assertGenerativeEvaluationCliModeAvailable,
  auditGenerativeGi009TwoCallRunGate,
  completeGenerativeDevelopmentRunBudget,
  createGenerativeCaseConfirmationPackage,
  createGenerativeDevelopmentEvaluationCase,
  createGenerativeDevelopmentRunEnvelope,
  createGenerativeDevelopmentRunFingerprint,
  currentGenerativeDevelopmentCandidateVersions,
  formatGenerativeEvaluationReport,
  formatGenerativeCaseConfirmationPackage,
  formatGenerativeHumanReviewPackage,
  GENERATIVE_V65_RUN_BUDGET_CANDIDATE_VERSIONS,
  GENERATIVE_GI009_ARCHITECTURE_EXPERIMENT_APPROVAL_VERSION,
  GENERATIVE_GI009_TWO_CALL_TARGETED_CASE_IDS,
  GENERATIVE_MVP_STABILITY_CASES,
  GENERATIVE_MVP_STRICT_SMOKE_CASE_IDS,
  GENERATIVE_MVP_STRICT_SMOKE_CASES,
  reserveGenerativeDevelopmentRunBudget,
  parseGenerativeDevelopmentRunBudgetLedger,
  parseGenerativeDevelopmentRunEnvelope,
  runGenerativeDeepSeekProviderPreflight,
  summarizeGenerativeDevelopmentCommandOutcome,
  summarizeGenerativeDevelopmentGate,
  summarizeGenerativeDevelopmentTechnicalCalls,
  validateGenerativeDevelopmentModelRunApproval,
  validateGenerativeDevelopmentRunSelection,
  validateGenerativeGi009ArchitectureExperimentApproval,
  voidGenerativeDevelopmentTechnicalPreflightGap,
  withGenerativeEvaluationProviderTraceName,
  GenerativeDeepSeekPreflightError,
  type GenerativeOutcomeClass,
  type GenerativeSingleTurnRun
} from "@/features/interview/event-centered/generative-evaluation-runner";
import {
  EMPTY_GENERATIVE_PRODUCT_REVIEW,
  type GenerativeReviewReason,
  type GenerativeReviewVerdict
} from "@/features/interview/event-centered/generative-evaluation-runtime";

function developmentRun(input: {
  caseId: string;
  outcomeClass: Extract<
    GenerativeOutcomeClass,
    "ask" | "user_articulated" | "ai_synthesized"
  >;
  verdict?: GenerativeReviewVerdict;
  primaryReason?: GenerativeReviewReason | null;
  technicalComplete?: boolean;
  sourceMisattribution?: boolean;
  expectedResultMismatch?: boolean;
  seriousBoundaryErrors?: string[];
  finalVerdict?: GenerativeReviewVerdict;
  architecture?: "one_call" | "two_call";
}) {
  const architecture = input.architecture ?? "one_call";
  const candidateVersions = currentGenerativeDevelopmentCandidateVersions(architecture);
  const promptVersions = architecture === "two_call"
    ? candidateVersions.prompt.replace(/^two_call:/u, "").split("+")
    : [candidateVersions.prompt];
  const expectedAction = input.outcomeClass === "ask" ? "ask" : "complete";
  const expectedOutcomeOrigin = input.outcomeClass === "ask"
    ? null
    : input.outcomeClass;
  const run = {
    runFingerprint: "",
    runId: `${input.caseId}-R1`,
    caseId: input.caseId,
    split: "work" as const,
    runIndex: 1,
    architecture,
    assistantPayload: null,
    visibleReplay: null,
    visibleResponse: null,
    finalAction: expectedAction,
    technicalComplete: input.technicalComplete ?? true,
    expectedAction,
    expectedOutcomeOrigin,
    actualOutcomeOrigin: expectedOutcomeOrigin,
    outcomeClass: input.outcomeClass,
    expectedResultMismatch:
      input.expectedResultMismatch ?? input.sourceMisattribution ?? false,
    sourceMisattribution: input.sourceMisattribution ?? false,
    seriousBoundaryErrors: input.seriousBoundaryErrors ?? [],
    evidenceUsed: [],
    expectedQuestionValue: null,
    stopReason: null,
    latencyMs: 1,
    runtimeError: null,
    attempts: 1,
    attemptDetails: [],
    metrics: {
      latencyMs: 1,
      attempts: 1,
      tokenUsage: {
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
        promptCacheHitTokens: 0,
        promptCacheMissTokens: 1
      },
      tokenUsageComplete: true,
      estimatedCost: null
    },
    validationIssues: [],
    qualityDiagnostics: [],
    promptLineage: promptVersions.map((promptVersion) => ({
      promptKey: "interview.event_centered.generative_turn",
      promptVersion,
      resolvedPromptHash: "a".repeat(64)
    })),
    productGateState: "blocked_pending_review" as const,
    versions: {
      strategy: candidateVersions.strategy,
      angleCard: candidateVersions.angleCard,
      fewShot: candidateVersions.fewShot,
      examples: []
    },
    productReview: {
      ...EMPTY_GENERATIVE_PRODUCT_REVIEW,
      initialVerdict: input.verdict ?? "pass",
      initialReviewedBy: "codex",
      initialReviewedAt: "2026-07-30T00:00:00.000Z",
      finalVerdict: input.finalVerdict ?? null,
      reviewedBy: input.finalVerdict ? "product_owner" : null,
      reviewedAt: input.finalVerdict ? "2026-07-30T00:05:00.000Z" : null,
      primaryReason: input.primaryReason ?? null
    }
  } as GenerativeSingleTurnRun;
  run.runFingerprint = createGenerativeDevelopmentRunFingerprint(run);
  return run;
}

function technicalPreflightFailureRun(caseId: string) {
  const probe = GENERATIVE_MVP_STRICT_SMOKE_CASES.find((item) => item.id === caseId)!;
  const run = {
    ...developmentRun({ caseId, outcomeClass: "ask" }),
    assistantPayload: null,
    visibleReplay: null,
    visibleResponse: null,
    finalAction: null,
    expectedAction: probe.expectedAction,
    expectedOutcomeOrigin: probe.expectedOutcomeOrigin,
    actualOutcomeOrigin: null,
    outcomeClass: "unavailable" as const,
    expectedResultMismatch: true,
    evidenceUsed: [],
    expectedQuestionValue: null,
    stopReason: null,
    runtimeError: null,
    attempts: 2,
    attemptDetails: [1, 2].map(() => ({
      stage: "question" as const,
      attempt: 1,
      provider: "volcengine-ark",
      success: false,
      latencyMs: null,
      errorCode: "REQUEST_FAILED",
      errorMessage: "fetch failed"
    })),
    metrics: {
      latencyMs: 1,
      attempts: 2,
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        promptCacheHitTokens: 0,
        promptCacheMissTokens: 0
      },
      tokenUsageComplete: false,
      estimatedCost: null
    },
    validationIssues: ["REQUEST_FAILED", "fetch failed"],
    qualityDiagnostics: [],
    technicalComplete: false,
    productGateState: "blocked_pending_review" as const,
    productReview: { ...EMPTY_GENERATIVE_PRODUCT_REVIEW }
  } as GenerativeSingleTurnRun;
  run.runFingerprint = createGenerativeDevelopmentRunFingerprint(run);
  return run;
}

function gi009CampaignWithRemainingTwoCallBudget(
  confirmation: ReturnType<typeof createGenerativeCaseConfirmationPackage>
) {
  const fullSelection = validateGenerativeDevelopmentRunSelection({ stage: "smoke" });
  const baselineFull = reserveGenerativeDevelopmentRunBudget({
    ledger: null,
    confirmation,
    selection: fullSelection,
    architecture: "one_call",
    reservationId: "baseline-one-call-full",
    reservedAt: "2026-07-30T10:00:00.000Z"
  });
  const completedFull = completeGenerativeDevelopmentRunBudget({
    ledger: baselineFull.ledger,
    confirmation,
    reservationId: baselineFull.entry.reservationId,
    completedAt: "2026-07-30T10:01:00.000Z",
    runs: GENERATIVE_MVP_STRICT_SMOKE_CASES.map((probe) => developmentRun({
      caseId: probe.id,
      outcomeClass: probe.expectedAction === "ask"
        ? "ask"
        : probe.expectedOutcomeOrigin!,
      architecture: "one_call"
    }))
  });
  const baselineTargetedSelection = validateGenerativeDevelopmentRunSelection({
    stage: "smoke",
    caseIds: ["SMK-F-PARTIAL-ASK", "SMK-R-CLEAN-ASK"]
  });
  const baselineTargeted = reserveGenerativeDevelopmentRunBudget({
    ledger: completedFull,
    confirmation,
    selection: baselineTargetedSelection,
    architecture: "one_call",
    reservationId: "baseline-one-call-targeted",
    reservedAt: "2026-07-30T10:02:00.000Z"
  });
  return completeGenerativeDevelopmentRunBudget({
    ledger: baselineTargeted.ledger,
    confirmation,
    reservationId: baselineTargeted.entry.reservationId,
    completedAt: "2026-07-30T10:03:00.000Z",
    runs: baselineTargetedSelection.caseIds.map((caseId) => developmentRun({
      caseId,
      outcomeClass: "ask",
      architecture: "one_call"
    }))
  });
}

describe("event-centered generative development gate", () => {
  it("8 条稳定性案例用 R-CLOSED 替换同类关系成果并保持 4/6/6 结果矩阵", () => {
    expect(GENERATIVE_MVP_STABILITY_CASES).toHaveLength(8);
    expect(new Set(GENERATIVE_MVP_STABILITY_CASES.map((item) => item.id)).size).toBe(8);
    expect(GENERATIVE_MVP_STABILITY_CASES.map((item) => item.id)).toContain(
      "SMK-R-CLOSED"
    );
    expect(GENERATIVE_MVP_STABILITY_CASES.map((item) => item.id)).not.toContain(
      "AB-RG-01"
    );

    const expectedClass = (item: (typeof GENERATIVE_MVP_STABILITY_CASES)[number]) =>
      item.expectedAction === "ask"
        ? "ask"
        : item.expectedOutcomeOrigin;
    expect(GENERATIVE_MVP_STABILITY_CASES.filter(
      (item) => expectedClass(item) === "ask"
    )).toHaveLength(2);
    expect(GENERATIVE_MVP_STABILITY_CASES.filter(
      (item) => expectedClass(item) === "user_articulated"
    )).toHaveLength(3);
    expect(GENERATIVE_MVP_STABILITY_CASES.filter(
      (item) => expectedClass(item) === "ai_synthesized"
    )).toHaveLength(3);
    for (const angle of ["feeling", "thought", "relationship", "action"] as const) {
      expect(GENERATIVE_MVP_STABILITY_CASES.filter(
        (item) => item.angle === angle
      )).toHaveLength(2);
    }
    expect(GENERATIVE_MVP_STABILITY_CASES.filter(
      (item) => item.mode === "guided_reflection"
    )).toHaveLength(4);
    expect(GENERATIVE_MVP_STABILITY_CASES.filter(
      (item) => item.mode === "deep_conversation"
    )).toHaveLength(4);
  });

  it("12 条冒烟要求 ask、用户成果和 AI 综合各 4/4", () => {
    const runs = (["ask", "user_articulated", "ai_synthesized"] as const)
      .flatMap((outcomeClass) => Array.from({ length: 4 }, (_, index) =>
        developmentRun({
          caseId: `${outcomeClass}-${index + 1}`,
          outcomeClass
        })
      ));

    const gate = summarizeGenerativeDevelopmentGate({
      runs,
      stage: "smoke",
      reviewLevel: "codex"
    });

    expect(gate.gateState).toBe("pass");
    expect(gate.classSummaries.ask.passed).toBe(4);
    expect(gate.classSummaries.user_articulated.passed).toBe(4);
    expect(gate.classSummaries.ai_synthesized.passed).toBe(4);
  });

  it("严格冒烟的动作或成果来源不匹配会直接失败", () => {
    const runs = (["ask", "user_articulated", "ai_synthesized"] as const)
      .flatMap((outcomeClass) => Array.from({ length: 4 }, (_, index) =>
        developmentRun({
          caseId: `${outcomeClass}-${index + 1}`,
          outcomeClass,
          expectedResultMismatch: outcomeClass === "ask" && index === 0
        })
      ));

    expect(summarizeGenerativeDevelopmentGate({
      runs,
      stage: "smoke",
      reviewLevel: "codex"
    }).gateState).toBe("fail");
  });

  it("16 条自然开发集只看总体质量，不要求固定动作或类别配额", () => {
    const runs = Array.from({ length: 16 }, (_, index) => developmentRun({
      caseId: `natural-${index + 1}`,
      outcomeClass: "ask",
      verdict: index >= 14 ? "fail" : "pass",
      primaryReason: index === 14
        ? "expression_naturalness"
        : index === 15
          ? "insight_value"
          : null,
      expectedResultMismatch: index === 0
    }));

    const gate = summarizeGenerativeDevelopmentGate({
      runs,
      stage: "stability",
      reviewLevel: "codex"
    });

    expect(gate.gateState).toBe("pass");
    expect(gate.passed).toBe(14);
    expect(gate.classSummaries.ask.total).toBe(16);
    expect(gate.classSummaries.user_articulated.total).toBe(0);
    expect(gate.classSummaries.ai_synthesized.total).toBe(0);
    expect(gate.distributionMatches).toBe(true);
  });

  it("来源误判、严重越界和同一主要失败跨两个案例都会阻断", () => {
    const runs = (["ask", "user_articulated", "ai_synthesized"] as const)
      .flatMap((outcomeClass) => Array.from({ length: 4 }, (_, index) =>
        developmentRun({
          caseId: `${outcomeClass}-${index + 1}`,
          outcomeClass,
          verdict: index === 0 && outcomeClass !== "ask" ? "fail" : "pass",
          primaryReason: index === 0 && outcomeClass !== "ask"
            ? "context_or_assumption"
            : null,
          sourceMisattribution: outcomeClass === "user_articulated" && index === 0,
          seriousBoundaryErrors: outcomeClass === "ai_synthesized" && index === 0
            ? ["ai_synthesized_outcome_asserts_other_person_motive"]
            : []
        })
      ));

    const gate = summarizeGenerativeDevelopmentGate({
      runs,
      stage: "smoke",
      reviewLevel: "codex"
    });

    expect(gate.gateState).toBe("fail");
    expect(gate.sourceMisattribution).toBe(1);
    expect(gate.seriousBoundaryErrors).toBeGreaterThan(0);
    expect(gate.repeatedPrimaryFailures).toEqual([
      {
        reason: "context_or_assumption",
        caseIds: ["user_articulated-1", "ai_synthesized-1"]
      }
    ]);
  });

  it("Codex 与产品负责人分别满足自然开发集 14/16", () => {
    const runs = Array.from({ length: 16 }, (_, index) => developmentRun({
      caseId: `review-${index + 1}`,
      outcomeClass: index % 2 === 0 ? "ask" : "ai_synthesized",
      verdict: index >= 14 ? "fail" : "pass",
      finalVerdict: index >= 14 ? "fail" : "pass",
      primaryReason: index === 14
        ? "expression_naturalness"
        : index === 15
          ? "answer_burden"
          : null
    }));

    expect(summarizeGenerativeDevelopmentGate({
      runs,
      stage: "stability",
      reviewLevel: "codex"
    }).gateState).toBe("pass");
    expect(summarizeGenerativeDevelopmentGate({
      runs,
      stage: "stability",
      reviewLevel: "product_owner"
    }).gateState).toBe("pass");
  });

  it("默认人工门区分待裁决、质量失败和完全通过", () => {
    const reviewedRuns = (["ask", "user_articulated", "ai_synthesized"] as const)
      .flatMap((outcomeClass) => Array.from({ length: 4 }, (_, index) =>
        developmentRun({
          caseId: `${outcomeClass}-${index + 1}`,
          outcomeClass,
          finalVerdict: "pass"
        })
      ));
    const codexPass = summarizeGenerativeDevelopmentGate({
      runs: reviewedRuns,
      stage: "smoke",
      reviewLevel: "codex"
    });
    const productPass = summarizeGenerativeDevelopmentGate({
      runs: reviewedRuns,
      stage: "smoke",
      reviewLevel: "product_owner"
    });
    const productPending = summarizeGenerativeDevelopmentGate({
      runs: reviewedRuns.map((run) => ({
        ...run,
        productReview: {
          ...run.productReview,
          finalVerdict: null,
          reviewedBy: null,
          reviewedAt: null
        }
      })),
      stage: "smoke",
      reviewLevel: "product_owner"
    });
    const codexFail = summarizeGenerativeDevelopmentGate({
      runs: reviewedRuns.map((run, index) => index === 0
        ? {
            ...run,
            productReview: {
              ...run.productReview,
              initialVerdict: "fail" as const
            }
          }
        : run
      ),
      stage: "smoke",
      reviewLevel: "codex"
    });

    expect(summarizeGenerativeDevelopmentCommandOutcome({
      codexGate: codexPass,
      productGate: productPending
    })).toEqual({ status: "blocked_pending_human_review", exitCode: 2 });
    expect(summarizeGenerativeDevelopmentCommandOutcome({
      codexGate: codexFail,
      productGate: productPass
    })).toEqual({ status: "failed_human_gate", exitCode: 1 });
    expect(summarizeGenerativeDevelopmentCommandOutcome({
      codexGate: codexPass,
      productGate: productPass
    })).toEqual({ status: "passed", exitCode: 0 });
  });

  it("定向子集已裁决失败返回 1，子集全通过仍返回 2 等待完整门", () => {
    const failedRun = developmentRun({
      caseId: "SMK-F-PARTIAL-ASK",
      outcomeClass: "ask",
      verdict: "fail",
      primaryReason: "insight_value"
    });
    expect(summarizeGenerativeDevelopmentCommandOutcome({
      codexGate: summarizeGenerativeDevelopmentGate({
        runs: [failedRun],
        stage: "smoke",
        reviewLevel: "codex"
      }),
      productGate: summarizeGenerativeDevelopmentGate({
        runs: [failedRun],
        stage: "smoke",
        reviewLevel: "product_owner"
      })
    })).toEqual({ status: "failed_human_gate", exitCode: 1 });

    const passedRun = developmentRun({
      caseId: "SMK-F-PARTIAL-ASK",
      outcomeClass: "ask"
    });
    expect(summarizeGenerativeDevelopmentCommandOutcome({
      codexGate: summarizeGenerativeDevelopmentGate({
        runs: [passedRun],
        stage: "smoke",
        reviewLevel: "codex"
      }),
      productGate: summarizeGenerativeDevelopmentGate({
        runs: [passedRun],
        stage: "smoke",
        reviewLevel: "product_owner"
      })
    })).toEqual({ status: "blocked_pending_human_review", exitCode: 2 });
  });

  it("技术失败在人工裁决前直接进入客观失败状态", () => {
    const runs = (["ask", "user_articulated", "ai_synthesized"] as const)
      .flatMap((outcomeClass) => Array.from({ length: 4 }, (_, index) =>
        developmentRun({
          caseId: `${outcomeClass}-${index + 1}`,
          outcomeClass,
          technicalComplete: !(outcomeClass === "ask" && index === 0)
        })
      ))
      .map((run) => ({
        ...run,
        productReview: { ...EMPTY_GENERATIVE_PRODUCT_REVIEW }
      }));
    const pending = summarizeGenerativeDevelopmentGate({
      runs,
      stage: "smoke",
      reviewLevel: "codex"
    });

    expect(summarizeGenerativeDevelopmentCommandOutcome({
      codexGate: pending,
      productGate: pending
    })).toEqual({ status: "failed_objective_gate", exitCode: 1 });
  });

  it("人工标记的事实、边界、强推断或来源错误会进入严重错误门", () => {
    const base = developmentRun({
      caseId: "natural-source-error",
      outcomeClass: "user_articulated",
      finalVerdict: "pass"
    });
    const [reviewed] = applyGenerativeProductReviews([base], [{
      runId: base.runId,
      runFingerprint: base.runFingerprint,
      review: base.productReview,
      severeErrors: ["source_misattribution"]
    }]);

    expect(reviewed.seriousBoundaryErrors).toContain("manual_source_misattribution");
    expect(summarizeGenerativeDevelopmentGate({
      runs: [reviewed, ...Array.from({ length: 15 }, (_, index) => developmentRun({
        caseId: `natural-ok-${index + 1}`,
        outcomeClass: "ask",
        finalVerdict: "pass"
      }))],
      stage: "stability",
      reviewLevel: "product_owner"
    }).sourceMisattribution).toBe(1);
  });
});

describe("event-centered generative case confirmation", () => {
  it("生成稳定指纹、严格 4/4/4 判尺和纯自然对话第一层", () => {
    const confirmation = createGenerativeCaseConfirmationPackage({ stage: "smoke" });
    const repeated = createGenerativeCaseConfirmationPackage({ stage: "smoke" });
    const markdown = formatGenerativeCaseConfirmationPackage(confirmation);
    const firstCase = confirmation.cases[0];
    const firstLayer = markdown
      .split(`<details><summary>第二层｜角色卡与产品判尺</summary>`)[0];

    expect(confirmation.cases).toHaveLength(12);
    expect(confirmation.caseIds).toEqual([
      "SMK-F-PARTIAL-ASK",
      "SMK-T-ASK",
      "SMK-R-CLEAN-ASK",
      "SMK-A-PARTIAL-ASK",
      "SMK-F-CLOSED",
      "SMK-T-USER",
      "SMK-R-PARTIAL-ASK",
      "SMK-A-CLOSED",
      "SMK-F-AI",
      "SMK-T-AI",
      "SMK-R-AI",
      "SMK-A-AI"
    ]);
    expect(confirmation.caseIds).toEqual(GENERATIVE_MVP_STRICT_SMOKE_CASE_IDS);
    expect(confirmation.confirmationVersion).toBe("2026-07-30.v5");
    expect(confirmation.datasetVersion).toBe("2026-07-30.v3");
    expect(confirmation.caseFingerprint).toBe(repeated.caseFingerprint);
    expect(confirmation.approval).toMatchObject({
      decision: "pending",
      approvedBy: null,
      approvedAt: null,
      confirmationVersion: "2026-07-30.v5",
      datasetVersion: "2026-07-30.v3",
      caseFingerprint: confirmation.caseFingerprint
    });
    expect(confirmation.cases.filter((item) =>
      item.secondLayer.strictExpected?.action === "ask"
    )).toHaveLength(4);
    expect(confirmation.cases.filter((item) =>
      item.secondLayer.strictExpected?.outcomeOrigin === "user_articulated"
    )).toHaveLength(4);
    expect(confirmation.cases.filter((item) =>
      item.secondLayer.strictExpected?.outcomeOrigin === "ai_synthesized"
    )).toHaveLength(4);
    expect(new Set(confirmation.cases.map((item) => item.secondLayer.angle)).size).toBe(4);
    expect(confirmation.cases.filter((item) =>
      item.secondLayer.mode === "guided_reflection"
    )).toHaveLength(6);
    expect(confirmation.cases.filter((item) =>
      item.secondLayer.mode === "deep_conversation"
    )).toHaveLength(6);
    for (const [index, item] of confirmation.cases.entries()) {
      expect(item.firstLayer.conversation.at(-1)).toEqual({
        speaker: "user",
        presentation: "message",
        text: GENERATIVE_MVP_STRICT_SMOKE_CASES[index].currentUserText
      });
    }
    expect(firstLayer).toContain(firstCase.firstLayer.conversation[0].text);
    expect(firstLayer).not.toContain(firstCase.secondLayer.roleCard);
  });

  it("安全换入口只进入确认包第二层，不进入模型案例输入", () => {
    const confirmation = createGenerativeCaseConfirmationPackage({ stage: "smoke" });
    const feelingAsk = confirmation.cases.find(
      (item) => item.caseId === "SMK-F-PARTIAL-ASK"
    );
    const markdown = formatGenerativeCaseConfirmationPackage(confirmation);
    const firstLayer = markdown.split(
      "<details><summary>第二层｜角色卡与产品判尺</summary>"
    )[0];

    expect(feelingAsk?.secondLayer.safeAlternateEntry).toBeTruthy();
    expect(firstLayer).not.toContain(feelingAsk?.secondLayer.safeAlternateEntry ?? "");
    expect(JSON.stringify(GENERATIVE_MVP_STRICT_SMOKE_CASES.map((item) => ({
      id: item.id,
      currentQuestion: item.currentQuestion,
      currentQuestionIntent: item.currentQuestionIntent,
      currentUserText: item.currentUserText
    })))).not.toContain(feelingAsk?.secondLayer.safeAlternateEntry ?? "");
  });

  it("三个说不清案例传入当前问题层级且不泄漏安全换入口", () => {
    for (const id of [
      "SMK-F-PARTIAL-ASK",
      "SMK-R-CLEAN-ASK",
      "SMK-A-PARTIAL-ASK"
    ]) {
      const probe = GENERATIVE_MVP_STRICT_SMOKE_CASES.find((item) => item.id === id);
      expect(probe?.safeAlternateEntry).toBeTruthy();
      const evaluationCase = createGenerativeDevelopmentEvaluationCase(probe!);
      expect(evaluationCase.currentQuestionSurfaceLevel).toBe("open_anchor");
      expect(JSON.stringify(evaluationCase)).not.toContain(
        probe?.safeAlternateEntry ?? ""
      );
    }
  });

  it("缺少自然第一人称历史对话时阻断确认包", () => {
    const cases = GENERATIVE_MVP_STRICT_SMOKE_CASES.map((item) => ({
      ...item,
      conversationContext: item.conversationContext.map((turn) => ({ ...turn }))
    }));
    cases[0] = { ...cases[0], conversationContext: [] };

    expect(() => createGenerativeCaseConfirmationPackage({
      stage: "smoke",
      cases
    })).toThrow(`GENERATIVE_CASE_NATURAL_CONVERSATION_REQUIRED:${cases[0].id}`);
  });

  it("模型运行批准必须匹配数据集、阶段、案例和内容指纹", () => {
    const confirmation = createGenerativeCaseConfirmationPackage({ stage: "stability" });
    const approval = {
      ...confirmation.approval,
      decision: "approved" as const,
      approvedBy: "product_owner" as const,
      approvedAt: "2026-07-30T12:00:00.000Z"
    };

    expect(validateGenerativeDevelopmentModelRunApproval(
      { ...confirmation, approval },
      confirmation
    )).toEqual(approval);
    expect(() => validateGenerativeDevelopmentModelRunApproval({
      ...approval,
      caseFingerprint: "0".repeat(64)
    }, confirmation)).toThrow(
      "GENERATIVE_DEVELOPMENT_PRODUCT_APPROVAL_FINGERPRINT_MISMATCH"
    );
    expect(() => validateGenerativeDevelopmentModelRunApproval({
      ...approval,
      datasetVersion: "2026-07-30.v2"
    }, confirmation)).toThrow(
      "GENERATIVE_DEVELOPMENT_PRODUCT_APPROVAL_DATASET_MISMATCH"
    );
    expect(() => validateGenerativeDevelopmentModelRunApproval({
      ...approval,
      confirmationVersion: "2026-07-30.v4"
    }, confirmation)).toThrow(
      "GENERATIVE_DEVELOPMENT_PRODUCT_APPROVAL_CONFIRMATION_MISMATCH"
    );
  });

  it("人工评审第一层只展示自然对话和真实可见结果", () => {
    const probe = GENERATIVE_MVP_STRICT_SMOKE_CASES[0];
    const run = {
      ...developmentRun({ caseId: probe.id, outcomeClass: "ask" }),
      runIndex: 1,
      visibleReplay: {
        thinkingSummary: "录用和入职日期带来了不同反应。",
        userResponse: "读到入职日期时，那一下更接近哪种感受？",
        responseKind: "question",
        transitionHint: null,
        angleChoices: [],
        availableActions: [],
        availableActionLabels: []
      },
      runtimeError: null,
      validationIssues: [],
      qualityDiagnostics: []
    } as GenerativeSingleTurnRun;
    const markdown = formatGenerativeHumanReviewPackage({
      split: "work",
      singleRuns: [run],
      trajectories: [],
      layers: ["single_turn"],
      includeOnlyRunCases: true
    });
    const [firstLayer, secondLayer] = markdown.split(
      "<details><summary>第二层｜展开系统依据与质量校准</summary>"
    );

    expect(firstLayer).toContain(probe.conversationContext[0].user);
    expect(firstLayer).toContain("录用和入职日期带来了不同反应。");
    expect(firstLayer).not.toContain(probe.userContext);
    expect(firstLayer).not.toContain("严格预期分流");
    expect(secondLayer).toContain(probe.userContext);
    expect(secondLayer).toContain("严格预期分流");
  });

  it("两阶段报告分别展示语义计划、可见表达、资源和失败阶段", () => {
    const run = developmentRun({
      caseId: "SMK-R-PARTIAL-ASK",
      outcomeClass: "ask",
      architecture: "two_call"
    });
    run.architectureStages = {
      semanticPlan: {
        action: "ask",
        outcomeState: "needs_more",
        outcomeOrigin: null,
        meaningCard: {
          main: {
            statement: "边界调整影响了用户对空间的感受",
            evidenceRefs: ["fact:1"]
          },
          necessaryScope: []
        },
        metrics: {
          ...run.metrics,
          latencyMs: 420,
          tokenUsage: { ...run.metrics.tokenUsage, totalTokens: 210 }
        }
      },
      visibleTurn: {
        thinkingSummary: "你把边界放清楚后，房间才重新像自己的空间。",
        responseKind: "question",
        response: "当边界说清楚后，哪一点最让你重新放松下来？",
        metrics: {
          ...run.metrics,
          latencyMs: 280,
          tokenUsage: { ...run.metrics.tokenUsage, totalTokens: 130 }
        }
      },
      failedStage: null,
      failureCode: null
    };
    run.runFingerprint = createGenerativeDevelopmentRunFingerprint(run);

    const report = formatGenerativeEvaluationReport({ singleRuns: [run] });
    expect(report).toContain("## 两阶段诊断");
    expect(report).toContain("阶段 1｜语义状态：needs_more");
    expect(report).toContain("边界调整影响了用户对空间的感受");
    expect(report).toContain("420ms / 210");
    expect(report).toContain("阶段 2｜可见回应");
    expect(report).toContain("280ms / 130");
    expect(report).toContain("失败阶段：无");

    const review = formatGenerativeHumanReviewPackage({
      split: "work",
      singleRuns: [run],
      layers: ["single_turn"],
      includeOnlyRunCases: true
    });
    expect(review).toContain("阶段 1 语义");
    expect(review).toContain("阶段 2 表达");
  });
});

describe("event-centered generative v64 execution identity", () => {
  it("当前阶段只放行静态规则、确认包和受控 development 入口", () => {
    for (const mode of [
      "rules",
      "case-confirmation",
      "development",
      "minimal-two-stage-v3-confirmation",
      "minimal-two-stage-v3-candidate"
    ]) {
      expect(() => assertGenerativeEvaluationCliModeAvailable(mode)).not.toThrow();
    }
    for (const mode of [
      "boundary",
      "model",
      "trajectory",
      "sentinel",
      "baseline",
      "architecture-ab"
    ]) {
      expect(() => assertGenerativeEvaluationCliModeAvailable(mode)).toThrow(
        "GENERATIVE_FORMAL_EVALUATION_PAUSED"
      );
    }
  });

  it("GI-009 架构实验需要独立产品批准和六项控制", () => {
    const confirmation = createGenerativeCaseConfirmationPackage({ stage: "smoke" });
    const approval = {
      approvalType: "board7_gi009_two_call_minimal_experiment",
      approvalVersion: GENERATIVE_GI009_ARCHITECTURE_EXPERIMENT_APPROVAL_VERSION,
      decision: "approved",
      approvedBy: "product_owner",
      approvedAt: "2026-07-30T20:00:00.000Z",
      architecture: "two_call",
      confirmationVersion: confirmation.confirmationVersion,
      datasetVersion: confirmation.datasetVersion,
      caseFingerprint: confirmation.caseFingerprint,
      targetedCaseIds: [...GENERATIVE_GI009_TWO_CALL_TARGETED_CASE_IDS],
      controls: {
        strict_lock: true,
        semantic_core: true,
        state_mapping: true,
        expression_only_retry: true,
        targeted_2_of_2: true,
        conditional_single_full_correction: true
      }
    } as const;

    expect(validateGenerativeGi009ArchitectureExperimentApproval(
      { approval },
      confirmation
    )).toEqual(approval);
    const recordedApproval = JSON.parse(readFileSync(
      "artifacts/generative-interview-board7/2026-07-30/board7-gi009-two-call-minimal-approval.json",
      "utf8"
    ));
    expect(validateGenerativeGi009ArchitectureExperimentApproval(
      recordedApproval,
      confirmation
    )).toEqual(recordedApproval);
    expect(() => validateGenerativeGi009ArchitectureExperimentApproval({
      approval: {
        ...approval,
        controls: { ...approval.controls, semantic_core: false }
      }
    }, confirmation)).toThrow(
      "GENERATIVE_GI009_ARCHITECTURE_APPROVAL_CONTROLS_MISMATCH"
    );
    expect(() => validateGenerativeGi009ArchitectureExperimentApproval({
      approval: {
        ...approval,
        targetedCaseIds: ["SMK-F-AI", "SMK-R-PARTIAL-ASK"]
      }
    }, confirmation)).toThrow(
      "GENERATIVE_GI009_ARCHITECTURE_APPROVAL_CASES_MISMATCH"
    );
  });

  it("运行 envelope 绑定确认包、版本、顺序和逐条最终输出", () => {
    const confirmation = createGenerativeCaseConfirmationPackage({ stage: "smoke" });
    const runs = GENERATIVE_MVP_STRICT_SMOKE_CASES.map((probe) =>
      developmentRun({
        caseId: probe.id,
        outcomeClass: probe.expectedAction === "ask"
          ? "ask"
          : probe.expectedOutcomeOrigin!
      })
    );
    const envelope = createGenerativeDevelopmentRunEnvelope({
      confirmation,
      stage: "smoke",
      selection: validateGenerativeDevelopmentRunSelection({ stage: "smoke" }),
      runs
    });

    expect(parseGenerativeDevelopmentRunEnvelope({
      value: envelope,
      confirmation,
      stage: "smoke"
    }).envelope.singleRuns).toHaveLength(12);

    const tamperedOutput = structuredClone(envelope);
    tamperedOutput.singleRuns[0]!.visibleResponse = "被篡改的用户可见结果";
    expect(() => parseGenerativeDevelopmentRunEnvelope({
      value: tamperedOutput,
      confirmation,
      stage: "smoke"
    })).toThrow("GENERATIVE_DEVELOPMENT_EXISTING_RUN_FINGERPRINT_MISMATCH");

    const staleVersion = structuredClone(envelope);
    staleVersion.candidateVersions.prompt = "2026-07-30.event-centered-generative-v63";
    expect(() => parseGenerativeDevelopmentRunEnvelope({
      value: staleVersion,
      confirmation,
      stage: "smoke"
    })).toThrow("GENERATIVE_DEVELOPMENT_EXISTING_RUNS_IDENTITY_MISMATCH");

    const reordered = structuredClone(envelope);
    [reordered.singleRuns[0], reordered.singleRuns[1]] = [
      reordered.singleRuns[1]!,
      reordered.singleRuns[0]!
    ];
    expect(() => parseGenerativeDevelopmentRunEnvelope({
      value: reordered,
      confirmation,
      stage: "smoke"
    })).toThrow("GENERATIVE_DEVELOPMENT_EXISTING_RUNS_ORDER_MISMATCH");

    const missingRun = structuredClone(envelope);
    missingRun.singleRuns.pop();
    expect(() => parseGenerativeDevelopmentRunEnvelope({
      value: missingRun,
      confirmation,
      stage: "smoke"
    })).toThrow("GENERATIVE_DEVELOPMENT_EXISTING_RUNS_ORDER_MISMATCH");

    expect(() => parseGenerativeDevelopmentRunEnvelope({
      value: { singleRuns: envelope.singleRuns },
      confirmation,
      stage: "smoke"
    })).toThrow("GENERATIVE_DEVELOPMENT_EXISTING_RUNS_IDENTITY_MISMATCH");
  });

  it("两阶段 envelope 绑定架构和预算预留编号", () => {
    const confirmation = createGenerativeCaseConfirmationPackage({ stage: "smoke" });
    const selection = validateGenerativeDevelopmentRunSelection({
      stage: "smoke",
      caseIds: [...GENERATIVE_GI009_TWO_CALL_TARGETED_CASE_IDS],
      architecture: "two_call"
    });
    const runs = selection.caseIds.map((caseId) => developmentRun({
      caseId,
      outcomeClass: caseId === "SMK-F-AI" ? "ai_synthesized" : "ask",
      architecture: "two_call"
    }));
    const envelope = createGenerativeDevelopmentRunEnvelope({
      confirmation,
      stage: "smoke",
      selection,
      runs,
      architecture: "two_call",
      budgetReservationId: "gi009-envelope-budget"
    });

    expect(parseGenerativeDevelopmentRunEnvelope({
      value: envelope,
      confirmation,
      stage: "smoke",
      architecture: "two_call"
    }).envelope.budgetReservationId).toBe("gi009-envelope-budget");
    expect(() => parseGenerativeDevelopmentRunEnvelope({
      value: { ...envelope, budgetReservationId: null },
      confirmation,
      stage: "smoke",
      architecture: "two_call"
    })).toThrow("GENERATIVE_GI009_TWO_CALL_BUDGET_RESERVATION_REQUIRED");
    expect(() => parseGenerativeDevelopmentRunEnvelope({
      value: envelope,
      confirmation,
      stage: "smoke",
      architecture: "one_call"
    })).toThrow("GENERATIVE_DEVELOPMENT_EXISTING_RUNS_IDENTITY_MISMATCH");
  });

  it("旧裁决指纹不能套用到新输出", () => {
    const run = developmentRun({
      caseId: "SMK-F-PARTIAL-ASK",
      outcomeClass: "ask"
    });
    expect(() => applyGenerativeProductReviews([run], [{
      runId: run.runId,
      runFingerprint: "0".repeat(64),
      review: run.productReview
    }])).toThrow(
      `GENERATIVE_DEVELOPMENT_REVIEW_FINGERPRINT_MISMATCH:${run.runId}`
    );
    expect(() => applyGenerativeProductReviews([run], [{
      runId: run.runId,
      review: run.productReview
    } as unknown as Parameters<typeof applyGenerativeProductReviews>[1][number]]))
      .toThrow(
        `GENERATIVE_DEVELOPMENT_REVIEW_FINGERPRINT_MISMATCH:${run.runId}`
      );
    expect(applyGenerativeProductReviews([run], [{
      runId: run.runId,
      runFingerprint: run.runFingerprint,
      review: run.productReview
    }])).toHaveLength(1);
  });

  it("静态资产和 Provider 校验位于预算预留之前", () => {
    const source = readFileSync(
      "scripts/run-event-centered-generative-eval.ts",
      "utf8"
    );
    const developmentBlock = source.slice(
      source.indexOf('if (mode === "development")'),
      source.lastIndexOf('if (mode === "architecture-ab")')
    );
    const preflightIndex = developmentBlock.indexOf("if (!preflight.passed)");
    const providerConfigIndex = developmentBlock.indexOf(
      "const frozenProviderConfig = readFrozenEvaluationProviderConfig()"
    );
    const networkPreflightIndex = developmentBlock.indexOf(
      "await runGenerativeDeepSeekProviderPreflight"
    );
    const providerIndex = developmentBlock.indexOf(
      "const frozenProvider = createFrozenEvaluationProvider(frozenProviderConfig)"
    );
    const reserveIndex = developmentBlock.indexOf(
      "budgetEntry = await reserveGenerativeV64Run"
    );
    const caseApprovalIndex = developmentBlock.indexOf(
      "validateGenerativeDevelopmentModelRunApproval"
    );
    const architectureApprovalIndex = developmentBlock.indexOf(
      "validateGenerativeGi009ArchitectureExperimentApproval"
    );

    expect(preflightIndex).toBeGreaterThanOrEqual(0);
    expect(caseApprovalIndex).toBeGreaterThanOrEqual(0);
    expect(architectureApprovalIndex).toBeGreaterThan(caseApprovalIndex);
    expect(preflightIndex).toBeGreaterThan(architectureApprovalIndex);
    expect(providerConfigIndex).toBeGreaterThan(preflightIndex);
    expect(networkPreflightIndex).toBeGreaterThan(providerConfigIndex);
    expect(providerIndex).toBeGreaterThan(networkPreflightIndex);
    expect(reserveIndex).toBeGreaterThan(providerIndex);
  });
});

describe("event-centered generative v64 run budget", () => {
  it("把旧版顶层候选血缘迁移到各运行记录", () => {
    const confirmation = createGenerativeCaseConfirmationPackage({ stage: "smoke" });
    const selection = validateGenerativeDevelopmentRunSelection({
      stage: "smoke",
      caseIds: ["SMK-R-PARTIAL-ASK", "SMK-F-AI"]
    });
    const current = reserveGenerativeDevelopmentRunBudget({
      ledger: null,
      confirmation,
      selection,
      reservationId: "legacy-v64-targeted",
      reservedAt: "2026-07-30T16:00:00.000Z"
    }).ledger;
    const legacy = structuredClone(current) as unknown as Record<string, unknown> & {
      entries: Array<Record<string, unknown>>;
    };
    for (const entry of legacy.entries) {
      delete entry.candidateVersions;
      delete entry.architecture;
    }
    legacy.promptVersion = "2026-07-30.event-centered-generative-v64";
    legacy.strategyVersion = "5.46.0";
    legacy.angleCardVersion = "2.12.0";
    legacy.fewShotVersion = "quality-patterns.2026-07-30.v25";

    const migrated = parseGenerativeDevelopmentRunBudgetLedger({
      value: legacy,
      confirmation
    });

    expect(migrated.entries[0]?.candidateVersions).toEqual({
      prompt: "2026-07-30.event-centered-generative-v64",
      strategy: "5.46.0",
      angleCard: "2.12.0",
      fewShot: "quality-patterns.2026-07-30.v25"
    });
    expect(migrated.entries[0]?.architecture).toBe("one_call");
    const v65 = reserveGenerativeDevelopmentRunBudget({
      ledger: migrated,
      confirmation,
      selection,
      reservationId: "v65-targeted",
      reservedAt: "2026-07-30T16:01:00.000Z"
    });
    expect(v65.entry.candidateVersions.prompt).toBe(
      "2026-07-30.event-centered-generative-v65"
    );
    expect(() => reserveGenerativeDevelopmentRunBudget({
      ledger: v65.ledger,
      confirmation,
      selection: {
        kind: "targeted",
        caseIds: ["SMK-T-ASK"]
      },
      reservationId: "targeted-version-reset-attempt",
      reservedAt: "2026-07-30T16:02:00.000Z"
    })).toThrow("GENERATIVE_V64_TARGETED_CASE_BUDGET_EXHAUSTED");
  });

  it("R1、R2 与 v65 定向记录在同一 campaign 跨 Prompt 共享预算", () => {
    const confirmation = createGenerativeCaseConfirmationPackage({ stage: "smoke" });
    const fullSelection = validateGenerativeDevelopmentRunSelection({ stage: "smoke" });
    const initial = reserveGenerativeDevelopmentRunBudget({
      ledger: null,
      confirmation,
      selection: fullSelection,
      reservationId: "r1-void",
      reservedAt: "2026-07-30T17:00:00.000Z"
    });
    const v64CandidateVersions = {
      prompt: "2026-07-30.event-centered-generative-v64",
      strategy: "5.46.0",
      angleCard: "2.12.0",
      fewShot: "quality-patterns.2026-07-30.v25"
    };
    const campaign = initial.ledger;
    campaign.entries = [{
      ...initial.entry,
      candidateVersions: v64CandidateVersions,
      completedAt: "2026-07-30T17:01:00.000Z",
      status: "void_technical_preflight_gap",
      technicalAttempts: 24,
      technicalRetries: 12,
      technicallyCompleteCases: 0,
      voidAudit: {
        auditVersion: "board7-v64-technical-preflight-gap.1",
        auditedBy: "delegated_codex",
        auditedAt: "2026-07-30T17:02:00.000Z",
        reason: "dns_preflight_gap_before_budget_reservation",
        sourceEnvelopeFingerprint: "0".repeat(64)
      }
    }, {
      ...initial.entry,
      reservationId: "r2-completed",
      candidateVersions: v64CandidateVersions,
      reservedAt: "2026-07-30T17:03:00.000Z",
      completedAt: "2026-07-30T17:04:00.000Z",
      status: "completed",
      technicalAttempts: 17,
      technicalRetries: 5,
      technicallyCompleteCases: 10,
      voidAudit: null
    }];

    const targetedSelection = validateGenerativeDevelopmentRunSelection({
      stage: "smoke",
      caseIds: ["SMK-R-PARTIAL-ASK", "SMK-F-AI"]
    });
    const targetedReserved = reserveGenerativeDevelopmentRunBudget({
      ledger: campaign,
      confirmation,
      selection: targetedSelection,
      reservationId: "v65-targeted-completed",
      reservedAt: "2026-07-30T17:05:00.000Z"
    });
    const targetedCompleted = completeGenerativeDevelopmentRunBudget({
      ledger: targetedReserved.ledger,
      confirmation,
      reservationId: targetedReserved.entry.reservationId,
      completedAt: "2026-07-30T17:06:00.000Z",
      runs: targetedSelection.caseIds.map((caseId) =>
        developmentRun({ caseId, outcomeClass: "ask" })
      )
    });
    expect(targetedCompleted.entries.map((entry) => entry.status)).toEqual([
      "void_technical_preflight_gap",
      "completed",
      "completed"
    ]);
    expect(targetedCompleted.entries.map((entry) => entry.candidateVersions.prompt)).toEqual([
      "2026-07-30.event-centered-generative-v64",
      "2026-07-30.event-centered-generative-v64",
      "2026-07-30.event-centered-generative-v65"
    ]);

    const v65R1 = reserveGenerativeDevelopmentRunBudget({
      ledger: targetedCompleted,
      confirmation,
      selection: fullSelection,
      reservationId: "v65-full-1",
      reservedAt: "2026-07-30T19:00:00.000Z"
    });
    expect(v65R1.entry.candidateVersions).toEqual({
      prompt: "2026-07-30.event-centered-generative-v65",
      strategy: "5.48.0",
      angleCard: "2.12.0",
      fewShot: "quality-patterns.2026-08-01.v27"
    });
    expect(v65R1.entry.candidateVersions).toEqual(
      GENERATIVE_V65_RUN_BUDGET_CANDIDATE_VERSIONS
    );
    expect(v65R1.entry.candidateVersions).not.toEqual(
      currentGenerativeDevelopmentCandidateVersions("one_call")
    );
    const v65R2 = reserveGenerativeDevelopmentRunBudget({
      ledger: v65R1.ledger,
      confirmation,
      selection: fullSelection,
      reservationId: "v65-full-2",
      reservedAt: "2026-07-30T19:01:00.000Z"
    });
    expect(() => reserveGenerativeDevelopmentRunBudget({
      ledger: v65R2.ledger,
      confirmation,
      selection: fullSelection,
      reservationId: "candidate-version-reset-attempt",
      reservedAt: "2026-07-30T19:02:00.000Z"
    })).toThrow("GENERATIVE_V64_FULL_RUN_BUDGET_EXHAUSTED");
  });

  it("预算前 DeepSeek 预检验证鉴权和冻结模型", async () => {
    let authorization = "";
    const result = await runGenerativeDeepSeekProviderPreflight({
      baseUrl: "https://api.deepseek.example",
      apiKey: "test-secret",
      model: "deepseek-v4-flash",
      fetchImpl: (async (_url, init) => {
        authorization = new Headers(init?.headers).get("authorization") ?? "";
        return new Response(JSON.stringify({
          data: [{ id: "deepseek-v4-flash" }]
        }), { status: 200, headers: { "content-type": "application/json" } });
      }) as typeof fetch
    });

    expect(result).toEqual({
      provider: "deepseek",
      baseUrlHost: "api.deepseek.example",
      model: "deepseek-v4-flash",
      passed: true
    });
    expect(authorization).toBe("Bearer test-secret");
    expect(JSON.stringify(result)).not.toContain("test-secret");
  });

  it("DeepSeek 预检使用安全错误分类且不保留原始响应", async () => {
    const expectCode = async (
      fetchImpl: typeof fetch,
      code: GenerativeDeepSeekPreflightError["code"]
    ) => {
      await expect(runGenerativeDeepSeekProviderPreflight({
        baseUrl: "https://api.deepseek.example",
        apiKey: "test-secret",
        model: "deepseek-v4-flash",
        fetchImpl
      })).rejects.toMatchObject({
        name: "GenerativeDeepSeekPreflightError",
        code,
        message: `GENERATIVE_DEEPSEEK_PREFLIGHT_${code}`
      });
    };
    await expectCode((async () => {
      throw Object.assign(new TypeError("fetch failed"), {
        cause: Object.assign(new Error("private dns detail"), { code: "ENOTFOUND" })
      });
    }) as typeof fetch, "DNS_ENOTFOUND");
    await expectCode((async () => {
      throw Object.assign(new TypeError("fetch failed"), {
        cause: Object.assign(new Error("private tls detail"), { code: "CERT_HAS_EXPIRED" })
      });
    }) as typeof fetch, "TLS");
    await expectCode((async () => {
      throw Object.assign(new TypeError("fetch failed"), {
        cause: Object.assign(new Error("private connect detail"), {
          code: "UND_ERR_CONNECT_TIMEOUT"
        })
      });
    }) as typeof fetch, "CONNECT_TIMEOUT");
    await expectCode((async () => new Response("sensitive upstream body", {
      status: 401
    })) as typeof fetch, "AUTH");
    await expectCode((async () => new Response(JSON.stringify({
      data: [{ id: "another-model" }]
    }), { status: 200 })) as typeof fetch, "MODEL_MISSING");
  });

  it("DeepSeek 评测 Trace 使用真实服务标签且不改变底层 Provider", async () => {
    let delegated = 0;
    const provider = withGenerativeEvaluationProviderTraceName({
      name: "volcengine-ark",
      async complete() {
        delegated += 1;
        return {
          content: "{}",
          latencyMs: 3,
          provider: "volcengine-ark"
        };
      }
    }, "deepseek");

    expect(provider.name).toBe("deepseek");
    await expect(provider.complete({ messages: [] })).resolves.toMatchObject({
      provider: "deepseek",
      content: "{}"
    });
    expect(delegated).toBe(1);
  });

  it("定向运行只接受 Strict12 且单次最多两条", () => {
    expect(validateGenerativeDevelopmentRunSelection({
      stage: "smoke",
      caseIds: ["SMK-F-PARTIAL-ASK", "SMK-R-CLEAN-ASK"]
    })).toEqual({
      kind: "targeted",
      caseIds: ["SMK-F-PARTIAL-ASK", "SMK-R-CLEAN-ASK"]
    });
    expect(() => validateGenerativeDevelopmentRunSelection({
      stage: "smoke",
      caseIds: ["SMK-F-PARTIAL-ASK", "SMK-R-CLEAN-ASK", "SMK-A-PARTIAL-ASK"]
    })).toThrow("GENERATIVE_DEVELOPMENT_TARGETED_CASE_LIMIT_EXCEEDED");
    expect(() => validateGenerativeDevelopmentRunSelection({
      stage: "smoke",
      caseIds: ["AB-FG-01"]
    })).toThrow("GENERATIVE_DEVELOPMENT_TARGETED_CASE_NOT_IN_V64_STRICT12:AB-FG-01");
    expect(validateGenerativeDevelopmentRunSelection({
      stage: "smoke",
      caseIds: ["SMK-R-CLEAN-ASK", "SMK-F-PARTIAL-ASK"]
    }).caseIds).toEqual(["SMK-F-PARTIAL-ASK", "SMK-R-CLEAN-ASK"]);
    expect(validateGenerativeDevelopmentRunSelection({
      stage: "smoke",
      caseIds: ["SMK-F-AI", "SMK-R-PARTIAL-ASK"],
      architecture: "two_call"
    })).toEqual({
      kind: "targeted",
      caseIds: [...GENERATIVE_GI009_TWO_CALL_TARGETED_CASE_IDS]
    });
    expect(() => validateGenerativeDevelopmentRunSelection({
      stage: "smoke",
      caseIds: ["SMK-F-PARTIAL-ASK", "SMK-R-CLEAN-ASK"],
      architecture: "two_call"
    })).toThrow("GENERATIVE_GI009_TWO_CALL_TARGETED_CASES_REQUIRED");
  });

  it("固定账本限制三次完整运行与累计四个定向案例", () => {
    const confirmation = createGenerativeCaseConfirmationPackage({ stage: "smoke" });
    const full = validateGenerativeDevelopmentRunSelection({ stage: "smoke" });
    let fullLedger = null;
    for (let index = 1; index <= 3; index += 1) {
      fullLedger = reserveGenerativeDevelopmentRunBudget({
        ledger: fullLedger,
        confirmation,
        selection: full,
        reservationId: `full-${index}`,
        reservedAt: `2026-07-30T00:0${index}:00.000Z`
      }).ledger;
    }
    expect(() => reserveGenerativeDevelopmentRunBudget({
      ledger: fullLedger,
      confirmation,
      selection: full,
      reservationId: "full-4",
      reservedAt: "2026-07-30T00:04:00.000Z"
    })).toThrow("GENERATIVE_V64_FULL_RUN_BUDGET_EXHAUSTED");

    const targeted = validateGenerativeDevelopmentRunSelection({
      stage: "smoke",
      caseIds: ["SMK-F-PARTIAL-ASK", "SMK-R-CLEAN-ASK"]
    });
    const first = reserveGenerativeDevelopmentRunBudget({
      ledger: null,
      confirmation,
      selection: targeted,
      reservationId: "target-1",
      reservedAt: "2026-07-30T01:00:00.000Z"
    }).ledger;
    const second = reserveGenerativeDevelopmentRunBudget({
      ledger: first,
      confirmation,
      selection: targeted,
      reservationId: "target-2",
      reservedAt: "2026-07-30T01:01:00.000Z"
    }).ledger;
    expect(() => reserveGenerativeDevelopmentRunBudget({
      ledger: second,
      confirmation,
      selection: {
        kind: "targeted",
        caseIds: ["SMK-A-PARTIAL-ASK"]
      },
      reservationId: "target-3",
      reservedAt: "2026-07-30T01:02:00.000Z"
    })).toThrow("GENERATIVE_V64_TARGETED_CASE_BUDGET_EXHAUSTED");
  });

  it("GI-009 复用跨候选账本的剩余两条定向额度，并要求定向 2/2", () => {
    const confirmation = createGenerativeCaseConfirmationPackage({ stage: "smoke" });
    const campaign = gi009CampaignWithRemainingTwoCallBudget(confirmation);
    const targetedSelection = validateGenerativeDevelopmentRunSelection({
      stage: "smoke",
      caseIds: [...GENERATIVE_GI009_TWO_CALL_TARGETED_CASE_IDS],
      architecture: "two_call"
    });
    const targeted = reserveGenerativeDevelopmentRunBudget({
      ledger: campaign,
      confirmation,
      selection: targetedSelection,
      architecture: "two_call",
      reservationId: "gi009-targeted",
      reservedAt: "2026-07-30T11:00:00.000Z"
    });
    const targetedRuns = targetedSelection.caseIds.map((caseId) => developmentRun({
      caseId,
      outcomeClass: caseId === "SMK-F-AI" ? "ai_synthesized" : "ask",
      architecture: "two_call",
      verdict: "pass",
      finalVerdict: "pass"
    }));
    const completed = completeGenerativeDevelopmentRunBudget({
      ledger: targeted.ledger,
      confirmation,
      reservationId: targeted.entry.reservationId,
      completedAt: "2026-07-30T11:01:00.000Z",
      runs: targetedRuns
    });
    expect(() => reserveGenerativeDevelopmentRunBudget({
      ledger: completed,
      confirmation,
      selection: targetedSelection,
      architecture: "two_call",
      reservationId: "gi009-targeted-again",
      reservedAt: "2026-07-30T11:02:00.000Z"
    })).toThrow("GENERATIVE_V64_TARGETED_CASE_BUDGET_EXHAUSTED");
    expect(() => reserveGenerativeDevelopmentRunBudget({
      ledger: completed,
      confirmation,
      selection: validateGenerativeDevelopmentRunSelection({
        stage: "smoke",
        architecture: "two_call"
      }),
      architecture: "two_call",
      reservationId: "gi009-full-before-audit",
      reservedAt: "2026-07-30T11:03:00.000Z"
    })).toThrow("GENERATIVE_GI009_TWO_CALL_TARGETED_GATE_REQUIRED");

    const audited = auditGenerativeGi009TwoCallRunGate({
      ledger: completed,
      confirmation,
      reservationId: targeted.entry.reservationId,
      runs: targetedRuns,
      auditedAt: "2026-07-30T11:04:00.000Z"
    });
    expect(audited.gateAudit).toMatchObject({
      total: 2,
      passed: 2,
      decision: "targeted_pass",
      codexReviewed: 2,
      productReviewed: 2
    });
    expect(reserveGenerativeDevelopmentRunBudget({
      ledger: audited.ledger,
      confirmation,
      selection: validateGenerativeDevelopmentRunSelection({
        stage: "smoke",
        architecture: "two_call"
      }),
      architecture: "two_call",
      reservationId: "gi009-first-full",
      reservedAt: "2026-07-30T11:05:00.000Z"
    }).entry.kind).toBe("full");
  });

  it("GI-009 首次完整 12/12 立即通过并关闭追加运行", () => {
    const confirmation = createGenerativeCaseConfirmationPackage({ stage: "smoke" });
    const targetedSelection = validateGenerativeDevelopmentRunSelection({
      stage: "smoke",
      caseIds: [...GENERATIVE_GI009_TWO_CALL_TARGETED_CASE_IDS],
      architecture: "two_call"
    });
    const targeted = reserveGenerativeDevelopmentRunBudget({
      ledger: gi009CampaignWithRemainingTwoCallBudget(confirmation),
      confirmation,
      selection: targetedSelection,
      architecture: "two_call",
      reservationId: "gi009-pass-targeted",
      reservedAt: "2026-07-30T12:00:00.000Z"
    });
    const targetedRuns = targetedSelection.caseIds.map((caseId) => developmentRun({
      caseId,
      outcomeClass: "ask",
      architecture: "two_call",
      finalVerdict: "pass"
    }));
    const targetedCompleted = completeGenerativeDevelopmentRunBudget({
      ledger: targeted.ledger,
      confirmation,
      reservationId: targeted.entry.reservationId,
      completedAt: "2026-07-30T12:01:00.000Z",
      runs: targetedRuns
    });
    const targetedAudited = auditGenerativeGi009TwoCallRunGate({
      ledger: targetedCompleted,
      confirmation,
      reservationId: targeted.entry.reservationId,
      runs: targetedRuns,
      auditedAt: "2026-07-30T12:02:00.000Z"
    });
    const fullSelection = validateGenerativeDevelopmentRunSelection({
      stage: "smoke",
      architecture: "two_call"
    });
    const full = reserveGenerativeDevelopmentRunBudget({
      ledger: targetedAudited.ledger,
      confirmation,
      selection: fullSelection,
      architecture: "two_call",
      reservationId: "gi009-pass-full",
      reservedAt: "2026-07-30T12:03:00.000Z"
    });
    const fullRuns = GENERATIVE_MVP_STRICT_SMOKE_CASES.map((probe) => developmentRun({
      caseId: probe.id,
      outcomeClass: probe.expectedAction === "ask"
        ? "ask"
        : probe.expectedOutcomeOrigin!,
      architecture: "two_call",
      finalVerdict: "pass"
    }));
    const fullCompleted = completeGenerativeDevelopmentRunBudget({
      ledger: full.ledger,
      confirmation,
      reservationId: full.entry.reservationId,
      completedAt: "2026-07-30T12:04:00.000Z",
      runs: fullRuns
    });
    const fullAudited = auditGenerativeGi009TwoCallRunGate({
      ledger: fullCompleted,
      confirmation,
      reservationId: full.entry.reservationId,
      runs: fullRuns,
      auditedAt: "2026-07-30T12:05:00.000Z"
    });
    expect(fullAudited.gateAudit.decision).toBe("full_pass");
    expect(() => reserveGenerativeDevelopmentRunBudget({
      ledger: fullAudited.ledger,
      confirmation,
      selection: fullSelection,
      architecture: "two_call",
      reservationId: "gi009-unneeded-final",
      reservedAt: "2026-07-30T12:06:00.000Z"
    })).toThrow("GENERATIVE_GI009_TWO_CALL_FINAL_RUN_NOT_ALLOWED");
  });

  it("GI-009 首次完整仅 11/12 时只放行一次单变量修正，最终仍需 12/12", () => {
    const confirmation = createGenerativeCaseConfirmationPackage({ stage: "smoke" });
    const campaign = gi009CampaignWithRemainingTwoCallBudget(confirmation);
    const targetedSelection = validateGenerativeDevelopmentRunSelection({
      stage: "smoke",
      caseIds: [...GENERATIVE_GI009_TWO_CALL_TARGETED_CASE_IDS],
      architecture: "two_call"
    });
    const targeted = reserveGenerativeDevelopmentRunBudget({
      ledger: campaign,
      confirmation,
      selection: targetedSelection,
      architecture: "two_call",
      reservationId: "gi009-correction-targeted",
      reservedAt: "2026-07-30T13:00:00.000Z"
    });
    const targetedRuns = targetedSelection.caseIds.map((caseId) => developmentRun({
      caseId,
      outcomeClass: "ask",
      architecture: "two_call",
      finalVerdict: "pass"
    }));
    const targetedCompleted = completeGenerativeDevelopmentRunBudget({
      ledger: targeted.ledger,
      confirmation,
      reservationId: targeted.entry.reservationId,
      completedAt: "2026-07-30T13:01:00.000Z",
      runs: targetedRuns
    });
    const targetedAudited = auditGenerativeGi009TwoCallRunGate({
      ledger: targetedCompleted,
      confirmation,
      reservationId: targeted.entry.reservationId,
      runs: targetedRuns,
      auditedAt: "2026-07-30T13:02:00.000Z"
    });
    const fullSelection = validateGenerativeDevelopmentRunSelection({
      stage: "smoke",
      architecture: "two_call"
    });
    const firstFull = reserveGenerativeDevelopmentRunBudget({
      ledger: targetedAudited.ledger,
      confirmation,
      selection: fullSelection,
      architecture: "two_call",
      reservationId: "gi009-correction-first-full",
      reservedAt: "2026-07-30T13:03:00.000Z"
    });
    const firstFullRuns = GENERATIVE_MVP_STRICT_SMOKE_CASES.map((probe, index) =>
      developmentRun({
        caseId: probe.id,
        outcomeClass: probe.expectedAction === "ask"
          ? "ask"
          : probe.expectedOutcomeOrigin!,
        architecture: "two_call",
        verdict: index === 0 ? "borderline" : "pass",
        finalVerdict: index === 0 ? "borderline" : "pass",
        primaryReason: index === 0 ? "expression_naturalness" : null
      })
    );
    const firstCompleted = completeGenerativeDevelopmentRunBudget({
      ledger: firstFull.ledger,
      confirmation,
      reservationId: firstFull.entry.reservationId,
      completedAt: "2026-07-30T13:04:00.000Z",
      runs: firstFullRuns
    });
    const firstAudited = auditGenerativeGi009TwoCallRunGate({
      ledger: firstCompleted,
      confirmation,
      reservationId: firstFull.entry.reservationId,
      runs: firstFullRuns,
      auditedAt: "2026-07-30T13:05:00.000Z"
    });
    expect(firstAudited.gateAudit.decision).toBe("single_variable_correction_allowed");
    expect(() => reserveGenerativeDevelopmentRunBudget({
      ledger: firstAudited.ledger,
      confirmation,
      selection: fullSelection,
      architecture: "two_call",
      reservationId: "gi009-no-variable-change",
      reservedAt: "2026-07-30T13:06:00.000Z"
    })).toThrow("GENERATIVE_GI009_TWO_CALL_SINGLE_VARIABLE_CHANGE_REQUIRED");

    const correctedLedger = structuredClone(firstAudited.ledger);
    const firstEntry = correctedLedger.entries.find(
      (entry) => entry.reservationId === firstFull.entry.reservationId
    )!;
    firstEntry.candidateVersions.prompt = "2026-07-30.event-centered-generative-v64";
    const finalFull = reserveGenerativeDevelopmentRunBudget({
      ledger: correctedLedger,
      confirmation,
      selection: fullSelection,
      architecture: "two_call",
      reservationId: "gi009-final-full",
      reservedAt: "2026-07-30T13:07:00.000Z"
    });
    const finalRuns = firstFullRuns.map((run, index) => ({
      ...run,
      runFingerprint: createGenerativeDevelopmentRunFingerprint(run),
      productReview: {
        ...run.productReview,
        initialVerdict: index === 1 ? "borderline" as const : "pass" as const,
        finalVerdict: index === 1 ? "borderline" as const : "pass" as const,
        primaryReason: index === 1 ? "answer_burden" as const : null
      }
    }));
    const finalCompleted = completeGenerativeDevelopmentRunBudget({
      ledger: finalFull.ledger,
      confirmation,
      reservationId: finalFull.entry.reservationId,
      completedAt: "2026-07-30T13:08:00.000Z",
      runs: finalRuns
    });
    const finalAudited = auditGenerativeGi009TwoCallRunGate({
      ledger: finalCompleted,
      confirmation,
      reservationId: finalFull.entry.reservationId,
      runs: finalRuns,
      auditedAt: "2026-07-30T13:09:00.000Z"
    });
    expect(finalAudited.gateAudit.decision).toBe("stop");
  });

  it("GI-009 遇到严重错误、10/12 或跨案例重复失败时停止", () => {
    const confirmation = createGenerativeCaseConfirmationPackage({ stage: "smoke" });
    const makeAuditableFull = (
      reservationId: string,
      mutate: (runs: GenerativeSingleTurnRun[]) => GenerativeSingleTurnRun[]
    ) => {
      const targetedSelection = validateGenerativeDevelopmentRunSelection({
        stage: "smoke",
        caseIds: [...GENERATIVE_GI009_TWO_CALL_TARGETED_CASE_IDS],
        architecture: "two_call"
      });
      const targeted = reserveGenerativeDevelopmentRunBudget({
        ledger: gi009CampaignWithRemainingTwoCallBudget(confirmation),
        confirmation,
        selection: targetedSelection,
        architecture: "two_call",
        reservationId: `${reservationId}-targeted`,
        reservedAt: "2026-07-30T14:00:00.000Z"
      });
      const targetedRuns = targetedSelection.caseIds.map((caseId) => developmentRun({
        caseId,
        outcomeClass: "ask",
        architecture: "two_call",
        finalVerdict: "pass"
      }));
      const targetedCompleted = completeGenerativeDevelopmentRunBudget({
        ledger: targeted.ledger,
        confirmation,
        reservationId: targeted.entry.reservationId,
        completedAt: "2026-07-30T14:01:00.000Z",
        runs: targetedRuns
      });
      const targetedAudited = auditGenerativeGi009TwoCallRunGate({
        ledger: targetedCompleted,
        confirmation,
        reservationId: targeted.entry.reservationId,
        runs: targetedRuns,
        auditedAt: "2026-07-30T14:02:00.000Z"
      });
      const fullSelection = validateGenerativeDevelopmentRunSelection({
        stage: "smoke",
        architecture: "two_call"
      });
      const full = reserveGenerativeDevelopmentRunBudget({
        ledger: targetedAudited.ledger,
        confirmation,
        selection: fullSelection,
        architecture: "two_call",
        reservationId,
        reservedAt: "2026-07-30T14:03:00.000Z"
      });
      const cleanRuns = GENERATIVE_MVP_STRICT_SMOKE_CASES.map((probe) =>
        developmentRun({
          caseId: probe.id,
          outcomeClass: probe.expectedAction === "ask"
            ? "ask"
            : probe.expectedOutcomeOrigin!,
          architecture: "two_call",
          finalVerdict: "pass"
        })
      );
      const runs = mutate(cleanRuns);
      const completed = completeGenerativeDevelopmentRunBudget({
        ledger: full.ledger,
        confirmation,
        reservationId,
        completedAt: "2026-07-30T14:04:00.000Z",
        runs
      });
      return auditGenerativeGi009TwoCallRunGate({
        ledger: completed,
        confirmation,
        reservationId,
        runs,
        auditedAt: "2026-07-30T14:05:00.000Z"
      }).gateAudit;
    };

    expect(makeAuditableFull("gi009-severe", (runs) => runs.map((run, index) =>
      index === 0 ? { ...run, seriousBoundaryErrors: ["manual_strong_inference"] } : run
    )).decision).toBe("stop");
    expect(makeAuditableFull("gi009-ten", (runs) => runs.map((run, index) =>
      index < 2
        ? {
            ...run,
            productReview: {
              ...run.productReview,
              initialVerdict: "fail",
              finalVerdict: "fail",
              primaryReason: index === 0 ? "answer_burden" : "insight_value"
            }
          }
        : run
    )).decision).toBe("stop");
    const repeated = makeAuditableFull("gi009-repeated", (runs) => runs.map((run, index) =>
      index < 2
        ? {
            ...run,
            productReview: {
              ...run.productReview,
              initialVerdict: "fail",
              finalVerdict: "fail",
              primaryReason: "expression_naturalness"
            }
          }
        : run
    ));
    expect(repeated.decision).toBe("stop");
    expect(repeated.repeatedPrimaryFailures).toEqual([{
      reason: "expression_naturalness",
      caseIds: GENERATIVE_MVP_STRICT_SMOKE_CASE_IDS.slice(0, 2)
    }]);
  });

  it("产品运行轮次与技术重试分开记账", () => {
    const confirmation = createGenerativeCaseConfirmationPackage({ stage: "smoke" });
    const selection = validateGenerativeDevelopmentRunSelection({
      stage: "smoke",
      caseIds: ["SMK-F-PARTIAL-ASK", "SMK-R-CLEAN-ASK"]
    });
    const reserved = reserveGenerativeDevelopmentRunBudget({
      ledger: null,
      confirmation,
      selection,
      reservationId: "target-with-retry",
      reservedAt: "2026-07-30T02:00:00.000Z"
    });
    const runs = selection.caseIds.map((caseId, index) => ({
      ...developmentRun({ caseId, outcomeClass: "ask" }),
      attempts: index === 0 ? 2 : 1
    }));
    const completed = completeGenerativeDevelopmentRunBudget({
      ledger: reserved.ledger,
      confirmation,
      reservationId: reserved.entry.reservationId,
      completedAt: "2026-07-30T02:01:00.000Z",
      runs
    });

    expect(completed.entries[0]).toMatchObject({
      status: "completed",
      technicalAttempts: 3,
      technicalRetries: 1,
      technicallyCompleteCases: 2
    });
    expect(completed.entries).toHaveLength(1);
  });

  it("两阶段各一次属于计划内调用，不计为技术重试", () => {
    const runs = [...GENERATIVE_GI009_TWO_CALL_TARGETED_CASE_IDS].map((caseId) => ({
      ...developmentRun({ caseId, outcomeClass: "ask", architecture: "two_call" }),
      attempts: 2,
      attemptDetails: ["extract", "question"].map((stage) => ({
        stage: stage as "extract" | "question",
        attempt: 1,
        provider: "deepseek",
        success: true,
        latencyMs: 10,
        errorCode: null
      }))
    }));

    expect(summarizeGenerativeDevelopmentTechnicalCalls(runs)).toEqual({
      totalRequests: 4,
      plannedCalls: 4,
      technicalRetries: 0
    });
  });

  it("严格审计作废 R1 预检缺口并恢复完整运行额度", () => {
    const confirmation = createGenerativeCaseConfirmationPackage({ stage: "smoke" });
    const selection = validateGenerativeDevelopmentRunSelection({ stage: "smoke" });
    const sourceEnvelope = createGenerativeDevelopmentRunEnvelope({
      confirmation,
      stage: "smoke",
      selection,
      runs: GENERATIVE_MVP_STRICT_SMOKE_CASES.map((probe) =>
        technicalPreflightFailureRun(probe.id)
      )
    });
    const reserved = reserveGenerativeDevelopmentRunBudget({
      ledger: null,
      confirmation,
      selection,
      reservationId: "r1-preflight-gap",
      reservedAt: "2026-07-30T17:01:57.239Z"
    });
    const completed = completeGenerativeDevelopmentRunBudget({
      ledger: reserved.ledger,
      confirmation,
      reservationId: reserved.entry.reservationId,
      completedAt: "2026-07-30T17:01:57.263Z",
      runs: sourceEnvelope.singleRuns
    });
    const voided = voidGenerativeDevelopmentTechnicalPreflightGap({
      ledger: completed,
      confirmation,
      reservationId: reserved.entry.reservationId,
      sourceEnvelope,
      auditedAt: "2026-07-30T18:00:00.000Z",
      auditedBy: "delegated_codex"
    });

    expect(voided.entries[0]).toMatchObject({
      status: "void_technical_preflight_gap",
      technicalAttempts: 24,
      technicalRetries: 12,
      technicallyCompleteCases: 0,
      voidAudit: {
        auditVersion: "board7-v64-technical-preflight-gap.1",
        auditedBy: "delegated_codex",
        reason: "dns_preflight_gap_before_budget_reservation"
      }
    });
    expect(voided.entries[0]?.voidAudit?.sourceEnvelopeFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    const next = reserveGenerativeDevelopmentRunBudget({
      ledger: voided,
      confirmation,
      selection,
      reservationId: "full-after-void",
      reservedAt: "2026-07-30T18:01:00.000Z"
    });
    expect(next.ledger.entries).toHaveLength(2);
    expect(next.entry.status).toBe("reserved");

    const report = formatGenerativeEvaluationReport({
      singleRuns: sourceEnvelope.singleRuns
    });
    expect(report).toContain("技术完整：0/12");
    expect(report).toContain("人工可裁决：0");
    expect(report).toContain("人工待裁决：0");
    expect(report).toContain("完成门：失败");
    expect(report).toContain("人工无需质量裁决");
    const review = formatGenerativeHumanReviewPackage({
      split: "work",
      singleRuns: sourceEnvelope.singleRuns,
      layers: ["single_turn"],
      includeOnlyRunCases: true
    });
    expect(review).toContain("技术门失败，无需质量裁决");
    expect(review).not.toContain("运行 1 人工裁决：待填写");
  });

  it("R1 作废审计拒绝裁决、成功响应和同候选重复运行", () => {
    const confirmation = createGenerativeCaseConfirmationPackage({ stage: "smoke" });
    const selection = validateGenerativeDevelopmentRunSelection({ stage: "smoke" });
    const cleanRuns = GENERATIVE_MVP_STRICT_SMOKE_CASES.map((probe) =>
      technicalPreflightFailureRun(probe.id)
    );
    const sourceEnvelope = createGenerativeDevelopmentRunEnvelope({
      confirmation,
      stage: "smoke",
      selection,
      runs: cleanRuns
    });
    const reserved = reserveGenerativeDevelopmentRunBudget({
      ledger: null,
      confirmation,
      selection,
      reservationId: "r1",
      reservedAt: "2026-07-30T17:00:00.000Z"
    });
    const completed = completeGenerativeDevelopmentRunBudget({
      ledger: reserved.ledger,
      confirmation,
      reservationId: "r1",
      completedAt: "2026-07-30T17:01:00.000Z",
      runs: sourceEnvelope.singleRuns
    });
    const audit = (envelope: unknown, ledger = completed) =>
      voidGenerativeDevelopmentTechnicalPreflightGap({
        ledger,
        confirmation,
        reservationId: "r1",
        sourceEnvelope: envelope,
        auditedAt: "2026-07-30T18:00:00.000Z",
        auditedBy: "delegated_codex"
      });

    const reviewed = structuredClone(sourceEnvelope);
    reviewed.singleRuns[0]!.productReview.initialVerdict = "pass";
    expect(() => audit(reviewed)).toThrow("GENERATIVE_V64_TECHNICAL_VOID_REVIEW_PRESENT");

    const withSuccessRuns = cleanRuns.map((run, index) => index === 0
      ? { ...run, attemptDetails: run.attemptDetails.map((item, attemptIndex) =>
          attemptIndex === 0 ? { ...item, success: true, errorCode: null } : item
        ) }
      : run
    );
    const withSuccess = createGenerativeDevelopmentRunEnvelope({
      confirmation,
      stage: "smoke",
      selection,
      runs: withSuccessRuns
    });
    expect(() => audit(withSuccess)).toThrow(
      "GENERATIVE_V64_TECHNICAL_VOID_FAILURE_NOT_UNIFORM"
    );

    const duplicate = reserveGenerativeDevelopmentRunBudget({
      ledger: completed,
      confirmation,
      selection,
      reservationId: "r2",
      reservedAt: "2026-07-30T17:02:00.000Z"
    }).ledger;
    expect(() => audit(sourceEnvelope, duplicate)).toThrow(
      "GENERATIVE_V64_TECHNICAL_VOID_CANDIDATE_RUN_COUNT_INVALID"
    );
  });
});
