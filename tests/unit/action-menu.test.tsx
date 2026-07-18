import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ActionMenu } from "@/components/ui";

describe("ActionMenu", () => {
  it("supports directional keyboard navigation and restores trigger focus", async () => {
    render(
      <ActionMenu
        triggerLabel="打开菜单"
        menuAriaLabel="日志动作"
        items={[
          { id: "edit", label: "编辑", onSelect: () => undefined },
          { id: "delete", label: "删除", onSelect: () => undefined }
        ]}
      />
    );

    const trigger = screen.getByRole("button", { name: "打开菜单" });
    trigger.focus();
    fireEvent.click(trigger);

    const edit = screen.getByRole("menuitem", { name: "编辑" });
    const remove = screen.getByRole("menuitem", { name: "删除" });
    expect(edit).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("menu", { name: "日志动作" }), { key: "ArrowDown" });
    expect(remove).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
