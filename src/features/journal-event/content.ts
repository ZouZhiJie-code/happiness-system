import {
  MAX_JOURNAL_TITLE_LENGTH,
  normalizeJournalTitleCandidate
} from "@/features/interview/journal-title";
import type {
  EventJournalDraft,
  EventJournalDraftQualityIssue,
  EventJournalDraftQualityResult,
  JournalEventEntrySourceSnapshot
} from "@/types/journal-event-entry";

const INTERNAL_TERM_PATTERN =
  /(JournalEvent|eventId|branchStateId|branchSessionId|sourceOutcomeId|logEligibleOutcomeIds|schemaVersion|事实编号|角度成果|结构化槽位|内部状态|待确认命题)/iu;
const DIAGNOSIS_PATTERN =
  /(抑郁症|焦虑症|双相|人格障碍|创伤后应激|心理疾病|病理化|你患有|说明你有病)/u;
const ADVICE_PATTERN = /(?:你|我)(?:应该|必须|最好|需要马上)|建议你|不妨|务必/u;
const STABLE_INFERENCE_PATTERN =
  /(你|我)(?:总是|一向|从来都|天生|本质上)|人格(?:特质|模式)|长期模式|人生方向/u;
const TITLE_PUNCTUATION_PATTERN = /[，。！？；：,.!?;、]/u;
const GENERIC_TITLE_PATTERN = /^(?:日志|事件日志|今天的事件|当前事件|当前版本日志|日志草稿)$/u;
const COMMON_ANCHOR_PATTERN = /^[我你他她它这那的了是在有和与及也都就把被让给对从为而]/u;
const PROPOSITION_BOUNDARY_PATTERN =
  /(?:后来|随后|然后|之后|同时|另外|此外|所以|于是|因此|结果|最终|并且|而且|不过|但是)/u;
const POST_EVENT_ACTION_PATTERN =
  /后(?=(?:我|他|她|我们|他们|决定|打算|开始|继续|转而|选择|辞职|离开|搬|结束|拒绝|答应|接受|放弃|购买|报名|申请|提出|告诉|承诺|要求))/u;

function normalizeText(value: string | null | undefined) {
  return value?.replace(/\s+/gu, "").replace(/[，。！？、；：“”‘’"'（）()【】]/gu, "").trim() ?? "";
}

function normalizeParagraph(value: string) {
  return value
    .replace(/\r\n?/gu, "\n")
    .split(/\n+/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n");
}

function ensureSentence(value: string) {
  const normalized = value.trim().replace(/[，；：、\s]+$/u, "");
  if (!normalized) return "";
  return /[。！？]$/u.test(normalized) ? normalized : `${normalized}。`;
}

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

function sourceAnchors(text: string) {
  const normalized = normalizeText(text);
  const anchors = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const anchor = normalized.slice(index, index + 2);
    if (!COMMON_ANCHOR_PATTERN.test(anchor)) anchors.add(anchor);
  }
  return anchors;
}

function groundingScore(candidate: string, sources: readonly string[]) {
  const candidateAnchors = sourceAnchors(candidate);
  if (!candidateAnchors.size) return 0;
  const source = new Set(sources.flatMap((value) => [...sourceAnchors(value)]));
  let overlap = 0;
  for (const anchor of candidateAnchors) {
    if (source.has(anchor)) overlap += 1;
  }
  return overlap / candidateAnchors.size;
}

function hasGrounding(candidate: string, sources: readonly string[]) {
  const normalizedCandidate = normalizeText(candidate);
  const normalizedSources = sources.map(normalizeText).filter(Boolean);
  if (!normalizedCandidate || normalizedSources.length === 0) return false;
  if (normalizedSources.some((source) => source.includes(normalizedCandidate))) {
    return true;
  }
  if (
    normalizedSources.some(
      (source) =>
        normalizedCandidate.includes(source) &&
        source.length / normalizedCandidate.length >= 0.5
    )
  ) {
    return true;
  }
  const anchors = sourceAnchors(candidate);
  const source = new Set(normalizedSources.flatMap((value) => [...sourceAnchors(value)]));
  let overlap = 0;
  for (const anchor of anchors) {
    if (source.has(anchor)) overlap += 1;
  }
  return overlap >= 2 && groundingScore(candidate, normalizedSources) >= 0.3;
}

function narrativeSegments(value: string) {
  return value
    .split(/[。！？；，,\n]+/u)
    .flatMap((segment) => segment.split(PROPOSITION_BOUNDARY_PATTERN))
    .flatMap((segment) => segment.split(POST_EVENT_ACTION_PATTERN))
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function hasUnsupportedNovelSpan(candidate: string, sources: readonly string[]) {
  const candidateAnchors = [...sourceAnchors(candidate)];
  const source = new Set(sources.flatMap((value) => [...sourceAnchors(value)]));
  let longestRun = 0;
  let currentRun = 0;
  for (const anchor of candidateAnchors) {
    if (source.has(anchor)) {
      currentRun = 0;
      continue;
    }
    currentRun += 1;
    longestRun = Math.max(longestRun, currentRun);
  }
  return longestRun >= 4;
}

function isPropositionGrounded(candidate: string, sources: readonly string[]) {
  return (
    hasGrounding(candidate, sources) &&
    !hasUnsupportedNovelSpan(candidate, sources)
  );
}

function areAllPropositionsGrounded(
  candidate: string,
  sources: readonly string[]
) {
  const propositions = narrativeSegments(candidate);
  return (
    propositions.length > 0 &&
    propositions.every((proposition) =>
      isPropositionGrounded(proposition, sources)
    )
  );
}

function hasUnsupportedNumber(candidate: string, sources: readonly string[]) {
  const sourceText = sources.join(" ");
  return unique(candidate.match(/\d+(?:\.\d+)?%?/gu) ?? []).some(
    (number) => !sourceText.includes(number)
  );
}

function hasUnsupportedPattern(
  candidate: string,
  sources: readonly string[],
  pattern: RegExp
) {
  pattern.lastIndex = 0;
  const match = pattern.exec(candidate)?.[0];
  if (!match) return false;
  return !sources.some((source) => source.includes(match));
}

function focusedFacts(snapshot: JournalEventEntrySourceSnapshot) {
  const effectiveIds = new Set(snapshot.effectiveFactIds);
  const deprioritizedIds = new Set(snapshot.deprioritizedFactIds);
  return snapshot.facts.filter(
    (fact) => effectiveIds.has(fact.id) && !deprioritizedIds.has(fact.id)
  );
}

function eligibleOutcomes(snapshot: JournalEventEntrySourceSnapshot) {
  const eligibleIds = new Set(snapshot.logEligibleOutcomeIds);
  return snapshot.angleOutcomes.filter(
    (outcome) => outcome.kind === "insight" && eligibleIds.has(outcome.id)
  );
}

function normalizeTitleCandidate(value: string | null | undefined) {
  const normalized = normalizeJournalTitleCandidate(value);
  if (
    !normalized ||
    [...normalized].length < 3 ||
    [...normalized].length > MAX_JOURNAL_TITLE_LENGTH ||
    TITLE_PUNCTUATION_PATTERN.test(normalized) ||
    INTERNAL_TERM_PATTERN.test(normalized) ||
    GENERIC_TITLE_PATTERN.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function fallbackTitle(snapshot: JournalEventEntrySourceSnapshot) {
  const sourceText = focusedFacts(snapshot).map((fact) => fact.statement).join(" ");
  const candidates: Array<[RegExp, string]> = [
    [/误会/u, "那次误会"],
    [/(沟通|说开|聊清楚)/u, "一次重要沟通"],
    [/(等待|等消息|等回复)/u, "等待里的感受"],
    [/(完成|交付|收尾|落地)/u, "终于完成的事情"],
    [/(帮助|支持|接住|陪伴)/u, "被接住的时刻"],
    [/(边界|拒绝|说清楚)/u, "把边界说清楚"],
    [/(选择|取舍|决定)/u, "那次认真选择"]
  ];
  return candidates.find(([pattern]) => pattern.test(sourceText))?.[1] ?? "记下这件事";
}

export function normalizeEventJournalDraft(
  snapshot: JournalEventEntrySourceSnapshot,
  draft: EventJournalDraft
): EventJournalDraft {
  return {
    title: normalizeTitleCandidate(draft.title) ?? fallbackTitle(snapshot),
    eventNarrative: normalizeParagraph(draft.eventNarrative),
    insights: draft.insights.map((insight) => ({
      sourceOutcomeId: insight.sourceOutcomeId.trim(),
      text: normalizeParagraph(insight.text)
    }))
  };
}

export function composeEventJournalContent(draft: EventJournalDraft) {
  const narrative = normalizeParagraph(draft.eventNarrative);
  const insights = draft.insights.map((insight) => normalizeParagraph(insight.text)).filter(Boolean);
  return insights.length
    ? `${narrative}\n\n我看见的\n${insights.join("\n")}`
    : narrative;
}

export function buildEventJournalFallbackDraft(
  snapshot: JournalEventEntrySourceSnapshot
): EventJournalDraft | null {
  const facts = focusedFacts(snapshot);
  const statements = unique(facts.map((fact) => fact.statement.trim()).filter(Boolean));
  if (!statements.length) return null;

  const outcomes = eligibleOutcomes(snapshot);
  return {
    title: fallbackTitle(snapshot),
    eventNarrative: statements.map(ensureSentence).filter(Boolean).join(""),
    insights: outcomes.map((outcome) => ({
      sourceOutcomeId: outcome.id,
      text: ensureSentence(outcome.statement)
    }))
  };
}

export function evaluateEventJournalDraft(input: {
  snapshot: JournalEventEntrySourceSnapshot;
  draft: EventJournalDraft;
}): EventJournalDraftQualityResult {
  const draft = normalizeEventJournalDraft(input.snapshot, input.draft);
  const issues: EventJournalDraftQualityIssue[] = [];
  const facts = focusedFacts(input.snapshot);
  const factStatements = facts.map((fact) => fact.statement).filter(Boolean);
  const outcomes = eligibleOutcomes(input.snapshot);
  const outcomeById = new Map(outcomes.map((outcome) => [outcome.id, outcome]));
  const allSources = [...factStatements, ...outcomes.map((outcome) => outcome.statement)];
  const content = composeEventJournalContent(draft);

  if (!normalizeTitleCandidate(draft.title)) issues.push("invalid_title");
  if (!draft.eventNarrative.trim()) issues.push("empty_narrative");
  if ([...content].length > 3000) issues.push("content_too_long");
  if (
    draft.eventNarrative.trim() &&
    !areAllPropositionsGrounded(draft.eventNarrative, factStatements)
  ) {
    issues.push("narrative_not_grounded");
  }
  if (hasUnsupportedNumber(content, allSources)) issues.push("unsupported_number");
  if (INTERNAL_TERM_PATTERN.test(content)) issues.push("internal_term");
  if (hasUnsupportedPattern(content, allSources, DIAGNOSIS_PATTERN)) {
    issues.push("unsupported_diagnosis");
  }
  if (hasUnsupportedPattern(content, allSources, ADVICE_PATTERN)) {
    issues.push("unsupported_advice");
  }
  if (hasUnsupportedPattern(content, allSources, STABLE_INFERENCE_PATTERN)) {
    issues.push("unsupported_stable_inference");
  }

  const seenOutcomeIds = new Set<string>();
  for (const insight of draft.insights) {
    const outcome = outcomeById.get(insight.sourceOutcomeId);
    if (!outcome) {
      issues.push("unknown_outcome");
      continue;
    }
    if (seenOutcomeIds.has(insight.sourceOutcomeId)) issues.push("duplicate_outcome");
    seenOutcomeIds.add(insight.sourceOutcomeId);
    if (!areAllPropositionsGrounded(insight.text, [outcome.statement])) {
      issues.push("insight_not_grounded");
    }
  }
  if (outcomes.some((outcome) => !seenOutcomeIds.has(outcome.id))) {
    issues.push("missing_eligible_outcome");
  }

  const uniqueIssues = unique(issues);
  const sourceIssues: EventJournalDraftQualityIssue[] = [
    "narrative_not_grounded",
    "unsupported_number",
    "unknown_outcome",
    "duplicate_outcome",
    "missing_eligible_outcome",
    "insight_not_grounded"
  ];
  const sourceGrounded = uniqueIssues.every((issue) => !sourceIssues.includes(issue));
  const basicQualityPassed = uniqueIssues.every(
    (issue) => !["invalid_title", "empty_narrative", "content_too_long", "internal_term",
      "unsupported_diagnosis", "unsupported_advice", "unsupported_stable_inference"].includes(issue)
  );
  return {
    accepted: uniqueIssues.length === 0,
    issues: uniqueIssues,
    sourceGrounded,
    basicQualityPassed
  };
}

export function getEventJournalPromptSources(snapshot: JournalEventEntrySourceSnapshot) {
  return {
    facts: focusedFacts(snapshot).map((fact) => ({
      id: fact.id,
      scope: fact.scope,
      stance: fact.stance,
      kind: fact.kind,
      statement: fact.statement
    })),
    outcomes: eligibleOutcomes(snapshot).map((outcome) => ({
      id: outcome.id,
      statement: outcome.statement
    }))
  };
}
