import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  Gi088ProContractDevelopmentBundleV1,
  Gi088ProContractHiddenBundleV1
} from "@/app/admin/journal-evaluation/pro-contract-review-loader";
import { ProContractReviewWorkbench } from "@/components/journal-evaluation/pro-contract-review-workbench";
import {
  GI088_PRO_CONTRACT_DEVELOPMENT_STAGE,
  GI088_PRO_CONTRACT_HIDDEN_STAGE
} from "@/features/journal-evaluation/pro-contract-review-shared";

const HASH = "a".repeat(64);

function developmentBundle(): Gi088ProContractDevelopmentBundleV1 {
  return {
    schemaVersion: "1.0",
    toolVersion: "2026-08-12.gi088-pro-contract-review-workbench-v1",
    stage: GI088_PRO_CONTRACT_DEVELOPMENT_STAGE,
    sourceFileSha256: HASH,
    sourceFingerprint: HASH,
    toolSourceSha256: HASH,
    bundleSha256: HASH,
    cards: [{
      publicId: "development-card-01",
      label: "开发配对 01",
      attempt: 2,
      workingTask: "继续理清今天休息后仍然疲惫的原因",
      messages: [{ role: "user", content: "共用的起始表达" }],
      conversationDiffers: true,
      left: {
        available: true,
        messages: [
          { role: "user", content: "我今天休息了，还是很累。" },
          { role: "assistant", content: "A 侧上一轮真实回应" },
          { role: "user", content: "A 侧第二轮用户回答" }
        ],
        understanding: "我听见这份累并未被休息消解。",
        response: "A 侧这次最需要分清的是身体疲惫还是心里仍在用力吗？",
        contentHash: "b".repeat(64)
      },
      right: {
        available: true,
        messages: [
          { role: "user", content: "我今天休息了，还是很累。" },
          { role: "assistant", content: "B 侧上一轮真实回应" },
          { role: "user", content: "B 侧第二轮用户回答" }
        ],
        understanding: "休息发生了，消耗感还留在你身上。",
        response: "B 侧如果回看今天，哪一刻最像身体停下了但脑子还没停？",
        contentHash: "c".repeat(64)
      },
      contentHash: "d".repeat(64)
    }],
    decisions: [],
    receipt: null
  };
}

function hiddenBundle(): Gi088ProContractHiddenBundleV1 {
  return {
    schemaVersion: "1.0",
    toolVersion: "2026-08-12.gi088-pro-contract-review-workbench-v1",
    stage: GI088_PRO_CONTRACT_HIDDEN_STAGE,
    sourceFileSha256: HASH,
    sourceFingerprint: HASH,
    toolSourceSha256: HASH,
    bundleSha256: HASH,
    cards: [{
      publicId: "hidden-card-01",
      label: "隐藏准入 01",
      attempt: 1,
      workingTask: "继续完成当前访谈任务",
      messages: [{ role: "user", content: "我想继续聊。" }],
      conversationDiffers: false,
      left: {
        available: true,
        messages: [{ role: "user", content: "我想继续聊。" }],
        understanding: "我会继续跟着你现在最在意的部分。",
        response: "此刻最值得继续展开的是哪一点？",
        contentHash: "e".repeat(64)
      },
      right: null,
      contentHash: "f".repeat(64)
    }],
    decisions: [],
    receipt: null
  };
}

function response(value: unknown) {
  return Promise.resolve({
    ok: true,
    json: async () => value
  } as Response);
}

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("GI-088 Pro 合同盲评工作台", () => {
  it("开发轨迹按侧展示真实继承对话并保存双侧裁决", async () => {
    const bundle = developmentBundle();
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => response(bundle))
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        return response({ ...bundle, decisions: [{
          publicId: body.publicId,
          left: body.left,
          right: body.right,
          preferredSide: body.preferredSide,
          reviewer: "product_owner",
          updatedAt: "2026-08-12T12:00:00.000Z"
        }] });
      });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ProContractReviewWorkbench
        stage={GI088_PRO_CONTRACT_DEVELOPMENT_STAGE}
        accessToken="one-time-token"
      />
    );
    expect(await screen.findByText("A 侧上一轮真实回应")).toBeInTheDocument();
    expect(screen.getByText("B 侧上一轮真实回应")).toBeInTheDocument();
    expect(screen.getByText(/分别继承了各自上一轮/)).toBeInTheDocument();
    await waitFor(() => expect(
      screen.getAllByRole("button", { name: /可直接用/ })
    ).toHaveLength(2));
    const readyButtons = screen.getAllByRole("button", { name: /可直接用/ });
    fireEvent.click(readyButtons[0]!);
    fireEvent.click(readyButtons[1]!);
    fireEvent.click(screen.getByRole("button", { name: "回应 B" }));
    fireEvent.click(screen.getByRole("button", { name: "保存并进入下一条" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, request] = fetchMock.mock.calls[1]!;
    expect(request.method).toBe("POST");
    expect(JSON.parse(String(request.body))).toMatchObject({
      publicId: "development-card-01",
      left: { verdict: "ready_to_use" },
      right: { verdict: "ready_to_use" },
      preferredSide: "right"
    });
  });

  it("隐藏阶段只提供单侧绝对裁决且阶段接口保持独立", async () => {
    const fetchMock = vi.fn().mockImplementation(() => response(hiddenBundle()));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ProContractReviewWorkbench
        stage={GI088_PRO_CONTRACT_HIDDEN_STAGE}
        accessToken="one-time-token"
      />
    );
    expect(await screen.findByRole("heading", { name: "隐藏集准入裁决" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /可直接用/ })).toHaveLength(1);
    expect(screen.queryByText("哪一侧更好")).not.toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0]![0])).toContain(
      "/pro-contract-hidden-admission/session?token=one-time-token"
    );
  });
});
