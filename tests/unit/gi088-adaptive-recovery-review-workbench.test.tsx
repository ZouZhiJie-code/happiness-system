import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  Gi088AdaptiveRecoveryReviewBundleV1
} from "@/app/admin/journal-evaluation/adaptive-recovery-review-loader";
import {
  AdaptiveRecoveryReviewWorkbench
} from "@/components/journal-evaluation/adaptive-recovery-review-workbench";

function bundle(): Gi088AdaptiveRecoveryReviewBundleV1 {
  return {
    schemaVersion: "1.0",
    toolVersion: "2026-08-12.gi088-adaptive-recovery-review-v1",
    stage: "adaptive-recovery",
    sourcePacketSha256: "a".repeat(64),
    toolSourceSha256: "b".repeat(64),
    bundleSha256: "c".repeat(64),
    cards: [{
      publicId: "review-1",
      label: "恢复样本 01",
      workingTask: "理解休息后仍然疲惫的原因",
      messages: [
        { role: "assistant", content: "你想先看看这种疲惫从哪里来。" },
        { role: "user", content: "我今天休息了，还是觉得很累。" }
      ],
      candidate: {
        understanding: "休息时间增加后，疲惫感仍然存在。",
        response: "这份累更像身体没恢复，还是脑子一直没有真正停下来？"
      },
      contentSha256: "d".repeat(64)
    }],
    decisions: [],
    receipt: null
  };
}

describe("GI-088 v8r3r3 恢复赢家盲评工作台", () => {
  afterEach(() => vi.restoreAllMocks());

  it("只展示用户可见材料，并保存一键可直接用裁决", async () => {
    const current = bundle();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init) => {
        if (init?.method === "POST") {
          return new Response(JSON.stringify({
            ...current,
            decisions: [{
              publicId: "review-1",
              verdict: "ready_to_use",
              failureCategory: null,
              reason: "",
              singleCaseBlocker: false,
              reviewer: "product_owner",
              updatedAt: "2026-08-12T18:00:00.000Z"
            }]
          }), { status: 200 });
        }
        return new Response(JSON.stringify(current), { status: 200 });
      }
    );
    render(<AdaptiveRecoveryReviewWorkbench accessToken="one-time" />);

    expect(await screen.findByText("理解休息后仍然疲惫的原因", { exact: false }))
      .toBeInTheDocument();
    expect(screen.getByText("我今天休息了，还是觉得很累。"))
      .toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /fast_formatter|high_correction|hidden_admission|volcengine_ark/u
    );

    fireEvent.click(screen.getByRole("button", { name: /1\. 可直接用/u }));
    fireEvent.click(screen.getByRole("button", { name: "保存并进入下一条" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "POST" });
  });
});
