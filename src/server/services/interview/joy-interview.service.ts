import {
  getCompletedRestartMessage,
  getNextStage,
  getOpeningQuestion
} from "@/features/joy-interview/server/joy-interview-engine";
import {
  appendJoyInterviewTurn,
  createJoyInterviewSession,
  findJoyInterviewSessionById,
  saveJoyInterviewDraft
} from "@/server/repositories/joy-interview.repository";
import {
  extractJoySnapshotWithAI,
  generateJoyAssistantMessage,
  generateJoyDraftWithAI
} from "@/server/services/interview/joy-interview-ai.service";
import { streamJoyAssistantMessage } from "@/server/services/interview/joy-interview-ai.service";
import type {
  InputMode,
  InterviewDimension,
  InterviewSessionRecord,
  JoyInterviewStage,
  JoySnapshot
} from "@/types/interview";

export async function startJoyInterview(dimension: InterviewDimension) {
  const openingQuestion = getOpeningQuestion(dimension);
  const session = await createJoyInterviewSession(dimension, openingQuestion);

  return {
    sessionId: session.id,
    openingQuestion,
    session
  };
}

export async function getJoyInterviewSession(sessionId: string) {
  return findJoyInterviewSessionById(sessionId);
}

interface PreparedInterviewTurn {
  session: InterviewSessionRecord;
  nextSnapshot: JoySnapshot;
  nextTurnCount: number;
  nextStage: JoyInterviewStage;
  isComplete: boolean;
}

async function getActiveInterviewSession(sessionId: string) {
  const session = await findJoyInterviewSessionById(sessionId);

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  if (session.status !== "active") {
    return {
      assistantMessage: getCompletedRestartMessage(session.dimension),
      sessionStatus: session.status,
      turnCount: session.turnCount,
      snapshot: session.snapshot,
      isComplete: session.status === "completed",
      session
    };
  }

  return session;
}

export async function prepareJoyInterviewResponse(sessionId: string, userMessage: string) {
  const session = await getActiveInterviewSession(sessionId);

  if ("assistantMessage" in session) {
    return session;
  }

  const nextSnapshot = await extractJoySnapshotWithAI({
    session,
    userMessage
  });
  const nextTurnCount = session.turnCount + 1;
  const nextStage = getNextStage(nextSnapshot, nextTurnCount);
  const isComplete = nextStage === "wrap_up";
  return {
    session,
    nextSnapshot,
    nextTurnCount,
    nextStage,
    isComplete
  } satisfies PreparedInterviewTurn;
}

export async function completeJoyInterviewResponse(input: {
  sessionId: string;
  userMessage: string;
  inputMode: InputMode;
  nextSnapshot: JoySnapshot;
  nextTurnCount: number;
  nextStage: JoyInterviewStage;
  isComplete: boolean;
  assistantMessage: string;
}) {
  const updatedSession = await appendJoyInterviewTurn({
    sessionId: input.sessionId,
    userMessage: input.userMessage,
    inputMode: input.inputMode,
    assistantMessage: input.assistantMessage,
    snapshot: input.nextSnapshot,
    nextStage: input.isComplete ? "finalize" : input.nextStage,
    nextStatus: input.isComplete ? "completed" : "active",
    nextTurnCount: input.nextTurnCount,
    draftSummary: input.nextSnapshot.whyItMattered ?? input.nextSnapshot.event,
    completedAt: input.isComplete ? new Date() : null
  });

  if (!updatedSession) {
    throw new Error("SESSION_NOT_FOUND");
  }

  return {
    assistantMessage: input.assistantMessage,
    sessionStatus: updatedSession.status,
    turnCount: updatedSession.turnCount,
    snapshot: updatedSession.snapshot,
    isComplete: input.isComplete,
    session: updatedSession
  };
}

export async function respondToJoyInterview(sessionId: string, userMessage: string, inputMode: InputMode) {
  const prepared = await prepareJoyInterviewResponse(sessionId, userMessage);

  if ("assistantMessage" in prepared) {
    return prepared;
  }

  const assistantMessage = await generateJoyAssistantMessage({
    dimension: prepared.session.dimension,
    sessionId,
    stage: prepared.nextStage,
    snapshot: prepared.nextSnapshot,
    userMessage,
    messages: prepared.session.messages
  });

  return completeJoyInterviewResponse({
    sessionId,
    userMessage,
    inputMode,
    assistantMessage,
    nextSnapshot: prepared.nextSnapshot,
    nextTurnCount: prepared.nextTurnCount,
    nextStage: prepared.nextStage,
    isComplete: prepared.isComplete
  });
}

export async function streamJoyInterviewResponse(
  sessionId: string,
  userMessage: string,
  inputMode: InputMode,
  callbacks: {
    onPhase: (phase: "thinking" | "streaming") => Promise<void> | void;
    onDelta: (delta: string) => Promise<void> | void;
  }
) {
  const prepared = await prepareJoyInterviewResponse(sessionId, userMessage);

  if ("assistantMessage" in prepared) {
    await callbacks.onPhase("streaming");
    await callbacks.onDelta(prepared.assistantMessage);
    return prepared;
  }

  await callbacks.onPhase("thinking");

  const streamResult = await streamJoyAssistantMessage({
    dimension: prepared.session.dimension,
    sessionId,
    stage: prepared.nextStage,
    snapshot: prepared.nextSnapshot,
    userMessage,
    messages: prepared.session.messages
  });

  await callbacks.onPhase("streaming");

  let assistantMessage = "";

  try {
    for await (const delta of streamResult.stream) {
      const nextDelta = delta.trim() ? delta : "";

      if (!nextDelta) {
        continue;
      }

      assistantMessage += nextDelta;
      await callbacks.onDelta(nextDelta);
    }
  } catch {
    assistantMessage = streamResult.fallbackQuestion;
    await callbacks.onDelta(assistantMessage);
  }

  const normalizedAssistantMessage = assistantMessage.trim() || streamResult.fallbackQuestion;

  return completeJoyInterviewResponse({
    sessionId,
    userMessage,
    inputMode,
    assistantMessage: normalizedAssistantMessage,
    nextSnapshot: prepared.nextSnapshot,
    nextTurnCount: prepared.nextTurnCount,
    nextStage: prepared.nextStage,
    isComplete: prepared.isComplete
  });
}

export async function finalizeJoyInterview(sessionId: string) {
  const session = await findJoyInterviewSessionById(sessionId);

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  const draftEntry = await generateJoyDraftWithAI(session);
  const finalizedSession = await saveJoyInterviewDraft(sessionId, draftEntry);

  if (!finalizedSession) {
    throw new Error("SESSION_NOT_FOUND");
  }

  return {
    draftEntry,
    session: finalizedSession
  };
}
