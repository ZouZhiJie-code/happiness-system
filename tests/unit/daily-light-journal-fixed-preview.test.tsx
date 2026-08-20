import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { DailyLightJournalFixedPreview } from "@/components/preview/daily-light-journal-fixed-preview";
import type { JournalDailyJournalView } from "@/types/journal-daily-entry";

function caseSummary(caseId: "v6-a1" | "v7r4-a1", editable: boolean) {
  return {
    caseId,
    label: caseId === "v6-a1" ? "v6 A1" : "v7r4 A1",
    entryDate: caseId === "v6-a1" ? "2026-08-09" : "2026-08-10",
    editable,
    eventEntryId: `record-${caseId}`,
    dailyEntryId: `daily-${caseId}`,
    sourceSignature: `signature-${caseId}`,
    contentRevision: 1
  };
}

function day(caseId: "v6-a1" | "v7r4-a1"): JournalDailyJournalView {
  const summary = caseSummary(caseId, caseId === "v7r4-a1");
  const source = {
    eventId: `event-${caseId}`,
    entryId: summary.eventEntryId,
    entryDate: summary.entryDate,
    daySequence: 1,
    title: `记录卡 ${caseId}`,
    content: `记录卡正文 ${caseId}`,
    contentRevision: 1,
    savedRevision: 1,
    savedAt: `${summary.entryDate}T04:00:00.000Z`,
    updatedAt: `${summary.entryDate}T04:00:00.000Z`,
    recordedAt: `${summary.entryDate}T03:00:00.000Z`,
    occurredAt: null,
    sourceMode: "chat" as const,
    recordCount: 1,
    sourceMessageIds: [`message-${caseId}`]
  };
  return {
    entryDate: summary.entryDate,
    savedSources: [source],
    legacyHistory: [],
    pendingSaveEntryIds: [],
    sourceSignature: summary.sourceSignature,
    collection: { kind: "single_entry", entryId: summary.eventEntryId },
    entry: {
      id: summary.dailyEntryId,
      entryDate: summary.entryDate,
      title: `今日日记 ${caseId}`,
      content: `日记正文 ${caseId}`,
      paragraphs: { schemaVersion: 1, paragraphs: [{ text: `日记正文 ${caseId}`, sourceRecordIds: [summary.eventEntryId] }] },
      status: "saved",
      sourceEntryIds: [summary.eventEntryId],
      sourceEventIds: [`event-${caseId}`],
      sourceSignature: summary.sourceSignature,
      sourceSnapshot: { schemaVersion: 2, entryDate: summary.entryDate, sources: [source] },
      sourceUpdatedAt: source.updatedAt,
      contentRevision: 1,
      savedRevision: 1,
      currentGenerationTraceId: null,
      lastGenerationErrorCode: null,
      editedAt: null,
      savedAt: source.savedAt,
      createdAt: source.savedAt!,
      updatedAt: source.updatedAt
    },
    freshness: "saved",
    displayStatus: "saved",
    latestGeneration: null,
    updateBlockedByPendingSource: false
  };
}

function response(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json", "X-Daily-Light-Preview-Model-Calls": "0" }
  });
}

describe("Daily Light fixed-six frontend adapter", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens five read-only semantics, switches to the editable case and sends all Preview markers", async () => {
    const session = {
      mode: "fixed-six-v1" as const,
      sessionId: "preview-session",
      cases: [caseSummary("v6-a1", false), caseSummary("v7r4-a1", true)],
      resetBehavior: "session_copy_auto_reset" as const,
      modelCalls: 0 as const
    };
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url === "/api/journal/preview/session" && init?.method === "POST") return response(session);
      if (url.includes("/api/journal/day?entryDate=2026-08-09")) return response(day("v6-a1"));
      if (url.includes("/api/journal/day?entryDate=2026-08-10")) return response(day("v7r4-a1"));
      return new Response(JSON.stringify({ error: "NOT_FOUND" }), { status: 404 });
    }) as typeof fetch;

    render(<DailyLightJournalFixedPreview />);

    expect(await screen.findByText("日记正文 v6-a1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "编辑日记" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: /v7r4 A1 · 可编辑/ }));
    expect(await screen.findByText("日记正文 v7r4-a1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑日记" })).toBeInTheDocument();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/journal/day?entryDate=2026-08-10",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-daily-light-preview": "fixed-six-v1",
          "x-daily-light-preview-session": "preview-session",
          "x-daily-light-preview-case": "v7r4-a1"
        })
      })
    ));
    expect(screen.getByText(/模型调用 0/)).toBeInTheDocument();
  });

  it("restores the same Preview session and selected case after refresh", async () => {
    window.sessionStorage.setItem("daily-light:journal-fixed-preview:v1", JSON.stringify({
      sessionId: "preview-session",
      selectedCaseId: "v7r4-a1"
    }));
    const session = {
      mode: "fixed-six-v1" as const,
      sessionId: "preview-session",
      cases: [caseSummary("v6-a1", false), caseSummary("v7r4-a1", true)],
      resetBehavior: "session_copy_auto_reset" as const,
      modelCalls: 0 as const
    };
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url === "/api/journal/preview/session" && !init?.method) return response(session);
      if (url.includes("/api/journal/day?entryDate=2026-08-10")) return response(day("v7r4-a1"));
      return new Response(JSON.stringify({ error: "NOT_FOUND" }), { status: 404 });
    }) as typeof fetch;

    render(<DailyLightJournalFixedPreview />);

    expect(await screen.findByText("日记正文 v7r4-a1")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/journal/preview/session",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-daily-light-preview-session": "preview-session" })
      })
    );
  });
});
