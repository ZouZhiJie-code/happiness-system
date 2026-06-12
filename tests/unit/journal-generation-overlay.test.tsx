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

  it("renders skeleton lines and progress during active generation", () => {
    render(
      <JournalGenerationOverlay
        active
        label="今天真正动到你的那段开心，值得被写成一页"
        description="先把让你有感觉的那个片段立住"
        progress={42}
        mode="dimension"
      />
    );

    const overlay = screen.getByTestId("journal-generation-overlay");

    expect(overlay).toHaveAttribute("data-mode", "dimension");
    expect(overlay).toHaveAttribute("data-state", "active");
    expect(screen.getByText("今天真正动到你的那段开心，值得被写成一页")).toBeInTheDocument();
    expect(screen.getByText("先把让你有感觉的那个片段立住")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByTestId("journal-skeleton-lines")).toBeInTheDocument();
  });

  it("keeps skeleton visible in hold state and hides active copy", () => {
    const { rerender } = render(
      <JournalGenerationOverlay
        active
        label="今天重新看明白的那段经历，整理成可以回看的一页"
        description="再把新理解和以后怎么判断理清楚"
        progress={72}
        mode="dimension"
        minVisibleMs={900}
      />
    );

    rerender(
      <JournalGenerationOverlay
        active={false}
        complete
        label="今天重新看明白的那段经历，整理成可以回看的一页"
        description="再把新理解和以后怎么判断理清楚"
        progress={100}
        mode="dimension"
        minVisibleMs={900}
      />
    );

    expect(screen.getByTestId("journal-generation-overlay")).toHaveAttribute("data-state", "hold");
    expect(screen.getByTestId("journal-skeleton-lines")).toBeInTheDocument();
    expect(screen.queryByText("今天重新看明白的那段经历，整理成可以回看的一页")).not.toBeInTheDocument();
  });

  it("moves from hold to reveal and unmounts on completion", () => {
    const onExited = vi.fn();
    const { rerender } = render(
      <JournalGenerationOverlay
        active
        label="悦、实、思、改、谢，汇成今天这一页幸福日志"
        progress={100}
        mode="daily"
        minVisibleMs={900}
        onExited={onExited}
      />
    );

    rerender(
      <JournalGenerationOverlay
        active={false}
        complete
        label="悦、实、思、改、谢，汇成今天这一页幸福日志"
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
