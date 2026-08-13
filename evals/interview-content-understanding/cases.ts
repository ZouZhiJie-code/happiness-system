import type {
  AnswerState,
  EventRelation,
  MaterialStatus,
  MaterialUpdateAction
} from "@/features/interview/content-understanding";
import type { InterviewDimension } from "@/types/interview";

export interface ContentUnderstandingEvalCase {
  id: string;
  dimension: InterviewDimension;
  category: string;
  previousQuestion: string;
  priorFacts: string[];
  rawText: string;
  expected: {
    answerState: AnswerState;
    acceptedFacts: string[];
    pendingFacts: string[];
    retractedFacts: string[];
    excludedFacts: string[];
    materialStatus: MaterialStatus | null;
    relations: EventRelation[];
    updateAction: MaterialUpdateAction | null;
    candidateDimension: InterviewDimension | null;
    continuity: "normal" | "resume" | "replay" | "provider_fallback";
  };
}

interface DimensionFixture {
  dimension: InterviewDimension;
  previousQuestion: string;
  scene: string;
  detail: string;
  reason: string;
  replacement: string;
  linked: string;
  candidate: string;
  incidental: string;
  shortAnswer: string;
  crossText: string;
  crossDimension: InterviewDimension;
}

const dimensions: DimensionFixture[] = [
  {
    dimension: "joy",
    previousQuestion: "那个瞬间具体发生了什么？",
    scene: "午休时和同事聊了十分钟",
    detail: "她讲了一个特别荒诞的项目插曲",
    reason: "那种突然的好笑让我从疲惫里松下来",
    replacement: "真正让我开心的是她说话时那个夸张的停顿",
    linked: "上周一直加班，所以这十分钟显得格外轻松",
    candidate: "晚上沿着河边散了半小时步",
    incidental: "顺路买了一瓶水",
    shortAnswer: "就是她那个停顿",
    crossText: "我还发现下次开会前应该先列三条重点",
    crossDimension: "improvement"
  },
  {
    dimension: "fulfillment",
    previousQuestion: "今天哪件事让你觉得真的往前走了一步？",
    scene: "下午把拖了两周的方案交出去了",
    detail: "我把最难的预算部分重新算清楚了",
    reason: "终于从反复犹豫变成了一份能讨论的版本",
    replacement: "真正有推进的是我把关键数据核对完了",
    linked: "前两次都卡在预算上，所以这次核对完成很关键",
    candidate: "晚上帮朋友梳理了求职选择",
    incidental: "打印时换了一盒墨",
    shortAnswer: "预算终于算清了",
    crossText: "朋友认真听完我的顾虑，还帮我画了选择表",
    crossDimension: "gratitude"
  },
  {
    dimension: "reflection",
    previousQuestion: "哪个具体细节让你开始重新想这件事？",
    scene: "开会时我发现大家理解的目标完全不同",
    detail: "同一句需求被三个人解释成了三个方向",
    reason: "我意识到自己过去把听见当成了理解",
    replacement: "真正改变判断的是大家复述出来的目标都不一样",
    linked: "上次项目返工也出现过同样的目标偏差",
    candidate: "回家路上和母亲聊了最近的压力",
    incidental: "会议室的空调有点冷",
    shortAnswer: "三个人复述得都不一样",
    crossText: "下次我会先请每个人用一句话复述目标",
    crossDimension: "improvement"
  },
  {
    dimension: "improvement",
    previousQuestion: "当时最想调整的具体卡点是什么？",
    scene: "上午汇报时我急着回答，漏听了问题后半句",
    detail: "对方追问后我才发现答偏了",
    reason: "真正的卡点是我一紧张就抢着组织答案",
    replacement: "需要调整的是回答前先复述问题，不是准备更多材料",
    linked: "上次面试时也因为急着回答漏掉了限制条件",
    candidate: "下午先列重点再写材料，节奏很稳",
    incidental: "中途换了一个会议室",
    shortAnswer: "我答得太快了",
    crossText: "对方后来耐心把问题重新说了一遍",
    crossDimension: "gratitude"
  },
  {
    dimension: "gratitude",
    previousQuestion: "当时对方具体做了什么？",
    scene: "同事看我忙不过来，主动接走了数据核对",
    detail: "她还把核对结果按我习惯的格式整理好了",
    reason: "她看见了我快撑不住，又没有让我反复解释",
    replacement: "真正让我感谢的是她先问清优先级再接走任务",
    linked: "上周我曾提过最怕临时任务全部挤在一起",
    candidate: "晚上父亲打电话问我有没有按时吃饭",
    incidental: "她递给我一支笔",
    shortAnswer: "她接走了数据核对",
    crossText: "我发现自己遇到压力时总会先硬撑着不求助",
    crossDimension: "reflection"
  }
];

type ScenarioBuilder = (fixture: DimensionFixture) => Omit<ContentUnderstandingEvalCase, "id" | "dimension" | "previousQuestion">;

function expected(
  input: Partial<ContentUnderstandingEvalCase["expected"]> &
    Pick<ContentUnderstandingEvalCase["expected"], "answerState">
): ContentUnderstandingEvalCase["expected"] {
  return {
    acceptedFacts: [],
    pendingFacts: [],
    retractedFacts: [],
    excludedFacts: [],
    materialStatus: null,
    relations: [],
    updateAction: null,
    candidateDimension: null,
    continuity: "normal",
    ...input
  };
}

const scenarios: Array<{ category: string; build: ScenarioBuilder }> = [
  {
    category: "single_event_complete",
    build: (f) => ({
      category: "single_event_complete",
      priorFacts: [],
      rawText: `${f.scene}，${f.reason}。`,
      expected: expected({
        answerState: "answered",
        acceptedFacts: [f.scene, f.reason],
        materialStatus: "explicit_confirmed",
        relations: ["current_detail"],
        updateAction: "add"
      })
    })
  },
  {
    category: "contextual_short_answer",
    build: (f) => ({
      category: "contextual_short_answer",
      priorFacts: [],
      rawText: f.shortAnswer,
      expected: expected({
        answerState: "answered",
        acceptedFacts: [f.shortAnswer],
        materialStatus: "contextual_confirmed",
        relations: ["current_detail"],
        updateAction: "add"
      })
    })
  },
  {
    category: "content_plus_generate",
    build: (f) => ({
      category: "content_plus_generate",
      priorFacts: [f.scene],
      rawText: `${f.reason}，直接生成日志吧。`,
      expected: expected({
        answerState: "answered",
        acceptedFacts: [f.reason],
        excludedFacts: ["直接生成日志吧"],
        materialStatus: "explicit_confirmed",
        relations: ["current_detail"],
        updateAction: "add"
      })
    })
  },
  {
    category: "content_plus_stop",
    build: (f) => ({
      category: "content_plus_stop",
      priorFacts: [f.scene],
      rawText: `${f.reason}，先别再追问了。`,
      expected: expected({
        answerState: "answered",
        acceptedFacts: [f.reason],
        excludedFacts: ["先别再追问了"],
        materialStatus: "explicit_confirmed",
        relations: ["current_detail"],
        updateAction: "add"
      })
    })
  },
  {
    category: "supplement",
    build: (f) => ({
      category: "supplement",
      priorFacts: [f.scene],
      rawText: `补充一下，${f.detail}。`,
      expected: expected({
        answerState: "answered",
        acceptedFacts: [f.scene, f.detail],
        materialStatus: "explicit_confirmed",
        relations: ["current_detail"],
        updateAction: "refine"
      })
    })
  },
  {
    category: "explicit_correction",
    build: (f) => ({
      category: "explicit_correction",
      priorFacts: [f.reason],
      rawText: `刚才说得不准确，${f.replacement}。`,
      expected: expected({
        answerState: "answered",
        acceptedFacts: [f.replacement],
        retractedFacts: [f.reason],
        materialStatus: "explicit_confirmed",
        relations: ["current_detail"],
        updateAction: "replace"
      })
    })
  },
  {
    category: "ambiguous_conflict",
    build: (f) => ({
      category: "ambiguous_conflict",
      priorFacts: [f.reason],
      rawText: `也许更接近${f.replacement}，我还没想清。`,
      expected: expected({
        answerState: "uncertain",
        pendingFacts: [f.replacement],
        materialStatus: "pending_inference",
        relations: ["current_detail"],
        updateAction: "refine"
      })
    })
  },
  {
    category: "explicit_absence",
    build: () => ({
      category: "explicit_absence",
      priorFacts: [],
      rawText: "确实没有。",
      expected: expected({ answerState: "explicit_absence" })
    })
  },
  {
    category: "recall_unavailable",
    build: () => ({
      category: "recall_unavailable",
      priorFacts: [],
      rawText: "我一时想不起来。",
      expected: expected({ answerState: "recall_unavailable" })
    })
  },
  {
    category: "uncertain",
    build: () => ({
      category: "uncertain",
      priorFacts: [],
      rawText: "我现在还不确定。",
      expected: expected({ answerState: "uncertain" })
    })
  },
  {
    category: "declined",
    build: () => ({
      category: "declined",
      priorFacts: [],
      rawText: "这部分我不太想说，先跳过。",
      expected: expected({ answerState: "declined" })
    })
  },
  {
    category: "current_event_detail",
    build: (f) => ({
      category: "current_event_detail",
      priorFacts: [],
      rawText: `${f.scene}。${f.detail}。`,
      expected: expected({
        answerState: "answered",
        acceptedFacts: [f.scene, f.detail],
        materialStatus: "explicit_confirmed",
        relations: ["current_detail"],
        updateAction: "add"
      })
    })
  },
  ...(["cause", "consequence", "contrast", "example"] as const).map((relationship) => ({
    category: `linked_${relationship}`,
    build: ((f: DimensionFixture) => ({
      category: `linked_${relationship}`,
      priorFacts: [f.scene],
      rawText: `${f.linked}。`,
      expected: expected({
        answerState: "answered",
        acceptedFacts: [f.linked],
        materialStatus: "explicit_confirmed",
        relations: ["linked_scene"],
        updateAction: "add"
      })
    })) satisfies ScenarioBuilder
  })),
  {
    category: "candidate_event",
    build: (f) => ({
      category: "candidate_event",
      priorFacts: [f.scene],
      rawText: `另外，${f.candidate}。`,
      expected: expected({
        answerState: "unaddressed",
        acceptedFacts: [f.candidate],
        materialStatus: "explicit_confirmed",
        relations: ["candidate_event"],
        updateAction: "add",
        candidateDimension: f.dimension
      })
    })
  },
  {
    category: "incidental",
    build: (f) => ({
      category: "incidental",
      priorFacts: [f.scene],
      rawText: `${f.scene}，${f.incidental}。`,
      expected: expected({
        answerState: "answered",
        acceptedFacts: [f.scene],
        excludedFacts: [f.incidental],
        materialStatus: "explicit_confirmed",
        relations: ["current_detail", "incidental"],
        updateAction: "add"
      })
    })
  },
  {
    category: "cross_dimension",
    build: (f) => ({
      category: "cross_dimension",
      priorFacts: [f.scene],
      rawText: `${f.crossText}。`,
      expected: expected({
        answerState: "unaddressed",
        acceptedFacts: [f.crossText],
        materialStatus: "explicit_confirmed",
        relations: ["candidate_event"],
        updateAction: "add",
        candidateDimension: f.crossDimension
      })
    })
  },
  {
    category: "interruption_resume",
    build: (f) => ({
      category: "interruption_resume",
      priorFacts: [f.scene],
      rawText: `继续刚才那件事，${f.detail}。`,
      expected: expected({
        answerState: "answered",
        acceptedFacts: [f.scene, f.detail],
        materialStatus: "explicit_confirmed",
        relations: ["current_detail"],
        updateAction: "refine",
        continuity: "resume"
      })
    })
  },
  {
    category: "same_turn_replay",
    build: (f) => ({
      category: "same_turn_replay",
      priorFacts: [f.scene],
      rawText: f.detail,
      expected: expected({
        answerState: "answered",
        acceptedFacts: [f.scene, f.detail],
        materialStatus: "explicit_confirmed",
        relations: ["current_detail"],
        updateAction: "keep",
        continuity: "replay"
      })
    })
  },
  {
    category: "provider_failure",
    build: (f) => ({
      category: "provider_failure",
      priorFacts: [],
      rawText: `${f.scene}。`,
      expected: expected({
        answerState: "answered",
        acceptedFacts: [f.scene],
        materialStatus: "explicit_confirmed",
        relations: ["current_detail"],
        updateAction: "add",
        continuity: "provider_fallback"
      })
    })
  },
  {
    category: "multi_information_split",
    build: (f) => ({
      category: "multi_information_split",
      priorFacts: [],
      rawText: `${f.scene}。${f.detail}。${f.reason}。`,
      expected: expected({
        answerState: "answered",
        acceptedFacts: [f.scene, f.detail, f.reason],
        materialStatus: "explicit_confirmed",
        relations: ["current_detail"],
        updateAction: "add"
      })
    })
  },
  {
    category: "quoted_control_as_content",
    build: (f) => ({
      category: "quoted_control_as_content",
      priorFacts: [],
      rawText: `对方当时说“这件事结束吧”，后来${f.scene}。`,
      expected: expected({
        answerState: "answered",
        acceptedFacts: [`对方当时说“这件事结束吧”`, f.scene],
        materialStatus: "explicit_confirmed",
        relations: ["current_detail"],
        updateAction: "add"
      })
    })
  }
];

export const contentUnderstandingEvalCases: ContentUnderstandingEvalCase[] = dimensions.flatMap(
  (fixture) =>
    scenarios.map(({ category, build }, index) => ({
      id: `CU-${fixture.dimension.toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
      dimension: fixture.dimension,
      previousQuestion: fixture.previousQuestion,
      ...build(fixture),
      category
    }))
);

export const CONTENT_UNDERSTANDING_EVAL_CASE_COUNT = contentUnderstandingEvalCases.length;
