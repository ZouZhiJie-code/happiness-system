import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  abortGenerativeSemanticFrameV5FirstPassRun,
  completeGenerativeSemanticFrameV5FirstPassRun,
  consumeGenerativeSemanticFrameV5UnknownAttempts,
  createGenerativeSemanticFrameV5FirstPassPendingBudget,
  generativeSemanticFrameV5FirstPassScopeFingerprint,
  GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_APPROVAL_VERSION,
  GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_BUDGET_VERSION,
  GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_CASE_IDS,
  GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RUNTIME_CONFIG,
  markGenerativeSemanticFrameV5FirstPassCaseTerminal,
  parseGenerativeSemanticFrameV5FirstPassBudget,
  reserveGenerativeSemanticFrameV5FirstPassAttempt,
  reserveGenerativeSemanticFrameV5FirstPassPreflight,
  reserveGenerativeSemanticFrameV5FirstPassRun,
  settleGenerativeSemanticFrameV5FirstPassAttempt,
  validateGenerativeSemanticFrameV5FirstPassApproval,
  type GenerativeSemanticFrameV5FirstPassApproval,
  type GenerativeSemanticFrameV5FirstPassBudget
} from "@/features/interview/event-centered/generative-v72-first-pass";
import {
  GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CANDIDATE_VERSIONS,
  GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASE_FINGERPRINT,
  GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_DATASET_VERSION
} from "@/features/interview/event-centered/generative-evaluation-runner";

const now = "2026-08-02T12:00:00.000Z";
const privateArtifactRoot =
  "artifacts/generative-interview-board7/2026-08-02";
const hasPrivateHistoricalArtifacts = [
  `${privateArtifactRoot}/board7-provider-v72-semantic-frame-first-pass-budget-v2.json`,
  `${privateArtifactRoot}/board7-provider-v72-semantic-frame-first-pass-v2-approval.json`
].every(existsSync);

function approval(): GenerativeSemanticFrameV5FirstPassApproval {
  return {
    approvalType: "board7_provider_v72_semantic_frame_first_pass_run",
    approvalVersion: GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_APPROVAL_VERSION,
    decision: "approved",
    approvedBy: "product_owner",
    approvedAt: now,
    confirmationText: "确认并授权冻结六例首轮真实模型验证",
    taskId: "codex-board7-v72-semantic-frame-first-pass-2026-08-02",
    budgetVersion: GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_BUDGET_VERSION,
    scopeFingerprint: generativeSemanticFrameV5FirstPassScopeFingerprint(),
    datasetVersion: GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_DATASET_VERSION,
    caseFingerprint: GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASE_FINGERPRINT,
    caseIds: [...GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_CASE_IDS],
    candidateVersions: {
      ...GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CANDIDATE_VERSIONS
    },
    model: GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RUNTIME_CONFIG.model
  };
}

function historicalReservedBudget(): GenerativeSemanticFrameV5FirstPassBudget {
  const pending = createGenerativeSemanticFrameV5FirstPassPendingBudget();
  return {
    ...pending,
    status: "reserved",
    approval: approval(),
    reservation: {
      reservationId: "v72-reservation",
      runOrdinal: 1,
      reservedAt: now,
      completedAt: null,
      status: "reserved",
      preflightRequests: 0,
      attempts: [],
      caseTerminals: [],
      executionOutcome: null,
      runEnvelopeFingerprint: null,
      error: null
    }
  };
}

function settle(input: {
  budget: GenerativeSemanticFrameV5FirstPassBudget;
  caseId: string;
  stage: "semantic" | "visible";
  attemptIndex?: 1 | 2;
  outcome: "valid" | "technical_failure";
}) {
  const attemptIndex = input.attemptIndex ?? 1;
  const reserved = reserveGenerativeSemanticFrameV5FirstPassAttempt({
    budget: input.budget,
    reservationId: "v72-reservation",
    caseId: input.caseId,
    stage: input.stage,
    attemptIndex,
    reservedAt: now
  });
  return settleGenerativeSemanticFrameV5FirstPassAttempt({
    budget: reserved,
    reservationId: "v72-reservation",
    caseId: input.caseId,
    stage: input.stage,
    attemptIndex,
    outcome: input.outcome,
    settledAt: now,
    errorCode: input.outcome === "technical_failure" ? "INVALID_SCHEMA" : null
  });
}

describe.skipIf(!hasPrivateHistoricalArtifacts)("Provider v72 六例首轮独立运行门（历史资产）", () => {
  it("冻结新候选、六例和独立授权，拒绝旧账本身份", () => {
    const budget = createGenerativeSemanticFrameV5FirstPassPendingBudget();
    expect(budget.status).toBe("pending");
    expect(budget.caseIds).toEqual(GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_CASE_IDS);
    expect(budget.requestBudget).toEqual({
      plannedCases: 6,
      stagesPerCase: 2,
      nominalGenerationRequests: 12,
      generationRequestsMax: 24,
      readOnlyModelsPreflightMax: 1
    });
    expect(budget.runPolicy).toMatchObject({
      replacesInfrastructureVoidBudget:
        "board7-provider-v72-semantic-frame-first-pass-budget-v1",
      replacedBudgetProviderRequests: 0
    });
    expect(validateGenerativeSemanticFrameV5FirstPassApproval(approval()))
      .toEqual(approval());
    expect(() => reserveGenerativeSemanticFrameV5FirstPassRun({
      budget,
      approval: approval(),
      reservationId: "v72-reservation",
      reservedAt: now
    })).toThrow("GENERATIVE_SEMANTIC_FRAME_V5_CANDIDATE_MISMATCH");
    expect(() => parseGenerativeSemanticFrameV5FirstPassBudget({
      ...budget,
      ledgerVersion: "board7-provider-v71-semantic-frame-first-pass-budget-v1"
    })).toThrow("BUDGET_IDENTITY_MISMATCH");
  });

  it("本次产品确认和独立授权写入独立账本并保持身份一致", () => {
    const artifactRoot =
      "artifacts/generative-interview-board7/2026-08-02";
    const persistedBudget = JSON.parse(readFileSync(
      `${artifactRoot}/board7-provider-v72-semantic-frame-first-pass-budget-v2.json`,
      "utf8"
    ));
    const persistedApproval = JSON.parse(readFileSync(
      `${artifactRoot}/board7-provider-v72-semantic-frame-first-pass-v2-approval.json`,
      "utf8"
    ));

    expect(parseGenerativeSemanticFrameV5FirstPassBudget(persistedBudget))
      .toMatchObject({
        ledgerVersion: GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_BUDGET_VERSION,
        scopeFingerprint: generativeSemanticFrameV5FirstPassScopeFingerprint()
      });
    expect(validateGenerativeSemanticFrameV5FirstPassApproval(persistedApproval))
      .toMatchObject({
        decision: "approved",
        confirmationText: "没问题，继续；确认并授权冻结六例首轮真实模型验证"
      });
  });

  it("单次预检和每阶段两次技术尝试受账本约束", () => {
    let budget: GenerativeSemanticFrameV5FirstPassBudget =
      historicalReservedBudget();
    budget = reserveGenerativeSemanticFrameV5FirstPassPreflight({
      budget,
      reservationId: "v72-reservation"
    });
    expect(() => reserveGenerativeSemanticFrameV5FirstPassPreflight({
      budget,
      reservationId: "v72-reservation"
    })).toThrow("PREFLIGHT_BUDGET_EXCEEDED");

    const caseId = GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_CASE_IDS[0]!;
    budget = settle({
      budget,
      caseId,
      stage: "semantic",
      outcome: "technical_failure"
    });
    expect(() => reserveGenerativeSemanticFrameV5FirstPassAttempt({
      budget,
      reservationId: "v72-reservation",
      caseId,
      stage: "semantic",
      attemptIndex: 1,
      reservedAt: now
    })).toThrow("DUPLICATE_ATTEMPT");
    budget = settle({
      budget,
      caseId,
      stage: "semantic",
      attemptIndex: 2,
      outcome: "valid"
    });
    expect(budget.reservation?.attempts).toHaveLength(2);
  });

  it("恢复时把状态不明请求记为已消耗，仍可使用剩余一次尝试", () => {
    const caseId = GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_CASE_IDS[0]!;
    let budget: GenerativeSemanticFrameV5FirstPassBudget =
      reserveGenerativeSemanticFrameV5FirstPassAttempt({
        budget: historicalReservedBudget(),
        reservationId: "v72-reservation",
        caseId,
        stage: "semantic",
        attemptIndex: 1,
        reservedAt: now
      });
    budget = consumeGenerativeSemanticFrameV5UnknownAttempts({
      budget,
      reservationId: "v72-reservation",
      settledAt: now
    });
    expect(budget.reservation?.attempts[0]).toMatchObject({
      status: "technical_failure",
      errorCode: "RECOVERY_UNKNOWN_REQUEST_CONSUMED"
    });
    expect(() => reserveGenerativeSemanticFrameV5FirstPassAttempt({
      budget,
      reservationId: "v72-reservation",
      caseId,
      stage: "semantic",
      attemptIndex: 2,
      reservedAt: now
    })).not.toThrow();
  });

  it("六例全部到达终态即可完成，技术失败与运行中止分开记录", () => {
    let budget: GenerativeSemanticFrameV5FirstPassBudget =
      historicalReservedBudget();
    for (const [index, caseId] of GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_CASE_IDS.entries()) {
      if (index === 0) {
        budget = settle({
          budget,
          caseId,
          stage: "semantic",
          outcome: "technical_failure"
        });
        budget = markGenerativeSemanticFrameV5FirstPassCaseTerminal({
          budget,
          reservationId: "v72-reservation",
          caseId,
          status: "semantic_failed",
          completedAt: now,
          errorCode: "INVALID_SCHEMA"
        });
        continue;
      }
      budget = settle({ budget, caseId, stage: "semantic", outcome: "valid" });
      budget = settle({ budget, caseId, stage: "visible", outcome: "valid" });
      budget = markGenerativeSemanticFrameV5FirstPassCaseTerminal({
        budget,
        reservationId: "v72-reservation",
        caseId,
        status: "complete",
        completedAt: now
      });
    }
    const completed = completeGenerativeSemanticFrameV5FirstPassRun({
      budget,
      reservationId: "v72-reservation",
      completedAt: now,
      runEnvelopeFingerprint: "a".repeat(64)
    });
    expect(completed.status).toBe("completed");
    expect(completed.reservation?.executionOutcome).toBe("technical_failed");
    expect(() => reserveGenerativeSemanticFrameV5FirstPassRun({
      budget: completed,
      approval: approval(),
      reservationId: "second-run",
      reservedAt: now
    })).toThrow("BUDGET_ALREADY_CONSUMED");
  });

  it("基础设施异常收口为 aborted，并结算状态不明请求", () => {
    const caseId = GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_CASE_IDS[0]!;
    const reservedAttempt = reserveGenerativeSemanticFrameV5FirstPassAttempt({
      budget: historicalReservedBudget(),
      reservationId: "v72-reservation",
      caseId,
      stage: "semantic",
      attemptIndex: 1,
      reservedAt: now
    });
    const aborted = abortGenerativeSemanticFrameV5FirstPassRun({
      budget: reservedAttempt,
      reservationId: "v72-reservation",
      completedAt: now,
      error: "PROVIDER_PREFLIGHT_FAILED"
    });
    expect(aborted.status).toBe("aborted");
    expect(aborted.reservation?.attempts[0]?.status).toBe("technical_failure");
    expect(parseGenerativeSemanticFrameV5FirstPassBudget(aborted)).toEqual(aborted);
  });
});
