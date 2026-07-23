/**
 * 角度成果必须给用户带来一条具体的新认识。
 *
 * 这层只做确定性拦截：模型仍负责提出候选，但“泛化占位句”和对原话的
 * 近似复述不能被写成 insight。它们会回到既有策略，继续选择一个具体问题。
 */

export type AngleOutcomeSupportFact = {
  id: string;
  text: string;
};

const GENERIC_OUTCOME_PATTERNS = [
  /从这(?:段表达|段话|里|件事).{0,10}(?:看(?:到|得出)|已经能看到).{0,12}(?:一条|一些)?(?:可以)?(?:保留|形成)?(?:的)?(?:线索|认识)/u,
  /(?:已经|可以|先)(?:形成|保留).{0,12}(?:一条|一些)?(?:线索|认识)/u,
  /(?:这(?:里|段|件)).{0,10}(?:有|是).{0,8}(?:一条|一些)?(?:线索|认识)/u,
  /(?:值得)?(?:保留|写下).{0,8}(?:线索|认识)/u
];

/**
 * 零问成果只能整理用户已经说清的区分、对比或因果。
 * 文本访谈不具备额外行为线索，单个事件事实不足以推出“需要、动机、后果”。
 */
const EXPLICIT_SOURCE_RELATION_PATTERN = /(?:不是.{0,16}(?:而是|更)|(?:比起|相比).{0,20}(?:更|较|还)|因为.{0,30}(?:所以|才|于是|因此)|(?:所以|因此|于是|导致|为了|宁愿|只有|却|反而|一边.{0,12}一边|又.{0,12}又|更在意|更看重|最在意|最看重))/u;
const COMMON_GRAM_PATTERN = /^[我你他她它这那的了是在有和与及也都就把被让给对从为而]/u;

function normalizeText(value: string | null | undefined) {
  return value?.replace(/\s+/gu, "").replace(/[，。！？、；：“”‘’'"（）()]/gu, "").trim() ?? "";
}

function comparableText(value: string | null | undefined) {
  return normalizeText(value)
    .replace(/(?:我当时|我现在|我自己|这件事|这个角度|这段(?:表达|经历|话)|其实|就是|已经|可以|先|真的|有点|一下|然后|后来)/gu, "")
    .replace(/[了的地得]/gu, "");
}

function longestCommonSubsequenceLength(left: string, right: string) {
  const previous = new Array<number>(right.length + 1).fill(0);
  const current = new Array<number>(right.length + 1).fill(0);

  for (const leftCharacter of left) {
    for (let index = 1; index <= right.length; index += 1) {
      current[index] = leftCharacter === right[index - 1]
        ? previous[index - 1] + 1
        : Math.max(previous[index], current[index - 1]);
    }
    for (let index = 0; index <= right.length; index += 1) previous[index] = current[index];
  }

  return previous[right.length] ?? 0;
}

function isNearRestatement(statement: string, supportFact: string) {
  const candidate = comparableText(statement);
  const fact = comparableText(supportFact);
  if (!candidate || !fact) return false;
  if (candidate === fact) return true;

  const shorter = Math.min(candidate.length, fact.length);
  if (shorter >= 7 && (candidate.includes(fact) || fact.includes(candidate))) return true;

  // 中文没有天然分词边界。使用字符序列相似度识别“加了少量语气词”的复述，
  // 同时为“从事实抽出更准确认识”的正常表达保留足够空间。
  return shorter >= 10 &&
    longestCommonSubsequenceLength(candidate, fact) / shorter >= 0.86;
}

function sourceAnchors(text: string) {
  const normalized = normalizeText(text);
  const anchors = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const anchor = normalized.slice(index, index + 2);
    if (!COMMON_GRAM_PATTERN.test(anchor)) anchors.add(anchor);
  }
  return anchors;
}

function hasEnoughExplicitSourceAnchors(statement: string, supportFacts: string[]) {
  const statementAnchors = sourceAnchors(statement);
  const source = new Set(supportFacts.flatMap((fact) => [...sourceAnchors(fact)]));
  let overlap = 0;
  for (const anchor of statementAnchors) {
    if (source.has(anchor)) overlap += 1;
    if (overlap >= 2) return true;
  }
  return false;
}

export function isIncrementalAngleOutcome(input: {
  statement: string | null | undefined;
  supportFactIds: readonly string[];
  facts: readonly AngleOutcomeSupportFact[];
}) {
  const statement = normalizeText(input.statement);
  if (!statement || GENERIC_OUTCOME_PATTERNS.some((pattern) => pattern.test(statement))) {
    return false;
  }

  const factById = new Map(
    input.facts
      .map((fact) => ({ id: fact.id.trim(), text: normalizeText(fact.text) }))
      .filter((fact) => fact.id && fact.text)
      .map((fact) => [fact.id, fact.text])
  );
  const supportFactIds = [...new Set(input.supportFactIds.map((id) => id.trim()).filter(Boolean))];
  if (!supportFactIds.length || supportFactIds.some((id) => !factById.has(id))) return false;

  const supportFacts = supportFactIds.map((id) => factById.get(id)!);
  if (!supportFacts.every((fact) => !isNearRestatement(statement, fact))) return false;

  // 先有用户明确表达的关系，再允许把它整理成一条成果。两处来源锚点
  // 让结果保留可见证据，避免从“发生了什么”跳到未表达的需要或动机。
  return supportFacts.some((fact) => EXPLICIT_SOURCE_RELATION_PATTERN.test(fact)) &&
    hasEnoughExplicitSourceAnchors(statement, supportFacts);
}
