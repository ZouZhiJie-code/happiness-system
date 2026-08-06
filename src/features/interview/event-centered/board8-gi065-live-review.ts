import type { Board8Gi059LiveCase } from "@/features/interview/event-centered/board8-gi059-live-review";

export type Board8Gi065ReviewVerdict = "pass" | "conditional_pass" | "fail";

export const BOARD8_GI065_LIVE_REVIEW = {
  candidateId: "gi065-thought-only-live-preview-v1-candidate-5-63",
  candidateLabel: "GI-065｜理清想法单角度可信 Preview",
  strategyVersion: "5.63.0",
  promptVersion: "2026-08-04.event-centered-thought-pilot-v83-gi065",
  semanticArtifactVersion: "event-centered-semantic-plan.v15",
  previewDatabasePrefix: "happiness_board8_preview_20260804_gi065_",
  routePath: "/preview/board8-gi065-review",
  allowBaselineDecision: false,
  requiredPassCount: 3,
  maxConditionalPassCount: 1,
  cases: [
    {
      id: "thought-real-auto-entry",
      label: "真实事件 1｜自动进入与答案去重",
      material: "产品负责人真实事件",
      angle: "thought",
      depth: "引导复盘",
      focus: "素材齐全后自动进入；已有判断或依据不重复问；形成阶段成果后开放继续",
      roleCard: null
    },
    {
      id: "thought-real-second-direction",
      label: "真实事件 2｜第二个认识方向",
      material: "产品负责人真实事件",
      angle: "thought",
      depth: "深聊",
      focus: "完成第一个判断方向后自然继续；建立新微目标；每个方向最多三个具体问题",
      roleCard: null
    },
    {
      id: "thought-risk-correction",
      label: "风控事件 1｜纠正后继续",
      material: "风控角色卡",
      angle: "thought",
      depth: "深聊",
      focus: "纠正旧理解、撤销受影响成果、继续问真正缺失的判断依据",
      roleCard: {
        opening: "今天我拒绝了一个临时项目，后来又怀疑自己是不是太保守。我当时有点内疚。",
        hiddenFacts: [
          "现有两个项目已经延期，这是拒绝时最直接的依据",
          "看到同事接手后获得更多决策权，才开始怀疑当时的判断",
          "如果 AI 把怀疑理解成后悔，明确纠正：我仍认可拒绝，只是在重新看机会成本"
        ],
        answerRule: "只回答 AI 当前提出的问题；相关问题出现时再披露工作量、决策权和纠正内容。",
        boundary: "纠正后必须继续评估新事实；不接受职业建议、人格判断或直接结束。"
      }
    },
    {
      id: "thought-risk-evidence-tension",
      label: "风控事件 2｜证据张力与停止",
      material: "风控角色卡",
      angle: "thought",
      depth: "深聊",
      focus: "两组依据并存、暂时无法排序、开放转场和明确停止",
      roleCard: {
        opening: "今天我没有马上答应朋友的合作邀请。我觉得谨慎一点更稳妥，但又担心自己错过机会。",
        hiddenFacts: [
          "支持接受的证据是对方已经拿到一个明确客户",
          "支持等待的证据是分工和收益分配仍没有说清",
          "两组证据暂时无法排序"
        ],
        answerRule: "按实际问题逐项披露两组证据；被要求排序时回答暂时无法排序；阶段成果后再输入一句继续。",
        boundary: "观察系统能否开启新方向；最后明确说停止，AI 必须停止追问并保留日志入口。"
      }
    }
  ] as const satisfies readonly Board8Gi059LiveCase[]
} as const;

export function summarizeBoard8Gi065Reviews(
  reviews: Record<string, { verdict?: Board8Gi065ReviewVerdict | null } | undefined>
) {
  const verdicts = Object.values(reviews).map((item) => item?.verdict).filter(Boolean);
  const passCount = verdicts.filter((item) => item === "pass").length;
  const conditionalPassCount = verdicts.filter((item) => item === "conditional_pass").length;
  const failCount = verdicts.filter((item) => item === "fail").length;
  const completedCount = passCount + conditionalPassCount + failCount;
  const totalCount = BOARD8_GI065_LIVE_REVIEW.cases.length;
  return {
    completedCount,
    totalCount,
    passCount,
    conditionalPassCount,
    failCount,
    recommendation: completedCount < totalCount
      ? "pending" as const
      : failCount === 0 && passCount >= 3 && conditionalPassCount <= 1
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

export function canOpenBoard8Gi065LiveReview(input: AccessInput) {
  if (input.nodeEnv === "production" || input.vercelEnv === "production") return false;
  if (input.reviewEnabled !== "I_UNDERSTAND") return false;
  const host = (input.forwardedHost ?? input.host ?? "").split(",")[0]?.trim() ?? "";
  if (!LOCAL_HOST_PATTERN.test(host)) return false;
  try {
    const databaseName = decodeURIComponent(new URL(input.databaseUrl ?? "").pathname)
      .replace(/^\//u, "");
    return databaseName.startsWith(BOARD8_GI065_LIVE_REVIEW.previewDatabasePrefix);
  } catch {
    return false;
  }
}
