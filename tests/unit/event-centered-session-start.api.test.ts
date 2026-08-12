import { beforeEach, describe, expect, it, vi } from "vitest";

const { startEventCenteredInterview } = vi.hoisted(() => ({
  startEventCenteredInterview: vi.fn()
}));
const { requireCurrentUserFromRequest } = vi.hoisted(() => ({
  requireCurrentUserFromRequest: vi.fn()
}));

vi.mock("@/server/services/interview/event-centered-interview.service", () => ({
  startEventCenteredInterview
}));
vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest,
  isAuthenticationRequiredError: () => false
}));

import { POST } from "@/app/api/interview/event-centered/session/start/route";

describe("event-centered session start api", () => {
  beforeEach(() => {
    startEventCenteredInterview.mockReset();
    requireCurrentUserFromRequest.mockReset();
    requireCurrentUserFromRequest.mockResolvedValue({ id: "user-1" });
  });

  it("returns a recoverable conflict when the date belongs to the legacy route", async () => {
    startEventCenteredInterview.mockRejectedValueOnce(new Error("JOURNAL_DAY_MODE_CONFLICT"));

    const response = await POST(new Request("http://localhost/api/interview/event-centered/session/start", {
      method: "POST",
      body: JSON.stringify({ entryDate: "2026-07-22" })
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "JOURNAL_DAY_MODE_CONFLICT" });
  });

  it("returns a recoverable conflict while the event entry release is closed", async () => {
    startEventCenteredInterview.mockRejectedValueOnce(new Error("EVENT_CENTERED_ENTRY_DISABLED"));

    const response = await POST(new Request("http://localhost/api/interview/event-centered/session/start", {
      method: "POST",
      body: JSON.stringify({ entryDate: "2026-07-22" })
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "EVENT_CENTERED_ENTRY_DISABLED" });
  });

  it("forwards the selected record mode into the durable session", async () => {
    startEventCenteredInterview.mockRejectedValueOnce(new Error("EVENT_CENTERED_ENTRY_DISABLED"));

    const response = await POST(new Request("http://localhost/api/interview/event-centered/session/start", {
      method: "POST",
      body: JSON.stringify({ entryDate: "2026-07-22", recordMode: "capture" })
    }));

    expect(response.status).toBe(409);
    expect(startEventCenteredInterview).toHaveBeenCalledWith(
      "user-1",
      "2026-07-22",
      "capture"
    );
  });

  it("rejects an unknown record mode before creating a session", async () => {
    const response = await POST(new Request("http://localhost/api/interview/event-centered/session/start", {
      method: "POST",
      body: JSON.stringify({ entryDate: "2026-07-22", recordMode: "unknown" })
    }));

    expect(response.status).toBe(400);
    expect(startEventCenteredInterview).not.toHaveBeenCalled();
  });
});
