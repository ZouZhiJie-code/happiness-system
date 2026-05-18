import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { JournalGenerationOverlay } from "@/components/interview/journal-generation-overlay";

describe("JournalGenerationOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders lottie animation and progress during active generation", () => {
    render(
      <JournalGenerationOverlay
        active
        label="正在生成日志骨架"
        description="先把结构立起来。"
        progress={42}
        mode="dimension"
      />
    );

    const overlay = screen.getByTestId("journal-generation-overlay");

    expect(overlay).toHaveAttribute("data-mode", "dimension");
    expect(overlay).toHaveAttribute("data-state", "active");
    expect(overlay).toHaveAttribute("data-animation-id", "plant_story");
    expect(screen.getByText("正在生成日志骨架")).toBeInTheDocument();
    expect(screen.getByText("先把结构立起来。")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByTestId("journal-generation-lottie")).toBeInTheDocument();
  });

  it("keeps mark visible in hold state and hides active copy", () => {
    const { rerender } = render(
      <JournalGenerationOverlay
        active
        label="正在打磨日志细节"
        description="正在把真正打动你的点压实。"
        progress={72}
        mode="dimension"
        minVisibleMs={900}
      />
    );

    rerender(
      <JournalGenerationOverlay
        active={false}
        complete
        label="正在打磨日志细节"
        description="正在把真正打动你的点压实。"
        progress={100}
        mode="dimension"
        minVisibleMs={900}
      />
    );

    expect(screen.getByTestId("journal-generation-overlay")).toHaveAttribute("data-state", "hold");
    expect(screen.getByTestId("journal-generation-lottie")).toBeInTheDocument();
    expect(screen.queryByText("正在打磨日志细节")).not.toBeInTheDocument();
  });

  it("moves from hold to reveal and unmounts on completion", () => {
    const onExited = vi.fn();
    const { rerender } = render(
      <JournalGenerationOverlay active label="最终润色中" progress={100} mode="daily" minVisibleMs={900} onExited={onExited} />
    );

    rerender(
      <JournalGenerationOverlay
        active={false}
        complete
        label="最终润色中"
        progress={100}
        mode="daily"
        minVisibleMs={900}
        onExited={onExited}
      />
    );

    act(() => {
      vi.advanceTimersByTime(950);
    });
    expect(screen.getByTestId("journal-generation-overlay")).toHaveAttribute("data-state", "reveal");

    fireEvent.animationEnd(screen.getByTestId("journal-generation-overlay"));
    expect(onExited).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("journal-generation-overlay")).not.toBeInTheDocument();
  });
});
