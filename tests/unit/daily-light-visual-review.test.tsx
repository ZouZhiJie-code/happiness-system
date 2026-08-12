import { act, fireEvent, render, screen, within } from "@testing-library/react";

import { DailyLightVisualReview } from "@/components/preview/daily-light-visual-review";

describe("Daily Light 视觉验收入口", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("首次点击只在所选入口显示正在准备", () => {
    vi.useFakeTimers();
    render(<DailyLightVisualReview />);

    expect(screen.queryByRole("complementary", { name: "当天片段" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /帮我记/u }));

    expect(screen.getByRole("button", { name: /帮我记 正在准备/u })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: /陪我聊 从一件事聊开/u })).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByText(/正在恢复/u)).not.toBeInTheDocument();
    act(() => {
      vi.runOnlyPendingTimers();
    });
  });

  it("对话页的赞踩只在本地切换，不访问反馈接口", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<DailyLightVisualReview initialScreen="interview-chat" />);

    const upvote = screen.getByRole("button", { name: "赞" });
    const downvote = screen.getByRole("button", { name: "踩" });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(upvote);
    expect(upvote).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(downvote);
    expect(upvote).toHaveAttribute("aria-pressed", "false");
    expect(downvote).toHaveAttribute("aria-pressed", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("零写入走通选择、双气泡生成、重新生成、完成与日周月切换", () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<DailyLightVisualReview />);

    fireEvent.click(screen.getByRole("button", { name: /陪我聊.*从一件事聊开/u }));
    act(() => vi.advanceTimersByTime(450));
    expect(screen.getByRole("heading", { name: "和妈妈通话后的复杂感受" })).toBeInTheDocument();

    const composer = screen.getByLabelText("输入当前事件");
    fireEvent.change(composer, { target: { value: "我最难受的是，她像在检查我的选择。" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    const userBubble = screen.getByText("我最难受的是，她像在检查我的选择。").closest('[data-message-role="user"]');
    expect(userBubble?.parentElement).toHaveClass("justify-end");

    let streamGroup = screen.getByTestId("event-centered-stream-message-group");
    expect(within(streamGroup).getAllByText("正在回复…")).toHaveLength(1);
    act(() => vi.advanceTimersByTime(260));
    streamGroup = screen.getByTestId("event-centered-stream-message-group");
    expect(streamGroup.querySelectorAll('[data-message-role="assistant"]')).toHaveLength(1);
    expect(within(streamGroup).getByText(/一边理解她是在担心你/u)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(460));
    streamGroup = screen.getByTestId("event-centered-stream-message-group");
    const streamingBubbles = streamGroup.querySelectorAll('[data-message-role="assistant"]');
    expect(streamingBubbles).toHaveLength(2);
    expect(streamingBubbles[0].className).toBe(streamingBubbles[1].className);
    expect(within(streamGroup).getByText(/更想保护的是自己的哪一部分/u)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(460));
    expect(screen.queryByTestId("event-centered-stream-message-group")).not.toBeInTheDocument();
    expect(screen.getByTestId("ai-feedback-visual-local-trace-1")).toBeInTheDocument();

    const regenerateButtons = screen.getAllByRole("button", { name: "重新生成" });
    fireEvent.click(regenerateButtons[regenerateButtons.length - 1]);
    fireEvent.click(screen.getByRole("menuitem", { name: /更简单一点/u }));
    expect(screen.getByText("你知道妈妈是在担心你，但这些追问也让你感到有压力。")).toBeInTheDocument();
    expect(screen.getByText("她说到哪一句时，你开始不想再解释了？")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "先停在这里" }));
    expect(screen.getByRole("heading", { name: "已记下" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /查看 8月12日日记/u }));
    expect(screen.getByRole("heading", { name: "8月12日周三" })).toBeInTheDocument();
    expect(screen.getByText("和妈妈通话后的复杂感受")).toBeInTheDocument();
    expect(screen.getAllByText("需更新").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "更新日记" }));
    expect(screen.getByRole("button", { name: "编辑日记" })).toBeInTheDocument();

    const rangeSwitcher = screen.getByLabelText("切换日记范围");
    expect(within(rangeSwitcher).getAllByRole("button").map((button) => button.textContent)).toEqual(["日", "周", "月"]);
    fireEvent.click(within(rangeSwitcher).getByRole("button", { name: "周" }));
    expect(screen.getByTestId("journal-week-report-workspace")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "月" }));
    expect(screen.getByTestId("journal-month-report-workspace")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("再记一件回到同一对话画布并重新选择记录方式", () => {
    vi.useFakeTimers();
    render(<DailyLightVisualReview initialScreen="interview-complete" />);

    fireEvent.click(screen.getByRole("button", { name: "再记一件" }));
    expect(screen.getByText("今天想怎么记？")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("先选择一种记录方式")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /帮我记.*说下来，我帮你整理/u }));
    act(() => vi.advanceTimersByTime(450));
    expect(screen.getByText("帮我记")).toBeInTheDocument();
    expect(screen.queryByText("陪我聊")).not.toBeInTheDocument();
  });

  it("在六个零写入视觉页面之间切换", () => {
    render(<DailyLightVisualReview />);
    const reviewNavigation = within(
      screen.getByRole("navigation", { name: "视觉验收页面" })
    );

    expect(screen.getByText("今天想怎么记？").closest('[data-message-role="assistant"]')).toBeInTheDocument();
    fireEvent.click(reviewNavigation.getByRole("button", { name: "访谈对话" }));
    expect(screen.getByRole("heading", { name: "和妈妈通话后的复杂感受" })).toBeInTheDocument();
    fireEvent.click(reviewNavigation.getByRole("button", { name: "访谈完成" }));
    expect(screen.getByRole("heading", { name: "已记下" })).toBeInTheDocument();
    fireEvent.click(reviewNavigation.getByRole("button", { name: "日记" }));
    expect(screen.getByRole("heading", { name: "8月12日周三" })).toBeInTheDocument();
    fireEvent.click(reviewNavigation.getByRole("button", { name: "周记" }));
    expect(screen.getByTestId("journal-week-report-workspace")).toBeInTheDocument();
    fireEvent.click(reviewNavigation.getByRole("button", { name: "月记" }));
    expect(screen.getByTestId("journal-month-report-workspace")).toBeInTheDocument();
  });

  it("清爽截图模式隐藏验收切换器", () => {
    render(<DailyLightVisualReview initialScreen="day" clean />);
    expect(screen.queryByRole("navigation", { name: "视觉验收页面" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "8月12日周三" })).toBeInTheDocument();
  });
});
