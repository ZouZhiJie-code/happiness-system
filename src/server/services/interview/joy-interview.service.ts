import { Prisma } from "@prisma/client";

import {
  assessUserTurnMessage,
  canOfferChoice,
  deriveDepthReachedFromSnapshot,
  getProgressSummaryFromSession,
  isDraftGenerationUnlockedFromState,
  isDepthReadyForWrapUp,
  mergeDepthReached
} from "@/features/joy-interview/server/interview-progress";
import {
  buildAssistantQuestion,
  getInactiveSessionMessage,
  getNextStage,
  getOpeningQuestion
} from "@/features/joy-interview/server/joy-interview-engine";
import {
  appendJoyInterviewTurn,
  completeJoyInterviewSessionRecord,
  createJoyInterviewSession,
  findJoyInterviewSessionById,
  markJoyEntrySaved,
  pauseJoyInterviewSessionRecord,
  reopenJoyInterviewSessionRecord,
  saveJoyInterviewDraft
} from "@/server/repositories/joy-interview.repository";
import { extractJoySnapshotWithAI, generateJoyAssistantTurn, generateJoyDraftWithAI } from "@/server/services/interview/joy-interview-ai.service";
import type {
  AssistantDepth,
  AssistantTurnPayload,
  InputMode,
  InterviewDimension,
  InterviewSessionRecord,
  JoyInterviewStage,
  JoySnapshot
} from "@/types/interview";

type InterviewRespondInput =
  | {
      action: "reply";
      sessionId: string;
      userMessage: string;
      inputMode: InputMode;
    }
  | {
      action: "continue";
      sessionId: string;
    };

type StreamingPhase = "thinking" | "insight" | "question";
type StreamingTarget = "insight" | "question";

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

interface PreparedInterviewTurn {
  session: InterviewSessionRecord;
  nextSnapshot: JoySnapshot;
  nextTurnCount: number;
  nextStage: JoyInterviewStage;
  isReadyForDraft: boolean;
  userMessage: string | null;
  inputMode?: InputMode;
  continueFromChoice: boolean;
  isMeaningfulReply: boolean;
  previousDepthReached: AssistantDepth[];
  nextDepthReached: AssistantDepth[];
  consecutiveNoDepthGain: number;
  consecutiveInvalidReplies: number;
  hasOfferedChoice: boolean;
  assistantTurn: AssistantTurnPayload;
}

function buildChoiceInsight(session: InterviewSessionRecord, snapshot: JoySnapshot) {
  const config = getOpeningQuestion(session.dimension);

  if (snapshot.selfPattern) {
    return `我们已经聊到了 ${snapshot.event ?? config}，也开始看见这件事和你的模式有关。`;
  }

  if (snapshot.whyItMattered) {
    return `我们已经抓到 ${snapshot.event ?? "这个片段"}，也聊到了它为什么重要。`;
  }

  if (snapshot.event) {
    return `我们已经抓到 ${snapshot.event} 这个片段，但还差一点更深的展开。`;
  }

  return "我们已经摸到一点线索了，但还没有完全展开。";
}

function buildClosingInsight(snapshot: JoySnapshot) {
  if (snapshot.selfPattern) {
    return "你已经不只是在描述这件事，也开始看见它和自己的连接了。";
  }

  if (snapshot.happinessType || snapshot.whyItMattered) {
    return "这段经历为什么重要，已经慢慢清楚起来了。";
  }

  return "这段经历已经有了可以留下的轮廓。";
}

function finalizeAssistantTurn(input: {
  session: InterviewSessionRecord;
  prepared: Omit<PreparedInterviewTurn, "assistantTurn" | "isReadyForDraft">;
  assistantTurn: AssistantTurnPayload;
}) {
  const fallbackQuestion = buildAssistantQuestion(
    input.session.dimension,
    input.prepared.nextStage,
    input.prepared.nextSnapshot
  );
  const finalDepthReached = mergeDepthReached(input.prepared.nextDepthReached, input.assistantTurn.meta.depthReached);
  const depthProgressed = finalDepthReached.some((depth) => !input.prepared.previousDepthReached.includes(depth));
  const consecutiveNoDepthGain =
    input.prepared.continueFromChoice || !input.prepared.isMeaningfulReply
      ? 0
      : depthProgressed
        ? 0
        : input.prepared.consecutiveNoDepthGain + 1;
  const consecutiveInvalidReplies = input.prepared.continueFromChoice
    ? 0
    : input.prepared.isMeaningfulReply
      ? 0
      : input.prepared.consecutiveInvalidReplies + 1;
  const backendChoice =
    !input.prepared.continueFromChoice &&
    !input.prepared.hasOfferedChoice &&
    canOfferChoice(finalDepthReached) &&
    (consecutiveInvalidReplies >= 3 || consecutiveNoDepthGain >= 2);
  const backendClosing =
    !backendChoice &&
    ((input.assistantTurn.stateUpdate.shouldEndDimension &&
      finalDepthReached.includes("event") &&
      finalDepthReached.includes("reason")) ||
      isDepthReadyForWrapUp(finalDepthReached) ||
      (input.prepared.nextStage === "wrap_up" &&
        finalDepthReached.includes("event") &&
        finalDepthReached.includes("reason") &&
        input.prepared.nextTurnCount >= 5));
  const nextStage = backendClosing ? "wrap_up" : input.prepared.nextStage;
  const question = backendChoice ? "" : (input.assistantTurn.question.trim() || fallbackQuestion).slice(0, 160);
  const insight = (
    input.assistantTurn.insight.trim() ||
    (backendChoice ? buildChoiceInsight(input.session, input.prepared.nextSnapshot) : backendClosing ? buildClosingInsight(input.prepared.nextSnapshot) : "")
  ).slice(0, 120);
  const draftGenerationUnlocked = isDraftGenerationUnlockedFromState({
    hasJournalEntry: Boolean(input.session.journalEntry),
    stage: backendClosing ? "wrap_up" : input.prepared.nextStage,
    hasOfferedChoice: input.prepared.hasOfferedChoice || backendChoice
  });

  return {
    assistantTurn: {
      insight,
      analysis: input.assistantTurn.analysis.trim().slice(0, 240),
      question,
      stateUpdate: {
        turnPhase: backendChoice ? "choice" : backendClosing ? "closing" : "digging",
        shouldEndDimension: backendClosing,
        offerChoice: backendChoice,
        choiceReason: backendChoice
          ? consecutiveInvalidReplies >= 3
            ? "用户连续短答，先让用户决定是否换个角度继续。"
            : "连续追问没有新增信息，先让用户决定是否继续。"
          : ""
      },
      meta: {
        depthReached: finalDepthReached
      }
    } satisfies AssistantTurnPayload,
    nextStage,
    isReadyForDraft: draftGenerationUnlocked
  };
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

  if (session.status !== "paused") {
    throw new Error("SESSION_NOT_REOPENABLE");
  }

  const reopenedSession = await reopenJoyInterviewSessionRecord(sessionId);

  if (!reopenedSession) {
    throw new Error("SESSION_NOT_FOUND");
  }

  return {
    session: reopenedSession
  };
}

export async function pauseJoyInterviewSession(sessionId: string) {
  const session = await findJoyInterviewSessionById(sessionId);

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  if (session.status === "paused") {
    return {
      session
    };
  }

  if (session.status === "completed") {
    throw new Error("SESSION_ALREADY_COMPLETED");
  }

  if (session.status === "abandoned") {
    throw new Error("SESSION_NOT_PAUSABLE");
  }

  const pausedSession = await pauseJoyInterviewSessionRecord(sessionId);

  return {
    session: pausedSession
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

  if (session.status === "abandoned") {
    throw new Error("SESSION_NOT_COMPLETABLE");
  }

  const completedSession = await completeJoyInterviewSessionRecord(sessionId);

  return {
    session: completedSession
  };
}

async function getActiveInterviewSession(sessionId: string) {
  const session = await findJoyInterviewSessionById(sessionId);

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  if (session.status !== "active") {
    return {
      assistantMessage: getInactiveSessionMessage(session.dimension, session.status),
      assistantTurn: null,
      sessionStatus: session.status,
      turnCount: session.turnCount,
      snapshot: session.snapshot,
      isReadyForDraft: session.draftGenerationUnlocked,
      session
    };
  }

  return session;
}

export async function prepareJoyInterviewResponse(input: InterviewRespondInput) {
  const session = await getActiveInterviewSession(input.sessionId);

  if ("assistantMessage" in session) {
    return session;
  }

  const progressSummary = getProgressSummaryFromSession(session);
  const continueFromChoice = input.action === "continue";

  if (continueFromChoice && !progressSummary.latestAssistantPayload?.stateUpdate.offerChoice) {
    throw new Error("SESSION_CONTINUE_UNAVAILABLE");
  }

  const isMeaningfulReply = input.action === "reply" ? assessUserTurnMessage(input.userMessage).isMeaningful : false;
  const nextSnapshot =
    input.action === "reply" && isMeaningfulReply
      ? await extractJoySnapshotWithAI({
          session,
          userMessage: input.userMessage
        })
      : session.snapshot;
  const nextTurnCount = session.turnCount + (input.action === "reply" && isMeaningfulReply ? 1 : 0);
  const nextStage = getNextStage(nextSnapshot, nextTurnCount);
  const nextDepthReached = mergeDepthReached(progressSummary.latestDepthReached, deriveDepthReachedFromSnapshot(nextSnapshot));
  const assistantTurn = await generateJoyAssistantTurn({
    dimension: session.dimension,
    sessionId: input.sessionId,
    stage: nextStage,
    snapshot: nextSnapshot,
    userMessage: input.action === "reply" ? input.userMessage : null,
    messages: session.messages,
    nextTurnCount,
    previousDepthReached: progressSummary.latestDepthReached,
    nextDepthReached,
    recentQuestions: progressSummary.recentQuestions,
    consecutiveNoDepthGain: progressSummary.consecutiveNoDepthGain,
    consecutiveInvalidReplies: progressSummary.consecutiveInvalidReplies,
    isMeaningfulReply,
    continueFromChoice
  });
  const finalized = finalizeAssistantTurn({
    session,
    prepared: {
      session,
      nextSnapshot,
      nextTurnCount,
      nextStage,
      userMessage: input.action === "reply" ? input.userMessage : null,
      inputMode: input.action === "reply" ? input.inputMode : undefined,
      continueFromChoice,
      isMeaningfulReply,
      previousDepthReached: progressSummary.latestDepthReached,
      nextDepthReached,
      consecutiveNoDepthGain: progressSummary.consecutiveNoDepthGain,
      consecutiveInvalidReplies: progressSummary.consecutiveInvalidReplies,
      hasOfferedChoice: progressSummary.hasOfferedChoice
    },
    assistantTurn
  });

  return {
    session,
    nextSnapshot,
    nextTurnCount,
    nextStage: finalized.nextStage,
    isReadyForDraft: finalized.isReadyForDraft,
    userMessage: input.action === "reply" ? input.userMessage : null,
    inputMode: input.action === "reply" ? input.inputMode : undefined,
    continueFromChoice,
    isMeaningfulReply,
    previousDepthReached: progressSummary.latestDepthReached,
    nextDepthReached,
    consecutiveNoDepthGain: progressSummary.consecutiveNoDepthGain,
    consecutiveInvalidReplies: progressSummary.consecutiveInvalidReplies,
    hasOfferedChoice: progressSummary.hasOfferedChoice,
    assistantTurn: finalized.assistantTurn
  } satisfies PreparedInterviewTurn;
}

export async function completeJoyInterviewResponse(input: PreparedInterviewTurn) {
  const updatedSession = await appendJoyInterviewTurn({
    sessionId: input.session.id,
    userMessage: input.userMessage ?? undefined,
    inputMode: input.inputMode,
    assistantTurn: input.assistantTurn,
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
    assistantMessage: input.assistantTurn.question || input.assistantTurn.insight,
    assistantTurn: input.assistantTurn,
    sessionStatus: updatedSession.status,
    turnCount: updatedSession.turnCount,
    snapshot: updatedSession.snapshot,
    isReadyForDraft: input.isReadyForDraft,
    session: updatedSession
  };
}

export async function respondToJoyInterview(input: InterviewRespondInput) {
  const prepared = await prepareJoyInterviewResponse(input);

  if ("assistantMessage" in prepared) {
    return prepared;
  }

  return completeJoyInterviewResponse(prepared);
}

export async function streamJoyInterviewResponse(
  input: InterviewRespondInput,
  callbacks: {
    onPhase: (phase: StreamingPhase) => Promise<void> | void;
    onDelta: (delta: { target: StreamingTarget; text: string }) => Promise<void> | void;
  }
) {
  const prepared = await prepareJoyInterviewResponse(input);

  if ("assistantMessage" in prepared) {
    await callbacks.onPhase("question");
    await callbacks.onDelta({
      target: "question",
      text: prepared.assistantMessage
    });
    return prepared;
  }

  await callbacks.onPhase("thinking");

  if (prepared.assistantTurn.insight) {
    await callbacks.onPhase("insight");
    await callbacks.onDelta({
      target: "insight",
      text: prepared.assistantTurn.insight
    });
  }

  if (prepared.assistantTurn.question) {
    await callbacks.onPhase("question");
    await callbacks.onDelta({
      target: "question",
      text: prepared.assistantTurn.question
    });
  }

  return completeJoyInterviewResponse(prepared);
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
