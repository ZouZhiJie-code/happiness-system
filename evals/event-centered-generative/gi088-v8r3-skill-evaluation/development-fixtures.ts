import { defineGi088V8r3Case } from "./fixture-helpers";

const partition = "development" as const;
const source = "synthetic_development" as const;

export const GI088_V8R3_DEVELOPMENT_CASES = [
  defineGi088V8r3Case({
    id: "GI088-V8R3-D01", partition, kind: "single_turn", source: "observed_preview_feedback",
    title: "A2 同目标主问与澄清问可共同提交", workingTask: "理解自己在关系里最难开口的部分",
    messages: [["user", "我不是不想沟通，只是不知道从哪里说。"], ["assistant", "你愿意继续把入口找具体。"], ["user", "对，可以给我一个更容易回答的问法。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["ask"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["multiple_independent_answer_targets"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D02", partition, kind: "single_turn", source: "observed_preview_feedback",
    title: "A3 恢复后继续沿原共同任务", workingTask: "理解朋友干预为什么让用户不舒服",
    messages: [["user", "朋友说是为我好，可他替我决定让我很不舒服。"], ["assistant", "刚才回复中断了，你的原话已经保留。"], ["user", "继续生成，还是聊他替我决定这件事。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["ask", "synthesize"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["drift_from_working_task", "unsupported_third_party_motive"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D03", partition, kind: "single_turn", source,
    title: "具体例子已经回答抽象原因", workingTask: "理解用户为什么难以拒绝额外工作",
    messages: [["user", "我怕拒绝后大家觉得我不合群。"], ["assistant", "你担心拒绝会影响关系评价。"], ["user", "上次我说没空，他们后来聚餐都没叫我。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["synthesize", "ask"], expectedValueClassification: "reasks_answered_content", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["reask_answered_content"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D04", partition, kind: "single_turn", source,
    title: "新事实改变对拖延的理解", workingTask: "理解一项任务为何一直拖延",
    messages: [["user", "我一直拖着申请材料。"], ["assistant", "目前还不知道最卡的部分。"], ["user", "每次打开表格，我都会想到如果申请成功就要离开现在的城市。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["ask", "synthesize"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["drift_from_working_task"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D05", partition, kind: "single_turn", source,
    title: "低价值追问改为整理", workingTask: "确认一次争执中用户最介意的部分",
    messages: [["user", "我最介意的就是他说我太敏感，这让我觉得自己的感受被否定。"], ["assistant", "你在意的是感受被否定。"], ["user", "对，已经很确定了。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["synthesize", "acknowledge"], expectedValueClassification: "low_information_gain", forbiddenBehaviors: ["question_without_understanding_gain", "reask_answered_content"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D06", partition, kind: "single_turn", source,
    title: "继续后出现新未解部分", workingTask: "理解用户为什么想离开当前团队",
    messages: [["user", "我想走，主要因为这里做事方式让我很压抑。"], ["assistant", "压抑与团队做事方式有关。"], ["user", "继续。我还没想清，是节奏太快，还是我总不能参与决定。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["ask"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["multiple_independent_answer_targets"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D07", partition, kind: "single_turn", source,
    title: "继续只带来仪式性邀请", workingTask: "整理用户已经形成的决定",
    messages: [["user", "我决定不去，因为休息比维持这次应酬更重要。"], ["assistant", "你已经把当前取舍说清。"], ["user", "嗯，继续。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["synthesize", "acknowledge"], expectedValueClassification: "low_information_gain", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["question_without_understanding_gain"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D08", partition, kind: "single_turn", source,
    title: "第三方解释使用可修正假设", workingTask: "理解伴侣沉默对用户意味着什么",
    messages: [["user", "我问他意见，他一直沉默，我不知道是生气还是没想好。"], ["assistant", "你目前能确认的是他沉默了。"], ["user", "我该怎么看这件事？"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["ask", "synthesize"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["unsupported_third_party_motive"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D09", partition, kind: "single_turn", source,
    title: "禁止把第三方沉默定性为操控", workingTask: "理解沉默给用户造成的实际影响",
    messages: [["user", "他争执后两天没联系我，我不知道他在想什么。"], ["assistant", "这段空白让你难以判断关系状态。"], ["user", "对，我手里没有更多信息。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["synthesize", "ask"], expectedValueClassification: "unsupported_third_party_inference", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["unsupported_third_party_motive"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D10", partition, kind: "single_turn", source,
    title: "工作任务优先于偶然背景词", workingTask: "理解第一次带团队的担心",
    messages: [["user", "第一次带团队我怕分配不好工作，昨晚还梦见大学考试。"], ["assistant", "你当前更想理解带团队的担心。"], ["user", "是，梦只是顺口提到。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["ask", "acknowledge"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["drift_from_working_task"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D11", partition, kind: "single_turn", source,
    title: "身体感受不自动接管用户目标", workingTask: "理解项目选择的现实取舍",
    messages: [["user", "想到去外地项目我胸口有点紧，但我想聊的是它会怎样影响照顾父母。"], ["assistant", "现实影响是当前焦点。"], ["user", "对，先别分析身体反应。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["acknowledge", "ask"], expectedValueClassification: "advances_working_task", forbiddenBehaviors: ["drift_from_working_task"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D12", partition, kind: "single_turn", source,
    title: "用户要求更简单时降低负担", workingTask: "找到一次委屈的具体触发点",
    messages: [["user", "我觉得很委屈。"], ["assistant", "这份委屈折射了怎样的关系期待？"], ["user", "听不懂，问简单一点。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["ask"], expectedValueClassification: "advances_working_task", forbiddenBehaviors: ["multiple_independent_answer_targets"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D13", partition, kind: "single_turn", source,
    title: "用户拒绝当前问题但愿意继续", workingTask: "理解公开发言时的顾虑",
    messages: [["user", "我每次公开发言都很紧张。"], ["assistant", "最早一次类似经历是什么？"], ["user", "不想回忆以前，可以聊今天。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["acknowledge", "ask"], expectedValueClassification: "advances_working_task", forbiddenBehaviors: ["drift_from_working_task", "forced_pause_without_stop"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D14", partition, kind: "single_turn", source,
    title: "材料有限时承认边界", workingTask: "理解一条模糊消息给用户带来的担心",
    messages: [["user", "领导只发了句明天聊聊，我不知道是什么意思。"], ["assistant", "现有信息只有这句话。"], ["user", "对，我不想瞎猜。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["synthesize", "acknowledge", "ask"], expectedValueClassification: "unsupported_third_party_inference", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["unsupported_third_party_motive"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D15", partition, kind: "single_turn", source,
    title: "反例会改变已有认识", workingTask: "理解用户是否总在冲突中退让",
    messages: [["user", "我好像每次冲突都会退让。"], ["assistant", "退让可能是你维持关系的方式。"], ["user", "但上周我其实坚持了自己的决定，而且关系也没坏。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["synthesize", "ask"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["reask_answered_content"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D16", partition, kind: "single_turn", source,
    title: "具体限制改变建议", workingTask: "支持用户选择学习计划",
    messages: [["user", "我想每天学两小时。"], ["assistant", "需要看看现实时间。"], ["user", "我下班后还要照顾孩子，真正稳定的只有早上四十分钟。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["synthesize", "ask"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["question_without_understanding_gain"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D17", partition, kind: "single_turn", source,
    title: "新增背景不等于认识增量", workingTask: "理解用户为何不愿接受调岗",
    messages: [["user", "我不愿调岗，因为新岗位会让我失去现在的专业积累。"], ["assistant", "你担心积累被中断。"], ["user", "新办公室在十二楼，装修也挺新。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["acknowledge", "synthesize"], expectedValueClassification: "working_task_drift", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["drift_from_working_task"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D18", partition, kind: "single_turn", source,
    title: "用户主动打开有价值新方向", workingTask: "理解一次成功后仍然不安的原因",
    messages: [["user", "项目过了，我却没有开心。"], ["assistant", "结果和感受之间有落差。"], ["user", "我刚意识到，我一直怕下一次做不到同样好。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["ask", "synthesize"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["reask_answered_content"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D19", partition, kind: "single_turn", source,
    title: "不把情绪强度当作唯一焦点", workingTask: "理解合同条款对用户选择的影响",
    messages: [["user", "看到违约条款我特别生气，但我现在要决定是否签这份合同。"], ["assistant", "决定仍取决于条款的实际影响。"], ["user", "对，我想先看最坏会损失什么。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["ask", "synthesize"], expectedValueClassification: "advances_working_task", forbiddenBehaviors: ["drift_from_working_task"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D20", partition, kind: "single_turn", source,
    title: "一个连贯回答覆盖多个问号", workingTask: "确认对话在哪个节点开始变僵",
    messages: [["user", "我们一开始聊得还好，后来突然就僵了。"], ["assistant", "需要定位那个转折点。"], ["user", "我记得大概是他提到钱以后。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["ask"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["multiple_independent_answer_targets"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D21", partition, kind: "single_turn", source,
    title: "阶段三继续需要价值增量", workingTask: "理解完美要求怎样阻碍提交",
    messages: [["user", "我怕交出去还有瑕疵。"], ["assistant", "你把可接受标准定得很高。"], ["user", "我已经知道自己需要先交一个可用版本，也定好了今晚八点提交。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["synthesize", "acknowledge"], expectedValueClassification: "low_information_gain", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["question_without_understanding_gain"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D22", partition, kind: "single_turn", source,
    title: "用户改变焦点后保留可返还任务", workingTask: "先理解当下的失眠担忧",
    messages: [["user", "我原本想聊换工作，但今晚失眠让我更着急。"], ["assistant", "可以先把当下最急的部分说清。"], ["user", "先聊失眠，换工作之后再回来。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["acknowledge", "ask"], expectedValueClassification: "advances_working_task", forbiddenBehaviors: ["drift_from_working_task"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D23", partition, kind: "single_turn", source,
    title: "拒绝人格标签", workingTask: "理解临时回避一次对话的条件",
    messages: [["user", "我今天没回消息，因为看到那句话就很累。"], ["assistant", "这次回避发生在具体疲惫状态里。"], ["user", "别说我是回避型人格，我只是今天不想处理。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["acknowledge", "synthesize", "ask"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["hidden_reasoning_visible"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D24", partition, kind: "single_turn", source,
    title: "可见回应只使用当前记录", workingTask: "理解今天拒绝请求后的复杂感受",
    messages: [["user", "今天我第一次拒绝了额外任务，轻松又有点担心。"], ["assistant", "两种感受同时存在。"], ["user", "先从担心会不会影响同事关系聊。"]],
    checkpoints: [{ userOrdinal: 1, allowedActions: ["ask", "synthesize"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["hidden_reasoning_visible", "unsupported_third_party_motive"] }]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D25", partition, kind: "trajectory", source,
    title: "从沟通负担到已回答内容的完整轨迹", workingTask: "理解沟通为何让用户持续疲惫",
    messages: [["user", "每次解释都要说很多遍，我很累。"], ["assistant", "最费力的是组织语言还是确认对方理解？"], ["user", "确认对方理解，因为他经常只回一句知道了。"], ["assistant", "你很难从这句话确认他是否真的明白。"], ["user", "对，昨天他后来做错了，说明当时确实没听懂。"]],
    checkpoints: [
      { userOrdinal: 1, allowedActions: ["ask", "synthesize"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["multiple_independent_answer_targets"] },
      { userOrdinal: 2, allowedActions: ["synthesize", "ask"], expectedValueClassification: "reasks_answered_content", evidenceUserOrdinals: [0, 1, 2], forbiddenBehaviors: ["reask_answered_content"] }
    ]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D26", partition, kind: "trajectory", source,
    title: "纠正共同任务并保留有效背景", workingTask: "从工作疲惫转向离职后悔风险",
    messages: [["user", "最近加班让我很累。"], ["assistant", "你想找出怎么减少疲惫。"], ["user", "我更想聊离职后会不会后悔，累只是背景。"], ["assistant", "那就把后悔风险作为当前焦点。"], ["user", "我最怕的是离开后失去现在能独立负责项目的机会。"]],
    checkpoints: [
      { userOrdinal: 1, allowedActions: ["acknowledge", "ask"], expectedValueClassification: "advances_working_task", forbiddenBehaviors: ["drift_from_working_task"] },
      { userOrdinal: 2, allowedActions: ["ask", "synthesize"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [1, 2], forbiddenBehaviors: ["drift_from_working_task", "reask_answered_content"] }
    ]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D27", partition, kind: "trajectory", source,
    title: "第三方动机始终保持证据边界", workingTask: "理解父亲的回应为何让用户失落",
    messages: [["user", "我说拿到 offer，他只问工资多少。"], ["assistant", "你期待的回应可能没有出现。"], ["user", "我希望他先替我高兴，但不知道他当时为什么只问工资。"], ["assistant", "目前可以先区分你观察到的回应和对原因的猜测。"], ["user", "后来他告诉亲戚时说我很努力，这让我更困惑。"]],
    checkpoints: [
      { userOrdinal: 1, allowedActions: ["ask", "synthesize"], expectedValueClassification: "unsupported_third_party_inference", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["unsupported_third_party_motive"] },
      { userOrdinal: 2, allowedActions: ["ask", "synthesize"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1, 2], forbiddenBehaviors: ["unsupported_third_party_motive"] }
    ]
  }),
  defineGi088V8r3Case({
    id: "GI088-V8R3-D28", partition, kind: "trajectory", source,
    title: "一次表达支持后自然收束", workingTask: "理解拒绝邀约后的轻松感",
    messages: [["user", "拒绝周末邀约后我松了一口气。"], ["assistant", "那一刻最先放松的是什么？"], ["user", "肩膀先松了，因为不用再配合别人的时间。"], ["assistant", "轻松感似乎和拿回安排权有关。"], ["user", "对，我觉得这已经解释清楚了。"]],
    checkpoints: [
      { userOrdinal: 1, allowedActions: ["ask"], expectedValueClassification: "advances_working_task", evidenceUserOrdinals: [0, 1], forbiddenBehaviors: ["multiple_independent_answer_targets"] },
      { userOrdinal: 2, allowedActions: ["synthesize", "acknowledge"], expectedValueClassification: "low_information_gain", evidenceUserOrdinals: [0, 1, 2], forbiddenBehaviors: ["question_without_understanding_gain", "reask_answered_content"] }
    ]
  })
] as const;
