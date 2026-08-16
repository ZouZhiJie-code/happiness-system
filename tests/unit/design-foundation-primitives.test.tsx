import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  Field,
  FloatingComposer,
  IconButton,
  ReadingDocument,
  SegmentedNavigation,
  StatusAction,
  StatusBadge,
  WorkspaceSidebar
} from "@/components/ui";

describe("Daily Light shared design foundation", () => {
  it("gives icon-only actions an accessible name", () => {
    render(<IconButton aria-label="收起侧栏">图标</IconButton>);
    expect(screen.getByRole("button", { name: "收起侧栏" })).toHaveClass("ui-icon-button");
  });

  it("connects a field label and error to the input", () => {
    render(<Field label="记录标题" name="title" defaultValue="今天的散步" error="标题太长" />);
    expect(screen.getByRole("textbox", { name: "记录标题" })).toHaveValue("今天的散步");
    expect(screen.getByText("标题太长")).toBeInTheDocument();
  });

  it("renders status and in-place status actions with stable labels", () => {
    render(
      <>
        <StatusBadge tone="success">已保存</StatusBadge>
        <StatusAction statusLabel="需更新" actionLabel="更新日记" />
      </>
    );

    expect(screen.getByText("已保存")).toHaveAttribute("data-tone", "success");
    expect(screen.getByRole("button", { name: "更新日记" })).toHaveTextContent("需更新更新日记正在处理");
  });

  it("renders the shared sidebar in expanded and collapsed states", () => {
    const view = render(
      <WorkspaceSidebar aria-label="记录列表" width={320} header="新建记录" footer="2 条记录">
        今天
      </WorkspaceSidebar>
    );

    const sidebar = screen.getByRole("complementary", { name: "记录列表" });
    expect(sidebar.style.getPropertyValue("--workspace-sidebar-width")).toBe("320px");
    expect(sidebar).not.toHaveAttribute("data-collapsed");

    view.rerender(
      <WorkspaceSidebar aria-label="记录列表" width={320} collapsed>
        今天
      </WorkspaceSidebar>
    );
    expect(sidebar).toHaveAttribute("data-collapsed");
  });

  it("uses one reading structure for reports", () => {
    render(
      <ReadingDocument
        title="8月13日 星期四"
        meta="日记"
        status={<StatusBadge tone="stale">需更新</StatusBadge>}
        actions={<button type="button">编辑日记</button>}
        sources="查看来源"
      >
        <p>今天完成了端到端联调。</p>
      </ReadingDocument>
    );

    expect(screen.getByRole("heading", { name: "8月13日 星期四" })).toBeInTheDocument();
    expect(screen.getByText("今天完成了端到端联调。")).toBeInTheDocument();
    expect(screen.getByText("查看来源")).toBeInTheDocument();
  });

  it("provides a single floating composer shell without owning input behavior", () => {
    render(
      <FloatingComposer actions={<button type="button">发送</button>}>
        <textarea aria-label="说点什么" />
      </FloatingComposer>
    );

    expect(screen.getByRole("region", { name: "输入消息" })).toHaveClass("ui-floating-composer");
    expect(screen.getByRole("textbox", { name: "说点什么" })).toBeInTheDocument();
  });

  it("keeps the compact insights navigation keyboard reachable", () => {
    render(
      <SegmentedNavigation
        ariaLabel="认识自己分区"
        value="trends"
        items={[
          { value: "trends", label: "趋势", href: "/insights?section=trends" },
          { value: "portrait", label: "画像", href: "/insights?section=portrait" },
          { value: "memories", label: "记忆", href: "/insights?section=memories" }
        ]}
      />
    );

    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("aria-current", "page");
    links[0]?.focus();
    fireEvent.keyDown(links[0]!, { key: "End" });
    expect(links[2]).toHaveFocus();
    fireEvent.keyDown(links[2]!, { key: "ArrowRight" });
    expect(links[0]).toHaveFocus();
  });
});
