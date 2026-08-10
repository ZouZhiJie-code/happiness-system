import { describe, expect, it, vi } from "vitest";

import type {
  AICompletionParams,
  AIProvider,
  AIProviderDiagnostics
} from "@/server/services/ai/ai-provider";
import {
  GI088_EVALUATION_ID_V1,
  GI088_EVALUATION_ID_V2,
  GI088_EVALUATION_ID_V3,
  GI088_EVALUATION_ID_V4,
  GI088_EVALUATION_ID_V5,
  GI088_EVALUATION_ID_V6,
  GI088_EVALUATION_ID_V7,
  GI088_EVALUATION_ID_V7R1,
  GI088_EVALUATION_ID_V7R2,
  GI088_EVALUATION_ID_V7R3,
  GI088_EVALUATION_ID_V7R4,
  GI088_EVALUATION_ID_V8,
  GI088_EVALUATION_ID_V8R1,
  GI088_EVALUATION_VERSION,
  GI088_EVALUATION_VERSION_V1,
  GI088_EVALUATION_VERSION_V2,
  GI088_EVALUATION_VERSION_V3,
  GI088_EVALUATION_VERSION_V4,
  GI088_EVALUATION_VERSION_V5,
  GI088_EVALUATION_VERSION_V6,
  GI088_EVALUATION_VERSION_V7,
  GI088_EVALUATION_VERSION_V7R1,
  GI088_EVALUATION_VERSION_V7R2,
  GI088_EVALUATION_VERSION_V7R3,
  GI088_EVALUATION_VERSION_V7R4,
  GI088_EVALUATION_VERSION_V8,
  GI088_EVALUATION_VERSION_V8R1,
  GI088_SERVICE_VERSION_V1,
  GI088_SERVICE_VERSION_V2,
  GI088_SERVICE_VERSION_V3,
  GI088_SERVICE_VERSION_V4,
  GI088_SERVICE_VERSION_V5,
  GI088_SERVICE_VERSION_V6,
  GI088_SERVICE_VERSION_V7,
  GI088_SERVICE_VERSION_V7R1,
  GI088_SERVICE_VERSION_V7R2,
  GI088_SERVICE_VERSION_V7R3,
  GI088_SERVICE_VERSION_V7R4,
  GI088_SERVICE_VERSION_V8,
  GI088_SERVICE_VERSION_V8R1,
  GI088_SHARED_RECOVERY_DEADLINE_POLICY,
  GI088_V5_TASKS,
  GI088_V6_TASKS,
  GI088_V8R1_TASKS,
  createGi088DatasetFingerprint
} from "@/server/services/evaluation/gi088/candidate";
import { Gi088MemoryFoundationStore } from "@/server/services/evaluation/gi088/foundation-memory-store";
import {
  Gi088EvaluationFoundationService,
  type Gi088FoundationExecutionEvent
} from "@/server/services/evaluation/gi088/foundation-service";
import {
  Gi088FoundationStoreError,
  type Gi088EvaluationFoundationStore,
  type Gi088FoundationJson
} from "@/server/services/evaluation/gi088/foundation-store";
import type {
  Gi088BatchState,
  Gi088EvaluationMode
} from "@/server/services/evaluation/gi088/types";

const HIDDEN_REASONING_SENTINEL = "PRIVATE_HIDDEN_REASONING_SENTINEL";
const LEGACY_HIDDEN_REASONING_SENTINEL =
  "PRIVATE_LEGACY_HIDDEN_REASONING_SENTINEL";
const LEGACY_VISIBLE_RAW_OUTPUT = "LEGACY_VISIBLE_RAW_OUTPUT";

function firstTurnOutput() {
  return JSON.stringify({
    semantic: {
      stage: "engage_focus",
      action: "ask",
      workingTask: {
        continuity: "new",
        targetRef: null,
        summary: "共同弄清用户此刻最想展开的真实困扰",
        evidenceRefs: ["U1"]
      },
      understandingChange: {
        kind: "add",
        summary: "用户已经提供一段当前真实内容",
        evidenceRefs: ["U1"]
      },
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: {
        answerTarget: "这件事目前最卡住用户的一处具体感受",
        taskEffect: "帮助共同任务找到一个可以继续深入的现实入口",
        evidenceRefs: ["U1"]
      },
      answerOpportunity: "new",
      burdenSignalChange: { kind: "unchanged" },
      pauseReason: null
    },
    visible: {
      understanding: "我先跟着你刚才说的这件事往下看。",
      response: "它目前最卡住你的那一处，具体是什么感受？"
    }
  });
}

function unauthorizedPauseOutput() {
  const output = JSON.parse(firstTurnOutput()) as {
    semantic: Record<string, unknown>;
    visible: { understanding: string | null; response: string };
  };
  output.semantic.action = "pause";
  output.semantic.nextInquiry = null;
  output.semantic.answerOpportunity = null;
  output.semantic.pauseReason = "content_sufficient";
  output.visible.response = "先停在这里。";
  return JSON.stringify(output);
}

function fakeProvider(outputs: string[] = [firstTurnOutput()]) {
  const params: AICompletionParams[] = [];
  let index = 0;
  const provider: AIProvider = {
    name: "fake-gi088-foundation",
    complete: vi.fn(async (input) => {
      params.push(input);
      const content = outputs[Math.min(index, outputs.length - 1)]!;
      index += 1;
      return {
        content,
        latencyMs: 7,
        provider: "fake-gi088-foundation",
        tokenUsage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30
        },
        diagnostics: {
          finishReason: "stop",
          reasoningPresent: true,
          reasoningLength: 32,
          reasoningTokens: 8,
          latencyMs: 7,
          tokenUsage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30
          },
          reasoning_content: HIDDEN_REASONING_SENTINEL
        } as unknown as AIProviderDiagnostics
      };
    })
  };
  return { provider, params };
}

function serviceWith(input?: {
  store?: Gi088MemoryFoundationStore;
  provider?: AIProvider;
  getProvider?: () => AIProvider | Promise<AIProvider>;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
}) {
  const store = input?.store ?? new Gi088MemoryFoundationStore();
  const fallback = fakeProvider();
  const provider = input?.provider ?? fallback.provider;
  const getProvider = input?.getProvider ?? vi.fn(() => provider);
  const service = new Gi088EvaluationFoundationService({
    store,
    getProvider,
    authorizeModelCall: vi.fn(),
    now: input?.now,
    sleep: input?.sleep
  });
  return { store, service, provider, getProvider };
}

async function createRun(
  service: Gi088EvaluationFoundationService,
  ownerUserId: string,
  clientOperationId = "create-run"
) {
  return service.createRun({ ownerUserId, clientOperationId });
}

async function createHistoricalEvidenceState() {
  const seedStore = new Gi088MemoryFoundationStore();
  const fake = fakeProvider();
  const seed = serviceWith({ store: seedStore, provider: fake.provider });
  const created = await createRun(seed.service, "owner-historical-seed");
  const session = await seed.service.startTask({
    ownerUserId: "owner-historical-seed",
    runId: created.runId,
    taskId: "A1",
    initialUserMessage: "这段历史原话、调用和评价都要保持原样。",
    clientOperationId: "historical-seed-turn"
  });
  const stored = await seedStore.findRun({
    ownerUserId: "owner-historical-seed",
    runId: created.runId
  });
  if (!stored || !session.activeTask) {
    throw new Error("GI088_HISTORICAL_TEST_SEED_FAILED");
  }
  const state = structuredClone(
    stored.state
  ) as unknown as Gi088BatchState;
  const task = state.tasks.find((item) => item.taskId === "A1");
  const publicTurn = session.activeTask.branches.high.turns[0];
  if (!task || !publicTurn?.calls[0]) {
    throw new Error("GI088_HISTORICAL_TEST_EVIDENCE_MISSING");
  }
  const call = structuredClone(publicTurn.calls[0]);
  call.rawFinalOutput = LEGACY_VISIBLE_RAW_OUTPUT;
  (call as unknown as Record<string, unknown>).reasoning_content =
    LEGACY_HIDDEN_REASONING_SENTINEL;
  task.branches.high.turns[0]!.calls = [call];
  task.branches.high.review = {
    feeling: "better",
    quality: "direct_use",
    reason: "LEGACY_REVIEW_REASON",
    reviewedAt: "2026-08-09T12:00:00.000Z",
    targetTrigger: "triggered"
  };
  task.branches.high.status = "completed";
  task.branches.high.completedAt = "2026-08-09T12:00:00.000Z";
  state.activeTaskId = "A1";
  return state;
}

function projectHistoricalState(input: {
  base: Gi088BatchState;
  runId: string;
  taskIds: readonly string[];
  mode: Gi088EvaluationMode;
}) {
  const state = structuredClone(input.base);
  const sourceById = new Map(
    state.tasks.map((task) => [task.taskId, task] as const)
  );
  state.batchId = input.runId;
  state.evaluationMode = input.mode;
  state.tasks = input.taskIds.map((taskId, index) => {
    const source = sourceById.get(taskId) ?? state.tasks[index];
    if (!source) throw new Error("GI088_HISTORICAL_TASK_SEED_MISSING");
    return {
      ...structuredClone(source),
      taskId
    };
  });
  state.activeTaskId = "A1";
  return state;
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
}

class FlakyProviderResultStore extends Gi088MemoryFoundationStore {
  persistAttempts = 0;

  override persistProviderResult(
    input: Parameters<
      Gi088EvaluationFoundationStore["persistProviderResult"]
    >[0]
  ) {
    this.persistAttempts += 1;
    if (this.persistAttempts < 3) {
      return Promise.reject(new Error("transient provider-result write"));
    }
    return super.persistProviderResult(input);
  }
}

class FinalizerConflictStore extends Gi088MemoryFoundationStore {
  finalizeAttempts = 0;

  constructor(public remainingConflicts: number) {
    super();
  }

  override finalizeCall(
    input: Parameters<Gi088EvaluationFoundationStore["finalizeCall"]>[0]
  ) {
    this.finalizeAttempts += 1;
    if (this.remainingConflicts > 0) {
      this.remainingConflicts -= 1;
      return Promise.reject(
        new Gi088FoundationStoreError("GI088_CONCURRENT_UPDATE")
      );
    }
    return super.finalizeCall(input);
  }
}

class PersistentProviderResultFailureStore extends Gi088MemoryFoundationStore {
  persistAttempts = 0;

  override persistProviderResult(
    input: Parameters<
      Gi088EvaluationFoundationStore["persistProviderResult"]
    >[0]
  ) {
    void input;
    this.persistAttempts += 1;
    return Promise.reject(new Error("provider-result storage unavailable"));
  }
}

class ReservedDispatchFailureStore extends Gi088MemoryFoundationStore {
  override claimDispatch(
    input: Parameters<Gi088EvaluationFoundationStore["claimDispatch"]>[0]
  ) {
    void input;
    return Promise.reject(new Error("dispatch claim unavailable"));
  }
}

class ToggleDispatchFailureStore extends Gi088MemoryFoundationStore {
  failDispatch = false;

  override claimDispatch(
    input: Parameters<Gi088EvaluationFoundationStore["claimDispatch"]>[0]
  ) {
    if (this.failDispatch) {
      return Promise.reject(new Error("dispatch claim unavailable"));
    }
    return super.claimDispatch(input);
  }
}

class ToggleProviderResultFailureStore extends Gi088MemoryFoundationStore {
  failPersistence = true;
  persistAttempts = 0;

  override persistProviderResult(
    input: Parameters<
      Gi088EvaluationFoundationStore["persistProviderResult"]
    >[0]
  ) {
    this.persistAttempts += 1;
    if (this.failPersistence) {
      return Promise.reject(new Error("provider-result storage unavailable"));
    }
    return super.persistProviderResult(input);
  }
}

describe("GI-088 v8r2 evaluation foundation service", () => {
  it("并发与重复创建只产生一个 run，保持零 Provider 调用", async () => {
    const provider = fakeProvider();
    const getProvider = vi.fn(() => provider.provider);
    const { service, store } = serviceWith({ getProvider });

    const [first, concurrent] = await Promise.all([
      createRun(service, "owner-create", "create-a"),
      createRun(service, "owner-create", "create-b")
    ]);
    const replay = await createRun(service, "owner-create", "create-a");

    expect(first.runId).toBe(concurrent.runId);
    expect(replay.runId).toBe(first.runId);
    expect([first.created, concurrent.created].sort()).toEqual([false, true]);
    expect(replay.created).toBe(false);
    expect(await store.listRuns({ ownerUserId: "owner-create" })).toHaveLength(1);
    expect(await store.listCalls(first.runId)).toEqual([]);
    expect(getProvider).not.toHaveBeenCalled();
    expect(provider.provider.complete).not.toHaveBeenCalled();
  });

  it("Provider factory 失败时保持零账本、零 pending turn", async () => {
    const getProvider = vi.fn(async () => {
      throw new Error("provider factory unavailable");
    });
    const { service, store } = serviceWith({ getProvider });
    const created = await createRun(service, "owner-factory");

    await expect(
      service.startTask({
        ownerUserId: "owner-factory",
        runId: created.runId,
        taskId: "A1",
        initialUserMessage: "我想聊聊最近一直拿不定主意的事情。",
        clientOperationId: "factory-turn"
      })
    ).rejects.toThrow("provider factory unavailable");

    const session = await service.getSession({
      ownerUserId: "owner-factory",
      runId: created.runId
    });
    expect(await store.listCalls(created.runId)).toEqual([]);
    expect(session.activeTask).toBeNull();
    expect(session.tasks[0]?.status).toBe("ready");
    expect(
      await store.findOperation({
        ownerUserId: "owner-factory",
        evaluationVersion: GI088_EVALUATION_VERSION,
        clientOperationId: "factory-turn"
      })
    ).toBeNull();
  });

  it("同 operation 同 payload 回放，冲突 payload 与旧 base 都保持零新增调用", async () => {
    const fake = fakeProvider();
    const { service, store } = serviceWith({ provider: fake.provider });
    const created = await createRun(service, "owner-idempotent");
    const startInput = {
      ownerUserId: "owner-idempotent",
      runId: created.runId,
      taskId: "A1",
      initialUserMessage: "我想弄清这次选择为什么让我反复犹豫。",
      clientOperationId: "turn-one"
    } as const;

    const first = await service.startTask(startInput);
    const replay = await service.startTask(startInput);
    expect(replay.activeTask?.branches.high.messages).toEqual(
      first.activeTask?.branches.high.messages
    );
    expect(fake.provider.complete).toHaveBeenCalledTimes(1);

    await expectCode(
      service.startTask({
        ...startInput,
        initialUserMessage: "复用同一个 operation 提交另一段内容。"
      }),
      "GI088_OPERATION_PAYLOAD_CONFLICT"
    );
    await expectCode(
      service.submitTurn({
        ownerUserId: "owner-idempotent",
        runId: created.runId,
        taskId: "A1",
        branch: "high",
        content: "提交编号与操作编号不一致。",
        clientTurnId: "turn-mismatch",
        clientOperationId: "operation-mismatch",
        baseAssistantMessageId: "A1"
      }),
      "GI088_CLIENT_TURN_ID_INVALID"
    );
    await expectCode(
      service.submitTurn({
        ownerUserId: "owner-idempotent",
        runId: created.runId,
        taskId: "A1",
        branch: "high",
        content: "这段补充使用已经过期的 assistant base。",
        clientTurnId: "turn-two",
        clientOperationId: "turn-two",
        baseAssistantMessageId: "A0"
      }),
      "GI088_TURN_OUT_OF_DATE"
    );
    expect(fake.provider.complete).toHaveBeenCalledTimes(1);
    expect(await store.listCalls(created.runId)).toHaveLength(1);
  });

  it("纯停止由程序零调用提交，并记录可复核 intervention", async () => {
    const fake = fakeProvider();
    const getProvider = vi.fn(() => fake.provider);
    const { service, store } = serviceWith({ getProvider });
    const created = await createRun(service, "owner-pure-stop");

    const session = await service.startTask({
      ownerUserId: "owner-pure-stop",
      runId: created.runId,
      taskId: "A1",
      initialUserMessage: "谢谢，今天先到这",
      clientOperationId: "pure-stop"
    });

    expect(getProvider).not.toHaveBeenCalled();
    expect(fake.provider.complete).not.toHaveBeenCalled();
    expect(await store.listCalls(created.runId)).toEqual([]);
    expect(session.activeTask?.branches.high.turns[0]).toMatchObject({
      status: "valid",
      activeCallId: null,
      stateMaintenance: {
        explicitStop: "pure",
        providerCallBypassed: true
      }
    });
    expect(await store.listProgramInterventions(created.runId)).toHaveLength(1);
    expect(session.programInterventions?.[0]).toMatchObject({
      interventionType: "pure_stop",
      effectiveAction: "deterministic_pause"
    });
  });

  it("有效结果只 dispatch 一次并只提交一条 assistant，finalizer 可安全重入", async () => {
    const fake = fakeProvider();
    const { service, store } = serviceWith({ provider: fake.provider });
    const created = await createRun(service, "owner-finalizer");
    const session = await service.startTask({
      ownerUserId: "owner-finalizer",
      runId: created.runId,
      taskId: "A1",
      initialUserMessage: "我想聊聊最近的一次现实选择。",
      clientOperationId: "valid-turn"
    });
    const calls = await store.listCalls(created.runId);

    expect(fake.provider.complete).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      attempt: 1,
      status: "finalized",
      providerResultStatus: "provider_succeeded"
    });
    expect(calls[0]?.dispatchedAt).not.toBeNull();
    expect(session.activeTask?.branches.high.messages).toHaveLength(3);
    expect(
      session.activeTask?.branches.high.messages.filter(
        (message) => message.role === "assistant"
      )
    ).toHaveLength(2);

    const before = await store.findRun({
      ownerUserId: "owner-finalizer",
      runId: created.runId
    });
    await service.finalizeCall(calls[0]!.callId, "owner-finalizer");
    await service.finalizeCall(calls[0]!.callId, "owner-finalizer");
    const after = await service.getSession({
      ownerUserId: "owner-finalizer",
      runId: created.runId,
      taskId: "A1"
    });
    const storedAfter = await store.findRun({
      ownerUserId: "owner-finalizer",
      runId: created.runId
    });
    expect(storedAfter?.revision).toBe(before?.revision);
    expect(
      after.activeTask?.branches.high.messages.filter(
        (message) => message.role === "assistant"
      )
    ).toHaveLength(2);
  });

  it("Provider 结果持久化重试复用同一次真实调用", async () => {
    const store = new FlakyProviderResultStore();
    const fake = fakeProvider();
    const sleep = vi.fn(async (milliseconds: number) => {
      expect(milliseconds).toBeGreaterThan(0);
    });
    const { service } = serviceWith({ store, provider: fake.provider, sleep });
    const created = await createRun(service, "owner-persist-retry");

    await service.startTask({
      ownerUserId: "owner-persist-retry",
      runId: created.runId,
      taskId: "A1",
      initialUserMessage: "我想聊聊最近的一次现实选择。",
      clientOperationId: "persist-retry-turn"
    });

    expect(fake.provider.complete).toHaveBeenCalledTimes(1);
    expect(store.persistAttempts).toBe(3);
    expect(sleep.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([
      250,
      500
    ]);
    expect(await store.listCalls(created.runId)).toMatchObject([
      { status: "finalized", attempt: 1 }
    ]);
  });

  it.each([1, 2, 3, 4])(
    "finalizer 遇到 %i 次 CAS 冲突后收敛且不重调 Provider",
    async (conflictCount) => {
      const store = new FinalizerConflictStore(conflictCount);
      const fake = fakeProvider();
      const { service } = serviceWith({ store, provider: fake.provider });
      const created = await createRun(
        service,
        `owner-finalizer-cas-${conflictCount}`
      );

      const session = await service.startTask({
        ownerUserId: `owner-finalizer-cas-${conflictCount}`,
        runId: created.runId,
        taskId: "A1",
        initialUserMessage: "我想聊聊最近的一次现实选择。",
        clientOperationId: `cas-turn-${conflictCount}`
      });

      expect(fake.provider.complete).toHaveBeenCalledTimes(1);
      expect(store.finalizeAttempts).toBe(conflictCount + 1);
      expect(await store.listCalls(created.runId)).toMatchObject([
        { status: "finalized", providerResultStatus: "provider_succeeded" }
      ]);
      expect(
        session.activeTask?.branches.high.messages.filter(
          (message) => message.role === "assistant"
        )
      ).toHaveLength(2);
    }
  );

  it("第 5 次 finalizer CAS 冲突保留可重入 Provider 结果", async () => {
    const store = new FinalizerConflictStore(5);
    const fake = fakeProvider();
    const { service } = serviceWith({ store, provider: fake.provider });
    const created = await createRun(service, "owner-finalizer-cas-five");
    const startInput = {
      ownerUserId: "owner-finalizer-cas-five",
      runId: created.runId,
      taskId: "A1",
      initialUserMessage: "我想聊聊最近的一次现实选择。",
      clientOperationId: "cas-turn-five"
    } as const;

    await expectCode(
      service.startTask(startInput),
      "GI088_CONCURRENT_UPDATE"
    );
    const pending = await store.listCalls(created.runId);
    expect(fake.provider.complete).toHaveBeenCalledTimes(1);
    expect(store.finalizeAttempts).toBe(5);
    expect(pending).toMatchObject([
      {
        status: "provider_succeeded",
        providerResultStatus: "provider_succeeded",
        responseHash: expect.stringMatching(/^[a-f0-9]{64}$/u)
      }
    ]);

    store.remainingConflicts = 0;
    await service.finalizeCall(pending[0]!.callId, "owner-finalizer-cas-five");
    const replay = await service.startTask(startInput);
    expect(fake.provider.complete).toHaveBeenCalledTimes(1);
    expect(await store.listCalls(created.runId)).toMatchObject([
      { status: "finalized", providerResultStatus: "provider_succeeded" }
    ]);
    expect(
      replay.activeTask?.branches.high.messages.filter(
        (message) => message.role === "assistant"
      )
    ).toHaveLength(2);
  });

  it("Provider 结果持续落账失败进入 UNKNOWN 且同 operation 不重调", async () => {
    const store = new PersistentProviderResultFailureStore();
    const fake = fakeProvider();
    const sleep = vi.fn(async (milliseconds: number) => {
      expect(milliseconds).toBeGreaterThan(0);
    });
    const { service } = serviceWith({ store, provider: fake.provider, sleep });
    const created = await createRun(service, "owner-persist-unknown");
    const startInput = {
      ownerUserId: "owner-persist-unknown",
      runId: created.runId,
      taskId: "A1",
      initialUserMessage: "我想聊聊最近的一次现实选择。",
      clientOperationId: "persist-unknown-turn"
    } as const;

    await expectCode(
      service.startTask(startInput),
      "GI088_RESULT_PERSISTENCE_UNKNOWN"
    );
    expect(fake.provider.complete).toHaveBeenCalledTimes(1);
    expect(store.persistAttempts).toBe(4);
    expect(sleep.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([
      250,
      500,
      1_000
    ]);
    expect(await store.listCalls(created.runId)).toMatchObject([
      {
        status: "dispatched",
        providerResultStatus: null,
        responseHash: null
      }
    ]);

    const replay = await service.startTask(startInput);
    expect(replay.activeTask?.branches.high.pendingTurnId).not.toBeNull();
    expect(fake.provider.complete).toHaveBeenCalledTimes(1);
    expect(store.persistAttempts).toBe(4);
  });

  it("reserved call 到共享截止后由只读读取原子收口，保持零 Provider 调用", async () => {
    let currentTime = new Date("2026-08-10T12:00:00.000Z");
    const store = new ReservedDispatchFailureStore();
    const fake = fakeProvider();
    const { service } = serviceWith({
      store,
      provider: fake.provider,
      now: () => currentTime
    });
    const ownerUserId = "owner-reserved-expiry";
    const clientOperationId = "reserved-expiry-turn";
    const created = await createRun(service, ownerUserId);

    await expect(
      service.startTask({
        ownerUserId,
        runId: created.runId,
        taskId: "A1",
        initialUserMessage: "我想聊聊最近的一次现实选择。",
        clientOperationId
      })
    ).rejects.toThrow("dispatch claim unavailable");
    const [reservedCall] = await store.listCalls(created.runId);
    expect(reservedCall).toMatchObject({
      status: "reserved",
      dispatchedAt: null,
      clientOperationId
    });
    expect(fake.provider.complete).not.toHaveBeenCalled();
    expect(
      await store.findOperation({
        ownerUserId,
        evaluationVersion: GI088_EVALUATION_VERSION,
        clientOperationId
      })
    ).toMatchObject({ status: "processing" });

    currentTime = new Date(reservedCall!.automaticDeadlineAt!.getTime());
    const reconciled = await service.getSession({
      ownerUserId,
      runId: created.runId
    });
    const reconciledRun = await store.findRun({ ownerUserId, runId: created.runId });
    const reconciledRevision = reconciledRun!.revision;

    expect(await store.listCalls(created.runId)).toMatchObject([
      {
        callId: reservedCall!.callId,
        status: "superseded",
        dispatchedAt: null,
        errorCode: "RESERVED_DISPATCH_EXPIRED"
      }
    ]);
    expect(reconciled.activeTask?.branches.high.turns[0]).toMatchObject({
      status: "technical_failure",
      activeCallId: reservedCall!.callId,
      recovery: {
        status: "manual_available",
        automaticRetryCount: 0,
        manualRetryCount: 0,
        initialCallId: reservedCall!.callId
      }
    });
    expect(
      await store.findOperation({
        ownerUserId,
        evaluationVersion: GI088_EVALUATION_VERSION,
        clientOperationId
      })
    ).toMatchObject({
      status: "completed",
      resultSnapshot: { status: "superseded" }
    });
    expect(fake.provider.complete).not.toHaveBeenCalled();

    await service.getSession({ ownerUserId, runId: created.runId });
    expect((await store.findRun({ ownerUserId, runId: created.runId }))?.revision)
      .toBe(reconciledRevision);
    expect(fake.provider.complete).not.toHaveBeenCalled();
  });

  it("中断未知调用由读取收口为人工可用，显式 retry 只创建一次下一 attempt", async () => {
    let currentTime = new Date("2026-08-10T13:00:00.000Z");
    const store = new ToggleProviderResultFailureStore();
    const initialFake = fakeProvider();
    const { service: initialService } = serviceWith({
      store,
      provider: initialFake.provider,
      now: () => currentTime,
      sleep: async () => undefined
    });
    const ownerUserId = "owner-interrupted-manual";
    const clientOperationId = "interrupted-initial-turn";
    const created = await createRun(initialService, ownerUserId);

    await expectCode(
      initialService.startTask({
        ownerUserId,
        runId: created.runId,
        taskId: "A1",
        initialUserMessage: "我想聊聊最近的一次现实选择。",
        clientOperationId
      }),
      "GI088_RESULT_PERSISTENCE_UNKNOWN"
    );
    expect(initialFake.provider.complete).toHaveBeenCalledTimes(1);
    expect(store.persistAttempts).toBe(4);
    const [dispatchedCall] = await store.listCalls(created.runId);
    expect(dispatchedCall).toMatchObject({
      status: "dispatched",
      providerResultStatus: null
    });

    currentTime = new Date(dispatchedCall!.executionDeadlineAt!.getTime() + 5_001);
    const reconcileGetProvider = vi.fn(() => initialFake.provider);
    const { service: reconcileService } = serviceWith({
      store,
      getProvider: reconcileGetProvider,
      now: () => currentTime
    });
    const reconciled = await reconcileService.getSession({
      ownerUserId,
      runId: created.runId
    });
    const turnId = reconciled.activeTask!.branches.high.turns[0]!.id;

    expect(reconcileGetProvider).not.toHaveBeenCalled();
    expect(initialFake.provider.complete).toHaveBeenCalledTimes(1);
    expect(await store.listCalls(created.runId)).toMatchObject([
      {
        callId: dispatchedCall!.callId,
        status: "interrupted_unknown_dispatch",
        errorCode: "REQUEST_INTERRUPTED"
      }
    ]);
    expect(reconciled.activeTask?.branches.high.turns[0]).toMatchObject({
      status: "technical_failure",
      recovery: {
        status: "manual_available",
        automaticRetryCount: 0,
        manualRetryCount: 0,
        initialCallId: dispatchedCall!.callId
      }
    });
    expect(
      await store.findOperation({
        ownerUserId,
        evaluationVersion: GI088_EVALUATION_VERSION,
        clientOperationId
      })
    ).toMatchObject({
      status: "completed",
      resultSnapshot: { status: "interrupted_unknown_dispatch" }
    });

    store.failPersistence = false;
    const retryFake = fakeProvider();
    const { service: retryService } = serviceWith({
      store,
      provider: retryFake.provider,
      now: () => currentTime
    });
    const retryInput = {
      ownerUserId,
      runId: created.runId,
      taskId: "A1",
      branch: "high" as const,
      turnId,
      trigger: "manual_after_auto_recovery" as const,
      clientOperationId: "interrupted-manual-retry"
    };
    const recovered = await retryService.retry(retryInput);
    const replayed = await retryService.retry(retryInput);
    const calls = await store.listCalls(created.runId);

    expect(retryFake.provider.complete).toHaveBeenCalledTimes(1);
    expect(calls.map(({ attempt, kind, status, parentCallId }) => ({
      attempt,
      kind,
      status,
      parentCallId
    }))).toEqual([
      {
        attempt: 1,
        kind: "initial",
        status: "interrupted_unknown_dispatch",
        parentCallId: null
      },
      {
        attempt: 2,
        kind: "manual_retry",
        status: "finalized",
        parentCallId: dispatchedCall!.callId
      }
    ]);
    expect(recovered.activeTask?.branches.high.turns[0]).toMatchObject({
      status: "complete_after_manual_recovery",
      recovery: {
        status: "recovered",
        automaticRetryCount: 0,
        manualRetryCount: 1
      }
    });
    expect(replayed.activeTask?.branches.high.turns[0]).toMatchObject({
      status: "complete_after_manual_recovery"
    });
  });

  it("未授权 pause 最多自动恢复一次，并提交唯一可见结果", async () => {
    const fake = fakeProvider([unauthorizedPauseOutput(), firstTurnOutput()]);
    const { service, store } = serviceWith({ provider: fake.provider });
    const created = await createRun(service, "owner-auto-recovery");
    const session = await service.startTask({
      ownerUserId: "owner-auto-recovery",
      runId: created.runId,
      taskId: "A1",
      initialUserMessage: "我还想继续聊这次选择。",
      clientOperationId: "auto-recovery-turn"
    });
    const calls = await store.listCalls(created.runId);

    expect(fake.provider.complete).toHaveBeenCalledTimes(2);
    expect(calls.map(({ attempt, kind, retryTrigger }) => ({
      attempt,
      kind,
      retryTrigger
    }))).toEqual([
      { attempt: 1, kind: "initial", retryTrigger: null },
      {
        attempt: 2,
        kind: "automatic_retry",
        retryTrigger: "UNAUTHORIZED_PAUSE"
      }
    ]);
    expect(calls[0]).toMatchObject({
      status: "finalized",
      errorCode: "UNAUTHORIZED_PAUSE"
    });
    expect(session.activeTask?.branches.high.turns[0]).toMatchObject({
      status: "complete_after_auto_recovery",
      recovery: {
        status: "recovered",
        automaticRetryCount: 1,
        manualRetryCount: 0
      }
    });
    expect(
      session.activeTask?.branches.high.messages.filter(
        (message) => message.role === "assistant"
      )
    ).toHaveLength(2);
    expect(
      (await store.listProgramInterventions(created.runId)).some(
        (item) => item.interventionType === "unauthorized_pause_recovery"
      )
    ).toBe(true);
  });

  it("自动恢复严格受 90 秒共享截止约束", async () => {
    let currentTime = new Date("2026-08-10T12:00:00.000Z");
    const provider: AIProvider = {
      name: "fake-deadline",
      complete: vi.fn(async () => {
        currentTime = new Date(
          currentTime.getTime() +
            GI088_SHARED_RECOVERY_DEADLINE_POLICY.automaticChainDeadlineMs +
            1
        );
        return {
          content: unauthorizedPauseOutput(),
          latencyMs: 90_001,
          provider: "fake-deadline",
          tokenUsage: null
        };
      })
    };
    const { service, store } = serviceWith({
      provider,
      now: () => currentTime
    });
    const created = await createRun(service, "owner-deadline");
    const session = await service.startTask({
      ownerUserId: "owner-deadline",
      runId: created.runId,
      taskId: "A1",
      initialUserMessage: "我还想继续聊这次选择。",
      clientOperationId: "deadline-turn"
    });
    const calls = await store.listCalls(created.runId);

    expect(provider.complete).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    expect(
      calls[0]!.automaticDeadlineAt!.getTime() -
        calls[0]!.reservedAt.getTime()
    ).toBe(
      GI088_SHARED_RECOVERY_DEADLINE_POLICY.automaticChainDeadlineMs
    );
    expect(session.activeTask?.branches.high.turns[0]?.recovery).toMatchObject({
      status: "manual_available",
      automaticRetryCount: 0
    });
  });

  it("人工第三次生成独立于自动截止，并且全链只有三次调用", async () => {
    const fake = fakeProvider([
      unauthorizedPauseOutput(),
      unauthorizedPauseOutput(),
      firstTurnOutput()
    ]);
    const { service, store } = serviceWith({ provider: fake.provider });
    const created = await createRun(service, "owner-manual-third");
    const failed = await service.startTask({
      ownerUserId: "owner-manual-third",
      runId: created.runId,
      taskId: "A1",
      initialUserMessage: "我还想继续聊这次选择。",
      clientOperationId: "manual-third-initial"
    });
    const turnId = failed.activeTask!.branches.high.turns[0]!.id;
    expect(failed.activeTask?.branches.high.turns[0]?.recovery).toMatchObject({
      status: "manual_available",
      automaticRetryCount: 1,
      manualRetryCount: 0
    });

    const recovered = await service.retry({
      ownerUserId: "owner-manual-third",
      runId: created.runId,
      taskId: "A1",
      branch: "high",
      turnId,
      trigger: "manual_after_auto_recovery",
      clientOperationId: "manual-third-action"
    });
    const calls = await store.listCalls(created.runId);
    const thirdConfig = calls[2]!.effectiveConfig as Record<
      string,
      Gi088FoundationJson
    >;

    expect(fake.provider.complete).toHaveBeenCalledTimes(3);
    expect(calls.map((call) => [call.attempt, call.kind])).toEqual([
      [1, "initial"],
      [2, "automatic_retry"],
      [3, "manual_retry"]
    ]);
    expect(calls[2]).toMatchObject({
      parentCallId: calls[1]!.callId,
      automaticDeadlineAt: null,
      status: "finalized"
    });
    expect(thirdConfig.hardTimeoutMs).toBe(
      GI088_SHARED_RECOVERY_DEADLINE_POLICY.manualRetryHardTimeoutMs
    );
    expect(recovered.activeTask?.branches.high.turns[0]).toMatchObject({
      status: "complete_after_manual_recovery",
      recovery: {
        status: "recovered",
        automaticRetryCount: 1,
        manualRetryCount: 1
      }
    });
  });

  it("人工恢复预约后进程中断会在独立 60 秒截止收口且不重置额度", async () => {
    let currentTime = new Date("2026-08-10T14:00:00.000Z");
    const store = new ToggleDispatchFailureStore();
    const fake = fakeProvider([
      unauthorizedPauseOutput(),
      unauthorizedPauseOutput(),
      firstTurnOutput()
    ]);
    const { service } = serviceWith({
      store,
      provider: fake.provider,
      now: () => currentTime
    });
    const ownerUserId = "owner-manual-reserved-expiry";
    const created = await createRun(service, ownerUserId);
    const failed = await service.startTask({
      ownerUserId,
      runId: created.runId,
      taskId: "A1",
      initialUserMessage: "我还想继续聊这次选择。",
      clientOperationId: "manual-reserved-initial"
    });
    const turnId = failed.activeTask!.branches.high.turns[0]!.id;
    expect(fake.provider.complete).toHaveBeenCalledTimes(2);

    store.failDispatch = true;
    await expect(
      service.retry({
        ownerUserId,
        runId: created.runId,
        taskId: "A1",
        branch: "high",
        turnId,
        trigger: "manual_after_auto_recovery",
        clientOperationId: "manual-reserved-retry"
      })
    ).rejects.toThrow("dispatch claim unavailable");
    const manualCall = (await store.listCalls(created.runId)).at(-1)!;
    expect(manualCall).toMatchObject({
      attempt: 3,
      kind: "manual_retry",
      status: "reserved",
      automaticDeadlineAt: null
    });
    expect(fake.provider.complete).toHaveBeenCalledTimes(2);

    currentTime = new Date(
      manualCall.reservedAt.getTime() +
        GI088_SHARED_RECOVERY_DEADLINE_POLICY.manualRetryHardTimeoutMs
    );
    const reconciled = await service.getSession({
      ownerUserId,
      runId: created.runId
    });
    expect((await store.findCall(manualCall.callId))).toMatchObject({
      status: "superseded",
      errorCode: "RESERVED_DISPATCH_EXPIRED"
    });
    expect(reconciled.activeTask?.branches.high.turns[0]).toMatchObject({
      status: "technical_failure",
      recovery: {
        status: "exhausted",
        automaticRetryCount: 1,
        manualRetryCount: 1,
        manualRetryCallId: manualCall.callId
      }
    });
    expect(
      await store.findOperation({
        ownerUserId,
        evaluationVersion: GI088_EVALUATION_VERSION,
        clientOperationId: "manual-reserved-retry"
      })
    ).toMatchObject({
      status: "completed",
      resultSnapshot: { status: "superseded" }
    });
    expect(fake.provider.complete).toHaveBeenCalledTimes(2);
  });

  it("复核拒绝陈旧 observation 与 trajectory snapshot", async () => {
    const fake = fakeProvider();
    const { service } = serviceWith({ provider: fake.provider });
    const created = await createRun(service, "owner-review-stale");
    const session = await service.startTask({
      ownerUserId: "owner-review-stale",
      runId: created.runId,
      taskId: "A1",
      initialUserMessage: "我想聊聊最近的一次现实选择。",
      clientOperationId: "review-stale-turn"
    });
    const turn = session.activeTask!.branches.high.turns[0]!;
    const originalSnapshot = session.activeTask!.reviewSnapshot!.fingerprint;

    await expectCode(
      service.reviewQuestion({
        ownerUserId: "owner-review-stale",
        runId: created.runId,
        taskId: "A1",
        branch: "high",
        turnId: turn.id,
        questionPresence: "present",
        classification: "same_focus_low_burden",
        note: "使用陈旧观察指纹。",
        observationFingerprint: "0".repeat(64),
        clientOperationId: "stale-observation"
      }),
      "GI088_REVIEW_SNAPSHOT_OUT_OF_DATE"
    );
    const reviewed = await service.reviewQuestion({
      ownerUserId: "owner-review-stale",
      runId: created.runId,
      taskId: "A1",
      branch: "high",
      turnId: turn.id,
      questionPresence: "present",
      classification: "same_focus_low_burden",
      note: "问题保持单一焦点且回答负担较低。",
      observationFingerprint:
        turn.questionObservation!.observationFingerprint!,
      clientOperationId: "valid-observation"
    });
    expect(reviewed.activeTask!.reviewSnapshot!.fingerprint).not.toBe(
      originalSnapshot
    );
    await expectCode(
      service.endTrajectory({
        ownerUserId: "owner-review-stale",
        runId: created.runId,
        taskId: "A1",
        branch: "high",
        feeling: "better",
        quality: "direct_use",
        targetTrigger: "triggered",
        reason: "尝试使用复核前的旧轨迹快照。",
        reviewSnapshotFingerprint: originalSnapshot,
        clientOperationId: "stale-trajectory-snapshot"
      }),
      "GI088_REVIEW_SNAPSHOT_OUT_OF_DATE"
    );
  });

  it("程序介入复核修订保留历史并按最新结论重算 gate", async () => {
    const { service } = serviceWith();
    const created = await createRun(service, "owner-intervention-revision");
    const stopped = await service.startTask({
      ownerUserId: "owner-intervention-revision",
      runId: created.runId,
      taskId: "A1",
      initialUserMessage: "谢谢，今天先到这",
      clientOperationId: "intervention-pure-stop"
    });
    const intervention = stopped.programInterventions![0]!;

    const falsePositive = await service.reviewProgramIntervention({
      ownerUserId: "owner-intervention-revision",
      runId: created.runId,
      interventionId: intervention.id,
      observationFingerprint: intervention.observationFingerprint,
      outcome: "false_positive",
      reason: "首次复核认为程序接管不准确。",
      clientOperationId: "intervention-review-one"
    });
    expect(falsePositive.batch.gate?.status).toBe("no_go");
    expect(falsePositive.reviewRevisions).toMatchObject([
      {
        subjectType: "program_intervention_review",
        subjectId: intervention.id,
        oldValue: null,
        newValue: { outcome: "false_positive" }
      }
    ]);

    const corrected = await service.reviewProgramIntervention({
      ownerUserId: "owner-intervention-revision",
      runId: created.runId,
      interventionId: intervention.id,
      observationFingerprint: intervention.observationFingerprint,
      outcome: "correct",
      reason: "复读原话后确认程序正确执行了明确停止。",
      clientOperationId: "intervention-review-two"
    });
    expect(corrected.batch.gate?.status).toBe("pending");
    expect(corrected.reviewRevisions).toHaveLength(2);
    expect(corrected.reviewRevisions?.[1]).toMatchObject({
      subjectType: "program_intervention_review",
      subjectId: intervention.id,
      oldValue: { outcome: "false_positive" },
      newValue: { outcome: "correct" }
    });
  });

  it("启动 A2 后修订 A1，保留 active task、完成时间与人工 No-Go 历史", async () => {
    const fake = fakeProvider();
    const { service } = serviceWith({ provider: fake.provider });
    const created = await createRun(service, "owner-trajectory-revision");
    const startedA1 = await service.startTask({
      ownerUserId: "owner-trajectory-revision",
      runId: created.runId,
      taskId: "A1",
      initialUserMessage: "我想聊聊最近的一次现实选择。",
      clientOperationId: "revision-a1-turn"
    });
    const a1Turn = startedA1.activeTask!.branches.high.turns[0]!;
    const reviewedA1 = await service.reviewQuestion({
      ownerUserId: "owner-trajectory-revision",
      runId: created.runId,
      taskId: "A1",
      branch: "high",
      turnId: a1Turn.id,
      questionPresence: "present",
      classification: "same_focus_low_burden",
      note: "问题保持单一焦点。",
      observationFingerprint:
        a1Turn.questionObservation!.observationFingerprint!,
      clientOperationId: "revision-a1-question"
    });
    const completedA1 = await service.endTrajectory({
      ownerUserId: "owner-trajectory-revision",
      runId: created.runId,
      taskId: "A1",
      branch: "high",
      feeling: "better",
      quality: "direct_use",
      targetTrigger: "triggered",
      reason: "首次评价认为结果可以直接使用。",
      reviewSnapshotFingerprint:
        reviewedA1.activeTask!.reviewSnapshot!.fingerprint,
      clientOperationId: "revision-a1-end"
    });
    const originalCompletedAt =
      completedA1.activeTask!.branches.high.completedAt;

    await service.startTask({
      ownerUserId: "owner-trajectory-revision",
      runId: created.runId,
      taskId: "A2",
      initialUserMessage: "第二项继续讨论另一个真实话题。",
      clientOperationId: "revision-a2-turn"
    });
    const a1BeforeRevision = await service.getSession({
      ownerUserId: "owner-trajectory-revision",
      runId: created.runId,
      taskId: "A1"
    });
    const blockedA1 = await service.endTrajectory({
      ownerUserId: "owner-trajectory-revision",
      runId: created.runId,
      taskId: "A1",
      branch: "high",
      feeling: "worse",
      quality: "single_case_blocker",
      targetTrigger: "triggered",
      reason: "复核后确认这一项构成单例阻断。",
      reviewSnapshotFingerprint:
        a1BeforeRevision.activeTask!.reviewSnapshot!.fingerprint,
      clientOperationId: "revision-a1-blocker",
      revisionReason: "重新核对可见回答后修订质量结论。"
    });
    const whileA2Active = await service.getSession({
      ownerUserId: "owner-trajectory-revision",
      runId: created.runId
    });
    expect(whileA2Active.activeTask?.taskId).toBe("A2");
    expect(whileA2Active.tasks[0]?.status).toBe("completed");
    expect(whileA2Active.tasks[1]?.status).toBe("active");
    expect(blockedA1.activeTask?.branches.high.completedAt).toBe(
      originalCompletedAt
    );
    expect(whileA2Active.batch.gate?.status).toBe("no_go");

    const restoredA1 = await service.endTrajectory({
      ownerUserId: "owner-trajectory-revision",
      runId: created.runId,
      taskId: "A1",
      branch: "high",
      feeling: "better",
      quality: "direct_use",
      targetTrigger: "triggered",
      reason: "再次校准后恢复为可直接使用。",
      reviewSnapshotFingerprint:
        blockedA1.activeTask!.reviewSnapshot!.fingerprint,
      clientOperationId: "revision-a1-restore",
      revisionReason: "补充复核依据后更正上一版阻断结论。"
    });
    const final = await service.getSession({
      ownerUserId: "owner-trajectory-revision",
      runId: created.runId
    });
    expect(final.activeTask?.taskId).toBe("A2");
    expect(final.batch.gate?.status).toBe("pending");
    expect(restoredA1.activeTask?.branches.high.completedAt).toBe(
      originalCompletedAt
    );
    expect(final.reviewRevisions).toHaveLength(2);
    expect(final.reviewRevisions?.map((revision) => ({
      subjectType: revision.subjectType,
      oldQuality: (revision.oldValue as { quality?: string } | null)?.quality,
      newQuality: (revision.newValue as { quality?: string }).quality
    }))).toEqual([
      {
        subjectType: "trajectory_review",
        oldQuality: "direct_use",
        newQuality: "single_case_blocker"
      },
      {
        subjectType: "trajectory_review",
        oldQuality: "single_case_blocker",
        newQuality: "direct_use"
      }
    ]);
  });

  it("pending turn 禁止复核，Provider 收口后仍只提交一次", async () => {
    let release!: (
      value: Awaited<ReturnType<AIProvider["complete"]>>
    ) => void;
    const completion = new Promise<
      Awaited<ReturnType<AIProvider["complete"]>>
    >((resolve) => {
      release = resolve;
    });
    let turnId = "";
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const provider: AIProvider = {
      name: "fake-pending",
      complete: vi.fn(() => completion)
    };
    const { service, store } = serviceWith({ provider });
    const created = await createRun(service, "owner-pending-review");
    const inFlight = service.startTask({
      ownerUserId: "owner-pending-review",
      runId: created.runId,
      taskId: "A1",
      initialUserMessage: "我想聊聊最近的一次现实选择。",
      clientOperationId: "pending-turn",
      onProgress: (event: Gi088FoundationExecutionEvent) => {
        if (event.type === "turn_reserved") turnId = event.turnId;
        if (event.type === "provider_started") markStarted();
      }
    });
    await started;

    await expectCode(
      service.reviewQuestion({
        ownerUserId: "owner-pending-review",
        runId: created.runId,
        taskId: "A1",
        branch: "high",
        turnId,
        questionPresence: "uncertain",
        note: "生成尚未结束。",
        observationFingerprint: "pending",
        clientOperationId: "review-pending"
      }),
      "GI088_REVIEW_DURING_PROCESSING"
    );

    release({
      content: firstTurnOutput(),
      latencyMs: 7,
      provider: "fake-pending",
      tokenUsage: null
    });
    const completed = await inFlight;
    expect(provider.complete).toHaveBeenCalledTimes(1);
    expect(await store.listCalls(created.runId)).toHaveLength(1);
    expect(completed.activeTask?.branches.high.pendingTurnId).toBeNull();
  });

  it("安全终止形成 No-Go、开放下一任务，并生成稳定且排除隐藏推理的导出", async () => {
    const fake = fakeProvider();
    const { service } = serviceWith({ provider: fake.provider });
    const created = await createRun(service, "owner-abort-export");
    await service.startTask({
      ownerUserId: "owner-abort-export",
      runId: created.runId,
      taskId: "A1",
      initialUserMessage: "我想聊聊最近的一次现实选择。",
      clientOperationId: "abort-turn"
    });

    const aborted = await service.abortCurrentTask({
      ownerUserId: "owner-abort-export",
      runId: created.runId,
      taskId: "A1",
      reason: "保留当前证据并安全终止这一项。",
      confirmation: true,
      clientOperationId: "abort-task"
    });
    expect(aborted.batch.gate?.status).toBe("no_go");
    expect(aborted.tasks[0]?.status).toBe("aborted");
    expect(aborted.tasks[1]?.status).toBe("ready");

    await service.earlyStop({
      ownerUserId: "owner-abort-export",
      runId: created.runId,
      reasonCode: "technical_friction",
      reason: "第一项已安全终止，当前证据足以结束本批。",
      confirmation: true,
      clientOperationId: "early-stop"
    });
    const first = await service.exportRun({
      ownerUserId: "owner-abort-export",
      runId: created.runId
    });
    const replay = await service.exportRun({
      ownerUserId: "owner-abort-export",
      runId: created.runId
    });
    const exported = JSON.stringify(first);

    expect(replay.receipt).toEqual(first.receipt);
    expect(first.receipt.payloadSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.receipt.recordCounts.calls).toBe(1);
    expect(exported).not.toContain(HIDDEN_REASONING_SENTINEL);
    expect(exported).not.toContain("reasoning_content");
    expect(exported).not.toContain("hiddenReasoning");
  });

  it("旧 execution fingerprint 只读，可查看和导出且保持零调用", async () => {
    const seedStore = new Gi088MemoryFoundationStore();
    const seed = serviceWith({ store: seedStore });
    const created = await createRun(seed.service, "owner-seed");
    const current = await seedStore.findRun({
      ownerUserId: "owner-seed",
      runId: created.runId
    });
    expect(current).not.toBeNull();

    const store = new Gi088MemoryFoundationStore();
    const historicalRunId = "historical-execution-run";
    const historicalState = structuredClone(current!.state) as Record<
      string,
      Gi088FoundationJson
    >;
    historicalState.batchId = historicalRunId;
    await store.createRunIdempotently({
      runId: historicalRunId,
      ownerUserId: "owner-history",
      evaluationVersion: GI088_EVALUATION_VERSION,
      candidateFingerprint: current!.candidateFingerprint,
      executionFingerprint: "0".repeat(64),
      state: historicalState,
      gateStatus: "legacy_unknown",
      clientOperationId: "seed-history",
      payloadHash: "historical-payload"
    });
    const fake = fakeProvider();
    const { service } = serviceWith({ store, provider: fake.provider });

    const session = await service.getSession({
      ownerUserId: "owner-history",
      runId: historicalRunId
    });
    expect(session.batch).toMatchObject({
      readOnly: true,
      readOnlyReason: "execution_fingerprint_mismatch"
    });
    await expectCode(
      service.startTask({
        ownerUserId: "owner-history",
        runId: historicalRunId,
        taskId: "A1",
        initialUserMessage: "历史执行指纹不能继续写入。",
        clientOperationId: "history-write"
      }),
      "GI088_RUN_READ_ONLY"
    );
    await expect(
      service.exportRun({
        ownerUserId: "owner-history",
        runId: historicalRunId
      })
    ).resolves.toMatchObject({
      receipt: { payloadSha256: expect.stringMatching(/^[a-f0-9]{64}$/u) }
    });
    expect(fake.provider.complete).not.toHaveBeenCalled();
    expect(await store.listCalls(historicalRunId)).toEqual([]);
  });

  it("v8r1 run 使用历史任务包与不可变 dataset fingerprint 只读解析", async () => {
    const seedStore = new Gi088MemoryFoundationStore();
    const seed = serviceWith({ store: seedStore });
    const created = await createRun(seed.service, "owner-v8r1-seed");
    const current = await seedStore.findRun({
      ownerUserId: "owner-v8r1-seed",
      runId: created.runId
    });
    expect(current).not.toBeNull();

    const historicalRunId = "historical-v8r1-run";
    const historicalState = structuredClone(current!.state) as Record<
      string,
      Gi088FoundationJson
    >;
    historicalState.batchId = historicalRunId;
    historicalState.evaluationMode = "paired";
    const store = new Gi088MemoryFoundationStore();
    await store.createRunIdempotently({
      runId: historicalRunId,
      ownerUserId: "owner-v8r1-history",
      evaluationVersion: GI088_EVALUATION_VERSION_V8R1,
      candidateFingerprint: "1".repeat(64),
      executionFingerprint: "2".repeat(64),
      state: historicalState,
      gateStatus: "legacy_unknown",
      clientOperationId: "seed-v8r1-history",
      payloadHash: "historical-v8r1-payload"
    });
    const fake = fakeProvider();
    const { service } = serviceWith({ store, provider: fake.provider });

    const session = await service.getSession({
      ownerUserId: "owner-v8r1-history",
      runId: historicalRunId,
      taskId: "A1"
    });
    expect(session.evaluation).toMatchObject({
      version: GI088_EVALUATION_VERSION_V8R1,
      mode: "paired",
      activeBranches: ["off", "high"],
      datasetFingerprint: createGi088DatasetFingerprint(
        GI088_EVALUATION_VERSION_V8R1
      )
    });
    expect(session.tasks).toHaveLength(12);
    expect(session.tasks[0]?.targetTriggerPrompt).not.toContain(
      "跟奶奶解释很累"
    );
    expect(session.activeTask?.branches).toHaveProperty("off");
    expect(session.activeTask?.branches).toHaveProperty("high");
    expect(session.batch).toMatchObject({
      readOnly: true,
      readOnlyReason: "execution_fingerprint_mismatch"
    });
    await expect(
      service.exportRun({
        ownerUserId: "owner-v8r1-history",
        runId: historicalRunId
      })
    ).resolves.toMatchObject({
      receipt: { payloadSha256: expect.stringMatching(/^[a-f0-9]{64}$/u) }
    });
    expect(fake.provider.complete).not.toHaveBeenCalled();
  });

  it("v1 至 v8r1 全版本会话和导出按存储态及不可变版本元数据投影", async () => {
    const base = await createHistoricalEvidenceState();
    const v1TaskIds = [
      "A1",
      "A2",
      "A3",
      "A4",
      "A5",
      "A6",
      "A7",
      "A8",
      "A2-R",
      "A3-R",
      "A4-R",
      "A6-R"
    ] as const;
    const cases = [
      {
        label: "v1 paired",
        version: GI088_EVALUATION_VERSION_V1,
        id: GI088_EVALUATION_ID_V1,
        serviceVersion: GI088_SERVICE_VERSION_V1,
        model: "deepseek-v4-flash",
        mode: "paired",
        taskIds: v1TaskIds
      },
      {
        label: "v2",
        version: GI088_EVALUATION_VERSION_V2,
        id: GI088_EVALUATION_ID_V2,
        serviceVersion: GI088_SERVICE_VERSION_V2,
        model: "deepseek-v4-flash",
        mode: "high_only",
        taskIds: v1TaskIds
      },
      {
        label: "v3",
        version: GI088_EVALUATION_VERSION_V3,
        id: GI088_EVALUATION_ID_V3,
        serviceVersion: GI088_SERVICE_VERSION_V3,
        model: "deepseek-v4-flash",
        mode: "high_only",
        taskIds: v1TaskIds
      },
      {
        label: "v4",
        version: GI088_EVALUATION_VERSION_V4,
        id: GI088_EVALUATION_ID_V4,
        serviceVersion: GI088_SERVICE_VERSION_V4,
        model: "deepseek-v4-flash",
        mode: "high_only",
        taskIds: v1TaskIds
      },
      {
        label: "v5",
        version: GI088_EVALUATION_VERSION_V5,
        id: GI088_EVALUATION_ID_V5,
        serviceVersion: GI088_SERVICE_VERSION_V5,
        model: "deepseek-v4-flash",
        mode: "high_only",
        taskIds: GI088_V5_TASKS.map((task) => task.id)
      },
      {
        label: "v6",
        version: GI088_EVALUATION_VERSION_V6,
        id: GI088_EVALUATION_ID_V6,
        serviceVersion: GI088_SERVICE_VERSION_V6,
        model: "deepseek-v4-flash",
        mode: "high_only",
        taskIds: GI088_V6_TASKS.map((task) => task.id)
      },
      {
        label: "v7",
        version: GI088_EVALUATION_VERSION_V7,
        id: GI088_EVALUATION_ID_V7,
        serviceVersion: GI088_SERVICE_VERSION_V7,
        model: "deepseek-v4-flash",
        mode: "high_only",
        taskIds: ["A1", "A2"]
      },
      {
        label: "v7r1",
        version: GI088_EVALUATION_VERSION_V7R1,
        id: GI088_EVALUATION_ID_V7R1,
        serviceVersion: GI088_SERVICE_VERSION_V7R1,
        model: "deepseek-v4-flash",
        mode: "high_only",
        taskIds: ["A1", "A2"]
      },
      {
        label: "v7r2",
        version: GI088_EVALUATION_VERSION_V7R2,
        id: GI088_EVALUATION_ID_V7R2,
        serviceVersion: GI088_SERVICE_VERSION_V7R2,
        model: "deepseek-v4-flash-ga-260731",
        mode: "high_only",
        taskIds: ["A1", "A2"]
      },
      {
        label: "v7r3",
        version: GI088_EVALUATION_VERSION_V7R3,
        id: GI088_EVALUATION_ID_V7R3,
        serviceVersion: GI088_SERVICE_VERSION_V7R3,
        model: "deepseek-v4-flash-ga-260731",
        mode: "high_only",
        taskIds: ["A1", "A2"]
      },
      {
        label: "v7r4",
        version: GI088_EVALUATION_VERSION_V7R4,
        id: GI088_EVALUATION_ID_V7R4,
        serviceVersion: GI088_SERVICE_VERSION_V7R4,
        model: "deepseek-v4-pro",
        mode: "high_only",
        taskIds: ["A1", "A2"]
      },
      {
        label: "v8",
        version: GI088_EVALUATION_VERSION_V8,
        id: GI088_EVALUATION_ID_V8,
        serviceVersion: GI088_SERVICE_VERSION_V8,
        model: "deepseek-v4-pro",
        mode: "high_only",
        taskIds: GI088_V8R1_TASKS.slice(0, 4).map((task) => task.id)
      },
      {
        label: "v8r1",
        version: GI088_EVALUATION_VERSION_V8R1,
        id: GI088_EVALUATION_ID_V8R1,
        serviceVersion: GI088_SERVICE_VERSION_V8R1,
        model: "deepseek-v4-pro",
        mode: "high_only",
        taskIds: GI088_V8R1_TASKS.map((task) => task.id)
      }
    ] as const;
    const store = new Gi088MemoryFoundationStore();
    const fake = fakeProvider();
    const { service, getProvider } = serviceWith({
      store,
      provider: fake.provider
    });

    for (const historical of cases) {
      const runId = `historical-${historical.label.replaceAll(" ", "-")}`;
      const ownerUserId = `owner-${runId}`;
      const state = projectHistoricalState({
        base,
        runId,
        taskIds: historical.taskIds,
        mode: historical.mode
      });
      await store.createRunIdempotently({
        runId,
        ownerUserId,
        evaluationVersion: historical.version,
        candidateFingerprint: `${historical.label}-candidate`,
        executionFingerprint: `${historical.label}-execution`,
        state: state as unknown as Gi088FoundationJson,
        gateStatus: "legacy_unknown",
        clientOperationId: `${runId}-seed`,
        payloadHash: `${runId}-payload`
      });

      const lastTaskId = historical.taskIds.at(-1)!;
      const selected = await service.getSession({
        ownerUserId,
        runId,
        taskId: lastTaskId
      });
      expect(selected.evaluation, historical.label).toMatchObject({
        id: historical.id,
        version: historical.version,
        serviceVersion: historical.serviceVersion,
        model: historical.model,
        mode: historical.mode,
        candidateFingerprint: `${historical.label}-candidate`,
        executionFingerprint: `${historical.label}-execution`,
        activeBranches:
          historical.mode === "paired" ? ["off", "high"] : ["high"],
        datasetFingerprint: createGi088DatasetFingerprint(historical.version)
      });
      expect(selected.evaluation, historical.label).not.toHaveProperty(
        "runnerFingerprint"
      );
      expect(selected.evaluation, historical.label).not.toHaveProperty(
        "experienceFingerprint"
      );
      expect(selected.evaluation, historical.label).not.toHaveProperty(
        "behaviorManifestSha256"
      );
      expect(selected.tasks.map((task) => task.id), historical.label).toEqual(
        historical.taskIds
      );
      expect(selected.activeTask?.taskId, historical.label).toBe(lastTaskId);
      expect(selected.batch, historical.label).toMatchObject({
        readOnly: true,
        readOnlyReason: "execution_fingerprint_mismatch"
      });
      await expectCode(
        service.startTask({
          ownerUserId,
          runId,
          taskId: "A1",
          initialUserMessage: "历史版本只能读取。",
          clientOperationId: `${runId}-readonly-write`
        }),
        "GI088_RUN_READ_ONLY"
      );

      const evidence = await service.getSession({
        ownerUserId,
        runId,
        taskId: "A1"
      });
      expect(
        evidence.activeTask?.branches.high.turns[0]?.calls[0]?.rawFinalOutput,
        historical.label
      ).toBeNull();
      expect(
        evidence.activeTask?.branches.high.turns[0]?.calls[0],
        historical.label
      ).toMatchObject({
        status: "valid",
        tokenUsage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30
        }
      });
      expect(
        evidence.activeTask?.branches.high.review?.reason,
        historical.label
      ).toBe("LEGACY_REVIEW_REASON");
      expect(evidence.batch.gate, historical.label).toMatchObject({
        status: "legacy_unknown",
        reasons: []
      });
      const serializedSession = JSON.stringify(evidence);
      expect(serializedSession, historical.label).not.toContain(
        LEGACY_VISIBLE_RAW_OUTPUT
      );
      expect(serializedSession, historical.label).not.toContain(
        LEGACY_HIDDEN_REASONING_SENTINEL
      );
      expect(serializedSession, historical.label).not.toContain(
        "reasoning_content"
      );

      const exported = await service.exportRun({ ownerUserId, runId });
      const payload = exported.payload as unknown as {
        evaluation: {
          id: string;
          version: string;
          serviceVersion: string;
          model: string;
          candidateFingerprint: string;
          executionFingerprint: string;
          maximumProviderCallsPerUserSubmission?: number;
        };
        run: {
          gate: {
            status: string;
            reasons: unknown[];
          };
        };
        batch: Gi088BatchState;
      };
      expect(payload.evaluation, historical.label).toMatchObject({
        id: historical.id,
        version: historical.version,
        serviceVersion: historical.serviceVersion,
        model: historical.model,
        candidateFingerprint: `${historical.label}-candidate`,
        executionFingerprint: `${historical.label}-execution`
      });
      expect(payload.evaluation, historical.label).not.toHaveProperty(
        "maximumProviderCallsPerUserSubmission"
      );
      expect(payload.run.gate, historical.label).toEqual({
        status: "legacy_unknown",
        reasons: []
      });
      expect(
        payload.batch.tasks.map((task) => task.taskId),
        historical.label
      ).toEqual(historical.taskIds);
      const serializedExport = JSON.stringify(exported);
      expect(serializedExport, historical.label).toContain(
        LEGACY_VISIBLE_RAW_OUTPUT
      );
      expect(serializedExport, historical.label).toContain(
        "LEGACY_REVIEW_REASON"
      );
      expect(serializedExport, historical.label).not.toContain(
        LEGACY_HIDDEN_REASONING_SENTINEL
      );
      expect(serializedExport, historical.label).not.toContain(
        "reasoning_content"
      );
      expect(await store.listCalls(runId), historical.label).toEqual([]);
    }

    expect(getProvider).not.toHaveBeenCalled();
    expect(fake.provider.complete).not.toHaveBeenCalled();
  });
});
