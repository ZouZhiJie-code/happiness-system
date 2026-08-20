import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  INSIGHTS_DEMO_DATA,
  InsightsWorkspaceView
} from "@/components/insights";

describe("InsightsWorkspaceView", () => {
  it("renders a fixed-data trends view without a client fetch", () => {
    const { container } = render(
      <InsightsWorkspaceView
        section="trends"
        trends={INSIGHTS_DEMO_DATA.trends}
        self={INSIGHTS_DEMO_DATA.self}
      />
    );
    expect(screen.getByRole("heading", { name: "认识自己", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "记录趋势" })).toBeInTheDocument();
    expect(screen.getByText("8", { selector: "dd" })).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });

  it("renders the factual portrait with journal links", () => {
    render(
      <InsightsWorkspaceView
        section="portrait"
        trends={INSIGHTS_DEMO_DATA.trends}
        self={INSIGHTS_DEMO_DATA.self}
      />
    );
    expect(screen.getByRole("heading", { name: "记录中的我" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /完整链路终于跑通/ })).toHaveAttribute(
      "href",
      "/calendar?view=day&date=2026-08-13"
    );
  });

  it("shows memories as coming soon without fake actions", () => {
    render(
      <InsightsWorkspaceView
        section="memories"
        trends={INSIGHTS_DEMO_DATA.trends}
        self={INSIGHTS_DEMO_DATA.self}
      />
    );
    expect(screen.getByText("即将上线")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
