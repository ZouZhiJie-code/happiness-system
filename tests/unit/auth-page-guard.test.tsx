const { mockCookies } = vi.hoisted(() => ({
  mockCookies: vi.fn()
}));

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn()
}));

const { mockNotFound } = vi.hoisted(() => ({
  mockNotFound: vi.fn()
}));

const { mockGetCurrentUserFromSessionToken } = vi.hoisted(() => ({
  mockGetCurrentUserFromSessionToken: vi.fn()
}));

const { mockRecordAnalyticsEvent } = vi.hoisted(() => ({
  mockRecordAnalyticsEvent: vi.fn()
}));

const { mockInterviewShell } = vi.hoisted(() => ({
  mockInterviewShell: vi.fn(() => null)
}));

const {
  mockGetAdminAnalyticsFunnel,
  mockGetAdminAnalyticsOverview,
  mockGetAdminAnalyticsQuality,
  mockGetAdminAnalyticsRetention,
  mockListAdminAnalyticsUsers
} = vi.hoisted(() => ({
  mockGetAdminAnalyticsFunnel: vi.fn(),
  mockGetAdminAnalyticsOverview: vi.fn(),
  mockGetAdminAnalyticsQuality: vi.fn(),
  mockGetAdminAnalyticsRetention: vi.fn(),
  mockListAdminAnalyticsUsers: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  notFound: mockNotFound
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  getCurrentUserFromSessionToken: mockGetCurrentUserFromSessionToken
}));

vi.mock("@/server/repositories/admin-analytics.repository", () => ({
  recordAnalyticsEvent: mockRecordAnalyticsEvent
}));

vi.mock("@/server/services/admin-analytics/admin-analytics.service", () => ({
  getAdminAnalyticsFunnel: mockGetAdminAnalyticsFunnel,
  getAdminAnalyticsOverview: mockGetAdminAnalyticsOverview,
  getAdminAnalyticsQuality: mockGetAdminAnalyticsQuality,
  getAdminAnalyticsRetention: mockGetAdminAnalyticsRetention,
  listAdminAnalyticsUsers: mockListAdminAnalyticsUsers
}));

vi.mock("@/components/interview/interview-shell", () => ({
  InterviewShell: mockInterviewShell
}));

import AnalysisPage from "@/app/analysis/page";
import AdminAnalyticsPage from "@/app/admin/analytics/page";
import CalendarPage from "@/app/calendar/page";
import InterviewPage from "@/app/interview/page";
import LoginPage from "@/app/login/page";
import ProfilePage from "@/app/profile/page";
import RegisterPage from "@/app/register/page";
import SettingsPage from "@/app/settings/page";
import AccountSettingsPage from "@/app/settings/account/page";

function findPropInReactTree(node: unknown, propName: string): unknown {
  if (!node || typeof node !== "object") {
    return undefined;
  }

  const record = node as { props?: Record<string, unknown> };

  if (record.props && propName in record.props) {
    return record.props[propName];
  }

  const children = record.props?.children;

  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findPropInReactTree(child, propName);

      if (found !== undefined) {
        return found;
      }
    }
  }

  return findPropInReactTree(children, propName);
}

function mockCookieStore(token?: string) {
  return {
    get: vi.fn().mockImplementation((name: string) => {
      if (name !== "dl_session" || !token) {
        return undefined;
      }

      return { value: token };
    })
  };
}

describe("auth page guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockGetAdminAnalyticsOverview.mockResolvedValue({
      range: { startDate: "2026-05-01", endDate: "2026-05-31" },
      northStar: { name: "MRU-7", value: 12 },
      overview: {
        savedJournalUsers: 8,
        savedJournalCount: 15,
        savedDailyJournalUsers: 5,
        savedDailyJournalCount: 7,
        happinessScoreUsers: 9,
        happinessScoreCount: 18
      },
      ai: { successRate: 0.92, p50LatencyMs: 820, p95LatencyMs: 1840 }
    });
    mockGetAdminAnalyticsFunnel.mockResolvedValue({
      mainFunnel: [],
      secondaryFunnel: [],
      qualitySignals: {
        pausedCount: 0,
        reopenedCount: 0,
        boundaryInsufficientCount: 0,
        dimensionRedirectCount: 0
      }
    });
    mockGetAdminAnalyticsRetention.mockResolvedValue({
      d1ReturnToRecordRate: 0,
      d7ReturnToRecordRate: 0,
      d30ReturnToRecordRate: 0,
      d7RepeatSaveRate: 0,
      d30RepeatSaveRate: 0
    });
    mockGetAdminAnalyticsQuality.mockResolvedValue({
      dimensionSaveBreakdown: [],
      draftEditRate: 0,
      boundaryInsufficientRate: 0,
      staleRate: 0,
      ai: {
        successRate: 0,
        p50LatencyMs: null,
        p95LatencyMs: null,
        errorCodeBreakdown: []
      }
    });
    mockListAdminAnalyticsUsers.mockResolvedValue([]);
  });

  it("redirects unauthenticated visitors from private pages to login with next", async () => {
    mockCookies.mockResolvedValue(mockCookieStore());
    mockGetCurrentUserFromSessionToken.mockResolvedValue(null);

    await InterviewPage();
    await CalendarPage();
    await AnalysisPage();
    await ProfilePage();
    await SettingsPage();
    await AccountSettingsPage();
    await AdminAnalyticsPage({
      searchParams: Promise.resolve({})
    });

    expect(mockRedirect).toHaveBeenNthCalledWith(1, "/login?next=%2Finterview");
    expect(mockRedirect).toHaveBeenNthCalledWith(2, "/login?next=%2Fcalendar");
    expect(mockRedirect).toHaveBeenNthCalledWith(3, "/login?next=%2Fanalysis");
    expect(mockRedirect).toHaveBeenNthCalledWith(4, "/login?next=%2Fprofile");
    expect(mockRedirect).toHaveBeenNthCalledWith(5, "/login?next=%2Fsettings");
    expect(mockRedirect).toHaveBeenNthCalledWith(6, "/login?next=%2Fsettings%2Faccount");
    expect(mockRedirect).toHaveBeenNthCalledWith(7, "/login?next=%2Fadmin%2Fanalytics");
  });

  it("allows authenticated visitors into private pages", async () => {
    mockCookies.mockResolvedValue(mockCookieStore("session-token"));
    mockGetCurrentUserFromSessionToken.mockResolvedValue({
      id: "user-1",
      username: "daily_light_01"
    });

    const page = await InterviewPage();

    expect(mockGetCurrentUserFromSessionToken).toHaveBeenCalledWith("session-token");
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(page).toBeTruthy();
    expect(findPropInReactTree(page, "showAIRuntimeSummary")).toBe(false);
    expect(mockRecordAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "private_page_viewed",
        userId: "user-1",
        dedupeKey: "private_page_viewed:user-1:/interview"
      })
    );
  });

  it("does not fail private pages when analytics recording fails", async () => {
    mockCookies.mockResolvedValue(mockCookieStore("session-token"));
    mockGetCurrentUserFromSessionToken.mockResolvedValue({
      id: "user-1",
      username: "daily_light_01"
    });
    mockRecordAnalyticsEvent.mockRejectedValueOnce(new Error("database temporarily unavailable"));

    const page = await SettingsPage();

    expect(page).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("returns not-found for authenticated non-admin visitors on admin analytics page", async () => {
    vi.stubEnv("ADMIN_USERNAMES", "admin_user");
    mockCookies.mockResolvedValue(mockCookieStore("session-token"));
    mockGetCurrentUserFromSessionToken.mockResolvedValue({
      id: "user-1",
      username: "daily_light_01"
    });

    await AdminAnalyticsPage({
      searchParams: Promise.resolve({})
    });

    expect(mockNotFound).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("allows authenticated admins into the admin analytics page", async () => {
    vi.stubEnv("ADMIN_USERNAMES", "admin_user");
    mockCookies.mockResolvedValue(mockCookieStore("session-token"));
    mockGetCurrentUserFromSessionToken.mockResolvedValue({
      id: "user-1",
      username: "admin_user"
    });

    const page = await AdminAnalyticsPage({
      searchParams: Promise.resolve({})
    });

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(page).toBeTruthy();
  });

  it("enables the interview AI runtime summary for authenticated admins", async () => {
    vi.stubEnv("ADMIN_USERNAMES", "admin_user");
    mockCookies.mockResolvedValue(mockCookieStore("session-token"));
    mockGetCurrentUserFromSessionToken.mockResolvedValue({
      id: "user-1",
      username: "admin_user"
    });

    const page = await InterviewPage();

    expect(page).toBeTruthy();
    expect(findPropInReactTree(page, "showAIRuntimeSummary")).toBe(true);
  });

  it("redirects authenticated visitors away from login and register using next when provided", async () => {
    mockCookies.mockResolvedValue(mockCookieStore("session-token"));
    mockGetCurrentUserFromSessionToken.mockResolvedValue({
      id: "user-1",
      username: "daily_light_01"
    });

    await LoginPage({
      searchParams: Promise.resolve({
        next: "/analysis?month=2026-05"
      })
    });
    await RegisterPage({
      searchParams: Promise.resolve({
        next: "/calendar"
      })
    });

    expect(mockRedirect).toHaveBeenNthCalledWith(1, "/analysis?month=2026-05");
    expect(mockRedirect).toHaveBeenNthCalledWith(2, "/calendar");
  });
});
