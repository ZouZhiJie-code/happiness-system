import React from "react";
import { render, screen } from "@testing-library/react";

import { HomePageView } from "@/components/home/home-page-view";

describe("home page view", () => {
  it("presents the new record to journal flow without legacy dimensions", () => {
    render(<HomePageView startHref="/preview/start" />);

    expect(screen.getByRole("heading", { level: 1, name: "从一句话开始，留下一份日记" })).toBeInTheDocument();
    const recordingChoices = screen.getAllByText(/^(陪我聊|帮我记)$/u);
    expect(recordingChoices.map((node) => node.textContent)).toEqual(["陪我聊", "帮我记"]);
    expect(screen.getByText("我来问，你来说")).toBeInTheDocument();
    expect(screen.getByText("你来说，我在听")).toBeInTheDocument();
    expect(screen.getByText("下班路上吹到一阵很舒服的晚风。")).toBeInTheDocument();
    expect(screen.getByText("那阵晚风让你从一天的紧绷里慢了下来。")).toBeInTheDocument();
    expect(screen.getByText("你是在什么时候意识到，自己今天一直绷着？")).toBeInTheDocument();
    expect(screen.getByText("下班路上吹到很舒服的晚风")).toBeInTheDocument();
    expect(screen.getByText("已记下")).toHaveClass("ui-status-badge");
    expect(screen.queryByText("DAILY LIGHT")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "开始记录" })[0]).toHaveAttribute("href", "/preview/start");
    expect(screen.queryByText("五种记录，五条认识自己的路")).not.toBeInTheDocument();
  });
});
