import React from "react";
import { render, screen } from "@testing-library/react";

import {
  InlineStatus,
  PageHeading,
  ReadingSurface,
  SectionHeading,
  SourceDrawer
} from "@/components/ui";

describe("shared visual primitives", () => {
  it("renders one responsive page heading with an explicit font context", () => {
    render(
      <PageHeading
        title="今日日记"
        description="8月12日"
        font="display"
        actions={<button type="button">保存</button>}
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: "今日日记" })).toHaveClass(
      "ui-page-heading__title"
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute("data-font", "display");
    expect(screen.getByText("8月12日")).toHaveClass("ui-page-heading__description");
    expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
  });

  it("separates section and item hierarchy from semantic heading level", () => {
    render(
      <SectionHeading
        title="当天片段"
        hint="3 条"
        description="按时间排列"
        size="item"
        headingAs="h3"
      />
    );

    const heading = screen.getByRole("heading", { level: 3, name: "当天片段" });
    expect(heading).toHaveClass("ui-section-heading__title");
    expect(heading.closest(".ui-section-heading")).toHaveAttribute("data-size", "item");
    expect(screen.getByText("3 条")).toHaveClass("ui-section-heading__hint");
  });

  it("announces ordinary and error states with the right live-region role", () => {
    const { rerender } = render(
      <InlineStatus tone="warning" title="有新记录" busy action={<button type="button">更新</button>}>
        可以更新日记
      </InlineStatus>
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("data-tone", "warning");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument();

    rerender(
      <InlineStatus tone="error" title="保存失败">
        请重试
      </InlineStatus>
    );
    expect(screen.getByRole("alert")).toHaveAttribute("data-tone", "error");
  });

  it("provides a serif reading surface without forcing a second card API", () => {
    render(
      <ReadingSurface as="section" density="compact" data-testid="report-surface">
        <p>今天完成了重要的一步。</p>
      </ReadingSurface>
    );

    const surface = screen.getByTestId("report-surface");
    expect(surface.tagName).toBe("SECTION");
    expect(surface).toHaveClass("ui-reading-surface");
    expect(surface).toHaveAttribute("data-density", "compact");
  });

  it("keeps provenance in a native on-demand disclosure", () => {
    render(
      <SourceDrawer label="查看来源" meta="3 条" open>
        <p>当天片段</p>
      </SourceDrawer>
    );

    const label = screen.getByText("查看来源");
    const details = label.closest("details");
    expect(details).toHaveClass("ui-source-drawer");
    expect(details).toHaveAttribute("open");
    expect(screen.getByText("当天片段")).toBeInTheDocument();
  });
});
