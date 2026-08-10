import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { Board8Gi059LiveReviewShell } from "@/components/interview/event-centered/board8-gi059-live-review-shell";

vi.mock("@/components/interview/event-centered/event-centered-interview-workspace", () => ({
  EventCenteredInterviewWorkspace: ({ initialSessionId, layout }: { initialSessionId?: string | null; layout?: string }) => (
    <div data-testid="mock-live-workspace" data-layout={layout}>{initialSessionId ?? "new-session"}</div>
  )
}));

describe("Board8Gi059LiveReviewShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("显示真实实聊与风控角色卡，并把脱敏裁决保存在浏览器", async () => {
    render(<Board8Gi059LiveReviewShell entryDate="2026-08-03" />);

    expect(screen.getByTestId("board8-live-workspace-panel")).toHaveClass("flex", "flex-col");
    expect(screen.getByTestId("mock-live-workspace")).toHaveAttribute("data-layout", "embedded");
    expect(screen.getByText("选择一件真实发生的事件，自然表达。让 AI 根据你的回答推进，不配合预写脚本。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /感受 2｜风控深聊/u }));
    expect(screen.getByText("今天项目会上，我主动说明了进度可能延后。说完后我心里有点发紧。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "条件通过" }));
    fireEvent.change(screen.getByPlaceholderText(/记录表达、追问/u), {
      target: { value: "思路自然度仍需观察" }
    });

    await waitFor(() => {
      const stored = Array.from({ length: window.localStorage.length })
        .map((_, index) => window.localStorage.getItem(window.localStorage.key(index)!))
        .join("\n");
      expect(stored).toContain('"verdict":"conditional_pass"');
      expect(stored).toContain("思路自然度仍需观察");
      expect(stored).not.toContain("今天项目会上，我主动说明了进度可能延后");
    });
  });
});
