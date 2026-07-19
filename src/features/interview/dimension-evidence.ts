import type {
  DraftCompletionMode,
  InterviewDimension,
  InterviewSnapshotData,
  JoyPsychProfile,
  JoySnapshot
} from "@/types/interview";

export type EvidenceReadiness = "insufficient" | "partial" | "complete";

export interface DimensionEvidenceAssessment {
  snapshotData: InterviewSnapshotData;
  missingSlots: string[];
  confidence: number;
  readiness: EvidenceReadiness;
  completionMode: DraftCompletionMode | null;
}

const DIMENSION_SLOT_WHITELISTS: Record<InterviewDimension, ReadonlySet<string>> = {
  joy: new Set(["joyMoment", "joySource", "stateShift", "meaningNeed", "manualClue", "delightSignature"]),
  fulfillment: new Set(["experience", "progressEvidence", "valueSignal"]),
  reflection: new Set(["trigger", "insight", "viewpointShift"]),
  improvement: new Set([
    "situation",
    "improvementTrack",
    "stateAssessment",
    "frictionPoint",
    "repeatCondition",
    "controllableFactor",
    "nextAttempt"
  ]),
  gratitude: new Set(["gratitudeMoment", "kindAction", "seenNeed", "gratitudeReason", "relationshipSignal"])
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readDimensionRecord(dimension: InterviewDimension, raw: unknown) {
  const record = asRecord(raw);
  return record?.kind === dimension ? record : null;
}

function readString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringArray(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function readPsychProfile(record: Record<string, unknown> | null, snapshot: JoySnapshot): JoyPsychProfile | undefined {
  const value = asRecord(record?.psychProfile);
  if (
    value &&
    (value.track === "meaning_track" || value.track === "delight_track") &&
    typeof value.kind === "string" &&
    typeof value.directionLevel === "string" &&
    typeof value.valueLevel === "string" &&
    typeof value.durabilityLevel === "string" &&
    typeof value.confidence === "number"
  ) {
    return value as unknown as JoyPsychProfile;
  }
  return snapshot.psychProfile;
}

function normalizedConfidence(score: number, completeScore: number) {
  return Math.round(Math.min(1, score / completeScore) * 100) / 100;
}

function completionMode(readiness: EvidenceReadiness): DraftCompletionMode | null {
  if (readiness === "complete") return "complete";
  if (readiness === "partial") return "user_override_partial";
  return null;
}

function finalize(snapshotData: InterviewSnapshotData, missingSlots: string[], readiness: EvidenceReadiness) {
  const allowed = DIMENSION_SLOT_WHITELISTS[snapshotData.kind];
  const safeMissingSlots = missingSlots.filter((slot) => allowed.has(slot));
  const normalized = { ...snapshotData, missingSlots: safeMissingSlots } as InterviewSnapshotData;
  return {
    snapshotData: normalized,
    missingSlots: safeMissingSlots,
    confidence: normalized.confidence,
    readiness,
    completionMode: completionMode(readiness)
  } satisfies DimensionEvidenceAssessment;
}

export function assessDimensionEvidence(
  dimension: InterviewDimension,
  snapshot: JoySnapshot,
  rawSnapshotData?: unknown
): DimensionEvidenceAssessment {
  const raw = readDimensionRecord(dimension, rawSnapshotData);

  if (dimension === "joy") {
    const joyMoment = readString(raw, "joyMoment") ?? snapshot.joyMoment ?? snapshot.event;
    const joySource = readString(raw, "joySource") ?? snapshot.joySource ?? snapshot.whyItMattered;
    const stateShift = readString(raw, "stateShift") ?? snapshot.stateShift ?? snapshot.feeling;
    const meaningNeed = readString(raw, "meaningNeed") ?? snapshot.meaningNeed ?? null;
    const manualClue = readString(raw, "manualClue") ?? snapshot.manualClue ?? snapshot.selfPattern;
    const delightSignature = readString(raw, "delightSignature") ?? snapshot.delightSignature ?? null;
    const psychProfile = readPsychProfile(raw, snapshot);
    const track = psychProfile?.track ?? (meaningNeed || manualClue ? "meaning_track" : "delight_track");
    const coreStateReady = track === "delight_track" ? Boolean(stateShift) : Boolean(stateShift || meaningNeed);
    const coreReady = Boolean(joyMoment && joySource && coreStateReady);
    const closureReady = track === "delight_track" ? Boolean(delightSignature) : Boolean(manualClue);
    const readiness: EvidenceReadiness = coreReady && closureReady ? "complete" : coreReady ? "partial" : "insufficient";
    const missingSlots = [
      !joyMoment ? "joyMoment" : null,
      !joySource ? "joySource" : null,
      !coreStateReady ? (track === "delight_track" ? "stateShift" : "meaningNeed") : null,
      !closureReady ? (track === "delight_track" ? "delightSignature" : "manualClue") : null
    ].filter((slot): slot is string => Boolean(slot));
    const score = coreReady && closureReady ? 82 : coreReady ? 66 : joyMoment && joySource ? 48 : joyMoment ? 24 : 0;
    const tags = readStringArray(raw, "tags");

    return finalize({
      kind: "joy",
      joyMoment: joyMoment ?? null,
      joySource: joySource ?? null,
      stateShift: stateShift ?? null,
      meaningNeed: meaningNeed ?? null,
      manualClue: manualClue ?? null,
      delightSignature: delightSignature ?? null,
      directionSignal: readString(raw, "directionSignal") ?? snapshot.directionSignal ?? snapshot.happinessType,
      valueImpact: readString(raw, "valueImpact") ?? snapshot.valueImpact ?? null,
      durability: readString(raw, "durability") ?? snapshot.durability ?? null,
      psychProfile,
      tags: tags.length ? tags : snapshot.tags ?? [],
      confidence: normalizedConfidence(score, 82),
      missingSlots
    }, missingSlots, readiness);
  }

  if (dimension === "fulfillment") {
    const experience = readString(raw, "experience") ?? snapshot.event;
    const progressEvidence = readString(raw, "progressEvidence") ?? snapshot.whyItMattered;
    const valueSignal = readString(raw, "valueSignal") ?? snapshot.selfPattern;
    const partial = Boolean(experience && progressEvidence);
    const complete = Boolean(partial && valueSignal);
    const readiness: EvidenceReadiness = complete ? "complete" : partial ? "partial" : "insufficient";
    const missingSlots = [!experience ? "experience" : null, !progressEvidence ? "progressEvidence" : null, !valueSignal ? "valueSignal" : null]
      .filter((slot): slot is string => Boolean(slot));
    const score = complete ? 82 : partial ? 60 : experience ? 28 : 0;
    return finalize({
      kind: "fulfillment",
      experience: experience ?? null,
      feeling: readString(raw, "feeling") ?? snapshot.feeling,
      fulfillmentType: readString(raw, "fulfillmentType") ?? snapshot.happinessType,
      progressEvidence: progressEvidence ?? null,
      valueSignal: valueSignal ?? null,
      confidence: normalizedConfidence(score, 82),
      missingSlots
    }, missingSlots, readiness);
  }

  if (dimension === "reflection") {
    const trigger = readString(raw, "trigger") ?? snapshot.event;
    const insight = readString(raw, "insight") ?? snapshot.whyItMattered;
    const viewpointShift = readString(raw, "viewpointShift") ?? snapshot.selfPattern;
    const partial = Boolean(trigger && insight);
    const complete = Boolean(partial && viewpointShift);
    const readiness: EvidenceReadiness = complete ? "complete" : partial ? "partial" : "insufficient";
    const missingSlots = [!trigger ? "trigger" : null, !insight ? "insight" : null, !viewpointShift ? "viewpointShift" : null]
      .filter((slot): slot is string => Boolean(slot));
    const score = complete ? 82 : partial ? 60 : trigger ? 28 : 0;
    return finalize({
      kind: "reflection",
      trigger: trigger ?? null,
      feeling: readString(raw, "feeling") ?? snapshot.feeling,
      reflectionType: readString(raw, "reflectionType") ?? snapshot.happinessType,
      insight: insight ?? null,
      viewpointShift: viewpointShift ?? null,
      confidence: normalizedConfidence(score, 82),
      missingSlots
    }, missingSlots, readiness);
  }

  if (dimension === "improvement") {
    const situation = readString(raw, "situation") ?? snapshot.event;
    const rawTrack = raw?.improvementTrack;
    const improvementTrack = rawTrack === "repeat_good" || rawTrack === "avoid_bad" ? rawTrack : snapshot.improvementTrack ?? null;
    const stateAssessment = readString(raw, "stateAssessment") ?? snapshot.stateAssessment ?? null;
    const frictionPoint = readString(raw, "frictionPoint") ?? snapshot.frictionPoint ?? (improvementTrack !== "repeat_good" ? snapshot.whyItMattered : null);
    const repeatCondition = readString(raw, "repeatCondition") ?? snapshot.repeatCondition ?? (improvementTrack === "repeat_good" ? snapshot.whyItMattered : null);
    const controllableFactor = readString(raw, "controllableFactor") ?? snapshot.controllableFactor ?? null;
    const nextAttempt = readString(raw, "nextAttempt") ?? snapshot.nextAttempt ?? snapshot.selfPattern;
    const cause = improvementTrack === "repeat_good" ? repeatCondition : improvementTrack === "avoid_bad" ? frictionPoint : frictionPoint ?? repeatCondition;
    const partial = Boolean(situation && cause);
    const complete = Boolean(partial && improvementTrack && stateAssessment && controllableFactor && nextAttempt);
    const readiness: EvidenceReadiness = complete ? "complete" : partial ? "partial" : "insufficient";
    const missingSlots = [
      !situation ? "situation" : null,
      !improvementTrack ? "improvementTrack" : null,
      !stateAssessment ? "stateAssessment" : null,
      improvementTrack === "repeat_good" && !repeatCondition ? "repeatCondition" : null,
      improvementTrack === "avoid_bad" && !frictionPoint ? "frictionPoint" : null,
      !improvementTrack && !cause ? "frictionPoint" : null,
      !controllableFactor ? "controllableFactor" : null,
      !nextAttempt ? "nextAttempt" : null
    ].filter((slot): slot is string => Boolean(slot));
    const score = complete ? 84 : partial && controllableFactor ? 76 : partial ? 60 : situation && (improvementTrack || stateAssessment) ? 42 : situation ? 28 : 0;
    return finalize({
      kind: "improvement",
      situation: situation ?? null,
      improvementTrack,
      stateAssessment,
      feeling: readString(raw, "feeling") ?? snapshot.feeling,
      improvementType: readString(raw, "improvementType") ?? snapshot.happinessType,
      frictionPoint: frictionPoint ?? null,
      repeatCondition: repeatCondition ?? null,
      controllableFactor,
      nextAttempt: nextAttempt ?? null,
      successSignal: readString(raw, "successSignal") ?? snapshot.successSignal ?? null,
      confidence: normalizedConfidence(score, 84),
      missingSlots
    }, missingSlots, readiness);
  }

  const gratitudeMoment = readString(raw, "gratitudeMoment") ?? readString(raw, "moment") ?? snapshot.gratitudeMoment ?? snapshot.event;
  const kindAction = readString(raw, "kindAction") ?? snapshot.kindAction ?? null;
  const seenNeed = readString(raw, "seenNeed") ?? snapshot.seenNeed ?? null;
  const gratitudeReason = readString(raw, "gratitudeReason") ?? snapshot.gratitudeReason ?? snapshot.whyItMattered;
  const relationshipSignal = readString(raw, "relationshipSignal") ?? snapshot.relationshipSignal ?? snapshot.selfPattern;
  const partial = Boolean(gratitudeMoment && kindAction && (seenNeed || gratitudeReason));
  const complete = Boolean(partial && seenNeed && gratitudeReason && relationshipSignal);
  const readiness: EvidenceReadiness = complete ? "complete" : partial ? "partial" : "insufficient";
  const missingSlots = [
    !gratitudeMoment ? "gratitudeMoment" : null,
    !kindAction ? "kindAction" : null,
    !seenNeed ? "seenNeed" : null,
    !gratitudeReason ? "gratitudeReason" : null,
    !relationshipSignal ? "relationshipSignal" : null
  ].filter((slot): slot is string => Boolean(slot));
  const score = complete ? 82 : partial ? 60 : gratitudeMoment && kindAction ? 42 : gratitudeMoment ? 28 : 0;
  return finalize({
    kind: "gratitude",
    moment: gratitudeMoment ?? null,
    gratitudeMoment: gratitudeMoment ?? null,
    gratitudeTarget: readString(raw, "gratitudeTarget") ?? snapshot.gratitudeTarget ?? null,
    kindAction,
    seenNeed,
    innerEffect: readString(raw, "innerEffect") ?? snapshot.innerEffect ?? snapshot.feeling,
    feeling: readString(raw, "feeling") ?? snapshot.feeling,
    gratitudeType: readString(raw, "gratitudeType") ?? snapshot.gratitudeType ?? snapshot.happinessType,
    gratitudeReason: gratitudeReason ?? null,
    relationshipSignal: relationshipSignal ?? null,
    reciprocityHint: readString(raw, "reciprocityHint") ?? snapshot.reciprocityHint ?? null,
    evidenceState: (raw?.evidenceState as JoySnapshot["evidenceState"]) ?? snapshot.evidenceState ?? null,
    confidence: normalizedConfidence(score, 82),
    missingSlots
  }, missingSlots, readiness);
}

export function canGenerateFromEvidence(assessment: DimensionEvidenceAssessment) {
  return assessment.readiness === "partial" || assessment.readiness === "complete";
}

export function getDimensionEvidenceSlotWhitelist(dimension: InterviewDimension) {
  return DIMENSION_SLOT_WHITELISTS[dimension];
}
