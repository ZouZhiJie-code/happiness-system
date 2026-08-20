import { describe, expect, it } from "vitest";

import {
  InsightsRangeError,
  resolveInsightsDateRange
} from "@/server/services/insights/date-range";

describe("insights date range", () => {
  const now = new Date("2026-08-12T17:00:00.000Z");

  it("uses an Asia/Shanghai calendar month by default", () => {
    expect(resolveInsightsDateRange({}, now)).toEqual({
      preset: "month",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      timeZone: "Asia/Shanghai",
      weekStartsOn: "monday"
    });
  });

  it("uses Monday through Sunday for a weekly range", () => {
    expect(resolveInsightsDateRange({ preset: "week" }, now)).toMatchObject({
      startDate: "2026-08-10",
      endDate: "2026-08-16"
    });
  });

  it("accepts a custom range no longer than 93 days", () => {
    expect(resolveInsightsDateRange({
      preset: "custom",
      startDate: "2026-05-13",
      endDate: "2026-08-13"
    }, now)).toMatchObject({
      preset: "custom",
      startDate: "2026-05-13",
      endDate: "2026-08-13"
    });
  });

  it.each([
    { preset: "year" },
    { preset: "custom", startDate: "2026-08-13", endDate: "2026-08-12" },
    { preset: "custom", startDate: "2026-05-12", endDate: "2026-08-13" },
    { preset: "custom", startDate: "bad", endDate: "2026-08-13" }
  ])("rejects an invalid range: %o", (input) => {
    expect(() => resolveInsightsDateRange(input, now)).toThrow(InsightsRangeError);
  });
});
