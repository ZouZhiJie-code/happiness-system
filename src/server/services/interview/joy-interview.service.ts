import {
  getNextStage,
  openingQuestion
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
import type { InputMode } from "@/types/interview";

export async function startJoyInterview() {
  const session = await createJoyInterviewSession(openingQuestion);

  return {
    sessionId: session.id,
    openingQuestion,
    session
  };
}

export async function getJoyInterviewSession(sessionId: string) {
  return findJoyInterviewSessionById(sessionId);
}

export async function respondToJoyInterview(sessionId: string, userMessage: string, inputMode: InputMode) {
  const session = await findJoyInterviewSessionById(sessionId);

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  if (session.status !== "active") {
    return {
      assistantMessage: "这个访谈已经结束了，你可以重新开始一轮新的开心回顾。",
      sessionStatus: session.status,
      turnCount: session.turnCount,
      snapshot: session.snapshot,
      isComplete: session.status === "completed",
      session
    };
  }

  const nextSnapshot = await extractJoySnapshotWithAI({
    session,
    userMessage
  });
  const nextTurnCount = session.turnCount + 1;
  const nextStage = getNextStage(nextSnapshot, nextTurnCount);
  const isComplete = nextStage === "wrap_up";
  const assistantMessage = await generateJoyAssistantMessage({
    sessionId,
    stage: nextStage,
    snapshot: nextSnapshot,
    userMessage,
    messages: session.messages
  });

  const updatedSession = await appendJoyInterviewTurn({
    sessionId,
    userMessage,
    inputMode,
    assistantMessage,
    snapshot: nextSnapshot,
    nextStage: isComplete ? "finalize" : nextStage,
    nextStatus: isComplete ? "completed" : "active",
    nextTurnCount,
    draftSummary: nextSnapshot.whyItMattered ?? nextSnapshot.event,
    completedAt: isComplete ? new Date() : null
  });

  if (!updatedSession) {
    throw new Error("SESSION_NOT_FOUND");
  }

  return {
    assistantMessage,
    sessionStatus: updatedSession.status,
    turnCount: updatedSession.turnCount,
    snapshot: updatedSession.snapshot,
    isComplete,
    session: updatedSession
  };
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
