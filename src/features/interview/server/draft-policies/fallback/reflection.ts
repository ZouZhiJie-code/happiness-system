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

function buildReflectionOpeningSentence(snapshot: JoySnapshot) {
  const trigger = sanitizeNullableString(snapshot.event);

  return trigger
    ? `今天让我停下来想了一下的，是${trimTrailingPunctuation(trigger)}。`
    : "今天有一个片段让我停下来多想了一层。";
}

function buildReflectionInsightSentence(snapshot: JoySnapshot) {
  const insight = sanitizeNullableString(snapshot.whyItMattered);

  return insight ? `它让我看见，${trimTrailingPunctuation(insight)}。` : null;
}

function buildReflectionStateSentence(snapshot: JoySnapshot) {
  const feeling = sanitizeNullableString(snapshot.feeling);
  const reflectionType = sanitizeNullableString(snapshot.happinessType);

  if (feeling && reflectionType) {
    return `当时的感觉有点${trimTrailingPunctuation(feeling)}，这次思考更接近${trimTrailingPunctuation(reflectionType)}。`;
  }

  if (feeling) {
    return `当时的感觉有点${trimTrailingPunctuation(feeling)}。`;
  }

  if (reflectionType) {
    return `这次思考更接近${trimTrailingPunctuation(reflectionType)}。`;
  }

  return null;
}

function buildReflectionClosingSentence(input: {
  brief: DraftBrief;
  snapshot: JoySnapshot;
}) {
  const viewpointShift = sanitizeNullableString(input.snapshot.selfPattern);
  const insight = sanitizeNullableString(input.snapshot.whyItMattered);

  if (input.brief.completionMode === "complete" && viewpointShift) {
    return `以后再判断类似事情时，我会多带着这条线索：${trimTrailingPunctuation(viewpointShift)}。`;
  }

  if (insight) {
    return "现在它还不是一个稳定结论，但已经让我多了一层判断依据。";
  }

  return "这件事还没完全想透，但它至少把一个值得继续看的问题留了下来。";
}

function buildReflectionFallbackContent(input: {
  brief: DraftBrief;
  snapshot: JoySnapshot;
}) {
  return buildDraftContent(
    buildParagraph(
      buildReflectionOpeningSentence(input.snapshot),
      formatTheorySummarySentence(input.brief) ?? buildReflectionInsightSentence(input.snapshot)
    ),
    buildParagraph(buildReflectionStateSentence(input.snapshot), buildReflectionClosingSentence(input))
  );
}

export function createReflectionFallbackDraft(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  eventBlocks: JoyEventBlock[];
  brief: DraftBrief;
}): JoyEntryDraft {
  const primaryEvent = pickPrimaryEvent("reflection", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const config = getInterviewDimensionConfig("reflection");
  const title = buildSemanticJournalTitle({
    dimension: "reflection",
    snapshot: primarySnapshot,
    draftBrief: input.brief,
    fallbackTitle: config.draftTitlePrefix
  });

  return {
    title,
    content: buildReflectionFallbackContent({
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
