import { describe, expect, it } from "vitest";

import { formatAdminDateTime } from "@/features/ai-quality/admin-date-time";

describe("AI quality admin date time", () => {
  it("renders a stable Asia/Shanghai timestamp for server and browser hydration", () => {
    expect(formatAdminDateTime("2026-07-19T16:12:32.000Z")).toBe("2026/07/20 00:12:32");
  });
});
