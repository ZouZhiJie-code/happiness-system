import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@/server/db/prisma";
import { enqueueJournalEventAngleRepairsWithClient } from "@/server/repositories/journal-event-angle-repair.repository";
import { JOURNAL_EVENT_ANGLES } from "@/types/journal-event-angle-outcome";
import type {
  ApplyJournalEventFactRevisionInput,
  ApplyJournalEventFactRevisionResult,
  EventCenteredForwardOperation,
  JournalEventFactEvidenceRecord,
  JournalEventFactProjection,
  JournalEventFactRecord,
  JournalEventFactRevisionRelation,
  JournalEventFactClarificationResolution,
  JournalEventPendingFactRevisionClarification,
  ResolvePendingJournalEventFactClarificationInput,
  SetPendingJournalEventFactClarificationInput
} from "@/types/journal-event-understanding";

export type EventCenteredDatabaseClient = Prisma.TransactionClient;
type DatabaseClient = EventCenteredDatabaseClient;

export type EventCenteredEffectiveMessage = {
  id: string;
  sessionId: string;
  userTurnId: string | null;
  role: "user" | "assistant" | "system";
  sequence: number;
  createdAt: Date;
};

export type EventCenteredRoute = {
  event: {
    id: string;
    userId: string;
    rootSessionId: string;
    status: "active" | "generating" | "completed" | "abandoned";
    rootSession: {
      id: string;
      mode: "dimension_legacy" | "event_centered";
      recordMode: "capture" | "chat";
      status: "active" | "paused" | "completed" | "abandoned";
      activeBranchSessionId: string | null;
    };
  };
  branch: {
    id: string;
    userId: string;
    mode: "dimension_legacy" | "event_centered";
    recordMode: "capture" | "chat";
    status: "active" | "paused" | "completed" | "abandoned";
    rootSessionId: string | null;
    activeEventId: string | null;
    stage: "collect_event" | "probe_reason" | "probe_pattern" | "wrap_up" | "finalize";
    turnCount: number;
    lastAssistantQuestion: string | null;
    draftSummary: string | null;
  };
  path: {
    rootSessionId: string;
    messages: EventCenteredEffectiveMessage[];
  };
};

const INVALIDATING_RELATIONS = new Set<JournalEventFactRevisionRelation>([
  "supersede",
  "negate",
  "withdraw"
]);
const BLOCKED_FORWARD_OPERATIONS = new Set<EventCenteredForwardOperation>([
  "select_exploration_angle",
  "continue_exploration",
  "generate_event_journal"
]);

function isUniqueConflict(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002")
  );
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertNonEmpty(value: string, code: string) {
  if (!value.trim()) throw new Error(code);
}

function snapshotObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return isRecord(value) ? { ...value } : {};
}

function revisionRequestFingerprint(
  input: ApplyJournalEventFactRevisionInput,
  clarificationResolution: JournalEventFactClarificationResolution | null = null
) {
  const targets = [...input.targets]
    .map((target) => ({ factId: target.factId, relation: target.relation }))
    .sort((left, right) =>
      `${left.factId}:${left.relation}`.localeCompare(`${right.factId}:${right.relation}`)
    );
  const resultFacts = input.resultFacts
    .map((fact) => ({
      statement: fact.statement.trim(),
      scope: fact.scope,
      stance: fact.stance,
      kind: fact.kind,
      origin: fact.origin,
      pathAnchorMessageId: fact.pathAnchorMessageId,
      evidence: [...fact.evidence]
        .map((evidence) => ({
          sourceTurnId: evidence.sourceTurnId,
          contextMessageId: evidence.contextMessageId ?? null,
          pathAnchorMessageId: evidence.pathAnchorMessageId,
          role: evidence.role,
          quote: evidence.quote
        }))
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return createHash("sha256")
    .update(
      JSON.stringify({
        eventId: input.eventId,
        activeBranchSessionId: input.activeBranchSessionId,
        branchStateId: input.branchStateId,
        sourceTurnId: input.sourceTurnId,
        pathAnchorMessageId: input.pathAnchorMessageId,
        contextMessageId: input.contextMessageId ?? null,
        quote: input.quote.trim(),
        baseMessageSequence: input.baseMessageSequence,
        targets,
        resultFacts,
        rejectUnderstandingClaimId: input.rejectUnderstandingClaimId ?? null,
        targetOutcomeMessageId: input.targetOutcomeMessageId ?? null,
        clarificationResolution
      })
    )
    .digest("hex");
}

function parsePendingClarification(
  snapshotData: unknown
): JournalEventPendingFactRevisionClarification | null {
  const value = isRecord(snapshotData)
    ? snapshotData.pendingFactRevisionClarification
    : null;
  if (!isRecord(value)) return null;
  if (value.kind !== "ambiguous_target" && value.kind !== "hard_conflict") return null;
  if (
    typeof value.sourceTurnId !== "string" ||
    typeof value.clarificationMessageId !== "string" ||
    !Array.isArray(value.candidateTargetFactIds) ||
    !value.candidateTargetFactIds.every((id) => typeof id === "string") ||
    !Array.isArray(value.candidateFactDrafts)
  ) {
    return null;
  }

  const candidateFactDrafts: JournalEventPendingFactRevisionClarification["candidateFactDrafts"] = [];
  for (const draft of value.candidateFactDrafts) {
    if (
      !isRecord(draft) ||
      typeof draft.statement !== "string" ||
      (draft.scope !== "current_event" && draft.scope !== "background") ||
      (draft.stance !== "affirmed" && draft.stance !== "denied" && draft.stance !== "unknown") ||
      (draft.kind !== "event_detail" &&
        draft.kind !== "inner_experience" &&
        draft.kind !== "stated_interpretation" &&
        draft.kind !== "stated_preference" &&
        draft.kind !== "boundary_answer")
    ) {
      return null;
    }
    candidateFactDrafts.push({
      statement: draft.statement,
      scope: draft.scope,
      stance: draft.stance,
      kind: draft.kind
    });
  }

  return {
    kind: value.kind,
    sourceTurnId: value.sourceTurnId,
    candidateTargetFactIds: value.candidateTargetFactIds,
    candidateFactDrafts,
    clarificationMessageId: value.clarificationMessageId
  };
}

function isSamePendingClarification(
  pending: JournalEventPendingFactRevisionClarification,
  input: SetPendingJournalEventFactClarificationInput
) {
  return (
    pending.kind === input.kind &&
    pending.sourceTurnId === input.sourceTurnId &&
    pending.clarificationMessageId === input.clarificationMessage.id &&
    JSON.stringify([...pending.candidateTargetFactIds].sort()) ===
      JSON.stringify([...input.candidateTargetFactIds].sort()) &&
    JSON.stringify(pending.candidateFactDrafts) === JSON.stringify(input.candidateFactDrafts)
  );
}

function mapEvidence(evidence: {
  id: string;
  factId: string;
  sourceTurnId: string;
  contextMessageId: string | null;
  pathAnchorMessageId: string;
  role: JournalEventFactEvidenceRecord["role"];
  quote: string | null;
  createdAt: Date;
}): JournalEventFactEvidenceRecord {
  return { ...evidence, createdAt: evidence.createdAt.toISOString() };
}

function mapFact(fact: {
  id: string;
  eventId: string;
  createdBranchSessionId: string;
  pathAnchorMessageId: string;
  createdByRevisionId: string | null;
  statement: string;
  scope: JournalEventFactRecord["scope"];
  stance: JournalEventFactRecord["stance"];
  kind: JournalEventFactRecord["kind"];
  origin: JournalEventFactRecord["origin"];
  createdAt: Date;
  evidence: Parameters<typeof mapEvidence>[0][];
}): JournalEventFactRecord {
  return {
    ...fact,
    createdAt: fact.createdAt.toISOString(),
    evidence: fact.evidence.map(mapEvidence)
  };
}

async function resolveEffectiveMessagePath(
  database: DatabaseClient,
  branchSessionId: string
): Promise<{ rootSessionId: string; messages: EventCenteredEffectiveMessage[] } | null> {
  const chain: Array<{
    id: string;
    rootSessionId: string | null;
    parentSessionId: string | null;
    forkMessageSequence: number | null;
    messages: EventCenteredEffectiveMessage[];
  }> = [];
  const visited = new Set<string>();
  let cursor: string | null = branchSessionId;

  while (cursor) {
    if (visited.has(cursor)) throw new Error("INTERVIEW_BRANCH_CYCLE");
    visited.add(cursor);
    const branch: {
      id: string;
      rootSessionId: string | null;
      parentSessionId: string | null;
      forkMessageSequence: number | null;
      messages: EventCenteredEffectiveMessage[];
    } | null = await database.interviewSession.findUnique({
      where: { id: cursor },
      select: {
        id: true,
        rootSessionId: true,
        parentSessionId: true,
        forkMessageSequence: true,
        messages: {
          orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            sessionId: true,
            userTurnId: true,
            role: true,
            sequence: true,
            createdAt: true
          }
        }
      }
    });
    if (!branch) return null;
    chain.push(branch);
    cursor = branch.parentSessionId;
  }

  const root = chain.at(-1);
  if (!root || root.parentSessionId !== null) return null;
  let messages: EventCenteredEffectiveMessage[] = [];
  for (const branch of chain.reverse()) {
    if (branch.forkMessageSequence !== null) {
      messages = messages.filter((message) => message.sequence < branch.forkMessageSequence!);
    }
    messages = [...messages, ...branch.messages].sort(
      (left, right) =>
        left.sequence - right.sequence || left.createdAt.getTime() - right.createdAt.getTime()
    );
  }
  return { rootSessionId: root.rootSessionId ?? root.id, messages };
}

async function requireEventRoute(
  database: DatabaseClient,
  input: {
    eventId: string;
    activeBranchSessionId: string;
    userId?: string;
    requireWritable?: boolean;
  }
): Promise<EventCenteredRoute> {
  const event = await database.journalEvent.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      userId: true,
      rootSessionId: true,
      status: true,
      rootSession: {
        select: {
          id: true,
          mode: true,
          recordMode: true,
          status: true,
          activeBranchSessionId: true
        }
      }
    }
  });
  const branch = await database.interviewSession.findUnique({
    where: { id: input.activeBranchSessionId },
    select: {
      id: true,
      userId: true,
      mode: true,
      recordMode: true,
      status: true,
      rootSessionId: true,
      activeEventId: true,
      stage: true,
      turnCount: true,
      lastAssistantQuestion: true,
      draftSummary: true
    }
  });
  const requireWritable = input.requireWritable ?? true;
  if (
    !event ||
    !branch ||
    (input.userId && event.userId !== input.userId) ||
    branch.userId !== event.userId ||
    event.rootSession.mode !== "event_centered" ||
    branch.mode !== "event_centered" ||
    branch.recordMode !== event.rootSession.recordMode ||
    (branch.rootSessionId ?? branch.id) !== event.rootSessionId ||
    (event.rootSession.activeBranchSessionId ?? event.rootSessionId) !== branch.id ||
    (requireWritable &&
      (event.status !== "active" ||
        event.rootSession.status !== "active" ||
        branch.status !== "active"))
  ) {
    throw new Error("EVENT_STATE_CHANGED");
  }
  const path = await resolveEffectiveMessagePath(database, branch.id);
  if (!path || path.rootSessionId !== event.rootSessionId) {
    throw new Error("EVENT_STATE_CHANGED");
  }
  return { event, branch, path } as EventCenteredRoute;
}

export async function getEventCenteredRouteWithClient(
  database: EventCenteredDatabaseClient,
  input: {
    eventId: string;
    activeBranchSessionId: string;
    userId?: string;
    requireWritable?: boolean;
  }
): Promise<EventCenteredRoute> {
  return requireEventRoute(database, input);
}

async function loadJournalEventFactProjectionSource(
  database: DatabaseClient,
  eventId: string,
  messageIds: string[]
) {
  return Promise.all([
    database.journalEventFact.findMany({
      where: { eventId, pathAnchorMessageId: { in: messageIds } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: {
        evidence: {
          where: { pathAnchorMessageId: { in: messageIds } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }]
        }
      }
    }),
    database.journalEventFactRevision.findMany({
      where: { eventId, pathAnchorMessageId: { in: messageIds } },
      include: { targets: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    })
  ]);
}

function projectJournalEventFactProjection(input: {
  messageIds: string[];
  snapshotData: unknown;
  source: Awaited<ReturnType<typeof loadJournalEventFactProjectionSource>>;
}): JournalEventFactProjection {
  const [facts, revisions] = input.source;
  const messageOrder = new Map(input.messageIds.map((id, index) => [id, index]));

  const factIdsOnPath = new Set(facts.map((fact) => fact.id));
  const sortedRevisions = [...revisions].sort((left, right) => {
    const messageDelta =
      (messageOrder.get(left.pathAnchorMessageId) ?? Number.MAX_SAFE_INTEGER) -
      (messageOrder.get(right.pathAnchorMessageId) ?? Number.MAX_SAFE_INTEGER);
    return (
      messageDelta ||
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.id.localeCompare(right.id)
    );
  });
  const invalidated = new Set<string>();
  const focusState = new Map<string, "deprioritized" | "restored">();
  for (const revision of sortedRevisions) {
    for (const target of revision.targets) {
      if (!factIdsOnPath.has(target.targetFactId)) continue;
      if (INVALIDATING_RELATIONS.has(target.relation)) {
        invalidated.add(target.targetFactId);
      } else if (target.relation === "deprioritize") {
        focusState.set(target.targetFactId, "deprioritized");
      } else if (target.relation === "restore_focus") {
        focusState.set(target.targetFactId, "restored");
      }
    }
  }

  const effectiveFacts = facts.filter((fact) => !invalidated.has(fact.id)).map(mapFact);
  const effectiveFactIds = effectiveFacts.map((fact) => fact.id);
  const deprioritizedFactIds = effectiveFactIds.filter(
    (factId) => focusState.get(factId) === "deprioritized"
  );
  const deprioritizedSet = new Set(deprioritizedFactIds);
  return {
    facts: effectiveFacts,
    effectiveFactIds,
    invalidatedFactIds: [...invalidated].sort(),
    deprioritizedFactIds,
    explorationFactIds: effectiveFactIds.filter((factId) => !deprioritizedSet.has(factId)),
    pendingClarification: parsePendingClarification(input.snapshotData)
  };
}

export async function getEffectiveJournalEventFactProjectionForPathWithClient(
  database: DatabaseClient,
  input: {
    eventId: string;
    messageIds: string[];
    snapshotData: unknown;
  }
): Promise<JournalEventFactProjection> {
  const messageIds = [...new Set(input.messageIds)];
  const source = await loadJournalEventFactProjectionSource(
    database,
    input.eventId,
    messageIds
  );
  return projectJournalEventFactProjection({
    messageIds,
    snapshotData: input.snapshotData,
    source
  });
}

export async function getEffectiveJournalEventFactProjectionForPath(input: {
  eventId: string;
  messageIds: string[];
  snapshotData: unknown;
}): Promise<JournalEventFactProjection> {
  return getEffectiveJournalEventFactProjectionForPathWithClient(prisma, input);
}

async function projectFacts(
  database: DatabaseClient,
  eventId: string,
  activeBranchSessionId: string
): Promise<{ projection: JournalEventFactProjection; route: EventCenteredRoute }> {
  const route = await requireEventRoute(database, {
    eventId,
    activeBranchSessionId,
    requireWritable: false
  });
  const messageIds = route.path.messages.map((message) => message.id);
  const [source, branchState] = await Promise.all([
    loadJournalEventFactProjectionSource(database, eventId, messageIds),
    route.branch.activeEventId
      ? database.interviewEvent.findUnique({
          where: { id: route.branch.activeEventId },
          select: { snapshotData: true }
        })
      : Promise.resolve(null)
  ]);

  return {
    route,
    projection: projectJournalEventFactProjection({
      messageIds,
      snapshotData: branchState?.snapshotData,
      source
    })
  };
}

export async function getEffectiveJournalEventFactProjection(
  eventId: string,
  activeBranchSessionId: string
): Promise<JournalEventFactProjection> {
  return getEffectiveJournalEventFactProjectionWithClient(
    prisma,
    eventId,
    activeBranchSessionId
  );
}

export async function getEffectiveJournalEventFactProjectionWithClient(
  database: DatabaseClient,
  eventId: string,
  activeBranchSessionId: string
): Promise<JournalEventFactProjection> {
  return (await projectFacts(database, eventId, activeBranchSessionId)).projection;
}

function batchChangedFactIds(targets: ApplyJournalEventFactRevisionInput["targets"]) {
  return {
    invalidatedFactIds: targets
      .filter((target) => INVALIDATING_RELATIONS.has(target.relation))
      .map((target) => target.factId),
    deprioritizedFactIds: targets
      .filter((target) => target.relation === "deprioritize")
      .map((target) => target.factId)
  };
}

function validateRevisionShape(input: ApplyJournalEventFactRevisionInput) {
  assertNonEmpty(input.quote, "EVENT_FACT_REVISION_INVALID");
  if (
    input.targets.length === 0 &&
    input.resultFacts.length === 0 &&
    !input.rejectUnderstandingClaimId &&
    !input.targetOutcomeMessageId
  ) {
    throw new Error("EVENT_FACT_REVISION_EMPTY");
  }
  const targetFactIds = input.targets.map((target) => target.factId);
  if (new Set(targetFactIds).size !== targetFactIds.length) {
    throw new Error("EVENT_FACT_REVISION_TARGET_DUPLICATE");
  }
  const relations = new Set(input.targets.map((target) => target.relation));
  if (
    (["supplement", "supersede", "negate"] as const).some(
      (relation) => relations.has(relation)
    ) && input.resultFacts.length === 0
  ) {
    throw new Error("EVENT_FACT_REVISION_RESULT_REQUIRED");
  }
  if (relations.has("negate") && !input.resultFacts.some((fact) => fact.stance === "denied")) {
    throw new Error("EVENT_FACT_REVISION_DENIAL_REQUIRED");
  }
  if (
    (relations.has("deprioritize") || relations.has("restore_focus")) &&
    !input.resultFacts.some((fact) => fact.kind === "stated_preference")
  ) {
    throw new Error("EVENT_FACT_REVISION_PREFERENCE_REQUIRED");
  }
  for (const fact of input.resultFacts) {
    assertNonEmpty(fact.statement, "EVENT_FACT_REVISION_RESULT_INVALID");
    if (fact.evidence.length === 0) throw new Error("EVENT_FACT_REVISION_EVIDENCE_REQUIRED");
  }
}

async function readExistingRevisionResult(
  database: DatabaseClient,
  input: ApplyJournalEventFactRevisionInput,
  clarificationResolution: JournalEventFactClarificationResolution | null = null
): Promise<ApplyJournalEventFactRevisionResult | null> {
  const route = await requireEventRoute(database, {
    eventId: input.eventId,
    activeBranchSessionId: input.activeBranchSessionId,
    userId: input.userId,
    requireWritable: false
  });
  const revision = await database.journalEventFactRevision.findUnique({
    where: { sourceTurnId: input.sourceTurnId },
    include: {
      targets: true,
      createdFacts: { select: { id: true } },
      rejectedClaim: { select: { id: true } },
      angleOutcomeRepairs: {
        select: {
          priorOutcomeId: true,
          angle: true,
          resolutions: {
            where: {
              resolvedMessageId: { in: route.path.messages.map((message) => message.id) }
            },
            select: { id: true }
          }
        }
      }
    }
  });
  if (!revision) return null;
  if (revision.eventId !== input.eventId || revision.branchSessionId !== input.activeBranchSessionId) {
    throw new Error("EVENT_FACT_REVISION_IDEMPOTENCY_CONFLICT");
  }
  if (
    revision.requestFingerprint !==
    revisionRequestFingerprint(input, clarificationResolution)
  ) {
    throw new Error("EVENT_FACT_REVISION_IDEMPOTENCY_CONFLICT");
  }
  if (!revision.decisionTraceId) throw new Error("EVENT_FACT_REVISION_TRACE_MISSING");
  const projection = (
    await projectFacts(database, input.eventId, input.activeBranchSessionId)
  ).projection;
  const changed = batchChangedFactIds(
    revision.targets.map((target) => ({
      factId: target.targetFactId,
      relation: target.relation
    }))
  );
  const angleOutcomeRepairs = revision.angleOutcomeRepairs ?? [];
  return {
    kind: "existing",
    revisionId: revision.id,
    eventId: revision.eventId,
    sourceTurnId: revision.sourceTurnId,
    createdFactIds: revision.createdFacts.map((fact) => fact.id),
    effectiveFactIds: projection.effectiveFactIds,
    invalidatedFactIds: changed.invalidatedFactIds,
    deprioritizedFactIds: changed.deprioritizedFactIds,
    rejectedClaimId: revision.rejectedClaim?.id ?? null,
    decisionTraceId: revision.decisionTraceId,
    affectedOutcomeIds: angleOutcomeRepairs.map(
      (repair) => repair.priorOutcomeId
    ),
    repairPendingAngles: JOURNAL_EVENT_ANGLES.filter((angle) =>
      angleOutcomeRepairs.some(
        (repair) => repair.angle === angle && repair.resolutions.length === 0
      )
    )
  };
}

async function validateResultEvidence(
  database: DatabaseClient,
  input: ApplyJournalEventFactRevisionInput,
  route: EventCenteredRoute
) {
  const effectiveMessageIds = new Set(route.path.messages.map((message) => message.id));
  const evidenceInputs = input.resultFacts.flatMap((fact) => fact.evidence);
  const sourceTurnIds = [...new Set(evidenceInputs.map((evidence) => evidence.sourceTurnId))];
  const sourceTurns = sourceTurnIds.length
    ? await database.interviewUserTurn.findMany({
        where: { id: { in: sourceTurnIds } },
        select: {
          id: true,
          journalEventId: true,
          rawText: true,
          messages: { where: { role: "user" }, select: { id: true } }
        }
      })
    : [];
  const byId = new Map(sourceTurns.map((turn) => [turn.id, turn]));

  for (const fact of input.resultFacts) {
    if (
      fact.pathAnchorMessageId !== input.pathAnchorMessageId ||
      !fact.evidence.some(
        (evidence) =>
          evidence.sourceTurnId === input.sourceTurnId &&
          evidence.pathAnchorMessageId === input.pathAnchorMessageId
      )
    ) {
      throw new Error("EVENT_FACT_REVISION_RESULT_INVALID");
    }
    for (const evidence of fact.evidence) {
      const sourceTurn = byId.get(evidence.sourceTurnId);
      const contextMessage = evidence.contextMessageId
        ? route.path.messages.find((message) => message.id === evidence.contextMessageId)
        : null;
      if (
        !sourceTurn ||
        sourceTurn.journalEventId !== input.eventId ||
        (sourceTurn.messages.length > 0 &&
          !sourceTurn.messages.some((message) => effectiveMessageIds.has(message.id))) ||
        !effectiveMessageIds.has(evidence.pathAnchorMessageId) ||
        (evidence.contextMessageId && contextMessage?.role !== "assistant") ||
        (evidence.role === "short_confirmation" && !contextMessage) ||
        !evidence.quote.trim() ||
        !sourceTurn.rawText?.includes(evidence.quote)
      ) {
        throw new Error("EVENT_FACT_REVISION_EVIDENCE_INVALID");
      }
    }
  }
}

async function applyRevisionTransaction(
  input: ApplyJournalEventFactRevisionInput,
  options: {
    resolvePendingClarification: boolean;
    clarificationResolution?: JournalEventFactClarificationResolution;
  }
): Promise<ApplyJournalEventFactRevisionResult> {
  validateRevisionShape(input);
  try {
    return await prisma.$transaction(async (database) => {
    const existing = await readExistingRevisionResult(
      database,
      input,
      options.clarificationResolution ?? null
    );
    if (existing) return existing;

    const { route, projection: before } = await projectFacts(
      database,
      input.eventId,
      input.activeBranchSessionId
    );
    await requireEventRoute(database, {
      eventId: input.eventId,
      activeBranchSessionId: input.activeBranchSessionId,
      userId: input.userId,
      requireWritable: true
    });
    if (route.branch.activeEventId !== input.branchStateId) {
      throw new Error("EVENT_STATE_CHANGED");
    }
    if (options.resolvePendingClarification) {
      if (!before.pendingClarification) throw new Error("EVENT_FACT_CLARIFICATION_NOT_FOUND");
      if (input.contextMessageId !== before.pendingClarification.clarificationMessageId) {
        throw new Error("EVENT_FACT_CLARIFICATION_CONTEXT_INVALID");
      }
      const candidates = new Set(before.pendingClarification.candidateTargetFactIds);
      if (input.targets.some((target) => !candidates.has(target.factId))) {
        throw new Error("EVENT_FACT_CLARIFICATION_TARGET_INVALID");
      }
      if (options.clarificationResolution === "withdraw_as_unknown") {
        const targetIds = new Set(input.targets.map((target) => target.factId));
        if (
          targetIds.size !== candidates.size ||
          [...candidates].some((factId) => !targetIds.has(factId)) ||
          input.targets.some((target) => target.relation !== "withdraw") ||
          input.resultFacts.length === 0 ||
          input.resultFacts.some(
            (fact) => fact.stance !== "unknown" || fact.kind !== "boundary_answer"
          )
        ) {
          throw new Error("EVENT_FACT_CLARIFICATION_UNKNOWN_INVALID");
        }
      } else if (
        options.clarificationResolution !== "apply_revision" ||
        input.targets.length === 0
      ) {
        throw new Error("EVENT_FACT_CLARIFICATION_RESOLUTION_INVALID");
      }
      if (
        input.resultFacts.some(
          (fact) =>
            !fact.evidence.some(
              (evidence) =>
                evidence.sourceTurnId === input.sourceTurnId &&
                evidence.contextMessageId === before.pendingClarification?.clarificationMessageId
            )
        )
      ) {
        throw new Error("EVENT_FACT_CLARIFICATION_EVIDENCE_INVALID");
      }
    } else if (before.pendingClarification) {
      throw new Error("EVENT_FACT_CLARIFICATION_REQUIRED");
    }

    const turn = await database.interviewUserTurn.findUnique({
      where: { id: input.sourceTurnId },
      include: {
        messages: {
          where: { role: "user" },
          orderBy: { sequence: "asc" },
          select: { id: true, sequence: true }
        }
      }
    });
    if (
      !turn ||
      turn.sessionId !== input.activeBranchSessionId ||
      turn.journalEventId !== input.eventId ||
      turn.status !== "processing" ||
      turn.baseMessageSequence !== input.baseMessageSequence ||
      !turn.rawText?.includes(input.quote)
    ) {
      throw new Error("EVENT_FACT_REVISION_TURN_INVALID");
    }
    const userMessage = turn.messages[0];
    const userMessageIndex = route.path.messages.findIndex(
      (message) => message.id === input.pathAnchorMessageId
    );
    if (
      !userMessage ||
      userMessage.id !== input.pathAnchorMessageId ||
      userMessage.sequence !== input.baseMessageSequence + 1 ||
      userMessageIndex < 0 ||
      route.path.messages.at(-1)?.id !== userMessage.id
    ) {
      throw new Error("EVENT_STATE_CHANGED");
    }
    if (input.contextMessageId) {
      const contextIndex = route.path.messages.findIndex(
        (message) => message.id === input.contextMessageId && message.role === "assistant"
      );
      if (contextIndex < 0 || contextIndex >= userMessageIndex) {
        throw new Error("EVENT_FACT_REVISION_CONTEXT_INVALID");
      }
    }

    const effectiveFactIds = new Set(before.effectiveFactIds);
    const factsById = new Map(before.facts.map((fact) => [fact.id, fact]));
    for (const target of input.targets) {
      const targetFact = factsById.get(target.factId);
      const targetMessageIndex = targetFact
        ? route.path.messages.findIndex(
            (message) => message.id === targetFact.pathAnchorMessageId
          )
        : -1;
      if (!effectiveFactIds.has(target.factId) || targetMessageIndex < 0 || targetMessageIndex >= userMessageIndex) {
        throw new Error("EVENT_FACT_REVISION_TARGET_NOT_EFFECTIVE");
      }
    }
    await validateResultEvidence(database, input, route);

    let rejectedClaim: {
      id: string;
      eventId: string;
      assistantMessageId: string;
      status: string;
    } | null = null;
    if (input.rejectUnderstandingClaimId) {
      rejectedClaim = await database.journalEventUnderstandingClaim.findUnique({
        where: { id: input.rejectUnderstandingClaimId },
        select: { id: true, assistantMessageId: true, status: true, eventId: true }
      });
      const previousAssistant = route.path.messages
        .slice(0, userMessageIndex)
        .filter((message) => message.role === "assistant")
        .at(-1);
      if (
        !rejectedClaim ||
        rejectedClaim.eventId !== input.eventId ||
        rejectedClaim.status !== "pending" ||
        rejectedClaim.assistantMessageId !== previousAssistant?.id
      ) {
        throw new Error("EVENT_UNDERSTANDING_CLAIM_NOT_REJECTABLE");
      }
    }

    const revisionId = randomUUID();
    const decisionTraceId = input.trace.id ?? randomUUID();
    const createdFactIds: string[] = [];
    await database.aIGenerationTrace.create({
      data: {
        id: decisionTraceId,
        requestId: input.trace.requestId ?? null,
        userId: input.userId,
        sessionId: input.activeBranchSessionId,
        journalEventId: input.eventId,
        dimension: null,
        artifactType: "interview_turn",
        artifactId: revisionId,
        artifactVersion: 1,
        triggerMessageId: userMessage.id,
        status: "completed",
        outputOrigin: input.trace.outputOrigin,
        contextSnapshot: toJsonValue({
          ...input.trace.contextSnapshot,
          eventId: input.eventId,
          activeBranchSessionId: input.activeBranchSessionId,
          sourceTurnId: input.sourceTurnId,
          effectiveFactIdsBefore: before.effectiveFactIds,
          pendingClarification: before.pendingClarification
        }),
        finalOutput: toJsonValue(input.trace.finalOutput),
        pipelineDecisions: toJsonValue([
          ...input.trace.pipelineDecisions,
          {
            kind: "journal_event_fact_revision",
            targets: input.targets,
            rejectedUnderstandingClaimId: input.rejectUnderstandingClaimId ?? null,
            unsupportedClaimCount: 0
          }
        ]),
        completedAt: new Date()
      }
    });
    await database.journalEventFactRevision.create({
      data: {
        id: revisionId,
        eventId: input.eventId,
        branchSessionId: input.activeBranchSessionId,
        sourceTurnId: input.sourceTurnId,
        clarificationSourceTurnId: options.resolvePendingClarification
          ? before.pendingClarification?.sourceTurnId ?? null
          : null,
        pathAnchorMessageId: input.pathAnchorMessageId,
        contextMessageId: input.contextMessageId ?? null,
        quote: input.quote,
        requestFingerprint: revisionRequestFingerprint(
          input,
          options.clarificationResolution ?? null
        ),
        decisionTraceId
      }
    });
    if (input.targets.length > 0) {
      await database.journalEventFactRevisionTarget.createMany({
        data: input.targets.map((target) => ({
          id: randomUUID(),
          revisionId,
          targetFactId: target.factId,
          relation: target.relation
        }))
      });
    }
    for (const fact of input.resultFacts) {
      const factId = randomUUID();
      createdFactIds.push(factId);
      await database.journalEventFact.create({
        data: {
          id: factId,
          eventId: input.eventId,
          createdBranchSessionId: input.activeBranchSessionId,
          pathAnchorMessageId: fact.pathAnchorMessageId,
          createdByRevisionId: revisionId,
          statement: fact.statement.trim(),
          scope: fact.scope,
          stance: fact.stance,
          kind: fact.kind,
          origin: fact.origin
        }
      });
      await database.journalEventFactEvidence.createMany({
        data: fact.evidence.map((evidence) => ({
          id: randomUUID(),
          factId,
          sourceTurnId: evidence.sourceTurnId,
          contextMessageId: evidence.contextMessageId ?? null,
          pathAnchorMessageId: evidence.pathAnchorMessageId,
          role: evidence.role,
          quote: evidence.quote
        })),
        skipDuplicates: true
      });
    }

    if (rejectedClaim) {
      const rejectedAt = new Date();
      const updated = await database.journalEventUnderstandingClaim.updateMany({
        where: {
          id: rejectedClaim.id,
          status: "pending",
          confirmedFactId: null,
          confirmedByTurnId: null,
          confirmedAt: null,
          rejectedByRevisionId: null,
          rejectedByTurnId: null,
          rejectedAt: null
        },
        data: {
          status: "rejected",
          rejectedByRevisionId: revisionId,
          rejectedByTurnId: input.sourceTurnId,
          rejectedAt
        }
      });
      if (updated.count !== 1) throw new Error("EVENT_UNDERSTANDING_CLAIM_REJECTION_RACE");
    }

    const changed = batchChangedFactIds(input.targets);
    const angleRepairs = await enqueueJournalEventAngleRepairsWithClient(database, {
      eventId: input.eventId,
      activeBranchSessionId: input.activeBranchSessionId,
      factRevisionId: revisionId,
      pathAnchorMessageId: input.pathAnchorMessageId,
      effectiveMessageIds: route.path.messages.map((message) => message.id),
      effectiveFactIdsBefore: before.effectiveFactIds,
      invalidatedFactIds: changed.invalidatedFactIds,
      targetOutcomeMessageId: input.targetOutcomeMessageId ?? null
    });
    if (angleRepairs.repairIds.length > 0) {
      await database.aIGenerationTrace.update({
        where: { id: decisionTraceId },
        data: {
          pipelineDecisions: toJsonValue([
            ...input.trace.pipelineDecisions,
            {
              kind: "journal_event_fact_revision",
              targets: input.targets,
              rejectedUnderstandingClaimId: input.rejectUnderstandingClaimId ?? null,
              unsupportedClaimCount: 0
            },
            {
              kind: "journal_event_angle_outcome_repair_enqueued",
              repairIds: angleRepairs.repairIds,
              affectedOutcomeIds: angleRepairs.affectedOutcomeIds,
              repairPendingAngles: angleRepairs.repairPendingAngles
            }
          ])
        }
      });
    }

    const { projection: after } = await projectFacts(
      database,
      input.eventId,
      input.activeBranchSessionId
    );
    const branchState = await database.interviewEvent.findUnique({
      where: { id: input.branchStateId }
    });
    if (!branchState || branchState.sessionId !== input.activeBranchSessionId) {
      throw new Error("EVENT_STATE_CHANGED");
    }
    const snapshotData = {
      ...snapshotObject(branchState.snapshotData),
      kind: "event_centered",
      schemaVersion: 4,
      lastFactRevisionId: revisionId,
      lastFactRevisionTurnId: input.sourceTurnId,
      invalidatedFactIds: after.invalidatedFactIds,
      deprioritizedFactIds: after.deprioritizedFactIds,
      pendingAngleOutcomeRepairIds: angleRepairs.repairIds,
      repairPendingAngles: angleRepairs.repairPendingAngles,
      ...(rejectedClaim ? { pendingUnderstandingClaimId: null } : {}),
      ...(options.resolvePendingClarification
        ? { pendingFactRevisionClarification: null }
        : {})
    };
    await database.interviewEvent.update({
      where: { id: branchState.id },
      data: { snapshotData: toJsonValue(snapshotData) }
    });
    await database.interviewBranchCheckpoint.upsert({
      where: { messageId: userMessage.id },
      update: {
        schemaVersion: 4,
        sessionState: toJsonValue({
          mode: "event_centered",
          status: route.branch.status,
          stage: route.branch.stage,
          activeEventId: branchState.id,
          turnCount: route.branch.turnCount,
          lastAssistantQuestion: route.branch.lastAssistantQuestion,
          draftSummary: route.branch.draftSummary
        }),
        eventsState: toJsonValue([{ ...branchState, snapshotData }])
      },
      create: {
        sessionId: input.activeBranchSessionId,
        messageId: userMessage.id,
        schemaVersion: 4,
        sessionState: toJsonValue({
          mode: "event_centered",
          status: route.branch.status,
          stage: route.branch.stage,
          activeEventId: branchState.id,
          turnCount: route.branch.turnCount,
          lastAssistantQuestion: route.branch.lastAssistantQuestion,
          draftSummary: route.branch.draftSummary
        }),
        eventsState: toJsonValue([{ ...branchState, snapshotData }])
      }
    });

    return {
      kind: "applied",
      revisionId,
      eventId: input.eventId,
      sourceTurnId: input.sourceTurnId,
      createdFactIds,
      effectiveFactIds: after.effectiveFactIds,
      invalidatedFactIds: changed.invalidatedFactIds,
      deprioritizedFactIds: changed.deprioritizedFactIds,
      rejectedClaimId: rejectedClaim?.id ?? null,
      decisionTraceId,
      affectedOutcomeIds: angleRepairs.affectedOutcomeIds,
      repairPendingAngles: angleRepairs.repairPendingAngles
    };
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const existing = await readExistingRevisionResult(
      prisma,
      input,
      options.clarificationResolution ?? null
    );
    if (!existing) throw error;
    return existing;
  }
}

export async function applyJournalEventFactRevision(
  input: ApplyJournalEventFactRevisionInput
): Promise<ApplyJournalEventFactRevisionResult> {
  return applyRevisionTransaction(input, { resolvePendingClarification: false });
}

export async function rejectPendingUnderstandingClaim(
  input: Omit<ApplyJournalEventFactRevisionInput, "targets" | "resultFacts" | "rejectUnderstandingClaimId"> & {
    claimId: string;
  }
): Promise<ApplyJournalEventFactRevisionResult> {
  return applyRevisionTransaction(
    {
      ...input,
      targets: [],
      resultFacts: [],
      rejectUnderstandingClaimId: input.claimId
    },
    { resolvePendingClarification: false }
  );
}

export async function setPendingJournalEventFactClarification(
  input: SetPendingJournalEventFactClarificationInput
): Promise<JournalEventPendingFactRevisionClarification> {
  assertNonEmpty(input.clarificationMessage.id, "EVENT_FACT_CLARIFICATION_MESSAGE_INVALID");
  assertNonEmpty(input.clarificationMessage.content, "EVENT_FACT_CLARIFICATION_MESSAGE_INVALID");
  try {
    return await prisma.$transaction(async (database) => {
      const { route, projection } = await projectFacts(
        database,
        input.eventId,
        input.activeBranchSessionId
      );
      await requireEventRoute(database, {
        eventId: input.eventId,
        activeBranchSessionId: input.activeBranchSessionId,
        userId: input.userId,
        requireWritable: true
      });
      if (route.branch.activeEventId !== input.branchStateId) {
        throw new Error("EVENT_STATE_CHANGED");
      }
      if (projection.pendingClarification) {
        if (isSamePendingClarification(projection.pendingClarification, input)) {
          return projection.pendingClarification;
        }
        throw new Error("EVENT_FACT_CLARIFICATION_ALREADY_PENDING");
      }

      const turn = await database.interviewUserTurn.findUnique({
        where: { id: input.sourceTurnId },
        include: {
          messages: {
            where: { role: "user" },
            orderBy: { sequence: "asc" },
            select: { id: true, sequence: true }
          }
        }
      });
      if (
        !turn ||
        turn.sessionId !== input.activeBranchSessionId ||
        turn.journalEventId !== input.eventId ||
        turn.baseMessageSequence !== input.baseMessageSequence ||
        turn.status !== "processing" ||
        turn.messages[0]?.id !== input.pathAnchorMessageId
      ) {
        throw new Error("EVENT_FACT_CLARIFICATION_TURN_INVALID");
      }
      const sourceIndex = route.path.messages.findIndex(
        (message) => message.id === input.pathAnchorMessageId && message.role === "user"
      );
      if (
        sourceIndex < 0 ||
        sourceIndex !== route.path.messages.length - 1 ||
        turn.messages[0]?.sequence !== input.baseMessageSequence + 1
      ) {
        throw new Error("EVENT_STATE_CHANGED");
      }

      const uniqueTargets = [...new Set(input.candidateTargetFactIds)];
      if (uniqueTargets.length !== input.candidateTargetFactIds.length) {
        throw new Error("EVENT_FACT_CLARIFICATION_CANDIDATES_INVALID");
      }
      if (
        (input.kind === "ambiguous_target" && uniqueTargets.length < 2) ||
        (input.kind === "hard_conflict" &&
          (uniqueTargets.length === 0 || input.candidateFactDrafts.length === 0)) ||
        uniqueTargets.some((factId) => !projection.effectiveFactIds.includes(factId)) ||
        input.candidateFactDrafts.some((draft) => !draft.statement.trim())
      ) {
        throw new Error("EVENT_FACT_CLARIFICATION_CANDIDATES_INVALID");
      }

      const assistantMessageId = input.clarificationMessage.id;
      const generationTraceId = input.trace.id ?? randomUUID();
      const pending: JournalEventPendingFactRevisionClarification = {
        kind: input.kind,
        sourceTurnId: input.sourceTurnId,
        candidateTargetFactIds: uniqueTargets,
        candidateFactDrafts: input.candidateFactDrafts,
        clarificationMessageId: assistantMessageId
      };
      const branchState = await database.interviewEvent.findUnique({
        where: { id: input.branchStateId }
      });
      if (!branchState || branchState.sessionId !== input.activeBranchSessionId) {
        throw new Error("EVENT_STATE_CHANGED");
      }

      await database.aIGenerationTrace.create({
        data: {
          id: generationTraceId,
          requestId: input.trace.requestId ?? null,
          userId: input.userId,
          sessionId: input.activeBranchSessionId,
          journalEventId: input.eventId,
          dimension: null,
          artifactType: "interview_turn",
          artifactId: assistantMessageId,
          artifactVersion: 1,
          triggerMessageId: input.pathAnchorMessageId,
          status: "completed",
          outputOrigin: input.trace.outputOrigin,
          contextSnapshot: toJsonValue({
            ...input.trace.contextSnapshot,
            eventId: input.eventId,
            activeBranchSessionId: input.activeBranchSessionId,
            effectiveFactIds: projection.effectiveFactIds,
            clarification: pending
          }),
          finalOutput: toJsonValue({
            ...input.trace.finalOutput,
            assistantMessageId,
            content: input.clarificationMessage.content
          }),
          pipelineDecisions: toJsonValue([
            ...input.trace.pipelineDecisions,
            { kind: "journal_event_fact_clarification", clarification: pending }
          ]),
          completedAt: new Date()
        }
      });
      await database.interviewMessage.create({
        data: {
          id: assistantMessageId,
          sessionId: input.activeBranchSessionId,
          userTurnId: input.sourceTurnId,
          generationTraceId,
          responseGroupId: assistantMessageId,
          responseVersion: 1,
          branchSessionId: input.activeBranchSessionId,
          role: "assistant",
          content: input.clarificationMessage.content,
          sequence: turn.messages[0].sequence + 1
        }
      });

      const snapshotData = {
        ...snapshotObject(branchState.snapshotData),
        kind: "event_centered",
        schemaVersion: 4,
        pendingFactRevisionClarification: pending
      };
      await database.interviewEvent.update({
        where: { id: branchState.id },
        data: { snapshotData: toJsonValue(snapshotData) }
      });
      await database.interviewSession.update({
        where: { id: input.activeBranchSessionId },
        data: { lastAssistantQuestion: input.clarificationMessage.content }
      });
      await database.interviewUserTurn.update({
        where: { id: input.sourceTurnId },
        data: { status: "completed", errorCode: null, completedAt: new Date() }
      });
      await database.interviewBranchCheckpoint.upsert({
        where: { messageId: assistantMessageId },
        update: {
          schemaVersion: 4,
          sessionState: toJsonValue({
            mode: "event_centered",
            status: route.branch.status,
            stage: route.branch.stage,
            activeEventId: branchState.id,
            turnCount: route.branch.turnCount,
            lastAssistantQuestion: input.clarificationMessage.content,
            draftSummary: route.branch.draftSummary
          }),
          eventsState: toJsonValue([{ ...branchState, snapshotData }])
        },
        create: {
          sessionId: input.activeBranchSessionId,
          messageId: assistantMessageId,
          schemaVersion: 4,
          sessionState: toJsonValue({
            mode: "event_centered",
            status: route.branch.status,
            stage: route.branch.stage,
            activeEventId: branchState.id,
            turnCount: route.branch.turnCount,
            lastAssistantQuestion: input.clarificationMessage.content,
            draftSummary: route.branch.draftSummary
          }),
          eventsState: toJsonValue([{ ...branchState, snapshotData }])
        }
      });
      return pending;
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    await requireEventRoute(prisma, {
      eventId: input.eventId,
      activeBranchSessionId: input.activeBranchSessionId,
      userId: input.userId,
      requireWritable: false
    });
    const pending = (
      await projectFacts(prisma, input.eventId, input.activeBranchSessionId)
    ).projection.pendingClarification;
    if (pending && isSamePendingClarification(pending, input)) return pending;
    throw error;
  }
}

export async function resolvePendingJournalEventFactClarification(
  input: ResolvePendingJournalEventFactClarificationInput
): Promise<ApplyJournalEventFactRevisionResult> {
  return applyRevisionTransaction(input, {
    resolvePendingClarification: true,
    clarificationResolution: input.clarificationResolution
  });
}

export async function assertEventCenteredForwardOperationAllowedWithClient(
  database: DatabaseClient,
  input: {
    eventId: string;
    activeBranchSessionId: string;
    operation: EventCenteredForwardOperation;
  }
): Promise<void> {
  if (!BLOCKED_FORWARD_OPERATIONS.has(input.operation)) return;
  const { projection, route } = await projectFacts(
    database,
    input.eventId,
    input.activeBranchSessionId
  );
  if (projection.pendingClarification) {
    throw new Error("EVENT_FACT_CLARIFICATION_REQUIRED");
  }
  const pathMessageIds = route.path.messages.map((message) => message.id);
  const pendingAngleRepair = await database.journalEventAngleOutcomeRepair.findFirst({
    where: {
      eventId: input.eventId,
      pathAnchorMessageId: { in: pathMessageIds },
      resolutions: {
        none: { resolvedMessageId: { in: pathMessageIds } }
      }
    },
    select: { id: true }
  });
  if (pendingAngleRepair) throw new Error("EVENT_ANGLE_OUTCOME_REPAIR_REQUIRED");
}

export async function assertEventCenteredForwardOperationAllowed(input: {
  eventId: string;
  activeBranchSessionId: string;
  operation: EventCenteredForwardOperation;
}): Promise<void> {
  return prisma.$transaction((database) =>
    assertEventCenteredForwardOperationAllowedWithClient(database, input)
  );
}
