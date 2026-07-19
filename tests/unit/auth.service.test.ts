const {
  mockCreateAuthSession,
  mockCreateUserWithInitialSession,
  mockDeleteAuthSessionByTokenHash,
  mockFindAuthSessionByTokenHash,
  mockFindUserByUsername,
  mockEnsureAIQualityParticipation
} = vi.hoisted(() => ({
  mockCreateAuthSession: vi.fn(),
  mockCreateUserWithInitialSession: vi.fn(),
  mockDeleteAuthSessionByTokenHash: vi.fn(),
  mockFindAuthSessionByTokenHash: vi.fn(),
  mockFindUserByUsername: vi.fn(),
  mockEnsureAIQualityParticipation: vi.fn()
}));

const { mockHashPassword, mockVerifyPassword } = vi.hoisted(() => ({
  mockHashPassword: vi.fn(),
  mockVerifyPassword: vi.fn()
}));

const { mockCreateSessionToken } = vi.hoisted(() => ({
  mockCreateSessionToken: vi.fn()
}));

const { mockRecordAnalyticsEvent } = vi.hoisted(() => ({
  mockRecordAnalyticsEvent: vi.fn()
}));

vi.mock("@/server/repositories/auth.repository", () => ({
  createAuthSession: mockCreateAuthSession,
  createUserWithInitialSession: mockCreateUserWithInitialSession,
  deleteAuthSessionByTokenHash: mockDeleteAuthSessionByTokenHash,
  findAuthSessionByTokenHash: mockFindAuthSessionByTokenHash,
  findUserByUsername: mockFindUserByUsername,
  ensureAIQualityParticipation: mockEnsureAIQualityParticipation
}));

vi.mock("@/server/services/auth/password.service", () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword
}));

vi.mock("@/server/services/auth/session-token.service", () => ({
  createSessionToken: mockCreateSessionToken
}));

vi.mock("@/server/repositories/admin-analytics.repository", () => ({
  recordAnalyticsEvent: mockRecordAnalyticsEvent
}));

import { AuthenticationError, getCurrentUser, loginUser, logoutUser, registerUser } from "@/server/services/auth/auth.service";

describe("auth.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a user and creates a session", async () => {
    mockFindUserByUsername.mockResolvedValue(null);
    mockHashPassword.mockResolvedValue("salted-hash");
    mockCreateUserWithInitialSession.mockResolvedValue({
      id: "user-1",
      username: "daily_light_01"
    });
    mockCreateSessionToken.mockResolvedValue({
      value: "raw-session-token",
      hash: "hashed-session-token"
    });

    const result = await registerUser({
      username: "daily_light_01",
      password: "supersecret1",
      acceptedTerms: true,
      acceptedPrivacy: true
    });

    expect(mockCreateUserWithInitialSession).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "daily_light_01",
        passwordHash: "salted-hash",
        privacyPolicyVersion: "2026-07-19",
        tokenHash: "hashed-session-token"
      })
    );
    const registrationData = mockCreateUserWithInitialSession.mock.calls[0]?.[0];
    expect(registrationData).toEqual(expect.objectContaining({
      aiQualityConsentVersion: "2026-07-19",
      aiQualityConsentAt: expect.any(Date)
    }));
    expect(result).toEqual({
      token: "raw-session-token",
      user: {
        id: "user-1",
        username: "daily_light_01"
      }
    });
    expect(mockRecordAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "auth_register_succeeded",
        userId: "user-1",
        dedupeKey: "auth_register_succeeded:user-1"
      })
    );
  });

  it("rejects duplicate usernames during registration", async () => {
    mockFindUserByUsername.mockResolvedValue({
      id: "user-1",
      username: "daily_light_01"
    });

    await expect(
      registerUser({
        username: "daily_light_01",
        password: "supersecret1",
        acceptedTerms: true,
        acceptedPrivacy: true
      })
    ).rejects.toThrow(AuthenticationError);
  });

  it("does not leave a half-created account when initial session creation fails", async () => {
    mockFindUserByUsername.mockResolvedValue(null);
    mockHashPassword.mockResolvedValue("salted-hash");
    mockCreateSessionToken.mockResolvedValue({
      value: "raw-session-token",
      hash: "hashed-session-token"
    });
    mockCreateUserWithInitialSession.mockRejectedValue(new Error("write failed"));

    await expect(
      registerUser({
        username: "daily_light_01",
        password: "supersecret1",
        acceptedTerms: true,
        acceptedPrivacy: true
      })
    ).rejects.toThrow("write failed");
  });

  it("logs in an existing user with a valid password", async () => {
    mockFindUserByUsername.mockResolvedValue({
      id: "user-1",
      username: "daily_light_01",
      passwordHash: "stored-hash"
    });
    mockVerifyPassword.mockResolvedValue(true);
    mockCreateSessionToken.mockResolvedValue({
      value: "raw-session-token",
      hash: "hashed-session-token"
    });
    mockCreateAuthSession.mockResolvedValue({
      id: "session-1"
    });

    const result = await loginUser({
      username: "daily_light_01",
      password: "supersecret1"
    });

    expect(mockVerifyPassword).toHaveBeenCalledWith("supersecret1", "stored-hash");
    expect(mockEnsureAIQualityParticipation).toHaveBeenCalledWith("user-1", "2026-07-19");
    expect(result).toEqual({
      token: "raw-session-token",
      user: {
        id: "user-1",
        username: "daily_light_01"
      }
    });
    expect(mockRecordAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "auth_login_succeeded",
        userId: "user-1",
        dedupeKey: "auth_login_succeeded:user-1"
      })
    );
  });

  it("rejects login when the password is invalid", async () => {
    mockFindUserByUsername.mockResolvedValue({
      id: "user-1",
      username: "daily_light_01",
      passwordHash: "stored-hash"
    });
    mockVerifyPassword.mockResolvedValue(false);

    await expect(
      loginUser({
        username: "daily_light_01",
        password: "wrong-password"
      })
    ).rejects.toThrow(AuthenticationError);
  });

  it("returns the current user from a valid token hash lookup", async () => {
    mockFindAuthSessionByTokenHash.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      tokenHash: "hashed-session-token",
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      user: {
        id: "user-1",
        username: "daily_light_01"
      }
    });

    const result = await getCurrentUser("hashed-session-token");

    expect(result).toEqual({
      id: "user-1",
      username: "daily_light_01"
    });
  });

  it("returns null when no session matches the token hash", async () => {
    mockFindAuthSessionByTokenHash.mockResolvedValue(null);

    await expect(getCurrentUser("missing-token-hash")).resolves.toBeNull();
  });

  it("deletes the active session on logout", async () => {
    await logoutUser("raw-session-token");

    expect(mockDeleteAuthSessionByTokenHash).toHaveBeenCalledWith(
      "e6c276c51996dfa4b71f39f34f5f1a5a8f116e29eb538fab6403dd689631c622"
    );
  });
});
