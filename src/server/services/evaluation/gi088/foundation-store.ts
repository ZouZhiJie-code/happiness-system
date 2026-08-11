import { createHash } from "node:crypto";

export const GI088_EVALUATION_STORE_VERSION =
  "2026-08-10.gi088-evaluation-store-v2" as const;

export type Gi088FoundationJson =
  | null
  | boolean
  | number
  | string
  | readonly Gi088FoundationJson[]
  | { readonly [key: string]: Gi088FoundationJson };

export type Gi088FoundationRunStatus =
  | "running"
  | "sealed"
  | "early_stopped";

export type Gi088FoundationGateStatus =
  | "pending"
  | "no_go"
  | "ready_for_final_review"
  | "legacy_unknown";

export type Gi088FoundationCallStatus =
  | "reserved"
  | "dispatched"
  | "provider_succeeded"
  | "provider_failed"
  | "finalized"
  | "interrupted_unknown_dispatch"
  | "finalization_failed"
  | "superseded";

export type Gi088FoundationProviderResultStatus =
  | "provider_succeeded"
  | "provider_failed";

export type Gi088FoundationOperationStatus =
  | "processing"
  | "completed"
  | "failed";

export type Gi088FoundationProgramInterventionReview =
  | "correct"
  | "false_positive"
  | "uncertain";

export class Gi088FoundationStoreError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "Gi088FoundationStoreError";
  }
}

function canonicalJson(value: Gi088FoundationJson): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Gi088FoundationStoreError("GI088_CANONICAL_JSON_NUMBER_INVALID");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const objectValue = value as {
    readonly [key: string]: Gi088FoundationJson;
  };
  return `{${Object.keys(objectValue)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson(objectValue[key]!)}`
    )
    .join(",")}}`;
}

export function createGi088FoundationCanonicalJson(
  value: Gi088FoundationJson
) {
  return canonicalJson(value);
}

export function createGi088FoundationPayloadHash(
  value: Gi088FoundationJson
) {
  return createHash("sha256")
    .update(createGi088FoundationCanonicalJson(value))
    .digest("hex");
}

function offlineEvidenceFromState(value: Gi088FoundationJson) {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    return undefined;
  }
  return (value as { readonly [key: string]: Gi088FoundationJson })
    .offlineEvaluationEvidence;
}

export function assertGi088FoundationFrozenRunFacts(input: {
  currentState: Gi088FoundationJson;
  nextState: Gi088FoundationJson;
}) {
  const currentEvidence = offlineEvidenceFromState(input.currentState);
  const nextEvidence = offlineEvidenceFromState(input.nextState);
  if (currentEvidence === undefined && nextEvidence === undefined) return;
  if (
    currentEvidence === undefined ||
    nextEvidence === undefined ||
    canonicalJson(currentEvidence) !== canonicalJson(nextEvidence)
  ) {
    throw new Gi088FoundationStoreError(
      "GI088_FROZEN_OFFLINE_EVIDENCE_MISMATCH"
    );
  }
}

const CALL_TRANSITIONS = {
  reserved: ["dispatched", "superseded"],
  dispatched: [
    "provider_succeeded",
    "provider_failed",
    "interrupted_unknown_dispatch",
    "superseded"
  ],
  provider_succeeded: ["finalized", "finalization_failed", "superseded"],
  provider_failed: ["finalized", "finalization_failed", "superseded"],
  finalization_failed: ["superseded"],
  interrupted_unknown_dispatch: ["superseded"],
  finalized: [],
  superseded: []
} as const satisfies Record<
  Gi088FoundationCallStatus,
  readonly Gi088FoundationCallStatus[]
>;

export function isGi088FoundationCallTransitionAllowed(
  from: Gi088FoundationCallStatus,
  to: Gi088FoundationCallStatus
) {
  return (CALL_TRANSITIONS[from] as readonly Gi088FoundationCallStatus[])
    .includes(to);
}

export function assertGi088FoundationCallTransition(
  from: Gi088FoundationCallStatus,
  to: Gi088FoundationCallStatus
) {
  if (!isGi088FoundationCallTransitionAllowed(from, to)) {
    throw new Gi088FoundationStoreError(
      `GI088_CALL_STATUS_TRANSITION_INVALID:${from}:${to}`
    );
  }
}

export function countsAsGi088ProviderDispatch(
  input: Pick<Gi088FoundationCallRecord, "dispatchedAt">
) {
  return input.dispatchedAt !== null;
}

export type Gi088FoundationRunRecord = {
  id: string;
  ownerUserId: string;
  evaluationVersion: string;
  runOrdinal: number;
  candidateFingerprint: string;
  executionFingerprint: string;
  status: Gi088FoundationRunStatus;
  gateStatus: Gi088FoundationGateStatus;
  gateReasons: Gi088FoundationJson | null;
  state: Gi088FoundationJson;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  sealedAt: Date | null;
};

export type Gi088FoundationOperationRecord = {
  id: string;
  ownerUserId: string;
  evaluationVersion: string;
  runId: string | null;
  clientOperationId: string;
  action: string;
  payloadHash: string;
  status: Gi088FoundationOperationStatus;
  resultRevision: number | null;
  resultSnapshot: Gi088FoundationJson | null;
  createdAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
};

export type Gi088FoundationCallRecord = {
  callId: string;
  runId: string;
  taskId: string;
  branch: string;
  turnId: string;
  clientTurnId: string;
  clientOperationId: string;
  attempt: number;
  kind: string;
  status: Gi088FoundationCallStatus;
  providerResultStatus: Gi088FoundationProviderResultStatus | null;
  parentCallId: string | null;
  retryTrigger: string | null;
  requestHash: string;
  effectiveConfig: Gi088FoundationJson;
  baseAssistantMessageId: string | null;
  semanticStateBeforeHash: string;
  executionDeadlineAt: Date | null;
  automaticDeadlineAt: Date | null;
  reservedAt: Date;
  dispatchedAt: Date | null;
  providerCompletedAt: Date | null;
  finalizedAt: Date | null;
  rawFinalOutput: string | null;
  responseHash: string | null;
  tokenUsage: Gi088FoundationJson | null;
  providerDiagnostics: Gi088FoundationJson | null;
  errorCode: string | null;
  finalizationError: string | null;
  finalizedResult: Gi088FoundationJson | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Gi088FoundationProgramInterventionRecord = {
  id: string;
  runId: string;
  taskId: string;
  branch: string;
  turnId: string | null;
  callId: string | null;
  clientOperationId: string;
  interventionType: string;
  originalAction: string | null;
  effectiveAction: string;
  evidenceSpan: string | null;
  controlDecision: Gi088FoundationJson | null;
  traceSummary: Gi088FoundationJson | null;
  observationFingerprint: string;
  reviewOutcome: Gi088FoundationProgramInterventionReview | null;
  reviewReason: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Gi088FoundationReviewRevisionRecord = {
  id: string;
  runId: string;
  subjectType: string;
  subjectId: string;
  oldValue: Gi088FoundationJson | null;
  newValue: Gi088FoundationJson;
  reason: string;
  actorUserId: string;
  clientOperationId: string;
  createdAt: Date;
};

export type Gi088FoundationOperationEventRecord = {
  id: string;
  runId: string;
  taskId: string | null;
  turnId: string | null;
  route: string;
  code: string;
  safeSummary: Gi088FoundationJson | null;
  clientOperationId: string;
  createdAt: Date;
};

export type Gi088FoundationExportSnapshotRecord = {
  runId: string;
  exportVersion: string;
  payload: Gi088FoundationJson;
  payloadHash: string;
  recordCounts: Gi088FoundationJson;
  createdAt: Date;
};

export type Gi088FoundationOperationIdentity = {
  ownerUserId: string;
  evaluationVersion: string;
  runId: string | null;
  clientOperationId: string;
  action: string;
  payloadHash: string;
};

export type Gi088FoundationRunMutation = {
  runId: string;
  ownerUserId: string;
  expectedRevision: number;
  expectedExecutionFingerprint: string;
  nextState: Gi088FoundationJson;
  nextStatus?: Gi088FoundationRunStatus;
  nextGateStatus?: Gi088FoundationGateStatus;
  nextGateReasons?: Gi088FoundationJson | null;
  sealedAt?: Date | null;
};

export type Gi088FoundationCallReservation = {
  callId: string;
  runId: string;
  taskId: string;
  branch: string;
  turnId: string;
  clientTurnId: string;
  clientOperationId: string;
  attempt: number;
  kind: string;
  parentCallId?: string | null;
  retryTrigger?: string | null;
  requestHash: string;
  effectiveConfig: Gi088FoundationJson;
  baseAssistantMessageId?: string | null;
  semanticStateBeforeHash: string;
  executionDeadlineAt?: Date | null;
  automaticDeadlineAt?: Date | null;
  reservedAt: Date;
};

export function isGi088FoundationRecoveryParentAllowed(
  parent: { status: string; dispatchedAt: Date | null },
  childKind: string
) {
  if (parent.status === "finalized") return true;
  if (childKind !== "manual_retry") return false;
  return (
    parent.status === "interrupted_unknown_dispatch" ||
    (parent.status === "superseded" && parent.dispatchedAt === null)
  );
}

export interface Gi088EvaluationFoundationStore {
  listRuns(input: {
    ownerUserId: string;
    evaluationVersion?: string;
  }): Promise<Gi088FoundationRunRecord[]>;

  findRun(input: {
    ownerUserId: string;
    runId: string;
  }): Promise<Gi088FoundationRunRecord | null>;

  createRunIdempotently(input: {
    runId?: string;
    ownerUserId: string;
    evaluationVersion: string;
    candidateFingerprint: string;
    executionFingerprint: string;
    state: Gi088FoundationJson;
    gateStatus: Gi088FoundationGateStatus;
    gateReasons?: Gi088FoundationJson | null;
    clientOperationId: string;
    payloadHash: string;
  }): Promise<{
    run: Gi088FoundationRunRecord;
    operation: Gi088FoundationOperationRecord;
    created: boolean;
  }>;

  beginOperation(input: Gi088FoundationOperationIdentity): Promise<{
    operation: Gi088FoundationOperationRecord;
    claimed: boolean;
  }>;

  findOperation(input: {
    ownerUserId: string;
    evaluationVersion: string;
    clientOperationId: string;
  }): Promise<Gi088FoundationOperationRecord | null>;

  completeOperation(input: {
    ownerUserId: string;
    evaluationVersion: string;
    clientOperationId: string;
    status: Exclude<Gi088FoundationOperationStatus, "processing">;
    resultRevision: number | null;
    resultSnapshot: Gi088FoundationJson | null;
    completedAt: Date;
  }): Promise<Gi088FoundationOperationRecord>;

  reserveTurnWithCall(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    call: Gi088FoundationCallReservation;
  }): Promise<{
    run: Gi088FoundationRunRecord;
    call: Gi088FoundationCallRecord;
    operation: Gi088FoundationOperationRecord;
    claimed: boolean;
  }>;

  reserveRecoveryCall(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    call: Gi088FoundationCallReservation;
  }): Promise<{
    run: Gi088FoundationRunRecord;
    call: Gi088FoundationCallRecord;
    operation: Gi088FoundationOperationRecord;
    claimed: boolean;
  }>;

  claimDispatch(input: {
    callId: string;
    dispatchedAt: Date;
    executionDeadlineAt: Date;
  }): Promise<{ call: Gi088FoundationCallRecord; claimed: boolean }>;

  persistProviderResult(input: {
    callId: string;
    status: Gi088FoundationProviderResultStatus;
    providerCompletedAt: Date;
    rawFinalOutput: string | null;
    responseHash: string | null;
    tokenUsage: Gi088FoundationJson | null;
    providerDiagnostics: Gi088FoundationJson | null;
    errorCode: string | null;
  }): Promise<{ call: Gi088FoundationCallRecord; claimed: boolean }>;

  findCall(callId: string): Promise<Gi088FoundationCallRecord | null>;

  listCalls(runId: string): Promise<Gi088FoundationCallRecord[]>;

  compareAndSetCallStatus(input: {
    callId: string;
    expectedStatuses: Gi088FoundationCallStatus[];
    nextStatus: Gi088FoundationCallStatus;
    errorCode?: string | null;
    finalizationError?: string | null;
    providerDiagnostics?: Gi088FoundationJson | null;
  }): Promise<{ call: Gi088FoundationCallRecord; claimed: boolean }>;

  finalizeCall(input: {
    mutation: Gi088FoundationRunMutation;
    callId: string;
    finalizedAt: Date;
    finalizedResult: Gi088FoundationJson;
    errorCode?: string | null;
    operation?: {
      clientOperationId: string;
      resultSnapshot: Gi088FoundationJson;
    };
  }): Promise<{
    run: Gi088FoundationRunRecord;
    call: Gi088FoundationCallRecord;
    claimed: boolean;
  }>;

  commitRunMutation(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    resultSnapshot: Gi088FoundationJson;
  }): Promise<{
    run: Gi088FoundationRunRecord;
    operation: Gi088FoundationOperationRecord;
    claimed: boolean;
  }>;

  supersedeCallAndCommitRun(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    resultSnapshot: Gi088FoundationJson;
    callId: string;
    expectedStatuses: Gi088FoundationCallStatus[];
    errorCode: string;
  }): Promise<{
    run: Gi088FoundationRunRecord;
    operation: Gi088FoundationOperationRecord;
    call: Gi088FoundationCallRecord;
    claimed: boolean;
  }>;

  interruptCallAndCommitRun(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    resultSnapshot: Gi088FoundationJson;
    callId: string;
    errorCode: string;
  }): Promise<{
    run: Gi088FoundationRunRecord;
    operation: Gi088FoundationOperationRecord;
    call: Gi088FoundationCallRecord;
    claimed: boolean;
  }>;

  commitRunWithIntervention(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    resultSnapshot: Gi088FoundationJson;
    intervention: Omit<
      Gi088FoundationProgramInterventionRecord,
      "createdAt" | "updatedAt" | "reviewOutcome" | "reviewReason" | "reviewedAt"
    >;
  }): Promise<{
    run: Gi088FoundationRunRecord;
    operation: Gi088FoundationOperationRecord;
    intervention: Gi088FoundationProgramInterventionRecord;
    claimed: boolean;
  }>;

  appendProgramIntervention(input: Omit<
    Gi088FoundationProgramInterventionRecord,
    "createdAt" | "updatedAt" | "reviewOutcome" | "reviewReason" | "reviewedAt"
  >): Promise<{
    intervention: Gi088FoundationProgramInterventionRecord;
    created: boolean;
  }>;

  listProgramInterventions(
    runId: string
  ): Promise<Gi088FoundationProgramInterventionRecord[]>;

  commitReviewMutation(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    revision: Omit<Gi088FoundationReviewRevisionRecord, "createdAt">;
    resultSnapshot: Gi088FoundationJson;
  }): Promise<{
    run: Gi088FoundationRunRecord;
    revision: Gi088FoundationReviewRevisionRecord;
    operation: Gi088FoundationOperationRecord;
    claimed: boolean;
  }>;

  reviewProgramIntervention(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    interventionId: string;
    observationFingerprint: string;
    reviewOutcome: Gi088FoundationProgramInterventionReview;
    reviewReason: string;
    reviewedAt: Date;
    revision: Omit<Gi088FoundationReviewRevisionRecord, "createdAt">;
    resultSnapshot: Gi088FoundationJson;
  }): Promise<{
    run: Gi088FoundationRunRecord;
    intervention: Gi088FoundationProgramInterventionRecord;
    revision: Gi088FoundationReviewRevisionRecord;
    operation: Gi088FoundationOperationRecord;
    claimed: boolean;
  }>;

  listReviewRevisions(
    runId: string
  ): Promise<Gi088FoundationReviewRevisionRecord[]>;

  appendOperationEvent(input: Omit<
    Gi088FoundationOperationEventRecord,
    "createdAt"
  >): Promise<{
    event: Gi088FoundationOperationEventRecord;
    created: boolean;
  }>;

  listOperationEvents(
    runId: string
  ): Promise<Gi088FoundationOperationEventRecord[]>;

  findExportSnapshot(input: {
    ownerUserId: string;
    runId: string;
  }): Promise<Gi088FoundationExportSnapshotRecord | null>;

  getOrCreateExportSnapshot(input: {
    ownerUserId: string;
    runId: string;
    exportVersion: string;
    payload: Gi088FoundationJson;
    recordCounts: Gi088FoundationJson;
  }): Promise<{
    snapshot: Gi088FoundationExportSnapshotRecord;
    created: boolean;
  }>;
}
