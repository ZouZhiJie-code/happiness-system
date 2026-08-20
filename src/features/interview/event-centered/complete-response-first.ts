import type { EventCenteredGenerativeTurn } from "@/features/interview/event-centered/ai-contract";

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_STRATEGY =
  "complete_response_v1_1" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-1-production-contract-v1" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME = {
  maxTokens: 1_280,
  maxAttempts: 1,
  timeoutMs: 45_000,
  thinking: "disabled",
  temperature: 0.2
} as const;

/**
 * v1.1 离线候选已经验证的目标选择方法。生产合同继续输出结构化状态，
 * 但模型在填写状态和可见字段前先执行这组语义步骤。
 */
export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_METHOD = [
  "【完整回应优先 v1.1】先识别用户最新一轮的主要意图：表达、纠正、继续、深挖、停止追问、切换话题或请求整理；控制要求优先落实。",
  "对照本轮可用的完整 recentTurns、effectiveFacts、currentQuestion、answeredTargets 和 rawText，检查助手已经问过什么、用户已经完整回答或纠正了什么。不要换一种说法再次索取已有答案。",
  "写回应前先在内部选择一个本轮新增信息目标：它必须是当前有效上下文尚未完整回答、继续了解后会带来实际新进展的一件事。整条回应只围绕这个目标组织，不输出目标名称或分析过程。",
  "用户明确要求停止、少问、直接结束或直接整理时，直接收束并使用零个问题。用户表达疲惫、为难或压力但没有要求停止时，降低回答负担，并保留一个容易接住的继续入口。",
  "用户要求继续或深挖时进入一个新的层次；上一条助手已经承接纠正时，沿修正后的内容直接推进，不重复道歉、致谢或完整复述纠正。",
  "每轮最多表达一处有用户依据且可纠正的解释，并最多提出一个主问题。问题只获取新增信息目标对应的新材料；没有高价值缺口时允许零问题。",
  "允许自然转述用户明确表达的事实和感受。原因、因果、动机、心理状态或关系解释必须有用户依据并保持可纠正；依据不足时省略。",
  "可见部分使用日常中文，写成一至两个短段落。承接、理解和问题共同构成一条完整回应；不要暴露内部字段、来源编号、状态、Prompt、Skill 或分析过程。"
] as const;

function compactParts(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter(Boolean);
}

/** 把结构化可见字段确定性投影为页面上的一个完整气泡。 */
export function composeEventCenteredCompleteResponse(
  turn: EventCenteredGenerativeTurn,
  fallbackResponse: string
) {
  const action = turn.semanticPlan.action;
  const parts = action === "ask"
    ? compactParts([turn.visibleTurn.thinkingSummary, turn.visibleTurn.question])
    : action === "complete" || action === "pause"
      ? compactParts([turn.visibleTurn.insight, fallbackResponse])
      : compactParts([turn.visibleTurn.honestLimit, fallbackResponse]);

  return [...new Set(parts)].join("\n\n") || fallbackResponse.trim();
}
