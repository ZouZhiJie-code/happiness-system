import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { SiteHeader } from "@/components/shared/site-header";

const CURRENT_MONTH = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit"
}).format(new Date());

const { mockPathname, mockRouterReplace, mockSearchParams } = vi.hoisted(() => ({
  mockPathname: {
    value: "/analysis"
  },
  mockRouterReplace: vi.fn(),
  mockSearchParams: {
    value: {
      dimension: null as string | null,
      view: null as string | null,
      date: null as string | null,
      month: "2026-05" as string | null,
      section: "trends" as string | null,
      preset: null as string | null,
      start: null as string | null,
      end: null as string | null
    }
  }
}));

vi.mock("@/features/interview/entry-date", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/interview/entry-date")>();

  return {
    ...actual,
    getTodayEntryDate: () => "2026-05-03"
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
  useRouter: () => ({
    replace: mockRouterReplace
  }),
  useSearchParams: () => ({
    get: (key: string) =>
      mockSearchParams.value[key as "dimension" | "view" | "date" | "month" | "section" | "preset" | "start" | "end"] ?? null
  })
}));

describe("SiteHeader analysis toolbar", () => {
  let historyReplaceStateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    historyReplaceStateSpy = vi.spyOn(window.history, "replaceState").mockImplementation(() => undefined);
    mockRouterReplace.mockReset();
    mockPathname.value = "/analysis";
    mockSearchParams.value = {
      dimension: null,
      view: null,
      date: null,
      month: "2026-05",
      section: "trends",
      preset: null,
      start: null,
      end: null
    };
  });

  afterEach(() => {
    historyReplaceStateSpy.mockRestore();
  });

  it("renders analysis month navigation and section tabs in the header", async () => {
    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("analysis-toolbar");

    expect(within(toolbar).getByTestId("analysis-period-stepper")).toBeInTheDocument();
    expect(within(toolbar).getByTestId("analysis-period-display")).toHaveTextContent("2026年5月");
    expect(within(toolbar).getByRole("button", { name: "本周" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "本月" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "量化趋势" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "五维记录" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "关联" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "复盘" })).toBeInTheDocument();
  });

  it("highlights the active section tab", async () => {
    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("analysis-toolbar");

    expect(within(toolbar).getByRole("button", { name: "量化趋势" })).toHaveAttribute("aria-pressed", "true");
    expect(within(toolbar).getByRole("button", { name: "五维记录" })).toHaveAttribute("aria-pressed", "false");
  });

  it("navigates to a section when clicking a tab", async () => {
    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("analysis-toolbar");

    fireEvent.click(within(toolbar).getByRole("button", { name: "关联" }));
    expect(mockRouterReplace).toHaveBeenCalledWith("/analysis?month=2026-05&section=correlation", { scroll: false });
    expect(historyReplaceStateSpy).not.toHaveBeenCalledWith(null, "", "/analysis?month=2026-05&section=correlation");
  });

  it("switches months from the header toolbar", async () => {
    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("analysis-toolbar");

    fireEvent.click(within(toolbar).getByRole("button", { name: "查看上一2026年5月" }));
    expect(within(toolbar).getByTestId("analysis-period-display")).toHaveTextContent("2026年4月");
    expect(within(toolbar).getByTestId("analysis-period-stepper")).toHaveAttribute("aria-busy", "true");
    expect(within(toolbar).getByTestId("analysis-period-loading-indicator")).toBeInTheDocument();
    expect(within(toolbar).getByTestId("analysis-period-stepper").querySelector(".sr-only")).toHaveTextContent(
      "正在读取本月分析…"
    );
    expect(mockRouterReplace).toHaveBeenCalledWith("/analysis?month=2026-04&section=trends", { scroll: false });

    fireEvent.click(within(toolbar).getByRole("button", { name: "查看下一2026年4月" }));
    expect(within(toolbar).getByTestId("analysis-period-display")).toHaveTextContent("2026年5月");
    expect(mockRouterReplace).toHaveBeenCalledWith("/analysis?month=2026-05&section=trends", { scroll: false });

    fireEvent.click(within(toolbar).getByRole("button", { name: "查看下一2026年5月" }));
    expect(within(toolbar).getByTestId("analysis-period-display")).toHaveTextContent("2026年6月");
    expect(mockRouterReplace).toHaveBeenCalledWith("/analysis?month=2026-06&section=trends", { scroll: false });

    fireEvent.click(within(toolbar).getByRole("button", { name: "本月" }));
    expect(mockRouterReplace).toHaveBeenCalledWith(`/analysis?month=${CURRENT_MONTH}&section=trends`, { scroll: false });
  });

  it("optimistically updates week range and shows week loading copy", async () => {
    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("analysis-toolbar");

    fireEvent.click(within(toolbar).getByRole("button", { name: "本周" }));
    expect(within(toolbar).getByTestId("analysis-period-display")).toHaveTextContent("2026-04-27 — 2026-05-03");
    expect(within(toolbar).getByTestId("analysis-period-stepper")).toHaveAttribute("aria-busy", "true");
    expect(within(toolbar).getByTestId("analysis-period-loading-indicator")).toBeInTheDocument();
    expect(within(toolbar).getByTestId("analysis-period-stepper").querySelector(".sr-only")).toHaveTextContent(
      "正在读取本周分析…"
    );
    expect(mockRouterReplace).toHaveBeenCalledWith(
      "/analysis?month=2026-05&section=trends&preset=week&start=2026-04-27&end=2026-05-03",
      { scroll: false }
    );

    fireEvent.click(within(toolbar).getByRole("button", { name: "查看上一周" }));
    expect(within(toolbar).getByTestId("analysis-period-display")).toHaveTextContent("2026-04-20 — 2026-04-26");
    expect(mockRouterReplace).toHaveBeenCalledWith(
      "/analysis?month=2026-04&section=trends&preset=week&start=2026-04-20&end=2026-04-26",
      { scroll: false }
    );
  });

  it("optimistically updates custom range inputs and shows custom loading copy", async () => {
    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("analysis-toolbar");

    fireEvent.click(within(toolbar).getByRole("button", { name: "自定义" }));
    expect(within(toolbar).getByLabelText("自定义开始日期")).toHaveValue("2026-05-01");
    expect(within(toolbar).getByLabelText("自定义结束日期")).toHaveValue("2026-05-03");
    expect(within(toolbar).getByTestId("analysis-period-stepper")).toHaveAttribute("aria-busy", "true");
    expect(within(toolbar).getByTestId("analysis-period-loading-indicator")).toBeInTheDocument();
    expect(within(toolbar).getByTestId("analysis-period-stepper").querySelector(".sr-only")).toHaveTextContent(
      "正在读取本区间分析…"
    );

    fireEvent.change(within(toolbar).getByLabelText("自定义结束日期"), {
      target: { value: "2026-05-10" }
    });
    expect(within(toolbar).getByLabelText("自定义结束日期")).toHaveValue("2026-05-10");
    expect(mockRouterReplace).toHaveBeenCalledWith(
      "/analysis?month=2026-05&section=trends&preset=custom&start=2026-05-01&end=2026-05-10",
      { scroll: false }
    );
  });

  it("preserves the current analysis section when paging months", async () => {
    mockSearchParams.value = {
      dimension: null,
      view: null,
      date: null,
      month: "2026-05",
      section: "review",
      preset: null,
      start: null,
      end: null
    };

    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("analysis-toolbar");

    fireEvent.click(within(toolbar).getByRole("button", { name: "查看上一2026年5月" }));
    expect(mockRouterReplace).toHaveBeenCalledWith("/analysis?month=2026-04&section=review", { scroll: false });
  });

  it("normalizes invalid analysis month values in the header toolbar", async () => {
    mockSearchParams.value = {
      dimension: null,
      view: null,
      date: null,
      month: "2026-13",
      section: "trends",
      preset: null,
      start: null,
      end: null
    };

    render(<SiteHeader />);

    expect(mockRouterReplace).toHaveBeenCalledWith("/analysis?month=2026-05&section=trends", { scroll: false });
    expect(await screen.findByTestId("analysis-toolbar")).toBeInTheDocument();
  });
});
