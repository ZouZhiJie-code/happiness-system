import { beforeEach, describe, expect, it, vi } from "vitest";

const { confirmPendingUnderstandingClaim } = vi.hoisted(() => ({
  confirmPendingUnderstandingClaim: vi.fn()
}));

vi.mock("@/server/repositories/event-centered-interview.repository", () => ({
  getEventCenteredSessionIdentity: vi.fn(),
  reserveEventCenteredUserTurn: vi.fn(),
  startEventCenteredInterviewSession: vi.fn()
}));

vi.mock("@/server/repositories/journal-event-understanding.repository", () => ({
  commitEventCenteredTurnUnderstanding: vi.fn(),
  confirmPendingUnderstandingClaim,
  getEffectiveJournalEventFacts: vi.fn(),
  markEventCenteredTurnUnderstandingFailed: vi.fn(),
  resumeEventCenteredTurnUnderstanding: vi.fn()
}));

import {
  confirmEventCenteredUnderstandingAfterIntent,
  isEventCenteredForwardOperation,
  type EventCenteredUserOperation
} from "@/server/services/interview/event-centered-interview.service";

describe("event-centered implicit confirmation policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmPendingUnderstandingClaim.mockResolvedValue({
      kind: "confirmed",
      claimId: "claim-1",
      factId: "fact-1"
    });
  });

  it.each<EventCenteredUserOperation>([
    "content_reply",
    "select_current_event",
    "select_exploration_angle",
    "continue_exploration",
    "generate_event_journal"
  ])("confirms the pending claim after %s", async (operation) => {
    expect(isEventCenteredForwardOperation(operation)).toBe(true);
    await expect(
      confirmEventCenteredUnderstandingAfterIntent({
        operation,
        userTurnId: "turn-1",
        activeBranchSessionId: "branch-1"
      })
    ).resolves.toMatchObject({ kind: "confirmed" });
    expect(confirmPendingUnderstandingClaim).toHaveBeenCalledTimes(1);
  });

  it.each<EventCenteredUserOperation>([
    "correct_understanding",
    "regenerate_response",
    "switch_response_version",
    "repair_question",
    "exit_event",
    "resume_failed_turn"
  ])("keeps the pending claim unchanged after %s", async (operation) => {
    expect(isEventCenteredForwardOperation(operation)).toBe(false);
    await expect(
      confirmEventCenteredUnderstandingAfterIntent({
        operation,
        userTurnId: "turn-1",
        activeBranchSessionId: "branch-1"
      })
    ).resolves.toEqual({ kind: "no_eligible_claim", claimId: null, factId: null });
    expect(confirmPendingUnderstandingClaim).not.toHaveBeenCalled();
  });
});
