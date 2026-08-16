/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, state } = vi.hoisted(() => {
  const state = {
    daily: [] as any[],
    legacyDaily: [] as any[],
    events: [] as any[]
  };
  const mockPrisma: Record<string, any> = {
    journalDailyEntry: { findMany: vi.fn(async () => state.daily) },
    dailyJournalEntry: { findMany: vi.fn(async () => state.legacyDaily) },
    journalEventEntry: { findMany: vi.fn(async () => state.events) },
    journalPeriodReport: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => [])
    },
    journalPeriodReportGeneration: { findFirst: vi.fn(async () => null) }
  };
  return { mockPrisma, state };
});

vi.mock("@/server/db/prisma", () => ({ prisma: mockPrisma }));

import { getJournalPeriodReportView } from "@/server/repositories/journal-period-report.repository";

const entryDate = new Date("2026-08-11T16:00:00.000Z");
const event = {
  id: "event-entry-1",
  title: "事件卡片",
  content: "事件卡片正文",
  contentRevision: 1,
  updatedAt: new Date("2026-08-12T01:00:00.000Z"),
  event: { id: "event-1", entryDate, daySequence: 1 }
};
const legacyDaily = {
  id: "legacy-daily-1",
  date: entryDate,
  title: "旧版完整日记",
  content: "旧版完整日记正文",
  updatedAt: new Date("2026-08-12T02:00:00.000Z"),
  sourceEntryIds: ["legacy-dimension-1"]
};
const currentDaily = {
  id: "daily-1",
  entryDate,
  title: "新版日记",
  content: "新版日记正文",
  contentRevision: 2,
  updatedAt: new Date("2026-08-12T03:00:00.000Z"),
  sourceEventIds: ["event-1"],
  sourceEntryIds: ["event-entry-1"],
  sourceSignature: "v2|record:event-entry-1|revision:1|seq:1"
};

describe("journal period material precedence", () => {
  beforeEach(() => {
    state.daily.splice(0);
    state.legacyDaily.splice(0);
    state.events.splice(0);
    vi.clearAllMocks();
  });

  it("uses valid new daily, then legacy full daily, then event cards", async () => {
    state.daily.push(currentDaily);
    state.legacyDaily.push(legacyDaily);
    state.events.push(event);
    let view = await getJournalPeriodReportView("user-1", "week", "2026-08-12");
    expect(view.materials.map((material) => material.kind)).toEqual(["daily_report"]);
    expect(view.materials[0]?.sourceId).toBe("daily:daily-1");

    state.daily[0] = { ...currentDaily, sourceSignature: "stale-signature" };
    view = await getJournalPeriodReportView("user-1", "week", "2026-08-12");
    expect(view.materials.map((material) => material.kind)).toEqual(["legacy_daily_report"]);
    expect(view.materials[0]?.sourceId).toBe("legacy-daily:legacy-daily-1");

    state.legacyDaily.splice(0);
    view = await getJournalPeriodReportView("user-1", "week", "2026-08-12");
    expect(view.materials.map((material) => material.kind)).toEqual(["event_card"]);
    expect(view.materials[0]?.sourceId).toBe("event:event-entry-1");
  });
});
