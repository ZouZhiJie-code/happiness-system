import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  eventCenteredTwoStageV4GenerativePlanSchema
} from "@/features/interview/event-centered/ai-contract";
import {
  approveGenerativeSemanticFrameV4FirstPassBudget,
  assertGenerativeEvaluationCliModeAvailable,
  assertGenerativeSemanticFrameV4CandidateActive,
  assertGenerativeSemanticFrameV4OfflineOnly,
  auditGenerativeV70RootVisibleProbeRun,
  createGenerativeArchitectureStageBreakdown,
  createGenerativeSemanticFrameV4FirstPassPendingBudget,
  createGenerativeSemanticFrameV4ExpectedFirstStage,
  createGenerativeSemanticFrameV4VisibleInputFixture,
  formatGenerativeSemanticFrameV4OfflineConfirmationPackage,
  GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_APPROVAL_VERSION,
  GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_ARTIFACT_PATH,
  GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_VERSION,
  GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_REQUEST_BUDGET,
  GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUNTIME_CONFIG,
  GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CANDIDATE_VERSIONS,
  GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CAPABILITIES,
  GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CONFIRMATION_ARTIFACT_PATH,
  GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_FINGERPRINT,
  GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_IDS,
  GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES,
  GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET,
  GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET_VERSION,
  GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_RUN_POLICY,
  GENERATIVE_SEMANTIC_FRAME_V4_PROVIDER_TOP_LEVEL_KEYS,
  generativeSemanticFrameV4FirstPassScopeFingerprint,
  generativeSemanticFrameV4OfflineCaseFingerprint,
  parseGenerativeRepairProbeRecoveryEnvelope,
  parseGenerativeSemanticFrameV4FirstPassBudget,
  parseGenerativeSemanticFrameV4OfflineDataset,
  parseGenerativeV70RootVisibleProbeBudgetLedger,
  parseGenerativeV70RootVisibleProbeRunEnvelope,
  reserveGenerativeSemanticFrameV4FirstPassRun,
  validateGenerativeSemanticFrameV4FirstPassApproval,
  validateGenerativeSemanticFrameV4FirstPassRequestUsage,
  validateGenerativeSemanticFrameV4FirstPassRunAuthorization
} from "@/features/interview/event-centered/generative-evaluation-runner";

const datasetPath =
  "evals/event-centered-generative/board7-semantic-frame-v4-offline-confirmation-v1.json";
const recoveryV3Path =
  "artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-recovery-1-reviewed.json";
const reviewedV70Path =
  "artifacts/generative-interview-board7/2026-08-01/provider-v70-root-visible-probe-run-1.json";
const v70BudgetPath =
  "artifacts/generative-interview-board7/2026-08-01/board7-provider-v70-root-visible-probe-budget.json";
const productionEnvPath = ".env.production.example";

type MutableOfflineDataset = {
  cases: Array<Record<string, unknown>>;
};

type MutableSemanticFrame = {
  units: Array<Record<string, unknown>>;
  relation: Record<string, unknown> | null;
};

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function mutableDataset(): MutableOfflineDataset {
  return readJson(datasetPath) as MutableOfflineDataset;
}

function mutableCase(
  dataset: MutableOfflineDataset,
  caseId: string
): Record<string, unknown> {
  const item = dataset.cases.find((candidate) => candidate.id === caseId);
  if (!item) throw new Error(`SEMANTIC_FRAME_V4_TEST_CASE_UNKNOWN:${caseId}`);
  return item;
}

function mutableFrame(item: Record<string, unknown>): MutableSemanticFrame {
  return item.expectedSemanticFrame as MutableSemanticFrame;
}

function v4ProviderPlan(caseId: string) {
  const item = GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES.find(
    (candidate) => candidate.id === caseId
  );
  if (!item) throw new Error(`SEMANTIC_FRAME_V4_TEST_CASE_UNKNOWN:${caseId}`);
  const firstStage = createGenerativeSemanticFrameV4ExpectedFirstStage(caseId);
  return {
    understanding: {
      eventBoundary: "current_event" as const,
      coreEventIdentifiable: item.expectedDecision.state !== "limited",
      answerStatus: item.expectedUnderstanding.answerStatus,
      factDeltas: [],
      correctionOrBoundary: item.expectedUnderstanding.correctionOrBoundaryKind
        ? {
            kind: item.expectedUnderstanding.correctionOrBoundaryKind,
            reason: item.expectedUnderstanding.correctionOrBoundaryKind ===
              "correction"
              ? "AI 上一轮的旧理解已撤回，按本轮修正更新"
              : "本轮内容边界已被独立识别"
          }
        : null,
      eventOptions: []
    },
    ...firstStage,
    decision: {
      ...firstStage.decision,
      origin: firstStage.decision.state === "ready"
        ? "user_articulated" as const
        : null
    }
  };
}

function approvedFirstPass() {
  return {
    approvalType: "board7_provider_v71_semantic_frame_first_pass_run" as const,
    approvalVersion: GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_APPROVAL_VERSION,
    decision: "approved" as const,
    approvedBy: "product_owner" as const,
    approvedAt: "2026-08-01T21:00:00.000Z",
    confirmationText: "确认运行冻结的首轮六例。",
    taskId: "codex-board7-v71-semantic-frame-first-pass",
    budgetVersion: GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_VERSION,
    scopeFingerprint: generativeSemanticFrameV4FirstPassScopeFingerprint(),
    datasetVersion: GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET_VERSION,
    caseFingerprint: GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_FINGERPRINT,
    caseIds: [...GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_IDS],
    candidateVersions: {
      ...GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CANDIDATE_VERSIONS
    },
    model: GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUNTIME_CONFIG.model
  };
}

describe("semanticFrame v4 离线确认包", () => {
  it("冻结六类新案例、候选版本和零预算离线门", () => {
    expect(GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET.datasetVersion).toBe(
      GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET_VERSION
    );
    expect(GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES.map((item) => item.id))
      .toEqual(GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_IDS);
    expect(GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES.map(
      (item) => item.capability
    )).toEqual(GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CAPABILITIES);
    expect(GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET.candidateVersions)
      .toEqual(GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CANDIDATE_VERSIONS);
    expect(GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_RUN_POLICY).toEqual({
      mode: "offline_confirmation_only",
      modelRunAllowed: false,
      providerRequestBudget: null,
      requiresSeparateApproval: true
    });
    expect(GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET.purpose).toContain(
      "获得独立的真实小门运行批准与预算后，才允许作为小门输入"
    );
    expect(generativeSemanticFrameV4OfflineCaseFingerprint()).toBe(
      GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_FINGERPRINT
    );
    expect(() => assertGenerativeSemanticFrameV4CandidateActive()).toThrow(
      "GENERATIVE_SEMANTIC_FRAME_V4_CANDIDATE_MISMATCH"
    );
    expect(() => assertGenerativeSemanticFrameV4OfflineOnly()).not.toThrow();
    expect(() => assertGenerativeSemanticFrameV4OfflineOnly({
      confirmModelRun: true
    })).toThrow("GENERATIVE_SEMANTIC_FRAME_V4_MODEL_RUN_REQUIRES_SEPARATE_APPROVAL");
    expect(() => assertGenerativeSemanticFrameV4OfflineOnly({
      provider: { name: "forbidden-provider" }
    })).toThrow("GENERATIVE_SEMANTIC_FRAME_V4_MODEL_RUN_REQUIRES_SEPARATE_APPROVAL");
  });

  it("首轮六例预算保留冻结范围，并如实记录唯一一次执行状态", () => {
    const stored = readJson(GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_ARTIFACT_PATH);
    const budget = parseGenerativeSemanticFrameV4FirstPassBudget(stored);
    const pending = createGenerativeSemanticFrameV4FirstPassPendingBudget();
    expect({
      ...budget,
      status: "pending",
      approval: null,
      reservation: null
    }).toEqual(pending);
    expect(budget).toMatchObject({
      caseIds: [...GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_IDS],
      caseFingerprint: GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_FINGERPRINT,
      runtimeConfig: {
        model: "deepseek-v4-flash",
        temperature: 0.2,
        maxTokens: 1500,
        timeoutMs: 12000,
        architecture: "two_call",
        thinking: "disabled",
        maxTechnicalRetriesPerStage: 1
      },
      requestBudget: {
        nominalGenerationRequests: 12,
        generationRequestsMax: 24,
        readOnlyModelsPreflightMax: 1
      },
      runLimit: 1
    });
    expect(budget.status).toBe("aborted");
    expect(budget.approval).not.toBeNull();
    expect(budget.reservation).toMatchObject({
      runOrdinal: 1,
      status: "aborted",
      preflightRequests: 1,
      error: "GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_TECHNICAL_STOP:SF4-F-READY-01"
    });
    expect(budget.reservation?.attempts).toHaveLength(3);
    expect(() => assertGenerativeEvaluationCliModeAvailable(
      "provider-v71-semantic-frame-first-pass"
    )).toThrow("GENERATIVE_EVALUATION_MODE_INVALID");
  });

  it("另行批准对象必须与指纹、版本、模型和六个案例完全一致", () => {
    const pending = createGenerativeSemanticFrameV4FirstPassPendingBudget();
    const approval = approvedFirstPass();
    expect(validateGenerativeSemanticFrameV4FirstPassApproval(approval))
      .toEqual(approval);

    expect(() => validateGenerativeSemanticFrameV4FirstPassApproval({
      ...approval,
      scopeFingerprint: "0".repeat(64)
    })).toThrow(
      "GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_APPROVAL_FINGERPRINT_MISMATCH"
    );
    expect(() => validateGenerativeSemanticFrameV4FirstPassApproval({
      ...approval,
      candidateVersions: {
        ...approval.candidateVersions,
        strategy: "5.49.1"
      }
    })).toThrow(
      "GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_APPROVAL_VERSIONS_MISMATCH"
    );
    expect(() => validateGenerativeSemanticFrameV4FirstPassApproval({
      ...approval,
      model: "deepseek-v4-pro"
    })).toThrow(
      "GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_APPROVAL_MODEL_MISMATCH"
    );
    expect(() => validateGenerativeSemanticFrameV4FirstPassApproval({
      ...approval,
      caseIds: approval.caseIds.slice(0, 5)
    })).toThrow(
      "GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_APPROVAL_CASES_MISMATCH"
    );

    const approved = approveGenerativeSemanticFrameV4FirstPassBudget({
      budget: pending,
      approval
    });
    expect(() => validateGenerativeSemanticFrameV4FirstPassRunAuthorization({
      budget: approved,
      runOrdinal: 1,
      caseIds: approved.caseIds,
      candidateVersions: approved.candidateVersions,
      runtimeConfig: approved.runtimeConfig
    })).toThrow("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_APPROVAL_REQUIRED");
    expect(() => validateGenerativeSemanticFrameV4FirstPassRunAuthorization({
      budget: approved,
      approval,
      runOrdinal: 1,
      caseIds: approved.caseIds,
      candidateVersions: approved.candidateVersions,
      runtimeConfig: approved.runtimeConfig
    })).toThrow("GENERATIVE_SEMANTIC_FRAME_V4_CANDIDATE_MISMATCH");
    expect(() => validateGenerativeSemanticFrameV4FirstPassRunAuthorization({
      budget: approved,
      approval,
      runOrdinal: 2,
      caseIds: approved.caseIds,
      candidateVersions: approved.candidateVersions,
      runtimeConfig: approved.runtimeConfig
    })).toThrow("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUN_NOT_AUTHORIZED");
    expect(() => validateGenerativeSemanticFrameV4FirstPassRunAuthorization({
      budget: approved,
      approval,
      runOrdinal: 1,
      caseIds: approved.caseIds.slice(0, 5),
      candidateVersions: approved.candidateVersions,
      runtimeConfig: approved.runtimeConfig
    })).toThrow("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUN_CASES_MISMATCH");
    expect(() => validateGenerativeSemanticFrameV4FirstPassRunAuthorization({
      budget: approved,
      approval,
      runOrdinal: 1,
      caseIds: approved.caseIds,
      candidateVersions: {
        ...approved.candidateVersions,
        semanticPrompt: "prompt-tuning-forbidden"
      },
      runtimeConfig: approved.runtimeConfig
    })).toThrow("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUN_VERSIONS_MISMATCH");
  });

  it("请求计数只放行每阶段一次技术重试，有效结果直接结束该阶段", () => {
    const nominalAttempts = GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_IDS.flatMap(
      (caseId) => (["semantic", "visible"] as const).map((stage) => ({
        caseId,
        stage,
        attemptIndex: 1,
        outcome: "valid" as const
      }))
    );
    expect(validateGenerativeSemanticFrameV4FirstPassRequestUsage({
      readOnlyModelsPreflightRequests: 1,
      attempts: nominalAttempts
    }).attempts).toHaveLength(
      GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_REQUEST_BUDGET
        .nominalGenerationRequests
    );

    const technicalRetry = nominalAttempts.map((attempt, index) => index === 0
      ? { ...attempt, outcome: "technical_failure" as const }
      : attempt
    );
    technicalRetry.splice(1, 0, {
      ...technicalRetry[0]!,
      attemptIndex: 2,
      outcome: "valid"
    });
    expect(() => validateGenerativeSemanticFrameV4FirstPassRequestUsage({
      readOnlyModelsPreflightRequests: 1,
      attempts: technicalRetry
    })).not.toThrow();

    expect(() => validateGenerativeSemanticFrameV4FirstPassRequestUsage({
      readOnlyModelsPreflightRequests: 1,
      attempts: [nominalAttempts[0], {
        ...nominalAttempts[0]!,
        attemptIndex: 2
      }]
    })).toThrow(
      "GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_VALID_RESULT_RETRY_FORBIDDEN"
    );
    expect(() => validateGenerativeSemanticFrameV4FirstPassRequestUsage({
      readOnlyModelsPreflightRequests: 2,
      attempts: []
    })).toThrow(
      "GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_MODELS_PREFLIGHT_BUDGET_EXCEEDED"
    );
    expect(() => validateGenerativeSemanticFrameV4FirstPassRequestUsage({
      readOnlyModelsPreflightRequests: 1,
      attempts: Array.from({ length: 25 }, () => nominalAttempts[0])
    })).toThrow(
      "GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_GENERATION_BUDGET_EXCEEDED"
    );
  });

  it("首轮失败账本保持终局，升级候选后永久停止再次消费", () => {
    const approval = approvedFirstPass();
    const ledger = parseGenerativeSemanticFrameV4FirstPassBudget(
      readJson(GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_ARTIFACT_PATH)
    );
    expect(ledger.status).toBe("aborted");
    expect(() => reserveGenerativeSemanticFrameV4FirstPassRun({
      budget: ledger,
      approval,
      reservationId: "semantic-frame-v4-rerun-forbidden",
      reservedAt: "2026-08-02T12:00:00.000Z"
    })).toThrow("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_ALREADY_CONSUMED");
  });

  it("旧六例补入成果归属后仍满足当前第一段最小结构", () => {
    expect(GENERATIVE_SEMANTIC_FRAME_V4_PROVIDER_TOP_LEVEL_KEYS).toEqual([
      "understanding",
      "decision",
      "semanticFrame",
      "questionIntent",
      "limitReason"
    ]);
    for (const item of GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES) {
      const plan = v4ProviderPlan(item.id);
      expect(eventCenteredTwoStageV4GenerativePlanSchema.safeParse(plan).success)
        .toBe(true);
      expect(Object.keys(plan).sort()).toEqual(
        [...GENERATIVE_SEMANTIC_FRAME_V4_PROVIDER_TOP_LEVEL_KEYS].sort()
      );
      const { understanding: _factMechanics, ...nativeMechanics } = plan;
      void _factMechanics;
      expect(JSON.stringify(nativeMechanics)).not.toMatch(
        /"(?:statement|goal|answerEntry|question|insight|honestLimit|thinkingSummary|responseCore|outcomeCandidate)"\s*:/u
      );
      for (const unit of plan.semanticFrame?.units ?? []) {
        expect(Object.keys(unit).sort()).toEqual(["evidenceRefs", "id", "role"]);
      }
      if (plan.questionIntent) {
        expect(Object.keys(plan.questionIntent).sort()).toEqual([
          "answerSource",
          "gap"
        ]);
        expect(Object.keys(plan.questionIntent.answerSource).sort()).toEqual([
          "anchorQuote",
          "evidenceRefs",
          "kind"
        ]);
      }
    }

    const withVisibleField = {
      ...v4ProviderPlan("SF4-F-READY-01"),
      insight: "第一段提前写出的成果句"
    };
    expect(eventCenteredTwoStageV4GenerativePlanSchema.safeParse(withVisibleField)
      .success).toBe(false);

    const withUnitStatement = structuredClone(v4ProviderPlan("SF4-F-READY-01"));
    (withUnitStatement.semanticFrame!.units[0] as Record<string, unknown>).statement =
      "第一段提前写出的理解句";
    expect(eventCenteredTwoStageV4GenerativePlanSchema.safeParse(withUnitStatement)
      .success).toBe(false);
  });

  it("逐案冻结 semanticFrame、answerSource、系统动作与可见质量判尺", () => {
    expect(GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES.map((item) => ({
      id: item.id,
      state: item.expectedDecision.state,
      action: item.expectedDecision.action,
      units: item.expectedSemanticFrame?.units.map((unit) => unit.role) ?? [],
      relation: item.expectedSemanticFrame?.relation?.type ?? null,
      answerSource: item.expectedQuestionIntent?.answerSource.kind ?? null,
      responseKind: item.expectedVisibleQuality.responseKind,
      mainField: item.expectedVisibleQuality.mainField
    }))).toEqual([
      {
        id: "SF4-F-READY-01",
        state: "ready",
        action: "complete",
        units: ["experience"],
        relation: null,
        answerSource: null,
        responseKind: "completion",
        mainField: "insight"
      },
      {
        id: "SF4-T-ASK-01",
        state: "needs_more",
        action: "ask",
        units: ["judgment"],
        relation: null,
        answerSource: "sensory_detail",
        responseKind: "question",
        mainField: "question"
      },
      {
        id: "SF4-R-COEXIST-01",
        state: "ready",
        action: "pause",
        units: ["experience", "experience"],
        relation: "coexistence",
        answerSource: null,
        responseKind: "pause",
        mainField: "insight"
      },
      {
        id: "SF4-A-EFFECT-01",
        state: "ready",
        action: "complete",
        units: ["change", "result"],
        relation: "change_effect",
        answerSource: null,
        responseKind: "completion",
        mainField: "insight"
      },
      {
        id: "SF4-CORRECTION-READY-01",
        state: "ready",
        action: "complete",
        units: ["change", "result", "scope"],
        relation: "change_effect",
        answerSource: null,
        responseKind: "completion",
        mainField: "insight"
      },
      {
        id: "SF4-LIMITED-01",
        state: "limited",
        action: "honest_limit",
        units: [],
        relation: null,
        answerSource: null,
        responseKind: "honest_limit",
        mainField: "honestLimit"
      }
    ]);
    for (const item of GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES) {
      expect(item.expectedVisibleQuality.perspective).toBe(
        "second_person_or_neutral"
      );
      expect(item.expectedVisibleQuality.mustCover.length).toBeGreaterThan(0);
      expect(item.expectedVisibleQuality.mustAvoid.length).toBeGreaterThan(0);
    }
  });

  it("关系端点、角色方向和证据引用全部受严格解析约束", () => {
    const relationship = GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES.find(
      (item) => item.id === "SF4-R-COEXIST-01"
    )!;
    expect(relationship.expectedSemanticFrame?.relation).toEqual({
      type: "coexistence",
      fromUnitId: "u1",
      toUnitId: "u2"
    });
    const action = GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES.find(
      (item) => item.id === "SF4-A-EFFECT-01"
    )!;
    expect(action.expectedSemanticFrame?.relation).toEqual({
      type: "change_effect",
      fromUnitId: "u1",
      toUnitId: "u2"
    });
    expect(action.expectedSemanticFrame?.units.map((unit) => unit.role)).toEqual([
      "change",
      "result"
    ]);

    const missingEndpoint = mutableDataset();
    mutableFrame(mutableCase(missingEndpoint, "SF4-R-COEXIST-01"))
      .relation!.toUnitId = "u3";
    expect(() => parseGenerativeSemanticFrameV4OfflineDataset(missingEndpoint))
      .toThrow("GENERATIVE_SEMANTIC_FRAME_V4_FRAME_INVALID:SF4-R-COEXIST-01");

    const sameEndpoint = mutableDataset();
    mutableFrame(mutableCase(sameEndpoint, "SF4-R-COEXIST-01"))
      .relation!.toUnitId = "u1";
    expect(() => parseGenerativeSemanticFrameV4OfflineDataset(sameEndpoint))
      .toThrow("GENERATIVE_SEMANTIC_FRAME_V4_FRAME_INVALID:SF4-R-COEXIST-01");

    const wrongChangeRole = mutableDataset();
    mutableFrame(mutableCase(wrongChangeRole, "SF4-A-EFFECT-01"))
      .units[0]!.role = "event";
    expect(() => parseGenerativeSemanticFrameV4OfflineDataset(wrongChangeRole))
      .toThrow("GENERATIVE_SEMANTIC_FRAME_V4_FRAME_INVALID:SF4-A-EFFECT-01");

    const missingEvidence = mutableDataset();
    mutableFrame(mutableCase(missingEvidence, "SF4-A-EFFECT-01"))
      .units[0]!.evidenceRefs = ["missing:1"];
    expect(() => parseGenerativeSemanticFrameV4OfflineDataset(missingEvidence))
      .toThrow(
        "GENERATIVE_SEMANTIC_FRAME_V4_EVIDENCE_REF_MISSING:SF4-A-EFFECT-01:missing:1"
      );
  });

  it("needs_more 的作答来源锚点可逐字追溯，gap 保持内部短语", () => {
    const thought = GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES.find(
      (item) => item.id === "SF4-T-ASK-01"
    )!;
    const questionIntent = thought.expectedQuestionIntent!;
    expect(questionIntent.gap).toBe("停止调整版画位置的具体视觉依据");
    expect(questionIntent.gap).not.toMatch(/[?？你]/u);
    expect(questionIntent.answerSource).toEqual({
      kind: "sensory_detail",
      evidenceRefs: ["new:1"],
      anchorQuote: "退到门口再看时"
    });
    const referencedEvidence = thought.evidenceCatalog.find(
      (evidence) => evidence.ref === questionIntent.answerSource.evidenceRefs[0]
    );
    expect(referencedEvidence?.quote).toContain(
      questionIntent.answerSource.anchorQuote
    );

    const untraceableAnchor = mutableDataset();
    const mutatedIntent = mutableCase(
      untraceableAnchor,
      "SF4-T-ASK-01"
    ).expectedQuestionIntent as {
      gap: string;
      answerSource: { anchorQuote: string };
    };
    mutatedIntent.answerSource.anchorQuote = "画框正好落在墙面中央";
    expect(() => parseGenerativeSemanticFrameV4OfflineDataset(untraceableAnchor))
      .toThrow("GENERATIVE_SEMANTIC_FRAME_V4_ANCHOR_UNTRACEABLE:SF4-T-ASK-01");

    const secondPersonGap = mutableDataset();
    const secondPersonIntent = mutableCase(
      secondPersonGap,
      "SF4-T-ASK-01"
    ).expectedQuestionIntent as {
      gap: string;
    };
    secondPersonIntent.gap = "你看到哪一处后停止调整版画位置";
    expect(() => parseGenerativeSemanticFrameV4OfflineDataset(secondPersonGap))
      .toThrow(
        "GENERATIVE_SEMANTIC_FRAME_V4_QUESTION_INTENT_INVALID:SF4-T-ASK-01"
      );
  });

  it("纠正案撤回旧理解，只用本轮修正证据形成新骨架", () => {
    const correction = GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES.find(
      (item) => item.id === "SF4-CORRECTION-READY-01"
    )!;
    expect(correction.expectedUnderstanding).toMatchObject({
      answerStatus: "correction",
      correctionOrBoundaryKind: "correction"
    });
    expect(correction.expectedUnderstanding.mustCover).toContain(
      "撤回挂钩排密导致房间变暗的旧理解"
    );
    expect(correction.conversationContext[0]?.assistantUnderstanding).toContain(
      "挂钩排得更密"
    );
    expect(correction.currentUserText).toContain("你理解反了");
    expect(v4ProviderPlan(correction.id).understanding.correctionOrBoundary)
      .toEqual({
        kind: "correction",
        reason: "AI 上一轮的旧理解已撤回，按本轮修正更新"
      });
    expect(correction.expectedSemanticFrame).toEqual({
      units: [
        { id: "u1", role: "change", evidenceRefs: ["new:1"] },
        { id: "u2", role: "result", evidenceRefs: ["new:3"] },
        { id: "u3", role: "scope", evidenceRefs: ["new:2", "new:4"] }
      ],
      relation: {
        type: "change_effect",
        fromUnitId: "u1",
        toUnitId: "u2"
      }
    });
    expect(correction.evidenceCatalog.every(
      (evidence) => evidence.source === "current_user"
    )).toBe(true);
    expect(JSON.stringify(correction.evidenceCatalog)).not.toContain("你理解反了");
    expect(JSON.stringify(
      createGenerativeSemanticFrameV4VisibleInputFixture(correction.id)
    )).not.toContain("挂钩排得更密");

    const oldUnderstandingLeak = mutableDataset();
    const mutatedCase = mutableCase(
      oldUnderstandingLeak,
      "SF4-CORRECTION-READY-01"
    );
    (mutatedCase.evidenceCatalog as Array<Record<string, unknown>>).push({
      ref: "SF4-CORRECTION-READY-01-fact-1",
      source: "trusted_fact",
      quote: "我把窗帘挂钩重新排了一遍，现在舒服多了"
    });
    mutableFrame(mutatedCase).units[0]!.evidenceRefs = [
      "SF4-CORRECTION-READY-01-fact-1"
    ];
    expect(() => parseGenerativeSemanticFrameV4OfflineDataset(
      oldUnderstandingLeak
    )).toThrow(
      "GENERATIVE_SEMANTIC_FRAME_V4_CORRECTION_CASE_INVALID:SF4-CORRECTION-READY-01"
    );

    const correctionRecordLost = mutableDataset();
    const understanding = mutableCase(
      correctionRecordLost,
      "SF4-CORRECTION-READY-01"
    ).expectedUnderstanding as Record<string, unknown>;
    understanding.answerStatus = "answered";
    expect(() => parseGenerativeSemanticFrameV4OfflineDataset(
      correctionRecordLost
    )).toThrow(
      "GENERATIVE_SEMANTIC_FRAME_V4_CORRECTION_CASE_INVALID:SF4-CORRECTION-READY-01"
    );
  });

  it("第二段最小输入只携带原生骨架与被引用证据", () => {
    for (const item of GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES) {
      const visibleInput = createGenerativeSemanticFrameV4VisibleInputFixture(
        item.id
      );
      expect(Object.keys(visibleInput).sort()).toEqual([
        "limitReason",
        "questionIntent",
        "semanticFrame",
        "sourceEvidence"
      ]);
      const serialized = JSON.stringify(visibleInput);
      expect(serialized).not.toMatch(
        /"(?:conversationContext|currentUserText|userContext|rawText|recentTurns|effectiveFacts|understandingCard|frozenMetadata|previousQuestion|semanticPlan|responseContract|goal|answerEntry|selectedTargetId|missingUnderstanding)"\s*:/u
      );
      expect(serialized).not.toContain(item.currentUserText);
      expect(visibleInput.sourceEvidence.map((evidence) => evidence.ref).sort())
        .toEqual([...new Set([
          ...(item.expectedSemanticFrame?.units.flatMap(
            (unit) => unit.evidenceRefs
          ) ?? []),
          ...(item.expectedQuestionIntent?.answerSource.evidenceRefs ?? []),
          ...(item.expectedLimitReason?.evidenceRefs ?? [])
      ])].sort());
      expect(typeof visibleInput.limitReason === "string").toBe(false);
      if (visibleInput.questionIntent) {
        expect(visibleInput.questionIntent).not.toHaveProperty("goal");
        expect(visibleInput.questionIntent).not.toHaveProperty("answerEntry");
      }
    }
  });

  it("故事和隐藏质量判尺持续与运行时 Prompt、Few-shot 隔离", () => {
    const promptSource = readFileSync(
      "src/server/services/interview/event-centered-ai.service.ts",
      "utf8"
    );
    const rubricLeakSentinels = [
      "触壁摘镜",
      "问题落到当时看到的一处具体画面或位置",
      "数拍带来的帮助",
      "手不离开琴键",
      "挂钩间距拉开",
      "目前只能确认日历上的“终于”"
    ];
    for (const item of GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES) {
      expect(promptSource).not.toContain(item.scenarioFamily);
      expect(promptSource).not.toContain(item.currentUserText);
      expect(promptSource).not.toContain(item.roundValue);
    }
    for (const anchor of [
      ...GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET.deduplication.storyAnchors,
      ...rubricLeakSentinels
    ]) {
      expect(promptSource).not.toContain(anchor);
    }
    expect(readFileSync(datasetPath, "utf8")).not.toMatch(
      /(?:tone|spice|parcel|语气样例|香料故事|包裹故事)/iu
    );
  });

  it("六条故事锚点在既有开发、隐藏与产物范围保持零复用", () => {
    const allowedFiles = new Set([
      datasetPath,
      "tests/evals/event-centered-generative-semantic-frame-v4-offline.test.ts",
      GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CONFIRMATION_ARTIFACT_PATH
    ]);
    for (const anchor of GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET
      .deduplication.storyAnchors) {
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
      expect(matches.filter((path) => !allowedFiles.has(path))).toEqual([]);
    }
  });

  it("runner 报告原生 v4 字段，同时保留 v3 兼容字段槽位", () => {
    const thought = GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES.find(
      (item) => item.id === "SF4-T-ASK-01"
    )!;
    const breakdown = createGenerativeArchitectureStageBreakdown({
      architecture: "two_call",
      result: {
        attempts: [],
        turn: null,
        semanticArtifact: {
          artifactVersion:
            GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CANDIDATE_VERSIONS.semanticArtifact,
          semanticFrame: thought.expectedSemanticFrame,
          providerQuestionIntent: thought.expectedQuestionIntent,
          providerLimitReason: thought.expectedLimitReason,
          semanticPlan: {
            action: "ask",
            outcomeAssessment: {
              state: "needs_more",
              origin: null
            }
          }
        },
        validationIssues: []
      } as never
    });
    expect(breakdown?.semanticPlan).toMatchObject({
      artifactVersion: "event-centered-semantic-plan.v4",
      semanticFrame: thought.expectedSemanticFrame,
      providerQuestionIntent: thought.expectedQuestionIntent,
      providerLimitReason: null,
      understandingCard: null,
      questionIntent: null,
      limitReason: null
    });
  });

  it("v3 与 v70 历史产物继续只读解析，v70 stop 保持终局", () => {
    const productionEnvBefore = readFileSync(productionEnvPath, "utf8");
    expect(productionEnvBefore).toContain(
      'INTERVIEW_EVENT_CENTERED_MODE="legacy"'
    );
    expect(productionEnvBefore).toContain(
      'INTERVIEW_EVENT_CENTERED_STRATEGY="baseline"'
    );
    const v3Input = readJson(recoveryV3Path);
    const v3Before = JSON.stringify(v3Input);
    const recovery = parseGenerativeRepairProbeRecoveryEnvelope(v3Input);
    expect(recovery.candidateVersions.semanticArtifact).toBe(
      "event-centered-semantic-plan.v3"
    );
    expect(JSON.stringify(v3Input)).toBe(v3Before);

    const v70Input = readJson(reviewedV70Path);
    const v70Before = JSON.stringify(v70Input);
    const reviewedV70 = parseGenerativeV70RootVisibleProbeRunEnvelope(v70Input);
    expect(reviewedV70.candidateVersions.semanticArtifact).toBe(
      "event-centered-semantic-plan.v3"
    );
    expect(JSON.stringify(v70Input)).toBe(v70Before);

    const budgetInput = readJson(v70BudgetPath);
    const budgetBefore = JSON.stringify(budgetInput);
    const budget = parseGenerativeV70RootVisibleProbeBudgetLedger(budgetInput);
    expect(budget.entries[0]?.gateAudit?.decision).toBe("stop");
    expect(JSON.stringify(budgetInput)).toBe(budgetBefore);
    expect(() => auditGenerativeV70RootVisibleProbeRun({
      ledger: budget,
      envelope: reviewedV70,
      auditedAt: "2026-08-01T16:00:00.000Z"
    })).toThrow(
      "GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_AUDIT_ALREADY_FINALIZED"
    );
    expect(readFileSync(productionEnvPath, "utf8")).toBe(productionEnvBefore);
  });

  it("离线确认包完整呈现案例与隐藏判尺，并显式保留独立批准门", () => {
    expect(() => formatGenerativeSemanticFrameV4OfflineConfirmationPackage())
      .toThrow("GENERATIVE_SEMANTIC_FRAME_V4_CANDIDATE_MISMATCH");
    const confirmation = readFileSync(
      GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CONFIRMATION_ARTIFACT_PATH,
      "utf8"
    );
    expect(confirmation).toContain("semanticFrame v4 离线案例确认包");
    expect(confirmation).toContain(GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_FINGERPRINT);
    expect(GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CONFIRMATION_ARTIFACT_PATH).toBe(
      "artifacts/generative-interview-board7/2026-08-01/semantic-frame-v4-offline-case-confirmation.md"
    );
    expect(existsSync(
      "artifacts/generative-interview-board7/2026-08-01/semantic-frame-v4-offline-budget.json"
    )).toBe(false);
    expect(confirmation).toContain("当前模型请求预算：0 次");
    expect(confirmation).toContain(
      "后续运行：本包逐条确认后，再单独生成运行预算并获得明确授权"
    );
    expect(confirmation).toContain("第一层｜产品逐条确认");
    expect(confirmation).toContain("第二层｜预期语义骨架");
    for (const item of GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES) {
      expect(confirmation).toContain(item.id);
      expect(confirmation).toContain(item.roundValue);
      for (const criterion of item.expectedVisibleQuality.mustCover) {
        expect(confirmation).toContain(criterion);
      }
      for (const criterion of item.expectedVisibleQuality.mustAvoid) {
        expect(confirmation).toContain(criterion);
      }
    }
  });
});
