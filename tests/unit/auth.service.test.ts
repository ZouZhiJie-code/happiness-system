const {
  mockCreateAuthSession,
  mockCreateUser,
  mockDeleteAuthSessionByTokenHash,
  mockFindAuthSessionByTokenHash,
  mockFindUserByUsername
} = vi.hoisted(() => ({
  mockCreateAuthSession: vi.fn(),
  mockCreateUser: vi.fn(),
  mockDeleteAuthSessionByTokenHash: vi.fn(),
  mockFindAuthSessionByTokenHash: vi.fn(),
  mockFindUserByUsername: vi.fn()
}));

const { mockHashPassword, mockVerifyPassword } = vi.hoisted(() => ({
  mockHashPassword: vi.fn(),
  mockVerifyPassword: vi.fn()
}));

const { mockCreateSessionToken } = vi.hoisted(() => ({
  mockCreateSessionToken: vi.fn()
}));

vi.mock("@/server/repositories/auth.repository", () => ({
  createAuthSession: mockCreateAuthSession,
  createUser: mockCreateUser,
  deleteAuthSessionByTokenHash: mockDeleteAuthSessionByTokenHash,
  findAuthSessionByTokenHash: mockFindAuthSessionByTokenHash,
  findUserByUsername: mockFindUserByUsername
}));

vi.mock("@/server/services/auth/password.service", () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword
}));

vi.mock("@/server/services/auth/session-token.service", () => ({
  createSessionToken: mockCreateSessionToken
}));

import { AuthenticationError, getCurrentUser, loginUser, logoutUser, registerUser } from "@/server/services/auth/auth.service";

describe("auth.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a user and creates a session", async () => {
    mockFindUserByUsername.mockResolvedValue(null);
    mockHashPassword.mockResolvedValue("salted-hash");
    mockCreateUser.mockResolvedValue({
      id: "user-1",
      username: "daily_light_01"
    });
    mockCreateSessionToken.mockResolvedValue({
      value: "raw-session-token",
      hash: "hashed-session-token"
    });
    mockCreateAuthSession.mockResolvedValue({
      id: "session-1"
    });

    const result = await registerUser({
      username: "daily_light_01",
      password: "supersecret1",
      acceptedTerms: true,
      acceptedPrivacy: true
    });

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "daily_light_01",
        passwordHash: "salted-hash"
      })
    );
    expect(mockCreateAuthSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        tokenHash: "hashed-session-token"
      })
    );
    expect(result).toEqual({
      token: "raw-session-token",
      user: {
        id: "user-1",
        username: "daily_light_01"
      }
    });
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
    expect(result).toEqual({
      token: "raw-session-token",
      user: {
        id: "user-1",
        username: "daily_light_01"
      }
    });
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
