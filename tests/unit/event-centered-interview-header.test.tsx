import { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  EventCenteredInterviewChromeProvider,
  useEventCenteredInterviewChrome
} from "@/components/interview/event-centered/event-centered-interview-chrome-context";
import { EventCenteredInterviewHeader } from "@/components/shared/site-header/event-centered-interview-header";

function SeedState({
  mode,
  canComplete = false,
  onComplete = null
}: {
  mode: "capture" | "chat";
  canComplete?: boolean;
  onComplete?: (() => void) | null;
}) {
  const { setState } = useEventCenteredInterviewChrome();
  useEffect(() => {
    setState({
      recordMode: mode,
      entryDate: "2026-07-22",
      hasUserMessage: mode === "capture",
      canComplete,
      busy: false,
      onComplete,
      progress: [
        { id: "record", label: "轻量记录", status: "complete", percent: 100, detail: "已放好这件事" },
        { id: "reflect", label: "引导复盘", status: "current", percent: 42, detail: "正在找到关键变化" },
        { id: "deepen", label: "深入探索", status: "upcoming", percent: 0, detail: "按需要继续" }
      ]
    });
  }, [canComplete, mode, onComplete, setState]);
  return <EventCenteredInterviewHeader />;
}

describe("事件中心顶部导航上下文", () => {
  it("把三阶段进度放入导航上下文，并持续显示阶段与百分比", async () => {
    render(
      <EventCenteredInterviewChromeProvider>
        <SeedState mode="chat" />
      </EventCenteredInterviewChromeProvider>
    );

    expect(await screen.findByTestId("event-centered-header-progress")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("第 2 / 3 阶段")
    );
    expect(screen.getByText(/约 42%/u)).toBeInTheDocument();
    expect(screen.getAllByText(/引导复盘/u).length).toBeGreaterThanOrEqual(1);
  });

  it("帮我记在顶部显示原话保存状态", async () => {
    render(
      <EventCenteredInterviewChromeProvider>
        <SeedState mode="capture" />
      </EventCenteredInterviewChromeProvider>
    );

    expect(await screen.findByTestId("event-centered-record-save-context")).toHaveTextContent("原话已保存");
  });

  it("记录可完成时在顶部提供完成入口", async () => {
    const onComplete = vi.fn();
    render(
      <EventCenteredInterviewChromeProvider>
        <SeedState mode="chat" canComplete onComplete={onComplete} />
      </EventCenteredInterviewChromeProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: "完成记录" }));
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
