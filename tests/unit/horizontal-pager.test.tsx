import React from "react";
import { render, screen } from "@testing-library/react";

import { HorizontalPager } from "@/components/ui";

describe("HorizontalPager", () => {
  it("shows only the active page content to assistive tech", () => {
    const { rerender } = render(
      <HorizontalPager
        activeKey="a"
        ariaLabel="分页内容"
        pages={[
          { key: "a", children: <p>页面 A</p> },
          { key: "b", children: <p>页面 B</p> }
        ]}
      />
    );

    expect(screen.getByText("页面 A")).toBeInTheDocument();
    expect(screen.getByText("页面 B")).toBeInTheDocument();
    expect(screen.getByText("页面 A").closest(".ui-horizontal-pager__page")).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByText("页面 B").closest(".ui-horizontal-pager__page")).toHaveAttribute("aria-hidden", "true");

    rerender(
      <HorizontalPager
        activeKey="b"
        ariaLabel="分页内容"
        pages={[
          { key: "a", children: <p>页面 A</p> },
          { key: "b", children: <p>页面 B</p> }
        ]}
      />
    );

    expect(screen.getByText("页面 B").closest(".ui-horizontal-pager__page")).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByText("页面 A").closest(".ui-horizontal-pager__page")).toHaveAttribute("aria-hidden", "true");
  });

  it("offsets the track based on the active page index", () => {
    render(
      <HorizontalPager
        activeKey="b"
        pages={[
          { key: "a", children: "A" },
          { key: "b", children: "B" },
          { key: "c", children: "C" }
        ]}
      />
    );

    const track = document.querySelector(".ui-horizontal-pager__track");

    expect(track).toHaveStyle({ transform: "translateX(-33.333333333333336%)" });
    expect(track).toHaveAttribute("data-active", "b");
  });
});
