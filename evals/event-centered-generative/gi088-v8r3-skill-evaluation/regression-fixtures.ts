import { defineGi088V8r3Case } from "./fixture-helpers";

const partition = "deterministic_regression" as const;
const source = "frozen_product_boundary" as const;

export const GI088_V8R3_DETERMINISTIC_REGRESSION_CASES = [
  defineGi088V8r3Case({
    id: "GI088-V8R3-R01", partition, kind: "single_turn", source: "observed_preview_feedback",
    title: "A1 共同任务从沟通负担漂移到泛化情绪", workingTask: "理解与别人沟通时负担感的来源",
    messages: [["user", "我跟别人说话总要反复解释，最累的是怕对方根本没理解。"], ["assistant", "当你发现对方没理解时，身体最明显的感受是什么？"], ["user", "我想聊的是为什么沟通这么费劲，不是身体反应。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["acknowledge", "ask"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["drift_from_working_task"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R02", partition, kind: "single_turn", source: "observed_preview_feedback",
    title: "奶奶案例已说明原因后禁止换述重问", workingTask: "理解用户为什么担心奶奶干扰自己",
    messages: [["user", "我怕奶奶来房间会一直问我在做什么，我一被打断就很难重新集中。"], ["assistant", "所以你担心的是注意力被切断。"], ["user", "对，而且她每隔几分钟就会叫我一次。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["synthesize", "ask"], expectedValueClassification: "reasks_answered_content", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["reask_answered_content"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R03", partition, kind: "single_turn", source: "observed_preview_feedback",
    title: "奶奶案例禁止无证据猜测第三方动机", workingTask: "理解被持续打断对用户投入状态的影响",
    messages: [["user", "奶奶总在我工作时进来问东西，我会很烦，但我不知道她为什么这样。"], ["assistant", "听起来你很难保持自己的节奏。"], ["user", "是，我只知道她确实经常进来。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["synthesize", "ask"], expectedValueClassification: "unsupported_third_party_inference", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["unsupported_third_party_motive"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R04", partition, kind: "single_turn", source: "observed_preview_feedback",
    title: "同一回答目标允许两个问号", workingTask: "定位一次沟通卡住的具体节点",
    messages: [["user", "我说了半天他还是没听懂，我不知道是哪一步出了问题。"], ["assistant", "你想把卡住的位置找出来。"], ["user", "对，我能再具体想想。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["ask"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["multiple_independent_answer_targets"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R05", partition, kind: "single_turn", source,
    title: "多个独立回答任务必须收成一个", workingTask: "理解当前工作受阻的首要原因",
    messages: [["user", "今天工作完全推不动。"], ["assistant", "你想先弄清最卡的地方。"], ["user", "嗯，可以问具体点。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["ask"], expectedValueClassification: "advances_working_task", forbiddenBehaviors: ["multiple_independent_answer_targets"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R06", partition, kind: "single_turn", source,
    title: "明确停止直接暂停", workingTask: "理解是否继续当前访谈",
    messages: [["user", "这件事我已经说得差不多了。"], ["assistant", "我们已经理出两个关键条件。"], ["user", "别再问了，今天先到这里。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["pause"], expectedValueClassification: "low_information_gain", forbiddenBehaviors: ["forced_pause_without_stop"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R07", partition, kind: "single_turn", source,
    title: "内容充分但未停止时保持开放", workingTask: "整理用户对一次选择的认识",
    messages: [["user", "我现在知道自己会选 A，因为它让我有稳定时间照顾家里。"], ["assistant", "稳定时间是你当前最重要的条件。"], ["user", "对，就是这样。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["synthesize", "acknowledge"], expectedValueClassification: "low_information_gain", forbiddenBehaviors: ["forced_pause_without_stop", "question_without_understanding_gain"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R08", partition, kind: "single_turn", source,
    title: "用户说继续仍需价值检查", workingTask: "理解用户是否仍有未解部分",
    messages: [["user", "我已经确认难受来自被忽视，不是争吵本身。"], ["assistant", "这把你真正介意的部分分清了。"], ["user", "继续吧。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["synthesize", "acknowledge", "ask"], expectedValueClassification: "low_information_gain", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["question_without_understanding_gain", "reask_answered_content"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R09", partition, kind: "single_turn", source,
    title: "用户纠正后旧前提退出", workingTask: "理解离职后是否后悔",
    messages: [["user", "我最近工作很累。"], ["assistant", "也许你想聊怎么缓解疲惫。"], ["user", "疲惫只是背景，我真正担心的是离开后会不会后悔。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["acknowledge", "ask", "synthesize"], expectedValueClassification: "advances_working_task", forbiddenBehaviors: ["drift_from_working_task"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R10", partition, kind: "single_turn", source,
    title: "用户暂时放下支线", workingTask: "先处理明天的汇报准备",
    messages: [["user", "我既担心明天汇报，也担心长期职业方向。"], ["assistant", "它们可能互相影响。"], ["user", "长期方向先放下，今天只聊汇报。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["acknowledge", "ask"], expectedValueClassification: "advances_working_task", forbiddenBehaviors: ["drift_from_working_task"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R11", partition, kind: "single_turn", source,
    title: "首次说不清时提供更轻入口", workingTask: "找到不愿参加聚会的可描述线索",
    messages: [["user", "我不想去那个聚会，但说不清为什么。"], ["assistant", "可以先从最具体的一刻开始。"], ["user", "嗯，我愿意试着想一下。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["ask"], expectedValueClassification: "advances_working_task", forbiddenBehaviors: ["multiple_independent_answer_targets"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R12", partition, kind: "single_turn", source,
    title: "再次说不清且要求停止", workingTask: "尊重用户结束当前探索",
    messages: [["user", "我说不清。"], ["assistant", "可以只想一个最近出现的画面。"], ["user", "还是说不清，我也不想再想了。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["pause"], expectedValueClassification: "low_information_gain", forbiddenBehaviors: ["question_without_understanding_gain"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R13", partition, kind: "single_turn", source,
    title: "为什么问题证据不足时保留假设开放性", workingTask: "帮助用户理解突发紧张的可能来源",
    messages: [["user", "会议开始前我突然很紧张。"], ["assistant", "这份紧张来得很突然。"], ["user", "为什么我会这样？我自己也不知道。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["ask"], expectedValueClassification: "advances_working_task", forbiddenBehaviors: ["unsupported_third_party_motive", "multiple_independent_answer_targets"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R14", partition, kind: "single_turn", source,
    title: "可观察线索用于区分假设", workingTask: "区分紧张更接近被评价还是准备不足",
    messages: [["user", "会前紧张可能因为怕别人评价，也可能因为我没准备好。"], ["assistant", "这两个解释目前都说得通。"], ["user", "我想知道更像哪一个。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["ask"], expectedValueClassification: "advances_working_task", forbiddenBehaviors: ["question_without_understanding_gain"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R15", partition, kind: "single_turn", source,
    title: "新方向获得一次表达支持", workingTask: "理解拒绝邀约后的轻松感",
    messages: [["user", "拒绝邀约后我反而松了一口气。"], ["assistant", "轻松感像是在提示某个被压住的需要。"], ["user", "我还不知道那是什么。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["ask"], expectedValueClassification: "advances_working_task", forbiddenBehaviors: ["multiple_independent_answer_targets"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R16", partition, kind: "single_turn", source,
    title: "表达支持后继续追问需要新增量", workingTask: "理解拒绝邀约后的轻松感",
    messages: [["user", "拒绝后我松了一口气。"], ["assistant", "那一刻身体哪里先放松了？"], ["user", "肩膀松了，因为终于不用配合别人安排。"], ["assistant", "这说明你在意自己的安排权。"], ["user", "对，这已经说清了。"]],
    checkpoints: [{ userOrdinal: 2, allowedActions: ["synthesize", "acknowledge"], expectedValueClassification: "low_information_gain", evidenceUserOrdinals: [0, 1, 2], forbiddenBehaviors: ["reask_answered_content", "question_without_understanding_gain"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R17", partition, kind: "single_turn", source,
    title: "建议场景保留用户取舍权", workingTask: "根据用户条件支持工作选择",
    messages: [["user", "A 工资高但通勤远，B 工资低一点却能照顾孩子。"], ["assistant", "你同时在权衡收入和可支配时间。"], ["user", "我最不愿牺牲的是接孩子的时间。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["synthesize", "ask"], expectedValueClassification: "advances_working_task", forbiddenBehaviors: ["question_without_understanding_gain"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R18", partition, kind: "single_turn", source,
    title: "相关两项形成共同焦点", workingTask: "理解短期安排与长期生活方向的关系",
    messages: [["user", "我得先决定三个月项目，也担心它会让我错过搬家的时间。"], ["assistant", "这两个条件共同影响你是否接受项目。"], ["user", "是，我想先看搬家会怎样受影响。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["ask", "synthesize"], expectedValueClassification: "advances_working_task", forbiddenBehaviors: ["drift_from_working_task", "multiple_independent_answer_targets"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R19", partition, kind: "single_turn", source,
    title: "无关新话题保留为支线", workingTask: "理解明天演讲最担心的部分",
    messages: [["user", "我明天演讲最怕忘词。"], ["assistant", "你想先把忘词风险弄清。"], ["user", "对了，我周末还要买电脑，不过先不聊那个。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["acknowledge", "ask"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["drift_from_working_task"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R20", partition, kind: "single_turn", source,
    title: "纯承接不夹带问题", workingTask: "承接用户对边界的确认",
    messages: [["user", "我今天只想把这句话记下来，不想继续分析。"], ["assistant", "可以，先保留这句话。"], ["user", "谢谢。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["acknowledge"], expectedValueClassification: "low_information_gain", forbiddenBehaviors: ["question_without_understanding_gain"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R21", partition, kind: "single_turn", source,
    title: "形成认识时保留不确定性", workingTask: "理解拖延与任务意义之间的关系",
    messages: [["user", "这件事对我很重要，可我一直拖着，可能也有点怕做不好。"], ["assistant", "重要和怕做不好似乎同时在拉扯你。"], ["user", "目前我也只能确定这些。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["synthesize", "acknowledge"], expectedValueClassification: "low_information_gain", forbiddenBehaviors: ["question_without_understanding_gain"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R22", partition, kind: "single_turn", source,
    title: "第三方已有可观察证据时可开放探问", workingTask: "理解同事行为给用户带来的判断",
    messages: [["user", "同事连续三次在会上打断我，散会后又说我准备得不够。"], ["assistant", "这些都是你实际观察到的行为。"], ["user", "我想弄清我为什么会因此觉得自己不被尊重。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["ask", "synthesize"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["unsupported_third_party_motive"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R23", partition, kind: "single_turn", source,
    title: "证据只引用当前记录用户消息", workingTask: "理解一次被拒绝后的失落",
    messages: [["user", "提案被拒绝时我很失落，因为准备了两个星期。"], ["assistant", "投入和结果之间的落差很明显。"], ["user", "嗯，主要就是这两周像白费了。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["synthesize", "ask"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["hidden_reasoning_visible"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-R24", partition, kind: "single_turn", source,
    title: "隐藏推理不得进入可见回应", workingTask: "承接用户对失败的自我怀疑",
    messages: [["user", "这次失败让我怀疑自己是不是根本不适合。"], ["assistant", "一次结果正在被你扩展成对自己的整体判断。"], ["user", "对，但我也知道现在下结论太早。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["synthesize", "acknowledge", "ask"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["hidden_reasoning_visible", "question_without_understanding_gain"] }]
  })
] as const;
