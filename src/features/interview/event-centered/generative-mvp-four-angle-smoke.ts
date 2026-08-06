import { createHash } from "node:crypto";

import smokeManifestJson from "../../../../evals/event-centered-generative/board7-mvp-four-angle-smoke-v1.json";

import {
  GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CANDIDATE_VERSIONS,
  GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASES,
  type GenerativeSemanticFrameV5OfflineCase
} from "@/features/interview/event-centered/generative-evaluation-runner";
import type { EventCenteredGenerativeGenerationInput } from "@/server/services/interview/event-centered-ai.service";

export const GENERATIVE_MVP_FOUR_ANGLE_SMOKE_VERSION =
  "2026-08-02.board7-mvp-four-angle-smoke-v1" as const;
export const GENERATIVE_MVP_FOUR_ANGLE_SMOKE_RUNTIME_CONFIG = {
  model: "deepseek-v4-flash",
  temperature: 0.2,
  maxTokens: 1500,
  timeoutMs: 12_000,
  thinking: "disabled",
  architecture: "two_call"
} as const;
export const GENERATIVE_MVP_FOUR_ANGLE_SMOKE_REQUEST_BUDGET = {
  plannedCases: 4,
  repetitionsPerCase: 1,
  stagesPerCase: 2,
  nominalGenerationRequests: 8,
  generationRequestsMax: 16,
  maxTechnicalAttemptsPerStage: 2,
  readOnlyModelsPreflightMax: 1
} as const;

type Manifest = {
  datasetVersion: string;
  baseDatasetVersion: string;
  purpose: string;
  caseIds: string[];
  gates: Record<string, unknown>;
  runPolicy: Record<string, unknown>;
};

function parseManifest(value: unknown): Manifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GENERATIVE_MVP_FOUR_ANGLE_SMOKE_MANIFEST_INVALID");
  }
  const manifest = value as Manifest;
  if (
    manifest.datasetVersion !== GENERATIVE_MVP_FOUR_ANGLE_SMOKE_VERSION ||
    !manifest.baseDatasetVersion?.trim() ||
    !manifest.purpose?.trim() ||
    !Array.isArray(manifest.caseIds) ||
    manifest.caseIds.length !== 4 ||
    new Set(manifest.caseIds).size !== 4 ||
    !manifest.gates ||
    !manifest.runPolicy
  ) {
    throw new Error("GENERATIVE_MVP_FOUR_ANGLE_SMOKE_MANIFEST_INVALID");
  }
  return manifest;
}

export const GENERATIVE_MVP_FOUR_ANGLE_SMOKE_MANIFEST =
  parseManifest(smokeManifestJson);

const sourceCasesById = new Map<string, (typeof GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASES)[number]>(
  GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASES.map((item) => [item.id, item])
);

export const GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASES =
  GENERATIVE_MVP_FOUR_ANGLE_SMOKE_MANIFEST.caseIds.map((caseId) => {
    const item = sourceCasesById.get(caseId);
    if (!item) throw new Error(`GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASE_MISSING:${caseId}`);
    return item;
  });

export function createGenerativeMvpFourAngleSmokeInput(
  caseItem: GenerativeSemanticFrameV5OfflineCase
): EventCenteredGenerativeGenerationInput {
  return {
    rawText: caseItem.currentUserText,
    phase: caseItem.mode === "guided_reflection"
      ? "guided_reflection"
      : "deep_companionship",
    activeAngle: caseItem.angle,
    currentQuestion: caseItem.currentQuestion,
    currentQuestionTarget: caseItem.currentQuestionTarget,
    currentQuestionIntent: caseItem.currentQuestionIntent,
    currentQuestionSurfaceLevel: "open_anchor",
    currentQuestionCognitiveAction: caseItem.currentQuestionCognitiveAction,
    facts: caseItem.trustedFacts.map((fact, index) => ({
      id: fact.id,
      eventId: `mvp-four-angle-${caseItem.id}`,
      createdBranchSessionId: "evaluation-branch",
      pathAnchorMessageId: `evaluation-message-${index + 1}`,
      createdByRevisionId: null,
      statement: fact.statement,
      scope: "current_event" as const,
      stance: "affirmed" as const,
      kind: "event_detail" as const,
      origin: "user_expression" as const,
      createdAt: "2026-08-02T00:00:00.000Z",
      evidence: [{
        id: `${fact.id}-evidence`,
        factId: fact.id,
        sourceTurnId: "evaluation-prior-turn",
        contextMessageId: null,
        pathAnchorMessageId: `evaluation-message-${index + 1}`,
        role: "direct_expression" as const,
        quote: fact.sourceQuote,
        createdAt: "2026-08-02T00:00:00.000Z"
      }]
    })),
    recentTurns: caseItem.conversationContext,
    askedTargets: [],
    answeredTargets: [],
    deniedTargets: [],
    guidedQuestionOpportunityCount: 1,
    microgoal: caseItem.mode === "deep_conversation"
      ? {
          statement: caseItem.currentQuestionIntent.semanticGoal,
          questionCount: 0,
          status: "active",
          evidenceRefs: []
        }
      : null,
    maxTokens: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_RUNTIME_CONFIG.maxTokens,
    timeoutMs: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_RUNTIME_CONFIG.timeoutMs
  };
}

const expectedAngles = ["feeling", "thought", "relationship", "action"];
if (
  JSON.stringify(GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASES.map((item) => item.angle)) !==
  JSON.stringify(expectedAngles)
) {
  throw new Error("GENERATIVE_MVP_FOUR_ANGLE_SMOKE_ANGLE_COVERAGE_INVALID");
}

export const GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CANDIDATE_VERSIONS =
  GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CANDIDATE_VERSIONS;

function resolvedDataset() {
  return {
    manifest: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_MANIFEST,
    candidateVersions: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CANDIDATE_VERSIONS,
    cases: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASES
  };
}

export function generativeMvpFourAngleSmokeCaseFingerprint() {
  return createHash("sha256")
    .update(JSON.stringify(resolvedDataset()))
    .digest("hex");
}

export const GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASE_FINGERPRINT =
  "afb893143329fd6b7d62190f9ef0e61b5b987122f66a8ce8e3297672dc89cee2" as const;
if (
  generativeMvpFourAngleSmokeCaseFingerprint() !==
  GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASE_FINGERPRINT
) {
  throw new Error("GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASE_FINGERPRINT_MISMATCH");
}

export function createGenerativeMvpFourAngleSmokeScope() {
  return {
    datasetVersion: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_VERSION,
    caseIds: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASES.map((item) => item.id),
    caseFingerprint: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASE_FINGERPRINT,
    candidateVersions: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CANDIDATE_VERSIONS,
    runtimeConfig: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_RUNTIME_CONFIG,
    requestBudget: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_REQUEST_BUDGET
  };
}

export function generativeMvpFourAngleSmokeScopeFingerprint() {
  return createHash("sha256")
    .update(JSON.stringify(createGenerativeMvpFourAngleSmokeScope()))
    .digest("hex");
}

export const GENERATIVE_MVP_FOUR_ANGLE_SMOKE_SCOPE_FINGERPRINT =
  "65052d7dbe9cec8d6ad71922808b87d3b3d762295d15ef981425dd4171c72eb3" as const;
if (
  generativeMvpFourAngleSmokeScopeFingerprint() !==
  GENERATIVE_MVP_FOUR_ANGLE_SMOKE_SCOPE_FINGERPRINT
) {
  throw new Error("GENERATIVE_MVP_FOUR_ANGLE_SMOKE_SCOPE_FINGERPRINT_MISMATCH");
}

export type GenerativeMvpFourAngleSmokeApproval = {
  approvalType: "board7_mvp_four_angle_smoke_run";
  decision: "approved";
  approvedBy: "product_owner";
  approvedAt: string;
  confirmationText: string;
  taskId: string;
  scopeFingerprint: string;
  datasetVersion: typeof GENERATIVE_MVP_FOUR_ANGLE_SMOKE_VERSION;
  caseFingerprint: string;
  model: typeof GENERATIVE_MVP_FOUR_ANGLE_SMOKE_RUNTIME_CONFIG.model;
};

export function validateGenerativeMvpFourAngleSmokeApproval(
  value: unknown
): GenerativeMvpFourAngleSmokeApproval {
  const approval = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  if (
    !approval ||
    approval.approvalType !== "board7_mvp_four_angle_smoke_run" ||
    approval.decision !== "approved" ||
    approval.approvedBy !== "product_owner" ||
    typeof approval.approvedAt !== "string" ||
    !Number.isFinite(Date.parse(approval.approvedAt)) ||
    typeof approval.confirmationText !== "string" ||
    approval.confirmationText.trim().length < 2 ||
    typeof approval.taskId !== "string" ||
    !approval.taskId.trim() ||
    approval.scopeFingerprint !== generativeMvpFourAngleSmokeScopeFingerprint() ||
    approval.datasetVersion !== GENERATIVE_MVP_FOUR_ANGLE_SMOKE_VERSION ||
    approval.caseFingerprint !== GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASE_FINGERPRINT ||
    approval.model !== GENERATIVE_MVP_FOUR_ANGLE_SMOKE_RUNTIME_CONFIG.model
  ) {
    throw new Error("GENERATIVE_MVP_FOUR_ANGLE_SMOKE_APPROVAL_INVALID");
  }
  return approval as unknown as GenerativeMvpFourAngleSmokeApproval;
}

export type GenerativeMvpFourAngleSmokeRequest = {
  caseId: string;
  stage: "semantic" | "visible";
  attemptIndex: 1 | 2;
};

export type GenerativeMvpFourAngleSmokeLedger = {
  scopeFingerprint: string;
  status: "reserved" | "completed" | "aborted";
  preflightRequests: number;
  requests: GenerativeMvpFourAngleSmokeRequest[];
};

export function createGenerativeMvpFourAngleSmokeLedger():
GenerativeMvpFourAngleSmokeLedger {
  return {
    scopeFingerprint: generativeMvpFourAngleSmokeScopeFingerprint(),
    status: "reserved",
    preflightRequests: 0,
    requests: []
  };
}

export function reserveGenerativeMvpFourAngleSmokePreflight(
  ledger: GenerativeMvpFourAngleSmokeLedger
) {
  if (
    ledger.status !== "reserved" ||
    ledger.preflightRequests >=
      GENERATIVE_MVP_FOUR_ANGLE_SMOKE_REQUEST_BUDGET.readOnlyModelsPreflightMax
  ) {
    throw new Error("GENERATIVE_MVP_FOUR_ANGLE_SMOKE_PREFLIGHT_BUDGET_EXHAUSTED");
  }
  return { ...ledger, preflightRequests: ledger.preflightRequests + 1 };
}

export function reserveGenerativeMvpFourAngleSmokeRequest(
  ledger: GenerativeMvpFourAngleSmokeLedger,
  request: GenerativeMvpFourAngleSmokeRequest
) {
  const caseIds = new Set(GENERATIVE_MVP_FOUR_ANGLE_SMOKE_MANIFEST.caseIds);
  const duplicate = ledger.requests.some((item) =>
    item.caseId === request.caseId &&
    item.stage === request.stage &&
    item.attemptIndex === request.attemptIndex
  );
  const stageAttempts = ledger.requests.filter((item) =>
    item.caseId === request.caseId && item.stage === request.stage
  ).length;
  if (
    ledger.status !== "reserved" ||
    !caseIds.has(request.caseId) ||
    !["semantic", "visible"].includes(request.stage) ||
    ![1, 2].includes(request.attemptIndex) ||
    duplicate ||
    stageAttempts >=
      GENERATIVE_MVP_FOUR_ANGLE_SMOKE_REQUEST_BUDGET.maxTechnicalAttemptsPerStage ||
    ledger.requests.length >=
      GENERATIVE_MVP_FOUR_ANGLE_SMOKE_REQUEST_BUDGET.generationRequestsMax
  ) {
    throw new Error("GENERATIVE_MVP_FOUR_ANGLE_SMOKE_REQUEST_BUDGET_EXHAUSTED");
  }
  return { ...ledger, requests: [...ledger.requests, request] };
}
