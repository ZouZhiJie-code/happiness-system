import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

async function loadRuntimeReadbackModule() {
  return import(
    pathToFileURL(resolve(import.meta.dirname, "../../scripts/runtime-env-readback.mjs")).href
  );
}

describe("runtime env readback script", () => {
  it("reuses the acceptance client login flow and reads the debug route with the configured token", async () => {
    const { runRuntimeEnvReadback } = await loadRuntimeReadbackModule();

    const registerAccount = vi.fn().mockResolvedValue({
      username: "runtime_user",
      password: "custom-secret-42",
      cookie: "dl_session=register-cookie",
      register: {
        status: 200,
        json: {
          authenticated: true,
          user: { id: "user-1", username: "runtime_user" }
        }
      }
    });
    const loginAccount = vi.fn().mockResolvedValue({
      username: "runtime_user",
      cookie: "dl_session=login-cookie",
      login: {
        status: 200,
        json: {
          authenticated: true,
          user: { id: "user-1", username: "runtime_user" }
        }
      }
    });
    const getSession = vi.fn().mockResolvedValue({
      status: 200,
      json: {
        authenticated: true,
        user: { id: "user-1", username: "runtime_user" }
      }
    });
    const http = vi.fn().mockResolvedValue({
      status: 200,
      json: {
        requestHost: "prod.example.com",
        env: {
          VERCEL: "1",
          VERCEL_TARGET_ENV: "production",
          VERCEL_URL: "deploy.example.vercel.app",
          VERCEL_BRANCH_URL: null,
          VERCEL_PROJECT_PRODUCTION_URL: "prod.example.com",
          VERCEL_DEPLOYMENT_ID: "dpl_123",
          APP_URL: "https://prod.example.com"
        },
        resolved: {
          deploymentUrl: "https://deploy.example.vercel.app",
          branchUrl: null,
          projectProductionUrl: "https://prod.example.com",
          appUrl: "https://prod.example.com"
        }
      }
    });

    const summary = await runRuntimeEnvReadback(
      {
        baseUrl: "https://prod.example.com",
        prefix: "runtime",
        token: "secret-token"
      },
      {
        registerAccount,
        loginAccount,
        getSession,
        http
      }
    );

    expect(loginAccount).toHaveBeenCalledWith({
      username: "runtime_user",
      password: "custom-secret-42"
    });
    expect(http).toHaveBeenCalledWith("/api/debug/runtime-env", {
      cookie: "dl_session=login-cookie",
      headers: {
        "x-runtime-readback-token": "secret-token"
      }
    });
    expect(summary).toEqual({
      ok: true,
      baseUrl: "https://prod.example.com",
      account: { username: "runtime_user" },
      env: {
        VERCEL: "1",
        VERCEL_TARGET_ENV: "production",
        VERCEL_URL: "deploy.example.vercel.app",
        VERCEL_BRANCH_URL: null,
        VERCEL_PROJECT_PRODUCTION_URL: "prod.example.com",
        VERCEL_DEPLOYMENT_ID: "dpl_123",
        APP_URL: "https://prod.example.com"
      },
      resolved: {
        deploymentUrl: "https://deploy.example.vercel.app",
        branchUrl: null,
        projectProductionUrl: "https://prod.example.com",
        appUrl: "https://prod.example.com"
      }
    });
  });
});
