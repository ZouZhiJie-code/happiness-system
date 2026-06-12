import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { DailyJournalWorkspace } from "@/components/interview/daily-journal-workspace";
import type { DailyJournalEntryRecord } from "@/types/interview";

const date = "2026-04-21";

const savedJoySource = {
  id: "entry-joy",
  sessionId: "session-joy",
  dimension: "joy" as const,
  title: "和家人一起吃饭",
  updatedAt: "2026-04-21T00:08:00.000Z",
  savedAt: "2026-04-21T00:08:00.000Z"
};

const savedDailyJournalEntry: DailyJournalEntryRecord = {
  id: "daily-1",
  date,
  title: "今天的记录",
  content: "## 开心\n今天和家人一起吃饭聊天，整个人慢慢放松下来。",
  status: "saved",
  sourceEntryIds: ["entry-joy"],
  sourceSessionIds: ["session-joy"],
  sourceSignature: "entry-joy:2026-04-21T00:08:00.000Z",
  sourceUpdatedAt: "2026-04-21T00:08:00.000Z",
  updatedAt: "2026-04-21T00:10:00.000Z",
  savedAt: "2026-04-21T00:10:00.000Z"
};

describe("DailyJournalWorkspace", () => {
  afterEach(() => {
    cleanup();
  });

  it("harvests drafts and saves the daily journal from the primary CTA", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === `/api/daily-journal?date=${date}`) {
        return new Response(
          JSON.stringify({
            dailyJournal: null,
            availableSourceCount: 1,
            draftSourceCount: 1,
            sources: [savedJoySource],
            state: "none"
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.endsWith("/api/daily-journal/save-all") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            dailyJournal: savedDailyJournalEntry,
            promotedDimensions: ["fulfillment"],
            availableSourceCount: 2,
            sources: [
              savedJoySource,
              {
                id: "entry-fulfillment",
                sessionId: "session-fulfillment",
                dimension: "fulfillment",
                title: "推进了项目",
                updatedAt: "2026-04-21T00:09:00.000Z",
                savedAt: "2026-04-21T00:09:00.000Z"
              }
            ],
            state: "saved"
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    render(<DailyJournalWorkspace date={date} openRequestId={1} />);

    const harvestButton = await screen.findByRole("button", { name: "收成并保存完整日志" });
    fireEvent.click(harvestButton);

    expect(await screen.findByTestId("daily-journal-harvest-notice")).toHaveTextContent(
      "已收成并保存完整日志，顺手保存了：充实"
    );
    expect(screen.getByDisplayValue(savedDailyJournalEntry.title)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/daily-journal/save-all",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ date })
      })
    );
  });

  it("disables harvest when there are no saved or draft dimension sources", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === `/api/daily-journal?date=${date}`) {
        return new Response(
          JSON.stringify({
            dailyJournal: null,
            availableSourceCount: 0,
            draftSourceCount: 0,
            sources: [],
            state: "none"
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(<DailyJournalWorkspace date={date} openRequestId={1} />);

    const harvestButton = await screen.findByRole("button", { name: "收成并保存完整日志" });

    await waitFor(() => {
      expect(harvestButton).toBeDisabled();
    });
    expect(screen.getByText("还没有完整日志")).toBeInTheDocument();
  });
});
