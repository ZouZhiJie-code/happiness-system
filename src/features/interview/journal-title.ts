export const MAX_JOURNAL_TITLE_LENGTH = 16;
export const MAX_JOURNAL_CONTENT_LENGTH = 3000;

import { buildDimensionSemanticInterpretation } from "@/features/interview/server/semantic-interpretation";
import type { DraftBrief, InterviewDimension, InterviewJournalPayload, InterviewSnapshotData, JoySnapshot } from "@/types/interview";

const SYSTEM_TITLE_PREFIX_PATTERN =
  /^(?:今天的开心|今天的充实|今天的思考|今天的改进|今天的感谢|开心日志|充实日志|思考日志|改进日志|感谢日志|日志)[：:\s-]*/u;
const FIELD_NAME_PATTERN =
  /(joyMoment|joySource|stateShift|meaningNeed|manualClue|delightSignature|experience|progressEvidence|valueSignal|fulfillmentType|trigger|insight|viewpointShift|frictionPoint|nextAttempt|gratitudeMoment|gratitudeTarget|kindAction|seenNeed|innerEffect|gratitudeReason|gratitudeType|relationshipSignal|reciprocityHint|具体片段|进展证据|值得感标准|充实类型|开心来源|状态变化|核心洞见|改进卡点|感谢原因|感谢对象|具体善意|被看见的需要|关系线索)/iu;
const PROCESS_TITLE_PATTERN =
  /^(?:我|今天|这件事|这个片段)?(?:看了|读了|听了|介绍|了解|有了|然后|之后|接着|后来|因为|通过|当时|做了|完成了|把|在|从)?(?:一本|一个|相关的)?/u;
const BAD_TITLE_START_PATTERN = /^(?:介绍怎么|有了之后|有了|我就|然后|后来|因为|通过|当时|这件事|今天我|我今天|看了一本|读了一本|做了一个|完成了一个)/u;
const BAD_TITLE_END_PATTERN = /(?:怎么|如何|之后|以后|然后|因为|通过|有了|为了|但是|以及|和|跟|把|被|的|了|，|、)$/u;
const IMPROVEMENT_EVENT_TITLE_PATTERN =
  /^今天(?:开会|沟通|交流|回复|回答|解释|协作|准备|开工|上午|下午|晚上|早上|工作|上班|有点|太)/u;
const PUNCTUATION_PATTERN = /[，。！？；：,.!?;、]/u;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function trimTrailingPunctuation(value: string) {
  return value.replace(/[，。！？；：,.!?;:\s]+$/u, "").trim();
}

function compactTitleText(value: string) {
  return normalizeWhitespace(value)
    .replace(/[“”"'《》【】（）()[\]]/gu, "")
    .replace(/^(?:我今天|今天我|今天|我|这件事|这个片段|这一次|这一段)(?:最)?/u, "")
    .trim();
}

function isBadJournalTitleCandidate(value: string | null | undefined) {
  const candidate = normalizeJournalTitleCandidate(value);

  if (!candidate) {
    return true;
  }

  if (candidate.length > MAX_JOURNAL_TITLE_LENGTH) {
    return true;
  }

  if (candidate.length < 3) {
    return true;
  }

  if (PUNCTUATION_PATTERN.test(candidate)) {
    return true;
  }

  if (FIELD_NAME_PATTERN.test(candidate)) {
    return true;
  }

  if (BAD_TITLE_START_PATTERN.test(candidate) || BAD_TITLE_END_PATTERN.test(candidate)) {
    return true;
  }

  if (/^(?:今天记下的片刻|今天的片刻|当前版本日志|日志草稿)$/u.test(candidate)) {
    return true;
  }

  if (/^(?:一下被带轻|轻轻被带起来|象征意义|动作本身|启动信号|确定性|简单性|仪式感)$/u.test(candidate)) {
    return true;
  }

  if (/^(?:改进日志|今天的改进|下一次尝试|我要变得更好)$/u.test(candidate)) {
    return true;
  }

  if (/^(?:感谢日志|今天的感谢|谢谢|感谢)$/u.test(candidate)) {
    return true;
  }

  if (/^(?:真的收了个口|把事情落下去)$/u.test(candidate)) {
    return true;
  }

  return false;
}

function pushCandidate(candidates: string[], value: string | null | undefined) {
  const candidate = normalizeJournalTitleCandidate(value);

  if (!candidate || isBadJournalTitleCandidate(candidate)) {
    return;
  }

  if (!candidates.includes(candidate)) {
    candidates.push(candidate);
  }
}

function shortenNounPhrase(value: string | null | undefined) {
  const normalized = normalizeJournalTitleCandidate(value);

  if (!normalized) {
    return null;
  }

  const firstClause = compactTitleText(normalized)
    .split(/[，。！？；：,.!?;、]/u)
    .map((part) => part.trim())
    .find(Boolean);

  if (!firstClause) {
    return null;
  }

  const cleaned = firstClause
    .replace(PROCESS_TITLE_PATTERN, "")
    .replace(/^(?:真正让我(?:开心|充实|在意|觉得有价值)的(?:是)?|让我(?:开心|充实|有感觉)的(?:是)?|关键是|原因是|因为)/u, "")
    .replace(/(?:这件事|这一步|这个过程|这个动作)$/u, "")
    .trim();

  if (cleaned.length >= 3 && cleaned.length <= MAX_JOURNAL_TITLE_LENGTH) {
    return cleaned;
  }

  return null;
}

function buildFulfillmentTitleCandidates(input: SemanticJournalTitleInput) {
  const candidates: string[] = [];
  const progressEvidence = input.snapshot?.whyItMattered ?? (input.snapshotData?.kind === "fulfillment" ? input.snapshotData.progressEvidence : null) ?? input.draftBrief?.emotionalCore;
  const valueSignal = input.snapshot?.selfPattern ?? (input.snapshotData?.kind === "fulfillment" ? input.snapshotData.valueSignal : null) ?? input.draftBrief?.closingInsight;
  const fulfillmentType = input.snapshot?.happinessType ?? (input.snapshotData?.kind === "fulfillment" ? input.snapshotData.fulfillmentType : null) ?? input.draftBrief?.directionSignal;
  const experience = input.snapshot?.event ?? (input.snapshotData?.kind === "fulfillment" ? input.snapshotData.experience : null) ?? input.draftBrief?.anchorScene;
  const joined = [progressEvidence, valueSignal, fulfillmentType, experience].filter(Boolean).join(" ");

  if (/结构|方法/u.test(joined) && /落地|行动|执行/u.test(joined)) {
    pushCandidate(candidates, "从结构到落地");
  }

  if (/主线|脉络/u.test(joined) && /理顺|清楚|明确/u.test(joined)) {
    pushCandidate(candidates, "主线终于理顺");
  }

  if (/协作|配合|交接|同事|团队/u.test(joined) && /接上|帮到|支持|对齐/u.test(joined)) {
    pushCandidate(candidates, "让协作接上");
  }

  if (/收口|收尾|交付|落地|完成|搞定/u.test(joined)) {
    pushCandidate(candidates, "终于落了地");
  } else if (/推进/u.test(joined)) {
    pushCandidate(candidates, "把事情往前推");
  }

  if (/练到|练习|学会|积累/u.test(joined)) {
    pushCandidate(candidates, "练到一点进展");
  }

  pushCandidate(candidates, shortenNounPhrase(valueSignal));
  pushCandidate(candidates, shortenNounPhrase(progressEvidence));
  pushCandidate(candidates, shortenNounPhrase(fulfillmentType));
  pushCandidate(candidates, shortenNounPhrase(experience));

  return candidates;
}

function buildJoyTitleCandidates(input: SemanticJournalTitleInput) {
  const candidates: string[] = [];
  const joySource = input.snapshot?.joySource ?? (input.snapshotData?.kind === "joy" ? input.snapshotData.joySource : null) ?? input.draftBrief?.emotionalCore;
  const stateShift = input.snapshot?.stateShift ?? (input.snapshotData?.kind === "joy" ? input.snapshotData.stateShift : null) ?? input.draftBrief?.stateOrNeed;
  const manualClue = input.snapshot?.manualClue ?? (input.snapshotData?.kind === "joy" ? input.snapshotData.manualClue : null) ?? input.draftBrief?.closingInsight;
  const delightSignature = input.snapshot?.delightSignature ?? (input.snapshotData?.kind === "joy" ? input.snapshotData.delightSignature : null) ?? input.draftBrief?.closingInsight;
  const joyMoment = input.snapshot?.joyMoment ?? (input.snapshotData?.kind === "joy" ? input.snapshotData.joyMoment : null) ?? input.snapshot?.event ?? input.draftBrief?.anchorScene;
  const joined = [joySource, stateShift, manualClue, delightSignature, joyMoment].filter(Boolean).join(" ");

  if (/(早起|早一点起|起得早)/u.test(joined) && /(清醒|准备|从容|时间|开始|启动)/u.test(joined)) {
    pushCandidate(candidates, "清醒地开始");
    pushCandidate(candidates, "早起后的从容");
  }

  if (/(多了?|更多|留出|空出).{0,8}时间/u.test(joined) && /(从容|清醒|准备|轻松|不慌)/u.test(joined)) {
    pushCandidate(candidates, "多出一点从容");
  }

  if (/(放松|轻松|松下来|带轻|带松|舒展)/u.test(joined)) {
    pushCandidate(candidates, "慢慢松下来");
  }

  pushCandidate(candidates, shortenNounPhrase(delightSignature));
  pushCandidate(candidates, shortenNounPhrase(manualClue));
  pushCandidate(candidates, shortenNounPhrase(joySource));
  pushCandidate(candidates, shortenNounPhrase(stateShift));
  pushCandidate(candidates, shortenNounPhrase(joyMoment));

  return candidates;
}

function buildGenericTitleCandidates(input: SemanticJournalTitleInput) {
  const candidates: string[] = [];
  const payload = input.payload;
  const snapshotData = input.snapshotData;

  if (input.dimension === "reflection") {
    const insight =
      input.snapshot?.whyItMattered ??
      (snapshotData?.kind === "reflection" ? snapshotData.insight : null) ??
      (payload?.kind === "reflection" ? payload.insight : null) ??
      input.draftBrief?.emotionalCore;
    const viewpointShift =
      input.snapshot?.selfPattern ??
      (snapshotData?.kind === "reflection" ? snapshotData.viewpointShift : null) ??
      (payload?.kind === "reflection" ? payload.viewpointShift : null) ??
      input.draftBrief?.closingInsight;
    const reflectionType =
      input.snapshot?.happinessType ??
      (snapshotData?.kind === "reflection" ? snapshotData.reflectionType : null) ??
      (payload?.kind === "reflection" ? payload.reflectionType : null) ??
      input.draftBrief?.directionSignal;
    const trigger =
      input.snapshot?.event ??
      (snapshotData?.kind === "reflection" ? snapshotData.trigger : null) ??
      (payload?.kind === "reflection" ? payload.trigger : null) ??
      input.draftBrief?.anchorScene;
    const joined = [insight, viewpointShift, reflectionType, trigger].filter(Boolean).join(" ");

    if (/忙碌|很忙|任务/u.test(joined) && /(进展|推进|判断依据|真正)/u.test(joined)) {
      pushCandidate(candidates, "忙碌不等于进展");
    }

    if (/(判断|依据|标准|校准|分清|区别)/u.test(joined)) {
      pushCandidate(candidates, "判断依据变清楚");
    }

    if (/(优势|擅长|方向|适合|主线)/u.test(joined)) {
      pushCandidate(candidates, "看见自己的方向");
    }

    if (/(规律|模式|反复|每次|通常)/u.test(joined)) {
      pushCandidate(candidates, "看见一层规律");
    }

    pushCandidate(candidates, shortenNounPhrase(viewpointShift));
    pushCandidate(candidates, shortenNounPhrase(reflectionType));
    pushCandidate(candidates, shortenNounPhrase(insight));
    pushCandidate(candidates, shortenNounPhrase(trigger));
    pushCandidate(candidates, shortenNounPhrase(snapshotData?.kind === "reflection" ? snapshotData.insight : null));
    pushCandidate(candidates, shortenNounPhrase(payload?.kind === "reflection" ? payload.insight : null));
    pushCandidate(candidates, shortenNounPhrase(snapshotData?.kind === "reflection" ? snapshotData.trigger : null));
  } else if (input.dimension === "improvement") {
    const frictionPoint =
      input.snapshot?.frictionPoint ??
      input.snapshot?.whyItMattered ??
      (snapshotData?.kind === "improvement" ? snapshotData.frictionPoint : null) ??
      (payload?.kind === "improvement" ? payload.frictionPoint : null) ??
      input.draftBrief?.frictionPoint;
    const repeatCondition =
      input.snapshot?.repeatCondition ??
      (snapshotData?.kind === "improvement" ? snapshotData.repeatCondition : null) ??
      (payload?.kind === "improvement" ? payload.repeatCondition : null) ??
      input.draftBrief?.repeatCondition;
    const controllableFactor =
      input.snapshot?.controllableFactor ??
      (snapshotData?.kind === "improvement" ? snapshotData.controllableFactor : null) ??
      (payload?.kind === "improvement" ? payload.controllableFactor : null) ??
      input.draftBrief?.controllableFactor;
    const nextAttempt =
      input.snapshot?.nextAttempt ??
      input.snapshot?.selfPattern ??
      (snapshotData?.kind === "improvement" ? snapshotData.nextAttempt : null) ??
      (payload?.kind === "improvement" ? payload.nextAttempt : null) ??
      input.draftBrief?.nextAttempt ??
      input.draftBrief?.closingInsight;
    const situation =
      input.snapshot?.event ??
      (snapshotData?.kind === "improvement" ? snapshotData.situation : null) ??
      (payload?.kind === "improvement" ? payload.situation : null) ??
      input.draftBrief?.anchorScene;
    const joined = [frictionPoint, repeatCondition, controllableFactor, nextAttempt, situation].filter(Boolean).join(" ");

    if (/(边界|拒绝|范围|说清|讲清|提前说|别临时|不要临时)/u.test(joined)) {
      pushCandidate(candidates, "把边界说清楚");
    }

    if (/(缓冲|预留|留出|提前|十分钟|十五分钟|空档|余量)/u.test(joined)) {
      pushCandidate(candidates, "提前留出缓冲");
    }

    if (/(准备|材料|信息|预案|检查|更充分|没准备|准备不足)/u.test(joined)) {
      pushCandidate(candidates, "让准备更充分");
    }

    if (/(没听完|听完整|听完|先听|复述|确认|问题)/u.test(joined) && /(回答|回应|解释|回复)/u.test(joined)) {
      pushCandidate(candidates, "先听完再回应");
    }

    if (/(表达|说话|回复|回答|解释|回应)/u.test(joined) && /(急|太快|抢|没听完|没确认|答偏)/u.test(joined)) {
      pushCandidate(candidates, "表达慢下来");
    }

    if (/(节奏|急|太快|慢|稳|乱|打散|被消息带)/u.test(joined)) {
      pushCandidate(candidates, "把节奏放稳");
    }

    if (/(主线|重点|三条|开工|消息)/u.test(joined)) {
      pushCandidate(candidates, "开工前定主线");
    }

    pushCandidate(candidates, shortenNounPhrase(nextAttempt));
    pushCandidate(candidates, shortenNounPhrase(controllableFactor));
    pushCandidate(candidates, shortenNounPhrase(repeatCondition));
    pushCandidate(candidates, shortenNounPhrase(frictionPoint));
    pushCandidate(candidates, shortenNounPhrase(situation));
  } else if (input.dimension === "gratitude") {
    const kindAction =
      input.snapshot?.kindAction ??
      (snapshotData?.kind === "gratitude" ? snapshotData.kindAction : null) ??
      (payload?.kind === "gratitude" ? payload.kindAction : null) ??
      input.draftBrief?.emotionalCore;
    const seenNeed =
      input.snapshot?.seenNeed ??
      (snapshotData?.kind === "gratitude" ? snapshotData.seenNeed : null) ??
      (payload?.kind === "gratitude" ? payload.seenNeed : null) ??
      input.draftBrief?.stateOrNeed;
    const relationshipSignal =
      input.snapshot?.relationshipSignal ??
      input.snapshot?.selfPattern ??
      (snapshotData?.kind === "gratitude" ? snapshotData.relationshipSignal : null) ??
      (payload?.kind === "gratitude" ? payload.relationshipSignal : null) ??
      input.draftBrief?.closingInsight;
    const gratitudeReason =
      input.snapshot?.gratitudeReason ??
      input.snapshot?.whyItMattered ??
      (snapshotData?.kind === "gratitude" ? snapshotData.gratitudeReason : null) ??
      (payload?.kind === "gratitude" ? payload.gratitudeReason : null);
    const gratitudeMoment =
      input.snapshot?.gratitudeMoment ??
      input.snapshot?.event ??
      (snapshotData?.kind === "gratitude" ? snapshotData.gratitudeMoment ?? snapshotData.moment : null) ??
      (payload?.kind === "gratitude" ? payload.gratitudeMoment ?? payload.moment : null) ??
      input.draftBrief?.anchorScene;
    const joined = [kindAction, seenNeed, relationshipSignal, gratitudeReason, gratitudeMoment].filter(Boolean).join(" ");

    if (/(接住|撑不住|压力|扛|不孤单)/u.test(joined)) {
      pushCandidate(candidates, "被稳稳接住");
    }

    if (/(理解|听我说|认真听|被看见|懂我)/u.test(joined)) {
      pushCandidate(candidates, "被认真理解");
    }

    if (/(提醒|吃饭|休息|照顾|关心)/u.test(joined)) {
      pushCandidate(candidates, "那句及时提醒");
    }

    if (/(优先级|理清|梳理|分担|帮我处理|帮我收尾)/u.test(joined)) {
      pushCandidate(candidates, "有人帮我理清");
    }

    if (/(信任|机会|交给我|让我负责)/u.test(joined)) {
      pushCandidate(candidates, "被信任的机会");
    }

    pushCandidate(candidates, shortenNounPhrase(seenNeed));
    pushCandidate(candidates, shortenNounPhrase(kindAction));
    pushCandidate(candidates, shortenNounPhrase(relationshipSignal));
    pushCandidate(candidates, shortenNounPhrase(gratitudeReason));
    pushCandidate(candidates, shortenNounPhrase(gratitudeMoment));
  }

  pushCandidate(candidates, shortenNounPhrase(input.snapshot?.whyItMattered));
  pushCandidate(candidates, shortenNounPhrase(input.snapshot?.event));
  pushCandidate(candidates, shortenNounPhrase(input.draftBrief?.titleHint));

  return candidates;
}

function safeFallbackTitle(dimension: InterviewDimension) {
  switch (dimension) {
    case "joy":
      return "今天的开心";
    case "fulfillment":
      return "今天没白过";
    case "reflection":
      return "今天的思考";
    case "improvement":
      return "今天的改进";
    case "gratitude":
      return "今天的感谢";
  }
}

export function normalizeJournalTitleCandidate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = trimTrailingPunctuation(normalizeWhitespace(value)).replace(SYSTEM_TITLE_PREFIX_PATTERN, "").trim();

  return normalized || null;
}

export interface SemanticJournalTitleInput {
  dimension: InterviewDimension;
  snapshot?: JoySnapshot | null;
  snapshotData?: InterviewSnapshotData | null;
  payload?: InterviewJournalPayload | null;
  draftBrief?: DraftBrief | null;
  aiTitle?: string | null;
  fallbackTitle?: string | null;
}

export function buildSemanticJournalTitle(input: SemanticJournalTitleInput) {
  const candidates: string[] = [];
  const semanticCandidates =
    input.draftBrief?.titleCandidates?.length
      ? input.draftBrief.titleCandidates
      : input.snapshot
        ? buildDimensionSemanticInterpretation({
            dimension: input.dimension,
            snapshot: input.snapshot
          }).titleCandidates
        : [];

  for (const candidate of semanticCandidates) {
    pushCandidate(candidates, candidate);
  }

  const heuristicCandidates =
    input.dimension === "fulfillment"
      ? buildFulfillmentTitleCandidates(input)
      : input.dimension === "joy"
        ? buildJoyTitleCandidates(input)
        : buildGenericTitleCandidates(input);

  for (const candidate of heuristicCandidates) {
    pushCandidate(candidates, candidate);
  }

  const normalizedAiTitle = normalizeJournalTitleCandidate(input.aiTitle);

  if (!(input.dimension === "improvement" && IMPROVEMENT_EVENT_TITLE_PATTERN.test(normalizedAiTitle ?? ""))) {
    pushCandidate(candidates, normalizedAiTitle);
  }

  pushCandidate(candidates, shortenNounPhrase(input.fallbackTitle));

  return candidates[0] ?? safeFallbackTitle(input.dimension);
}

export function buildJournalTitle(input: {
  primary: string | null | undefined;
  secondary?: string | null | undefined;
  fallback?: string | null | undefined;
  dimension?: InterviewDimension;
}) {
  return buildSemanticJournalTitle({
    dimension: input.dimension ?? "joy",
    aiTitle: input.primary,
    fallbackTitle: input.secondary ?? input.fallback
  });
}
