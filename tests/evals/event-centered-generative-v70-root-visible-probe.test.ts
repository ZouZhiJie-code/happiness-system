import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  applyGenerativeV70RootVisibleProbeReviews,
  assertGenerativeEvaluationCliModeAvailable,
  auditGenerativeV70RootVisibleProbeRun,
  createGenerativeDevelopmentEvaluationCase,
  createGenerativeDevelopmentRunFingerprintWithVersions,
  createGenerativeV70RootVisibleProbeApprovalCard,
  createGenerativeV70RootVisibleProbeRunEnvelope,
  EMPTY_GENERATIVE_MEANING_CARD_CANDIDATE_REVIEW,
  formatGenerativeV70RootVisibleProbeConfirmationPackage,
  formatGenerativeV70RootVisibleProbeReport,
  formatGenerativeV70RootVisibleProbeReviewPackage,
  GENERATIVE_MEANING_CARD_CANDIDATE_CASES,
  GENERATIVE_REPAIR_PROBE_CASES,
  GENERATIVE_V70_ROOT_VISIBLE_PROBE_APPROVAL_VERSION,
  GENERATIVE_V70_ROOT_VISIBLE_PROBE_ARTIFACT_PATHS,
  GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_VERSION,
  GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASE_FINGERPRINT,
  GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASE_IDS,
  GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASES,
  GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET,
  GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET_VERSION,
  GENERATIVE_V70_ROOT_VISIBLE_PROBE_MAX_PROVIDER_REQUESTS,
  generativeV70RootVisibleProbeApprovalCardFingerprint,
  generativeV70RootVisibleProbeCaseFingerprint,
  generativeV70RootVisibleProbeMeaningCardVersions,
  generativeV70RootVisibleProbeRuntimeConfig,
  generativeV70RootVisibleProbeVersions,
  parseGenerativeV70RootVisibleProbeBudgetLedger,
  parseGenerativeV70RootVisibleProbeRunEnvelope,
  reserveGenerativeV70RootVisibleProbeRun,
  runGenerativeCatalogPreflight,
  summarizeGenerativeV70RootVisibleProbeGate,
  validateGenerativeV70RootVisibleProbeApproval,
  type GenerativeMeaningCardCandidateReviewRecord,
  type GenerativeRepairProbeRun,
  type GenerativeV70RootVisibleProbeApproval
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

function frozenReviewedV70Envelope() {
  return parseGenerativeV70RootVisibleProbeRunEnvelope(JSON.parse(readFileSync(
    GENERATIVE_V70_ROOT_VISIBLE_PROBE_ARTIFACT_PATHS.json,
    "utf8"
  )));
}

function frozenV70Budget() {
  return parseGenerativeV70RootVisibleProbeBudgetLedger(JSON.parse(readFileSync(
    GENERATIVE_V70_ROOT_VISIBLE_PROBE_ARTIFACT_PATHS.budget,
    "utf8"
  )));
}

function approvedRun(): GenerativeV70RootVisibleProbeApproval {
  return validateGenerativeV70RootVisibleProbeApproval({
    approval: {
      approvalType: "board7_provider_v70_root_visible_probe_run",
      approvalVersion: GENERATIVE_V70_ROOT_VISIBLE_PROBE_APPROVAL_VERSION,
      decision: "approved",
      approvedBy: "product_owner",
      approvedAt: "2026-08-01T20:00:00.000Z",
      confirmationText: "确认运行这两个冻结案例。",
      taskId: "codex-task-v70-root-visible-probe",
      approvalCardFingerprint:
        generativeV70RootVisibleProbeApprovalCardFingerprint(),
      datasetVersion: GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET_VERSION,
      caseFingerprint: GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASE_FINGERPRINT
    }
  });
}

function rootVisibleProbeRuns(): GenerativeRepairProbeRun[] {
  const versions = generativeV70RootVisibleProbeMeaningCardVersions();
  const promptVersions = /^two_call:(.+)\+(.+)$/u.exec(versions.prompt);
  if (!promptVersions) throw new Error("V70_ROOT_VISIBLE_PROMPT_INVALID");
  const [, semanticPromptVersion, visiblePromptVersion] = promptVersions;
  return GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASES.map((candidate) => {
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
      ? "最后一遍听第二段时，具体哪个声音瞬间让你的手停下了切换？"
      : "常用香料移到手边后，你炒菜时伸手就能拿到，也少了中途搬凳子的打断。这个角度先停在这里。";
    const run = {
      runFingerprint: "",
      runId: `${candidate.id}-R1`,
      caseId: candidate.id,
      split: "work" as const,
      runIndex: 1,
      architecture: "two_call" as const,
      assistantPayload: null,
      visibleReplay: {
        thinkingSummary: ask
          ? "你已经停在第二段，具体判断仍需要回到最后一遍试听。"
          : null,
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
        promptVersion: semanticPromptVersion!,
        resolvedPromptHash: "a".repeat(64)
      }, {
        promptKey: "interview.event_centered.generative_visible_turn",
        promptVersion: visiblePromptVersion!,
        resolvedPromptHash: "b".repeat(64)
      }],
      technicalComplete: true,
      productGateState: "blocked_pending_review" as const,
      versions: {
        strategy: versions.strategy,
        angleCard: versions.angleCard,
        fewShot: versions.fewShot,
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
          thinkingSummary: ask
            ? "你已经停在第二段，具体判断仍需要回到最后一遍试听。"
            : null,
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
    run.runFingerprint = createGenerativeDevelopmentRunFingerprintWithVersions(
      run,
      versions
    );
    return run;
  });
}

function passReviews(
  runs: readonly GenerativeRepairProbeRun[]
): GenerativeMeaningCardCandidateReviewRecord[] {
  return runs.map((run) => ({
    runId: run.runId,
    runFingerprint: run.runFingerprint,
    semanticCardVerdict: "pass",
    semanticCardReason: null,
    semanticCardEvidence: "语义状态、分流和证据关系完整。",
    visibleVerdict: "pass",
    visibleReason: null,
    visibleEvidence: "root visible 字段与用户可见表达均符合冻结判尺。",
    severeErrors: [],
    reviewedBy: "codex",
    reviewedAt: "2026-08-01T20:05:00.000Z"
  }));
}

function reviewedRuns() {
  const runs = rootVisibleProbeRuns();
  return applyGenerativeV70RootVisibleProbeReviews(runs, passReviews(runs));
}

describe("board 7 Provider v70/v70 root-visible probe", () => {
  it("冻结数据集、案例顺序、案例指纹和两个最小规则", () => {
    expect(GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET_VERSION).toBe(
      "2026-08-01.board7-provider-v70-root-visible-probe-v1"
    );
    expect(GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASES.map((item) => item.id))
      .toEqual([...GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASE_IDS]);
    expect(generativeV70RootVisibleProbeCaseFingerprint()).toBe(
      GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASE_FINGERPRINT
    );
    expect(GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASE_FINGERPRINT).toBe(
      "59e5d4e55b1bc16e163dcb5ae8a2c74518c73df9cf372a8a77ca0fb597dd9414"
    );
    expect(GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASES.map((item) => item.repairRule))
      .toEqual([
        "goal_abstract_answer_entry_concrete",
        "visible_second_person_or_neutral"
      ]);
  });

  it("冻结可信事实并保证本轮新增信息只从 currentUserText 进入", () => {
    const askCase = GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASES[0]!;
    const boundaryCase = GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASES[1]!;
    expect(askCase?.trustedFacts).toEqual([
      "用户为阅读计时器比较两段很短且相近的结束提示音",
      "用户戴耳机反复试听后保存了第二段"
    ]);
    expect(boundaryCase?.trustedFacts).toEqual([
      "用户做饭中途需要搬凳子去高柜拿香料，造成炒菜过程被打断",
      "用户已经把常用的几罐香料移到灶台旁的小抽屉"
    ]);
    const preTurnInputs = (candidate: NonNullable<typeof askCase>) => {
      const evaluationCase = createGenerativeDevelopmentEvaluationCase(candidate);
      return JSON.stringify({
        userContext: candidate.userContext,
        conversationContext: evaluationCase.conversationContext,
        currentQuestion: evaluationCase.currentQuestion,
        currentQuestionTarget: evaluationCase.currentQuestionTarget,
        currentQuestionCognitiveAction:
          evaluationCase.currentQuestionCognitiveAction,
        currentQuestionIntent: evaluationCase.currentQuestionIntent,
        trustedFacts: evaluationCase.trustedFacts
      });
    };
    const askPreTurn = preTurnInputs(askCase);
    for (const phrase of [
      "最后一遍",
      "不想再切回",
      "手停止切换",
      "真正让我定下来",
      "说不清"
    ]) expect(askPreTurn).not.toContain(phrase);
    for (const phrase of ["最后一遍", "不想再切回", "判断依据", "说不清"]) {
      expect(askCase?.currentUserText).toContain(phrase);
    }
    expect(askCase?.currentQuestionIntent?.minimumAnswerScope).toBe(
      "说出第二段相较第一段更符合的一项具体判断标准"
    );

    const boundaryPreTurn = preTurnInputs(boundaryCase);
    for (const phrase of [
      "昨晚炒菜时",
      "没再中途搬凳子",
      "伸手就拿到了",
      "真正起作用",
      "这个角度到这里"
    ]) {
      expect(boundaryPreTurn).not.toContain(phrase);
      expect(boundaryCase?.currentUserText).toContain(phrase);
    }
  });

  it("在全仓范围保持新故事隔离，且 Prompt 与 Few-shot 无案例泄漏", () => {
    const forbiddenFamilies = new Set([
      ...generativeSingleTurnEvaluationCases.map((item) => item.scenarioFamily),
      ...generativeTrajectoryEvaluationCases.map((item) => item.scenarioFamily),
      ...GENERATIVE_QUALITY_CALIBRATION_CARDS.map((item) => item.scenarioFamily),
      ...GENERATIVE_ARCHITECTURE_PROBE_CASES.map((item) => item.scenarioFamily),
      ...GENERATIVE_MVP_SMOKE_CASES.map((item) => item.scenarioFamily),
      ...GENERATIVE_MEANING_CARD_CANDIDATE_CASES.map((item) => item.scenarioFamily),
      ...GENERATIVE_REPAIR_PROBE_CASES.map((item) => item.scenarioFamily)
    ]);
    expect(GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASES.every(
      (item) => !forbiddenFamilies.has(item.scenarioFamily)
    )).toBe(true);
    expect(GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET.deduplication).toMatchObject({
      checkedBeforeAddition: true,
      matchedExistingStories: []
    });
    expect(runGenerativeCatalogPreflight().issues.some((issue) =>
      issue.startsWith("v70_root_visible_probe_family_leak:")
    )).toBe(false);

    const allowedAnchorFiles = new Set([
      "evals/event-centered-generative/board7-provider-v70-root-visible-probe-v1.json",
      "tests/evals/event-centered-generative-v70-root-visible-probe.test.ts",
      GENERATIVE_V70_ROOT_VISIBLE_PROBE_ARTIFACT_PATHS.confirmation
    ]);
    for (const anchor of GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET.deduplication
      .storyAnchors) {
      const matches = execFileSync("rg", [
        "-l",
        "--fixed-strings",
        anchor,
        "src",
        "tests",
        "evals",
        "artifacts",
        "docs",
        "scripts"
      ], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
      expect(matches.filter((path) => !allowedAnchorFiles.has(path))).toEqual([]);
    }

    const promptSources = [
      readFileSync("src/server/services/interview/event-centered-ai.service.ts", "utf8"),
      readFileSync("src/features/interview/event-centered/generative-strategy.ts", "utf8")
    ].join("\n");
    for (const caseId of GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASE_IDS) {
      expect(promptSources).not.toContain(caseId);
    }
    for (const anchor of GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET.deduplication
      .storyAnchors) {
      expect(promptSources).not.toContain(anchor);
    }
  });

  it("冻结 v70/v70 候选、运行参数与最多八次生成请求", () => {
    expect(generativeV70RootVisibleProbeVersions()).toEqual({
      prompt:
        "two_call:2026-08-01.event-centered-generative-v70-understanding-card+2026-08-01.event-centered-generative-v70-visible",
      strategy: "5.48.0",
      angleCard: "2.12.0",
      fewShot: "quality-patterns.2026-08-01.v27",
      semanticArtifact: "event-centered-semantic-plan.v3",
      rootVisibleProbe: "provider-v70-root-visible-probe-v1"
    });
    expect(generativeV70RootVisibleProbeRuntimeConfig()).toMatchObject({
      architecture: "two_call",
      maxRequestsPerTurn: 4,
      maxTechnicalRetriesPerStage: 1,
      maxProviderRequestsPerBatch: GENERATIVE_V70_ROOT_VISIBLE_PROBE_MAX_PROVIDER_REQUESTS
    });
    const runs = rootVisibleProbeRuns();
    expect(runs.reduce((total, run) => total + run.attempts, 0)).toBe(4);
    const overLimit = structuredClone(runs);
    overLimit[0]!.attempts = 5;
    overLimit[0]!.runFingerprint =
      createGenerativeDevelopmentRunFingerprintWithVersions(
        overLimit[0]!,
        generativeV70RootVisibleProbeMeaningCardVersions()
      );
    expect(() => createGenerativeV70RootVisibleProbeRunEnvelope({
      runs: overLimit,
      budgetReservationId: "v70-over-limit"
    })).toThrow("GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASE_REQUEST_BUDGET_EXCEEDED");
  });

  it("确认包冻结预算、请求口径、独立裁决、产物路径与隐藏集边界", () => {
    const confirmation = formatGenerativeV70RootVisibleProbeConfirmationPackage();
    expect(confirmation).toContain(GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_VERSION);
    expect(confirmation).toContain(
      "恰好执行 1 次只读 GET /models 预检"
    );
    expect(confirmation).toContain("整批最多 8 次生成请求");
    expect(confirmation).toContain("Codex 独立评审");
    expect(confirmation).toContain("borderline 按失败计");
    expect(confirmation).toContain("只解锁隐藏集准备");
    expect(confirmation).toContain("隐藏集运行需要新的确认包与单独授权");
    for (const path of Object.values(GENERATIVE_V70_ROOT_VISIBLE_PROBE_ARTIFACT_PATHS)) {
      expect(confirmation).toContain(path);
    }
    expect(confirmation).toContain(
      generativeV70RootVisibleProbeApprovalCardFingerprint()
    );
    expect(confirmation).toContain("用户确认原文");
    expect(confirmation).toContain("任务 / 会话标识");
    expect(confirmation).toContain("最后一遍听到第二段时就不想再切回去了");
    expect(confirmation).toContain("昨晚炒菜时我没再中途搬凳子");
  });

  it("批准凭证与冻结账本继续可读，v4 生效后拒绝新预算", () => {
    const approval = approvedRun();
    expect(createGenerativeV70RootVisibleProbeApprovalCard()).toMatchObject({
      requestBudget: {
        readOnlyModelsPreflight: 1,
        generationRequestsMax: 8
      },
      budgetVersion: GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_VERSION,
      passEffect: "prepare_hidden_set_only",
      hiddenSetRunRequiresSeparateApproval: true
    });
    expect(() => validateGenerativeV70RootVisibleProbeApproval({
      ...approval,
      approvalCardFingerprint: "0".repeat(64)
    })).toThrow("GENERATIVE_V70_ROOT_VISIBLE_PROBE_APPROVAL_INVALID");
    let providerCalls = 0;
    const reserveThenAccessProvider = (
      ledger: ReturnType<typeof frozenV70Budget> | null,
      reservationId: string
    ) => {
      const reserved = reserveGenerativeV70RootVisibleProbeRun({
        ledger,
        reservationId,
        reservedAt: "2026-08-01T20:01:00.000Z",
        approval
      });
      providerCalls += 1;
      return reserved;
    };
    expect(() => reserveThenAccessProvider(null, "v70-run-1"))
      .toThrow("GENERATIVE_V70_ROOT_VISIBLE_PROBE_CANDIDATE_MISMATCH");
    expect(providerCalls).toBe(0);

    const historicalBudget = frozenV70Budget();
    expect(() => reserveThenAccessProvider(
      historicalBudget,
      "v70-exhausted-run"
    )).toThrow("GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_EXHAUSTED");
    expect(providerCalls).toBe(0);
    expect(historicalBudget.entries[0]?.approval).toMatchObject({
      approvalCardFingerprint:
        generativeV70RootVisibleProbeApprovalCardFingerprint(),
      confirmationText: "确认"
    });
  });

  it("existing-runs 只接受结构完整且可追溯的嵌入 Codex 裁决", () => {
    const valid = createGenerativeV70RootVisibleProbeRunEnvelope({
      runs: reviewedRuns(),
      budgetReservationId: "v70-review-validation",
      createdAt: "2026-08-01T20:02:00.000Z"
    });
    expect(() => parseGenerativeV70RootVisibleProbeRunEnvelope(valid))
      .not.toThrow();

    const missingReviewedAt = structuredClone(valid);
    missingReviewedAt.singleRuns[0]!.meaningCardReview.reviewedAt = null;
    expect(() => parseGenerativeV70RootVisibleProbeRunEnvelope(missingReviewedAt))
      .toThrow("GENERATIVE_V70_ROOT_VISIBLE_PROBE_REVIEW_INVALID");

    const incompleteVerdict = structuredClone(valid);
    incompleteVerdict.singleRuns[0]!.meaningCardReview.visibleVerdict = null;
    expect(() => parseGenerativeV70RootVisibleProbeRunEnvelope(incompleteVerdict))
      .toThrow("GENERATIVE_V70_ROOT_VISIBLE_PROBE_REVIEW_INVALID");

    const missingFailureEvidence = structuredClone(valid);
    missingFailureEvidence.singleRuns[0]!.meaningCardReview = {
      ...missingFailureEvidence.singleRuns[0]!.meaningCardReview,
      semanticCardVerdict: "fail",
      semanticCardReason: "answer_entry_burden",
      semanticCardEvidence: null
    };
    expect(() => parseGenerativeV70RootVisibleProbeRunEnvelope(
      missingFailureEvidence
    )).toThrow("GENERATIVE_V70_ROOT_VISIBLE_PROBE_REVIEW_INVALID");
  });

  it("历史门规则仍可离线计算，新运行转交 v4 独立小门", () => {
    const approval = approvedRun();
    const runs = reviewedRuns();
    expect(summarizeGenerativeV70RootVisibleProbeGate(runs)).toMatchObject({
      expectedTotal: 2,
      technicalComplete: 2,
      semanticPassed: 2,
      visiblePassed: 2,
      severeErrors: 0,
      decision: "pass"
    });
    const envelope = createGenerativeV70RootVisibleProbeRunEnvelope({
      runs,
      budgetReservationId: "v70-historical-fixture",
      createdAt: "2026-08-01T20:02:00.000Z"
    });
    expect(() => reserveGenerativeV70RootVisibleProbeRun({
      ledger: null,
      reservationId: "v70-new-run",
      reservedAt: "2026-08-01T20:07:00.000Z",
      approval
    })).toThrow("GENERATIVE_V70_ROOT_VISIBLE_PROBE_CANDIDATE_MISMATCH");
    expect(formatGenerativeV70RootVisibleProbeReport(envelope)).toContain(
      "只准备隐藏集；隐藏集运行需另行授权"
    );
    expect(formatGenerativeV70RootVisibleProbeReviewPackage(runs)).toContain(
      "borderline 计为未通过"
    );
  });

  it("旧中止路径同样停留在历史候选", () => {
    const approval = approvedRun();
    expect(() => reserveGenerativeV70RootVisibleProbeRun({
      ledger: null,
      reservationId: "v70-aborted",
      reservedAt: "2026-08-01T20:01:00.000Z",
      approval
    })).toThrow("GENERATIVE_V70_ROOT_VISIBLE_PROBE_CANDIDATE_MISMATCH");
  });

  it("任一技术、状态、动作或人工裁决失败都固定 stop", () => {
    const unreviewed = rootVisibleProbeRuns();
    const technicalFailure = structuredClone(unreviewed);
    technicalFailure[0]!.technicalComplete = false;
    technicalFailure[0]!.runtimeError = "TIMEOUT";
    expect(summarizeGenerativeV70RootVisibleProbeGate(technicalFailure).decision)
      .toBe("stop");

    const stateFailure = structuredClone(unreviewed);
    stateFailure[0]!.actualSemanticState = "ready";
    expect(summarizeGenerativeV70RootVisibleProbeGate(stateFailure).decision)
      .toBe("stop");

    const actionFailure = structuredClone(unreviewed);
    actionFailure[0]!.expectedResultMismatch = true;
    expect(summarizeGenerativeV70RootVisibleProbeGate(actionFailure).decision)
      .toBe("stop");

    const pending = rootVisibleProbeRuns();
    const borderlineReviews = passReviews(pending);
    borderlineReviews[0] = {
      ...borderlineReviews[0]!,
      semanticCardVerdict: "borderline",
      semanticCardReason: "answer_entry_burden"
    };
    const partialHumanFailure = applyGenerativeV70RootVisibleProbeReviews(
      pending,
      [borderlineReviews[0]!]
    );
    expect(summarizeGenerativeV70RootVisibleProbeGate(partialHumanFailure))
      .toMatchObject({
        semanticReviewed: 1,
        visibleReviewed: 1,
        decision: "stop"
      });
    const humanFailure = applyGenerativeV70RootVisibleProbeReviews(
      pending,
      borderlineReviews
    );
    expect(summarizeGenerativeV70RootVisibleProbeGate(humanFailure)).toMatchObject({
      semanticPassed: 1,
      decision: "stop"
    });

    const productOwnerReviews = passReviews(pending).map((review) => ({
      ...review,
      reviewedBy: "product_owner" as const
    }));
    expect(() => applyGenerativeV70RootVisibleProbeReviews(
      pending,
      productOwnerReviews
    )).toThrow("GENERATIVE_V70_ROOT_VISIBLE_PROBE_CODEX_REVIEW_REQUIRED");
    const productOwnerOnly = reviewedRuns().map((run) => ({
      ...run,
      meaningCardReview: {
        ...run.meaningCardReview,
        reviewedBy: "product_owner" as const
      }
    }));
    expect(summarizeGenerativeV70RootVisibleProbeGate(productOwnerOnly))
      .toMatchObject({
        failureReasons: ["codex_review_required"],
        decision: "stop"
      });
  });

  it("stop 审计一经写入便保持终局，后续评审不能改写为 pass", () => {
    const stopped = frozenV70Budget();
    const stopEnvelope = frozenReviewedV70Envelope();
    expect(stopped.entries[0]?.gateAudit?.decision).toBe("stop");
    expect(() => auditGenerativeV70RootVisibleProbeRun({
      ledger: stopped,
      envelope: stopEnvelope,
      auditedAt: "2026-08-01T20:06:00.000Z"
    })).toThrow(
      "GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_AUDIT_ALREADY_FINALIZED"
    );
  });

  it("CLI 保持离线默认、冻结正式路径、批准入口与单次预检", () => {
    expect(() => assertGenerativeEvaluationCliModeAvailable(
      "provider-v70-root-visible-probe-confirmation"
    )).not.toThrow();
    expect(() => assertGenerativeEvaluationCliModeAvailable(
      "provider-v70-root-visible-probe"
    )).not.toThrow();
    expect(() => assertGenerativeEvaluationCliModeAvailable(
      "provider-v70-root-visible-probe-recovery"
    )).toThrow("GENERATIVE_EVALUATION_MODE_INVALID");
    const script = readFileSync("scripts/run-event-centered-generative-eval.ts", "utf8");
    expect(script).toContain("--v70-root-visible-approval-json");
    expect(script).toContain("GENERATIVE_V70_ROOT_VISIBLE_PROBE_APPROVAL_REQUIRED");
    expect(script).toContain(
      "GENERATIVE_V70_ROOT_VISIBLE_PROBE_EXISTING_RUNS_MUST_BE_UNREVIEWED"
    );
    expect(script).toContain("GENERATIVE_V70_ROOT_VISIBLE_PROBE_FIXED_CASE_SET");
    expect(script).toContain("GENERATIVE_V70_ROOT_VISIBLE_PROBE_RUNTIME_IS_FROZEN");
    expect(script).toContain("frozenV70RootVisibleProbeArtifactPath");
    const formalBranch = script.slice(
      script.indexOf('if (mode === "provider-v70-root-visible-probe")'),
      script.indexOf('if (mode === "provider-v31-repair-probe")')
    );
    const reserveIndex = formalBranch.indexOf(
      "reserveGenerativeV70RootVisibleProbeRun"
    );
    const providerConfigIndex = formalBranch.indexOf(
      "readFrozenEvaluationProviderConfig"
    );
    const networkPreflightIndex = formalBranch.indexOf(
      "runGenerativeDeepSeekProviderPreflight"
    );
    const providerIndex = formalBranch.indexOf(
      "createFrozenEvaluationProvider"
    );
    expect(reserveIndex).toBeGreaterThanOrEqual(0);
    expect(providerConfigIndex).toBeGreaterThan(reserveIndex);
    expect(networkPreflightIndex).toBeGreaterThan(providerConfigIndex);
    expect(providerIndex).toBeGreaterThan(networkPreflightIndex);
    expect(formalBranch.match(/runGenerativeDeepSeekProviderPreflight/g)).toHaveLength(1);
    expect(formalBranch).toContain("runGenerativeV70RootVisibleProbeEvaluation");
    expect(formalBranch).toContain("reserveGenerativeV70RootVisibleProbeRun");
    expect(formalBranch).toContain("auditGenerativeV70RootVisibleProbeRun");
    expect(formalBranch).not.toContain("recovery");
  });
});
