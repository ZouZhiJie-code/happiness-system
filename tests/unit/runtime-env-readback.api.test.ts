const { mockRequireCurrentUserFromRequest } = vi.hoisted(() => ({
  mockRequireCurrentUserFromRequest: vi.fn()
}));

const { mockProbeAIProvider } = vi.hoisted(() => ({
  mockProbeAIProvider: vi.fn()
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  requireCurrentUserFromRequest: mockRequireCurrentUserFromRequest
}));

vi.mock("@/server/services/ai", async () => {
  const actual = await vi.importActual<typeof import("@/server/services/ai")>("@/server/services/ai");

  return {
    ...actual,
    probeAIProvider: mockProbeAIProvider
  };
});

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { GET, dynamic } from "@/app/api/debug/runtime-env/route";

describe("runtime env readback api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockProbeAIProvider.mockReset();
    mockRequireCurrentUserFromRequest.mockResolvedValue({
      id: "user-1",
      username: "daily_light_01"
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("forces dynamic execution", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("returns 404 when the route is disabled", async () => {
    const response = await GET(new Request("http://localhost/api/debug/runtime-env"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "RUNTIME_ENV_READBACK_DISABLED" });
    expect(mockRequireCurrentUserFromRequest).not.toHaveBeenCalled();
  });

  it("returns 503 when enabled without a configured token", async () => {
    vi.stubEnv("ENABLE_RUNTIME_ENV_READBACK", "1");

    const response = await GET(new Request("http://localhost/api/debug/runtime-env"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "RUNTIME_ENV_READBACK_NOT_CONFIGURED" });
    expect(mockRequireCurrentUserFromRequest).not.toHaveBeenCalled();
  });

  it("returns 403 when the token header is missing or invalid", async () => {
    vi.stubEnv("ENABLE_RUNTIME_ENV_READBACK", "1");
    vi.stubEnv("RUNTIME_ENV_READBACK_TOKEN", "secret-token");

    const response = await GET(new Request("http://localhost/api/debug/runtime-env"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "RUNTIME_ENV_READBACK_FORBIDDEN" });
    expect(mockRequireCurrentUserFromRequest).not.toHaveBeenCalled();
  });

  it("returns 401 when the caller is not authenticated", async () => {
    vi.stubEnv("ENABLE_RUNTIME_ENV_READBACK", "1");
    vi.stubEnv("RUNTIME_ENV_READBACK_TOKEN", "secret-token");
    mockRequireCurrentUserFromRequest.mockRejectedValueOnce(new Error("AUTHENTICATION_REQUIRED"));

    const response = await GET(
      new Request("http://localhost/api/debug/runtime-env", {
        headers: {
          "x-runtime-readback-token": "secret-token"
        }
      })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "AUTHENTICATION_REQUIRED" });
  });

  it("returns 500 for unexpected runtime readback failures", async () => {
    vi.stubEnv("ENABLE_RUNTIME_ENV_READBACK", "1");
    vi.stubEnv("RUNTIME_ENV_READBACK_TOKEN", "secret-token");
    mockRequireCurrentUserFromRequest.mockRejectedValueOnce(new Error("unexpected"));

    const response = await GET(
      new Request("http://localhost/api/debug/runtime-env", {
        headers: {
          "x-runtime-readback-token": "secret-token"
        }
      })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "RUNTIME_ENV_READBACK_FAILED" });
  });

  it("returns the whitelisted runtime env payload for an authenticated request with the correct token", async () => {
    vi.stubEnv("ENABLE_RUNTIME_ENV_READBACK", "1");
    vi.stubEnv("RUNTIME_ENV_READBACK_TOKEN", "secret-token");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_TARGET_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "preview.example.vercel.app");
    vi.stubEnv("VERCEL_BRANCH_URL", "project-git-feature.example.vercel.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "dailylight.example.com");
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_123");
    vi.stubEnv("APP_URL", "https://dailylight.example.com");
    vi.stubEnv("AI_PROVIDER", "volcengine-ark");
    vi.stubEnv("VOLCENGINE_ARK_API_KEY", "ark-api-key");
    vi.stubEnv("VOLCENGINE_ARK_ENDPOINT_ID", "ep-live-ready");
    vi.stubEnv("VOLCENGINE_ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3");

    const response = await GET(
      new Request("https://preview.example.vercel.app/api/debug/runtime-env", {
        headers: {
          "x-runtime-readback-token": "secret-token",
          cookie: "dl_session=valid-session"
        }
      })
    );

    expect(response.status).toBe(200);
    expect(mockRequireCurrentUserFromRequest).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({
      requestHost: "preview.example.vercel.app",
      env: {
        VERCEL: "1",
        VERCEL_TARGET_ENV: "preview",
        VERCEL_URL: "preview.example.vercel.app",
        VERCEL_BRANCH_URL: "project-git-feature.example.vercel.app",
        VERCEL_PROJECT_PRODUCTION_URL: "dailylight.example.com",
        VERCEL_DEPLOYMENT_ID: "dpl_123",
        APP_URL: "https://dailylight.example.com"
      },
      resolved: {
        deploymentUrl: "https://preview.example.vercel.app",
        branchUrl: "https://project-git-feature.example.vercel.app",
        projectProductionUrl: "https://dailylight.example.com",
        appUrl: "https://dailylight.example.com"
      },
      ai: {
        provider: "volcengine-ark",
        available: true,
        state: "ready",
        code: "READY",
        issues: [],
        configSummary: {
          hasApiKey: true,
          hasModel: true,
          hasBaseUrl: true,
          modelSource: "VOLCENGINE_ARK_ENDPOINT_ID",
          baseUrlHost: "ark.cn-beijing.volces.com"
        },
        probe: null
      }
    });
  });

  it("returns AI config diagnostics and an optional probe result", async () => {
    vi.stubEnv("ENABLE_RUNTIME_ENV_READBACK", "1");
    vi.stubEnv("RUNTIME_ENV_READBACK_TOKEN", "secret-token");
    vi.stubEnv("AI_PROVIDER", "volcengine-ark");
    vi.stubEnv("VOLCENGINE_ARK_API_KEY", "$VOLCENGINE_ARK_API_KEY\\n");
    vi.stubEnv("VOLCENGINE_ARK_ENDPOINT_ID", "ep-live-ready");
    vi.stubEnv("VOLCENGINE_ARK_BASE_URL", "$VOLCENGINE_ARK_BASE_URL\\n");
    mockProbeAIProvider.mockResolvedValueOnce({
      ok: false,
      attempted: false,
      provider: "volcengine-ark",
      code: "PLACEHOLDER_API_KEY",
      status: null,
      latencyMs: null
    });

    const response = await GET(
      new Request("https://preview.example.vercel.app/api/debug/runtime-env?probe=1", {
        headers: {
          "x-runtime-readback-token": "secret-token",
          cookie: "dl_session=valid-session"
        }
      })
    );

    expect(response.status).toBe(200);
    expect(mockProbeAIProvider).toHaveBeenCalledTimes(1);
    expect(await response.json()).toMatchObject({
      ai: {
        provider: "volcengine-ark",
        available: false,
        state: "config_invalid",
        code: "PLACEHOLDER_API_KEY",
        issues: ["PLACEHOLDER_API_KEY", "PLACEHOLDER_BASE_URL"],
        probe: {
          ok: false,
          attempted: false,
          provider: "volcengine-ark",
          code: "PLACEHOLDER_API_KEY"
        }
      }
    });
  });
});
