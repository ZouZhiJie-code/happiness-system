import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  Gi088RuntimeContractReviewBundleV1,
  Gi088RuntimeContractReviewDecisionV1
} from "@/app/admin/journal-evaluation/runtime-contract-final-eight-loader";
import { RuntimeContractFinalEightWorkbench } from "@/components/journal-evaluation/runtime-contract-final-eight-workbench";

function bundle(
  decisions: Gi088RuntimeContractReviewDecisionV1[] = []
): Gi088RuntimeContractReviewBundleV1 {
  return {
    schemaVersion: "1.0",
    toolVersion: "2026-08-12.gi088-runtime-contract-final-eight-review-v1",
    stage: "runtime-contract-final-eight",
    presentationMode: "paired",
    sourceReportSha256: "1".repeat(64),
    toolSourceSha256: "2".repeat(64),
    bundleSha256: "3".repeat(64),
    cards: Array.from({ length: 8 }, (_, index) => ({
      publicId: `public-${index + 1}`,
      label: `最终复核 ${String(index + 1).padStart(2, "0")}`,
      workingTask: `共同任务 ${index + 1}`,
      messages: [
        { role: "user" as const, content: `用户起点 ${index + 1}` },
        { role: "assistant" as const, content: "AI 承接当前任务。" },
        { role: "user" as const, content: `用户新增信息 ${index + 1}` }
      ],
      left: {
        side: "left" as const,
        available: true,
        understanding: `回应 A 理解 ${index + 1}`,
        response: `回应 A 内容 ${index + 1}`,
        contentSha256: "4".repeat(64)
      },
      right: {
        side: "right" as const,
        available: true,
        understanding: `回应 B 理解 ${index + 1}`,
        response: `回应 B 内容 ${index + 1}`,
        contentSha256: "5".repeat(64)
      },
      contentSha256: "6".repeat(64)
    })),
    decisions,
    receipt: null
  };
}

function response(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  }));
}

describe("GI-088 根因对照最终 8 条工作台", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    window.history.replaceState(
      {},
      "",
      "/admin/journal-evaluation/adaptive-recovery/runtime-contract-final-eight?stage=runtime-contract-final-eight&token=token-123"
    );
    window.sessionStorage.clear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("隐藏两组身份，完整展示对话，并用独立接口保存左右评价和偏好", async () => {
    let decisions: Gi088RuntimeContractReviewDecisionV1[] = [];
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/session")) return response(bundle(decisions));
      if (url.includes("/draft")) {
        const body = JSON.parse(String(init?.body)) as Omit<
          Gi088RuntimeContractReviewDecisionV1,
          "reviewer" | "updatedAt"
        >;
        decisions = [{
          ...body,
          reviewer: "product_owner",
          updatedAt: "2026-08-12T12:00:00.000Z"
        }];
        return response(bundle(decisions));
      }
      return response({ error: "unexpected" }, 500);
    });

    render(<RuntimeContractFinalEightWorkbench />);
    expect(await screen.findByText("两组技术方案已入围；左右身份将在封存后揭示。"))
      .toBeInTheDocument();
    expect(screen.getByText("共同任务：共同任务 1")).toBeInTheDocument();
    expect(screen.getByText("回应 A 内容 1")).toBeInTheDocument();
    expect(screen.getByText("回应 B 内容 1")).toBeInTheDocument();
    expect(screen.queryByText(/Ark Flash|DeepSeek 官方|volcengine_ark|组 A ·|组 B ·/u))
      .not.toBeInTheDocument();

    await screen.findByRole("group", { name: "回应 B质量结论" });
    fireEvent.click(within(
      screen.getByRole("group", { name: "回应 A质量结论" })
    ).getByRole("button", { name: /可直接用/u }));
    fireEvent.click(within(
      screen.getByRole("group", { name: "回应 B质量结论" })
    ).getByRole("button", { name: /可直接用/u }));
    fireEvent.click(screen.getByRole("button", { name: "回应 A" }));
    fireEvent.click(screen.getByRole("button", { name: "保存并进入下一条" }));

    await waitFor(() => expect(screen.getByText("已完成 1 / 8")).toBeInTheDocument());
    const call = fetchMock.mock.calls.find(([url]) => String(url).includes("/draft"));
    expect(String(call?.[0])).toContain("token=token-123");
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      publicId: "public-1",
      left: { verdict: "ready_to_use" },
      right: { verdict: "ready_to_use" },
      preferredSide: "left"
    });
  });

  it("问题结论必须补齐原因，并把未保存内容留在浏览器恢复副本", async () => {
    fetchMock.mockImplementation(() => response(bundle()));
    const view = render(<RuntimeContractFinalEightWorkbench />);
    await screen.findByText("两组技术方案已入围；左右身份将在封存后揭示。");
    const minorButtons = screen.getAllByRole("button", { name: /轻微问题/u });
    fireEvent.click(minorButtons[0]!);
    const categories = screen.getAllByLabelText("主要原因");
    const reasons = screen.getAllByLabelText("判断理由（8–300 字）");
    fireEvent.change(categories[0]!, { target: { value: "low_information_gain" } });
    fireEvent.change(reasons[0]!, {
      target: { value: "这份回应的信息增量稍低，仍需更聚焦。" }
    });
    expect(window.sessionStorage.length).toBe(1);
    view.unmount();
    render(<RuntimeContractFinalEightWorkbench />);
    await screen.findByText("两组技术方案已入围；左右身份将在封存后揭示。");
    const restoredCategories = await screen.findAllByLabelText(
      "主要原因",
      {},
      { timeout: 5_000 }
    );
    expect(restoredCategories[0]).toHaveValue(
      "low_information_gain"
    );
    expect(screen.getAllByLabelText("判断理由（8–300 字）")[0]).toHaveValue(
      "这份回应的信息增量稍低，仍需更聚焦。"
    );
  });
});
