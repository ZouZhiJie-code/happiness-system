import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/gi088-evaluation-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Gi088PrismaFoundationStore } from "@/server/services/evaluation/gi088/foundation-prisma-store";

const INTEGRATION_ENABLED =
  process.env.GI088_FOUNDATION_PRISMA_INTEGRATION === "I_UNDERSTAND";
const describeIntegration = INTEGRATION_ENABLED ? describe : describe.skip;
const PRISMA_INTEGRATION_TEST_TIMEOUT_MS = 60_000;

function resolveIsolatedPreviewTestUrl() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV !== "preview"
  ) {
    throw new Error("GI088_FOUNDATION_TEST_PREVIEW_ONLY");
  }
  if (
    process.env.GI088_FOUNDATION_PRISMA_TEST_IDENTITY !==
    "I_UNDERSTAND_NO_HISTORICAL_DATA"
  ) {
    throw new Error("GI088_FOUNDATION_TEST_IDENTITY_REQUIRED");
  }
  const source = process.env.GI088_FOUNDATION_PRISMA_TEST_DATABASE_URL?.trim();
  if (!source) throw new Error("GI088_FOUNDATION_TEST_DATABASE_URL_REQUIRED");
  if (
    source === process.env.DATABASE_URL?.trim() ||
    source === process.env.EVALUATION_DATABASE_URL?.trim() ||
    source === process.env.EVALUATION_DATABASE_URL_UNPOOLED?.trim()
  ) {
    throw new Error("GI088_FOUNDATION_TEST_SHARED_DATABASE_URL_FORBIDDEN");
  }
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Error("GI088_FOUNDATION_TEST_DATABASE_URL_INVALID");
  }
  const schema = url.searchParams.get("schema") ?? "";
  const expectedSchema =
    process.env.GI088_FOUNDATION_PRISMA_TEST_SCHEMA?.trim() ?? "";
  if (
    schema !== expectedSchema ||
    !/^gi088_foundation_v8r2_test_[a-z0-9_]{1,40}$/u.test(schema)
  ) {
    throw new Error("GI088_FOUNDATION_TEST_SCHEMA_NOT_ISOLATED");
  }
  const expectedHost =
    process.env.GI088_FOUNDATION_PRISMA_TEST_HOST?.trim().toLowerCase() ?? "";
  const expectedDatabase =
    process.env.GI088_FOUNDATION_PRISMA_TEST_DATABASE?.trim() ?? "";
  const actualDatabase = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  if (
    !expectedHost ||
    !expectedDatabase ||
    url.hostname.toLowerCase() !== expectedHost ||
    actualDatabase !== expectedDatabase
  ) {
    throw new Error("GI088_FOUNDATION_TEST_DATABASE_IDENTITY_MISMATCH");
  }
  return { source, schema };
}

describeIntegration("GI-088 v8r2 Prisma foundation store", () => {
  const ownerUserId = `gi088-foundation-it:${randomUUID()}`;
  const evaluationVersionPrefix = `gi088-foundation-it:${randomUUID()}`;
  const evaluationVersions = new Set<string>();
  const runIds = new Set<string>();
  let client: PrismaClient;
  let store: Gi088PrismaFoundationStore;

  function evaluationVersionFor(testName: string) {
    const evaluationVersion = `${evaluationVersionPrefix}:${testName}`;
    evaluationVersions.add(evaluationVersion);
    return evaluationVersion;
  }

  beforeAll(async () => {
    const { source, schema } = resolveIsolatedPreviewTestUrl();
    const runtimeUrl = new URL(source);
    runtimeUrl.searchParams.delete("options");
    client = new PrismaClient({
      datasources: { db: { url: runtimeUrl.toString() } },
      log: ["error"]
    });
    const rows = await client.$queryRaw<Array<{ schema: string }>>`
      SELECT current_schema() AS schema
    `;
    if (rows[0]?.schema === schema) {
      throw new Error("GI088_FOUNDATION_TEST_DEFAULT_SCHEMA_REQUIRED");
    }
    store = new Gi088PrismaFoundationStore(client, schema);
  }, PRISMA_INTEGRATION_TEST_TIMEOUT_MS);

  afterAll(async () => {
    if (!client) return;
    const versions = [...evaluationVersions];
    const storedRuns = await client.gi088EvaluationBatch.findMany({
      where: { ownerUserId, evaluationVersion: { in: versions } },
      select: { id: true }
    });
    const ids = [
      ...new Set([...runIds, ...storedRuns.map((item) => item.id)])
    ];
    if (ids.length > 0) {
      await client.$transaction([
        client.gi088EvaluationExportSnapshot.deleteMany({
          where: { runId: { in: ids } }
        }),
        client.gi088EvaluationOperationEvent.deleteMany({
          where: { runId: { in: ids } }
        }),
        client.gi088EvaluationReviewRevision.deleteMany({
          where: { runId: { in: ids } }
        }),
        client.gi088ProgramIntervention.deleteMany({
          where: { runId: { in: ids } }
        }),
        client.gi088EvaluationCallLedger.deleteMany({
          where: { runId: { in: ids } }
        }),
        client.gi088EvaluationOperation.deleteMany({
          where: { ownerUserId, evaluationVersion: { in: versions } }
        }),
        client.gi088EvaluationBatch.deleteMany({
          where: { id: { in: ids }, ownerUserId }
        })
      ]);
    } else {
      await client.gi088EvaluationOperation.deleteMany({
        where: { ownerUserId, evaluationVersion: { in: versions } }
      });
    }
    await client.$disconnect();
  }, PRISMA_INTEGRATION_TEST_TIMEOUT_MS);

  it("在真实事务中覆盖并发 run、调用领取、恢复血缘、幂等证据与不可变导出", async () => {
    const evaluationVersion = evaluationVersionFor("full-lifecycle");
    const firstRequestedRunId = randomUUID();
    const secondRequestedRunId = randomUUID();
    const createBase = {
      ownerUserId,
      evaluationVersion,
      candidateFingerprint: "fixture-candidate-fingerprint",
      executionFingerprint: "fixture-execution-fingerprint",
      state: { step: 0 },
      gateStatus: "pending" as const,
      gateReasons: []
    };
    const [firstCreate, secondCreate] = await Promise.all([
      store.createRunIdempotently({
        ...createBase,
        runId: firstRequestedRunId,
        clientOperationId: "create-1",
        payloadHash: "create-hash-1"
      }),
      store.createRunIdempotently({
        ...createBase,
        runId: secondRequestedRunId,
        clientOperationId: "create-2",
        payloadHash: "create-hash-2"
      })
    ]);
    const runId = firstCreate.run.id;
    runIds.add(runId);
    expect(secondCreate.run.id).toBe(runId);
    expect([firstCreate.created, secondCreate.created].filter(Boolean)).toHaveLength(1);

    const clientTurnId = randomUUID();
    const turnOperation = {
      ownerUserId,
      evaluationVersion,
      runId,
      clientOperationId: clientTurnId,
      action: "submit_turn",
      payloadHash: "turn-payload-hash"
    };
    const firstCallId = randomUUID();
    const firstTurnId = randomUUID();
    const reserved = await store.reserveTurnWithCall({
      mutation: {
        runId,
        ownerUserId,
        expectedRevision: 0,
        expectedExecutionFingerprint: "fixture-execution-fingerprint",
        nextState: { step: 1 }
      },
      operation: turnOperation,
      call: {
        callId: firstCallId,
        runId,
        taskId: "GI-088-01",
        branch: "high",
        turnId: firstTurnId,
        clientTurnId,
        clientOperationId: clientTurnId,
        attempt: 1,
        kind: "turn",
        requestHash: "request-hash-1",
        effectiveConfig: { provider: "fixture" },
        semanticStateBeforeHash: "semantic-hash-1",
        reservedAt: new Date()
      }
    });
    const replay = await store.reserveTurnWithCall({
      mutation: {
        runId,
        ownerUserId,
        expectedRevision: 0,
        expectedExecutionFingerprint: "fixture-execution-fingerprint",
        nextState: { step: 1 }
      },
      operation: turnOperation,
      call: {
        callId: randomUUID(),
        runId,
        taskId: "GI-088-01",
        branch: "high",
        turnId: randomUUID(),
        clientTurnId,
        clientOperationId: clientTurnId,
        attempt: 1,
        kind: "turn",
        requestHash: "request-hash-1",
        effectiveConfig: { provider: "fixture" },
        semanticStateBeforeHash: "semantic-hash-1",
        reservedAt: new Date()
      }
    });
    expect(reserved.claimed).toBe(true);
    expect(replay.claimed).toBe(false);
    expect(replay.call.callId).toBe(firstCallId);

    const dispatchResults = await Promise.all([
      store.claimDispatch({
        callId: firstCallId,
        dispatchedAt: new Date(),
        executionDeadlineAt: new Date(Date.now() + 60_000)
      }),
      store.claimDispatch({
        callId: firstCallId,
        dispatchedAt: new Date(),
        executionDeadlineAt: new Date(Date.now() + 60_000)
      })
    ]);
    expect(dispatchResults.filter((item) => item.claimed)).toHaveLength(1);
    await store.persistProviderResult({
      callId: firstCallId,
      status: "provider_succeeded",
      providerCompletedAt: new Date(),
      rawFinalOutput: "fixture visible output",
      responseHash: "response-hash-1",
      tokenUsage: { total: 1 },
      providerDiagnostics: { fixture: true },
      errorCode: null
    });
    const finalized = await store.finalizeCall({
      mutation: {
        runId,
        ownerUserId,
        expectedRevision: 1,
        expectedExecutionFingerprint: "fixture-execution-fingerprint",
        nextState: { step: 2 }
      },
      callId: firstCallId,
      finalizedAt: new Date(),
      finalizedResult: { assistantMessageId: "A1" },
      operation: {
        clientOperationId: clientTurnId,
        resultSnapshot: { assistantMessageId: "A1" }
      }
    });
    expect(finalized.call.status).toBe("finalized");

    const invalidRecoveryOperation = {
      ownerUserId,
      evaluationVersion,
      runId,
      clientOperationId: "invalid-recovery",
      action: "automatic_recovery",
      payloadHash: "invalid-recovery-hash"
    };
    await expect(
      store.reserveRecoveryCall({
        mutation: {
          runId,
          ownerUserId,
          expectedRevision: 2,
          expectedExecutionFingerprint: "fixture-execution-fingerprint",
          nextState: { step: 3 }
        },
        operation: invalidRecoveryOperation,
        call: {
          callId: randomUUID(),
          runId,
          taskId: "GI-088-01",
          branch: "high",
          turnId: firstTurnId,
          clientTurnId,
          clientOperationId: "invalid-recovery",
          attempt: 3,
          kind: "manual_retry",
          parentCallId: firstCallId,
          retryTrigger: "fixture",
          requestHash: "request-hash-invalid-recovery",
          effectiveConfig: { provider: "fixture" },
          semanticStateBeforeHash: "semantic-hash-1",
          reservedAt: new Date()
        }
      })
    ).rejects.toMatchObject({ code: "GI088_RECOVERY_CALL_LINEAGE_INVALID" });

    const recoveryCallId = randomUUID();
    await store.reserveRecoveryCall({
      mutation: {
        runId,
        ownerUserId,
        expectedRevision: 2,
        expectedExecutionFingerprint: "fixture-execution-fingerprint",
        nextState: { step: "recovery-reserved" }
      },
      operation: {
        ownerUserId,
        evaluationVersion,
        runId,
        clientOperationId: "automatic-recovery",
        action: "automatic_recovery",
        payloadHash: "automatic-recovery-hash"
      },
      call: {
        callId: recoveryCallId,
        runId,
        taskId: "GI-088-01",
        branch: "high",
        turnId: firstTurnId,
        clientTurnId,
        clientOperationId: "automatic-recovery",
        attempt: 2,
        kind: "automatic_retry",
        parentCallId: firstCallId,
        retryTrigger: "fixture",
        requestHash: "request-hash-recovery",
        effectiveConfig: { provider: "fixture" },
        semanticStateBeforeHash: "semantic-hash-1",
        reservedAt: new Date()
      }
    });
    await expect(
      store.supersedeCallAndCommitRun({
        mutation: {
          runId,
          ownerUserId,
          expectedRevision: 2,
          expectedExecutionFingerprint: "fixture-execution-fingerprint",
          nextState: { step: "must-rollback" }
        },
        operation: {
          ownerUserId,
          evaluationVersion,
          runId,
          clientOperationId: "abort-recovery-stale",
          action: "abort_recovery",
          payloadHash: "abort-recovery-stale-hash"
        },
        resultSnapshot: { callId: recoveryCallId },
        callId: recoveryCallId,
        expectedStatuses: ["reserved"],
        errorCode: "ABORTED_WITH_PARTIAL_EVIDENCE"
      })
    ).rejects.toMatchObject({ code: "GI088_CONCURRENT_UPDATE" });
    expect((await store.findCall(recoveryCallId))?.status).toBe("reserved");
    const superseded = await store.supersedeCallAndCommitRun({
      mutation: {
        runId,
        ownerUserId,
        expectedRevision: 3,
        expectedExecutionFingerprint: "fixture-execution-fingerprint",
        nextState: { step: "recovery-superseded" }
      },
      operation: {
        ownerUserId,
        evaluationVersion,
        runId,
        clientOperationId: "abort-recovery",
        action: "abort_recovery",
        payloadHash: "abort-recovery-hash"
      },
      resultSnapshot: { callId: recoveryCallId, status: "superseded" },
      callId: recoveryCallId,
      expectedStatuses: ["reserved"],
      errorCode: "ABORTED_WITH_PARTIAL_EVIDENCE"
    });
    expect(superseded.call.status).toBe("superseded");

    const interventionBase = {
      runId,
      taskId: "GI-088-01",
      branch: "high",
      turnId: firstTurnId,
      callId: null,
      clientOperationId: "zero-call-control",
      interventionType: "pure_stop",
      originalAction: "stop_follow_up",
      effectiveAction: "deterministic_pause",
      evidenceSpan: "fixture evidence",
      controlDecision: { action: "stop" },
      traceSummary: { providerCallBypassed: true },
      observationFingerprint: "observation-fingerprint"
    };
    const interventionOperation = {
      ownerUserId,
      evaluationVersion,
      runId,
      clientOperationId: "zero-call-control",
      action: "pure_stop",
      payloadHash: "zero-call-control-hash"
    };
    const interventionMutation = {
      runId,
      ownerUserId,
      expectedRevision: 4,
      expectedExecutionFingerprint: "fixture-execution-fingerprint",
      nextState: { step: "zero-call-control" }
    };
    const intervention = await store.commitRunWithIntervention({
      mutation: interventionMutation,
      operation: interventionOperation,
      resultSnapshot: { zeroCallControl: true },
      intervention: { id: randomUUID(), ...interventionBase }
    });
    const interventionReplay = await store.commitRunWithIntervention({
      mutation: interventionMutation,
      operation: interventionOperation,
      resultSnapshot: { zeroCallControl: true },
      intervention: { id: randomUUID(), ...interventionBase }
    });
    expect(intervention.claimed).toBe(true);
    expect(interventionReplay.claimed).toBe(false);
    expect(interventionReplay.intervention.id).toBe(intervention.intervention.id);

    const terminal = await store.commitRunMutation({
      mutation: {
        runId,
        ownerUserId,
        expectedRevision: 5,
        expectedExecutionFingerprint: "fixture-execution-fingerprint",
        nextState: { step: 3, status: "sealed" },
        nextStatus: "sealed",
        nextGateStatus: "no_go",
        sealedAt: new Date()
      },
      operation: {
        ownerUserId,
        evaluationVersion,
        runId,
        clientOperationId: "seal",
        action: "seal",
        payloadHash: "seal-hash"
      },
      resultSnapshot: { status: "sealed" }
    });
    expect(terminal.run.status).toBe("sealed");
    const snapshot = await store.getOrCreateExportSnapshot({
      ownerUserId,
      runId,
      exportVersion: "v0.6",
      payload: { runId, visible: true },
      recordCounts: { calls: 2, interventions: 1 }
    });
    const snapshotReplay = await store.getOrCreateExportSnapshot({
      ownerUserId,
      runId,
      exportVersion: "v0.6",
      payload: { visible: true, runId },
      recordCounts: { calls: 2, interventions: 1 }
    });
    expect(snapshot.created).toBe(true);
    expect(snapshotReplay.created).toBe(false);
    expect(snapshotReplay.snapshot.payloadHash).toBe(snapshot.snapshot.payloadHash);
    await expect(store.findExportSnapshot({
      ownerUserId,
      runId
    })).resolves.toEqual(snapshot.snapshot);
  }, PRISMA_INTEGRATION_TEST_TIMEOUT_MS);

  it("允许零 dispatch 的 reserved 回收调用作为连续恢复父调用", async () => {
    const evaluationVersion = evaluationVersionFor("reserved-recovery");
    const runId = randomUUID();
    const created = await store.createRunIdempotently({
      runId,
      ownerUserId,
      evaluationVersion,
      candidateFingerprint: "fixture-candidate-fingerprint",
      executionFingerprint: "fixture-execution-fingerprint",
      state: { step: 0 },
      gateStatus: "pending",
      clientOperationId: "create-reserved-recovery-run",
      payloadHash: "create-reserved-recovery-run-hash"
    });
    runIds.add(created.run.id);
    expect(created.run.id).toBe(runId);
    const turnId = randomUUID();
    const clientTurnId = randomUUID();
    const parentCallId = randomUUID();
    await store.reserveTurnWithCall({
      mutation: {
        runId,
        ownerUserId,
        expectedRevision: 0,
        expectedExecutionFingerprint: "fixture-execution-fingerprint",
        nextState: { step: 1 }
      },
      operation: {
        ownerUserId,
        evaluationVersion,
        runId,
        clientOperationId: "reserved-parent-operation",
        action: "turn",
        payloadHash: "reserved-parent-operation-hash"
      },
      call: {
        callId: parentCallId,
        runId,
        taskId: "GI-088-02",
        branch: "high",
        turnId,
        clientTurnId,
        clientOperationId: "reserved-parent-operation",
        attempt: 1,
        kind: "turn",
        requestHash: "reserved-parent-request-hash",
        effectiveConfig: { provider: "fixture" },
        semanticStateBeforeHash: "reserved-parent-semantic-hash",
        reservedAt: new Date()
      }
    });
    await store.supersedeCallAndCommitRun({
      mutation: {
        runId,
        ownerUserId,
        expectedRevision: 1,
        expectedExecutionFingerprint: "fixture-execution-fingerprint",
        nextState: { step: "manual_available" }
      },
      operation: {
        ownerUserId,
        evaluationVersion,
        runId,
        clientOperationId: "reconcile-reserved-parent",
        action: "reconcile_reserved_call",
        payloadHash: "reconcile-reserved-parent-hash"
      },
      resultSnapshot: { callId: parentCallId },
      callId: parentCallId,
      expectedStatuses: ["reserved"],
      errorCode: "RESERVED_CALL_INTERRUPTED"
    });
    const recovery = await store.reserveRecoveryCall({
      mutation: {
        runId,
        ownerUserId,
        expectedRevision: 2,
        expectedExecutionFingerprint: "fixture-execution-fingerprint",
        nextState: { step: "manual_retrying" }
      },
      operation: {
        ownerUserId,
        evaluationVersion,
        runId,
        clientOperationId: "retry-reserved-parent",
        action: "manual_retry",
        payloadHash: "retry-reserved-parent-hash"
      },
      call: {
        callId: randomUUID(),
        runId,
        taskId: "GI-088-02",
        branch: "high",
        turnId,
        clientTurnId,
        clientOperationId: "retry-reserved-parent",
        attempt: 2,
        kind: "manual_retry",
        parentCallId,
        retryTrigger: "manual_after_reserved_recovery",
        requestHash: "retry-reserved-parent-request-hash",
        effectiveConfig: { provider: "fixture" },
        semanticStateBeforeHash: "reserved-parent-semantic-hash",
        reservedAt: new Date()
      }
    });
    expect(recovery.claimed).toBe(true);
    expect(recovery.call.attempt).toBe(2);
  }, PRISMA_INTEGRATION_TEST_TIMEOUT_MS);

  it("允许用户主动人工恢复承接 interrupted_unknown_dispatch 调用", async () => {
    const evaluationVersion = evaluationVersionFor("interrupted-recovery");
    const runId = randomUUID();
    const created = await store.createRunIdempotently({
      runId,
      ownerUserId,
      evaluationVersion,
      candidateFingerprint: "fixture-candidate-fingerprint",
      executionFingerprint: "fixture-execution-fingerprint",
      state: { step: 0 },
      gateStatus: "pending",
      clientOperationId: "create-interrupted-recovery-run",
      payloadHash: "create-interrupted-recovery-run-hash"
    });
    runIds.add(created.run.id);
    expect(created.run.id).toBe(runId);
    const turnId = randomUUID();
    const clientTurnId = randomUUID();
    const parentCallId = randomUUID();
    await store.reserveTurnWithCall({
      mutation: {
        runId,
        ownerUserId,
        expectedRevision: 0,
        expectedExecutionFingerprint: "fixture-execution-fingerprint",
        nextState: { step: 1 }
      },
      operation: {
        ownerUserId,
        evaluationVersion,
        runId,
        clientOperationId: "interrupted-parent-operation",
        action: "turn",
        payloadHash: "interrupted-parent-operation-hash"
      },
      call: {
        callId: parentCallId,
        runId,
        taskId: "GI-088-03",
        branch: "high",
        turnId,
        clientTurnId,
        clientOperationId: "interrupted-parent-operation",
        attempt: 1,
        kind: "turn",
        requestHash: "interrupted-parent-request-hash",
        effectiveConfig: { provider: "fixture" },
        semanticStateBeforeHash: "interrupted-parent-semantic-hash",
        reservedAt: new Date()
      }
    });
    await store.claimDispatch({
      callId: parentCallId,
      dispatchedAt: new Date(),
      executionDeadlineAt: new Date(Date.now() + 1_000)
    });
    const interrupted = await store.interruptCallAndCommitRun({
      mutation: {
        runId,
        ownerUserId,
        expectedRevision: 1,
        expectedExecutionFingerprint: "fixture-execution-fingerprint",
        nextState: { step: "manual_available" }
      },
      operation: {
        ownerUserId,
        evaluationVersion,
        runId,
        clientOperationId: "reconcile-interrupted-parent",
        action: "reconcile_interrupted_call",
        payloadHash: "reconcile-interrupted-parent-hash"
      },
      resultSnapshot: { callId: parentCallId },
      callId: parentCallId,
      errorCode: "REQUEST_INTERRUPTED"
    });
    expect(interrupted.call.status).toBe("interrupted_unknown_dispatch");
    const recovery = await store.reserveRecoveryCall({
      mutation: {
        runId,
        ownerUserId,
        expectedRevision: 2,
        expectedExecutionFingerprint: "fixture-execution-fingerprint",
        nextState: { step: "manual_retrying" }
      },
      operation: {
        ownerUserId,
        evaluationVersion,
        runId,
        clientOperationId: "retry-interrupted-parent",
        action: "manual_retry",
        payloadHash: "retry-interrupted-parent-hash"
      },
      call: {
        callId: randomUUID(),
        runId,
        taskId: "GI-088-03",
        branch: "high",
        turnId,
        clientTurnId,
        clientOperationId: "retry-interrupted-parent",
        attempt: 2,
        kind: "manual_retry",
        parentCallId,
        retryTrigger: "manual_after_interrupted_dispatch",
        requestHash: "retry-interrupted-parent-request-hash",
        effectiveConfig: { provider: "fixture" },
        semanticStateBeforeHash: "interrupted-parent-semantic-hash",
        reservedAt: new Date()
      }
    });
    expect(recovery.claimed).toBe(true);
    expect(recovery.call.parentCallId).toBe(parentCallId);
  }, PRISMA_INTEGRATION_TEST_TIMEOUT_MS);

  it("在真实事务中只确认一个并行恢复赢家，并幂等失效迟到结果", async () => {
    const evaluationVersion = evaluationVersionFor("adaptive-race-winner");
    const runId = randomUUID();
    const clientTurnId = randomUUID();
    const turnId = randomUUID();
    const rootCallId = randomUUID();
    const correctionCallId = randomUUID();
    const fastCallId = randomUUID();
    const executionFingerprint = "fixture-adaptive-execution-fingerprint";
    await store.createRunIdempotently({
      runId,
      ownerUserId,
      evaluationVersion,
      candidateFingerprint: "fixture-adaptive-candidate-fingerprint",
      executionFingerprint,
      state: { step: 0 },
      gateStatus: "pending",
      clientOperationId: "create-adaptive-race-run",
      payloadHash: "create-adaptive-race-run-hash"
    });
    runIds.add(runId);

    const reservation = (input: {
      callId: string;
      clientOperationId: string;
      attempt: number;
      kind: "turn" | "automatic_retry" | "fast_hedge";
      parentCallId?: string;
      retryTrigger?: "EMPTY_CONTENT";
      expectedRevision: number;
    }) => ({
      mutation: {
        runId,
        ownerUserId,
        expectedRevision: input.expectedRevision,
        expectedExecutionFingerprint: executionFingerprint,
        nextState: { step: input.expectedRevision + 1 }
      },
      operation: {
        ownerUserId,
        evaluationVersion,
        runId,
        clientOperationId: input.clientOperationId,
        action: input.kind === "turn" ? "submit_turn" : "adaptive_recovery_call",
        payloadHash: `${input.clientOperationId}-payload-hash`
      },
      call: {
        callId: input.callId,
        runId,
        taskId: "GI-088-ADAPTIVE",
        branch: "high" as const,
        turnId,
        clientTurnId,
        clientOperationId: input.clientOperationId,
        attempt: input.attempt,
        kind: input.kind,
        parentCallId: input.parentCallId,
        retryTrigger: input.retryTrigger,
        requestHash: `${input.clientOperationId}-request-hash`,
        effectiveConfig: {
          raceGroupId: "fixture-race-group",
          recoveryRole:
            input.kind === "turn"
              ? "primary_high"
              : input.kind === "automatic_retry"
                ? "high_correction"
                : "fast_formatter"
        },
        semanticStateBeforeHash: "fixture-adaptive-semantic-hash",
        automaticDeadlineAt: new Date(Date.now() + 60_000),
        reservedAt: new Date()
      }
    });

    await store.reserveTurnWithCall(reservation({
      callId: rootCallId,
      clientOperationId: "adaptive-root",
      attempt: 1,
      kind: "turn",
      expectedRevision: 0
    }));
    await store.reserveRecoveryCall(reservation({
      callId: correctionCallId,
      clientOperationId: "adaptive-correction",
      attempt: 2,
      kind: "automatic_retry",
      parentCallId: rootCallId,
      retryTrigger: "EMPTY_CONTENT",
      expectedRevision: 1
    }));
    await store.reserveRecoveryCall(reservation({
      callId: fastCallId,
      clientOperationId: "adaptive-fast",
      attempt: 3,
      kind: "fast_hedge",
      parentCallId: correctionCallId,
      expectedRevision: 2
    }));

    for (const callId of [rootCallId, correctionCallId, fastCallId]) {
      await store.claimDispatch({
        callId,
        dispatchedAt: new Date(),
        executionDeadlineAt: new Date(Date.now() + 60_000)
      });
      await store.persistProviderResult({
        callId,
        status: "provider_succeeded",
        providerCompletedAt: new Date(),
        rawFinalOutput: `visible:${callId}`,
        responseHash: `response:${callId}`,
        tokenUsage: { total: 1 },
        providerDiagnostics: { finishReason: "stop" },
        errorCode: null
      });
    }

    const finalize = (callId: string, clientOperationId: string) =>
      store.finalizeCall({
        mutation: {
          runId,
          ownerUserId,
          expectedRevision: 3,
          expectedExecutionFingerprint: executionFingerprint,
          nextState: { step: 4, winnerCallId: callId }
        },
        callId,
        finalizedAt: new Date(),
        finalizedResult: { winnerCallId: callId },
        operation: {
          clientOperationId,
          resultSnapshot: { winnerCallId: callId }
        },
        supersedeSiblingCallIds: [rootCallId, correctionCallId, fastCallId],
        siblingResultSnapshot: { winnerCallId: callId, status: "superseded" }
      });
    const simultaneous = await Promise.allSettled([
      finalize(correctionCallId, "adaptive-correction"),
      finalize(fastCallId, "adaptive-fast")
    ]);
    expect(simultaneous.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const calls = await store.listCalls(runId);
    const finalizedCalls = calls.filter((call) => call.status === "finalized");
    expect(finalizedCalls).toHaveLength(1);
    expect(calls.filter((call) => call.status === "superseded")).toHaveLength(2);

    const winner = finalizedCalls[0]!;
    const winnerReplay = await finalize(winner.callId, winner.clientOperationId);
    expect(winnerReplay.claimed).toBe(false);
    const lateLoser = calls.find((call) => call.status === "superseded")!;
    const late = await store.persistProviderResult({
      callId: lateLoser.callId,
      status: "provider_succeeded",
      providerCompletedAt: new Date(),
      rawFinalOutput: "late-visible-output",
      responseHash: "late-response-hash",
      tokenUsage: { total: 1 },
      providerDiagnostics: { finishReason: "stop", late: true },
      errorCode: null
    });
    expect(late.claimed).toBe(false);
    expect(late.call.status).toBe("superseded");
    expect((await store.listCalls(runId)).filter((call) => call.status === "finalized"))
      .toHaveLength(1);
  }, PRISMA_INTEGRATION_TEST_TIMEOUT_MS);
});
