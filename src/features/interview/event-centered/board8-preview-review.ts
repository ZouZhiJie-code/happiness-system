import type { JournalEventAngle } from "@/types/journal-event-angle-outcome";

/**
 * 本机人工评审只对应这一批已经冻结的 GI-058 Preview 证据。
 * 根会话标识用于从受控 Preview 数据库取回完整材料；它们不会进入只读审计报告。
 */
export const BOARD8_GI058_PREVIEW_REVIEW = {
  candidateId: "gi058-local-preview-v21-candidate-5-56-consolidated",
  candidateLabel: "GI-058｜DeepSeek 官方 API 独立 Preview",
  strategyVersion: "5.56.0",
  promptVersion: "v76-gi058-origin-correction",
  semanticArtifactVersion: "event-centered-semantic-plan.v8",
  previewDatabasePrefix: "happiness_board8_preview_20260803_gi058_",
  routePath: "/preview/board8-gi058-review",
  cases: [
    {
      id: "feeling-1",
      label: "感受 1｜引导复盘",
      material: "真实事件",
      angle: "feeling",
      depth: "引导复盘",
      focus: "问题贴题、认识增量、及时收束",
      rootSessionId: "59fae19e-1514-4ff2-a33c-4742fb27449f"
    },
    {
      id: "feeling-2",
      label: "感受 2｜深聊",
      material: "风控事件",
      angle: "feeling",
      depth: "深聊",
      focus: "说不清后只换一次低负担入口并停下",
      rootSessionId: "69d2b2e6-1e61-4191-8d5d-05d75d5ca6a6"
    },
    {
      id: "thought-1",
      label: "想法 1｜引导复盘",
      material: "风控事件",
      angle: "thought",
      depth: "引导复盘",
      focus: "用户纠正优先，旧理解退出",
      rootSessionId: "a3a21c08-e6db-4c2e-9266-9b90c9615212"
    },
    {
      id: "thought-2",
      label: "想法 2｜深聊",
      material: "真实事件",
      angle: "thought",
      depth: "深聊",
      focus: "判断依据、问停节奏",
      rootSessionId: "7161fb12-bcc1-47f6-bd65-dbf1bb462224"
    },
    {
      id: "relationship-1",
      label: "关系 1｜引导复盘",
      material: "真实事件",
      angle: "relationship",
      depth: "引导复盘",
      focus: "关系期待与事实边界",
      rootSessionId: "b1f0fca2-7a52-46c3-8aa8-1a7e38893a7f"
    },
    {
      id: "relationship-2",
      label: "关系 2｜深聊",
      material: "风控事件",
      angle: "relationship",
      depth: "深聊",
      focus: "两项边界并存、无法排序、停止生效",
      rootSessionId: "8d9e9bcb-a270-4e29-9aea-00d53619025d"
    },
    {
      id: "action-1",
      label: "行动 1｜引导复盘",
      material: "风控事件",
      angle: "action",
      depth: "引导复盘",
      focus: "双事件聚焦、刷新续接、无重复和串线",
      rootSessionId: "47d29d1c-b039-468c-92bc-12afbcdd2c93"
    },
    {
      id: "action-2",
      label: "行动 2｜深聊",
      material: "真实事件",
      angle: "action",
      depth: "深聊",
      focus: "行动作用、阻力或取舍",
      rootSessionId: "37ba3922-cde3-4b44-924b-811a7c94d09d"
    }
  ] as const satisfies readonly Board8PreviewReviewCaseDefinition[]
} as const;

export type Board8PreviewReviewCaseDefinition = {
  id: string;
  label: string;
  material: "真实事件" | "风控事件";
  angle: JournalEventAngle;
  depth: "引导复盘" | "深聊";
  focus: string;
  rootSessionId: string;
};

export type Board8PreviewReviewVerdict = "pass" | "conditional_pass" | "fail";

export type Board8PreviewReviewFinalDecision =
  | "go_generative"
  | "go_baseline"
  | "no_go";

export type Board8PreviewReviewSummary = {
  completedCount: number;
  totalCount: number;
  passCount: number;
  conditionalPassCount: number;
  failCount: number;
  recommendation: "pending" | "go" | "no_go";
};

export type Board8PreviewReviewAccessInput = {
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

export function getBoard8PreviewDatabaseName(databaseUrl?: string) {
  if (!databaseUrl) return null;
  try {
    return decodeURIComponent(new URL(databaseUrl).pathname).replace(/^\//u, "") || null;
  } catch {
    return null;
  }
}

export function isLocalBoard8PreviewHost(input: Pick<Board8PreviewReviewAccessInput, "host" | "forwardedHost">) {
  const forwardedHost = firstHost(input.forwardedHost);
  // 代理明确给出来源主机时，以它为准；避免本机服务被代理到外部域名后仍误开放。
  if (forwardedHost) return LOCAL_HOST_PATTERN.test(forwardedHost);
  return LOCAL_HOST_PATTERN.test(firstHost(input.host));
}

/**
 * 页面只在本机、明确启用且连接命名隔离的 GI-058 Preview 数据库时开放。
 * Vercel Preview 与 Production 都会返回 404，避免完整对话离开受控环境。
 */
export function canOpenBoard8Gi058PreviewReview(input: Board8PreviewReviewAccessInput) {
  if (input.nodeEnv === "production" || input.vercelEnv === "production") return false;
  if (input.reviewEnabled !== "I_UNDERSTAND") return false;
  if (!isLocalBoard8PreviewHost(input)) return false;
  const databaseName = getBoard8PreviewDatabaseName(input.databaseUrl);
  return Boolean(databaseName?.startsWith(BOARD8_GI058_PREVIEW_REVIEW.previewDatabasePrefix));
}

export function summarizeBoard8PreviewReview(
  reviews: Record<string, { verdict: Board8PreviewReviewVerdict | null | undefined } | undefined>,
  totalCount: number = BOARD8_GI058_PREVIEW_REVIEW.cases.length
): Board8PreviewReviewSummary {
  const verdicts = Object.values(reviews).map((review) => review?.verdict).filter(Boolean);
  const passCount = verdicts.filter((verdict) => verdict === "pass").length;
  const conditionalPassCount = verdicts.filter((verdict) => verdict === "conditional_pass").length;
  const failCount = verdicts.filter((verdict) => verdict === "fail").length;
  const completedCount = passCount + conditionalPassCount + failCount;
  const recommendation = completedCount < totalCount
    ? "pending"
    : failCount === 0 && passCount >= 6 && conditionalPassCount <= 2
      ? "go"
      : "no_go";
  return {
    completedCount,
    totalCount,
    passCount,
    conditionalPassCount,
    failCount,
    recommendation
  };
}

export const board8PreviewAngleLabel: Record<JournalEventAngle, string> = {
  feeling: "感受",
  thought: "想法",
  relationship: "关系",
  action: "行动"
};
