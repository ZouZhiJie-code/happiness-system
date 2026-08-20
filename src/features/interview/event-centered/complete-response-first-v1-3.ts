import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_METHOD
} from "@/features/interview/event-centered/complete-response-first";
import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_RUNTIME,
  alignEventCenteredCompleteResponseFirstV12Policy,
  projectEventCenteredCompleteResponseFirstV12Turn,
  validateEventCenteredCompleteResponseFirstV12Output,
  type EventCenteredCompleteResponseFirstV12Input,
  type EventCenteredCompleteResponseFirstV12Output
} from "@/features/interview/event-centered/complete-response-first-v1-2";

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_3_STRATEGY =
  "complete_response_v1_3" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_3_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-3-visible-text-owner" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_3_PROMPT_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-3-visible-text-prompt-v1" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_3_RUNTIME = {
  ...EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_RUNTIME,
  responseFormat: null
} as const;

const INTERNAL_VISIBLE_PATTERN =
  /workingTask|semanticState|evidenceRefs|nextInquiry|Prompt|Skill|maxTokens|reasoningEffort|interaction|supersededAssistantMessageId/iu;
const MARKDOWN_VISIBLE_PATTERN = /^(?:```|#{1,6}\s|[-*+]\s|\d+[.)、]\s)/mu;
const EXPLICIT_STOP_PATTERN =
  /(?:不想回答|不想答|不想继续|想停下来|要停下来|不继续聊|先停|别问了|不要再问|不聊了|不用再追问|收在这里|到这里就好|先到这里|暂时不想说|暂时不想聊)/u;

function questionMarkCount(value: string) {
  return [...value].filter((character) => character === "?" || character === "？").length;
}

function paragraphCount(value: string) {
  return value.trim().split(/\n\s*\n/u).filter(Boolean).length;
}

export function extractEventCenteredCompleteResponseFirstV13Question(
  response: string
) {
  if (questionMarkCount(response) !== 1) return null;
  const questionEnd = Math.max(response.lastIndexOf("？"), response.lastIndexOf("?"));
  const before = response.slice(0, questionEnd + 1);
  const questionStart = Math.max(
    before.lastIndexOf("。", questionEnd - 1),
    before.lastIndexOf("！", questionEnd - 1),
    before.lastIndexOf("!", questionEnd - 1),
    before.lastIndexOf("\n", questionEnd - 1)
  );
  return before.slice(questionStart + 1).trim().replace(/^[，,：:；;]+/u, "");
}

export function validateEventCenteredCompleteResponseFirstV13Text(input: {
  generationInput: EventCenteredCompleteResponseFirstV12Input;
  response: string;
}) {
  const response = input.response.trim();
  const issues: string[] = [];
  if (!response) issues.push("VISIBLE_RESPONSE_EMPTY");
  if ([...response].length > 600) issues.push("VISIBLE_RESPONSE_TOO_LONG");
  if (!/\p{Script=Han}/u.test(response)) {
    issues.push("VISIBLE_RESPONSE_CHINESE_BODY_REQUIRED");
  }
  if (/^[\[{]/u.test(response)) issues.push("VISIBLE_RESPONSE_STRUCTURED_WRAPPER_LEAK");
  if (MARKDOWN_VISIBLE_PATTERN.test(response)) issues.push("VISIBLE_RESPONSE_MARKDOWN_STRUCTURE_LEAK");
  if (INTERNAL_VISIBLE_PATTERN.test(response)) issues.push("VISIBLE_RESPONSE_INTERNAL_LANGUAGE_LEAK");
  if (paragraphCount(response) > 2) issues.push("VISIBLE_RESPONSE_PARAGRAPH_LIMIT_EXCEEDED");
  if (questionMarkCount(response) > 1) issues.push("VISIBLE_RESPONSE_MULTIPLE_QUESTIONS");
  if (
    EXPLICIT_STOP_PATTERN.test(input.generationInput.rawText.trim()) &&
    questionMarkCount(response) > 0
  ) {
    issues.push("EXPLICIT_STOP_STILL_OPEN");
  }
  return [...new Set(issues)];
}

export function createEventCenteredCompleteResponseFirstV13Envelope(input: {
  generationInput: EventCenteredCompleteResponseFirstV12Input;
  response: string;
}): EventCenteredCompleteResponseFirstV12Output {
  const response = input.response.trim();
  const explicitStop = EXPLICIT_STOP_PATTERN.test(input.generationInput.rawText.trim());
  const question = explicitStop
    ? null
    : extractEventCenteredCompleteResponseFirstV13Question(response);
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

export function validateEventCenteredCompleteResponseFirstV13Output(input: {
  generationInput: EventCenteredCompleteResponseFirstV12Input;
  response: string;
}) {
  const envelope = createEventCenteredCompleteResponseFirstV13Envelope(input);
  return [...new Set([
    ...validateEventCenteredCompleteResponseFirstV13Text(input),
    ...validateEventCenteredCompleteResponseFirstV12Output({
      generationInput: input.generationInput,
      output: envelope
    })
  ])];
}

export function buildEventCenteredCompleteResponseFirstV13Messages(
  input: EventCenteredCompleteResponseFirstV12Input
) {
  const method = EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_METHOD.join("\n");
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
        "你负责 Daily Light【陪我聊】本轮唯一一条用户可见回应。只输出最终中文回应，不输出 JSON、字段名、分析过程、Markdown 或任何额外说明。",
        method,
        "回应使用一至两个短段落。先自然承接当前有效意思，再根据用户本轮意图选择一个真正尚未回答的新层、一个低负担入口，或自然结束本轮。",
        "最多提出一个主问题。完整对话已经回答的内容不能再次询问；用户说继续或深挖时进入新层；用户刚才的纠正已经被上一条助手承接时直接推进。",
        "用户明确停止时落实停止并零提问。用户表达负担但仍想继续时，给一个容易回答的入口。",
        "理解与解释只使用有效用户原文支持，并保持可纠正；避免新增动机、心理结论或具体体验。"
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

export function projectEventCenteredCompleteResponseFirstV13Turn(input: {
  generationInput: EventCenteredCompleteResponseFirstV12Input;
  response: string;
}) {
  return projectEventCenteredCompleteResponseFirstV12Turn({
    generationInput: input.generationInput,
    output: createEventCenteredCompleteResponseFirstV13Envelope(input)
  });
}

export function alignEventCenteredCompleteResponseFirstV13Policy(
  input: Omit<
    Parameters<typeof alignEventCenteredCompleteResponseFirstV12Policy>[0],
    "output"
  > & { response: string; generationInput: EventCenteredCompleteResponseFirstV12Input }
) {
  const aligned = alignEventCenteredCompleteResponseFirstV12Policy({
    state: input.state,
    action: input.action,
    turn: input.turn,
    output: createEventCenteredCompleteResponseFirstV13Envelope({
      generationInput: input.generationInput,
      response: input.response
    }),
    basePolicy: input.basePolicy
  });
  return {
    ...aligned,
    nextState: {
      ...aligned.nextState,
      strategyVersion: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_3_VERSION
    }
  };
}
