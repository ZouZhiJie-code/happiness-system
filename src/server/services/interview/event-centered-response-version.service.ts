import { z } from "zod";

import { getAIProvider } from "@/server/services/ai";
import { completeStructuredOutput } from "@/server/services/ai/structured-output";
import {
  completeEventCenteredResponseVersion,
  failEventCenteredResponseVersion,
  reserveEventCenteredResponseVersion,
  switchEventCenteredResponseVersion
} from "@/server/repositories/event-centered-response-version.repository";
import type { EventCenteredAssistantPayload } from "@/types/event-centered-dialogue";

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

function questionCount(value: string) {
  return (value.match(/[？?]/gu) ?? []).length;
}

function normalizeQuestion(value: string) {
  const trimmed = value.trim().replace(/[？?]+$/u, "");
  return `${trimmed}？`;
}

export function createDeterministicEventCenteredResponseVersion(input: {
  source: EventCenteredAssistantPayload;
  intent: keyof typeof intentInstruction;
}) {
  const original = input.source.naturalResponse.trim().replace(/[？?]+$/u, "");
  const target = input.source.questionSpec?.target ?? "当前这一步";
  const questions = {
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
  originalQuestion: string;
}) {
  const question = normalizeQuestion(input.question);
  if (
    questionCount(question) !== 1 ||
    question.length > 100 ||
    question === normalizeQuestion(input.originalQuestion) ||
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
  try {
    const provider = await getAIProvider("chat");
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
            intentInstruction[input.intent]
          ].join("\n")
        },
        {
          role: "user",
          content: JSON.stringify({
            currentAngle: input.source.questionSpec?.angle ?? null,
            questionTarget: input.source.questionSpec?.target ?? null,
            originalUnderstanding: input.source.naturalUnderstanding,
            originalQuestion: input.source.naturalResponse
          })
        }
      ]
    });
    const question = generated
      ? validateExpression({
          question: generated.question,
          originalQuestion: input.source.naturalResponse
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
