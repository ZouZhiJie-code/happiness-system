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

vi.mock("next/headers", () => ({
  cookies: mockCookies
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  getCurrentUserFromSessionToken: mockGetCurrentUserFromSessionToken
}));

vi.mock("@/components/joy/settings-form", () => ({
  SettingsForm: () => <div data-testid="settings-form-stub">settings form stub</div>
}));

import SettingsPage from "@/app/settings/page";

describe("settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a logout action for the current user on the main settings page", async () => {
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
  });
});
