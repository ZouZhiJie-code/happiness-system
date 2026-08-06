import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@/server/db/prisma";
import {
  getEffectiveJournalEventFactProjectionForPathWithClient,
  getEffectiveJournalEventFactProjectionWithClient,
  getEventCenteredRouteWithClient,
  type EventCenteredDatabaseClient
} from "@/server/repositories/journal-event-fact-revision.repository";
import {
  JOURNAL_EVENT_ANGLES,
  type JournalEventAngle,
  type JournalEventAngleOutcomeDraft,
  type JournalEventAngleOutcomeRecord,
  type JournalEventAngleProjection,
  type JournalEventAngleRepairResolutionInput
} from "@/types/journal-event-angle-outcome";
import type { JournalEventFactProjection } from "@/types/journal-event-understanding";

type DatabaseClient = EventCenteredDatabaseClient;

type StoredOutcome = {
  id: string;
  eventId: string;
  branchSessionId: string;
  sourceTurnId: string;
  assistantMessageId: string;
  generationTraceId: string | null;
  angle: JournalEventAngle;
  kind: "insight" | "honest_limit";
  statement: string;
  createdAt: Date;
  facts: Array<{
    id: string;
    factId: string;
    role: "support" | "context";
    createdAt: Date;
  }>;
};

type StoredRepair = {
  id: string;
  eventId: string;
  branchSessionId: string;
  factRevisionId: string;
  pathAnchorMessageId: string;
  priorOutcomeId: string;
  angle: JournalEventAngle;
  createdAt: Date;
  resolutions: StoredRepairResolution[];
};

type StoredRepairResolution = {
  id: string;
  repairId: string;
  branchSessionId: string;
  resolvedMessageId: string;
  resolutionTraceId: string | null;
  decision: "replaced" | "reopened";
  replacementOutcomeId: string | null;
  resolutionFingerprint: string;
  resolvedAt: Date;
  createdAt: Date;
};

export interface CommitJournalEventAngleResultsInput {
  userId: string;
  eventId: string;
  activeBranchSessionId: string;
  sourceTurnId: string;
  assistantMessageId: string;
  generationTraceId: string;
  createdFactIdsByWriteIndex: string[];
  angleOutcome?: JournalEventAngleOutcomeDraft | null;
  angleRepairResolutions?: JournalEventAngleRepairResolutionInput[];
}

export interface CommitJournalEventAngleResultsResult {
  angleOutcomeIds: string[];
  reopenedAngles: JournalEventAngle[];
  resolutionFingerprint: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function mapOutcome(outcome: StoredOutcome): JournalEventAngleOutcomeRecord {
  return {
    id: outcome.id,
    eventId: outcome.eventId,
    branchSessionId: outcome.branchSessionId,
    sourceTurnId: outcome.sourceTurnId,
    assistantMessageId: outcome.assistantMessageId,
    generationTraceId: outcome.generationTraceId,
    angle: outcome.angle,
    kind: outcome.kind,
    statement: outcome.statement,
    createdAt: outcome.createdAt.toISOString(),
    facts: outcome.facts.map((dependency) => ({
      id: dependency.id,
      factId: dependency.factId,
      role: dependency.role,
      createdAt: dependency.createdAt.toISOString()
    }))
  };
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

function latestPathResolution(
  repair: StoredRepair,
  messageOrder: Map<string, number>
) {
  return [...repair.resolutions].sort(
    (left, right) =>
      (messageOrder.get(right.resolvedMessageId) ?? -1) -
        (messageOrder.get(left.resolvedMessageId) ?? -1) ||
      right.createdAt.getTime() - left.createdAt.getTime() ||
      right.id.localeCompare(left.id)
  )[0] ?? null;
}

type JournalEventAngleProjectionSource = {
  outcomes: StoredOutcome[];
  repairs: StoredRepair[];
};

async function loadJournalEventAngleProjectionSource(
  database: DatabaseClient,
  eventId: string,
  messageIds: string[]
): Promise<JournalEventAngleProjectionSource> {
  const [outcomes, repairs] = await Promise.all([
    database.journalEventAngleOutcome.findMany({
      where: { eventId, assistantMessageId: { in: messageIds } },
      include: { facts: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    }) as Promise<StoredOutcome[]>,
    database.journalEventAngleOutcomeRepair.findMany({
      where: { eventId, pathAnchorMessageId: { in: messageIds } },
      include: {
        resolutions: {
          where: { resolvedMessageId: { in: messageIds } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }]
        }
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    }) as Promise<StoredRepair[]>
  ]);
  return { outcomes, repairs };
}

function projectJournalEventAngleProjection(input: {
  messageIds: string[];
  factProjection: JournalEventFactProjection;
  source: JournalEventAngleProjectionSource;
}): JournalEventAngleProjection {
  const { factProjection, messageIds } = input;
  const { outcomes, repairs } = input.source;
  const messageOrder = new Map(messageIds.map((messageId, index) => [messageId, index]));

  const effectiveFactIds = new Set(factProjection.effectiveFactIds);
  const deprioritizedFactIds = new Set(factProjection.deprioritizedFactIds);
  const invalidatedOutcomeIds: string[] = [];
  const deprioritizedOutcomeIds: string[] = [];
  const latestVersionByAngle = new Map<JournalEventAngle, StoredOutcome>();

  for (const outcome of outcomes) {
    const current = latestVersionByAngle.get(outcome.angle);
    if (!current || compareOutcomes(current, outcome, messageOrder) < 0) {
      latestVersionByAngle.set(outcome.angle, outcome);
    }
  }

  for (const outcome of outcomes) {
    const supports = outcome.facts.filter((dependency) => dependency.role === "support");
    if (
      supports.length === 0 ||
      outcome.facts.some((dependency) => !effectiveFactIds.has(dependency.factId))
    ) {
      invalidatedOutcomeIds.push(outcome.id);
      continue;
    }
    if (supports.some((dependency) => deprioritizedFactIds.has(dependency.factId))) {
      deprioritizedOutcomeIds.push(outcome.id);
    }
  }

  const latestByAngle = new Map<JournalEventAngle, StoredOutcome>();
  const invalidatedOutcomeSet = new Set(invalidatedOutcomeIds);
  for (const [angle, outcome] of latestVersionByAngle) {
    if (!invalidatedOutcomeSet.has(outcome.id)) {
      latestByAngle.set(angle, outcome);
    }
  }

  const resolutionsByRepairId = new Map(
    repairs.map((repair) => [repair.id, latestPathResolution(repair, messageOrder)])
  );
  const pendingAngles = new Set(
    repairs
      .filter((repair) => !resolutionsByRepairId.get(repair.id))
      .map((repair) => repair.angle)
  );
  const reopenedAngles = new Set<JournalEventAngle>();
  for (const repair of repairs) {
    const resolution = resolutionsByRepairId.get(repair.id);
    if (!resolution || resolution.decision !== "reopened") continue;
    const resolutionIndex = messageOrder.get(resolution.resolvedMessageId) ?? -1;
    const currentOutcome = latestByAngle.get(repair.angle);
    const laterOutcome =
      currentOutcome &&
      (messageOrder.get(currentOutcome.assistantMessageId) ?? -1) > resolutionIndex;
    if (!laterOutcome && !pendingAngles.has(repair.angle)) {
      reopenedAngles.add(repair.angle);
      if (currentOutcome?.id === repair.priorOutcomeId) {
        latestByAngle.delete(repair.angle);
      }
    }
  }

  const outcomesByAngle: JournalEventAngleProjection["outcomesByAngle"] = {};
  for (const [angle, outcome] of latestByAngle) outcomesByAngle[angle] = mapOutcome(outcome);
  const completedAngles = JOURNAL_EVENT_ANGLES.filter((angle) => latestByAngle.has(angle));
  const availableAngles = JOURNAL_EVENT_ANGLES.filter(
    (angle) => !latestByAngle.has(angle) && !pendingAngles.has(angle)
  );
  const deprioritizedOutcomeSet = new Set(deprioritizedOutcomeIds);

  return {
    outcomesByAngle,
    completedAngles,
    availableAngles,
    invalidatedOutcomeIds,
    deprioritizedOutcomeIds,
    logEligibleOutcomeIds: [...latestByAngle.values()]
      .filter(
        (outcome) =>
          outcome.kind === "insight" && !deprioritizedOutcomeSet.has(outcome.id)
      )
      .map((outcome) => outcome.id),
    repairPendingAngles: JOURNAL_EVENT_ANGLES.filter((angle) => pendingAngles.has(angle)),
    reopenedAngles: JOURNAL_EVENT_ANGLES.filter((angle) => reopenedAngles.has(angle)),
    repairs: repairs.map((repair) => {
      const resolution = resolutionsByRepairId.get(repair.id);
      return {
        id: repair.id,
        eventId: repair.eventId,
        branchSessionId: repair.branchSessionId,
        factRevisionId: repair.factRevisionId,
        pathAnchorMessageId: repair.pathAnchorMessageId,
        priorOutcomeId: repair.priorOutcomeId,
        angle: repair.angle,
        status: resolution?.decision ?? "pending",
        resolutionId: resolution?.id ?? null,
        replacementOutcomeId: resolution?.replacementOutcomeId ?? null,
        resolvedMessageId: resolution?.resolvedMessageId ?? null,
        resolutionTraceId: resolution?.resolutionTraceId ?? null,
        resolvedAt: resolution?.resolvedAt.toISOString() ?? null,
        createdAt: repair.createdAt.toISOString()
      };
    })
  };
}

export async function getEffectiveJournalEventAngleProjectionForPathWithClient(
  database: DatabaseClient,
  input: {
    eventId: string;
    messageIds: string[];
    factProjection: JournalEventFactProjection;
  }
): Promise<JournalEventAngleProjection> {
  const messageIds = [...new Set(input.messageIds)];
  const source = await loadJournalEventAngleProjectionSource(
    database,
    input.eventId,
    messageIds
  );
  return projectJournalEventAngleProjection({
    messageIds,
    factProjection: input.factProjection,
    source
  });
}

export async function getEffectiveJournalEventAngleProjectionForPath(input: {
  eventId: string;
  messageIds: string[];
  factProjection: JournalEventFactProjection;
}): Promise<JournalEventAngleProjection> {
  return getEffectiveJournalEventAngleProjectionForPathWithClient(prisma, input);
}

/**
 * Workspace 已经持有有效路径和状态快照时，事实与角度成果可并发读取。
 * 这样能避免为同一屏恢复再次解析分支路径，并保持读模型来源一致。
 */
export async function getEffectiveJournalEventWorkspaceProjectionsForPath(input: {
  eventId: string;
  messageIds: string[];
  snapshotData: unknown;
}): Promise<{
  factProjection: JournalEventFactProjection;
  angleProjection: JournalEventAngleProjection;
}> {
  const messageIds = [...new Set(input.messageIds)];
  const [factProjection, source] = await Promise.all([
    getEffectiveJournalEventFactProjectionForPathWithClient(prisma, {
      eventId: input.eventId,
      messageIds,
      snapshotData: input.snapshotData
    }),
    loadJournalEventAngleProjectionSource(prisma, input.eventId, messageIds)
  ]);
  return {
    factProjection,
    angleProjection: projectJournalEventAngleProjection({
      messageIds,
      factProjection,
      source
    })
  };
}

export async function getEffectiveJournalEventAngleProjectionWithClient(
  database: DatabaseClient,
  eventId: string,
  activeBranchSessionId: string
): Promise<JournalEventAngleProjection> {
  const [route, factProjection] = await Promise.all([
    getEventCenteredRouteWithClient(database, {
      eventId,
      activeBranchSessionId,
      requireWritable: false
    }),
    getEffectiveJournalEventFactProjectionWithClient(
      database,
      eventId,
      activeBranchSessionId
    )
  ]);
  return getEffectiveJournalEventAngleProjectionForPathWithClient(database, {
    eventId,
    messageIds: route.path.messages.map((message) => message.id),
    factProjection
  });
}

export async function getEffectiveJournalEventAngleProjection(
  eventId: string,
  activeBranchSessionId: string
): Promise<JournalEventAngleProjection> {
  return getEffectiveJournalEventAngleProjectionWithClient(
    prisma,
    eventId,
    activeBranchSessionId
  );
}

function resolveDependencies(
  draft: JournalEventAngleOutcomeDraft,
  createdFactIdsByWriteIndex: string[]
) {
  const dependencies = draft.dependencies.map((dependency) => {
    if ("factId" in dependency && dependency.factId) {
      return { factId: dependency.factId, role: dependency.role };
    }
    const factWriteIndex =
      "factWriteIndex" in dependency ? dependency.factWriteIndex : undefined;
    if (
      typeof factWriteIndex !== "number" ||
      !Number.isInteger(factWriteIndex) ||
      factWriteIndex < 0 ||
      !createdFactIdsByWriteIndex[factWriteIndex]
    ) {
      throw new Error("EVENT_ANGLE_OUTCOME_DEPENDENCY_INVALID");
    }
    return {
      factId: createdFactIdsByWriteIndex[factWriteIndex],
      role: dependency.role
    };
  });
  if (
    dependencies.length === 0 ||
    new Set(dependencies.map((dependency) => dependency.factId)).size !== dependencies.length
  ) {
    throw new Error("EVENT_ANGLE_OUTCOME_DEPENDENCY_INVALID");
  }
  return dependencies.sort((left, right) =>
    `${left.factId}:${left.role}`.localeCompare(`${right.factId}:${right.role}`)
  );
}

function assertOutcomeDraft(
  draft: JournalEventAngleOutcomeDraft,
  dependencies: ReturnType<typeof resolveDependencies>,
  factProjection: Awaited<
    ReturnType<typeof getEffectiveJournalEventFactProjectionWithClient>
  >
) {
  if (!draft.statement.trim()) throw new Error("EVENT_ANGLE_OUTCOME_INVALID");
  const factsById = new Map(factProjection.facts.map((fact) => [fact.id, fact]));
  const effectiveFactIds = new Set(factProjection.effectiveFactIds);
  const explorationFactIds = new Set(factProjection.explorationFactIds);
  const supports = dependencies.filter((dependency) => dependency.role === "support");
  if (
    supports.length === 0 ||
    dependencies.some((dependency) => !effectiveFactIds.has(dependency.factId)) ||
    supports.some((dependency) => {
      const fact = factsById.get(dependency.factId);
      return !fact || fact.scope !== "current_event" || !explorationFactIds.has(fact.id);
    })
  ) {
    throw new Error("EVENT_ANGLE_OUTCOME_DEPENDENCY_INVALID");
  }
}

function outcomeFingerprint(input: {
  eventId: string;
  sourceTurnId: string;
  angle: JournalEventAngle;
  kind: "insight" | "honest_limit";
  statement: string;
  dependencies: Array<{ factId: string; role: "support" | "context" }>;
  repairId: string | null;
}) {
  return stableHash({ ...input, statement: input.statement.trim() });
}

export async function commitJournalEventAngleResultsWithClient(
  database: DatabaseClient,
  input: CommitJournalEventAngleResultsInput
): Promise<CommitJournalEventAngleResultsResult> {
  const resolutions = input.angleRepairResolutions ?? [];
  if (
    (input.angleOutcome && resolutions.length > 0) ||
    new Set(resolutions.map((resolution) => resolution.repairId)).size !== resolutions.length
  ) {
    throw new Error("EVENT_ANGLE_OUTCOME_COMMIT_INVALID");
  }
  const route = await getEventCenteredRouteWithClient(database, {
    eventId: input.eventId,
    activeBranchSessionId: input.activeBranchSessionId,
    userId: input.userId
  });
  const pathMessageIds = route.path.messages.map((message) => message.id);
  const pathMessageIdSet = new Set(pathMessageIds);
  const [assistantMessage, sourceTurn, generationTrace] = await Promise.all([
    database.interviewMessage.findUnique({
      where: { id: input.assistantMessageId },
      select: {
        id: true,
        sessionId: true,
        userTurnId: true,
        generationTraceId: true,
        regeneratedFromMessageId: true,
        role: true
      }
    }),
    database.interviewUserTurn.findUnique({
      where: { id: input.sourceTurnId },
      select: {
        id: true,
        sessionId: true,
        journalEventId: true,
        status: true,
        action: true,
        targetMessageId: true,
        messages: { where: { role: "user" }, select: { id: true } }
      }
    }),
    database.aIGenerationTrace.findUnique({
      where: { id: input.generationTraceId },
      select: {
        id: true,
        userId: true,
        sessionId: true,
        journalEventId: true,
        status: true
      }
    })
  ]);
  const sourceTurnIsBound =
    sourceTurn?.action === "regenerate_question"
      ? Boolean(
          sourceTurn.targetMessageId &&
            assistantMessage?.regeneratedFromMessageId === sourceTurn.targetMessageId
        )
      : Boolean(sourceTurn?.messages.some((message) => pathMessageIdSet.has(message.id)));
  if (
    !pathMessageIdSet.has(input.assistantMessageId) ||
    !assistantMessage ||
    assistantMessage.sessionId !== input.activeBranchSessionId ||
    assistantMessage.userTurnId !== input.sourceTurnId ||
    assistantMessage.generationTraceId !== input.generationTraceId ||
    assistantMessage.role !== "assistant" ||
    !sourceTurn ||
    sourceTurn.journalEventId !== input.eventId ||
    sourceTurn.status !== "processing" ||
    !sourceTurnIsBound ||
    !generationTrace ||
    generationTrace.userId !== input.userId ||
    generationTrace.sessionId !== input.activeBranchSessionId ||
    generationTrace.journalEventId !== input.eventId ||
    generationTrace.status !== "completed"
  ) {
    throw new Error("EVENT_STATE_CHANGED");
  }
  const factProjection = await getEffectiveJournalEventFactProjectionWithClient(
    database,
    input.eventId,
    input.activeBranchSessionId
  );
  const [factRevision, pendingRepairs] = await Promise.all([
    database.journalEventFactRevision.findUnique({
      where: { sourceTurnId: input.sourceTurnId },
      select: { id: true, eventId: true, pathAnchorMessageId: true }
    }),
    database.journalEventAngleOutcomeRepair.findMany({
      where: {
        eventId: input.eventId,
        pathAnchorMessageId: { in: pathMessageIds },
        resolutions: {
          none: { resolvedMessageId: { in: pathMessageIds } }
        }
      },
      include: {
        priorOutcome: { select: { id: true, angle: true } }
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    })
  ]);
  if (
    factRevision &&
    (factRevision.eventId !== input.eventId ||
      !pathMessageIdSet.has(factRevision.pathAnchorMessageId))
  ) {
    throw new Error("EVENT_STATE_CHANGED");
  }
  if (
    pendingRepairs.some(
      (repair) =>
        repair.eventId !== input.eventId ||
        !pathMessageIdSet.has(repair.pathAnchorMessageId)
    )
  ) {
    throw new Error("EVENT_ANGLE_OUTCOME_REPAIR_INVALID");
  }
  const requestedRepairIds = new Set(resolutions.map((resolution) => resolution.repairId));
  const pendingRepairIds = new Set(pendingRepairs.map((repair) => repair.id));

  if (
    resolutions.length > 0 &&
    (requestedRepairIds.size !== pendingRepairIds.size ||
      [...requestedRepairIds].some((repairId) => !pendingRepairIds.has(repairId)))
  ) {
    throw new Error("EVENT_ANGLE_OUTCOME_REPAIR_SET_INVALID");
  }
  if (resolutions.length === 0 && pendingRepairs.length > 0) {
    throw new Error("EVENT_ANGLE_OUTCOME_REPAIR_REQUIRED");
  }
  if (factRevision && input.angleOutcome) {
    throw new Error("EVENT_CORRECTION_DERIVATION_NOT_ALLOWED");
  }

  const prepared: Array<{
    id: string;
    repairId: string | null;
    draft: JournalEventAngleOutcomeDraft;
    dependencies: Array<{ factId: string; role: "support" | "context" }>;
    requestFingerprint: string;
  }> = [];
  if (input.angleOutcome) {
    const dependencies = resolveDependencies(
      input.angleOutcome,
      input.createdFactIdsByWriteIndex
    );
    assertOutcomeDraft(input.angleOutcome, dependencies, factProjection);
    prepared.push({
      id: randomUUID(),
      repairId: null,
      draft: input.angleOutcome,
      dependencies,
      requestFingerprint: outcomeFingerprint({
        eventId: input.eventId,
        sourceTurnId: input.sourceTurnId,
        angle: input.angleOutcome.angle,
        kind: input.angleOutcome.kind,
        statement: input.angleOutcome.statement,
        dependencies,
        repairId: null
      })
    });
  }

  const repairsById = new Map(pendingRepairs.map((repair) => [repair.id, repair]));
  for (const resolution of resolutions) {
    const repair = repairsById.get(resolution.repairId);
    if (
      !repair ||
      repair.priorOutcome.id !== repair.priorOutcomeId ||
      repair.priorOutcome.angle !== repair.angle
    ) {
      throw new Error("EVENT_ANGLE_OUTCOME_REPAIR_INVALID");
    }
    if (resolution.decision === "replace") {
      const draft: JournalEventAngleOutcomeDraft = {
        ...resolution.outcome,
        angle: repair.angle
      };
      const dependencies = resolveDependencies(draft, input.createdFactIdsByWriteIndex);
      assertOutcomeDraft(draft, dependencies, factProjection);
      prepared.push({
        id: randomUUID(),
        repairId: repair.id,
        draft,
        dependencies,
        requestFingerprint: outcomeFingerprint({
          eventId: input.eventId,
          sourceTurnId: input.sourceTurnId,
          angle: draft.angle,
          kind: draft.kind,
          statement: draft.statement,
          dependencies,
          repairId: repair.id
        })
      });
    }
  }

  const resolutionFingerprint =
    resolutions.length > 0
      ? stableHash({
          eventId: input.eventId,
          sourceTurnId: input.sourceTurnId,
          assistantMessageId: input.assistantMessageId,
          generationTraceId: input.generationTraceId,
          resolutions: resolutions
            .map((resolution) => {
              const replacement = prepared.find(
                (item) => item.repairId === resolution.repairId
              );
              return {
                repairId: resolution.repairId,
                decision: resolution.decision,
                outcomeFingerprint: replacement?.requestFingerprint ?? null
              };
            })
            .sort((left, right) => left.repairId.localeCompare(right.repairId))
        })
      : null;

  for (const outcome of prepared) {
    await database.journalEventAngleOutcome.create({
      data: {
        id: outcome.id,
        eventId: input.eventId,
        branchSessionId: input.activeBranchSessionId,
        sourceTurnId: input.sourceTurnId,
        assistantMessageId: input.assistantMessageId,
        generationTraceId: input.generationTraceId,
        angle: outcome.draft.angle,
        kind: outcome.draft.kind,
        statement: outcome.draft.statement.trim(),
        requestFingerprint: outcome.requestFingerprint
      }
    });
    await database.journalEventAngleOutcomeFact.createMany({
      data: outcome.dependencies.map((dependency) => ({
        id: randomUUID(),
        outcomeId: outcome.id,
        factId: dependency.factId,
        role: dependency.role
      }))
    });
  }

  const reopenedAngles: JournalEventAngle[] = [];
  for (const resolution of resolutions) {
    const replacement = prepared.find((item) => item.repairId === resolution.repairId);
    const repair = repairsById.get(resolution.repairId)!;
    await database.journalEventAngleOutcomeRepairResolution.create({
      data: {
        id: randomUUID(),
        repairId: repair.id,
        branchSessionId: input.activeBranchSessionId,
        resolvedMessageId: input.assistantMessageId,
        resolutionTraceId: input.generationTraceId,
        decision: resolution.decision === "replace" ? "replaced" : "reopened",
        replacementOutcomeId: replacement?.id ?? null,
        resolutionFingerprint: resolutionFingerprint!
      }
    });
    if (resolution.decision === "reopen") reopenedAngles.push(repair.angle);
  }

  return {
    angleOutcomeIds: prepared.map((outcome) => outcome.id),
    reopenedAngles: JOURNAL_EVENT_ANGLES.filter((angle) => reopenedAngles.includes(angle)),
    resolutionFingerprint
  };
}

export function angleResultTraceDecision(
  result: CommitJournalEventAngleResultsResult,
  input: Pick<
    CommitJournalEventAngleResultsInput,
    "angleOutcome" | "angleRepairResolutions"
  >
) {
  if (result.angleOutcomeIds.length === 0 && result.reopenedAngles.length === 0) return null;
  return {
    kind: "journal_event_angle_outcome_commit",
    angleOutcomeIds: result.angleOutcomeIds,
    reopenedAngles: result.reopenedAngles,
    selectedAngle: input.angleOutcome?.angle ?? null,
    repairDecisions: (input.angleRepairResolutions ?? []).map((resolution) => ({
      repairId: resolution.repairId,
      decision: resolution.decision
    }))
  };
}

export function parseAngleOutcomeSnapshot(value: unknown) {
  if (!isRecord(value)) return null;
  const currentAngle = value.currentAngle;
  return JOURNAL_EVENT_ANGLES.includes(currentAngle as JournalEventAngle)
    ? (currentAngle as JournalEventAngle)
    : null;
}

export function isAngleOutcomeUniqueConflict(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
    (isRecord(error) && error.code === "P2002")
  );
}
