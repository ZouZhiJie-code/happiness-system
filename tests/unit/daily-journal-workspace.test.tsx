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

function savedJournalResponse() {
  return new Response(
    JSON.stringify({
      dailyJournal: savedDailyJournalEntry,
      availableSourceCount: 1,
      draftSourceCount: 0,
      sources: [savedJoySource],
      state: "saved"
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("DailyJournalWorkspace", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a saved daily journal as a read/edit surface without generation CTAs", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === `/api/daily-journal?date=${date}`) {
        return savedJournalResponse();
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(<DailyJournalWorkspace date={date} openRequestId={1} />);

    expect(await screen.findByTestId("daily-journal-editor")).toBeInTheDocument();
    expect(screen.getByDisplayValue(savedDailyJournalEntry.title)).toBeInTheDocument();

    // The three legacy footer actions are gone; nothing to save until the user edits.
    expect(screen.queryByRole("button", { name: "收成并保存完整日志" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "整理完整日志" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存正式日志" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存修改" })).not.toBeInTheDocument();
  });

  it("reveals 保存修改 after editing and saves via PUT then save", async () => {
    const updatedDraft: DailyJournalEntryRecord = {
      ...savedDailyJournalEntry,
      content: "## 开心\n今天和家人一起吃饭聊天，整个人慢慢放松下来，还多聊了一会儿。",
      status: "draft",
      savedAt: null
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === `/api/daily-journal?date=${date}`) {
        return savedJournalResponse();
      }

      if (url === "/api/daily-journal/daily-1" && init?.method === "PUT") {
        return new Response(JSON.stringify({ dailyJournal: updatedDraft }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url === "/api/daily-journal/daily-1/save" && init?.method === "POST") {
        return new Response(
          JSON.stringify({ dailyJournal: { ...updatedDraft, status: "saved", savedAt: "2026-04-21T00:20:00.000Z" } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });
    global.fetch = fetchMock as typeof fetch;

    render(<DailyJournalWorkspace date={date} openRequestId={1} />);

    const editor = await screen.findByTestId("daily-journal-editor");
    const textarea = editor.querySelector("textarea") as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: updatedDraft.content } });

    const saveButton = await screen.findByRole("button", { name: "保存修改" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/daily-journal/daily-1/save",
        expect.objectContaining({ method: "POST" })
      );
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/daily-journal/daily-1",
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("shows a read-only empty state when there is no daily journal yet", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === `/api/daily-journal?date=${date}`) {
        return new Response(
          JSON.stringify({
            dailyJournal: null,
            availableSourceCount: 1,
            draftSourceCount: 0,
            sources: [savedJoySource],
            state: "none"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(<DailyJournalWorkspace date={date} openRequestId={1} />);

    expect(await screen.findByText("还没有完整日志")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "收成并保存完整日志" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存修改" })).not.toBeInTheDocument();
  });
});
