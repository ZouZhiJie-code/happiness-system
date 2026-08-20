import { afterEach, describe, expect, it, vi } from "vitest";

import { getAIProvider } from "@/server/services/ai";
import {
  E2EZeroModelGuardError,
  isE2EZeroModelEnabled
} from "@/server/services/ai/e2e-zero-model-guard";
import { getEventCenteredAIProvider } from "@/server/services/ai/event-centered-provider";

const schema = "daily_light_e2e_guard123";
const localDatabaseUrl = `postgresql://e2e:e2e@127.0.0.1:5432/happiness_system_codex?schema=${schema}`;
const localDirectUrl = `postgresql://e2e:e2e@localhost:5432/happiness_system_codex?schema=${schema}`;

function enabledEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return Object.assign({
    NODE_ENV: "test",
    DAILY_LIGHT_E2E_ZERO_MODEL: "I_UNDERSTAND",
    DATABASE_URL: localDatabaseUrl,
    DIRECT_URL: localDirectUrl
  } satisfies NodeJS.ProcessEnv, overrides);
}

function expectGuardCode(env: NodeJS.ProcessEnv, code: string) {
  try {
    isE2EZeroModelEnabled(env);
    throw new Error("EXPECTED_E2E_ZERO_MODEL_GUARD_ERROR");
  } catch (error) {
    expect(error).toBeInstanceOf(E2EZeroModelGuardError);
    expect(error).toMatchObject({ code });
  }
}

describe("E2E zero-model guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the production provider path unchanged while the E2E flag is absent", () => {
    expect(isE2EZeroModelEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("accepts only an acknowledged loopback temporary schema", () => {
    expect(isE2EZeroModelEnabled(enabledEnv())).toBe(true);
  });

  it.each([
    [enabledEnv({ NODE_ENV: "production" }), "E2E_ZERO_MODEL_PRODUCTION_FORBIDDEN"],
    [enabledEnv({ VERCEL_ENV: "preview" }), "E2E_ZERO_MODEL_VERCEL_FORBIDDEN"],
    [enabledEnv({ DATABASE_URL: "postgresql://e2e:e2e@db.example.com:5432/app?schema=daily_light_e2e_guard123" }), "E2E_ZERO_MODEL_DATABASE_TARGET_FORBIDDEN"],
    [enabledEnv({ DIRECT_URL: "postgresql://e2e:e2e@127.0.0.1:5432/happiness_system_codex?schema=public" }), "E2E_ZERO_MODEL_DIRECT_TARGET_FORBIDDEN"],
    [enabledEnv({ DIRECT_URL: "postgresql://e2e:e2e@127.0.0.1:5432/other?schema=daily_light_e2e_guard123" }), "E2E_ZERO_MODEL_DATABASE_TARGET_MISMATCH"]
  ])("fails closed for an unsafe target", (env, code) => {
    expectGuardCode(env, code);
  });

  it("short-circuits the shared Provider before runtime configuration is read", async () => {
    for (const [key, value] of Object.entries(enabledEnv())) {
      if (value !== undefined) vi.stubEnv(key, value);
    }
    vi.stubEnv("DEEPSEEK_API_KEY", "would-be-real-key");

    await expect(getAIProvider("chat")).resolves.toBeNull();
  });

  it("short-circuits the event-centered candidate before any Provider is created", async () => {
    const getFallbackProvider = vi.fn();
    const createProvider = vi.fn();
    const result = await getEventCenteredAIProvider({
      env: enabledEnv({
        INTERVIEW_EVENT_CENTERED_SCOPE: "thought_only",
        EVENT_CENTERED_GENERATIVE_MODEL: "deepseek-v4-flash",
        AI_PROVIDER: "openai",
        DEEPSEEK_API_KEY: "would-be-real-key",
        DEEPSEEK_BASE_URL: "https://api.deepseek.com",
        DEEPSEEK_MODEL: "deepseek-v4-flash"
      }),
      getFallbackProvider,
      createProvider
    });

    expect(result).toBeNull();
    expect(getFallbackProvider).not.toHaveBeenCalled();
    expect(createProvider).not.toHaveBeenCalled();
  });
});
