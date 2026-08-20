import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submitTurn: vi.fn()
}));

vi.mock("@/server/services/evaluation/gi088/http", () => ({
  withGi088EvaluationStream: async (
    _request: Request,
    handler: (input: {
      ownerUserId: string;
      service: { submitTurn: typeof mocks.submitTurn };
      emit: () => void;
    }) => Promise<unknown>
  ) => handler({
    ownerUserId: "owner-route-contract",
    service: { submitTurn: mocks.submitTurn },
    emit: vi.fn()
  })
}));

import { POST } from "@/app/api/preview/gi088/turn/route";

beforeEach(() => {
  mocks.submitTurn.mockReset();
});

describe("GI-088 v8r2 turn route contract", () => {
  it("拒绝 clientTurnId 与 clientOperationId 不一致的提交", async () => {
    const request = new Request("http://localhost/api/preview/gi088/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runId: "123e4567-e89b-12d3-a456-426614174000",
        taskId: "A1",
        branch: "high",
        content: "这是一段有效长度的真实内容。",
        clientTurnId: "turn-id",
        clientOperationId: "different-operation-id",
        baseAssistantMessageId: "A1"
      })
    });

    await expect(POST(request)).rejects.toMatchObject({
      code: "GI088_TURN_INPUT_INVALID",
      status: 400
    });
    expect(mocks.submitTurn).not.toHaveBeenCalled();
  });

  it("同值标识通过 schema 并原样进入 foundation service", async () => {
    mocks.submitTurn.mockResolvedValue({ ok: true });
    const request = new Request("http://localhost/api/preview/gi088/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runId: "123e4567-e89b-12d3-a456-426614174000",
        taskId: "A1",
        branch: "high",
        content: "这是一段有效长度的真实内容。",
        clientTurnId: "same-id",
        clientOperationId: "same-id",
        baseAssistantMessageId: "A1"
      })
    });

    await expect(POST(request)).resolves.toEqual({ ok: true });
    expect(mocks.submitTurn).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: "owner-route-contract",
      clientTurnId: "same-id",
      clientOperationId: "same-id"
    }));
  });
});
