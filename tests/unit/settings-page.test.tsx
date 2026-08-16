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

import SettingsPage from "@/app/settings/page";

describe("settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("shows account and legal actions for a regular user while keeping logout in the account menu", async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "raw-session-token" })
    });
    mockGetCurrentUserFromSessionToken.mockResolvedValue({
      id: "user-1",
      username: "daily_light_01"
    });

    render(await SettingsPage());

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(screen.getAllByText("daily_light_01")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "删除账号" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "隐私政策" })).toHaveAttribute("href", "/legal/privacy");
    expect(screen.getByRole("link", { name: "用户协议" })).toHaveAttribute("href", "/legal/terms");
    expect(screen.queryByText("退出登录")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "内部工具" })).not.toBeInTheDocument();
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

    expect(screen.getByRole("link", { name: "数据分析" })).toHaveAttribute("href", "/admin/analytics");
    expect(screen.getByRole("link", { name: "AI 运行配置" })).toHaveAttribute("href", "/settings/ai-runtime");
    expect(screen.getByRole("link", { name: "AI 质量改进" })).toHaveAttribute("href", "/admin/ai-quality");
  });
});
