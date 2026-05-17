import React from "react";

const { mockCookies } = vi.hoisted(() => ({
  mockCookies: vi.fn()
}));

const { mockGetCurrentUserFromSessionToken } = vi.hoisted(() => ({
  mockGetCurrentUserFromSessionToken: vi.fn()
}));

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn()
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

import AccountSettingsPage from "@/app/settings/account/page";

describe("account settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated visitors to login", async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined)
    });
    mockGetCurrentUserFromSessionToken.mockResolvedValue(null);

    await AccountSettingsPage();

    expect(mockRedirect).toHaveBeenCalledWith("/login?next=%2Fsettings%2Faccount");
  });

  it("renders the account settings workspace for authenticated users", async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "raw-session-token" })
    });
    mockGetCurrentUserFromSessionToken.mockResolvedValue({
      id: "user-1",
      username: "daily_light_01"
    });

    const page = await AccountSettingsPage();

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockGetCurrentUserFromSessionToken).toHaveBeenCalledWith("raw-session-token");
    expect(page).toMatchObject({
      props: {
        user: {
          id: "user-1",
          username: "daily_light_01"
        }
      }
    });
    expect(page).toBeTruthy();
  });
});
