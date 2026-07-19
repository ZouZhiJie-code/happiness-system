import { getInterviewDimensionConfig } from "@/features/interview/server/dimension-config";
import { buildSemanticJournalTitle } from "@/features/interview/journal-title";
import type {
  DraftBrief,
  InterviewEventRecord,
  InterviewSessionRecord,
  JoyEntryDraft,
  JoyEventBlock,
  JoySnapshot
} from "@/types/interview";
import { pickPrimaryEvent } from "@/features/interview/server/draft-policies/brief";
import {
  buildDraftContent,
  buildParagraph,
  normalizeGratitudeNeedText,
  sanitizeNullableString,
  takeFirstSentence,
  trimTrailingPunctuation
} from "@/features/interview/server/draft-policies/shared";

function buildGratitudeOpeningSentence(snapshot: JoySnapshot) {
  const moment = sanitizeNullableString(snapshot.gratitudeMoment ?? snapshot.event);

  return moment
    ? `今天让我想认真记下来的感谢，是${takeFirstSentence(moment)}。`
    : "今天有一个很小的片段，让我想认真说一声谢谢。";
}

function buildGratitudeActionSentence(snapshot: JoySnapshot) {
  const moment = sanitizeNullableString(snapshot.gratitudeMoment ?? snapshot.event);
  const target = sanitizeNullableString(snapshot.gratitudeTarget);
  const kindAction = sanitizeNullableString(snapshot.kindAction);
  const normalizedTarget = target?.replace(/^(的是|是|那个|这位)/u, "").trim() ?? null;

  if (moment && kindAction && takeFirstSentence(moment).includes(trimTrailingPunctuation(kindAction))) {
    return null;
  }

  if (normalizedTarget && kindAction) {
    const normalizedAction = trimTrailingPunctuation(kindAction);
    return normalizedAction.startsWith(normalizedTarget)
      ? `我记得${normalizedAction}。`
      : `我记得${trimTrailingPunctuation(normalizedTarget)}当时${normalizedAction}。`;
  }

  if (kindAction) {
    return `我记得对方当时${trimTrailingPunctuation(kindAction)}。`;
  }

  return null;
}

function buildGratitudeNeedSentence(snapshot: JoySnapshot) {
  const seenNeed = sanitizeNullableString(snapshot.seenNeed);
  const innerEffect = sanitizeNullableString(snapshot.innerEffect ?? snapshot.feeling);
  const gratitudeReason = sanitizeNullableString(snapshot.gratitudeReason ?? snapshot.whyItMattered);
  const normalizedNeed = normalizeGratitudeNeedText(seenNeed);
  const normalizedReason = normalizeGratitudeNeedText(gratitudeReason);

  if (normalizedNeed && innerEffect) {
    const needClause = normalizedNeed.startsWith("我")
      ? trimTrailingPunctuation(normalizedNeed)
      : `我${trimTrailingPunctuation(normalizedNeed)}`;
    const normalizedEffect = trimTrailingPunctuation(innerEffect);
    const effectSentence = /(?:接住|理解|看见|照顾|支持|回应|帮助)了(?:我|我的)/u.test(normalizedEffect)
      ? `这份回应${normalizedEffect}。`
      : `这让我感到${normalizedEffect}。`;
    return `对方也看见了${needClause}。${effectSentence}`;
  }

  if (normalizedNeed) {
    const needClause = normalizedNeed.startsWith("我")
      ? trimTrailingPunctuation(normalizedNeed)
      : `我${trimTrailingPunctuation(normalizedNeed)}`;
    return `对方也看见了${needClause}。`;
  }

  if (normalizedReason) {
    return /^(?:我|他|她|这)/u.test(normalizedReason)
      ? `${trimTrailingPunctuation(normalizedReason)}。`
      : `这份感谢对我很重要，因为${trimTrailingPunctuation(normalizedReason)}。`;
  }

  return null;
}

function buildGratitudeSupportingParagraph(snapshot: JoySnapshot, index: number) {
  const moment = sanitizeNullableString(snapshot.gratitudeMoment ?? snapshot.event);
  const target = sanitizeNullableString(snapshot.gratitudeTarget);
  const kindAction = sanitizeNullableString(snapshot.kindAction);
  const seenNeed = sanitizeNullableString(snapshot.seenNeed);
  const innerEffect = sanitizeNullableString(snapshot.innerEffect ?? snapshot.feeling);
  const gratitudeReason = sanitizeNullableString(snapshot.gratitudeReason ?? snapshot.whyItMattered);
  const normalizedNeed = normalizeGratitudeNeedText(seenNeed);
  const normalizedReason = normalizeGratitudeNeedText(gratitudeReason);
  const sentences = [
    moment
      ? index === 0
        ? `另外我也想记下，${trimTrailingPunctuation(moment)}。`
        : `还有一个片段也留在我心里：${trimTrailingPunctuation(moment)}。`
      : null,
    target && kindAction
      ? `那时${trimTrailingPunctuation(target)}${trimTrailingPunctuation(kindAction)}。`
      : kindAction
        ? `那时对方${trimTrailingPunctuation(kindAction)}。`
        : null,
    normalizedNeed && innerEffect
      ? `这份好意也像是看见了${trimTrailingPunctuation(normalizedNeed)}，让我心里多了一点${trimTrailingPunctuation(innerEffect)}。`
      : normalizedNeed
        ? `这份好意也像是看见了${trimTrailingPunctuation(normalizedNeed)}。`
        : normalizedReason
          ? `它会留在我心里，也是因为${trimTrailingPunctuation(normalizedReason)}。`
          : null
  ].filter(Boolean);

  return sentences.length ? sentences.join(" ") : null;
}

function buildGratitudeClosingSentence(input: {
  brief: DraftBrief;
  snapshot: JoySnapshot;
}) {
  const relationshipSignal = sanitizeNullableString(input.snapshot.relationshipSignal ?? input.snapshot.selfPattern);
  const gratitudeReason = sanitizeNullableString(input.snapshot.gratitudeReason ?? input.snapshot.whyItMattered);

  if (input.brief.completionMode === "complete" && relationshipSignal) {
    const normalizedSignal = trimTrailingPunctuation(relationshipSignal);

    if (/^我/u.test(normalizedSignal)) {
      return `回头看，${normalizedSignal}。`;
    }

    if (/^(?:更|更加)?珍惜/u.test(normalizedSignal)) {
      return `回头看，我也${normalizedSignal}。`;
    }

    return `回头看，我也更清楚，${normalizedSignal}。`;
  }

  if (gratitudeReason) {
    return "这份感谢提醒我，自己当时确实被认真回应过。";
  }

  return "这件小事让我记得，关系里有些善意值得被看见。";
}

function buildGratitudeFallbackContent(input: {
  brief: DraftBrief;
  snapshot: JoySnapshot;
  supportingSnapshots?: JoySnapshot[];
}) {
  return buildDraftContent(
    buildParagraph(
      buildGratitudeOpeningSentence(input.snapshot),
      buildGratitudeActionSentence(input.snapshot),
      buildGratitudeNeedSentence(input.snapshot)
    ),
    ...(input.supportingSnapshots ?? []).map((snapshot, index) => buildParagraph(buildGratitudeSupportingParagraph(snapshot, index))),
    buildParagraph(buildGratitudeClosingSentence(input))
  );
}

export function createGratitudeFallbackDraft(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  eventBlocks: JoyEventBlock[];
  brief: DraftBrief;
}): JoyEntryDraft {
  const primaryEvent = pickPrimaryEvent("gratitude", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const supportingSnapshots = input.sourceEvents
    .filter((event) => event.id !== primaryEvent?.id)
    .map((event) => event.snapshot)
    .filter(
      (snapshot) =>
        Boolean(
          sanitizeNullableString(snapshot.gratitudeMoment ?? snapshot.event) ||
            sanitizeNullableString(snapshot.kindAction) ||
            sanitizeNullableString(snapshot.seenNeed) ||
            sanitizeNullableString(snapshot.gratitudeReason ?? snapshot.whyItMattered)
        )
    )
    .slice(0, 2);
  const config = getInterviewDimensionConfig("gratitude");
  const relationshipSignal =
    input.brief.completionMode === "complete"
      ? sanitizeNullableString(primarySnapshot.relationshipSignal ?? primarySnapshot.selfPattern)
      : null;
  const title = buildSemanticJournalTitle({
    dimension: "gratitude",
    snapshot: primarySnapshot,
    draftBrief: input.brief,
    fallbackTitle: config.draftTitlePrefix
  });

  return {
    title,
    content: buildGratitudeFallbackContent({
      brief: input.brief,
      snapshot: primarySnapshot,
      supportingSnapshots
    }),
    event: sanitizeNullableString(primarySnapshot.gratitudeMoment ?? primarySnapshot.event),
    feeling: sanitizeNullableString(primarySnapshot.innerEffect ?? primarySnapshot.feeling),
    whyItMattered: sanitizeNullableString(primarySnapshot.gratitudeReason ?? primarySnapshot.whyItMattered),
    happinessType: sanitizeNullableString(primarySnapshot.gratitudeType ?? primarySnapshot.happinessType),
    selfPattern: relationshipSignal,
    gratitudeMoment: sanitizeNullableString(primarySnapshot.gratitudeMoment ?? primarySnapshot.event),
    gratitudeTarget: sanitizeNullableString(primarySnapshot.gratitudeTarget),
    kindAction: sanitizeNullableString(primarySnapshot.kindAction),
    seenNeed: sanitizeNullableString(primarySnapshot.seenNeed),
    innerEffect: sanitizeNullableString(primarySnapshot.innerEffect ?? primarySnapshot.feeling),
    gratitudeReason: sanitizeNullableString(primarySnapshot.gratitudeReason ?? primarySnapshot.whyItMattered),
    gratitudeType: sanitizeNullableString(primarySnapshot.gratitudeType ?? primarySnapshot.happinessType),
    relationshipSignal,
    reciprocityHint: sanitizeNullableString(primarySnapshot.reciprocityHint),
    tags: input.brief.tags,
    eventBlocks: input.eventBlocks,
    source: "ai_draft_direct"
  };
}
