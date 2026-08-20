import { randomUUID } from "node:crypto";

import {
  assertGi088FoundationCallTransition,
  createGi088FoundationPayloadHash,
  Gi088FoundationStoreError,
  isGi088FoundationRecoveryParentAllowed,
  type Gi088EvaluationFoundationStore,
  type Gi088FoundationCallRecord,
  type Gi088FoundationCallReservation,
  type Gi088FoundationCallStatus,
  type Gi088FoundationExportSnapshotRecord,
  type Gi088FoundationGateStatus,
  type Gi088FoundationJson,
  type Gi088FoundationOperationEventRecord,
  type Gi088FoundationOperationIdentity,
  type Gi088FoundationOperationRecord,
  type Gi088FoundationOperationStatus,
  type Gi088FoundationProgramInterventionRecord,
  type Gi088FoundationProgramInterventionReview,
  type Gi088FoundationProviderResultStatus,
  type Gi088FoundationReviewRevisionRecord,
  type Gi088FoundationRunMutation,
  type Gi088FoundationRunRecord
} from "./foundation-store";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function operationKey(input: {
  ownerUserId: string;
  evaluationVersion: string;
  clientOperationId: string;
}) {
  return `${input.ownerUserId}\u0000${input.evaluationVersion}\u0000${input.clientOperationId}`;
}

function eventKey(runId: string, clientOperationId: string) {
  return `${runId}\u0000${clientOperationId}`;
}

function sameFoundationJson(
  left: Gi088FoundationJson | null,
  right: Gi088FoundationJson | null
) {
  return (
    createGi088FoundationPayloadHash(left) ===
    createGi088FoundationPayloadHash(right)
  );
}

function sameInterventionIdentity(
  existing: Gi088FoundationProgramInterventionRecord,
  input: Pick<
    Gi088FoundationProgramInterventionRecord,
    "runId" | "callId" | "clientOperationId" | "interventionType"
  >
) {
  return input.callId
    ? existing.callId === input.callId &&
        existing.interventionType === input.interventionType
    : existing.runId === input.runId &&
        existing.callId === null &&
        existing.clientOperationId === input.clientOperationId &&
        existing.interventionType === input.interventionType;
}

function assertInterventionReplay(
  existing: Gi088FoundationProgramInterventionRecord,
  input: Omit<
    Gi088FoundationProgramInterventionRecord,
    "createdAt" | "updatedAt" | "reviewOutcome" | "reviewReason" | "reviewedAt"
  >
) {
  if (
    existing.runId !== input.runId ||
    existing.taskId !== input.taskId ||
    existing.branch !== input.branch ||
    existing.turnId !== input.turnId ||
    existing.callId !== input.callId ||
    existing.clientOperationId !== input.clientOperationId ||
    existing.interventionType !== input.interventionType ||
    existing.originalAction !== input.originalAction ||
    existing.effectiveAction !== input.effectiveAction ||
    existing.evidenceSpan !== input.evidenceSpan ||
    existing.observationFingerprint !== input.observationFingerprint ||
    !sameFoundationJson(existing.controlDecision, input.controlDecision) ||
    !sameFoundationJson(existing.traceSummary, input.traceSummary)
  ) {
    throw new Gi088FoundationStoreError(
      "GI088_INTERVENTION_PAYLOAD_CONFLICT"
    );
  }
}

function assertOperationEventReplay(
  existing: Gi088FoundationOperationEventRecord,
  input: Omit<Gi088FoundationOperationEventRecord, "createdAt">
) {
  if (
    existing.runId !== input.runId ||
    existing.taskId !== input.taskId ||
    existing.turnId !== input.turnId ||
    existing.route !== input.route ||
    existing.code !== input.code ||
    existing.clientOperationId !== input.clientOperationId ||
    !sameFoundationJson(existing.safeSummary, input.safeSummary)
  ) {
    throw new Gi088FoundationStoreError(
      "GI088_OPERATION_EVENT_PAYLOAD_CONFLICT"
    );
  }
}

function assertOperationReplay(
  existing: Gi088FoundationOperationRecord,
  input: Gi088FoundationOperationIdentity
) {
  if (
    existing.action !== input.action ||
    existing.payloadHash !== input.payloadHash ||
    (existing.runId !== null &&
      input.runId !== null &&
      existing.runId !== input.runId)
  ) {
    throw new Gi088FoundationStoreError("GI088_OPERATION_PAYLOAD_CONFLICT");
  }
}

function createOperation(
  input: Gi088FoundationOperationIdentity,
  status: Gi088FoundationOperationStatus = "processing",
  now = new Date()
): Gi088FoundationOperationRecord {
  return {
    id: randomUUID(),
    ...input,
    status,
    resultRevision: null,
    resultSnapshot: null,
    createdAt: now,
    completedAt: null,
    updatedAt: now
  };
}

export class Gi088MemoryFoundationStore
implements Gi088EvaluationFoundationStore {
  private readonly runs = new Map<string, Gi088FoundationRunRecord>();
  private readonly operations = new Map<string, Gi088FoundationOperationRecord>();
  private readonly calls = new Map<string, Gi088FoundationCallRecord>();
  private readonly interventions =
    new Map<string, Gi088FoundationProgramInterventionRecord>();
  private readonly revisions =
    new Map<string, Gi088FoundationReviewRevisionRecord>();
  private readonly events =
    new Map<string, Gi088FoundationOperationEventRecord>();
  private readonly exports =
    new Map<string, Gi088FoundationExportSnapshotRecord>();
  private mutationTail: Promise<void> = Promise.resolve();

  private atomic<T>(mutation: () => T): Promise<T> {
    const result = this.mutationTail.then(mutation);
    this.mutationTail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  private async afterMutations() {
    await this.mutationTail;
  }

  private requireRun(runId: string) {
    const run = this.runs.get(runId);
    if (!run) throw new Gi088FoundationStoreError("GI088_RUN_NOT_FOUND");
    return run;
  }

  private assertRunMutation(
    run: Gi088FoundationRunRecord,
    mutation: Gi088FoundationRunMutation
  ) {
    if (run.ownerUserId !== mutation.ownerUserId) {
      throw new Gi088FoundationStoreError("GI088_RUN_FORBIDDEN");
    }
    if (run.status !== "running") {
      throw new Gi088FoundationStoreError("GI088_RUN_READ_ONLY");
    }
    if (run.executionFingerprint !== mutation.expectedExecutionFingerprint) {
      throw new Gi088FoundationStoreError(
        "GI088_STORED_FINGERPRINT_MISMATCH"
      );
    }
    if (run.revision !== mutation.expectedRevision) {
      throw new Gi088FoundationStoreError("GI088_CONCURRENT_UPDATE");
    }
  }

  private applyRunMutation(
    run: Gi088FoundationRunRecord,
    mutation: Gi088FoundationRunMutation,
    now = new Date()
  ) {
    this.assertRunMutation(run, mutation);
    const updated: Gi088FoundationRunRecord = {
      ...run,
      state: clone(mutation.nextState),
      status: mutation.nextStatus ?? run.status,
      gateStatus: mutation.nextGateStatus ?? run.gateStatus,
      gateReasons:
        mutation.nextGateReasons === undefined
          ? clone(run.gateReasons)
          : clone(mutation.nextGateReasons),
      sealedAt:
        mutation.sealedAt === undefined ? run.sealedAt : mutation.sealedAt,
      revision: run.revision + 1,
      updatedAt: now
    };
    this.runs.set(run.id, updated);
    return updated;
  }

  async listRuns(input: {
    ownerUserId: string;
    evaluationVersion?: string;
  }) {
    await this.afterMutations();
    return [...this.runs.values()]
      .filter(
        (run) =>
          run.ownerUserId === input.ownerUserId &&
          (input.evaluationVersion === undefined ||
            run.evaluationVersion === input.evaluationVersion)
      )
      .sort(
        (left, right) =>
          right.evaluationVersion.localeCompare(left.evaluationVersion) ||
          right.runOrdinal - left.runOrdinal ||
          right.createdAt.getTime() - left.createdAt.getTime()
      )
      .map(clone);
  }

  async findRun(input: { ownerUserId: string; runId: string }) {
    await this.afterMutations();
    const run = this.runs.get(input.runId);
    return run?.ownerUserId === input.ownerUserId ? clone(run) : null;
  }

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
  }) {
    return this.atomic(() => {
      const identity: Gi088FoundationOperationIdentity = {
        ownerUserId: input.ownerUserId,
        evaluationVersion: input.evaluationVersion,
        runId: null,
        clientOperationId: input.clientOperationId,
        action: "create_run",
        payloadHash: input.payloadHash
      };
      const key = operationKey(identity);
      const existingOperation = this.operations.get(key);
      if (existingOperation) {
        assertOperationReplay(existingOperation, identity);
        if (!existingOperation.runId) {
          throw new Gi088FoundationStoreError(
            "GI088_OPERATION_RESULT_INCOMPLETE"
          );
        }
        return {
          run: clone(this.requireRun(existingOperation.runId)),
          operation: clone(existingOperation),
          created: false
        };
      }
      const running = [...this.runs.values()].find(
        (run) =>
          run.ownerUserId === input.ownerUserId &&
          run.evaluationVersion === input.evaluationVersion &&
          run.status === "running"
      );
      const now = new Date();
      if (running) {
        const operation: Gi088FoundationOperationRecord = {
          ...createOperation(identity, "completed", now),
          runId: running.id,
          resultRevision: running.revision,
          resultSnapshot: {
            runId: running.id,
            runOrdinal: running.runOrdinal,
            revision: running.revision
          },
          completedAt: now
        };
        this.operations.set(key, operation);
        return { run: clone(running), operation: clone(operation), created: false };
      }
      const runOrdinal =
        Math.max(
          0,
          ...[...this.runs.values()]
            .filter(
              (run) =>
                run.ownerUserId === input.ownerUserId &&
                run.evaluationVersion === input.evaluationVersion
            )
            .map((run) => run.runOrdinal)
        ) + 1;
      const run: Gi088FoundationRunRecord = {
        id: input.runId ?? randomUUID(),
        ownerUserId: input.ownerUserId,
        evaluationVersion: input.evaluationVersion,
        runOrdinal,
        candidateFingerprint: input.candidateFingerprint,
        executionFingerprint: input.executionFingerprint,
        status: "running",
        gateStatus: input.gateStatus,
        gateReasons: clone(input.gateReasons ?? null),
        state: clone(input.state),
        revision: 0,
        createdAt: now,
        updatedAt: now,
        sealedAt: null
      };
      if (this.runs.has(run.id)) {
        throw new Gi088FoundationStoreError("GI088_RUN_ID_CONFLICT");
      }
      const operation: Gi088FoundationOperationRecord = {
        ...createOperation(identity, "completed", now),
        runId: run.id,
        resultRevision: 0,
        resultSnapshot: { runId: run.id, runOrdinal, revision: 0 },
        completedAt: now
      };
      this.runs.set(run.id, run);
      this.operations.set(key, operation);
      return { run: clone(run), operation: clone(operation), created: true };
    });
  }

  beginOperation(input: Gi088FoundationOperationIdentity) {
    return this.atomic(() => {
      if (input.runId) {
        const run = this.requireRun(input.runId);
        if (run.ownerUserId !== input.ownerUserId) {
          throw new Gi088FoundationStoreError("GI088_RUN_NOT_FOUND");
        }
      }
      const key = operationKey(input);
      const existing = this.operations.get(key);
      if (existing) {
        assertOperationReplay(existing, input);
        return { operation: clone(existing), claimed: false };
      }
      const operation = createOperation(input);
      this.operations.set(key, operation);
      return { operation: clone(operation), claimed: true };
    });
  }

  async findOperation(input: {
    ownerUserId: string;
    evaluationVersion: string;
    clientOperationId: string;
  }) {
    await this.afterMutations();
    const operation = this.operations.get(operationKey(input));
    return operation ? clone(operation) : null;
  }

  completeOperation(input: {
    ownerUserId: string;
    evaluationVersion: string;
    clientOperationId: string;
    status: Exclude<Gi088FoundationOperationStatus, "processing">;
    resultRevision: number | null;
    resultSnapshot: Gi088FoundationJson | null;
    completedAt: Date;
  }) {
    return this.atomic(() => {
      const key = operationKey(input);
      const current = this.operations.get(key);
      if (!current) {
        throw new Gi088FoundationStoreError("GI088_OPERATION_NOT_FOUND");
      }
      if (current.status !== "processing") return clone(current);
      const updated = {
        ...current,
        status: input.status,
        resultRevision: input.resultRevision,
        resultSnapshot: clone(input.resultSnapshot),
        completedAt: input.completedAt,
        updatedAt: input.completedAt
      };
      this.operations.set(key, updated);
      return clone(updated);
    });
  }

  private reserveCall(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    call: Gi088FoundationCallReservation;
  }) {
    if (
      input.operation.runId !== input.mutation.runId ||
      input.call.runId !== input.mutation.runId
    ) {
      throw new Gi088FoundationStoreError("GI088_RUN_SCOPE_MISMATCH");
    }
    if (input.call.attempt < 1) {
      throw new Gi088FoundationStoreError("GI088_CALL_ATTEMPT_INVALID");
    }
    const run = this.requireRun(input.mutation.runId);
    const key = operationKey(input.operation);
    const existingOperation = this.operations.get(key);
    if (existingOperation) {
      assertOperationReplay(existingOperation, input.operation);
      const existingCall = [...this.calls.values()].find(
        (call) =>
          call.runId === run.id &&
          call.clientOperationId === input.operation.clientOperationId &&
          call.attempt === input.call.attempt
      );
      if (!existingCall) {
        throw new Gi088FoundationStoreError(
          "GI088_OPERATION_RESULT_INCOMPLETE"
        );
      }
      return {
        run: clone(run),
        call: clone(existingCall),
        operation: clone(existingOperation),
        claimed: false
      };
    }
    if (input.call.attempt > 1) {
      const parentCall = input.call.parentCallId
        ? this.calls.get(input.call.parentCallId)
        : null;
      if (
        !parentCall ||
        parentCall.runId !== input.call.runId ||
        parentCall.taskId !== input.call.taskId ||
        parentCall.branch !== input.call.branch ||
        parentCall.turnId !== input.call.turnId ||
        parentCall.clientTurnId !== input.call.clientTurnId ||
        parentCall.attempt + 1 !== input.call.attempt ||
        !isGi088FoundationRecoveryParentAllowed(
          parentCall,
          input.call.kind
        )
      ) {
        throw new Gi088FoundationStoreError(
          "GI088_RECOVERY_CALL_LINEAGE_INVALID"
        );
      }
    }
    this.assertRunMutation(run, input.mutation);
    if (this.calls.has(input.call.callId)) {
      throw new Gi088FoundationStoreError("GI088_CALL_ID_CONFLICT");
    }
    const duplicateTurn = [...this.calls.values()].some(
      (call) =>
        call.runId === run.id &&
        call.turnId === input.call.turnId &&
        call.attempt === input.call.attempt
    );
    if (duplicateTurn) {
      throw new Gi088FoundationStoreError("GI088_CALL_ATTEMPT_CONFLICT");
    }
    const now = new Date();
    const operation = createOperation(input.operation, "processing", now);
    const call: Gi088FoundationCallRecord = {
      ...input.call,
      parentCallId: input.call.parentCallId ?? null,
      retryTrigger: input.call.retryTrigger ?? null,
      baseAssistantMessageId: input.call.baseAssistantMessageId ?? null,
      executionDeadlineAt: input.call.executionDeadlineAt ?? null,
      automaticDeadlineAt: input.call.automaticDeadlineAt ?? null,
      status: "reserved",
      providerResultStatus: null,
      dispatchedAt: null,
      providerCompletedAt: null,
      finalizedAt: null,
      rawFinalOutput: null,
      responseHash: null,
      tokenUsage: null,
      providerDiagnostics: null,
      errorCode: null,
      finalizationError: null,
      finalizedResult: null,
      createdAt: now,
      updatedAt: now
    };
    const updatedRun = this.applyRunMutation(run, input.mutation, now);
    operation.resultRevision = updatedRun.revision;
    operation.updatedAt = now;
    this.operations.set(key, operation);
    this.calls.set(call.callId, call);
    return {
      run: clone(updatedRun),
      call: clone(call),
      operation: clone(operation),
      claimed: true
    };
  }

  reserveTurnWithCall(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    call: Gi088FoundationCallReservation;
  }) {
    return this.atomic(() => this.reserveCall(input));
  }

  reserveRecoveryCall(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    call: Gi088FoundationCallReservation;
  }) {
    if (
      input.call.attempt < 2 ||
      !input.call.parentCallId ||
      !input.call.retryTrigger
    ) {
      return Promise.reject(
        new Gi088FoundationStoreError("GI088_RECOVERY_CALL_LINEAGE_INVALID")
      );
    }
    return this.atomic(() => this.reserveCall(input));
  }

  claimDispatch(input: {
    callId: string;
    dispatchedAt: Date;
    executionDeadlineAt: Date;
  }) {
    return this.atomic(() => {
      const call = this.calls.get(input.callId);
      if (!call) throw new Gi088FoundationStoreError("GI088_CALL_NOT_FOUND");
      if (call.status !== "reserved") {
        return { call: clone(call), claimed: false };
      }
      const updated: Gi088FoundationCallRecord = {
        ...call,
        status: "dispatched",
        dispatchedAt: input.dispatchedAt,
        executionDeadlineAt: input.executionDeadlineAt,
        updatedAt: input.dispatchedAt
      };
      this.calls.set(call.callId, updated);
      return { call: clone(updated), claimed: true };
    });
  }

  persistProviderResult(input: {
    callId: string;
    status: Gi088FoundationProviderResultStatus;
    providerCompletedAt: Date;
    rawFinalOutput: string | null;
    responseHash: string | null;
    tokenUsage: Gi088FoundationJson | null;
    providerDiagnostics: Gi088FoundationJson | null;
    errorCode: string | null;
  }) {
    return this.atomic(() => {
      const call = this.calls.get(input.callId);
      if (!call) throw new Gi088FoundationStoreError("GI088_CALL_NOT_FOUND");
      const diagnosticUpdate = {
        providerResultStatus: input.status,
        providerCompletedAt: input.providerCompletedAt,
        rawFinalOutput: input.rawFinalOutput,
        responseHash: input.responseHash,
        tokenUsage: clone(input.tokenUsage),
        providerDiagnostics: clone(input.providerDiagnostics),
        errorCode: input.errorCode,
        updatedAt: input.providerCompletedAt
      };
      if (call.status === "dispatched") {
        const updated = { ...call, ...diagnosticUpdate, status: input.status };
        this.calls.set(call.callId, updated);
        return { call: clone(updated), claimed: true };
      }
      if (
        call.status === "superseded" ||
        call.status === "interrupted_unknown_dispatch"
      ) {
        const updated = {
          ...call,
          ...diagnosticUpdate,
          status: "superseded" as const
        };
        this.calls.set(call.callId, updated);
        return { call: clone(updated), claimed: false };
      }
      if (
        call.providerResultStatus === input.status &&
        call.responseHash === input.responseHash &&
        call.errorCode === input.errorCode
      ) {
        return { call: clone(call), claimed: false };
      }
      throw new Gi088FoundationStoreError("GI088_PROVIDER_RESULT_CONFLICT");
    });
  }

  async findCall(callId: string) {
    await this.afterMutations();
    const call = this.calls.get(callId);
    return call ? clone(call) : null;
  }

  async listCalls(runId: string) {
    await this.afterMutations();
    return [...this.calls.values()]
      .filter((call) => call.runId === runId)
      .sort(
        (left, right) =>
          left.reservedAt.getTime() - right.reservedAt.getTime() ||
          left.attempt - right.attempt
      )
      .map(clone);
  }

  compareAndSetCallStatus(input: {
    callId: string;
    expectedStatuses: Gi088FoundationCallStatus[];
    nextStatus: Gi088FoundationCallStatus;
    errorCode?: string | null;
    finalizationError?: string | null;
    providerDiagnostics?: Gi088FoundationJson | null;
  }) {
    return this.atomic(() => {
      if (input.expectedStatuses.length === 0) {
        throw new Gi088FoundationStoreError(
          "GI088_CALL_EXPECTED_STATUS_REQUIRED"
        );
      }
      for (const status of input.expectedStatuses) {
        assertGi088FoundationCallTransition(status, input.nextStatus);
      }
      const call = this.calls.get(input.callId);
      if (!call) throw new Gi088FoundationStoreError("GI088_CALL_NOT_FOUND");
      if (!input.expectedStatuses.includes(call.status)) {
        return { call: clone(call), claimed: false };
      }
      const updated: Gi088FoundationCallRecord = {
        ...call,
        status: input.nextStatus,
        errorCode:
          input.errorCode === undefined ? call.errorCode : input.errorCode,
        finalizationError:
          input.finalizationError === undefined
            ? call.finalizationError
            : input.finalizationError,
        providerDiagnostics:
          input.providerDiagnostics === undefined
            ? clone(call.providerDiagnostics)
            : clone(input.providerDiagnostics),
        updatedAt: new Date()
      };
      this.calls.set(call.callId, updated);
      return { call: clone(updated), claimed: true };
    });
  }

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
  }) {
    return this.atomic(() => {
      const run = this.requireRun(input.mutation.runId);
      if (run.ownerUserId !== input.mutation.ownerUserId) {
        throw new Gi088FoundationStoreError("GI088_RUN_NOT_FOUND");
      }
      const call = this.calls.get(input.callId);
      if (!call || call.runId !== run.id) {
        throw new Gi088FoundationStoreError("GI088_CALL_NOT_FOUND");
      }
      if (
        input.operation &&
        call.clientOperationId !== input.operation.clientOperationId
      ) {
        throw new Gi088FoundationStoreError("GI088_OPERATION_SCOPE_MISMATCH");
      }
      if (call.status === "finalized") {
        return { run: clone(run), call: clone(call), claimed: false };
      }
      if (
        call.status !== "provider_succeeded" &&
        call.status !== "provider_failed"
      ) {
        throw new Gi088FoundationStoreError(
          "GI088_CALL_NOT_READY_TO_FINALIZE"
        );
      }
      let operationKeyToComplete: string | null = null;
      let operationToComplete: Gi088FoundationOperationRecord | null = null;
      if (input.operation) {
        operationKeyToComplete = operationKey({
          ownerUserId: input.mutation.ownerUserId,
          evaluationVersion: run.evaluationVersion,
          clientOperationId: input.operation.clientOperationId
        });
        operationToComplete = this.operations.get(operationKeyToComplete) ?? null;
        if (!operationToComplete || operationToComplete.runId !== run.id) {
          throw new Gi088FoundationStoreError("GI088_OPERATION_NOT_FOUND");
        }
      }
      const updatedRun = this.applyRunMutation(
        run,
        input.mutation,
        input.finalizedAt
      );
      const updatedCall: Gi088FoundationCallRecord = {
        ...call,
        status: "finalized",
        finalizedAt: input.finalizedAt,
        finalizedResult: clone(input.finalizedResult),
        errorCode:
          input.errorCode === undefined ? call.errorCode : input.errorCode,
        finalizationError: null,
        updatedAt: input.finalizedAt
      };
      this.calls.set(call.callId, updatedCall);
      if (input.operation && operationKeyToComplete && operationToComplete) {
        this.operations.set(operationKeyToComplete, {
          ...operationToComplete,
          status: "completed",
          resultRevision: updatedRun.revision,
          resultSnapshot: clone(input.operation.resultSnapshot),
          completedAt: input.finalizedAt,
          updatedAt: input.finalizedAt
        });
      }
      return {
        run: clone(updatedRun),
        call: clone(updatedCall),
        claimed: true
      };
    });
  }

  commitRunMutation(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    resultSnapshot: Gi088FoundationJson;
  }) {
    return this.atomic(() => {
      if (input.operation.runId !== input.mutation.runId) {
        throw new Gi088FoundationStoreError("GI088_RUN_SCOPE_MISMATCH");
      }
      const run = this.requireRun(input.mutation.runId);
      const key = operationKey(input.operation);
      const existing = this.operations.get(key);
      if (existing) {
        assertOperationReplay(existing, input.operation);
        if (existing.runId !== run.id || existing.status === "processing") {
          throw new Gi088FoundationStoreError(
            "GI088_OPERATION_RESULT_INCOMPLETE"
          );
        }
        return { run: clone(run), operation: clone(existing), claimed: false };
      }
      const now = new Date();
      const updatedRun = this.applyRunMutation(run, input.mutation, now);
      const operation: Gi088FoundationOperationRecord = {
        ...createOperation(input.operation, "completed", now),
        resultRevision: updatedRun.revision,
        resultSnapshot: clone(input.resultSnapshot),
        completedAt: now
      };
      this.operations.set(key, operation);
      return {
        run: clone(updatedRun),
        operation: clone(operation),
        claimed: true
      };
    });
  }

  private commitRunWithCallTransition(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    resultSnapshot: Gi088FoundationJson;
    callId: string;
    expectedStatuses: Gi088FoundationCallStatus[];
    nextStatus: Gi088FoundationCallStatus;
    errorCode: string;
  }) {
    if (input.operation.runId !== input.mutation.runId) {
      throw new Gi088FoundationStoreError("GI088_RUN_SCOPE_MISMATCH");
    }
    if (input.expectedStatuses.length === 0) {
      throw new Gi088FoundationStoreError(
        "GI088_CALL_EXPECTED_STATUS_REQUIRED"
      );
    }
    for (const status of input.expectedStatuses) {
      assertGi088FoundationCallTransition(status, input.nextStatus);
    }
    const run = this.requireRun(input.mutation.runId);
    const call = this.calls.get(input.callId);
    if (!call || call.runId !== run.id) {
      throw new Gi088FoundationStoreError("GI088_CALL_NOT_FOUND");
    }
    const key = operationKey(input.operation);
    const existingOperation = this.operations.get(key);
    if (existingOperation) {
      assertOperationReplay(existingOperation, input.operation);
      if (
        existingOperation.runId !== run.id ||
        existingOperation.status === "processing"
      ) {
        throw new Gi088FoundationStoreError(
          "GI088_OPERATION_RESULT_INCOMPLETE"
        );
      }
      return {
        run: clone(run),
        call: clone(call),
        operation: clone(existingOperation),
        claimed: false
      };
    }
    this.assertRunMutation(run, input.mutation);
    if (!input.expectedStatuses.includes(call.status)) {
      throw new Gi088FoundationStoreError("GI088_CONCURRENT_UPDATE");
    }
    const completedAt = new Date();
    const updatedRun = this.applyRunMutation(
      run,
      input.mutation,
      completedAt
    );
    const updatedCall: Gi088FoundationCallRecord = {
      ...call,
      status: input.nextStatus,
      errorCode: input.errorCode,
      updatedAt: completedAt
    };
    const operation: Gi088FoundationOperationRecord = {
      ...createOperation(input.operation, "completed", completedAt),
      resultRevision: updatedRun.revision,
      resultSnapshot: clone(input.resultSnapshot),
      completedAt
    };
    this.calls.set(call.callId, updatedCall);
    this.operations.set(key, operation);
    return {
      run: clone(updatedRun),
      call: clone(updatedCall),
      operation: clone(operation),
      claimed: true
    };
  }

  supersedeCallAndCommitRun(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    resultSnapshot: Gi088FoundationJson;
    callId: string;
    expectedStatuses: Gi088FoundationCallStatus[];
    errorCode: string;
  }) {
    return this.atomic(() =>
      this.commitRunWithCallTransition({
        ...input,
        nextStatus: "superseded"
      })
    );
  }

  interruptCallAndCommitRun(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    resultSnapshot: Gi088FoundationJson;
    callId: string;
    errorCode: string;
  }) {
    return this.atomic(() =>
      this.commitRunWithCallTransition({
        ...input,
        expectedStatuses: ["dispatched"],
        nextStatus: "interrupted_unknown_dispatch"
      })
    );
  }

  commitRunWithIntervention(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    resultSnapshot: Gi088FoundationJson;
    intervention: Omit<
      Gi088FoundationProgramInterventionRecord,
      "createdAt" | "updatedAt" | "reviewOutcome" | "reviewReason" | "reviewedAt"
    >;
  }) {
    return this.atomic(() => {
      if (
        input.operation.runId !== input.mutation.runId ||
        input.intervention.runId !== input.mutation.runId ||
        input.intervention.clientOperationId !==
          input.operation.clientOperationId
      ) {
        throw new Gi088FoundationStoreError("GI088_RUN_SCOPE_MISMATCH");
      }
      const run = this.requireRun(input.mutation.runId);
      const key = operationKey(input.operation);
      const existingOperation = this.operations.get(key);
      const existingIntervention = [...this.interventions.values()].find(
        (item) => sameInterventionIdentity(item, input.intervention)
      );
      if (existingOperation) {
        assertOperationReplay(existingOperation, input.operation);
        if (
          existingOperation.runId !== run.id ||
          existingOperation.status === "processing" ||
          !existingIntervention
        ) {
          throw new Gi088FoundationStoreError(
            "GI088_OPERATION_RESULT_INCOMPLETE"
          );
        }
        assertInterventionReplay(existingIntervention, input.intervention);
        return {
          run: clone(run),
          operation: clone(existingOperation),
          intervention: clone(existingIntervention),
          claimed: false
        };
      }
      if (existingIntervention || this.interventions.has(input.intervention.id)) {
        throw new Gi088FoundationStoreError(
          "GI088_INTERVENTION_PAYLOAD_CONFLICT"
        );
      }
      this.assertRunMutation(run, input.mutation);
      const completedAt = new Date();
      const updatedRun = this.applyRunMutation(
        run,
        input.mutation,
        completedAt
      );
      const operation: Gi088FoundationOperationRecord = {
        ...createOperation(input.operation, "completed", completedAt),
        resultRevision: updatedRun.revision,
        resultSnapshot: clone(input.resultSnapshot),
        completedAt
      };
      const intervention: Gi088FoundationProgramInterventionRecord = {
        ...clone(input.intervention),
        reviewOutcome: null,
        reviewReason: null,
        reviewedAt: null,
        createdAt: completedAt,
        updatedAt: completedAt
      };
      this.operations.set(key, operation);
      this.interventions.set(intervention.id, intervention);
      return {
        run: clone(updatedRun),
        operation: clone(operation),
        intervention: clone(intervention),
        claimed: true
      };
    });
  }

  appendProgramIntervention(input: Omit<
    Gi088FoundationProgramInterventionRecord,
    "createdAt" | "updatedAt" | "reviewOutcome" | "reviewReason" | "reviewedAt"
  >) {
    return this.atomic(() => {
      this.requireRun(input.runId);
      const existing =
        this.interventions.get(input.id) ??
        [...this.interventions.values()].find((item) =>
          sameInterventionIdentity(item, input)
        );
      if (existing) {
        assertInterventionReplay(existing, input);
        return { intervention: clone(existing), created: false };
      }
      const now = new Date();
      const intervention: Gi088FoundationProgramInterventionRecord = {
        ...clone(input),
        reviewOutcome: null,
        reviewReason: null,
        reviewedAt: null,
        createdAt: now,
        updatedAt: now
      };
      this.interventions.set(input.id, intervention);
      return { intervention: clone(intervention), created: true };
    });
  }

  async listProgramInterventions(runId: string) {
    await this.afterMutations();
    return [...this.interventions.values()]
      .filter((item) => item.runId === runId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map(clone);
  }

  commitReviewMutation(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    revision: Omit<Gi088FoundationReviewRevisionRecord, "createdAt">;
    resultSnapshot: Gi088FoundationJson;
  }) {
    return this.atomic(() => {
      if (
        input.operation.runId !== input.mutation.runId ||
        input.revision.runId !== input.mutation.runId ||
        input.revision.clientOperationId !== input.operation.clientOperationId
      ) {
        throw new Gi088FoundationStoreError("GI088_RUN_SCOPE_MISMATCH");
      }
      const run = this.requireRun(input.mutation.runId);
      const key = operationKey(input.operation);
      const existingOperation = this.operations.get(key);
      if (existingOperation) {
        assertOperationReplay(existingOperation, input.operation);
        const existingRevision = [...this.revisions.values()].find(
          (item) =>
            item.runId === run.id &&
            item.clientOperationId === input.operation.clientOperationId
        );
        if (!existingRevision) {
          throw new Gi088FoundationStoreError(
            "GI088_OPERATION_RESULT_INCOMPLETE"
          );
        }
        return {
          run: clone(run),
          revision: clone(existingRevision),
          operation: clone(existingOperation),
          claimed: false
        };
      }
      if (this.revisions.has(input.revision.id)) {
        throw new Gi088FoundationStoreError("GI088_REVISION_ID_CONFLICT");
      }
      const now = new Date();
      const updatedRun = this.applyRunMutation(run, input.mutation, now);
      const revision = { ...clone(input.revision), createdAt: now };
      const operation: Gi088FoundationOperationRecord = {
        ...createOperation(input.operation, "completed", now),
        resultRevision: updatedRun.revision,
        resultSnapshot: clone(input.resultSnapshot),
        completedAt: now
      };
      this.revisions.set(revision.id, revision);
      this.operations.set(key, operation);
      return {
        run: clone(updatedRun),
        revision: clone(revision),
        operation: clone(operation),
        claimed: true
      };
    });
  }

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
  }) {
    return this.atomic(() => {
      if (
        input.operation.runId !== input.mutation.runId ||
        input.revision.runId !== input.mutation.runId ||
        input.revision.clientOperationId !== input.operation.clientOperationId
      ) {
        throw new Gi088FoundationStoreError("GI088_RUN_SCOPE_MISMATCH");
      }
      const run = this.requireRun(input.mutation.runId);
      const intervention = this.interventions.get(input.interventionId);
      if (!intervention || intervention.runId !== run.id) {
        throw new Gi088FoundationStoreError(
          "GI088_PROGRAM_INTERVENTION_NOT_FOUND"
        );
      }
      if (
        intervention.observationFingerprint !== input.observationFingerprint
      ) {
        throw new Gi088FoundationStoreError(
          "GI088_REVIEW_SNAPSHOT_OUT_OF_DATE"
        );
      }
      const key = operationKey(input.operation);
      const existingOperation = this.operations.get(key);
      if (existingOperation) {
        assertOperationReplay(existingOperation, input.operation);
        const existingRevision = [...this.revisions.values()].find(
          (item) =>
            item.runId === run.id &&
            item.clientOperationId === input.operation.clientOperationId
        );
        if (!existingRevision) {
          throw new Gi088FoundationStoreError(
            "GI088_OPERATION_RESULT_INCOMPLETE"
          );
        }
        return {
          run: clone(run),
          intervention: clone(intervention),
          revision: clone(existingRevision),
          operation: clone(existingOperation),
          claimed: false
        };
      }
      const now = input.reviewedAt;
      const updatedRun = this.applyRunMutation(run, input.mutation, now);
      const updatedIntervention = {
        ...intervention,
        reviewOutcome: input.reviewOutcome,
        reviewReason: input.reviewReason,
        reviewedAt: now,
        updatedAt: now
      };
      const revision = { ...clone(input.revision), createdAt: now };
      const operation: Gi088FoundationOperationRecord = {
        ...createOperation(input.operation, "completed", now),
        resultRevision: updatedRun.revision,
        resultSnapshot: clone(input.resultSnapshot),
        completedAt: now
      };
      this.interventions.set(intervention.id, updatedIntervention);
      this.revisions.set(revision.id, revision);
      this.operations.set(key, operation);
      return {
        run: clone(updatedRun),
        intervention: clone(updatedIntervention),
        revision: clone(revision),
        operation: clone(operation),
        claimed: true
      };
    });
  }

  async listReviewRevisions(runId: string) {
    await this.afterMutations();
    return [...this.revisions.values()]
      .filter((item) => item.runId === runId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map(clone);
  }

  appendOperationEvent(input: Omit<
    Gi088FoundationOperationEventRecord,
    "createdAt"
  >) {
    return this.atomic(() => {
      this.requireRun(input.runId);
      const key = eventKey(input.runId, input.clientOperationId);
      const existing = this.events.get(key);
      if (existing) {
        assertOperationEventReplay(existing, input);
        return { event: clone(existing), created: false };
      }
      const event = { ...clone(input), createdAt: new Date() };
      this.events.set(key, event);
      return { event: clone(event), created: true };
    });
  }

  async listOperationEvents(runId: string) {
    await this.afterMutations();
    return [...this.events.values()]
      .filter((item) => item.runId === runId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map(clone);
  }

  getOrCreateExportSnapshot(input: {
    ownerUserId: string;
    runId: string;
    exportVersion: string;
    payload: Gi088FoundationJson;
    recordCounts: Gi088FoundationJson;
  }) {
    return this.atomic(() => {
      const run = this.requireRun(input.runId);
      if (run.ownerUserId !== input.ownerUserId) {
        throw new Gi088FoundationStoreError("GI088_RUN_NOT_FOUND");
      }
      const payloadHash = createGi088FoundationPayloadHash(input.payload);
      const existing = this.exports.get(run.id);
      if (existing) {
        if (
          existing.exportVersion !== input.exportVersion ||
          existing.payloadHash !== payloadHash
        ) {
          throw new Gi088FoundationStoreError(
            "GI088_EXPORT_SNAPSHOT_IMMUTABLE"
          );
        }
        return { snapshot: clone(existing), created: false };
      }
      const snapshot: Gi088FoundationExportSnapshotRecord = {
        runId: run.id,
        exportVersion: input.exportVersion,
        payload: clone(input.payload),
        payloadHash,
        recordCounts: clone(input.recordCounts),
        createdAt: new Date()
      };
      this.exports.set(run.id, snapshot);
      return { snapshot: clone(snapshot), created: true };
    });
  }
}
