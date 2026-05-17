const { mockFindAuthSessionByTokenHash } = vi.hoisted(() => ({
  mockFindAuthSessionByTokenHash: vi.fn()
}));

vi.mock("@/server/repositories/auth.repository", () => ({
  findAuthSessionByTokenHash: mockFindAuthSessionByTokenHash
}));

import { AuthenticationError, getCurrentUserFromRequest, requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";

describe("current-user.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the current user from a request cookie", async () => {
    mockFindAuthSessionByTokenHash.mockResolvedValue({
      id: "session-1",
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
