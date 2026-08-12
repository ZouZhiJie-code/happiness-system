/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JournalDailySourceEntry } from "@/types/journal-daily-entry";

const { mockPrisma, state } = vi.hoisted(() => {
  const now = () => new Date("2026-08-10T10:00:00.000Z");
  const state = {
    eventEntries: [] as any[],
    dailyEntries: [] as any[],
    revisions: [] as any[],
    generations: [] as any[],
    traces: [] as any[],
    nextDailyEntryId: 1,
    nextRevisionId: 1,
    nextGenerationId: 1
  };

  const findEventEntries = ({ where, orderBy }: any) => {
    const bounds = where.event?.entryDate;
    const status = where.event?.status;
    const entries = state.eventEntries.filter((entry) => {
      const event = entry.event;
      if (where.event?.userId && event.userId !== where.event.userId) return false;
      if (status?.not && event.status === status.not) return false;
      if (typeof status === "string" && event.status !== status) return false;
      if (bounds?.gte && event.entryDate < bounds.gte) return false;
      if (bounds?.lt && event.entryDate >= bounds.lt) return false;
      return true;
    });

    if (Array.isArray(orderBy)) {
      entries.sort((left, right) =>
        left.event.daySequence - right.event.daySequence || left.id.localeCompare(right.id)
      );
    }
    return entries;
  };

  const applyData = (record: any, data: any) => {
    for (const [key, value] of Object.entries(data)) {
      record[key] = typeof value === "object" && value && "increment" in value
        ? record[key] + (value as { increment: number }).increment
        : value;
    }
    record.updatedAt = now();
  };

  const mockPrisma: Record<string, any> = {
    $transaction: vi.fn(async (operation: any) => operation(mockPrisma))
  };
  mockPrisma.journalEventEntry = {
    findMany: vi.fn(async (args: any) => findEventEntries(args))
  };
  mockPrisma.journalDailyEntry = {
    findUnique: vi.fn(async ({ where }: any) => {
      const key = where.userId_entryDate;
      return state.dailyEntries.find(
        (entry) => entry.userId === key.userId && entry.entryDate.getTime() === key.entryDate.getTime()
      ) ?? null;
    }),
    findFirst: vi.fn(async ({ where }: any) =>
      state.dailyEntries.find((entry) => entry.id === where.id && entry.userId === where.userId) ?? null
    ),
    create: vi.fn(async ({ data }: any) => {
      const entry = {
        ...data,
        id: `daily-${state.nextDailyEntryId++}`,
        createdAt: now(),
        updatedAt: now()
      };
      state.dailyEntries.push(entry);
      return entry;
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const entry = state.dailyEntries.find(
        (candidate) =>
          candidate.id === where.id &&
          (where.userId === undefined || candidate.userId === where.userId) &&
          (where.contentRevision === undefined || candidate.contentRevision === where.contentRevision)
      );
      if (!entry) return { count: 0 };
      applyData(entry, data);
      return { count: 1 };
    })
  };
  mockPrisma.journalDailyEntryRevision = {
    create: vi.fn(async ({ data }: any) => {
      const revision = {
        ...data,
        id: `revision-${state.nextRevisionId++}`,
        createdAt: now()
      };
      state.revisions.push(revision);
      return revision;
    }),
    findFirst: vi.fn(async ({ where }: any) =>
      [...state.revisions].reverse().find((revision) => {
        const entry = state.dailyEntries.find((item) => item.id === revision.entryId);
        return revision.entryId === where.entryId && revision.kind === where.kind && entry?.userId === where.entry.userId;
      }) ?? null
    )
  };
  mockPrisma.journalDailyEntryGeneration = {
    findUnique: vi.fn(async ({ where }: any) => {
      const key = where.userId_entryDate_clientOperationId;
      return state.generations.find(
        (generation) => generation.userId === key.userId &&
          generation.entryDate.getTime() === key.entryDate.getTime() &&
          generation.clientOperationId === key.clientOperationId
      ) ?? null;
    }),
    findFirst: vi.fn(async ({ where }: any) => {
      if (where.id) {
        return state.generations.find(
          (generation) => generation.id === where.id && generation.userId === where.userId
        ) ?? null;
      }
      return [...state.generations].reverse().find(
        (generation) => generation.userId === where.userId &&
          generation.entryDate.getTime() === where.entryDate.getTime()
      ) ?? null;
    }),
    create: vi.fn(async ({ data }: any) => {
      const generation = {
        ...data,
        id: `generation-${state.nextGenerationId++}`,
        status: "processing",
        resultRevisionId: null,
        attemptCount: 1,
        errorCode: null,
        startedAt: now(),
        completedAt: null,
        failedAt: null,
        canceledAt: null,
        createdAt: now(),
        updatedAt: now()
      };
      state.generations.push(generation);
      return generation;
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const generation = state.generations.find(
        (candidate) => candidate.id === where.id && candidate.userId === where.userId &&
          (where.status === undefined || candidate.status === where.status)
      );
      if (!generation) return { count: 0 };
      applyData(generation, data);
      return { count: 1 };
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const generation = state.generations.find((candidate) => candidate.id === where.id);
      if (!generation) throw new Error("generation missing");
      applyData(generation, data);
      return generation;
    })
  };
  mockPrisma.aIGenerationTrace = {
    create: vi.fn(async ({ data }: any) => {
      const trace = {
        ...data,
        id: data.id ?? `trace-${state.traces.length + 1}`,
        status: "pending",
        pipelineDecisions: data.pipelineDecisions ?? [],
        createdAt: now(),
        updatedAt: now()
      };
      state.traces.push(trace);
      return trace;
    }),
    findUnique: vi.fn(async ({ where }: any) =>
      state.traces.find((trace) => trace.id === where.id) ?? null
    ),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const trace = state.traces.find(
        (candidate) => candidate.id === where.id &&
          (where.status === undefined || candidate.status === where.status)
      );
      if (!trace) return { count: 0 };
      applyData(trace, data);
      return { count: 1 };
    })
  };

  return { mockPrisma, state };
});

vi.mock("@/server/db/prisma", () => ({ prisma: mockPrisma }));

import {
  buildJournalDailyWritingMaterial,
  commitJournalDailyEntryDraft,
  failJournalDailyEntryGeneration,
  getJournalDailyGenerationRepositoryView,
  getJournalDailyJournalView,
  getLatestSavedJournalDailyEntryRevision,
  listCurrentJournalEventEntriesForDailyJournal,
  reserveJournalDailyEntryGeneration,
  saveJournalDailyEntry,
  updateJournalDailyEntry
} from "@/server/repositories/journal-daily-entry.repository";
import { mapJournalDailyGenerationSource } from "@/server/services/journal-daily-entry/repository-adapter";

const userId = "user-1";
const entryDate = "2026-08-10";
const entryDateValue = new Date("2026-08-09T16:00:00.000Z");

function addEventEntry(overrides: Record<string, unknown> = {}) {
  const sequence = state.eventEntries.length + 1;
  const entry = {
    id: `event-entry-${sequence}`,
    title: "一件值得记下的事",
    content: "这是记录卡正文。",
    occurredAtText: null,
    status: "draft",
    contentRevision: 1,
    savedRevision: null,
    savedAt: null,
    updatedAt: new Date(`2026-08-10T0${Math.min(sequence, 9)}:00:00.000Z`),
    sourceSnapshot: {
      messages: [
        { id: `message-${sequence}-1`, role: "user" },
        { id: `message-${sequence}-2`, role: "assistant" }
      ]
    },
    event: {
      id: `event-${sequence}`,
      userId,
      status: "completed",
      entryDate: entryDateValue,
      daySequence: sequence,
      startedAt: new Date(`2026-08-10T0${Math.min(sequence, 9)}:00:00.000Z`)
    },
    ...overrides
  };
  state.eventEntries.push(entry);
  return entry;
}

function addDailyEntry(overrides: Record<string, unknown> = {}) {
  const entry = {
    id: `daily-${state.nextDailyEntryId++}`,
    userId,
    entryDate: entryDateValue,
    title: "8月10日",
    content: "当天完整日记正文。",
    paragraphs: {
      schemaVersion: 1,
      paragraphs: [{ text: "当天完整日记正文。", sourceRecordIds: ["event-entry-1"] }]
    },
    status: "draft",
    sourceEntryIds: ["event-entry-1"],
    sourceEventIds: ["event-1"],
    sourceSignature: "v2|initial",
    sourceSnapshot: { schemaVersion: 2, entryDate, sources: [] },
    sourceUpdatedAt: new Date("2026-08-10T01:00:00.000Z"),
    contentRevision: 1,
    savedRevision: null,
    currentGenerationTraceId: null,
    lastGenerationErrorCode: null,
    editedAt: null,
    savedAt: null,
    createdAt: new Date("2026-08-10T02:00:00.000Z"),
    updatedAt: new Date("2026-08-10T02:00:00.000Z"),
    ...overrides
  };
  state.dailyEntries.push(entry);
  return entry;
}

function publicSource(overrides: Partial<JournalDailySourceEntry> = {}): JournalDailySourceEntry {
  return {
    eventId: "event-source",
    entryId: "entry-source",
    entryDate,
    daySequence: 1,
    title: "记录标题",
    content: "这是当前记录卡正文。",
    contentRevision: 2,
    savedRevision: null,
    savedAt: null,
    updatedAt: "2026-08-10T03:00:00.000Z",
    recordedAt: "2026-08-10T02:00:00.000Z",
    occurredAt: null,
    sourceMode: "chat",
    recordCount: 2,
    sourceMessageIds: ["message-1"],
    ...overrides
  };
}

async function currentSignature() {
  return (await getJournalDailyJournalView(userId, entryDate)).sourceSignature;
}

describe("journal daily entry repository", () => {
  beforeEach(() => {
    state.eventEntries.splice(0);
    state.dailyEntries.splice(0);
    state.revisions.splice(0);
    state.generations.splice(0);
    state.traces.splice(0);
    state.nextDailyEntryId = 1;
    state.nextRevisionId = 1;
    state.nextGenerationId = 1;
    vi.clearAllMocks();
  });

  it("uses every current record-card revision and orders it by daySequence", async () => {
    addEventEntry({
      id: "entry-seq-2",
      status: "saved",
      savedRevision: 1,
      event: { id: "event-2", userId, status: "completed", entryDate: entryDateValue, daySequence: 2, startedAt: new Date("2026-08-10T02:00:00Z") }
    });
    addEventEntry({
      id: "entry-seq-1",
      status: "modified",
      contentRevision: 3,
      savedRevision: 2,
      event: { id: "event-1", userId, status: "completed", entryDate: entryDateValue, daySequence: 1, startedAt: new Date("2026-08-10T01:00:00Z") }
    });
    addEventEntry({
      id: "entry-abandoned",
      event: { id: "event-3", userId, status: "abandoned", entryDate: entryDateValue, daySequence: 3, startedAt: new Date("2026-08-10T03:00:00Z") }
    });

    const sources = await listCurrentJournalEventEntriesForDailyJournal(userId, entryDate);

    expect(sources.map((source) => source.entryId)).toEqual(["entry-seq-1", "entry-seq-2"]);
    expect(sources.map((source) => source.contentRevision)).toEqual([3, 1]);
    expect(sources[0]).toMatchObject({ sourceMode: "capture", recordCount: 1 });
  });

  it("builds writer-only layers and pairs each referenced answer with the latest real question", () => {
    const material = buildJournalDailyWritingMaterial({
      content: "中午和同事把误会说开了。\n\n我看见的\n\n我其实很在意这段合作。\n\n我也愿意先说清楚。",
      contentRevision: 1,
      editedAt: new Date("2026-08-10T03:00:00.000Z"),
      sourceMessageIds: ["answer-1", "answer-2", "answer-4"],
      sourceSnapshot: {
        messages: [
          { id: "question-1", role: "assistant", sequence: 1, content: "这件事里你最在意什么？" },
          { id: "answer-1", role: "user", sequence: 2, content: "我很在意合作。" },
          { id: "statement", role: "assistant", sequence: 3, content: "我听见你很在意这段关系。" },
          { id: "answer-2", role: "user", sequence: 4, content: "是的。" },
          { id: "question-3", role: "assistant", sequence: 5, content: "你还想补充什么？" },
          { id: "unreferenced", role: "user", sequence: 6, content: "暂时没有。" },
          { id: "answer-3", role: "user", sequence: 7, content: "后来又想到一点。" },
          { id: "quoted", role: "assistant", sequence: 8, content: "你提到‘为什么会这样？’，这句话我先记住。" },
          { id: "answer-4", role: "user", sequence: 9, content: "好。" },
          { id: "question-4", role: "assistant", sequence: 10, content: "回到当时。你最想留下的画面是什么？" },
          { id: "answer-5", role: "user", sequence: 11, content: "就是说开后的那一刻。" }
        ]
      }
    });

    expect(material).toEqual({
      eventText: "中午和同事把误会说开了。",
      supportedInsights: ["我其实很在意这段合作。", "我也愿意先说清楚。"],
      questionContext: [{
        answerSourceMessageId: "answer-1",
        question: "这件事里你最在意什么？"
      }],
      basedOnContentRevision: 1
    });
  });

  it("drops hidden structure after a user edit and keeps the complete current card as material", () => {
    expect(buildJournalDailyWritingMaterial({
      content: "这是用户纠正和删改后的完整正文。",
      contentRevision: 2,
      editedAt: new Date("2026-08-10T04:00:00.000Z"),
      sourceMessageIds: ["answer-1"],
      sourceSnapshot: {
        messages: [
          { id: "question-1", role: "assistant", sequence: 1, content: "原来是因为生气吗？" },
          { id: "answer-1", role: "user", sequence: 2, content: "不是。" }
        ]
      }
    })).toEqual({
      eventText: "这是用户纠正和删改后的完整正文。",
      supportedInsights: [],
      questionContext: [],
      basedOnContentRevision: 2
    });
  });

  it("uses contextual structure only when it belongs to the current card revision", () => {
    const source = publicSource();
    const stale = mapJournalDailyGenerationSource(source, {
      eventText: "旧版本事件",
      supportedInsights: ["旧版本认识"],
      questionContext: [{ answerSourceMessageId: "old-answer", question: "旧问题是什么？" }],
      basedOnContentRevision: 1
    });
    expect(stale.writingMaterial).toEqual({
      eventText: source.content,
      supportedInsights: [],
      questionContext: [],
      basedOnContentRevision: 2
    });

    const current = mapJournalDailyGenerationSource(publicSource({
      content: "这是事件主干。\n\n我看见的\n\n这是当前认识。",
      contentRevision: 1
    }), {
      eventText: "这是事件主干。",
      supportedInsights: ["这是当前认识。"],
      questionContext: [{ answerSourceMessageId: " answer-1 ", question: " 当时怎样？ " }],
      basedOnContentRevision: 1
    });
    expect(current.writingMaterial).toEqual({
      eventText: "这是事件主干。",
      supportedInsights: ["这是当前认识。"],
      questionContext: [{ answerSourceMessageId: "answer-1", question: "当时怎样？" }],
      basedOnContentRevision: 1
    });
  });

  it("keeps writer-only context out of the public view and persisted source snapshot", async () => {
    addEventEntry({
      id: "entry-context",
      editedAt: null,
      sourceMessageIds: ["answer-context"],
      content: "上午忘带电脑，节奏有点乱。\n\n我看见的\n\n我一着急就容易乱。",
      sourceSnapshot: {
        messages: [
          { id: "question-context", role: "assistant", sequence: 1, content: "当时最明显的感受是什么？" },
          { id: "answer-context", role: "user", sequence: 2, content: "我有点着急。" }
        ]
      }
    });

    const internal = await getJournalDailyGenerationRepositoryView(userId, entryDate);
    expect(internal.sourceWritingMaterials[0]?.writingMaterial).toMatchObject({
      eventText: "上午忘带电脑，节奏有点乱。",
      supportedInsights: ["我一着急就容易乱。"],
      questionContext: [{ answerSourceMessageId: "answer-context" }]
    });
    expect(JSON.stringify(internal.journalView)).not.toContain("writingMaterial");
    expect(JSON.stringify(internal.journalView)).not.toContain("questionContext");

    const signature = internal.journalView.sourceSignature;
    await commitJournalDailyEntryDraft({
      userId,
      entryDate,
      expectedSourceSignature: signature,
      expectedContentRevision: null,
      title: "8月10日",
      content: "上午忘带电脑，节奏有点乱。",
      paragraphs: {
        schemaVersion: 1,
        paragraphs: [{ text: "上午忘带电脑，节奏有点乱。", sourceRecordIds: ["entry-context"] }]
      }
    });
    expect(JSON.stringify(state.dailyEntries[0]?.sourceSnapshot)).not.toContain("writingMaterial");
    expect(JSON.stringify(state.dailyEntries[0]?.sourceSnapshot)).not.toContain("questionContext");
  });

  it("keeps the selected record mode even when message count would infer another mode", async () => {
    addEventEntry({
      id: "entry-explicit-chat",
      sourceSnapshot: { messages: [{ id: "message-only", role: "user" }] },
      event: {
        id: "event-explicit-chat",
        userId,
        status: "completed",
        entryDate: entryDateValue,
        daySequence: 1,
        startedAt: new Date("2026-08-10T01:00:00Z"),
        rootSession: { recordMode: "chat" }
      }
    });

    await expect(
      listCurrentJournalEventEntriesForDailyJournal(userId, entryDate)
    ).resolves.toEqual([
      expect.objectContaining({ sourceMode: "chat", recordCount: 1 })
    ]);
  });

  it("projects one record as generatable and marks current-card edits stale", async () => {
    expect(await getJournalDailyJournalView(userId, entryDate)).toMatchObject({
      collection: { kind: "empty" },
      displayStatus: "ungenerated"
    });

    const record = addEventEntry({ id: "entry-1" });
    const signature = await currentSignature();
    addDailyEntry({ sourceSignature: signature, status: "saved", savedRevision: 1, savedAt: new Date() });

    expect(await getJournalDailyJournalView(userId, entryDate)).toMatchObject({
      collection: { kind: "single_entry", entryId: "entry-1" },
      freshness: "saved",
      displayStatus: "saved",
      updateBlockedByPendingSource: false
    });

    record.contentRevision = 2;
    expect(await getJournalDailyJournalView(userId, entryDate)).toMatchObject({
      freshness: "stale",
      displayStatus: "stale"
    });
  });

  it("returns to the ungenerated action when an initial generation fails", async () => {
    addEventEntry({ id: "entry-generate-failure" });
    const sourceSignature = await currentSignature();
    const generation = await reserveJournalDailyEntryGeneration({
      userId,
      entryDate,
      clientOperationId: "generate-failure",
      kind: "generate",
      expectedSourceSignature: sourceSignature,
      expectedContentRevision: null
    });

    await failJournalDailyEntryGeneration({
      userId,
      generationId: generation.id,
      errorCode: "UPSTREAM_TIMEOUT"
    });

    await expect(getJournalDailyJournalView(userId, entryDate)).resolves.toMatchObject({
      entry: null,
      displayStatus: "ungenerated"
    });
  });

  it("generates a daily journal from one record and persists paragraph sources plus an immutable revision", async () => {
    addEventEntry({ id: "entry-1" });
    const sourceSignature = await currentSignature();

    await expect(commitJournalDailyEntryDraft({
      userId,
      entryDate,
      expectedSourceSignature: sourceSignature,
      expectedContentRevision: null,
      title: "8月10日",
      content: "今天留下了一件值得记住的事。",
      paragraphs: {
        schemaVersion: 1,
        paragraphs: [{ text: "今天留下了一件值得记住的事。", sourceRecordIds: ["missing"] }]
      }
    })).rejects.toThrow("JOURNAL_DAILY_PARAGRAPHS_INVALID");

    const committed = await commitJournalDailyEntryDraft({
      userId,
      entryDate,
      expectedSourceSignature: sourceSignature,
      expectedContentRevision: null,
      title: "8月10日",
      content: "今天留下了一件值得记住的事。",
      paragraphs: {
        schemaVersion: 1,
        paragraphs: [{ text: "今天留下了一件值得记住的事。", sourceRecordIds: ["entry-1"] }]
      }
    });

    expect(committed).toMatchObject({ status: "draft", contentRevision: 1 });
    expect(state.revisions).toHaveLength(1);
    expect(state.revisions[0]).toMatchObject({ kind: "generated", contentRevision: 1 });
  });

  it("reserves update idempotently and atomically produces a new draft over the saved base", async () => {
    addEventEntry({ id: "entry-1" });
    const sourceSignature = await currentSignature();
    addDailyEntry({
      sourceSignature,
      status: "saved",
      savedRevision: 1,
      savedAt: new Date("2026-08-10T03:00:00Z")
    });

    const reserved = await reserveJournalDailyEntryGeneration({
      userId,
      entryDate,
      clientOperationId: "operation-1",
      kind: "update",
      expectedSourceSignature: sourceSignature,
      expectedContentRevision: 1
    });
    expect((await reserveJournalDailyEntryGeneration({
      userId,
      entryDate,
      clientOperationId: "operation-1",
      kind: "update",
      expectedSourceSignature: sourceSignature,
      expectedContentRevision: 1
    })).id).toBe(reserved.id);

    const updated = await commitJournalDailyEntryDraft({
      userId,
      entryDate,
      generationId: reserved.id,
      expectedSourceSignature: sourceSignature,
      expectedContentRevision: 1,
      title: "8月10日",
      content: "更新后仍保留用户已经保存的版本。",
      paragraphs: {
        schemaVersion: 1,
        paragraphs: [{ text: "更新后仍保留用户已经保存的版本。", sourceRecordIds: ["entry-1"] }]
      }
    });

    expect(updated).toMatchObject({ status: "modified", contentRevision: 2, savedRevision: 1 });
    expect(state.generations[0]).toMatchObject({ status: "completed", entryId: updated.id });
    expect(state.traces[0]).toMatchObject({ status: "completed", artifactId: updated.id });
    expect(state.revisions.at(-1)).toMatchObject({ kind: "updated", contentRevision: 2 });
  });

  it("lets the user keep editing while stale and blocks saving until records are updated", async () => {
    const record = addEventEntry({ id: "entry-1" });
    const sourceSignature = await currentSignature();
    const daily = addDailyEntry({
      sourceSignature,
      status: "saved",
      savedRevision: 1,
      savedAt: new Date("2026-08-10T03:00:00Z")
    });
    record.contentRevision = 2;

    const edited = await updateJournalDailyEntry({
      userId,
      entryId: daily.id,
      expectedContentRevision: 1,
      title: "8月10日",
      content: "我继续修改了日记正文。"
    });
    expect(edited).toMatchObject({ status: "modified", contentRevision: 2, savedRevision: 1 });
    await expect(saveJournalDailyEntry({
      userId,
      entryId: daily.id,
      expectedContentRevision: 2
    })).rejects.toThrow("JOURNAL_DAILY_SOURCE_CHANGED");
  });

  it("preserves paragraph provenance when the user deletes an unchanged record paragraph", async () => {
    addEventEntry({ id: "entry-1" });
    addEventEntry({ id: "entry-2" });
    const dayView = await getJournalDailyJournalView(userId, entryDate);
    const daily = addDailyEntry({
      content: "第一段来自第一张记录。\n\n第二段来自第二张记录。",
      paragraphs: {
        schemaVersion: 1,
        paragraphs: [
          { text: "第一段来自第一张记录。", sourceRecordIds: ["entry-1"] },
          { text: "第二段来自第二张记录。", sourceRecordIds: ["entry-2"] }
        ]
      },
      sourceEntryIds: ["entry-1", "entry-2"],
      sourceEventIds: ["event-1", "event-2"],
      sourceSignature: dayView.sourceSignature,
      sourceSnapshot: {
        schemaVersion: 2,
        entryDate,
        sources: dayView.savedSources
      }
    });

    const edited = await updateJournalDailyEntry({
      userId,
      entryId: daily.id,
      expectedContentRevision: 1,
      title: "8月10日",
      content: "第二段来自第二张记录。"
    });
    expect(edited.paragraphs.paragraphs).toEqual([
      { text: "第二段来自第二张记录。", sourceRecordIds: ["entry-2"] }
    ]);

    await saveJournalDailyEntry({
      userId,
      entryId: daily.id,
      expectedContentRevision: 2
    });
    expect(await getLatestSavedJournalDailyEntryRevision(userId, daily.id)).toMatchObject({
      paragraphs: {
        paragraphs: [{ sourceRecordIds: ["entry-2"] }]
      }
    });
  });

  it("keeps a user-added paragraph unmapped instead of attributing it to every record", async () => {
    addEventEntry({ id: "entry-1" });
    const dayView = await getJournalDailyJournalView(userId, entryDate);
    const daily = addDailyEntry({
      content: "原有记录段落。",
      paragraphs: {
        schemaVersion: 1,
        paragraphs: [{ text: "原有记录段落。", sourceRecordIds: ["entry-1"] }]
      },
      sourceEntryIds: ["entry-1"],
      sourceEventIds: ["event-1"],
      sourceSignature: dayView.sourceSignature,
      sourceSnapshot: { schemaVersion: 2, entryDate, sources: dayView.savedSources }
    });

    const edited = await updateJournalDailyEntry({
      userId,
      entryId: daily.id,
      expectedContentRevision: 1,
      title: "8月10日",
      content: "原有记录段落。\n\n这是我后来亲手补的一句。"
    });

    expect(edited.paragraphs.paragraphs).toEqual([
      { text: "原有记录段落。", sourceRecordIds: ["entry-1"] },
      { text: "这是我后来亲手补的一句。", sourceRecordIds: [] }
    ]);
    await expect(saveJournalDailyEntry({
      userId,
      entryId: daily.id,
      expectedContentRevision: 2
    })).resolves.toMatchObject({ status: "saved" });
  });

  it("rejects a late generation result after the user changed the current draft", async () => {
    addEventEntry({ id: "entry-1" });
    const sourceSignature = await currentSignature();
    const daily = addDailyEntry({ sourceSignature });
    const reserved = await reserveJournalDailyEntryGeneration({
      userId,
      entryDate,
      clientOperationId: "operation-late",
      kind: "generate",
      expectedSourceSignature: sourceSignature,
      expectedContentRevision: 1
    });
    await updateJournalDailyEntry({
      userId,
      entryId: daily.id,
      expectedContentRevision: 1,
      title: "8月10日",
      content: "用户的新修改。"
    });

    await expect(commitJournalDailyEntryDraft({
      userId,
      entryDate,
      generationId: reserved.id,
      expectedSourceSignature: sourceSignature,
      expectedContentRevision: 1,
      title: "8月10日",
      content: "迟到的生成结果。"
    })).rejects.toThrow("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
  });

  it("captures the user-saved version and keeps a failed update recoverable", async () => {
    addEventEntry({ id: "entry-1" });
    const sourceSignature = await currentSignature();
    const daily = addDailyEntry({ sourceSignature });

    const saved = await saveJournalDailyEntry({
      userId,
      entryId: daily.id,
      expectedContentRevision: 1
    });
    expect(saved).toMatchObject({ status: "saved", savedRevision: 1 });
    expect(await getLatestSavedJournalDailyEntryRevision(userId, daily.id)).toMatchObject({
      kind: "user_saved",
      contentRevision: 1
    });

    const record = state.eventEntries[0]!;
    record.contentRevision = 2;
    const nextSignature = await currentSignature();
    const generation = await reserveJournalDailyEntryGeneration({
      userId,
      entryDate,
      clientOperationId: "operation-failed",
      kind: "update",
      expectedSourceSignature: nextSignature,
      expectedContentRevision: 1
    });
    await failJournalDailyEntryGeneration({
      userId,
      generationId: generation.id,
      errorCode: "QUALITY_GATE_FAILED"
    });

    const view = await getJournalDailyJournalView(userId, entryDate);
    expect(view).toMatchObject({ displayStatus: "update_failed" });
    expect(view.entry?.content).toBe("当天完整日记正文。");
    expect(state.traces.at(-1)).toMatchObject({ status: "failed", errorCode: "QUALITY_GATE_FAILED" });
  });
});
