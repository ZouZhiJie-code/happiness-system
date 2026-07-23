import type { JournalDailyInsightDraft } from "@/features/journal-daily/schema";
import type {
  JournalDailySelfInsight,
  JournalDailySourceEntry
} from "@/types/journal-daily-entry";

const INTERNAL_OR_UNSAFE_PATTERN =
  /(事实编号|角度编号|置信度|Trace|提示词|系统状态|人格类型|心理诊断|心理疾病|抑郁症|焦虑症|应该|必须|建议你|务必)/iu;
const STABLE_CONCLUSION_PATTERN =
  /(你一直|你总是|我一直|我总是|一直以来|长期来看|稳定人格|人生方向|注定|本质上|天生|固定模式|我是(?:一个)?[^。！？]{0,16}(?:的人|人格))/u;
const DIRECTIONAL_CONCLUSION_PATTERN =
  /(生活方式|关系方向|关系走向|相处方向|更适合|最好|不妨|建议|需要去|应该|必须|务必|独自生活|独居|保持单身|减少来往|不再交往|断绝关系|远离(?:关系|人群|他人)|结束这段关系|放弃这段关系|适合[^。！？]{0,12}(?:生活|关系|相处|工作))/u;
const PROVISIONAL_PATTERN = /(今天|这几件事|这些事|此刻|暂时|目前)/u;
const GENERIC_EVIDENCE_PHRASES = new Set([
  "今天",
  "事情",
  "这件事",
  "这些事",
  "感觉",
  "觉得",
  "当时",
  "后来",
  "自己",
  "一个",
  "好像",
  "目前",
  "暂时"
]);

function normalizeEvidenceText(value: string) {
  return value.replace(/\s+/gu, "").trim();
}

function isMeaningfulSharedEvidencePhrase(value: string) {
  const normalized = normalizeEvidenceText(value);
  const chineseCharacters = normalized.match(/[\p{Script=Han}]/gu)?.length ?? 0;
  const latinCharacters = normalized.match(/[a-z0-9]/giu)?.length ?? 0;

  return (
    !GENERIC_EVIDENCE_PHRASES.has(normalized) &&
    (chineseCharacters >= 2 || latinCharacters >= 4)
  );
}

function buildGroundedInsightText(sharedEvidencePhrase: string) {
  return `今天暂时看见，“${sharedEvidencePhrase}”在这几件事里都出现了。`;
}

export type JournalDailyInsightQualityResult =
  | {
      accepted: true;
      insight: JournalDailySelfInsight | null;
      issues: [];
    }
  | {
      accepted: false;
      insight: null;
      issues: string[];
    };

export function validateJournalDailyInsightDraft(
  draft: JournalDailyInsightDraft,
  sources: JournalDailySourceEntry[]
): JournalDailyInsightQualityResult {
  if (!draft.selfInsight) {
    return { accepted: true, insight: null, issues: [] };
  }

  const text = draft.selfInsight.text.trim();
  const sourceEventIds = Array.from(
    new Set(draft.selfInsight.sourceEventIds.map((eventId) => eventId.trim()))
  );
  const eligibleSources = new Map(
    sources.map((source) => [source.eventId, source] as const)
  );
  const eligibleEventIds = new Set(eligibleSources.keys());
  const sharedEvidencePhrase = draft.selfInsight.sharedEvidencePhrase.trim();
  const normalizedSharedPhrase = normalizeEvidenceText(sharedEvidencePhrase);
  const evidence = draft.selfInsight.evidence.map((item) => ({
    eventId: item.eventId.trim(),
    quote: item.quote.trim()
  }));
  const evidenceEventIds = Array.from(
    new Set(evidence.map((item) => item.eventId))
  );
  const issues: string[] = [];

  if (sourceEventIds.length < 2) {
    issues.push("insufficient_source_events");
  }
  if (sourceEventIds.some((eventId) => !eligibleEventIds.has(eventId))) {
    issues.push("unknown_source_event");
  }
  if (!PROVISIONAL_PATTERN.test(text)) {
    issues.push("missing_provisional_language");
  }
  if (INTERNAL_OR_UNSAFE_PATTERN.test(text)) {
    issues.push("unsafe_or_internal_language");
  }
  if (STABLE_CONCLUSION_PATTERN.test(text)) {
    issues.push("stable_conclusion");
  }
  if (DIRECTIONAL_CONCLUSION_PATTERN.test(text)) {
    issues.push("directional_conclusion");
  }
  if (
    !isMeaningfulSharedEvidencePhrase(sharedEvidencePhrase) ||
    INTERNAL_OR_UNSAFE_PATTERN.test(sharedEvidencePhrase) ||
    STABLE_CONCLUSION_PATTERN.test(sharedEvidencePhrase) ||
    DIRECTIONAL_CONCLUSION_PATTERN.test(sharedEvidencePhrase) ||
    !normalizeEvidenceText(text).includes(normalizedSharedPhrase)
  ) {
    issues.push("unsupported_shared_evidence_phrase");
  }
  if (
    evidenceEventIds.length < 2 ||
    sourceEventIds.some((eventId) => !evidenceEventIds.includes(eventId)) ||
    evidenceEventIds.some((eventId) => !sourceEventIds.includes(eventId))
  ) {
    issues.push("insufficient_explicit_evidence");
  }
  for (const item of evidence) {
    const source = eligibleSources.get(item.eventId);
    const normalizedQuote = normalizeEvidenceText(item.quote);
    const normalizedSource = source
      ? normalizeEvidenceText(`${source.title}\n${source.content}`)
      : "";

    if (
      !source ||
      !normalizedSource.includes(normalizedQuote) ||
      !normalizedQuote.includes(normalizedSharedPhrase)
    ) {
      issues.push("unverifiable_source_quote");
      break;
    }
  }

  return issues.length > 0
    ? { accepted: false, insight: null, issues }
    : {
        accepted: true,
        insight: {
          text: buildGroundedInsightText(sharedEvidencePhrase),
          sourceEventIds,
          sharedEvidencePhrase,
          evidence
        },
        issues: []
      };
}

export function buildJournalDailyInsightMessages(
  sources: JournalDailySourceEntry[]
) {
  const sourceText = sources
    .map((source) =>
      [
        `eventId: ${source.eventId}`,
        `记录顺序: ${source.daySequence}`,
        `标题: ${source.title}`,
        "正文:",
        source.content
      ].join("\n")
    )
    .join("\n\n---\n\n");

  return [
    {
      role: "system" as const,
      content: [
        "你帮助用户从当天多件已经保存的事件日志里，看见一条谨慎、可追溯的共同线索。",
        "只根据输入日志判断。至少两个不同事件共同支持同一条联系时才生成。",
        "每个来源都要给出一段逐字存在于对应日志的短摘录，并找出这些摘录共同出现的 sharedEvidencePhrase。",
        "sharedEvidencePhrase 必须是有实际含义的共同短语，也必须自然出现在最终线索中。",
        "任一来源缺少共同短语、两件事彼此无关或只能靠推断连接时，selfInsight 必须为 null。",
        "证据不足时 selfInsight 必须为 null。",
        "线索使用“今天暂时看见”“这几件事里都出现了”等阶段性表达。",
        "禁止稳定人格、长期模式、生活方式、关系方向、人生方向、心理诊断、行动建议和内部结构词。",
        "只输出 JSON。"
      ].join("\n")
    },
    {
      role: "user" as const,
      content: [
        "请判断这些事件是否支持一条“今天看见的自己”。",
        "输出格式：",
        '{"title":"今天的记录","selfInsight":{"text":"...","sourceEventIds":["...","..."],"sharedEvidencePhrase":"两篇日志都逐字出现的共同短语","evidence":[{"eventId":"...","quote":"来源日志中的逐字短摘录"},{"eventId":"...","quote":"来源日志中的逐字短摘录"}]}}',
        "证据不足时输出：",
        '{"title":"今天的记录","selfInsight":null}',
        "",
        "当天已保存的事件日志：",
        sourceText
      ].join("\n")
    }
  ];
}
