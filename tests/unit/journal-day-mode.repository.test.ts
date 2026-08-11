/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, state } = vi.hoisted(() => {
  const now = () => new Date("2026-07-22T10:00:00.000Z");
  const state = {
    ownerships: [] as any[],
    nextId: 1
  };

  const mockPrisma: Record<string, any> = {
    $transaction: vi.fn(async (operation: any) => operation(mockPrisma))
  };

  mockPrisma.journalDayOwnership = {
    findUnique: vi.fn(async ({ where }: any) => {
      const key = where.userId_entryDate;
      return state.ownerships.find(
        (ownership) =>
          ownership.userId === key.userId &&
          ownership.entryDate.getTime() === key.entryDate.getTime()
      ) ?? null;
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const ownership = state.ownerships.find((candidate) => candidate.id === where.id);
      if (!ownership) throw new Error("ownership missing");
      Object.assign(ownership, data, { updatedAt: now() });
      return ownership;
    }),
    createMany: vi.fn(async ({ data }: any) => {
      const candidate = data[0];
      const duplicate = state.ownerships.find(
        (ownership) =>
          ownership.userId === candidate.userId &&
          ownership.entryDate.getTime() === candidate.entryDate.getTime()
      );
      if (duplicate) {
        return { count: 0 };
      }
      state.ownerships.push({
        ...candidate,
        mixedAt: null,
        mixedReason: null
      });
      return { count: 1 };
    })
  };

  return { mockPrisma, state };
});

vi.mock("@/server/db/prisma", () => ({ prisma: mockPrisma }));

import {
  assertJournalDayModeInTransaction,
  claimJournalDayModeInTransaction,
  resolveJournalDayModeInTransaction
} from "@/server/repositories/journal-day-mode.repository";

const userId = "user-1";
const entryDate = "2026-07-22";
const entryDateValue = new Date("2026-07-21T16:00:00.000Z");
const transactionDatabase = mockPrisma as any;

function addOwnership(overrides: Record<string, unknown> = {}) {
  const ownership = {
    id: `ownership-${state.nextId++}`,
    userId,
    entryDate: entryDateValue,
    primaryMode: "dimension_legacy",
    status: "clean",
    claimedAt: new Date("2026-07-22T01:00:00.000Z"),
    claimedBySessionId: "session-legacy",
    lastAssertedAt: new Date("2026-07-22T01:00:00.000Z"),
    mixedAt: null,
    mixedReason: null,
    createdAt: new Date("2026-07-22T01:00:00.000Z"),
    updatedAt: new Date("2026-07-22T01:00:00.000Z"),
    ...overrides
  };
  state.ownerships.push(ownership);
  return ownership;
}

describe("journal day mode repository", () => {
  beforeEach(() => {
    state.ownerships.splice(0);
    state.nextId = 1;
    vi.clearAllMocks();
  });

  it("claims an unclaimed day for the first reliable event-centered expression", async () => {
    const result = await claimJournalDayModeInTransaction(transactionDatabase, {
      userId,
      entryDate,
      mode: "event_centered",
      claimedBySessionId: "event-root-session",
      now: new Date("2026-07-22T02:00:00.000Z")
    });

    expect(result).toMatchObject({
      kind: "claimed",
      ownership: {
        userId,
        entryDate,
        primaryMode: "event_centered",
        status: "clean",
        claimedBySessionId: "event-root-session",
        claimedAt: "2026-07-22T02:00:00.000Z"
      }
    });
    expect(state.ownerships).toHaveLength(1);
  });

  it("reuses the clean owner for the same mode and records the latest successful assertion", async () => {
    const ownership = addOwnership({
      primaryMode: "event_centered",
      claimedBySessionId: "first-event-root"
    });
    const assertionAt = new Date("2026-07-22T03:00:00.000Z");

    const result = await claimJournalDayModeInTransaction(transactionDatabase, {
      userId,
      entryDate,
      mode: "event_centered",
      claimedBySessionId: "later-event-root",
      now: assertionAt
    });

    expect(result).toMatchObject({ kind: "existing", ownership: { id: ownership.id } });
    expect(ownership.claimedBySessionId).toBe("first-event-root");
    expect(ownership.lastAssertedAt).toEqual(assertionAt);
  });

  it("returns a clear conflict without changing an existing clean owner", async () => {
    const ownership = addOwnership({ primaryMode: "dimension_legacy" });

    const result = await claimJournalDayModeInTransaction(transactionDatabase, {
      userId,
      entryDate,
      mode: "event_centered"
    });

    expect(result).toMatchObject({
      kind: "conflict",
      code: "JOURNAL_DAY_MODE_CONFLICT",
      ownership: { id: ownership.id, primaryMode: "dimension_legacy" }
    });
    expect(mockPrisma.journalDayOwnership.update).not.toHaveBeenCalled();
    expect(state.ownerships).toHaveLength(1);
  });

  it("uses the unique date key to converge two same-mode claims to one owner", async () => {
    const [first, second] = await Promise.all([
      claimJournalDayModeInTransaction(transactionDatabase, {
        userId,
        entryDate,
        mode: "event_centered"
      }),
      claimJournalDayModeInTransaction(transactionDatabase, {
        userId,
        entryDate,
        mode: "event_centered"
      })
    ]);

    expect([first.kind, second.kind].sort()).toEqual(["claimed", "existing"]);
    expect(state.ownerships).toHaveLength(1);
    expect(state.ownerships[0]).toMatchObject({ primaryMode: "event_centered", status: "clean" });
  });

  it("treats migration-detected mixed days as a read-only route", async () => {
    const ownership = addOwnership({
      status: "mixed",
      mixedAt: new Date("2026-07-22T01:30:00.000Z"),
      mixedReason: "migration_detected_both_modes"
    });

    await expect(resolveJournalDayModeInTransaction(transactionDatabase, { userId, entryDate }))
      .resolves.toMatchObject({
        kind: "mixed",
        code: "JOURNAL_DAY_MODE_MIXED",
        ownership: { id: ownership.id }
      });
    await expect(
      claimJournalDayModeInTransaction(transactionDatabase, { userId, entryDate, mode: "event_centered" })
    ).resolves.toMatchObject({ kind: "mixed", code: "JOURNAL_DAY_MODE_MIXED" });
    await expect(
      assertJournalDayModeInTransaction(transactionDatabase, { userId, entryDate, mode: "dimension_legacy" })
    ).rejects.toThrow("JOURNAL_DAY_MODE_MIXED");
    expect(mockPrisma.journalDayOwnership.update).not.toHaveBeenCalled();
  });

  it("requires a claimed day and the matching mode before later writes continue", async () => {
    await expect(
      assertJournalDayModeInTransaction(transactionDatabase, { userId, entryDate, mode: "event_centered" })
    ).rejects.toThrow("JOURNAL_DAY_MODE_UNCLAIMED");

    addOwnership({ primaryMode: "dimension_legacy" });
    await expect(
      assertJournalDayModeInTransaction(transactionDatabase, { userId, entryDate, mode: "event_centered" })
    ).rejects.toThrow("JOURNAL_DAY_MODE_CONFLICT");
  });
});
