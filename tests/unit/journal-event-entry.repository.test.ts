/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { state, mockPrisma, mocks } = vi.hoisted(() => {
  const now = () => new Date("2026-07-22T08:00:00.000Z");
  const state = {
    entries: [] as any[],
    generations: [] as any[],
    events: [] as any[],
    sessions: [] as any[],
    turns: [] as any[],
    traces: [] as any[],
    messages: [
      { id: "message-1", role: "user", sequence: 1, content: "我和同事有一次误会。" },
      { id: "message-2", role: "assistant", sequence: 2, content: "听起来这件事让你很在意。" }
    ] as any[]
  };

  const matchesEventUser = (eventId: string, userId?: string) => {
    const event = state.events.find((candidate) => candidate.id === eventId);
    return Boolean(event && (!userId || event.userId === userId));
  };
  const hydrateEntry = (entry: any) => ({
    ...entry,
    event: state.events.find((event) => event.id === entry.eventId)
  });
  const matchesWhere = (candidate: any, where: any) => {
    if (where.id && candidate.id !== where.id) return false;
    if (where.eventId && candidate.eventId !== where.eventId) return false;
    if (where.clientOperationId && candidate.clientOperationId !== where.clientOperationId) {
      return false;
    }
    if (where.status) {
      const statuses = Array.isArray(where.status.in) ? where.status.in : [where.status];
      if (!statuses.includes(candidate.status)) return false;
    }
    if (where.event?.userId && !matchesEventUser(candidate.eventId, where.event.userId)) {
      return false;
    }
    return true;
  };

  const mockPrisma: Record<string, any> = {
    $transaction: vi.fn(async (operation: any) =>
      Array.isArray(operation) ? Promise.all(operation) : operation(mockPrisma)
    )
  };
  mockPrisma.journalEventEntry = {
    findFirst: vi.fn(async ({ where }: any) => {
      const entry = state.entries.find((candidate) => matchesWhere(candidate, where));
      return entry ? hydrateEntry(entry) : null;
    }),
    create: vi.fn(async ({ data }: any) => {
      const entry = {
        ...data,
        sourceBranchSessionId: data.sourceBranchSessionId ?? null,
        generatedByTurnId: data.generatedByTurnId ?? null,
        currentGenerationTraceId: data.currentGenerationTraceId ?? null,
        generationId: data.generationId ?? null,
        savedRevision: data.savedRevision ?? null,
        savedAt: data.savedAt ?? null,
        createdAt: now(),
        updatedAt: now()
      };
      state.entries.push(entry);
      return entry;
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const entry = state.entries.find(
        (candidate) => candidate.id === where.id &&
          (where.contentRevision === undefined || candidate.contentRevision === where.contentRevision)
      );
      if (!entry) return { count: 0 };
      for (const [key, value] of Object.entries(data)) {
        (entry as any)[key] =
          typeof value === "object" && value && "increment" in value
            ? (entry as any)[key] + (value as { increment: number }).increment
            : value;
      }
      entry.updatedAt = now();
      return { count: 1 };
    })
  };
  mockPrisma.journalEventEntryGeneration = {
    findFirst: vi.fn(async ({ where }: any) =>
      state.generations.find((candidate) => matchesWhere(candidate, where)) ?? null
    ),
    findUnique: vi.fn(async ({ where }: any) =>
      state.generations.find((candidate) => candidate.id === where.id) ?? null
    ),
    create: vi.fn(async ({ data }: any) => {
      const generation = {
        ...data,
        attemptCount: data.attemptCount ?? 1,
        errorCode: data.errorCode ?? null,
        completedAt: null,
        failedAt: null,
        canceledAt: null,
        startedAt: now(),
        createdAt: now(),
        updatedAt: now()
      };
      state.generations.push(generation);
      return generation;
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const generation = state.generations.find((candidate) => matchesWhere(candidate, where));
      if (!generation) return { count: 0 };
      Object.assign(generation, data, { updatedAt: now() });
      return { count: 1 };
    })
  };
  mockPrisma.journalEvent = {
    updateMany: vi.fn(async ({ where, data }: any) => {
      const event = state.events.find((candidate) => {
        if (candidate.id !== where.id) return false;
        if (where.userId && candidate.userId !== where.userId) return false;
        const statuses = where.status?.in ?? (where.status ? [where.status] : []);
        return statuses.length === 0 || statuses.includes(candidate.status);
      });
      if (!event) return { count: 0 };
      Object.assign(event, data);
      return { count: 1 };
    }),
    findFirst: vi.fn(async ({ where }: any) =>
      state.events.find((event) =>
        event.id === where.id && event.userId === where.userId && event.status === where.status
      ) ?? null
    )
  };
  mockPrisma.interviewUserTurn = {
    findUnique: vi.fn(async ({ where }: any) => {
      const key = where.sessionId_clientTurnId;
      return state.turns.find(
        (turn) => turn.sessionId === key.sessionId && turn.clientTurnId === key.clientTurnId
      ) ?? null;
    }),
    create: vi.fn(async ({ data }: any) => {
      const turn = { ...data, completedAt: null, errorCode: null };
      state.turns.push(turn);
      return turn;
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const turn = state.turns.find(
        (candidate) => candidate.id === where.id &&
          (where.status === undefined || candidate.status === where.status)
      );
      if (!turn) return { count: 0 };
      Object.assign(turn, data);
      return { count: 1 };
    })
  };
  mockPrisma.interviewMessage = {
    findMany: vi.fn(async ({ where }: any) =>
      state.messages.filter((message) => where.id.in.includes(message.id))
    )
  };
  mockPrisma.interviewSession = {
    updateMany: vi.fn(async ({ where, data }: any) => {
      const rootSessionId = where.OR[0].id;
      let count = 0;
      for (const session of state.sessions) {
        if (session.id === rootSessionId || session.rootSessionId === rootSessionId) {
          Object.assign(session, data);
          count += 1;
        }
      }
      return { count };
    })
  };
  mockPrisma.aIGenerationTrace = {
    findFirst: vi.fn(async ({ where }: any) =>
      state.traces.find((trace) =>
        trace.id === where.id &&
          trace.userId === where.userId &&
          trace.journalEventId === where.journalEventId &&
          trace.artifactType === where.artifactType &&
          trace.artifactId === where.artifactId &&
          trace.status === where.status
      ) ?? null
    ),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const trace = state.traces.find(
        (candidate) => candidate.id === where.id && candidate.status === where.status
      );
      if (!trace) return { count: 0 };
      Object.assign(trace, data);
      return { count: 1 };
    })
  };

  const mocks = {
    confirmPendingUnderstandingClaimWithClient: vi.fn(async () => ({
      status: "none",
      claimId: null,
      confirmedFactId: null
    })),
    assertEventCenteredForwardOperationAllowedWithClient: vi.fn(async () => undefined),
    getEventCenteredRouteWithClient: vi.fn(async () => ({
      event: {
        rootSessionId: "root-1",
        rootSession: { recordMode: "capture" }
      },
      branch: { recordMode: "capture" },
      path: { messages: state.messages }
    })),
    getEffectiveJournalEventFactProjectionWithClient: vi.fn(async () => ({
      facts: [{ id: "fact-1", statement: "我很在意这段合作关系" }],
      effectiveFactIds: ["fact-1"],
      deprioritizedFactIds: ["fact-deprioritized"],
      explorationFactIds: ["fact-1"],
      invalidatedFactIds: [],
      pendingClarification: null
    })),
    getEffectiveJournalEventAngleProjectionWithClient: vi.fn(async () => ({
      outcomesByAngle: {
        feeling: { id: "angle-feeling", angle: "feeling" },
        thought: null,
        relationship: null,
        action: null
      },
      logEligibleOutcomeIds: ["angle-feeling"]
    })),
    createAIGenerationTraceWithClient: vi.fn(async (_database: unknown, input: any) => {
      state.traces.push({ ...input, status: "pending", pipelineDecisions: input.pipelineDecisions });
    })
  };

  return { state, mockPrisma, mocks };
});

vi.mock("@/server/db/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/repositories/ai-quality.repository", () => ({
  createAIGenerationTraceWithClient: mocks.createAIGenerationTraceWithClient
}));
vi.mock("@/server/repositories/journal-event-angle-outcome.repository", () => ({
  getEffectiveJournalEventAngleProjectionWithClient:
    mocks.getEffectiveJournalEventAngleProjectionWithClient
}));
vi.mock("@/server/repositories/journal-event-fact-revision.repository", () => ({
  assertEventCenteredForwardOperationAllowedWithClient:
    mocks.assertEventCenteredForwardOperationAllowedWithClient,
  getEffectiveJournalEventFactProjectionWithClient:
    mocks.getEffectiveJournalEventFactProjectionWithClient,
  getEventCenteredRouteWithClient: mocks.getEventCenteredRouteWithClient
}));
vi.mock("@/server/repositories/journal-event-understanding.repository", () => ({
  confirmPendingUnderstandingClaimWithClient:
    mocks.confirmPendingUnderstandingClaimWithClient
}));

import {
  buildJournalEventEntrySourceFingerprint,
  cancelJournalEventEntryGeneration,
  completeJournalEventEntryGeneration,
  createCaptureJournalEventEntry,
  failJournalEventEntryGeneration,
  getJournalEventEntryForUser,
  reserveJournalEventEntryGeneration,
  saveJournalEventEntry,
  updateJournalEventEntry
} from "@/server/repositories/journal-event-entry.repository";

const userId = "user-1";
const eventId = "event-1";
const branchSessionId = "branch-1";

function seedActiveEvent() {
  state.events.push({
    id: eventId,
    userId,
    rootSessionId: "root-1",
    entryDate: new Date("2026-07-22T00:00:00.000Z"),
    daySequence: 1,
    status: "active"
  });
  state.sessions.push(
    { id: "root-1", rootSessionId: "root-1", status: "active" },
    { id: branchSessionId, rootSessionId: "root-1", status: "active" }
  );
}

async function reserve(clientOperationId = "operation-1") {
  return reserveJournalEventEntryGeneration({
    userId,
    eventId,
    activeBranchSessionId: branchSessionId,
    clientOperationId,
    baseMessageSequence: 2,
    requestId: "request-1"
  });
}

describe("journal event entry repository", () => {
  beforeEach(() => {
    for (const values of [
      state.entries,
      state.generations,
      state.events,
      state.sessions,
      state.turns,
      state.traces
    ]) {
      values.splice(0);
    }
    state.messages.splice(0, state.messages.length,
      { id: "message-1", role: "user", sequence: 1, content: "我和同事有一次误会。" },
      { id: "message-2", role: "assistant", sequence: 2, content: "听起来这件事让你很在意。" }
    );
    vi.clearAllMocks();
    seedActiveEvent();
  });

  it("builds a stable source fingerprint for set-semantic focus fields", () => {
    const base = {
      eventId,
      activeBranchSessionId: branchSessionId,
      baseMessageSequence: 2,
      sourceMessageIds: ["message-1", "message-2"],
      sourceFactIds: ["fact-1"],
      deprioritizedFactIds: ["fact-b", "fact-a"],
      explorationFactIds: ["fact-c", "fact-1"],
      sourceAngleOutcomeIds: ["angle-feeling"]
    };

    expect(buildJournalEventEntrySourceFingerprint(base)).toBe(
      buildJournalEventEntrySourceFingerprint({
        ...base,
        deprioritizedFactIds: ["fact-a", "fact-b"],
        explorationFactIds: ["fact-1", "fact-c"]
      })
    );
    expect(buildJournalEventEntrySourceFingerprint(base)).not.toBe(
      buildJournalEventEntrySourceFingerprint({
        ...base,
        sourceMessageIds: ["message-2", "message-1"]
      })
    );
  });

  it("帮我记日志只读取已完成用户原话，并沿用编辑、保存和重开链", async () => {
    state.messages.splice(0, state.messages.length,
      {
        id: "assistant-opening",
        role: "assistant",
        sequence: 0,
        content: "这里是【帮我记】。",
        userTurn: null
      },
      {
        id: "user-message-1",
        role: "user",
        sequence: 1,
        content: "展示层文本不应成为来源",
        userTurn: {
          rawText: "今天把边界说清楚了。",
          action: "reply",
          status: "completed"
        }
      },
      {
        id: "assistant-ack-1",
        role: "assistant",
        sequence: 2,
        content: "好，这一段已经记下了。",
        userTurn: null
      },
      {
        id: "user-message-2",
        role: "user",
        sequence: 3,
        content: "展示层文本不应成为来源",
        userTurn: {
          rawText: "我是不是终于敢表达了？",
          action: "reply",
          status: "completed"
        }
      },
      {
        id: "assistant-ack-2",
        role: "assistant",
        sequence: 4,
        content: "这份疑问也记下了。",
        userTurn: null
      }
    );

    const created = await createCaptureJournalEventEntry({
      userId,
      eventId,
      activeBranchSessionId: branchSessionId,
      clientOperationId: "capture-generate-1",
      baseMessageSequence: 4
    });

    expect(created.generationOrigin).toBe("deterministic");
    expect(created.currentGenerationTraceId).toBeNull();
    expect(created.sourceFactIds).toEqual([]);
    expect(created.sourceAngleOutcomeIds).toEqual([]);
    expect(created.sourceSnapshot).toMatchObject({
      recordMode: "capture",
      messages: [
        { id: "user-message-1", role: "user", content: "今天把边界说清楚了。" },
        { id: "user-message-2", role: "user", content: "我是不是终于敢表达了？" }
      ]
    });
    expect(created.content).toBe(
      "今天把边界说清楚了。\n\n我是不是终于敢表达了？"
    );
    expect(created.content).not.toContain("好，这一段已经记下了");
    expect(state.events[0]?.status).toBe("completed");

    const edited = await updateJournalEventEntry({
      userId,
      entryId: created.id,
      expectedContentRevision: created.contentRevision,
      title: created.title,
      content: `${created.content}\n\n补充一行。`
    });
    const saved = await saveJournalEventEntry({
      userId,
      entryId: edited.id,
      expectedContentRevision: edited.contentRevision
    });
    const reopened = await getJournalEventEntryForUser({ userId, entryId: saved.id });

    expect(saved.status).toBe("saved");
    expect(reopened).toMatchObject({
      id: created.id,
      status: "saved",
      content: `${created.content}\n\n补充一行。`
    });
  });

  it("confirms the pending claim, freezes the active path, and replays the same operation", async () => {
    const first = await reserve();
    const replay = await reserve();

    expect(first.kind).toBe("generation");
    expect(replay).toEqual(first);
    expect(state.generations).toHaveLength(1);
    expect(state.turns).toHaveLength(1);
    expect(state.turns[0]).toMatchObject({
      action: "generate_event_journal",
      journalEventId: eventId,
      status: "processing"
    });
    expect(mocks.confirmPendingUnderstandingClaimWithClient).toHaveBeenCalledTimes(1);
    expect(state.events[0]).toMatchObject({ status: "generating" });
    expect(first).toMatchObject({
      kind: "generation",
      generation: {
        sourceMessageIds: ["message-1", "message-2"],
        sourceFactIds: ["fact-1"],
        sourceAngleOutcomeIds: ["angle-feeling"],
        sourceSnapshot: {
          eventId,
          branchSessionId,
          baseMessageSequence: 2,
          pendingClaimConfirmation: { status: "none" }
        }
      }
    });
    expect(state.traces[0]).toMatchObject({
      artifactType: "event_journal",
      journalEventId: eventId,
      status: "pending"
    });
  });

  it("creates one entry and closes the whole event session tree when generation completes", async () => {
    const reserved = await reserve();
    if (reserved.kind !== "generation") throw new Error("expected reserved generation");

    const completed = await completeJournalEventEntryGeneration({
      userId,
      generationId: reserved.generation.id,
      sourceFingerprint: reserved.generation.sourceFingerprint,
      title: "被认真理解",
      content: "这次误会被说开后，我看见了彼此愿意理解对方。",
      outputOrigin: "llm",
      qualityChecks: { sourceGrounded: true, basicQualityPassed: true }
    });

    expect(completed).toMatchObject({
      eventId,
      id: reserved.generation.intendedEntryId,
      status: "draft",
      contentRevision: 1,
      sourceFingerprint: reserved.generation.sourceFingerprint
    });
    expect(state.entries).toHaveLength(1);
    expect(state.events[0]).toMatchObject({ status: "completed" });
    expect(state.sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "root-1", status: "completed" }),
        expect.objectContaining({ id: branchSessionId, status: "completed" })
      ])
    );
    expect(state.generations[0]).toMatchObject({ status: "completed" });
    expect(state.turns[0]).toMatchObject({ status: "completed" });
    expect(state.traces[0]).toMatchObject({ status: "completed", outputOrigin: "llm" });

    await expect(
      completeJournalEventEntryGeneration({
        userId,
        generationId: reserved.generation.id,
        sourceFingerprint: reserved.generation.sourceFingerprint,
        title: "被认真理解",
        content: "这次误会被说开后，我看见了彼此愿意理解对方。",
        outputOrigin: "llm",
        qualityChecks: { sourceGrounded: true, basicQualityPassed: true }
      })
    ).resolves.toEqual(completed);
  });

  it.each([
    ["failed", failJournalEventEntryGeneration],
    ["canceled", cancelJournalEventEntryGeneration]
  ] as const)("returns the event to active when generation is %s", async (_status, settle) => {
    const reserved = await reserve();
    if (reserved.kind !== "generation") throw new Error("expected reserved generation");

    const settled = await settle({
      userId,
      generationId: reserved.generation.id,
      errorCode: "MODEL_TIMEOUT"
    });

    expect(settled).toMatchObject({ status: _status, errorCode: "MODEL_TIMEOUT" });
    expect(state.events[0]).toMatchObject({ status: "active", generationStartedAt: null });
    expect(state.turns[0]).toMatchObject({ status: _status, errorCode: "MODEL_TIMEOUT" });
    expect(state.traces[0]).toMatchObject({ status: _status, errorCode: "MODEL_TIMEOUT" });
  });

  it("protects editing and saving with content revisions, including modified to saved", async () => {
    const savedAt = new Date("2026-07-22T08:00:00.000Z");
    state.entries.push({
      id: "entry-1",
      eventId,
      sourceBranchSessionId: branchSessionId,
      generatedByTurnId: "turn-1",
      currentGenerationTraceId: "trace-1",
      generationId: "generation-1",
      title: "初始标题",
      content: "初始正文",
      status: "saved",
      generationOrigin: "llm",
      generationVersion: 1,
      sourceMessageSequence: 2,
      sourceMessageIds: ["message-1"],
      sourceFactIds: ["fact-1"],
      sourceAngleOutcomeIds: [],
      sourceFingerprint: "a".repeat(64),
      sourceSnapshot: { schemaVersion: 1 },
      contentRevision: 2,
      savedRevision: 2,
      editedAt: savedAt,
      savedAt,
      createdAt: savedAt,
      updatedAt: savedAt
    });

    const edited = await updateJournalEventEntry({
      userId,
      entryId: "entry-1",
      expectedContentRevision: 2,
      title: "更新后的标题",
      content: "更新后的正文"
    });
    expect(edited).toMatchObject({ status: "modified", contentRevision: 3, savedRevision: 2 });

    await expect(
      saveJournalEventEntry({ userId, entryId: "entry-1", expectedContentRevision: 2 })
    ).rejects.toThrow("EVENT_JOURNAL_ENTRY_VERSION_CONFLICT");
    await expect(
      updateJournalEventEntry({
        userId,
        entryId: "entry-1",
        expectedContentRevision: 2,
        title: "晚到的编辑",
        content: "晚到的正文"
      })
    ).rejects.toThrow("EVENT_JOURNAL_ENTRY_VERSION_CONFLICT");

    const saved = await saveJournalEventEntry({
      userId,
      entryId: "entry-1",
      expectedContentRevision: 3
    });
    expect(saved).toMatchObject({ status: "saved", contentRevision: 3, savedRevision: 3 });
    await expect(
      saveJournalEventEntry({ userId, entryId: "entry-1", expectedContentRevision: 3 })
    ).resolves.toEqual(saved);
  });
});
