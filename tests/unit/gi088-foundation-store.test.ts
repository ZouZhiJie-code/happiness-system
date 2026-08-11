import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { Gi088MemoryFoundationStore } from "@/server/services/evaluation/gi088/foundation-memory-store";
import {
  assertGi088FoundationCallTransition,
  countsAsGi088ProviderDispatch,
  createGi088FoundationCanonicalJson,
  createGi088FoundationPayloadHash,
  GI088_EVALUATION_STORE_VERSION,
  Gi088FoundationStoreError,
  type Gi088FoundationCallStatus
} from "@/server/services/evaluation/gi088/foundation-store";

const schema = readFileSync(
  resolve(process.cwd(), "prisma/evaluation/schema.prisma"),
  "utf8"
);
const migration = readFileSync(
  resolve(
    process.cwd(),
    "prisma/evaluation/migrations/20260810180000_add_v8r2_foundation_hardening/migration.sql"
  ),
  "utf8"
);

describe("GI-088 v8r2 evaluation foundation store", () => {
  it("run 创建后禁止替换离线候选证据与恢复计数", async () => {
    const store = new Gi088MemoryFoundationStore();
    const evidence = {
      candidateOfflineRunFingerprint: "a".repeat(64),
      candidateEvidenceFingerprint: "b".repeat(64),
      admissionFingerprint: "c".repeat(64),
      automaticRecoveryCount: 1
    };
    await store.createRunIdempotently({
      runId: "run-frozen-offline-evidence",
      ownerUserId: "owner-frozen-offline-evidence",
      evaluationVersion: "v8r3",
      candidateFingerprint: "candidate-fp",
      executionFingerprint: "execution-fp",
      state: { step: 0, offlineEvaluationEvidence: evidence },
      gateStatus: "pending",
      clientOperationId: "create-frozen-offline-evidence",
      payloadHash: "create-frozen-offline-evidence"
    });

    await expect(store.getOrCreateExportSnapshot({
      ownerUserId: "owner-frozen-offline-evidence",
      runId: "run-frozen-offline-evidence",
      exportVersion: "v0.7",
      payload: { runId: "run-frozen-offline-evidence" },
      recordCounts: { calls: 0 }
    })).rejects.toMatchObject({ code: "GI088_BATCH_MUST_BE_TERMINAL" });
    expect(await store.findExportSnapshot({
      ownerUserId: "owner-frozen-offline-evidence",
      runId: "run-frozen-offline-evidence"
    })).toBeNull();

    await expect(store.commitRunMutation({
      mutation: {
        runId: "run-frozen-offline-evidence",
        ownerUserId: "owner-frozen-offline-evidence",
        expectedRevision: 0,
        expectedExecutionFingerprint: "execution-fp",
        nextState: {
          step: 1,
          offlineEvaluationEvidence: {
            ...evidence,
            automaticRecoveryCount: 2
          }
        }
      },
      operation: {
        ownerUserId: "owner-frozen-offline-evidence",
        evaluationVersion: "v8r3",
        runId: "run-frozen-offline-evidence",
        clientOperationId: "mutate-frozen-offline-evidence",
        action: "mutate",
        payloadHash: "mutate-frozen-offline-evidence"
      },
      resultSnapshot: { step: 1 }
    })).rejects.toMatchObject({
      code: "GI088_FROZEN_OFFLINE_EVIDENCE_MISMATCH"
    });
    expect((await store.findRun({
      ownerUserId: "owner-frozen-offline-evidence",
      runId: "run-frozen-offline-evidence"
    }))?.revision).toBe(0);
  });

  it("固定 store v2，并为相同 JSON 语义生成稳定 canonical hash", () => {
    expect(GI088_EVALUATION_STORE_VERSION).toBe(
      "2026-08-10.gi088-evaluation-store-v2"
    );
    const first = {
      z: [3, { y: true, x: null }],
      a: "value"
    } as const;
    const second = {
      a: "value",
      z: [3, { x: null, y: true }]
    } as const;

    expect(createGi088FoundationCanonicalJson(first)).toBe(
      createGi088FoundationCanonicalJson(second)
    );
    expect(createGi088FoundationPayloadHash(first)).toBe(
      createGi088FoundationPayloadHash(second)
    );
    expect(
      createGi088FoundationPayloadHash({ ...second, a: "changed" })
    ).not.toBe(createGi088FoundationPayloadHash(first));
  });

  it("只允许冻结调用生命周期中的单向状态迁移", () => {
    expect(() =>
      assertGi088FoundationCallTransition("reserved", "dispatched")
    ).not.toThrow();
    expect(() =>
      assertGi088FoundationCallTransition(
        "dispatched",
        "provider_succeeded"
      )
    ).not.toThrow();
    expect(() =>
      assertGi088FoundationCallTransition("provider_succeeded", "finalized")
    ).not.toThrow();
    expect(() =>
      assertGi088FoundationCallTransition("finalized", "dispatched")
    ).toThrow(
      new Gi088FoundationStoreError(
        "GI088_CALL_STATUS_TRANSITION_INVALID:finalized:dispatched"
      )
    );
  });

  it("调用预算从 dispatched 起计数，reserved 保持零实际调用", () => {
    const statuses: Array<{
      status: Gi088FoundationCallStatus;
      dispatchedAt: Date | null;
    }> = [
      { status: "reserved", dispatchedAt: null },
      { status: "superseded", dispatchedAt: null },
      { status: "dispatched", dispatchedAt: new Date(0) },
      { status: "provider_succeeded", dispatchedAt: new Date(0) },
      { status: "provider_failed", dispatchedAt: new Date(0) },
      { status: "finalized", dispatchedAt: new Date(0) },
      { status: "interrupted_unknown_dispatch", dispatchedAt: new Date(0) },
      { status: "finalization_failed", dispatchedAt: new Date(0) },
      { status: "superseded", dispatchedAt: new Date(0) }
    ];
    expect(
      statuses.map((call) => [
        call.status,
        countsAsGi088ProviderDispatch(call)
      ])
    ).toEqual([
      ["reserved", false],
      ["superseded", false],
      ["dispatched", true],
      ["provider_succeeded", true],
      ["provider_failed", true],
      ["finalized", true],
      ["interrupted_unknown_dispatch", true],
      ["finalization_failed", true],
      ["superseded", true]
    ]);
  });

  it("调用状态集合完整覆盖账本终态", () => {
    const statuses: Gi088FoundationCallStatus[] = [
      "reserved",
      "dispatched",
      "provider_succeeded",
      "provider_failed",
      "finalized",
      "interrupted_unknown_dispatch",
      "finalization_failed",
      "superseded"
    ];
    expect(new Set(statuses).size).toBe(8);
  });

  it("schema 覆盖 run、调用、操作、介入、修订、事件与不可变导出", () => {
    expect(schema).toContain("runOrdinal");
    expect(schema).toContain(
      '@@unique([ownerUserId, evaluationVersion, runOrdinal], map: "gi088_batch_owner_version_ordinal_key")'
    );
    expect(schema).toContain("model Gi088EvaluationCallLedger");
    expect(schema).toContain("@@unique([turnId, attempt]");
    expect(schema).toContain("model Gi088EvaluationOperation");
    expect(schema).toContain("model Gi088ProgramIntervention");
    expect(schema).toContain("model Gi088EvaluationReviewRevision");
    expect(schema).toContain("model Gi088EvaluationOperationEvent");
    expect(schema).toContain("model Gi088EvaluationExportSnapshot");
    expect(schema).not.toContain(
      "@@unique([ownerUserId, evaluationVersion])"
    );
  });

  it("migration 回填 ordinal、显式替换旧唯一索引并保留历史行与 JSON", () => {
    expect(migration).toContain(
      'ADD COLUMN "runOrdinal" INTEGER NOT NULL DEFAULT 1'
    );
    expect(migration).toContain(
      'DROP INDEX IF EXISTS "gi088_evaluation_batches_ownerUserId_evaluationVersion_key"'
    );
    expect(migration).toContain(
      'WHERE "status" = \'running\''
    );
    expect(
      migration.indexOf("gi088_batch_one_running_per_owner_version_key")
    ).toBeLessThan(
      migration.indexOf(
        "gi088_evaluation_batches_ownerUserId_evaluationVersion_key"
      )
    );
    expect(migration).toContain("gi088_intervention_call_type_key");
    expect(migration).toContain(
      "gi088_intervention_zero_call_operation_type_key"
    );
    expect(migration).toContain(
      'CREATE TABLE "gi088_evaluation_call_ledger"'
    );
    expect(migration).not.toMatch(/\bDROP\s+TABLE\b/iu);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/iu);
    expect(migration).not.toMatch(/UPDATE\s+"gi088_evaluation_batches"\s+SET\s+"state"/iu);
  });

  it("Memory Store 串行化并发建 run，并对普通变更执行 operation 幂等与 revision CAS", async () => {
    const store = new Gi088MemoryFoundationStore();
    const createInput = {
      runId: "run-1",
      ownerUserId: "owner-1",
      evaluationVersion: "v8r2",
      candidateFingerprint: "candidate-fp",
      executionFingerprint: "execution-fp",
      state: { step: 0 },
      gateStatus: "pending" as const,
      clientOperationId: "op-create",
      payloadHash: "payload-create"
    };
    const [first, replay] = await Promise.all([
      store.createRunIdempotently(createInput),
      store.createRunIdempotently(createInput)
    ]);
    expect([first.created, replay.created].sort()).toEqual([false, true]);
    expect(first.run.id).toBe(replay.run.id);

    const operation = {
      ownerUserId: "owner-1",
      evaluationVersion: "v8r2",
      runId: "run-1",
      clientOperationId: "op-abort",
      action: "abort",
      payloadHash: "payload-abort"
    };
    const mutation = {
      runId: "run-1",
      ownerUserId: "owner-1",
      expectedRevision: 0,
      expectedExecutionFingerprint: "execution-fp",
      nextState: { step: 1 },
      nextStatus: "early_stopped" as const,
      nextGateStatus: "no_go" as const,
      sealedAt: new Date("2026-08-10T00:00:00.000Z")
    };
    const committed = await store.commitRunMutation({
      mutation,
      operation,
      resultSnapshot: { status: "early_stopped" }
    });
    const committedReplay = await store.commitRunMutation({
      mutation,
      operation,
      resultSnapshot: { status: "early_stopped" }
    });
    expect(committed.claimed).toBe(true);
    expect(committed.run.revision).toBe(1);
    expect(committedReplay.claimed).toBe(false);
    await expect(
      store.commitRunMutation({
        mutation,
        operation: { ...operation, payloadHash: "changed" },
        resultSnapshot: { status: "early_stopped" }
      })
    ).rejects.toMatchObject({ code: "GI088_OPERATION_PAYLOAD_CONFLICT" });
  });

  it("Memory Store 原子保留调用、唯一 dispatch、持久化结果、finalize 与不可变导出", async () => {
    const store = new Gi088MemoryFoundationStore();
    await store.createRunIdempotently({
      runId: "run-call",
      ownerUserId: "owner-1",
      evaluationVersion: "v8r2",
      candidateFingerprint: "candidate-fp",
      executionFingerprint: "execution-fp",
      state: { step: 0 },
      gateStatus: "pending",
      clientOperationId: "op-create-call",
      payloadHash: "payload-create-call"
    });
    const reservation = {
      mutation: {
        runId: "run-call",
        ownerUserId: "owner-1",
        expectedRevision: 0,
        expectedExecutionFingerprint: "execution-fp",
        nextState: { step: 1 }
      },
      operation: {
        ownerUserId: "owner-1",
        evaluationVersion: "v8r2",
        runId: "run-call",
        clientOperationId: "op-turn-1",
        action: "respond",
        payloadHash: "payload-turn-1"
      },
      call: {
        callId: "call-1",
        runId: "run-call",
        taskId: "task-1",
        branch: "primary",
        turnId: "turn-1",
        clientTurnId: "client-turn-1",
        clientOperationId: "op-turn-1",
        attempt: 1,
        kind: "interview_response",
        requestHash: "request-1",
        effectiveConfig: { model: "fixture" },
        semanticStateBeforeHash: "semantic-0",
        reservedAt: new Date("2026-08-10T00:00:01.000Z")
      }
    };
    const reserved = await store.reserveTurnWithCall(reservation);
    const reservedReplay = await store.reserveTurnWithCall(reservation);
    expect(reserved.claimed).toBe(true);
    expect(reservedReplay.claimed).toBe(false);
    const dispatch = await store.claimDispatch({
      callId: "call-1",
      dispatchedAt: new Date("2026-08-10T00:00:02.000Z"),
      executionDeadlineAt: new Date("2026-08-10T00:01:02.000Z")
    });
    const dispatchReplay = await store.claimDispatch({
      callId: "call-1",
      dispatchedAt: new Date("2026-08-10T00:00:02.000Z"),
      executionDeadlineAt: new Date("2026-08-10T00:01:02.000Z")
    });
    expect(dispatch.claimed).toBe(true);
    expect(dispatchReplay.claimed).toBe(false);
    await store.persistProviderResult({
      callId: "call-1",
      status: "provider_succeeded",
      providerCompletedAt: new Date("2026-08-10T00:00:03.000Z"),
      rawFinalOutput: "fixture-visible-output",
      responseHash: "response-1",
      tokenUsage: { total: 1 },
      providerDiagnostics: null,
      errorCode: null
    });
    await expect(
      store.finalizeCall({
        mutation: {
          runId: "run-call",
          ownerUserId: "owner-1",
          expectedRevision: 1,
          expectedExecutionFingerprint: "execution-fp",
          nextState: { step: "wrong-operation" }
        },
        callId: "call-1",
        finalizedAt: new Date("2026-08-10T00:00:03.500Z"),
        finalizedResult: { assistantMessageId: "wrong" },
        operation: {
          clientOperationId: "op-wrong",
          resultSnapshot: { turnId: "turn-1" }
        }
      })
    ).rejects.toMatchObject({ code: "GI088_OPERATION_SCOPE_MISMATCH" });
    const finalized = await store.finalizeCall({
      mutation: {
        runId: "run-call",
        ownerUserId: "owner-1",
        expectedRevision: 1,
        expectedExecutionFingerprint: "execution-fp",
        nextState: { step: 2 }
      },
      callId: "call-1",
      finalizedAt: new Date("2026-08-10T00:00:04.000Z"),
      finalizedResult: { assistantMessageId: "message-1" },
      operation: {
        clientOperationId: "op-turn-1",
        resultSnapshot: { turnId: "turn-1" }
      }
    });
    expect(finalized.call.status).toBe("finalized");
    expect(finalized.run.revision).toBe(2);
    await expect(
      store.reserveRecoveryCall({
        mutation: {
          runId: "run-call",
          ownerUserId: "owner-1",
          expectedRevision: 2,
          expectedExecutionFingerprint: "execution-fp",
          nextState: { step: "invalid-recovery" }
        },
        operation: {
          ownerUserId: "owner-1",
          evaluationVersion: "v8r2",
          runId: "run-call",
          clientOperationId: "op-invalid-recovery",
          action: "manual_retry",
          payloadHash: "payload-invalid-recovery"
        },
        call: {
          callId: "call-invalid-recovery",
          runId: "run-call",
          taskId: "task-1",
          branch: "primary",
          turnId: "turn-1",
          clientTurnId: "client-turn-1",
          clientOperationId: "op-invalid-recovery",
          attempt: 3,
          kind: "manual_retry",
          parentCallId: "call-1",
          retryTrigger: "fixture",
          requestHash: "request-invalid-recovery",
          effectiveConfig: { model: "fixture" },
          semanticStateBeforeHash: "semantic-0",
          reservedAt: new Date("2026-08-10T00:00:04.500Z")
        }
      })
    ).rejects.toMatchObject({ code: "GI088_RECOVERY_CALL_LINEAGE_INVALID" });
    const recovery = await store.reserveRecoveryCall({
      mutation: {
        runId: "run-call",
        ownerUserId: "owner-1",
        expectedRevision: 2,
        expectedExecutionFingerprint: "execution-fp",
        nextState: { step: "recovery-reserved" }
      },
      operation: {
        ownerUserId: "owner-1",
        evaluationVersion: "v8r2",
        runId: "run-call",
        clientOperationId: "op-recovery",
        action: "automatic_recovery",
        payloadHash: "payload-recovery"
      },
      call: {
        callId: "call-recovery",
        runId: "run-call",
        taskId: "task-1",
        branch: "primary",
        turnId: "turn-1",
        clientTurnId: "client-turn-1",
        clientOperationId: "op-recovery",
        attempt: 2,
        kind: "automatic_retry",
        parentCallId: "call-1",
        retryTrigger: "fixture",
        requestHash: "request-recovery",
        effectiveConfig: { model: "fixture" },
        semanticStateBeforeHash: "semantic-0",
        reservedAt: new Date("2026-08-10T00:00:04.600Z")
      }
    });
    expect(recovery.run.revision).toBe(3);
    await expect(
      store.supersedeCallAndCommitRun({
        mutation: {
          runId: "run-call",
          ownerUserId: "owner-1",
          expectedRevision: 2,
          expectedExecutionFingerprint: "execution-fp",
          nextState: { step: "must-rollback" }
        },
        operation: {
          ownerUserId: "owner-1",
          evaluationVersion: "v8r2",
          runId: "run-call",
          clientOperationId: "op-abort-stale",
          action: "abort_recovery",
          payloadHash: "payload-abort-stale"
        },
        resultSnapshot: { callId: "call-recovery" },
        callId: "call-recovery",
        expectedStatuses: ["reserved"],
        errorCode: "ABORTED_WITH_PARTIAL_EVIDENCE"
      })
    ).rejects.toMatchObject({ code: "GI088_CONCURRENT_UPDATE" });
    expect((await store.findCall("call-recovery"))?.status).toBe("reserved");
    expect((await store.findRun({
      ownerUserId: "owner-1",
      runId: "run-call"
    }))?.revision).toBe(3);
    const abandoned = await store.supersedeCallAndCommitRun({
      mutation: {
        runId: "run-call",
        ownerUserId: "owner-1",
        expectedRevision: 3,
        expectedExecutionFingerprint: "execution-fp",
        nextState: { step: "recovery-abandoned" }
      },
      operation: {
        ownerUserId: "owner-1",
        evaluationVersion: "v8r2",
        runId: "run-call",
        clientOperationId: "op-abort-recovery",
        action: "abort_recovery",
        payloadHash: "payload-abort-recovery"
      },
      resultSnapshot: { callId: "call-recovery", status: "superseded" },
      callId: "call-recovery",
      expectedStatuses: ["reserved"],
      errorCode: "ABORTED_WITH_PARTIAL_EVIDENCE"
    });
    expect(abandoned.call.status).toBe("superseded");
    expect(abandoned.run.revision).toBe(4);
    await store.commitRunMutation({
      mutation: {
        runId: "run-call",
        ownerUserId: "owner-1",
        expectedRevision: 4,
        expectedExecutionFingerprint: "execution-fp",
        nextState: { step: 3 },
        nextStatus: "sealed",
        nextGateStatus: "ready_for_final_review",
        sealedAt: new Date("2026-08-10T00:00:05.000Z")
      },
      operation: {
        ownerUserId: "owner-1",
        evaluationVersion: "v8r2",
        runId: "run-call",
        clientOperationId: "op-seal",
        action: "seal",
        payloadHash: "payload-seal"
      },
      resultSnapshot: { status: "sealed" }
    });
    const snapshot = await store.getOrCreateExportSnapshot({
      ownerUserId: "owner-1",
      runId: "run-call",
      exportVersion: "v0.6",
      payload: { runId: "run-call" },
      recordCounts: { calls: 1 }
    });
    const snapshotReplay = await store.getOrCreateExportSnapshot({
      ownerUserId: "owner-1",
      runId: "run-call",
      exportVersion: "v0.6",
      payload: { runId: "run-call" },
      recordCounts: { calls: 1 }
    });
    expect(snapshot.created).toBe(true);
    expect(snapshotReplay.created).toBe(false);
    await expect(store.findExportSnapshot({
      ownerUserId: "owner-1",
      runId: "run-call"
    })).resolves.toEqual(snapshot.snapshot);
    await expect(store.findExportSnapshot({
      ownerUserId: "other-owner",
      runId: "run-call"
    })).rejects.toMatchObject({ code: "GI088_RUN_NOT_FOUND" });
    await expect(
      store.getOrCreateExportSnapshot({
        ownerUserId: "owner-1",
        runId: "run-call",
        exportVersion: "v0.6",
        payload: { runId: "different" },
        recordCounts: { calls: 1 }
      })
    ).rejects.toMatchObject({ code: "GI088_EXPORT_SNAPSHOT_IMMUTABLE" });
  });

  it("对账截止后的迟到 Provider 结果转为 superseded 并保留安全诊断", async () => {
    const store = new Gi088MemoryFoundationStore();
    await store.createRunIdempotently({
      runId: "run-late",
      ownerUserId: "owner-late",
      evaluationVersion: "v8r2",
      candidateFingerprint: "candidate-fp",
      executionFingerprint: "execution-fp",
      state: { step: 0 },
      gateStatus: "pending",
      clientOperationId: "op-create-late",
      payloadHash: "payload-create-late"
    });
    await store.reserveTurnWithCall({
      mutation: {
        runId: "run-late",
        ownerUserId: "owner-late",
        expectedRevision: 0,
        expectedExecutionFingerprint: "execution-fp",
        nextState: { step: 1 }
      },
      operation: {
        ownerUserId: "owner-late",
        evaluationVersion: "v8r2",
        runId: "run-late",
        clientOperationId: "op-turn-late",
        action: "turn",
        payloadHash: "payload-turn-late"
      },
      call: {
        callId: "call-late",
        runId: "run-late",
        taskId: "task-1",
        branch: "high",
        turnId: "turn-late",
        clientTurnId: "op-turn-late",
        clientOperationId: "op-turn-late",
        attempt: 1,
        kind: "turn",
        requestHash: "request-late",
        effectiveConfig: { model: "fixture" },
        semanticStateBeforeHash: "semantic-late",
        reservedAt: new Date("2026-08-10T00:00:00.000Z")
      }
    });
    await store.claimDispatch({
      callId: "call-late",
      dispatchedAt: new Date("2026-08-10T00:00:01.000Z"),
      executionDeadlineAt: new Date("2026-08-10T00:00:02.000Z")
    });
    const interrupted = await store.interruptCallAndCommitRun({
      callId: "call-late",
      errorCode: "REQUEST_INTERRUPTED",
      mutation: {
        runId: "run-late",
        ownerUserId: "owner-late",
        expectedRevision: 1,
        expectedExecutionFingerprint: "execution-fp",
        nextState: { step: "interrupted" }
      },
      operation: {
        ownerUserId: "owner-late",
        evaluationVersion: "v8r2",
        runId: "run-late",
        clientOperationId: "op-interrupt-late",
        action: "reconcile_interrupted_call",
        payloadHash: "payload-interrupt-late"
      },
      resultSnapshot: { callId: "call-late" }
    });
    expect(interrupted.call.status).toBe("interrupted_unknown_dispatch");
    expect(interrupted.run.revision).toBe(2);
    const late = await store.persistProviderResult({
      callId: "call-late",
      status: "provider_succeeded",
      providerCompletedAt: new Date("2026-08-10T00:00:03.000Z"),
      rawFinalOutput: "late visible fixture",
      responseHash: "late-response-hash",
      tokenUsage: { total: 1 },
      providerDiagnostics: { late: true },
      errorCode: null
    });
    expect(late.claimed).toBe(false);
    expect(late.call.status).toBe("superseded");
    expect(late.call.providerResultStatus).toBe("provider_succeeded");
    expect(late.call.rawFinalOutput).toBe("late visible fixture");
    await expect(
      store.reserveRecoveryCall({
        mutation: {
          runId: "run-late",
          ownerUserId: "owner-late",
          expectedRevision: 2,
          expectedExecutionFingerprint: "execution-fp",
          nextState: { step: "must-not-recover-dispatched" }
        },
        operation: {
          ownerUserId: "owner-late",
          evaluationVersion: "v8r2",
          runId: "run-late",
          clientOperationId: "op-invalid-late-recovery",
          action: "manual_retry",
          payloadHash: "payload-invalid-late-recovery"
        },
        call: {
          callId: "call-invalid-late-recovery",
          runId: "run-late",
          taskId: "task-1",
          branch: "high",
          turnId: "turn-late",
          clientTurnId: "op-turn-late",
          clientOperationId: "op-invalid-late-recovery",
          attempt: 2,
          kind: "manual_retry",
          parentCallId: "call-late",
          retryTrigger: "manual_after_reserved_recovery",
          requestHash: "request-invalid-late-recovery",
          effectiveConfig: { model: "fixture" },
          semanticStateBeforeHash: "semantic-late",
          reservedAt: new Date("2026-08-10T00:00:04.000Z")
        }
      })
    ).rejects.toMatchObject({ code: "GI088_RECOVERY_CALL_LINEAGE_INVALID" });
  });

  it("只允许人工恢复承接 interrupted_unknown_dispatch 父调用", async () => {
    const store = new Gi088MemoryFoundationStore();
    await store.createRunIdempotently({
      runId: "run-interrupted-recovery",
      ownerUserId: "owner-interrupted-recovery",
      evaluationVersion: "v8r2",
      candidateFingerprint: "candidate-fp",
      executionFingerprint: "execution-fp",
      state: { step: 0 },
      gateStatus: "pending",
      clientOperationId: "op-create-interrupted-recovery",
      payloadHash: "payload-create-interrupted-recovery"
    });
    await store.reserveTurnWithCall({
      mutation: {
        runId: "run-interrupted-recovery",
        ownerUserId: "owner-interrupted-recovery",
        expectedRevision: 0,
        expectedExecutionFingerprint: "execution-fp",
        nextState: { step: 1 }
      },
      operation: {
        ownerUserId: "owner-interrupted-recovery",
        evaluationVersion: "v8r2",
        runId: "run-interrupted-recovery",
        clientOperationId: "op-interrupted-parent",
        action: "turn",
        payloadHash: "payload-interrupted-parent"
      },
      call: {
        callId: "call-interrupted-parent",
        runId: "run-interrupted-recovery",
        taskId: "task-1",
        branch: "high",
        turnId: "turn-interrupted-parent",
        clientTurnId: "client-turn-interrupted-parent",
        clientOperationId: "op-interrupted-parent",
        attempt: 1,
        kind: "turn",
        requestHash: "request-interrupted-parent",
        effectiveConfig: { model: "fixture" },
        semanticStateBeforeHash: "semantic-interrupted-parent",
        reservedAt: new Date("2026-08-10T00:00:00.000Z")
      }
    });
    await store.claimDispatch({
      callId: "call-interrupted-parent",
      dispatchedAt: new Date("2026-08-10T00:00:01.000Z"),
      executionDeadlineAt: new Date("2026-08-10T00:00:02.000Z")
    });
    const interrupted = await store.interruptCallAndCommitRun({
      callId: "call-interrupted-parent",
      errorCode: "REQUEST_INTERRUPTED",
      mutation: {
        runId: "run-interrupted-recovery",
        ownerUserId: "owner-interrupted-recovery",
        expectedRevision: 1,
        expectedExecutionFingerprint: "execution-fp",
        nextState: { step: "manual_available" }
      },
      operation: {
        ownerUserId: "owner-interrupted-recovery",
        evaluationVersion: "v8r2",
        runId: "run-interrupted-recovery",
        clientOperationId: "op-interrupt-parent",
        action: "reconcile_interrupted_call",
        payloadHash: "payload-interrupt-parent"
      },
      resultSnapshot: { callId: "call-interrupted-parent" }
    });
    expect(interrupted.call.status).toBe("interrupted_unknown_dispatch");

    await expect(
      store.reserveRecoveryCall({
        mutation: {
          runId: "run-interrupted-recovery",
          ownerUserId: "owner-interrupted-recovery",
          expectedRevision: 2,
          expectedExecutionFingerprint: "execution-fp",
          nextState: { step: "automatic_retry_forbidden" }
        },
        operation: {
          ownerUserId: "owner-interrupted-recovery",
          evaluationVersion: "v8r2",
          runId: "run-interrupted-recovery",
          clientOperationId: "op-auto-retry-interrupted",
          action: "automatic_recovery",
          payloadHash: "payload-auto-retry-interrupted"
        },
        call: {
          callId: "call-auto-retry-interrupted",
          runId: "run-interrupted-recovery",
          taskId: "task-1",
          branch: "high",
          turnId: "turn-interrupted-parent",
          clientTurnId: "client-turn-interrupted-parent",
          clientOperationId: "op-auto-retry-interrupted",
          attempt: 2,
          kind: "automatic_retry",
          parentCallId: "call-interrupted-parent",
          retryTrigger: "timeout",
          requestHash: "request-auto-retry-interrupted",
          effectiveConfig: { model: "fixture" },
          semanticStateBeforeHash: "semantic-interrupted-parent",
          reservedAt: new Date("2026-08-10T00:00:03.000Z")
        }
      })
    ).rejects.toMatchObject({ code: "GI088_RECOVERY_CALL_LINEAGE_INVALID" });

    const recovery = await store.reserveRecoveryCall({
      mutation: {
        runId: "run-interrupted-recovery",
        ownerUserId: "owner-interrupted-recovery",
        expectedRevision: 2,
        expectedExecutionFingerprint: "execution-fp",
        nextState: { step: "manual_retrying" }
      },
      operation: {
        ownerUserId: "owner-interrupted-recovery",
        evaluationVersion: "v8r2",
        runId: "run-interrupted-recovery",
        clientOperationId: "op-manual-retry-interrupted",
        action: "manual_retry",
        payloadHash: "payload-manual-retry-interrupted"
      },
      call: {
        callId: "call-manual-retry-interrupted",
        runId: "run-interrupted-recovery",
        taskId: "task-1",
        branch: "high",
        turnId: "turn-interrupted-parent",
        clientTurnId: "client-turn-interrupted-parent",
        clientOperationId: "op-manual-retry-interrupted",
        attempt: 2,
        kind: "manual_retry",
        parentCallId: "call-interrupted-parent",
        retryTrigger: "manual_after_interrupted_dispatch",
        requestHash: "request-manual-retry-interrupted",
        effectiveConfig: { model: "fixture" },
        semanticStateBeforeHash: "semantic-interrupted-parent",
        reservedAt: new Date("2026-08-10T00:00:04.000Z")
      }
    });
    expect(recovery.claimed).toBe(true);
    expect(recovery.call.parentCallId).toBe("call-interrupted-parent");
  });

  it("只允许零 dispatch 的 reserved 回收调用成为下一 attempt 的父调用", async () => {
    const store = new Gi088MemoryFoundationStore();
    await store.createRunIdempotently({
      runId: "run-reserved-recovery",
      ownerUserId: "owner-reserved-recovery",
      evaluationVersion: "v8r2",
      candidateFingerprint: "candidate-fp",
      executionFingerprint: "execution-fp",
      state: { step: 0 },
      gateStatus: "pending",
      clientOperationId: "op-create-reserved-recovery",
      payloadHash: "payload-create-reserved-recovery"
    });
    await store.reserveTurnWithCall({
      mutation: {
        runId: "run-reserved-recovery",
        ownerUserId: "owner-reserved-recovery",
        expectedRevision: 0,
        expectedExecutionFingerprint: "execution-fp",
        nextState: { step: 1 }
      },
      operation: {
        ownerUserId: "owner-reserved-recovery",
        evaluationVersion: "v8r2",
        runId: "run-reserved-recovery",
        clientOperationId: "op-reserved-parent",
        action: "turn",
        payloadHash: "payload-reserved-parent"
      },
      call: {
        callId: "call-reserved-parent",
        runId: "run-reserved-recovery",
        taskId: "task-1",
        branch: "high",
        turnId: "turn-reserved-parent",
        clientTurnId: "client-turn-reserved-parent",
        clientOperationId: "op-reserved-parent",
        attempt: 1,
        kind: "turn",
        requestHash: "request-reserved-parent",
        effectiveConfig: { model: "fixture" },
        semanticStateBeforeHash: "semantic-reserved-parent",
        reservedAt: new Date("2026-08-10T00:00:00.000Z")
      }
    });
    await store.supersedeCallAndCommitRun({
      mutation: {
        runId: "run-reserved-recovery",
        ownerUserId: "owner-reserved-recovery",
        expectedRevision: 1,
        expectedExecutionFingerprint: "execution-fp",
        nextState: { step: "manual_available" }
      },
      operation: {
        ownerUserId: "owner-reserved-recovery",
        evaluationVersion: "v8r2",
        runId: "run-reserved-recovery",
        clientOperationId: "op-reconcile-reserved",
        action: "reconcile_reserved_call",
        payloadHash: "payload-reconcile-reserved"
      },
      resultSnapshot: { callId: "call-reserved-parent" },
      callId: "call-reserved-parent",
      expectedStatuses: ["reserved"],
      errorCode: "RESERVED_CALL_INTERRUPTED"
    });
    const recovery = await store.reserveRecoveryCall({
      mutation: {
        runId: "run-reserved-recovery",
        ownerUserId: "owner-reserved-recovery",
        expectedRevision: 2,
        expectedExecutionFingerprint: "execution-fp",
        nextState: { step: "manual_retrying" }
      },
      operation: {
        ownerUserId: "owner-reserved-recovery",
        evaluationVersion: "v8r2",
        runId: "run-reserved-recovery",
        clientOperationId: "op-retry-reserved",
        action: "manual_retry",
        payloadHash: "payload-retry-reserved"
      },
      call: {
        callId: "call-retry-reserved",
        runId: "run-reserved-recovery",
        taskId: "task-1",
        branch: "high",
        turnId: "turn-reserved-parent",
        clientTurnId: "client-turn-reserved-parent",
        clientOperationId: "op-retry-reserved",
        attempt: 2,
        kind: "manual_retry",
        parentCallId: "call-reserved-parent",
        retryTrigger: "manual_after_reserved_recovery",
        requestHash: "request-retry-reserved",
        effectiveConfig: { model: "fixture" },
        semanticStateBeforeHash: "semantic-reserved-parent",
        reservedAt: new Date("2026-08-10T00:00:02.000Z")
      }
    });
    expect(recovery.claimed).toBe(true);
    expect(recovery.call.attempt).toBe(2);
    expect(recovery.call.parentCallId).toBe("call-reserved-parent");
  });

  it("零调用介入按 operation/type 幂等，操作事件重放核对完整安全 payload", async () => {
    const store = new Gi088MemoryFoundationStore();
    await store.createRunIdempotently({
      runId: "run-evidence",
      ownerUserId: "owner-evidence",
      evaluationVersion: "v8r2",
      candidateFingerprint: "candidate-fp",
      executionFingerprint: "execution-fp",
      state: { step: 0 },
      gateStatus: "pending",
      clientOperationId: "op-create-evidence",
      payloadHash: "payload-create-evidence"
    });
    const intervention = {
      runId: "run-evidence",
      taskId: "task-1",
      branch: "high",
      turnId: "turn-1",
      callId: null,
      clientOperationId: "op-pure-stop",
      interventionType: "pure_stop",
      originalAction: "stop_follow_up",
      effectiveAction: "deterministic_pause",
      evidenceSpan: "停一下",
      controlDecision: { action: "stop" },
      traceSummary: { providerCallBypassed: true },
      observationFingerprint: "observation-1"
    };
    const atomicInput = {
      mutation: {
        runId: "run-evidence",
        ownerUserId: "owner-evidence",
        expectedRevision: 0,
        expectedExecutionFingerprint: "execution-fp",
        nextState: { step: 1 }
      },
      operation: {
        ownerUserId: "owner-evidence",
        evaluationVersion: "v8r2",
        runId: "run-evidence",
        clientOperationId: "op-pure-stop",
        action: "pure_stop",
        payloadHash: "payload-pure-stop"
      },
      resultSnapshot: { zeroCallControl: true }
    };
    const first = await store.commitRunWithIntervention({
      ...atomicInput,
      intervention: { id: "intervention-1", ...intervention }
    });
    const replay = await store.commitRunWithIntervention({
      ...atomicInput,
      intervention: { id: "intervention-2", ...intervention }
    });
    expect(first.claimed).toBe(true);
    expect(replay.claimed).toBe(false);
    expect(replay.intervention.id).toBe("intervention-1");
    await expect(
      store.commitRunWithIntervention({
        ...atomicInput,
        intervention: {
          id: "intervention-3",
          ...intervention,
          traceSummary: { providerCallBypassed: false }
        }
      })
    ).rejects.toMatchObject({ code: "GI088_INTERVENTION_PAYLOAD_CONFLICT" });

    const event = {
      id: "event-1",
      runId: "run-evidence",
      taskId: "task-1",
      turnId: "turn-1",
      route: "/turn",
      code: "DRAFT_RESTORED",
      safeSummary: { count: 1 },
      clientOperationId: "op-event-1"
    };
    await store.appendOperationEvent(event);
    await expect(
      store.appendOperationEvent({
        ...event,
        id: "event-2",
        safeSummary: { count: 2 }
      })
    ).rejects.toMatchObject({ code: "GI088_OPERATION_EVENT_PAYLOAD_CONFLICT" });
  });
});
