import {
  alignEventCenteredCompleteResponseFirstV12Policy,
  projectEventCenteredCompleteResponseFirstV12Turn,
  validateEventCenteredCompleteResponseFirstV12Output,
  type EventCenteredCompleteResponseFirstV12Input,
  type EventCenteredCompleteResponseFirstV12Output
} from "@/features/interview/event-centered/complete-response-first-v1-2";
import {
  createEventCenteredCompleteResponseFirstV14Envelope,
  extractEventCenteredCompleteResponseFirstV14QuestionFocus
} from "@/features/interview/event-centered/complete-response-first-v1-4";
import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_8_RUNTIME,
  buildEventCenteredCompleteResponseFirstV18Messages,
  observeEventCenteredCompleteResponseFirstV18Text,
  validateEventCenteredCompleteResponseFirstV18Output
} from "@/features/interview/event-centered/complete-response-first-v1-8";

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_9_STRATEGY =
  "complete_response_v1_9" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_9_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-9-local-boundary-continue-priority" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_9_PROMPT_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-9-local-boundary-continue-prompt-v1" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_9_RUNTIME =
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_8_RUNTIME;

const STOP_OR_REFUSAL_PATTERN =
  /(?:不想回答|不想答|先不回答|先不答|不想继续|想停下来|要停下来|不继续聊|先停|别问了|不要再问|不聊了|不用再追问|收在这里|到这里就好|先到这里|暂时不想说|暂时不想聊)/u;

const EXPLICIT_PROGRESS_PATTERN =
  /(?:继续(?:和我)?聊|接着聊|往下(?:聊|挖)|再(?:往下|深入)|深挖|换(?:个|一个)?(?:方向|话题)|聊(?:点|些)?别的)/u;

export type EventCenteredCompleteResponseFirstV19Control =
  | "local_boundary_continue"
  | "global_stop"
  | "none";

export function classifyEventCenteredCompleteResponseFirstV19Control(
  rawText: string
): EventCenteredCompleteResponseFirstV19Control {
  const normalized = rawText.trim();
  const hasStopOrRefusal = STOP_OR_REFUSAL_PATTERN.test(normalized);
  const positiveScope = normalized.replace(
    /(?:不想|不愿意|不准备|不再|不打算|不要|别)继续(?:和我)?聊/gu,
    ""
  );
  const hasProgress = EXPLICIT_PROGRESS_PATTERN.test(positiveScope);
  if (hasStopOrRefusal && hasProgress) return "local_boundary_continue";
  if (hasStopOrRefusal) return "global_stop";
  return "none";
}

export const extractEventCenteredCompleteResponseFirstV19QuestionFocus =
  extractEventCenteredCompleteResponseFirstV14QuestionFocus;

export function createEventCenteredCompleteResponseFirstV19Envelope(input: {
  generationInput: EventCenteredCompleteResponseFirstV12Input;
  response: string;
}): EventCenteredCompleteResponseFirstV12Output {
  const control = classifyEventCenteredCompleteResponseFirstV19Control(
    input.generationInput.rawText
  );
  if (control === "none") {
    return createEventCenteredCompleteResponseFirstV14Envelope(input);
  }
  const response = input.response.trim();
  const question = control === "global_stop"
    ? null
    : extractEventCenteredCompleteResponseFirstV19QuestionFocus(response);
  const correction = Boolean(
    input.generationInput.correctionRequested &&
    input.generationInput.correctionTargetAssistantMessageId
  );
  return {
    response,
    interaction: {
      kind: control === "global_stop" ? "stop" : question ? "ask" : "respond",
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

const OLD_STOP_SCOPE_ISSUES = new Set([
  "EXPLICIT_STOP_STILL_OPEN",
  "EXPLICIT_STOP_MUST_BE_HONORED"
]);

const QUESTION_COUNT_OBSERVATION_ONLY = new Set([
  "VISIBLE_RESPONSE_MULTIPLE_QUESTIONS",
  "VISIBLE_RESPONSE_MUST_HAVE_ONE_QUESTION",
  "NON_ASK_VISIBLE_RESPONSE_MUST_HAVE_ZERO_QUESTIONS"
]);

function questionMarkCount(value: string) {
  return [...value].filter(
    (character) => character === "?" || character === "？"
  ).length;
}

export function validateEventCenteredCompleteResponseFirstV19Output(input: {
  generationInput: EventCenteredCompleteResponseFirstV12Input;
  response: string;
}) {
  const control = classifyEventCenteredCompleteResponseFirstV19Control(
    input.generationInput.rawText
  );
  const envelope = createEventCenteredCompleteResponseFirstV19Envelope(input);
  const issues = [
    ...validateEventCenteredCompleteResponseFirstV18Output(input),
    ...validateEventCenteredCompleteResponseFirstV12Output({
      generationInput: input.generationInput,
      output: envelope
    })
  ].filter(
    (issue) =>
      !OLD_STOP_SCOPE_ISSUES.has(issue) &&
      !QUESTION_COUNT_OBSERVATION_ONLY.has(issue)
  );
  if (control === "global_stop" && questionMarkCount(input.response) > 0) {
    issues.push("EXPLICIT_GLOBAL_STOP_STILL_OPEN");
  }
  if (control === "local_boundary_continue" && envelope.interaction.kind === "stop") {
    issues.push("LOCAL_BOUNDARY_CONTINUE_CLASSIFIED_AS_STOP");
  }
  return [...new Set(issues)];
}

const CONTROL_SCOPE_METHOD = [
  "【用户控制范围】输入会提供 explicitControl。它已经由程序根据用户明确措辞确定，只负责控制范围，不替你选择聊天内容。",
  "explicitControl=local_boundary_continue 表示用户拒绝当前问题，同时明确要求继续或换方向。尊重这个局部边界，放下当前问题，直接从完整有效原文选择另一个未回答层继续；禁止收束、保存后结束或再次询问是否继续。",
  "explicitControl=global_stop 表示用户要结束当前对话。立即收住并零提问。",
  "explicitControl=none 时沿用原方法。新的方向是否自然、有价值，仍由你基于完整原文判断。"
].join("\n");

export function buildEventCenteredCompleteResponseFirstV19Messages(
  input: EventCenteredCompleteResponseFirstV12Input
) {
  const [system, user] = buildEventCenteredCompleteResponseFirstV18Messages(input);
  const userInput = JSON.parse(user!.content) as Record<string, unknown>;
  userInput.explicitControl =
    classifyEventCenteredCompleteResponseFirstV19Control(input.rawText);
  return [{
    role: "system" as const,
    content: `${system!.content}\n${CONTROL_SCOPE_METHOD}`
  }, {
    role: "user" as const,
    content: JSON.stringify(userInput)
  }];
}

export function projectEventCenteredCompleteResponseFirstV19Turn(input: {
  generationInput: EventCenteredCompleteResponseFirstV12Input;
  response: string;
}) {
  return projectEventCenteredCompleteResponseFirstV12Turn({
    generationInput: input.generationInput,
    output: createEventCenteredCompleteResponseFirstV19Envelope(input)
  });
}

export function alignEventCenteredCompleteResponseFirstV19Policy(
  input: Omit<
    Parameters<typeof alignEventCenteredCompleteResponseFirstV12Policy>[0],
    "output"
  > & {
    response: string;
    generationInput: EventCenteredCompleteResponseFirstV12Input;
  }
) {
  const output = createEventCenteredCompleteResponseFirstV19Envelope({
    generationInput: input.generationInput,
    response: input.response
  });
  const aligned = alignEventCenteredCompleteResponseFirstV12Policy({
    state: input.state,
    action: input.action,
    turn: input.turn,
    output,
    basePolicy: input.basePolicy
  });
  const control = classifyEventCenteredCompleteResponseFirstV19Control(
    input.generationInput.rawText
  );
  const localContinueWithoutQuestion =
    control === "local_boundary_continue" &&
    output.interaction.kind === "respond" &&
    aligned.directive.responseKind === "checkpoint";
  return {
    ...aligned,
    nextState: {
      ...(localContinueWithoutQuestion
        ? {
            ...aligned.nextState,
            phase: input.state.phase,
            currentQuestion: null,
            currentQuestionIntent: null
          }
        : aligned.nextState),
      strategyVersion: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_9_VERSION
    },
    ...(localContinueWithoutQuestion
      ? {
          directive: {
            responseKind: "acknowledgement" as const,
            questionSpec: null,
            checkpoint: null,
            angleOutcome: null,
            exactResponse: input.response.trim()
          },
          angleOutcome: null,
          preserveCurrentQuestion: false
        }
      : {})
  };
}

export const observeEventCenteredCompleteResponseFirstV19Text =
  observeEventCenteredCompleteResponseFirstV18Text;
