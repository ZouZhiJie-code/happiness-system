import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reviewQuestion: vi.fn()
}));

vi.mock("@/server/services/evaluation/gi088/http", () => ({
  withGi088Evaluation: async (
    _request: Request,
    handler: (input: {
      ownerUserId: string;
      service: { reviewQuestion: typeof mocks.reviewQuestion };
    }) => Promise<unknown>
  ) => handler({
    ownerUserId: "owner-question-review-route",
    service: { reviewQuestion: mocks.reviewQuestion }
  })
}));

import { POST } from "@/app/api/preview/gi088/question-review/route";

const basePayload = {
  runId: "123e4567-e89b-12d3-a456-426614174000",
  taskId: "A1",
  branch: "high",
  turnId: "223e4567-e89b-12d3-a456-426614174000",
  questionPresence: "present",
  classification: "same_focus_low_burden",
  valueClassification: "advances_working_task",
  note: "这个问题继续推进当前共同任务。",
  observationFingerprint: "a".repeat(64),
  clientOperationId: "question-review-route"
} as const;

function requestFor(payload: Record<string, unknown>) {
  return new Request("http://localhost/api/preview/gi088/question-review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

beforeEach(() => {
  mocks.reviewQuestion.mockReset();
});

describe("GI-088 question review route contract", () => {
  it.each(["classification", "valueClassification"] as const)(
    "可见问题缺少 %s 时在 route 边界拒绝",
    async (field) => {
      const payload: Record<string, unknown> = { ...basePayload };
      delete payload[field];

      await expect(POST(requestFor(payload))).rejects.toMatchObject({
        code: "GI088_QUESTION_REVIEW_INPUT_INVALID",
        status: 400
      });
      expect(mocks.reviewQuestion).not.toHaveBeenCalled();
    }
  );

  it("完整焦点与问题价值分类原样进入 Foundation", async () => {
    mocks.reviewQuestion.mockResolvedValue({ ok: true });

    await expect(POST(requestFor({ ...basePayload }))).resolves.toEqual({
      ok: true
    });
    expect(mocks.reviewQuestion).toHaveBeenCalledWith({
      ownerUserId: "owner-question-review-route",
      ...basePayload
    });
  });
});
