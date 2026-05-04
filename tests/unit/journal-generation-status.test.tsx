import React from "react";
import { render, screen } from "@testing-library/react";

import { JournalGenerationStatus } from "@/components/interview/journal-generation-status";

describe("JournalGenerationStatus", () => {
  it("renders the full generation stage with the shared growth scene", () => {
    render(<JournalGenerationStatus label="正在生成日志骨架" description="先把结构立起来。" progress={36} data-testid="generation-status" />);

    expect(screen.getByTestId("generation-status")).toBeInTheDocument();
    expect(screen.getByText("日志正在整理")).toBeInTheDocument();
    expect(screen.getByText("正在生成日志骨架")).toBeInTheDocument();
    expect(screen.getByText("先把结构立起来。")).toBeInTheDocument();
    expect(screen.getAllByText("36%").length).toBeGreaterThan(0);
    expect(screen.getByTestId("journal-growth-tree")).toBeInTheDocument();
  });

  it("renders the compact variant without losing the phase copy", () => {
    render(<JournalGenerationStatus label="最终润色中" description="正在收束读感。" progress={92} variant="compact" />);

    expect(screen.getByText("最终润色中")).toBeInTheDocument();
    expect(screen.getByText("正在收束读感。")).toBeInTheDocument();
    expect(screen.getAllByText("92%").length).toBeGreaterThan(0);
    expect(screen.getByTestId("journal-growth-tree")).toBeInTheDocument();
  });
});
