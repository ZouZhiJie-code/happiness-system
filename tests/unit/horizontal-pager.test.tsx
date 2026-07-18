import React from "react";
import { render, screen } from "@testing-library/react";

import { HorizontalPager } from "@/components/ui";
import { resolveHorizontalPagerDirection } from "@/components/ui/horizontal-pager";

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

  it("marks the active track and enables vertical scrolling when swipe is active", () => {
    render(
      <HorizontalPager
        activeKey="b"
        swipeable
        onRequestChange={() => undefined}
        pages={[
          { key: "a", children: "A" },
          { key: "b", children: "B" },
          { key: "c", children: "C" }
        ]}
      />
    );

    const track = document.querySelector(".ui-horizontal-pager__track");

    expect(track).toHaveStyle({ display: "flex" });
    expect(track).toHaveAttribute("data-active", "b");
    expect(track?.parentElement).toHaveClass("touch-pan-y");
  });

  it("keeps short drags on the current page before applying velocity projection", () => {
    expect(resolveHorizontalPagerDirection({ offsetX: 8, velocityX: 1800, viewportWidth: 390 })).toBe(0);
    expect(resolveHorizontalPagerDirection({ offsetX: -70, velocityX: -300, viewportWidth: 390 })).toBe(1);
    expect(resolveHorizontalPagerDirection({ offsetX: 70, velocityX: 300, viewportWidth: 390 })).toBe(-1);
  });
});
