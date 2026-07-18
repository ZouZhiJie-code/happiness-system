import React from "react";
import { render, screen } from "@testing-library/react";

import { JournalGenerationStatus } from "@/components/interview/journal-generation-status";

describe("JournalGenerationStatus", () => {
  it("renders the full generation stage with skeleton lines", () => {
    render(
      <JournalGenerationStatus
        label="今天真正动到你的那段开心，值得被写成一页"
        description="先把让你有感觉的那个片段立住"
        progress={36}
        data-testid="generation-status"
      />
    );

    expect(screen.getByTestId("generation-status")).toBeInTheDocument();
    expect(screen.getByText("日志正在整理")).toBeInTheDocument();
    expect(screen.getByText("今天真正动到你的那段开心，值得被写成一页")).toBeInTheDocument();
    expect(screen.getByText("先把让你有感觉的那个片段立住")).toBeInTheDocument();
    expect(screen.getAllByText("补充细节").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("当前阶段：补充细节")).toBeInTheDocument();
    expect(screen.getByTestId("journal-skeleton-lines")).toBeInTheDocument();
  });

  it("renders the compact variant without losing the phase copy", () => {
    render(
      <JournalGenerationStatus
        label="今天想走得更稳的地方，整理成下次用得上的一页"
        description="收束标题和读感，让这页日志下次拿得到"
        progress={92}
        variant="compact"
      />
    );

    expect(screen.getByText("今天想走得更稳的地方，整理成下次用得上的一页")).toBeInTheDocument();
    expect(screen.getByText("收束标题和读感，让这页日志下次拿得到")).toBeInTheDocument();
    expect(screen.getAllByText("完成润色").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("当前阶段：完成润色")).toBeInTheDocument();
    expect(screen.getByTestId("journal-skeleton-lines")).toBeInTheDocument();
  });
});
