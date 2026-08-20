import { beforeEach, describe, expect, it, vi } from "vitest";

const { startEventCenteredInterview, getEventCenteredInterviewWorkspace } = vi.hoisted(() => ({
  startEventCenteredInterview: vi.fn(),
  getEventCenteredInterviewWorkspace: vi.fn()
}));
const { requireCurrentUserFromRequest } = vi.hoisted(() => ({
  requireCurrentUserFromRequest: vi.fn()
}));

vi.mock("@/server/services/interview/event-centered-interview.service", () => ({
  startEventCenteredInterview,
  getEventCenteredInterviewWorkspace
}));
vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest,
  isAuthenticationRequiredError: () => false
}));

import { POST } from "@/app/api/interview/event-centered/session/start/route";
import { EventCenteredUnfinishedLimitReachedError } from "@/server/repositories/event-centered-interview.repository";

const validRequest = {
  entryDate: "2026-07-22",
  recordMode: "capture",
  clientOperationId: "start-op-1"
};

describe("event-centered session start api", () => {
  beforeEach(() => {
    startEventCenteredInterview.mockReset();
    getEventCenteredInterviewWorkspace.mockReset();
    requireCurrentUserFromRequest.mockReset();
    requireCurrentUserFromRequest.mockResolvedValue({ id: "user-1" });
  });

  it("returns a recoverable conflict when the date belongs to the legacy route", async () => {
    startEventCenteredInterview.mockRejectedValueOnce(new Error("JOURNAL_DAY_MODE_CONFLICT"));

    const response = await POST(new Request("http://localhost/api/interview/event-centered/session/start", {
      method: "POST",
      body: JSON.stringify(validRequest)
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "JOURNAL_DAY_MODE_CONFLICT",
      issue: {
        code: "JOURNAL_DAY_MODE_CONFLICT",
        action: "open_journal",
        retryable: false,
        requestId: expect.any(String)
      }
    });
  });

  it("returns a recoverable conflict while the event entry release is closed", async () => {
    startEventCenteredInterview.mockRejectedValueOnce(new Error("EVENT_CENTERED_ENTRY_DISABLED"));

    const response = await POST(new Request("http://localhost/api/interview/event-centered/session/start", {
      method: "POST",
      body: JSON.stringify(validRequest)
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "EVENT_CENTERED_ENTRY_DISABLED",
      issue: {
        action: "refresh",
        resolution: expect.any(String),
        requestId: expect.any(String)
      }
    });
  });

  it("forwards the selected record mode into the durable session", async () => {
    startEventCenteredInterview.mockRejectedValueOnce(new Error("EVENT_CENTERED_ENTRY_DISABLED"));

    const response = await POST(new Request("http://localhost/api/interview/event-centered/session/start", {
      method: "POST",
      body: JSON.stringify(validRequest)
    }));

    expect(response.status).toBe(409);
    expect(startEventCenteredInterview).toHaveBeenCalledWith(
      "user-1",
      "2026-07-22",
      "capture",
      "start-op-1"
    );
  });

  it("returns the two-record limit with a user-facing recovery action", async () => {
    startEventCenteredInterview.mockRejectedValueOnce(new EventCenteredUnfinishedLimitReachedError(2, 2));

    const response = await POST(new Request("http://localhost/api/interview/event-centered/session/start", {
      method: "POST",
      body: JSON.stringify(validRequest)
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "EVENT_CENTERED_UNFINISHED_LIMIT_REACHED",
      unfinishedCount: 2,
      unfinishedLimit: 2,
      issue: {
        title: "先完成一条记录",
        resolution: expect.any(String),
        retryable: false,
        action: "complete_existing",
        requestId: expect.any(String)
      }
    });
  });

  it("rejects an unknown record mode before creating a session", async () => {
    const response = await POST(new Request("http://localhost/api/interview/event-centered/session/start", {
      method: "POST",
      body: JSON.stringify({ ...validRequest, recordMode: "unknown" })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_START_REQUEST",
      issue: {
        title: "无法开始记录",
        action: "review_input",
        requestId: expect.any(String)
      }
    });
    expect(startEventCenteredInterview).not.toHaveBeenCalled();
  });
});
