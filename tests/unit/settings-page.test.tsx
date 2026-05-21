import React from "react";
import { render, screen } from "@testing-library/react";

const { mockCookies } = vi.hoisted(() => ({
  mockCookies: vi.fn()
}));

const { mockGetCurrentUserFromSessionToken } = vi.hoisted(() => ({
  mockGetCurrentUserFromSessionToken: vi.fn()
}));

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn()
}));

const { mockRecordAnalyticsEvent } = vi.hoisted(() => ({
  mockRecordAnalyticsEvent: vi.fn()
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

vi.mock("@/server/repositories/admin-analytics.repository", () => ({
  recordAnalyticsEvent: mockRecordAnalyticsEvent
}));

vi.mock("@/components/joy/settings-form", () => ({
  SettingsForm: () => <div data-testid="settings-form-stub">settings form stub</div>
}));

import SettingsPage from "@/app/settings/page";

describe("settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("renders a logout action for a regular user and keeps admin analytics hidden", async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "raw-session-token" })
    });
    mockGetCurrentUserFromSessionToken.mockResolvedValue({
      id: "user-1",
      username: "daily_light_01"
    });

    render(await SettingsPage());

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(screen.getByTestId("settings-form-stub")).toBeInTheDocument();
    expect(screen.getByText("daily_light_01")).toBeInTheDocument();
    expect(screen.getByTestId("settings-form-stub")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "退出当前账号" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "管理员数据分析" })).not.toBeInTheDocument();
  });

  it("shows the admin analytics entry for admin users", async () => {
    vi.stubEnv("ADMIN_USERNAMES", "admin_user");
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "raw-session-token" })
    });
    mockGetCurrentUserFromSessionToken.mockResolvedValue({
      id: "user-1",
      username: "admin_user"
    });

    render(await SettingsPage());

    expect(screen.getByRole("link", { name: "管理员数据分析" })).toHaveAttribute("href", "/admin/analytics");
  });
});
