export const EVENT_CENTERED_RECORD_MODES = ["capture", "chat"] as const;

export type EventCenteredRecordMode = (typeof EVENT_CENTERED_RECORD_MODES)[number];

export const EVENT_CENTERED_CAPTURE_OPENING =
  "这里是【帮我记】。写下此刻想留下的内容就好。";

const CAPTURE_OPERATION_ONLY_PATTERNS = [
  /^(?:先)?(?:帮我)?记(?:一下|下来)?[。！!~～ ]*$/u,
  /^(?:开始|继续)(?:吧|记录)?[。！!~～ ]*$/u,
  /^(?:嗯+|哦+|好+|好的|可以|行)[。！!~～ ]*$/u
];

export function normalizeCaptureContent(value: string) {
  return value.replace(/\r\n?/gu, "\n").trim();
}

export function isEffectiveCaptureContent(value: string) {
  const normalized = normalizeCaptureContent(value);
  return Boolean(
    normalized &&
      !CAPTURE_OPERATION_ONLY_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

export function buildCaptureAcknowledgement(rawText: string) {
  const normalized = normalizeCaptureContent(rawText);
  if (/[？?]/u.test(normalized)) return "这份疑问也记下了。";
  return "好，这一段已经记下了。";
}

function captureTitle(rawText: string) {
  const firstLine = normalizeCaptureContent(rawText).split("\n")[0] ?? "";
  const firstClause = firstLine
    .replace(/[“”"'《》【】（）()[\]]/gu, "")
    .split(/[，。！？；：,.!?;:]/u)[0]
    ?.replace(/^(?:今天我|我今天|今天|我)/u, "")
    ?.trim();
  return [...(firstClause || "今天的记录")].slice(0, 16).join("");
}

export function buildCaptureJournalDraft(rawSegments: readonly string[]) {
  const effectiveSegments = rawSegments
    .map(normalizeCaptureContent)
    .filter(isEffectiveCaptureContent);
  if (effectiveSegments.length === 0) return null;

  return {
    title: captureTitle(effectiveSegments[0]),
    content: effectiveSegments.join("\n\n"),
    effectiveSegments
  };
}
