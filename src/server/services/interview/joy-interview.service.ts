import { Prisma } from "@prisma/client";

import {
  getCompletedRestartMessage,
  getNextStage,
  getOpeningQuestion
} from "@/features/joy-interview/server/joy-interview-engine";
import {
  appendJoyInterviewTurn,
  completeJoyInterviewSessionRecord,
  createJoyInterviewSession,
  findJoyInterviewSessionById,
  markJoyEntrySaved,
  reopenJoyInterviewSessionRecord,
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

export class DraftGenerationError extends Error {
  constructor(
    readonly code:
      | "SESSION_BATCH_UNSUPPORTED"
      | "SESSION_NOT_FOUND"
      | "DRAFT_GENERATE_UPSTREAM_ERROR"
      | "DRAFT_GENERATE_DB_ERROR"
      | "DRAFT_GENERATE_UNKNOWN_ERROR",
    readonly retryable: boolean,
    message?: string,
    readonly cause?: unknown
  ) {
    super(message ?? code);
    this.name = "DraftGenerationError";
  }
}

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

export async function reopenJoyInterviewSession(sessionId: string) {
  const session = await findJoyInterviewSessionById(sessionId);

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  if (session.status === "active") {
    return {
      session
    };
  }

  const reopenedSession = await reopenJoyInterviewSessionRecord(sessionId);

  if (!reopenedSession) {
    throw new Error("SESSION_NOT_FOUND");
  }

  return {
    session: reopenedSession
  };
}

export async function completeJoyInterviewSession(sessionId: string) {
  const session = await findJoyInterviewSessionById(sessionId);

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  if (session.status === "completed") {
    return {
      session
    };
  }

  const completedSession = await completeJoyInterviewSessionRecord(sessionId);

  return {
    session: completedSession
  };
}

interface PreparedInterviewTurn {
  session: InterviewSessionRecord;
  nextSnapshot: JoySnapshot;
  nextTurnCount: number;
  nextStage: JoyInterviewStage;
  isReadyForDraft: boolean;
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
      isReadyForDraft: Boolean(session.journalEntry),
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
  const isReadyForDraft = nextStage === "wrap_up";
  return {
    session,
    nextSnapshot,
    nextTurnCount,
    nextStage,
    isReadyForDraft
  } satisfies PreparedInterviewTurn;
}

export async function completeJoyInterviewResponse(input: {
  sessionId: string;
  userMessage: string;
  inputMode: InputMode;
  nextSnapshot: JoySnapshot;
  nextTurnCount: number;
  nextStage: JoyInterviewStage;
  isReadyForDraft: boolean;
  assistantMessage: string;
}) {
  const updatedSession = await appendJoyInterviewTurn({
    sessionId: input.sessionId,
    userMessage: input.userMessage,
    inputMode: input.inputMode,
    assistantMessage: input.assistantMessage,
    snapshot: input.nextSnapshot,
    nextStage: input.nextStage,
    nextStatus: "active",
    nextTurnCount: input.nextTurnCount,
    draftSummary: input.nextSnapshot.whyItMattered ?? input.nextSnapshot.event,
    completedAt: null
  });

  if (!updatedSession) {
    throw new Error("SESSION_NOT_FOUND");
  }

  return {
    assistantMessage: input.assistantMessage,
    sessionStatus: updatedSession.status,
    turnCount: updatedSession.turnCount,
    snapshot: updatedSession.snapshot,
    isReadyForDraft: input.isReadyForDraft,
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
    isReadyForDraft: prepared.isReadyForDraft
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
    isReadyForDraft: prepared.isReadyForDraft
  });
}

export async function generateJoyInterviewDraft(sessionIds: string[]) {
  if (sessionIds.length !== 1) {
    throw new DraftGenerationError("SESSION_BATCH_UNSUPPORTED", false);
  }

  const session = await findJoyInterviewSessionById(sessionIds[0]);

  if (!session) {
    throw new DraftGenerationError("SESSION_NOT_FOUND", false);
  }

  let draftEntry;

  try {
    draftEntry = await generateJoyDraftWithAI(session);
  } catch (error) {
    throw new DraftGenerationError("DRAFT_GENERATE_UPSTREAM_ERROR", true, "Draft generation failed upstream.", error);
  }

  let draftSession;

  try {
    draftSession = await saveJoyInterviewDraft(session.id, draftEntry);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientInitializationError) {
      throw new DraftGenerationError("DRAFT_GENERATE_DB_ERROR", true, "Draft persistence failed.", error);
    }

    throw new DraftGenerationError("DRAFT_GENERATE_UNKNOWN_ERROR", true, "Draft generation failed unexpectedly.", error);
  }

  if (!draftSession?.journalEntry) {
    throw new DraftGenerationError("DRAFT_GENERATE_DB_ERROR", true, "Draft record was not created.");
  }

  return {
    draftEntry: draftSession.journalEntry,
    session: draftSession
  };
}

export async function saveGeneratedJoyEntry(sessionId: string) {
  const savedSession = await markJoyEntrySaved(sessionId);

  if (!savedSession?.journalEntry) {
    throw new Error("DRAFT_NOT_FOUND");
  }

  return {
    draftEntry: savedSession.journalEntry,
    session: savedSession
  };
}
