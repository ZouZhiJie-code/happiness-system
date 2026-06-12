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
      section: "trends" as string | null
    }
  }
}));

vi.mock("@/features/interview/entry-date", () => ({
  getTodayEntryDate: () => "2026-05-03"
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
  useRouter: () => ({
    replace: mockRouterReplace
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.value[key as "dimension" | "view" | "date" | "month" | "section"] ?? null
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
      section: "trends"
    };
  });

  afterEach(() => {
    historyReplaceStateSpy.mockRestore();
  });

  it("renders analysis month navigation and section tabs in the header", async () => {
    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("analysis-toolbar");

    expect(within(toolbar).getByText("2026-05-01 — 2026-05-03")).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "本周" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "本月" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "量化趋势" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "五维全景" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "关联" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "复盘" })).toBeInTheDocument();
  });

  it("highlights the active section tab", async () => {
    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("analysis-toolbar");

    expect(within(toolbar).getByRole("button", { name: "量化趋势" })).toHaveAttribute("aria-pressed", "true");
    expect(within(toolbar).getByRole("button", { name: "五维全景" })).toHaveAttribute("aria-pressed", "false");
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
    expect(mockRouterReplace).toHaveBeenCalledWith("/analysis?month=2026-04&section=trends", { scroll: false });

    fireEvent.click(within(toolbar).getByRole("button", { name: "查看下一2026年5月" }));
    expect(mockRouterReplace).toHaveBeenCalledWith("/analysis?month=2026-06&section=trends", { scroll: false });

    fireEvent.click(within(toolbar).getByRole("button", { name: "本月" }));
    expect(mockRouterReplace).toHaveBeenCalledWith(`/analysis?month=${CURRENT_MONTH}&section=trends`, { scroll: false });
  });

  it("preserves the current analysis section when paging months", async () => {
    mockSearchParams.value = {
      dimension: null,
      view: null,
      date: null,
      month: "2026-05",
      section: "review"
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
      section: "trends"
    };

    render(<SiteHeader />);

    expect(mockRouterReplace).toHaveBeenCalledWith("/analysis?month=2026-05&section=trends", { scroll: false });
    expect(await screen.findByTestId("analysis-toolbar")).toBeInTheDocument();
  });
});
