import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordCompatibilitySmoke: vi.fn(),
  verifyCompatibilityEvidence: vi.fn()
}));

vi.mock("@/server/services/evaluation/gi088/compatibility-evidence", () => ({
  verifyGi088CompatibilityEvidence: mocks.verifyCompatibilityEvidence
}));

vi.mock("@/server/services/evaluation/gi088/http", () => ({
  withGi088Evaluation: async (
    _request: Request,
    handler: (input: {
      ownerUserId: string;
      service: {
        recordCompatibilitySmoke: typeof mocks.recordCompatibilitySmoke;
      };
    }) => Promise<unknown>
  ) => handler({
    ownerUserId: "owner-route-contract",
    service: {
      recordCompatibilitySmoke: mocks.recordCompatibilitySmoke
    }
  })
}));

import { POST } from "@/app/api/preview/gi088/compatibility-smoke/route";

beforeEach(() => {
  mocks.recordCompatibilitySmoke.mockReset();
  mocks.verifyCompatibilityEvidence.mockReset();
});

describe("GI-088 v8r3 compatibility smoke route contract", () => {
  it("只接受完整的外部兼容结果", async () => {
    const request = new Request(
      "http://localhost/api/preview/gi088/compatibility-smoke",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runId: "123e4567-e89b-12d3-a456-426614174000",
          taskId: "A5",
          outcome: "unknown",
          reason: "真实链路结果。",
          clientOperationId: "compatibility-result"
        })
      }
    );

    await expect(POST(request)).rejects.toMatchObject({
      code: "GI088_COMPATIBILITY_SMOKE_INPUT_INVALID",
      status: 400
    });
    expect(mocks.recordCompatibilitySmoke).not.toHaveBeenCalled();
  });

  it("把通过或失败结果原样交给零模型登记 mutation", async () => {
    mocks.recordCompatibilitySmoke.mockResolvedValue({ ok: true });
    mocks.verifyCompatibilityEvidence.mockResolvedValue({
      productSessionFingerprint: "a".repeat(64),
      recordMode: "capture",
      completedUserTurnCount: 1,
      questionFormTurnCount: 0,
      visibleQuestionCount: 0,
      providerCallCount: 0
    });
    const request = new Request(
      "http://localhost/api/preview/gi088/compatibility-smoke",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runId: "123e4567-e89b-12d3-a456-426614174000",
          taskId: "A5",
          outcome: "passed",
          reason: "真实【帮我记】链路已完成忠实承接。",
          productSessionId: "capture-session-a5",
          clientOperationId: "compatibility-result"
        })
      }
    );

    await expect(POST(request)).resolves.toEqual({ ok: true });
    expect(mocks.verifyCompatibilityEvidence).toHaveBeenCalledWith({
      ownerUserId: "owner-route-contract",
      productSessionId: "capture-session-a5",
      taskId: "A5"
    });
    expect(mocks.recordCompatibilitySmoke).toHaveBeenCalledWith({
      ownerUserId: "owner-route-contract",
      runId: "123e4567-e89b-12d3-a456-426614174000",
      taskId: "A5",
      outcome: "passed",
      reason: "真实【帮我记】链路已完成忠实承接。",
      evidence: {
        productSessionFingerprint: "a".repeat(64),
        recordMode: "capture",
        completedUserTurnCount: 1,
        questionFormTurnCount: 0,
        visibleQuestionCount: 0,
        providerCallCount: 0
      },
      clientOperationId: "compatibility-result"
    });
  });

  it("通过结论缺少真实产品会话时在写入前拒绝", async () => {
    const request = new Request(
      "http://localhost/api/preview/gi088/compatibility-smoke",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runId: "123e4567-e89b-12d3-a456-426614174000",
          taskId: "A5",
          outcome: "passed",
          reason: "缺少真实会话证据。",
          clientOperationId: "compatibility-result-missing-evidence"
        })
      }
    );

    await expect(POST(request)).rejects.toMatchObject({
      code: "GI088_COMPATIBILITY_SMOKE_INPUT_INVALID",
      status: 400
    });
    expect(mocks.verifyCompatibilityEvidence).not.toHaveBeenCalled();
    expect(mocks.recordCompatibilitySmoke).not.toHaveBeenCalled();
  });

  it("服务端无法核验真实会话时返回可操作错误", async () => {
    mocks.verifyCompatibilityEvidence.mockRejectedValue(new Error("missing"));
    const request = new Request(
      "http://localhost/api/preview/gi088/compatibility-smoke",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runId: "123e4567-e89b-12d3-a456-426614174000",
          taskId: "A5",
          outcome: "passed",
          reason: "尝试登记通过。",
          productSessionId: "capture-session-missing",
          clientOperationId: "compatibility-result-invalid-evidence"
        })
      }
    );

    await expect(POST(request)).rejects.toMatchObject({
      code: "GI088_COMPATIBILITY_SMOKE_EVIDENCE_INVALID",
      status: 409
    });
    expect(mocks.recordCompatibilitySmoke).not.toHaveBeenCalled();
  });
});
