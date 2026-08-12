import { describe, expect, it } from "vitest";

import {
  createLocalReviewUrl,
  validateLocalReviewLaunchEnvironment
} from "../../scripts/run-gi088-v8r3-review";

const localEnv = {
  NODE_ENV: "test",
  JOURNAL_EVALUATION_LOCAL_ENABLED: "I_UNDERSTAND",
  DATABASE_URL:
    "postgresql://local@127.0.0.1:5432/happiness_system_codex?schema=journal_daily_eval",
  DIRECT_URL:
    "postgresql://local@127.0.0.1:5432/happiness_system_codex?schema=journal_daily_eval"
} satisfies NodeJS.ProcessEnv;

describe("GI-088 v8r3 本机裁决启动器", () => {
  it("只接受本地确认环境和固定裁决材料根目录", () => {
    expect(validateLocalReviewLaunchEnvironment(localEnv).privateRoot).toContain(
      "artifacts/journal-generation-evaluation/.private/formal/golden-eight"
    );
    expect(() => validateLocalReviewLaunchEnvironment({ ...localEnv, VERCEL_ENV: "preview" })).toThrow(
      "GI088_LOCAL_REVIEW_PRODUCTION_FORBIDDEN"
    );
    expect(() => validateLocalReviewLaunchEnvironment({
      ...localEnv,
      DATABASE_URL: "postgresql://local@example.com:5432/happiness_system_codex?schema=journal_daily_eval"
    })).toThrow("GI088_LOCAL_REVIEW_DATABASE_NOT_LOCAL");
  });

  it("只生成固定本机路径并携带一次性令牌", () => {
    const url = createLocalReviewUrl(3108, "a".repeat(32));
    expect(url).toBe(
      "http://127.0.0.1:3108/admin/journal-evaluation/golden-eight?token=" + "a".repeat(32)
    );
    expect(() => createLocalReviewUrl(80, "a".repeat(32))).toThrow(
      "GI088_LOCAL_REVIEW_PORT_INVALID"
    );
    expect(() => createLocalReviewUrl(3108, "short")).toThrow(
      "GI088_LOCAL_REVIEW_TOKEN_INVALID"
    );
  });
});
