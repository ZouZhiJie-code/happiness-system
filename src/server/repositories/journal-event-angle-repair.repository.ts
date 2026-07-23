import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { JOURNAL_EVENT_ANGLES, type JournalEventAngle } from "@/types/journal-event-angle-outcome";

type DatabaseClient = Prisma.TransactionClient;

type StoredOutcome = {
  id: string;
  assistantMessageId: string;
  angle: JournalEventAngle;
  createdAt: Date;
  facts: Array<{ factId: string; role: "support" | "context" }>;
};

export interface EnqueueJournalEventAngleRepairsInput {
  eventId: string;
  activeBranchSessionId: string;
  factRevisionId: string;
  pathAnchorMessageId: string;
  effectiveMessageIds: string[];
  effectiveFactIdsBefore: string[];
  invalidatedFactIds: string[];
}

export interface EnqueueJournalEventAngleRepairsResult {
  repairIds: string[];
  affectedOutcomeIds: string[];
  repairPendingAngles: JournalEventAngle[];
}

function compareOutcomes(
  left: StoredOutcome,
  right: StoredOutcome,
  messageOrder: Map<string, number>
) {
  return (
    (messageOrder.get(left.assistantMessageId) ?? -1) -
      (messageOrder.get(right.assistantMessageId) ?? -1) ||
    left.createdAt.getTime() - right.createdAt.getTime() ||
    left.id.localeCompare(right.id)
  );
}

export async function enqueueJournalEventAngleRepairsWithClient(
  database: DatabaseClient,
  input: EnqueueJournalEventAngleRepairsInput
): Promise<EnqueueJournalEventAngleRepairsResult> {
  if (input.invalidatedFactIds.length === 0) {
    return { repairIds: [], affectedOutcomeIds: [], repairPendingAngles: [] };
  }
  const messageOrder = new Map(
    input.effectiveMessageIds.map((messageId, index) => [messageId, index])
  );
  const effectiveBefore = new Set(input.effectiveFactIdsBefore);
  const invalidated = new Set(input.invalidatedFactIds);
  const outcomes = (await database.journalEventAngleOutcome.findMany({
    where: {
      eventId: input.eventId,
      assistantMessageId: { in: input.effectiveMessageIds }
    },
    include: { facts: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  })) as StoredOutcome[];

  const latestByAngle = new Map<JournalEventAngle, StoredOutcome>();
  for (const outcome of outcomes) {
    const current = latestByAngle.get(outcome.angle);
    if (!current || compareOutcomes(current, outcome, messageOrder) < 0) {
      latestByAngle.set(outcome.angle, outcome);
    }
  }

  const latestAffectedByAngle = new Map<JournalEventAngle, StoredOutcome>();
  for (const outcome of latestByAngle.values()) {
    const supports = outcome.facts.filter((dependency) => dependency.role === "support");
    if (
      supports.length === 0 ||
      outcome.facts.some((dependency) => !effectiveBefore.has(dependency.factId)) ||
      !outcome.facts.some((dependency) => invalidated.has(dependency.factId))
    ) {
      continue;
    }
    latestAffectedByAngle.set(outcome.angle, outcome);
  }

  const rows = [...latestAffectedByAngle.values()].map((outcome) => ({
    id: randomUUID(),
    eventId: input.eventId,
    branchSessionId: input.activeBranchSessionId,
    factRevisionId: input.factRevisionId,
    pathAnchorMessageId: input.pathAnchorMessageId,
    priorOutcomeId: outcome.id,
    angle: outcome.angle
  }));
  if (rows.length > 0) {
    await database.journalEventAngleOutcomeRepair.createMany({
      data: rows,
      skipDuplicates: true
    });
  }
  return {
    repairIds: rows.map((row) => row.id),
    affectedOutcomeIds: rows.map((row) => row.priorOutcomeId),
    repairPendingAngles: JOURNAL_EVENT_ANGLES.filter((angle) =>
      latestAffectedByAngle.has(angle)
    )
  };
}
