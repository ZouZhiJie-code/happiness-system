const {
  mockGetAdminAnalyticsDailyJournalDetail,
  mockGetAdminAnalyticsEntryDetail,
  mockGetAdminAnalyticsSessionDetail,
  mockGetAdminAnalyticsUserDetail,
  mockListAdminAnalyticsUsers
} = vi.hoisted(() => ({
  mockGetAdminAnalyticsDailyJournalDetail: vi.fn(),
  mockGetAdminAnalyticsEntryDetail: vi.fn(),
  mockGetAdminAnalyticsSessionDetail: vi.fn(),
  mockGetAdminAnalyticsUserDetail: vi.fn(),
  mockListAdminAnalyticsUsers: vi.fn()
}));

const {
  MockAdminAuthorizationError,
  mockRequireAdminRequest
} = vi.hoisted(() => ({
  MockAdminAuthorizationError: class AdminAuthorizationError extends Error {},
  mockRequireAdminRequest: vi.fn()
}));

vi.mock("@/server/services/admin-analytics/admin-analytics.service", () => ({
  getAdminAnalyticsDailyJournalDetail: mockGetAdminAnalyticsDailyJournalDetail,
  getAdminAnalyticsEntryDetail: mockGetAdminAnalyticsEntryDetail,
  getAdminAnalyticsSessionDetail: mockGetAdminAnalyticsSessionDetail,
  getAdminAnalyticsUserDetail: mockGetAdminAnalyticsUserDetail,
  listAdminAnalyticsUsers: mockListAdminAnalyticsUsers
}));

vi.mock("@/server/services/auth/admin-access", () => ({
  AdminAuthorizationError: MockAdminAuthorizationError,
  requireAdminRequest: mockRequireAdminRequest
}));

import { GET as getDailyJournalRoute } from "@/app/api/admin/analytics/daily-journals/[id]/route";
import { GET as getEntryRoute } from "@/app/api/admin/analytics/entries/[entryId]/route";
import { GET as getSessionRoute } from "@/app/api/admin/analytics/sessions/[sessionId]/route";
import { GET as getUserRoute } from "@/app/api/admin/analytics/users/[userId]/route";
import { GET as listUsersRoute } from "@/app/api/admin/analytics/users/route";

describe("admin analytics drilldown api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminRequest.mockResolvedValue({
      id: "user-1",
      username: "admin_user"
    });
  });

  it("returns users and user detail for admin callers", async () => {
    mockListAdminAnalyticsUsers.mockResolvedValue([{ id: "user-1", username: "daily_light_01" }]);
    mockGetAdminAnalyticsUserDetail.mockResolvedValue({ user: { id: "user-1", username: "daily_light_01" } });

    const listResponse = await listUsersRoute(
      new Request(
        "http://localhost/api/admin/analytics/users?startDate=2026-05-01&endDate=2026-05-31&username=daily&hasFailure=1&hasReturnVisit=1"
      )
    );
    const detailResponse = await getUserRoute(new Request("http://localhost/api/admin/analytics/users/user-1"), {
      params: Promise.resolve({ userId: "user-1" })
    });

    expect(listResponse.status).toBe(200);
    expect(detailResponse.status).toBe(200);
    expect(mockListAdminAnalyticsUsers).toHaveBeenCalledWith({
      startDate: "2026-05-01",
      endDate: "2026-05-31",
      username: "daily",
      hasSavedJournal: false,
      hasBoundaryInsufficient: true,
      hasReopenedSession: true
    });
    expect(mockGetAdminAnalyticsUserDetail).toHaveBeenCalledWith("user-1");
  });

  it("returns session, entry, and daily journal details for admin callers", async () => {
    mockGetAdminAnalyticsSessionDetail.mockResolvedValue({ id: "session-1" });
    mockGetAdminAnalyticsEntryDetail.mockResolvedValue({ id: "entry-1" });
    mockGetAdminAnalyticsDailyJournalDetail.mockResolvedValue({ id: "daily-1" });

    const sessionResponse = await getSessionRoute(new Request("http://localhost/api/admin/analytics/sessions/session-1"), {
      params: Promise.resolve({ sessionId: "session-1" })
    });
    const entryResponse = await getEntryRoute(new Request("http://localhost/api/admin/analytics/entries/entry-1"), {
      params: Promise.resolve({ entryId: "entry-1" })
    });
    const journalResponse = await getDailyJournalRoute(
      new Request("http://localhost/api/admin/analytics/daily-journals/daily-1"),
      {
        params: Promise.resolve({ id: "daily-1" })
      }
    );

    expect(sessionResponse.status).toBe(200);
    expect(entryResponse.status).toBe(200);
    expect(journalResponse.status).toBe(200);
    expect(mockGetAdminAnalyticsEntryDetail).toHaveBeenCalledWith("admin_user", "entry-1");
    expect(mockGetAdminAnalyticsDailyJournalDetail).toHaveBeenCalledWith("admin_user", "daily-1");
  });

  it("returns 403 for non-admin callers", async () => {
    mockRequireAdminRequest.mockRejectedValue(new MockAdminAuthorizationError("ADMIN_FORBIDDEN"));

    const response = await listUsersRoute(
      new Request("http://localhost/api/admin/analytics/users?startDate=2026-05-01&endDate=2026-05-31")
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "ADMIN_FORBIDDEN" });
  });
});
