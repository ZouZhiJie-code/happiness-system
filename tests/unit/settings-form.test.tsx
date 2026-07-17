import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SettingsForm } from "@/components/joy/settings-form";

describe("SettingsForm", () => {
  it("loads the real setting and saves a changed value", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ memoryEnabled: false }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ memoryEnabled: true }), { status: 200 })) as typeof fetch;

    render(<SettingsForm />);

    const toggle = await screen.findByRole("checkbox");
    await waitFor(() => expect(toggle).toBeEnabled());
    fireEvent.click(toggle);

    expect(screen.getByText("正在保存…")).toBeInTheDocument();
    await screen.findByText("设置已保存");
    expect(toggle).toBeChecked();
    expect(global.fetch).toHaveBeenLastCalledWith(
      "/api/settings",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ memoryEnabled: true }) })
    );
  });

  it("restores the previous value when saving fails", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ memoryEnabled: false }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 })) as typeof fetch;

    render(<SettingsForm />);

    const toggle = await screen.findByRole("checkbox");
    await waitFor(() => expect(toggle).toBeEnabled());
    fireEvent.click(toggle);

    await screen.findByRole("alert");
    expect(toggle).not.toBeChecked();
    expect(screen.getByRole("alert")).toHaveTextContent("设置保存失败");
  });
});
