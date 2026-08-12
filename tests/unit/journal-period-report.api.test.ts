import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getView: vi.fn(),
  resolveRange: vi.fn(),
  execute: vi.fn(),
  update: vi.fn(),
  save: vi.fn(),
  getSavedRevision: vi.fn(),
  reserve: vi.fn(),
  commit: vi.fn(),
  fail: vi.fn()
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest: mocks.requireUser,
  isAuthenticationRequiredError: () => false
}));

vi.mock("@/server/repositories/journal-period-report.repository", () => ({
  getJournalPeriodReportView: mocks.getView,
  resolveJournalPeriodRange: mocks.resolveRange,
  getJournalPeriodReportGenerationView: mocks.getView,
  getLatestSavedJournalPeriodReportRevision: mocks.getSavedRevision,
  reserveJournalPeriodReportGeneration: mocks.reserve,
  commitJournalPeriodReportDraft: mocks.commit,
  failJournalPeriodReportGeneration: mocks.fail,
  updateJournalPeriodReport: mocks.update,
  saveJournalPeriodReport: mocks.save
}));

vi.mock("@/server/services/journal-period-report", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/services/journal-period-report")>();
  return { ...original, journalPeriodReportGenerationService: { execute: mocks.execute } };
});

import { PATCH as autosave } from "@/app/api/journal/period/[id]/route";
import { POST as save } from "@/app/api/journal/period/[id]/save/route";
import { POST as generate } from "@/app/api/journal/period/generate/route";
import { GET as getPeriod } from "@/app/api/journal/period/route";
import { JournalPeriodGenerationError } from "@/server/services/journal-period-report";

describe("journal period report API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.resolveRange.mockReturnValue({ kind: "week", startDate: "2026-08-10", endDate: "2026-08-16" });
  });

  it("returns the shared weekly/monthly view from the canonical query route", async () => {
    mocks.getView.mockResolvedValue({ displayStatus: "ungenerated", period: { kind: "week" } });
    const response = await getPeriod(
      new Request("http://localhost/api/journal/period?kind=week&date=2026-08-10")
    );
    expect(response.status).toBe(200);
    expect(mocks.getView).toHaveBeenCalledWith("user-1", "week", "2026-08-10");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("forwards source and revision guards when the user requests an update", async () => {
    mocks.execute.mockResolvedValue({ task: "update", report: { id: "week-1" } });
    const response = await generate(
      new Request("http://localhost/api/journal/period/generate", {
        method: "POST",
        body: JSON.stringify({
          kind: "week",
          date: "2026-08-10",
          task: "update",
          clientOperationId: "operation-1",
          expectedSourceSignature: "v1|sources",
          expectedContentRevision: 3
        })
      })
    );
    expect(response.status).toBe(200);
    expect(mocks.execute).toHaveBeenCalledWith({
      userId: "user-1",
      period: { kind: "week", startDate: "2026-08-10", endDate: "2026-08-16" },
      clientOperationId: "operation-1",
      expectedSourceSignature: "v1|sources",
      expectedContentRevision: 3
    }, "update");
  });

  it("keeps a source conflict recoverable and rejects unknown request fields", async () => {
    mocks.execute.mockRejectedValue(new JournalPeriodGenerationError("JOURNAL_PERIOD_REPORT_SOURCE_CHANGED"));
    const conflict = await generate(
      new Request("http://localhost/api/journal/period/generate", {
        method: "POST",
        body: JSON.stringify({ kind: "month", date: "2026-08-10" })
      })
    );
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({
      error: "JOURNAL_PERIOD_REPORT_SOURCE_CHANGED",
      retryable: false
    });
    const invalid = await generate(
      new Request("http://localhost/api/journal/period/generate", {
        method: "POST",
        body: JSON.stringify({ kind: "week", date: "2026-08-10", extra: true })
      })
    );
    expect(invalid.status).toBe(400);
  });

  it("autosaves and saves an explicit optimistic content revision", async () => {
    mocks.update.mockResolvedValue({ id: "week-1", contentRevision: 4 });
    const body = {
      expectedContentRevision: 3,
      title: "8月10日—16日",
      content: "用户编辑后的周报。",
      paragraphs: { schemaVersion: 1, paragraphs: [{ text: "用户编辑后的周报。", sourceIds: ["daily:1"] }] }
    };
    const autosaveResponse = await autosave(
      new Request("http://localhost/api/journal/period/week-1", {
        method: "PATCH",
        body: JSON.stringify(body)
      }),
      { params: Promise.resolve({ id: "week-1" }) }
    );
    expect(autosaveResponse.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ userId: "user-1", reportId: "week-1", ...body });

    mocks.save.mockResolvedValue({ id: "week-1", status: "saved", savedRevision: 4 });
    const saveResponse = await save(
      new Request("http://localhost/api/journal/period/week-1/save", {
        method: "POST",
        body: JSON.stringify({ expectedContentRevision: 4 })
      }),
      { params: Promise.resolve({ id: "week-1" }) }
    );
    expect(saveResponse.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith({ userId: "user-1", reportId: "week-1", expectedContentRevision: 4 });
  });
});
