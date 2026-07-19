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
import {
  getImprovementCore,
  pickPrimaryEvent
} from "@/features/interview/server/draft-policies/brief";
import {
  buildDraftContent,
  buildParagraph,
  sanitizeNullableString,
  takeFirstSentence,
  trimTrailingPunctuation
} from "@/features/interview/server/draft-policies/shared";

function buildImprovementOpeningSentence(snapshot: JoySnapshot) {
  const situation = sanitizeNullableString(snapshot.event);

  return situation
    ? `今天最想回头看一眼的，是${takeFirstSentence(situation)}。`
    : "今天有一个片段，让我觉得下次可以稍微调整得更稳一点。";
}

function buildImprovementStateSentence(snapshot: JoySnapshot) {
  const stateAssessment = sanitizeNullableString(snapshot.stateAssessment);
  const feeling = sanitizeNullableString(snapshot.feeling);

  if (stateAssessment) {
    const frictionPoint = sanitizeNullableString(snapshot.frictionPoint ?? snapshot.whyItMattered);
    const normalizedState = trimTrailingPunctuation(stateAssessment);
    const stateWithoutRepeatedFriction = frictionPoint && normalizedState.includes(frictionPoint)
      ? normalizedState
          .split(/[，,]/u)
          .filter((clause) => !clause.includes(frictionPoint))
          .join("，")
          .replace(/[，,\s]+$/u, "")
          .trim()
      : normalizedState;

    if (!stateWithoutRepeatedFriction) {
      return null;
    }

    if (/^(?:我|当时我|这次|今天|那时|汇报时)/u.test(stateWithoutRepeatedFriction)) {
      return `回头看，${stateWithoutRepeatedFriction}。`;
    }

    return `回头看，我当时${stateWithoutRepeatedFriction}。`;
  }

  if (feeling) {
    return `当时，我感到${trimTrailingPunctuation(feeling)}。`;
  }

  return null;
}

function buildImprovementCoreSentence(snapshot: JoySnapshot) {
  const frictionPoint = sanitizeNullableString(snapshot.frictionPoint ?? snapshot.whyItMattered);
  const repeatCondition = sanitizeNullableString(snapshot.repeatCondition);

  if (snapshot.improvementTrack === "repeat_good" && repeatCondition) {
    return `这次之所以比较顺，关键条件可能是${trimTrailingPunctuation(repeatCondition)}。`;
  }

  if (snapshot.improvementTrack === "avoid_bad" && frictionPoint) {
    return `真正卡住我的地方，是${trimTrailingPunctuation(frictionPoint)}。`;
  }

  if (repeatCondition) {
    return `这次值得重复的条件，是${trimTrailingPunctuation(repeatCondition)}。`;
  }

  if (frictionPoint) {
    return `这次真正需要看见的卡点，是${trimTrailingPunctuation(frictionPoint)}。`;
  }

  return null;
}

function buildImprovementControlSentence(snapshot: JoySnapshot) {
  const controllableFactor = sanitizeNullableString(snapshot.controllableFactor);

  return controllableFactor
    ? `我能先抓住的一小步，是${trimTrailingPunctuation(controllableFactor)}。`
    : null;
}

function buildImprovementClosingSentence(input: {
  brief: DraftBrief;
  snapshot: JoySnapshot;
}) {
  const nextAttempt = sanitizeNullableString(input.snapshot.nextAttempt ?? input.snapshot.selfPattern);
  const successSignal = sanitizeNullableString(input.snapshot.successSignal);
  const controllableFactor = sanitizeNullableString(input.snapshot.controllableFactor);
  const core = getImprovementCore(input.snapshot);
  const cleanedNextAttempt = nextAttempt?.replace(/^(?:下次|以后|下一次)(?:我)?(?:想)?(?:会|要)?/u, "").trim() ?? null;

  if (input.brief.completionMode === "complete" && nextAttempt) {
    return successSignal
      ? `下次我会${trimTrailingPunctuation(cleanedNextAttempt ?? nextAttempt)}。如果${trimTrailingPunctuation(successSignal)}，我就知道这次调整起作用了。`
      : `下次我会${trimTrailingPunctuation(cleanedNextAttempt ?? nextAttempt)}，先把这一小步做出来。`;
  }

  if (controllableFactor) {
    return `这次先记住，${trimTrailingPunctuation(controllableFactor)}是我可以调整的地方。`;
  }

  if (core) {
    return `这次先记住，${trimTrailingPunctuation(core)}是下一次可以继续留意的地方。`;
  }

  return "这次先记住，下次可以从一个很小的地方开始调整。";
}

function buildImprovementFallbackContent(input: {
  brief: DraftBrief;
  snapshot: JoySnapshot;
}) {
  return buildDraftContent(
    buildParagraph(buildImprovementOpeningSentence(input.snapshot), buildImprovementStateSentence(input.snapshot)),
    buildParagraph(
      buildImprovementCoreSentence(input.snapshot),
      buildImprovementControlSentence(input.snapshot)
    ),
    buildParagraph(buildImprovementClosingSentence(input))
  );
}

export function createImprovementFallbackDraft(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  eventBlocks: JoyEventBlock[];
  brief: DraftBrief;
}): JoyEntryDraft {
  const primaryEvent = pickPrimaryEvent("improvement", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const config = getInterviewDimensionConfig("improvement");
  const nextAttempt =
    input.brief.completionMode === "complete"
      ? sanitizeNullableString(primarySnapshot.nextAttempt ?? primarySnapshot.selfPattern)
      : null;
  const title = buildSemanticJournalTitle({
    dimension: "improvement",
    snapshot: primarySnapshot,
    draftBrief: input.brief,
    fallbackTitle: config.draftTitlePrefix
  });

  return {
    title,
    content: buildImprovementFallbackContent({
      brief: input.brief,
      snapshot: primarySnapshot
    }),
    event: sanitizeNullableString(primarySnapshot.event),
    feeling: sanitizeNullableString(primarySnapshot.feeling),
    whyItMattered: sanitizeNullableString(primarySnapshot.frictionPoint ?? primarySnapshot.repeatCondition ?? primarySnapshot.whyItMattered),
    happinessType: sanitizeNullableString(primarySnapshot.happinessType),
    selfPattern: nextAttempt,
    improvementTrack: primarySnapshot.improvementTrack ?? null,
    stateAssessment: sanitizeNullableString(primarySnapshot.stateAssessment),
    frictionPoint: sanitizeNullableString(primarySnapshot.frictionPoint ?? primarySnapshot.whyItMattered),
    repeatCondition: sanitizeNullableString(primarySnapshot.repeatCondition),
    controllableFactor: sanitizeNullableString(primarySnapshot.controllableFactor),
    nextAttempt,
    successSignal: sanitizeNullableString(primarySnapshot.successSignal),
    tags: input.brief.tags,
    eventBlocks: input.eventBlocks,
    source: "ai_draft_direct"
  };
}
