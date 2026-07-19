import { buildDimensionSemanticInterpretation } from "@/features/interview/server/semantic-interpretation";
import {
  getDelightSignature,
  getDirectionSignal,
  getDurability,
  getJoyClosureTarget,
  getJoyMoment,
  getJoyPsychProfile,
  getJoySource,
  getJoyTags,
  getJoyTrack,
  getManualClue,
  getMeaningNeed,
  getStateShift,
  getValueImpact,
  hasJoyStableClosure
} from "@/features/joy-interview/server/joy-interview-engine";
import type {
  DraftBrief,
  DraftCompletionMode,
  DraftEmphasis,
  InterviewDimension,
  InterviewEventRecord,
  InterviewSessionRecord,
  JoySnapshot
} from "@/types/interview";
import {
  hasSpecificDelightCue,
  normalizeSignature,
  sanitizeNullableString
} from "@/features/interview/server/draft-policies/shared";

export function pickPrimaryEvent(dimension: InterviewDimension, sourceEvents: InterviewEventRecord[]) {
  if (dimension === "joy") {
    return (
      sourceEvents.find((event) => isJoySnapshotComplete(event.snapshot)) ??
      sourceEvents.find((event) => getJoySource(event.snapshot)) ??
      sourceEvents.find((event) => getJoyMoment(event.snapshot)) ??
      sourceEvents[0] ??
      null
    );
  }

  if (dimension === "improvement") {
    return (
      sourceEvents.find((event) => hasCompleteImprovementSnapshot(event.snapshot)) ??
      sourceEvents.find((event) => event.snapshot.nextAttempt) ??
      sourceEvents.find((event) => event.snapshot.controllableFactor) ??
      sourceEvents.find((event) => event.snapshot.frictionPoint || event.snapshot.repeatCondition || event.snapshot.whyItMattered) ??
      sourceEvents.find((event) => event.snapshot.event) ??
      sourceEvents[0] ??
      null
    );
  }

  return (
    sourceEvents.find((event) => event.snapshot.selfPattern) ??
    sourceEvents.find((event) => event.snapshot.whyItMattered) ??
    sourceEvents.find((event) => event.snapshot.event) ??
    sourceEvents[0] ??
    null
  );
}

function getJoyClosingValue(snapshot: JoySnapshot) {
  return getJoyClosureTarget(snapshot) === "manual_clue" ? getManualClue(snapshot) : getDelightSignature(snapshot);
}

function isJoySnapshotComplete(snapshot: JoySnapshot) {
  const hasCore =
    getJoyTrack(snapshot) === "delight_track"
      ? Boolean(getJoyMoment(snapshot) && getJoySource(snapshot) && getStateShift(snapshot))
      : Boolean(getJoyMoment(snapshot) && getJoySource(snapshot) && (getStateShift(snapshot) || getMeaningNeed(snapshot)));

  return hasCore && hasJoyStableClosure(snapshot);
}

function resolveJoyCompletionMode(session: InterviewSessionRecord, sourceEvents: InterviewEventRecord[]): DraftCompletionMode {
  if (session.pendingDecision?.kind === "event_complete" && session.pendingDecision.completionMode) {
    return session.pendingDecision.completionMode;
  }

  if (sourceEvents.some((event) => isJoySnapshotComplete(event.snapshot)) || isJoySnapshotComplete(session.snapshot)) {
    return "complete";
  }

  return "user_override_partial";
}

function deriveJoyEmphasis(snapshot: JoySnapshot): DraftEmphasis {
  const psychProfile = getJoyPsychProfile(snapshot);
  const hasMeaningSignal = psychProfile.track === "meaning_track";
  const hasDelightSignal = Boolean(getStateShift(snapshot) || getDelightSignature(snapshot));

  if (hasMeaningSignal && hasDelightSignal) {
    return "mixed";
  }

  if (hasMeaningSignal) {
    return "meaning";
  }

  if (hasDelightSignal) {
    return "delight";
  }

  return "mixed";
}

function pickJoyEmotionalCore(snapshot: JoySnapshot) {
  const joySource = sanitizeNullableString(getJoySource(snapshot) ?? snapshot.whyItMattered);
  const delightSignature = sanitizeNullableString(getDelightSignature(snapshot));

  if (delightSignature && hasSpecificDelightCue(delightSignature)) {
    return delightSignature;
  }

  if (joySource) {
    return joySource;
  }

  return delightSignature;
}

function buildJoyBrief(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  completionMode: DraftCompletionMode;
}): DraftBrief {
  const primaryEvent = pickPrimaryEvent("joy", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const primaryClueSignature = normalizeSignature(getJoyClosingValue(primarySnapshot));
  const primarySourceSignature = normalizeSignature(getJoySource(primarySnapshot));
  const relatedEvents = input.sourceEvents.filter((event) => {
    if (!primaryEvent || event.id === primaryEvent.id) {
      return false;
    }

    if (primaryClueSignature && normalizeSignature(getJoyClosingValue(event.snapshot)) === primaryClueSignature) {
      return true;
    }

    if (primarySourceSignature && normalizeSignature(getJoySource(event.snapshot)) === primarySourceSignature) {
      return true;
    }

    return false;
  });
  const compositionMode = relatedEvents.length ? "stitched_moments" : "single_moment";
  const stateShift = sanitizeNullableString(getStateShift(primarySnapshot));
  const meaningNeed = sanitizeNullableString(getMeaningNeed(primarySnapshot));
  const anchorScene = sanitizeNullableString(getJoyMoment(primarySnapshot) ?? primarySnapshot.event);
  const emotionalCore = pickJoyEmotionalCore(primarySnapshot);
  const joyTrack = getJoyTrack(primarySnapshot);
  const closureTarget = getJoyClosureTarget(primarySnapshot);
  const closingInsight =
    input.completionMode === "complete"
      ? sanitizeNullableString(getJoyClosingValue(primarySnapshot))
      : null;
  const semanticInterpretation = buildDimensionSemanticInterpretation({
    dimension: "joy",
    snapshot: primarySnapshot,
    sourceEvents: input.sourceEvents,
    activeEvent: primaryEvent
  });

  return {
    dimension: "joy",
    completionMode: input.completionMode,
    compositionMode,
    emphasis: deriveJoyEmphasis(primarySnapshot),
    anchorScene,
    emotionalCore,
    stateOrNeed:
      stateShift && meaningNeed
        ? `${stateShift}；${meaningNeed}`
        : stateShift ?? meaningNeed,
    closingInsight,
    joyTrack,
    joyKind: getJoyPsychProfile(primarySnapshot).kind,
    closureTarget,
    supportingMoments: relatedEvents
      .map((event) => sanitizeNullableString(getJoyMoment(event.snapshot) ?? event.snapshot.event))
      .filter((value): value is string => Boolean(value))
      .slice(0, 2),
    directionSignal: sanitizeNullableString(getDirectionSignal(primarySnapshot)),
    valueSignal: sanitizeNullableString(getValueImpact(primarySnapshot)),
    durabilitySignal: sanitizeNullableString(getDurability(primarySnapshot)),
    titleHint: semanticInterpretation.titleTheme ?? anchorScene,
    theorySummary: semanticInterpretation.theorySummary,
    titleTheme: semanticInterpretation.titleTheme,
    titleCandidates: semanticInterpretation.titleCandidates,
    antiFlatteningTargets: semanticInterpretation.antiFlatteningTargets,
    tags: Array.from(new Set(input.sourceEvents.flatMap((event) => getJoyTags(event.snapshot)))).slice(0, 6)
  };
}

function buildDefaultBrief(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
}): DraftBrief {
  const primaryEvent = pickPrimaryEvent(input.session.dimension, input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const relatedEvents = input.sourceEvents.filter((event) => event.id !== primaryEvent?.id);
  const semanticInterpretation = buildDimensionSemanticInterpretation({
    dimension: input.session.dimension,
    snapshot: primarySnapshot,
    sourceEvents: input.sourceEvents,
    activeEvent: primaryEvent
  });

  return {
    dimension: input.session.dimension,
    completionMode: "complete",
    compositionMode: relatedEvents.length ? "stitched_moments" : "single_moment",
    emphasis: "mixed",
    anchorScene: sanitizeNullableString(primarySnapshot.event),
    emotionalCore: sanitizeNullableString(primarySnapshot.whyItMattered),
    stateOrNeed: sanitizeNullableString(primarySnapshot.feeling),
    closingInsight: sanitizeNullableString(primarySnapshot.selfPattern),
    supportingMoments: relatedEvents
      .map((event) => sanitizeNullableString(event.snapshot.event))
      .filter((value): value is string => Boolean(value))
      .slice(0, 2),
    directionSignal: sanitizeNullableString(primarySnapshot.happinessType),
    valueSignal: null,
    durabilitySignal: null,
    titleHint: semanticInterpretation.titleTheme ?? sanitizeNullableString(primarySnapshot.event),
    theorySummary: semanticInterpretation.theorySummary,
    titleTheme: semanticInterpretation.titleTheme,
    titleCandidates: semanticInterpretation.titleCandidates,
    antiFlatteningTargets: semanticInterpretation.antiFlatteningTargets,
    tags: Array.from(new Set(input.sourceEvents.flatMap((event) => [event.snapshot.happinessType, event.snapshot.feeling]))).filter(
      (value): value is string => Boolean(value)
    ).slice(0, 6)
  };
}

function hasFulfillmentValueSignal(snapshot: JoySnapshot) {
  return Boolean(sanitizeNullableString(snapshot.selfPattern));
}

function resolveFulfillmentCompletionMode(session: InterviewSessionRecord, sourceEvents: InterviewEventRecord[]): DraftCompletionMode {
  if (sourceEvents.some((event) => hasFulfillmentValueSignal(event.snapshot)) || hasFulfillmentValueSignal(session.snapshot)) {
    return "complete";
  }

  return "user_override_partial";
}

function buildFulfillmentBrief(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  completionMode: DraftCompletionMode;
}): DraftBrief {
  const primaryEvent = pickPrimaryEvent("fulfillment", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const relatedEvents = input.sourceEvents.filter((event) => event.id !== primaryEvent?.id);
  const semanticInterpretation = buildDimensionSemanticInterpretation({
    dimension: "fulfillment",
    snapshot: primarySnapshot,
    sourceEvents: input.sourceEvents,
    activeEvent: primaryEvent
  });
  const tags = Array.from(
    new Set(input.sourceEvents.flatMap((event) => [event.snapshot.happinessType, event.snapshot.feeling]))
  ).filter((value): value is string => Boolean(value)).slice(0, 6);

  return {
    dimension: "fulfillment",
    completionMode: input.completionMode,
    compositionMode: relatedEvents.length ? "stitched_moments" : "single_moment",
    emphasis: "meaning",
    anchorScene: sanitizeNullableString(primarySnapshot.event),
    emotionalCore: sanitizeNullableString(primarySnapshot.whyItMattered),
    stateOrNeed: sanitizeNullableString(primarySnapshot.feeling),
    closingInsight:
      input.completionMode === "complete" ? sanitizeNullableString(primarySnapshot.selfPattern) : null,
    supportingMoments: relatedEvents
      .map((event) => sanitizeNullableString(event.snapshot.event))
      .filter((value): value is string => Boolean(value))
      .slice(0, 2),
    directionSignal: sanitizeNullableString(primarySnapshot.happinessType),
    valueSignal: sanitizeNullableString(primarySnapshot.selfPattern),
    durabilitySignal: null,
    titleHint: semanticInterpretation.titleTheme ?? sanitizeNullableString(primarySnapshot.event),
    theorySummary: semanticInterpretation.theorySummary,
    titleTheme: semanticInterpretation.titleTheme,
    titleCandidates: semanticInterpretation.titleCandidates,
    antiFlatteningTargets: semanticInterpretation.antiFlatteningTargets,
    tags
  };
}

function hasReflectionViewpointShift(snapshot: JoySnapshot) {
  return Boolean(sanitizeNullableString(snapshot.selfPattern));
}

function resolveReflectionCompletionMode(session: InterviewSessionRecord, sourceEvents: InterviewEventRecord[]): DraftCompletionMode {
  if (sourceEvents.some((event) => hasReflectionViewpointShift(event.snapshot)) || hasReflectionViewpointShift(session.snapshot)) {
    return "complete";
  }

  return "user_override_partial";
}

function buildReflectionBrief(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  completionMode: DraftCompletionMode;
}): DraftBrief {
  const primaryEvent = pickPrimaryEvent("reflection", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const relatedEvents = input.sourceEvents.filter((event) => event.id !== primaryEvent?.id);
  const semanticInterpretation = buildDimensionSemanticInterpretation({
    dimension: "reflection",
    snapshot: primarySnapshot,
    sourceEvents: input.sourceEvents,
    activeEvent: primaryEvent
  });
  const tags = Array.from(
    new Set(input.sourceEvents.flatMap((event) => [event.snapshot.happinessType, event.snapshot.feeling]))
  ).filter((value): value is string => Boolean(value)).slice(0, 6);

  return {
    dimension: "reflection",
    completionMode: input.completionMode,
    compositionMode: relatedEvents.length ? "stitched_moments" : "single_moment",
    emphasis: "meaning",
    anchorScene: sanitizeNullableString(primarySnapshot.event),
    emotionalCore: sanitizeNullableString(primarySnapshot.whyItMattered),
    stateOrNeed: sanitizeNullableString(primarySnapshot.feeling),
    closingInsight:
      input.completionMode === "complete" ? sanitizeNullableString(primarySnapshot.selfPattern) : null,
    supportingMoments: relatedEvents
      .map((event) => sanitizeNullableString(event.snapshot.event))
      .filter((value): value is string => Boolean(value))
      .slice(0, 2),
    directionSignal: sanitizeNullableString(primarySnapshot.happinessType),
    valueSignal: sanitizeNullableString(primarySnapshot.selfPattern),
    durabilitySignal: null,
    titleHint: semanticInterpretation.titleTheme ?? sanitizeNullableString(primarySnapshot.whyItMattered ?? primarySnapshot.event),
    theorySummary: semanticInterpretation.theorySummary,
    titleTheme: semanticInterpretation.titleTheme,
    titleCandidates: semanticInterpretation.titleCandidates,
    antiFlatteningTargets: semanticInterpretation.antiFlatteningTargets,
    tags
  };
}

export function getImprovementCore(snapshot: JoySnapshot) {
  return snapshot.improvementTrack === "repeat_good"
    ? sanitizeNullableString(snapshot.repeatCondition)
    : snapshot.improvementTrack === "avoid_bad"
      ? sanitizeNullableString(snapshot.frictionPoint ?? snapshot.whyItMattered)
      : sanitizeNullableString(snapshot.frictionPoint ?? snapshot.repeatCondition ?? snapshot.whyItMattered);
}

function hasImprovementCore(snapshot: JoySnapshot) {
  return Boolean(getImprovementCore(snapshot));
}

function hasCompleteImprovementSnapshot(snapshot: JoySnapshot) {
  return Boolean(
    sanitizeNullableString(snapshot.event) &&
      snapshot.improvementTrack &&
      sanitizeNullableString(snapshot.stateAssessment) &&
      hasImprovementCore(snapshot) &&
      sanitizeNullableString(snapshot.controllableFactor) &&
      sanitizeNullableString(snapshot.nextAttempt ?? snapshot.selfPattern)
  );
}

export function resolveImprovementCompletionMode(
  session: InterviewSessionRecord,
  sourceEvents: InterviewEventRecord[]
): DraftCompletionMode {
  if (session.pendingDecision?.kind === "event_complete" && session.pendingDecision.completionMode) {
    return session.pendingDecision.completionMode;
  }

  if (sourceEvents.some((event) => hasCompleteImprovementSnapshot(event.snapshot)) || hasCompleteImprovementSnapshot(session.snapshot)) {
    return "complete";
  }

  return "user_override_partial";
}

export function buildImprovementBrief(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  completionMode: DraftCompletionMode;
}): DraftBrief {
  const primaryEvent = pickPrimaryEvent("improvement", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const relatedEvents = input.sourceEvents.filter((event) => event.id !== primaryEvent?.id);
  const frictionPoint = sanitizeNullableString(primarySnapshot.frictionPoint ?? primarySnapshot.whyItMattered);
  const repeatCondition = sanitizeNullableString(primarySnapshot.repeatCondition);
  const controllableFactor = sanitizeNullableString(primarySnapshot.controllableFactor);
  const nextAttempt = sanitizeNullableString(primarySnapshot.nextAttempt ?? primarySnapshot.selfPattern);
  const successSignal = sanitizeNullableString(primarySnapshot.successSignal);
  const tags = Array.from(
    new Set(input.sourceEvents.flatMap((event) => [event.snapshot.happinessType, event.snapshot.feeling, ...(event.snapshot.tags ?? [])]))
  ).filter((value): value is string => Boolean(value)).slice(0, 6);
  const semanticInterpretation = buildDimensionSemanticInterpretation({
    dimension: "improvement",
    snapshot: primarySnapshot,
    sourceEvents: input.sourceEvents,
    activeEvent: primaryEvent
  });
  const emotionalCore =
    primarySnapshot.improvementTrack === "repeat_good"
      ? repeatCondition ?? frictionPoint
      : primarySnapshot.improvementTrack === "avoid_bad"
        ? frictionPoint ?? repeatCondition
        : frictionPoint ?? repeatCondition;

  return {
    dimension: "improvement",
    completionMode: input.completionMode,
    compositionMode: relatedEvents.length ? "stitched_moments" : "single_moment",
    emphasis: "meaning",
    anchorScene: sanitizeNullableString(primarySnapshot.event),
    emotionalCore,
    stateOrNeed: sanitizeNullableString(primarySnapshot.stateAssessment ?? primarySnapshot.feeling),
    closingInsight: input.completionMode === "complete" ? nextAttempt : null,
    improvementTrack: primarySnapshot.improvementTrack ?? null,
    frictionPoint,
    repeatCondition,
    controllableFactor,
    nextAttempt: input.completionMode === "complete" ? nextAttempt : null,
    successSignal,
    supportingMoments: relatedEvents
      .map((event) => sanitizeNullableString(event.snapshot.event))
      .filter((value): value is string => Boolean(value))
      .slice(0, 2),
    directionSignal: sanitizeNullableString(primarySnapshot.happinessType),
    valueSignal: controllableFactor,
    durabilitySignal: successSignal,
    titleHint: semanticInterpretation.titleTheme ?? controllableFactor ?? nextAttempt ?? emotionalCore ?? sanitizeNullableString(primarySnapshot.event),
    theorySummary: semanticInterpretation.theorySummary,
    titleTheme: semanticInterpretation.titleTheme,
    titleCandidates: semanticInterpretation.titleCandidates,
    antiFlatteningTargets: semanticInterpretation.antiFlatteningTargets,
    tags
  };
}

function hasGratitudeRelationshipSignal(snapshot: JoySnapshot) {
  return Boolean(sanitizeNullableString(snapshot.relationshipSignal ?? snapshot.selfPattern));
}

function resolveGratitudeCompletionMode(session: InterviewSessionRecord, sourceEvents: InterviewEventRecord[]): DraftCompletionMode {
  if (session.pendingDecision?.kind === "event_complete" && session.pendingDecision.completionMode) {
    return session.pendingDecision.completionMode;
  }

  if (sourceEvents.some((event) => hasGratitudeRelationshipSignal(event.snapshot)) || hasGratitudeRelationshipSignal(session.snapshot)) {
    return "complete";
  }

  return "user_override_partial";
}

function buildGratitudeBrief(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  completionMode: DraftCompletionMode;
}): DraftBrief {
  const primaryEvent = pickPrimaryEvent("gratitude", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const relatedEvents = input.sourceEvents.filter((event) => event.id !== primaryEvent?.id);
  const gratitudeMoment = sanitizeNullableString(primarySnapshot.gratitudeMoment ?? primarySnapshot.event);
  const kindAction = sanitizeNullableString(primarySnapshot.kindAction ?? primarySnapshot.whyItMattered);
  const seenNeed = sanitizeNullableString(primarySnapshot.seenNeed);
  const innerEffect = sanitizeNullableString(primarySnapshot.innerEffect ?? primarySnapshot.feeling);
  const gratitudeReason = sanitizeNullableString(primarySnapshot.gratitudeReason ?? primarySnapshot.whyItMattered);
  const relationshipSignal = sanitizeNullableString(primarySnapshot.relationshipSignal ?? primarySnapshot.selfPattern);
  const reciprocityHint = sanitizeNullableString(primarySnapshot.reciprocityHint);
  const semanticInterpretation = buildDimensionSemanticInterpretation({
    dimension: "gratitude",
    snapshot: primarySnapshot,
    sourceEvents: input.sourceEvents,
    activeEvent: primaryEvent
  });
  const tags = Array.from(
    new Set(input.sourceEvents.flatMap((event) => [
      event.snapshot.gratitudeType ?? event.snapshot.happinessType,
      event.snapshot.innerEffect ?? event.snapshot.feeling,
      ...(event.snapshot.tags ?? [])
    ]))
  ).filter((value): value is string => Boolean(value)).slice(0, 6);

  return {
    dimension: "gratitude",
    completionMode: input.completionMode,
    compositionMode: relatedEvents.length ? "stitched_moments" : "single_moment",
    emphasis: "meaning",
    anchorScene: gratitudeMoment,
    emotionalCore: kindAction ?? gratitudeReason,
    stateOrNeed: seenNeed ?? innerEffect,
    closingInsight: input.completionMode === "complete" ? relationshipSignal : null,
    supportingMoments: relatedEvents
      .map((event) => sanitizeNullableString(event.snapshot.gratitudeMoment ?? event.snapshot.event))
      .filter((value): value is string => Boolean(value))
      .slice(0, 2),
    directionSignal: sanitizeNullableString(primarySnapshot.gratitudeType ?? primarySnapshot.happinessType),
    valueSignal: sanitizeNullableString(primarySnapshot.gratitudeTarget),
    durabilitySignal: reciprocityHint,
    titleHint: semanticInterpretation.titleTheme ?? seenNeed ?? kindAction ?? relationshipSignal ?? gratitudeMoment,
    theorySummary: semanticInterpretation.theorySummary,
    titleTheme: semanticInterpretation.titleTheme,
    titleCandidates: semanticInterpretation.titleCandidates,
    antiFlatteningTargets: semanticInterpretation.antiFlatteningTargets,
    tags
  };
}

export function resolveDraftCompletionMode(session: InterviewSessionRecord, sourceEvents: InterviewEventRecord[]) {
  if (session.dimension === "joy") {
    return resolveJoyCompletionMode(session, sourceEvents);
  }

  if (session.dimension === "fulfillment") {
    return resolveFulfillmentCompletionMode(session, sourceEvents);
  }

  if (session.dimension === "reflection") {
    return resolveReflectionCompletionMode(session, sourceEvents);
  }

  if (session.dimension === "improvement") {
    return resolveImprovementCompletionMode(session, sourceEvents);
  }

  if (session.dimension === "gratitude") {
    return resolveGratitudeCompletionMode(session, sourceEvents);
  }

  return "complete" as const;
}

export function buildDraftBrief(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  completionMode?: DraftCompletionMode;
}) {
  const completionMode = input.completionMode ?? resolveDraftCompletionMode(input.session, input.sourceEvents);

  if (input.session.dimension === "joy") {
    return buildJoyBrief({
      session: input.session,
      sourceEvents: input.sourceEvents,
      completionMode
    });
  }

  if (input.session.dimension === "fulfillment") {
    return buildFulfillmentBrief({
      session: input.session,
      sourceEvents: input.sourceEvents,
      completionMode
    });
  }

  if (input.session.dimension === "reflection") {
    return buildReflectionBrief({
      session: input.session,
      sourceEvents: input.sourceEvents,
      completionMode
    });
  }

  if (input.session.dimension === "improvement") {
    return buildImprovementBrief({
      session: input.session,
      sourceEvents: input.sourceEvents,
      completionMode
    });
  }

  if (input.session.dimension === "gratitude") {
    return buildGratitudeBrief({
      session: input.session,
      sourceEvents: input.sourceEvents,
      completionMode
    });
  }

  return buildDefaultBrief({
    session: input.session,
    sourceEvents: input.sourceEvents
  });
}
