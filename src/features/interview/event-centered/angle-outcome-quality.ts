/**
 * 角度成果必须给用户带来一条具体的新认识。
 *
 * 这层只做确定性拦截：模型仍负责提出候选，但“泛化占位句”和对原话的
 * 近似复述不能被写成 insight。它们会回到既有策略，继续选择一个具体问题。
 */

export type AngleOutcomeSupportFact = {
  id: string;
  text: string;
  sourceTexts?: readonly string[];
  recurrenceSourceTexts?: readonly string[];
};

const GENERIC_OUTCOME_PATTERNS = [
  /从这(?:段表达|段话|里|件事).{0,10}(?:看(?:到|得出)|已经能看到).{0,12}(?:一条|一些)?(?:可以)?(?:保留|形成)?(?:的)?(?:线索|认识)/u,
  /(?:已经|可以|先)(?:形成|保留).{0,12}(?:一条|一些)?(?:线索|认识)/u,
  /(?:这(?:里|段|件)).{0,10}(?:有|是).{0,8}(?:一条|一些)?(?:线索|认识)/u,
  /(?:值得)?(?:保留|写下).{0,8}(?:线索|认识)/u
];

/**
 * 角度成果默认只描述当前事件。只有用户来源本身明确表达重复发生或稳定倾向时，
 * 才允许把这一次整理成“我会／总会／容易……”一类规律句。
 */
const STABLE_PATTERN_OUTCOME_CUE =
  /(?:总是|总会|总想|总在|每次|通常|经常|常常|往往|一贯|反复|容易|我会|时会|会让|会被|会转|会先|会同时|会更|会一直|会用|会在意|会触到|能让|能减少|就不用|就能)/u;
const EXPLICIT_STABLE_PATTERN_OUTCOME_CUE =
  /(?:总是|总会|总想|总在|每次|每回|通常|经常|常常|往往|一贯|反复|容易|一[^，。！？]{1,20}就)/u;
const EXPLICIT_REPEAT_SOURCE_CUE =
  /(?:总是|总会|总想|总在|每次|每回|通常|经常|常常|往往|一贯|一向|反复|容易|老是|只要.{1,24}就|每当.{1,24}就|一(?!开始|上来|度|次)[^，。！？]{1,20}就)/u;

/**
 * 零问成果只能整理用户已经说清的区分、对比或因果。
 * 文本访谈不具备额外行为线索，单个事件事实不足以推出“需要、动机、后果”。
 */
const EXPLICIT_SOURCE_RELATION_PATTERN = /(?:不是.{0,16}(?:而是|更)|(?:比起|相比).{0,20}(?:更|较|还)|因为|(?:所以|因此|于是|导致|为了|宁愿|只有|却|反而|一边.{0,12}一边|又.{0,12}又|更在意|更看重|最在意|最看重))/u;
const COMMON_GRAM_PATTERN = /^[我你他她它这那的了是在有和与及也都就把被让给对从为而]/u;

function normalizeText(value: string | null | undefined) {
  return value?.replace(/\s+/gu, "").replace(/[，。！？、；：“”‘’'"（）()]/gu, "").trim() ?? "";
}

const EVENT_SCOPED_OUTCOME_PATTERN = /(?:这次|这回|那次|当时|刚才|这件事(?:里|中)|那一刻|这个时刻)/u;

/**
 * 单次事件中的成果保留事件口径。只有用户事实明确提供重复性证据时，
 * 才允许把当前关系概括成稳定规律。这里沿用模型已经给出的事实关系，
 * 只收窄时间范围，不增加新的需要、动机或后果。
 */
export function scopeAngleOutcomeToCurrentEvent(input: {
  statement: string | null | undefined;
  supportFactTexts: readonly string[];
}) {
  const statement = input.statement?.replace(/\s+/gu, " ").trim() ?? "";
  if (!statement) return "";
  const sourceSupportsRecurrence = input.supportFactTexts.some((fact) =>
    EXPLICIT_REPEAT_SOURCE_CUE.test(fact)
  );
  if (sourceSupportsRecurrence) return statement;
  if (
    EVENT_SCOPED_OUTCOME_PATTERN.test(statement) &&
    !EXPLICIT_STABLE_PATTERN_OUTCOME_CUE.test(statement)
  ) return statement;

  // “总是／每次／经常／一……就……”表达的是跨事件规律。缺少用户原话中的
  // 重复证据时直接退回提问，让访谈补齐证据；字符串删改容易制造新的因果关系。
  if (EXPLICIT_STABLE_PATTERN_OUTCOME_CUE.test(statement)) return "";

  const rewritten = statement
    .replace(/我会/gu, "我")
    .replace(/我容易先/gu, "我先")
    .replace(/我容易/gu, "我")
    .replace(/会让我/gu, "让我")
    .replace(/能让我/gu, "让我")
    .replace(/会被我/gu, "被我")
    .replace(/会转成/gu, "转成")
    .replace(/会触到/gu, "触到")
    .replace(/会一直/gu, "一直")
    .replace(/会先/gu, "先")
    .replace(/会同时/gu, "同时")
    .replace(/会更/gu, "更")
    .replace(/会在意/gu, "在意")
    .replace(/会用/gu, "用")
    .replace(/能让/gu, "让")
    .replace(/能减少/gu, "减少了")
    .replace(/后面就不用一直([^，。！？]+)/gu, "让后面没那么$1")
    .replace(/就不用一直/gu, "没再一直")
    .replace(/就能/gu, "就");

  if (EVENT_SCOPED_OUTCOME_PATTERN.test(rewritten)) return rewritten;

  return /^我/u.test(rewritten) ? `这次，${rewritten}` : `这次${rewritten}`;
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

export function keepsAngleOutcomeInsideEventScope(input: {
  statement: string | null | undefined;
  supportFactTexts: readonly string[];
}) {
  const statement = input.statement?.trim() ?? "";
  if (!statement || !STABLE_PATTERN_OUTCOME_CUE.test(statement)) return true;
  if (input.supportFactTexts.some((fact) => EXPLICIT_REPEAT_SOURCE_CUE.test(fact))) {
    return true;
  }
  if (
    EVENT_SCOPED_OUTCOME_PATTERN.test(statement) &&
    !EXPLICIT_STABLE_PATTERN_OUTCOME_CUE.test(statement)
  ) return true;

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
      .map((fact) => ({
        id: fact.id.trim(),
        text: normalizeText(fact.text),
        sourceTexts: (fact.sourceTexts === undefined ? [fact.text] : fact.sourceTexts)
          .map((text) => text.trim())
          .filter(Boolean),
        recurrenceSourceTexts: (
          fact.recurrenceSourceTexts === undefined
            ? fact.sourceTexts === undefined ? [fact.text] : fact.sourceTexts
            : fact.recurrenceSourceTexts
        ).map((text) => text.trim()).filter(Boolean)
      }))
      .filter((fact) => fact.id && fact.text)
      .map((fact) => [fact.id, fact])
  );
  const supportFactIds = [...new Set(input.supportFactIds.map((id) => id.trim()).filter(Boolean))];
  if (!supportFactIds.length || supportFactIds.some((id) => !factById.has(id))) return false;

  const supportFactRecords = supportFactIds.map((id) => factById.get(id)!);
  const supportFacts = supportFactRecords.map((fact) => fact.text);
  const supportSourceTexts = supportFactRecords.flatMap((fact) => fact.sourceTexts);
  const supportRecurrenceSourceTexts = supportFactRecords.flatMap(
    (fact) => fact.recurrenceSourceTexts
  );
  if (!supportFacts.every((fact) => !isNearRestatement(statement, fact))) return false;
  if (!keepsAngleOutcomeInsideEventScope({
    statement: input.statement,
    supportFactTexts: supportRecurrenceSourceTexts
  })) return false;

  // 先有用户明确表达的关系，再允许把它整理成一条成果。两处来源锚点
  // 让结果保留可见证据，避免从“发生了什么”跳到未表达的需要或动机。
  return supportSourceTexts.some((fact) => EXPLICIT_SOURCE_RELATION_PATTERN.test(fact)) &&
    hasEnoughExplicitSourceAnchors(statement, supportSourceTexts);
}
