import { assistantTurnPayloadSchema } from "@/features/joy-interview/schema/joy-interview.schema";
import type { AssistantDepth, AssistantTurnPayload, InterviewMessage } from "@/types/interview";

export const assistantDepthOrder: AssistantDepth[] = ["event", "feeling", "reason", "clue", "pattern"];

export function normalizeAssistantDepthReached(depthReached: AssistantDepth[] | undefined) {
  return assistantDepthOrder.filter((depth) => depthReached?.includes(depth));
}

export function parseAssistantTurnPayload(content: string) {
  try {
    const parsed = JSON.parse(content);
    const result = assistantTurnPayloadSchema.safeParse(parsed);

    if (!result.success) {
      return null;
    }

    return {
      ...result.data,
      meta: {
        depthReached: normalizeAssistantDepthReached(result.data.meta.depthReached)
      }
    } satisfies AssistantTurnPayload;
  } catch {
    return null;
  }
}

export function serializeAssistantTurnPayload(payload: AssistantTurnPayload) {
  return JSON.stringify({
    insight: payload.insight,
    analysis: payload.analysis,
    question: payload.question,
    stateUpdate: payload.stateUpdate,
    meta: {
      depthReached: normalizeAssistantDepthReached(payload.meta.depthReached)
    }
  });
}

export function createOpeningAssistantTurnPayload(question: string): AssistantTurnPayload {
  return {
    insight: "",
    analysis: "",
    question,
    stateUpdate: {
      turnPhase: "opening",
      shouldEndDimension: false,
      offerChoice: false,
      choiceReason: ""
    },
    meta: {
      depthReached: []
    }
  };
}

export function getAssistantDisplayParts(payload: AssistantTurnPayload | null | undefined) {
  if (!payload) {
    return {
      insight: "",
      question: "",
      combinedText: ""
    };
  }

  const parts = [payload.insight.trim(), payload.question.trim()].filter(Boolean);

  return {
    insight: payload.insight.trim(),
    question: payload.question.trim(),
    combinedText: parts.join("\n")
  };
}

export function getInterviewMessageDisplayText(message: Pick<InterviewMessage, "role" | "content" | "assistantPayload">) {
  if (message.role !== "assistant") {
    return message.content;
  }

  const assistantPayload = message.assistantPayload ?? parseAssistantTurnPayload(message.content);

  if (!assistantPayload) {
    return message.content;
  }

  return getAssistantDisplayParts(assistantPayload).combinedText || message.content;
}

export function getLatestAssistantPayload(messages: InterviewMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message?.role !== "assistant") {
      continue;
    }

    return message.assistantPayload ?? parseAssistantTurnPayload(message.content);
  }

  return null;
}
