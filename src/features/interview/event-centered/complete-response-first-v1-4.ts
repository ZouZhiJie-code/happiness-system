import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_3_RUNTIME,
  validateEventCenteredCompleteResponseFirstV13Text
} from "@/features/interview/event-centered/complete-response-first-v1-3";
import {
  alignEventCenteredCompleteResponseFirstV12Policy,
  projectEventCenteredCompleteResponseFirstV12Turn,
  validateEventCenteredCompleteResponseFirstV12Output,
  type EventCenteredCompleteResponseFirstV12Input,
  type EventCenteredCompleteResponseFirstV12Output
} from "@/features/interview/event-centered/complete-response-first-v1-2";

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_4_STRATEGY =
  "complete_response_v1_4" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_4_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-4-grounded-intent-owner" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_4_PROMPT_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-4-grounded-intent-prompt-v1" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_4_RUNTIME =
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_3_RUNTIME;

const EXPLICIT_STOP_PATTERN =
  /(?:不想回答|不想答|不想继续|想停下来|要停下来|不继续聊|先停|别问了|不要再问|不聊了|不用再追问|收在这里|到这里就好|先到这里|暂时不想说|暂时不想聊)/u;

function questionMarkCount(value: string) {
  return [...value].filter(
    (character) => character === "?" || character === "？"
  ).length;
}
/**
 * 多个连续问句可以共同服务一个回答焦点。程序只保存该连续片段，
 * 是否真的同焦点继续交给原文评审。
 */
export function extractEventCenteredCompleteResponseFirstV14QuestionFocus(
  response: string
) {
  const normalized = response.trim();
  const firstQuestion = normalized.search(/[？?]/u);
  if (firstQuestion < 0) return null;
  const lastQuestion = Math.max(
    normalized.lastIndexOf("？"),
    normalized.lastIndexOf("?")
  );
  const before = normalized.slice(0, firstQuestion);
  const questionStart = Math.max(
    before.lastIndexOf("。"),
    before.lastIndexOf("！"),
    before.lastIndexOf("!"),
    before.lastIndexOf("\n")
  );
  return normalized
    .slice(questionStart + 1, lastQuestion + 1)
    .trim()
    .replace(/^[，,：:；;]+/u, "");
}

export function createEventCenteredCompleteResponseFirstV14Envelope(input: {
  generationInput: EventCenteredCompleteResponseFirstV12Input;
  response: string;
}): EventCenteredCompleteResponseFirstV12Output {
  const response = input.response.trim();
  const explicitStop = EXPLICIT_STOP_PATTERN.test(
    input.generationInput.rawText.trim()
  );
  const question = explicitStop
    ? null
    : extractEventCenteredCompleteResponseFirstV14QuestionFocus(response);
  const correction = Boolean(
    input.generationInput.correctionRequested &&
    input.generationInput.correctionTargetAssistantMessageId
  );
  return {
    response,
    interaction: {
      kind: explicitStop ? "stop" : question ? "ask" : "respond",
      question
    },
    facts: [],
    correction: correction
      ? {
          kind: "correction",
          supersededAssistantMessageId:
            input.generationInput.correctionTargetAssistantMessageId ?? null
        }
      : { kind: "none", supersededAssistantMessageId: null }
  };
}

const QUESTION_COUNT_OBSERVATION_ONLY = new Set([
  "VISIBLE_RESPONSE_MULTIPLE_QUESTIONS",
  "VISIBLE_RESPONSE_MUST_HAVE_ONE_QUESTION",
  "NON_ASK_VISIBLE_RESPONSE_MUST_HAVE_ZERO_QUESTIONS"
]);

export function validateEventCenteredCompleteResponseFirstV14Output(input: {
  generationInput: EventCenteredCompleteResponseFirstV12Input;
  response: string;
}) {
  const envelope = createEventCenteredCompleteResponseFirstV14Envelope(input);
  return [...new Set([
    ...validateEventCenteredCompleteResponseFirstV13Text(input),
    ...validateEventCenteredCompleteResponseFirstV12Output({
      generationInput: input.generationInput,
      output: envelope
    })
  ].filter((issue) => !QUESTION_COUNT_OBSERVATION_ONLY.has(issue)))];
}

export function buildEventCenteredCompleteResponseFirstV14Messages(
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
        "输出前在内部严格按顺序完成五步，但不要展示这些步骤：",
        "1. 意图：判断用户最新一句要你承接、继续、深挖、停止、切换还是整理，并优先兑现这个动作。",
        "2. 已知：通读 currentUserText、recentTurns 和 effectiveFacts，盘点用户已经明确说出的事实、感受、触发、解释与纠正，以及助手已经问过的问题。",
        "3. 新目标：只选择一个原文尚未回答、答案会改变当前理解或下一步的信息目标。找不到高价值新目标时自然回应或结束，不为维持轮次硬问。",
        "4. 依据：正文中的每一处原因、因果、动机、心理目标或第三方解释，都必须由用户原文直接支持。第三方为什么这样做、用户为什么这样想，原文未说时不写成结论；确有价值时只能作为本轮唯一可纠正问题。",
        "5. 覆盖：写问题前先用全部有效原文回答它。原文能够回答时删除并重选；用户已经明确说出某类感受时，不再泛问同一类感受。",
        "用户要求继续或深挖时，用一句短过渡直接进入新层。上一条助手已经承接纠正时，不再完整复述、解释或评价这次纠正。",
        "回应使用一至两个短段落，语言自然、忠实、具体。问题可以由一个或几个紧密相连的问句组成，但只能要求用户围绕一个焦点作答。",
        "用户明确停止时立即收住并零提问。用户表达负担但仍想继续时，提供一个容易回答的入口。",
        "自然转述允许改变措辞，但不能改变事实强度。优先使用用户已经明确表达的内容；解释价值不足时直接省略。"
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

export function projectEventCenteredCompleteResponseFirstV14Turn(input: {
  generationInput: EventCenteredCompleteResponseFirstV12Input;
  response: string;
}) {
  return projectEventCenteredCompleteResponseFirstV12Turn({
    generationInput: input.generationInput,
    output: createEventCenteredCompleteResponseFirstV14Envelope(input)
  });
}

export function alignEventCenteredCompleteResponseFirstV14Policy(
  input: Omit<
    Parameters<typeof alignEventCenteredCompleteResponseFirstV12Policy>[0],
    "output"
  > & {
    response: string;
    generationInput: EventCenteredCompleteResponseFirstV12Input;
  }
) {
  const aligned = alignEventCenteredCompleteResponseFirstV12Policy({
    state: input.state,
    action: input.action,
    turn: input.turn,
    output: createEventCenteredCompleteResponseFirstV14Envelope({
      generationInput: input.generationInput,
      response: input.response
    }),
    basePolicy: input.basePolicy
  });
  return {
    ...aligned,
    nextState: {
      ...aligned.nextState,
      strategyVersion: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_4_VERSION
    }
  };
}

export function observeEventCenteredCompleteResponseFirstV14Text(
  response: string
) {
  const normalized = response.trim();
  return {
    characterCount: [...normalized].length,
    paragraphCount: normalized
      ? normalized.split(/\n\s*\n/u).filter(Boolean).length
      : 0,
    questionMarkCount: questionMarkCount(normalized),
    questionFocus: extractEventCenteredCompleteResponseFirstV14QuestionFocus(
      normalized
    )
  } as const;
}
