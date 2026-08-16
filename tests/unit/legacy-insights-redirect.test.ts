const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect
}));

import AnalysisPage from "@/app/analysis/page";
import ProfilePage from "@/app/profile/page";

describe("旧认识自己入口兼容", () => {
  beforeEach(() => {
    mockRedirect.mockReset();
  });

  it("把旧分析筛选参数带到趋势页面", async () => {
    await AnalysisPage({
      searchParams: Promise.resolve({
        month: "2026-08",
        preset: "custom",
        start: "2026-08-01",
        end: "2026-08-12"
      })
    });

    expect(mockRedirect).toHaveBeenCalledWith(
      "/insights?section=trends&preset=custom&startDate=2026-08-01&endDate=2026-08-12"
    );
  });

  it("把旧月份转换为新版的完整自定义日期范围", async () => {
    await AnalysisPage({
      searchParams: Promise.resolve({ month: "2026-02" })
    });

    expect(mockRedirect).toHaveBeenCalledWith(
      "/insights?section=trends&preset=custom&startDate=2026-02-01&endDate=2026-02-28"
    );
  });

  it("把旧画像入口带到记录中的我", () => {
    ProfilePage();
    expect(mockRedirect).toHaveBeenCalledWith("/insights?section=portrait");
  });
});
