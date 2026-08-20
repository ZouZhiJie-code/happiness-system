import { Prisma } from "@prisma/client";

import { CURRENT_PRIVACY_POLICY_VERSION, hasCurrentAIQualityConsent } from "@/features/ai-feedback/feedback-config";
import { formatEntryDate } from "@/features/interview/entry-date";
import {
  isGoldenSetV2AuthorizedSourceActive,
  type GoldenSetV2AuthorizedSource
} from "@/features/journal-evaluation/golden-set-v2-contract";
import { prisma } from "@/server/db/prisma";

export type JournalGoldenSetV2RecordMode = "capture" | "chat";

export type JournalGoldenSetV2CaseMetadata = {
  caseId: string;
  recordMode: JournalGoldenSetV2RecordMode;
  entryDate: string;
  rootStatus: string;
  eventStatus: string;
  eventCardStatus: string;
  dailyJournalStatus: string;
  sessionCount: number;
  userTurnCount: number;
  messageCount: number;
  eventCardContentRevision: number;
  dailyJournalContentRevision: number;
  eventCardEdited: boolean;
  dailyJournalEdited: boolean;
  eventCardSavedAt: string | null;
  dailyJournalSavedAt: string | null;
  lastActivityAt: string;
};

export type ListJournalGoldenSetV2CaseMetadataInput = {
  authorizedSources: readonly GoldenSetV2AuthorizedSource[];
  recordMode?: JournalGoldenSetV2RecordMode;
  limit: number;
  cursorRootSessionRef?: string;
  checkedAt: Date;
};

export type ListJournalGoldenSetV2CaseMetadataResult = {
  cases: JournalGoldenSetV2CaseMetadata[];
  nextCursor: string | null;
};

export class JournalGoldenSetV2RepositoryError extends Error {
  constructor(
    readonly code: "JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND"
  ) {
    super(code);
    this.name = "JournalGoldenSetV2RepositoryError";
  }
}

function normalizeRecordMode(value: "capture" | "chat" | null): JournalGoldenSetV2RecordMode {
  return value === "capture" ? "capture" : "chat";
}

type ConsentIdentity = {
  id: string;
  username: string;
  aiQualityConsentVersion: string | null;
  aiQualityConsentAt: Date | null;
  aiQualityConsentRevokedAt: Date | null;
};

function consentMatchesAuthorizedSource(
  user: ConsentIdentity,
  authorizedSource: GoldenSetV2AuthorizedSource,
  checkedAt: Date
) {
  return isGoldenSetV2AuthorizedSourceActive(authorizedSource, checkedAt)
    && user.id === authorizedSource.source.userIdRef
    && user.username === authorizedSource.source.username
    && authorizedSource.authorization.privateSubjectRef === user.id
    && authorizedSource.authorization.consentPolicyVersion === CURRENT_PRIVACY_POLICY_VERSION
    && user.aiQualityConsentVersion === authorizedSource.authorization.consentPolicyVersion
    && user.aiQualityConsentAt?.getTime() === Date.parse(authorizedSource.authorization.consentAt)
    && hasCurrentAIQualityConsent(user);
}

function uniqueById<T extends { id: string }>(rows: readonly T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function compareDateAndId(
  left: { createdAt: Date; id: string },
  right: { createdAt: Date; id: string }
) {
  return left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
}

function replacePrivateReference<T>(
  value: T,
  privateReference: string,
  publicReference: string
): T {
  if (typeof value === "string") {
    return value.replaceAll(privateReference, publicReference) as T;
  }
  if (value instanceof Date || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) =>
      replacePrivateReference(item, privateReference, publicReference)
    ) as T;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key.replaceAll(privateReference, publicReference),
      replacePrivateReference(child, privateReference, publicReference)
    ])
  ) as T;
}

function withoutPrivateOwnershipIds<
  T extends { userId: string; rootSessionId: string | null }
>(value: T): Omit<T, "userId" | "rootSessionId"> {
  const copy = { ...value } as Partial<T>;
  delete copy.userId;
  delete copy.rootSessionId;
  return copy as Omit<T, "userId" | "rootSessionId">;
}

/**
 * This query deliberately selects metadata only. User text, message content,
 * journal content, source snapshots, and revision bodies are absent from the
 * Prisma selection and therefore cannot cross the shortlist boundary.
 */
export async function listJournalGoldenSetV2CaseMetadata(
  input: ListJournalGoldenSetV2CaseMetadataInput
): Promise<ListJournalGoldenSetV2CaseMetadataResult> {
  if (input.authorizedSources.length === 0) {
    return { cases: [], nextCursor: null };
  }

  const authorizedByRoot = new Map(
    input.authorizedSources.map((authorizedSource) => [
      authorizedSource.source.rootSessionRef,
      authorizedSource
    ])
  );
  const scanLimit = Math.min(
    Math.max(input.limit * 5, input.limit + 1),
    input.authorizedSources.length
  );
  const roots = await prisma.interviewSession.findMany({
    where: {
      id: { in: [...authorizedByRoot.keys()] },
      mode: "event_centered",
      parentSessionId: null,
      branchDepth: 0,
      rootSessionId: { not: null },
      status: "completed",
      ...(input.recordMode === "capture"
        ? { recordMode: "capture" as const }
        : input.recordMode === "chat"
          ? { OR: [{ recordMode: "chat" as const }, { recordMode: null }] }
          : {}),
      user: {
        aiQualityConsentVersion: CURRENT_PRIVACY_POLICY_VERSION,
        aiQualityConsentAt: { not: null },
        aiQualityConsentRevokedAt: null,
        journalDailyEntries: { some: { status: "saved" } }
      },
      journalEvent: {
        is: {
          status: "completed",
          entry: { is: { status: "saved" } }
        }
      }
    },
    select: {
      id: true,
      userId: true,
      rootSessionId: true,
      recordMode: true,
      status: true,
      entryDate: true,
      lastActivityAt: true,
      rootBranches: {
        select: { id: true, userId: true, rootSessionId: true, entryDate: true }
      },
      _count: { select: { messages: true, userTurns: true } },
      journalEvent: {
        select: {
          id: true,
          userId: true,
          entryDate: true,
          status: true,
          entry: {
            select: {
              id: true,
              status: true,
              contentRevision: true,
              editedAt: true,
              savedAt: true
            }
          }
        }
      },
      user: {
        select: {
          id: true,
          username: true,
          aiQualityConsentVersion: true,
          aiQualityConsentAt: true,
          aiQualityConsentRevokedAt: true,
          journalDailyEntries: {
            where: { status: "saved" },
            select: {
              entryDate: true,
              status: true,
              contentRevision: true,
              editedAt: true,
              savedAt: true,
              sourceEntryIds: true,
              sourceEventIds: true
            },
            orderBy: [{ entryDate: "desc" }, { id: "desc" }]
          }
        }
      }
    },
    orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
    take: scanLimit + 1,
    ...(input.cursorRootSessionRef
      ? { cursor: { id: input.cursorRootSessionRef }, skip: 1 }
      : {})
  });

  const cases: JournalGoldenSetV2CaseMetadata[] = [];
  const seenCaseIds = new Set<string>();
  let processedCount = 0;
  let lastProcessedCaseId: string | null = null;

  for (const root of roots.slice(0, scanLimit)) {
    processedCount += 1;
    const authorizedSource = authorizedByRoot.get(root.id);
    lastProcessedCaseId = authorizedSource?.caseId ?? null;

    if (
      !authorizedSource
      || root.rootSessionId !== root.id
      || seenCaseIds.has(authorizedSource.caseId)
      || root.userId !== authorizedSource.source.userIdRef
      || formatEntryDate(root.entryDate) !== authorizedSource.source.entryDate
      || normalizeRecordMode(root.recordMode) !== authorizedSource.source.recordMode
      || !consentMatchesAuthorizedSource(root.user, authorizedSource, input.checkedAt)
      || root.rootBranches.some(
        (branch) =>
          branch.userId !== authorizedSource.source.userIdRef
          || branch.rootSessionId !== root.id
          || branch.entryDate.getTime() !== root.entryDate.getTime()
      )
    ) continue;
    const journalEvent = root.journalEvent;
    const eventEntry = journalEvent?.entry;
    const dailyEntry = root.user.journalDailyEntries.find(
      (entry) => entry.entryDate.getTime() === root.entryDate.getTime()
    );
    if (
      !journalEvent
      || !eventEntry
      || !dailyEntry
      || journalEvent.userId !== authorizedSource.source.userIdRef
      || journalEvent.entryDate.getTime() !== root.entryDate.getTime()
      || !dailyEntry.sourceEntryIds.includes(eventEntry.id)
      || !dailyEntry.sourceEventIds.includes(journalEvent.id)
    ) continue;

    seenCaseIds.add(authorizedSource.caseId);
    cases.push({
      caseId: authorizedSource.caseId,
      recordMode: normalizeRecordMode(root.recordMode),
      entryDate: formatEntryDate(root.entryDate),
      rootStatus: root.status,
      eventStatus: journalEvent.status,
      eventCardStatus: eventEntry.status,
      dailyJournalStatus: dailyEntry.status,
      sessionCount: new Set([root.id, ...root.rootBranches.map((branch) => branch.id)]).size,
      userTurnCount: root._count.userTurns,
      messageCount: root._count.messages,
      eventCardContentRevision: eventEntry.contentRevision,
      dailyJournalContentRevision: dailyEntry.contentRevision,
      eventCardEdited: Boolean(eventEntry.editedAt),
      dailyJournalEdited: Boolean(dailyEntry.editedAt),
      eventCardSavedAt: eventEntry.savedAt?.toISOString() ?? null,
      dailyJournalSavedAt: dailyEntry.savedAt?.toISOString() ?? null,
      lastActivityAt: root.lastActivityAt.toISOString()
    });

    if (cases.length === input.limit) break;
  }

  return {
    cases,
    nextCursor: roots.length > processedCount ? lastProcessedCaseId : null
  };
}

export type ReadJournalGoldenSetV2CaseDetailInput = {
  authorizedSource: GoldenSetV2AuthorizedSource;
  adminUsername: string;
};

export type JournalGoldenSetV2ConsentUserLock = (
  database: Prisma.TransactionClient,
  userId: string
) => Promise<boolean>;

export async function lockJournalGoldenSetV2ConsentUser(
  database: Prisma.TransactionClient,
  userId: string
) {
  const rows = await database.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR SHARE`
  );
  return rows.length === 1;
}

export async function readJournalGoldenSetV2CaseDetail(
  input: ReadJournalGoldenSetV2CaseDetailInput,
  dependencies: {
    lockConsentUser?: JournalGoldenSetV2ConsentUserLock;
    now?: () => Date;
  } = {}
) {
  const lockConsentUser = dependencies.lockConsentUser ?? lockJournalGoldenSetV2ConsentUser;
  const now = dependencies.now ?? (() => new Date());
  return prisma.$transaction(
    async (database) => {
      const identity = await database.interviewSession.findUnique({
        where: { id: input.authorizedSource.source.rootSessionRef },
        select: {
          id: true,
          userId: true,
          mode: true,
          parentSessionId: true,
          branchDepth: true,
          rootSessionId: true,
          entryDate: true,
          recordMode: true,
          status: true
        }
      });

      if (
        !identity ||
        identity.mode !== "event_centered" ||
        identity.parentSessionId !== null ||
        identity.branchDepth !== 0 ||
        identity.rootSessionId !== identity.id ||
        identity.status !== "completed" ||
        identity.id !== input.authorizedSource.source.rootSessionRef ||
        identity.userId !== input.authorizedSource.source.userIdRef ||
        formatEntryDate(identity.entryDate) !== input.authorizedSource.source.entryDate ||
        normalizeRecordMode(identity.recordMode) !== input.authorizedSource.source.recordMode
      ) {
        throw new JournalGoldenSetV2RepositoryError("JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND");
      }

      if (!await lockConsentUser(database, identity.userId)) {
        throw new JournalGoldenSetV2RepositoryError("JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND");
      }

      const checkedAt = now();
      const lockedConsent = await database.user.findUnique({
        where: { id: identity.userId },
        select: {
          id: true,
          username: true,
          aiQualityConsentVersion: true,
          aiQualityConsentAt: true,
          aiQualityConsentRevokedAt: true
        }
      });
      if (
        !lockedConsent
        || !consentMatchesAuthorizedSource(lockedConsent, input.authorizedSource, checkedAt)
      ) {
        throw new JournalGoldenSetV2RepositoryError("JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND");
      }

      const sessions = await database.interviewSession.findMany({
        where: {
          mode: "event_centered",
          OR: [{ id: identity.id }, { rootSessionId: identity.id }]
        },
        select: {
          id: true,
          userId: true,
          rootSessionId: true,
          parentSessionId: true,
          activeBranchSessionId: true,
          entryDate: true,
          branchDepth: true,
          forkMessageSequence: true,
          forkedFromMessageId: true,
          recordMode: true,
          status: true,
          stage: true,
          activeEventId: true,
          turnCount: true,
          startedAt: true,
          pausedAt: true,
          completedAt: true,
          lastActivityAt: true
        },
        orderBy: [{ branchDepth: "asc" }, { startedAt: "asc" }, { id: "asc" }]
      });
      const uniqueSessions = uniqueById(sessions);
      if (
        uniqueSessions.length === 0
        || uniqueSessions.some((session) =>
          session.userId !== identity.userId
          || session.entryDate.getTime() !== identity.entryDate.getTime()
          || (
            session.id === identity.id
              ? session.rootSessionId !== identity.id || session.parentSessionId !== null
              : session.rootSessionId !== identity.id
          )
        )
      ) {
        throw new JournalGoldenSetV2RepositoryError("JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND");
      }
      const sessionIds = uniqueSessions.map((session) => session.id);
      const sessionIdSet = new Set(sessionIds);
      if (uniqueSessions.some(
        (session) => (session.id !== identity.id && !session.parentSessionId)
          || Boolean(session.parentSessionId && !sessionIdSet.has(session.parentSessionId))
          || Boolean(
            session.activeBranchSessionId
            && !sessionIdSet.has(session.activeBranchSessionId)
          )
      )) {
        throw new JournalGoldenSetV2RepositoryError("JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND");
      }

      const messages = await database.interviewMessage.findMany({
        where: {
          sessionId: { in: sessionIds }
        },
        select: {
          id: true,
          sessionId: true,
          branchSessionId: true,
          userTurnId: true,
          generationTraceId: true,
          responseGroupId: true,
          responseVersion: true,
          regenerationIntent: true,
          regeneratedFromMessageId: true,
          role: true,
          inputMode: true,
          content: true,
          sequence: true,
          createdAt: true
        },
        orderBy: [{ createdAt: "asc" }, { sequence: "asc" }, { id: "asc" }]
      });
      if (messages.some(
        (message) =>
          !sessionIdSet.has(message.sessionId)
          || Boolean(message.branchSessionId && !sessionIdSet.has(message.branchSessionId))
      )) {
        throw new JournalGoldenSetV2RepositoryError("JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND");
      }

      const userTurns = await database.interviewUserTurn.findMany({
        where: { sessionId: { in: sessionIds } },
        select: {
          id: true,
          clientTurnId: true,
          sessionId: true,
          journalEventId: true,
          activeEventId: true,
          action: true,
          targetMessageId: true,
          regenerationIntent: true,
          baseBranchSessionId: true,
          rawText: true,
          inputMode: true,
          baseMessageSequence: true,
          status: true,
          attemptCount: true,
          errorCode: true,
          intentAssessment: true,
          intentClassifierVersion: true,
          intentDecision: true,
          eventOperationData: true,
          intentAssessedAt: true,
          createdAt: true,
          updatedAt: true,
          completedAt: true
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      });

      const journalEvent = await database.journalEvent.findFirst({
        where: {
          rootSessionId: identity.id,
          userId: identity.userId,
          entryDate: identity.entryDate,
          status: "completed",
          entry: { is: { status: "saved" } }
        },
        select: {
          id: true,
          userId: true,
          rootSessionId: true,
          entryDate: true,
          daySequence: true,
          status: true,
          startedAt: true,
          generationStartedAt: true,
          completedAt: true,
          abandonedAt: true,
          entry: {
            select: {
              id: true,
              sourceBranchSessionId: true,
              generatedByTurnId: true,
              currentGenerationTraceId: true,
              generationId: true,
              title: true,
              content: true,
              occurredAtText: true,
              status: true,
              generationOrigin: true,
              generationVersion: true,
              sourceMessageSequence: true,
              sourceMessageIds: true,
              sourceFactIds: true,
              sourceAngleOutcomeIds: true,
              sourceFingerprint: true,
              sourceSnapshot: true,
              contentRevision: true,
              savedRevision: true,
              editedAt: true,
              savedAt: true,
              createdAt: true,
              updatedAt: true
            }
          },
          factRevisions: {
            select: {
              id: true,
              branchSessionId: true,
              sourceTurnId: true,
              clarificationSourceTurnId: true,
              pathAnchorMessageId: true,
              contextMessageId: true,
              quote: true,
              requestFingerprint: true,
              createdAt: true,
              targets: {
                select: {
                  id: true,
                  targetFactId: true,
                  relation: true,
                  createdAt: true
                },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }]
              }
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }]
          }
        }
      });

      const dailyEntry = await database.journalDailyEntry.findFirst({
        where: {
          userId: identity.userId,
          entryDate: identity.entryDate,
          status: "saved"
        },
        select: {
          id: true,
          entryDate: true,
          title: true,
          content: true,
          paragraphs: true,
          status: true,
          sourceEntryIds: true,
          sourceEventIds: true,
          sourceSignature: true,
          sourceSnapshot: true,
          sourceUpdatedAt: true,
          contentRevision: true,
          savedRevision: true,
          currentGenerationTraceId: true,
          lastGenerationErrorCode: true,
          editedAt: true,
          savedAt: true,
          createdAt: true,
          updatedAt: true,
          revisions: {
            select: {
              id: true,
              kind: true,
              title: true,
              content: true,
              paragraphs: true,
              sourceSignature: true,
              sourceSnapshot: true,
              contentRevision: true,
              generationTraceId: true,
              createdAt: true
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }]
          }
        }
      });

      if (
        !journalEvent?.entry
        || !dailyEntry
        || journalEvent.userId !== identity.userId
        || journalEvent.rootSessionId !== identity.id
        || journalEvent.entryDate.getTime() !== identity.entryDate.getTime()
        || journalEvent.status !== "completed"
        || journalEvent.entry.status !== "saved"
        || dailyEntry.entryDate.getTime() !== identity.entryDate.getTime()
        || dailyEntry.status !== "saved"
        || !dailyEntry.sourceEntryIds.includes(journalEvent.entry.id)
        || !dailyEntry.sourceEventIds.includes(journalEvent.id)
      ) {
        throw new JournalGoldenSetV2RepositoryError("JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND");
      }

      const messageIdSet = new Set(messages.map((message) => message.id));
      const userTurnIdSet = new Set(userTurns.map((turn) => turn.id));
      if (
        uniqueSessions.some((session) => Boolean(
          session.forkedFromMessageId
          && !messageIdSet.has(session.forkedFromMessageId)
        ))
        || messages.some((message) =>
          Boolean(message.userTurnId && !userTurnIdSet.has(message.userTurnId))
          || Boolean(
            message.regeneratedFromMessageId
            && !messageIdSet.has(message.regeneratedFromMessageId)
          )
        )
        || userTurns.some((turn) =>
          !sessionIdSet.has(turn.sessionId)
          || Boolean(turn.baseBranchSessionId && !sessionIdSet.has(turn.baseBranchSessionId))
          || Boolean(turn.journalEventId && turn.journalEventId !== journalEvent.id)
          || Boolean(turn.targetMessageId && !messageIdSet.has(turn.targetMessageId))
        )
        || Boolean(
          journalEvent.entry.sourceBranchSessionId
          && !sessionIdSet.has(journalEvent.entry.sourceBranchSessionId)
        )
        || Boolean(
          journalEvent.entry.generatedByTurnId
          && !userTurnIdSet.has(journalEvent.entry.generatedByTurnId)
        )
        || journalEvent.entry.sourceMessageIds.some((messageId) => !messageIdSet.has(messageId))
        || journalEvent.factRevisions.some((revision) =>
          !sessionIdSet.has(revision.branchSessionId)
          || !userTurnIdSet.has(revision.sourceTurnId)
          || Boolean(
            revision.clarificationSourceTurnId
            && !userTurnIdSet.has(revision.clarificationSourceTurnId)
          )
          || !messageIdSet.has(revision.pathAnchorMessageId)
          || Boolean(revision.contextMessageId && !messageIdSet.has(revision.contextMessageId))
        )
      ) {
        throw new JournalGoldenSetV2RepositoryError("JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND");
      }

      // The User row remains FOR SHARE locked through commit. This final check
      // therefore verifies the same consent epoch while a concurrent withdrawal
      // update must wait or force this Serializable transaction to fail closed.
      const finalCheckedAt = now();
      const currentConsent = await database.user.findUnique({
        where: { id: identity.userId },
        select: {
          id: true,
          username: true,
          aiQualityConsentVersion: true,
          aiQualityConsentAt: true,
          aiQualityConsentRevokedAt: true
        }
      });
      if (
        !currentConsent
        || !consentMatchesAuthorizedSource(currentConsent, input.authorizedSource, finalCheckedAt)
      ) {
        throw new JournalGoldenSetV2RepositoryError("JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND");
      }

      await database.adminAuditLog.create({
        data: {
          adminUsername: input.adminUsername,
          targetUserId: identity.userId,
          resourceType: "journal_golden_set_v2_case",
          resourceId: input.authorizedSource.caseId,
          action: "view_full_trajectory_content"
        }
      });

      const orderedSessions = uniqueById(sessions).sort(
        (left, right) =>
          left.branchDepth - right.branchDepth ||
          left.startedAt.getTime() - right.startedAt.getTime() ||
          left.id.localeCompare(right.id)
      );
      const orderedMessages = uniqueById(messages).sort(
        (left, right) =>
          left.createdAt.getTime() - right.createdAt.getTime() ||
          left.sequence - right.sequence ||
          left.id.localeCompare(right.id)
      );
      const orderedUserTurns = uniqueById(userTurns).sort(compareDateAndId);
      const orderedFactRevisions = uniqueById(journalEvent.factRevisions).sort(compareDateAndId);
      const orderedDailyRevisions = uniqueById(dailyEntry.revisions).sort(compareDateAndId);
      const timeline = uniqueById([
        ...orderedUserTurns.map((turn) => ({
          id: `user_turn:${turn.id}`,
          kind: "user_turn" as const,
          sourceId: turn.id,
          createdAt: turn.createdAt
        })),
        ...orderedMessages.map((message) => ({
          id: `interview_message:${message.id}`,
          kind: "interview_message" as const,
          sourceId: message.id,
          createdAt: message.createdAt
        })),
        ...orderedFactRevisions.map((revision) => ({
          id: `event_fact_revision:${revision.id}`,
          kind: "event_fact_revision" as const,
          sourceId: revision.id,
          createdAt: revision.createdAt
        })),
        {
          id: `event_entry:${journalEvent.entry.id}`,
          kind: "event_entry" as const,
          sourceId: journalEvent.entry.id,
          createdAt: journalEvent.entry.updatedAt
        },
        ...orderedDailyRevisions.map((revision) => ({
          id: `daily_revision:${revision.id}`,
          kind: "daily_revision" as const,
          sourceId: revision.id,
          createdAt: revision.createdAt
        })),
        {
          id: `daily_entry:${dailyEntry.id}`,
          kind: "daily_entry" as const,
          sourceId: dailyEntry.id,
          createdAt: dailyEntry.updatedAt
        }
      ]).sort(compareDateAndId);

      const privatePayload = {
        contractVersion: "2.0" as const,
        contentIncluded: true as const,
        caseId: input.authorizedSource.caseId,
        recordMode: normalizeRecordMode(identity.recordMode),
        entryDate: formatEntryDate(identity.entryDate),
        consent: {
          policyVersion: currentConsent.aiQualityConsentVersion,
          consentAt: currentConsent.aiQualityConsentAt?.toISOString() ?? null,
          checkedAt: finalCheckedAt.toISOString()
        },
        sessions: orderedSessions.map(withoutPrivateOwnershipIds),
        messages: orderedMessages,
        userTurns: orderedUserTurns,
        journalEvent: {
          ...withoutPrivateOwnershipIds(journalEvent),
          factRevisions: orderedFactRevisions,
          entry: journalEvent.entry
        },
        dailyEntry: {
          ...dailyEntry,
          revisions: orderedDailyRevisions
        },
        sourceSignatures: {
          eventEntrySourceFingerprint: journalEvent.entry.sourceFingerprint,
          dailyEntrySourceSignature: dailyEntry.sourceSignature,
          dailyRevisionSourceSignatures: orderedDailyRevisions.map((revision) => ({
            revisionId: revision.id,
            sourceSignature: revision.sourceSignature
          }))
        },
        timeline: timeline.map((item) => ({
          kind: item.kind,
          sourceId: item.sourceId,
          createdAt: item.createdAt
        }))
      };
      return replacePrivateReference(
        replacePrivateReference(
          privatePayload,
          identity.userId,
          `${input.authorizedSource.caseId}:private-subject`
        ),
        input.authorizedSource.source.rootSessionRef,
        input.authorizedSource.caseId
      );
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
