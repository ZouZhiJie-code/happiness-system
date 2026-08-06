import type {
  AssistantQuestionSpec,
  AssistantQuestionTarget,
  GratitudeQuestionSubTarget,
  InterviewDimension,
  JoySnapshot
} from "@/types/interview";

export type AskIntent =
  | "recall_specific_moment"
  | "name_direct_feeling"
  | "point_out_key_part"
  | "leave_one_sentence"
  | "name_next_time_cue";

export interface AskIntentEnvelope {
  intent: AskIntent;
  sourceTarget: AssistantQuestionTarget;
  gratitudeSubTarget: GratitudeQuestionSubTarget | null;
  dimension: InterviewDimension;
  anchorText: string | null;
  cognitiveLoad: "low" | "medium";
  shouldAnchorToUserWords: boolean;
  constraints: {
    maxCognitiveActions: 1;
    avoidAbstractLead: boolean;
    mustStayOnCurrentEvent: boolean;
    preferredAnswerShape:
      | "specific_moment"
      | "direct_feeling"
      | "single_key_point"
      | "one_sentence_distillation"
      | "next_time_cue";
  };
  plannerNotes: string[];
}

function trimText(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  return normalized || null;
}

function resolveIntent(target: AssistantQuestionTarget, dimension: InterviewDimension): AskIntent {
  if (target === "reaction_evidence") {
    return "name_direct_feeling";
  }

  if (target === "insight_evidence") {
    return "point_out_key_part";
  }

  if (target === "judgment_clue") {
    if (dimension === "joy" || dimension === "reflection" || dimension === "improvement") {
      return "name_next_time_cue";
    }

    return "point_out_key_part";
  }

  return "recall_specific_moment";
}

function getPreferredAnswerShape(intent: AskIntent): AskIntentEnvelope["constraints"]["preferredAnswerShape"] {
  switch (intent) {
    case "recall_specific_moment":
      return "specific_moment";
    case "name_direct_feeling":
      return "direct_feeling";
    case "leave_one_sentence":
      return "one_sentence_distillation";
    case "name_next_time_cue":
      return "next_time_cue";
    case "point_out_key_part":
    default:
      return "single_key_point";
  }
}

function getPlannerNotes(target: AssistantQuestionTarget, dimension: InterviewDimension, intent: AskIntent) {
  const notes = ["single_cognitive_action", "stay_on_current_event"];

  if (target === "insight_evidence" || target === "judgment_clue") {
    notes.push("stay_on_user_named_object");
  }

  if (dimension === "reflection") {
    notes.push("avoid_invented_mental_object");
  }

  if (intent === "leave_one_sentence") {
    notes.push("distill_from_existing_user_words");
  }

  return notes;
}

function resolveAnchorText(input: {
  dimension: InterviewDimension;
  snapshot: JoySnapshot;
  spec: AssistantQuestionSpec;
}) {
  if (input.dimension === "gratitude" && input.spec.subTarget !== "kind_action" && input.snapshot.kindAction) {
    return trimText(input.snapshot.kindAction);
  }

  return trimText(input.spec.anchorText ?? input.snapshot.event);
}

export function planAskIntentEnvelope(input: {
  dimension: InterviewDimension;
  snapshot: JoySnapshot;
  spec: AssistantQuestionSpec;
}): AskIntentEnvelope {
  const intent = resolveIntent(input.spec.target, input.dimension);

  return {
    intent,
    sourceTarget: input.spec.target,
    gratitudeSubTarget: input.dimension === "gratitude" ? input.spec.subTarget ?? null : null,
    dimension: input.dimension,
    anchorText: resolveAnchorText(input),
    cognitiveLoad: intent === "name_direct_feeling" ? "low" : "medium",
    shouldAnchorToUserWords: true,
    constraints: {
      maxCognitiveActions: 1,
      avoidAbstractLead: true,
      mustStayOnCurrentEvent: true,
      preferredAnswerShape: getPreferredAnswerShape(intent)
    },
    plannerNotes: getPlannerNotes(input.spec.target, input.dimension, intent)
  };
}
