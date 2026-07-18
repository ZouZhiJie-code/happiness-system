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
  formatTheorySummarySentence,
  sanitizeNullableString,
  trimTrailingPunctuation
} from "@/features/interview/server/draft-policies/shared";

function buildFulfillmentOpeningSentence(snapshot: JoySnapshot) {
  const experience = sanitizeNullableString(snapshot.event);

  return experience
    ? `今天最让我觉得不算白过的，是${trimTrailingPunctuation(experience)}。`
    : "今天最让我觉得不算白过的，是有一件事真的往前走了一点。";
}

function buildFulfillmentProgressSentence(snapshot: JoySnapshot) {
  const progressEvidence = sanitizeNullableString(snapshot.whyItMattered);

  return progressEvidence
    ? `这件事真正有分量的地方，是${trimTrailingPunctuation(progressEvidence)}。`
    : null;
}

function buildFulfillmentStateSentence(snapshot: JoySnapshot) {
  const feeling = sanitizeNullableString(snapshot.feeling);
  const fulfillmentType = sanitizeNullableString(snapshot.happinessType);

  if (feeling && fulfillmentType) {
    return `做完之后，我心里多了一点${trimTrailingPunctuation(feeling)}，这种充实更接近${trimTrailingPunctuation(fulfillmentType)}。`;
  }

  if (feeling) {
    return `做完之后，我心里多了一点${trimTrailingPunctuation(feeling)}。`;
  }

  if (fulfillmentType) {
    return `它给我的充实感，更接近${trimTrailingPunctuation(fulfillmentType)}。`;
  }

  return null;
}

function buildFulfillmentClosingSentence(input: {
  brief: DraftBrief;
  snapshot: JoySnapshot;
}) {
  const valueSignal = sanitizeNullableString(input.snapshot.selfPattern);
  const progressEvidence = sanitizeNullableString(input.snapshot.whyItMattered);

  if (input.brief.completionMode === "complete" && valueSignal) {
    const normalizedValueSignal = trimTrailingPunctuation(valueSignal);

    if (/(算数|没白过|不算白忙|不算空转|有分量)/u.test(normalizedValueSignal)) {
      return `回头看，我也更知道，${normalizedValueSignal}。`;
    }

    return `回头看，我也更知道，对我来说，${normalizedValueSignal}才会真正算数。`;
  }

  if (progressEvidence) {
    return `至少这件事让我确认，今天不是空转的一天。`;
  }

  return "至少今天不是完全空转的一天，我能看到自己确实往前走了一点。";
}

function buildFulfillmentFallbackContent(input: {
  brief: DraftBrief;
  snapshot: JoySnapshot;
}) {
  return buildDraftContent(
    buildParagraph(
      buildFulfillmentOpeningSentence(input.snapshot),
      formatTheorySummarySentence(input.brief) ?? buildFulfillmentProgressSentence(input.snapshot)
    ),
    buildParagraph(buildFulfillmentStateSentence(input.snapshot), buildFulfillmentClosingSentence(input))
  );
}

export function createFulfillmentFallbackDraft(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  eventBlocks: JoyEventBlock[];
  brief: DraftBrief;
}): JoyEntryDraft {
  const primaryEvent = pickPrimaryEvent("fulfillment", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const config = getInterviewDimensionConfig("fulfillment");
  const title = buildSemanticJournalTitle({
    dimension: "fulfillment",
    snapshot: primarySnapshot,
    draftBrief: input.brief,
    fallbackTitle: config.draftTitlePrefix
  });

  return {
    title,
    content: buildFulfillmentFallbackContent({
      brief: input.brief,
      snapshot: primarySnapshot
    }),
    event: sanitizeNullableString(primarySnapshot.event),
    feeling: sanitizeNullableString(primarySnapshot.feeling),
    whyItMattered: sanitizeNullableString(primarySnapshot.whyItMattered),
    happinessType: sanitizeNullableString(primarySnapshot.happinessType),
    selfPattern:
      input.brief.completionMode === "complete"
        ? sanitizeNullableString(primarySnapshot.selfPattern)
        : null,
    tags: input.brief.tags,
    eventBlocks: input.eventBlocks,
    source: "ai_draft_direct"
  };
}
