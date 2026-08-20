import { randomUUID } from "node:crypto";

import {
  Prisma,
  PrismaClient,
  type Gi088EvaluationBatch,
  type Gi088EvaluationCallLedger,
  type Gi088EvaluationExportSnapshot,
  type Gi088EvaluationOperation,
  type Gi088EvaluationOperationEvent,
  type Gi088EvaluationReviewRevision,
  type Gi088ProgramIntervention
} from "@prisma/gi088-evaluation-client";

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
import { getGi088PrismaClient } from "./prisma-store";

const RUN_STATUSES = ["running", "sealed", "early_stopped"] as const;
const GATE_STATUSES = [
  "pending",
  "no_go",
  "ready_for_final_review",
  "legacy_unknown"
] as const;
const CALL_STATUSES = [
  "reserved",
  "dispatched",
  "provider_succeeded",
  "provider_failed",
  "finalized",
  "interrupted_unknown_dispatch",
  "finalization_failed",
  "superseded"
] as const;
const PROVIDER_RESULT_STATUSES = [
  "provider_succeeded",
  "provider_failed"
] as const;
const OPERATION_STATUSES = ["processing", "completed", "failed"] as const;
const INTERVENTION_REVIEWS = [
  "correct",
  "false_positive",
  "uncertain"
] as const;
const GI088_FOUNDATION_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 15_000,
  timeout: 30_000
} as const;
const GI088_FOUNDATION_ADVISORY_LOCK_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: GI088_FOUNDATION_TRANSACTION_OPTIONS.maxWait,
  timeout: GI088_FOUNDATION_TRANSACTION_OPTIONS.timeout
} as const;

function includes<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function inputJson(value: Gi088FoundationJson): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function nullableInputJson(
  value: Gi088FoundationJson | null
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null ? Prisma.DbNull : inputJson(value);
}

function outputJson(value: Prisma.JsonValue): Gi088FoundationJson {
  return value as Gi088FoundationJson;
}

function nullableOutputJson(
  value: Prisma.JsonValue | null
): Gi088FoundationJson | null {
  return value === null ? null : outputJson(value);
}

function toRunRecord(value: Gi088EvaluationBatch): Gi088FoundationRunRecord {
  if (!includes(RUN_STATUSES, value.status)) {
    throw new Gi088FoundationStoreError("GI088_FOUNDATION_RUN_STATUS_INVALID");
  }
  if (!includes(GATE_STATUSES, value.gateStatus)) {
    throw new Gi088FoundationStoreError("GI088_FOUNDATION_GATE_STATUS_INVALID");
  }
  return {
    ...value,
    status: value.status,
    gateStatus: value.gateStatus,
    gateReasons: nullableOutputJson(value.gateReasons),
    state: outputJson(value.state)
  };
}

function toOperationRecord(
  value: Gi088EvaluationOperation
): Gi088FoundationOperationRecord {
  if (!includes(OPERATION_STATUSES, value.status)) {
    throw new Gi088FoundationStoreError(
      "GI088_FOUNDATION_OPERATION_STATUS_INVALID"
    );
  }
  return {
    ...value,
    status: value.status,
    resultSnapshot: nullableOutputJson(value.resultSnapshot)
  };
}

function toCallRecord(
  value: Gi088EvaluationCallLedger
): Gi088FoundationCallRecord {
  if (!includes(CALL_STATUSES, value.status)) {
    throw new Gi088FoundationStoreError("GI088_FOUNDATION_CALL_STATUS_INVALID");
  }
  if (
    value.providerResultStatus !== null &&
    !includes(PROVIDER_RESULT_STATUSES, value.providerResultStatus)
  ) {
    throw new Gi088FoundationStoreError(
      "GI088_FOUNDATION_PROVIDER_RESULT_STATUS_INVALID"
    );
  }
  return {
    ...value,
    status: value.status,
    providerResultStatus: value.providerResultStatus,
    effectiveConfig: outputJson(value.effectiveConfig),
    tokenUsage: nullableOutputJson(value.tokenUsage),
    providerDiagnostics: nullableOutputJson(value.providerDiagnostics),
    finalizedResult: nullableOutputJson(value.finalizedResult)
  };
}

function toInterventionRecord(
  value: Gi088ProgramIntervention
): Gi088FoundationProgramInterventionRecord {
  if (
    value.reviewOutcome !== null &&
    !includes(INTERVENTION_REVIEWS, value.reviewOutcome)
  ) {
    throw new Gi088FoundationStoreError(
      "GI088_FOUNDATION_INTERVENTION_REVIEW_INVALID"
    );
  }
  return {
    ...value,
    reviewOutcome: value.reviewOutcome,
    controlDecision: nullableOutputJson(value.controlDecision),
    traceSummary: nullableOutputJson(value.traceSummary)
  };
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

function interventionIdentityWhere(input: {
  runId: string;
  callId: string | null;
  clientOperationId: string;
  interventionType: string;
}): Prisma.Gi088ProgramInterventionWhereInput {
  return input.callId
    ? { callId: input.callId, interventionType: input.interventionType }
    : {
        runId: input.runId,
        callId: null,
        clientOperationId: input.clientOperationId,
        interventionType: input.interventionType
      };
}

function assertInterventionReplay(
  existing: Gi088ProgramIntervention,
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
    !sameFoundationJson(
      nullableOutputJson(existing.controlDecision),
      input.controlDecision
    ) ||
    !sameFoundationJson(
      nullableOutputJson(existing.traceSummary),
      input.traceSummary
    )
  ) {
    throw new Gi088FoundationStoreError(
      "GI088_INTERVENTION_PAYLOAD_CONFLICT"
    );
  }
}

function toRevisionRecord(
  value: Gi088EvaluationReviewRevision
): Gi088FoundationReviewRevisionRecord {
  return {
    ...value,
    oldValue: nullableOutputJson(value.oldValue),
    newValue: outputJson(value.newValue)
  };
}

function toEventRecord(
  value: Gi088EvaluationOperationEvent
): Gi088FoundationOperationEventRecord {
  return {
    ...value,
    safeSummary: nullableOutputJson(value.safeSummary)
  };
}

function assertOperationEventReplay(
  existing: Gi088EvaluationOperationEvent,
  input: Omit<Gi088FoundationOperationEventRecord, "createdAt">
) {
  if (
    existing.runId !== input.runId ||
    existing.taskId !== input.taskId ||
    existing.turnId !== input.turnId ||
    existing.route !== input.route ||
    existing.code !== input.code ||
    existing.clientOperationId !== input.clientOperationId ||
    !sameFoundationJson(
      nullableOutputJson(existing.safeSummary),
      input.safeSummary
    )
  ) {
    throw new Gi088FoundationStoreError(
      "GI088_OPERATION_EVENT_PAYLOAD_CONFLICT"
    );
  }
}

function toExportSnapshotRecord(
  value: Gi088EvaluationExportSnapshot
): Gi088FoundationExportSnapshotRecord {
  return {
    ...value,
    payload: outputJson(value.payload),
    recordCounts: outputJson(value.recordCounts)
  };
}

function operationWhere(input: {
  ownerUserId: string;
  evaluationVersion: string;
  clientOperationId: string;
}) {
  return {
    ownerUserId_evaluationVersion_clientOperationId: {
      ownerUserId: input.ownerUserId,
      evaluationVersion: input.evaluationVersion,
      clientOperationId: input.clientOperationId
    }
  } as const;
}

function assertOperationReplay(
  existing: Gi088EvaluationOperation,
  input: Gi088FoundationOperationIdentity
) {
  if (
    existing.action !== input.action ||
    existing.payloadHash !== input.payloadHash ||
    (existing.runId !== null &&
      input.runId !== null &&
      existing.runId !== input.runId)
  ) {
    throw new Gi088FoundationStoreError(
      "GI088_OPERATION_PAYLOAD_CONFLICT"
    );
  }
}

async function lockScope(
  transaction: Prisma.TransactionClient,
  scope: string
) {
  await transaction.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))`
  );
}

async function lockRun(
  transaction: Prisma.TransactionClient,
  runId: string
) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "gi088_evaluation_batches" WHERE "id" = ${runId} FOR UPDATE`
  );
  if (rows.length !== 1) {
    throw new Gi088FoundationStoreError("GI088_RUN_NOT_FOUND");
  }
}

function assertRunMutation(
  run: Gi088EvaluationBatch,
  mutation: Gi088FoundationRunMutation
) {
  if (run.ownerUserId !== mutation.ownerUserId) {
    throw new Gi088FoundationStoreError("GI088_RUN_FORBIDDEN");
  }
  if (run.status !== "running") {
    throw new Gi088FoundationStoreError("GI088_RUN_READ_ONLY");
  }
  if (run.executionFingerprint !== mutation.expectedExecutionFingerprint) {
    throw new Gi088FoundationStoreError("GI088_STORED_FINGERPRINT_MISMATCH");
  }
  if (run.revision !== mutation.expectedRevision) {
    throw new Gi088FoundationStoreError("GI088_CONCURRENT_UPDATE");
  }
}

function runMutationData(
  run: Gi088EvaluationBatch,
  mutation: Gi088FoundationRunMutation
): Prisma.Gi088EvaluationBatchUpdateManyMutationInput {
  return {
    state: inputJson(mutation.nextState),
    status: mutation.nextStatus ?? run.status,
    gateStatus: mutation.nextGateStatus ?? run.gateStatus,
    gateReasons:
      mutation.nextGateReasons === undefined
        ? undefined
        : nullableInputJson(mutation.nextGateReasons),
    sealedAt: mutation.sealedAt === undefined ? run.sealedAt : mutation.sealedAt,
    revision: { increment: 1 }
  };
}

function callCreateData(
  call: Gi088FoundationCallReservation
): Prisma.Gi088EvaluationCallLedgerUncheckedCreateInput {
  if (call.attempt < 1) {
    throw new Gi088FoundationStoreError("GI088_CALL_ATTEMPT_INVALID");
  }
  return {
    callId: call.callId,
    runId: call.runId,
    taskId: call.taskId,
    branch: call.branch,
    turnId: call.turnId,
    clientTurnId: call.clientTurnId,
    clientOperationId: call.clientOperationId,
    attempt: call.attempt,
    kind: call.kind,
    status: "reserved",
    parentCallId: call.parentCallId ?? null,
    retryTrigger: call.retryTrigger ?? null,
    requestHash: call.requestHash,
    effectiveConfig: inputJson(call.effectiveConfig),
    baseAssistantMessageId: call.baseAssistantMessageId ?? null,
    semanticStateBeforeHash: call.semanticStateBeforeHash,
    executionDeadlineAt: call.executionDeadlineAt ?? null,
    automaticDeadlineAt: call.automaticDeadlineAt ?? null,
    reservedAt: call.reservedAt
  };
}

function operationCreateData(
  operation: Gi088FoundationOperationIdentity,
  status: Gi088FoundationOperationStatus = "processing"
): Prisma.Gi088EvaluationOperationUncheckedCreateInput {
  return {
    id: randomUUID(),
    ownerUserId: operation.ownerUserId,
    evaluationVersion: operation.evaluationVersion,
    runId: operation.runId,
    clientOperationId: operation.clientOperationId,
    action: operation.action,
    payloadHash: operation.payloadHash,
    status
  };
}

async function reserveCallInTransaction(input: {
  transaction: Prisma.TransactionClient;
  mutation: Gi088FoundationRunMutation;
  operation: Gi088FoundationOperationIdentity;
  call: Gi088FoundationCallReservation;
}) {
  const { transaction, mutation, operation, call } = input;
  if (operation.runId !== mutation.runId || call.runId !== mutation.runId) {
    throw new Gi088FoundationStoreError("GI088_RUN_SCOPE_MISMATCH");
  }
  await lockRun(transaction, mutation.runId);
  const run = await transaction.gi088EvaluationBatch.findUnique({
    where: { id: mutation.runId }
  });
  if (!run) throw new Gi088FoundationStoreError("GI088_RUN_NOT_FOUND");

  const existingOperation = await transaction.gi088EvaluationOperation.findUnique({
    where: operationWhere(operation)
  });
  if (existingOperation) {
    assertOperationReplay(existingOperation, operation);
    const existingCall = await transaction.gi088EvaluationCallLedger.findFirst({
      where: {
        runId: mutation.runId,
        clientOperationId: operation.clientOperationId,
        attempt: call.attempt
      },
      orderBy: { reservedAt: "asc" }
    });
    if (!existingCall) {
      throw new Gi088FoundationStoreError(
        "GI088_OPERATION_RESULT_INCOMPLETE"
      );
    }
    return {
      run,
      call: existingCall,
      operation: existingOperation,
      claimed: false
    };
  }

  if (call.attempt > 1) {
    const parentCall = call.parentCallId
      ? await transaction.gi088EvaluationCallLedger.findUnique({
          where: { callId: call.parentCallId }
        })
      : null;
    if (
      !parentCall ||
      parentCall.runId !== call.runId ||
      parentCall.taskId !== call.taskId ||
      parentCall.branch !== call.branch ||
      parentCall.turnId !== call.turnId ||
      parentCall.clientTurnId !== call.clientTurnId ||
      parentCall.attempt + 1 !== call.attempt ||
      !isGi088FoundationRecoveryParentAllowed(parentCall, call.kind)
    ) {
      throw new Gi088FoundationStoreError(
        "GI088_RECOVERY_CALL_LINEAGE_INVALID"
      );
    }
  }

  assertRunMutation(run, mutation);

  const createdOperation = await transaction.gi088EvaluationOperation.create({
    data: operationCreateData(operation)
  });
  const createdCall = await transaction.gi088EvaluationCallLedger.create({
    data: callCreateData(call)
  });
  const updated = await transaction.gi088EvaluationBatch.updateMany({
    where: {
      id: mutation.runId,
      ownerUserId: mutation.ownerUserId,
      status: "running",
      revision: mutation.expectedRevision,
      executionFingerprint: mutation.expectedExecutionFingerprint
    },
    data: runMutationData(run, mutation)
  });
  if (updated.count !== 1) {
    throw new Gi088FoundationStoreError("GI088_CONCURRENT_UPDATE");
  }
  const [savedRun, savedOperation] = await Promise.all([
    transaction.gi088EvaluationBatch.findUniqueOrThrow({
      where: { id: mutation.runId }
    }),
    transaction.gi088EvaluationOperation.update({
      where: { id: createdOperation.id },
      data: { resultRevision: mutation.expectedRevision + 1 }
    })
  ]);
  return {
    run: savedRun,
    call: createdCall,
    operation: savedOperation,
    claimed: true
  };
}

async function commitRunWithCallTransitionInTransaction(input: {
  transaction: Prisma.TransactionClient;
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
  await lockRun(input.transaction, input.mutation.runId);
  const [run, call, existingOperation] = await Promise.all([
    input.transaction.gi088EvaluationBatch.findUnique({
      where: { id: input.mutation.runId }
    }),
    input.transaction.gi088EvaluationCallLedger.findUnique({
      where: { callId: input.callId }
    }),
    input.transaction.gi088EvaluationOperation.findUnique({
      where: operationWhere(input.operation)
    })
  ]);
  if (!run) throw new Gi088FoundationStoreError("GI088_RUN_NOT_FOUND");
  if (!call || call.runId !== run.id) {
    throw new Gi088FoundationStoreError("GI088_CALL_NOT_FOUND");
  }
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
    return { run, call, operation: existingOperation, claimed: false };
  }
  assertRunMutation(run, input.mutation);
  if (!input.expectedStatuses.includes(call.status as Gi088FoundationCallStatus)) {
    throw new Gi088FoundationStoreError("GI088_CONCURRENT_UPDATE");
  }
  const operation = await input.transaction.gi088EvaluationOperation.create({
    data: operationCreateData(input.operation)
  });
  const updatedCall = await input.transaction.gi088EvaluationCallLedger.updateMany({
    where: { callId: call.callId, status: call.status },
    data: { status: input.nextStatus, errorCode: input.errorCode }
  });
  if (updatedCall.count !== 1) {
    throw new Gi088FoundationStoreError("GI088_CONCURRENT_UPDATE");
  }
  const updatedRun = await input.transaction.gi088EvaluationBatch.updateMany({
    where: {
      id: run.id,
      ownerUserId: input.mutation.ownerUserId,
      status: "running",
      revision: input.mutation.expectedRevision,
      executionFingerprint: input.mutation.expectedExecutionFingerprint
    },
    data: runMutationData(run, input.mutation)
  });
  if (updatedRun.count !== 1) {
    throw new Gi088FoundationStoreError("GI088_CONCURRENT_UPDATE");
  }
  const completedAt = new Date();
  const savedOperation = await input.transaction.gi088EvaluationOperation.update({
    where: { id: operation.id },
    data: {
      status: "completed",
      resultRevision: input.mutation.expectedRevision + 1,
      resultSnapshot: inputJson(input.resultSnapshot),
      completedAt
    }
  });
  return {
    run: await input.transaction.gi088EvaluationBatch.findUniqueOrThrow({
      where: { id: run.id }
    }),
    call: await input.transaction.gi088EvaluationCallLedger.findUniqueOrThrow({
      where: { callId: call.callId }
    }),
    operation: savedOperation,
    claimed: true
  };
}

export class Gi088PrismaFoundationStore
implements Gi088EvaluationFoundationStore {
  constructor(private readonly client: PrismaClient) {}

  async listRuns(input: {
    ownerUserId: string;
    evaluationVersion?: string;
  }) {
    const records = await this.client.gi088EvaluationBatch.findMany({
      where: {
        ownerUserId: input.ownerUserId,
        evaluationVersion: input.evaluationVersion
      },
      orderBy: [
        { evaluationVersion: "desc" },
        { runOrdinal: "desc" },
        { createdAt: "desc" }
      ]
    });
    return records.map(toRunRecord);
  }

  async findRun(input: { ownerUserId: string; runId: string }) {
    const record = await this.client.gi088EvaluationBatch.findFirst({
      where: { id: input.runId, ownerUserId: input.ownerUserId }
    });
    return record ? toRunRecord(record) : null;
  }

  async createRunIdempotently(input: {
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
    return this.client.$transaction(async (transaction) => {
      await lockScope(
        transaction,
        `gi088:create-run:${input.ownerUserId}:${input.evaluationVersion}`
      );
      const identity: Gi088FoundationOperationIdentity = {
        ownerUserId: input.ownerUserId,
        evaluationVersion: input.evaluationVersion,
        runId: null,
        clientOperationId: input.clientOperationId,
        action: "create_run",
        payloadHash: input.payloadHash
      };
      const existingOperation = await transaction.gi088EvaluationOperation.findUnique({
        where: operationWhere(identity)
      });
      if (existingOperation) {
        assertOperationReplay(existingOperation, identity);
        if (!existingOperation.runId) {
          throw new Gi088FoundationStoreError(
            "GI088_OPERATION_RESULT_INCOMPLETE"
          );
        }
        const existingRun = await transaction.gi088EvaluationBatch.findFirst({
          where: {
            id: existingOperation.runId,
            ownerUserId: input.ownerUserId
          }
        });
        if (!existingRun) {
          throw new Gi088FoundationStoreError("GI088_RUN_NOT_FOUND");
        }
        return {
          run: toRunRecord(existingRun),
          operation: toOperationRecord(existingOperation),
          created: false
        };
      }

      const running = await transaction.gi088EvaluationBatch.findFirst({
        where: {
          ownerUserId: input.ownerUserId,
          evaluationVersion: input.evaluationVersion,
          status: "running"
        }
      });
      if (running) {
        const resultSnapshot = {
          runId: running.id,
          runOrdinal: running.runOrdinal,
          revision: running.revision
        } satisfies Gi088FoundationJson;
        const operation = await transaction.gi088EvaluationOperation.create({
          data: {
            ...operationCreateData(identity, "completed"),
            runId: running.id,
            resultRevision: running.revision,
            resultSnapshot: inputJson(resultSnapshot),
            completedAt: new Date()
          }
        });
        return {
          run: toRunRecord(running),
          operation: toOperationRecord(operation),
          created: false
        };
      }

      const aggregate = await transaction.gi088EvaluationBatch.aggregate({
        where: {
          ownerUserId: input.ownerUserId,
          evaluationVersion: input.evaluationVersion
        },
        _max: { runOrdinal: true }
      });
      const runOrdinal = (aggregate._max.runOrdinal ?? 0) + 1;
      const runId = input.runId ?? randomUUID();
      const run = await transaction.gi088EvaluationBatch.create({
        data: {
          id: runId,
          ownerUserId: input.ownerUserId,
          evaluationVersion: input.evaluationVersion,
          runOrdinal,
          candidateFingerprint: input.candidateFingerprint,
          executionFingerprint: input.executionFingerprint,
          status: "running",
          gateStatus: input.gateStatus,
          gateReasons: nullableInputJson(input.gateReasons ?? null),
          state: inputJson(input.state)
        }
      });
      const resultSnapshot = {
        runId,
        runOrdinal,
        revision: run.revision
      } satisfies Gi088FoundationJson;
      const operation = await transaction.gi088EvaluationOperation.create({
        data: {
          ...operationCreateData(identity, "completed"),
          runId,
          resultRevision: run.revision,
          resultSnapshot: inputJson(resultSnapshot),
          completedAt: new Date()
        }
      });
      return {
        run: toRunRecord(run),
        operation: toOperationRecord(operation),
        created: true
      };
    }, GI088_FOUNDATION_ADVISORY_LOCK_TRANSACTION_OPTIONS);
  }

  async beginOperation(input: Gi088FoundationOperationIdentity) {
    return this.client.$transaction(async (transaction) => {
      await lockScope(
        transaction,
        `gi088:operation:${input.ownerUserId}:${input.evaluationVersion}:${input.clientOperationId}`
      );
      if (input.runId) {
        const run = await transaction.gi088EvaluationBatch.findFirst({
          where: { id: input.runId, ownerUserId: input.ownerUserId }
        });
        if (!run) throw new Gi088FoundationStoreError("GI088_RUN_NOT_FOUND");
      }
      const existing = await transaction.gi088EvaluationOperation.findUnique({
        where: operationWhere(input)
      });
      if (existing) {
        assertOperationReplay(existing, input);
        return { operation: toOperationRecord(existing), claimed: false };
      }
      const operation = await transaction.gi088EvaluationOperation.create({
        data: operationCreateData(input)
      });
      return { operation: toOperationRecord(operation), claimed: true };
    }, GI088_FOUNDATION_ADVISORY_LOCK_TRANSACTION_OPTIONS);
  }

  async findOperation(input: {
    ownerUserId: string;
    evaluationVersion: string;
    clientOperationId: string;
  }) {
    const operation = await this.client.gi088EvaluationOperation.findUnique({
      where: operationWhere(input)
    });
    return operation ? toOperationRecord(operation) : null;
  }

  async completeOperation(input: {
    ownerUserId: string;
    evaluationVersion: string;
    clientOperationId: string;
    status: Exclude<Gi088FoundationOperationStatus, "processing">;
    resultRevision: number | null;
    resultSnapshot: Gi088FoundationJson | null;
    completedAt: Date;
  }) {
    const current = await this.client.gi088EvaluationOperation.findUnique({
      where: operationWhere(input)
    });
    if (!current) {
      throw new Gi088FoundationStoreError("GI088_OPERATION_NOT_FOUND");
    }
    if (current.status !== "processing") {
      return toOperationRecord(current);
    }
    await this.client.gi088EvaluationOperation.updateMany({
      where: { id: current.id, status: "processing" },
      data: {
        status: input.status,
        resultRevision: input.resultRevision,
        resultSnapshot: nullableInputJson(input.resultSnapshot),
        completedAt: input.completedAt
      }
    });
    const winner = await this.client.gi088EvaluationOperation.findUnique({
      where: { id: current.id }
    });
    if (!winner) {
      throw new Gi088FoundationStoreError("GI088_OPERATION_NOT_FOUND");
    }
    return toOperationRecord(winner);
  }

  async reserveTurnWithCall(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    call: Gi088FoundationCallReservation;
  }) {
    const result = await this.client.$transaction(
      (transaction) => reserveCallInTransaction({ transaction, ...input }),
      GI088_FOUNDATION_TRANSACTION_OPTIONS
    );
    return {
      run: toRunRecord(result.run),
      call: toCallRecord(result.call),
      operation: toOperationRecord(result.operation),
      claimed: result.claimed
    };
  }

  async reserveRecoveryCall(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    call: Gi088FoundationCallReservation;
  }) {
    if (
      input.call.attempt < 2 ||
      !input.call.parentCallId ||
      !input.call.retryTrigger
    ) {
      throw new Gi088FoundationStoreError(
        "GI088_RECOVERY_CALL_LINEAGE_INVALID"
      );
    }
    return this.reserveTurnWithCall(input);
  }

  async claimDispatch(input: {
    callId: string;
    dispatchedAt: Date;
    executionDeadlineAt: Date;
  }) {
    const updated = await this.client.gi088EvaluationCallLedger.updateMany({
      where: { callId: input.callId, status: "reserved" },
      data: {
        status: "dispatched",
        dispatchedAt: input.dispatchedAt,
        executionDeadlineAt: input.executionDeadlineAt
      }
    });
    const call = await this.client.gi088EvaluationCallLedger.findUnique({
      where: { callId: input.callId }
    });
    if (!call) throw new Gi088FoundationStoreError("GI088_CALL_NOT_FOUND");
    return { call: toCallRecord(call), claimed: updated.count === 1 };
  }

  async persistProviderResult(input: {
    callId: string;
    status: Gi088FoundationProviderResultStatus;
    providerCompletedAt: Date;
    rawFinalOutput: string | null;
    responseHash: string | null;
    tokenUsage: Gi088FoundationJson | null;
    providerDiagnostics: Gi088FoundationJson | null;
    errorCode: string | null;
  }) {
    const data = {
      status: input.status,
      providerResultStatus: input.status,
      providerCompletedAt: input.providerCompletedAt,
      rawFinalOutput: input.rawFinalOutput,
      responseHash: input.responseHash,
      tokenUsage: nullableInputJson(input.tokenUsage),
      providerDiagnostics: nullableInputJson(input.providerDiagnostics),
      errorCode: input.errorCode
    } satisfies Prisma.Gi088EvaluationCallLedgerUpdateManyMutationInput;
    const updated = await this.client.gi088EvaluationCallLedger.updateMany({
      where: { callId: input.callId, status: "dispatched" },
      data
    });
    let call = await this.client.gi088EvaluationCallLedger.findUnique({
      where: { callId: input.callId }
    });
    if (!call) throw new Gi088FoundationStoreError("GI088_CALL_NOT_FOUND");
    if (updated.count === 1) {
      return { call: toCallRecord(call), claimed: true };
    }
    if (
      call.status === "superseded" ||
      call.status === "interrupted_unknown_dispatch"
    ) {
      call = await this.client.gi088EvaluationCallLedger.update({
        where: { callId: input.callId },
        data: {
          status:
            call.status === "interrupted_unknown_dispatch"
              ? "superseded"
              : undefined,
          providerResultStatus: input.status,
          providerCompletedAt: input.providerCompletedAt,
          rawFinalOutput: input.rawFinalOutput,
          responseHash: input.responseHash,
          tokenUsage: nullableInputJson(input.tokenUsage),
          providerDiagnostics: nullableInputJson(input.providerDiagnostics),
          errorCode: input.errorCode
        }
      });
      return { call: toCallRecord(call), claimed: false };
    }
    if (
      call.providerResultStatus === input.status &&
      call.responseHash === input.responseHash &&
      call.errorCode === input.errorCode
    ) {
      return { call: toCallRecord(call), claimed: false };
    }
    throw new Gi088FoundationStoreError("GI088_PROVIDER_RESULT_CONFLICT");
  }

  async findCall(callId: string) {
    const call = await this.client.gi088EvaluationCallLedger.findUnique({
      where: { callId }
    });
    return call ? toCallRecord(call) : null;
  }

  async listCalls(runId: string) {
    const calls = await this.client.gi088EvaluationCallLedger.findMany({
      where: { runId },
      orderBy: [{ reservedAt: "asc" }, { attempt: "asc" }]
    });
    return calls.map(toCallRecord);
  }

  async compareAndSetCallStatus(input: {
    callId: string;
    expectedStatuses: Gi088FoundationCallStatus[];
    nextStatus: Gi088FoundationCallStatus;
    errorCode?: string | null;
    finalizationError?: string | null;
    providerDiagnostics?: Gi088FoundationJson | null;
  }) {
    if (input.expectedStatuses.length === 0) {
      throw new Gi088FoundationStoreError(
        "GI088_CALL_EXPECTED_STATUS_REQUIRED"
      );
    }
    for (const status of input.expectedStatuses) {
      assertGi088FoundationCallTransition(status, input.nextStatus);
    }
    const data: Prisma.Gi088EvaluationCallLedgerUpdateManyMutationInput = {
      status: input.nextStatus,
      errorCode: input.errorCode,
      finalizationError: input.finalizationError,
      providerDiagnostics:
        input.providerDiagnostics === undefined
          ? undefined
          : nullableInputJson(input.providerDiagnostics)
    };
    const updated = await this.client.gi088EvaluationCallLedger.updateMany({
      where: {
        callId: input.callId,
        status: { in: input.expectedStatuses }
      },
      data
    });
    const call = await this.client.gi088EvaluationCallLedger.findUnique({
      where: { callId: input.callId }
    });
    if (!call) throw new Gi088FoundationStoreError("GI088_CALL_NOT_FOUND");
    return { call: toCallRecord(call), claimed: updated.count === 1 };
  }

  async finalizeCall(input: {
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
    const result = await this.client.$transaction(async (transaction) => {
      await lockRun(transaction, input.mutation.runId);
      const [run, call] = await Promise.all([
        transaction.gi088EvaluationBatch.findUnique({
          where: { id: input.mutation.runId }
        }),
        transaction.gi088EvaluationCallLedger.findUnique({
          where: { callId: input.callId }
        })
      ]);
      if (!run) throw new Gi088FoundationStoreError("GI088_RUN_NOT_FOUND");
      if (!call || call.runId !== run.id) {
        throw new Gi088FoundationStoreError("GI088_CALL_NOT_FOUND");
      }
      if (run.ownerUserId !== input.mutation.ownerUserId) {
        throw new Gi088FoundationStoreError("GI088_RUN_NOT_FOUND");
      }
      if (
        input.operation &&
        call.clientOperationId !== input.operation.clientOperationId
      ) {
        throw new Gi088FoundationStoreError("GI088_OPERATION_SCOPE_MISMATCH");
      }
      if (call.status === "finalized") {
        return { run, call, claimed: false };
      }
      if (
        call.status !== "provider_succeeded" &&
        call.status !== "provider_failed"
      ) {
        throw new Gi088FoundationStoreError(
          "GI088_CALL_NOT_READY_TO_FINALIZE"
        );
      }
      assertRunMutation(run, input.mutation);
      const updatedRun = await transaction.gi088EvaluationBatch.updateMany({
        where: {
          id: run.id,
          ownerUserId: input.mutation.ownerUserId,
          status: "running",
          revision: input.mutation.expectedRevision,
          executionFingerprint:
            input.mutation.expectedExecutionFingerprint
        },
        data: runMutationData(run, input.mutation)
      });
      if (updatedRun.count !== 1) {
        throw new Gi088FoundationStoreError("GI088_CONCURRENT_UPDATE");
      }
      const updatedCall = await transaction.gi088EvaluationCallLedger.updateMany({
        where: {
          callId: input.callId,
          status: call.status
        },
        data: {
          status: "finalized",
          finalizedAt: input.finalizedAt,
          finalizedResult: inputJson(input.finalizedResult),
          errorCode: input.errorCode,
          finalizationError: null
        }
      });
      if (updatedCall.count !== 1) {
        throw new Gi088FoundationStoreError("GI088_CALL_FINALIZE_CONFLICT");
      }
      if (input.operation) {
        const operation = await transaction.gi088EvaluationOperation.findUnique({
          where: operationWhere({
            ownerUserId: input.mutation.ownerUserId,
            evaluationVersion: run.evaluationVersion,
            clientOperationId: input.operation.clientOperationId
          })
        });
        if (!operation || operation.runId !== run.id) {
          throw new Gi088FoundationStoreError("GI088_OPERATION_NOT_FOUND");
        }
        await transaction.gi088EvaluationOperation.update({
          where: { id: operation.id },
          data: {
            status: "completed",
            resultRevision: input.mutation.expectedRevision + 1,
            resultSnapshot: inputJson(input.operation.resultSnapshot),
            completedAt: input.finalizedAt
          }
        });
      }
      return {
        run: await transaction.gi088EvaluationBatch.findUniqueOrThrow({
          where: { id: run.id }
        }),
        call: await transaction.gi088EvaluationCallLedger.findUniqueOrThrow({
          where: { callId: input.callId }
        }),
        claimed: true
      };
    }, GI088_FOUNDATION_TRANSACTION_OPTIONS);
    return {
      run: toRunRecord(result.run),
      call: toCallRecord(result.call),
      claimed: result.claimed
    };
  }

  async commitRunMutation(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    resultSnapshot: Gi088FoundationJson;
  }) {
    const result = await this.client.$transaction(async (transaction) => {
      if (input.operation.runId !== input.mutation.runId) {
        throw new Gi088FoundationStoreError("GI088_RUN_SCOPE_MISMATCH");
      }
      await lockRun(transaction, input.mutation.runId);
      const run = await transaction.gi088EvaluationBatch.findUnique({
        where: { id: input.mutation.runId }
      });
      if (!run) throw new Gi088FoundationStoreError("GI088_RUN_NOT_FOUND");
      const existingOperation =
        await transaction.gi088EvaluationOperation.findUnique({
          where: operationWhere(input.operation)
        });
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
        return { run, operation: existingOperation, claimed: false };
      }
      assertRunMutation(run, input.mutation);
      const operation = await transaction.gi088EvaluationOperation.create({
        data: operationCreateData(input.operation)
      });
      const updated = await transaction.gi088EvaluationBatch.updateMany({
        where: {
          id: run.id,
          ownerUserId: input.mutation.ownerUserId,
          status: "running",
          revision: input.mutation.expectedRevision,
          executionFingerprint:
            input.mutation.expectedExecutionFingerprint
        },
        data: runMutationData(run, input.mutation)
      });
      if (updated.count !== 1) {
        throw new Gi088FoundationStoreError("GI088_CONCURRENT_UPDATE");
      }
      const savedOperation = await transaction.gi088EvaluationOperation.update({
        where: { id: operation.id },
        data: {
          status: "completed",
          resultRevision: input.mutation.expectedRevision + 1,
          resultSnapshot: inputJson(input.resultSnapshot),
          completedAt: new Date()
        }
      });
      return {
        run: await transaction.gi088EvaluationBatch.findUniqueOrThrow({
          where: { id: run.id }
        }),
        operation: savedOperation,
        claimed: true
      };
    }, GI088_FOUNDATION_TRANSACTION_OPTIONS);
    return {
      run: toRunRecord(result.run),
      operation: toOperationRecord(result.operation),
      claimed: result.claimed
    };
  }

  async supersedeCallAndCommitRun(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    resultSnapshot: Gi088FoundationJson;
    callId: string;
    expectedStatuses: Gi088FoundationCallStatus[];
    errorCode: string;
  }) {
    const result = await this.client.$transaction(
      (transaction) =>
        commitRunWithCallTransitionInTransaction({
          transaction,
          ...input,
          nextStatus: "superseded"
        }),
      GI088_FOUNDATION_TRANSACTION_OPTIONS
    );
    return {
      run: toRunRecord(result.run),
      call: toCallRecord(result.call),
      operation: toOperationRecord(result.operation),
      claimed: result.claimed
    };
  }

  async interruptCallAndCommitRun(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    resultSnapshot: Gi088FoundationJson;
    callId: string;
    errorCode: string;
  }) {
    const result = await this.client.$transaction(
      (transaction) =>
        commitRunWithCallTransitionInTransaction({
          transaction,
          ...input,
          expectedStatuses: ["dispatched"],
          nextStatus: "interrupted_unknown_dispatch"
        }),
      GI088_FOUNDATION_TRANSACTION_OPTIONS
    );
    return {
      run: toRunRecord(result.run),
      call: toCallRecord(result.call),
      operation: toOperationRecord(result.operation),
      claimed: result.claimed
    };
  }

  async commitRunWithIntervention(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    resultSnapshot: Gi088FoundationJson;
    intervention: Omit<
      Gi088FoundationProgramInterventionRecord,
      "createdAt" | "updatedAt" | "reviewOutcome" | "reviewReason" | "reviewedAt"
    >;
  }) {
    const result = await this.client.$transaction(async (transaction) => {
      if (
        input.operation.runId !== input.mutation.runId ||
        input.intervention.runId !== input.mutation.runId ||
        input.intervention.clientOperationId !==
          input.operation.clientOperationId
      ) {
        throw new Gi088FoundationStoreError("GI088_RUN_SCOPE_MISMATCH");
      }
      await lockRun(transaction, input.mutation.runId);
      const run = await transaction.gi088EvaluationBatch.findUnique({
        where: { id: input.mutation.runId }
      });
      if (!run) throw new Gi088FoundationStoreError("GI088_RUN_NOT_FOUND");
      const existingOperation =
        await transaction.gi088EvaluationOperation.findUnique({
          where: operationWhere(input.operation)
        });
      if (existingOperation) {
        assertOperationReplay(existingOperation, input.operation);
        const existingIntervention =
          await transaction.gi088ProgramIntervention.findFirst({
            where: interventionIdentityWhere(input.intervention)
          });
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
          run,
          operation: existingOperation,
          intervention: existingIntervention,
          claimed: false
        };
      }
      assertRunMutation(run, input.mutation);
      const operation = await transaction.gi088EvaluationOperation.create({
        data: operationCreateData(input.operation)
      });
      const intervention = await transaction.gi088ProgramIntervention.create({
        data: {
          id: input.intervention.id,
          runId: input.intervention.runId,
          taskId: input.intervention.taskId,
          branch: input.intervention.branch,
          turnId: input.intervention.turnId,
          callId: input.intervention.callId,
          clientOperationId: input.intervention.clientOperationId,
          interventionType: input.intervention.interventionType,
          originalAction: input.intervention.originalAction,
          effectiveAction: input.intervention.effectiveAction,
          evidenceSpan: input.intervention.evidenceSpan,
          controlDecision: nullableInputJson(
            input.intervention.controlDecision
          ),
          traceSummary: nullableInputJson(input.intervention.traceSummary),
          observationFingerprint:
            input.intervention.observationFingerprint
        }
      });
      const updated = await transaction.gi088EvaluationBatch.updateMany({
        where: {
          id: run.id,
          ownerUserId: input.mutation.ownerUserId,
          status: "running",
          revision: input.mutation.expectedRevision,
          executionFingerprint:
            input.mutation.expectedExecutionFingerprint
        },
        data: runMutationData(run, input.mutation)
      });
      if (updated.count !== 1) {
        throw new Gi088FoundationStoreError("GI088_CONCURRENT_UPDATE");
      }
      const completedAt = new Date();
      const savedOperation = await transaction.gi088EvaluationOperation.update({
        where: { id: operation.id },
        data: {
          status: "completed",
          resultRevision: input.mutation.expectedRevision + 1,
          resultSnapshot: inputJson(input.resultSnapshot),
          completedAt
        }
      });
      return {
        run: await transaction.gi088EvaluationBatch.findUniqueOrThrow({
          where: { id: run.id }
        }),
        operation: savedOperation,
        intervention,
        claimed: true
      };
    }, GI088_FOUNDATION_TRANSACTION_OPTIONS);
    return {
      run: toRunRecord(result.run),
      operation: toOperationRecord(result.operation),
      intervention: toInterventionRecord(result.intervention),
      claimed: result.claimed
    };
  }

  async appendProgramIntervention(input: Omit<
    Gi088FoundationProgramInterventionRecord,
    "createdAt" | "updatedAt" | "reviewOutcome" | "reviewReason" | "reviewedAt"
  >) {
    const run = await this.client.gi088EvaluationBatch.findUnique({
      where: { id: input.runId },
      select: { id: true }
    });
    if (!run) throw new Gi088FoundationStoreError("GI088_RUN_NOT_FOUND");
    const existing = await this.client.gi088ProgramIntervention.findFirst({
      where: {
        OR: [
          { id: input.id },
          interventionIdentityWhere(input)
        ]
      }
    });
    if (existing) {
      assertInterventionReplay(existing, input);
      return { intervention: toInterventionRecord(existing), created: false };
    }
    try {
      const intervention = await this.client.gi088ProgramIntervention.create({
        data: {
          id: input.id,
          runId: input.runId,
          taskId: input.taskId,
          branch: input.branch,
          turnId: input.turnId,
          callId: input.callId,
          clientOperationId: input.clientOperationId,
          interventionType: input.interventionType,
          originalAction: input.originalAction,
          effectiveAction: input.effectiveAction,
          evidenceSpan: input.evidenceSpan,
          controlDecision: nullableInputJson(input.controlDecision),
          traceSummary: nullableInputJson(input.traceSummary),
          observationFingerprint: input.observationFingerprint
        }
      });
      return { intervention: toInterventionRecord(intervention), created: true };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const winner = await this.client.gi088ProgramIntervention.findFirst({
        where: {
          OR: [
            { id: input.id },
            interventionIdentityWhere(input)
          ]
        }
      });
      if (!winner) throw error;
      assertInterventionReplay(winner, input);
      return { intervention: toInterventionRecord(winner), created: false };
    }
  }

  async listProgramInterventions(runId: string) {
    const records = await this.client.gi088ProgramIntervention.findMany({
      where: { runId },
      orderBy: { createdAt: "asc" }
    });
    return records.map(toInterventionRecord);
  }

  async commitReviewMutation(input: {
    mutation: Gi088FoundationRunMutation;
    operation: Gi088FoundationOperationIdentity;
    revision: Omit<Gi088FoundationReviewRevisionRecord, "createdAt">;
    resultSnapshot: Gi088FoundationJson;
  }) {
    const result = await this.client.$transaction(async (transaction) => {
      if (
        input.operation.runId !== input.mutation.runId ||
        input.revision.runId !== input.mutation.runId ||
        input.revision.clientOperationId !== input.operation.clientOperationId
      ) {
        throw new Gi088FoundationStoreError("GI088_RUN_SCOPE_MISMATCH");
      }
      await lockRun(transaction, input.mutation.runId);
      const run = await transaction.gi088EvaluationBatch.findUnique({
        where: { id: input.mutation.runId }
      });
      if (!run) throw new Gi088FoundationStoreError("GI088_RUN_NOT_FOUND");
      const existingOperation = await transaction.gi088EvaluationOperation.findUnique({
        where: operationWhere(input.operation)
      });
      if (existingOperation) {
        assertOperationReplay(existingOperation, input.operation);
        const existingRevision = await transaction.gi088EvaluationReviewRevision.findUnique({
          where: {
            runId_clientOperationId: {
              runId: input.mutation.runId,
              clientOperationId: input.operation.clientOperationId
            }
          }
        });
        if (!existingRevision) {
          throw new Gi088FoundationStoreError(
            "GI088_OPERATION_RESULT_INCOMPLETE"
          );
        }
        return {
          run,
          revision: existingRevision,
          operation: existingOperation,
          claimed: false
        };
      }
      assertRunMutation(run, input.mutation);
      const operation = await transaction.gi088EvaluationOperation.create({
        data: operationCreateData(input.operation)
      });
      const revision = await transaction.gi088EvaluationReviewRevision.create({
        data: {
          id: input.revision.id,
          runId: input.revision.runId,
          subjectType: input.revision.subjectType,
          subjectId: input.revision.subjectId,
          oldValue: nullableInputJson(input.revision.oldValue),
          newValue: inputJson(input.revision.newValue),
          reason: input.revision.reason,
          actorUserId: input.revision.actorUserId,
          clientOperationId: input.revision.clientOperationId
        }
      });
      const updated = await transaction.gi088EvaluationBatch.updateMany({
        where: {
          id: run.id,
          ownerUserId: input.mutation.ownerUserId,
          status: "running",
          revision: input.mutation.expectedRevision,
          executionFingerprint:
            input.mutation.expectedExecutionFingerprint
        },
        data: runMutationData(run, input.mutation)
      });
      if (updated.count !== 1) {
        throw new Gi088FoundationStoreError("GI088_CONCURRENT_UPDATE");
      }
      const savedOperation = await transaction.gi088EvaluationOperation.update({
        where: { id: operation.id },
        data: {
          status: "completed",
          resultRevision: input.mutation.expectedRevision + 1,
          resultSnapshot: inputJson(input.resultSnapshot),
          completedAt: new Date()
        }
      });
      return {
        run: await transaction.gi088EvaluationBatch.findUniqueOrThrow({
          where: { id: run.id }
        }),
        revision,
        operation: savedOperation,
        claimed: true
      };
    }, GI088_FOUNDATION_TRANSACTION_OPTIONS);
    return {
      run: toRunRecord(result.run),
      revision: toRevisionRecord(result.revision),
      operation: toOperationRecord(result.operation),
      claimed: result.claimed
    };
  }

  async reviewProgramIntervention(input: {
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
    const result = await this.client.$transaction(async (transaction) => {
      if (
        input.operation.runId !== input.mutation.runId ||
        input.revision.runId !== input.mutation.runId ||
        input.revision.clientOperationId !== input.operation.clientOperationId
      ) {
        throw new Gi088FoundationStoreError("GI088_RUN_SCOPE_MISMATCH");
      }
      await lockRun(transaction, input.mutation.runId);
      const [run, intervention, existingOperation] = await Promise.all([
        transaction.gi088EvaluationBatch.findUnique({
          where: { id: input.mutation.runId }
        }),
        transaction.gi088ProgramIntervention.findUnique({
          where: { id: input.interventionId }
        }),
        transaction.gi088EvaluationOperation.findUnique({
          where: operationWhere(input.operation)
        })
      ]);
      if (!run) throw new Gi088FoundationStoreError("GI088_RUN_NOT_FOUND");
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
      if (existingOperation) {
        assertOperationReplay(existingOperation, input.operation);
        const existingRevision = await transaction.gi088EvaluationReviewRevision.findUnique({
          where: {
            runId_clientOperationId: {
              runId: run.id,
              clientOperationId: input.operation.clientOperationId
            }
          }
        });
        if (!existingRevision) {
          throw new Gi088FoundationStoreError(
            "GI088_OPERATION_RESULT_INCOMPLETE"
          );
        }
        return {
          run,
          intervention,
          revision: existingRevision,
          operation: existingOperation,
          claimed: false
        };
      }
      assertRunMutation(run, input.mutation);
      const operation = await transaction.gi088EvaluationOperation.create({
        data: operationCreateData(input.operation)
      });
      const savedIntervention = await transaction.gi088ProgramIntervention.update({
        where: { id: intervention.id },
        data: {
          reviewOutcome: input.reviewOutcome,
          reviewReason: input.reviewReason,
          reviewedAt: input.reviewedAt
        }
      });
      const revision = await transaction.gi088EvaluationReviewRevision.create({
        data: {
          id: input.revision.id,
          runId: input.revision.runId,
          subjectType: input.revision.subjectType,
          subjectId: input.revision.subjectId,
          oldValue: nullableInputJson(input.revision.oldValue),
          newValue: inputJson(input.revision.newValue),
          reason: input.revision.reason,
          actorUserId: input.revision.actorUserId,
          clientOperationId: input.revision.clientOperationId
        }
      });
      const updated = await transaction.gi088EvaluationBatch.updateMany({
        where: {
          id: run.id,
          ownerUserId: input.mutation.ownerUserId,
          status: "running",
          revision: input.mutation.expectedRevision,
          executionFingerprint:
            input.mutation.expectedExecutionFingerprint
        },
        data: runMutationData(run, input.mutation)
      });
      if (updated.count !== 1) {
        throw new Gi088FoundationStoreError("GI088_CONCURRENT_UPDATE");
      }
      const savedOperation = await transaction.gi088EvaluationOperation.update({
        where: { id: operation.id },
        data: {
          status: "completed",
          resultRevision: input.mutation.expectedRevision + 1,
          resultSnapshot: inputJson(input.resultSnapshot),
          completedAt: input.reviewedAt
        }
      });
      return {
        run: await transaction.gi088EvaluationBatch.findUniqueOrThrow({
          where: { id: run.id }
        }),
        intervention: savedIntervention,
        revision,
        operation: savedOperation,
        claimed: true
      };
    }, GI088_FOUNDATION_TRANSACTION_OPTIONS);
    return {
      run: toRunRecord(result.run),
      intervention: toInterventionRecord(result.intervention),
      revision: toRevisionRecord(result.revision),
      operation: toOperationRecord(result.operation),
      claimed: result.claimed
    };
  }

  async listReviewRevisions(runId: string) {
    const records = await this.client.gi088EvaluationReviewRevision.findMany({
      where: { runId },
      orderBy: { createdAt: "asc" }
    });
    return records.map(toRevisionRecord);
  }

  async appendOperationEvent(input: Omit<
    Gi088FoundationOperationEventRecord,
    "createdAt"
  >) {
    const existing = await this.client.gi088EvaluationOperationEvent.findUnique({
      where: {
        runId_clientOperationId: {
          runId: input.runId,
          clientOperationId: input.clientOperationId
        }
      }
    });
    if (existing) {
      assertOperationEventReplay(existing, input);
      return { event: toEventRecord(existing), created: false };
    }
    const run = await this.client.gi088EvaluationBatch.findUnique({
      where: { id: input.runId },
      select: { id: true }
    });
    if (!run) throw new Gi088FoundationStoreError("GI088_RUN_NOT_FOUND");
    try {
      const event = await this.client.gi088EvaluationOperationEvent.create({
        data: {
          id: input.id,
          runId: input.runId,
          taskId: input.taskId,
          turnId: input.turnId,
          route: input.route,
          code: input.code,
          safeSummary: nullableInputJson(input.safeSummary),
          clientOperationId: input.clientOperationId
        }
      });
      return { event: toEventRecord(event), created: true };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const winner =
        await this.client.gi088EvaluationOperationEvent.findUnique({
          where: {
            runId_clientOperationId: {
              runId: input.runId,
              clientOperationId: input.clientOperationId
            }
          }
        });
      if (!winner) throw error;
      assertOperationEventReplay(winner, input);
      return { event: toEventRecord(winner), created: false };
    }
  }

  async listOperationEvents(runId: string) {
    const records = await this.client.gi088EvaluationOperationEvent.findMany({
      where: { runId },
      orderBy: { createdAt: "asc" }
    });
    return records.map(toEventRecord);
  }

  async getOrCreateExportSnapshot(input: {
    ownerUserId: string;
    runId: string;
    exportVersion: string;
    payload: Gi088FoundationJson;
    recordCounts: Gi088FoundationJson;
  }) {
    const payloadHash = createGi088FoundationPayloadHash(input.payload);
    return this.client.$transaction(async (transaction) => {
      await lockRun(transaction, input.runId);
      const run = await transaction.gi088EvaluationBatch.findFirst({
        where: { id: input.runId, ownerUserId: input.ownerUserId }
      });
      if (!run) throw new Gi088FoundationStoreError("GI088_RUN_NOT_FOUND");
      const existing = await transaction.gi088EvaluationExportSnapshot.findUnique({
        where: { runId: input.runId }
      });
      if (existing) {
        if (
          existing.exportVersion !== input.exportVersion ||
          existing.payloadHash !== payloadHash
        ) {
          throw new Gi088FoundationStoreError(
            "GI088_EXPORT_SNAPSHOT_IMMUTABLE"
          );
        }
        return { snapshot: toExportSnapshotRecord(existing), created: false };
      }
      const snapshot = await transaction.gi088EvaluationExportSnapshot.create({
        data: {
          runId: input.runId,
          exportVersion: input.exportVersion,
          payload: inputJson(input.payload),
          payloadHash,
          recordCounts: inputJson(input.recordCounts)
        }
      });
      return { snapshot: toExportSnapshotRecord(snapshot), created: true };
    }, GI088_FOUNDATION_TRANSACTION_OPTIONS);
  }
}

export function createGi088PrismaFoundationStore(
  client: PrismaClient = getGi088PrismaClient()
) {
  return new Gi088PrismaFoundationStore(client);
}
