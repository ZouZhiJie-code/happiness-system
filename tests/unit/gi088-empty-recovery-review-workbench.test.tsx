import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  Gi088EmptyRecoveryDecisionV1,
  Gi088EmptyRecoveryReceiptV1,
  Gi088EmptyRecoveryReviewBundleV1
} from "@/app/admin/journal-evaluation/empty-recovery-review-loader";
import { EmptyRecoveryReviewWorkbench } from "@/components/journal-evaluation/empty-recovery-review-workbench";

function bundle(
  decisions: Gi088EmptyRecoveryDecisionV1[] = [],
  receipt: Gi088EmptyRecoveryReceiptV1 | null = null
): Gi088EmptyRecoveryReviewBundleV1 {
  return {
    schemaVersion: "1.0",
    toolVersion: "2026-08-12.gi088-empty-recovery-review-v1",
    stage: "empty-recovery",
    sourceDiagnosticSha256: "1".repeat(64),
    toolSourceSha256: "2".repeat(64),
    bundleSha256: "3".repeat(64),
    cards: Array.from({ length: 10 }, (_, index) => ({
      publicId: `public-${index + 1}`,
      label: `恢复样本 ${String(index + 1).padStart(2, "0")}`,
      workingTask: `共同任务 ${index + 1}`,
      messages: [
        { role: "user" as const, content: `用户起点 ${index + 1}` },
        { role: "assistant" as const, content: "AI 已经承接了当前任务。" },
        { role: "user" as const, content: `用户新增信息 ${index + 1}` }
      ],
      candidate: {
        understanding: `候选理解 ${index + 1}`,
        response: `候选回应 ${index + 1}`
      },
      contentSha256: String(index + 4).padStart(64, "0")
    })),
    decisions,
    receipt
  };
}

function jsonResponse(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  }));
}

describe("GI-088 EMPTY 恢复裁决工作台", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    window.history.replaceState({}, "", "/admin/journal-evaluation/golden-eight?stage=empty-recovery&token=token-123");
    window.sessionStorage.clear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("展示隔离阶段和盲评队列，并用带令牌的独立接口保存", async () => {
    let decisions: Gi088EmptyRecoveryDecisionV1[] = [];
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/session")) return jsonResponse(bundle(decisions));
      if (url.includes("/draft")) {
        const body = JSON.parse(String(init?.body)) as Omit<Gi088EmptyRecoveryDecisionV1, "reviewer" | "updatedAt">;
        decisions = [{
          ...body,
          reviewer: "product_owner",
          updatedAt: "2026-08-12T12:00:00.000Z"
        }];
        return jsonResponse(bundle(decisions));
      }
      return jsonResponse({ error: "unexpected" }, 500);
    });

    render(<EmptyRecoveryReviewWorkbench />);
    expect(await screen.findByText("材料已加载，内容保持盲评。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Golden 8 · 已封存" })).toHaveAttribute(
      "href",
      expect.stringContaining("stage=golden-eight")
    );
    expect(screen.getByText("共同任务：共同任务 1")).toBeInTheDocument();
    expect(screen.queryByText(/Ark|hidden|恢复次数/u)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /1\. 可直接用/u }));
    fireEvent.click(screen.getByRole("button", { name: "保存并进入下一条" }));

    await waitFor(() => expect(screen.getByText("已完成 1 / 10")).toBeInTheDocument());
    const draftCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/draft"));
    expect(String(draftCall?.[0])).toContain("token=token-123");
    expect(JSON.parse(String(draftCall?.[1]?.body))).toMatchObject({
      publicId: "public-1",
      verdict: "ready_to_use",
      failureCategory: null,
      reason: "",
      singleCaseBlocker: false
    });
  });

  it("把未提交输入保留在浏览器恢复副本，并强制问题理由完整", async () => {
    fetchMock.mockImplementation(() => jsonResponse(bundle()));
    const firstRender = render(<EmptyRecoveryReviewWorkbench />);
    await screen.findByText("材料已加载，内容保持盲评。");

    fireEvent.click(screen.getByRole("button", { name: /2\. 轻微问题/u }));
    fireEvent.change(screen.getByLabelText("主要原因"), {
      target: { value: "low_information_gain" }
    });
    fireEvent.change(screen.getByLabelText("判断理由（8–300 字）"), {
      target: { value: "信息增量稍低，表达还可以更聚焦。" }
    });
    expect(screen.getByRole("button", { name: "保存并进入下一条" })).toBeEnabled();
    expect(window.sessionStorage.length).toBe(1);

    firstRender.unmount();
    render(<EmptyRecoveryReviewWorkbench />);
    await screen.findByText("材料已加载，内容保持盲评。");
    expect(await screen.findByLabelText("主要原因")).toHaveValue("low_information_gain");
    expect(screen.getByLabelText("判断理由（8–300 字）")).toHaveValue(
      "信息增量稍低，表达还可以更聚焦。"
    );
  });
});
