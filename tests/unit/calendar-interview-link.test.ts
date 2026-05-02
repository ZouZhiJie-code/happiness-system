import { buildCalendarDayViewCardItems, buildCalendarDimensionDetailItems, resolveCalendarPrimaryAction } from "@/features/calendar/interview-link";
import type { CalendarDayRecord, CalendarDimensionStatus } from "@/features/calendar/types";

function buildEmptyDay(date: string): CalendarDayRecord {
  return {
    date,
    overallStatus: "empty",
    dimensions: [
      {
        dimension: "joy",
        status: "empty",
        title: null,
        summary: null,
        latestUpdatedAt: null,
        sessionId: null,
        journalEntryId: null,
        actions: [],
        hasActiveSession: false,
        hasDraftEntry: false,
        hasSavedEntry: false
      },
      {
        dimension: "fulfillment",
        status: "empty",
        title: null,
        summary: null,
        latestUpdatedAt: null,
        sessionId: null,
        journalEntryId: null,
        actions: [],
        hasActiveSession: false,
        hasDraftEntry: false,
        hasSavedEntry: false
      },
      {
        dimension: "reflection",
        status: "empty",
        title: null,
        summary: null,
        latestUpdatedAt: null,
        sessionId: null,
        journalEntryId: null,
        actions: [],
        hasActiveSession: false,
        hasDraftEntry: false,
        hasSavedEntry: false
      },
      {
        dimension: "improvement",
        status: "empty",
        title: null,
        summary: null,
        latestUpdatedAt: null,
        sessionId: null,
        journalEntryId: null,
        actions: [],
        hasActiveSession: false,
        hasDraftEntry: false,
        hasSavedEntry: false
      },
      {
        dimension: "gratitude",
        status: "empty",
        title: null,
        summary: null,
        latestUpdatedAt: null,
        sessionId: null,
        journalEntryId: null,
        actions: [],
        hasActiveSession: false,
        hasDraftEntry: false,
        hasSavedEntry: false
      }
    ],
    activeCount: 0,
    draftCount: 0,
    savedCount: 0,
    primaryTitle: null,
    primarySummary: null,
    latestUpdatedAt: null,
    primaryAction: null
  };
}

describe("calendar interview links", () => {
  it("builds five start links for an empty past day", () => {
    const items = buildCalendarDimensionDetailItems(buildEmptyDay("2026-05-01"), "2026-05-02");

    expect(items).toHaveLength(5);
    expect(items.every((item) => item.actions[0]?.href?.includes("entryDate=2026-05-01"))).toBe(true);
  });

  it("disables start links for future days", () => {
    const items = buildCalendarDimensionDetailItems(buildEmptyDay("2099-01-01"), "2026-05-02");

    expect(items.every((item) => item.actions[0]?.href === null)).toBe(true);
    expect(items[0]?.actions[0]?.disabledReason).toBe("未来日期暂不支持开始记录");
  });

  it("resolves mixed primary actions by state priority instead of action order", () => {
    const dimension: CalendarDimensionStatus = {
      dimension: "reflection",
      status: "mixed",
      title: null,
      summary: null,
      latestUpdatedAt: "2026-05-01T12:00:00.000Z",
      sessionId: "session-reflection",
      journalEntryId: "entry-reflection",
      actions: ["edit_saved_journal", "view_journal", "continue_interview"],
      hasActiveSession: true,
      hasDraftEntry: false,
      hasSavedEntry: true
    };

    expect(resolveCalendarPrimaryAction(dimension)).toBe("continue_interview");
  });

  it("builds deterministic primary and secondary day-view actions", () => {
    const day = buildEmptyDay("2026-05-01");
    day.dimensions[0] = {
      ...day.dimensions[0],
      status: "mixed",
      sessionId: "session-joy",
      journalEntryId: "entry-joy",
      actions: ["edit_saved_journal", "view_journal", "continue_interview"],
      hasActiveSession: true,
      hasDraftEntry: false,
      hasSavedEntry: true
    };

    const items = buildCalendarDayViewCardItems(day, "2026-05-02");
    const joyCard = items.find((item) => item.dimension === "joy");

    expect(joyCard?.primaryAction.label).toBe("继续访谈");
    expect(joyCard?.primaryAction.href).toContain("sessionId=session-joy");
    expect(joyCard?.secondaryActions.map((action) => action.label)).toEqual(["查看日志", "编辑日志"]);
  });
});
