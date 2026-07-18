import type { DraftBrief, JoyEntryDraft } from "@/types/interview";
import { MAX_JOURNAL_TITLE_LENGTH } from "@/features/interview/journal-title";
import {
  hasSpecificDelightCue,
  normalizeSignature,
  sanitizeNullableString
} from "@/features/interview/server/draft-policies/shared";

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
const INTERNAL_THEORY_DRAFT_PATTERNS = [
  /更像轻快乐/u,
  /关键不是(?:深)?意义/u,
  /理论核心/u,
  /当前理论/u,
  /这种会把状态轻轻带起来的方式/u,
  /会把状态带轻/u
];
const ABSTRACT_JOY_CLOSING_PATTERN =
  /(回头看|我现在|我也)?[^。！？!?]{0,12}(更知道|更清楚)[^。！？!?]{0,8}(象征意义|动作本身|确定性|简单性|启动信号|仪式感)[。！？!?]/u;
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
function normalizeContentUnit(value: string) {
  return value.replace(/\s+/g, "").replace(/[，。！？；：,.!?;:、“”"'（）()【】\[\]《》]/gu, "");
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
function hasGenericCoreRegression(brief: DraftBrief, content: string) {
  if (brief.dimension !== "joy" || brief.joyTrack !== "delight_track" || !hasSpecificDelightCue(brief.emotionalCore)) {
    return false;
  }

  return /真正让我(?:开心|有感觉|被触动)[^。！？!?]{0,24}(?:是|而是)[^。！？!?]{0,12}(?:搞笑短视频|短视频|视频|段子|内容)/u.test(content);
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
  if (/^(?:一下被带轻|轻轻被带起来|象征意义|动作本身|启动信号|确定性|简单性|仪式感)$/u.test(title.trim())) {
    return true;
  }

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

  if (INTERNAL_THEORY_DRAFT_PATTERNS.some((pattern) => pattern.test(content))) {
    issues.push("internal_theory_tone");
  }

  if (input.brief.dimension === "joy" && ABSTRACT_JOY_CLOSING_PATTERN.test(content)) {
    issues.push("abstract_joy_closing");
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

    if (/而是她没有只说辛苦了当时|的是她没有只说辛苦了|对方像是看见了自己当时的/u.test(content)) {
      issues.push("gratitude_corrupted_phrase");
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
