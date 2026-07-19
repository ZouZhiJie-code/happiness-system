import type { AskIntentEnvelope } from "@/features/joy-interview/server/ask-intent";

function formatAnchorLead(anchorText: string | null) {
  return anchorText ? `你提到“${anchorText}”。` : "";
}

function formatQuotedAnchor(anchorText: string | null) {
  return anchorText ? `“${anchorText}”里，` : "";
}

function formatRecallSpecificMoment(anchorText: string | null) {
  return `${formatAnchorLead(anchorText)}当时最具体的画面是什么？`;
}

function formatPointOutKeyPart(input: {
  dimension: AskIntentEnvelope["dimension"];
  sourceTarget: AskIntentEnvelope["sourceTarget"];
  anchorText: string | null;
}) {
  const lead = formatAnchorLead(input.anchorText);
  const quotedAnchor = formatQuotedAnchor(input.anchorText);

  if (input.sourceTarget === "insight_evidence") {
    switch (input.dimension) {
      case "joy":
        return `${lead}哪个具体细节最先让你的状态有了变化？`;
      case "fulfillment":
        return `${lead}这一步实际留下了什么结果或积累？如果没有，也可以直接说没有推进。`;
      case "reflection":
        return `${lead}哪个具体细节让你产生了新的理解？`;
      case "improvement":
        return `${lead}当时具体卡在了哪里？`;
      case "gratitude":
        return `${lead}对方具体做了什么，让你感到被照顾？`;
    }
  }

  switch (input.dimension) {
    case "joy":
      return `${lead}哪个细节让这份开心对你格外有分量？`;
    case "fulfillment":
      return `${quotedAnchor}什么样的具体结果会让这份投入对你算数？`;
    case "reflection":
      return `${lead}这次经历让你修正了原来的哪个判断？`;
    case "improvement":
      return `${lead}下次最值得先调整的一个环节是什么？`;
    case "gratitude":
      return `${lead}这份回应具体照顾到了你的什么需要？`;
  }
}

function formatNameDirectFeeling(input: {
  dimension: AskIntentEnvelope["dimension"];
  anchorText: string | null;
}) {
  const lead = formatAnchorLead(input.anchorText);

  switch (input.dimension) {
    case "reflection":
      return `${lead}当时最直接冒出来的感觉或念头是什么？`;
    case "fulfillment":
    case "improvement":
      return `${lead}当时最直接冒出来的感觉是什么？`;
    case "gratitude":
      return `${lead}当时你最直接的感觉是什么？`;
    case "joy":
    default:
      return `${lead}当时最直接的感觉是什么？`;
  }
}

function formatLeaveOneSentence(input: {
  dimension: AskIntentEnvelope["dimension"];
  anchorText: string | null;
}) {
  const lead = formatAnchorLead(input.anchorText);

  switch (input.dimension) {
    case "joy":
      return `${lead}这份开心里，你最想记住的具体细节是什么？`;
    case "fulfillment":
      return `${lead}哪项具体结果最能代表今天的投入？`;
    case "reflection":
      return `${lead}这次最值得保留的新理解是什么？`;
    case "improvement":
      return `${lead}下次最想先调整的一个动作是什么？`;
    case "gratitude":
      return `${lead}这份回应里，你最想记住的具体动作是什么？`;
  }
}

function formatNameNextTimeCue(input: {
  dimension: AskIntentEnvelope["dimension"];
  anchorText: string | null;
}) {
  const lead = formatAnchorLead(input.anchorText);

  switch (input.dimension) {
    case "joy":
      return `${lead}下次想让这份开心更容易出现，你会先留意什么线索？`;
    case "fulfillment":
      return `${lead}以后判断一天是否充实时，你会先看哪项具体结果？`;
    case "reflection":
      return `${lead}下次遇到类似情形，你会用什么新依据重新判断？`;
    case "improvement":
      return `${lead}下次遇到类似情况，你最想先试哪个具体动作？`;
    case "gratitude":
      return `${lead}以后遇到类似时刻，你会先留意哪种关系回应？`;
  }
}

export function realizeQuestion(input: {
  envelope: AskIntentEnvelope;
}) {
  const { envelope } = input;

  switch (envelope.intent) {
    case "leave_one_sentence":
      return formatLeaveOneSentence({
        dimension: envelope.dimension,
        anchorText: envelope.anchorText
      });
    case "name_next_time_cue":
      return formatNameNextTimeCue({
        dimension: envelope.dimension,
        anchorText: envelope.anchorText
      });
    case "recall_specific_moment":
      return formatRecallSpecificMoment(envelope.anchorText);
    case "point_out_key_part":
      return formatPointOutKeyPart({
        dimension: envelope.dimension,
        sourceTarget: envelope.sourceTarget,
        anchorText: envelope.anchorText
      });
    case "name_direct_feeling":
    default:
      return formatNameDirectFeeling({
        dimension: envelope.dimension,
        anchorText: envelope.anchorText
      });
  }
}
