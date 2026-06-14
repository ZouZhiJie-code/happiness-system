const {
  mockDeleteAuthSessionByTokenHash,
  mockFindAuthSessionByTokenHash,
  mockTouchAuthSessionByTokenHash
} = vi.hoisted(() => ({
  mockDeleteAuthSessionByTokenHash: vi.fn(),
  mockFindAuthSessionByTokenHash: vi.fn(),
  mockTouchAuthSessionByTokenHash: vi.fn()
}));

vi.mock("@/server/repositories/auth.repository", () => ({
  deleteAuthSessionByTokenHash: mockDeleteAuthSessionByTokenHash,
  findAuthSessionByTokenHash: mockFindAuthSessionByTokenHash,
  touchAuthSessionByTokenHash: mockTouchAuthSessionByTokenHash
}));

import { Prisma } from "@prisma/client";

import { getCurrentUserFromSessionToken } from "@/server/services/auth/current-user.service";
import {
  AuthenticationError,
  getCurrentUserFromRequest,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";

describe("current-user.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null and deletes expired sessions", async () => {
    mockFindAuthSessionByTokenHash.mockResolvedValue({
      tokenHash: "hashed",
      expiresAt: new Date("2000-01-01T00:00:00.000Z"),
      user: { id: "user-1", username: "demo" }
    });

    const result = await getCurrentUserFromSessionToken("raw-token");

    expect(result).toBeNull();
    expect(mockDeleteAuthSessionByTokenHash).toHaveBeenCalled();
  });

  it("returns null when auth session lookup hits a transient database connectivity error", async () => {
    mockFindAuthSessionByTokenHash.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Can't reach database server", {
        code: "P1001",
        clientVersion: "5.22.0"
      })
    );

    const result = await getCurrentUserFromSessionToken("raw-token");

    expect(result).toBeNull();
  });

  it("touches lastUsedAt for a valid session", async () => {
    mockFindAuthSessionByTokenHash.mockResolvedValue({
      tokenHash: "hashed",
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      user: { id: "user-1", username: "demo" }
    });

    await getCurrentUserFromSessionToken("raw-token");

    expect(mockTouchAuthSessionByTokenHash).toHaveBeenCalledWith(expect.any(String));
  });

  it("returns the current user from a request cookie", async () => {
    mockFindAuthSessionByTokenHash.mockResolvedValue({
      id: "session-1",
      tokenHash: "hashed",
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      user: {
        id: "user-1",
        username: "daily_light_01"
      }
    });

    const result = await getCurrentUserFromRequest(
      new Request("http://localhost/api/auth/session", {
        headers: {
          cookie: "dl_session=raw-session-token"
        }
      })
    );

    expect(result).toEqual({
      id: "user-1",
      username: "daily_light_01"
    });
  });

  it("returns null when the request has no auth cookie", async () => {
    const result = await getCurrentUserFromRequest(new Request("http://localhost/api/auth/session"));

    expect(result).toBeNull();
    expect(mockFindAuthSessionByTokenHash).not.toHaveBeenCalled();
  });

  it("throws when authentication is required but missing", async () => {
    await expect(requireCurrentUserFromRequest(new Request("http://localhost/api/auth/session"))).rejects.toThrow(
      AuthenticationError
    );
  });
});
