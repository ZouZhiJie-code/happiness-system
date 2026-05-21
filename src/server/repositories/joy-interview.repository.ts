import {
  Prisma,
  PrismaClient,
  type AIRequestStage,
  type InterviewDimension as PrismaInterviewDimension,
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
import {
  formatEntryDate,
  getTodayEntryDate,
  parseEntryDateInput
} from "@/features/interview/entry-date";
import { isDraftGenerationUnlocked } from "@/features/joy-interview/server/interview-progress";
import {
  buildJoySnapshot,
  createEmptySnapshot,
  getLegacyJoyProjection
} from "@/features/joy-interview/server/joy-interview-engine";
import { prisma } from "@/server/db/prisma";
import type {
  AssistantTurnPayload,
  InterviewDimension,
  InterviewEventRecord,
  InterviewLens,
  InterviewSessionRecord,
  JournalEntryRecord,
  JoyEntryDraft,
  JoyEventBlock,
  JoyPsychProfile,
  JoySnapshot
} from "@/types/interview";

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
    }
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
type SnapshotRecord = NonNullable<InterviewSessionWithRelations["snapshots"][number]>;
type EventRecord = NonNullable<InterviewSessionWithRelations["events"][number]>;
type JoyEntryRecord = NonNullable<InterviewSessionWithRelations["joyEntry"]>;

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
  if (dimension === "gratitude") {
    const parsed = parseGratitudeSnapshotData(raw);

    return buildSnapshotDataForDimension(
      "gratitude",
      buildJoySnapshot({
        event: snapshot.event,
        feeling: snapshot.feeling,
        whyItMattered: snapshot.whyItMattered,
        happinessType: snapshot.happinessType,
        selfPattern: snapshot.selfPattern,
        gratitudeMoment: parsed?.gratitudeMoment ?? snapshot.gratitudeMoment,
        gratitudeTarget: parsed?.gratitudeTarget ?? snapshot.gratitudeTarget,
        kindAction: parsed?.kindAction ?? snapshot.kindAction,
        seenNeed: parsed?.seenNeed ?? snapshot.seenNeed,
        innerEffect: parsed?.innerEffect ?? snapshot.innerEffect,
        gratitudeReason: parsed?.gratitudeReason ?? snapshot.gratitudeReason,
        gratitudeType: parsed?.gratitudeType ?? snapshot.gratitudeType,
        relationshipSignal: parsed?.relationshipSignal ?? snapshot.relationshipSignal,
        reciprocityHint: parsed?.reciprocityHint ?? snapshot.reciprocityHint,
        evidenceState: parsed?.evidenceState ?? snapshot.evidenceState,
        tags: snapshot.tags
      })
    );
  }

  if (dimension !== "joy") {
    return raw ? (raw as InterviewEventRecord["snapshotData"]) : buildSnapshotDataForDimension(dimension, snapshot);
  }

  const parsed = parseJoySnapshotData(raw);

  return buildSnapshotDataForDimension(
    "joy",
    buildJoySnapshot({
      event: snapshot.event,
      feeling: snapshot.feeling,
      whyItMattered: snapshot.whyItMattered,
      happinessType: snapshot.happinessType,
      selfPattern: snapshot.selfPattern,
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
      tags: parsed?.tags
    })
  );
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
  const snapshotData = buildSnapshotDataForDimension(session.dimension, snapshot);

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

  return {
    id: entry.id,
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
    savedAt: entry.savedAt?.toISOString() ?? null
  };
}

function mapInterviewSession(session: InterviewSessionWithRelations): InterviewSessionRecord {
  const events = session.events.length ? session.events.map((event: EventRecord) => mapInterviewEvent(session.dimension, event)) : [buildFallbackEvent(session)];
  const activeEvent =
    events.find((event: InterviewEventRecord) => event.id === session.activeEventId) ??
    events.find((event: InterviewEventRecord) => event.status !== "completed") ??
    events[events.length - 1];
  const progressData =
    activeEvent && session.activeEvent
      ? (session.activeEvent.progressData as Record<string, unknown> | null | undefined)
      : undefined;
  const mappedSession = {
    id: session.id,
    userId: session.userId,
    dimension: session.dimension,
    status: session.status,
    stage: activeEvent?.stage ?? session.stage,
    activeEventId: activeEvent?.id ?? null,
    messages: session.messages.map((message) => ({
      id: message.id,
      role: message.role,
      inputMode: message.inputMode ?? undefined,
      content: message.content,
      assistantPayload: message.role === "assistant" ? parseAssistantTurnPayload(message.content) : null,
      sequence: message.sequence,
      createdAt: message.createdAt.toISOString()
    })),
    snapshot: activeEvent?.snapshot ?? mapSnapshot(session.snapshots[0]),
    snapshotData: activeEvent?.snapshotData ?? buildSnapshotDataForDimension(session.dimension, mapSnapshot(session.snapshots[0])),
    events,
    pendingDecision:
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
          : progressData?.kind === "boundary_insufficient"
            ? {
                kind: "boundary_insufficient" as const,
                eventId: activeEvent.id,
                eventSequence: activeEvent.sequence,
                reason:
                  typeof progressData.reason === "string" && progressData.reason
                    ? progressData.reason
                    : "我不再继续追问细节了。",
                actions: ["continue_current_event", "next_event", "pause_session"] as const
              }
          : {
              kind: "event_complete" as const,
              eventId: activeEvent.id,
              eventSequence: activeEvent.sequence,
              completionMode:
                progressData?.completionMode === "user_override_partial"
                  ? ("user_override_partial" as const)
                  : ("complete" as const),
              actions: ["continue_current_event", "next_event", "generate_draft"] as const
            }
        : null,
    entryDate: formatEntryDate(session.entryDate ?? session.startedAt),
    startedAt: session.startedAt.toISOString(),
    pausedAt: session.pausedAt?.toISOString() ?? null,
    completedAt: session.completedAt?.toISOString() ?? null,
    journalEntry: mapJournalEntry(session.joyEntry, session.dimension),
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
        confidence: fallbackSnapshot.confidence,
        missingSlots: fallbackSnapshot.missingSlots,
        draftSummary: existing.draftSummary,
        startedAt: existing.startedAt,
        completedAt: existing.completedAt
      }
    }));

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
  entryDate?: string
) {
  const emptySnapshot = createEmptySnapshot();
  const openingAssistantTurn = createOpeningAssistantTurnPayload(openingQuestion);
  const emptySnapshotData = buildSnapshotDataForDimension(dimension, emptySnapshot);
  const resolvedEntryDate = parseEntryDateInput(entryDate ?? getTodayEntryDate());
  const sessionId = randomUUID();
  const activeEventId = randomUUID();

  await prisma.$transaction([
    prisma.interviewSession.create({
      data: {
        id: sessionId,
        userId,
        dimension: dimension as PrismaInterviewDimension,
        status: "active",
        stage: "collect_event",
        entryDate: resolvedEntryDate,
        lastAssistantQuestion: openingQuestion,
        messages: {
          create: [
            {
              role: "assistant",
              content: serializeAssistantTurnPayload(openingAssistantTurn),
              sequence: 0
            }
          ]
        },
        snapshots: {
          create: [
            {
              version: 0,
              event: emptySnapshot.event,
              feeling: emptySnapshot.feeling,
              whyItMattered: emptySnapshot.whyItMattered,
              happinessType: emptySnapshot.happinessType,
              selfPattern: emptySnapshot.selfPattern,
              confidence: emptySnapshot.confidence,
              missingSlots: emptySnapshot.missingSlots
            }
          ]
        }
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
        confidence: emptySnapshot.confidence,
        missingSlots: emptySnapshot.missingSlots
      }
    }),
    prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        activeEventId
      }
    })
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
  const session = await ensureInterviewEvents(prisma, sessionId);

  if (!session) {
    return null;
  }

  if (userId && session.userId !== userId) {
    return null;
  }

  return mapInterviewSession(session);
}

interface AppendJoyInterviewTurnInput {
  sessionId: string;
  activeEventId: string;
  userMessage?: string;
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
}

export async function appendJoyInterviewTurn(input: AppendJoyInterviewTurnInput) {
  const existing = await ensureInterviewEvents(prisma, input.sessionId);

  if (!existing) {
    return null;
  }

  const nextSequence = existing.messages.length;
  const nextSnapshotVersion = (existing.snapshots[0]?.version ?? -1) + 1;
  const serializedAssistantTurn = serializeAssistantTurnPayload(input.assistantTurn);
  const assistantQuestion = getAssistantDisplayParts(input.assistantTurn).question;
  const legacyProjection = projectLegacyFields(input.snapshot);

  const messagesToCreate: Prisma.InterviewMessageCreateManyInput[] = [];

  if (input.userMessage) {
    messagesToCreate.push({
      sessionId: input.sessionId,
      role: "user",
      inputMode: input.inputMode,
      content: input.userMessage,
      sequence: nextSequence
    });
  }

  messagesToCreate.push({
    sessionId: input.sessionId,
    role: "assistant",
    content: serializedAssistantTurn,
    sequence: nextSequence + (input.userMessage ? 1 : 0)
  });

  await prisma.$transaction([
    prisma.interviewMessage.createMany({ data: messagesToCreate }),
    prisma.joyInterviewSnapshot.create({
      data: {
        sessionId: input.sessionId,
        version: nextSnapshotVersion,
        event: legacyProjection.event,
        feeling: legacyProjection.feeling,
        whyItMattered: legacyProjection.whyItMattered,
        happinessType: legacyProjection.happinessType,
        selfPattern: legacyProjection.selfPattern,
        confidence: input.snapshot.confidence,
        missingSlots: input.snapshot.missingSlots
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
        snapshotData: toJsonValue(buildSnapshotDataForDimension(existing.dimension, input.snapshot)),
        progressData: input.progressData ? toJsonValue(input.progressData) : Prisma.JsonNull,
        confidence: input.snapshot.confidence,
        missingSlots: input.snapshot.missingSlots,
        draftSummary: input.draftSummary,
        completedAt: input.eventStatus === "completed" ? (input.completedAt ?? new Date()) : null
      }
    }),
    prisma.interviewSession.update({
      where: { id: input.sessionId },
      data: {
        turnCount: input.nextTurnCount,
        stage: input.nextStage,
        status: input.nextStatus,
        lastAssistantQuestion: assistantQuestion,
        draftSummary: input.draftSummary,
        completedAt: input.completedAt
      }
    })
  ]);

  const session = await prisma.interviewSession.findUnique({
    where: { id: input.sessionId },
    include: interviewSessionInclude
  });

  if (!session) {
    return null;
  }

  return mapInterviewSession(session);
}

export async function resumeCurrentInterviewEvent(sessionId: string) {
  const existing = await ensureInterviewEvents(prisma, sessionId);

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

  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: interviewSessionInclude
  });

  if (!session) {
    return null;
  }

  return mapInterviewSession(session);
}

export async function startNextInterviewEvent(sessionId: string, openingQuestion: string) {
  const existing = await ensureInterviewEvents(prisma, sessionId);

  if (!existing) {
    return null;
  }

  const nextSequence = (existing.events[existing.events.length - 1]?.sequence ?? 0) + 1;
  const emptySnapshot = createEmptySnapshot();
  const nextEventId = randomUUID();
  const assistantTurn = createOpeningAssistantTurnPayload(openingQuestion);

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
        sessionId,
        sequence: nextSequence,
        status: "active",
        stage: "collect_event",
        explorationRound: 1,
        coveredLenses: [],
        roundCoveredLenses: [],
        roundMeaningfulReplyCount: 0,
        totalMeaningfulReplyCount: 0,
        startMessageSequence: existing.messages.length,
        event: emptySnapshot.event,
        feeling: emptySnapshot.feeling,
        whyItMattered: emptySnapshot.whyItMattered,
        happinessType: emptySnapshot.happinessType,
        selfPattern: emptySnapshot.selfPattern,
        snapshotData: toJsonValue(buildSnapshotDataForDimension(existing.dimension, emptySnapshot)),
        confidence: emptySnapshot.confidence,
        missingSlots: emptySnapshot.missingSlots
      }
    }),
    prisma.interviewMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: serializeAssistantTurnPayload(assistantTurn),
        sequence: existing.messages.length
      }
    }),
    prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        activeEventId: nextEventId,
        stage: "collect_event",
        lastAssistantQuestion: openingQuestion
      }
    })
  );

  await prisma.$transaction(writes);

  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: interviewSessionInclude
  });

  if (!session) {
    return null;
  }

  return mapInterviewSession(session);
}

export async function saveJoyInterviewDraft(sessionId: string, draftEntry: JoyEntryDraft) {
  const existing = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: interviewSessionInclude
  });

  if (!existing) {
    return null;
  }

  const legacyProjection = projectLegacyFields(draftEntry);
  const payload = buildJournalPayloadForDimension(existing.dimension, {
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

  await prisma.$transaction([
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
        status: "draft",
        savedAt: null,
        linkedSessionIds: [sessionId]
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

  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: interviewSessionInclude
  });

  if (!session) {
    return null;
  }

  return mapInterviewSession(session);
}

export async function reopenJoyInterviewSessionRecord(sessionId: string) {
  const existing = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: interviewSessionInclude
  });

  if (!existing) {
    return null;
  }

  await prisma.interviewSession.update({
    where: { id: sessionId },
    data: {
      status: "active",
      stage: existing.stage === "finalize" ? "wrap_up" : existing.stage,
      pausedAt: null,
      completedAt: null
    }
  });

  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: interviewSessionInclude
  });

  if (!session) {
    return null;
  }

  return mapInterviewSession(session);
}

export async function pauseJoyInterviewSessionRecord(sessionId: string) {
  const pausedAt = new Date();

  const session = await prisma.interviewSession.update({
    where: { id: sessionId },
    data: {
      status: "paused",
      pausedAt,
      completedAt: null
    },
    include: interviewSessionInclude
  });

  return mapInterviewSession(session);
}

export async function completeJoyInterviewSessionRecord(sessionId: string) {
  const completedAt = new Date();

  const session = await prisma.interviewSession.update({
    where: { id: sessionId },
    data: {
      status: "completed",
      completedAt,
      pausedAt: null
    },
    include: interviewSessionInclude
  });

  return mapInterviewSession(session);
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
      status: "draft",
      savedAt: null
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
  const existing = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: interviewSessionInclude
  });

  if (!existing?.joyEntry) {
    return null;
  }

  const savedAt = new Date();
  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.joyEntry.update({
      where: { sessionId },
      data: {
        status: "saved",
        savedAt,
        linkedSessionIds: [sessionId]
      }
    }),
    prisma.interviewSession.update({
      where: { id: sessionId },
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

  if (existing.activeEventId) {
    writes.push(
      prisma.interviewEvent.update({
        where: { id: existing.activeEventId },
        data: {
          status: "completed",
          completedAt: savedAt
        }
      })
    );
  }

  await prisma.$transaction(writes);

  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: interviewSessionInclude
  });

  if (!session) {
    return null;
  }

  return mapInterviewSession(session);
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
