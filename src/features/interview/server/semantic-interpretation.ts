import {
  getDelightSignature,
  getJoyMoment,
  getJoySource,
  getJoyTrack,
  getMeaningNeed,
  getStateShift,
  getManualClue,
  getDirectionSignal,
  getValueImpact
} from "@/features/joy-interview/server/joy-interview-engine";
import type {
  DimensionSemanticInterpretation,
  InterviewDimension,
  InterviewEventRecord,
  InterviewMessage,
  JoyInterviewStage,
  JoySnapshot
} from "@/types/interview";

type SemanticAction = "reply" | "continue_current_event" | null;

interface BuildDimensionSemanticInterpretationInput {
  dimension: InterviewDimension;
  snapshot: JoySnapshot;
  stage?: JoyInterviewStage;
  action?: SemanticAction;
  activeEvent?: InterviewEventRecord | null;
  sourceEvents?: InterviewEventRecord[];
  messages?: InterviewMessage[];
}

function sanitizeNullableString(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();

  return trimmed || null;
}

function trimTrailingPunctuation(value: string) {
  return value.replace(/[，。！？；：,.!?;:\s]+$/u, "").trim();
}

function shorten(value: string | null | undefined, maxLength = 42) {
  const normalized = sanitizeNullableString(value);

  if (!normalized) {
    return null;
  }

  return trimTrailingPunctuation(normalized).slice(0, maxLength);
}

function compactTitleCandidate(value: string | null | undefined) {
  const normalized = sanitizeNullableString(value);

  if (!normalized) {
    return null;
  }

  const compacted = trimTrailingPunctuation(normalized)
    .replace(/[“”"'《》【】（）()[\]]/gu, "")
    .replace(/^(?:今天|这次|这段|这份|那个|这个|我|当时)/u, "")
    .trim();

  if (!compacted || compacted.length < 3 || compacted.length > 16 || /[，。！？；：,.!?;、]/u.test(compacted)) {
    return null;
  }

  return compacted;
}

function appendUnique(target: string[], ...values: Array<string | null | undefined>) {
  for (const value of values) {
    const candidate = compactTitleCandidate(value);

    if (candidate && !target.includes(candidate)) {
      target.push(candidate);
    }
  }
}

function buildGenericStageFocus(input: {
  dimension: InterviewDimension;
  stage?: JoyInterviewStage;
  action?: SemanticAction;
  continueCurrentEventFocus: string;
  collectFocus: string;
  probeReasonFocus: string;
  probePatternFocus: string;
  wrapUpFocus: string;
}) {
  if (input.action === "continue_current_event") {
    return input.continueCurrentEventFocus;
  }

  switch (input.stage) {
    case "collect_event":
      return input.collectFocus;
    case "probe_reason":
      return input.probeReasonFocus;
    case "probe_pattern":
      return input.probePatternFocus;
    case "wrap_up":
      return input.wrapUpFocus;
    case "finalize":
    default:
      return "";
  }
}

function buildJoyInterpretation(input: BuildDimensionSemanticInterpretationInput): DimensionSemanticInterpretation {
  const joyMoment = shorten(getJoyMoment(input.snapshot), 30);
  const joySource = shorten(getJoySource(input.snapshot), 42);
  const stateShift = shorten(getStateShift(input.snapshot), 20);
  const meaningNeed = shorten(getMeaningNeed(input.snapshot), 28);
  const manualClue = shorten(getManualClue(input.snapshot), 42);
  const delightSignature = shorten(getDelightSignature(input.snapshot), 42);
  const directionSignal = shorten(getDirectionSignal(input.snapshot), 26);
  const valueImpact = shorten(getValueImpact(input.snapshot), 26);
  const joined = [joyMoment, joySource, stateShift, meaningNeed, manualClue, delightSignature, directionSignal, valueImpact]
    .filter(Boolean)
    .join(" ");
  const joyTrack = getJoyTrack(input.snapshot);
  const titleCandidates: string[] = [];

  let themeKey = "delight_lifted";
  let themeLabel = "被轻轻带起来";
  let theorySummary = joySource
    ? `这份开心的重点，不是事情本身，而是“${joySource}”会把状态轻轻带起来。`
    : "这份开心成立，不是因为事情大，而是因为它真的把状态带轻了一点。";
  let thinkingSummaryLead = joySource
    ? `真正有分量的，不是事情本身，而是“${joySource}”会把状态带起来`
    : "这份开心已经不是简单复述事件，而是在指向那个真正会把状态带轻的点";
  let narrativePremise = "正文要写清楚：发生了什么只是入口，真正该留下的是它为什么会把状态带轻。";
  let closurePremise = "结尾优先收在这类开心会怎么把人带进状态，不要硬拔成人生意义。";
  let antiFlatteningTargets = ["不要只写发生了什么", "要写真正把状态带轻的点"];

  if (/(陪伴|家人|朋友|一起|聊天|相处|接住|有人在)/u.test(joined) && /(连接|陪伴|接住|关系|安心|稳定)/u.test(joined)) {
    themeKey = "being_received";
    themeLabel = "被陪伴接住";
    theorySummary = joySource
      ? `这份开心真正有分量，不只是一起做了什么，而是“${joySource}”让人重新松下来。`
      : "这份开心真正有分量，不只是有个片段，而是那种被陪伴接住、能慢慢松下来的感觉。";
    thinkingSummaryLead = joySource
      ? `这份开心的重点，不是表面上的片段，而是“${joySource}”这种被接住的感觉`
      : "这份开心已经落到被陪伴接住、能慢慢松下来的感觉上了";
    narrativePremise = "正文不要停在一起做了什么，要写出被陪伴接住之后，身体和心为什么真的松下来。";
    closurePremise = "结尾收在自己会被什么样的陪伴重新接住，不要写成社交活动记录。";
    antiFlatteningTargets = ["不要只写吃饭聊天本身", "要写被陪伴接住之后为什么会松下来"];
    appendUnique(titleCandidates, "被陪伴接住", "慢慢松下来");
  } else if (/(理解|懂我|听完|看见|被看见|被理解|认真听)/u.test(joined)) {
    themeKey = "being_understood";
    themeLabel = "被认真理解";
    theorySummary = joySource
      ? `这份开心的重点，不是顺利或热闹，而是“${joySource}”让人感到自己被认真理解了。`
      : "这份开心真正成立在被认真理解，不是有人在场，而是有人真的听懂了。";
    thinkingSummaryLead = joySource
      ? `这份开心已经落到“${joySource}”这层被理解的感觉上了`
      : "这份开心不是热闹，而是被认真理解之后整个人松下来";
    narrativePremise = "正文要写出被理解的那一下发生了什么，而不是泛泛写关系很好。";
    closurePremise = "结尾收在自己会被什么样的理解打动，不要写成空泛感谢。";
    antiFlatteningTargets = ["不要只写有人陪", "要写被理解之后为什么会有开心感"];
    appendUnique(titleCandidates, "被认真理解", "被好好听见");
  } else if (/(写|表达|创作|作品|做东西|输出|想法写顺|灵感)/u.test(joined)) {
    themeKey = "expression_lit_up";
    themeLabel = "表达被点亮";
    theorySummary = joySource
      ? `这份开心的生命力，落在“${joySource}”这种表达被点亮的感觉上。`
      : "这份开心成立在表达或创造被点亮，事情本身只是入口。";
    thinkingSummaryLead = joySource
      ? `这份开心真正有生命力的地方，是“${joySource}”这种表达被点亮的感觉`
      : "这份开心不是单纯完成了什么，而是表达和创造被点亮了";
    narrativePremise = "正文要写出表达为什么忽然顺了、亮了，而不是写成做完一件事。";
    closurePremise = "结尾收在什么样的表达状态会点亮自己，不要写成泛化成长口号。";
    antiFlatteningTargets = ["不要把它写成完成事项", "要写表达被点亮的感觉"];
    appendUnique(titleCandidates, "表达被点亮", "把想法写顺");
  } else if (valueImpact || /(帮助|有用|对别人有用|贡献|被需要|分享出去)/u.test(joined)) {
    themeKey = "value_felt";
    themeLabel = "感到自己有用";
    theorySummary = valueImpact
      ? `这份开心不只是自己舒服，而是“${valueImpact}”让人感到自己的行动对外界有了分量。`
      : "这份开心不只是自己舒服，而是感到自己的行动对外界有了分量。";
    thinkingSummaryLead = valueImpact
      ? `这份开心的分量，已经落到“${valueImpact}”这种对外有价值的感觉`
      : "这份开心已经不只是自我感受好，而是感到自己做的事有分量";
    narrativePremise = "正文要写出为什么会觉得自己有用，而不是把开心写成表扬自己。";
    closurePremise = "结尾收在什么样的行动会让自己觉得有分量，不要写成使命宣言。";
    antiFlatteningTargets = ["不要只写开心", "要写为什么会觉得自己做的事有分量"];
    appendUnique(titleCandidates, "感觉自己有用", "这件事有分量");
  } else if (directionSignal || /(方向|还想继续|更想做|真正喜欢|想往这个方向)/u.test(joined)) {
    themeKey = "direction_pulled";
    themeLabel = "心往那个方向动了";
    theorySummary = directionSignal
      ? `这份开心已经不只是片刻舒服，而是在把心往“${directionSignal}”那个方向拉。`
      : "这份开心已经不只是片刻舒服，而是在把心往一个更想继续的方向拉。";
    thinkingSummaryLead = directionSignal
      ? `这份开心已经不只是轻松，而是在往“${directionSignal}”这个方向上有拉力`
      : "这份开心已经不只是片刻高兴，而是在把心往更想继续的方向拉";
    narrativePremise = "正文要写出为什么这个片段会让人想继续靠近，而不是直接升成人生方向。";
    closurePremise = "结尾轻轻收在这份拉力，不要写成宏大人生结论。";
    antiFlatteningTargets = ["不要直接上升成人生方向", "要写这份开心为什么会把心往那里拉"];
    appendUnique(titleCandidates, "心往那个方向动了", "更想继续做下去");
  } else if (/(稳住|掌控|收口|理顺|踏实|回到节奏|把自己找回来)/u.test(joined)) {
    themeKey = "control_restored";
    themeLabel = "把状态找回来";
    theorySummary = joySource
      ? `这份开心的分量，落在“${joySource}”这种重新把状态找回来的感觉上。`
      : "这份开心真正有分量，不是因为热闹，而是因为重新把自己的状态找回来了。";
    thinkingSummaryLead = joySource
      ? `这份开心已经落到“${joySource}”这种把状态找回来的感觉上了`
      : "这份开心真正算数的地方，是把自己的状态重新找回来了";
    narrativePremise = "正文不要只写事情顺了，要写出状态是怎么重新稳住的。";
    closurePremise = "结尾收在什么会帮助自己找回状态，不要写成普通完成感。";
    antiFlatteningTargets = ["不要只写事情顺了", "要写状态是怎么重新稳住的"];
    appendUnique(titleCandidates, "把状态找回来", "重新稳住自己");
  } else if (joyTrack === "delight_track" || delightSignature) {
    themeKey = "delight_lifted";
    themeLabel = "一下被带轻";
    theorySummary = delightSignature
      ? `这份开心更像轻快乐：关键不是深意义，而是“${delightSignature}”这种会把状态轻轻带起来的方式。`
      : joySource
        ? `这份开心更像轻快乐：关键不是深意义，而是“${joySource}”会把状态带轻。`
        : "这份开心更像轻快乐：重点不是意义，而是那一下真的把状态带轻了。";
    thinkingSummaryLead = delightSignature
      ? `这份开心更像轻快乐，重点落在“${delightSignature}”这种会把状态带起来的方式`
      : joySource
        ? `这份开心更像轻快乐，真正打动人的地方是“${joySource}”会把状态带轻`
        : "这份开心已经不是普通复述，而是在指向那个会把状态带轻的点";
    narrativePremise = "正文要写清是被什么逗到、带轻、带松，而不是硬往价值和规律上拔。";
    closurePremise = "结尾收在这类内容、节奏或场景会怎样把自己带起来，不要写人生规律。";
    antiFlatteningTargets = ["不要硬写深层意义", "要写会把状态带轻的具体点"];
    appendUnique(titleCandidates, "一下被带轻", "轻轻被带起来");
  }

  appendUnique(titleCandidates, manualClue, delightSignature, joySource, stateShift, joyMoment);

  const followUpFocus = buildGenericStageFocus({
    dimension: input.dimension,
    stage: input.stage,
    action: input.action ?? null,
    continueCurrentEventFocus:
      themeKey === "delight_lifted"
        ? "，顺着这一下为什么会把状态带轻，继续说清。"
        : themeKey === "direction_pulled"
          ? "，顺着这份开心为什么会把心往那个方向拉，继续说清。"
          : "，顺着这份开心真正有分量的地方，继续说清。",
    collectFocus: "，先把真正有感觉的那个片段落具体。",
    probeReasonFocus: "，处理重点是分辨它为什么偏偏会在这里让人有感觉。",
    probePatternFocus:
      joyTrack === "delight_track"
        ? "，再看清这类开心通常会被什么样的内容、节奏或场景带出来。"
        : "，再把这份开心沉淀成更稳定的在乎、线索或方向感。",
    wrapUpFocus: "，最后确认这篇开心日志最该留下的那一层。"
  });

  return {
    dimension: input.dimension,
    themeKey,
    themeLabel,
    theorySummary,
    thinkingSummaryLead,
    followUpFocus,
    narrativePremise,
    closurePremise,
    titleTheme: titleCandidates[0] ?? themeLabel,
    titleCandidates,
    antiFlatteningTargets,
    dimensionMeta: {
      joyMoment: joyMoment ?? null,
      joySource: joySource ?? null,
      manualClue: manualClue ?? null,
      delightSignature: delightSignature ?? null
    }
  };
}

function buildFulfillmentInterpretation(input: BuildDimensionSemanticInterpretationInput): DimensionSemanticInterpretation {
  const experience = shorten(input.snapshot.event, 34);
  const progressEvidence = shorten(input.snapshot.whyItMattered, 42);
  const valueSignal = shorten(input.snapshot.selfPattern, 42);
  const fulfillmentType = shorten(input.snapshot.happinessType, 20);
  const joined = [experience, progressEvidence, valueSignal, fulfillmentType].filter(Boolean).join(" ");
  const titleCandidates: string[] = [];

  if (/结构|方法/u.test(joined) && /落地|行动|执行/u.test(joined)) {
    appendUnique(titleCandidates, "从结构到落地");
  }

  if (/主线|脉络/u.test(joined) && /理顺|清楚|明确/u.test(joined)) {
    appendUnique(titleCandidates, "主线终于理顺");
  }

  if (/协作|配合|交接|同事|团队/u.test(joined) && /接上|帮到|支持|对齐/u.test(joined)) {
    appendUnique(titleCandidates, "让协作接上");
  }

  let themeKey = "not_spinning_empty";
  let themeLabel = "今天不是空转";
  let theorySummary = progressEvidence
    ? `这件事真正有分量的地方，是${progressEvidence}。也因为这样，今天不算白过。`
    : "这件事真正有分量的地方，不是忙，而是今天确实有一件事真正算数。";
  let thinkingSummaryLead = valueSignal && progressEvidence
    ? `这段经历的分量，不只落在“${progressEvidence}”，也开始显出“${valueSignal}”这条值得感标准`
    : progressEvidence
      ? `这段充实真正算数的地方，不是忙，而是“${progressEvidence}”`
      : "这段充实已经不是忙碌感，而是在指向今天真正算数的那一下";
  let narrativePremise = "正文要写清为什么今天不算白过，不要写成工作汇报或任务清单。";
  let closurePremise = "结尾收在什么样的推进对自己算数，不要硬拔成职业使命。";
  let antiFlatteningTargets = ["不要写成今天很忙", "要写今天为什么真的不算白过"];

  if (/(帮到|支持到|让别人轻松|对别人有用|接住了别人)/u.test(joined)) {
    themeKey = "helping_someone";
    themeLabel = "帮到别人这件事算数";
    theorySummary = progressEvidence
      ? `这件事真正有分量的地方，是${progressEvidence}。也因为这样，今天不算白过。`
      : "这件事真正有分量的地方，不是做了很多，而是自己的投入真的帮到了别人。";
    thinkingSummaryLead = progressEvidence
      ? `这段充实的分量，不在忙，而在“${progressEvidence}”真的帮到了别人`
      : "这段充实的分量，不在忙，而在自己的投入真的帮到了别人";
    narrativePremise = "正文要写出具体帮到了什么，而不是把协作写成好人好事。";
    closurePremise = "结尾收在什么样的投入会让自己觉得有用，不要写成道德口号。";
    antiFlatteningTargets = ["不要只写做了很多", "要写具体帮到了什么"];
    appendUnique(titleCandidates, "帮到别人这件事算数", "帮到别人也算数");
  } else if (/(协作|交接|对齐|配合|同事|团队|接上)/u.test(joined)) {
    themeKey = "collaboration_connected";
    themeLabel = "让协作接上";
    theorySummary = progressEvidence
      ? `这件事真正有分量的地方，是${progressEvidence}。也因为这样，今天不算白过。`
      : "这件事真正有分量的地方，不是协作本身，而是原本散着的事情终于接上了。";
    thinkingSummaryLead = progressEvidence
      ? `这段充实的分量，落在“${progressEvidence}”让协作真的接上了`
      : "这段充实的分量，不在协作热闹，而在事情真的接上了";
    narrativePremise = "正文要写出协作是怎么接上的，不要写成团队氛围好。";
    closurePremise = "结尾收在什么样的协作推进对自己算数，不要写成组织价值观。";
    antiFlatteningTargets = ["不要只写一起做事", "要写事情是怎么被真正接上的"];
    appendUnique(titleCandidates, "让协作接上");
  } else if (/(积累|沉淀|一点点厚|越来越熟|日拱一卒|连续)/u.test(joined)) {
    themeKey = "accumulation_thickening";
    themeLabel = "积累在变厚";
    theorySummary = progressEvidence
      ? `这件事真正有分量的地方，是${progressEvidence}。也因为这样，今天不算白过。`
      : "这件事真正有分量的地方，不是做完，而是积累确实在一点点变厚。";
    thinkingSummaryLead = progressEvidence
      ? `这段充实的分量，不在忙，而在“${progressEvidence}”让积累变厚了`
      : "这段充实的分量，不在做完，而在积累真的变厚了";
    narrativePremise = "正文要写出今天具体厚了一层什么，不要写成长口号。";
    closurePremise = "结尾收在什么样的积累会让自己觉得算数，不要写空泛长期主义。";
    antiFlatteningTargets = ["不要写成成长口号", "要写今天具体厚了一层什么"];
    appendUnique(titleCandidates, "积累在变厚");
  } else if (/(练到|手感|写顺|更熟|学会|终于会一点)/u.test(joined)) {
    themeKey = "skill_getting_shape";
    themeLabel = "练到一点手感";
    theorySummary = progressEvidence
      ? `这件事真正有分量的地方，是${progressEvidence}。也因为这样，今天不算白过。`
      : "这件事真正有分量的地方，不是花了多少时间，而是手感开始成形。";
    thinkingSummaryLead = progressEvidence
      ? `这段充实的分量，不在投入时长，而在“${progressEvidence}”让手感开始成形`
      : "这段充实的分量，不在投入时长，而在手感开始成形";
    narrativePremise = "正文要写出哪里开始顺了、熟了、有手感了，不要写成学习打卡。";
    closurePremise = "结尾收在什么样的进步会让自己觉得算数，不要写空泛成长。";
    antiFlatteningTargets = ["不要只写我练了很久", "要写哪里开始有手感了"];
    appendUnique(titleCandidates, "练到一点手感", "把这一段写顺");
  } else if (/(收口|收尾|交付|落地|定下来|终于完了|搞定)/u.test(joined)) {
    themeKey = "real_closure";
    themeLabel = "真的收了个口";
    theorySummary = progressEvidence
      ? `这件事真正有分量的地方，是${progressEvidence}。也因为这样，今天不算白过。`
      : "这件事真正有分量的地方，不是终于忙完，而是事情真的收了个口。";
    thinkingSummaryLead = progressEvidence
      ? `这段充实的分量，不在忙完，而在“${progressEvidence}”让事情真的收了个口`
      : "这段充实的分量，不在忙完，而在事情真的收了个口";
    narrativePremise = "正文要写出哪里终于落下去了，不要写成任务完成汇报。";
    closurePremise = "结尾收在什么样的收口会让自己踏实，不要上升成效率哲学。";
    antiFlatteningTargets = ["不要只写终于做完了", "要写哪里真的收口了"];
    appendUnique(titleCandidates, "真的收了个口", "把事情落下去");
  } else if (/(卡住|推进|往前|推开|打通|终于动了)/u.test(joined)) {
    themeKey = "blocker_moved";
    themeLabel = "把卡点推开";
    theorySummary = progressEvidence
      ? `这件事真正有分量的地方，是${progressEvidence}。也因为这样，今天不算白过。`
      : "这件事真正有分量的地方，不是做了很多，而是原本卡住的地方真的被推开了。";
    thinkingSummaryLead = progressEvidence
      ? `这段充实真正算数的地方，不在忙，而在“${progressEvidence}”把卡点推开了`
      : "这段充实的分量，不在忙，而在原本卡住的地方真的被推开了";
    narrativePremise = "正文要写出原本卡在哪里、今天哪里真的动了，不要写成做了很多。";
    closurePremise = "结尾收在什么样的推进会让自己觉得算数，不要写成总任务观。";
    antiFlatteningTargets = ["不要只写做了很多", "要写原本卡住的地方是怎么被推开的"];
    appendUnique(titleCandidates, "把卡点推开", "今天不是空转");
  }

  if (!antiFlatteningTargets.includes("不要写成今天很忙")) {
    antiFlatteningTargets.unshift("不要写成今天很忙");
  }

  appendUnique(titleCandidates, valueSignal, progressEvidence, experience);

  const followUpFocus = buildGenericStageFocus({
    dimension: input.dimension,
    stage: input.stage,
    action: input.action ?? null,
    continueCurrentEventFocus:
      themeKey === "blocker_moved"
        ? "，顺着原本卡住的地方是怎么被推开的，继续说清。"
        : themeKey === "skill_getting_shape"
          ? "，顺着哪里开始有手感了，继续说清。"
          : "，顺着这件事真正算数的地方，继续说清。",
    collectFocus: "，先把具体片段和投入位置说清。",
    probeReasonFocus: "，处理重点是抓到推进、收口、积累或帮到别人的真实证据。",
    probePatternFocus: "，再把这种证据为什么对你算数收成更稳定的判断。",
    wrapUpFocus: "，最后确认这篇充实日志最该留下的分量。"
  });

  return {
    dimension: input.dimension,
    themeKey,
    themeLabel,
    theorySummary,
    thinkingSummaryLead,
    followUpFocus,
    narrativePremise,
    closurePremise,
    titleTheme: titleCandidates[0] ?? themeLabel,
    titleCandidates,
    antiFlatteningTargets,
    dimensionMeta: {
      experience: experience ?? null,
      progressEvidence: progressEvidence ?? null,
      valueSignal: valueSignal ?? null
    }
  };
}

function buildReflectionInterpretation(input: BuildDimensionSemanticInterpretationInput): DimensionSemanticInterpretation {
  const trigger = shorten(input.snapshot.event, 34);
  const insight = shorten(input.snapshot.whyItMattered, 42);
  const viewpointShift = shorten(input.snapshot.selfPattern, 42);
  const joined = [trigger, insight, viewpointShift, shorten(input.snapshot.happinessType, 18)].filter(Boolean).join(" ");
  const titleCandidates: string[] = [];

  if (/忙碌|很忙|任务/u.test(joined) && /(进展|推进|判断依据|真正)/u.test(joined)) {
    appendUnique(titleCandidates, "忙碌不等于进展");
  }

  let themeKey = "pattern_seen";
  let themeLabel = "看见一层规律";
  let theorySummary = insight
    ? `它让我看见，${insight}。这次思考真正重要的，不是想了很多，而是这层理解开始让判断变清楚。`
    : "这次思考真正重要的，不是想了很多，而是开始看见一层新的判断依据。";
  let thinkingSummaryLead = insight
    ? `这次思考的重点，不是情绪本身，而是“${insight}”开始让判断变清楚`
    : "这次思考已经不只是想了很多，而是在形成新的判断依据";
  let antiFlatteningTargets = ["不要只写我想了很多", "要写新的理解或判断依据"];

  if (/(判断|依据|标准|校准|分清|区别)/u.test(joined)) {
    themeKey = "judgment_recalibrated";
    themeLabel = "判断依据变清楚";
    appendUnique(titleCandidates, "判断依据变清楚");
  } else if (/(方向|更想|适合|优势|主线)/u.test(joined)) {
    themeKey = "direction_emerging";
    themeLabel = "方向开始浮现";
    appendUnique(titleCandidates, "看见自己的方向");
  } else if (/(盲点|忽略|原来我总会|误判)/u.test(joined)) {
    themeKey = "blindspot_lit";
    themeLabel = "盲点被照亮";
    appendUnique(titleCandidates, "看见那个盲点");
  } else if (/(擅长|优势|长处)/u.test(joined)) {
    themeKey = "strength_named";
    themeLabel = "优势开始有名字";
    appendUnique(titleCandidates, "看见自己的优势");
  } else {
    appendUnique(titleCandidates, "看见一层规律");
  }

  appendUnique(titleCandidates, viewpointShift, insight, trigger);

  return {
    dimension: input.dimension,
    themeKey,
    themeLabel,
    theorySummary,
    thinkingSummaryLead,
    followUpFocus: buildGenericStageFocus({
      dimension: input.dimension,
      stage: input.stage,
      action: input.action ?? null,
      continueCurrentEventFocus: "，顺着这次新理解背后的证据和判断变化继续说清。",
      collectFocus: "，先把触发思考的具体片段说清。",
      probeReasonFocus: "，处理重点是把新的理解和证据抓稳。",
      probePatternFocus: "，再把它收成可回看的判断线索。",
      wrapUpFocus: "，最后确认这篇思考日志最该留下的判断依据。"
    }),
    narrativePremise: "正文要写出这次片段带来的新理解，不要写成单纯感想。",
    closurePremise: "结尾收在多了一条什么判断依据，不要写成行动计划。",
    titleTheme: titleCandidates[0] ?? themeLabel,
    titleCandidates,
    antiFlatteningTargets,
    dimensionMeta: {
      trigger: trigger ?? null,
      insight: insight ?? null,
      viewpointShift: viewpointShift ?? null
    }
  };
}

function buildImprovementInterpretation(input: BuildDimensionSemanticInterpretationInput): DimensionSemanticInterpretation {
  const situation = shorten(input.snapshot.event, 34);
  const frictionPoint = shorten(input.snapshot.frictionPoint ?? input.snapshot.whyItMattered, 42);
  const repeatCondition = shorten(input.snapshot.repeatCondition, 42);
  const controllableFactor = shorten(input.snapshot.controllableFactor, 42);
  const nextAttempt = shorten(input.snapshot.nextAttempt ?? input.snapshot.selfPattern, 42);
  const joined = [situation, frictionPoint, repeatCondition, controllableFactor, nextAttempt].filter(Boolean).join(" ");
  const titleCandidates: string[] = [];

  let themeKey = "mainline_held";
  let themeLabel = "主线别丢";

  if (/(听完|复述|确认问题|先听)/u.test(joined)) {
    themeKey = "hear_before_reply";
    themeLabel = "先听完再回应";
    appendUnique(titleCandidates, "先听完再回应");
  } else if (/(缓冲|预留|留出|十分钟|十五分钟|空档|余量)/u.test(joined)) {
    themeKey = "buffer_reserved";
    themeLabel = "提前留出缓冲";
    appendUnique(titleCandidates, "提前留出缓冲");
  } else if (/(表达|说话|回复|回答|解释|回应)/u.test(joined) && /(急|太快|抢|没听完|没确认|答偏)/u.test(joined)) {
    themeKey = "expression_slowed";
    themeLabel = "表达慢下来";
    appendUnique(titleCandidates, "表达慢下来");
  } else if (/(边界|范围|说清|讲清)/u.test(joined)) {
    themeKey = "boundary_clarified";
    themeLabel = "把边界说清楚";
    appendUnique(titleCandidates, "把边界说清楚");
  } else if (/(准备|材料|检查|缓冲|预留)/u.test(joined)) {
    themeKey = "preparation_strengthened";
    themeLabel = "让准备更充分";
    appendUnique(titleCandidates, "让准备更充分");
  } else if (/(节奏|急|太快|稳|停一下|慢一点)/u.test(joined)) {
    themeKey = "pacing_stabilized";
    themeLabel = "把节奏放稳";
    appendUnique(titleCandidates, "把节奏放稳");
  } else {
    appendUnique(titleCandidates, "开工前定主线");
  }

  appendUnique(titleCandidates, nextAttempt, controllableFactor, repeatCondition, frictionPoint);

  return {
    dimension: input.dimension,
    themeKey,
    themeLabel,
    theorySummary:
      input.snapshot.improvementTrack === "repeat_good"
        ? repeatCondition
          ? `这次之所以比较顺，关键条件可能是${repeatCondition}。这次改进真正重要的，是把它留下来作为可重复的条件。`
          : "这次改进真正重要的，不是夸自己顺，而是看见什么条件值得重复。"
        : frictionPoint
          ? `真正卡住我的地方，是${frictionPoint}。这次改进真正重要的，不是自责，而是把它看成一个具体卡点。`
          : "这次改进真正重要的，不是自责，而是看见那个下次可以调整的具体卡点。",
    thinkingSummaryLead:
      input.snapshot.improvementTrack === "repeat_good"
        ? repeatCondition
          ? `这次改进的重点，不是泛泛总结，而是“${repeatCondition}”为什么值得重复`
          : "这次改进已经不只是复盘结果，而是在看什么条件值得重复"
        : frictionPoint
          ? `这次改进的重点，不是自责，而是“${frictionPoint}”这个具体卡点`
          : "这次改进已经不只是懊恼，而是在看那个具体卡点",
    followUpFocus: buildGenericStageFocus({
      dimension: input.dimension,
      stage: input.stage,
      action: input.action ?? null,
      continueCurrentEventFocus: "，顺着关键条件、具体卡点和可控小调整继续拆清。",
      collectFocus: "，先把需要复盘的具体情境说清。",
      probeReasonFocus: "，处理重点是分清关键条件或具体卡点。",
      probePatternFocus: "，再把它收成一个可调整的小处和下一次最小动作。",
      wrapUpFocus: "，最后确认这篇改进日志最该留下的可控线索。"
    }),
    narrativePremise: "正文要写出下次能调整的一小处，不要写成自责或计划表。",
    closurePremise: "结尾收在一小步可控动作，不要写成完整计划。",
    titleTheme: titleCandidates[0] ?? themeLabel,
    titleCandidates,
    antiFlatteningTargets: ["不要写成以后加油", "要写具体卡点和可控小调整"],
    dimensionMeta: {
      situation: situation ?? null,
      controllableFactor: controllableFactor ?? null,
      nextAttempt: nextAttempt ?? null
    }
  };
}

function buildGratitudeInterpretation(input: BuildDimensionSemanticInterpretationInput): DimensionSemanticInterpretation {
  const gratitudeMoment = shorten(input.snapshot.gratitudeMoment ?? input.snapshot.event, 34);
  const kindAction = shorten(input.snapshot.kindAction, 42);
  const seenNeed = shorten(input.snapshot.seenNeed, 42);
  const gratitudeReason = shorten(input.snapshot.gratitudeReason ?? input.snapshot.whyItMattered, 42);
  const relationshipSignal = shorten(input.snapshot.relationshipSignal ?? input.snapshot.selfPattern, 42);
  const joined = [gratitudeMoment, kindAction, seenNeed, gratitudeReason, relationshipSignal].filter(Boolean).join(" ");
  const titleCandidates: string[] = [];

  let themeKey = "steadily_received";
  let themeLabel = "被稳稳接住";

  if (/(撑不住|不是一个人在扛|接住|被接住)/u.test(joined)) {
    themeKey = "steadily_received";
    themeLabel = "被稳稳接住";
    appendUnique(titleCandidates, "被稳稳接住");
  } else if (/(理解|听完|看见|认真听|懂我)/u.test(joined)) {
    themeKey = "seriously_understood";
    themeLabel = "被认真理解";
    appendUnique(titleCandidates, "被认真理解");
  } else if (/(减负|分担|理清|帮我处理|帮我收尾|轻松一点)/u.test(joined)) {
    themeKey = "burden_lightened";
    themeLabel = "有人帮我理清";
    appendUnique(titleCandidates, "有人帮我理清");
  } else if (/(提醒|吃饭|休息|照顾|问我要不要)/u.test(joined)) {
    themeKey = "timely_reminded";
    themeLabel = "那句及时提醒";
    appendUnique(titleCandidates, "那句及时提醒");
  } else if (/(信任|机会|交给我|让我负责)/u.test(joined)) {
    themeKey = "trusted_with_chance";
    themeLabel = "被信任的机会";
    appendUnique(titleCandidates, "被信任的机会");
  } else {
    appendUnique(titleCandidates, "被稳稳接住");
  }

  appendUnique(titleCandidates, relationshipSignal, seenNeed, kindAction, gratitudeMoment);

  return {
    dimension: input.dimension,
    themeKey,
    themeLabel,
    theorySummary:
      seenNeed || gratitudeReason
        ? `这件事之所以重要，不是礼貌地谢谢，而是对方像是看见了${seenNeed ?? gratitudeReason}。`
        : "这份感谢真正重要，不是礼貌地谢谢，而是有人真的回应了当时那层需要。",
    thinkingSummaryLead:
      seenNeed || gratitudeReason
        ? `这份感谢的重点，不是泛泛感谢，而是对方回应了“${seenNeed ?? gratitudeReason}”这层需要`
        : "这份感谢已经不是泛泛说谢谢，而是在看见谁回应了当时那层需要",
    followUpFocus: buildGenericStageFocus({
      dimension: input.dimension,
      stage: input.stage,
      action: input.action ?? null,
      continueCurrentEventFocus: "，顺着这份善意回应了什么需要继续说清。",
      collectFocus: "，先把具体人、具体时刻和对方做了什么说清。",
      probeReasonFocus: "，处理重点是看见对方回应了什么需要或难处。",
      probePatternFocus: "，再把它收成值得珍惜的关系线索。",
      wrapUpFocus: "，最后确认这篇感谢日志最该留下的善意证据。"
    }),
    narrativePremise: "正文要写清具体善意和被回应的需要，不要写成感谢信模板。",
    closurePremise: "结尾收在什么样的回应值得珍惜，不要写成报答任务。",
    titleTheme: titleCandidates[0] ?? themeLabel,
    titleCandidates,
    antiFlatteningTargets: ["不要只写对方人很好", "要写对方回应了什么需要"],
    dimensionMeta: {
      gratitudeMoment: gratitudeMoment ?? null,
      kindAction: kindAction ?? null,
      seenNeed: seenNeed ?? null
    }
  };
}

export function buildDimensionSemanticInterpretation(
  input: BuildDimensionSemanticInterpretationInput
): DimensionSemanticInterpretation {
  if (input.dimension === "joy") {
    return buildJoyInterpretation(input);
  }

  if (input.dimension === "fulfillment") {
    return buildFulfillmentInterpretation(input);
  }

  if (input.dimension === "reflection") {
    return buildReflectionInterpretation(input);
  }

  if (input.dimension === "improvement") {
    return buildImprovementInterpretation(input);
  }

  return buildGratitudeInterpretation(input);
}
