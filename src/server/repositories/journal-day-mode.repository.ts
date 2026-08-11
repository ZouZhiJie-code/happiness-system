import { Prisma, type InterviewSessionMode } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { formatEntryDate, parseEntryDateInput } from "@/features/interview/entry-date";
import { prisma } from "@/server/db/prisma";

type JournalDayModeDatabase = Pick<
  Prisma.TransactionClient,
  "journalDayOwnership"
>;

export type JournalDayMode = Extract<
  InterviewSessionMode,
  "dimension_legacy" | "event_centered"
>;

export type JournalDayModeRecord = {
  id: string;
  userId: string;
  entryDate: string;
  primaryMode: JournalDayMode;
  status: "clean" | "mixed";
  claimedAt: string;
  claimedBySessionId: string | null;
  lastAssertedAt: string;
  mixedAt: string | null;
  mixedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResolvedJournalDayMode =
  | { kind: "unclaimed"; entryDate: string }
  | { kind: "clean"; ownership: JournalDayModeRecord }
  | { kind: "mixed"; ownership: JournalDayModeRecord; code: "JOURNAL_DAY_MODE_MIXED" };

export type ClaimedJournalDayMode =
  | { kind: "claimed"; ownership: JournalDayModeRecord }
  | { kind: "existing"; ownership: JournalDayModeRecord }
  | {
      kind: "conflict";
      ownership: JournalDayModeRecord;
      code: "JOURNAL_DAY_MODE_CONFLICT";
    }
  | {
      kind: "mixed";
      ownership: JournalDayModeRecord;
      code: "JOURNAL_DAY_MODE_MIXED";
    };

export type ClaimJournalDayModeInput = {
  userId: string;
  entryDate: string;
  mode: JournalDayMode;
  claimedBySessionId?: string | null;
  now?: Date;
};

export type AssertJournalDayModeInput = {
  userId: string;
  entryDate: string;
  mode: JournalDayMode;
  now?: Date;
};

type StoredJournalDayOwnership = Prisma.JournalDayOwnershipGetPayload<Record<never, never>>;

function mapJournalDayMode(ownership: StoredJournalDayOwnership): JournalDayModeRecord {
  return {
    id: ownership.id,
    userId: ownership.userId,
    entryDate: formatEntryDate(ownership.entryDate),
    primaryMode: ownership.primaryMode,
    status: ownership.status,
    claimedAt: ownership.claimedAt.toISOString(),
    claimedBySessionId: ownership.claimedBySessionId,
    lastAssertedAt: ownership.lastAssertedAt.toISOString(),
    mixedAt: ownership.mixedAt?.toISOString() ?? null,
    mixedReason: ownership.mixedReason,
    createdAt: ownership.createdAt.toISOString(),
    updatedAt: ownership.updatedAt.toISOString()
  };
}

async function findJournalDayOwnership(
  database: JournalDayModeDatabase,
  userId: string,
  entryDate: Date
) {
  return database.journalDayOwnership.findUnique({
    where: {
      userId_entryDate: {
        userId,
        entryDate
      }
    }
  });
}

function toResolvedMode(
  ownership: StoredJournalDayOwnership | null,
  entryDate: string
): ResolvedJournalDayMode {
  if (!ownership) {
    return { kind: "unclaimed", entryDate };
  }

  const mapped = mapJournalDayMode(ownership);
  if (mapped.status === "mixed") {
    return { kind: "mixed", ownership: mapped, code: "JOURNAL_DAY_MODE_MIXED" };
  }

  return { kind: "clean", ownership: mapped };
}

function toClaimedMode(
  ownership: StoredJournalDayOwnership,
  requestedMode: JournalDayMode,
  created: boolean
): ClaimedJournalDayMode {
  const mapped = mapJournalDayMode(ownership);

  if (mapped.status === "mixed") {
    return { kind: "mixed", ownership: mapped, code: "JOURNAL_DAY_MODE_MIXED" };
  }

  if (mapped.primaryMode !== requestedMode) {
    return { kind: "conflict", ownership: mapped, code: "JOURNAL_DAY_MODE_CONFLICT" };
  }

  return created
    ? { kind: "claimed", ownership: mapped }
    : { kind: "existing", ownership: mapped };
}

/**
 * Resolves the data route for a date without changing it. `mixed` is deliberately
 * returned as read-only so calendar and history code can avoid combining sources.
 */
export async function resolveJournalDayModeInTransaction(
  database: JournalDayModeDatabase,
  input: Pick<ClaimJournalDayModeInput, "userId" | "entryDate">
): Promise<ResolvedJournalDayMode> {
  const entryDate = parseEntryDateInput(input.entryDate);
  const ownership = await findJournalDayOwnership(database, input.userId, entryDate);
  return toResolvedMode(ownership, input.entryDate);
}

export async function resolveJournalDayMode(userId: string, entryDate: string) {
  return resolveJournalDayModeInTransaction(prisma, { userId, entryDate });
}

/**
 * Claims a date only from the transaction that has already persisted the first
 * reliable expression. The unique user/date constraint is the race arbiter.
 */
export async function claimJournalDayModeInTransaction(
  database: JournalDayModeDatabase,
  input: ClaimJournalDayModeInput
): Promise<ClaimedJournalDayMode> {
  const entryDate = parseEntryDateInput(input.entryDate);
  const now = input.now ?? new Date();
  const existing = await findJournalDayOwnership(database, input.userId, entryDate);

  if (existing) {
    const result = toClaimedMode(existing, input.mode, false);
    if (result.kind === "existing") {
      const updated = await database.journalDayOwnership.update({
        where: { id: existing.id },
        data: { lastAssertedAt: now }
      });
      return toClaimedMode(updated, input.mode, false);
    }

    return result;
  }

  const inserted = await database.journalDayOwnership.createMany({
    data: [{
      id: randomUUID(),
      userId: input.userId,
      entryDate,
      primaryMode: input.mode,
      status: "clean",
      claimedAt: now,
      claimedBySessionId: input.claimedBySessionId ?? null,
      lastAssertedAt: now,
      createdAt: now,
      updatedAt: now
    }],
    skipDuplicates: true
  });
  const claimedOwnership = await findJournalDayOwnership(database, input.userId, entryDate);
  if (!claimedOwnership) {
    throw new Error("JOURNAL_DAY_MODE_CLAIM_FAILED");
  }

  return toClaimedMode(claimedOwnership, input.mode, inserted.count === 1);
}

export async function claimJournalDayMode(input: ClaimJournalDayModeInput) {
  return prisma.$transaction((database) => claimJournalDayModeInTransaction(database, input));
}

/**
 * Ensures an already-claimed clean date still belongs to the caller's product
 * route. Callers use it before every write after the first reliable expression.
 */
export async function assertJournalDayModeInTransaction(
  database: JournalDayModeDatabase,
  input: AssertJournalDayModeInput
): Promise<JournalDayModeRecord> {
  const resolved = await resolveJournalDayModeInTransaction(database, input);
  if (resolved.kind === "unclaimed") {
    throw new Error("JOURNAL_DAY_MODE_UNCLAIMED");
  }
  if (resolved.kind === "mixed") {
    throw new Error(resolved.code);
  }
  if (resolved.ownership.primaryMode !== input.mode) {
    throw new Error("JOURNAL_DAY_MODE_CONFLICT");
  }

  const updated = await database.journalDayOwnership.update({
    where: { id: resolved.ownership.id },
    data: { lastAssertedAt: input.now ?? new Date() }
  });
  return mapJournalDayMode(updated);
}

export async function assertJournalDayMode(input: AssertJournalDayModeInput) {
  return prisma.$transaction((database) => assertJournalDayModeInTransaction(database, input));
}
