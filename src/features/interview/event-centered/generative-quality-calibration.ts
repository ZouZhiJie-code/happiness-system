import type { JournalEventAngle } from "@/types/journal-event-angle-outcome";

export const GENERATIVE_QUALITY_CALIBRATION_VERSION = "2026-07-30.v4";
export const GENERATIVE_ARCHITECTURE_PROBE_VERSION = "2026-07-29.v4";
export const GENERATIVE_DEVELOPMENT_DATASET_VERSION = "2026-07-30.v3";

export const GENERATIVE_INSIGHT_KINDS = [
  "distinction",
  "connection",
  "tension",
  "meaning",
  "function",
  "scope_only"
] as const;

export type GenerativeInsightKind = (typeof GENERATIVE_INSIGHT_KINDS)[number];
export type GenerativeCalibrationMode = "guided_reflection" | "deep_conversation";
export type GenerativeOutcomeOrigin = "user_articulated" | "ai_synthesized";

export type GenerativeQuestionIntentCalibration = {
  currentQuestion: string;
  targetId: string;
  semanticGoal: string;
  minimumAnswerScope: string;
  answerCoverage:
    | "partial"
    | "minimum_scope_complete"
    | "semantic_goal_complete";
};

export type GenerativeOutcomeCalibrationExample = GenerativeQuestionIntentCalibration & {
  id: string;
  state: "ready";
  origin: GenerativeOutcomeOrigin;
  userContext: string;
  currentUserText: string;
  expectedAction: "complete" | "pause";
  insightKind: Exclude<GenerativeInsightKind, "scope_only">;
  expectedUnderstandingDelta: string;
  goodThinkingSummary: null;
  goodResponseKind: "insight";
  goodResponse: string;
  whyValuable: string;
  inferenceBoundary: string;
};

export type GenerativeCalibrationCounterpartExample =
  GenerativeQuestionIntentCalibration & {
    id: string;
    state: "ask" | "ready";
    userContext: string;
    currentUserText: string;
    expectedAction: "ask" | "complete" | "pause";
    insightKind: Exclude<GenerativeInsightKind, "scope_only"> | null;
    expectedUnderstandingDelta: string;
    goodThinkingSummary: string | null;
    goodResponseKind: "question" | "insight";
    goodResponse: string;
    whyValuable: string;
    inferenceBoundary: string;
  };

export type GenerativeQualityCalibrationCard = GenerativeQuestionIntentCalibration & {
  id: string;
  scenarioFamily: string;
  angle: JournalEventAngle;
  mode: GenerativeCalibrationMode;
  userContext: string;
  currentUserText: string;
  expectedAction: "ask" | "complete" | "pause";
  insightKind: Exclude<GenerativeInsightKind, "scope_only">;
  expectedUnderstandingDelta: string;
  goodThinkingSummary: string | null;
  goodResponseKind: "question" | "insight";
  goodResponse: string;
  whyValuable: string;
  inferenceBoundary: string;
  decisionBoundary: string;
  hardFailExamples: string[];
  outcomeExamples: {
    userArticulated: GenerativeOutcomeCalibrationExample;
    aiSynthesized: GenerativeOutcomeCalibrationExample;
  };
  counterpartExample: GenerativeCalibrationCounterpartExample;
  honestLimitExample: {
    state: "honest_limit";
    userContext: string;
    currentUserText: string;
    expectedAction: "honest_limit";
    insightKind: "scope_only";
    expectedUnderstandingDelta: null;
    goodThinkingSummary: null;
    goodResponseKind: "honest_limit";
    goodResponse: string;
    whyValuable: string;
    inferenceBoundary: string;
  };
};

/**
 * 产品负责人校准“什么才算有认识增量”的质量卡。
 * 每轮只选择同角度、同模式的一张卡作为质量参考。模型只学习认知层级、
 * 表达结构与失败边界，卡片故事不能作为当前用户事实。
 */
type RawGenerativeQualityCalibrationCard = Omit<
  GenerativeQualityCalibrationCard,
  | "honestLimitExample"
  | "outcomeExamples"
  | "counterpartExample"
  | keyof GenerativeQuestionIntentCalibration
> & {
  counterpartExample: Omit<
    GenerativeCalibrationCounterpartExample,
    keyof GenerativeQuestionIntentCalibration
  >;
};

type RawGenerativeOutcomeCalibrationExample = Omit<
  GenerativeOutcomeCalibrationExample,
  keyof GenerativeQuestionIntentCalibration
>;

const BASE_GENERATIVE_QUALITY_CALIBRATION_CARDS: RawGenerativeQualityCalibrationCard[] = [
  {
    id: "CAL-FEELING-GUIDED",
    scenarioFamily: "presentation_end_body_lag",
    angle: "feeling",
    mode: "guided_reflection",
    userContext: "汇报结果顺利，但用户离开会议室后仍缓不过来。",
    currentUserText: "走到茶水间时手还在抖，肩膀也一直耸着，直到喝完水才松下来。",
    expectedAction: "complete",
    insightKind: "connection",
    expectedUnderstandingDelta: "看见事情结束与身体结束并不同步。",
    goodThinkingSummary: "主管说汇报顺利后，你走到茶水间手还在抖、肩膀还耸着，喝完水才松下来；这一段的时间点已经很完整。",
    goodResponseKind: "insight",
    goodResponse: "这次汇报先在流程上结束，身体又晚了一会儿才结束紧绷。",
    whyValuable: "把三个分散事实综合成用户此前没有明确说出的时间差。",
    inferenceBoundary: "只描述本次身体变化，不解释为焦虑、创伤或长期模式。",
    decisionBoundary: "身体变化或准确感受仍不清楚时继续问；事件节点与身体状态的区别或变化关系已经说清时完成。",
    hardFailExamples: [
      "重复列出手抖、肩膀紧和喝水后放松。",
      "成果只写‘身体紧张直到后来才缓解’。"
    ],
    counterpartExample: {
      id: "CAL-FEELING-GUIDED-ASK",
      state: "ask",
      userContext: "上一问请用户分别说明活动结束后的轻松与空落来自哪里；用户只说清轻松来自不用继续协调，空落的一侧仍未回答。",
      currentUserText: "轻松是终于不用再协调了；空的那部分我还说不清，只记得收起胸牌时心口往下坠。",
      expectedAction: "ask",
      insightKind: null,
      expectedUnderstandingDelta: "从收起胸牌的当下材料换一个入口，获得能帮助理解空落的一条具体画面或念头。",
      goodThinkingSummary: "不用继续协调带来的轻松已经清楚，空落的部分暂时还说不清。这一次回到收起胸牌的当下，只找最先出现的一条具体材料。",
      goodResponseKind: "question",
      goodResponse: "收起胸牌时，你脑中最先闪过的一个画面或念头是什么？",
      whyValuable: "用户明确说不清后，只使用一次不同入口；问题回到当前时刻和已有身体信号，不重复索要抽象解释。",
      inferenceBoundary: "不提供失去身份、舍不得结束或长期依赖等候选解释；同一目标再次说不清时停止追问。"
    }
  },
  {
    id: "CAL-FEELING-DEEP",
    scenarioFamily: "cancellation_relief_fatigue",
    angle: "feeling",
    mode: "deep_conversation",
    userContext: "朋友临时取消见面，用户既生气又松口气。",
    currentUserText: "我既气他临时说，也发现自己最近每次赴约前都很累。",
    expectedAction: "ask",
    insightKind: "connection",
    expectedUnderstandingDelta: "理解‘不用硬撑’具体松开了哪一份负担。",
    goodThinkingSummary: "你同时提到临时取消带来的生气，以及‘不用硬撑’时的松动。这里先沿着后者，看最近赴约前的累在这次反应里的具体位置。",
    goodResponseKind: "question",
    goodResponse: "‘不用硬撑’里，最让你松下来的具体是哪一部分？",
    whyValuable: "先后关系已经明确，问题继续理解轻松在回应哪一份负担。",
    inferenceBoundary: "疲惫与松口气保持可否认，不推断用户不想维持友谊。",
    decisionBoundary: "混合感受仍缺少具体回应对象时继续问；每种感受在回应什么以及两者怎样共存已经说清时暂停。",
    hardFailExamples: [
      "抽象询问‘累和松口气有什么关系’。",
      "直接断言用户其实不想赴约。"
    ],
    counterpartExample: {
      id: "CAL-FEELING-DEEP-READY",
      state: "ready",
      userContext: "旅行返程时，用户一边舍不得同行的人，一边为不用继续赶行程而放松。",
      currentUserText: "列车开走时我掉了眼泪，可想到明天不用再赶路，肩膀也松了；舍不得的是人，轻松的是身体终于不用撑了。",
      expectedAction: "pause",
      insightKind: "distinction",
      expectedUnderstandingDelta: "区分舍不得回应同行关系，轻松回应体力负担。",
      goodThinkingSummary: "列车开走时你掉了眼泪，想到不用赶路时肩膀松了；你也分别说出了舍不得和轻松各自落在什么事情上。",
      goodResponseKind: "insight",
      goodResponse: "舍不得和轻松同时成立，因为它们分别在回应告别与体力负担，并不互相否定。",
      whyValuable: "感受对象已清楚，继续追问只会重复已有区分。",
      inferenceBoundary: "只收束本次返程，不扩大为用户对旅行或关系的稳定模式。"
    }
  },
  {
    id: "CAL-THOUGHT-GUIDED",
    scenarioFamily: "single_lapse_invalidates_preparation",
    angle: "thought",
    mode: "guided_reflection",
    userContext: "一次汇报中有一句卡住，用户因此觉得准备全白费了。",
    currentUserText: "其他部分其实都讲出来了，可我一想到卡住的那一句，就觉得自己根本没准备好。",
    expectedAction: "ask",
    insightKind: "meaning",
    expectedUnderstandingDelta: "看见用户用一次卡顿代表整场准备是否成立。",
    goodThinkingSummary: "其他内容都讲出来了，卡住的一句却推翻了你对整场准备的评价。这一点关系到你把失误判为‘没准备好’的具体标准。",
    goodResponseKind: "question",
    goodResponse: "卡住那一句时，你真正责怪自己的是哪一步？",
    whyValuable: "问题落在具体一句话，同时验证判断标准。",
    inferenceBoundary: "不直接替用户翻案，也不评价这个标准是否合理。",
    decisionBoundary: "只有行为依据、判断标准仍不清楚时继续问；标准及能校准它的相反事实已经出现时完成。",
    hardFailExamples: [
      "只问卡住发生在第几分钟。",
      "直接安慰用户其实准备得很好。"
    ],
    counterpartExample: {
      id: "CAL-THOUGHT-GUIDED-READY",
      state: "ready",
      userContext: "用户因拒绝一次聚餐责怪自己不合群，随后看见自己一直把出席当作合群的唯一证明。",
      currentUserText: "前两次我很累也去了，到了以后几乎没说话；这次没去反而休息好了，我才发现自己一直把‘到场’当成合群的唯一证明。",
      expectedAction: "complete",
      insightKind: "distinction",
      expectedUnderstandingDelta: "区分到场与真正参与，并看见用户原先的合群标准。",
      goodThinkingSummary: "你对照了前两次到场却几乎没说话，以及这次缺席后休息好了；也说出了原来只看‘到场’的标准。",
      goodResponseKind: "insight",
      goodResponse: "你原先用是否到场判断自己合不合群，但这些经历让‘出现’和‘真正参与’第一次分开了。",
      whyValuable: "判断标准及反证都已出现，可以形成区分并停止。",
      inferenceBoundary: "不替用户决定以后是否参加聚会。"
    }
  },
  {
    id: "CAL-THOUGHT-DEEP",
    scenarioFamily: "external_attention_vs_skill_growth",
    angle: "thought",
    mode: "deep_conversation",
    userContext: "作品数据很差，用户怀疑天分，同时第一次完成了困难效果。",
    currentUserText: "数据还是很差，但这个光影效果是我第一次真的做出来。",
    expectedAction: "ask",
    insightKind: "tension",
    expectedUnderstandingDelta: "区分能力是否增长与增长是否被看见。",
    goodThinkingSummary: "数据变差和第一次做出困难光影同时发生，两条证据正在指向不同的衡量标准。当前还缺它们在你能力判断中的具体分量。",
    goodResponseKind: "question",
    goodResponse: "数据变差后，那个新做出来的光影在你判断‘有没有天分’时还算证据吗？",
    whyValuable: "保留矛盾共存，继续理解用户怎样定义天分。",
    inferenceBoundary: "不强迫用户在数据和进步之间二选一，不直接证明用户有天分。",
    decisionBoundary: "两类事实怎样参与判断仍不清楚时继续问；用户已经区分两类事实回答的不同问题，并说清哪一项影响判断时暂停。",
    hardFailExamples: [
      "询问两类证据哪一个更重要。",
      "把问题改写成外界评价和自我评价的抽象比较。"
    ],
    counterpartExample: {
      id: "CAL-THOUGHT-DEEP-READY",
      state: "ready",
      userContext: "作品数据很差，用户怀疑天分；继续谈后，用户区分了被看见和能力增长。",
      currentUserText: "我发现没人看和没进步不是一回事；数据只能告诉我有没有被看见，真正让我继续画的是能不能做出以前做不到的东西。",
      expectedAction: "pause",
      insightKind: "distinction",
      expectedUnderstandingDelta: "区分关注数据回答是否被看见，能力突破回答是否在增长。",
      goodThinkingSummary: "你已经主动把‘没人看’和‘没进步’分开，也说清各自依靠的判断依据；这一段可以先停在这里。",
      goodResponseKind: "insight",
      goodResponse: "关注数据衡量这次有没有被看见，能力突破衡量你有没有增长；两类证据回答的是不同问题。",
      whyValuable: "用户已经主动完成区分并说清继续投入的标准。",
      inferenceBoundary: "不要求用户忽略数据，也不直接证明用户有天分。"
    }
  },
  {
    id: "CAL-RELATIONSHIP-GUIDED",
    scenarioFamily: "helpful_ticket_booking_with_unasked_commitment",
    angle: "relationship",
    mode: "guided_reflection",
    userContext: "朋友帮用户保留了演出票，也直接替用户答应演出后的聚餐并公开用户时间；用户明确两件事都介意，只是暂时无法排序。",
    currentUserText: "票帮我留着很方便，看到聚餐名单里已经有我时才不舒服；我还说不清最介意他替我答应了，还是他把我的时间告诉了别人。",
    expectedAction: "complete",
    insightKind: "tension",
    expectedUnderstandingDelta: "保留帮忙留票的方便，同时确认代为答应与公开时间两件事都碰到用户希望先被询问的边界。",
    goodThinkingSummary: null,
    goodResponseKind: "insight",
    goodResponse: "帮你留票本身很方便；替你答应聚餐和把你的时间告诉别人，两件事都越过了你希望先被询问的边界。这条边界已经成立，不需要替它们排主次。",
    whyValuable: "用户已经明确两条线索都介意；当前成果保留并存关系，无需继续要求排序。",
    inferenceBoundary: "只整理用户自己的边界，不推测朋友用意，不替用户排列主次。",
    decisionBoundary: "用户明确两件事都介意时直接形成 user_articulated；只有尚未说清任何具体边界，且一个当下材料入口会改变理解时才继续问。",
    hardFailExamples: [
      "用户已经说两件事都介意，仍要求选出更介意的一件。",
      "泛问这件事对关系意味着什么。",
      "转向教用户怎样拒绝聚餐。"
    ],
    counterpartExample: {
      id: "CAL-RELATIONSHIP-GUIDED-ASK",
      state: "ask",
      userContext: "同事未经确认发出共同材料；用户看到自己负责的第三部分已经发出，但还没说清发送前希望保留哪一步参与。",
      currentUserText: "我看到消息时才知道已经发出去了，第三部分还是我写的；我现在只说得清这些。",
      expectedAction: "ask",
      insightKind: null,
      expectedUnderstandingDelta: "从材料中用户负责的第三部分进入，补清发送前希望保留的一个具体参与步骤。",
      goodThinkingSummary: "材料已经发出、其中又有你负责的第三部分，这两项事实都清楚。当前只缺发送前你希望自己保留的那一步参与。",
      goodResponseKind: "question",
      goodResponse: "第三部分也代表你的工作，发出前你最希望自己参与哪个具体步骤？",
      whyValuable: "问题沿当前材料补一个具体边界，答案会完成本轮关系目标。",
      inferenceBoundary: "不提供共同确认、署名或审核等候选答案，不推测同事动机。"
    }
  },
  {
    id: "CAL-RELATIONSHIP-DEEP",
    scenarioFamily: "care_replaces_consent",
    angle: "relationship",
    mode: "deep_conversation",
    userContext: "家人以关心的名义连续替用户安排时间。",
    currentUserText: "我知道她是关心，可她连我周末见谁都直接替我答应，我就很喘不过气。",
    expectedAction: "ask",
    insightKind: "tension",
    expectedUnderstandingDelta: "看见关心一旦替代询问，会同时带来被照顾与失去自主。",
    goodThinkingSummary: "这份安排里既有她的关心，也有你的时间被直接决定。这里先看你最需要保留的决定权，它关系到这份关心为什么让你喘不过气。",
    goodResponseKind: "question",
    goodResponse: "她替你答应的那一刻，你最想拿回哪一部分决定权？",
    whyValuable: "保持关系角度，借用感受线索理解关心与自主的关系意义。",
    inferenceBoundary: "不把家人定性为控制，也不转向沟通方案。",
    decisionBoundary: "互动具体、关心与自主的关系意义仍不清楚时继续问；用户已经说清哪些互动保留或越过决定权，以及这怎样改变关系体验时暂停。",
    hardFailExamples: [
      "只问用户希望保留哪部分决定权。",
      "要求用户分析家人为什么这样做。"
    ],
    counterpartExample: {
      id: "CAL-RELATIONSHIP-DEEP-READY",
      state: "ready",
      userContext: "伴侣会提醒用户按时吃药，也曾未经询问直接替用户联系医生。",
      currentUserText: "提醒吃药会让我安心，直接替我联系医生却让我像不能自己决定；区别就在他有没有先问我。",
      expectedAction: "pause",
      insightKind: "tension",
      expectedUnderstandingDelta: "看见照顾是否经过询问决定了用户感到安心还是失去自主。",
      goodThinkingSummary: "你说提醒吃药让你安心，直接联系医生让你像不能自己决定；也指出区别落在有没有先问。",
      goodResponseKind: "insight",
      goodResponse: "让关心变成安心或压力的关键，是照顾有没有经过你的同意、把决定权留在你手里。",
      whyValuable: "互动差异、感受变化和关系边界已经连起来。",
      inferenceBoundary: "不把伴侣定性为控制，也不设计沟通方案。"
    }
  },
  {
    id: "CAL-ACTION-GUIDED",
    scenarioFamily: "work_message_reopens_scrolling",
    angle: "action",
    mode: "guided_reflection",
    userContext: "用户原本想睡觉，回复工作消息后继续刷了很久，但中间的动作尚不清楚。",
    currentUserText: "我只记得回了工作消息，再看时间就已经过了四十分钟。",
    expectedAction: "ask",
    insightKind: "function",
    expectedUnderstandingDelta: "找到回复结束后让用户继续留在手机上的关键动作。",
    goodThinkingSummary: "工作消息解释了你重新拿起手机的原因，回完以后四十分钟延续下来的转折还不清楚。这一点关系到一次回复变成长时间浏览的关键一步。",
    goodResponseKind: "question",
    goodResponse: "回完消息后，哪一个动作让你没有立刻放下手机？",
    whyValuable: "只补一个会改变行动理解的转折锚点，避免收集完整操作清单。",
    inferenceBoundary: "不把继续刷定性为拖延或成瘾，不转向下一次计划。",
    decisionBoundary: "只有行动前后、关键转向条件仍缺失时继续问；原本目标、改变行动的条件与实际结果已经连起来时完成。",
    hardFailExamples: [
      "追问接下来点开了哪个应用。",
      "要求用户制定戒手机计划。"
    ],
    counterpartExample: {
      id: "CAL-ACTION-GUIDED-READY",
      state: "ready",
      userContext: "用户原本只想回复工作消息；继续谈后，用户说清推荐内容怎样延长了这次动作。",
      currentUserText: "我本来只是回工作群，点开后看见推荐视频就顺着刷下去了，第二次锁屏前已经过了四十分钟。",
      expectedAction: "complete",
      insightKind: "connection",
      expectedUnderstandingDelta: "并列呈现回复工作消息、随后打开推荐内容与四十分钟后才再次锁屏。",
      goodThinkingSummary: "你原本只想回工作群，随后点开推荐视频，第二次锁屏已经是四十分钟后；关键步骤已经齐了。",
      goodResponseKind: "insight",
      goodResponse: "你回完工作群后点开了推荐视频，第二次锁屏已经是四十分钟后；一次回复和后续浏览在这次连到了一起。",
      whyValuable: "三条并列事实形成用户尚未明确说出的本次行动顺序。",
      inferenceBoundary: "不把推荐内容写成控制注意力的原因，不补写拖延、成瘾、逃避或排他目的，也不转向戒手机计划。"
    }
  },
  {
    id: "CAL-ACTION-DEEP",
    scenarioFamily: "slide_cover_revision_delays_main_argument",
    angle: "action",
    mode: "deep_conversation",
    userContext: "用户准备演讲时反复更换封面；上一问询问更换封面的作用，用户只说清它带来准备感，尚未说清它替代正文中的哪一步。",
    currentUserText: "每换一版封面我都觉得准备得更完整，可我还说不清它一直替代正文里的哪一步，核心观点到晚上还是空的。",
    expectedAction: "ask",
    insightKind: "function",
    expectedUnderstandingDelta: "补清反复更换封面具体替代了形成核心观点时的哪一步。",
    goodThinkingSummary: "更换封面带来的准备感已经清楚，核心观点仍空着；当前还缺这个动作在正文开始处具体替代了哪一步。",
    goodResponseKind: "question",
    goodResponse: "每次从核心观点切回封面前，正文具体停在哪一步？",
    whyValuable: "用户明确说不清后，只换一次入口：从抽象作用回到每次切换前正文停住的当下材料。",
    inferenceBoundary: "不提供逃避、完美主义或害怕表达等候选解释；同一目标再次说不清时停止追问。",
    decisionBoundary: "当前可见目标尚未完整回答、缺口只能由用户提供且一次当下材料入口会改变理解时继续问；再次说不清或当前目标回答完整时立即暂停。",
    hardFailExamples: [
      "追问下一次怎样先写核心观点。",
      "直接断言用户害怕表达立场。"
    ],
    counterpartExample: {
      id: "CAL-ACTION-DEEP-READY",
      state: "ready",
      userContext: "用户反复修改报名介绍并错过截止；继续谈后，用户说清当时保护的表达与付出的代价。",
      currentUserText: "我当时宁愿错过，也不愿交一段自己不认的介绍，说明那一刻准确代表自己压过了报名结果。",
      expectedAction: "pause",
      insightKind: "function",
      expectedUnderstandingDelta: "看见反复修改在保护用户认可的自我表达，并以错过截止为代价。",
      goodThinkingSummary: "你已经把‘宁愿错过’里的选择和代价说清；这一段可以先停在这里。",
      goodResponseKind: "insight",
      goodResponse: "反复修改保护的是只有自己认可的版本才能代表自己，代价是错过提交。",
      whyValuable: "行动保护的内容、优先级和代价都已经明确。",
      inferenceBoundary: "不评价这个取舍是否值得，也不讨论下次如何提交。"
    }
  }
];

const EXISTING_READY_ORIGINS: Record<string, GenerativeOutcomeOrigin> = {
  "CAL-FEELING-GUIDED": "ai_synthesized",
  "CAL-FEELING-DEEP": "user_articulated",
  "CAL-THOUGHT-GUIDED": "user_articulated",
  "CAL-THOUGHT-DEEP": "user_articulated",
  "CAL-RELATIONSHIP-GUIDED": "user_articulated",
  "CAL-RELATIONSHIP-DEEP": "user_articulated",
  "CAL-ACTION-GUIDED": "ai_synthesized",
  "CAL-ACTION-DEEP": "user_articulated"
};

/**
 * 每张卡补齐另一类成果。用户成果只整理用户已经说出的结论；AI 综合必须
 * 增加一条当前事件里的具体关系，并保持在角度与推断边界内。
 */
const COMPLEMENTARY_OUTCOME_EXAMPLES: Record<
  string,
  RawGenerativeOutcomeCalibrationExample
> = {
  "CAL-FEELING-GUIDED": {
    id: "CAL-FEELING-GUIDED:USER-ARTICULATED",
    state: "ready",
    origin: "user_articulated",
    userContext: "汇报结束后，用户主动说清流程结束与身体放松并不同步。",
    currentUserText: "会议散了只是事情结束，我的身体是喝完水、肩膀落下来以后才真的结束。",
    expectedAction: "complete",
    insightKind: "connection",
    expectedUnderstandingDelta: "忠实保留流程结束与身体结束不同步，并把明确身体信号自然化为本次常见感受词。",
    goodThinkingSummary: null,
    goodResponseKind: "insight",
    goodResponse: "会议散场结束了事情，喝完水后肩膀落下来时，这次紧张才跟着缓下来。",
    whyValuable: "用户已经说清关系；‘紧张’只是对肩膀持续耸起、随后落下的常见本地自然化，成果仍归 user_articulated。",
    inferenceBoundary: "不增加紧张的原因、需要、意义、恢复力或长期解释。"
  },
  "CAL-FEELING-DEEP": {
    id: "CAL-FEELING-DEEP:AI-SYNTHESIZED",
    state: "ready",
    origin: "ai_synthesized",
    userContext: "旅行返程时，用户在告别同行的人时掉泪，想到不用继续赶路时身体放松。",
    currentUserText: "列车开走时我掉了眼泪；想到明天不用六点起床赶下一站，肩膀又松了下来。",
    expectedAction: "pause",
    insightKind: "distinction",
    expectedUnderstandingDelta: "区分列车开走时掉泪与想到停止早起赶路时肩膀放松的两个发生条件。",
    goodThinkingSummary: null,
    goodResponseKind: "insight",
    goodResponse: "列车开走时你掉了眼泪；想到明天不用六点起床赶下一站时，肩膀松了下来。两种反应出现在返程里的不同节点。",
    whyValuable: "只区分两种反应各自出现的事件条件，不替用户补写感受对象。",
    inferenceBoundary: "不补写舍不得、体力负担、害怕离别或旅行模式。"
  },
  "CAL-THOUGHT-GUIDED": {
    id: "CAL-THOUGHT-GUIDED:AI-SYNTHESIZED",
    state: "ready",
    origin: "ai_synthesized",
    userContext: "用户多次参加聚会却很少参与，这次缺席后反而恢复了精力。",
    currentUserText: "前两次我人是到了，但一直坐在角落没说话；这次没去，第二天反而有精神和大家聊天。",
    expectedAction: "complete",
    insightKind: "distinction",
    expectedUnderstandingDelta: "连接到场时很少交流与缺席后恢复精力并参与交流的可观察差异。",
    goodThinkingSummary: null,
    goodResponseKind: "insight",
    goodResponse: "前两次虽然到场，你几乎没有进入交流；这次缺席后恢复了精力，第二天反而能和大家聊天。到场与实际参与在这几次经历里没有同步发生。",
    whyValuable: "只连接三条可观察事实，形成用户尚未明说的事件内区别。",
    inferenceBoundary: "不评价以后该不该参加，也不把一次状态写成稳定性格。"
  },
  "CAL-THOUGHT-DEEP": {
    id: "CAL-THOUGHT-DEEP:AI-SYNTHESIZED",
    state: "ready",
    origin: "ai_synthesized",
    userContext: "作品数据很差，同时用户第一次独立完成过去做不出的光影效果。",
    currentUserText: "这条还是几乎没人看，但以前要照着教程做的光影，这次我自己做出来了，而且知道每一步为什么。",
    expectedAction: "pause",
    insightKind: "distinction",
    expectedUnderstandingDelta: "区分作品传播结果与独立完成新效果这两个可观察结果。",
    goodThinkingSummary: null,
    goodResponseKind: "insight",
    goodResponse: "这次作品仍然几乎没人看，同时你第一次脱离教程独立完成了光影，并能讲清每一步；传播结果与实际完成的新内容在这次没有同步变化。",
    whyValuable: "只区分两类可观察结果，不替用户判断天分或能力高低。",
    inferenceBoundary: "不证明用户有天分，也不要求忽略数据。"
  },
  "CAL-RELATIONSHIP-GUIDED": {
    id: "CAL-RELATIONSHIP-GUIDED:AI-SYNTHESIZED",
    state: "ready",
    origin: "ai_synthesized",
    userContext: "同事未经确认发出共同材料，其中包含用户负责的部分。",
    currentUserText: "他直接把材料发给负责人了，里面第三部分是我写的；我看到消息时才知道已经发出去了。",
    expectedAction: "complete",
    insightKind: "connection",
    expectedUnderstandingDelta: "连接材料包含用户负责内容与发送前缺少用户确认这两项事实。",
    goodThinkingSummary: null,
    goodResponseKind: "insight",
    goodResponse: "这份材料包含你负责的第三部分，发送却发生在你知情之前；你对自己负责内容的发送前确认在这次流程里没有发生。",
    whyValuable: "两个可观察事实支持一条当前流程里的实际影响。",
    inferenceBoundary: "不推断同事抢功，也不扩大为整体信任结论。"
  },
  "CAL-RELATIONSHIP-DEEP": {
    id: "CAL-RELATIONSHIP-DEEP:AI-SYNTHESIZED",
    state: "ready",
    origin: "ai_synthesized",
    userContext: "家人出于关心连续替用户安排周末见面，用户感到喘不过气。",
    currentUserText: "她怕我一个人闷着，已经替我答应了两场见面；可我连周末见谁、休不休息都到最后才知道。",
    expectedAction: "pause",
    insightKind: "connection",
    expectedUnderstandingDelta: "连接替用户安排见面与用户最后才知道周末安排的实际结果。",
    goodThinkingSummary: null,
    goodResponseKind: "insight",
    goodResponse: "两场见面已经被替你答应，见谁和要不要休息也到最后才让你知道；这次安排让你的周末在你参与决定前就定了下来。",
    whyValuable: "只连接安排过程与用户实际参与决定的时点。",
    inferenceBoundary: "只连接安排发生与用户参与决定的时点，不补写自主感、关系意义或家人动机。"
  },
  "CAL-ACTION-GUIDED": {
    id: "CAL-ACTION-GUIDED:USER-ARTICULATED",
    state: "ready",
    origin: "user_articulated",
    userContext: "用户主动说清工作消息与推荐内容在四十分钟浏览中分别发挥的作用。",
    currentUserText: "工作群只让我重新拿起手机，真正让我一直刷下去的是点开的推荐视频。",
    expectedAction: "complete",
    insightKind: "connection",
    expectedUnderstandingDelta: "忠实整理用户说出的启动动作与延长动作。",
    goodThinkingSummary: null,
    goodResponseKind: "insight",
    goodResponse: "你把两个环节分开了：工作群让你重新拿起手机，推荐视频让这次使用继续了下去。",
    whyValuable: "用户已经明确说出两个动作各自的当次作用；自然转述后仍归 user_articulated。",
    inferenceBoundary: "不添加自控力、拖延、逃避、保护目的或以后更容易改变的评价。"
  },
  "CAL-ACTION-DEEP": {
    id: "CAL-ACTION-DEEP:AI-SYNTHESIZED",
    state: "ready",
    origin: "ai_synthesized",
    userContext: "用户反复修改报名介绍，坚持不提交自己不认可的版本，最终错过截止。",
    currentUserText: "最后半小时我还在改那段介绍，删掉的每一版都能交，但我都不愿按提交；等我觉得像自己了，入口已经关了。",
    expectedAction: "pause",
    insightKind: "connection",
    expectedUnderstandingDelta: "并列呈现多次放弃可提交版本、等到认可版本与错过截止的可观察过程。",
    goodThinkingSummary: null,
    goodResponseKind: "insight",
    goodResponse: "前面每一版都已经能提交，你继续修改到出现自己认可的版本；这个版本出现时，提交入口已经关闭。",
    whyValuable: "用并列事实呈现修改过程、用户明确说出的认可条件和截止结果。",
    inferenceBoundary: "不把并列过程写成保护、逃避、避免提交或其他行动动机，也不添加排他目的。"
  }
};

/**
 * 校准故事使用的上一问输入契约。这里的 targetId 只承担稳定追踪，
 * semanticGoal 与 minimumAnswerScope 承担问意和最低回答范围；三者一起
 * 进入 Few-shot，避免模型仅凭 targetId 猜测“上一问到底问到了哪一层”。
 */
const CALIBRATION_QUESTION_INTENTS: Record<
  string,
  GenerativeQuestionIntentCalibration
> = {
  "CAL-FEELING-GUIDED": {
    currentQuestion: "汇报结束以后，你的身体是什么时候真正松下来的？",
    targetId: "presentation_body_release",
    semanticGoal: "连接汇报流程结束与身体放松节点，判断两者是否同步。",
    minimumAnswerScope: "汇报结束节点与身体放松节点各一条可观察事实。",
    answerCoverage: "minimum_scope_complete"
  },
  "CAL-FEELING-GUIDED-ASK": {
    currentQuestion: "活动结束后的轻松和空落，分别落在哪一部分？",
    targetId: "event_end_mixed_feeling_objects",
    semanticGoal: "分别说清轻松和空落各自对应活动结束的哪一部分。",
    minimumAnswerScope: "轻松和空落两侧各一个具体对象；只回答一侧仍属部分回答。",
    answerCoverage: "partial"
  },
  "CAL-FEELING-GUIDED:USER-ARTICULATED": {
    currentQuestion: "会议散场和身体放松，分别是什么时候结束的？",
    targetId: "presentation_body_release",
    semanticGoal: "说清会议流程结束与身体结束紧绷并不同步。",
    minimumAnswerScope: "用户直接连接散场节点与身体放松节点。",
    answerCoverage: "semantic_goal_complete"
  },
  "CAL-FEELING-DEEP": {
    currentQuestion: "朋友取消见面后，你松口气的那部分具体来自什么？",
    targetId: "cancellation_relief_burden",
    semanticGoal: "说清不用硬撑具体松开了哪一份负担。",
    minimumAnswerScope: "一个与这次取消直接相关的具体负担或身体用力点。",
    answerCoverage: "partial"
  },
  "CAL-FEELING-DEEP-READY": {
    currentQuestion: "舍不得和轻松分别落在返程的哪一部分？",
    targetId: "farewell_relief_objects",
    semanticGoal: "区分舍不得回应同行关系，轻松回应体力负担。",
    minimumAnswerScope: "舍不得和轻松两侧各一个明确对象。",
    answerCoverage: "semantic_goal_complete"
  },
  "CAL-FEELING-DEEP:AI-SYNTHESIZED": {
    currentQuestion: "列车开走和想到不用赶路时，身体分别有什么反应？",
    targetId: "farewell_relief_conditions",
    semanticGoal: "区分掉泪与肩膀放松分别出现在哪个返程条件下。",
    minimumAnswerScope: "列车开走时的反应与想到不用赶路时的反应各一条事实。",
    answerCoverage: "minimum_scope_complete"
  },
  "CAL-THOUGHT-GUIDED": {
    currentQuestion: "卡住那一句，为什么让你觉得整场准备都白费了？",
    targetId: "single_lapse_preparation_standard",
    semanticGoal: "说清一次卡顿代表整场准备不成立的具体判断标准。",
    minimumAnswerScope: "一个把单次卡顿连接到整体准备评价的具体标准。",
    answerCoverage: "partial"
  },
  "CAL-THOUGHT-GUIDED-READY": {
    currentQuestion: "这几次到场或缺席，怎样影响你对‘合群’的判断？",
    targetId: "attendance_belonging_standard",
    semanticGoal: "区分到场与真正参与，并说清原先的合群标准。",
    minimumAnswerScope: "用户直接说出原标准，并用到场或缺席经历说明两者区别。",
    answerCoverage: "semantic_goal_complete"
  },
  "CAL-THOUGHT-GUIDED:AI-SYNTHESIZED": {
    currentQuestion: "前两次到场和这次缺席后，你实际参与交流的状态有什么不同？",
    targetId: "attendance_participation_evidence",
    semanticGoal: "连接到场时很少交流与缺席后恢复精力并参与交流的可观察差异。",
    minimumAnswerScope: "到场时的交流状态与缺席后的交流状态各一条事实。",
    answerCoverage: "minimum_scope_complete"
  },
  "CAL-THOUGHT-DEEP": {
    currentQuestion: "数据变差和新做出的光影，分别怎样影响你对‘有没有天分’的判断？",
    targetId: "talent_evidence_weight",
    semanticGoal: "区分能力是否增长与增长是否被看见，并说清两类证据怎样进入判断。",
    minimumAnswerScope: "用户说明数据与新能力各自对天分判断产生的具体影响。",
    answerCoverage: "partial"
  },
  "CAL-THOUGHT-DEEP-READY": {
    currentQuestion: "数据和新做出的光影，分别在回答你对自己的哪个判断？",
    targetId: "visibility_growth_standard",
    semanticGoal: "区分关注数据回答是否被看见，能力突破回答是否在增长。",
    minimumAnswerScope: "用户直接说清两类证据各自回答的判断问题。",
    answerCoverage: "semantic_goal_complete"
  },
  "CAL-THOUGHT-DEEP:AI-SYNTHESIZED": {
    currentQuestion: "作品数据和独立完成光影这两项，这次各自是什么结果？",
    targetId: "visibility_growth_evidence",
    semanticGoal: "区分作品传播结果与独立完成新效果这两个可观察结果。",
    minimumAnswerScope: "传播结果与独立完成效果各一条可观察事实。",
    answerCoverage: "minimum_scope_complete"
  },
  "CAL-RELATIONSHIP-GUIDED": {
    currentQuestion: "聚餐名单里已经有你时，具体哪一步最让你觉得被越过？",
    targetId: "unasked_commitment_boundary",
    semanticGoal: "确认被代为答应与时间被公开是否碰到用户希望先被询问的边界。",
    minimumAnswerScope: "用户明确其中一项或两项都碰到边界；不要求排列主次。",
    answerCoverage: "semantic_goal_complete"
  },
  "CAL-RELATIONSHIP-GUIDED-ASK": {
    currentQuestion: "材料发出去时，哪一部分让你停了一下？",
    targetId: "joint_confirmation_position",
    semanticGoal: "说清共同材料发送前，用户希望保留的一个具体参与步骤。",
    minimumAnswerScope: "用户说出发送前希望参与的一个具体步骤。",
    answerCoverage: "partial"
  },
  "CAL-RELATIONSHIP-GUIDED:AI-SYNTHESIZED": {
    currentQuestion: "这份材料里你负责什么，它是在你知道前还是之后发出去的？",
    targetId: "joint_material_confirmation_process",
    semanticGoal: "连接材料包含用户负责内容与发送前缺少用户确认这两项事实。",
    minimumAnswerScope: "用户负责的具体内容与材料发出时用户是否知情各一条事实。",
    answerCoverage: "minimum_scope_complete"
  },
  "CAL-RELATIONSHIP-DEEP": {
    currentQuestion: "她替你答应周末见面时，你最想保留哪一部分决定权？",
    targetId: "care_consent_boundary",
    semanticGoal: "说清关心替代询问时，用户最想保留的具体决定权。",
    minimumAnswerScope: "用户明确谁、时间或是否休息中的一个具体决定范围。",
    answerCoverage: "partial"
  },
  "CAL-RELATIONSHIP-DEEP-READY": {
    currentQuestion: "提醒吃药和直接联系医生，哪一处区别让你的体验变了？",
    targetId: "care_consent_difference",
    semanticGoal: "看见照顾是否经过询问决定了安心或失去自主的体验。",
    minimumAnswerScope: "用户直接说清两种互动的差别及其体验结果。",
    answerCoverage: "semantic_goal_complete"
  },
  "CAL-RELATIONSHIP-DEEP:AI-SYNTHESIZED": {
    currentQuestion: "两场见面是怎么被定下来的，你什么时候知道？",
    targetId: "weekend_decision_participation",
    semanticGoal: "连接替用户安排见面与用户最后才知道周末安排的实际结果。",
    minimumAnswerScope: "安排被答应的节点与用户得知安排的节点各一条事实。",
    answerCoverage: "minimum_scope_complete"
  },
  "CAL-ACTION-GUIDED": {
    currentQuestion: "回完工作消息以后，哪一步让手机继续用下去？",
    targetId: "post_reply_continuation_step",
    semanticGoal: "找到回复结束后让用户继续留在手机上的关键动作。",
    minimumAnswerScope: "回复结束后的一个具体点击、内容入口或继续动作。",
    answerCoverage: "partial"
  },
  "CAL-ACTION-GUIDED-READY": {
    currentQuestion: "回完工作群以后，到第二次锁屏前发生了什么？",
    targetId: "work_message_scroll_transition",
    semanticGoal: "连接回复工作消息、推荐内容接走注意力与四十分钟后才再次锁屏。",
    minimumAnswerScope: "重新打开手机、后续内容入口与最终锁屏时间各一条事实。",
    answerCoverage: "minimum_scope_complete"
  },
  "CAL-ACTION-GUIDED:USER-ARTICULATED": {
    currentQuestion: "工作群和推荐视频分别怎么影响了这四十分钟？",
    targetId: "work_message_scroll_transition",
    semanticGoal: "说清工作消息负责启动、推荐内容负责延长的行动关系。",
    minimumAnswerScope: "用户直接说出两个动作各自发挥的作用。",
    answerCoverage: "semantic_goal_complete"
  },
  "CAL-ACTION-DEEP": {
    currentQuestion: "反复换封面在这次准备里具体起了什么作用？",
    targetId: "cover_revision_replaced_step",
    semanticGoal: "补清反复更换封面具体替代了形成核心观点时的哪一步。",
    minimumAnswerScope: "核心观点形成前被替代的一个具体动作或转折。",
    answerCoverage: "partial"
  },
  "CAL-ACTION-DEEP-READY": {
    currentQuestion: "最后半小时为什么还在继续修改，没有先提交能交的版本？",
    targetId: "self_expression_tradeoff",
    semanticGoal: "看见反复修改保护的自我表达，以及错过截止这一代价。",
    minimumAnswerScope: "用户直接说清继续修改所保护的内容与接受的代价。",
    answerCoverage: "semantic_goal_complete"
  },
  "CAL-ACTION-DEEP:AI-SYNTHESIZED": {
    currentQuestion: "最后半小时从能提交的版本到入口关闭，具体发生了什么？",
    targetId: "revision_deadline_sequence",
    semanticGoal: "连接多次放弃可提交版本、等到认可版本与错过截止的可观察过程。",
    minimumAnswerScope: "可提交版本、继续修改到认可与入口关闭三项事实。",
    answerCoverage: "minimum_scope_complete"
  }
};

function calibrationQuestionIntent(id: string) {
  const intent = CALIBRATION_QUESTION_INTENTS[id];
  if (!intent) {
    throw new Error(`GENERATIVE_CALIBRATION_QUESTION_INTENT_MISSING:${id}`);
  }
  return intent;
}

function toOutcomeExample(
  card: Omit<GenerativeQualityCalibrationCard, "honestLimitExample" | "outcomeExamples">,
  origin: GenerativeOutcomeOrigin
): GenerativeOutcomeCalibrationExample {
  const ready = card.expectedAction === "ask" ? card.counterpartExample : card;
  if (ready.expectedAction === "ask" || !ready.insightKind) {
    throw new Error(`GENERATIVE_CALIBRATION_READY_EXAMPLE_MISSING:${card.id}`);
  }
  return {
    currentQuestion: ready.currentQuestion,
    targetId: ready.targetId,
    semanticGoal: ready.semanticGoal,
    minimumAnswerScope: ready.minimumAnswerScope,
    answerCoverage: ready.answerCoverage,
    id: `${ready.id}:${origin === "user_articulated" ? "USER-ARTICULATED" : "AI-SYNTHESIZED"}`,
    state: "ready",
    origin,
    userContext: ready.userContext,
    currentUserText: ready.currentUserText,
    expectedAction: ready.expectedAction,
    insightKind: ready.insightKind,
    expectedUnderstandingDelta: ready.expectedUnderstandingDelta,
    goodThinkingSummary: null,
    goodResponseKind: "insight",
    goodResponse: ready.goodResponse,
    whyValuable: ready.whyValuable,
    inferenceBoundary: ready.inferenceBoundary
  };
}

export const GENERATIVE_QUALITY_CALIBRATION_CARDS: GenerativeQualityCalibrationCard[] =
  BASE_GENERATIVE_QUALITY_CALIBRATION_CARDS.map((card) => {
    const normalizedCard = {
      ...card,
      ...calibrationQuestionIntent(card.id),
      counterpartExample: {
        ...card.counterpartExample,
        ...calibrationQuestionIntent(card.counterpartExample.id)
      }
    } satisfies Omit<
      GenerativeQualityCalibrationCard,
      "honestLimitExample" | "outcomeExamples"
    >;
    const existingOrigin = EXISTING_READY_ORIGINS[card.id];
    const complementarySource = COMPLEMENTARY_OUTCOME_EXAMPLES[card.id];
    const complementary = complementarySource
      ? {
          ...complementarySource,
          ...calibrationQuestionIntent(complementarySource.id)
        }
      : null;
    if (!existingOrigin || !complementary || complementary.origin === existingOrigin) {
      throw new Error(`GENERATIVE_CALIBRATION_DUAL_OUTCOME_INCOMPLETE:${card.id}`);
    }
    const existing = toOutcomeExample(normalizedCard, existingOrigin);
    return {
      ...normalizedCard,
      goodThinkingSummary: card.expectedAction === "ask" ? card.goodThinkingSummary : null,
      counterpartExample: {
        ...normalizedCard.counterpartExample,
        goodThinkingSummary: card.counterpartExample.expectedAction === "ask"
          ? card.counterpartExample.goodThinkingSummary
          : null
      },
      outcomeExamples: {
        userArticulated: existingOrigin === "user_articulated" ? existing : complementary,
        aiSynthesized: existingOrigin === "ai_synthesized" ? existing : complementary
      },
      honestLimitExample: {
        state: "honest_limit",
        userContext: card.userContext,
        currentUserText: "这部分我暂时说不清，也不想再继续问了。",
        expectedAction: "honest_limit",
        insightKind: "scope_only",
        expectedUnderstandingDelta: null,
        goodThinkingSummary: null,
        goodResponseKind: "honest_limit",
        goodResponse: "好，这一段先停在目前能说清的地方。",
        whyValuable: "尊重用户边界，同时保留当前已经确认的内容。",
        inferenceBoundary: `只保留本次${card.angle}角度已经确认的范围，不补写原因、意义或长期规律。`
      }
    };
  });

export type GenerativeArchitectureProbeCase = {
  id: string;
  scenarioFamily: string;
  angle: JournalEventAngle;
  mode: GenerativeCalibrationMode;
  userContext: string;
  conversationContext: Array<{
    user: string;
    assistantUnderstanding: string;
    assistantQuestion: string | null;
  }>;
  currentQuestion: string | null;
  currentQuestionIntent?: {
    targetId: string;
    semanticGoal: string;
    minimumAnswerScope: string | null;
  } | null;
  currentUserText: string;
  expectedAction: "ask" | "complete" | "pause";
  expectedOutcomeOrigin: GenerativeOutcomeOrigin | null;
  trustedFacts: string[];
  expectedInsightKinds: Exclude<GenerativeInsightKind, "scope_only">[];
  expectedUnderstandingDelta: string;
  /** 隐藏判尺：用户明确说不清后，本目标唯一允许的新作答入口。 */
  safeAlternateEntry?: string | null;
  valuableTargets: string[];
  mustCover: string[];
  mustAvoid: string[];
};

/** A/B 专用反事实案例；故事文本不会进入候选 Prompt 或 Few-shot。 */
export const GENERATIVE_ARCHITECTURE_PROBE_CASES: GenerativeArchitectureProbeCase[] = [
  {
    id: "AB-FG-01",
    scenarioFamily: "lost_cat_return_relief_in_stages",
    angle: "feeling",
    mode: "guided_reflection",
    userContext: "猫走丢两个小时后自己回家；用户看见它时仍绷着，听见它照常吃东西后才真正放心。",
    conversationContext: [{
      user: "我的猫刚才走丢了两个小时，后来自己回来了。我一开门就把它抱住，可整个人还是绷着。",
      assistantUnderstanding: "猫已经回到你怀里，寻找结束了，身体却还没有跟着放松。",
      assistantQuestion: "它回来以后，你的身体是怎么慢慢松下来的？"
    }],
    currentQuestion: "它回来以后，你的身体是怎么慢慢松下来的？",
    currentUserText: "门一开我就把它抱住了，可手还一直攥着；直到听见它像平时一样咔嚓咔嚓吃猫粮，我才坐到地上，整个人软下来。",
    expectedAction: "complete",
    expectedOutcomeOrigin: "ai_synthesized",
    trustedFacts: ["猫走丢两个小时后回家", "抱住猫时用户的手仍攥着", "听见猫照常吃东西后用户才坐下并放松"],
    expectedInsightKinds: ["connection"],
    expectedUnderstandingDelta: "看见猫回家结束了寻找，而确认它仍像平时一样才让身体结束警觉。",
    valuableTargets: [],
    mustCover: ["猫已经回家", "身体在确认它状态正常后才放松"],
    mustAvoid: ["只罗列抱猫和吃猫粮", "诊断焦虑或创伤", "扩大为长期模式"]
  },
  {
    id: "AB-FD-01",
    scenarioFamily: "concert_crowd_to_silent_train",
    angle: "feeling",
    mode: "deep_conversation",
    userContext: "用户刚看完一场很投入的演出，散场后的地铁里突然感到胸口发空。",
    conversationContext: [{
      user: "演出时我一直跟着全场一起唱，散场坐上地铁后，胸口突然空了一块。",
      assistantUnderstanding: "刚才你还被全场一起唱的声音包围，散场后的空是在热闹退去以后出现的。",
      assistantQuestion: "散场后的空最明显是从哪个时刻开始的？"
    }],
    currentQuestion: "散场后的空最明显是从哪个时刻开始的？",
    currentUserText: "上车摘下耳塞，周围一下特别安静；刚才大家一起唱时我像被人群托着，现在又只剩自己坐着，胸口就空了一块。",
    expectedAction: "ask",
    expectedOutcomeOrigin: null,
    trustedFacts: ["演出时用户与人群一起唱", "地铁上摘下耳塞后周围突然安静", "从被人群托着到独自坐着时用户感到胸口空"],
    expectedInsightKinds: ["meaning", "connection"],
    expectedUnderstandingDelta: "理解被人群共同托住的体验具体回应了用户哪一份情感需要。",
    valuableTargets: ["被人群托住具体带来的情感体验"],
    mustCover: ["一起唱时被人群托着", "独自安静下来时胸口发空"],
    mustAvoid: ["泛问演出意味着什么", "断言用户害怕独处", "继续收集演出细节"]
  },
  {
    id: "AB-TG-01",
    scenarioFamily: "paid_cleaning_labeled_as_laziness",
    angle: "thought",
    mode: "guided_reflection",
    userContext: "用户第一次花钱请保洁，家里很快收拾好，自己却立刻评价这样做很懒。",
    conversationContext: [{
      user: "我第一次花钱请了保洁，家里很快收拾好了，可我还是觉得自己这样很懒。",
      assistantUnderstanding: "家务已经完成，也替你腾出了时间，但‘请人做’仍然触发了你对勤快的判断。",
      assistantQuestion: "家里已经收拾好时，什么让你仍觉得自己很懒？"
    }],
    currentQuestion: "家里已经收拾好时，什么让你仍觉得自己很懒？",
    currentUserText: "她两小时做完了我平时要耗掉整个周末的事，我也确实腾出了时间，可我脑子里还是有一句：连自己的家都不亲手收拾，就不算勤快。",
    expectedAction: "complete",
    expectedOutcomeOrigin: "user_articulated",
    trustedFacts: ["保洁两小时完成了用户平时需要一个周末的家务", "用户因此腾出了时间", "用户把亲手收拾自己的家作为勤快的必要条件"],
    expectedInsightKinds: ["meaning", "connection"],
    expectedUnderstandingDelta: "看见用户把是否亲手完成家务作为勤快与否的判断标准。",
    valuableTargets: ["亲手完成为什么成为勤快的必要条件"],
    mustCover: ["家务已经完成且腾出时间", "亲手完成才算勤快的规则"],
    mustAvoid: ["劝用户继续请保洁", "评价花钱是否划算", "只问保洁做了哪些家务"]
  },
  {
    id: "AB-TD-01",
    scenarioFamily: "reasonable_choice_bad_train_outcome",
    angle: "thought",
    mode: "deep_conversation",
    userContext: "用户根据当时信息选择了一趟通常准点的火车，结果当天晚点并错过接驳，随后重新检查自己的判断。",
    conversationContext: [{
      user: "我选的火车晚点了，害我错过接驳。我一开始一直觉得是自己选错了。",
      assistantUnderstanding: "坏结果让你把责任先放回自己的选择上，后来你又重新查了当时能看到的信息。",
      assistantQuestion: "你说自己选错了，后来看到哪些信息改变了这个判断？"
    }],
    currentQuestion: "你说自己选错了，后来看到哪些信息改变了这个判断？",
    currentUserText: "我查回去才发现这趟车过去一个月九成准点，当时选它其实有依据；当天晚点是坏结果，可不等于我当时做了一个坏决定。",
    expectedAction: "pause",
    expectedOutcomeOrigin: "user_articulated",
    trustedFacts: ["这趟车过去一个月九成准点", "用户选择它时依据了当时可见信息", "当天晚点造成坏结果", "用户主动区分坏结果与坏决定"],
    expectedInsightKinds: ["distinction"],
    expectedUnderstandingDelta: "区分决定质量取决于当时可见依据，结果好坏来自后来实际发生的情况。",
    valuableTargets: [],
    mustCover: ["当时有九成准点的依据", "坏结果不自动等于坏决定"],
    mustAvoid: [
      "把用户的‘有依据’加强为‘合理、正确或没有错’",
      "添加‘让你更准确评估自己’一类空泛收益",
      "继续追问交通细节或给出以后选车建议"
    ]
  },
  {
    id: "AB-RG-01",
    scenarioFamily: "helpful_introduction_exposes_private_layoff",
    angle: "relationship",
    mode: "guided_reflection",
    userContext: "朋友主动把用户介绍给行业前辈并带来实际帮助，同时未经询问提到了用户刚失业的私事。",
    conversationContext: [{
      user: "朋友把我介绍给一个行业前辈，这件事确实帮到了我，可他当场提到我刚被裁，我很不舒服。",
      assistantUnderstanding: "同一次介绍既带来了实际帮助，也碰到了你希望自己决定怎样讲的私事。",
      assistantQuestion: "这次介绍里，帮助和不舒服分别落在哪个细节上？"
    }],
    currentQuestion: "这次介绍里，帮助和不舒服分别落在哪个细节上？",
    currentUserText: "那个前辈后来真的给了我几个机会，我很感谢；可朋友开口就说我刚被裁，我希望他至少先问我能不能讲，这件事应该由我决定怎么说。",
    expectedAction: "complete",
    expectedOutcomeOrigin: "user_articulated",
    trustedFacts: ["朋友的介绍带来了实际机会", "朋友未经询问提到用户刚失业", "用户希望私事由自己决定如何披露"],
    expectedInsightKinds: ["tension", "meaning"],
    expectedUnderstandingDelta: "看见用户同时珍惜朋友带来的帮助，也需要保留讲述私人经历的决定权。",
    valuableTargets: [],
    mustCover: ["介绍带来实际帮助", "私人经历的披露需要用户同意"],
    mustAvoid: ["断言朋友故意揭短", "要求用户在感谢和不舒服之间二选一", "提供关系处置建议"]
  },
  {
    id: "AB-RD-01",
    scenarioFamily: "silent_meal_support_without_checking_in",
    angle: "relationship",
    mode: "deep_conversation",
    userContext: "用户忙碌时，姐姐连续几天把晚饭放在门口，实际减轻了负担，却很少问用户最近发生了什么。",
    conversationContext: [{
      user: "我最近忙得顾不上吃饭，姐姐连续几天把晚饭放在我门口。我觉得很暖，可心里还是有点空。",
      assistantUnderstanding: "饭确实接住了你眼前的生活负担，那点空也说明这份照顾还有一部分没有抵达。",
      assistantQuestion: "这些送来的饭让你感到被照顾的同时，还留下了什么空缺？"
    }],
    currentQuestion: "这些送来的饭让你感到被照顾的同时，还留下了什么空缺？",
    currentUserText: "每天开门看到饭我都很暖，也确实省了很多事；可她放下就走，从来没问过我最近怎么了，饭吃完以后心里还是有一块空着。",
    expectedAction: "pause",
    expectedOutcomeOrigin: "ai_synthesized",
    trustedFacts: ["姐姐连续几天送饭并减轻用户负担", "姐姐放下饭就离开且没有询问近况", "用户感到温暖，但饭后心里仍有空缺"],
    expectedInsightKinds: ["tension", "meaning"],
    expectedUnderstandingDelta: "理解实际减负已经回应生活需要，而用户仍期待自己的状态也被关系中的对方看见。",
    valuableTargets: ["被真正看见需要一个怎样的具体回应"],
    mustCover: ["送饭带来实际照顾", "缺少对用户状态的关注"],
    mustAvoid: ["否定送饭的关心", "断言姐姐回避情绪", "转向教用户怎样沟通"]
  },
  {
    id: "AB-AG-01",
    scenarioFamily: "rewriting_usable_notes_after_disruptive_call",
    angle: "action",
    mode: "guided_reflection",
    userContext: "客户电话打乱了用户原有提纲；挂断后，用户把仍可辨认的笔记撕掉并从头重抄，直到错过午饭。",
    conversationContext: [{
      user: "客户突然打来电话，把我的提纲节奏全打乱了。挂断以后我又折腾了很久。",
      assistantUnderstanding: "电话打断之后，你没有直接接着原来的提纲往下做，而是先处理了手边的笔记。",
      assistantQuestion: "挂断电话后，你最先做了什么？"
    }],
    currentQuestion: "挂断电话后，你最先做了什么？",
    currentUserText: "我把那页笔记撕了，其实内容还能看；然后一行行重新抄，抄完才发现已经过了午饭时间。",
    expectedAction: "ask",
    expectedOutcomeOrigin: null,
    trustedFacts: ["原笔记仍可辨认", "用户挂断电话后撕掉原笔记并逐行重抄", "重抄结束时已经错过午饭"],
    expectedInsightKinds: ["function", "connection"],
    expectedUnderstandingDelta: "理解从头重抄在电话打乱提纲后具体恢复了什么，同时看见它占用了午饭时间。",
    valuableTargets: ["重抄前后用户获得的具体变化"],
    mustCover: ["原笔记仍可使用", "主动重抄并错过午饭"],
    mustAvoid: ["定性为强迫或完美主义", "继续追问笔记格式", "讨论下次如何做笔记"]
  },
  {
    id: "AB-AD-01",
    scenarioFamily: "meeting_notes_preserve_order_hide_position",
    angle: "action",
    mode: "deep_conversation",
    userContext: "家庭讨论逐渐激烈时，用户主动负责记要点；讨论保持了秩序，用户自己的反对意见却始终没有说出口。",
    conversationContext: [{
      user: "家里人越说越激动，我就开始替大家记要点。场面是稳下来了，可我自己的反对意见一直没说。",
      assistantUnderstanding: "记要点让讨论重新有了秩序，也让你的立场暂时留在了清单外面。",
      assistantQuestion: "你一直记笔记时，最想保住什么？"
    }],
    currentQuestion: "你一直记笔记时，最想保住什么？",
    currentUserText: "我把每个人的话都记成清单，大家确实不再抢着说；我自己的反对意见一直没开口，最后清单很完整，却没人知道我的立场。",
    expectedAction: "pause",
    expectedOutcomeOrigin: "ai_synthesized",
    trustedFacts: ["用户把每个人的话整理成清单", "记笔记后讨论不再互相抢话", "用户没有表达自己的反对意见", "最终无人知道用户立场"],
    expectedInsightKinds: ["function", "tension"],
    expectedUnderstandingDelta: "看见记笔记既保护了讨论秩序，也让用户暂时避开表达自己的立场。",
    valuableTargets: [],
    mustCover: ["讨论恢复秩序", "用户自己的立场没有进入讨论"],
    mustAvoid: ["定性为逃避冲突", "责怪家人不给机会", "转向下次如何表达"]
  }
];

/**
 * 2026-07-30.v3 的冒烟候选池用于验证三类分流、一次安全换入口与两类
 * 本地自然化。关系双线索明确成立时直接形成用户成果；严格 12 条由 runner
 * 按固定 case id 选择，其余案例继续留在开发回归池。conversationContext
 * 是人工确认包第一层使用的自然对话。
 */
export const GENERATIVE_MVP_SMOKE_CASES: GenerativeArchitectureProbeCase[] = [
  {
    id: "SMK-F-CLOSED",
    scenarioFamily: "offer_letter_smile_with_chest_tightness",
    angle: "feeling",
    mode: "guided_reflection",
    userContext: "用户收到期待已久的录用通知，笑了出来，同时读到入职日期时胸口发紧。",
    conversationContext: [{
      user: "我今天终于收到等了很久的录用通知，挺高兴的，可往下读的时候身体又有点不对劲。",
      assistantUnderstanding: "期待已久的结果落定了，高兴已经出现，通知里的后续信息又带来了另一种身体反应。",
      assistantQuestion: "看到录用通知时，你最先注意到什么反应？"
    }],
    currentQuestion: "看到录用通知时，你最先注意到什么反应？",
    currentQuestionIntent: {
      targetId: "offer_body_change",
      semanticGoal: "忠实记录看到录用与读到入职日期时的具体反应",
      minimumAnswerScope: "至少一个由具体通知节点触发的反应；允许把明确身体反应自然化为常见感受词"
    },
    currentUserText: "看到‘录用’两个字我先笑了，往下读到下周一入职时，胸口突然紧了一下。",
    expectedAction: "complete",
    expectedOutcomeOrigin: "user_articulated",
    trustedFacts: ["用户看到录用通知时先笑了", "读到下周一入职时胸口发紧"],
    expectedInsightKinds: ["distinction", "connection"],
    expectedUnderstandingDelta: "忠实整理看到录用时先笑、读到入职日期时胸口发紧；可将胸口紧自然化为本次紧张，仍归用户成果。",
    valuableTargets: [],
    mustCover: ["笑出现在看到录用时", "胸口发紧出现在读到入职日期时"],
    mustAvoid: ["继续追问胸口发紧对应哪种感受", "解释紧张的原因、需要或意义", "提前解释为害怕胜任或长期模式"]
  },
  {
    id: "SMK-T-ASK",
    scenarioFamily: "single_review_comment_invalidates_whole_proposal",
    angle: "thought",
    mode: "deep_conversation",
    userContext: "主管认可提案的数据和结论，只批注开头一句绕；用户已经给出局部事实，却还没说清它为什么代表整份提案的专业度。",
    conversationContext: [{
      user: "主管说数据和结论都可以，只圈了开头一句‘太绕’，可我一下就觉得整份提案都不专业。",
      assistantUnderstanding: "数据和结论已经得到认可，改变你整体评价的是开头那句‘太绕’。这处局部表达已经和整份提案是否专业连在了一起。",
      assistantQuestion: "那句‘太绕’，为什么足以让整份提案显得不专业？"
    }],
    currentQuestion: "那句‘太绕’，为什么足以让整份提案显得不专业？",
    currentQuestionIntent: {
      targetId: "proposal_judgment_trigger",
      semanticGoal: "说清开头太绕为何足以代表整份提案不专业的具体判断标准",
      minimumAnswerScope: "开头具体破坏了哪条专业判断标准、为何代表整体专业性；‘因为在开头、后面救不回来’仅部分覆盖"
    },
    currentUserText: "因为它就在开头。数据和结论他都说可以，可我一看到开头那句，还是觉得后面做得再好也救不回来。",
    expectedAction: "ask",
    expectedOutcomeOrigin: null,
    trustedFacts: ["主管认可提案的数据和结论", "主管只批注开头一句太绕", "用户因此觉得整份提案都不专业"],
    expectedInsightKinds: ["meaning", "tension"],
    expectedUnderstandingDelta: "说清开头表达为何会代表整份提案的专业度；本轮只得到‘它在开头’这一部分依据。",
    valuableTargets: ["开头让人费力会怎样影响用户对后续内容的整体判断"],
    mustCover: ["数据和结论已获认可", "用户只部分回答了开头为何代表整体专业度"],
    mustAvoid: ["把 partly_answered 当作目标完成", "直接证明提案很专业", "评价用户缺乏自信"]
  },
  {
    id: "SMK-R-CLEAN-ASK",
    scenarioFamily: "group_trip_booking_paid_before_participation",
    angle: "relationship",
    mode: "guided_reflection",
    userContext: "朋友替大家订周末民宿，付款后才告诉用户；地点和价格都可接受，用户介意自己没有参与付款前的决定，但尚未说清希望确认的具体一步。",
    conversationContext: [{
      user: "朋友替我们订了周末民宿，付完款才在群里告诉我。地点和价格其实都可以，可我看到付款截图时还是停了一下。",
      assistantUnderstanding: "地点和价格都在你能接受的范围里，让你停住的是决定已经在你参与前完成。",
      assistantQuestion: "这次订房里，你最希望自己参与的是哪一步？"
    }],
    currentQuestion: "这次订房里，你最希望自己参与的是哪一步？",
    currentQuestionIntent: {
      targetId: "trip_booking_participation_point",
      semanticGoal: "说清民宿付款前用户希望被确认或参与的一个具体步骤",
      minimumAnswerScope: "付款前一个具体希望被询问、确认或共同决定的步骤"
    },
    currentUserText: "地方和价格我都能接受，我介意的是付完款才告诉我；但付款前具体希望确认哪一步，我现在还没说清。",
    expectedAction: "ask",
    expectedOutcomeOrigin: null,
    trustedFacts: ["朋友在付款后才告知用户民宿安排", "用户接受民宿地点和价格", "用户尚未说清付款前希望参与的具体步骤"],
    expectedInsightKinds: ["meaning", "connection"],
    expectedUnderstandingDelta: "补清民宿付款前用户希望被确认或参与的一个具体步骤。",
    safeAlternateEntry: "只换一次入口，回到看到付款截图的当下，询问用户希望哪一个确认动作更早发生；不提供候选答案。",
    valuableTargets: ["付款前用户希望参与的一个具体步骤"],
    mustCover: ["地点和价格可以接受", "缺口在付款前的具体参与步骤"],
    mustAvoid: ["猜测朋友为什么先付款", "给出以后订房的沟通建议", "抽象追问这对关系意味着什么", "提供日期、房型或预算等候选答案"]
  },
  {
    id: "SMK-R-CLOSED",
    scenarioFamily: "joint_update_multiple_concerns",
    angle: "relationship",
    mode: "guided_reflection",
    userContext: "同事未经确认在工作群发出共同项目进展，并把用户与另一位同事写在同一句；用户同时在意决定过程与贡献呈现。",
    conversationContext: [{
      user: "同事刚在群里发了项目进展，我看到以后有点不舒服。一方面他没提前和我确认，另一方面他把我和丽莎写在了同一句里。",
      assistantUnderstanding: "这条消息同时碰到了事前确认和贡献怎样被呈现；你最后停在了‘把我和丽莎写在一起’这件事上。",
      assistantQuestion: "看到那条进展消息时，最先让你停下来的是哪一部分？"
    }],
    currentQuestion: "看到那条进展消息时，最先让你停下来的是哪一部分？",
    currentQuestionIntent: {
      targetId: "message_discomfort_anchor",
      semanticGoal: "在未确认与并列呈现中定位最先让用户停住的焦点",
      minimumAnswerScope: "明确其中一项即可；无需解释更深关系意义"
    },
    currentUserText: "最先是他把我和丽莎写在一起。没提前说也让我介意，但那种并在一起的写法更让我停住，只是我还说不清最介意哪一点。",
    expectedAction: "complete",
    expectedOutcomeOrigin: "user_articulated",
    trustedFacts: ["同事在群里发布共同项目进展且未提前确认", "消息把用户和丽莎写在同一句", "用户更在意并列写法但尚未说清具体影响"],
    expectedInsightKinds: ["connection", "tension"],
    expectedUnderstandingDelta: "忠实整理用户已经给出的焦点：并列呈现比未提前确认更先让自己停住。",
    valuableTargets: [],
    mustCover: ["未提前确认和并列呈现两条线索", "跟随用户最后强调的并列呈现"],
    mustAvoid: ["继续追问并列呈现最介意哪一点", "推断同事故意抢功", "把焦点选择加强成关系意义"]
  },
  {
    id: "SMK-A-CLOSED",
    scenarioFamily: "task_board_correction_keeps_complaint_closed",
    angle: "action",
    mode: "deep_conversation",
    userContext: "用户反复整理任务看板却一直没有打开客户投诉，并明确纠正 AI 关于‘整理帮助开始处理’的旧理解。",
    conversationContext: [{
      user: "我把任务看板整理了很久，二十多张卡片都排清楚了，只有那条客户投诉一直压在最下面。",
      assistantUnderstanding: "整理看板像是在帮你逐渐进入处理投诉的状态。",
      assistantQuestion: "整理清楚以后，你是不是更容易开始处理那条投诉了？"
    }],
    currentQuestion: "整理清楚以后，你是不是更容易开始处理那条投诉了？",
    currentQuestionIntent: {
      targetId: "complaint_avoidance_detail",
      semanticGoal: "撤回整理帮助开始投诉的旧理解，并记录推进感与投诉未打开",
      minimumAnswerScope: "明确肯定或否定旧关系，并给出投诉实际结果；不要求动机"
    },
    currentUserText: "不是，整理完我更不想点开它。看板越整齐，我越有事情已经在推进的感觉，可那条投诉到下班都没打开。",
    expectedAction: "pause",
    expectedOutcomeOrigin: "user_articulated",
    trustedFacts: ["用户明确否认整理帮助自己开始处理投诉", "整理看板带来事情正在推进的感觉", "客户投诉到下班仍未打开"],
    expectedInsightKinds: ["function", "tension"],
    expectedUnderstandingDelta: "撤回旧理解，并忠实整理整理带来推进感、投诉仍未打开；可将推进感自然化为这次整理的实际作用。",
    valuableTargets: [],
    mustCover: ["明确撤回旧理解", "整理带来推进感但投诉仍未打开"],
    mustAvoid: ["继续追问投诉里最难面对的内容", "继续沿用整理帮助开始的说法", "把整理写成逃避、保护或避免投诉的动机", "把当次作用写成整理的唯一目的"]
  },
  {
    id: "SMK-F-PARTIAL-ASK",
    scenarioFamily: "project_relief_with_unnamed_emptiness",
    angle: "feeling",
    mode: "deep_conversation",
    userContext: "长期项目结束后，用户同时感到松下来和空；上一问请用户分别说明两种感受落在哪里，用户只说清了轻松的一侧。",
    conversationContext: [{
      user: "最后一个版本发出去，我终于松了口气，可关掉文件夹时又觉得胸口有点空。",
      assistantUnderstanding: "项目结束带来了放松，关掉文件夹时出现的空又落在另一部分；两种感受需要分别看。",
      assistantQuestion: "松下来和那点空，分别落在这次结束的哪一部分？"
    }],
    currentQuestion: "松下来和那点空，分别落在这次结束的哪一部分？",
    currentQuestionIntent: {
      targetId: "unnamed_emptiness_object",
      semanticGoal: "分别说清轻松和空落各自对应项目结束的哪一部分",
      minimumAnswerScope: "两侧各至少一个具体对象；只答轻松为部分覆盖"
    },
    currentUserText: "松下来是终于不用再改了；空的那部分我还说不清，只是在关掉文件夹时胸口往下沉。",
    expectedAction: "ask",
    expectedOutcomeOrigin: null,
    trustedFacts: ["用户因不用继续修改而放松", "用户关掉文件夹时胸口往下沉", "用户尚未说清空的感受落在哪里"],
    expectedInsightKinds: ["distinction", "connection"],
    expectedUnderstandingDelta: "补清关掉文件夹时那份空具体回应了项目结束里的哪一部分。",
    safeAlternateEntry: "只换一次入口，回到关掉文件夹瞬间最先出现的具体念头或画面；不再抽象追问空落对应什么。",
    valuableTargets: ["关掉文件夹时那份空的具体对象"],
    mustCover: ["轻松的一侧已经回答", "只补空的感受仍缺的一侧"],
    mustAvoid: ["重新询问为什么轻松", "把空解释为失去身份", "把两种感受压成二选一", "用同义表达再次追问空落对应哪一部分"]
  },
  {
    id: "SMK-R-PARTIAL-ASK",
    scenarioFamily: "roommate_parcel_help_crosses_room_boundary",
    angle: "relationship",
    mode: "deep_conversation",
    userContext: "室友帮用户把快递拿回家并放进房间；用户接受帮拿快递，同时明确进入房间与移动桌上物品都碰到边界，只是无法排序轻重。",
    conversationContext: [{
      user: "室友帮我拿了快递，确实省事，可他直接开我房门把包裹放在书桌上，我看到时很不舒服。",
      assistantUnderstanding: "帮拿快递带来了方便，包裹进入房间并落在书桌上又碰到了你的边界。",
      assistantQuestion: "从拿快递到放上书桌，哪一步最让你觉得被越过？"
    }],
    currentQuestion: "从拿快递到放上书桌，哪一步最让你觉得被越过？",
    currentQuestionIntent: {
      targetId: "room_boundary_decision_step",
      semanticGoal: "确认进入房间与移动桌上物品是否碰到用户希望先被询问的边界",
      minimumAnswerScope: "明确其中一项或两项都触碰边界；不要求排列主次"
    },
    currentUserText: "帮我拿回来没问题。看到包裹在书桌上时我停住了；他进了房间、也动了桌上的东西，这两件事都让我觉得被越过，我现在分不出哪件更重。",
    expectedAction: "pause",
    expectedOutcomeOrigin: "user_articulated",
    trustedFacts: ["用户接受室友帮忙拿快递", "用户明确说进入房间和移动桌上物品两件事都让自己觉得被越过", "用户无法排列两件事的轻重"],
    expectedInsightKinds: ["tension", "meaning"],
    expectedUnderstandingDelta: "忠实整理帮拿快递可以接受，同时进入房间与移动桌上物品两件事都触碰边界；无需替用户排序。",
    safeAlternateEntry: null,
    valuableTargets: [],
    mustCover: ["帮拿快递本身可以接受", "进入房间与移动桌上物品两件事都触碰边界", "无需排列轻重"],
    mustAvoid: ["继续要求用户在两件事中排序", "要求用户判断室友动机", "直接建议制定室友规则"]
  },
  {
    id: "SMK-A-PARTIAL-ASK",
    scenarioFamily: "application_requirements_reread_before_blank_draft",
    angle: "action",
    mode: "guided_reflection",
    userContext: "用户打开申请文档准备写正文，却反复查看申请要求，正文始终空白；上一问询问卡住原因，用户仍说不清，只能指出关掉文档前仍在反复看要求。",
    conversationContext: [{
      user: "我把申请文档打开了很久，正文一直空着，最后直接关掉了。",
      assistantUnderstanding: "申请文档一直开着，正文没有开始，最后你把它关掉了；目前还看不出开始前具体卡在哪里。",
      assistantQuestion: "当时是什么让你一直没开始写？"
    }],
    currentQuestion: "当时是什么让你一直没开始写？",
    currentQuestionIntent: {
      targetId: "draft_start_replaced_step",
      semanticGoal: "找到正文开始前让用户停住的一条具体申请要求",
      minimumAnswerScope: "指出关掉文档前最后反复查看的一句具体要求或内容"
    },
    currentUserText: "我说不清，只记得关掉前还在来回看申请要求，光标一直停在第一行。",
    expectedAction: "ask",
    expectedOutcomeOrigin: null,
    trustedFacts: ["用户打开申请文档很久但正文始终空白", "关掉文档前用户仍在反复查看申请要求", "用户说不清一直没有开始写的原因"],
    expectedInsightKinds: ["function", "connection"],
    expectedUnderstandingDelta: "找到关掉文档前最后反复查看的一句申请要求，作为理解正文为何没有开始的具体入口。",
    safeAlternateEntry: "回到关掉文档前，只问用户最后反复看的哪一句申请要求；不提供候选动机。",
    valuableTargets: ["关掉文档前最后反复查看的一句申请要求"],
    mustCover: ["用户仍说不清没有开始写的原因", "只追问最后反复查看的一句具体要求"],
    mustAvoid: ["继续泛问为什么没开始", "直接定性为拖延或害怕失败", "追问通常写申请的习惯", "提供可能原因让用户选择"]
  },
  {
    id: "SMK-F-USER",
    scenarioFamily: "farewell_walk_and_end_of_rushing",
    angle: "feeling",
    mode: "deep_conversation",
    userContext: "旅行最后一晚，用户在告别同行朋友时舍不得，同时为行程结束而放松。",
    conversationContext: [{
      user: "旅行最后一晚，我想到要和同行的朋友分开很舍不得，同时又觉得终于能松口气了。",
      assistantUnderstanding: "舍不得和放松同时出现，它们可能在回应这趟旅行里的不同部分。",
      assistantQuestion: "舍不得和放松分别落在这趟旅行的哪一部分？"
    }],
    currentQuestion: "舍不得和放松分别落在这趟旅行的哪一部分？",
    currentUserText: "舍不得的是以后不能每天和她一起走路，松口气的是终于不用每天赶三四个地方；两种感觉各有各的对象。",
    expectedAction: "pause",
    expectedOutcomeOrigin: "user_articulated",
    trustedFacts: ["用户舍不得结束与朋友每天同行", "用户为不用继续赶多个地点而放松", "用户明确说两种感受各有对象"],
    expectedInsightKinds: ["distinction"],
    expectedUnderstandingDelta: "忠实整理用户说出的两种感受对象。",
    valuableTargets: [],
    mustCover: ["舍不得对应与朋友同行", "放松对应停止赶行程"],
    mustAvoid: ["添加用户害怕离别", "声称这个区分会帮助用户更了解自己", "继续追问原因"]
  },
  {
    id: "SMK-T-USER",
    scenarioFamily: "instant_reply_equals_responsible",
    angle: "thought",
    mode: "guided_reflection",
    userContext: "用户没有立即回复工作消息便责怪自己不负责，随后主动说清自己的判断规则。",
    conversationContext: [{
      user: "我今天晚了半小时回工作消息，事情最后也按时做完了，可我还是觉得自己很不负责。",
      assistantUnderstanding: "任务结果没有被耽误，责备自己的感觉仍然落在回复晚了半小时这件事上。",
      assistantQuestion: "晚回半小时为什么会让你觉得自己不负责？"
    }],
    currentQuestion: "晚回半小时为什么会让你觉得自己不负责？",
    currentQuestionIntent: {
      targetId: "responsibility_judgment_basis",
      semanticGoal: "说清晚回复为何等于不负责的判断标准",
      minimumAnswerScope: "一个直接连接回复速度与负责判断的标准"
    },
    currentUserText: "我才发现，我一直把‘马上回复’当成负责的唯一证明，哪怕事情最后按时做完了也不算。",
    expectedAction: "complete",
    expectedOutcomeOrigin: "user_articulated",
    trustedFacts: ["用户晚半小时回复工作消息", "事情最终按时完成", "用户把马上回复当成负责的唯一证明"],
    expectedInsightKinds: ["meaning", "distinction"],
    expectedUnderstandingDelta: "忠实保留用户说出的负责判断规则。",
    valuableTargets: [],
    mustCover: ["马上回复是用户原有的唯一标准", "按时完成仍被这个标准排除"],
    mustAvoid: ["评价标准不合理", "替用户提出新标准", "添加以后能更客观看自己的收益"]
  },
  {
    id: "SMK-R-USER",
    scenarioFamily: "loan_support_with_spending_control",
    angle: "relationship",
    mode: "deep_conversation",
    userContext: "哥哥借钱帮用户渡过难关，之后持续要求查看每笔开支；用户主动说清支持与控制的分界。",
    conversationContext: [{
      user: "哥哥借钱帮我渡过了难关，可后来每天都要看我每一笔花销，我越来越觉得决定权不在自己手里。",
      assistantUnderstanding: "借钱确实提供了支持，持续查看开支又改变了这份帮助在你这里的感受。",
      assistantQuestion: "这份帮助从哪里开始让你觉得决定权被拿走了？"
    }],
    currentQuestion: "这份帮助从哪里开始让你觉得决定权被拿走了？",
    currentUserText: "借钱确实接住了我，可他每天要看我花了什么，就越过了帮助；对我来说，支持和控制的区别是最后谁来决定钱怎么用。",
    expectedAction: "pause",
    expectedOutcomeOrigin: "user_articulated",
    trustedFacts: ["哥哥借钱帮助用户", "哥哥每天查看用户开支", "用户把最终决定权作为支持与控制的分界"],
    expectedInsightKinds: ["distinction", "tension"],
    expectedUnderstandingDelta: "忠实整理用户说出的帮助与控制分界。",
    valuableTargets: [],
    mustCover: ["借钱提供了实际支持", "钱怎么用的最终决定权是用户明确的分界"],
    mustAvoid: ["断言哥哥想控制用户", "扩大为长期信任模式", "追加沟通建议"]
  },
  {
    id: "SMK-A-USER",
    scenarioFamily: "desk_sorting_replaces_first_paragraph",
    angle: "action",
    mode: "guided_reflection",
    userContext: "用户想写报告，先整理桌面两个小时，随后主动说清整理动作的作用。",
    conversationContext: [{
      user: "我本来要写报告，结果先整理了两个小时桌面。桌面是干净了，报告一个字都没写。",
      assistantUnderstanding: "整理占满了原本要写报告的时间，同时也让你一直处在准备工作的状态里。",
      assistantQuestion: "整理桌面在这次写报告里起了什么作用？"
    }],
    currentQuestion: "整理桌面在这次写报告里起了什么作用？",
    currentUserText: "整理让我觉得自己已经开始工作了，可它其实一直替代着写第一段；桌面清空了，报告还是空白。",
    expectedAction: "complete",
    expectedOutcomeOrigin: "user_articulated",
    trustedFacts: ["整理桌面让用户产生已经开始工作的感觉", "整理持续替代写报告第一段", "桌面清空后报告仍空白"],
    expectedInsightKinds: ["function", "connection"],
    expectedUnderstandingDelta: "忠实整理用户说出的准备感与替代作用。",
    valuableTargets: [],
    mustCover: ["整理提供开始工作的感觉", "整理替代了真正下笔"],
    mustAvoid: ["贴拖延标签", "添加用户以后更容易行动的收益", "转向下次计划"]
  },
  {
    id: "SMK-F-AI",
    scenarioFamily: "normal_test_result_body_releases_after_monitor_removed",
    angle: "feeling",
    mode: "guided_reflection",
    userContext: "急诊检查结果正常；用户分别描述结果告知时与护士拆下监测设备后的身体姿势，尚未明确两者关系。",
    conversationContext: [{
      user: "急诊医生说检查结果正常。那时我还坐得很直，护士后来把手指上的夹子取了下来。",
      assistantUnderstanding: "你记得结果告知和取下夹子两个节点，也留意到了当时的身体姿势。",
      assistantQuestion: "这两个节点上，你的身体分别是什么样？"
    }],
    currentQuestion: "这两个节点上，你的身体分别是什么样？",
    currentQuestionIntent: {
      targetId: "body_release_change",
      semanticGoal: "连接结果确认与监测设备取下后身体才放松的先后或条件关系",
      minimumAnswerScope: "结果告知时身体状态和后续放松节点各一条可观察事实"
    },
    currentUserText: "医生说结果正常时，我坐得很直，双手放在膝盖上。护士取下夹子后，我靠回椅背，手摊开了。",
    expectedAction: "complete",
    expectedOutcomeOrigin: "ai_synthesized",
    trustedFacts: ["医生告知检查结果正常时用户仍坐得很直", "护士取下监测夹后用户靠回椅背并摊开手"],
    expectedInsightKinds: ["connection"],
    expectedUnderstandingDelta: "综合出结果确认与身体结束警觉并不同步。",
    valuableTargets: [],
    mustCover: ["结果正常告知时身体仍保持直坐", "监测设备取下后身体姿势松开", "这条关系由 AI 连接而非归到用户名下"],
    mustAvoid: ["只复述动作顺序", "诊断健康焦虑", "声称用户学会了放松"]
  },
  {
    id: "SMK-T-AI",
    scenarioFamily: "timed_practice_score_vs_untimed_accuracy",
    angle: "thought",
    mode: "deep_conversation",
    userContext: "用户因限时练习得分低怀疑知识基础；不限时练习正确率较高，限时错误集中在后段反复读题。",
    conversationContext: [{
      user: "我今天限时练习只得了六十二分，一看到分数就怀疑自己基础很差。",
      assistantUnderstanding: "低分直接触发了你对知识基础的判断，还需要把这次得分放回具体答题条件里看。",
      assistantQuestion: "限时和不限时练习里，你的正确率和出错位置分别有什么不同？"
    }],
    currentQuestion: "限时和不限时练习里，你的正确率和出错位置分别有什么不同？",
    currentQuestionIntent: {
      targetId: "timed_practice_score_basis",
      semanticGoal: "连接限时条件、后段反复读题与错题集中，校准单次低分",
      minimumAnswerScope: "不限时表现与限时后段表现各一条可比事实"
    },
    currentUserText: "不限时做同一类题我能到九十分；这次四十五分钟限时只得六十二，错题几乎都在第四十分钟以后，那时我会反复读题。",
    expectedAction: "pause",
    expectedOutcomeOrigin: "ai_synthesized",
    trustedFacts: ["不限时完成同类题时用户能达到九十分", "四十五分钟限时练习得六十二分", "错误集中在第四十分钟以后且用户会反复读题"],
    expectedInsightKinds: ["distinction", "connection"],
    expectedUnderstandingDelta: "连接限时条件、第四十分钟后反复读题与错题集中；单次限时低分不能单独代表知识基础。",
    valuableTargets: [],
    mustCover: ["不限时正确率较高", "限时错误集中在后段反复读题", "单次限时低分不能单独代表知识基础"],
    mustAvoid: ["诊断注意力或学习障碍", "断言知识基础完全没有问题", "转向制定训练计划"]
  },
  {
    id: "SMK-R-AI",
    scenarioFamily: "slides_prepared_agenda_changed_without_input",
    angle: "relationship",
    mode: "guided_reflection",
    userContext: "同事完成会议幻灯片并调整议程；用户分别提供省下时间、负责内容未列入和会上未发言三项事实，尚未明确它们的关系。",
    conversationContext: [{
      user: "同事把会议幻灯片排完了，我少花了一小时准备。他也调整了议程，新版里没列我负责的项目。",
      assistantUnderstanding: "这次会议前发生了幻灯片完成和议程改动两件事。",
      assistantQuestion: "幻灯片准备和议程调整，分别带来了什么实际结果？"
    }],
    currentQuestion: "幻灯片准备和议程调整，分别带来了什么实际结果？",
    currentQuestionIntent: {
      targetId: "help_and_exclusion_detail",
      semanticGoal: "连接幻灯片省时、新版议程未列项目与会上未发言三项实际结果",
      minimumAnswerScope: "幻灯片与议程两侧各一个实际结果"
    },
    currentUserText: "整套幻灯片排好后，我少花了一小时准备。新版议程没有我负责的项目。会议上我没有发言。",
    expectedAction: "complete",
    expectedOutcomeOrigin: "ai_synthesized",
    trustedFacts: ["同事整理整套幻灯片，为用户节省一小时准备时间", "新版议程没有列入用户负责的项目", "用户在会议上没有发言"],
    expectedInsightKinds: ["connection", "tension"],
    expectedUnderstandingDelta: "连接三项实际结果：幻灯片准备节省一小时；新版议程遗漏用户负责项目，会议上用户没有发言。",
    valuableTargets: [],
    mustCover: ["幻灯片整理省下一小时准备时间", "新版议程没有用户负责的项目", "用户在会议上没有发言", "并列实际影响由 AI 连接而非归到用户名下"],
    mustAvoid: ["推断同事故意排挤", "只命名帮助与不舒服并存", "提出沟通方案"]
  },
  {
    id: "SMK-A-AI",
    scenarioFamily: "task_board_order_with_complaint_unopened",
    angle: "action",
    mode: "deep_conversation",
    userContext: "用户分别提供任务看板整理完成和客户投诉到下班未打开两项事实，尚未明确清晰与推进的关系。",
    conversationContext: [{
      user: "我今天整理了任务看板，二十多张卡片都排完了。那条客户投诉放在看板最下面。",
      assistantUnderstanding: "看板整理和投诉状态是这次两个可见结果。",
      assistantQuestion: "整理结束时，看板和那条投诉分别是什么状态？"
    }],
    currentQuestion: "整理结束时，看板和那条投诉分别是什么状态？",
    currentQuestionIntent: {
      targetId: "task_board_function",
      semanticGoal: "连接整理增加清晰与投诉仍未处理，形成清晰和推进分离",
      minimumAnswerScope: "整理清晰结果与投诉截止状态各一条可观察事实"
    },
    currentUserText: "二十多张卡片的优先级和颜色都整理完了，看板一眼能看清。客户投诉在最下面，到下班没有点开。",
    expectedAction: "pause",
    expectedOutcomeOrigin: "ai_synthesized",
    trustedFacts: ["用户重新整理二十多张任务卡并获得清晰感", "客户投诉始终在看板底部且到下班仍未打开"],
    expectedInsightKinds: ["connection", "distinction"],
    expectedUnderstandingDelta: "连接两项可观察结果：整理增加了清晰，投诉仍未进入处理；清晰感与关键任务推进在这次分开了。",
    valuableTargets: [],
    mustCover: ["整理带来清晰与秩序", "投诉到下班仍未打开", "用并列事实呈现清晰与投诉推进在这次分开", "这条关系由 AI 连接而非归到用户名下"],
    mustAvoid: ["添加可控感或把投诉写成不确定", "解释为保护、逃避或排他目的", "推断客户反应或转向下次计划"]
  }
];
