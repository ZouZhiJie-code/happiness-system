type EventFocusOptionCandidate = {
  label: string;
  sourceText: string;
};

type EventSourceGroup = {
  sourceText: string;
  start: number;
  end: number;
};

export type EventCenteredFocusOptionInspection = {
  passed: boolean;
  issues: string[];
};

const STRONG_EVENT_SEPARATOR_PATTERN =
  /(?:另外(?:一件(?:事)?)?|还有一件(?:事)?|另一件事|第二件事)(?:是)?\s*[，,:：]?\s*/gu;
const TEMPORAL_EVENT_SEPARATOR_PATTERN =
  /[，,。！？!?；;]\s*(?=(?:凌晨|早上|上午|中午|下午|傍晚|晚上|夜里)(?:又|还|再)?)/gu;

function normalizeComparableText(value: string) {
  return value.replace(/[\s，。！？、,.!?：:；;“”"'（）()]/gu, "").toLowerCase();
}

function trimSourceGroup(rawText: string, start: number, end: number): EventSourceGroup | null {
  let safeStart = start;
  let safeEnd = end;
  while (safeStart < safeEnd && /[\s，,。！？!?；;：:]/u.test(rawText[safeStart] ?? "")) {
    safeStart += 1;
  }
  while (safeEnd > safeStart && /[\s，,。！？!?；;：:]/u.test(rawText[safeEnd - 1] ?? "")) {
    safeEnd -= 1;
  }
  const sourceText = rawText.slice(safeStart, safeEnd);
  return normalizeComparableText(sourceText).length >= 4
    ? { sourceText, start: safeStart, end: safeEnd }
    : null;
}

/**
 * MVP 只识别首轮两件并列事件。强分隔词两侧各自保留为完整句群，
 * 句群内部的逗号和动作反应不会再被拆成另一件事。
 */
export function splitEventCenteredSourceGroups(rawText: string): EventSourceGroup[] {
  for (const match of rawText.matchAll(STRONG_EVENT_SEPARATOR_PATTERN)) {
    const separatorStart = match.index;
    const separatorEnd = separatorStart + match[0].length;
    const first = trimSourceGroup(rawText, 0, separatorStart);
    const second = trimSourceGroup(rawText, separatorEnd, rawText.length);
    if (first && second) return [first, second];
  }
  for (const match of rawText.matchAll(TEMPORAL_EVENT_SEPARATOR_PATTERN)) {
    const separatorStart = match.index;
    const separatorEnd = separatorStart + match[0].length;
    const first = trimSourceGroup(rawText, 0, separatorStart);
    const second = trimSourceGroup(rawText, separatorEnd, rawText.length);
    if (first && second) return [first, second];
  }
  return [];
}

function sourceGroupsForCandidate(
  candidate: EventFocusOptionCandidate,
  groups: readonly EventSourceGroup[]
) {
  return groups.flatMap((group, index) =>
    group.sourceText.includes(candidate.sourceText) ? [index] : []
  );
}

export function inspectEventCenteredFocusOptions(input: {
  rawText: string;
  options: readonly EventFocusOptionCandidate[];
}): EventCenteredFocusOptionInspection {
  const issues: string[] = [];
  if (input.options.length !== 2) {
    return { passed: false, issues: ["focus_option_count"] };
  }

  const [first, second] = input.options;
  if (!first || !second) {
    return { passed: false, issues: ["focus_option_count"] };
  }
  const normalizedSources = input.options.map((option) =>
    normalizeComparableText(option.sourceText)
  );
  if (normalizedSources.some((source) => source.length < 4)) {
    issues.push("focus_option_source_too_short");
  }
  if (
    normalizedSources[0] === normalizedSources[1] ||
    normalizedSources[0]?.includes(normalizedSources[1] ?? "") ||
    normalizedSources[1]?.includes(normalizedSources[0] ?? "")
  ) {
    issues.push("focus_option_source_overlap");
  }
  if (input.options.some((option) => !input.rawText.includes(option.sourceText))) {
    issues.push("focus_option_source_missing");
  }

  const groups = splitEventCenteredSourceGroups(input.rawText);
  if (groups.length === 2) {
    const assignments = input.options.map((option) =>
      sourceGroupsForCandidate(option, groups)
    );
    if (assignments.some((assignment) => assignment.length !== 1)) {
      issues.push("focus_option_group_ambiguous");
    } else if (new Set(assignments.map((assignment) => assignment[0])).size !== 2) {
      issues.push("focus_option_same_event");
    } else if (assignments[0]?.[0] !== 0 || assignments[1]?.[0] !== 1) {
      issues.push("focus_option_event_order");
    }
  } else {
    issues.push("focus_option_complete_group_unavailable");
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)]
  };
}

function optionLabel(sourceText: string) {
  const visible = sourceText
    .replace(/^[\s，,。！？!?；;：:]+/u, "")
    .replace(/[\s，,。！？!?；;：:]+$/u, "");
  return visible.length > 28 ? `${visible.slice(0, 28)}…` : visible;
}

/**
 * 优先复用模型已经识别出的两项；两项必须分别属于两个事件句群。
 * 模型候选不可靠时，再从强并列分隔词两侧确定性生成。两条路径都失败
 * 时返回 null，由策略层采用无按钮的安全澄清。
 */
export function resolveEventCenteredFocusOptions(input: {
  rawText: string;
  suggestedOptions?: readonly EventFocusOptionCandidate[];
}): EventFocusOptionCandidate[] | null {
  const suggested = input.suggestedOptions ?? [];
  const groups = splitEventCenteredSourceGroups(input.rawText);
  if (inspectEventCenteredFocusOptions({
    rawText: input.rawText,
    options: suggested
  }).passed) {
    return groups.map((group, index) => ({
      label: optionLabel(suggested[index]?.sourceText ?? group.sourceText),
      sourceText: group.sourceText
    }));
  }

  const derived = groups.map((group) => ({
    label: optionLabel(group.sourceText),
    sourceText: group.sourceText
  }));
  return inspectEventCenteredFocusOptions({
    rawText: input.rawText,
    options: derived
  }).passed
    ? derived
    : null;
}
