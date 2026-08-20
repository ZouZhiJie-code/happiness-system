import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { DailyLightJournalFixedPreview } from "@/components/preview/daily-light-journal-fixed-preview";
import {
  createJournalPreviewService
} from "@/server/services/journal-preview/service";
import type { JournalPreviewCaseId } from "@/server/services/journal-preview/contract";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Daily-Light-Preview-Model-Calls": "0"
    }
  });
}

describe("Daily Light fixed-six UI and real adapter closure", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("completes card edit, stale, manual protection, fixed update, refresh and baseline reset with zero model calls", async () => {
    let id = 0;
    const service = createJournalPreviewService({ id: () => `preview-session-${++id}` });
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      const sessionId = headers.get("x-daily-light-preview-session") ?? "";
      const caseId = headers.get("x-daily-light-preview-case") as JournalPreviewCaseId | null;
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      try {
        if (url === "/api/journal/preview/session" && init?.method === "POST") {
          return json(await service.createSession("user-1"));
        }
        if (url === "/api/journal/preview/session" && init?.method === "DELETE") {
          service.resetSession(sessionId);
          return json({ reset: true });
        }
        if (url === "/api/journal/preview/session") {
          return json(service.readSession("user-1", sessionId));
        }
        if (!caseId) return json({ error: "JOURNAL_PREVIEW_CASE_REQUIRED" }, 400);
        if (url.startsWith("/api/journal/day?entryDate=")) {
          const entryDate = new URL(url, "http://localhost").searchParams.get("entryDate") ?? "";
          return json((await service.readDay("user-1", sessionId, caseId, entryDate)).view);
        }
        const recordMatch = url.match(/^\/api\/interview\/event-centered\/journal\/([^/]+)$/u);
        if (recordMatch && init?.method === "PATCH") {
          return json(await service.updateRecord({
            userId: "user-1",
            sessionId,
            caseId,
            entryId: decodeURIComponent(recordMatch[1]!),
            expectedContentRevision: Number(body.expectedContentRevision),
            title: String(body.title),
            content: String(body.content)
          }));
        }
        if (recordMatch) {
          return json(await service.readRecord(
            "user-1",
            sessionId,
            caseId,
            decodeURIComponent(recordMatch[1]!)
          ));
        }
        const recordSaveMatch = url.match(/^\/api\/interview\/event-centered\/journal\/([^/]+)\/save$/u);
        if (recordSaveMatch && init?.method === "POST") {
          return json(await service.saveRecord({
            userId: "user-1",
            sessionId,
            caseId,
            entryId: decodeURIComponent(recordSaveMatch[1]!),
            expectedContentRevision: Number(body.expectedContentRevision)
          }));
        }
        const dailyMatch = url.match(/^\/api\/journal\/daily\/([^/]+)$/u);
        if (dailyMatch && init?.method === "PATCH") {
          return json(await service.updateDailyEntry({
            userId: "user-1",
            sessionId,
            caseId,
            entryId: decodeURIComponent(dailyMatch[1]!),
            expectedContentRevision: Number(body.expectedContentRevision),
            title: String(body.title),
            content: String(body.content)
          }));
        }
        const dailySaveMatch = url.match(/^\/api\/journal\/daily\/([^/]+)\/save$/u);
        if (dailySaveMatch && init?.method === "POST") {
          return json(await service.saveDailyEntry({
            userId: "user-1",
            sessionId,
            caseId,
            entryId: decodeURIComponent(dailySaveMatch[1]!),
            expectedContentRevision: Number(body.expectedContentRevision)
          }));
        }
        if (url === "/api/journal/daily/generate" && init?.method === "POST") {
          return json(await service.generateDaily({
            userId: "user-1",
            sessionId,
            caseId,
            task: body.task as "generate" | "update",
            expectedSourceSignature: String(body.expectedSourceSignature),
            expectedContentRevision: body.expectedContentRevision === null
              ? null
              : Number(body.expectedContentRevision),
            clientOperationId: String(body.clientOperationId)
          }));
        }
        return json({ error: "NOT_FOUND" }, 404);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "FAILED" }, 409);
      }
    }) as typeof fetch;

    const firstRender = render(<DailyLightJournalFixedPreview />);
    const readOnlyCases = [
      ["v6-a1", /v6 A1 · 只读/],
      ["v7-a1", /v7 A1 · 只读/],
      ["v7-a2", /v7 A2 · 只读/],
      ["v7r2-a1", /v7r2 A1 · 只读/],
      ["v7r2-a2", /v7r2 A2 · 只读/]
    ] as const;
    for (const [caseId, accessibleName] of readOnlyCases) {
      const link = await screen.findByRole("link", { name: accessibleName });
      fireEvent.click(link);
      await waitFor(() => expect(screen.getByRole("link", { name: accessibleName })).toHaveAttribute("aria-current", "page"));
      await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/journal/day?entryDate="),
        expect.objectContaining({
          headers: expect.objectContaining({ "x-daily-light-preview-case": caseId })
        })
      ));
      expect(screen.queryByRole("button", { name: "编辑内容" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "编辑日记" })).not.toBeInTheDocument();
    }
    fireEvent.click(await screen.findByRole("link", { name: /v7r4 A1 · 可编辑/ }));
    expect(await screen.findByRole("button", { name: "编辑内容" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "编辑内容" }));
    const cardBody = screen.getByRole("textbox", { name: "正文" });
    fireEvent.change(cardBody, { target: { value: `${String((cardBody as HTMLTextAreaElement).value)}\n\n卡片更新已进入日记。` } });
    await waitFor(() => expect(screen.getByText("内容已自动保存")).toBeInTheDocument(), { timeout: 1800 });
    fireEvent.click(screen.getByRole("button", { name: "完成编辑" }));
    expect(await screen.findByText("需更新", {}, { timeout: 2500 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "编辑日记" }));
    const dailyBody = screen.getByRole("textbox", { name: "日记正文" });
    fireEvent.change(dailyBody, { target: { value: `${String((dailyBody as HTMLTextAreaElement).value)}\n\n我的人工补充会被保留。` } });
    await waitFor(() => expect(screen.getByText("修改已自动暂存")).toBeInTheDocument(), { timeout: 1800 });
    fireEvent.click(screen.getByRole("button", { name: "完成修改" }));
    expect(await screen.findByRole("button", { name: "更新日记" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "更新日记" }));
    expect(await screen.findByText("草稿", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getAllByText(/卡片更新已进入日记。/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/我的人工补充会被保留。/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "继续编辑" }));
    fireEvent.click(screen.getByRole("button", { name: "保存日记" }));
    expect(await screen.findByRole("button", { name: "编辑日记" })).toBeInTheDocument();

    firstRender.unmount();
    render(<DailyLightJournalFixedPreview />);
    expect((await screen.findAllByText(/卡片更新已进入日记。/)).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/我的人工补充会被保留。/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "恢复固定基线" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "编辑日记" })).not.toBeInTheDocument());
    fireEvent.click(await screen.findByRole("link", { name: /v7r4 A1 · 可编辑/ }));
    await waitFor(() => expect(screen.queryByText(/卡片更新已进入日记。/)).not.toBeInTheDocument());
    expect(screen.queryByText(/我的人工补充会被保留。/)).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining("event-centered/journal/generate"), expect.anything());
  }, 15_000);
});
