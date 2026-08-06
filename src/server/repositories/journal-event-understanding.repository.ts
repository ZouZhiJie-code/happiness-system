import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@/server/db/prisma";
import { validateEventCenteredDialogueStateForCommit } from "@/features/interview/event-centered/dialogue-state";
import {
  angleResultTraceDecision,
  commitJournalEventAngleResultsWithClient,
  isAngleOutcomeUniqueConflict
} from "@/server/repositories/journal-event-angle-outcome.repository";
import {
  getEffectiveJournalEventFactProjection,
  getEffectiveJournalEventFactProjectionWithClient
} from "@/server/repositories/journal-event-fact-revision.repository";
import type {
  CommitEventCenteredTurnUnderstandingInput,
  CommitEventCenteredTurnUnderstandingResult,
  ConfirmPendingUnderstandingClaimResult,
  JournalEventFactRecord
} from "@/types/journal-event-understanding";
import { JOURNAL_EVENT_ANGLES } from "@/types/journal-event-angle-outcome";

type DatabaseClient = Prisma.TransactionClient;

type EffectiveMessage = {
  id: string;
  sessionId: string;
  userTurnId: string | null;
  role: "user" | "assistant" | "system";
  sequence: number;
  createdAt: Date;
};

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function canonicalizeSet(values: readonly unknown[]) {
  return values
    .map(canonicalize)
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right))
    );
}

export function getEventCenteredUnderstandingCommitFingerprint(
  input: CommitEventCenteredTurnUnderstandingInput
) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        canonicalize({
          eventId: input.eventId,
          activeBranchSessionId: input.activeBranchSessionId,
          branchStateId: input.branchStateId,
          userTurnId: input.userTurnId,
          assistantMessage: {
            content: input.assistantMessage.content.trim(),
            responseVersion: input.assistantMessage.responseVersion ?? 1,
            lastAssistantQuestion: input.assistantMessage.lastAssistantQuestion ?? null
          },
          facts: input.facts.map((fact) => ({
            ...fact,
            ...(fact.operation === "create"
              ? { statement: fact.statement.trim() }
              : {}),
            evidence: canonicalizeSet(fact.evidence)
          })),
          pendingClaim: input.pendingClaim
            ? { ...input.pendingClaim, statement: input.pendingClaim.statement.trim() }
            : null,
          focusSummary: input.focusSummary.trim(),
          snapshotData: input.snapshotData ?? null,
          checks: input.checks,
          angleOutcome: input.angleOutcome
            ? {
                ...input.angleOutcome,
                statement: input.angleOutcome.statement.trim(),
                dependencies: canonicalizeSet(input.angleOutcome.dependencies)
              }
            : null,
          angleRepairResolutions: canonicalizeSet(
            (input.angleRepairResolutions ?? []).map((resolution) =>
              resolution.decision === "replace"
                ? {
                    ...resolution,
                    outcome: {
                      ...resolution.outcome,
                      statement: resolution.outcome.statement.trim(),
                      dependencies: canonicalizeSet(resolution.outcome.dependencies)
                    }
                  }
                : resolution
            )
          )
        })
      )
    )
    .digest("hex");
}

function storedUnderstandingCommitFingerprint(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) return null;
  for (const decision of value) {
    if (
      decision &&
      typeof decision === "object" &&
      !Array.isArray(decision) &&
      decision.kind === "event_centered_understanding_commit" &&
      typeof decision.requestFingerprint === "string"
    ) {
      return decision.requestFingerprint;
    }
  }
  return null;
}

function snapshotObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

function assertNonEmpty(value: string, code: string) {
  if (!value.trim()) throw new Error(code);
}

async function resolveEffectiveMessagePath(
  database: DatabaseClient,
  branchSessionId: string
): Promise<{ rootSessionId: string; messages: EffectiveMessage[] } | null> {
  const chain: Array<{
    id: string;
    rootSessionId: string | null;
    parentSessionId: string | null;
    forkMessageSequence: number | null;
    messages: EffectiveMessage[];
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
      messages: EffectiveMessage[];
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

  let messages: EffectiveMessage[] = [];
  for (const branch of chain.reverse()) {
    if (branch.forkMessageSequence !== null) {
      messages = messages.filter((message) => message.sequence < branch.forkMessageSequence!);
    }
    messages = [...messages, ...branch.messages].sort(
      (left, right) =>
        left.sequence - right.sequence || left.createdAt.getTime() - right.createdAt.getTime()
    );
  }

  return {
    rootSessionId: root.rootSessionId ?? root.id,
    messages
  };
}

async function requireEventRoute(
  database: DatabaseClient,
  input: {
    eventId: string;
    activeBranchSessionId: string;
    userId?: string;
    requireWritable?: boolean;
  }
) {
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

  return { event, branch, path };
}

export async function getEffectiveJournalEventFacts(
  eventId: string,
  activeBranchSessionId: string
): Promise<JournalEventFactRecord[]> {
  const projection = await getEffectiveJournalEventFactProjection(
    eventId,
    activeBranchSessionId
  );
  return projection.facts;
}

export async function confirmPendingUnderstandingClaimWithClient(
  database: DatabaseClient,
  input: {
  userTurnId: string;
  activeBranchSessionId: string;
  }
): Promise<ConfirmPendingUnderstandingClaimResult> {
    const turn = await database.interviewUserTurn.findUnique({
      where: { id: input.userTurnId },
      include: {
        messages: {
          where: { role: "user" },
          orderBy: { sequence: "asc" },
          select: { id: true }
        }
      }
    });

    if (
      !turn ||
      !turn.journalEventId ||
      turn.sessionId !== input.activeBranchSessionId ||
      (turn.status !== "processing" && turn.status !== "completed")
    ) {
      throw new Error("EVENT_TURN_NOT_CONFIRMABLE");
    }

    const route = await requireEventRoute(database, {
      eventId: turn.journalEventId,
      activeBranchSessionId: input.activeBranchSessionId,
      requireWritable: turn.status === "processing"
    });
    const currentUserMessageId = turn.messages[0]?.id ?? null;
    const currentUserMessageIndex = currentUserMessageId
      ? route.path.messages.findIndex((message) => message.id === currentUserMessageId)
      : route.path.messages.length;

    if (currentUserMessageId && currentUserMessageIndex < 0) {
      throw new Error("EVENT_STATE_CHANGED");
    }

    const previousAssistant = route.path.messages
      .slice(0, currentUserMessageIndex)
      .filter((message) => message.role === "assistant")
      .at(-1);

    if (!previousAssistant) {
      return { kind: "no_eligible_claim", claimId: null, factId: null };
    }

    const claim = await database.journalEventUnderstandingClaim.findUnique({
      where: { assistantMessageId: previousAssistant.id }
    });
    if (!claim || claim.eventId !== turn.journalEventId) {
      return { kind: "no_eligible_claim", claimId: null, factId: null };
    }
    if (claim.status === "rejected") {
      return { kind: "no_eligible_claim", claimId: null, factId: null };
    }
    if (claim.status === "confirmed" || claim.confirmedFactId) {
      return {
        kind: "existing",
        claimId: claim.id,
        factId: claim.confirmedFactId
      };
    }
    if (turn.status === "completed") {
      return { kind: "no_eligible_claim", claimId: null, factId: null };
    }

    const factId = randomUUID();
    const pathAnchorMessageId = currentUserMessageId ?? previousAssistant.id;
    await database.journalEventFact.create({
      data: {
        id: factId,
        eventId: claim.eventId,
        createdBranchSessionId: input.activeBranchSessionId,
        pathAnchorMessageId,
        statement: claim.statement,
        scope: claim.scope,
        stance: claim.stance,
        kind: claim.kind,
        origin: "implicit_confirmation",
        evidence: {
          create: {
            sourceTurnId: turn.id,
            contextMessageId: previousAssistant.id,
            pathAnchorMessageId,
            role: "implicit_confirmation",
            quote: null
          }
        }
      }
    });
    const confirmedAt = new Date();
    const update = await database.journalEventUnderstandingClaim.updateMany({
      where: {
        id: claim.id,
        status: "pending",
        confirmedFactId: null,
        confirmedByTurnId: null,
        confirmedAt: null
      },
      data: {
        status: "confirmed",
        confirmedFactId: factId,
        confirmedByTurnId: turn.id,
        confirmedAt
      }
    });
    if (update.count !== 1) throw new Error("CLAIM_CONFIRMATION_RACE");

    return { kind: "confirmed", claimId: claim.id, factId };
}

async function confirmPendingClaimTransaction(input: {
  userTurnId: string;
  activeBranchSessionId: string;
}): Promise<ConfirmPendingUnderstandingClaimResult> {
  return prisma.$transaction((database) =>
    confirmPendingUnderstandingClaimWithClient(database, input)
  );
}

export async function confirmPendingUnderstandingClaim(
  userTurnId: string,
  activeBranchSessionId: string
): Promise<ConfirmPendingUnderstandingClaimResult> {
  try {
    return await confirmPendingClaimTransaction({ userTurnId, activeBranchSessionId });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "CLAIM_CONFIRMATION_RACE") throw error;

    const claim = await prisma.journalEventUnderstandingClaim.findFirst({
      where: { confirmedByTurnId: userTurnId },
      select: { id: true, confirmedFactId: true }
    });
    if (!claim?.confirmedFactId) throw error;
    return { kind: "existing", claimId: claim.id, factId: claim.confirmedFactId };
  }
}

function assertUnderstandingChecks(input: CommitEventCenteredTurnUnderstandingInput) {
  if (
    !input.checks.eventBoundaryPassed ||
    !input.checks.factsHaveUserSource ||
    !input.checks.visibleUnderstandingMatchesClaim ||
    input.checks.unsupportedClaimCount < 0 ||
    input.checks.unsupportedClaimCount > 1 ||
    input.checks.unsupportedClaimCount !== (input.pendingClaim ? 1 : 0)
  ) {
    throw new Error("EVENT_UNDERSTANDING_CHECK_FAILED");
  }
  assertNonEmpty(input.assistantMessage.content, "EVENT_UNDERSTANDING_CHECK_FAILED");
  assertNonEmpty(input.focusSummary, "EVENT_UNDERSTANDING_CHECK_FAILED");
  if (input.pendingClaim) {
    assertNonEmpty(input.pendingClaim.statement, "EVENT_UNDERSTANDING_CHECK_FAILED");
  }
  if (
    (input.angleOutcome && input.pendingClaim) ||
    ((input.angleOutcome || (input.angleRepairResolutions?.length ?? 0) > 0) &&
      input.checks.unsupportedClaimCount !== 0)
  ) {
    throw new Error("EVENT_ANGLE_OUTCOME_CHECK_FAILED");
  }
}

async function readExistingCommitResult(
  database: DatabaseClient,
  input: CommitEventCenteredTurnUnderstandingInput
): Promise<CommitEventCenteredTurnUnderstandingResult | null> {
  const assistantMessage = await database.interviewMessage.findFirst({
    where: {
      sessionId: input.activeBranchSessionId,
      userTurnId: input.userTurnId,
      role: "assistant"
    },
    select: {
      id: true,
      generationTraceId: true,
      generationTrace: { select: { pipelineDecisions: true } }
    }
  });
  if (!assistantMessage?.generationTraceId) return null;
  const storedFingerprint = storedUnderstandingCommitFingerprint(
    assistantMessage.generationTrace?.pipelineDecisions
  );
  if (
    storedFingerprint &&
    storedFingerprint !== getEventCenteredUnderstandingCommitFingerprint(input)
  ) {
    throw new Error("EVENT_TURN_IDEMPOTENCY_CONFLICT");
  }
  if (
    !storedFingerprint &&
    (input.angleOutcome || (input.angleRepairResolutions?.length ?? 0) > 0)
  ) {
    throw new Error("EVENT_TURN_IDEMPOTENCY_STATE_MISSING");
  }

  const [facts, claim, angleOutcomes, reopenedResolutions] = await Promise.all([
    database.journalEventFact.findMany({
      where: {
        eventId: input.eventId,
        evidence: { some: { sourceTurnId: input.userTurnId } }
      },
      select: { id: true }
    }),
    database.journalEventUnderstandingClaim.findUnique({
      where: { assistantMessageId: assistantMessage.id },
      select: { id: true }
    }),
    database.journalEventAngleOutcome.findMany({
      where: { eventId: input.eventId, assistantMessageId: assistantMessage.id },
      select: { id: true }
    }),
    database.journalEventAngleOutcomeRepairResolution.findMany({
      where: {
        resolvedMessageId: assistantMessage.id,
        decision: "reopened",
        repair: { eventId: input.eventId }
      },
      select: { repair: { select: { angle: true } } }
    })
  ]);

  return {
    kind: "existing",
    eventId: input.eventId,
    activeBranchSessionId: input.activeBranchSessionId,
    userTurnId: input.userTurnId,
    assistantMessageId: assistantMessage.id,
    generationTraceId: assistantMessage.generationTraceId,
    factIds: facts.map((fact) => fact.id),
    pendingUnderstandingClaimId: claim?.id ?? null,
    angleOutcomeIds: angleOutcomes.map((outcome) => outcome.id),
    reopenedAngles: JOURNAL_EVENT_ANGLES.filter((angle) =>
      reopenedResolutions.some((resolution) => resolution.repair.angle === angle)
    )
  };
}

export async function commitEventCenteredTurnUnderstanding(
  input: CommitEventCenteredTurnUnderstandingInput
): Promise<CommitEventCenteredTurnUnderstandingResult> {
  assertUnderstandingChecks(input);
  if (input.snapshotData) {
    try {
      validateEventCenteredDialogueStateForCommit(input.snapshotData);
    } catch {
      throw new Error("EVENT_DIALOGUE_STATE_INVALID");
    }
  }
  const requestFingerprint = getEventCenteredUnderstandingCommitFingerprint(input);

  try {
    return await prisma.$transaction(async (database) => {
    let route = await requireEventRoute(database, {
      eventId: input.eventId,
      activeBranchSessionId: input.activeBranchSessionId,
      userId: input.userId,
      requireWritable: false
    });
    if (route.branch.activeEventId !== input.branchStateId) {
      throw new Error("EVENT_STATE_CHANGED");
    }

    const turn = await database.interviewUserTurn.findUnique({
      where: { id: input.userTurnId },
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
      turn.journalEventId !== input.eventId
    ) {
      throw new Error("EVENT_TURN_NOT_FOUND");
    }
    if (turn.status === "completed") {
      const existing = await readExistingCommitResult(database, input);
      if (existing) return existing;
      throw new Error("EVENT_TURN_RESULT_MISSING");
    }
    if (turn.status !== "processing") throw new Error("EVENT_TURN_RETRY_REQUIRED");
    const currentPathMessageIds = route.path.messages.map((message) => message.id);
    const [factRevision, pendingAngleRepairs] = await Promise.all([
      database.journalEventFactRevision.findUnique({
        where: { sourceTurnId: input.userTurnId },
        select: { id: true }
      }),
      database.journalEventAngleOutcomeRepair.findMany({
        where: {
          eventId: input.eventId,
          pathAnchorMessageId: { in: currentPathMessageIds },
          resolutions: {
            none: { resolvedMessageId: { in: currentPathMessageIds } }
          }
        },
        select: { id: true }
      })
    ]);
    if (
      factRevision &&
      (input.facts.length > 0 ||
        input.pendingClaim ||
        input.checks.unsupportedClaimCount !== 0)
    ) {
      throw new Error("EVENT_CORRECTION_DERIVATION_NOT_ALLOWED");
    }
    route = await requireEventRoute(database, {
      eventId: input.eventId,
      activeBranchSessionId: input.activeBranchSessionId,
      userId: input.userId
    });

    const userMessage = turn.messages[0];
    if (!userMessage || !route.path.messages.some((message) => message.id === userMessage.id)) {
      throw new Error("EVENT_STATE_CHANGED");
    }
    const latestMessage = route.path.messages.at(-1);
    if (latestMessage?.id !== userMessage.id) throw new Error("EVENT_STATE_CHANGED");

    const effectiveMessageIds = new Set(route.path.messages.map((message) => message.id));
    const evidenceInputs = input.facts.flatMap((write) => write.evidence);
    const sourceTurnIds = Array.from(
      new Set(evidenceInputs.map((evidence) => evidence.sourceTurnId))
    );
    const sourceTurns = sourceTurnIds.length
      ? await database.interviewUserTurn.findMany({
          where: { id: { in: sourceTurnIds } },
          select: {
            id: true,
            journalEventId: true,
            rawText: true,
            messages: {
              where: { role: "user" },
              select: { id: true }
            }
          }
        })
      : [];
    const sourceTurnsById = new Map(sourceTurns.map((sourceTurn) => [sourceTurn.id, sourceTurn]));

    for (const write of input.facts) {
      if (write.operation === "create") {
        assertNonEmpty(write.statement, "EVENT_FACT_INVALID");
        if (
          !effectiveMessageIds.has(write.pathAnchorMessageId) ||
          write.evidence.length === 0 ||
          !write.evidence.some(
            (evidence) => evidence.pathAnchorMessageId === write.pathAnchorMessageId
          )
        ) {
          throw new Error("EVENT_FACT_INVALID");
        }
      }
      for (const evidence of write.evidence) {
        const sourceTurn = sourceTurnsById.get(evidence.sourceTurnId);
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
          throw new Error("EVENT_FACT_EVIDENCE_INVALID");
        }
      }
    }

    const existingFactIds = input.facts.flatMap((write) =>
      write.operation === "add_evidence" ? [write.factId] : []
    );
    const beforeProjection = await getEffectiveJournalEventFactProjectionWithClient(
      database,
      input.eventId,
      input.activeBranchSessionId
    );
    if (
      existingFactIds.some((factId) => !beforeProjection.effectiveFactIds.includes(factId)) ||
      new Set(existingFactIds).size !== existingFactIds.length
    ) {
      throw new Error("EVENT_FACT_NOT_EFFECTIVE");
    }

    const assistantMessageId = input.assistantMessage.id ?? randomUUID();
    const generationTraceId = input.trace.id ?? randomUUID();
    const pendingUnderstandingClaimId = input.pendingClaim ? randomUUID() : null;
    const createdFactIds: string[] = [];

    for (const write of input.facts) {
      const factId = write.operation === "create" ? randomUUID() : write.factId;
      if (write.operation === "create") {
        await database.journalEventFact.create({
          data: {
            id: factId,
            eventId: input.eventId,
            createdBranchSessionId: input.activeBranchSessionId,
            pathAnchorMessageId: write.pathAnchorMessageId,
            statement: write.statement.trim(),
            scope: write.scope,
            stance: write.stance,
            kind: write.kind,
            origin: write.origin
          }
        });
      }
      if (write.evidence.length > 0) {
        await database.journalEventFactEvidence.createMany({
          data: write.evidence.map((evidence) => ({
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
      createdFactIds.push(factId);
    }

    const currentProjection = await getEffectiveJournalEventFactProjectionWithClient(
      database,
      input.eventId,
      input.activeBranchSessionId
    );
    const effectiveFactIds = Array.from(
      new Set([...currentProjection.effectiveFactIds, ...createdFactIds])
    );

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
        artifactVersion: input.assistantMessage.responseVersion ?? 1,
        triggerMessageId: userMessage.id,
        status: "completed",
        outputOrigin: input.trace.outputOrigin,
        contextSnapshot: toJsonValue({
          ...input.trace.contextSnapshot,
          eventId: input.eventId,
          activeBranchSessionId: input.activeBranchSessionId,
          userTurnId: input.userTurnId,
          effectiveFactIds
        }),
        finalOutput: toJsonValue(input.trace.finalOutput),
        pipelineDecisions: toJsonValue([
          ...input.trace.pipelineDecisions,
          {
            kind: "event_centered_understanding_commit",
            requestFingerprint,
            checks: input.checks,
            writtenFactIds: createdFactIds,
            pendingUnderstandingClaimId
          }
        ]),
        completedAt: new Date()
      }
    });
    await database.interviewMessage.create({
      data: {
        id: assistantMessageId,
        sessionId: input.activeBranchSessionId,
        userTurnId: input.userTurnId,
        generationTraceId,
        responseGroupId: input.assistantMessage.responseGroupId ?? assistantMessageId,
        responseVersion: input.assistantMessage.responseVersion ?? 1,
        branchSessionId: input.activeBranchSessionId,
        role: "assistant",
        content: input.assistantMessage.content,
        sequence: userMessage.sequence + 1
      }
    });

    const shouldCommitAngleResults = Boolean(
      input.angleOutcome ||
        (input.angleRepairResolutions?.length ?? 0) > 0 ||
        pendingAngleRepairs.length > 0
    );
    const angleResult = shouldCommitAngleResults
      ? await commitJournalEventAngleResultsWithClient(database, {
          userId: input.userId,
          eventId: input.eventId,
          activeBranchSessionId: input.activeBranchSessionId,
          sourceTurnId: input.userTurnId,
          assistantMessageId,
          generationTraceId,
          createdFactIdsByWriteIndex: createdFactIds,
          angleOutcome: input.angleOutcome,
          angleRepairResolutions: input.angleRepairResolutions
        })
      : { angleOutcomeIds: [], reopenedAngles: [], resolutionFingerprint: null };
    const angleTraceDecision = angleResultTraceDecision(angleResult, input);
    if (angleTraceDecision) {
      await database.aIGenerationTrace.update({
        where: { id: generationTraceId },
        data: {
          pipelineDecisions: toJsonValue([
            ...input.trace.pipelineDecisions,
            {
              kind: "event_centered_understanding_commit",
              requestFingerprint,
              checks: input.checks,
              writtenFactIds: createdFactIds,
              pendingUnderstandingClaimId
            },
            angleTraceDecision
          ])
        }
      });
    }

    if (input.pendingClaim && pendingUnderstandingClaimId) {
      await database.journalEventUnderstandingClaim.create({
        data: {
          id: pendingUnderstandingClaimId,
          eventId: input.eventId,
          branchSessionId: input.activeBranchSessionId,
          assistantMessageId,
          statement: input.pendingClaim.statement.trim(),
          scope: input.pendingClaim.scope,
          stance: input.pendingClaim.stance,
          kind: input.pendingClaim.kind
        }
      });
    }

    const branchState = await database.interviewEvent.findFirst({
      where: {
        id: input.branchStateId,
        sessionId: input.activeBranchSessionId
      }
    });
    if (!branchState) throw new Error("EVENT_STATE_CHANGED");

    const snapshotData = {
      ...snapshotObject(branchState.snapshotData),
      ...(input.snapshotData ?? {}),
      kind: "event_centered",
      schemaVersion: 4,
      lastProcessedTurnId: input.userTurnId,
      focusSummary: input.focusSummary,
      pendingUnderstandingClaimId,
      lastAngleOutcomeIds: angleResult.angleOutcomeIds,
      reopenedAngles: angleResult.reopenedAngles,
      ...((input.angleRepairResolutions?.length ?? 0) > 0
        ? { pendingAngleOutcomeRepairIds: [], repairPendingAngles: [] }
        : {}),
      ...(input.angleOutcome ? { currentAngle: input.angleOutcome.angle } : {})
    };
    await database.interviewEvent.update({
      where: { id: branchState.id },
      data: { snapshotData: toJsonValue(snapshotData) }
    });
    await database.interviewSession.update({
      where: { id: input.activeBranchSessionId },
      data: {
        turnCount: { increment: 1 },
        ...(input.assistantMessage.lastAssistantQuestion !== undefined
          ? { lastAssistantQuestion: input.assistantMessage.lastAssistantQuestion }
          : {})
      }
    });
    await database.interviewBranchCheckpoint.create({
      data: {
        sessionId: input.activeBranchSessionId,
        messageId: assistantMessageId,
        schemaVersion: 4,
        sessionState: toJsonValue({
          mode: "event_centered",
          status: route.branch.status,
          stage: route.branch.stage,
          activeEventId: branchState.id,
          turnCount: route.branch.turnCount + 1,
          lastAssistantQuestion:
            input.assistantMessage.lastAssistantQuestion ?? route.branch.lastAssistantQuestion,
          draftSummary: route.branch.draftSummary
        }),
        eventsState: toJsonValue([
          {
            ...branchState,
            snapshotData
          }
        ])
      }
    });
    await database.interviewUserTurn.update({
      where: { id: input.userTurnId },
      data: {
        status: "completed",
        errorCode: null,
        completedAt: new Date()
      }
    });

    return {
      kind: "committed",
      eventId: input.eventId,
      activeBranchSessionId: input.activeBranchSessionId,
      userTurnId: input.userTurnId,
      assistantMessageId,
      generationTraceId,
      factIds: createdFactIds,
      pendingUnderstandingClaimId,
      angleOutcomeIds: angleResult.angleOutcomeIds,
      reopenedAngles: angleResult.reopenedAngles
    };
    }, {
      // Preview/production databases can cold-start after a two-call generation;
      // keep the atomic user-turn commit open long enough to finish the write.
      maxWait: 15_000,
      timeout: 60_000
    });
  } catch (error) {
    if (!isAngleOutcomeUniqueConflict(error)) throw error;
    const existing = await prisma.$transaction((database) =>
      readExistingCommitResult(database, input)
    );
    if (existing) return existing;
    throw error;
  }
}

export async function markEventCenteredTurnUnderstandingFailed(
  userTurnId: string,
  errorCode: string
) {
  return prisma.interviewUserTurn.updateMany({
    where: {
      id: userTurnId,
      journalEventId: { not: null },
      status: "processing"
    },
    data: {
      status: "failed",
      errorCode
    }
  });
}

export async function resumeEventCenteredTurnUnderstanding(input: {
  userId: string;
  activeBranchSessionId: string;
  clientTurnId: string;
}) {
  return prisma.$transaction(async (database) => {
    const turn = await database.interviewUserTurn.findUnique({
      where: {
        sessionId_clientTurnId: {
          sessionId: input.activeBranchSessionId,
          clientTurnId: input.clientTurnId
        }
      },
      include: {
        session: { select: { userId: true, mode: true } },
        journalEvent: { select: { id: true, status: true } }
      }
    });
    if (
      !turn ||
      turn.session.userId !== input.userId ||
      turn.session.mode !== "event_centered" ||
      !turn.journalEvent ||
      turn.journalEvent.status !== "active"
    ) {
      throw new Error("EVENT_TURN_NOT_FOUND");
    }
    if (turn.status === "processing") return turn;
    if (turn.status === "completed") return turn;
    if (turn.status !== "failed" && turn.status !== "canceled") {
      throw new Error("EVENT_TURN_RETRY_REQUIRED");
    }

    const route = await requireEventRoute(database, {
      eventId: turn.journalEvent.id,
      activeBranchSessionId: input.activeBranchSessionId,
      userId: input.userId
    });
    if (!route.path.messages.some((message) => message.userTurnId === turn.id)) {
      throw new Error("EVENT_STATE_CHANGED");
    }

    return database.interviewUserTurn.update({
      where: { id: turn.id },
      data: {
        status: "processing",
        attemptCount: { increment: 1 },
        errorCode: null,
        completedAt: null
      }
    });
  });
}
