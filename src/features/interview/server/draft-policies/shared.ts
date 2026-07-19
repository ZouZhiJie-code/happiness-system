import { isUsableJoyDelightSignature } from "@/features/joy-interview/server/joy-interview-engine";
import type { JoySnapshot } from "@/types/interview";

export function sanitizeNullableString(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

export function trimTrailingPunctuation(value: string) {
  return value.replace(/[，。！？；：,.!?;:\s]+$/u, "").trim();
}

export function takeFirstSentence(value: string) {
  const firstSentence = value.match(/^[^。！？!?]+/u)?.[0] ?? value;

  return trimTrailingPunctuation(firstSentence);
}

export function normalizeGratitudeNeedText(value: string | null | undefined) {
  const normalized = sanitizeNullableString(value);

  if (!normalized) {
    return null;
  }

  const cleaned = trimTrailingPunctuation(
    normalized
      .replace(/^(这让我觉得|让我觉得|我觉得|觉得|感觉到?|感到)/u, "")
      .replace(/^这件事之所以重要，?不是礼貌地谢谢，?而是对方像是看见了/u, "")
      .replace(/^对方像是看见了/u, "")
      .replace(/^(自己|我自己)/u, "我")
      .trim()
  );
  const seenAndReliefMatch = cleaned.match(
    /^(我当时的[^，。！？!?]{0,60}?)(?:被看见了|被接住了|被理解了)[，,]?(不用硬撑着一边听一边记)$/u
  );

  if (seenAndReliefMatch) {
    return `${seenAndReliefMatch[1]}，以及${seenAndReliefMatch[2]}的难处`;
  }

  const needAndReliefMatch = cleaned.match(/^(我当时的[^，。！？!?]{0,60}?)[，,](不用硬撑着一边听一边记)$/u);

  if (needAndReliefMatch) {
    return `${needAndReliefMatch[1]}，以及${needAndReliefMatch[2]}的难处`;
  }

  return (
    cleaned
      .replace(/^(我当时的[^，。！？!?]{0,60}?)(?:被看见了|被接住了|被理解了)(?=[，。！？!?]|$)/u, "$1")
      .trim() || null
  );
}

export function buildParagraph(...sentences: Array<string | null | undefined>) {
  const normalizedSentences = sentences
    .map((sentence) => sentence?.trim())
    .filter((sentence): sentence is string => Boolean(sentence));

  return normalizedSentences.length ? normalizedSentences.join(" ") : null;
}

export function buildDraftContent(...paragraphs: Array<string | null | undefined>) {
  return paragraphs
    .map((paragraph) => paragraph?.trim())
    .filter((paragraph): paragraph is string => Boolean(paragraph))
    .join("\n\n");
}

export function normalizeSignature(value: string | null | undefined) {
  return value ? value.replace(/\s+/g, "").replace(/[，。！？；：,.!?;:]/gu, "") : "";
}

export function hasSpecificDelightCue(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /(反差|转折|意外|出其不意|不期而遇|小惊喜|一本正经|原本以为|实际上|节奏|冷不丁|突然|上头|停不下来)/u.test(value);
}

export function getUsableDelightSignature(snapshot: JoySnapshot) {
  const delightSignature = sanitizeNullableString(snapshot.delightSignature);

  return isUsableJoyDelightSignature(delightSignature) ? delightSignature : null;
}
