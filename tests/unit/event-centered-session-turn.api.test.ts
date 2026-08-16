import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acceptTurn: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@/server/services/interview/event-centered-interview.service", () => ({
  acceptEventCenteredUserTurn: mocks.acceptTurn,
  EventCenteredGenerationBlockedError: class EventCenteredGenerationBlockedError extends Error {}
}));
vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest: mocks.requireUser,
  isAuthenticationRequiredError: (error: unknown) =>
    error instanceof Error && error.message === "AUTHENTICATION_REQUIRED"
}));

import { POST } from "@/app/api/interview/event-centered/session/turn/route";

const validBody = {
  rootSessionId: "root-1",
  clientTurnId: "client-turn-1",
  rawText: "今天开会时我主动说明了延期风险。",
  inputMode: "text",
  baseMessageSequence: 1,
  baseBranchSessionId: "branch-1"
};

function request(body: unknown = validBody) {
  return new Request("http://localhost/api/interview/event-centered/session/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("event-centered session turn api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
  });

  it("returns the durable turn confirmation", async () => {
    mocks.acceptTurn.mockResolvedValue({
      kind: "reserved",
      eventId: "event-1",
      rootSessionId: "root-1",
      activeBranchSessionId: "branch-1",
      branchStateId: "state-1",
      userMessageId: "message-1",
      turn: {
        id: "turn-1",
        clientTurnId: "client-turn-1",
        sessionId: "branch-1",
        rawText: validBody.rawText,
        inputMode: "text",
        baseMessageSequence: 1,
        status: "processing",
        createdAt: "2026-08-12T10:00:00.000Z"
      }
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      kind: "reserved",
      turn: { clientTurnId: "client-turn-1", status: "processing" }
    });
  });

  it("returns a structured refresh action for an invalid request", async () => {
    const response = await POST(request({ ...validBody, rawText: "  " }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_EVENT_TURN_REQUEST",
      issue: {
        code: "INVALID_EVENT_TURN_REQUEST",
        action: "refresh",
        resolution: expect.any(String),
        requestId: expect.any(String)
      }
    });
    expect(mocks.acceptTurn).not.toHaveBeenCalled();
  });

  it("maps an old page submission to the latest conversation", async () => {
    mocks.acceptTurn.mockRejectedValue(new Error("EVENT_STATE_CHANGED"));

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "INTERVIEW_TURN_OUT_OF_DATE",
      issue: {
        code: "INTERVIEW_TURN_OUT_OF_DATE",
        action: "refresh",
        requestId: expect.any(String)
      }
    });
  });

  it("returns a structured retry action for an unexpected save failure", async () => {
    mocks.acceptTurn.mockRejectedValue(new Error("EVENT_TURN_FAILED"));

    const response = await POST(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "INTERVIEW_RESPOND_FAILED",
      issue: {
        action: "retry",
        resolution: expect.any(String),
        requestId: expect.any(String)
      }
    });
  });
});
