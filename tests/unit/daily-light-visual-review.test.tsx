import { act, fireEvent, render, screen, within } from "@testing-library/react";

import { DailyLightVisualReview } from "@/components/preview/daily-light-visual-review";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() })
}));

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
    expect(screen.getByRole("button", { name: /陪我聊 我来问，你来说/u })).toHaveAttribute("aria-busy", "false");
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

  it("帮我记只保存原话并自然承接，不进入追问流程", () => {
    vi.useFakeTimers();
    render(<DailyLightVisualReview />);

    fireEvent.click(screen.getByRole("button", { name: /帮我记.*你来说，我在听/u }));
    act(() => vi.advanceTimersByTime(450));

    expect(screen.getByLabelText("原话已保存")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "确认延期后的交付安排" })).toBeInTheDocument();
    expect(screen.getByText("好，这段已经记下了。")).toBeInTheDocument();
    expect(screen.queryByText(/那一刻你最想守住的是什么/u)).not.toBeInTheDocument();

    const composer = screen.getByLabelText("输入当前事件");
    fireEvent.change(composer, { target: { value: "新的交付日期是下周三。" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    act(() => vi.advanceTimersByTime(620));

    expect(screen.getByText("新的交付日期是下周三。").closest('[data-message-role="user"]'))
      .toBeInTheDocument();
    expect(screen.getAllByText("好，这段已经记下了。")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "重新生成" })).not.toBeInTheDocument();
  });

  it("零写入走通选择、双气泡生成、重新生成、完成与日周月切换", () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<DailyLightVisualReview />);

    fireEvent.click(screen.getByRole("button", { name: /陪我聊.*我来问，你来说/u }));
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

    fireEvent.click(screen.getByRole("button", { name: "完成记录" }));
    expect(screen.getByTestId("event-centered-completion-inline")).toHaveTextContent("已记下");
    fireEvent.click(within(screen.getByTestId("event-centered-completion-inline")).getByRole("button", { name: /查看 8月12日日记/u }));
    expect(screen.getByRole("heading", { name: "8月12日周三" })).toBeInTheDocument();
    expect(screen.getByText("和妈妈通话后的复杂感受")).toBeInTheDocument();
    expect(screen.getAllByText("需更新").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "更新日记" }));
    expect(screen.getByRole("button", { name: "编辑日记" })).toBeInTheDocument();

    const archiveSidebar = screen.getByRole("complementary", { name: "日记归档" });
    expect(
      ["切换到日视图", "切换到周视图", "切换到月视图"].map(
        (name) => within(archiveSidebar).getByRole("button", { name }).textContent,
      ),
    ).toEqual(["日", "周", "月"]);
    fireEvent.click(within(archiveSidebar).getByRole("button", { name: "切换到周视图" }));
    expect(screen.getByTestId("journal-week-report-workspace")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("complementary", { name: "日记归档" })).getByRole("button", { name: "切换到月视图" }));
    expect(screen.getByTestId("journal-month-report-workspace")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("再记一件回到同一对话画布并重新选择记录方式", () => {
    vi.useFakeTimers();
    render(<DailyLightVisualReview initialScreen="interview-complete" />);

    fireEvent.click(within(screen.getByTestId("event-centered-completion-inline")).getByRole("button", { name: "新建记录" }));
    expect(screen.getByText("8 月 12 日想怎么记？")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("先选择一种记录方式")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /帮我记.*你来说，我在听/u }));
    act(() => vi.advanceTimersByTime(450));
    expect(screen.getByText("帮我记")).toBeInTheDocument();
    expect(screen.queryByText("陪我聊")).not.toBeInTheDocument();
  });

  it("侧栏切换后仍保留每条会话自己的记录方式", () => {
    vi.useFakeTimers();
    render(<DailyLightVisualReview />);

    fireEvent.click(screen.getByRole("button", { name: /陪我聊.*我来问，你来说/u }));
    act(() => vi.advanceTimersByTime(450));
    expect(screen.getByText("陪我聊")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: /下班前把拖了几天的事情做完了.*进行中/u }));
    expect(screen.getByText("帮我记")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: /和妈妈通话后的复杂感受.*进行中/u }));
    expect(screen.getByText("陪我聊")).toBeInTheDocument();
  });

  it("在六个零写入视觉页面之间切换", () => {
    render(<DailyLightVisualReview />);
    const reviewNavigation = within(
      screen.getByRole("navigation", { name: "视觉验收页面" })
    );

    expect(screen.getByText("8 月 12 日想怎么记？").closest('[data-message-role="assistant"]')).toBeInTheDocument();
    fireEvent.click(reviewNavigation.getByRole("button", { name: "记录对话" }));
    expect(screen.getByRole("heading", { name: "和妈妈通话后的复杂感受" })).toBeInTheDocument();
    fireEvent.click(reviewNavigation.getByRole("button", { name: "记录完成" }));
    expect(screen.getByTestId("event-centered-completion-inline")).toHaveTextContent("已记下");
    fireEvent.click(reviewNavigation.getByRole("button", { name: "日记" }));
    expect(screen.getByRole("heading", { name: "8月12日周三" })).toBeInTheDocument();
    fireEvent.click(reviewNavigation.getByRole("button", { name: "周记" }));
    expect(screen.getByTestId("journal-week-report-workspace")).toBeInTheDocument();
    fireEvent.click(reviewNavigation.getByRole("button", { name: "月记" }));
    expect(screen.getByTestId("journal-month-report-workspace")).toBeInTheDocument();
  });

  it("覆盖三次视觉确认并保持新一级导航", () => {
    render(<DailyLightVisualReview initialScreen="foundation" />);
    const headerNavigation = screen.getByRole("navigation", { name: "视觉稿主导航" });
    expect(within(headerNavigation).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "记录",
      "日记",
      "认识自己"
    ]);
    expect(screen.getByRole("heading", { name: "一套稳定、清楚的记录语言" })).toBeInTheDocument();

    const reviewNavigation = within(screen.getByRole("navigation", { name: "视觉验收页面" }));
    fireEvent.click(reviewNavigation.getByRole("button", { name: "首页" }));
    expect(screen.getByRole("heading", { name: "从一句话开始，留下一份日记" })).toBeInTheDocument();
    fireEvent.click(reviewNavigation.getByRole("button", { name: "趋势" }));
    expect(screen.getByRole("heading", { name: "认识自己" })).toBeInTheDocument();
    fireEvent.click(reviewNavigation.getByRole("button", { name: "记忆" }));
    expect(screen.getByRole("heading", { name: "记忆" })).toBeInTheDocument();
    expect(screen.getByText("即将上线")).toBeInTheDocument();
    fireEvent.click(reviewNavigation.getByRole("button", { name: "设置" }));
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
    fireEvent.click(reviewNavigation.getByRole("button", { name: "法律页面" }));
    expect(screen.getByRole("heading", { name: "隐私政策" })).toBeInTheDocument();
  });

  it("两条未完成记录达到上限时给出本地提示", () => {
    render(<DailyLightVisualReview initialScreen="interview-chat" />);
    fireEvent.click(screen.getByRole("button", { name: "新建记录" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "你还有 2 条记录没有完成，先完成其中一条，再新建记录。"
    );
  });

  it("清爽截图模式隐藏验收切换器", () => {
    render(<DailyLightVisualReview initialScreen="day" clean />);
    expect(screen.queryByRole("navigation", { name: "视觉验收页面" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "8月12日周三" })).toBeInTheDocument();
  });
});
