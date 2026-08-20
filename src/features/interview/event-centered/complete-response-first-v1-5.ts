import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_4_RUNTIME,
  alignEventCenteredCompleteResponseFirstV14Policy,
  createEventCenteredCompleteResponseFirstV14Envelope,
  extractEventCenteredCompleteResponseFirstV14QuestionFocus,
  observeEventCenteredCompleteResponseFirstV14Text,
  projectEventCenteredCompleteResponseFirstV14Turn,
  validateEventCenteredCompleteResponseFirstV14Output
} from "@/features/interview/event-centered/complete-response-first-v1-4";
import type {
  EventCenteredCompleteResponseFirstV12Input
} from "@/features/interview/event-centered/complete-response-first-v1-2";

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_5_STRATEGY =
  "complete_response_v1_5" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_5_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-5-semantic-layer-coverage" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_5_PROMPT_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-5-semantic-layer-coverage-prompt-v1" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_5_RUNTIME =
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_4_RUNTIME;

export const extractEventCenteredCompleteResponseFirstV15QuestionFocus =
  extractEventCenteredCompleteResponseFirstV14QuestionFocus;

export const createEventCenteredCompleteResponseFirstV15Envelope =
  createEventCenteredCompleteResponseFirstV14Envelope;

export const validateEventCenteredCompleteResponseFirstV15Output =
  validateEventCenteredCompleteResponseFirstV14Output;

export const projectEventCenteredCompleteResponseFirstV15Turn =
  projectEventCenteredCompleteResponseFirstV14Turn;

export const observeEventCenteredCompleteResponseFirstV15Text =
  observeEventCenteredCompleteResponseFirstV14Text;

export function buildEventCenteredCompleteResponseFirstV15Messages(
  input: EventCenteredCompleteResponseFirstV12Input
) {
  const recentTurns = input.recentTurns.slice(-8).map((turn) => ({
    user: turn.user,
    assistantMessageId: turn.assistantMessageId ?? null,
    assistantResponse: turn.assistantResponse ?? [
      turn.assistantUnderstanding,
      turn.assistantQuestion
    ].filter(Boolean).join("\n")
  }));
  return [
    {
      role: "system" as const,
      content: [
        "你负责 Daily Light【陪我聊】本轮唯一一条用户可见回应。只输出最终中文回应，不输出 JSON、计划、检查过程、字段名、Markdown 或额外说明。",
        "输出前在内部严格按顺序完成六步，但不要展示这些步骤：",
        "1. 当前动作：判断用户最新一句要你承接、继续、深挖、停止、切换还是整理，并优先兑现这个动作。",
        "2. 全文盘点：通读 currentUserText、recentTurns 和 effectiveFacts，列出用户已经明确说出的内容与助手已经问过的问题。",
        "3. 信息层覆盖：把用户内容按八层盘点：事件与触发；感受与身体反应；想法、判断与解释；需要、价值与期待；行为与回应；关系位置与意义；变化、规律与例外；影响与下一步。",
        "4. 覆盖规则：用户已经清楚回答某一层时，这一层视为已覆盖。换成更细、近义、换时间措辞或二选一，仍属于同一已覆盖层，不能算新增信息。先用全部有效原文回答候选问题；能够回答或大部分已经回答时删除它。",
        "5. 新目标：只选择一个尚未回答、与用户当前动作直接相关、答案会带来新进展且容易回答的信息层。找不到高价值新层时自然承接或结束，不为维持轮次硬问。",
        "6. 依据：承接和陈述只自然转述用户明确表达的内容。原因、因果、动机、心理目标和第三方心理缺少直接原文时不能写成结论；确有价值时只能成为本轮唯一可纠正问题，而且必须属于未覆盖层。",
        "用户要求继续或深挖时，用一句短过渡直接进入新层。上一条助手已经承接纠正时，不再完整复述、解释或评价这次纠正。",
        "回应使用一至两个短段落，语言自然、忠实、具体。问题可以由一个或几个紧密相连的问句组成，但只能要求用户围绕一个焦点作答。",
        "用户明确停止时立即收住并零提问。用户表达负担但仍想继续时，提供一个容易回答的入口。",
        "自然转述允许改变措辞，但不能改变事实强度。解释价值不足时直接省略。"
      ].join("\n")
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        currentUserText: input.rawText,
        correctionRequested: Boolean(input.correctionRequested),
        correctionTargetAssistantMessageId:
          input.correctionTargetAssistantMessageId ?? null,
        phase: input.phase,
        activeAngle: input.activeAngle,
        currentQuestion: input.currentQuestion,
        currentQuestionTarget: input.currentQuestionTarget,
        currentMicrogoal: input.microgoal,
        effectiveFacts: input.facts.map((fact) => ({
          id: fact.id,
          statement: fact.statement,
          kind: fact.kind,
          stance: fact.stance
        })),
        recentTurns
      })
    }
  ];
}

export function alignEventCenteredCompleteResponseFirstV15Policy(
  input: Parameters<typeof alignEventCenteredCompleteResponseFirstV14Policy>[0]
) {
  const aligned = alignEventCenteredCompleteResponseFirstV14Policy(input);
  return {
    ...aligned,
    nextState: {
      ...aligned.nextState,
      strategyVersion: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_5_VERSION
    }
  };
}
