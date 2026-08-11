import { randomUUID } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

import {
  getEventCenteredProductScope,
  getEventCenteredReleaseMode
} from "@/features/interview/event-centered-release";
import {
  getEventCenteredStrategyMode
} from "@/features/interview/event-centered/generative-release";
import {
  getEventCenteredInterviewWorkspace,
  respondEventCenteredInterview,
  startEventCenteredInterview
} from "@/server/services/interview/event-centered-interview.service";
import {
  confirmJournalEventEntry,
  editJournalEventEntry,
  generateJournalEventEntry,
  readJournalEventEntry
} from "@/server/services/interview/journal-event-entry.service";
import {
  getInterviewSession,
  respondToInterview,
  startInterview
} from "@/server/services/interview/interview.service";
import type {
  EventCenteredRespondRequest,
  EventCenteredWorkspaceSession
} from "@/types/event-centered-dialogue";
import type { JournalEventAngle } from "@/types/journal-event-angle-outcome";

// Preview 只允许使用本轮明确命名的隔离库；允许本机副本用于排除远程连接波动，
// 始终拒绝任何常规或 Production 数据库。
const BOARD8_PREVIEW_CANDIDATE = process.env.BOARD8_PREVIEW_CANDIDATE === "gi066"
  ? "gi066"
  : process.env.BOARD8_PREVIEW_CANDIDATE === "gi064"
  ? "gi064"
  : process.env.BOARD8_PREVIEW_CANDIDATE === "gi063"
  ? "gi063"
  : process.env.BOARD8_PREVIEW_CANDIDATE === "gi062"
  ? "gi062"
  : process.env.BOARD8_PREVIEW_CANDIDATE === "gi061"
  ? "gi061"
  : process.env.BOARD8_PREVIEW_CANDIDATE === "gi060"
  ? "gi060"
  : process.env.BOARD8_PREVIEW_CANDIDATE === "gi059"
    ? "gi059"
    : "gi058";
const IS_GI059 = BOARD8_PREVIEW_CANDIDATE === "gi059";
const IS_GI060 = BOARD8_PREVIEW_CANDIDATE === "gi060";
const IS_GI061 = BOARD8_PREVIEW_CANDIDATE === "gi061";
const IS_GI062 = BOARD8_PREVIEW_CANDIDATE === "gi062";
const IS_GI063 = BOARD8_PREVIEW_CANDIDATE === "gi063";
const IS_GI064 = BOARD8_PREVIEW_CANDIDATE === "gi064";
const IS_GI066 = BOARD8_PREVIEW_CANDIDATE === "gi066";
const USES_GI059_FLOW = IS_GI059 || IS_GI060 || IS_GI061 || IS_GI062 || IS_GI063 || IS_GI064;
const CANDIDATE_ERROR_PREFIX = IS_GI066 ? "GI066" : IS_GI064 ? "GI064" : IS_GI063 ? "GI063" : IS_GI062 ? "GI062" : IS_GI061 ? "GI061" : IS_GI060 ? "GI060" : IS_GI059 ? "GI059" : "GI058";
const PREVIEW_DATABASE_PREFIX = IS_GI066
  ? "happiness_board8_preview_20260804_gi066_fix_"
  : USES_GI059_FLOW
  ? "happiness_board8_preview_20260803_gi059_"
  : "happiness_board8_preview_20260803_gi058_";
const DEFAULT_OUTPUT_DIRECTORY = resolve(
  process.cwd(),
  "artifacts",
  "generative-interview-board8",
  IS_GI066
    ? "2026-08-04-gi066-fix-scripted-deepseek-official-preview"
    : IS_GI064
    ? "2026-08-04-gi064-scripted-deepseek-official-preview"
    : IS_GI063
    ? "2026-08-04-gi063-scripted-deepseek-official-preview"
    : IS_GI062
    ? "2026-08-04-gi062-scripted-deepseek-official-preview"
    : IS_GI061
    ? "2026-08-04-gi061-scripted-deepseek-official-preview"
    : IS_GI060
    ? "2026-08-04-gi060-scripted-deepseek-official-preview"
    : IS_GI059
    ? "2026-08-03-gi059-scripted-deepseek-official-preview"
    : "2026-08-03-gi058-deepseek-official-preview"
);
const FOUR_ANGLES: JournalEventAngle[] = ["feeling", "thought", "relationship", "action"];

type MaterialKind = "real" | "risk";

type PreviewCase = {
  id: string;
  label: string;
  material: MaterialKind;
  angle: JournalEventAngle;
  depth: "guided" | "deep";
  initialReply: string;
  replies: string[];
  replyRules?: Array<{
    id: string;
    keywords: string[];
    text: string;
    required?: boolean;
  }>;
  deepEntryReply?: string;
  focusOptionIndex?: number;
  expectsFocusSelection?: boolean;
  expectsCorrection?: boolean;
  expectsClosedAngle?: boolean;
};

type SafeWorkspaceSnapshot = {
  phase: string;
  activeAngle: string | null;
  checkpoint: "first" | "second" | null;
  availableAngles: string[];
  closedAngles: string[];
  allowedActions: string[];
  latestMessageSequence: number;
  lastAssistantTraceId: string | null;
  lastQuestion: {
    phase: string;
    angle: string | null;
    target: string;
    surfaceLevel: string;
    opportunityNumber: number | null;
  } | null;
};

type PreviewStep = {
  action: string;
  durationMs: number;
  snapshot: SafeWorkspaceSnapshot;
};

type CaseResult = {
  id: string;
  label: string;
  material: MaterialKind;
  angle: JournalEventAngle;
  depth: "guided" | "deep";
  rootSessionId: string | null;
  eventId: string | null;
  entryId: string | null;
  status: "passed" | "failed";
  startedAt: string;
  completedAt: string;
  firstCheckpoint: {
    reached: boolean;
    equalFourAngles: boolean;
    inputHidden: boolean;
    logHidden: boolean;
  };
  focusSelection: boolean | null;
  correction: boolean | null;
  closedAngle: boolean | null;
  deepQuestionAnswerCount: number;
  unusedRequiredReplies: string[];
  journal: {
    generated: boolean;
    origin: "llm" | "fallback" | "deterministic" | "existing" | null;
    edited: boolean;
    saved: boolean;
    reopened: boolean;
    traceId: string | null;
  };
  refresh: {
    afterFirstCheckpoint: boolean;
    afterJournalSave: boolean;
  };
  steps: PreviewStep[];
  issues: string[];
};

type SmokeResult = {
  id: "first_checkpoint" | "legacy_five_dimension";
  status: "passed" | "failed";
  issues: string[];
  details: Record<string, boolean | number | string | null>;
};

type PreviewEvidence = {
  evaluation: string;
  candidate: {
    strategyVersion: string;
    semanticArtifactVersion: string;
    model: "deepseek-v4-flash";
    provider: "openai";
    baseUrlHost: "api.deepseek.com";
    eventMode: "optional";
    eventStrategy: "generative";
  };
  startedAt: string;
  completedAt: string;
  database: string;
  rootSessionIds: string[];
  cases: CaseResult[];
  smokes: SmokeResult[];
  technicalSummary: {
    mainTrajectoriesCompleted: number;
    journalLoopsCompleted: number;
    failures: number;
    status: "ready_for_board8_audit" | "technical_failed";
  };
};

const GI058_CASES: PreviewCase[] = [
  {
    id: "feeling-1",
    label: "感受 1｜引导复盘",
    material: "real",
    angle: "feeling",
    depth: "guided",
    initialReply: "今天项目会上，我主动说明了进度可能延后。说完后我有点松下来，也担心大家觉得我准备得不够。",
    replies: [
      "松下来是因为终于不用继续假装一切都按计划进行；担心是怕别人觉得我能力不够。",
      "我发现让我难受的更多是害怕被当成不可靠的人。"
    ]
  },
  {
    id: "feeling-2",
    label: "感受 2｜深聊",
    material: "risk",
    angle: "feeling",
    depth: "deep",
    initialReply: "今天收到一条临时改期的消息。我心里有点乱，也说不清具体是哪种感受。",
    replies: [
      "我一时说不清，脑子里只有事情被打乱的感觉。",
      "还是说不清，这个角度先停在这里。"
    ],
    expectsClosedAngle: true
  },
  {
    id: "thought-1",
    label: "想法 1｜引导复盘",
    material: "risk",
    angle: "thought",
    depth: "guided",
    initialReply: "今天会议临时调换了我的汇报顺序。我当时很恼火，也担心别人会以为我没准备好。",
    replies: [
      "我纠正一下，让我难受的不是顺序变动本身，是没人提前说明，我觉得自己被临时置于被动。",
      "我当时默认别人应该先沟通好再调整，否则我就得临场承担解释成本。"
    ],
    expectsCorrection: true
  },
  {
    id: "thought-2",
    label: "想法 2｜深聊",
    material: "real",
    angle: "thought",
    depth: "deep",
    initialReply: "今天我拒绝了一个临时加塞的请求。我有点内疚，也觉得时间安排终于被自己守住了。",
    replies: [
      "我判断这件事不该接，是因为它会挤掉已经答应别人的工作。",
      "内疚来自怕对方失望，但我也更在意答应过的事情能按时完成。"
    ]
  },
  {
    id: "relationship-1",
    label: "关系 1｜引导复盘",
    material: "real",
    angle: "relationship",
    depth: "guided",
    initialReply: "今天我和伴侣讨论周末安排，他先替我答应了朋友的邀约。我有点生气，也觉得自己的安排没有被问过。",
    replies: [
      "我期待的是先问我愿不愿意，再一起决定，不是替我把时间交出去。",
      "事实是他可能觉得顺手答应方便，但我听到的是我的选择不重要。"
    ]
  },
  {
    id: "relationship-2",
    label: "关系 2｜深聊",
    material: "risk",
    angle: "relationship",
    depth: "deep",
    initialReply: "今天朋友连续发消息催我回复，我觉得压力很大，也不想马上解释自己为什么没回。",
    replies: [
      "我既希望对方尊重我的回复节奏，也希望他不要把沉默理解成我不在乎。",
      "我分不出哪个期待更重要，先停在这里。"
    ],
    expectsClosedAngle: true
  },
  {
    id: "action-1",
    label: "行动 1｜引导复盘",
    material: "risk",
    angle: "action",
    depth: "guided",
    initialReply: "今天上午我先回复了一封催得很急的邮件，下午又花了很久改同一份方案。我很疲惫，也担心自己一直在被紧急事情牵着走。",
    replies: [
      "我想聚焦下午改方案这件事。那时我不断重写，是因为担心一次交出去会被挑错。",
      "我后来发现自己没有先确认标准，就直接反复修改，时间都花在猜测上。"
    ],
    expectsFocusSelection: true
  },
  {
    id: "action-2",
    label: "行动 2｜深聊",
    material: "real",
    angle: "action",
    depth: "deep",
    initialReply: "今天我把手机放到另一个房间，完成了原本一直拖着的报告。我有成就感，也觉得这样做不太方便。",
    replies: [
      "把手机移开让我能持续写下去，阻力是担心错过家人的消息。",
      "我愿意继续用这个办法，但需要给重要的人留一个紧急联系的方式。",
      "继续往下看时，我最在意的是这个办法能不能坚持，同时又不漏掉家人的紧急消息。",
      "这部分先停在这里。"
    ]
  }
];

const GI059_CASES: PreviewCase[] = [
  {
    id: "feeling-1",
    label: "感受 1｜脚本化模拟·引导复盘",
    material: "real",
    angle: "feeling",
    depth: "guided",
    initialReply: "今天项目会上，我主动说明了进度可能延后。说完后我有点松下来，也担心大家觉得我准备得不够。",
    replies: [],
    replyRules: [
      { id: "feeling-required-material", keywords: ["身体", "反应", "时刻", "哪一", "什么时候", "变化"], text: "说完后看到负责人停顿了一下，我肩膀又绷紧了；松下来是因为终于说清真实进度，紧张来自怕延后被理解成准备不足。", required: true },
      { id: "feeling-tension", keywords: ["担心", "在意", "感受", "矛盾"], text: "松下来是因为终于说清真实进度；看到负责人停顿时肩膀又绷紧，是怕延后被理解成准备不足。" }
    ]
  },
  {
    id: "feeling-2",
    label: "感受 2｜脚本化模拟·深聊",
    material: "risk",
    angle: "feeling",
    depth: "deep",
    initialReply: "今天独自参加一个陌生活动，开始时很兴奋，散场后却一直很紧张，总会留意周围的声音。",
    replies: [],
    deepEntryReply: "我想继续看看，为什么活动已经结束，警觉还留着。",
    replyRules: [
      { id: "feeling-trigger", keywords: ["声音", "触发", "哪一", "时刻"], text: "听见电梯门打开时我会立刻抬头确认；活动里我期待认识新的人，回到住处后陌生声音会让期待很快变成戒备。", required: true },
      { id: "feeling-change", keywords: ["前后", "变化", "警觉", "体验"], text: "活动里我期待认识新的人；听见电梯门打开时我会立刻抬头，期待很快变成戒备。" },
      { id: "feeling-deep-connection", keywords: ["警觉", "变化", "为什么", "留下", "关系", "继续", "深入"], text: "继续看下去，我发现活动结束后还没有确定周围是否安全，所以听到陌生声音时会先确认环境，再决定能不能放松。" },
      { id: "feeling-deep-distinction", keywords: ["区分", "关键", "在意", "放松", "确认"], text: "我在意的不是活动本身，而是回到住处后还要不断确认环境；确认过后才能慢慢放松。" },
      { id: "feeling-deep-boundary", keywords: ["安全", "担心", "现在", "接着", "还能"], text: "此刻更能确认的是，陌生声音会让我先检查环境；活动带来的兴奋已经过去，紧张还在慢慢退。" },
      { id: "feeling-deep-stop", keywords: ["最后", "停在", "收束", "还想", "结束"], text: "这一段先停在这里；我已经能分清活动里的期待和回到住处后的戒备不是同一种感受。" }
    ]
  },
  {
    id: "thought-1",
    label: "想法 1｜脚本化模拟·引导复盘",
    material: "risk",
    angle: "thought",
    depth: "guided",
    initialReply: "今天会议临时调换了我的汇报顺序。我当时很恼火，也担心别人会以为我没准备好。",
    replies: ["我纠正一下，让我难受的不是顺序变动本身，是没人提前说明。我原本期待调整前先沟通，让我有机会重新准备开场。"],
    replyRules: [
      { id: "thought-basis", keywords: ["依据", "事实", "判断", "为什么"], text: "我需要临场重新解释上下文，这让我判断自己承担了本可避免的解释成本。" },
      { id: "thought-expectation", keywords: ["期待", "原先", "默认", "标准"], text: "我原本期待调整前先沟通，让我有机会重新准备开场。" }
    ],
    expectsCorrection: true
  },
  {
    id: "thought-2",
    label: "想法 2｜脚本化模拟·深聊",
    material: "real",
    angle: "thought",
    depth: "deep",
    initialReply: "今天我拒绝了一个临时加塞的请求。我有点内疚，也觉得时间安排终于被自己守住了。",
    replies: [],
    deepEntryReply: "我想继续理清自己当时判断这件事该不该接的依据。",
    replyRules: [
      { id: "thought-workload", keywords: ["依据", "事实", "判断", "衡量"], text: "它会挤掉已经答应别人的工作；内疚来自怕对方失望，但守住原有承诺也提醒我，拒绝并不等于不愿意帮忙。", required: true },
      { id: "thought-calibration", keywords: ["内疚", "承诺", "取舍", "在意", "关系"], text: "内疚来自怕对方失望；临时请求会挤掉原有交付，守住承诺提醒我拒绝并不等于不愿意帮忙。" },
      { id: "thought-deep-distinction", keywords: ["依据", "站得住", "关键", "深入", "判断"], text: "继续想下去，我发现让我内疚的是对方可能失望，并不是拒绝本身；能不能承担后果，比当下先答应更影响我的判断。" }
    ]
  },
  {
    id: "relationship-1",
    label: "关系 1｜脚本化模拟·引导复盘",
    material: "real",
    angle: "relationship",
    depth: "guided",
    initialReply: "今天我和伴侣讨论周末安排，他先替我答应了朋友的邀约。我有点生气，也觉得自己的安排没有被问过。",
    replies: [],
    replyRules: [
      { id: "relationship-interaction", keywords: ["互动", "发生", "做了", "具体"], text: "他在我还没回复时就在群里说我们都会去；我希望他先问我愿不愿意，再一起决定怎么回复。", required: true },
      { id: "relationship-expectation", keywords: ["期待", "希望", "边界", "在意"], text: "我希望他在群里答应前先问我愿不愿意，再一起决定怎么回复朋友。" }
    ]
  },
  {
    id: "relationship-2",
    label: "关系 2｜脚本化模拟·深聊",
    material: "risk",
    angle: "relationship",
    depth: "deep",
    initialReply: "今天朋友连续发消息催我回复，我觉得压力很大，也不想马上解释自己为什么没回。",
    replies: [],
    deepEntryReply: "我想继续看看，这次压力和我期待的相处方式有什么关系。",
    replyRules: [
      { id: "relationship-rhythm", keywords: ["希望", "期待", "节奏", "边界"], text: "我希望对方尊重我的回复节奏，也希望短暂沉默不会被直接理解成不在乎；这两项期待现在没法排序。", required: true },
      { id: "relationship-meaning", keywords: ["沉默", "在乎", "同时", "另一", "关系"], text: "我希望短暂沉默不会被理解成不在乎，也希望对方尊重回复节奏；两项期待现在没法排序。" },
      { id: "relationship-deep-stop", keywords: ["排序", "优先", "更重要", "分清", "继续", "深入", "哪一", "先"], text: "这两项对我都重要，现在没法排谁更靠前；这一段先停在这里。" }
    ]
  },
  {
    id: "action-1",
    label: "行动 1｜脚本化模拟·双事件",
    material: "risk",
    angle: "action",
    depth: "guided",
    initialReply: "上午我回复了一封很急的催办邮件，处理时很烦躁。下午我又反复修改同一份方案，那时我担心一直抓不住重点。",
    replies: [],
    focusOptionIndex: 1,
    replyRules: [
      { id: "action-sequence", keywords: ["行动", "目标", "推进", "完成", "做了", "顺序", "具体", "哪一"], text: "我先重排结构，随后反复改标题；重排让我感觉靠近重点，改标题又替代了真正推进正文。", required: true },
      { id: "action-effect", keywords: ["作用", "阻力", "卡住", "推进", "影响"], text: "重排结构让我感觉靠近重点，但我随后反复改标题，正文一直没有真正推进。" }
    ],
    expectsFocusSelection: true
  },
  {
    id: "action-2",
    label: "行动 2｜脚本化模拟·深聊",
    material: "real",
    angle: "action",
    depth: "deep",
    initialReply: "今天我把手机放到另一个房间，完成了原本一直拖着的报告。我有成就感，也觉得这样做不太方便。",
    replies: [],
    deepEntryReply: "我想继续理解，这个做法为什么有用，同时又带来阻力。",
    replyRules: [
      { id: "action-function", keywords: ["作用", "有用", "推进", "帮助"], text: "手机离开视线后我能连续写完一个段落；阻力是担心错过家人的紧急消息，所以重要联系人仍要有紧急入口。", required: true },
      { id: "action-tradeoff", keywords: ["阻力", "取舍", "担心", "条件"], text: "我能连续写下去，因为不再查看消息；阻力是担心错过家人的紧急消息，所以仍要保留紧急联系入口。" },
      { id: "action-deep-condition", keywords: ["条件", "真正", "有效", "受阻", "深入"], text: "继续看下去，关键条件是让普通消息暂时离开视线，同时给家人的紧急联系保留单独入口；这样专注和安心才能同时成立。" }
    ]
  }
];

const GI066_CASES: PreviewCase[] = [
  {
    id: "thought-entry-needs-concern",
    label: "理清想法 1｜事件缺个人困扰",
    material: "risk",
    angle: "thought",
    depth: "guided",
    initialReply: "今天项目会上负责人临时把交付日期提前了三天。",
    replies: [],
    replyRules: [
      { id: "entry-concern", keywords: ["判断", "犹豫", "顾虑", "想理清"], text: "我拿不准要不要当场拒绝，因为直接答应会挤掉已经承诺的工作。", required: true },
      { id: "criterion", keywords: ["如果", "条件", "改变", "仍"], text: "如果原有工作不会被挤掉，我会愿意接；能否守住已有承诺会改变我的判断。", required: true }
    ]
  },
  {
    id: "thought-entry-needs-event",
    label: "理清想法 2｜困扰缺具体事件",
    material: "risk",
    angle: "thought",
    depth: "guided",
    initialReply: "我很纠结自己是不是把风险想得太严重。",
    replies: [],
    replyRules: [
      { id: "entry-event", keywords: ["什么事", "具体", "发生", "哪件"], text: "今天客户要求提前上线，我担心测试时间不足，所以没有马上答应。", required: true },
      { id: "criterion", keywords: ["如果", "条件", "改变", "仍"], text: "如果测试时间足够，我会答应提前上线；测试是否充分是我真正使用的标准。", required: true }
    ]
  },
  {
    id: "thought-auto-dedupe",
    label: "理清想法 3｜自动进入与已有答案去重",
    material: "real",
    angle: "thought",
    depth: "guided",
    initialReply: "今天我拒绝了临时加塞的请求。我判断不该接，因为它会挤掉已经答应别人的工作。",
    replies: [],
    replyRules: [
      { id: "criterion", keywords: ["如果", "条件", "改变", "仍"], text: "如果不会影响已有交付，我会愿意帮忙；守住承诺比当下答应更影响我的判断。", required: true },
      { id: "next-direction", keywords: ["还有", "继续", "前提", "证据"], text: "我还拿不准的是，对方的紧急程度达到什么程度才值得重新调整承诺。" }
    ]
  },
  {
    id: "thought-criterion-next-direction",
    label: "理清想法 4｜判断标准到第二方向",
    material: "real",
    angle: "thought",
    depth: "deep",
    initialReply: "今天我没有接一个跨部门项目。我判断当前不适合接，因为手上的核心项目刚进入风险期。",
    deepEntryReply: "我还想继续看看，自己对新增项目风险的判断里有没有默认前提。",
    replies: [],
    replyRules: [
      { id: "criterion", keywords: ["如果", "条件", "改变", "仍"], text: "如果核心项目风险已经解除，我会接；能否承担新增波动是第一个判断标准。", required: true },
      { id: "assumption", keywords: ["前提", "默认", "确定", "风险"], text: "我默认新增项目一定会带来明显波动，但这件事其实还没有向对方确认。", required: true },
      { id: "calibration", keywords: ["新信息", "调整", "判断", "会不会"], text: "如果对方能保证投入很小，我会把结论从拒绝调整为先了解范围。" }
    ]
  },
  {
    id: "thought-evidence-tension",
    label: "理清想法 5｜证据张力与无法排序",
    material: "risk",
    angle: "thought",
    depth: "deep",
    initialReply: "今天我没有马上答应朋友的合作邀请。对方已有明确客户支持现在加入，但分工和收益没说清又支持继续等，我拿不准。",
    replies: [],
    replyRules: [
      { id: "tension", keywords: ["如果", "哪一", "证据", "改变", "支持"], text: "两条证据现在都重要，我暂时无法排序；只有分工和收益明确后，客户证据才足以让我加入。", required: true },
      { id: "unclear", keywords: ["更重要", "优先", "排序"], text: "我现在还是说不清哪一条更重要。" }
    ]
  },
  {
    id: "thought-correction-replan",
    label: "理清想法 6｜纠正后继续",
    material: "risk",
    angle: "thought",
    depth: "deep",
    initialReply: "今天我拒绝了临时项目。我当时认为工作量太大，后来看到同事获得决策权，我开始重新评估。",
    replies: ["纠正一下，我仍认可拒绝这个决定，只是发现自己低估了决策权的价值。"],
    replyRules: [
      { id: "calibration", keywords: ["如果", "调整", "新信息", "判断"], text: "如果下一次决策权明确且工作量可控，我会从直接拒绝调整为先谈条件。", required: true }
    ],
    expectsCorrection: true
  },
  {
    id: "thought-unclear-close",
    label: "理清想法 7｜连续说不清与方向关闭",
    material: "risk",
    angle: "thought",
    depth: "deep",
    initialReply: "今天我推迟回复一个合作邀请。我觉得先等更稳妥，但说不清自己具体按什么标准判断。",
    replies: ["我现在说不清。", "换成具体一点我还是说不清。", "继续"],
    replyRules: []
  },
  {
    id: "thought-stop-recovery",
    label: "理清想法 8｜明确停止与原位置保留",
    material: "risk",
    angle: "thought",
    depth: "deep",
    initialReply: "今天我没有接受临时调岗。我判断风险太高，因为职责和汇报关系都没有说清。",
    replies: ["先停在这里，不要再问了。"],
    replyRules: []
  }
];

const CASES = IS_GI066 ? GI066_CASES : USES_GI059_FLOW ? GI059_CASES : GI058_CASES;

function argumentValue(name: string) {
  const inline = process.argv.find((item) => item.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1) || null;
  const index = process.argv.indexOf(name);
  const next = index >= 0 ? process.argv[index + 1] : null;
  return next && !next.startsWith("--") ? next : null;
}

function errorCode(error: unknown) {
  if (!(error instanceof Error)) return "UNKNOWN_ERROR";
  return /^[A-Z][A-Z0-9_:-]+$/u.test(error.message)
    ? error.message
    : error.name || "UNCLASSIFIED_ERROR";
}

function safeWorkspaceSnapshot(workspace: EventCenteredWorkspaceSession): SafeWorkspaceSnapshot {
  const latestAssistant = workspace.messages
    .filter((message) => message.role === "assistant")
    .at(-1);
  const question = latestAssistant?.assistantPayload?.questionSpec ?? null;
  return {
    phase: workspace.dialogue.phase,
    activeAngle: workspace.dialogue.activeAngle,
    checkpoint: workspace.dialogue.checkpoint?.kind ?? null,
    availableAngles: [...workspace.dialogue.availableAngles],
    closedAngles: [...(workspace.dialogue.closedAngles ?? [])],
    allowedActions: [...workspace.dialogue.allowedActions],
    latestMessageSequence: workspace.latestMessageSequence,
    lastAssistantTraceId: latestAssistant?.generationTraceId ?? null,
    lastQuestion: question
      ? {
          phase: question.phase,
          angle: question.angle,
          target: question.target,
          surfaceLevel: question.surfaceLevel,
          opportunityNumber: question.opportunityNumber
        }
      : null
  };
}

function exactlyFourEqualAngles(workspace: EventCenteredWorkspaceSession) {
  return FOUR_ANGLES.every((angle) => workspace.dialogue.availableAngles.includes(angle)) &&
    workspace.dialogue.availableAngles.length === FOUR_ANGLES.length;
}

async function createPreviewUser(prisma: PrismaClient, label: string) {
  return prisma.user.create({
    data: {
      username: `board8-${BOARD8_PREVIEW_CANDIDATE}-${label}-${randomUUID().slice(0, 8)}`,
      passwordHash: "preview-only-no-login",
      agreedToTermsAt: new Date(),
      agreedToPrivacyAt: new Date(),
      privacyPolicyVersion: "board8-preview-2026-08-03"
    },
    select: { id: true }
  });
}

async function currentWorkspace(userId: string, rootSessionId: string) {
  const workspace = await getEventCenteredInterviewWorkspace(userId, rootSessionId);
  if (!workspace) throw new Error("PREVIEW_WORKSPACE_NOT_FOUND");
  return workspace;
}

async function submitEventAction(input: {
  userId: string;
  rootSessionId: string;
  action: EventCenteredRespondRequest["action"];
  rawText?: string;
  angle?: JournalEventAngle;
  optionId?: string;
  targetMessageId?: string;
  steps: PreviewStep[];
}) {
  const before = await currentWorkspace(input.userId, input.rootSessionId);
  const request: EventCenteredRespondRequest = {
    action: input.action,
    rootSessionId: input.rootSessionId,
    clientTurnId: randomUUID(),
    baseBranchSessionId: before.activeBranchSessionId,
    baseMessageSequence: before.latestMessageSequence,
    inputMode: "text",
    ...(input.rawText ? { rawText: input.rawText } : {}),
    ...(input.angle ? { angle: input.angle } : {}),
    ...(input.optionId ? { optionId: input.optionId } : {}),
    ...(input.targetMessageId ? { targetMessageId: input.targetMessageId } : {})
  };
  const startedAt = Date.now();
  const result = await respondEventCenteredInterview(input.userId, request);
  input.steps.push({
    action: input.action,
    durationMs: Date.now() - startedAt,
    snapshot: safeWorkspaceSnapshot(result.workspace)
  });
  return result.workspace;
}

function markIssue(result: CaseResult, issue: string) {
  if (!result.issues.includes(issue)) result.issues.push(issue);
}

function lastAssistantMessageId(workspace: EventCenteredWorkspaceSession) {
  return workspace.messages.filter((message) => message.role === "assistant").at(-1)?.id ?? null;
}

function latestQuestionContext(workspace: EventCenteredWorkspaceSession) {
  const payload = workspace.messages
    .filter((message) => message.role === "assistant" && message.assistantPayload?.questionSpec)
    .at(-1)?.assistantPayload;
  return [payload?.questionSpec?.target, payload?.naturalResponse]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
}

function selectScriptedReply(input: {
  previewCase: PreviewCase;
  workspace: EventCenteredWorkspaceSession;
  usedReplyRuleIds: Set<string>;
  replyIndex: number;
}) {
  if ((!USES_GI059_FLOW && !IS_GI066) || !input.previewCase.replyRules?.length) {
    return input.previewCase.replies[input.replyIndex]
      ? { id: `sequential-${input.replyIndex + 1}`, text: input.previewCase.replies[input.replyIndex]! }
      : null;
  }
  const context = latestQuestionContext(input.workspace);
  const matched = input.previewCase.replyRules.find((rule) =>
    !input.usedReplyRuleIds.has(rule.id) &&
    rule.keywords.some((keyword) => context.includes(keyword))
  );
  const fallback = input.previewCase.replyRules.find((rule) =>
    !input.usedReplyRuleIds.has(rule.id)
  );
  const selected = matched ?? fallback;
  return selected ? { id: selected.id, text: selected.text } : null;
}

async function completeJournalLoop(input: {
  userId: string;
  rootSessionId: string;
  result: CaseResult;
}) {
  const workspace = await currentWorkspace(input.userId, input.rootSessionId);
  if (!workspace.dialogue.allowedActions.includes("generate_event_journal")) {
    markIssue(input.result, "EVENT_JOURNAL_ACTION_UNAVAILABLE");
    return;
  }
  try {
    const generated = await generateJournalEventEntry({
      userId: input.userId,
      rootSessionId: input.rootSessionId,
      baseBranchSessionId: workspace.activeBranchSessionId,
      baseMessageSequence: workspace.latestMessageSequence,
      clientOperationId: randomUUID()
    });
    input.result.entryId = generated.entry.id;
    input.result.journal.generated = true;
    input.result.journal.origin = generated.generation.origin;
    input.result.journal.traceId = generated.entry.currentGenerationTraceId;

    const suffix = "\n\n已校对。";
    const edited = await editJournalEventEntry({
      userId: input.userId,
      entryId: generated.entry.id,
      expectedContentRevision: generated.entry.contentRevision,
      title: generated.entry.title,
      content: generated.entry.content.length + suffix.length <= 5_000
        ? `${generated.entry.content}${suffix}`
        : generated.entry.content
    });
    input.result.journal.edited = true;
    const saved = await confirmJournalEventEntry({
      userId: input.userId,
      entryId: edited.id,
      expectedContentRevision: edited.contentRevision
    });
    input.result.journal.saved = saved.status === "saved";
    const reloaded = await readJournalEventEntry(input.userId, saved.id);
    const refreshedWorkspace = await currentWorkspace(input.userId, input.rootSessionId);
    input.result.journal.reopened = Boolean(
      reloaded &&
      reloaded.status === "saved" &&
      reloaded.savedRevision === saved.savedRevision &&
      refreshedWorkspace.journal.entryId === saved.id &&
      refreshedWorkspace.journal.status === "saved"
    );
    input.result.refresh.afterJournalSave = input.result.journal.reopened;
    if (!input.result.journal.reopened) markIssue(input.result, "EVENT_JOURNAL_REOPEN_FAILED");
  } catch (error) {
    markIssue(input.result, `EVENT_JOURNAL_LOOP:${errorCode(error)}`);
  }
}

async function runGi066Case(
  prisma: PrismaClient,
  previewCase: PreviewCase
): Promise<CaseResult> {
  const startedAt = new Date().toISOString();
  const result: CaseResult = {
    id: previewCase.id,
    label: previewCase.label,
    material: previewCase.material,
    angle: "thought",
    depth: previewCase.depth,
    rootSessionId: null,
    eventId: null,
    entryId: null,
    status: "failed",
    startedAt,
    completedAt: startedAt,
    firstCheckpoint: {
      reached: false,
      equalFourAngles: false,
      inputHidden: false,
      logHidden: true
    },
    focusSelection: previewCase.expectsFocusSelection ? false : null,
    correction: previewCase.expectsCorrection ? false : null,
    closedAngle: previewCase.expectsClosedAngle ? false : null,
    deepQuestionAnswerCount: 0,
    unusedRequiredReplies: [],
    journal: {
      generated: false,
      origin: null,
      edited: false,
      saved: false,
      reopened: false,
      traceId: null
    },
    refresh: { afterFirstCheckpoint: false, afterJournalSave: false },
    steps: [],
    issues: []
  };
  try {
    const user = await createPreviewUser(prisma, previewCase.id);
    const identity = await startEventCenteredInterview(user.id);
    result.rootSessionId = identity.rootSessionId;
    result.eventId = identity.eventId;
    let workspace = await submitEventAction({
      userId: user.id,
      rootSessionId: identity.rootSessionId,
      action: "reply",
      rawText: previewCase.initialReply,
      steps: result.steps
    });
    if (workspace.dialogue.phase === "event_focus_clarification") {
      if (workspace.dialogue.focusOptions.length === 0) {
        markIssue(result, "EMPTY_EVENT_FOCUS_SELECTION");
      } else {
        workspace = await submitEventAction({
          userId: user.id,
          rootSessionId: identity.rootSessionId,
          action: "select_current_event",
          optionId: workspace.dialogue.focusOptions[previewCase.focusOptionIndex ?? 0]!.id,
          steps: result.steps
        });
        result.focusSelection = true;
      }
    }

    const usedReplyRuleIds = new Set<string>();
    const seenQuestionTargets = new Set<string>();
    let sequentialReplyIndex = 0;
    let correctionApplied = false;
    let deepEntrySubmitted = false;
    for (let guard = 0; guard < 10; guard += 1) {
      workspace = await currentWorkspace(user.id, identity.rootSessionId);
      const latestQuestion = workspace.messages
        .filter((message) => message.role === "assistant")
        .at(-1)?.assistantPayload?.questionSpec ?? null;
      if (
        !latestQuestion &&
        workspace.dialogue.allowedActions.includes("generate_event_journal") &&
        previewCase.depth === "deep" &&
        previewCase.deepEntryReply &&
        !deepEntrySubmitted &&
        (previewCase.replyRules ?? []).some(
          (rule) => rule.required && !usedReplyRuleIds.has(rule.id)
        )
      ) {
        workspace = await submitEventAction({
          userId: user.id,
          rootSessionId: identity.rootSessionId,
          action: "reply",
          rawText: previewCase.deepEntryReply,
          steps: result.steps
        });
        deepEntrySubmitted = true;
        continue;
      }
      if (!latestQuestion && workspace.dialogue.allowedActions.includes("generate_event_journal")) break;
      if (!workspace.dialogue.allowedActions.includes("reply") && !latestQuestion) {
        markIssue(result, `GI066_UNEXPECTED_FLOW_STATE:${workspace.dialogue.phase}`);
        break;
      }
      if (latestQuestion?.target.startsWith("gi066:")) {
        if (seenQuestionTargets.has(latestQuestion.target)) {
          markIssue(result, "GI066_DUPLICATE_QUESTION_SIGNATURE");
          break;
        }
        seenQuestionTargets.add(latestQuestion.target);
      }

      if (previewCase.expectsCorrection && !correctionApplied && previewCase.replies[0]) {
        const targetMessageId = lastAssistantMessageId(workspace);
        if (!targetMessageId) {
          markIssue(result, "GI066_CORRECTION_TARGET_MISSING");
          break;
        }
        workspace = await submitEventAction({
          userId: user.id,
          rootSessionId: identity.rootSessionId,
          action: "correct_understanding",
          rawText: previewCase.replies[0],
          targetMessageId,
          steps: result.steps
        });
        correctionApplied = true;
        result.correction = true;
        continue;
      }

      const selectedRule = selectScriptedReply({
        previewCase: { ...previewCase, replies: [] },
        workspace,
        usedReplyRuleIds,
        replyIndex: sequentialReplyIndex
      });
      let reply = selectedRule?.text ?? previewCase.replies[
        sequentialReplyIndex + (previewCase.expectsCorrection ? 1 : 0)
      ];
      if (selectedRule) usedReplyRuleIds.add(selectedRule.id);
      else sequentialReplyIndex += 1;
      if (!reply) reply = "这一段先停在这里，不要再追问了。";
      if (latestQuestion?.angle === "thought") result.deepQuestionAnswerCount += 1;
      workspace = await submitEventAction({
        userId: user.id,
        rootSessionId: identity.rootSessionId,
        action: "reply",
        rawText: reply,
        steps: result.steps
      });
    }

    result.unusedRequiredReplies = (previewCase.replyRules ?? [])
      .filter((rule) => rule.required && !usedReplyRuleIds.has(rule.id))
      .map((rule) => rule.id);
    if (result.unusedRequiredReplies.length > 0) {
      markIssue(result, `GI066_UNUSED_REQUIRED_REPLIES:${result.unusedRequiredReplies.join(",")}`);
    }
    result.firstCheckpoint.reached = workspace.dialogue.activeAngle === "thought" ||
      result.steps.some((step) => step.snapshot.activeAngle === "thought");
    result.firstCheckpoint.equalFourAngles = workspace.dialogue.availableAngles.every(
      (angle) => angle === "thought"
    );
    result.firstCheckpoint.inputHidden = false;
    result.refresh.afterFirstCheckpoint = Boolean(
      (await currentWorkspace(user.id, identity.rootSessionId)).dialogue.activeAngle === "thought" ||
      result.firstCheckpoint.reached
    );
    if (!result.firstCheckpoint.reached) markIssue(result, "GI066_THOUGHT_AUTO_ENTRY_NOT_REACHED");
    if (result.deepQuestionAnswerCount < 1) markIssue(result, "GI066_FORMAL_QUESTION_NOT_ANSWERED");
    await completeJournalLoop({
      userId: user.id,
      rootSessionId: identity.rootSessionId,
      result
    });
    result.status = result.issues.length === 0 && result.journal.reopened
      ? "passed"
      : "failed";
  } catch (error) {
    markIssue(result, `GI066_CASE:${errorCode(error)}`);
  }
  result.completedAt = new Date().toISOString();
  return result;
}

async function runCase(prisma: PrismaClient, previewCase: PreviewCase): Promise<CaseResult> {
  if (IS_GI066) return runGi066Case(prisma, previewCase);
  const startedAt = new Date().toISOString();
  const result: CaseResult = {
    id: previewCase.id,
    label: previewCase.label,
    material: previewCase.material,
    angle: previewCase.angle,
    depth: previewCase.depth,
    rootSessionId: null,
    eventId: null,
    entryId: null,
    status: "failed",
    startedAt,
    completedAt: startedAt,
    firstCheckpoint: {
      reached: false,
      equalFourAngles: false,
      inputHidden: false,
      logHidden: false
    },
    focusSelection: previewCase.expectsFocusSelection ? false : null,
    correction: previewCase.expectsCorrection ? false : null,
    closedAngle: previewCase.expectsClosedAngle ? false : null,
    deepQuestionAnswerCount: 0,
    unusedRequiredReplies: [],
    journal: {
      generated: false,
      origin: null,
      edited: false,
      saved: false,
      reopened: false,
      traceId: null
    },
    refresh: {
      afterFirstCheckpoint: false,
      afterJournalSave: false
    },
    steps: [],
    issues: []
  };

  try {
    const user = await createPreviewUser(prisma, previewCase.id);
    const identity = await startEventCenteredInterview(user.id);
    result.rootSessionId = identity.rootSessionId;
    result.eventId = identity.eventId;

    let workspace = await submitEventAction({
      userId: user.id,
      rootSessionId: identity.rootSessionId,
      action: "reply",
      rawText: previewCase.initialReply,
      steps: result.steps
    });

    if (workspace.dialogue.phase === "event_focus_clarification") {
      if (!previewCase.expectsFocusSelection || workspace.dialogue.focusOptions.length === 0) {
        markIssue(result, "UNEXPECTED_OR_EMPTY_EVENT_FOCUS_SELECTION");
        return result;
      }
      workspace = await submitEventAction({
        userId: user.id,
        rootSessionId: identity.rootSessionId,
        action: "select_current_event",
        optionId: workspace.dialogue.focusOptions[
          previewCase.focusOptionIndex ?? 0
        ]?.id ?? workspace.dialogue.focusOptions[0]!.id,
        steps: result.steps
      });
      result.focusSelection = true;
    } else if (previewCase.expectsFocusSelection) {
      markIssue(result, "EXPECTED_EVENT_FOCUS_SELECTION_NOT_REACHED");
    }

    result.firstCheckpoint.reached = workspace.dialogue.checkpoint?.kind === "first";
    result.firstCheckpoint.equalFourAngles = exactlyFourEqualAngles(workspace);
    result.firstCheckpoint.inputHidden = !workspace.dialogue.allowedActions.includes("reply");
    result.firstCheckpoint.logHidden = !workspace.dialogue.allowedActions.includes("generate_event_journal");
    result.refresh.afterFirstCheckpoint = (await currentWorkspace(user.id, identity.rootSessionId)).dialogue.checkpoint?.kind === "first";
    if (!result.firstCheckpoint.reached) markIssue(result, "FIRST_CHECKPOINT_NOT_REACHED");
    if (!result.firstCheckpoint.equalFourAngles) markIssue(result, "FIRST_CHECKPOINT_ANGLES_NOT_EQUAL");
    if (!result.firstCheckpoint.inputHidden) markIssue(result, "FIRST_CHECKPOINT_INPUT_VISIBLE");
    if (!result.firstCheckpoint.logHidden) markIssue(result, "FIRST_CHECKPOINT_LOG_VISIBLE");
    if (!result.refresh.afterFirstCheckpoint) markIssue(result, "FIRST_CHECKPOINT_REFRESH_FAILED");

    if (!workspace.dialogue.allowedActions.includes("select_exploration_angle")) {
      markIssue(result, "ANGLE_SELECTION_UNAVAILABLE");
      return result;
    }
    workspace = await submitEventAction({
      userId: user.id,
      rootSessionId: identity.rootSessionId,
      action: "select_exploration_angle",
      angle: previewCase.angle,
      steps: result.steps
    });
    if (!workspace.dialogue.allowedActions.includes("reply")) {
      markIssue(result, "FORMAL_REFLECTION_FIRST_QUESTION_UNAVAILABLE");
      return result;
    }

    let replyIndex = 0;
    let didContinueDeeply = false;
    const usedReplyRuleIds = new Set<string>();
    let correctionApplied = false;
    for (let guard = 0; guard < 8; guard += 1) {
      workspace = await currentWorkspace(user.id, identity.rootSessionId);
      if (
        previewCase.depth === "deep" &&
        !didContinueDeeply &&
        workspace.dialogue.phase === "checkpoint_two" &&
        (
          USES_GI059_FLOW
            ? workspace.dialogue.allowedActions.includes("reply")
            : workspace.dialogue.allowedActions.includes("continue_exploration")
        )
      ) {
        workspace = await submitEventAction({
          userId: user.id,
          rootSessionId: identity.rootSessionId,
          action: USES_GI059_FLOW ? "reply" : "continue_exploration",
          ...(USES_GI059_FLOW
            ? { rawText: previewCase.deepEntryReply ?? "我想沿着刚才的方向继续理解。" }
            : {}),
          steps: result.steps
        });
        didContinueDeeply = true;
        continue;
      }

      if (workspace.dialogue.allowedActions.includes("generate_event_journal")) break;

      if (!workspace.dialogue.allowedActions.includes("reply")) {
        markIssue(result, `UNEXPECTED_FLOW_STATE:${workspace.dialogue.phase}`);
        break;
      }
      if (previewCase.expectsCorrection && !correctionApplied) {
        const correctionReply = previewCase.replies[replyIndex];
        if (!correctionReply) {
          markIssue(result, "CORRECTION_REPLY_UNAVAILABLE");
          break;
        }
        const targetMessageId = lastAssistantMessageId(workspace);
        if (!targetMessageId) {
          markIssue(result, "CORRECTION_TARGET_UNAVAILABLE");
          break;
        }
        workspace = await submitEventAction({
          userId: user.id,
          rootSessionId: identity.rootSessionId,
          action: "correct_understanding",
          rawText: correctionReply,
          targetMessageId,
          steps: result.steps
        });
        correctionApplied = true;
        result.correction = true;
        replyIndex += 1;
      } else {
        const scriptedReply = selectScriptedReply({
          previewCase,
          workspace,
          usedReplyRuleIds,
          replyIndex
        });
        if (!scriptedReply) {
          markIssue(result, "SCRIPTED_REPLY_NOT_AVAILABLE_FOR_ACTUAL_QUESTION");
          break;
        }
        workspace = await submitEventAction({
          userId: user.id,
          rootSessionId: identity.rootSessionId,
          action: "reply",
          rawText: scriptedReply.text,
          steps: result.steps
        });
        usedReplyRuleIds.add(scriptedReply.id);
        replyIndex += 1;
        if (previewCase.depth === "deep" && didContinueDeeply) {
          result.deepQuestionAnswerCount += 1;
        }
      }
    }

    const terminalWorkspace = await currentWorkspace(user.id, identity.rootSessionId);
    if (previewCase.expectsClosedAngle) {
      result.closedAngle = Boolean(terminalWorkspace.dialogue.closedAngles?.includes(previewCase.angle));
      if (!result.closedAngle) markIssue(result, "ANGLE_NOT_CLOSED_AFTER_BOUNDARY");
    }
    if (previewCase.depth === "deep" && !didContinueDeeply && !previewCase.expectsClosedAngle) {
      markIssue(result, "DEEP_CONTINUATION_NOT_REACHED");
    }
    if (USES_GI059_FLOW && previewCase.depth === "deep" && result.deepQuestionAnswerCount < 1) {
      markIssue(result, "DEEP_VALID_QUESTION_ANSWER_REQUIRED");
    }
    if (USES_GI059_FLOW) {
      result.unusedRequiredReplies = (previewCase.replyRules ?? [])
        .filter((rule) => rule.required && !usedReplyRuleIds.has(rule.id))
        .map((rule) => rule.id);
      if (result.unusedRequiredReplies.length > 0) {
        markIssue(result, `UNUSED_REQUIRED_DISCLOSURES:${result.unusedRequiredReplies.join(",")}`);
      }
    }

    await completeJournalLoop({
      userId: user.id,
      rootSessionId: identity.rootSessionId,
      result
    });
  } catch (error) {
    markIssue(result, `CASE_RUNTIME:${errorCode(error)}`);
  } finally {
    result.completedAt = new Date().toISOString();
    result.status = result.issues.length === 0 && result.journal.reopened ? "passed" : "failed";
  }
  return result;
}

async function runFirstCheckpointSmoke(prisma: PrismaClient): Promise<SmokeResult> {
  const issues: string[] = [];
  const user = await createPreviewUser(prisma, "first-checkpoint-smoke");
  try {
    const identity = await startEventCenteredInterview(user.id);
    const steps: PreviewStep[] = [];
    const workspace = await submitEventAction({
      userId: user.id,
      rootSessionId: identity.rootSessionId,
      action: "reply",
      rawText: "今天开会时我主动说明了风险。我当时松了一口气，也担心别人觉得我能力不够。",
      steps
    });
    const refreshed = await currentWorkspace(user.id, identity.rootSessionId);
    if (IS_GI066) {
      const autoEntered = workspace.dialogue.activeAngle === "thought" &&
        workspace.messages.some((message) =>
          message.role === "assistant" && message.assistantPayload?.questionSpec?.angle === "thought"
        );
      const thoughtOnly = workspace.dialogue.availableAngles.every((angle) => angle === "thought");
      const restored = refreshed.dialogue.activeAngle === "thought" &&
        refreshed.messages.some((message) =>
          message.role === "assistant" && message.assistantPayload?.questionSpec?.angle === "thought"
        );
      if (!autoEntered) issues.push("GI066_AUTO_ENTRY_NOT_REACHED");
      if (!thoughtOnly) issues.push("GI066_NON_THOUGHT_ANGLE_VISIBLE");
      if (!restored) issues.push("GI066_AUTO_ENTRY_RESTORE_FAILED");
      return {
        id: "first_checkpoint",
        status: issues.length ? "failed" : "passed",
        issues,
        details: {
          rootSessionId: identity.rootSessionId,
          autoEntered,
          thoughtOnly,
          restored
        }
      };
    }
    const fourAngles = exactlyFourEqualAngles(workspace);
    const hiddenInput = !workspace.dialogue.allowedActions.includes("reply");
    const hiddenLog = !workspace.dialogue.allowedActions.includes("generate_event_journal");
    const restored = refreshed.dialogue.checkpoint?.kind === "first" &&
      exactlyFourEqualAngles(refreshed) &&
      !refreshed.dialogue.allowedActions.includes("reply") &&
      !refreshed.dialogue.allowedActions.includes("generate_event_journal");
    if (workspace.dialogue.checkpoint?.kind !== "first") issues.push("FIRST_CHECKPOINT_NOT_REACHED");
    if (!fourAngles) issues.push("FIRST_CHECKPOINT_ANGLES_NOT_EQUAL");
    if (!hiddenInput) issues.push("FIRST_CHECKPOINT_INPUT_VISIBLE");
    if (!hiddenLog) issues.push("FIRST_CHECKPOINT_LOG_VISIBLE");
    if (!restored) issues.push("FIRST_CHECKPOINT_RESTORE_FAILED");
    return {
      id: "first_checkpoint",
      status: issues.length ? "failed" : "passed",
      issues,
      details: {
        rootSessionId: identity.rootSessionId,
        reached: workspace.dialogue.checkpoint?.kind === "first",
        fourAngles,
        hiddenInput,
        hiddenLog,
        restored
      }
    };
  } catch (error) {
    return {
      id: "first_checkpoint",
      status: "failed",
      issues: [`SMOKE_RUNTIME:${errorCode(error)}`],
      details: {}
    };
  }
}

async function runLegacyFiveDimensionSmoke(prisma: PrismaClient): Promise<SmokeResult> {
  const issues: string[] = [];
  const user = await createPreviewUser(prisma, "legacy-five-dimension-smoke");
  try {
    const started = await startInterview(user.id, "reflection");
    const response = await respondToInterview({
      userId: user.id,
      action: "reply",
      sessionId: started.sessionId,
      rawText: "今天开会时，我意识到提前确认分工能少很多临时猜测。我有点释然。",
      userMessage: "今天开会时，我意识到提前确认分工能少很多临时猜测。我有点释然。",
      inputMode: "text",
      clientTurnId: randomUUID()
    });
    const restored = await getInterviewSession(user.id, started.sessionId);
    const startedCorrectly = Boolean(started.sessionId && started.openingQuestion);
    const submitted = response.turnCount >= 1;
    const reopened = Boolean(restored && restored.id === started.sessionId && restored.turnCount >= 1);
    if (!startedCorrectly) issues.push("LEGACY_START_FAILED");
    if (!submitted) issues.push("LEGACY_CONTENT_NOT_SUBMITTED");
    if (!reopened) issues.push("LEGACY_RESTORE_FAILED");
    return {
      id: "legacy_five_dimension",
      status: issues.length ? "failed" : "passed",
      issues,
      details: {
        sessionId: started.sessionId,
        started: startedCorrectly,
        submitted,
        reopened,
        turnCount: response.turnCount
      }
    };
  } catch (error) {
    return {
      id: "legacy_five_dimension",
      status: "failed",
      issues: [`SMOKE_RUNTIME:${errorCode(error)}`],
      details: {}
    };
  }
}

function formatMarkdown(evidence: PreviewEvidence) {
  const lines = [
    `# 板块 8｜${IS_GI066 ? "GI-066 单角度脚本化模拟" : IS_GI064 ? "GI-064 脚本化模拟" : IS_GI063 ? "GI-063 脚本化模拟" : IS_GI062 ? "GI-062 脚本化模拟" : IS_GI061 ? "GI-061 脚本化模拟" : IS_GI060 ? "GI-060 脚本化模拟" : IS_GI059 ? "GI-059 脚本化模拟" : "GI-058"}官方 DeepSeek 独立 Preview 执行证据`,
    "",
    `- 候选开始：${evidence.startedAt}`,
    `- 候选完成：${evidence.completedAt}`,
    `- 模型：${evidence.candidate.model}`,
    `- Provider：官方 DeepSeek OpenAI 兼容接口（${evidence.candidate.baseUrlHost}）`,
    `- Preview 档位：${evidence.candidate.eventMode} + ${evidence.candidate.eventStrategy}`,
    `- 数据库：${evidence.database}`,
    `- 技术主链：${evidence.technicalSummary.mainTrajectoriesCompleted}/8`,
    `- 日志闭环：${evidence.technicalSummary.journalLoopsCompleted}/8`,
    `- 当前技术裁决：${evidence.technicalSummary.status === "ready_for_board8_audit" ? "进入 Board8 只读审计" : "存在技术失败，等待复核"}`,
    "",
    USES_GI059_FLOW || IS_GI066
      ? "本轮 8+2 属于脚本化模拟，只验证技术主链、目标响应、日志闭环与性能；产品体验 Go/No-Go 只由本机人工实聊工作台裁决。"
      : "本文件只保留状态、标识和性能审计所需的安全字段；用户原话、AI 全文、日志正文和 Trace 上下文保持在受控 Preview 数据库。",
    "",
    "| 轨迹 | 素材 | 状态 | 日志来源 | 日志保存并重开 | 问题 |",
    "| --- | --- | --- | --- | --- | --- |"
  ];
  for (const result of evidence.cases) {
    lines.push(
      `| ${result.label} | ${USES_GI059_FLOW || IS_GI066 ? "脚本化模拟" : result.material === "real" ? "真实事件" : "风控事件"} | ${result.status === "passed" ? "通过" : "失败"} | ${result.journal.origin ?? "未生成"} | ${result.journal.reopened ? "完成" : "未完成"} | ${result.issues.join("；") || "无"} |`
    );
  }
  lines.push("", "## 冒烟", "");
  for (const smoke of evidence.smokes) {
    lines.push(`- ${smoke.id}：${smoke.status === "passed" ? "通过" : "失败"}${smoke.issues.length ? `（${smoke.issues.join("；")}）` : ""}`);
  }
  lines.push("", "## 下一步", "", "使用同一批根会话运行 `report:event-centered:board8`，再根据正式复盘降级、日志来源、双延迟和一票阻断项做 Go/No-Go 裁决。");
  return `${lines.join("\n")}\n`;
}

function previewDatabaseName() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error(`BOARD8_${CANDIDATE_ERROR_PREFIX}_PREVIEW_DATABASE_REQUIRED`);
  return decodeURIComponent(new URL(databaseUrl).pathname).replace(/^\//u, "");
}

function assertPreviewEnvironment() {
  const approval = IS_GI066
    ? process.env.ALLOW_BOARD8_GI066_DEEPSEEK_PREVIEW
    : IS_GI064
    ? process.env.ALLOW_BOARD8_GI064_DEEPSEEK_PREVIEW
    : IS_GI063
    ? process.env.ALLOW_BOARD8_GI063_DEEPSEEK_PREVIEW
    : IS_GI062
    ? process.env.ALLOW_BOARD8_GI062_DEEPSEEK_PREVIEW
    : IS_GI061
    ? process.env.ALLOW_BOARD8_GI061_DEEPSEEK_PREVIEW
    : IS_GI060
    ? process.env.ALLOW_BOARD8_GI060_DEEPSEEK_PREVIEW
    : IS_GI059
      ? process.env.ALLOW_BOARD8_GI059_DEEPSEEK_PREVIEW
      : process.env.ALLOW_BOARD8_GI058_DEEPSEEK_PREVIEW;
  if (approval !== "I_UNDERSTAND") {
    throw new Error(`BOARD8_${CANDIDATE_ERROR_PREFIX}_PREVIEW_APPROVAL_REQUIRED`);
  }
  const databaseName = previewDatabaseName();
  if (!databaseName.startsWith(PREVIEW_DATABASE_PREFIX)) {
    throw new Error(`BOARD8_${CANDIDATE_ERROR_PREFIX}_PREVIEW_DATABASE_GUARD`);
  }
  if (process.env.AI_PROVIDER?.trim().toLowerCase() !== "openai") {
    throw new Error(`BOARD8_${CANDIDATE_ERROR_PREFIX}_OFFICIAL_DEEPSEEK_PROVIDER_REQUIRED`);
  }
  if (process.env.DEEPSEEK_MODEL?.trim() !== "deepseek-v4-flash") {
    throw new Error(`BOARD8_${CANDIDATE_ERROR_PREFIX}_OFFICIAL_DEEPSEEK_MODEL_REQUIRED`);
  }
  if (new URL(process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").hostname !== "api.deepseek.com") {
    throw new Error(`BOARD8_${CANDIDATE_ERROR_PREFIX}_OFFICIAL_DEEPSEEK_BASE_URL_REQUIRED`);
  }
  if (getEventCenteredReleaseMode() !== "optional") {
    throw new Error(`BOARD8_${CANDIDATE_ERROR_PREFIX}_PREVIEW_OPTIONAL_MODE_REQUIRED`);
  }
  if (getEventCenteredStrategyMode() !== "generative") {
    throw new Error(`BOARD8_${CANDIDATE_ERROR_PREFIX}_PREVIEW_GENERATIVE_STRATEGY_REQUIRED`);
  }
  if (IS_GI066 && getEventCenteredProductScope() !== "thought_only") {
    throw new Error("BOARD8_GI066_THOUGHT_ONLY_SCOPE_REQUIRED");
  }
}

async function main() {
  // 独立 Preview 通过 CLI 运行，不经过 Next.js 启动链路；此处显式加载本机隔离环境。
  loadEnvConfig(process.cwd());
  assertPreviewEnvironment();
  const onlyCaseId = argumentValue("--only-case");
  const selectedCases = onlyCaseId
    ? CASES.filter((previewCase) => previewCase.id === onlyCaseId)
    : CASES;
  if (selectedCases.length === 0) {
    throw new Error(`BOARD8_${CANDIDATE_ERROR_PREFIX}_PREVIEW_CASE_NOT_FOUND`);
  }
  const skipSmokes = process.argv.includes("--skip-smokes");
  const outputDirectory = resolve(argumentValue("--output-dir") ?? DEFAULT_OUTPUT_DIRECTORY);
  const jsonPath = resolve(outputDirectory, "preview-execution-evidence.json");
  const markdownPath = resolve(outputDirectory, "preview-execution-evidence.md");
  await access(jsonPath).then(
    () => {
      throw new Error(`BOARD8_${CANDIDATE_ERROR_PREFIX}_PREVIEW_EVIDENCE_ALREADY_EXISTS`);
    },
    (error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    }
  );

  const prisma = new PrismaClient();
  const startedAt = new Date().toISOString();
  try {
    const cases: CaseResult[] = [];
    for (const previewCase of selectedCases) {
      process.stdout.write(`[Board8 Preview] 开始 ${previewCase.id}\n`);
      const result = await runCase(prisma, previewCase);
      cases.push(result);
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(jsonPath, `${JSON.stringify({ startedAt, partial: true, cases }, null, 2)}\n`, "utf8");
      process.stdout.write(
        `[Board8 Preview] 完成 ${previewCase.id}：${result.status}；日志重开=${result.journal.reopened}\n`
      );
    }
    const smokes = skipSmokes
      ? []
      : await Promise.all([
          runFirstCheckpointSmoke(prisma),
          runLegacyFiveDimensionSmoke(prisma)
        ]);
    const completedAt = new Date().toISOString();
    const evidence: PreviewEvidence = {
      evaluation: IS_GI066
        ? "board8_gi066_fix_thought_only_scripted_deepseek_official_preview"
        : IS_GI064
        ? "board8_gi064_scripted_deepseek_official_preview"
        : IS_GI063
        ? "board8_gi063_scripted_deepseek_official_preview"
        : IS_GI062
        ? "board8_gi062_scripted_deepseek_official_preview"
        : IS_GI061
        ? "board8_gi061_scripted_deepseek_official_preview"
        : IS_GI060
        ? "board8_gi060_scripted_deepseek_official_preview"
        : IS_GI059
          ? "board8_gi059_scripted_deepseek_official_preview"
          : "board8_gi058_deepseek_official_preview",
      candidate: {
        strategyVersion: IS_GI066 ? "5.65.0" : IS_GI064 ? "5.62.0" : IS_GI063 ? "5.61.0" : IS_GI062 ? "5.60.0" : IS_GI061 ? "5.59.0" : IS_GI060 ? "5.58.0" : IS_GI059 ? "5.57.0" : "5.56.0",
        semanticArtifactVersion: IS_GI066
          ? "event-centered-semantic-plan.v17"
          : IS_GI064
          ? "event-centered-semantic-plan.v14"
          : IS_GI063
          ? "event-centered-semantic-plan.v13"
          : IS_GI062
          ? "event-centered-semantic-plan.v12"
          : IS_GI061
          ? "event-centered-semantic-plan.v11"
          : IS_GI060
          ? "event-centered-semantic-plan.v10"
          : IS_GI059
            ? "event-centered-semantic-plan.v9"
            : "event-centered-semantic-plan.v8",
        model: "deepseek-v4-flash",
        provider: "openai",
        baseUrlHost: "api.deepseek.com",
        eventMode: "optional",
        eventStrategy: "generative"
      },
      startedAt,
      completedAt,
      database: previewDatabaseName(),
      rootSessionIds: cases.flatMap((result) => result.rootSessionId ? [result.rootSessionId] : []),
      cases,
      smokes,
      technicalSummary: {
        mainTrajectoriesCompleted: cases.filter((result) => result.status === "passed").length,
        journalLoopsCompleted: cases.filter((result) => result.journal.reopened).length,
        failures: cases.filter((result) => result.status === "failed").length + smokes.filter((smoke) => smoke.status === "failed").length,
        status: cases.every((result) => result.status === "passed") && smokes.every((smoke) => smoke.status === "passed")
          ? "ready_for_board8_audit"
          : "technical_failed"
      }
    };
    await mkdir(outputDirectory, { recursive: true });
    await Promise.all([
      writeFile(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8"),
      writeFile(markdownPath, formatMarkdown(evidence), "utf8")
    ]);
    process.stdout.write(`${JSON.stringify({
      startedAt,
      completedAt,
      outputDirectory,
      jsonPath,
      markdownPath,
      rootSessionIds: evidence.rootSessionIds,
      technicalSummary: evidence.technicalSummary
    }, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
