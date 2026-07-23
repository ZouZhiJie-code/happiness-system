/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, state } = vi.hoisted(() => {
  const now = () => new Date("2026-07-22T10:00:00.000Z");
  const state = {
    eventEntries: [] as any[],
    dailyEntries: [] as any[],
    dailyGenerations: [] as any[],
    nextDailyEntryId: 1
  };

  const findEventEntries = ({ where, orderBy }: any) => {
    const statuses =
      typeof where.status === "string"
        ? [where.status]
        : Array.isArray(where.status?.in)
          ? where.status.in
          : [];
    const bounds = where.event?.entryDate;
    const entries = state.eventEntries.filter((entry) => {
      const event = entry.event;
      if (statuses.length > 0 && !statuses.includes(entry.status)) return false;
      if (where.savedRevision?.not === null && entry.savedRevision === null) return false;
      if (where.savedAt?.not === null && entry.savedAt === null) return false;
      if (where.event?.userId && event.userId !== where.event.userId) return false;
      if (where.event?.status && event.status !== where.event.status) return false;
      if (bounds?.gte && event.entryDate < bounds.gte) return false;
      if (bounds?.lt && event.entryDate >= bounds.lt) return false;
      return true;
    });

    if (Array.isArray(orderBy)) {
      entries.sort((left, right) =>
        left.event.daySequence - right.event.daySequence || left.id.localeCompare(right.id)
      );
    } else if (orderBy?.id === "asc") {
      entries.sort((left, right) => left.id.localeCompare(right.id));
    }

    return entries;
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
    update: vi.fn(async ({ where, data }: any) => {
      const entry = state.dailyEntries.find((candidate) => candidate.id === where.id);
      if (!entry) throw new Error("entry missing");
      Object.assign(entry, data, { updatedAt: now() });
      return entry;
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const entry = state.dailyEntries.find(
        (candidate) =>
          candidate.id === where.id &&
          candidate.userId === where.userId &&
          (where.contentRevision === undefined || candidate.contentRevision === where.contentRevision)
      );
      if (!entry) return { count: 0 };

      for (const [key, value] of Object.entries(data)) {
        entry[key] =
          typeof value === "object" && value && "increment" in value
            ? entry[key] + (value as { increment: number }).increment
            : value;
      }
      entry.updatedAt = now();
      return { count: 1 };
    })
  };
  mockPrisma.journalDailyEntryGeneration = {
    findFirst: vi.fn(async ({ where }: any) => {
      const matching = state.dailyGenerations.filter(
        (generation) =>
          generation.userId === where.userId &&
          generation.entryDate.getTime() === where.entryDate.getTime()
      );
      return matching.at(-1) ?? null;
    })
  };

  return { mockPrisma, state };
});

vi.mock("@/server/db/prisma", () => ({ prisma: mockPrisma }));

import {
  commitJournalDailyEntryDraft,
  getJournalDailyJournalView,
  listSavedJournalEventEntriesForDailyJournal,
  saveJournalDailyEntry,
  updateJournalDailyEntry
} from "@/server/repositories/journal-daily-entry.repository";

const userId = "user-1";
const entryDate = "2026-07-22";
const entryDateValue = new Date("2026-07-21T16:00:00.000Z");

function addEventEntry(
  overrides: Record<string, unknown> = {}
) {
  const entry = {
    id: `event-entry-${state.eventEntries.length + 1}`,
    title: "一件值得记下的事",
    content: "这是事件日志正文。",
    status: "saved",
    contentRevision: 1,
    savedRevision: 1,
    savedAt: new Date("2026-07-22T01:00:00.000Z"),
    event: {
      id: `event-${state.eventEntries.length + 1}`,
      userId,
      status: "completed",
      entryDate: entryDateValue,
      daySequence: state.eventEntries.length + 1
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
    title: "当天小结",
    content: "当天完整日志正文。",
    status: "draft",
    sourceEntryIds: ["event-entry-1", "event-entry-2"],
    sourceEventIds: ["event-1", "event-2"],
    sourceSignature: "v1|initial",
    sourceSnapshot: { schemaVersion: 1, entryDate, sources: [] },
    sourceUpdatedAt: new Date("2026-07-22T01:00:00.000Z"),
    contentRevision: 1,
    savedRevision: null,
    editedAt: null,
    savedAt: null,
    createdAt: new Date("2026-07-22T02:00:00.000Z"),
    updatedAt: new Date("2026-07-22T02:00:00.000Z"),
    ...overrides
  };
  state.dailyEntries.push(entry);
  return entry;
}

function signatureForCurrentSavedSources() {
  return listSavedJournalEventEntriesForDailyJournal(userId, entryDate).then((sources) =>
    [
      "v1",
      ...sources.map(
        (source) =>
          `event:${source.eventId}|entry:${source.entryId}|seq:${source.daySequence}|saved:${source.savedRevision}`
      )
    ].join("|")
  );
}

describe("journal daily entry repository", () => {
  beforeEach(() => {
    state.eventEntries.splice(0);
    state.dailyEntries.splice(0);
    state.dailyGenerations.splice(0);
    state.nextDailyEntryId = 1;
    vi.clearAllMocks();
  });

  it("only treats completed, saved, revision-consistent event logs as sources and orders them by daySequence", async () => {
    addEventEntry({ id: "entry-seq-2", event: { id: "event-2", userId, status: "completed", entryDate: entryDateValue, daySequence: 2 } });
    addEventEntry({ id: "entry-seq-1", event: { id: "event-1", userId, status: "completed", entryDate: entryDateValue, daySequence: 1 } });
    addEventEntry({ id: "entry-unsaved", status: "draft", savedRevision: null, savedAt: null });
    addEventEntry({ id: "entry-modified", status: "modified", contentRevision: 2, savedRevision: 1 });
    addEventEntry({ id: "entry-revision-mismatch", contentRevision: 2, savedRevision: 1 });
    addEventEntry({
      id: "entry-active-event",
      event: { id: "event-active", userId, status: "active", entryDate: entryDateValue, daySequence: 6 }
    });

    const sources = await listSavedJournalEventEntriesForDailyJournal(userId, entryDate);

    expect(sources.map((source) => source.entryId)).toEqual(["entry-seq-1", "entry-seq-2"]);
    expect(sources.map((source) => source.daySequence)).toEqual([1, 2]);
  });

  it("projects empty, one-event, and multi-event daily entry states and marks a changed source set stale", async () => {
    expect((await getJournalDailyJournalView(userId, entryDate))).toMatchObject({
      collection: { kind: "empty" },
      freshness: "none",
      updateBlockedByPendingSource: false
    });

    addEventEntry({ id: "entry-1" });
    expect((await getJournalDailyJournalView(userId, entryDate))).toMatchObject({
      collection: { kind: "single_entry", entryId: "entry-1" },
      freshness: "none",
      updateBlockedByPendingSource: false
    });

    addEventEntry({ id: "entry-2" });
    const sourceSignature = await signatureForCurrentSavedSources();
    addDailyEntry({ sourceSignature, status: "saved", savedRevision: 1 });
    addEventEntry({ id: "entry-awaiting-save", status: "modified", contentRevision: 2, savedRevision: 1 });

    const current = await getJournalDailyJournalView(userId, entryDate);
    expect(current).toMatchObject({
      collection: { kind: "multiple_entries" },
      freshness: "saved",
      updateBlockedByPendingSource: true,
      pendingSaveEntryIds: ["entry-awaiting-save"]
    });

    state.eventEntries.find((entry) => entry.id === "entry-2")!.savedRevision = 2;
    state.eventEntries.find((entry) => entry.id === "entry-2")!.contentRevision = 2;

    expect((await getJournalDailyJournalView(userId, entryDate))).toMatchObject({ freshness: "stale" });
  });

  it("requires stable sources, a matching version, and explicit replacement of a manually edited draft", async () => {
    addEventEntry({ id: "entry-1" });

    await expect(
      commitJournalDailyEntryDraft({
        userId,
        entryDate,
        expectedSourceSignature: "v1|single",
        expectedContentRevision: null,
        replaceManualEditsConfirmed: false,
        title: "当天小结",
        content: "来源不足时不应生成当天完整日志。"
      })
    ).rejects.toThrow("JOURNAL_DAILY_SOURCE_INSUFFICIENT");

    addEventEntry({ id: "entry-2" });
    const sourceSignature = await signatureForCurrentSavedSources();
    addDailyEntry({ status: "modified", contentRevision: 3, savedRevision: 2, sourceSignature });

    await expect(
      commitJournalDailyEntryDraft({
        userId,
        entryDate,
        expectedSourceSignature: "v1|outdated",
        expectedContentRevision: 3,
        replaceManualEditsConfirmed: true,
        title: "当天小结",
        content: "来源变化时不能覆盖已有当天日志。"
      })
    ).rejects.toThrow("JOURNAL_DAILY_SOURCE_CHANGED");

    await expect(
      commitJournalDailyEntryDraft({
        userId,
        entryDate,
        expectedSourceSignature: sourceSignature,
        expectedContentRevision: 2,
        replaceManualEditsConfirmed: true,
        title: "当天小结",
        content: "版本变化时不能覆盖已有当天日志。"
      })
    ).rejects.toThrow("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");

    await expect(
      commitJournalDailyEntryDraft({
        userId,
        entryDate,
        expectedSourceSignature: sourceSignature,
        expectedContentRevision: 3,
        replaceManualEditsConfirmed: false,
        title: "当天小结",
        content: "手动编辑中的日志需要用户确认才可替换。"
      })
    ).rejects.toThrow("JOURNAL_DAILY_MANUAL_EDITS_CONFIRMATION_REQUIRED");

    const committed = await commitJournalDailyEntryDraft({
      userId,
      entryDate,
      expectedSourceSignature: sourceSignature,
      expectedContentRevision: 3,
      replaceManualEditsConfirmed: true,
      title: "当天小结",
      content: "确认后可以用最新来源重新整理当天完整日志。"
    });

    expect(committed).toMatchObject({ status: "draft", contentRevision: 4, savedRevision: null });
  });

  it("uses the expected daily revision as the final commit condition", async () => {
    addEventEntry({ id: "entry-1" });
    addEventEntry({ id: "entry-2" });
    const sourceSignature = await signatureForCurrentSavedSources();
    addDailyEntry({ sourceSignature, status: "draft", contentRevision: 1 });
    mockPrisma.journalDailyEntry.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      commitJournalDailyEntryDraft({
        userId,
        entryDate,
        expectedSourceSignature: sourceSignature,
        expectedContentRevision: 1,
        replaceManualEditsConfirmed: false,
        title: "当天小结",
        content: "晚到的生成结果不能覆盖更早已经提交的当天日志。"
      })
    ).rejects.toThrow("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
  });

  it("keeps stale or single-source daily journals read-only", async () => {
    addEventEntry({ id: "entry-1" });
    addEventEntry({ id: "entry-2" });
    const sourceSignature = await signatureForCurrentSavedSources();
    const daily = addDailyEntry({ sourceSignature, status: "saved", contentRevision: 1, savedRevision: 1 });

    state.eventEntries.find((entry) => entry.id === "entry-2")!.contentRevision = 2;
    state.eventEntries.find((entry) => entry.id === "entry-2")!.savedRevision = 2;
    await expect(
      updateJournalDailyEntry({
        userId,
        entryId: daily.id,
        expectedContentRevision: 1,
        title: "过期日志",
        content: "来源已经变化时应先更新当天完整日志。"
      })
    ).rejects.toThrow("JOURNAL_DAILY_SOURCE_CHANGED");

    state.eventEntries.find((entry) => entry.id === "entry-2")!.status = "modified";
    await expect(
      updateJournalDailyEntry({
        userId,
        entryId: daily.id,
        expectedContentRevision: 1,
        title: "单篇来源",
        content: "只剩一篇已保存事件时当天完整日志只保留阅读。"
      })
    ).rejects.toThrow("JOURNAL_DAILY_ENTRY_READ_ONLY");
  });

  it("rechecks sources while saving and protects update/save with optimistic versions", async () => {
    addEventEntry({ id: "entry-1" });
    addEventEntry({ id: "entry-2" });
    const sourceSignature = await signatureForCurrentSavedSources();
    const daily = addDailyEntry({ sourceSignature, status: "draft", contentRevision: 1 });

    await expect(
      updateJournalDailyEntry({
        userId,
        entryId: daily.id,
        expectedContentRevision: 2,
        title: "晚到的编辑",
        content: "这个编辑基于过期版本。"
      })
    ).rejects.toThrow("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");

    const edited = await updateJournalDailyEntry({
      userId,
      entryId: daily.id,
      expectedContentRevision: 1,
      title: "更新后的当天小结",
      content: "这份当天完整日志已经补充了用户的编辑。"
    });
    expect(edited).toMatchObject({ status: "draft", contentRevision: 2 });

    await expect(
      saveJournalDailyEntry({ userId, entryId: daily.id, expectedContentRevision: 1 })
    ).rejects.toThrow("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");

    state.eventEntries.find((entry) => entry.id === "entry-2")!.contentRevision = 2;
    state.eventEntries.find((entry) => entry.id === "entry-2")!.savedRevision = 2;

    await expect(
      saveJournalDailyEntry({ userId, entryId: daily.id, expectedContentRevision: 2 })
    ).rejects.toThrow("JOURNAL_DAILY_SOURCE_CHANGED");

    daily.sourceSignature = await signatureForCurrentSavedSources();
    const saved = await saveJournalDailyEntry({ userId, entryId: daily.id, expectedContentRevision: 2 });

    expect(saved).toMatchObject({ status: "saved", contentRevision: 2, savedRevision: 2 });
  });
});
