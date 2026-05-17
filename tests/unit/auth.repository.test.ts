const {
  mockAuthSessionCreate,
  mockAuthSessionDeleteMany,
  mockAuthSessionFindUnique,
  mockUserCreate,
  mockUserFindUnique
} = vi.hoisted(() => ({
  mockAuthSessionCreate: vi.fn(),
  mockAuthSessionDeleteMany: vi.fn(),
  mockAuthSessionFindUnique: vi.fn(),
  mockUserCreate: vi.fn(),
  mockUserFindUnique: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    authSession: {
      create: mockAuthSessionCreate,
      deleteMany: mockAuthSessionDeleteMany,
      findUnique: mockAuthSessionFindUnique
    },
    user: {
      create: mockUserCreate,
      findUnique: mockUserFindUnique
    }
  }
}));

import {
  createAuthSession,
  createUser,
  deleteAuthSessionByTokenHash,
  findAuthSessionByTokenHash,
  findUserByUsername
} from "@/server/repositories/auth.repository";

describe("auth.repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds a user by username", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user-1", username: "daily_light_01" });

    const result = await findUserByUsername("daily_light_01");

    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { username: "daily_light_01" }
    });
    expect(result).toEqual({ id: "user-1", username: "daily_light_01" });
  });

  it("creates a user", async () => {
    mockUserCreate.mockResolvedValue({ id: "user-1", username: "daily_light_01" });

    await createUser({
      username: "daily_light_01",
      passwordHash: "hash",
      agreedToTermsAt: new Date("2026-05-16T00:00:00.000Z"),
      agreedToPrivacyAt: new Date("2026-05-16T00:00:00.000Z")
    });

    expect(mockUserCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        username: "daily_light_01",
        passwordHash: "hash"
      }),
      select: {
        id: true,
        username: true
      }
    });
  });

  it("creates an auth session", async () => {
    mockAuthSessionCreate.mockResolvedValue({ id: "session-1" });

    await createAuthSession({
      userId: "user-1",
      tokenHash: "hashed-token",
      expiresAt: new Date("2026-06-16T00:00:00.000Z")
    });

    expect(mockAuthSessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        tokenHash: "hashed-token"
      })
    });
  });

  it("finds an auth session by token hash with the user attached", async () => {
    mockAuthSessionFindUnique.mockResolvedValue({
      id: "session-1",
      user: {
        id: "user-1",
        username: "daily_light_01"
      }
    });

    const result = await findAuthSessionByTokenHash("hashed-token");

    expect(mockAuthSessionFindUnique).toHaveBeenCalledWith({
      where: { tokenHash: "hashed-token" },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });
    expect(result).toEqual({
      id: "session-1",
      user: {
        id: "user-1",
        username: "daily_light_01"
      }
    });
  });

  it("deletes an auth session by token hash", async () => {
    mockAuthSessionDeleteMany.mockResolvedValue({ count: 1 });

    await deleteAuthSessionByTokenHash("hashed-token");

    expect(mockAuthSessionDeleteMany).toHaveBeenCalledWith({
      where: { tokenHash: "hashed-token" }
    });
  });
});
