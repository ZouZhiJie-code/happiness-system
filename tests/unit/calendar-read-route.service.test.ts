import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveJournalDayMode } = vi.hoisted(() => ({
  resolveJournalDayMode: vi.fn()
}));

vi.mock("@/server/repositories/journal-day-mode.repository", () => ({
  resolveJournalDayMode
}));

import {
  CalendarReadRouteError,
  getCalendarReadRoute
} from "@/server/services/calendar/calendar-read-route.service";

function cleanOwner(primaryMode: "dimension_legacy" | "event_centered") {
  return {
    kind: "clean" as const,
    ownership: {
      id: "ownership-1",
      userId: "user-1",
      entryDate: "2026-07-22",
      primaryMode,
      status: "clean" as const,
      claimedAt: "2026-07-22T00:00:00.000Z",
      claimedBySessionId: "session-1",
      lastAssertedAt: "2026-07-22T00:00:00.000Z",
      mixedAt: null,
      mixedReason: null,
      createdAt: "2026-07-22T00:00:00.000Z",
      updatedAt: "2026-07-22T00:00:00.000Z"
    }
  };
}

describe("calendar read route service", () => {
  beforeEach(() => resolveJournalDayMode.mockReset());

  it("按日期归属返回独立读取路径，混合日期显式返回 dual", async () => {
    resolveJournalDayMode
      .mockResolvedValueOnce({ kind: "unclaimed", entryDate: "2026-07-22" })
      .mockResolvedValueOnce(cleanOwner("dimension_legacy"))
      .mockResolvedValueOnce(cleanOwner("event_centered"))
      .mockResolvedValueOnce({
        kind: "mixed",
        code: "JOURNAL_DAY_MODE_MIXED",
        ownership: { ...cleanOwner("dimension_legacy").ownership, status: "mixed" }
      });

    await expect(getCalendarReadRoute("user-1", "2026-07-22")).resolves.toBe("empty");
    await expect(getCalendarReadRoute("user-1", "2026-07-22")).resolves.toBe("legacy");
    await expect(getCalendarReadRoute("user-1", "2026-07-22")).resolves.toBe("event_centered");
    await expect(getCalendarReadRoute("user-1", "2026-07-22")).resolves.toBe("dual");
  });

  it("拒绝非法日期并归类底层读取故障", async () => {
    await expect(getCalendarReadRoute("user-1", "2026-07-42")).rejects.toMatchObject({
      code: "INVALID_CALENDAR_DATE"
    } satisfies Partial<CalendarReadRouteError>);

    resolveJournalDayMode.mockRejectedValueOnce(new Error("db unavailable"));
    await expect(getCalendarReadRoute("user-1", "2026-07-22")).rejects.toMatchObject({
      code: "CALENDAR_READ_ROUTE_FAILED"
    } satisfies Partial<CalendarReadRouteError>);
  });
});
