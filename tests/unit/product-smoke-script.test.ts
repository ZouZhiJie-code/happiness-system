import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it, vi } from "vitest";

async function loadProductSmokeModule() {
  return import(
    pathToFileURL(resolve(import.meta.dirname, "../../scripts/product-smoke.mjs")).href
  );
}

describe("product smoke script", () => {
  it("uses the provided non-default baseUrl for the default helper requests", async () => {
    const { runProductSmoke } = await loadProductSmokeModule();
    const baseUrl = "http://127.0.0.1:4010";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authenticated: true,
            user: { id: "user-1", username: "lane2_user" }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "set-cookie": "dl_session=register-cookie; Path=/; HttpOnly"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authenticated: true,
            user: { id: "user-1", username: "lane2_user" }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "set-cookie": "dl_session=login-cookie; Path=/; HttpOnly"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authenticated: true,
            user: { id: "user-1", username: "lane2_user" }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sessionId: "session-1",
            session: {
              dimension: "joy",
              stage: "collect_event",
              draftGenerationUnlocked: false,
              pendingDecision: null
            }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "INVALID_START_REQUEST" }), {
          status: 400,
          headers: {
            "content-type": "application/json"
          }
        })
      );

    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Date, "now").mockReturnValue(1716111111111);
    vi.spyOn(Math, "random").mockReturnValue(0.123);

    const summary = await runProductSmoke({
      baseUrl,
      dimension: "joy",
      entryDate: "2026-05-19",
      prefix: "lane2"
    });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith(baseUrl))).toBe(true);
    expect(summary.ok).toBe(true);
    expect(summary.baseUrl).toBe(baseUrl);

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reuses the password returned by registration when logging in", async () => {
    const { runProductSmoke } = await loadProductSmokeModule();

    const registerAccount = vi.fn().mockResolvedValue({
      username: "lane2_user",
      password: "custom-secret-42",
      cookie: "dl_session=register-cookie",
      register: {
        status: 200,
        json: {
          authenticated: true,
          user: { id: "user-1", username: "lane2_user" }
        }
      }
    });
    const loginAccount = vi.fn().mockResolvedValue({
      username: "lane2_user",
      cookie: "dl_session=login-cookie",
      login: {
        status: 200,
        json: {
          authenticated: true,
          user: { id: "user-1", username: "lane2_user" }
        }
      }
    });
    const getSession = vi.fn().mockResolvedValue({
      status: 200,
      json: {
        authenticated: true,
        user: { id: "user-1", username: "lane2_user" }
      }
    });
    const startSession = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        json: {
          sessionId: "session-1",
          session: {
            dimension: "joy",
            stage: "collect_event",
            draftGenerationUnlocked: false,
            pendingDecision: null
          }
        }
      })
      .mockResolvedValueOnce({
        status: 400,
        json: { error: "INVALID_START_REQUEST" }
      });

    const summary = await runProductSmoke(
      {
        baseUrl: "http://127.0.0.1:3001",
        dimension: "joy",
        entryDate: "2026-05-19",
        prefix: "lane2"
      },
      {
        registerAccount,
        loginAccount,
        getSession,
        startSession
      }
    );

    expect(registerAccount).toHaveBeenCalledWith("lane2");
    expect(loginAccount).toHaveBeenCalledWith({
      username: "lane2_user",
      password: "custom-secret-42"
    });
    expect(getSession).toHaveBeenCalledWith({ cookie: "dl_session=login-cookie" });
    expect(startSession).toHaveBeenNthCalledWith(1, {
      cookie: "dl_session=login-cookie",
      dimension: "joy",
      entryDate: "2026-05-19"
    });
    expect(startSession).toHaveBeenNthCalledWith(2, {
      cookie: "dl_session=login-cookie",
      dimension: "joy",
      entryDate: "2026-02-30"
    });
    expect(summary).toEqual({
      ok: true,
      baseUrl: "http://127.0.0.1:3001",
      dimension: "joy",
      entryDate: "2026-05-19",
      account: {
        username: "lane2_user"
      },
      steps: [
        {
          name: "register",
          ok: true,
          status: 200,
          authenticated: true,
          cookieEstablished: true
        },
        {
          name: "login",
          ok: true,
          status: 200,
          authenticated: true,
          cookieEstablished: true
        },
        {
          name: "session",
          ok: true,
          status: 200,
          authenticated: true,
          user: {
            id: "user-1",
            username: "lane2_user"
          }
        },
        {
          name: "start",
          ok: true,
          status: 200,
          sessionId: "session-1",
          stage: "collect_event",
          draftGenerationUnlocked: false
        },
        {
          name: "invalid_entry_date",
          ok: true,
          status: 400,
          error: "INVALID_START_REQUEST"
        }
      ]
    });
  });

  it("fails closed when the authenticated session check does not return a logged-in user", async () => {
    const { runProductSmoke } = await loadProductSmokeModule();

    const registerAccount = vi.fn().mockResolvedValue({
      username: "lane2_user",
      password: "accept123",
      cookie: "dl_session=register-cookie",
      register: {
        status: 200,
        json: {
          authenticated: true,
          user: { id: "user-1", username: "lane2_user" }
        }
      }
    });
    const loginAccount = vi.fn().mockResolvedValue({
      username: "lane2_user",
      cookie: "dl_session=login-cookie",
      login: {
        status: 200,
        json: {
          authenticated: true,
          user: { id: "user-1", username: "lane2_user" }
        }
      }
    });
    const getSession = vi.fn().mockResolvedValue({
      status: 200,
      json: {
        authenticated: false,
        user: null
      }
    });
    const startSession = vi.fn();

    const summary = await runProductSmoke(
      {
        baseUrl: "http://127.0.0.1:3001",
        dimension: "joy",
        entryDate: "2026-05-19",
        prefix: "lane2"
      },
      {
        registerAccount,
        loginAccount,
        getSession,
        startSession
      }
    );

    expect(startSession).not.toHaveBeenCalled();
    expect(summary).toEqual({
      ok: false,
      baseUrl: "http://127.0.0.1:3001",
      dimension: "joy",
      entryDate: "2026-05-19",
      account: {
        username: "lane2_user"
      },
      steps: [
        {
          name: "register",
          ok: true,
          status: 200,
          authenticated: true,
          cookieEstablished: true
        },
        {
          name: "login",
          ok: true,
          status: 200,
          authenticated: true,
          cookieEstablished: true
        },
        {
          name: "session",
          ok: false,
          status: 200,
          authenticated: false,
          error: "SESSION_NOT_AUTHENTICATED"
        }
      ]
    });
  });
});
