import {
  buildJoyDraftMessages,
  buildJoyExtractMessages,
  buildJoyQuestionMessages
} from "@/features/joy-interview/prompts/joy-prompts";
import type { DraftBrief, DraftWritingProfile, InterviewEventRecord, InterviewMessage, JoySnapshot } from "@/types/interview";

const baseSnapshot: JoySnapshot = {
  event: "今天和家人一起吃饭聊天",
  feeling: "轻松踏实",
  whyItMattered: "因为我很久没有这么松下来过了",
  happinessType: "关系型开心",
  selfPattern: null,
  joyMoment: "今天和家人一起吃饭聊天",
  joySource: "重新回到被陪伴接住的轻松里",
  stateShift: "更轻松",
  meaningNeed: "我在乎稳定的关系连接",
  manualClue: null,
  directionSignal: null,
  valueImpact: null,
  durability: "这种开心在饭后还延续了很久",
  tags: ["关系", "轻松"],
  confidence: 0.8,
  missingSlots: ["manualClue"]
};

const delightSnapshot: JoySnapshot = {
  event: "中午刷到一个反差特别强的搞笑短视频",
  feeling: "一下笑出来了",
  whyItMattered: "那几分钟里脑子一下轻了很多",
  happinessType: "轻快乐",
  selfPattern: null,
  joyMoment: "中午刷到一个反差特别强的搞笑短视频",
  joySource: "那种没负担又有反差感的好笑",
  stateShift: "更轻松",
  meaningNeed: null,
  manualClue: null,
  delightSignature: "我会被这种没负担又有反差感的内容一下子带动起来",
  directionSignal: null,
  valueImpact: null,
  durability: "这种开心虽然短，但会把状态拎起来一点",
  tags: ["轻松"],
  confidence: 0.84,
  missingSlots: []
};

const guardedDelightSnapshot: JoySnapshot = {
  event: "本来被对方惹得有点生气，后来他送了一朵花",
  feeling: "更愉悦",
  whyItMattered: "因为前面的低落让后面的惊喜更强",
  happinessType: "轻快乐",
  selfPattern: null,
  joyMoment: "本来被对方惹得有点生气，后来他送了一朵花",
  joySource: "被重新在意和安抚到的惊喜",
  stateShift: "更愉悦",
  meaningNeed: null,
  manualClue: null,
  delightSignature: null,
  directionSignal: null,
  valueImpact: null,
  durability: null,
  tags: ["关系"],
  confidence: 0.78,
  missingSlots: ["delightSignature"]
};

const baseEvent: InterviewEventRecord = {
  id: "event-1",
  sequence: 1,
  status: "ready_for_choice",
  stage: "wrap_up",
  explorationRound: 1,
  coveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
  roundCoveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
  roundMeaningfulReplyCount: 3,
  totalMeaningfulReplyCount: 3,
  startMessageSequence: 0,
  snapshot: baseSnapshot,
  draftSummary: null,
  startedAt: "2026-04-29T00:00:00.000Z",
  completedAt: null
};

const baseMessages: InterviewMessage[] = [
  {
    id: "user-1",
    role: "user",
    content: "今天和家人一起吃饭聊天，我一下子就放松下来了。",
    sequence: 1,
    createdAt: "2026-04-29T00:01:00.000Z"
  }
];

const fulfillmentSnapshot: JoySnapshot = {
  event: "今天把一个拖了很久的任务推进完了",
  feeling: "踏实",
  whyItMattered: "原本卡住的部分终于收口了",
  happinessType: "推进完成型",
  selfPattern: "我会对真正往前推进的感觉更有分量",
  confidence: 0.82,
  missingSlots: []
};

const fulfillmentEvent: InterviewEventRecord = {
  ...baseEvent,
  snapshot: fulfillmentSnapshot,
  stage: "probe_pattern",
  status: "active",
  coveredLenses: ["event_detail", "importance_reason"],
  roundCoveredLenses: ["event_detail", "importance_reason"]
};

const reflectionSnapshot: JoySnapshot = {
  event: "今天看完一个项目复盘",
  feeling: "警醒",
  whyItMattered: "我意识到自己以前太容易把忙碌当成进展",
  happinessType: "判断校准型",
  selfPattern: "以后判断进展时，要看判断依据有没有变清楚",
  confidence: 0.84,
  missingSlots: []
};

const reflectionEvent: InterviewEventRecord = {
  ...baseEvent,
  snapshot: reflectionSnapshot,
  stage: "probe_pattern",
  status: "active",
  coveredLenses: ["event_detail", "importance_reason"],
  roundCoveredLenses: ["event_detail", "importance_reason"]
};

const improvementSnapshot: JoySnapshot = {
  event: "今天开会时我有点急，对方问题还没说完我就开始解释",
  feeling: "有点急",
  whyItMattered: "回答太快，没有先确认问题",
  happinessType: "沟通节奏",
  selfPattern: "下次先复述一遍问题，再开始回答",
  improvementTrack: "avoid_bad",
  stateAssessment: "没听完整就回应，导致理解偏了",
  frictionPoint: "回答太快，没有先确认问题",
  repeatCondition: null,
  controllableFactor: "回答前先确认理解",
  nextAttempt: "下次先复述一遍问题，再开始回答",
  successSignal: "对方确认我理解对了",
  confidence: 0.84,
  missingSlots: []
};

const gratitudeSnapshot: JoySnapshot = {
  event: "今天同事看出我快撑不住，帮我先理清优先级",
  feeling: "被接住",
  whyItMattered: "它让我觉得自己不是一个人在扛",
  happinessType: "支持回应型",
  selfPattern: "这样的关系回应值得我珍惜，也值得我学习",
  gratitudeMoment: "今天同事看出我快撑不住，帮我先理清优先级",
  gratitudeTarget: "同事",
  kindAction: "看出我快撑不住，帮我先理清优先级",
  seenNeed: "我当时需要有人帮我把混乱的事情理清",
  innerEffect: "被稳稳接住",
  gratitudeReason: "它让我觉得自己不是一个人在扛",
  gratitudeType: "支持回应型",
  relationshipSignal: "这样的关系回应值得我珍惜，也值得我学习",
  reciprocityHint: "我也想学习这种先看见别人处境的方式",
  tags: ["协作", "支持"],
  confidence: 0.88,
  missingSlots: []
};

function buildBrief(overrides: Partial<DraftBrief> = {}): DraftBrief {
  return {
    dimension: "joy",
    completionMode: "complete",
    compositionMode: "single_moment",
    emphasis: "mixed",
    anchorScene: "今天和家人一起吃饭聊天",
    emotionalCore: "重新回到被陪伴接住的轻松里",
    stateOrNeed: "更轻松；我在乎稳定的关系连接",
    closingInsight: "当我和熟悉的人慢下来相处时，我会恢复能量",
    supportingMoments: [],
    directionSignal: null,
    valueSignal: null,
    durabilitySignal: "这种开心在饭后还延续了很久",
    titleHint: "今天和家人一起吃饭聊天",
    theorySummary: "这份开心真正有分量，不只是一起做了什么，而是重新回到被陪伴接住、能慢慢松下来的感觉。",
    titleTheme: "被陪伴接住",
    titleCandidates: ["被陪伴接住", "慢慢松下来"],
    antiFlatteningTargets: ["不要只写吃饭聊天本身", "要写被陪伴接住之后为什么会松下来"],
    tags: ["关系", "轻松"],
    ...overrides
  };
}

function buildWritingProfile(overrides: Partial<DraftWritingProfile> = {}): DraftWritingProfile {
  return {
    voiceMode: "journal",
    narrativeOrder: "scene_core_shift_close",
    closingMode: "stable_clue",
    toneBanSet: ["这次访谈", "我已经整理出", "使用说明书", "当前版本日志"],
    ...overrides
  };
}

describe("buildJoyDraftMessages", () => {
  it("embeds the writing profile into the prompt payload", () => {
    const messages = buildJoyDraftMessages({
      dimension: "joy",
      draftBrief: buildBrief(),
      writingProfile: buildWritingProfile(),
      events: [baseEvent],
      messages: baseMessages
    });

    expect(messages[1]?.content).toContain("写作控制");
    expect(messages[1]?.content).toContain("理论解释层");
    expect(messages[1]?.content).toContain('"titleTheme": "被陪伴接住"');
    expect(messages[1]?.content).toContain('"voiceMode": "journal"');
    expect(messages[1]?.content).toContain('"narrativeOrder": "scene_core_shift_close"');
    expect(messages[1]?.content).toContain('"closingMode": "stable_clue"');
    expect(messages[0]?.content).toContain("整篇必须像日志，不像总结");
    expect(messages[0]?.content).toContain("开头先从具体片段进入");
    expect(messages[0]?.content).toContain("先理解这段材料为什么在开心维度成立");
    expect(messages[0]?.content).toContain("正文按自然段组织");
    expect(messages[0]?.content).toContain("不要把几句短句机械拆成一行一段");
    expect(messages[1]?.content).toContain("按材料密度写成一篇完整日志");
    expect(messages[1]?.content).toContain("没有明显语义切换时不要换段");
    expect(messages[1]?.content).toContain("不要把每句话拆成独立段落");
    expect(messages[1]?.content).toContain("title 16 字内");
  });

  it("injects a guarded follow-up hint when delight material contains a negative setup", () => {
    const messages = buildJoyQuestionMessages({
      dimension: "joy",
      stage: "probe_pattern",
      userMessage: "我觉得还是因为前面情绪太低，后面收到花才特别惊喜。",
      snapshot: guardedDelightSnapshot,
      events: [
        {
          ...baseEvent,
          snapshot: guardedDelightSnapshot,
          stage: "probe_pattern",
          status: "active",
          coveredLenses: ["event_detail", "importance_reason"],
          roundCoveredLenses: ["event_detail", "importance_reason"]
        }
      ],
      activeEvent: {
        ...baseEvent,
        snapshot: guardedDelightSnapshot,
        stage: "probe_pattern",
        status: "active",
        coveredLenses: ["event_detail", "importance_reason"],
        roundCoveredLenses: ["event_detail", "importance_reason"]
      },
      messages: baseMessages,
      nextTurnCount: 3,
      nextEventTurnCount: 3,
      previousDepthReached: ["event", "reason"],
      nextDepthReached: ["event", "reason", "clue"],
      coveredLenses: ["event_detail", "importance_reason"],
      roundCoveredLenses: ["event_detail", "importance_reason"],
      isMeaningfulReply: true,
      action: "reply",
      memoryContext: null
    });

    expect(messages[1]?.content).toContain('"followUpQuestionHint": "如果把前面的情绪起伏先放在旁边，真正最打动你的，是被送花重新在意到的惊喜里的哪一层？"');
    expect(messages[1]?.content).not.toContain("低落多久");
    expect(messages[1]?.content).not.toContain("内容、节奏或场景最容易把你带进去");
  });

  it("switches the joy closing instruction when the writing profile is in current-understanding mode", () => {
    const messages = buildJoyDraftMessages({
      dimension: "joy",
      draftBrief: buildBrief({
        completionMode: "user_override_partial",
        closingInsight: null
      }),
      writingProfile: buildWritingProfile({
        closingMode: "current_understanding"
      }),
      events: [baseEvent],
      messages: baseMessages
    });

    expect(messages[0]?.content).toContain("整篇必须像日志，不像总结");
    expect(messages[0]?.content).toContain("正文默认按“片段进入 -> 真正开心点/核心感受 -> 状态变化或被满足的在乎/被带动的方式 -> 结尾轻收”组织。");
    expect(messages[0]?.content).toContain("结尾只能写成当前发现");
    expect(messages[0]?.content).toContain("如果有多件事件，把几个片段自然并列写进同一篇日志里");
    expect(messages[0]?.content).toContain("输出中明确禁止系统话术、字段词、总结腔、建议腔");
  });

  it("tells the writer not to hard-upgrade delight-track joy into life meaning", () => {
    const messages = buildJoyDraftMessages({
      dimension: "joy",
      draftBrief: buildBrief({
        anchorScene: delightSnapshot.joyMoment,
        emotionalCore: delightSnapshot.joySource,
        stateOrNeed: delightSnapshot.stateShift,
        closingInsight: delightSnapshot.delightSignature,
        joyTrack: "delight_track",
        joyKind: "pure_delight",
        closureTarget: "delight_signature"
      }),
      writingProfile: buildWritingProfile(),
      events: [
        {
          ...baseEvent,
          snapshot: delightSnapshot
        }
      ],
      messages: baseMessages
    });

    expect(messages[0]?.content).toContain("当前这篇 joy 更像纯粹开心或恢复型开心");
    expect(messages[0]?.content).toContain("不要硬写价值、方向、人生规律");
    expect(messages[0]?.content).toContain("结尾要自然收束出这条已经成立的轻快乐线索");
    expect(messages[1]?.content).toContain('"closureTarget": "delight_signature"');
  });

  it("guides fulfillment drafts around not-wasted evidence without forcing value standards", () => {
    const messages = buildJoyDraftMessages({
      dimension: "fulfillment",
      draftBrief: buildBrief({
        dimension: "fulfillment",
        completionMode: "user_override_partial",
        anchorScene: fulfillmentSnapshot.event,
        emotionalCore: fulfillmentSnapshot.whyItMattered,
        stateOrNeed: fulfillmentSnapshot.feeling,
        closingInsight: null,
        directionSignal: fulfillmentSnapshot.happinessType,
        valueSignal: null,
        titleHint: fulfillmentSnapshot.event,
        tags: ["推进完成型", "踏实"]
      }),
      writingProfile: buildWritingProfile({
        closingMode: "current_understanding",
        toneBanSet: ["周报腔", "汇报腔", "绩效总结", "成长口号"]
      }),
      events: [fulfillmentEvent],
      messages: baseMessages
    });

    expect(messages[0]?.content).toContain("为什么让今天不算白过");
    expect(messages[0]?.content).toContain("推进、练到、积累、收口或帮到别人的真实证据");
    expect(messages[0]?.content).toContain("结尾只能停在“这件事为什么让今天不算白过”的当前理解");
    expect(messages[0]?.content).toContain("不要硬写值得感标准");
    expect(messages[0]?.content).toContain("不要填写 selfPattern");
    expect(messages[0]?.content).toContain("不是周报、汇报或绩效总结");
    expect(messages[0]?.content).toContain("不要罗列完成事项");
    expect(messages[0]?.content).not.toContain("真正开心点/核心感受");
  });

  it("guides reflection drafts around concrete trigger, insight, and judgment shift", () => {
    const messages = buildJoyDraftMessages({
      dimension: "reflection",
      draftBrief: buildBrief({
        dimension: "reflection",
        completionMode: "complete",
        anchorScene: reflectionSnapshot.event,
        emotionalCore: reflectionSnapshot.whyItMattered,
        stateOrNeed: reflectionSnapshot.feeling,
        closingInsight: reflectionSnapshot.selfPattern,
        directionSignal: reflectionSnapshot.happinessType,
        valueSignal: reflectionSnapshot.selfPattern,
        titleHint: reflectionSnapshot.whyItMattered,
        tags: ["判断校准型", "警醒"]
      }),
      writingProfile: buildWritingProfile({
        closingMode: "stable_clue",
        toneBanSet: ["人生感悟", "心理诊断", "行动计划", "方法论总结"]
      }),
      events: [reflectionEvent],
      messages: baseMessages
    });

    expect(messages[0]?.content).toContain("触发思考的具体片段");
    expect(messages[0]?.content).toContain("带来了什么新发现");
    expect(messages[0]?.content).toContain("判断线索");
    expect(messages[0]?.content).toContain("不要写成下次怎么做的改进计划");
    expect(messages[0]?.content).toContain("不要做心理诊断");
    expect(messages[1]?.content).toContain('"dimension": "reflection"');
  });

  it("guides improvement drafts around scene, track, controllable adjustment, and light next attempt", () => {
    const messages = buildJoyDraftMessages({
      dimension: "improvement",
      draftBrief: buildBrief({
        dimension: "improvement",
        completionMode: "user_override_partial",
        anchorScene: improvementSnapshot.event,
        emotionalCore: improvementSnapshot.frictionPoint,
        stateOrNeed: improvementSnapshot.stateAssessment,
        closingInsight: null,
        improvementTrack: "avoid_bad",
        frictionPoint: improvementSnapshot.frictionPoint,
        repeatCondition: null,
        controllableFactor: improvementSnapshot.controllableFactor,
        nextAttempt: null,
        successSignal: null,
        directionSignal: improvementSnapshot.happinessType,
        valueSignal: improvementSnapshot.controllableFactor,
        durabilitySignal: null,
        titleHint: improvementSnapshot.controllableFactor,
        tags: ["沟通节奏"]
      }),
      writingProfile: buildWritingProfile({
        closingMode: "current_understanding",
        toneBanSet: ["检讨书腔", "自责腔", "效率工具建议腔", "心理诊断腔"]
      }),
      events: [{ ...baseEvent, snapshot: improvementSnapshot }],
      messages: baseMessages
    });

    expect(messages[0]?.content).toContain("具体改进情境");
    expect(messages[0]?.content).toContain("关键条件或卡点");
    expect(messages[0]?.content).toContain("用户能调整的一小处");
    expect(messages[0]?.content).toContain("不要硬写 nextAttempt");
    expect(messages[0]?.content).toContain("避免坏状态轨道");
    expect(messages[0]?.content).toContain("不要把全局自责写成原因");
    expect(messages[0]?.content).toContain("检讨书腔");
    expect(messages[1]?.content).toContain('"dimension": "improvement"');
    expect(messages[1]?.content).toContain('"improvementTrack": "avoid_bad"');
  });

  it("guides gratitude drafts around concrete kindness and seen needs", () => {
    const messages = buildJoyDraftMessages({
      dimension: "gratitude",
      draftBrief: buildBrief({
        dimension: "gratitude",
        completionMode: "complete",
        anchorScene: gratitudeSnapshot.gratitudeMoment,
        emotionalCore: gratitudeSnapshot.kindAction,
        stateOrNeed: gratitudeSnapshot.seenNeed,
        closingInsight: gratitudeSnapshot.relationshipSignal,
        directionSignal: gratitudeSnapshot.gratitudeType,
        valueSignal: gratitudeSnapshot.gratitudeTarget,
        durabilitySignal: gratitudeSnapshot.reciprocityHint,
        titleHint: gratitudeSnapshot.seenNeed,
        tags: ["协作", "支持"]
      }),
      writingProfile: buildWritingProfile({
        closingMode: "stable_clue",
        toneBanSet: ["感谢信模板", "道德负债感", "报答任务"]
      }),
      events: [{ ...baseEvent, snapshot: gratitudeSnapshot }],
      messages: baseMessages
    });

    expect(messages[0]?.content).toContain("具体感谢片段");
    expect(messages[0]?.content).toContain("对方具体做了什么");
    expect(messages[0]?.content).toContain("回应了我的什么需要");
    expect(messages[0]?.content).toContain("不要写成感谢信模板");
    expect(messages[0]?.content).toContain("报答任务");
    expect(messages[1]?.content).toContain('"dimension": "gratitude"');
    expect(messages[1]?.content).toContain('"valueSignal": "同事"');
  });
});

describe("fulfillment prompt strategy", () => {
  it("defines thinkingSummary as a direct visible reasoning layer, not a second question", () => {
    const messages = buildJoyQuestionMessages({
      dimension: "fulfillment",
      stage: "probe_pattern",
      userMessage: "今天写文章的时候，终于把一个段落写顺了。",
      snapshot: fulfillmentSnapshot,
      events: [fulfillmentEvent],
      activeEvent: fulfillmentEvent,
      messages: baseMessages,
      nextTurnCount: 3,
      nextEventTurnCount: 3,
      previousDepthReached: ["event", "reason"],
      nextDepthReached: ["pattern"],
      coveredLenses: ["event_detail", "importance_reason"],
      roundCoveredLenses: ["event_detail", "importance_reason"],
      isMeaningfulReply: true,
      action: "reply"
    });

    expect(messages[0]?.content).toContain("thinkingSummary 是给用户看的浅色思路层");
    expect(messages[0]?.content).toContain("直接写出你如何理解用户刚刚回复，以及接下来处理这个问题的焦点");
    expect(messages[0]?.content).toContain("不要使用“我理解到的是”“我会”“我想知道”");
    expect(messages[0]?.content).toContain("thinkingSummary 不能写成问句，不能带问号，不能变成第二个追问");
    expect(messages[1]?.content).toContain("理论解释层");
    expect(messages[1]?.content).toContain('"themeLabel"');
    expect(messages[1]?.content).toContain('"theorySummary"');
  });

  it("uses fulfillment field semantics and snapshot shape in extraction prompts", () => {
    const messages = buildJoyExtractMessages({
      dimension: "fulfillment",
      stage: "probe_pattern",
      turnCount: 2,
      lastAssistantQuestion: "这件事里真正让你觉得没有白过的证据是什么？",
      userMessage: "今天把一个拖了很久的任务推进完了，原本卡住的部分终于收口了。",
      snapshot: fulfillmentSnapshot,
      messages: baseMessages
    });

    expect(messages[0]?.content).toContain("experience=具体充实片段");
    expect(messages[0]?.content).toContain("progressEvidence=没有白过的进展证据");
    expect(messages[0]?.content).toContain("valueSignal=值得感标准");
    expect(messages[0]?.content).toContain("不要把普通忙碌、任务很多、踏实情绪直接抽成进展证据");
    expect(messages[1]?.content).toContain('"experience": "今天把一个拖了很久的任务推进完了"');
    expect(messages[1]?.content).toContain('"progressEvidence": "原本卡住的部分终于收口了"');
    expect(messages[1]?.content).toContain('"valueSignal": "我会对真正往前推进的感觉更有分量"');
    expect(messages[1]?.content).not.toContain("joyMoment");
  });

  it("guides fulfillment follow-up questions toward evidence before worth standards", () => {
    const messages = buildJoyQuestionMessages({
      dimension: "fulfillment",
      stage: "probe_pattern",
      userMessage: "今天把一个拖了很久的任务推进完了，原本卡住的部分终于收口了。",
      snapshot: fulfillmentSnapshot,
      events: [fulfillmentEvent],
      activeEvent: fulfillmentEvent,
      messages: baseMessages,
      nextTurnCount: 3,
      nextEventTurnCount: 3,
      previousDepthReached: ["event", "reason"],
      nextDepthReached: ["pattern"],
      coveredLenses: ["event_detail", "importance_reason"],
      roundCoveredLenses: ["event_detail", "importance_reason"],
      isMeaningfulReply: true,
      action: "reply"
    });

    expect(messages[0]?.content).toContain("哪件事让这一天不算白过");
    expect(messages[0]?.content).toContain("最后才问什么样的努力对用户来说算数");
    expect(messages[0]?.content).toContain("不要直接问抽象价值观");
    expect(messages[1]?.content).toContain('"experience": "今天把一个拖了很久的任务推进完了"');
    expect(messages[1]?.content).not.toContain("joyTrack");
  });
});

describe("reflection prompt strategy", () => {
  it("uses reflection field semantics and snapshot shape in extraction prompts", () => {
    const messages = buildJoyExtractMessages({
      dimension: "reflection",
      stage: "probe_pattern",
      turnCount: 2,
      lastAssistantQuestion: "这个片段让你看见了什么新的理解，或者让原来的判断哪里变清楚了？",
      userMessage: "今天看完项目复盘后，我意识到自己以前太容易把忙碌当成进展。",
      snapshot: reflectionSnapshot,
      messages: baseMessages
    });

    expect(messages[0]?.content).toContain("event=触发思考的具体片段");
    expect(messages[0]?.content).toContain("whyItMattered=新发现/新理解");
    expect(messages[0]?.content).toContain("happinessType=规律发现型/方向优势型/判断校准型");
    expect(messages[0]?.content).toContain("selfPattern=视角变化或判断线索");
    expect(messages[0]?.content).toContain("不要把“想了很多”“有点焦虑”直接当成触发片段");
    expect(messages[1]?.content).toContain('"trigger": "今天看完一个项目复盘"');
    expect(messages[1]?.content).toContain('"insight": "我意识到自己以前太容易把忙碌当成进展"');
    expect(messages[1]?.content).toContain('"viewpointShift": "以后判断进展时，要看判断依据有没有变清楚"');
    expect(messages[1]?.content).not.toContain("joyMoment");
  });

  it("guides reflection follow-up questions toward evidence and judgment clues", () => {
    const messages = buildJoyQuestionMessages({
      dimension: "reflection",
      stage: "probe_pattern",
      userMessage: "真正有进展的是能说明判断依据变清楚了。",
      snapshot: reflectionSnapshot,
      events: [reflectionEvent],
      activeEvent: reflectionEvent,
      messages: baseMessages,
      nextTurnCount: 3,
      nextEventTurnCount: 3,
      previousDepthReached: ["event", "reason"],
      nextDepthReached: ["pattern"],
      coveredLenses: ["event_detail", "importance_reason"],
      roundCoveredLenses: ["event_detail", "importance_reason"],
      isMeaningfulReply: true,
      action: "reply"
    });

    expect(messages[0]?.content).toContain("从当天具体片段里看见新的规律");
    expect(messages[0]?.content).toContain("最后才问视角变化或判断线索");
    expect(messages[0]?.content).toContain("不要写成行动计划");
    expect(messages[0]?.content).toContain("更适合改进维度");
    expect(messages[1]?.content).toContain('"reflectionType": "判断校准型"');
    expect(messages[1]?.content).not.toContain("joyTrack");
  });
});

describe("improvement prompt strategy", () => {
  it("uses dedicated improvement extraction fields and guardrails", () => {
    const messages = buildJoyExtractMessages({
      dimension: "improvement",
      stage: "probe_reason",
      turnCount: 2,
      lastAssistantQuestion: "这个情境为什么会让你觉得这里值得调整一下？",
      userMessage: "后来发现他问的其实是另一个点。下次我想先复述一遍问题，再开始回答。",
      snapshot: improvementSnapshot,
      messages: baseMessages
    });

    expect(messages[0]?.content).toContain('"situation":string|null');
    expect(messages[0]?.content).toContain('"improvementTrack":"repeat_good"|"avoid_bad"|null');
    expect(messages[0]?.content).toContain("不能把“我很差”“我不行”这类全局自责抽成 frictionPoint");
    expect(messages[0]?.content).toContain("avoid_bad 需要抽 frictionPoint");
    expect(messages[0]?.content).toContain("repeat_good 需要抽 repeatCondition");
    expect(messages[0]?.content).toContain("留给下一轮追问");
    expect(messages[0]?.content).toContain("controllableFactor 必须是用户能调整的一小块");
    expect(messages[0]?.content).toContain("nextAttempt 必须是具体动作");
    expect(messages[0]?.content).toContain("不要输出旧字段名");
    expect(messages[1]?.content).toContain('"improvementTrack": "avoid_bad"');
    expect(messages[1]?.content).toContain('"frictionPoint": "回答太快，没有先确认问题"');
    expect(messages[1]?.content).toContain('"nextAttempt": "下次先复述一遍问题，再开始回答"');
    expect(messages[1]?.content).not.toContain("joyTrack");
  });

  it("guides improvement follow-up questions toward tracks, controllable factors and minimum actions", () => {
    const messages = buildJoyQuestionMessages({
      dimension: "improvement",
      stage: "probe_pattern",
      userMessage: "下次我能先复述一遍问题，再开始回答。",
      snapshot: improvementSnapshot,
      events: [{ ...baseEvent, snapshot: improvementSnapshot, stage: "probe_pattern", status: "active" }],
      activeEvent: { ...baseEvent, snapshot: improvementSnapshot, stage: "probe_pattern", status: "active" },
      messages: baseMessages,
      nextTurnCount: 3,
      nextEventTurnCount: 3,
      previousDepthReached: ["event", "reason"],
      nextDepthReached: ["pattern"],
      coveredLenses: ["event_detail", "importance_reason"],
      roundCoveredLenses: ["event_detail", "importance_reason"],
      isMeaningfulReply: true,
      action: "reply"
    });

    expect(messages[0]?.content).toContain("帮助用户把一次好/坏状态");
    expect(messages[0]?.content).toContain("重复好状态还是避免坏状态");
    expect(messages[0]?.content).toContain("用户能调整的一小处");
    expect(messages[0]?.content).toContain("下次最小动作");
    expect(messages[0]?.content).toContain("不要说“你应该怎么做”“制定一个计划”“你为什么会这样”“以后一定要”");
    expect(messages[1]?.content).toContain('"improvementTrack": "avoid_bad"');
    expect(messages[1]?.content).toContain('"controllableFactor": "回答前先确认理解"');
    expect(messages[1]?.content).not.toContain("joyTrack");
  });
});

describe("gratitude prompt strategy", () => {
  it("uses dedicated gratitude extraction fields and guardrails", () => {
    const messages = buildJoyExtractMessages({
      dimension: "gratitude",
      stage: "probe_reason",
      turnCount: 2,
      lastAssistantQuestion: "对方当时具体做了什么，又像是看见了你什么需要或难处？",
      userMessage: "同事看出我快撑不住，帮我先理清优先级，让我觉得自己不是一个人在扛。",
      snapshot: gratitudeSnapshot,
      messages: baseMessages
    });

    expect(messages[0]?.content).toContain('"gratitudeMoment":string|null');
    expect(messages[0]?.content).toContain("kindAction=对方具体做了什么");
    expect(messages[0]?.content).toContain("seenNeed=对方看见并回应了我的什么需要或难处");
    expect(messages[0]?.content).toContain("relationshipSignal 只能在用户表达值得珍惜");
    expect(messages[0]?.content).toContain("不要抽成“我要报答/还人情”");
    expect(messages[1]?.content).toContain('"gratitudeTarget": "同事"');
    expect(messages[1]?.content).toContain('"kindAction": "看出我快撑不住，帮我先理清优先级"');
    expect(messages[1]?.content).toContain('"seenNeed": "我当时需要有人帮我把混乱的事情理清"');
    expect(messages[1]?.content).not.toContain("joyTrack");
  });

  it("guides gratitude follow-up questions toward action, seen need, and relationship clues", () => {
    const messages = buildJoyQuestionMessages({
      dimension: "gratitude",
      stage: "probe_pattern",
      userMessage: "那一刻我觉得自己不是一个人在扛。",
      snapshot: gratitudeSnapshot,
      events: [{ ...baseEvent, snapshot: gratitudeSnapshot, stage: "probe_pattern", status: "active" }],
      activeEvent: { ...baseEvent, snapshot: gratitudeSnapshot, stage: "probe_pattern", status: "active" },
      messages: baseMessages,
      nextTurnCount: 3,
      nextEventTurnCount: 3,
      previousDepthReached: ["event", "reason"],
      nextDepthReached: ["pattern"],
      coveredLenses: ["event_detail", "importance_reason"],
      roundCoveredLenses: ["event_detail", "importance_reason"],
      isMeaningfulReply: true,
      action: "reply"
    });

    expect(messages[0]?.content).toContain("谁识别并回应了用户的需要");
    expect(messages[0]?.content).toContain("最后才问这类关系回应为什么值得珍惜或学习");
    expect(messages[0]?.content).toContain("不要把感谢问成感谢信、道德负债、报答任务");
    expect(messages[1]?.content).toContain('"relationshipSignal": "这样的关系回应值得我珍惜，也值得我学习"');
    expect(messages[1]?.content).not.toContain("joyTrack");
  });
});

describe("memory context injection", () => {
  const questionInput = {
    dimension: "joy" as const,
    stage: "probe_pattern" as const,
    userMessage: "今天在公园散步感觉很平静。",
    snapshot: baseSnapshot,
    events: [{ ...baseEvent, stage: "probe_pattern" as const, status: "active" as const }],
    activeEvent: { ...baseEvent, stage: "probe_pattern" as const, status: "active" as const },
    messages: baseMessages,
    nextTurnCount: 3,
    nextEventTurnCount: 3,
    previousDepthReached: ["event" as const],
    nextDepthReached: ["feeling" as const],
    coveredLenses: ["event_detail" as const],
    roundCoveredLenses: ["event_detail" as const],
    isMeaningfulReply: true,
    action: "reply" as const
  };

  it("injects memory context into user message when provided", () => {
    const memoryContext = [
      "【用户画像 — 已有认知】",
      "# 开心维度",
      "- 用户喜欢在公园跑步时获得平静感 [运动, 独处]",
      "以上是对此用户的历史认知，仅供参考，不要在对话中直接引用或提及这些记忆。"
    ].join("\n");

    const messages = buildJoyQuestionMessages({
      ...questionInput,
      memoryContext
    });

    expect(messages[1]?.content).toContain("用户画像");
    expect(messages[1]?.content).toContain("用户喜欢在公园跑步时获得平静感");
  });

  it("omits memory section when memoryContext is not provided", () => {
    const messages = buildJoyQuestionMessages(questionInput);

    expect(messages[1]?.content).not.toContain("用户画像");
  });

  it("omits memory section when memoryContext is null", () => {
    const messages = buildJoyQuestionMessages({
      ...questionInput,
      memoryContext: null
    });

    expect(messages[1]?.content).not.toContain("用户画像");
  });
});
