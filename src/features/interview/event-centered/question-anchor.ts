const SENTENCE_BOUNDARY = /[。！？!?；;\n]+/u;
const CLAUSE_BOUNDARY = /[，,、：:]/gu;
const TRAILING_PUNCTUATION = /[。！？!?，,；;：:\s]+$/gu;

function normalizeAnchorText(value: string | null | undefined) {
  return value
    ?.replace(/\s+/gu, " ")
    .replace(/“/gu, "‘")
    .replace(/”/gu, "’")
    .trim() ?? "";
}

/**
 * 问句只引用一段完整、可独立理解的用户表达。
 *
 * 结构化事实有时会把“已经回答的内容”和“下一项仍待回答的线索”
 * 合并成两句话。直接按字数裁剪会把第二句截成“但我……”之类的残句。
 * 这里优先保留第一句完整事实；单句过长时优先在自然分句处收住。
 */
export function createEventCenteredQuestionAnchor(
  value: string | null | undefined,
  maxLength = 30
) {
  const normalized = normalizeAnchorText(value);
  if (!normalized) return "";

  const sentences = normalized
    .split(SENTENCE_BOUNDARY)
    .map((sentence) => sentence.replace(TRAILING_PUNCTUATION, "").trim())
    .filter(Boolean);
  const candidate =
    sentences.find((sentence) => sentence.length >= 6) ??
    sentences[0] ??
    normalized.replace(TRAILING_PUNCTUATION, "");

  if (candidate.length <= maxLength) return candidate;

  const prefix = candidate.slice(0, Math.max(1, maxLength - 1));
  const boundaries = Array.from(prefix.matchAll(CLAUSE_BOUNDARY));
  const lastBoundary = boundaries.at(-1)?.index ?? -1;
  const concise =
    lastBoundary >= 8
      ? prefix.slice(0, lastBoundary)
      : prefix;

  return `${concise.replace(TRAILING_PUNCTUATION, "")}…`;
}
