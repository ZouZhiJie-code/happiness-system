import { createHash } from "node:crypto";

import recoveryManifestJson from "../../../../evals/event-centered-generative/board7-mvp-baseline-recovery-v1.json";

import type { GenerativeSingleTurnEvaluationCase } from "@/features/interview/event-centered/generative-evaluation-catalog";
import {
  GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASES,
  GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASE_FINGERPRINT,
  GENERATIVE_MVP_FOUR_ANGLE_SMOKE_SCOPE_FINGERPRINT
} from "@/features/interview/event-centered/generative-mvp-four-angle-smoke";

export const GENERATIVE_MVP_BASELINE_RECOVERY_VERSION =
  "2026-08-02.board7-mvp-baseline-recovery-v1" as const;
export const GENERATIVE_MVP_BASELINE_RECOVERY_RUNTIME_CONFIG = {
  model: "deepseek-v4-flash",
  temperature: 0.2,
  maxTokens: 1500,
  timeoutMs: 12_000,
  thinking: "disabled",
  architecture: "baseline"
} as const;
export const GENERATIVE_MVP_BASELINE_RECOVERY_REQUEST_BUDGET = {
  plannedCases: 2,
  repetitionsPerCase: 1,
  stagesPerCase: 2,
  nominalGenerationRequests: 4,
  generationRequestsMax: 8,
  maxTechnicalAttemptsPerStage: 2
} as const;

type RecoveryManifest = {
  datasetVersion: string;
  parentDatasetVersion: string;
  purpose: string;
  caseIds: string[];
  runPolicy: Record<string, unknown>;
};

function parseManifest(value: unknown): RecoveryManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GENERATIVE_MVP_BASELINE_RECOVERY_MANIFEST_INVALID");
  }
  const manifest = value as RecoveryManifest;
  if (
    manifest.datasetVersion !== GENERATIVE_MVP_BASELINE_RECOVERY_VERSION ||
    !manifest.parentDatasetVersion?.trim() ||
    !manifest.purpose?.trim() ||
    !Array.isArray(manifest.caseIds) ||
    manifest.caseIds.length !== 2 ||
    new Set(manifest.caseIds).size !== 2 ||
    !manifest.runPolicy
  ) {
    throw new Error("GENERATIVE_MVP_BASELINE_RECOVERY_MANIFEST_INVALID");
  }
  return manifest;
}

export const GENERATIVE_MVP_BASELINE_RECOVERY_MANIFEST =
  parseManifest(recoveryManifestJson);

const smokeCasesById = new Map<string, (typeof GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASES)[number]>(
  GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASES.map((item) => [item.id, item])
);
export const GENERATIVE_MVP_BASELINE_RECOVERY_SOURCE_CASES =
  GENERATIVE_MVP_BASELINE_RECOVERY_MANIFEST.caseIds.map((caseId) => {
    const item = smokeCasesById.get(caseId);
    if (!item) throw new Error(`GENERATIVE_MVP_BASELINE_RECOVERY_CASE_MISSING:${caseId}`);
    return item;
  });

export function createGenerativeMvpBaselineRecoveryCase(
  item: (typeof GENERATIVE_MVP_BASELINE_RECOVERY_SOURCE_CASES)[number]
): GenerativeSingleTurnEvaluationCase {
  const phase = item.mode === "guided_reflection"
    ? "guided_reflection" as const
    : "deep_companionship" as const;
  const target = item.currentQuestionTarget;
  const answered = item.expectedUnderstanding.answerStatus === "answered";
  return {
    caseId: item.id,
    scenarioId: item.id,
    scenarioFamily: item.scenarioFamily,
    datasetVersion: GENERATIVE_MVP_BASELINE_RECOVERY_VERSION,
    split: "work",
    source: "synthetic_human_authored",
    layer: "single_turn",
    angle: item.angle,
    mode: item.mode,
    phase,
    decisionMoment: item.expectedDecision.state === "needs_more"
      ? "ask_value"
      : "enough_to_pause",
    severity: "quality_gate",
    conversationContext: item.conversationContext,
    currentQuestion: item.currentQuestion,
    currentQuestionTarget: target,
    currentQuestionSurfaceLevel: "open_anchor",
    currentQuestionIntent: item.currentQuestionIntent,
    currentQuestionCognitiveAction: item.currentQuestionCognitiveAction,
    rawText: item.currentUserText,
    trustedFacts: item.trustedFacts.map((fact) => ({
      id: fact.id,
      statement: fact.statement
    })),
    latestFocus: item.roundValue,
    unresolvedInformation: item.expectedQuestionIntent
      ? [item.expectedQuestionIntent.gap]
      : [],
    acceptableActions: [item.expectedDecision.action],
    valuableTargets: item.expectedQuestionIntent
      ? [item.expectedQuestionIntent.gap]
      : [],
    mustHave: item.expectedVisibleQuality.mustCover,
    mustNot: item.expectedVisibleQuality.mustAvoid,
    askedTargets: target ? [target] : [],
    answeredTargets: answered && target ? [target] : [],
    deniedTargets: [],
    questionOpportunityCount: 1,
    microgoal: item.mode === "deep_conversation"
      ? {
          statement: item.currentQuestionIntent.semanticGoal,
          questionCount: 0,
          status: "active"
        }
      : null
  };
}

export const GENERATIVE_MVP_BASELINE_RECOVERY_CASES =
  GENERATIVE_MVP_BASELINE_RECOVERY_SOURCE_CASES.map(
    createGenerativeMvpBaselineRecoveryCase
  );

export function generativeMvpBaselineRecoveryCaseFingerprint() {
  return createHash("sha256")
    .update(JSON.stringify({
      manifest: GENERATIVE_MVP_BASELINE_RECOVERY_MANIFEST,
      parentCaseFingerprint: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASE_FINGERPRINT,
      cases: GENERATIVE_MVP_BASELINE_RECOVERY_SOURCE_CASES
    }))
    .digest("hex");
}

export const GENERATIVE_MVP_BASELINE_RECOVERY_CASE_FINGERPRINT =
  generativeMvpBaselineRecoveryCaseFingerprint();

export function createGenerativeMvpBaselineRecoveryScope() {
  return {
    datasetVersion: GENERATIVE_MVP_BASELINE_RECOVERY_VERSION,
    parentScopeFingerprint: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_SCOPE_FINGERPRINT,
    caseIds: GENERATIVE_MVP_BASELINE_RECOVERY_CASES.map((item) => item.caseId),
    caseFingerprint: GENERATIVE_MVP_BASELINE_RECOVERY_CASE_FINGERPRINT,
    baselinePromptVersions: {
      understanding: "2026-07-25.event-centered-v2",
      response: "2026-07-25.event-centered-v2"
    },
    runtimeConfig: GENERATIVE_MVP_BASELINE_RECOVERY_RUNTIME_CONFIG,
    requestBudget: GENERATIVE_MVP_BASELINE_RECOVERY_REQUEST_BUDGET
  };
}

export function generativeMvpBaselineRecoveryScopeFingerprint() {
  return createHash("sha256")
    .update(JSON.stringify(createGenerativeMvpBaselineRecoveryScope()))
    .digest("hex");
}

export const GENERATIVE_MVP_BASELINE_RECOVERY_SCOPE_FINGERPRINT =
  generativeMvpBaselineRecoveryScopeFingerprint();

export type GenerativeMvpBaselineRecoveryApproval = {
  approvalType: "board7_mvp_baseline_recovery_run";
  decision: "approved";
  approvedBy: "product_owner";
  approvedAt: string;
  confirmationText: string;
  taskId: string;
  scopeFingerprint: string;
  datasetVersion: typeof GENERATIVE_MVP_BASELINE_RECOVERY_VERSION;
  caseFingerprint: string;
  model: typeof GENERATIVE_MVP_BASELINE_RECOVERY_RUNTIME_CONFIG.model;
};

export function validateGenerativeMvpBaselineRecoveryApproval(
  value: unknown
): GenerativeMvpBaselineRecoveryApproval {
  const approval = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  if (
    !approval ||
    approval.approvalType !== "board7_mvp_baseline_recovery_run" ||
    approval.decision !== "approved" ||
    approval.approvedBy !== "product_owner" ||
    typeof approval.approvedAt !== "string" ||
    !Number.isFinite(Date.parse(approval.approvedAt)) ||
    typeof approval.confirmationText !== "string" ||
    approval.confirmationText.trim().length < 2 ||
    typeof approval.taskId !== "string" ||
    !approval.taskId.trim() ||
    approval.scopeFingerprint !== generativeMvpBaselineRecoveryScopeFingerprint() ||
    approval.datasetVersion !== GENERATIVE_MVP_BASELINE_RECOVERY_VERSION ||
    approval.caseFingerprint !== GENERATIVE_MVP_BASELINE_RECOVERY_CASE_FINGERPRINT ||
    approval.model !== GENERATIVE_MVP_BASELINE_RECOVERY_RUNTIME_CONFIG.model
  ) {
    throw new Error("GENERATIVE_MVP_BASELINE_RECOVERY_APPROVAL_INVALID");
  }
  return approval as unknown as GenerativeMvpBaselineRecoveryApproval;
}

export type GenerativeMvpBaselineRecoveryRequest = {
  caseId: string;
  stage: "understanding" | "response";
  attemptIndex: 1 | 2;
};

export type GenerativeMvpBaselineRecoveryLedger = {
  scopeFingerprint: string;
  status: "running" | "completed" | "aborted";
  requests: GenerativeMvpBaselineRecoveryRequest[];
};

export function createGenerativeMvpBaselineRecoveryLedger():
GenerativeMvpBaselineRecoveryLedger {
  return {
    scopeFingerprint: GENERATIVE_MVP_BASELINE_RECOVERY_SCOPE_FINGERPRINT,
    status: "running",
    requests: []
  };
}

export function reserveGenerativeMvpBaselineRecoveryRequest(
  ledger: GenerativeMvpBaselineRecoveryLedger,
  request: GenerativeMvpBaselineRecoveryRequest
): GenerativeMvpBaselineRecoveryLedger {
  const allowedCaseIds = new Set(
    GENERATIVE_MVP_BASELINE_RECOVERY_CASES.map((item) => item.caseId)
  );
  const stageRequests = ledger.requests.filter((item) =>
    item.caseId === request.caseId && item.stage === request.stage
  );
  if (
    ledger.status !== "running" ||
    ledger.scopeFingerprint !== GENERATIVE_MVP_BASELINE_RECOVERY_SCOPE_FINGERPRINT ||
    !allowedCaseIds.has(request.caseId) ||
    stageRequests.length >= 2 ||
    request.attemptIndex !== stageRequests.length + 1 ||
    ledger.requests.length >=
      GENERATIVE_MVP_BASELINE_RECOVERY_REQUEST_BUDGET.generationRequestsMax
  ) {
    throw new Error("GENERATIVE_MVP_BASELINE_RECOVERY_REQUEST_BUDGET_EXHAUSTED");
  }
  return {
    ...ledger,
    requests: [...ledger.requests, request]
  };
}
