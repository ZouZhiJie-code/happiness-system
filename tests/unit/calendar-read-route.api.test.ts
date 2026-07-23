import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCalendarReadRoute, CalendarReadRouteError } = vi.hoisted(() => ({
  getCalendarReadRoute: vi.fn(),
  CalendarReadRouteError: class extends Error {
    code: string;

    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
}));

const { requireCurrentUserFromRequest } = vi.hoisted(() => ({
  requireCurrentUserFromRequest: vi.fn()
}));

vi.mock("@/server/services/calendar/calendar-read-route.service", () => ({
  getCalendarReadRoute,
  CalendarReadRouteError
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest
}));

import { GET } from "@/app/api/calendar/read-route/route";

describe("calendar read-route api", () => {
  beforeEach(() => {
    getCalendarReadRoute.mockReset();
    requireCurrentUserFromRequest.mockReset();
    requireCurrentUserFromRequest.mockResolvedValue({ id: "user-1" });
  });

  it("返回日期和明确的读取路径", async () => {
    getCalendarReadRoute.mockResolvedValue("dual");

    const response = await GET(new Request("http://localhost/api/calendar/read-route?date=2026-07-22"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ date: "2026-07-22", route: "dual" });
  });

  it("保留日期参数错误和读取故障的区分", async () => {
    const missing = await GET(new Request("http://localhost/api/calendar/read-route"));
    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toEqual({ error: "INVALID_CALENDAR_DATE" });

    getCalendarReadRoute.mockRejectedValue(new CalendarReadRouteError("CALENDAR_READ_ROUTE_FAILED"));
    const failed = await GET(new Request("http://localhost/api/calendar/read-route?date=2026-07-22"));
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({ error: "CALENDAR_READ_ROUTE_FAILED" });
  });
});
