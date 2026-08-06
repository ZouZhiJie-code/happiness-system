import {
  Prisma,
  PrismaClient,
  type AIRequestStage,
  type InterviewDimension as PrismaInterviewDimension,
  type InterviewRegenerationIntent as PrismaInterviewRegenerationIntent,
  type InterviewUserTurnStatus as PrismaInterviewUserTurnStatus,
  type InputMode,
  type InterviewSessionStatus,
  type JoyInterviewStage
} from "@prisma/client";
import { randomUUID } from "node:crypto";

import {
  createOpeningAssistantTurnPayload,
  getAssistantDisplayParts,
  parseAssistantTurnPayload,
  serializeAssistantTurnPayload
} from "@/features/joy-interview/assistant-turn";
import {
  buildJournalPayloadForDimension,
  buildSnapshotDataForDimension
} from "@/features/interview/dimension-definitions";
import { assessDimensionEvidence, canGenerateFromEvidence } from "@/features/interview/dimension-evidence";
import {
  formatEntryDate,
  getTodayEntryDate,
  parseEntryDateInput
} from "@/features/interview/entry-date";
import {
  INTERVIEW_USER_TURN_LEASE_MS,
  isInterviewUserTurnLeaseExpired
} from "@/features/interview/user-turn";
import { isDraftGenerationUnlocked } from "@/features/joy-interview/server/interview-progress";
import {
  buildJoySnapshot,
  createEmptySnapshot,
  getLegacyJoyProjection
} from "@/features/joy-interview/server/joy-interview-engine";
import { prisma } from "@/server/db/prisma";
import { getEventCenteredSessionIdentity } from "@/server/repositories/event-centered-interview.repository";
import {
  assertJournalDayModeInTransaction,
  claimJournalDayModeInTransaction,
  resolveJournalDayModeInTransaction
} from "@/server/repositories/journal-day-mode.repository";
import {
  angleResultTraceDecision,
  commitJournalEventAngleResultsWithClient
} from "@/server/repositories/journal-event-angle-outcome.repository";
import type {
  AssistantTurnPayload,
  InterviewDimension,
  InterviewEventRecord,
  InterviewLens,
  InterviewMessage,
  InterviewSessionRecord,
  InterviewRegenerationIntent,
  InterviewUserTurnAction,
  InterviewUserTurnRecord,
  JournalEntryRecord,
  JoyEntryDraft,
  JoyEventBlock,
  JoyPsychProfile,
  JoySnapshot
} from "@/types/interview";
import type { JournalEventAngleRepairResolutionInput } from "@/types/journal-event-angle-outcome";

const unresolvedUserTurnStatuses: PrismaInterviewUserTurnStatus[] = ["processing", "failed", "canceled"];

function isInterviewRegenerationEnabled() {
  return process.env.INTERVIEW_REGENERATION_ENABLED !== "false";
}

const interviewSessionInclude = {
  activeEvent: true,
  events: {
    orderBy: {
      sequence: "asc"
    }
  },
  messages: {
    orderBy: {
      sequence: "asc"
    },
    include: {
      userTurn: {
        select: {
          clientTurnId: true
        }
      }
    }
  },
  userTurns: {
    where: {
      OR: [
        { status: "processing" },
        {
          status: { in: ["failed", "canceled"] },
          action: { not: "regenerate_question" }
        }
      ] as Prisma.InterviewUserTurnWhereInput[]
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 1
  },
  snapshots: {
    orderBy: {
      version: "desc"
    },
    take: 1
  },
  joyEntry: {
    include: {
      session: {
        select: {
          dimension: true
        }
      }
    }
  }
} as const;

type DatabaseClient = PrismaClient | Prisma.TransactionClient;
type InterviewSessionWithRelations = Prisma.InterviewSessionGetPayload<{
  include: typeof interviewSessionInclude;
}>;
type EffectiveInterviewMessage = InterviewSessionWithRelations["messages"][number];
type SnapshotRecord = NonNullable<InterviewSessionWithRelations["snapshots"][number]>;
type EventRecord = NonNullable<InterviewSessionWithRelations["events"][number]>;
type JoyEntryRecord = NonNullable<InterviewSessionWithRelations["joyEntry"]>;

function requireLegacyDimension(
  dimension: PrismaInterviewDimension | null
): InterviewDimension {
  if (!dimension) {
    throw new Error("LEGACY_INTERVIEW_DIMENSION_REQUIRED");
  }

  return dimension;
}

function mapInterviewUserTurn(
  turn: InterviewSessionWithRelations["userTurns"][number]
): InterviewUserTurnRecord {
  return {
    id: turn.id,
    clientTurnId: turn.clientTurnId,
    sessionId: turn.sessionId,
    activeEventId: turn.activeEventId,
    action: turn.action,
    targetMessageId: turn.targetMessageId,
    regenerationIntent: turn.regenerationIntent,
    baseBranchSessionId: turn.baseBranchSessionId,
    rawText: turn.rawText,
    inputMode: turn.inputMode ?? undefined,
    baseMessageSequence: turn.baseMessageSequence,
    status: turn.status,
    attemptCount: turn.attemptCount,
    errorCode: turn.errorCode,
    createdAt: turn.createdAt.toISOString(),
    updatedAt: turn.updatedAt.toISOString(),
    completedAt: turn.completedAt?.toISOString() ?? null
  };
}

function parseJoySnapshotData(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;

  if (data.kind !== "joy") {
    return null;
  }

  return {
    joyMoment:
      typeof data.joyMoment === "string" ? data.joyMoment : typeof data.moment === "string" ? data.moment : null,
    joySource:
      typeof data.joySource === "string" ? data.joySource : typeof data.meaningSource === "string" ? data.meaningSource : null,
    stateShift:
      typeof data.stateShift === "string" ? data.stateShift : typeof data.feeling === "string" ? data.feeling : null,
    meaningNeed: typeof data.meaningNeed === "string" ? data.meaningNeed : null,
    manualClue:
      typeof data.manualClue === "string" ? data.manualClue : typeof data.selfPattern === "string" ? data.selfPattern : null,
    delightSignature: typeof data.delightSignature === "string" ? data.delightSignature : null,
    directionSignal: typeof data.directionSignal === "string" ? data.directionSignal : null,
    valueImpact: typeof data.valueImpact === "string" ? data.valueImpact : null,
    durability: typeof data.durability === "string" ? data.durability : null,
    psychProfile: data.psychProfile as JoyPsychProfile | undefined,
    tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === "string") : []
  };
}

function parseImprovementSnapshotData(value: unknown): Pick<
  JoySnapshot,
  | "improvementTrack"
  | "stateAssessment"
  | "frictionPoint"
  | "repeatCondition"
  | "controllableFactor"
  | "nextAttempt"
  | "successSignal"
> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;

  if (data.kind !== "improvement") {
    return null;
  }

  return {
    improvementTrack:
      data.improvementTrack === "repeat_good" || data.improvementTrack === "avoid_bad" ? data.improvementTrack : null,
    stateAssessment: typeof data.stateAssessment === "string" ? data.stateAssessment : null,
    frictionPoint: typeof data.frictionPoint === "string" ? data.frictionPoint : null,
    repeatCondition: typeof data.repeatCondition === "string" ? data.repeatCondition : null,
    controllableFactor: typeof data.controllableFactor === "string" ? data.controllableFactor : null,
    nextAttempt: typeof data.nextAttempt === "string" ? data.nextAttempt : null,
    successSignal: typeof data.successSignal === "string" ? data.successSignal : null
  };
}

function parseGratitudeSnapshotData(value: unknown): Pick<
  JoySnapshot,
  | "gratitudeMoment"
  | "gratitudeTarget"
  | "kindAction"
  | "seenNeed"
  | "innerEffect"
  | "gratitudeReason"
  | "gratitudeType"
  | "relationshipSignal"
  | "reciprocityHint"
  | "evidenceState"
> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;

  if (data.kind !== "gratitude") {
    return null;
  }

  return {
    gratitudeMoment:
      typeof data.gratitudeMoment === "string" ? data.gratitudeMoment : typeof data.moment === "string" ? data.moment : null,
    gratitudeTarget: typeof data.gratitudeTarget === "string" ? data.gratitudeTarget : null,
    kindAction: typeof data.kindAction === "string" ? data.kindAction : null,
    seenNeed: typeof data.seenNeed === "string" ? data.seenNeed : null,
    innerEffect:
      typeof data.innerEffect === "string" ? data.innerEffect : typeof data.feeling === "string" ? data.feeling : null,
    gratitudeReason: typeof data.gratitudeReason === "string" ? data.gratitudeReason : null,
    gratitudeType: typeof data.gratitudeType === "string" ? data.gratitudeType : null,
    relationshipSignal: typeof data.relationshipSignal === "string" ? data.relationshipSignal : null,
    reciprocityHint: typeof data.reciprocityHint === "string" ? data.reciprocityHint : null,
    evidenceState:
      data.evidenceState && typeof data.evidenceState === "object" ? (data.evidenceState as JoySnapshot["evidenceState"]) : null
  };
}

function normalizeSnapshotDataForDimension(dimension: InterviewDimension, snapshot: JoySnapshot, raw: unknown) {
  return assessDimensionEvidence(dimension, snapshot, raw).snapshotData;
}

function normalizePayloadForDimension(dimension: InterviewDimension, entry: JoyEntryRecord) {
  if (dimension === "gratitude" && entry.payload && typeof entry.payload === "object") {
    const payload = entry.payload as Record<string, unknown>;

    if (payload.kind === "gratitude") {
      return buildJournalPayloadForDimension("gratitude", {
        event: typeof payload.gratitudeMoment === "string" ? payload.gratitudeMoment : typeof payload.moment === "string" ? payload.moment : entry.event,
        feeling: typeof payload.innerEffect === "string" ? payload.innerEffect : entry.feeling,
        whyItMattered: typeof payload.gratitudeReason === "string" ? payload.gratitudeReason : entry.whyItMattered,
        happinessType: typeof payload.gratitudeType === "string" ? payload.gratitudeType : entry.happinessType,
        selfPattern: typeof payload.relationshipSignal === "string" ? payload.relationshipSignal : entry.selfPattern,
        joyMoment: null,
        joySource: null,
        stateShift: null,
        meaningNeed: null,
        manualClue: null,
        delightSignature: null,
        directionSignal: null,
        valueImpact: null,
        durability: null,
        gratitudeMoment: typeof payload.gratitudeMoment === "string" ? payload.gratitudeMoment : typeof payload.moment === "string" ? payload.moment : entry.event,
        gratitudeTarget: typeof payload.gratitudeTarget === "string" ? payload.gratitudeTarget : null,
        kindAction: typeof payload.kindAction === "string" ? payload.kindAction : null,
        seenNeed: typeof payload.seenNeed === "string" ? payload.seenNeed : null,
        innerEffect: typeof payload.innerEffect === "string" ? payload.innerEffect : entry.feeling,
        gratitudeReason: typeof payload.gratitudeReason === "string" ? payload.gratitudeReason : entry.whyItMattered,
        gratitudeType: typeof payload.gratitudeType === "string" ? payload.gratitudeType : entry.happinessType,
        relationshipSignal: typeof payload.relationshipSignal === "string" ? payload.relationshipSignal : entry.selfPattern,
        reciprocityHint: typeof payload.reciprocityHint === "string" ? payload.reciprocityHint : null,
        tags: Array.isArray(payload.tags) ? payload.tags.filter((tag): tag is string => typeof tag === "string") : entry.tags
      });
    }
  }

  if (dimension === "improvement" && entry.payload && typeof entry.payload === "object") {
    const payload = entry.payload as Record<string, unknown>;

    if (payload.kind === "improvement") {
      return buildJournalPayloadForDimension("improvement", {
        event: typeof payload.situation === "string" ? payload.situation : entry.event,
        feeling: typeof payload.feeling === "string" ? payload.feeling : entry.feeling,
        whyItMattered: typeof payload.frictionPoint === "string" ? payload.frictionPoint : entry.whyItMattered,
        happinessType: typeof payload.improvementType === "string" ? payload.improvementType : entry.happinessType,
        selfPattern: typeof payload.nextAttempt === "string" ? payload.nextAttempt : entry.selfPattern,
        joyMoment: null,
        joySource: null,
        stateShift: null,
        meaningNeed: null,
        manualClue: null,
        delightSignature: null,
        directionSignal: null,
        valueImpact: null,
        durability: null,
        gratitudeMoment: null,
        gratitudeTarget: null,
        kindAction: null,
        seenNeed: null,
        innerEffect: null,
        gratitudeReason: null,
        gratitudeType: null,
        relationshipSignal: null,
        reciprocityHint: null,
        improvementTrack:
          payload.improvementTrack === "repeat_good" || payload.improvementTrack === "avoid_bad" ? payload.improvementTrack : null,
        stateAssessment: typeof payload.stateAssessment === "string" ? payload.stateAssessment : null,
        frictionPoint: typeof payload.frictionPoint === "string" ? payload.frictionPoint : null,
        repeatCondition: typeof payload.repeatCondition === "string" ? payload.repeatCondition : null,
        controllableFactor: typeof payload.controllableFactor === "string" ? payload.controllableFactor : null,
        nextAttempt: typeof payload.nextAttempt === "string" ? payload.nextAttempt : null,
        successSignal: typeof payload.successSignal === "string" ? payload.successSignal : null,
        tags: Array.isArray(payload.tags) ? payload.tags.filter((tag): tag is string => typeof tag === "string") : entry.tags
      });
    }
  }

  if (dimension !== "joy" || !entry.payload) {
    return buildJournalPayloadForDimension(dimension, {
      event: entry.event,
      feeling: entry.feeling,
      whyItMattered: entry.whyItMattered,
      happinessType: entry.happinessType,
      selfPattern: entry.selfPattern,
      joyMoment: null,
      joySource: null,
      stateShift: null,
      meaningNeed: null,
      manualClue: null,
      delightSignature: null,
      directionSignal: null,
      valueImpact: null,
      durability: null,
      gratitudeMoment: entry.event,
      gratitudeTarget: null,
      kindAction: null,
      seenNeed: null,
      innerEffect: entry.feeling,
      gratitudeReason: entry.whyItMattered,
      gratitudeType: entry.happinessType,
      relationshipSignal: entry.selfPattern,
      reciprocityHint: null,
      tags: entry.tags
    });
  }

  const parsed = parseJoySnapshotData(entry.payload);

  return buildJournalPayloadForDimension("joy", {
    event: entry.event,
    feeling: entry.feeling,
    whyItMattered: entry.whyItMattered,
    happinessType: entry.happinessType,
    selfPattern: entry.selfPattern,
    joyMoment: parsed?.joyMoment,
    joySource: parsed?.joySource,
    stateShift: parsed?.stateShift,
    meaningNeed: parsed?.meaningNeed,
    manualClue: parsed?.manualClue,
    delightSignature: parsed?.delightSignature,
    directionSignal: parsed?.directionSignal,
    valueImpact: parsed?.valueImpact,
    durability: parsed?.durability,
    psychProfile: parsed?.psychProfile,
    tags: parsed?.tags.length ? parsed.tags : entry.tags
  });
}

function projectLegacyFields(input: {
  event?: string | null;
  feeling?: string | null;
  whyItMattered?: string | null;
  happinessType?: string | null;
  selfPattern?: string | null;
  joyMoment?: string | null;
  joySource?: string | null;
  stateShift?: string | null;
  meaningNeed?: string | null;
  manualClue?: string | null;
  delightSignature?: string | null;
  directionSignal?: string | null;
  valueImpact?: string | null;
  durability?: string | null;
  tags?: string[];
}) {
  return getLegacyJoyProjection(
    buildJoySnapshot({
      event: input.event,
      feeling: input.feeling,
      whyItMattered: input.whyItMattered,
      happinessType: input.happinessType,
      selfPattern: input.selfPattern,
      joyMoment: input.joyMoment,
      joySource: input.joySource,
      stateShift: input.stateShift,
      meaningNeed: input.meaningNeed,
      manualClue: input.manualClue,
      delightSignature: input.delightSignature,
      directionSignal: input.directionSignal,
      valueImpact: input.valueImpact,
      durability: input.durability,
      tags: input.tags
    })
  );
}

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function mapSnapshot(snapshot: SnapshotRecord | null | undefined): JoySnapshot {
  if (!snapshot) {
    return createEmptySnapshot();
  }

  return buildJoySnapshot({
    event: snapshot.event,
    feeling: snapshot.feeling,
    whyItMattered: snapshot.whyItMattered,
    happinessType: snapshot.happinessType,
    selfPattern: snapshot.selfPattern,
    tags: []
  });
}

function normalizeLenses(lenses: string[]): InterviewLens[] {
  const allowed: InterviewLens[] = [
    "event_detail",
    "felt_experience",
    "importance_reason",
    "meaning_pattern",
    "self_pattern"
  ];

  return allowed.filter((lens) => lenses.includes(lens));
}

function mapEventSnapshot(
  event: Pick<
    EventRecord,
    "event" | "feeling" | "whyItMattered" | "happinessType" | "selfPattern" | "confidence" | "missingSlots" | "snapshotData"
  >
): JoySnapshot {
  const snapshotData = parseJoySnapshotData(event.snapshotData);
  const improvementSnapshotData = parseImprovementSnapshotData(event.snapshotData);
  const gratitudeSnapshotData = parseGratitudeSnapshotData(event.snapshotData);

  return buildJoySnapshot({
    event: event.event,
    feeling: event.feeling,
    whyItMattered: event.whyItMattered,
    happinessType: event.happinessType,
    selfPattern: event.selfPattern,
    joyMoment: snapshotData?.joyMoment,
    joySource: snapshotData?.joySource,
    stateShift: snapshotData?.stateShift,
    meaningNeed: snapshotData?.meaningNeed,
    manualClue: snapshotData?.manualClue,
    delightSignature: snapshotData?.delightSignature,
    directionSignal: snapshotData?.directionSignal,
    valueImpact: snapshotData?.valueImpact,
    durability: snapshotData?.durability,
    psychProfile: snapshotData?.psychProfile,
    tags: snapshotData?.tags,
    improvementTrack: improvementSnapshotData?.improvementTrack,
    stateAssessment: improvementSnapshotData?.stateAssessment,
    frictionPoint: improvementSnapshotData?.frictionPoint,
    repeatCondition: improvementSnapshotData?.repeatCondition,
    controllableFactor: improvementSnapshotData?.controllableFactor,
    nextAttempt: improvementSnapshotData?.nextAttempt,
    successSignal: improvementSnapshotData?.successSignal,
    gratitudeMoment: gratitudeSnapshotData?.gratitudeMoment,
    gratitudeTarget: gratitudeSnapshotData?.gratitudeTarget,
    kindAction: gratitudeSnapshotData?.kindAction,
    seenNeed: gratitudeSnapshotData?.seenNeed,
    innerEffect: gratitudeSnapshotData?.innerEffect,
        gratitudeReason: gratitudeSnapshotData?.gratitudeReason,
        gratitudeType: gratitudeSnapshotData?.gratitudeType,
        relationshipSignal: gratitudeSnapshotData?.relationshipSignal,
        reciprocityHint: gratitudeSnapshotData?.reciprocityHint,
        evidenceState: gratitudeSnapshotData?.evidenceState
      });
}

function mapInterviewEvent(dimension: InterviewDimension, event: EventRecord): InterviewEventRecord {
  const snapshot = mapEventSnapshot(event);
  const snapshotData = normalizeSnapshotDataForDimension(dimension, snapshot, event.snapshotData);

  return {
    id: event.id,
    sequence: event.sequence,
    status: event.status,
    stage: event.stage,
    explorationRound: event.explorationRound,
    coveredLenses: normalizeLenses(event.coveredLenses),
    roundCoveredLenses: normalizeLenses(event.roundCoveredLenses),
    roundMeaningfulReplyCount: event.roundMeaningfulReplyCount,
    totalMeaningfulReplyCount: event.totalMeaningfulReplyCount,
    startMessageSequence: event.startMessageSequence,
    snapshot,
    snapshotData,
    draftSummary: event.draftSummary,
    startedAt: event.startedAt.toISOString(),
    completedAt: event.completedAt?.toISOString() ?? null
  };
}

function buildFallbackEvent(session: InterviewSessionWithRelations): InterviewEventRecord {
  const snapshot = mapSnapshot(session.snapshots[0]);
  const snapshotData = buildSnapshotDataForDimension(requireLegacyDimension(session.dimension), snapshot);

  return {
    id: `legacy-${session.id}`,
    sequence: 1,
    status: session.stage === "finalize" ? "completed" : "active",
    stage: session.stage,
    explorationRound: 1,
    coveredLenses: [],
    roundCoveredLenses: [],
    roundMeaningfulReplyCount: 0,
    totalMeaningfulReplyCount: session.turnCount,
    startMessageSequence: 0,
    snapshot,
    snapshotData,
    draftSummary: session.draftSummary,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null
  };
}

function mapEventBlocks(blocks: Prisma.JsonValue | null | undefined): JoyEventBlock[] {
  if (!Array.isArray(blocks)) {
    return [];
  }

  return blocks.flatMap((block) => {
    if (!block || typeof block !== "object") {
      return [];
    }

    const value = block as Record<string, unknown>;

    if (typeof value.eventId !== "string" || typeof value.sequence !== "number" || typeof value.explorationRound !== "number") {
      return [];
    }

    return [
      {
        eventId: value.eventId,
        sequence: value.sequence,
        explorationRound: value.explorationRound,
        event: typeof value.event === "string" ? value.event : null,
        feeling: typeof value.feeling === "string" ? value.feeling : null,
        whyItMattered: typeof value.whyItMattered === "string" ? value.whyItMattered : null,
        happinessType: typeof value.happinessType === "string" ? value.happinessType : null,
        selfPattern: typeof value.selfPattern === "string" ? value.selfPattern : null,
        joyMoment: typeof value.joyMoment === "string" ? value.joyMoment : null,
        joySource: typeof value.joySource === "string" ? value.joySource : null,
        stateShift: typeof value.stateShift === "string" ? value.stateShift : null,
        meaningNeed: typeof value.meaningNeed === "string" ? value.meaningNeed : null,
        manualClue: typeof value.manualClue === "string" ? value.manualClue : null,
        delightSignature: typeof value.delightSignature === "string" ? value.delightSignature : null,
        directionSignal: typeof value.directionSignal === "string" ? value.directionSignal : null,
        valueImpact: typeof value.valueImpact === "string" ? value.valueImpact : null,
        durability: typeof value.durability === "string" ? value.durability : null,
        psychProfile: value.psychProfile as JoyPsychProfile | undefined,
        gratitudeMoment: typeof value.gratitudeMoment === "string" ? value.gratitudeMoment : typeof value.event === "string" ? value.event : null,
        gratitudeTarget: typeof value.gratitudeTarget === "string" ? value.gratitudeTarget : null,
        kindAction: typeof value.kindAction === "string" ? value.kindAction : null,
        seenNeed: typeof value.seenNeed === "string" ? value.seenNeed : null,
        innerEffect: typeof value.innerEffect === "string" ? value.innerEffect : typeof value.feeling === "string" ? value.feeling : null,
        gratitudeReason: typeof value.gratitudeReason === "string" ? value.gratitudeReason : typeof value.whyItMattered === "string" ? value.whyItMattered : null,
        gratitudeType: typeof value.gratitudeType === "string" ? value.gratitudeType : typeof value.happinessType === "string" ? value.happinessType : null,
        relationshipSignal: typeof value.relationshipSignal === "string" ? value.relationshipSignal : typeof value.selfPattern === "string" ? value.selfPattern : null,
        reciprocityHint: typeof value.reciprocityHint === "string" ? value.reciprocityHint : null,
        tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === "string") : []
      }
    ];
  });
}

function mapJournalEntry(entry: JoyEntryRecord | null | undefined, dimensionFallback: InterviewDimension = "joy"): JournalEntryRecord | null {
  if (!entry) {
    return null;
  }

  const dimension = entry.session?.dimension ?? dimensionFallback;
  const payload = normalizePayloadForDimension(dimension, entry);
  const confirmationState =
    entry.status === "draft"
      ? "draft"
      : !entry.savedAt || entry.updatedAt.getTime() > entry.savedAt.getTime()
        ? "modified"
        : "confirmed";

  return {
    id: entry.id,
    traceId: entry.currentGenerationTraceId ?? null,
    generationVersion: entry.generationVersion ?? 0,
    title: entry.title,
    content: entry.content,
    event: entry.event,
    feeling: entry.feeling,
    whyItMattered: entry.whyItMattered,
    happinessType: entry.happinessType,
    selfPattern: entry.selfPattern,
    joyMoment: payload.kind === "joy" ? payload.joyMoment : undefined,
    joySource: payload.kind === "joy" ? payload.joySource : undefined,
    stateShift: payload.kind === "joy" ? payload.stateShift : undefined,
    meaningNeed: payload.kind === "joy" ? payload.meaningNeed : undefined,
    manualClue: payload.kind === "joy" ? payload.manualClue : undefined,
    delightSignature: payload.kind === "joy" ? payload.delightSignature : undefined,
    directionSignal: payload.kind === "joy" ? payload.directionSignal : undefined,
    valueImpact: payload.kind === "joy" ? payload.valueImpact : undefined,
    durability: payload.kind === "joy" ? payload.durability : undefined,
    psychProfile: payload.kind === "joy" ? payload.psychProfile : undefined,
    improvementTrack: payload.kind === "improvement" ? payload.improvementTrack : undefined,
    stateAssessment: payload.kind === "improvement" ? payload.stateAssessment : undefined,
    frictionPoint: payload.kind === "improvement" ? payload.frictionPoint : undefined,
    repeatCondition: payload.kind === "improvement" ? payload.repeatCondition : undefined,
    controllableFactor: payload.kind === "improvement" ? payload.controllableFactor : undefined,
    nextAttempt: payload.kind === "improvement" ? payload.nextAttempt : undefined,
    successSignal: payload.kind === "improvement" ? payload.successSignal : undefined,
    gratitudeMoment: payload.kind === "gratitude" ? payload.gratitudeMoment : undefined,
    gratitudeTarget: payload.kind === "gratitude" ? payload.gratitudeTarget : undefined,
    kindAction: payload.kind === "gratitude" ? payload.kindAction : undefined,
    seenNeed: payload.kind === "gratitude" ? payload.seenNeed : undefined,
    innerEffect: payload.kind === "gratitude" ? payload.innerEffect : undefined,
    gratitudeReason: payload.kind === "gratitude" ? payload.gratitudeReason : undefined,
    gratitudeType: payload.kind === "gratitude" ? payload.gratitudeType : undefined,
    relationshipSignal: payload.kind === "gratitude" ? payload.relationshipSignal : undefined,
    reciprocityHint: payload.kind === "gratitude" ? payload.reciprocityHint : undefined,
    tags: entry.tags,
    eventBlocks: mapEventBlocks(entry.eventBlocks),
    payload,
    source: entry.source,
    status: entry.status,
    linkedSessionIds: entry.linkedSessionIds,
    updatedAt: entry.updatedAt.toISOString(),
    savedAt: entry.savedAt?.toISOString() ?? null,
    confirmationState
  };
}

function mapInterviewSession(session: InterviewSessionWithRelations): InterviewSessionRecord {
  const dimension = requireLegacyDimension(session.dimension);
  const events = session.events.length ? session.events.map((event: EventRecord) => mapInterviewEvent(dimension, event)) : [buildFallbackEvent(session)];
  const activeEvent =
    events.find((event: InterviewEventRecord) => event.id === session.activeEventId) ??
    events.find((event: InterviewEventRecord) => event.status !== "completed") ??
    events[events.length - 1];
  const progressData =
    activeEvent && session.activeEvent
      ? (session.activeEvent.progressData as Record<string, unknown> | null | undefined)
      : undefined;
  const journalEntry = mapJournalEntry(session.joyEntry, dimension);
  const evidence = assessDimensionEvidence(
    dimension,
    activeEvent?.snapshot ?? mapSnapshot(session.snapshots[0]),
    activeEvent?.snapshotData
  );
  const pendingDecision =
    activeEvent?.status === "ready_for_choice"
      ? progressData?.kind === "dimension_redirect" && progressData.targetDimension === "improvement"
        ? {
            kind: "dimension_redirect" as const,
            eventId: activeEvent.id,
            eventSequence: activeEvent.sequence,
            targetDimension: "improvement" as const,
            reason:
              typeof progressData.reason === "string" && progressData.reason
                ? progressData.reason
                : "这一天暂时更适合去聊改进。",
            actions: ["continue_current_event", "switch_dimension"] as const
          }
        : progressData?.kind === "boundary_insufficient" || (!journalEntry && !canGenerateFromEvidence(evidence))
          ? {
              kind: "boundary_insufficient" as const,
              eventId: activeEvent.id,
              eventSequence: activeEvent.sequence,
              reason:
                typeof progressData?.reason === "string" && progressData.reason
                  ? progressData.reason
                  : "我不再继续追问细节了。",
              actions: ["continue_current_event", "next_event", "pause_session"] as const
            }
          : {
              kind: "event_complete" as const,
              eventId: activeEvent.id,
              eventSequence: activeEvent.sequence,
              completionMode: evidence.completionMode ?? ("user_override_partial" as const),
              actions: ["continue_current_event", "next_event", "generate_draft"] as const
            }
      : null;
  const mappedSession = {
    id: session.id,
    userId: session.userId,
    dimension,
    conversationSchemaVersion: session.conversationSchemaVersion,
    rootSessionId: session.rootSessionId ?? session.id,
    activeBranchSessionId: session.activeBranchSessionId ?? session.id,
    status: session.status,
    stage: activeEvent?.stage ?? session.stage,
    activeEventId: activeEvent?.id ?? null,
    messages: session.messages.map((message) => ({
      id: message.id,
      traceId: message.generationTraceId ?? null,
      userTurnId: message.userTurnId ?? null,
      clientTurnId: message.userTurn?.clientTurnId ?? null,
      role: message.role,
      inputMode: message.inputMode ?? undefined,
      content: message.content,
      assistantPayload: message.role === "assistant" ? parseAssistantTurnPayload(message.content) : null,
      branchSessionId: message.branchSessionId ?? message.sessionId,
      responseVersion:
        message.role === "assistant" && message.responseGroupId && message.responseVersion
          ? {
              groupId: message.responseGroupId,
              version: message.responseVersion,
              versionCount: message.responseVersion,
              canRegenerate: session.conversationSchemaVersion >= 2,
              canSwitch: message.responseVersion > 1,
              disabledReason: null,
              versions: [
                {
                  messageId: message.id,
                  branchSessionId: message.branchSessionId ?? message.sessionId,
                  version: message.responseVersion,
                  active: true
                }
              ]
            }
          : null,
      regenerationIntent: message.regenerationIntent,
      regeneratedFromMessageId: message.regeneratedFromMessageId,
      sequence: message.sequence,
      createdAt: message.createdAt.toISOString()
    })),
    snapshot: activeEvent?.snapshot ?? mapSnapshot(session.snapshots[0]),
    snapshotData: activeEvent?.snapshotData ?? buildSnapshotDataForDimension(dimension, mapSnapshot(session.snapshots[0])),
    events,
    pendingDecision,
    pendingUserTurn: session.userTurns?.[0] ? mapInterviewUserTurn(session.userTurns[0]) : null,
    entryDate: formatEntryDate(session.entryDate ?? session.startedAt),
    startedAt: session.startedAt.toISOString(),
    pausedAt: session.pausedAt?.toISOString() ?? null,
    completedAt: session.completedAt?.toISOString() ?? null,
    journalEntry,
    turnCount: session.turnCount,
    lastAssistantQuestion: session.lastAssistantQuestion ?? "",
    draftSummary: session.draftSummary,
    draftGenerationUnlocked: false
  };

  return {
    ...mappedSession,
    draftGenerationUnlocked: isDraftGenerationUnlocked({
      messages: mappedSession.messages,
      stage: mappedSession.stage,
      journalEntry: mappedSession.journalEntry,
      pendingDecision: mappedSession.pendingDecision
    })
  };
}

async function resolveInterviewSessionRoute(database: DatabaseClient, sessionId: string) {
  const requested = await database.interviewSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      rootSessionId: true,
      activeBranchSessionId: true,
      mode: true,
      conversationSchemaVersion: true
    }
  });

  if (!requested) {
    return null;
  }

  const rootId = requested.rootSessionId ?? requested.id;
  const root =
    rootId === requested.id
      ? requested
      : await database.interviewSession.findUnique({
          where: { id: rootId },
          select: {
            id: true,
            userId: true,
            rootSessionId: true,
            activeBranchSessionId: true,
            mode: true,
            conversationSchemaVersion: true
          }
        });

  if (!root) {
    return null;
  }

  return {
    rootId: root.id,
    activeBranchSessionId: root.activeBranchSessionId ?? root.id,
    mode: root.mode,
    conversationSchemaVersion: root.conversationSchemaVersion,
    userId: root.userId
  };
}

async function resolveEffectiveInterviewMessages(
  database: DatabaseClient,
  branchSessionId: string
): Promise<InterviewSessionWithRelations["messages"]> {
  const chain: Array<{
    id: string;
    parentSessionId: string | null;
    forkMessageSequence: number | null;
    messages: InterviewSessionWithRelations["messages"];
  }> = [];
  let cursor: string | null = branchSessionId;

  while (cursor) {
    const branch: {
      id: string;
      parentSessionId: string | null;
      forkMessageSequence: number | null;
      messages: EffectiveInterviewMessage[];
    } | null = await database.interviewSession.findUnique({
      where: { id: cursor },
      select: {
        id: true,
        parentSessionId: true,
        forkMessageSequence: true,
        messages: {
          orderBy: { sequence: "asc" },
          include: {
            userTurn: {
              select: {
                clientTurnId: true
              }
            }
          }
        }
      }
    });

    if (!branch) {
      break;
    }

    chain.push(branch);
    cursor = branch.parentSessionId;
  }

  let messages: InterviewSessionWithRelations["messages"] = [];
  for (const branch of chain.reverse()) {
    if (branch.forkMessageSequence !== null) {
      messages = messages.filter((message) => message.sequence < branch.forkMessageSequence!);
    }
    messages = [...messages, ...branch.messages].sort((left, right) => left.sequence - right.sequence);
  }

  return messages;
}

async function resolveEffectiveInterviewMessagesForRoot(
  database: DatabaseClient,
  rootSessionId: string,
  branchSessionId: string
): Promise<InterviewSessionWithRelations["messages"]> {
  const branches = await database.interviewSession.findMany({
    where: {
      OR: [
        { id: rootSessionId },
        { rootSessionId }
      ]
    },
    select: {
      id: true,
      parentSessionId: true,
      forkMessageSequence: true
    }
  });
  const branchesById = new Map(branches.map((branch) => [branch.id, branch]));
  const chain: typeof branches = [];
  let cursor: string | null = branchSessionId;

  while (cursor) {
    const branch = branchesById.get(cursor);
    if (!branch) return [];
    chain.push(branch);
    cursor = branch.parentSessionId;
  }

  if (chain.at(-1)?.id !== rootSessionId) {
    return [];
  }

  const branchIds = chain.map((branch) => branch.id);
  const branchMessages = await database.interviewMessage.findMany({
    where: {
      sessionId: { in: branchIds }
    },
    orderBy: [
      { sessionId: "asc" },
      { sequence: "asc" }
    ],
    include: {
      userTurn: {
        select: {
          clientTurnId: true
        }
      }
    }
  });
  const messagesByBranch = new Map<string, InterviewSessionWithRelations["messages"]>();

  for (const message of branchMessages) {
    const messages = messagesByBranch.get(message.sessionId) ?? [];
    messages.push(message);
    messagesByBranch.set(message.sessionId, messages);
  }

  let messages: InterviewSessionWithRelations["messages"] = [];
  for (const branch of chain.reverse()) {
    if (branch.forkMessageSequence !== null) {
      messages = messages.filter((message) => message.sequence < branch.forkMessageSequence!);
    }
    messages = [...messages, ...(messagesByBranch.get(branch.id) ?? [])].sort(
      (left, right) => left.sequence - right.sequence
    );
  }

  return messages;
}

async function mapActiveInterviewSession(input: {
  root: InterviewSessionWithRelations;
  active: InterviewSessionWithRelations;
  effectiveMessages: InterviewSessionWithRelations["messages"];
}, database: DatabaseClient = prisma): Promise<InterviewSessionRecord> {
  const mapped = mapInterviewSession({
    ...input.active,
    messages: input.effectiveMessages,
    joyEntry: input.root.joyEntry
  });
  const activeMessageIds = new Set(input.effectiveMessages.map((message) => message.id));
  const responseGroupIds = input.effectiveMessages.flatMap((message) =>
    message.responseGroupId ? [message.responseGroupId] : []
  );
  const versions = responseGroupIds.length
    ? await database.interviewMessage.findMany({
        where: {
          responseGroupId: {
            in: Array.from(new Set(responseGroupIds))
          }
        },
        orderBy: [{ responseGroupId: "asc" }, { responseVersion: "asc" }]
      })
    : [];
  const versionsByGroup = new Map<string, typeof versions>();

  for (const version of versions) {
    if (!version.responseGroupId) continue;
    const group = versionsByGroup.get(version.responseGroupId) ?? [];
    group.push(version);
    versionsByGroup.set(version.responseGroupId, group);
  }

  const latestAssistantSequence = Math.max(
    -1,
    ...input.effectiveMessages
      .filter((message) => message.role === "assistant")
      .map((message) => message.sequence)
  );
  const journalLocked = Boolean(input.root.joyEntry);
  const messages = mapped.messages.map((message) => {
    const payload = message.assistantPayload;
    const groupId = message.responseVersion?.groupId;

    if (
      input.root.conversationSchemaVersion < 2 ||
      !isInterviewRegenerationEnabled() ||
      message.role !== "assistant" ||
      !payload?.question ||
      payload.stateUpdate.offerChoice ||
      !groupId
    ) {
      return {
        ...message,
        responseVersion: null
      };
    }

    const groupVersions = versionsByGroup.get(groupId) ?? [];
    const versionCount = groupVersions.length;
    const lockedByJournal = journalLocked && message.sequence < latestAssistantSequence;
    const limitReached = versionCount >= 3;

    return {
      ...message,
      responseVersion: {
        groupId,
        version: message.responseVersion?.version ?? 1,
        versionCount,
        canRegenerate:
          isInterviewRegenerationEnabled() &&
          input.root.conversationSchemaVersion >= 2 &&
          !lockedByJournal &&
          !limitReached,
        canSwitch: versionCount > 1 && !lockedByJournal,
        disabledReason:
          !isInterviewRegenerationEnabled()
            ? "换问法功能当前已暂停"
            : input.root.conversationSchemaVersion < 2
            ? "旧访谈会继续沿用原有流程"
            : lockedByJournal
              ? "这段历史已经进入日志"
              : limitReached
                ? "这个问题已经保留了三个版本"
                : null,
        versions: groupVersions.map((version) => ({
          messageId: version.id,
          branchSessionId: version.branchSessionId ?? version.sessionId,
          version: version.responseVersion ?? 1,
          active: activeMessageIds.has(version.id)
        }))
      }
    };
  });

  return {
    ...mapped,
    id: input.root.id,
    rootSessionId: input.root.id,
    activeBranchSessionId: input.active.id,
    conversationSchemaVersion: input.root.conversationSchemaVersion,
    messages,
    journalEntry: mapJournalEntry(input.root.joyEntry, requireLegacyDimension(input.root.dimension)),
    startedAt: input.root.startedAt.toISOString()
  };
}

async function readInterviewBranchProjection(input: {
  database?: DatabaseClient;
  rootSessionId: string;
  branchSessionId: string;
  userId?: string;
}) {
  const database = input.database ?? prisma;
  const rootPromise = database.interviewSession.findUnique({
    where: { id: input.rootSessionId },
    include: interviewSessionInclude
  });
  const activePromise = input.branchSessionId === input.rootSessionId
    ? rootPromise
    : database.interviewSession.findUnique({
        where: { id: input.branchSessionId },
        include: interviewSessionInclude
      });
  const effectiveMessagesPromise = resolveEffectiveInterviewMessagesForRoot(
    database,
    input.rootSessionId,
    input.branchSessionId
  );
  const [root, active, effectiveMessages] = await Promise.all([
    rootPromise,
    activePromise,
    effectiveMessagesPromise
  ]);

  if (
    !root ||
    !active ||
    (input.userId && root.userId !== input.userId) ||
    active.userId !== root.userId ||
    (active.rootSessionId ?? active.id) !== root.id ||
    effectiveMessages.length === 0
  ) {
    return null;
  }

  return mapActiveInterviewSession({ root, active, effectiveMessages }, database);
}

async function ensureInterviewEvents(database: DatabaseClient, sessionId: string) {
  const existing = await database.interviewSession.findUnique({
    where: { id: sessionId },
    include: interviewSessionInclude
  });

  if (!existing) {
    return null;
  }

  if (existing.events.length > 0 && existing.activeEventId) {
    return existing;
  }

  const fallbackSnapshot = mapSnapshot(existing.snapshots[0]);
  const fallbackEvidence = assessDimensionEvidence(
    existing.dimension as InterviewDimension,
    fallbackSnapshot,
    existing.events[0]?.snapshotData
  );
  const createdEvent =
    existing.events[0] ??
    (await database.interviewEvent.create({
      data: {
        sessionId,
        sequence: 1,
        status: existing.stage === "finalize" ? "completed" : "active",
        stage: existing.stage,
        explorationRound: 1,
        coveredLenses: [],
        roundCoveredLenses: [],
        roundMeaningfulReplyCount: 0,
        totalMeaningfulReplyCount: existing.turnCount,
        startMessageSequence: 0,
        event: fallbackSnapshot.event,
        feeling: fallbackSnapshot.feeling,
        whyItMattered: fallbackSnapshot.whyItMattered,
        happinessType: fallbackSnapshot.happinessType,
        selfPattern: fallbackSnapshot.selfPattern,
        snapshotData: toJsonValue(fallbackEvidence.snapshotData),
        confidence: fallbackEvidence.confidence,
        missingSlots: fallbackEvidence.missingSlots,
        draftSummary: existing.draftSummary,
        startedAt: existing.startedAt,
        completedAt: existing.completedAt
      }
    }));

  if (existing.events[0]) {
    await database.interviewEvent.update({
      where: { id: createdEvent.id },
      data: {
        snapshotData: toJsonValue(fallbackEvidence.snapshotData),
        confidence: fallbackEvidence.confidence,
        missingSlots: fallbackEvidence.missingSlots
      }
    });
  }

  await database.interviewSession.update({
    where: { id: sessionId },
    data: {
      activeEventId: existing.activeEventId ?? createdEvent.id
    }
  });

  return database.interviewSession.findUnique({
    where: { id: sessionId },
    include: interviewSessionInclude
  });
}

export async function createJoyInterviewSession(
  userId: string,
  dimension: InterviewDimension,
  openingQuestion: string,
  entryDate?: string,
  options?: { requestId?: string | null }
) {
  const emptySnapshot = createEmptySnapshot();
  const openingAssistantTurn = createOpeningAssistantTurnPayload(openingQuestion);
  const emptyEvidence = assessDimensionEvidence(
    dimension,
    emptySnapshot,
    buildSnapshotDataForDimension(dimension, emptySnapshot)
  );
  const emptySnapshotData = emptyEvidence.snapshotData;
  const resolvedEntryDate = parseEntryDateInput(entryDate ?? getTodayEntryDate());
  const sessionId = randomUUID();
  const activeEventId = randomUUID();
  const assistantMessageId = randomUUID();
  const generationTraceId = randomUUID();

  const checkpointWrite = prisma.interviewBranchCheckpoint?.create
    ? prisma.interviewBranchCheckpoint.create({
        data: {
          sessionId,
          messageId: assistantMessageId,
          schemaVersion: 1,
          sessionState: toJsonValue({
            status: "active",
            stage: "collect_event",
            activeEventId,
            turnCount: 0,
            lastAssistantQuestion: openingQuestion,
            draftSummary: null
          }),
          eventsState: toJsonValue([
            {
              id: activeEventId,
              sequence: 1,
              status: "active",
              stage: "collect_event",
              explorationRound: 1,
              coveredLenses: [],
              roundCoveredLenses: [],
              roundMeaningfulReplyCount: 0,
              totalMeaningfulReplyCount: 0,
              startMessageSequence: 0,
              snapshotData: emptySnapshotData,
              progressData: null,
              confidence: emptyEvidence.confidence,
              missingSlots: emptyEvidence.missingSlots,
              draftSummary: null
            }
          ])
        }
      })
    : null;

  await prisma.$transaction([
    prisma.interviewSession.create({
      data: {
        id: sessionId,
        userId,
        dimension: dimension as PrismaInterviewDimension,
        conversationSchemaVersion: 2,
        rootSessionId: sessionId,
        activeBranchSessionId: sessionId,
        status: "active",
        stage: "collect_event",
        entryDate: resolvedEntryDate,
        lastAssistantQuestion: openingQuestion,
        snapshots: {
          create: [
            {
              version: 0,
              event: emptySnapshot.event,
              feeling: emptySnapshot.feeling,
              whyItMattered: emptySnapshot.whyItMattered,
              happinessType: emptySnapshot.happinessType,
              selfPattern: emptySnapshot.selfPattern,
              confidence: emptyEvidence.confidence,
              missingSlots: emptyEvidence.missingSlots
            }
          ]
        }
      }
    }),
    prisma.aIGenerationTrace.create({
      data: {
        id: generationTraceId,
        requestId: options?.requestId ?? null,
        userId,
        sessionId,
        dimension: dimension as PrismaInterviewDimension,
        artifactType: "interview_turn",
        artifactId: assistantMessageId,
        artifactVersion: 1,
        status: "completed",
        outputOrigin: "deterministic",
        contextSnapshot: toJsonValue({
          kind: "interview_opening",
          entryDate: formatEntryDate(resolvedEntryDate),
          dimension,
          snapshot: emptySnapshotData,
          messageIds: []
        }),
        finalOutput: toJsonValue(openingAssistantTurn),
        pipelineDecisions: toJsonValue([{ kind: "deterministic_opening" }]),
        completedAt: new Date()
      }
    }),
    prisma.interviewMessage.create({
      data: {
        id: assistantMessageId,
        sessionId,
        generationTraceId,
        responseGroupId: assistantMessageId,
        responseVersion: 1,
        branchSessionId: sessionId,
        role: "assistant",
        content: serializeAssistantTurnPayload(openingAssistantTurn),
        sequence: 0
      }
    }),
    prisma.interviewEvent.create({
      data: {
        id: activeEventId,
        sessionId,
        sequence: 1,
        status: "active",
        stage: "collect_event",
        explorationRound: 1,
        coveredLenses: [],
        roundCoveredLenses: [],
        roundMeaningfulReplyCount: 0,
        totalMeaningfulReplyCount: 0,
        startMessageSequence: 0,
        event: emptySnapshot.event,
        feeling: emptySnapshot.feeling,
        whyItMattered: emptySnapshot.whyItMattered,
        happinessType: emptySnapshot.happinessType,
        selfPattern: emptySnapshot.selfPattern,
        snapshotData: toJsonValue(emptySnapshotData),
        confidence: emptyEvidence.confidence,
        missingSlots: emptyEvidence.missingSlots
      }
    }),
    prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        activeEventId
      }
    }),
    ...(checkpointWrite ? [checkpointWrite] : [])
  ]);

  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: interviewSessionInclude
  });

  if (!session) {
    throw new Error("SESSION_CREATE_FAILED");
  }

  return mapInterviewSession(session);
}

export async function findJoyInterviewSessionById(sessionId: string, userId?: string) {
  const route = await resolveInterviewSessionRoute(prisma, sessionId);

  if (!route || (userId && route.userId !== userId)) {
    return null;
  }

  const root = await ensureInterviewEvents(prisma, route.rootId);
  const active =
    route.activeBranchSessionId === route.rootId
      ? root
      : await ensureInterviewEvents(prisma, route.activeBranchSessionId);

  if (!root || !active) {
    return null;
  }

  const effectiveMessages = await resolveEffectiveInterviewMessages(prisma, active.id);

  return mapActiveInterviewSession({ root, active, effectiveMessages });
}

export type ReservedInterviewRegeneration = {
  kind: "reserved" | "completed";
  turn: PersistedInterviewUserTurnRecord;
  regenerationId: string;
  generationTraceId: string;
  session: InterviewSessionRecord;
  targetMessage: InterviewMessage;
};

export async function reserveInterviewRegeneration(input: {
  userId: string;
  sessionId: string;
  targetMessageId: string;
  intent: InterviewRegenerationIntent;
  clientTurnId: string;
  baseMessageSequence?: number;
  baseBranchSessionId: string;
}): Promise<ReservedInterviewRegeneration> {
  const route = await resolveInterviewSessionRoute(prisma, input.sessionId);

  if (!route || route.userId !== input.userId) {
    throw new Error("SESSION_NOT_FOUND");
  }

  if (route.mode === "event_centered") {
    throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
  }

  if (route.conversationSchemaVersion < 2) {
    throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
  }

  if (!isInterviewRegenerationEnabled()) {
    throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
  }

  const existingRootTurn = await prisma.interviewUserTurn.findFirst({
    where: {
      clientTurnId: input.clientTurnId,
      action: "regenerate_question",
      session: {
        userId: input.userId,
        OR: [
          { id: route.rootId },
          { rootSessionId: route.rootId }
        ]
      }
    }
  });

  if (existingRootTurn) {
    const existingRegeneration = await prisma.aIResponseRegeneration.findUnique({
      where: { userTurnId: existingRootTurn.id }
    });

    if (!existingRegeneration?.generatedTraceId) {
      throw new Error("INTERVIEW_REGENERATION_FAILED");
    }

    if (existingRootTurn.status === "processing") {
      throw new Error("INTERVIEW_TURN_IN_PROGRESS");
    }

    if (existingRootTurn.status !== "completed") {
      throw new Error("INTERVIEW_TURN_RETRY_REQUIRED");
    }

    const [session, sourceMessage] = await Promise.all([
      findJoyInterviewSessionById(route.rootId, input.userId),
      prisma.interviewMessage.findUnique({
        where: { id: existingRegeneration.sourceMessageId },
        select: { responseGroupId: true }
      })
    ]);
    const targetMessage = session?.messages.find(
      (message) =>
        message.responseVersion?.groupId === sourceMessage?.responseGroupId &&
        message.responseVersion?.versions.some((version) => version.active)
    );

    if (!session || !targetMessage) {
      throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
    }

    return {
      kind: "completed",
      turn: mapStandaloneInterviewUserTurn(existingRootTurn),
      regenerationId: existingRegeneration.id,
      generationTraceId: existingRegeneration.generatedTraceId,
      session,
      targetMessage
    };
  }

  if (route.activeBranchSessionId !== input.baseBranchSessionId) {
    throw new Error("INTERVIEW_BRANCH_OUT_OF_DATE");
  }

  const effectiveMessages = await resolveEffectiveInterviewMessages(prisma, route.activeBranchSessionId);
  const target = effectiveMessages.find((message) => message.id === input.targetMessageId);
  const targetPayload =
    target?.role === "assistant" ? parseAssistantTurnPayload(target.content) : null;

  if (!target || !targetPayload?.question || targetPayload.stateUpdate.offerChoice || !target.responseGroupId) {
    throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
  }

  const latestSequence = effectiveMessages[effectiveMessages.length - 1]?.sequence ?? -1;
  const requestedBaseSequence = input.baseMessageSequence ?? latestSequence;

  if (requestedBaseSequence !== latestSequence) {
    throw new Error("INTERVIEW_TURN_OUT_OF_DATE");
  }

  const [root, checkpoint, versionCount] = await Promise.all([
    prisma.interviewSession.findUnique({
      where: { id: route.rootId },
      include: {
        joyEntry: true,
        journalEvent: { select: { id: true } }
      }
    }),
    prisma.interviewBranchCheckpoint.findUnique({
      where: { messageId: target.id }
    }),
    prisma.interviewMessage.count({
      where: { responseGroupId: target.responseGroupId }
    })
  ]);

  if (!root || !checkpoint) {
    throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
  }

  if (versionCount >= 3) {
    throw new Error("INTERVIEW_REGENERATION_LIMIT_REACHED");
  }

  const latestAssistantSequence = Math.max(
    -1,
    ...effectiveMessages
      .filter((message) => message.role === "assistant")
      .map((message) => message.sequence)
  );
  if (root.joyEntry && target.sequence < latestAssistantSequence) {
    throw new Error("INTERVIEW_BRANCH_LOCKED_BY_JOURNAL");
  }

  const result = await prisma.$transaction(async (database) => {
    const existingTurn = await database.interviewUserTurn.findUnique({
      where: {
        sessionId_clientTurnId: {
          sessionId: route.activeBranchSessionId,
          clientTurnId: input.clientTurnId
        }
      }
    });

    if (existingTurn) {
      const regeneration = await database.aIResponseRegeneration.findUnique({
        where: { userTurnId: existingTurn.id }
      });

      if (!regeneration) {
        throw new Error("INTERVIEW_REGENERATION_FAILED");
      }

      if (existingTurn.status === "completed") {
        return {
          kind: "completed" as const,
          turn: existingTurn,
          regeneration
        };
      }

      if (existingTurn.status === "processing") {
        throw new Error("INTERVIEW_TURN_IN_PROGRESS");
      }

      throw new Error("INTERVIEW_TURN_RETRY_REQUIRED");
    }

    const unresolvedTurn = await database.interviewUserTurn.findFirst({
      where: {
        sessionId: route.activeBranchSessionId,
        OR: [
          { status: "processing" },
          {
            status: { in: ["failed", "canceled"] },
            action: { not: "regenerate_question" }
          }
        ]
      },
      select: { id: true }
    });

    if (unresolvedTurn) {
      throw new Error("INTERVIEW_TURN_IN_PROGRESS");
    }

    const turn = await database.interviewUserTurn.create({
      data: {
        clientTurnId: input.clientTurnId,
        sessionId: route.activeBranchSessionId,
        journalEventId: root.journalEvent?.id ?? null,
        activeEventId: root.activeEventId,
        action: "regenerate_question",
        targetMessageId: target.id,
        regenerationIntent: input.intent,
        baseBranchSessionId: input.baseBranchSessionId,
        baseMessageSequence: requestedBaseSequence,
        status: "processing"
      }
    });
    const generationTraceId = randomUUID();
    await database.aIGenerationTrace.create({
      data: {
        id: generationTraceId,
        userId: route.userId,
        sessionId: route.activeBranchSessionId,
        journalEventId: root.journalEvent?.id ?? null,
        dimension: root.dimension,
        artifactType: "interview_turn",
        triggerMessageId: target.id,
        status: "pending",
        contextSnapshot: toJsonValue({
          action: "regenerate_question",
          rootSessionId: route.rootId,
          sourceBranchSessionId: route.activeBranchSessionId,
          targetMessageId: target.id,
          intent: input.intent,
          sourceTraceId: target.generationTraceId
        }),
        pipelineDecisions: toJsonValue([])
      }
    });
    await database.aIResponseRegeneration.updateMany({
      where: {
        branchSessionId: route.activeBranchSessionId,
        status: "completed",
        replacedAt: null
      },
      data: {
        replacedAt: new Date()
      }
    });
    const regeneration = await database.aIResponseRegeneration.create({
      data: {
        rootSessionId: route.rootId,
        branchSessionId: route.activeBranchSessionId,
        targetMessageId: target.id,
        sourceMessageId: target.id,
        sourceTraceId: target.generationTraceId,
        generatedTraceId: generationTraceId,
        userTurnId: turn.id,
        intent: input.intent,
        status: "processing"
      }
    });

    return {
      kind: "reserved" as const,
      turn,
      regeneration
    };
  });
  const session = await findJoyInterviewSessionById(route.rootId, input.userId);

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  const targetMessage =
    session.messages.find((message) => message.id === target.id) ??
    session.messages.find(
      (message) =>
        message.responseVersion?.groupId === target.responseGroupId &&
        message.responseVersion?.versions.some((version) => version.active)
    );

  if (!targetMessage) {
    throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
  }

  return {
    kind: result.kind,
    turn: mapStandaloneInterviewUserTurn(result.turn),
    regenerationId: result.regeneration.id,
    generationTraceId: result.regeneration.generatedTraceId!,
    session,
    targetMessage
  };
}

export async function resumeInterviewRegeneration(input: {
  userId: string;
  sessionId: string;
  clientTurnId: string;
}): Promise<ReservedInterviewRegeneration> {
  const route = await resolveInterviewSessionRoute(prisma, input.sessionId);

  if (!route || route.userId !== input.userId) {
    throw new Error("INTERVIEW_TURN_NOT_FOUND");
  }

  if (route.mode === "event_centered") {
    throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
  }

  const result = await prisma.$transaction(async (database) => {
    const turn = await database.interviewUserTurn.findFirst({
      where: {
        clientTurnId: input.clientTurnId,
        action: "regenerate_question",
        session: {
          userId: input.userId,
          OR: [
            { id: route.rootId },
            { rootSessionId: route.rootId }
          ]
        }
      }
    });

    if (!turn) {
      throw new Error("INTERVIEW_ACTION_UNSUPPORTED");
    }

    const regeneration = await database.aIResponseRegeneration.findUnique({
      where: { userTurnId: turn.id }
    });

    if (!regeneration?.generatedTraceId) {
      throw new Error("INTERVIEW_REGENERATION_FAILED");
    }

    if (turn.status === "completed" && regeneration.status === "completed") {
      return {
        kind: "completed" as const,
        turn,
        regeneration
      };
    }

    if (route.activeBranchSessionId !== regeneration.branchSessionId) {
      throw new Error("INTERVIEW_BRANCH_OUT_OF_DATE");
    }

    if (turn.status === "processing" && !isInterviewUserTurnLeaseExpired(turn)) {
      throw new Error("INTERVIEW_TURN_IN_PROGRESS");
    }

    const staleProcessingCutoff = new Date(Date.now() - INTERVIEW_USER_TURN_LEASE_MS);
    const updated = await database.interviewUserTurn.updateMany({
      where: {
        id: turn.id,
        OR: [
          { status: { in: ["failed", "canceled"] } },
          {
            status: "processing",
            updatedAt: { lte: staleProcessingCutoff }
          }
        ]
      },
      data: {
        status: "processing",
        attemptCount: { increment: 1 },
        errorCode: null,
        completedAt: null
      }
    });

    if (updated.count !== 1) {
      throw new Error("INTERVIEW_TURN_IN_PROGRESS");
    }

    await database.aIResponseRegeneration.update({
      where: { id: regeneration.id },
      data: {
        status: "processing",
        errorCode: null
      }
    });
    await database.aIGenerationTrace.update({
      where: { id: regeneration.generatedTraceId },
      data: {
        status: "pending",
        errorCode: null,
        failedAt: null,
        completedAt: null
      }
    });
    const updatedTurn = await database.interviewUserTurn.findUnique({
      where: { id: turn.id }
    });

    if (!updatedTurn) {
      throw new Error("INTERVIEW_TURN_NOT_FOUND");
    }

    return {
      kind: "reserved" as const,
      turn: updatedTurn,
      regeneration
    };
  });
  const [session, sourceMessage] = await Promise.all([
    findJoyInterviewSessionById(route.rootId, input.userId),
    prisma.interviewMessage.findUnique({
      where: { id: result.regeneration.sourceMessageId },
      select: { responseGroupId: true }
    })
  ]);
  const targetMessage =
    session?.messages.find((message) => message.id === result.regeneration.sourceMessageId) ??
    session?.messages.find(
      (message) =>
        message.responseVersion?.groupId === sourceMessage?.responseGroupId &&
        message.responseVersion?.versions.some((version) => version.active)
    );

  if (!session || !targetMessage) {
    throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
  }

  return {
    kind: result.kind,
    turn: mapStandaloneInterviewUserTurn(result.turn),
    regenerationId: result.regeneration.id,
    generationTraceId: result.regeneration.generatedTraceId!,
    session,
    targetMessage
  };
}

function readCheckpointRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readCheckpointEvents(value: unknown) {
  return Array.isArray(value)
    ? value.filter((event): event is Record<string, unknown> => Boolean(event && typeof event === "object"))
    : [];
}

function checkpointString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function checkpointStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function checkpointNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function checkpointDate(value: unknown) {
  return typeof value === "string" || value instanceof Date ? new Date(value) : undefined;
}

export async function completeInterviewRegeneration(input: {
  userId: string;
  sessionId: string;
  regenerationId: string;
  userTurnId: string;
  targetMessageId: string;
  intent: InterviewRegenerationIntent;
  assistantTurn: AssistantTurnPayload;
  candidates: unknown;
  selectedCandidate: number;
  checks: unknown;
  requestId?: string | null;
  outputOrigin: "llm" | "deterministic" | "fallback";
  latencyMs: number;
  eventCenteredAngleRepairResolutions?: JournalEventAngleRepairResolutionInput[];
}) {
  const assistantMessageId = randomUUID();
  const childSessionId = randomUUID();

  const rootId = await prisma.$transaction(async (database) => {
    const regeneration = await database.aIResponseRegeneration.findUnique({
      where: { id: input.regenerationId }
    });

    if (
      !regeneration ||
      regeneration.userTurnId !== input.userTurnId ||
      !regeneration.generatedTraceId
    ) {
      throw new Error("INTERVIEW_REGENERATION_FAILED");
    }
    const generationTraceId = regeneration.generatedTraceId;

    if (regeneration.status === "completed" && regeneration.generatedMessageId) {
      return regeneration.rootSessionId;
    }

    const target = await database.interviewMessage.findUnique({
      where: { id: input.targetMessageId }
    });

    if (!target?.responseGroupId) {
      throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
    }

    const [root, sourceBranch, checkpoint, versionCount] = await Promise.all([
      database.interviewSession.findUnique({
        where: { id: regeneration.rootSessionId },
        include: { journalEvent: { select: { id: true } } }
      }),
      database.interviewSession.findUnique({ where: { id: regeneration.branchSessionId } }),
      database.interviewBranchCheckpoint.findUnique({ where: { messageId: input.targetMessageId } }),
      database.interviewMessage.count({
        where: { responseGroupId: target.responseGroupId }
      })
    ]);

    if (!root || !sourceBranch || !target?.responseGroupId || !checkpoint) {
      throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
    }

    if (root.userId !== input.userId || root.activeBranchSessionId !== sourceBranch.id) {
      throw new Error("INTERVIEW_BRANCH_OUT_OF_DATE");
    }

    if (versionCount >= 3) {
      throw new Error("INTERVIEW_REGENERATION_LIMIT_REACHED");
    }

    const sessionState = readCheckpointRecord(checkpoint.sessionState);
    const checkpointEvents = readCheckpointEvents(checkpoint.eventsState);
    const eventIdMap = new Map<string, string>();

    for (const event of checkpointEvents) {
      const previousId = checkpointString(event.id);
      if (previousId) {
        eventIdMap.set(previousId, randomUUID());
      }
    }
    const clonedCheckpointEvents: Array<Record<string, unknown>> = checkpointEvents.map((event) => {
      const previousId = checkpointString(event.id);
      return {
        ...event,
        id: (previousId ? eventIdMap.get(previousId) : null) ?? randomUUID()
      };
    });
    let checkpointEventsState = clonedCheckpointEvents;

    const previousActiveEventId = checkpointString(sessionState.activeEventId);
    const activeEventId =
      (previousActiveEventId ? eventIdMap.get(previousActiveEventId) : null) ??
      checkpointString(clonedCheckpointEvents[0]?.id) ??
      null;
    const stage =
      sessionState.stage === "collect_event" ||
      sessionState.stage === "probe_reason" ||
      sessionState.stage === "probe_pattern" ||
      sessionState.stage === "wrap_up" ||
      sessionState.stage === "finalize"
        ? sessionState.stage
        : sourceBranch.stage;
    const status =
      sessionState.status === "active" ||
      sessionState.status === "paused" ||
      sessionState.status === "completed" ||
      sessionState.status === "abandoned"
        ? sessionState.status
        : "active";

    await database.interviewSession.create({
      data: {
        id: childSessionId,
        userId: root.userId,
        mode: root.mode,
        dimension: root.dimension,
        conversationSchemaVersion: root.conversationSchemaVersion,
        rootSessionId: root.id,
        parentSessionId: sourceBranch.id,
        forkMessageSequence: target.sequence,
        forkedFromMessageId: target.id,
        branchDepth: sourceBranch.branchDepth + 1,
        status,
        stage,
        turnCount: checkpointNumber(sessionState.turnCount, sourceBranch.turnCount),
        entryDate: root.entryDate,
        startedAt: root.startedAt,
        pausedAt: status === "paused" ? root.pausedAt : null,
        completedAt: status === "completed" ? root.completedAt : null,
        lastAssistantQuestion: input.assistantTurn.question,
        draftSummary: checkpointString(sessionState.draftSummary),
        snapshots: {
          create: [
            {
              version: 0,
              event: null,
              feeling: null,
              whyItMattered: null,
              happinessType: null,
              selfPattern: null,
              confidence: null,
              missingSlots: []
            }
          ]
        }
      }
    });

    if (checkpointEvents.length > 0) {
      await database.interviewEvent.createMany({
        data: clonedCheckpointEvents.map((event, index) => {
          return {
            id: checkpointString(event.id)!,
            sessionId: childSessionId,
            sequence: checkpointNumber(event.sequence, index + 1),
            status:
              event.status === "active" || event.status === "ready_for_choice" || event.status === "completed"
                ? event.status
                : "active",
            stage:
              event.stage === "collect_event" ||
              event.stage === "probe_reason" ||
              event.stage === "probe_pattern" ||
              event.stage === "wrap_up" ||
              event.stage === "finalize"
                ? event.stage
                : stage,
            explorationRound: checkpointNumber(event.explorationRound, 1),
            coveredLenses: checkpointStringArray(event.coveredLenses),
            roundCoveredLenses: checkpointStringArray(event.roundCoveredLenses),
            roundMeaningfulReplyCount: checkpointNumber(event.roundMeaningfulReplyCount),
            totalMeaningfulReplyCount: checkpointNumber(event.totalMeaningfulReplyCount),
            startMessageSequence: checkpointNumber(event.startMessageSequence),
            event: checkpointString(event.event),
            feeling: checkpointString(event.feeling),
            whyItMattered: checkpointString(event.whyItMattered),
            happinessType: checkpointString(event.happinessType),
            selfPattern: checkpointString(event.selfPattern),
            snapshotData:
              event.snapshotData === null || event.snapshotData === undefined
                ? Prisma.JsonNull
                : toJsonValue(event.snapshotData),
            progressData:
              event.progressData === null || event.progressData === undefined
                ? Prisma.JsonNull
                : toJsonValue(event.progressData),
            confidence: typeof event.confidence === "number" ? event.confidence : null,
            missingSlots: checkpointStringArray(event.missingSlots),
            draftSummary: checkpointString(event.draftSummary),
            startedAt: checkpointDate(event.startedAt),
            completedAt: checkpointDate(event.completedAt)
          };
        })
      });
    }

    if (activeEventId) {
      await database.interviewSession.update({
        where: { id: childSessionId },
        data: { activeEventId }
      });
    }

    const regenerationTraceDecisions = [
      {
        kind: "intent_regeneration",
        intent: input.intent,
        selectedCandidate: input.selectedCandidate,
        checks: input.checks
      }
    ];
    await database.aIGenerationTrace.update({
      where: { id: generationTraceId },
      data: {
        requestId: input.requestId ?? null,
        sessionId: childSessionId,
        artifactId: assistantMessageId,
        artifactVersion: 1,
        triggerMessageId: target.id,
        status: "completed",
        outputOrigin: input.outputOrigin,
        contextSnapshot: toJsonValue({
          action: "regenerate_question",
          rootSessionId: root.id,
          sourceBranchSessionId: sourceBranch.id,
          targetMessageId: target.id,
          intent: input.intent
        }),
        finalOutput: toJsonValue(input.assistantTurn),
        pipelineDecisions: toJsonValue(regenerationTraceDecisions),
        completedAt: new Date()
      }
    });
    await database.interviewMessage.create({
      data: {
        id: assistantMessageId,
        sessionId: childSessionId,
        userTurnId: input.userTurnId,
        generationTraceId,
        responseGroupId: target.responseGroupId,
        responseVersion: versionCount + 1,
        regenerationIntent: input.intent,
        regeneratedFromMessageId: target.id,
        branchSessionId: childSessionId,
        role: "assistant",
        content: serializeAssistantTurnPayload(input.assistantTurn),
        sequence: target.sequence
      }
    });
    await database.interviewSession.update({
      where: { id: root.id },
      data: {
        activeBranchSessionId: childSessionId
      }
    });
    if (root.mode === "event_centered") {
      if (!root.journalEvent) {
        throw new Error("EVENT_STATE_CHANGED");
      }
      const angleResult = await commitJournalEventAngleResultsWithClient(database, {
        userId: input.userId,
        eventId: root.journalEvent.id,
        activeBranchSessionId: childSessionId,
        sourceTurnId: input.userTurnId,
        assistantMessageId,
        generationTraceId,
        createdFactIdsByWriteIndex: [],
        angleRepairResolutions: input.eventCenteredAngleRepairResolutions
      });
      const angleTraceDecision = angleResultTraceDecision(angleResult, {
        angleRepairResolutions: input.eventCenteredAngleRepairResolutions
      });
      if (angleTraceDecision) {
        await database.aIGenerationTrace.update({
          where: { id: generationTraceId },
          data: {
            pipelineDecisions: toJsonValue([
              ...regenerationTraceDecisions,
              angleTraceDecision
            ])
          }
        });
      }
      if ((input.eventCenteredAngleRepairResolutions?.length ?? 0) > 0 && activeEventId) {
        const branchState = await database.interviewEvent.findUnique({
          where: { id: activeEventId }
        });
        if (!branchState || branchState.sessionId !== childSessionId) {
          throw new Error("EVENT_STATE_CHANGED");
        }
        const snapshotData = {
          ...readCheckpointRecord(branchState.snapshotData),
          lastAngleOutcomeIds: angleResult.angleOutcomeIds,
          reopenedAngles: angleResult.reopenedAngles,
          pendingAngleOutcomeRepairIds: [],
          repairPendingAngles: []
        };
        await database.interviewEvent.update({
          where: { id: branchState.id },
          data: { snapshotData: toJsonValue(snapshotData) }
        });
        checkpointEventsState = checkpointEventsState.map((event) =>
          checkpointString(event.id) === branchState.id
            ? { ...event, snapshotData }
            : event
        );
      }
    }
    await database.interviewBranchCheckpoint.create({
      data: {
        sessionId: childSessionId,
        messageId: assistantMessageId,
        schemaVersion: checkpoint.schemaVersion,
        sessionState: toJsonValue({
          ...sessionState,
          activeEventId,
          lastAssistantQuestion: input.assistantTurn.question
        }),
        eventsState: toJsonValue(checkpointEventsState)
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
    await database.aIResponseRegeneration.update({
      where: { id: input.regenerationId },
      data: {
        branchSessionId: childSessionId,
        generatedMessageId: assistantMessageId,
        generatedTraceId: generationTraceId,
        candidates: toJsonValue(input.candidates),
        selectedCandidate: input.selectedCandidate,
        checks: toJsonValue(input.checks),
        status: "completed",
        latencyMs: input.latencyMs,
        completedAt: new Date(),
        errorCode: null
      }
    });
    return root.id;
  });

  const rootMode = await prisma.interviewSession.findUnique({
    where: { id: rootId },
    select: { mode: true }
  });
  if (rootMode?.mode === "event_centered") {
    const identity = await getEventCenteredSessionIdentity(input.userId, rootId);
    if (!identity) throw new Error("SESSION_NOT_FOUND");
    return identity;
  }
  const session = await findJoyInterviewSessionById(rootId, input.userId);

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  return session;
}

export async function failInterviewRegeneration(input: {
  regenerationId: string;
  userTurnId: string;
  errorCode: string;
  canceled?: boolean;
}) {
  const regeneration = await prisma.aIResponseRegeneration.findUnique({
    where: { id: input.regenerationId },
    select: { generatedTraceId: true }
  });
  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.aIResponseRegeneration.updateMany({
      where: {
        id: input.regenerationId,
        status: "processing"
      },
      data: {
        status: input.canceled ? "canceled" : "failed",
        errorCode: input.errorCode
      }
    }),
    prisma.interviewUserTurn.updateMany({
      where: {
        id: input.userTurnId,
        status: "processing"
      },
      data: {
        status: input.canceled ? "canceled" : "failed",
        errorCode: input.errorCode
      }
    })
  ];

  if (regeneration?.generatedTraceId) {
    writes.push(
      prisma.aIGenerationTrace.updateMany({
        where: {
          id: regeneration.generatedTraceId,
          status: "pending"
        },
        data: {
          status: input.canceled ? "canceled" : "failed",
          errorCode: input.errorCode,
          failedAt: new Date()
        }
      })
    );
  }

  await prisma.$transaction(writes);
}

async function resolveInterviewBranchSelection(input: {
  userId: string;
  sessionId: string;
  targetMessageId: string;
  baseBranchSessionId: string;
}) {
  const route = await resolveInterviewSessionRoute(prisma, input.sessionId);

  if (!route || route.userId !== input.userId) {
    throw new Error("SESSION_NOT_FOUND");
  }

  if (route.activeBranchSessionId !== input.baseBranchSessionId) {
    throw new Error("INTERVIEW_BRANCH_OUT_OF_DATE");
  }

  const [target, root, effectiveMessages] = await Promise.all([
    prisma.interviewMessage.findUnique({
      where: { id: input.targetMessageId },
      include: {
        session: {
          select: {
            rootSessionId: true,
            id: true
          }
        }
      }
    }),
    prisma.interviewSession.findUnique({
      where: { id: route.rootId },
      select: { joyEntry: { select: { id: true } } }
    }),
    resolveEffectiveInterviewMessagesForRoot(
      prisma,
      route.rootId,
      route.activeBranchSessionId
    )
  ]);
  const targetRootId = target?.session.rootSessionId ?? target?.session.id;

  if (!target || target.role !== "assistant" || targetRootId !== route.rootId) {
    throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
  }

  const latestAssistantSequence = Math.max(
    -1,
    ...effectiveMessages
      .filter((message) => message.role === "assistant")
      .map((message) => message.sequence)
  );
  if (root?.joyEntry && target.sequence < latestAssistantSequence) {
    throw new Error("INTERVIEW_BRANCH_LOCKED_BY_JOURNAL");
  }

  const targetBranchSessionId = target.branchSessionId ?? target.sessionId;

  return {
    route,
    targetBranchSessionId
  };
}

export async function previewInterviewBranch(input: {
  userId: string;
  sessionId: string;
  targetMessageId: string;
  baseBranchSessionId: string;
}) {
  const selection = await resolveInterviewBranchSelection(input);
  const session = await readInterviewBranchProjection({
    rootSessionId: selection.route.rootId,
    branchSessionId: selection.targetBranchSessionId,
    userId: input.userId
  });

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  return {
    targetBranchSessionId: selection.targetBranchSessionId,
    session
  };
}

export async function selectInterviewBranch(input: {
  userId: string;
  sessionId: string;
  targetMessageId: string;
  baseBranchSessionId: string;
}) {
  const selection = await resolveInterviewBranchSelection(input);
  const { route, targetBranchSessionId } = selection;

  if (targetBranchSessionId === route.activeBranchSessionId) {
    const currentSession = await readInterviewBranchProjection({
      rootSessionId: route.rootId,
      branchSessionId: targetBranchSessionId,
      userId: input.userId
    });

    if (!currentSession) {
      throw new Error("SESSION_NOT_FOUND");
    }

    return currentSession;
  }
  await prisma.$transaction([
    prisma.interviewSession.update({
      where: { id: route.rootId },
      data: {
        activeBranchSessionId: targetBranchSessionId
      }
    }),
    prisma.aIResponseRegeneration.updateMany({
      where: {
        rootSessionId: route.rootId,
        generatedMessageId: {
          not: null
        },
        branchSessionId: route.activeBranchSessionId
      },
      data: {
        switchedBackAt: new Date()
      }
    })
  ]);

  const session = await readInterviewBranchProjection({
    rootSessionId: route.rootId,
    branchSessionId: targetBranchSessionId,
    userId: input.userId
  });

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  return session;
}

export async function forkInterviewBranchForCorrection(input: {
  userId: string;
  sessionId: string;
  targetMessageId: string;
  baseBranchSessionId: string;
}) {
  const route = await resolveInterviewSessionRoute(prisma, input.sessionId);

  if (!route || route.userId !== input.userId) {
    throw new Error("SESSION_NOT_FOUND");
  }

  const activeBranch = await prisma.interviewSession.findUnique({
    where: { id: route.activeBranchSessionId }
  });

  if (
    route.activeBranchSessionId !== input.baseBranchSessionId &&
    !(
      activeBranch?.parentSessionId === input.baseBranchSessionId &&
      activeBranch.forkedFromMessageId === input.targetMessageId
    )
  ) {
    throw new Error("INTERVIEW_BRANCH_OUT_OF_DATE");
  }

  if (
    activeBranch?.parentSessionId === input.baseBranchSessionId &&
    activeBranch.forkedFromMessageId === input.targetMessageId
  ) {
    return findJoyInterviewSessionById(route.rootId, input.userId);
  }

  const effectiveMessages = await resolveEffectiveInterviewMessages(prisma, route.activeBranchSessionId);
  const target = effectiveMessages.find((message) => message.id === input.targetMessageId);
  const targetPayload =
    target?.role === "assistant" ? parseAssistantTurnPayload(target.content) : null;

  if (!target || !targetPayload?.question || targetPayload.stateUpdate.offerChoice) {
    throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
  }

  const [root, sourceBranch, checkpoint] = await Promise.all([
    prisma.interviewSession.findUnique({
      where: { id: route.rootId },
      include: { joyEntry: true }
    }),
    prisma.interviewSession.findUnique({
      where: { id: route.activeBranchSessionId }
    }),
    prisma.interviewBranchCheckpoint.findUnique({
      where: { messageId: target.id }
    })
  ]);

  if (!root || !sourceBranch || !checkpoint) {
    throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
  }

  const latestAssistantSequence = Math.max(
    -1,
    ...effectiveMessages
      .filter((message) => message.role === "assistant")
      .map((message) => message.sequence)
  );
  if (root.joyEntry && target.sequence < latestAssistantSequence) {
    throw new Error("INTERVIEW_BRANCH_LOCKED_BY_JOURNAL");
  }

  const sessionState = readCheckpointRecord(checkpoint.sessionState);
  const checkpointEvents = readCheckpointEvents(checkpoint.eventsState);
  const childSessionId = randomUUID();
  const eventIdMap = new Map<string, string>();

  for (const event of checkpointEvents) {
    const previousId = checkpointString(event.id);
    if (previousId) eventIdMap.set(previousId, randomUUID());
  }

  const previousActiveEventId = checkpointString(sessionState.activeEventId);
  const activeEventId =
    (previousActiveEventId ? eventIdMap.get(previousActiveEventId) : null) ??
    eventIdMap.values().next().value ??
    null;
  const stage =
    sessionState.stage === "collect_event" ||
    sessionState.stage === "probe_reason" ||
    sessionState.stage === "probe_pattern" ||
    sessionState.stage === "wrap_up" ||
    sessionState.stage === "finalize"
      ? sessionState.stage
      : sourceBranch.stage;

  await prisma.$transaction(async (database) => {
    const currentRoot = await database.interviewSession.findUnique({
      where: { id: root.id },
      select: { activeBranchSessionId: true }
    });

    if (currentRoot?.activeBranchSessionId !== sourceBranch.id) {
      throw new Error("INTERVIEW_BRANCH_OUT_OF_DATE");
    }

    await database.interviewSession.create({
      data: {
        id: childSessionId,
        userId: root.userId,
        dimension: root.dimension,
        conversationSchemaVersion: 2,
        rootSessionId: root.id,
        parentSessionId: sourceBranch.id,
        forkMessageSequence: target.sequence + 1,
        forkedFromMessageId: target.id,
        branchDepth: sourceBranch.branchDepth + 1,
        status: "active",
        stage,
        turnCount: checkpointNumber(sessionState.turnCount, sourceBranch.turnCount),
        entryDate: root.entryDate,
        startedAt: root.startedAt,
        lastAssistantQuestion: targetPayload.question,
        draftSummary: checkpointString(sessionState.draftSummary),
        snapshots: {
          create: [
            {
              version: 0,
              event: null,
              feeling: null,
              whyItMattered: null,
              happinessType: null,
              selfPattern: null,
              confidence: null,
              missingSlots: []
            }
          ]
        }
      }
    });

    if (checkpointEvents.length > 0) {
      await database.interviewEvent.createMany({
        data: checkpointEvents.map((event, index) => ({
          id:
            (checkpointString(event.id)
              ? eventIdMap.get(checkpointString(event.id)!)
              : null) ?? randomUUID(),
          sessionId: childSessionId,
          sequence: checkpointNumber(event.sequence, index + 1),
          status:
            event.status === "active" ||
            event.status === "ready_for_choice" ||
            event.status === "completed"
              ? event.status
              : "active",
          stage:
            event.stage === "collect_event" ||
            event.stage === "probe_reason" ||
            event.stage === "probe_pattern" ||
            event.stage === "wrap_up" ||
            event.stage === "finalize"
              ? event.stage
              : stage,
          explorationRound: checkpointNumber(event.explorationRound, 1),
          coveredLenses: checkpointStringArray(event.coveredLenses),
          roundCoveredLenses: checkpointStringArray(event.roundCoveredLenses),
          roundMeaningfulReplyCount: checkpointNumber(event.roundMeaningfulReplyCount),
          totalMeaningfulReplyCount: checkpointNumber(event.totalMeaningfulReplyCount),
          startMessageSequence: checkpointNumber(event.startMessageSequence),
          event: checkpointString(event.event),
          feeling: checkpointString(event.feeling),
          whyItMattered: checkpointString(event.whyItMattered),
          happinessType: checkpointString(event.happinessType),
          selfPattern: checkpointString(event.selfPattern),
          snapshotData:
            event.snapshotData === null || event.snapshotData === undefined
              ? Prisma.JsonNull
              : toJsonValue(event.snapshotData),
          progressData:
            event.progressData === null || event.progressData === undefined
              ? Prisma.JsonNull
              : toJsonValue(event.progressData),
          confidence: typeof event.confidence === "number" ? event.confidence : null,
          missingSlots: checkpointStringArray(event.missingSlots),
          draftSummary: checkpointString(event.draftSummary),
          startedAt: checkpointDate(event.startedAt),
          completedAt: checkpointDate(event.completedAt)
        }))
      });
    }

    if (activeEventId) {
      await database.interviewSession.update({
        where: { id: childSessionId },
        data: { activeEventId }
      });
    }

    await database.interviewSession.update({
      where: { id: root.id },
      data: { activeBranchSessionId: childSessionId }
    });
  });

  return findJoyInterviewSessionById(root.id, input.userId);
}

export async function markInterviewUserTurnAsCorrection(input: {
  sessionId: string;
  clientTurnId: string;
  targetMessageId: string;
  baseBranchSessionId: string;
}) {
  const route = await resolveInterviewSessionRoute(prisma, input.sessionId);

  if (!route) return;

  await prisma.interviewUserTurn.updateMany({
    where: {
      sessionId: route.activeBranchSessionId,
      clientTurnId: input.clientTurnId
    },
    data: {
      action: "correct_understanding",
      targetMessageId: input.targetMessageId,
      baseBranchSessionId: input.baseBranchSessionId
    }
  });
}

interface ReserveInterviewUserTurnInput {
  userId: string;
  sessionId: string;
  activeEventId: string | null;
  clientTurnId: string;
  action: InterviewUserTurnAction;
  targetMessageId?: string | null;
  regenerationIntent?: PrismaInterviewRegenerationIntent | null;
  baseBranchSessionId?: string | null;
  rawText: string | null;
  inputMode?: InputMode;
  baseMessageSequence?: number;
}

export type PersistedInterviewUserTurnRecord = InterviewUserTurnRecord & {
  intentAssessment?: unknown;
  intentClassifierVersion?: string | null;
  intentDecision?: unknown;
  intentAssessedAt?: string | null;
};

export type ReserveInterviewUserTurnResult =
  | {
      kind: "reserved";
      turn: PersistedInterviewUserTurnRecord;
      userMessageId: string | null;
      session: InterviewSessionRecord;
    }
  | {
      kind: "completed";
      turn: PersistedInterviewUserTurnRecord;
      userMessageId: string | null;
      session: InterviewSessionRecord;
    };

function mapStandaloneInterviewUserTurn(turn: {
  id: string;
  clientTurnId: string;
  sessionId: string;
  activeEventId: string | null;
  action: InterviewUserTurnAction;
  targetMessageId?: string | null;
  regenerationIntent?: PrismaInterviewRegenerationIntent | null;
  baseBranchSessionId?: string | null;
  rawText: string | null;
  inputMode: InputMode | null;
  baseMessageSequence: number;
  status: InterviewUserTurnRecord["status"];
  attemptCount: number;
  errorCode: string | null;
  intentAssessment?: unknown;
  intentClassifierVersion?: string | null;
  intentDecision?: unknown;
  intentAssessedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}): PersistedInterviewUserTurnRecord {
  return {
    ...turn,
    inputMode: turn.inputMode ?? undefined,
    intentAssessment: turn.intentAssessment,
    intentClassifierVersion: turn.intentClassifierVersion ?? null,
    intentDecision: turn.intentDecision,
    intentAssessedAt: turn.intentAssessedAt?.toISOString() ?? null,
    createdAt: turn.createdAt.toISOString(),
    updatedAt: turn.updatedAt.toISOString(),
    completedAt: turn.completedAt?.toISOString() ?? null
  };
}

export async function reserveInterviewUserTurn(
  input: ReserveInterviewUserTurnInput
): Promise<ReserveInterviewUserTurnResult> {
  const route = await resolveInterviewSessionRoute(prisma, input.sessionId);

  if (!route || route.userId !== input.userId) {
    throw new Error("SESSION_NOT_FOUND");
  }

  if (input.baseBranchSessionId && input.baseBranchSessionId !== route.activeBranchSessionId) {
    throw new Error("INTERVIEW_BRANCH_OUT_OF_DATE");
  }

  const physicalSessionId = route.activeBranchSessionId;
  const result = await prisma.$transaction(async (database) => {
      const session = await database.interviewSession.findUnique({
        where: { id: physicalSessionId },
        select: { id: true, userId: true, mode: true, entryDate: true }
      });

      if (!session || session.userId !== input.userId) {
        throw new Error("SESSION_NOT_FOUND");
      }

      const existingTurn = await database.interviewUserTurn.findUnique({
        where: {
          sessionId_clientTurnId: {
            sessionId: physicalSessionId,
            clientTurnId: input.clientTurnId
          }
        },
        include: {
          messages: {
            where: { role: "user" },
            take: 1
          }
        }
      });

      if (existingTurn) {
        if (existingTurn.status === "completed") {
          return {
            kind: "completed" as const,
            turn: existingTurn,
            userMessageId: existingTurn.messages[0]?.id ?? null
          };
        }

        if (existingTurn.status === "processing") {
          throw new Error("INTERVIEW_TURN_IN_PROGRESS");
        }

        throw new Error("INTERVIEW_TURN_RETRY_REQUIRED");
      }

      const unresolvedTurn = await database.interviewUserTurn.findFirst({
        where: {
          sessionId: physicalSessionId,
          OR: [
            { status: "processing" },
            {
              status: { in: ["failed", "canceled"] },
              action: { not: "regenerate_question" }
            }
          ]
        },
        select: { id: true }
      });

      if (unresolvedTurn) {
        throw new Error("INTERVIEW_TURN_IN_PROGRESS");
      }

      const effectiveMessages = await resolveEffectiveInterviewMessages(database, physicalSessionId);
      const latestMessage = effectiveMessages[effectiveMessages.length - 1];
      const currentBaseMessageSequence = latestMessage?.sequence ?? -1;
      const requestedBaseMessageSequence = input.baseMessageSequence ?? currentBaseMessageSequence;

      if (requestedBaseMessageSequence !== currentBaseMessageSequence) {
        throw new Error("INTERVIEW_TURN_OUT_OF_DATE");
      }

      // Opening-only sessions keep the day unclaimed. The first reliable user
      // expression decides which product model owns that date; later legacy
      // writes keep asserting the same ownership before they change state.
      if (session.mode === "dimension_legacy") {
        const entryDate = formatEntryDate(session.entryDate);
        const isFirstReliableExpression = input.action === "reply" && Boolean(input.rawText?.trim());

        if (isFirstReliableExpression) {
          const ownership = await claimJournalDayModeInTransaction(database, {
            userId: input.userId,
            entryDate,
            mode: "dimension_legacy",
            claimedBySessionId: route.rootId
          });
          if (ownership.kind === "conflict" || ownership.kind === "mixed") {
            throw new Error(ownership.code);
          }
        } else {
          const ownership = await resolveJournalDayModeInTransaction(database, {
            userId: input.userId,
            entryDate
          });
          if (ownership.kind !== "unclaimed") {
            await assertJournalDayModeInTransaction(database, {
              userId: input.userId,
              entryDate,
              mode: "dimension_legacy"
            });
          }
        }
      }

      const turnId = randomUUID();
      const userMessageId = input.action === "reply" ? randomUUID() : null;
      const turn = await database.interviewUserTurn.create({
        data: {
          id: turnId,
          clientTurnId: input.clientTurnId,
          sessionId: physicalSessionId,
          activeEventId: input.activeEventId,
          action: input.action,
          targetMessageId: input.targetMessageId,
          regenerationIntent: input.regenerationIntent,
          baseBranchSessionId: input.baseBranchSessionId,
          rawText: input.rawText,
          inputMode: input.inputMode,
          baseMessageSequence: requestedBaseMessageSequence,
          status: "processing"
        }
      });

      if (userMessageId && input.rawText !== null) {
        await database.interviewMessage.create({
          data: {
            id: userMessageId,
            sessionId: physicalSessionId,
            userTurnId: turnId,
            branchSessionId: physicalSessionId,
            role: "user",
            inputMode: input.inputMode,
            content: input.rawText,
            sequence: currentBaseMessageSequence + 1
          }
        });
      }

      return {
        kind: "reserved" as const,
        turn,
        userMessageId
      };
    })
    .catch(async (error: unknown) => {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }

      const duplicateTurn = await prisma.interviewUserTurn.findUnique({
        where: {
          sessionId_clientTurnId: {
            sessionId: physicalSessionId,
            clientTurnId: input.clientTurnId
          }
        },
        include: {
          messages: {
            where: { role: "user" },
            take: 1
          }
        }
      });

      if (duplicateTurn?.status === "completed") {
        return {
          kind: "completed" as const,
          turn: duplicateTurn,
          userMessageId: duplicateTurn.messages[0]?.id ?? null
        };
      }

      if (duplicateTurn && (duplicateTurn.status === "failed" || duplicateTurn.status === "canceled")) {
        throw new Error("INTERVIEW_TURN_RETRY_REQUIRED");
      }

      throw new Error("INTERVIEW_TURN_IN_PROGRESS");
    });

  const session = await findJoyInterviewSessionById(input.sessionId, input.userId);

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  return {
    kind: result.kind,
    turn: mapStandaloneInterviewUserTurn(result.turn),
    userMessageId: result.userMessageId,
    session
  };
}

export async function resumeInterviewUserTurn(input: {
  userId: string;
  sessionId: string;
  clientTurnId: string;
}): Promise<ReserveInterviewUserTurnResult> {
  const route = await resolveInterviewSessionRoute(prisma, input.sessionId);

  if (!route || route.userId !== input.userId) {
    throw new Error("INTERVIEW_TURN_NOT_FOUND");
  }

  const result = await prisma.$transaction(async (database) => {
    const turn = await database.interviewUserTurn.findUnique({
      where: {
        sessionId_clientTurnId: {
          sessionId: route.activeBranchSessionId,
          clientTurnId: input.clientTurnId
        }
      },
      include: {
        session: {
          select: { userId: true }
        },
        messages: {
          where: { role: "user" },
          take: 1
        }
      }
    });

    if (!turn || turn.session.userId !== input.userId) {
      throw new Error("INTERVIEW_TURN_NOT_FOUND");
    }

    if (turn.status === "completed") {
      return {
        kind: "completed" as const,
        turn,
        userMessageId: turn.messages[0]?.id ?? null
      };
    }

    if (turn.status === "processing" && !isInterviewUserTurnLeaseExpired(turn)) {
      throw new Error("INTERVIEW_TURN_IN_PROGRESS");
    }

    const staleProcessingCutoff = new Date(Date.now() - INTERVIEW_USER_TURN_LEASE_MS);
    const updateResult = await database.interviewUserTurn.updateMany({
      where: {
        id: turn.id,
        OR: [
          {
            status: {
              in: ["failed", "canceled"]
            }
          },
          {
            status: "processing",
            updatedAt: {
              lte: staleProcessingCutoff
            }
          }
        ]
      },
      data: {
        status: "processing",
        attemptCount: { increment: 1 },
        errorCode: null,
        completedAt: null
      }
    });

    if (updateResult.count !== 1) {
      throw new Error("INTERVIEW_TURN_IN_PROGRESS");
    }

    const updatedTurn = await database.interviewUserTurn.findUnique({
      where: { id: turn.id }
    });

    if (!updatedTurn) {
      throw new Error("INTERVIEW_TURN_NOT_FOUND");
    }

    return {
      kind: "reserved" as const,
      turn: updatedTurn,
      userMessageId: turn.messages[0]?.id ?? null
    };
  });

  const session = await findJoyInterviewSessionById(input.sessionId, input.userId);

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  return {
    kind: result.kind,
    turn: mapStandaloneInterviewUserTurn(result.turn),
    userMessageId: result.userMessageId,
    session
  };
}

export async function persistInterviewUserTurnIntent(input: {
  turnId: string;
  classifierVersion: string;
  assessment: unknown;
  decision: unknown;
  replaceExisting?: boolean;
}) {
  const existing = await prisma.interviewUserTurn.findUnique({
    where: { id: input.turnId },
    select: {
      intentAssessment: true,
      intentClassifierVersion: true,
      intentDecision: true,
      intentAssessedAt: true
    }
  });

  if (!existing) {
    throw new Error("INTERVIEW_TURN_NOT_FOUND");
  }

  if (existing.intentAssessedAt && !input.replaceExisting) {
    return existing;
  }

  const assessedAt = new Date();
  if (existing.intentAssessedAt && input.replaceExisting) {
    return prisma.interviewUserTurn.update({
      where: { id: input.turnId },
      data: {
        intentAssessment: toJsonValue(input.assessment),
        intentClassifierVersion: input.classifierVersion,
        intentDecision: toJsonValue(input.decision),
        intentAssessedAt: assessedAt
      },
      select: {
        intentAssessment: true,
        intentClassifierVersion: true,
        intentDecision: true,
        intentAssessedAt: true
      }
    });
  }

  const updateResult = await prisma.interviewUserTurn.updateMany({
    where: {
      id: input.turnId,
      intentAssessedAt: null
    },
    data: {
      intentAssessment: toJsonValue(input.assessment),
      intentClassifierVersion: input.classifierVersion,
      intentDecision: toJsonValue(input.decision),
      intentAssessedAt: assessedAt
    }
  });

  if (updateResult.count === 1) {
    return {
      intentAssessment: input.assessment,
      intentClassifierVersion: input.classifierVersion,
      intentDecision: input.decision,
      intentAssessedAt: assessedAt
    };
  }

  const persisted = await prisma.interviewUserTurn.findUnique({
    where: { id: input.turnId },
    select: {
      intentAssessment: true,
      intentClassifierVersion: true,
      intentDecision: true,
      intentAssessedAt: true
    }
  });

  if (!persisted?.intentAssessedAt) {
    throw new Error("INTERVIEW_INTENT_PERSIST_FAILED");
  }

  return persisted;
}

export async function markInterviewUserTurnFailed(turnId: string, errorCode: string) {
  await prisma.interviewUserTurn.updateMany({
    where: { id: turnId, status: "processing" },
    data: {
      status: "failed",
      errorCode
    }
  });
}

export async function cancelInterviewUserTurn(turnId: string, errorCode = "REQUEST_CANCELED") {
  await prisma.interviewUserTurn.updateMany({
    where: { id: turnId, status: "processing" },
    data: {
      status: "canceled",
      errorCode
    }
  });
}

export async function failInterviewUserTurnByClientId(input: {
  sessionId: string;
  clientTurnId: string;
  errorCode: string;
}) {
  await prisma.interviewUserTurn.updateMany({
    where: {
      sessionId: input.sessionId,
      clientTurnId: input.clientTurnId,
      status: "processing"
    },
    data: {
      status: "failed",
      errorCode: input.errorCode
    }
  });
}

export async function cancelInterviewUserTurnByClientId(input: {
  sessionId: string;
  clientTurnId: string;
  errorCode?: string;
}) {
  await prisma.interviewUserTurn.updateMany({
    where: {
      sessionId: input.sessionId,
      clientTurnId: input.clientTurnId,
      status: "processing"
    },
    data: {
      status: "canceled",
      errorCode: input.errorCode ?? "REQUEST_CANCELED"
    }
  });
}

interface AppendJoyInterviewTurnInput {
  sessionId: string;
  expectedBranchSessionId?: string | null;
  activeEventId: string;
  userMessage?: string;
  marksRegenerationAnswered?: boolean;
  inputMode?: InputMode;
  assistantTurn: AssistantTurnPayload;
  snapshot: JoySnapshot;
  eventStatus: InterviewEventRecord["status"];
  progressData: Record<string, unknown> | null;
  nextStage: JoyInterviewStage;
  nextStatus: InterviewSessionStatus;
  nextTurnCount: number;
  coveredLenses: InterviewLens[];
  roundCoveredLenses: InterviewLens[];
  roundMeaningfulReplyCount: number;
  totalMeaningfulReplyCount: number;
  draftSummary: string | null;
  completedAt: Date | null;
  generationTraceId?: string | null;
  requestId?: string | null;
  outputOrigin?: "llm" | "deterministic" | "fallback";
  pipelineDecisions?: Array<Record<string, unknown>>;
  userTurnId?: string | null;
}

export async function appendJoyInterviewTurn(input: AppendJoyInterviewTurnInput) {
  const route = await resolveInterviewSessionRoute(prisma, input.sessionId);

  if (
    input.expectedBranchSessionId &&
    route?.activeBranchSessionId !== input.expectedBranchSessionId
  ) {
    throw new Error("INTERVIEW_BRANCH_OUT_OF_DATE");
  }

  const physicalSessionId = route?.activeBranchSessionId ?? input.sessionId;
  const existing = await ensureInterviewEvents(prisma, physicalSessionId);

  if (!existing) {
    return null;
  }

  const effectiveMessages = await resolveEffectiveInterviewMessages(prisma, physicalSessionId);
  const nextSequence = (effectiveMessages[effectiveMessages.length - 1]?.sequence ?? -1) + 1;
  const nextSnapshotVersion = (existing.snapshots[0]?.version ?? -1) + 1;
  const serializedAssistantTurn = serializeAssistantTurnPayload(input.assistantTurn);
  const assistantQuestion = getAssistantDisplayParts(input.assistantTurn).question;
  const legacyProjection = projectLegacyFields(input.snapshot);
  const evidence = assessDimensionEvidence(
    existing.dimension as InterviewDimension,
    input.snapshot,
    buildSnapshotDataForDimension(existing.dimension as InterviewDimension, input.snapshot)
  );
  const assistantMessageId = randomUUID();
  const persistedUserMessage = input.userTurnId
    ? existing.messages.find((message) => message.userTurnId === input.userTurnId && message.role === "user")
    : null;
  const shouldCreateUserMessage = Boolean(input.userMessage && !persistedUserMessage);
  const userMessageId = persistedUserMessage?.id ?? (shouldCreateUserMessage ? randomUUID() : null);
  const generationTraceId = input.generationTraceId ?? randomUUID();
  const existingTrace = input.generationTraceId
    ? await prisma.aIGenerationTrace.findUnique({
        where: { id: input.generationTraceId },
        select: { outputOrigin: true, pipelineDecisions: true }
      })
    : null;
  const outputOrigin = existingTrace?.outputOrigin ?? input.outputOrigin ?? "llm";
  const currentPipelineDecisions = Array.isArray(existingTrace?.pipelineDecisions)
    ? existingTrace.pipelineDecisions
    : [];
  const finalPipelineDecisions = [
    ...currentPipelineDecisions,
    ...(input.pipelineDecisions ?? []),
    ...(outputOrigin === "deterministic" ? [{ kind: "deterministic_response" }] : [])
  ];

  const messagesToCreate: Prisma.InterviewMessageCreateManyInput[] = [];

  if (shouldCreateUserMessage && input.userMessage) {
    messagesToCreate.push({
      id: userMessageId ?? undefined,
      sessionId: physicalSessionId,
      userTurnId: input.userTurnId ?? undefined,
      branchSessionId: physicalSessionId,
      role: "user",
      inputMode: input.inputMode,
      content: input.userMessage,
      sequence: nextSequence
    });
  }

  messagesToCreate.push({
    id: assistantMessageId,
    sessionId: physicalSessionId,
    userTurnId: input.userTurnId ?? undefined,
    generationTraceId,
    responseGroupId: assistantMessageId,
    responseVersion: 1,
    branchSessionId: physicalSessionId,
    role: "assistant",
    content: serializedAssistantTurn,
    sequence: nextSequence + (shouldCreateUserMessage ? 1 : 0)
  });

  const traceWrite = input.generationTraceId
    ? prisma.aIGenerationTrace.update({
        where: { id: generationTraceId },
        data: {
          artifactId: assistantMessageId,
          artifactVersion: 1,
          triggerMessageId: userMessageId,
          status: "completed",
          outputOrigin,
          finalOutput: toJsonValue(input.assistantTurn),
          pipelineDecisions: toJsonValue(finalPipelineDecisions),
          completedAt: new Date(),
          errorCode: null
        }
      })
    : prisma.aIGenerationTrace.create({
        data: {
          id: generationTraceId,
          requestId: input.requestId ?? null,
          userId: existing.userId,
          sessionId: physicalSessionId,
          dimension: existing.dimension,
          artifactType: "interview_turn",
          artifactId: assistantMessageId,
          artifactVersion: 1,
          triggerMessageId: userMessageId,
          status: "completed",
          outputOrigin,
          contextSnapshot: toJsonValue({
            action: input.userMessage ? "reply" : "continue_current_event",
            userMessage: input.userMessage ?? null,
            messageIds: effectiveMessages.map((message) => message.id),
            messages: effectiveMessages.map((message) => ({
              id: message.id,
              role: message.role,
              sequence: message.sequence,
              content: message.content
            })),
            activeEventId: input.activeEventId,
            snapshot: evidence.snapshotData
          }),
          finalOutput: toJsonValue(input.assistantTurn),
          pipelineDecisions: toJsonValue(input.pipelineDecisions ?? []),
          completedAt: new Date()
        }
      });

  const turnCompletionWrite = input.userTurnId
    ? prisma.interviewUserTurn.update({
        where: { id: input.userTurnId },
        data: {
          status: "completed",
          errorCode: null,
          completedAt: new Date()
        }
      })
    : null;

  await prisma.$transaction([
    traceWrite,
    prisma.interviewMessage.createMany({ data: messagesToCreate }),
    prisma.joyInterviewSnapshot.create({
      data: {
        sessionId: physicalSessionId,
        version: nextSnapshotVersion,
        event: legacyProjection.event,
        feeling: legacyProjection.feeling,
        whyItMattered: legacyProjection.whyItMattered,
        happinessType: legacyProjection.happinessType,
        selfPattern: legacyProjection.selfPattern,
        confidence: evidence.confidence,
        missingSlots: evidence.missingSlots
      }
    }),
    prisma.interviewEvent.update({
      where: { id: input.activeEventId },
      data: {
        status: input.eventStatus,
        stage: input.nextStage,
        coveredLenses: input.coveredLenses,
        roundCoveredLenses: input.roundCoveredLenses,
        roundMeaningfulReplyCount: input.roundMeaningfulReplyCount,
        totalMeaningfulReplyCount: input.totalMeaningfulReplyCount,
        event: legacyProjection.event,
        feeling: legacyProjection.feeling,
        whyItMattered: legacyProjection.whyItMattered,
        happinessType: legacyProjection.happinessType,
        selfPattern: legacyProjection.selfPattern,
        snapshotData: toJsonValue(evidence.snapshotData),
        progressData: input.progressData ? toJsonValue(input.progressData) : Prisma.JsonNull,
        confidence: evidence.confidence,
        missingSlots: evidence.missingSlots,
        draftSummary: input.draftSummary,
        completedAt: input.eventStatus === "completed" ? (input.completedAt ?? new Date()) : null
      }
    }),
    prisma.interviewSession.update({
      where: { id: physicalSessionId },
      data: {
        turnCount: input.nextTurnCount,
        stage: input.nextStage,
        status: input.nextStatus,
        lastAssistantQuestion: assistantQuestion,
        draftSummary: input.draftSummary,
        completedAt: input.completedAt
      }
    }),
    ...(turnCompletionWrite ? [turnCompletionWrite] : []),
    prisma.interviewBranchCheckpoint.create({
      data: {
        sessionId: physicalSessionId,
        messageId: assistantMessageId,
        schemaVersion: 1,
        sessionState: toJsonValue({
          status: input.nextStatus,
          stage: input.nextStage,
          activeEventId: input.activeEventId,
          turnCount: input.nextTurnCount,
          lastAssistantQuestion: assistantQuestion,
          draftSummary: input.draftSummary
        }),
        eventsState: toJsonValue(
          existing.events.map((event) =>
            event.id === input.activeEventId
              ? {
                  ...event,
                  status: input.eventStatus,
                  stage: input.nextStage,
                  coveredLenses: input.coveredLenses,
                  roundCoveredLenses: input.roundCoveredLenses,
                  roundMeaningfulReplyCount: input.roundMeaningfulReplyCount,
                  totalMeaningfulReplyCount: input.totalMeaningfulReplyCount,
                  event: legacyProjection.event,
                  feeling: legacyProjection.feeling,
                  whyItMattered: legacyProjection.whyItMattered,
                  happinessType: legacyProjection.happinessType,
                  selfPattern: legacyProjection.selfPattern,
                  snapshotData: evidence.snapshotData,
                  progressData: input.progressData,
                  confidence: evidence.confidence,
                  missingSlots: evidence.missingSlots,
                  draftSummary: input.draftSummary,
                  completedAt: input.eventStatus === "completed" ? (input.completedAt ?? new Date()) : null
                }
              : event
          )
        )
      }
    }),
    ...(input.userMessage && input.marksRegenerationAnswered
      ? [
          prisma.aIResponseRegeneration.updateMany({
            where: {
              branchSessionId: physicalSessionId,
              status: "completed",
              answeredAt: null,
              replacedAt: null,
              switchedBackAt: null,
              downvotedAt: null,
              abandonedAt: null
            },
            data: {
              answeredAt: new Date()
            }
          })
        ]
      : [])
  ]);

  return findJoyInterviewSessionById(route?.rootId ?? input.sessionId, existing.userId);
}

export async function resumeCurrentInterviewEvent(sessionId: string) {
  const route = await resolveInterviewSessionRoute(prisma, sessionId);
  const physicalSessionId = route?.activeBranchSessionId ?? sessionId;
  const existing = await ensureInterviewEvents(prisma, physicalSessionId);

  if (!existing?.activeEventId) {
    return null;
  }

  const activeEvent = existing.events.find((event) => event.id === existing.activeEventId);

  if (!activeEvent) {
    return null;
  }

  await prisma.interviewEvent.update({
    where: { id: activeEvent.id },
    data: {
      status: "active",
      stage: activeEvent.stage === "wrap_up" ? "probe_pattern" : activeEvent.stage,
      explorationRound: activeEvent.explorationRound + 1,
      roundCoveredLenses: [],
      roundMeaningfulReplyCount: 0,
      progressData: Prisma.JsonNull,
      completedAt: null
    }
  });

  return findJoyInterviewSessionById(route?.rootId ?? sessionId, existing.userId);
}

export async function startNextInterviewEvent(
  sessionId: string,
  openingQuestion: string,
  options?: { requestId?: string | null; userTurnId?: string | null }
) {
  const route = await resolveInterviewSessionRoute(prisma, sessionId);
  const physicalSessionId = route?.activeBranchSessionId ?? sessionId;
  const existing = await ensureInterviewEvents(prisma, physicalSessionId);

  if (!existing) {
    return null;
  }

  const nextSequence = (existing.events[existing.events.length - 1]?.sequence ?? 0) + 1;
  const emptySnapshot = createEmptySnapshot();
  const emptyEvidence = assessDimensionEvidence(
    existing.dimension as InterviewDimension,
    emptySnapshot,
    buildSnapshotDataForDimension(existing.dimension as InterviewDimension, emptySnapshot)
  );
  const nextEventId = randomUUID();
  const assistantTurn = createOpeningAssistantTurnPayload(openingQuestion);
  const assistantMessageId = randomUUID();
  const generationTraceId = randomUUID();
  const effectiveMessages = await resolveEffectiveInterviewMessages(prisma, physicalSessionId);
  const nextMessageSequence = (effectiveMessages[effectiveMessages.length - 1]?.sequence ?? -1) + 1;

  const writes: Prisma.PrismaPromise<unknown>[] = [];

  if (existing.activeEventId) {
    writes.push(
      prisma.interviewEvent.update({
        where: { id: existing.activeEventId },
        data: {
          status: "completed",
          completedAt: new Date()
        }
      })
    );
  }

  writes.push(
    prisma.interviewEvent.create({
      data: {
        id: nextEventId,
        sessionId: physicalSessionId,
        sequence: nextSequence,
        status: "active",
        stage: "collect_event",
        explorationRound: 1,
        coveredLenses: [],
        roundCoveredLenses: [],
        roundMeaningfulReplyCount: 0,
        totalMeaningfulReplyCount: 0,
        startMessageSequence: nextMessageSequence,
        event: emptySnapshot.event,
        feeling: emptySnapshot.feeling,
        whyItMattered: emptySnapshot.whyItMattered,
        happinessType: emptySnapshot.happinessType,
        selfPattern: emptySnapshot.selfPattern,
        snapshotData: toJsonValue(emptyEvidence.snapshotData),
        confidence: emptyEvidence.confidence,
        missingSlots: emptyEvidence.missingSlots
      }
    }),
    prisma.aIGenerationTrace.create({
      data: {
        id: generationTraceId,
        requestId: options?.requestId ?? null,
        userId: existing.userId,
        sessionId: physicalSessionId,
        dimension: existing.dimension,
        artifactType: "interview_turn",
        artifactId: assistantMessageId,
        artifactVersion: 1,
        status: "completed",
        outputOrigin: "deterministic",
        contextSnapshot: toJsonValue({
          kind: "next_event_opening",
          messageIds: effectiveMessages.map((message) => message.id),
          previousEventId: existing.activeEventId,
          nextEventId
        }),
        finalOutput: toJsonValue(assistantTurn),
        pipelineDecisions: toJsonValue([{ kind: "deterministic_next_event_opening" }]),
        completedAt: new Date()
      }
    }),
    prisma.interviewMessage.create({
      data: {
        id: assistantMessageId,
        sessionId: physicalSessionId,
        userTurnId: options?.userTurnId ?? undefined,
        generationTraceId,
        responseGroupId: assistantMessageId,
        responseVersion: 1,
        branchSessionId: physicalSessionId,
        role: "assistant",
        content: serializeAssistantTurnPayload(assistantTurn),
        sequence: nextMessageSequence
      }
    }),
    prisma.interviewSession.update({
      where: { id: physicalSessionId },
      data: {
        activeEventId: nextEventId,
        stage: "collect_event",
        lastAssistantQuestion: openingQuestion
      }
    }),
    ...(options?.userTurnId
      ? [
          prisma.interviewUserTurn.update({
            where: { id: options.userTurnId },
            data: {
              status: "completed",
              errorCode: null,
              completedAt: new Date()
            }
          })
        ]
      : []),
    prisma.interviewBranchCheckpoint.create({
      data: {
        sessionId: physicalSessionId,
        messageId: assistantMessageId,
        schemaVersion: 1,
        sessionState: toJsonValue({
          status: "active",
          stage: "collect_event",
          activeEventId: nextEventId,
          turnCount: existing.turnCount,
          lastAssistantQuestion: openingQuestion,
          draftSummary: existing.draftSummary
        }),
        eventsState: toJsonValue([
          ...existing.events.map((event) => ({
            ...event,
            status: event.id === existing.activeEventId ? "completed" : event.status,
            completedAt: event.id === existing.activeEventId ? new Date() : event.completedAt
          })),
          {
            id: nextEventId,
            sequence: nextSequence,
            status: "active",
            stage: "collect_event",
            explorationRound: 1,
            coveredLenses: [],
            roundCoveredLenses: [],
            roundMeaningfulReplyCount: 0,
            totalMeaningfulReplyCount: 0,
            startMessageSequence: nextMessageSequence,
            snapshotData: emptyEvidence.snapshotData,
            progressData: null,
            confidence: emptyEvidence.confidence,
            missingSlots: emptyEvidence.missingSlots
          }
        ])
      }
    })
  );

  await prisma.$transaction(writes);
  return findJoyInterviewSessionById(route?.rootId ?? sessionId, existing.userId);
}

export async function saveJoyInterviewDraft(
  sessionId: string,
  draftEntry: JoyEntryDraft,
  trace?: {
    traceId?: string | null;
    requestId?: string | null;
    outputOrigin?: "llm" | "deterministic" | "fallback";
  }
) {
  const existing = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: interviewSessionInclude
  });

  if (!existing) {
    return null;
  }

  const legacyProjection = projectLegacyFields(draftEntry);
  const payload = buildJournalPayloadForDimension(requireLegacyDimension(existing.dimension), {
    event: legacyProjection.event,
    feeling: legacyProjection.feeling,
    whyItMattered: legacyProjection.whyItMattered,
    happinessType: legacyProjection.happinessType,
    selfPattern: legacyProjection.selfPattern,
    joyMoment: draftEntry.joyMoment ?? null,
    joySource: draftEntry.joySource ?? null,
    stateShift: draftEntry.stateShift ?? null,
    meaningNeed: draftEntry.meaningNeed ?? null,
    manualClue: draftEntry.manualClue ?? null,
    delightSignature: draftEntry.delightSignature ?? null,
    psychProfile: draftEntry.psychProfile ?? undefined,
    directionSignal: draftEntry.directionSignal ?? null,
    valueImpact: draftEntry.valueImpact ?? null,
    durability: draftEntry.durability ?? null,
    improvementTrack: draftEntry.improvementTrack ?? null,
    stateAssessment: draftEntry.stateAssessment ?? null,
    frictionPoint: draftEntry.frictionPoint ?? null,
    repeatCondition: draftEntry.repeatCondition ?? null,
    controllableFactor: draftEntry.controllableFactor ?? null,
    nextAttempt: draftEntry.nextAttempt ?? null,
    successSignal: draftEntry.successSignal ?? null,
    gratitudeMoment: draftEntry.gratitudeMoment ?? null,
    gratitudeTarget: draftEntry.gratitudeTarget ?? null,
    kindAction: draftEntry.kindAction ?? null,
    seenNeed: draftEntry.seenNeed ?? null,
    innerEffect: draftEntry.innerEffect ?? null,
    gratitudeReason: draftEntry.gratitudeReason ?? null,
    gratitudeType: draftEntry.gratitudeType ?? null,
    relationshipSignal: draftEntry.relationshipSignal ?? null,
    reciprocityHint: draftEntry.reciprocityHint ?? null,
    tags: draftEntry.tags
  });
  const finalEntryId = existing.joyEntry?.id ?? randomUUID();
  const generationVersion = (existing.joyEntry?.generationVersion ?? 0) + 1;
  const generationTraceId = trace?.traceId ?? randomUUID();
  const existingTrace = trace?.traceId
    ? await prisma.aIGenerationTrace.findUnique({
        where: { id: trace.traceId },
        select: { outputOrigin: true }
      })
    : null;
  const outputOrigin = existingTrace?.outputOrigin ?? trace?.outputOrigin ?? "llm";
  const traceWrite = trace?.traceId
    ? prisma.aIGenerationTrace.update({
        where: { id: generationTraceId },
        data: {
          artifactId: finalEntryId,
          artifactVersion: generationVersion,
          status: "completed",
          outputOrigin,
          finalOutput: toJsonValue({ title: draftEntry.title, content: draftEntry.content }),
          completedAt: new Date(),
          errorCode: null
        }
      })
    : prisma.aIGenerationTrace.create({
        data: {
          id: generationTraceId,
          requestId: trace?.requestId ?? null,
          userId: existing.userId,
          sessionId,
          dimension: existing.dimension,
          artifactType: "dimension_journal",
          artifactId: finalEntryId,
          artifactVersion: generationVersion,
          status: "completed",
          outputOrigin,
          contextSnapshot: toJsonValue({
            messageIds: existing.messages.map((message) => message.id),
            messages: existing.messages.map((message) => ({
              id: message.id,
              role: message.role,
              sequence: message.sequence,
              content: message.content
            })),
            eventIds: existing.events.map((event) => event.id),
            snapshot: existing.activeEvent?.snapshotData ?? null
          }),
          finalOutput: toJsonValue({ title: draftEntry.title, content: draftEntry.content }),
          pipelineDecisions: toJsonValue([]),
          completedAt: new Date()
        }
      });

  await prisma.$transaction([
    traceWrite,
    prisma.joyEntry.upsert({
      where: { sessionId },
      update: {
        title: draftEntry.title,
        content: draftEntry.content,
        event: legacyProjection.event,
        feeling: legacyProjection.feeling,
        whyItMattered: legacyProjection.whyItMattered,
        happinessType: legacyProjection.happinessType,
        selfPattern: legacyProjection.selfPattern,
        tags: draftEntry.tags,
        payload: toJsonValue(payload),
        eventBlocks: draftEntry.eventBlocks as unknown as Prisma.InputJsonValue,
        source: draftEntry.source,
        status: existing.joyEntry?.status ?? "draft",
        savedAt: existing.joyEntry?.savedAt ?? null,
        linkedSessionIds: [sessionId]
        ,generationVersion
        ,currentGenerationTraceId: generationTraceId
      },
      create: {
        id: finalEntryId,
        userId: existing.userId,
        sessionId,
        date: existing.entryDate ?? existing.startedAt,
        title: draftEntry.title,
        content: draftEntry.content,
        event: legacyProjection.event,
        feeling: legacyProjection.feeling,
        whyItMattered: legacyProjection.whyItMattered,
        happinessType: legacyProjection.happinessType,
        selfPattern: legacyProjection.selfPattern,
        tags: draftEntry.tags,
        payload: toJsonValue(payload),
        eventBlocks: draftEntry.eventBlocks as unknown as Prisma.InputJsonValue,
        source: draftEntry.source,
        status: "draft",
        linkedSessionIds: [sessionId]
        ,generationVersion
        ,currentGenerationTraceId: generationTraceId
      }
    }),
    prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        draftSummary:
          draftEntry.manualClue ?? draftEntry.delightSignature ?? draftEntry.joySource ?? legacyProjection.whyItMattered ?? legacyProjection.event,
        finalEntryId
      }
    })
  ]);

  if ((existing.conversationSchemaVersion ?? 1) < 2) {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: interviewSessionInclude
    });
    return session ? mapInterviewSession(session) : null;
  }

  return findJoyInterviewSessionById(sessionId, existing.userId);
}

export async function reopenJoyInterviewSessionRecord(sessionId: string) {
  const route = await resolveInterviewSessionRoute(prisma, sessionId);
  const physicalSessionId = route?.activeBranchSessionId ?? sessionId;
  const existing = await prisma.interviewSession.findUnique({
    where: { id: physicalSessionId },
    include: interviewSessionInclude
  });

  if (!existing) {
    return null;
  }

  await prisma.interviewSession.updateMany({
    where: {
      id: { in: Array.from(new Set([route?.rootId ?? sessionId, physicalSessionId])) }
    },
    data: {
      status: "active",
      stage: existing.stage === "finalize" ? "wrap_up" : existing.stage,
      pausedAt: null,
      completedAt: null
    }
  });

  return findJoyInterviewSessionById(route?.rootId ?? sessionId, existing.userId);
}

export async function pauseJoyInterviewSessionRecord(sessionId: string) {
  const pausedAt = new Date();
  const route = await resolveInterviewSessionRoute(prisma, sessionId);
  const ids = Array.from(new Set([route?.rootId ?? sessionId, route?.activeBranchSessionId ?? sessionId]));

  await prisma.interviewSession.updateMany({
    where: { id: { in: ids } },
    data: {
      status: "paused",
      pausedAt,
      completedAt: null
    }
  });
  await prisma.aIResponseRegeneration.updateMany({
    where: {
      branchSessionId: route?.activeBranchSessionId ?? sessionId,
      status: "completed",
      answeredAt: null,
      abandonedAt: null
    },
    data: {
      abandonedAt: pausedAt
    }
  });

  return findJoyInterviewSessionById(route?.rootId ?? sessionId, route?.userId);
}

export async function completeJoyInterviewSessionRecord(sessionId: string) {
  const completedAt = new Date();
  const route = await resolveInterviewSessionRoute(prisma, sessionId);
  const ids = Array.from(new Set([route?.rootId ?? sessionId, route?.activeBranchSessionId ?? sessionId]));

  await prisma.interviewSession.updateMany({
    where: { id: { in: ids } },
    data: {
      status: "completed",
      completedAt,
      pausedAt: null
    }
  });

  return findJoyInterviewSessionById(route?.rootId ?? sessionId, route?.userId);
}

export async function updateJoyEntry(entryId: string, draftEntry: JoyEntryDraft) {
  const existing = await prisma.joyEntry.findUnique({
    where: { id: entryId },
    include: {
      session: {
        select: {
          dimension: true
        }
      }
    }
  });

  if (!existing) {
    throw new Prisma.PrismaClientKnownRequestError("Journal entry not found.", {
      code: "P2025",
      clientVersion: Prisma.prismaVersion.client
    });
  }

  const legacyProjection = projectLegacyFields(draftEntry);
  const payload = buildJournalPayloadForDimension(existing.session?.dimension ?? "joy", {
    event: legacyProjection.event,
    feeling: legacyProjection.feeling,
    whyItMattered: legacyProjection.whyItMattered,
    happinessType: legacyProjection.happinessType,
    selfPattern: legacyProjection.selfPattern,
    joyMoment: draftEntry.joyMoment ?? null,
    joySource: draftEntry.joySource ?? null,
    stateShift: draftEntry.stateShift ?? null,
    meaningNeed: draftEntry.meaningNeed ?? null,
    manualClue: draftEntry.manualClue ?? null,
    delightSignature: draftEntry.delightSignature ?? null,
    psychProfile: draftEntry.psychProfile ?? undefined,
    directionSignal: draftEntry.directionSignal ?? null,
    valueImpact: draftEntry.valueImpact ?? null,
    durability: draftEntry.durability ?? null,
    improvementTrack: draftEntry.improvementTrack ?? null,
    stateAssessment: draftEntry.stateAssessment ?? null,
    frictionPoint: draftEntry.frictionPoint ?? null,
    repeatCondition: draftEntry.repeatCondition ?? null,
    controllableFactor: draftEntry.controllableFactor ?? null,
    nextAttempt: draftEntry.nextAttempt ?? null,
    successSignal: draftEntry.successSignal ?? null,
    gratitudeMoment: draftEntry.gratitudeMoment ?? null,
    gratitudeTarget: draftEntry.gratitudeTarget ?? null,
    kindAction: draftEntry.kindAction ?? null,
    seenNeed: draftEntry.seenNeed ?? null,
    innerEffect: draftEntry.innerEffect ?? null,
    gratitudeReason: draftEntry.gratitudeReason ?? null,
    gratitudeType: draftEntry.gratitudeType ?? null,
    relationshipSignal: draftEntry.relationshipSignal ?? null,
    reciprocityHint: draftEntry.reciprocityHint ?? null,
    tags: draftEntry.tags
  });

  const updated = await prisma.joyEntry.update({
    where: { id: entryId },
    data: {
      title: draftEntry.title,
      content: draftEntry.content,
      event: legacyProjection.event,
      feeling: legacyProjection.feeling,
      whyItMattered: legacyProjection.whyItMattered,
      happinessType: legacyProjection.happinessType,
      selfPattern: legacyProjection.selfPattern,
      tags: draftEntry.tags,
      payload: toJsonValue(payload),
      eventBlocks: draftEntry.eventBlocks as unknown as Prisma.InputJsonValue,
      source: "ai_draft_edited",
      status: existing.status,
      savedAt: existing.savedAt
    },
    include: {
      session: {
        select: {
          dimension: true
        }
      }
    }
  });

  return mapJournalEntry(updated);
}

export async function updateJournalEntryContent(entryId: string, input: { title?: string; content: string }) {
  const updated = await prisma.joyEntry.update({
    where: { id: entryId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      content: input.content,
      source: "ai_draft_edited"
    },
    include: {
      session: {
        select: {
          dimension: true
        }
      }
    }
  });

  return mapJournalEntry(updated);
}

export async function markJoyEntrySaved(sessionId: string) {
  const route = await resolveInterviewSessionRoute(prisma, sessionId);
  const rootSessionId = route?.rootId ?? sessionId;
  const activeBranchSessionId = route?.activeBranchSessionId ?? sessionId;
  const existing = await prisma.interviewSession.findUnique({
    where: { id: rootSessionId },
    include: interviewSessionInclude
  });

  if (!existing?.joyEntry) {
    return null;
  }

  const savedAt = new Date();
  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.joyEntry.update({
      where: { sessionId: rootSessionId },
      data: {
        status: "saved",
        savedAt,
        updatedAt: savedAt,
        linkedSessionIds: [rootSessionId]
      }
    }),
    prisma.interviewSession.update({
      where: { id: rootSessionId },
      data: {
        status: "completed",
        stage: "finalize",
        pausedAt: null,
        completedAt: savedAt,
        draftSummary: existing.joyEntry.selfPattern ?? existing.joyEntry.whyItMattered ?? existing.joyEntry.event,
        finalEntryId: existing.joyEntry.id
      }
    })
  ];

  if (activeBranchSessionId !== rootSessionId) {
    writes.push(
      prisma.interviewSession.update({
        where: { id: activeBranchSessionId },
        data: {
          status: "completed",
          stage: "finalize",
          pausedAt: null,
          completedAt: savedAt,
          draftSummary: existing.joyEntry.selfPattern ?? existing.joyEntry.whyItMattered ?? existing.joyEntry.event
        }
      })
    );
  }

  const activeBranch = await ensureInterviewEvents(prisma, activeBranchSessionId);
  if (activeBranch?.activeEventId) {
    writes.push(
      prisma.interviewEvent.update({
        where: { id: activeBranch.activeEventId },
        data: {
          status: "completed",
          completedAt: savedAt
        }
      })
    );
  }

  await prisma.$transaction(writes);

  return findJoyInterviewSessionById(rootSessionId, existing.userId);
}

interface CreateAIRequestLogInput {
  sessionId: string;
  stage: AIRequestStage;
  provider: string;
  success: boolean;
  latencyMs: number | null;
  errorCode: string | null;
}

export async function createAIRequestLog(input: CreateAIRequestLogInput) {
  await prisma.aIRequestLog.create({
    data: {
      sessionId: input.sessionId,
      stage: input.stage,
      provider: input.provider,
      success: input.success,
      latencyMs: input.latencyMs,
      errorCode: input.errorCode
    }
  });
}
