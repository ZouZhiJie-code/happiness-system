import { getInterviewDimensionConfig } from "@/features/interview/server/dimension-config";
import { buildSemanticJournalTitle, MAX_JOURNAL_TITLE_LENGTH } from "@/features/interview/journal-title";
import { buildDimensionSemanticInterpretation } from "@/features/interview/server/semantic-interpretation";
import {
  createDraft,
  getDelightSignature,
  getDirectionSignal,
  getDurability,
  getJoyClosureTarget,
  getJoyPsychProfile,
  getJoyTrack,
  getJoyMoment,
  getJoySource,
  getJoyTags,
  getLegacyJoyProjection,
  hasJoyStableClosure,
  getManualClue,
  getMeaningNeed,
  getStateShift,
  getValueImpact
} from "@/features/joy-interview/server/joy-interview-engine";
import type {
  DraftBrief,
  DraftWritingProfile,
  DraftCompletionMode,
  DraftEmphasis,
  InterviewDimension,
  InterviewEventRecord,
  InterviewSessionRecord,
  JoyEntryDraft,
  JoyEventBlock,
  JoySnapshot
} from "@/types/interview";

const BASE_TONE_BAN_SET = ["小标题或字段名直写", "条目式总结", "总结腔", "建议腔", "系统解释腔"];
const JOY_TONE_BAN_SET = [
  "这次访谈",
  "我已经整理出",
  "使用说明书",
  "当前版本日志",
  "至少到现在我已经更清楚",
  "总的来说",
  "总结起来",
  "以后可以",
  "我应该"
];
const FULFILLMENT_TONE_BAN_SET = [
  "周报腔",
  "汇报腔",
  "绩效总结",
  "完成事项清单",
  "成长口号",
  "以后要继续保持",
  "我应该"
];
const REFLECTION_TONE_BAN_SET = [
  "人生感悟",
  "心理诊断",
  "行动计划",
  "方法论总结",
  "复盘报告",
  "以后要",
  "下次要",
  "我应该"
];
export const IMPROVEMENT_TONE_BAN_SET = [
  "检讨书腔",
  "自责腔",
  "说教腔",
  "效率工具建议腔",
  "OKR",
  "KPI",
  "计划表腔",
  "心理诊断腔",
  "宏大成长口号",
  "我应该",
  "我必须",
  "以后一定要"
];
const GRATITUDE_TONE_BAN_SET = [
  "感谢信模板",
  "表扬稿",
  "道德负债感",
  "报答任务",
  "还人情",
  "人际建议腔",
  "鸡汤式善意",
  "我应该",
  "我必须",
  "以后一定要回报"
];
const SYSTEM_TONE_PATTERNS = [
  /这次访谈/u,
  /我已经整理出/u,
  /你现在看到的是/u,
  /正文初稿/u,
  /当前版本日志/u,
  /至少到现在[，,]?[我]?已经更清楚/u
];
const SUMMARY_TONE_PATTERNS = [/总的来说/u, /总结起来/u, /换句话说/u, /说到底/u];
const ADVICE_TONE_PATTERNS = [/以后可以/u, /下次可以/u, /我应该/u, /要记得/u, /这提醒我要/u];
const DELIGHT_SHAMING_PATTERNS = [/虽然没什么深意/u, /只是浅层快乐/u, /没什么意义但/u, /只是图一乐/u];
const FULFILLMENT_PROGRESS_EVIDENCE_PATTERN =
  /(完成|做完|推进|收口|解决|搞定|落地|产出|交付|练到|学会|积累|帮到|支持到|对齐|明确|定下来|改完|写完|整理出|确认了?)/u;
const FULFILLMENT_BUSY_PATTERN = /(忙|上班|开会|会议|任务很多|事情很多|排满|加班|连轴转|赶工|被任务推着走)/u;
const FULFILLMENT_REPORT_TONE_PATTERN = /(日报|周报|月报|绩效|KPI|OKR|汇报|工作总结|完成事项|事项清单|项目进展如下)/iu;
const FULFILLMENT_SLOGAN_PATTERN = /(成长|进步|提升|突破|蜕变|自律|长期主义|变得更好|持续精进)/u;
const FULFILLMENT_NO_WASTE_PATTERN =
  /(不算白过|不是空转|算数|有分量|没白费|没有白费|不白费|不是白费|没白忙|没有白忙|不白忙|不是白忙|没白做|没有白做|不白做|不是白做|没白折腾|没有白折腾)/u;
const FULFILLMENT_CLOSURE_SIGNAL_PATTERN =
  /(终于|总算|不再|有了着落|落了地|收了口|收住了?|接上了|理顺了|补上了|卡住的地方[^。！？!?]{0,12}(?:松开|松动|推开|过去|落地|收住|收口))/u;
const FULFILLMENT_FORCED_VALUE_PATTERN =
  /(值得感标准|我(?:真正)?重视|我(?:真正)?看重|对我来说[^。！？!?]{0,40}算数|对我而言[^。！？!?]{0,40}算数|我在意的是)/u;
const FULFILLMENT_DIRECTION_ESCALATION_PATTERN =
  /(真正热爱|人生方向|人生价值|职业使命|事业使命|天赋所在|长期战略|命中注定|生命主题)/u;
const STABLE_RULE_PATTERN =
  /((?:只要|每次只要|一旦|如果我能|当我)(?:[^。！？!?]{0,50})(?:就会|我就会|我更容易|我通常会|就更容易|才算|才会))/u;
const REFLECTION_INSIGHT_PATTERN =
  /(意识到|发现|想明白|理解到|看清|重新看见|更清楚|真正有(?:进展|价值|分量)|真正让我明白|这让我看到|原来|其实|判断依据|规律|盲点|优势|方向)/u;
const REFLECTION_ACTION_PLAN_PATTERN = /(以后要|下次要|我应该|行动计划|执行计划|立刻去|马上去|每天都要|必须要)/u;
const REFLECTION_DIAGNOSIS_PATTERN = /(心理问题|人格|创伤|抑郁|焦虑症|病态|缺陷|有病)/u;
const REFLECTION_LIFE_CONCLUSION_PATTERN = /(人生(?:真谛|意义|答案|使命)|永远|一定会|注定|本质上所有|世界就是|人都是)/u;
const IMPROVEMENT_SELF_BLAME_PATTERN =
  /(我(?:很|太)?(?:差|烂|糟糕|没用|失败|废|不行)|我就是(?:不行|没用)|人格(?:缺陷|有问题)|都是我的错|自我检讨|检讨一下|反省自己|太蠢|太笨)/u;
const IMPROVEMENT_EMPTY_ACTION_PATTERN =
  /(我要(?:努力|加油|自律|变好|改进|提升|坚持|注意一点|认真一点)|以后(?:要|一定要)(?:努力|加油|自律|变好|改进|提升|坚持|注意一点|认真一点)|下次(?:要|一定要)(?:努力|加油|自律|变好|改进|提升|坚持|注意一点|认真一点))/u;
const IMPROVEMENT_ADVICE_TONE_PATTERN =
  /(你(?:应该|可以|需要|最好|必须)|建议(?:你|我)?|可以尝试|不妨|应该先|需要先|关键是要|制定(?:一个)?计划|行动计划|计划表)/u;
const IMPROVEMENT_THERAPY_TONE_PATTERN =
  /(心理诊断|人格分析|创伤|原生家庭|抑郁症|焦虑症|病态|防御机制|潜意识|内在小孩)/u;
const IMPROVEMENT_PRODUCTIVITY_TONE_PATTERN =
  /(OKR|KPI|效率工具|任务管理|工作复盘|复盘模板|行动项|待办清单|目标拆解|时间管理矩阵|制定(?:一个)?计划|自律起来)/iu;
const IMPROVEMENT_STABLE_PLAN_PATTERN =
  /(完整方案|长期计划|每天都要|必须做到|一定做到|以后一定要|从此以后|彻底改变|全面提升|持续精进)/u;
const IMPROVEMENT_EXTERNAL_BLAME_PATTERN = /(都是|全是|只能怪|问题在)(?:对方|别人|同事|老板|客户|环境|公司|他们)/u;
const GRATITUDE_THANK_YOU_TEMPLATE_PATTERN = /(亲爱的|敬爱的|衷心感谢|由衷感谢|感谢信|此致|敬礼|表达我最诚挚的谢意)/u;
const GRATITUDE_DEBT_PATTERN = /(欠了?人情|必须报答|一定要回报|还人情|亏欠|无以为报|我应该报答|我必须回报)/u;
const GRATITUDE_ADVICE_PATTERN = /(你应该|你需要|建议你|以后(?:一定)?要|下次(?:一定)?要|我应该|我必须|要学会感恩|做人要懂得感恩)/u;
const GRATITUDE_EMPTY_KINDNESS_PATTERN = /(人很好|很善良|很温暖|很感动|很感谢)(?:。|$)/u;

export interface DraftQualityGateResult {
  accepted: boolean;
  issues: string[];
}

function sanitizeNullableString(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function trimTrailingPunctuation(value: string) {
  return value.replace(/[，。！？；：,.!?;:\s]+$/u, "").trim();
}

function normalizeContentUnit(value: string) {
  return value.replace(/\s+/g, "").replace(/[，。！？；：,.!?;:、“”"'（）()【】\[\]《》]/gu, "");
}

function normalizeSignature(value: string | null | undefined) {
  return value ? value.replace(/\s+/g, "").replace(/[，。！？；：,.!?;:]/gu, "") : "";
}

function buildSceneAnchorFragments(value: string | null | undefined) {
  const normalized = normalizeSignature(value);

  if (!normalized) {
    return [];
  }

  if (normalized.length <= 4) {
    return [normalized];
  }

  const fragmentLength = Math.min(4, normalized.length);
  const fragments = new Set<string>();

  for (let index = 0; index <= normalized.length - fragmentLength; index += 1) {
    fragments.add(normalized.slice(index, index + fragmentLength));
  }

  return Array.from(fragments);
}

function hasSceneAnchor(content: string, candidates: Array<string | null | undefined>) {
  const normalizedContent = normalizeSignature(content);

  return candidates.some((candidate) =>
    buildSceneAnchorFragments(candidate).some((fragment) => normalizedContent.includes(fragment))
  );
}

function isSceneAnchorMissing(content: string, candidate: string | null | undefined) {
  if (!candidate) {
    return false;
  }

  return !hasSceneAnchor(content, [candidate]);
}

function buildLooseSceneAnchorFragments(value: string | null | undefined) {
  const normalized = normalizeSignature(value);

  if (!normalized) {
    return [];
  }

  if (normalized.length <= 3) {
    return [normalized];
  }

  const fragments = new Set<string>();

  for (let index = 0; index <= normalized.length - 3; index += 1) {
    fragments.add(normalized.slice(index, index + 3));
  }

  return Array.from(fragments);
}

function hasLooseSceneAnchor(content: string, candidate: string | null | undefined) {
  if (!candidate) {
    return false;
  }

  const normalizedContent = normalizeSignature(content);
  const fragments = buildLooseSceneAnchorFragments(candidate);

  if (fragments.length === 0) {
    return false;
  }

  const matchedIndexes = fragments.flatMap((fragment, index) => (normalizedContent.includes(fragment) ? [index] : []));
  const overlapCount = matchedIndexes.length;
  const overlapRatio = overlapCount / fragments.length;
  const hasAdjacentOverlap = matchedIndexes.some(
    (matchedIndex, position) => position > 0 && matchedIndex === matchedIndexes[position - 1] + 1
  );

  return overlapRatio >= 0.34 && (overlapCount >= 4 || (overlapCount >= 3 && hasAdjacentOverlap));
}

function isSupportingSceneAnchorMissing(content: string, candidate: string | null | undefined) {
  if (!candidate) {
    return false;
  }

  return isSceneAnchorMissing(content, candidate) && !hasLooseSceneAnchor(content, candidate);
}

function hasSpecificDelightCue(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /(反差|转折|意外|出其不意|不期而遇|小惊喜|一本正经|原本以为|实际上|节奏|冷不丁|突然|上头|停不下来)/u.test(value);
}

function hasGenericCoreRegression(brief: DraftBrief, content: string) {
  if (brief.dimension !== "joy" || brief.joyTrack !== "delight_track" || !hasSpecificDelightCue(brief.emotionalCore)) {
    return false;
  }

  return /真正让我(?:开心|有感觉|被触动)[^。！？!?]{0,24}(?:是|而是)[^。！？!?]{0,12}(?:搞笑短视频|短视频|视频|段子|内容)/u.test(content);
}

function formatTheorySummarySentence(brief: DraftBrief) {
  const theorySummary = sanitizeNullableString(brief.theorySummary);

  return theorySummary ? `${trimTrailingPunctuation(theorySummary)}。` : null;
}

function hasTheorySignalInContent(brief: DraftBrief, content: string) {
  const theoryCandidates = [
    brief.theorySummary,
    brief.titleTheme,
    brief.emotionalCore,
    brief.closingInsight,
    brief.valueSignal,
    brief.directionSignal
  ];

  return hasSceneAnchor(content, theoryCandidates);
}

function expandSemanticCandidates(candidates: Array<string | null | undefined>) {
  return candidates.flatMap((candidate) => {
    const normalized = sanitizeNullableString(candidate);

    if (!normalized) {
      return [];
    }

    return normalized
      .split(/[；;，,、]/u)
      .map((part) => sanitizeNullableString(part))
      .filter((part): part is string => Boolean(part));
  });
}

function hasLooseSemanticSignal(content: string, candidates: Array<string | null | undefined>) {
  const normalizedContent = normalizeSignature(content);

  return expandSemanticCandidates(candidates).some((candidate) => {
    const normalizedCandidate = normalizeSignature(candidate);

    if (!normalizedCandidate) {
      return false;
    }

    if (normalizedContent.includes(normalizedCandidate)) {
      return true;
    }

    if (normalizedCandidate.length <= 4) {
      const prefix = normalizedCandidate.slice(0, 2);
      const suffix = normalizedCandidate.slice(-2);

      return normalizedContent.includes(prefix) || normalizedContent.includes(suffix);
    }

    return hasLooseSceneAnchor(content, candidate);
  });
}

function hasFulfillmentTheoryCore(brief: DraftBrief, content: string) {
  if (hasTheorySignalInContent(brief, content) || FULFILLMENT_NO_WASTE_PATTERN.test(content)) {
    return true;
  }

  return FULFILLMENT_PROGRESS_EVIDENCE_PATTERN.test(content) && FULFILLMENT_CLOSURE_SIGNAL_PATTERN.test(content);
}

function isParaphraseOnlyDraft(brief: DraftBrief, content: string) {
  if (!brief.anchorScene || !hasSceneAnchor(content, [brief.anchorScene])) {
    return false;
  }

  if (hasTheorySignalInContent(brief, content)) {
    return false;
  }

  return content.split(/\n{2,}/).filter(Boolean).length <= 2;
}

function hasJoyVitalityCore(brief: DraftBrief, content: string) {
  if (hasTheorySignalInContent(brief, content)) {
    return true;
  }

  const semanticCandidates = [
    brief.emotionalCore,
    brief.stateOrNeed,
    brief.closingInsight,
    brief.titleTheme,
    ...brief.antiFlatteningTargets
  ];

  if (hasLooseSemanticSignal(content, semanticCandidates)) {
    return true;
  }

  const hasStateCue =
    /(轻松|松下来|放松|舒展开|更轻|更松|踏实|安心|更稳|更亮|有劲|被看见|被理解|被接住|被回应|进入状态|状态变好)/u.test(content);
  const hasMeaningCue = /(不只是|而是|真正|打动|触动|让我|会把|整个人|那一下|那一刻|状态)/u.test(content);

  return hasStateCue && hasMeaningCue;
}

function hasGenericTitleRegression(title: string, brief: DraftBrief) {
  if (!brief.titleTheme) {
    return false;
  }

  if (hasSceneAnchor(title, [brief.titleTheme])) {
    return false;
  }

  return /^(?:今天的开心|今天没白过|今天的充实|今天的思考|今天的改进|今天的感谢|今天很忙|日志草稿)$/u.test(
    title.trim()
  );
}

function hasDuplicateContent(content: string) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const seenParagraphs = new Set<string>();

  for (const paragraph of paragraphs) {
    const normalized = normalizeContentUnit(paragraph);

    if (normalized.length < 12) {
      continue;
    }

    if (seenParagraphs.has(normalized)) {
      return true;
    }

    seenParagraphs.add(normalized);
  }

  const sentences = content
    .split(/(?<=[。！？!?])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const seenSentences = new Set<string>();

  for (const sentence of sentences) {
    const normalized = normalizeContentUnit(sentence);

    if (normalized.length < 12) {
      continue;
    }

    if (seenSentences.has(normalized)) {
      return true;
    }

    seenSentences.add(normalized);
  }

  return false;
}

function pickPrimaryEvent(dimension: InterviewDimension, sourceEvents: InterviewEventRecord[]) {
  if (dimension === "joy") {
    return (
      sourceEvents.find((event) => isJoySnapshotComplete(event.snapshot)) ??
      sourceEvents.find((event) => getJoySource(event.snapshot)) ??
      sourceEvents.find((event) => getJoyMoment(event.snapshot)) ??
      sourceEvents[0] ??
      null
    );
  }

  if (dimension === "improvement") {
    return (
      sourceEvents.find((event) => hasCompleteImprovementSnapshot(event.snapshot)) ??
      sourceEvents.find((event) => event.snapshot.nextAttempt) ??
      sourceEvents.find((event) => event.snapshot.controllableFactor) ??
      sourceEvents.find((event) => event.snapshot.frictionPoint || event.snapshot.repeatCondition || event.snapshot.whyItMattered) ??
      sourceEvents.find((event) => event.snapshot.event) ??
      sourceEvents[0] ??
      null
    );
  }

  return (
    sourceEvents.find((event) => event.snapshot.selfPattern) ??
    sourceEvents.find((event) => event.snapshot.whyItMattered) ??
    sourceEvents.find((event) => event.snapshot.event) ??
    sourceEvents[0] ??
    null
  );
}

function getJoyClosingValue(snapshot: JoySnapshot) {
  return getJoyClosureTarget(snapshot) === "manual_clue" ? getManualClue(snapshot) : getDelightSignature(snapshot);
}

function isJoySnapshotComplete(snapshot: JoySnapshot) {
  const hasCore =
    getJoyTrack(snapshot) === "delight_track"
      ? Boolean(getJoyMoment(snapshot) && getJoySource(snapshot) && getStateShift(snapshot))
      : Boolean(getJoyMoment(snapshot) && getJoySource(snapshot) && (getStateShift(snapshot) || getMeaningNeed(snapshot)));

  return hasCore && hasJoyStableClosure(snapshot);
}

function resolveJoyCompletionMode(session: InterviewSessionRecord, sourceEvents: InterviewEventRecord[]): DraftCompletionMode {
  if (session.pendingDecision?.kind === "event_complete" && session.pendingDecision.completionMode) {
    return session.pendingDecision.completionMode;
  }

  if (sourceEvents.some((event) => isJoySnapshotComplete(event.snapshot)) || isJoySnapshotComplete(session.snapshot)) {
    return "complete";
  }

  return "user_override_partial";
}

function deriveJoyEmphasis(snapshot: JoySnapshot): DraftEmphasis {
  const psychProfile = getJoyPsychProfile(snapshot);
  const hasMeaningSignal = psychProfile.track === "meaning_track";
  const hasDelightSignal = Boolean(getStateShift(snapshot) || getDelightSignature(snapshot));

  if (hasMeaningSignal && hasDelightSignal) {
    return "mixed";
  }

  if (hasMeaningSignal) {
    return "meaning";
  }

  if (hasDelightSignal) {
    return "delight";
  }

  return "mixed";
}

function pickJoyEmotionalCore(snapshot: JoySnapshot) {
  const joySource = sanitizeNullableString(getJoySource(snapshot) ?? snapshot.whyItMattered);
  const delightSignature = sanitizeNullableString(getDelightSignature(snapshot));

  if (delightSignature && hasSpecificDelightCue(delightSignature)) {
    return delightSignature;
  }

  if (joySource) {
    return joySource;
  }

  return delightSignature;
}

function buildJoyBrief(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  completionMode: DraftCompletionMode;
}): DraftBrief {
  const primaryEvent = pickPrimaryEvent("joy", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const primaryClueSignature = normalizeSignature(getJoyClosingValue(primarySnapshot));
  const primarySourceSignature = normalizeSignature(getJoySource(primarySnapshot));
  const relatedEvents = input.sourceEvents.filter((event) => {
    if (!primaryEvent || event.id === primaryEvent.id) {
      return false;
    }

    if (primaryClueSignature && normalizeSignature(getJoyClosingValue(event.snapshot)) === primaryClueSignature) {
      return true;
    }

    if (primarySourceSignature && normalizeSignature(getJoySource(event.snapshot)) === primarySourceSignature) {
      return true;
    }

    return false;
  });
  const compositionMode = relatedEvents.length ? "stitched_moments" : "single_moment";
  const stateShift = sanitizeNullableString(getStateShift(primarySnapshot));
  const meaningNeed = sanitizeNullableString(getMeaningNeed(primarySnapshot));
  const anchorScene = sanitizeNullableString(getJoyMoment(primarySnapshot) ?? primarySnapshot.event);
  const emotionalCore = pickJoyEmotionalCore(primarySnapshot);
  const joyTrack = getJoyTrack(primarySnapshot);
  const closureTarget = getJoyClosureTarget(primarySnapshot);
  const closingInsight =
    input.completionMode === "complete"
      ? sanitizeNullableString(getJoyClosingValue(primarySnapshot))
      : null;
  const semanticInterpretation = buildDimensionSemanticInterpretation({
    dimension: "joy",
    snapshot: primarySnapshot,
    sourceEvents: input.sourceEvents,
    activeEvent: primaryEvent
  });

  return {
    dimension: "joy",
    completionMode: input.completionMode,
    compositionMode,
    emphasis: deriveJoyEmphasis(primarySnapshot),
    anchorScene,
    emotionalCore,
    stateOrNeed:
      stateShift && meaningNeed
        ? `${stateShift}；${meaningNeed}`
        : stateShift ?? meaningNeed,
    closingInsight,
    joyTrack,
    joyKind: getJoyPsychProfile(primarySnapshot).kind,
    closureTarget,
    supportingMoments: relatedEvents
      .map((event) => sanitizeNullableString(getJoyMoment(event.snapshot) ?? event.snapshot.event))
      .filter((value): value is string => Boolean(value))
      .slice(0, 2),
    directionSignal: sanitizeNullableString(getDirectionSignal(primarySnapshot)),
    valueSignal: sanitizeNullableString(getValueImpact(primarySnapshot)),
    durabilitySignal: sanitizeNullableString(getDurability(primarySnapshot)),
    titleHint: semanticInterpretation.titleTheme ?? anchorScene,
    theorySummary: semanticInterpretation.theorySummary,
    titleTheme: semanticInterpretation.titleTheme,
    titleCandidates: semanticInterpretation.titleCandidates,
    antiFlatteningTargets: semanticInterpretation.antiFlatteningTargets,
    tags: Array.from(new Set(input.sourceEvents.flatMap((event) => getJoyTags(event.snapshot)))).slice(0, 6)
  };
}

function buildDefaultBrief(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
}): DraftBrief {
  const primaryEvent = pickPrimaryEvent(input.session.dimension, input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const relatedEvents = input.sourceEvents.filter((event) => event.id !== primaryEvent?.id);
  const semanticInterpretation = buildDimensionSemanticInterpretation({
    dimension: input.session.dimension,
    snapshot: primarySnapshot,
    sourceEvents: input.sourceEvents,
    activeEvent: primaryEvent
  });

  return {
    dimension: input.session.dimension,
    completionMode: "complete",
    compositionMode: relatedEvents.length ? "stitched_moments" : "single_moment",
    emphasis: "mixed",
    anchorScene: sanitizeNullableString(primarySnapshot.event),
    emotionalCore: sanitizeNullableString(primarySnapshot.whyItMattered),
    stateOrNeed: sanitizeNullableString(primarySnapshot.feeling),
    closingInsight: sanitizeNullableString(primarySnapshot.selfPattern),
    supportingMoments: relatedEvents
      .map((event) => sanitizeNullableString(event.snapshot.event))
      .filter((value): value is string => Boolean(value))
      .slice(0, 2),
    directionSignal: sanitizeNullableString(primarySnapshot.happinessType),
    valueSignal: null,
    durabilitySignal: null,
    titleHint: semanticInterpretation.titleTheme ?? sanitizeNullableString(primarySnapshot.event),
    theorySummary: semanticInterpretation.theorySummary,
    titleTheme: semanticInterpretation.titleTheme,
    titleCandidates: semanticInterpretation.titleCandidates,
    antiFlatteningTargets: semanticInterpretation.antiFlatteningTargets,
    tags: Array.from(new Set(input.sourceEvents.flatMap((event) => [event.snapshot.happinessType, event.snapshot.feeling]))).filter(
      (value): value is string => Boolean(value)
    ).slice(0, 6)
  };
}

function hasFulfillmentValueSignal(snapshot: JoySnapshot) {
  return Boolean(sanitizeNullableString(snapshot.selfPattern));
}

function resolveFulfillmentCompletionMode(session: InterviewSessionRecord, sourceEvents: InterviewEventRecord[]): DraftCompletionMode {
  if (sourceEvents.some((event) => hasFulfillmentValueSignal(event.snapshot)) || hasFulfillmentValueSignal(session.snapshot)) {
    return "complete";
  }

  return "user_override_partial";
}

function buildFulfillmentBrief(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  completionMode: DraftCompletionMode;
}): DraftBrief {
  const primaryEvent = pickPrimaryEvent("fulfillment", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const relatedEvents = input.sourceEvents.filter((event) => event.id !== primaryEvent?.id);
  const semanticInterpretation = buildDimensionSemanticInterpretation({
    dimension: "fulfillment",
    snapshot: primarySnapshot,
    sourceEvents: input.sourceEvents,
    activeEvent: primaryEvent
  });
  const tags = Array.from(
    new Set(input.sourceEvents.flatMap((event) => [event.snapshot.happinessType, event.snapshot.feeling]))
  ).filter((value): value is string => Boolean(value)).slice(0, 6);

  return {
    dimension: "fulfillment",
    completionMode: input.completionMode,
    compositionMode: relatedEvents.length ? "stitched_moments" : "single_moment",
    emphasis: "meaning",
    anchorScene: sanitizeNullableString(primarySnapshot.event),
    emotionalCore: sanitizeNullableString(primarySnapshot.whyItMattered),
    stateOrNeed: sanitizeNullableString(primarySnapshot.feeling),
    closingInsight:
      input.completionMode === "complete" ? sanitizeNullableString(primarySnapshot.selfPattern) : null,
    supportingMoments: relatedEvents
      .map((event) => sanitizeNullableString(event.snapshot.event))
      .filter((value): value is string => Boolean(value))
      .slice(0, 2),
    directionSignal: sanitizeNullableString(primarySnapshot.happinessType),
    valueSignal: sanitizeNullableString(primarySnapshot.selfPattern),
    durabilitySignal: null,
    titleHint: semanticInterpretation.titleTheme ?? sanitizeNullableString(primarySnapshot.event),
    theorySummary: semanticInterpretation.theorySummary,
    titleTheme: semanticInterpretation.titleTheme,
    titleCandidates: semanticInterpretation.titleCandidates,
    antiFlatteningTargets: semanticInterpretation.antiFlatteningTargets,
    tags
  };
}

function hasReflectionViewpointShift(snapshot: JoySnapshot) {
  return Boolean(sanitizeNullableString(snapshot.selfPattern));
}

function resolveReflectionCompletionMode(session: InterviewSessionRecord, sourceEvents: InterviewEventRecord[]): DraftCompletionMode {
  if (sourceEvents.some((event) => hasReflectionViewpointShift(event.snapshot)) || hasReflectionViewpointShift(session.snapshot)) {
    return "complete";
  }

  return "user_override_partial";
}

function buildReflectionBrief(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  completionMode: DraftCompletionMode;
}): DraftBrief {
  const primaryEvent = pickPrimaryEvent("reflection", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const relatedEvents = input.sourceEvents.filter((event) => event.id !== primaryEvent?.id);
  const semanticInterpretation = buildDimensionSemanticInterpretation({
    dimension: "reflection",
    snapshot: primarySnapshot,
    sourceEvents: input.sourceEvents,
    activeEvent: primaryEvent
  });
  const tags = Array.from(
    new Set(input.sourceEvents.flatMap((event) => [event.snapshot.happinessType, event.snapshot.feeling]))
  ).filter((value): value is string => Boolean(value)).slice(0, 6);

  return {
    dimension: "reflection",
    completionMode: input.completionMode,
    compositionMode: relatedEvents.length ? "stitched_moments" : "single_moment",
    emphasis: "meaning",
    anchorScene: sanitizeNullableString(primarySnapshot.event),
    emotionalCore: sanitizeNullableString(primarySnapshot.whyItMattered),
    stateOrNeed: sanitizeNullableString(primarySnapshot.feeling),
    closingInsight:
      input.completionMode === "complete" ? sanitizeNullableString(primarySnapshot.selfPattern) : null,
    supportingMoments: relatedEvents
      .map((event) => sanitizeNullableString(event.snapshot.event))
      .filter((value): value is string => Boolean(value))
      .slice(0, 2),
    directionSignal: sanitizeNullableString(primarySnapshot.happinessType),
    valueSignal: sanitizeNullableString(primarySnapshot.selfPattern),
    durabilitySignal: null,
    titleHint: semanticInterpretation.titleTheme ?? sanitizeNullableString(primarySnapshot.whyItMattered ?? primarySnapshot.event),
    theorySummary: semanticInterpretation.theorySummary,
    titleTheme: semanticInterpretation.titleTheme,
    titleCandidates: semanticInterpretation.titleCandidates,
    antiFlatteningTargets: semanticInterpretation.antiFlatteningTargets,
    tags
  };
}

function getImprovementCore(snapshot: JoySnapshot) {
  return snapshot.improvementTrack === "repeat_good"
    ? sanitizeNullableString(snapshot.repeatCondition)
    : snapshot.improvementTrack === "avoid_bad"
      ? sanitizeNullableString(snapshot.frictionPoint ?? snapshot.whyItMattered)
      : sanitizeNullableString(snapshot.frictionPoint ?? snapshot.repeatCondition ?? snapshot.whyItMattered);
}

function hasImprovementCore(snapshot: JoySnapshot) {
  return Boolean(getImprovementCore(snapshot));
}

function hasCompleteImprovementSnapshot(snapshot: JoySnapshot) {
  return Boolean(
    sanitizeNullableString(snapshot.event) &&
      snapshot.improvementTrack &&
      sanitizeNullableString(snapshot.stateAssessment) &&
      hasImprovementCore(snapshot) &&
      sanitizeNullableString(snapshot.controllableFactor) &&
      sanitizeNullableString(snapshot.nextAttempt ?? snapshot.selfPattern)
  );
}

export function resolveImprovementCompletionMode(
  session: InterviewSessionRecord,
  sourceEvents: InterviewEventRecord[]
): DraftCompletionMode {
  if (session.pendingDecision?.kind === "event_complete" && session.pendingDecision.completionMode) {
    return session.pendingDecision.completionMode;
  }

  if (sourceEvents.some((event) => hasCompleteImprovementSnapshot(event.snapshot)) || hasCompleteImprovementSnapshot(session.snapshot)) {
    return "complete";
  }

  return "user_override_partial";
}

export function buildImprovementBrief(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  completionMode: DraftCompletionMode;
}): DraftBrief {
  const primaryEvent = pickPrimaryEvent("improvement", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const relatedEvents = input.sourceEvents.filter((event) => event.id !== primaryEvent?.id);
  const frictionPoint = sanitizeNullableString(primarySnapshot.frictionPoint ?? primarySnapshot.whyItMattered);
  const repeatCondition = sanitizeNullableString(primarySnapshot.repeatCondition);
  const controllableFactor = sanitizeNullableString(primarySnapshot.controllableFactor);
  const nextAttempt = sanitizeNullableString(primarySnapshot.nextAttempt ?? primarySnapshot.selfPattern);
  const successSignal = sanitizeNullableString(primarySnapshot.successSignal);
  const tags = Array.from(
    new Set(input.sourceEvents.flatMap((event) => [event.snapshot.happinessType, event.snapshot.feeling, ...(event.snapshot.tags ?? [])]))
  ).filter((value): value is string => Boolean(value)).slice(0, 6);
  const semanticInterpretation = buildDimensionSemanticInterpretation({
    dimension: "improvement",
    snapshot: primarySnapshot,
    sourceEvents: input.sourceEvents,
    activeEvent: primaryEvent
  });
  const emotionalCore =
    primarySnapshot.improvementTrack === "repeat_good"
      ? repeatCondition ?? frictionPoint
      : primarySnapshot.improvementTrack === "avoid_bad"
        ? frictionPoint ?? repeatCondition
        : frictionPoint ?? repeatCondition;

  return {
    dimension: "improvement",
    completionMode: input.completionMode,
    compositionMode: relatedEvents.length ? "stitched_moments" : "single_moment",
    emphasis: "meaning",
    anchorScene: sanitizeNullableString(primarySnapshot.event),
    emotionalCore,
    stateOrNeed: sanitizeNullableString(primarySnapshot.stateAssessment ?? primarySnapshot.feeling),
    closingInsight: input.completionMode === "complete" ? nextAttempt : null,
    improvementTrack: primarySnapshot.improvementTrack ?? null,
    frictionPoint,
    repeatCondition,
    controllableFactor,
    nextAttempt: input.completionMode === "complete" ? nextAttempt : null,
    successSignal,
    supportingMoments: relatedEvents
      .map((event) => sanitizeNullableString(event.snapshot.event))
      .filter((value): value is string => Boolean(value))
      .slice(0, 2),
    directionSignal: sanitizeNullableString(primarySnapshot.happinessType),
    valueSignal: controllableFactor,
    durabilitySignal: successSignal,
    titleHint: semanticInterpretation.titleTheme ?? controllableFactor ?? nextAttempt ?? emotionalCore ?? sanitizeNullableString(primarySnapshot.event),
    theorySummary: semanticInterpretation.theorySummary,
    titleTheme: semanticInterpretation.titleTheme,
    titleCandidates: semanticInterpretation.titleCandidates,
    antiFlatteningTargets: semanticInterpretation.antiFlatteningTargets,
    tags
  };
}

function hasGratitudeRelationshipSignal(snapshot: JoySnapshot) {
  return Boolean(sanitizeNullableString(snapshot.relationshipSignal ?? snapshot.selfPattern));
}

function resolveGratitudeCompletionMode(session: InterviewSessionRecord, sourceEvents: InterviewEventRecord[]): DraftCompletionMode {
  if (session.pendingDecision?.kind === "event_complete" && session.pendingDecision.completionMode) {
    return session.pendingDecision.completionMode;
  }

  if (sourceEvents.some((event) => hasGratitudeRelationshipSignal(event.snapshot)) || hasGratitudeRelationshipSignal(session.snapshot)) {
    return "complete";
  }

  return "user_override_partial";
}

function buildGratitudeBrief(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  completionMode: DraftCompletionMode;
}): DraftBrief {
  const primaryEvent = pickPrimaryEvent("gratitude", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const relatedEvents = input.sourceEvents.filter((event) => event.id !== primaryEvent?.id);
  const gratitudeMoment = sanitizeNullableString(primarySnapshot.gratitudeMoment ?? primarySnapshot.event);
  const kindAction = sanitizeNullableString(primarySnapshot.kindAction ?? primarySnapshot.whyItMattered);
  const seenNeed = sanitizeNullableString(primarySnapshot.seenNeed);
  const innerEffect = sanitizeNullableString(primarySnapshot.innerEffect ?? primarySnapshot.feeling);
  const gratitudeReason = sanitizeNullableString(primarySnapshot.gratitudeReason ?? primarySnapshot.whyItMattered);
  const relationshipSignal = sanitizeNullableString(primarySnapshot.relationshipSignal ?? primarySnapshot.selfPattern);
  const reciprocityHint = sanitizeNullableString(primarySnapshot.reciprocityHint);
  const semanticInterpretation = buildDimensionSemanticInterpretation({
    dimension: "gratitude",
    snapshot: primarySnapshot,
    sourceEvents: input.sourceEvents,
    activeEvent: primaryEvent
  });
  const tags = Array.from(
    new Set(input.sourceEvents.flatMap((event) => [
      event.snapshot.gratitudeType ?? event.snapshot.happinessType,
      event.snapshot.innerEffect ?? event.snapshot.feeling,
      ...(event.snapshot.tags ?? [])
    ]))
  ).filter((value): value is string => Boolean(value)).slice(0, 6);

  return {
    dimension: "gratitude",
    completionMode: input.completionMode,
    compositionMode: relatedEvents.length ? "stitched_moments" : "single_moment",
    emphasis: "meaning",
    anchorScene: gratitudeMoment,
    emotionalCore: kindAction ?? gratitudeReason,
    stateOrNeed: seenNeed ?? innerEffect,
    closingInsight: input.completionMode === "complete" ? relationshipSignal : null,
    supportingMoments: relatedEvents
      .map((event) => sanitizeNullableString(event.snapshot.gratitudeMoment ?? event.snapshot.event))
      .filter((value): value is string => Boolean(value))
      .slice(0, 2),
    directionSignal: sanitizeNullableString(primarySnapshot.gratitudeType ?? primarySnapshot.happinessType),
    valueSignal: sanitizeNullableString(primarySnapshot.gratitudeTarget),
    durabilitySignal: reciprocityHint,
    titleHint: semanticInterpretation.titleTheme ?? seenNeed ?? kindAction ?? relationshipSignal ?? gratitudeMoment,
    theorySummary: semanticInterpretation.theorySummary,
    titleTheme: semanticInterpretation.titleTheme,
    titleCandidates: semanticInterpretation.titleCandidates,
    antiFlatteningTargets: semanticInterpretation.antiFlatteningTargets,
    tags
  };
}

export function resolveDraftCompletionMode(session: InterviewSessionRecord, sourceEvents: InterviewEventRecord[]) {
  if (session.dimension === "joy") {
    return resolveJoyCompletionMode(session, sourceEvents);
  }

  if (session.dimension === "fulfillment") {
    return resolveFulfillmentCompletionMode(session, sourceEvents);
  }

  if (session.dimension === "reflection") {
    return resolveReflectionCompletionMode(session, sourceEvents);
  }

  if (session.dimension === "improvement") {
    return resolveImprovementCompletionMode(session, sourceEvents);
  }

  if (session.dimension === "gratitude") {
    return resolveGratitudeCompletionMode(session, sourceEvents);
  }

  return "complete" as const;
}

export function buildDraftBrief(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  completionMode?: DraftCompletionMode;
}) {
  const completionMode = input.completionMode ?? resolveDraftCompletionMode(input.session, input.sourceEvents);

  if (input.session.dimension === "joy") {
    return buildJoyBrief({
      session: input.session,
      sourceEvents: input.sourceEvents,
      completionMode
    });
  }

  if (input.session.dimension === "fulfillment") {
    return buildFulfillmentBrief({
      session: input.session,
      sourceEvents: input.sourceEvents,
      completionMode
    });
  }

  if (input.session.dimension === "reflection") {
    return buildReflectionBrief({
      session: input.session,
      sourceEvents: input.sourceEvents,
      completionMode
    });
  }

  if (input.session.dimension === "improvement") {
    return buildImprovementBrief({
      session: input.session,
      sourceEvents: input.sourceEvents,
      completionMode
    });
  }

  if (input.session.dimension === "gratitude") {
    return buildGratitudeBrief({
      session: input.session,
      sourceEvents: input.sourceEvents,
      completionMode
    });
  }

  return buildDefaultBrief({
    session: input.session,
    sourceEvents: input.sourceEvents
  });
}

export function buildDraftWritingProfile(input: { brief: DraftBrief }): DraftWritingProfile {
  const closingMode = input.brief.completionMode === "complete" ? "stable_clue" : "current_understanding";
  const toneBanSet =
    input.brief.dimension === "joy"
      ? [...BASE_TONE_BAN_SET, ...JOY_TONE_BAN_SET]
      : input.brief.dimension === "fulfillment"
        ? [...BASE_TONE_BAN_SET, ...FULFILLMENT_TONE_BAN_SET]
        : input.brief.dimension === "reflection"
          ? [...BASE_TONE_BAN_SET, ...REFLECTION_TONE_BAN_SET]
          : input.brief.dimension === "improvement"
            ? [...BASE_TONE_BAN_SET, ...IMPROVEMENT_TONE_BAN_SET]
            : input.brief.dimension === "gratitude"
              ? [...BASE_TONE_BAN_SET, ...GRATITUDE_TONE_BAN_SET]
              : [...BASE_TONE_BAN_SET];

  return {
    voiceMode: "journal",
    narrativeOrder: "scene_core_shift_close",
    closingMode,
    toneBanSet
  };
}

function buildJoyMomentSequence(brief: DraftBrief, snapshot: JoySnapshot) {
  return Array.from(
    new Set(
      [sanitizeNullableString(getJoyMoment(snapshot) ?? snapshot.event), ...brief.supportingMoments.map(sanitizeNullableString)]
        .filter((value): value is string => Boolean(value))
        .map((value) => trimTrailingPunctuation(value))
    )
  ).slice(0, 3);
}

function buildJoyOpeningSentence(input: { brief: DraftBrief; snapshot: JoySnapshot }) {
  const moments = buildJoyMomentSequence(input.brief, input.snapshot);

  if (moments.length >= 3) {
    return `今天有几个片段都还留在我心里。先是${moments[0]}，后来是${moments[1]}，${moments[2]}也一直没有散掉。`;
  }

  if (moments.length === 2) {
    return `今天有两个片段一直留在我心里。先是${moments[0]}，后来是${moments[1]}。`;
  }

  if (moments.length === 1) {
    return `今天最想记下来的，是${moments[0]}。`;
  }

  return "今天最想记下来的，是那个让我慢慢松下来的片刻。";
}

function buildJoyCoreSentence(input: { brief: DraftBrief; snapshot: JoySnapshot }) {
  const emotionalCore = sanitizeNullableString(getJoySource(input.snapshot) ?? input.snapshot.whyItMattered);
  const momentCount = buildJoyMomentSequence(input.brief, input.snapshot).length;

  if (!emotionalCore) {
    return null;
  }

  return momentCount > 1
    ? `它们真正打动我的地方其实很像，都是${trimTrailingPunctuation(emotionalCore)}。`
    : `真正让我开心的，不只是事情本身，而是${trimTrailingPunctuation(emotionalCore)}。`;
}

function buildJoyStateSentence(snapshot: JoySnapshot) {
  const stateShift = sanitizeNullableString(getStateShift(snapshot));
  const meaningNeed = sanitizeNullableString(getMeaningNeed(snapshot));
  const joyTrack = getJoyTrack(snapshot);

  if (joyTrack === "meaning_track" && stateShift && meaningNeed) {
    return `那一刻我不只是变得${trimTrailingPunctuation(stateShift)}，也更能感觉到自己其实很在意${trimTrailingPunctuation(meaningNeed)}。`;
  }

  if (stateShift) {
    return `那一刻我明显变得${trimTrailingPunctuation(stateShift)}。`;
  }

  if (joyTrack === "meaning_track" && meaningNeed) {
    return `回头看，这件事之所以有分量，也是因为它碰到了我在意的${trimTrailingPunctuation(meaningNeed)}。`;
  }

  return null;
}

function buildJoyCompleteClosing(snapshot: JoySnapshot) {
  const joyTrack = getJoyTrack(snapshot);
  const manualClue = sanitizeNullableString(getManualClue(snapshot));
  const delightSignature = sanitizeNullableString(getDelightSignature(snapshot));
  const directionSignal = sanitizeNullableString(getDirectionSignal(snapshot));
  const valueSignal = sanitizeNullableString(getValueImpact(snapshot));
  const durabilitySignal = sanitizeNullableString(getDurability(snapshot));

  if (joyTrack === "delight_track" && delightSignature) {
    return `回头看，我也更知道，${trimTrailingPunctuation(delightSignature)}。`;
  }

  if (manualClue) {
    return `原来，${trimTrailingPunctuation(manualClue)}。`;
  }

  if (directionSignal) {
    return `这种开心也会让我更愿意把心往${trimTrailingPunctuation(directionSignal)}那里放。`;
  }

  if (valueSignal) {
    return `我也会更看重那种${trimTrailingPunctuation(valueSignal)}带来的满足。`;
  }

  if (durabilitySignal) {
    return `难怪这份开心会在心里留这么久。`;
  }

  return "这种会让我慢慢回到好状态的片刻，我还是想继续记住。";
}

function buildJoyPartialClosing(snapshot: JoySnapshot) {
  const joyTrack = getJoyTrack(snapshot);
  const meaningNeed = sanitizeNullableString(getMeaningNeed(snapshot));
  const emotionalCore = sanitizeNullableString(getJoySource(snapshot) ?? snapshot.whyItMattered);
  const delightSignature = sanitizeNullableString(getDelightSignature(snapshot));
  const directionSignal = sanitizeNullableString(getDirectionSignal(snapshot));
  const valueSignal = sanitizeNullableString(getValueImpact(snapshot));
  const stateShift = sanitizeNullableString(getStateShift(snapshot));

  if (joyTrack === "delight_track" && delightSignature) {
    return `我现在更知道，${trimTrailingPunctuation(delightSignature)}。`;
  }

  if (joyTrack === "delight_track" && emotionalCore) {
    return `我现在更知道，自己会被${trimTrailingPunctuation(emotionalCore)}这种感觉轻轻带动。`;
  }

  if (meaningNeed) {
    return `我现在更知道，自己其实很在意${trimTrailingPunctuation(meaningNeed)}。`;
  }

  if (emotionalCore) {
    return `我现在更知道，真正会让我有感觉的，还是${trimTrailingPunctuation(emotionalCore)}。`;
  }

  if (directionSignal) {
    return `我现在更知道，自己会被${trimTrailingPunctuation(directionSignal)}这样的方向轻轻打动。`;
  }

  if (valueSignal) {
    return `我现在更知道，自己会被${trimTrailingPunctuation(valueSignal)}这样的感觉打动。`;
  }

  if (stateShift) {
    return `我现在更想记住的，是这种会让我慢慢变得${trimTrailingPunctuation(stateShift)}的时刻。`;
  }

  return "我现在更想记住的，是自己也会被这种片刻轻轻接住。";
}

function buildJoyFallbackContent(input: {
  brief: DraftBrief;
  snapshot: JoySnapshot;
}) {
  const lines = [
    buildJoyOpeningSentence(input),
    formatTheorySummarySentence(input.brief) ?? buildJoyCoreSentence(input),
    buildJoyStateSentence(input.snapshot),
    input.brief.completionMode === "complete"
      ? buildJoyCompleteClosing(input.snapshot)
      : buildJoyPartialClosing(input.snapshot)
  ];

  return lines.filter(Boolean).join("\n\n");
}

function buildFulfillmentOpeningSentence(snapshot: JoySnapshot) {
  const experience = sanitizeNullableString(snapshot.event);

  return experience
    ? `今天最让我觉得不算白过的，是${trimTrailingPunctuation(experience)}。`
    : "今天最让我觉得不算白过的，是有一件事真的往前走了一点。";
}

function buildFulfillmentProgressSentence(snapshot: JoySnapshot) {
  const progressEvidence = sanitizeNullableString(snapshot.whyItMattered);

  return progressEvidence
    ? `这件事真正有分量的地方，是${trimTrailingPunctuation(progressEvidence)}。`
    : null;
}

function buildFulfillmentStateSentence(snapshot: JoySnapshot) {
  const feeling = sanitizeNullableString(snapshot.feeling);
  const fulfillmentType = sanitizeNullableString(snapshot.happinessType);

  if (feeling && fulfillmentType) {
    return `做完之后，我心里多了一点${trimTrailingPunctuation(feeling)}，这种充实更接近${trimTrailingPunctuation(fulfillmentType)}。`;
  }

  if (feeling) {
    return `做完之后，我心里多了一点${trimTrailingPunctuation(feeling)}。`;
  }

  if (fulfillmentType) {
    return `它给我的充实感，更接近${trimTrailingPunctuation(fulfillmentType)}。`;
  }

  return null;
}

function buildFulfillmentClosingSentence(input: {
  brief: DraftBrief;
  snapshot: JoySnapshot;
}) {
  const valueSignal = sanitizeNullableString(input.snapshot.selfPattern);
  const progressEvidence = sanitizeNullableString(input.snapshot.whyItMattered);

  if (input.brief.completionMode === "complete" && valueSignal) {
    return `回头看，我也更知道，对我来说，${trimTrailingPunctuation(valueSignal)}才会真正算数。`;
  }

  if (progressEvidence) {
    return `至少这件事让我确认，今天不是空转的一天。`;
  }

  return "至少今天不是完全空转的一天，我能看到自己确实往前走了一点。";
}

function buildFulfillmentFallbackContent(input: {
  brief: DraftBrief;
  snapshot: JoySnapshot;
}) {
  const lines = [
    buildFulfillmentOpeningSentence(input.snapshot),
    formatTheorySummarySentence(input.brief) ?? buildFulfillmentProgressSentence(input.snapshot),
    buildFulfillmentStateSentence(input.snapshot),
    buildFulfillmentClosingSentence(input)
  ];

  return lines.filter(Boolean).join("\n\n");
}

function createFulfillmentFallbackDraft(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  eventBlocks: JoyEventBlock[];
  brief: DraftBrief;
}): JoyEntryDraft {
  const primaryEvent = pickPrimaryEvent("fulfillment", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const config = getInterviewDimensionConfig("fulfillment");
  const title = buildSemanticJournalTitle({
    dimension: "fulfillment",
    snapshot: primarySnapshot,
    draftBrief: input.brief,
    fallbackTitle: config.draftTitlePrefix
  });

  return {
    title,
    content: buildFulfillmentFallbackContent({
      brief: input.brief,
      snapshot: primarySnapshot
    }),
    event: sanitizeNullableString(primarySnapshot.event),
    feeling: sanitizeNullableString(primarySnapshot.feeling),
    whyItMattered: sanitizeNullableString(primarySnapshot.whyItMattered),
    happinessType: sanitizeNullableString(primarySnapshot.happinessType),
    selfPattern:
      input.brief.completionMode === "complete"
        ? sanitizeNullableString(primarySnapshot.selfPattern)
        : null,
    tags: input.brief.tags,
    eventBlocks: input.eventBlocks,
    source: "ai_draft_direct"
  };
}

function buildReflectionOpeningSentence(snapshot: JoySnapshot) {
  const trigger = sanitizeNullableString(snapshot.event);

  return trigger
    ? `今天让我停下来想了一下的，是${trimTrailingPunctuation(trigger)}。`
    : "今天有一个片段让我停下来多想了一层。";
}

function buildReflectionInsightSentence(snapshot: JoySnapshot) {
  const insight = sanitizeNullableString(snapshot.whyItMattered);

  return insight ? `它让我看见，${trimTrailingPunctuation(insight)}。` : null;
}

function buildReflectionStateSentence(snapshot: JoySnapshot) {
  const feeling = sanitizeNullableString(snapshot.feeling);
  const reflectionType = sanitizeNullableString(snapshot.happinessType);

  if (feeling && reflectionType) {
    return `当时的感觉有点${trimTrailingPunctuation(feeling)}，这次思考更接近${trimTrailingPunctuation(reflectionType)}。`;
  }

  if (feeling) {
    return `当时的感觉有点${trimTrailingPunctuation(feeling)}。`;
  }

  if (reflectionType) {
    return `这次思考更接近${trimTrailingPunctuation(reflectionType)}。`;
  }

  return null;
}

function buildReflectionClosingSentence(input: {
  brief: DraftBrief;
  snapshot: JoySnapshot;
}) {
  const viewpointShift = sanitizeNullableString(input.snapshot.selfPattern);
  const insight = sanitizeNullableString(input.snapshot.whyItMattered);

  if (input.brief.completionMode === "complete" && viewpointShift) {
    return `以后再判断类似事情时，我会多带着这条线索：${trimTrailingPunctuation(viewpointShift)}。`;
  }

  if (insight) {
    return "现在它还不是一个稳定结论，但已经让我多了一层判断依据。";
  }

  return "这件事还没完全想透，但它至少把一个值得继续看的问题留了下来。";
}

function buildReflectionFallbackContent(input: {
  brief: DraftBrief;
  snapshot: JoySnapshot;
}) {
  const lines = [
    buildReflectionOpeningSentence(input.snapshot),
    formatTheorySummarySentence(input.brief) ?? buildReflectionInsightSentence(input.snapshot),
    buildReflectionStateSentence(input.snapshot),
    buildReflectionClosingSentence(input)
  ];

  return lines.filter(Boolean).join("\n\n");
}

function createReflectionFallbackDraft(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  eventBlocks: JoyEventBlock[];
  brief: DraftBrief;
}): JoyEntryDraft {
  const primaryEvent = pickPrimaryEvent("reflection", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const config = getInterviewDimensionConfig("reflection");
  const title = buildSemanticJournalTitle({
    dimension: "reflection",
    snapshot: primarySnapshot,
    draftBrief: input.brief,
    fallbackTitle: config.draftTitlePrefix
  });

  return {
    title,
    content: buildReflectionFallbackContent({
      brief: input.brief,
      snapshot: primarySnapshot
    }),
    event: sanitizeNullableString(primarySnapshot.event),
    feeling: sanitizeNullableString(primarySnapshot.feeling),
    whyItMattered: sanitizeNullableString(primarySnapshot.whyItMattered),
    happinessType: sanitizeNullableString(primarySnapshot.happinessType),
    selfPattern:
      input.brief.completionMode === "complete"
        ? sanitizeNullableString(primarySnapshot.selfPattern)
        : null,
    tags: input.brief.tags,
    eventBlocks: input.eventBlocks,
    source: "ai_draft_direct"
  };
}

function buildImprovementOpeningSentence(snapshot: JoySnapshot) {
  const situation = sanitizeNullableString(snapshot.event);

  return situation
    ? `今天最想回头看一眼的，是${trimTrailingPunctuation(situation)}。`
    : "今天有一个片段，让我觉得下次可以稍微调整得更稳一点。";
}

function buildImprovementStateSentence(snapshot: JoySnapshot) {
  const stateAssessment = sanitizeNullableString(snapshot.stateAssessment);
  const feeling = sanitizeNullableString(snapshot.feeling);

  if (stateAssessment && feeling) {
    return `当时的状态有点${trimTrailingPunctuation(feeling)}，回头看，不理想或值得保留的地方是${trimTrailingPunctuation(stateAssessment)}。`;
  }

  if (stateAssessment) {
    return `回头看，当时最值得记录的状态判断是${trimTrailingPunctuation(stateAssessment)}。`;
  }

  if (feeling) {
    return `当时的感觉有点${trimTrailingPunctuation(feeling)}。`;
  }

  return null;
}

function buildImprovementCoreSentence(snapshot: JoySnapshot) {
  const frictionPoint = sanitizeNullableString(snapshot.frictionPoint ?? snapshot.whyItMattered);
  const repeatCondition = sanitizeNullableString(snapshot.repeatCondition);

  if (snapshot.improvementTrack === "repeat_good" && repeatCondition) {
    return `这次之所以比较顺，关键条件可能是${trimTrailingPunctuation(repeatCondition)}。`;
  }

  if (snapshot.improvementTrack === "avoid_bad" && frictionPoint) {
    return `真正卡住我的地方，是${trimTrailingPunctuation(frictionPoint)}。`;
  }

  if (repeatCondition) {
    return `这次值得重复的条件，是${trimTrailingPunctuation(repeatCondition)}。`;
  }

  if (frictionPoint) {
    return `这次真正需要看见的卡点，是${trimTrailingPunctuation(frictionPoint)}。`;
  }

  return null;
}

function buildImprovementControlSentence(snapshot: JoySnapshot) {
  const controllableFactor = sanitizeNullableString(snapshot.controllableFactor);

  return controllableFactor
    ? `现在能抓住的可控点很小，就是${trimTrailingPunctuation(controllableFactor)}。`
    : null;
}

function buildImprovementClosingSentence(input: {
  brief: DraftBrief;
  snapshot: JoySnapshot;
}) {
  const nextAttempt = sanitizeNullableString(input.snapshot.nextAttempt ?? input.snapshot.selfPattern);
  const successSignal = sanitizeNullableString(input.snapshot.successSignal);
  const controllableFactor = sanitizeNullableString(input.snapshot.controllableFactor);
  const core = getImprovementCore(input.snapshot);

  if (input.brief.completionMode === "complete" && nextAttempt) {
    return successSignal
      ? `下次我想先试试${trimTrailingPunctuation(nextAttempt)}。如果${trimTrailingPunctuation(successSignal)}，就说明比这次稳了一点。`
      : `下次我想先试试${trimTrailingPunctuation(nextAttempt)}，先把这一小步做出来。`;
  }

  if (controllableFactor) {
    return `先停在这里就够了：这件事让我看见，${trimTrailingPunctuation(controllableFactor)}是一个可以调整的地方。`;
  }

  if (core) {
    return `先停在这里就够了：这件事让我看见，${trimTrailingPunctuation(core)}是下一次可以继续留意的地方。`;
  }

  return "先停在这里就够了：这件事让我看见，下次可以从一个很小的地方开始调整。";
}

function buildImprovementFallbackContent(input: {
  brief: DraftBrief;
  snapshot: JoySnapshot;
}) {
  const lines = [
    buildImprovementOpeningSentence(input.snapshot),
    buildImprovementStateSentence(input.snapshot),
    formatTheorySummarySentence(input.brief) ?? buildImprovementCoreSentence(input.snapshot),
    buildImprovementControlSentence(input.snapshot),
    buildImprovementClosingSentence(input)
  ];

  return lines.filter(Boolean).join("\n\n");
}

function createImprovementFallbackDraft(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  eventBlocks: JoyEventBlock[];
  brief: DraftBrief;
}): JoyEntryDraft {
  const primaryEvent = pickPrimaryEvent("improvement", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const config = getInterviewDimensionConfig("improvement");
  const nextAttempt =
    input.brief.completionMode === "complete"
      ? sanitizeNullableString(primarySnapshot.nextAttempt ?? primarySnapshot.selfPattern)
      : null;
  const title = buildSemanticJournalTitle({
    dimension: "improvement",
    snapshot: primarySnapshot,
    draftBrief: input.brief,
    fallbackTitle: config.draftTitlePrefix
  });

  return {
    title,
    content: buildImprovementFallbackContent({
      brief: input.brief,
      snapshot: primarySnapshot
    }),
    event: sanitizeNullableString(primarySnapshot.event),
    feeling: sanitizeNullableString(primarySnapshot.feeling),
    whyItMattered: sanitizeNullableString(primarySnapshot.frictionPoint ?? primarySnapshot.repeatCondition ?? primarySnapshot.whyItMattered),
    happinessType: sanitizeNullableString(primarySnapshot.happinessType),
    selfPattern: nextAttempt,
    improvementTrack: primarySnapshot.improvementTrack ?? null,
    stateAssessment: sanitizeNullableString(primarySnapshot.stateAssessment),
    frictionPoint: sanitizeNullableString(primarySnapshot.frictionPoint ?? primarySnapshot.whyItMattered),
    repeatCondition: sanitizeNullableString(primarySnapshot.repeatCondition),
    controllableFactor: sanitizeNullableString(primarySnapshot.controllableFactor),
    nextAttempt,
    successSignal: sanitizeNullableString(primarySnapshot.successSignal),
    tags: input.brief.tags,
    eventBlocks: input.eventBlocks,
    source: "ai_draft_direct"
  };
}

function buildGratitudeOpeningSentence(snapshot: JoySnapshot) {
  const moment = sanitizeNullableString(snapshot.gratitudeMoment ?? snapshot.event);

  return moment
    ? `今天让我想认真记下来的感谢，是${trimTrailingPunctuation(moment)}。`
    : "今天有一个很小的片段，让我想认真说一声谢谢。";
}

function buildGratitudeActionSentence(snapshot: JoySnapshot) {
  const target = sanitizeNullableString(snapshot.gratitudeTarget);
  const kindAction = sanitizeNullableString(snapshot.kindAction);

  if (target && kindAction) {
    return `我感谢的不是一句泛泛的好意，而是${trimTrailingPunctuation(target)}当时${trimTrailingPunctuation(kindAction)}。`;
  }

  if (kindAction) {
    return `我感谢的不是一句泛泛的好意，而是对方当时${trimTrailingPunctuation(kindAction)}。`;
  }

  return null;
}

function buildGratitudeNeedSentence(snapshot: JoySnapshot) {
  const seenNeed = sanitizeNullableString(snapshot.seenNeed);
  const innerEffect = sanitizeNullableString(snapshot.innerEffect ?? snapshot.feeling);
  const gratitudeReason = sanitizeNullableString(snapshot.gratitudeReason ?? snapshot.whyItMattered);

  if (seenNeed && innerEffect) {
    return `这件事之所以重要，是因为对方像是看见了${trimTrailingPunctuation(seenNeed)}，也让我心里多了一点${trimTrailingPunctuation(innerEffect)}。`;
  }

  if (seenNeed) {
    return `这件事之所以重要，是因为对方像是看见了${trimTrailingPunctuation(seenNeed)}。`;
  }

  if (gratitudeReason) {
    return `这份感谢之所以重要，是因为${trimTrailingPunctuation(gratitudeReason)}。`;
  }

  return null;
}

function buildGratitudeTypeSentence(snapshot: JoySnapshot) {
  const gratitudeType = sanitizeNullableString(snapshot.gratitudeType ?? snapshot.happinessType);

  return gratitudeType ? `这份善意更接近${trimTrailingPunctuation(gratitudeType)}。` : null;
}

function buildGratitudeSupportingParagraph(snapshot: JoySnapshot, index: number) {
  const moment = sanitizeNullableString(snapshot.gratitudeMoment ?? snapshot.event);
  const target = sanitizeNullableString(snapshot.gratitudeTarget);
  const kindAction = sanitizeNullableString(snapshot.kindAction);
  const seenNeed = sanitizeNullableString(snapshot.seenNeed);
  const innerEffect = sanitizeNullableString(snapshot.innerEffect ?? snapshot.feeling);
  const gratitudeReason = sanitizeNullableString(snapshot.gratitudeReason ?? snapshot.whyItMattered);
  const sentences = [
    moment
      ? index === 0
        ? `另外我也想记下，${trimTrailingPunctuation(moment)}。`
        : `还有一个片段也留在我心里：${trimTrailingPunctuation(moment)}。`
      : null,
    target && kindAction
      ? `那时${trimTrailingPunctuation(target)}${trimTrailingPunctuation(kindAction)}。`
      : kindAction
        ? `那时对方${trimTrailingPunctuation(kindAction)}。`
        : null,
    seenNeed && innerEffect
      ? `这份好意也像是看见了${trimTrailingPunctuation(seenNeed)}，让我心里多了一点${trimTrailingPunctuation(innerEffect)}。`
      : seenNeed
        ? `这份好意也像是看见了${trimTrailingPunctuation(seenNeed)}。`
        : gratitudeReason
          ? `它会留在我心里，也是因为${trimTrailingPunctuation(gratitudeReason)}。`
          : null
  ].filter(Boolean);

  return sentences.length ? sentences.join(" ") : null;
}

function buildGratitudeClosingSentence(input: {
  brief: DraftBrief;
  snapshot: JoySnapshot;
}) {
  const relationshipSignal = sanitizeNullableString(input.snapshot.relationshipSignal ?? input.snapshot.selfPattern);
  const gratitudeReason = sanitizeNullableString(input.snapshot.gratitudeReason ?? input.snapshot.whyItMattered);

  if (input.brief.completionMode === "complete" && relationshipSignal) {
    return `回头看，我也更知道，${trimTrailingPunctuation(relationshipSignal)}。`;
  }

  if (gratitudeReason) {
    return "先停在这里也够了：这份感谢已经让我看见，自己当时确实被认真回应过。";
  }

  return "先停在这里也够了：这件小事让我记得，关系里有些善意值得被看见。";
}

function buildGratitudeFallbackContent(input: {
  brief: DraftBrief;
  snapshot: JoySnapshot;
  supportingSnapshots?: JoySnapshot[];
}) {
  const lines = [
    buildGratitudeOpeningSentence(input.snapshot),
    buildGratitudeActionSentence(input.snapshot),
    formatTheorySummarySentence(input.brief) ?? buildGratitudeNeedSentence(input.snapshot),
    buildGratitudeTypeSentence(input.snapshot),
    ...(input.supportingSnapshots ?? []).map((snapshot, index) => buildGratitudeSupportingParagraph(snapshot, index)),
    buildGratitudeClosingSentence(input)
  ];

  return lines.filter(Boolean).join("\n\n");
}

function createGratitudeFallbackDraft(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  eventBlocks: JoyEventBlock[];
  brief: DraftBrief;
}): JoyEntryDraft {
  const primaryEvent = pickPrimaryEvent("gratitude", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const supportingSnapshots = input.sourceEvents
    .filter((event) => event.id !== primaryEvent?.id)
    .map((event) => event.snapshot)
    .filter(
      (snapshot) =>
        Boolean(
          sanitizeNullableString(snapshot.gratitudeMoment ?? snapshot.event) ||
            sanitizeNullableString(snapshot.kindAction) ||
            sanitizeNullableString(snapshot.seenNeed) ||
            sanitizeNullableString(snapshot.gratitudeReason ?? snapshot.whyItMattered)
        )
    )
    .slice(0, 2);
  const config = getInterviewDimensionConfig("gratitude");
  const relationshipSignal =
    input.brief.completionMode === "complete"
      ? sanitizeNullableString(primarySnapshot.relationshipSignal ?? primarySnapshot.selfPattern)
      : null;
  const title = buildSemanticJournalTitle({
    dimension: "gratitude",
    snapshot: primarySnapshot,
    draftBrief: input.brief,
    fallbackTitle: config.draftTitlePrefix
  });

  return {
    title,
    content: buildGratitudeFallbackContent({
      brief: input.brief,
      snapshot: primarySnapshot,
      supportingSnapshots
    }),
    event: sanitizeNullableString(primarySnapshot.gratitudeMoment ?? primarySnapshot.event),
    feeling: sanitizeNullableString(primarySnapshot.innerEffect ?? primarySnapshot.feeling),
    whyItMattered: sanitizeNullableString(primarySnapshot.gratitudeReason ?? primarySnapshot.whyItMattered),
    happinessType: sanitizeNullableString(primarySnapshot.gratitudeType ?? primarySnapshot.happinessType),
    selfPattern: relationshipSignal,
    gratitudeMoment: sanitizeNullableString(primarySnapshot.gratitudeMoment ?? primarySnapshot.event),
    gratitudeTarget: sanitizeNullableString(primarySnapshot.gratitudeTarget),
    kindAction: sanitizeNullableString(primarySnapshot.kindAction),
    seenNeed: sanitizeNullableString(primarySnapshot.seenNeed),
    innerEffect: sanitizeNullableString(primarySnapshot.innerEffect ?? primarySnapshot.feeling),
    gratitudeReason: sanitizeNullableString(primarySnapshot.gratitudeReason ?? primarySnapshot.whyItMattered),
    gratitudeType: sanitizeNullableString(primarySnapshot.gratitudeType ?? primarySnapshot.happinessType),
    relationshipSignal,
    reciprocityHint: sanitizeNullableString(primarySnapshot.reciprocityHint),
    tags: input.brief.tags,
    eventBlocks: input.eventBlocks,
    source: "ai_draft_direct"
  };
}

export function createFallbackDraft(input: {
  session: InterviewSessionRecord;
  sourceEvents: InterviewEventRecord[];
  eventBlocks: JoyEventBlock[];
  brief?: DraftBrief;
  completionMode?: DraftCompletionMode;
}): JoyEntryDraft {
  const brief = input.brief ?? buildDraftBrief({
    session: input.session,
    sourceEvents: input.sourceEvents,
    completionMode: input.completionMode
  });

  if (input.session.dimension === "fulfillment") {
    return createFulfillmentFallbackDraft({
      session: input.session,
      sourceEvents: input.sourceEvents,
      eventBlocks: input.eventBlocks,
      brief
    });
  }

  if (input.session.dimension === "reflection") {
    return createReflectionFallbackDraft({
      session: input.session,
      sourceEvents: input.sourceEvents,
      eventBlocks: input.eventBlocks,
      brief
    });
  }

  if (input.session.dimension === "improvement") {
    return createImprovementFallbackDraft({
      session: input.session,
      sourceEvents: input.sourceEvents,
      eventBlocks: input.eventBlocks,
      brief
    });
  }

  if (input.session.dimension === "gratitude") {
    return createGratitudeFallbackDraft({
      session: input.session,
      sourceEvents: input.sourceEvents,
      eventBlocks: input.eventBlocks,
      brief
    });
  }

  if (input.session.dimension !== "joy") {
    return {
      ...createDraft(input.session.dimension, input.sourceEvents[0]?.snapshot ?? input.session.snapshot),
      eventBlocks: input.eventBlocks
    };
  }

  const primaryEvent = pickPrimaryEvent("joy", input.sourceEvents);
  const primarySnapshot = primaryEvent?.snapshot ?? input.session.snapshot;
  const config = getInterviewDimensionConfig("joy");
  const legacyProjection = getLegacyJoyProjection(primarySnapshot);
  const title = buildSemanticJournalTitle({
    dimension: "joy",
    snapshot: primarySnapshot,
    draftBrief: brief,
    fallbackTitle: config.draftTitlePrefix
  });

  return {
    title,
    content: buildJoyFallbackContent({
      brief,
      snapshot: primarySnapshot
    }),
    event: legacyProjection.event,
    feeling: legacyProjection.feeling,
    whyItMattered: legacyProjection.whyItMattered,
    happinessType: legacyProjection.happinessType,
    selfPattern: legacyProjection.selfPattern,
    joyMoment: sanitizeNullableString(getJoyMoment(primarySnapshot)),
    joySource: sanitizeNullableString(getJoySource(primarySnapshot)),
    stateShift: sanitizeNullableString(getStateShift(primarySnapshot)),
    meaningNeed: sanitizeNullableString(getMeaningNeed(primarySnapshot)),
    manualClue:
      brief.completionMode === "complete" && brief.closureTarget === "manual_clue"
        ? sanitizeNullableString(getManualClue(primarySnapshot))
        : null,
    delightSignature:
      brief.completionMode === "complete" && brief.closureTarget === "delight_signature"
        ? sanitizeNullableString(getDelightSignature(primarySnapshot))
        : null,
    directionSignal: sanitizeNullableString(getDirectionSignal(primarySnapshot)),
    valueImpact: sanitizeNullableString(getValueImpact(primarySnapshot)),
    durability: sanitizeNullableString(getDurability(primarySnapshot)),
    psychProfile: getJoyPsychProfile(primarySnapshot),
    tags: brief.tags,
    eventBlocks: input.eventBlocks,
    source: "ai_draft_direct"
  };
}

export function runDraftQualityGate(input: {
  brief: DraftBrief;
  draft: Pick<JoyEntryDraft, "title" | "content"> &
    Partial<Pick<JoyEntryDraft, "manualClue" | "delightSignature" | "selfPattern" | "nextAttempt">>;
}): DraftQualityGateResult {
  const issues: string[] = [];
  const content = input.draft.content;
  const title = input.draft.title;
  const bannedStructuredTerms = [
    "开心片段",
    "真正开心点",
    "状态变化",
    "在乎或需要",
    "使用说明书线索",
    "manualClue",
    "delightSignature",
    "joyMoment",
    "joySource",
    "stateShift",
    "meaningNeed",
    "directionSignal",
    "valueImpact",
    "durability",
    "充实片段",
    "进展证据",
    "值得感标准",
    "fulfillmentType",
    "progressEvidence",
    "valueSignal",
    "trigger",
    "insight",
    "viewpointShift",
    "reflectionType",
    "触发片段",
    "新发现",
    "核心洞见",
    "视角变化",
    "判断线索",
    "思考类型",
    "improvementTrack",
    "stateAssessment",
    "frictionPoint",
    "repeatCondition",
    "controllableFactor",
    "nextAttempt",
    "successSignal",
    "改进情境",
    "改进路径",
    "状态判断",
    "核心卡点",
    "可重复条件",
    "可控因素",
    "下一次尝试",
    "成功信号",
    "gratitudeMoment",
    "gratitudeTarget",
    "kindAction",
    "seenNeed",
    "innerEffect",
    "gratitudeReason",
    "gratitudeType",
    "relationshipSignal",
    "reciprocityHint",
    "感谢片段",
    "感谢对象",
    "具体善意",
    "被看见的需要",
    "内在影响",
    "感谢类型",
    "关系线索",
    "回馈线索"
  ];

  if (!title.trim() || !content.trim()) {
    issues.push("missing_content");
  }

  if (title.trim().length > MAX_JOURNAL_TITLE_LENGTH) {
    issues.push("title_too_long");
  }

  if (hasGenericTitleRegression(title, input.brief)) {
    issues.push("title_theme_mismatch");
  }

  if (/(?:^|\n)\s*(?:[-*•]|\d+\.)\s/m.test(content)) {
    issues.push("list_format");
  }

  if (hasDuplicateContent(content)) {
    issues.push("duplicate_content");
  }

  if (bannedStructuredTerms.some((term) => content.includes(term))) {
    issues.push("structured_terms");
  }

  if (/(开心片段|真正开心点|状态变化|在乎或需要|使用说明书线索|充实片段|进展证据|值得感标准|触发片段|新发现|核心洞见|视角变化|判断线索|思考类型|改进情境|改进路径|状态判断|核心卡点|可重复条件|可控因素|下一次尝试|成功信号|感谢片段|感谢对象|具体善意|被看见的需要|内在影响|感谢类型|关系线索|回馈线索)\s*[:：]/.test(content)) {
    issues.push("field_labels");
  }

  if (content.includes("使用说明书")) {
    issues.push("system_phrase");
  }

  if (SYSTEM_TONE_PATTERNS.some((pattern) => pattern.test(content))) {
    issues.push("system_tone");
  }

  if (SUMMARY_TONE_PATTERNS.some((pattern) => pattern.test(content))) {
    issues.push("summary_tone");
  }

  if (ADVICE_TONE_PATTERNS.some((pattern) => pattern.test(content))) {
    issues.push("advice_tone");
  }

  if (DELIGHT_SHAMING_PATTERNS.some((pattern) => pattern.test(content))) {
    issues.push("delight_shaming_tone");
  }

  const missingPrimarySceneAnchor = isSceneAnchorMissing(content, input.brief.anchorScene);
  const missingSupportingSceneAnchors =
  input.brief.dimension === "gratitude" && input.brief.compositionMode === "stitched_moments"
      ? input.brief.supportingMoments.some((candidate) => isSupportingSceneAnchorMissing(content, candidate))
      : false;

  if (
    (input.brief.dimension === "joy" || input.brief.dimension === "fulfillment" || input.brief.dimension === "improvement" || input.brief.dimension === "gratitude") &&
    missingPrimarySceneAnchor
  ) {
    issues.push("missing_scene_anchor");
  }

  if (
    (input.brief.dimension === "joy" || input.brief.dimension === "fulfillment" || input.brief.dimension === "improvement" || input.brief.dimension === "gratitude") &&
    missingSupportingSceneAnchors
  ) {
    issues.push("missing_supporting_scene_anchor");
  }

  if (hasGenericCoreRegression(input.brief, content)) {
    issues.push("generic_core_regression");
  }

  if (isParaphraseOnlyDraft(input.brief, content)) {
    issues.push("paraphrase_only_summary");
  }

  if (input.brief.dimension === "joy" && input.brief.joyTrack === "delight_track") {
    if (/(真正热爱|人生方向|说明我最需要|原来我最在意的是|价值观|使命)/u.test(content)) {
      issues.push("false_depth_escalation");
    }

    if (STABLE_RULE_PATTERN.test(content)) {
      issues.push("track_mismatch");
    }
  }

  if (input.brief.dimension === "fulfillment") {
    const hasProgressEvidence = FULFILLMENT_PROGRESS_EVIDENCE_PATTERN.test(content);

    if (FULFILLMENT_REPORT_TONE_PATTERN.test(content)) {
      issues.push("report_tone");
    }

    if (!hasFulfillmentTheoryCore(input.brief, content)) {
      issues.push("missing_theory_core");
    }

    if (FULFILLMENT_BUSY_PATTERN.test(content) && !hasProgressEvidence) {
      issues.push("busy_without_progress");
      issues.push("fulfillment_busy_without_meaning");
    }

    if (FULFILLMENT_SLOGAN_PATTERN.test(content) && !hasProgressEvidence) {
      issues.push("progress_slogan_tone");
    }

    if (FULFILLMENT_DIRECTION_ESCALATION_PATTERN.test(content)) {
      issues.push("fake_direction_escalation");
    }

    if (input.brief.completionMode === "user_override_partial") {
      if (input.draft.selfPattern || FULFILLMENT_FORCED_VALUE_PATTERN.test(content)) {
        issues.push("forced_value_signal");
      }

      if (STABLE_RULE_PATTERN.test(content)) {
        issues.push("partial_fake_rule");
      }
    }
  }

  if (input.brief.dimension === "reflection") {
    if (missingPrimarySceneAnchor) {
      issues.push("missing_scene_anchor");
    }

    if (missingSupportingSceneAnchors) {
      issues.push("missing_supporting_scene_anchor");
    }

    if (!REFLECTION_INSIGHT_PATTERN.test(content)) {
      issues.push("missing_reflection_insight");
    }

    if (REFLECTION_ACTION_PLAN_PATTERN.test(content)) {
      issues.push("action_plan_tone");
    }

    if (REFLECTION_DIAGNOSIS_PATTERN.test(content)) {
      issues.push("diagnosis_tone");
    }

    if (REFLECTION_LIFE_CONCLUSION_PATTERN.test(content)) {
      issues.push("life_conclusion_tone");
    }

    if (input.brief.completionMode === "user_override_partial") {
      if (input.draft.selfPattern || STABLE_RULE_PATTERN.test(content)) {
        issues.push("partial_fake_judgment_clue");
      }
    }
  }

  if (input.brief.dimension === "improvement") {
    const hasCore =
      (input.brief.improvementTrack === "repeat_good" && Boolean(input.brief.repeatCondition)) ||
      (input.brief.improvementTrack === "avoid_bad" && Boolean(input.brief.frictionPoint)) ||
      Boolean(input.brief.frictionPoint || input.brief.repeatCondition || input.brief.emotionalCore);
    const hasControllableFactor = Boolean(input.brief.controllableFactor || input.brief.valueSignal);
    const hasNextAttempt = Boolean(input.brief.nextAttempt || input.brief.closingInsight || input.draft.nextAttempt || input.draft.selfPattern);

    if (!hasCore) {
      issues.push("missing_improvement_core");
    }

    if (IMPROVEMENT_SELF_BLAME_PATTERN.test(content)) {
      issues.push("self_blame_tone");
    }

    if (IMPROVEMENT_EMPTY_ACTION_PATTERN.test(content)) {
      issues.push("empty_action_plan");
    }

    if (IMPROVEMENT_ADVICE_TONE_PATTERN.test(content)) {
      issues.push("advice_tone");
    }

    if (IMPROVEMENT_THERAPY_TONE_PATTERN.test(content)) {
      issues.push("therapy_tone");
    }

    if (IMPROVEMENT_PRODUCTIVITY_TONE_PATTERN.test(content)) {
      issues.push("productivity_report_tone");
    }

    if (input.brief.completionMode === "complete" && IMPROVEMENT_EXTERNAL_BLAME_PATTERN.test(content) && !hasControllableFactor) {
      issues.push("external_blame_without_control");
    }

    if (input.brief.completionMode === "complete" && !hasNextAttempt && /(下次|以后|下一次)/u.test(content)) {
      issues.push("forced_next_attempt");
    }

    if (input.brief.completionMode === "user_override_partial") {
      if (input.draft.selfPattern || input.draft.nextAttempt || IMPROVEMENT_STABLE_PLAN_PATTERN.test(content)) {
        issues.push("partial_fake_plan");
      }

      if (/(下次我想|下一次我想|以后我会|以后我要|我会先试试|我想先试试)/u.test(content)) {
        issues.push("forced_next_attempt");
      }
    }

    if (
      input.brief.improvementTrack === "repeat_good" &&
      /(检讨|反省|问题在我|我太差|我不行|真正卡住)/u.test(content)
    ) {
      issues.push("track_mismatch");
    }

    if (
      input.brief.improvementTrack === "avoid_bad" &&
      !input.brief.repeatCondition &&
      /(这次之所以比较顺|值得重复|可重复条件|继续保持)/u.test(content)
    ) {
      issues.push("track_mismatch");
    }
  }

  if (input.brief.dimension === "gratitude") {
    const hasAction = Boolean(input.brief.emotionalCore || input.draft.content.match(/(帮我|提醒我|陪我|听我|理解|照顾|接住|看见|回应|支持)/u));
    const hasSeenNeed = Boolean(input.brief.stateOrNeed || /(需要|难处|压力|撑不住|被理解|被看见|被接住|不孤单|有人陪|省力|松了一口气)/u.test(content));

    if (!hasAction) {
      issues.push("missing_gratitude_action");
    }

    if (!hasSeenNeed) {
      issues.push("missing_seen_need");
    }

    if (GRATITUDE_THANK_YOU_TEMPLATE_PATTERN.test(content)) {
      issues.push("thank_you_template_tone");
    }

    if (GRATITUDE_DEBT_PATTERN.test(content)) {
      issues.push("moral_debt_tone");
    }

    if (GRATITUDE_ADVICE_PATTERN.test(content)) {
      issues.push("advice_tone");
    }

    if (GRATITUDE_EMPTY_KINDNESS_PATTERN.test(content) && !hasAction) {
      issues.push("empty_kindness_tone");
    }

    if (input.brief.completionMode === "user_override_partial") {
      if (input.draft.selfPattern || STABLE_RULE_PATTERN.test(content) || /值得珍惜的关系|我更知道.*关系/u.test(content)) {
        issues.push("partial_fake_relationship_signal");
      }
    }
  }

  if (
    input.brief.dimension === "joy" &&
    input.brief.joyTrack === "meaning_track" &&
    input.brief.completionMode === "complete" &&
    !input.draft.manualClue
  ) {
    issues.push("track_mismatch");
  }

  if (
    input.brief.dimension === "joy" &&
    input.brief.joyTrack === "delight_track" &&
    input.brief.completionMode === "complete" &&
    !input.draft.delightSignature
  ) {
    issues.push("track_mismatch");
  }

  if (input.brief.completionMode === "user_override_partial") {
    if (input.draft.manualClue) {
      issues.push("forced_manual_clue");
    }

    if (input.draft.delightSignature) {
      issues.push("forced_delight_signature");
    }

    if (STABLE_RULE_PATTERN.test(content)) {
      issues.push("fake_rule_tone");
    }
  }

  if (input.brief.dimension === "joy") {
    if (!hasJoyVitalityCore(input.brief, content)) {
      issues.push("joy_missing_vitality_core");
      issues.push("missing_theory_core");
    }
  }

  return {
    accepted: issues.length === 0,
    issues
  };
}
