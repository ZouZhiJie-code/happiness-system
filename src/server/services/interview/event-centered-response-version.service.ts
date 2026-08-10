import { z } from "zod";

import { getEventCenteredAIProvider } from "@/server/services/ai/event-centered-provider";
import { completeStructuredOutput } from "@/server/services/ai/structured-output";
import {
  completeEventCenteredResponseVersion,
  failEventCenteredResponseVersion,
  reserveEventCenteredResponseVersion,
  switchEventCenteredResponseVersion
} from "@/server/repositories/event-centered-response-version.repository";
import {
  inferSingleEventCenteredQuestionFocus,
  inspectEventCenteredQuestionFocusPreservation,
  type EventCenteredResponseQuestionFocus as SharedEventCenteredResponseQuestionFocus
} from "@/features/interview/event-centered/response-question-focus";
import type {
  EventCenteredAssistantPayload,
  EventCenteredQuestionSpec
} from "@/types/event-centered-dialogue";

const regeneratedExpressionSchema = z.object({
  naturalUnderstanding: z.string().trim().min(1).max(120),
  question: z.string().trim().min(1).max(100)
}).strict();

const intentInstruction = {
  simplify: "保留原问题目标，用更直白、更短的一句话提问。",
  concretize: "保留原问题目标，加入画面、动作、念头或时间锚点，让用户更容易落笔。",
  change_angle: "保留当前产品角度和原问题目标，换一种观察入口来表达问题。",
  deepen: "保留当前产品角度和原问题目标，把表达推进一层，但仍然只问一个焦点。",
  lighten: "保留原问题目标，降低披露压力，允许用户只说一个小片段或近似答案。"
} as const;

export type EventCenteredResponseQuestionFocus =
  SharedEventCenteredResponseQuestionFocus;

function questionCount(value: string) {
  return (value.match(/[？?]/gu) ?? []).length;
}

function normalizeQuestion(value: string) {
  const trimmed = value.trim().replace(/[？?]+$/u, "");
  return `${trimmed}？`;
}

function finalQuestionBody(value: string) {
  const normalized = normalizeQuestion(value);
  return (normalized.match(/[^。！？!?；;\n]*[？?]/gu) ?? [])
    .at(-1)
    ?.trim() ?? normalized;
}

export function detectEventCenteredResponseQuestionFocus(input: {
  angle: EventCenteredQuestionSpec["angle"];
  target: string | null | undefined;
  question: string;
}): EventCenteredResponseQuestionFocus | null {
  const supportsConcreteFocus =
    (input.angle === "relationship" &&
      input.target === "relationship_position_or_boundary") ||
    (input.angle === "action" &&
      input.target === "action_condition_or_friction");
  if (!supportsConcreteFocus) return null;
  return inferSingleEventCenteredQuestionFocus({
    angle: input.angle,
    text: finalQuestionBody(input.question)
  });
}

export function preservesEventCenteredResponseQuestionFocus(input: {
  source: EventCenteredAssistantPayload;
  candidateQuestion: string;
}) {
  const questionSpec = input.source.questionSpec;
  if (!questionSpec) return true;
  const originalFocus = detectEventCenteredResponseQuestionFocus({
    angle: questionSpec.angle,
    target: questionSpec.target,
    question: input.source.naturalResponse
  });
  if (!originalFocus) return true;
  return inspectEventCenteredQuestionFocusPreservation({
    angle: questionSpec.angle,
    sourceQuestion: finalQuestionBody(input.source.naturalResponse),
    candidateQuestion: finalQuestionBody(input.candidateQuestion)
  }).passed;
}

function isConcreteRelationalPositionQuestion(input: {
  source: EventCenteredAssistantPayload;
  question: string;
}) {
  const spec = input.source.questionSpec;
  const focus = spec
    ? detectEventCenteredResponseQuestionFocus({
        angle: spec.angle,
        target: spec.target,
        question: input.source.naturalResponse
      })
    : null;
  if (focus !== "relational_position") return true;

  const question = finalQuestionBody(input.question);
  const hasObservableSignal = /(?:回应|说话|表达|参与.{0,8}决定|参与到什么程度|发言权|平等(?:说话|表达|参与|发言)|怎样对待)/u.test(question);
  const isAbstractPositionOnly = /(?:希望|想).{0,8}(?:自己)?(?:处在|处于).{0,12}位置/u.test(question);
  return hasObservableSignal && !isAbstractPositionOnly;
}

export function createDeterministicEventCenteredResponseVersion(input: {
  source: EventCenteredAssistantPayload;
  intent: keyof typeof intentInstruction;
}) {
  const questionFocus = input.source.questionSpec
    ? detectEventCenteredResponseQuestionFocus({
        angle: input.source.questionSpec.angle,
        target: input.source.questionSpec.target,
        question: input.source.naturalResponse
      })
    : null;
  const original = input.source.naturalResponse.trim().replace(/[？?]+$/u, "");
  const target = input.source.questionSpec?.target ?? "当前这一步";
  const questions = questionFocus === "relational_position" ? {
    simplify: "回到刚才那次互动，哪种回应会让你更有平等说话的感觉",
    concretize: "回到刚才那次互动，对方怎样回应时，你会更清楚自己在这段关系中的位置",
    change_angle: "先看一个具体信号，对方怎样回应时，你会感觉自己也能参与决定",
    deepen: "对方怎样回应时，你会更清楚自己在这段关系里能参与到什么程度",
    lighten: "只看刚才那次互动，哪种回应会让你更有平等说话的感觉"
  } as const : {
    simplify: `简单说，${original}`,
    concretize: `回到当时的具体画面，${original}`,
    change_angle: `换一个观察入口，${original}`,
    deepen: `沿着${target}再往里一点，${original}`,
    lighten: `如果只说一个小片段，${original}`
  } as const;
  const summaries = {
    simplify: "我会保留刚才的关注点，把问题说得更直白。",
    concretize: "我会保留刚才的关注点，把回答范围落到一个具体片段。",
    change_angle: "我会留在当前探索角度，换一个更容易进入的观察入口。",
    deepen: "我会留在当前探索角度，沿着同一个关注点再推进一层。",
    lighten: "我会保留刚才的关注点，把回答压力降下来。"
  } as const;
  return {
    naturalUnderstanding: summaries[input.intent],
    question: normalizeQuestion(questions[input.intent])
  };
}

function validateExpression(input: {
  question: string;
  source: EventCenteredAssistantPayload;
}) {
  const question = normalizeQuestion(input.question);
  if (
    questionCount(question) !== 1 ||
    question.length > 100 ||
    question === normalizeQuestion(input.source.naturalResponse) ||
    !preservesEventCenteredResponseQuestionFocus({
      source: input.source,
      candidateQuestion: question
    }) ||
    !isConcreteRelationalPositionQuestion({
      source: input.source,
      question
    }) ||
    /槽位|内部结构|心理诊断|病理|系统提示词/u.test(question)
  ) {
    return null;
  }
  return question;
}

async function generateExpression(input: {
  source: EventCenteredAssistantPayload;
  intent: keyof typeof intentInstruction;
  signal?: AbortSignal;
}) {
  const fallback = createDeterministicEventCenteredResponseVersion(input);
  const sourceQuestionFocus = input.source.questionSpec
    ? detectEventCenteredResponseQuestionFocus({
        angle: input.source.questionSpec.angle,
        target: input.source.questionSpec.target,
        question: input.source.naturalResponse
      })
    : null;
  try {
    const provider = await getEventCenteredAIProvider();
    const generated = await completeStructuredOutput({
      provider,
      stage: "question",
      schema: regeneratedExpressionSchema,
      maxTokens: 280,
      timeoutMs: 7_000,
      signal: input.signal,
      messages: [
        {
          role: "system",
          content: [
            "你负责把事件访谈中的当前问题换一种自然中文表达，只输出 JSON。",
            "保留当前产品角度、问题目标和事实边界。",
            "只写一个问题，不新增推测，不切换四个探索角度，不诊断，不给建议。",
            "关系位置问题需要落到一次互动中可观察的回应、说话方式或参与决定的信号，避免继续抽象追问‘希望处在什么位置’。",
            intentInstruction[input.intent]
          ].join("\n")
        },
        {
          role: "user",
          content: JSON.stringify({
            currentAngle: input.source.questionSpec?.angle ?? null,
            questionTarget: input.source.questionSpec?.target ?? null,
            questionFocus: sourceQuestionFocus,
            originalUnderstanding: input.source.naturalUnderstanding,
            originalQuestion: input.source.naturalResponse
          })
        }
      ]
    });
    const question = generated
      ? validateExpression({
          question: generated.question,
          source: input.source
        })
      : null;
    if (!generated || !question) {
      return { ...fallback, outputOrigin: provider ? "fallback" as const : "deterministic" as const };
    }
    return {
      naturalUnderstanding: generated.naturalUnderstanding,
      question,
      outputOrigin: "llm" as const
    };
  } catch {
    return { ...fallback, outputOrigin: "fallback" as const };
  }
}

export async function regenerateEventCenteredResponseVersion(input: {
  userId: string;
  rootSessionId: string;
  targetMessageId: string;
  intent: "simplify" | "concretize" | "change_angle" | "deepen" | "lighten";
  clientTurnId: string;
  baseMessageSequence: number;
  baseBranchSessionId: string;
  requestId?: string;
  signal?: AbortSignal;
}) {
  const startedAt = Date.now();
  const reservation = await reserveEventCenteredResponseVersion(input);
  if (reservation.kind === "completed") {
    return {
      eventId: reservation.eventId,
      rootSessionId: reservation.rootSessionId,
      activeBranchSessionId: reservation.sourceBranchSessionId,
      responseGroupId: reservation.responseGroupId,
      responseVersion: reservation.responseVersion
    };
  }
  try {
    const generated = await generateExpression({
      source: reservation.targetPayload,
      intent: input.intent,
      signal: input.signal
    });
    const payload: EventCenteredAssistantPayload = {
      ...reservation.targetPayload,
      naturalUnderstanding: generated.naturalUnderstanding,
      naturalResponse: generated.question,
      responseKind: input.intent === "simplify" || input.intent === "concretize" || input.intent === "lighten"
        ? "repair"
        : "question"
    };
    const result = await completeEventCenteredResponseVersion({
      userId: input.userId,
      regenerationId: reservation.regenerationId,
      userTurnId: reservation.userTurnId,
      payload,
      candidates: [{
        naturalUnderstanding: generated.naturalUnderstanding,
        question: generated.question
      }],
      selectedCandidate: 0,
      checks: {
        sameAngle: payload.questionSpec?.angle === reservation.targetPayload.questionSpec?.angle,
        sameTarget: payload.questionSpec?.target === reservation.targetPayload.questionSpec?.target,
        singleQuestion: questionCount(generated.question) === 1
      },
      requestId: input.requestId,
      outputOrigin: generated.outputOrigin,
      latencyMs: Date.now() - startedAt
    });
    return {
      ...result,
      responseGroupId: reservation.responseGroupId,
      responseVersion: reservation.responseVersion,
      assistantPayload: payload
    };
  } catch (error) {
    await failEventCenteredResponseVersion({
      regenerationId: reservation.regenerationId,
      userTurnId: reservation.userTurnId,
      errorCode: error instanceof Error ? error.message : "INTERVIEW_REGENERATION_FAILED"
    });
    throw error;
  }
}

export async function selectEventCenteredResponseVersion(input: {
  userId: string;
  rootSessionId: string;
  targetBranchSessionId: string;
  baseBranchSessionId: string;
  targetMessageId?: string;
}) {
  return switchEventCenteredResponseVersion(input);
}
