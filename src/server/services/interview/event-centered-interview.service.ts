import { getTodayEntryDate } from "@/features/interview/entry-date";
import {
  getEventCenteredSessionIdentity,
  reserveEventCenteredUserTurn,
  startEventCenteredInterviewSession
} from "@/server/repositories/event-centered-interview.repository";
import {
  commitEventCenteredTurnUnderstanding,
  confirmPendingUnderstandingClaim,
  getEffectiveJournalEventFacts,
  markEventCenteredTurnUnderstandingFailed,
  resumeEventCenteredTurnUnderstanding
} from "@/server/repositories/journal-event-understanding.repository";
import type { CommitEventCenteredTurnUnderstandingInput } from "@/types/journal-event-understanding";

const EVENT_CENTERED_OPENING = "先从这件事开始吧。刚刚发生了什么？";

export function startEventCenteredInterview(userId: string, entryDate = getTodayEntryDate()) {
  return startEventCenteredInterviewSession({
    userId,
    entryDate,
    openingQuestion: EVENT_CENTERED_OPENING
  });
}

export function getEventCenteredInterview(userId: string, sessionId: string) {
  return getEventCenteredSessionIdentity(userId, sessionId);
}

export function acceptEventCenteredUserTurn(input: {
  userId: string;
  rootSessionId: string;
  clientTurnId: string;
  rawText: string;
  inputMode: "text" | "voice";
  baseMessageSequence: number;
  baseBranchSessionId: string;
}) {
  return reserveEventCenteredUserTurn(input);
}

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

const confirmingOperations = new Set<EventCenteredUserOperation>([
  "content_reply",
  "select_current_event",
  "select_exploration_angle",
  "continue_exploration",
  "generate_event_journal"
]);

export function isEventCenteredForwardOperation(operation: EventCenteredUserOperation) {
  return confirmingOperations.has(operation);
}

export function confirmEventCenteredUnderstandingAfterIntent(input: {
  operation: EventCenteredUserOperation;
  userTurnId: string;
  activeBranchSessionId: string;
}) {
  if (!isEventCenteredForwardOperation(input.operation)) {
    return Promise.resolve({
      kind: "no_eligible_claim" as const,
      claimId: null,
      factId: null
    });
  }
  return confirmPendingUnderstandingClaim(input.userTurnId, input.activeBranchSessionId);
}

export function commitEventCenteredUnderstanding(
  input: CommitEventCenteredTurnUnderstandingInput
) {
  return commitEventCenteredTurnUnderstanding(input);
}

export {
  getEffectiveJournalEventFacts,
  markEventCenteredTurnUnderstandingFailed,
  resumeEventCenteredTurnUnderstanding
};
