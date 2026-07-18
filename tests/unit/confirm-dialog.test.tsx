import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ConfirmDialog } from "@/components/ui";

function DialogHarness({ tone = "default" }: { tone?: "default" | "danger" }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>打开确认</button>
      <ConfirmDialog
        open={open}
        title="确认操作"
        tone={tone}
        onCancel={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
      />
    </>
  );
}

describe("ConfirmDialog", () => {
  it("traps focus and restores it to the trigger", async () => {
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "打开确认" });

    trigger.focus();
    fireEvent.click(trigger);
    const confirm = screen.getByRole("button", { name: "确定" });
    const cancel = screen.getByRole("button", { name: "取消" });

    expect(confirm).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("focuses the safe action first for destructive confirmation", () => {
    render(<DialogHarness tone="danger" />);
    fireEvent.click(screen.getByRole("button", { name: "打开确认" }));
    expect(screen.getByRole("button", { name: "取消" })).toHaveFocus();
  });
});
