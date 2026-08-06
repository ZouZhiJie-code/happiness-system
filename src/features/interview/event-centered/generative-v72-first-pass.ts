import { createHash } from "node:crypto";

import {
  assertGenerativeSemanticFrameV5CandidateActive,
  GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CANDIDATE_VERSIONS,
  GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASE_FINGERPRINT,
  GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASES,
  GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_DATASET_VERSION
} from "./generative-evaluation-runner";

export const GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_BUDGET_VERSION =
  "board7-provider-v72-semantic-frame-first-pass-budget-v2" as const;
export const GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_APPROVAL_VERSION =
  "board7-provider-v72-semantic-frame-first-pass-approval-v2" as const;
export const GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_BUDGET_ARTIFACT_PATH =
  "artifacts/generative-interview-board7/2026-08-02/board7-provider-v72-semantic-frame-first-pass-budget-v2.json" as const;
export const GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_CASE_IDS =
  GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASES.map((item) => item.id);
export const GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RUNTIME_CONFIG = {
  model: "deepseek-v4-flash",
  temperature: 0.2,
  maxTokens: 1500,
  timeoutMs: 12_000,
  maxRequestsPerTurn: 4,
  maxTechnicalRetriesPerStage: 1,
  architecture: "two_call",
  thinking: "disabled"
} as const;
export const GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_REQUEST_BUDGET = {
  plannedCases: 6,
  stagesPerCase: 2,
  nominalGenerationRequests: 12,
  generationRequestsMax: 24,
  readOnlyModelsPreflightMax: 1
} as const;
export const GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RUN_POLICY = {
  firstPassOnly: true,
  replacesInfrastructureVoidBudget:
    "board7-provider-v72-semantic-frame-first-pass-budget-v1",
  replacedBudgetProviderRequests: 0,
  continueAfterCaseTechnicalFailure: true,
  validLowQualityRetryAllowed: false,
  automaticSecondRoundAllowed: false,
  promptTuningAllowed: false,
  hiddenSetRunAllowed: false,
  workSetRunAllowed: false
} as const;

type CaseId = (typeof GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASES)[number]["id"];
type Stage = "semantic" | "visible";

export type GenerativeSemanticFrameV5FirstPassApproval = {
  approvalType: "board7_provider_v72_semantic_frame_first_pass_run";
  approvalVersion: typeof GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_APPROVAL_VERSION;
  decision: "approved";
  approvedBy: "product_owner";
  approvedAt: string;
  confirmationText: string;
  taskId: string;
  budgetVersion: typeof GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_BUDGET_VERSION;
  scopeFingerprint: string;
  datasetVersion: typeof GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_DATASET_VERSION;
  caseFingerprint: string;
  caseIds: string[];
  candidateVersions: typeof GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CANDIDATE_VERSIONS;
  model: typeof GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RUNTIME_CONFIG.model;
};

export type GenerativeSemanticFrameV5FirstPassAttempt = {
  caseId: CaseId;
  stage: Stage;
  attemptIndex: 1 | 2;
  status: "reserved" | "valid" | "technical_failure";
  reservedAt: string;
  settledAt: string | null;
  errorCode: string | null;
};

export type GenerativeSemanticFrameV5FirstPassCaseTerminal = {
  caseId: CaseId;
  status: "complete" | "semantic_failed" | "visible_failed";
  completedAt: string;
  errorCode: string | null;
};

export type GenerativeSemanticFrameV5FirstPassReservation = {
  reservationId: string;
  runOrdinal: 1;
  reservedAt: string;
  completedAt: string | null;
  status: "reserved" | "completed" | "aborted";
  preflightRequests: number;
  attempts: GenerativeSemanticFrameV5FirstPassAttempt[];
  caseTerminals: GenerativeSemanticFrameV5FirstPassCaseTerminal[];
  executionOutcome: "technical_complete" | "technical_failed" | null;
  runEnvelopeFingerprint: string | null;
  error: string | null;
};

export function createGenerativeSemanticFrameV5FirstPassScope() {
  return {
    datasetVersion: GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_DATASET_VERSION,
    caseIds: [...GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_CASE_IDS],
    caseFingerprint: GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASE_FINGERPRINT,
    candidateVersions: {
      ...GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CANDIDATE_VERSIONS
    },
    runtimeConfig: {
      ...GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RUNTIME_CONFIG
    },
    runLimit: 1 as const,
    requestBudget: {
      ...GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_REQUEST_BUDGET
    },
    runPolicy: {
      ...GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RUN_POLICY
    }
  };
}

export function generativeSemanticFrameV5FirstPassScopeFingerprint() {
  return createHash("sha256")
    .update(JSON.stringify(createGenerativeSemanticFrameV5FirstPassScope()))
    .digest("hex");
}

export type GenerativeSemanticFrameV5FirstPassBudget =
  ReturnType<typeof createGenerativeSemanticFrameV5FirstPassScope> & {
    ledgerVersion: typeof GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_BUDGET_VERSION;
    status: "pending" | "approved" | "reserved" | "completed" | "aborted";
    scopeFingerprint: string;
    approval: GenerativeSemanticFrameV5FirstPassApproval | null;
    reservation: GenerativeSemanticFrameV5FirstPassReservation | null;
  };

export function createGenerativeSemanticFrameV5FirstPassPendingBudget():
GenerativeSemanticFrameV5FirstPassBudget {
  return {
    ledgerVersion: GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_BUDGET_VERSION,
    status: "pending",
    scopeFingerprint: generativeSemanticFrameV5FirstPassScopeFingerprint(),
    ...createGenerativeSemanticFrameV5FirstPassScope(),
    approval: null,
    reservation: null
  };
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isCaseId(value: unknown): value is CaseId {
  return typeof value === "string" &&
    GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_CASE_IDS.includes(value as CaseId);
}

export function validateGenerativeSemanticFrameV5FirstPassApproval(
  value: unknown
): GenerativeSemanticFrameV5FirstPassApproval {
  const container = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  const candidate = container?.approval && typeof container.approval === "object"
    ? container.approval as Record<string, unknown>
    : container;
  if (
    !candidate ||
    candidate.approvalType !== "board7_provider_v72_semantic_frame_first_pass_run" ||
    candidate.approvalVersion !== GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_APPROVAL_VERSION ||
    candidate.decision !== "approved" ||
    candidate.approvedBy !== "product_owner" ||
    !isTimestamp(candidate.approvedAt) ||
    typeof candidate.confirmationText !== "string" ||
    candidate.confirmationText.trim().length < 2 ||
    candidate.confirmationText.trim().length > 300 ||
    typeof candidate.taskId !== "string" ||
    !candidate.taskId.trim() ||
    candidate.taskId.length > 200 ||
    candidate.budgetVersion !== GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_BUDGET_VERSION ||
    candidate.scopeFingerprint !== generativeSemanticFrameV5FirstPassScopeFingerprint() ||
    candidate.datasetVersion !== GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_DATASET_VERSION ||
    candidate.caseFingerprint !== GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASE_FINGERPRINT ||
    JSON.stringify(candidate.caseIds) !==
      JSON.stringify(GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_CASE_IDS) ||
    JSON.stringify(candidate.candidateVersions) !==
      JSON.stringify(GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CANDIDATE_VERSIONS) ||
    candidate.model !== GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RUNTIME_CONFIG.model
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_APPROVAL_INVALID");
  }
  return candidate as unknown as GenerativeSemanticFrameV5FirstPassApproval;
}

function validateReservation(
  reservation: GenerativeSemanticFrameV5FirstPassReservation,
  budgetStatus: GenerativeSemanticFrameV5FirstPassBudget["status"]
) {
  if (
    !reservation.reservationId?.trim() ||
    reservation.runOrdinal !== 1 ||
    !isTimestamp(reservation.reservedAt) ||
    reservation.status !== budgetStatus ||
    !Number.isInteger(reservation.preflightRequests) ||
    reservation.preflightRequests < 0 ||
    reservation.preflightRequests >
      GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_REQUEST_BUDGET.readOnlyModelsPreflightMax ||
    !Array.isArray(reservation.attempts) ||
    reservation.attempts.length >
      GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_REQUEST_BUDGET.generationRequestsMax ||
    !Array.isArray(reservation.caseTerminals)
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RESERVATION_INVALID");
  }
  const attemptKeys = new Set<string>();
  for (const attempt of reservation.attempts) {
    const key = `${attempt.caseId}:${attempt.stage}:${attempt.attemptIndex}`;
    if (
      !isCaseId(attempt.caseId) ||
      !["semantic", "visible"].includes(attempt.stage) ||
      ![1, 2].includes(attempt.attemptIndex) ||
      !["reserved", "valid", "technical_failure"].includes(attempt.status) ||
      !isTimestamp(attempt.reservedAt) ||
      attemptKeys.has(key) ||
      (attempt.status === "reserved" && attempt.settledAt !== null) ||
      (attempt.status !== "reserved" && !isTimestamp(attempt.settledAt)) ||
      (attempt.status === "technical_failure" && !attempt.errorCode?.trim()) ||
      (attempt.status === "valid" && attempt.errorCode !== null)
    ) {
      throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_ATTEMPT_INVALID");
    }
    attemptKeys.add(key);
  }
  const terminalIds = new Set<string>();
  for (const terminal of reservation.caseTerminals) {
    if (
      !isCaseId(terminal.caseId) ||
      !["complete", "semantic_failed", "visible_failed"].includes(terminal.status) ||
      !isTimestamp(terminal.completedAt) ||
      terminalIds.has(terminal.caseId) ||
      (terminal.status === "complete" && terminal.errorCode !== null) ||
      (terminal.status !== "complete" && !terminal.errorCode?.trim())
    ) {
      throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_CASE_TERMINAL_INVALID");
    }
    terminalIds.add(terminal.caseId);
  }
  if (budgetStatus === "reserved") {
    if (
      reservation.completedAt !== null ||
      reservation.executionOutcome !== null ||
      reservation.runEnvelopeFingerprint !== null ||
      reservation.error !== null
    ) {
      throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RESERVATION_STATE_INVALID");
    }
    return;
  }
  if (
    !isTimestamp(reservation.completedAt) ||
    reservation.attempts.some((attempt) => attempt.status === "reserved")
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RESERVATION_STATE_INVALID");
  }
  if (budgetStatus === "completed") {
    if (
      terminalIds.size !== GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_CASE_IDS.length ||
      !["technical_complete", "technical_failed"].includes(
        reservation.executionOutcome ?? ""
      ) ||
      !reservation.runEnvelopeFingerprint?.match(/^[a-f0-9]{64}$/u) ||
      reservation.error !== null
    ) {
      throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_COMPLETION_INVALID");
    }
    return;
  }
  if (
    budgetStatus !== "aborted" ||
    reservation.executionOutcome !== null ||
    reservation.runEnvelopeFingerprint !== null ||
    !reservation.error?.trim()
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_ABORT_INVALID");
  }
}

export function parseGenerativeSemanticFrameV5FirstPassBudget(
  value: unknown
): GenerativeSemanticFrameV5FirstPassBudget {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_BUDGET_INVALID");
  }
  const budget = value as GenerativeSemanticFrameV5FirstPassBudget;
  const expected = createGenerativeSemanticFrameV5FirstPassPendingBudget();
  if (
    budget.ledgerVersion !== expected.ledgerVersion ||
    budget.scopeFingerprint !== expected.scopeFingerprint ||
    budget.datasetVersion !== expected.datasetVersion ||
    budget.caseFingerprint !== expected.caseFingerprint ||
    budget.runLimit !== 1 ||
    JSON.stringify(budget.caseIds) !== JSON.stringify(expected.caseIds) ||
    JSON.stringify(budget.candidateVersions) !== JSON.stringify(expected.candidateVersions) ||
    JSON.stringify(budget.runtimeConfig) !== JSON.stringify(expected.runtimeConfig) ||
    JSON.stringify(budget.requestBudget) !== JSON.stringify(expected.requestBudget) ||
    JSON.stringify(budget.runPolicy) !== JSON.stringify(expected.runPolicy) ||
    !["pending", "approved", "reserved", "completed", "aborted"].includes(budget.status)
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_BUDGET_IDENTITY_MISMATCH");
  }
  if (budget.status === "pending") {
    if (budget.approval !== null || budget.reservation !== null) {
      throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_BUDGET_STATE_INVALID");
    }
    return budget;
  }
  validateGenerativeSemanticFrameV5FirstPassApproval(budget.approval);
  if (budget.status === "approved") {
    if (budget.reservation !== null) {
      throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_BUDGET_STATE_INVALID");
    }
    return budget;
  }
  if (!budget.reservation) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RESERVATION_REQUIRED");
  }
  validateReservation(budget.reservation, budget.status);
  return budget;
}

export function approveGenerativeSemanticFrameV5FirstPassBudget(input: {
  budget: unknown;
  approval: unknown;
}) {
  const budget = parseGenerativeSemanticFrameV5FirstPassBudget(input.budget);
  if (budget.status !== "pending") {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_BUDGET_ALREADY_APPROVED");
  }
  const approval = validateGenerativeSemanticFrameV5FirstPassApproval(input.approval);
  return {
    ...budget,
    status: "approved" as const,
    approval: structuredClone(approval)
  };
}

export function reserveGenerativeSemanticFrameV5FirstPassRun(input: {
  budget: unknown;
  approval: unknown;
  reservationId: string;
  reservedAt: string;
}) {
  const parsed = parseGenerativeSemanticFrameV5FirstPassBudget(input.budget);
  if (!input.reservationId.trim() || !isTimestamp(input.reservedAt)) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RESERVATION_INVALID");
  }
  if (["reserved", "completed", "aborted"].includes(parsed.status)) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_BUDGET_ALREADY_CONSUMED");
  }
  const approved = parsed.status === "pending"
    ? approveGenerativeSemanticFrameV5FirstPassBudget({
        budget: parsed,
        approval: input.approval
      })
    : parsed;
  const approval = validateGenerativeSemanticFrameV5FirstPassApproval(input.approval);
  if (JSON.stringify(approval) !== JSON.stringify(approved.approval)) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RUN_NOT_AUTHORIZED");
  }
  assertGenerativeSemanticFrameV5CandidateActive();
  return {
    ...approved,
    status: "reserved" as const,
    reservation: {
      reservationId: input.reservationId,
      runOrdinal: 1 as const,
      reservedAt: input.reservedAt,
      completedAt: null,
      status: "reserved" as const,
      preflightRequests: 0,
      attempts: [],
      caseTerminals: [],
      executionOutcome: null,
      runEnvelopeFingerprint: null,
      error: null
    }
  } satisfies GenerativeSemanticFrameV5FirstPassBudget;
}

function requireReservation(input: {
  budget: GenerativeSemanticFrameV5FirstPassBudget;
  reservationId: string;
}) {
  const reservation = input.budget.reservation;
  if (
    input.budget.status !== "reserved" ||
    !reservation ||
    reservation.status !== "reserved" ||
    reservation.reservationId !== input.reservationId
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RESERVATION_NOT_ACTIVE");
  }
  return reservation;
}

export function reserveGenerativeSemanticFrameV5FirstPassPreflight(input: {
  budget: unknown;
  reservationId: string;
}) {
  const budget = parseGenerativeSemanticFrameV5FirstPassBudget(input.budget);
  const reservation = requireReservation({ budget, reservationId: input.reservationId });
  if (
    reservation.preflightRequests >=
      GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_REQUEST_BUDGET.readOnlyModelsPreflightMax
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_PREFLIGHT_BUDGET_EXCEEDED");
  }
  return {
    ...budget,
    reservation: {
      ...reservation,
      preflightRequests: reservation.preflightRequests + 1
    }
  };
}

export function reserveGenerativeSemanticFrameV5FirstPassAttempt(input: {
  budget: unknown;
  reservationId: string;
  caseId: string;
  stage: Stage;
  attemptIndex: number;
  reservedAt: string;
}) {
  const budget = parseGenerativeSemanticFrameV5FirstPassBudget(input.budget);
  const reservation = requireReservation({ budget, reservationId: input.reservationId });
  if (
    !isCaseId(input.caseId) ||
    !["semantic", "visible"].includes(input.stage) ||
    ![1, 2].includes(input.attemptIndex) ||
    !isTimestamp(input.reservedAt) ||
    reservation.caseTerminals.some((item) => item.caseId === input.caseId) ||
    reservation.attempts.length >=
      GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_REQUEST_BUDGET.generationRequestsMax
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_REQUEST_USAGE_INVALID");
  }
  const stageAttempts = reservation.attempts.filter((attempt) =>
    attempt.caseId === input.caseId && attempt.stage === input.stage
  );
  if (stageAttempts.some((attempt) => attempt.attemptIndex === input.attemptIndex)) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_DUPLICATE_ATTEMPT");
  }
  if (input.attemptIndex === 1 && stageAttempts.length > 0) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_ATTEMPT_ORDER_INVALID");
  }
  if (input.attemptIndex === 2) {
    const first = stageAttempts.find((attempt) => attempt.attemptIndex === 1);
    if (!first || first.status !== "technical_failure") {
      throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RETRY_INVALID");
    }
  }
  if (
    input.stage === "visible" &&
    !reservation.attempts.some((attempt) =>
      attempt.caseId === input.caseId &&
      attempt.stage === "semantic" &&
      attempt.status === "valid"
    )
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_VISIBLE_BEFORE_SEMANTIC");
  }
  const attempt: GenerativeSemanticFrameV5FirstPassAttempt = {
    caseId: input.caseId,
    stage: input.stage,
    attemptIndex: input.attemptIndex as 1 | 2,
    status: "reserved",
    reservedAt: input.reservedAt,
    settledAt: null,
    errorCode: null
  };
  return {
    ...budget,
    reservation: {
      ...reservation,
      attempts: [...reservation.attempts, attempt]
    }
  };
}

export function settleGenerativeSemanticFrameV5FirstPassAttempt(input: {
  budget: unknown;
  reservationId: string;
  caseId: string;
  stage: Stage;
  attemptIndex: number;
  outcome: "valid" | "technical_failure";
  settledAt: string;
  errorCode?: string | null;
}) {
  const budget = parseGenerativeSemanticFrameV5FirstPassBudget(input.budget);
  const reservation = requireReservation({ budget, reservationId: input.reservationId });
  if (!isTimestamp(input.settledAt)) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_SETTLEMENT_INVALID");
  }
  const active = reservation.attempts.find((attempt) =>
    attempt.caseId === input.caseId &&
    attempt.stage === input.stage &&
    attempt.attemptIndex === input.attemptIndex
  );
  if (!active || active.status !== "reserved") {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_ATTEMPT_NOT_ACTIVE");
  }
  return {
    ...budget,
    reservation: {
      ...reservation,
      attempts: reservation.attempts.map((attempt) => attempt === active
        ? {
            ...attempt,
            status: input.outcome,
            settledAt: input.settledAt,
            errorCode: input.outcome === "technical_failure"
              ? input.errorCode?.trim() || "TECHNICAL_FAILURE"
              : null
          }
        : attempt)
    }
  };
}

export function consumeGenerativeSemanticFrameV5UnknownAttempts(input: {
  budget: unknown;
  reservationId: string;
  settledAt: string;
}) {
  const budget = parseGenerativeSemanticFrameV5FirstPassBudget(input.budget);
  const reservation = requireReservation({ budget, reservationId: input.reservationId });
  if (!isTimestamp(input.settledAt)) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RECOVERY_INVALID");
  }
  return {
    ...budget,
    reservation: {
      ...reservation,
      attempts: reservation.attempts.map((attempt) => attempt.status === "reserved"
        ? {
            ...attempt,
            status: "technical_failure" as const,
            settledAt: input.settledAt,
            errorCode: "RECOVERY_UNKNOWN_REQUEST_CONSUMED"
          }
        : attempt)
    }
  };
}

export function markGenerativeSemanticFrameV5FirstPassCaseTerminal(input: {
  budget: unknown;
  reservationId: string;
  caseId: string;
  status: GenerativeSemanticFrameV5FirstPassCaseTerminal["status"];
  completedAt: string;
  errorCode?: string | null;
}) {
  const budget = parseGenerativeSemanticFrameV5FirstPassBudget(input.budget);
  const reservation = requireReservation({ budget, reservationId: input.reservationId });
  if (
    !isCaseId(input.caseId) ||
    !isTimestamp(input.completedAt) ||
    reservation.caseTerminals.some((item) => item.caseId === input.caseId) ||
    reservation.attempts.some((attempt) =>
      attempt.caseId === input.caseId && attempt.status === "reserved"
    )
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_CASE_TERMINAL_INVALID");
  }
  const semanticValid = reservation.attempts.some((attempt) =>
    attempt.caseId === input.caseId &&
    attempt.stage === "semantic" &&
    attempt.status === "valid"
  );
  const visibleValid = reservation.attempts.some((attempt) =>
    attempt.caseId === input.caseId &&
    attempt.stage === "visible" &&
    attempt.status === "valid"
  );
  const shapeValid = input.status === "complete"
    ? semanticValid && visibleValid
    : input.status === "semantic_failed"
      ? !semanticValid
      : semanticValid && !visibleValid;
  if (!shapeValid) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_CASE_RESULT_MISMATCH");
  }
  const terminal: GenerativeSemanticFrameV5FirstPassCaseTerminal = {
    caseId: input.caseId,
    status: input.status,
    completedAt: input.completedAt,
    errorCode: input.status === "complete"
      ? null
      : input.errorCode?.trim() || "TECHNICAL_FAILURE"
  };
  return {
    ...budget,
    reservation: {
      ...reservation,
      caseTerminals: [...reservation.caseTerminals, terminal]
    }
  };
}

export function completeGenerativeSemanticFrameV5FirstPassRun(input: {
  budget: unknown;
  reservationId: string;
  completedAt: string;
  runEnvelopeFingerprint: string;
}) {
  const budget = parseGenerativeSemanticFrameV5FirstPassBudget(input.budget);
  const reservation = requireReservation({ budget, reservationId: input.reservationId });
  if (
    !isTimestamp(input.completedAt) ||
    !/^[a-f0-9]{64}$/u.test(input.runEnvelopeFingerprint) ||
    reservation.caseTerminals.length !==
      GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_CASE_IDS.length ||
    reservation.attempts.some((attempt) => attempt.status === "reserved")
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_COMPLETION_INVALID");
  }
  const executionOutcome = reservation.caseTerminals.every((item) =>
    item.status === "complete"
  ) ? "technical_complete" as const : "technical_failed" as const;
  return {
    ...budget,
    status: "completed" as const,
    reservation: {
      ...reservation,
      status: "completed" as const,
      completedAt: input.completedAt,
      executionOutcome,
      runEnvelopeFingerprint: input.runEnvelopeFingerprint
    }
  };
}

export function abortGenerativeSemanticFrameV5FirstPassRun(input: {
  budget: unknown;
  reservationId: string;
  completedAt: string;
  error: string;
}) {
  const recovered = consumeGenerativeSemanticFrameV5UnknownAttempts({
    budget: input.budget,
    reservationId: input.reservationId,
    settledAt: input.completedAt
  });
  const reservation = requireReservation({
    budget: recovered,
    reservationId: input.reservationId
  });
  if (!input.error.trim()) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_ABORT_INVALID");
  }
  return {
    ...recovered,
    status: "aborted" as const,
    reservation: {
      ...reservation,
      status: "aborted" as const,
      completedAt: input.completedAt,
      error: input.error.trim()
    }
  };
}
