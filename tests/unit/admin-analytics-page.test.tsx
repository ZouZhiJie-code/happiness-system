import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const { mockRequireAdminPage } = vi.hoisted(() => ({
  mockRequireAdminPage: vi.fn()
}));

const { mockRouterReplace } = vi.hoisted(() => ({
  mockRouterReplace: vi.fn()
}));

const {
  mockGetAdminAnalyticsDailyJournalDetail,
  mockGetAdminAnalyticsEntryDetail,
  mockGetAdminAnalyticsFunnel,
  mockGetAdminAnalyticsOverview,
  mockGetAdminAnalyticsQuality,
  mockGetAdminAnalyticsRetention,
  mockGetAdminAnalyticsSessionDetail,
  mockGetAdminAnalyticsUserDetail,
  mockListAdminAnalyticsUsers
} = vi.hoisted(() => ({
  mockGetAdminAnalyticsDailyJournalDetail: vi.fn(),
  mockGetAdminAnalyticsEntryDetail: vi.fn(),
  mockGetAdminAnalyticsFunnel: vi.fn(),
  mockGetAdminAnalyticsOverview: vi.fn(),
  mockGetAdminAnalyticsQuality: vi.fn(),
  mockGetAdminAnalyticsRetention: vi.fn(),
  mockGetAdminAnalyticsSessionDetail: vi.fn(),
  mockGetAdminAnalyticsUserDetail: vi.fn(),
  mockListAdminAnalyticsUsers: vi.fn()
}));

vi.mock("@/server/services/auth/auth-page-guard", () => ({
  requireAdminPage: mockRequireAdminPage
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockRouterReplace
  })
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    scroll,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    scroll?: boolean;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} data-scroll={scroll === undefined ? "undefined" : String(scroll)} {...props}>
      {children}
    </a>
  )
}));

vi.mock("@/server/services/admin-analytics/admin-analytics.service", () => ({
  getAdminAnalyticsDailyJournalDetail: mockGetAdminAnalyticsDailyJournalDetail,
  getAdminAnalyticsEntryDetail: mockGetAdminAnalyticsEntryDetail,
  getAdminAnalyticsFunnel: mockGetAdminAnalyticsFunnel,
  getAdminAnalyticsOverview: mockGetAdminAnalyticsOverview,
  getAdminAnalyticsQuality: mockGetAdminAnalyticsQuality,
  getAdminAnalyticsRetention: mockGetAdminAnalyticsRetention,
  getAdminAnalyticsSessionDetail: mockGetAdminAnalyticsSessionDetail,
  getAdminAnalyticsUserDetail: mockGetAdminAnalyticsUserDetail,
  listAdminAnalyticsUsers: mockListAdminAnalyticsUsers
}));

import AdminAnalyticsPage from "@/app/admin/analytics/page";

describe("admin analytics page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T04:00:00.000Z"));

    mockRequireAdminPage.mockResolvedValue({
      id: "user-1",
      username: "admin_user"
    });

    mockGetAdminAnalyticsOverview.mockResolvedValue({
      range: { startDate: "2026-04-22", endDate: "2026-05-21" },
      northStar: { name: "MRU-7", value: 12 },
      overview: {
        savedJournalUsers: 8,
        savedJournalCount: 15,
        savedDailyJournalUsers: 5,
        savedDailyJournalCount: 7,
        happinessScoreUsers: 9,
        happinessScoreCount: 18
      },
      ai: { successRate: 0.92, p50LatencyMs: 820, p95LatencyMs: 1840 }
    });

    mockGetAdminAnalyticsFunnel.mockResolvedValue({
      mainFunnel: [
        { key: "register", count: 20 },
        { key: "login", count: 18 },
        { key: "privatePageView", count: 16 },
        { key: "sessionStart", count: 12 },
        { key: "firstReply", count: 9 },
        { key: "draftGenerated", count: 7 },
        { key: "journalSaved", count: 5 }
      ],
      secondaryFunnel: [
        { key: "dailyJournalGenerated", count: 4 },
        { key: "dailyJournalSaved", count: 3 }
      ],
      qualitySignals: {
        pausedCount: 2,
        reopenedCount: 1,
        boundaryInsufficientCount: 5,
        dimensionRedirectCount: 2
      }
    });

    mockGetAdminAnalyticsRetention.mockResolvedValue({
      d1ReturnToRecordRate: 0.42,
      d7ReturnToRecordRate: 0.35,
      d30ReturnToRecordRate: 0.12,
      d7RepeatSaveRate: 0.3,
      d30RepeatSaveRate: 0.11
    });

    mockGetAdminAnalyticsQuality.mockResolvedValue({
      dimensionSaveBreakdown: [
        { dimension: "joy", savedEntryCount: 10 },
        { dimension: "gratitude", savedEntryCount: 6 }
      ],
      draftEditRate: 0.3,
      boundaryInsufficientRate: 0.4,
      staleRate: 0.3,
      ai: {
        successRate: 0.88,
        p50LatencyMs: 900,
        p95LatencyMs: 2100,
        errorCodeBreakdown: [{ errorCode: "UPSTREAM_TIMEOUT", count: 2 }]
      }
    });

    mockListAdminAnalyticsUsers.mockResolvedValue([
      {
        id: "user-1",
        username: "daily_light_01",
        createdAt: "2026-05-01T00:00:00.000Z",
        latestActiveAt: "2026-05-20T08:00:00.000Z",
        funnelStep: "journal_saved",
        savedEntryCount: 1,
        savedDailyJournalCount: 0,
        riskTags: ["boundary_insufficient"]
      }
    ]);

    mockGetAdminAnalyticsUserDetail.mockResolvedValue({
      user: {
        id: "user-1",
        username: "daily_light_01",
        createdAt: "2026-05-01T00:00:00.000Z"
      },
      recentActiveAt: "2026-05-20T08:00:00.000Z",
      funnelStep: "journal_saved",
      scoreOverview: {
        scoreCount: 5,
        latestScoreDate: "2026-05-20"
      },
      sessions: [
        {
          id: "session-1",
          dimension: "joy",
          status: "completed",
          turnCount: 4,
          entryDate: "2026-05-02T00:00:00.000Z",
          startedAt: "2026-05-02T00:00:00.000Z",
          completedAt: "2026-05-02T00:10:00.000Z",
          pausedAt: null
        }
      ],
      joyEntries: [
        {
          id: "entry-1",
          sessionId: "session-1",
          title: "被稳稳接住",
          status: "saved",
          updatedAt: "2026-05-02T00:10:00.000Z",
          savedAt: "2026-05-02T00:10:00.000Z"
        }
      ],
      dailyJournals: [
        {
          id: "daily-1",
          date: "2026-05-02T16:00:00.000Z",
          title: "今天的记录",
          status: "saved",
          updatedAt: "2026-05-02T16:10:00.000Z",
          savedAt: "2026-05-02T16:10:00.000Z"
        }
      ],
      scores: []
    });

    mockGetAdminAnalyticsSessionDetail.mockResolvedValue({
      id: "session-1",
      status: "completed",
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "今天和家人一起吃饭聊天。"
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "听起来这是一个很被接住的时刻。"
        }
      ]
    });

    mockGetAdminAnalyticsEntryDetail.mockResolvedValue({
      id: "entry-1",
      title: "被稳稳接住",
      content: "今天和家人一起吃饭聊天。"
    });

    mockGetAdminAnalyticsDailyJournalDetail.mockResolvedValue({
      id: "daily-1",
      title: "今天的记录",
      content: "## 开心\n今天和家人一起吃饭聊天。"
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps in-page navigation links from scrolling back to the top", async () => {
    render(
      await AdminAnalyticsPage({
        searchParams: Promise.resolve({
          username: "daily"
        })
      })
    );

    expect(screen.getByRole("link", { name: "复盘视角" })).toHaveAttribute("data-scroll", "false");
    expect(screen.getByRole("link", { name: "监控视角" })).toHaveAttribute("data-scroll", "false");
    expect(screen.getByRole("link", { name: "最近 7 天" })).toHaveAttribute("data-scroll", "false");
    expect(screen.getByRole("link", { name: "boundary insufficient" })).toHaveAttribute("data-scroll", "false");
    expect(screen.getByRole("link", { name: "查看详情" })).toHaveAttribute("data-scroll", "false");
  });

  it("submits candidate search with router replace and preserves scroll position", async () => {
    render(
      await AdminAnalyticsPage({
        searchParams: Promise.resolve({
          view: "monitor",
          startDate: "2026-05-01",
          endDate: "2026-05-21",
          hasSavedJournal: "1",
          hasBoundaryInsufficient: "1"
        })
      })
    );

    const form = screen.getByRole("searchbox", { name: "" }).closest("form");
    const input = screen.getByPlaceholderText("按用户名定位候选用户");

    fireEvent.change(input, { target: { value: "daily" } });
    fireEvent.submit(form!);

    expect(mockRouterReplace).toHaveBeenCalledWith(
      "/admin/analytics?view=monitor&startDate=2026-05-01&endDate=2026-05-21&username=daily&hasSavedJournal=1&hasBoundaryInsufficient=1",
      { scroll: false }
    );
  });

  it("defaults to review mode with a dynamic 30-day range and no candidate table before search", async () => {
    render(
      await AdminAnalyticsPage({
        searchParams: Promise.resolve({})
      })
    );

    expect(mockGetAdminAnalyticsOverview).toHaveBeenCalledWith({
      startDate: "2026-04-22",
      endDate: "2026-05-21"
    });
    expect(mockListAdminAnalyticsUsers).toHaveBeenCalledWith({
      startDate: "2026-04-22",
      endDate: "2026-05-21",
      username: undefined,
      hasSavedJournal: false,
      hasBoundaryInsufficient: false,
      hasReopenedSession: false
    });

    expect(screen.getByRole("heading", { name: "管理员数据分析" })).toBeInTheDocument();
    expect(screen.getByText("复盘视角")).toBeInTheDocument();
    expect(screen.getByText("监控视角")).toBeInTheDocument();
    expect(screen.getByText("最近 30 天")).toBeInTheDocument();
    expect(screen.getByText("2026-04-22 至 2026-05-21")).toBeInTheDocument();
    expect(screen.getByText("当前调查路径")).toBeInTheDocument();
    expect(screen.getByText("第一步：先判断最近发生了什么")).toBeInTheDocument();
    expect(screen.getByText("第二步：先锁定一类人，再看个人")).toBeInTheDocument();
    expect(screen.getByText("先输入用户名或启用一个筛选条件，候选用户才会出现。")).toBeInTheDocument();

    expect(screen.queryByRole("table", { name: "候选用户结果" })).not.toBeInTheDocument();
    expect(screen.queryByText("用户下钻")).not.toBeInTheDocument();
    expect(screen.queryByText("daily_light_01")).not.toBeInTheDocument();
    expect(screen.getByText("第三步：进入单人上下文")).toBeInTheDocument();
    expect(screen.queryByText("为什么看到这个人")).not.toBeInTheDocument();
  });

  it("renders the monitor workflow when view=monitor is explicitly selected", async () => {
    render(
      await AdminAnalyticsPage({
        searchParams: Promise.resolve({
          view: "monitor",
          startDate: "2026-05-01",
          endDate: "2026-05-21"
        })
      })
    );

    expect(screen.getByText("链路健康")).toBeInTheDocument();
    expect(screen.getByText("异常信号")).toBeInTheDocument();
    expect(screen.getByText("质量风险")).toBeInTheDocument();
    expect(screen.queryByText("留存与回访")).not.toBeInTheDocument();
    expect(screen.getByText("当前视角：监控")).toBeInTheDocument();
  });

  it("shows candidate users as a light table when username search is active", async () => {
    render(
      await AdminAnalyticsPage({
        searchParams: Promise.resolve({
          username: "daily"
        })
      })
    );

    expect(mockListAdminAnalyticsUsers).toHaveBeenCalledWith({
      startDate: "2026-04-22",
      endDate: "2026-05-21",
      username: "daily",
      hasSavedJournal: false,
      hasBoundaryInsufficient: false,
      hasReopenedSession: false
    });

    expect(screen.getByRole("table", { name: "候选用户结果" })).toBeInTheDocument();
    expect(screen.getByText("当前调查对象")).toBeInTheDocument();
    expect(screen.getByText("正在看最近 30 天内，用户名命中“daily”的候选用户。")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "最近活跃" })).toBeInTheDocument();
    expect(screen.getByText("2026-05-20")).toBeInTheDocument();
    expect(screen.getByText("已保存维度日志")).toBeInTheDocument();
    expect(screen.getByText("1 篇维度日志")).toBeInTheDocument();
    expect(screen.getAllByText("boundary insufficient")).toHaveLength(2);
    const detailLink = screen.getByRole("link", { name: "查看详情" });
    expect(detailLink.getAttribute("href")).toContain("view=review");
    expect(detailLink.getAttribute("href")).toContain("startDate=2026-04-22");
    expect(detailLink.getAttribute("href")).toContain("endDate=2026-05-21");
    expect(detailLink.getAttribute("href")).toContain("username=daily");
    expect(detailLink.getAttribute("href")).toContain("userId=user-1");
  });

  it("shows candidate users when a quick filter is active", async () => {
    render(
      await AdminAnalyticsPage({
        searchParams: Promise.resolve({
          hasBoundaryInsufficient: "1"
        })
      })
    );

    expect(mockListAdminAnalyticsUsers).toHaveBeenCalledWith({
      startDate: "2026-04-22",
      endDate: "2026-05-21",
      username: undefined,
      hasSavedJournal: false,
      hasBoundaryInsufficient: true,
      hasReopenedSession: false
    });

    expect(screen.getByRole("table", { name: "候选用户结果" })).toBeInTheDocument();
    expect(screen.getByText("已启用筛选：boundary insufficient。")).toBeInTheDocument();
  });

  it("does not offer misleading error-code user drilldowns", async () => {
    render(
      await AdminAnalyticsPage({
        searchParams: Promise.resolve({
          view: "monitor"
        })
      })
    );

    expect(screen.queryByRole("link", { name: "查看受影响用户（2）" })).not.toBeInTheDocument();
    expect(screen.getByText("UPSTREAM_TIMEOUT")).toBeInTheDocument();
    expect(screen.getByText("当前范围记录到 2 次。")).toBeInTheDocument();
  });

  it("shows full single-user context only after selecting a user", async () => {
    render(
      await AdminAnalyticsPage({
        searchParams: Promise.resolve({
          view: "review",
          startDate: "2026-04-22",
          endDate: "2026-05-21",
          username: "daily",
          userId: "user-1",
          sessionId: "session-1",
          entryId: "entry-1",
          dailyJournalId: "daily-1"
        })
      })
    );

    expect(mockGetAdminAnalyticsUserDetail).toHaveBeenCalledWith("user-1");
    expect(mockGetAdminAnalyticsSessionDetail).toHaveBeenCalledWith("admin_user", "session-1");
    expect(mockGetAdminAnalyticsEntryDetail).toHaveBeenCalledWith("admin_user", "entry-1");
    expect(mockGetAdminAnalyticsDailyJournalDetail).toHaveBeenCalledWith("admin_user", "daily-1");

    expect(screen.getByText("第三步：进入单人上下文")).toBeInTheDocument();
    expect(screen.getByText("为什么看到这个人")).toBeInTheDocument();
    expect(screen.getByText("命中搜索词“daily”")).toBeInTheDocument();
    expect(screen.getByText("用户摘要")).toBeInTheDocument();
    expect(screen.getByText("最近会话")).toBeInTheDocument();
    expect(screen.getByText("最近维度日志")).toBeInTheDocument();
    expect(screen.getByText("最近完整日志")).toBeInTheDocument();
    expect(screen.getByText("展开对话原文")).toBeInTheDocument();
    expect(screen.getByText("展开维度日志正文")).toBeInTheDocument();
    expect(screen.getByText("展开完整日志正文")).toBeInTheDocument();
  });
});
