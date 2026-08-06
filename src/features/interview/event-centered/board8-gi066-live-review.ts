import type { Board8Gi059LiveCase } from "@/features/interview/event-centered/board8-gi059-live-review";

export type Board8Gi066ReviewVerdict = "pass" | "conditional_pass" | "fail";

export const BOARD8_GI066_LIVE_REVIEW = {
  candidateId: "gi066-thought-map-live-preview-v2-candidate-5-65",
  candidateLabel: "GI-066｜第一轮阻断修复后的理清想法可信 Preview",
  strategyVersion: "5.65.0",
  promptVersion: "2026-08-04.event-centered-thought-pilot-v85-gi066-fix",
  semanticArtifactVersion: "event-centered-semantic-plan.v17",
  previewDatabasePrefix: "happiness_board8_preview_20260804_gi066_fix_",
  routePath: "/preview/board8-gi066-review",
  allowBaselineDecision: false,
  requiredPassCount: 3,
  maxConditionalPassCount: 1,
  cases: [
    {
      id: "thought-real-map-auto-entry",
      label: "真实事件 1｜自动进入与已有答案去重",
      material: "产品负责人真实事件",
      angle: "thought",
      depth: "引导复盘",
      focus: "素材齐全后自动进入；系统补真正缺失的判断关系；已有答案不得换词重问",
      roleCard: null
    },
    {
      id: "thought-real-multiple-directions",
      label: "真实事件 2｜连续两个认识方向",
      material: "产品负责人真实事件",
      angle: "thought",
      depth: "深聊",
      focus: "判断标准后继续进入有依据的第二方向；每方向最多三问；形成可核验认识增量",
      roleCard: null
    },
    {
      id: "thought-risk-correction-replan",
      label: "风控事件 1｜纠正失效与重新选题",
      material: "风控角色卡",
      angle: "thought",
      depth: "深聊",
      focus: "旧事实、旧关系和旧成果退出；纠正后继续提出基于新理解的问题",
      roleCard: {
        opening: "今天我拒绝了一个临时项目，后来又怀疑自己是不是太保守。现有工作会被挤掉，是我当时拒绝的依据。",
        hiddenFacts: [
          "看到同事接手后获得更多决策权，才开始重新评估机会成本",
          "需要纠正：我仍认可拒绝这个决定，只是发现自己低估了决策权的价值",
          "纠正后愿意讨论什么条件会改变下一次的判断"
        ],
        answerRule: "只回答 AI 当前问题；问题涉及新证据时披露决策权；随后主动纠正旧理解。",
        boundary: "纠正后必须重新规划并继续；旧后悔结论不得再次出现。"
      }
    },
    {
      id: "thought-risk-tension-boundary",
      label: "风控事件 2｜证据张力、说不清与停止",
      material: "风控角色卡",
      angle: "thought",
      depth: "深聊",
      focus: "双侧证据进入张力；说不清只低负担重问一次；关闭方向、开放转场和停止生效",
      roleCard: {
        opening: "今天我没有马上答应朋友的合作邀请。对方已经有明确客户，但分工和收益还没说清，我拿不准现在要不要加入。",
        hiddenFacts: [
          "接受和等待各有一条明确证据",
          "被要求立即排序时连续两次回答说不清",
          "开放转场出现后明确说停止"
        ],
        answerRule: "按实际问题回答；同一方向第一次和第二次都明确说不清；开放转场后说停止。",
        boundary: "第二次说不清后当前方向必须关闭；停止后不得新增问题或成果。"
      }
    }
  ] as const satisfies readonly Board8Gi059LiveCase[]
} as const;

export function summarizeBoard8Gi066Reviews(
  reviews: Record<string, { verdict?: Board8Gi066ReviewVerdict | null } | undefined>
) {
  const verdicts = Object.values(reviews).map((item) => item?.verdict).filter(Boolean);
  const passCount = verdicts.filter((item) => item === "pass").length;
  const conditionalPassCount = verdicts.filter((item) => item === "conditional_pass").length;
  const failCount = verdicts.filter((item) => item === "fail").length;
  const completedCount = passCount + conditionalPassCount + failCount;
  const totalCount = BOARD8_GI066_LIVE_REVIEW.cases.length;
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

export function canOpenBoard8Gi066LiveReview(input: AccessInput) {
  if (input.nodeEnv === "production" || input.vercelEnv === "production") return false;
  if (input.reviewEnabled !== "I_UNDERSTAND") return false;
  const host = (input.forwardedHost ?? input.host ?? "").split(",")[0]?.trim() ?? "";
  if (!LOCAL_HOST_PATTERN.test(host)) return false;
  try {
    const databaseName = decodeURIComponent(new URL(input.databaseUrl ?? "").pathname)
      .replace(/^\//u, "");
    return databaseName.startsWith(BOARD8_GI066_LIVE_REVIEW.previewDatabasePrefix);
  } catch {
    return false;
  }
}
