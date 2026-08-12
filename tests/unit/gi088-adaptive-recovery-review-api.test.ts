import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminRequest: vi.fn(),
  isEnabled: vi.fn(),
  isLocalRequest: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
  finalize: vi.fn()
}));

vi.mock("@/server/services/auth/admin-access", async () => {
  const actual = await vi.importActual<typeof import("@/server/services/auth/admin-access")>(
    "@/server/services/auth/admin-access"
  );
  return { ...actual, requireAdminRequest: mocks.requireAdminRequest };
});

vi.mock("@/app/admin/journal-evaluation/adaptive-recovery-review-loader", () => ({
  isLocalJournalEvaluationEnabled: mocks.isEnabled,
  isLocalJournalEvaluationRequest: mocks.isLocalRequest,
  loadGi088AdaptiveRecoveryReview: mocks.load,
  saveGi088AdaptiveRecoveryDecision: mocks.save,
  finalizeGi088AdaptiveRecoveryReview: mocks.finalize
}));

import { POST as saveDecision } from "@/app/api/local/gi088-v8r3/adaptive-recovery-review/draft/route";
import { POST as finalizeReview } from "@/app/api/local/gi088-v8r3/adaptive-recovery-review/finalize/route";
import { GET as loadSession } from "@/app/api/local/gi088-v8r3/adaptive-recovery-review/session/route";

describe("GI-088 v8r3r3 恢复赢家本地接口", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isEnabled.mockReturnValue(true);
    mocks.isLocalRequest.mockReturnValue(true);
    mocks.requireAdminRequest.mockResolvedValue({ id: "admin-1" });
    mocks.load.mockResolvedValue({ stage: "adaptive-recovery", cards: [] });
    mocks.save.mockResolvedValue({ stage: "adaptive-recovery", decisions: [{}] });
    mocks.finalize.mockResolvedValue({ stage: "adaptive-recovery", status: "sealed" });
  });

  it("读取、保存和封存均要求本机令牌与管理员身份", async () => {
    const session = new Request(
      "http://127.0.0.1/api/local/gi088-v8r3/adaptive-recovery-review/session?token=one-time"
    );
    expect((await loadSession(session)).status).toBe(200);

    const draft = new Request(
      "http://127.0.0.1/api/local/gi088-v8r3/adaptive-recovery-review/draft?token=one-time",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          publicId: "review-1",
          verdict: "ready_to_use",
          failureCategory: null,
          reason: "",
          singleCaseBlocker: false
        })
      }
    );
    expect((await saveDecision(draft)).status).toBe(200);
    expect((await finalizeReview(new Request(
      "http://127.0.0.1/api/local/gi088-v8r3/adaptive-recovery-review/finalize?token=one-time",
      { method: "POST" }
    ))).status).toBe(200);
    expect(mocks.requireAdminRequest).toHaveBeenCalledTimes(3);
  });

  it("远程 Host、错误令牌或关闭本机门时隐藏接口", async () => {
    mocks.isLocalRequest.mockReturnValue(false);
    const response = await loadSession(new Request(
      "https://example.com/api/local/gi088-v8r3/adaptive-recovery-review/session"
    ));
    expect(response.status).toBe(404);
    expect(mocks.requireAdminRequest).not.toHaveBeenCalled();
    expect(mocks.load).not.toHaveBeenCalled();
  });
});
