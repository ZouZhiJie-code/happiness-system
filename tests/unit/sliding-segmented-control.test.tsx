import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { SlidingSegmentedControl } from "@/components/ui";

describe("SlidingSegmentedControl", () => {
  it("renders options and calls onChange when a segment is clicked", () => {
    const onChange = vi.fn();

    render(
      <SlidingSegmentedControl
        ariaLabel="示例切换"
        value="a"
        onChange={onChange}
        items={[
          { value: "a", label: "选项 A" },
          { value: "b", label: "选项 B" }
        ]}
      />
    );

    expect(screen.getByRole("group", { name: "示例切换" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "选项 A" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "选项 B" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "选项 B" }));

    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("supports adornments on admin-style segments", () => {
    render(
      <SlidingSegmentedControl
        variant="admin"
        ariaLabel="维度"
        value="joy"
        onChange={() => undefined}
        items={[
          {
            value: "joy",
            label: "开心",
            ariaLabel: "开心，进行中",
            adornment: <span data-testid="status-dot" title="进行中" />
          }
        ]}
      />
    );

    expect(screen.getByRole("button", { name: "开心，进行中" })).toBeInTheDocument();
    expect(screen.getByTestId("status-dot")).toHaveAttribute("title", "进行中");
  });
});
