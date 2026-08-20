import {
  getEventCenteredGenerativePlanCheckpoint,
  reserveEventCenteredUserAction
} from "@/server/repositories/event-centered-interview.repository";
import { resumeEventCenteredTurnUnderstanding } from "@/server/repositories/journal-event-understanding.repository";
import type { EventCenteredRespondRequest } from "@/types/event-centered-dialogue";
import type {
  EventCenteredInterviewWorkspaceData,
  EventCenteredOperationData,
  ReserveEventCenteredTurnResult
} from "@/types/event-centered-interview";

export type EventCenteredUserOperation =
  | "content_reply"
  | "select_current_event"
  | "select_exploration_angle"
  | "continue_exploration"
  | "generate_event_journal"
  | "correct_understanding"
  | "regenerate_response"
  | "switch_response_version"
  | "repair_question"
  | "exit_event"
  | "resume_failed_turn";

function eventCenteredActionOperationData(
  input: EventCenteredRespondRequest
): EventCenteredOperationData | null {
  if (input.action === "select_current_event") {
    return {
      kind: "select_current_event",
      optionId: input.optionId!,
      displayText: input.rawText || input.optionId
    };
  }
  if (input.action === "select_exploration_angle") {
    return {
      kind: "select_exploration_angle",
      angle: input.angle!,
      displayText: input.rawText
    };
  }
  if (input.action === "continue_exploration") {
    return {
      kind: "continue_exploration",
      angle: input.angle,
      displayText: input.rawText
    };
  }
  if (input.action === "exit_event") {
    return {
      kind: "exit_event",
      reason: input.rawText,
      displayText: input.rawText
    };
  }
  return null;
}

export async function reserveEventCenteredRespondTurn(input: {
  userId: string;
  request: EventCenteredRespondRequest;
}): Promise<ReserveEventCenteredTurnResult> {
  const request = input.request;
  if (
    request.baseBranchSessionId === undefined ||
    request.baseMessageSequence === undefined
  ) {
    throw new Error("EVENT_STATE_CHANGED");
  }
  if (request.action === "reply" || request.action === "correct_understanding") {
    return reserveEventCenteredUserAction({
      userId: input.userId,
      rootSessionId: request.rootSessionId,
      clientTurnId: request.clientTurnId,
      baseBranchSessionId: request.baseBranchSessionId,
      baseMessageSequence: request.baseMessageSequence,
      action: request.action,
      rawText: request.rawText ?? "",
      inputMode: request.inputMode ?? "text",
      targetMessageId:
        request.action === "correct_understanding"
          ? request.targetMessageId
          : undefined
    });
  }
  if (request.action === "select_current_event") {
    const operation = eventCenteredActionOperationData(request) as Extract<
      EventCenteredOperationData,
      { kind: "select_current_event" }
    >;
    return reserveEventCenteredUserAction({
      userId: input.userId,
      rootSessionId: request.rootSessionId,
      clientTurnId: request.clientTurnId,
      baseBranchSessionId: request.baseBranchSessionId,
      baseMessageSequence: request.baseMessageSequence,
      action: request.action,
      rawText: request.rawText || request.optionId,
      inputMode: request.inputMode ?? "text",
      eventOperationData: operation
    });
  }
  if (request.action === "select_exploration_angle") {
    return reserveEventCenteredUserAction({
      userId: input.userId,
      rootSessionId: request.rootSessionId,
      clientTurnId: request.clientTurnId,
      baseBranchSessionId: request.baseBranchSessionId,
      baseMessageSequence: request.baseMessageSequence,
      action: request.action,
      inputMode: request.inputMode ?? "text",
      eventOperationData: eventCenteredActionOperationData(request) as Extract<
        EventCenteredOperationData,
        { kind: "select_exploration_angle" }
      >
    });
  }
  if (request.action === "continue_exploration") {
    return reserveEventCenteredUserAction({
      userId: input.userId,
      rootSessionId: request.rootSessionId,
      clientTurnId: request.clientTurnId,
      baseBranchSessionId: request.baseBranchSessionId,
      baseMessageSequence: request.baseMessageSequence,
      action: request.action,
      inputMode: request.inputMode ?? "text",
      eventOperationData: eventCenteredActionOperationData(request) as Extract<
        EventCenteredOperationData,
        { kind: "continue_exploration" }
      >
    });
  }
  if (request.action === "exit_event") {
    return reserveEventCenteredUserAction({
      userId: input.userId,
      rootSessionId: request.rootSessionId,
      clientTurnId: request.clientTurnId,
      baseBranchSessionId: request.baseBranchSessionId,
      baseMessageSequence: request.baseMessageSequence,
      action: request.action,
      inputMode: request.inputMode ?? "text",
      eventOperationData: eventCenteredActionOperationData(request) as Extract<
        EventCenteredOperationData,
        { kind: "exit_event" }
      >
    });
  }
  throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
}

export function getEventCenteredResumeAttemptContext(
  pendingTurn: NonNullable<EventCenteredInterviewWorkspaceData["pendingTurn"]>
) {
  return {
    turnId: pendingTurn.id,
    attemptCount:
      pendingTurn.status === "failed" || pendingTurn.status === "canceled"
        ? pendingTurn.attemptCount + 1
        : pendingTurn.attemptCount
  };
}

export async function resumeEventCenteredRespondTurn(input: {
  userId: string;
  workspace: EventCenteredInterviewWorkspaceData;
  clientTurnId: string;
  expectedTurnId: string;
  expectedAttemptCount: number;
}) {
  const pending = input.workspace.pendingTurn;
  if (!pending || pending.clientTurnId !== input.clientTurnId) {
    throw new Error("EVENT_STATE_CHANGED");
  }

  const resumedGenerativeCheckpoint =
    await getEventCenteredGenerativePlanCheckpoint({
      userId: input.userId,
      rootSessionId: input.workspace.identity.rootSessionId,
      activeBranchSessionId: input.workspace.identity.activeBranchSessionId,
      clientTurnId: input.clientTurnId
    });
  const resumedTurn = await resumeEventCenteredTurnUnderstanding({
    userId: input.userId,
    activeBranchSessionId: input.workspace.identity.activeBranchSessionId,
    clientTurnId: input.clientTurnId
  });
  if (
    resumedTurn.id !== input.expectedTurnId ||
    resumedTurn.attemptCount !== input.expectedAttemptCount
  ) {
    throw new Error("EVENT_STATE_CHANGED");
  }
  const userMessage = input.workspace.messages.find(
    (message) => message.userTurnId === pending.id
  );
  if (
    !input.workspace.identity.eventId ||
    !input.workspace.identity.branchStateId ||
    !userMessage
  ) {
    throw new Error("EVENT_STATE_CHANGED");
  }
  const operation =
    resumedGenerativeCheckpoint?.operationData ?? pending.eventOperationData;
  const effectiveRequest: EventCenteredRespondRequest = {
    action: pending.action,
    rootSessionId: input.workspace.identity.rootSessionId,
    clientTurnId: pending.clientTurnId,
    baseBranchSessionId:
      pending.baseBranchSessionId ??
      input.workspace.identity.activeBranchSessionId,
    baseMessageSequence: pending.baseMessageSequence,
    rawText: pending.rawText,
    inputMode: pending.inputMode,
    angle:
      operation?.kind === "select_exploration_angle"
        ? operation.angle
        : undefined,
    optionId:
      operation?.kind === "select_current_event"
        ? operation.optionId
        : undefined,
    targetMessageId: pending.targetMessageId ?? undefined
  };
  const reservation: ReserveEventCenteredTurnResult = {
    kind: "existing",
    eventId: input.workspace.identity.eventId,
    rootSessionId: input.workspace.identity.rootSessionId,
    activeBranchSessionId: input.workspace.identity.activeBranchSessionId,
    branchStateId: input.workspace.identity.branchStateId,
    userMessageId: userMessage.id,
    turn: {
      id: pending.id,
      clientTurnId: pending.clientTurnId,
      sessionId: pending.sessionId,
      rawText: pending.rawText,
      inputMode: pending.inputMode,
      baseMessageSequence: pending.baseMessageSequence,
      status: "processing",
      createdAt: pending.createdAt
    }
  };

  return {
    effectiveRequest,
    reservation,
    resumedGenerativeCheckpoint
  };
}

export function getEffectiveEventCenteredOperation(
  action: EventCenteredRespondRequest["action"]
): EventCenteredUserOperation {
  if (action === "select_current_event") return "select_current_event";
  if (action === "select_exploration_angle") return "select_exploration_angle";
  if (action === "continue_exploration") return "continue_exploration";
  if (action === "exit_event") return "exit_event";
  if (action === "correct_understanding") return "correct_understanding";
  if (action === "regenerate_response") return "regenerate_response";
  if (action === "resume_turn") return "resume_failed_turn";
  return "content_reply";
}
