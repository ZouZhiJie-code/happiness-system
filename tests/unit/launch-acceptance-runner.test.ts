import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../..");
const runnerModuleHref = pathToFileURL(
  resolve(repoRoot, "scripts/launch-acceptance-runner.mjs")
).href;

async function loadRunnerModule() {
  return import(`${runnerModuleHref}?t=${Date.now()}-${Math.random()}`);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("launch acceptance runner transport selection", () => {
  it("defaults to fetch transport when no transport env is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ authenticated: false, user: null }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { createAcceptanceClient } = await loadRunnerModule();
    const client = createAcceptanceClient({ baseUrl: "http://127.0.0.1:4010" });
    const response = await client.getSession({ cookie: "dl_session=test-cookie" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:4010/api/auth/session", {
      method: "GET",
      headers: {
        cookie: "dl_session=test-cookie"
      },
      body: undefined,
      redirect: "manual"
    });
    expect(response).toMatchObject({
      status: 200,
      setCookie: null,
      text: JSON.stringify({ authenticated: false, user: null }),
      json: {
        authenticated: false,
        user: null
      }
    });
  });

  it("merges custom headers for fetch transport requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { createAcceptanceClient } = await loadRunnerModule();
    const client = createAcceptanceClient({ baseUrl: "http://127.0.0.1:4010" });

    await client.http("/api/debug/runtime-env", {
      cookie: "dl_session=test-cookie",
      headers: {
        "x-runtime-readback-token": "secret-token"
      }
    });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:4010/api/debug/runtime-env", {
      method: "GET",
      headers: {
        cookie: "dl_session=test-cookie",
        "x-runtime-readback-token": "secret-token"
      },
      body: undefined,
      redirect: "manual"
    });
  });

  it("uses vercel curl transport when ACCEPTANCE_TRANSPORT=vercel-curl", async () => {
    vi.stubEnv("ACCEPTANCE_TRANSPORT", "vercel-curl");
    vi.stubEnv("ACCEPTANCE_VERCEL_SCOPE", "zouzhijies-projects");
    vi.stubEnv("ACCEPTANCE_VERCEL_CWD", "/repo/root");

    const execFileSync = vi.fn().mockReturnValue(`HTTP/2 200
content-type: application/json

{"authenticated":true,"user":{"id":"user-1","username":"preview_user"}}`);
    vi.doMock("node:child_process", () => ({
      default: {
        execFileSync
      },
      execFileSync
    }));
    vi.doMock("node:fs", () => ({
      default: {
        existsSync: vi.fn().mockReturnValue(true)
      },
      existsSync: vi.fn().mockReturnValue(true)
    }));

    const { createAcceptanceClient } = await loadRunnerModule();
    const client = createAcceptanceClient({ baseUrl: "https://preview.example.vercel.app" });
    const response = await client.getSession({ cookie: "dl_session=preview-cookie" });

    expect(execFileSync).toHaveBeenCalledTimes(1);
    expect(execFileSync).toHaveBeenCalledWith(
      "vercel",
      [
        "curl",
        "/api/auth/session",
        "--deployment",
        "https://preview.example.vercel.app",
        "--yes",
        "--scope",
        "zouzhijies-projects",
        "--",
        "-i",
        "--header",
        "cookie: dl_session=preview-cookie"
      ],
      {
        cwd: "/repo/root",
        encoding: "utf8",
        input: undefined,
        maxBuffer: 10485760
      }
    );
    expect(response).toEqual({
      status: 200,
      headers: {
        "content-type": "application/json"
      },
      setCookie: null,
      text: JSON.stringify({
        authenticated: true,
        user: { id: "user-1", username: "preview_user" }
      }),
      json: {
        authenticated: true,
        user: { id: "user-1", username: "preview_user" }
      }
    });
  });

  it("passes JSON bodies and parses the final response block from vercel curl output", async () => {
    vi.stubEnv("ACCEPTANCE_TRANSPORT", "vercel-curl");

    const execFileSync = vi.fn().mockReturnValue(`HTTP/1.1 200 Connection established

HTTP/2 200
set-cookie: dl_session=preview-cookie; Path=/; HttpOnly
content-type: application/json

{"authenticated":true,"user":{"id":"user-1","username":"preview_user"}}`);
    vi.doMock("node:child_process", () => ({
      default: {
        execFileSync
      },
      execFileSync
    }));
    const existsSync = vi.fn((targetPath) => targetPath === resolve(repoRoot, ".vercel/project.json"));
    vi.doMock("node:fs", () => ({
      default: {
        existsSync
      },
      existsSync
    }));

    const { createAcceptanceClient } = await loadRunnerModule();
    const client = createAcceptanceClient({ baseUrl: "https://preview.example.vercel.app" });
    const response = await client.loginAccount({
      username: "preview_user",
      password: "accept123"
    });

    expect(execFileSync).toHaveBeenCalledWith(
      "vercel",
      [
        "curl",
        "/api/auth/login",
        "--deployment",
        "https://preview.example.vercel.app",
        "--yes",
        "--",
        "-i",
        "--request",
        "POST",
        "--header",
        "content-type: application/json",
        "--data",
        JSON.stringify({
          username: "preview_user",
          password: "accept123"
        })
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        input: undefined,
        maxBuffer: 10485760
      }
    );
    expect(response).toMatchObject({
      username: "preview_user",
      cookie: "dl_session=preview-cookie",
      login: {
        status: 200,
        setCookie: "dl_session=preview-cookie; Path=/; HttpOnly",
        headers: {
          "content-type": "application/json",
          "set-cookie": "dl_session=preview-cookie; Path=/; HttpOnly"
        },
        json: {
          authenticated: true,
          user: { id: "user-1", username: "preview_user" }
        }
      }
    });
  });

  it("prefers the parent repo root for vercel cwd when running inside a .worktrees checkout", async () => {
    vi.stubEnv("ACCEPTANCE_TRANSPORT", "vercel-curl");

    const execFileSync = vi.fn().mockReturnValue(`HTTP/2 200
content-type: application/json

{"authenticated":false,"user":null}`);
    vi.doMock("node:child_process", () => ({
      default: {
        execFileSync
      },
      execFileSync
    }));

    const existsSync = vi.fn((targetPath) => targetPath === resolve(repoRoot, ".vercel/project.json"));
    vi.doMock("node:fs", () => ({
      default: {
        existsSync
      },
      existsSync
    }));

    const { createAcceptanceClient } = await loadRunnerModule();
    const client = createAcceptanceClient({ baseUrl: "https://preview.example.vercel.app" });

    await client.getSession({ cookie: "dl_session=preview-cookie" });

    expect(execFileSync).toHaveBeenCalledWith(
      "vercel",
      expect.any(Array),
      expect.objectContaining({
        cwd: repoRoot
      })
    );
  });

  it("passes custom headers through the vercel curl transport", async () => {
    vi.stubEnv("ACCEPTANCE_TRANSPORT", "vercel-curl");
    vi.stubEnv("ACCEPTANCE_VERCEL_CWD", "/repo/root");

    const execFileSync = vi.fn().mockReturnValue(`HTTP/2 200
content-type: application/json

{"ok":true}`);
    vi.doMock("node:child_process", () => ({
      default: {
        execFileSync
      },
      execFileSync
    }));
    vi.doMock("node:fs", () => ({
      default: {
        existsSync: vi.fn().mockReturnValue(true)
      },
      existsSync: vi.fn().mockReturnValue(true)
    }));

    const { createAcceptanceClient } = await loadRunnerModule();
    const client = createAcceptanceClient({ baseUrl: "https://preview.example.vercel.app" });

    await client.http("/api/debug/runtime-env", {
      cookie: "dl_session=preview-cookie",
      headers: {
        "x-runtime-readback-token": "secret-token"
      }
    });

    expect(execFileSync).toHaveBeenCalledWith(
      "vercel",
      [
        "curl",
        "/api/debug/runtime-env",
        "--deployment",
        "https://preview.example.vercel.app",
        "--yes",
        "--",
        "-i",
        "--header",
        "cookie: dl_session=preview-cookie",
        "--header",
        "x-runtime-readback-token: secret-token"
      ],
      {
        cwd: "/repo/root",
        encoding: "utf8",
        input: undefined,
        maxBuffer: 10485760
      }
    );
  });
});
