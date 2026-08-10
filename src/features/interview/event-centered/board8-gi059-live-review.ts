import type { JournalEventAngle } from "@/types/journal-event-angle-outcome";

export type Board8Gi059ReviewVerdict = "pass" | "conditional_pass" | "fail";
export type Board8Gi059FinalDecision = "go_generative" | "go_baseline" | "no_go";

export type Board8Gi059LiveCase = {
  id: string;
  label: string;
  material: "产品负责人真实事件" | "风控角色卡";
  angle: JournalEventAngle;
  depth: "引导复盘" | "深聊";
  focus: string;
  roleCard: {
    opening: string | null;
    hiddenFacts: string[];
    answerRule: string;
    boundary: string;
  } | null;
};

export const BOARD8_GI059_LIVE_REVIEW = {
  candidateId: "gi064-local-live-preview-v1-candidate-5-62",
  candidateLabel: "GI-064｜真实体验独立 Preview",
  strategyVersion: "5.62.0",
  promptVersion: "2026-08-04.event-centered-generative-v82-gi064-source-placeholder-repair",
  semanticArtifactVersion: "event-centered-semantic-plan.v14",
  previewDatabasePrefix: "happiness_board8_preview_20260803_gi059_",
  routePath: "/preview/board8-gi064-review",
  cases: [
    {
      id: "feeling-real",
      label: "感受 1｜真实事件",
      material: "产品负责人真实事件",
      angle: "feeling",
      depth: "引导复盘",
      focus: "思路解释理解与提问理由；已说清的时刻不再追问",
      roleCard: null
    },
    {
      id: "feeling-risk",
      label: "感受 2｜风控深聊",
      material: "风控角色卡",
      angle: "feeling",
      depth: "深聊",
      focus: "至少一轮有效深聊；认识增量；说不清后的边界处理",
      roleCard: {
        opening: "今天项目会上，我主动说明了进度可能延后。说完后我心里有点发紧。",
        hiddenFacts: ["发紧最明显的时刻是负责人停顿后追问具体日期", "期待被理解，同时担心被看成准备不足"],
        answerRule: "只回答 AI 当前真正提出的问题；问到时刻再说停顿，问到并存感受再说期待与担心。",
        boundary: "遇到复述、抽象套话或童年归因时直接指出；深聊至少回答一个正式问题。"
      }
    },
    {
      id: "thought-risk",
      label: "想法 1｜风控事件",
      material: "风控角色卡",
      angle: "thought",
      depth: "引导复盘",
      focus: "判断依据、纠正优先、严禁复述用户判断",
      roleCard: {
        opening: "我拒绝了一个临时项目，后来又开始怀疑自己是不是太保守。",
        hiddenFacts: ["现有两个项目已经延期", "怀疑主要来自看到同事接手后获得更多决策权"],
        answerRule: "按实际问题披露工作量或决策权；AI 若把怀疑直接写成后悔，明确纠正。",
        boundary: "不接受职业建议，不提前替用户下结论。"
      }
    },
    {
      id: "thought-real",
      label: "想法 2｜真实深聊",
      material: "产品负责人真实事件",
      angle: "thought",
      depth: "深聊",
      focus: "至少一轮有效问答；相对原成果形成新的区分或校准",
      roleCard: null
    },
    {
      id: "relationship-real",
      label: "关系 1｜真实事件",
      material: "产品负责人真实事件",
      angle: "relationship",
      depth: "引导复盘",
      focus: "互动事实、关系期待与来源边界",
      roleCard: null
    },
    {
      id: "relationship-risk",
      label: "关系 2｜风控深聊",
      material: "风控角色卡",
      angle: "relationship",
      depth: "深聊",
      focus: "两项期待并存；至少一轮有效问答；不推测他人动机",
      roleCard: {
        opening: "朋友连续给我发消息，我隔了一会儿才回，他就问我是不是不在乎这件事。",
        hiddenFacts: ["希望对方尊重自己的回复节奏", "也希望沉默不会被直接理解成不在乎"],
        answerRule: "两项期待在对应问题出现时分别披露；如果被要求排序，回答暂时无法排序并继续观察 AI 是否收束。",
        boundary: "不接受对朋友动机或人格的推断；深聊至少回答一个正式问题。"
      }
    },
    {
      id: "action-risk",
      label: "行动 1｜双事件风控",
      material: "风控角色卡",
      angle: "action",
      depth: "引导复盘",
      focus: "两个焦点都可选；聚焦后个人反应只归属当前事件",
      roleCard: {
        opening: "上午我回复了一封很急的催办邮件，下午又反复修改同一份方案。处理邮件时我很烦躁，改方案时我担心一直抓不住重点。",
        hiddenFacts: ["本次请选择第二件：反复修改方案", "改方案时先重排结构，随后反复改标题，正文一直没推进"],
        answerRule: "选择第二个焦点；后续只回答方案事件，观察邮件的烦躁是否被串入。",
        boundary: "不接受把两个事件的反应合并；不讨论未来长期计划。"
      }
    },
    {
      id: "action-real",
      label: "行动 2｜真实深聊",
      material: "产品负责人真实事件",
      angle: "action",
      depth: "深聊",
      focus: "行动作用、阻力或取舍；至少一轮有效问答",
      roleCard: null
    }
  ] as const satisfies readonly Board8Gi059LiveCase[]
} as const;

export function summarizeBoard8Gi059Reviews(
  reviews: Record<string, { verdict?: Board8Gi059ReviewVerdict | null } | undefined>,
  totalCount = BOARD8_GI059_LIVE_REVIEW.cases.length
) {
  const verdicts = Object.values(reviews).map((item) => item?.verdict).filter(Boolean);
  const passCount = verdicts.filter((item) => item === "pass").length;
  const conditionalPassCount = verdicts.filter((item) => item === "conditional_pass").length;
  const failCount = verdicts.filter((item) => item === "fail").length;
  const completedCount = passCount + conditionalPassCount + failCount;
  return {
    completedCount,
    totalCount,
    passCount,
    conditionalPassCount,
    failCount,
    recommendation: completedCount < totalCount
      ? "pending" as const
      : failCount === 0 && passCount >= 6 && conditionalPassCount <= 2
        ? "go" as const
        : "no_go" as const
  };
}

type AccessInput = {
  nodeEnv?: string;
  vercelEnv?: string;
  host?: string | null;
  forwardedHost?: string | null;
  databaseUrl?: string;
  reviewEnabled?: string;
};

const LOCAL_HOST_PATTERN = /^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$|^\[::1\](?::\d{1,5})?$/iu;

function firstHost(value: string | null | undefined) {
  return value?.split(",")[0]?.trim() ?? "";
}

export function canOpenBoard8Gi059LiveReview(input: AccessInput) {
  if (input.nodeEnv === "production" || input.vercelEnv === "production") return false;
  if (input.reviewEnabled !== "I_UNDERSTAND") return false;
  const host = firstHost(input.forwardedHost) || firstHost(input.host);
  if (!LOCAL_HOST_PATTERN.test(host)) return false;
  try {
    const databaseName = decodeURIComponent(new URL(input.databaseUrl ?? "").pathname)
      .replace(/^\//u, "");
    return databaseName.startsWith(BOARD8_GI059_LIVE_REVIEW.previewDatabasePrefix);
  } catch {
    return false;
  }
}
