const {
  MockAuthenticationError,
  mockLoginUser,
  mockLogoutUser,
  mockRegisterUser
} = vi.hoisted(() => ({
  MockAuthenticationError: class AuthenticationError extends Error {},
  mockLoginUser: vi.fn(),
  mockLogoutUser: vi.fn(),
  mockRegisterUser: vi.fn()
}));

vi.mock("@/server/services/auth/auth.service", () => ({
  AuthenticationError: MockAuthenticationError,
  loginUser: mockLoginUser,
  logoutUser: mockLogoutUser,
  registerUser: mockRegisterUser
}));

import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { POST as registerRoute } from "@/app/api/auth/register/route";

describe("auth api routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a user and returns an authenticated payload", async () => {
    mockRegisterUser.mockResolvedValue({
      token: "session-token",
      user: {
        id: "user-1",
        username: "daily_light_01"
      }
    });

    const response = await registerRoute(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: "daily_light_01",
          password: "supersecret1",
          acceptedTerms: true,
          acceptedPrivacy: true
        })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authenticated: true,
      user: {
        id: "user-1",
        username: "daily_light_01"
      }
    });
    expect(response.headers.get("set-cookie")).toContain("dl_session=session-token");
  });

  it("rejects invalid registration payloads", async () => {
    const response = await registerRoute(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: "ab",
          password: "short",
          acceptedTerms: false,
          acceptedPrivacy: false
        })
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns a storage-not-ready error when registration storage is unavailable", async () => {
    mockRegisterUser.mockRejectedValue(new MockAuthenticationError("AUTH_STORAGE_NOT_READY"));

    const response = await registerRoute(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: "daily_light_01",
          password: "supersecret1",
          acceptedTerms: true,
          acceptedPrivacy: true
        })
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "AUTH_STORAGE_NOT_READY" });
  });

  it("logs in a user and returns an authenticated payload", async () => {
    mockLoginUser.mockResolvedValue({
      token: "session-token",
      user: {
        id: "user-1",
        username: "daily_light_01"
      }
    });

    const response = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: "daily_light_01",
          password: "supersecret1"
        })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authenticated: true,
      user: {
        id: "user-1",
        username: "daily_light_01"
      }
    });
    expect(response.headers.get("set-cookie")).toContain("dl_session=session-token");
  });

  it("accepts form-encoded fallback login submissions and redirects to the default page", async () => {
    mockLoginUser.mockResolvedValue({
      token: "session-token",
      user: {
        id: "user-1",
        username: "daily_light_01"
      }
    });

    const formBody = new URLSearchParams({
      username: "daily_light_01",
      password: "supersecret1"
    });

    const response = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: formBody.toString()
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/interview");
    expect(response.headers.get("set-cookie")).toContain("dl_session=session-token");
    expect(mockLoginUser).toHaveBeenCalledWith({
      username: "daily_light_01",
      password: "supersecret1"
    });
  });

  it("redirects form fallback logins to the provided next path after setting the session cookie", async () => {
    mockLoginUser.mockResolvedValue({
      token: "session-token",
      user: {
        id: "user-1",
        username: "daily_light_01"
      }
    });

    const formBody = new URLSearchParams({
      username: "daily_light_01",
      password: "supersecret1",
      next: "/calendar?view=day"
    });

    const response = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: formBody.toString()
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/calendar?view=day");
    expect(response.headers.get("set-cookie")).toContain("dl_session=session-token");
  });

  it("clears the session cookie on logout", async () => {
    const response = await logoutRoute(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: {
          cookie: "dl_session=session-token"
        }
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("dl_session=");
    expect(mockLogoutUser).toHaveBeenCalled();
  });

  it("still clears the session cookie when logout is called without an active cookie", async () => {
    const response = await logoutRoute(
      new Request("http://localhost/api/auth/logout", {
        method: "POST"
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("dl_session=");
    expect(mockLogoutUser).not.toHaveBeenCalled();
  });
});
