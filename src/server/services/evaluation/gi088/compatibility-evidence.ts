import { createHash } from "node:crypto";

import { isEffectiveCaptureContent } from "@/features/interview/event-centered/capture-mode";
import { parseEventCenteredAssistantPayload } from "@/features/interview/event-centered/dialogue-state";
import { prisma } from "@/server/db/prisma";

export type Gi088CompatibilityEvidence = {
  productSessionFingerprint: string;
  recordMode: "capture";
  completedUserTurnCount: number;
  questionFormTurnCount: number;
  visibleQuestionCount: number;
  providerCallCount: number;
};

export class Gi088CompatibilityEvidenceError extends Error {
  constructor(readonly code: "GI088_COMPATIBILITY_SMOKE_EVIDENCE_INVALID") {
    super(code);
    this.name = "Gi088CompatibilityEvidenceError";
  }
}

function invalidEvidence(): never {
  throw new Gi088CompatibilityEvidenceError(
    "GI088_COMPATIBILITY_SMOKE_EVIDENCE_INVALID"
  );
}

function visibleQuestionCount(messages: Array<{ content: string }>) {
  return messages.reduce((count, message) => {
    try {
      const parsed = parseEventCenteredAssistantPayload(message.content);
      if (!parsed) return count + 1;
      return count + (parsed.questionSpec ? 1 : 0);
    } catch {
      return count + 1;
    }
  }, 0);
}

function jsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isZeroModelCaptureTrace(trace: {
  outputOrigin: string | null;
  contextSnapshot: unknown;
  finalOutput: unknown;
  pipelineDecisions: unknown;
}) {
  const context = jsonObject(trace.contextSnapshot);
  const finalOutput = jsonObject(trace.finalOutput);
  const decisions = Array.isArray(trace.pipelineDecisions)
    ? trace.pipelineDecisions.map(jsonObject).filter(Boolean)
    : [];
  return trace.outputOrigin === "deterministic" &&
    context?.recordMode === "capture" &&
    context.questionCount === 0 &&
    context.providerCallCount === 0 &&
    finalOutput?.responseKind === "acknowledgement" &&
    finalOutput.questionCount === 0 &&
    decisions.some((decision) =>
      decision?.kind === "capture_zero_question_acknowledgement" &&
      decision.providerCallCount === 0 &&
      decision.hiddenReasoningPersisted === false
    );
}

export async function verifyGi088CompatibilityEvidence(input: {
  ownerUserId: string;
  productSessionId: string;
  taskId: string;
}): Promise<Gi088CompatibilityEvidence> {
  const productSessionId = input.productSessionId.trim();
  if (!productSessionId || (input.taskId !== "A5" && input.taskId !== "A6")) {
    return invalidEvidence();
  }

  const session = await prisma.interviewSession.findFirst({
    where: {
      id: productSessionId,
      userId: input.ownerUserId,
      mode: "event_centered",
      recordMode: "capture",
      parentSessionId: null
    },
    select: {
      id: true,
      userTurns: {
        where: { action: "reply", status: "completed" },
        select: { rawText: true }
      },
      messages: {
        where: { role: "assistant" },
        orderBy: { sequence: "asc" },
        select: { content: true }
      },
      aiRequestLogs: { select: { id: true } },
      aiGenerationTraces: {
        where: { artifactType: "interview_turn", status: "completed" },
        select: {
          outputOrigin: true,
          contextSnapshot: true,
          finalOutput: true,
          pipelineDecisions: true
        }
      }
    }
  });
  if (!session) return invalidEvidence();

  const completedContents = session.userTurns
    .map((turn) => turn.rawText?.trim() ?? "")
    .filter(isEffectiveCaptureContent);
  const questionFormTurnCount = completedContents.filter((content) =>
    /[？?]/u.test(content)
  ).length;
  const assistantQuestionCount = visibleQuestionCount(session.messages);
  const providerCallCount = session.aiRequestLogs.length;

  if (
    completedContents.length === 0 ||
    session.aiGenerationTraces.length !== completedContents.length ||
    !session.aiGenerationTraces.every(isZeroModelCaptureTrace) ||
    assistantQuestionCount !== 0 ||
    providerCallCount !== 0 ||
    (input.taskId === "A6" && questionFormTurnCount === 0)
  ) {
    return invalidEvidence();
  }

  return {
    productSessionFingerprint: createHash("sha256")
      .update(`gi088-capture-session:${session.id}`)
      .digest("hex"),
    recordMode: "capture",
    completedUserTurnCount: completedContents.length,
    questionFormTurnCount,
    visibleQuestionCount: assistantQuestionCount,
    providerCallCount
  };
}
