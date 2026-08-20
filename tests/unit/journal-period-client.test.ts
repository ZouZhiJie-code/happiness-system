import { afterEach, describe, expect, it, vi } from "vitest";

import {
  saveJournalPeriodReport,
  updateJournalPeriodReport
} from "@/components/journal/journal-period-client";

describe("journal period client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the report id in the URL and sends only autosave contract fields", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      id: "week/report",
      contentRevision: 4
    }));
    vi.stubGlobal("fetch", fetchMock);

    await updateJournalPeriodReport({
      reportId: "week/report",
      expectedContentRevision: 3,
      title: "本周",
      content: "这一周完成了联调。"
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/journal/period/week%2Freport", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedContentRevision: 3,
        title: "本周",
        content: "这一周完成了联调。"
      })
    });
  });

  it("keeps the report id in the URL and sends only the save revision", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      id: "month/report",
      contentRevision: 7
    }));
    vi.stubGlobal("fetch", fetchMock);

    await saveJournalPeriodReport({ reportId: "month/report", expectedContentRevision: 7 });

    expect(fetchMock).toHaveBeenCalledWith("/api/journal/period/month%2Freport/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedContentRevision: 7 })
    });
  });
});
