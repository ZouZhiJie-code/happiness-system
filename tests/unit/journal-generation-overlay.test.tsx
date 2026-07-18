import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { JournalGenerationOverlay } from "@/components/interview/journal-generation-overlay";

describe("JournalGenerationOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders skeleton lines and the current stage during active generation", () => {
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
    expect(screen.getAllByText("补充细节").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("当前阶段：补充细节")).toBeInTheDocument();
    expect(screen.getByTestId("journal-skeleton-lines")).toBeInTheDocument();
  });

  it("moves directly into reveal when generation completes", () => {
    const { rerender } = render(
      <JournalGenerationOverlay
        active
        label="今天重新看明白的那段经历，整理成可以回看的一页"
        description="再把新理解和以后怎么判断理清楚"
        progress={72}
        mode="dimension"
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
      />
    );

    expect(screen.getByTestId("journal-generation-overlay")).toHaveAttribute("data-state", "reveal");
    expect(screen.queryByText("今天重新看明白的那段经历，整理成可以回看的一页")).not.toBeInTheDocument();
  });

  it("unmounts after the completion materialization finishes", () => {
    const onExited = vi.fn();
    const { rerender } = render(
      <JournalGenerationOverlay
        active
        label="悦、实、思、改、谢，汇成今天这一页幸福日志"
        progress={100}
        mode="daily"
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
        onExited={onExited}
      />
    );

    expect(screen.getByTestId("journal-generation-overlay")).toHaveAttribute("data-state", "reveal");

    fireEvent.animationEnd(screen.getByTestId("journal-generation-overlay"));
    expect(onExited).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("journal-generation-overlay")).not.toBeInTheDocument();
  });
});
