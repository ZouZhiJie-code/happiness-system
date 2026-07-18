import { getInterviewDimensionConfig } from "@/features/interview/server/dimension-config";
import { buildSemanticJournalTitle } from "@/features/interview/journal-title";
import {
  createDraft,
  getDirectionSignal,
  getDurability,
  getJoyMoment,
  getJoyPsychProfile,
  getJoySource,
  getLegacyJoyProjection,
  getManualClue,
  getMeaningNeed,
  getStateShift,
  getValueImpact
} from "@/features/joy-interview/server/joy-interview-engine";
import type {
  DraftBrief,
  DraftCompletionMode,
  InterviewEventRecord,
  InterviewSessionRecord,
  JoyEntryDraft,
  JoyEventBlock
} from "@/types/interview";
import {
  buildDraftBrief,
  pickPrimaryEvent
} from "@/features/interview/server/draft-policies/brief";
import {
  getUsableDelightSignature,
  sanitizeNullableString
} from "@/features/interview/server/draft-policies/shared";
import { buildJoyFallbackContent } from "@/features/interview/server/draft-policies/fallback/joy";
import { createFulfillmentFallbackDraft } from "@/features/interview/server/draft-policies/fallback/fulfillment";
import { createReflectionFallbackDraft } from "@/features/interview/server/draft-policies/fallback/reflection";
import { createImprovementFallbackDraft } from "@/features/interview/server/draft-policies/fallback/improvement";
import { createGratitudeFallbackDraft } from "@/features/interview/server/draft-policies/fallback/gratitude";

export function createFallbackDraft(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  eventBlocks: JoyEventBlock[];
  brief?: DraftBrief;
  completionMode?: DraftCompletionMode;
}): JoyEntryDraft {
  const brief = input.brief ?? buildDraftBrief({
    session: input.session,
    sourceEvents: input.sourceEvents,
    completionMode: input.completionMode
  });

  if (input.session.dimension === "fulfillment") {
    return createFulfillmentFallbackDraft({
      session: input.session,
      sourceEvents: input.sourceEvents,
      eventBlocks: input.eventBlocks,
      brief
    });
  }

  if (input.session.dimension === "reflection") {
    return createReflectionFallbackDraft({
      session: input.session,
      sourceEvents: input.sourceEvents,
      eventBlocks: input.eventBlocks,
      brief
    });
  }

  if (input.session.dimension === "improvement") {
    return createImprovementFallbackDraft({
      session: input.session,
      sourceEvents: input.sourceEvents,
      eventBlocks: input.eventBlocks,
      brief
    });
  }

  if (input.session.dimension === "gratitude") {
    return createGratitudeFallbackDraft({
      session: input.session,
      sourceEvents: input.sourceEvents,
      eventBlocks: input.eventBlocks,
      brief
    });
  }

  if (input.session.dimension !== "joy") {
    return {
      ...createDraft(input.session.dimension, input.sourceEvents[0]?.snapshot ?? input.session.snapshot),
      eventBlocks: input.eventBlocks
    };
  }

  const primaryEvent = pickPrimaryEvent("joy", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const config = getInterviewDimensionConfig("joy");
  const legacyProjection = getLegacyJoyProjection(primarySnapshot);
  const title = buildSemanticJournalTitle({
    dimension: "joy",
    snapshot: primarySnapshot,
    draftBrief: brief,
    fallbackTitle: config.draftTitlePrefix
  });

  return {
    title,
    content: buildJoyFallbackContent({
      brief,
      snapshot: primarySnapshot
    }),
    event: legacyProjection.event,
    feeling: legacyProjection.feeling,
    whyItMattered: legacyProjection.whyItMattered,
    happinessType: legacyProjection.happinessType,
    selfPattern: legacyProjection.selfPattern,
    joyMoment: sanitizeNullableString(getJoyMoment(primarySnapshot)),
    joySource: sanitizeNullableString(getJoySource(primarySnapshot)),
    stateShift: sanitizeNullableString(getStateShift(primarySnapshot)),
    meaningNeed: sanitizeNullableString(getMeaningNeed(primarySnapshot)),
    manualClue:
      brief.completionMode === "complete" && brief.closureTarget === "manual_clue"
        ? sanitizeNullableString(getManualClue(primarySnapshot))
        : null,
    delightSignature:
      brief.completionMode === "complete" && brief.closureTarget === "delight_signature"
        ? getUsableDelightSignature(primarySnapshot)
        : null,
    directionSignal: sanitizeNullableString(getDirectionSignal(primarySnapshot)),
    valueImpact: sanitizeNullableString(getValueImpact(primarySnapshot)),
    durability: sanitizeNullableString(getDurability(primarySnapshot)),
    psychProfile: getJoyPsychProfile(primarySnapshot),
    tags: brief.tags,
    eventBlocks: input.eventBlocks,
    source: "ai_draft_direct"
  };
}
