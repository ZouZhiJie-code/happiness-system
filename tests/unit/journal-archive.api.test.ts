import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireCurrentUserFromRequest, getJournalArchiveIndex } = vi.hoisted(() => ({
  requireCurrentUserFromRequest: vi.fn(),
  getJournalArchiveIndex: vi.fn()
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest,
  isAuthenticationRequiredError: () => false
}));
vi.mock("@/server/repositories/journal-archive.repository", () => ({ getJournalArchiveIndex }));

import { GET } from "@/app/api/journal/archive/route";

describe("journal archive api", () => {
  beforeEach(() => {
    requireCurrentUserFromRequest.mockResolvedValue({ id: "user-1" });
    getJournalArchiveIndex.mockReset();
    getJournalArchiveIndex.mockResolvedValue({
      kind: "day",
      selectedKey: "2026-08-12",
      monthDates: ["2026-08-12"],
      items: []
    });
  });

  it("reads a bounded authenticated archive view", async () => {
    const response = await GET(new Request("http://localhost/api/journal/archive?kind=day&date=2026-08-12&limit=12"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(getJournalArchiveIndex).toHaveBeenCalledWith({
      userId: "user-1",
      kind: "day",
      date: "2026-08-12",
      limit: 12
    });
  });

  it.each([
    "kind=year&date=2026-08-12&limit=12",
    "kind=day&date=2026-08-12&limit=31",
    "kind=day&date=bad-date&limit=12"
  ])("rejects an invalid archive request: %s", async (query) => {
    const response = await GET(new Request(`http://localhost/api/journal/archive?${query}`));
    expect(response.status).toBe(400);
    expect(getJournalArchiveIndex).not.toHaveBeenCalled();
  });
});
