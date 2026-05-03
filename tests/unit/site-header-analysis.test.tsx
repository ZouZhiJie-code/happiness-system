import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { SiteHeader } from "@/components/shared/site-header";

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
      section: "score" as string | null
    }
  }
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

describe("site header analysis toolbar", () => {
  beforeEach(() => {
    mockPathname.value = "/analysis";
    mockRouterReplace.mockReset();
    mockSearchParams.value = {
      dimension: null,
      view: null,
      date: null,
      month: "2026-05",
      section: "score"
    };
  });

  it("renders analysis toolbar state in the header middle lane", async () => {
    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("analysis-toolbar");

    expect(within(toolbar).getByText("2026年5月")).toBeInTheDocument();
    expect(within(toolbar).getByText("记录分析")).toBeInTheDocument();
  });

  it("switches months from the header toolbar", async () => {
    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("analysis-toolbar");

    fireEvent.click(within(toolbar).getByRole("button", { name: "查看上月分析" }));
    expect(mockRouterReplace).toHaveBeenCalledWith("/analysis?month=2026-04&section=score", { scroll: false });

    fireEvent.click(within(toolbar).getByRole("button", { name: "查看下月分析" }));
    expect(mockRouterReplace).toHaveBeenCalledWith("/analysis?month=2026-06&section=score", { scroll: false });

    fireEvent.click(within(toolbar).getByRole("button", { name: "回到本月分析" }));
    expect(mockRouterReplace).toHaveBeenCalledWith("/analysis?month=2026-05&section=score", { scroll: false });
  });

  it("preserves the current analysis section when paging months", async () => {
    mockSearchParams.value = {
      dimension: null,
      view: null,
      date: null,
      month: "2026-05",
      section: "rhythm"
    };

    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("analysis-toolbar");

    fireEvent.click(within(toolbar).getByRole("button", { name: "查看上月分析" }));
    expect(mockRouterReplace).toHaveBeenCalledWith("/analysis?month=2026-04&section=rhythm", { scroll: false });
  });

  it("normalizes invalid analysis month values in the header toolbar", async () => {
    mockSearchParams.value = {
      dimension: null,
      view: null,
      date: null,
      month: "2026-13",
      section: "score"
    };

    render(<SiteHeader />);

    expect(mockRouterReplace).toHaveBeenCalledWith("/analysis?month=2026-05&section=score", { scroll: false });
    expect(await screen.findByTestId("analysis-toolbar")).toBeInTheDocument();
  });
});
