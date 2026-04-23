import { Prisma } from "@prisma/client";

import {
  assessUserTurnMessage,
  deriveDepthReachedFromSnapshot
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
  resumeCurrentInterviewEvent,
  saveJoyInterviewDraft,
  startNextInterviewEvent
} from "@/server/repositories/joy-interview.repository";
import {
  extractJoySnapshotWithAI,
  generateJoyAssistantTurn,
  streamJoyAssistantTurn,
  generateJoyDraftWithAI
} from "@/server/services/interview/joy-interview-ai.service";
import type {
  AssistantTurnPayload,
  InputMode,
  InterviewDimension,
  InterviewEventRecord,
  InterviewLens,
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
    }
  | {
      action: "continue_current_event";
      sessionId: string;
    }
  | {
      action: "next_event";
      sessionId: string;
    };

type StreamingPhase = "thinking" | "insight" | "question";
type StreamingTarget = "insight" | "question";
type CanonicalInterviewAction = "reply" | "continue_current_event" | "next_event";

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

interface PreparedInterviewTurnContext {
  session: InterviewSessionRecord;
  activeEvent: InterviewEventRecord;
  nextSnapshot: JoySnapshot;
  nextTurnCount: number;
  nextEventTurnCount: number;
  nextStage: JoyInterviewStage;
  nextEventStatus: InterviewEventRecord["status"];
  isReadyForDraft: boolean;
  userMessage: string | null;
  inputMode?: InputMode;
  isMeaningfulReply: boolean;
  coveredLenses: InterviewLens[];
  roundCoveredLenses: InterviewLens[];
  roundMeaningfulReplyCount: number;
  totalMeaningfulReplyCount: number;
  assistantTurn: AssistantTurnPayload | null;
  assistantAction: "reply" | "continue_current_event" | null;
}

type ResolvedPreparedInterviewTurn = PreparedInterviewTurnContext & {
  assistantTurn: AssistantTurnPayload;
  assistantAction: null;
};

function getCanonicalAction(action: InterviewRespondInput["action"]): CanonicalInterviewAction {
  if (action === "continue") {
    return "continue_current_event";
  }

  return action;
}

function getActiveEvent(session: InterviewSessionRecord) {
  return (
    session.events.find((event) => event.id === session.activeEventId) ??
    session.events.find((event) => event.status !== "completed") ??
    session.events[session.events.length - 1] ??
    null
  );
}

function uniqueLenses(...groups: InterviewLens[][]) {
  const order: InterviewLens[] = [
    "event_detail",
    "felt_experience",
    "importance_reason",
    "meaning_pattern",
    "self_pattern"
  ];
  const values = groups.flat();

  return order.filter((lens) => values.includes(lens));
}

function deriveInterviewLenses(snapshot: JoySnapshot): InterviewLens[] {
  return uniqueLenses([
    snapshot.event ? "event_detail" : null,
    snapshot.feeling ? "felt_experience" : null,
    snapshot.whyItMattered ? "importance_reason" : null,
    snapshot.happinessType ? "meaning_pattern" : null,
    snapshot.selfPattern ? "self_pattern" : null
  ].filter(Boolean) as InterviewLens[]);
}

function isEventCoreComplete(snapshot: JoySnapshot) {
  return Boolean(snapshot.event && snapshot.whyItMattered && (snapshot.happinessType || snapshot.selfPattern));
}

function buildChoiceInsight(snapshot: JoySnapshot) {
  if (snapshot.selfPattern) {
    return "这一段已经聊到你的在乎和模式了。";
  }

  if (snapshot.happinessType || snapshot.whyItMattered) {
    return "这一段开心的来龙去脉已经比较完整了。";
  }

  if (snapshot.event) {
    return "这个开心片段已经有了清楚的轮廓。";
  }

  return "这一段已经聊出一些轮廓了。";
}

function buildChoiceReason(round: number) {
  return round <= 1
    ? "当前事件已经完成一轮完整复盘，交给用户决定下一步。"
    : "当前事件已经完成这一轮新角度复盘，交给用户决定下一步。";
}

function buildChoiceAssistantTurn(snapshot: JoySnapshot, explorationRound: number): AssistantTurnPayload {
  return {
    insight: buildChoiceInsight(snapshot),
    analysis: "当前事件已形成完整复盘，下一步交给用户决定：继续深挖、切到下一件事，或直接生成日志。",
    question: "",
    stateUpdate: {
      turnPhase: "choice",
      shouldEndDimension: false,
      offerChoice: true,
      choiceReason: buildChoiceReason(explorationRound)
    },
    meta: {
      depthReached: deriveDepthReachedFromSnapshot(snapshot)
    }
  };
}

function shouldPresentChoice(input: {
  activeEvent: InterviewEventRecord;
  nextSnapshot: JoySnapshot;
  nextStage: JoyInterviewStage;
  isMeaningfulReply: boolean;
  nextEventTurnCount: number;
  nextRoundMeaningfulReplyCount: number;
}) {
  if (!input.isMeaningfulReply) {
    return false;
  }

  if (input.nextStage !== "wrap_up") {
    return false;
  }

  if (!isEventCoreComplete(input.nextSnapshot)) {
    return false;
  }

  if (input.activeEvent.explorationRound <= 1) {
    return input.nextEventTurnCount >= 3;
  }

  return input.nextRoundMeaningfulReplyCount >= 2;
}

function normalizeActiveStageBeforeChoice(input: {
  nextStage: JoyInterviewStage;
  shouldOfferChoiceNow: boolean;
}) {
  if (input.nextStage !== "wrap_up" || input.shouldOfferChoiceNow) {
    return input.nextStage;
  }

  // "wrap_up" only exists to hand control to the choice card. If we have not
  // reached that threshold yet, keep the event in the probing stage so the user
  // always receives a concrete follow-up instead of getting stuck on a summary.
  return "probe_pattern" as const;
}

function getNextEventOpeningQuestion(dimension: InterviewDimension) {
  switch (dimension) {
    case "joy":
      return "如果今天还有另一件让你开心的事，我们就聊那一件。那个瞬间是什么？";
    case "fulfillment":
      return "如果今天还有另一段让你觉得充实的经历，我们就聊那一段。那时发生了什么？";
    case "reflection":
      return "如果今天还有另一个让你停下来思考的片段，我们就聊那个时刻。它是什么？";
    case "improvement":
      return "如果今天还有另一个你想复盘的改进情境，我们就聊那件事。那一刻发生了什么？";
    case "gratitude":
      return "如果今天还有另一段让你想说谢谢的经历，我们就聊那一段。那个片段是什么？";
  }
}

function buildImmediateResponseFromSession(session: InterviewSessionRecord) {
  const latestAssistantMessage = [...session.messages].reverse().find((message) => message.role === "assistant");
  const assistantTurn = latestAssistantMessage?.assistantPayload ?? null;

  return {
    assistantMessage: assistantTurn?.question || assistantTurn?.insight || "",
    assistantTurn,
    sessionStatus: session.status,
    turnCount: session.turnCount,
    snapshot: session.snapshot,
    isReadyForDraft: session.draftGenerationUnlocked,
    session
  };
}

function applyFallbackQuestion(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  assistantTurn: AssistantTurnPayload;
}) {
  if (input.assistantTurn.question.trim()) {
    return input.assistantTurn;
  }

  return {
    ...input.assistantTurn,
    question: buildAssistantQuestion(input.dimension, input.stage, input.snapshot)
  };
}

function buildAssistantGenerationInput(input: PreparedInterviewTurnContext & {
  assistantAction: "reply" | "continue_current_event";
}) {
  return {
    dimension: input.session.dimension,
    sessionId: input.session.id,
    stage: input.nextStage,
    snapshot: input.nextSnapshot,
    events: input.session.events,
    activeEvent: input.activeEvent,
    userMessage: input.userMessage,
    messages: input.session.messages,
    nextTurnCount: input.nextTurnCount,
    nextEventTurnCount: input.nextEventTurnCount,
    previousDepthReached: deriveDepthReachedFromSnapshot(input.activeEvent.snapshot),
    nextDepthReached: deriveDepthReachedFromSnapshot(input.nextSnapshot),
    coveredLenses: input.coveredLenses,
    roundCoveredLenses: input.roundCoveredLenses,
    isMeaningfulReply: input.isMeaningfulReply,
    action: input.assistantAction
  } as const;
}

function finalizeAssistantTurn(
  input: PreparedInterviewTurnContext,
  assistantTurn: AssistantTurnPayload
): ResolvedPreparedInterviewTurn {
  const finalizedAssistantTurn = applyFallbackQuestion({
    dimension: input.session.dimension,
    stage: input.nextStage,
    snapshot: input.nextSnapshot,
    assistantTurn
  });

  if (input.assistantAction === "continue_current_event") {
    return {
      ...input,
      assistantAction: null,
      assistantTurn: {
        ...finalizedAssistantTurn,
        insight: finalizedAssistantTurn.question ? "" : finalizedAssistantTurn.insight,
        stateUpdate: {
          ...finalizedAssistantTurn.stateUpdate,
          turnPhase: "digging",
          shouldEndDimension: false,
          offerChoice: false,
          choiceReason: ""
        }
      }
    };
  }

  return {
    ...input,
    assistantAction: null,
    assistantTurn: {
      ...finalizedAssistantTurn,
      stateUpdate: {
        ...finalizedAssistantTurn.stateUpdate,
        turnPhase: input.nextStage === "collect_event" ? "opening" : "digging",
        shouldEndDimension: false,
        offerChoice: false,
        choiceReason: ""
      }
    }
  };
}

async function resolvePreparedInterviewTurn(
  input: PreparedInterviewTurnContext,
  callbacks?: {
    onDelta?: (delta: { target: StreamingTarget; text: string }) => Promise<void> | void;
  }
) : Promise<ResolvedPreparedInterviewTurn> {
  if (input.assistantTurn) {
    return {
      ...input,
      assistantTurn: input.assistantTurn,
      assistantAction: null
    };
  }

  if (!input.assistantAction) {
    throw new Error("ASSISTANT_ACTION_MISSING");
  }

  const assistantInput = buildAssistantGenerationInput({
    ...input,
    assistantAction: input.assistantAction
  });
  const generatedAssistantTurn = callbacks?.onDelta
    ? await streamJoyAssistantTurn(assistantInput, {
        onDelta: async (delta) => {
          if (assistantInput.action === "continue_current_event" && delta.target === "insight") {
            return;
          }

          await callbacks.onDelta?.(delta);
        }
      })
    : await generateJoyAssistantTurn(assistantInput);

  return finalizeAssistantTurn(input, generatedAssistantTurn);
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

async function prepareJoyInterviewResponseContext(input: InterviewRespondInput) {
  const session = await getActiveInterviewSession(input.sessionId);

  if ("assistantMessage" in session) {
    return session;
  }

  const canonicalAction = getCanonicalAction(input.action);
  const activeEvent = getActiveEvent(session);

  if (!activeEvent) {
    throw new Error("SESSION_EVENT_NOT_FOUND");
  }

  if (canonicalAction === "continue_current_event") {
    if (session.pendingDecision?.eventId !== activeEvent.id) {
      throw new Error("SESSION_CONTINUE_UNAVAILABLE");
    }

    const resumedSession = await resumeCurrentInterviewEvent(session.id);
    const resumedEvent = resumedSession ? getActiveEvent(resumedSession) : null;

    if (!resumedSession || !resumedEvent) {
      throw new Error("SESSION_NOT_FOUND");
    }

    return {
      session: resumedSession,
      activeEvent: resumedEvent,
      nextSnapshot: resumedEvent.snapshot,
      nextTurnCount: resumedSession.turnCount,
      nextEventTurnCount: resumedEvent.totalMeaningfulReplyCount,
      nextStage: resumedEvent.stage,
      nextEventStatus: "active" as const,
      isReadyForDraft: false,
      userMessage: null,
      isMeaningfulReply: false,
      coveredLenses: resumedEvent.coveredLenses,
      roundCoveredLenses: resumedEvent.roundCoveredLenses,
      roundMeaningfulReplyCount: resumedEvent.roundMeaningfulReplyCount,
      totalMeaningfulReplyCount: resumedEvent.totalMeaningfulReplyCount,
      assistantTurn: null,
      assistantAction: "continue_current_event"
    } satisfies PreparedInterviewTurnContext;
  }

  if (canonicalAction === "next_event") {
    if (session.pendingDecision?.eventId !== activeEvent.id) {
      throw new Error("SESSION_NEXT_EVENT_UNAVAILABLE");
    }

    const nextSession = await startNextInterviewEvent(session.id, getNextEventOpeningQuestion(session.dimension));

    if (!nextSession) {
      throw new Error("SESSION_NOT_FOUND");
    }

    return buildImmediateResponseFromSession(nextSession);
  }

  if (input.action !== "reply") {
    throw new Error("INTERVIEW_ACTION_UNSUPPORTED");
  }

  const assessment = assessUserTurnMessage(input.userMessage);
  const isMeaningfulReply = assessment.isMeaningful;
  const nextSnapshot = isMeaningfulReply
    ? await extractJoySnapshotWithAI({
        session,
        userMessage: input.userMessage
      })
    : activeEvent.snapshot;
  const nextTurnCount = session.turnCount + (isMeaningfulReply ? 1 : 0);
  const nextEventTurnCount = activeEvent.totalMeaningfulReplyCount + (isMeaningfulReply ? 1 : 0);
  const derivedNextStage = getNextStage(nextSnapshot, nextEventTurnCount);
  const nextLenses = deriveInterviewLenses(nextSnapshot);
  const coveredLenses = uniqueLenses(activeEvent.coveredLenses, nextLenses);
  const roundCoveredLenses = isMeaningfulReply
    ? uniqueLenses(activeEvent.roundCoveredLenses, nextLenses)
    : activeEvent.roundCoveredLenses;
  const roundMeaningfulReplyCount = activeEvent.roundMeaningfulReplyCount + (isMeaningfulReply ? 1 : 0);
  const totalMeaningfulReplyCount = nextEventTurnCount;
  const shouldOfferChoiceNow = shouldPresentChoice({
    activeEvent,
    nextSnapshot,
    nextStage: derivedNextStage,
    isMeaningfulReply,
    nextEventTurnCount,
    nextRoundMeaningfulReplyCount: roundMeaningfulReplyCount
  });
  const nextStage = normalizeActiveStageBeforeChoice({
    nextStage: derivedNextStage,
    shouldOfferChoiceNow
  });

  return {
    session,
    activeEvent,
    nextSnapshot,
    nextTurnCount,
    nextEventTurnCount,
    nextStage,
    nextEventStatus: shouldOfferChoiceNow ? "ready_for_choice" : "active",
    isReadyForDraft: shouldOfferChoiceNow || Boolean(session.journalEntry),
    userMessage: input.userMessage,
    inputMode: input.inputMode,
    isMeaningfulReply,
    coveredLenses,
    roundCoveredLenses,
    roundMeaningfulReplyCount,
    totalMeaningfulReplyCount,
    assistantTurn: shouldOfferChoiceNow ? buildChoiceAssistantTurn(nextSnapshot, activeEvent.explorationRound) : null,
    assistantAction: shouldOfferChoiceNow ? null : "reply"
  } satisfies PreparedInterviewTurnContext;
}

export async function prepareJoyInterviewResponse(input: InterviewRespondInput) {
  const prepared = await prepareJoyInterviewResponseContext(input);

  if ("assistantMessage" in prepared) {
    return prepared;
  }

  return resolvePreparedInterviewTurn(prepared);
}

export async function completeJoyInterviewResponse(
  input: ResolvedPreparedInterviewTurn
) {
  const updatedSession = await appendJoyInterviewTurn({
    sessionId: input.session.id,
    activeEventId: input.activeEvent.id,
    userMessage: input.userMessage ?? undefined,
    inputMode: input.inputMode,
    assistantTurn: input.assistantTurn,
    snapshot: input.nextSnapshot,
    eventStatus: input.nextEventStatus,
    nextStage: input.nextStage,
    nextStatus: "active",
    nextTurnCount: input.nextTurnCount,
    coveredLenses: input.coveredLenses,
    roundCoveredLenses: input.roundCoveredLenses,
    roundMeaningfulReplyCount: input.roundMeaningfulReplyCount,
    totalMeaningfulReplyCount: input.totalMeaningfulReplyCount,
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
    isReadyForDraft: updatedSession.draftGenerationUnlocked || input.isReadyForDraft,
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
  const prepared = await prepareJoyInterviewResponseContext(input);

  if ("assistantMessage" in prepared) {
    if (prepared.assistantTurn?.insight) {
      await callbacks.onPhase("insight");
      await callbacks.onDelta({
        target: "insight",
        text: prepared.assistantTurn.insight
      });
    }

    if (prepared.assistantTurn?.question || prepared.assistantMessage) {
      await callbacks.onPhase("question");
      await callbacks.onDelta({
        target: "question",
        text: prepared.assistantTurn?.question || prepared.assistantMessage
      });
    }

    return prepared;
  }

  if (prepared.assistantTurn) {
    const resolvedPrepared: ResolvedPreparedInterviewTurn = {
      ...prepared,
      assistantTurn: prepared.assistantTurn,
      assistantAction: null
    };

    if (resolvedPrepared.assistantTurn.insight) {
      await callbacks.onPhase("insight");
      await callbacks.onDelta({
        target: "insight",
        text: resolvedPrepared.assistantTurn.insight
      });
    }

    if (resolvedPrepared.assistantTurn.question) {
      await callbacks.onPhase("question");
      await callbacks.onDelta({
        target: "question",
        text: resolvedPrepared.assistantTurn.question
      });
    }

    return completeJoyInterviewResponse(resolvedPrepared);
  }

  await callbacks.onPhase("thinking");

  const streamedText: Record<StreamingTarget, string> = {
    insight: "",
    question: ""
  };
  let activePhase: StreamingPhase | null = "thinking";
  const emitPhase = async (phase: StreamingPhase) => {
    if (activePhase === phase) {
      return;
    }

    activePhase = phase;
    await callbacks.onPhase(phase);
  };
  const completed = await resolvePreparedInterviewTurn(prepared, {
    onDelta: async (delta) => {
      if (!delta.text) {
        return;
      }

      streamedText[delta.target] += delta.text;
      await emitPhase(delta.target);
      await callbacks.onDelta(delta);
    }
  });

  if (
    completed.assistantTurn.insight &&
    completed.assistantTurn.insight.startsWith(streamedText.insight) &&
    streamedText.insight !== completed.assistantTurn.insight
  ) {
    await emitPhase("insight");
    await callbacks.onDelta({
      target: "insight",
      text: completed.assistantTurn.insight.slice(streamedText.insight.length)
    });
  }

  if (
    completed.assistantTurn.question &&
    completed.assistantTurn.question.startsWith(streamedText.question) &&
    streamedText.question !== completed.assistantTurn.question
  ) {
    await emitPhase("question");
    await callbacks.onDelta({
      target: "question",
      text: completed.assistantTurn.question.slice(streamedText.question.length)
    });
  }

  return completeJoyInterviewResponse(completed);
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
