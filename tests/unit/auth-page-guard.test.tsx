import React from "react";

const { mockCookies } = vi.hoisted(() => ({
  mockCookies: vi.fn()
}));

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn()
}));

const { mockGetCurrentUserFromSessionToken } = vi.hoisted(() => ({
  mockGetCurrentUserFromSessionToken: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  getCurrentUserFromSessionToken: mockGetCurrentUserFromSessionToken
}));

import AnalysisPage from "@/app/analysis/page";
import CalendarPage from "@/app/calendar/page";
import InterviewPage from "@/app/interview/page";
import LoginPage from "@/app/login/page";
import ProfilePage from "@/app/profile/page";
import RegisterPage from "@/app/register/page";
import SettingsPage from "@/app/settings/page";
import AccountSettingsPage from "@/app/settings/account/page";

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

    expect(mockRedirect).toHaveBeenNthCalledWith(1, "/login?next=%2Finterview");
    expect(mockRedirect).toHaveBeenNthCalledWith(2, "/login?next=%2Fcalendar");
    expect(mockRedirect).toHaveBeenNthCalledWith(3, "/login?next=%2Fanalysis");
    expect(mockRedirect).toHaveBeenNthCalledWith(4, "/login?next=%2Fprofile");
    expect(mockRedirect).toHaveBeenNthCalledWith(5, "/login?next=%2Fsettings");
    expect(mockRedirect).toHaveBeenNthCalledWith(6, "/login?next=%2Fsettings%2Faccount");
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
