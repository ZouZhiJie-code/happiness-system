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

vi.mock("@/app/admin/journal-evaluation/runtime-contract-final-eight-loader", () => ({
  isLocalJournalEvaluationEnabled: mocks.isEnabled,
  isLocalJournalEvaluationRequest: mocks.isLocalRequest,
  loadGi088RuntimeContractFinalEight: mocks.load,
  saveGi088RuntimeContractFinalEightDecision: mocks.save,
  finalizeGi088RuntimeContractFinalEight: mocks.finalize
}));

import { POST as saveDecision } from "@/app/api/local/gi088-v8r3/runtime-contract-final-eight/draft/route";
import { POST as finalizeReview } from "@/app/api/local/gi088-v8r3/runtime-contract-final-eight/finalize/route";
import { GET as loadSession } from "@/app/api/local/gi088-v8r3/runtime-contract-final-eight/session/route";

describe("GI-088 根因对照最终 8 条本地接口", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isEnabled.mockReturnValue(true);
    mocks.isLocalRequest.mockReturnValue(true);
    mocks.requireAdminRequest.mockResolvedValue({ id: "admin-1" });
    mocks.load.mockResolvedValue({
      stage: "runtime-contract-final-eight",
      cards: []
    });
    mocks.save.mockResolvedValue({
      stage: "runtime-contract-final-eight",
      decisions: [{}]
    });
    mocks.finalize.mockResolvedValue({
      stage: "runtime-contract-final-eight",
      status: "sealed"
    });
  });

  it("三条接口共同要求本机令牌和管理员身份", async () => {
    const base = "http://127.0.0.1/api/local/gi088-v8r3/runtime-contract-final-eight";
    expect((await loadSession(new Request(`${base}/session?token=one-time`))).status)
      .toBe(200);
    const decision = {
      verdict: "ready_to_use",
      failureCategory: null,
      reason: "",
      singleCaseBlocker: false
    } as const;
    expect((await saveDecision(new Request(`${base}/draft?token=one-time`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        publicId: "public-1",
        left: decision,
        right: null,
        preferredSide: null
      })
    }))).status).toBe(200);
    expect((await finalizeReview(new Request(`${base}/finalize?token=one-time`, {
      method: "POST"
    }))).status).toBe(200);
    expect(mocks.requireAdminRequest).toHaveBeenCalledTimes(3);
    expect(mocks.save).toHaveBeenCalledWith({
      publicId: "public-1",
      left: decision,
      right: null,
      preferredSide: null
    });
  });

  it("远程 Host 或错误阶段令牌统一隐藏接口", async () => {
    mocks.isLocalRequest.mockReturnValue(false);
    const response = await loadSession(new Request(
      "https://example.com/api/local/gi088-v8r3/runtime-contract-final-eight/session"
    ));
    expect(response.status).toBe(404);
    expect(mocks.requireAdminRequest).not.toHaveBeenCalled();
    expect(mocks.load).not.toHaveBeenCalled();
  });
});
