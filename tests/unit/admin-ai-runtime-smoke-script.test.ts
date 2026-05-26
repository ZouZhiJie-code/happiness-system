import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

async function loadAdminAIRuntimeSmokeModule() {
  return import(
    pathToFileURL(resolve(import.meta.dirname, "../../scripts/admin-ai-runtime-smoke.mjs")).href
  );
}

describe("admin ai runtime smoke script", () => {
  it("infers provider cases from env", async () => {
    const { inferAdminAIRuntimeCases } = await loadAdminAIRuntimeSmokeModule();

    const cases = inferAdminAIRuntimeCases({
      ADMIN_AI_RUNTIME_ARK_API_KEY: "ark-key",
      ADMIN_AI_RUNTIME_ARK_CHAT_MODEL_ID: "deepseek-v3-2-251201",
      ADMIN_AI_RUNTIME_ARK_EMBEDDING_ENDPOINT_ID: "ep-embedding"
    });

    expect(cases.map((item: { capability: string; provider: string }) => `${item.capability}:${item.provider}`)).toEqual([
      "chat:volcengine_ark",
      "embedding:volcengine_ark"
    ]);
  });

  it("includes third-party relay cases only when explicitly enabled", async () => {
    const { inferAdminAIRuntimeCases } = await loadAdminAIRuntimeSmokeModule();

    const cases = inferAdminAIRuntimeCases({
      ADMIN_AI_RUNTIME_ALLOW_THIRD_PARTY_RELAY: "1",
      ADMIN_AI_RUNTIME_OPENAI_API_KEY: "sk-openai",
      ADMIN_AI_RUNTIME_OPENAI_CHAT_MODEL: "gpt-5",
      ADMIN_AI_RUNTIME_ANTHROPIC_API_KEY: "sk-ant",
      ADMIN_AI_RUNTIME_ANTHROPIC_CHAT_MODEL: "claude-sonnet-4-5",
      ADMIN_AI_RUNTIME_ARK_API_KEY: "ark-key",
      ADMIN_AI_RUNTIME_ARK_CHAT_MODEL_ID: "deepseek-v3-2-251201",
      ADMIN_AI_RUNTIME_OPENAI_EMBEDDING_MODEL: "text-embedding-3-large",
      ADMIN_AI_RUNTIME_ARK_EMBEDDING_ENDPOINT_ID: "ep-embedding"
    });

    expect(cases.map((item: { capability: string; provider: string }) => `${item.capability}:${item.provider}`)).toEqual([
      "chat:openai",
      "chat:anthropic",
      "chat:volcengine_ark",
      "embedding:openai",
      "embedding:volcengine_ark"
    ]);
  });

  it("can filter to chat-only cases", async () => {
    const { inferAdminAIRuntimeCases } = await loadAdminAIRuntimeSmokeModule();

    const cases = inferAdminAIRuntimeCases({
      ADMIN_AI_RUNTIME_CASE_CAPABILITIES: "chat",
      ADMIN_AI_RUNTIME_ARK_API_KEY: "ark-key",
      ADMIN_AI_RUNTIME_ARK_CHAT_MODEL_ID: "deepseek-v3-2-251201",
      ADMIN_AI_RUNTIME_ARK_EMBEDDING_ENDPOINT_ID: "ep-embedding"
    });

    expect(cases.map((item: { capability: string; provider: string }) => `${item.capability}:${item.provider}`)).toEqual([
      "chat:volcengine_ark"
    ]);
  });

  it("runs save, probe, publish, history, rollback, and optional runtime readback through admin routes", async () => {
    const { runAdminAIRuntimeSmoke } = await loadAdminAIRuntimeSmokeModule();
    const loginAccount = vi
      .fn()
      .mockRejectedValueOnce(new Error("login failed: 401 {\"error\":\"INVALID_CREDENTIALS\"}"))
      .mockResolvedValue({
        cookie: "dl_session=admin-cookie"
      });
    const registerAccount = vi.fn().mockResolvedValue({
      username: "admin_user",
      password: "secret-123",
      cookie: "dl_session=admin-cookie"
    });
    const getSession = vi.fn().mockResolvedValue({
      json: {
        authenticated: true,
        user: {
          id: "user-1",
          username: "admin_user"
        }
      }
    });
    const http = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        json: {
          draft: { id: "draft-chat-1" }
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        json: {
          probe: { id: "probe-chat-1" }
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        json: {
          publishedConfig: { id: "published-chat-1" }
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        json: {
          draft: { id: "draft-rollback-2" }
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        json: {
          probe: { id: "probe-rollback-2" }
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        json: {
          publishedConfig: { id: "published-chat-2" }
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        json: {
          history: [
            { id: "published-chat-2" },
            { id: "published-chat-1" }
          ]
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        json: {
          rolledBackConfig: { id: "published-chat-3" }
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        json: {
          ai: {
            chat: { source: "database" },
            embedding: { source: "environment" }
          }
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        json: {
          draft: { id: "draft-fallback-4" }
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        json: {
          probe: { id: "probe-fallback-4" }
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        json: {
          publishedConfig: { id: "published-chat-disabled" }
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        json: {
          ai: {
            chat: { source: "environment", fallbackReason: "DATABASE_CONFIG_DISABLED" },
            embedding: { source: "environment" }
          }
        }
      });

    const summary = await runAdminAIRuntimeSmoke(
      {
        baseUrl: "https://prod.example.com",
        username: "admin_user",
        password: "secret-123",
        runtimeReadbackToken: "probe-token",
        cases: [
          {
            capability: "chat",
            provider: "openai",
            body: {
              provider: "openai",
              enabled: true,
              displayName: "OpenAI Chat Smoke",
              apiKey: "sk-openai",
              config: {
                model: "gpt-5",
                baseUrl: "https://api.openai.com/v1"
              }
            }
          }
        ]
      },
      {
        loginAccount,
        registerAccount,
        getSession,
        http
      }
    );

    expect(registerAccount).toHaveBeenCalledWith("admin_user", "secret-123");

    expect(http).toHaveBeenNthCalledWith(
      1,
      "/api/admin/ai-runtime/chat/draft",
      expect.objectContaining({
        method: "PUT",
        cookie: "dl_session=admin-cookie"
      })
    );
    expect(http).toHaveBeenNthCalledWith(
      2,
      "/api/admin/ai-runtime/chat/probe",
      expect.objectContaining({
        method: "POST",
        cookie: "dl_session=admin-cookie"
      })
    );
    expect(http).toHaveBeenNthCalledWith(
      8,
      "/api/admin/ai-runtime/chat/rollback",
      expect.objectContaining({
        method: "POST",
        body: {
          rollbackFromId: "published-chat-1"
        }
      })
    );
    expect(http).toHaveBeenNthCalledWith(
      9,
      "/api/debug/runtime-env?probe=1",
      expect.objectContaining({
        method: "GET",
        headers: {
          "x-runtime-readback-token": "probe-token"
        }
      })
    );
    expect(http).toHaveBeenNthCalledWith(
      10,
      "/api/admin/ai-runtime/chat/draft",
      expect.objectContaining({
        method: "PUT",
        body: expect.objectContaining({
          enabled: false
        })
      })
    );
    expect(summary).toMatchObject({
      ok: true,
      cases: [
        {
          capability: "chat",
          provider: "openai",
          draftId: "draft-chat-1",
          probeId: "probe-chat-1",
          publishId: "published-chat-1"
        }
      ],
      rollback: {
        rollbackFromId: "published-chat-1",
        rolledBackConfigId: "published-chat-3"
      },
      runtimeReadback: {
        ai: {
          chat: { source: "database" }
        }
      },
      fallbackPublish: {
        draftId: "draft-fallback-4",
        publishedConfigId: "published-chat-disabled"
      },
      fallbackRuntimeReadback: {
        ai: {
          chat: {
            source: "environment",
            fallbackReason: "DATABASE_CONFIG_DISABLED"
          }
        }
      }
    });
  });
});
