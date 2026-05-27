import type { AskIntentEnvelope } from "@/features/joy-interview/server/ask-intent";

function formatAnchor(anchorText: string | null) {
  return anchorText ? `回到“${anchorText}”这件事，` : "";
}

function formatRecallSpecificMoment(anchorText: string | null) {
  return `${formatAnchor(anchorText)}当时最具体的一下是什么？`;
}

function formatPointOutKeyPart(input: {
  dimension: AskIntentEnvelope["dimension"];
  sourceTarget: AskIntentEnvelope["sourceTarget"];
  anchorText: string | null;
}) {
  const prefix = formatAnchor(input.anchorText);

  if (input.sourceTarget === "insight_evidence") {
    switch (input.dimension) {
      case "joy":
        return `${prefix}最先把你带起来的是哪一点？`;
      case "fulfillment":
        return `${prefix}最让你觉得今天没白过的是哪一点？`;
      case "reflection":
        return `${prefix}最先让你意识到不一样的，是哪个具体细节？`;
      case "improvement":
        return `${prefix}最需要先看住的是哪一点？`;
      case "gratitude":
        return `${prefix}最让你觉得被照顾到的是哪一点？`;
    }
  }

  switch (input.dimension) {
    case "joy":
      return `${prefix}最打动你的那一点是什么？`;
    case "fulfillment":
      return `${prefix}最让你觉得今天没白过的那一点是什么？`;
    case "reflection":
      return `${prefix}你现在最想指出的关键一点是什么？`;
    case "improvement":
      return `${prefix}最值得先看住的那一点是什么？`;
    case "gratitude":
      return `${prefix}最打动你的那一点是什么？`;
  }
}

function formatNameDirectFeeling(input: {
  dimension: AskIntentEnvelope["dimension"];
  anchorText: string | null;
}) {
  const prefix = formatAnchor(input.anchorText);

  switch (input.dimension) {
    case "reflection":
      return `${prefix}当时最直接冒出来的感觉或念头是什么？`;
    case "fulfillment":
    case "improvement":
      return `${prefix}当时最直接冒出来的感觉是什么？`;
    case "gratitude":
      return `${prefix}当时你最直接的感觉是什么？`;
    case "joy":
    default:
      return `${prefix}当时最直接的感觉是什么？`;
  }
}

function formatLeaveOneSentence(input: {
  dimension: AskIntentEnvelope["dimension"];
  anchorText: string | null;
}) {
  const prefix = formatAnchor(input.anchorText);

  switch (input.dimension) {
    case "joy":
      return `${prefix}如果只留一句，你最想记住哪句？`;
    case "fulfillment":
      return `${prefix}如果只留一句，你最想记住哪句？`;
    case "reflection":
      return `${prefix}如果只留一句，你现在最想留下哪句？`;
    case "improvement":
      return `${prefix}如果只留一句，你下次最想记住哪句提醒？`;
    case "gratitude":
      return `${prefix}如果只留一句，你最想记住哪句感谢？`;
  }
}

function formatNameNextTimeCue(input: {
  dimension: AskIntentEnvelope["dimension"];
  anchorText: string | null;
}) {
  const prefix = formatAnchor(input.anchorText);

  switch (input.dimension) {
    case "joy":
      return `${prefix}下次再遇到类似情况，你最想先抓住哪一点？`;
    case "fulfillment":
      return `${prefix}下次再回看类似经历，你最想先记住哪一点？`;
    case "reflection":
      return `${prefix}下次再遇到类似情况，你最想先提醒自己看哪一点？`;
    case "improvement":
      return `${prefix}下次再遇到类似情况，你最想先试哪一步？`;
    case "gratitude":
      return `${prefix}下次再遇到类似时刻，你最想先记住哪一点？`;
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
