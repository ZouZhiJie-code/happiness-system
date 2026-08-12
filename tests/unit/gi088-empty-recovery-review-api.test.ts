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

vi.mock("@/app/admin/journal-evaluation/empty-recovery-review-loader", () => ({
  isLocalJournalEvaluationEnabled: mocks.isEnabled,
  isLocalJournalEvaluationRequest: mocks.isLocalRequest,
  loadGi088EmptyRecoveryReview: mocks.load,
  saveGi088EmptyRecoveryDecision: mocks.save,
  finalizeGi088EmptyRecoveryReview: mocks.finalize
}));

import { POST as saveDecision } from "@/app/api/local/gi088-v8r3/empty-recovery-review/draft/route";
import { POST as finalizeReview } from "@/app/api/local/gi088-v8r3/empty-recovery-review/finalize/route";
import { GET as loadSession } from "@/app/api/local/gi088-v8r3/empty-recovery-review/session/route";

describe("GI-088 EMPTY 恢复裁决本地接口", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isEnabled.mockReturnValue(true);
    mocks.isLocalRequest.mockReturnValue(true);
    mocks.requireAdminRequest.mockResolvedValue({ id: "admin-1" });
    mocks.load.mockResolvedValue({ stage: "empty-recovery", cards: [] });
    mocks.save.mockResolvedValue({ stage: "empty-recovery", decisions: [{}] });
    mocks.finalize.mockResolvedValue({ stage: "empty-recovery", status: "sealed" });
  });

  it("三个接口均要求本机令牌与管理员身份", async () => {
    const sessionRequest = new Request(
      "http://127.0.0.1/api/local/gi088-v8r3/empty-recovery-review/session?token=one-time"
    );
    expect((await loadSession(sessionRequest)).status).toBe(200);

    const draftRequest = new Request(
      "http://127.0.0.1/api/local/gi088-v8r3/empty-recovery-review/draft?token=one-time",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          publicId: "public-1",
          verdict: "ready_to_use",
          failureCategory: null,
          reason: "",
          singleCaseBlocker: false
        })
      }
    );
    expect((await saveDecision(draftRequest)).status).toBe(200);

    const finalizeRequest = new Request(
      "http://127.0.0.1/api/local/gi088-v8r3/empty-recovery-review/finalize?token=one-time",
      { method: "POST" }
    );
    expect((await finalizeReview(finalizeRequest)).status).toBe(200);
    expect(mocks.requireAdminRequest).toHaveBeenCalledTimes(3);
    expect(mocks.save).toHaveBeenCalledWith({
      publicId: "public-1",
      verdict: "ready_to_use",
      failureCategory: null,
      reason: "",
      singleCaseBlocker: false
    });
  });

  it("远程 Host、错误令牌或关闭本机门时统一隐藏接口", async () => {
    mocks.isLocalRequest.mockReturnValue(false);
    const response = await loadSession(
      new Request("https://example.com/api/local/gi088-v8r3/empty-recovery-review/session")
    );
    expect(response.status).toBe(404);
    expect(mocks.requireAdminRequest).not.toHaveBeenCalled();
    expect(mocks.load).not.toHaveBeenCalled();
  });
});
