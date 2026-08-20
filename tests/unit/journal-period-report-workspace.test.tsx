import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

import {
  JournalPeriodReportWorkspace,
  type JournalPeriodReportWorkspaceView
} from "@/components/journal/journal-period-report-workspace";

function makeWeekView(overrides: Partial<JournalPeriodReportWorkspaceView> = {}): JournalPeriodReportWorkspaceView {
  return {
    kind: "week",
    periodLabel: "五月第一周",
    rangeLabel: "2026 年 5 月 4 日—5 月 10 日",
    displayStatus: "stale",
    archives: [
      { id: "week-current", label: "五月第一周", rangeLabel: "5 月 4 日—5 月 10 日", status: "stale", selected: true },
      { id: "week-previous", label: "四月第四周", rangeLabel: "4 月 27 日—5 月 3 日", status: "saved" }
    ],
    sources: [
      {
        id: "daily-1",
        kind: "daily_report",
        label: "5 月 6 日日报",
        title: "把演示稳稳讲完",
        excerpt: "演示顺利落地，也看见了准备带来的底气。",
        rangeLabel: "5 月 6 日",
        startDate: "2026-05-06",
        endDate: "2026-05-06"
      }
    ],
    report: {
      id: "report-week-1",
      title: "在节奏里稳住自己",
      content: "这一周，我把几件重要的事情慢慢落到了实处。",
      contentRevision: 3,
      status: "saved",
      updatedLabel: "5 月 10 日保存",
      manualParagraphCount: 1
    },
    summary: {
      title: "从准备中获得稳定感",
      content: "几次关键准备，让这一周慢慢稳了下来。"
    },
    metrics: [
      { label: "记录天数", value: "4 天" },
      { label: "有效来源", value: "6 条" },
      { label: "已保存日报", value: "3 篇" }
    ],
    updateNotice: "5 月 6 日的日记有了变化。",
    ...overrides
  };
}

describe("JournalPeriodReportWorkspace", () => {
  it("用周记归档、按天来源和主动更新动作呈现需更新状态", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onSelectArchive = vi.fn();
    const onOpenSource = vi.fn();

    render(
      <JournalPeriodReportWorkspace
        view={makeWeekView()}
        onUpdate={onUpdate}
        onSelectArchive={onSelectArchive}
        onOpenSource={onOpenSource}
      />
    );

    expect(screen.getByTestId("journal-week-report-workspace")).toHaveAttribute("aria-busy", "false");
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "周记归档" })).toBeInTheDocument();
    expect(screen.getByText("本周主线")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "按天回看" })).toBeInTheDocument();
    expect(screen.getByText("5 月 6 日")).toBeInTheDocument();
    expect(screen.getByText("把演示稳稳讲完")).toBeInTheDocument();
    expect(screen.getAllByText("需更新").length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "更新周记" }));
      await Promise.resolve();
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);

    const previousArchive = screen.getByRole("button", { name: /四月第四周/ });
    previousArchive.focus();
    expect(previousArchive).toHaveFocus();
    fireEvent.click(previousArchive);
    expect(onSelectArchive).toHaveBeenCalledWith(expect.objectContaining({ id: "week-previous" }));

    fireEvent.click(screen.getByRole("button", { name: "打开把演示稳稳讲完" }));
    expect(onOpenSource).toHaveBeenCalledWith(expect.objectContaining({ id: "daily-1" }));
  });

  it("允许编辑、保存月记，并按周折叠现有素材", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const monthView = makeWeekView({
      kind: "month",
      periodLabel: "2026 年 5 月",
      rangeLabel: "2026 年 5 月 1 日—5 月 31 日",
      displayStatus: "draft",
      archives: [{ id: "month-current", label: "2026 年 5 月", rangeLabel: "5 月", status: "draft", selected: true }],
      sources: [{
        id: "week-1",
        kind: "weekly_report",
        label: "五月第一周",
        title: "在节奏里稳住自己",
        excerpt: "这一周，几件重要的事情慢慢落到了实处。",
        rangeLabel: "5 月 4 日—5 月 10 日",
        startDate: "2026-05-04",
        endDate: "2026-05-10"
      }],
      summary: { title: "慢慢把节奏找回来" }
    });

    render(<JournalPeriodReportWorkspace view={monthView} onSave={onSave} />);

    expect(screen.queryByRole("heading", { name: "月记归档" })).not.toBeInTheDocument();
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByText("本月线索")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "按周回看" })).toBeInTheDocument();
    expect(screen.getByText("5 月 4 日—5 月 10 日")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "编辑月记" }));
    fireEvent.change(screen.getByRole("textbox", { name: "月记标题" }), { target: { value: "五月的稳定感" } });
    fireEvent.change(screen.getByRole("textbox", { name: "月记正文" }), { target: { value: "我把一周周的记录留了下来。 " } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "保存月记" }));
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledWith({
      reportId: "report-week-1",
      title: "五月的稳定感",
      content: "我把一周周的记录留了下来。 ",
      expectedContentRevision: 3
    });
  });

  it("为未生成与空白周期保留可读的真实空态", async () => {
    const onGenerate = vi.fn().mockResolvedValue(undefined);
    const ungenerated = makeWeekView({
      displayStatus: "ungenerated",
      report: null,
      archives: [],
      emptyDescription: "这周已经留下了一些内容。"
    });
    const { rerender } = render(<JournalPeriodReportWorkspace view={ungenerated} onGenerate={onGenerate} />);

    expect(screen.getByText("这周已经留下了一些内容。")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "生成周记" }));
      await Promise.resolve();
    });
    expect(onGenerate).toHaveBeenCalledTimes(1);

    rerender(<JournalPeriodReportWorkspace view={makeWeekView({
      displayStatus: "blank",
      report: null,
      sources: [],
      archives: [],
      emptyDescription: null,
      emptyActionHref: "/calendar?view=day&date=2026-05-04"
    })} />);
    expect(screen.getByText("这一段时间还没有内容")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去记一天" })).toHaveAttribute(
      "href",
      "/calendar?view=day&date=2026-05-04"
    );
    expect(screen.queryByRole("button", { name: /生成周记/ })).not.toBeInTheDocument();
  });

  it.each([
    ["week", "generating", false, "生成中"],
    ["week", "saved", true, "已保存"],
    ["week", "update_failed", true, "更新失败"],
    ["month", "blank", false, "空白"],
    ["month", "ungenerated", false, "未生成"],
    ["month", "generating", false, "生成中"],
    ["month", "saved", true, "已保存"],
    ["month", "stale", true, "需更新"],
    ["month", "update_failed", true, "更新失败"]
  ] as const)("renders %s %s inside one stable canvas", (kind, status, withReport, badge) => {
    const { container, unmount } = render(
      <JournalPeriodReportWorkspace
        view={makeWeekView({
          kind,
          displayStatus: status,
          periodLabel: kind === "week" ? "五月第一周" : "2026 年 5 月",
          archives: [],
          report: withReport ? makeWeekView().report : null,
          sources: status === "blank" ? [] : makeWeekView().sources,
          emptyActionHref: status === "blank" ? "/calendar?view=day&date=2026-05-04" : null
        })}
      />
    );

    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByTestId(`journal-${kind}-report-workspace`)).toBeInTheDocument();
    expect(screen.getByText(badge)).toBeInTheDocument();
    unmount();
  });
});
