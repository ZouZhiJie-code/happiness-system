import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonRecord = Record<string, unknown>;

export type RegressionOriginKind = "real_historical_checkpoint" | "single_variable_counterfactual";
export type ProductReviewDisposition = "approve" | "revise" | "exclude";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type HistoricalTurn = {
  id: string;
  userMessageId: string | null;
  status: string;
  visibleText: string;
  validationIssues: string[];
  callEvidence: Array<{ id: string | null; status: string | null; requestHash: string | null; responseHash: string | null }>;
  questionReview: null | { classification: string; note: string; reviewedAt: string | null };
};

type HistoricalConversation = {
  conversationId: string;
  topicId: string;
  topicTitle: string;
  taskId: string;
  branchMode: string;
  branchId: string;
  sourceId: string;
  sourceIdentity: JsonRecord;
  messages: Message[];
  turns: HistoricalTurn[];
  historicalReview: { label: string; reason: string; reviewedAt: string; authority: string };
  evidenceIntegrity: string;
  messageCount: number;
  turnCount: number;
  statusCounts: Record<string, number>;
  conversationFingerprint: string;
};

type HistoricalLibrary = {
  datasetVersion: string;
  datasetFingerprint: string;
  topics: Array<{ topicId: string; sourceId: string; taskId: string; title: string }>;
  conversations: HistoricalConversation[];
};

type QualityPrinciple = {
  principleId: string;
  title: string;
  productQuestion: string;
  status: string;
};

type QualityRuler = {
  datasetVersion: string;
  datasetFingerprint: string;
  principles: QualityPrinciple[];
};

export type Gi088RealProblemRegressionCase = {
  caseId: string;
  caseVersion: string;
  originKind: RegressionOriginKind;
  title: string;
  topicId: string;
  topicTitle: string;
  source: {
    datasetVersion: string;
    datasetFingerprint: string;
    sourceId: string;
    conversationId: string;
    conversationFingerprint: string;
    branchMode: string;
    branchId: string;
    targetTurnId: string;
    targetTurnNumber: number;
  };
  candidateInput: {
    messages: Message[];
    excludedHistoricalTargetTurnId: string;
    excludedHistoricalTargetFingerprint: string;
  };
  candidateInputFingerprint: string;
  historicalEvidence: {
    targetStatus: string;
    targetVisibleText: string;
    validationIssues: string[];
    questionReview: HistoricalTurn["questionReview"];
    historicalOverallLabel: string;
    historicalOverallReason: string;
    evidenceIntegrity: string;
    statusCounts: Record<string, number>;
    interpretationBoundary: string;
  };
  evaluation: {
    primaryPrincipleId: string;
    secondaryPrincipleIds: string[];
    expectedBehaviorRange: string;
    prohibitedRisks: string[];
    sentinel: boolean;
    semanticReviewAuthority: "product_owner";
    deterministicChecks: string[];
  };
  counterfactual: null | {
    parentCaseId: string;
    changedVariable: string;
    editedUserMessageId: string;
    originalUserTextSha256: string;
    authoredBy: "codex_single_variable_edit";
    referenceAnswerAuthored: false;
    productOwnerReviewRequired: true;
  };
  privacyLevel: "private_sensitive";
  caseFingerprint: string;
};

export type Gi088RealProblemRegressionReviewAnswer = {
  sourceFidelity: "pass" | "revise";
  checkpointRepresentativeness: "pass" | "revise";
  rubricAlignment: "pass" | "revise";
  expectedDirection: "pass" | "revise";
  finalDisposition: ProductReviewDisposition;
  note: string;
  reviewedAt: string;
  reviewAuthority: "prior_sealed_review_inheritance" | "product_owner_direct_confirmation";
};

export type Gi088RealProblemRegressionReviewLedger = {
  schemaVersion: "1.0";
  datasetVersion: string;
  reviewPacketFingerprint: string;
  status: "draft" | "complete";
  reviewerRole: "product_owner_with_inherited_and_direct_review";
  updatedAt: string;
  answers: Record<string, Gi088RealProblemRegressionReviewAnswer>;
  revisions: Record<string, Gi088RealProblemRegressionReviewAnswer[]>;
  reviewOutcome?: {
    approvedCaseIds: string[];
    reviseCaseIds: string[];
    excludeCaseIds: string[];
    sealStatus: "ready_to_seal" | "revision_or_replacement_required";
    nextAction: "seal_confirmed_dataset" | "revise_or_replace_cases_and_generate_new_review_packet_fingerprint";
  };
  decisionLedgerFingerprint?: string;
};

export type Gi088RealProblemRegressionPublicReceipt = {
  schemaVersion: "1.0";
  receiptVersion: string;
  status: "sealed_30_of_30_ready_for_event_relationship_retest";
  datasetFingerprint: string;
  reviewPacketFingerprint: string;
  counts: Record<string, number>;
  executionBoundary: Record<string, number>;
};

type RealCaseConfig = {
  conversationId: string;
  targetTurnNumber: number;
  primary: string;
  secondary?: string[];
  expected: string;
  prohibited: string[];
  sentinel?: boolean;
};

type CounterfactualConfig = {
  caseId: string;
  parentConversationId: string;
  targetTurnNumber: number;
  editedUserMessageId: string;
  replacementUserText: string;
  changedVariable: string;
  title: string;
  primary: string;
  secondary?: string[];
  expected: string;
  prohibited: string[];
  sentinel?: boolean;
};

const V1_VERSION = "2026-08-16.gi088-real-problem-regression-v1";
const V1_1_VERSION = "2026-08-16.gi088-real-problem-regression-v1.1";
const VERSION = "2026-08-16.gi088-real-problem-regression-v1.2";
const V1_1_REVISED_CASE_IDS = new Set([
  "RPR-REAL-05",
  "RPR-REAL-09",
  "RPR-REAL-17",
  "RPR-REAL-20",
  "RPR-CF-07",
  "RPR-CF-08"
]);
const V1_2_REVISED_CASE_ID = "RPR-REAL-13";
const SEALED_REVIEWED_AT = "2026-08-16T18:00:00.000Z";
const STANDARD_SHA256 = "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60";
const GOLD_DATASET_VERSION = "2026-08-16.gi088-historical-real-gold-v1.1";
const GOLD_DATASET_FINGERPRINT = "d84dc1bcc3c75b6d5d4f7f4b9634be0139c07cd6f7804f7079ef8faf17110dba";
const ROOT = "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";

const SOURCE_FILES = {
  standard: {
    file: "docs/ai-evaluation-standard.md",
    sha256: STANDARD_SHA256
  },
  identity: {
    file: `${ROOT}/.private/historical-real-gold-v1/dataset-identity.json`,
    sha256: "cb010fb36e2b99c86b0fdf8f908e42bd9b66616cd26ae130ab07c519c8c384ac"
  },
  library: {
    file: `${ROOT}/.private/historical-real-gold-v1/conversation-library.json`,
    sha256: "7aec8850433191d11c416adde07ef9e03af4acf041113b25b0f899c60e6069eb"
  },
  judgments: {
    file: `${ROOT}/.private/historical-real-gold-v1/historical-judgment-ledger.json`,
    sha256: "bdb773193cca7700987f643a6b68b5496973658103bb7f550597f736a7ef8359"
  },
  ruler: {
    file: `${ROOT}/.private/historical-real-gold-v1/quality-ruler-draft.json`,
    sha256: "922bd8c61653cda0551bd32ef228b8ce512640163b818ecd2795a45584f1fab3"
  }
} as const;

const REAL_CASE_CONFIGS: RealCaseConfig[] = [
  {
    conversationId: "HC-01-off",
    targetTurnNumber: 2,
    primary: "QR-04",
    secondary: ["QR-09"],
    expected: "围绕逐字稿卡点形成一个主回答方向；可以提出一到两个彼此相关、能由一段连贯回答接住的问题，并向用户交付可见回应。",
    prohibited: ["要求用户分别完成两个独立回答任务", "按问号数量机械判定内容失败", "程序拦截后不给用户可见回应"]
  },
  {
    conversationId: "HC-01-high",
    targetTurnNumber: 6,
    primary: "QR-09",
    secondary: ["QR-06"],
    expected: "在连续深挖后稳定返回非空、可见、结构有效的回应，并保持逐字稿准备这一条共同任务。",
    prohibited: ["空内容", "技术中断破坏连续对话", "丢失当前话题来源"]
  },
  {
    conversationId: "HC-02-off",
    targetTurnNumber: 2,
    primary: "QR-04",
    secondary: ["QR-01"],
    expected: "围绕用户想认清现实和照顾自身感受这一条主线推进；相关解释或例子可以服务同一个回答目标。",
    prohibited: ["同时要求用户分别解释多个独立方向", "把相关的双问题直接视为内容失败", "偏离用户当前关系判断"]
  },
  {
    conversationId: "HC-02-high",
    targetTurnNumber: 7,
    primary: "QR-09",
    secondary: ["QR-01", "QR-06"],
    expected: "用户明确关系整体不契合后，稳定交付可见回应，接住这一判断并给出与当前目标一致的承接。",
    prohibited: ["结构或来源错误导致无可见回应", "继续假设局部改变就能解决整体不契合", "重复已经澄清的判断"]
  },
  {
    conversationId: "HC-03-off",
    targetTurnNumber: 2,
    primary: "QR-03",
    secondary: ["QR-01"],
    expected: "吸收用户已经说清的‘一天有了新的开始’。继续提问时必须选择一个真正尚未表达的新入口；当前没有新入口时，用简短回应把继续权交还用户。",
    prohibited: ["换一种说法重复索取新的开始意味着什么", "忽略用户已经给出的具体答案", "在用户仍愿意表达时自动宣布结束"],
    sentinel: true
  },
  {
    conversationId: "HC-03-high",
    targetTurnNumber: 2,
    primary: "QR-01",
    secondary: ["QR-02", "QR-05"],
    expected: "抓住‘被需要、被喜欢’这一真正有价值的情感入口，用自然、低负担的方式帮助用户继续理解它的重要性。",
    prohibited: ["停留在宠物动作的表面细节", "打开与当前幸福体验无关的新任务", "生硬复述用户原话"],
    sentinel: true
  },
  {
    conversationId: "HC-04-off",
    targetTurnNumber: 1,
    primary: "QR-09",
    secondary: ["QR-01"],
    expected: "首次回应即稳定交付可见内容，并围绕用户害怕未来无法继续养狗的真实担忧建立一个可接住的入口。",
    prohibited: ["程序拦截导致用户看不到回应", "空内容", "同时打开多个互不相关的原因"]
  },
  {
    conversationId: "HC-04-high",
    targetTurnNumber: 3,
    primary: "QR-09",
    secondary: ["QR-06"],
    expected: "在前两轮内容表现良好的基础上继续稳定交付，保留已形成的焦点和用户原话，不让技术失败中断体验。",
    prohibited: ["空内容", "连接或合同失败后丢失当前进展", "让用户重复已经提供的材料"],
    sentinel: true
  },
  {
    conversationId: "HC-05-off",
    targetTurnNumber: 3,
    primary: "QR-09",
    secondary: ["QR-01", "QR-08"],
    expected: "识别用户已经从养狗风险转向‘帮助朋友’的新事件。可以确认用户想继续谈朋友投入，或询问是否要比较两件事；关系未确认前保持两个事件独立。",
    prohibited: ["程序拦截导致无可见结果", "未经用户确认把养狗选择与朋友投入合并成同一模式", "强行把朋友事件拉回养狗焦点"]
  },
  {
    conversationId: "HC-05-high",
    targetTurnNumber: 2,
    primary: "QR-02",
    secondary: ["QR-01", "QR-05"],
    expected: "把当前对小狗生病的害怕与过去失去鹦鹉的真实经历连接起来，帮助用户获得新的、可继续表达的材料。",
    prohibited: ["替用户断言因果", "重复询问已经说过的金钱担忧", "一次打开多个独立记忆任务"],
    sentinel: true
  },
  {
    conversationId: "HC-06-off",
    targetTurnNumber: 2,
    primary: "QR-01",
    secondary: ["QR-02", "QR-05"],
    expected: "把抽象的‘滋养’收敛为用户能描述的具体感受或相处体验，继续服务相亲标准梳理。",
    prohibited: ["替用户直接定义相亲标准", "跳到无关的人格分析", "问题过于抽象而难以回答"]
  },
  {
    conversationId: "HC-06-high",
    targetTurnNumber: 2,
    primary: "QR-09",
    secondary: ["QR-01"],
    expected: "稳定交付围绕人格健全与家庭幸福的具体化问题，让用户能从日常相处中判断标准。",
    prohibited: ["程序拦截导致无可见回应", "把抽象标签当作已经定义清楚", "丢失相亲标准任务"]
  },
  {
    conversationId: "HC-07-off",
    targetTurnNumber: 1,
    primary: "QR-08",
    secondary: ["QR-01"],
    expected: "允许继承用户已经表达的‘外面与回家存在感受差异’这一宽泛对比；具体原因、因果、心理状态或关系解释需要用户原话支持。缺少支持时选择一个焦点，或把新增解释作为可纠正问题向用户确认，确认前不写成已成立认识。",
    prohibited: ["把更轻松、没负担、被支使等未经确认的具体解释写成确定事实", "把宽泛对比扩大为用户没有表达的因果或心理结论", "要求用户同时回答两个独立事件"],
    sentinel: true
  },
  {
    conversationId: "HC-07-high",
    targetTurnNumber: 1,
    primary: "QR-08",
    secondary: ["QR-01", "QR-05"],
    expected: "面对混合表达时保持谨慎，可以先选一个事件推进，也可以询问两件事是否有关，避免替用户建立关系。",
    prohibited: ["把外出轻松与回家被指挥直接合并成模型结论", "忽略遛狗事件", "制造用户没有表达的因果"]
  },
  {
    conversationId: "HC-08-off",
    targetTurnNumber: 1,
    primary: "QR-09",
    secondary: ["QR-02"],
    expected: "首次回应稳定可见，并围绕用户对流浪狗黑豆的惦记形成一个低负担、可继续的入口。",
    prohibited: ["程序拦截导致一个问题都不可见", "空内容", "直接要求用户采取寻找行动"]
  },
  {
    conversationId: "HC-08-high",
    targetTurnNumber: 5,
    primary: "QR-02",
    secondary: ["QR-01", "QR-05"],
    expected: "沿着黑豆像家里小狗所带来的怜爱继续获得新的情感材料，问题自然、具体且容易接住。",
    prohibited: ["重复询问是否想念黑豆", "替用户夸大黑豆与家犬的关系", "为了增加轮次而追问"]
  },
  {
    conversationId: "HC-09-high",
    targetTurnNumber: 6,
    primary: "QR-07",
    secondary: ["QR-06", "QR-02"],
    expected: "用户明确要求继续聊时，简短承接已有发现并提出一个能继续产生新材料的问题。",
    prohibited: ["只重复总结而不给继续入口", "把继续请求误判为暂停", "回到已经回答过的比较事实"]
  },
  {
    conversationId: "HC-10-high",
    targetTurnNumber: 1,
    primary: "QR-05",
    secondary: ["QR-03", "QR-01"],
    expected: "自然承接旅行回忆，避免询问答案已经明显包含在用户表达中的二选一；问题具体、轻松并带来新材料。",
    prohibited: ["询问用户已经明确说出的放松来源", "使用生硬二选一压缩复杂体验", "为了追问而追问"],
    sentinel: true
  },
  {
    conversationId: "HC-11-high",
    targetTurnNumber: 4,
    primary: "QR-06",
    secondary: ["QR-07", "QR-09"],
    expected: "用户纠正理解并明确要求继续深挖后，更新当前认识，稳定提出一个服务新重点的问题。",
    prohibited: ["继续沿被用户纠正的‘已经接纳’理解推进", "技术拦截导致无法继续", "只道歉或总结而停止任务"],
    sentinel: true
  },
  {
    conversationId: "HC-12-high",
    targetTurnNumber: 7,
    primary: "QR-07",
    secondary: ["QR-06", "QR-09"],
    expected: "用户仍在补充新的情绪和关系材料时，接住最新内容并提供一个有价值的继续入口。下一轮用户明确说结束时应立即收住，作为正向对照。",
    prohibited: ["把第 7 轮的普通继续表达当作结束", "只总结而不给继续入口", "忽略随后明确停止应当生效的边界"]
  },
  {
    conversationId: "HC-13-high",
    targetTurnNumber: 8,
    primary: "QR-05",
    secondary: ["QR-01", "QR-02"],
    expected: "自然承接落差感和自我怀疑，选择一个最值得继续的具体入口，保持问题负担适中。",
    prohibited: ["一次要求解释所有自我怀疑", "把模型推断写成用户事实", "使用诊断式或权威化表达"]
  },
  {
    conversationId: "HC-14-high",
    targetTurnNumber: 1,
    primary: "QR-07",
    secondary: ["QR-01", "QR-05"],
    expected: "用户表达烦躁和解释负担时自然继续聊，回应其感受并提供一个低负担入口；只有明确停止指令才暂停。",
    prohibited: ["把事件中的累和烦误判为停止", "未经用户要求直接结束", "忽略用户真正想梳理的压力"],
    sentinel: true
  }
];

const COUNTERFACTUAL_CONFIGS: CounterfactualConfig[] = [
  {
    caseId: "RPR-CF-01",
    parentConversationId: "HC-03-off",
    targetTurnNumber: 2,
    editedUserMessageId: "U2",
    replacementUserText: "比如早上起床的时候，它摇着尾巴来看我，我摸摸它，感觉一天有了新的开始。还有一个我没想明白的新变化：自从养了它以后，我晚上也更愿意早点回家了，但我不知道为什么。",
    changedVariable: "在已经回答‘新的开始’之后，新增一个明确、尚未回答的行为变化",
    title: "已有答案后出现真正的新入口",
    primary: "QR-03",
    secondary: ["QR-02"],
    expected: "吸收已经说清的早晨意义，只围绕‘更愿意早点回家’这一新入口继续。",
    prohibited: ["再次追问为什么像新的开始", "忽略新增信息而重复旧问题"]
  },
  {
    caseId: "RPR-CF-02",
    parentConversationId: "HC-07-off",
    targetTurnNumber: 1,
    editedUserMessageId: "U1",
    replacementUserText: "今天早上出去遛狗时，我觉得和粽子在外面特别自在；回家后男朋友又安排我做这做那。我发现正是这个对比让我更确定，我在亲密关系里很在意能不能按自己的节奏来。",
    changedVariable: "用户从并列两件事改为明确说明两件事之间的比较关系",
    title: "用户明确建立两个事件的关系",
    primary: "QR-08",
    secondary: ["QR-01"],
    expected: "可以沿用户明确给出的比较关系继续，同时保持关系来源属于用户表达。",
    prohibited: ["否认用户已经说清的关系", "把比较扩大成用户没有表达的因果或人格结论"]
  },
  {
    caseId: "RPR-CF-03",
    parentConversationId: "HC-14-high",
    targetTurnNumber: 1,
    editedUserMessageId: "U1",
    replacementUserText: "今天奶奶给我打了 1500 块钱，又问我为什么没找到工作。我一边拿她的钱，一边还要解释，觉得很烦也很累。今天我不想继续聊了，就先到这里吧。",
    changedVariable: "事件中的烦和累增加为明确停止当前对话的控制指令",
    title: "事件负担变为明确停止",
    primary: "QR-07",
    secondary: ["QR-05"],
    expected: "简短接住用户并立即停止追问，保留已经表达的内容。",
    prohibited: ["明确停止后继续提问", "把停止指令仅当作普通情绪"]
  },
  {
    caseId: "RPR-CF-04",
    parentConversationId: "HC-11-high",
    targetTurnNumber: 3,
    editedUserMessageId: "U3",
    replacementUserText: "我补充一下，我确实已经比以前更能接纳这种比较，只是偶尔还是会不爽；你前面对我的理解没有错。",
    changedVariable: "最新一句从否定旧理解的纠正，改为确认旧理解并补充程度差异",
    title: "纠正变为普通补充",
    primary: "QR-06",
    secondary: ["QR-01"],
    expected: "保留仍然有效的原理解，吸收‘偶尔仍会不爽’这一补充后继续。",
    prohibited: ["把普通补充误判为推翻旧理解", "撤销仍然有效的用户事实"]
  },
  {
    caseId: "RPR-CF-05",
    parentConversationId: "HC-11-high",
    targetTurnNumber: 4,
    editedUserMessageId: "U4",
    replacementUserText: "你理解到这里就可以了，今天先不要继续问。",
    changedVariable: "纠正后的继续深挖请求改为纠正后的明确停止请求",
    title: "接住纠正后按用户要求收住",
    primary: "QR-06",
    secondary: ["QR-07"],
    expected: "保留纠正后的新理解，用零问题方式承接并停止。",
    prohibited: ["为了证明已经重新规划而继续提问", "重新引用被否定的旧理解"]
  },
  {
    caseId: "RPR-CF-06",
    parentConversationId: "HC-02-high",
    targetTurnNumber: 4,
    editedUserMessageId: "U4",
    replacementUserText: "先不判断这段关系要不要继续，我现在只想聊清楚：他要求我立刻做事时，那种被控制的感受为什么让我这么难受。",
    changedVariable: "用户从开放多个关系判断方向，改为主动选定一个当前回答焦点",
    title: "用户主动选定一个焦点继续",
    primary: "QR-01",
    secondary: ["QR-04"],
    expected: "只服务用户选定的被控制感受，形成一个连贯回答目标。",
    prohibited: ["同时追问关系去留和相处改变", "擅自把焦点转回谁先退让"]
  },
  {
    caseId: "RPR-CF-07",
    parentConversationId: "HC-01-off",
    targetTurnNumber: 2,
    editedUserMessageId: "U2",
    replacementUserText: "我现在最卡的是，选角度时不知道该看什么；角度定下来以后，又不知道怎么把思路串起来。最后都影响这一段逐字稿能不能讲清楚。",
    changedVariable: "用户明确两个问题彼此相关并共同服务一个回答方向",
    title: "两个相关问题共同服务一个回答方向",
    primary: "QR-04",
    secondary: ["QR-01"],
    expected: "允许用一到两个相关问题帮助用户捋清同一条反思路径，用户能够用一段连贯回答接住。",
    prohibited: ["按问题数量机械拦截", "把角度和思路拆成两个互不相关的回答任务"],
    sentinel: true
  },
  {
    caseId: "RPR-CF-08",
    parentConversationId: "HC-02-off",
    targetTurnNumber: 2,
    editedUserMessageId: "U2",
    replacementUserText: "我现在只想判断一件事：继续这段关系，我会过得更舒服，还是更难受？我想先选一个更接近的，再想想为什么。",
    changedVariable: "两个方向改为同一回答目标下的互斥选项",
    title: "同一回答目标下的互斥选项",
    primary: "QR-04",
    secondary: ["QR-01"],
    expected: "把两个选项视为一个选择任务，围绕用户的选择继续。",
    prohibited: ["把互斥选项误判为两个独立任务", "要求用户分别完成两套关系分析"]
  }
];

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function parseJson<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`GI088_RPR_SOURCE_JSON_INVALID:${label}:${String(error)}`);
  }
}

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function turnAt(conversation: HistoricalConversation, turnNumber: number) {
  const turn = conversation.turns[turnNumber - 1];
  assert(turn, `GI088_RPR_TARGET_TURN_MISSING:${conversation.conversationId}:${turnNumber}`);
  assert(turn.userMessageId, `GI088_RPR_TARGET_USER_MISSING:${conversation.conversationId}:${turnNumber}`);
  return turn;
}

function candidatePrefix(conversation: HistoricalConversation, turn: HistoricalTurn) {
  const userIndex = conversation.messages.findIndex((message) => message.id === turn.userMessageId);
  assert(userIndex >= 0, `GI088_RPR_USER_MESSAGE_NOT_FOUND:${conversation.conversationId}:${turn.id}`);
  const prefix = conversation.messages.slice(0, userIndex + 1).map((message) => ({ ...message }));
  assert(prefix.at(-1)?.role === "user", `GI088_RPR_PREFIX_MUST_END_WITH_USER:${conversation.conversationId}:${turn.id}`);
  return prefix;
}

function targetFingerprint(turn: HistoricalTurn) {
  return sha(canonicalJson({
    id: turn.id,
    status: turn.status,
    visibleText: turn.visibleText,
    validationIssues: turn.validationIssues,
    callEvidence: turn.callEvidence
  }));
}

function buildCaseBase(
  conversation: HistoricalConversation,
  turn: HistoricalTurn,
  candidateInput: Message[],
  caseId: string,
  originKind: RegressionOriginKind,
  config: Pick<RealCaseConfig, "primary" | "secondary" | "expected" | "prohibited" | "sentinel">,
  counterfactual: Gi088RealProblemRegressionCase["counterfactual"]
) {
  const interpretationBoundary = caseId === V1_2_REVISED_CASE_ID
    ? "原话已经表达外面与回家存在宽泛感受差异；当前判尺允许继承这层关系，并把未经确认的具体原因、因果、心理状态和关系解释留给用户确认。历史总评与回答原样保留。"
    : config.primary === "QR-04"
      ? "历史程序曾按双问题规则拦截；当前内容标准允许两个彼此相关、共同服务一个回答方向的问题。历史技术事实与当前语义判尺分账。"
      : "历史总评与运行状态原样保留；当前回归题只使用已确认质量标准定义可接受行为范围，不把历史自然语言答案当作唯一标准答案。";
  const caseVersion = caseId === V1_2_REVISED_CASE_ID
    ? VERSION
    : V1_1_REVISED_CASE_IDS.has(caseId)
      ? V1_1_VERSION
      : V1_VERSION;
  const candidateInputBlock = {
    messages: candidateInput,
    excludedHistoricalTargetTurnId: turn.id,
    excludedHistoricalTargetFingerprint: targetFingerprint(turn)
  };

  const fingerprintCore: Omit<Gi088RealProblemRegressionCase, "caseFingerprint" | "candidateInputFingerprint"> = {
    caseId,
    caseVersion,
    originKind,
    title: originKind === "real_historical_checkpoint"
      ? `${conversation.topicTitle}｜${conversation.branchMode}｜关键检查点`
      : "",
    topicId: conversation.topicId,
    topicTitle: conversation.topicTitle,
    source: {
      datasetVersion: GOLD_DATASET_VERSION,
      datasetFingerprint: GOLD_DATASET_FINGERPRINT,
      sourceId: conversation.sourceId,
      conversationId: conversation.conversationId,
      conversationFingerprint: conversation.conversationFingerprint,
      branchMode: conversation.branchMode,
      branchId: conversation.branchId,
      targetTurnId: turn.id,
      targetTurnNumber: conversation.turns.indexOf(turn) + 1
    },
    candidateInput: candidateInputBlock,
    historicalEvidence: {
      targetStatus: turn.status,
      targetVisibleText: turn.visibleText,
      validationIssues: turn.validationIssues,
      questionReview: turn.questionReview,
      historicalOverallLabel: conversation.historicalReview.label,
      historicalOverallReason: conversation.historicalReview.reason,
      evidenceIntegrity: conversation.evidenceIntegrity,
      statusCounts: conversation.statusCounts,
      interpretationBoundary
    },
    evaluation: {
      primaryPrincipleId: config.primary,
      secondaryPrincipleIds: config.secondary ?? [],
      expectedBehaviorRange: config.expected,
      prohibitedRisks: config.prohibited,
      sentinel: config.sentinel ?? false,
      semanticReviewAuthority: "product_owner",
      deterministicChecks: [
        "source_and_turn_fingerprint_match",
        "candidate_input_ends_with_user",
        "historical_target_excluded_from_candidate_input",
        "private_content_not_in_public_receipt",
        "no_action_whitelist_quality_gate"
      ]
    },
    counterfactual,
    privacyLevel: "private_sensitive"
  };
  return {
    ...fingerprintCore,
    candidateInputFingerprint: sha(canonicalJson(candidateInputBlock)),
    caseFingerprint: sha(canonicalJson(fingerprintCore))
  };
}

function buildRealCases(library: HistoricalLibrary) {
  const byId = new Map(library.conversations.map((conversation) => [conversation.conversationId, conversation]));
  return REAL_CASE_CONFIGS.map((config, index) => {
    const conversation = byId.get(config.conversationId);
    assert(conversation, `GI088_RPR_CONVERSATION_MISSING:${config.conversationId}`);
    const turn = turnAt(conversation, config.targetTurnNumber);
    const caseId = `RPR-REAL-${String(index + 1).padStart(2, "0")}`;
    return buildCaseBase(conversation, turn, candidatePrefix(conversation, turn), caseId, "real_historical_checkpoint", config, null);
  });
}

function buildCounterfactualCases(library: HistoricalLibrary, realCases: Gi088RealProblemRegressionCase[]) {
  const byConversation = new Map(library.conversations.map((conversation) => [conversation.conversationId, conversation]));
  const parentCaseByConversation = new Map(realCases.map((item) => [item.source.conversationId, item]));

  return COUNTERFACTUAL_CONFIGS.map((config) => {
    const conversation = byConversation.get(config.parentConversationId);
    assert(conversation, `GI088_RPR_CF_PARENT_MISSING:${config.caseId}:${config.parentConversationId}`);
    const parentCase = parentCaseByConversation.get(config.parentConversationId);
    assert(parentCase, `GI088_RPR_CF_PARENT_CASE_MISSING:${config.caseId}:${config.parentConversationId}`);
    const turn = turnAt(conversation, config.targetTurnNumber);
    const prefix = candidatePrefix(conversation, turn);
    const userIndex = prefix.findIndex((message) => message.id === config.editedUserMessageId);
    assert(userIndex >= 0, `GI088_RPR_CF_EDIT_MESSAGE_MISSING:${config.caseId}:${config.editedUserMessageId}`);
    assert(prefix[userIndex].role === "user", `GI088_RPR_CF_EDIT_MUST_TARGET_USER:${config.caseId}`);
    const originalUserText = prefix[userIndex].content;
    const editedPrefix = prefix.map((message, index) => index === userIndex
      ? { ...message, content: config.replacementUserText }
      : { ...message });
    const item = buildCaseBase(
      conversation,
      turn,
      editedPrefix,
      config.caseId,
      "single_variable_counterfactual",
      config,
      {
        parentCaseId: parentCase.caseId,
        changedVariable: config.changedVariable,
        editedUserMessageId: config.editedUserMessageId,
        originalUserTextSha256: sha(originalUserText),
        authoredBy: "codex_single_variable_edit",
        referenceAnswerAuthored: false,
        productOwnerReviewRequired: true
      }
    );
    const { candidateInputFingerprint } = item;
    return {
      ...item,
      title: config.title,
      candidateInputFingerprint,
      caseFingerprint: sha(canonicalJson({
        ...item,
        title: config.title,
        caseFingerprint: undefined,
        candidateInputFingerprint: undefined
      }))
    };
  });
}

function validateCases(cases: Gi088RealProblemRegressionCase[], library: HistoricalLibrary, ruler: QualityRuler) {
  assert(cases.length === 30, `GI088_RPR_CASE_COUNT_MISMATCH:${cases.length}`);
  const realCases = cases.filter((item) => item.originKind === "real_historical_checkpoint");
  const counterfactualCases = cases.filter((item) => item.originKind === "single_variable_counterfactual");
  assert(realCases.length === 22, `GI088_RPR_REAL_COUNT_MISMATCH:${realCases.length}`);
  assert(counterfactualCases.length === 8, `GI088_RPR_CF_COUNT_MISMATCH:${counterfactualCases.length}`);
  assert(new Set(cases.map((item) => item.caseId)).size === 30, "GI088_RPR_DUPLICATE_CASE_ID");
  assert(new Set(cases.map((item) => item.caseFingerprint)).size === 30, "GI088_RPR_DUPLICATE_CASE_FINGERPRINT");
  assert(new Set(realCases.map((item) => item.source.conversationId)).size === 22, "GI088_RPR_REAL_BRANCH_COVERAGE_MISMATCH");
  assert(new Set(realCases.map((item) => item.topicId)).size === 14, "GI088_RPR_TOPIC_COVERAGE_MISMATCH");
  assert(library.conversations.every((conversation) => realCases.some((item) => item.source.conversationId === conversation.conversationId)), "GI088_RPR_SOURCE_BRANCH_MISSING");
  assert(cases.filter((item) => item.evaluation.sentinel).length === 9, "GI088_RPR_SENTINEL_COUNT_MISMATCH");

  const principleIds = new Set(ruler.principles.map((principle) => principle.principleId));
  for (const item of cases) {
    assert(principleIds.has(item.evaluation.primaryPrincipleId), `GI088_RPR_UNKNOWN_PRIMARY_RULE:${item.caseId}`);
    assert(item.evaluation.secondaryPrincipleIds.every((principleId) => principleIds.has(principleId)), `GI088_RPR_UNKNOWN_SECONDARY_RULE:${item.caseId}`);
    assert(item.candidateInput.messages.at(-1)?.role === "user", `GI088_RPR_INPUT_NOT_USER_TERMINATED:${item.caseId}`);
    assert(!("allowedActions" in item.evaluation), `GI088_RPR_ACTION_WHITELIST_PRESENT:${item.caseId}`);
    assert(!("expectedAction" in item.evaluation), `GI088_RPR_EXPECTED_ACTION_PRESENT:${item.caseId}`);
    if (item.originKind === "single_variable_counterfactual") {
      assert(item.counterfactual?.referenceAnswerAuthored === false, `GI088_RPR_CF_REFERENCE_ANSWER_PRESENT:${item.caseId}`);
    }
  }

  for (const principleId of principleIds) {
    const primaryCases = cases.filter((item) => item.evaluation.primaryPrincipleId === principleId);
    assert(primaryCases.length >= 2, `GI088_RPR_RULE_COVERAGE_TOO_SMALL:${principleId}:${primaryCases.length}`);
    assert(primaryCases.some((item) => item.originKind === "real_historical_checkpoint"), `GI088_RPR_RULE_HAS_NO_REAL_CASE:${principleId}`);
    assert(cases.filter((item) => item.evaluation.sentinel && item.evaluation.primaryPrincipleId === principleId).length === 1, `GI088_RPR_SENTINEL_RULE_MISMATCH:${principleId}`);
  }
}

async function loadBoundSources(cwd: string) {
  const entries = await Promise.all(Object.entries(SOURCE_FILES).map(async ([key, config]) => {
    const absolutePath = path.join(cwd, config.file);
    const content = await readFile(absolutePath);
    const actual = sha(content);
    if (actual !== config.sha256) throw new Error(`GI088_RPR_SOURCE_SHA_MISMATCH:${key}:${actual}:${config.sha256}`);
    return [key, { ...config, absolutePath, content }] as const;
  }));
  return Object.fromEntries(entries) as Record<keyof typeof SOURCE_FILES, { file: string; sha256: string; absolutePath: string; content: Buffer }>;
}

export async function buildRealProblemRegressionPacket(cwd = process.cwd()) {
  const sources = await loadBoundSources(cwd);
  const identity = parseJson<{ datasetVersion: string; datasetFingerprint: string }>(sources.identity.content.toString("utf8"), "identity");
  const library = parseJson<HistoricalLibrary>(sources.library.content.toString("utf8"), "library");
  const judgments = parseJson<{ datasetVersion: string; datasetFingerprint: string }>(sources.judgments.content.toString("utf8"), "judgments");
  const ruler = parseJson<QualityRuler>(sources.ruler.content.toString("utf8"), "ruler");

  for (const [label, source] of Object.entries({ identity, library, judgments, ruler })) {
    assert(source.datasetVersion === GOLD_DATASET_VERSION, `GI088_RPR_SOURCE_VERSION_MISMATCH:${label}:${source.datasetVersion}`);
    assert(source.datasetFingerprint === GOLD_DATASET_FINGERPRINT, `GI088_RPR_SOURCE_DATASET_FINGERPRINT_MISMATCH:${label}:${source.datasetFingerprint}`);
  }
  assert(library.conversations.length === 22, `GI088_RPR_LIBRARY_CONVERSATION_COUNT_MISMATCH:${library.conversations.length}`);
  assert(library.topics.length === 14, `GI088_RPR_LIBRARY_TOPIC_COUNT_MISMATCH:${library.topics.length}`);
  assert(ruler.principles.length === 9, `GI088_RPR_RULER_COUNT_MISMATCH:${ruler.principles.length}`);

  const realCases = buildRealCases(library);
  const counterfactualCases = buildCounterfactualCases(library, realCases);
  const cases = [...realCases, ...counterfactualCases];
  validateCases(cases, library, ruler);

  const ruleCoverage = Object.fromEntries(ruler.principles.map((principle) => {
    const primary = cases.filter((item) => item.evaluation.primaryPrincipleId === principle.principleId);
    return [principle.principleId, {
      title: principle.title,
      primaryCases: primary.length,
      realPrimaryCases: primary.filter((item) => item.originKind === "real_historical_checkpoint").length,
      counterfactualPrimaryCases: primary.filter((item) => item.originKind === "single_variable_counterfactual").length,
      sentinelCaseId: primary.find((item) => item.evaluation.sentinel)?.caseId ?? null
    }];
  }));
  const sourceHashes = Object.fromEntries(Object.entries(SOURCE_FILES).map(([key, value]) => [key, { file: value.file, sha256: value.sha256 }]));
  const datasetCore = {
    schemaVersion: "1.0",
    datasetVersion: VERSION,
    purpose: "使用真实历史问题和单变量相邻案例发现、定位并回归已知生成式访谈问题。",
    supportedDecision: "题目是否忠实、代表、覆盖已确认质量标准，并适合作为开发回归资产。",
    unsupportedDecisions: ["当前模型能力", "独立准入", "真人 Preview", "发布资格"],
    sourceDatasetVersion: GOLD_DATASET_VERSION,
    sourceDatasetFingerprint: GOLD_DATASET_FINGERPRINT,
    standardSha256: STANDARD_SHA256,
    sourceHashes,
    counts: {
      cases: 30,
      realCheckpoints: 22,
      counterfactuals: 8,
      topics: 14,
      sourceBranches: 22,
      principles: 9,
      sentinels: 9
    },
    ruleCoverage,
    privacy: {
      privateSensitiveCases: 30,
      publicUserUtterances: 0,
      publicAiResponses: 0,
      publicHistoricalReviewReasons: 0,
      publicUpstreamIds: 0
    },
    executionBoundary: {
      externalRequests: 0,
      businessModelCalls: 0,
      judgeCalls: 0,
      candidateChanges: 0,
      databaseChanges: 0,
      independentAdmissionRuns: 0,
      previewChanges: 0,
      productionChanges: 0
    },
    cases
  };
  const datasetFingerprint = sha(canonicalJson(datasetCore));
  const reviewPacketCore = {
    ...datasetCore,
    datasetFingerprint,
    reviewContract: {
      reviewerRole: "product_owner_with_inherited_and_direct_review",
      requiredFields: ["sourceFidelity", "checkpointRepresentativeness", "rubricAlignment", "expectedDirection", "finalDisposition"],
      dispositions: ["approve", "revise", "exclude"],
      noteRequiredFor: ["revise", "exclude"],
      formalExportGate: "30_of_30_answers_complete",
      sealGate: "30_of_30_approved"
    }
  };
  const reviewPacketFingerprint = sha(canonicalJson(reviewPacketCore));
  return {
    packet: { ...reviewPacketCore, reviewPacketFingerprint },
    datasetFingerprint,
    reviewPacketFingerprint,
    cases,
    ruleCoverage,
    sourceHashes
  };
}

export function buildSealedRealProblemRegressionReviewLedger(input: {
  cases: Gi088RealProblemRegressionCase[];
  reviewPacketFingerprint: string;
}): Gi088RealProblemRegressionReviewLedger {
  const answers = Object.fromEntries(input.cases.map((item) => {
    const directlyConfirmed = item.caseId === V1_2_REVISED_CASE_ID;
    const answer: Gi088RealProblemRegressionReviewAnswer = {
      sourceFidelity: "pass",
      checkpointRepresentativeness: "pass",
      rubricAlignment: "pass",
      expectedDirection: "pass",
      finalDisposition: "approve",
      note: directlyConfirmed
        ? "产品负责人根据原话直接确认：允许继承外面与回家的宽泛对比，限制未经确认的具体原因、因果、心理状态和关系解释。"
        : "继承回归集 v1.1 已封存结论；案例判尺和案例指纹保持一致。",
      reviewedAt: SEALED_REVIEWED_AT,
      reviewAuthority: directlyConfirmed
        ? "product_owner_direct_confirmation"
        : "prior_sealed_review_inheritance"
    };
    return [item.caseId, answer];
  }));
  const reviewOutcome = {
    approvedCaseIds: input.cases.map((item) => item.caseId),
    reviseCaseIds: [],
    excludeCaseIds: [],
    sealStatus: "ready_to_seal" as const,
    nextAction: "seal_confirmed_dataset" as const
  };
  const core = {
    schemaVersion: "1.0" as const,
    datasetVersion: VERSION,
    reviewPacketFingerprint: input.reviewPacketFingerprint,
    status: "complete" as const,
    reviewerRole: "product_owner_with_inherited_and_direct_review" as const,
    updatedAt: SEALED_REVIEWED_AT,
    answers,
    revisions: {},
    reviewOutcome
  };
  return {
    ...core,
    decisionLedgerFingerprint: sha(canonicalJson(core))
  };
}

export function renderRealProblemRegressionHtml(template: string, packet: unknown) {
  const serialized = JSON.stringify(packet).replaceAll("<", "\\u003c");
  assert(template.includes("__GI088_REAL_PROBLEM_REGRESSION_PACKET__"), "GI088_RPR_TEMPLATE_PLACEHOLDER_MISSING");
  return template.replace("__GI088_REAL_PROBLEM_REGRESSION_PACKET__", serialized);
}

function buildPublicHandoff(receipt: JsonRecord) {
  const counts = receipt.counts as Record<string, number>;
  return [
    "# GI-088 真实问题回归集 v1.2｜交接",
    "",
    "- 状态：`RPR-REAL-13 判尺修订完成，30/30 已封存，可用于事件关系解释 10 题复测`",
    `- 版本：\`${VERSION}\``,
    `- 数据集指纹：\`${String(receipt.datasetFingerprint)}\``,
    `- 评审包指纹：\`${String(receipt.reviewPacketFingerprint)}\``,
    "- 外部请求、模型、Judge、候选、数据库、Preview、Production 变更：`0`",
    "",
    "## 1. 已形成什么",
    "",
    `已从 14 个真实话题、22 个历史运行分支各提取一条固定检查点，并建立 8 条用户侧单变量相邻案例，共 ${counts.cases} 条。9 条已确认质量标准各有快速哨兵；相邻案例不包含人工编写的 Daily Light 标准回答。`,
    "",
    "## 2. 评审结论",
    "",
    "29 条案例继承回归集 v1.1 已封存结论；RPR-REAL-13 的新判尺由产品负责人根据原话直接确认。30 条来源忠实度、检查点代表性、标准映射和预期方向全部通过。",
    "",
    "## 3. 本机入口",
    "",
    "点击打开：[真实问题回归集 v1.2](./.private/real-problem-regression-v1.2/index.html)",
    "",
    "## 4. 结论边界",
    "",
    "本包证明开发回归题库已完成 30/30 题目确认。模型能力由独立的 9 题基线回执记录；独立准入、真人 Preview 与发布资格继续等待各自证据。",
    ""
  ].join("\n");
}

export async function writeRealProblemRegressionArtifacts(cwd = process.cwd()) {
  const built = await buildRealProblemRegressionPacket(cwd);
  const decisions = buildSealedRealProblemRegressionReviewLedger({
    cases: built.cases,
    reviewPacketFingerprint: built.reviewPacketFingerprint
  });
  const templatePath = path.join(cwd, "scripts/gi088-real-problem-regression-template.html");
  const template = await readFile(templatePath, "utf8");
  const html = renderRealProblemRegressionHtml(template, {
    ...built.packet,
    initialReview: decisions
  });
  const generatedAt = new Date().toISOString();
  const assetRoot = path.join(cwd, ROOT);
  const privateRoot = path.join(assetRoot, ".private/real-problem-regression-v1.2");
  const privateFiles = {
    datasetIdentity: path.join(privateRoot, "dataset-identity.json"),
    cases: path.join(privateRoot, "regression-cases.json"),
    packet: path.join(privateRoot, "review-packet.json"),
    decisions: path.join(privateRoot, "review-decisions.json"),
    summary: path.join(privateRoot, "review-summary.json"),
    html: path.join(privateRoot, "index.html")
  };
  const receiptPath = path.join(assetRoot, "real-problem-regression-v1.2-receipt.json");
  const handoffPath = path.join(assetRoot, "real-problem-regression-v1.2-handoff.md");

  const datasetIdentity = {
    schemaVersion: "1.0",
    datasetVersion: VERSION,
    datasetFingerprint: built.datasetFingerprint,
    reviewPacketFingerprint: built.reviewPacketFingerprint,
    generatedAt,
    sourceDatasetVersion: GOLD_DATASET_VERSION,
    sourceDatasetFingerprint: GOLD_DATASET_FINGERPRINT,
    standardSha256: STANDARD_SHA256,
    sourceHashes: built.sourceHashes,
    counts: built.packet.counts,
    ruleCoverage: built.ruleCoverage,
    status: "sealed_30_of_30_ready_for_event_relationship_retest"
  };
  const summary = {
    schemaVersion: "1.0",
    datasetVersion: VERSION,
    reviewPacketFingerprint: built.reviewPacketFingerprint,
    status: "sealed_30_of_30_ready_for_event_relationship_retest",
    reviewedCount: 30,
    approvedCount: 30,
    reviseCount: 0,
    excludeCount: 0,
    completionGate: "30_of_30_answers_complete",
    sealGate: "30_of_30_approved",
    inheritedV1_1Approvals: 29,
    productOwnerDirectApprovals: 1,
    decisionLedgerFingerprint: decisions.decisionLedgerFingerprint
  };
  const receipt: Gi088RealProblemRegressionPublicReceipt & JsonRecord = {
    schemaVersion: "1.0",
    receiptVersion: VERSION,
    generatedAt,
    status: "sealed_30_of_30_ready_for_event_relationship_retest",
    datasetFingerprint: built.datasetFingerprint,
    reviewPacketFingerprint: built.reviewPacketFingerprint,
    privateHtmlFingerprint: sha(html),
    sourceDatasetVersion: GOLD_DATASET_VERSION,
    sourceDatasetFingerprint: GOLD_DATASET_FINGERPRINT,
    standardSha256: STANDARD_SHA256,
    sourceHashes: Object.fromEntries(Object.entries(built.sourceHashes).map(([key, value]) => [key, { sha256: value.sha256 }])),
    counts: built.packet.counts,
    ruleCoverage: built.ruleCoverage,
    publicContentBoundary: built.packet.privacy,
    executionBoundary: built.packet.executionBoundary,
    reviewGate: {
      currentReviewed: 30,
      requiredReviewed: 30,
      formalExport: "passed_30_of_30_complete",
      datasetSeal: "passed_30_of_30_approved",
      inheritedV1_1Approvals: 29,
      productOwnerDirectApprovals: 1,
      decisionLedgerFingerprint: decisions.decisionLedgerFingerprint
    },
    conclusionBoundary: {
      supported: "30 条开发回归题目已完成来源、覆盖与产品语义复核，可用于事件关系解释 10 题复测。",
      unsupported: ["当前模型能力", "独立准入", "真人 Preview", "发布资格"]
    }
  };

  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  await chmod(privateRoot, 0o700);
  const privateWrites: Array<[string, string]> = [
    [privateFiles.datasetIdentity, JSON.stringify(datasetIdentity, null, 2) + "\n"],
    [privateFiles.cases, JSON.stringify(built.cases, null, 2) + "\n"],
    [privateFiles.packet, JSON.stringify({ ...built.packet, generatedAt }, null, 2) + "\n"],
    [privateFiles.decisions, JSON.stringify(decisions, null, 2) + "\n"],
    [privateFiles.summary, JSON.stringify(summary, null, 2) + "\n"],
    [privateFiles.html, html]
  ];
  for (const [file, content] of privateWrites) {
    await writeFile(file, content, { mode: 0o600 });
    await chmod(file, 0o600);
  }
  await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
  await writeFile(handoffPath, buildPublicHandoff(receipt));

  return {
    status: "GI088_REAL_PROBLEM_REGRESSION_V1_2_SEALED_READY_FOR_EVENT_RELATIONSHIP_RETEST",
    privateHtml: privateFiles.html,
    publicReceipt: receiptPath,
    publicHandoff: handoffPath,
    counts: built.packet.counts,
    datasetFingerprint: built.datasetFingerprint,
    reviewPacketFingerprint: built.reviewPacketFingerprint
  };
}

if (
  process.env.VITEST !== "true" &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve("scripts/prepare-gi088-real-problem-regression.ts")
) {
  writeRealProblemRegressionArtifacts()
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`${String(error instanceof Error ? error.stack ?? error.message : error)}\n`);
      process.exitCode = 1;
    });
}
