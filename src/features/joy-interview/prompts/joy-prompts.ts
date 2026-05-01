import { getInterviewMessageDisplayText } from "@/features/joy-interview/assistant-turn";
import { MAX_JOURNAL_TITLE_LENGTH } from "@/features/interview/journal-title";
import { getInterviewDimensionConfig } from "@/features/interview/server/dimension-config";
import {
  getDelightSignature,
  getDirectionSignal,
  getDurability,
  getJoyKind,
  getJoyMoment,
  getJoyPsychProfile,
  getJoyTrack,
  getJoySource,
  getJoyTags,
  getManualClue,
  getMeaningNeed,
  getStateShift,
  getValueImpact
} from "@/features/joy-interview/server/joy-interview-engine";
import type { AIChatMessage } from "@/server/services/ai/ai-provider";
import type {
  AssistantDepth,
  DraftBrief,
  DraftWritingProfile,
  InterviewDimension,
  InterviewEventRecord,
  InterviewMessage,
  JoyInterviewStage,
  JoySnapshot
} from "@/types/interview";

const dimensionPromptGuide: Record<
  InterviewDimension,
  {
    goal: string;
    path: string;
    fallback: string;
  }
> = {
  joy: {
    goal: "帮助用户把今天的开心沉淀清楚：有些开心会走向更稳定的生命力线索，有些开心本身就是纯粹的轻快乐，两种都成立。",
    path: "优先顺序：具体片段 -> 真正开心点 -> 状态变化或被满足的在乎 -> 如果是轻快乐，沉淀它会被什么带动起来；如果有更深线索，再沉淀成更稳定的个人线索。",
    fallback: "如果用户说今天没什么开心的，先降低门槛，从轻松一点、舒服一点、松一口气、好笑一点的小碎片里找；仍然找不到时，不要硬拔高。"
  },
  fulfillment: {
    goal: "帮助用户确认今天哪件事让他觉得没有白过，并从真实证据里沉淀出值得感标准。",
    path: "优先顺序：具体充实片段 -> 没白过的进展证据 -> 当时的踏实感或充实类型 -> 什么样的努力对用户来说算数。",
    fallback: "如果用户只说普通上班或上课，把问题拆小，找今天哪件小事真的推进、练到、积累或帮到了别人。"
  },
  reflection: {
    goal: "帮助用户从今天的具体片段里提炼新的规律、方向、优势、盲点或判断依据，把经历变成可回看的判断资产。",
    path: "优先顺序：触发思考的具体片段 -> 原来的疑问或判断 -> 当天看到的证据 -> 新规律或新理解 -> 视角变化或判断线索。",
    fallback: "如果用户只说想了很多或很焦虑，先拉回当天具体触发片段；如果重点变成下次怎么做，引导去改进维度。"
  },
  improvement: {
    goal: "帮助用户把一次好/坏状态，整理成下次更容易重复好状态、避免坏状态的具体调整。",
    path: "优先顺序：具体情境 -> 判断是重复好状态还是避免坏状态 -> 好状态的关键条件或坏状态的具体卡点 -> 用户能调整的一小处 -> 下次想试的最小动作和可观察成功信号。",
    fallback: "不要把问题问成空泛决心、建议、计划或自责归因，要把注意力拉回那个具体情境里的可控小调整。"
  },
  gratitude: {
    goal: "帮助用户识别今天被支持、被理解、被善待的时刻，确认这份感谢为什么重要。",
    path: "优先顺序：具体事件 -> 对方做了什么 -> 当时感受 -> 为什么想感谢 -> 这份善意说明了什么。",
    fallback: "如果用户说没有想感谢的人，就从谁让他省力一点、被接住一点的小善意开始找。"
  }
};

export const joyInterviewPrinciples = [
  "一次只问一个开放式问题，不做并列提问。",
  "优先推进尚未覆盖的层次，避免复述式追问。",
  "不抢结论，不做心理诊断，不扩展到其他维度。"
];

function formatVisibleRecentMessages(messages: InterviewMessage[]) {
  return messages
    .slice(-8)
    .map((message) => `${message.role === "assistant" ? "访谈者" : "用户"}: ${getInterviewMessageDisplayText(message)}`)
    .join("\n");
}

function formatStructuredRecentAssistantMessages(messages: InterviewMessage[]) {
  return messages
    .filter((message) => message.role === "assistant")
    .slice(-3)
    .map((message) => message.content)
    .join("\n");
}

function formatSnapshot(snapshot: JoySnapshot) {
  return JSON.stringify(
    {
      joyMoment: getJoyMoment(snapshot),
      joySource: getJoySource(snapshot),
      stateShift: getStateShift(snapshot),
      meaningNeed: getMeaningNeed(snapshot),
      manualClue: getManualClue(snapshot),
      delightSignature: getDelightSignature(snapshot),
      directionSignal: getDirectionSignal(snapshot),
      valueImpact: getValueImpact(snapshot),
      durability: getDurability(snapshot),
      joyTrack: getJoyTrack(snapshot),
      joyKind: getJoyKind(snapshot),
      psychProfile: getJoyPsychProfile(snapshot),
      tags: getJoyTags(snapshot),
      missingSlots: snapshot.missingSlots
    },
    null,
    2
  );
}

function getFulfillmentSnapshotPayload(snapshot: JoySnapshot) {
  return {
    experience: snapshot.event,
    feeling: snapshot.feeling,
    fulfillmentType: snapshot.happinessType,
    progressEvidence: snapshot.whyItMattered,
    valueSignal: snapshot.selfPattern,
    missingSlots: snapshot.missingSlots
  };
}

function getReflectionSnapshotPayload(snapshot: JoySnapshot) {
  return {
    trigger: snapshot.event,
    feeling: snapshot.feeling,
    reflectionType: snapshot.happinessType,
    insight: snapshot.whyItMattered,
    viewpointShift: snapshot.selfPattern,
    missingSlots: snapshot.missingSlots
  };
}

function getImprovementSnapshotPayload(snapshot: JoySnapshot) {
  return {
    situation: snapshot.event,
    feeling: snapshot.feeling,
    improvementType: snapshot.happinessType,
    improvementTrack: snapshot.improvementTrack ?? null,
    stateAssessment: snapshot.stateAssessment ?? null,
    frictionPoint: snapshot.frictionPoint ?? snapshot.whyItMattered,
    repeatCondition: snapshot.repeatCondition ?? null,
    controllableFactor: snapshot.controllableFactor ?? null,
    nextAttempt: snapshot.nextAttempt ?? snapshot.selfPattern,
    successSignal: snapshot.successSignal ?? null,
    missingSlots: snapshot.missingSlots
  };
}

function formatSnapshotForDimension(dimension: InterviewDimension, snapshot: JoySnapshot) {
  if (dimension === "fulfillment") {
    return JSON.stringify(getFulfillmentSnapshotPayload(snapshot), null, 2);
  }

  if (dimension === "reflection") {
    return JSON.stringify(getReflectionSnapshotPayload(snapshot), null, 2);
  }

  if (dimension === "improvement") {
    return JSON.stringify(getImprovementSnapshotPayload(snapshot), null, 2);
  }

  return formatSnapshot(snapshot);
}

function formatDepthReached(depthReached: AssistantDepth[]) {
  return depthReached.length ? depthReached.join("、") : "无";
}

function formatEventSummaries(events: InterviewEventRecord[], dimension: InterviewDimension = "joy") {
  if (!events.length) {
    return "无";
  }

  return events
    .map((event) =>
      JSON.stringify(
          {
            sequence: event.sequence,
            status: event.status,
            stage: event.stage,
            explorationRound: event.explorationRound,
            snapshot:
              dimension === "fulfillment"
                ? getFulfillmentSnapshotPayload(event.snapshot)
                : dimension === "reflection"
                  ? getReflectionSnapshotPayload(event.snapshot)
                  : dimension === "improvement"
                    ? getImprovementSnapshotPayload(event.snapshot)
                    : {
                    joyMoment: getJoyMoment(event.snapshot),
                    joySource: getJoySource(event.snapshot),
                    stateShift: getStateShift(event.snapshot),
                    meaningNeed: getMeaningNeed(event.snapshot),
                    manualClue: getManualClue(event.snapshot),
                    delightSignature: getDelightSignature(event.snapshot),
                    directionSignal: getDirectionSignal(event.snapshot),
                    valueImpact: getValueImpact(event.snapshot),
                    durability: getDurability(event.snapshot),
                    joyTrack: getJoyTrack(event.snapshot),
                    joyKind: getJoyKind(event.snapshot)
                  }
          },
          null,
        2
      )
    )
    .join("\n");
}

export function buildJoyExtractMessages(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  turnCount: number;
  lastAssistantQuestion: string;
  userMessage: string;
  snapshot: JoySnapshot;
  messages: InterviewMessage[];
}): AIChatMessage[] {
  const config = getInterviewDimensionConfig(input.dimension);
  const extractShape =
    input.dimension === "joy"
      ? '{"joyMoment":string|null,"joySource":string|null,"stateShift":string|null,"meaningNeed":string|null,"manualClue":string|null,"delightSignature":string|null,"directionSignal":string|null,"valueImpact":string|null,"durability":string|null,"tags":string[]}'
      : input.dimension === "fulfillment"
        ? '{"event":string|null,"feeling":string|null,"whyItMattered":string|null,"happinessType":string|null,"selfPattern":string|null,"tags":string[]}'
      : input.dimension === "reflection"
        ? '{"event":string|null,"feeling":string|null,"whyItMattered":string|null,"happinessType":string|null,"selfPattern":string|null,"tags":string[]}'
      : input.dimension === "improvement"
        ? '{"situation":string|null,"improvementTrack":"repeat_good"|"avoid_bad"|null,"stateAssessment":string|null,"frictionPoint":string|null,"repeatCondition":string|null,"controllableFactor":string|null,"nextAttempt":string|null,"successSignal":string|null,"improvementType":string|null,"feeling":string|null,"tags":string[]}'
      : '{"event":string|null,"feeling":string|null,"whyItMattered":string|null,"happinessType":string|null,"selfPattern":string|null}';
  const fulfillmentExtractRules =
    input.dimension === "fulfillment"
      ? [
          "对 fulfillment 来说，event=具体充实片段，whyItMattered=没有白过的进展证据，happinessType=推进完成型/投入积累型/协作贡献型，selfPattern=值得感标准。",
          "不要把普通忙碌、任务很多、踏实情绪直接抽成进展证据；必须看到完成、推进、练到、积累或帮到别人的证据。",
          "selfPattern 只能在用户明确表达“我在意/我看重/对我来说算数/值得”的同等强证据时填写；否则返回 null。"
        ]
      : [];
  const reflectionExtractRules =
    input.dimension === "reflection"
      ? [
          "对 reflection 来说，event=触发思考的具体片段，whyItMattered=新发现/新理解，happinessType=规律发现型/方向优势型/判断校准型，selfPattern=视角变化或判断线索。",
          "必须有当天具体片段才能填 event；不要把“想了很多”“有点焦虑”直接当成触发片段。",
          "whyItMattered 只能填写用户从片段里明确看见的新规律、新理解、优势、盲点或判断依据；不要抽成空泛人生感悟。",
          "selfPattern 只能在用户表达原来看法和现在更清楚的判断线索时填写；如果只是当前洞见，返回 null。",
          "如果内容核心是下次怎么做，尽量不要抽成 reflection 的 selfPattern；那更像 improvement。"
        ]
      : [];
  const improvementExtractRules =
    input.dimension === "improvement"
      ? [
          "对 improvement 来说，situation=改进情境，improvementType=改进类型，improvementTrack 只能是 repeat_good 或 avoid_bad。",
          "stateAssessment=用户对当时状态的具体判断；不能把“我很差”“我不行”这类全局自责抽成 frictionPoint。",
          "avoid_bad 需要抽 frictionPoint，表示具体卡点或失稳点；如果用户还没说清卡点，frictionPoint 返回 null，留给下一轮追问；不要强行抽 repeatCondition。",
          "repeat_good 需要抽 repeatCondition，表示好状态可重复的条件；如果用户还没说清条件，repeatCondition 返回 null，留给下一轮追问；不要强行抽 frictionPoint。",
          "controllableFactor 必须是用户能调整的一小块，例如先复述问题、先写三条重点、提前留十分钟；不能是控制他人或改变性格。",
          "nextAttempt 必须是具体动作；“我要变好”“我要改进”“我要努力”这类空泛愿望必须返回 null。",
          "successSignal 只在用户说到可观察的判断信号时填写，例如对方确认理解正确、开工后没有被消息带跑；否则返回 null。",
          "不要输出旧字段名；只输出 situation、improvementTrack、stateAssessment、frictionPoint、repeatCondition、controllableFactor、nextAttempt、successSignal、improvementType、feeling、tags。"
        ]
      : [];

  return [
    {
      role: "system",
      content: [
        `你是幸福日志产品中的结构化抽取器，只负责从用户这轮表达中抽取${config.label}维度信息。`,
        "你不能决定流程，不写安慰，不提建议，不扩写没有证据的信息。",
        input.dimension === "joy"
          ? "对 joy 来说，纯粹好玩、解压、好笑、沉浸的开心也成立；没有证据时不要硬补深层意义。"
          : null,
        ...fulfillmentExtractRules,
        ...reflectionExtractRules,
        ...improvementExtractRules,
        "如果用户没明确说到，就返回 null。",
        `只返回 JSON：${extractShape}`
      ].filter(Boolean).join("\n")
    },
    {
      role: "user",
      content: [
        `当前阶段: ${input.stage}`,
        `当前轮次: ${input.turnCount}`,
        `上一句访谈问题: ${input.lastAssistantQuestion}`,
        `已有快照:\n${formatSnapshotForDimension(input.dimension, input.snapshot)}`,
        `最近对话:\n${formatVisibleRecentMessages(input.messages)}`,
        `用户本轮回答: ${input.userMessage}`
      ].join("\n\n")
    }
  ];
}

export function buildJoyQuestionMessages(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  userMessage: string | null;
  snapshot: JoySnapshot;
  events: InterviewEventRecord[];
  activeEvent: InterviewEventRecord;
  messages: InterviewMessage[];
  nextTurnCount: number;
  nextEventTurnCount: number;
  previousDepthReached: AssistantDepth[];
  nextDepthReached: AssistantDepth[];
  coveredLenses: InterviewEventRecord["coveredLenses"];
  roundCoveredLenses: InterviewEventRecord["roundCoveredLenses"];
  isMeaningfulReply: boolean;
  action: "reply" | "continue_current_event";
}): AIChatMessage[] {
  const config = getInterviewDimensionConfig(input.dimension);
  const guide = dimensionPromptGuide[input.dimension];
  const dimensionSpecificQuestionRules =
    input.dimension === "joy"
      ? [
          "joy 补充规则：不是所有开心都要升成深规律。纯粹开心、解压、好笑、沉浸感本身也成立，只要能说清什么会把用户带进这种状态。",
          "joy 补充规则：如果当前材料更像轻快乐，就继续确认被戳中的点、状态变化和会被什么内容/节奏/场景带动；不要硬逼用户解释人生意义。"
        ]
        : input.dimension === "fulfillment"
          ? [
            "fulfillment 补充规则：重点不是用户今天忙不忙，而是哪件事让这一天不算白过。",
            "fulfillment 补充规则：追问顺序必须贴着证据走：先问具体片段，再问推进、练到、积累或帮到了什么，最后才问什么样的努力对用户来说算数。",
            "fulfillment 补充规则：不要直接问抽象价值观，不要把普通忙碌抬成充实，不要把一次局部推进上升成人生方向。"
            ]
          : input.dimension === "reflection"
            ? [
                "reflection 补充规则：重点不是记录想法，而是从当天具体片段里看见新的规律、方向、优势、盲点或判断依据。",
                "reflection 补充规则：追问顺序必须贴着证据走：先抓触发片段，再问原来的疑问或判断，再问当天看到的证据，最后才问视角变化或判断线索。",
                "reflection 补充规则：不要写成行动计划、心理诊断、人生结论或稳定公式；如果用户重点变成“下次怎么做”，提示这更适合改进维度。",
                "reflection 补充规则：关系相关内容只有在核心是理解规律或校准判断时留在思考；如果核心是感谢、支持或被善待，应提示更适合感谢维度。"
              ]
            : input.dimension === "improvement"
              ? [
                  "improvement 补充规则：核心不是给建议，而是帮助用户把一次好/坏状态收成下次更容易重复好状态、避免坏状态的具体调整。",
                  "improvement 补充规则：追问顺序必须贴着具体情境走：先问下次可以更好一点的具体时刻，再分清是重复好状态还是避免坏状态，再问关键条件或具体卡点，最后问用户能调整的一小处和下次最小动作。",
                  "improvement 补充规则：repeat_good 要追问“这次好在哪里”和“最关键的条件是什么”；avoid_bad 要追问“真正卡住的地方是什么”，可以用节奏、表达、判断、协作作为轻提示。",
                  "improvement 补充规则：不要说“你应该怎么做”“制定一个计划”“你为什么会这样”“以后一定要”；nextAttempt 只能被追问成具体动作，不能变成空泛决心。"
                ]
          : [];

  return [
    {
      role: "system",
      content: [
        `你是幸福日志产品里的${config.label}维度访谈者。`,
        guide.goal,
        guide.path,
        guide.fallback,
        "必须遵守：",
        "1. 一次只问一个开放式问题，不要问 A 还是 B，不要问是不是、有没有觉得、要不要。",
        "2. thinkingSummary 是给用户看的浅色思路层：直接写出你如何理解用户刚刚回复，以及接下来处理这个问题的焦点。",
        "3. thinkingSummary 不是对用户的机械复述，不要只改写用户原话；也不要暴露完整推理、内部字段或写成长解释。",
        "4. thinkingSummary 不要使用“我理解到的是”“我会”“我想知道”“用户已说”“下一步问”“我准备确认”“我在想”这类过渡句或系统口吻，直接写正文内容。",
        "5. 不要写“这件事已经有轮廓了”“已经慢慢清楚了”“还差一点更深展开”这类空泛评价，必须落到具体线索、在乎点或矛盾上。",
        "6. thinkingSummary 不能写成问句，不能带问号，不能变成第二个追问；真正的问题只能放在 question。",
        "7. question 必须优先推进当前事件尚未覆盖的层次，不能重复刚刚聊过的切口。",
        "8. 当 action=continue_current_event 时，thinkingSummary 要体现“换个角度继续深挖”的处理焦点，但不要变成空泛承接句。",
        "9. 当前轮只允许围绕 activeEvent 深挖，不要把问题跳到下一件事；下一件事由产品的 next_event 动作触发。",
        "10. 不要主动要求用户“留下哪个点”或“要不要整理日志”；收尾选择由前端 choice 卡片承担。",
        "11. 只能输出下面两个标记段，不要 JSON，不要 markdown，不要解释，不要额外前后缀。",
        "12. thinkingSummary 和 question 都不能为空；thinkingSummary 最多 2 句，保持精简。",
        ...dimensionSpecificQuestionRules,
        `输出格式：${"<<SUMMARY>>"}一句到两句思路摘要${"<<QUESTION>>"}一个具体追问`
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `当前维度: ${config.label}`,
        `当前动作: ${input.action}`,
        `目标阶段: ${input.stage}`,
        `activeEvent:\n${JSON.stringify(
          {
            sequence: input.activeEvent.sequence,
            explorationRound: input.activeEvent.explorationRound,
            coveredLenses: input.coveredLenses,
            roundCoveredLenses: input.roundCoveredLenses,
            snapshot:
              input.dimension === "fulfillment"
                ? getFulfillmentSnapshotPayload(input.snapshot)
                : input.dimension === "reflection"
                  ? getReflectionSnapshotPayload(input.snapshot)
                  : input.snapshot
          },
          null,
          2
        )}`,
        `全部事件摘要:\n${formatEventSummaries(input.events, input.dimension)}`,
        `上一轮已覆盖深度: ${formatDepthReached(input.previousDepthReached)}`,
        `本轮建议覆盖深度: ${formatDepthReached(input.nextDepthReached)}`,
        `会话总有效轮次: ${input.nextTurnCount}`,
        `当前事件有效轮次: ${input.nextEventTurnCount}`,
        `本轮回复是否有效: ${input.isMeaningfulReply ? "是" : "否"}`,
        `最近可读对话:\n${formatVisibleRecentMessages(input.messages) || "无"}`,
        `最近 assistant 结构化输出:\n${formatStructuredRecentAssistantMessages(input.messages) || "无"}`,
        input.action === "continue_current_event"
          ? "用户刚刚选择继续深挖当前事件，请换一个新角度直接追问。"
          : `用户本轮输入: ${input.userMessage ?? "无"}`
      ].join("\n\n")
    }
  ];
}

export function buildJoyDraftMessages(input: {
  dimension: InterviewDimension;
  draftBrief: DraftBrief;
  writingProfile: DraftWritingProfile;
  events: InterviewEventRecord[];
  messages: InterviewMessage[];
  generationMode?: "initial_generate" | "refresh_minor" | "refresh_major";
  existingDraft?: {
    title: string;
    content: string;
  } | null;
}): AIChatMessage[] {
  const config = getInterviewDimensionConfig(input.dimension);
  const isJoyDimension = input.dimension === "joy";
  const isFulfillmentDimension = input.dimension === "fulfillment";
  const isReflectionDimension = input.dimension === "reflection";
  const isImprovementDimension = input.dimension === "improvement";
  const joyCompletionInstruction =
    input.writingProfile.closingMode === "stable_clue"
      ? input.draftBrief.closureTarget === "delight_signature"
        ? "结尾要自然收束出这条已经成立的轻快乐线索，写出什么样的内容、节奏或场景会把我带动起来，但不要写成人生规律、操作说明或系统术语。"
        : "结尾要自然收束出这条已经成立的个人线索，但不要写成条目、公式或系统术语。"
      : input.draftBrief.closureTarget === "delight_signature"
        ? "结尾只能写成当前发现，不要假装已经形成稳定的轻快乐公式，也不要填写 delightSignature。"
        : "结尾只能写成当前发现，不要假装已经形成稳定的“只要……我就更容易……”结论，也不要填写 manualClue。";
  const fulfillmentCompletionInstruction =
    input.writingProfile.closingMode === "stable_clue"
      ? "结尾可以轻轻收束已经成立的值得感标准，用自然语言写出什么样的努力对我来说真的算数；不要写成字段说明、绩效复盘或价值观口号。"
      : "结尾只能停在“这件事为什么让今天不算白过”的当前理解，不要硬写值得感标准，也不要填写 selfPattern。";
  const reflectionCompletionInstruction =
    input.writingProfile.closingMode === "stable_clue"
      ? "结尾可以轻轻收束已经成立的视角变化或判断线索，写出以后判断类似事情时多了一条什么依据；不要写成行动计划、人生公式或方法论总结。"
      : "结尾只能停在这次片段带来的当前理解，不要假装已经形成稳定判断线索，也不要填写 selfPattern。";
  const improvementCompletionInstruction =
    input.writingProfile.closingMode === "stable_clue"
      ? "结尾只能轻轻收束用户已经说出的下一次小尝试，力度到“下次我想先试试这一小步”；不要写成完整计划、长期承诺或效率建议。"
      : "结尾只能停在当前看见的改进点，不要硬写 nextAttempt，不要填写 selfPattern，也不要假装已经形成完整方案。";
  const voiceInstruction =
    input.writingProfile.voiceMode === "journal"
      ? "整篇必须像日志，不像总结；像用户自己写下来的整理，不像系统总结或分析报告。"
      : null;
  const narrativeInstruction =
    input.writingProfile.narrativeOrder === "scene_core_shift_close"
      ? isFulfillmentDimension
        ? "开头先从具体充实片段进入，不要从“今天很充实”或抽象判断起笔。正文默认按“片段进入 -> 推进/积累/贡献证据 -> 为什么今天不算白过 -> 结尾轻收”组织。"
        : isReflectionDimension
          ? "开头先从触发思考的具体片段进入，不要从“今天想了很多”或抽象感悟起笔。正文默认按“片段进入 -> 当时原来的判断或疑问 -> 今天看到的证据/新理解 -> 视角变化或判断线索”组织。"
        : isImprovementDimension
          ? "开头先从具体改进情境进入，不要从“我需要改进”或抽象决心起笔。正文默认按“情境进入 -> 当时好或不理想的状态 -> 关键条件或卡点 -> 可控的小调整 -> 结尾轻收”组织。"
        : isJoyDimension
          ? "开头先从具体片段进入，不要从抽象判断、总的感受或提炼结论起笔。正文默认按“片段进入 -> 真正开心点/核心感受 -> 状态变化或被满足的在乎/被带动的方式 -> 结尾轻收”组织。"
          : "开头先从具体片段进入，不要从抽象判断、总的感受或提炼结论起笔。正文默认按“片段进入 -> 为什么重要 -> 当时感受 -> 结尾轻收”组织。"
      : null;
  const toneBanInstruction = input.writingProfile.toneBanSet.length
    ? `输出中明确禁止系统话术、字段词、总结腔、建议腔，尤其不要写这些语气、措辞或元叙述: ${input.writingProfile.toneBanSet.join("、")}。`
    : null;
  const draftShape =
    isJoyDimension
      ? '{"title":string,"content":string,"event":string|null,"feeling":string|null,"whyItMattered":string|null,"happinessType":string|null,"selfPattern":string|null,"joyMoment":string|null,"joySource":string|null,"stateShift":string|null,"meaningNeed":string|null,"manualClue":string|null,"delightSignature":string|null,"directionSignal":string|null,"valueImpact":string|null,"durability":string|null,"tags":string[],"eventBlocks":[{"eventId":string,"sequence":number,"explorationRound":number,"event":string|null,"feeling":string|null,"whyItMattered":string|null,"happinessType":string|null,"selfPattern":string|null,"joyMoment":string|null,"joySource":string|null,"stateShift":string|null,"meaningNeed":string|null,"manualClue":string|null,"delightSignature":string|null,"directionSignal":string|null,"valueImpact":string|null,"durability":string|null,"tags":string[]}]}'
      : isImprovementDimension
        ? '{"title":string,"content":string,"event":string|null,"feeling":string|null,"whyItMattered":string|null,"happinessType":string|null,"selfPattern":string|null,"improvementTrack":"repeat_good"|"avoid_bad"|null,"stateAssessment":string|null,"frictionPoint":string|null,"repeatCondition":string|null,"controllableFactor":string|null,"nextAttempt":string|null,"successSignal":string|null,"tags":string[],"eventBlocks":[{"eventId":string,"sequence":number,"explorationRound":number,"event":string|null,"feeling":string|null,"whyItMattered":string|null,"happinessType":string|null,"selfPattern":string|null,"improvementTrack":"repeat_good"|"avoid_bad"|null,"stateAssessment":string|null,"frictionPoint":string|null,"repeatCondition":string|null,"controllableFactor":string|null,"nextAttempt":string|null,"successSignal":string|null}]}'
      : '{"title":string,"content":string,"event":string|null,"feeling":string|null,"whyItMattered":string|null,"happinessType":string|null,"selfPattern":string|null,"tags":string[],"eventBlocks":[{"eventId":string,"sequence":number,"explorationRound":number,"event":string|null,"feeling":string|null,"whyItMattered":string|null,"happinessType":string|null,"selfPattern":string|null}]}';
  const dimensionDraftInstruction = isJoyDimension
    ? "对 joy 维度来说，正文不只要写发生了什么，还要自然写出真正开心点，以及状态变化、被满足的在乎，或会被什么样的轻快乐带动。"
    : isFulfillmentDimension
      ? "对 fulfillment 维度来说，正文要写清这件事为什么让今天不算白过：必须有推进、练到、积累、收口或帮到别人的真实证据，不要只写忙碌、任务很多或心里踏实。"
      : isReflectionDimension
        ? "对 reflection 维度来说，正文要写清这次片段带来了什么新发现，以及这个发现如何从当天材料里自然推出；不能只写“我想了很多”或空泛人生感悟。"
        : isImprovementDimension
          ? "对 improvement 维度来说，正文要把一次好/坏状态整理成一个下次更容易重复好状态或避免坏状态的具体调整：必须写清关键条件或具体卡点，以及用户能调整的一小处。"
          : `对 ${config.label} 维度来说，正文要自然写出这件事为什么重要，而不只是复述事件。`;
  const completionInstruction = isJoyDimension
    ? joyCompletionInstruction
    : isFulfillmentDimension
      ? fulfillmentCompletionInstruction
      : isReflectionDimension
        ? reflectionCompletionInstruction
        : isImprovementDimension
          ? improvementCompletionInstruction
          : "如果已经有模式或线索，要自然写进结尾，不要单独列成字段说明。";
  const dimensionTrackInstruction = isJoyDimension
    ? input.draftBrief.joyTrack === "delight_track"
      ? "当前这篇 joy 更像纯粹开心或恢复型开心。不要硬写价值、方向、人生规律；写清它为什么好玩、解压、上头或能把状态带轻就够了。"
      : "当前这篇 joy 已经带有更稳定的心理分量。可以自然写出它碰到的在乎、价值感、连接感或方向线索，但不要上价值。"
    : isFulfillmentDimension
      ? "当前这篇 fulfillment 的核心不是周报、汇报或绩效总结。不要罗列完成事项，不要写成长口号，不要把一次局部推进升级成人生方向或职业使命。"
      : isReflectionDimension
        ? "当前这篇 reflection 的核心是增强判断。不要写成下次怎么做的改进计划，不要做心理诊断，不要把一次片段升级成稳定人生结论；关系相关内容只有在核心是理解规律或校准判断时才保留。"
        : isImprovementDimension
          ? input.draftBrief.improvementTrack === "repeat_good"
            ? "当前这篇 improvement 是重复好状态轨道。重点写清这次为什么顺、最关键的可重复条件和可控小调整；不要硬写问题检讨或自责。"
            : input.draftBrief.improvementTrack === "avoid_bad"
              ? "当前这篇 improvement 是避免坏状态轨道。重点写清具体卡点和可控小调整；不要把全局自责写成原因，也不要强行写可重复条件。"
              : "当前这篇 improvement 必须保持克制。不要写成建议、检讨书、心理诊断、OKR、KPI、待办清单或行动计划。"
          : null;

  return [
    {
      role: "system",
      content: [
        `你是幸福日志产品中的中文写作助手，要把${config.label}访谈整理成一份忠于用户原意的日志草稿。`,
        "不要写鸡汤，不做建议，不夸张，不补充用户没表达过的情节。",
        "content 必须是一篇可直接给用户阅读和继续编辑的日志正文，不要把结构槽位、小标题或字段名直接写出来。",
        "如果有多件事件，把几个片段自然并列写进同一篇日志里，保持一篇日志的连续读感；不要分条罗列，也不要强行写成总结。",
        voiceInstruction,
        narrativeInstruction,
        dimensionDraftInstruction,
        completionInstruction,
        dimensionTrackInstruction,
        input.generationMode === "refresh_minor"
          ? "这是一次基于已有日志的小幅刷新。优先保留当前草稿里已经成立的表达，只吸收最新补充，不要整篇推倒重写，更不要重复段落。"
          : input.generationMode === "refresh_major"
            ? "这是一次基于已有日志的重整。可以重排全文，但要继承当前草稿里已经准确、自然的表达，不要重复段落。"
            : null,
        toneBanInstruction,
        "日志必须基于上下文自动生成，不要反问用户要保留什么。",
        `只返回 JSON：${draftShape}`
      ].filter(Boolean).join("\n")
    },
    {
      role: "user",
      content: [
        `成稿蓝图:\n${JSON.stringify(input.draftBrief, null, 2)}`,
        `写作控制:\n${JSON.stringify(input.writingProfile, null, 2)}`,
        input.existingDraft
          ? `当前已有草稿:\n${JSON.stringify(input.existingDraft, null, 2)}`
          : null,
        `事件摘要:\n${formatEventSummaries(input.events, input.dimension)}`,
        `最近对话:\n${formatVisibleRecentMessages(input.messages)}`,
        `要求: title ${MAX_JOURNAL_TITLE_LENGTH} 字内，最好 6-12 字，是总结型短语；不要复述事件顺序，不要把长事件句截断成标题，不要使用“介绍怎么/有了之后/我就”等过程表达开头或结尾。content 按材料密度写成一篇完整日志，不硬压缩也不硬拉长；不要使用条目、小标题、字段名；eventBlocks 需要覆盖输入中的事件。`
      ].filter(Boolean).join("\n\n")
    }
  ];
}
