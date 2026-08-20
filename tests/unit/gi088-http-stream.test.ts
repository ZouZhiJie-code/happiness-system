import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireRequest, createStore } = vi.hoisted(() => ({
  requireRequest: vi.fn(async () => ({ id: "owner-stream-cancel" })),
  createStore: vi.fn(() => ({}))
}));

vi.mock("@/server/services/evaluation/gi088/access", () => ({
  requireGi088EvaluationRequest: requireRequest,
  requireGi088ModelCallAuthorization: vi.fn(),
  Gi088AccessError: class Gi088AccessError extends Error {}
}));

vi.mock("@/server/services/evaluation/gi088/foundation-prisma-store", () => ({
  createGi088PrismaFoundationStore: createStore
}));

import { withGi088EvaluationStream } from "@/server/services/evaluation/gi088/http";

describe("GI-088 v8r2 evaluation NDJSON stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("客户端 cancel 后 emit 静默结束，已接受的服务动作继续完成", async () => {
    let emit!: (event: unknown) => void;
    let releaseAction!: () => void;
    let markActionFinished!: () => void;
    const actionRelease = new Promise<void>((resolve) => {
      releaseAction = resolve;
    });
    const actionFinished = new Promise<void>((resolve) => {
      markActionFinished = resolve;
    });
    const action = vi.fn(async (context: {
      ownerUserId: string;
      emit: (event: unknown) => void;
    }) => {
      expect(context.ownerUserId).toBe("owner-stream-cancel");
      emit = context.emit;
      emit({ type: "turn_reserved", turnId: "turn-1" });
      await actionRelease;
      markActionFinished();
      return { committed: true };
    });

    const response = await withGi088EvaluationStream(
      new Request("https://preview.example.test/api/evaluations/gi088/turn"),
      action
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toBe(
      '{"type":"turn_reserved","turnId":"turn-1"}\n'
    );

    await reader.cancel("client disconnected");
    expect(() => emit({ type: "heartbeat", elapsedMs: 10_000 })).not.toThrow();
    expect(() => emit({ type: "provider_completed" })).not.toThrow();
    releaseAction();
    await actionFinished;
    await Promise.resolve();

    expect(action).toHaveBeenCalledTimes(1);
    expect(requireRequest).toHaveBeenCalledTimes(1);
    expect(createStore).toHaveBeenCalledTimes(1);
  });
});
