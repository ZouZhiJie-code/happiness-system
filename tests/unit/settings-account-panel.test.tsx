import React from "react";
import { render, screen } from "@testing-library/react";

import { SettingsAccountPanel } from "@/components/auth/settings-account-panel";

describe("settings internal tools", () => {
  it("shows administrator tools without another logout action", () => {
    render(
      <SettingsAccountPanel
        user={{ id: "admin-1", username: "admin" }}
        showAdminAnalyticsEntry
        showAdminAIQualityEntry
        showAdminAIRuntimeEntry
      />
    );

    expect(screen.getByRole("link", { name: "数据分析" })).toHaveAttribute("href", "/admin/analytics");
    expect(screen.getByRole("link", { name: "AI 质量改进" })).toHaveAttribute("href", "/admin/ai-quality");
    expect(screen.getByRole("link", { name: "AI 运行配置" })).toHaveAttribute("href", "/settings/ai-runtime");
    expect(screen.queryByRole("button", { name: /退出/ })).not.toBeInTheDocument();
  });
});
