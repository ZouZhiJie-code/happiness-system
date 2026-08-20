import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, getView } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getView: vi.fn()
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest: requireUser,
  isAuthenticationRequiredError: () => false
}));
vi.mock("@/server/repositories/journal-daily-entry.repository", () => ({
  getJournalDailyJournalView: getView
}));

import { GET } from "@/app/api/journal/day/route";

describe("GET /api/journal/day", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ id: "user-1" });
    getView.mockResolvedValue({ entryDate: "2026-08-10", displayStatus: "ungenerated" });
  });

  it("reads the authenticated user's entryDate workbench", async () => {
    const response = await GET(
      new Request("http://localhost/api/journal/day?entryDate=2026-08-10")
    );
    expect(response.status).toBe(200);
    expect(getView).toHaveBeenCalledWith("user-1", "2026-08-10");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("rejects an invalid date before reading journal data", async () => {
    const response = await GET(
      new Request("http://localhost/api/journal/day?entryDate=2026-02-30")
    );
    expect(response.status).toBe(400);
    expect(getView).not.toHaveBeenCalled();
  });
});
