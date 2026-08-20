import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getEventCenteredInterviewWorkspace,
  listEventCenteredSessions,
  listEventCenteredSessionTabsByDate,
  requireCurrentUserFromRequest
} = vi.hoisted(() => ({
  getEventCenteredInterviewWorkspace: vi.fn(),
  listEventCenteredSessions: vi.fn(),
  listEventCenteredSessionTabsByDate: vi.fn(),
  requireCurrentUserFromRequest: vi.fn()
}));

vi.mock("@/server/services/interview/event-centered-interview.service", () => ({
  getEventCenteredInterviewWorkspace
}));
vi.mock("@/server/repositories/event-centered-interview.repository", () => ({
  listEventCenteredSessions,
  listEventCenteredSessionTabsByDate
}));
vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest,
  isAuthenticationRequiredError: (error: unknown) =>
    error instanceof Error && error.message === "AUTHENTICATION_REQUIRED"
}));

import { GET as readSession } from "@/app/api/interview/event-centered/session/[id]/route";
import { GET as readSessions } from "@/app/api/interview/event-centered/sessions/route";

describe("event-centered session read APIs", () => {
  beforeEach(() => {
    getEventCenteredInterviewWorkspace.mockReset();
    listEventCenteredSessions.mockReset();
    listEventCenteredSessionTabsByDate.mockReset();
    requireCurrentUserFromRequest.mockReset();
    requireCurrentUserFromRequest.mockResolvedValue({ id: "user-1" });
  });

  it("returns a structured recovery issue when a session no longer exists", async () => {
    getEventCenteredInterviewWorkspace.mockResolvedValueOnce(null);

    const response = await readSession(
      new Request("http://localhost/api/interview/event-centered/session/missing"),
      { params: Promise.resolve({ id: "missing" }) }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "SESSION_NOT_FOUND",
      issue: {
        code: "SESSION_NOT_FOUND",
        resolution: expect.any(String),
        action: "refresh",
        requestId: expect.any(String)
      }
    });
  });

  it("returns a structured issue for an invalid session list limit", async () => {
    const response = await readSessions(
      new Request("http://localhost/api/interview/event-centered/sessions?limit=0")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_SESSION_LIMIT",
      issue: {
        action: "refresh",
        resolution: expect.any(String),
        requestId: expect.any(String)
      }
    });
    expect(listEventCenteredSessions).not.toHaveBeenCalled();
  });

  it("returns a structured refresh action when pagination became stale", async () => {
    listEventCenteredSessions.mockRejectedValueOnce(new Error("INVALID_SESSION_CURSOR"));

    const response = await readSessions(
      new Request("http://localhost/api/interview/event-centered/sessions?limit=30&cursor=stale")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_SESSION_CURSOR",
      issue: {
        title: "记录列表已经更新",
        action: "refresh",
        requestId: expect.any(String)
      }
    });
  });
});
