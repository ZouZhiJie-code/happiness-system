const { mockCookies } = vi.hoisted(() => ({
  mockCookies: vi.fn()
}));

const { mockRedirect, mockNotFound } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockNotFound: vi.fn()
}));

const { mockGetCurrentUserFromRequest, mockGetCurrentUserFromSessionToken } = vi.hoisted(() => ({
  mockGetCurrentUserFromRequest: vi.fn(),
  mockGetCurrentUserFromSessionToken: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  notFound: mockNotFound
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  getCurrentUserFromRequest: mockGetCurrentUserFromRequest,
  getCurrentUserFromSessionToken: mockGetCurrentUserFromSessionToken
}));

import {
  AdminAuthorizationError,
  isAdminUsername,
  parseAdminUsernames,
  requireAdminPage,
  requireAdminRequest
} from "@/server/services/auth/admin-access";
import { AuthenticationError } from "@/server/services/auth/current-user.service";

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

describe("admin access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("parses admin usernames from env and ignores empty items", () => {
    vi.stubEnv("ADMIN_USERNAMES", " alice, bob ,,邹志杰 ");

    expect(parseAdminUsernames()).toEqual(["alice", "bob", "邹志杰"]);
    expect(isAdminUsername("alice")).toBe(true);
    expect(isAdminUsername("carol")).toBe(false);
  });

  it("redirects unauthenticated visitors to login for admin pages", async () => {
    mockCookies.mockResolvedValue(mockCookieStore());
    mockGetCurrentUserFromSessionToken.mockResolvedValue(null);

    await requireAdminPage("/admin/analytics");

    expect(mockRedirect).toHaveBeenCalledWith("/login?next=%2Fadmin%2Fanalytics");
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("rejects authenticated non-admin visitors from admin pages", async () => {
    vi.stubEnv("ADMIN_USERNAMES", "admin_user");
    mockCookies.mockResolvedValue(mockCookieStore("session-token"));
    mockGetCurrentUserFromSessionToken.mockResolvedValue({
      id: "user-1",
      username: "daily_light_01"
    });

    await requireAdminPage("/admin/analytics");

    expect(mockNotFound).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("allows authenticated admins into admin pages", async () => {
    vi.stubEnv("ADMIN_USERNAMES", "admin_user");
    mockCookies.mockResolvedValue(mockCookieStore("session-token"));
    mockGetCurrentUserFromSessionToken.mockResolvedValue({
      id: "user-1",
      username: "admin_user"
    });

    const result = await requireAdminPage("/admin/analytics");

    expect(result).toEqual({
      id: "user-1",
      username: "admin_user"
    });
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated admin api requests", async () => {
    mockGetCurrentUserFromRequest.mockResolvedValue(null);

    await expect(requireAdminRequest(new Request("http://localhost/api/admin/analytics/overview"))).rejects.toThrow(
      AuthenticationError
    );
  });

  it("rejects authenticated non-admin admin api requests", async () => {
    vi.stubEnv("ADMIN_USERNAMES", "admin_user");
    mockGetCurrentUserFromRequest.mockResolvedValue({
      id: "user-1",
      username: "daily_light_01"
    });

    await expect(requireAdminRequest(new Request("http://localhost/api/admin/analytics/overview"))).rejects.toThrow(
      AdminAuthorizationError
    );
  });

  it("allows authenticated admins through admin api requests", async () => {
    vi.stubEnv("ADMIN_USERNAMES", "admin_user");
    mockGetCurrentUserFromRequest.mockResolvedValue({
      id: "user-1",
      username: "admin_user"
    });

    const result = await requireAdminRequest(new Request("http://localhost/api/admin/analytics/overview"));

    expect(result).toEqual({
      id: "user-1",
      username: "admin_user"
    });
  });
});
