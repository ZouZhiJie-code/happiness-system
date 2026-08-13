import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminRequest: vi.fn(),
  isEnabled: vi.fn(),
  isLocalRequest: vi.fn(),
  loadDevelopment: vi.fn(),
  saveDevelopment: vi.fn(),
  finalizeDevelopment: vi.fn(),
  loadHidden: vi.fn(),
  saveHidden: vi.fn(),
  finalizeHidden: vi.fn()
}));

vi.mock("@/server/services/auth/admin-access", async () => {
  const actual = await vi.importActual<typeof import("@/server/services/auth/admin-access")>(
    "@/server/services/auth/admin-access"
  );
  return { ...actual, requireAdminRequest: mocks.requireAdminRequest };
});

vi.mock("@/app/admin/journal-evaluation/pro-contract-review-loader", () => ({
  isLocalJournalEvaluationEnabled: mocks.isEnabled,
  isLocalJournalEvaluationRequest: mocks.isLocalRequest,
  loadGi088ProContractDevelopmentReview: mocks.loadDevelopment,
  saveGi088ProContractDevelopmentDecision: mocks.saveDevelopment,
  finalizeGi088ProContractDevelopmentReview: mocks.finalizeDevelopment,
  loadGi088ProContractHiddenReview: mocks.loadHidden,
  saveGi088ProContractHiddenDecision: mocks.saveHidden,
  finalizeGi088ProContractHiddenReview: mocks.finalizeHidden
}));

import { POST as saveDevelopment } from "@/app/api/local/gi088-v8r3/pro-contract-development-paired/draft/route";
import { POST as finalizeDevelopment } from "@/app/api/local/gi088-v8r3/pro-contract-development-paired/finalize/route";
import { GET as loadDevelopment } from "@/app/api/local/gi088-v8r3/pro-contract-development-paired/session/route";
import { POST as saveHidden } from "@/app/api/local/gi088-v8r3/pro-contract-hidden-admission/draft/route";
import { POST as finalizeHidden } from "@/app/api/local/gi088-v8r3/pro-contract-hidden-admission/finalize/route";
import { GET as loadHidden } from "@/app/api/local/gi088-v8r3/pro-contract-hidden-admission/session/route";

const READY = {
  verdict: "ready_to_use",
  failureCategory: null,
  reason: "",
  singleCaseBlocker: false
} as const;

describe("GI-088 Pro 合同对照本机接口", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isEnabled.mockReturnValue(true);
    mocks.isLocalRequest.mockReturnValue(true);
    mocks.requireAdminRequest.mockResolvedValue({ id: "admin-1" });
    mocks.loadDevelopment.mockResolvedValue({ stage: "pro-contract-development-paired" });
    mocks.saveDevelopment.mockResolvedValue({ stage: "pro-contract-development-paired", decisions: [{}] });
    mocks.finalizeDevelopment.mockResolvedValue({ stage: "pro-contract-development-paired", status: "sealed" });
    mocks.loadHidden.mockResolvedValue({ stage: "pro-contract-hidden-admission" });
    mocks.saveHidden.mockResolvedValue({ stage: "pro-contract-hidden-admission", decisions: [{}] });
    mocks.finalizeHidden.mockResolvedValue({ stage: "pro-contract-hidden-admission", status: "sealed" });
  });

  it("两个阶段各自使用独立 session、draft 和 finalize", async () => {
    const developmentBase = "http://127.0.0.1/api/local/gi088-v8r3/pro-contract-development-paired";
    const hiddenBase = "http://127.0.0.1/api/local/gi088-v8r3/pro-contract-hidden-admission";
    expect((await loadDevelopment(new Request(`${developmentBase}/session?token=one-time`))).status).toBe(200);
    expect((await saveDevelopment(new Request(`${developmentBase}/draft?token=one-time`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        publicId: "development-1",
        left: READY,
        right: READY,
        preferredSide: "right"
      })
    }))).status).toBe(200);
    expect((await finalizeDevelopment(new Request(`${developmentBase}/finalize?token=one-time`, { method: "POST" }))).status).toBe(200);

    expect((await loadHidden(new Request(`${hiddenBase}/session?token=one-time`))).status).toBe(200);
    expect((await saveHidden(new Request(`${hiddenBase}/draft?token=one-time`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ publicId: "hidden-1", candidate: READY })
    }))).status).toBe(200);
    expect((await finalizeHidden(new Request(`${hiddenBase}/finalize?token=one-time`, { method: "POST" }))).status).toBe(200);

    expect(mocks.requireAdminRequest).toHaveBeenCalledTimes(6);
    expect(mocks.saveDevelopment).toHaveBeenCalledWith({
      publicId: "development-1",
      left: READY,
      right: READY,
      preferredSide: "right"
    });
    expect(mocks.saveHidden).toHaveBeenCalledWith({
      publicId: "hidden-1",
      candidate: READY
    });
  });

  it("远程 Host、错误令牌或关闭本机环境时统一隐藏接口", async () => {
    mocks.isLocalRequest.mockReturnValue(false);
    const response = await loadDevelopment(new Request(
      "https://example.com/api/local/gi088-v8r3/pro-contract-development-paired/session"
    ));
    expect(response.status).toBe(404);
    expect(mocks.requireAdminRequest).not.toHaveBeenCalled();
    expect(mocks.loadDevelopment).not.toHaveBeenCalled();

    mocks.isLocalRequest.mockReturnValue(true);
    mocks.isEnabled.mockReturnValue(false);
    expect((await loadHidden(new Request(
      "http://127.0.0.1/api/local/gi088-v8r3/pro-contract-hidden-admission/session"
    ))).status).toBe(404);
    expect(mocks.loadHidden).not.toHaveBeenCalled();
  });
});
