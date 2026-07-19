const { findUserByUsername, createAuthSession, createSessionToken } = vi.hoisted(() => ({
  findUserByUsername: vi.fn(),
  createAuthSession: vi.fn(),
  createSessionToken: vi.fn()
}));

vi.mock("@/server/repositories/auth.repository", () => ({ findUserByUsername, createAuthSession }));
vi.mock("@/server/services/auth/session-token.service", () => ({ createSessionToken }));

import { GET } from "@/app/api/dev/acceptance-login/route";

describe("local acceptance login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ACCEPTANCE_LOGIN_TOKEN", "acceptance-secret");
    vi.stubEnv("ACCEPTANCE_ADMIN_USERNAME", "acceptance_admin");
    findUserByUsername.mockResolvedValue({ id: "admin-1", username: "acceptance_admin" });
    createSessionToken.mockResolvedValue({ value: "raw-token", hash: "hashed-token" });
    createAuthSession.mockResolvedValue({ id: "session-1" });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("creates a normal session cookie and redirects a valid localhost request", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/dev/acceptance-login?token=acceptance-secret&redirect=%2Fadmin%2Fai-quality")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/ai-quality");
    expect(response.headers.get("set-cookie")).toContain("dl_session=raw-token");
    expect(createAuthSession).toHaveBeenCalledWith(expect.objectContaining({ userId: "admin-1", tokenHash: "hashed-token" }));
  });

  it("preserves a loopback host so the acceptance session stays isolated from localhost", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/dev/acceptance-login?token=acceptance-secret&redirect=%2Fadmin%2Fai-quality", {
        headers: { host: "127.0.0.1:3000" }
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/admin/ai-quality");
    expect(response.headers.get("set-cookie")).toContain("dl_session=raw-token");
  });

  it("returns 404 in production and for an invalid token", async () => {
    const invalid = await GET(new Request("http://localhost:3000/api/dev/acceptance-login?token=wrong"));
    expect(invalid.status).toBe(404);

    vi.stubEnv("NODE_ENV", "production");
    const production = await GET(
      new Request("http://localhost:3000/api/dev/acceptance-login?token=acceptance-secret")
    );
    expect(production.status).toBe(404);
    expect(createAuthSession).not.toHaveBeenCalled();
  });
});
