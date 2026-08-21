import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";

import {
  EVENT_CENTERED_BACKGROUND_FACTS_TASK_CODES,
  EVENT_CENTERED_BACKGROUND_FACTS_TASK_KIND,
  hashEventCenteredBackgroundFactsValue,
  parseEventCenteredBackgroundFactsTaskContext,
  withEventCenteredBackgroundFactsGenerationInput,
  type EventCenteredBackgroundFactsTaskContext
} from "@/features/interview/event-centered/background-facts-task";
import {
  eventCenteredCompleteResponseBackgroundFactsV1OutputSchema,
  validateEventCenteredCompleteResponseBackgroundFactsV1Output,
  type EventCenteredCompleteResponseBackgroundFactsV1Input,
  type EventCenteredCompleteResponseBackgroundFactsV1Output
} from "@/features/interview/event-centered/complete-response-background-facts-v1";
import { prisma } from "@/server/db/prisma";
import { enqueueJournalEventAngleRepairsWithClient } from "@/server/repositories/journal-event-angle-repair.repository";
import {
  getEffectiveJournalEventFactProjectionForPathWithClient,
  getEffectiveJournalEventFactProjectionWithClient,
  getEventCenteredRouteWithClient
} from "@/server/repositories/journal-event-fact-revision.repository";

const STARTED_STALE_AFTER_MS = 45_000;
const MAX_PENDING_SCAN = 64;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function snapshotObject(value: Prisma.JsonValue | null | undefined) {
  return isRecord(value) ? { ...value } : {};
}

function pipelineArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? [...value] : [];
}

function taskContextOrNull(value: unknown) {
  try {
    return parseEventCenteredBackgroundFactsTaskContext(value);
  } catch {
    return null;
  }
}

function generationInputFromContext(
  context: EventCenteredBackgroundFactsTaskContext
): EventCenteredCompleteResponseBackgroundFactsV1Input {
  if (!isRecord(context.generationInput)) {
    throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_INPUT_MISSING");
  }
  const source = context.generationInput;
  if (
    !Array.isArray(source.conversation) ||
    !Array.isArray(source.pendingUserMessageIds) ||
    !Array.isArray(source.effectiveFacts) ||
    typeof source.currentVisibleAssistantMessageId !== "string" ||
    !(
      source.explicitCorrectionTargetAssistantMessageId === null ||
      typeof source.explicitCorrectionTargetAssistantMessageId === "string"
    )
  ) {
    throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_INPUT_INVALID");
  }
  return source as EventCenteredCompleteResponseBackgroundFactsV1Input;
}

export type EventCenteredBackgroundFactsClaim =
  | {
      kind: "started" | "result_ready";
      traceId: string;
      sessionId: string;
      eventId: string;
      context: EventCenteredBackgroundFactsTaskContext;
    }
  | { kind: "busy"; traceId: string }
  | null;

export async function claimNextEventCenteredBackgroundFactsTask(input: {
  userId: string;
  sessionId: string;
  now?: Date;
}): Promise<EventCenteredBackgroundFactsClaim> {
  const now = input.now ?? new Date();
  for (let pass = 0; pass < MAX_PENDING_SCAN; pass += 1) {
    const traces = await prisma.aIGenerationTrace.findMany({
      where: {
        userId: input.userId,
        sessionId: input.sessionId,
        artifactType: "interview_turn",
        status: "pending"
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: MAX_PENDING_SCAN,
      select: {
        id: true,
        sessionId: true,
        journalEventId: true,
        status: true,
        errorCode: true,
        contextSnapshot: true,
        updatedAt: true
      }
    });
    const trace = traces.find(
      (candidate) => taskContextOrNull(candidate.contextSnapshot)?.kind ===
        EVENT_CENTERED_BACKGROUND_FACTS_TASK_KIND
    );
    if (!trace) return null;
    const context = parseEventCenteredBackgroundFactsTaskContext(trace.contextSnapshot);
    if (!trace.sessionId || !trace.journalEventId) {
      await prisma.aIGenerationTrace.updateMany({
        where: { id: trace.id, status: "pending" },
        data: {
          status: "failed",
          errorCode: "EVENT_CENTERED_BACKGROUND_FACTS_IDENTITY_INVALID",
          failedAt: now
        }
      });
      continue;
    }
    if (trace.errorCode === EVENT_CENTERED_BACKGROUND_FACTS_TASK_CODES.resultReady) {
      return {
        kind: "result_ready",
        traceId: trace.id,
        sessionId: trace.sessionId,
        eventId: trace.journalEventId,
        context
      };
    }
    if (trace.errorCode === EVENT_CENTERED_BACKGROUND_FACTS_TASK_CODES.started) {
      if (now.getTime() - trace.updatedAt.getTime() <= STARTED_STALE_AFTER_MS) {
        return { kind: "busy", traceId: trace.id };
      }
      await prisma.aIGenerationTrace.updateMany({
        where: {
          id: trace.id,
          status: "pending",
          errorCode: EVENT_CENTERED_BACKGROUND_FACTS_TASK_CODES.started,
          updatedAt: trace.updatedAt
        },
        data: {
          status: "failed",
          errorCode: "EVENT_CENTERED_BACKGROUND_FACTS_CALL_INTERRUPTED",
          failedAt: now
        }
      });
      continue;
    }
    if (trace.errorCode !== null) {
      await prisma.aIGenerationTrace.updateMany({
        where: { id: trace.id, status: "pending", errorCode: trace.errorCode },
        data: {
          status: "failed",
          errorCode: "EVENT_CENTERED_BACKGROUND_FACTS_STATE_INVALID",
          failedAt: now
        }
      });
      continue;
    }
    const claimed = await prisma.aIGenerationTrace.updateMany({
      where: { id: trace.id, status: "pending", errorCode: null },
      data: { errorCode: EVENT_CENTERED_BACKGROUND_FACTS_TASK_CODES.started }
    });
    if (claimed.count !== 1) continue;
    return {
      kind: "started",
      traceId: trace.id,
      sessionId: trace.sessionId,
      eventId: trace.journalEventId,
      context,
    };
  }
  throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_QUEUE_SCAN_EXHAUSTED");
}

export async function prepareEventCenteredBackgroundFactsGenerationInput(input: {
  traceId: string;
  userId: string;
  preparedAt?: Date;
}) {
  return prisma.$transaction(async (database) => {
    const trace = await database.aIGenerationTrace.findFirst({
      where: {
        id: input.traceId,
        userId: input.userId,
        status: "pending",
        errorCode: EVENT_CENTERED_BACKGROUND_FACTS_TASK_CODES.started
      },
      select: {
        id: true,
        sessionId: true,
        journalEventId: true,
        contextSnapshot: true
      }
    });
    if (!trace?.sessionId || !trace.journalEventId) {
      throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_TASK_NOT_CLAIMED");
    }
    const context = parseEventCenteredBackgroundFactsTaskContext(
      trace.contextSnapshot
    );
    const route = await getEventCenteredRouteWithClient(database, {
      eventId: trace.journalEventId,
      activeBranchSessionId: trace.sessionId,
      userId: input.userId
    });
    if (route.branch.activeEventId !== context.branchStateId) {
      throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_WRITE_AUTHORITY_LOST");
    }
    const assistantIndex = route.path.messages.findIndex(
      (message) => message.id === context.currentVisibleAssistantMessageId
    );
    const sourceIndex = route.path.messages.findIndex(
      (message) =>
        message.id === context.sourceUserMessageId && message.role === "user"
    );
    if (sourceIndex < 0 || assistantIndex !== sourceIndex + 1) {
      throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_WRITE_AUTHORITY_LOST");
    }
    const prefix = route.path.messages.slice(0, assistantIndex + 1);
    const prefixIds = new Set(prefix.map((message) => message.id));
    if (
      context.conversation.some((message) => !prefixIds.has(message.id)) ||
      context.conversation.at(-1)?.id !== context.currentVisibleAssistantMessageId ||
      !context.conversation.some(
        (message) => message.id === context.sourceUserMessageId && message.role === "user"
      )
    ) {
      throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_CONTEXT_INVALID");
    }
    const branchState = await database.interviewEvent.findUnique({
      where: { id: context.branchStateId },
      select: { snapshotData: true }
    });
    if (!branchState) {
      throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_WRITE_AUTHORITY_LOST");
    }
    const factProjection = await getEffectiveJournalEventFactProjectionForPathWithClient(
      database,
      {
        eventId: trace.journalEventId,
        messageIds: prefix.map((message) => message.id),
        snapshotData: branchState.snapshotData
      }
    );
    const generationInput: EventCenteredCompleteResponseBackgroundFactsV1Input = {
      conversation: context.conversation,
      pendingUserMessageIds: context.pendingUserMessageIds,
      effectiveFacts: factProjection.facts.map((fact) => ({
        id: fact.id,
        statement: fact.statement,
        sourceUserMessageId:
          fact.evidence.find((evidence) => evidence.pathAnchorMessageId)?.pathAnchorMessageId ??
          null
      })),
      currentVisibleAssistantMessageId: context.currentVisibleAssistantMessageId,
      explicitCorrectionTargetAssistantMessageId:
        context.explicitCorrectionTargetAssistantMessageId
    };
    const preparedContext = withEventCenteredBackgroundFactsGenerationInput({
      context,
      generationInput,
      preparedAt: (input.preparedAt ?? new Date()).toISOString()
    });
    const updated = await database.aIGenerationTrace.updateMany({
      where: {
        id: trace.id,
        status: "pending",
        errorCode: EVENT_CENTERED_BACKGROUND_FACTS_TASK_CODES.started
      },
      data: { contextSnapshot: toJsonValue(preparedContext) }
    });
    if (updated.count !== 1) {
      throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_TASK_STATE_CHANGED");
    }
    return { traceId: trace.id, sessionId: trace.sessionId, generationInput };
  });
}

export async function saveEventCenteredBackgroundFactsResult(input: {
  traceId: string;
  userId: string;
  responseContent: string;
  output: EventCenteredCompleteResponseBackgroundFactsV1Output;
  diagnostics: Record<string, unknown> | null;
}) {
  return prisma.$transaction(async (database) => {
    const trace = await database.aIGenerationTrace.findFirst({
      where: {
        id: input.traceId,
        userId: input.userId,
        status: "pending",
        errorCode: EVENT_CENTERED_BACKGROUND_FACTS_TASK_CODES.started
      },
      select: { id: true, contextSnapshot: true, pipelineDecisions: true }
    });
    if (!trace) throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_TASK_STATE_CHANGED");
    const context = parseEventCenteredBackgroundFactsTaskContext(trace.contextSnapshot);
    const generationInput = generationInputFromContext(context);
    const issues = validateEventCenteredCompleteResponseBackgroundFactsV1Output({
      generationInput,
      output: input.output
    });
    if (issues.length > 0) {
      throw new Error(`EVENT_CENTERED_BACKGROUND_FACTS_CONTRACT_INVALID:${issues.join(",")}`);
    }
    await database.aIGenerationTrace.update({
      where: { id: trace.id },
      data: {
        outputOrigin: "llm",
        errorCode: EVENT_CENTERED_BACKGROUND_FACTS_TASK_CODES.resultReady,
        finalOutput: toJsonValue({
          kind: "event_centered_background_facts_result_v1",
          responseContent: input.responseContent,
          responseHash: createHash("sha256")
            .update(input.responseContent)
            .digest("hex"),
          output: input.output,
          outputHash: hashEventCenteredBackgroundFactsValue(input.output),
          diagnostics: input.diagnostics
        }),
        pipelineDecisions: toJsonValue([
          ...pipelineArray(trace.pipelineDecisions),
          {
            kind: "event_centered_background_facts_result_saved",
            generationInputHash: context.generationInputHash,
            outputHash: hashEventCenteredBackgroundFactsValue(input.output)
          }
        ])
      }
    });
  });
}

function mapFactScope(scope: "current_event" | "cross_event_pattern") {
  return scope === "cross_event_pattern" ? "background" as const : "current_event" as const;
}

function parseStoredOutput(value: Prisma.JsonValue | null) {
  if (!isRecord(value) || !isRecord(value.output)) {
    throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_RESULT_MISSING");
  }
  return eventCenteredCompleteResponseBackgroundFactsV1OutputSchema.parse(value.output);
}

function revisionFingerprint(input: {
  traceId: string;
  output: EventCenteredCompleteResponseBackgroundFactsV1Output;
}) {
  return createHash("sha256")
    .update(JSON.stringify({ traceId: input.traceId, corrections: input.output.corrections }))
    .digest("hex");
}

export async function applyEventCenteredBackgroundFactsResult(input: {
  traceId: string;
  userId: string;
}) {
  return prisma.$transaction(async (database) => {
    const claimed = await database.aIGenerationTrace.updateMany({
      where: {
        id: input.traceId,
        userId: input.userId,
        status: "pending",
        errorCode: EVENT_CENTERED_BACKGROUND_FACTS_TASK_CODES.resultReady
      },
      data: { errorCode: "EVENT_CENTERED_BACKGROUND_FACTS_APPLYING" }
    });
    if (claimed.count !== 1) return { kind: "not_claimed" as const };
    const trace = await database.aIGenerationTrace.findUnique({
      where: { id: input.traceId },
      select: {
        id: true,
        sessionId: true,
        journalEventId: true,
        contextSnapshot: true,
        finalOutput: true,
        pipelineDecisions: true
      }
    });
    if (!trace?.sessionId || !trace.journalEventId) {
      throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_IDENTITY_INVALID");
    }
    const context = parseEventCenteredBackgroundFactsTaskContext(trace.contextSnapshot);
    const generationInput = generationInputFromContext(context);
    const output = parseStoredOutput(trace.finalOutput);
    const issues = validateEventCenteredCompleteResponseBackgroundFactsV1Output({
      generationInput,
      output
    });
    if (issues.length > 0) {
      throw new Error(`EVENT_CENTERED_BACKGROUND_FACTS_CONTRACT_INVALID:${issues.join(",")}`);
    }
    if (output.corrections.length > 1) {
      throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_MULTIPLE_CORRECTIONS_UNSUPPORTED");
    }
    const route = await getEventCenteredRouteWithClient(database, {
      eventId: trace.journalEventId,
      activeBranchSessionId: trace.sessionId,
      userId: input.userId
    });
    if (route.branch.activeEventId !== context.branchStateId) {
      throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_WRITE_AUTHORITY_LOST");
    }
    const assistantIndex = route.path.messages.findIndex(
      (message) => message.id === context.currentVisibleAssistantMessageId
    );
    const sourceIndex = route.path.messages.findIndex(
      (message) => message.id === context.sourceUserMessageId && message.role === "user"
    );
    if (sourceIndex < 0 || assistantIndex !== sourceIndex + 1) {
      throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_WRITE_AUTHORITY_LOST");
    }
    const prefix = route.path.messages.slice(0, assistantIndex + 1);
    const prefixIds = new Set(prefix.map((message) => message.id));
    const branchState = await database.interviewEvent.findUnique({
      where: { id: context.branchStateId }
    });
    if (!branchState) {
      throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_WRITE_AUTHORITY_LOST");
    }
    const before = await getEffectiveJournalEventFactProjectionForPathWithClient(
      database,
      {
        eventId: trace.journalEventId,
        messageIds: prefix.map((message) => message.id),
        snapshotData: branchState.snapshotData
      }
    );
    const sourceMessages = output.processedUserMessageIds.map((messageId) =>
      prefix.find((message) => message.id === messageId && message.role === "user")
    );
    if (sourceMessages.some((message) => !message?.userTurnId)) {
      throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_SOURCE_INVALID");
    }
    const sourceTurnIds = sourceMessages.map((message) => message!.userTurnId!);
    const sourceTurns = await database.interviewUserTurn.findMany({
      where: { id: { in: sourceTurnIds } },
      select: { id: true, sessionId: true, journalEventId: true, rawText: true }
    });
    const turnsById = new Map(sourceTurns.map((turn) => [turn.id, turn]));
    const sourceByMessageId = new Map(
      sourceMessages.map((message) => [message!.id, turnsById.get(message!.userTurnId!)])
    );
    for (const delta of output.factDeltas) {
      const source = sourceByMessageId.get(delta.sourceUserMessageId);
      if (
        !source ||
        source.sessionId !== trace.sessionId ||
        source.journalEventId !== trace.journalEventId ||
        !source.rawText?.includes(delta.quote)
      ) {
        throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_SOURCE_INVALID");
      }
    }
    const correction = output.corrections[0] ?? null;
    if (correction) {
      const source = sourceByMessageId.get(correction.sourceUserMessageId);
      if (!source?.rawText?.includes(correction.quote)) {
        throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_SOURCE_INVALID");
      }
      const existingRevision = await database.journalEventFactRevision.findUnique({
        where: { sourceTurnId: source.id },
        select: { id: true }
      });
      if (existingRevision) {
        throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_REVISION_ALREADY_EXISTS");
      }
    }

    const revisionId = correction ? randomUUID() : null;
    const effectiveFactsByKey = new Map(
      before.facts.map((fact) => [
        JSON.stringify([fact.statement.trim(), fact.scope, fact.stance, fact.kind]),
        fact
      ])
    );
    const newRefToFactId = new Map<string, string>();
    const writtenFactIds: string[] = [];
    for (const [index, delta] of output.factDeltas.entries()) {
      const sourceMessage = prefix.find(
        (message) => message.id === delta.sourceUserMessageId && message.role === "user"
      );
      const sourceTurn = sourceByMessageId.get(delta.sourceUserMessageId);
      if (!sourceMessage?.userTurnId || !sourceTurn) {
        throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_SOURCE_INVALID");
      }
      const scope = mapFactScope(delta.scope);
      const key = JSON.stringify([delta.statement.trim(), scope, delta.stance, delta.kind]);
      const existing = effectiveFactsByKey.get(key);
      const factId = existing?.id ?? randomUUID();
      newRefToFactId.set(`new:${index + 1}`, factId);
      if (!existing) {
        await database.journalEventFact.create({
          data: {
            id: factId,
            eventId: trace.journalEventId,
            createdBranchSessionId: trace.sessionId,
            pathAnchorMessageId: sourceMessage.id,
            createdByRevisionId: null,
            statement: delta.statement.trim(),
            scope,
            stance: delta.stance,
            kind: delta.kind,
            origin: "user_expression"
          }
        });
        writtenFactIds.push(factId);
      }
      await database.journalEventFactEvidence.createMany({
        data: [{
          id: randomUUID(),
          factId,
          sourceTurnId: sourceTurn.id,
          contextMessageId: null,
          pathAnchorMessageId: sourceMessage.id,
          role: "direct_expression",
          quote: delta.quote
        }],
        skipDuplicates: true
      });
    }

    let revisionTargetIds: string[] = [];
    let rejectedClaimId: string | null = null;
    let angleRepairIds: string[] = [];
    let repairPendingAngles: string[] = [];
    if (correction && revisionId) {
      const sourceMessage = prefix.find(
        (message) => message.id === correction.sourceUserMessageId && message.role === "user"
      );
      const sourceTurn = sourceByMessageId.get(correction.sourceUserMessageId);
      if (!sourceMessage?.userTurnId || !sourceTurn) {
        throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_SOURCE_INVALID");
      }
      const effectiveFactIds = new Set(before.effectiveFactIds);
      const targets = correction.targets.map((target) => ({
        factId: newRefToFactId.get(target.ref) ?? target.ref,
        relation: target.relation
      }));
      if (targets.some((target) => !effectiveFactIds.has(target.factId))) {
        throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_TARGET_NOT_EFFECTIVE");
      }
      const assistantRefs = correction.supersededAssistantMessageIds;
      if (assistantRefs.some((messageId) =>
        !prefixIds.has(messageId) ||
        prefix.find((message) => message.id === messageId)?.role !== "assistant"
      )) {
        throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_ASSISTANT_SOURCE_INVALID");
      }
      const claims = assistantRefs.length
        ? await database.journalEventUnderstandingClaim.findMany({
            where: {
              eventId: trace.journalEventId,
              assistantMessageId: { in: assistantRefs },
              status: "pending"
            },
            select: { id: true }
          })
        : [];
      if (claims.length > 1) {
        throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_MULTIPLE_CLAIMS_UNSUPPORTED");
      }
      rejectedClaimId = claims[0]?.id ?? null;
      await database.journalEventFactRevision.create({
        data: {
          id: revisionId,
          eventId: trace.journalEventId,
          branchSessionId: trace.sessionId,
          sourceTurnId: sourceTurn.id,
          clarificationSourceTurnId: null,
          pathAnchorMessageId: sourceMessage.id,
          contextMessageId: assistantRefs[0] ?? null,
          quote: correction.quote,
          requestFingerprint: revisionFingerprint({ traceId: trace.id, output }),
          decisionTraceId: trace.id
        }
      });
      if (targets.length > 0) {
        await database.journalEventFactRevisionTarget.createMany({
          data: targets.map((target) => ({
            id: randomUUID(),
            revisionId,
            targetFactId: target.factId,
            relation: target.relation
          }))
        });
      }
      revisionTargetIds = targets.map((target) => target.factId);
      if (rejectedClaimId) {
        const rejected = await database.journalEventUnderstandingClaim.updateMany({
          where: { id: rejectedClaimId, status: "pending" },
          data: {
            status: "rejected",
            rejectedByRevisionId: revisionId,
            rejectedByTurnId: sourceTurn.id,
            rejectedAt: new Date()
          }
        });
        if (rejected.count !== 1) {
          throw new Error("EVENT_CENTERED_BACKGROUND_FACTS_CLAIM_REJECTION_RACE");
        }
      }
      const repairs = await enqueueJournalEventAngleRepairsWithClient(database, {
        eventId: trace.journalEventId,
        activeBranchSessionId: trace.sessionId,
        factRevisionId: revisionId,
        pathAnchorMessageId: sourceMessage.id,
        effectiveMessageIds: prefix.map((message) => message.id),
        effectiveFactIdsBefore: before.effectiveFactIds,
        invalidatedFactIds: targets.map((target) => target.factId),
        targetOutcomeMessageId: null
      });
      angleRepairIds = repairs.repairIds;
      repairPendingAngles = repairs.repairPendingAngles;
    }

    const after = await getEffectiveJournalEventFactProjectionWithClient(
      database,
      trace.journalEventId,
      trace.sessionId
    );
    const nextSnapshot = {
      ...snapshotObject(branchState.snapshotData),
      kind: "event_centered",
      schemaVersion: 4,
      lastBackgroundFactsTraceId: trace.id,
      ...(revisionId
        ? {
            lastFactRevisionId: revisionId,
            lastFactRevisionTurnId: context.sourceTurnId,
            invalidatedFactIds: after.invalidatedFactIds,
            deprioritizedFactIds: after.deprioritizedFactIds,
            pendingAngleOutcomeRepairIds: angleRepairIds,
            repairPendingAngles,
            ...(rejectedClaimId ? { pendingUnderstandingClaimId: null } : {})
          }
        : {})
    };
    await database.interviewEvent.update({
      where: { id: branchState.id },
      data: { snapshotData: toJsonValue(nextSnapshot) }
    });
    await database.aIGenerationTrace.update({
      where: { id: trace.id },
      data: {
        status: "completed",
        errorCode: null,
        completedAt: new Date(),
        finalOutput: toJsonValue({
          ...(isRecord(trace.finalOutput) ? trace.finalOutput : {}),
          applied: {
            writtenFactIds,
            revisionId,
            revisionTargetIds,
            rejectedClaimId,
            angleRepairIds,
            effectiveFactIds: after.effectiveFactIds
          }
        }),
        pipelineDecisions: toJsonValue([
          ...pipelineArray(trace.pipelineDecisions),
          {
            kind: "event_centered_background_facts_applied",
            writtenFactIds,
            revisionId,
            revisionTargetIds,
            rejectedClaimId,
            angleRepairIds
          }
        ])
      }
    });
    return {
      kind: "applied" as const,
      traceId: trace.id,
      writtenFactIds,
      revisionId,
      rejectedClaimId
    };
  }, { maxWait: 15_000, timeout: 60_000 });
}

export async function failEventCenteredBackgroundFactsTask(input: {
  traceId: string;
  userId: string;
  errorCode: string;
  canceled?: boolean;
}) {
  return prisma.aIGenerationTrace.updateMany({
    where: { id: input.traceId, userId: input.userId, status: "pending" },
    data: {
      status: input.canceled ? "canceled" : "failed",
      errorCode: input.errorCode.slice(0, 160),
      failedAt: new Date()
    }
  });
}
